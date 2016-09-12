require(window.APT_OPTIONS.configObject,
	['underscore', 'js/quickvm_sup', 'moment', 'js/idlegraphs',
	 'js/lib/text!template/adminextend.html',
	 'js/lib/text!template/waitwait-modal.html',
	 'js/lib/text!template/oops-modal.html'],
function (_, sup, moment, ShowIdleGraphs,
	  mainString, waitwaitString, oopsString)
{
    'use strict';
    var extensions         = null;
    var firstrowTemplate   = null;
    var secondrowTemplate  = null;
    var extensionsTemplate = null;

    function initialize()
    {
	window.APT_OPTIONS.initialize(sup);

	$('#main-body').html(mainString);
	$('#waitwait_div').html(waitwaitString);
	$('#oops_div').html(oopsString);

	firstrowTemplate = _.template($('#firstrow-template', html).html());
	secondrowTemplate = _.template($('#secondrow-template', html).html());
	extensionsTemplate = _.template($('#history-template', html).html());

	LoadUtilization();
	LoadIdleData();
	LoadFirstRow();
	LoadOpenStack();

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
	
	// Default number of days.
	if (window.DAYS) {
	    $('#days').val(window.DAYS);
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
    }

    //
    // Do the extension.
    //
    function Action(action)
    {
	var howlong = $('#days').val();
	var reason  = $("#reason").val();
	var method  = (action == "extend" ?
		       "RequestExtension" :
		       (action == "moreinfo" ?
			"MoreInfo" :
			(action == "terminate" ?
			 "SchedTerminate" : "DenyExtension")));

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
	    LoadFirstRow();
	    // Make it harder to repeat action unintentionally. 
	    if (action == "extend" || action == "terminate") {
		$('#days').val("0");
	    }
	    sup.ShowModal("#success-modal");
	};
	sup.ShowModal("#waitwait-modal");
	var xmlthing = sup.CallServerMethod(null, "status", method,
					    {"uuid"   : window.UUID,
					     "howlong": howlong,
					     "reason" : reason});
	xmlthing.done(callback);	
    }

    // First Row is the experiment summary info.
    function LoadFirstRow() {
	sup.CallServerMethod(null, "status", "ExpInfo", {"uuid" : window.UUID},
			     function (json) {
				 console.info(json);
				 if (json.code == 0) {
				     var html = firstrowTemplate({"expinfo": json.value,
							  "uuid"    : window.UUID,
							  "uid"     : window.CREATOR,
							  "pid"     : window.PID});
				     $("#firstrow").html(html);
				     $('.format-date').each(function() {
					 var date = $.trim($(this).html());
					 if (date != "") {
					     $(this).html(moment($(this).html())
							  .format("MMM D h:mm A"));
					 }
				     });
				     // lockout change event handler.
				     $('#lockout-checkbox').change(function() {
					 DoLockout($(this).is(":checked"));
				     });	
				     // lockdown change event handler.
				     $('#lockdown-checkbox').change(function() {
					 DoLockdown($(this).is(":checked"));
				     });
				     // This activates the popover subsystem.
				     $('[data-toggle="popover"]').popover({
					 trigger: 'hover',
					 placement: 'auto',
				     });
				 }
			     });
    }

    function LoadUtilization() {
	var util = $('#utilization-template', "html").html();
	var summary = $('#summary-template', "html").html();
	var utilizationTemplate = _.template(util);
	var summaryTemplate = _.template(summary);
	
	var callback = function(json) {
	    console.info(json);
	    var html = utilizationTemplate({"utilization" : json.value});
	    $("#utilization-panel-content").html(html);
	    InitTable("utilization");
	    $("#utilization-panel-div").removeClass("hidden");

	    var html = summaryTemplate({"utilization" : json.value});
	    $("#thirdrow").html(html);
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
		return;
	    }
	}
	var xmlthing = sup.CallServerMethod(null, "status", "Lockout",
					     {"uuid" : window.UUID,
					      "lockout" : lockout});
	xmlthing.done(callback);
    }

    //
    // Request lockdown set/clear.
    //
    function DoLockdown(lockdown)
    {
	lockdown = (lockdown ? 1 : 0);
	
	var callback = function(json) {
	    sup.HideModal("#waitwait-modal");
	    if (json.code) {
		alert("Failed to change lockdown: " + json.value);
		return;
	    }
	}
	sup.ShowModal("#waitwait-modal");
	var xmlthing = sup.CallServerMethod(null, "status", "Lockdown",
					     {"uuid" : window.UUID,
					      "lockdown" : lockdown});
	xmlthing.done(callback);
    }

    //
    // Slothd graphs.
    //
    function LoadIdleData()
    {
	ShowIdleGraphs({"uuid"     : window.UUID,
			"showwait" : false,
			"loadID"   : "#loadavg-panel-div",
			"ctrlID"   : "#ctrl-traffic-panel-div",
			"exptID"   : "#expt-traffic-panel-div"});
    }

    //
    // Openstacks stats.
    //
    function LoadOpenStack()
    {
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

    // Helper.
    function decodejson(id) {
	return JSON.parse(_.unescape($(id)[0].textContent));
    }
    
    $(document).ready(initialize);
});
