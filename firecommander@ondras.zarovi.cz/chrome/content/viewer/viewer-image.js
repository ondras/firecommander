Viewer.Image = function(path, fc) {
	Viewer.call(this, path, fc);
	this._open("image");
}

Viewer.Image.prototype = Object.create(Viewer.prototype);

Viewer.Image.prototype._load = function(e) {
	Viewer.prototype._load.call(this, e);

	var img = this._win.document.getElementById("image");
	this._ec.push(Events.add(img, "load", this._loadImage.bind(this)));
	img.src = "file://" + this._path.getPath();
}

Viewer.Image.prototype._loadImage = function(e) {
	this._sync();
	this._ec.push(Events.add(this._win, "resize", this._sync.bind(this)));
}


Viewer.Image.prototype._sync = function() {
	var img = this._win.document.getElementById("image");
//	var box = this._win.document.getElementById("container");

	var w = img.naturalWidth;
	var h = img.naturalHeight;
	
	var bw = this._win.innerWidth;
	var bh = this._win.innerHeight;
	
	var rw = w/bw;
	var rh = h/bh;
	var max = Math.max(rw, rh);
	if (max > 1) { 
		w = Math.round(w/max);
		h = Math.round(h/max);
	}

	img.style.width = w + "px";
	img.style.height = h + "px";
}

FC.addViewerHandler("jpg", Viewer.Image);
FC.addViewerHandler("jpeg", Viewer.Image);
FC.addViewerHandler("gif", Viewer.Image);
FC.addViewerHandler("png", Viewer.Image);
FC.addViewerHandler("bmp", Viewer.Image);
FC.addViewerHandler("ico", Viewer.Image);
