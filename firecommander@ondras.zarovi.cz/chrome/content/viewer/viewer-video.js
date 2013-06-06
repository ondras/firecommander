Viewer.Video = function(path, fc) {
	Viewer.call(this, path, fc);
}

Viewer.Video.prototype = Object.create(Viewer.prototype);

Viewer.Video.prototype.handleEvent = function(e) {
	Viewer.prototype.handleEvent.call(this, e);

	switch (e.type) {
		case "play":
			this._win.sizeToContent();
			this._win.screenX -= Math.round((this._win.outerWidth-300) / 2);
			this._win.screenY -= Math.round(this._win.outerHeight / 2);
		break;
	}
}

Viewer.Video.prototype._ready = function(realPath) {
	Viewer.prototype._ready.call(this, realPath);
	this._open("video");
}

Viewer.Video.prototype._load = function(e) {
	Viewer.prototype._load.call(this, e);

	var v = this._win.document.querySelector("#video");
	v.addEventListener("play", this);
	v.src = "file://" + this._realPath.getPath();
}

FC.addViewerHandler("ogv", Viewer.Video);
