var Options = function() {
	this._editors = [];

	this._bindBrowse($("browse_editor"), $("pref_editor"));
	this._bindBrowse($("browse_console"), $("pref_console"));
	
	$("editors_add").addEventListener("command", this);
	
	var branch = Cc["@mozilla.org/preferences-service;1"].getService(Ci.nsIPrefService).getBranch("extensions.firecommander.editor.");
	var children = branch.getChildList("", {});
	children.forEach(this._addEditor, this);
}

Options.prototype.handleEvent = function(e) {
	switch (e.type) {
		case "command":
			if (e.target.id) {
				var ps = Cc["@mozilla.org/embedcomp/prompt-service;1"].getService(Ci.nsIPromptService);
				var obj = {value:""};
				var result = ps.prompt(null, _("add.title"), _("add.text"), obj, null, {value:false});
				if (!result) { return; }
				
				result = obj.value.replace(/[^a-z0-9]/ig, "");
				if (!result) { return; }
				this._addEditor(result);
			} else { /* remove editor */
				var index = -1;
				for (var i=0;i<this._editors.length;i++) {
					var editor = this._editors[i];
					if (editor.remove == e.target) { index = i; }
				}
				if (index == -1) { throw new Error("Cannot remove editor " + e.target); }
				
				var editor = this._editors[index];
				this._editors.splice(index, 1);
				var name = editor.pref.name;
				editor.pref.parentNode.removeChild(editor.pref);
				editor.row.parentNode.removeChild(editor.row);
				
				var branch = Cc["@mozilla.org/preferences-service;1"].getService(Ci.nsIPrefService).getBranch("");
				branch.clearUserPref(name);
			}
		break;
	}
}

Options.prototype._bindBrowse = function(button, pref) {
	var pick = function(e) {
		var fp = Cc["@mozilla.org/filepicker;1"].createInstance(Ci.nsIFilePicker);
		fp.init(window, _("browse"), fp.modeOpen);
		fp.appendFilters(fp.filterAll);

		var result = fp.show();
		if (result != fp.returnOK) { return; }
		
		var file = fp.file;
		pref.value = file.path;
	}
	button.addEventListener("command", pick);
}

Options.prototype._addEditor = function(ext) {
	var pref = document.createElement("preference");
	pref.setAttribute("id", "pref_" + ext);
	pref.setAttribute("name", "extensions.firecommander.editor."+ext);
	pref.setAttribute("type", "string");
	document.querySelector("#pane_editors preferences").appendChild(pref);
	
	var row = document.createElement("row");
	row.setAttribute("align", "center");
	var label = document.createElement("label");
	label.setAttribute("value", "." + ext);
	var textbox = document.createElement("textbox");
	textbox.setAttribute("preference", "pref_"+ext);
	textbox.setAttribute("value", pref.value); /* hack to sync with preference */
	var browse = document.createElement("button");
	browse.setAttribute("label", $("browse_editor").label);
	var remove = document.createElement("button");
	remove.setAttribute("label", _("remove"));
	
	row.appendChild(label);
	row.appendChild(textbox);
	row.appendChild(browse);
	row.appendChild(remove);
	$("editors_rows").appendChild(row);
	
	this._editors.push({
		remove: remove,
		row: row,
		pref: pref
	});
	
	this._bindBrowse(browse, pref);
	remove.addEventListener("command", this);
}

window.onload = function() { new Options(); }
