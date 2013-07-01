var Viewer = function(path, fc) {
	this._originalPath = path;
	this._realPath = null;
	this._fc = fc;
	this._ec = [];
	this._win = null;

	this._preparePath();
}

Viewer.prototype._preparePath = function() {
	if (this._originalPath instanceof Path.Local) { 
		this._ready(this._originalPath);
	} else {
		this._fc.copyToTemp(this._originalPath).then(this._ready.bind(this));
	}
}

Viewer.prototype._ready = function(realPath) {
	this._realPath = realPath;
}

Viewer.prototype._open = function(name) {
	this._win = window.open("viewer/viewer-"+name+".xul", "", "chrome,centerscreen,resizable=yes");
	this._win.addEventListener("keydown", this._keyDown.bind(this));

	Promise.event(this._win, "load").then(this._load.bind(this));
}

Viewer.prototype._close = function() {
	if (this._realPath != this._originalPath) { this._realPath.delete(); }
}

Viewer.prototype._load = function(e) {
	this._win.document.title = this._realPath.getPath();

	/* must be attached AFTER load; will fire on an empty HTMLDocument otherwise */ 
	Promise.event(this._win, "unload").then(this._close.bind(this));
}

Viewer.prototype._keyDown = function(e) {
	if (e.keyCode == 27) { this._win.close(); } 
}
