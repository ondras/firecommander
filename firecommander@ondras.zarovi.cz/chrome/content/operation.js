/**
 * Asynchronous, potentially lengthy, operation
 * @param {function} callback What to do when this ends
 */
var Operation = function(callback) {
	this._callback = callback;
	this._timeout = {
		progress: 500, /* to show a progress */
		iteration: 300 /* to delay execution */
	}
	this._progress = null; /* progress dialog */
	this._progressData = {}; /* deferred progress data */
	this._issues = {}; /* potential issues and user responses */
	
	this._state = Operation.READY;
	this._startTime = new Date().getTime(); /* ts of operation start, to measure the time */
	
	this._run = this._run.bind(this); /* optimize repeated calls in setTimeout */
}

Operation.READY		= 0;
Operation.FINISHED	= 1;
Operation.PAUSED	= 2;
Operation.ABORTED	= 3;

Operation.RETRY 		= "0";
Operation.OVERWRITE		= "1"; 
Operation.OVERWRITE_ALL	= "2"; 
Operation.SKIP			= "3";
Operation.SKIP_ALL		= "4";
Operation.ABORT			= "5";

/**
 * Work done
 */
Operation.prototype._done = function() {
	this._hideProgress();
	this._callback();
}

/**
 * Operation taking too long, show the progress window
 */
Operation.prototype._showProgress = function(data, mode) {
	this._progress = new Progress(this, data, mode);
	if (this._progressData) {
		this._progress.update(this._progressData);
		this._progressData = {};
	}
}

Operation.prototype._hideProgress = function() {
	if (!this._progress) { return; }
	this._progress.close();
	this._progress = null;
}

Operation.prototype._updateProgress = function(data) {
	if (!this._progress) { 
		for (var p in data) { this._progressData[p] = data[p]; }
	} else {
		this._progress.update(data);
	}
}

Operation.prototype._run = function() {
	var ts1 = new Date().getTime(), ts2;
	while (1) {
		this._iterate();
		
		if (this._state == Operation.PAUSED) { return; }

		if (this._state == Operation.FINISHED || this._state == Operation.ABORTED) { 
			this._done();
			return; 
		}

		ts2 = new Date().getTime();
		if (!this._progress && (ts2 - this._startTime) > this._timeout.progress) { this._showProgress(); }
		if (ts2-ts1 > this._timeout.iteration) { break; }
	};
	setTimeout(this._run, 0);
}

/**
 * Perform an elementary operation. This should not take much time.
 * This function must block.
 */
Operation.prototype._iterate = function() {
}

Operation.prototype._showIssue = function(text, title, buttons) {
	var data = {
		result: null,
		title: title,
		text: text,
		buttons: buttons
	}
	window.openDialog("issue/issue.xul", "", "chrome,centerscreen,modal", data); /* blocks */
	
	if (this._progress) { 
		this._progress.focus(); 
	} else { /* no progress, but the issue took some time */
		this._startTime = new Date().getTime();
	}
	return data.result;
}

/**
 * Abortable from the progress dialog
 */
Operation.prototype.abort = function() {
	this._state = Operation.ABORTED;
}

/**
 * @returns {bool} Was the attempt finally successfull?
 */
Operation.prototype._repeatedAttempt = function(code, str, issueName) {
	while (1) {
		try {
			code();
			return true;
		} catch (e) {
			if (this._issues[issueName]) { return 1; } /* already configured to skip */
			
			var text = _("error."+issueName, str) + " (" + e.name + ")";
			var title = _("error");
			var buttons = [Operation.RETRY, Operation.SKIP, Operation.SKIP_ALL, Operation.ABORT];
			var result = this._showIssue(text, title, buttons);
			
			switch (result) {
				case Operation.RETRY:
				break;
				
				case Operation.SKIP:
					return false;
				break;
				
				case Operation.SKIP_ALL:
					this._issues[issueName] = true;
					return false;
				break;
				
				case Operation.ABORT:
					this._state = Operation.ABORTED;
					return false;
				break;
			}
			
		}
	}
}

/***/

