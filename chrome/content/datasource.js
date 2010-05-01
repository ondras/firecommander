var DataSource = function(panel) {
	this._panel = panel;
}

DataSource.prototype.setPath = function(path) {
	this._panel.setPath(path);
}

DataSource.prototype.newItem = function(id) {
	var item = {};
	item.id = id;
	
	item.dir = false;
	item.icon = "";
	item.ts = 0;
	item[NAME] = "";
	item[SIZE] = "";
	item[DATE] = "";
	item[TIME] = "";
	item[ATTR] = "";
	
	return item;
}
