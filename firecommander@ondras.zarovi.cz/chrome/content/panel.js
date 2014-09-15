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

	this._dom.tab.addEventListener("focus", this); /* clicking this tab when active does not focus the tree - do it manually */
	this._dom.tree.addEventListener("focus", this); /* notify owner when our tree is focused */
	this._dom.tree.addEventListener("dblclick", this);
	this._dom.tree.addEventListener("keypress", this);
	this._dom.tree.addEventListener("keydown", this);
	this._dom.tree.addEventListener("select", this);
	this._dom.path.addEventListener("change", this);
	
	this._dom.tree.view = this._view;
};

Panel.tree	= null;
Panel.ASC	= 1;
Panel.DESC	= -1;

Panel.NAME	= 0;
Panel.DATA	= 1; 
Panel.SIZE	= 2; 
Panel.TS	= 3;
Panel.ATTR	= 4;
Panel.EXT	= 5;

Panel.prototype.handleEvent = function(e) {
	switch (e.type) {
		case "focus":
			if (e.target == this._dom.tab) {
				this.focus();
				return;
			}

			/* notify parent */
			this._dom.treebox.ensureRowIsVisible(this._dom.tree.currentIndex);
			this._updateStatus();
			Cc["@mozilla.org/observer-service;1"].getService(Ci.nsIObserverService).notifyObservers(this, "panel-focus", this._id);
		break;

		case "dblclick":
			var row = this._dom.treebox.getRowAt(e.clientX, e.clientY);
			if (row == -1) { return; }
			this._items[row].activate(this, this._fc);
		break;

		case "keypress":
			if (this._editing) { return; }
			var ch = String.fromCharCode(e.charCode).toUpperCase(); /* shift + drive */
			if (ch.match(/[A-Z]/) && e.shiftKey && !e.ctrlKey) {
				try {
					var path = Path.Local.fromString(ch+":");
					if (path.exists()) { this.setPath(path); }
				} catch (e) {}
			} else if (ch == "A" && e.ctrlKey) {
				this._selection.selectionAll();
			} else if (ch == "+") {
				this._selection.selectionAdd();
			} else if (ch == "-") {
				this._selection.selectionRemove();
			}
		break;

		case "keydown": this._keydown(e); break;
		case "select": this._updateStatus(); break;

		case "change":
			var value = this._dom.path.value;
			if (!value) { return; }
			this.setPath(value);
			this.focus();
		break;

	}
}

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

		var home = Path.Local.fromShortcut("Home");
		if (!this._path && home.exists()) { this.setPath(home); }
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

	this._syncColumns(path.getColumns()); /* which columns are visible now? */
	
	this._dom.tab.label = path.getName() || path.getPath();
	this._dom.path.value = path.getPath();

	this._selection.selectionClear();
	this.resync(focusedPath, 0);

	Cc["@mozilla.org/observer-service;1"].getService(Ci.nsIObserverService).notifyObservers(this, "panel-change", null);
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

	/*
	Trick: when stopEditing was called after hitting Enter, the keydown event will be dispatched immediately.
	We do not want to handle the Event, so let's delay unlocking this._editing for a while.
	*/
	setTimeout(function() { 
		this._editing = false;
	}.bind(this), 0);
	
	var item = this._items[row];
	if (item.getName() == text) { return; } /* no change */

	var newFile = this._path.append(text);
	
	var data = _("rename.exists", newFile.getPath());
	var title = _("rename.title");
	if (newFile.exists() && !this._fc.showConfirm(data, title)) { return; }
	
	try {
		item.rename(text);
		this.resync(newFile);
	} catch (e) {
		var data = _("error.rename", item.getPath(), newFile.getPath(), e.message);
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
		FC.log(e);
		this._fc.showAlert(_("error.nochildren", this._path.getPath()));
	}

	this._items = [];
	for (var i=0;i<items.length;i++) { this._items.push(items[i]); }

	var parent = this._path.getParent();
	if (parent) { this._items.push(new Path.Up(parent)); } /* .. */
	
	var selected = this._selection.getItems(); /* remove non-existant selected */
	for (var i=0;i<selected.length;i++) {
		if (!selected[i].exists()) {
			selected.splice(i, 1);
			i--;
		}
	}

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
	this._dom.tab.removeEventListener("focus", this);
	this._dom.tree.removeEventListener("focus", this);
	this._dom.tree.removeEventListener("dblclick", this);
	this._dom.tree.removeEventListener("keypress", this);
	this._dom.tree.removeEventListener("keydown", this);
	this._dom.tree.removeEventListener("select", this);
	this._dom.path.removeEventListener("change", this);
}

