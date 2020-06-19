$(function ()
{
    'use strict';

    var template_list = ['radioinfo', "waitwait-modal", "oops-modal"];
    var templates     = APT_OPTIONS.fetchTemplateList(template_list);    
    var mainTemplate  = _.template(templates['radioinfo']);
    var amlist        = null;
    var radioInfo     = null;

    function initialize()
    {
	window.APT_OPTIONS.initialize(sup);

	radioInfo = JSON.parse(_.unescape($('#radioinfo-json')[0].textContent));
	console.info("radioinfo", radioInfo);
	amlist    = JSON.parse(_.unescape($('#amlist-json')[0].textContent));
	console.info("amlist", amlist);

	var options = {
	    "amlist"    : amlist,
	    "radioinfo" : radioInfo
	};
	$('#main-body').html(mainTemplate(options));
	// Now we can do this. 
	$('#oops_div').html(templates["oops-modal"]);
	$('#waitwait_div').html(templates["waitwait-modal"]);

	$('#radioinfo-table')
	    .tablesorter({
		theme : 'green',
		// initialize zebra
		widgets: ["zebra"],
	    });

	if (0) {
	    var map = null;
	    $(".location").click(function (event) {
		event.preventDefault();
		if (map == null || map.closed) {
		    map = window.open('powder-map.php', 'Power Map');
		}
		else {
		    map.focus();
		}
		var args = {
		    "urn"      : $(this).data("urn"),
		    "location" : $(this).data("location"),
		    "type"     : $(this).data("type"),
		};
		map.postMessage(args);
	    });
	}
    }
    $(document).ready(initialize);
});
