var FC = function() {
	this._ec = [];
	this._panels = {};
	this._activeSide = null;
	this._tabbox = {};
	this._handlers = {};
	this._status = document.querySelector("statusbarpanel");
	
	var observerService = Cc["@mozilla.org/observer-service;1"].getService(Ci.nsIObserverService);
	observerService.addObserver(this, "panel-focus", false);
	observerService.addObserver(this, "panel-change", false);

	var branch = Cc["@mozilla.org/preferences-service;1"].getService(Ci.nsIPrefBranch)
	branch.addObserver("extensions.firecommander.", this, false);

	this._initConsole();
	this._initDOM();
	this._initCommands();
	this._loadState();
}

FC.LEFT = 0;
FC.RIGHT = 1;

FC.CHILDREN = 0;	/* listing subitems */
FC.DELETE = 1;		/* deletion */
FC.RENAME = 2;		/* quick rename */
FC.VIEW = 3;		/* internal viewer */
FC.EDIT = 4;		/* external editor */
FC.COPY = 5;		/* copy from */
FC.CREATE = 6;		/* create descendants */

FC.log = function(text) {
	var wm = Cc["@mozilla.org/appshell/window-mediator;1"].getService(Ci.nsIWindowMediator);
	var browser = wm.getMostRecentWindow("navigator:browser");
	if (browser && browser.Firebug) {
		browser.Firebug.Console.log(text);
	} else {
		Cc['@mozilla.org/consoleservice;1'].getService(Ci.nsIConsoleService).logStringMessage(text);
	}
}

/**
 * Get an image for a given file:// local path
 */
FC.getIcon = function(localPathString) {
	var uri = IPH.newURI("moz-icon://" + localPathString, "utf-8", null);

	try { /* try loading the icon */
		IPH.newChannel(uri);
		return uri.spec;
	} catch (e) { /* failed */
		return "chrome://firecommander/skin/file.png";
	}
}

FC._handlers = {
	protocol: {},
	extension: {},
	viewer: {}
};

