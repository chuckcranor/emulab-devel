$(function ()
{
    'use strict';

    var templates = APT_OPTIONS.fetchTemplateList(['powder-map']);

    function initialize()
    {
	window.APT_OPTIONS.initialize(sup);

	$('#main-body').html(_.template(templates['powder-map']));

	if (window.EMBEDDED) {
	    $(".powder-mapview").css("height", "99%");
	}
	var options = {
	    "showfilter"    : window.SHOWFILTER,
	    "setfilter"     : undefined,
	    "showavailable" : window.SHOWAVAILABLE,
	    "showmobile"    : window.SHOWMOBILE,
	    // What the user has reserved.
	    "showreserved"  : window.SHOWRESERVED,
	    "showlegend"    : window.SHOWLEGEND,
	    "showlinks"     : window.SHOWLINKS,
	    "onlineonly"    : window.ONLINEONLY,
	    "imagerymap"    : window.IMAGERYMAP,
	};
	if (window.EXPERIMENT !== undefined) {
	    options["experiment"] = window.EXPERIMENT;
	}
	if (window.LOCATION !== undefined) {
	    options["location"] = window.LOCATION;
	}
	if (window.ROUTE !== undefined) {
	    options["route"] = window.ROUTE;
	}
	if (window.SETFILTER !== undefined) {
	    options["setfilter"] = window.SETFILTER;
	}

	WaitForRequire(options);
    }

    function WaitForRequire(options)
    {
	if (typeof require !== "undefined") {
	    ShowPowderMap(".powder-mapview", options);
	}
	else {
	    console.info("Require not defined yet")
            setTimeout(WaitForRequire, 100);
	}
    }
    $(document).ready(initialize);
});
