$(function ()
{
    'use strict';

    var templates = APT_OPTIONS.fetchTemplateList(['show-nodeutilization',
						   'nodeutilization-list',
						   'oops-modal',
						   'waitwait-modal']);
    var mainTemplate = _.template(templates['show-nodeutilization']);
    var listTemplate = _.template(templates['nodeutilization-list']);

    function initialize()
    {
	window.APT_OPTIONS.initialize(sup);

	var html = mainTemplate({});
	$('#main-body').html(html);

	// Now we can do this.
	$('#oops_div').html(templates['oops-modal']);
	$('#waitwait_div').html(templates['waitwait-modal']);

        var args = null;
        if (window.TARGET_NODE !== undefined) {
            args["node_id"] = window.TARGET_NODE;
        }
        else if (window.TARGET_TYPE !== undefined) {
            args["type"] = window.TARGET_TYPE;
        }
        sup.CallServerMethod(null, "node", "GetUtilization", args,
                             function (json) {
                                 console.info(json);
                                 if (json.code) {
		                     console.log("Could not get utilization: " + json.value);
		                     return;
	                         }
                                 Render(json.value);
                             });
    }

    function Render(data)
    {
	var html = listTemplate({"rows" : data});
	$('#utilization-table-div').html(html);

	// Format dates with moment before display.
	$('.format-date').each(function() {
	    var date = $.trim($(this).html());
	    if (date != "") {
		$(this).html(moment($(this).html()).format("ll"));
	    }
	});

	$('#utilization-table')
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
		    filter_columnFilters : true,
		},
	    });
    }
    $(document).ready(initialize);
});
