$(function ()
{
    'use strict';

    var templates = APT_OPTIONS.fetchTemplateList(['show-profile', 'waitwait-modal', 'renderer-modal', 'rspectextview-modal', 'oops-modal', 'share-modal', 'copy-repobased-profile', "showtopo-modal"]);
    var showString = templates['show-profile'];
    var waitwaitString = templates['waitwait-modal'];
    var rendererString = templates['renderer-modal'];
    var rspectextviewString = templates['rspectextview-modal'];
    var oopsString = templates['oops-modal'];
    var shareString = templates['share-modal'];
    var copyrepoString = templates['copy-repobased-profile'];
  
    var profile_uuid = null;
    var profile_name = '';
    var profile_pid = '';
    var profile_version = '';
    var version_uuid = null;
    var profile      = null;
    var gotrspec     = 0;
    var gotscript    = 0;
    var fromrepo     = 0;
    var reporefspec  = null;
    var ajaxurl      = "";
    var isppprofile  = false;
    var myCodeMirror = null;
    var showTemplate      = _.template(showString);
    var shareTemplate     = _.template(shareString);
    var pythonRe = /^(import|from)/m;
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

	$('#waitwait_div').html(waitwaitString);
	$('#oops_div').html(oopsString);

	/*
	 * Might have used the private key to access.
	 */
	var args = {"profile" : window.PROFILE};
	
	sup.CallServerMethod(null, "show-profile", "GetProfile", args,
			     function (json) {
				 console.info(json);
				 if (json.code) {
				     sup.SpitOops("oops", json.value);
				     return;
				 }
				 profile = json.value;
				 GeneratePage(json.value);
			     });
    }

    function GeneratePage(fields)
    {
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
	if (_.has(fields, "profile_repourl") && fields["profile_repourl"]) {
	    fromrepo = 1;
	}
      
	// Generate the templates.
	var show_html   = showTemplate({
	    fields:		fields,
	    version_uuid:	version_uuid,
	    profile_uuid:	profile_uuid,
	    history:		window.HISTORY,
	    activity:		window.ACTIVITY,
	    isadmin:		window.ISADMIN,
	    isguest:		window.ISGUEST,
	    canedit:            window.CANEDIT,
	    iscreator:		window.ISCREATOR,
	    isleader:		window.ISLEADER,
	    cancopy:            window.CANCOPY,
	    disabled:           window.DISABLED,
	    paramsets:          window.PARAMSETS,
	    withpublishing:     window.WITHPUBLISHING,
	    fromrepo:           fromrepo,
	    gotrspec:           gotrspec,
	    gotscript:          gotscript,
	});
	show_html = aptforms.FormatFormFieldsHorizontal(show_html,
							{"wide" : true});
	$('#page-body').html(show_html);

	$('#rspectext_div').html(rspectextviewString);
	$('#copy_repobased_profile_div').html(copyrepoString);
        if (!window.DISABLED && (window.CANEDIT || fields.profile_public != 0)) { 
            if (0) {
	        $('#share_div').html(shareTemplate({
	            formfields: fields,
	            fromrepo:   fromrepo,
	        }));
                $('.profile-share-button').click(function (event) {
                    event.preventDefault();
                    sup.ShowModal('#share_profile_modal');
                });
	        // Bind the copy to clipboard button in the share modal
	        window.APT_OPTIONS.SetupCopyToClipboard("#share_profile_modal");
            }
            else {
                ShareProfile.InitShareProfile();
            }
        }
	$('#showtopo-modal-div').html(templates["showtopo-modal"]);

	if (window.CANCOPY && !fromrepo) {
	    var plist = JSON.parse(_.unescape(
		$('#projects-json')[0].textContent));
	    
	    CopyProfile.InitCopyProfile('#copy-profile-button',
					window.PROFILE, plist);
	}

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
	    // Bind the copy to clipboard button in URL
	    window.APT_OPTIONS.SetupCopyToClipboard("#repourl-copy-to-clipboard");
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
	    ShowTopology($('#profile_rspec_textarea').val());
	});
	
	// The Show Source button.
	$('#show_source_modal_button, #show_xml_modal_button')
	    .click(function (event) {
		var source;
		var filename;
		var id = $(this).attr("id");

		if (id == "show_source_modal_button" && gotscript) {
	            source   = $.trim($('#profile_script_textarea').val());
		    filename = "profile.py";
		}
		else {
		    source   = $.trim($('#profile_rspec_textarea').val());
		    filename = "profile.xml";
		}
	        sup.DownloadOnClick($('#rspec_modal_download_button'),
				    function () { return source; }, filename);

		$('#rspec_modal_editbuttons').addClass("hidden");
		$('#rspec_modal_viewbuttons').removeClass("hidden");
		$('#modal_profile_rspec_textarea').prop("readonly", true);
		$('#rspec_modal').modal({'backdrop':'static','keyboard':false});
		$('#modal_profile_rspec_textarea').val(source);
		$('#rspec_modal').modal('show');
	    });
        $('#rspec_modal').on('shown.bs.modal', function() {
	    var source = $('#modal_profile_rspec_textarea').val();
	    var mode   = "text/xml";
	    var wrap   = true;

	    // Need to determine the mode.
	    if (pythonRe.test(source)) {
		mode = "text/x-python";
		var wrap = false;
	    }
	    else if (tclRe.test(source)) {
		mode = "text/x-tcl";
		var wrap = false;
	    }
	    myCodeMirror = CodeMirror(function(elt) {
		$('#modal_profile_rspec_div').prepend(elt);
	    }, {
		value: source,
                lineNumbers: true,
		lineWrapping: wrap,
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
	 * Suck the description and instructions
	 * out of the rspec and put them into the text boxes.
	 */
	ExtractFromRspec();
	// We also got a geni-lib script, so show the XML button.
	if (gotscript) {
	    $('#show_xml_modal_button').removeClass("hidden");
	}
	if (gotscript &&
	    _.has(fields, "paramdefs") && fields["paramdefs"] != "") {
	    paramHelp.ShowParameterHelp(fields["paramdefs"]);
	}
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
	gitrepo.InitRepoPicker({
	    "uuid"      : window.PROFILE,
	    "share_url" : profile.profile_profile_url,
	    "refspec"   : null,
	    "callback"  : function(which) {
		SelectRepoTarget(which);
	    }
	});
    }
    /*
     * User has clicked on a branch/tag. We need to get that branch/tag
     * source code and update the page.
     */
    function SelectRepoTarget(which)
    {
	console.info("SelectRepoTarget: ", which);

	reporefspec = which;
	UpdateInstantiateButton();

	var callback = function(json) {
	    sup.HideWaitWait();
	    console.info("GetRepoSource", json.value);

	    if (json.code) {
		sup.SpitOops("oops",
			     "<pre><code>" +
			     $('<div/>').text(json.value).html() +
			     "</code></pre>");
		return;
	    }
	    $('#profile_rspec_textarea').val(json.value.rspec);
	    ExtractFromRspec();
	    if (_.has(json.value, "script")) {
		$('#profile_script_textarea').val(json.value.script);
	    }
	    if (_.has(json.value, "paramdefs")) {
		paramHelp.ShowParameterHelp(JSON.parse(json.value.paramdefs));
	    }
	    else {
		paramHelp.HideParameterHelp();
	    }
	    // Top left panel.
	    $('#current-refspec').html(reporefspec);
	    $('#current-refhash').html(json.value.hash.substring(0, 8));
	}
	sup.ShowWaitWait("We are getting the source code from the " +
			 "repository and converting it to XML ... " +
			 "Patience please.");
	var xmlthing = sup.CallServerMethod(ajaxurl,
					    "show-profile",
					    "GetSource",
					    {"refspec"  : reporefspec,
					     "uuid"     : window.PROFILE});
	xmlthing.done(callback);
    }

    var showTopoIframe = null;

    function ShowTopology(rspec)
    {
	if (showTopoIframe) {
	    showTopoIframe(rspec);
	}
	else {
	    showTopoIframe = ShowTopoIframe($('#showtopology-modal'),
					    '.showtopology-bare', rspec);
	}
    }
    
    /*
     * Update the instantiate button when we switch repo targets.
     */
    function UpdateInstantiateButton()
    {
	var url = "instantiate.php?profile=" +
	    window.PROFILE + "&from=manage-profile";

	if (reporefspec) {
	    url += "&refspec=" + reporefspec;
	}
	$('#profile_instantiate_button').attr("href", url);
    }
    $(document).ready(initialize);
});
