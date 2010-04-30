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
	this._views = {
		left: null,
		right: null
	}
	this._panels = {
		left: null,
		right: null
	}
	window.addEventListener("load", this.init.bind(this), false);
};

FC.prototype.init = function() {
	this._panels.left = new DirectoryPanel(this, "/");
	this._panels.right = new DirectoryPanel(this, "/");
	
	this._views.left = new TreeView(this);
	this._views.right = new TreeView(this);
	$("left").view = this._views.left;
	$("right").view = this._views.right;
	
}

FC.prototype.getLeft = function() {
	return this._panels.left;
}

FC.prototype.getRight = function() {
	return this._panels.right;
}

new FC();
