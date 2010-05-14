var FC = function() {
	this._ec = [];
	this._panels = {};
	this._activeSide = null;
	this._tabbox = {};
	this._progress = null;
	this._strings = $("strings");
	this._handlers = {};
	this._status = document.getElementsByTagName("statusbarpanel")[0];
	
	this._init();
}

FC.LEFT = 0;
FC.RIGHT = 1;

FC.CHILDREN = 0;	/* listing subitems */
FC.DELETE = 1;		/* deletion */
FC.RENAME = 2;		/* quick rename */
FC.VIEW = 3;		/* internal viewer */
FC.EDIT = 4;		/* external editor */
FC.COPY = 5;		/* copy from */

FC.log = function(text) {
	var wm = Cc["@mozilla.org/appshell/window-mediator;1"].getService(Ci.nsIWindowMediator);
	var browser = wm.getMostRecentWindow("navigator:browser");
	browser && browser.Firebug && browser.Firebug.Console.log(text);
}

FC._handlers = {
	protocol: {},
	extension: {},
	viewer: {}
};

/**
 * @param {string} protocol
 * @param {function} handler
 */
FC.addProtocolHandler = function(protocol, handler) {
	this._handlers.protocol[protocol] = handler;
}

/**
 * @param {string} extension
 * @param {function} viewer class
 */
FC.addViewerHandler = function(extension, handler) {
	this._handlers.viewer[extension] = handler;
}

FC.prototype._init = function() {
	var observerService = Cc["@mozilla.org/observer-service;1"].getService(Ci.nsIObserverService);
	observerService.addObserver(this, "panel-focus", false);

	this._initDOM();
	this._initCommands();
	this._loadState();
}

FC.prototype._initDOM = function() {
	Panel.tree = $("tree");
	Panel.tree.id = "";
	Panel.tree.parentNode.removeChild(Panel.tree);

	var map = {};
	map[FC.LEFT] = "left";
	map[FC.RIGHT] = "right";
	for (var side in map) {
		var tabbox = $(map[side]);
		this._tabbox[side] = tabbox;
		this._panels[side] = [];
		this._ec.push(Events.add(tabbox.tabs, "select", this._select.bind(this)));
		this._ec.push(Events.add(tabbox, "keydown", this._keyDown.bind(this)));
	}
	
	this._ec.push(Events.add($("splitter"), "dblclick", this._resetSplitter.bind(this)));
	this._ec.push(Events.add(window, "unload", this.destroy.bind(this)));
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
	this._bindCommand("createdirectory", this.cmdCreateDirectory);
	this._bindCommand("createfile", this.cmdCreateFile);
	this._bindCommand("favorites", this.cmdFavorites);
	this._bindCommand("copy", this.cmdCopy);
	this._bindCommand("move", this.cmdMove);
	this._bindCommand("view", this.cmdView);
	this._bindCommand("search", this.cmdSearch);

	try {
		var tmp = new Path.Drives();
		this._bindCommand("drives", this.cmdDrives);
	} catch (e) {
		$("cmd_drives").setAttribute("disabled", "true");
	}
}

FC.prototype._bindCommand = function(id, method) {
	var id = Events.add($("cmd_" + id), "command", method.bind(this));
	this._ec.push(id);
}

