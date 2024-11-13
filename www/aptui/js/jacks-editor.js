$(function ()
{
    'use strict';

    /*
     * This embeds a Jacks editor in an iframe so that it is fully
     * independent of the parent page. 
     */

    // The JacksEditor object once initialized.
    var editor = null;

    function initialize()
    {
	window.APT_OPTIONS.initialize(sup);

	/*
	 * Embedded in another page, we are getting marching orders from
	 * the parent page.
	 * 
	 * Setup an event listener receive messages from the parent.
	 */
	console.info("adding event handler");
	window.addEventListener("message", HandleMessage);
    }

    function HandleMessage(event)
    {
	var message = event.data;
	console.info("HandleMessage", message);

	if (message.action == "create") {
	    CreateJacksEditor(message);
	}
	else if (message.action == "show") {
	    Show(message);
	}
	else if (message.action == "clear") {
	    Clear(message);
	}
	else if (message.action == "fetchxml") {
	    FetchXML(message);
	}
    }

    function CreateJacksEditor(message)
    {
	editor = new JacksEditor(message.root,
				 message.isViewer,
				 message.isInline,
				 message.withoutSelection,
				 message.withoutMenu,
				 message.withoutMultiSite,
				 message.options);
    }

    function Show(message)
    {
	editor.show(message.xml);
    }
    
    function Clear(message)
    {
	editor.clear();
    }
    
    function FetchXML(message)
    {
	editor.fetchXml(function (xml) {
	    if (window.AcceptEditCallback !== undefined) {
		window.AcceptEditCallback(xml);
	    }
	});
    }
    
    $(document).ready(initialize);
});
