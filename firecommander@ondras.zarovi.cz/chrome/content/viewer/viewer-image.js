Viewer.Image = function(path, fc) {
	Viewer.call(this, path, fc);
	
	this._sizes = [1/40, 1/30, 1/20, 1/16, 1/12, 1/10, 1/8, 1/6, 1/4, 1/3, 1/2, 2/3, 1, 2, 3, 4, 5, 6, 7, 8, 10, 12, 16, 20, 30, 40];
	this._size = null;
	this._originalSize = [];
	this._currentSize = [];
	this._currentPosition = [];
	this._image = null;
	this._container = null;
	this._items = fc.getActivePanel().getItems();
}

Viewer.Image.prototype = Object.create(Viewer.prototype);

Viewer.Image.prototype.handleEvent = function(e) {
	switch (e.type) {
		case "resize": 
		case "command":
			this._sync(); 
		break;

		case "load":
			this._container.style.cursor = "";
			this._originalSize = [this._image.naturalWidth, this._image.naturalHeight];
			this._win.document.querySelector("#size").label = this._originalSize.join("×");
			this._showEXIF();
			this._sync();
		break;

		case "mousemove":
			if (!this._originalSize.length) { return; }
			var pos = [e.clientX, e.clientY];

			for (var i=0;i<pos.length;i++) {
				var frac = this._originalSize[i]/this._currentSize[i];
				pos[i] = Math.round((pos[i]-this._currentPosition[i])*frac);
			}

			this._win.document.querySelector("#mouse").label = pos.join(",");
		break;
	}
}

Viewer.Image.prototype._ready = function(realPath) {
	Viewer.prototype._ready.call(this, realPath);
	if (this._win) {
		this._showImage();
	} else {
		this._open("image");
	}
}

Viewer.Image.prototype._load = function(e) {
	Viewer.prototype._load.call(this, e);

	var doc = this._win.document;
	this._container = doc.querySelector("#container");

	this._image = doc.querySelector("#image");
	this._image.addEventListener("load", this);
	doc.querySelector("splitter").addEventListener("command", this);
	this._win.addEventListener("resize", this);
	doc.addEventListener("mousemove", this);
	
	this._showImage();
}

Viewer.Image.prototype._showImage = function() {
	this._size = null;
	this._container.style.cursor = "wait";
	this._image.src = "file://" + this._realPath.getPath();
}

Viewer.Image.prototype._showEXIF = function() {
	var exif = this._win.document.querySelector("#exif");
	while (exif.firstChild) { exif.removeChild(exif.firstChild); }

	var doc = this._win.document;
	try {
		var e = new EXIF(this._realPath.inputStream());
	} catch (e) { return; }
	
	var tags = e.getTags();
	for (var p in tags) {
		var value = tags[p];
		if (value instanceof Array && value.length > 10) { continue; }
		if (value === "") { continue; }
		
		var item = doc.createElement("treeitem");
		var row = doc.createElement("treerow");
		item.appendChild(row);

		var c1 = doc.createElement("treecell");
		c1.setAttribute("label", p);
		row.appendChild(c1);
		
		var c2 = doc.createElement("treecell");
		c2.setAttribute("label", value);
		row.appendChild(c2);

		exif.appendChild(item);
	}
	
	this._showGeo(tags);
}

Viewer.Image.prototype._showGeo = function(tags) {
	var map = this._win.document.querySelector("#map");
	if (tags["GPSLongitude"] && tags["GPSLatitude"]) {
		map.style.display = "";
		
		var lon = 0;
		for (var i=0;i<tags["GPSLongitude"].length;i++) {
			lon += tags["GPSLongitude"][i] / Math.pow(60, i);
		}
		if (tags["GPSLongitudeRef"] && tags["GPSLongitudeRef"].toUpperCase() == "W") { lon = -lon; }
		
		var lat = 0;
		for (var i=0;i<tags["GPSLatitude"].length;i++) {
			lat += tags["GPSLatitude"][i] / Math.pow(60, i);
		}
		if (tags["GPSLatitudeRef"] && tags["GPSLatitudeRef"].toUpperCase() == "S") { lat = -lat; }
		map.src = "viewer-image-map.html?x="+lon+"&y="+lat; 
	} else {
		map.style.display = "none";
	}
}

