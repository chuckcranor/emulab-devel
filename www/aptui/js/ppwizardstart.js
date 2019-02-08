//
// Start a Parameterized Profile
//
$(function () {
  window.ppstart = (function()
    {
	'use strict';

        var templates = APT_OPTIONS.fetchTemplateList(['ppform-wizard', 'ppform-wizard-body', 'choose-am', 'image-picker-modal']);
        var ppmodalString = templates['ppform-wizard'];
        var ppbodyString = templates['ppform-wizard-body'];
        var chooserString = templates['choose-am'];
        var imagePickerString = templates['image-picker-modal'];
	var bodyTemplate  = null;
	var chooseTemplate= null;
	var editor        = null;
	var editorLarge   = null;
	var defaults      = null;
	var ppdivname     = null;
	var uuid          = "";
	var registered    = true;
	var multisite     = 0;
	var RSPEC	  = null;
	var configuredone_callback = null;
        var warningsfatal = 1;
        var imagePicker = null;

	//
	// Moved into a separate function since we want to regen the form
	// after each submit, which happens via ajax on this page. 
	//
	function GenerateModalBody(formfields, errors){
	    // Generate the template.
	    var html = bodyTemplate({
		formfields:		formfields,
	    });

	    $('#ppmodal-body').empty();
	    formatter(html, errors, $('#ppmodal-body'));
	    if (!registered) {
		$('#pp_form :input').attr('readonly', true);
		// This is the only way to disable selects
		$('#pp_form :input').attr('disabled', true);
		// Have to renable the buttons after disabling selects
		$('#pp_form :button').attr('disabled', false);
		$('#pp_form :button').attr('readonly', false);
	    }
	    imagePicker = new jacksmod.ImagePicker();
	    $('#image-picker-body').html(imagePickerString);
	    $('#imagepicker-modal .modal-body > div').append(imagePicker.el);
	  
	    //
	    // Handle submit button.
	    //
	    $('#modal_profile_continue_button').click(function (event) {
		event.preventDefault();
		HandleSubmit();
	    });

	    //
	    // Handle the toggle-all help panels link.  Bootstrap
	    // doesn't give us a simple way to collapse multiple panels
	    // unless they're in an accordion... so do it the
	    // old-fashioned way, manual modal state in a hidden div.
	    //
	    $('#pp-param-help-panel-toggle-link').on('click',function() {
		//event.preventDefault();
		var state = $('#pp-param-help-panel-toggle-state').html();
		var list = document.getElementsByClassName("pp-param-help-panel");
		for (var i = 0; i < list.length; ++i) {
		    if (state == 'opened') {
			$(list[i]).collapse('hide');
		    }
		    else {
			$(list[i]).collapse('show');
		    }
		}

		if (state == 'opened') {
		    $('#pp-param-help-panel-toggle-state').html('closed');
		    $('#pp-param-help-panel-toggle-link-span').html('&nbsp;&nbsp; Show All Parameter Help');
		    $('#pp-param-help-panel-toggle-glyph-span').removeClass('glyphicon-minus-sign');
		    $('#pp-param-help-panel-toggle-glyph-span').addClass('glyphicon-plus-sign');
		}
		else {
		    $('#pp-param-help-panel-toggle-state').html('opened');
		    $('#pp-param-help-panel-toggle-link-span').html('&nbsp;&nbsp; Hide All Parameter Help');
		    $('#pp-param-help-panel-toggle-glyph-span').removeClass('glyphicon-plus-sign');
		    $('#pp-param-help-panel-toggle-glyph-span').addClass('glyphicon-minus-sign');
		}

		// Now open all the param group panels, in case they have help:
		list = $('#ppmodal-body').find(".pp-param-group-subpanel-collapse");
		for (var i = 0; i < list.length; ++i) {
		    $(list[i]).collapse('show');
		}
	    });
	}

	// Formatter for the form. This did not work out nicely at all!
	function formatter(fieldString, errors, parent)
	  {
	    var root   = $(fieldString);
	    parent.append(root);
	    var list   = root.find('.format-me');
	    var form   = root.find('#pp_form');
	    var hasHelp = false;
	    var groupNames = new Array();
	    var groupsWithErrors = new Array();
	    var groupErrorOpenerScript = "";
	    var numTypeErrors = 0;
	    var numParameterErrors = 0;
	    var numOtherErrors = 0;
	    var otherErrorText = "";
	    var numParameterWarnings = 0;
	    var numOtherWarnings = 0;
	    var otherWarningText = "";
	    var fixedValuesChanges = 0;

	    // Compute the general warning and error message text now.
	    if (Array.isArray(errors)) {
		for (var i = 0; i < errors.length; ++i) {
		    var error = errors[i];
		    if (error.hasOwnProperty('errorType')) {
			if (error['errorType'] == 'ParameterWarning')
			    ++numParameterWarnings;
			else if (error['errorType'] == 'ParameterError')
			    ++numParameterErrors;
			else if (error['errorType'].endsWith('Warning')) {
			    ++numOtherWarnings;
			    if (numOtherWarnings > 1)
				otherWarningText += "<br>";
			    otherWarningText += '<b>' + error['errorType'] +
				'</b>: ' + error['message'];
			}
			else if (error['errorType'].endsWith('Error')) {
			    ++numOtherErrors;
			    if (numOtherErrors > 1)
				otherErrorText += "<br>";
			    otherErrorText += '<b>' + error['errorType'] +
				'</b>: ' + error['message'];
			}
			else {
			    // For this one, we rely on the fact that
			    // this came to us as JSON data, so it must
			    // be JSON-stringifiable!
			    ++numOtherErrors;
			    if (numOtherErrors > 1)
				otherErrorText += "<br>";
			    otherErrorText += '<b>' + error['errorType'] +
				'</b>: "' + JSON.stringify(error) + '"';
			}
		    }
		    else {
			// For this one, we rely on the fact that this
			// came to us as JSON data, so it must be
			// JSON-stringifiable!
			++numOtherErrors;
			if (numOtherErrors > 1)
			    otherErrorText += "<br>";
			otherErrorText += '<b>Unrecognized Error</b>: "' +
			    JSON.stringify(error) + '"';
		    }
		}
	    }

	    list.each(function (index, item) {
		if (item.dataset) {
		    var key     = item.dataset['key'];
		    var margin  = 15;
		    var colsize = 12;

		    var outerdiv = $("<div class='form-group' " +
				     "     style='margin-bottom: " + margin +
				     "px;'></div>");
		    var help_panel = "";
		    var glParamErrors = new Array();
		    var glParamWarnings = new Array();
		    var groupId = null;
		    var pDiv;
		    var changeMsg = "";

		    if (Array.isArray(errors)) {
			// Check to see if any of these errors are
			// geni-lib ParameterErrors or
			// ParameterWarnings, for this key.  Note, we
			// only loop through the numeric keys of this
			// array, because we're expecting a bare JSON
			// list of dictionaries, each describing an
			// error.
			for (var i = 0; i < errors.length; ++i) {
			    var error = errors[i];

			    if (!error.hasOwnProperty('params')
				|| !Array.isArray(error['params'])
				|| error['params'].indexOf(key) == -1)
				continue;

			    if (error.hasOwnProperty('errorType')
				&& error['errorType'] == 'ParameterWarning') {
				glParamWarnings.push(error);
			    }
			    // Note, we don't worry about errorType for
			    // this check; assume the message is an error for
			    // this param.
			    else {
				glParamErrors.push(error);
			    }

			    // Maybe change form values if the error/warning
			    // suggests a fixedValue.
			    if (error.hasOwnProperty('fixedValues')) {
				jQuery.each(error['fixedValues'],function(k,v) {
				    var oldV = null;

				    // If we're not changing the value
				    // for this param, don't mention it
				    // here -- only mention changes
				    // right beside that specific
				    // parameter.
				    if (k != key)
					return;

				    //
				    // Well, this sucks.  We can't just
				    // change the element values via
				    // $(elm).val(foo).  Have to
				    // actually change the HTML attrs.
				    //
				    if ($(item).prop('tagName') == 'SELECT') {
					oldV = $(item).val();
					var sch = $(item).children();
					for (var j = 0; j < sch.length; ++j) {
					    var opt = $(sch[j]);
					    // get rid of anything selected
					    if (opt.attr('selected'))
						opt.attr('selected',null);
					    // select only the new fixed value
					    if (opt.attr('value') == v)
						opt.attr('selected',true);
					}
				    }
				    else if ($(item).prop('tagName') == 'INPUT'
					     && $(item).attr('type') == 'text') {
					oldV = $(item).val();
					$(item).attr('value',v);
				    }
				    else if (item.dataset['type'] && item.dataset['type'] == 'image')
				    {
				        oldV = $(item).find('input#image-value').val();
				      $(item).find('input#image-value').val(v);
				      $(item).find('input#image-display').val(imageDisplay(v));
				    }
				    else if ($(item).prop('tagName') == 'INPUT'
					     && $(item).attr('type') == 'checkbox') {
					oldV = $(item).val();
					if (v)
					    $(item).attr('checked',true);
					else
					    $(item).attr('checked',null);
				    }
				    else {
					// we don't have any other
					// elements currently being
					// generated in
					// profile_defs.php, so forget
					// it for now.
					;
				    }

				    // Ok, did we change something?
				    if (oldV != null) {
					++fixedValuesChanges;
					if (changeMsg)
					    changeMsg += "<br>";
					changeMsg += '<b><span class="glyphicon glyphicon-exclamation-sign"></span>&nbsp;' +
					    ' We changed the value of "' +
					    item.dataset['label'] + '" from "' +
					    oldV + '" to "' + v + '", because ' +
					    ' the profile\'s geni-lib script ' +
					    ' suggested it to resolve the' +
					    ' problem.</b>';
				    }
				});
			    }
			}
		    }

		    if ($(item).attr('pp-param-group')
			&& !groupNames.hasOwnProperty($(item).attr('pp-param-group'))) {
			// This item is part of a group.  So, we process
			// it like usual, but we have to shove it off
			// into the right collapsable group panel.  If
			// the panel doesn't exist yet, we have to
			// create it.
			groupId = $(item).attr('pp-param-group');
			var groupName;
			if ($(item).attr('pp-param-group-name')) {
			    groupName = $(item).attr('pp-param-group-name');
			    groupNames[groupId] = groupName;
			}
			else {
			    groupName = groupId;
			    groupNames[groupId] = null;
			}

			pDiv = $('<div class="row">' +
				 '<div class="col-xs-offset-0">' +
				 '<div id="pp-param-group-panel-' + groupId + '"' +
				 '     class="panel" style="border-width: 0px; border: none; box-shadow: none;">' +
				 '<div class="panel-heading">' +
				 '<h5>' +
				 '<a id="pp-param-group-link-' + groupId + '"' +
				 '   href="#pp-param-group-subpanel-' + groupId + '"' +
				 '  data-toggle="collapse">' +
				 '<span class="glyphicon glyphicon-plus-sign pull-left"' +
				 '      style="font-weight: bold;"></span>' +
				 '<span style="font-weight: bold;">&nbsp;&nbsp; ' + groupName + '</span>' +
				 '</a>' +
				 '</h5>' +
				 '</div>' +
				 '<div id="pp-param-group-subpanel-' + groupId + '"' +
				 '     class="panel-collapse collapse pp-param-group-subpanel-collapse"' +
				 '     style="height: auto;">' +
				 '<div id="pp-param-group-subpanel-body-' + groupId + '"' +
				 '     class="panel-body"></div>' +
				 '</div></div></div></div>');

			form.append(pDiv);
		    }
		    else if ($(item).attr('pp-param-group')) {
			groupId = $(item).attr('pp-param-group');
			if (groupNames[groupId] == null && $(item).attr('pp-param-group-name')) {
			    groupNames[groupId] = $(item).attr('pp-param-group-name');
			}
		    }

		    if ((glParamErrors.length > 0
			 || glParamWarnings.length > 0
			 || changeMsg != "")
			&& !groupsWithErrors.hasOwnProperty(groupId)) {
			groupsWithErrors[groupId] = 1;
			groupErrorOpenerScript += '<script>' +
			    '$("#pp-param-group-subpanel-' + groupId + '")' +
			    '.collapse("show");' +
			    '</script>';
		    }

		    if ($(item).attr('data-label')) {
			var label_text =
			    "<label for='" + key + "' " +
			    " class='col-sm-4 control-label'> " +
			    item.dataset['label'];
		    
			if ($(item).attr('data-help')) {
			    var help_panel_url = key + "_help_subpanel_collapse";
			    label_text = label_text +
				"<span class='pp-param-popover' " +
				" data-toggle='popover' " +
				" data-trigger='hover' " +
				//" data-delay='{\"hide\":1000}' " +
				" data-content='" + item.dataset['help'] + "'>" +
				" <a href='#" + help_panel_url + "'" +
				" data-toggle='collapse'>" +
				"<i class='glyphicon glyphicon-question-sign'></i>" +
				"</a></span>";
			    var help_panel_id = key + "_help_subpanel_collapse";
			    help_panel = 
				"<div id='" + help_panel_id + "'" +
				"     class='panel-collapse collapse panel panel-info col-sm-9 pp-param-help-panel'" +
				"     style='background-color: #e6f6fa; height: auto; margin: auto; margin-left: 5%; margin-top: 0px; margin-bottom: 15px; padding: 10px;' data-toggle='collapse'>" +
				item.dataset['help'] + "</div>";

			    hasHelp = true;
			}
			label_text = label_text + "</label>";
			outerdiv.append($(label_text));
			colsize = 6;
		    }
		    var innerdiv = $("<div class='col-sm-" +
				     colsize + "'></div>");
		    var clone = $(item).clone();
		    if (item.dataset['type'] && item.dataset['type'] == 'image')
		    {
		        initImagePicker(clone);
		    }
		    innerdiv.html(clone);

		    // Handle the easy type-checked errors from the PHP/ajax call.
		    if (errors && _.has(errors, key)) {
			outerdiv.addClass('has-error');
			innerdiv.append('<label class="control-label" ' +
					'for="inputError">' +
					_.escape(errors[key]) + '</label>');
		    }
		    else {
			if (glParamErrors.length > 0) {
			    var errorMsg = "";

			    for (var i = 0; i < glParamErrors.length; ++i) {
				var error = glParamErrors[i];

				if (errorMsg)
				    errorMsg += "<br>";

				errorMsg += error['errorType'] + ": " +
				    error['message'];
			    }

			    outerdiv.addClass('has-error');
			    innerdiv.append('<label class="control-label" ' +
					    'for="inputError">' +
					    errorMsg + '</label>');
			}
			if (glParamWarnings.length > 0) {
			    var warningMsg = "";

			    for (var i = 0; i < glParamWarnings.length; ++i) {
				var warning = glParamWarnings[i];

				if (warningMsg)
				    warningMsg += "<br>";

				warningMsg += warning['errorType'] + ": " +
				    warning['message'];
			    }

			    outerdiv.addClass('has-warning');
			    innerdiv.append('<label class="control-label" ' +
					    'for="inputWarning">' +
					    warningMsg + '</label>');
			}
			if (changeMsg != "") {
			    innerdiv.append('<br><label class="control-label" ' +
					    'for="inputWarning">' +
					    changeMsg + '</label>');
			}
		    }

		    // Ok, now slot the new form element (outerdiv) into
		    // the right panel.  If it's not in a panel group,
		    // then just do the regular thing; otherwise, put it
		    // in its panel.
		    if (groupId != null) {
			outerdiv.append(innerdiv);
			var pInnerDiv = 
			    root.find('#pp-param-group-subpanel-body-' + groupId);
			pInnerDiv.append(outerdiv);
			pInnerDiv.append(help_panel);
			$(item).remove();
		    }
		    else {
			outerdiv.append(innerdiv);
			// Do these in reverse order, because of .after!  In
			// this order, outerdiv first, then help_panel.
			$(item).after(help_panel);
			$(item).after(outerdiv);
			$(item).remove();
		    }
		}
	    });
	    // Setup the help-all toggle, if there were help items.
	    if (hasHelp) {
		root.prepend('<div id="pp-param-help-panel-toggle-state" ' +
			     '     style="display: none">closed</div>' +
			     '<div class="row">' +
			     '<div class="col-sm-12">' +
			     '<div id="help_show_all_panel" class="panel" ' +
			     '     style="border-width: 0px; border: none; box-shadow: none;">' +
			     '<h5>' +
			     '<a id="pp-param-help-panel-toggle-link" href="#">' +
			     '<span id="pp-param-help-panel-toggle-glyph-span" ' +
			     '      class="glyphicon glyphicon-plus-sign pull-left" style="font-weight: bold; "></span>' +
			    '<span id="pp-param-help-panel-toggle-link-span" ' +
			     '     style="font-weight: bold; ">' +
			     '&nbsp;&nbsp; Show All Parameter Help</span>' +
			     '</a>' +
			     '</h5>' +
			     '</div></div></div>');
	    }
	    // Show primary error and warning notifications, and changes!
	    if (fixedValuesChanges > 0) {
		var ht =
		    '<div class="row">' +
		    '<div class="col-sm-12">' +
		    '<div id="pp-param-changes-panel" ' +
		    '     class="panel panel-success">' +
		    '<div class="panel-heading">' +
		    'We changed ' + fixedValuesChanges + ' item ';
		if (fixedValuesChanges > 1)
		    ht += 'values';
		else
		    ht += 'value';
		ht += ' in response to these bad parameter values, because' +
		    " this profile's geni-lib script suggested they would" +
		    ' help.  Please check them.';
		ht += '</div></div></div></div>';
		root.prepend(ht);
	    }
	    if (numParameterWarnings > 0 || numOtherWarnings > 0) {
		var ht = "";

		if (numOtherWarnings > 0)
		    ht += otherWarningText;

		if (numParameterWarnings > 1) {
		    if (ht != "")
			ht += '<br>';
		    ht += '<b>There were ' + numParameterWarnings +
			' ParameterWarnings</b>.  Please check the warning' +
			' messages near each affected parameter; you will' +
			' <b>not</b> be notified about subsequent warnings.';
		}
		else if (numParameterWarnings > 0) {
		    if (ht != "")
			ht += '<br>';
		    ht += '<b>There was 1 ParameterWarning</b>.  Please check' +
			' the warning message near the affected parameter; you' +
			' will <b>not</b> be notified about subsequent warnings.';
		}

		ht = '<div class="row">' +
		    '<div class="col-sm-12">' +
		    '<div id="pp-param-warning-panel" ' +
		    '     class="panel panel-warning">' +
		    '<div class="panel-heading">' +
		    ht + '</div></div></div></div>';
		root.prepend(ht);
	    }
	    if (numTypeErrors > 0
		|| numParameterErrors > 0
		|| numOtherErrors > 0) {
		var ht = "";

		if (numOtherErrors > 0)
		    ht += otherErrorText;

		if (numParameterErrors > 1) {
		    if (ht != "")
			ht += '<br>';
		    ht += '<b>There were ' + numParameterErrors +
			' ParameterErrors</b>.  Please check the error' +
			' messages near each affected parameter and fix the' +
			' errors.';
		}
		else if (numParameterErrors > 0) {
		    if (ht != "")
			ht += '<br>';
		    ht += '<b>There was 1 ParameterError</b>.  Please check' +
			' the error message near the affected parameter and' +
			' fix it.';
		}

		ht = '<div class="row">' +
		    '<div class="col-sm-12">' +
		    '<div id="pp-param-error-panel" class="panel panel-danger">' +
		    '<div class="panel-heading">' +
		    ht + '</div></div></div></div>';
		root.prepend(ht);
	    }
	    // Tell Bootstrap to initialize the popovers
	    root.append('<script>$(document).ready(function(){$("[data-toggle=\'popover\']").popover();});</script>');
	    // Make sure group panels with errors are open, not closed.
	    root.append(groupErrorOpenerScript);
	    return root;
	}

        function HandleSubmit(callback, jacksGraphCallback)
	{
	    /*
	     * If not a registered user, then continue takes them back.
	     */
	    if (!registered) {
		// Need this timeout so that the steps container code runs.
                setTimeout(function f() { 
                              callback(true);
		              ShowEditor();
			      ConfigureDone();
                           }, 200);
		return;
	    }
	      
	    // Submit with check only at first, since this will return
	    // very fast, so no need to throw up a waitwait.
	  SubmitForm(1, callback, jacksGraphCallback);
	}

	//
	// Configuration is done, we have the new rspec.
	//
	function ConfigureDone()
	{
	    // warnings are fatal again if they go backwards
	    warningsfatal = 1;

	    configuredone_callback(RSPEC);
	}

	//
	// Submit the form. If no errors, we get back the rspec. Throw that
	// up in a Jack editor window. 
	//
        function SubmitForm(checkonly, steps_callback, jacksGraphCallback)
	{
	    // Current form contents as formfields array.
	    var formfields  = {};
	
 	    var callback = function(json) {
		if (!checkonly) {
		    sup.HideModal("#waitwait-modal");
		}
		if (json.code) {
		    if (checkonly && json.code == 2) {
			// Regenerate page with errors from the PHP fast
			// type-checking code.
			GenerateModalBody(formfields, json.value);
		    }
		    else {
			var newjsonval = null;
			var ex;

			//
			// If geni-lib scripts error out, they can
			// return a JSON list of errors and warnings.
			// So, if the json.value return bits can be
			// parsed by JSON.parse, assume they have
			// meaning.
			//
			try {
			    newjsonval = JSON.parse(json.value);
			}
			catch (ex) {
			    newjsonval = null;
			}

			if (newjsonval != null) {
			    // Disable first-time warnings; too complicated
			    // to track which values caused warnings and have
			    // been changed...
			    warningsfatal = 0;

			    // These *are* the droids we are looking for...
			    GenerateModalBody(formfields, newjsonval);
			}
			else {
			    sup.SpitOops("oops", json.value);
			}
		    }
		    steps_callback(false);
		    return;
		}
		if (checkonly) {
		    // Form checked out okay, submit again to generate rspec.
		    SubmitForm(0, steps_callback, jacksGraphCallback);
		}
		else {
		    RSPEC = json.value.rspec;
		    ConfigureDone();
		    // Must be after the callback, so that any changes to
		    // the aggregate selector is reflected in the final tab
		    steps_callback(true);
		    ShowThumbnail(RSPEC, jacksGraphCallback);
		    //ShowEditor();
		}
	    }
	    // Convert form data into formfields array, like all our
	    // form handler pages expect.
	    var fields = $('#pp_form').serializeArray();
	    console.info("fields", fields);
	    $.each(fields, function(i, field) {
		formfields[field.name] = field.value;
	    });
	    // Add back any unchecked inputs with "" values, since
	    // serializeArray() does not include un"successful" elements
	    // (see https://api.jquery.com/serializeArray/ and
	    // https://www.w3.org/TR/html401/interact/forms.html#h-17.13.2)
	    var input_fields = $('#pp_form').closest('form').find("input:checkbox:not(:checked)");
	    $.each(input_fields,function(i,field) {
		formfields[field.name] = "";
	    });
	    // This clears any errors before new submit. Needs more thought.
	    GenerateModalBody(formfields, null);

	    //
	    // XXX: Look for paramdefs/script in the main form and pass along.
	    // This is for repo-based profiles.
	    //
	    if ($('#paramdefs').val() !== undefined) {
		formfields["paramdefs"] = $('#paramdefs').val();
		formfields["script"]    = $('#script_textarea').val();
	    }
	    console.info("formfields", formfields);

	    // Not in checkform mode, this will take time.
	    if (!checkonly) {
		sup.ShowModal("#waitwait-modal");
	    }
	    var xmlthing =
		sup.CallServerMethod(null, "manage_profile",
				     "BindParameters",
				     {"formfields" : formfields,
				      "uuid"       : uuid,
				      "checkonly"  : checkonly,
				      "warningsfatal": warningsfatal});
	    xmlthing.done(callback);
	}

	function countNodes()
	{
	    console.info("countNodes");
	    var xmlDoc = $.parseXML(RSPEC);
	    var count  = $(xmlDoc).find("node").length;
	    console.info(count);
	    return count;
	}

	function StartPP(args) {
	    registered = args.registered;
	    multisite = args.multisite;
	    ppdivname = args.ppdivname;
	    
	    if (bodyTemplate && uuid == args.uuid) {
		GenerateModalBody(defaults, null);
		//sup.ShowModal('#ppmodal');
		return;
	    }
	    // Caller might already have an editor instance.
	    //editor = new JacksEditor($('#inline_jacks'), true, true,
		//		     true, true, !multisite);
	    configuredone_callback = args.callback;
	    
	    /*
	     * Need to ask for the profile parameter form fragment and
	     * the initial values.
	     */
	    var callback = function(json) {
		if (json.code) {
		    sup.SpitOops("oops", json.value);
		}
		defaults = json.value.defaults;
		// Insert into the provided container.
		$('#' + ppdivname).html(ppmodalString);
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
		uuid = args.uuid;
		if (args.rspec) {
		    RSPEC = args.rspec;
		    ConfigureDone();
		    //ShowEditor();
		    ShowThumbnail(RSPEC, args.jacksGraphCallback);
		}
	    }
	    var blob = {"uuid" : args.uuid};
	    //
	    // XXX: Look for paramdefs/script in the form and pass that along.
	    // This is for repo-based profiles.
	    //
	    if ($('#paramdefs').val() !== undefined) {
		blob["paramdefs"] = $('#paramdefs').val();
	    }
	    var xmlthing = sup.CallServerMethod(null, "instantiate",
						"GetParameters", blob);
	    xmlthing.done(callback);
	}

      var thumbnail = null;
      var jacksGraphCallback = null;
      function ShowThumbnail(selected_rspec, updateJacksGraph)
      {
	jacksGraphCallback = updateJacksGraph;
	var root = $('#stepsContainer-p-2 #inline_jacks');
	if (! thumbnail)
	{
	  thumbnail = new jacksmod.Thumb(setJacksGraph);
	  root.append(thumbnail.el);
	}
	thumbnail.replaceRspec(selected_rspec);
	if (countNodes() > 100)
	{
	  $('#stepsContainer #inline_overlay').addClass("hidden");
	}
	else
	{
	  $('#stepsContainer #inline_overlay').removeClass("hidden");
	}
	
      }

      function setJacksGraph(newGraph)
      {
	console.log('setJacksGraph');
	if (jacksGraphCallback)
	{
	  console.log('jacksGraphCallback');
	  jacksGraphCallback(newGraph);
	}
      }
 

	function ChangeJacksRoot(root, selectionPane) {
	  // console.info("ChangeJacksRoot: ", root, selectionPane);
	  if (RSPEC)
	    {
	      if (countNodes() > 100) {
		  $('#stepsContainer #inline_overlay').addClass("hidden");
		  $('#inline_jacks #edit_dialog #edit_container')
		      .addClass("hidden");
		  return;
	      }
	      else {
		  $('#stepsContainer #inline_overlay').removeClass("hidden");
		  $('#inline_jacks #edit_dialog #edit_container')
		      .removeClass("hidden");
	      }
	      editor = new JacksEditor(root, true, true, selectionPane, true);
	      editor.show(RSPEC);
	  }
	}
	function ShowEditor() {
	  // console.info("ShowEditor");
	  if (RSPEC)
	  {
//	      if (countNodes() > 100) {
//		  $('#stepsContainer #inline_overlay').addClass("hidden");
//		  $('#inline_jacks #edit_dialog #edit_container')
//		      .addClass("hidden");
//		  return;
//	      }
//	      else {
		  $('#stepsContainer #inline_overlay').removeClass("hidden");
		  $('#inline_jacks #edit_dialog #edit_container')
		      .removeClass("hidden");
//	      }
	      editor.show(RSPEC);
	  }
	}

      var globalImages = [
	{
	  urn: 'urn:publicid:IDN+emulab.net+image+emulab-ops//UBUNTU16-64-STD',
	  version: '',
	  description: 'Ubuntu 16.04 standard image'
	},
	{
	  urn: 'urn:publicid:IDN+emulab.net+image+emulab-ops//UBUNTU14-64-STD',
	  version: '',
	  description: 'Ubuntu 14.04 standard image'
	},
	{
	  urn: 'urn:publicid:IDN+emulab.net+image+emulab-ops//CENTOS66-64-STD',
	  version: '',
	  description: 'CentOS 6.6 standard image'
	},
	{
	  urn: 'urn:publicid:IDN+emulab.net+image+emulab-ops//CENTOS71-64-STD',
	  version: '',
	  description: 'CentOS 7.1 standard image'
	},
      	{
	  urn: 'urn:publicid:IDN+emulab.net+image+emulab-ops//FBSD103-64-STD',
	  version: '',
	  description: 'FreeBSD 10.3 standard image'
	},
      ];
      var userImages = [
	{
	  urn: 'urn:publicid:IDN+emulab.net+image+testbed//JONS_COOL_IMAGE',
	  version: '45ac6de',
	  description: 'This image is super cool because it was created in an awesome fashion. You should totally pick this image, dood.'
	},
	{
	  urn: 'urn:publicid:IDN+emulab.net+image+testbed//JONS_BAD_HAIR_DAY_IMAGE',
	  version: 'deadbe4f',
	  description: 'You don\'t want this image, man. It was created under a bad moon in the middle of a total solar eclipse and is cursed for all time.'
	},
      ];
      
        function initImagePicker(dom) {
	  dom.find('button#image-select').click(function (event) {
	    var callback = function(json) {
	      $('#waitwait-modal').modal('hide');

	      if (json.code == 0) {
		sup.ShowModal('#imagepicker-modal');
		imagePicker.pick(dom.find('input#image-value').val(), json.value[0]);
	      } else {
		sup.SpitOops('oops', json.value);
	      }
	    }
	    $('#waitwait-modal').modal('show');
	    var xmlthing = sup.CallServerMethod(null, "instantiate", "GetImageList");
	    xmlthing.done(callback);

	    
	    var closeFunction = function () {
	      imagePicker.off('selected');
	      imagePicker.off('closed');
	      sup.HideModal('#imagepicker-modal');
	    };
	    imagePicker.on('selected', function (item) {
	      dom.find('input#image-value').val(item);
	      dom.find('input#image-display').val(imageDisplay(item));
	      closeFunction();
	    });
	    imagePicker.on('closed', closeFunction);
	    $('#imagepicker-modal .modal-header button.close').on('click', closeFunction);	    
	    event.preventDefault();
	  });
        }

      function imageDisplay(v) {
	var sp = v.split('+');
	var display;
	if (sp.length >= 4)
	{
	  if (sp[3].substr(0, 12) == 'emulab-ops//')
	  {
	    display = sp[3].substr(12);
	  }
	  else
	  {
	    display = sp[3];
	  }
	}
	else
	{
	  display = v;
	}
	return display;
      }
      
	return {
		HandleSubmit: HandleSubmit,
		StartPP: StartPP,
	        ChangeJacksRoot: ChangeJacksRoot,
	        ShowThumbnail: ShowThumbnail,
	};
    }
)();
});
