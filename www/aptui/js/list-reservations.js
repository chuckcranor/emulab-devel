$(function ()
{
    'use strict';

    var template_list   = ["reservation-list", "oops-modal", "confirm-modal",
			   "waitwait-modal"];
    var templates       = APT_OPTIONS.fetchTemplateList(template_list);    
    var listTemplate    = _.template(templates["reservation-list"]);
    var confirmString   = templates["confirm-modal"];
    var oopsString      = templates["oops-modal"];
    var waitwaitString  = templates["waitwait-modal"];
    var amlist = null;
    
    function initialize()
    {
	window.APT_OPTIONS.initialize(sup);
	amlist  = decodejson('#amlist-json');

	$('#oops_div').html(oopsString);	
	$('#waitwait_div').html(waitwaitString);
	$('#confirm_div').html(confirmString);

	LoadData();
    }

    /*
     * Load reservations from each am in the list and generate a table.
     */
    function LoadData()
    {
	var amcount  = Object.keys(amlist).length;
	var rescount = 0;
	
	_.each(amlist, function(urn, name) {
	    var callback = function(json) {
		console.log(json);
		
		// Kill the spinner.
		amcount--;
		if (amcount <= 0) {
		    $('#spinner').addClass("hidden");
		}
		if (json.code) {
		    console.log("Could not get reservation data for " +
				name + ": " + json.value);
		    return;
		}
		var reservations = json.value;
		rescount += reservations.length;
		
		if (reservations.length == 0) {
		    if (amcount == 0 && rescount == 0) {
			// No reservations at all, show the message.
			$('#noreservations').removeClass("hidden");
		    }
		    return;
		}

		// Generate the main template.
		var html = listTemplate({
		    "reservations" : reservations,
		    "showidx"      : true,
		    "showproject"  : true,
		    "showuser"     : true,
		    "showusing"    : true,
		    "name"         : name,
		    "isadmin"      : window.ISADMIN,
		});
		html =
		    "<div class='row' id='" + name + "'>" +
		    " <div class='col-xs-12 col-xs-offset-0'>" + html +
		    " </div>" +
		    "</div>";

		$('#main-body').prepend(html);

		// Format dates with moment before display.
		$('#' + name + ' .format-date').each(function() {
		    var date = $.trim($(this).html());
		    if (date != "") {
			$(this).html(moment($(this).html()).format("lll"));
		    }
		});
		$('#' + name + ' .tablesorter')
		    .tablesorter({
			theme : 'green',
			// initialize zebra
			widgets: ["zebra"],
		    });
		// Bind a delete handler.
		$('#' + name + ' .delete-button').click(function() {
		    DeleteReservation($(this).closest('tr'));
		    return false;
		});
		if (window.ISADMIN) {
		    // Bind a deny handler.
		    $('#' + name + ' .deny-button').click(function() {
			DenyReservation($(this).closest('tr'));
			return false;
		    });
		}
		// This activates the tooltip subsystem.
		$('[data-toggle="tooltip"]').tooltip({
		    delay: {"hide" : 250, "show" : 250},
		    placement: 'auto',
		});
	    }
	    var xmlthing = sup.CallServerMethod(null, "reserve",
						"ListReservations",
						{"cluster" : name});
	    xmlthing.done(callback);
	});
    }

    /*
     * Delete a reservation. When complete, delete the table row.
     */
    function DeleteReservation(row) {
	// This is what we are deleting.
	var uuid = $(row).attr('data-uuid');
	var pid  = $(row).attr('data-pid');
	var cluster = $(row).attr('data-cluster');
	var table   = $(row).closest("table");
	
	// Callback for the delete request.
	var callback = function (json) {
	    sup.HideModal('#waitwait-modal');
	    console.log("delete", json);
	    if (json.code) {
		sup.SpitOops("oops", json.value);
		return;
	    }
	    $(row).remove();
	    table.trigger('update');
	};
	// Bind the confirm button in the modal. Do the deletion.
	$('#confirm_modal #confirm_delete').click(function () {
	    sup.HideModal('#confirm_modal');
	    sup.ShowModal('#waitwait-modal');
	    var xmlthing = sup.CallServerMethod(null, "reserve",
						"Delete",
						{"uuid"    : uuid,
						 "pid"     : pid,
						 "cluster" : cluster});
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
    function DenyReservation(row) {
	// This is what we are deleting.
	var uuid = $(row).attr('data-uuid');
	var pid  = $(row).attr('data-pid');
	var cluster = $(row).attr('data-cluster');
	var table   = $(row).closest("table");
	
	// Callback for the delete request.
	var callback = function (json) {
	    sup.HideModal('#waitwait-modal');
	    console.log("deny", json);
	    if (json.code) {
		sup.SpitOops("oops", json.value);
		return;
	    }
	    $(row).remove();
	    table.trigger('update');
	};
	// Bind the confirm button in the modal. Do the deletion.
	$('#deny-modal #confirm-deny').click(function () {
	    sup.HideModal('#deny-modal', function () {
		var reason  = $('#deny-reason').val();
		sup.ShowModal('#waitwait-modal');
		var xmlthing = sup.CallServerMethod(null, "reserve",
						    "Delete",
						    {"uuid"    : uuid,
						     "pid"     : pid,
						     "cluster" : cluster,
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
    
    // Helper.
    function decodejson(id) {
	return JSON.parse(_.unescape($(id)[0].textContent));
    }
    $(document).ready(initialize);
});


