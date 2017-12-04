$(function ()
{
    'use strict';

  var templates = APT_OPTIONS.fetchTemplateList(['adminextend', 'waitwait-modal', 'oops-modal', 'admin-history', 'admin-firstrow', 'admin-secondrow', 'admin-utilization', 'admin-summary']);
    var mainString = templates['adminextend'];
    var waitwaitString = templates['waitwait-modal'];
    var oopsString = templates['oops-modal'];
    var historyString = templates['admin-history'];
    var firstrowString = templates['admin-firstrow'];
    var secondrowString = templates['admin-secondrow'];
    var utilizationString = templates['admin-utilization'];
    var summaryString = templates['admin-summary'];

    var extensions         = null;
    var firstrowTemplate   = null;
    var secondrowTemplate  = null;
    var extensionsTemplate = null;
    var maxextension       = null;
    var GENIRESPONSE_REFUSED = 7;

    function initialize()
    {
	window.APT_OPTIONS.initialize(sup);

	$('#main-body').html(mainString);
	$('#waitwait_div').html(waitwaitString);
	$('#oops_div').html(oopsString);

	firstrowTemplate = _.template(firstrowString);
	secondrowTemplate = _.template(secondrowString);
	extensionsTemplate = _.template(historyString);

	// Need to serialize this stuff cause of locking in the backend.
	LoadFirstRow(function () {
	    LoadUtilization(function () {
		LoadIdleData(function () {
		    LoadOpenStack();
		});
	    });
	});

	// Second row is the user/project usage summarys. We make two calls
	// and use jquery "when" to wait for both to finish before running
	// the template.
	var xmlthing1 = sup.CallServerMethod(null, "user-dashboard", "UsageSummary",
					     {"uid"    : window.CREATOR});
	var xmlthing2 = sup.CallServerMethod(null, "show-project", "UsageSummary",
					     {"pid"    : window.PID});
	$.when(xmlthing1, xmlthing2).done(function(result1, result2) {
	    var html = secondrowTemplate({"uid"     : window.CREATOR,
					  "pid"     : window.PID,
					  "uuid"    : window.UUID,
					  "user"    : result1[0].value,
					  "project" : result2[0].value});
	    $("#secondrow").html(html);
	});

	// The extension details in a collapse panel.
	if ($('#extensions-json').length) {
	    extensions = decodejson('#extensions-json');
	    console.info(extensions);

	    var html = extensionsTemplate({"extensions" : extensions});
	    $("#history-panel-content").html(html);
	    $("#history-panel-div").removeClass("hidden");

	    // Scroll to the bottom does not appear to work until the div
	    // is actually expanded.
	    $('#history-collapse').on('shown.bs.collapse', function () {
		$("#history-panel-content").scrollTop(10000);
	    });
	}
	if ($('#extension-reason').length) {
	    $("#extension-reason-row pre").text($('#extension-reason').text());
	    $("#extension-reason-row").removeClass("hidden");
	}
	// This activates the popover subsystem.
	$('#history-panel-content [data-toggle="popover"]').popover({
	    trigger: 'hover',
	    placement: 'auto',
	});
	// Extension metrics handler, to show in modal
	$('#history-panel-content .autoapprove-metrics').click(function (e) {
	    e.preventDefault();
	    ShowMetricsModal(this);
	});
	
	// Default number of days.
	if (window.HOURS) {
	    $('#howlong').val(convertHours(window.HOURS));
	}
	// Handlers for Extend and Deny buttons.
	$('#deny-extension').click(function (event) {
	    event.preventDefault();
	    Action("deny");
	    return false;
	});
	$('#do-extension').click(function (event) {
	    event.preventDefault();
	    Action("extend");
	    return false;
	});
	$('#do-moreinfo').click(function (event) {
	    event.preventDefault();
	    Action("moreinfo");
	    return false;
	});
	$('#do-terminate').click(function (event) {
	    event.preventDefault();
	    sup.HideModal("#confirm-terminate-modal");
	    Action("terminate");
	    return false;
	});
	/*
	 * Handler for the Maximum Extension button, which just overwrites
	 * the value in the input box. We want to save off the current
	 * value to restore if later unchecked.
	 */
	var current_extension_input = null;
	$('#maximum-extension-checkbox').change(function (e) {
	    if ($('#maximum-extension-checkbox').is(":checked")) {
		current_extension_input = $('#howlong').val();
		if (maxextension == null) {
		    alert("There is maximum extension!");
		    // Flip the checkbox back.
		    $('#maximum-extension-checkbox').prop("checked", false);
		    return;
		}
		// Kill the input field, it will be ignored.
		$('#howlong').val("");
	    }
	    else {
		$('#howlong').val(current_extension_input);
	    }
	});
    }

    //
    // Convert xDyH into hours. A plain integer is just days.
    //
    function getHowlong()
    {
	var howlong = $.trim($('#howlong').val());

	// Nothing means zero.
	if (howlong == "") {
	    return 0;
	}

	var matches = howlong.match(/^(\d+)(D|H)?$/i);
	if (matches) {
	    if (matches[2] === undefined || matches[2] == "D") {
		return parseInt(matches[1]) * 24;
	    }
	    return parseInt(matches[1]);
	}
	matches = howlong.match(/^(\d+)D(\d+)H$/i);
	if (matches) {
	    return (parseInt(matches[1]) * 24) + parseInt(matches[2]);
	}
	return undefined;
    }
    function convertHours(hours)
    {
        /*
         * Convert hours to handy 5D14H string or just days integer.
         */
	var days  = parseInt(hours / 24);
	var hours = hours % 24;
	var str;

        if (days) {
	    if (!hours) {
		return days;
	    }
	    return days + "D" + hours + "H";
        }
	return hours + "H";
    }

    //
    // Do the extension.
    //
    function Action(action)
    {
	var howlong = getHowlong();
	var reason  = $("#reason").val();
	var method  = (action == "extend" ?
		       "RequestExtension" :
		       (action == "moreinfo" ?
			"MoreInfo" :
			(action == "terminate" ?
			 "SchedTerminate" : "DenyExtension")));
	// Only an extend option.
	var force = 0;
	if (action == "extend" &&
	    $('#force-extension-checkbox').is(":checked")) {
	    force = 1;
	}
	// Extend out to currently allowed maximum extension.
	if (action == "extend" &&
	    $('#maximum-extension-checkbox').is(":checked")) {
	    howlong = maxextension.toString();
	}
	else if (howlong === undefined) {
	    alert("Cannot parse extension duration");
	    return;
	}

	var callback = function(json) {
	    sup.HideModal("#waitwait-modal");

	    if (json.code) {
		var message;
		
		if (json.code < 0) {
		    message = "Operation failed!";
		}
		else {
		    message = "Operation failed: " + json.value;
		}
		sup.SpitOops("oops", message);
		return;
	    }
	    // Must change this so that reloading maxextension does not
	    // throw a hissy fit.
	    if (window.HOURS) {
		window.HOURS = window.HOURS - howlong;
	    }
	    LoadFirstRow();
	    // Make it harder to repeat action unintentionally. 
	    if (action == "extend" || action == "terminate") {
		$('#howlong').val("0");
	    }
	    sup.ShowModal("#success-modal");
	};
	sup.ShowModal("#waitwait-modal");
	var xmlthing = sup.CallServerMethod(null, "status", method,
					    {"uuid"   : window.UUID,
					     "howlong": howlong,
					     "reason" : reason,
					     "force"  : force});
	xmlthing.done(callback);	
    }

    // First Row is the experiment summary info.
    function LoadFirstRow(continuation) {
	sup.CallServerMethod(null, "status", "ExpInfo", {"uuid" : window.UUID},
			     function (json) {
				 console.info(json);
				 if (json.code == 0) {
				     var html = firstrowTemplate(
					 {"expinfo" : json.value,
					  "uuid"    : window.UUID,
					  "uid"     : window.CREATOR,
					  "pid"     : window.PID}
				     );
				     $("#firstrow").html(html);
				     $('.format-date').each(function() {
					 var date = $.trim($(this).html());
					 if (date != "") {
					     $(this).html(moment(date)
							 .format("MMM D, YYYY h:mm A"));
					 }
				     });
				     // lockout change event handler.
				     $('#lockout-checkbox').change(function() {
					 DoLockout($(this).is(":checked"));
				     });	
				     // lockdown change event handler.
				     $('#user-lockdown-checkbox')
					 .change(function() {
					     DoLockdown("user",
							$(this).is(":checked"));
				     });
				     $('#admin-lockdown-checkbox')
					 .change(function() {
					     DoLockdown("admin",
							$(this).is(":checked"));
					 });
				     $('#quarantine-checkbox')
					 .change(function() {
					     DoQuarantine($(this).is(":checked"));
					 });
				     // This activates the popover subsystem.
				     $('[data-toggle="popover"]').popover({
					 trigger: 'hover',
					 placement: 'auto',
				     });
				     // No termination.
				     if (json.value.admin_lockdown) {
					 $('#terminate-button')
					     .attr("disabled", "disabled");
				     }
				     // Update the Max Extension
				     DoMaxExtension(json.value.expires,
						    continuation);
				     SetupAdminNotes();
				 }
			     });
    }

    function LoadUtilization(continuation) {
	console.info("LoadUtilization", continuation);
	var utilizationTemplate = _.template(utilizationString);
	var summaryTemplate = _.template(summaryString);
	
	var callback = function(json) {
	    console.info("LoadUtilization", json);
	    // Fire off the next part.
	    if (continuation !== undefined) {
		continuation();
	    }
	    if (json.code) {
		console.info("Could not load utilization");
		return;
	    }
	    var html = utilizationTemplate({"utilization" : json.value});
	    $("#utilization-panel-content").html(html);
	    InitTable("utilization");
	    $("#utilization-panel-div").removeClass("hidden");

	    var html = summaryTemplate({"utilization" : json.value});
	    $("#thirdrow").html(html);

	    // This activates the tooltip subsystem.
	    $('[data-toggle="tooltip"]').tooltip({
		delay: {"hide" : 500, "show" : 150},
		placement: 'auto',
	    });
	};
	var xmlthing = sup.CallServerMethod(null, "status", "Utilization",
					    {"uuid"   : window.UUID});
	xmlthing.done(callback);	
    }
    function InitTable(name)
    {
	var tablename  = "#" + name + "-table";
	
	var table = $(tablename)
		.tablesorter({
		    theme : 'green',
		    // initialize zebra and filter widgets
		    widgets: ["uitheme"],
		    widgetOptions: {
			// include child row content while filtering, if true
			filter_childRows  : true,
			// include all columns in the search.
			filter_anyMatch   : true,
			// class name applied to filter row and each input
			filter_cssFilter  : 'form-control',
			// search from beginning
			filter_startsWith : false,
			// Set this option to false for case sensitive search
			filter_ignoreCase : true,
			// Only one search box.
			filter_columnFilters : false,
		    }
		});
    }

    //
    // Request lockout set/clear.
    //
    function DoLockout(lockout)
    {
	lockout = (lockout ? 1 : 0);

	var callback = function(json) {
	    if (json.code) {
		alert("Failed to change lockout: " + json.value);
		// Flip the checkbox back
		$('#lockout-checkbox').prop("checked", false);
		return;
	    }
	}
	if (lockout) {
	    // Bind the confirm button in the modal. 
	    $('#disable-extension-modal .confirm-button').click(function () {
		sup.HideModal('#disable-extension-modal', function () {
		    var reason  = $('#disable-extension-modal .reason').val();
		    var xmlthing = sup.CallServerMethod(null,
							"status", "Lockout",
							{"uuid"   : window.UUID,
							 "lockout": lockout,
							 "reason" : reason});
		    xmlthing.done(callback);
		});
	    });
	    // Handler so we know the user closed the modal. We need to
	    // clear the confirm button handler.
	    $('#disable-extension-modal').on('hidden.bs.modal', function (e) {
		$('#disable-extension-modal .confirm-button').unbind("click");
		$('#disable-extension-modal').off('hidden.bs.modal');
	    });
	    sup.ShowModal("#disable-extension-modal");
	    return;
	}
	// Clearing the lockout.
	var xmlthing = sup.CallServerMethod(null, "status", "Lockout",
					     {"uuid" : window.UUID,
					      "lockout" : lockout});
	xmlthing.done(callback);
    }

    //
    // Request lockdown set/clear.
    //
    function DoLockdown(which, lockdown, force)
    {
	var action = (lockdown ? "set" : "clear");
	// Optional arg.
	if (force === undefined) {
	    force = 0;
	}
	
	var callback = function(json) {
	    if (json.code) {
		sup.HideModal("#waitwait-modal", function () {
		    if (lockdown) {
			// Flip the checkbox back.
			$('#' + which + '-lockdown-checkbox')
			    .prop("checked", false);
		    }
		    else {
			// Flip the checkbox back.
			$('#' + which + '-lockdown-checkbox')
			    .prop("checked", true);
		    }
		    if (json.code != GENIRESPONSE_REFUSED) {
			sup.SpitOops("oops",
				     "Lockdown failed: " + json.value);
			return;
		    }
		    // Refused.
		    $('#force-lockdown').click(function (event) {
			sup.HideModal('#lockdown-refused', function() {
			    // Flip the checkbox again
			    $('#' + which + '-lockdown-checkbox')
				.prop("checked", true);
			    // Again with force.
			    DoLockdown(which, lockdown, 1);
			});
		    });
		    $('#lockdown-refused pre').text(json.value);
		    sup.ShowModal('#lockdown-refused', function () {
			$('#force-lockdown').off("click");
		    });
		});
		return;
	    }
	    sup.HideModal("#waitwait-modal");
	    if (which == "admin") {
		if (lockdown) {
		    $('#terminate-button').attr("disabled", "disabled");
		}
		else {
		    $('#terminate-button').removeAttr("disabled");
		}
	    }
	}
	sup.ShowModal("#waitwait-modal");
	var xmlthing = sup.CallServerMethod(null, "status", "Lockdown",
					    {"uuid"   : window.UUID,
					     "which"  : which,
					     "action" : action,
					     "force"  : force});
	xmlthing.done(callback);
    }

    //
    // Request panic mode set/clear.
    //
    function DoQuarantine(mode)
    {
	mode = (mode ? 1 : 0);
	
	var callback = function(json) {
	    if (json.code) {
		sup.HideModal('#waitwait-modal', function () {
		    sup.SpitOops("oops",
				 "Failed to change Quarantine mode: " +
				 json.value);
		    if (mode) {
			// Flip the checkbox back.
			$('#quarantine-checkbox')
			    .prop("checked", false);
		    }
		    else {
			// Flip the checkbox back.
			$('#quarantine-checkbox')
			    .prop("checked", true);
		    }
		});
		return;
	    }
	    sup.HideModal('#waitwait-modal');
	}
	sup.ShowModal('#waitwait-modal');
	var xmlthing = sup.CallServerMethod(null, "status", "Quarantine",
					     {"uuid" : window.UUID,
					      "quarantine" : mode});
	xmlthing.done(callback);
    }

    //
    // Get Max Extension and update the table.
    //
    function DoMaxExtension(expires, continuation)
    {
	console.info("DoMaxExtension", expires, continuation);
	
	// Warn if changing days violates max extension.
	var callback = function(json) {
	    if (continuation !== undefined) {
		continuation();
	    }
	    $("#howlong").on("keyup", function (event) {
		if (!maxextension) {
		    $('#max-extension-nomax').removeClass("hidden");
		    return;
		}
		$('#max-extension-nomax').addClass("hidden");
		var hours = getHowlong();
		console.info("getHowlong returns ", hours);
		if (hours !== undefined) {
		    if (hours) {
			var when = moment(expires).add(hours, "hours");
			console.info("when", when.format('lll'));
			console.info("max", maxextension.format('lll'));
			if (when.isAfter(maxextension)) {
			    $('#max-extension-warning .max-extension-date')
				.html(when.format('lll'));
			    $('#max-extension-warning').removeClass("hidden");
			}
			else {
			    $('#max-extension-warning').addClass("hidden");
			    $('#max-extension-warning .max-extension-date')
				.html("");
			}
			return;
		    }
		}
		$('#max-extension-warning').addClass("hidden");
		$('#max-extension-warning .max-extension-date').html("");
	    });
	    
	    if (json.code) {
		console.info("Failed to get max extension", json);
		$('#howlong').val("0");
		$('#max-extension-nomax').removeClass("hidden");
		
		/*
		 * Special case, the cluster is saying no extension is possible,
		 * so it does not even provide a date.
		 */
		if (json.code == GENIRESPONSE_REFUSED) {
		    $('#max-extension').html("<span class='text-danger'>" +
					     "No Extension Possible!</span>");
		    if (window.DAYS) {
			alert("The cluster says no extension is possible at all! " +
			      "Granting any extension can potentially throw the " +
			      "reservation system into overbook.");
		    }
		}
		else {
		    $('#max-extension').html("<span class='text-danger'>" +
					     "Cannot Get Max Extension!</span>");
		    alert("Unable to get the maximum allowed extension from " +
			  "the cluster. " +
			  "Granting any extension can potentially throw the " +
			  "reservation system into overbook.");
		}
		return;
	    }
	    // Save for checking the extension input field.
	    maxextension = moment(json.value);
	    
	    $('#max-extension').html(moment(json.value)
				     .format("MMM D, YYYY h:mm A"));
	    
	    /*
	     * Look to see if the number of hours requested is going to be
	     * greater then the max slice extension. If it is, then we want
	     * to make sure that is noticed.
	     */
	    if (window.HOURS) {
		var exp = new Date(expires);
		var max = new Date(json.value);
		exp.setTime(exp.getTime() + window.HOURS * 3600 * 1000);
	    
		if (exp.getTime() > max.getTime()) {
		    var m1   = moment(exp.getTime());
		    var m2   = moment(max.getTime());
		    var diff = m1.diff(m2, "hours");

		    var d = parseInt(diff / 24);
		    var h = diff % 24;
		    var str;

		    if (d) {
			str = d + "days";
			if (h) {
			    str = str + "and " + h + " hours";
			}
		    }
		    else {
			str = d + "hours";
		    }
		    alert("Granting this full extension would violate the " +
			  "current maximum allowed extension by " + str + ". " +
			  "Granting the extension can potentially throw the " +
			  "reservation system into overbook.");

		    // Change the box number to reflect a legal extension.
		    if (window.HOURS >= diff) {
			$('#howlong').val(convertHours(window.HOURS - diff));
		    }
		    else {
			$('#howlong').val("0");
		    }
		}
	    }
	}
	var xmlthing = sup.CallServerMethod(null, "status", "MaxExtension",
					    {"uuid" : window.UUID});
	xmlthing.done(callback);
    }

    //
    // Slothd graphs.
    //
    function LoadIdleData(continuation)
    {
	console.info("LoadIdleData", continuation);

	var callback = function (gotdata) {
	    console.info("LoadIdleData callback");
	    if (continuation !== undefined) {
		continuation();
	    }
	};
	ShowIdleGraphs({"uuid"     : window.UUID,
			"showwait" : false,
			"loadID"   : "#loadavg-panel-div",
			"ctrlID"   : "#ctrl-traffic-panel-div",
			"exptID"   : "#expt-traffic-panel-div",
			"callback" : callback});
    }

    //
    // Openstacks stats.
    //
    function LoadOpenStack()
    {
	console.info("LoadIdleData");

	var callback = function(json) {
	    if (json.code) {
		return;
	    }
	    // Might not be any.
	    if (!json.value || json.value == "") {
		return;
	    }
	    var html = "<pre>" + json.value + "</pre>";
	    $("#openstack-panel-div").removeClass("hidden");
	    $("#openstack-panel-content").html(html);
	};
    	var xmlthing = sup.CallServerMethod(null, "status", "OpenstackStats",
					    {"uuid" : window.UUID});
	xmlthing.done(callback);
    }

    //
    // Setup the admin notes panel for editing
    //
    function SetupAdminNotes()
    {
	var modified = 0;
	var notes = $.trim($("#adminnotes-collapse textarea").val());
	
	// Panel starts out collapsed.
	$('#adminnotes-collapse').on('show.bs.collapse', function () {
	    $('#adminnotes-row .toggle').html('Hide');
	});
	$('#adminnotes-collapse').on('hide.bs.collapse', function () {
	    var label = "View";
	    if ($("#adminnotes-collapse textarea").val() == "") {
		label = "Add";
	    }
	    $('#adminnotes-row .toggle').html(label);
	});
	$("#adminnotes-collapse textarea")
	    .on("change input paste keyup", function() {
		modified = 1;
		$('#adminnotes-save-button').removeClass('hidden');
	    });
	$('#adminnotes-save-button').click(function (event) {
	    event.preventDefault();
	    if (modified) {
		SaveAdminNotes(function () {
		    modified = 0;
		    $('#adminnotes-save-button').addClass('hidden');
		});
	    }
	});
	if (notes != "") {
	    $('#adminnotes-collapse').collapse('show');	    
	}
    }
    function SaveAdminNotes(done)
    {
	var notes = $("#adminnotes-collapse textarea").val();
	
	var callback = function(json) {
	    if (json.code) {
		sup.SpitOops("oops", "Failed to save admin notes: " +
			     json.value);
		return;
	    }
	    done();
	};
    	var xmlthing = sup.CallServerMethod(null, "status", "SaveAdminNotes",
					    {"uuid"  : window.UUID,
					     "notes" : notes});
	xmlthing.done(callback);
    }
    function ShowMetricsModal(target)
    {
	var idx = $(target).data("idx");
	var str = extensions[idx].autoapproved_metrics;
	str.replace(/\\"/g, '"');
	var obj = JSON.parse(str);
	str = JSON.stringify(obj, null, 2); 
	console.info(str);
	$('#metrics-content').text(str);
	sup.ShowModal('#metrics-modal');
    }

    // Helper.
    function decodejson(id) {
	return JSON.parse(_.unescape($(id)[0].textContent));
    }

    initialize();
});
