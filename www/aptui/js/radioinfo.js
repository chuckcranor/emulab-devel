$(function ()
{
    'use strict';

    var template_list = ['radioinfo', "waitwait-modal", "oops-modal"];
    var templates     = APT_OPTIONS.fetchTemplateList(template_list);    
    var mainTemplate  = _.template(templates['radioinfo']);
    var amlist        = null;
    var radioInfo     = null;
    var map           = null;
    var mobile        = null;

    function initialize()
    {
	window.APT_OPTIONS.initialize(sup);

	radioInfo = JSON.parse(_.unescape($('#radioinfo-json')[0].textContent));
	console.info("radioinfo", radioInfo);
	amlist    = JSON.parse(_.unescape($('#amlist-json')[0].textContent));
	console.info("amlist", amlist);

	var options = {
	    "amlist"    : amlist,
	    "radioinfo" : radioInfo
	};
	$('#main-body').html(mainTemplate(options));
	// Now we can do this. 
	$('#oops_div').html(templates["oops-modal"]);
	$('#waitwait_div').html(templates["waitwait-modal"]);

	var widgets = [ "uitheme", "zebra"];
	if (window.ISADMIN) {
	    widgets.push("editable");
	}

	$('#radioinfo-table')
	    .tablesorter({
		theme : 'bootstrap',
		widgets : widgets,
		headerTemplate : '{content} {icon}',
		widgetOptions: {
		    editable_columns       : [2,4,5,9],
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

		console.info(newContent, cellIndex, urn, node_id, iface, field);

		var args = {
		    "content"    : newContent,
		    "aggregate"  : urn,
		    "node_id"    : node_id,
		    "iface"      : iface,
		    "field"      : field,
		};
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
