var Path = function(path) {
	this._path = path;
}

/* display bits */

Path.prototype.getPath = function() {
	return "";
}

Path.prototype.getImage = function() {
	return "";
}

Path.prototype.getName = function() {
	return "";
}

Path.prototype.getSize = function() {
	return "";
}

Path.prototype.getTS = function() {
	return "";
}

Path.prototype.getSort = function() {
	return 1;
}

Path.prototype.getPermissions = function() {
}

/* traversal */

Path.prototype.getItems = function() {
	return [];
}

Path.prototype.getParent = function() {
	return null;
}

/* certain common actions cannot be performed on these: delete, copy, view... */
Path.prototype.isSpecial = function() {
	return true;
}

/* interactivity */

Path.prototype.activate = function(panel) { 
}

Path.prototype.delete = function(panel, fc) {
}

