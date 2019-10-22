$(function ()
{
    'use strict';

    var template_list   = ["list-resgroups", "resgroup-list",
			   "resgroup-list-bytype", "resgroup-list-byrange",
			   "confirm-modal", "resusage-list", "resusage-graph",
			   "oops-modal", "waitwait-modal"];
    var templates       = APT_OPTIONS.fetchTemplateList(template_list);    
    var mainTemplate    = _.template(templates["list-resgroups"]);
    var listTemplate    = _.template(templates["resgroup-list"]);
    var bytypeTemplate  = _.template(templates["resgroup-list-bytype"]);
    var byrangeTemplate = _.template(templates["resgroup-list-byrange"]);
    var usageTemplate   = _.template(templates["resusage-list"]);
    var graphTemplate   = _.template(templates["resusage-graph"]);
    var confirmString   = templates["confirm-modal"];
    var oopsString      = templates["oops-modal"];
    var waitwaitString  = templates["waitwait-modal"];
    var amlist = null;
    
    function initialize()
    {
	window.APT_OPTIONS.initialize(sup);
	amlist  = decodejson('#amlist-json');

	$('#main-body').html(mainTemplate({"amlist" : amlist}));
	$('#oops_div').html(oopsString);	
	$('#waitwait_div').html(waitwaitString);
	$('#confirm_div').html(confirmString);

	sup.CallServerMethod(null, "resgroup", "ListReservationGroups", null,
			     function (json) {
				 if (json.code) {
				     sup.SpitOops("oops", json.value);
				     return;
				 }
				 DoReservations(json.value);
			     });
    }

    /*
     * Load reservations from each am in the list and generate a table.
     */
    function DoReservations(groups)
    {
	console.info("DoReservations", groups);

	if (!_.size(groups)) {
	    $('#nogroups').removeClass("hidden");
	    return;
	}

	// Generate the main template.
	var html = listTemplate({
	    "groups"       : groups,
	    "showcontrols" : false,
	    "showproject"  : true,
	    "showactivity" : true,
	    "showuser"     : true,
	    "showusing"    : true,
	    "showstatus"   : true,
	    "isadmin"      : window.ISADMIN,
	});
	$("#groups").html(html);

	// Format dates with moment before display.
	$('#groups .format-date').each(function() {
	    var date = $.trim($(this).html());
	    if (date != "") {
		$(this).html(moment(date).format("lll"));
	    }
	});
	$('#groups .tablesorter.resgroup-list')
	    .tablesorter({
		theme : 'green',
		// initialize zebra
		widgets: ["zebra"],
	    });

	// Show the proper status, for the group and for each reservation
	// in the group.
	_.each(groups, function(group, uuid) {
	    var groupid = '#groups tr[data-uuid="' + uuid + '"] ';
	    var grow    = $(groupid);
	    var crow    = grow.next();

	    // Disable sorting if only one row.
	    if (_.size(group.clusters) == 1) {
		crow.find(".tablesorter.clusters-table thead th")
		    .addClass("sorter-false");
	    }
	    if (_.size(group.ranges) == 1) {
		crow.find(".tablesorter.ranges-table thead th")
		    .addClass("sorter-false");
	    }
	    crow.find(".tablesorter").tablesorter({
		    theme : 'green',
		    // initialize zebra
		    widgets: ["zebra"],
		});

	    if (group.status == "approved") {
		$(groupid + " .group-status-column .status-approved")
		    .removeClass("hidden");
	    }
	    else if (group.status == "canceled") {
		$(groupid + " .group-status-column .status-canceled")
		    .removeClass("hidden");
	    }
	    else if (group.status == "pending") {
		$(groupid + " .group-status-column .status-pending")
		    .removeClass("hidden");
	    }
	    _.each(group.clusters, function(reservation, uuid) {
		var resid = 'tr[data-uuid="' + uuid + '"] ';
		var rrow  = crow.find(resid);

		if (reservation.deleted) {
		    rrow.find(".reservation-status-column .status-deleted")
			.removeClass("hidden");
		}
		else if (reservation.canceled) {
		    rrow.find(".reservation-status-column .status-canceled")
			.removeClass("hidden");
		}
		else if (reservation.approved) {
		    rrow.find(".reservation-status-column .status-approved")
			.removeClass("hidden");
		}
		else {
		    rrow.find(".reservation-status-column .status-pending")
			.removeClass("hidden");
		}
	    });
	    _.each(group.ranges, function(reservation, uuid) {
		var resid = 'tr[data-uuid="' + uuid + '"] ';
		var rrow  = crow.find(resid);

		if (reservation.canceled) {
		    rrow.find(".reservation-status-column .status-canceled")
			.removeClass("hidden");
		}
		else if (reservation.approved) {
		    rrow.find(".reservation-status-column .status-approved")
			.removeClass("hidden");
		}
		else {
		    rrow.find(".reservation-status-column .status-pending")
			.removeClass("hidden");
		}
	    });
	});
	$('#groups .tablesorter .tablesorter-childRow>td').hide();	
	$('#groups .tablesorter .show-childrow').click(function (event) {
	    // Determine current state for changing the chevron.
	    var row = $(this).closest('tr')
		.nextUntil('tr.tablesorter-hasChildRow').find('td')[0];
	    var display = $(row).css("display");
	    if (display == "none") {
		$(this).find(".expando")
		    .removeClass("glyphicon-chevron-right")
		    .addClass("glyphicon-chevron-down");
	    }
	    else {
		$(this).find(".expando")
		    .removeClass("glyphicon-chevron-down")
		    .addClass("glyphicon-chevron-right");
	    }
	    $(row).toggle();
	});
	
	// This activates the tooltip subsystem.
	$('#groups [data-toggle="tooltip"]').tooltip({
	    delay: {"hide" : 250, "show" : 250},
	    placement: 'auto',
	});
	// This activates the popover subsystem.
	$('#groups [data-toggle="popover"]').popover({
	    placement: 'auto',
	    container: 'body',
	});

	if (window.ISADMIN) {
	    var html = bytypeTemplate({
		"groups"       : groups,
		"showcontrols" : false,
		"showproject"  : true,
		"showactivity" : true,
		"showuser"     : true,
		"showusing"    : true,
		"showstatus"   : true,
		"isadmin"      : window.ISADMIN,
	    });
	    $("#groups-bytype").html(html);

	    // Status column
	    _.each(groups, function(group) {
		_.each(group.clusters, function(reservation, uuid) {
		    var resid = 'tr[data-uuid="' + uuid + '"] ';
		    var rrow  = $('#groups-bytype ' + resid);

		    if (reservation.canceled) {
			rrow.find(".reservation-status-column .status-canceled")
			    .removeClass("hidden");
		    }
		    else if (reservation.deleted) {
			rrow.find(".reservation-status-column .status-deleted")
			    .removeClass("hidden");
		    }
		    else if (reservation.approved) {
			rrow.find(".reservation-status-column .status-approved")
			    .removeClass("hidden");
		    }
		    else {
			rrow.find(".reservation-status-column .status-pending")
			    .removeClass("hidden");
		    }
		});
	    });

	    // See if we have any ranges.
	    var ranges = 0;
	    _.each(groups, function(group) {
		console.info(group, group.ranges);
		if (_.size(group.ranges)) {
		    ranges++;
		}
	    });
	    if (ranges) {
		html = byrangeTemplate({
		    "groups"       : groups,
		    "showcontrols" : false,
		    "showproject"  : true,
		    "showactivity" : true,
		    "showuser"     : true,
		    "showusing"    : true,
		    "showstatus"   : true,
		    "isadmin"      : window.ISADMIN,
		});
		$("#groups-byrange").html(html);
		
		// Status column
		_.each(groups, function(group) {
		    _.each(group.ranges, function(reservation, uuid) {
			var resid = 'tr[data-uuid="' + uuid + '"] ';
			var rrow  = $('#groups-byrange ' + resid);

			if (reservation.canceled) {
			    rrow.find(".reservation-status-column " +
				      ".status-canceled")
				.removeClass("hidden");
			}
			else if (reservation.approved) {
			    rrow.find(".reservation-status-column " +
				      ".status-approved")
				.removeClass("hidden");
			}
			else {
			    rrow.find(".reservation-status-column " +
				      ".status-pending")
				.removeClass("hidden");
			}
		    });
		});
	    }

	    // Format dates with moment before display.
	    $('#groups-bytype .format-date, #groups-byrange .format-date')
		.each(function() {
		    var date = $.trim($(this).html());
		    if (date != "") {
			$(this).html(moment(date).format("lll"));
		    }
		});
	    $("#groups-bytype-div").removeClass("hidden");	    
	    if (ranges) {
		$("#groups-byrange-div").removeClass("hidden");
	    }
	    $('#groups-bytype .tablesorter, #groups-byrange .tablesorter')
		.tablesorter({
		    theme : 'green',
		    // initialize zebra
		    widgets: ["zebra"],
		});

	    // This activates the tooltip subsystem.
	    $('#groups-bytype  [data-toggle="tooltip"], ' +
	      '#groups-byrange [data-toggle="tooltip"]').tooltip({
		delay: {"hide" : 250, "show" : 250},
		placement: 'auto',
	    });
	    // This activates the popover subsystem.
	    $('#groups-bytype  [data-toggle="popover"], ' +
	      '#groups-byrange [data-toggle="popover"]').popover({
		placement: 'auto',
		container: 'body',
	    });
	}
    }

    // Helper.
    function decodejson(id) {
	return JSON.parse(_.unescape($(id)[0].textContent));
    }
    $(document).ready(initialize);
});


