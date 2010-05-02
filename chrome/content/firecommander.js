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
	this._panels = {};
	this._activeSide = null;
	this._tabbox = {};

	this._init();
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
	this.addPanel(RIGHT, new Path.Drives());

	this._tabbox[LEFT].selectedIndex = 0;
}

FC.prototype._initCommands = function() {
	this._bindCommand("quickrename", this.cmdQuickRename);
	this._bindCommand("newtab", this.cmdNewTab);
	this._bindCommand("closetab", this.cmdCloseTab);
	this._bindCommand("about", this.cmdAbout);
	this._bindCommand("up", this.cmdUp);
	this._bindCommand("top", this.cmdTop);
	this._bindCommand("drives", this.cmdDrives);
	this._bindCommand("exit", this.cmdExit);
}

FC.prototype._bindCommand = function(id, method) {
	$("cmd_" + id).addEventListener("command", method.bind(this), false);
}


/* nsIObserver method */
FC.prototype.observe = function(subject, topic, data) {
	switch (topic) {
		case "panel-focus":
			this._activeSide = RIGHT;
			for (var i=0;i<this._panels[LEFT].length;i++) {
				if (this._panels[LEFT][i].getID() == data) { this._activeSide = LEFT; }
			}
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
	window.openDialog("chrome://firecommander/content/about.xul", "", "centerscreen,modal");
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
	this.getActivePanel().setPath(new Path.Drives());
}

FC.prototype.cmdExit = function() {
	window.close();
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
