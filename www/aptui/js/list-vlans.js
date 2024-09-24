$(function ()
{
    'use strict';

    var templates = APT_OPTIONS.fetchTemplateList(['list-vlans']);
    var mainTemplate = _.template(templates['list-vlans']);

    function initialize()
    {
	window.APT_OPTIONS.initialize(sup);
	var args = null;
	if (window.UUID !== undefined) {
	    args = {"uuid" : window.UUID};
	}
	sup.CallServerMethod(null, "vlan", "List", args,
			     function(json) {
				 console.info("list", json);
				 if (json.code) {
				     alert("Could not get vlan list " +
					   "from server: " + json.value);
				     return;
				 }
				 GeneratePageBody(json.value);
			     });
    }

    function GeneratePageBody(vlans)
    {
	// Generate the template.
	var html = mainTemplate({
	    vlans:		vlans,
	    isadmin:		window.ISADMIN,
	});
	$('#main-body').html(html);

	// Bind search for MAC
	$('#search-mac button').click(function (event) {
	    event.preventDefault();
	    var token = $.trim($('#search-mac input').val());
	    if (token) {
		SearchForMAC(token);
	    }
	});

	// Format dates with moment before display.
	$('.format-date').each(function() {
	    var date = $.trim($(this).html());
	    if (date != "") {
		$(this).html(moment($(this).html()).format("lll"));
	    }
	});

	// This activates the popover subsystem.
	$('[data-toggle="popover"]').popover({
	    trigger: 'hover',
	});
	
	// This activates the tooltip subsystem.
	$('[data-toggle="tooltip"]').tooltip({
	    trigger: 'hover',
	});

	var table = $(".tablesorter")
		.tablesorter({
		    theme : 'bootstrap',
		    widgets: ["uitheme", "zebra", "filter"],
		    headerTemplate : '{content} {icon}',

		    widgetOptions: {
			// include child row content while filtering, if true
			filter_childRows  : true,
			// include all columns in the search.
			filter_anyMatch   : true,
			// class name applied to filter row and each input
			filter_cssFilter  : 'form-control input-sm',
			// search from beginning
			filter_startsWith : false,
			// Set this option to false for case sensitive search
			filter_ignoreCase : true,
			// Only one search box.
			filter_columnFilters : true,
			}
		});
    }

    /*
     * Search for a node having MAC address
     */
    function SearchForMAC(mac)
    {
	sup.CallServerMethod(null, "node", "IfaceSearch",
			     {"mac" : mac}, function (json) {
                                 console.info("IfaceSearch", json);
                                 if (json.code) {
                                     $('#search-mac-link').addClass("hidden");
                                     alert(json.value);
                                     return;
                                 }
                                 if (!json.value) {
                                     $('#search-mac-link').addClass("hidden");
                                     alert("Cannot find a node with this MAC address")
                                     return
                                 }
                                 var node_id = json.value;
                                 var url = "show-node.php?node_id=" + node_id;
                                 $('#search-mac-link')
                                     .prop("href", url)
                                     .html(node_id)
                                     .removeClass("hidden");
                             });
    }
    $(document).ready(initialize);
});
