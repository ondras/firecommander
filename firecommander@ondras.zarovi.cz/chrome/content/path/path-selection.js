Path.Selection = function(panel, fc) {
	this._panel = panel;
	this._fc = fc;
	this._items = [];
}

Path.Selection.prototype = Object.create(Path.prototype);

/* Path methods */

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

/* Selection methods */

Path.Selection.prototype.selectionClear = function() {
	this._items = [];
}

Path.Selection.prototype.selectionAdd = function() {
	/* FIXME */
	alert("not (yet) implemented");
	this._panel.update();
}

Path.Selection.prototype.selectionRemove = function() {
	/* FIXME */
	alert("not (yet) implemented");
	this._panel.update();
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
	this._panel.update();
}

Path.Selection.prototype.selectionAll = function() {
	var data = this._panel.getItems();
	this._items = [];
	for (var i=0;i<data.length;i++) {
		var item = data[i];
		if (item instanceof Path.Up) { continue; }
		this._items.push(item);
	}
	this._panel.update();
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

	this._panel.update(this._panel.getItems().indexOf(item));
}

Path.Selection.prototype.selectionContains = function(path) {
	return (this._items.indexOf(path) != -1);
}
