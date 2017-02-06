Path.Wifi = function() {
	Path.call(this);

	this._columns[Panel.DATA] = true;
	this._columns[Panel.TS] = false;
	this._columns[Panel.ATTR] = false;

	this._items = [];
	this._service = Cc["@mozilla.org/wifi/monitor;1"].getService(Ci.nsIWifiMonitor);
}
Path.Wifi.prototype = Object.create(Path.prototype);

Path.Wifi.fromString = function(path) {
	return new this();
}

Path.Wifi.prototype.getPath = function() {
	return "wifi://";
}

Path.Wifi.prototype.getName = function() {
	return $("cmd_wifi").getAttribute("label");
}

Path.Wifi.prototype.getItems = function() {
	return this._items;
}

Path.Wifi.prototype.supports = function(feature) {
	if (feature == FC.CHILDREN) { return true; }
	return false;
}

Path.Wifi.prototype.exists = function() {
	return true;
}

Path.Wifi.prototype.attach = function(panel) {
	this._panel = panel;
	this._service.startWatching(this);
}

Path.Wifi.prototype.detach = function() {
	this._service.stopWatching(this);
}

Path.Wifi.prototype.onChange = function(items) {
	FC.log("onchange");
	FC.log(items);
	this._items = [];
	for (var i=0;i<items.length;i++) {
		this._items.push(new Path.Wifi.AP(items[i]));
	}
	this._panel.resync();
}

Path.Wifi.prototype.onError = function(e) {
	FC.log("error " + e);
	/* FIXME */
}

Path.Wifi.prototype.QueryInterface = function(iid) {
	if (iid.equals(Ci.nsIWifiListener) || iid.equals(Ci.nsISupports)) { return this; }
	throw Cr.NS_ERROR_NO_INTERFACE;
}


FC.addProtocolHandler("wifi", Path.Wifi.fromString.bind(Path.Wifi));

/***/

Path.Wifi.AP = function(ap) {
	Path.call(this);
	this._ap = ap;
}

Path.Wifi.AP.prototype = Object.create(Path.prototype);

Path.Wifi.AP.prototype.getImage = function() {
	return "chrome://firecommander/skin/wifi.png";
}

Path.Wifi.AP.prototype.getPath = function() {
	return this._ap.mac;
}

Path.Wifi.AP.prototype.getData = function() {
	return this._ap.mac;
}

Path.Wifi.AP.prototype.getName = function() {
	return this._ap.ssid;
}

Path.Wifi.AP.prototype.getSize = function() {
	return this._ap.signal;
}
