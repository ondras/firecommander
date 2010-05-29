Viewer.Image = function(path, fc) {
	Viewer.call(this, path, fc);
	
	this._open("image");
	this._width = null;
	this._height = null;
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
	this._width = e.target.naturalWidth;
	this._height = e.target.naturalHeight;
	this._sync();
	this._ec.push(Events.add(this._win, "resize", this._sync.bind(this)));
	this._ec.push(Events.add(doc.getElementById("splitter"), "command", this._sync.bind(this)));
	
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

	var w = this._width;
	var h = this._height;
	var rw = w/bw;
	var rh = h/bh;
	var max = Math.max(rw, rh);
	if (max > 1) { 
		w = Math.round(w/max);
		h = Math.round(h/max);
	}

	var left = (bw-w)/2;
	var top = (bh-h)/2;
	this._image.style.width = w+"px";
	this._image.style.height = h+"px";
	this._image.style.left = Math.round(left)+"px";
	this._image.style.top = Math.round(top)+"px";
	
	
	/* hack to force redraw */
	this._image.parentNode.flex = 0;
	this._image.parentNode.flex = 1;
}

FC.addViewerHandler("jpg", Viewer.Image);
FC.addViewerHandler("jpeg", Viewer.Image);
FC.addViewerHandler("gif", Viewer.Image);
FC.addViewerHandler("png", Viewer.Image);
FC.addViewerHandler("bmp", Viewer.Image);
FC.addViewerHandler("ico", Viewer.Image);
