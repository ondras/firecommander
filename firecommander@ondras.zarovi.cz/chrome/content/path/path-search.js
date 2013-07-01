Path.Search = function(str, params) {
	Path.call(this);
	this._str = str;
	this._params = params;
	this._items = [];
	this._panel = null;
}

Path.Search.prototype = Object.create(Path.prototype);

Path.Search.fromString = function(str, fc) {
	var params = JSON.parse(str);
	params.path = fc.getProtocolHandler(params.path, null);
	if (!params.path.exists() || !params.path.supports(FC.CHILDREN)) { throw 1; }
	return new this(str, params, fc);
}

Path.Search.prototype.getPath = function() {
	return "search://" + this._str;
}

Path.Search.prototype.getName = function() {
	return _("search.results");
}

Path.Search.prototype.exists = function() {
	return true;
}

Path.Search.prototype.getItems = function() {
	var items = []; /* remove dead items */
	for (var i=0;i<this._items.length;i++) {
		var item = this._items[i];
		if (item.exists()) { items.push(item); }
	}
	this._items = items;
	return this._items;
}

Path.Search.prototype.supports = function(feature) {
	if (feature == FC.CHILDREN) { return true; }
	return false;
}

Path.Search.prototype.attach = function(panel) {
	this._panel = panel;
	new Operation.Search(this._found.bind(this), this._params).run().then(this._done.bind(this));
}

Path.Search.prototype.detach = function() {
	this._items = [];
	this._panel = null;
}

Path.Search.prototype.clone = function() {
	return new Path.Search(this._str, this._params);
}

Path.Search.prototype._found = function(path) {
	this._items.push(path);
}

Path.Search.prototype._done = function(results) {
	this._panel.resync();
}

FC.addProtocolHandler("search", Path.Search.fromString.bind(Path.Search));
