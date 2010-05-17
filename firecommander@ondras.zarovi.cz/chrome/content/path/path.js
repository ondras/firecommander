var Path = function() {
}

/* display bits */

/**
 * @returns {string} uniqe path identifier
 */
Path.prototype.getPath = function() {
	return "";
}

/**
 * @returns {string} image url
 */
Path.prototype.getImage = function() {
	return "";
}

/**
 * @returns {string} short textual label (file/dir name)
 */
Path.prototype.getName = function() {
	return "";
}

/**
 * @returns {string} long textual label (statusbar)
 */
Path.prototype.getDescription = function() {
	return this.getPath();
}

/**
 * @returns {null || number} size in bytes, null where not applicable
 */
Path.prototype.getSize = function() {
	return null;
}

/**
 * @returns {null || number} timestamp in msec, null where not applicable
 */
Path.prototype.getTS = function() {
	return null;
}

/**
 * @returns {number} preferred sort order: 0 = top, 1 = middle, 2 = bottom
 */
Path.prototype.getSort = function() {
	return 1;
}

/**
 * @returns {null || number} permissions, null where not applicable
 */
Path.prototype.getPermissions = function() {
	return null;
}

/* traversal */

/**
 * @returns {Path[]} child items
 */
Path.prototype.getItems = function() {
	return [];
}

/**
 * @returns {null || Path} parent path, null where not applicable
 */
Path.prototype.getParent = function() {
	return null;
}

/**
 * @returns {bool} does this path exist?
 */
Path.prototype.exists = function() {
	return false;
}

/**
 * @param {number} feature FC.* constant
 * @returns {bool} does this path support given feature?
 */
Path.prototype.supports = function(feature) {
	return false;
}

/**
 * @returns {bool} is this path equal to other?
 */
Path.prototype.equals = function(path) {
	return (path.getPath() == this.getPath());
}

/**
 * Panel starts using this
 */
Path.prototype.attach = function(panel) {
}

/**
 * Panel stops using this
 */
Path.prototype.detach = function(panel) {
}

/* interactivity */

/**
 * Activate a path (doubleclick, enter, ...)
 */
Path.prototype.activate = function(panel) { 
}

/**
 * Delete a path
 */
Path.prototype.delete = function() {
}

/**
 * Create new child by appending a name
 * @returns {Path} newly created child
 */
Path.prototype.append = function(name) {
	return this;
}

/**
 * Create this path
 * @param {bool} directory Is it a directory?
 */
Path.prototype.create = function(directory) {
}

/**
 * Rename this to new leaf name
 * @param {string} name new name
 */
Path.prototype.rename = function(name) {
}

/**
 * @returns {nsIInputStream} open this path as input stream
 */
Path.prototype.inputStream = function() {
}

/**
 * @returns {nsIOutputStream} open this path as output stream
 */
Path.prototype.outputStream = function() {
}

/***/

/**
 * "Go up" metapath
 */
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
	this._path.activate(panel);
}