Panel.prototype.setTreebox = function(treebox) {
	this._dom.treebox = treebox; 
}

/**
 * Adjust header to reflect correct sorting
 */
Panel.prototype._syncHeader = function() {
	var cols = this._dom.tree.querySelectorAll("treecol");
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
	
	var fixedLocaleCompare = function(a, b) {
		for (var i=0;i<Math.max(a.length, b.length);i++) {
			if (i >= a.length) { return -1; } /* a shorter */
			if (i >= b.length) { return  1; } /* b shorter */
			
			var ch1 = a.charAt(i);
			var ch2 = b.charAt(i);
			var c1 = ch1.charCodeAt(0);
			var c2 = ch2.charCodeAt(0);
			
			var special1 = (c1 < 128 && !ch1.match(/a-z/i)); /* non-letter char in a */
			var special2 = (c2 < 128 && !ch2.match(/a-z/i)); /* non-letter char in b */
			
			if (special1 != special2) { return (special1 ? -1 : 1); } /* one has special, second does not */
			
			var r = ch1.localeCompare(ch2); /* locale compare these two normal letters */
			if (r) { return r; }
		}

		return 0; /* same length, same normal/special positions, same localeCompared normal chars */
	}

	this._items.sort(function(a, b) {
		var as = a.getSort();
		var bs = b.getSort();
		if (as != bs) { return as - bs; } /* compare only dir<->dir or file<->file */
		
		switch (col) {
			case Panel.NAME:
				var an = a.getName();
				var bn = b.getName();
				return coef * fixedLocaleCompare(an, bn);
			break;
			
			case Panel.DATA:
				var ad = a.getData();
				var bd = b.getData();
				return coef * fixedLocaleCompare(ad, bd);
			break;

			case Panel.EXT:
				var ae = fc.getExtension(a);
				var be = fc.getExtension(b);
				return coef * ae.localeCompare(be);
			break;
			
			case Panel.SIZE:
				var as = a.getSize();
				var bs = b.getSize();
				if (as == bs) { return coef * fixedLocaleCompare(a.getName(), b.getName()); }
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

Panel.prototype._toggleDown = function() {
	this._selection.selectionToggle();
	var index = this._dom.tree.currentIndex;
	if (index+1 < this._items.length) {
		this._dom.tree.currentIndex = index+1;
		this._dom.treebox.ensureRowIsVisible(this._dom.tree.currentIndex);
	}
}

Panel.prototype._keydown = function(e) {
	if (this._editing) {
		if (e.keyCode == 27) { this._editing = false; } /* esc pressed, value not changed */
		return;
	}

	switch (e.keyCode) {
		case 13: /* enter */
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
			
			new Operation.Scan(item).run().then(function(result) {
				if (!result) { return; }
				this._computedSizes[item.getPath()] = result.size;
				this._toggleDown();
			}.bind(this));
		break;
		
		case 45: /* insert */
			this._toggleDown();
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
					if (result) { FC.setPreference(prefName, path); }
				} else { /* load favorite */
					var path = FC.getPreference(prefName);
					if (path) { this.setPath(path); }
				}
			}
		break;
	}
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

/**
 * Update column visibility
 */
Panel.prototype._syncColumns = function(columns) {
	var cols = this._dom.tree.querySelectorAll("treecol");
	for (var i=0;i<cols.length;i++) {
		var col = cols[i];
		var visible = columns[i];
		col.hidden = !visible;
	}
}
