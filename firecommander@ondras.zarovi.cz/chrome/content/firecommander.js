const LEFT = 0;
const RIGHT = 1;

var FC = function() {
	this._ec = [];
	this._panels = {};
	this._activeSide = null;
	this._tabbox = {};
	this._progress = null;
	this._strings = $("strings");
	this._handlers = {};
	
	this._RETRY = 0;
	this._OVERWRITE = 1;
	this._OVERWRITE_ALL = 2;
	this._SKIP = 3;
	this._SKIP_ALL = 4;
	this._ABORT = 5;

	this._stateNames = {};
	this._stateNames[LEFT] = "left";
	this._stateNames[RIGHT] = "right";

	this._init();
}

FC.log = function(text) {
	Cc["@mozilla.org/consoleservice;1"].getService(Ci.nsIConsoleService).logStringMessage(text);
}

FC.prototype._init = function() {
	var observerService = Cc["@mozilla.org/observer-service;1"].getService(Ci.nsIObserverService);
	observerService.addObserver(this, "panel-focus", false);

	this._initDOM();
	this._initHandlers();
	this._initCommands();
	this._initPanels();
}

FC.prototype._initDOM = function() {
	Panel.tree = $("tree");
	Panel.tree.id = "";
	Panel.tree.parentNode.removeChild(Panel.tree);

	var map = {};
	map[LEFT] = "left";
	map[RIGHT] = "right";
	for (var side in map) {
		var tabbox = $(map[side]);
		this._tabbox[side] = tabbox;
		this._panels[side] = [];
		tabbox.tabs.addEventListener("select", this._select.bind(this), false);
		tabbox.addEventListener("keydown", this._keyDown.bind(this), false);
	}
	
	window.addEventListener("unload", this._destroy.bind(this), false);
}

FC.prototype._initHandlers = function() {
	this.addHandler("drives", Path.Drives.fromString.bind(Path.Drives));
}

FC.prototype._initCommands = function() {
	this._bindCommand("quickrename", this.cmdQuickRename);
	this._bindCommand("newtab", this.cmdNewTab);
	this._bindCommand("closetab", this.cmdCloseTab);
	this._bindCommand("about", this.cmdAbout);
	this._bindCommand("up", this.cmdUp);
	this._bindCommand("top", this.cmdTop);
	this._bindCommand("exit", this.cmdExit);
	this._bindCommand("delete", this.cmdDelete);
	this._bindCommand("options", this.cmdOptions);
	this._bindCommand("edit", this.cmdEdit);
	this._bindCommand("focuspath", this.cmdFocusPath);

	try {
		var tmp = new Path.Drives();
		this._bindCommand("drives", this.cmdDrives);
	} catch (e) {
		$("cmd_drives").setAttribute("disabled", "true");
	}
}

FC.prototype._initPanels = function() {
	for (var p in this._stateNames) {
		var pref = "state."+this._stateNames[p];
		var value = this.getPreference(pref);
		
		try {
			var arr = JSON.parse(value);
			for (var i=0;i<arr.length;i++) {
				var name = arr[i];
				var path = this.getHandler(name);
				if (path) { this.addPanel(p, path); }
			}
		} catch (e) {}
		
		
		if (this._panels[p].length == 0) { this.addPanel(p, Path.Local.fromShortcut("Home")); }
	}

	this.getActivePanel(LEFT).focus();
}

FC.prototype._bindCommand = function(id, method) {
	$("cmd_" + id).addEventListener("command", method.bind(this), false);
}

/* nsIObserver method */
FC.prototype.observe = function(subject, topic, data) {
	switch (topic) {
		case "panel-focus":
			var panel = subject.wrappedJSObject;
			this._activeSide = (this._panels[LEFT].indexOf(panel) != -1 ? LEFT: RIGHT);
		break;
	}
}

/* command methods */

FC.prototype.cmdQuickRename = function() {
	this.getActivePanel().startEditing();
}

