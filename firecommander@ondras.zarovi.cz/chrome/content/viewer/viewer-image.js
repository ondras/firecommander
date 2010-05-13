Viewer.Image = function(path, fc) {
	this._path = path;
	this._ec = [];
	this._win = window.open("viewer/viewer-image.xul", "", "chrome,centerscreen");
	this._ec.push(Events.add(this._win, "load", this._loadWindow.bind(this)));
	this._ec.push(Events.add(this._win, "keydown", this._keyDown.bind(this)));
}

Viewer.Image.prototype = Object.create(Viewer.prototype);

Viewer.Image.prototype._loadWindow = function(e) {
	this._ec.push(Events.add(this._win, "unload", this._close.bind(this)));
	
	var doc = this._win.document;
	doc.title = this._path.getPath();

	var img = doc.getElementById("image");
	this._ec.push(Events.add(img, "load", this._loadImage.bind(this)));
	img.src = "file://" + this._path.getPath();
}

Viewer.Image.prototype._loadImage = function(e) {
	this._sync();
	this._ec.push(Events.add(this._win, "resize", this._sync.bind(this)));
}

Viewer.Image.prototype._keyDown = function(e) {
	if (e.keyCode == 27) { this._win.close(); }
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

Viewer.Image.prototype._close = function() {
	this._ec.forEach(Events.remove, Events);
}

FC.addViewerHandler("jpg", Viewer.Image);
FC.addViewerHandler("jpeg", Viewer.Image);
FC.addViewerHandler("gif", Viewer.Image);
FC.addViewerHandler("png", Viewer.Image);
FC.addViewerHandler("bmp", Viewer.Image);
FC.addViewerHandler("ico", Viewer.Image);
