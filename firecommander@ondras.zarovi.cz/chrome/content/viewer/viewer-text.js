Viewer.Text = function(path, fc) {
	Viewer.call(this, path, fc);
}

Viewer.Text.prototype = Object.create(Viewer.prototype);

Viewer.Text.prototype._ready = function(realPath) {
	Viewer.prototype._ready.call(this, realPath);
	this._open("text");
}

Viewer.Text.prototype._load = function(e) {
	Viewer.prototype._load.call(this, e);

	var t = this._win.document.querySelector("#text");
	var size = this._realPath.getSize();
	if (size > 100000) {
		var text = _("viewer-text.bigfile", this._fc.formatSize(size));
		var title = _("viewer-text.title");
		var ok = this._fc.showConfirm(text, title);
		if (!ok) { 
			this._win.close(); 
			return;
		}
	}
	
	var is = this._realPath.inputStream();
	var cis = Cc["@mozilla.org/intl/converter-input-stream;1"].createInstance(Ci.nsIConverterInputStream);
	cis.init(is, "utf-8", 0, cis.DEFAULT_REPLACEMENT_CHARACTER);
	
	var str = "";
	var obj = {value:""};
	var amount = 0;
	while (amount = cis.readString(-1, obj)) { str += obj.value; } 
	cis.close();
	t.value = str;
	t.focus();
}

FC.addViewerHandler("js", Viewer.Text);
