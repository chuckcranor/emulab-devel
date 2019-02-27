$(function ()
{
    'use strict';

    var templates = APT_OPTIONS.fetchTemplateList(['show-profile', 'waitwait-modal', 'renderer-modal', 'showtopo-modal', 'rspectextview-modal', 'instantiate-modal', 'oops-modal', 'share-modal', 'copy-repobased-profile']);
    var showString = templates['show-profile'];
    var waitwaitString = templates['waitwait-modal'];
    var rendererString = templates['renderer-modal'];
    var showtopoString = templates['showtopo-modal'];
    var rspectextviewString = templates['rspectextview-modal'];
    var instantiateString = templates['instantiate-modal'];
    var oopsString = templates['oops-modal'];
    var shareString = templates['share-modal'];
    var copyrepoString = templates['copy-repobased-profile'];
  
    var profile_uuid = null;
    var profile_name = '';
    var profile_pid = '';
    var profile_version = '';
    var version_uuid = null;
    var gotrspec     = 0;
    var gotscript    = 0;
    var fromrepo     = 0;
    var ajaxurl      = "";
    var amlist       = null;
    var isppprofile  = false;
    var myCodeMirror = null;
    var showTemplate      = _.template(showString);
    var InstTemplate      = _.template(instantiateString);
    var shareTemplate     = _.template(shareString);
    var pythonRe = /^import/m;
    var tclRe    = /^source tb_compat/m;

    function initialize()
    {
	window.APT_OPTIONS.initialize(sup);
	version_uuid  = window.VERSION_UUID;
	profile_uuid  = window.PROFILE_UUID;
	ajaxurl       = window.AJAXURL;
	isppprofile   = window.ISPPPROFILE;

	// Standard option
	marked.setOptions({"sanitize" : true});

	var fields = JSON.parse(_.unescape($('#form-json')[0].textContent));
	amlist     = JSON.parse(_.unescape($('#amlist-json')[0].textContent));

	if (_.has(fields, "profile_rspec") && fields["profile_rspec"] != "") {
	    gotrspec = 1;
	}
	if (_.has(fields, "profile_script") && fields["profile_script"] != "") {
	    gotscript = 1;
	}
	
        // If this is an existing profile, stash the name/project
        if (_.has(fields, "profile_name")) {
	    profile_name = fields['profile_name'];
        }
        if (_.has(fields, "profile_pid")) {
	    profile_pid = fields['profile_pid'];
        }
        if (_.has(fields, "profile_version")) {
	    profile_version = fields['profile_version'];
        }
	if (_.has(fields, "profile_repourl") &&
	    fields["profile_repourl"] != "") {
	    fromrepo = 1;
	}
      
	// Generate the templates.
	var show_html   = showTemplate({
	    fields:		fields,
	    version_uuid:	version_uuid,
	    profile_uuid:	profile_uuid,
	    history:		window.HISTORY,
	    isadmin:		window.ISADMIN,
	    canedit:            window.CANEDIT,
	    disabled:           window.DISABLED,
	    withpublishing:     window.WITHPUBLISHING,
	    fromrepo:           fromrepo,
	    gotrspec:           gotrspec,
	    gotscript:          gotscript,
	});
	show_html = aptforms.FormatFormFieldsHorizontal(show_html,
							{"wide" : true});
	$('#page-body').html(show_html);

	$('#waitwait_div').html(waitwaitString);
	$('#showtopomodal_div').html(showtopoString);
    	var instantiate_html = InstTemplate({ amlist: amlist,
					      amdefault: window.AMDEFAULT});
	$('#instantiate_div').html(instantiate_html);
	$('#rspectext_div').html(rspectextviewString);
	$('#oops_div').html(oopsString);
	$('#copy_repobased_profile_div').html(copyrepoString);
	$('#share_div').html(shareTemplate({formfields: fields}))

	// Fireoff repo stuff now.
	if (fromrepo) {
	    SetupRepo();

	    // Handler for the copy repobased profile help modal.
	    // Need to fill in the URL.
	    $('#copy-repobased-profile-modal input')
		.val(fields["profile_repourl"]);
	    $('#copy-repobased-profile-modal .copy-to-clipboard')
		.click(function (e) {
		    e.preventDefault();
		    $('#copy-repobased-profile-modal .gitrepo-url').select();
		    document.execCommand("copy");
		});
	}
	
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
	        var isScript = true;
		var href   = "show-profile.php?uuid=" + profile_uuid;

	        source = $.trim($('#profile_script_textarea').val());
	        sup.DownloadOnClick($('#rspec_modal_download_button'),
				    function () { return source; },
				    'profile.py');
/*	        $('#rspec_modal_download_button')
		  .attr("href", href + "&source=true");*/
	        if (! source || ! source.length) {
		    isScript = false;
		}
	        if (isScript == false ||
		    $(this).attr("id") != "show_source_modal_button") {
		  
		    source = $.trim($('#profile_rspec_textarea').val());
	            sup.DownloadOnClick($('#rspec_modal_download_button'),
				        function () { return source; },
				        'profile.xml');
//		    $('#rspec_modal_download_button')
//		      .attr("href", href + "&rspec=true");
		}
	        if ($(this).attr("id") == "show_source_modal_button" &&
		    isScript && !fromrepo) {
		    openEditor(source);
		}
	        else
	        {
		    if (!source || !source.length) {
		    }
		    $('#rspec_modal_editbuttons').addClass("hidden");
		    $('#rspec_modal_viewbuttons').removeClass("hidden");
		    $('#modal_profile_rspec_textarea').prop("readonly", true);
		    $('#modal_profile_rspec_textarea').val(source);
		    $('#rspec_modal').modal({'backdrop':'static','keyboard':false});
		    $('#rspec_modal').modal('show');
		}
	    });
        $('#rspec_modal').on('shown.bs.modal', function() {
	    var source = $('#modal_profile_rspec_textarea').val();
	    var mode   = "text/xml";

	    // Need to determine the mode.
	    if (pythonRe.test(source)) {
		mode = "text/x-python";
	    }
	    else if (tclRe.test(source)) {
		mode = "text/x-tcl";
	    }
	    myCodeMirror = CodeMirror(function(elt) {
		$('#modal_profile_rspec_div').prepend(elt);
	    }, {
		value: source,
                lineNumbers: true,
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
	 * The instantiate button.
	 */
	$('#profile_instantiate_button').click(function (event) {
	    window.location.replace("instantiate.php?profile=" +
				    version_uuid + "&from=show-profile");
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
	    $('#profile_description').html(marked(text));
	});
	$(xml).find("rspec_tour > instructions").each(function() {
	    var text = $(this).text();
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

    function openEditor(source)
    {
        window.SHOW_GENILIB_EDITOR(source, null, true, profile_uuid);
    }

    function SetupRepo()
    {
	gitrepo.InitRepoPicker(version_uuid, null,
			       function(which) {
				   SelectRepoTarget(which);
			       });
    }
    /*
     * User has clicked on a branch/tag. We need to get that branch/tag
     * source code and update the page.
     */
    function SelectRepoTarget(which)
    {
	var callback = function (source, hash) {
	    console.info(source);

	    // Need to put the source into correct hidden textarea.
	    // But if its a script, we have to convert it first.
	    if (pythonRe.test(source)) {
		$('#profile_script_textarea').val(source);
		ConvertScript(source);
	    }
	    else {
		$('#profile_rspec_textarea').val(source);
		ExtractFromRspec();
	    }
	};
	gitrepo.GetRepoSource(version_uuid, which, callback);
    }

    //
    // Pass a geni-lib script to the server to run (convert to XML).
    //
    function ConvertScript(script)
    {
	// Save for later.
	$('#profile_script_textarea').val(script);

	var callback = function(json) {
	    sup.HideWaitWait();
	    //console.info(json.value);

	    if (json.code) {
		sup.SpitOops("oops",
			     "<pre><code>" +
			     $('<div/>').text(json.value).html() +
			     "</code></pre>");
		return;
	    }
	    if (json.value.rspec != "") {
		$('#profile_rspec_textarea').val(json.value.rspec);
		ExtractFromRspec();
	    }
	}
	sup.ShowWaitWait("We are converting the geni-lib script");
	var xmlthing = sup.CallServerMethod(ajaxurl,
					    "manage_profile",
					    "CheckScript",
					    {"script"   : script,
					     "profile_uuid" : profile_uuid});
	xmlthing.done(callback);
    }
    
    $(document).ready(initialize);
});
