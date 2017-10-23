$(function ()
{
    'use strict';

    var template_list   = ["reserve-request", "reserve-faq",
			   "reservation-graph", "oops-modal", "waitwait-modal"];
    var templates       = APT_OPTIONS.fetchTemplateList(template_list);    
    var oopsString      = templates["oops-modal"];
    var waitwaitString  = templates["waitwait-modal"];
    var mainTemplate    = _.template(templates["reserve-request"]);
    var graphTemplate   = _.template(templates["reservation-graph"]);
    var fields       = null;
    var projlist     = null;
    var amlist       = null;
    var amorder      = [];
    var isadmin      = false;
    var editing      = false;
    var buttonstate  = "check";
    
    function initialize()
    {
	window.APT_OPTIONS.initialize(sup);

	isadmin  = window.ISADMIN;
	editing  = window.EDITING; 
	fields   = JSON.parse(_.unescape($('#form-json')[0].textContent));
	projlist = JSON.parse(_.unescape($('#projects-json')[0].textContent));
	amlist   = JSON.parse(_.unescape($('#amlist-json')[0].textContent));

	GeneratePageBody(fields);

	// Now we can do this. 
	$('#oops_div').html(oopsString);	
	$('#waitwait_div').html(waitwaitString);

	/*
	 * In edit mode, we ask for the reservation details from the
	 * backend cluster and then update the form.
	 */
	if (editing) {
	    PopulateReservation();
	    $('#reserve-delete-button').click(function (e) {
		e.preventDefault();
		Delete();
	    });
	}
	LoadReservations();
    }

    //
    // Moved into a separate function since we want to regen the form
    // after each submit, which happens via ajax on this page. 
    //
    function GeneratePageBody(formfields)
    {
	// Generate the template.
	var html = mainTemplate({
	    formfields:		formfields,
	    projects:           projlist,
	    amlist:		amlist,
	    isadmin:		isadmin,
	    editing:		editing,
	});
	html = aptforms.FormatFormFieldsHorizontal(html);
	$('#main-body').html(html);
	$('.faq-contents').html(templates["reserve-faq"]);
	// Graph list.
	$('#reservation-lists .reservation-div')
	    .html(graphTemplate({"amlist": amlist, "showcontrols" : true}));

	// Handler for the Help button
	$('#reservation-help-button').click(function (event) {
	    event.preventDefault();
	    sup.ShowModal('#reservation-help-modal');
	});
	
	// Handler for the FAQ link.
	$('#reservation-faq-button').click(function (event) {
	    event.preventDefault();
	    sup.HideModal('#reservation-help-modal',
			  function () {
			      sup.ShowModal('#reservation-faq-modal');
			  });
	});
	// Set the manual link since the FAQ is not a template.
	$('#reservation-manual').attr("href", window.MANUAL);

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
	
	// Handler for cluster change to show the type list.
	$('#reserve-request-form #cluster').change(function (event) {
	    $("#reserve-request-form #cluster option:selected").
		each(function() {
		    HandleClusterChange($(this).val());
		    return;
		});
	});
	// Handle submit button.
	$('#reserve-submit-button').click(function (event) {
	    event.preventDefault();
	    if (buttonstate == "check") {
		CheckForm();
	    }
	    else {
		Reserve();
	    }
	});
	// Handle modal submit button.
	$('#confirm-reservation #commit-reservation').click(function (event) {
	    if (buttonstate == "submit") {
		Reserve();
	    }
	});

	// Insert datepickers after html inserted.
	$("#reserve-request-form #start_day").datepicker({
	    minDate: 0,		/* earliest date is today */
	    showButtonPanel: true,
	    onSelect: function (dateString, dateobject) {
		DateChange("#start_day");
		modified_callback();
	    }
	});
	$("#reserve-request-form #end_day").datepicker({
	    minDate: 0,		/* earliest date is today */
	    showButtonPanel: true,
	    onSelect: function (dateString, dateobject) {
		DateChange("#end_day");
		modified_callback();
	    }
	});
	/*
	 * Callback when something changes so that we can toggle the
	 * button from Submit to Check.
	 */
	var modified_callback = function () {
	    ToggleSubmit(true, "check");
	};
	aptforms.EnableUnsavedWarning('#reserve-request-form',
				      modified_callback);

    }
    
    /*
     * When the date selected is today, need to disable the hours
     * before the current hour.
     */
    function DateChange(which)
    {
	var date = $("#reserve-request-form " + which).datepicker("getDate");
	var now = new Date();
	var selecter;

	if (which == "#start_day") {
	    selecter = "#reserve-request-form #start_hour";
	}
	else {
	    selecter = "#reserve-request-form #end_hour";
	}
	if (moment(date).isSame(Date.now(), "day")) {
	    for (var i = 0; i <= now.getHours(); i++) {

		/*
		 * Before we disable the option, see if it is selected.
		 * If so, we want make the user re-select the hour.
		 */
		if ($(selecter + " option:selected").val() == i) {
		    $(selecter).val("");
		}
		$(selecter + " option[value='" + i + "']")
		    .attr("disabled", "disabled");
	    }
	}
	else {
	    for (var i = 0; i <= now.getHours(); i++) {
		$(selecter + " option[value='" + i + "']")
		    .removeAttr("disabled");
	    }
	}
    }

    //
    // Check form validity. This does not check whether the reservation
    // is valid.
    //
    function CheckForm()
    {
	var checkonly_callback = function(json) {
	    if (json.code) {
		if (json.code != 2) {
		    sup.SpitOops("oops", json.value);		    
		}
		return;
	    }
	    // Now check the actual reservation validity.
	    ValidateReservation();
	}
	/*
	 * Before we submit, set the start/end fields to UTC time.
	 */
	var start_day  = $('#reserve-request-form [name=start_day]').val();
	var start_hour = $('#reserve-request-form [name=start_hour]').val();
	if (start_day && !start_hour) {
	    aptforms.GenerateFormErrors('#reserve-request-form',
					{"start" : "Missing hour"});
	    return;
	}
	else if (!start_day && start_hour) {
	    aptforms.GenerateFormErrors('#reserve-request-form',
					{"start" : "Missing day"});
	    return;
	}
	else if (start_day && start_hour) {
	    var start = moment(start_day, "MM/DD/YYYY");
	    start.hour(start_hour);
	    $('#reserve-request-form [name=start]').val(start.format());
	}
	var end_day  = $('#reserve-request-form [name=end_day]').val();
	var end_hour = $('#reserve-request-form [name=end_hour]').val();
	if (end_day && !end_hour) {
	    aptforms.GenerateFormErrors('#reserve-request-form',
					{"end" : "Missing hour"});
	    return;
	}
	else if (!end_day && end_hour) {
	    aptforms.GenerateFormErrors('#reserve-request-form',
					{"end" : "Missing day"});
	    return;
	}
	else if (end_day && end_hour) {
	    var end = moment(end_day, "MM/DD/YYYY");
	    end.hour(end_hour);
	    $('#reserve-request-form [name=end]').val(end.format());
	}
	aptforms.CheckForm('#reserve-request-form', "reserve",
			   "Validate", checkonly_callback);
    }

    // Call back from the graphs to change the dates on a blank form
    function SetDates(when)
    {
	//console.info("dates", when);
	// Bump to next hour. Will be confusing at midnight.
	when.setHours(when.getHours() + 1);

	if (! editing) {
	    $("#reserve-request-form #start_day").datepicker("setDate", when);
	    //$("#reserve-request-form #end_day").datepicker("setDate", when);
	    $("#reserve-request-form [name=start_hour]").val(when.getHours());
	    //$("#reserve-request-form [name=end_hour]").val(when.getHours());
	    aptforms.MarkFormUnsaved();
	}
    }
    // Set the cluster after clicking on a graph.
    function SetCluster(nickname, urn)
    {
	$('#reserve-request-form [name=cluster] option[value="' + urn + '"]')
	    .prop("selected", "selected");

	if ($('#reservation-lists :first-child').attr("id") != nickname) {
	    $('#' + nickname).fadeOut("fast", function () {
		if ($(window).scrollTop()) {
		    $('html, body').animate({scrollTop: '0px'},
					    500, "swing",
					    function () {
						$('#reservation-lists')
						    .prepend($('#' + nickname));
						$('#' + nickname)
						    .fadeIn("fast");
					    });
		}
		else {
		    $('#reservation-lists').prepend($('#' + nickname));
		    $('#' + nickname).fadeIn("fast");
		}
	    });
	}
	aptforms.MarkFormUnsaved();
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

		// When clicking on a graph, make it the current cluster.
		if (!editing) {
		    $('#' + details.nickname + ' .panel-body')
			.click(function (event) {
			    SetCluster(details.nickname, urn);
			});
		}

		ShowResGraph({"forecast"  : json.value.forecast,
			      "selector"  : details.nickname +
			                    " .timeseries-graph-panel",
			      "click_callback" : SetDates});

		$('#' + details.nickname + ' .resgraph-fullscreen')
		    .click(function (event) {
			event.preventDefault();
			// Panel title in the modal.
			$('#resgraph-modal .cluster-name')
			    .html(details.nickname);
			$('#resgraph-modal').on('shown.bs.modal', function() {
			    ShowResGraph({"forecast"  : json.value.forecast,
					  "selector"  : "resgraph-modal",
					  "click_callback" : SetDates});
			});
			sup.ShowModal('#resgraph-modal', function () {
			    $('#resgraph-modal').off('shown.bs.modal');
			});
		    });
 	    }
	    var xmlthing = sup.CallServerMethod(null, "reserve",
						"ReservationInfo",
						{"cluster" : details.nickname,
						 "anonymous" : 1});
	    xmlthing.done(callback);
	});
    }

    //
    // Validate the reservation. 
    //
    function ValidateReservation()
    {
	var callback = function(json) {
	    console.info(json);
	    // Three indicates success but needs admin approval.
	    if (json.code) {
		if (json.code != 2) {
		    sup.SpitOops("oops", json.value);		    
		}
		aptforms.GenerateFormErrors('#reserve-request-form',
					    json.value);		
		// Make sure we still warn about an unsaved form.
		aptforms.MarkFormUnsaved();
		return;
	    }
	    // User can submit.
	    ToggleSubmit(true, "submit");
	    // Make sure we still warn about an unsaved form.
	    aptforms.MarkFormUnsaved();
	    if (json.value.approved == 0) {
		$('#confirm-reservation .needs-approval')
		    .removeClass("hidden");
	    }
	    else {
		$('#confirm-reservation .needs-approval')
		    .addClass("hidden");
	    }
	    sup.ShowModal('#confirm-reservation');
	};
	aptforms.SubmitForm('#reserve-request-form', "reserve",
			    "Validate", callback,
			    "Checking to see if your request can be "+
			    "accommodated");
    }

    /*
     * And do it.
     */
    function Reserve()
    {
	var reserve_callback = function(json) {
	    console.info(json);
	    if (json.code) {
		sup.SpitOops("oops", json.value);
		return;
	    }
	    if (!json.value.approved && _.has(json.value, "url")) {
		window.location.replace(json.value.url);
	    }
	    else {
		window.location.replace("list-reservations.php");
	    }
	};
	aptforms.SubmitForm('#reserve-request-form', "reserve",
			    "Reserve", reserve_callback,
			    "Submitting your reservation request; "+
			    "patience please");
    }

    /*
     * Approve a reservation
     */
    function Approve()
    {
	var callback = function(json) {
	    sup.HideWaitWait();
	    if (json.code) {
		sup.SpitOops("oops", json.value);
		return;
	    }
	    window.location.reload(true);
	};
	sup.ShowWaitWait();
	var xmlthing = sup.CallServerMethod(null, "reserve",
					    "Approve",
					    {"cluster" : window.CLUSTER,
					     "uuid"    : window.UUID});
	xmlthing.done(callback);
    }

    function PopulateReservation()
    {
	var callback = function(json) {
	    console.log("PopulateReservation", json);
	    sup.HideWaitWait();
	    if (json.code) {
		sup.SpitOops("oops", json.value);
		return;
	    }
	    // Messy.
	    var details = json.value;
	    $('#reserve-request-form [name=uuid]').val(details.uuid);
	    $('#reserve-request-form [name=pid]').val(details.pid);
	    $('#reserve-request-form [name=count]').val(details.count);
	    $('#reserve-request-form [name=cluster]').val(details.cluster);
	    $('#reserve-request-form [name=cluster_id]').val(details.cluster_id);
	    $('#reserve-request-form [name=type]').val(details.type);
	    $('#reserve-request-form [name=reason]').val(details.notes);
	    var start = moment(details.start);
	    var end = moment(details.end);	
	    $('#reserve-request-form [name=start_day]')
		.val(start.format("MM/DD/YYYY"));
	    $('#reserve-request-form [name=start_hour]')
		.val(start.format("H"));
	    $('#reserve-request-form [name=end_day]')
		.val(end.format("MM/DD/YYYY"));
	    $('#reserve-request-form [name=end_hour]')
		.val(end.format("H"));
	    //console.log(start, end);

	    // Set the hour selectors properly in the datepicker object.
	    $("#reserve-request-form #start_day")
		.datepicker("setDate", start.format("MM/DD/YYYY"));
	    $("#reserve-request-form #end_day")
		.datepicker("setDate", end.format("MM/DD/YYYY"));

	    if (details.approved) {
		$('#unapproved-warning').addClass("hidden");
	    }
	    else {
		$('#unapproved-warning').removeClass("hidden");
	    }
	    // Local user gets a link.
	    if (_.has(details, 'creator_idx')) {
		$('#reserve-requestor').html(
		    "<a target=_blank href='user-dashboard.php?user=" +
			details.creator_idx + "'>" +
			details.creator_uid + "</a>");
	    }
	    else {
		$('#reserve-requestor').html(details.creator_uid);
	    }
	    
	    /*
	     * If this is an admin looking at an unapproved reservation,
	     * show the approve button
	     */
	    if (isadmin && !details.approved) {
		$('#reserve-approve-button').removeClass("hidden");
		$('#reserve-approve-button').click(function(event) {
		    event.preventDefault();
		    Approve();
		});
	    }
	    // Need this in Delete().
	    window.PID = details.pid;
	};
	sup.ShowWaitWait();
	var xmlthing = sup.CallServerMethod(null, "reserve",
					    "GetReservation",
					    {"cluster" : window.CLUSTER,
					     "uuid"    : window.UUID});
	xmlthing.done(callback);
    }

    /*
     * Delete a reservation
     */
    function Delete()
    {
	var callback = function(json) {
	    sup.HideWaitWait();
	    if (json.code) {
		sup.SpitOops("oops", json.value);
		return;
	    }
	    window.location.replace("list-reservations.php");
	};

	// Bind the confirm button in the modal. Do the deletion.
	$('#delete-reservation-modal #confirm-delete').click(function () {
	    sup.HideModal('#delete-reservation-modal', function () {
		var reason  = $('#delete-reason').val();
		sup.ShowModal('#waitwait-modal');
		var xmlthing = sup.CallServerMethod(null, "reserve",
						    "Delete",
						    {"cluster" : window.CLUSTER,
						     "uuid"    : window.UUID,
						     "pid"     : window.PID,
						     "reason"  : reason});
		xmlthing.done(callback);
	    });
	});
	
	// Handler so we know the user closed the modal. We need to
	// clear the confirm button handler.
	$('#delete-reservation-modal').on('hidden.bs.modal', function (e) {
	    $('#delete-reservation-modal #confirm-delete').unbind("click");
	    $('#delete-reservation-modal').off('hidden.bs.modal');
	})
	sup.ShowModal("#delete-reservation-modal");
    }

    function HandleClusterChange(selected_cluster)
    {
	/*
	 * Build up selection list of types on the selected cluster
	 */
	var options  = "";
	var typelist = amlist[selected_cluster].typeinfo;
	var nickname = amlist[selected_cluster].nickname;

	_.each(typelist, function(details, type) {
	    var count = details.count;
	    
	    options = options +
		"<option value='" + type + "' >" +
		type + " (" + count + " nodes)</option>";
	});
	$("#reserve-request-form #type")	
	    .html("<option value=''>Please Select</option>" + options);

	if ($('#reservation-lists :first-child').attr("id") != nickname) {
	    $('#' + nickname).fadeOut("fast", function () {
		$('#reservation-lists').prepend($('#' + nickname));
		$('#' + nickname).fadeIn("fast");
	    });
	}
    }

    // Toggle the button between check and submit.
    function ToggleSubmit(enable, which) {
	if (which == "submit") {
	    $('#reserve-submit-button').text("Submit");
	    $('#reserve-submit-button').addClass("btn-success");
	    $('#reserve-submit-button').removeClass("btn-primary");
	}
	else if (which == "check") {
	    $('#reserve-submit-button').text("Check");
	    $('#reserve-submit-button').removeClass("btn-success");
	    $('#reserve-submit-button').addClass("btn-primary");
	    if (editing) {
		$('#reserve-approve-button').attr("disabled", "disabled");
	    }
	}
	if (enable) {
	    $('#reserve-submit-button').removeAttr("disabled");
	}
	else {
	    $('#reserve-submit-button').attr("disabled", "disabled");
	}
	buttonstate = which;
    }
    $(document).ready(initialize);
});
