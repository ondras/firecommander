/**
 * Progressbar window 
 * @param {object} [data]
 * @param {string || null} [data.progress1]
 * @param {string || null} [data.progress2]
 * @param {string} [data.progress1-label]
 * @param {string} [data.progress2-label]
 * @param {string} [data.row1-label]
 * @param {string} [data.row1-value]
 * @param {string} [data.row2-label]
 * @param {string} [data.row2-value]
 * @param {string} [data.title]
 * 
 * @param {object} [mode]
 * @param {string} [mode.progress1]
 * @param {string} [mode.progress2]
 */
var Progress = function(owner, data, mode) {
	this._loaded = false;
	this._owner = owner;
	this._ec = [];
	this._data = {
		"row1-label": "",
		"row1-value": "",
		"row2-label": "",
		"row2-value": "",
		"progress1-label": "",
		"progress2-label": "",
		"progress1": 0,
		"progress2": 0
	};
	
	this._mode = {
		"progress1": "determined",
		"progress2": "determined"
	}
	for (var p in mode) { this._mode[p] = mode[p]; }
	
	this.update(data);
	this._win = window.openDialog("progress/progress.xul", "", "chrome,centerscreen");

	this._win.addEventListener("load", this);
	this._win.addEventListener("dialogcancel", this);
}

Progress.prototype.handleEvent = function(e) {
	switch (e.type) {
		case "load":
			this._loaded = true;
			
			var doc = this._win.document;
			for (var id in this._mode) { doc.getElementById(id).mode = this._mode[id]; }
			
			this._sync(this._data);
			this._win.sizeToContent();
		break;

		case "dialogcancel": /* Dialog cancelled by user */
			this._win = null;
			this._owner.abort();
		break;
	}
}

/**
 * @see Progress
 */
Progress.prototype.update = function(data) {
	if (this._loaded) {
		this._sync(data);
	} else {
		for (var p in data) { this._data[p] = data[p]; }
	}
}

Progress.prototype.close = function() {
	if (!this._win) { return; }

	this._win.close();
	this._win = null;
}

Progress.prototype.focus = function() {
	this._win.focus();
}

/**
 * Sync window contents with given data 
 */
Progress.prototype._sync = function(data) {
	if (!this._win) { return; } /* dead */
	
	var doc = this._win.document;
	if (data.title) { doc.title = data.title; }
	
	for (var p in data) {
		if (p == "title") { 
			doc.title = data[p]; 
		} else {
			var value = data[p];
			var elm = doc.getElementById(p);
			if (value === null) {
				elm.style.display = "none";
			} else {
				elm.style.display = "";
				elm.value = value;
			}
		}
	}
}
