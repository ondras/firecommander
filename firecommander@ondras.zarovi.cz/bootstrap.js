const Cc = Components.classes;
const Ci = Components.interfaces;

const label = "Fire Commander";
const tooltip = "Launch Fire Commander";

const style = Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService).newURI("chrome://firecommander/skin/overlay.css", null, null);
const sss = Cc["@mozilla.org/content/style-sheet-service;1"].getService(Ci.nsIStyleSheetService);

var startupReason = null;

var launch = function(window) {
	window.open("chrome://firecommander/content/firecommander.xul", "", "chrome,centerscreen,resizable=yes");
}

var removeById = function(window, id) {
	var node = window.document.getElementById(id);
	if (node) { node.parentNode.removeChild(node); }
}

var loadIntoWindow = function(window) {
	if (!window) { return; }

	var document = window.document;
	var navbar = document.querySelector("#nav-bar");
	if (!navbar) { return; }

	var wlaunch = launch.bind(this, window);

	var button = document.createElement("toolbarbutton");
	button.id = "firecommander-toolbarbutton";
	button.className = "firecommander-button toolbarbutton-1 chromeclass-toolbar-additional";
	button.setAttribute("label", label);
	button.tooltipText = label;
	button.addEventListener("command", wlaunch);
	document.querySelector("#navigator-toolbox").palette.appendChild(button);

	var parent = document.querySelector("[currentset*=\"" + button.id + "\"]");
	if (parent) { /* restore position */
		var ids = parent.getAttribute("currentset").split(",");
		var before = null;
		var index = ids.indexOf(button.id);
		for (var i=index+1; i<ids.length; i++) {
			before = document.querySelector("#" + ids[i]);
			if (before) {
				parent.insertItem(button.id, before);
				break;
			}
		}
		if (!before) { parent.insertItem(button.id); }

	} else { /* not present, insert on first run */
		if (startupReason == ADDON_INSTALL) { /* insert on first run */
			navbar.appendChild(button);
			navbar.setAttribute("currentset", navbar.currentSet);
			document.persist(navbar.id, "currentset");
		}
	}


	var key = document.createElement("key");
	key.id = "firecommander-key";
	key.setAttribute("key", "c");
	key.setAttribute("modifiers", "alt");
	key.setAttribute("oncommand", "1");
	key.addEventListener("command", wlaunch);
	document.querySelector("keyset").appendChild(key);

	var menuitem = document.createElement("menuitem");
	menuitem.id = "firecommander-menuitem";
	menuitem.setAttribute("label", label);
	menuitem.tooltipText = tooltip;
	menuitem.setAttribute("accesskey", "e");
	menuitem.setAttribute("key", "firecommander-key");
	menuitem.className = "menuitem-iconic firecommander-button";
	menuitem.addEventListener("command", wlaunch);
	var menu = document.querySelector("#menu_ToolsPopup");
	menu.insertBefore(menuitem, document.querySelector("#"+menu.id+" > menuseparator").nextSibling);

	var pane = document.querySelector("#appmenuPrimaryPane");
	if (pane) {
		var menuitem2 = document.createElement("menuitem");
		menuitem2.id = "firecommander-menuitem2";
		menuitem2.setAttribute("label", label);
		menuitem2.tooltipText = tooltip;
		menuitem2.setAttribute("accesskey", "e");
		menuitem2.setAttribute("key", "firecommander-key");
		menuitem2.className = "menuitem-iconic firecommander-button";
		menuitem2.addEventListener("command", wlaunch);
		pane.insertBefore(menuitem2, document.querySelector("#appmenu-quit"));
	}
}

var unloadFromWindow = function(window) {
	if (!window) { return; }
	removeById(window, "firecommander-toolbarbutton");
	removeById(window, "firecommander-key");
	removeById(window, "firecommander-menuitem");
	removeById(window, "firecommander-menuitem2");
}

var listener = {
	onOpenWindow: function(window) {
		var domWindow = window.QueryInterface(Ci.nsIInterfaceRequestor).getInterface(Ci.nsIDOMWindowInternal || Ci.nsIDOMWindow);
		domWindow.addEventListener("load", function() {
			domWindow.removeEventListener("load", arguments.callee, false);
			loadIntoWindow(domWindow);
		}, false);
	},
 
	onCloseWindow: function(window) {},
	onWindowTitleChange: function(window, title) {}
};

var startup = function(data, reason) {
	startupReason = reason;
	sss.loadAndRegisterSheet(style, sss.USER_SHEET);

	var wm = Cc["@mozilla.org/appshell/window-mediator;1"].getService(Ci.nsIWindowMediator);
	var windows = wm.getEnumerator("navigator:browser");
	while (windows.hasMoreElements()) {
		loadIntoWindow(windows.getNext().QueryInterface(Ci.nsIDOMWindow));
	}
	wm.addListener(listener);
}

var shutdown = function(data, reason) {
	if (reason == APP_SHUTDOWN) { return; }

	sss.unregisterSheet(style, sss.USER_SHEET);

	var wm = Cc["@mozilla.org/appshell/window-mediator;1"].getService(Ci.nsIWindowMediator);
	wm.removeListener(listener);
	var windows = wm.getEnumerator("navigator:browser");
	while (windows.hasMoreElements()) {
		unloadFromWindow(windows.getNext().QueryInterface(Ci.nsIDOMWindow));
	}
}

var install = function(data, reason) {}
var uninstall = function(data, reason) {}
