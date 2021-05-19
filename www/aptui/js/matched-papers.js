$(function ()
{
    'use strict';

    var templates = APT_OPTIONS.fetchTemplateList(['matched-papers',
						   'waitwait-modal',
						   'oops-modal']);
    var mainTemplate = _.template(templates['matched-papers']);
    var papers = null;
    
    function initialize()
    {
	window.APT_OPTIONS.initialize(sup);

	papers = JSON.parse(_.unescape($("#papers-json")[0].textContent));
	console.info(papers);

	// Now we can do this. 
	$('#oops_div').html(templates['waitwait-modal']);	
	$('#waitwait_div').html(templates['oops-modal']);

	GeneratePage();
    }

    function GeneratePage()
    {
	// Generate the template.
	var html = mainTemplate({
	    "papers" : papers,
	});
	$('#main-body').html(html);

	$('.format-date').each(function() {
	    var date = $.trim($(this).html());
	    if (date != "") {
		$(this).html(moment($(this).html()).format("ll"));
	    }
	});

	var table = $("#papers-table")
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
	$.tablesorter.filter.bindSearch(table, $("#papers-search"));

	// Update the count of matches
	table.bind('filterEnd', function(e, filter) {
	    $(' .match-count').text(filter.filteredRows);
	});
    }
    
    $(document).ready(initialize);
});
