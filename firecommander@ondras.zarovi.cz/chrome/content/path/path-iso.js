/**
 * @param {path} file Image file
 * @param {string} name Full path within the ISO image
 * @param {number[]} directoryRecord
 * @param {bool} joliet
 */
Path.ISO = function(file, name, directoryRecord, joliet) {
	Path.call(this);
	this._file = file;
	this._name = name;
	this._ts = -1;
	this._directoryRecord = directoryRecord;

	this._joliet = false;
	this._icon = null;
	this._columns[Panel.ATTR] = false;

	if (!this._directoryRecord && this._file.exists()) {
		this._directoryRecord = this._findDirectoryRecord();
	}
}
Path.ISO.LBA = 0x800;

Path.ISO.prototype = Object.create(Path.prototype);

Path.ISO.fromString = function(path) {
	var local = Path.Local.fromString(path);
	var name = [];
	
	while (!local.exists()) {
		name.unshift(local.getName());
		local = local.getParent();
		if (!local) { throw Cr.NS_ERROR_FILE_NOT_FOUND; } /* completely fucked up path, not starting with existing local file */
	}
	
	name = name.join("/");
	return new this(local, name);
}

Path.ISO.handleExtension = function(path, fc) {
	var p = Path.ISO.fromString(path);
	fc.getActivePanel().setPath(p);
}

Path.ISO.prototype.getPath = function() {
	var p = "iso://" + this._file.getPath();
	if (this._name) { p += "/" + this._name; }
	return p;
}

Path.ISO.prototype.getName = function() {
	if (!this._name) { return this._file.getName(); }
	var parts = this._name.split("/");
	return parts.pop();
}

Path.ISO.prototype.getImage = function() {
	if (this._icon) { return this._icon; }

	if (this._isDirectory()) {
		this._icon = "chrome://firecommander/skin/folder.png";
	} else {
		var pseudoName = "file://" + this._file.getPath() + "/" + this._name;
		this._icon = FC.getIcon(pseudoName);
	}
	
	return this._icon;
}

Path.ISO.prototype.getSize = function() {
	if (this._isDirectory()) { return null; }

	var size = 0; /* extent length */
	for (var i=0;i<4;i++) {
		size += this._directoryRecord[i + 10] * (1 << 8*i);
	}

	return size;
}

Path.ISO.prototype.getDescription = function() {
	var d = this.getPath();
	if (!this._isDirectory()) { d += ", " + FC.formatSize(this.getSize(), false); }
	return d;
}

Path.ISO.prototype.getSort = function() {
	return (this._isDirectory() ? 1 : 2);
}

Path.ISO.prototype.getTS = function() {
	if (this._ts > -1) { return this._ts; }

	var years = this._directoryRecord[18];
	var month = this._directoryRecord[19];
	var day = this._directoryRecord[20];
	var hour = this._directoryRecord[21];
	var minute = this._directoryRecord[22];
	var second = this._directoryRecord[23];
	var offset = this._directoryRecord[24];
	if (offset > 127) { offset -= 256; }

	var date = new Date(1900+years, month-1, day, hour, minute, second, 0);
	this._ts = date.getTime();

	var minute = 1000*60;
	this._ts -= offset * 15 * minute;

	return this._ts;
}

Path.ISO.prototype.getParent = function() {
	if (!this._name) { return this._file.getParent(); }
	var parts = this._name.split("/");
	parts.pop();
	var parentName = (parts.length ? parts.join("/") : "");
	return new Path.ISO(this._file, parentName);
}

Path.ISO.prototype.getItems = function() {
	var results = [];
	var children = this._getChildDirectoryRecords(this._directoryRecord);

	for (var i=0;i<children.length;i++) {
		var child = children[i];
		var name = this._getRecordName(child);
		if (!name) { continue; }

		if (this._name) { name = this._name + "/" + name; }

		var item = new Path.ISO(this._file, name, child, this._joliet);
		results.push(item);
	}

	return results;
}

Path.ISO.prototype.equals = function(path) {
	if (path instanceof Path.Local && !this._name) { return this._file.equals(path); }
	return (this.getPath() == path.getPath());
}

Path.ISO.prototype.exists = function() {
	return !!this._directoryRecord;
}

Path.ISO.prototype.supports = function(feature) {
	switch (feature) {
		case FC.CHILDREN:
			if (!this._name) { return true; }
			return this._isDirectory();
		break;
		
		case FC.VIEW:
			return !this._isDirectory();
		break;
		
		case FC.COPY:
			return true;
		break;
	}

	return false;	
}

Path.ISO.prototype.append = function(name) {
	var n = (this._name ? this._name + "/" : "") + name;
	return new Path.ISO(this._file, n);
}

Path.ISO.prototype.inputStream = function() {
	return new Path.ISO.InputStream(this._directoryRecord, this._file);
}

Path.ISO.prototype._findDirectoryRecord = function() {
	var is = this._file.inputStream();
	is.seek(is.NS_SEEK_SET, 0x8000);

	var type1descriptor = null;
	var type2descriptor = null;

	while (1) {
		var descriptor = is.readByteArray(Path.ISO.LBA);
		if (String.fromCharCode.apply(String, descriptor.slice(1, 6)) != "CD001") { throw new Error("Invalid Volume Descriptor"); }

		var done = false;

		switch (descriptor[0]) {
			case 1: type1descriptor = descriptor; break;
			case 2: type2descriptor = descriptor; this._joliet = true; break;
			case 255: done = true; break;
		}

		if (done) { break; }
	}

	is.close();

	var d = type2descriptor || type1descriptor;
	if (d == null) { throw new Error("No valid Volume Descriptor found"); }

	var root = d.slice(156, 190);
	return this._traverseDirectoryRecords(root);
}

