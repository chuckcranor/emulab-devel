$(function ()
{
    'use strict';

    var templates = APT_OPTIONS.fetchTemplateList(['show-project', 'experiment-list', 'profile-list', 'member-list', 'dataset-list', 'project-profile', 'classic-explist', 'group-list', 'waitwait-modal', 'oops-modal','conversion-help-modal', "rfrange-history", "showtopo-modal", "resources-list"]);
    var mainString = templates['show-project'];
    var experimentString = templates['experiment-list'];
    var profileString = templates['profile-list'];
    var memberString = templates['member-list'];
    var datasetString = templates['dataset-list'];
    var detailsString = templates['project-profile'];
    var classicString = templates['classic-explist'];
    var groupsString = templates['group-list'];
    var waitString = templates['waitwait-modal'];
    var oopsString = templates['oops-modal'];
    var converterHelpTemplate = _.template(templates['conversion-help-modal']);
    var mainTemplate    = _.template(mainString);
    var amlist = null;
    
    function initialize()
    {
	window.APT_OPTIONS.initialize(sup);

	amlist = decodejson("#amlist-json");
	console.info("amlist", amlist);
	
	// Generate the main template.
	var html = mainTemplate({
	    disabled       : window.PROJECT_DISABLED,
	    disabledset    : window.UI_DISABLE_DATASETS,
	    disabledres    : window.UI_DISABLE_RESERVATIONS,
	    emulablink     : window.EMULAB_LINK,
	    isadmin        : window.ISADMIN,
	    target_project : window.TARGET_PROJECT,
	    showmore       : (window.ISLEADER || window.ISMANAGER ||
			      window.ISADMIN ? 1 : 0),
	});
	$('#main-body').html(html);
	$('#waitwait_div').html(waitString);
	$('#oops_div').html(oopsString);
	$('#conversion_help_div').html(converterHelpTemplate({}));
	$('#showtopo-modal-div').html(templates["showtopo-modal"]);

	// Focus on the search box when switching to these tabs.
        $('.nav-tabs a[href="#profiles"]')
	    .on('shown.bs.tab', function (e) {
		var target = $(this).attr("href");
		var searchbox = $(target).find(".profile-search");
		if ($(searchbox)[0]) {
		    $(searchbox)[0].focus();
		}
	    });
	
	// Setup nav tab document hash handling.
	sup.hashSetup(".nav-tabs", "#experiments");

	// Setup NSF funding modal
	if (window.ISADMIN) {
	    SetupNSFModal();
	}

	LoadUsage();
	LoadExperimentTab();
	LoadClassicExperiments();
	LoadProfileTab();
	LoadClassicProfiles();
	LoadMembersTab();
	LoadGroupsTab();
	LoadProjectTab();
	LoadDatasetTab();
	LoadResgroupTab();
	LoadClassicDatasets();
	if (window.ISPOWDER) {
	    LoadRFRanges();
	}
	$('#confirm-deleteproject').click(function () {
	    DeleteProject();
	});
    }

    function LoadUsage()
    {
	var callback = function(json) {
	    console.info(json);

	    if (json.code) {
		console.info(json.value);
		return;
	    }
	    var blob = json.value;
	    var html = "";

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
		    blob.rank + " of " + blob.ranktotal + " active projects" +
		    "</td></tr>";
	    }
	    $('#usage_table tbody').html(html);
	}
	var xmlthing = sup.CallServerMethod(null,
					    "show-project", "UsageSummary",
					    {"pid" : window.TARGET_PROJECT});
	xmlthing.done(callback);
    }

    function LoadExperimentTab()
    {
	var callback = function(json) {
	    console.info(json);

	    if (json.code) {
		console.info(json.value);
		return;
	    }
	    if (json.value.length == 0) {
		$('#experiments_loading').addClass("hidden");
		$('#experiments_noexperiments').removeClass("hidden");
		return;
	    }
	    var template = _.template(experimentString);

	    // Project leaders and admins get a terminate button.
	    var showterm = (window.ISLEADER || window.ISADMIN ? true : false);

	    $('#experiments_content')
		.html(template({"experiments" : json.value,
				"showCreator" : true,
				"showProject" : false,
				"showPortal"  : false,
				"searchUUID"  : false,
				"showterminate" : showterm}));
	    
	    // Format dates with moment before display.
	    $('#experiments_table .format-date').each(function() {
		var date = $.trim($(this).html());
		if (date != "") {
		    $(this).html(moment($(this).html()).format("lll"));
		}
	    });
	    var table = $('#experiments_table')
		.tablesorter({
		    theme : 'bootstrap',
		    widgets : [ "uitheme", "zebra"],
		    headerTemplate : '{content} {icon}',
		});

	    // Terminate an experiment.
	    $('#experiments_content .terminate-button').click(function (event) {
		event.preventDefault();
		TerminateExperiment(this);
	    });
	    
	}
	var xmlthing = sup.CallServerMethod(null,
					    "show-project", "ExperimentList",
					    {"pid" : window.TARGET_PROJECT});
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
				"showCreator" : true,
				"showProject" : false,
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
		    widgets : [ "uitheme", "zebra"],
		    headerTemplate : '{content} {icon}',
		});
	};
	var xmlthing = sup.CallServerMethod(null,
					    "show-project", "ClassicExperimentList",
					    {"pid" : window.TARGET_PROJECT});
	xmlthing.done(callback);
    }

    function LoadProfileTab()
    {
	var callback = function(json) {
	    console.info(json);

	    if (json.code) {
		console.info(json.value);
		return;
	    }
	    if (json.value.length == 0) {
		$('#profiles_noprofiles').removeClass("hidden");
		return;
	    }
	    var template = _.template(profileString);

	    $('#profiles_content')
		.html(template({"profiles"    : json.value,
				"tablename"   : "project-profiles",
				"bulkdelete"  : (window.ISLEADER ||
						 window.ISMANAGER ||
						 window.ISADMIN ? 1 : 0),
				"showCreator" : true,
				"showProject" : false,
				"showPrivacy" : true}));
	    
	    // Format dates with moment before display.
	    $('#project-profiles-table .format-date').each(function() {
		var date = $.trim($(this).html());
		if (date != "") {
		    $(this).html(moment($(this).html()).format("ll"));
		}
	    });
	    // This activates the tooltip subsystem.
	    $('#profiles_content [data-toggle="tooltip"]').tooltip({
		delay: {"hide" : 500, "show" : 500},
		placement: 'auto',
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
			.Delete(profile_uuid, function (uuid, json) {
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
	    
	    var table = $('#' + 'project-profiles-table')
		.tablesorter({
		    theme : 'bootstrap',
		    widgets : [ "uitheme", "zebra", "filter"],
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

	    if (window.ISLEADER || window.ISMANAGER || window.ISADMIN) {
		// Delete multiple profiles via the checkbox column.
		$('#profiles_content .delete-selected-profiles')
		    .click(function (event) {
			event.preventDefault();
			console.info("clicked");
			profileSupport
			    .DeleteSelected('#profiles_content',
					  function (uuid, json) {
					      $('#profiles_content ' +
						'tr[data-uuid="' + uuid + '"]')
						  .remove();
					  });
		    });
	    }
	}
	var xmlthing = sup.CallServerMethod(null,
					    "show-project", "ProfileList",
					    {"pid" : window.TARGET_PROJECT});
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
				"showCreator" : true,
				"showProject" : false,
				"asProfiles"  : true}));
	    
	    // Format dates with moment before display.
	    $('#classic_profiles_content .format-date').each(function() {
		var date = $.trim($(this).html());
		if (date != "") {
		    $(this).html(moment($(this).html()).format("ll"));
		}
	    });
	    var table = $('#classic_profiles_content .tablesorter')
		.tablesorter({
		    theme : 'bootstrap',
		    widgets : [ "uitheme", "zebra"],
		    headerTemplate : '{content} {icon}',
		});
	};
	var xmlthing = sup.CallServerMethod(null,
					    "show-project", "ClassicProfileList",
					    {"pid" : window.TARGET_PROJECT});
	xmlthing.done(callback);
    }

    // Warn only once for page load.
    var WarnedAboutUserPrivs = false;

    function LoadMembersTab()
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
	    var template = _.template(memberString);

	    $('#members_content')
		.html(template({"members"    : json.value,
				"nonmembers" : {},
				"pid"        : window.TARGET_PROJECT,
				"gid"        : window.TARGET_PROJECT,
				"canedit"    : window.CANAPPROVE,
				"canapprove" : window.CANAPPROVE,
				"canbestow"  : window.CANBESTOW}));
	    
	    // Format dates with moment before display.
	    $('#members_table .format-date').each(function() {
		var date = $.trim($(this).html());
		if (date != "") {
		    $(this).html(moment($(this).html()).format("ll"));
		}
	    });
	    // Bind edit privs selection
	    $('#members_table .editprivs')
		.on('focusin', function() {
		    // Remember trust before change.
		    $(this).data('val', $(this).val());
		})
		.change(function () {
		    if ($(this).val() == "user" && !WarnedAboutUserPrivs) {
			sup.ShowModal('#confirm-user-privs-modal');
			WarnedAboutUserPrivs = true;
			var which = $(this);
			$('#cancel-user-privs').click(function () {
			    // Restore old trust we saved above.
			    $(which).val($(which).data('val'));
			});
			$('#confirm-user-privs').click(function () {
			    DoEditPrivs($(which).data("uid"), $(which).val());
			});
			return;
		    }
		    DoEditPrivs($(this).data("uid"), $(this).val());
		});
	    
	    var table = $('#members_table')
		.tablesorter({
		    theme : 'bootstrap',
		    widgets : [ "uitheme", "zebra"],
		    headerTemplate : '{content} {icon}',
		});

	    // Do this after converting table.
	    $('#members_table [data-toggle="tooltip"]').tooltip({
		trigger: 'hover',
		placement: 'auto',
	    });
	    // Do this after converting table.
	    $('#members_table [data-toggle="popover"]').popover({
		trigger: 'hover',
		placement: 'auto',
	    });
	    
	    // Enable the remove button when users are selected.
	    $('#members_table .remove-checkbox').change(function () {
		$('#remove-users-button').removeAttr("disabled");
	    });
	    // Handler for the remove button.
	    $('#confirm-remove-users').click(function () {
		sup.HideModal('#confirm-remove-users-modal');
		DoRemoveUsers();
	    });
	    
	}
	var xmlthing = sup.CallServerMethod(null,
					    "show-project", "MemberList",
					    {"pid" : window.TARGET_PROJECT});
	xmlthing.done(callback);
    }

    // Edit privs
    function DoEditPrivs(uid, priv)
    {
	console.info(uid, priv);

	var callback = function(json) {
	    sup.HideWaitWait();

	    // Always reload.
	    LoadMembersTab();
	    
	    if (json.code) {
		sup.SpitOops("oops", json.value);
		return;
	    }
	}
	sup.ShowWaitWait("We are modifying privs ... patience please");
	var xmlthing =
	    sup.CallServerMethod(null, "groups", "EditPrivs",
				 {"user_uid" : uid,
				  "priv"     : priv,
                                  "pid"      : window.TARGET_PROJECT,
                                  "gid"      : window.TARGET_PROJECT});
	xmlthing.done(callback);
    }

    // Remove users.
    function DoRemoveUsers()
    {
	// Find list of selected users.
	var selected_users = {};

	$('.remove-checkbox').each(function () {
	    if ($(this).is(":checked")) {
		var uid = $(this).data("uid");
		
		selected_users[uid] = uid;
	    }
	});
	if (! Object.keys(selected_users).length) {
	    return;
	}
	var callback = function(json) {
	    sup.HideWaitWait();

	    // Always reload.
	    LoadMembersTab();

	    if (json.code) {
		sup.SpitOops("oops", json.value);
		return;
	    }
	}
	sup.ShowWaitWait("We are removing users from this project ... " +
			 "patience please");
	var xmlthing =
	    sup.CallServerMethod(null, "groups", "EditMembership",
				 {"users"  : selected_users,
				  "action" : "remove",
                                  "pid"    : window.TARGET_PROJECT,
                                  "gid"    : window.TARGET_PROJECT});

	xmlthing.done(callback);
    }

    function LoadGroupsTab()
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
	    var template = _.template(groupsString);

	    $('#groups_content')
		.html(template({"groups"  : json.value,
				"pid"     : window.TARGET_PROJECT}));
	    
	    var table = $('#groups_table')
		.tablesorter({
		    theme : 'bootstrap',
		    widgets : [ "uitheme", "zebra"],
		    headerTemplate : '{content} {icon}',
		});
	}
	var xmlthing = sup.CallServerMethod(null,
					    "show-project", "GroupList",
					    {"pid" : window.TARGET_PROJECT});
	xmlthing.done(callback);
    }

    function LoadProjectTab()
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
	    var template = _.template(detailsString);

	    $('#project_content')
		.html(template({"fields"   : json.value,
				"isleader" : window.ISLEADER,
				"isadmin"  : window.ISADMIN}));
	    
	    // Format dates with moment before display.
	    $('#project_table .format-date').each(function() {
		var date = $.trim($(this).html());
		if (date != "") {
		    $(this).html(moment($(this).html()).format("ll"));
		}
	    });
	    $('#project_table [data-toggle="popover"]').popover({
		trigger: 'hover',
		placement: 'auto',
	    });
	    $('#project_table [data-toggle="tooltip"]').popover({
		trigger: 'hover',
		placement: 'auto',
	    });
	    $('#project_content .toggle').click(function() {
		Toggle(this);
	    });
	    $('#project_content .request-license').click(function(event) {
		event.preventDefault();
		RequestLicense(this);
	    });
	    // Powder OTA agreement.
	    if (window.ISPOWDER) {
		$('#send-ota-agreement').click(function (event) {
		    event.preventDefault();
		    console.info("SendotaAgreement clicked");
		    sup.CallServerMethod(null,
					 "show-project", "SendotaAgreement",
					 {"pid" : window.TARGET_PROJECT},
					 function (json) {
					     console.info(json);
					     if (json.code) {
						 sup.SpitOops("oops",
							      json.value);
					     }
					 });
		});
	    }
	}
	var xmlthing = sup.CallServerMethod(null,
					    "show-project", "ProjectProfile",
					    {"pid" : window.TARGET_PROJECT});
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
	    var template = _.template(datasetString);

	    $('#datasets_content')
		.html(template({"datasets"    : json.value,
				"showcluster" : true,
				"showuser"    : true,
				"showproject" : false}));
	    
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
		    widgets : [ "uitheme", "zebra"],
		    headerTemplate : '{content} {icon}',
		});
	}
	var xmlthing =
	    sup.CallServerMethod(null,
				 "show-project", "DatasetList",
				 {"pid" : window.TARGET_PROJECT});
	xmlthing.done(callback);
    }

    function LoadResgroupTab()
    {
	var callback = function(json) {
	    console.info("resgroups", json);

	    if (json.code) {
		console.info(json.value);
		LoadResources(null);
		return;
	    }
	    LoadResources(json.value);

	    if (!_.size(json.value)) {
		return;
	    }
	    
	    $(".resgroups-hidden").removeClass("hidden");
	    window.DrawResGroupList("#resgroups_content", json.value);
	    $("#resgroups_content .expando").trigger("click");
	}
	var xmlthing =
	    sup.CallServerMethod(null,
				 "show-project", "ResgroupList",
				 {"pid" : window.TARGET_PROJECT});
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
				"showuser"    : true,
				"showproject" : false}));
	    
	    $('#classic_datasets_content .format-date').each(function() {
		var date = $.trim($(this).html());
		if (date != "") {
		    $(this).html(moment($(this).html()).format("ll"));
		}
	    });
	    var table = $('#classic_datasets_content .tablesorter')
		.tablesorter({
		    theme : 'bootstrap',
		    widgets : [ "uitheme", "zebra"],
		    headerTemplate : '{content} {icon}',
		});
	};
	var xmlthing =
	    sup.CallServerMethod(null,
				 "show-project", "ClassicDatasetList",
				 {"pid" : window.TARGET_PROJECT});
	xmlthing.done(callback);
    }

    function LoadRFRanges()
    {
	var ProjectRanges = function(json) {
	    if (json.code) {
		console.info(json.value);
		return;
	    }
	    if (!_.size(json.value)) {
		return;
	    }
	    var html = "";

	    _.each(json.value, function(range) {
		html = html + "<tr>";

		if (window.ISADMIN) {
		    var id = range.range_id ? range.range_id : range.idx;
		    html = html +
			" <td> " + id + "</td>";
		}
		html = html +
		    " <td> " + range.freq_low + "</td>" +
		    " <td> " + range.freq_high + "</td>" +
		    " <td> " + (range.global ? "Yes" : "No") + "</td>" +
		    "</tr>";
	    });
	    $('#rfranges_content .allowed-rfranges ' +
	      '.tablesorter tbody').html(html)
	    $('.rfranges-hidden').removeClass("hidden");
	    
	    var table = $('#rfranges_content .allowed-rfranges .tablesorter')
		.tablesorter({
		    theme : 'bootstrap',
		    widgets : [ "uitheme", "zebra"],
		    headerTemplate : '{content} {icon}',
		});
	};
	var InuseRanges = function(json) {
	    if (json.code) {
		console.info(json.value);
		return;
	    }
	    if (!_.size(json.value)) {
		return;
	    }
	    var html = "";
	    _.each(json.value, function(info) {
		var url = "status.php?uuid=" + info.uuid;
		
		html = html + "<tr>" +
		    "<td><a href='" + url + "'>" + info.name + "</a></td>" +
		    "<td>" + info.freq_low + "</td>" +
		    "<td>" + info.freq_high + "</td>" +
		    "<td>" + info.type + "</td>" +
		    "<td>" + info.target + "</td>" +
		    "<td>" + moment(info.expires).format("MMM Do, h:m A") +
		    "</td>" +
		    "</tr>";
	    });
	    $('#rfranges_content .inuse-rfranges ' +
	      '.tablesorter tbody').html(html)
	    $('#rfranges_content .inuse-rfranges').removeClass("hidden");
	    
	    $('#rfranges_content .inuse-rfranges .tablesorter')
		.tablesorter({
		    theme : 'bootstrap',
		    widgets : [ "uitheme", "zebra"],
		    headerTemplate : '{content} {icon}',
		});
	};
	var xmlthing1 =
	    sup.CallServerMethod(null, "rfrange", "ProjectRanges",
				 {"pid" : window.TARGET_PROJECT});
	var xmlthing2 =
	    sup.CallServerMethod(null, "rfrange", "ProjectInuseRanges",
				 {"pid" : window.TARGET_PROJECT});

	$.when(xmlthing1, xmlthing2)
	    .done(function(result1, result2) {
		console.info("LoadRFRanges", result1, result2);
		ProjectRanges(result1);
		InuseRanges(result2);
	    });

	LoadRangeHistory();
    }

    function LoadResources(resgroups)
    {
	var EMULAB_NS = "http://www.protogeni.net/resources/rspec/ext/emulab/1";
	
	var callback = function(json) {
	    console.info("resources", json);

	    if (json.code) {
		console.info(json.value);
		return;
	    }
	    if (!_.size(json.value)) {
		return;
	    }
	    var collated = {};
	    var user_totals = {};
	    
	    _.each(json.value, function(details, uuid) {
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
	    /*
	     * Find active reservations for types by the same user. 
	     */
	    _.each(collated, function(aggregates, uuid) {
		_.each(aggregates, function(details, aggregate_urn) {
		    var reslist_user = {};
		    var reslist_proj = {};
		    
		    _.each(details.typelist, function(count, type) {
			_.each(resgroups, function (group, group_uuid) {
			    _.each(group.clusters, function (res) {
				if (aggregate_urn == res.cluster_urn &&
				    res.active && res.type == type) {
				    /*
				     * Active reservation for this type
				     * at the same aggregate.
				     *
				     * If the project/res is per-user, do not
				     * increment this since there are no project
				     * reservations for this project.
				     */
				    if (group.shared_reservations == "project") {
					if (!_.has(reslist_proj, type)) {
					    reslist_proj[type] = 0;
					}
					reslist_proj[type] += res.count;
				    }
				    if (group.uid == details.creator) {
					// And by the same user
					if (!_.has(reslist_user, type)) {
					    reslist_user[type] = 0;
					}
					reslist_user[type] += res.count;
				    }
				    
				}
			    });
			});
		    });
		    if (_.size(reslist_user)) {
			details.reslist_user = reslist_user;
		    }
		    if (_.size(reslist_proj)) {
		    	details.reslist_proj = reslist_proj;
		    }
		});
	    });
	    console.info("collated", collated);
	    console.info("user_totals", user_totals);
	    
	    var template = _.template(templates["resources-list"]);
	    var html = template({
		"resources"       : collated,
		"user_totals"     : user_totals,
		"showCreator"     : true,
		"showProject"     : false,
		"showPortal"      : window.MAINSITE && window.ISADMIN,
		"showReserved"    : true,
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
				 "show-project", "ResourceList",
				 {"pid" : window.TARGET_PROJECT});
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
    
    //
    // Toggle flags.
    //
    function Toggle(item) {
	var name = item.dataset["name"];
	var wait = false;

	// This one needs special handling.
	if (name == "project_shared_reservations") {
	    wait = true;
	}
	var callback = function(json) {
	    console.info("Toggle callback:", json);
	    if (json.code) {
		if (wait) {
		    sup.HideWaitWait(function () {
			if (name == "project_shared_reservations") {
			    // This is all a bit cheesy.
			    ShowSharedResErrors(json.value);
			}
			else {
			    sup.SpitOops("oops", json.value);
			}
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
	    LoadProjectTab();
	};
	var dotoggle = function() {
	    sup.CallServerMethod(null, "show-project", "Toggle",
				 {"pid" : window.TARGET_PROJECT,
				  "toggle" : name},
				 callback);
	};
	if (wait) {
	    sup.ShowWaitWait(undefined, undefined, dotoggle);
	}
	else {
	    dotoggle();
	}
    }

    function ShowSharedResErrors(errors) {
	console.info("ShowSharedResErrors:", errors);
	
	var html = "";
	_.each(errors, function (details, name) {
	    html +=
		"<dt class='col-sm-2'>" + name + "</dt>" +
		"<dd class='col-sm-10'>";
	    _.each(details, function(detail) {
		html +=
		    "<p class='mb-0'>" + detail.message + "</p>";
	    });
	    html += "</dd>";
	});
	console.info(html);
	$('#setshared-errors-modal .modal-body dl').html(html);
	sup.ShowModal('#setshared-errors-modal');
    }

    /*
     * Request a license.
     */
    function RequestLicense(target) {
	var license_idx = $(target).data("license_idx");
	
	var callback = function(json) {
	    if (json.code) {
		sup.SpitOops("oops", json.value);
		return;
	    }
	    // If this is the leader of the project, zap them to
	    // the license page. If an admin doing this, stay here.
	    if (window.ISLEADER) {
		window.location.replace("licenses.php");
		return;
	    }
	    $(target).closest('td').html("Acceptance pending");
	};
	sup.CallServerMethod(null, "licenses", "Request",
			     {"pid" : window.TARGET_PROJECT,
			      "idx" : license_idx},
			     callback);
    }

    function DeleteProject()
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
					    "show-project",
					    "DeleteProject",
					    {"pid" : window.TARGET_PROJECT});
	
	sup.HideModal('#confirm-deleteproject-modal', function () {
	    sup.ShowWaitWait("This will take a minute. Patience please.");
	    xmlthing.done(callback);
	});
    }

    function SetupNSFModal()
    {
	var error = function (message) {
	    var group = $('#nsf-funding-modal input[name=nsf_award]').parent();
	    if (!message) {
		group.removeClass("has-error");
		group.find("label").addClass("hidden");
		return;
	    }
	    group.addClass("has-error");
	    group.find("label").html(message);
	    group.find("label").removeClass("hidden");
	};
	var callback = function(json) {
	    if (json.code) {
		console.info("Server says: " + json.value);
		if (json.code == 2) {
		    error(json.value);
		}
		return;
	    }
	    LoadProjectTab();
	    sup.HideModal('#nsf-funding-modal');
	}
	$('#nsf-funding-modal .save-button').click(function (e) {
	    var supplement = $('#nsf-funding-modal ' +
			       'input[name=nsf_supplement]').is(":checked");
	    var award = $('#nsf-funding-modal input[name=nsf_award]').val();
	    console.info(award, supplement);

	    // Lets at least make sure it is not blank. 
	    award = $.trim(award);
	    if (award == "") {
		error("Please tell us the award number");
		return;
	    }
	    sup.CallServerMethod(null, "show-project", "NSF",
				 {"pid"    : window.TARGET_PROJECT,
				  "supplement" : supplement ? 1 : 0,
				  "award" : award}, callback);
	});
    }

    function LoadRangeHistory()
    {
	var callback = function (json) {
	    console.info("range history", json);
	    if (json.code) {
		console.info("Not enough permission for range history");
		return;
	    }
	    if (json.value.length == 0) {
		return;
	    }
	    var template = _.template(templates['rfrange-history']);
	    $('#rfranges .history-rfranges .waiting')
		.html(template({"ranges" : json.value}));
	    $('.rfranges-hidden').removeClass("hidden");
	    $('#rfranges .history-rfranges').removeClass("hidden");

	    // Default dates for the date pickers.
	    var first = _.first(json.value);
	    var last  = _.last(json.value);

	    var start_from = moment(last.started).format("L");
	    var start_to   = moment(first.started).format("L");
	    var end_from   = moment(last.destroyed).format("L");
	    var end_to     = moment(first.destroyed).format("L");
	    
	    $('#rfranges .history-rfranges .tablesorter')
		.tablesorter({
		    theme : 'bootstrap',
		    widgets: ["uitheme", "zebra", "filter"],
		    headerTemplate : '{content} {icon}',
		    widthFixed : true,
		    
		    widgetOptions: {
			// class name applied to filter row and each input
			//filter_cssFilter  : 'form-control input-sm',
			// search from beginning
			filter_startsWith : false,
			// Set this option to false for case sensitive search
			filter_ignoreCase : true,
			// Only one search box.
			filter_columnFilters : true,

			filter_formatter : {
			    // Date (two inputs)
			    6 : function($cell, indx) {
				return $.tablesorter.filterFormatter
				    .uiDatepicker( $cell, indx, {
					textFrom : "",
					textTo : "-",
					from : start_from,
					to   : start_to,
					changeMonth : true,
					changeYear : true
				    });
			    },
			    // Date (two inputs)
			    7 : function($cell, indx) {
				return $.tablesorter.filterFormatter
				    .uiDatepicker( $cell, indx, {
					textFrom : "",
					textTo : "-",
					from : end_from,
					to   : end_to,
					changeMonth : true,
					changeYear : true
				    });
			    },
			},
			filter_placeholder : {
			    from : 'From...',
			    to   : 'To...'
			},
		    }
		});
	};
	sup.CallServerMethod(null, "rfrange", "RangeHistory",
			     {"pid" : window.TARGET_PROJECT}, callback);
    }

    // Helper.
    function decodejson(id) {
	return JSON.parse(_.unescape($(id)[0].textContent));
    }
    $(document).ready(initialize);
});


