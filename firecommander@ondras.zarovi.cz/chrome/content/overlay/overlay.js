(function() {

	var load = function() {
		var command = document.getElementById("firecommander-launch");
		command.addEventListener("command", run, false);
	}

	var run = function() {
		window.open("chrome://firecommander/content/firecommander.xul", "", "chrome,centerscreen,resizable=yes");
	}

	window.addEventListener("load", load, false);

})();
