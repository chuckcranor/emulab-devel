$(function ()
{
    'use strict';

    var template_list   = ["importclimage", "oops-modal", "waitwait-modal"];
    var templates       = APT_OPTIONS.fetchTemplateList(template_list);    
    var oopsString      = templates["oops-modal"];
    var waitwaitString  = templates["waitwait-modal"];
    var mainTemplate    = _.template(templates["importclimage"]);
    var projlist        = null;
    var fields          = {};
    
    function initialize()
    {
	window.APT_OPTIONS.initialize(sup);

	projlist = JSON.parse(_.unescape($('#projects-json')[0].textContent));

	var html = mainTemplate({
	    formfields:		fields,
	    projects:           projlist,
            architectures:      ["x86_64", "aarch64"],
	});
	html = aptforms.FormatFormFieldsHorizontal(html);
	$('#main-body').html(html);

	// Now we can do this. 
	$('#oops_div').html(oopsString);	
	$('#waitwait_div').html(waitwaitString);

	$('#import-submit-button').click(function (event) {
	    event.preventDefault();
            SubmitForm();
        });
        aptforms.EnableUnsavedWarning('#import-form');
    }

    /*
     * Submit
     */
    function SubmitForm()
    {
	var submit_callback = function(json) {
	    if (json.code) {
		if (json.code == 2) {
		    aptforms.GenerateFormErrors('#import-form', json.value);		
		    // Make sure we still warn about an unsaved form.
		    aptforms.MarkFormUnsaved();		    
		}
		else {
		    sup.SpitOops("oops", json.value);
		}
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
	    aptforms.SubmitForm('#import-form',
				"image", "ImportCLImage", submit_callback);
	};
	aptforms.CheckForm('#import-form',
			   "image", "ImportCLImage", checkonly_callback);
    }
    
    $(document).ready(initialize);
});
