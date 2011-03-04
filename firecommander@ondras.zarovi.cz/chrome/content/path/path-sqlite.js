/**
 * @param {Path.Local} file
 */
Path.SQLite = function(file) {
	Path.call(this);

	this._columns[Panel.SIZE] = false;
	this._columns[Panel.TS] = false;
	this._columns[Panel.ATTR] = false;

	this._file = file;
}

Path.SQLite.TYPE_NULL		= 0;
Path.SQLite.TYPE_INTEGER	= 1;
Path.SQLite.TYPE_FLOAT		= 2;
Path.SQLite.TYPE_TEXT		= 3;
Path.SQLite.TYPE_BLOB		= 4;

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
		var table = new this.Table(db, path.shift());
		if (path.length) {
			return table.getRow(path.shift());
		} else {	
			return table;
		}
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
		this._connection = storageService.openDatabase(this._file.getFile());
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
		
	var query = "SELECT name FROM sqlite_master WHERE type=?1 ORDER BY name";
	var statement = this.openConnection().createStatement(query);
	statement.bindStringParameter(0, "table");

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
	Path.call(this);
	
	this._columns[Panel.DATA] = true;
	this._columns[Panel.SIZE] = false;
	this._columns[Panel.TS] = false;
	this._columns[Panel.ATTR] = false;
	
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
		
	var query = "SELECT _rowid_ AS _rowid_, * FROM \""+this._name+"\"";
	var statement = this._db.openConnection().createStatement(query);
	
	while (statement.executeStep()) {
		var row = Path.SQLite.Row.fromStatement(this, statement.row._rowid_, statement);
		results.push(row);
	}

	statement.finalize();	
	this._db.closeConnection();

	return results;
}

Path.SQLite.Table.prototype.getDB = function() {
	return this._db;
}

Path.SQLite.Table.prototype.getRow = function(rowid) {
	var query = "SELECT * FROM \""+this._name+"\" WHERE _rowid_= ?1";
	var statement = this._db.openConnection().createStatement(query);
	statement.bindInt64Parameter(0, rowid);
	
	var row = null;
	
	while (statement.executeStep()) {
		row = Path.SQLite.Row.fromStatement(this, rowid, statement);
	}
	
	statement.finalize();	
	this._db.closeConnection();
	
	if (!row) { throw Cr.NS_ERROR_FILE_NOT_FOUND; }  
	return row;
}

Path.SQLite.Table.prototype.update = function(row, field) {
	var query = "UPDATE \"" + this._name + "\" SET \"" + field.getName() + "\" = ?1 WHERE _rowid_ = ?2";
	var statement = this._db.openConnection().createStatement(query);
	var error = null;

	try {
		switch (field.getType()) {
			case Path.SQLite.TYPE_INTEGER:
				statement.bindInt64Parameter(0, field.getValue());
			break;
			case Path.SQLite.TYPE_FLOAT:
				statement.bindDoubleParameter(0, field.getValue());
			break;
			case Path.SQLite.TYPE_TEXT:
				statement.bindStringParameter(0, field.getValue());
			break;
			default:
				throw Cr.NS_ERROR_NOT_IMPLEMENTED;
			break;
		}
		
		statement.bindInt64Parameter(1, row.getId());
		
		statement.execute();
	} catch (e) {
		error = null;
	}
	
	statement.finalize();
	this._db.closeConnection();
	if (error) { throw error; }
}

Path.SQLite.Table.prototype.delete = function(row) {
	var query = "DELETE FROM \"" + this._name + "\" WHERE _rowid_ = ?1";
	var statement = this._db.openConnection().createStatement(query);

	statement.bindInt64Parameter(0, row.getId());
	statement.execute();
	statement.finalize();
	this._db.closeConnection();
}

/***/

/**
 * @param {Path.SQLite} db
 * @param {string} name
 */
Path.SQLite.Row = function(table, id, names, types, values) {
	Path.call(this);

	this._columns[Panel.DATA] = true;
	this._columns[Panel.SIZE] = false;
	this._columns[Panel.TS] = false;
	this._columns[Panel.ATTR] = false;

	this._table = table;
	this._id = id;
	
	this._fields = [];
	var data = {};
	
	for (var i=0; i<names.length; i++) {
		var name = names[i];
		var type = types[i];
		var value = values[i];
		
		data[name] = value;
		var field = new Path.SQLite.Field(this, name, type, value);
		this._fields.push(field);
		
	}
	
	this._data = JSON.stringify(data);
}

