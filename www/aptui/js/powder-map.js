$(function ()
{
    'use strict';

    var templates = APT_OPTIONS.fetchTemplateList(['powder-map',
						   'powder-filters']);

    function initialize()
    {
	window.APT_OPTIONS.initialize(sup);

	$('#main-body').html(_.template(templates['powder-map']));
	$('#filtering-options').html(templates['powder-filters']);

	if (window.EMBEDDED) {
	    $(".powder-mapview").css("height", "99%");
	}
	ShowPowderMap(".powder-mapview",
		      {"showfilter"    : window.SHOWFILTER,
		       "showavailable" : window.SHOWAVAILABLE,
		       "showmobile"    : window.SHOWMOBILE,
		       // What the user has reserved.
		       "showreserved"  : window.SHOWRESERVED,
		       "showlegend"    : window.SHOWLEGEND,
		      });
    }
    $(document).ready(initialize);
});
