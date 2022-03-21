$(function ()
{
    'use strict';
    var template_list   = ["ota-agreement", "ota-form",
			   "oops-modal", "waitwait-modal"];
    var templates       = APT_OPTIONS.fetchTemplateList(template_list);
    var licenses        = [];

    function initialize()
    {
	window.APT_OPTIONS.initialize(sup);

	$('#main-body').html(templates["ota-form"]);
	$('#ota-agreement').html(templates["ota-agreement"]);
	$('#oops-div').html(templates["oops-modal"]);
	$('#waitwait-div').html(templates["waitwait-modal"]);
	$('#powder-project').html(window.PID);
	$('#ota-pid').val(window.PID);

	$('#ota-agreed').change(function () {
	    var ischecked =  $('#ota-agreed').is(":checked");

	    if (ischecked) {
		$('#ota-submit').removeAttr("disabled");
	    }
	    else {
		$('#ota-submit').attr("disabled", "disabled");
	    }
	});

	$('#ota-submit').click(function (event) {
	    event.preventDefault();
	    SubmitForm();
	});
    }

    function SubmitForm()
    {
	var submit = function (json) {
	    console.info("Submitform", json);
	    if (json.code) {
		// Form error
		if (json.code != 2) {
		    sup.SpitOops("oops", json.value);
		    return;
		}
		return;
	    }
	    sup.ShowModal('#confirm-submit-modal');
	};
	aptforms.CheckForm('#ota-form', "ota-agreement", "Submit",
			   function (json) {
			       console.info("Checkform", json);
			       if (json.code) {
				   // Form error
				   if (json.code != 2) {
				       sup.SpitOops("oops", json.value);
				       return;
				   }
				   return;
			       }
			       aptforms.SubmitForm('#ota-form',
						   "ota-agreement", "Submit",
						   submit);
			   });
    }
    $(document).ready(initialize);
});
