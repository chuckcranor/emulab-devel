require(window.APT_OPTIONS.configObject,
	['underscore', 'constraints', 'js/quickvm_sup', 'js/ppwizardstart', 'js/JacksEditor',
	 'js/lib/text!template/aboutapt.html',
	 'js/lib/text!template/aboutcloudlab.html',
	 'js/lib/text!template/waitwait-modal.html',
         'formhelpers', 'filestyle', 'marked', 'jacks', 'jquery-steps'],
function (_, Constraints, sup, ppstart, JacksEditor, aboutaptString, aboutcloudString, waitwaitString)
{
    'use strict';

    var ajaxurl;
    var amlist        = null;
    var amdefault     = null;
    var selected_uuid = null;
    var selected_rspec = null;
    var ispprofile    = 0;
    var webonly       = 0;
    var isadmin       = 0;
    var portal        = null;
    var registered    = false;
    var JACKS_NS      = "http://www.protogeni.net/resources/rspec/ext/jacks/1";
    var jacks = {
      instance: null,
      input: null,
      output: null
    };
    var editor        = null;
    var loaded_uuid	  = null;
    var ppchanged     = false;


    function initialize()
    {
    // Get context for constraints
	var contextUrl = 'https://www.emulab.net/protogeni/jacks-context/cloudlab-utah.json';
        $('#profile_where').prop('disabled', true);
        $('#instantiate_submit').prop('disabled', true);
        $.get(contextUrl).then(contextReady, contextFail);

    window.APT_OPTIONS.initialize(sup);
    window.APT_OPTIONS.initialize(ppstart);
    registered = window.REGISTERED;
	webonly    = window.WEBONLY;
	isadmin    = window.ISADMIN;
	portal     = window.PORTAL;
    ajaxurl = window.AJAXURL;

	$('#stepsContainer').steps({
		headerTag: "h3",
		bodyTag: "div",
		transitionEffect: "slideLeft",
		autoFocus: true,
		onStepChanging: function(event, currentIndex, newIndex) {
			if (currentIndex == 0 && newIndex == 1) {
				if (ispprofile) {
					if (selected_uuid != loaded_uuid) {
						$('#stepsContainer-p-1 > div').attr('style','display:block');
						ppstart.StartPP({uuid         : selected_uuid,
							 registered   : registered,
							 isadmin      : isadmin,
							 amlist       : amlist,
							 amdefault    : amdefault,
							 callback     : ConfigureDone,
							 button_label : "Accept"});
						loaded_uuid = selected_uuid;
						ppchanged = true;
					}
				}
				else {
					$('#stepsContainer-p-1 > div').attr('style','display:none');
					loaded_uuid = selected_uuid;
				}
			}
			else if (currentIndex == 1 && newIndex == 2) {
				// Set up the Finalize tab
				$('#stepsContainer-p-2 #finalize_options').html('');
				// Each .experiment_option in the form is copied to the last page.
				// When the finish button is pressed, these values are copied back.
				$('#experiment_options .experiment_option').each(function() {
					if (!$(this).hasClass('hidden')) {
						var fieldId = $(this).attr('id');
						var fieldHTML = $(this).html();

						$('#stepsContainer-p-2 #finalize_options').append(''
							+'<div class="'+fieldId+'">'
							+'<div class="form-horizontal">'
							+fieldHTML
							+'</div></div>');
					}
				});
				$('#stepsContainer-p-2 #finalize_options').parent().append(''
					+'<div id="cluster_status_link" class="hidden"><center>'
						+'<a target="_blank" href="cluster-status.php">Check Cluster Status</a>'
					+'</center></div>');

				if ($('#nosite_selector').length || $('#site_selector').length) {
					$('#cluster_status_link').removeClass('hidden');
				}
			}

			if (currentIndex == 2) {
				SwitchJacks('small');
			}

			if (currentIndex == 0 && selected_uuid == null) {
				return false;
			}
			return true;
		},
		onStepChanged: function(event, currentIndex, priorIndex) {
			var cIndex = currentIndex;
			if (currentIndex == 1) {
				// If the profile isn't parameterized, skip the second step
				if (!ispprofile) {
					if (priorIndex < currentIndex) {
						// Generate the profile on the third tab
						ShowProfileSelectionInline($('#profile_name .current'), $('#stepsContainer-p-2 #inline_jacks'), true);

						$(this).steps('next');
						$('#stepsContainer-t-1').parent().removeClass('done').addClass('disabled');
					}
					if (priorIndex > currentIndex) {
						$(this).steps('previous');
						cIndex--;
					}
				}
				$('#pp_form input').change(function() {
					ppchanged = true;
				});
				$('#pp_form select').change(function() {
					ppchanged = true;
				});
			}
			else if (currentIndex == 2 && priorIndex == 1) {
				// Keep the two panes the same height
				$('#inline_container').css('height', $('#finalize_container').outerHeight());
				if (ispprofile && ppchanged) {
					ppstart.HandleSubmit();
					ppchanged = false;
				}
			}

			if (currentIndex < priorIndex) {
				// Disable going forward by clicking on the labels
				for (var i = cIndex+1; i < $('.steps > ul > li').length; i++) {
					$('#stepsContainer-t-'+i).parent().removeClass('done').addClass('disabled');
				}
			}
		}
	});

	// Set up wizard final page formatting
	$('#stepsContainer .steps').addClass('col-lg-8 col-lg-offset-2 col-md-8 col-md-offset-2 col-sm-10 col-sm-offset-1 col-xs-12 col-xs-offset-0');
	$('#stepsContainer .actions').addClass('col-lg-8 col-lg-offset-2 col-md-8 col-md-offset-2 col-sm-10 col-sm-offset-1 col-xs-12 col-xs-offset-0');

	// Set up jacks swap
	$('#stepsContainer #inline_overlay').click(function() {
		SwitchJacks('large');
	});

	// Set up the Finish button to submit the form
	$('#stepsContainer .actions a[href="#finish"]').click(function() {
		$('#stepsContainer-p-2 #finalize_options > div').each(function() {
			var fieldId = $(this).attr('class');
			$('#'+fieldId+' .form-control').val($('.'+fieldId+' .form-control').val());
		});
		if (!ispprofile) {
			$('#instantiate_submit').click();
		}
	});

	if ($('#amlist-json').length) {
	    amlist  = JSON.parse(_.unescape($('#amlist-json')[0].textContent));
	}

	$('#waitwait_div').html(waitwaitString);
	// The about panel.
	if (window.SHOWABOUT) {
	    $('#about_div').html(window.ISCLOUD ?
				 aboutcloudString : aboutaptString);
	}
	// This activates the popover subsystem.
	$('[data-toggle="popover"]').popover({
	    trigger: 'hover',
	    placement: 'auto',
	    container: 'body',
	});

	if (window.APT_OPTIONS.isNewUser) {
	    $('#verify_modal_submit').click(function (event) {
		$('#verify_modal').modal('hide');
		$("#waitwait-modal").modal('show');
		return true;
	    });
	    $('#verify_modal').modal('show');
	}
        $('#quickvm_topomodal').on('shown.bs.modal', function() {
            ShowProfileSelection($('#profile_name .current'))
        });

	$('button#reset-form').click(function (event) {
	    event.preventDefault();
	    resetForm($('#quickvm_form'));
	});
	$('button#profile').click(function (event) {
	    event.preventDefault();
	    $('#quickvm_topomodal').modal('show');
	});
	$('li.profile-item').click(function (event) {
	    event.preventDefault();
	    ShowProfileSelection(event.target);
	});
	$('button#showtopo_select').click(function (event) {
	    event.preventDefault();
	    ChangeProfileSelection($('#quickvm_topomodal .selected'));
	    selected_uuid = $('#quickvm_topomodal .selected').attr('value');
	    console.log(selected_uuid);
	    $('#quickvm_topomodal').modal('hide');
	    $('.steps .error').removeClass('error');
	});
	$('#instantiate_submit').click(function (event) {
	    if (webonly != 0) {
		event.preventDefault();
		sup.SpitOops("oops",
		     "You do not belong to any projects at your Portal, " +
		     "so you have have very limited capabilities. Please " +
		     "join or create a project at your " +
		     (portal && portal != "" ?
		      "<a href='" + portal + "'>Portal</a>" : "Portal") +
		     " to enable more capabilities. Thanks!")
		return false;
	    }
	    $("#waitwait-modal").modal('show');
	    return true;
	});
	$('#profile_copy_button').click(function (event) {
	    event.preventDefault();
	    if (!registered) {
		sup.SpitOops("oops", "You must be a registered user to copy " +
			     "a profile.");
		return;
	    }
	    var url = "manage_profile.php?action=copy&uuid=" + selected_uuid;
	    window.location.replace(url);
	    return false;
	});

	$('#profile_show_button').click(function (event) {
	    event.preventDefault();
	    if (!registered) {
		sup.SpitOops("oops", "You must be a registered user to view " +
			     "profile details.");
		return;
	    }
	    var url = "show-profile.php?uuid=" + selected_uuid;
	    window.location.replace(url);
	    return false;
	});

	// Profile picker search box.
	var profile_picker_timeout = null;
	
	$("#profile_picker_search").on("keyup", function () {
	    var options   = $('#profile_name');
	    var userInput = $("#profile_picker_search").val();
	    userInput = userInput.toLowerCase();
	    window.clearTimeout(profile_picker_timeout);

	    profile_picker_timeout =
		window.setTimeout(function() {
		    var matches = 
			options.children("li").filter(function() {
			    var text = $(this).text();
			    text = text.toLowerCase();

			    if (text.indexOf(userInput) > -1)
				return true;
			    return false;
			});
		    options.children("li").hide();
		    matches.show();
		}, 500);
	});
	    
	var startProfile = $('#profile_name li[value = ' + window.PROFILE + ']')
        ChangeProfileSelection(startProfile);
	_.delay(function () {$('.dropdown-toggle').dropdown();}, 500);
    }

    function SwitchJacks(which) {
    	if (which == 'small' && $('#stepsContainer-p-2 #inline_jacks').html() == '') {
			$('#stepsContainer #finalize_container').removeClass('col-lg-12 col-md-12 col-sm-12');
    		$('#stepsContainer #finalize_container').addClass('col-lg-8 col-md-8 col-sm-8');
			$('#stepsContainer #inline_large_jacks').html('');
			$('#inline_large_container').addClass('hidden');
			if (ispprofile) {
				ppstart.ChangeJacksRoot($('#stepsContainer-p-2 #inline_jacks'), true);
			}
			else {
				ShowProfileSelectionInline($('#profile_name .current'), $('#stepsContainer-p-2 #inline_jacks'), true);
			}
			$('#stepsContainer-p-2 #inline_container').removeClass('hidden');
    	}
    	else if (which == 'large') {
    		// Sometimes the steps library will clean up the added elements
    		if ($('#inline_large_container').length === 0) {	
	    		$('<div id="inline_large_container" class="hidden"></div>').insertAfter('#stepsContainer .content');
				$('#inline_large_container').html(''
					+'<button id="closeLargeInline" type="button" class="close" data-dismiss="alert" aria-label="Close"><span aria-hidden="true">&times;</span></button>'
					+'<div id="inline_large_jacks"></div>');
				$('#stepsContainer #inline_large_container').addClass('col-lg-8 col-lg-offset-2 col-md-8 col-md-offset-2 col-sm-10 col-sm-offset-1 col-xs-12 col-xs-offset-0');
    		
				$('#closeLargeInline').click(function() {
					SwitchJacks('small');
				});
    		}

    		$('#stepsContainer #finalize_container').removeClass('col-lg-8 col-md-8 col-sm-8');
			$('#stepsContainer #finalize_container').addClass('col-lg-12 col-md-12 col-sm-12');
			$('#stepsContainer-p-2 #inline_jacks').html('');
			$('#stepsContainer-p-2 #inline_container').addClass('hidden');
			if (ispprofile) {
				ppstart.ChangeJacksRoot($('#stepsContainer #inline_large_jacks'), false);
			}
			else {
				ShowProfileSelectionInline($('#profile_name .current'), $('#stepsContainer #inline_large_jacks'), false);
			}
			$('#inline_large_container').removeClass('hidden');
    	}
    }

    function resetForm($form) {
	$form.find('input:text, input:password, select, textarea').val('');
    }

    function ShowProfileSelection(selectedElement) {
	if (!$(selectedElement).hasClass('selected')) {
	    $('#profile_name li').each(function() {
		$(this).removeClass('selected');
	    });
	    $(selectedElement).addClass('selected');
	}
	
	var continuation = function(rspec, description, name, amdefault, ispp) {
	    $('#showtopo_title').html("<h3>" + name + "</h3>");
	    $('#showtopo_description').html(description);
	    sup.maketopmap('#showtopo_div', rspec, false, !isadmin);
	};
	GetProfile($(selectedElement).attr('value'), continuation);
    }

    // Used to generate the topology on Tab 3 of the wizard for non-pp profiles
    function ShowProfileSelectionInline(selectedElement, root, selectionPane) {
	editor = new JacksEditor(root, true, true,
				 selectionPane, true, !isadmin);
	var continuation = function(rspec, description, name, amdefault, ispp) {
	    editor.show(rspec);
	};
	GetProfile($(selectedElement).attr('value'), continuation);
    }
    
    function ChangeProfileSelection(selectedElement) {
	if (!$(selectedElement).hasClass('current')) {
	    $('#profile_name li').each(function() {
		$(this).removeClass('current');
	    });
	    $(selectedElement).addClass('current');
	}

	var profile_name = $(selectedElement).text();
	var profile_value = $(selectedElement).attr('value');
	$('#selected_profile').attr('value', profile_value);
	$('#selected_profile_text').html("" + profile_name);
	
	var continuation = function(rspec, description, name, amdef, ispp) {
	    $('#showtopo_title').html("<h3>" + name + "</h3>");
	    $('#showtopo_description').html(description);
	    $('#selected_profile_description').html(description);

	    ispprofile    = ispp;
	    selected_uuid = profile_value;
	    selected_rspec = rspec;
	    amdefault     = amdef;

	    // Show the configuration button, disable the create button.
	    if (ispprofile) {
		$('#instantiate_submit').attr('disabled', true);
	    }
	    else {
		$('#instantiate_submit').attr('disabled', false);
	    }

	    CreateAggregateSelectors(rspec);

	    // Hide the aggregate picker for a parameterized profile.
	    // Shown later.
	    if (ispprofile) {
		$("#aggregate_selector").addClass("hidden");
	    }
	    else {
		$("#aggregate_selector").removeClass("hidden");
	    }

	    // Set the default aggregate.
	    if ($('#profile_where').length) {
		// Deselect current option.
		$('#profile_where option').prop("selected", false);
		// Find and select new option.
		$('#profile_where option')
		    .filter('[value="'+ amdefault + '"]')
                    .prop('selected', true);		
	    }
	    updateWhere();
	};
	GetProfile($(selectedElement).attr('value'), continuation);
    }
    
    function GetProfile(profile, continuation) {
	var callback = function(json) {
	    if (json.code) {
		alert("Could not get profile: " + json.value);
		return;
	    }
	    //console.info(json);
	    
	    var xmlDoc = $.parseXML(json.value.rspec);
	    var xml    = $(xmlDoc);
    
	    /*
	     * We now use the desciption from inside the rspec, unless there
	     * is none, in which case look to see if the we got one in the
	     * rpc reply, which we will until all profiles converted over to
	     * new format rspecs.
	     */
	    var description = null;
	    $(xml).find("rspec_tour").each(function() {
		$(this).find("description").each(function() {
		    var marked = require("marked");
		    description = marked($(this).text());
		});
	    });
	    if (!description || description == "") {
		description = "Hmm, no description for this profile";
	    }
	    continuation(json.value.rspec, description,
			 json.value.name, json.value.amdefault,
			 json.value.ispprofile);
	}
	var $xmlthing = sup.CallServerMethod(ajaxurl,
					     "instantiate", "GetProfile",
					     {"uuid" : profile});
	$xmlthing.done(callback);
    }

    /*
     * Callback from the PP configurator. Stash rspec into the form.
     */
    function ConfigureDone(newRspec, where) {
	// If not a registered user, we do not get an rspec back, since
	// the user is not allowed to change the configuration.
	if (newRspec) {
	    $('#pp_rspec_textarea').val(newRspec);
	}
	// Need to change the form before submit.
	if (where && $('#profile_where').length) {
	    // Deselect current option.
	    $('#profile_where option').prop("selected", false);
	    // Find and select new option.
	    $('#profile_where option')
		.filter('[value="'+ where + '"]')
                .prop('selected', true);		
	}
	// Enable the create button.
	$('#instantiate_submit').attr('disabled', false);
	if (window.NOPPRSPEC) {
	    alert("Geni users may configure parameterized profiles " +
		  "for demonstration purposes only. The parameterized " +
		  "configuration will not be used if you Create this " +
		  "experiment.");
	}
    }

    /*
     * Build up a list of Aggregate selectors. Normally just one, but for
     * a multisite aggregate, need more then one.
     */
    function CreateAggregateSelectors(rspec)
    {
	var xmlDoc = $.parseXML(rspec);
	var xml    = $(xmlDoc);
	var sites  = {};
	var html   = "";

	/*
	 * Find the sites. Might not be any if not a multisite topology
	 */
	$(xml).find("node").each(function() {
	    var node_id = $(this).attr("client_id");
	    var site   = this.getElementsByTagNameNS(JACKS_NS, 'site');

	    if (! site.length) {
		return;
	    }
	    var siteid = $(site).attr("id");
	    if (siteid === undefined) {
		console.log("No site ID in " + site);
		return;
	    }
	    sites[siteid] = siteid;
	});

	if (!isadmin || Object.keys(sites) == 0) {
	    $("#site_selector").addClass("hidden");
	    $("#nosite_selector").removeClass("hidden");
	    // Clear the form data.
	    $("#site_selector").html("");
	    return;
	}

	// Create the dropdown selection list. First the options which
	// are duplicated in each dropdown.
	var options = "";
	_.each(amlist, function(name) {
	    options = options +
		"<option value='" + name + "'>" + name + "</option>";
	});

	for (var siteid in sites) {
	    html = html +
		"<div id='site"+siteid+"cluster' class='form-horizontal experiment_option'>" +
		"  <div class='form-group'>" +
		"    <label class='col-sm-4 control-label' " +
		"           style='text-align: right;'>"+
		"          Site " + siteid  + " Cluster:</a>" +
		"    </label> " +
		"    <div class='col-sm-6'>" +
		"      <select name=\"formfields[sites][" + siteid + "]\"" +
		"              class='form-control'>" + options +
		"      </select>" +
		"</div></div></div>";
	}
	//console.info(html);
	$("#nosite_selector").addClass("hidden");
	$("#site_selector").removeClass("hidden");
	$("#site_selector").html(html);
    }

    var constraints;

    function contextReady(data)
    {
      var context = data;
      if (typeof(context) === 'string')
      {
	context = JSON.parse(context);
      }
      if (context.canvasOptions.defaults.length === 0)
      {
	delete context.canvasOptions.defaults;
      }
      constraints = new Constraints(context);
      jacks.instance = new window.Jacks({
	mode: 'viewer',
	source: 'rspec',
	root: '#jacks-dummy',
	nodeSelect: true,
	readyCallback: function (input, output) {
	  jacks.input = input;
	  jacks.output = output;
          $('#profile_where').prop('disabled', false);
          $('#instantiate_submit').prop('disabled', false);
	  updateWhere();
	},
	canvasOptions: context.canvasOptions,
	constraints: context.constraints
      });
    }

    function contextFail(fail1, fail2)
    {
        console.log('Failed to fetch context', fail1, fail2);
        alert('Failed to fetch context from ' + contextUrl + '\n\n' + 'Check your network connection and try again or contact testbed support with this message and the URL of this webpage.');
    }

    function updateWhere()
    {
	if (jacks.input && constraints && selected_rspec)
	{
	  jacks.input.trigger('change-topology',
			      [{ rspec: selected_rspec }],
			      { constrainedFields: finishUpdateWhere });
	}
    }

  var amValueToKey = {
    'Cloudlab Utah':
    "urn:publicid:IDN+utah.cloudlab.us+authority+cm",

    'Cloudlab Wisconsin':
    "urn:publicid:IDN+wisc.cloudlab.us+authority+cm",

    'Cloudlab Clemson':
    "urn:publicid:IDN+clemson.cloudlab.us+authority+cm",

    'APT Utah':
    "urn:publicid:IDN+apt.emulab.net+authority+cm",

    'IG UtahDDC':
    "urn:publicid:IDN+utahddc.geniracks.net+authority+cm",

    'Utah PG':
    "urn:publicid:IDN+emulab.net+authority+cm"
  };

    function finishUpdateWhere(data)
    {
      var allowed = [];
      var rejected = [];
      var bound = data;
      var subclause = 'node';
      var clause = 'aggregates';
      allowed = constraints.getValidList(bound, subclause,
					 clause, rejected);
      if (rejected.length > 0)
      {
	$('#where-warning').show();
      }
      else
      {
	$('#where-warning').hide();
      }
      $('#profile_where').children().each(function () {
	var value = $(this).attr('value');
	var key = amValueToKey[value];
	var i = 0;
	var found = false;
	for (; i < allowed.length; i += 1)
	{
	  if (allowed[i] === key)
	  {
	    found = true;
	    break;
	  }
	}
	if (found)
	{
	  $(this).prop('disabled', false);
	}
	else
	{
	  $(this).prop('disabled', true);
	  $(this).prop('selected', false);
	}
      });
    }

    $(document).ready(initialize);
});