/* nsIObserver method */
FC.prototype.observe = function(subject, topic, data) {
	switch (topic) {
		case "panel-focus":
			var panel = subject.wrappedJSObject;
			this._activeSide = (this._panels[FC.LEFT].indexOf(panel) != -1 ? FC.LEFT: FC.RIGHT);
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
	
	this._panels[this._activeSide][index].destroy();
	this._panels[this._activeSide].splice(index, 1);
	tabs.removeItemAt(index);
	tabpanels.removeChild(tabpanels.children[index]);

	tabbox.selectedIndex = newIndex;
}

FC.prototype.cmdAbout = function() {
	var exts = Cc["@mozilla.org/extensions/manager;1"].getService(Ci.nsIExtensionManager);
	var ext = exts.getItemForID("firecommander@ondras.zarovi.cz");
	var version = ext.version;
	window.openDialog("about/about.xul", "", "centerscreen,modal,chrome", version);
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

FC.prototype.cmdFavorites = function() {
	var fav = new Path.Favorites(this);
	this.getActivePanel().setPath(fav);
}

FC.prototype.cmdExit = function() {
	window.close();
}

FC.prototype.cmdFocusPath = function() {
	this.getActivePanel().focusPath();
}

FC.prototype.cmdDelete = function() {
	var panel = this.getActivePanel(); 
	var path = panel.getPath();
	var item = panel.getSelection() || panel.getItem();
	if (!item || !item.supports(FC.DELETE)) { return; }
	
	var text = this.getText("delete.confirm", item.getPath());
	var title = this.getText("delete.title");
	if (!this.showConfirm(text, title)) { return; }
	
	var done = function() { this._pathChanged(path); }
	new Operation.Delete(this, item, done.bind(this));
}

FC.prototype.cmdCopy = function() {
	this._cmdCopyMove(Operation.Copy, "copy");
}

FC.prototype.cmdMove = function() {
	this._cmdCopyMove(Operation.Move, "move");
}

FC.prototype._cmdCopyMove = function(ctor, name) {
	var activePanel = this.getActivePanel(); 
	var inactivePanel = this.getActivePanel(this.getInactiveSide());
	var activePath = activePanel.getPath();
	var inactivePath = inactivePanel.getPath();
	
	/* can we copy/move this item */
	var item = activePanel.getSelection() || activePanel.getItem();
	if (!item || !item.supports(FC.COPY)) { return; }
	
	/* let user adjust target path */
	var text = this.getText(name + ".confirm", item.getPath());
	var title = this.getText(name + ".title");
	var target = inactivePath.getPath();
	target = this.showPrompt(text, title, target);
	if (!target) { return; }
	
	/* can we handle target */
	target = this.getProtocolHandler(target);
	if (!target) { return; }
	
	/* does target exist? does it support children? */
	if (!target.exists() || !target.supports(FC.CHILDREN)) {
		this.showAlert(this.getText("error.badpath"));
		return;
	}
	
	/* FIXME check copying to itself */
	
	var done = function() { 
		this._pathChanged(activePath); 
		this._pathChanged(inactivePath); 
	}
	new ctor(this, item, target, done.bind(this));
}

FC.prototype.cmdView = function() {
	var panel = this.getActivePanel();
	var item = panel.getItem();
	if (!item || !item.supports(FC.VIEW)) { return; }
	
	var viewer = this.getViewerHandler(item);
	if (!viewer) { return new Viewer.Text(item, this); }
	
	new viewer(item, this);
}

FC.prototype.cmdOptions = function() {
	window.openDialog("options/options.xul", "", "chrome,toolbar,centerscreen,modal");
}

FC.prototype.cmdEdit = function() {
	var panel = this.getActivePanel(); 
	var item = panel.getItem();
	if (!item || !item.supports(FC.EDIT)) { return; }

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

FC.prototype.cmdCreateDirectory = function() {
	var panel = this.getActivePanel(); 
	var path = panel.getPath();
	if (!path.supports(FC.CHILDREN)) { return; }
	
	var text = this.getText("createdirectory.name", path.getPath());
	var title = this.getText("createdirectory.title");
	var name = this.showPrompt(text, title);
	if (!name) { return; }
	
	try {
		var newPath = path.append(name);
		newPath.create(true);
		panel.refresh(newPath);
	} catch (e) {
		var text = this.getText("error.create", name);
		this.showAlert(text);
	}
}

FC.prototype.cmdCreateFile = function() {
	var panel = this.getActivePanel(); 
	var path = panel.getPath();
	if (!path.supports(FC.CHILDREN)) { return; }
	
	var text = this.getText("createfile.name", path.getPath());
	var title = this.getText("createfile.title");
	var name = this.showPrompt(text, title, this.getPreference("newname"));
	if (!name) { return; }
	
	try {
		var newFile = path.append(name);
		newFile.create(false);
		panel.refresh(newFile);
		this.cmdEdit();
	} catch (e) {
		var text = this.getText("error.create", name);
		this.showAlert(text);
	}
	
}

FC.prototype.cmdSearch = function() {
	var panel = this.getActivePanel();
	var path = panel.getPath();
	var result = {
		result: null,
		term: "",
		path: path.getPath()
	}
	window.openDialog("search/search.xul", "", "chrome,modal,centerscreen", result);
	if (!result.result) { return; }
	
	delete(result.result);
	var str = "search://" + JSON.stringify(result);
	alert("not (yet) implemented");
}


/* additional methods */

FC.prototype.showPrompt = function(text, title, value) {
	var ps = Cc["@mozilla.org/embedcomp/prompt-service;1"].getService(Ci.nsIPromptService);
	var obj = {value:value || ""};
	var result = ps.prompt(null, title, text, obj, null, {value:false});
	return (result ? obj.value : null);
}

FC.prototype.showConfirm = function(text, title) {
	var ps = Cc["@mozilla.org/embedcomp/prompt-service;1"].getService(Ci.nsIPromptService);
	return ps.confirm(null, title, text);
}

FC.prototype.showAlert = function(text, title) {
	var ps = Cc["@mozilla.org/embedcomp/prompt-service;1"].getService(Ci.nsIPromptService);
	return ps.alert(null, title || this.getText("error"), text);
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
 * @returns {null || Path} null when no protocol handler is available
 */
FC.prototype.getProtocolHandler = function(url) {
	try {
		var r = url.match(/^([a-z0-9]+):\/\/(.*)/);
		if (r) {
			var protocol = r[1];
			url = r[2];
			if (protocol in FC._handlers.protocol) {
				return FC._handlers.protocol[protocol](url, this);
			} else {
				this.showAlert(this.getText("error.nohandler", protocol));
				return null;
			}
		} else {
			return Path.Local.fromString(url);
		}
	} catch (e) {
		this.showAlert(this.getText("error.badpath", url));
		return null;
	}
}

/**
 * @returns {null || Viewer} null when this extension cannot be handled
 */
FC.prototype.getViewerHandler = function(path) {
	var ext = path.getPath().match(/\.([^\.]+)$/);
	if (!ext) { return null; }
	ext = ext[1].toLowerCase();
	
	var h = FC._handlers.viewer[ext];
	return h || null;
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

FC.prototype.getInactiveSide = function() {
	return (this._activeSide == FC.LEFT ? FC.RIGHT : FC.LEFT);
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

FC.prototype.setStatus = function(text) {
	this._status.label = text;
}

/**
 * Tab change. This sometimes does not focus the relevant tree, so we must do it manually.
 */
FC.prototype._select = function(e) {
	var index = e.target.selectedIndex;
	var side = (e.target.parentNode == this._tabbox[FC.LEFT] ? FC.LEFT : FC.RIGHT);
	this._panels[side][index].focus();
}

/**
 * Handle keydown on tabpanels
 */
FC.prototype._keyDown = function(e) {
	if (e.keyCode == 9 && !e.ctrlKey) { /* to other panel */
		e.preventDefault();
		var side = (this._activeSide + 1) % 2;
		var panel = this.getActivePanel(side);
		panel.focus();
	}
}

FC.prototype.destroy = function(e) {
	this._ec.forEach(Events.remove, Events);
	this._saveState();
	
	for (var p in this._panels) {
		for (var i=0;i<this._panels[p].length;i++) {
			this._panels[p][i].destroy();
		}
	}
	Events.clear();
}

FC.prototype._loadState = function() {
	var state = this.getPreference("state");
	try {
		state = JSON.parse(state);
	} catch(e) {
		state = {};
	}
	
	var sides = [FC.LEFT, FC.RIGHT];
	for (var i=0;i<sides.length;i++) {
		var side = sides[i];
		if (side in state) {
			var paths = state[side].paths;
			for (var j=0;j<paths.length;j++) {
				var name = paths[j];
				var path = this.getProtocolHandler(name);
				if (path) { this.addPanel(side, path); }
			}
			var index = state[side].index;
		} else {
			var index = 0;
		}
		if (this._panels[side].length == 0) { this.addPanel(side, Path.Local.fromShortcut("Home")); }
		index = Math.min(index, this._panels[side].length-1);
		this._tabbox[side].selectedIndex = index;
	}
	
	var active = ("active" in state ? state.active : FC.LEFT);
	this.getActivePanel(active).focus();
}

FC.prototype._saveState = function() {
	var state = {
		active: this.getActiveSide()
	}
	
	var sides = [FC.LEFT, FC.RIGHT];
	for (var i=0;i<sides.length;i++) {
		var side = sides[i];
		var arr = [];
		for (var j=0;j<this._panels[side].length;j++) {
			arr.push(this._panels[side][j].getPath().getPath());
		}
		state[side] = {
			paths: arr,
			index: this._tabbox[side].selectedIndex
		}
	}

	this.setPreference("state", state);
}

FC.prototype._pathChanged = function(path) {
	for (var side in this._panels) {
		var panels = this._panels[side];
		for (var i=0;i<panels.length;i++) {
			var panel = panels[i];
			if (panel.getPath().equals(path)) { panel.refresh(); }
		}
	}
}

FC.prototype._resetSplitter = function(e) {
	var splitter = e.target;
	var prev = splitter.previousElementSibling;
	var next = splitter.nextElementSibling;
	var prevp = prev.persist;
	var nextp = prev.persist;
	prev.persist = "";
	next.persist = "";
	
	var total = prev.clientWidth + next.clientWidth;
	prev.width = Math.round(total/2);
	next.width = total - Math.round(total/2);
	prev.persist = prevp;
	next.persist = nextp;
}

/***/

Events.add(window, "load", function(){new FC();});
