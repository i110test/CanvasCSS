var ImageGenerator;

(function() {

function numerize(value) {
    if (/(-?[\d\.]+)(?:px|%)$/.test(value)) {
        return +RegExp.$1;
    } else {
        return undefined;
    }
}

function isValidColor(color) {
    if (color.match(/rgb\(\d+,\s*\d+,\s*\d+\)/)) {
        return true;
    } else if (! color.match(/rgba\(\d+,\s*\d+,\s*\d+,\s*([\d\.]+)\)/)) {
        throw new Error('unexpected color format : ' + color);
    }
    var alpha = +(RegExp.$1);
    return (alpha > 0);
}

function getRadian(el) {
    var deg;
    var transform = CSSResolver.resolve(el, '-webkit-transform');
    if (! transform) {
        return 0;
    }
    if (transform.match(/rotate\((.+?)deg\)/)) {
        deg = +(RegExp.$1);
        return deg * Math.PI / 180;
    } else {
        var num = '([\\-\\d\\.]+?)';
        var sep = '\\s*,\\s*';
        var regex_text = 'matrix\\(' + [num, sep, num, sep, num, sep, num, sep, num, sep, num].join('') + '\\)';
        var regex = new RegExp(regex_text);    
        if (transform.match(regex)) {
            var m11 = RegExp.$1,
                m12 = RegExp.$2,
                m21 = RegExp.$3,
                m22 = RegExp.$4,
                dx  = RegExp.$5,
                dy  = RegExp.$6;
            var rad = Math.acos(m11);
            return rad;
        }
    }
    return 0;
}

function getAffineTransforms(el, upto) {
    var rad, cx, cy, _cx, _cy, tx, ty, transforms = [];
    while(true) {
        rad = getRadian(el);        
        if (rad !== 0) {
            cx = el.offsetLeft + (el.offsetWidth  / 2);
            cy = el.offsetTop  + (el.offsetHeight / 2);
            cx_ =  Math.cos(rad) * cx + Math.sin(rad) * cy;
            cy_ = -Math.sin(rad) * cx + Math.cos(rad) * cy;
            tx = cx_ - cx;
            ty = cy_ - cy;

            transforms.push({
                rad : rad,
                tx  : tx,
                ty  : ty
            });
        }

        if (el === upto) {
            break;
        }
        el = el.offsetParent;
        if (! el) {
            throw new Error('fuck');
        }
    }

    return transforms;
}

ImageGenerator = function(el) {
    this.element = el; 
    this.canvas = document.createElement('canvas');
    this.canvas.style.setProperty('display', 'none');
    this.drawer = undefined;
};


function calcOffset(el, isLeft) {
    if (! el) {
        return 0;
    }
    return (isLeft ? el.offsetLeft : el.offsetTop) + calcOffset(el.offsetParent, isLeft);
}
function calcOffsetLeft(el, base) {
    return calcOffset(el, true) - (base ? calcOffset(base, true) : 0);
}
function calcOffsetTop(el, base) {
    return calcOffset(el, false) - (base ? calcOffset(base, false) : 0);
}

ImageGenerator.prototype.init = function() {
    function updateRect(el, rect) {
        var offsetLeft   = calcOffsetLeft(el),
            offsetTop    = calcOffsetTop(el),
            offsetRight  = offsetLeft + el.offsetWidth,
            offsetBottom = offsetTop + el.offsetHeight;
        rect.l = (offsetLeft   < rect.l) ? offsetLeft   : rect.l;
        rect.t = (offsetTop    < rect.t) ? offsetTop    : rect.t;
        rect.r = (offsetRight  > rect.r) ? offsetRight  : rect.r;
        rect.b = (offsetBottom > rect.b) ? offsetBottom : rect.b;
    
        for (var i = 0; i < el.children.length; i++) {
            updateRect(el.children[i], rect);
        } 
    }
    
    var rect = {
        l : Number.POSITIVE_INFINITY,
        t : Number.POSITIVE_INFINITY,
        r : Number.NEGATIVE_INFINITY,
        b : Number.NEGATIVE_INFINITY 
    };
    updateRect(this.element, rect);

    var anchorLeft = calcOffsetLeft(this.element);
    var anchorTop  = calcOffsetTop(this.element);
    rect.l -= anchorLeft;
    rect.r -= anchorLeft;
    rect.t -= anchorTop;
    rect.b -= anchorTop;

    this.canvas.width  = rect.r - rect.l;
    this.canvas.height = rect.b - rect.t;

    var origin = {
        x : (rect.l < 0) ? - rect.l : 0,
        y : (rect.t < 0) ? - rect.t : 0
    };
    this.drawer = new CanvasDrawer(this.canvas, origin);

};

ImageGenerator.prototype._parseGradientPosition = function(pos, base) {
    if (/px$/.test(pos)) {
        return numerize(pos);
    } else if (/%$/.test(pos)) {
        return Math.round(numerize(pos) / 100 * base);
    } else if (pos === 'left' || pos === 'top') {
        return 0;
    } else if (pos === 'right' || pos === 'bottom') {
        return base;
    } else if (pos === 'center') {
        return Math.round(base / 2);
    } else {
        return null;
    }
};

ImageGenerator.prototype.preloadImages = function(callback) {
    var that = this;

    function collectImageUrls(el) {
        var accum = [];
        var url = that._extractImageUrl(el);
        if (url) {
            accum.push(url);
        }

        for(var i = 0; i < el.children.length; i++) {
            var child = el.children[i];
            accum = accum.concat(collectImageUrls(child));
        }
        return accum;
    }

    var urls = collectImageUrls(this.element),
        count = 0;

    if (urls.length === 0) {
        callback();
        return;
    }

    this.loadedImages = this.loadedImages || {};

    urls.forEach(function(url) {
        var image = new Image();
        var loadedCallback = function() {
            that.loadedImages[url] = image;            
            image.removeEventListener('load', loadedCallback);
            count++;
            if (count === urls.length && typeof callback === 'function') {
                callback();
            }
        };
        image.addEventListener('load', loadedCallback);
        image.src = url;
    });
};

ImageGenerator.prototype._extractImageUrl = function(el) {
    if (el.tagName === 'IMG' && el.src) {
        return el.src;
    } 
    var bgimg = CSSResolver.resolve(el, 'background-image');
    if (bgimg && bgimg.match(/url\(["']?(.*)["']?\)/)) {
        return RegExp.$1;
    }
    return undefined;
};
ImageGenerator.prototype._extractGradientArgs = function(el, context) {
    var styleText = CSSResolver.resolve(el, 'background-image');
    if (! /-webkit-gradient/.test(styleText)) {
        return null;
    }

    // this way to parse webkig-linear-gradient is very temporary,
    // and replaced by parser generated by ANTLR or else

    if (! styleText.match(/-webkit-gradient\((.*?),/)) {
        return null;
    }
    var shape = RegExp.$1;
    if (shape !== 'linear') {
        return null;
    }

    var m;
    var start, end;
    var sx, sy, ex, ey;
    if ((m = styleText.match(/-webkit-gradient\(linear,\s*(.*?)\s+(.*?),\s*(.*?)\s+(.*?),/))) {
        sx = this._parseGradientPosition(m[1], el.clientWidth);
        sy = this._parseGradientPosition(m[2], el.clientHeight);
        ex = this._parseGradientPosition(m[3], el.clientWidth);
        ey = this._parseGradientPosition(m[4], el.clientHeight);
        start = { x : sx, y : sy };
        end   = { x : ex, y : ey };
    } else {
        throw 'fuck';
    }

    var colorStops = [];

    styleText.match(/from\s*\((rgb\(.*?\))\)/);
    colorStops.push({ pos : 0.0, color : RegExp.$1 }); 

    styleText.match(/to\s*\((rgb\(.*?\))\)/);
    colorStops.push({ pos : 1.0, color : RegExp.$1 }); 

    var regex = /color-stop\s*\(\s*(.*?)\s*,\s*(rgb\(.*?\))\s*\)/g;
    while ((m = regex.exec(styleText))) {
        colorStops.push({ pos : +m[1], color : m[2] });
    }

    var offsetLeft = calcOffsetLeft(el, context);
    var offsetTop  = calcOffsetTop(el, context);
    var region = {
        x1 : offsetLeft + el.clientLeft,
        y1 : offsetTop  + el.clientTop,
        x2 : offsetLeft + el.clientLeft + el.clientWidth,
        y2 : offsetTop  + el.clientTop + el.clientHeight
    };

    return {
        start : { x : sx, y : sy },
        end   : { x : ex, y : ey },
        region : region,
        colorStops : colorStops,
        transforms : getAffineTransforms(el, this.element)
    };
};
ImageGenerator.prototype.drawElementBackgroundColor = function(el) {
    var bgcolor = CSSResolver.resolve(el, 'background-color');
    if (bgcolor && isValidColor(bgcolor)) {
        this.drawer.fillRect({
            x : calcOffsetLeft(el, this.element) + el.clientLeft,
            y : calcOffsetTop(el, this.element) + el.clientTop,
            w : el.clientWidth,
            h : el.clientHeight,
            style : bgcolor,
            transforms : getAffineTransforms(el, this.element)
        });
    }
};
ImageGenerator.prototype.drawElementBorder = function(el) {
    // TODO: handling border-radius
    var sides = ['left', 'top', 'right', 'bottom'];
    for (var i = 0; i < sides.length; i++) {
        var side = sides[i];
        var color = CSSResolver.resolve(el, 'border-' + side + '-color');
        var width = numerize(CSSResolver.resolve(el, 'border-' + side + '-width'));
        if (! width) {
            continue;
        }
        var sx, sy, ex, ey;
        var relLeft = calcOffsetLeft(el, this.element);
        var relTop  = calcOffsetTop(el, this.element);
        if (side === 'left' || side === 'top') {
            sx = relLeft;
            sy = relTop;
        } else {
            sx = relLeft + el.offsetWidth;
            sy = relTop  + el.offsetHeight;
        }
        if (side === 'right' || side === 'top') {
            ex = relLeft + el.offsetWidth;
            ey = relTop;
        } else {
            ex = relLeft;
            ey = relTop + el.offsetHeight;
        }

        this.drawer.drawBorderLine({
            x1 : sx,
            y1 : sy,
            x2 : ex,
            y2 : ey,
            side : side,
            width : width,
            style : color,
            transforms : getAffineTransforms(el, this.element)
        });
    }
};
ImageGenerator.prototype.drawElementGradient = function(el) {
    var args = this._extractGradientArgs(el, this.element);
    if (args) {
        this.drawer.drawLinearGradient(args);
    }
};
ImageGenerator.prototype.drawElementImage = function(el) {
    var imageUrl = this._extractImageUrl(el);
    if (imageUrl && this.loadedImages[imageUrl]) {
        var image = this.loadedImages[imageUrl];
        var cols = 1, rows = 1;
       

        // TODO : temporary
        // should hanlde background-size and background-position
        var destWidth  = (el.tagName === 'IMG' ? el.clientWidth  : image.width); 
        var destHeight = (el.tagName === 'IMG' ? el.clientHeight : image.height); 

        var bgrepeat = CSSResolver.resolve(el, 'background-repeat');
        var sum;
        if (bgrepeat === 'repeat' || bgrepeat === 'repeat-x') {
            sum = destWidth;
            while(sum < el.clientWidth) {
                cols++;
                sum += destWidth;
            }
        }
        if (bgrepeat === 'repeat' || bgrepeat === 'repeat-y') {
            sum = destHeight;
            while(sum < el.clientHeight) {
                rows++;
                sum += destHeight;
            }
        }

        var offsetLeft = calcOffsetLeft(el, this.element);
        var offsetTop  = calcOffsetTop(el, this.element);

        for (var i = 0; i < rows; i++) {
            for (var j = 0; j < cols; j++) {
                this.drawer.drawImage({
                    url : imageUrl,
                    destRect : {
                        x : offsetLeft + el.clientLeft + destWidth  * j,
                        y : offsetTop  + el.clientTop + destHeight * i,
                        w : destWidth,
                        h : destHeight
                    },
                    transforms : getAffineTransforms(el, this.element)
                });
            }
        }
    }
};
ImageGenerator.prototype.draw = function(el) {
    el = el || this.element;

    this.drawElementBackgroundColor(el);
    this.drawElementGradient(el);
    this.drawElementImage(el);
    this.drawElementBorder(el);

    for (var i = 0; i < el.children.length; i++) {
        this.draw(el.children[i]);
    }
};
// TODO: store old styles
ImageGenerator.prototype.eraseElementBackground = function(el) {
    el.style.setProperty('background-color', 'transparent');
};
ImageGenerator.prototype.eraseElementGradientAndImage = function(el) {
    el.style.setProperty('background-image', 'none');
    if (el.tagName === 'IMG') {
        el.src = 'img/dummy.png';
    }
};
ImageGenerator.prototype.eraseElementBorder = function(el) {
    var sides = ['left', 'top', 'right', 'bottom'];
    for (var i = 0; i < sides.length; i++) {
        el.style.setProperty('border-' + sides[i] + '-width', '0');
    }
};
ImageGenerator.prototype.erase = function(el) {
    el = el || this.element;

    this.eraseElementBackground(el);
    this.eraseElementGradientAndImage(el);
    this.eraseElementBorder(el);

    for (var i = 0; i < el.children.length; i++) {
        this.erase(el.children[i]);
    }
};

ImageGenerator.prototype.place = function() {
    this.canvas.style.setProperty('position', 'absolute');
    this.canvas.style.setProperty('left', (calcOffsetLeft(this.element) - this.drawer.origin.x) + 'px');
    this.canvas.style.setProperty('top',  (calcOffsetTop(this.element) - this.drawer.origin.y) + 'px');
    this.canvas.style.setProperty('z-index', '10000'); // TODO: replace magic number

    var parent = this.element.parentNode;
    if (parent.firstChild !== this.canvas) {
        parent.insertBefore(this.canvas, parent.firstChild);
    }
};
ImageGenerator.prototype.freeze = function() {
    // this.element.style.setProperty('visibility', 'hidden');
    this.erase(this.element);
    this.canvas.style.setProperty('display', 'block');
};
ImageGenerator.prototype.unfreeze = function() {
    // this.element.style.setProperty('visibility', 'visible');
    this.canvas.style.setProperty('display', 'none');
    throw new Error('not implemented yet');
};

})();