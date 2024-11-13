// RFB holds the API to connect and communicate with a VNC server
import RFB from './core/rfb.js';
import * as browser from "./core/util/browser.js";

$(function ()
{
    'use strict';

    var rfb = null;
    var targetHost = null;
    var pasteInsert = false;

    // Show the status in the top bar
    function status(text) {
	$('#status').text(text);
    }

    // This is culled from vnc_lite.html.
    function Connect(url, password) {
	status("Connecting");
	
	// Creating a new RFB object will start a new connection
	rfb = new RFB(document.getElementById('screen'), url,
		      { credentials: { password: password } });

	// Add listeners to important events from the RFB module
	rfb.addEventListener("connect", function (e) {
	    status("Connected to " + targetHost);
	});
	rfb.addEventListener("disconnect", function (e) {
	    status("Disconnected");
	    window.close();
	});
	rfb.addEventListener("credentialsrequired", function (e) {
            const password = prompt("Password Required:");
            rfb.sendCredentials({ password: password });
	});	
	rfb.addEventListener("desktopname", function (e) {
            targetHost = e.detail.name;
	    $(document).attr("title", targetHost);
	});
	rfb.addEventListener('clipboard', function (e) {
	    console.info("clipboard", e.detail);
	    $('#clipboard-textarea').val(e.detail.text);
	});
	// Handy for debugging.
	window.rfb = rfb;
    }

    function HandlePasteEvent (event)
    {
	let paste = (event.clipboardData ||
		     window.clipboardData).getData('text');
	console.info("HandlePasteEvent: ", paste, pasteInsert);
	rfb.clipboardPasteFrom(paste);
	if (pasteInsert) {
            for (let i = 0; i < paste.length; i++) {
		rfb.sendKey(paste.charCodeAt(i));
            }
	    pasteInsert = false;
	}
    }
    document.addEventListener('paste', HandlePasteEvent, false);

    /*
     * Not allowed to alter system clipboard unless it is the result
     * of a user initiated event, and the text is "copied" from a
     * DOM element.
     */
    window.CopyToClipboard = function (event) {
	var input = document.createElement('textarea');
	var stuff = $('#clipboard-textarea').val();

	console.info("CopyToClipboard", stuff);
	$(input).val(stuff);
	$('body').append($(input));
	$(input).select();
	var result = document.execCommand('copy');
	document.body.removeChild(input);
	return result;
    };
    /*
     * This is for Meta-V (paste) key. For this I want the paste
     * buffer pasted into the active window. But when the user pastes
     * into the paste box, I do not want that to pop into whatever
     * window happens to be active. 
     */
    window.CopyFromClipboard = function (event) {
	console.info("CopyFromClipboard", event, pasteInsert);
	pasteInsert = true;
	document.execCommand('paste');
    };
    
    // The top bar button.
    $('#copyToClipboard-button').click(function (event) {
	console.info("button copy");
	window.CopyToClipboard();
	event.preventDefault();
    });

    if (0 && browser.isChrome()) {
	// This is the new interface, but not worth it for just Chrome.
	$('#clipboard-paste-area').change(function (event) {
	    console.info("copyFromClipboard");
	    return navigator.clipboard.readText().then(
		result => {
		    console.log("clipboard contents: ", result)
		    rfb.clipboardPasteFrom(result);
		    return Promise.resolve(result); 
		}
	    )
	    .catch(
		err => {
		    console.log("Error: read text from clipbaord", err)
		})
	});
    }
    else {
	$('#clipboard-paste-area').change(function (event) {
	    var value = $('#clipboard-paste-area').val();
	    console.info("paste-area: ", value);
	    rfb.clipboardPasteFrom(value);
	});
    }

    /*
     * The parent window opener sends us a message with the auth info
     * which we forward to webssh (which is serving as our novnc proxy).
     */
    function connect_with_authobject(event) {
	console.info("connect_with_authobject", event.data);
	var data = {};
	var blob = $.parseJSON(event.data);
	var password = blob.password;
	var authobject_json = blob.authobject;
	var authobject = $.parseJSON(authobject_json);
	var url = authobject.baseurl + "/novncproxy";
	var ws_url = url.replace("http", "ws");

	data.authobject = authobject_json;
	console.info("connect_with_authobject", data, url);

	$.ajax({
	    url: url,
	    type: 'post',
	    data: data,
	    complete: function (resp) {
		console.info("complete", resp);

		if (resp.status !== 200) {
		    console.info(resp.status + ': ' + resp.statusText, true);
		    return;
		}
		var msg = resp.responseJSON;
		if (!msg.id) {
		    console.info(msg.status, true);
		    return;
		}
		Connect(ws_url + '/novncproxy/ws?id=' + msg.id, password);
	    },
	});
    }
    // We want to reuse the message event after the first message.
    window.addEventListener("message", connect_with_authobject, 
			    { "once" : true });

    // And tell the parent we are ready to receive the message.
    window.onload = function() {
	window.opener.postMessage("loaded", "*");
    };

    console.info("loaded");
});
