(function() {

	var load = function() {
		var command = document.getElementById("firecommander-launch");
		command.addEventListener("command", run, false);
	}

	var run = function() {
		window.open("chrome://firecommander/content/firecommander.xul", "", "chrome,centerscreen");
	}

	window.addEventListener("load", load, false);

})();
