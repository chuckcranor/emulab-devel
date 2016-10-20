//require(window.APT_OPTIONS.configObject,
//	['js/quickvm_sup'],
$(function ()
{
    'use strict';

    function initialize()
    {
	window.APT_OPTIONS.initialize(sup);
    }
    $('body').show();
    $(document).ready(initialize);
});
