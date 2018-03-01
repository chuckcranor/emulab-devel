$(function ()
{
    'use strict';

    var template_list   = ["resinfo", "resinfo-totals", "reservation-graph",
			   "oops-modal", "waitwait-modal"];
    var templates       = APT_OPTIONS.fetchTemplateList(template_list);    
    var oopsString      = templates["oops-modal"];
    var waitwaitString  = templates["waitwait-modal"];
    var mainTemplate    = _.template(templates["resinfo"]);
    var graphTemplate   = _.template(templates["reservation-graph"]);
    var totalsTemplate  = _.template(templates["resinfo-totals"]);
    var amlist          = null;
    var isadmin         = false;
    var skiptypes       = null;

    function initialize()
    {
	window.APT_OPTIONS.initialize(sup);

	isadmin  = window.ISADMIN;
	amlist   = JSON.parse(_.unescape($('#amlist-json')[0].textContent));
	skiptypes= JSON.parse(_.unescape($('#skiptypes-json')[0].textContent));

	GeneratePageBody();

	// Now we can do this. 
	$('#oops_div').html(oopsString);	
	$('#waitwait_div').html(waitwaitString);

	// Give this a slight delay so that the spinners appear.
	// Not really sure why they do not.
	setTimeout(function () {
	    LoadReservations();
	}, 100);	
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
	// Per clusters rows filled in with templates.
	_.each(amlist, function(details, urn) {
	    var graphid = 'resgraph-' + details.nickname;
	    
	    $('#' + details.nickname + " .counts-panel")
		.html(totalsTemplate({"details"      : details,
				      "urn"          : urn}));
	    
	    $('#' + details.nickname + " .resgraph-panel")
		.html(graphTemplate({"details"        : details,
				     "graphid"        : graphid,
				     "title"          : details.nickname,
				     "urn"            : urn,
				     "showhelp"       : true,
				     "showfullscreen" : false}));
	});
	// Handler for the Reservation Graph Help button
	$('.resgraph-help-button').click(function (event) {
	    event.preventDefault();
	    sup.ShowModal('#resgraph-help-modal');
	});

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
     * Load reservation info from each am in the list and generate
     * graphs and tables.
     */
    function LoadReservations()
    {
	_.each(amlist, function(details, urn) {
 	    var callback = function(json) {
		console.log("LoadReservations", json);
		var graphid = 'resgraph-' + details.nickname;
		var countid = details.nickname + " .counts-panel";
		
		// Kill the spinners
		$('#' + details.nickname + ' .resgraph-spinner')
		    .addClass("hidden");

		if (json.code) {
		    console.log("Could not get reservation data for " +
				details.name + ": " + json.value);
		    return;
		}
		ShowResGraph({"forecast"       : json.value.forecast,
			      "selector"       : graphid,
			      "foralloc"       : true,
			      "skiptypes"      : skiptypes,
			      "click_callback" : null});

		/*
		 * Fill in the counts panel. The first tuple in the forecast
		 * for each type is the immediately available node count.
		 */
		var forecast = json.value.forecast;
		var html     = "";

		// Each node type
		for (var type in forecast) {
		    // Skip types we do not want to show.
		    if (_.has(skiptypes, type)) {
			continue;
		    }
		    // This is an array of objects.
		    var array = forecast[type];
		    var data  = array[0];
		    var free  = parseInt(data.free) + parseInt(data.held);

		    html +=
			"<tr>" +
			" <td>" + type + "</td>" +
			" <td>" + free + "</td>" +
			"</tr>";
		}
		$('#' + countid + ' tbody').html(html);
		$('#' + countid + ' table').removeClass("hidden");
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
