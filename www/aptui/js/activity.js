$(function () {
    'use strict';
    var ajaxurl = null;
    var templates = APT_OPTIONS.fetchTemplateList(['activity']);
    var profileTemplate = _.template(templates['activity']);

    function initialize()
    {
	window.APT_OPTIONS.initialize(sup);
	ajaxurl  = window.AJAXURL;
	var default_min = new Date(2014, 6, 1);
	var default_max = new Date();

	if (window.MIN) {
	    default_min = new Date(window.MIN * 1000);
	}
	if (window.MAX) {
	    default_max = new Date(window.MAX * 1000);
	}
	var instances =
	    JSON.parse(_.unescape($('#instances-json')[0].textContent));
	var activity_html = profileTemplate({instances: instances});
	$('#activity-body').html(activity_html);

	// Format dates with moment before display.
	$('.format-date').each(function() {
	    var date = $.trim($(this).html());
	    if (date != "") {
		$(this).html(moment($(this).html()).format("lll"));
	    }
	});
	$("#date-slider").dateRangeSlider({
	    bounds: {min: new Date(2014, 6, 1),
		     max: new Date()},
	    defaultValues: {min: default_min, max: default_max},
	    arrows: false,
	});
	// Handler for the date range search button.
	$('#slider-go-button').click(function() {
	    var dateValues = $("#date-slider").dateRangeSlider("values");
	    var min = Math.floor(dateValues.min.getTime()/1000);
	    var max = Math.floor(dateValues.max.getTime()/1000);
	    var url = "activity.php?";
	    if (window.ARG) {
		url = url + window.ARG + "&";
	    }
	    url = url + "min=" + min + "&max=" + max;
	    if (window.PORTALONLY) {
		url += "&portalonly=1";
	    }
	    window.location.replace(url);
	});

	var tablename  = "#activity_table";
	var searchname = "#activity_table_search";
	
	var table = $(tablename)
		.tablesorter({
		    theme : 'green',
		    
		    //cssChildRow: "tablesorter-childRow",

		    // initialize zebra and filter widgets
		    widgets: ["zebra", "filter", "math"],

		    widgetOptions: {
			// include child row content while filtering, if true
			filter_childRows  : true,
			// include all columns in the search.
			filter_anyMatch   : true,
			// class name applied to filter row and each input
			filter_cssFilter  : 'form-control',
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
		    }
		});

	// Target the $('.search') input using built in functioning
	// this binds to the search using "search" and "keyup"
	// Allows using filter_liveSearch or delayed search &
	// pressing escape to cancel the search
	$.tablesorter.filter.bindSearch(table, $(searchname));
    }
    $(document).ready(initialize);
});
