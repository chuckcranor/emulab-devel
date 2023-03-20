$(function ()
{
    'use strict';

    var templates = APT_OPTIONS.fetchTemplateList(['sumstats',
						   'sumstats-table',
						   'output-dropdown',
						   "waitwait-modal",
						   "oops-modal"]);
    var mainTemplate   = _.template(templates['sumstats']);
    var tableTemplate  = _.template(templates['sumstats-table']);
    var dropdownString = templates['output-dropdown'];
    var default_min;
    var default_max;

    function initialize()
    {
	window.APT_OPTIONS.initialize(sup);
	default_min = new Date(2014, 6, 1);
	default_max = new Date();

	if (window.MIN) {
	    default_min = new Date(window.MIN * 1000);
	}
	if (window.MAX) {
	    default_max = new Date(window.MAX * 1000);
	}
	$('#sumstats-body').html(mainTemplate({}));
	$('#waitwait_div').html(templates['waitwait-modal']);
	$('#oops_div').html(templates['oops-modal']);
	$('#output_dropdown').html(dropdownString);

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
	    "target" : window.SHOWBY,
	};
	console.info(args);
	sup.CallServerMethod(null, "sumstats", "GetStats", args, callback);
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

    function GenerateTable(results)
    {
	$('#table-div').empty();
	var sumstats_html = tableTemplate({results: results});
	$('#table-div').html(sumstats_html);

	$('#results-count span').html(_.size(results));
	$('#results-count').removeClass("hidden");

	var tablename  = "#sumstats_table";
	var searchname = "#sumstats_table_search";
	var $this      = $('#output_dropdown');
	
	var table = $(tablename)
	    .tablesorter({
		    theme : 'bootstrap',
		    widgets: ["uitheme", "zebra", "filter",
			      "resizable", "math", "output"],
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

			// ',' 'json', 'array' or separator (e.g. ',')
			output_separator     : ',',
			// columns to ignore [0, 1,... ] (zero-based index)
			output_ignoreColumns : [],
			// include hidden columns in the output
			output_hiddenColumns : false,
			// include footer rows in the output
			output_includeFooter : true,
			// data-attribute containing alternate cell text
			output_dataAttrib    : 'data-name',
			// output all header rows (multiple rows)
			output_headerRows    : true,
			// (p)opup, (d)ownload
			output_delivery      : 'p',
			// (a)ll, (f)iltered or (v)isible
			output_saveRows      : 'f',
			// duplicate output data in tbody colspan/rowspan
			output_duplicateSpans: true,
			// change quote to left double quote
			output_replaceQuote  : '\u201c;',
			// output includes all cell HTML (except header cells)
			output_includeHTML   : true,
			// remove extra white-space characters (trim)
			output_trimSpaces    : false,
			// wrap every cell output in quotes
			output_wrapQuotes    : false,
			output_popupStyle    : 'width=580,height=310',
			output_saveFileName  : 'mytable.csv',
			// callbackJSON used when outputting JSON &
			// any header cells has a colspan - unique
			// names required
			output_callbackJSON  : function($cell,txt,cellIndex) {
			    return txt + '(' + cellIndex + ')'; },
			// callback executed when processing completes
			// return true to continue download/output
			// return false to stop delivery & do
			// something else with the data
			output_callback      : function(config, data) {
			    return true; },

			output_encoding      :
			      'data:application/octet-stream;charset=utf8,'
		    }
		});
	// Target the $('.search') input using built in functioning
	// this binds to the search using "search" and "keyup"
	// Allows using filter_liveSearch or delayed search &
	// pressing escape to cancel the search
	$.tablesorter.filter.bindSearch(table, $(searchname));

	// Update the count of matched experiments
	table.bind('filterEnd', function(e, filter) {
	    $('#results-count span').html(filter.filteredRows);
	});

	//
	// All this output stuff from the example page.
	// Not needed for bootstrap 5, using autoClose attribute instead.
	if (0) {
	$this.find('.dropdown-toggle-foo').click(function(e){
	    // this is needed because clicking inside the dropdown will close
	    // the menu with only bootstrap controlling it.
	    $this.find('.dropdown-menu').toggle();
	    return false;
	});
	}
	// make separator & replace quotes buttons update the value
	$this.find('.output-separator').click(function(){
	    $this.find('.output-separator').removeClass('active');
	    var txt = $(this).addClass('active').html()
	    $this.find('.output-separator-input').val( txt );
	    $this.find('.output-filename').val(function(i, v){
		// change filename extension based on separator
		var filetype = (txt === 'json' || txt === 'array') ? 'js' :
		    txt === ',' ? 'csv' : 'txt';
		return v.replace(/\.\w+$/, '.' + filetype);
	    });
	    return false;
	});
	$this.find('.output-quotes').click(function(){
	    $this.find('.output-quotes').removeClass('active');
	    $this.find('.output-replacequotes')
		.val( $(this).addClass('active').text() );
	    return false;
	});

	// clicking the download button; all you really need is to
	// trigger an "output" event on the table
	$this.find('.download').click(function(){
	    var typ,
            wo = table[0].config.widgetOptions;
            var saved = $this.find('.output-filter-all :checked').attr('class');
	    wo.output_separator    = $this.find('.output-separator-input').val();
	    wo.output_delivery     =
		$this.find('.output-download-popup :checked')
		.attr('class') === "output-download" ? 'd' : 'p';
	    wo.output_saveRows     = saved === "output-filter" ? 'f' :
		saved === 'output-visible' ? 'v' : 'a';
	    wo.output_replaceQuote = $this.find('.output-replacequotes').val();
	    wo.output_trimSpaces   = $this.find('.output-trim').is(':checked');
	    wo.output_includeHTML  = $this.find('.output-html').is(':checked');
	    wo.output_wrapQuotes   = $this.find('.output-wrap').is(':checked');
	    wo.output_headerRows   = $this.find('.output-headers').is(':checked');
	    wo.output_saveFileName = $this.find('.output-filename').val();
	    table.trigger('outputTable');
	    return false;
	});
    }

    $(document).ready(initialize);
});
