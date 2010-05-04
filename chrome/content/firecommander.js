const Cc = Components.classes;
const Ci = Components.interfaces;
const Cr = Components.results;

const LEFT = 0;
const RIGHT = 1;

Function.prototype.bind = function(context) {
	var t = this;
	return function() { return t.apply(context, arguments); }
}

Object.create = function(proto) {
	var f = function() {};
	f.prototype = proto;
	return new f();
}

var $ = function(id) { return document.getElementById(id); }

/***/

var FC = function() {
	window.fc = this;
	
	this._panels = {};
	this._activeSide = null;
	this._tabbox = {};
	this._progress = null;
	this._locale = $("strings");
	
	this._init();
}

FC.log = function(text) {
	Cc["@mozilla.org/consoleservice;1"].getService(Ci.nsIConsoleService).logStringMessage(text);
}

FC.prototype._init = function() {
	var observerService = Cc["@mozilla.org/observer-service;1"].getService(Ci.nsIObserverService);
	observerService.addObserver(this, "panel-focus", false);

	this._initDOM();
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
}

FC.prototype._initPanels = function() {
	this.addPanel(LEFT, Path.Local.fromShortcut("Home"));
	this.addPanel(RIGHT, Path.Local.fromShortcut("Home"));

	this._tabbox[LEFT].selectedIndex = 0;
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

	try {
		var tmp = new Path.Drives();
		this._bindCommand("drives", this.cmdDrives);
	} catch (e) {
		$("cmd_drives").setAttribute("disabled", "true");
	}
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
	} catch (e) {
		return;
	}
	this.getActivePanel().setPath(drives);
}

FC.prototype.cmdExit = function() {
	window.close();
}

FC.prototype.cmdDelete = function() {
	var panel = this.getActivePanel(); 
	var item = panel.getItem();
	if (!item || item.isSpecial()) { return; }
	
	var text = this.getText("delete.confirm", item.getPath());
	var title = this.getText("delete.title");
	
	if (!this.showConfirm(text, title)) { return; }
	item.delete(panel, this);
}

FC.prototype.cmdOptions = function() {
	window.openDialog("chrome://firecommander/content/options.xul", "", "chrome,toolbar,centerscreen,modal");
}

FC.prototype.cmdEdit = function() {
	var item = this.getActivePanel().getItem();
	if (!item || item.isSpecial()) { return; }
	
	var editor = this.getPreference("editor");
	try {
		var file = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsILocalFile);
		file.initWithPath(editor);
		if (!file.exists()) { 
			var err = {
				name: "NS_ERROR_FILE_NOT_FOUND",
				result: Cr.NS_ERROR_FILE_NOT_FOUND
				};
			throw err; 
		}
	} catch(e) {
		alert(e.name);
		return;
	}
	
	var process = Cc["@mozilla.org/process/util;1"].createInstance(Ci.nsIProcess);
	process.init(file);
	process.run(false, [item.getPath()], 1);
}

/* additional methods */

FC.prototype.showConfirm = function(text, title) {
	var ps = Cc["@mozilla.org/embedcomp/prompt-service;1"].getService(Ci.nsIPromptService);
	return ps.confirm(null, title, text);
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
	doc.getElementById("progress1").value = value1 || 0;
	doc.getElementById("progress2").value = value2 || 0;
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
		return this._locale.getFormattedString(key, arr);
	} else {
		return this._locale.getString(key);
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

/***/

window.addEventListener("load", function(){new FC();}, false);
