$(function ()
{
    'use strict';

    var template_list   = ["resgroup-history", "resgroup-list",
			   "oops-modal", "waitwait-modal"];
    var templates       = APT_OPTIONS.fetchTemplateList(template_list);    
    var mainTemplate    = _.template(templates["resgroup-history"]);
    var listTemplate    = _.template(templates["resgroup-list"]);
    
    function initialize()
    {
	window.APT_OPTIONS.initialize(sup);
	var target = "";
	var args   = {"history" : true};

	if (window.PID) {
	    target = "for project " + window.PID;
	    args["project"] = window.PID;
	}
	else if (window.UID) {
	    target = "for user " + window.UID;
	    args["uid"] = window.UID;
	}
	$('#main-body').html(mainTemplate({"target" : target}));
	$('#oops_div').html(templates["oops-modal"]);	
	$('#waitwait_div').html(templates["waitwait-modal"]);

	sup.CallServerMethod(null, "resgroup", "ListReservationGroups", args,
			     function (json) {
				 if (json.code) {
				     sup.SpitOops("oops", json.value);
				     return;
				 }
				 DoReservations('#groups', json.value);
			     });
    }

    function DoReservations(selector, groups)
    {
	console.info("DoReservations", groups);

	$('#resgroups-loading').addClass("hidden");
	if (!_.size(groups)) {
	    $('#nogroups').removeClass("hidden");
	    return;
	}
	var showportal = (window.ISADMIN && window.MAINSITE ? true : false);

	// Generate the main template.
	var html = listTemplate({
	    "groups"       : groups,
	    "showcontrols" : false,
	    "showportal"   : showportal,
	    "showproject"  : true,
	    "showactivity" : false,
	    "showuser"     : true,
	    "showusing"    : false,
	    "showstatus"   : true,
	    "showselect"   : (window.EMBEDDED_RESGROUPS_SELECT ? true : false),
	    "isadmin"      : window.ISADMIN,
	});
	$(selector).html(html);

	if (window.ISADMIN && !window.EMBEDDED_RESGROUPS) {
	    $('#resgroups-count span').html(_.size(groups));
	    $('#resgroups-count').removeClass("hidden");
	}

	// Format dates with moment before display.
	$(selector + ' .format-date').each(function() {
	    var date = $.trim($(this).html());
	    if (date != "") {
		$(this).html(moment(date).format("lll"));
	    }
	});
	// Show the proper status, for the group and for each reservation
	// in the group.
	_.each(groups, function(group, uuid) {
	    var groupid = selector + ' tr[data-uuid="' + uuid + '"] ';
	    var grow    = $(groupid);
	    var crow    = grow.next();

	    // Disable sorting if only one row.
	    if (_.size(group.clusters) == 1) {
		crow.find(".tablesorter.clusters-table thead tr")
		    .addClass("tablesorter-ignoreRow");
	    }
	    if (_.size(group.ranges) == 1) {
		crow.find(".tablesorter.ranges-table thead tr")
		    .addClass("tablesorter-ignoreRow");
	    }
	    if (_.size(group.routes) == 1) {
		crow.find(".tablesorter.routes-table thead tr")
		    .addClass("tablesorter-ignoreRow");
	    }
	    if (1) {
		crow.find(".tablesorter")
		    .addClass("table table-condensed table-sm");
	    }
	    else {
	    crow.find(".tablesorter").tablesorter({
		theme : 'bootstrap',
		widgets : [ "uitheme", "zebra"],
		headerTemplate : '{content} {icon}',
	    });
	    }

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
	    _.each(group.routes, function(reservation, uuid) {
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
	$(selector + ' .tablesorter.resgroup-list')
	    .tablesorter({
		theme : 'bootstrap',
		widgets : [ "uitheme", "zebra"],
		headerTemplate : '{content} {icon}',

		textExtraction: {
		    '.status-extractor': function(node, table, cellIndex) {
			return $(node).find("> span:not(.hidden) .status-value").text();
		    },
		},
		sortAppend: [[4, 0]],
	    });
	$(selector + ' .tablesorter .tablesorter-childRow>td').hide();	
	$(selector + ' .tablesorter .show-childrow .expando')
	    .click(function (event) {
		event.preventDefault();
		// Determine current state for changing the chevron.
		var row = $(this).closest('tr')
		    .nextUntil('tr.tablesorter-hasChildRow').find('td')[0];
		var display = $(row).css("display");
		if (display == "none") {
		    $(this)
			.removeClass("glyphicon-chevron-right")
			.addClass("glyphicon-chevron-down");
		}
		else {
		    $(this)
			.removeClass("glyphicon-chevron-down")
			.addClass("glyphicon-chevron-right");
		}
		$(row).toggle();
	    });
	
	// This activates the tooltip subsystem.
	$(selector + ' [data-toggle="tooltip"]').tooltip({
	    delay: {"hide" : 250, "show" : 250},
	    placement: 'auto',
	});
	// This activates the popover subsystem.
	$(selector + ' [data-toggle="popover"]').popover({
	    placement: 'auto',
	    container: 'body',
	});

    }
    $(document).ready(initialize);
});


