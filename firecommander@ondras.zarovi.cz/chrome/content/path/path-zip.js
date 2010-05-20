const PR_RDONLY			= 0x01;
const PR_WRONLY			= 0x02;
const PR_RDWR			= 0x04;
const PR_CREATE_FILE	= 0x08;
const PR_APPEND			= 0x10;
const PR_TRUNCATE		= 0x20;
const PR_SYNC			= 0x40;
const PR_EXCL			= 0x80;

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
	this._zipR = Cc["@mozilla.org/libjar/zip-reader;1"].createInstance(Ci.nsIZipReader);
	this._zipW = Cc["@mozilla.org/zipwriter;1"].createInstance(Ci.nsIZipWriter);
	
	if (!this._entry && this._file.exists() && this._name) {
		this._zipR.open(this._file.getFile());
		if (this._zipR.hasEntry(this._name)) { this._entry = this._zipR.getEntry(this._name); }
		this._zipR.close();
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
	return this._entry.lastModifiedTime / 1000;
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
		
	this._zipR.open(this._file.getFile());
	var entries = this._zipR.findEntries(null);	
	var re = new RegExp("^" + this._name + "[^/]+" + "/?$");
	while (entries.hasMore()) {
		var entry = entries.getNext();
		if (!entry.match(re)) { continue; }
		var item = new Path.Zip(this._file, entry, this._zipR.getEntry(entry), this._fc);
		results.push(item);
	}
	
	this._zipR.close();
	return results;
}

Path.Zip.prototype.equals = function(path) {
	if (path instanceof Path.Local && !this._name) { return this._file.equals(path); }
	return (this.getPath() == path.getPath());
}

Path.Zip.prototype.exists = function() {
	if (!this._file.exists()) { return false; }
	if (!this._name) { return true; } /* root entry */
	
	this._zipR.open(this._file.getFile());
	var result = this._zipR.hasEntry(this._name);
	this._zipR.close();

	return result;
}

Path.Zip.prototype.supports = function(feature) {
	switch (feature) {
		case FC.CHILDREN:
			if (!this._name) { return true; }
			return this._entry.isDirectory; 
		break;
		
		case FC.COPY:
		case FC.DELETE:
		case FC.CREATE:
			return true;
		break;
		
		case FC.RENAME:
		case FC.VIEW:
		case FC.EDIT:
			return false;
		break;
	}

	return false;	
}

Path.Zip.prototype.create = function(directory, ts) {
	if (!directory) { throw new Error(Ci.NS_ERROR_NOT_IMPLEMENTED); }

	this._zipW.open(this._file.getFile(), PR_RDWR);
	if (this._name) {
		if (this._name.charAt(this._name.length-1) != "/") { this._name += "/"; }
		this._zipW.addEntryDirectory(this._name, (ts || 0) * 1000, false);
	}
	this._zipW.close();
}

Path.Zip.prototype.append = function(name) {
	var n = (this._name ? this._name + "/" : "") + name;
	return new Path.Zip(this._file, n, null, this._fc);
}

Path.Zip.prototype.delete = function() {
	this._zipW.open(this._file.getFile(), PR_RDWR);
	this._zipW.removeEntry(this._name, false);
	this._zipW.close();
}

Path.Zip.prototype.inputStream = function() {
	this._zipR.open(this._file.getFile());
	var is = this._zipR.getInputStream(this._name);
	this._zipR.close();
	return is;
}

Path.Zip.prototype.createFromPath = function(path) {
	var stream = path.inputStream();
	this._zipW.open(this._file.getFile(), PR_RDWR);
	this._zipW.addEntryStream(this._name, path.getTS() * 1000, this._zipW.COMPRESSION_DEFAULT, stream, false);
	this._zipW.close();
	stream.close();
}


Path.Zip.prototype.activate = function(panel) {
	if (!this._name || this._entry.isDirectory) { panel.setPath(this); }
}

FC.addProtocolHandler("zip", Path.Zip.fromString.bind(Path.Zip));
FC.addExtensionHandler("zip", Path.Zip.handleExtension.bind(Path.Zip));
