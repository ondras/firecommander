Path.Local = function(file) {
	this._file = file;
	this._parent = false;
}

Path.Local.prototype = Object.create(Path.prototype);

Path.Local.fromString = function(path) {
	var file = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsILocalFile);
	file.initWithPath(path);
	return new this(file);
}

Path.Local.fromShortcut = function(shortcut) {
	var ds = Cc["@mozilla.org/file/directory_service;1"].getService(Ci.nsIProperties);
	var path = ds.get(shortcut, Components.interfaces.nsILocalFile);
	return new this(path);
}

Path.Local.prototype.beParent = function() {
	this._parent = true;
	return this;
}

Path.Local.prototype.getImage = function() {
	if (this._parent) {
		return "chrome://firecommander/skin/up.png";
	} else if (this._file.isDirectory()) {
		return "chrome://firecommander/skin/folder.png";
	} else {
		var ios = Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService);
		var fileURI = ios.newFileURI(this._file);
		return "moz-icon://" + fileURI.spec;
	}
}

Path.Local.prototype.getPath = function() {
	return this._file.path;
}

Path.Local.prototype.getName = function() {
	if (this._parent) {
		return "";
	} else {
		return this._file.leafName;
	}
}

Path.Local.prototype.getSize = function() {
	return (this._file.isDirectory() ? null : this._file.fileSize);
}

Path.Local.prototype.getTS = function() {
	return this._file.lastModifiedTime;
}

Path.Local.prototype.getSort = function() {
	if (this._parent) { 
		return 0;
	} else if (this._file.isDirectory()) {
		return 1;
	} else {
		return 2;
	}
}

Path.Local.prototype.getItems = function() {
	var result = [];
	
	var parent = this.getParent();

	if (parent) {
		parent.beParent();
		result.push(parent);
	}
	
	var entries = this._file.directoryEntries;
	
	while (entries.hasMoreElements()) {
		var item = entries.getNext().QueryInterface(Ci.nsILocalFile);
		result.push(new Path.Local(item));
	}

	return result;
}

Path.Local.prototype.activate = function(panel) { 
	if (this._file.isDirectory()) {
		panel.setPath(new Path.Local(this._file));
	} else {
		this._file.launch()
	}
}

Path.Local.prototype.getParent = function() {
	if (this._file.parent) {
		return new Path.Local(this._file.parent);
	} else {
		return null;
	}
}
