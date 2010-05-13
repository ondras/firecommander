var Panel = function(fc, container, tab) {
	this.wrappedJSObject = this;
	this._path = null;
	this._fc = fc;
	this._ec = [];
	this._data = [];
	this._selection = new Path.Selection(this, fc);
	this._editing = false; /* quickedit mode */
	this._columns = [Panel.NAME, Panel.SIZE, Panel.TS, Panel.ATTR];
	this._sortData = {
		column: null,
		order: Panel.ASC
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
	this._ec.push(Events.add(this._dom.tab, "focus", this.focus.bind(this)));
	/* notify owner when our tree is focused */
	this._ec.push(Events.add(this._dom.tree, "focus", this._focus.bind(this)));
	/* tree dblclick */
	this._ec.push(Events.add(this._dom.tree, "dblclick", this._dblclick.bind(this)));
	/* tree keypress */
	this._ec.push(Events.add(this._dom.tree, "keypress", this._keypress.bind(this)));
	/* tree keydown */
	this._ec.push(Events.add(this._dom.tree, "keydown", this._keydown.bind(this)));
	/* path textbox change */
	this._ec.push(Events.add(this._dom.path, "change", this._change.bind(this)));
	/* tree select */
	this._ec.push(Events.add(this._dom.tree, "select", this._select.bind(this)));
	
	this._dom.tree.view = this;
	this.changeSort(Panel.NAME, Panel.ASC);
};

Panel.tree = null;
Panel.ASC = 1;
Panel.DESC = -1;

Panel.NAME = 0;
Panel.SIZE = 1;
Panel.TS = 2;
Panel.ATTR = 3;

/* nsITreeView methods */

Panel.prototype.rowCount = 0;

Panel.prototype.setTree = function(treebox) { 
	this._dom.treebox = treebox; 
}

Panel.prototype.getCellText = function(row, column) {
	var item = this._data[row];
	
	try {
	
		switch (this._columns[column.index]) {
			case Panel.NAME:
				return item.getName();
			break;
			case Panel.SIZE:
				var s = item.getSize();
				if (s === null) {
					return "";
				} else {
					return s.toString().replace(/(\d{1,3})(?=(\d{3})+(?!\d))/g, "$1 ");
				}
			break;
			case Panel.TS:
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
			case Panel.ATTR:
				var perms = item.getPermissions();
				if (perms === null) { return ""; }
				var mask = "rwxrwxrwx";
				return mask.replace(/./g, function(ch, index) {
					var perm = 1 << (mask.length-index-1);
					return (perms & perm ? ch : "–");
				});
			break;
		}
	
	} catch (e) { /* error when accessing file - time to refresh? */
		this.refresh();
		return "";
	}
}
     
Panel.prototype.getImageSrc = function(row, column) { 
	if (this._columns[column.index] != Panel.NAME) { return ""; }
	
	try {
		return this._data[row].getImage();
	} catch (e) { /* error when accessing file - time to refresh? */
		this.refresh();
		return "";
	}
}
     
Panel.prototype.cycleHeader = function(column) {
	var col = this._columns[column.index];
	var dir = column.element.getAttribute("sortDirection");
	var order = (dir == "ascending" ? Panel.DESC : Panel.ASC);
	this.changeSort(col, order);
}     
     
Panel.prototype.isEditable = function(row, column) {
	return this._columns[column.index] == Panel.NAME;
}     

/**
 * For some reason, this is called twice after edit ends
 */
Panel.prototype.setCellText = function(row, column, text) {
	if (!this._editing) { return; } /* to prevent second execution */
	this._editing = false;
	
	var item = this._data[row];
	var newFile = this._path.append(text);
	
	var data = this._fc.getText("rename.exists", newFile.getPath());
	var title = this._fc.getText("rename.title");
	if (newFile.exists() && !this._fc.showConfirm(data, title)) { return; }
	
	try {
		item.rename(text);
		this.refresh(newFile);
	} catch (e) {
		var data = this._fc.getText("error.rename", item.getPath(), newFile.getPath());
		this._fc.showAlert(data);
	}
}

Panel.prototype.isSorted = function() { return true; }
Panel.prototype.isSelectable = function(row, column) { return true; }     
Panel.prototype.isContainer = function() { return false; }
Panel.prototype.isSeparator = function(row) { return false; }  
Panel.prototype.getLevel = function(row) { return 0; }  
Panel.prototype.getRowProperties = function(row, props) {}
Panel.prototype.getCellProperties = function(row, col, props) {
	if (!this._selection.selectionContains(this._data[row])) { return; }
	
	var as = Cc["@mozilla.org/atom-service;1"].getService(Ci.nsIAtomService);
	var atom = as.getAtom("marked");
	props.AppendElement(atom);
}
Panel.prototype.getColumnProperties = function(colid, col, props) {}  

/* custom methods */

Panel.prototype.changeSort = function(column, order) {
	this._sortData.column = column;
	this._sortData.order = order;
	
	var cols = this._dom.tree.getElementsByTagName("treecol");
	for (var i=0;i<cols.length;i++) {
		var col = cols[i];
		if (this._columns[i] == column) {
			col.setAttribute("sortDirection", order == Panel.ASC ? "ascending" : "descending");
		} else {
			col.setAttribute("sortDirection", "natural");
		}
	}

	var item = this.getItem();
	this._sort();
	this.update();
	if (item) { this._focusItem(item); }
}

Panel.prototype.focus = function() {
	this._dom.tree.focus();
}

Panel.prototype.focusPath = function() {
	this._dom.path.focus();
	this._dom.path.select();
}

/**
 * @returns {bool} was item focused?
 */
Panel.prototype._focusItem = function(item) {
	for (var i=0;i<this._data.length;i++) {
		var path = this._data[i];
		if (path.equals(item)) { 
			this._dom.tree.currentIndex = i; 
			this._dom.treebox.ensureRowIsVisible(i);
			return true;
		}
	}
	return false;
}

Panel.prototype.getItem = function() {
	var index = this._dom.tree.currentIndex;
	if (index == -1) { return null; }
	return this._data[index];
}

Panel.prototype.getItems = function() {
	return this._data;
}

Panel.prototype._sort = function() {
	var coef = this._sortData.order;
	var col = this._sortData.column;
	
	this._data.sort(function(a, b) {
		var as = a.getSort();
		var bs = b.getSort();
		if (as != bs) { return as - bs; } /* compare only dir<->dir or file<->file */
		
		switch (col) {
			case Panel.NAME:
				var an = a.getName();
				var bn = b.getName();
				return coef * an.localeCompare(bn);
			break;
			
			case Panel.SIZE:
				var as = a.getSize();
				var bs = b.getSize();
				if (as == bs) { return coef * a.getName().localeCompare(b.getName()); }
				return coef * (as - bs);
			break;
			
			case Panel.TS:
				return coef * (a.getTS() - b.getTS());
			break;
			
			case Panel.ATTR:
				return coef * (a.getPermissions() - b.getPermissions());
			break;
		}

	});
}

/**
 * Redraw, maintain focused index
 */
Panel.prototype.update = function(index) {
	if (arguments.length) {
		this._dom.treebox.invalidateRow(index);
		return;
	}

	var index = this._dom.tree.currentIndex;
	this._dom.treebox.rowCountChanged(0, -this.rowCount);
	this.rowCount = this._data.length;
	this._dom.treebox.rowCountChanged(0, this.rowCount);
	if (index >= this._data.length) { index = this._data.length-1; }
	this._dom.tree.currentIndex = index;

}

/**
 * Tree focus - notify parent
 */
Panel.prototype._focus = function(e) {
	this._dom.treebox.ensureRowIsVisible(this._dom.tree.currentIndex );
	this._select();

	var observerService = Cc["@mozilla.org/observer-service;1"].getService(Ci.nsIObserverService);
	observerService.notifyObservers(this, "panel-focus", this._id);
}

/**
 * Tree doubleclick
 */
Panel.prototype._dblclick = function(e) {
	var row = this._dom.treebox.getRowAt(e.clientX, e.clientY);
	if (row == -1) { return; }
	this._data[row].activate(this);
}

/**
 * Tree keypress
 */
Panel.prototype._keypress = function(e) {
	
	var ch = String.fromCharCode(e.charCode).toUpperCase(); /* shift + drive */
	if (ch.match(/[A-Z]/) && e.shiftKey && !e.ctrlKey) {
		try {
			var path = Path.Local.fromString(ch+":");
			if (path.exists()) { this.setPath(path); }
		} catch (e) {}
		return;
	}

	if (ch == "A" && e.ctrlKey) {
		this._selection.selectionAll();
		return;
	}

}

Panel.prototype._keydown = function(e) {
	switch (e.keyCode) {
		case 13: /* enter */
			if (this._dom.tree.editingRow != -1) { return; }
			var item = this.getItem();
			if (item) { item.activate(this); }
		break;
		
		case 106: /* num asterisk */
			this._selection.selectionInvert();
		break;
		
		case 32: /* space */
		case 45: /* insert */
			this._selection.selectionToggle();
			var index = this._dom.tree.currentIndex;
			if (index+1 < this._data.length) { this._dom.tree.currentIndex = index+1; }
		break;
		
		case 107: /* num plus */
			this._selection.selectionAdd();
		break;
		
		case 109: /* num minus */
			this._selection.selectionRemove();
		break;
		
		default:
			var ch = String.fromCharCode(e.keyCode);
			if (ch.match(/[0-9]/) && e.ctrlKey) { /* get/set favorite */
				var prefName = "fav." + ch;
				if (e.shiftKey) { /* set favorite */
					var path = this._path.getPath();
					var text = this._fc.getText("fav.text", path, ch);
					var title = this._fc.getText("fav.title");
					var result = this._fc.showConfirm(text, title)
					if (result) { this._fc.setPreference(prefName, path); }
				} else { /* load favorite */
					var path = this._fc.getPreference(prefName);
					if (path) { this.setPath(path); }
				}
			}
		break;
	}
}

Panel.prototype._select = function(e) {
	var item = this.getItem();
	var status = "";
	if (item) { status = item.getDescription(); }
	this._fc.setStatus(status);
}

/**
 * Textbox onchange
 */
Panel.prototype._change = function(e) {
	var value = this._dom.path.value;
	if (!value) { return; }

	this.setPath(value);
	this.focus();
}

Panel.prototype.startEditing = function() {
	var item = this.getItem();
	if (!item || !item.supports(FC.RENAME)) { return; }
	this._editing = true; /* necessary to prevent double execution of setCellText */
	this._dom.tree.startEditing(this._dom.tree.currentIndex, this._dom.tree.columns[0]);
}

/**
 * Resync the view, maintaining focus. If specified, focus a given path.
 * @param {null || Path} focusedPath Try to focus this path. If null, focus current item.
 * @param {int} focusedIndex If the focused path cannot be found, focus this index.
 */
Panel.prototype.refresh = function(focusedPath, focusedIndex) {
	var oldIndex = this._dom.tree.currentIndex; /* store original index */
	var oldItem = this.getItem(); /* store original item */

	var data = [];
	try {
		data = this._path.getItems();
	} catch (e) {
		this._fc.showAlert(this._fc.getText("error.nochildren", this._path.getPath()));
	}

	this._data = data;
	this._selection.selectionClear();
	var parent = this._path.getParent();
	if (parent) { this._data.push(new Path.Up(parent)); } /* .. */
	
	this._sort();
	this.update();
	
	if (!focusedPath) { focusedPath = oldItem; } /* try same item */
	if (!focusedPath) { return; } /* no item available */
	var ok = this._focusItem(focusedPath);
	
	if (!ok) { /* cannot focus this item! */
		var index = (arguments.length < 2 ? oldIndex : 0);
		index = Math.min(index, this._data.length-1);
		if (index == -1) { return; } /* nothing to focus */
		this._dom.tree.currentIndex = index;
	}
}

/**
 * @param {string || Path} path
 */
Panel.prototype.setPath = function(path) {
	var focusedPath = this._path;

	if (typeof(path) == "string") {
		path = this._fc.getProtocolHandler(path);
		if (!path) { return; }
	}

	if (!path.exists()) { 
		this._fc.showAlert(this._fc.getText("error.nopath", path.getPath()));
		return;
	}

	if (!path.supports(FC.CHILDREN)) {
		focusedPath = path;
		path = path.getParent(); 
	} 
	
	this._path = path;
	this._dom.tab.label = path.getName() || path.getPath();
	this._dom.path.value = path.getPath();
	
	this.refresh(focusedPath, 0);
}

Panel.prototype.getPath = function() {
	return this._path;
}

Panel.prototype.getSelection = function() {
	return (this._selection.getItems().length ? this._selection : null);
}

Panel.prototype.destroy = function() {
	this._selection.selectionClear();
	this._ec.forEach(Events.remove, Events);
}
