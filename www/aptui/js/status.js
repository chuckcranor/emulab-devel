$(function ()
{
    'use strict';

    var templates = APT_OPTIONS.fetchTemplateList(['status', 'waitwait-modal', 'oops-modal', 'register-modal', 'terminate-modal', 'clone-help', 'snapshot-help', 'oneonly-modal', 'approval-modal', 'linktest-modal', 'linktest-md']);

    var statusString = templates['status'];
    var waitwaitString = templates['waitwait-modal'];
    var oopsString = templates['oops-modal'];
    var registerString = templates['register-modal'];
    var terminateString = templates['terminate-modal'];
    var cloneHelpString = templates['clone-help'];
    var snapshotHelpString = templates['snapshot-help'];
    var oneonlyString = templates['oneonly-modal'];
    var approvalString = templates['approval-modal'];
    var linktestString = templates['linktest-modal'];

    var nodecount   = 0;
    var ajaxurl     = null;
    var uuid        = null;
    var oneonly     = 0;
    var isadmin     = 0;
    var isfadmin    = 0;
    var isguest     = 0;
    var isstud      = 0;
    var ispprofile  = 0;
    var dossh       = 1;
    var profile_uuid= null;
    var extend      = null;
    var jacksIDs    = {};
    var publicURLs  = null;
    var status_collapsed  = false;
    var status_message    = "";
    var statusTemplate    = _.template(statusString);
    var terminateTemplate = _.template(terminateString);
    var instanceStatus    = "";
    var lastStatus        = "";
    var paniced           = 0;
    var lockout           = 0;
    var lockdown          = 0;
    var lockdown_code     = "";
    var consolenodes      = {};
    var showlinktest      = false;
    var hidelinktest      = false;
    var extensions        = null;
    var changingtopo      = false;
    var EMULAB_NS = "http://www.protogeni.net/resources/rspec/ext/emulab/1";

    function initialize()
    {
	window.APT_OPTIONS.initialize(sup);
	ajaxurl = window.APT_OPTIONS.AJAXURL;
	uuid    = window.APT_OPTIONS.uuid;
	oneonly = window.APT_OPTIONS.oneonly;
	isadmin = window.APT_OPTIONS.isadmin;
	isfadmin= window.APT_OPTIONS.isfadmin;
	isstud  = window.APT_OPTIONS.isstud;
	isguest = (window.APT_OPTIONS.registered ? false : true);
	dossh   = window.APT_OPTIONS.dossh;
	extend  = window.APT_OPTIONS.extend || null;
	ispprofile = window.APT_OPTIONS.ispprofile;
	profile_uuid = window.APT_OPTIONS.profileUUID;
	paniced      = window.APT_OPTIONS.paniced;
	lockout      = window.APT_OPTIONS.lockout;
	lockdown     = window.APT_OPTIONS.lockdown;
	lockdown_code= uuid.substr(2, 5);
	instanceStatus = window.APT_OPTIONS.instanceStatus;
	hidelinktest   = window.APT_OPTIONS.hidelinktest;
	var errorURL = window.HELPFORUM;

	if ($('#extensions-json').length) {
	    extensions = decodejson('#extensions-json');
	    console.info(extensions);
	}

	// Generate the templates.
	var template_args = {
	    uuid:		uuid,
	    name:		window.APT_OPTIONS.name,
	    profileName:	window.APT_OPTIONS.profileName,
	    profileUUID:	window.APT_OPTIONS.profileUUID,
	    sliceURN:		window.APT_OPTIONS.sliceURN,
	    sliceExpires:	window.APT_OPTIONS.sliceExpires,
	    sliceExpiresText:	window.APT_OPTIONS.sliceExpiresText,
	    sliceCreated:	window.APT_OPTIONS.sliceCreated,
	    creatorUid:		window.APT_OPTIONS.creatorUid,
	    creatorEmail:	window.APT_OPTIONS.creatorEmail,
	    registered:		window.APT_OPTIONS.registered,
	    isadmin:            window.APT_OPTIONS.isadmin,
	    isfadmin:           window.APT_OPTIONS.isfadmin,
	    isstud:             window.APT_OPTIONS.isstud,
	    extensions:         extensions,
	    errorURL:           errorURL,
	    paniced:            paniced,
	    project:            window.APT_OPTIONS.project,
	    group:              window.APT_OPTIONS.group,
	    lockout:            lockout,
	    lockdown:           lockdown,
	    lockdown_code:      lockdown_code,
	    // The status panel starts out collapsed.
	    status_panel_show:  (instanceStatus == "ready" ? false : true),
	    repourl:		window.APT_OPTIONS.repourl,
	    reporef:		window.APT_OPTIONS.reporef,
	    repohash:		window.APT_OPTIONS.repohash,
	};
	var status_html   = statusTemplate(template_args);
	$('#status-body').html(status_html);
	$('#waitwait_div').html(waitwaitString);
	$('#oops_div').html(oopsString);
	$('#register_div').html(registerString);
	$('#terminate_div').html(terminateTemplate(template_args));
	$('#oneonly_div').html(oneonlyString);
	$('#approval_div').html(approvalString);
	$('#linktest_div').html(linktestString);

	// Format dates with moment before display.
	$('.format-date').each(function() {
	    var date = $.trim($(this).html());
	    if (date != "") {
		$(this).html(moment($(this).html()).format("lll"));
	    }
	});
	ProgressBarUpdate();

	// This activates the popover subsystem.
	$('[data-toggle="popover"]').popover({
	    trigger: 'hover',
	    placement: 'top',
	});
	$('[data-toggle="tooltip"]').tooltip({
	    placement: 'top',
	});

	// Use an unload event to terminate any shells.
	$(window).bind("unload", function() {
//	    console.info("Unload function called");
	
	    $('#quicktabs_content div').each(function () {
		var $this = $(this);
		// Skip the main profile tab
		if ($this.attr("id") == "profile") {
		    return;
		}
		var tabname = $this.attr("id");
	    
		// Trigger the custom event.
		$("#" + tabname).trigger("killssh");
	    });
	});

	// Take the user to the registration page.
	$('button#register-account').click(function (event) {
	    event.preventDefault();
	    sup.HideModal('#register_modal');
	    var uid   = window.APT_OPTIONS.creatorUid;
	    var email = window.APT_OPTIONS.creatorEmail;
	    var url   = "signup.php?uid=" + uid + "&email=" + email + "";
	    var win   = window.open(url, '_blank');
	    win.focus();
	});

	// Setup the extend modal.
	$('button#extend_button').click(function (event) {
	    event.preventDefault();
	    if (isfadmin) {
		sup.ShowModal("#extend_history_modal");
		return;
	    }
	    if (isadmin) {
		window.location.replace("adminextend.php?uuid=" + uuid);
		return;
	    }
            ShowExtendModal(uuid, RequestExtensionCallback, isstud, isguest,
                            window.APT_OPTIONS.physnode_count,
                            window.APT_OPTIONS.physnode_hours);
	});
	
	// Handler for the refresh button
	$('button#refresh_button').click(function (event) {
	    event.preventDefault();
	    DoRefresh();
	});
	// Handler for the Clone button.
	$('button#clone_button').click(function (event) {
	    event.preventDefault();
	    window.location.replace('manage_profile.php?action=clone' +
				    '&snapuuid=' + uuid);
	});
	// Handler for the reload topology button
	$('button#reload-topology-button').click(function (event) {
	    event.preventDefault();
	    DoReloadTopology();
	});

	//
	// Attach a hover popover to explain what Clone means. We need
	// the hover action delayed by our own code, since we want to
	// use a manual trigger to close the popover, or else the user
	// will not have enough time to read the content. 
	//
	var popover_timer;

	$("button#clone_button").mouseenter(function(){
	    popover_timer = setTimeout(function() {
		$('button#clone_button').popover({
		    html:     true,
		    content:  cloneHelpString,
		    trigger:  'manual',
		    placement:'left',
		    container:'body',
		});
		$('button#clone_button').popover('show');
		$('#clone_popover_close').on('click', function(e) {
		    $('button#clone_button').popover('hide');
		});
	    },1000)
	}).mouseleave(function(){
	    clearTimeout(popover_timer);
	}).click(function(){
	    clearTimeout(popover_timer);
	});
	
	$("button#snapshot_button").mouseenter(function(){
	    popover_timer = setTimeout(function() {
		$('button#snapshot_button').popover({
		    html:     true,
		    content:  snapshotHelpString,
		    trigger:  'manual',
		    placement:'left',
		    container:'body',
		});
		$('button#snapshot_button').popover('show');
		$('#snapshot_popover_close').on('click', function(e) {
		    $('button#snapshot_button').popover('hide');
		});
		// Kill popover if user clicks through. 
		$('button#snapshot_button').on('click', function(e) {
		    $('button#snapshot_button').popover('hide');
		});
	    },1000)
	}).mouseleave(function(){
	    clearTimeout(popover_timer);
	}).click(function(){
	    clearTimeout(popover_timer);
	    DoSnapshotNode();
	});
	
	// Terminate an experiment.
	$('button#terminate').click(function (event) {
	    var lockdown_override = "";
	    event.preventDefault();
	    sup.HideModal('#terminate_modal');

	    if (lockdown) {
		if (lockdown_code != $('#terminate_lockdown_code').val()) {
		    sup.SpitOops("oops", "Refusing to terminate; wrong code");
		    return;
		}
		lockdown_override =  $('#terminate_lockdown_code').val();
	    }
	    DisableButtons();

	    var callback = function(json) {
		sup.HideModal("#waitwait-modal");
		if (json.code) {
		    EnableButtons();
		    sup.SpitOops("oops", "Failed to terminate: " + json.value);
		    return;
		}
		// This is considered the home page, for now.
		var url = 'instantiate.php?default=' + profile_uuid;
		if (window.APT_OPTIONS.REFSPEC !== undefined) {
		    url += "&refspec=" + window.APT_OPTIONS.REFSPEC;
		}
		window.location.replace(url);
	    }
	    sup.ShowModal("#waitwait-modal");

	    var xmlthing = sup.CallServerMethod(ajaxurl,
						"status",
						"TerminateInstance",
						{"uuid" : uuid,
						 "lockdown_override" :
						   lockdown_override});
	    xmlthing.done(callback);
	});

	// lockout change event handler.
	$('#lockout_checkbox').change(function() {
	    DoLockout($(this).is(":checked"));
	});	
	// lockdown change event handler.
	$('#lockdown_checkbox').change(function() {
	    DoLockdown($(this).is(":checked"));
	});	
	// Quarantine change event handler.
	$('#quarantine_checkbox').change(function() {
	    DoQuarantine($(this).is(":checked"));
	});	

	/*
	 * Attach an event handler to the profile status collapse.
	 * We want to change the text inside the collapsed view
	 * to the expiration countdown, but remove it when expanded.
	 * In other words, user always sees the expiration.
	 */
	$('#profile_status_collapse').on('hide.bs.collapse', function () {
	    status_collapsed = true;
	    // Copy the current expiration over.
	    var current_expiration = $("#instance_expiration").html();
	    $('#status_message').html("Experiment expires: " +
				      current_expiration);
	});
	$('#profile_status_collapse').on('show.bs.collapse', function () {
	    status_collapsed = false;
	    // Reset to status message.
	    $('#status_message').html(status_message);
	});
	if (instanceStatus == "ready") {
 	    $('#profile_status_collapse').trigger('hide.bs.collapse');
	}

	StartCountdownClock(window.APT_OPTIONS.sliceExpires);
	StartStatusWatch();
	if (window.APT_OPTIONS.oneonly) {
	    sup.ShowModal('#oneonly-modal');
	}
	if (window.APT_OPTIONS.thisUid == window.APT_OPTIONS.creatorUid &&
	    window.APT_OPTIONS.extension_denied) {
	    ShowExtensionDeniedModal();
	}
	else if (window.APT_OPTIONS.snapping) {
	    ShowProgressModal();
	}
	else if (window.APT_OPTIONS.extend) {
	    if (isadmin) {
		window.location.replace("adminextend.php?uuid=" + uuid);
		return;
	    }
	    ShowExtendModal(uuid, RequestExtensionCallback, isstud, isguest,
			    window.APT_OPTIONS.physnode_count,
			    window.APT_OPTIONS.physnode_hours);
	}
    }

    //
    // The status watch is a periodic timer, but we sometimes want to
    // hold off running it for a while, and other times we want to run
    // it before the next time comes up. We use flags for both of these
    // cases.
    //
    var statusBusy = 0;
    var statusHold = 0;
    var statusID;

    function StartStatusWatch()
    {
	GetStatus();
	statusID = setInterval(GetStatus, 4000);
    }
    
    function GetStatus()
    {
	// Clearly not thread safe, but its okay.
	if (statusBusy || statusHold)
	    return;
	statusBusy = 1;
	
	var callback = function(json) {
	    StatusWatchCallBack(json);
	    if (instanceStatus == 'terminated') {
		clearInterval(statusID);
	    }
	    statusBusy = 0;
	}
	var xmlthing = sup.CallServerMethod(ajaxurl,
					    "status",
					    "GetInstanceStatus",
					     {"uuid" : uuid});
	xmlthing.fail(function(jqXHR, textStatus) {
	    console.info("GetStatus failed: " + textStatus);
	    statusBusy = 0;
	});
	xmlthing.done(callback);
    }
    // Flag for StatusWatchCallBack()
    var seenmanifests = false;

    // Call back for above.
    function StatusWatchCallBack(json)
    {
	if (json.code) {
	    // GENIRESPONSE_SEARCHFAILED
	    if (json.code == 12) {
		instanceStatus = "terminated";
	    }
	    else if (lastStatus != "terminated") {
		instanceStatus = "unknown";
	    }
	}
	else {
	    instanceStatus = json.value.status;
	}
	var status_html = "";
    
	if (instanceStatus != lastStatus) {
	    console.info(json);
	
	    status_html = status;

	    var bgtype = "panel-info";
	    status_message = "Please wait while we get your experiment ready";

	    //
	    // As soon as we have a manifest, show the topology.
	    // 
	    if (instanceStatus != "provisioning" &&
		json.value.havemanifests && !seenmanifests) {
		seenmanifests = true;
		ShowTopo(false);
	    }
	    // Ditto the publicURL.
	    if (_.has(json.value, "sliverurls")) {
		ShowSliverInfo(json.value.sliverurls);
	    }
	    // Ditto the logfile.
	    if (_.has(json.value, "logfile_url")) {
		ShowLogfile(json.value.logfile_url);
	    }

	    if (instanceStatus == 'stitching') {
		status_html = "stitching";
	    }
	    else if (instanceStatus == 'provisioning') {
		status_html = "provisioning";
		DisableButtons();
		ProgressBarUpdate();
		if (seenmanifests) {
		    changingtopo = true;
		}
	    }
	    else if (instanceStatus == 'provisioned') {
		ProgressBarUpdate();
		status_html = "booting";
		if (json.value.canceled) {
		    status_html += " (but canceled)";
		}
		else {
		    // So the user can cancel. 
		    EnableButton("terminate");
		}
		// If we were in the process of changing the topology,
		// then need to update from the new manifests.
		if (changingtopo) {
		    ShowTopo(true);
		    changingtopo = false;
		}
	    }
	    else if (instanceStatus == 'ready') {
		bgtype = "panel-success";
		status_message = "Your experiment is ready!";

		if (servicesExecuting(json.value)) {
		    status_html = "<font color=green>booted</font>";
		    status_html += " (startup services are still running)";
		}		
		else {
		    status_html = "<font color=green>ready</font>";
		}
		ProgressBarUpdate();
		EnableButtons();
		// We should be looking at the node status instead.
		if (lastStatus != "imaging") {
		    AutoStartSSH();
		}
		ShowIdleDataTab();
		if (json.value.haveopenstackstats) {
		    ShowOpenstackTab();
		}
	    }
	    else if (instanceStatus == 'failed') {
		bgtype = "panel-danger";

		if (_.has(json.value, "reason")) {
		    status_message = "Something went wrong!";
		    $('#error_panel_text').text(json.value.reason);
		    $('#error_panel').removeClass("hidden");
		}
		else {
		    status_message = "Something went wrong, sorry! " +
			"We've been notified.";
		}
		status_html = "<font color=red>failed</font>";
		ProgressBarUpdate();
		DisableButtons();
		EnableButton("terminate");
		EnableButton("refresh");
		EnableButton("reloadtopo");
	    }
	    else if (instanceStatus == 'imaging') {
		bgtype = "panel-warning";
		status_message = "Your experiment is busy while we  " +
		    "copy your disk";
		status_html = "<font color=red>imaging</font>";
		DisableButtons();
	    }
	    else if (instanceStatus == 'linktest') {
		bgtype = "panel-warning";
		status_message = "Your experiment is busy while we  " +
		    "run linktest";
		status_html = "<font color=red>linktest</font>";
		DisableButtons();
	    }
	    else if (instanceStatus == 'imaging-failed') {
		bgtype = "panel-danger";
		status_message = "Your disk image request failed!";
		status_html = "<font color=red>imaging-failed</font>";
		DisableButtons();
		EnableButton("terminate");
		EnableButton("refresh");
		EnableButton("reloadtopo");
	    }
	    else if (instanceStatus == 'terminating' ||
		     instanceStatus == 'terminated') {
		status_html = "<font color=red>" + instanceStatus + "</font>";
		bgtype = "panel-danger";
		status_message = "Your experiment has been terminated!";
		DisableButtons();
		StartCountdownClock.stop = 1;
	    }
	    else if (instanceStatus == "unknown") {
		status_html = "<font color=red>" + instanceStatus + "</font>";
		bgtype = "panel-warning";
		status_message = "The server is temporarily unavailable!";
		DisableButtons();
	    }
	    if (!status_collapsed) {
		$("#status_message").html(status_message);
	    }
	    $("#status_panel")
		.removeClass('panel-success panel-danger ' +
			     'panel-warning panel-default panel-info')
		.addClass(bgtype);
	    $("#quickvm_status").html(status_html);
	}
	else if (lastStatus == "ready" && instanceStatus == "ready") {
	    if (servicesExecuting(json.value)) {
		status_html = "<font color=green>booted</font>";
		status_html += " (startup services are still running)";
	    }		
	    else {
		status_html = "<font color=green>ready</font>";
	    }
	    $("#quickvm_status").html(status_html);

	    // This will happen when the user clicks the Reload Topology
	    // button, ww want to redraw with the new manifests.
	    if (changingtopo) {
		ShowTopo(true);
		changingtopo = false;
	    }
	}
		 
	//
	// Look for a sliverstatus blob.
	//
	if (json.value.havemanifests && _.has(json.value, "sliverstatus")) {
	    UpdateSliverStatus(json.value.sliverstatus);
	}
	lastStatus = instanceStatus;
    }

    //
    // Enable/Disable buttons. 
    //
    function EnableButtons()
    {
	EnableButton("terminate");
	EnableButton("refresh");
	EnableButton("reloadtopo");
	EnableButton("extend");
	EnableButton("clone");
	EnableButton("snapshot");
	ToggleLinktestButtons(instanceStatus);	
    }
    function DisableButtons()
    {
	DisableButton("terminate");
	DisableButton("refresh");
	DisableButton("reloadtopo");
	DisableButton("extend");
	DisableButton("clone");
	DisableButton("snapshot");
	ToggleLinktestButtons(instanceStatus);	
    }
    function EnableButton(button)
    {
	ButtonState(button, 1);
    }
    function DisableButton(button)
    {
	ButtonState(button, 0);
    }
    function ButtonState(button, enable)
    {
	if (button == "terminate")
	    button = "#terminate_button";
	else if (button == "extend")
	    button = "#extend_button";
	else if (button == "refresh")
	    button = "#refresh_button";
	else if (button == "reloadtopo")
	    button = "#reload-topology-button";
	else if (button == "clone" && nodecount == 1)
	    button = "#clone_button";
	else if (button == "snapshot" && nodecount == 1)
	    button = "#snapshot_button";
	else if (button == "start-linktest")
	    button = "#linktest-modal-button";
	else if (button == "stop-linktest")
	    button = "#linktest-stop-button";
	else
	    return;

	if (enable) {
	    $(button).removeAttr("disabled");
	}
	else {
	    $(button).attr("disabled", "disabled");
	}
    }

    //
    // Found this with a Google search; countdown till the expiration time,
    // updating the display. Watch for extension via the reset variable.
    //
    function StartCountdownClock(when)
    {
	// Use this static variable to force clock reset.
	StartCountdownClock.reset = when;

	// Force init below
	when = null;
    
	// Use this static variable to force clock stop
	StartCountdownClock.stop = 0;
    
	// date counting down to
	var target_date;

	// text color.
	var color = "";
    
	// update the tag with id "countdown" every 1 second
	var updater = setInterval(function () {
	    // Clock stop
	    if (StartCountdownClock.stop) {
		// Amazing that this works!
		clearInterval(updater);
	    }
	
	    // Clock reset
	    if (StartCountdownClock.reset != when) {
		when = StartCountdownClock.reset;
		if (when === "n/a") {
		    StartCountdownClock.stop = 1;
		    return;
		}

		// Reformat in local time and show the user.
		var local_date = new Date(when);

		$("#quickvm_expires").html(moment(when).format('lll'));

		// Countdown also based on local time. 
		target_date = local_date.getTime();
	    }
	
	    // find the amount of "seconds" between now and target
	    var current_date = new Date().getTime();
	    var seconds_left = (target_date - current_date) / 1000;

	    if (seconds_left <= 0) {
		// Amazing that this works!
		clearInterval(updater);
		return;
	    }

	    var newcolor   = "";
	    var statusbg   = "panel-success";
	    var statustext = "Your experiment is ready";

	    $("#quickvm_countdown").html(moment(when).fromNow());

	    if (seconds_left < 3600) {
		newcolor   = "text-danger";
		statusbg   = "panel-danger";
		statustext = "Extend your experiment before it expires!";
	    }	    
	    else if (seconds_left < 2 * 3600) {
		newcolor   = "text-warning";
		statusbg   = "panel-warning";
		statustext = "Your experiment is going to expire soon!";
	    }
	    else {
		newcolor = "";
		statusbg = "";
	    }
	    if (newcolor != color) {
		$("#quickvm_countdown")
		    .removeClass("text-warning text-danger")
		    .addClass(newcolor);

		if (status_collapsed) {
		    // Save for when user "shows" the status panel.
		    status_message = statustext;
		    // And update the panel header with new expiration.
		    $('#status_message').html("Experiment expires: " +
			$("#instance_expiration").html());
		}
		else {
		    $("#status_message").html(statustext);
		}
		$("#status_panel")
		    .removeClass('panel-success panel-danger ' +
				 'panel-info panel-default panel-info')
		    .addClass(statusbg);

		color = newcolor;
	    }
	}, 1000);
    }

    //
    // Request experiment extension. Not well named; we always grant the
    // extension. Might need more work later if people abuse it.
    //
    function RequestExtensionCallback(json)
    {
	var message;
	
	if (json.code) {
	    if (json.code < 0) {
		message = "Could not extend experiment. " +
		    "Please try again later";
	    }
	    else if (json.code == 2) {
		$('#approval_text').html(json.value);
		sup.ShowModal('#approval_modal');
		return;
	    }
	    else {
		message = "Could not extend experiment: " + json.value;
	    }
	    sup.SpitOops("oops", message);
	    return;
	}
	var expiration = json.value.expiration;
	$("#quickvm_expires").html(moment(expiration).format('lll'));
	
	// Reset the countdown clock.
	StartCountdownClock.reset = expiration;
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
	var xmlthing = sup.CallServerMethod(ajaxurl, "status", "Lockout",
					     {"uuid" : uuid,
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
	var xmlthing = sup.CallServerMethod(ajaxurl, "status", "Lockdown",
					     {"uuid" : uuid,
					      "lockdown" : lockdown});
	xmlthing.done(callback);
    }

    //
    // Request panic mode set/clear.
    //
    function DoQuarantine(mode)
    {
	mode = (mode ? 1 : 0);
	
	var callback = function(json) {
	    sup.HideModal('#waitwait-modal');
	    if (json.code) {
		sup.SpitOops("oops",
			     "Failed to change Quarantine mode: " + json.value);
		return;
	    }
	}
	sup.ShowModal('#waitwait-modal');
	var xmlthing = sup.CallServerMethod(ajaxurl, "status", "Quarantine",
					     {"uuid" : uuid,
					      "quarantine" : mode});
	xmlthing.done(callback);
    }

    //
    // Request a refresh from the backend cluster, to see if the sliverstatus
    // has changed. 
    //
    function DoRefresh()
    {
	var callback = function(json) {
	    sup.HideModal('#waitwait-modal');
	    //console.info(json);
	    
	    if (json.code) {
		sup.SpitOops("oops", "Failed to refresh status: " + json.value);
		return;
	    }
	    // Trigger status update.
	    GetStatus();
	}
	sup.ShowModal('#waitwait-modal');
	var xmlthing = sup.CallServerMethod(ajaxurl,
					    "status",
					    "Refresh",
					     {"uuid" : uuid});
	xmlthing.done(callback);
    }

    //
    // Request a reload of the manifests (and thus the topology) from the
    // backend clusters.
    //
    function DoReloadTopology()
    {
	var callback = function(json) {
	    //console.info(json);
	    EnableButtons();
	    
	    if (json.code) {
		statusHold = 0;
		sup.HideModal('#waitwait-modal');
		sup.SpitOops("oops", "Failed to reload topo: " + json.value);
		return;
	    }
	    changingtopo = true;	    
	    statusHold = 0;
	    // Trigger status update.
	    GetStatus();
	    sup.HideModal('#waitwait-modal');
	}
	statusHold = 1;
	DisableButtons();
	sup.ShowModal('#waitwait-modal');
	var xmlthing = sup.CallServerMethod(ajaxurl,
					    "status",
					    "ReloadTopology",
					     {"uuid" : uuid});
	xmlthing.done(callback);
    }

    var svgimg = document.createElementNS('http://www.w3.org/2000/svg','image');
    svgimg.setAttributeNS(null,'class','node-status-icon');
    svgimg.setAttributeNS(null,'height','15');
    svgimg.setAttributeNS(null,'width','15');
    svgimg.setAttributeNS('http://www.w3.org/1999/xlink','href',
			  'fonts/record8.svg');
    svgimg.setAttributeNS(null,'x','13');
    svgimg.setAttributeNS(null,'y','-23');
    svgimg.setAttributeNS(null, 'visibility', 'visible');

    // Helper for above and called from the status callback.
    function UpdateSliverStatus(oblob)
    {
	$.each(oblob , function(urn, iblob) {
	    $.each(iblob , function(node_id, details) {
		if (details.status == "ready") {
		    // Greenish.
		    $('#' + jacksIDs[node_id] + ' .node .nodebox')
			.css("fill", "#91E388");
		}
		else if (details.status == "failed") {
		    // Bootstrap bg-danger color
		    $('#' + jacksIDs[node_id] + ' .node .nodebox')
			.css("fill", "#f2dede");
		}
		else {
		    // Bootstrap bg-warning color
		    $('#' + jacksIDs[node_id] + ' .node .nodebox')
			.css("fill", "#fcf8e3");
		}
		
		var html =
		    "<table class='table table-condensed border-none'><tbody> " +
		    "<tr><td class='border-none'>Node:</td><td class='border-none'>" +
		        details.component_urn + "</td></tr>" +
		    "<tr><td class='border-none'>ID:</td><td class='border-none'>" +
		        details.client_id + "</td></tr>" +
		    "<tr><td class='border-none'>Status:</td><td class='border-none'>" +
		        details.status + "</td></tr>" +
		    "<tr><td class='border-none'>Raw State:</td>" +
		        "<td class='border-none'>" +
		        details.rawstate + "</td></tr>";

		if (_.has(details, "execute_state")) {
		    var tag;
		    var icon;
			
		    if (details.execute_state == "running") {
			tag  = "Running";
			icon = "record8.svg";
		    }
		    else if (details.execute_state == "exited") {
			if (details.execute_status != 0) {
			    tag  = "Exited (" + details.execute_status + ")";
			    icon = "cancel22.svg";
			}
			else {
			    tag  = "Finished";
			    icon = "check64.svg";
			}
		    }
		    else {
			tag  = "Pending";
			icon = "button14.svg"
		    }
		    html += "<tr><td class='border-none'>Startup Service:</td>" +
			"<td class='border-none'>" + tag + "</td></tr>";
		    
		    $('#' + jacksIDs[node_id] + ' .node .node-status')
		        .css("visibility", "visible");

		    if (!$('#' + jacksIDs[node_id] +
			   ' .node .node-status-icon').length) {
			$('#' + jacksIDs[node_id] + ' .node .node-status')
		            .append(svgimg.cloneNode());
		    }
		    $('#' + jacksIDs[node_id] + ' .node .node-status-icon')
			.attr("href", "fonts/" + icon);
		    
		    if ($('#' + jacksIDs[node_id] + ' .node .node-status-icon')
			.data("bs.tooltip")) {
			$('#' + jacksIDs[node_id] + ' .node .node-status-icon')
			    .data("bs.tooltip").options.title = tag;
		    }
		    else {
			$('#' + jacksIDs[node_id] + ' .node .node-status-icon')
			    .tooltip({"title"     : tag,
				      "trigger"   : "hover",
				      "html"      : true,
				      "container" : "body",
				      "placement" : "auto right",
				     });
		    }
		}
		html += "</tbody></table>";

		if ($('#' + jacksIDs[node_id]).data("bs.popover")) {
		    $('#' + jacksIDs[node_id])
			.data("bs.popover").options.content = html;

		    var isVisible = $('#' + jacksIDs[node_id]).
			data('bs.popover').tip().hasClass('in');
		    if (isVisible) {
			$('#' + jacksIDs[node_id])
			    .data('bs.popover').tip()
			    .find('.popover-content').html(html);
		    }
		}
		else {
		    $('#' + jacksIDs[node_id])
			.popover({"content"   : html,
				  "trigger"   : "hover",
				  "html"      : true,
				  "container" : "body",
				  "placement" : "auto",
				 });
		}
	    });
	});
    }

    //
    // Check the status blob to see if any nodes have execute services
    // still running.
    //
    function servicesExecuting(blob)
    {
	if (_.has(blob, "sliverstatus")) {
	    for (var urn in blob.sliverstatus) {
		var nodes = blob.sliverstatus[urn];
		for (var nodeid in nodes) {
		    var status = nodes[nodeid];
		    if (_.has(status, "execute_state") &&
			status.execute_state != "exited") {
			return 1;
		    }
		}
	    }
	}
	return 0;
    }
    function hasExecutionServices(blob)
    {
	if (_.has(blob, "sliverstatus")) {
	    for (var urn in blob.sliverstatus) {
		var nodes = blob.sliverstatus[urn];
		for (var nodeid in nodes) {
		    var status = nodes[nodeid];
		    if (_.has(status, "execute_state")) {
			return 1;
		    }
		}
	    }
	}
	return 0;
    }
	
    //
    // Request a node reboot from the backend cluster.
    //
    function DoReboot(nodeList)
    {
	var callback = function(json) {
	    sup.HideModal('#waitwait-modal');
	    
	    if (json.code) {
		sup.SpitOops("oops", "Failed to reboot: " + json.value);
		return;
	    }
	    // Trigger status to change the nodes.
	    GetStatus();
	}
	sup.ShowModal('#waitwait-modal');
	var xmlthing = sup.CallServerMethod(ajaxurl,
					    "status",
					    "Reboot",
					     {"uuid"     : uuid,
					      "node_ids" : nodeList});
	xmlthing.done(callback);
    }
	
    //
    // Request a node reload from the backend cluster.
    //
    function DoReload(nodeList)
    {
	// Handler for hide modal to unbind the click handler.
	$('#confirm_reload_modal').on('hidden.bs.modal', function (event) {
	    //console.info("reload hide");
	    $(this).unbind(event);
	    $('#confirm_reload_button').unbind("click.reload");
	});
	
	// Throw up a confirmation modal, with handler bound to confirm.
	$('#confirm_reload_button').bind("click.reload", function (event) {
	    sup.HideModal('#confirm_reload_modal');
	    //console.info("Reload confirm");
	    var callback = function(json) {
		sup.HideModal('#waitwait-modal');
	    
		if (json.code) {
		    sup.SpitOops("oops", "Failed to reload: " + json.value);
		    return;
		}
		// Trigger status update.
		GetStatus();
	    }
	    sup.ShowModal('#waitwait-modal');
	    var xmlthing = sup.CallServerMethod(ajaxurl,
						"status",
						"Reload",
						{"uuid"     : uuid,
						 "node_ids" : nodeList});
	    xmlthing.done(callback);
	});
	sup.ShowModal('#confirm_reload_modal');
    }
	
    //
    // Request a node reboot from the backend cluster.
    //
    function DoDeleteNodes(nodeList)
    {
	// Handler for hide modal to unbind the click handler.
	$('#deletenode_modal').on('hidden.bs.modal', function (event) {
	    $(this).unbind(event);
	    $('button#deletenode_confirm').unbind("click.deletenode");
	});
	
	// Throw up a confirmation modal, with handler bound to confirm.
	$('button#deletenode_confirm').bind("click.deletenode", function (event) {
	    sup.HideModal('#deletenode_modal');
	
	    var callback = function(json) {
		console.info(json);
		sup.HideWaitWait();
		
		if (json.code) {
		    sup.SpitOops("oops", "Failed to delete nodes");
		    $('#error_panel_text').text(json.value);
		    $('#error_panel').removeClass("hidden");
		    return;
		}
		changingtopo = true;
		// Trigger status to change the nodes.
		GetStatus();
	    }
	    sup.ShowWaitWait("This will take 30-60 seconds. " +
			     "Patience please.");
	    var xmlthing = sup.CallServerMethod(ajaxurl,
						"status",
						"DeleteNodes",
						{"uuid"     : uuid,
						 "node_ids" : nodeList});
	    xmlthing.done(callback);
	});
	sup.ShowModal('#deletenode_modal');
    }
	
    //
    // Fire up the backend of the ssh tab.
    //
    function StartSSH(id, authobject)
    {
	var jsonauth = $.parseJSON(authobject);
	
	var callback = function(stuff) {
	    console.info(stuff);
            var split   = stuff.split(':');
            var session = split[0];
    	    var port    = split[1];

            var url   = jsonauth.baseurl + ':' + port + '/' + '#' +
		encodeURIComponent(document.location.href) + ',' + session;
            console.info(url);
	    var iwidth = "100%";
            var iheight = 400;

            $('#' + id).html('<iframe id="' + id + '_iframe" ' +
			     'width=' + iwidth + ' ' +
                             'height=' + iheight + ' ' +
                             'src=\'' + url + '\'>');
	    
	    //
	    // Setup a custom event handler so we can kill the connection.
	    //
	    $('#' + id).on("killssh",
			   { "url": jsonauth.baseurl + ':' + port + '/quit' +
			     '?session=' + session },
			   function(e) {
//			       console.info("killssh: " + e.data.url);
			       $.ajax({
     				   url: e.data.url,
				   type: 'GET',
			       });
			   });
	}
	var xmlthing = $.ajax({
	    // the URL for the request
	    url: jsonauth.baseurl + '/d77e8041d1ad',
	    //url: jsonauth.baseurl + '/myshbox',
	    
     	    // the data to send (will be converted to a query string)
	    data: {
		auth: authobject,
	    },
 
 	    // Needs to be a POST to send the auth object.
	    type: 'POST',
 
    	    // Ask for plain text for easier parsing. 
	    dataType : 'text',
	});
	xmlthing.done(callback);
    }

    //
    // User clicked on a node, so we want to create a tab to hold
    // the ssh tab with a panel in it, and then call StartSSH above
    // to get things going.
    //
    var sshtabcounter = 0;
    
    function NewSSHTab(hostport, client_id)
    {
	var pair = hostport.split(":");
	var host = pair[0];
	var port = pair[1];

	//
	// Need to create the tab before we can create the topo, since
	// we need to know the dimensions of the tab.
	//
	var tabname = client_id + "_" + sshtabcounter++ + "_tab";
	console.info(tabname);
	
	if (! $("#" + tabname).length) {
	    // The tab.
	    var html = "<li><a href='#" + tabname + "' data-toggle='tab'>" +
		client_id + "" +
		"<button class='close' type='button' " +
		"        id='" + tabname + "_kill'>x</button>" +
		"</a>" +
		"</li>";	

	    // Append to end of tabs
	    $("#quicktabs_ul").append(html);

	    // Install a click handler for the X button.
	    $("#" + tabname + "_kill").click(function(e) {
		e.preventDefault();
		// Trigger the custom event.
		$("#" + tabname).trigger("killssh");
		// remove the li from the ul.
		$(this).parent().parent().remove();
		// Remove the content div.
		$("#" + tabname).remove();
		// Activate the "profile" tab.
		$('#quicktabs_ul a[href="#profile"]').tab('show');
	    });

	    // The content div.
	    html = "<div class='tab-pane' id='" + tabname + "'></div>";

	    $("#quicktabs_content").append(html);

	    // And make it active
	    $('#quicktabs_ul a:last').tab('show') // Select last tab
	}
	else {
	    // Switch back to it.
	    $('#quicktabs_ul a[href="#' + tabname + '"]').tab('show');
	    return;
	}

	// Ask the server for an authentication object that allows
	// to start an ssh shell.
	var callback = function(json) {
	    console.info(json.value);

	    if (json.code) {
		sup.SpitOops("oops", "Failed to get ssh auth object: " +
			     json.value);
		return;
	    }
	    else {
		StartSSH(tabname, json.value);
	    }
	}
	var xmlthing = sup.CallServerMethod(ajaxurl,
					    "status",
					    "GetSSHAuthObject",
					    {"uuid" : uuid,
					     "hostport" : hostport});
	xmlthing.done(callback);
    }

    var hostportList = {};

    // Remember passwords to show user later. 
    var nodePasswords = {};

    // Per node context menus.
    var contextMenus = {};

    // Global current showing contect menu. Some kind of bug is leaving them
    // around, so keep the last one around so we can try to kill it.
    var currentContextMenu = null;

    //
    // Show a context menu over nodes in the topo viewer.
    //
    function ContextMenuShow(jacksevent)
    {
	// Foreign admins have no permission for anything.
	if (isfadmin) {
	    return;
	}
	var event = jacksevent.event;
	var client_id = jacksevent.client_id;
	var cid = "context-menu-" + client_id;

	if (currentContextMenu) {
	    $('#context').contextmenu('closemenu');
	    $('#context').contextmenu('destroy');
	}
	if (!_.has(contextMenus, client_id)) {
	    return;
	}

	//
	// We generate a new menu object each time causes it easier and
	// not enough overhead to worry about.
	//
	$('#context').contextmenu({
	    target: '#' + cid, 
	    onItem: function(context,e) {
		$('#context').contextmenu('closemenu');
		$('#context').contextmenu('destroy');
		ActionHandler($(e.target).attr("name"), [client_id]);
	    }
	})
	currentContextMenu = cid;
	$('#' + cid).one('hidden.bs.context', function (event) {
	    currentContextMenu = null;
	});
	$('#context').contextmenu('show', event);
    }

    //
    // Common handler for both the context menu and the listview menu.
    //
    function ActionHandler(action, clientList)
    {
	//
	// Do not show in the terminating or terminated state.
	//
	if (lastStatus == "terminated" || lastStatus == "terminating" ||
	    lastStatus == "unknown") {
	    alert("Your experiment is no longer active.");
	    return;
	}

	/*
	 * While shell and console can handle a list, I am not actually
	 * doing that, since its a dubious thing to do, and because the
	 * shellinabox code is not very happy trying to start a bunch all
	 * once. 
	 */
	if (action == "shell") {
	    // Do not want to fire off a whole bunch of ssh commands at once.
	    for (var i = 0; i < clientList.length; i++) {
		(function (i) {
		    setTimeout(function () {
			var client_id = clientList[i];
			NewSSHTab(hostportList[client_id], client_id);
		    }, i * 1500);
		})(i);
	    }
	    return;
	}
	if (isguest) {
	    alert("Only registered users can use the " + action + " command.");
	    return;
	}
	if (action == "console") {
	    // Do not want to fire off a whole bunch of console
	    // commands at once.
	    var haveConsoles = [];
	    for (var i = 0; i < clientList.length; i++) {
		if (_.has(consolenodes, clientList[i])) {
		    haveConsoles.push(clientList[i]);
		}
	    }
	    for (var i = 0; i < haveConsoles.length; i++) {
		(function (i) {
		    setTimeout(function () {
			var client_id = haveConsoles[i];
			NewConsoleTab(client_id);
		    }, i * 1500);
		})(i);
	    }
	    return;
	}
	else if (action == "consolelog") {
	    ConsoleLog(clientList[0]);
	}
	else if (action == "reboot") {
	    DoReboot(clientList);
	}
	else if (action == "delete") {
	    DoDeleteNodes(clientList);
	}
	else if (action == "reload") {
	    DoReload(clientList);
	}
	else if (action == "snapshot") {
	    DoSnapshotNode(clientList[0]);
	}
    }

    // For autostarting ssh on single node experiments.
    var startOneSSH = null;

    function AutoStartSSH()
    {
	if (startOneSSH) {
	    startOneSSH();
	}
    }

    var listview_row = 
	"<tr id='listview-row'>" +
	" <td name='client_id'>n/a</td>" +
	" <td name='node_id'>n/a</td>" +
	" <td name='type'>n/a</td>" +
	" <td name='sshurl'>n/a</td>" +
	" <td align=left><input name='select' type=checkbox>" +
	" <td name='menu' align=center> " +
	"  <div name='action-menu' class='dropdown'>" +
	"  <button id='action-menu-button' type='button' " +
	"          class='btn btn-primary btn-sm dropdown-toggle' " +
	"          data-toggle='dropdown'> " +
	"      <span class='glyphicon glyphicon-cog'></span> " +
	"  </button> " +
	"  <ul class='dropdown-menu text-left' role='menu'> " +
	"    <li><a href='#' name='shell'>Shell</a></li> " +
	"    <li><a href='#' name='console'>Console</a></li> " +
	"    <li><a href='#' name='consolelog'>Console Log</a></li> " +
	"    <li><a href='#' name='snapshot'>Snapshot</a></li> " +
	"    <li><a href='#' name='delete'>Delete Node</a></li> " +
	"  </ul>" +
	"  </div>" +
	" </td>" +
	"</tr>";

    //
    // Show the topology inside the topo container. Called from the status
    // watchdog and the resize wachdog. Replaces the current topo drawing.
    //    
    function ShowTopo(isupdate)
    {
	//console.info("ShowTopo", isupdate);
	
	//
	// Maybe this should come from rspec? Anyway, we might have
	// multiple manifests, but only need to do this once, on any
	// one of the manifests.
	//
	var UpdateInstructions = function(xml,uridata) {
	    var instructionRenderer = new marked.Renderer();
	    instructionRenderer.defaultLink = instructionRenderer.link;
	    instructionRenderer.link = function (href, title, text) {
		var template = UriTemplate.parse(href);
		return this.defaultLink(template.expand(uridata), title, text);
	    };

	    // Suck the instructions out of the tour and put them into
	    // the Usage area.
	    $(xml).find("rspec_tour").each(function() {
		$(this).find("instructions").each(function() {
		    marked.setOptions({ "sanitize" : true,
					"renderer": instructionRenderer });
		
		    var text = $(this).text();
		    // Search the instructions for {host-foo} pattern.
		    var regex   = /\{host-.*\}/gi;
		    var needed  = text.match(regex);
		    if (needed && needed.length) {
			_.each(uridata, function(host, key) {
			    regex = new RegExp("\{" + key + "\}", "gi");
			    text = text.replace(regex, host);
			});
		    }
		    // Stick the text in
		    $('#instructions_text').html(marked(text));
		    // Make the div visible.
		    $('#instructions_panel').removeClass("hidden");
		    
		});
	    });
	}

	//
	// Process the nodes in a single manifest.
	//
	var ProcessNodes = function(aggregate_urn, xml) {
	    // Find all of the nodes, and put them into the list tab.
	    // Clear current table.
	    $(xml).find("node, emulab\\:vhost").each(function() {
		// Only nodes that match the aggregate being processed,
		// since we send the same rspec to every aggregate.
		var manager_urn = $(this).attr("component_manager_id");
		if (!manager_urn.length || manager_urn != aggregate_urn) {
		    return;
		}
		var tag    = $(this).prop("tagName");
		var isvhost= (tag == "emulab:vhost" ? 1 : 0);
		var node   = $(this).attr("client_id");
		var stype  = $(this).find("sliver_type");
		var login  = $(this).find("login");
		var coninfo= this.getElementsByTagNameNS(EMULAB_NS, 'console');
		var vnode  = this.getElementsByTagNameNS(EMULAB_NS, 'vnode');
		var href   = "n/a";
		var ssh    = "n/a";
		var cons   = "n/a";
		var clone  = $(listview_row);
		// Cause of nodes in the emulab namespace (vhost).
		if (!login.length) {
		    login = this.getElementsByTagNameNS(EMULAB_NS, 'login');
		}

		// Change the ID of the clone so its unique.
		clone.attr('id', 'listview-row-' + node);
		// Insert into the table, we will attach the handlers below.
		$('#listview_table > tbody:last').append(clone);
		// Set the client_id in the first column.
		$('#listview-row-' + node + " [name=client_id]").html(node);
		// And the node_id/type
		if (vnode.length) {
		    $('#listview-row-' + node + " [name=node_id]")
			.html($(vnode).attr("name"));
		    $('#listview-row-' + node + " [name=type]")
			.html($(vnode).attr("hardware_type"));
		}
		// Convenience.
		$('#listview-row-' + node + " [name=select]").attr("id", node);

		if (stype.length &&
		    $(stype).attr("name") === "emulab-blockstore") {
		    $('#listview-row-' + node + " [name=menu]").text("n/a");
		    return;
		}
		
		if (login.length && dossh) {
		    var user   = window.APT_OPTIONS.thisUid;
		    var host   = $(login).attr("hostname");
		    var port   = $(login).attr("port");
		    var url    = "ssh://" + user + "@" + host + ":" + port +"/";
		    var sshcmd = "ssh -p " + port + " " + user + "@" + host;
		    href       = "<a href='" + url + "'><kbd>" + sshcmd +
			"</kbd></a>";
		
		    var hostport  = host + ":" + port;
		    hostportList[node] = hostport;

		    // Update the row.
		    $('#listview-row-' + node + ' [name=sshurl]').html(href);
		    
		    // Attach handler to the menu button.
		    $('#listview-row-' + node + ' [name=shell]')
			.click(function (e) {
			    e.preventDefault();
			    ActionHandler("shell", [node]);
			    return false;
			});		    
		}

		//
		// Foreign admins do not get a menu, but easier to just
		// hide it.
		//
		if (isfadmin) {
		    $('#listview-row-' + node + ' [name=action-menu]')
			.addClass("invisible");
		}

		//
		// Now a handler for the console action.
		//
		if (coninfo.length) {
		    // Attach handler to the menu button.
		    $('#listview-row-' + node + ' [name=console]')
			.click(function (e) {
			    ActionHandler("console", [node]);
			});
		    $('#listview-row-' + node + ' [name=consolelog]')
			.click(function (e) {
			    ActionHandler("consolelog", [node]);
			});
		    // Remember we have a console, for the context menu.
		    consolenodes[node] = node;
		}
		else {
		    // Need to do this on the context menu too, but painful.
		    $('#listview-row-' + node + ' [name=consolelog]')
			.parent().addClass('disabled');		    
		    $('#listview-row-' + node + ' [name=console]')
			.parent().addClass('disabled');		    
		}
		if (!isvhost) {
		    //
		    // And a handler for the snapshot action.
		    //
		    $('#listview-row-' + node + ' [name=snapshot]')
			.click(function (e) {
			    ActionHandler("snapshot", [node]);
			});
		    //
		    // Ditto the delete button,
		    //
		    $('#listview-row-' + node + ' [name=delete]')
			.click(function (e) {
			    ActionHandler("delete", [node]);
			});
		}
		else {
		    // Need to do this on the context menu too, but painful.
		    $('#listview-row-' + node + ' [name=snapshot]')
			.parent().addClass('disabled');		    
		    $('#listview-row-' + node + ' [name=delete]')
			.parent().addClass('disabled');		    
		}

		/*
		 * Make a copy of the master context menu and init.
		 */
		var clone = $("#context-menu").clone();

		// Change the ID of the clone so its unique.
		clone.attr('id', "context-menu-" + node);
	    
		// Insert into the context-menus div.
		$('#context-menus').append(clone);

		// If no console, then grey out the options.
		if (!_.has(consolenodes, node)) {
		    $(clone).find("li[id=console]").addClass("disabled");
		    $(clone).find("li[id=consolelog]").addClass("disabled");
		}
		// If a vhost, then grey out options.
		if (isvhost) {
		    $(clone).find("li[id=snapshot]").addClass("disabled");
		    $(clone).find("li[id=delete]").addClass("disabled");
		}
		contextMenus[node] = clone;
		
		nodecount++;
	    });
	}
	
	var callback = function(json) {
	    //console.info(json);

	    // Pass all the manifests to the viewer.
	    $("#showtopo_container").removeClass("invisible");
	    $('#quicktabs_ul a[href="#profile"]').tab('show');
	    ShowViewer('#showtopo_statuspage', json.value);

	    // Process all the manifests to create the list view.
	    // Clear the list view table before adding nodes. Not needed?
            $('#listview_table > tbody').html("");

	    // Save off some templatizing data as we process each manifest.
	    var uridata = {};
	    
	    // Save off the last manifest xml blob so we quick process the
	    // possibly templatized instructions quickly, without reparsing the
	    // manifest again needlessly.
	    var xml = null;

	    _.each(json.value, function(manifest, aggregate_urn) {
		var xmlDoc = $.parseXML(manifest);
		xml = $(xmlDoc);

		MakeUriData(xml,uridata);
		ProcessNodes(aggregate_urn, xml);
	    });

	    // Handler for select/deselect all rows in the list view.
	    if (!isupdate) {
		$('#select-all').change(function () {
		    if ($(this).prop("checked")) {
			$('#listview_table [name=select]')
			    .prop("checked", true);
		    }
		    else {
			$('#listview_table [name=select]')
			    .prop("checked", false);
		    }
		});
	    }
	    
	    //
	    // Handler for the action menu next to the select mention above.
	    // Foreign admins do not get a menu, but easier to just hide it.
	    //
	    if (isfadmin) {
		$('#listview-action-menu').addClass("invisible");
	    }
	    else {
		$('#listview-action-menu li a')
		    .click(function (e) {
			var checked = [];

			// Get the list of checked nodes.
			$('#listview_table [name=select]').each(function() {
			    if ($(this).prop("checked")) {
				checked.push($(this).attr("id"));
			    }
			});
			if (checked.length) {
			    ActionHandler($(e.target).attr("name"), checked);
			}
		    });
	    }
	    
	    if (xml != null) {
		UpdateInstructions(xml,uridata);
		// Do not show secrets if viewing using foreign admin creds
		if (!isfadmin) {
		    FindEncryptionBlocks(xml);
		}

		/*
		 * No point in showing linktest if no links at any site.
		 * For the moment, we do not count links if they span sites
		 * since linktest does not work across stitched links.
		 *
		 * We reset showlinktest cause we get called again after
		 * a deletenode.
		 */
		showlinktest = false;
		$(xml).find("link").each(function() {
		    var managers = $(this).find("component_manager");
		    if (managers.length == 1)
			showlinktest = true;
		});
		SetupLinktest(instanceStatus);
	    }

	    /*
	     * If a single node, show the clone button and maybe the
	     * the snapshot; the user must own the profile it was
	     * created from in order to do a snapshot.
	     */
	    if (nodecount == 1) {
		if (window.APT_OPTIONS.canclone) {
		    $("#clone_button").removeClass("hidden");
		}
		if (window.APT_OPTIONS.cansnap) {
		    $("#snapshot_button").removeClass("hidden");
		}
	    }

	    // Bind a function to start up ssh for one node topologies.
	    if (nodecount == 1 && !oneonly && dossh) {
		startOneSSH = function () {
		    var nodename = Object.keys(hostportList)[0];
		    var hostport = hostportList[nodename];
		    NewSSHTab(hostport, nodename);
		};
	    }
	    
	    // There is enough asynchrony that we have to watch for the
	    // case that we went ready before we got this done, and so the
	    // buttons won't be correct.
	    if (lastStatus == "ready") {
		EnableButtons();
	    }
	}
	var xmlthing = sup.CallServerMethod(ajaxurl,
					    "status",
					    "GetInstanceManifest",
					    {"uuid" : uuid});
	xmlthing.done(callback);
    }

    //
    // Show the manifest in the tab, using codemirror.
    //
    function ShowManifest(manifest)
    {
	var mode   = "text/xml";

	$("#manifest_textarea").css("height", "300");
	$('#manifest_textarea .CodeMirror').remove();

	var myCodeMirror = CodeMirror(function(elt) {
	    $('#manifest_textarea').prepend(elt);
	}, {
	    value: manifest,
            lineNumbers: false,
	    smartIndent: true,
            mode: mode,
	    readOnly: true,
	});

	$('#show_manifest_tab').on('shown.bs.tab', function (e) {
	    myCodeMirror.refresh();
	});
    }

    function MakeUriData(xml,uridata)
    {
	xml.find('node').each(function () {
	    var node = $(this);
	    var host = node.find('host').attr('name');
	    if (host) {
		var key = 'host-' + node.attr('client_id');
		uridata[key] = host;
	    }
	});
    }

    function FindEncryptionBlocks(xml)
    {
	var blocks    = {};
	var passwords = xml[0].getElementsByTagNameNS(EMULAB_NS, 'password');

	// Search the instructions for the pattern.
	var regex   = /\{password-.*\}/gi;
	var needed  = $('#instructions_text').html().match(regex);
	//console.log(needed);

	if (!needed || !needed.length)
	    return;

	// Look for all the encryption blocks in the manifest ...
	_.each(passwords, function (password) {
	    var name  = $(password).attr('name');
	    var stuff = $(password).text();
	    var key   = 'password-' + name;

	    // ... and see if we referenced it in the instructions.
	    _.each(needed, function(match) {
		var token = match.slice(1,-1);
		
		if (token == key) {
		    blocks[key] = stuff;
		}
	    });
	});
	// These are blocks that are referenced in the instructions
	// and need the server to decrypt.  At some point we might
	// want to do that here in javascript, but maybe later.
	//console.log(blocks);

	var callback = function(json) {
	    //console.log(json);
	    if (json.code) {
		sup.SpitOops("oops", "Could not decrypt secrets: " +
			     json.value);
		return;
	    }
	    var itext = $('#instructions_text').html();

	    _.each(json.value, function(plaintext, key) {
		key = "{" + key + "}";
		// replace in the instructions text.
		itext = itext.replace(key, plaintext);
	    });
	    // Write the instructions back after replacing patterns
	    $('#instructions_text').html(itext);
	};
    	var xmlthing = sup.CallServerMethod(ajaxurl,
					    "status",
					    "DecryptBlocks",
					    {"uuid"   : uuid,
					     "blocks" : blocks});
	xmlthing.done(callback);
    }

    function ShowProgressModal()
    {
        ShowImagingModal(
		         function()
			 {
			     return sup.CallServerMethod(ajaxurl,
							 "status",
							 "SnapshotStatus",
							 {"uuid" : uuid});
			 },
			 function(failed)
			 {
			     if (failed) {
				 EnableButtons();
			     }
			     else {
				 EnableButtons();
			     }
			 });
    }

    //
    // Request to start a snapshot. This assumes a single node of course.
    //
    function StartSnapshot(node_id, update_profile, update_prepare, imagename)
    {
	sup.ShowModal('#waitwait-modal');

	var callback = function(json) {
	    sup.HideModal('#waitwait-modal');
	    //console.log("StartSnapshot");
	    //console.log(json);
	    
	    if (json.code) {
		sup.SpitOops("oops", "Could not start snapshot: " + json.value);
		return;
	    }
	    ShowProgressModal();
	}
	var args = {"uuid" : uuid,
		    "update_profile" : update_profile,
		    "update_prepare" : update_prepare};
	if (node_id !== undefined) {
	    args["node_id"] = node_id;
	}
	if (imagename && imagename != "") {
	    args["imagename"] = imagename;
	}
	var xmlthing =
	    sup.CallServerMethod(ajaxurl, "status", "SnapShot", args);
	xmlthing.done(callback);
    }

    //
    // This is for snapshot of a single node profile, or a specific
    // node in a multi-node profile.
    //
    function DoSnapshotNode(node_id)
    {
	// Do not allow snapshot if the experiment is not in the ready state.
	if (lastStatus != "ready") {
	    alert("Experiment is not ready yet, snapshot not allowed");
	    return;
	}
	
	// Default to update unless checkbox says otherwise.
	var update_profile = 1;
	var update_prepare = 0;
	var imagename      = null;

	// Default to unchecked any time we show the modal.
	$('#snapshot_update_prepare').prop("checked", false);
	
	//
	// Snapshot specific node from the context menu. We give the
	// the user some extra options in confirm modal.
	//
	if (node_id) {
	    // Default to checked any time we show the modal.
	    $('#snapshot_update_profile').prop("checked", true);
	    if (ispprofile) {
		$('#snapshot_update_profile_div').addClass("hidden");
		$('#snapshot_update_script_div').removeClass("hidden");
	    }
	    else {
		$('#snapshot_update_profile_div').removeClass("hidden");
		$('#snapshot_update_script_div').addClass("hidden");
	    }
	    if (isadmin || isstud) {
		$('#snapshot_modal #nameyourimage_div').removeClass("hidden");
	    }
	}
	else {
	    $('#snapshot_update_profile_div').addClass("hidden");
	    if (ispprofile) {
		$('#snapshot_update_script_div').removeClass("hidden");
	    }
	}
	sup.ShowModal('#snapshot_modal');

	// Handler for the Snapshot confirm button.
	$('button#snapshot_confirm').bind("click.snapshot", function (event) {
	    event.preventDefault();
	    $('button#snapshot_confirm').unbind("click.snapshot");
	    if (node_id) {
		update_profile = 
		    $('#snapshot_update_profile').is(':checked') ? 1 : 0;
	    }
	    if ($('#snapshot_update_prepare').is(':checked')) {
		update_prepare = 1;
	    }
	    if ($('#snapshot_modal #nameyourimage_name').val() != "") {
		imagename = $('#snapshot_modal #nameyourimage_name').val();
	    }
	    sup.HideModal('#snapshot_modal');
	    StartSnapshot(node_id, update_profile, update_prepare, imagename);
	});

	// Handler for hide modal to unbind the click handler.
	$('#snapshot_modal').on('hidden.bs.modal', function (event) {
	    $(this).unbind(event);
	    $('button#snapshot_confirm').unbind("click.snapshot");
	});
    }

    //
    // User clicked on a node, so we want to create a tab to hold
    // the ssh tab with a panel in it, and then call StartSSH above
    // to get things going.
    //
    function NewConsoleTab(client_id)
    {
	sup.ShowModal('#waitwait-modal');

	var callback = function(json) {
	    sup.HideModal('#waitwait-modal');
	    
	    if (json.code) {
		sup.SpitOops("oops", "Could not start console: " + json.value);
		return;
	    }
	    var url = json.value.url + '&noclose=1';

	    if (_.has(json.value, "password")) {
		nodePasswords[client_id] = json.value.password;
	    }
	    
	    //
	    // Need to create the tab before we can create the topo, since
	    // we need to know the dimensions of the tab.
	    //
	    var tabname = client_id + "console_tab";
	    if (! $("#" + tabname).length) {
		// The tab.
		var html = "<li><a href='#" + tabname + "' data-toggle='tab'>" +
		    client_id + "-Cons" +
		    "<button class='close' type='button' " +
		    "        id='" + tabname + "_kill'>x</button>" +
		    "</a>" +
		    "</li>";	

		// Append to end of tabs
		$("#quicktabs_ul").append(html);

		// Install a kill click handler for the X button.
		$("#" + tabname + "_kill").click(function(e) {
		    e.preventDefault();
		    // remove the li from the ul. this=ul.li.a.button
		    $(this).parent().parent().remove();
		    // Activate the "profile" tab.
		    $('#quicktabs_ul li a:first').tab('show');
		    // Trigger the custom event.
		    $("#" + tabname).trigger("killconsole");
		    // Remove the content div. Have to delay this though.
		    // See below.
		    setTimeout(function(){
			$("#" + tabname).remove() }, 3000);
		});

		// The content div.
		html = "<div class='tab-pane' id='" + tabname + "'></div>";

		$("#quicktabs_content").append(html);

		// And make it active
		$('#quicktabs_ul a:last').tab('show') // Select last tab

		// Now create the console iframe inside the new tab
		var iwidth = "100%";
		var iheight = 400;
		
		var html = '<iframe id="' + tabname + '_iframe" ' +
		    'width=' + iwidth + ' ' +
		    'height=' + iheight + ' ' +
		    'src=\'' + url + '\'>';
	    
		if (_.has(json.value, "password")) {
		    html =
			"<div class='col-sm-4 col-sm-offset-4 text-center'>" +
			" <small> " +
			" <a data-toggle='collapse' " +
			"    href='#password_" + tabname + "'>Password" +
			"   </a></small> " +
			" <div id='password_" + tabname + "' " +
			"      class='collapse'> " +
			"  <div class='well well-xs'>" +
			nodePasswords[client_id] +
			"  </div> " +
			" </div> " +
			"</div> " + html;
		}		
		$('#' + tabname).html(html);

		//
		// Setup a custom event handler so we can kill the connection.
		// Called from the kill click handler above.
		//
		// Post a kill message to the iframe. See nodetipacl.php3.
		// Since postmessage is async, we have to wait before we
		// can actually kill the content div with the iframe, cause
		// its gone before the message is delivered. Just delay a
		// couple of seconds. Maybe add a reply message later. The
		// delay is above.
		//
		// In firefox, nodetipacl.php3 does not install a handler,
		// so now the shellinabox code has that handler, and so this
		// gets posted to the box directly. Oh well, so much for
		// trying to stay out of the box code.
		//
		var sendkillmessage = function (event) {
		    var iframe = $('#' + tabname + '_iframe')[0];
		    iframe.contentWindow.postMessage("kill", "*");
		};
		// This is the handler for the button, which invokes
		// the function above.
		$('#' + tabname).on("killconsole", sendkillmessage);
	    }
	    else {
		// Switch back to it.
		$('#quicktabs_ul a[href="#' + tabname + '"]').tab('show');
		return;
	    }
	}
	var xmlthing = sup.CallServerMethod(ajaxurl,
					    "status",
					    "ConsoleURL",
					    {"uuid" : uuid,
					     "node" : client_id});
	xmlthing.done(callback);
    }

    //
    // Console log. We get the url and open up a new tab.
    //
    function ConsoleLog(client_id)
    {
	// Avoid popup blockers by creating the window right away.
	var spinner = 'https://' + window.location.host + '/images/spinner.gif';
	var win = window.open("", '_blank');
	win.document.write("<center><span style='font-size:30px'>" +
			   "Please wait ... </span>" +
			   "<img src='" + spinner + "'/></center>");
	
	sup.ShowModal('#waitwait-modal');

	var callback = function(json) {
	    sup.HideModal('#waitwait-modal');
	    
	    if (json.code) {
		win.close();
		sup.SpitOops("oops", "Could not get log: " + json.value);
		return;
	    }
	    var url   = json.value.logurl;
	    win.location = url;
	    win.focus();
	}
	var xmlthing = sup.CallServerMethod(ajaxurl,
					    "status",
					    "ConsoleURL",
					    {"uuid" : uuid,
					     "node" : client_id});
	xmlthing.done(callback);
    }

    var jacksInstance;
    var jacksInput;
    var jacksOutput;
    var jacksRspecs;

    function ShowViewer(divname, manifest_object)
    {
	var manifests       = _.values(manifest_object);
	var first_manifest  = _.first(manifests);
	var rest            = _.rest(manifests);
	var multisite       = rest.length ? true : false;
	
	if (! jacksInstance)
	{
	    jacksInstance = new window.Jacks({
		mode: 'viewer',
		source: 'rspec',
		multiSite: multisite,
		root: divname,
		nodeSelect: false,
		readyCallback: function (input, output) {
		    jacksInput = input;
		    jacksOutput = output;

		    jacksOutput.on('modified-topology', function (object) {
			//console.log(object);
			_.each(object.nodes, function (node) {
			    jacksIDs[node.client_id] = node.id;
			});
			//console.log("jacksIDs");
			console.log(jacksIDs);
			ShowManifest(object.rspec);
		    });
		
		    jacksInput.trigger('change-topology',
				       [{ rspec: first_manifest }]);

		    if (rest.length) {
			_.each(rest, function(manifest) {
			    jacksInput.trigger('add-topology',
					       [{ rspec: manifest }]);
			});
		    }

		    jacksOutput.on('click-event', function (jacksevent) {
			if (jacksevent.type === 'node' ||
			    jacksevent.type === 'host') {
			    console.log(jacksevent);
			    ContextMenuShow(jacksevent);
			}
		    });
		},
	        canvasOptions: {
	    "aggregates": [
	      {
		"id": "urn:publicid:IDN+utah.cloudlab.us+authority+cm",
		"name": "Cloudlab Utah"
	      },
	      {
		"id": "urn:publicid:IDN+wisc.cloudlab.us+authority+cm",
		"name": "Cloudlab Wisconsin"
	      },
	      {
		"id": "urn:publicid:IDN+clemson.cloudlab.us+authority+cm",
		"name": "Cloudlab Clemson"
	      },
	      {
		"id": "urn:publicid:IDN+utahddc.geniracks.net+authority+cm",
		"name": "IG UtahDDC"
	      },
	      {
		"id": "urn:publicid:IDN+apt.emulab.net+authority+cm",
		"name": "APT Utah"
	      },
	      {
		"id": "urn:publicid:IDN+emulab.net+authority+cm",
		"name": "Emulab"
	      },
	      {
		"id": "urn:publicid:IDN+wall2.ilabt.iminds.be+authority+cm",
		"name": "iMinds Virt Wall 2"
	      },
	      {
		"id": "urn:publicid:IDN+uky.emulab.net+authority+cm",
		"name": "UKY Emulab"
	      }
	    ]
		},
		show: {
		    rspec: false,
		    tour: false,
		    version: false,
		    selectInfo: false,
		    menu: false
		}
            });
	}
	else if (jacksInput)
	{
	    jacksInput.trigger('change-topology',
			       [{ rspec: first_manifest }]);

	    if (rest.length) {
		_.each(rest, function(manifest) {
		    jacksInput.trigger('add-topology',
				       [{ rspec: manifest }]);
		});
	    }
	}
    }

    function ShowSliverInfo(urls)
    {
	if (!publicURLs) {
	    $('#sliverinfo_dropdown').change(function (event) {
		var selected =
		    $('#sliverinfo_dropdown select option:selected').val();
		console.info(selected);

		// Find the URL
		_.each(publicURLs, function(obj) {
		    var url  = obj.url;
		    var name = obj.name;

		    if (name == selected) {
			$("#sliverinfo_dropdown a").attr("href", url);
		    }
		});
	    });
	}
	// URLs change over time.
	publicURLs = urls;
	if (urls.length == 0) {
	    return;
	}
	if (urls.length == 1) {
	    $("#sliverinfo_button").attr("href", urls[0].url);
	    $("#sliverinfo_button").removeClass("hidden");
	    $("#sliverinfo_dropdown").addClass("hidden");
	    return;
	}
	// Selection list.
	_.each(urls, function(obj) {
	    var url  = obj.url;
	    var name = obj.name;

	    // Add only once of course
	    var option = $('#sliverinfo_dropdown select option[value="' +
			   name + '"]');
	    
	    if (! option.length) {
		$("#sliverinfo_dropdown select").append(
		    "<option value='" + name + "'>" + name + "</option>");
	    }
	});
	$("#sliverinfo_button").addClass("hidden");
	$("#sliverinfo_dropdown").removeClass("hidden");
    }

    function ShowLogfile(url)
    {
	// URLs change over time.
	$("#logfile_button").attr("href", url);
	$("#logfile_button").removeClass("hidden");
    }

    //
    // Create a new tab to show linktest results. Cause of multisite, there
    // can be more then one. 
    //
    function NewLinktestTab(name, results, url)
    {
	// Replace spaces with underscore. Silly. 
	var site = name.split(' ').join('_');
	    
	//
	// Need to create the tab before we can create the topo, since
	// we need to know the dimensions of the tab.
	//
	var tabname = site + "_linktest";
	if (! $("#" + tabname).length) {
	    // The tab.
	    var html = "<li><a href='#" + tabname + "' data-toggle='tab'>" +
		name + "" +
		"<button class='close' type='button' " +
		"        id='" + tabname + "_kill'>x</button>" +
		"</a>" +
		"</li>";	

	    // Append to end of tabs
	    $("#quicktabs_ul").append(html);

	    // Install a click handler for the X button.
	    $("#" + tabname + "_kill").click(function(e) {
		e.preventDefault();
		// remove the li from the ul.
		$(this).parent().parent().remove();
		// Remove the content div.
		$("#" + tabname).remove();
		// Activate the "profile" tab.
		$('#quicktabs_ul a[href="#profile"]').tab('show');
	    });

	    // The content div.
	    html = "<div class='tab-pane' id='" + tabname + "'></div>";

	    // Add the tab content wrapper to the DOM,
	    $("#quicktabs_content").append(html);

	    // And make it active
	    $('#quicktabs_ul a:last').tab('show') // Select last tab
	}
	else {
	    // Switch back to it.
	    $('#quicktabs_ul a[href="#' + tabname + '"]').tab('show');
	}

	//
	// Inside tab content is either the results or an iframe to
	// spew the the log file.
	//
	var html;
	
	if (results) {
	    html = "<div style='overflow-y: scroll;'><pre>" +
		results + "</pre></div>";
	}
	else if (url) {
	    // Create the iframe inside the new tab
	    var iwidth = "100%";
	    var iheight = 400;
		
	    html = '<iframe id="' + tabname + '_iframe" ' +
		'width=' + iwidth + ' ' +
		'height=' + iheight + ' ' +
		'src=\'' + url + '\'>';
	}		
	$('#' + tabname).html(html);
    }

    //
    // Linktest support.
    //
    var linktestsetup = 0;
    function SetupLinktest(status) {
	if (hidelinktest || !showlinktest) {
	    // We might remove a node that removes last link.
	    return ToggleLinktestButtons(status);
	}
	if (linktestsetup) {
	    return ToggleLinktestButtons(status);
	}

        linktestsetup = 1;
        var md = templates['linktest-md'];
        $('#linktest-help').html(marked(md));

	// Handler for the linktest modal button
	$('button#linktest-modal-button').click(function (event) {
	    event.preventDefault();
	    // Make the popover go away when button clicked. 
	    $('button#linktest-modal-button').popover('hide');
	    sup.ShowModal('#linktest-modal');
	});
	// And for the start button in the modal.
	$('button#linktest-start-button').click(function (event) {
	    event.preventDefault();
	    StartLinktest();
	});
	// Stop button for a running or wedged linktest.
	$('button#linktest-stop-button').click(function (event) {
	    event.preventDefault();
	    // Gack, we have to confirm popover hidden, or it sticks around.
	    // Probably cause we disable the button before popover is hidden?
	    $('button#linktest-stop-button')
		.one('hidden.bs.popover', function (event) {
		    StopLinktest();		    
		});
	    $('button#linktest-stop-button').popover('hide');
	});
	ToggleLinktestButtons(status);
    }
    function ToggleLinktestButtons(status) {
	if (hidelinktest || !showlinktest) {
	    $('#linktest-modal-button').addClass("hidden");
	    DisableButton("start-linktest");
	    return;
	}
	if (status == "ready") {
	    $('#linktest-stop-button').addClass("hidden");
	    $('#linktest-modal-button').removeClass("hidden");
	    EnableButton("start-linktest");
	    DisableButton("stop-linktest");
	}
	else if (status == "linktest") {
	    DisableButton("start-linktest");
	    EnableButton("stop-linktest");
	    $('#linktest-modal-button').addClass("hidden");
	    $('#linktest-stop-button').removeClass("hidden");
	}
	else {
	    DisableButton("start-linktest");
	}
    }

    //
    // Fire off linktest and put results into tabs.
    //
    function StartLinktest() {
	sup.HideModal('#linktest-modal');
	var level = $('#linktest-level option:selected').val();
	
	var callback = function(json) {
	    console.log("Linktest Startup");
	    console.log(json);

	    sup.HideWaitWait();
	    statusHold = 0;
	    GetStatus();
	    if (json.code) {
		sup.SpitOops("oops", "Could not start linktest: " + json.value);
		EnableButton("start-linktest");
		return;
	    }
	    $.each(json.value , function(site, details) {
		var name = "Linktest";
		if (Object.keys(json.value).length > 1) {
		    name = name + " " + site;
		}
		
		if (details.status == "stopped") {
		    //
		    // We have the output right away.
		    //
		    NewLinktestTab(name, details.results, null);
		}
		else {
		    NewLinktestTab(name, null, details.url);
		}
	    });
	};
	statusHold = 1;
	DisableButton("start-linktest");
	sup.ShowWaitWait("We are starting linktest ... patience please");
    	var xmlthing = sup.CallServerMethod(null,
					    "status",
					    "LinktestControl",
					    {"action" : "start",
					     "level"  : level,
					     "uuid" : uuid});
	xmlthing.done(callback);
    }

    //
    // Stop a running linktest.
    //
    function StopLinktest() {
	// If linktest completed, we will not be in the linktest state,
	// so nothing to stop. But if the user killed the tab while it
	// is still running, we will want to stop it.
	if (instanceStatus != "linktest")
	    return;
	
	var callback = function(json) {
	    sup.HideWaitWait();
	    statusHold = 0;
	    GetStatus();
	    if (json.code) {
		sup.SpitOops("oops", "Could not stop linktest: " + json.value);
		EnableButton("stop-linktest");
		return;
	    }
	};
	statusHold = 1;
	DisableButton("stop-linktest");
	sup.ShowWaitWait("We are shutting down linktest ... patience please");
    	var xmlthing = sup.CallServerMethod(null,
					    "status",
					    "LinktestControl",
					    {"action" : "stop",
					     "uuid" : uuid});
	xmlthing.done(callback);
    }

    function ProgressBarUpdate()
    {
	//
	// Look at initial status to determine if we show the progress bar.
	//
	var spinwidth = null;
	
	if (instanceStatus == "created" ||
	    instanceStatus == "provisioning" ||
	    instanceStatus == "stitching") {
	    spinwidth = "33";
	}
	else if (instanceStatus == "provisioned") {
	    spinwidth = "66";
	}
	else if (instanceStatus == "ready" || instanceStatus == "failed") {
	    spinwidth = null;
	}
	if (spinwidth) {
	    $('#profile_status_collapse').collapse("show");
	    $('#status_progress_outerdiv').removeClass("hidden");
	    $("#status_progress_bar").width(spinwidth + "%");	
	    $("#status_progress_div").addClass("progress-striped");
	    $("#status_progress_div").removeClass("progress-bar-success");
	    $("#status_progress_div").removeClass("progress-bar-danger");
	    $("#status_progress_div").addClass("active");
	}
	else {
	    if (! $('#status_progress_outerdiv').hasClass("hidden")) {
		$("#status_progress_div").removeClass("progress-striped");
		$("#status_progress_div").removeClass("active");
		if (instanceStatus == "ready") {
		    $("#status_progress_div").addClass("progress-bar-success");
		}
		else {
		    $("#status_progress_div").addClass("progress-bar-danger");
		}
		$("#status_progress_bar").width("100%");
	    }
	}
    }

    function ShowExtensionDeniedModal()
    {
	if ($('#extension_denied_reason').length) {
	    $("#extension-denied-modal-reason")
		.text($('#extension_denied_reason').text());
	}
	$('#extension-denied-modal-dismiss').click(function () {
	    sup.HideModal("#extension-denied-modal");
	    var callback = function(json) {
		if (json.code) {
		    console.info("Could not dismsss: " + json.value);
		    return;
		}
	    };
	    var xmlthing =
		sup.CallServerMethod(null, "status", "dismissExtensionDenied",
				     {"uuid" : uuid});
	    xmlthing.done(callback);
	});
	sup.ShowModal("#extension-denied-modal");
    }

    //
    // Show the openstack tab.
    //
    function ShowOpenstackTab()
    {
	if (! $('#show_openstack_li').hasClass("hidden")) {
	    return;
	}
	$('#show_openstack_li').removeClass("hidden");
	$("#Openstack").removeClass("hidden");

	/*
	 * We cannot draw the graphs until the tab is actually visible,
	 * D3 cannot handle drawing if there is no actual space allocated.
	 * So lets just wait till the user clicks on the tab. 
	 */
	var handler = function () {
	    $('#show_openstack_tab').off("shown.bs.tab", handler);
	    LoadOpenstackTab();
	};
	$('#show_openstack_tab').on("shown.bs.tab", handler);
    }

    //
    // Load the openstack tab.
    //
    function LoadOpenstackTab()
    {
	if ($('#show_openstack_li').hasClass("hidden")) {
	    return;
	}
	/*
	 * This callback is to let us know if there is any actual data.
	 */
	var callback = function (gotdata) {
	    if (!gotdata) {
		$('#Openstack #nodata').removeClass("hidden");
	    }
	};
	ShowOpenstackGraphs({"uuid"      : uuid,
			     "divID"     : '#openstack-div',
			     "refreshID" : '#openstack-refresh-button',
			     "callback"  : callback});
    }

    //
    // Slothd graphs. The tab already exists but is invisible (not hidden).
    //
    function ShowIdleDataTab()
    {
	if (! $('#show_idlegraphs_li').hasClass("hidden")) {
	    return;
	}
	$('#show_idlegraphs_li').removeClass("hidden");
	$("#Idlegraphs").removeClass("hidden");

	/*
	 * We cannot draw the graphs until the tab is actually visible,
	 * D3 cannot handle drawing if there is no actual space allocated.
	 * So lets just wait till the user clicks on the tab. 
	 */
	var handler = function () {
	    $('#show_idlegraphs_tab').off("shown.bs.tab", handler);
	    LoadIdleData();
	};
	$('#show_idlegraphs_tab').on("shown.bs.tab", handler);
    }

    function LoadIdleData()
    {
	/*
	 * This callback is to let us know if there is any actual data.
	 */
	var callback = function (gotdata) {
	    if (!gotdata) {
		$('#Idlegraphs #nodata').removeClass("hidden");
	    }
	};
	ShowIdleGraphs({"uuid"     : uuid,
			"showwait" : true,
			"loadID"   : "#loadavg-panel-div",
			"ctrlID"   : "#ctrl-traffic-panel-div",
			"exptID"   : "#expt-traffic-panel-div",
			"refreshID": "#graphs-refresh-button",
			"callback" : callback});
    }

    // Helper.
    function decodejson(id) {
	return JSON.parse(_.unescape($(id)[0].textContent));
    }
    
    $(document).ready(initialize);
});
