var CanvasDrawer;

(function() {

function applyDefault(obj, def) {
    var k;
    for (k in def) {
        if (def.hasOwnProperty(k)) {
            obj[k] = obj[k] || def[k];
        }
    }
}
CanvasDrawer = function(canvas, origin) {
    this.canvas = canvas;
    this.context = this.canvas.getContext('2d');
    this.origin = origin;
    this.size = {
        width  : this.canvas.width  - this.origin.x,
        height : this.canvas.height - this.origin.y
    };
};
CanvasDrawer.prototype._startDraw = function(transforms) {
};
CanvasDrawer.prototype.tear_endDraw = function() {
};

CanvasDrawer.prototype._draw = function(drawFunc, transforms) {
    this.context.save();

    if (transforms) {
        for (var i = 0; i < transforms.length; i++) {
            var m = transforms[i];
            this.context.transform(m[0], m[1], m[2], m[3], m[4], m[5]);
        }
    }

    drawFunc.call(this);

    this.context.restore();
};
CanvasDrawer.prototype.fillRect = function fillRect(args) {
    var x = args.x || 0,
        y = args.y || 0,
        w = args.w || this.size.width,
        h = args.h || this.size.height,
        style = args.style,
        transforms = args.transforms;

    this._draw(function() {
        this.context.fillStyle = style;
        this.context.fillRect(this.origin.x + x, this.origin.y + y, w, h);
    }, transforms);
    
};
CanvasDrawer.prototype.drawBorderLine = function drawLine(args) {
    var x1 = args.x1,
        y1 = args.y1,
        x2 = args.x2,
        y2 = args.y2,
        side = args.side,
        width = args.width || 1,
        style = args.style || 'rgb(0, 0, 0)',
        transforms = args.transforms;

    if (x1 !== x2 && y1 !== y2) {
        throw new Error('border line must be horizontal or vertical');
    }
    if (['left', 'top', 'right', 'bottom'].indexOf(side) < 0) {
        throw new Error('invalid side');
    }

    var diffX1, diffY1, diffX2, diffY2;
    var d = width / 2, 
        m = (width % 2 === 0) ? 0 : 0.5;
    if (side === 'left' || side === 'right') {
        diffX1 = 
        diffX2 = (side === 'left') ? d : -d;
        diffY1 = (y1 < y2) ?  m : -m;
        diffY2 = (y1 < y2) ? -m :  m;
    } else {
        diffX1 = (x1 < x2) ?  m : -m;
        diffX2 = (x1 < x2) ? -m :  m;
        diffY1 = 
        diffY2 = (side === 'top') ? d : -d;
    }

    this._draw(function() {
        this.context.strokeStyle = style;
        this.context.lineWidth = width;

        this.context.beginPath();
        this.context.moveTo(this.origin.x + x1 + diffX1, this.origin.y + y1 + diffY1);
        this.context.lineTo(this.origin.x + x2 + diffX2, this.origin.y + y2 + diffY2);
        this.context.stroke();
    }, transforms);
};
CanvasDrawer.prototype.drawImage = function drawImage(args) {
    var url = args.url,
        img = new Image(),
        sr, dr,
        transforms;
    img.src = url;

    var srDefault = { x : 0, y : 0, w : img.width, h : img.height };
    sr = args.srcRect || srDefault;
    applyDefault(sr, srDefault);

    var drDefault = { x : 0, y : 0, w : sr.w,  h : sr.h };
    dr = args.destRect || drDefault;
    applyDefault(dr, drDefault);

    transforms = args.transforms;

    this._draw(function() {
        this.context.drawImage(
            img, 
            sr.x, sr.y, sr.w, sr.h, 
            this.origin.x + dr.x, this.origin.y + dr.y, dr.w, dr.h
        );
    }, transforms);
};
CanvasDrawer.prototype.drawLinearGradient = function drawLinearGradient(args) {
    var region  = args.region || { x1 : 0, y1 : 0, x2 : this.size.width, y2 : this.size.height },
        start = args.start || { x : 0, y : 0 },
        end   = args.end   || { x : 0, y : this.size.height },
        colorStops = args.colorStops,
        transforms = args.transforms;

    grad = this.context.createLinearGradient(
        this.origin.x + start.x, this.origin.y + start.y, this.origin.x + end.x, this.origin.y + end.y);

    colorStops.forEach(function(colorStop) {
        grad.addColorStop(colorStop.pos, colorStop.color);
    });

    this._draw(function() {
        this.context.fillStyle = grad;
        this.context.fillRect(this.origin.x + region.x1, this.origin.y + region.y1, this.origin.x + region.x2, this.origin.y + region.y2);
    }, transforms);
};

})();
