Path.Drives = function() {
	Path.call(this);
	
	this._columns[Panel.SIZE] = false;
	this._columns[Panel.TS] = false;
	this._columns[Panel.ATTR] = false;
	
	this._file = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsILocalFile);
	this._file.initWithPath("\\\\.");
}

Path.Drives.prototype = Object.create(Path.prototype);

Path.Drives.fromString = function(path) {
	return new this();
}

Path.Drives.prototype.getPath = function() {
	return "drives://";
}

Path.Drives.prototype.getName = function() {
	return $("cmd_drives").getAttribute("label");
}

Path.Drives.prototype.getItems = function() {
	var result = [];
	var entries = this._file.directoryEntries;
	
	while (entries.hasMoreElements()) {
		var item = entries.getNext().QueryInterface(Ci.nsILocalFile);
		result.push(new Path.Drives.Drive(item));
	}
	return result;
}

Path.Drives.prototype.supports = function(feature) {
	if (feature == FC.CHILDREN) { return true; }
	return false;
}

Path.Drives.prototype.exists = function() {
	return true;
}

FC.addProtocolHandler("drives", Path.Drives.fromString.bind(Path.Drives));

/***/

Path.Drives.Drive = function(file) {
	Path.call(this);
	this._file = file;
}

Path.Drives.Drive.prototype = Object.create(Path.prototype);

Path.Drives.Drive.prototype.getImage = function() {
	var ios = Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService);
	var fileURI = ios.newFileURI(this._file);
	return "moz-icon://" + fileURI.spec;
}

Path.Drives.Drive.prototype.activate = function(panel, fc) { 
	panel.setPath(new Path.Local(this._file));
}

Path.Drives.Drive.prototype.getPath = function() {
	return this._file.path;
}

Path.Drives.Drive.prototype.getName = function() {
	return this._file.leafName;
}
