var Search = function() {
	window.addEventListener("dialogcancel", this);
	window.addEventListener("dialogaccept", this);

	var args = window.arguments[0];
	$("path").value = args.path;
}

Search.prototype.handleEvent = function(e) {
	switch (e.type) {
		case "dialogaccept":
			var data = window.arguments[0];
			data.result = true;
			data.term = $("term").value;
			data.path = $("path").value;
			
			if ($("file").selected) { data.type = "file"; }
			if ($("dir").selected) { data.type = "dir"; }
			if ($("min").checked) { data.min = $("min_bytes").value; }
			if ($("max").checked) { data.max = $("max_bytes").value; }
			if ($("from").checked) { data.from = this._getTS("from"); }
			if ($("to").checked) { data.to = this._getTS("to"); }
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
		break;

		case "dialogcancel":
			window.arguments[0].result = false;
		break;
	}
}

Search.prototype._getTS = function(id) {
	var day = 1000*60*60*24;
	var date = $("date_" + id);
	var time = $("time_" + id);
	
	var ts1 = date.dateValue.getTime();
	var ts2 = time.dateValue.getTime();

	return Math.floor(ts1/day)*day + Math.floor((ts2%day)/1000)*1000;
}

window.onload = function() { new Search(); }
