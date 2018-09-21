$(function ()
{
    'use strict';

    var templates = APT_OPTIONS.fetchTemplateList(['experiments',
						   'experiment-list',
						   'waitwait-modal',
						   'oops-modal']);

    var mainString     = templates['experiments'];
    var listString     = templates['experiment-list'];
    var waitwaitString = templates['waitwait-modal'];
    var oopsString     = templates['oops-modal'];

    function initialize()
    {
	window.APT_OPTIONS.initialize(sup);

	$('#page-body').html(mainString);
	$('#oops_div').html(oopsString);
	$('#waitwait_div').html(waitwaitString);
	
	LoadTable();
    }

    function LoadTable()
    {
	var callback = function(json) {
	    console.info(json);
	    if (json.code) {
		sup.SpitOops("oops", json.value);
		return;
	    }
	    var template = _.template(listString);
	    var html = template({"experiments" : json.value,
				 "showCreator" : true,
				 "showProject" : true,
				 "searchUUID"  : true,
				});
	    $('#experiments_content').html(html);
	    InitTable();
	    $('#experiments_loading').addClass("hidden");
	    $('#experiments_loaded').removeClass("hidden");
	};
	sup.CallServerMethod(null, "experiments", "ExperimentList",
			     null, callback);
    }

    function InitTable()
    {
	var tablename  = "#experiments_table";
	var searchname = "#experiments_search";

	// Format dates with moment before display.
	$('.format-date').each(function() {
	    var date = $.trim($(this).html());
	    if (date != "") {
		$(this).html(moment(date).format("ll"));
	    }
	});

	// This activates the tooltip subsystem.
	$('[data-toggle="tooltip"]').tooltip({
	    delay: {"hide" : 500, "show" : 150},
	    placement: 'auto',
	});

	var table = $(tablename)
		.tablesorter({
		    theme : 'green',
		    
		    // initialize zebra and filter widgets
		    widgets: ["zebra", "filter", "resizable"],

		    headers: {
			0: {
			    sorter : "text",
			}
		    },

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
		    }
		});

	/*
	 * We have to implement our own live search cause we want to combine
	 * the search box with the checkbox filters. To do that, we have to
	 * call SetFilters() on the table directly. 
	 */
	var search_timeout = null;
	
	$("#experiments_search").on("search keyup", function (event) {
	    var userInput = $("#experiments_search").val();
	    window.clearTimeout(search_timeout);

	    search_timeout =
		window.setTimeout(function() {
		    var filters = $.tablesorter.getFilters(table);
		    filters[13] = userInput;
		    //console.info("Search", filters);
		    $.tablesorter.setFilters(table, filters, true);
		}, 500);
	});

	// Bind handlers for the radio buttons
	$('#radio-buttons input').change(function (e) {
	    e.preventDefault();

	    /*
	     * The use of data-id is to avoid page jumping when changing
	     * the page hash; it wants to jump to the radio buttons.
	     */
            // Change hash for page-reload
	    var hash = $(e.target).data("id");
		
            window.location.hash = hash;
	    // SetFilters() is called below in hashchange handler.
	  });

	// Update the count of matched experiments
	table.bind('filterEnd', function(e, filter) {
	    $('#experiments_count').text(filter.filteredRows);
	});

        // Javascript to enable link to radio button
        var hash = document.location.hash;
        if (hash) {
	    /*
	     * The use of data-id is to avoid page jumping when changing
	     * the page hash; it wants to jump to the radio buttons.
	     */
	    $('#radio-buttons [data-id="' + hash +'"]').prop("checked", true);
        }
	// Set the correct radio when a user uses their back/forward button
        $(window).on('hashchange', function (e) {
	    var hash = window.location.hash;
	    if (hash == "") {
		hash = "#all";
	    }
	    /*
	     * The use of data-id is to avoid page jumping when changing
	     * the page hash; it wants to jump to the radio buttons.
	     */
	    $('#radio-buttons [data-id="' + hash +'"]').prop("checked", true);
	    SetFilters(table);
	});
	SetFilters(table);

	// Initial sort.
	if (window.SORTYBY !== undefined && window.SORTYBY == "created") {
	    table.find('th:eq(9)').trigger('sort');
	}
	else if (hash === "#extending") {
	    table.find('th:eq(10)').trigger('sort');
	}
	else {
	    table.find('th:eq(0)').trigger('sort');
	}

	// Bind search for IP.
	$('#experiment-search-ip button').click(function (event) {
	    event.preventDefault();
	    var ip = $.trim($('#experiment-search-ip input').val());
	    var rx = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/;
	    if (rx.test(ip)) {
		SearchForIP(ip, table);
	    }
	    else {
		alert("Invalid IP address");
	    }
	});
    }

    function SetFilters(table)
    {
	var tmp = [];
	var filters = $.tablesorter.getFilters(table);
	// The "any" filter needs a value or everything disappears.
	// If there is a term in the search box, it will have a value.
	if (filters[13] === undefined) {
	    filters[13] = "";
	}
	if ($('#radio-buttons [data-id="#extending"]').is(":checked")) {
	    tmp.push("extending");
	}
	if ($('#radio-buttons [data-id="#locked"]').is(":checked")) {
	    tmp.push("locked");
	}
	if ($('#radio-buttons [data-id="#expired"]').is(":checked")) {
	    tmp.push("expired");
	}
	if ($('#radio-buttons [data-id="#old"]').is(":checked")) {
	    tmp.push("old");
	}
	if (tmp.length) {
	    // regex search, plain | does not work.
	    filters[12] = "/" + tmp.join("|") + "/";
	}
	else {
	    // Hmm, an empty string will get everything.
	    filters[12] = "";
	}
	//console.info("SetFilters", filters);
	$.tablesorter.setFilters(table, filters, true);
    }

    /*
     * Send the IP to the backend for search, and then update the filters
     * if we get back a match, so the user sees just the experiment.
     */
    function SearchForIP(ip, table)
    {
	var filters = $.tablesorter.getFilters(table);
	
	var callback = function (json) {
	    console.info(json);
	    if (json.code) {
		console.info(json.value);
		sup.HideWaitWait(function () {
		    sup.SpitOops("oops", "Could not find an experiment using " +
				 "this IP address");
		});
		return;
	    }
	    sup.HideWaitWait();
	    filters[12] = "";
	    filters[13] = json.value;
	    $.tablesorter.setFilters(table, filters, true);
	}
	// Clear this, we search for everything.
	$("#experiments_search").val("");
	filters[12] = "";
	filters[13] = "";
	$.tablesorter.setFilters(table, filters, true);
	
	sup.ShowWaitWait();
	sup.CallServerMethod(null, "experiments", "SearchIP",
			     {"ip" : ip}, callback);
    }
    
    $(document).ready(initialize);
});
