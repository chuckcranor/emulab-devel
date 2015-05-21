require(window.APT_OPTIONS.configObject,
	['underscore', 'js/quickvm_sup', 'moment', 'js/ppstart',
	 'js/lib/text!template/show-profile.html',
	 'js/lib/text!template/waitwait-modal.html',
	 'js/lib/text!template/renderer-modal.html',
	 'js/lib/text!template/showtopo-modal.html',
	 'js/lib/text!template/rspectextview-modal.html',
	 'js/lib/text!template/guest-instantiate.html',
	 'js/lib/text!template/instantiate-modal.html',
	 'js/lib/text!template/oops-modal.html',
	 'js/lib/text!template/share-modal.html',
	 // jQuery modules
	 'marked'],
function (_, sup, moment, ppstart,
	  showString, waitwaitString, 
	  rendererString, showtopoString, rspectextviewString,
	  guestInstantiateString, instantiateString, oopsString, shareString)
{
    'use strict';
    var profile_uuid = null;
    var version_uuid = null;
    var gotscript    = 0;
    var ajaxurl      = "";
    var amlist       = null;
    var isppprofile  = false;
    var myCodeMirror = null;
    var showTemplate      = _.template(showString);
    var InstTemplate      = _.template(instantiateString);
    var shareTemplate     = _.template(shareString);

    function initialize()
    {
	window.APT_OPTIONS.initialize(sup);
	version_uuid  = window.VERSION_UUID;
	profile_uuid  = window.PROFILE_UUID;
	ajaxurl       = window.AJAXURL;
	isppprofile   = window.ISPPPROFILE;

	var fields = JSON.parse(_.unescape($('#form-json')[0].textContent));
	amlist     = JSON.parse(_.unescape($('#amlist-json')[0].textContent));

	if (_.has(fields, "profile_script") && fields["profile_script"] != "") {
	    gotscript = 1;
	}
	
	// Generate the templates.
	var show_html   = showTemplate({
	    fields:		fields,
	    version_uuid:	version_uuid,
	    profile_uuid:	profile_uuid,
	    history:		window.HISTORY,
	    isadmin:		window.ISADMIN,
	    canedit:            window.CANEDIT,
	    withpublishing:     window.WITHPUBLISHING,
	});
	$('#page-body').html(show_html);

	$('#waitwait_div').html(waitwaitString);
	$('#showtopomodal_div').html(showtopoString);
	$('#guest_div').html(guestInstantiateString);
    	var instantiate_html = InstTemplate({ amlist: amlist,
					      amdefault: window.AMDEFAULT});
	$('#instantiate_div').html(instantiate_html);
	$('#rspectext_div').html(rspectextviewString);
	$('#oops_div').html(oopsString);
	$('#share_div').html(shareTemplate({formfields: fields}))

	// This activates the popover subsystem.
	$('[data-toggle="popover"]').popover({
	    trigger: 'hover',
	    placement: 'auto',
	    container: 'body'
	});
	
	// Format dates with moment before display.
	$('.format-date').each(function() {
	    var date = $.trim($(this).html());
	    if (date != "") {
		$(this).html(moment($(this).html()).format("lll"));
	    }
	});
	$('body').show();

	//
	// Show the visualizer.
	//
	$('#edit_topo_modal_button').click(function (event) {
	    event.preventDefault();
	    sup.ShowModal('#quickvm_topomodal');
	});
        $('#quickvm_topomodal').on('shown.bs.modal', function() {
	    sup.maketopmap("#showtopo_nopicker",
			   $('#profile_rspec_textarea').val(),
			   true, !window.ISADMIN);
        });
	
	// The Show Source button.
	$('#show_source_modal_button, #show_xml_modal_button')
	    .click(function (event) {
		var source = null;

		if ($(this).attr("id") == "show_source_modal_button") {
		    source = $.trim($('#profile_script_textarea').val());
		}
		if (!source || !source.length) {
		    source = $.trim($('#profile_rspec_textarea').val());
		}
		$('#rspec_modal_editbuttons').addClass("hidden");
		$('#rspec_modal_viewbuttons').removeClass("hidden");
		$('#modal_profile_rspec_textarea').prop("readonly", true);
		$('#modal_profile_rspec_textarea').val(source);
		$('#rspec_modal').modal({'backdrop':'static','keyboard':false});
		$('#rspec_modal').modal('show');
	    });
        $('#rspec_modal').on('shown.bs.modal', function() {
	    var source = $('#modal_profile_rspec_textarea').val();
	    var mode   = "text/xml";

	    // Need to determine the mode.
	    var myRe = /^import/m;
	    if (myRe.test(source)) {
		mode = "text/x-python";
	    }
	    myCodeMirror = CodeMirror(function(elt) {
		$('#modal_profile_rspec_div').prepend(elt);
	    }, {
		value: source,
                lineNumbers: false,
		smartIndent: true,
		autofocus: false,
		readOnly: true,
                mode: mode,
	    });
        });
	// Close the source/xml modal.
	$('#close_rspec_modal_button').click(function (event) {
	    $('#rspec_modal').modal('hide');
	    $('.CodeMirror').remove();
	    $('#modal_profile_rspec_textarea').val("");
	});

	/*
	 * The instantiate button. If a plain profile, throw up the
	 * confirm modal. If a parameterized profile, hand off to the
	 * ppstart js code.
	 */
	$('#profile_instantiate_button').click(function (event) {
	    if (true) {
		window.location.replace("instantiate.php?profile=" +
					version_uuid);
		return;
	    }
	    if (isppprofile) {
		ppstart({uuid       : version_uuid,
			 registered : true,
			 amlist     : amlist,
			 amdefault  : window.AMDEFAULT});
		return;
	    }
	    sup.ShowModal('#instantiate_modal');
	});
	// Handler for normal instantiate submit button, which is in
	// the modal.
	$('#instantiate_submit_button').click(function (event) {
	    event.preventDefault();
	    Instantiate();
	});
	
	/*
	 * Suck the description and instructions
	 * out of the rspec and put them into the text boxes.
	 */
	ExtractFromRspec();
	// We also got a geni-lib script, so show the XML button.
	if (gotscript) {
	    $('#show_xml_modal_button').removeClass("hidden");
	}
    }

    //
    // Instantiate a profile.
    //
    function Instantiate()
    {
	var callback = function(json) {
	    sup.HideModal("#waitwait-modal");
	    
	    if (json.code) {
		sup.SpitOops("oops", json.value);
		return;
	    }
	    window.location.replace(json.value);
	}
	sup.HideModal("#instantiate_modal");

	var blob = {"uuid" : version_uuid};
	if (amlist.length) {
	    blob.where = $('#instantiate_where').val();
	}
	sup.ShowModal("#waitwait-modal");
	var xmlthing = sup.CallServerMethod(ajaxurl,
					    "instantiate",
					    "Instantiate", blob);
	xmlthing.done(callback);
    }

    /*
     * We want to look for and pull out the introduction and overview text,
     * and put them into the text boxes. The user can edit them in the
     * boxes. More likely, they will not be in the rspec, and we have to
     * add them to the rspec_tour section.
     */
    function ExtractFromRspec()
    {
	var rspec  = $('#profile_rspec_textarea').val();
	var xmlDoc = parseXML(rspec);
	if (xmlDoc == null)
	    return;
	var xml    = $(xmlDoc);

	$('#profile_description').html("&nbsp");
	$('#profile_instructions').html("&nbsp");
	
	$(xml).find("rspec_tour > description").each(function() {
	    var text = $(this).text();
	    var marked = require("marked");
	    $('#profile_description').html(marked(text));
	});
	$(xml).find("rspec_tour > instructions").each(function() {
	    var text = $(this).text();
	    var marked = require("marked");
	    $('#profile_instructions').html(marked(text));
	});
    }

    function parseXML(rspec)
    {
	try {
	    var xmlDoc = $.parseXML(rspec);
	    return xmlDoc;
	}
	catch(err) {
	    alert("Could not parse XML!");
	    return -1;
	}
    }

    $(document).ready(initialize);
});
