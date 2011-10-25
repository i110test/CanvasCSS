var DomFreezer;

(function() {

var regexCache = {};
(function(C) {
	C.transformMatrix = (function() {
	    var num = '([\\-\\d\\.]+?)',
	        sep = '\\s*,\\s*',
	        regex_text = 'matrix\\(' + [num, sep, num, sep, num, sep, num, sep, num, sep, num].join('') + '\\)',
	        regex = new RegExp(regex_text);
	    return regex;
	})();
	C.transformRotate = /rotate\((.+?)deg\)/;
	C.rgb = /rgb\(\d+,\s*\d+,\s*\d+\)/;
	C.rgba = /rgba\(\d+,\s*\d+,\s*\d+,\s*([\d\.]+)\)/;
	C.url = /url\(["']?(.*)["']?\)/;
	C.pair = /(.*)\s+(.*)/;
})(regexCache);

function numerize(value) {
	var m;
    if (m = value.match(/(-?[\d\.]+)(?:px|%)$/)) {
        return +(m[1]);
    } else {
        return undefined;
    }
}

function isValidColor(color) {
	var m;
    if (color.match(regexCache.rgb)) {
        return true;
    } else if (! (m = color.match(regexCache.rgba))) {
        throw new Error('unexpected color format : ' + color);
    }
    var alpha = +(m[1]);
    return (alpha > 0);
}

function getAffineTransform(el) {
    var transform = CSSResolver.resolve(el, '-webkit-transform');
	var m;
    if (! transform) {
        return null;
    }
    if (m = transform.match(regexCache.transformMatrix)) {
        return [+(m[1]), +(m[2]), +(m[3]), +(m[4]), +(m[5]), +(m[6])];
    } else if (m = transform.match(regexCache.transformRotate)) {
        var deg = +(m[1]);
        var rad = deg * Math.PI / 180;
        return [Math.cos(rad), -Math.sin(rad), Math.sin(rad), Math.cos(rad), 0, 0];
    }
    return null;
}

function getAffineTransformWithOrigin(el, origin) {
    var transform = DomFreezer.exports.getAffineTransform(el);
    if (! transform) {
        return null;
    }
    var transformed_origin = Geometry.transformVector(origin, [transform[0], transform[1], transform[2], transform[3], 0, 0]);
    var tx = origin[0] - transformed_origin[0];
    var ty = origin[1] - transformed_origin[1];

    transform[4] += tx;
    transform[5] += ty;

    return transform;
}

DomFreezer = function(el) {
    this.element = el; 
    this.canvas = document.createElement('canvas');
    this.canvas.style.setProperty('display', 'none');
    this.renderer = undefined;
	this.scale = 2.0;
};
DomFreezer.DUMMY_IMAGE = 'img/dummy.png';
DomFreezer.exports = {
    getAffineTransform : getAffineTransform,
    getAffineTransformWithOrigin : getAffineTransformWithOrigin,
	calcOffsetLeft : calcOffsetLeft,
	calcOffsetTop : calcOffsetTop,
	isValidColor : isValidColor
};

function calcOffset(el, isLeft) {
    if (! el) {
        return 0;
    }
    return (isLeft ? el.offsetLeft : el.offsetTop) + calcOffset(el.offsetParent, isLeft);
}
function calcOffsetLeft(el, base) {
    if (base === el) {
        return 0;
    }
    return calcOffset(el, true) - (base ? calcOffset(base, true) : 0);
}
function calcOffsetTop(el, base) {
    if (base === el) {
        return 0;
    }
    return calcOffset(el, false) - (base ? calcOffset(base, false) : 0);
}

/*
function getOffset(el) {
    return {
        l : el.offsetLeft,
        t : el.offsetTop,
        r : el.offsetLeft + el.offsetWidth,
        b : el.offsetTop + el.offsetHeight
    };
}
*/

function getOffsetRect(el, base) {
    base = base || el.offsetParent;
    var l = calcOffsetLeft(el, base),
        t = calcOffsetTop(el, base),
        r = l + el.offsetWidth,
        b = t + el.offsetHeight;
    
    return {
        l : l, t : t, r : r, b : b
    };
}

/*
function getOffsetCenter(el) {
    return [
        el.offsetLeft + (el.offsetWidth  / 2),
        el.offsetTop  + (el.offsetHeight / 2)
    ];
}
*/

DomFreezer.prototype.getTransforms = function(el, upto) {
    upto = upto || this.element;
    var transform, center, transformed_center, tx, ty, transforms;
    while(true) {
        if (el === upto) {
            break;
        }
        center = getOffsetCenter(el);
        transform = DomFreezer.exports.getAffineTransformWithOrigin(el, center);        
        if (transform) {
            if (! transforms) {
                transforms = [];
            }
            transforms.push(transform);
        }

        // TODO: is this correct? offsetParent or not?
        el = el.parentElement;
        if (! el) {
            break;
            //throw new Error('fuck');
        }
    }

    return transforms;
};

function getOffsetCenter(el) {
	return [
		el.offsetWidth / 2,
		el.offsetHeight / 2
	];
}
/*
function getOffsetCenter(el, base) {
    base = base || el.offsetParent; 
    return [
        calcOffsetLeft(el, base) + (el.offsetWidth  / 2),
        calcOffsetTop(el, base)  + (el.offsetHeight / 2)
    ];
}
*/

DomFreezer.prototype.init = function() {
	var that = this;

    function updateRect(el, rect) {
        var elRect = getOffsetRect(el, that.element);
        var center = getOffsetCenter(el);
        var i;

        var transform = DomFreezer.exports.getAffineTransformWithOrigin(el, center);
        if (transform) {
            var points = [
                Geometry.transformVector([elRect.l, elRect.t], transform),
                Geometry.transformVector([elRect.r, elRect.t], transform),
                Geometry.transformVector([elRect.r, elRect.b], transform),
                Geometry.transformVector([elRect.l, elRect.b], transform)
            ];
            elRect = {
                l : Number.POSITIVE_INFINITY,
                t : Number.POSITIVE_INFINITY,
                r : Number.NEGATIVE_INFINITY,
                b : Number.NEGATIVE_INFINITY
            };

            for (i = 0; i < points.length; i++) {
                elRect.l = points[i][0] < elRect.l ? points[i][0] : elRect.l;
                elRect.t = points[i][1] < elRect.t ? points[i][1] : elRect.t;
                elRect.r = points[i][0] > elRect.r ? points[i][0] : elRect.r;
                elRect.b = points[i][1] > elRect.b ? points[i][1] : elRect.b;
            } 
        }
        rect.l = (elRect.l < rect.l) ? elRect.l : rect.l;
        rect.t = (elRect.t < rect.t) ? elRect.t : rect.t;
        rect.r = (elRect.r > rect.r) ? elRect.r : rect.r;
        rect.b = (elRect.b > rect.b) ? elRect.b : rect.b;
    
        for ( i = 0; i < el.children.length; i++) {
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

    this.canvas.width  = (rect.r - rect.l) * this.scale;
    this.canvas.height = (rect.b - rect.t) * this.scale;
	this.canvas.style.setProperty('-webkit-transform', 'scale(' + (1 / this.scale) + ')');
	this.canvas.style.setProperty('-webkit-transform-origin', '0 0');

    var origin = {
        x : Math.max(-(rect.l), 0) * this.scale,
        y : Math.max(-(rect.t), 0) * this.scale
    };

    this.renderer = new CSSRenderer(this.canvas, origin, this.scale);

	// console.log([origin.x, origin.y, this.canvas.width, this.canvas.height]);
};

DomFreezer.prototype._parseCSSValue = function(pos, base) {
    if (/px$/.test(pos)) {
        return numerize(pos);
    } else if (/%$/.test(pos)) {
        return base ? Math.round(numerize(pos) / 100 * base) : null;
//TODO : handle em
    } else if (pos === 'left' || pos === 'top') {
        return 0;
    } else if (pos === 'right' || pos === 'bottom') {
        return base || null;
    } else if (pos === 'center') {
        return base ? Math.round(base / 2) : null;
    } else {
        return null;
    }
};

DomFreezer.prototype.preloadImages = function(callback) {
    var that = this;

    function collectImageUrls(el) {
        var accum = [];
        var url = that._extractImageUrl(el);
        if (url) {
            accum.push(url);
        }
		url = that._extractMaskImageUrl(el);
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

DomFreezer.prototype._extractImageUrl = function(el) {
    if (el.tagName === 'IMG' && el.src) {
        return el.src;
    } 
    var bgimg = CSSResolver.resolve(el, 'background-image');
	var m;
    if (bgimg && (m = bgimg.match(regexCache.url))) {
        return m[1];
    }
    return null;
};
DomFreezer.prototype._extractMaskImageUrl = function(el) {
	var maskimg = CSSResolver.resolve(el, '-webkit-mask-image');
	var m;
    if (maskimg && (m = maskimg.match(regexCache.url))) {
		return m[1];
	}
	return null;
};
DomFreezer.prototype._extractGradientArgs = function(el, context) {
    var styleText = CSSResolver.resolve(el, 'background-image');
    if (! /-webkit-gradient/.test(styleText)) {
        return null;
    }
	var m;

    // this way to parse webkig-linear-gradient is very temporary,
    // and replaced by parser generated by ANTLR or else

    if (! (m = styleText.match(/-webkit-gradient\((.*?),/))) {
        return null;
    }
    var shape = m[1];
    if (shape !== 'linear') {
        return null;
    }

    var m;
    var sx, sy, ex, ey;
    if ((m = styleText.match(/-webkit-gradient\(linear,\s*(.*?)\s+(.*?),\s*(.*?)\s+(.*?),/))) {
        sx = this._parseCSSValue(m[1], el.clientWidth);
        sy = this._parseCSSValue(m[2], el.clientHeight);
        ex = this._parseCSSValue(m[3], el.clientWidth);
        ey = this._parseCSSValue(m[4], el.clientHeight);
    } else {
        throw 'fuck';
    }

    var colorStops = [];

    m = styleText.match(/from\s*\((rgb\(.*?\))\)/);
    colorStops.push({ pos : 0.0, color : m[1] }); 

    m = styleText.match(/to\s*\((rgb\(.*?\))\)/);
    colorStops.push({ pos : 1.0, color : m[1] }); 

    var regex = /color-stop\s*\(\s*(.*?)\s*,\s*(rgb\(.*?\))\s*\)/g;
    while ((m = regex.exec(styleText))) {
        colorStops.push({ pos : +m[1], color : m[2] });
    }

    var offsetLeft = calcOffsetLeft(el, context);
    var offsetTop  = calcOffsetTop(el, context);

    var start = {
        x : offsetLeft + el.clientLeft + sx,
        y : offsetTop  + el.clientTop  + sy
    };
    var end = {
        x : offsetLeft + el.clientLeft + ex,
        y : offsetTop  + el.clientTop  + ey
    };
    var region = {
        x : offsetLeft + el.clientLeft,
        y : offsetTop  + el.clientTop,
        width  : el.clientWidth,
        height : el.clientHeight
    };

    return {
        start : start,
        end   : end,
        region : region,
        colorStops : colorStops,
        transforms : this.getTransforms(el)
    };
};
DomFreezer.prototype.drawElementBackgroundColor = function(el) {
    var bgcolor = CSSResolver.resolve(el, 'background-color');
    if (bgcolor && DomFreezer.exports.isValidColor(bgcolor)) {
        this.renderer.fillRect({
            x : calcOffsetLeft(el, this.element) + el.clientLeft,
            y : calcOffsetTop(el, this.element) + el.clientTop,
            w : el.clientWidth,
            h : el.clientHeight,
            style : bgcolor,
            transforms : this.getTransforms(el)
        });
    }
};
DomFreezer.prototype.drawElementBorder = function(el) {
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

        this.renderer.drawBorderLine({
            x1 : sx,
            y1 : sy,
            x2 : ex,
            y2 : ey,
            side : side,
            width : width,
            style : color,
            transforms : this.getTransforms(el)
        });
    }
};
DomFreezer.prototype.drawElementText = function(el) {
	// TODO: shadow!!

	// assumed el is span or header tag, and display is inline
	var text = el.innerText;
	var x = calcOffsetLeft(el, this.element) + 
		el.clientLeft + 
		this._parseCSSValue(CSSResolver.resolve(el, 'padding-left')) + 
		this._parseCSSValue(CSSResolver.resolve(el, 'text-indent'));
	var y = calcOffsetTop(el, this.element) + 
		el.clientTop  + 
		this._parseCSSValue(CSSResolver.resolve(el, 'padding-top'));

	var fontStyle   = CSSResolver.resolve(el, 'font-style');
	var fontVariant = CSSResolver.resolve(el, 'font-variant');
	var fontWeight  = CSSResolver.resolve(el, 'font-weight');
	var fontSize    = CSSResolver.resolve(el, 'font-size');
	var lineHeight  = CSSResolver.resolve(el, 'line-height');
	var fontFamily  = CSSResolver.resolve(el, 'font-family');
//TODO: em
fontSize = Math.round(numerize(fontSize) * this.scale) + 'px';
	var font =  (fontStyle ? fontStyle + ' ' : '') + 
				(fontVariant ? fontVariant + ' ' : '') + 
				(fontWeight ? fontWeight + ' ' : '') + 
				fontSize +  
				(lineHeight ? '/' + lineHeight : '') + ' ' +  
				fontFamily;	
	var style = CSSResolver.resolve(el, 'color');
	var maxWidth = el.clientWidth;

	this.renderer.drawText({
		text : text,
		x : x,
		y : y,
		font : font,
		style : style,
		maxWidth : maxWidth,
        transforms : this.getTransforms(el)
	});
};
DomFreezer.prototype.drawElementGradient = function(el) {
    var args = this._extractGradientArgs(el, this.element);
    if (args) {
        this.renderer.drawLinearGradient(args);
    }
};
DomFreezer.prototype.drawElementImage = function(el) {
	var m;
    var imageUrl = this._extractImageUrl(el);
    if (imageUrl && this.loadedImages[imageUrl]) {
        var image = this.loadedImages[imageUrl];

        var offsetLeft = calcOffsetLeft(el, this.element) + el.clientLeft;
        var offsetTop = calcOffsetTop(el, this.element) + el.clientTop;

		// mask image
		// TODO: mask should be processed to all elements,
		// this is much temporal
		var maskImage = undefined;
    	var maskImageUrl = this._extractMaskImageUrl(el);
    	if (maskImageUrl && this.loadedImages[maskImageUrl]) {
    		maskImage = this.loadedImages[maskImageUrl];
		}

		var transforms = this.getTransforms(el);

        if (el.tagName === 'IMG') {
            this.renderer.drawImage({
                url : imageUrl,
                destRect : {
                    x : offsetLeft,
                    y : offsetTop,
                    w : el.clientWidth,
                    h : el.clientHeight
                },
				maskImage : maskImage,
                transforms : transforms
            });
        } else {
            var bgX = 0;
            var bgY = 0;
            var bgpos = CSSResolver.resolve(el, 'background-position');
            if (bgpos && (m = bgpos.match(regexCache.pair))) {
                bgX = -(this._parseCSSValue(m[1]));
                bgY = -(this._parseCSSValue(m[2]));
                bgX = (bgX % image.width + image.width) % image.width; 
                bgY = (bgY % image.height + image.height) % image.height; 
            } 
			var scaleWidth  = 1.0;
			var scaleHeight = 1.0;
			var bgsize = CSSResolver.resolve(el, 'background-size');
			if (bgsize && (m = bgsize.match(regexCache.pair))) {
				var sw = this._parseCSSValue(m[1]);
				var sh = this._parseCSSValue(m[2]);
				scaleWidth  = sw / image.width;
				scaleHeight = sh / image.height;
			}

            var bgrepeat = CSSResolver.resolve(el, 'background-repeat');
            var cols = 1, rows = 1;
            var sum;
            if (bgrepeat === 'repeat' || bgrepeat === 'repeat-x') {
                cols = 1 + Math.max(0, Math.ceil((el.clientWidth - (image.width - bgX)) / image.width));
            }
            if (bgrepeat === 'repeat' || bgrepeat === 'repeat-y') {
                rows = 1 + Math.max(0, Math.ceil((el.clientHeight - (image.height - bgY)) / image.height));
            }

            for (var i = 0; i < rows; i++) {
                for (var j = 0; j < cols; j++) {
                    var srcX = 0;
                    var srcY = 0;
                    var srcWidth = image.width;
                    var srcHeight = image.height;
                    var destX = - bgX + image.width  * j;
                    var destY = - bgY + image.height * i;
                    if (destX + image.width > el.clientWidth) {
                        srcWidth -= (destX + image.width - el.clientWidth);
                    }
                    if (destX < 0) {
                        srcX -= destX;
                        srcWidth += destX;
                        destX = 0;
                    }
                    if (destY + image.height > el.clientHeight) {
                        srcHeight -= (destY + image.height - el.clientHeight);
                    }
                    if (destY < 0) {
                        srcY -= destY;
                        srcHeight += destY;
                        destY = 0;
                    }
                    this.renderer.drawImage({
                        url : imageUrl,
                        srcRect : {
                            x : srcX / scaleWidth, 
                            y : srcY / scaleHeight, 
                            w : srcWidth / scaleWidth,
                            h : srcHeight / scaleHeight
                        },
                        destRect : {
                            x : offsetLeft + destX,
                            y : offsetTop + destY,
                            w : srcWidth,
                            h : srcHeight
                        },
						maskImage : maskImage,
                        transforms : transforms
                    });
                }
            }

        }


    }
};
DomFreezer.prototype.draw = function(el) {
    el = el || this.element;

    this.drawElementBackgroundColor(el);
    this.drawElementGradient(el);
    this.drawElementImage(el);
    this.drawElementBorder(el);

	if (el.childNodes.length === 1 && el.childNodes[0].nodeType === 3) {
		this.drawElementText(el);
	}

    for (var i = 0; i < el.children.length; i++) {
        this.draw(el.children[i]);
    }
};
// TODO: store old styles
DomFreezer.prototype.eraseElementBackground = function(el) {
    el.style.setProperty('background-color', 'transparent');
};

function toDataURLSupported() {
//return true;
    return false; // TODO
}

DomFreezer.prototype.eraseElementGradientAndImage = function(el) {

    if (el !== this.element || ! toDataURLSupported()) {
        el.style.setProperty('background-image', 'none');
        if (el.tagName === 'IMG') {
            el.src = DomFreezer.DUMMY_IMAGE;
        }
    }
};
DomFreezer.prototype.eraseElementBorder = function(el) {
    var sides = ['left', 'top', 'right', 'bottom'];
    for (var i = 0; i < sides.length; i++) {
        el.style.setProperty('border-' + sides[i] + '-width', '0');
    }
};
DomFreezer.prototype.eraseElementText = function(el) {
	el = el || this.element;
	el.innerText = '';
};
DomFreezer.prototype.erase = function(el) {
    el = el || this.element;

    this.eraseElementBackground(el);
    this.eraseElementGradientAndImage(el);
    this.eraseElementBorder(el);

	if (el.childNodes.length === 1 && el.childNodes[0].nodeType === 3) {
		this.eraseElementText(el);
	}

    for (var i = 0; i < el.children.length; i++) {
        this.erase(el.children[i]);
    }
};

DomFreezer.prototype.place = function() {
    var parentNode = this.element.parentNode;

    if (toDataURLSupported()) {
        this.element.style.setProperty('background-image', 'url(' + this.canvas.toDataURL() + ')');
    } else {
        this.canvas.style.setProperty('position', 'absolute');
        this.canvas.style.setProperty('left', (- this.renderer.origin.x) + 'px');
        this.canvas.style.setProperty('top',  (- this.renderer.origin.y) + 'px');
        this.canvas.style.setProperty('z-index', '-10000'); // TODO: replace magic number

        this.element.insertBefore(this.canvas, this.element.firstChild);
    }
/*
    if (parentNode.firstChild !== this.canvas) {
        parentNode.insertBefore(this.canvas, parentNode.firstChild);
    }
*/
    // document.body.appendChild(this.canvas);
};
DomFreezer.prototype.freeze = function() {
    // this.element.style.setProperty('visibility', 'hidden');
    this.erase(this.element);
    this.canvas.style.setProperty('display', 'block');
};
DomFreezer.prototype.unfreeze = function() {
    // this.element.style.setProperty('visibility', 'visible');
    this.canvas.style.setProperty('display', 'none');
    throw new Error('not implemented yet');
};

})();
