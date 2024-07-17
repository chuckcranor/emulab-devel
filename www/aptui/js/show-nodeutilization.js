$(function ()
{
    'use strict';

    var templates = APT_OPTIONS.fetchTemplateList(['show-nodeutilization',
						   'nodeutilization-list',
						   'oops-modal',
						   'waitwait-modal',
                                                   'output-dropdown']);
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
	$('#output_dropdown').html(templates['output-dropdown']);

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

	var table = $('#utilization-table')
	    .tablesorter({
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
		    filter_columnFilters : true,

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
		},
	    });
	var $this      = $('#output_dropdown');
        
	//
	// All this output stuff from the example page.
        //
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
