$(function ()
{
    'use strict';

    var lastIndex  = 0;

    /*
     * This code witten by Jon; ../../fetchlogfile.html
     */
    function initialize()
    {
	// The URL refers to the old php script that spews the file.
	var url = window.SPEWURL + '&isajax=1';

	// Fetch spewlogfile via AJAX call
	var xhr = new XMLHttpRequest();

	// Remember the current scrollTop to indicate if the user has
	// moved the scroll since the last time data came in.
	var scrollTop = 0;

	// Every time new data comes in or the state variable changes,
	// this function is invoked.
	xhr.onreadystatechange = function ()
	{
            // xhr.responseText contains all data received so far from
            // spewlogfile
            if (xhr.responseText)
            {
		// Append only new text
		var newText = xhr.responseText.substr(lastIndex);
		lastIndex = xhr.responseText.length;

		var newScrollTop = $(window).scrollTop();

		$('pre').append(_.escape(newText));

		if (scrollTop == newScrollTop) {
		    $(window).scrollTop(1000000);
		    scrollTop = $(window).scrollTop();
		}
            }
	    //
	    // Request is done, we got everything. 
	    //
	    if (xhr.readyState == 4) {
		//
		// This will clear the busy indicators in the outer page,
		// if there are any.
		//
		if (typeof(parent.loadFinished) == "function") {
		    parent.loadFinished();
		}
	    }
	};
	// Invoke the AJAX
	xhr.open('get', url, true);
	xhr.send();
    }

    $(document).ready(initialize);
});
