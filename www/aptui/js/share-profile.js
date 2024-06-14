//
// Share?Write profile helper.
//
$(function () {
window.ShareProfile = (function ()
{
    'use strict';
    var templates = APT_OPTIONS.fetchTemplateList(['share-profile-modal',
                                                   'share-profile-body']);
    var bodyTemplate = _.template(templates['share-profile-body']);
    var shareButton  = '.profile-share-button';
    var writeButton  = '#profile-project-write-button';

    function InitShareProfile()
    {
        console.info("InitShareProfile");
        $('#share-profile-modal-div').html(templates['share-profile-modal']);
        InitShareModal();
	$(shareButton).click(function (event) {
	    event.preventDefault();
	    sup.ShowModal('#share-profile-modal');
	});
	if (window.ISADMIN || window.ISCREATOR || window.ISLEADER) {
	    $(writeButton).click(function (event) {
	        event.preventDefault();
	        sup.ShowModal('#profile-project-write-modal');
	    });
            // Watch for changes to project writable
            $('#profile-project-write-modal input').change(function (event) {
                event.preventDefault();
                setWritable($(this).is(":checked"));
            });
        }
    }

    function InitShareModal()
    {
        GetSharingInfo(function (info) {
	    $('#share-profile-modal .modal-body').html(bodyTemplate({
                "ispublic" : info.public,
                "url"      : info.url,
                "canedit"  : info.canedit,
                "projects" : info.projects,
            }));
	    // Bind the copy to clipboard button in the share modal
	    window.APT_OPTIONS.SetupCopyToClipboard("#share-profile-modal");

            // Update project writable flag in the project writable modal.
            $('#profile-project-write-modal input')
                .prop("checked", (info.writable ? true : false));

            // Watch for changes to access type.
            $('#share-profile-modal .select-access-type').change(function (event) {
                var access   = $(this).find("option:selected").val();
                var ispublic = access == "public" ? 1 : 0;
                if (ispublic != info.public) {
                    setPublic(ispublic);
                }
            });
            if (info.canedit) {
                $('#share-profile-modal .add-sharing-project button').click(function (event) {
                    $('#share-profile-modal .add-sharing-profile input')
                        .removeClass("is-invalid");
                    
                    var pid = $.trim($('#share-profile-modal .add-sharing-project input').val());
                    console.info(pid);
                    if (pid == "") {
                        return;
                    }
                    addProject(pid, function (json) {
                        if (json.code) {
                            $('#share-profile-modal .add-sharing-project .invalid-feedback')
                                .html(json.value);
                            $('#share-profile-modal .add-sharing-project input')
                                .addClass("is-invalid");
                            return;
                        }
                        InitShareModal();
                    });
                });
                $('#share-profile-modal .remove-sharing-project button').click(function (event) {
                    var parent = $(this).parent();
                    var pid     = $(parent).find("input").data("pid")
                    console.info(pid);
                    removeProject(pid, function (json) {
                        if (json.code) {
                            $(parent).find('.invalid-feedback')
                                .html(json.value);
                            $(parent).find('input')
                                .addClass("is-invalid");
                            return;
                        }
                        InitShareModal();
                    });
                });
            }
        });
    }

    function GetSharingInfo(callback)
    {
	sup.CallServerMethod(null, "manage_profile", "GetSharingInfo",
			     {"uuid"     : window.PROFILE_UUID},
                             function (json) {
                                 console.info("GetSharingInfo", json);
				 if (json.code) {
				     alert(json.value);
				     return;
				 }
                                 callback(json.value);
                             });
    }

    function setPublic(ispublic)
    {
	sup.CallServerMethod(null, "manage_profile", "ModifySharing",
			     {"uuid"     : window.PROFILE_UUID,
                              "public"   : ispublic},
                             function (json) {
                                 console.info("setPublic", json);
				 if (json.code) {
				     alert(json.value);
				     return;
				 }
                                 InitShareModal();
                                 /*
                                  * Update the summary box
                                  */
                                 $('#profile-public').html(ispublic ? "Yes" : "No");
                             });
    }

    function setWritable(writable)
    {
	sup.CallServerMethod(null, "manage_profile", "ModifySharing",
			     {"uuid"     : window.PROFILE_UUID,
                              "writable" : writable ? 1 : 0},
                             function (json) {
                                 console.info("setWritable", json);
				 if (json.code) {
				     alert(json.value);
                                     $('#profile-project-write-modal input')
                                         .prop("checked", (writable ? false : true));
				     return;
				 }
                                 /*
                                  * Update the summary box
                                  */
                                 $('#profile-project-write')
                                     .html(writable ? "Project Members" : "Profile Creator");
                             });
    }

    function addProject(pid, callback)
    {
	sup.CallServerMethod(null, "manage_profile", "ModifySharing",
			     {"uuid"       : window.PROFILE_UUID,
                              "addproject" : pid},
                             function (json) {
                                 console.info("addproject", json);
                                 callback(json);
                             });
        
    }
    function removeProject(pid, callback)
    {
	sup.CallServerMethod(null, "manage_profile", "ModifySharing",
			     {"uuid"       : window.PROFILE_UUID,
                              "remproject" : pid},
                             function (json) {
                                 console.info("remproject", json);
                                 callback(json);
                             });
        
    }
    // Exports from this module for use elsewhere
    return {
	"InitShareProfile" : InitShareProfile,
    };
}
)();
});
