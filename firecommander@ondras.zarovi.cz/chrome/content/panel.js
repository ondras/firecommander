var Panel = function(fc, container, tab) {
	this.wrappedJSObject = this;
	this._path = null;
	this._computedSizes = {}; /* temporary cache for computed directory sizes */
	this._fc = fc;
	this._ec = [];
	this._items = [];
	this._selection = new Path.Selection(fc);
	this._selection.attach(this);
	this._view = new Panel.View(this);
	
	this._editing = false; /* quickedit mode */
	this._sortData = {
		column: Panel.NAME,
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
	
	this._syncHeader();

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
	
	this._dom.tree.view = this._view;
};

Panel.tree	= null;
Panel.ASC	= 1;
Panel.DESC	= -1;

Panel.NAME	= 0;
Panel.SIZE	= 1;
Panel.TS	= 2;
Panel.ATTR	= 3;
Panel.EXT	= 4;

/**
 * Change sorting to a given column. If this column alredy sorts, the direction is reversed.
 * @param {int} column Column constant
 */
Panel.prototype.setSort = function(column) {
	this._sortData.order = (column == this._sortData.column ? -this._sortData.order : Panel.ASC);
	this._sortData.column = column;
	
	this._syncHeader();
	this._fc.updateMenu();

	var item = this.getItem();
	this._sort();
	this.redraw();
	if (item) { this._focusItem(item); }
}

Panel.prototype.getSort = function() {
	return this._sortData.column;
}

/**
 * @param {string || Path} path
 */
Panel.prototype.setPath = function(path) {
	var focusedPath = this._path;

	if (typeof(path) == "string") {
		path = this._fc.getProtocolHandler(path, this._path);
		if (!path) { return; }
	}

	if (!path.exists()) { 
		this._fc.showAlert(_("error.nopath", path.getPath()));
		return;
	}

	if (!path.supports(FC.CHILDREN)) {
		focusedPath = path;
		path = path.getParent(); 
	} 
	
	if (this._path) { this._path.detach(); }
	this._path = path;
	this._computedSizes = {};
	this._path.attach(this);
	
	this._dom.tab.label = path.getName() || path.getPath();
	this._dom.path.value = path.getPath();
	this.resync(focusedPath, 0);
}

Panel.prototype.getPath = function() {
	return this._path;
}

Panel.prototype.getSelection = function() {
	return this._selection;
}

/**
 * Focus the tree
 */
Panel.prototype.focus = function() {
	this._dom.tree.focus();
}

/**
 * Focus the path extbox
 */
Panel.prototype.focusPath = function() {
	this._dom.path.focus();
	this._dom.path.select();
}

/**
 * Get currently selected item
 */
Panel.prototype.getItem = function() {
	var index = this._dom.tree.currentIndex;
	if (index == -1) { return null; }
	return this._items[index];
}

/**
 * Get all current items
 */
Panel.prototype.getItems = function() {
	return this._items;
}

Panel.prototype.getComputedSizes = function() {
	return this._computedSizes;
}

/**
 * Start quickediting current item
 */
Panel.prototype.startEditing = function() {
	var item = this.getItem();
	if (!item || !item.supports(FC.RENAME)) { return; }
	this._editing = true; /* necessary to prevent double execution of setCellText */
	this._dom.tree.startEditing(this._dom.tree.currentIndex, this._dom.tree.columns[0]);
}

/**
 * Quickedit end
 * @param {int} row Row index
 * @param {string} text New value
 */
Panel.prototype.stopEditing = function(row, text) { 
	if (!this._editing) { return; } /* to prevent second execution */
	this._editing = false;
	
	var item = this._items[row];
	var newFile = this._path.append(text);
	
	var data = _("rename.exists", newFile.getPath());
	var title = _("rename.title");
	if (newFile.exists() && !this._fc.showConfirm(data, title)) { return; }
	
	try {
		item.rename(text);
		this.resync(newFile);
	} catch (e) {
		var data = _("error.rename", item.getPath(), newFile.getPath());
		this._fc.showAlert(data);
	}
}

/**
 * Resync the view, maintaining focus. If specified, focus a given path.
 * @param {null || Path} focusedPath Try to focus this path. If null, focus current item.
 * @param {int} focusedIndex If the focused path cannot be found, focus this index.
 */
Panel.prototype.resync = function(focusedPath, focusedIndex) {
	var oldIndex = this._dom.tree.currentIndex; /* store original index */
	var oldItem = this.getItem(); /* store original item */

	/* path disappeared - walk up */
	while (!this._path.exists() && this._path.getParent) { this._path = this._path.getParent(); }

	var items = [];
	try {
		items = this._path.getItems();
	} catch (e) {
		this._fc.showAlert(_("error.nochildren", this._path.getPath()));
	}

	this._items = items;
	this._selection.selectionClear();
	var parent = this._path.getParent();
	if (parent) { this._items.push(new Path.Up(parent)); } /* .. */
	
	this._sort();
	this.redraw();
	
	if (!focusedPath) { focusedPath = oldItem; } /* try same item */
	if (!focusedPath) { return; } /* no item available */
	var ok = this._focusItem(focusedPath);
	
	if (!ok) { /* cannot focus this item! */
		var index = (arguments.length < 2 ? oldIndex : 0);
		index = Math.min(index, this._items.length-1);
		if (index == -1) { return; } /* nothing to focus */
		this._dom.tree.currentIndex = index;
	}
}

/**
 * Redraw, maintain focused index
 */
Panel.prototype.redraw = function(index) {
	if (arguments.length) {
		this._dom.treebox.invalidateRow(index);
	} else {
		var index = this._dom.tree.currentIndex;
		this._dom.treebox.rowCountChanged(0, -this._view.rowCount);
		this._view.rowCount = this._items.length;
		this._dom.treebox.rowCountChanged(0, this._view.rowCount);
		if (index >= this._items.length) { index = this._items.length-1; }
		this._dom.tree.currentIndex = index;
	}
	
	this._updateStatus();
}

Panel.prototype.destroy = function() {
	this._selection.selectionClear();
	this._ec.forEach(Events.remove, Events);
}

Panel.prototype.setTreebox = function(treebox) {
	this._dom.treebox = treebox; 
}

Panel.prototype.formatSize = function(size) {
	return size.toString().replace(/(\d{1,3})(?=(\d{3})+(?!\d))/g, "$1 ");
}

/**
 * Adjust header to reflect correct sorting
 */
Panel.prototype._syncHeader = function() {
	var cols = this._dom.tree.getElementsByTagName("treecol");
	for (var i=0;i<cols.length;i++) {
		var col = cols[i];
		if (i == this._sortData.column) {
			col.setAttribute("sortDirection", this._sortData.order == Panel.ASC ? "ascending" : "descending");
		} else {
			col.setAttribute("sortDirection", "natural");
		}
	}
}

Panel.prototype._sort = function() {
	var coef = this._sortData.order;
	var col = this._sortData.column;
	var fc = this._fc;

	this._items.sort(function(a, b) {
		var as = a.getSort();
		var bs = b.getSort();
		if (as != bs) { return as - bs; } /* compare only dir<->dir or file<->file */
		
		switch (col) {
			case Panel.NAME:
				var an = a.getName();
				var bn = b.getName();
				return coef * an.localeCompare(bn);
			break;
			
			case Panel.EXT:
				var ae = fc.getExtension(a);
				var be = fc.getExtension(b);
				return coef * ae.localeCompare(be);
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
 * Tree focus - notify parent
 */
Panel.prototype._focus = function(e) {
	this._dom.treebox.ensureRowIsVisible(this._dom.tree.currentIndex );
	this._updateStatus();

	var observerService = Cc["@mozilla.org/observer-service;1"].getService(Ci.nsIObserverService);
	observerService.notifyObservers(this, "panel-focus", this._id);
}

/**
 * Tree doubleclick
 */
Panel.prototype._dblclick = function(e) {
	var row = this._dom.treebox.getRowAt(e.clientX, e.clientY);
	if (row == -1) { return; }
	this._items[row].activate(this, this._fc);
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

Panel.prototype._toggleDown = function() {
	this._selection.selectionToggle();
	var index = this._dom.tree.currentIndex;
	if (index+1 < this._items.length) { this._dom.tree.currentIndex = index+1; }
}

Panel.prototype._keydown = function(e) {
	switch (e.keyCode) {
		case 13: /* enter */
			if (this._dom.tree.editingRow != -1) { return; }
			var item = this.getItem();
			if (item) { item.activate(this, this._fc); }
		break;
		
		case 106: /* num asterisk */
			this._selection.selectionInvert();
		break;
		
		case 32: /* space */
			var item = this.getItem();
			if (!item) { return; }
			
			if (this._selection.selectionContains(item)) {
				this._toggleDown();
				return;
			}
			
			var done = function(result) {
				if (!result) { return; }
				this._computedSizes[item.getPath()] = result.size;
				this._toggleDown();
			}
			new Operation.Scan(this._fc, item, done.bind(this));
		break;
		
		case 45: /* insert */
			this._toggleDown();
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
					var text = _("fav.text", path, ch);
					var title = _("fav.title");
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
	this._updateStatus();
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

/**
 * @returns {bool} was item focused?
 */
Panel.prototype._focusItem = function(item) {
	for (var i=0;i<this._items.length;i++) {
		var path = this._items[i];
		if (item.equals(path)) { 
			this._dom.tree.currentIndex = i; 
			this._dom.treebox.ensureRowIsVisible(i);
			this._updateStatus();
			return true;
		}
	}
	return false;
}

/**
 * Resync statusbar
 */
Panel.prototype._updateStatus = function() {
	var status = "";
	var item = (this.getSelection().getItems().length ? this._selection : this.getItem());
	if (item) { status = item.getDescription(); }
	this._fc.setStatus(status);
}

