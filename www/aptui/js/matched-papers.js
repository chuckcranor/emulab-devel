$(function ()
{
    'use strict';

    var templates = APT_OPTIONS.fetchTemplateList(['matched-papers',
						   "output-dropdown",
						   'waitwait-modal',
						   'oops-modal']);
    var mainTemplate = _.template(templates['matched-papers']);
    var dropdown     = templates['output-dropdown'];
    var papers       = null;
    var unmatched    = null;
    
    function initialize()
    {
	window.APT_OPTIONS.initialize(sup);

	papers = JSON.parse(_.unescape($("#papers-json")[0].textContent));
	console.info(papers);
	unmatched = JSON.parse(_.unescape($("#unmatched-json")[0].textContent));
	console.info(unmatched);

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
	    "unmatched" : unmatched,
	});
	$('#main-body').html(html);
	if (window.ISADMIN) {
	    $('#output_dropdown').html(dropdown);
	}

	$('.format-date').each(function() {
	    var date = $.trim($(this).html());
	    if (date != "") {
		$(this).html(moment($(this).html()).format("ll"));
	    }
	});

	// "Uses" radio button handler.
	$('.compact-radio input[type=radio]').change(function() {
	    HandleUsesChange(this);
	});

	var args = {
	    theme : 'bootstrap',
	    widgets : [ "uitheme", "zebra", "filter", "output"],
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

		// ',' 'json', 'array' or separator (e.g. ',')
		output_separator     : ',',
		// columns to ignore [0, 1,... ] (zero-based index)
		output_ignoreColumns : [2,5],
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
	    },
	    sortList: [[1,1]]
	};
	if (window.ISADMIN) {
	    args["textExtraction"] = {
		5: function(node) {return $(node).find("input:checked").val();}
	    };
	}

	var table = $("#papers-table").tablesorter(args);

	// Target the $('.search') input using built in functioning
	// this binds to the search using "search" and "keyup"
	// Allows using filter_liveSearch or delayed search &
	// pressing escape to cancel the search
	$.tablesorter.filter.bindSearch(table, $("#papers-search"));

	// Update the count of matches
	table.bind('filterEnd', function(e, filter) {
	    $(' .papers-match-count').text(filter.filteredRows);
	});

	if (window.ISADMIN) {
	    //
	    // All this output stuff from the example page.
	    //
	    var $this = $('#output_dropdown');

	    // Not needed for bootstrap 5, using autoClose attribute instead.
	    if (0) {
	    $this.find('.dropdown-toggle').click(function(e){
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
		console.info(table, saved);
		
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

	/*
	 * Generate some stats.
	 */
	if (window.ISADMIN) {
	    var yes = 0;
	    var no  = 0;
	    var unk = 0;
	    _.each(papers, function(info) {
		if (info.uses == "yes") {
		    yes++;
		}
		else if (info.uses == "no") {
		    no++;
		}
		else {
		    unk++;
		}
	    });
	    $('.papers-match-breakdown')
		.html("(" + yes + "/" + no + "/" + unk + ")");
	}

	if (window.ISADMIN && _.size(unmatched)) {
	    $('#unmatched').removeClass("hidden");

	    var args = {
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
		    },
		    sortList: [[1,1]]
	    };
	    args["textExtraction"] = {
		5: function(node) {return $(node).find("input:checked").val();}
	    };
	    var table2 = $("#unmatched-table").tablesorter(args);

	    // Target the $('.search') input using built in functioning
	    // this binds to the search using "search" and "keyup"
	    // Allows using filter_liveSearch or delayed search &
	    // pressing escape to cancel the search
	    $.tablesorter.filter.bindSearch(table2, $("#unmatched-search"));

	    // Update the count of matches
	    table2.bind('filterEnd', function(e, filter) {
		$(' .unmatched-match-count').text(filter.filteredRows);
	    });
	}
    }

    function HandleUsesChange(target)
    {
	var scopus_id = $(target).closest('tr').data("scopus-id");
	console.info("HandleUsesChange: ", $(target).val(), scopus_id);

	sup.CallServerMethod(null, "scopus", "MarkUses",
			     {"scopus-id" : scopus_id,
			      "uses"      : $(target).val()},
			     function (json) {
				 if (json.code) {
				     console.info(json.value);
				     sup.SpitOops("oops", json.value);
				     return;
				 }
			     });
    }
    
    $(document).ready(initialize);
});
