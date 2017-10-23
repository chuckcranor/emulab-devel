$(function ()
{
    'use strict';

    var template_list   = ["resinfo", "reservation-graph",
			   "oops-modal", "waitwait-modal"];
    var templates       = APT_OPTIONS.fetchTemplateList(template_list);    
    var oopsString      = templates["oops-modal"];
    var waitwaitString  = templates["waitwait-modal"];
    var mainTemplate    = _.template(templates["resinfo"]);
    var graphTemplate   = _.template(templates["reservation-graph"]);
    var amlist          = null;
    var isadmin         = false;
    
    function initialize()
    {
	window.APT_OPTIONS.initialize(sup);

	isadmin  = window.ISADMIN;
	amlist   = JSON.parse(_.unescape($('#amlist-json')[0].textContent));

	GeneratePageBody();

	// Now we can do this. 
	$('#oops_div').html(oopsString);	
	$('#waitwait_div').html(waitwaitString);

	LoadReservations();
    }

    //
    function GeneratePageBody()
    {
	// Generate the template.
	var html = mainTemplate({
	    amlist:		amlist,
	    isadmin:		isadmin,
	});
	$('#main-body').html(html);
	// Graph list.
	$('#reservation-lists')
	    .html(graphTemplate({"amlist": amlist, "showcontrols" : false}));

	// This activates the popover subsystem.
	$('[data-toggle="popover"]').popover({
	    trigger: 'hover',
	    container: 'body'
	});
	// This activates the tooltip subsystem.
	$('[data-toggle="tooltip"]').tooltip({
	    placement: 'auto'
	});
    }
    
    /*
     * Load anonymized reservations from each am in the list and
     * generate tables.
     */
    function LoadReservations()
    {
	var count = Object.keys(amlist).length;

	_.each(amlist, function(details, urn) {
 	    var callback = function(json) {
		console.log("LoadReservations", json);
		
		// Kill the spinner.
		count--;
		if (count <= 0) {
		    $('#spinner').addClass("hidden");
		}
		if (json.code) {
		    console.log("Could not get reservation data for " +
				details.name + ": " + json.value);
		    return;
		}
		$('#reservation-lists #' + details.nickname)
		    .removeClass("hidden");

		ShowResGraph({"forecast"  : json.value.forecast,
			      "selector"  : details.nickname +
			                    " .timeseries-graph-panel",
			      "click_callback" : null});
	    };
	    var xmlthing = sup.CallServerMethod(null, "reserve",
						"ReservationInfo",
						{"cluster" : details.nickname,
						 "anonymous" : 1});
	    xmlthing.done(callback);
	});
    }

    $(document).ready(initialize);
});
