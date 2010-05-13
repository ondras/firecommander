var Viewer = function(path, fc) {
	this._path = path;
	this._ec = [];
	this._win = null;
}

Viewer.prototype._open = function(name) {
	this._win = window.open("viewer/viewer-"+name+".xul", "", "chrome,centerscreen");
	this._ec.push(Events.add(this._win, "load", this._load.bind(this)));
	this._ec.push(Events.add(this._win, "keydown", this._keyDown.bind(this)));
}

Viewer.prototype._load = function() {
	this._ec.push(Events.add(this._win, "unload", this._close.bind(this)));
	this._win.document.title = this._path.getPath();
}

Viewer.prototype._keyDown = function(e) {
	if (e.keyCode == 27) { this._win.close(); }
}

Viewer.prototype._close = function() {
	this._ec.forEach(Events.remove, Events);
}
