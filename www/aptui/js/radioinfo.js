$(function ()
{
    'use strict';

    var template_list = ['radioinfo', "waitwait-modal", "oops-modal",
			 "txgraph"];
    var templates     = APT_OPTIONS.fetchTemplateList(template_list);    
    var mainTemplate  = _.template(templates['radioinfo']);
    var amlist        = null;
    var radioInfo     = null;
    var map           = null;
    var mobile        = null;

    // Site Types
    var siteTypes = {
	"FE"  : "Fixed Endpoint",
	"ME"  : "Mobile Endpoint",
	"BS"  : "Rooftop",
	"PE"  : "Portable",
	"DD"  : "Dense Deployment",
	"OAI" : "Paired Workbench",
	"OTA" : "Indoor Lab",
    };

    function initialize()
    {
	window.APT_OPTIONS.initialize(sup);

	radioInfo = JSON.parse(_.unescape($('#radioinfo-json')[0].textContent));
	console.info("radioinfo", radioInfo);
	amlist    = JSON.parse(_.unescape($('#amlist-json')[0].textContent));
	console.info("amlist", amlist);

	var options = {
	    "amlist"    : amlist,
	    "radioinfo" : radioInfo,
	    "siteTypes" : siteTypes,
	};
	$('#main-body').html(mainTemplate(options));
	// Now we can do this. 
	$('#oops_div').html(templates["oops-modal"]);
	$('#waitwait_div').html(templates["waitwait-modal"]);
	$('#txgraph_div').html(templates['txgraph']);
	
	var widgets = [ "uitheme", "zebra"];
	if (window.ISADMIN) {
	    widgets.push("editable");
	    $('#radioinfo-table thead .glyphicon-edit').removeClass("hidden");
	}

	$('#radioinfo-table')
	    .tablesorter({
		theme : 'bootstrap',
		widgets : widgets,
		headerTemplate : '{content} {icon}',
		widgetOptions: {
		    editable_columns       : [3,5,6,7,8,11],
		    editable_enterToAccept : true,   
		    editable_autoAccept    : false,   
		    editable_autoResort    : false,
		},
	    })
	    .children('tbody').on('editComplete', 'td', function(event, config) {
		var newContent = $(this).text();
		var cellIndex  = this.cellIndex;
		var urn        = $(this).closest('tr').data('urn');
		var node_id    = $(this).closest('tr').data('node_id');
		var iface      = $(this).closest('tr').data('iface');
		var field      = $(this).closest('td').data('field');

		var args = {
		    "content"    : $.trim(newContent),
		    "aggregate"  : urn,
		    "node_id"    : node_id,
		    "iface"      : iface,
		    "field"      : field,
		};
		console.info(args);
		
		var callback = function (json) {
		    if (json.code) {
			alert(json.value);
			return;
		    }
		};
		sup.CallServerMethod(null, "radioinfo",
				     "EditTable", args, callback);
	    });
	
	$("#mobile-endpoints").click(function () {
	    if (mobile && !mobile.closed) {
		mobile.focus();
		return;
	    }
	    mobile = window.open('mobile-endpoints.php', 'Mobile Endpoints');
	});

	sup.addPopoverClip('#radioinfo-table .urn-button',
			   function (target) {
			       var urn = $(target).data("urn");
			       return sup.popoverClipContent(urn);
			   });

	$(".txgraph-button").click(function (event) {
	    event.preventDefault();
	    ShowTXGraph($(this).closest('tr'));
	});

	$(".location").click(function (event) {
	    event.preventDefault();
	    var args = {
		"urn"      : $(this).data("urn"),
		"location" : $(this).data("location"),
		"type"     : $(this).data("type"),
	    };
	    GetMapWindow(function (map) {
		console.info("got map", map);
		var foo = map;
		if (navigator.userAgent.indexOf("Chrome") > 0) {
		    foo = window.open('', 'Powder Map');
		}
		foo.focus();
		foo.postMessage(args);
	    });
	});
    }

    /*
     * Show a TX graph.
     */
    function ShowTXGraph(row)
    {
	var urn      = $(row).data("urn");
	var node_id  = $(row).data("node_id");
	var frontend = $(row).data("frontend");
	var iface    = $(row).data("iface");
	var defer    = $.Deferred();
	console.info(urn, node_id, frontend, iface);

	var callback = function (json) {
	    console.info(json);
	    if (json.code) {
		defer.resolve(json.value);
		return;
	    }
	    var txlist = json.value.txlist;
	    var instances = json.value.instances;
	    if (!_.size(txlist)) {
		defer.reject(null);
		return;
	    }
	    var args = {
		"selector"  : "#txgraph-modal",
		"txlist"    : txlist,
		"instances" : instances,
		"instance"  : null,
	    }
	    defer.resolve(args);
	};
    	var args = {
	    "aggregate_urn" : urn,
	    "node_id"       : node_id,
	    "iface"         : iface,
	    "frontend"      : frontend,
	};
	window.ShowTXGraph("#txgraph-modal", defer);
	sup.CallServerMethod(null, "rfrange", "Transmissions", args, callback);
    }

    /*
     * Create the map window if it does not exist.
     */
    window.GetMapWindow = function(callback) {
	console.info("radioinfo GetMapWindow");
	if (map && !map.closed) {
	    callback(map);
	    return;
	}
	if (window.opener && window.opener.GetMapWindow) {
	    console.info("calling into the opener");
	    window.opener.GetMapWindow(callback);
	    return;
	}
	map = window.open('powder-map.php', 'Powder Map');
	/*
	 * Need to wait for the map to get to the point where sending
	 * it a message can be received, so wait for a message from
	 * it.
	 */
	$(window).on("message", function () {
	    console.info("message received");
	    callback(map);
	});
    }

    $(document).ready(initialize);
});
