/**
 * Threaded asynchronous operation
 */
var Operation = function(fc) {
	this._fc = fc;
	this._progress = null;
	this._issues = {};
	this._abort = false;
}

Operation.RETRY 		= "0";
Operation.OVERWRITE		= "1"; 
Operation.OVERWRITE_ALL	= "2"; 
Operation.SKIP			= "3";
Operation.SKIP_ALL		= "4";
Operation.ABORT			= "5";

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
	if (!callbackMethod || callbackMethod === true) { callbackMethod = function() {}; }
	
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
	window.openDialog("issue/issue.xul", "", "chrome,centerscreen,modal", data);
	if (this._progress) { this._progress.focus(); }
	return data.result;
}

Operation.prototype._updateProgress = function(data) {
	this._progress.update(data);
}

Operation.prototype.abort = function() {
	this._abort = true;
}

/**
 * @returns {number} 0 = ok, 1 = skipped, 2 = aborted
 */
Operation.prototype._repeatedAttempt = function(code, str, issueName) {
	while (1) {
		try {
			code();
			return 0;
		} catch (e) {
			if (this._issues[issueName]) { return 1; } /* already configured to skip */
			
			var text = this._fc.getText("error."+issueName, str) + " (" + e.name + ")";
			var title = this._fc.getText("error");
			var buttons = [Operation.RETRY, Operation.SKIP, Operation.SKIP_ALL, Operation.ABORT];
			var result = this._runInMainThread(this._showIssue, [text, title, buttons], null);
			
			switch (result) {
				case Operation.RETRY:
				break;
				
				case Operation.SKIP:
					return 1;
				break;
				
				case Operation.SKIP_ALL:
					this._issues[issueName] = true;
					return 1;
				break;
				
				case Operation.ABORT:
					return 2;
				break;
			}
			
		}
	}
}

/***/

Operation.Scan = function(fc, path, callback) {
	Operation.call(this, fc);
	this._callback = callback;
	this._root = null;
	
	var data = {
		"title": this._fc.getText("scan.title"),
		"row1-label": this._fc.getText("scan.working"),
		"row1-value": path.getPath(),
		"row2-label": null,
		"row2-value": null,
		"progress2-label": null,
		"progress2": null
	};

	this._progress = new Progress(this, data, {progress1:"undetermined"});
	this._runInWorkerThread(this._buildTree, [path], this._done);
}

Operation.Scan.prototype = Object.create(Operation.prototype);

Operation.Scan.prototype._buildTree = function(path) {
	this._root = this._buildNode(path, null);
}

Operation.Scan.prototype._buildNode = function(path, parent) {
	if (this._abort) { return true; }

	var node = {
		path: path,
		children: [],
		parent: parent,
		count: 1,
		size: 0
	}

	if (!path.supports(FC.CHILDREN)) { 
		node.size = path.getSize() || 0;
		return node; 
	}

	var items = [];	
	try {
		items = path.getItems();
	} catch (e) {}
	
	for (var i=0;i<items.length;i++) {
		var item = items[i];
		var child = arguments.callee.call(this, item, node);
		node.children.push(child);
		node.count += child.count;
		node.size += child.size;
	}
	
	return node;
}

Operation.Scan.prototype._done = function() {
	this._progress.close();
	this._progress = null;
	this._callback(this._root);
}

/***/

Operation.Delete = function(fc, path, callback) {
	Operation.call(this, fc);

	this._callback = callback;
	this._issues.delete = false;
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
		"title": this._fc.getText("delete.title"),
		"row1-label": this._fc.getText("delete.working"),
		"row2-label": null,
		"row2-value": null,
		"progress1-label": this._fc.getText("progress.total"),
		"progress2-label": null,
		"progress2": null
	};
	this._progress = new Progress(this, data);

	this._runInWorkerThread(this._deleteNode, [root], this._done);
}

Operation.Delete.prototype._done = function() {
	this._progress.close();
	this._progress = null;
	this._callback();
}

/**
 * @returns {bool} false = ok, true = abort!
 */
Operation.Delete.prototype._deleteNode = function(node) {
	if (this._abort) { return true; }

	var children = node.children;
	for (var i=0; i<children.length; i++) {
		var result = arguments.callee.call(this, children[i]);
		if (result) { return true; }
	}

	this._runInMainThread(this._updateProgress, [{"row1-value":node.path.getPath()}], true);

	var func = function() { node.path.delete(); }
	var result = this._repeatedAttempt(func, node.path.getPath(), "delete");
	if (result == 2) { return true; }
	
	this._count.done++;
	this._runInMainThread(this._updateProgress, [{"progress1": this._count.done / this._count.total * 100}], true);
	return false;
}

/***/

