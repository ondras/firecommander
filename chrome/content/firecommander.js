const Cc = Components.classes;
const Ci = Components.interfaces;
const Cr = Components.results;

const LEFT = 0;
const RIGHT = 1;

const ASC = 1;
const DESC = -1;

const NAME = 0;
const SIZE = 1;
const DATE = 2;
const TIME = 3;
const ATTR = 4;

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
	this._dom = {};

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
		this._dom[side] = tabbox;
		this._panels[side] = [];
		var tabs = tabbox.getElementsByTagName("tabs")[0];
		tabs.addEventListener("select", this._select.bind(this), false);
		tabbox.addEventListener("keydown", this._keyDown.bind(this), false);
	}
}

FC.prototype._initPanels = function() {
	var t = this.addPanel(LEFT);
	var s = t.setSource(LocalSource);
	var ds = Cc["@mozilla.org/file/directory_service;1"].getService(Ci.nsIProperties);
	s.setPath(ds.get("Home", Components.interfaces.nsIFile).path);

	var t = this.addPanel(LEFT);
	var s = t.setSource(LocalSource);
	s.setPath("e:\\");
	
	var t = this.addPanel(LEFT);
	var s = t.setSource(LocalSource);
	s.setPath("c:\\");

	var t = this.addPanel(RIGHT);
	var s = t.setSource(LocalSource);
	s.setPath("d:\\");
}

FC.prototype._initCommands = function() {
	$("cmd_quickrename").addEventListener("command", (function(){this.getActivePanel().startEditing();}).bind(this), false);
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

FC.prototype.addPanel = function(side) {
	var tabs = this._dom[side].getElementsByTagName("tabs")[0];
	var tabpanels = this._dom[side].getElementsByTagName("tabpanels")[0];
	
	var tab = document.createElement("tab");
	var tabpanel = document.createElement("tabpanel");
	tabpanel.orient = "vertical";
	tabs.appendChild(tab);
	tabpanels.appendChild(tabpanel);

	var panel = new Panel(this, tabpanel, tab);
	this._panels[side].push(panel);

	tabs.selectedItem = tab;
	return panel;
}

/**
 * Get active panel on a given side. If no side is specified, the currently focused one is used
 */
FC.prototype.getActivePanel = function(side) {
	var s = (arguments.length ? side : this._activeSide);
	return this._panels[s][this._dom[s].selectedIndex];
}

FC.prototype.getActiveSide = function() {
	return this._activeSide;
}

/**
 * Tab change. This sometimes does not focus the relevant tree, so we must do it manually.
 */
FC.prototype._select = function(e) {
	var index = e.target.selectedIndex;
	var side = (e.target.parentNode == this._dom[LEFT] ? LEFT : RIGHT);
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
