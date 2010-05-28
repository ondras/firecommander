Viewer.Image = function(path, fc) {
	Viewer.call(this, path, fc);
	this._open("image");
	this._width = null;
	this._height = null;
	this._image = null;
	this._container = null;
}

Viewer.Image.prototype = Object.create(Viewer.prototype);

Viewer.Image.prototype._load = function(e) {
	Viewer.prototype._load.call(this, e);

	this._container = this._win.document.getElementById("container");
	this._image = this._win.document.getElementById("image");
	this._ec.push(Events.add(this._image, "load", this._loadImage.bind(this)));
	this._image.src = "file://" + this._path.getPath();
}

Viewer.Image.prototype._loadImage = function(e) {
	this._width = e.target.naturalWidth;
	this._height = e.target.naturalHeight;

	this._sync();
	this._ec.push(Events.add(this._win, "resize", this._sync.bind(this)));
}


Viewer.Image.prototype._sync = function() {
	var box = this._container;
	var bw = box.clientWidth;
	var bh = box.clientHeight;
	
	var w = this._width;
	var h = this._height;
	var rw = w/bw;
	var rh = h/bh;
	var max = Math.max(rw, rh);
	if (max > 1) { 
		w = Math.round(w/max);
		h = Math.round(h/max);
	}

	var left = (bw-w)/2;
	var top = (bh-h)/2;
	this._image.style.width = w+"px";
	this._image.style.height = h+"px";
	this._image.style.left = Math.round(left)+"px";
	this._image.style.top = Math.round(top)+"px";
	
	
	/* hack to force redraw */
	this._image.parentNode.flex = 0;
	this._image.parentNode.flex = 1;
}

FC.addViewerHandler("jpg", Viewer.Image);
FC.addViewerHandler("jpeg", Viewer.Image);
FC.addViewerHandler("gif", Viewer.Image);
FC.addViewerHandler("png", Viewer.Image);
FC.addViewerHandler("bmp", Viewer.Image);
FC.addViewerHandler("ico", Viewer.Image);
