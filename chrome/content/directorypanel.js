var DirectoryPanel = function(owner, path) {
	DataPanel.call(this, owner);
	this._path = path;
};

DirectoryPanel.prototype = Object.create(DataPanel.prototype);
