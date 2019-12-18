$(function ()
{
    'use strict';

    var template_list   = ["resinfo", "resinfo-totals", "reservation-graph",
			   "range-list", "oops-modal", "waitwait-modal"];
    var templates       = APT_OPTIONS.fetchTemplateList(template_list);    
    var oopsString      = templates["oops-modal"];
    var waitwaitString  = templates["waitwait-modal"];
    var mainTemplate    = _.template(templates["resinfo"]);
    var graphTemplate   = _.template(templates["reservation-graph"]);
    var totalsTemplate  = _.template(templates["resinfo-totals"]);
    var rangeTemplate   = _.template(templates["range-list"]);
    var amlist          = null;
    var FEs             = {};  // Powder
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
	    if (window.ISPOWDER) {
		LoadRangeReservations();
	    }
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

	    // Powder; these go in a combined graph.
	    if (details.isFE) {
		FEs[urn] = details;
		return;
	    }
	    $('#' + details.nickname + " .counts-panel")
		.html(totalsTemplate({"details"      : details,
				      "urn"          : urn,
				      "title"        : details.nickname}));

	    if (window.ISPOWDER && details.radiotypes) {
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

		// Powder
		if (details.isFE) {
		    ProcessFE(urn, json);
		    return;
		}
		
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
		var forecast  = json.value.forecast;
		var skiptypes = json.value.prunelist;

		// Just POWDER
		if (window.ISPOWDER && details.radiotypes) {
		    /*
		     * We want to show radio types, and any reservable
		     * nodes that are one of the radio types. So extend
		     * the radiotypes array.
		     */
		    _.each(details.reservable_nodes, function (type, node_id) {
			if (_.has(details.radiotypes, type)) {
			    details.radiotypes[node_id] = true;
			}
		    })
		    var radioskiptypes = {};
		    Object.assign(radioskiptypes, skiptypes);
		    Object.assign(radioskiptypes, details.radiotypes);
		    
		    ShowResGraph({"forecast"       : forecast,
				  "selector"       : graphid + "-radios",
				  "foralloc"       : true,
				  "maxdays"        : 14,
				  "skiptypes"      : null,
				  "showtypes"      : details.radiotypes,
				  "click_callback" : null});
		    ShowResGraph({"forecast"       : forecast,
				  "selector"       : graphid + "-servers",
				  "foralloc"       : true,
				  "skiptypes"      : radioskiptypes,
				  "showtypes"      : null,
				  "click_callback" : null});
		}
		else {
		    ShowResGraph({"forecast"       : forecast,
				  "selector"       : graphid + "-servers",
				  "foralloc"       : true,
				  "skiptypes"      : skiptypes,
				  "click_callback" : null});
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

	// Sort so its consistent.
	var types = Object.keys(forecast).sort();
	var type;
	
	// Each node type
	for (type of types) {
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

    /*
     * We handle FE forcasts as they return here, so we can create a
     * single combined graph. Note that my original trick of replacing
     * the graph as each one came back, did not work. The NVD3 libraries
     * cannot handle that, they leave all kinds of state behind.
     */
    var FEresults = {};
    
    function ProcessFE(urn, json)
    {
	var details = amlist[urn];
	var combinedForecasts = {};
	
	if (json.code) {
	    console.log("Could not get reservation data for " +
			details.name + ": " + json.value);
	    FEresults[urn] = null;
	}
	else {
	    FEresults[urn] = json.value;
	}
	// Wait till they all return.
	var keys = Object.keys(FEs);
	for (var i = 0; i < keys.length; i++) {
	    var urn       = keys[i];
	    var details   = amlist[urn];
	    
	    if (details.isFE && !_.has(FEresults, urn)) {
		return;
	    }
	}
	// Kill the spinners.
	$('#fixed-endpoints .resgraph-spinner').addClass("hidden");

	_.each(FEs, function (details, urn) {
	    var forecasts = FEresults[urn].forecast;
	    var skiptypes = FEresults[urn].skiptypes;

	    _.each(forecasts, function(forecast, type) {
		var id = amlist[urn].abbreviation + "/" + type;

		combinedForecasts[id] = forecast;
	    });

	    /*
	     * Update the counts panel with all of the forecasts
	     */
	    var countid = "fixed-endpoints .counts-panel";
	    GenerateCountPanel(urn, countid, forecasts, null);
	    
	});
	console.info("AddToFEGraph", combinedForecasts);

	ShowResGraph({"forecast"  : combinedForecasts,
		      "selector"  : "resgraph-FEs",
		      "height"    : "400px",
		      "skiptypes" : {},
		     });
    }

    /*
     * Load the range reservation info.
     */
    function LoadRangeReservations()
    {
	var callback = function(json) {
	    console.log("LoadRangeReservations", json);
	    if (json.code) {
		console.info("Could not get range info");
		return;
	    }
	    if (!_.size(json.value)) {
		return;
	    }
	    
	    var html = rangeTemplate({"ranges" : json.value});
	    $('#range-list').html(html).removeClass("hidden");

	    // Format dates with moment before display.
	    $('#range-list .format-date').each(function() {
		var date = $.trim($(this).html());
		if (date != "") {
		    $(this).html(moment(date).format("lll"));
		}
	    });
	    $('#range-list .tablesorter')
		.tablesorter({
		    theme : 'green',
		    // initialize zebra
		    widgets: ["zebra"],
		});
	};

	var xmlthing = sup.CallServerMethod(null, "resgroup",
					    "RangeReservations");
	xmlthing.done(callback);
    }
    
    $(document).ready(initialize);
});
