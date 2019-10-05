$(function ()
{
    'use strict';

    var template_list   = ["list-resgroups", "resgroup-list",
			   "confirm-modal", "resusage-list", "resusage-graph",
			   "oops-modal", "waitwait-modal"];
    var templates       = APT_OPTIONS.fetchTemplateList(template_list);    
    var mainTemplate    = _.template(templates["list-resgroups"]);
    var listTemplate    = _.template(templates["resgroup-list"]);
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

	// Generate the main template.
	var html = listTemplate({
	    "groups"       : groups,
	    "showcontrols" : true,
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
	$('#groups .tablesorter')
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

		if (window.ISADMIN) {
		    // Bind a deny handler,
		    $(id + ' .deny-button').click(function() {
			Deny($(this).closest('tr'));
			return false;
		    });
		    $(id + ' .deny-button').removeClass("invisible");
		    // Bind an approve handler
		    $(id + ' .approve-button').click(function() {
			Approve($(this).closest('tr'));
			return false;
		    });
		    $(id + ' .approve-button').removeClass("invisible");
		}
	    }
	    _.each(group.reservations, function(reservation, uuid) {
		var resid = 'tr[data-uuid="' + uuid + '"] ';
		var rrow  = crow.find(resid);

		if (reservation.approved) {
		    rrow.find(".reservation-status-column .status-approved")
			.removeClass("hidden");
		}
		else if (reservation.canceled == "canceled") {
		    rrow.find(".reservation-status-column .status-canceled")
			.removeClass("hidden");
		}
		else {
		    rrow.find(".reservation-status-column .status-pending")
			.removeClass("hidden");
		}
	    });
	});
	if (window.ISADMIN) {
	    // Bind info and warning handler.
	    $('#groups .info-button').click(function() {
		ReservationInfoOrWarning("info", $(this).closest('tr'));
		return false;
	    });
	    $('#groups .warn-button').click(function() {
		ReservationInfoOrWarning("warn", $(this).closest('tr'));
		return false;
	    });
	    // Bind a cancel cancellation handler.
	    $('#groups .cancel-cancel-button').click(function() {
		CancelCancellation($(this).closest('tr'));
		return false;
	    });
	}
	// Bind a delete handler.
	$('#groups .delete-button').click(function() {
	    Delete($(this).closest('tr'));
	    return false;
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
    }

    /*
     * Delete a group. When complete, delete the table rows.
     */
    function Delete(row) {
	// This is what we are deleting.
	var uuid   = $(row).attr('data-uuid');
	var table  = $(row).closest("table");

	// Callback for the delete request.
	var callback = function (json) {
	    sup.HideModal('#waitwait-modal');
	    console.log("delete", json);
	    if (json.code) {
		sup.SpitOops("oops", json.value);
		return;
	    }
	    $(row).next().remove();
	    $(row).remove();
	    table.trigger('update');
	};
	// Bind the confirm button in the modal. Do the deletion.
	$('#confirm_modal #confirm_delete').click(function () {
	    sup.HideModal('#confirm_modal');
	    sup.ShowModal('#waitwait-modal');
	    var xmlthing = sup.CallServerMethod(null, "resgroup",
						"Delete",
						{"uuid"    : uuid});
	    xmlthing.done(callback);
	});
	// Handler so we know the user closed the modal. We need to
	// clear the confirm button handler.
	$('#confirm_modal').on('hidden.bs.modal', function (e) {
	    $('#confirm_modal #confirm_delete').unbind("click");
	    $('#confirm_modal').off('hidden.bs.modal');
	})
	sup.ShowModal("#confirm_modal");
    }
    
    /*
     * Deny a reservation with cause. When complete, delete the table row.
     */
    function Deny(row) {
	// This is what we are deleting.
	var uuid    = $(row).attr('data-uuid');
	var table   = $(row).closest("table");
	
	// Callback for the delete request.
	var callback = function (json) {
	    sup.HideModal('#waitwait-modal');
	    console.log("deny", json);
	    if (json.code) {
		sup.SpitOops("oops", json.value);
		return;
	    }
	    $(row).next().remove();
	    $(row).remove();
	    table.trigger('update');
	};
	// Bind the confirm button in the modal. Do the deletion.
	$('#deny-modal #confirm-deny').click(function () {
	    sup.HideModal('#deny-modal', function () {
		var reason  = $('#deny-reason').val();
		sup.ShowModal('#waitwait-modal');
		var xmlthing = sup.CallServerMethod(null, "resgroup",
						    "Delete",
						    {"uuid"    : uuid,
						     "reason"  : reason});
		xmlthing.done(callback);
	    });
	});
	// Handler so we know the user closed the modal. We need to
	// clear the confirm button handler.
	$('#deny-modal').on('hidden.bs.modal', function (e) {
	    $('#deny-modal #confirm-deny').unbind("click");
	    $('#deny-modal').off('hidden.bs.modal');
	})
	sup.ShowModal("#deny-modal");
    }
    
    /*
     * Approve a reservation.
     */
    function Approve(row) {
	// This is what we are deleting.
	var uuid  = $(row).attr('data-uuid');
	
	var callback = function (json) {
	    sup.HideModal('#waitwait-modal');
	    console.log("approve", json);
	    if (json.code) {
		sup.SpitOops("oops", json.value);
		return;
	    }
	    
	    $(row).find(".group-status-column .status-pending")
		.addClass("hidden");
	    $(row).find(".group-status-column .status-approved")
		.removeClass("hidden");
	    $(row).find('.approve-button').addClass("invisible");
	    $(row).find('.deny-button').addClass("invisible");

	    
	};
	// Bind the confirm button in the modal. Do the approval.
	$('#approve-modal #confirm-approve').click(function () {
	    sup.HideModal('#approve-modal', function () {
		var message = $('#approve-modal .user-message').val().trim();
		sup.ShowModal('#waitwait-modal');
		var xmlthing = sup.CallServerMethod(null, "resgroup",
						    "Approve",
						    {"uuid"    : uuid,
						     "message" : message});
		xmlthing.done(callback);
	    });
	});
	// Handler so we know the user closed the modal. We need to
	// clear the confirm button handler.
	$('#approve-modal').on('hidden.bs.modal', function (e) {
	    $('#approve-modal #confirm-approve').unbind("click");
	    $('#approve-modal').off('hidden.bs.modal');
	})
	sup.ShowModal("#approve-modal");
    }
    
    /*
     * Ask for info about reservation (usage, lack of usage, etc).
     */
    function ReservationInfoOrWarning(which, row) {
	// This is what we are deleting.
	var uuid    = $(row).attr('data-uuid');
	var pid     = $(row).attr('data-pid');
	var uid_idx = $(row).attr('data-uid_idx');
	var cluster = $(row).attr('data-cluster');
	var type    = $(row).attr('data-type');
	var table   = $(row).closest("table");
	var warning = (which == "warn" ? 1 : 0);
	var modal   = (warning ? "#warn-modal" : "#info-modal");
	var method  = (warning ? "WarnUser" : "RequestInfo");
	var cancel  = 0;

	var callback = function (json) {
	    sup.HideModal('#waitwait-modal');
	    console.log(method, json);
	    if (json.code) {
		sup.SpitOops("oops", json.value);
		return;
	    }
	    // Reset the status column.
	    if (cancel) {
		$(row).find(".status-column .status-approved")
		    .addClass("hidden");
		$(row).find(".status-column .status-canceled")
		    .removeClass("hidden");
	    }
	};
	// Bind the confirm button in the modal. 
	$(modal + ' .confirm-button').click(function () {
	    var message = $(modal + ' .user-message').val();
	    if (!warning && message.trim().length == 0) {
		$(modal + ' .nomessage-error').removeClass("hidden");
		return;
	    }
	    if (warning && $('#schedule-cancellation').is(":checked")) {
		cancel = 1;
	    }
	    var args = {"uuid"    : uuid,
			"pid"     : pid,
			"uid_idx" : uid_idx,
			"cluster" : cluster,
			"type"    : type,
			"cancel"  : cancel,
			"message" : message};
	    console.info("warninfo", args);
	    
	    sup.HideModal(modal, function () {
		sup.ShowModal('#waitwait-modal');
		var xmlthing = sup.CallServerMethod(null, "reserve",
						    method, args);
		xmlthing.done(callback);
	    });
	});
	// Handler so we know the user closed the modal. We need to
	// clear the confirm button handler.
	$(modal).on('hidden.bs.modal', function (e) {
	    $(modal + ' .confirm-button').unbind("click");
	    $(modal).off('hidden.bs.modal');
	})
	// Hide error
	if (!warning) {
	    $(modal + ' .nomessage-error').addClass("hidden");
	}
	sup.ShowModal(modal);
    }

    function CancelCancellation(row) {
	// This is what we are working on.
	var uuid    = $(row).attr('data-uuid');
	var pid     = $(row).attr('data-pid');
	var cluster = $(row).attr('data-cluster');
	var type    = $(row).attr('data-type');
	var table   = $(row).closest("table");
	
	// Callback for the request.
	var callback = function (json) {
	    sup.HideModal('#waitwait-modal');
	    if (json.code) {
		console.log("cancel cancel", json);
		sup.SpitOops("oops", json.value);
		return;
	    }
	    // Reset the status column.
	    $(row).find(".status-column .status-canceled")
		.addClass("hidden");
	    $(row).find(".status-column .status-approved")
		.removeClass("hidden");
	};
	// Bind the confirm button in the modal. 
	$('#confirm-cancel-cancel-button').click(function () {
	    sup.HideModal('#cancel-cancel-modal', function () {
		sup.ShowModal('#waitwait-modal');
		var xmlthing = sup.CallServerMethod(null, "reserve",
						    "Cancel",
						    {"uuid"    : uuid,
						     "clear"   : 1,
						     "pid"     : pid,
						     "type"    : type,
						     "cluster" : cluster});
		xmlthing.done(callback);
	    });
	});
	// Handler so we know the user closed the modal. We need to
	// clear the confirm button handler.
	$('#cancel-cancel-modal').on('hidden.bs.modal', function (e) {
	    $('#confirm-cancel-cancel-button').unbind("click");
	    $('#cancel-cancel-modal').off('hidden.bs.modal');
	})
	sup.ShowModal("#cancel-cancel-modal");
    }

    // Draw the history bar graph.
    function DrawHistoryGraph(details)
    {
	// Setup a handler to draw the large version graph in the modal.
	$('#resusage-graph-modal').on('shown.bs.modal', function() {
	    window.DrawResHistoryGraph({"details"    : details,
					"graphid"    : '#resusage-graph-modal',
					"xaxislabel" : true});
	});
	
	// Make sure nothing left behind before we show it.
	$('#resusage-graph-modal svg').html("");
	// Gack, this stuff gets left behind.
	d3.selectAll('.nvtooltip').remove();

	$('#resusage-graph-modal .resusage-graph-details')
	    .html("(" + details.nodes + " " + details.type + " nodes)");
	
	sup.ShowModal('#resusage-graph-modal', function () {
	    // Need to unbind the hook above.
	    $('#resusage-graph-modal').off('shown.bs.modal');
	});

    }
    // Helper.
    function decodejson(id) {
	return JSON.parse(_.unescape($(id)[0].textContent));
    }
    $(document).ready(initialize);
});


