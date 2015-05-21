window.APT_OPTIONS = window.APT_OPTIONS || {};

window.APT_OPTIONS.configObject = {
    baseUrl: '.',
    paths: {
	'jquery-ui': 'js/lib/jquery-ui',
	'jquery-grid':'js/lib/jquery.appendGrid-1.3.1.min',
	'jquery-steps': 'js/lib/jquery.steps.min',
	'formhelpers': 'js/lib/bootstrap-formhelpers',
	'dateformat': 'js/lib/date.format',
	'd3': 'js/lib/d3.v3',
	'filestyle': 'js/lib/filestyle',
	'marked': 'js/lib/marked',
	'moment': 'js/lib/moment',
	'underscore': 'js/lib/underscore-min',
	'filesize': 'js/lib/filesize.min',
	'contextmenu': 'js/lib/bootstrap-contextmenu',
	'jacks': 'https://www.emulab.net/protogeni/jacks-stable/js/jacks',
	'constraints': 'https://www.emulab.net/protogeni/jacks-devel/js/Constraints'
    },
    shim: {
	'jquery-ui': { },
	'jquery-grid': { deps: ['jquery-ui'] },
	'jquery-steps': { },
	'formhelpers': { },
	'dateformat': { exports: 'dateFormat' },
	'd3': { exports: 'd3' },
	'filestyle': { },
	'marked' : { exports: 'marked' },
	'underscore': { exports: '_' },
	'filesize' : { exports: 'filesize' },
	'contextmenu': { },
    },
    urlArgs: "version=" + APT_CACHE_TOKEN
};

window.APT_OPTIONS.initialize = function (sup)
{
    var geniauth = "https://www.emulab.net/protogeni/speaks-for/geni-auth.js";
    var embedded = window.EMBEDDED;

    // Eventually make this download without having to follow a link.
    // Just need to figure out how to do that!
    if ($('#download_creds_link').length) {
	$('#download_creds_link').click(function(e) {
	    e.preventDefault();
	    window.location.href = 'getcreds.php';
	    return false;
	});
    }

    // Every page calls this, and since the Login button is on every
    // page, do this initialization here. 
    if ($('#quickvm_geni_login_button').length) {
	$('#quickvm_geni_login_button').click(function (event) {
	    event.preventDefault();
	    if ($('#quickvm_login_modal').length) {
		sup.HideModal("#quickvm_login_modal");
	    }
	    sup.StartGeniLogin();
	    return false;
	});
    }
    // When the user clicks on the login button, we not only display
    // the modal, but fire off the load of the geni-auth.js file so
    // that the code is loaded. Something to do with popup rules from
    // javascript event handlers, blah blah blah. Ask Jon.
    if ($('#loginbutton').length) {
	$('#loginbutton').click(function (event) {
	    event.preventDefault();
	    sup.ShowModal('#quickvm_login_modal');
	    if (window.ISCLOUD) {
		console.info("Loading geni auth code");
		sup.InitGeniLogin(embedded);
		require([geniauth], function() {
		    console.info("Geni auth code has been loaded");
		    $('#quickvm_geni_login_button').removeAttr("disabled");
		});
	    }
	    return false;
	});
    }
    $('body').show();
}
