$(function ()
{
    'use strict';
    var templates = APT_OPTIONS.fetchTemplateList(['login', 'waitwait-modal',
						   'nomore-genilogin-modal']);
    var mainTemplate = _.template(templates['login']);
    var embedded = 0;
    // These are duplicated in ../login.ajax
    var STATUS_LOGGEDIN   = 0;
    var STATUS_FORMERRORS = 2;
    var STATUS_LOGINFAIL  = 3;      
    var STATUS_INVALID    = 4;
    var STATUS_ERROR      = -1;
    // For RDZ SSO
    var ssoContinue   = 0;
    var ssoSwitchUser = 0;
    
    function initialize()
    {
	embedded = window.EMBEDDED;
	var html = mainTemplate({});
	html = aptforms.FormatFormFieldsHorizontal(html);
        $('#main-body').html(html);
	$('#waitwait_div').html(templates['waitwait-modal']);

	if (window.PGENILOGIN) {
	    $('#nomore_genilogin_div').html(templates['nomore-genilogin-modal']);
	    $('#nomore-genilogin-modal .confirm-button').click(function (event) {
		event.preventDefault();
		NoMoreGeniLogin();
	    });
	    $('#quickvm_geni_login_button').click(function (event) {
		event.preventDefault();
		sup.ShowModal('#nomore-genilogin-modal');
	    });
	}
	window.APT_OPTIONS.initialize(sup);

	// Login takes more then non-trivial time, say something soothing.
	$('#quickvm_login_modal_button').click(function (event) {
            event.preventDefault();
            DoLogin();
	});

        if (window.CLIENT_ID !== undefined && 
            window.REDIRECT_URI !== undefined &&
            window.CURRENT_UID !== undefined) {
            $('#sso-current-user').html(window.CURRENT_UID);
            $('#sso-existing-account').click(function (event) {
                event.preventDefault();
                sup.HideModal('#sso-modal', function () {
                    ssoContinue = 1;
                    DoLogin();
                });
            });
            $('#sso-different-account').click(function (event) {
                event.preventDefault();
                ssoSwitchUser = 1;
                sup.HideModal('#sso-modal', function () {
	            // Move focus to username
                    $('#quickvm_login_form input[name="uid"]')[0].focus();
                });
            });
            sup.ShowModal('#sso-modal');
        }
        else {
	    // Move focus to username
            $('#quickvm_login_form input[name="uid"]')[0].focus();
        }
    }

    /*
     *
     */
    function DoLogin()
    {
        var args = {};
        
        if (ssoContinue) {
            args["sso-continue"] = 1;
        }
        else {
            args["uid"] = $('#quickvm_login_form input[name="uid"]').val(),
            args["password"] = $('#quickvm_login_form input[name="password"]').val();

            if (window.CLEANMODE !== undefined) {
                args["cleanmode"] = window.CLEANMODE;
            }
            if (window.ADMINMODE !== undefined) {
                args["adminmode"] = window.ADMINMODE;
            }
            if (ssoSwitchUser) {
                args["sso-switchuser"] = 1;
            }
        }
        if (window.CLIENT_ID !== undefined) {
            args["client_id"] = window.CLIENT_ID;
        }
        if (window.REDIRECT_URI !== undefined) {
            args["redirect_uri"] = window.REDIRECT_URI;
        }
        var callback = function(json) {
            console.info("DoLogin", json);
            if (json.code) {
                if (json.code == STATUS_FORMERRORS) {
                    aptforms.GenerateFormErrors('#quickvm_login_form', json.value);
                }
                else if (json.code == STATUS_INVALID) {
                    $('#general_error').html(json.value)
                }
                else if (json.code == STATUS_LOGINFAIL) {
                    $('#general_error').html(json.value)
                }
                else {
                    $('#general_error').html(json.value)
                }
                return;
            }
            window.location.replace(json.value);
        };
	sup.CallServerMethod(null, "login", "DoLogin", args, callback);
    }

    /*
     * No More Geni Logins.
     */
    function NoMoreGeniLogin()
    {
	$('#nomore-genilogin-modal .email-error')
	    .html("Please provide a valid email address");
	
	var email = $.trim($('#nomore-genilogin-modal input').val());
	console.info(email);
	if (email == "") {
	    $('#nomore-genilogin-modal .email-error').removeClass("hidden");
	    return;
	}
	$('#nomore-genilogin-modal .email-error').addClass("hidden");
	sup.CallServerMethod(null, "geni-login", "NoMoreGeniLogin",
			     {"email" : email},
			     function (json) {
				 console.info(json);
				 if (json.code) {
				     $('#nomore-genilogin-modal .email-error')
					 .html(json.value)
					 .removeClass("hidden");
				     return;
				 }
				 sup.HideModal('#nomore-genilogin-modal',
					       function () {
						   alert("Email has been sent, "+
							 "please check your email");
					       });
			     });
    }
    
    $(document).ready(initialize);
});
