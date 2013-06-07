var Issue = function() {
	window.addEventListener("dialogcancel", this);

	var args = window.arguments[0];
	document.title = args.title;
	$("text").value = args.text;
	
	var buttons = args.buttons;
	for (var i=0;i<buttons.length;i++) {
		var btn = $("button_" + buttons[i]);
		$("target").appendChild(btn);
		btn.addEventListener("command", this);
	}
	
	var source = $("source");
	source.parentNode.removeChild(source);
}

Issue.prototype.handleEvent = function(e) {
	switch (e.type) {
		case "dialogcancel":
			window.arguments[0].result = "5";
			window.close();
		break;

		case "command":
			var num = e.target.id.split("_")[1];
			window.arguments[0].result = num;
			window.close();
		break;
	}
}

window.onload = function() { new Issue(); }