FC.prototype.cmdNewTab = function() {
	var path = this.getActivePanel().getPath();
	this.addPanel(this._activeSide, path);
}

FC.prototype.cmdCloseTab = function() {
	var tabbox = this._tabbox[this._activeSide];
	var tabs = tabbox.tabs;
	var tabpanels = tabbox.tabpanels;

	if (tabs.itemCount == 1) { return; } /* cannot close last tab */
	var index = tabs.selectedIndex;
	var tmpIndex = (index+1 == tabs.itemCount ? index-1 : index+1);
	var newIndex = (index+1 == tabs.itemCount ? index-1 : index);
	tabbox.selectedIndex = tmpIndex;
	
	this._panels[this._activeSide].splice(index, 1);
	tabs.removeItemAt(index);
	tabpanels.removeChild(tabpanels.children[index]);

	tabbox.selectedIndex = newIndex;
}

FC.prototype.cmdAbout = function() {
	var exts = Cc["@mozilla.org/extensions/manager;1"].getService(Ci.nsIExtensionManager);
	var ext = exts.getItemForID("firecommander@ondras.zarovi.cz");
	var version = ext.version;
	window.openDialog("chrome://firecommander/content/about.xul", "", "centerscreen,modal,chrome", version);
}

FC.prototype.cmdUp = function() {
	var panel = this.getActivePanel();
	var path = panel.getPath();
	var parent = path.getParent();
	if (parent) { panel.setPath(parent); }
}

FC.prototype.cmdTop = function() {
	var panel = this.getActivePanel();
	var path = panel.getPath();
	var parent = path.getParent();
	
	if (!parent) { return; } /* toplevel */
	if (parent.getPath() == path.getPath()) { return; } /* / */
	
	while (parent.getParent()) { parent = parent.getParent(); }
	panel.setPath(parent);
}

FC.prototype.cmdDrives = function() {
	try {
		var drives = new Path.Drives();
		this.getActivePanel().setPath(drives);
	} catch (e) {}
}

FC.prototype.cmdExit = function() {
	window.close();
}

FC.prototype.cmdFocusPath = function() {
	this.getActivePanel().focusPath();
}

FC.prototype.cmdDelete = function() {
	var panel = this.getActivePanel(); 
	var item = panel.getItem();
	if (!item || item.isSpecial()) { return; }
	
	var text = this.getText("delete.confirm", item.getPath());
	var title = this.getText("delete.title");
	if (!this.showConfirm(text, title)) { return; }
	
	var data = {
		title: this.getText("delete.title"),
		row1: [this.getText("delete.deleting"), item.getPath()],
		row2: ["", ""],
		progress1: this.getText("progress.total"),
		progress2: null
	}
	var top = this._buildTree(item);
	this.showProgress(data);
	
	var totalCount = top.count;
	var doneCount = 0;
	var skipMode = false;
	var deleteItem = function(node) {
		var done = false;
		var result = true;
		do {
			try {
				node.path.delete();
				done = true;
			} catch (e) {
				if (skipMode) {
					done = true;
				} else {
					var result = this.showIssue(e, node.path);
					switch(result) {
						case this._RETRY: 
						break;
						case this._SKIP: 
							done = true;
						break;
						case this._SKIP_ALL: 
							done = true;
						break;
						case this._ABORT: 
							result = false;
							done = true;
						break;
					} /* switch */
				} /* not skipping */
			} /* catch */
		} while (!done);
		
		doneCount++;
		this.updateProgress(doneCount / totalCount * 100, null);
		return result;
	} /* recursive callback */

	this._recurse(top, deleteItem.bind(this));
	this.hideProgress();
	panel.refresh();
}

FC.prototype.cmdOptions = function() {
	window.openDialog("chrome://firecommander/content/options.xul", "", "chrome,toolbar,centerscreen,modal");
}

