$(function ()
{
    'use strict';
    var templates      = APT_OPTIONS.fetchTemplateList(['list-rfranges',
 			   "rfrange-history", 'waitwait-modal', 
			   'oops-modal', 'txgraph']);
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
		$('#main-body').append(templates['txgraph']);

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

		    var rfhash = [];
		    _.each(result3.value, function (range) {
			rfhash[range.key] = range;
		    });

		    $('#inuse-ranges .tablesorter')
			.tablesorter({
			    theme : 'bootstrap',
			    widgets: ["uitheme", "zebra"],
			    headerTemplate : '{content} {icon}',
			});
		    $('#inuse-ranges .txgraph-button')
			.click(function (event) {
			    event.preventDefault();
			    var key = $(this).data("key");
			    var record = rfhash[key];

			    console.info(record);
			    var args = {
				"selector" : "#txgraph-modal",
				"txlist"   : record.txlist,
				"instances": null,
				"instance" : record,
			    }
			    ShowTXGraph(args);
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
	    var rfhash = [];
	    _.each(json.value, function (range) {
		rfhash[range.key] = range;
	    });
	    
	    var template = _.template(templates['rfrange-history']);
	    $('#history-ranges .waiting')
		.html(template({"ranges" : json.value}));

	    // Default dates for the date pickers.
	    var first = _.first(json.value);
	    var last  = _.last(json.value);

	    var start_from = moment(last.started).format("L");
	    var start_to   = moment(first.started).format("L");
	    var end_from   = moment(last.destroyed).format("L");
	    var end_to     = moment(first.destroyed).format("L");

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
			    7 : function($cell, indx) {
				return $.tablesorter.filterFormatter
				    .uiDatepicker( $cell, indx, {
					textFrom : "",
					textTo : "-",
					from : start_from,
					to   : start_to,
					changeMonth : true,
					changeYear : true
				    });
			    },
			    // Date (two inputs)
			    8 : function($cell, indx) {
				return $.tablesorter.filterFormatter
				    .uiDatepicker( $cell, indx, {
					textFrom : "",
					textTo : "-",
					from : end_from,
					to   : end_to,
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
	    $('#history-ranges .txgraph-button').click(function (event) {
		event.preventDefault();
		var key = $(this).data("key");
		var record = rfhash[key];

		console.info(record);
		var args = {
		    "selector" : "#txgraph-modal",
		    "txlist"   : record.txlist,
		    "instances": null,
		    "instance" : record,
		}
		ShowTXGraph(args);
	    });
	};
	sup.CallServerMethod(null, "rfrange", "RangeHistory", null, callback);
    }

    // Wrapper to handle the defer
    function ShowTXGraph(args) {
	var defer = $.Deferred();
	window.ShowTXGraph("#txgraph-modal", defer);
	defer.resolve(args);
    }
    $(document).ready(initialize);
});
