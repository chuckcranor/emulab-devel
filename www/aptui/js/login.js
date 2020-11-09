$(function ()
{
    'use strict';
    var templates = APT_OPTIONS.fetchTemplateList(['waitwait-modal']);
    var waitwaitString = templates['waitwait-modal'];
    var embedded = 0;
    
    function initialize()
    {
	embedded = window.EMBEDDED;
	$('#waitwait_div').html(waitwaitString);

	// We share code with the modal version of login, and the
	// handler for the button is installed in initialize().
	// See comment there.
	if (window.PGENILOGIN) {
	    sup.InitGeniLogin(embedded);
	}
	window.APT_OPTIONS.initialize(sup);

	// Login takes more then non-trivial time, say something soothing.
	$('#quickvm_login_modal_button').click(function () {
	    sup.ShowWaitWait("We are logging you in, patience please");
	});
    }
    $(document).ready(initialize);
});
