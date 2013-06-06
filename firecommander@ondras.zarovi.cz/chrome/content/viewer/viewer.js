var Viewer = function(path, fc) {
	this._originalPath = path;
	this._realPath = null;
	this._fc = fc;
	this._ec = [];
	this._win = null;

	this._preparePath();
}

Viewer.prototype.handleEvent = function(e) {
	switch (e.type) {
		case "load": 
			this._load();
		break;
		case "unload": this._close(); break;
		case "keydown": if (e.keyCode == 27) { this._win.close(); } break;
	}
}

Viewer.prototype._preparePath = function() {
	if (this._originalPath instanceof Path.Local) { 
		this._ready(this._originalPath);
	} else {
		this._fc.copyToTemp(this._originalPath, this._ready.bind(this));
	}
}

Viewer.prototype._ready = function(realPath) {
	this._realPath = realPath;
}

Viewer.prototype._open = function(name) {
	this._win = window.open("viewer/viewer-"+name+".xul", "", "chrome,centerscreen,resizable=yes");
	this._win.addEventListener("load", this);
	this._win.addEventListener("unload", this);
	this._win.addEventListener("keydown", this);
}

Viewer.prototype._close = function() {
	if (this._realPath != this._originalPath) { this._realPath.delete(); }
}

Viewer.prototype._load = function(e) {
	this._win.document.title = this._realPath.getPath();
}