Path.ISO.prototype._traverseDirectoryRecords = function(root) {

	var parts = this._name.split("/");
	var record = root;
	while (parts.length && record) {
		var name = parts.shift();
		if (!name) { continue; }
		record = this._locateDirectoryRecord(record, name);
	}

	return record;
}

Path.ISO.prototype._locateDirectoryRecord = function(parent, name) {
	var flags = parent[25];
	if (!(flags & 2)) { return null; }

	var children = this._getChildDirectoryRecords(parent);
	for (var i=0;i<children.length;i++) {
		var child = children[i];
		var childName = this._getRecordName(child);
		if (str == name) { return child; }
	}

	return null;
}

Path.ISO.prototype._getChildDirectoryRecords = function(parent) {
	var is = this._file.inputStream();

	var results = [];

	var pos = 0; /* extent position */
	for (var i=0;i<4;i++) {
		pos += parent[i + 2] * (1 << 8*i);
	}

	var length = 0; /* extent length */
	for (var i=0;i<4;i++) {
		length += parent[i + 10] * (1 << 8*i);
	}

	is.seek(is.NS_SEEK_SET, pos * Path.ISO.LBA);

	var extent = is.readByteArray(length);

	while (extent.length) {
		var recordLength = extent[0];
		if (!recordLength) { 
			var size = Math.floor(extent.length / Path.ISO.LBA) * Path.ISO.LBA;
			extent.splice(0, extent.length-size);
			continue;
		}

		var record = extent.splice(0, recordLength);
		results.push(record);
	}

	is.close();
	return results;
}

Path.ISO.prototype._isDirectory = function() {
	var flags = this._directoryRecord[25];
	return (flags & 2);
}

Path.ISO.prototype._getRecordName = function(record) {
	var length = record[32];
	var name = record.slice(33, 33+length);

	var result = "";
	if (length == 1 && name[0] < 2) { return result; }

	if (this._joliet) {
		for (var i=0;i<name.length;i+=2) {
			result += String.fromCharCode(name[i]*256 + name[i+1]);
		}
	} else {
		result = String.fromCharCode.apply(String, name);
	}

	var index = result.indexOf(";");
	if (index > -1) { result = result.substring(0, index); }
	return result;
}

FC.addProtocolHandler("iso", Path.ISO.fromString.bind(Path.ISO));
FC.addExtensionHandler("iso", Path.ISO.handleExtension.bind(Path.ISO));

Path.ISO.InputStream = function(directoryRecord, path) {
	this._isoInputStream = path.inputStream();

	this.NS_SEEK_SET = this._isoInputStream.NS_SEEK_SET;
	this.NS_SEEK_CUR = this._isoInputStream.NS_SEEK_CUR;
	this.NS_SEEK_END = this._isoInputStream.NS_SEEK_END;


	/* extent position */
	this._offset = 0;
	for (var i=0;i<4;i++) {
		this._offset += directoryRecord[i + 2] * (1 << 8*i);
	}
	this._offset *= Path.ISO.LBA;

	/* extent length */
	this._size = 0;
	for (var i=0;i<4;i++) {
		this._size += directoryRecord[i + 10] * (1 << 8*i);
	}

	this.seek(this.NS_SEEK_SET, 0);
}

Path.ISO.InputStream.prototype = Object.create(FC.InputStream);

Path.ISO.InputStream.prototype.available = function() {
	return this._size - this.tell();
}

Path.ISO.InputStream.prototype.readBytes = function(amount) {
	return this._isoInputStream.readBytes(amount);
}

Path.ISO.InputStream.prototype.read8 = function() {
	return this._isoInputStream.read8();
}

Path.ISO.InputStream.prototype.read16 = function() {
	return this._isoInputStream.read16();
}

Path.ISO.InputStream.prototype.read32 = function() {
	return this._isoInputStream.read32();
}

Path.ISO.InputStream.prototype.read64 = function() {
	return this._isoInputStream.read64();
}

Path.ISO.InputStream.prototype.readByteArray = function(amount) {
	return this._isoInputStream.readByteArray(amount);
}

Path.ISO.InputStream.prototype.seek = function(whence, offset) {
	switch (whence) {
		case this.NS_SEEK_SET:
			return this._isoInputStream.seek(whence, this._offset + offset);
		break;

		case this.NS_SEEK_CUR:
			return this._isoInputStream.seek(whence, offset);
		break;

		case this.NS_SEEK_END:
			return this._isoInputStream.seek(this.NS_SEEK_SET, this._offset + this._size - offset);
		break;
	}
	return this._seekable.seek(whence, offset);
}

Path.ISO.InputStream.prototype.tell = function() {
	return this._isoInputStream.tell() - this._offset;
}

Path.ISO.InputStream.prototype.setEOF = function() {
	return this._isoInputStream.seek(this.NS_SEEK_END, 0);
}

Path.ISO.InputStream.prototype.close = function() {
	return this._isoInputStream.close();
}

Path.ISO.InputStream.prototype.getNativeStream = function() {
	throw new Error("Native stream not available for ISO paths")
}
