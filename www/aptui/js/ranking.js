$(function ()
{
    'use strict';
    var templates = APT_OPTIONS.fetchTemplateList(['ranking']);
    var mainTemplate    = _.template(templates['ranking']);
    
    function initialize()
    {
	window.APT_OPTIONS.initialize(sup);
	var userlist = decodejson('#user-json');
	var projlist = decodejson('#project-json');
	var proflist = decodejson('#profile-json');
	
	// Generate the main template.
	var html = mainTemplate({
	    "users"     : userlist,
	    "projects"  : projlist,
	    "profiles"  : proflist,
	    "days"      : window.DAYS,
	});
	$('#main-body').html(html);
	InitTable("users");
	InitTable("projects");
	InitTable("profiles");

        // Javascript to enable link to tab
        var hash = document.location.hash;
        if (hash) {
            $('.nav-tabs a[href='+hash+']').tab('show');
        }
        // Change hash for page-reload
        $('a[data-toggle="tab"]').on('show.bs.tab', function (e) {
            window.location.hash = e.target.hash;
        });

	// Button to change the number of days.
	$('#change_days').click(function () {
	    var days = $('#days').val();
	    window.location.replace("ranking.php?days=" + days);
	});
    }
    
    function InitTable(name)
    {
	var tablename  = "#" + name + "_table";
	var searchname = "#" + name + "_search";
	
	var table = $(tablename)
		.tablesorter({
		    theme : 'bootstrap',
		    widgets : [ "uitheme", "zebra", "filter"],
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
		    }
		});

	// Target the $('.search') input using built in functioning
	// this binds to the search using "search" and "keyup"
	// Allows using filter_liveSearch or delayed search &
	// pressing escape to cancel the search
	$.tablesorter.filter.bindSearch(table, $(searchname));
    }

    // Helper.
    function decodejson(id) {
	return JSON.parse(_.unescape($(id)[0].textContent));
    }
    $(document).ready(initialize);
});


