/* Asynchronous Recursive Process */
var ARP = function(fc, path) {
	this._fc = fc;
	this._root = this._buildTree(path, null);
}

ARP.RETRY = 0;
ARP.OVERWRITE = 1;
ARP.OVERWRITE_ALL = 2;
ARP.SKIP = 3;
ARP.SKIP_ALL = 4;
ARP.ABORT = 5;

ARP.prototype.go = function() {
	this._init();
	this._process();
}

ARP.prototype._init = function() {
}

/**
 * Start processing current node. Descend if necessary.
 */
ARP.prototype._process = function() {
	var async = false;
	do {
		var current = this._root;
		if (!current) {
			this._shutdown();
			return;
		}
		
		while (current.children.length) { current = current.children[0]; }
		async = this._processNode(current);
	} while (!async);
}

/**
 * Process one tree node
 * @returns {bool} async (true = wait, false = continue)
 */
ARP.prototype._processNode = function(node) {
	this._removeNode(node);
	return false;
}

ARP.prototype._removeNode = function(node) {
	var parent = node.parent;
	if (parent) {
		var index = parent.children.indexOf(node); /* should be 0, but... */
		parent.children.splice(index, 1);
		node.parent = null;
	} else { /* root! */
		this._root = null;
	}
}

/**
 * Create a tree of paths
 */ 
ARP.prototype._buildTree = function(path, parent) {
	var node = {
		path: path,
		children: [],
		parent: parent,
		count: 1
	}
	
	var items = path.getItems();
	if (!items) { return node; }
	
	for (var i=0;i<items.length;i++) {
		var item = items[i];
		var child = arguments.callee.call(this, item, node);
		node.children.push(child);
		node.count += child.count;
	}
	
	return node;
}

/**
 * We are done
 */
ARP.prototype._shutdown = function() {
}

ARP.prototype._showProgress = function(data) {
	this._progress = window.openDialog("chrome://firecommander/content/progress.xul", "", "chrome,centerscreen");
	this._progress.addEventListener("load", (function(e){
		if (!this._progress) { return; }

		var doc = this._progress.document;
		doc.title = data.title;
		doc.getElementById("progress1").value = 0;
		doc.getElementById("progress2").value = 0;

		if (data.row1) {
			doc.getElementById("row1-label").value = data.row1[0];
			doc.getElementById("row1-value").value = data.row1[1];
		}

		if (data.row2) {
			doc.getElementById("row2-label").value = data.row2[0];
			doc.getElementById("row2-value").value = data.row2[1];
		}

		if (data.progress1) {
			doc.getElementById("progress1-label").value = data.progress1;
			doc.getElementById("progress1").style.display = "";
		} else {
			doc.getElementById("progress1-label").value = "";
			doc.getElementById("progress1").style.display = "none";
		}

		if (data.progress2) {
			doc.getElementById("progress2-label").value = data.progress2;
			doc.getElementById("progress2").style.display = "";
		} else {
			doc.getElementById("progress2-label").value = "";
			doc.getElementById("progress2").style.display = "none";
		}
		
		this._progress.sizeToContent();
	}).bind(this), false);
}

ARP.prototype._hideProgress = function() {
	this._progress.close();
	this._progress = null;
}

ARP.prototype._updateProgress = function(value1, value2) {
	if (this._progress.document.readyState != "complete") { return; }
	
	var doc = this._progress.document;
	if (value1 !== null) { doc.getElementById("progress1").value = value1; }
	if (value2 !== null) { doc.getElementById("progress2").value = value2; }
}

/* DELETE */

ARP.Delete = function(fc, path, panel) {
	ARP.call(this, fc, path);
	this._panel = panel;
	this._skip = false;
	this._count = {
		total: 0,
		done: 0
	}
}

ARP.Delete.prototype = Object.create(ARP.prototype);

ARP.Delete.prototype._init = function() {
	this._count.total = this._root.count;

	var data = {
		title: this._fc.getText("delete.title"),
		row1: [this._fc.getText("delete.deleting"), this._root.path.getPath()],
		row2: ["", ""],
		progress1: this._fc.getText("progress.total"),
		progress2: null
	}
	this._showProgress(data);
}

ARP.Delete.prototype._processNode = function(node) {
	this._removeNode(node);
	var done = false;
	do {
		try {
			node.path.delete();
			done = true;
		} catch (e) {
			if (this._skip) {
				done = true;
			} else {
				/* FIXME */
				var result = this._showIssue(e, node.path);
				switch(result) {
					case ARP.RETRY: 
					break;
					case ARP.SKIP: 
						done = true;
					break;
					case ARP.SKIP_ALL: 
						this._skip = true;
						done = true;
					break;
					case ARP.ABORT: 
						this._root = null; /* shutdown */
						done = true;
					break;
				} /* switch */
			} /* not skipping */
		} /* catch */
	} while (!done);
	
	this._count.done++;
	this._updateProgress(this._count.done / this._count.total * 100, null);
	return false; /* sync */
}

ARP.Delete.prototype._shutdown = function() {
	this._hideProgress();
	this._panel.refresh();
}
