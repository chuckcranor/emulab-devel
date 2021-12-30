$(function ()
{
    'use strict';
    var URL = "https://docs.google.com/spreadsheets/d/" +
	"1G212F80SZvu2yLzUkoeMpLIFmWnmpw7qRECNlqTqsQs/export?format=csv";
    var ignore = [
	"Max blockstore avail (GB)",
	"Control network speed",
	"Notes",
	"Processor Link",
    ];
    var typeLinks = {
	"Emulab" : "https://gitlab.flux.utah.edu/emulab/emulab-devel/wikis/Utah%20Cluster",
	"Powder" : "https://gitlab.flux.utah.edu/emulab/emulab-devel/wikis/Utah%20Cluster",
	"Apt"    : "http://docs.cloudlab.us/hardware.html#(part._apt-cluster)",
	"Cloudlab Utah" : "http://docs.cloudlab.us/hardware.html#(part._cloudlab-utah)",
	"Cloudlab Wisc" : "http://docs.cloudlab.us/hardware.html#(part._cloudlab-wisconsin)",
	"Cloudlab Clemson" : "http://docs.cloudlab.us/hardware.html#(part._cloudlab-clemson)",
	"Cloudlab UMass" : "http://docs.cloudlab.us/hardware.html#%28part._mass%29",
	"Onelab" : "http://docs.cloudlab.us/hardware.html#(part._cloudlab-utah)",
    };

    function initialize()
    {
	window.APT_OPTIONS.initialize(sup);

	$.ajax({
	    type: "GET",  
	    url: URL,
	    dataType: "text",       
	    success: function(response)  
	    {
		console.info(response);
		/*
		 * First line is Mike's column grouping. Cut that out,
		 * and process it later.
		 */
		var lines = response.split('\n');
		var first = lines[0];
		var rest  = lines.slice(1).join('\n');
		
		var data = $.csv.toObjects(rest);
		PopulateTable(first, data);
	    }   
	});	
    }

    function PopulateTable(first, data)
    {
	var html = "<tr>";

	_.each(data[0], function (val, key) {
	    if (_.contains(ignore, key)) {
		return;
	    }
	    html += "<th>" + key + "</th>";
	});
	html += "</tr>";
	$('#portal-hardware-table thead').append(html);

	_.each(data, function (row) {
	    var html = "<tr>";
	    _.each(row, function (val, key) {
		if (_.contains(ignore, key)) {
		    return;
		}
		html += "<td class='text-nowrap'>";
		
		if (key == "Type name") {
		    var cluster = row["Cluster"]
		    var link    = typeLinks[cluster];
			
		    html += "<a href='" + link + "'>" + val + "</a>";
		}
		else if (key == "Processor type") {
		    var link = row["Processor Link"];
		    link = link.replace("%23", "#");
		    
		    html += "<a href='" + link + "'>" + val + "</a>";
		}
		else {
		    html += val;
		}
		html += "</td>";		
	    });
	    html += "</tr>";
	    $('#portal-hardware-table tbody').append(html);
	});

	$('#portal-hardware-table').removeClass("hidden");

	$('#portal-hardware-table')
	    .tablesorter({
		theme : 'bootstrap',
		widgets : [ "uitheme", "filter" ],
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
		    filter_columnFilters : false,
		    // Search as typing
		    filter_liveSearch : true,
		},
	    });

	// This activates the popover subsystem.
	$('[data-toggle="popover"]').popover({
	    trigger: 'hover',
	});
    }

    $(document).ready(initialize);
});
