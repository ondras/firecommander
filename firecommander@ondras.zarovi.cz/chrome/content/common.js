const Cc = Components.classes;
const Ci = Components.interfaces;
const Cr = Components.results;

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

var _ = function(key) {
	var strings = $("strings");
	if (arguments.length > 1) {
		var arr = [];
		for (var i=1;i<arguments.length;i++) { arr.push(arguments[i]); }
		return strings.getFormattedString(key, arr);
	} else {
		return strings.getString(key);
	}
}

var Events = {
	_count:0,
	_cache:{},
	add: function(elm, event, f) {
		var id = this._count++;
		this._cache[id] = [elm, event, f];
		elm.addEventListener(event, f, false);
		return id;
	},
	remove: function(id) {
		if (!(id in this._cache)) { throw new Error("Cannot remove event "+id); }
		var item = this._cache[id];
		item[0].removeEventListener(item[1], item[2], false);
		delete this._cache[id];
	},
	clear: function() {
		var ids = [];
		for (var id in this._cache) { ids.push(id); }
		while (ids.length) { this.remove(ids.shift()); }
	}
}
