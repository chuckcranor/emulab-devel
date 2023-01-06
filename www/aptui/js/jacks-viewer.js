$(function ()
{
    'use strict';

    /*
     * This embeds a Jacks viewer in an iframe so that it is fully
     * independent of the parent page. 
     */

    // The JacksViewer object once initialized.
    var viewer = null;

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
	console.info("mod call", window.JacksViewerModifiedCallback);
	console.info("click call", window.JacksViewerClickCallback);

	if (message.action == "create") {
	    CreateJacksViewer(message);
	}
	else if (message.action == "add") {
	    Add(message);
	}
	else if (message.action == "clear") {
	    Clear(message);
	}
    }

    function CreateJacksViewer(message)
    {
	viewer = new JacksViewer(message.showinfo,
				 message.multisite,
				 message.aggregates,
				 function () { Ready(this, message); },
				 // The parent sets these.
				 window.JacksViewerModifiedCallback,
				 window.JacksViewerClickCallback);
	console.info("viewer", viewer);
    }

    function Ready(viewer, message)
    {
	if (message.xml == null) {
	    return;
	}
	console.info("ready", viewer);
	viewer.add(message.xml);
    }

    function Add(message)
    {
	viewer.add(message.xml);
    }
    
    function Clear(message)
    {
	viewer.clear();
    }
    
    $(document).ready(initialize);
});
