/**
 * Threaded asynchronous operation
 */
var Operation = function(fc) {
	this._fc = fc;
	this._progress = null;
}

/**
 * @param {nsIThread} thread other thread
 * @param {function} method function to be called
 * @param {any[]} args arguments to method
 * @param {function || null} callbackMethod null = block, otherwise run async and execute callbackMethod when finished
 */
Operation.prototype._runInThread = function(thread, method, args, callbackMethod) {
	/* this thread might wait */
	var currentThread = Cc["@mozilla.org/thread-manager;1"].getService(Ci.nsIThreadManager).currentThread;

	/* lock */
	var done = (callbackMethod ? true : false);

	/* wakeup / callback */
	if (!callbackMethod) { callbackMethod = function() {}; }
	
	/* call result */
	var result = null;
	
	/* do this in second thread */
	var work = function() {
		result = method.apply(this, args);
		done = true; /* if blocking */

		/* wake original thread */
		currentThread.dispatch({run:callbackMethod.bind(this)}, currentThread.DISPATCH_NORMAL);
	}
	
	/* let second thread work */
	thread.dispatch({run:work.bind(this)}, thread.DISPATCH_NORMAL);
	
	/* block if no callback method specified */
	while (!done) { currentThread.processNextEvent(true); }
	
	return result;
}

Operation.prototype._runInWorkerThread = function(method, args, callback) {
	var thread = Cc["@mozilla.org/thread-manager;1"].getService(Ci.nsIThreadManager).newThread(0);
	return this._runInThread(thread, method, args, callback);
}

Operation.prototype._runInMainThread = function(method, args, callback) {
	var thread = Cc["@mozilla.org/thread-manager;1"].getService(Ci.nsIThreadManager).mainThread;
	return this._runInThread(thread, method, args, callback);
}

Operation.prototype._showIssue = function(text, title, buttons) {
	var data = {
		result: null,
		title: title,
		text: text,
		buttons: buttons
	}
	window.openDialog("chrome://firecommander/content/issue/issue.xul", "", "chrome,centerscreen,modal", data);
	if (this._progress) { this._progress.focus(); }
	return data.result;
}

/***/

Operation.Scan = function(fc, path, callback) {
	Operation.call(this, fc);
	this._callback = callback;
	this._root = null;
	
	var data = {
		"title": this._fc.getText("scan.title"),
		"row1-label": this._fc.getText("scan.scanning"),
		"row1-value": path.getPath(),
		"row2-label": null,
		"row2-value": null,
		"progress2-label": null,
		"progress2": null
	};

	this._progress = new Progress(data, {progress1:"undetermined"});
	this._runInWorkerThread(this._buildTree, [path], this._done);
}

Operation.Scan.prototype = Object.create(Operation.prototype);

Operation.Scan.prototype._buildTree = function(path) {
	this._root = this._buildNode(path, null);
}

Operation.Scan.prototype._buildNode = function(path, parent) {
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

Operation.Scan.prototype._done = function() {
	this._progress.close();
	this._progress = null;
	this._callback(this._root);
}

/***/

Operation.Delete = function(fc, panel, path) {
	Operation.call(this, fc);

	this._panel = panel;
	this._skip = false;
	this._count = {
		total: 0,
		done: 0
	}
	
	new Operation.Scan(fc, path, this._treeDone.bind(this));
}

Operation.Delete.prototype = Object.create(Operation.prototype);

Operation.Delete.prototype._treeDone = function(root) {
	this._count.total = root.count;
	
	var data = {
		"row1-label": this._fc.getText("delete.deleting"),
		"row2-label": null,
		"row2-value": null,
		"progress1-label": this._fc.getText("progress.total"),
		"progress2-label": null,
		"progress2": null
	};
	this._progress = new Progress(data);

	this._runInWorkerThread(this._deleteTree, [root], this._done);
}

Operation.Delete.prototype._done = function() {
	this._progress.close();
	this._progress = null;
	this._panel.refresh();
}

Operation.Delete.prototype._updateProgress = function(data) {
	this._progress.update(data);
}

Operation.Delete.prototype._deleteTree = function(root) {
	this._deleteNode(root);
}

Operation.Delete.prototype._deleteNode = function(node) {
	var children = node.children;
	for (var i=0; i<children.length; i++) {
		var result = arguments.callee.call(this, children[i]);
		if (result) { return true; }
	}

	var done = false;
	this._runInMainThread(this._updateProgress, [{"row1-value":node.path.getPath()}], null);

	do {
		try {
			node.path.delete();
			done = true;
		} catch (e) {
			if (this._skip) {
				done = true;
			} else {
				var text = this._fc.getText("error.delete", node.path.getPath()) + " (" + e.name + ")";
				var title = this._fc.getText("error");
				var buttons = [ARP.RETRY, ARP.SKIP, ARP.SKIP_ALL, ARP.ABORT];
				var result = this._runInMainThread(this._showIssue, [text, title, buttons], null);
				
				switch (result) {
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
						return true;
					break;
				} 
			} 
		} 
	} while (!done);
	
	this._count.done++;
	this._runInMainThread(this._updateProgress, [{"progress1": this._count.done / this._count.total * 100}], null);
	return false;
}
