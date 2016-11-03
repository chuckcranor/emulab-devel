$(function ()
{
    'use strict';

    var template_list   = ["reserve-request", "reservation-list",
			   "oops-modal", "waitwait-modal"];
    var templates       = APT_OPTIONS.fetchTemplateList(template_list);    
    var mainString      = templates["reserve-request"];
    var oopsString      = templates["oops-modal"];
    var waitwaitString  = templates["waitwait-modal"];
    var mainTemplate    = _.template(mainString);
    var listTemplate    = _.template(templates["reservation-list"]);
    var fields       = null;
    var projlist     = null;
    var amlist       = null;
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
	}
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
	    editing:		false,
	});
	html = aptforms.FormatFormFieldsHorizontal(html);
	$('#main-body').html(html);

	// This activates the popover subsystem.
	$('[data-toggle="popover"]').popover({
	    trigger: 'hover',
	    container: 'body'
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
	    showButtonPanel: true,
	});
	$("#reserve-request-form #end_day").datepicker({
	    showButtonPanel: true,
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

	LoadReservations();
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
	if (start_day && start_hour) {
	    var start = moment(start_day, "MM/DD/YYYY");
	    start.hour(start_hour);
	    console.log("start", start);
	    $('#reserve-request-form [name=start]').val(start.format());
	}
	var end_day  = $('#reserve-request-form [name=end_day]').val();
	var end_hour = $('#reserve-request-form [name=end_hour]').val();
	if (end_day && end_hour) {
	    var end = moment(end_day, "MM/DD/YYYY");
	    end.hour(end_hour);
	    console.log("end", end);
	    $('#reserve-request-form [name=end]').val(end.format());
	}
	aptforms.CheckForm('#reserve-request-form', "reserve",
			   "Validate", checkonly_callback);
    }

   /*
    * Load anonymized reservations from each am in the list and generate tables.
    */
    function LoadReservations()
    {
	var count = Object.keys(amlist).length;
	
	_.each(amlist, function(details, urn) {
 	    var callback = function(json) {
		//console.log(json);
		
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
		var reservations = json.value;
		if (reservations.length == 0) 
		    return;

		// Generate the main template.
		var html = listTemplate({
		    "reservations" : reservations,
		    "showidx"      : false,
		    "showproject"  : false,
		    "showuser"     : false,
		    "name"         : details.name,
		});
		html =
		    "<div class='row' id='" + details.nickname + "'>" +
		    " <div class='col-xs-12 col-xs-offset-0'>" + html +
		    " </div>" +
		    "</div>";

		$('#reservation-lists').prepend(html);

		// Format dates with moment before display.
		$('#' + details.nickname + ' .format-date').each(function() {
		    var date = $.trim($(this).html());
		    if (date != "") {
			$(this).html(moment($(this).html()).format("lll"));
		    }
		});
		$('#' + details.nickname + ' .tablesorter')
		    .tablesorter({
			theme : 'green',
			// initialize zebra
			widgets: ["zebra"],
		    });
 	    }
	    var xmlthing = sup.CallServerMethod(null, "reserve",
						"ListReservations",
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
	    if (json.code) {
		if (json.code != 2) {
		    sup.SpitOops("oops", json.value);		    
		}
		return;
	    }
	    // User can submit.
	    ToggleSubmit(true, "submit");
	    // Make sure we still warn about an unsaved form.
	    aptforms.MarkFormUnsaved();
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
	    if (json.code) {
		sup.SpitOops("oops", json.value);
		return;
	    }
	    window.location.replace(json.value);
	};
	aptforms.SubmitForm('#reserve-request-form', "reserve",
			    "Reserve", reserve_callback,
			    "Submitting your reservation request; "+
			    "patience please");
			    
    }

    function PopulateReservation()
    {
	var callback = function(json) {
	    console.log(json);
	    sup.HideWaitWait();
	    if (json.code) {
		sup.SpitOops("oops", json.value);
		return;
	    }
	    // Messy.
	    var details = json.value;
	    $('#reserve-request-form [name=pid]').val(details.pid);
	    $('#reserve-request-form [name=count]').val(details.count);
	    $('#reserve-request-form [name=cluster]').val(details.cluster);
	    HandleClusterChange(details.cluster);
	    $('#reserve-request-form [name=type]').val(details.type);
	    $('#reserve-request-form [name=reason]')
		.val(_.escape(details.notes));
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
	    console.log(start, end);
	};
	sup.ShowWaitWait();
	var xmlthing = sup.CallServerMethod(null, "reserve",
					    "GetReservation",
					    {"cluster" : window.CLUSTER,
					     "idx"     : window.IDX});
	xmlthing.done(callback);
    }

    function HandleClusterChange(selected_cluster)
    {
	/*
	 * Build up selection list of types on the selected cluster
	 */
	var options  = "";
	var typelist = amlist[selected_cluster].typeinfo;

	_.each(typelist, function(details, type) {
	    var count = details.count;
	    
	    options = options +
		"<option value='" + type + "' >" +
		type + " (" + count + " nodes)</option>";
	});
	$("#reserve-request-form #type")	
	    .html("<option value=''>Please Select</option>" + options);
    }

    // Toggle the button between check and submit.
    function ToggleSubmit(enable, which) {
	if (which == "submit") {
	    $('#reserve-submit-button').text("Reserve");
	    $('#reserve-submit-button').addClass("btn-success");
	    $('#reserve-submit-button').removeClass("btn-primary");
	}
	else if (which == "check") {
	    $('#reserve-submit-button').text("Check");
	    $('#reserve-submit-button').removeClass("btn-success");
	    $('#reserve-submit-button').addClass("btn-primary");
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
