//
// Start a Parameterized Profile
//
define(['underscore', 'js/quickvm_sup', 'js/JacksEditor',
       	'js/lib/text!template/ppform-wizard.html',
       	'js/lib/text!template/ppform-wizard-body.html',
       	'js/lib/text!template/choose-am.html',
       ],
function(_, sup, JacksEditor, ppmodalString, ppbodyString, chooserString)
    {
	'use strict';

	var bodyTemplate  = null;
	var chooseTemplate= null;
	var editor        = null;
	var editorLarge   = null;
	var defaults      = null;
	var uuid          = "";
	var amlist        = null;
	var amdefault     = null;
	var registered    = true;
	var callback_done = null;
	var button_label  = "Instantiate";
	var RSPEC	  = null;

	//
	// Moved into a separate function since we want to regen the form
	// after each submit, which happens via ajax on this page. 
	//
	function GenerateModalBody(formfields, errors){
	    // Generate the template.
	    var html = bodyTemplate({
		formfields:		formfields,
	    });
	
	    html = formatter(html, errors).html();
	    $('#ppmodal-body').html(html);
	    if (!registered) {
		$('#pp_form :input').attr('readonly', true);
		// This is the only way to disable selects
		$('#pp_form :input').attr('disabled', true);
		// Have to renable the buttons after disabling selects
		$('#pp_form :button').attr('disabled', false);
		$('#pp_form :button').attr('readonly', false);
	    }
	    
	    //
	    // Handle submit button.
	    //
	    $('#modal_profile_continue_button').click(function (event) {
		event.preventDefault();
		HandleSubmit();
	    });
	}
    
	// Formatter for the form. This did not work out nicely at all!
	function formatter(fieldString, errors)
	{
	    var root   = $(fieldString);
	    var list   = root.find('.format-me');
	    list.each(function (index, item) {
		if (item.dataset) {
		    var key     = item.dataset['key'];
		    var margin  = 15;
		    var colsize = 12;

		    var outerdiv = $("<div class='form-group' " +
				     "     style='margin-bottom: " + margin +
				     "px;'></div>");

		    if ($(item).attr('data-label')) {
			var label_text =
			    "<label for='" + key + "' " +
			    " class='col-sm-4 control-label'> " +
			    item.dataset['label'];
		    
			if ($(item).attr('data-help')) {
			    label_text = label_text +
				"<a href='#' class='btn btn-xs' " +
				" data-toggle='popover' " +
				" data-html='true' " +
				" data-delay='{\"hide\":1000}' " +
				" data-content='" +
				item.dataset['help'] + "'>" +
				"<span class='glyphicon " +
				"glyphicon-question-sign'>" +
				" </span></a>";
			}
			label_text = label_text + "</label>";
			outerdiv.append($(label_text));
			colsize = 6;
		    }
		    var innerdiv = $("<div class='col-sm-" +
				     colsize + "'></div>");
		    innerdiv.html($(item).clone());
		
		    if (errors && _.has(errors, key)) {
			outerdiv.addClass('has-error');
			innerdiv.append('<label class="control-label" ' +
					'for="inputError">' +
					_.escape(errors[key]) + '</label>');
		    }
		    outerdiv.append(innerdiv);
		    $(item).after(outerdiv);
		    $(item).remove();
		}
	    });
	    return root;
	}

	function HandleSubmit()
	{
	    /*
	     * If not a registered user, then continue takes them back.
	     */
	    if (!registered) {
		sup.HideModal('#ppmodal');
		if (callback_done) {
		    callback_done(null);
		}
		return;
	    }
	      
	    // Submit with check only at first, since this will return
	    // very fast, so no need to throw up a waitwait.
	    SubmitForm(1);
	}

	// Instantiate the new rspec on the chosen aggregate.
	function Instantiate(where)
	{	    
	    if (callback_done) {
		callback_done(RSPEC, where);
		return;
	    }
	    var callback = function(json) {
		sup.HideModal("#waitwait-modal");

		if (json.code) {
		    sup.SpitOops("oops", json.value);
		    return;
		}
		window.location.replace(json.value);
	    }
	    sup.ShowModal("#waitwait-modal");
	    var xmlthing = sup.CallServerMethod(null, "instantiate",
						"Instantiate",
						{"rspec"  : RSPEC,
						 "where"  : where,
						 "uuid"   : uuid});
	    xmlthing.done(callback);
	}

	//
	// Editor callback, returning the new rspec.
	//
	function EditorDone(newRspec)
	{
	    if (!amlist || amlist.length == 1) {
		Instantiate(amdefault);
	    }
	    var html = chooseTemplate({
		amlist    : amlist,
		amdefault : amdefault,
	    });
	    $('#instantiate_div').html(html);

	    // Handler for instantiate submit button, which is in
	    // the modal.
	    $('#stepsContainer .actions a[href="#finish"]').click(function (event) {
		event.preventDefault();
		Instantiate($('.aggregate_selector #profile_where option:selected').val());
		$('#instantiate_submit').click();
	    });
	}

	//
	// Editor canceled; put back the configure modal.
	//
	function EditorCancel()
	{
	    sup.ShowModal('#ppmodal');
	}
	
	//
	// Submit the form. If no errors, we get back the rspec. Throw that
	// up in a Jack editor window. 
	//
	function SubmitForm(checkonly)
	{
	    // Current form contents as formfields array.
	    var formfields  = {};
	
	    var callback = function(json) {
		if (!checkonly) {
		    sup.HideModal("#waitwait-modal");
		}
		if (json.code) {
		    if (checkonly && json.code == 2) {
			// Regenerate page with errors.
			GenerateModalBody(formfields, json.value);
			return;
		    }
		    sup.HideModal('#ppmodal');
		    $('#stepsContainer').steps('previous');
		    $('#stepsContainer-t-1').parent().addClass('error');
		    //sup.SpitOops("oops", json.value);
		    return;
		}
		if (checkonly) {
		    // Form checked out okay, submit again to generate rspec.
		    sup.HideModal('#ppmodal');
		    sup.ShowModal("#waitwait-modal");
		    SubmitForm(0);
		}
		else {
		    if (_.has(json.value, "amdefault")) {
			amdefault = json.value.amdefault;
		    }
		    // Got the rspec, show the editor.
		    RSPEC = json.value.rspec;
		    editor.show(json.value.rspec,
				EditorDone, EditorCancel, button_label);

		    EditorDone(editor.fetchXml());
		}
	    }
	    // Convert form data into formfields array, like all our
	    // form handler pages expect.
	    var fields = $('#pp_form').serializeArray();
	    $.each(fields, function(i, field) {
		formfields[field.name] = field.value;
	    });
	    // This clears any errors before new submit. Needs more thought.
	    GenerateModalBody(formfields, null);

	    var xmlthing = sup.CallServerMethod(null, "manage_profile",
						"BindParameters",
						{"formfields" : formfields,
						 "uuid"       : uuid,
						 "checkonly"  : checkonly});
	    xmlthing.done(callback);
	}

	function StartPP(args) {
		uuid = args.uuid;
	    registered = args.registered;
	    amlist = args.amlist;
	    amdefault = args.amdefault;
	    
	    if (bodyTemplate) {
		GenerateModalBody(defaults, null);
		//sup.ShowModal('#ppmodal');
		return;
	    }
	    // Caller might already have an editor instance.
	    editor = new JacksEditor($('#inline_jacks'), true, true, true, true);
	    // Callback; instead of instantiate, send rspec to callback.
	    if (_.has(args, "callback")) {
		callback_done = args.callback;
	    }
	    // Allow caller to change the Jacks accept button label.
	    if (_.has(args, "button_label")) {
		button_label = args.button_label;
	    }
	    
	    /*
	     * Need to ask for the profile parameter form fragment and
	     * the initial values.
	     */
	    var callback = function(json) {
		console.info(json);
		if (json.code) {
		    sup.SpitOops("oops", json.value);
		}
		defaults = json.value.defaults;
		// This is the modal.
		$('#stepsContainer-p-1').html(ppmodalString);
		// This is the form inside the modal
		bodyTemplate = _.template(ppbodyString);
		// This is the aggregate selector modal.
		chooseTemplate = _.template(chooserString);
		
		// Build a new template by inserting the form fragment, which
		// itself will refer to templated variables. 
		var html = bodyTemplate({
		    registered:         registered,
		    formfrag:		_.unescape(json.value.formfrag),
		});
		bodyTemplate = _.template(html);
		GenerateModalBody(defaults, null);
		//sup.ShowModal('#ppmodal');
	    }
	    var xmlthing = sup.CallServerMethod(null, "instantiate",
						"GetParameters",
						{"uuid"       : uuid});
	    xmlthing.done(callback);
	}

	function ChangeJacksRoot(root, selectionPane) {
	    editor = new JacksEditor(root, true, true, selectionPane, true);
	    editor.show(RSPEC,
				EditorDone, EditorCancel, button_label);
	}

	return {
		HandleSubmit: HandleSubmit,
		StartPP: StartPP,
		ChangeJacksRoot: ChangeJacksRoot,
	};
    }
);