Operation.Scan = function(callback, path) {
	Operation.call(this, callback);

	this._root = this._pathToNode(path, null);
	this._currentNode = this._root;

	this._run();
}

Operation.Scan.prototype = Object.create(Operation.prototype);

Operation.Scan.prototype._showProgress = function() {
	var data = {
		"title": _("scan.title"),
		"row1-label": _("scan.working"),
		"row1-value": null,
		"row2-label": null,
		"row2-value": null,
		"progress2-label": null,
		"progress2": null
	};
	Operation.prototype._showProgress.call(this, data, {progress1:"undetermined"});
}

/**
 * 
 */
Operation.Scan.prototype._iterate = function() {
	/* climb up until we reach top or something with children */
	while (this._currentNode.parent && !this._currentNode.todo.length) { 
		var parent = this._currentNode.parent;
		parent.count += this._currentNode.count;
		parent.size += this._currentNode.size;
		this._currentNode = parent;
	}
	
	/* there are unvisited children in this node */
	if (this._currentNode.todo.length) {
		/* take first unvisited */
		var childPath = this._currentNode.todo.shift();
		var childNode = this._pathToNode(childPath, this._currentNode);
		/* add it to list of processed children */
		this._currentNode.children.push(childNode);
		/* move there */
		this._currentNode = childNode;
	} else { /* finished? */
		this._state = Operation.FINISHED;
	}
}

/**
 * Create a result node, based on a path
 */
Operation.Scan.prototype._pathToNode = function(path, parent) {
	this._updateProgress({"row1-value":path.getPath()});

	var node = {
		path: path,
		children: [],
		todo: [],
		parent: parent,
		count: 1,
		size: 0
	};
	
	if (!path.supports(FC.CHILDREN)) { 
		node.size = path.getSize() || 0;
		return node; 
	}

	try {
		node.todo = path.getItems();
	} catch (e) {}
	
	return node;
}

Operation.Scan.prototype._done = function() {
	this._hideProgress();
	this._callback(this._root);
}

/***/

Operation.Delete = function(callback, path) {
	Operation.call(this, callback);

	this._issues.delete = false;
	this._count = {
		total: 0,
		done: 0
	}
	
	new Operation.Scan(this._scanDone.bind(this), path);
}

Operation.Delete.prototype = Object.create(Operation.prototype);

Operation.Delete.prototype._scanDone = function(root) {
	if (!root) { return this._done(); }
	
	this._count.total = root.count;
	this._currentNode = root;
	
	this._run();
}

Operation.Delete.prototype._showProgress = function() {
	var data = {
		"title": _("delete.title"),
		"row1-label": _("delete.working"),
		"row2-label": null,
		"row2-value": null,
		"progress1-label": _("progress.total"),
		"progress2-label": null,
		"progress2": null
	};
	Operation.prototype._showProgress.call(this, data);
}

/**
 * Remove one node
 */
Operation.Delete.prototype._iterate = function() {
	/* descend to first deletable node */
	while (this._currentNode.children.length) {
		this._currentNode = this._currentNode.children[0];
	}
	
	/* show where are we */
	var path = this._currentNode.path;
	this._updateProgress({"row1-value":path.getPath()});

	/* try to remove */
	var func = function() { path.delete(); }
	var result = this._repeatedAttempt(func, path.getPath(), "delete");
	if (this._state == Operation.ABORTED) { return; }
	
	/* climb one step up */
	this._currentNode = this._currentNode.parent;
	if (!this._currentNode) { /* top-level */
		this._state = Operation.FINISHED;
	} else { /* remove child */
		this._currentNode.children.shift();
	}

}

/***/

Operation.Copy = function(callback, sourcePath, targetPath) {
	Operation.call(this, callback);
	
	this._targetPath = targetPath;
	this._prefix = "copy";
	
	this._init();
	new Operation.Scan(this._scanDone.bind(this), sourcePath);
}

Operation.Copy.prototype = Object.create(Operation.prototype);

Operation.Copy.prototype._init = function() {
	this._issues.read = false;
	this._issues.write = false;
	this._issues.create = false;
	this._issues.overwrite = false;
	this._issues.ln = false;
	
	this._current = {
		is: null,
		os: null,
		bytesDone: 0,
		size: 0
	};

	this._count = {
		total: 0,
		done: 0
	}
} 

