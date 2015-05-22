require(window.APT_OPTIONS.configObject,
	['underscore', 'js/quickvm_sup', 'moment',
	 'marked', 'js/lib/uritemplate', 'js/image', 'js/extend',
	 'js/lib/text!template/status.html',
	 'js/lib/text!template/waitwait-modal.html',
	 'js/lib/text!template/oops-modal.html',
	 'js/lib/text!template/register-modal.html',
	 'js/lib/text!template/terminate-modal.html',
	 'js/lib/text!template/clone-help.html',
	 'js/lib/text!template/snapshot-help.html',
	 'js/lib/text!template/oneonly-modal.html',
	 'js/lib/text!template/approval-modal.html',
	 'contextmenu'],
function (_, sup, moment, marked, UriTemplate, ShowImagingModal,
	  ShowExtendModal, statusString, waitwaitString, oopsString,
	  registerString, terminateString,
	  cloneHelpString, snapshotHelpString, oneonlyString, approvalString)
{
    'use strict';
    var nodecount   = 0;
    var ajaxurl     = null;
    var uuid        = null;
    var oneonly     = 0;
    var isadmin     = 0;
    var isguest     = 0;
    var dossh       = 1;
    var profile_uuid= null;
    var extend      = null;
    var jacksIDs    = {};
    var status_collapsed  = false;
    var status_message    = "";
    var statusTemplate    = _.template(statusString);
    var terminateTemplate = _.template(terminateString);
    var lastStatus        = "";
    var lockout           = 0;
    var lockdown          = 0;
    var lockdown_code     = "";
    var EMULAB_NS = "http://www.protogeni.net/resources/rspec/ext/emulab/1";

    function initialize()
    {
	window.APT_OPTIONS.initialize(sup);
	ajaxurl = window.APT_OPTIONS.AJAXURL;
	uuid    = window.APT_OPTIONS.uuid;
	oneonly = window.APT_OPTIONS.oneonly;
	isadmin = window.APT_OPTIONS.isadmin;
	isguest = (window.APT_OPTIONS.registered ? false : true);
	dossh   = window.APT_OPTIONS.dossh;
	extend  = window.APT_OPTIONS.extend || null;
	profile_uuid = window.APT_OPTIONS.profileUUID;
	lockout      = window.APT_OPTIONS.lockout;
	lockdown     = window.APT_OPTIONS.lockdown;
	lockdown_code= uuid.substr(2, 5);
	var instanceStatus = window.APT_OPTIONS.instanceStatus;
	var errorURL = (window.ISCLOUD ?
			"cloudlab-ops@cloudlab.us" : "aptlab-ops@aptlab.net") +
	    "?subject=" +
	    encodeURIComponent("Help needed for instance: " + uuid) +
	    "&body=" + encodeURIComponent("\n\nInstance URL: " +
					  document.location.href);

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
	    errorURL:           errorURL,
	    lockout:            lockout,
	    lockdown:           lockdown,
	    lockdown_code:      lockdown_code,
	    // The status panel starts out collapsed.
	    status_panel_show:  (instanceStatus == "ready" ? false : true),
	};
	var status_html   = statusTemplate(template_args);
	$('#status-body').html(status_html);
	$('#waitwait_div').html(waitwaitString);
	$('#oops_div').html(oopsString);
	$('#register_div').html(registerString);
	$('#terminate_div').html(terminateTemplate(template_args));
	$('#oneonly_div').html(oneonlyString);
	$('#approval_div').html(approvalString);

	// Format dates with moment before display.
	$('.format-date').each(function() {
	    var date = $.trim($(this).html());
	    if (date != "") {
		$(this).html(moment($(this).html()).format("lll"));
	    }
	});

	//
	// Look at initial status to determine if we show the progress bar.
	//
	var spinwidth = 0;
	if (instanceStatus == "created") {
	    spinwidth = "33";
	}
	else if (instanceStatus == "provisioned") {
	    spinwidth = "66";
	}
	if (spinwidth) {
	    $("#status_progress_bar").width(spinwidth + "%");
	    $('#status_progress_outerdiv').removeClass("hidden");
	}
	
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
	    ShowExtendModal(uuid, RequestExtensionCallback, isadmin,
			    isguest, null, window.APT_OPTIONS.freenodesurl);
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

	// If we got a publicURL, set the href and show the button.
	if (window.APT_OPTIONS.publicURL) {
	    ShowSliverInfo(window.APT_OPTIONS.publicURL);
	}

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
		window.location.replace('instantiate.php?default=' +
					profile_uuid);
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
	GetStatus(uuid);
	if (window.APT_OPTIONS.oneonly) {
	    sup.ShowModal('#oneonly-modal');
	}
	else if (window.APT_OPTIONS.snapping) {
	    ShowProgressModal();
	}
	else if (window.APT_OPTIONS.extend) {
	    ShowExtendModal(uuid, RequestExtensionCallback, isadmin, isguest,
			    window.APT_OPTIONS.extend,
			    window.APT_OPTIONS.freenodesurl);
	}
    }

    // Periodically ask the server for the status and update the display.
    // We sometimes want to trigger this before the next wakeup, so use
    // a flag to prevent more then one at a time.
    var statusbusy = 0;
    
    function GetStatus(uuid)
    {
	// One at a time
	if (statusbusy)
	    return;
	statusbusy = 1;
	
	var callback = function(json) {
	    StatusWatchCallBack(uuid, json);
	    statusbusy = 0;
	}
	var xmlthing = sup.CallServerMethod(ajaxurl,
					    "status",
					    "GetInstanceStatus",
					     {"uuid" : uuid});
	xmlthing.done(callback);
    }

    // Call back for above.
    function StatusWatchCallBack(uuid, json)
    {
	console.info(json);
	
	// Flag to indicate that we have seen ready and do not
	// need to do initial stuff. We need this cause the
	// the staus can change later, back to busy for a while.
	if (typeof StatusWatchCallBack.active == 'undefined') {
            // It has not... perform the initilization
            StatusWatchCallBack.active = 0;
	}
	var status = json.value.status;
	if (json.code) {
	    alert("The server has returned an error: " + json.value);
	    status = "unknown";
	}
	var status_html = "";
    
	if (status != lastStatus) {
	    status_html = status;

	    var bgtype = "panel-info";
	    status_message = "Please wait while we get your experiment ready";

	    //
	    // As soon as we have a manifest, show the topology.
	    // 
	    if (! StatusWatchCallBack.active && json.value.havemanifests) {
		ShowTopo(uuid);
		StatusWatchCallBack.active = 1;
	    }
	    // Ditto the publicURL.
	    if (_.has(json.value, "publicURL")) {
		ShowSliverInfo(json.value.publicURL);
	    }
	    
	    if (status == 'provisioned') {
		$("#status_progress_bar").width("66%");
		status_html = "booting";
	    }
	    else if (status == 'ready') {
		bgtype = "panel-success";
		status_message = "Your experiment is ready!";
		status_html = "<font color=green>ready</font>";
		if ($("#status_progress_div").length) {
		    $("#status_progress_div").removeClass("progress-striped");
		    $("#status_progress_div").removeClass("active");
		    $("#status_progress_div").addClass("progress-bar-success");
		    $("#status_progress_bar").width("100%");
		}
		EnableButtons();
		AutoStartSSH();
	    }
	    else if (status == 'failed') {
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
		if ($("#status_progress_div").length) {
		    $("#status_progress_div").removeClass("progress-striped");
		    $("#status_progress_div").removeClass("active");
		    $("#status_progress_div").addClass("progress-bar-danger");
		    $("#status_progress_bar").width("100%");
		}
		DisableButtons();
		EnableButton("terminate");
		EnableButton("refresh");
	    }
	    else if (status == 'imaging') {
		bgtype = "panel-warning";
		status_message = "Your experiment is busy while we  " +
		    "copy your disk";
		status_html = "<font color=red>imaging</font>";
		DisableButtons();
	    }
	    else if (status == 'imaging-failed') {
		bgtype = "panel-danger";
		status_message = "Your disk image request failed!";
		status_html = "<font color=red>imaging-failed</font>";
		DisableButtons();
		EnableButton("terminate");
		EnableButton("refresh");
	    }
	    else if (status == 'terminating' || status == 'terminated') {
		status_html = "<font color=red>" + status + "</font>";
		bgtype = "panel-danger";
		status_message = "Your experiment has been terminated!";
		DisableButtons();
		StartCountdownClock.stop = 1;
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
	//
	// Look for a sliverstatus blob.
	//
	if (json.value.havemanifests && _.has(json.value, "sliverstatus")) {
	    UpdateSliverStatus(json.value.sliverstatus);
	}
	lastStatus = status;
	if (! (status == 'terminating' || status == 'terminated' ||
	       status == 'unknown')) {
	    setTimeout(function f() { GetStatus(uuid) }, 5000);
	}
    }

    //
    // Enable/Disable buttons. 
    //
    function EnableButtons()
    {
	EnableButton("terminate");
	EnableButton("refresh");
	EnableButton("extend");
	EnableButton("clone");
	EnableButton("snapshot");
    }
    function DisableButtons()
    {
	DisableButton("terminate");
	DisableButton("refresh");
	DisableButton("extend");
	DisableButton("clone");
	DisableButton("snapshot");
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
	else if (button == "clone" && nodecount == 1)
	    button = "#clone_button";
	else if (button == "snapshot" && nodecount == 1)
	    button = "#snapshot_button";
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
	$("#quickvm_expires").html(moment(json.value).format('lll'));
	
	// Reset the countdown clock.
	StartCountdownClock.reset = json.value;
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
	    GetStatus(uuid);
	}
	sup.ShowModal('#waitwait-modal');
	var xmlthing = sup.CallServerMethod(ajaxurl,
					    "status",
					    "Refresh",
					     {"uuid" : uuid});
	xmlthing.done(callback);
    }
    // Helper for above and called from the status callback.
    function UpdateSliverStatus(oblob)
    {
	$.each(oblob , function(urn, iblob) {
	    $.each(iblob , function(node_id, details) {
		if (details.status == "ready") {
		    // Bootstrap bg-success color
		    $('#' + jacksIDs[node_id] + ' .node .nodebox')
			.css("fill", "#dff0d8");
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
	    });
	});
    }	
	
    //
    // Request a node reboot from the backend cluster.
    //
    function DoReboot(node_id)
    {
	var callback = function(json) {
	    sup.HideModal('#waitwait-modal');
	    
	    if (json.code) {
		sup.SpitOops("oops", "Failed to reboot: " + json.value);
		return;
	    }
	    // Trigger status to change the nodes.
	    GetStatus(uuid);
	}
	sup.ShowModal('#waitwait-modal');
	var xmlthing = sup.CallServerMethod(ajaxurl,
					    "status",
					    "Reboot",
					     {"uuid"    : uuid,
					      "node_id" : node_id});
	xmlthing.done(callback);
    }
	
    //
    // Request a node reload from the backend cluster.
    //
    function DoReload(node_id)
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
		GetStatus(uuid);
	    }
	    sup.ShowModal('#waitwait-modal');
	    var xmlthing = sup.CallServerMethod(ajaxurl,
						"status",
						"Reload",
						{"uuid"    : uuid,
						 "node_id" : node_id});
	    xmlthing.done(callback);
	});
	sup.ShowModal('#confirm_reload_modal');
    }
	
    //
    // Fire up the backend of the ssh tab.
    //
    function StartSSH(id, authobject)
    {
	var jsonauth = $.parseJSON(authobject);
	
	var callback = function(stuff) {
            var split   = stuff.split(':');
            var session = split[0];
    	    var port    = split[1];

            var url   = jsonauth.baseurl + ':' + port + '/' + '#' +
		encodeURIComponent(document.location.href) + ',' + session;
//            console.info(url);
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
    function NewSSHTab(hostport, client_id)
    {
	var pair = hostport.split(":");
	var host = pair[0];
	var port = pair[1];

	//
	// Need to create the tab before we can create the topo, since
	// we need to know the dimensions of the tab.
	//
	var tabname = client_id + "_tab";
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
//	    console.info(json.value);

	    if (json.code) {
		alert("Failed to gain authentication for ssh.");
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

    //
    // Show a context menu over nodes in the topo viewer.
    //
    function ContextMenuShow(jacksevent)
    {
	var event = jacksevent.event;
	var client_id = jacksevent.client_id;

	//
	// We generate a new menu object each time causes it easier and
	// not enough overhead to worry about.
	//
	$('#context').contextmenu({
	    target:'#context-menu', 
	    onItem: function(context,e) {
		$('#context').contextmenu('closemenu');

		if ($(e.target).text() == "Shell") {
		    NewSSHTab(hostportList[client_id], client_id);
		}
		else if ($(e.target).text() == "Console") {
		    if (isguest) {
			alert("Only registered users can access the console");
			return;
		    }
		    NewConsoleTab(client_id);
		}
		else if ($(e.target).text() == "Reboot") {
		    if (isguest) {
			alert("Only registered users can reboot nodes");
			return;
		    }
		    DoReboot(client_id);
		}
		else if ($(e.target).text() == "Reload") {
		    if (isguest) {
			alert("Only registered users can reload nodes");
			return;
		    }
		    DoReload(client_id);
		}
		else if ($(e.target).text() == "Snapshot") {
		    if (isguest) {
			alert("Only registered users can snapshot nodes");
			return;
		    }
		    DoSnapshotNode(client_id);
		}
		$('#context').contextmenu('destroy');
	    }
	})
	$('#context').contextmenu('show', event);
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
	" <td name='sshurl'>n/a</td>" +
	" <td name='menu' align=center> " +
	"  <div name='action-menu' class='dropdown'>" +
	"  <button type='button' " +
	"          class='btn btn-primary btn-sm dropdown-toggle' " +
	"          data-toggle='dropdown'> " +
	"      <span class='glyphicon glyphicon-cog'></span> " +
	"  </button> " +
	"  <ul class='dropdown-menu text-left' role='menu'> " +
	"    <li><a href='#' name='shell'>Shell</a></li> " +
	"    <li><a href='#' name='console'>Console</a></li> " +
	"    <li><a href='#' name='reboot'>Reboot</a></li> " +
	"    <li><a href='#' name='reload'>Reload</a></li> " +
	"    <li><a href='#' name='snapshot'>Snapshot</a></li> " +
	"  </ul>" +
	"  </div>" +
	" </td>" +
	"</tr>";

    //
    // Show the topology inside the topo container. Called from the status
    // watchdog and the resize wachdog. Replaces the current topo drawing.
    //    
    function ShowTopo(uuid)
    {
	//
	// Maybe this should come from rspec? Anyway, we might have
	// multiple manifests, but only need to do this once, on any
	// one of the manifests.
	//
	var UpdateInstructions = function(xml) {
	    var instructionRenderer = new marked.Renderer();
	    instructionRenderer.defaultLink = instructionRenderer.link;
	    instructionRenderer.link = function (href, title, text) {
		var template = UriTemplate.parse(href);
		var data = MakeUriData(xml);
		return this.defaultLink(template.expand(data), title, text);
	    };

	    // Suck the instructions out of the tour and put them into
	    // the Usage area.
	    $(xml).find("rspec_tour").each(function() {
		$(this).find("instructions").each(function() {
		    marked.setOptions({ "sanitize" : true,
					"renderer": instructionRenderer });
		
		    var text = $(this).text();
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
	    $(xml).find("node").each(function() {
		// Only nodes that match the aggregate being processed,
		// since we send the same rspec to every aggregate.
		var manager_urn = $(this).attr("component_manager_id");
		if (!manager_urn.length || manager_urn != aggregate_urn) {
		    return;
		}
		var node   = $(this).attr("client_id");
		var login  = $(this).find("login");
		var coninfo= this.getElementsByTagNameNS(EMULAB_NS, 'console');
		var vnode  = this.getElementsByTagNameNS(EMULAB_NS, 'vnode');
		var href   = "n/a";
		var ssh    = "n/a";
		var cons   = "n/a";
		var clone  = $(listview_row);

		// Change the ID of the clone so its unique.
		clone.attr('id', 'listview-row-' + node);
		// Insert into the table, we will attach the handlers below.
		$('#listview_table > tbody:last').append(clone);
		// Set the client_id in the first column.
		$('#listview-row-' + node + " [name=client_id]").html(node);
		// And the node_id.
		if (vnode.length) {
		    $('#listview-row-' + node + " [name=node_id]")
			.html($(vnode).attr("name"));
		}
		
		if (login.length && dossh) {
		    var user   = login.attr("username");
		    var host   = login.attr("hostname");
		    var port   = login.attr("port");
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
			    NewSSHTab(hostport, node);
			    return false;
			});		    
		}

		//
		// Now a handler for the console action.
		//
		if (coninfo.length) {
		    // Attach handler to the menu button.
		    $('#listview-row-' + node + ' [name=console]')
			.click(function (e) {
			    e.preventDefault();
			    if (isguest) {
				alert("Only registered users can access " +
				      "the console");
				return false;
			    }
			    NewConsoleTab(node);
			    return false;
			});
		}
		//
		// And a handler for the reboot action.
		//
		$('#listview-row-' + node + ' [name=reboot]')
		    .click(function (e) {
			e.preventDefault();
			if (isguest) {
			    alert("Only registered users can reboot nodes");
			    return false;
			}
			DoReboot(node);
			return false;
		    });
		
		//
		// And a handler for the reload action.
		//
		$('#listview-row-' + node + ' [name=reload]')
		    .click(function (e) {
			e.preventDefault();
			if (isguest) {
			    alert("Only registered users can reload nodes");
			    return false;
			}
			DoReload(node);
			return false;
		    });
		
		//
		// And a handler for the snapshot action.
		//
		$('#listview-row-' + node + ' [name=snapshot]')
		    .click(function (e) {
			e.preventDefault();
			if (isguest) {
			    alert("Only registered users can snapshot nodes");
			    return false;
			}
			DoSnapshotNode(node);
			return false;
		    });
		
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

	    // Add the instructions from only one manifest.
	    var gottour = 0;

	    _.each(json.value, function(manifest, aggregate_urn) {
		var xmlDoc = $.parseXML(manifest);
		var xml = $(xmlDoc);

		if (!gottour) {
		    UpdateInstructions(xml);
		    gottour = 1;
		}
		ProcessNodes(aggregate_urn, xml);
	    });

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
		    var nodename = hostportList.keys()[0];
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

    function MakeUriData(xml)
    {
	var result = {};
	xml.find('node').each(function () {
	    var node = $(this);
	    var host = node.find('host').attr('name');
	    if (host) {
		var key = 'host-' + node.attr('client_id');
		result[key] = host;
	    }
	});
	return result;
    }

    function ShowProgressModal()
    {
	ShowImagingModal(function()
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
    function StartSnapshot(node_id, update_profile, update_prepare)
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

	// Default to unchecked any time we show the modal.
	$('#snapshot_update_prepare').prop("checked", false);
	
	//
	// Snapshot specific node from the context menu. We give the
	// the user some extra options in confirm modal.
	//
	if (node_id) {
	    // Default to checked any time we show the modal.
	    $('#snapshot_update_profile').prop("checked", true);
	    
	    $('#snapshot_update_profile_div').removeClass("hidden");
	}
	else {
	    $('#snapshot_update_profile_div').addClass("hidden");
	}
	sup.ShowModal('#snapshot_modal');

	// Handler for the Snapshot confirm button.
	$('button#snapshot_confirm').bind("click.snapshot", function (event) {
	    event.preventDefault();
	    $('button#snapshot_confirm').unbind("click.snapshot");
	    if (node_id && $('#snapshot_update_profile').is(':checked')) {
		update_profile = 1;
	    }
	    if ($('#snapshot_update_prepare').is(':checked')) {
		update_prepare = 1;
	    }
	    sup.HideModal('#snapshot_modal');
	    StartSnapshot(node_id, update_profile, update_prepare);
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
			if (jacksevent.type === 'node') 
			{
			    ContextMenuShow(jacksevent);
			}
		    });
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

    function ShowSliverInfo(url)
    {
	$("#sliverinfo_button").attr("href", url);
	$("#sliverinfo_button").removeClass("hidden");
    }

    $(document).ready(initialize);
});
