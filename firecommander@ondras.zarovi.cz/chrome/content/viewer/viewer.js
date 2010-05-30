var Viewer = function(path, fc) {
	this._originalPath = path;
	this._realPath = null;
	this._fc = fc;
	this._ec = [];
	this._win = null;
	
	if (path instanceof Path.Local) { 
		this._ready(path);
	} else {
		this._fc.copyToTemp(path, this._ready.bind(this));
	}
}

Viewer.prototype._ready = function(realPath) {
	this._realPath = realPath;
}

Viewer.prototype._open = function(name) {
	this._win = window.open("viewer/viewer-"+name+".xul", "", "chrome,centerscreen,resizable=yes");
	this._ec.push(Events.add(this._win, "load", this._load.bind(this)));
	this._ec.push(Events.add(this._win, "keydown", this._keyDown.bind(this)));
}

Viewer.prototype._load = function() {
	this._ec.push(Events.add(this._win, "unload", this._close.bind(this)));
	this._win.document.title = this._realPath.getPath();
}

Viewer.prototype._keyDown = function(e) {
	if (e.keyCode == 27) { this._win.close(); }
}

Viewer.prototype._close = function() {
	this._ec.forEach(Events.remove, Events);
	if (this._realPath != this._originalPath) { this._realPath.delete(); }
}
