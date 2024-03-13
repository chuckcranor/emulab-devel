
$(function ()
{
    'use strict';

    var templates = APT_OPTIONS
	.fetchTemplateList(['status', 'waitwait-modal',
			    'oops-modal', 'terminate-modal',
			    'approval-modal', 'linktest-modal',
			    'linktest-md', "destroy-experiment",
			    "prestage-table", "frequency-graph", 'txgraph']);

    var statusString = templates['status'];
    var waitwaitString = templates['waitwait-modal'];
    var oopsString = templates['oops-modal'];
    var terminateString = templates['terminate-modal'];
    var approvalString = templates['approval-modal'];
    var linktestString = templates['linktest-modal'];
    var destroyString  = templates['destroy-experiment'];

    // Node/listview colors
    var READY_COLOR    = "#91E388";
    var BOOTING_COLOR  = "#fcf8e3";
    var FAILED_COLOR   = "#e67795";
    var PENDING_COLOR  = "#75c4e6";

    var expinfo     = null;
    var nodecount   = 0;
    var ajaxurl     = null;
    var uuid        = null;
    var isadmin     = 0;
    var isfadmin    = 0;
    var isstud      = 0;
    var wholedisk   = 0;
    var isscript    = 0;
    var dossh       = 1;
    var dovnc       = 0;
    var jacksIDs    = {};
    var jacksSites  = {};
    var publicURLs  = null;
    var inrecovery  = {};
    var extension_blob    = null;
    var manifests         = {};
    var jacksManifest     = null;
    var status_collapsed  = false;
    var status_message    = "";
    var status_html       = "";
    var statusTemplate    = _.template(statusString);
    var terminateTemplate = _.template(terminateString);
    var prestageTemplate  = _.template(templates['prestage-table']);
    var instanceStatus    = "";
    var lastStatus        = "";
    var lastStatusBlob    = null;
    var lockdown_code     = "";
    var consolenodes      = {};
    var showlinktest      = false;
    var hidelinktest      = false;
    var projlist          = null;
    var amlist            = null;
    var prunetypes        = null;
    var jacksInstance     = null;
    var changingtopo      = false;
    var slowdown          = false;
    var multisite         = false;
    var radioinfo         = null;
    var resgroups         = null;
    var radios            = {};
    var monitorTemplate   = null;
    var vncpasswd         = null;
    var modifying         = false;
    var EMULAB_OPS        = "emulab-ops";
    var EMULAB_NS = "http://www.protogeni.net/resources/rspec/ext/emulab/1";
    var SVLAN_NS  = "http://www.geni.net/resources/rspec/ext/shared-vlan/1";
    var GENIRESPONSE_REFUSED = 7;
    var GENIRESPONSE_ALREADYEXISTS = 17;
    var GENIRESPONSE_INSUFFICIENT_NODES = 26;
    var GENIRESPONSE_NO_MAPPING = 28;
    var MAXJACKSNODES = 300;
    var PORTALTABCOOKIE = "PortalLastTab";
    var initialTab = "topology";

    // CONFIRM Hack. Fix later.
    var CONFIRMTYPES = [ "c6320", "c8220", "m400", "m510",
			 "c220g1", "c220g2" ];

    function TimeStamp(message)
    {
	if (0) {
	    var microtime = window.performance.now() / 1000.0
	    console.info("TIMESTAMP: " + microtime + " " + message);
	}
    }

    function navTabLink(label, tabname)
    {
	var html =
	    "<li class='nav-item'> "+
	    "  <a class='nav-link' href='#" +
	        tabname + "' data-toggle='tab' data-bs-toggle='tab'>" +
	        label + "" +
	    "<button class='btn btn-small navtab-icon' type='button' " +
	    "        id='" + tabname + "_kill'>" +
	    " <span class='glyphicon glyphicon-remove-circle'></span>" +
	    "</button>" +
	    "</a>" +
	    "</li>";	
	    
	return html;
    }

    function initialize()
    {
	window.APT_OPTIONS.initialize(sup);
	ajaxurl       = window.APT_OPTIONS.AJAXURL;
	uuid          = window.APT_OPTIONS.uuid;
	isadmin       = window.APT_OPTIONS.isadmin;
	isfadmin      = window.APT_OPTIONS.isfadmin;
	isstud        = window.APT_OPTIONS.isstud;
	wholedisk     = window.APT_OPTIONS.wholedisk;
	dossh         = window.APT_OPTIONS.dossh;
	dovnc         = window.APT_OPTIONS.dovnc;
	isscript      = window.APT_OPTIONS.isscript;
	hidelinktest  = window.APT_OPTIONS.hidelinktest;
	lockdown_code = uuid.substr(2, 5);

	// Standard option
	marked.setOptions({"sanitize" : true});

	if ($('#projects-json').length) {
	    projlist = decodejson('#projects-json');
	    // console.info(projlist);
	}
	amlist = decodejson('#amlist-json');
	console.info("amlist", amlist);
	if (window.ISPOWDER) {
	    radioinfo = decodejson('#radioinfo-json');
	    console.info("radioinfo", radioinfo);
	    monitorTemplate = _.template(templates['frequency-graph']);
	}
	prunetypes = decodejson('#prunelist-json');
	console.info("prunetypes", prunetypes);
	resgroups = decodejson('#resgroup-json');
	console.info("resgroups", resgroups);

	if (LastKnownUserTab() == "listview") {
	    initialTab = "listview";
	}
	
	/*
	 * Need to grab the experiment info so we can draw the page.
	 */
	LoadExperimentInfo(function () {
	    GeneratePageBody();
	});
    }

    function GeneratePageBody()
    {
	instanceStatus  = expinfo.status;
	extension_blob  = expinfo.extension_info;
	
	// Generate the templates.
	var template_args = {
	    uuid:		uuid,
	    expinfo:            expinfo,
	    isadmin:            window.APT_OPTIONS.isadmin,
	    isfadmin:           window.APT_OPTIONS.isfadmin,
	    isstud:             window.APT_OPTIONS.isstud,
	    extensions:         extension_blob.extensions,
	    errorURL:           window.HELPFORUM,
	    lockdown_code:      lockdown_code,
	};
	var html = statusTemplate(template_args);
	$('#status-body').html(html);
	$('#waitwait_div').html(waitwaitString);
	$('#oops_div').html(oopsString);
	$('#terminate_div').html(terminateTemplate(template_args));
	$('#approval_div').html(approvalString);
	$('#linktest_div').html(linktestString);
	$('#destroy_div').html(destroyString);
	$('#txgraph_div').html(templates["txgraph"]);
	
	// Not allowed to copy repobased profiles.
	if (expinfo.repourl) {
	    $('#copy_button').addClass("hidden");
	}
	if (expinfo.started) {
	    $('.exp-running').removeClass("hidden");
	}

	// Format dates with moment before display.
	$('.format-date').each(function() {
	    var date = $.trim($(this).html());
	    if (date != "") {
		$(this).html(moment($(this).html()).format("lll"));
	    }
	});
	ProgressBarUpdate();

	if (!expinfo.istutorial) {
	    // Periodic check for max allowed extension
	    LoadMaxExtension();
	    setInterval(LoadMaxExtension, 3600 * 1000);
	}

	// This activates the popover subsystem.
	$('[data-toggle="popover"]').popover({
	    trigger: 'hover',
	    placement: 'auto',
	});
	$('[data-toggle="tooltip"]').tooltip({
	    placement: 'top',
	});
	StartStatusWatch();

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

	sup.addPopoverClip('.status-page-link',
			   function (target) {
			       var url = window.location.href;
			       return sup.popoverClipContent(url);
			   });

	// Setup the extend modal.
	$('button#extend_button').click(function (event) {
	    window.APT_OPTIONS.gaButtonEvent(event);
	    event.preventDefault();
	    if (isfadmin) {
		sup.ShowModal("#extend_history_modal");
		return;
	    }
	    if (expinfo.lockout && !isadmin) {
		if (extension_blob.extension_disabled_reason != "") {
		    $("#extensions-disabled-reason .reason")
			.text(extension_blob.extension_disabled_reason);
		    $("#extensions-disabled-reason").removeClass("hidden");
		}
		sup.ShowModal("#no-extensions-modal");
		return;
	    }
	    if (isadmin) {
		window.location.replace("adminextend.php?uuid=" + uuid);
		return;
	    }
            ShowExtendModal(uuid,
			    RequestExtensionCallback, isstud, false, expinfo);
	});
	
	// Handler for the refresh button
	$('button#refresh_button').click(function (event) {
	    window.APT_OPTIONS.gaButtonEvent(event);
	    event.preventDefault();
	    DoRefresh();
	});
	// Handler for the reload topology button
	$('button#reload-topology-button').click(function (event) {
	    window.APT_OPTIONS.gaButtonEvent(event);
	    event.preventDefault();
	    DoReloadTopology();
	});
	// Handler for the ignore failure button (in the modal).
	$('button#ignore-failure-confirm').click(function (event) {
	    event.preventDefault();
	    IgnoreFailure();
	});
	// Handler for the modify experiment button. Only parameterized profiles
	if (expinfo.paramdefs && window.APT_OPTIONS.canmodify) {
	    $('button#modify_experiment_button').click(function (event) {
		event.preventDefault();
		Modify();
	    });
	}


	// Terminate an experiment.
	$('button#terminate').click(function (event) {
	    window.APT_OPTIONS.gaButtonEvent(event);
	    var lockdown_override = "";
	    event.preventDefault();
	    sup.HideModal('#terminate_modal');

	    if (expinfo.user_lockdown) {
		if (lockdown_code != $('#terminate_lockdown_code').val()) {
		    sup.SpitOops("oops", "Refusing to terminate; wrong code");
		    return;
		}
		lockdown_override =  $('#terminate_lockdown_code').val();
	    }
	    var callback = function(json) {
		sup.HideModal("#waitwait-modal");
		if (json.code) {
		    sup.SpitOops("oops", json.value);
		    return;
		}
		var url = 'landing.php';
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
	SetupWarnKill();
	SetupSnapshotModal();

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
	// Chevron toggle handlers
	$('#profile_status_collapse, #profile_instructions_collapse')
	    .on('show.bs.collapse', function (event) {
		var id = $(this).data("chevron");
		$('#' + id + ' .glyphicon')
		    .removeClass("glyphicon-chevron-right")
		    .addClass("glyphicon-chevron-down");
	    })
	    .on('hide.bs.collapse', function (event) {
		var id = $(this).data("chevron");
		$('#' + id + ' .glyphicon')
		    .removeClass("glyphicon-chevron-down")
		    .addClass("glyphicon-chevron-right");

	    });
	if (0 && instanceStatus == "ready") {
	    $('#profile_status_collapse').collapse("hide");
 	    $('#profile_status_collapse').trigger('hide.bs.collapse');
	}
	else {
	    $('#profile_status_collapse').collapse("show");
 	    $('#profile_status_collapse').trigger('show.bs.collapse');
	}
	
        $('#instructions').on('hide.bs.collapse', function () {
	    APT_OPTIONS.updatePage({ 'status_instructions': 'hidden' });
	});
        $('#instructions').on('show.bs.collapse', function () {
	    APT_OPTIONS.updatePage({ 'status_instructions': 'shown' });
	});
	$('#quicktabs_ul li a').on('shown.bs.tab', function (event) {
	    window.APT_OPTIONS.gaTabEvent("show",
					  $(event.target).attr('href'));
	    RememberUserTab($(event.target).attr('href'));
	});
	$('#prestage-panel .info-button').click(function (event) {
	    event.preventDefault();
	    sup.ShowModal('#prestage-info-modal');
	});
	/*
	 * The listview table header initialization, only once. 
	 */
	$('#listview_table')
	    .tablesorter({
		theme : 'bootstrap',
		widgets : [ "uitheme", "zebra"],
		headerTemplate : '{content} {icon}',
	    });
		
	// Handler for select/deselect all rows in the list view.
	$('#select-all')
	    .change(function () {
		if ($(this).prop("checked")) {
		    $('#listview_table [name=select]')
			.prop("checked", true);
		}
		else {
		    $('#listview_table [name=select]')
			.prop("checked", false);
		}
	    });
	// Handler for the action menu next to the select-all checkbox:
	// Foreign admins do not get a menu, but easier to just hide it.
	if (isfadmin) {
	    $('#listview-action-menu').addClass("invisible");
	}
	else {
	    $('#listview-action-menu li a')
		.click(function (e) {
		    window.APT_OPTIONS.gaButtonEvent(e);
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
	
        addTutorialNotifyTab('profile');
        addTutorialNotifyTab('listview');
        addTutorialNotifyTab('manifest');
        addTutorialNotifyTab('Idlegraphs');
	StartCountdownClock(expinfo.expires);
	if (window.APT_OPTIONS.thisUid == expinfo.creator &&
	    expinfo.extension_info.extension_denied) {
	    ShowExtensionDeniedModal();
	}
	else if (window.APT_OPTIONS.snapping) {
	    ShowProgressModal();
	}
	else if (!expinfo.started && expinfo.start_at) {
	    ShowRspec();
	    ShowBindings();
	}
     }

  function addTutorialNotifyTab(id)
  {
    var allTabs = $('#quicktabs_ul li');
    allTabs.each(function () {
      if ($(this).find('a').attr('href') === ('#' + id)) {
	$(this).on('show.bs.tab', function () {
	  APT_OPTIONS.updatePage({ 'status_tab': id });
	});
      }
    });
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
	statusID = setInterval(GetStatus, (window.APT_OPTIONS.slowdown ? 30000 : 5000));
    }
    
    function GetStatus()
    {
	//console.info("GetStatus", statusBusy, statusHold);
	
	// Clearly not thread safe, but its okay.
	if (statusBusy || statusHold)
	    return;
	statusBusy = 1;
	
	var callback = function(json) {
	    // Watch for logged out, stop the loop. User will need to reload.
	    if (json.code == 222) {
		clearInterval(statusID);
		alert("You are no longer logged in, please refresh to " +
		      "continue getting page updates");
	    }
	    else {
		StatusWatchCallBack(json, function () {
		    if (instanceStatus == 'terminated') {
			clearInterval(statusID);
		    }
		    else {
			// Okay to do again next timeout.
			statusBusy = 0;
		    }
		});
	    }
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

    // Call back for above.
    function StatusWatchCallBack(json, donefunc)
    {
	window.EXPSTATUS = json;
	
	//console.info("StatusWatchCallBack: ", json);
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
	// Clear this since it is transient.
	if (instanceStatus != "pending") {
	    $('#pending-panel').addClass("hidden");
	}
	
	// The urls can show up at any time cause of async/early return.
	if (_.has(json.value, "sliverstatus")) {
	    ShowSliverURLs(json.value.sliverstatus);
	}
	if (0) {
	    console.info("GetStatus", instanceStatus,
			 expinfo.paniced, json.value.paniced);
	}
	// See if a transition from scheduled to started
	if (!expinfo.started && json.value.started) {
	    ExperimentStarted();
	}
	// Watch for experiment going into or out of panic mode.
	if (expinfo.paniced && !json.value.paniced) {
	    // Left panic mode.
	    expinfo.paniced = 0;
	}
	if (expinfo.paniced || json.value.paniced) {
	    expinfo.paniced = 1;
	    instanceStatus = "quarantined";
	}
	if (instanceStatus != lastStatus || instanceStatus == "created" ||
	    json.value.canceled) {
            APT_OPTIONS.updatePage({ 'instance-status': instanceStatus });
	    //console.info("New Status: ", json);
	
	    status_html = json.value.status;

	    var bgtype = "panel-info card-info";
	    status_message = "Please wait while we get your experiment ready";

	    // Ditto the logfile, which can change.
	    if (_.has(json.value, "logfile_url")) {
		ShowLogfile(json.value.logfile_url);
	    }
	    if (instanceStatus == 'stitching') {
		status_html = "stitching";
	    }
	    else if (instanceStatus == 'created' &&
		     _.has(json.value, "delayedCount")) {
		status_html = "waiting";
		ProgressBarUpdate();
		if (json.value.delayedCount) {
		    var count = json.value.delayedCount;

		    status_message = "Portal is very busy, there are " +
			count + " experiments waiting. ";
		}
		status_message += "Patience please!";
	    }
	    else if (instanceStatus == 'pending') {
		status_html = "pending";
		ProgressBarUpdate();
		ShowRspec();
		ShowBindings();
		status_message = "Your experiment cannot be instantiated " +
		    "yet, trying again in a few minutes.";
		ShowPendingInfo(json.value);
	    }
	    else if (instanceStatus == 'scheduled') {
		status_html = "scheduled";
		ProgressBarUpdate();
		status_message = "Your experiment is scheduled to start later";
	    }
	    else if (instanceStatus == 'rdzwait') {
		status_html = "RDZ Wait (<span class='text-info'>" +
		    "requesting spectrum from the RDZ</span>" + ")";
		ProgressBarUpdate();
		ShowRspec();
		ShowBindings();
		status_message =
		    "Your experiment is delayed while we request spectrum " +
		    "from the RDZ";
	    }
	    else if (instanceStatus == 'prestaging') {
		status_html = "prestaging";
		status_message = "Copying images to target clusters";
		ProgressBarUpdate();
	    }
	    else if (instanceStatus == 'provisioning') {
		status_html = "provisioning";
		if (json.value.canceled) {
		    status_html += " (but canceled)";
		}
		ProgressBarUpdate();
	    }
	    else if (instanceStatus == 'provisioned') {
		ProgressBarUpdate();
		status_html = "booting";
		if (json.value.canceled) {
		    status_html += " (but canceled)";
		}
		else if (aggregatesDeferred(json.value)) {
		    status_html += " (but some aggregates deferred)";
		}
	    }
	    else if (json.value.canceled &&
		     !(instanceStatus == 'terminating' ||
		       instanceStatus == 'terminated')) {
		bgtype = "panel-warning card-warning";
		status_message = "Your experiment has been canceled!";
		status_html = "<font color=red>canceled</font>";
		ProgressBarUpdate();
	    }
	    else if (instanceStatus == 'ready') {
		bgtype = "panel-success card-success";
		status_message = "Your experiment is ready";
		var qualifier = null;

		if (servicesExecuting(json.value)) {
		    status_html = "<font color=green>booted</font>";
		    qualifier = " (startup services are still running)";
		}		
		else {
		    status_html = "<font color=green>ready</font>";
		    if (aggregatesDeferred(json.value)) {
			qualifier += " (but some aggregates deferred)";
		    }
		}
		if (qualifier) {
		    status_html    += qualifier;
		    status_message += qualifier;
		}
		UpdateGeneralError(null);
		$('.ignore-failure').addClass("hidden");

		// Reload in case we are here cause of a modify.
		LoadExperimentInfo();
		ProgressBarUpdate();
		ShowIdleDataTab();
		if (json.value.haveopenstackstats) {
		    ShowOpenstackTab();
		}
		if (expinfo.paramdefs && window.APT_OPTIONS.canmodify) {
		    $('#modify_experiment_button').removeClass("hidden");
		}
	    }
	    else if (instanceStatus == 'failed') {
		bgtype = "panel-danger card-danger";
		status_message = "Something went wrong!";
		
		if (!_.has(json.value, "sliverstatus")) {
		    if (_.has(json.value, "output")) {
			UpdateGeneralError(json.value.output);
		    }
		    else if (_.has(json.value, "message")) {
			UpdateGeneralError(json.value.message);
		    }
		    else {
			UpdateGeneralError(null);
		    }
		}
		else {
		    UpdateGeneralError(null);
		}
		    
		if (json.value.canclearerror) {
		    $('.ignore-failure').removeClass("hidden");
		}
		status_html = "<font color=red>failed</font>";
		ProgressBarUpdate();
	    }
	    else if (instanceStatus == 'quarantined') {
		bgtype = "panel-warning card-warning";
		status_message = "Your experiment has been quarantined";
		status_html = "<font color=red>quarantined</font>";
		ProgressBarUpdate();
		ShowIdleDataTab();
	    }
	    else if (instanceStatus == 'imaging') {
		bgtype = "panel-warning card-warning";
		status_message = "Your experiment is busy while we  " +
		    "copy your disk";
		status_html = "<font color=red>imaging</font>";
	    }
	    else if (instanceStatus == 'linktest') {
		bgtype = "panel-warning card-warning";
		status_message = "Your experiment is busy while we  " +
		    "run linktest";
		status_html = "<font color=red>linktest</font>";
	    }
	    else if (instanceStatus == 'imaging-failed') {
		bgtype = "panel-danger card-danger";
		status_message = "Your disk image request failed!";
		status_html = "<font color=red>imaging-failed</font>";
	    }
	    else if (instanceStatus == 'terminating' ||
		     instanceStatus == 'terminated') {
		status_html = "<font color=red>" + instanceStatus + "</font>";
		bgtype = "panel-danger card-danger";
		status_message = "Your experiment has been terminated!";
		StartCountdownClock.stop = 1;
		if (lastStatus == "failed") {
		    $('.ignore-failure').addClass("hidden");
		}
		if (json.value.rdz_status == "revoked" ||
		    (lastStatusBlob && lastStatusBlob.rdz_status == "revoked")) {
		    status_html +=
			" <font color=red>" +
			"(<b>The RDZ has revoked your spectrum</b>)</font>";
		}
	    }
	    else if (instanceStatus == "unknown") {
		status_html = "<font color=red>" + instanceStatus + "</font>";
		bgtype = "panel-warning card-warning";
		status_message = "The server is temporarily unavailable. " +
		    "Please check back later.";
	    }
	    if (instanceStatus == "quarantined") {
		$('#explain-quarantine').removeClass("hidden");
		$('#warnkill-experiment-button').addClass("hidden");
		$('#release-quarantine-button').removeClass("hidden");
		$('#quarantine_checkbox').prop("checked", true);
	    }
	    else {
		$('#explain-quarantine').addClass("hidden");
		$('#release-quarantine-button').addClass("hidden");
		$('#warnkill-experiment-button').removeClass("hidden");
		$('#quarantine_checkbox').prop("checked", false);
	    }
	    $("#status_panel")
		.removeClass('panel-success panel-danger ' +
			     'panel-warning panel-default panel-info ' +
			     'card-success card-danger ' +
			     'card-warning card-default card-info')
		.addClass(bgtype);
	    UpdateButtons(instanceStatus);
	}
	else if (lastStatus == "ready" && instanceStatus == "ready") {
	    status_message = "Your experiment is ready";
	    if (servicesExecuting(json.value)) {
		status_html = "<font color=green>booted</font>";
		status_html += " (startup services are still running)";
		status_message += " (startup services are still running)";
	    }		
	    else {
		status_html = "<font color=green>ready</font>";
		if (aggregatesDeferred(json.value)) {
		    status_html += " (but some aggregates deferred)";
		    status_message += " (but some aggregates deferred)";
		}
		else {
		    // For Selenium.
		    if (! $('#execute-services-done').length) {
			$('body').append("<div class='hidden' " +
				 " id='execute-services-done'></div>");
		    }
		}
	    }
	}
	lastStatus = instanceStatus;
	/*
	 * We get a prestageStatus array from the server when we need
	 * to show that progress. Otherwise hide it.
	 */
	if (_.has(json.value, "prestageStatus")) {
	    ShowPrestageInfo(json.value.prestageStatus);
	}
	else {
	    HidePrestageInfo();
	}

	// Okay, now we can update if they have not changed.
	if (!status_collapsed) {
	    if ($("#status_message").html() != status_message) {
		$("#status_message").html(status_message);
	    }
	}
	if ($("#quickvm_status").html() != status_html) {
	    $("#quickvm_status").html(status_html);
	    $("#quickvm_status_hidden").html(instanceStatus);
	}

	// Add manifests as we get them or on topo change.
	if (expinfo.started && _.has(json.value, "sliverstatus")) {
	    /*
	     * Watch for a change in the aggregates that requires that
	     * we clean the topology/list tabs and draw new ones. Basically,
	     * need to compare against last time and look for changes.
	     */
	    if (lastStatusBlob != null) {
		var newSliverStatus  = json.value.sliverstatus;
		var lastSliverStatus = lastStatusBlob.sliverstatus;
		
		$.each(lastSliverStatus , function(urn) {
		    if (!_.has(newSliverStatus, urn)) {
			console.info("Topology has changed: " +
				     urn + " removed");
			changingtopo = true;
		    }

		});
		$.each(newSliverStatus, function (urn) {
		    if (!_.has(lastSliverStatus, urn)) {
			console.info("Topology has changed: " +
				     urn + " added");
			changingtopo = true;
		    }
		});
		_.each(lastSliverStatus, function(lastinfo, urn) {
		    if (_.has(newSliverStatus, urn)) {
			var hadmanifest = lastinfo.havemanifest;
			var hasmanifest = newSliverStatus[urn].havemanifest;

			if (hadmanifest && !hasmanifest) {
			    console.info("Topology has changed: " +
					 urn + " manifest has been removed");
			    changingtopo = true;
			}
		    }
		});
	    }
	    // This will not do anything unless it needs to.
	    ShowTopo(json.value.sliverstatus, function () {
		// Do this after updates for manifest, which is async.
		UpdateSliverStatus(json.value.sliverstatus);
		// Also save the sliverstatus so we can detect changes
		lastStatusBlob = json.value;
		// Async activity is now done, we can tell the caller.
		// Be nice to use a promise, but have not figured them out yet
		donefunc();
	    });
	}
	else {
	    // Async activity is now done, we can tell the caller.
	    // Be nice to use a promise, but have not figured them out yet
	    donefunc();
	}
    }

    /*
     * Set the button enable/disable according to current status.
     */
    function UpdateButtons(status)
    {
	var terminate;
	var refresh;
	var reloadtopo;
	var extend;
	var snapshot;
	var destroy;
	var release = 0;
	var modify  = 0;
	var portstats = 0;
	var connectshared = 0;

	switch (status)
	{
	    case 'provisioning':
	    case 'imaging':
	    case 'linktest':
	    case 'terminating':
	    case 'terminated':
	    case 'unknown':
	        terminate = refresh = reloadtopo = extend = snapshot = 0;
	        destroy = 0;
  	        break;

	    case 'provisioned':
	    case 'scheduled':
	    case 'pending':
	    case 'rdzwait':
	        refresh = reloadtopo = extend = snapshot = destroy = 0;
  	        terminate = 1;
  	        break;
	    
	    case 'ready':
	        terminate = refresh = reloadtopo = extend = snapshot = 1;
	        destroy = modify = portstats = connectshared = 1;
  	        break;

	    case 'quarantined':
	        refresh = reloadtopo = extend = snapshot = destroy = 0;
	        release = 1;
	        // We let admins terminate/refresh a quarantined experiment.
	        if (isadmin) {
		    terminate = refresh = 1;
		}
  	        break;

	    case 'failed':
	    case 'imaging-failed':
	        refresh = reloadtopo = terminate = destroy = 1;
	        extend = snapshot = 0;
  	        break;
	}

	// When admin lockdown is set, we never enable this button.
	if (expinfo.admin_lockdown || !window.APT_OPTIONS.canterminate) {
	    terminate = 0;
	}
	ButtonState('terminate', terminate);
	ButtonState('refresh', refresh);
	ButtonState('reloadtopo', reloadtopo);
	ButtonState('extend', extend);
	ButtonState('snapshot', snapshot);
	ButtonState('destroy', destroy);
	ButtonState('release', release);
	ButtonState('modify', modify);
	ButtonState('portstats', portstats);
	ButtonState('connect-sharedlan', connectshared);
	ToggleLinktestButtons(status);
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
	if (button == "terminate") {
	    button = "#terminate_button";
	    // When admin lockdown is set, we never enable this button.
	    if (expinfo.admin_lockdown || !window.APT_OPTIONS.canterminate) {
		enable = 0;
	    }
	}
	else if (button == "destroy")
	    button = "#warnkill-experiment-button";
	else if (button == "release")
	    button = "#release-quarantine-button";
	else if (button == "extend")
	    button = "#extend_button";
	else if (button == "refresh")
	    button = "#refresh_button";
	else if (button == "reloadtopo")
	    button = "#reload-topology-button";
	else if (button == "snapshot")
	    button = "#snapshot_button";
	else if (button == "start-linktest")
	    button = "#linktest-modal-button";
	else if (button == "stop-linktest")
	    button = "#linktest-stop-button";
	else if (button == "connect-sharedlan")
	    button = "#connect-sharedlan-button";
	else if (button == "modify")
	    button = "#modify_experiment_button";
	else if (button == "portstats")
	    button = "#portstats-button";
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
	    if (json.code == 2) {
		ReloadExpiration();
		$('#approval_text').html(json.value);
		sup.ShowModal('#approval_modal');
		return;
	    }
	    sup.SpitOops("oops", json.value);
	    return;
	}
	ReloadExpiration();
	
	// Warn the user if we granted nothing.
	if (json.value.granted == 0) {
	    if (json.value.message != "") {
		$('#no-extension-granted-modal .reason')
		    .text(json.value.message);
		$('#no-extension-granted-modal .reason-div')
		    .removeClass("hidden");
	    }
	    else {
		$('#no-extension-granted-modal .reason')
		    .text("");
		$('#no-extension-granted-modal .reason-div')
		    .addClass("hidden");
	    }
	    sup.ShowModal('#no-extension-granted-modal');
	}
	else if (json.value.warning != "") {
	    $('#extension-warning-modal .reason')
		.html(json.value.warning);
	    sup.ShowModal('#extension-warning-modal');
	}
    }

    /*
     * Reload the expiration by getting the latest expinfo and checking
     * to see if it changed. If so, reset the countdown.
     */
    function ReloadExpiration()
    {
	var expiration = expinfo.expires;

	LoadExperimentInfo(function () {
	    if (expinfo.expires != expiration) {
		$("#quickvm_expires")
		    .html(moment(expinfo.expires).format('lll'));
		// Reset the countdown clock.
		StartCountdownClock.reset = expinfo.expires;
	    }
	});
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
		sup.SpitOops("oops", json.value);
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

    // Store old status blob details for comparison to current.
    var oldStatusDetails = {};

    // Helper for above and called from the status callback.
    function UpdateSliverStatus(statusblob)
    {
	// Update the error information panel.
	UpdateErrorPanel(statusblob);

	if (nodecount > MAXJACKSNODES) {
	    return;
	}
	//console.info("UpdateSliverStatus", statusblob);

	$.each(statusblob , function(urn, iblob) {
	    // Will not have node details until manifest is ready.
	    if (!_.has(iblob, "details")) {
		if (iblob.deferred != 0) {
		    deferAggregate(iblob);
		}
		else if (iblob.status == "failed") {
		    failedAggregate(iblob);
		}
		else if (iblob.status == "terminated" ||
			 iblob.status == "canceled") {
		    TerminatedAggregate(iblob.status, urn);
		    return;
		}
		return;
	    }
	    if (iblob.status == "terminated" ||
		iblob.status == "canceled") {
		TerminatedAggregate(iblob.status, urn);
		return;
	    }
	    if (iblob.offline) {
		OfflineAggregate(urn);
		return;
	    }
	    if (iblob.status == "failed") {
		failedAggregate(iblob);
	    }
	    $.each(iblob.details, function(node_id, details) {
		var jacksID  = jacksIDs[node_id];
		//console.info("iblob", node_id, jacksID, details);
		
		// No manifest yet for this node.
		if (jacksID === undefined) {
		    return;
		}
		/*
		 * Use cached details to see if anything has changed, to
		 * avoid regenerating the html and updating the popovers.
		 * On a small experiment this does not matter, but with a
		 * couple 100 nodes, we burn a lot of CPU doing this.
		 *
		 * Put the jacksID into the details for the
		 * comparison.  The JackID appears to change at some
		 * point, so by putting it into the details we stash,
		 * we can make it part of the comparison.
		 */
		details["jacksID"] = jacksID;
		
		if (_.has(oldStatusDetails, node_id)) {
		    if (_.isEqual(details, oldStatusDetails[node_id])) {
			//console.info(node_id + " has not changed");
			return;
		    }
		}
		//console.info(node_id + " has changed", details, jacksID);
		oldStatusDetails[node_id] = details;
		
		// Is the node ain recovery. Panic mode does not count.
		var recovery = false;
		if (!expinfo.paniced &&
		    _.has(details, "recovery") && details.recovery != 0) {
		    recovery = true;
		    inrecovery[node_id] = true;
		}
		else {
		    inrecovery[node_id] = false;
		}
		
		$('#listview-row-' + node_id + ' td[name="status"]')
		    .html(recovery ? "<b>recovery</b>" : details.status);

		if (details.status == "ready") {
		    // Greenish.
		    var color = READY_COLOR;
		    if (recovery) {
			// warning
			color = BOOTING_COLOR;
		    }
		    UpdateNodeColor(node_id, jacksID, color)
		}
		else if (details.status == "failed") {
		    // Bootstrap bg-danger color
		    UpdateNodeColor(node_id, jacksID, FAILED_COLOR);
		}
		else {
		    // Bootstrap bg-warning color
		    UpdateNodeColor(node_id, jacksID, BOOTING_COLOR);
		}
		var cluster_id = amlist[urn].nickname;
		var popover = $('#node-popover-template').clone();

		$(popover).find(".node-popover-node")
		    .html(details.component_urn);
		$(popover).find(".node-popover-id")
		    .html(details.client_id);
		$(popover).find(".node-popover-cluster")
		    .html(cluster_id);
		$(popover).find(".node-popover-status")
		    .html(recovery ? "<b>recovery</b>" : details.status);
		$(popover).find(".node-popover-state")
		    .html(details.state);
		$(popover).find(".node-popover-rawstate")
		    .html(details.rawstate);

		if (_.has(details, "frisbeestatus")) {
		    var mb_written = details.frisbeestatus.MB_written;
		    var imagename  = details.frisbeestatus.imagename;

		    $(popover).find(".node-popover-frisbee-status")
			.removeClass("hidden");
		    $(popover).find(".node-popover-frisbee-image")
			.html(imagename);
		    $(popover).find(".node-popover-frisbee-written")
			.html(mb_written + " MB");
		}
		if (_.has(details, "execute_state")) {
		    var tag;
		    var icon;
		    var color;
			
		    if (details.execute_state == "running") {
			tag  = "Running";
			icon = "record8.svg";
			color= BOOTING_COLOR;
			MarkServicesWarning(details.client_id);
		    }
		    else if (details.execute_state == "exited") {
			if (details.execute_status != 0) {
			    tag  = "Exited (" + details.execute_status + ")";
			    icon = "cancel22.svg";
			    color= FAILED_COLOR;
			}
			else {
			    tag  = "Finished";
			    icon = "check64.svg";
			    color= READY_COLOR;
			}
			ClearServicesWarning(details.client_id);
		    }
		    else {
			tag  = "Pending";
			icon = "button14.svg"
			color= PENDING_COLOR;
		    }
		    $(popover).find(".node-popover-execute-service")
			.removeClass("hidden");
		    $(popover).find(".node-popover-execute-status")
			.html(tag);
		    
		    UpdateNodeIcon(node_id, jacksID, icon);

		    $('#listview-row-' + node_id + ' td[name="startup"]')
			.html(tag)
			.css("background", color);
		}
		UpdateNodePopover(node_id, jacksID, $(popover).html());
	    });
	});
    }

    function jacksNodeBox(jacksID)
    {
	return $('#' + jacksID, jacksInstance.iframe());
    }

    function UpdateNodePopover(node_id, jacksID, html)
    {
	//console.info("UpdateNodePopover", node_id, jacksID);
	var jacksbox = jacksNodeBox(jacksID);
	var popid    = '#popover-' + jacksID;

	// See https://popper.js.org/docs/v2/virtual-elements/ for an
	// explaination of this stuff. 
	var generateGetBoundingClientRect =
	    function(x = 0, y = 0, w = 75, h = 85) {
		return () => ({
		    width: w,
		    height: h,
		    left: x,
		    top: y,
		    right: x + w,
		    bottom: y + h,
		});
	    };

	const virtualElement = {
	    getBoundingClientRect: generateGetBoundingClientRect(),
	};

	if ($(popid).length) {
	    var popover = bootstrap.Popover.getInstance(popid);
	    var actual = $(popid).attr("aria-describedby");
	    $(popid).popover('hide');
	    popover.setContent({'.popover-body': html});
	    if (actual) {
		$(jacksbox).trigger("mouseenter");
	    }
	}
	else {
	    $(jacksbox).on("mouseenter", function (event) {
		var ipos    = $('#showtopo_statuspage').offset();
		var boxpos  = $(jacksbox).offset();
		var ptop    = Math.floor(boxpos.top + ipos.top);
		var pleft   = Math.floor(boxpos.left + ipos.left);
		var jwidth  = $(jacksbox).width();
		var jheight = $(jacksbox).height();
		ptop -= $(window).scrollTop();
		
		//console.info(ipos, pleft, ptop, jwidth, jheight);
		virtualElement.getBoundingClientRect =
		    generateGetBoundingClientRect(pleft, ptop);
		
		$(popid).popover('update');
		$(popid).popover('show');
	    });
	    $(jacksbox).on("mouseleave", function (event) {
		$(popid).popover('hide');
	    });
	    $(jacksbox).on("click", function (event) {
		$(popid).popover('hide');
	    });
	    
	    $("body")
		.append("<div id=popover-" + jacksID + " " +
			"class='node-popover'></div>");

	    $(popid)
		.popover({"content"   : html,
			  "trigger"   : "manual",
			  "animation" : false,
			  "html"      : true,
			  "placement" : "auto",
			  "container" : 'body',
			  "reference" : virtualElement,
			 });
	}
	// And a popover on the listview page, using the same html.
	var id  = '#listview-row-' + node_id + ' td[name="status"]';
	var pop = bootstrap.Popover.getInstance(id);

	if (pop) {
	    pop.setContent({'.popover-body': html});
	}
	else {
	    $(id).popover({"content"   : html,
			   "trigger"   : "hover",
			   "html"      : true,
			   "container" : "body",
			   "placement" : "auto",
			  });
	    $(id).css('text-decoration', 'underline');
	}
    }

    // Update the node icon and color
    function UpdateNodeIcon(node_id, jacksID, icon, color)
    {
	var jacksbox = jacksNodeBox(jacksID);

	$(jacksbox).find('.node .node-status')
	    .css("visibility", "visible");

	if (color !== undefined) {
	    UpdateNodeColor(node_id, jacksID, color);
	}
	if (!$(jacksbox).find('.node .node-status-icon').length) {
	    $(jacksbox).find('.node .node-status')
		.append(svgimg.cloneNode());
	}
	$(jacksbox).find('.node .node-status-icon')
	    .attr("href", "fonts/" + icon);
    }

    // Update the node color
    function UpdateNodeColor(node_id, jacksID, color)
    {
	var jacksbox = jacksNodeBox(jacksID);
	
	$(jacksbox).find('.node .node-status')
	    .css("visibility", "visible");

	$(jacksbox).find('.node .nodebox')
	    .css("fill", color);
	
	$('#listview-row-' + node_id + ' td[name="status"]')
	    .css("background", color);
    }

    function deferAggregate(sliver)
    {
	var urn    = sliver.aggregate_urn;
	var reason = sliver.deferred_reason;
	var cause  = sliver.deferred_cause;
	    
	if (!_.has(jacksSites, urn)) {
	    // Manifest not processed yet.
	    return;
	}
	$.each(jacksSites[urn], function(node_id, jacksID) {
	    var html;
	    
	    if (reason) {
		html = reason;
	    }
	    else {
		html =
		    "This aggregate is currently unavailable so the node " +
		    "cannot be added to your experiment. We will continue " +
		    "trying to contact this aggregate.";
	    }
	    if (cause) {
		html = html + "<br><pre>" + cause + "</pre>";
	    }
	    // Warning color and question mark icon to indicate a popover.
	    UpdateNodeIcon(node_id, jacksID, "question.svg", "#ff9248");
	    UpdateNodePopover(node_id, jacksID, html);
	});
    }

    function OfflineAggregate(urn)
    {
	if (!_.has(jacksSites, urn)) {
	    // Manifest not processed yet.
	    return;
	}
	$.each(jacksSites[urn], function(node_id, jacksID) {
	    //console.info("deferAggregate: ", urn, node_id, jacksID);

	    var html = "This node is currently unreachable, operations on " +
		"this node will fail until it becomes reachable again.";

	    // Warning color and question mark icon to indicate a popover.
	    UpdateNodeIcon(node_id, jacksID, "question.svg", "#fcf8e3");
	    UpdateNodePopover(node_id, jacksID, html);
	});
    }

    function TerminatedAggregate(status, urn)
    {
	//console.info("terminatedAggregate: ", urn, status);
	
	if (!_.has(jacksSites, urn)) {
	    // Manifest not processed yet.
	    return;
	}
	$.each(jacksSites[urn], function(node_id, jacksID) {
	    var html;

	    //console.info("terminatedAggregate: ", urn, node_id, jacksID);

	    if (status == "terminated") {
		html = "This node has been deallocated and is no longer " +
		    "accessible by this experiment.";
	    }
	    else {
		html = "This node has been marked for removal from your " +
		    "experiment as soon as the aggregate comes back online.";
	    }
	    // Warning color and question mark icon to indicate a popover.
	    UpdateNodeIcon(node_id, jacksID, "question.svg", "red");
	    UpdateNodePopover(node_id, jacksID, html);
	    $('#listview-row-' + node_id + ' td[name="status"]')
		.html("terminated");
	});
    }

    function failedAggregate(sliver)
    {
	//console.info("failedAggregate", sliver);
	var cause = sliver.failure_cause;
	var urn   = sliver.aggregate_urn;
	
	if (!_.has(jacksSites, urn)) {
	    // Manifest not processed yet.
	    return;
	}
	
	$.each(jacksSites[urn], function(node_id, jacksID) {
	    var html;
	    
	    //console.info("failedAggregate: ", urn, node_id, jacksID);
	    /*
	     * Skip if we have details for the node, handled up above.
	     */
	    if (_.has(sliver.details, node_id)) {
		return
	    }

	    if (cause && cause != "") {
		html = "<pre>" + cause + "</pre>";
	    }
	    else {
		html =
		    "This aggregate failed, please check the log file for "+
		    "more information.";
	    }
	    // Warning color and question mark icon to indicate a popover.
	    UpdateNodeIcon(node_id, jacksID, "question.svg", "#ff4d4d");
	    UpdateNodePopover(node_id, jacksID, html);
	    SetupFailedNodeMenu(node_id, urn);
	});
    }

    function UpdateErrorPanel(statusblob)
    {
	var ePanel = $('#error-panel-new');
	
	if (!multisite) {
	    var sblob = _.values(statusblob)[0];
	    if (sblob.status != "failed") {
		ePanel.addClass("hidden");
		return;
	    }
	    var code    = sblob.failure_code;
	    var cause   = sblob.failure_cause;
	    var message = sblob.failure_message;

	    ePanel.find(".singlesite-errors .error-cause").text(cause);
	    ePanel.find(".singlesite-errors .error-message").text(message);
	    ePanel.find(".multisite-errors").addClass("hidden");
	    ePanel.find(".singlesite-errors").removeClass("hidden");
	    if (code == GENIRESPONSE_INSUFFICIENT_NODES ||
		code == GENIRESPONSE_NO_MAPPING) {
		ePanel.find(".resource-error").removeClass("hidden");
	    }
	    ePanel.removeClass("hidden");
	    return;
	}
	var errors   = 0;
	var template = ePanel.find(".error-template");

	$.each(statusblob , function(urn, sblob) {
	    if (!_.has(amlist, urn)) {
		//console.info("UpdateErrorPanel: Not in the amlist: " + urn);
		return;
	    }
	    var cluster = amlist[urn].nickname;
	    var gid = '[data-urn="' + urn + '"]';
	    var current = ePanel.find(".panel-group " + gid);

	    if (sblob.status != "failed") {
		if (current.length) {
		    current.find(".panel-collapse").removeClass("in");
		    current.addClass("hidden");
		}
		return;
	    }
	    var code    = sblob.failure_code;
	    var cause   = sblob.failure_cause;
	    var message = sblob.failure_message;
	    
	    if (!current.length) {
		current = template.clone();
		current.removeClass("error-template");
		current.attr("data-urn", urn);
		current.find(".panel-title a").html(cluster);
		current.find(".panel-title a").attr("href","#error-" + cluster);
		current.find(".panel-collapse").attr("id", "error-" + cluster);
		current.find(".panel-body .error-cause").text(cause);
		if (message != "") {
		    current.find(".panel-body .error-message")
			.text(message)
			.removeClass("hidden");
		}
		current.removeClass("hidden");
		if ($("#error-panel-new .panel-group").children().length <= 1) {
		    current.find(".panel-collapse").addClass("in");
		}
		$("#error-panel-new .panel-group").append(current);
	    }
	    current.find(".panel-body .error-message").text(message);
	    current.find(".panel-body .error-cause").text(cause);
	    current.removeClass("hidden");
	    if (code == GENIRESPONSE_INSUFFICIENT_NODES ||
		code == GENIRESPONSE_NO_MAPPING) {
		ePanel.find(".resource-error").removeClass("hidden");
	    }
	    errors++;
	});
	if (errors) {
	    ePanel.find(".multisite-errors").removeClass("hidden");
	    ePanel.find(".singlesite-errors").addClass("hidden");
	    ePanel.removeClass("hidden");
	}
	else {
	    ePanel.addClass("hidden");
	}
    }

    function UpdateGeneralError(error)
    {
	if (!error) {
	    $('#general-error').addClass("hidden");
	}
	else {
	    $('#general-error .error-cause').html(error);
	    $('#general-error').removeClass("hidden");
	}
    }

    //
    // Check the status blob to see if any nodes have execute services
    // still running.
    //
    function servicesExecuting(blob)
    {
	if (_.has(blob, "sliverstatus")) {
	    for (var urn in blob.sliverstatus) {
		var status = blob.sliverstatus[urn].status;
		if (status == "canceled" ||
		    status == "terminated" || status == "failed") {
		    continue;
		}
		var nodes = blob.sliverstatus[urn].details;
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
    //
    // Check if services are still executing on a node.
    //
    function servicesExecutingOnNode(client_id)
    {
	//console.info("servicesExecutingOnNode", lastStatusBlob, client_id);
	
	if (!lastStatusBlob || !_.has(lastStatusBlob, "sliverstatus")) {
	    return 0;
	}
	for (var urn in lastStatusBlob.sliverstatus) {
	    var nodes = lastStatusBlob.sliverstatus[urn].details;
	    if (_.has(nodes, client_id)) {
		var status = nodes[client_id];
		if (_.has(status, "execute_state")) {
		    return status.execute_state == "exited" ? 0 : 1;
		}
		// No execution services
		return 0;
	    }
	}
	// Do not know.
	return 0;
    }

    //
    // Check the status blob to see if any aggregates are in the
    // the deferred state.
    //
    function aggregatesDeferred(blob)
    {
	if (_.has(blob, "sliverstatus")) {
	    for (var urn in blob.sliverstatus) {
		if (blob.sliverstatus[urn].deferred != 0) {
		    return 1;
		}
	    }
	}
	return 0;
    }

    //
    // Show info when experiment is pending.
    //
    function ShowPendingInfo(blob)
    {
	if (_.has(blob, "sliverstatus")) {
	    for (var urn in blob.sliverstatus) {
		var details = blob.sliverstatus[urn];
		if (details.deferred == "1") {
		    $('#pending-panel .pending-reason')
			.html(details.deferred_reason);
		    if (_.has(details, "deferred_cause")) {
			$('#pending-panel .pending-cause')
			    .html(details.deferred_cause);
		    }
		    $('#pending-panel').removeClass("hidden");
		    return;
		}
	    }
	}
    }
	
    //
    // Request a node reboot or reload from the backend cluster.
    //
    function DoReboot(nodeList)
    {
	DoRebootReload("reboot", nodeList);
    }
    function DoReload(nodeList)
    {
	for (var i = 0; i < nodeList.length; i++) {
	    var node = nodeList[i];

	    if (_.has(inrecovery, node) && inrecovery[node]) {
		alert(node + " is in recovery mode, you cannot reload a node " +
		      "while it is in recovery mode");
		return;
	    }
	}
	DoRebootReload("reload", nodeList);
    }
    function DoPowerCycle(nodeList)
    {
	DoRebootReload("powercycle", nodeList);
    }
    function DoRebootReload(which, nodeList)
    {
	var method = (which == "reload" ? "Reload" :
		      which == "powercycle" ? "PowerCycle" : "Reboot");
	var tag    = (which == "reload" ? "Reload" :
		      which == "powercycle" ? "Power Cycle" : "Reboot");
	
	// Handler for hide modal to unbind the click handler.
	$('#confirm_reload_modal').on('hidden.bs.modal', function (event) {
	    $(this).unbind(event);
	    $('#confirm_reload_button').unbind("click.reload");
	});
	
	// Throw up a confirmation modal, with handler bound to confirm.
	$('#confirm_reload_button').bind("click.reload", function (event) {
	    window.APT_OPTIONS.gaButtonEvent(event);
	    sup.HideModal('#confirm_reload_modal');
	    var callback = function(json) {
		sup.HideModal('#waitwait-modal');
	    
		if (json.code) {
		    sup.SpitOops("oops",
				 "Failed to " + which + ": " + json.value);
		    return;
		}
		// Trigger status update.
		GetStatus();
	    }
	    sup.ShowModal('#waitwait-modal');
	    var xmlthing = sup.CallServerMethod(ajaxurl, "status", method,
						{"uuid"     : uuid,
						 "node_ids" : nodeList});
	    xmlthing.done(callback);
	});
	$('#confirm_reload_modal #confirm-which').html(tag);
	sup.ShowModal('#confirm_reload_modal');
    }
	
    //
    // Request a node deletion from the backend cluster.
    //
    function DoDeleteNodes(nodeList)
    {
	// Handler for hide modal to unbind the click handler.
	$('#deletenode_modal').on('hidden.bs.modal', function (event) {
	    $(this).unbind(event);
	    $('button#deletenode_confirm').unbind("click.deletenode");
	});
	
	// Throw up a confirmation modal, with handler bound to confirm.
	$('button#deletenode_confirm').bind("click.deletenode",
					    function (event) {
	    window.APT_OPTIONS.gaButtonEvent(event);
	    sup.HideModal('#deletenode_modal');
	
	    var callback = function(json) {
		console.info(json);
		sup.HideWaitWait();
		
		if (json.code) {
		    $('#error_panel_text').text(json.value);
		    $('#error_panel').removeClass("hidden");
		    return;
		}
		changingtopo = true;
		// Trigger status to change the nodes.
		GetStatus();
		// And max extension update
		LoadMaxExtension();
	    }
	    sup.ShowWaitWait("This will take several minutes. " +
			     "Patience please.");
	    var xmlthing = sup.CallServerMethod(ajaxurl,
						"status",
						"DeleteNodes",
						{"uuid"     : uuid,
						 "node_ids" : nodeList});
	    xmlthing.done(callback);
	});
        $('#error_panel').addClass("hidden");
	sup.ShowModal('#deletenode_modal');
    }

    /*
     * Boot node into recovery mode MFS
     *
     * In order to show something useful on the confirm modal, we track
     * what nodes we think are in recovery mode. See UpdateSliverStatus().
     */
    function DoRecovery(node)
    {
	// Handler for hide modal to unbind the click handler.
	$('#confirm_recovery_modal').on('hidden.bs.modal', function (event) {
	    $(this).unbind(event);
	    $('#confirm_recovery_button').unbind("click.recovery");
	});
	
	// Throw up a confirmation modal, with handler bound to confirm.
	$('#confirm_recovery_button').bind("click.recovery", function (event) {
	    window.APT_OPTIONS.gaButtonEvent(event);
	    sup.HideModal('#confirm_recovery_modal');
	    var callback = function(json) {
		sup.HideModal('#waitwait-modal');
	    
		if (json.code) {
		    sup.SpitOops("oops",
				 "Failed to set recovery mode: " + json.value);
		    return;
		}
	    }
	    var args = {"uuid"  : uuid,
			"node"  : node};
	    // Since we think its in recovery, clear it. 
	    if (_.has(inrecovery, node) && inrecovery[node]) {
		args["clear"] = true;
	    }
	    console.info(inrecovery, args);
	    sup.ShowModal('#waitwait-modal');
	    var xmlthing = sup.CallServerMethod(ajaxurl, "status",
						"Recovery", args);
						
	    xmlthing.done(callback);
	});
	if (_.has(inrecovery, node) && inrecovery[node]) {	
	    $('#confirm_recovery_modal .recovery-off').removeClass("hidden");
	    $('#confirm_recovery_modal .recovery-on').addClass("hidden");
	}
	else {
	    $('#confirm_recovery_modal .recovery-off').addClass("hidden");
	    $('#confirm_recovery_modal .recovery-on').removeClass("hidden");
	}
	sup.ShowModal('#confirm_recovery_modal');
    }
	
    /*
     * Flash a flashable device.
     */
    function DoFlash(node)
    {
	// Handler for hide modal to unbind the click handler.
	$('#confirm_flash_modal').on('hidden.bs.modal', function (event) {
	    $(this).unbind(event);
	    $('#confirm_flash_button').unbind("click.flash");
	});
	
	// Throw up a confirmation modal, with handler bound to confirm.
	$('#confirm_flash_button').bind("click.flash", function (event) {
	    var callback = function(json) {
		sup.HideModal('#waitwait-modal', function () {
		    if (json.code) {
			sup.SpitOops("oops",
				     "Failed to set flash node: " + json.value);
		    }
		    else {
			sup.ShowModal('#flash_done_modal');			
		    }
		});
	    }
	    var args = {"uuid"  : uuid,
			"node"  : node};

	    sup.HideModal('#confirm_flash_modal', function () {
		sup.ShowWaitWait("Flashing takes 1-2 minutes, " +
				 "patience please!");
		var xmlthing = sup.CallServerMethod(ajaxurl, "status",
						    "Flash", args);
		xmlthing.done(callback);
	    });
	});
	sup.ShowModal('#confirm_flash_modal');
    }
	
    /*
     * Fire up the backend of the ssh tab.
     *
     * If the local ops node is using a self-signed certificate (typical)
     * then the ajax call below will fail. But the protocol does not need
     * to tell is anything specific, so we will just assume that it is the
     * reason and try to get the user to accept a certificate from the ops
     * node.
     */
    function StartSSH(tabname, client_id, authobject)
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

            $('#' + tabname).html('<iframe id="' + tabname + '_iframe" ' +
			     'width=' + iwidth + ' ' +
                             'height=' + iheight + ' ' +
                             'src=\'' + url + '\'>');
	    
	    //
	    // Setup a custom event handler so we can kill the connection.
	    //
	    $('#' + tabname).on("killssh",
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
	var callback_error = function(stuff) {
	    console.info("SSH failure", stuff);
	    var url = jsonauth.baseurl + '/accept_cert.html';
	    // Trigger the kill button to get rid of the dead tab.
	    $("#" + tabname + "_kill").click();
	    // Set the link in the modal.
	    $('#accept-certificate').attr("href", url);
	    sup.ShowModal('#ssh-failed-modal');
	};
	
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
	xmlthing.fail(callback_error);
    }

    function StartSSHWebSSH(tabname, client_id, authobject)
    {
	var jsonauth = $.parseJSON(authobject);

        var url     = jsonauth.baseurl;
	var iwidth  = "100%";
        var iheight = 400;
	// For the execution service warning toggle.
	var cclass  = client_id + "-sshtab";

	if (!servicesExecutingOnNode(client_id)) {
	    cclass = "hidden " + cclass;
	}

	// Backwards compat for a while.
	if (!url.includes("webssh")) {
	    url = url + "/webssh/webssh.html";
	}

	var loadiframe = function () {
	    console.info("Sending message", jsonauth.baseurl);
	    iframewindow.postMessage(authobject, "*");
	    window.removeEventListener("message", loadiframe, false);
	};
	window.addEventListener("message", loadiframe);

	var html = '<iframe id="' + tabname + '_iframe" ' +
	    'width=' + iwidth + ' ' +
            'height=' + iheight + ' ' +
            'src=\'' + url + '\'>';

	var html =
	    '<div>' +
	    '<center class="text-warning ' + cclass + '" ' +
	    '        style="font-size: 120%;">' +
            ' Startup services are still running; ' +
	    ' Software may not be fully installed and running!</center>' +
	    '<div style="height:400px; width:100%; ' +
	    '            resize:vertical;overflow-y:auto;padding-bottom:10px"> ' +
	    '  <iframe id="' + tabname + '_iframe" ' +
	    '     width="100%" height="100%"' + 
            '     src=\'' + url + '\'>' +
	    '</div>' +
	    '</div>';
	
        $('#' + tabname).html(html);

	var iframe = $('#' + tabname + '_iframe')[0];
	var iframewindow = (iframe.contentWindow ?
			    iframe.contentWindow :
			    iframe.contentDocument.defaultView);	

	/*
	 * When the user activates this tab, we want to send a message
	 * to the terminal to focus so we do not have to click inside.
	 */
	$('#quicktabs_ul a[href="#' + tabname + '"]')
	    .on('shown.bs.tab', function (e) {
		iframewindow.postMessage("Focus man!", "*");
	    });
    }

    // Helper to set/clear the services executing warning on ssh tabs.
    function ClearServicesWarning(client_id)
    {
	// For the execution service warning toggle.
	var cclass  = client_id + "-sshtab";

	$('.' + cclass).addClass("hidden");

	// And the listview row sshurl warning tooltip
	var id = "#listview-row-" + client_id + ' [name="sshurl"]';

	$(id).tooltip("hide");
	$(id).tooltip("disable");
    }
    function MarkServicesWarning(client_id)
    {
	// For the execution service warning toggle.
	var cclass  = client_id + "-sshtab";

	$('.' + cclass).removeClass("hidden");

	// And the listview row sshurl warning tooltip
	var id = "#listview-row-" + client_id + ' [name="sshurl"]';

	$(id).tooltip("enable");
    }

    //
    // User clicked on a node, so we want to create a tab to hold
    // the ssh tab with a panel in it, and then call StartSSH above
    // to get things going.
    //
    var sshtabcounter = 0;

    // Check for services executing and throw up a warning.
    function NewSSHTab(hostport, client_id)
    {
	var node_id = clientid2nodeid[client_id];

	// Keeping this bullet in reserve
	if (1 || !servicesExecutingOnNode(client_id)) {
	    return NewSSHTabContinue(hostport, client_id);
	}

	// Handler for hide modal to unbind the click handler.
	$('#services-running-modal').on('hidden.bs.modal', function (event) {
	    $(this).unbind(event);
	    $('#services-continue-login').unbind("click.sshtab");
	});

	// Throw up a confirmation modal, with handler bound to confirm.
	$('#services-continue-login').bind("click.sshtab", function (event) {
	    sup.HideModal('#services-running-modal', function () {
		NewSSHTabContinue(hostport, client_id);
	    });
	});
	console.info("foo");
	sup.ShowModal('#services-running-modal');
    }
    function NewSSHTabContinue(hostport, client_id)
    {
	var pair = hostport.split(":");
	var host = pair[0];
	var port = pair[1];

	//
	// Need to create the tab before we can create the topo, since
	// we need to know the dimensions of the tab.
	//
	var tabname = client_id + "_" + ++sshtabcounter + "_tab";
	//console.info(tabname);
	
	if (! $("#" + tabname).length) {
	    // The tab.
	    var html = navTabLink(client_id, tabname);

	    // Append to end of tabs
	    $("#quicktabs_ul").append(html);

	    // GA handler.
	    var ganame = "ssh_" + sshtabcounter;
	    $('#quicktabs_ul a[href="#' + tabname + '"]')
		.on('shown.bs.tab', function (event) {
		    window.APT_OPTIONS.gaTabEvent("show", ganame);
		});
	    window.APT_OPTIONS.gaTabEvent("create", ganame);

	    // Install a click handler for the X button.
	    $("#" + tabname + "_kill").click(function(e) {
		window.APT_OPTIONS.gaTabEvent("kill", ganame);
		e.preventDefault();
		// Trigger the custom event.
		$("#" + tabname).trigger("killssh");
		// remove the li from the ul.
		$(this).parent().parent().remove();
		// Remove the content div.
		$("#" + tabname).remove();
		// Activate the initialtab
		SwitchToLastKnownTab();
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
		var jsonauth = $.parseJSON(json.value);
		
		if (APT_OPTIONS.webssh &&
		    _.has(jsonauth, "webssh") && jsonauth.webssh != 0) {
		    StartSSHWebSSH(tabname, client_id, json.value);
		}
		else {
		    StartSSH(tabname, client_id, json.value);
		}
	    }
	}
	var xmlthing = sup.CallServerMethod(ajaxurl,
					    "status",
					    "GetSSHAuthObject",
					    {"uuid" : uuid,
					     "hostport" : hostport});
	xmlthing.done(callback);
    }

    function DoVNC(node)
    {
	var hostport = hostportList[node].split(":");
	var host     = vnchost[node];

	console.info("DoVNC", host);
	
	// Ask the server for an authentication object that allows
	// to start an ssh shell.
	var callback = function(json) {
	    console.info(json.value);

	    if (json.code) {
		sup.SpitOops("oops", "Failed to get vnc auth object: " +
			     json.value);
		return;
	    }
	    OpenVNCWindow(node, json.value);
	}
	var xmlthing = sup.CallServerMethod(ajaxurl,
					    "status",
					    "GetVNCAuthObject",
					    {"uuid" : uuid,
					     "host" : host});
	xmlthing.done(callback);
    }
    // For Selenium testing
    window.DoVNC = DoVNC;
    
    function OpenVNCWindow(node, authobject)
    {
	var vncwindow = null;
	var jsonauth  = $.parseJSON(authobject);
        var url       = jsonauth.baseurl + "/novnc/vnc_emulab.html";

	if (vncpasswd == null) {
	    alert("You have not defined a VNC password in your profile");
	    return;
	}
		
	/*
	 * As with the webssh iframe, we need to know when it is so we
	 * can send it a message with the authobject and password.
	 */
	var data = {
	    "authobject" : authobject,
	    "password"   : vncpasswd,
	};
	var windowloaded = function () {
	    console.info("Sending message", data);
	    vncwindow.postMessage(JSON.stringify(data), "*");
	    window.removeEventListener("message", windowloaded, false);
	};
	window.addEventListener("message", windowloaded);

	vncwindow = window.open(url, "VNC " + node,
				"left=10,top=10,width=1825,height=1060");
    }

    // SSH info.
    var hostportList = {};

    // VNC hostname
    var vnchost = {};

    // Map client_id to node_id
    var clientid2nodeid = {};

    // Imageable nodes in its own list.
    var imageablenodes = {};

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
	//console.info("ContextMenuShow", jacksevent);
	
	// Foreign admins have no permission for anything.
	if (isfadmin) {
	    return;
	}
	var event = jacksevent.event;
	var client_id = jacksevent.client_id;
	var cid = "context-menu-" + client_id;
	var toggle = "#" + cid + " .dropdown-toggle"

	if (currentContextMenu) {
	    $('#context').contextmenu('closemenu');
	    $('#context').contextmenu('destroy');
	}
	if (!_.has(contextMenus, client_id)) {
	    console.info("ContextMenuShow no menu yet", client_id);
	    return;
	}

	// See https://popper.js.org/docs/v2/virtual-elements/ for an
	// explaination of this stuff. 
	var generateGetBoundingClientRect =
	    function(x = 0, y = 0) {
		return () => ({
		    width: 0,
		    height: 0,
		    left: x,
		    top: y,
		    right: x,
		    bottom: y,
		});
	    };

	/*
	 * Since the topology is in an iframe, need to move the
	 * context menu relative to that.
	 */
	var offset = $('#showtopo_statuspage').offset();
	//console.info(event.clientX, offset, $(window).scrollTop());
	event.clientX += parseInt(offset.left);
	event.clientY += parseInt(offset.top);

	// And compensate for scroll.
	event.clientY -= $(window).scrollTop();

	    
	const virtualElement = {
	    getBoundingClientRect :
	        generateGetBoundingClientRect(event.clientX,event.clientY),
	};
	$(toggle).dropdown({
	    "reference" : virtualElement,
	    "autoClose" : true,
	});

	currentContextMenu = cid;
	$(toggle).parent().one('hidden.bs.dropdown', function (event) {
	    currentContextMenu = null;
	});
	
	// More bootstrap 5 oddness, need to return from the Jacks event
	// before we do this. 
	setTimeout(function () {
	    $(toggle).dropdown('show');
	}, 10);
    }
    
    //
    // Same operation, but for the Site tag context menu.
    //
    function SiteContextMenuShow(event, sitetag, urn)
    {
	// Foreign admins have no permission for anything.
	if (isfadmin) {
	    return;
	}
	var nickname = $(sitetag).text();
	var cid = "site-context-menu";
	
	if (currentContextMenu) {
	    $('#context').contextmenu('closemenu');
	    $('#context').contextmenu('destroy');
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
		// Disabled menu items, but we still want user to see them.
		if ($(e.target).attr("disabled")) {
		    return;
		}
		SiteActionHandler($(e.target).attr("name"), urn);
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
	console.info(action,clientList);
	
	//
	// Do not show in the terminating or terminated state.
	//
	if (lastStatus == "terminated") {
	    alert("Your experiment is no longer active.");
	    return;
	}
	if (lastStatus == "unknown") {
	    alert("Server is temporarily unavailable. Try again later.");
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
	else if (action == "powercycle") {
	    DoPowerCycle(clientList);
	}
	else if (action == "delete") {
	    DoDeleteNodes(clientList);
	}
	else if (action == "reload") {
	    DoReload(clientList);
	}
	else if (action == "recovery") {
	    DoRecovery(clientList[0]);
	}
	else if (action == "nodetop") {
	    DoTop(clientList[0]);
	}
	else if (action == "servicelogs") {
	    DoServiceLogs(clientList[0]);
	}
	else if (action == "monitor") {
	    NewMonitorTab(clientList[0]);
	}
	else if (action == "txhistory") {
	    ShowTXGraph(clientList[0]);
	}
	else if (action == "flash") {
	    DoFlash(clientList[0]);
	}
	else if (action == "vnc") {
	    DoVNC(clientList[0]);
	}
    }

    //
    // Handler for the Site context menu.
    //
    function SiteActionHandler(action, urn)
    {
	console.info(action, urn);
	
	if (action == "delete") {
	    DoDeleteSite(urn);
	}
    }

    // Update the instruction templates from manifest info
    function UpdateInstructions(xml)
    {
	var uridata = {};
	MakeUriData(xml,uridata);
	
	console.info("UpdateInstructions", uridata);
	
	var instructionRenderer = new marked.Renderer();
	instructionRenderer.defaultLink = instructionRenderer.link;
	instructionRenderer.link = function (href, title, text) {
	    var template = UriTemplate.parse(href);
	    return this.defaultLink(template.expand(uridata), title, text);
	};
	var ref = $(xml).find("rspec_tour").find("instructions");
	if (!ref.length) {
	    FindEncryptionBlocks(xml, "");
	    return;
	}
	var itext = $(ref).text();

	marked.setOptions({ "sanitize" : true,
			    "renderer": instructionRenderer });

	FindEncryptionBlocks(xml, itext, function (text) {
	    // Search the instructions for {host-foo} pattern.
	    var regex   = /\{host-.*\}/gi;
	    var needed  = text.match(regex);
	    if (needed && needed.length) {
		_.each(uridata, function(host, key) {
		    regex = new RegExp("\{" + key + "\}", "gi");
		    text = text.replace(regex, host);
		});
	    }
	    // Stick the text in. 
	    try {
		text = marked(text);
	    }
	    catch(err) {
		console.info(err);
	    }
	    $('#instructions_text').html(text);
	    $('#instructions_text').find("a").prop("target", "_blank");
	    // Make the div visible.
	    $('#instructions_panel').removeClass("hidden");
	});
    }

    //
    // Show the topology inside the topo container. Called from the status
    // watchdog and the resize wachdog. Replaces the current topo drawing.
    //    
    function ShowTopo(statusblob, donefunc)
    {
	//console.info("ShowTopo", changingtopo, statusBusy, statusblob);

	// For Powder map redraw after topology change.
	var redrawpowdermap = false;

	//
	// Process the nodes in a single manifest.
	//
	var ProcessNodes = function(aggregate_urn, xml) {
	    var rawcount = $(xml).find("node, emulab\\:vhost").length;
	    
	    // Find all of the nodes, and put them into the list tab.
	    // Clear current table.
	    $(xml).find("node, emulab\\:vhost").each(function() {
		var node   = $(this).attr("client_id");
		
		// Only nodes that match the aggregate being processed,
		// since we send the same rspec to every aggregate.
		var manager_urn = $(this).attr("component_manager_id");
		if (!manager_urn.length || manager_urn != aggregate_urn) {
		    return;
		}
		//console.info("ProcessNodes", node, manager_urn);
		
		var tag    = $(this).prop("tagName");
		var isvhost= (tag == "emulab:vhost" ? 1 : 0);
		TimeStamp("Processing node " + node);
		var stype  = $(this).find("sliver_type");
		var login  = $(this).find("login");
		var coninfo= this.getElementsByTagNameNS(EMULAB_NS, 'console');
		var pcycle = this.getElementsByTagNameNS(EMULAB_NS, 'powercycle');
		var recover= this.getElementsByTagNameNS(EMULAB_NS, 'recovery');
		var vnode  = this.getElementsByTagNameNS(EMULAB_NS, 'vnode');
		var x11vnc = this.getElementsByTagNameNS(EMULAB_NS, 'x11vnc');
		var imageable =
		    this.getElementsByTagNameNS(EMULAB_NS, 'imageable');
		var flashable =
		    this.getElementsByTagNameNS(EMULAB_NS, 'flashable');
		var services = $(this).find("execute");
		var href   = "n/a";
		var ssh    = "n/a";
		var cons   = "n/a";
		var isfw   = 0;
		var node_id= null;
		var hwtype = null;
		var clone  = $("#listview-row").clone();
		var CMclone= $("#context-menu").clone();
		
		// Cause of nodes in the emulab namespace (vhost).
		if (!login.length) {
		    login = this.getElementsByTagNameNS(EMULAB_NS, 'login');
		}
		var canrecover = 0;
		if (recover.length) {
		    var available = $(recover).attr("available");
		    if (available === "true") {
			canrecover = 1;
		    }
		}

		// Change the ID of the clone so its unique.
		clone.attr('id', 'listview-row-' + node);
		// Set the client_id in the first column.
		clone.find(" [name=client_id]").html(node);
		// And the node_id/type. This is an emulab extension.
		if (vnode.length) {
		    node_id = $(vnode).attr("name");
		    hwtype  = $(vnode).attr("hardware_type");

		    // Link to the (public) shownode page.
		    var weburl = amlist[aggregate_urn].weburl +
			"/portal/show-node.php?node_id=" + node_id;
		    var html   = "<a href='" + weburl + "' target=_blank>" +
			node_id + "</a>";
		    clone.find(" [name=node_id]").html(html);

		    // Ditto for the node type.
		    weburl = amlist[aggregate_urn].weburl +
			"/portal/show-nodetype.php?type=" + hwtype;
		    html   = "<a href='" + weburl + "' target=_blank>" +
			hwtype + "</a>";
		    clone.find(" [name=type]").html(html);
		    clientid2nodeid[node] = node_id;

		    // Append to the CONFIRM button URL.
		    if (_.contains(CONFIRMTYPES, hwtype)) {
			var href = $('#confirm-stuff-button').attr("href");
			if (href == "#") {
			    href = "https://confirm.fyi/by-node/?nodes=";
			}
			else {
			    href = href + ",";
			}
			href = href + node_id + ":" + node;
			$('#confirm-stuff-button').attr("href", href);
			$('#confirm-stuff-button').removeClass("hidden");
		    }
		}
		// Convenience.
		clone.find(" [name=select]").attr("id", node);

		// Nice for Cloudlab/Powder
		if (window.ISPOWDER || window.ISCLOUD) {
		    var cluster = amlist[aggregate_urn].abbreviation;
		    
		    clone.find(" [name=cluster]").html(cluster);
		}

		if (stype.length &&
		    $(stype).attr("name") === "emulab-blockstore") {
		    clone.find(" [name=menu]").text("n/a");
		    return;
		}
		if (stype.length &&
		    $(stype).attr("name") === "firewall") {
		    isfw = 1;
		}
		else if (node_id) {
		    if (imageable.length) {
			var available = $(imageable).attr("available");
			if (available === "true") {
			    imageablenodes[node] = node_id;
			}
		    }
		    else {
			// All other named nodes are imageable
			// This can go when all clusters updated
			imageablenodes[node] = node_id;
		    }
		}
		/*
		 * Find the disk image (if any) for the node and display
		 * in the listview.
		 */
		if (vnode.length && $(vnode).attr("disk_image")) {
		    clone.find(" [name=image]")
			.html($(vnode).attr("disk_image"));
		}
		else if (stype.length) {
		    var dimage  = $(stype).find("disk_image");
		    if (dimage.length) {
			var name = $(dimage).attr("name");
			if (name) {
			    var hrn = sup.ParseURN(name);
			    if (hrn && hrn.type == "image") {
				var id = hrn.project + "/" + hrn.image;
				if (hrn.version != null) {
				    id = id + ":" + hrn.version;
				}
				clone.find(" [name=image]").html(id);
			    }
			}
		    }
		}

		if (login.length && dossh) {
		    var user   = window.APT_OPTIONS.thisUid;
		    var host   = $(login).attr("hostname");
		    var port   = $(login).attr("port");
		    var url    = "ssh://" + user + "@" + host + ":" + port +"/";
		    var sshcmd = "ssh" + (port == 22 ? "" : " -p " + port) + 
			" " + user + "@" + host;
		    href       = "<a href='" + url + "'><kbd>" + sshcmd +
			"</kbd></a>";
		
		    var hostport  = host + ":" + port;
		    hostportList[node] = hostport;

		    // Update the row.
		    clone.find(' [name=sshurl] .sshurl-url').html(href);

		    // Add a clipper
		    clone.find(' [name=sshurl] .sshurl-copy a').click(function (event) {
			event.preventDefault();
			navigator.clipboard.writeText(sshcmd);
		    });
		    clone.find(' [name=sshurl] .sshurl-copy').removeClass("hidden");

		    // Add a tooltip for services running warning. Leave disabled
		    // since we do not know until we get the sliver status. 
		    clone.find('[name="sshurl"]')
			.tooltip({"trigger"   : "hover",
				  "title"     : "<span class=text-warning>" +
				  "Execute services are still running, " +
				  "software may not be fully installed and running.</span>",
				  "html"      : true,
				  "container" : "body",
				  "placement" : "top"})
			.tooltip("disable");

		    // Attach handler to the menu button.
		    clone.find(' [name=shell]')
			.click(function (e) {
			    window.APT_OPTIONS.gaButtonEvent(e);
			    e.preventDefault();
			    ActionHandler("shell", [node]);
			    return false;
			});
		    // For selenium
		    window.StartShell = function() {
			ActionHandler("shell", [node]);
		    };
		}
		else {
		    // Need to do this on the context menu too, but painful.
		    clone.find(' [name=shell]')
			.parent().addClass('disabled');		    
		}

		//
		// Foreign admins do not get a menu, but easier to just
		// hide it.
		//
		if (isfadmin) {
		    clone.find(' [name=action-menu]')
			.addClass("invisible");
		}

		//
		// Now a handler for the console action.
		//
		if (coninfo.length) {
		    // Attach handler to the menu button.
		    clone.find(' [name=console]')
			.click(function (e) {
			    window.APT_OPTIONS.gaButtonEvent(e);
			    ActionHandler("console", [node]);
			});
		    clone.find(' [name=consolelog]')
			.click(function (e) {
			    window.APT_OPTIONS.gaButtonEvent(e);
			    ActionHandler("consolelog", [node]);
			});
		    // Remember we have a console, for the context menu.
		    consolenodes[node] = node;
		}
		else {
		    // Need to do this on the context menu too, but painful.
		    clone.find(' [name=consolelog]')
			.parent().addClass('disabled');		    
		    clone.find(' [name=console]')
			.parent().addClass('disabled');		    
		}
		// Not allowed to delete vhost/firewall or last node at site.
		if (! (isvhost || isfw || rawcount == 1)) {
		    //
		    // Delete button handler
		    //
		    clone.find(' [name=delete]')
			.click(function (e) {
			    window.APT_OPTIONS.gaButtonEvent(e);
			    ActionHandler("delete", [node]);
			});
		}
		else {
		    clone.find(' [name=delete]')
			.parent().addClass('disabled');		    
		}
		if (canrecover) {
		    // Recovery button handler
		    clone.find(' [name=recovery]')
			.click(function (e) {
			    ActionHandler("recovery", [node]);
			});
		}
		else {
		    clone.find(' [name=recovery]')
			.parent().addClass('disabled');		    
		}

		/*
		 * Powder; if the node is a radio (or hosts a radio)
		 * enable the option to load the monitor graph into
		 * a tab.
		 */
		if (window.ISPOWDER && radioinfo && node_id) {
		    var info = IsPowderTransmitter(manager_urn, node_id);
		    if (info) {
			clone.find(' [name=monitor]')
			    .click(function (e) {
				ActionHandler("monitor", [node]);
			    });
			clone.find(' [name=monitor]')
			    .parent().removeClass('hidden');

			// Context menu option
			CMclone.find("li[id=monitor]").removeClass("hidden");

			// TX History
			clone.find(' [name=txhistory]')
			    .click(function (e) {
				ActionHandler("txhistory", [node]);
			    });
			clone.find(' [name=txhistory]')
			    .parent().removeClass('hidden');

			// Context menu option
			CMclone.find("li[id=txhistory]").removeClass("hidden");

			// Mark it as a radio with its info. 
			radios[node] = info;

			// Show the experiment wide TX button.
			if ($('#txgraph_button').hasClass("hidden")) {
			    $('#txgraph_button').click(function (event) {
				event.preventDefault();
				ShowTXGraph();
			    });
			    $('#txgraph_button').removeClass("hidden");
			}
		    }

		    if (flashable.length) {
			var available = $(flashable).attr("available");
			if (available === "true") {
			    clone.find(' [name=flash]')
				.click(function (e) {
				    ActionHandler("flash", [node]);
				});
			    clone.find(' [name=flash]')
				.parent().removeClass('hidden');

			    // Context menu option
			    CMclone.find("li[id=flash]").removeClass("hidden");
			}
		    }
		}

		//
		// Power cycle handler
		//
		if (pcycle.length) {
		    // Attach handler to the menu button.
		    clone.find(' [name=powercycle]')
			.click(function (e) {
			    window.APT_OPTIONS.gaButtonEvent(e);
			    ActionHandler("powercycle", [node]);
			});
		    clone.find(' [name=powercycle]')
			.parent().removeClass('hidden');

		    // Context menu option
		    CMclone.find("li[id=powercycle]").removeClass("hidden");
		}

		// Optional X11 VNC
		if (x11vnc.length && dovnc) {
		    var host   = $(this).find("host");
		    
		    // Attach handler to the menu button.
		    clone.find(' [name=vnc]')
			.click(function (e) {
			    window.APT_OPTIONS.gaButtonEvent(e);
			    ActionHandler("vnc", [node]);
			});
		    vnchost[node] = $(host).attr("name");
		}
		else {
		    clone.find(' [name=vnc]')
			.parent().addClass('disabled');
		}

		// Optional service execution logs.
		if (services.length) {
		    clone.find(' [name=servicelogs]')
			.click(function (e) {
			    ActionHandler("servicelogs", [node]);
			});
		    clone.find(' [name=servicelogs]')
			.parent().removeClass('hidden');
		    // Context menu option
		    CMclone.find("li[id=servicelogs]")
			.removeClass("hidden");
		}

		// Node "top"
		clone.find(' [name=nodetop]')
		    .click(function (e) {
			ActionHandler("nodetop", [node]);
		    });
		clone.find(' [name=nodetop]')
		    .parent().removeClass('hidden');
		// Context menu option
		CMclone.find("li[id=nodetop]").removeClass("hidden");

		// Insert into the table, we will attach the handlers below.
		$('#listview_table')
		    .find('tbody').append(clone)
		    .trigger('addRows', [clone, true, undefined]);

		// Change the ID of the clone so its unique.
		CMclone.attr('id', "context-menu-" + node);

		// Remove old one (modify)
		$('#context-menu-' + node).remove();

		// Insert into the context-menus div.
		$('#context-menus').append(CMclone);

		// Activate tooltips in the menu.
		$('#context-menu-' + node + ' [data-toggle="tooltip"]')
		    .each(function () {
			$(this).tooltip({"trigger"   : "hover",
					 "placement" : "right",
					});
		    });

		// If no console, then grey out the options.
		if (!_.has(consolenodes, node)) {
		    $(CMclone).find("li[id=console]").addClass("disabled");
		    $(CMclone).find("li[id=consolelog]").addClass("disabled");
		    // For ActionHandler()
		    $(CMclone).find("[name=console]").attr("disabled", true);
		    $(CMclone).find("[name=consolelog]").attr("disabled", true);
		}
		// If no recovery mode, grey out the option.
		if (!canrecover) {
		    $(CMclone).find("li[id=recovery]").addClass("disabled");
		    // For ActionHandler()
		    $(CMclone).find("[name=recovery]").attr("disabled", true);
		}
		if (! (login.length && dossh)) {
		    $(CMclone).find("li[id=shell]").addClass("disabled");
		    // For ActionHandler()
		    $(CMclone).find("[name=shell]").attr("disabled", true);
		}
		if (! (x11vnc.length && dovnc)) {
		    $(CMclone).find("li[id=vnc]").addClass("disabled");
		    // For ActionHandler()
		    $(CMclone).find("[name=vnc]").attr("disabled", true);
		}
		
		// If a vhost/firewall, then grey out options. Or if there
		// is just one node at this site.
		if (isvhost || isfw || rawcount == 1) {
		    $(CMclone).find("li[id=delete]").addClass("disabled");
		    // For ActionHandler()
		    $(CMclone).find("[name=delete]").attr("disabled", true);
		}

		// And now enable the menu items that are not disabled.
		$(CMclone).find("li").each(function () {
		    if ($(this).attr("disabled")) {
			return;
		    }
		    $(this).find("a").click(function (e) {
			ActionHandler($(this).attr("name"), [node]);
		    });
		});
		contextMenus[node] = CMclone;
		nodecount++;
	    });
	}

	/*
	 * After reloading the topology or deleting a node, just rebuild
	 * everything. 
	 */
	if (changingtopo) {
	    // Clear the list view table before adding nodes again.
	    $('#listview_table > tbody').html("");
	    $('#listview_table').trigger('update');
	    // Reload all manifests.
	    manifests = {};
	    // Need to redo all this stuff
	    clientid2nodeid = {};
	    imageablenodes  = {};
	    jacksIDs = {};
	    jacksSites = {};
	    contextMenus = {};
	    
	    redrawpowdermap = true;

	    // But might have deleted all the aggregates.
	    if (Object.keys(statusblob).length == 0) {
		changingtopo = false;
		ClearViewer();
		if (window.ISPOWDER) {
		    UpdatePowderMap();
		}
		donefunc();
		return;
	    }
	}
	/*
	 * If we have all the manifests then nothing to do.
	 */
	if (Object.keys(statusblob).length == Object.keys(manifests).length) {
	    donefunc();
	    return;
	}

	// Flag to mark first manifest (group). A bunch of stuff needs to be
	// done on the first manifest but not after that that,
	var onlyfirst = (!_.size(manifests) ? true : false);
	
	/*
	 * This is the continuation we run after we have all the
	 * manifests that are currently available.
	 */
	var gotallmanifests = function() {
	    console.info("gotallmanifests");
	    
	    // Update the snapshot modal with new nodes.
	    UpdateSnapshotModal();

	    // Site context menu setup.
	    setTimeout(SetupSiteContextMenus, 3000);

	    if (window.ISPOWDER) {
		if (redrawpowdermap) {
		    UpdatePowderMap()
		}
		else {
		    var showmap = false;

		    // If we have at least one manifest, show the map.
		    $.each(statusblob, function(urn) {
			if (_.has(manifests, urn)) {
			    showmap = true;
			}
		    });
		    if (showmap) {
			ShowPowderMapTab();
		    }
		}
	    }
	    // Signal GetStatus() looper that we are done, 
	    donefunc();
	};

	/*
	 * Process one manifest at a time, then finish with above function.
	 */
	var gotonemanifest = async function(aggregate_urn, manifest, defer) {
	    console.info("gotonemanifest", aggregate_urn);

	    var xmlDoc = $.parseXML(manifest);
	    var xml = $(xmlDoc);
	    TimeStamp("Proccessing nodes");
	    ProcessNodes(aggregate_urn, xml);
	    TimeStamp("Done proccessing nodes");

	    /*
	     * Wait until we have first manifest before initializing this,
	     * else the user sees a blank palette.
	     */
	    if (onlyfirst) {
		$("#showtopo_container").removeClass("hidden");
		$('#quicktabs_ul a[href="#manifest"]')
		    .parent().removeClass("hidden");
		$('#quicktabs_content #manifest').removeClass("hidden");
		/*
		 * Cannot be hidden to initialize tablesorter
		 */
	   	$('#quicktabs_ul a[href="#listview"]')
		    .parent().removeClass("hidden");
		$('#quicktabs_content #listview').removeClass("hidden");
	    }
	    multisite = Object.keys(statusblob).length > 1;
	    console.info("foo", multisite, nodecount, jacksInstance);

	    if (multisite || nodecount < MAXJACKSNODES) {
		if (!jacksInstance) {
		    await ShowTopologyTab(multisite, manifest);
		}
		else if (changingtopo) {
		    // When we get first new manifest, clear the viewer palette.
		    ClearViewer(manifest);
		}
		else {
		    AddToViewer(manifest);
		}
	    }
	    else {
		// Not going to show a topology, default to list.
		$('#quicktabs_ul a[href="#listview"]').tab('show');
		
		// Without jacks, we show the manifest now, otherwise
		// jacks combines them and hands it back.
		ShowManifest(manifest);
	    }
	    if (multisite) {
		$('#multisite-context-menu-notice').removeClass("hidden");
	    }
	    else {
		$('#multisite-context-menu-notice').addClass("hidden");
	    }

	    // Clear changingtopo state on first new manifest.
	    if (changingtopo) {
		changingtopo = false;
	    }

	    /*
	     * No point in showing linktest if no links at any site.
	     * For the moment, we do not count links if they span sites
	     * since linktest does not work across stitched links.
	     *
	     * We reset showlinktest cause we get called again after
	     * a topo change or reload.
	     */
	    showlinktest = false;
	    $(xml).find("link").each(function() {
		var managers = $(this).find("component_manager");
		if (managers.length == 1)
		    showlinktest = true;
	    });
	    SetupLinktest(instanceStatus);

	    // If there is a shared lan, show the connect-sharedlan button
	    $(xml).find("link").each(function() {
		var shared = this.getElementsByTagNameNS(SVLAN_NS,
							 'link_shared_vlan');
		if (shared.length != 0) {
		    SetupConnectLanModal($(this).attr('client_id'));
		}
	    });

	    // Mark that we have this manifest;
	    manifests[aggregate_urn] = manifest;
	    onlyfirst = false;
	    defer.resolve();
	}
	/*
	 * If there are any manifests available that we have not asked for,
	 * ask for those, waiting until they all return before calling
	 * gotallmanifests(). 
	 */
	var urns = [];
	_.each(statusblob, function(info, urn) {
	    if (!_.has(manifests, urn) && info.havemanifest) {
		urns.push(urn);
	    }
	});
	if (!_.size(urns)) {
	    donefunc();
	    return;
	}

	/*
	 * The point of all this goo is to ensure that we process
	 * one manifest at a time (since there are async calls made
	 * during the processing). 
	 */
	var processManifests = async function (json) {
	    console.info("processManifests", json);
	    if (json.code) {
		console.info("GetInstanceManifests:" + json.value);
		// Still do this, it calls the donefunc.
		gotallmanifests();
		return -1;
	    }
	    var tasks = [];
	    _.each(json.value, function(m, urn) {
		tasks.push(async function () {
		    var defer = $.Deferred();
		    await gotonemanifest(urn, m, defer);
		    return defer;
		});
	    });
	    await resolvepromises(tasks);
	    gotallmanifests();
	};
	console.info("Asking for manifests", urns);

	/*
	 * Need to wait for this to return so we can call the donefunc()
	 * when all of the manifests are processed.
	 */
	var deferred = sup.CallServerMethod(null, "status",
					   "GetInstanceManifests",
					   {"uuid" : uuid,
					    "aggregate_urns" : urns});
	$.when(deferred).done(function (json) {
	    processManifests(json);
	});
    }

    // Just a helper function to process a list of promises serially.
    async function resolvepromises(tasks)
    {
	for (var i = 0; i < _.size(tasks); i++) {
	    var func = tasks[i];
	    await func();
	}
    }

    //
    // Show the manifest in the tab, using codemirror.
    //
    function ShowManifest(manifest)
    {
	//console.info("ShowManifest");
	
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
	ShowBindings();

	// On a multisite topology, Jacks combines them as it gets them.
	// We have to save the (final) combined manifest.
	jacksManifest = manifest;

	// And update instructions, since the updated manifest can
	// innclude new info
	var xmlDoc = $.parseXML(jacksManifest);
	var xml    = $(xmlDoc);
	    
	UpdateInstructions(xml);
    }

    //
    // Show the rspec in the tab, using codemirror.
    //
    function ShowRspec()
    {
	var mode   = "text/xml";

	$("#rspec_textarea").css("height", "300");
	$('#rspec_textarea .CodeMirror').remove();

	var callback = function (json) {
	    //console.info(json);
	    if (json.code) {
		console.info("Could not get rspec: " + json.value);
		return;
	    }
	    var myCodeMirror = CodeMirror(function(elt) {
		$('#rspec_textarea').prepend(elt);
	    }, {
		value: json.value,
		lineNumbers: false,
		smartIndent: true,
		mode: mode,
		readOnly: true,
	    });

	    $('#show_rspec_tab').on('shown.bs.tab', function (e) {
		myCodeMirror.refresh();
	    });
	    $("#showtopo_container").removeClass("hidden");
	    $('#quicktabs_ul a[href="#rspec"]').parent().removeClass("hidden");
	    $('#quicktabs_content #rspec').removeClass("hidden");
	    $('#quicktabs_ul a[href="#rspec"]').tab('show');
	};
	sup.CallServerMethod(null, "status", "GetRspec",
			     {"uuid"     : uuid}, callback);
    }

    //
    // Show the parameter bindings in the tab.
    //
    function ShowBindings()
    {
	// Only parameterized profiles of course.
	if (! expinfo.paramdefs) {
	    return;
	}
	// Enable the Save Params button. 
	if (expinfo.profile_uuid != "unknown" && expinfo.params &&
	    $('#save_paramset_button').hasClass("hidden")) {
	    $('#save_paramset_button')
		.removeClass("hidden")
		.popover({trigger:  'hover',
			  placement:'auto',
			  container:'body'})
		.click(function (event) {
		    paramsets.InitSaveParameterSet('#save_paramset_div',
						   expinfo.profile_uuid,
						   uuid);
		});
	    $('#rerun_button')
	        .click(function (e) {
		    e.preventDefault();
		    sup.ShowModal("#rerun_modal");
		})
		.removeClass("hidden");
	    // Bind the copy to clipbload button in the share modal
	    window.APT_OPTIONS.SetupCopyToClipboard("#rerun_modal");

	}
	if (expinfo.params &&
	    $('#quicktabs_content #bindings').hasClass("hidden")) {
	    var bindings  = expinfo.params;
	    var paramdefs = expinfo.paramdefs;
	    var html = GetBindingsTable(paramdefs, bindings);
	    $('#bindings_table tbody').html(html);
	    $('#quicktabs_ul a[href="#bindings"]')
		.parent().removeClass("hidden");
	    $('#quicktabs_content #bindings').removeClass("hidden");
	}
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

    function FindEncryptionBlocks(xml, itext, continuation)
    {
	var blocks    = {};
	var passwords = xml[0].getElementsByTagNameNS(EMULAB_NS, 'password');

	// Search the instructions for the pattern.
	var regex   = /\{password-.*\}/gi;
	var needed  = itext.match(regex);
	//console.log(needed);

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
	    // XXX
	    if (key == "password-vncpasswd" || key == "password-vncpswd") {
		blocks[key] = stuff;
	    }
	});
	if (!_.size(blocks)) {
	    if (continuation) {
		continuation(itext);
	    }
	    return;
	}
	console.info("blocks", blocks);
	
	// These are blocks that are referenced in the instructions
	// and need the server to decrypt.  At some point we might
	// want to do that here in javascript, but maybe later.
	//console.log(blocks);

	var callback = function(json) {
	    console.log("decrypt blocks", json);
	    if (json.code) {
		sup.SpitOops("oops", "Could not decrypt secrets: " +
			     json.value);
		return;
	    }
	    _.each(json.value, function(plaintext, key) {
		// XXX
		if (key == "password-vncpasswd" || key == "password-vncpswd") {
		    vncpasswd = plaintext;
		}
		
		key = new RegExp("{" + key + "}", "g");
		// replace in the instructions text.
		itext = itext.replace(key, plaintext);
	    });
	    if (continuation) {
		continuation(itext);
	    }
	};
    	var xmlthing = sup.CallServerMethod(ajaxurl,
					    "status",
					    "DecryptBlocks",
					    {"uuid"   : uuid,
					     "blocks" : blocks});
	xmlthing.done(callback);
    }

    /*
     * Add a context menu to the site tags
     *
     * XXX
     * This does not work since moving Jacks into an iframe.
     * Need a work around.
     */
    function SetupSiteContextMenus()
    {
	// We do not have Jacks support, so find the site blob labels.

	$('g.sitelabelgroup text.sitetext').each(function () {
	    var sitetag  = this;
	    var nickname = $(this).text();
	    if (nickname == "") {
		return;
	    }
	    // Gotta find the URN.
	    _.each(amlist, function (info, urn) {
		if (info.nickname == nickname) {
		    $(sitetag).click(function (event) {
			SiteContextMenuShow(event, nickname, urn);
		    });
		}
	    });
	});
    }

    /*
     * Add a context menu to a node at a failed site that allows 
     * it (the site) to be deleted.
     */
    function SetupFailedNodeMenu(client_id, urn)
    {
	// Called from UpdateSliverStatus so repeats.
	if (_.has(contextMenus, client_id)) {
	    return;
	}
	var clone = $("#site-context-menu").clone();

	// Change the ID of the clone so its unique.
	clone.attr('id', "context-menu-" + client_id);

	// Handler
	$(clone).find("[name=delete]").click(function (event) {
	    event.preventDefault();
	    DoDeleteSite(urn);
	});

	// Insert into the context-menus div.
	$('#context-menus').append(clone);

	// Remember for ActionHandler
	contextMenus[client_id] = clone;
    }

    /*
     * Delete a site.
     */
    function DoDeleteSite(urn)
    {
	var nickname = amlist[urn].nickname;

	sup.ShowConfirmModal('#deletesite_modal', function () {
	    var callback = function(json) {
		console.info(json);
		sup.HideWaitWait(function () {		
		    if (json.code) {
			sup.SpitOops("oops", json.value);
			return;
		    }
		});
		// Pickup the change before next interval timeout
		GetStatus();
	    }
	    sup.ShowWaitWait("This will take several minutes. " +
			     "Patience please.");
	    var xmlthing = sup.CallServerMethod(ajaxurl,
						"status",
						"DeleteSite",
						{"uuid"     : uuid,
						 "cluster"  : nickname});
	    xmlthing.done(callback);
	});
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
			 },
	                 false);
    }

    function SetupSnapshotModal()
    {
	var snapshot_help_timer;
	var clone_help_timer;

	/*
	 * We now show the single imaging button all the time. The workflow
	 * we present later depends on canclone/cansnap. But not allowed
	 * to clone a repo based profile.
	 */
	if (! (window.APT_OPTIONS.canclone_profile ||
	       window.APT_OPTIONS.canupdate_profile ||
	       window.APT_OPTIONS.cansnapshot)) {
	    return;
	}

	$("button#snapshot_button").click(function(event) {
	    $('button#snapshot_button').popover('hide');
	    DoSnapshotNode();
	});

	/*
	 * Various help buttons for snapshot choices.
	 */
	var visibleHelp = null;
	
	$('.snapshot-help-button').each(function () {
	    var target  = $(this).find("span");
	    var which   = target.data("which");
	    var content = null;
	    
	    console.info("foo", this, which, target);

	    switch(which) {
	    case 'update-profile':
		content = $('#snapshot-help-div').html();
		break;
	    case 'copy-profile':
		content = $('#clone-help-div').html();
		break;
	    case 'image-only':
		content = $('#imageonly-help-div').html();
		break;
	    }
	    $(target).popover({
		html:     true,
		content:  content,
		trigger:  'manual',
		placement:'auto',
		container:'body',
	    });
	    
	    $(this).click(function (event) {
		event.preventDefault();

		if (visibleHelp) {
		    var tmp = visibleHelp;
		    visibleHelp = null;
		    
		    tmp.popover('hide');
		    // Clicked on the same one, hide it and leave.
		    if (tmp.data("which") == which) {
			return;
		    }
		}
		$(target).popover('show');
		visibleHelp = $(target);

		// Bind the close button, sleazy internal stuff.
		$(target).data('bs.popover').tip()
		    .find(".close").click(function (event) {
			$(target).popover('hide');
			$(this).off("click");
			visibleHelp = null;
		    });
	    });
	});
	
	$('#snapshot_modal input[type=radio]').on('change', function() {
	    switch($(this).val()) {
	    case 'update-profile':
		$('#snapshot-name-div').addClass("hidden");
		$('#snapshot-wholedisk-div').addClass("hidden");
		break;
	    case 'copy-profile':
		$('#snapshot-name-div .image-only').addClass("hidden");
		$('#snapshot-name-div .copy-profile').removeClass("hidden");
		$('#snapshot-name-div').removeClass("hidden");
		if (wholedisk) {
		    $('#snapshot-wholedisk-div').removeClass("hidden");
		}
		break;
	    case 'image-only':
		$('#snapshot-name-div .copy-profile').addClass("hidden");
		$('#snapshot-name-div .image-only').removeClass("hidden");
		$('#snapshot-name-div').removeClass("hidden");
		if (wholedisk) {
		    $('#snapshot-wholedisk-div').removeClass("hidden");
		}
		break;
	    }
	});

	/*
	 * Hide choices in the snapshot modal per the flags.
	 */
	if (isscript ||
	    (!window.APT_OPTIONS.canclone_profile &&
	     !window.APT_OPTIONS.canupdate_profile)) {
	    $('#snapshot-name-div .image-only').removeClass("hidden");
	    $('#snapshot-name-div').removeClass("hidden");
	    if (wholedisk) {
		$('#snapshot-wholedisk-div').removeClass("hidden");
	    }
	}
	else {
	    if (!window.APT_OPTIONS.canclone_profile) {
		$('#copy-profile-radio').remove();
	    }
	    else if (!window.APT_OPTIONS.canupdate_profile) {
		$('#update-profile-radio').remove();
	    }
	    // As per the 'isscript' test above, one of these must be
	    // available, so make the other the default.
	    if (!window.APT_OPTIONS.canupdate_profile) {
		    $('#copy-profile').prop("checked", true);
		    $('#copy-profile').trigger("change");
	    }
	}
    }

    /*
     * Update the list of nodes in the modal as manifests come in.
     */
    function UpdateSnapshotModal() {
	/*
	 * We now show the single imaging button all the time. The workflow
	 * we present later depends on canclone/cansnap. But not allowed
	 * to clone a repo based profile.
	 */
	if (! (window.APT_OPTIONS.canclone_profile ||
	       window.APT_OPTIONS.canupdate_profile ||
	       window.APT_OPTIONS.cansnapshot)) {
	    return;
	}
	$("#snapshot_button").removeClass("hidden");

	/*
	 * Create an options list for the dropdown. We are going to replace
	 * the existing contents, so add the first option.
	 */
	var html = "<option value=''>Please Select a Node</option>";
		    
	_.each(imageablenodes, function (node_id, client_id) {
	    html = html +
		"<option value='" + client_id + "'>" +
		client_id + " (" + node_id + ")" +
		"</option>";
	});
	$('#snapshot_modal .choose-node select').html(html);

	if (Object.keys(imageablenodes).length == 1) {
	    // One node, stick that into the first sentence.
	    var nodename = Object.keys(imageablenodes)[0];
	    $('#snapshot_modal .one-node .node_id')
		.html(nodename + " (" + imageablenodes[nodename] + ")");
	    $('#snapshot_modal .choose-node').addClass("hidden");
	    $('#snapshot_modal .one-node.text-info').removeClass("hidden");
	    // And select it in the options for later, but stays hidden.
	    $('#snapshot_modal .choose-node select').val(nodename);
	}
	else {
	    $('#snapshot_modal .one-node.text-info').addClass("hidden");
	    $('#snapshot_modal .choose-node').removeClass("hidden");
	}

	/*
	 * If the user decides to create an image only, then lets try
	 * to guide them to reasonable choice for the name to use. 
	 */
	if (Object.keys(imageablenodes).length == 1) {
	    /*
	     * If allowed to update image, then use the current profile name.
	     * Otherwise might as well let them choose the name.
	     */
	    if (window.APT_OPTIONS.cansnapshot) {
		$('#snapshot-name-div input')
		    .val(expinfo.profile_name);
		$('#snapshot-name-div .snapshot-name-warning')
		    .removeClass("hidden");
	    }
	    $('#snapshot_modal .choose-node select').off("change");
	}
	else {
	    /*
	     * Lets append the name of the choosen node to the profile name.
	     */
	    $('#snapshot_modal .choose-node select').off("change");
	    $('#snapshot_modal .choose-node select')
		.on("change", function (event) {
		    var node = $(this).val();
		    var name = expinfo.profile_name + "." + node;
		    $('#snapshot-name-div input').val(name);
		    $('#snapshot-name-div .snapshot-name-warning')
			.removeClass("hidden");
		});
	}
    }

    /*
     * New version of disk image creation.
     */
    function DoSnapshotNode()
    {
	// Do not allow snapshot if the experiment is not in the ready state.
	if (lastStatus != "ready") {
	    alert("Experiment is not ready yet, snapshot not allowed");
	    return;
	}
	// Clear previous errors
	$('#snapshot_modal .snapshot-error').addClass("hidden");
	
	// Default to unchecked any time we show the modal.
	//$('#snapshot_update_prepare').prop("checked", false);
	//$('#snapshot-wholedisk').prop("checked", false);
	
	//
	// Watch for the case that we would create a new version of a
	// system image.  Warn the user of this.
	//
	if (expinfo.project == EMULAB_OPS) {
	    $('#cancel-update-systemimage').click(function() {
		sup.HideModal('#confirm-update-systemimage-modal');
	    });
	    $('#confirm-update-systemimage').click(function() {
		sup.HideModal('#confirm-update-systemimage-modal');
		DoSnapshotNodeAux();
	    });
	    sup.ShowModal('#confirm-update-systemimage-modal',
			  function() {
			      $('#cancel-update-systemimage')
				  .off("click");
			      $('#confirm-update-systemimage')
				  .off("click");
			  });
	    return;
	}
	DoSnapshotNodeAux();
    }
    function DoSnapshotNodeAux()
    {
	var node_id;

	// Handler for the Snapshot confirm button.
	$('button#snapshot_confirm').bind("click.snapshot", function (event) {
	    event.preventDefault();
	    
	    // Clear previous errors
	    $('#snapshot_modal .snapshot-error').addClass("hidden");
	    
	    // Make sure node is selected (one node, it is forced selection).
	    node_id = $('#snapshot_modal .choose-node select ' +
			'option:selected').val();
	    if (node_id === undefined || node_id === '') {
		$('#snapshot_modal .choose-node-error')
		    .text("Please choose a node");
		$('#snapshot_modal .choose-node-error').removeClass("hidden");
		return;
	    }
	    $('#snapshot_modal .choose-node-error').addClass("hidden");

	    // What does the user want to do?
	    var operation =
		(isscript ? "image-only" :
		 $('#snapshot_modal input[type=radio]:checked').val());
	    
	    var args = {"uuid" : uuid,
			"node_id" : node_id,
			"operation" : operation,
			"update_prepare" : 0};
	    // Make sure we got an image/profile name.
	    if (operation == 'image-only') {
		var name = $('#snapshot-name-div input').val();
		if (name == "") {
		    $('#snapshot-name-div .name-error')
			.text("Please provide an image name");
		    $('#snapshot-name-div .name-error').removeClass("hidden");
		    return;
		}
		args["imagename"] = name;
	    }
	    else if (operation == "copy-profile" ||
		     operation == "new-profile") {
		var name = $('#snapshot-name-div input').val();
		if (name == "") {
		    $('#snapshot-name-div .name-error')
			.text("Please provide a profile name");
		    $('#snapshot-name-div .name-error').removeClass("hidden");
		    return;
		}
		args["profilename"] = name;
	    }
	    if ($('#snapshot_update_prepare').is(':checked')) {
		args["update_prepare"] = 1;
	    }
	    if (wholedisk &&
		$('#snapshot-wholedisk').is(':checked') &&
		(operation == "copy-profile" ||
		 operation == "new-profile" || operation == "image-only")) {
		args["wholedisk"] = 1;
	    }
	    args["description"] = 
		$.trim($('#snapshot-description-div textarea').val());

	    if (operation == "copy-profile" || operation == "new-profile") {
		NewProfile(args);
	    }
	    else {
		StartSnapshot(args);
	    }
	});

	// Handler for hide modal to unbind the click handler.
	$('#snapshot_modal').on('hidden.bs.modal', function (event) {
	    $(this).unbind(event);
	    $('button#snapshot_confirm').unbind("click.snapshot");
	    // Hide any popovers still showing.
	    $('.snapshot-help-button').each(function () {
		var target = $(this).find("span");
		target.popover('hide');
	    });
	});

	sup.ShowModal('#snapshot_modal');
    }
    
    function StartSnapshot(args)
    {
	var callback = function(json) {
	    console.log("StartSnapshot");
	    console.log(json);
	    sup.HideWaitWait(function () {
		if (json.code) {
		    if (json.code == GENIRESPONSE_ALREADYEXISTS &&
			_.has(args, "wholedisk")) {
			sup.SpitOops("oops",
				 "There is already an image with the " +
				 "the name you requested. When using the " +
				 "<em>wholedisk</em> option, you must create " +
				 "a brand new image. " +
				 "If you really want to use this name, " +
				 "please <a href='list-images.php'>" +
				 "delete the existing image first</a>.");
			return;
		    }
		    sup.SpitOops("oops", json.value);
		    return;
		}
		ShowProgressModal();
	    });
	};
	CheckSnapshotArgs(args, function() {
	    sup.HideModal('#snapshot_modal', function () {
		sup.ShowWaitWait("Starting image capture, " +
				 "this can take a minute. " +
				 "Patience please.");

		sup.CallServerMethod(ajaxurl, "status",
				     "SnapShot", args, callback);
	    });
	});
    }

    /*
     * First do an initial check on the arguments.
     */
    function CheckSnapshotArgs(args, continuation)
    {
	args["checkonly"] = 1;
	sup.CallServerMethod(ajaxurl, "status", "SnapShot", args,
	     function (json) {
		 console.info("CheckSnapshotArgs");
		 console.info(json);
		 if (json.code) {
		     if (json.code != 2) {
			 $('#snapshot_modal .general-error')
			     .text(json.value)
			 $('#snapshot_modal .general-error')
			     .removeClass("hidden");
			 return;
		     }
		     if (_.has(json.value, "imagename")) {
			 $('#snapshot_modal .name-error')
			     .html(json.value.imagename);
			 $('#snapshot_modal .name-error')
			     .removeClass("hidden");
		     }
		     if (_.has(json.value, "description")) {
			 $('#snapshot_modal .description-error')
			     .html(json.value.description);
			 $('#snapshot_modal .description-error')
			     .removeClass("hidden");
		     }
		     if (_.has(json.value, "node_id")) {
			 $('#snapshot_modal .choose-node-error')
			     .html(json.value.node_id);
			 $('#snapshot_modal .choose-node-error')
			     .removeClass("hidden");
		     }		     
		     return;
		 }
		 args["checkonly"] = 0;
		 continuation(args);
	     });
    }

    var connectsetup = 0;
    
    function SetupConnectLanModal(linkname)
    {
	if (connectsetup) {
	    return;
	}
	connectsetup = 1;
			 
	$("button#connect-sharedlan-button").click(function(event) {
	    event.preventDefault();
	    $('button#connect-sharedlan-button').popover('hide');
	    sup.ShowModal('#connect-sharedlan-modal');
	});
	$("button#connect-sharedlan-confirm").click(function(event) {
	    event.preventDefault();
	    ConnectSharedLan();
	});
	var checkform = function () {
	    var which = $('#connect-sharedlan-modal ' +
			  'input[name="sharedlanradio"]:checked').val();
	    var enable = 0;

	    if (which === undefined) {
		DisableButton("connect-sharedlan");
		return;
	    }
	    var slan = $.trim($('#connect-sharedlan-modal .source-lan').val());
	    var texp = $.trim($('#connect-sharedlan-modal .target-uuid').val());
	    var tlan = $.trim($('#connect-sharedlan-modal .target-lan').val());

	    if (which == "connect") {
		if (slan != "" && texp != "" && tlan != "") {
		    enable = 1;
		}
	    }
	    else if (which == "disconnect") {	    
		if (slan != "") {
		    enable = 1;
		}
	    }
	    if (enable) {
		$("button#connect-sharedlan-confirm")
		    .removeAttr("disabled");
	    }
	    else {
		$("button#connect-sharedlan-confirm")
		    .attr("disabled", "disabled");
	    }
	};
	$('#connect-sharedlan-modal .target-uuid, ' +
	  '#connect-sharedlan-modal .source-lan, ' +
	  '#connect-sharedlan-modal .target-lan').on("keyup", function () {
	      checkform();
	  });
	$('#connect-sharedlan-modal input[name="sharedlanradio"]')
	    .change(function () {
		var which = $('#connect-sharedlan-modal ' +
			      'input[name="sharedlanradio"]:checked').val();

		if (which === "connect") {
		    $('#connect-sharedlan-modal .target-uuid, ' +
		      '#connect-sharedlan-modal .target-lan')
			.removeClass("hidden");
		}
		else if (which === "disconnect") {
		    $('#connect-sharedlan-modal .target-uuid, ' +
		      '#connect-sharedlan-modal .target-lan')
			.addClass("hidden");
		}
		checkform();
	    });

	// Seed the form, most of the time there is one shared lan.
	$('#connect-sharedlan-modal .source-lan').val(linkname);

	// And show the button.
	$("#connect-sharedlan-button").removeClass("hidden");
    }

    function ConnectSharedLan()
    {
	var target_uuid = $('#connect-sharedlan-modal .target-uuid').val();
	var source_lan  = $('#connect-sharedlan-modal .source-lan').val();
	var target_lan  = $('#connect-sharedlan-modal .target-lan').val();
	var which       = $('#connect-sharedlan-modal ' +
			    'input[name="sharedlanradio"]:checked').val();
	var noreconfig  = $('#connect-sharedlan-modal ' +
			    '.form-check-input').is(':checked') ? 1 : 0;

	var args = {
	    "uuid"        : uuid,
	    "target-uuid" : $.trim(target_uuid),
	    "source-lan"  : $.trim(source_lan),
	    "target-lan"  : $.trim(target_lan),
	    "which"       : which,
	    "noreconfig"  : noreconfig,
	};

	var callback = function (json) {
	    console.log("ConnectSharedLan", json);
	    sup.HideWaitWait(function () {
		if (json.code) {
		    sup.SpitOops("oops", json.value);
		    return;
		}
		sup.ShowModal('#success-modal');
	    });
	};
	sup.HideModal('#connect-sharedlan-modal', function () {
	    sup.ShowWaitWait("This will take a minute or two. " +
			     "Patience please.", undefined, function () {
				 sup.CallServerMethod(null, "status",
						      "ConnectSharedLan", args, callback);
			     });
	});
    }

    function CheckCreateProfileArgs(args, continuation)
    {
	args["checkonly"] = 1;
	sup.CallServerMethod(ajaxurl, "manage_profile", "Create", args,
	     function (json) {
		 console.info("CheckCreateProfileArgs");
		 console.info(json);
		 if (json.code) {
		     if (json.code != 2) {
			 $('#snapshot_modal .general-error')
			     .text(json.value)
			 $('#snapshot_modal .general-error')
			     .removeClass("hidden");
			 return;
		     }
		     if (_.has(json.value, "profile_name")) {
			 $('#snapshot_modal .name-error')
			     .html(json.value.profile_name);
			 $('#snapshot_modal .name-error')
			     .removeClass("hidden");
		     }
		     return;
		 }
		 args["checkonly"] = 0;
		 continuation(args);
	     });
    }

    /*
     *
     */
    function NewProfile(args)
    {
	var createArgs = {
	    "formfields" : {"action"       : "clone",
			    "profile_pid"  : expinfo.project,
			    "profile_name" : args["profilename"],
			    "profile_who"  : "public",
			    "snapuuid"     : expinfo.uuid,
			    "snapnode_id"  : args.node_id,
			    "update_prepare" : args["update_prepare"],
			   },
	};
	if (args["operation"] == "copy-profile") {
	    createArgs["formfields"]["copy-profile"] =
		expinfo.profile_uuid;
	}
	/*
	 * Callback after creating new profile with snapshot operation.
	 */
	var createprofile_callback = function(json) {
	    console.log("create profile", json);
	    
	    if (json.code) {
		sup.HideWaitWait(function() {
		    sup.SpitOops("oops", "Error creating new profile. Please" +
				 "see the javascript console");
		});
		return;
	    }
	    window.location.replace(json.value);
	}
	 
	/*
	 * Callback after asking the cluster to create the image descriptor.
	 * Now we can go ahead and create the profile and start the imaging
	 * process.
	 */
	var checkimage_callback = function(json) {
	    console.log("create image", json);
	    
	    if (json.code) {
		sup.HideWaitWait(function() {
		    if (json.code == GENIRESPONSE_ALREADYEXISTS) {
			sup.SpitOops("oops",
				     "There is already an image with the " +
				     "same name as your profile; using this " +
				     "name would overwrite the existing image "+
				     "which is probably not what you want. " +
				     "If you really want to use this name, " +
				     "please <a href='list-images.php'>" +
				     "delete the existing image first</a>.");
			return;
		    }
		    sup.SpitOops("oops", json.value);
		});
		return;
	    }
	    var xmlthing =
		sup.CallServerMethod(ajaxurl, "manage_profile",
				     "Create", createArgs);
	    xmlthing.done(createprofile_callback);
	}

	/*
	 * Check args for image/profile before doing anything.
	 */
	CheckSnapshotArgs(args, function() {
	    CheckCreateProfileArgs(createArgs, function () {
		/*
		 * Now create the descriptor but do not image yet. 
		 */
		args["nosnapshot"] = 1;
		args["imagename"]  = args["profilename"];
		sup.HideModal('#snapshot_modal', function () {
		    sup.ShowWaitWait("Please wait while we create your " +
				     "profile and start the imaging process. " +
				     "Patience please!");
		    var xmlthing =
			sup.CallServerMethod(null, "status", "SnapShot", args);
		    xmlthing.done(checkimage_callback);
		});
	    });
	});
    }

    //
    // User clicked on a node, so we want to create a tab to hold
    // the ssh tab with a panel in it, and then call StartSSH above
    // to get things going.
    //
    var constabcounter = 0;

    function NewConsoleTab(client_id)
    {
	sup.ShowModal('#waitwait-modal');

	var callback = function(json) {
	    console.info("NewConsoleTab", json);
	    sup.HideModal('#waitwait-modal');
	    
	    if (json.code) {
		sup.SpitOops("oops", json.value);
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
		var html = navTabLink(client_id + "-Cons", tabname);

		// Append to end of tabs
		$("#quicktabs_ul").append(html);

		// GA handler.
		var ganame = "console_" + ++constabcounter;
		$('#quicktabs_ul a[href="#' + tabname + '"]')
		    .on('shown.bs.tab', function (event) {
			window.APT_OPTIONS.gaTabEvent("show", ganame);
		    });
		window.APT_OPTIONS.gaTabEvent("create", ganame);

		// Install a kill click handler for the X button.
		$("#" + tabname + "_kill").click(function(e) {
		    window.APT_OPTIONS.gaTabEvent("kill", ganame);
		    e.preventDefault();
		    // Activate the initialtab
		    SwitchToLastKnownTab();
		    // remove the li from the ul. this=ul.li.a.button
		    $(this).parent().parent().remove();
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
		if (APT_OPTIONS.webssh && _.has(json.value, "authobject")) {
		    var jsonauth = $.parseJSON(json.value.authobject);
		    
		    if (_.has(jsonauth, "webssh") && jsonauth.webssh != 0) {
			StartConsoleNew(tabname, json.value);
			return;
		    }
		}
		if (1) {
		    var iwidth = "100%";
		    var iheight = 400;
		
		    var html = '<iframe id="' + tabname + '_iframe" ' +
			'width=' + iwidth + ' ' +
			'height=' + iheight + ' ' +
			'src=\'' + url + '\'>';
	    
		    if (_.has(json.value, "password")) {
			html =
			    "<div class='col-sm-4 col-sm-offset-4 offset-sm-4" +
			    "     text-center'>" +
			    " <small> " +
			    " <a data-toggle='collapse' " +
			    "    data-bs-toggle='collapse' " +
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
		    // Setup a custom event handler so we can kill the
		    // connection.  Called from the kill click handler
		    // above.
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

    function StartConsoleNew(tabname, coninfo)
    {
	var authobject = coninfo.authobject;
	var jsonauth   = $.parseJSON(authobject);
        var url        = jsonauth.baseurl;

	// Backwards compat for a while.
	if (!url.includes("webssh")) {
	    url = url + "/webssh/webssh.html";
	}

	var loadiframe = function () {
	    console.info("Sending message", jsonauth.baseurl);
	    iframewindow.postMessage(authobject, "*");
	    window.removeEventListener("message", loadiframe, false);
	};
	window.addEventListener("message", loadiframe);

	var html =
	    '<div style="height:31em; width:100%; ' +
	    '           resize:vertical;overflow-y:auto;padding-bottom:10px">' +
	    '  <iframe id="' + tabname + '_iframe" ' +
	    '     width="100%" height="100%"' + 
            '     src=\'' + url + '\'></iframe>' +
	    '</div>';
	
	if (_.has(coninfo, "password")) {
	    html =
		"<div class='col-sm-4 col-sm-offset-4 offset-sm-4 " +
		"     text-center'>" +
		" <small> " +
		" <a data-toggle='collapse' data-bs-toggle='collapse' " +
		"    href='#password_" + tabname + "'>Password" +
		"   </a></small> " +
		" <div id='password_" + tabname + "' " +
		"      class='collapse'> " +
		"  <div class='well well-xs'>" + coninfo.password +
		"  </div> " +
		" </div> " +
		"</div> " + html;
	}
	html += 
	    "<center> " +
	    "  If you change the size of the window, you will " +
	    "  need to use <b><em>stty</em></b> to tell your shell. " +
	    "</center>\n";
	
        $('#' + tabname).html(html);

	var iframe = $('#' + tabname + '_iframe')[0];
	var iframewindow = (iframe.contentWindow ?
			    iframe.contentWindow :
			    iframe.contentDocument.defaultView);

	/*
	 * When the user activates this tab, we want to send a message
	 * to the terminal to focus so we do not have to click inside.
	 */
	$('#quicktabs_ul a[href="#' + tabname + '"]')
	    .on('shown.bs.tab', function (e) {
		iframewindow.postMessage("Focus man!", "*");
	    });
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
		sup.SpitOops("oops", json.value);
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

    //
    // Node Top. 
    //
    function DoTop(client_id)
    {
	var callback = function(json) {
	    console.info(json);
	    if (json.code) {
		sup.HideModal('#waitwait-modal', function () {
		    sup.SpitOops("oops", json.value);
		});
		return;
	    }
	    sup.HideModal('#waitwait-modal', function () {
		$('#top-processes-modal pre').text(json.value.result);
		sup.ShowModal('#top-processes-modal');
	    });
	}

	sup.ShowWaitWait("This will take a minute ... patience please");	
	var xmlthing = sup.CallServerMethod(ajaxurl,
					    "status", "Top",
					    {"uuid" : uuid,
					     "node" : client_id});
	xmlthing.done(callback);
    }

    //
    // Node Service Logs. 
    //
    function DoServiceLogs(client_id)
    {
	sup.ShowModal('#waitwait-modal');

	var callback = function(json) {
	    sup.HideWaitWait();
	    console.info("DoServiceLogs", json);
	    
	    if (json.code) {
		sup.SpitOops("oops", json.value);
		return;
	    }
	    
	    //
	    // Create the tab, or else replace the contents.
	    //
	    var tabname = client_id + "logs";
	    if (! $("#" + tabname).length) {
		// The tab.
		var html = navTabLink(client_id + "-Logs", tabname);

		// Append to end of tabs
		$("#quicktabs_ul").append(html);

		// Install a kill click handler for the X button.
		$("#" + tabname + "_kill").click(function(e) {
		    e.preventDefault();
		    // remove the li from the ul. this=ul.li.a.button
		    $(this).parent().parent().remove();
		    // Activate the initialtab
		    SwitchToLastKnownTab();
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
	    }
	    else {
		// Switch back to it.
		$('#quicktabs_ul a[href="#' + tabname + '"]').tab('show');
		return;
	    }
	    var html = "";
	    _.each(json.value, function(details) {
		var cmd = details.command;
		var log = details.log;

		html +=
		    "<pre class='servicelog-command'>" + cmd + "\n" + "</pre>" +
		    "<pre class='servicelog-log'>" + log + "</pre>";
	    });
	    $('#' + tabname).html(html);
	}
	sup.ShowWaitWait("This will take a minute ... patience please");	
	var xmlthing = sup.CallServerMethod(ajaxurl,
					    "status",
					    "ServiceLogs",
					    {"uuid" : uuid,
					     "node" : client_id});
	xmlthing.done(callback);
    }

    //
    // Portstats 
    //
    function ShowPortstatsTab()
    {
	if (isadmin) {
	    $('#show_portstats_li').removeClass("hidden");
	    $("#Portstats").removeClass("hidden");
	    var phandler = function () {
		$('#show_portstats_tab').off("shown.bs.tab", phandler);
		$('#portstats-refresh-button')
		    .removeClass("hidden")
		    .click(Portstats);
		Portstats();
	    };
	    $('#show_portstats_tab').on("shown.bs.tab", phandler);
	}
    }
    
    function Portstats()
    {
	if (instanceStatus != "ready" && instanceStatus != "quarantined") {
	    alert("Experiment must be ready to gather switch port counters");
	    return;
	}
	
	var callback = function(json) {
	    console.info(json);
	    if (json.code) {
		sup.HideModal('#waitwait-modal', function () {
		    sup.SpitOops("oops", json.value);
		});
		return;
	    }
	    sup.HideModal('#waitwait-modal', function () {
		ShowPortstats(json.value);
	    });
	}

	sup.ShowWaitWait("This will take a minute ... patience please");	
	var xmlthing = sup.CallServerMethod(ajaxurl,
					    "status", "Portstats",
					    {"uuid" : uuid});
	xmlthing.done(callback);
    }
    function ShowPortstats(portstats)
    {
	$('#Portstats').html('');
	
	_.each(portstats, function (details, urn) {
	    var nickname = amlist[urn].nickname;
	    var stats    = details.portstats;
	    var id       = "portstats-table-nickname";
	    var table    = $("<table class=tablesorter id=" + id + ">" +
			     "  <thead><tr></tr></thead>" +
			     "  <tbody></tbody>" +
			     "   </table>");

	    // Stats is an array. First row has the column headers.
	    var first = stats.shift();
	    var html  = "";
	    _.each(first.split(","), function (token) {
		html += "<td>" + token + "</td>";
	    });
	    $(table).find("thead tr").html(html);

	    // Now the rows.
	    _.each(stats, function(row) {
		var html  = "";
		_.each(row.split(","), function (token) {
		    html += "<td>" + token + "</td>";
		});
		$(table).find("tbody").append("<tr>" + html + "</tr>");
	    });
	    if (portstats.length > 1) {
		var wrapper = $("<center>" + nickname + "</center>");
		$(wrapper).append(table);
		table = wrapper;
	    }
	    $('#Portstats').append(table);
	    $('#' + id).tablesorter({
		theme : 'bootstrap',
		widgets : [ "uitheme", "zebra", "stickyHeaders"],
		headerTemplate : '{content} {icon}',
	    });
	});
    }

    //
    // Show the powder map in a tab, inside an iframe.
    //
    function ShowPowderMapTab()
    {
	if (! $('#show_powder-map_li').hasClass("hidden")) {
	    return;
	}
	
	// Show the tab.
	$('#show_powder-map_li').removeClass("hidden");

	// Lazy load, wait until user clicks for the first time.
	var handler = function () {
	    $('#show_powder-map_tab').off("shown.bs.tab", handler);
	    $('#quicktabs_content #powder-map').removeClass("hidden");
	    DrawPowderMapTab();
	};
	$('#show_powder-map_tab').on("shown.bs.tab", handler);
    }
    function DrawPowderMapTab()
    {
	// Create the powder map iframe inside the tab
	var iwidth  = "100%";
	var iheight = 850;
	var url     = "powder-map.php?embedded=1&experiment=" + uuid;
		
	var html = '<iframe id="powder-map_iframe" ' +
	    'width=' + iwidth + ' ' +
	    'height=' + iheight + ' ' +
	    'src=\'' + url + '\'>';
	    
	$('#powder-map .powder-mapview').html(html);
    }
    function UpdatePowderMap()
    {
	// Do nothing if not visible.
	if ($('#quicktabs_content #powder-map').hasClass("hidden")) {
	    return;
	}
	$('#powder-map_iframe')[0].contentWindow.PowderMapUpdate();
    }

    function ShowViewer(divname, multisite, manifest)
    {
	//console.info("ShowViewer");
	var aggregates = [];
	var defer = $.Deferred();
	
	_.each(amlist, function(details, aggregate_urn) {
	    aggregates.push({"id" : aggregate_urn,
			     "name" : details.name});
	});
	
	if (! jacksInstance)
	{
	    var modified_callback = function (object) {
		_.each(object.nodes, function (node) {
		    jacksIDs[node.client_id] = node.id;
		    if (!_.has(jacksSites, node.aggregate_id)) {
			jacksSites[node.aggregate_id] = {};
		    }
		    jacksSites[node.aggregate_id][node.client_id] =
			node.id;
		});
		console.log("jacksIDs", object, jacksIDs, jacksSites);
		ShowManifest(object.rspec);
		window.jacksIDS = jacksIDs;
		window.jacksSites = jacksSites;
		defer.resolve();
	    };
	    var click_callback = function (jacksevent) {
		if (jacksevent.type === 'node' ||
		    jacksevent.type === 'host') {
		    console.log(jacksevent);
		    ContextMenuShow(jacksevent);
		}
	    };

	    jacksInstance = JacksViewer.create({
		"root"       : divname,
		"selector"   : '.showtopology-bare',
		"xml"        : manifest,
		"showinfo"   : false,
		"multisite"  : multisite,
		"aggregates" : aggregates,
		"modified_callback" : modified_callback,
		"click_callback"    : click_callback,
	    });
	}
	else {
	    defer.resolve();
	}
	return defer;
    }
    // Clear the Jacks view to get ready for topo change.
    function ClearViewer(manifest)
    {
	if (jacksInstance) {
	    jacksInstance.clear();
	    if (manifest) {
		jacksInstance.add(manifest);
	    }
	}
    }
    // Add manifest to viewer.
    function AddToViewer(manifest)
    {
	if (jacksInstance) {
	    jacksInstance.add(manifest);
	}
    }

    /*
     * Show links to the logs.
     */
    function ShowSliverURLs(statusblob)
    {
	//console.info("ShowSliverURLs", statusblob);
	
	if (!publicURLs) {
	    $('#sliverinfo_dropdown').change(function (event) {
		var selected =
		    $('#sliverinfo_dropdown select option:selected').val();
		//console.info(selected);

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
	// Extract the urls from the status blob.
	var urls = [];
	_.each(statusblob, function(blob, aggregate_urn) {
	    if (_.has(blob, "url") && _.has(amlist, aggregate_urn)) {
		urls.push({"url"  : blob.url,
			   "name" : amlist[aggregate_urn].abbreviation});
	    }
	});
	if (urls.length == 0) {
	    return;
	}
	// URLs change over time, but we do not want to redo this
	// after they stop changing.
	if (publicURLs && publicURLs.length == urls.length) {
	    var changed = false;

	    for (var i = 0; i < urls.length; i++) {
		if (urls[i].url != publicURLs[i].url) {
		    changed = true;
		}
	    }
	    if (!changed) {
		return;
	    }
	}
	publicURLs = urls;
	
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
    var linktesttabcounter = 0;
    
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
	    var html = navTabLink(name, tabname);

	    // Append to end of tabs
	    $("#quicktabs_ul").append(html);

	    // GA Handler
	    var ganame = "linktest_" + ++linktesttabcounter;
	    $('#quicktabs_ul a[href="#' + tabname + '"]')
		.on('shown.bs.tab', function (event) {
		    window.APT_OPTIONS.gaTabEvent("show", ganame);
		});
	    window.APT_OPTIONS.gaTabEvent("create", ganame);

	    // Install a click handler for the X button.
	    $("#" + tabname + "_kill").click(function(e) {
		window.APT_OPTIONS.gaTabEvent("kill", ganame);
		e.preventDefault();
		// remove the li from the ul.
		$(this).parent().parent().remove();
		// Remove the content div.
		$("#" + tabname).remove();
		// Activate the initialtab
		SwitchToLastKnownTab();
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
	// Show portstats here, since we know there are links.
	ShowPortstatsTab();
	
        linktestsetup = 1;
        var md = templates['linktest-md'];
        $('#linktest-help').html(marked(md));

	// Handler for the linktest modal button
	$('button#linktest-modal-button').click(function (event) {
	    window.APT_OPTIONS.gaButtonEvent(event);
	    event.preventDefault();
	    // Make the popover go away when button clicked. 
	    $('button#linktest-modal-button').popover('hide');
	    sup.ShowModal('#linktest-modal');
	});
	// And for the start button in the modal.
	$('button#linktest-start-button').click(function (event) {
	    window.APT_OPTIONS.gaButtonEvent(event);
	    event.preventDefault();
	    StartLinktest();
	});
	// Stop button for a running or wedged linktest.
	$('button#linktest-stop-button').click(function (event) {
	    window.APT_OPTIONS.gaButtonEvent(event);
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
	
	if (instanceStatus == "created") {
	    spinwidth = "25";
	}
	else if (instanceStatus == "rdzwait") {
	    spinwidth = "15";
	}
	else if (instanceStatus == "provisioning" ||
		 instanceStatus == "stitching") {
	    spinwidth = "33";
	}
	else if (instanceStatus == "provisioned") {
	    spinwidth = "66";
	}
	else if (instanceStatus == "ready" || instanceStatus == "failed" ||
		 instanceStatus == "quarantined" ||
		 instanceStatus == "pending" ||
		 instanceStatus == "scheduled") {
	    spinwidth = null;
	}
	if (spinwidth) {
	    $('#profile_status_collapse').collapse("show");
 	    $('#profile_status_collapse').trigger('show.bs.collapse');
	    $('#status_progress_outerdiv').removeClass("hidden");
	    $("#status_progress_bar").width(spinwidth + "%");	
	    $("#status_progress_bar").addClass("progress-bar-striped");
	    $("#status_progress_bar").addClass("progress-bar-animated");
	    $("#status_progress_bar").removeClass("bg-primary");
	    $("#status_progress_bar").removeClass("bg-danger");
	}
	else {
	    if (! $('#status_progress_outerdiv').hasClass("hidden")) {
		$("#status_progress_bar").removeClass("progress-bar-striped");
		$("#status_progress_bar").removeClass("progress-bar-animated");
		if (instanceStatus == "ready") {
		    $("#status_progress_bar").addClass("bg-primary");
		}
		else {
		    $("#status_progress_bar").addClass("bg-danger");
		}
		$("#status_progress_bar").width("100%");
	    }
	}
    }

    function ShowExtensionDeniedModal()
    {
	if (extension_blob.extension_denied_reason != "") {
	    $("#extension-denied-modal-reason")
		.text(extension_blob.extension_denied_reason);
	}
	else {
	    $("#extension-denied-modal-reason").addClass("hidden");
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
	var callback = function (gotdata, ignored) {
	    if (gotdata <= 0) {
		$('#Idlegraphs #nodata').removeClass("hidden");
	    }
	};
	ShowIdleGraphs({"uuid"     : uuid,
			"showwait" : true,
			"loadID"   : "#loadavg-panel-div",
			"gpuID"    : "#gpu-panel-div",
			"ctrlID"   : "#ctrl-traffic-panel-div",
			"exptID"   : "#expt-traffic-panel-div",
			"refreshID": "#graphs-refresh-button",
			"callback" : callback});
    }

    function ShowTopologyTab(multisite, manifest)
    {
	// console.info("ShowTopologyTab");
	if (! $('#quicktabs_content #topology').hasClass("hidden")) {
	    return;
	}
	$('#quicktabs_ul a[href="#topology"]').parent().removeClass("hidden");
	$('#quicktabs_content #topology').removeClass("hidden");
	// This avoids leaving the popovers visible when leaving the tab
	// as when clicking on the shell/console button.
	$('#quicktabs_ul a[href="#topology"]').on("hide.bs.tab", function (event) {
	    $('.node-popover').popover('hide');	    
	});
	SwitchToLastKnownTab();
	return ShowViewer('#showtopo_statuspage', multisite, manifest);
    }

    /*
     * Get the max allowed extension and show a warning if its below
     * a couple of days.
     */
    function LoadMaxExtension()
    {
	if (instanceStatus != "ready") {
	    return;
	}
	var maxcallback = function(json) {
	    console.info("LoadMaxExtension: ", json);
	    
	    if (json.code) {
		console.info("Failed to get max extension: " + json.value);
		return;		    
	    }
	    var maxdate = new Date(json.value.maxextension);
	    //console.info("Max extension date:", maxdate);
		    
	    /*
	     * Show warning if close to max. 
	     */
	    var now   = new Date();
	    var hours = Math.floor((maxdate.getTime() -
				    now.getTime()) / (1000 * 3600.0));

	    console.info("Max allowed extension hours: ", hours);

	    // Locked down experiments can go negative.
	    if (hours > (14 * 24) || hours < 0) {
		$('#maximum-extension').addClass("hidden");
		return;
	    }
	    
	    var when    = moment(maxdate).format('lll');
	    var fromnow = moment(maxdate).fromNow(true) + " from now";
	
	    $('#maximum-extension-string').html(when + " (" + fromnow + ")");
	    if (hours < (7 * 24)) {
		$('#maximum-extension-string').removeClass("text-warning");
		$('#maximum-extension-string').addClass("text-danger");
	    }
	    else {
		$('#maximum-extension-string').removeClass("text-danger");
		$('#maximum-extension-string').addClass("text-warning");
	    }
	    $('#maximum-extension').removeClass("hidden");
	}
	var xmlthing =
	    sup.CallServerMethod(null, "status", "MaxExtension",
				 {"uuid" : uuid});
	xmlthing.done(maxcallback);
    }

    /*
     * Ask to ignore the current failure.
     */
    function IgnoreFailure() {
	var checkstatus = function() {
	    console.info("ignore checkstatus", instanceStatus);
	    if (instanceStatus == "ready") {
		sup.HideWaitWait();
		return;
	    }
	    setTimeout(function() { checkstatus() }, 1000);
	};
	var callback = function(json) {
	    console.info("ignore callback", json);
	    if (json.code) {
		sup.HideWaitWait(function () {
		    sup.SpitOops("oops", "Could not ignore failure: " +
				 json.value);
		});
		return;
	    }
	    checkstatus();
	};
	sup.HideModal('#ignore-failure-modal', function () {
	    sup.ShowWaitWait();
	    // Oh jeez, the RPC can return before the waitwait modal displays
	    setTimeout(function() {
		var xmlthing =
		    sup.CallServerMethod(null, "status", "IgnoreFailure",
					 {"uuid" : uuid});
		xmlthing.done(callback);
	    }, 1000);
	});
    }

    /*
     * Transition from scheduled to started. Need to request new expinfo.
     */
    function ExperimentStarted()
    {
	console.info("ExperimentStarted");

	LoadExperimentInfo(function() {
	    if (expinfo.started) {
		$('#exp-started-date')
		    .html(moment(expinfo.started).format("lll"));
		$('.exp-running').removeClass("hidden");
	    }
	});
    }

    /*
     * Load experiment info and callback.
     */
    function LoadExperimentInfo(callback)
    {
	console.info("LoadExperimentInfo");

	sup.CallServerMethod(null, "status", "ExpInfo", {"uuid" : uuid},
			     function(json) {
				 console.info("expinfo", json);
				 if (json.code) {
				     console.info("Could not get experiment "+
						  "info: " + json.value);
				     return;
				 }
				 expinfo = json.value;
				 if (callback) {
				     callback();
				 }
			     });
    }

    /*
     * Terminate with cause and optionally freeze user.
     */
    function SetupWarnKill()
    {
	if (expinfo.paniced) {
	    $('#warnkill-experiment-button').addClass("hidden");
	    $('#release-quarantine-button').removeClass("hidden");
	}
	else {
	    $('#warnkill-experiment-button').removeClass("hidden");
	    $('#release-quarantine-button').addClass("hidden");
	}
	$('#warnkill-experiment-button').click(function (event) {
	    event.preventDefault();
	    WarnExperiment();
	});
	$('#release-quarantine-button').click(function () {
	    sup.ShowModal('#disable-quarantine-modal');
	});
	$('#confirm-disable-quarantine').click(function () {
	    DisableQuarantine();
	});

	// The Terminate/quarantine is a radio that can be unselected.
	$('#destroy-quarantine-checkbox').change(function () {
	    if ($('#destroy-quarantine-checkbox').is(':checked')) {
		// Flip the other checkbox off
		$('#destroy-terminate-checkbox').prop("checked", false);
	    }
	});
	$('#destroy-terminate-checkbox').change(function () {
	    if ($('#destroy-terminate-checkbox').is(':checked')) {
		// Flip the other checkbox off
		$('#destroy-quarantine-checkbox').prop("checked", false);
	    }
	});
	$('#destroy-experiment-modal .traffic-violation').click(function (e) {
	    e.preventDefault();
	    var msg =
		"Please tell us what you are doing, you are sending a very\n" +
		"unusual amount of traffic over the shared control network\n " +
		"instead of your own internal network(s). Your internal\n" +
		"networks have IP addresses in the 10.XXX.YYY.ZZZ range, see\n"+
		"/etc/hosts on your nodes for the specific addresses to use\n" +
		"in your software configuration.\n\n" +
		"We need to know very soon so we do not have to terminate\n" +
		"this experiment. You are not permitted to send high volume\n" +
		"traffic on the public facing shared network!\n" +
		"-------------------------------------------------------\n" +
		$('#destroy-experiment-reason').val();		
	    
	    $('#destroy-experiment-reason').val(msg);
	});
	$('#destroy-experiment-modal .compromised').click(function (e) {
	    e.preventDefault();
	    var msg =
		"This experiment is being quarantined because we have determined\n"+
		"that one or more nodes in the experiment has been compromised\n"+
		"and is engaged in improper activity. Here are guidelines for\n"+
		"properly securing your nodes:\n\n" +
                "If you are using Apache/Spark/Hadoop, it has has known\n" +
		"vulnerabilities as described here:\n\n" +
		"https://groups.google.com/forum/#!msg/cloudlab-users/qvGyZo8SIoE/vyiSgzRUDAAJ\n\n" +
	        "Using weak passwords (especially those like 'hadoop',\n" +
		"'root', 'linux', or 'admin') is strictly forbidden, even if\n"+
		"online instructions tell you to do so.\n\n" +
		"Starting web services on the public facing IP address, that\n"+
		"are weakly protected (see note above about passwords) is\n" +
		"also prohibited. Again, it does not matter what online\n" +
		"instructions tell you to do, you must not enable weakly\n" +
		"protected web services.\n\n" +
		"Please note that you are fully responsible for the security\n"+
		"of your nodes and any software you install on it.\n\n" +
		"As soon as we know what you were doing and how you are\n" +
		"going to prevent this from happening again, we can unfreeze\n"+
		"your account.\n\n" +
		"Once a node is compromised, the experiment must be terminated.\n" +
		"If you have any data on the node you need, we can boot it into\n"+
		"a memory based 'Recovery' system [1] where you can ssh into the\n"+
		"experiment nodes, mount the filesystem [2], and copy that data off."+
		"\n\n"+
		"[1] https://gitlab.flux.utah.edu/emulab/emulab-devel/-/wikis/faq/Using-the-Testbed/Using-the-Recovery-MFS\n"+
		"[2] https://gitlab.flux.utah.edu/emulab/emulab-devel/-/wikis/faq/Using-the-Testbed/Using-the-Recovery-MFS#mounting-the-root-filesystem\n"+
		"-------------------------------------------------------\n" +
		$('#destroy-experiment-reason').val();		
	    
	    $('#destroy-experiment-reason').val(msg);
	});
	if (isadmin) {
	    $('#destroy-experiment-modal .traffic-violation,' +
	      '#destroy-experiment-modal .compromised')
		.removeClass("hidden");
	}
    }
    
    function WarnExperiment()
    {
	// Handler for the Snapshot confirm button.
	$('#destroy-experiment-confirm')
	    .bind("click.destroy", function (event) {
		event.preventDefault();
		var reason = $('#destroy-experiment-reason').val();
		var kill   = $('#destroy-terminate-checkbox').is(':checked');
		var panic  = $('#destroy-quarantine-checkbox').is(':checked');
		var freeze = $('#destroy-freeze-checkbox').is(':checked');
		var poweroff = $('#destroy-poweroff-checkbox').is(':checked');
		var args   = {"uuid" : uuid};
		if (reason != "") {
		    args["reason"] = reason;
		}
		if (freeze) {
		    args["freeze"] = true;
		}
		if (kill) {
		    args["terminate"] = true;
		}
		else if (panic) {
		    args["quarantine"] = true;
		    if (poweroff) {
			args["poweroff"] = true;
		    }
		}
		sup.HideModal("#destroy-experiment-modal", function () {
		    sup.ShowWaitWait("Patience please!");
		    sup.CallServerMethod(null, "status", "Warn", args,
			 function(json) {
			     console.info("warn/kill", json);
			     if (json.code) {
				 sup.HideWaitWait(function () {
				     if (json.code) {
					 sup.SpitOops("oops",
					    "Could not warn/kill experiment: " +
						      json.value);
				     }
				 });
				 return;
			     }
			     sup.HideWaitWait(function () {
				 if (panic) {
				     sup.ShowModal(
					 '#quarantine-inprogress-modal');
				 }
			     });
			 });
		});
	    });
	
	// Handler for hide modal to unbind the click handler.
	$('#destroy-experiment-modal').on('hidden.bs.modal', function (event) {
	    $(this).unbind(event);
	    $('#destroy-experiment-confirm').unbind("click.destroy");
	});
	sup.ShowModal("#destroy-experiment-modal");
    }

    /*
     * Release from quarantine.
     */
    function DisableQuarantine()
    {
	var args = {"uuid"       : uuid,
		    "quarantine" : "clear"};

	sup.HideModal('#disable-quarantine-modal', function () {
	    sup.ShowWaitWait("Patience please!");
	    sup.CallServerMethod(null, "status", "Quarantine", args,
		 function(json) {
		     console.info("DisableQuarantine", json);
		     if (json.code) {
			 sup.HideWaitWait(function () {
			     if (json.code) {
				 sup.SpitOops("oops",
				      "Could not disable quarantine: " + 
					      json.value);
			     }
			 });
			 return;
		     }
		     sup.HideWaitWait(function () {
			 sup.ShowModal('#quarantine-inprogress-modal');
		     });
		 });
	});
    }

    /*
     * Show/Hide the prestaging panel.
     */
    function ShowPrestageInfo(status)
    {
	var html = prestageTemplate({
	    "status" : status,
	    "amlist" : amlist,
	});
	$('#prestage-panel .panel-body').html(html);
	$('#prestage-panel').removeClass("hidden");
    }
    function HidePrestageInfo()
    {
	sup.HideModal('#prestage-info-modal');
	$('#prestage-panel').addClass("hidden");
    }

    /*
     * On the Powder Portal, we want a link to the monitoring graph
     * for nodes marked as a radio (or hosting a radio), that can
     * transmit and is monitored.
     */
    function IsPowderTransmitter(aggregate_urn, node_id)
    {
	var radio = null;
	
	if (_.has(radioinfo, aggregate_urn) &&
	    _.has(radioinfo[aggregate_urn], node_id) &&
	    _.has(radioinfo[aggregate_urn][node_id], "frontends")) {
	    // Look through through the frontends to see if any can
	    // transmit and are monitored.
	    _.each(radioinfo[aggregate_urn][node_id]["frontends"],
		   function (frontend, iface) {
		       if (frontend.transmit_frequencies != "" &&
			   frontend.monitored) {
			   radio = radioinfo[aggregate_urn][node_id];
		       }
		   });
	}
	return radio;
    }

    /*
     * Create a tab for a monitoring graph
     */
    function NewMonitorTab(client_id)
    {
	var info = radios[client_id];
	
	//
	// Create the tab. The template inserted into the tab has a defined
	// height, so do not worry about that here.
	//
	var tabname = client_id + "monitor_tab";
	if (! $("#" + tabname).length) {
	    // The tab.
	    var html = navTabLink(client_id + "-Graph", tabname);

	    // Append to end of tabs
	    $("#quicktabs_ul").append(html);

	    // Install a kill click handler for the X button.
	    $("#" + tabname + "_kill").click(function(e) {
		e.preventDefault();
		// remove the li from the ul. this=ul.li.a.button
		$(this).parent().parent().remove();
		// Activate the initialtab
		SwitchToLastKnownTab();
		// Remove the content div. Have to delay this though.
		$("#" + tabname).remove();
	    });
	    var which    = "rfmonitor";
	    var cluster  = amlist[info.aggregate_urn].nickname;
	    var url      = amlist[info.aggregate_urn].weburl;
	    var endpoint = null;
	    if (info.itype == "ME") {
		which = "rfmonitor-mobile";
		endpoint = cluster.replace("Bus", "bus-").toLowerCase();
		url = "https://www.emulab.net";
	    }
	    var options = {
		"url"      : url,
		"selector" : "#" + tabname + " .frequency-graph-div",
		"cluster"  : cluster,
		"node_id"  : info.node_id,
		"iface"    : "rf0",
		"logid"    : null,
		"archived" : false,
		"which"    : which,
		"endpoint" : endpoint,
		"enableReload" : true,
	    }
	    // Narrow the range to the actual start/end of the aggregate.
	    var blob = lastStatusBlob.sliverstatus[info.aggregate_urn];
	    if (blob.started) {
		options["rangestart"] = moment(blob.started).unix();
	    }
	    else {
		options["rangestart"] = moment(expinfo.started).unix();
	    }
	    if (blob.destroyed) {
		options["rangeend"] = moment(blob.destroyed).unix();
	    }
	    console.info("monitor tab options", options);
	    
	    var html = monitorTemplate(options);

	    // The content div.
	    html = "<div class='tab-pane' id='" + tabname + "'>" +
		html + "</div>";

	    $("#quicktabs_content").append(html);

	    // And make it active
	    $('#quicktabs_ul a:last').tab('show') // Select last tab

	    // Now we can create the graph.
	    ShowFrequencyGraph(options);
	}
	else {
	    // Switch back to it.
	    $('#quicktabs_ul a[href="#' + tabname + '"]').tab('show');
	    return;
	}
    }

    /*
     * Show a TX graph. 
     */
    function ShowTXGraph(client_id)
    {
	var route;
	var args;
	var defer = $.Deferred();

	var callback = function (json) {
	    console.info(json);
	    if (json.code) {
		defer.resolve(json.value);
		return;
	    }
	    var txlist = json.value.txlist;
	    if (!_.size(txlist)) {
		defer.reject(null);
		return;
	    }
	    var args = {
		"selector"  : "#txgraph-modal",
		"txlist"    : txlist,
		"instances" : null,
		"instance"  : expinfo,
	    }
	    defer.resolve(args);
	};
	if (client_id) {
	    var fe       = radios[client_id].frontends["rf0"];
	    var urn      = fe.aggregate_urn;
	    var node_id  = fe.node_id;
	    var frontend = fe.frontend;
	    var iface    = fe.iface;
	    console.info(urn, node_id, frontend, iface);

	    args = {
		"instance"      : uuid,
		"aggregate_urn" : urn,
		"node_id"       : node_id,
		"iface"         : iface,
		"frontend"      : frontend,
	    };
	    route = "rfrange";
	}
	else {
	    args = {
		"uuid" : uuid,
	    };
	    route = "status";
	}
	window.ShowTXGraph("#txgraph-modal", defer);
	sup.CallServerMethod(null, route, "Transmissions", args, callback);
    }

    var modified    = 0;
    var stepsmotion = false;
    var newrspec    = null;
    var modifyready = false;
    
    function Modify()
    {
	// Need to fix this global.
	window.EXPMODIFY = true;
	newrspec = null;

	if (!modifyready) {
	    // Moved some stuff so it can be shared with status.js
	    instantiateCommon.initialize({
		amlist    : amlist,
		radioinfo : radioinfo,
		resgroups : resgroups,
		multisite : window.MULTISITE,
	    });
	    modifyready = true;
	}

	$('.ppwizard-cancel').click(function (event) {
	    event.preventDefault();

	    $('#ppwizard-body').addClass("hidden");
	    $('#main-template').removeClass("hidden");
	    $('.ppwizard-cancel, #ppwizard-accept, ' +
	      '#ppwizard-finish, #ppwizard-modify').off("click");
	    $('#ppwizard-body .topo-before, #ppwizard-body .topo-after')
		.html("");
	    $('#ppwizard-finish').attr("disabled", true);
	    $('#ppwizard-finish-message').addClass("hidden");
	});
	
	$('#ppwizard-accept').click(function (event) {
	    event.preventDefault();
	    console.info("accept", modified);

	    if (modified) {
		window.ppstart.HandleSubmit(function(success) {
		    console.info("handlesubmit", success);
		    if (success) {
			modified = 0;
			newrspec = instantiateCommon.setClusters(newrspec);
			newrspec = instantiateCommon.mergeRSpecAndManifest(
			    newrspec, jacksManifest);
			instantiateCommon.createAggregateSelectors(newrspec,
							   expinfo.project,
							   expinfo.group);
			$('#ppwizard-accept').attr("disabled", true);
			$('#ppwizard-finish').removeAttr("disabled");
			$('#ppwizard-finish-message').removeClass("hidden");
			$('#ppwizard-rspec-modal textarea').val(newrspec);
			$(window).scrollTop(1000000);
			ShowModifyViewer("after", newrspec);
			instantiateCommon.checkForRadioUsage(newrspec);
		    }
		    else {
		    }
		});
	    }
	});

	$('#ppwizard-finish').click(function (event) {
	    event.preventDefault();
	    console.info("finish");

	    if (!instantiateCommon.allClustersSelected()) {
		alert("Please make your cluster selections!");
		return;
	    }
	    var rspec = instantiateCommon.setSites(newrspec);

	    var args = {"uuid"  : uuid,
			"rspec" : rspec};

	    statusHold = 1;
	    sup.ShowWaitWait("This will take a minute ... patience please");	
	    sup.CallServerMethod(null, "status", "ModifyExperiment", args,
		 function(json) {
		     console.info("ModifyExperiment", json);
		     statusHold = 0;
		     GetStatus();
		     
		     if (json.code) {
			 sup.HideWaitWait(function () {
			     sup.SpitOops("oops",
					  "Could not start modification: " + 
					  json.value);
			 });
			 return;
		     }
		     // Clear/Hide current errors
		     $('#error_panel_text').text("");
		     $('#error_panel').addClass("hidden");
		     
		     sup.HideWaitWait();
		     // Set this for error display. 
		     modifying = true;
		     $('.ppwizard-cancel').trigger("click");
		 });
	});

	/*
	 * XXXX
	 * Need to save new bindings in the db and reuse them
	 * for next experiment modify.
	 *
	 * For repo profiles, need to pass the paramdefs along to startPP.
	 */

	window.ppstart.StartPP({
	    profile          : expinfo.profile_uuid,
	    uuid             : expinfo.profile_uuid,
	    ppdivname        : "ppwizard-form",
	    isadmin          : isadmin,
	    multisite        : multisite,
	    amlist           : amlist,
	    prunetypes       : prunetypes,
	    fromrepo         : expinfo.repourl ? true : false,
	    rerun_instance   : expinfo.uuid,
	    rerun_paramset   : null,
	    paramdefs        : (expinfo.paramdefs ?
				JSON.stringify(expinfo.paramdefs) : null),
	    bindings         : expinfo.params, 
	    setStepsMotion   : function (which) {
		console.info("setStepsMotion", which);
		stepsmotion = which;
	    },
	    setRerunInstance : function () {
		console.info("setRerunInstance");
	    },
	    config_callback  : function (rspec) {
		console.info("ConfigureDone", rspec);
		if (rspec) {
		    newrspec = rspec;
		}
	    },
	    modified_callback: function () {
		console.info("Modified", stepsmotion);
		if (stepsmotion) {
		    modified = 1;
		    $('#ppwizard-accept').removeAttr("disabled");
		    $('#ppwizard-finish').attr("disabled", true);
		}
	    },
	    ready_callback   : function () {
		$('#main-template').addClass("hidden");
		$('#ppwizard-body').removeClass("hidden");
		ShowModifyViewer("before", jacksManifest);
	    },
	});
    }

    function ShowModifyViewer(which, rspec)
    {
	var divname    = '#ppwizard-body .topo-compare';
	var aggregates = [];
	
	_.each(amlist, function(details, aggregate_urn) {
	    aggregates.push({"id" : aggregate_urn,
			     "name" : details.name});
	});
	$(divname + ' .topo-' + which).html("");

	var jacks = JacksViewer.create({
	    "root"       : divname,
	    "selector"   : '.topo-' + which,
	    "xml"        : rspec,
	    "showinfo"   : false,
	    "multisite"  : multisite,
	    "aggregates" : aggregates,
	});
    }

    // Helper.
    function decodejson(id) {
	return JSON.parse(_.unescape($(id)[0].textContent));
    }

    // Switch to tab the user used in the last use of the status page.
    function SwitchToLastKnownTab()
    {
	$('#quicktabs_ul a[href="#' + initialTab + '"]').tab('show');
    }
    // Remember for last time (only topology or listview of course).
    function RememberUserTab(which)
    {
	which = which.substr(1);
	if (which != "topology" && which != "listview") {
	    return;
	}
	initialTab = which;
	
	// Delete existing cookies first
	var expires = "expires=Thu, 01 Jan 1970 00:00:01 GMT;";
	document.cookie = PORTALTABCOOKIE + '=; ' + expires;

	var date = new Date();
	date.setTime(date.getTime()+(1000*24*60*60*1000))

	var cookie = PORTALTABCOOKIE + '=' + which +
	    '; expires=' + date.toGMTString() + '; path=/';

	console.info("RememberUserTab: ", cookie);
	document.cookie = cookie;
    }
    // Get last known tab (or null).
    function LastKnownUserTab()
    {
	var which = null;
	
	document.cookie.split(';').forEach(function(el) {
	    let [key,value] = el.split('=');
	    if (key.trim() == PORTALTABCOOKIE) {
		which = value;
	    }
	});
	console.info("LastKnownUserTab:", which);
	return which;
    }

    $(document).ready(initialize);
});
