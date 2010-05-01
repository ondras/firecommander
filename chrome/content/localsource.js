var LocalSource = function(panel) {
	DataSource.call(this, panel);
};

LocalSource.prototype = Object.create(DataSource.prototype);

LocalSource.prototype.setPath = function(path) {
	var p = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsILocalFile);
	p.initWithPath(path);
	
	var data = [];
	var entries = p.directoryEntries;
	
	var ios = Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService);
	while (entries.hasMoreElements()) {
		var item = entries.getNext().QueryInterface(Ci.nsILocalFile);
		var obj = this.newItem(item.path);
		if (window.console) console.log(obj);
		
		obj.dir = item.isDirectory();
		obj.ts = item.lastModifiedTime;
		var date = new Date(item.lastModifiedTime);
		
		obj[NAME] = item.leafName;
		obj[SIZE] = item.isDirectory() ? null : item.fileSize;
		obj[DATE] = date.getDate() + "." + (date.getMonth()+1) + "." + date.getFullYear();
		obj[TIME] = date.getHours() + ":" + date.getMinutes() + "." + date.getSeconds();

		if (item.isDirectory()) {
			obj.icon = "chrome://firecommander/skin/folder.png";
		} else {
			var fileURI = ios.newFileURI(item);
			obj.icon = "moz-icon://" + fileURI.spec;
		}
		
		
		data.push(obj);
	}
	
	this._panel.setData(data);
	this._panel.setPath(path, p.leafName);
}
