Viewer.Image = function(path, fc) {
	alert("teh view");
}

Viewer.Image.prototype = Object.create(Viewer.prototype);

FC.addViewerHandler("jpg", Viewer.Image);
FC.addViewerHandler("gif", Viewer.Image);
FC.addViewerHandler("png", Viewer.Image);
