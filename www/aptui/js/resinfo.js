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
    var FEs             = {};  // Powder
    var forecasts       = {};
    var isadmin         = false;

    function initialize()
    {
	window.APT_OPTIONS.initialize(sup);

	isadmin  = window.ISADMIN;
	amlist   = JSON.parse(_.unescape($('#amlist-json')[0].textContent));
	console.info("amlist", amlist);

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

	    // These go in a combined graph.
	    if (details.isFE) {
		FEs[urn] = details;
		return;
	    }
	    
	    $('#' + details.nickname + " .counts-panel")
		.html(totalsTemplate({"details"      : details,
				      "urn"          : urn,
				      "title"        :
				      (!window.ISPOWDER ?
				       details.nickname : details.nickname)}));

	    if (window.ISPOWDER && details.nickname == "Emulab") {
  		$('#' + details.nickname + " .resgraph-panel-radios")
		    .html(graphTemplate({"details"        : details,
					 "graphid"        : graphid + "-radios",
					 "title"          : "Powder Radio",
					 "urn"            : urn,
					 "showhelp"       : true,
					 "showfullscreen" : false}));
	    }
	    $('#' + details.nickname + " .resgraph-panel-servers")
		.html(graphTemplate({"details"        : details,
				     "graphid"        : graphid + "-servers",
				     "title"          :
				     (!window.ISPOWDER ?
				      details.nickname :
				      details.nickname + " Server"),
				     "urn"            : urn,
				     "showhelp"       : true,
				     "showfullscreen" : false}));
	});
	if (_.size(FEs)) {
	    $('#fixed-endpoints .counts-panel')
		.html(totalsTemplate({"title" : "Fixed Endpoints"}));

	    $("#fixed-endpoints .resgraph-panel-servers")
		.html(graphTemplate({"graphid"        : "resgraph-FEs",
				     "title"          : "Fixed Endpoint",
				     "showhelp"       : true,
				     "showfullscreen" : false}));
	    
	    $('#fixed-endpoints').removeClass("hidden");
	}

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
		    $('#' + details.nickname + ' .resgraph-error')
			.html(json.value);
		    $('#' + details.nickname + ' .resgraph-error')
			.removeClass("hidden");
		    return;
		}
		var forecast   = json.value.forecast;
		var skiptypes  = json.value.prunelist;
		forecasts[urn] = forecast;

		if (details.isFE) {
		    RegenFEGraph(urn);
		    return;
		}
		// Just POWDER
		var radiotypes = {"nuc5300"   : true,
				  "nuc6260"   : true,
				  "iris030"   : true,
				  "enodeb"    : true,
				  "x310"      : true,
				  "n310"      : true,
				  "sdr"       : true};

		if (window.ISPOWDER && details.nickname == "Emulab") {
		    ShowResGraph({"forecast"       : forecast,
				  "selector"       : graphid + "-radios",
				  "foralloc"       : true,
				  "maxdays"        : 14,
				  "skiptypes"      : skiptypes,
				  "showtypes"      : radiotypes,
				  "click_callback" : null});
		}
		if (window.ISPOWDER) {
		    // For the servers panel, do not show the radios.
		    skiptypes = Object.assign(skiptypes, radiotypes);
		}
		ShowResGraph({"forecast"       : forecast,
			      "selector"       : graphid + "-servers",
			      "foralloc"       : true,
			      "skiptypes"      : skiptypes,
			      "click_callback" : null});
		if (window.ISPOWDER) {
		    // But for the counts panel, we want to show the radios.
		    for (var type in radiotypes) {
			delete skiptypes[type];
		    }
		}

		/*
		 * Fill in the counts panel. The first tuple in the forecast
		 * for each type is the immediately available node count.
		 */
		GenerateCountPanel(urn, countid, forecast, skiptypes);
	    };
	    var xmlthing = sup.CallServerMethod(null, "reserve",
						"ReservationInfo",
						{"cluster" : details.nickname,
						 "anonymous" : 1});
	    xmlthing.done(callback);
	});
    }

    function GenerateCountPanel(urn, selector, forecast, skiptypes)
    {
	var details = amlist[urn];
	var html    = "";
	
	// Each node type
	for (var type in forecast) {
	    // Skip types we do not want to show.
	    if (skiptypes && _.has(skiptypes, type)) {
		continue;
	    }
	    // This is an array of objects.
	    var array = forecast[type];
	    // We want the first stime stamp, but there might be
	    // multiple entries for that time stamp, so scan foward
	    // to find the last one.
	    var data  = array[0];
	    for (var i in array) {
		var datum = array[i];
		if (datum.t == data.t) {
		    data = datum;
		}
	    }
	    var free  = parseInt(data.free) + parseInt(data.held);
	    // Link to the (public) shownode page.
	    var weburl = details.weburl;
	    // Reservable hack.
	    if (_.has(details.reservable_nodes, type)) {
		weburl += "/portal/show-node.php?node_id=" + type;
	    }
	    else {
		weburl += "/portal/show-nodetype.php?type=" + type;
	    }
	    // Powder.
	    if (details.isFE) {
		type = details.abbreviation + "/" + type;
	    }
	    weburl = "<a href='" + weburl + "' target=_blank>" + type + "</a>";

	    html +=
		"<tr>" +
		" <td>" + weburl + "</td>" +
		" <td>" + free + "</td>" +
		"</tr>";
	}
	$('#' + selector + ' tbody').append(html);
	$('#' + selector + ' table').removeClass("hidden");
    }

    function RegenFEGraph(newurn)
    {
	var combinedForecasts = {};
	
	// Kill the spinners.
	$('#fixed-endpoints .resgraph-spinner').addClass("hidden");

	console.info("RegenFEGraph");

	_.each(FEs, function (details, urn) {
	    // Do we have the forecasts yet?
	    if (!_.has(forecasts, urn)) {
		return;
	    }
	    _.each(forecasts[urn], function(forecast, type) {
		var id = amlist[urn].abbreviation + "/" + type;

		combinedForecasts[id] = forecasts[urn][type];
	    });
	});
	console.info("AddToFEGraph", combinedForecasts);

	ShowResGraph({"forecast"  : combinedForecasts,
		      "selector"  : "resgraph-FEs",
		      "height"    : "400px",
		      "skiptypes" : {},
		     });

	/*
	 * Update the counts panel with the newly added FE.
	 */
	var countid = "fixed-endpoints .counts-panel";
	GenerateCountPanel(newurn, countid, forecasts[newurn], null);
    }

    $(document).ready(initialize);
});
