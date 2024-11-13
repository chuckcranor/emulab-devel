$(function ()
{
    'use strict';

    var templates = APT_OPTIONS.fetchTemplateList(['hardware-table',
						   'oops-modal',
						   'waitwait-modal']);
    var mainTemplate = _.template(templates['hardware-table']);
    
    function initialize()
    {
	window.APT_OPTIONS.initialize(sup);
	var route;
	var args = {"summary" : true, "asjson" : true};
	var title = "Hardware info for ";

	if (window.TYPE !== undefined) {
	    route = "nodetype";
	    title = title + "type " + window.TYPE;
	    args["type"] = window.TYPE;
	}
	else if (window.NODEID !== undefined) {
	    route = "node";
	    title = title + "node " + window.NODEID;
	    args["node_id"] = window.NODEID;
	}
	sup.CallServerMethod(null, route, "GetHardwareInfo", args,
			     function(json) {
				 console.info("info", json);
				 if (json.code) {
				     alert("Could not get hardware info " +
					   "from server: " + json.value);
				     return;
				 }
				 var stuff = json.value;
				 GenerateBody(title, stuff);
			     });
	
    }

    function GenerateBody(title, stuff)
    {
	// Generate the template.
	var html = mainTemplate({
	    "title"   : title,
	    "summary" : stuff.json,
	});
	$('#main-body').html(html);

	// Now we can do this.
	$('#oops_div').html(templates['oops-modal']);
	$('#waitwait_div').html(templates['waitwait-modal']);
    }
    $(document).ready(initialize);
});
