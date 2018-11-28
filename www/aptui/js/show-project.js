$(function ()
{
    'use strict';

    var templates = APT_OPTIONS.fetchTemplateList(['show-project', 'experiment-list', 'profile-list', 'member-list', 'dataset-list', 'project-profile', 'classic-explist', 'group-list', 'waitwait-modal', 'oops-modal','conversion-help-modal']);
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
    
    function initialize()
    {
	window.APT_OPTIONS.initialize(sup);
	
	// Generate the main template.
	var html = mainTemplate({
	    emulablink     : window.EMULAB_LINK,
	    isadmin        : window.ISADMIN,
	    target_project : window.TARGET_PROJECT,
	});
	$('#main-body').html(html);
	$('#waitwait_div').html(waitString);
	$('#oops_div').html(oopsString);
	$('#conversion_help_div').html(converterHelpTemplate({}));

        // Javascript to enable link to tab
        var hash = document.location.hash;
        if (hash) {
            $('.nav-tabs a[href='+hash+']').tab('show');
        }
        // Change hash for page-reload
        $('a[data-toggle="tab"]').on('show.bs.tab', function (e) {
            window.location.hash = e.target.hash;
        });
	// Set the correct tab when a user uses their back/forward button
        $(window).on('hashchange', function (e) {
	    var hash = window.location.hash;
	    if (hash == "") {
		hash = "#experiments";
	    }
	    $('.nav-tabs a[href='+hash+']').tab('show');
	});

	LoadUsage();
	LoadExperimentTab();
	LoadClassicExperiments();
	LoadProfileTab();
	LoadClassicProfiles();
	LoadMembersTab();
	LoadGroupsTab();
	LoadProjectTab();
	LoadDatasetTab();
	LoadClassicDatasets();
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

	    $('#experiments_content')
		.html(template({"experiments" : json.value,
				"showCreator" : true,
				"showProject" : false,
				"searchUUID"  : false}));
	    
	    // Format dates with moment before display.
	    $('#experiments_table .format-date').each(function() {
		var date = $.trim($(this).html());
		if (date != "") {
		    $(this).html(moment($(this).html()).format("ll"));
		}
	    });
	    var table = $('#experiments_table')
		.tablesorter({
		    theme : 'green',
		});
	}
	var xmlthing = sup.CallServerMethod(null,
					    "show-project", "ExperimentList",
					    {"pid" : window.TARGET_PROJECT});
	xmlthing.done(callback);
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
		    theme : 'green',
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
				"showCreator" : true,
				"showProject" : false}));
	    
	    // Format dates with moment before display.
	    $('#project-profiles-table .format-date').each(function() {
		var date = $.trim($(this).html());
		if (date != "") {
		    $(this).html(moment($(this).html()).format("ll"));
		}
	    });
	    // This activates the tooltip subsystem.
	    $('[data-toggle="tooltip"]').tooltip({
		delay: {"hide" : 500, "show" : 500},
		placement: 'auto',
	    });
	    // Display the topo.
	    $('.showtopo_modal_button').click(function (event) {
		event.preventDefault();
		ShowTopology($(this).data("profile"));
	    });
	    
	    var table = $('#' + 'project-profiles-table')
		.tablesorter({
		    theme : 'green',
		    widgets: ["filter"],
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
			// Search as typing
			filter_liveSearch : true,
		    },
		});
	    $.tablesorter.filter.bindSearch(table,
					    $('#' + 'project-profiles-search'));
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
		    theme : 'green',
		});
	};
	var xmlthing = sup.CallServerMethod(null,
					    "show-project", "ClassicProfileList",
					    {"pid" : window.TARGET_PROJECT});
	xmlthing.done(callback);
    }

    function ShowTopology(profile)
    {
	var index;

	var callback = function(json) {
	    if (json.code) {
		alert("Failed to get rspec for topology viewer: " + json.value);
		return;
	    }
	    sup.ShowModal("#quickvm_topomodal");
	    $("#quickvm_topomodal").one("shown.bs.modal", function () {
		sup.maketopmap('#showtopo_nopicker',
			       json.value.rspec, false, !window.ISADMIN);
	    });
	};
	var $xmlthing = sup.CallServerMethod(null,
					     "manage_profile",
					     "GetProfile",
				     	     {"uuid" : profile});
	$xmlthing.done(callback);
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
		    theme : 'green',
		});

	    // Do this after converting table.
	    $('[data-toggle="tooltip"]').tooltip({
		trigger: 'hover',
		placement: 'auto',
	    });
	    // Do this after converting table.
	    $('[data-toggle="popover"]').popover({
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
		    theme : 'green',
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
	    $('#project_content .toggle').click(function() {
		Toggle(this);
	    });
	    $('#project_content .request-license').click(function(event) {
		event.preventDefault();
		RequestLicense(this);
	    });
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
		    theme : 'green',
		});
	}
	var xmlthing =
	    sup.CallServerMethod(null,
				 "show-project", "DatasetList",
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
		    theme : 'green',
		});
	};
	var xmlthing =
	    sup.CallServerMethod(null,
				 "show-project", "ClassicDatasetList",
				 {"pid" : window.TARGET_PROJECT});
	xmlthing.done(callback);
    }
    //
    // Toggle flags.
    //
    function Toggle(item) {
	var name = item.dataset["name"];

	var callback = function(json) {
	    if (json.code) {
		sup.SpitOops("oops", json.value);
		return;
	    }
	    LoadProjectTab();
	};
	sup.CallServerMethod(null, "show-project", "Toggle",
			     {"pid" : window.TARGET_PROJECT,
			      "toggle" : name},
			     callback);
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

    $(document).ready(initialize);
});


