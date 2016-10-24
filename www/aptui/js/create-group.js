$(function ()
{
    'use strict';

    var templates = APT_OPTIONS.fetchTemplateList(['create-group', 'oops-modal', 'waitwait-modal']);
    var mainString = templates['create-group'];
    var oopsString = templates['oops-modal'];
    var waitwaitString = templates['waitwaitString'];
    var mainTemplate = _.template(mainString);
    var fields       = null;
    var isadmin      = false;
    
    function initialize()
    {
	window.APT_OPTIONS.initialize(sup);

	isadmin  = window.ISADMIN;
	fields   = JSON.parse(_.unescape($('#form-json')[0].textContent));

	GeneratePageBody(fields);

	// Now we can do this. 
	$('#oops_div').html(oopsString);	
	$('#waitwait_div').html(waitwaitString);	
    }

    //
    // Moved into a separate function since we want to regen the form
    // after each submit, which happens via ajax on this page. 
    //
    function GeneratePageBody(formfields)
    {
	// Generate the template.
	var html = mainTemplate({
	    formfields:		formfields,
	    isadmin:		isadmin,
	});
	html = aptforms.FormatFormFieldsHorizontal(html);
	$('#main-body').html(html);

	// This activates the popover subsystem.
	$('[data-toggle="popover"]').popover({
	    trigger: 'hover',
	    container: 'body'
	});
	aptforms.EnableUnsavedWarning('#create_dataset_form');

	// Handler for submit button.
	$('#create-group-button').click(function (event) {
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
	    if (json.code) {
		sup.SpitOops("oops", json.value);
		return;
	    }
	    window.location.replace(json.value);
	};
	var checkonly_callback = function(json) {
	    if (json.code) {
		if (json.code != 2) {
		    sup.SpitOops("oops", json.value);		    
		}
		return;
	    }
	    aptforms.SubmitForm('#create-group-form', "groups", "Create",
				submit_callback,
 				"Creating your group, this will take a " +
				"minute or two ... patience please");
	};
	aptforms.CheckForm('#create-group-form', "groups", "Create",
			   checkonly_callback);
    }

    $(document).ready(initialize);
});


