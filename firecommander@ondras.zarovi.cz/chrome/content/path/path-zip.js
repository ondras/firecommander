/**
 * @param {path} file
 * @param {string} name Full path within archive
 * @param {nsIZipEntry || null} entry
 * @param {FC} fc
 */
Path.Zip = function(file, name, entry, fc) {
	this._file = file;
	this._name = name;
	this._entry = entry;
	this._fc = fc;
	this._zip = Cc["@mozilla.org/libjar/zip-reader;1"].createInstance(Ci.nsIZipReader);
	
	if (!this._entry && this._file.exists() && this._name) {
		this._zip.open(this._file.getFile());
		this._entry = this._zip.getEntry(this._name);
		this._zip.close();
	}
}

Path.Zip.prototype = Object.create(Path.prototype);

Path.Zip.fromString = function(path, fc) {
	var local = Path.Local.fromString(path);
	var name = [];
	
	while (!local.exists()) {
		name.unshift(local.getName());
		local = local.getParent();
		if (!local) {
			/* FIXME completely fucked up path, not starting with existing local file */
		}
	}
	
	name = name.join("/");
	if (path.charAt(path.length-1) == "/" && name.charAt(name.length-1) != "/") { name += "/"; }
	return new this(local, name, null, fc);
}

Path.Zip.handleExtension = function(path, fc) {
	var p = Path.Zip.fromString(path, fc);
	fc.getActivePanel().setPath(p);
}

Path.Zip.prototype.getPath = function() {
	var p = "zip://" + this._file.getPath();
	if (this._name) { p += "/" + this._name; }
	return p;
}

Path.Zip.prototype.getName = function() {
	if (!this._name) { return this._file.getName(); }
	var parts = this._name.split("/");
	return (parts.pop() || parts.pop()); /* last non-empty part */
}

Path.Zip.prototype.getImage = function() {
	if (this._entry.isDirectory) {
		return "chrome://firecommander/skin/folder.png";
	} else {
		var ios = Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService);
		var pseudoName = this._file.getPath() + "/" + this._name;
		var pseudoPath = Path.Local.fromString(pseudoName);
		var fileURI = ios.newFileURI(pseudoPath.getFile());
		return "moz-icon://" + fileURI.spec;
	}
}

Path.Zip.prototype.getSize = function() {
	return this._entry.realSize;
}

Path.Zip.prototype.getSort = function() {
	return (this._entry.isDirectory ? 1 : 2);
}

Path.Zip.prototype.getTS = function() {
	return this._entry.lastModifiedTime;
}

Path.Zip.prototype.getParent = function() {
	if (!this._name) { return this._file.getParent(); }
	var parts = this._name.split("/");
	parts.pop() || parts.pop(); /* remove last non-empty part */
	var parentName = (parts.length ? parts.join("/") + "/" : "");
	return new Path.Zip(this._file, parentName, null, this._fc);
}

Path.Zip.prototype.getItems = function() {
	var results = [];
		
	this._zip.open(this._file.getFile());
	var entries = this._zip.findEntries(null);	
	var re = new RegExp("^" + this._name + "[^/]+" + "/?$");
	while (entries.hasMore()) {
		var entry = entries.getNext();
		if (!entry.match(re)) { continue; }
		var item = new Path.Zip(this._file, entry, this._zip.getEntry(entry), this._fc);
		results.push(item);
	}
	
	this._zip.close();
	return results;
}

Path.Zip.prototype.equals = function(path) {
	if (path instanceof Path.Local && !this._name) { return this._file.equals(path); }
	return (this.getPath() == path.getPath());
}

Path.Zip.prototype.exists = function() {
	if (!this._file.exists()) { return false; }
	if (!this._name) { return true; } /* root entry */
	
	this._zip.open(this._file.getFile());
	var result = this._zip.hasEntry(this._name);
	this._zip.close();

	return result;
}

Path.Zip.prototype.supports = function(feature) {
	/* FIXME */
	if (feature == FC.CHILDREN) { 
		if (!this._name) { return true; }
		return this._entry.isDirectory; 
	}

	return false;
}

Path.Zip.prototype.activate = function(panel) {
	if (!this._name || this._entry.isDirectory) { panel.setPath(this); }
}

FC.addProtocolHandler("zip", Path.Zip.fromString.bind(Path.Zip));
FC.addExtensionHandler("zip", Path.Zip.handleExtension.bind(Path.Zip));
