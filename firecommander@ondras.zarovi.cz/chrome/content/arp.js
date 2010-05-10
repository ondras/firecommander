/* Asynchronous Recursive Process */
var ARP = function(fc, path) {
	this._fc = fc;
	this._root = this._buildTree(path, null);
}

ARP.RETRY = "0";
ARP.OVERWRITE = "1";
ARP.OVERWRITE_ALL = "2";
ARP.SKIP = "3";
ARP.SKIP_ALL = "4";
ARP.ABORT = "5";

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

	if (!path.supports(FC.CHILDREN)) { return node; }

	var items = [];	
	try {
		items = path.getItems();
	} catch (e) {}
	
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

ARP.prototype._showIssue = function(text, title, buttons) {
	var data = {
		result: null,
		title: title,
		text: text,
		buttons: buttons
	}
	window.openDialog("chrome://firecommander/content/issue/issue.xul", "", "chrome,centerscreen,modal", data);
	return data.result;
}

/* DELETE */

ARP.Delete = function(fc, path, panel) {
	ARP.call(this, fc, path);
	this._panel = panel;
	this._skip = false;
	this._progress = null;
	this._count = {
		total: 0,
		done: 0
	}
}

ARP.Delete.prototype = Object.create(ARP.prototype);

ARP.Delete.prototype._init = function() {
	this._count.total = this._root.count;

	var data = {
		"title": this._fc.getText("delete.title"),
		"row1-label": this._fc.getText("delete.deleting"),
		"row1-value": this._root.path.getPath(),
		"row2-label": null,
		"row2-value": null,
		"progress1-label": this._fc.getText("progress.total"),
		"progress2-label": null,
		"progress2": null
	};

	this._progress = new Progress(data);
}

ARP.Delete.prototype._processNode = function(node) {
	this._removeNode(node);
	var done = false;
	this._progress.update({"row1-value":node.path.getPath()});
	do {
		try {
//			node.path.delete();
			done = true;
		} catch (e) {
			if (this._skip) {
				done = true;
			} else {
				var text = this._fc.getText("error.delete", node.path.getPath()) + " (" + e.name + ")";
				var title = this._fc.getText("error");
				var result = this._showIssue(text, title, [ARP.RETRY, ARP.SKIP, ARP.SKIP_ALL, ARP.ABORT]);
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
	this._progress.update({"progress1": this._count.done / this._count.total * 100});
	
	return false; /* sync */
}

ARP.Delete.prototype._shutdown = function() {
	this._progress.close();
	this._panel.refresh();
}