FC.prototype.cmdEdit = function() {
	var item = this.getActivePanel().getItem();
	if (!item || item.isSpecial()) { return; }

	var editor = this.getPreference("editor");
	try {
		var path = Path.Local.fromString(editor);
		if (!path.exists()) { throw Cr.NS_ERROR_FILE_NOT_FOUND; }
	} catch (e) {
		this.showAlert(this.getText("error.editor", editor));
		return;
	}
	
	var process = Cc["@mozilla.org/process/util;1"].createInstance(Ci.nsIProcess);
	process.init(path.getFile());
	process.run(false, [item.getPath()], 1);
}

/* additional methods */

/**
 * Show the "retry, skip, overwrite, abort" dialog
 */
FC.prototype.showIssue = function(error, path) {
	/* fixme */
	return this._ABORT;
}

FC.prototype.showConfirm = function(text, title) {
	var ps = Cc["@mozilla.org/embedcomp/prompt-service;1"].getService(Ci.nsIPromptService);
	return ps.confirm(null, title, text);
}

FC.prototype.showAlert = function(text, title) {
	var ps = Cc["@mozilla.org/embedcomp/prompt-service;1"].getService(Ci.nsIPromptService);
	return ps.alert(null, title || this.getText("error"), text);
}

FC.prototype.showProgress = function(data) {
	this._progress = window.openDialog("chrome://firecommander/content/progress.xul", "", "chrome,centerscreen");
	this._progress.addEventListener("load", (function(e){
		if (!this._progress) { return; }

		var doc = this._progress.document;
		doc.title = data.title;
		doc.getElementById("progress1").value = 0;
		doc.getElementById("progress2").value = 0;

		if (data.row1) {
			doc.getElementById("row1-label").value = data.row1[0];
			doc.getElementById("row1-value").value = data.row1[1];
		}

		if (data.row2) {
			doc.getElementById("row2-label").value = data.row2[0];
			doc.getElementById("row2-value").value = data.row2[1];
		}

		if (data.progress1) {
			doc.getElementById("progress1-label").value = data.progress1;
			doc.getElementById("progress1").style.display = "";
		} else {
			doc.getElementById("progress1-label").value = "";
			doc.getElementById("progress1").style.display = "none";
		}

		if (data.progress2) {
			doc.getElementById("progress2-label").value = data.progress2;
			doc.getElementById("progress2").style.display = "";
		} else {
			doc.getElementById("progress2-label").value = "";
			doc.getElementById("progress2").style.display = "none";
		}
		
		this._progress.sizeToContent();
	}).bind(this), false);
}

FC.prototype.hideProgress = function() {
	this._progress.close();
	this._progress = null;
}

FC.prototype.updateProgress = function(value1, value2) {
	if (this._progress.document.readyState != "complete") { return; }
	
	var doc = this._progress.document;
	if (value1 !== null) { doc.getElementById("progress1").value = value1; }
	if (value2 !== null) { doc.getElementById("progress2").value = value2; }
}

FC.prototype.addPanel = function(side, path) {
	var tabs = this._tabbox[side].tabs;
	var tabpanels = this._tabbox[side].tabpanels;
	
	/* create tab, append tree clone */
	var tab = document.createElement("tab");
	var tabpanel = document.createElement("tabpanel");
	tabpanel.orient = "vertical";
	tabs.appendChild(tab);
	tabpanels.appendChild(tabpanel);

	/* panel */
	var panel = new Panel(this, tabpanel, tab);
	this._panels[side].push(panel);
	panel.setPath(path);

	/* bring to front */
	this._tabbox[side].selectedIndex = this._panels[side].length-1;
}

FC.prototype.addHandler = function(protocol, handler) {
	this._handlers[protocol] = handler;
}

/**
 * @throws malformed url
 */
