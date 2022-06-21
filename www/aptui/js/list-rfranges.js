$(function ()
{
    'use strict';
    var templates      = APT_OPTIONS.fetchTemplateList(['list-rfranges',
 			   "rfrange-history", 'waitwait-modal', 'oops-modal']);
    var template       = _.template(templates['list-rfranges']);
    var waitwait       = templates['waitwait-modal'];
    var oops           = templates['oops-modal'];
    
    function initialize()
    {
	window.APT_OPTIONS.initialize(sup);

	var xmlthing1 =
	    sup.CallServerMethod(null, "rfrange", "GlobalRanges");
	var xmlthing2 =
	    sup.CallServerMethod(null, "rfrange", "AllProjectRanges");
	var xmlthing3 =
	    sup.CallServerMethod(null, "rfrange", "AllInuseRanges");

	LoadHistory();

	$.when(xmlthing1, xmlthing2, xmlthing3)
	    .done(function(result1, result2, result3) {
		console.info(result1, result2, result3);

		var args = {
		    "global_ranges"  : result1.value,
		    "project_ranges" : result2.value,
		    "inuse_ranges"   : result3.value,
		};
		$('#main-body').html(template(args));

		if (_.size(result1.value)) {
		    $('#global-ranges').removeClass("hidden");

		    $('#global-ranges .tablesorter')
			.tablesorter({
			    theme : 'bootstrap',
			    widgets: ["uitheme", "zebra"],
			    headerTemplate : '{content} {icon}',
			});
		}
		if (_.size(result2.value)) {
		    $('#project-ranges').removeClass("hidden");

		    $('#project-ranges .tablesorter')
			.tablesorter({
			    theme : 'bootstrap',
			    widgets: ["uitheme", "zebra"],
			    headerTemplate : '{content} {icon}',
			});
		}
		if (_.size(result3.value)) {
		    $('#inuse-ranges').removeClass("hidden");

		    $('#inuse-ranges .tablesorter')
			.tablesorter({
			    theme : 'bootstrap',
			    widgets: ["uitheme", "zebra"],
			    headerTemplate : '{content} {icon}',
			});
		}
	    });
    }

    function LoadHistory()
    {
	var callback = function (json) {
	    console.info("history", json);
	    if (json.code) {
		sup.SpitOops("oops", json.value);
		return;
	    }
	    var template = _.template(templates['rfrange-history']);
	    $('#history-ranges .waiting')
		.html(template({"ranges" : json.value}));

	    $('#history-ranges .tablesorter')
		.tablesorter({
		    theme : 'bootstrap',
		    widgets: ["uitheme", "zebra", "filter"],
		    headerTemplate : '{content} {icon}',
		    widthFixed : true,
		    
		    widgetOptions: {
			// class name applied to filter row and each input
			//filter_cssFilter  : 'form-control input-sm',
			// search from beginning
			filter_startsWith : false,
			// Set this option to false for case sensitive search
			filter_ignoreCase : true,
			// Only one search box.
			filter_columnFilters : true,

			filter_formatter : {
			    // Date (two inputs)
			    6 : function($cell, indx) {
				return $.tablesorter.filterFormatter
				    .uiDatepicker( $cell, indx, {
					textFrom : "",
					textTo : "-",
					from : "",
					to   : "",
					changeMonth : true,
					changeYear : true
				    });
			    },
			    // Date (two inputs)
			    7 : function($cell, indx) {
				return $.tablesorter.filterFormatter
				    .uiDatepicker( $cell, indx, {
					textFrom : "",
					textTo : "-",
					from : "",
					to   : "",
					changeMonth : true,
					changeYear : true
				    });
			    },
			},
			filter_placeholder : {
			    from : 'From...',
			    to   : 'To...'
			},
		    }
		});
	};
	sup.CallServerMethod(null, "rfrange", "RangeHistory", null, callback);
    }
    $(document).ready(initialize);
});