FC.getPreference = function(name) {
	var branch = Cc["@mozilla.org/preferences-service;1"].getService(Ci.nsIPrefService).getBranch("extensions.firecommander.");
	var type = branch.getPrefType(name);
	switch (type) {
		case branch.PREF_STRING:
			return unescape(branch.getCharPref(name));
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

FC.setPreference = function(name, value) {
	var branch = Cc["@mozilla.org/preferences-service;1"].getService(Ci.nsIPrefService).getBranch("extensions.firecommander.");
	switch (typeof(value)) {
		case "string":
			branch.setCharPref(name, escape(value));
		break;
		case "number":
			branch.setIntPref(name, value);
		break;
		case "boolean":
			branch.setBoolPref(name, value);
		break;
		default:
			branch.setCharPref(name, escape(JSON.stringify(value)));
		break;
	}
}

FC.formatSize = function(size, bytes) {
	if (size === null) { return ""; }
	if (bytes && this.getPreference("autosize")) {
		var units = ["B", "KB", "MB", "GB", "TB"];
		var step = 1 << 10;
		var index = 0;
		while (size / step >= 1 && index+1 < units.length) {
			size /= step;
			index++;
		}
		return size.toFixed(2) + " " + units[index];
	} else {
		return size.toString().replace(/(\d{1,3})(?=(\d{3})+(?!\d))/g, "$1 ");
	}
}

/**
 * @param {string} protocol
 * @param {function} handler
 */
FC.addProtocolHandler = function(protocol, handler) {
	this._handlers.protocol[protocol] = handler;
}

/**
 * @param {string} extension
 * @param {function} extension
 */
FC.addExtensionHandler = function(extension, handler) {
	this._handlers.extension[extension] = handler;
}

/**
 * @param {string} extension
 * @param {function} viewer class
 */
FC.addViewerHandler = function(extension, handler) {
	this._handlers.viewer[extension] = handler;
}

FC.prototype.handleEvent = function(e) {
	switch (e.type) {
		case "dblclick": 
			if (e.target.nodeName.toLowerCase() == "splitter") {
				this._resetSplitter(e.target); 
				return;
			}

			/* Doubleclick on tab heading. Check if it is in free space and clone current tab. */
			var target = e.originalTarget;
			if (!target.nodeName.match(/spacer/i)) { return; }

			/* focus correct panel */
			var side = (e.target.parentNode == this._tabbox[FC.LEFT] ? FC.LEFT : FC.RIGHT);
			this.getActivePanel(side).focus();

			/* duplicate */
			this.cmdNewTab();
		break;

		case "popupshowing": this._adjustContextMenu(e.target); break;

		case "keydown":
			if (e.keyCode == 9 && !e.ctrlKey) { /* to other panel */
				e.preventDefault();
				var side = (this._activeSide + 1) % 2;
				var panel = this.getActivePanel(side);
				panel.focus();
			}
		break;

		case "select": /* Tab change. This sometimes does not focus the relevant tree, so we must do it manually. */
			var index = e.target.selectedIndex;
			var side = (e.target.parentNode == this._tabbox[FC.LEFT] ? FC.LEFT : FC.RIGHT);
			this._panels[side][index].focus();
		break;
	}

}

FC.prototype._initConsole = function() {
	if (FC.getPreference("console")) { return; }
	
	/* os-based defaults */
	var os = Cc["@mozilla.org/xre/app-info;1"].getService(Ci.nsIXULRuntime).OS;
	if (os == "WINNT") { 
		FC.setPreference("console", "c:\\windows\\system32\\cmd.exe");
		FC.setPreference("console.args", "/c start Command%20Shell /d %s");
	} else if (os == "Darwin") {
		FC.setPreference("console", "/Applications/Utilities/Terminal.app/Contents/MacOS/Terminal");
	} else {
		FC.setPreference("console", "/usr/bin/gnome-terminal");
		FC.setPreference("console.args", "--working-directory=%s");
	}
	
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
		tabbox.addEventListener("keydown", this);
		tabbox.tabs.addEventListener("select", this);
		tabbox.tabs.addEventListener("dblclick", this);
	}

	$("splitter").addEventListener("dblclick", this);
	$("context-menu").addEventListener("popupshowing", this);
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
	this._bindCommand("home", this.cmdHome);
	this._bindCommand("copy", this.cmdCopy);
	this._bindCommand("move", this.cmdMove);
	this._bindCommand("view", this.cmdView);
	this._bindCommand("search", this.cmdSearch);
	this._bindCommand("pack", this.cmdPack);
	this._bindCommand("console", this.cmdConsole);
	this._bindCommand("activate", this.cmdActivate);
	this._bindCommand("wifi", this.cmdWifi);
	this._bindCommand("sort_name", this.cmdSortName);
	this._bindCommand("sort_ext", this.cmdSortExt);
	this._bindCommand("sort_ts", this.cmdSortTS);
	this._bindCommand("sort_size", this.cmdSortSize);

	try {
		var tmp = new Path.Drives();
		this._bindCommand("drives", this.cmdDrives);
	} catch (e) {
		$("cmd_drives").setAttribute("disabled", "true");
	}
}

FC.prototype._bindCommand = function(id, method) {
	$("cmd_" + id).addEventListener("command", method.bind(this));
}

/* nsIObserver method */
FC.prototype.observe = function(subject, topic, data) {
	switch (topic) {
		case "panel-focus":
			var panel = subject.wrappedJSObject;
			this._activeSide = (this._panels[FC.LEFT].indexOf(panel) != -1 ? FC.LEFT: FC.RIGHT);
			this.updateMenu();
			this._saveState();
		break;

		case "panel-change":
			this._saveState();
		break;

		case "nsPref:changed":
			this.getActivePanel(0).resync();
			this.getActivePanel(1).resync();
		break;

		default:
		break;
	}
}

/* command methods */

FC.prototype.cmdQuickRename = function() {
	this.getActivePanel().startEditing();
}

FC.prototype.cmdNewTab = function() {
	var path = this.getActivePanel().getPath();
	this.addPanel(this._activeSide, path.clone());
}

FC.prototype.cmdCloseTab = function() {
	var tabbox = this._tabbox[this._activeSide];
	var tabs = tabbox.tabs;
	var tabpanels = tabbox.tabpanels;

	if (tabs.itemCount == 1) { return; } /* cannot close last tab */
	var index = tabs.selectedIndex;
	var tmpIndex = (index+1 == tabs.itemCount ? index-1 : index+1);
	tabbox.selectedIndex = tmpIndex;
	var newIndex = (index+1 == tabs.itemCount ? index-1 : index);
	
	this._panels[this._activeSide][index].destroy();
	this._panels[this._activeSide].splice(index, 1);
	tabs.removeItemAt(index);
	tabpanels.removeChild(tabpanels.children[index]);

	tabbox.selectedIndex = newIndex;
	this._saveState();
}

FC.prototype.cmdAbout = function() {
	AddonManager.getAddonByID("firecommander@ondras.zarovi.cz", function(addon) {
		if (addon) {
			var version = addon.version;
		} else { /* xulrunner */
			var version = Cc["@mozilla.org/xre/app-info;1"].getService(Ci.nsIXULAppInfo).version;
		}
		window.openDialog("about/about.xul", "", "centerscreen,modal,chrome", version);
	});
}

FC.prototype.cmdUp = function() {
	var panel = this.getActivePanel();
	var path = panel.getPath();
	if (!path) { return; }
	var parent = path.getParent();
	if (parent) { panel.setPath(parent); }
}

FC.prototype.cmdTop = function() {
	var panel = this.getActivePanel();
	var path = panel.getPath();
	if (!path) { return; }
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

FC.prototype.cmdWifi = function() {
	this.getActivePanel().setPath(new Path.Wifi());
}

FC.prototype.cmdFavorites = function() {
	var fav = new Path.Favorites(this);
	this.getActivePanel().setPath(fav);
}

FC.prototype.cmdHome = function() {
	var home = Path.Local.fromShortcut("Home");
	this.getActivePanel().setPath(home);
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
	var item = (panel.getSelection().getItems().length ? panel.getSelection() : panel.getItem());
	if (!item || !item.supports(FC.DELETE)) { return; }
	
	var text = _("delete.confirm", item.getPath());
	var title = _("delete.title");
	if (!this.showConfirm(text, title)) { return; }
	
	new Operation.Delete(item).run().then(function() {
		this._pathChanged(path);
	}.bind(this));
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
	var source = (activePanel.getSelection().getItems().length ? activePanel.getSelection() : activePanel.getItem());
	if (!source || !source.supports(FC.COPY)) { return; }
	
	/* let user adjust target path */
	var text = _(name + ".confirm", source.getPath());
	var title = _(name + ".title");
	var target = inactivePath.getPath();
	target = this.showPrompt(text, title, target);
	if (!target) { return; }
	
	/* can we handle target */
	target = this.getProtocolHandler(target, activePath);
	if (!target) { return; }
	
	/* only when copying recursive structures */
	if (source.supports(FC.CHILDREN)) { /* does target exist? does it support children? */
		if (!target.exists() || !target.supports(FC.CHILDREN)) {
			this.showAlert(_("error.badpath", target.getPath()));
			return;
		}
	}
	
	/* same source & target? */
	if (activePath.equals(target)) {
		this.showAlert(_("error.equalpath"));
		return;
	}
	
	/* check copying to (sub)self */
	var tmp = target;
	while (tmp) {
		if (tmp.equals(source)) {
			this.showAlert(_("error.cyclic"));
			return;
		}
		tmp = tmp.getParent();
	}
	
	new ctor(source, target).run().then(function() {
		this._pathChanged(activePath); 
		this._pathChanged(inactivePath); 
	}.bind(this));
}

FC.prototype.cmdPack = function() {
	var activePanel = this.getActivePanel();
	var activePath = activePanel.getPath();
	var item = null;
	var target = "";
	if (activePanel.getSelection().getItems().length) {
		item = activePanel.getSelection();
		var name = activePath.getName();
		target = activePath.append(name);
	} else {
		item = activePanel.getItem();
		target = item;
	}
	if (!item || !item.supports(FC.COPY)) { return; }
	
	/* adjust archive name */
	var text = _("pack.confirm", item.getPath());
	var title = _("pack.title");
	target = target.getPath().replace(/(\.[^\.]+)?$/, ".zip"); /* add or replace extension */
	target = this.showPrompt(text, title, target);
	if (!target) { return; }
	
	/* silly target name */
	try {
		target = Path.Local.fromString(target);
	} catch (e) {
		this.showAlert(_("error.badpath", target));
		return;
	}
	
	/* if exists, is it a file? */
	if (target.exists() && target.supports(FC.CHILDREN)) {
		this.showAlert(_("error.badpath", target.getPath()));
		return;
	}

	/* in existing directory? */
	if (!target.getParent().exists()) {
		this.showAlert(_("error.nopath"), target.getParent());
		return;
	} 
	
	/* this is the target zip */
	target = new Path.Zip(target, "", null, this);

	new Operation.Copy(item, target).run().then(function() {
		this._pathChanged(activePath);
	}.bind(this));
}

FC.prototype.cmdView = function() {
	var panel = this.getActivePanel();
	var item = panel.getItem();
	if (!item || !item.supports(FC.VIEW)) { return; }
	
	var viewer = this.getViewerHandler(item);
	if (!viewer) { viewer = Viewer.Text; }
	new viewer(item, this);
}

FC.prototype.cmdOptions = function() {
	window.openDialog("options/options.xul", "", "chrome,titlebar,toolbar,centerscreen,dialog=yes");
}

FC.prototype.cmdEdit = function() {
	var panel = this.getActivePanel(); 
	var item = panel.getItem();
	if (!item || !item.supports(FC.EDIT)) { return; }

	var ext = this.getExtension(item);
	var editorPref = "editor";
	if (ext) {
		var tmp = FC.getPreference("editor."+ext);
		if (tmp) { editorPref = "editor." + ext; }
	}

	var editor = FC.getPreference(editorPref);
	if (!editor) {
		this.showAlert(_("error.noeditor"));
		return;
	}
	
	try {
		var path = Path.Local.fromString(editor);
		if (!path.exists()) { throw Cr.NS_ERROR_FILE_NOT_FOUND; }
	} catch (e) {
		this.showAlert(_("error.badeditor", editor));
		return;
	}
	
	var process = Cc["@mozilla.org/process/util;1"].createInstance(Ci.nsIProcess);
	
	try {
		process.init(path.getFile());
	} catch (e) {
		this.showAlert(_("error.badeditor", editor));
		return;
	}

	process.runw(false, [item.getPath()], 1);
}

FC.prototype.cmdCreateDirectory = function() {
	var panel = this.getActivePanel(); 
	var path = panel.getPath();
	if (!path.supports(FC.CREATE)) { return; }
	
	var text = _("createdirectory.name", path.getPath());
	var title = _("createdirectory.title");
	var name = this.showPrompt(text, title);
	if (!name) { return; }
	
	try {
		var newPath = path.append(name);
		newPath.create(true, new Date().getTime());
		panel.resync(newPath);
	} catch (e) {
		var text = _("error.create", name);
		this.showAlert(text);
	}
}

FC.prototype.cmdCreateFile = function() {
	var panel = this.getActivePanel(); 
	var path = panel.getPath();
	if (!path.supports(FC.CREATE)) { return; }
	
	var text = _("createfile.name", path.getPath());
	var title = _("createfile.title");
	var name = this.showPrompt(text, title, FC.getPreference("newname") || "new.txt");
	if (!name) { return; }
	
	try {
		var newFile = path.append(name);
		newFile.create(false, new Date().getTime());
		panel.resync(newFile);
		/* this.cmdEdit(); */
	} catch (e) {
		var text = _("error.create", name);
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
	if (!result.result) { return; } /* dialog canceled */

	delete(result.result);
	var str = "search://" + JSON.stringify(result);
	var searchPath = this.getProtocolHandler(str, null);
	if (!searchPath) { return; }
	
	this.addPanel(this.getActiveSide(), searchPath);
}

FC.prototype.cmdSortName = function() { this._cmdSort(Panel.NAME); }
FC.prototype.cmdSortSize = function() { this._cmdSort(Panel.SIZE); }
FC.prototype.cmdSortTS = function() { this._cmdSort(Panel.TS); }
FC.prototype.cmdSortExt = function() { this._cmdSort(Panel.EXT); }

FC.prototype._cmdSort = function(column) {
	this.getActivePanel().setSort(column);
}

FC.prototype.cmdConsole = function() {
	var dir = this.getActivePanel().getPath();
	while (dir && !(dir instanceof Path.Local)) { dir = dir.getParent(); }
	if (!dir) { return; }

	var console = FC.getPreference("console");
	try {
		var path = Path.Local.fromString(console);
		if (!path.exists()) { throw Cr.NS_ERROR_FILE_NOT_FOUND; }
	} catch (e) {
		this.showAlert(_("error.badconsole", console));
		return;
	}
	
	var params = FC.getPreference("console.args").split(" ");
	for (var i=0;i<params.length;i++) {
		var p = params[i];
		p = unescape(p);
		p = p.replace(/%s/g, dir.getPath());
		params[i] = p;
	}
	
	var process = Cc["@mozilla.org/process/util;1"].createInstance(Ci.nsIProcess);
	
	try {
		process.init(path.getFile());
	} catch (e) {
		this.showAlert(_("error.badconsole", console));
		return;
	}

	process.run(false, params, params.length);
}

FC.prototype.cmdActivate = function() {
	var panel = this.getActivePanel()
	var item = panel.getItem();
	if (!item) { return; }
	item.activate(panel, this);
}

/* additional methods */

FC.prototype.copyToTemp = function(source) {
	var randomName = "_fc" + Math.random().toString().replace(/\./g, "");
	var ext = this.getExtension(source);
	if (ext) { randomName += "."+ext; }
	var target = Path.Local.fromShortcut("TmpD").append(randomName);

	var promise = new Promise();
	new Operation.Copy(source, target).run().then(function() {
		promise.fulfill(target);
	});
	return promise;
}

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
	return ps.alert(null, title || _("error"), text);
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
	if (path) { panel.setPath(path); }

	/* bring to front */
	this._tabbox[side].selectedIndex = this._panels[side].length-1;
}

/**
 * @param {string} url Input string
 * @param {null || Path} relativeBase Base path for relative string
 * @returns {null || Path} null when no protocol handler is available
 */
FC.prototype.getProtocolHandler = function(url, relativeBase) {
	var r = url.match(/^([a-z0-9]+):\/\/(.*)/);
	if (r) { /* absolute with handler */
		var protocol = r[1];
		url = r[2];
		if (!(protocol in FC._handlers.protocol)) {
			this.showAlert(_("error.nohandler", protocol));
			return null;
		}

		try {
			return FC._handlers.protocol[protocol](url, this);
		} catch (e) { /* handler does not understand */
			this.showAlert(_("error.badpath", url));
			return null;
		}
		
	} else {
		try { /* valid absolute local path */
			return Path.Local.fromString(url);
		} catch (e) {}
		
		try { /* not possible to append */
			return relativeBase.append(url);
		} catch (e) {
			this.showAlert(_("error.badpath", url));
			return null;
		}
	}
}

/**
 * @returns {null || Viewer} null when this extension cannot be handled
 */
FC.prototype.getViewerHandler = function(path) {
	var ext = this.getExtension(path).toLowerCase();
	if (!ext) { return null; }
	
	var h = FC._handlers.viewer[ext];
	return h || null;
}

/**
 * @returns {bool} true = extension handled, false = no handler found
 */
FC.prototype.handleExtension = function(path) {
	var ext = this.getExtension(path).toLowerCase();
	if (!ext) { return null; }
	
	var h = FC._handlers.extension[ext];
	if (h) {
		h(path.getPath(), this);
		return true;
	} else { return false; }
}

FC.prototype.getExtension = function(path) {
	var ext = path.getName().match(/\.([^\.]+)$/);
	return (ext ? ext[1] : "");
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

FC.prototype.setStatus = function(text) {
	this._status.label = text;
}

FC.prototype.updateMenu = function() {
	var column = this.getActivePanel().getSort();
	var map = {};
	map[Panel.NAME] = "menu_sort_name";
	map[Panel.SIZE] = "menu_sort_size";
	map[Panel.TS] = "menu_sort_ts";
	map[Panel.EXT] = "menu_sort_ext";
	
	for (var col in map) {
		var item = $(map[col]);
		item.setAttribute("checked", (col == column ? "true" : "false"));
	}
}

FC.prototype._loadState = function() {
	var state = FC.getPreference("state") || {};
	try { state = JSON.parse(state); } catch(e) {}

	var sides = [FC.LEFT, FC.RIGHT];
	for (var i=0;i<sides.length;i++) {
		var side = sides[i];
		if (side in state) {
			var paths = state[side].paths;
			for (var j=0;j<paths.length;j++) {
				var name = paths[j];
				this.addPanel(side, name);
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
	if (active !== null) { this.getActivePanel(active).focus(); }
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

	FC.setPreference("state", state);
	Cc["@mozilla.org/preferences-service;1"].getService(Ci.nsIPrefService).savePrefFile(null);
}

FC.prototype._pathChanged = function(path) {
	for (var side in this._panels) {
		var panels = this._panels[side];
		for (var i=0;i<panels.length;i++) {
			var panel = panels[i];
			if (panel.getPath().equals(path)) { panel.resync(); }
		}
	}
}

FC.prototype._resetSplitter = function(splitter) {
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

FC.prototype._adjustContextMenu = function(node) {
	var children = node.childNodes;
	var panel = this.getActivePanel();
	var item = panel.getItem();
	var path = panel.getPath();
	
	for (var i=0;i<children.length;i++) {
		var ch = children[i];
		var c = ch.className;
		var r = c.match(/^supports-(.+)$/);
		if (!r) { continue; }
		var constant = FC[r[1].toUpperCase()];
		
		var what = (constant == FC.CREATE ? path : item);
		ch.hidden = !what.supports(constant);
	}
}
