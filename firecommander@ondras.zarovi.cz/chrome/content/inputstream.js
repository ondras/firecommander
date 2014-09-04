/**
 * @class Seekable binary input stream
 * @param nsIInputStream
 */
FC.InputStream = function(is) {
	this._is = is;
	this._bis = Cc["@mozilla.org/binaryinputstream;1"].createInstance(Ci.nsIBinaryInputStream);
	this._bis.setInputStream(this._is);

	this._seekable = this._is.QueryInterface(Ci.nsISeekableStream);
	this.NS_SEEK_SET = this._seekable.NS_SEEK_SET;
	this.NS_SEEK_CUR = this._seekable.NS_SEEK_CUR;
	this.NS_SEEK_END = this._seekable.NS_SEEK_END;
}

FC.InputStream.prototype.available = function() {
	return this._is.available();
}

FC.InputStream.prototype.readBytes = function(amount) {
	return this._bis.readBytes(amount);
}

FC.InputStream.prototype.read8 = function() {
	return this._bis.read8();
}

FC.InputStream.prototype.read16 = function() {
	return this._bis.read16();
}

FC.InputStream.prototype.read32 = function() {
	return this._bis.read32();
}

FC.InputStream.prototype.read64 = function() {
	return this._bis.read64();
}

FC.InputStream.prototype.readByteArray = function(amount) {
	return this._bis.readByteArray(amount);
}

FC.InputStream.prototype.seek = function(whence, offset) {
	return this._seekable.seek(whence, offset);
}

FC.InputStream.prototype.tell = function() {
	return this._seekable.tell();
}

FC.InputStream.prototype.setEOF = function() {
	return this._seekable.setEOF();
}

FC.InputStream.prototype.close = function() {
	return this._bis.close();
}

FC.InputStream.prototype.getNativeStream = function() {
	return this._is;
}
