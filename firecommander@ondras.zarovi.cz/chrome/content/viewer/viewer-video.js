Viewer.Video = function(path, fc) {
	Viewer.call(this, path, fc);
	this._open("video");
}

Viewer.Video.prototype = Object.create(Viewer.prototype);

Viewer.Video.prototype._load = function(e) {
	Viewer.prototype._load.call(this, e);

	var v = this._win.document.getElementById("video");
	this._ec.push(Events.add(v, "play", this._ready.bind(this)));
	v.src = "file://" + this._path.getPath();
}

Viewer.Video.prototype._ready = function(e) {
	this._win.sizeToContent();
	this._win.screenX -= Math.round((this._win.outerWidth-300) / 2);
	this._win.screenY -= Math.round(this._win.outerHeight / 2);
}

FC.addViewerHandler("ogv", Viewer.Video);
