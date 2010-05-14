Viewer.Text = function(path, fc) {
	Viewer.call(this, path, fc);
	this._open("text");
}

Viewer.Text.prototype = Object.create(Viewer.prototype);

Viewer.Text.prototype._load = function(e) {
	Viewer.prototype._load.call(this, e);

	var t = this._win.document.getElementById("text");
	var size = this._path.getSize();
	if (size > 100000) {
		var text = this._fc.getText("viewer-text.bigfile", size);
		var title = this._fc.getText("viewer-text.title");
		var ok = this._fc.showConfirm(text, title);
		if (!ok) { 
			this._win.close(); 
			return;
		}
	}
	
	var is = this._path.inputStream();
	var cis = Cc["@mozilla.org/intl/converter-input-stream;1"].createInstance(Ci.nsIConverterInputStream);
	cis.init(is, "utf-8", 0, Ci.nsIConverterInputStream.DEFAULT_REPLACEMENT_CHARACTER);
	
	var str = "";
	var obj = {value:""};
	var amount = 0;
	while (amount = cis.readString(-1, obj)) { str += obj.value; } 
	cis.close();
	t.value = str;
	t.focus();
}

FC.addViewerHandler("js", Viewer.Text);
