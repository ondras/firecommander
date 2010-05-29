Viewer.Image = function(path, fc) {
	Viewer.call(this, path, fc);
	
	this._sizes = [1/40, 1/30, 1/20, 1/16, 1/12, 1/10, 1/8, 1/6, 1/4, 1/3, 1/2, 2/3, 1, 2, 3, 4, 5, 6, 7, 8, 10, 12, 16, 20, 30, 40];
	this._size = null;
	this._open("image");
	this._originalSize = [];
	this._currentSize = [];
	this._image = null;
	this._container = null;
}

Viewer.Image.prototype = Object.create(Viewer.prototype);

Viewer.Image.prototype._load = function(e) {
	Viewer.prototype._load.call(this, e);

	this._container = this._win.document.getElementById("container");
	this._image = this._win.document.getElementById("image");
	this._ec.push(Events.add(this._image, "load", this._loadImage.bind(this)));
	
	this._showImage(this._path);
}

Viewer.Image.prototype._showImage = function(path) {
	this._path = path;

	var doc = this._win.document;
	var exif = doc.getElementById("exif");
	while (exif.firstChild) { exif.removeChild(exif.firstChild); }

	this._image.src = "file://" + this._path.getPath();
}

Viewer.Image.prototype._loadImage = function(e) {
	var doc = this._win.document;
	this._originalSize = [e.target.naturalWidth, e.target.naturalHeight];

	this._ec.push(Events.add(doc.getElementById("splitter"), "command", this._sync.bind(this)));
	this._ec.push(Events.add(this._win, "resize", this._sync.bind(this)));
	this._ec.push(Events.add(this._win, "keypress", this._keyPress.bind(this)));
	
	this._showEXIF();
}

Viewer.Image.prototype._showEXIF = function() {
	var doc = this._win.document;
	try {
		var e = new EXIF(this._path.inputStream());
	} catch (e) { return; }
	
	var tags = e.getTags();
	var exif = doc.getElementById("exif");
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
	this._sync();
}

Viewer.Image.prototype._showGeo = function(tags) {
	var map = this._win.document.getElementById("map");
	if (tags["GPSLongitude"] && tags["GPSLatitude"]) {
		map.style.display = "";
		
		var lon = 0;
		for (var i=0;i<tags["GPSLongitude"].length;i++) {
			lon += tags["GPSLongitude"][i] / Math.pow(60, i);
		}
		if (tags["GPSLongitudeRef"].toUpperCase() == "W") { lon = -lon; }
		
		var lat = 0;
		for (var i=0;i<tags["GPSLatitude"].length;i++) {
			lat += tags["GPSLatitude"][i] / Math.pow(60, i);
		}
		if (tags["GPSLatitudeRef"].toUpperCase() == "S") { lat = -lat; }
		
		map.src = "viewer-image-map.html?x="+lon+"&y="+lat; 
	} else {
		map.style.display = "none";
	}
}

Viewer.Image.prototype._sync = function() {
	var box = this._container;
	var bw = box.clientWidth;
	var bh = box.clientHeight;
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

	var left = (bw-w)/2;
	var top = (bh-h)/2;
	this._image.style.width = Math.round(w)+"px";
	this._image.style.height = Math.round(h)+"px";
	this._image.style.left = Math.round(left)+"px";
	this._image.style.top = Math.round(top)+"px";
	
	/* hack to force redraw */
	this._image.parentNode.flex = 0;
	this._image.parentNode.flex = 1;

	var percent = (this._currentSize[0]/this._originalSize[0]) * 100;
	this._win.document.title = "(" + Math.round(percent) + "%) " + this._path.getPath();
}

Viewer.Image.prototype._keyPress = function(e) {
	switch (e.charCode) {
		case 43: /* plus */
			this._zoomIn();
		break;

		case 45: /* minus */
			this._zoomOut();
		break;
		
		case 42: /* asterisk */
			this._size = null;
			this._sync();
		break;
	}
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

FC.addViewerHandler("jpg", Viewer.Image);
FC.addViewerHandler("jpeg", Viewer.Image);
FC.addViewerHandler("gif", Viewer.Image);
FC.addViewerHandler("png", Viewer.Image);
FC.addViewerHandler("bmp", Viewer.Image);
FC.addViewerHandler("ico", Viewer.Image);