Path.SQLite.Row.fromStatement = function(table, id, statement) {
	var types = [];
	var names = [];
	var values = [];

	var length = statement.columnCount;
	for (var i=0;i<length;i++) { 
		var name = statement.getColumnName(i);
		if (name == "_rowid_") { continue; }
		names.push(name);
		
		var type = statement.getTypeOfIndex(i);
		switch (type) {
			case statement.VALUE_TYPE_NULL:
				types.push(Path.SQLite.TYPE_NULL);
				values.push(null);
			break;

			case statement.VALUE_TYPE_INTEGER:
				types.push(Path.SQLite.TYPE_INTEGER);
				values.push(statement.getInt64(i));
			break;

			case statement.VALUE_TYPE_FLOAT:
				types.push(Path.SQLite.TYPE_FLOAT);
				values.push(statement.getDouble(i));
			break;

			case statement.VALUE_TYPE_TEXT:
				types.push(Path.SQLite.TYPE_TEXT);
				values.push(statement.getString(i));
			break;

			case statement.VALUE_TYPE_BLOB:
				types.push(Path.SQLite.TYPE_BLOB);
				values.push(null);
			break;
			
			default:
				throw "FIXME";
			break;
		}
	}

	return new this(table, id, names, types, values);
}

Path.SQLite.Row.prototype = Object.create(Path.prototype);

Path.SQLite.Row.prototype.getId = function() {
	return this._id;
}

Path.SQLite.Row.prototype.getName = function() {
	return this._id;
}

Path.SQLite.Row.prototype.getData = function() {
	return this._data;
}

Path.SQLite.Row.prototype.getPath = function() {
	return this._table.getPath() + "/" + this._id;
}

Path.SQLite.Row.prototype.getImage = function() {
	return "chrome://firecommander/skin/row.png";
}

Path.SQLite.Row.prototype.getTable = function() {
	return this._table;
}

Path.SQLite.Row.prototype.supports = function(feature) {
	if (feature == FC.CHILDREN || feature == FC.DELETE) { return true; }
	return false;
}

Path.SQLite.Row.prototype.getParent = function() {
	return this._table;
}

Path.SQLite.Row.prototype.getItems = function() {
	return this._fields;
}

Path.SQLite.Row.prototype.exists = function() {
	return true;
}

Path.SQLite.Row.prototype.update = function(field) {
	return this._table.update(this, field);
}

Path.SQLite.Row.prototype.delete = function() {
	return this._table.delete(this);
}

/***/

/**
 * @param {Path.SQLite} db
 * @param {string} name
 * @param {int} type
 * @param {?} value
 */
Path.SQLite.Field = function(row, name, type, value) {
	Path.call(this);

	this._columns[Panel.DATA] = true;
	this._columns[Panel.SIZE] = false;
	this._columns[Panel.TS] = false;
	this._columns[Panel.ATTR] = false;

	this._row = row;
	this._name = name;
	this._type = type;
	this._value = value;
}

Path.SQLite.Field.prototype = Object.create(Path.prototype);

Path.SQLite.Field.prototype.getName = function() {
	return this._name;
}

Path.SQLite.Field.prototype.getType = function() {
	return this._type;
}

Path.SQLite.Field.prototype.getValue = function() {
	return this._value;
}

Path.SQLite.Field.prototype.getData = function() {
	switch (this._type) {
		case Path.SQLite.TYPE_NULL: return "<NULL>"; break;
		case Path.SQLite.TYPE_INTEGER:
		case Path.SQLite.TYPE_FLOAT: 
			return this._value.toString();
		break;
		case Path.SQLite.TYPE_TEXT: return this._value; break;
		case Path.SQLite.TYPE_BLOB: return "<BLOB>"; break;
		default: return ""; break;
	}
}

Path.SQLite.Field.prototype.getImage = function() {
	return "chrome://firecommander/skin/column.png";
}

Path.SQLite.Field.prototype.activate = function(panel, fc) {
	if (this._type == Path.SQLite.TYPE_BLOB || this._type == Path.SQLite.TYPE_NULL) { return; }
	var result = prompt(this._name+":", this.getData());
	if (result === null) { return; }
	
	switch (this._type) {
		case Path.SQLite.TYPE_INTEGER:
			this._value = parseInt(result, 10) || 0;
		break;
		case Path.SQLite.TYPE_FLOAT:
			this._value = parseFloat(result) || 0;
		break;
		case Path.SQLite.TYPE_TEXT:
			this._value = result;
		break;
	}
	
	this._row.update(this);
	
	panel.resync();
}

Path.SQLite.Field.prototype.getPath = function() {
	return this._row.getPath() + "/" + this._name;
}
