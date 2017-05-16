$(function ()
{
    'use strict';

    var templates = APT_OPTIONS.fetchTemplateList(['images']);
    var mainTemplate = _.template(templates['images']);

    function initialize()
    {
	window.APT_OPTIONS.initialize(sup);

	// Image data
	var images = JSON.parse(_.unescape($('#images-json')[0].textContent));
	console.info("images", images);

	// Generate the main template.
	var html = mainTemplate({
	    "images"  : images,
	    "all"     : window.ISADMIN && window.ALL,
	    "isadmin" : window.ISADMIN,
	    "manual"  : window.MANUAL,
	});
	$('#main-body').html(html);

	// Format dates with moment before display.
	$('.format-date').each(function() {
	    var date = $.trim($(this).html());
	    if (date != "") {
		$(this).html(moment($(this).html()).format("lll"));
	    }
	});
	// This activates the popover subsystem.
	$('[data-toggle="popover"]').popover({
	    placement: 'auto',
	});
	// This activates the tooltip subsystem.
	$('[data-toggle="tooltip"]').tooltip({
	    delay: {"hide" : 500, "show" : 150},
	    placement: 'auto',
	});
	// Prevent shooting to the top of the page on clicking the popover.
	$('#images-table [data-toggle="popover"]')
	    .click(function (event) {
		event.preventDefault();
	    });
	$('body').on('click', function (e) {
	    $('[data-toggle="popover"]').each(function () {
		//the 'is' for buttons that trigger popups
		//the 'has' for icons within a button that triggers a popup
		if (!$(this).is(e.target) &&
		    $(this).has(e.target).length === 0 &&
		    $('.popover').has(e.target).length === 0) {
		    $(this).popover('hide');
		}
	    });
	});
	// Bind handlers for the checkboxes.
	$('#my-images, #project-images, #public-images, ' +
	  '#admin-images, #system-images')
	    .change(function () {
		SetFilters();
	    });

	var table = $("#images-table")
	    .tablesorter({
		theme : 'blue',

		// initialize zebra and filter widgets
		widgets: ["zebra", "filter"],

		widgetOptions: {
		    // include child row content while filtering, if true
		    filter_childRows  : true,
		    // search from beginning
		    filter_startsWith : false,
		    // Set this option to false for case sensitive search
		    filter_ignoreCase : true,
		    // Only one search box.
		    filter_columnFilters : false,
		    // Search as typing
		    filter_liveSearch : true,
		},
		headers: {
		    4: {sorter: false},
		    5: {sorter: false},
		},
	    });
	
	/*
	 * We have to implement our own live search cause we want to combine
	 * the search box with the checkbox filters. To do that, we have to
	 * call SetFilters() on the table directly. 
	 */
	var search_timeout = null;
	
	$("#images-search").on("search keyup", function (event) {
	    var userInput = $("#images-search").val();
	    window.clearTimeout(search_timeout);

	    search_timeout =
		window.setTimeout(function() {
		    var filters = $.tablesorter.getFilters($('#images-table'));
		    filters[7] = userInput;
		    console.info("Search", filters);
		    $.tablesorter.setFilters($('#images-table'), filters, true);
		}, 500);
	});
	SetFilters();
    }

    function SetFilters()
    {
	var tmp = [];
	var filters = $.tablesorter.getFilters($('#images-table'));
	// The "any" filter needs a value or everything disappears.
	// If there is a term in the search box, it will have a value.
	if (filters[7] === undefined) {
	    filters[7] = "";
	}
	if ($('#my-images').is(":checked")) {
	    tmp.push("creator");
	}
	if ($('#project-images').is(":checked")) {
	    tmp.push("project");
	}
	if ($('#system-images').is(":checked")) {
	    tmp.push("system");
	}
	if ($('#public-images').is(":checked")) {
	    tmp.push("public");
	}
	if (window.ALL) {
	    if ($('#admin-images').is(":checked")) {
		tmp.push("admin");
	    }
	}
	if (tmp.length) {
	    // regex search, plain | does not work.
	    filters[6] = "/" + tmp.join("|") + "/";
	}
	else {
	    // Hmm, an empty string will get everything.
	    filters[6] = "WHY";
	}
	console.info("SetFilters", filters);
	$.tablesorter.setFilters($('#images-table'), filters, true);
    }
    
    $(document).ready(initialize);
});
