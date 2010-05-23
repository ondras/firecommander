var Options = {
	_editors: [],

	_bindBrowse: function(button, pref) {

		var pick = function(e) {
			var fp = Cc["@mozilla.org/filepicker;1"].createInstance(Ci.nsIFilePicker);
			fp.init(window, _("browse"), fp.modeOpen);
			fp.appendFilters(fp.filterAll);

			var result = fp.show();
			if (result != fp.returnOK) { return; }
			
			var file = fp.file;
			pref.value = file.path;
		}
		Events.add(button, "command", pick);
	},
	
	_promptEditor: function() {
		var ps = Cc["@mozilla.org/embedcomp/prompt-service;1"].getService(Ci.nsIPromptService);
		var obj = {value:""};
		var result = ps.prompt(null, _("add.title"), _("add.text"), obj, null, {value:false});
		if (!result) { return; }
		
		result = obj.value.replace(/[^a-z0-9]/ig, "");
		if (!result) { return; }
		Options._addEditor(result);
	},
	
	_addEditor: function(ext) {
		var pref = document.createElement("preference");
		pref.setAttribute("id", "pref_" + ext);
		pref.setAttribute("name", "extensions.firecommander.editor."+ext);
		pref.setAttribute("type", "string");
		$("pane_editors").getElementsByTagName("preferences")[0].appendChild(pref);
		
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
		
		Options._editors.push({
			remove: remove,
			row: row,
			pref: pref
		});
		
		Options._bindBrowse(browse, pref);
		Events.add(remove, "command", Options._removeEditor);
	},
	
	_removeEditor: function(e) {
		var index = -1;
		for (var i=0;i<Options._editors.length;i++) {
			var editor = Options._editors[i];
			if (editor.remove == e.target) { index = i; }
		}
		if (index == -1) { throw new Error("Cannot remove editor " + e.target); }
		
		var editor = Options._editors[index];
		Options._editors.splice(index, 1);
		var name = editor.pref.name;
		editor.pref.parentNode.removeChild(editor.pref);
		editor.row.parentNode.removeChild(editor.row);
		
		var branch = Cc["@mozilla.org/preferences-service;1"].getService(Ci.nsIPrefService).getBranch("");
		branch.clearUserPref(name);
	},
	
	init: function(e) {
		Options._bindBrowse($("browse_editor"), $("pref_editor"));
		Options._bindBrowse($("browse_console"), $("pref_console"));
		
		Events.add($("editors_add"), "command", Options._promptEditor);
		
		var branch = Cc["@mozilla.org/preferences-service;1"].getService(Ci.nsIPrefService).getBranch("extensions.firecommander.editor.");
		var children = branch.getChildList("", {});
		children.forEach(Options._addEditor);
	}
}

Events.add(window, "load", Options.init);
Events.add(window, "unload", Events.clear.bind(Events));
