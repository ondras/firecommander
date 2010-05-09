Path.Local = function(file) {
	this._file = file;
}

Path.Local.prototype = Object.create(Path.prototype);

/**
 * @throws invalid path string
 */
Path.Local.fromString = function(path) {
	var os = Cc["@mozilla.org/xre/app-info;1"].getService(Ci.nsIXULRuntime).OS;
	if (os == "WINNT") { path = path.replace(/\//g,"\\"); }

	var file = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsILocalFile);
	file.initWithPath(path);
	return new this(file);
}

/**
 * @throws invalid path string
 */
Path.Local.fromShortcut = function(shortcut) {
	var ds = Cc["@mozilla.org/file/directory_service;1"].getService(Ci.nsIProperties);
	var path = ds.get(shortcut, Components.interfaces.nsILocalFile);
	return new this(path);
}

Path.Local.prototype.getFile = function() {
	return this._file;
}

Path.Local.prototype.supports = function(feature) {
	if (feature == FC.CHILDREN) { return this._file.isDirectory(); }

	switch (feature) {
		case FC.DELETE:
		case FC.RENAME:
		case FC.READ:
		case FC.EDIT:
			return true;
		break;
	}
	return false;
}

Path.Local.prototype.getImage = function() {
	if (this._file.isDirectory()) {
		if (this._file.isSymlink()) {
			return "chrome://firecommander/skin/folder-link.png";
		} else {
			return "chrome://firecommander/skin/folder.png";
		}
	} else {
		if (this._file.isSymlink()) {
			return "chrome://firecommander/skin/link.png";
		} else {
			var ios = Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService);
			var fileURI = ios.newFileURI(this._file);
			return "moz-icon://" + fileURI.spec;
		}
	}
}

Path.Local.prototype.getPath = function() {
	return this._file.path;
}

Path.Local.prototype.getName = function() {
	return this._file.leafName;
}

Path.Local.prototype.getSize = function() {
	return (this._file.isDirectory() ? null : this._file.fileSize);
}

Path.Local.prototype.getTS = function() {
	return this._file.lastModifiedTimeOfLink; /* FIXME */
}

Path.Local.prototype.getPermissions = function() {
	try {
		return this._file.permissions;
	} catch (e) {
		return null;
	}
}

Path.Local.prototype.getSort = function() {
	if (this._file.isDirectory()) {
		return 1;
	} else {
		return 2;
	}
}

Path.Local.prototype.getItems = function() {
	if (!this._file.isDirectory()) { return null; }

	var result = [];	
	var entries = this._file.directoryEntries;
	
	while (entries.hasMoreElements()) {
		var item = entries.getNext().QueryInterface(Ci.nsILocalFile);
		result.push(new Path.Local(item));
	}

	return result;
}

Path.Local.prototype.activate = function(panel) { 
	if (this._file.isDirectory()) {
		var target = this;
		if (this._file.isSymlink()) {
			target = Path.Local.fromString(this._file.target);
		}
		panel.setPath(target);
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

Path.Local.prototype.exists = function() {
	return this._file.exists();
}

Path.Local.prototype.equals = function(path) {
	if (!(path instanceof Path.Local)) { return; }
	return this._file.equals(path._file);
}

Path.Local.prototype.delete = function() {
	this._file.remove(false);
}

Path.Local.prototype.create = function(directory) {
	var type = (directory ? Ci.nsIFile.DIRECTORY_TYPE : Ci.nsIFile.FILE_TYPE);
	this._file.create(type, 0644 /* FIXME */);
}

Path.Local.prototype.append = function(name) {
	var f = this._file.clone();
	f.append(name);
	return new Path.Local(f);
}

Path.Local.prototype.rename = function(name) {
	this._file.moveTo(null, name);
}

Path.Local.prototype.inputStream = function() {
	var is = Cc["@mozilla.org/network/file-input-stream;1"].createInstance(Ci.nsIFileInputStream);
	is.init(this._file, -1, -1, 0);
	return is;
}
