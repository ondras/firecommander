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
	return null;
}

Path.prototype.getTS = function() {
	return null;
}

Path.prototype.getSort = function() {
	return 1;
}

Path.prototype.getPermissions = function() {
	return null;
}

/* traversal */

Path.prototype.getItems = function() {
	return [];
}

Path.prototype.getParent = function() {
	return null;
}

/* can this path act as a panel path? */
Path.prototype.exists = function() {
	return false;
}

Path.prototype.isSpecial = function() { /* certain common actions cannot be performed on these: delete, copy, view... */
	return true;
}

/* interactivity */

Path.prototype.activate = function(panel) { 
}

Path.prototype.delete = function(panel, fc) {
}

