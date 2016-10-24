$(function ()
{
    'use strict';

    var templates = APT_OPTIONS.fetchTemplateList(['profile-activity']);
    var ajaxurl = null;
    var profileTemplate = _.template(templates['profile-activity']);

    function initialize()
    {
	window.APT_OPTIONS.initialize(sup);
	ajaxurl  = window.AJAXURL;

	var instances =
	    JSON.parse(_.unescape($('#instances-json')[0].textContent));
	var activity_html = profileTemplate({instances: instances});
	$('#activity-body').html(activity_html);
    }
    $(document).ready(initialize);
});
