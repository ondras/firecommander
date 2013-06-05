window.addEventListener("load", function() {
	document.querySelector("#version").appendChild(document.createTextNode(window.arguments[0]));
	var year = new Date().getFullYear();
	document.querySelector("#year").appendChild(document.createTextNode("2010–"+year));
}, false);