FC.prototype.getHandler = function(url) {
	var r = url.match(/^([a-z0-9]+):\/\/(.*)/);
	try {
		if (r) {
			var protocol = r[1];
			var value = r[2];
			if (protocol in this._handlers) {
				return this._handlers[protocol](value);
			} else {
				this.showAlert(this.getText("error.nohandler", protocol));
				return null;
			}
		} else {
			return Path.Local.fromString(url);
		}
	} catch (e) {
		this.showAlert(this.getText("error.badpath", value));
		return null;
	}
}

FC.prototype.getPreference = function(name) {
	var branch = Cc["@mozilla.org/preferences-service;1"].getService(Ci.nsIPrefService).getBranch("extensions.firecommander.");
	var type = branch.getPrefType(name);
	switch (type) {
		case branch.PREF_STRING:
			return branch.getCharPref(name);
		break;
		case branch.PREF_INT:
			return branch.getIntPref(name);
		break;
		case branch.PREF_BOOL:
			return branch.getBoolPref(name);
		break;
		default:
			return null;
		break;
	}
}

FC.prototype.setPreference = function(name, value) {
	var branch = Cc["@mozilla.org/preferences-service;1"].getService(Ci.nsIPrefService).getBranch("extensions.firecommander.");
	switch (typeof(value)) {
		case "string":
			branch.setCharPref(name, value);
		break;
		case "number":
			branch.setIntPref(name, value);
		break;
		case "boolean":
			branch.setBoolPref(name, value);
		break;
		default:
			branch.setCharPref(name, JSON.stringify(value));
		break;
	}
}

/**
 * Get active panel on a given side. If no side is specified, the currently focused one is used
 */
FC.prototype.getActivePanel = function(side) {
	var s = (arguments.length ? side : this._activeSide);
	return this._panels[s][this._tabbox[s].selectedIndex];
}

FC.prototype.getActiveSide = function() {
	return this._activeSide;
}

FC.prototype.getText = function(key) {
	if (arguments.length > 1) {
		var arr = [];
		for (var i=1;i<arguments.length;i++) { arr.push(arguments[i]); }
		return this._strings.getFormattedString(key, arr);
	} else {
		return this._strings.getString(key);
	}
}

/**
 * Tab change. This sometimes does not focus the relevant tree, so we must do it manually.
 */
FC.prototype._select = function(e) {
	var index = e.target.selectedIndex;
	var side = (e.target.parentNode == this._tabbox[LEFT] ? LEFT : RIGHT);
	this._panels[side][index].focus();
}

/**
 * Handle keydown on tabpanels
 */
FC.prototype._keyDown = function(e) {
	if (e.keyCode == 9 && !e.ctrlKey) {
		/* to other panel */
		e.preventDefault();
		var side = (this._activeSide + 1) % 2;
		var panel = this.getActivePanel(side);
		panel.focus();
	}
}

FC.prototype._destroy = function(e) {
	for (var p in this._stateNames) {
		var pref = "state."+this._stateNames[p];
		var arr = [];
		for (var i=0;i<this._panels[p].length;i++) {
			var panel = this._panels[p][i];
			arr.push(panel.getPath().getPath());
		}
		this.setPreference(pref, arr);
	}
}

/**
 * Create a tree of paths
 */ 
FC.prototype._buildTree = function(root) {
	var result = {path:root,children:[],count:1};
	var items = root.getItems();
	if (!items) { return result; }
	
	for (var i=0;i<items.length;i++) {
		var item = items[i];
		var child = arguments.callee.call(this, item);
		result.children.push(child);
		result.count += child.count;
	}
	return result;
}

/**
 * Helper for recursive operations
 */
FC.prototype._recurse = function(node, callback) {
	for (var i=0;i<node.children.length;i++) { /* first do this with children */
		var result = arguments.callee(node.children[i], callback);
		if (!result) { return false; }
	}
	
	/* process this (leaf) node */
	return callback(node);
}

/***/

Events.addListener(window, "load", function(){new FC();});
