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

/* @returns {null || Path[]} */

Path.prototype.getItems = function() {
	return null;
}

Path.prototype.getParent = function() {
	return null;
}

Path.prototype.exists = function() {
	return false;
}

Path.prototype.isSpecial = function() { /* certain common actions cannot be performed on these: delete, copy, view... */
	return true;
}

Path.prototype.equals = function(path) {
	return false;
}

/* interactivity */

Path.prototype.activate = function(panel) { 
}

Path.prototype.delete = function(panel, fc) {
}

Path.prototype.append = function(name) {
}

Path.prototype.create = function(directory) {
}

Path.prototype.rename = function(name) {
}

/***/

Path.Up = function(path) {
	this._path = path;
}

Path.Up.prototype = Object.create(Path.prototype);

Path.Up.prototype.getPath = function() {
	return this._path.getPath();
}

Path.Up.prototype.getImage = function() {
	return "chrome://firecommander/skin/up.png";
}

Path.Up.prototype.getSort = function() {
	return 0;
}

Path.Up.prototype.activate = function(panel) { 
	panel.setPath(this._path);
}
