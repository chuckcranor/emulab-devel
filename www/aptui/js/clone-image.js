$(function ()
{
    'use strict';

    var templates = APT_OPTIONS.fetchTemplateList(['clone-image',
						   'oops-modal',
						   'waitwait-modal']);
    var mainString     = templates['clone-image'];
    var mainTemplate   = _.template(mainString);
    var formfields     = {};
    var isadmin        = false;

    function JsonParse(id)
    {
	return 	JSON.parse(_.unescape($(id)[0].textContent));
    }
    
    function initialize()
    {
	window.APT_OPTIONS.initialize(sup);

	isadmin     = window.ISADMIN;

	if (window.BASEIMAGE_UUID === undefined) {
	    GeneratePageBody(formfields);
	}
	else {
	    sup.CallServerMethod(null, "image", "GetInfo",
				 {"uuid" : window.BASEIMAGE_UUID},
				 function(json) {
				     console.info("info", json);
				     if (json.code) {
					 alert("Could not get image info " +
					       "from server: " + json.value);
					 return;
				     }
				     GeneratePageBody(json.value);
				 });
	}
    }

    //
    // Moved into a separate function since we want to regen the form
    // after each submit, which happens via ajax on this page. 
    //
    function GeneratePageBody(formfields)
    {
	var title;
	
	// Generate the template.
	var html = mainTemplate({
	    formfields:		formfields,
	    isadmin:		isadmin,
	});
	html = aptforms.FormatFormFieldsHorizontal(html);
	$('#main-body').html(html);

	// Now we can do this. 
	$('#oops_div').html(templates['oops-modal']);
	$('#waitwait_div').html(templates['waitwait-modal']);

	// Set the correct shared/global radio.
	if (formfields["shared"]) {
	    $("#shared-global-radio-shared").prop("checked", "checked");
	}
	else if (formfields["global"]) {
	    $("#shared-global-radio-global").prop("checked", "checked");
	}
	else {
	    $("#shared-global-radio-neither").prop("checked", "checked");
	}
	// This activates the tooltip subsystem.
	$('[data-toggle="tooltip"]').tooltip({
	    trigger: 'hover',
	});

	// This activates the popover subsystem.
	$('[data-toggle="popover"]').popover({
	    trigger: 'hover',
	    container: 'body'
	});
	aptforms.EnableUnsavedWarning('#clone-image-form');

	//
	// Handle submit button.
	//
	$('#clone-image-button').click(function (event) {
	    event.preventDefault();
	    SubmitForm();
	});
    }

    //
    // Submit the form.
    //
    function SubmitForm()
    {
	var submit_callback = function(json) {
	    console.info(json);
	    if (json.code) {
		sup.SpitOops("oops", json.value);
		return;
	    }
	    var url = json.value;
	    console.info(url);
	    window.location.replace(url);
	};
	var checkonly_callback = function(json) {
	    if (json.code) {
		if (json.code != 2) {
		    sup.SpitOops("oops", json.value);		    
		}
		return;
	    }
	    aptforms.SubmitForm('#clone-image-form', "image", "Clone",
				submit_callback,
				"This will take a few minutes; " +
				"please be patient!");
	};
	aptforms.CheckForm('#clone-image-form', "image", "Clone",
			   checkonly_callback);
    }
    
    $(document).ready(initialize);
});


