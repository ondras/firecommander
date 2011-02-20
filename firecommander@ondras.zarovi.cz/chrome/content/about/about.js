window.addEventListener("load", function() {
	document.getElementById("version").appendChild(document.createTextNode(window.arguments[0]));
	var year = new Date().getFullYear();
	document.getElementById("year").appendChild(document.createTextNode("2010–"+year));
}, false);

