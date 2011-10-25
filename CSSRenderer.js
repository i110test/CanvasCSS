var CSSRenderer;

(function() {

function applyDefault(obj, def) {
    var k;
    for (k in def) {
        if (def.hasOwnProperty(k)) {
            obj[k] = obj[k] || def[k];
        }
    }
}
CSSRenderer = function(canvas, origin, scale) {
    this.canvas = canvas;
    this.context = this.canvas.getContext('2d');
    this.origin = origin;
	this.scale = scale;
    this.size = {
        width  : this.canvas.width  - this.origin.x,
        height : this.canvas.height - this.origin.y
    };
};

CSSRenderer.prototype._draw = function(drawFunc, transforms) {
    this.context.save();

    this.context.translate(this.origin.x, this.origin.y);

    if (transforms) {
        for (var i = 0; i < transforms.length; i++) {
            var m = transforms[i];
            this.context.transform(m[0], m[1], m[2], m[3], m[4] * this.scale, m[5] * this.scale);
        }
    }

    drawFunc.call(this);

    this.context.restore();
};
//TODO: drawBackground?
CSSRenderer.prototype.fillRect = function fillRect(args) {
    var x = args.x || 0,
        y = args.y || 0,
        w = args.w || this.size.width,
        h = args.h || this.size.height,
        style = args.style,
        transforms = args.transforms;

    this._draw(function() {
        this.context.fillStyle = style;
        this.context.fillRect(x * this.scale, y * this.scale, w * this.scale, h * this.scale);
    }, transforms);
    
};

CSSRenderer.prototype.drawText = function drawText(args) {
	var text = args.text,
		x = args.x,
		y = args.y,
		font = args.font,
		style = args.style,
		maxWidth = args.maxWidth || undefined,
		transforms = args.transforms;

    this._draw(function() {
		this.context.font = font;
        this.context.fillStyle = style;
		this.context.textBaseline = 'top';	//TODO
		this.context.fillText(text, x * this.scale, y * this.scale, maxWidth * this.scale);
    }, transforms);
	
}
CSSRenderer.prototype.drawBorderLine = function drawLine(args) {
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
        this.context.lineWidth = width * this.scale;
// TODO: diffX and diffY should be here?
        this.context.beginPath();
        this.context.moveTo((x1 + diffX1) * this.scale, (y1 + diffY1) * this.scale);
        this.context.lineTo((x2 + diffX2) * this.scale, (y2 + diffY2) * this.scale);
        this.context.stroke();
    }, transforms);
};
CSSRenderer.prototype.drawImage = function drawImage(args) {
    var url = args.url,
        img = new Image(),
        sr, dr,
		maskImage = args.maskImage,
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
		if (maskImage) {
			var buffer = document.createElement('canvas');
			buffer.width = dr.w * this.scale;
			buffer.height = dr.h * this.scale;
			var bufferContext = buffer.getContext('2d');
			bufferContext.drawImage(
				img,
        	    sr.x, sr.y, sr.w, sr.h, 
        	    0, 0, dr.w * this.scale, dr.h * this.scale
			);	
			bufferContext.globalCompositeOperation = 'destination-in';
			bufferContext.drawImage(maskImage, 0, 0, maskImage.width * this.scale, maskImage.height * this.scale);
		
			this.context.drawImage(buffer, dr.x * this.scale, dr.y * this.scale);	
			
		} else {
        	this.context.drawImage(
        	    img, 
        	    sr.x, sr.y, sr.w, sr.h, 
        	    dr.x * this.scale, dr.y * this.scale, dr.w * this.scale, dr.h * this.scale
        	);
		}
    }, transforms);
};
CSSRenderer.prototype.drawLinearGradient = function drawLinearGradient(args) {
    var region  = args.region || { x : 0, y : 0, width : this.size.width, height : this.size.height },
        start = args.start || { x : 0, y : 0 },
        end   = args.end   || { x : 0, y : this.size.height },
        colorStops = args.colorStops,
        transforms = args.transforms;

    grad = this.context.createLinearGradient(
        start.x * this.scale, start.y * this.scale, end.x * this.scale, end.y * this.scale);

    colorStops.forEach(function(colorStop) {
        grad.addColorStop(colorStop.pos, colorStop.color);
    });

    this._draw(function() {
        this.context.fillStyle = grad;
        this.context.fillRect(region.x * this.scale, region.y * this.scale, region.width * this.scale, region.height * this.scale);
    }, transforms);
};

})();
