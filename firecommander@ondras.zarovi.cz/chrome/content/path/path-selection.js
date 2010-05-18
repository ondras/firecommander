Path.Selection = function(fc) {
	this._panel = null;
	this._fc = fc;
	this._items = [];
}

Path.Selection.prototype = Object.create(Path.prototype);

/* Path methods */

Path.Selection.prototype.attach = function(panel) {
	this._panel = panel;
}

Path.Selection.prototype.getPath = function() {
	return this._items.length + " " + this._fc.getText("selection.items");
}

Path.Selection.prototype.getItems = function() {
	return this._items;
}

Path.Selection.prototype.supports = function(feature) {
	switch (feature) {
		case FC.CHILDREN:
		case FC.DELETE:
		case FC.COPY:
			return true;
		break;
		
		default:
			return false;
		break;
	}
}

Path.Selection.prototype.getDescription = function() {
	var fileCount = 0;
	var dirCount = 0;
	var bytes = 0;
	
	for (var i=0;i<this._items.length;i++) {
		var item = this._items[i];
		if (item.supports(FC.CHILDREN)) {
			dirCount++;
		} else {
			fileCount++;
			bytes += item.getSize() || 0;
		}
	}
	
	return this._fc.getText("selection.description", fileCount, this._panel.formatSize(bytes), dirCount);
}

/* Selection methods */

Path.Selection.prototype.selectionClear = function() {
	this._items = [];
}

Path.Selection.prototype._getPattern = function(name) {
	var title = this._fc.getText("selection.title");
	var text = this._fc.getText("selection." + name);
	var result = this._fc.showPrompt(text, title, "*");
	if (!result) { return; }

	result = result.replace(/\./g, "\\.");
	result = result.replace(/\*/g, ".*");
	result = result.replace(/\?/g, ".");

	return new RegExp(result);
}

Path.Selection.prototype.selectionAdd = function() {
	var pattern = this._getPattern("add");
	if (!pattern) { return; }
	
	var items = this._panel.getItems();
	if (!items) { return; }
	for (var i=0;i<items.length;i++) {
		var item = items[i];
		if (item.supports(FC.CHILDREN)) { continue; }
		if (this.selectionContains(item)) { continue; }
		if (item.getName().match(pattern)) { this._items.push(item); }
	}
	
	this._panel.redraw();
}

Path.Selection.prototype.selectionRemove = function() {
	var pattern = this._getPattern("remove");
	if (!pattern) { return; }

	var items = this._panel.getItems();
	if (!items) { return; }
	for (var i=0;i<items.length;i++) {
		var item = items[i];
		if (item.supports(FC.CHILDREN)) { continue; }
		if (!item.getName().match(pattern)) { continue; }
		var index = this._items.indexOf(item);
		this._items.splice(index, 1);
	}

	this._panel.redraw();
}

Path.Selection.prototype.selectionInvert = function() {
	var data = this._panel.getItems();
	var newData = [];
	
	for (var i=0;i<this._items.length;i++) {
		var item = this._items[i];
		if (item.supports(FC.CHILDREN)) { newData.push(item); }
	}
	
	for (var i=0;i<data.length;i++) {
		var item = data[i];
		if (item instanceof Path.Up || item.supports(FC.CHILDREN)) { continue; }
		if (!this.selectionContains(item)) { newData.push(item); }
	}
	this._items = newData;
	this._panel.redraw();
}

Path.Selection.prototype.selectionAll = function() {
	var data = this._panel.getItems();
	this._items = [];
	for (var i=0;i<data.length;i++) {
		var item = data[i];
		if (item instanceof Path.Up) { continue; }
		this._items.push(item);
	}
	this._panel.redraw();
}

Path.Selection.prototype.selectionToggle = function() {
	var item = this._panel.getItem();
	if (!item || item instanceof Path.Up) { return; }
	
	var index = this._items.indexOf(item);
	if (index == -1) {
		this._items.push(item);
	} else {
		this._items.splice(index, 1);
	}

	this._panel.redraw(this._panel.getItems().indexOf(item));
}

Path.Selection.prototype.selectionContains = function(path) {
	return (this._items.indexOf(path) != -1);
}
