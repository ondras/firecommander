/**
 * @param {Path.Local} file
 */
Path.SQLite = function(file) {
	this._file = file;
}

Path.SQLite.prototype = Object.create(Path.prototype);

Path.SQLite.fromString = function(path) {
	var local = Path.Local.fromString(path);
	var path = [];
	while (!local.exists()) {
		path.unshift(local.getName());
		local = local.getParent();
		if (!local) { throw Cr.NS_ERROR_FILE_NOT_FOUND; } /* completely fucked up path, not starting with existing local file */
	}
	
	var db = new this(local);
	if (path.length) { /* table */
		var table = new this.Table(db, path[0]);
		return table;
	} else { /* db */
		return db;
	}

}

Path.SQLite.handleExtension = function(path) {
	var p = Path.SQLite.fromString(path);
	fc.getActivePanel().setPath(p);
}

Path.SQLite.prototype.openConnection = function() {
	if (!this._connection) {  
		var storageService = Cc["@mozilla.org/storage/service;1"].getService(Ci.mozIStorageService);
		this._connection = storageService.openDatabase(this._file.getFile());;
	}
	return this._connection;
}

Path.SQLite.prototype.closeConnection = function() {
	this._connection.close();
	this._connection = null;
}

Path.SQLite.prototype.getPath = function() {
	var p = "sqlite://" + this._file.getPath();
	return p;
}

Path.SQLite.prototype.getName = function() {
	return this._file.getName();
}

Path.SQLite.prototype.getParent = function() {
	return this._file.getParent();
}

Path.SQLite.prototype.getItems = function() {
	var results = [];
		
	var query = "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name";
	var statement = this.openConnection().createStatement(query);
	while (statement.executeStep()) {
		var name = statement.row.name;
		var row = new Path.SQLite.Table(this, name);
		results.push(row);
	}
	statement.finalize();	
	this.closeConnection();

	return results;
}

Path.SQLite.prototype.equals = function(path) {
	return this._file.equals(path);
}

Path.SQLite.prototype.exists = function() {
	return this._file.exists();
}

Path.SQLite.prototype.supports = function(feature) {
	if (feature == FC.CHILDREN) { return true; }
	return false;
}

FC.addProtocolHandler("sqlite", Path.SQLite.fromString.bind(Path.SQLite));
FC.addExtensionHandler("sqlite", Path.SQLite.handleExtension.bind(Path.SQLite));

/***/

/**
 * @param {Path.SQLite} db
 * @param {string} name
 */
Path.SQLite.Table = function(db, name) {
	this._db = db;
	this._name = name;
}

Path.SQLite.Table.prototype = Object.create(Path.prototype);

Path.SQLite.Table.prototype.exists = function() {
	return this._db.exists();
}

Path.SQLite.Table.prototype.getName = function() {
	return this._name;
}

Path.SQLite.Table.prototype.getImage = function() {
	return "chrome://firecommander/skin/table.png";
}

Path.SQLite.Table.prototype.getPath = function() {
	return this._db.getPath() + "/" + this._name;
}

Path.SQLite.Table.prototype.supports = function(feature) {
	if (feature == FC.CHILDREN) { return true; }
	return false;
}

Path.SQLite.Table.prototype.getParent = function() {
	return this._db;
}

Path.SQLite.Table.prototype.getItems = function() {
	var results = [];
		
	var query = "SELECT rowid, * FROM "+this._name;
	var statement = this._db.openConnection().createStatement(query);
	
	var names = [];
	for (var i=0;i<statement.columnCount;i++) { names.push(statement.getColumnName(i)); }
	
	while (statement.executeStep()) {
		var data = {};
		for (var i=0;i<names.length;i++) { 
			var name = names[i];
			data[name] = statement.row[name];
		}
		var row = new Path.SQLite.Row(this._db, this, data);
		results.push(row);
	}
	statement.finalize();	
	this._db.closeConnection();

	return results;
}

Path.SQLite.Table.prototype.activate = function(panel) {
	panel.setPath(this);
}

/***/

/**
 * @param {Path.SQLite} db
 * @param {string} name
 */
Path.SQLite.Row = function(db, table,  data) {
	this._db = db;
	this._table = table;
	this._data = data;
}

Path.SQLite.Row.prototype = Object.create(Path.prototype);

Path.SQLite.Row.prototype.getName = function() {
	return JSON.stringify(this._data);
}

Path.SQLite.Row.prototype.getPath = function() {
	return this._db.getPath() + "/" + this._table.getName() + "/" + this._data.rowid;
}

Path.SQLite.Row.prototype.getImage = function() {
	/* FIXME */
//	return "chrome://firecommander/skin/file.png";
}
