//
// Parameter Set stuff
//
$(function () {
  window.paramsets = (function()
    {
	'use strict';

	//
	// Throw up a modal to create and save a parameter set using the
	// provided profile and instance uuid. 
	//
	function InitSaveParameterSet(domid, profile_uuid, instance_uuid)
	{
	    console.info("InitSaveParameterSet", domid, profile_uuid,
			 instance_uuid);
	    
            var templates = APT_OPTIONS
		.fetchTemplateList(['save-paramset-modal']);
	    $(domid).html(templates['save-paramset-modal']);

	    // Bind the save button.
	    $('#save-paramset-confirm').click(function (event) {
		SaveParameterSet(profile_uuid, instance_uuid);
	    });
	    sup.ShowModal('#save-paramset-modal');
	}

	// Save a paramset set.
	function SaveParameterSet(profile_uuid, instance_uuid)
	{
	    var name  = $.trim($('#paramset-name').val());
	    var desc  = $.trim($('#paramset-description').val());
	    var bound = $('#paramset-bound').is(':checked') ? 1 : 0;
	    console.info("SaveParameterSet", name, desc, bound);

	    var showError = function (which, error) {
		var id = "#save-paramset-modal ." + which + "-error";

		$(id).html(error);
		$(id).removeClass("hidden");
	    };
	    // Hide errors.
	    $('#save-paramset-modal .paramset-error').addClass("hidden");
	    // No blank fields please
	    if (name == "") {
		showError("name", "Please provide a name");
		return;
	    }
	    if (desc == "") {
		showError("description", "Please provide a description");
		return;
	    }
	    var args = {
		"profile_uuid"  : profile_uuid,
		"instance_uuid" : instance_uuid,
		"name"          : name,
		"description"   : desc,
		"bound"         : bound,
	    };
	    var callback = function (json) {
		console.info(json);
		if (json.code) {
		    var value = json.value;
		    
		    if (typeof json.value === 'object') {
			if (_.has(value, "name")) {
			    showError("name", value.name);
			}
			if (_.has(value, "description")) {
			    showError("description", value.description);
			}
			if (_.has(value, "error")) {
			    showError("general", value.error);
			}
		    }
		    else {
			showError("general", value);
		    }
		    return;
		}
		sup.HideModal('#save-paramset-modal');
	    };
	    sup.CallServerMethod(null, "paramsets", "Create", args, callback);
	}

	//
	// Throw up a modal to confirm parameter set deletion,
	//
	function InitDeleteParameterSet(uid, uuid, callback)
	{
	    console.info("InitDeleteParameterSet", uid, uuid);
	    
	    // Bind the confirm button.
	    $('#confirm-delete-paramset').click(function (event) {
		DeleteParameterSet(uid, uuid, callback);
	    });
	    sup.ShowModal('#delete-paramset-modal', function () {
		$('#confirm-delete-paramset').off("click");
	    });
	}

	// Delete a parameter set
	function DeleteParameterSet(uid, uuid, caller_callback)
	{
	    var args = {
		"uid"           : uid,
		"uuid"		: uuid,
	    };
	    var callback = function (json) {
		console.info(json);
		if (json.code) {
		    sup.SpitOops("oops", json.value);
		    return;
		}
		caller_callback();
	    };
	    sup.HideModal('#delete-paramset-modal', function () {
		sup.CallServerMethod(null, "paramsets", "Delete", args, callback);
	    });
	}

	// Exports from this module.
	return {
	    "InitSaveParameterSet"	: InitSaveParameterSet,
	    "InitDeleteParameterSet"    : InitDeleteParameterSet,
	};
    }
)();
});
