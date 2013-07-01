/* nsITreeView */

Panel.View = function(panel) {
	this._panel = panel;
	this._columns = [Panel.NAME, Panel.DATA, Panel.SIZE, Panel.TS, Panel.ATTR];
}

Panel.View.prototype.rowCount = 0;

Panel.View.prototype.setTree = function(treebox) { 
	this._panel.setTreebox(treebox);
}

Panel.View.prototype.getCellText = function(row, column) {
	var sizes = this._panel.getComputedSizes();
	var item = this._panel.getItems()[row];
	
	try {
	
		switch (this._columns[column.index]) {
			case Panel.NAME:
				return item.getName();
			break;
			case Panel.DATA:
				return item.getData();
			break;
			case Panel.SIZE:
				var path = item.getPath();
				var s = (path in sizes ? sizes[path] : item.getSize());
				if (s === null) {
					return "";
				} else {
					return FC.formatSize(s, true);
				}
			break;
			case Panel.TS:
				var ts = item.getTS();
				if (ts === null) { return ""; }
				var date = new Date(ts);

				var d = date.getDate();
				var mo = date.getMonth()+1;
				var y = date.getFullYear();

				var h = date.getHours();
				var m = date.getMinutes();
				var s = date.getSeconds();
				if (h < 10) { h = "0"+h; }
				if (m < 10) { m = "0"+m; }
				if (s < 10) { s = "0"+s; }

				return d+"."+mo+"."+y+" "+h+":"+m+":"+s;
			break;
			case Panel.ATTR:
				var perms = item.getPermissions();
				if (perms === null) { return ""; }
				var mask = "rwxrwxrwx";
				return mask.replace(/./g, function(ch, index) {
					var perm = 1 << (mask.length-index-1);
					return (perms & perm ? ch : "–");
				});
			break;
		}
	
	} catch (e) { /* error when accessing file - time to refresh? */
		this._panel.resync();
		return "";
	}
}

Panel.View.prototype.getImageSrc = function(row, column) { 
	if (this._columns[column.index] != Panel.NAME) { return ""; }
	
	try {
		return this._panel.getItems()[row].getImage();
	} catch (e) { /* error when accessing file - time to refresh? */
		this._panel.resync();
		return "";
	}
}

Panel.View.prototype.cycleHeader = function(column) {
	var col = this._columns[column.index];
	this._panel.setSort(col);
}

Panel.View.prototype.isEditable = function(row, column) {
	return this._columns[column.index] == Panel.NAME;
}

/**
 * For some reason, this is called twice after edit ends
 */
Panel.View.prototype.setCellText = function(row, column, text) {
	this._panel.stopEditing(row, text);
}

Panel.View.prototype.isSorted = function() { return true; }
Panel.View.prototype.isSelectable = function(row, column) { return true; }     
Panel.View.prototype.isContainer = function() { return false; }
Panel.View.prototype.isSeparator = function(row) { return false; }  
Panel.View.prototype.getParentIndex = function(row) { return -1; }  
Panel.View.prototype.getLevel = function(row) { return 0; }  
Panel.View.prototype.getRowProperties = function(row, props) {}
Panel.View.prototype.getColumnProperties = function(colid, col, props) {}  
Panel.View.prototype.getCellProperties = function(row, col, props) {
	var items = this._panel.getItems();
	if (!this._panel.getSelection().selectionContains(items[row])) { return ""; }

	if (props) {
		var as = Cc["@mozilla.org/atom-service;1"].getService(Ci.nsIAtomService);
		var atom = as.getAtom("marked");
		props.AppendElement(atom);
	}

	return "marked";
}
