(function ()
{
 var getQueryParams = function(qs) {
   qs = qs.split('+').join(' ');
   var params = {};
   var re = /[?&]?([^=]+)=([^&]*)/g;
   var tokens = re.exec(qs);
   
   while (tokens) {
     params[decodeURIComponent(tokens[1])]
       = decodeURIComponent(tokens[2]);
     tokens = re.exec(qs);
   }
    
   return params;
 };

 var params = getQueryParams(window.location.search);
 if (! params.source)
 {
   window.JACKS_LOADER = { params: { source: 'utah' } };
 }
}
)();

window.APT_OPTIONS = window.APT_OPTIONS || {};

window.APT_OPTIONS.configObject = {
    baseUrl: '.',
    paths: {
	'jquery-ui': 'js/lib/jquery-ui',
	'jquery-grid':'js/lib/jquery.appendGrid-1.3.1.min',
	'jquery-steps': 'js/lib/jquery.steps.min',
	'formhelpers': 'js/lib/bootstrap-formhelpers',
	'dateformat': 'js/lib/date.format',
	'filestyle': 'js/lib/filestyle',
	'marked': 'js/lib/marked',
	'moment': 'js/lib/moment',
	'underscore': 'js/lib/underscore-min',
	'filesize': 'js/lib/filesize.min',
	'contextmenu': 'js/lib/bootstrap-contextmenu',
	'jacks': 'https://www.emulab.net/protogeni/jacks-utah/js/jacks',
	'constraints': 'https://www.emulab.net/protogeni/jacks-utah/js/Constraints'
    },
    shim: {
	'jquery-ui': { },
	'jquery-grid': { deps: ['jquery-ui'] },
	'jquery-steps': { },
	'formhelpers': { },
	'jacks': { },
	'dateformat': { exports: 'dateFormat' },
	'filestyle': { },
	'marked' : { exports: 'marked' },
	'underscore': { exports: '_' },
	'filesize' : { exports: 'filesize' },
	'contextmenu': { },
    },
    waitSeconds: 0,
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
	    if (window.ISCLOUD || window.ISPNET) {
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
};

APT_OPTIONS.CallServerMethod = function (url, route, method, args, callback)
{
    // ignore url now.
    url = 'https://' + window.location.host + '/apt/server-ajax.php';
    url = 'server-ajax.php';

    if (args == null) {
        args = {"noargs" : "noargs"};
    }
    return $.ajax({
        // the URL for the request
        url: url,
        success: callback,
 
        // the data to send (will be converted to a query string)
        data: {
            ajax_route:     route,
            ajax_method:    method,
            ajax_args:      args,
        },
 
        // whether this is a POST or GET request
        type: "POST",
 
        // the type of data we expect back
        dataType : "json",
    });
};

window.APT_OPTIONS.announceDismiss = function (aid) {
  APT_OPTIONS.CallServerMethod('', 'announcement', 'Dismiss', {'aid': aid}, function(){});
};

window.APT_OPTIONS.announceClick = function (aid) {
  APT_OPTIONS.CallServerMethod('', 'announcement', 'Click', {'aid': aid}, function(){});
};

window.APT_OPTIONS.nagPI = function (pid) {
  APT_OPTIONS.CallServerMethod('', 'nag', 'NagPI', {"pid" : pid},
			       function(json) {
				   if (json.code) {
				       console.info("nagged", json);
				       if (json.code > 0) {
					   alert(json.value);
				       }
				       return;
				   }
				   alert("The Project Leader for project '" +
					 pid + "' " +
					 "has been sent a reminder message.");
			       });
  return false;
};

window.APT_OPTIONS.fetchTemplate = function (name) {
  var result = '';
  var element = document.getElementById(name);
  if (element)
  {
    result = atob(element.innerHTML);
  }
  return result;
};

window.APT_OPTIONS.fetchTemplateList = function (nameList) {
  var result = {};
  for (var name in nameList)
  {
    result[name] = window.APT_OPTIONS.fetchTemplate(name);
  }
  return result;
};
