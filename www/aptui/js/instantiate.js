$(function ()
{
    'use strict';

    var templates = APT_OPTIONS.fetchTemplateList(['instantiate', 'aboutapt', 'aboutcloudlab', 'aboutpnet', 'waitwait-modal', 'rspectextview-modal', 'reservation-graph', 'resgroup-list', 'instantiate-templates']);
    var instantiateString = templates['instantiate'];
    var aboutaptString = templates['aboutapt'];
    var aboutcloudString = templates['aboutcloudlab'];
    var aboutpnetString = templates['aboutpnet'];
    var waitwaitString = templates['waitwait-modal'];
    var rspecviewString = templates['rspectextview-modal'];
    var amlist        = null;
    var amstatus      = null;
    var projlist      = null;
    var profilelist   = null;
    var amdefault     = null;
    var formfields    = null;
    var selected_profile = null;
    var selected_uuid    = null;
    var selected_rspec   = null;
    var selected_version = null;
    var selected_pid     = null;
    var ispprofile    = 0;
    var isscript      = 0;
    var webonly       = 0;
    var isadmin       = 0;
    var multisite     = 0;
    var doconstraints = 0;
    var amValueToKey  = {};
    var showpicker    = 0;
    var portal        = null;
    var JACKS_NS      = "http://www.protogeni.net/resources/rspec/ext/jacks/1";
    var jacks = {
      instance: null,
      input: null,
      output: null
    };
    var editor        = null;
    var ppstart       = window.ppstart;
    var loaded_uuid   = null;
    var ppchanged     = false;
    var prunetypes    = null;
    var hardware      = null;
    var resinfo       = null;
    var resgroups     = null;
    var radioinfo     = null;
    var maxEndDate    = null;
    var usingRadios   = false;
    var usingSpectrum = false;
    var currentStep   = 0;
    var mainTemplate  = _.template(instantiateString);
    var rerun_instance = null;
    var rerun_loaded   = false;

    /*
     * The template file has several different sections inside
     * script tags. We need to compile each one separately.
     */
    var extraTemplates = templates['instantiate-templates'];
    var html           = $.parseHTML(extraTemplates, document, true);
    var siteTemplate   = _.template($('#pickered-site-template', html).html());
    var clusterTemplate= _.template($('#pickered-agg-template', html).html());
    var projectTemplate= _.template($('#pickered-proj-template', html).html());
    var pidTemplate    = _.template($('#pickered-pid-template', html).html());
    var groupTemplate  = _.template($('#pickered-group-template', html).html());
    var gidTemplate    = _.template($('#pickered-gid-template', html).html());

    function initialize()
    {
	// Fire this off right away.
	if (!window.NOPREDICTION) {
	    LoadReservationInfo();
	}
	
	// Get context for constraints
	var contextUrl = 'https://www.emulab.net/protogeni/jacks-context/cloudlab-utah.json';
	$.get(contextUrl).then(contextReady, contextFail);
	// Standard view option
	marked.setOptions({"sanitize" : true});

	window.APT_OPTIONS.initialize(sup);
	webonly    = window.WEBONLY;
	isadmin    = window.ISADMIN;
	multisite  = window.MULTISITE;
	portal     = window.PORTAL;
	doconstraints = window.DOCONSTRAINTS;
	showpicker    = window.SHOWPICKER;

	if ($('#amlist-json').length) {
	    amlist = decodejson('#amlist-json');
	    _.each(_.keys(amlist), function (key) {
		amValueToKey[amlist[key].name] = key;
	    });
	    console.info("amlist", amlist);

	    /*
	     * Resort the amlist so that federated clusters are at the
	     * end. Not really sure why this ended up here and not on
	     * the server side.
	     */
	    var tmp = {};
	    _.each(amlist, function (details, urn) {
		if (!details.isfederate) {
		    tmp[urn] = details;
		}
	    });
	    _.each(amlist, function (details, urn) {
		if (details.isfederate) {
		    tmp[urn] = details;
		}
	    });
	    amlist = tmp;
	}
	if ($('#projects-json').length) {
	    projlist = decodejson('#projects-json');
	    console.info("projlist", projlist);
	}
	resgroups = decodejson('#resinfo-json');
	console.info("resgroups", resgroups);
	profilelist = decodejson('#profiles-json');
	console.info("profilelist", profilelist);
	prunetypes = decodejson('#prunelist-json');
	console.info(prunetypes);
	if ($('#radioinfo-json').length) {
	    radioinfo = decodejson('#radioinfo-json');
	    console.info("radioinfo", radioinfo);
	}
	formfields = decodejson('#form-json');
	console.info("formfields", formfields);

	// Moved some stuff so it can be shared with status.js
	instantiateCommon.initialize({
	    amlist    : amlist,
	    radioinfo : radioinfo,
	    resgroups : resgroups,
	    multisite : window.MULTISITE,
	});
	
	var html = mainTemplate({
	    formfields:         formfields,
	    projects:           projlist,
	    amlist:             amlist,
	    showpicker:         showpicker,
	    fromrepo:           window.FROMREPO,
	    clustername:        window.PORTAL_NAME,
	    admin:		isadmin,
	    maxduration:        window.MAXDURATION,
	    clusterselect:      window.CLUSTERSELECT,
	});
	$('#main-body').html(html);
	$('#waitwait_div').html(waitwaitString);
	$('#rspecview_div').html(rspecviewString);
	$('#rspec_modal_download_button').addClass("hidden");

	$('#stepsContainer').steps({
	    headerTag: "h3",
	    bodyTag: "div",
	    transitionEffect: "slideLeft",
	    autoFocus: true,
	    onStepChanging: function(event, currentIndex, newIndex) {
		return StepChanging(this, event, currentIndex, newIndex);
	    },
	    onStepChanged: function(event, currentIndex, priorIndex) {
		// Globally record what step we are on.
		currentStep = currentIndex;
		return StepChanged(this, event, currentIndex, priorIndex);
	    },
	    onFinishing: function(event, currentIndex) {
		_.defer(function () {
		    CheckStep3(function (success) {
			if (success) {
			    Instantiate(event);
			}
			else {
			    $('#stepsContainer-t-3').parent().addClass('error');
			}
		    });
		});
		// Avoid Error indicator until form validation completes.
		return true;
	    },
	});
	setStepsMotion(false);

	// Format the step labels across the top to match the panel widths.
	$('#stepsContainer .steps').addClass('col-lg-8 col-lg-offset-2 col-md-8 col-md-offset-2 col-sm-10 col-sm-offset-1 col-xs-12 col-xs-offset-0');
	$('#stepsContainer .actions').addClass('col-lg-8 col-lg-offset-2 col-md-8 col-md-offset-2 col-sm-10 col-sm-offset-1 col-xs-12 col-xs-offset-0');

	// Insert datepicker on schedule tab,
	$("#start_day").datepicker({
	    minDate: 0,		/* earliest date is today */
	    disabled: false,
	    showButtonPanel: true,
	    onSelect: function (dateString, dateobject) {
		DateChange("#start_day");
	    }
	});
	$("#end_day").datepicker({
	    minDate: 0,		/* earliest date is today */
	    maxDate: "+1d",
	    showButtonPanel: true,
	    onSelect: function (dateString, dateobject) {
		DateChange("#end_day");
	    }
	});
	$("#start_hour").change(function () {
	    DateChange("#start_hour");
	});
	$('#start-hour-help, #end-hour-help').popover({
	    trigger: 'hover',
	    placement: 'auto',
	    container: 'body',
	});

	// It is okay to initialize this, we do not show the copy
	// button unless appropriate. 
	CopyProfile.InitCopyProfile('#profile-copy-button',
				    window.DEFAULT_PROFILE, _.keys(projlist));

	// Set up jacks swap
	$('#stepsContainer #inline_overlay').click(function() {
	    SwitchJacks('large');
	});

	// Profile picker in its own module now.
	if (showpicker) {
	    ProfilePicker.init({
		"profileList"    : profilelist,
		"projList"       : projlist,
		"multiSite"      : multisite,
		"defaultProfile" : window.DEFAULT_PROFILE,
		"changeProfile"  : function (selected) {
		    console.info("selected", selected);
		    ChangeProfileSelection(selected);
		    $('.steps .error').removeClass('error');
		},
	    });
	    // Needs to be after steps init.
	    $('button#change-profile').click(function (event) {
		event.preventDefault();
		ProfilePicker.showPicker();
	    });
	}
	// Must be after steps init. This will init the Group selector
	CreateProjectSelector();

	$('#show_xml_modal_button').click(function (event) {
	    showXMLModal();
	});

	// Load previous bindings if applicable.
	if (window.PROFILE_UUID && window.RERUN_INSTANCE) {
	    // We do not know yet if its parameterized. But that is okay.
	    LoadPreviousInstance()
		.done(ChangeProfileSelection(window.PROFILE_UUID))
	}
	else {
	    ChangeProfileSelection(window.DEFAULT_PROFILE);
	}
	_.delay(function () {
	    $('.dropdown-toggle').dropdown();
	}, 500);

    }

    // Helper.
    function decodejson(id) {
	return JSON.parse(_.unescape($(id)[0].textContent));
    }
    /*
     * Helper functions for enable/disable of steps motion/finish
     */
    function enableStepsMotion()
    {
	//console.info("enableStepsMotion");
	
	$('#stepsContainer').steps("enableMotion");
	$('body').on("keyup.stepsNav", function (event) {
	    if (event.keyCode === 13) {
		$('#stepsContainer').steps('next');
	    }
	});
	// For Selenium.
	$('#stepsContainer').prepend("<div class='hidden' " +
				     " id='steps-enabled'></div>");	
    }
    function disableStepsMotion()
    {
	//console.info("disableStepsMotion");
	
	$('#stepsContainer').steps("disableMotion");
	$('body').off("keyup.stepsNav");
	// For Selenium
	$('#stepsContainer').find("#steps-enabled").remove();
    }
    function setStepsMotion(enable)
    {
	if (enable) {
	    enableStepsMotion();
	}
	else {
	    disableStepsMotion();
	}
    }
    function setStepsFinish(enable)
    {
	if (enable) {
	    $('#stepsContainer .actions a[href="#finish"]')
		.removeAttr('disabled');
	}
	else {
	    $('#stepsContainer .actions a[href="#finish"]')
		.attr('disabled', true);
	}
    }
    
    // Called from ppwizard when the user loads a previous instance.
    // We need it for finalization (name,project,clusters).
    function setRerunInstance(record)
    {
	console.info("setRerunInstance", record);
	if (record) {
	    rerun_instance = record;
	    window.SELECTED_INSTANCE = record.rerun_uuid;
	    rerun_loaded   = false;
	}
	else {
	    rerun_instance = null;
	    window.SELECTED_INSTANCE = undefined;
	    rerun_loaded   = true;
	}
    }

    var doingformcheck = 0;

    // Step is changing
    function StepChanging(step, event, currentIndex, newIndex) {
	//console.info("StepChanging: ", step, currentIndex, newIndex);
	//console.info(new Date());
	
	if (currentIndex == 0 && newIndex == 1) {
	    // Check step 0 form values. Any errors, we stop here.
	    if (ispprofile) {
		if (selected_uuid != loaded_uuid) {
		    $('#stepsContainer-p-1 > div')
			.attr('style','display:block');
		    ppstart.StartPP({
			profile      : selected_profile,
			uuid         : selected_uuid,
			ppdivname    : "pp-container",
			isadmin      : isadmin,
			config_callback : ConfigureDone,
			modified_callback : function () { ppchanged = true; },
		        multisite    : multisite,
			amlist       : amlist,
			prunetypes   : prunetypes,
			fromrepo     : window.FROMREPO,
			rerun_instance : window.RERUN_INSTANCE,
			rerun_paramset : window.RERUN_PARAMSET,
			paramdefs      : null,
			bindings       : null,
			setStepsMotion : setStepsMotion,
			setRerunInstance : setRerunInstance,
		    });
		    loaded_uuid = selected_uuid;
		    ppchanged = true; 
		}
	    }
	    else {
		$('#stepsContainer-p-1 > div').attr('style','display:none');
		loaded_uuid = selected_uuid;
	    }
	}
	else if (currentIndex == 1 && newIndex == 2) {
	    if (ispprofile && ppchanged) {
		console.info("foo", ppchanged);
		ppstart.HandleSubmit(function(success) {
		    if (success) {
			ppchanged = false;
			$('#stepsContainer-t-1').parent().removeClass('error');
			$('#stepsContainer').steps('next');
			// This is for testing with Selenium.
			if (! $('#pp-wizard-done').length) {
			    $('#pp-container').append("<div class='hidden' " +
					  " id='pp-wizard-done'></div>");
			}
		    }
		    else {
			$('#stepsContainer-t-1').parent().addClass('error');
		    }
		});
		// We do not proceed until the form is submitted
		// properly. This has a bad side effect; the steps
		// code assumes this means failure and adds the error
		// class.
		return false;
	    }
	}
	else if (currentIndex == 2 && newIndex == 3) {
	    // Check step 2 form values. Any errors, we stop here.
	    if (!doingformcheck) {
		doingformcheck = 1;
		CheckStep2(function (success) {
		    if (success) {
			$('#stepsContainer-t-2').parent().removeClass('error');
			$('#stepsContainer').steps('next');
		    }
		    else {
			$('#stepsContainer-t-2').parent().addClass('error');
		    }
		    // Here to avoid recursion.
		    doingformcheck = 0;
		});
		// Prevent step from advancing until check is finished.
		return false;
	    } 
	}
	// Switch Jacks back to the little window when leaving
	// the Finalize step.
	if (currentIndex == 2) {
	    SwitchJacks('small');
	}
	if (currentIndex == 0 && selected_uuid == null) {
	    return false;
	}
	return true;
    }

    // Step is done changing.
    function StepChanged(step, event, currentIndex, priorIndex) {
	console.info("StepChanged: ", step, currentIndex, priorIndex);
	//console.info(new Date());
	
        APT_OPTIONS.updatePage({ 'instantiate-step': currentIndex });
	var cIndex = currentIndex;
        if (currentIndex == 1) {
	    // If the profile isn't parameterized, skip the second step
	    if (!ispprofile) {
		if (priorIndex < currentIndex) {
		    // Generate the profile on the third tab
		    ShowThumbnail(selected_rspec, updateJacksGraph);
		    $(step).steps('next');
		    $('#stepsContainer-t-1').parent().removeClass('done')
			.addClass('disabled');
		}
		if (priorIndex > currentIndex) {
		    $(step).steps('previous');
		    cIndex--;
		}
	    }
	}
	else if (currentIndex == 2) {
	    if (priorIndex == 1) {
		// Keep the two panes the same height
		$('#inline_container').css('height',
			       $('#finalize_container').outerHeight() - 15);

		// Chrome was having an issue where Jacks was not responding to
		// the height change. Had to also add to Jacks root.
		$('#inline_jacks').css('height',
				   $('#finalize_container').outerHeight() - 15);
	    }
	    if (priorIndex < currentIndex) {
		CheckForRadioUsage();
		if (rerun_instance) {
		    LoadRerunInstance();
		}
	    }
	}
	else if (currentIndex == 3) {
	    CheckForSpectrum();

	    // This is for testing with Selenium.
	    $('body').append("<div class='hidden' id='step3-loaded'></div>");
	}
	if (currentIndex < priorIndex) {
	    // Disable going forward by clicking on the labels
	    for (var i = cIndex+1; i < $('.steps > ul > li').length; i++) {
		$('#stepsContainer-t-'+i).parent()
		    .removeClass('done').addClass('disabled');
	    }
	}
    }

    /*
     * Check the form values on step 0 of the wizard.
     */
    function CheckStep0(step_callback)
    {
	SubmitForm(1, 0, function (json) {
	    if (json.code == 0) {
		step_callback(true);
		return;
	    }
	    // Internal error.
	    if (json.code < 0) {
		step_callback(false);
		sup.SpitOops("oops", json.value);
		return;
	    }
	    // Form error
	    if (json.code == 2) {
		// Regenerate page with errors.
		ShowFormErrors(json.value);
		step_callback(false);
		return;
	    }
	});
    }
    /*
     * Check the form values on step 2 (Finalize) of the wizard.
     */
    function CheckStep2(step_callback)
    {
	if (!AllClustersSelected()) {
	    ShowFormErrors({"error" :
			    "Please make your cluster selections!"});
	    step_callback(false);
	    return;
	}
	SubmitForm(1, 2, function (json) {
	    if (json.code == 0) {
		step_callback(true);
		DateChange("#start_day");
		return;
	    }
	    // Internal error.
	    if (json.code < 0) {
		step_callback(false);
		sup.SpitOops("oops", json.value);
		return;
	    }
	    // Form error
	    if (json.code == 2) {
		// Regenerate page with errors.
		ShowFormErrors(json.value);
		step_callback(false);
		return;
	    }
	});
    }
    /*
     * Check the form values on step 3 (Schedule) of the wizard.
     */
    function CheckStep3(step_callback)
    {
	ClearFormErrors();

	/*
	 * Initial validation on the start/end time.
	 * Also convert to UTC for submit (to capture local timezone).
	 */
	var start_day  = $('#step3-form [name=start_day]').val();
	var start_hour = $('#step3-form [name=start_hour]').val();
	if (start_day && !start_hour) {
	    ShowFormErrors({"start_hour" : "Missing hour"});
	    step_callback(false);
	    return;
	}
	else if (!start_day && start_hour) {
	    ShowFormErrors({"start_day" : "Missing day"});
	    step_callback(false);
	    return;
	}
	var end_day  = $('#step3-form [name=end_day]').val();
	var end_hour = $('#step3-form [name=end_hour]').val();
	if (end_day && !end_hour) {
	    ShowFormErrors({"end_hour" : "Missing hour"});
	    step_callback(false);
	    return;
	}
	else if (!end_day && end_hour) {
	    ShowFormErrors({"end_day" : "Missing day"});
	    step_callback(false);
	    return;
	}
	SubmitForm(1, 3, function (json) {
	    if (json.code == 0) {
		step_callback(true);
		return;
	    }
	    // Internal error.
	    if (json.code < 0) {
		step_callback(false);
		sup.SpitOops("oops", json.value);
		return;
	    }
	    // Form error
	    if (json.code == 2) {
		// Regenerate page with errors.
		ShowFormErrors(json.value);
		step_callback(false);
		return;
	    }
	});
    }

    var Instantiate = function () {
        var submitted = false;

        return function (event)
        {
	    if (webonly != 0) {
	        event.preventDefault();
	        sup.SpitOops("oops",
			     "You do not belong to any projects at your Portal, " +
			     "so you have have very limited capabilities. Please " +
			     "join or create a project at your " +
			     (portal && portal != "" ?
			     "<a href='" + portal + "'>Portal</a>" : "Portal") +
			     " to enable more capabilities. Thanks!")
	        return false;
	    }
	    // Prevent double click.
	    if (submitted === true) {
	        // Previously submitted - don't submit again
	        event.preventDefault();
	        console.info("Ignoring double submit");
	        return false;
	    } else {
	        // Mark it so that the next submit can be ignored
	        submitted = true;
	    }

            // Submit with checkonly first, then for real
	    SubmitForm(1, 3, function (json) {
	        //console.info(json);
	        // Internal error.
	        if (json.code < 0) {
		    sup.SpitOops("oops", json.value);
		    submitted = false;
		    return;
	        }
	        // Form error
	        if (json.code == 2) {
	            ShowFormErrors(json.value);
	            submitted = false;
		    return;
	        }
		sup.ShowWaitWait("This might take a minute. Patience please.");
	        $("#waitwait-modal").modal('show');
	        SubmitForm(0, 3, function(json) {
		    if (json.code) {
		        console.info(json);
		        if (json.code == 3) {
		            submitted = false;
			    sup.HideWaitWait(function () {
				HandleLicenseRequirements(json.value);
			    })
			    return;
		        }
		        submitted = false;
			sup.HideWaitWait(function () {			
		            sup.SpitOops("oops",
					 json.value.replaceAll("\n", "<br>"));
			});
			return;
		    }
		    /*
		     * The return value will have a redirect url in it,
		     * and some optional cookies.
		     */
		    if (_.has(json.value, "cookies")) {
		        SetCookies(json.value.cookies);
		    }
		    window.location.replace(json.value.redirect);
	        });
	    });
	    return true;
        };
    }();

    function ShowFormErrors(errors) {
	_.each(errors, function (error, key) {
	    var which = '[for="' + key + '"]';
	    var label = $('.step-forms .control-error' + which);

	    // Parent form-group gets the error.
	    $(label).closest(".form-group").addClass("has-error");
	    // Hmm, need to fix this, not everything is a form-group
	    $(label).closest(".format-me").addClass("has-error");
	    $(label).html(_.escape(error)).removeClass("hidden");
	});
	// General Error on the last step.
	if (_.has(errors, "error")) {
	    $('#general_error').html(_.escape(errors["error"]));
	}
    }

    function ClearFormErrors()
    {
	$('.step-forms .control-error').html("").addClass("hidden");
	$('.step-forms .form-group').removeClass("has-error");
	// See above, this needs to be fixed.
	$('.step-forms .format-me').removeClass("has-error");
	$('#general_error').html("");
    }

    function SerializeForm()
    {
	// Current form contents as formfields array.
	var formfields  = {};
	var sites       = {};
	
	// The dates are special
	var start_day  = $('#step3-form [name=start_day]').val();
	var start_hour = $('#step3-form [name=start_hour]').val();
	if (start_day && start_hour) {
	    var start = moment(start_day, "MM/DD/YYYY");
	    start.hour(start_hour);
	    $('#step3-form [name=start]').val(start.format());
	}
	else {
	    $('#step3-form [name=start]').val("");
	}
	var end_day  = $('#step3-form [name=end_day]').val();
	var end_hour = $('#step3-form [name=end_hour]').val();
	if (end_day && end_hour) {
	    var end = moment(end_day, "MM/DD/YYYY");
	    end.hour(end_hour);
	    $('#step3-form [name=end]').val(end.format());
	}
	else {
	    $('#step3-form [name=end]').val("");
	}
	
	// Convert form data into formfields array, like all our
	// form handler pages expect.
	var fields = $('.step-forms').serializeArray();
	$.each(fields, function(i, field) {
	    console.info(field, field.name, field.value);
	    /*
	     * The sites array is special since we want that to be
	     * an array inside of the formfields array, and serialize
	     * is not going to do that for us. 
	     */
	    var site = /^sites\[(.*)\]$/g.exec(field.name);
	    if (site) {
		sites[site[1]] = field.value;
	    }
	    else if (! (field.name == "where" && field.value == "(any)")) {
		formfields[field.name] = field.value;
	    }
	});
	if (Object.keys(sites).length) {
	    formfields["sites"] = sites;
	}
	console.info("SerializeForm", formfields);
	return formfields;
    }

    //
    // Submit the form. The step matters only when checking.
    //
    function SubmitForm(checkonly, step, callback)
    {
	// Current form contents as formfields array.
	var formfields  = SerializeForm();
	var args = {
	    "formfields" : formfields,
	    "step"       : step,
	};
	// Extra stuff for generating some stats. Only matters on step 3
	if (step == 3 && !checkonly) {
	    var info = {
		// User instantiates a specific profile. Otherwise used picker.
		"PROFILE_UUID"      : window.PROFILE_UUID || null,
		"RERUN_PARAMSET"    : window.RERUN_PARAMSET || null,
		"RERUN_INSTANCE"    : window.RERUN_INSTANCE || null,
		"SELECTED_PARAMSET" : window.SELECTED_PARAMSET || null,
		"SELECTED_INSTANCE" : window.SELECTED_INSTANCE || null,
		"MODIFIED_PARAMS"   : window.MODIFIED_PARAMS || null,
	    };
	    args["webinfo"] = info;
	}
	var rpc_callback = function(json) {
	    console.info(json);
	    callback(json);
	}
	ClearFormErrors();

	var xmlthing = sup.CallServerMethod(null, "instantiate",
					    (checkonly ?
					     "CheckForm" : "Submit"), args);
	xmlthing.done(rpc_callback);
    }

    function SetCookies(cookies) {
	// Delete existing cookies first
	var expires = "expires=Thu, 01 Jan 1970 00:00:01 GMT;";

	$.each(cookies, function(name, value) {
	    document.cookie = name + '=; ' + expires;

	    var cookie = 
		name + '=' + value.value +
		'; domain=' + value.domain +
		'; max-age=' + value.expires + '; path=/; secure';

	    document.cookie = cookie;
	});
    }

    function SetCookie(name, value, days) {
	// Delete existing cookies first
	var expires = "expires=Thu, 01 Jan 1970 00:00:01 GMT;";
	document.cookie = name + '=; ' + expires;

	var date = new Date();
	date.setTime(date.getTime()+(days*24*60*60*1000))

	var cookie = name + '=' + value +
		'; expires=' + date.toGMTString() + '; path=/';

	document.cookie = cookie;
    }

    /*
     * Show the XML in a modal. Read only so hide the edit buttons.
     */
    function showXMLModal()
    {
	$('#rspec_modal_editbuttons').addClass("hidden");
	$('#rspec_modal_viewbuttons').removeClass("hidden");
	$('#modal_profile_rspec_textarea').val(selected_rspec);
	$('#modal_profile_rspec_textarea').prop("readonly", true);
	$('#modal_profile_rspec_div').addClass("hidden");
	$('#modal_profile_rspec_textarea').removeClass("hidden");
	$('#rspec_modal').modal({'backdrop':'static','keyboard':false});
	$('#rspec_modal').modal('show');

	$('#close_rspec_modal_button').click(function (event) {
	    $('#rspec_modal').modal('hide');
	    $('#modal_profile_rspec_textarea').val("");
	    $('#close_rspec_modal_button').off("click");
	});
    }

    function SwitchJacks(which)
    {
      //console.info("SwitchJacks", which);
      if (which == 'small')
      {
	$('#stepsContainer #finalize_container')
	  .removeClass('col-lg-12 col-md-12 col-sm-12');
	$('#stepsContainer #finalize_container')
	  .addClass('col-lg-8 col-md-8 col-sm-8');
	$('#stepsContainer #inline_large_jacks').html('');
	$('#inline_large_container').addClass('hidden');
	ShowThumbnail(selected_rspec, null);
	$('#stepsContainer-p-2 #inline_container')
	  .removeClass('hidden');
      }
      else if (which == 'large')
      {
	// Sometimes the steps library will clean up the added elements
	if ($('#inline_large_container').length === 0)
	{        
	  $('<div id="inline_large_container" class="hidden"></div>')
	    .insertAfter('#stepsContainer .content');
	  $('#inline_large_container')
	    .html(''
		  +'<button id="closeLargeInline" type="button" class="close" data-dismiss="alert" aria-label="Close"><span aria-hidden="true">&times;</span></button>'
		  +'<div id="inline_large_jacks"></div>');
	  $('#stepsContainer #inline_large_container')
	    .addClass('col-lg-8 col-lg-offset-2 col-md-8 col-md-offset-2 col-sm-10 col-sm-offset-1 col-xs-12 col-xs-offset-0');
		
	  $('#closeLargeInline').click(function() {
	    SwitchJacks('small');
	  });
	}

	$('#stepsContainer #finalize_container')
	  .removeClass('col-lg-8 col-md-8 col-sm-8');
	$('#stepsContainer #finalize_container')
	  .addClass('col-lg-12 col-md-12 col-sm-12');
	//$('#stepsContainer-p-2 #inline_jacks').html('');
	$('#stepsContainer-p-2 #inline_container')
	  .addClass('hidden');

	if (ispprofile)
	{
	    ChangeJacksRoot();
	}
	else
	{
	    ShowProfileSelectionInline();
	}
	$('#inline_large_container').removeClass('hidden');
      }
    }

    // Used to generate the topology on Tab 3 of the wizard for non-pp profiles
    function ShowProfileSelectionInline()
    {
	console.info("ShowProfileSelectionInline");
	var root = $('#stepsContainer #inline_large_jacks');

	$('#stepsContainer #inline_overlay').removeClass("hidden");
	$('#inline_jacks #edit_dialog #edit_container')
	    .removeClass("hidden");
	editor = new JacksEditor(root, true, true, false, true, !multisite);
	editor.show(selected_rspec);
    }

    // Called when the user selects a profile in the picker.
    function ChangeProfileSelection(selected) {
	console.info("ChangeProfileSelection", selected);
	setStepsMotion(false);
	
	var continuation = function(blob) {
	    var profile_name = blob.name;

	    // The selected profile in the submitted form.
	    // Might be a secret hash.
	    $('#selected_profile').attr('value', selected);
	    $('#selected_profile_text').html("" + profile_name);
	    $('#selected_profile_description').html(blob.description);
	    $('#finalize_profile_name').text(profile_name + ":" + blob.version);

	    ispprofile       = blob.ispprofile;
	    isscript         = blob.isscript;
	    selected_profile = selected;
	    selected_uuid    = blob.uuid;
	    selected_rspec   = instantiateCommon.setClusters(blob.rspec);
	    selected_version = blob.version;
	    amdefault        = blob.amdefault;
	    if (ispprofile) {
		$('#save_paramset_button').removeClass("hidden");
	    }
	    else {
		$('#save_paramset_button').addClass("hidden");
	    }
	    $('#profile_show_button')
		.attr("href", "show-profile.php?profile=" + selected_profile);

	    if (window.CANCOPY && !blob.fromrepo) {
		CopyProfile.SwitchProfile(selected_profile);
		$('#profile-copy-button').removeClass("hidden");
	    }
	    else {
		// Not allowed to copy a repo based profile.
		$('#profile-copy-button').addClass("hidden");
	    }
	    /*
	     * If not showing the picker, we are not switching profiles
	     * so do not overwrite the current profile info.
	     */
	    if (showpicker) {
		// The point of changing these is for the ppwizard warnings.
		window.PROFILE_VERSION = blob.version;
		
		if (blob.fromrepo) {
		    window.PROFILE_REFSPEC = blob.reporef;
		    window.PROFILE_REFHASH = blob.repohash;
		    window.TARGET_REFSPEC  = blob.reporef;
		    window.TARGET_REFHASH  = blob.repohash;
		    // The picker always switches to head of default branch.
		    window.TARGET_HEADHASH = window.TARGET_REFHASH;
		    window.FROMREPO = true;
		}
		else {
		    window.PROFILE_REFSPEC = window.TARGET_REFSPEC = null;
		    window.PROFILE_REFHASH = window.TARGET_REFHASH = null;
		    // The picker always gets the most recent version.
		    window.PROFILE_HEADVERS = window.PROFILE_VERSION;
		    window.FROMREPO = false;
		}
		rerun_instance = null;
		rerun_loaded   = null;
	    }
	    if (blob.fromrepo) {
		var text = profile_name + " (Repo: " +
		    blob.repohash.substr(0, 8) + ", " +
		    blob.reporef + ")";
		
		$('#selected_profile_text').html(text);

		// See ppwizard, it will run the script again if
		// the params change and need to know what to
		// checkout in the jail.
		window.TARGET_REPOREF = blob.repohash;
	    }
	    setStepsMotion(true);
	    CreateAggregateSelectors();

	    /*
	     * First time, if skipfirststep is set, do it and clear.
	     */
	    if (window.SKIPFIRSTSTEP) {
		$('#stepsContainer').steps('next');
		window.SKIPFIRSTSTEP = false;
	    }
	};
	GetProfile(selected, continuation);
    }

    /*
     * No need to get script source code when getting the profile for
     * the profile picker.
     */
    function GetProfile(profile, continuation)
    {
	console.info("GetProfile", profile);
	var args = {
	    "profile"   : profile,
	    "getsource" : 1,
	    "getxml"    : 1,
	};
	
	var callback = function(json) {
	    if (json.code) {
		alert("Could not get profile: " + json.value);
		return;
	    }
	    console.info("GetProfile:", json);
	    var blob = json.value;

	    /*
	     * We now use the desciption from inside the rspec, unless there
	     * is none, in which case look to see if the we got one in the
	     * rpc reply, which we will until all profiles converted over to
	     * new format rspecs.
	     */
	    var getDescription = function(rspec) {
		var xmlDoc = $.parseXML(blob.rspec);
		var xml    = $(xmlDoc);
		var description = null;
	    
		$(xml).find("rspec_tour").each(function() {
		    $(this).find("description").each(function() {
			description = marked($(this).text());
		    });
		});
		if (!description || description == "") {
		    description = "Hmm, no description for this profile";
		}
		return description;
	    };

	    /*
	     * If a repo based profile and we are not getting the HEAD
	     * of the default branch, then we need to store the script in
	     * the form. We also get back the actual hash for the
	     * case that we did not request something specific, and
	     * we need to remember that in the form too.
	     */
	    if (blob.fromrepo && _.has(args, "refhash")) {
		// Need to pass these along at submit.
		$('#repohash').val(blob.repohash);
		$('#reporef').val(blob.reporef);

		if (_.has(blob, "rspec")) {
		    // This is a script.
		    
		    // Need to pass these along at submit.
		    $('#rspec_textarea').val(blob.rspec);
		    $('#script_textarea').val(blob.source);

		    /*
		     * We can get a parameterized profile or this
		     * version might not be parameterized.
		     */
		    if (_.has(blob, "paramdefs")) {
			// Need to pass along at submit.
			$('#paramdefs').val(blob.paramdefs);
			blob.ispprofile = true;
		    }
		    else {
			blob.ispprofile = false;
		    }
		}
		else {
		    // This is not a script.
		    blob.rspec = blob.source;
		    
		    // Need to pass this along at submit.
		    $('#rspec_textarea').val(blob.source);
		}
	    }
	    // Easier to do this here.
	    blob.description = getDescription(blob.rspec);
	    continuation(blob);
	}
	/*
	 * When instantiating a specific repo based profile, need to
	 * indicate what source we want if not the default.
	 */
	if (window.PROFILE_UUID && window.FROMREPO &&
	    window.TARGET_REFHASH != window.PROFILE_REFHASH) {
	    args["refhash"] = window.TARGET_REFHASH;
	    args["refspec"] = window.TARGET_REFSPEC;
	    sup.ShowWaitWait("We are getting the source code from the " +
			     "repository. Patience please.");
	}
	sup.CallServerMethod(null, "instantiate", "GetProfile", args,
			     function (json) {
				 if (_.has(args, "refhash")) {
				     sup.HideWaitWait(function() {
					 callback(json);
				     });
				 }
				 else {
				     callback(json);
				 }
			     });
    }

    //
    // Pass a geni-lib script to the server to run (convert to XML).
    // We use this on repo-based profiles, where we have to get the
    // source code from the repo, and convert to an rspec.
    //
    // We pass along the refspec (which might be a hash) so that the
    // corresponding commit can be checked out in the genilib jail.
    // Really, why are we passing the script around?
    //
    function ConvertScript(script, profile_uuid, refspec, continuation)
    {
	var callback = function(json) {
	    console.info("ConvertScript", json);
	    sup.HideWaitWait();

	    if (json.code) {
		sup.SpitOops("oops",
			     "<pre><code>" +
			     $('<div/>').text(json.value).html() +
			     "</code></pre>");
		return;
	    }
	    if (json.value.rspec != "") {
		continuation(json.value.rspec, json.value.paramdefs);
	    }
	}
	sup.ShowWaitWait("We are converting the geni-lib script to an rspec. " +
			 "Patience please.");
	var args = {
	    "script"       : script,
	    "profile_uuid" : profile_uuid,
	    "refspec"      : refspec,
	    "getparams"    : true,
	};
	console.info("ConvertScript", args);
	sup.CallServerMethod(null, "manage_profile",
			     "CheckScript", args, callback);
    }

    /*
     * Callback from the PP configurator. Stash rspec into the form.
     */
    function ConfigureDone(newRspec) {
	console.info("ConfigureDone: " + (newRspec ? "changed" : "no change"));

	// New rspec means it changed in ppwizard
	if (newRspec) {
	    selected_rspec = instantiateCommon.setClusters(newRspec);
	    $('#rspec_textarea').val(selected_rspec);
	    CreateAggregateSelectors();
	    ShowThumbnail(selected_rspec, updateJacksGraph);
	}
    }

    /*
     * Build up a list of Aggregate selectors. Normally just one, but for
     * a multisite aggregate, need more then one.
     */
    function CreateAggregateSelectors()
    {
	var pid    = $('#project_selector #profile_pid').val();	

	// No need to do this if not showing selectors.
	if (!window.CLUSTERSELECT) {
	    return;
	}
	instantiateCommon.createAggregateSelectors(selected_rspec, pid);
    }

    /*
     * This is called only once now.
     */
    function CreateProjectSelector()
    {
	var options   = "";
	var selected  = formfields.pid;

	_.each(projlist, function(gids, pid) {
	    // Look for current or upcoming resgroups.
	    var resgroup = null;
	    if (_.has(resgroups.current, pid)) {
		resgroup = {
		    "which"   : "active",
		    "class"   : "has_reservation",
		};
	    }
	    else if (_.has(resgroups.future, pid)) {
		resgroup = {
		    "which"   : "upcoming",
		    "class"   : "future_reservation",
		};
	    }
	    options = options +
		pidTemplate({
		    "pid"      : pid,
		    "selected" : pid === selected,
		    "resgroup" : resgroup,
		    "priority" : 1,
		});
	});
	var picker = projectTemplate({
	    "projects"  : options,
	    "count"     : _.size(projlist),
	});
	$("#project_selector").html(picker);
	$('#project_selector [data-toggle="tooltip"]').tooltip();

	/* 
	 * When a choice is made, need to update the button contents 
	 * and the hidden form input.
	 */
	$("#project_selector ul li a")
	    .click(function (event) {
		event.preventDefault();
		var value    = $(this).attr("value");
		var picker   = $(this).closest(".project-picker");
		var tooltips = "";
		var which    = "";

		// Watch for reset back to "Please Select"
		if (value == "") {
		    value = "Please Select";
		}
		else {
		    tooltips = $(this).find(".reservation-tooltips").html();
		    which   = value;
		}
		if ($(picker).find("#profile_pid").val() == which) {
		    // No changea to be made. 
		    return;
		}
		$(picker).find("button .value").html(value);
		$(picker).find("button .reservation-tooltips").html(tooltips);
		$(picker).find("#profile_pid").val(which);
		$(picker).find("li").removeClass("selected");
		$(this).closest("li").addClass("selected");

		UpdateGroupSelector();
		// Need to update the reservation tooltips after pid select
		CreateAggregateSelectors();
		// Need to update image constraints when the project changes
		UpdateImageConstraints();
	    });

	// Trigger selection
	if (selected != "") {
	    $("#project_selector ul li.selected a").click();
	}
    }

    /*
     * Called whenever the project changes
     */
    function UpdateGroupSelector()
    {
	var options  = "";
	var pid      = $('#project_selector #profile_pid').val();
	var selected = "";

	if (pid == "") {
	    console.info("Clearing the group selector");
	    $('#group_selector').html("");
	    return;
	}

	/*
	 * If there is a default project, then whenever we return to
	 * it, use the default gid. Otherwise if there is only one group
	 * in the project, default to that. See below, we will hide the
	 * group selector when there is only one group in the project.
	 */
	if (pid == formfields.pid) {
	    selected = formfields.gid;
	}
	else {
	    selected = pid;
	}
	console.info("CreateGroupSelector", pid, selected);
	
	_.each(projlist[pid], function(gid) {
	    options = options +
		gidTemplate({
		    "gid"      : gid,
		    "selected" : gid === selected,
		});
	});
	var picker = groupTemplate({
	    "groups"  : options,
	});
	$("#group_selector").html(picker);

	/* 
	 * When a choice is made, need to update the button contents 
	 * and the hidden form input.
	 */
	$("#group_selector ul li a")
	    .click(function (event) {
		event.preventDefault();
		var value    = $(this).attr("value");
		var picker   = $(this).closest(".group-picker");
		var which    = "";

		// Watch for reset back to "Please Select"
		if (value == "") {
		    value = "Please Select";
		}
		else {
		    which   = value;
		}
		if ($(picker).find("#profile_gid").val() == which) {
		    // No change to be made. 
		    return;
		}
		$(picker).find("button .value").html(value);
		$(picker).find("#profile_gid").val(which);
		$(picker).find("li").removeClass("selected");
		$(this).closest("li").addClass("selected");
	    });

	// Trigger selection
	if (selected != "") {
	    $("#group_selector ul li.selected a").click();
	}
	// If only one gid, no need to show.
	// But beware of the case that the one gid is actually a subgroup cause
	// the user has "user" privs in the project.
	if (_.size(projlist[pid]) == 1 && projlist[pid][0] == pid) {
	    $("#group_selector").addClass("hidden");
	}
	else {
	    $("#group_selector").removeClass("hidden");
	}
    }
    
    /*
     * Make sure all clusters selected before submit.
     */
    function AllClustersSelected() 
    {
	return instantiateCommon.allClustersSelected();
    }
    
    // Cluster selection mapping by selector id.
    function ClusterSelections()
    {
	var clusters = {};
	
	$('#cluster_selector').find('.select_where').each(function () {
	    var cluster = $(this).val();
	    var urn     = amValueToKey[cluster];
	    
	    clusters[$(this).data("siteid")] = urn;
	});
	return clusters;
    }

    function contextReady(data)
    {
	var constraints;
	var context = data;
	
	if (typeof(context) === 'string')
	{
	    context = JSON.parse(context);
	}
	if (context.canvasOptions.defaults.length === 0)
	{
	    delete context.canvasOptions.defaults;
	}
	
	jacks.instance = new window.Jacks({
	    mode: 'viewer',
	    source: 'rspec',
	    root: '#jacks-dummy',
	    nodeSelect: true,
	    readyCallback: function (input, output) {
		constraints = new JACKS_LOADER.Constraints(context);
	    },
	    canvasOptions: context.canvasOptions,
	    constraints: context.constraints
	});
    }

    // This has the Jacks parsed rspec that we use for some simple
    // constraint checking.
    var jacksGraph = null;

    function updateJacksGraph(newGraph)
    {
	console.log('updateJacksGraph', newGraph);
	jacksGraph = newGraph;
    }

    /*
     * Update the image constraints if anything changes.
     */
    function UpdateImageConstraints()
    {
	var pid = $('#project_selector #profile_pid').val();
	
	console.info("UpdateImageConstraints", pid);

	if (!doconstraints || pid == "" || jacksGraph == null) {
	    //CreateAggregateSelectors();
	    return;
	}
	var images = [];
	_.each(jacksGraph.nodes, function (node) {
	    if (node.image) {
		images = _.union(images, [node.image]);
	    }
	});
	if (!images.length) {
	    return;
	}
	
      	setStepsFinish(false);
	var callback = function(json) {
	    if (json.code) {
		alert("Could not get image info: " + json.value);
		return;
	    }
	    showDeprecatedImages(json.value[0].images);
	    setStepsFinish(true);
	};
	/*
	 * Must pass the selected project along for constraint checking.
	 */
	var $xmlthing =
	    sup.CallServerMethod(null,
				 "instantiate", "GetImageInfo",
				 {"images"  : images,
				  "project" : pid});
	$xmlthing.done(callback);
	return true;
    }

    // Show the deprecated warnings.
    function showDeprecatedImages(images)
    {
	console.info("showDeprecated:", images);
	var html = "";

	_.each(images, function(image) {
	    if (image.deprecated) {
		html += '<p>Image ' +
		    sup.ImageDisplay(image.id) + ' is deprecated: ' +
		    image.deprecated_message;
		
		if (image.deprecated_iserror) {
		    html += ': Using this image will cause your ' +
			'experiment to fail.';
		}
		html += '</p>';
	    }
	});
	
	if (html == "") {
	    $('#deprecated-images').addClass("hidden");
	}
	else {
	    $('#deprecated-images').html(html).removeClass("hidden");
	}
    }
  
    function contextFail(fail1, fail2)
    {
	console.log('Failed to fetch context', fail1, fail2);
	alert('Failed to fetch context from ' + contextUrl + '\n\n' +
	      'Check your network connection and try again or contact testbed support ' +
	      'with this message and the URL of this webpage.');
    }

    function LoadReservationInfo()
    {
	var callback = function(json) {
	    if (json.code) {
		console.info("Could not get reservation info: " + json.value);
		return;
	    }
	    console.info("resinfo", json.value);
	    resinfo = json.value;
	    var pid = $('#project_selector #profile_pid').val();
	    instantiateCommon.generateReservationInfo(pid, resinfo);
	};
	var xmlthing =
	    sup.CallServerMethod(null, "reserve", "ReservationInfo", null);
	xmlthing.done(callback);
    }

    /*
     * When the date selected is today, need to disable the hours
     * before the current hour.
     */
    function DateChange(which)
    {
	var date = $("#step3-form " + which).datepicker("getDate");
	var now = new Date();

	if (which == "#start_day" || which == "#end_day") {
	    var selecter;
	    if (which == "#start_day") {
		selecter = "#step3-form #start_hour";
	    }
	    else {
		selecter = "#step3-form #end_hour";
	    }
	    console.info(moment(date), moment(now));

	    /*
	     * Enable all hours,
	     */
	    for (var i = 0; i <= 24; i++) {
		$(selecter + " option[value='" + i + "']")
		    .removeAttr("disabled");
	    }
	    // Zero out the current choice.
	    $(selecter).val("");

	    // If today, cannot select anything before the current time.
	    if (date == null || moment(date).isSame(moment(now), "day")) {
		for (var i = 0; i <= now.getHours(); i++) {
		    $(selecter + " option[value='" + i + "']")
			.attr("disabled", "disabled");
		}
	    }
	    console.info("bar", maxEndDate);
	    // If there is a max duration set and is equal to the
	    // selected day, must disable everything after the max
	    // hour.
	    if (which == "#end_day" && maxEndDate &&
		moment(date).isSame(moment(maxEndDate), "day")) {
		console.info("foo");

		for (var i = maxEndDate.getHours() + 1; i < 24; i++) {
		    $(selecter + " option[value='" + i + "']")
			.attr("disabled", "disabled");
		}
	    }
	}
	if (1) {
	if (window.ISPOWDER &&
	    (which == "#start_day" || which == "#start_hour")) {
	    if (isadmin || window.USENEWSCHEDULE) {
		/*
		 * The powder portal gets a termination datepicker. Whenever
		 * the start time is changed, recalc the maximum allowed
		 * duration and modify the termination accordingly. Also need
		 * to do this when the project changes.
		 */
		UpdateMaxDuration();
	    }
	    else if ($("#start_day").datepicker("getDate") &&
		     $('#start_hour').val()) {
		var mindate = $("#start_day").datepicker("getDate");
		mindate.setHours($('#start_hour').val());
		var maxdate = new Date(mindate.getTime());
		maxdate.setHours(maxdate.getHours() + window.MAXDURATION);
	    
		console.info(mindate, maxdate);
		$("#end_day").datepicker("option", "minDate", mindate);
		$("#end_day").datepicker("setDate", mindate);
		$("#end_day").datepicker("option", "maxDate", maxdate);
		$("#end_day").datepicker("refresh");
		$("#end_hour").val(maxdate.getHours());
	    }
	}
	}
    }

    /*
     * Ask for the max duration of this experiment, based on reservations
     * approved, to the project selected and the current start date/time
     * in the picker. Any time the project or the start time changes, we
     * update the end date.
     */
    function UpdateMaxDuration()
    {
	var start_day  = $('#step3-form [name=start_day]').val();
	var start_hour = $('#step3-form [name=start_hour]').val();

	console.info("UpdateMaxDuration", start_day, start_hour);
	$('#doesnotfit-warning').addClass("hidden");

	// Only if start time properly set.
	if (! ((start_day && start_hour) || (!start_day && !start_hour))) {
	    return;
	}
	// Current form contents as formfields array.
	var formfields = SerializeForm();

	// Update pickers.
	var callback = function (json) {
	    console.info(json);
	    if (json.code) {
		console.info("UpdateMaxDuration: " . json.value);
		return;
	    }
	    // Saved globally for above
	    var maxdate = json.value["maxend"];
	    var mindate = $("#start_day").datepicker("getDate");

	    if (!maxdate) {
		if (start_day) {
		    $('#doesnotfit-warning-now').addClass("hidden");
		    $('#doesnotfit-warning-datetime').removeClass("hidden");
		}
		else {
		    $('#doesnotfit-warning-now').removeClass("hidden");
		    $('#doesnotfit-warning-datetime').addClass("hidden");
		}
		$('#bestguess-info').addClass("hidden");
		$('#doesnotfit-warning').removeClass("hidden");
		return;
	    }
	    else {
		$('#doesnotfit-warning').addClass("hidden");
		$('#bestguess-info').removeClass("hidden");
	    }
	    if (!mindate) {
		mindate = new Date();
	    }
	    maxdate = maxEndDate = new Date(maxdate);
	    console.info("UpdateMaxDuration: ", mindate, maxdate);
	    
	    $("#end_day").datepicker("option", "minDate", mindate);
	    $("#end_day").datepicker("option", "maxDate", maxdate);
	    $("#end_day").datepicker("setDate", maxdate);
	    $("#end_day").datepicker("refresh");

	    /*
	     * Enable all hours,
	     */
	    for (var i = 0; i <= 24; i++) {
		$("#end_hour option[value='" + i + "']")
		    .removeAttr("disabled");
	    }
	    /*
	     * If today, disable all hours up to current.
	     */
	    if (moment(maxdate).isSame(Date.now(), "day")) {
		var now = new Date();
		
		for (var i = 0; i <= now.getHours(); i++) {
		    $("#end_hour option[value='" + i + "']")
			.attr("disabled", "disabled");
		}
	    }
	    /*
	     * Disable all hours in the selector beyond the max hour.
	     */
	    for (var i = maxdate.getHours() + 1; i < 24; i++) {
		/*
		 * Before we disable the option, see if it is selected.
		 * If so, we want to make the user re-select the hour.
		 */
		if ($("#end_hour option:selected").val() == i) {
		    $("#end_hour").val("");
		}
		$("#end_hour option[value='" + i + "']")
		    .attr("disabled", "disabled");
	    }
	    /*
	     * And select the max hour for the user.
	     */
	    $("#end_hour").val(maxdate.getHours());
	};
	var args = {"formfields" : formfields,
		    "rspec"      : selected_rspec};
	// Hopefully the prediction info has returned in time.
	if (resinfo) {
	    // Prediction info comes back with pid lowercase cause of
	    // HRN normalization rules.
	    var pid = $('#profile_pid').val().toLowerCase();
	    var forecasts = {};
	    _.each(resinfo, function (info, urn) {
		console.info(urn, info);
		// Ick.
		if (!_.has(info, "pforecasts")) {
		    return;
		}
		forecasts[urn] = {};
		forecasts[urn]["forecast"] = info["pforecasts"][pid];
	    });
	    args["prediction"] = JSON.stringify(forecasts);
	}
	console.info("UpdateMaxDuration args:", args);
	var xmlthing = sup.CallServerMethod(null, "instantiate",
					    "MaxDuration", args);
	xmlthing.done(callback);
    }
    

    /*
     * Handle License requirements.
     */
    function HandleLicenseRequirements(licenses)
    {
	var html = "";

	_.each(licenses, function (details) {
	    var dt = null;

	    if (details.type == "node") {
		dt = "Node " + details.target;
	    }
	    else if (details.type == "type") {
		dt = "Node Type " + details.target;
	    }
	    else if (details.type == "aggregate") {
		dt = "Resource " + details.target;
	    }
	    html = html +
		"<dt>" + dt + "</dt>" +
		"<dd><pre>" + details.description_text + "</pre></dd>";
	});
	$('#request-licenses-modal dl').html(html);
	
	$('#request-license-button').click(function (event) {
	    sup.HideModal('#request-licenses-modal');
	    sup.CallServerMethod(null, "instantiate", "RequestLicenses",
				 {"licenses" : JSON.stringify(licenses)},
				 function (json) {
				     if (json.code) {
					 alert("Could not request resource " +
					       "access: " + json.value);
					 return;
				     }
				     window.location
					 .replace("licenses-pending.php");
				 });
	});
	sup.ShowModal('#request-licenses-modal', function () {
	    $('#request-license-button').off("click");
	});
    }

    /*
     * Check for radio usage and no spectrum defined
     */
    function CheckForRadioUsage()
    {
	// Moved to common file for sharing with status.js
	var using = instantiateCommon.checkForRadioUsage(selected_rspec);
	
	usingRadios   = using.usingRadios;
	usingSpectrum = using.usingSpectrum;
    }
     
    /*
     * Check for spectrum used. This is on the last (schedule) step.
     */
    function CheckForSpectrum()
    {
	console.info("CheckForSpectrum", usingSpectrum);

	/*
	 * Kirk requested that we do not predicate this on using spectrum
	 * but always on the Powder portal.
	 */
	if (!window.ISPOWDER || window.STRESSTEST) {
            $('#step3-div .reserve-resources-button').off("click");
            $('#step3-div .schedule-experiment').removeClass("hidden");
            $('#step3-div .reserve-resources').addClass("hidden");
            $('#groups-div').addClass("hidden");
            $('#groups').html("");
	    return;
	}
	// But if not using radios, different warning text, it worries people.
	if (usingRadios) {
	    $('#step3-div .reserve-resources .radio-warning')
		.removeClass("hidden");
	    $('#step3-div .reserve-resources .noradio-warning')
		.addClass("hidden");
	}
	else {
	    $('#step3-div .reserve-resources .radio-warning')
		.addClass("hidden");
	    $('#step3-div .reserve-resources .noradio-warning')
		.removeClass("hidden");
	}
	if (usingRadios || usingSpectrum) {
	    var pid = $('#profile_pid').val();

	    // Project cannot proceed without OTA permission.
	    if (!otaStuff.HasOtaPermission(pid)) {
		setStepsFinish(false);
		otaStuff.RequestOtaPermission(pid);
		return;
	    }
	    // User cannot proceed without OTA agreement.
	    else if (!window.OTA_AGREED) {
		setStepsFinish(false);
		otaStuff.RequestOtaAgreement(function (agreed) {
		    if (agreed) {
			setStepsFinish(true);
			window.OTA_AGREED = true;
		    }
		});
	    }
	    else {
		setStepsFinish(true);
	    }
	}
	
	/*
	 * Helper functions
	 */
	var setPickers = function(start, end) {
	    var start = moment(start);
	    var end = moment(end);

	    // If the reservation group starts in the past, do not set
	    // a start time.
	    if (! start.isBefore()) {
		$('#start_day').val(start.format("MM/DD/YYYY"));
		$('#start_hour').val(start.format("H"));
		$("#start_hour option[value='" + start.hour() + "']")
		    .removeAttr("disabled");
	    }
	    else {
		$('#start_day').val("");
		$('#start_hour').val("");
	    }
	    $('#end_day').val(end.format("MM/DD/YYYY"));
	    $('#end_hour').val(end.format("H"));
	    $("#end_hour option[value='" + end.hour() + "']")
		.removeAttr("disabled");
	};
	var clearPickers = function() {
	    // Set the pickers.
	    $('#start_day').val("");
	    $('#start_hour').val("");
	    $('#end_day').val("");
	    $('#end_hour').val("");
		    
	    // These are in the form.
	    $('#step3-form [name=start]').val("");
	    $('#step3-form [name=end]').val("");

	    // Clear checkboxes to make sure there is no confusion.
	    $(".select-reservation")
		.each(function(){ this.checked = false; });
	};

	/*
	 * For resgroup list, we bind a click handler to copy the
	 * start/end into the pickers.
	 */
	var setupCheckboxes = function (resgroups, uuid) {
	    $(".select-reservation").change(function (event) {
		if ($(this).is(":checked")) {
		    // Uncheck other boxes.
		    $(".select-reservation")
			.each(function(){ this.checked = false; });
		    $(this).prop("checked", true);

		    var uuid  = $(this).val();
		    var group = resgroups[uuid];
		    console.info("setupCheckboxes", uuid, group);
		    setPickers(group.start, group.end);
		}
		else {
		    clearPickers();
		}
	    });
	    // Tooltip for the checkboxes.
	    $(".select-reservation").tooltip({
		"container" : "body",
		"trigger"   : "hover",
		"title"     : "Click to copy the start/end time for this " +
		    "reservation, to the start/end inputs above",
	    });
	    
	    // Check this reservation.
	    if (uuid) {
		$('#groups input[type=checkbox][value=' + uuid + ']')
		    .prop("checked", true);
	    }
	}
	/*
	 * Check for existing reservations and draw the list.
	 */
	var showResgroupList = function (uuid) {
	    sup.CallServerMethod(null, "resgroup", "ListReservationGroups",
				 {"project" : $('#profile_pid').val()},
				 function (json) {
				     if (json.code) {
					 console.info(json.value);
					 return;
				     }
				     var groups = json.value;
				     if (_.size(groups)) {
					 $('#groups-div').removeClass("hidden");
					 window.DrawResGroupList('#groups-div',
								 groups);
					 setupCheckboxes(json.value, uuid);
				     }
				     else {
					 $('#groups-div').addClass("hidden");
				     }
				 });
	}
	if (!window.NOPREDICTION) {
	    showResgroupList();
	}
	
	/*
	 * We hide the normal scheduling controls and show a list of
	 * reservations the user can select from for scheduling the
	 * experiment. I think this is going to be very confusing.
	 */
	$('#step3-div .schedule-experiment').addClass("hidden");
	$('#step3-div .reserve-resources').removeClass("hidden");

	/*
	 * Wait for user to decide to create a new reservation.
	 */
	$('#step3-div .reserve-resources-button').click(function (event) {
	    event.preventDefault();
	    if ($('#reservation-iframe').length) {
		return;
	    }
	    
	    /*
	     * Hide steps control buttons until the iframe is closed.
	     */
	    $('#stepsContainer .actions').addClass("hidden");

	    /*
	     * Clear the pickers and the checkboxes.
	     */
	    clearPickers();

	    /*
	     * Place into an iframe in the panel body,
	     */
	    var url  = "resgroup.php?fromrspec=1&embedded=1" +
		"&project=" + $('#profile_pid').val();
	
	    var html = '<iframe id="reservation-iframe" class=col-xs-12 ' +
		'style="padding-left: 0px; padding-right: 0px; border: 0px;" ' +
		'height=1200 ' + 'src=\'' + url + '\'>';
	
	    $('#step3-div .resgroup-div').removeClass("hidden");
	    $('#step3-div .resgroup-div .panel-body').html(html);

	    var iframe = $('#reservation-iframe')[0];
	    var iframewindow = (iframe.contentWindow ?
				iframe.contentWindow :
				iframe.contentDocument.defaultView);

	    iframewindow.addEventListener('DOMContentLoaded', function (event) {
		var foo = selected_rspec
		    .replace(/&/g, '&amp;')
		    .replace(/</g, '&lt;')
		    .replace(/>/g, '&gt;')
		    .replace(/"/g, '&quot;')
		    .replace(/'/g, '&apos;');
		
		var html =
		    "<div id=rspec class=hidden>" +
		    "  <textarea type='textarea'>" +
		        foo + "</textarea>" +
		    "</div>" +
		    "<script type='text/plain' id='cluster-selections'>" +
		       JSON.stringify(ClusterSelections()) +
		    "</script>";
		$("body", iframewindow.document).append(html);
		$("#wrap", iframewindow.document).css("padding", "0px");
	    });

	    // Slow timer to expand the iframe so no scroll bar.
	    var timer = setInterval(function() {
		var doc    = iframewindow.document;
		var height = $("#main-body", doc).css("height");
		var now    = $('#reservation-iframe').css("height");
		if (height != now) {
		    console.info("height", height);
		    $('#reservation-iframe').css("height", height);
		}
	    }, 250);

	    // Helper
	    var closeIframe = function () {
		$('#cancel-reserve-resources-button').off("click");
		$('#reservation-iframe').remove();
		$('#step3-div .resgroup-div').addClass("hidden");
		
		// Show the steps control buttons,
		$('#stepsContainer .actions').removeClass("hidden");
	    };

	    // Cancel operation.
	    $('#cancel-reserve-resources-button').click(function (event) {
		event.preventDefault();
		clearInterval(timer);
		closeIframe();
	    })

	    // Call back after getting the new reservation
	    var gotres_callback = function (json) {
		console.info("gotres_callback", json);
		if (json.code) {
		    sup.HideModal('#waitwait-modal', function () {
			alert("Could not get new reservation info");
		    });
		    return;
		}
		setPickers(json.value.start, json.value.end);
	    };
	    
	    /*
	     * An iframe cannot close itself, but it can call a function
	     * here cause its in the same domain.
	     */
	    window.CloseMyIframe = function (uuid) {
		console.info("Reservation is done", uuid);
		clearInterval(timer);

		if (uuid) {
		    // Look for updated rspec.
		    var rspec = $("#rspec textarea",
				  iframewindow.document).val();

		    if (rspec != selected_rspec) {
			console.info("RSpec changed", rspec);
			$('#rspec_textarea').val(rspec);
			selected_rspec = rspec;
		    }
		    // Redraw the list.
		    showResgroupList(uuid);
		    // Ask for the reservation info so we can set start/end.
		    sup.CallServerMethod(null, "resgroup",
					 "GetReservationGroup",
					 {"uuid"    : uuid},
					 gotres_callback);
		}
		else {
		    console.info("Did not get a uuid from iframe");
		}
		closeIframe();
		return;
	    };
	});
    }
    
    // If not parameterized we need to pick up the rerun details here.
    function LoadPreviousInstance()
    {
	var callback = function(json) {
	    console.info("LoadPreviousInstance", json);
	    if (json.code) {
		sup.SpitOops("oops", json.value);
		return;
	    }
	    rerun_instance = json.value;
	};
	var args = {
	    "profile"    : window.HASHKEY || window.PROFILE_UUID,
	    "rerun_uuid" : window.RERUN_INSTANCE,
	};
	return sup.CallServerMethod(null, "instantiate",
				    "GetPreviousBindings", args, callback);
    }
    // Load rerun instance stuff as needed. We only do this once, unless
    // user goes back and loads a new instance.
    function LoadRerunInstance()
    {
	if (rerun_loaded) {
	    return;
	}
	console.info("LoadRerunInstance", rerun_instance);
	var name = rerun_instance.rerun_name;
	var pid  = rerun_instance.rerun_pid;
	var gid  = rerun_instance.rerun_gid;

	console.info("LoadRerunInstance", name, pid, gid);

	// Do not replace auto generated name.
	if (!name.match(/[^-]+\-(QV)?\d+/)) {
	    $('#experiment_name').val(name);
	}
	if (_.size(projlist) > 1) {
	    $('#project_selector ul li a[value="' + pid + '"]').click();
	}
	if (gid != pid) {
	    $('#group_selector ul li a[value="' + gid + '"]').click();
	}
	/*
	 * Cannot handle multiple clusters cause of the site info. 
	 */
	if (rerun_instance.rerun_clusters.length == 1) {
	    var urn = rerun_instance.rerun_clusters[0];
	    var name = amlist[urn].name;

	    console.info("LoadRerunInstance", urn, name);

	    // Ick.
	    $('#site0cluster ul li[urn="' + urn + '"] a').click();
	}
	rerun_loaded = true;
    }

    /*
     * This stuff used to be in ppwizard but it currently makes no sense
     * to have there. And it confuses the hell out of things.
     */
    var thumbnail = null;
    var jacksGraphCallback = null;

    function countNodes(rspec)
    {
	//console.info("countNodes");
	var xmlDoc = $.parseXML(rspec);
	var count  = $(xmlDoc).find("node").length;
	return count;
    }
    function setJacksGraph(newGraph)
    {
	if (jacksGraphCallback) {
	    jacksGraphCallback(newGraph);
	}
    }
    
    function ShowThumbnail(rspec, jacks_callback)
    {
	console.info("ShowThumbnail", jacks_callback);
	jacksGraphCallback = jacks_callback;

	var root = $('#stepsContainer-p-2 #inline_jacks');
	if (! thumbnail) {
	    thumbnail = new jacksmod.Thumb(setJacksGraph);
	    root.append(thumbnail.el);
	}
	thumbnail.replaceRspec(rspec);
	if (countNodes(rspec) > 100) { 
	    $('#stepsContainer #inline_overlay').addClass("hidden");
	}
	else {
	  $('#stepsContainer #inline_overlay').removeClass("hidden");
	}
    }

    function ChangeJacksRoot()
    {
	var root = $('#stepsContainer #inline_large_jacks');
	
	if (selected_rspec) {
	    if (countNodes(selected_rspec) > 100) {
		$('#stepsContainer #inline_overlay').addClass("hidden");
		$('#inline_jacks #edit_dialog #edit_container')
		    .addClass("hidden");
		return;
	    }
	    else {
		$('#stepsContainer #inline_overlay').removeClass("hidden");
		$('#inline_jacks #edit_dialog #edit_container')
		    .removeClass("hidden");
	    }
	    var editor = new JacksEditor(root, true, true, false, true);
	    editor.show(selected_rspec);
	}
    }
    
    $(document).ready(initialize);
});
