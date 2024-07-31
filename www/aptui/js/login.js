$(function ()
{
    'use strict';
    var templates = APT_OPTIONS.fetchTemplateList(['waitwait-modal',
						   'nomore-genilogin-modal']);
    var waitwaitString = templates['waitwait-modal'];
    var embedded = 0;
    
    function initialize()
    {
	embedded = window.EMBEDDED;
	$('#waitwait_div').html(waitwaitString);

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
	$('#quickvm_login_modal_button').click(function () {
	    sup.ShowWaitWait("We are logging you in, patience please");
	});

	// Move focus to username
        $('#quickvm_login_form input[name="uid"]')[0].focus();
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
