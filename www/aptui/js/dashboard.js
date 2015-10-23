require(window.APT_OPTIONS.configObject,
	['underscore', 'js/quickvm_sup', 'moment',
	 'js/lib/text!template/dashboard.html',
	 'js/lib/text!template/dashboard-activity.html',
	 'js/lib/text!template/dashboard-recent.html',
	 'js/lib/text!template/dashboard-heavy-users.html',
	 'js/lib/text!template/dashboard-heavy-projects.html',
	 'js/lib/text!template/dashboard-profiles.html',
	 'js/lib/text!template/dashboard-errors.html',
	 ],
function (_, sup, moment, dashboardString,
    dashboardActivityString,
    dashboardRecentString,
    dashboardHeavyUsersString,
    dashboardHeavyProjectsString,
    dashboardProfilesString,
    dashboardErrorsString)
{
    'use strict';
    var isadmin           = 0;

    var dashboardActivity = _.template(dashboardActivityString);
    var dashboardRecent = _.template(dashboardRecentString);
    var dashboardHeavyUsers = _.template(dashboardHeavyUsersString);
    var dashboardHeavyProjects = _.template(dashboardHeavyProjectsString);
    var dashboardProfiles = _.template(dashboardProfilesString);
    var dashboardErrors = _.template(dashboardErrorsString);
    var dashboardTemplate = _.template(dashboardString);

    function initialize()
    {
	window.APT_OPTIONS.initialize(sup);
	isadmin = window.ISADMIN;

	DashboardLoop();
	setInterval(DashboardLoop,30000);
	setInterval(UpdateTimes,1000);
    }

    function DashboardLoop()
    {
	var callback = function(json) {
	    console.log(json);
	    
	    var dashboard_html = dashboardTemplate({"dashboard": json.value,
						    "isadmin": isadmin,
                                                    "dashboardActivity" : dashboardActivity,
                                                    "dashboardRecent" : dashboardRecent,
                                                    "dashboardHeavyUsers" : dashboardHeavyUsers,
                                                    "dashboardHeavyProjects" : dashboardHeavyProjects,
                                                    "dashboardProfiles" : dashboardProfiles,
                                                    "dashboardErrors" : dashboardErrors,
                                                    });
	    $('#page-body').html(dashboard_html);
	    $('#last-refresh').data("time",new Date());
	    
	    // Format dates with moment before display.
	    $('.format-date').each(function() {
		var date = $.trim($(this).html());
		if (date != "") {
		    $(this).html(moment($(this).html())
				 .format("ddd h:mm A"));
		}
	    });
	    $('[data-toggle="popover"]').popover({
		trigger: 'hover',
		placement: 'auto',
		html: true,
		content: function () {
		    var uuid = $(this).data("uuid");
		    var html = "<code style='white-space: pre-wrap'>" +
			json.value.error_details[uuid].message + "</code>";
		    return html;
		}
	    });
	    UpdateTimes();
	}
	var xmlthing = sup.CallServerMethod(null, "dashboard",
					    "GetStats", null);
	xmlthing.done(callback);
    }

    function UpdateTimes()
    {
        $('.format-date-relative').each(function() {
            var date = $(this).data("time");
            if (date != "") {
                $(this).html(moment(date).fromNow());
            }
        });

    }

    $(document).ready(initialize);
});
