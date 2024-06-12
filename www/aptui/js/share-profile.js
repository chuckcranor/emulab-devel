//
// Share profile helper.
//
$(function () {
window.ShareProfile = (function ()
{
    'use strict';
    var templates = APT_OPTIONS.fetchTemplateList(['share-profile-modal',
                                                   'share-profile-body']);
    var bodyTemplate = _.template(templates['share-profile-body']);

    function InitShareProfile(button)
    {
        console.info("InitShareProfile", button);
        $('#share-profile-modal-div').html(templates['share-profile-modal']);
        InitModal();
	$(button).click(function (event) {
	    event.preventDefault();
            console.info(event);
	    sup.ShowModal('#share-profile-modal');
	});
    }

    function InitModal()
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
                        InitModal();
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
                        InitModal();
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
                                 InitModal();
                                 /*
                                  * Update the summary box
                                  */
                                 $('#profile-public').html(ispublic ? "Yes" : "No");
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
