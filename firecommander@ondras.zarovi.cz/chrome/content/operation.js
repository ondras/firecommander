/**
 * Threaded asynchronous operation
 */
var Operation = function(fc) {
	this._fc = fc;
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

Operation.prototype._buildTree = function(path) {
	return this._buildNode(path, null);
}

Operation.prototype._buildNode = function(path, parent) {
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

Operation.prototype._showIssue = function(text, title, buttons) {
	var data = {
		result: null,
		title: title,
		text: text,
		buttons: buttons
	}
	window.openDialog("chrome://firecommander/content/issue/issue.xul", "", "chrome,centerscreen,modal", data);
	return data.result;
}

Operation.Delete = function(fc, panel, path) {
	Delete.call(this, fc);

	this._panel = panel;
	this._root = null;
	this._skip = false;
	this._progress = null;
	this._count = {
		total: 0,
		done: 0
	}

	this._go(path);
}

Operation.Delete.prototype = Object.create(Operation.prototype);

Operation.Delete.prototype._go = function(path) {
	this._root = this._runInWorkerThread(this._buildTree, [path], null);
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
	this._runInWorkerThread(this._deleteTree, [], this._done);
}

Operation.Delete.prototype._done = function() {
	this._progress.close();
	this._panel.refresh();
}

Operation.Delete.prototype._updateProgress = function(data) {
	this._progress.update(data);
}

Operation.Delete.prototype._deleteTree = function() {
	this._deleteNode(this._root);
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
