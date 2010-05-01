var Panel = function(fc, container, tab) {
	this._dom = {
		treebox: null,
		tree: Panel.tree.cloneNode(true),
		path: document.createElement("textbox"),
		tab: tab
	}

	this._dom.path.setAttribute("tabindex", "-1"); /* textbox must not be focused after tabswitch */
	container.appendChild(this._dom.path);
	container.appendChild(this._dom.tree);

	this._fc = fc;
	this._id = Math.random().toString().replace(".","");
	this._source = null;
	this._data = [];
	this._columns = [NAME, SIZE, DATE, TIME, ATTR];
	this._sortData = {
		column: null,
		order: ASC
	}

	/* clicking this tab when active does not focus the tree - do it manually */
	this._dom.tab.addEventListener("focus", this.focus.bind(this), false);
	/* notify owner when our tree is focused */
	this._dom.tree.addEventListener("focus", this._focus.bind(this), false);
	this._dom.tree.view = this;
	this.changeSort(NAME, ASC);
//	Components.utils.reportError(treeId);
};
Panel.tree = null;

/* nsITreeView methods */

Panel.prototype.rowCount = 0;

Panel.prototype.setTree = function(treebox) { 
	this._dom.treebox = treebox; 
}

Panel.prototype.getCellText = function(row, column) {
	var type = this._columns[column.index];
	return this._data[row][type];
}
     
Panel.prototype.getImageSrc = function(row, column) { 
	if (this._columns[column.index] != NAME) { return ""; }
	return this._data[row].icon;
}
     
Panel.prototype.cycleHeader = function(column) {
	var col = this._columns[column.index];
	var dir = column.element.getAttribute("sortDirection");
	var order = (dir == "ascending" ? DESC : ASC);
	this.changeSort(col, order);
}     
     
Panel.prototype.isEditable = function(row, column) {
	return this._columns[column.index] == NAME;
}     

Panel.prototype.setCellText = function(row, column, text) {
	alert(row);
}

Panel.prototype.isSorted = function() { return true; }
Panel.prototype.isSelectable = function(row, column) { return true; }     
Panel.prototype.isContainer = function() { return false; }
Panel.prototype.isSeparator = function(row) { return false; }  
Panel.prototype.getLevel = function(row) { return 0; }  
Panel.prototype.getRowProperties = function(row, props) {}
Panel.prototype.getCellProperties = function(row, col, props) {}
Panel.prototype.getColumnProperties =function(colid, col, props) {}  

/* custom methods */

Panel.prototype.getID = function() {
	return this._id;
}

Panel.prototype.setSource = function(sourceConstructor) {
	this._source = new sourceConstructor(this);
	return this._source;
}

Panel.prototype.getSource = function() {
	return this._source;
}

Panel.prototype.changeSort = function(column, order) {
	this._sortData.column = column;
	this._sortData.order = order;

	var cols = this._dom.tree.getElementsByTagName("treecol");
	for (var i=0;i<cols.length;i++) {
		var col = cols[i];
		if (this._columns[i] == column) {
			col.setAttribute("sortDirection", order == ASC ? "ascending" : "descending");
		} else {
			col.setAttribute("sortDirection", "natural");
		}
	}

	this._sort();
	this._update();
}

Panel.prototype.focus = function() {
	this._dom.tree.focus();
}

Panel.prototype._sort = function() {
	var coef = this._sortData.order;
	var col = this._sortData.column;
	
	this._data.sort(function(a, b) {
		if (a.dir != b.dir) { return a.dir ? -1 : 1; } /* compare only dir<->dir or file<->file */
		
		switch (col) {
			case NAME:
				return coef * a[NAME].localeCompare(b[NAME]);
			break;
			
			case SIZE:
				if (a[SIZE] == b[SIZE]) { return coef * a[NAME].localeCompare(b[NAME]); }
				return coef * (a[SIZE] - b[SIZE]);
			break;
			
			case DATE:
			case TIME:
				return coef * (a.ts - b.ts);
			break;
		}

	});
}

Panel.prototype._update = function() {
	this._dom.treebox.rowCountChanged(0, -this.rowCount);
	this.rowCount = this._data.length;
	this._dom.treebox.rowCountChanged(0, this.rowCount);
}

Panel.prototype._focus = function() {
	var observerService = Cc["@mozilla.org/observer-service;1"].getService(Ci.nsIObserverService);
	observerService.notifyObservers(this, "panel-focus", this._id);
}

Panel.prototype.startEditing = function() {
	this._dom.tree.startEditing(this._dom.tree.currentIndex, this._dom.tree.columns[0]);
}

/* called from source */

Panel.prototype.setPath = function(path, shortPath) {
	this._dom.tab.label = shortPath;
	this._dom.path.value = path;
}

Panel.prototype.setData = function(data) {
	this._data = data;
	this._sort();
	this._update();
}


