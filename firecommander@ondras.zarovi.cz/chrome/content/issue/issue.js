var Issue = {
	_command: function(e) {
		var num = e.target.id.split("_")[1];
		window.arguments[0].result = num;
		Issue._close();
	},
	
	_cancel: function(e) {
		window.arguments[0].result = "5";
		Issue._close();
	},
	
	_close: function() {
		Events.clear();
		window.close();
	},
	
	init: function(e) {
		Events.add(window, "dialogcancel", Issue._cancel);

		var args = window.arguments[0];
		document.title = args.title;
		$("text").value = args.text;
		
		var buttons = args.buttons;
		for (var i=0;i<buttons.length;i++) {
			var btn = $("button_" + buttons[i]);
			$("target").appendChild(btn);
			Events.add(btn, "command", Issue._command);
		}
		
		var source = $("source");
		source.parentNode.removeChild(source);
	}
}

Events.add(window, "load", Issue.init);