Operation.Copy.prototype._scanDone = function(root) {
	if (!root) { return; } /* FIXME urcite? co nejaky callback? */
	this._count.total = root.size;
	
	this._node = root;
	
	this._run();
}

Operation.Copy.prototype._showProgress = function() {
	var data = {
		"title": _(this._prefix + ".title"),
		"row1-label": _(this._prefix + ".working"),
		"row2-label": _(this._prefix + ".to"),
		"progress1-label": _("progress.total"),
		"progress2-label": _("progress.file"),
	};
	Operation.prototype._showProgress.call(this, data);
}

Operation.Copy.prototype._iterate = function() {
	if (this._current.is) {
		var bufferSize = 0x10000;
		var amount = Math.min(this._current.is.available(), bufferSize);

		var bytes = this._current.is.readBytes(amount);
		this._current.os.writeBytes(bytes, bytes.length);
		
		this._current.bytesDone += amount;
		this._count.done += amount;
		
		var data = {
			"progress1": this._count.done / this._count.total * 100,
			"progress2": this._current.bytesDone / this._current.size * 100
		}
		this._updateProgress(data);
		
		if (!this._current.is.available()) {
			this._current.is.close();
			this._current.os.close();
			this._current.is = null;
			this._current.os = null;
			this._nodeFinished();
		}
		
		return;
	}
	
	/* target path for this copy operation */
	var newPath = this._newPath(this._node);
	
	/* update progress window */
	var data = {
		"row1-value": this._node.path.getPath(),
		"row2-value": newPath.getPath(),
		"progress2": 0
	}
	this._updateProgress(data);
	
	/* source = dir? */
	var dir = this._node.path.supports(FC.CHILDREN);

	/* create target path */
	var created = this._createPath(newPath, dir, this._node.path.getTS());
	if (this._state == Operation.ABORTED) { return; }
	
	if (created) {
		if (dir) { 
			/* schedule next child */
			this._nodeFinished(); 
		} else if (!this._node.path.isSymlink()) { 
			/* start copying contents */
			this._copyContents(this._node.path, newPath);
		} else { 
			/* symlink, evil */
			this._copySymlink(this._node.path, newPath);
		}
	} else { /* skipped */
		this._count.done += this._node.bytes;
	}
	
	this._updateProgress({"progress1": this._count.done / this._count.total * 100});
}

/**
 * Create a new (non-existant) target path for currently processed source node
 */
