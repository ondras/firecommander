Path.Search = function(str, params, fc) {
	this._path = "search://" + str;
	this._params = params;
	this._fc = fc;
	this._items = [];
	this._panel = null;
}

Path.Search.prototype = Object.create(Path.prototype);

Path.Search.fromString = function(str, fc) {
	var params = JSON.parse(str);
	params.path = fc.getProtocolHandler(params.path);
	if (!params.path.exists() || !params.path.supports(FC.CHILDREN)) { throw 1; }
	return new this(str, params, fc);
}

Path.Search.prototype.getPath = function() {
	return this._path;
}

Path.Search.prototype.getName = function() {
	return this._fc.getText("search.results");
}

Path.Search.prototype.exists = function() {
	return true;
}

Path.Search.prototype.getItems = function() {
	return this._items;
}

Path.Search.prototype.supports = function(feature) {
	if (feature == FC.CHILDREN) { return true; }
	return false;
}

Path.Search.prototype.attach = function(panel) {
	this._panel = panel;
	new Operation.Search(this._fc, this._params, this._found.bind(this), this._done.bind(this));
}

Path.Search.prototype.deattach = function(panel) {
}

Path.Search.prototype._found = function(path) {
	this._items.push(path);
}

Path.Search.prototype._done = function(results) {
	this._panel.refresh();
}

FC.addProtocolHandler("search", Path.Search.fromString.bind(Path.Search));
