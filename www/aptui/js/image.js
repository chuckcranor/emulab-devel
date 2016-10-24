//
// Progress Modal
//
//define(['underscore', 'js/quickvm_sup', 'filesize'],
$(function () {
window.ShowImagingModal = (function()
    {
	'use strict';

        var imagingString = APT_OPTIONS.fetchTemplate('imaging-modal');
	var imagingTemplate = null;
	var imaging_modal_display = true;
	var imaging_modal_active  = false;
	var status_callback;
	var completion_callback;

	function ShowImagingModalSecret()
	{
	    var laststatus = "preparing";
	    
	    //
	    // Ask the server for information to populate the imaging modal. 
	    //
	    var callback = function(json) {
		var value = json.value;
		console.log("ShowImagingModal");
		console.log(json);

		if (json.code) {
		    if (imaging_modal_active) {
			sup.HideModal("#imaging-modal");
			imaging_modal_active = false;
			$('#imaging-modal').off('hidden.bs.modal');
		    }
		    sup.SpitOops("oops", "Server says: " + json.value);
		    completion_callback(1);
		    return;
		}

		if (! imaging_modal_active && imaging_modal_display) {
		    sup.ShowModal("#imaging-modal");
		    imaging_modal_active  = true;
		    imaging_modal_display = false;

		    // Handler so we know the user closed the modal.
		    $('#imaging-modal').on('hidden.bs.modal', function (e) {
			imaging_modal_active = false;
			$('#imaging-modal').off('hidden.bs.modal');
		    })		
		}

		//
		// Fill in the details. 
		//
		if (! _.has(value, "node_status")) {
		    value["node_status"] = "unknown";
		}
		if (_.has(value, "image_size")) {
		    // We get KB to avoid overflow along the way. 
		    value["image_size"] = filesize(value["image_size"]*1024);
		}
		else {
		    value["image_size"] = "unknown";
		}	    
		$('#imaging_modal_node_status').html(value["node_status"]);
		$('#imaging_modal_image_size').html(value["image_size"]);

		if (_.has(value, "image_status")) {
		    var status = value["image_status"];

		    if (status == "imaging") {
			$('#tracker-imaging').removeClass('progtrckr-todo');
			$('#tracker-imaging').addClass('progtrckr-done');
		    }
		    else if (status == "finishing") {
			$('#tracker-imaging').removeClass('progtrckr-todo');
			$('#tracker-imaging').addClass('progtrckr-done');
			$('#tracker-finishing').removeClass('progtrckr-todo');
			$('#tracker-finishing').addClass('progtrckr-done');
		    }
		    else if (status == "copying") {
			$('#tracker-imaging').removeClass('progtrckr-todo');
			$('#tracker-imaging').addClass('progtrckr-done');
			$('#tracker-finishing').removeClass('progtrckr-todo');
			$('#tracker-finishing').addClass('progtrckr-done');
			$('#tracker-copying').removeClass('progtrckr-todo');
			$('#tracker-copying').addClass('progtrckr-done');
		    }
		    else if (status == "ready") {
			$('#tracker-imaging').removeClass('progtrckr-todo');
			$('#tracker-imaging').addClass('progtrckr-done');
			$('#tracker-finishing').removeClass('progtrckr-todo');
			$('#tracker-finishing').addClass('progtrckr-done');
			$('#tracker-copying').removeClass('progtrckr-todo');
			$('#tracker-copying').addClass('progtrckr-done');
			$('#tracker-ready').removeClass('progtrckr-todo');
			$('#tracker-ready').addClass('progtrckr-done');
			$('#imaging-spinner').addClass("hidden");
			if (_.has(value, "image_name")) {
			    $('#imaging-done-modal-imagename')
				.text(value["image_name"]);
			    $('#imaging-modal-imagename')
				.text(value["image_name"]);

			    if (!imaging_modal_active) {
				sup.ShowModal("#imaging-done-modal");
			    }
			    else {
				$('#imaging_modal_done_div')
				    .removeClass("hidden");
			    }
			}
			$('#imaging-close').removeClass("hidden");
			completion_callback(0);
			return;
		    }
		    else if (status == "failed") {
			if (laststatus == "preparing") {
			    $('#tracker-imaging').removeClass('progtrckr-todo');
			    $('#tracker-imaging').addClass('progtrckr-failed');
			}
			if (laststatus == "imaging" ||
			    laststatus == "preparing") {
			    $('#tracker-finishing').removeClass('progtrckr-todo');
			    $('#tracker-finishing').addClass('progtrckr-failed');
			}
			if (laststatus == "imaging" ||
			    laststatus == "preparing" ||
			    laststatus == "finishing") {
			    $('#tracker-copying').removeClass('progtrckr-todo');
			    $('#tracker-copying').addClass('progtrckr-failed');
			}
			$('#tracker-ready').removeClass('progtrckr-todo');
			$('#tracker-ready').addClass('progtrckr-failed');
			
			$('#tracker-ready').html("Failed");
			$('#imaging-spinner').addClass("invisible");
			$('#imaging-close').removeClass("hidden");
			completion_callback(1);
			return;
		    }
		    laststatus = status;
		}
		//
		// Done, we need to do something here if we exited before
		// ready or failed above. 
		//
		if (_.has(value, "exited")) {
		    $('#imaging-spinner').addClass("hidden");
		    $('#imaging-close').removeClass("hidden");
		    completion_callback(0);
		    return;
		}
	    
		// And check again in a little bit.
		setTimeout(function f() { ShowImagingModalSecret() }, 5000);
	    }

	    var $xmlthing = status_callback();
	    $xmlthing.done(callback);
	}

        return function(s_callback, c_callback)
	{
	    status_callback = s_callback;
	    completion_callback = c_callback;

	    if (imagingTemplate == null) {
		imagingTemplate  = _.template(imagingString);
	    }
	    
	    var callback = function(json) {
		var value = json.value;
		console.log("ShowImagingModal Startup");
		console.log(json);
		
    		var imaging_html = imagingTemplate({
		    needcopy : _.has(json.value, "copyback_uuid")});
		$('#imaging_div').html(imaging_html);
		
		imaging_modal_display = true;	    
		ShowImagingModalSecret();
	    };
	    var $xmlthing = status_callback();
	    $xmlthing.done(callback);
	}
    }
)();
});
