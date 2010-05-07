var Issue = {
	_ec: [],
	_command: function(e) {
		Issue._ec.forEach(Events.remove, Events);
		var num = e.target.id.split("_")[1];
		window.arguments[0].result = num;
		window.close();
	},
	
	_cancel: function(e) {
		Issue._ec.forEach(Events.remove, Events);
		window.arguments[0].result = "5";
		window.close();
	},
	
	init: function(e) {
		Issue._ec.push(Events.add(window, "dialogcancel", Issue._cancel));

		var args = window.arguments[0];
		document.title = args.title;
		$("text").value = args.text;
		
		var buttons = args.buttons;
		for (var i=0;i<buttons.length;i++) {
			var btn = $("button_" + buttons[i]);
			$("target").appendChild(btn);
			Issue._ec.push(Events.add(btn, "command", Issue._command));
		}
		
		var source = $("source");
		source.parentNode.removeChild(source);
	}
}

Issue._ec.push(Events.add(window, "load", Issue.init));
