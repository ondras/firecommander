Viewer.Audio = function(path, fc) {
	Viewer.call(this, path, fc);
}

Viewer.Audio.prototype = Object.create(Viewer.prototype);

Viewer.Audio.prototype._ready = function(realPath) {
	Viewer.prototype._ready.call(this, realPath);
	this._open("audio");
}

Viewer.Audio.prototype._load = function(e) {
	Viewer.prototype._load.call(this, e);

	var a = this._win.document.getElementById("audio");
	a.src = "file://" + this._realPath.getPath();
	this._win.sizeToContent();
}

FC.addViewerHandler("wav", Viewer.Audio);
FC.addViewerHandler("ogg", Viewer.Audio);