Operation.Copy.prototype._newPath = function(node) {
	/* one-to-one copy with new name */
	if (!this._targetPath.exists() && this._targetPath instanceof Path.Local) { return this._targetPath; }
	
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
 * @returns {bool} whether the path was created
 */
Operation.Copy.prototype._createPath = function(newPath, directory, ts) {
	if (!directory && newPath.exists()) { /* it is a file and it already exists */
		if (this._issues.overwrite == "skip") { return 1; } /* silently skip */
		if (this._issues.overwrite == "all") { return 0; } /* we do not care */

		var text = _("error.exists", newPath.getPath());
		var title = _("error");
		var buttons = [Operation.OVERWRITE, Operation.OVERWRITE_ALL, Operation.SKIP, Operation.SKIP_ALL, Operation.ABORT];
		var result = this._showIssue(text, title, buttons);
		
		switch (result) {
			case Operation.OVERWRITE:
			break;
			case Operation.OVERWRITE_ALL:
				this._issues.overwrite = "all";
			break;
			case Operation.SKIP:
				return false;
			break;
			case Operation.SKIP_ALL:
				this._issues.overwrite = "skip";
				return false;
			break;
			case Operation.ABORT:
				this._state = Operation.ABORTED;
				return false;
			break;
		}
	}
	
	if (!directory || newPath.exists()) { return true; } /* nothing to do with file or existing directory */
	
	var func = function() { newPath.create(true, ts); }
	return this._repeatedAttempt(func, newPath.getPath(), "create");
}

/**
 * We finished copying this node and all its subnodes; let's climb up a bit
 */
Operation.Copy.prototype._nodeFinished = function() {
	var current = this._node;
	
	while (current.parent && !current.children.length) {
		var parent = current.parent;
		var index = parent.children.indexOf(current);
		parent.children.splice(index, 1);
		current = parent;
	}
	
	if (current.children.length) { /* still work to do here */
		this._node = current.children[0];
	} else { /* finished */
		this._state = Operation.FINISHED;
	}
}

/**
 * Start copying contents from oldPath to newPath
 */
Operation.Copy.prototype._copyContents = function(oldPath, newPath) {
	if (newPath instanceof Path.Zip) { /* FIXME? */
		newPath.createFromPath(oldPath);
		this._nodeFinished(); 
		return;
	}
	
	var size = oldPath.getSize() || 0;
	var os;
	var func = function() { os = newPath.outputStream(); }
	var created = this._repeatedAttempt(func, newPath.getPath(), "create");
	if (this._state == Operation.ABORTED) { return; }
	
	if (!created) {
		this._count.done += size;
		return;
	}
	
	var is = oldPath.inputStream();
	var bis = Cc["@mozilla.org/binaryinputstream;1"].createInstance(Ci.nsIBinaryInputStream);
	bis.setInputStream(is);
	var bos = Cc["@mozilla.org/binaryoutputstream;1"].createInstance(Ci.nsIBinaryOutputStream);
	bos.setOutputStream(os);
	
	this._current.is = bis;
	this._current.os = bos;
	this._current.bytesDone = 0;
	this._current.size = size;
}

/**
 * Try to copy symlink
 */
Operation.Copy.prototype._copySymlink = function(oldPath, newPath) {
	/* try to locate "ln" */
	var fn = null;
	var path = "/bin/ln";
	var func = function() { 
		ln = Path.Local.fromString(path); 
		if (!ln.exists()) { throw Cr.NS_ERROR_FILE_NOT_FOUND; }
	};
	var found = this._repeatedAttempt(func, path, "ln");
	if (this._state == Operation.ABORTED || !found) { return; }
	
	if (newPath.exists()) { /* existing must be removed */
		var func = function() { newPath.delete(); }
		var deleted = this._repeatedAttempt(func, newPath, "create");
		if (this._state == Operation.ABORTED || !deleted) { return; }
	}
	
	/* run it as a process */
	var process = Cc["@mozilla.org/process/util;1"].createInstance(Ci.nsIProcess);
	process.init(ln.getFile());
	var params = ["-s", oldPath.getPath(), newPath.getPath()];
	
	var func = function() { 
		process.run(false, params, params.length);
		var cnt = 0; 
		while (process.isRunning) { /* wait for exitValue */
			cnt++;
			if (cnt > 100000) { break; } /* no infinite loops */
		}
		if (process.exitValue) { throw Cr.NS_ERROR_FILE_ACCESS_DENIED; }
	}
	this._repeatedAttempt(func, newPath.getPath(), "create");

	/* if we succeeded, if we did not - this one is done */
	this._nodeFinished(); 
}

Operation.Copy.prototype._done = function() {
	if (this._current.is) {
		this._current.is.close();
		this._current.os.close();
	}
	
	return Operation.prototype._done.apply(this, arguments);
}


/***/

Operation.Move = function(callback, sourcePath, targetPath) {
	Operation.Copy.call(this, callback, sourcePath, targetPath);
}

Operation.Move.prototype = Object.create(Operation.Copy.prototype);

Operation.Move.prototype._init = function() {
	Operation.Copy.prototype._init.apply(this, arguments);
	
	this._issues.delete = false;
	this._prefix = "move";
}

Operation.Move.prototype._nodeFinished = function() {
	/* after finishing, try to delete a node */
	var func = function() { this._node.path.delete(); };
	var result = this._repeatedAttempt(func, this._node.path.getPath(), "delete");
	if (this._state == Operation.ABORTED) { return; }
	
	/* do whatever copying operation requires */
	return Operation.Copy.prototype._nodeFinished.apply(this, arguments);
}

/**
 * Search files with a given name/content pattern
 */
Operation.Search = function(doneCallback, itemCallback, params) {
	Operation.call(this, doneCallback);
	this._itemCallback = itemCallback;
	this._params = params;
	
	this._reName = null;
	this._reContent = null;
	this._converter = Cc["@mozilla.org/intl/utf8converterservice;1"].getService(Ci.nsIUTF8ConverterService);

	var re = params.term;
	re = re.replace(/\./g, "\\.");
	re = re.replace(/\*/g, ".*");
	re = re.replace(/\?/g, ".");
	re = ".*"+re+".*";
	this._reName = new RegExp(re);
	if ("content" in params) { this._reContent = new RegExp(params.content, "i"); }
	
	/* all these need to be checked */
	this._stack = [params.path];
	
	/* currently opened file */
	this._current = {
		path: null,
		is: null,
		bufferSize: 0,
		oldPart: ""
	}

	this._run();
}

Operation.Search.prototype = Object.create(Operation.prototype);

Operation.Search.prototype._showProgress = function() {
	var data = {
		"title": _("search.title"),
		"row1-label": _("search.working"),
		"row1-value": this._params.path.getPath(),
		"row2-label": null,
		"row2-value": null,
		"progress2-label": null,
		"progress2": null
	};

	Operation.prototype._showProgress.call(this, data, {progress1:"undetermined"});
}

Operation.Search.prototype._iterate = function() {
	if (this._current.path) { 
		var amount = Math.min(this._current.bufferSize, this._current.is.available());
		var bytes = this._current.is.readBytes(amount);
		var str = this._converter.convertStringToUTF8(bytes, "ascii", false);
		if (this._reContent.test(this._current.oldPart + str)) {
			this._current.is.close();
			this._itemCallback(this._current.path);
			this._current.path = null;
		} else if (!this._current.is.available()) { /* end of file */
			this._current.is.close();
			this._current.path = null;
		} else {
			this._current.oldPart = str.substring(str.length - this._params.content.length);
		}
		return;
	} /* search in file */
	
	if (!this._stack.length) { 
		this._state = Operation.FINISHED;
		return;
	}
	
	/* operate on this one */
	var path = this._stack.pop(); 
	this._updateProgress({"row1-value": path.getPath()});
	
	/* add children to stack */
	if (path.supports(FC.CHILDREN)) {
		var children = [];
		try {
			children = path.getItems();
		} catch (e) {};
		while (children.length) { this._stack.push(children.pop()); }
	}
	
	/* investigate current item */
	if (!this._matchMeta(path)) { return; }
	
	/* content check not requested */
	if (!this._reContent) {
		this._itemCallback(path); 
		return;
	}
	
	/* content requested, but this is directory */
	if (path.supports(FC.CHILDREN)) { return; }

	this._matchContent(path);
}

/**
 * Fast, simple metadata test
 * @returns {bool}
 */
Operation.Search.prototype._matchMeta = function(item) {
	var p = this._params;
	
	var name = item.getName();
	if (!this._reName.test(name)) { return false; }

	if (p.type == "file" && item.supports(FC.CHILDREN)) { return false; }
	if (p.type == "dir" && !item.supports(FC.CHILDREN)) { return false; }
	
	if ("min" in p || "max" in p) {
		var size = item.getSize();
		if (size === null) { return false; }
		if ("min" in p && size < p.min) { return false; }
		if ("max" in p && size > p.max) { return false; }
	}
	
	if ("from" in p || "to" in p) {
		var ts = item.getTS();
		if (ts === null) { return false; }
		if ("from" in p && ts < p.from) { return false; }
		if ("to" in p && ts > p.to) { return false; }
	}
	
	return true;
}

/**
 * Content search
 */
Operation.Search.prototype._matchContent = function(item) {
	try {
		var is = item.inputStream();
	} catch (e) { return; } /* cannot open */

	var c = this._params.content;
	this._current.path = item;
	this._current.bufferSize = Math.max(2*c.length, 16384);
	this._current.oldPart = "";

	var bis = Cc["@mozilla.org/binaryinputstream;1"].createInstance(Ci.nsIBinaryInputStream);
	bis.setInputStream(is);
	this._current.is = bis;
}
