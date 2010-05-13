Viewer.Audio = function(path, fc) {
	Viewer.call(this, path, fc);
	this._open("audio");
}

Viewer.Audio.prototype = Object.create(Viewer.prototype);

Viewer.Audio.prototype._load = function(e) {
	Viewer.prototype._load.call(this, e);

	var a = this._win.document.getElementById("audio");
	a.src = "file://" + this._path.getPath();
	this._win.sizeToContent();
}

FC.addViewerHandler("wav", Viewer.Audio);
FC.addViewerHandler("ogg", Viewer.Audio);
