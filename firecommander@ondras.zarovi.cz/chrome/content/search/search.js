var Search = {
	_accept: function(e) {
		window.arguments[0].result = true;
		window.arguments[0].term = $("term").value;
		window.arguments[0].path = $("path").value;
		Events.clear();
	},
	
	_cancel: function(e) {
		window.arguments[0].result = false;
		Events.clear();
	},
	
	init: function(e) {
		Events.add(window, "dialogcancel", Search._cancel);
		Events.add(window, "dialogaccept", Search._accept);

		var args = window.arguments[0];
		$("path").value = args.path;
	}
}

Events.add(window, "load", Search.init);