Viewer.Image.prototype._sync = function() {
	var box = this._container;
	var bw = box.clientWidth;
	var bh = box.clientHeight;
	if (!this._originalSize.length) { return; }
	var w = this._originalSize[0];
	var h = this._originalSize[1];

	if (this._size === null) { /* auto size */
		var rw = w/bw;
		var rh = h/bh;
		var max = Math.max(rw, rh);
		if (max > 1) { 
			w /= max;
			h /= max;
		}
	} else {
		var coef = this._sizes[this._size];
		w *= coef;
		h *= coef;
	}
	
	this._currentSize = [w, h];
	this._boxSize = [bw, bh];

	var left = (bw-w)/2;
	var top = (bh-h)/2;
	this._currentPosition = [left, top];
	this._image.style.width = Math.round(w)+"px";
	this._image.style.height = Math.round(h)+"px";
	this._image.style.left = Math.round(left)+"px";
	this._image.style.top = Math.round(top)+"px";
	
	/* hack to force redraw */
	this._image.parentNode.flex = 0;
	this._image.parentNode.flex = 1;

	var percent = (this._currentSize[0]/this._originalSize[0]) * 100;
	this._win.document.title = "(" + Math.round(percent) + "%) " + this._realPath.getPath();
	this._win.document.querySelector("#scale").label = Math.round(percent) + "%";

	var map = this._win.document.querySelector("#map");
	map.width = map.parentNode.clientWidth;
}

Viewer.Image.prototype._zoomIn = function() {
	if (this._size === null) {
		this._zoomFind(1);
	} else if (this._size+1 < this._sizes.length) {
		this._size++;
		this._sync();
	}
}

Viewer.Image.prototype._zoomOut = function() {
	if (this._size === null) {
		this._zoomFind(-1);
	} else if (this._size > 0) {
		this._size--;
		this._sync();
	}
}

Viewer.Image.prototype._zoomFind = function(dir) {
	var frac = this._currentSize[0]/this._originalSize[0];
	var index = (dir == 1 ? 0 : this._sizes.length-1);
		
	while (index >= 0 && index < this._sizes.length) {
		if (dir * (this._sizes[index] - frac) > 0) { /* this is the zoom we will use */
			this._size = index;
			this._sync();
			return;
		}
		index += dir;
	}
}

/**
 * Move the (large) image by a given offset
 */
Viewer.Image.prototype._move = function(dx, dy) {
	var amount = 20;
	var style = ["left", "top"];
	for (var i=0;i<2;i++) {
		var pos = this._currentPosition[i];
		if (pos > 0) { continue; } /* centered */
		
		pos += arguments[i]*amount;
		pos = Math.min(pos, 0);
		pos = Math.max(pos, this._boxSize[i]-this._currentSize[i]);
		this._currentPosition[i] = pos;
		this._image.style[style[i]] = Math.round(pos) + "px";
	}
}

Viewer.Image.prototype._loadAnother = function(which) {
	var index = this._items.indexOf(this._originalPath);
	if (index == -1) { return; } /* not found, wtf FIXME */
	
	var current = null;
	var dir = null;
	
	switch (which) {
		case +1:
		case -1:
			current = index;
			dir = which;
		break;
		
		case Infinity:
			current = this._items.length-1;
			dir = -1;
		break;

		case -Infinity:
			current = 0;
			dir = 1;
		break;
	}
	
	/* scan for first image */
	while (current >= 0 && current < this._items.length) {
		if (current != index) {
			var path = this._items[current];
			var handler = this._fc.getViewerHandler(path);
			if (handler == Viewer.Image) {
				if (this._realPath != this._originalPath) { this._realPath.delete(); }
				this._originalPath = path;
				this._preparePath();
				return;
			}
		}
		current += dir;
	}

	/* image not found */
}

Viewer.Image.prototype._keyDown = function(e) {
	Viewer.prototype._keyDown.call(this, e);

	e.preventDefault();

	switch (e.keyCode) {
		case 37: /* left */
			this._move(1, 0);
		break;
		
		case 38: /* top */
			this._move(0, 1);
		break;
		
		case 39: /* right */
			this._move(-1, 0);
		break;
		
		case 40: /* bottom */
			this._move(0, -1);
		break;
		
		case 33: /* pageup */
		case 8: /* backspace */
			this._loadAnother(-1);
		break;
		
		case 34: /* pagedown */
		case 13: /* enter */
		case 32: /* spacebar */
			this._loadAnother(+1);
		break;
		
		case 36: /* home */
			this._loadAnother(-Infinity);
		break;
		
		case 35: /* end */
			this._loadAnother(Infinity);
		break;

		case 106: /* asterisk */
			this._size = null;
			this._sync();
		break;

		case 107: /* num plus */
		case 61: /* plus */
			this._zoomIn();
		break;

		case 109: /* num minus */
		case 173: /* minus */
			this._zoomOut();
		break;

	}
}

FC.addViewerHandler("jpg", Viewer.Image);
FC.addViewerHandler("jpeg", Viewer.Image);
FC.addViewerHandler("gif", Viewer.Image);
FC.addViewerHandler("png", Viewer.Image);
FC.addViewerHandler("bmp", Viewer.Image);
FC.addViewerHandler("ico", Viewer.Image);
FC.addViewerHandler("svg", Viewer.Image);
