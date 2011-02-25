var Path = function() {
	this._columns = {};
	this._columns[Panel.NAME] = true;
	this._columns[Panel.DATA] = false;
	this._columns[Panel.SIZE] = true;
	this._columns[Panel.TS] = true;
	this._columns[Panel.ATTR] = true;
}

/* display bits */

/**
 * Used in:
 *  - labels (progress dialogs, issue dialogs)
 *  - symlink copy operation
 *  - panel header, when path's contents are displayed
 *  - as (unique) index for caching computed sizes
 *  - cloning existing tabs
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
 * Used in:
 *  - first column
 *  - panel tab label
 *  - building copy/move operation targets
 *  - metadata search
 * @returns {string} short textual label (file/dir name)
 */
Path.prototype.getName = function() {
	return "";
}

/**
 * Used in DATA column, only when parent enables it
 */
Path.prototype.getData = function() {
	return  "";
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

/**
 * Relevant only if supports(FC.CHILDREN)
 * @returns {object} definition of visible columns
 */
Path.prototype.getColumns = function() {
	return this._columns;
}

/* traversal */

/**
 * Makes sense only if supports(FC.CHILDREN)
 * @returns {Path[]} child items
 */
Path.prototype.getItems = function() {
	return [];
}

/**
 * Used in:
 *  - searching for valid parent when this path disappeared
 *  - climbind up/top
 *  - looking for sqlite/zip parent
 *  - looking for console parent
 * @returns {null || Path} parent path, null where not applicable
 */
Path.prototype.getParent = function() {
	return null;
}

/**
 * Used in:
 *  - various checks in copy/move operations
 *  - panel consistency checks
 * @returns {bool} does this path exist?
 */
Path.prototype.exists = function() {
	return true;
}

/**
 * @param {number} feature FC.* constant
 * @returns {bool} does this path support given feature?
 */
Path.prototype.supports = function(feature) {
	return false;
}

/**
 * Used in:
 *  - panel sync changes
 *  - maintaining focus
 *  - checks
 * @returns {bool} is this path equal to other? getPath() comparison might not be sufficient.
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

/**
 * These need special treatment :/
 */
Path.prototype.isSymlink = function() {
	return false;
}

/**
 * Path may reference its current panel, which means that some paths 
 * cannot be shared across multiple panels. This clones the path properly.
 * Used in:
 *  - opening this path in new panel
 */
Path.prototype.clone = function() {
	return this;
}

/* interactivity */

/**
 * Activate a path (doubleclick, enter, context menu)
 */
Path.prototype.activate = function(panel, fc) {
	if (this.supports(FC.CHILDREN)) { panel.setPath(this); }
}

/**
 * Delete a path
 */
Path.prototype.delete = function() {
}

/**
 * Create new child by appending a name
 * Used in:
 *  - copy/move operations
 *  - pack/create operations
 *  - quick rename operation
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
 * "Go up" fake path
 */
Path.Up = function() {
	Path.call(this);
}

Path.Up.prototype = Object.create(Path.prototype);

Path.Up.prototype.getImage = function() {
	return "chrome://firecommander/skin/up.png";
}

Path.Up.prototype.getSort = function() {
	return 0;
}

Path.Up.prototype.activate = function(panel, fc) { 
	fc.cmdUp();
}

