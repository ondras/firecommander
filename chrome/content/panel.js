const ASC = 1;
const DESC = -1;

const NAME = 0;
const SIZE = 1;
const TS = 2;
const ATTR = 3;

var Panel = function(fc, container, tab) {
	this._path = null;
	this._fc = fc;
	this._id = Math.random().toString().replace(".","");
	this._data = [];
	this._columns = [NAME, SIZE, TS, ATTR];
	this._sortData = {
		column: null,
		order: ASC
	}

	this._dom = {
		treebox: null,
		tree: Panel.tree.cloneNode(true),
		path: document.createElement("textbox"),
		tab: tab
	}
	
	this._dom.path.setAttribute("tabindex", "-1"); /* textbox must not be focused after tabswitch */
	container.appendChild(this._dom.path);
	container.appendChild(this._dom.tree);

	/* clicking this tab when active does not focus the tree - do it manually */
	this._dom.tab.addEventListener("focus", this.focus.bind(this), false);
	/* notify owner when our tree is focused */
	this._dom.tree.addEventListener("focus", this._focus.bind(this), false);
	/* tree dblclick */
	this._dom.tree.addEventListener("dblclick", this._dblclick.bind(this), false);
	/* tree keypress */
	this._dom.tree.addEventListener("keypress", this._keypress.bind(this), false);
	
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
	var item = this._data[row];
	
	switch (this._columns[column.index]) {
		case NAME:
			return item.getName();
		break;
		case SIZE:
			var s = item.getSize();
			if (s === null) {
				return "";
			} else {
				return s;
			}
		break;
		case TS:
			var ts = item.getTS();
			if (ts === null) { return ""; }
			var date = new Date(ts);

			var d = date.getDate();
			var mo = date.getMonth()+1;
			var y = date.getFullYear();

			var h = date.getHours();
			var m = date.getMinutes();
			var s = date.getSeconds();
			if (h < 10) { h = "0"+h; }
			if (m < 10) { m = "0"+m; }
			if (s < 10) { s = "0"+s; }

			return d+"."+mo+"."+y+" "+h+":"+m+":"+s;
		break;
		case ATTR:
			return "";
		break;
	}
}
     
Panel.prototype.getImageSrc = function(row, column) { 
	if (this._columns[column.index] != NAME) { return ""; }
	return this._data[row].getImage();
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
	/* FIXME */
}

Panel.prototype.isSorted = function() { return true; }
Panel.prototype.isSelectable = function(row, column) { return true; }     
Panel.prototype.isContainer = function() { return false; }
Panel.prototype.isSeparator = function(row) { return false; }  
Panel.prototype.getLevel = function(row) { return 0; }  
Panel.prototype.getRowProperties = function(row, props) {}
Panel.prototype.getCellProperties = function(row, col, props) {}
Panel.prototype.getColumnProperties = function(colid, col, props) {}  

/* custom methods */

Panel.prototype.getID = function() {
	return this._id;
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
		var as = a.getSort();
		var bs = b.getSort();
		if (as != bs) { return as - bs; } /* compare only dir<->dir or file<->file */
		
		switch (col) {
			case NAME:
				var an = a.getName();
				var bn = b.getName();
				
/*				
				var re = /[a-z0-9]/i;
				if (an && bn) {
					if (an[0].match(re) || bn[0].match(re))
				}
*/				
				return coef * an.localeCompare(bn);
			break;
			
			case SIZE:
				var as = a.getSize();
				var bs = b.getSize();
				if (as == bs) { return coef * a.getName().localeCompare(b.getName()); }
				return coef * (as - bs);
			break;
			
			case DATE:
			case TIME:
				return coef * (a.getTS() - b.getTS());
			break;
		}

	});
}

Panel.prototype._update = function() {
	this._dom.treebox.rowCountChanged(0, -this.rowCount);
	this.rowCount = this._data.length;
	this._dom.treebox.rowCountChanged(0, this.rowCount);
}

Panel.prototype._focus = function(e) {
	var observerService = Cc["@mozilla.org/observer-service;1"].getService(Ci.nsIObserverService);
	observerService.notifyObservers(this, "panel-focus", this._id);
}

Panel.prototype._dblclick = function(e) {
	var row = this._dom.treebox.getRowAt(e.clientX, e.clientY);
	if (row == -1) { return; }
	this._data[row].activate(this);
}

Panel.prototype._keypress = function(e) {
	if (e.keyCode == 13) { /* enter */
		this._data[this._dom.tree.currentIndex].activate(this);
		return;
	}
	
	var ch = String.fromCharCode(e.charCode).toUpperCase(); /* shift + drive */
	if (ch.match(/[A-Z]/) && e.shiftKey && !e.ctrlKey) {
		var file = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsILocalFile);
		try {
			file.initWithPath(ch + ":");
		} catch (e) {
			return;
		}
		if (file.exists()) { this.setPath(new Path.Local(file)); }
	}
}

Panel.prototype.startEditing = function() {
	this._dom.tree.startEditing(this._dom.tree.currentIndex, this._dom.tree.columns[0]);
}

Panel.prototype.setPath = function(path) {
	var oldPath = this._path;
	this._path = path;
	this._dom.tab.label = path.getName();
	this._dom.path.value = path.getPath();
	
	this._data = path.getItems();
	this._sort();
	this._update();

	var index = 0;
	if (oldPath) { /* pre-select old path */
		var op = oldPath.getPath().toLowerCase();
		for (var i=0;i<this._data.length;i++) {
			var item = this._data[i];
			if (item.getPath().toLowerCase() == op) {
				index = i;
				break;
			}
		}
	}
	this._dom.tree.currentIndex = index;
	
	return this;
}

Panel.prototype.getPath = function() {
	return this._path;
}
