var Search = {
	_accept: function(e) {
		var data = window.arguments[0];
		data.result = true;
		data.term = $("term").value;
		data.path = $("path").value;
		
		if ($("file").selected) { data.type = "file"; }
		if ($("dir").selected) { data.type = "dir"; }
		if ($("min").checked) { data.min = $("min_bytes").value; }
		if ($("max").checked) { data.max = $("max_bytes").value; }
		if ($("from").checked) { data.from = Search._getTS("from"); }
		if ($("to").checked) { data.to = Search._getTS("to"); }
		if ($("content").value.length) { 
			data.content = $("content").value; 
			try { 
				var test = new RegExp(data.content); 
			} catch (exc) {
				alert(exc);
				e.preventDefault();
				return;
			}
		}
		
		Events.clear();
	},
	
	_getTS: function(id) {
		var day = 1000*60*60*24;
		var date = $("date_" + id);
		var time = $("time_" + id);
		
		var ts1 = date.dateValue.getTime();
		var ts2 = time.dateValue.getTime();

		return Math.floor(ts1/day)*day + Math.floor((ts2%day)/1000)*1000;
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

