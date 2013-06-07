const Cc = Components.classes;
const Ci = Components.interfaces;
const Cr = Components.results;
const IPH = Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService).getProtocolHandler("moz-icon");
Components.utils.import("resource://gre/modules/AddonManager.jsm");

var $ = function(id) { return document.getElementById(id); }

var _ = function(key) {
	var strings = document.querySelector("stringbundle");
	if (arguments.length > 1) {
		var arr = [];
		for (var i=1;i<arguments.length;i++) { arr.push(arguments[i]); }
		return strings.getFormattedString(key, arr);
	} else {
		return strings.getString(key);
	}
}
