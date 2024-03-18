$(function ()
{
    'use strict';

    var templates = APT_OPTIONS.fetchTemplateList(['user-dashboard',
	   'experiment-list', 'profile-list', 'project-list', 'dataset-list', 
	   'user-profile', 'oops-modal', 'waitwait-modal', 'classic-explist',
	   'conversion-help-modal','paramsets-list', "showtopo-modal",
	   "resources-list"]);
    var mainString = templates['user-dashboard'];
    var experimentString = templates['experiment-list'];
    var profileListString = templates['profile-list'];
    var projectString = templates['project-list'];
    var datasetString = templates['dataset-list'];
    var profileString = templates['user-profile'];
    var oopsString = templates['oops-modal'];
    var waitwaitString = templates['waitwait-modal'];
    var classicString = templates['classic-explist'];
    var converterHelpTemplate = _.template(templates['conversion-help-modal']);
    var mainTemplate = _.template(mainString);
    var amlist = null;

    function initialize()
    {
	window.APT_OPTIONS.initialize(sup);

	amlist = decodejson("#amlist-json");
	console.info("amlist", amlist);

	// Generate the main template.
	var html = mainTemplate({
	    disabledset : window.UI_DISABLE_DATASETS,
	    disabledres : window.UI_DISABLE_RESERVATIONS,
	    emulablink  : window.EMULAB_LINK,
	    isadmin     : window.ISADMIN,
	    target_user : window.TARGET_USER,
	});
	$('#main-body').html(html);
	$('#oops_div').html(oopsString);
	$('#waitwait_div').html(waitwaitString);
	$('#conversion_help_div').html(converterHelpTemplate({}));
	$('#showtopo-modal-div').html(templates["showtopo-modal"]);
	
	// Focus on the search box when switching to these tabs.
        $('.nav-tabs a[href="#profiles"], ' +
	  '.nav-tabs a[href="#projectprofiles"]')
	    .on('shown.bs.tab', function (e) {
		var target = $(this).attr("href");
		var searchbox = $(target).find(".profile-search");
		if ($(searchbox)[0]) {
		    $(searchbox)[0].focus();
		}
	    });

	// Setup nav tab document hash handling.
	sup.hashSetup(".nav-tabs", "#experiments");

	LoadUsage();
	LoadExperimentTab();
	LoadClassicExperiments();
	// Should we do these on demand?
	LoadProfileListTab();
	LoadProjectProfiles();
	LoadClassicProfiles();
	LoadProjectsTab();
	LoadProfileTab();
	LoadDatasetTab();
	LoadResgroupTab();
	LoadResourcesTab();
	LoadParameterSetsTab();
	LoadClassicDatasets();

	/*
	 * Handlers for inline operations.
	 */
	$('#sendtestmessage').click(function () {
	    SendTestMessage();
	});
	$('#sendmessage').click(function () {
	    SendMessage();
	});
	$('#sendpasswordreset').click(function () {
	    SendPasswordReset();
	});
	$('#confirm-deleteuser').click(function () {
	    DeleteUser();
	});
    }

    // Call back for bulk delete to remove the row from both tables.
    function DeleteProfileRows(uuid, json)
    {
	// The profile will exist in two tables ...
	$('#profiles_content tr[data-uuid="' + uuid + '"]').remove();
	$('#projectprofiles_content tr[data-uuid="' + uuid + '"]').remove();
    }

    function LoadUsage()
    {
	var callback = function(json) {
	    console.info("LoadUsage", json);

	    if (json.code) {
		console.info(json.value);
		return;
	    }
	    var blob = json.value;
	    var html = "";
	    if (!(blob.pnodes || blob.weekpnodes ||
		  blob.monthpnodes || blob.rank)) {
		$('#usage_nousage').removeClass("hidden");
		return;
	    }
	    if (blob.pnodes) {
		html = "<tr><td>Current Usage:</td><td>" +
		    blob.pnodes + " Node" + (blob.pnodes > 1 ? "s, " : ", ") +
		    blob.phours + " Node Hours</td></tr>";
	    }
	    if (blob.weekpnodes) {
		html = html + "<tr><td>Previous Week:</td><td>" +
		    blob.weekpnodes + " Node" +
		    (blob.weekpnodes > 1 ? "s, " : ", ") +
		    blob.weekphours + " Node Hours</td></tr>";
	    }
	    if (blob.monthpnodes) {
		html = html + "<tr><td>Previous Month:</td><td> " +
		    blob.monthpnodes + " Node" +
		    (blob.monthpnodes > 1 ? "s, " : ", ") +
		    blob.monthphours + " Node Hours</td></tr>";
	    }
	    if (blob.rank) {
		html = html +
		    "<tr><td>" + blob.rankdays + " Day Usage Ranking:</td><td>#" +
		    blob.rank + " of " + blob.ranktotal + " active users" +
		    "</td></tr>";
	    }
	    $('#usage_table tbody').html(html);
	}
	var xmlthing = sup.CallServerMethod(null,
					    "user-dashboard", "UsageSummary",
					    {"uid" : window.TARGET_USER});
	xmlthing.done(callback);
	
    }

    function LoadExperimentTab()
    {
	var template = _.template(experimentString);
	
	var callback = function(json) {
	    console.info("experiments", json);

	    if (json.code) {
		console.info(json.value);
		return;
	    }
	    if (json.value.user_experiments.length == 0) {
		$('#experiments_loading').addClass("hidden");
		$('#experiments_noexperiments').removeClass("hidden");
	    }
	    else {
		$('#experiments_content')
		    .html(template({"experiments" : json.value.user_experiments,
				    "showCreator" : false,
				    "showProject" : true,
				    "showPortal"  : false,
				    "searchUUID"  : false,
				    "showterminate" : true}));
	    }
	    if (json.value.project_experiments.length != 0) {
		$('#project_experiments_content')
		    .html("<div><h4 class='text-center'>" +
			  "Experiments in my Projects</h4>" +
			  template({"experiments" :
				        json.value.project_experiments,
				    "showCreator" : true,
				    "showProject" : true,
				    "showPortal"  : false,
				    "searchUUID"  : false,
				    "showterminate" : false}) +
			  "</div>");
	    }
	    // Format dates with moment before display.
	    $('#experiments_content .format-date, ' +
	      '#project_experiments_content .format-date')
		.each(function() {
		var date = $.trim($(this).html());
		if (date != "") {
		    $(this).html(moment($(this).html()).format("ll"));
		}
	    });
	    if (json.value.user_experiments.length != 0) {
		$('#experiments_content #experiments_table')
		    .tablesorter({
			theme : 'bootstrap',
			widgets : [ "uitheme" ],
			headerTemplate : '{content} {icon}',			
		    });
	    }
	    if (json.value.project_experiments.length != 0) {
		$('#project_experiments_content #experiments_table')
		    .tablesorter({
			theme : 'bootstrap',
			widgets : [ "uitheme", ],
			headerTemplate : '{content} {icon}',
		    });
	    }
	    // Terminate an experiment.
	    $('#experiments_content .terminate-button').click(function (event) {
		event.preventDefault();
		TerminateExperiment(this);
	    });
	}
	var xmlthing = sup.CallServerMethod(null,
					    "user-dashboard", "ExperimentList",
					    {"uid" : window.TARGET_USER});
	xmlthing.done(callback);
    }

    // Terminate an experiment
    function TerminateExperiment(target)
    {
	console.info($(target), $(target).data("uuid"));
	var uuid = $(target).data("uuid");

	var callback = function(json) {
	    sup.HideWaitWait();
	    if (json.code) {
		sup.SpitOops("oops", json.value);
		return;
	    }
	    // Reload the experiments tab. Easier.
	    LoadExperimentTab();
	};
	// Bind the confirm button in the modal. 
	$('#terminate-modal #terminate-confirm').click(function () {
	    sup.HideModal('#terminate-modal', function () {
		sup.ShowModal('#waitwait-modal');
		var xmlthing = sup.CallServerMethod(null, "status",
						    "TerminateInstance",
						    {"uuid" : uuid});
		xmlthing.done(callback);
	    });
	});
	// Handler so we know the user closed the modal. We need to
	// clear the confirm button handler.
	$('#terminate-modal').on('hidden.bs.modal', function (e) {
	    $('#terminate-modal #terminate-confirm').unbind("click");
	    $('#terminate-modal').off('hidden.bs.modal');
	});
	sup.ShowModal("#terminate-modal");
    }

    function LoadClassicExperiments()
    {
	var callback = function(json) {
	    console.info("classic", json);

	    if (json.code) {
		console.info(json.value);
		return;
	    }
	    if (json.value.length == 0)
		return;
	    var template = _.template(classicString);

	    $('#classic_experiments_content')
		.html(template({"experiments" : json.value,
				"showCreator" : false,
				"showProject" : true,
				"asProfiles"  : false}));				
	    
	    // Format dates with moment before display.
	    $('#classic_experiments_content .format-date').each(function() {
		var date = $.trim($(this).html());
		if (date != "") {
		    $(this).html(moment($(this).html()).format("ll"));
		}
	    });
	    var table = $('#classic_experiments_content .tablesorter')
		.tablesorter({
		    theme : 'bootstrap',
		    widgets : [ "uitheme", ],
		    headerTemplate : '{content} {icon}',
		});
	};
	var xmlthing = sup.CallServerMethod(null,
				    "user-dashboard", "ClassicExperimentList",
				    {"uid" : window.TARGET_USER});
	xmlthing.done(callback);
    }

    function LoadProfileListTab()
    {
	var callback = function(json) {
	    console.info("LoadProfileListTab", json);

	    if (json.code) {
		console.info(json.value);
		return;
	    }
	    if (json.value.length == 0) {
		$('#profiles_noprofiles').removeClass("hidden");
		return;
	    }
	    var template = _.template(profileListString);

	    $('#profiles_content')
		.html(template({"profiles"    : json.value,
				"tablename"   : "user-profiles",
				"bulkdelete"  : true,
				"showCreator" : false,
				"showProject" : true,
				"showPrivacy" : true}));
	    
	    // Format dates with moment before display.
	    $('#user-profiles-table .format-date').each(function() {
		var date = $.trim($(this).html());
		if (date != "") {
		    $(this).html(moment($(this).html()).format("ll"));
		}
	    });
	    // Display the topo.
	    $('.showtopo_modal_button').click(function (event) {
		event.preventDefault();
		ShowTopology($(this).data("profile"));
	    });
	    // Delete profile button
	    $('#profiles_content .delete-profile-button')
		.click(function (event) {
		    event.preventDefault();
		    var row = $(this).closest("tr");
		    var profile_uuid = $(row).data("uuid");
		    
		    profileSupport
			.Delete(profile_uuid, function () {
			    $(row).remove();
			});
		});
	    
	    // If this is the active tab after loading, focus the searchbox
	    if ($('#profiles').hasClass("active")) {
		var searchbox = $('#profiles .profile-search')
		if ($(searchbox)[0]) {
		    $(searchbox)[0].focus();
		}
	    }
	    
	    var table = $('#' + 'user-profiles-table')
		.tablesorter({
		    theme : 'bootstrap',
		    widgets : [ "uitheme", "filter"],
		    headerTemplate : '{content} {icon}',
		    widgetOptions: {
			// include child row content while filtering, if true
			filter_childRows  : true,
			// include all columns in the search.
			filter_anyMatch   : true,
			// class name applied to filter row and each input
			filter_cssFilter  : 'form-control input-sm',
			// search from beginning
			filter_startsWith : false,
			// Set this option to false for case sensitive search
			filter_ignoreCase : true,
			// Only one search box.
			filter_columnFilters : false,
			// Search as typing
			filter_liveSearch : true,
		    },
		});
	    $.tablesorter.filter.bindSearch(table,
					    $('#' + 'user-profiles-search'));

	    // This activates the tooltip subsystem.
	    $('#profiles_content [data-toggle="tooltip"]').tooltip({
		delay: {"hide" : 100, "show" : 300},
		placement: 'auto',
	    });

	    // Delete multiple profiles via the checkbox column.
	    $('#profiles_content .delete-selected-profiles')
		.click(function (event) {
		    event.preventDefault();
		    profileSupport
			.DeleteSelected('#profiles_content',
					function (uuid, json) {
					    DeleteProfileRows(uuid, json);
					});
		});
	    
	}
	var xmlthing = sup.CallServerMethod(null,
					    "user-dashboard", "ProfileList",
					    {"uid" : window.TARGET_USER});
	xmlthing.done(callback);
    }

    function LoadProjectProfiles()
    {
	var callback = function(json) {
	    console.info("LoadProjectProfiles", json);

	    if (json.code) {
		console.info(json.value);
		return;
	    }
	    if (json.value.length == 0) {
		return;
	    }
	    var template = _.template(profileListString);

	    $('#projectprofiles_content')
		.html(template({"profiles"    : json.value,
				"tablename"   : "project-profiles",
				"bulkdelete"  : false,
				"showCreator" : true,
				"showProject" : true,
				"showPrivacy" : true}));
	    
	    // Format dates with moment before display.
	    $('#project-profiles-table .format-date').each(function() {
		var date = $.trim($(this).html());
		if (date != "") {
		    $(this).html(moment($(this).html()).format("ll"));
		}
	    });
	    // This activates the tooltip subsystem.
	    $('#projectprofiles_content [data-toggle="tooltip"]').tooltip({
		delay: {"hide" : 100, "show" : 300},
		placement: 'auto',
	    });
	    // Display the topo.
	    $('.showtopo_modal_button').click(function (event) {
		event.preventDefault();
		ShowTopology($(this).data("profile"));
	    });
	    // Delete profile button
	    $('#projectprofiles_content .delete-profile-button')
		.click(function (event) {
		    event.preventDefault();
		    var row = $(this).closest("tr");
		    var profile_uuid = $(row).data("uuid");
		    
		    profileSupport.Delete(profile_uuid, 
					  function (uuid, json) {
					      DeleteProfileRows(uuid, json);
					  });
		    
		});
	    // If this is the active tab after loading, focus the searchbox
	    if ($('#projectprofiles').hasClass("active")) {
		var searchbox = $('#projectprofiles .profile-search')
		if ($(searchbox)[0]) {
		    $(searchbox)[0].focus();
		}
	    }
	    
	    var table = $('#' + 'project-profiles-table')
		.tablesorter({
		    theme : 'bootstrap',
		    widgets : [ "uitheme", "filter"],
		    headerTemplate : '{content} {icon}',
		    widgetOptions: {
			// include child row content while filtering, if true
			filter_childRows  : true,
			// include all columns in the search.
			filter_anyMatch   : true,
			// class name applied to filter row and each input
			filter_cssFilter  : 'form-control input-sm',
			// search from beginning
			filter_startsWith : false,
			// Set this option to false for case sensitive search
			filter_ignoreCase : true,
			// Only one search box.
			filter_columnFilters : false,
			// Search as typing
			filter_liveSearch : true,
		    },
		});
	    $.tablesorter.filter.bindSearch(table,
					    $('#' + 'project-profiles-search'));

	    // Lets not show this on the project profiles tab yet.
	    if (0) {
		// Delete multiple profiles via the checkbox column.
		$('#projectprofiles_content .delete-selected-profiles')
		    .click(function (event) {
			event.preventDefault();
			profileSupport
			    .DeleteSelected('#projectprofiles_content',
					    function (uuid, json) {
						DeleteProfileRows(uuid, json);
					    });
		    });
	    }
	}
	var xmlthing = sup.CallServerMethod(null,
					    "user-dashboard",
					    "ProjectProfileList",
					    {"uid" : window.TARGET_USER});
	xmlthing.done(callback);
    }

    function LoadClassicProfiles()
    {
	var callback = function(json) {
	    console.info("classic profiles", json);

	    if (json.code) {
		console.info(json.value);
		return;
	    }
	    var template = _.template(classicString);

	    $('#classic_profiles_content')
		.html(template({"experiments" : json.value,
				"showCreator" : false,
				"showProject" : true,
				"asProfiles"  : true}));
	    
	    $('#classic_profiles_content .format-date').each(function() {
		var date = $.trim($(this).html());
		if (date != "") {
		    $(this).html(moment($(this).html()).format("ll"));
		}
	    });
	    var table = $('#classic_profiles_content .tablesorter')
		.tablesorter({
		    theme : 'bootstrap',
		    widgets : [ "uitheme"],
		    headerTemplate : '{content} {icon}',
		});
	};
	var xmlthing = sup.CallServerMethod(null,
					    "user-dashboard", "ClassicProfileList",
					    {"uid" : window.TARGET_USER});
	xmlthing.done(callback);
    }

    var showTopoIframe = null;

    function ShowTopology(profile)
    {
	var callback = function(json) {
	    console.info("ShowTopology profile", json);
	    if (json.code) {
		alert("Failed to get rspec for topology viewer: " + json.value);
		return;
	    }
	    if (showTopoIframe) {
		showTopoIframe(json.value.profile_rspec);
	    }
	    else {
		showTopoIframe = ShowTopoIframe($('#showtopology-modal'),
						'.showtopology-bare',
						json.value.profile_rspec);
	    }
	};
	sup.CallServerMethod(null, "show-profile", "GetProfile",
			     {"profile" : profile}, callback);
    }

    function LoadProjectsTab()
    {
	var callback = function(json) {
	    console.info(json);

	    if (json.code) {
		console.info(json.value);
		return;
	    }
	    if (json.value.length == 0) {
		return;
	    }
	    var template = _.template(projectString);

	    $('#membership_content')
		.html(template({"projects" : json.value}));

	    var table = $('#projects_table')
		.tablesorter({
		    theme : 'bootstrap',
		    widgets : [ "uitheme"],
		    headerTemplate : '{content} {icon}',
		});
	}
	var xmlthing = sup.CallServerMethod(null,
					    "user-dashboard", "ProjectList",
					    {"uid" : window.TARGET_USER});
	xmlthing.done(callback);
    }

    /*
     * We actually display two profile tabs, one for the non-admin view,
     * which is always the same. The other for the admin view. 
     */

    function LoadProfileTab()
    {
	var callback = function(json) {
	    console.info("LoadProfileTab", json.value);

	    if (json.code) {
		console.info(json.value);
		return;
	    }
	    if (json.value.length == 0) {
		return;
	    }
	    var template = _.template(profileString);

	    if (window.ISADMIN) {
		$('#admin_content')
		    .html(template({"fields"  : json.value,
				    "isadmin" : 1}));

		// Format dates with moment before display.
		$('#admin_content .format-date').each(function() {
		    var date = $.trim($(this).html());
		    if (date != "") {
			$(this).html(moment($(this).html()).format("lll"));
		    }
		});
		$('#admin_content .toggle').click(function() {
		    Toggle(this);
		});
		// Freeze or Thaw.
		if (json.value.status == "active" ||
		    json.value.status == "frozen") {
		    if (json.value.status == "active") {
			$('#admin_content .freeze').html("Freeze");
		    }
		    else {
			$('#admin_content .freeze').html("Thaw");
		    }
		    $('#admin_content .freezethaw').removeClass("hidden");
		    $('#admin_content .freeze').click(function (event) {
			FreezeOrThaw(json.value.status);
		    });
		}
	    }
	    $('#myprofile_content')
		.html(template({"fields"  : json.value,
				"isadmin" : 0}));
	    // Format dates with moment before display.
	    $('#myprofile_content .format-date').each(function() {
		var date = $.trim($(this).html());
		if (date != "") {
		    $(this).html(moment($(this).html()).format("ll"));
		}
	    });
	}
	var xmlthing = sup.CallServerMethod(null,
					    "user-dashboard", "AccountDetails",
					    {"uid" : window.TARGET_USER});
	xmlthing.done(callback);
    }

    function LoadDatasetTab()
    {
	var callback = function(json) {
	    console.info("datasets", json);

	    if (json.code) {
		console.info(json.value);
		return;
	    }
	    if (json.value.length == 0) {
		$('#datasets_nodatasets').removeClass("hidden");
		return;
	    }
	    var template = _.template(datasetString);

	    $('#datasets_content')
		.html(template({"datasets"    : json.value,
				"showcluster" : true,
				"showuser"    : false,
				"showproject" : true}));
	    
	    // Format dates with moment before display.
	    $('#datasets_content .tablesorter .format-date').each(function(){
		var date = $.trim($(this).html());
		if (date != "") {
		    $(this).html(moment($(this).html()).format("ll"));
		}
	    });
	    var table = $('#datasets_content .tablesorter')
		.tablesorter({
		    theme : 'bootstrap',
		    widgets : [ "uitheme"],
		    headerTemplate : '{content} {icon}',
		});
	}
	var xmlthing =
	    sup.CallServerMethod(null,
				 "user-dashboard", "DatasetList",
				 {"uid" : window.TARGET_USER});
	xmlthing.done(callback);
    }

    function LoadResgroupTab()
    {
	var callback = function(json) {
	    console.info("resgroup", json);

	    if (json.code) {
		console.info(json.value);
		return;
	    }
	    var userlist = json.value.user;
	    var projlist = json.value.project;
	    
	    if (! (_.size(userlist) || _.size(projlist))) {
		$('#resgroups_noresgroups').removeClass("hidden");
		return;
	    }
	    if (_.size(userlist)) {
		window.DrawResGroupList("#resgroups_content", userlist);
		$("#resgroups_content .expando").trigger("click");
	    }
	    else {
		$('#resgroups_noresgroups').removeClass("hidden");
	    }		
	    
	    /*
	     * Prune out project reservations in the table above,
	     * and if any left, show those in another table below.
	     */
	    for (var uuid in userlist) {
		if (_.has(projlist, uuid)) {
		    delete projlist[uuid];
		}
	    }
	    if (! _.size(projlist)) {
		return;
	    }
	    $("#project_resgroups").removeClass("hidden");
	    console.info("new projlist", projlist);
	    window.DrawResGroupList("#project_resgroups_content", projlist);
	}
	var xmlthing =
	    sup.CallServerMethod(null,
				 "user-dashboard", "ResgroupList",
				 {"uid" : window.TARGET_USER});
	xmlthing.done(callback);
    }

    /*
     * At the moment not making use of the resgroups we get, too confusing.
     */
    function LoadResourcesTab()
    {
	var EMULAB_NS = "http://www.protogeni.net/resources/rspec/ext/emulab/1";

	var callback = function(json) {
	    console.info("resources", json);

	    if (json.code) {
		console.info(json.value);
		return;
	    }
	    var resources = json.value.resources;
	    // resgroups for all projects user is a member of.
	    var resgroups = json.value.resgroups;
	    
	    if (! (_.size(resources))) {
		return;
	    }
	    var collated = {};
	    var user_totals = {};
	    
	    _.each(resources, function(details, uuid) {
		_.each(details.slivers, function(sliver, aggregate_urn) {
		    var resNodes = amlist[aggregate_urn].reservable_nodes;
		    var typelist = {};
		    var xml = $.parseXML(sliver.manifest);

		    $(xml).find("node, emulab\\:vhost").each(function() {
			// Only nodes that match the aggregate being processed,
			// since we send the same rspec to every aggregate.
			var manager_urn = $(this).attr("component_manager_id");
			if (!manager_urn.length ||
			    manager_urn != aggregate_urn) {
			    return;
			}
			var tag     = $(this).prop("tagName");
			var isvhost = (tag == "emulab:vhost" ? 1 : 0);
			var vnode   = this.getElementsByTagNameNS(EMULAB_NS,
								  'vnode');
			if (vnode.length) {
			    var hwtype = $(vnode).attr("hardware_type");
			    var name   = $(vnode).attr("name");

			    // Reservable nodes shown as themselves.
			    if (resNodes && _.has(resNodes, name)) {
				hwtype = name;
			    }
			    
			    if (hwtype != "pcvm" && hwtype != "blockstore") {
				if (!_.has(typelist, hwtype)) {
				    typelist[hwtype] = 0;
				}
				typelist[hwtype]++;

				if (!_.has(user_totals, aggregate_urn)) {
				    user_totals[aggregate_urn] = {};
				}
				var aggtotals = user_totals[aggregate_urn];
				if (!_.has(aggtotals, details.creator)) {
				    aggtotals[details.creator] = {};
				}
				var utotals = aggtotals[details.creator];
				if (!_.has(utotals, hwtype)) {
				    utotals[hwtype] = 0;
				}
				utotals[hwtype]++;
			    }
			}
		    });
		    if (_.size(typelist)) {
			if (!_.has(collated, uuid)) {
			    collated[uuid] = {};
			}
			collated[uuid][aggregate_urn] = {
			    "typelist"     : typelist,
			    "cluster"      : sliver.name,
			    "creator"      : details.creator,
			    "pid"          : details.pid,
			    "name"         : details.name,
			    "started"      : details.started,
			    "expires"      : details.expires,
			    "portal"       : details.portal,
			    "reslist_user" : {},
			    "reslist_proj" : {},
			};
		    }
		});
	    });
	    if (!_.size(collated)) {
		return;
	    }
	    console.info("collated", collated);
	    console.info("user_totals", user_totals);
	    
	    var template = _.template(templates["resources-list"]);
	    var html = template({
		"resources"       : collated,
		"user_totals"     : user_totals,
		"showCreator"     : false,
		"showProject"     : true,
		"showPortal"      : window.MAINSITE && window.ISADMIN,
		"showReserved"    : false,
		"showBlockstores" : false,
		"showVMs"         : false,
	    });
	    $('#resources_content').html(html);
	    
	    // Format dates with moment before display.
	    $('#resources_content .format-date').each(function(){
		var date = $.trim($(this).html());
		if (date != "") {
		    $(this).html(moment($(this).html()).format("ll"));
		}
	    });
	    var table = $('#resources_content .tablesorter')
		.tablesorter({
		    theme : 'bootstrap',
		    widgets : [ "uitheme", "zebra"],
		    headerTemplate : '{content} {icon}',
		    sortList: [[3,0]],
		});
	    $(".resources-hidden").removeClass("hidden");

	    // Do this after converting table.
	    $('#resources_content [data-toggle="tooltip"]').each(function () {
		$(this).tooltip({
		    trigger: 'hover',
		    placement: 'right',
		});
	    });

	    // Handler for the Help button
	    $('#resources-help-button').click(function (event) {
		event.preventDefault();
		sup.ShowModal('#resources-help-modal');
	    });
	}
	var xmlthing =
	    sup.CallServerMethod(null,
				 "user-dashboard", "ResourceList",
				 {"uid" : window.TARGET_USER});
	xmlthing.done(callback);
    }

    function LoadParameterSetsTab()
    {
	var paramsets_table;
	
	var callback = function(json) {
	    console.info("paramsets", json);

	    if (json.code) {
		console.info(json.value);
		return;
	    }
	    if (! json.value) {
		$('#paramsets_noparamsets').removeClass("hidden");
		return;
	    }
	    var template = _.template(templates["paramsets-list"]);

	    // Temporary until new geni-lib/ppwizard rolled out
	    $('.paramsets-hidden').removeClass("hidden");
	    
	    $('#paramsets_content')
		.html(template({"paramsets"   : json.value,
				"isadmin"     : window.ISADMIN}));

	    // Bind the delete button.
	    $('#paramsets_content #delete-paramset-button')
		.click(function (event) {
		    event.preventDefault();
		    var row = $(this).closest("tr");
		    var paramset_uuid = $(row).attr("data-uuid");

		    paramsets.InitDeleteParameterSet(window.TARGET_USER,
						     paramset_uuid,
			     function () {
				 $(row).remove();
				 paramsets_table.trigger('update');
			     });
		});

	    sup.addPopoverClip('#paramsets_content .paramset-share-button',
			       function (target) {
				   $(target).parent().popover('hide');
				   var url = $(target).attr("href");
				   return sup.popoverClipContent(url);
			       });
	    
	    
	    // Format dates with moment before display.
	    $('#paramsets_content table .format-date').each(function(){
		var date = $.trim($(this).html());
		if (date != "") {
		    $(this).html(moment($(this).html()).format("ll"));
		}
	    });
	    // This activates the tooltip subsystem.
	    $('#paramsets_content [data-toggle="tooltip"]').tooltip({
		delay: {"hide" : 100, "show" : 300},
		placement: 'auto',
	    });
	    // This activates the popover subsystem.
	    $('#paramsets_content [data-toggle="popover"]').popover({
		placement: 'auto',
	    });
	    
	    paramsets_table = $('#paramsets_content .tablesorter')
		.tablesorter({
		    theme : 'bootstrap',
		    widgets : [ "uitheme"],
		    headerTemplate : '{content} {icon}',
		});
	}
	var xmlthing =
	    sup.CallServerMethod(null,
				 "user-dashboard", "ListParameterSets",
				 {"uid" : window.TARGET_USER});
	xmlthing.done(callback);
    }

    function LoadClassicDatasets()
    {
	var callback = function(json) {
	    console.info("classic datasets", json);

	    if (json.code) {
		console.info(json.value);
		return;
	    }
	    if (json.value.length == 0) {
		return
	    }
	    $('#classic_datasets_content').removeClass("hidden");
	    var template = _.template(datasetString);

	    $('#classic_datasets_content_div')
		.html(template({"datasets"    : json.value,
				"showcluster" : false,
				"showuser"    : false,
				"showproject" : true}));
	    
	    $('#classic_datasets_content .format-date').each(function() {
		var date = $.trim($(this).html());
		if (date != "") {
		    $(this).html(moment($(this).html()).format("ll"));
		}
	    });
	    var table = $('#classic_datasets_content .tablesorter')
		.tablesorter({
		    theme : 'bootstrap',
		    widgets : [ "uitheme" ],
		    headerTemplate : '{content} {icon}',
		});
	};
	var xmlthing =
	    sup.CallServerMethod(null,
				 "user-dashboard", "ClassicDatasetList",
				 {"uid" : window.TARGET_USER});
	xmlthing.done(callback);
    }

    //
    // Toggle flags.
    //
    function Toggle(item) {
	var name = item.dataset["name"];
	var wait = false;

	// These take longer to show the wait modal.
	if (name == "admin" || name == "inactive") {
	    sup.ShowWaitWait();
	    wait = true;
	}
	var callback = function(json) {
	    if (json.code) {
		if (wait) {
		    sup.HideWaitWait(function () {
			sup.SpitOops("oops", json.value);
		    });
		}
		else {
		    sup.SpitOops("oops", json.value);
		}
		return;
	    }
	    if (wait) {
		sup.HideWaitWait();
	    }
	    LoadProfileTab();
	};
	sup.CallServerMethod(null, "user-dashboard", "Toggle",
			     {"uid" : window.TARGET_USER,
			      "toggle" : name},
			     callback);
    }

    //
    // Freeze or Thaw
    //
    function FreezeOrThaw(status) {
	var tag = (status == "active" ? "Freeze" : "Thaw");

	console.info("FreezeOrThaw: ", status, tag);
	
	// Handler for hide modal to unbind the click handler.
	$('#confirm-freezethaw-modal').on('hidden.bs.modal', function (event) {
	    $(this).unbind(event);
	    $('#confirm-freezethaw').unbind("click.freezethaw");
	});
	$('#confirm-freezethaw').bind("click.freezethaw", function (event) {
	    var callback = function(json) {
		sup.HideWaitWait();
	    
		if (json.code) {
		    sup.SpitOops("oops",
				 "Failed to " + tag + " user");
		    return;
		}
		LoadProfileTab();
	    };
	    var doit = function () {
		var args = {
		    "uid"   : window.TARGET_USER,
		    "which" : tag,
		};
		var message = $('#confirm-freezethaw-modal .user-message')
		    .val().trim();
		if (message != "") {
		    args["message"] = message;
		}
		sup.ShowWaitWait("This will take a minute. Patience please.");
		var xmlthing =
		    sup.CallServerMethod(null, "user-dashboard",
					 "FreezeOrThaw", args);
		xmlthing.done(callback);
	    };
	    sup.HideModal('#confirm-freezethaw-modal', doit);
	});
	$('#confirm-freezethaw-modal .which').html(tag);
	sup.ShowModal('#confirm-freezethaw-modal');
    }

    function SendTestMessage()
    {
	var callback = function(json) {
	    if (json.code) {
		alert("Test message could not be sent!");
		return;
	    }
	    alert("Test message has been sent");
	}
	var xmlthing = sup.CallServerMethod(null,
					    "user-dashboard", "SendTestMessage",
					    {"uid" : window.TARGET_USER});
	xmlthing.done(callback);
    }

    //
    // Send email message,
    //
    function SendMessage() {
	// Handler for hide modal to unbind the click handler.
	$('#sendemail-modal').on('hidden.bs.modal', function (event) {
	    $(this).unbind(event);
	    $('#confirm-sendemail').unbind("click.sendemail");
	});
	$('#confirm-sendemail').bind("click.sendemail", function (event) {
	    var callback = function(json) {
		console.info(json);
		if (json.code) {
		    sup.SpitOops("oops",
				 "Failed to send email to user: " + json.value);
		    return;
		}
	    };
	    sup.HideModal('#sendemail-modal');
	    var message = $('#sendemail-modal .user-message').val().trim();
		
	    var args = {
		"uid"     : window.TARGET_USER,
		"message" : message,
	    };
	    var xmlthing =
		sup.CallServerMethod(null, "user-dashboard",
				     "SendMessage", args);
	    xmlthing.done(callback);
	});
	sup.ShowModal('#sendemail-modal');
    }

    function SendPasswordReset()
    {
	var callback = function(json) {
	    console.info(json);
	    if (json.code) {
		alert("Password reset could not be sent!\n\n" + json.value);
		return;
	    }
	    alert("Password reset has has been sent");
	}
	var xmlthing = sup.CallServerMethod(null,
					    "user-dashboard",
					    "SendPasswordReset",
					    {"uid" : window.TARGET_USER});
	xmlthing.done(callback);
    }

    function DeleteUser()
    {
	var callback = function(json) {
	    if (json.code) {
		sup.HideWaitWait(function () {
		    sup.SpitOops("oops", json.value);
		});
		return;
	    }
	    window.location.replace("landing.php");
	}
	var xmlthing = sup.CallServerMethod(null,
					    "user-dashboard",
					    "DeleteUser",
					    {"uid" : window.TARGET_USER});
	
	sup.HideModal('#confirm-deleteuser-modal', function () {
	    sup.ShowWaitWait("This will take a minute. Patience please.");
	    xmlthing.done(callback);
	});
    }

    // Helper.
    function decodejson(id) {
	return JSON.parse(_.unescape($(id)[0].textContent));
    }
    $(document).ready(initialize);
});
