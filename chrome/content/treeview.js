var TreeView = function(owner) {
	this._owner = null;
	this._treebox = null;
	this.rowCount = 100;
};

/* nsITreeView methods */

TreeView.prototype.rowCount = 0;

TreeView.prototype.setTree = function(treebox){ 
	this._treebox = treebox; 
}

TreeView.prototype.getCellText = function(row,column){  
	return column.id;
}
     
TreeView.prototype.getImageSrc = function(row, col) { 
	return "";
	return "http://www.seznam.cz/st/img/favicon.ico";
}
     
TreeView.prototype.cycleHeader = function(col) { /* FIXME sort */
}     
     
TreeView.prototype.isEditable = function(row, col) {
	return true;
}     

TreeView.prototype.isSelectable = function(row, col) {
	return true;
}     

TreeView.prototype.setCellText = function(row, column, text) {
	alert("sct");
}

TreeView.prototype.isSorted = function() { return false; }
     
TreeView.prototype.isContainer = function() { return false; }
TreeView.prototype.isSeparator = function(row) { return false; }  
TreeView.prototype.getLevel = function(row) { return 0; }  

TreeView.prototype.getRowProperties = function(row, props) {}
TreeView.prototype.getCellProperties = function(row, col, props) {}
TreeView.prototype.getColumnProperties =function(colid, col, props) {}  

/* custom methods */

TreeView.prototype.setProvider = function(provider) {
	this._provider = provider;
}