Operation.Copy = function(fc, sourcePath, targetPath, callback) {
	Operation.call(this, fc);
	
	this._callback = callback;
	this._targetPath = targetPath;
	this._prefix = "copy";
	
	this._init();
	new Operation.Scan(fc, sourcePath, this._treeDone.bind(this));
}

Operation.Copy.prototype = Object.create(Operation.prototype);

Operation.Copy.prototype._init = function() {
	this._issues.read = false;
	this._issues.write = false;
	this._issues.create = false;
	this._issues.overwrite = false;
	this._issues.ln = false;
	
	this._count = {
		total: 0,
		done: 0
	}
} 

Operation.Copy.prototype._treeDone = function(root) {
	this._count.total = root.size;

	var data = {
		"title": this._fc.getText(this._prefix + ".title"),
		"row1-label": this._fc.getText(this._prefix + ".working"),
		"row2-label": this._fc.getText(this._prefix + ".to"),
		"progress1-label": this._fc.getText("progress.total"),
		"progress2-label": this._fc.getText("progress.file"),
	};
	this._progress = new Progress(this, data);

	this._runInWorkerThread(this._copyNode, [root], this._done);
}

Operation.Copy.prototype._done = function() {
	this._progress.close();
	this._progress = null;
	this._callback();
}

Operation.Copy.prototype._newPath = function(node) {
	/* one-to-one copy with new name */
	if (!this._targetPath.exists()) { return this._targetPath; }
	
	var names = [];
	do {
		names.unshift(node.path.getName());
		node = node.parent;
	} while (node);
	
	var newPath = this._targetPath;
	while (names.length) { newPath = newPath.append(names.shift()); }
	return newPath;
}

/**
 * @returns {bool} false = ok, true = abort!
 */
Operation.Copy.prototype._copyNode = function(node) {
	var newPath = this._newPath(node);
	var data = {
		"row1-value": node.path.getPath(),
		"row2-value": newPath.getPath(),
		"progress2": 0
	}
	this._runInMainThread(this._updateProgress, [data], true);
	
	var dir = node.path.supports(FC.CHILDREN);
	var result = this._createPath(newPath, dir);
	
	switch (result) {
		case 0: /* okay */
			if (dir) { /* recurse */
				var children = node.children; 
				for (var i=0; i<children.length; i++) {
					result = this._copyNode(children[i]);
					if (result) { return true; }
				}
			} else if (!node.path.isSymlink()) { /* copy contents */
				result = this._copyContents(node.path, newPath);
				if (result) { return true; }
			} else { /* symlink, evil */
				result = this._copySymlink(node.path, newPath);
			}
		break;
		
		case 1: /* skipped */
			this._count.done += node.bytes;
		break;
		
		case 2:
			return true; /* abort */
		break;
	}
	
	this._runInMainThread(this._updateProgress, [{"progress1": this._count.done / this._count.total * 100}], true);
	return false;
}

Operation.Copy.prototype._copyContents = function(oldPath, newPath) {
	var size = oldPath.getSize() || 0;
	var is = oldPath.inputStream();
	var os;
	
	var func = function() { os = newPath.outputStream(); }
	var result = this._repeatedAttempt(func, newPath.getPath(), "create");
	
	if (result == 2) { 
		return true;
	} else if (result == 1) {
		this._count.done += size;
		return false;
	}
	
	var bis = Cc["@mozilla.org/binaryinputstream;1"].createInstance(Ci.nsIBinaryInputStream);
	bis.setInputStream(is);
	var bos = Cc["@mozilla.org/binaryoutputstream;1"].createInstance(Ci.nsIBinaryOutputStream);
	bos.setOutputStream(os);
	
	var bufferSize = 0x10000;
	var bytesDone = 0;
	
	while (bis.available()) {
		if (this._abort) {
			bis.close();
			bos.close();
			return true;
		}
		
		var amount = Math.min(bis.available(), bufferSize);

		var bytes = bis.readBytes(amount);
		bos.writeBytes(bytes, bytes.length);
		
		bytesDone += amount;
		this._count.done += amount;
		
		var data = {
			"progress1": this._count.done / this._count.total * 100,
			"progress2": bytesDone / size * 100
		}
	
		this._runInMainThread(this._updateProgress, [data], true); /* update ui */
	}
	
	bis.close();
	bos.close();
	
	return false;
}

/**
 * @returns {int} status: 0 = ok, 1 = failed, 2 = abort
 */
