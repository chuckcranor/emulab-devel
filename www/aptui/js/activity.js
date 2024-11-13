$(function () {
    'use strict';

    var templates = APT_OPTIONS.fetchTemplateList(['activity',
						   'activity-table',
						   "waitwait-modal",
						   "oops-modal"]);

    var mainTemplate  = _.template(templates['activity']);
    var tableTemplate = _.template(templates['activity-table']);
    var default_min;
    var default_max;

    function initialize()
    {
	window.APT_OPTIONS.initialize(sup);

	default_min = new Date(2022, 6, 1);
	default_max = new Date();

	if (window.MIN) {
	    default_min = new Date(window.MIN * 1000);
	}
	if (window.MAX) {
	    default_max = new Date(window.MAX * 1000);
	}
	$('#activity-body').html(mainTemplate({}));
	$('#waitwait_div').html(templates['waitwait-modal']);
	$('#oops_div').html(templates['oops-modal']);

	$("#start_day").datepicker({
	    yearRange: "2014:+1",
	    changeYear: true,
	    maxDate: 0,
	    onClose: function (dateString, dateobject) {
		default_min = new Date(dateString);
		console.info("new min", default_min);
	    },
	});
	$("#start_day").datepicker("setDate", default_min);
	
	$("#end_day").datepicker({
	    yearRange: "2014:+0",
	    changeYear: true,
	    maxDate: 0,
	    onClose: function (dateString, dateobject) {
		default_max = new Date(dateString);
		console.info("new max", default_max);
	    },
	});
	$("#end_day").datepicker("setDate", default_max);
	
	// Handler for the date range search button.
	$('#go-button').click(function() {
	    SearchAgain();
	});
	// Bind search for IP.
	if (window.ISADMIN) {
	    $('#search-ip button').click(function (event) {
		event.preventDefault();
		SearchAgain();		
	    });
	}
	// Do the initial search
	LoadData(function(json) {
	    console.info(json);
	    $('#waiting').addClass("hidden");
	    if (json.code) {
		alert(json.value);
		return;
	    }
	    GenerateTable(json.value);
	});
    }

    function LoadData(callback)
    {
	var args = {
	    "min"  : Math.floor(default_min.getTime() / 1000),
	    "max"  : Math.floor(default_max.getTime() / 1000),
	};
	if (window.TARGET_USER) {
	    args["target_user"] = window.TARGET_USER;
	}
	if (window.TARGET_PROJECT) {
	    args["target_project"] = window.TARGET_PROJECT;
	}
	if (window.PORTALONLY) {
	    args["portalonly"] = true;
	}
	if (window.CLUSTER) {
	    args["cluster"] = window.CLUSTER;
	}
	var token = $.trim($('#search-ip input').val());
	if (token != "") {
	    var ipx = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/;
	    var pnx = /^\w[-\w]*$/;
	    if (ipx.test(token) || pnx.test(token)) {
		args["IP"] = token;
	    }
	    else {
		alert("Invalid IP address or physical node ID");
		return;
	    }
	}
	console.info(args);
	sup.CallServerMethod(null, "activity", "Search", args, callback);
    }

    function GenerateTable(instances)
    {
	$('#table-div').empty();
	var activity_html = tableTemplate({instances: instances});
	$('#table-div').html(activity_html);

	$('#experiment-count span').html(_.size(instances));
	$('#experiment-count').removeClass("hidden");

	// Format dates with moment before display.
	$('.format-date').each(function() {
	    var date = $.trim($(this).html());
	    if (date != "") {
		$(this).html(moment($(this).html()).format("lll"));
	    }
	});
	var tablename  = "#activity_table";
	var searchname = "#activity_table_search";
	
	var table = $(tablename)
	    .tablesorter({
		    theme : 'bootstrap',
		    headerTemplate : '{content} {icon}',
		    widgets: ["uitheme", "zebra", "filter", "math"],

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

			// data-math attribute
			math_data     : 'math',
			// ignore first column
			math_ignore   : [0],
			// integers
			math_mask     : '',
			// complete executed after each function
			math_completed : function(config) {
			    console.info("math completed");
			    $('#header-column-counts')
				.html($('#footer-column-counts').html());
			},
		    }
		});

	// Target the $('.search') input using built in functioning
	// this binds to the search using "search" and "keyup"
	// Allows using filter_liveSearch or delayed search &
	// pressing escape to cancel the search
	$.tablesorter.filter.bindSearch(table, $(searchname));

	// Update the count of matched experiments
	table.bind('filterEnd', function(e, filter) {
	    $('#experiment-count span').html(filter.filteredRows);
	});

	// This activates the popover subsystem.
	$('[data-toggle="popover"]').popover({
	    trigger: 'hover',
	    placement: 'auto',
	});
    }

    function SearchAgain()
    {
	var doit = function () {
	    LoadData(function(json) {
		console.info(json);
		if (json.code) {
		    sup.HideWaitWait(function () {
			sup.SpitOops("oops", json.value);
		    });
		    return;
		}
		var results = json.value;
		if (results.length == 0) {
		    sup.HideWaitWait(function () {
			sup.SpitOops("oops", "No matching results");
		    });
		    return;
		}
		GenerateTable(results);
		sup.HideWaitWait();
	    });
	};
	sup.ShowWaitWait("Patience please, this will take a few moments",
			 undefined, doit);
    }

    $(document).ready(initialize);
});
