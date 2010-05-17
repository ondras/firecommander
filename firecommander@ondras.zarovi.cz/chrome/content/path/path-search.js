Path.Search = function() {
}

Path.Search.prototype = Object.create(Path.prototype);

Path.Search.fromString = function(str, fc) {
	this._params = JSON.parse(str);
	this._fc = fc;
	this._params.path = this._fc.getProtocolHandler(this._params.path);
	if (!this._params.path.exists() && !this._params.path.supports(FC.CHILDREN)) { throw; }
}

Path.Search.prototype.attach = function(panel) {
	/* start scanning */
	new Operation.Search(this._fc, this._params, this._done.bind(this));
}

Path.Search.prototype.deattach = function(panel) {
}

Path.Search.prototype._done = function(results) {
}

FC.addProtocolHandler("search", Path.Search.fromString.bind(Path.Favorites));