Operation.Copy.prototype._copySymlink = function(oldPath, newPath) {
	/* try to locate "ln" */
	var fn = null;
	var path = "/bin/ln";
	var func = function() { 
		ln = Path.Local.fromString(path); 
		if (!ln.exists()) { throw Cr.NS_ERROR_FILE_NOT_FOUND; }
	};
	var result = this._repeatedAttempt(func, path, "ln");
	if (result) { return result; }
	
	if (newPath.exists()) { /* existing must be removed */
		var func = function() { newPath.delete(); }
		var result = this._repeatedAttempt(func, newPath, "create");
		if (result) { return result; }
	}
	
	/* run it as a process */
	var process = Cc["@mozilla.org/process/util;1"].createInstance(Ci.nsIProcess);
	process.init(ln.getFile());
	var params = ["-s", oldPath.getPath(), newPath.getPath()];
	
	var func = function() { 
		process.run(false, params, params.length);
		var cnt = 0; 
		while (process.exitValue == -1) { /* wait for exitValue */
			cnt++;
			if (cnt > 100000) { break; } /* no infinite loops */
		}
		if (process.exitValue) { throw Cr.NS_ERROR_FILE_ACCESS_DENIED; }
	}
	return this._repeatedAttempt(func, newPath.getPath(), "create");
}

/**
 * @returns {int} status: 0 = ok, 1 = failed, 2 = abort
 */
Operation.Copy.prototype._createPath = function(newPath, directory) {
	if (!directory && newPath.exists()) { /* it is a file and it already exists */
		if (this._issues.overwrite == "skip") { return 1; } /* silently skip */
		if (this._issues.overwrite == "all") { return 0; } /* we do not care */

		var text = this._fc.getText("error.exists", newPath.getPath());
		var title = this._fc.getText("error");
		var buttons = [Operation.OVERWRITE, Operation.OVERWRITE_ALL, Operation.SKIP, Operation.SKIP_ALL, Operation.ABORT];
		var result = this._runInMainThread(this._showIssue, [text, title, buttons], null);
		
		switch (result) {
			case Operation.OVERWRITE:
			break;
			case Operation.OVERWRITE_ALL:
				this._issues.overwrite = "all";
			break;
			case Operation.SKIP:
				return 1;
			break;
			case Operation.SKIP_ALL:
				this._issues.overwrite = "skip";
				return 1;
			break;
			case Operation.ABORT:
				return 2;
			break;
		}
	}
	
	if (!directory || newPath.exists()) { return 0; } /* nothing to do with file or existing directory */
	
	var func = function() { newPath.create(true); }
	return this._repeatedAttempt(func, newPath.getPath(), "create");
}

Operation.Move = function(fc, sourcePath, targetPath, callback) {
	Operation.Copy.call(this, fc, sourcePath, targetPath, callback);
}

Operation.Move.prototype = Object.create(Operation.Copy.prototype);

Operation.Move.prototype._init = function() {
	Operation.Copy.prototype._init.call(this);
	this._issues.delete = false;
	this._prefix = "move";
}

Operation.Move.prototype._copyNode = function(node) {
	var result = Operation.Copy.prototype._copyNode.call(this, node);
	if (result) { return true; }
	
	var func = function() { node.path.delete(); };
	result = this._repeatedAttempt(func, node.path.getPath(), "delete");
	
	return (result == 2 ? true : false );
}

Operation.Search = function(fc, params, itemCallback, doneCallback) {
	Operation.call(this, fc);
	this._itemCallback = itemCallback;
	this._doneCallback = doneCallback;
	this._params = params;
	
	var re = params.term;
	re = re.replace(/\./g, "\\.");
	re = re.replace(/\*/g, ".*");
	re = re.replace(/\?/g, ".");
	re = ".*"+re+".*";
	this._re = new RegExp(re);
	
	var data = {
		"title": this._fc.getText("search.title"),
		"row1-label": this._fc.getText("search.working"),
		"row1-value": params.path.getPath(),
		"row2-label": null,
		"row2-value": null,
		"progress2-label": null,
		"progress2": null
	};

	this._progress = new Progress(this, data, {progress1:"undetermined"});
	this._runInWorkerThread(this._searchPath, [params.path], this._done);
}

Operation.Search.prototype = Object.create(Operation.prototype);

Operation.Search.prototype._searchPath = function(path) {
	if (this._abort) { return true; }

	var items = [];	
	try {
		items = path.getItems();
	} catch (e) {}
	if (!items.length) { return; }

	var data = {"row1-value": path.getPath()};
	this._runInMainThread(this._updateProgress, [data], true);

	for (var i=0;i<items.length;i++) { 
		var item = items[i];
		var name = item.getName();
		if (name.match(this._re)) { this._itemCallback(item); }
		if (item.supports(FC.CHILDREN)) { arguments.callee.call(this, item); }
	}
	
}

Operation.Search.prototype._done = function() {
	this._progress.close();
	this._progress = null;
	this._doneCallback();
}

