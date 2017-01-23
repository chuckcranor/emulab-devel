$(function ()
{
  'use strict';

  var templates = APT_OPTIONS.fetchTemplateList(['genilib-editor', 'oops-modal', 'waitwait-modal', 'manage-profile']);
  var pageString = templates['genilib-editor'];
  var oopsString = templates['oops-modal'];
  var waitwaitString = templates['waitwait-modal'];
  var manageString = templates['manage-profile'];
  
  var editor;
  var isWaiting = false;
  var isSplit = false;
  var settingsShown = false;
  var createShown = false;
  var rspec = '';
  var jacks = null;
  var jacksInput = null;
  var jacksOutput = null;
  var manageTemplate = _.template(manageString);

  function initialize()
  {
    window.APT_OPTIONS.initialize(sup);

    $('#page-body').html(pageString);
    $('#oops_div').html(oopsString);
    $('#waitwait_div').html(waitwaitString);
    
    editor = ace.edit('editor');
    editor.setTheme('ace/theme/chrome');
    editor.getSession().setMode('ace/mode/python');
    editor.getSession().on('change', editorChanged);

    removeSplit();

    loadSettings();

    var source = document.getElementById('source').innerHTML;
    editor.setValue(atob(source));
    editor.selection.clearSelection();
    $(window).off('beforeunload.portal');

    $('#waitwait-modal').modal({ backdrop: 'static', keyboard: false, show: false });
    sup.DownloadOnClick($('#saveButton'), getSaveText, 'saved.py', saveComplete);
    $('#loadButton').on('click', load);
    $('#runButton').on('click', clickRun);
    $('#settingsButton').on('click', toggleSettings);
    $('#closeErrorButton').on('click', removeSplit);
    $('#closeSettingsButton').on('click', removeSplit);
    $('#closeJacksButton').on('click', removeSplit);
    $('#settings-root select').on('change', onChangeSettings);
    $('#createButton').on('click', clickCreate);
    $('#closeCreateButton').on('click', removeSplit);
    if (window.PROFILE_CANEDIT && window.PROFILE_NAME && window.PROFILE_PROJECT &&
	window.PROFILE_VERSION_UUID && window.PROFILE_LATEST_UUID)
    {
      $('#updateButton').on('click', clickEdit);
      $('#updateButton').removeClass('hidden');
    }
  }

  function removeSplit()
  {
    $('#jacks-root').hide();
    $('#error-root').hide();
    $('#create-root').hide();
    $('#settings-root').hide();
    settingsShown = false;
    createShown = false;
    $('#editor-container')
      .removeClass('col-lg-6 col-md-6')
      .addClass('col-lg-12 col-md-12');
    editor.resize();
  }

  function addSplit()
  {
    $('#editor-container')
      .removeClass('col-lg-12 col-md-12')
      .addClass('col-lg-6 col-md-6');
    editor.resize();
  }

  function editorChanged()
  {
    if (createShown)
    {
      removeSplit();
    }
    $(window).on('beforeunload.portal', beforeUnload);
  }

  function getSaveText()
  {
    if (! isWaiting)
    {
      return editor.getValue();
    }
    else
    {
      return null;
    }
  }

  function saveComplete()
  {
    $(window).off('beforeunload.portal');
  }
  
  function load()
  {
    if (! isWaiting)
    {
      $('#load-input').html('<input type="file"/>');
      $('#load-input input').on('change', function () {
	var file = $('#load-input input')[0].files[0];
	if (file)
	{
          var reader = new FileReader();
          reader.onload = function (e) {
            var contents = e.target.result;
	    editor.setValue(contents);
	    editor.selection.clearSelection();
	    $(window).off('beforeunload.portal');
	    removeSplit();
//            jacksInput.trigger('change-topology', [{ rspec: contents }]);
          };
          reader.readAsText(file);
	}
      });
      $('#load-input input').click();
    }
  }

  function clickRun()
  {
    run('test');
  }

  var runOption = 'test';

  function run(newRunOption)
  {
    if (! isWaiting)
    {
      runOption = newRunOption;
      removeSplit();
      $('#waitwait-modal').modal('show');
      isWaiting = true;

      var script = editor.getValue();
      var call = sup.CallServerMethod(null, "instantiate",
				      "RunScript",
				      {"script" : script});
      call.done(runComplete);
    }
  }

  function runComplete(json)
  {
    $('#waitwait-modal').modal('hide');
    isWaiting = false;

    if (json.code == 0)
    {
      rspec = json.value;
      if (runOption == 'create')
      {
	$('#create-root').show();
	createShown = true;
	updateCreateBody();
      }
      else if (runOption == 'edit')
      {
	$('#create-root').show();
	createShown = true;
	updateEditBody();
	_.defer(function () { $('#profile_submit_button').click(); });
      }
      $('#jacks-root').show();
      _.defer(jacksUpdate);
      addSplit();
    }
    else if (json.code == 2)
    {
      $('#error-message').html('');
      var errors = json.value.split('\n');
      for (var i in errors)
      {
	var item = $('<div class="error-item">');

	var re = /[0-9].py", line ([0-9]+)/;
	var found = re.exec(errors[i]);
	if (found !== null)
	{
	  var line = parseInt(found[1], 10);
	  item.append(makeLineButton(line));
	}

	item.append('<pre>' + _.escape(errors[i]) + '</pre></div>');
	$('#error-message').append(item);
      }
//      $('#error-message').html(_.escape(json.value));
      $('#error-root').show();
      addSplit();
    }
    else
    {
      sup.SpitOops('oops', json.value);
    }
  }

  function makeLineButton(line)
  {
    var button = $('<button class="btn btn-default pull-right"><span class="glyphicon glyphicon-share-alt" aria-hidden="true"></span></button>');
    button.on('click', function () {
      editor.gotoLine(line);
    });
    return button;
  }

  function clickCreate()
  {
    run('create');
  }

  function clickEdit()
  {
    run('edit');
  }

  function onChangeSettings()
  {
    var settings = saveSettings();
    updateSettings(settings);
  }


  function toggleSettings()
  {
    if (settingsShown)
    {
      removeSplit();
    }
    else
    {
      settingsShown = true;
      $('#settings-root').show();
      $('#jacks-root').hide();
      $('#error-root').hide();
      $('#create-root').hide();
      createShown = false;
      addSplit();
    }
  }

  function loadSettings()
  {
    var settings = {
      'theme': 'chrome',
      'fontsize': '12px',
      'codefolding': 'manual',
      'keybinding': 'ace',
      'showspace': 'disabled'
    };
    try
    {
      var settingsString = window.localStorage.getItem('genilib-editor-settings');
      if (settingsString)
      {
	settings = JSON.parse(settingsString);
      }
    }
    catch (e)
    {
      console.log('Failed to load settings. Falling back to defaults.');
    }

    updateSettings(settings);
  }

  function saveSettings()
  {
    var settings = {};
    $('#settings-root select').each(function () {
      settings[this.id] = $(this).val();
    });
    try
    {
      var settingsString = JSON.stringify(settings);
      window.localStorage.setItem('genilib-editor-settings', settingsString);
    }
    catch (e)
    {
      console.log('Cannot save settings');
    }
    return settings;
  }

  function updateSettings(settings)
  {
    for (var key in settings)
    {
      if ($('#settings-root').find('#' + key).val() !== settings[key])
      {
	$('#settings-root').find('#' + key).val(settings[key]);
      }
    }
    if (editor.getTheme() !== 'ace/theme/' + settings['theme'])
    {
      editor.setTheme('ace/theme/' + settings['theme']);
    }

    if (editor.getFontSize() !== settings['fontsize'])
    {
      editor.setFontSize(settings['fontsize']);
    }

    var shouldFold = (settings['codefolding'] !== 'manual');
    if (editor.getShowFoldWidgets() !== shouldFold)
    {
      editor.setShowFoldWidgets(shouldFold);
    }

    if (editor.getKeyboardHandler() !== settings['keybinding'])
    {
      editor.setKeyboardHandler('ace/keyboard/' + settings['keybinding']);
    }
    var shouldShowSpace = (settings['showspace'] === 'enabled');
    if (editor.getShowInvisibles() !== shouldShowSpace)
    {
      editor.setShowInvisibles(shouldShowSpace);
    }
  }
  
  function jacksUpdate()
  {
    if (jacks)
    {
      if (jacksInput)
      {
	jacksInput.trigger('change-topology',
			   [{ rspec: rspec }]);
      }
    }
    else
    {
      jacks = new window.Jacks({
        mode: 'viewer',
        source: 'rspec',
        root: '#jacks-container',
        readyCallback: jacksReady,
	show:
	{
	  rspec: true,
	  tour: false,
	  version: false,
	  menu: true,
	  selectInfo: true,
	  clear: false
	}
      });
    }
  }

  function jacksReady(input, output)
  {
    jacksInput = input;
    jacksOutput = output;
    jacksInput.trigger('change-topology',
		       [{ rspec: rspec }]);
  }

  function updateCreateBody()
  {
    var projlist = JSON.parse(_.unescape($('#projects-json')[0].textContent));
    var project = undefined;
    if (projlist.length == 1)
    {
      project = projlist[0];
    }
    else if (window.PROFILE_PROJECT && _.contains(projlist, window.PROFILE_PROJECT))
    {
      project = window.PROFILE_PROJECT;
    }
    var fields = {
      profile_script: editor.getValue(),
      profile_rspec: rspec,
      profile_who: 'private',
      profile_pid: project
    };
    var manage_html = manageTemplate({
      formfields: fields,
      projects: projlist,
      title: 'Create Profile',
      notifyupdate: false,
      viewing: false,
      action: 'create',
      button_label: 'Create',
      candelete: false,
      canmodify: false,
      canpublish: false,
      isadmin: false,
      history: false,
      activity: false,
      manual: false,
      copyuuid: null,
      snapuuid: null,
      general_error: '',
      isapt: window.ISAPT,
      disabled: true,
      versions: [],
      withpublishing: false,
      genilib_editor: true,
      canrepo: false,
      fromrepo: false
    });
    manage_html = aptforms.FormatFormFieldsHorizontal(manage_html,
						      {"wide": false });
    $('#create-body').html(manage_html);
    $('#profile_instructions').prop("readonly", true);
    $('#profile_description').prop("readonly", true);
    $('#profile_submit_button').removeAttr('disabled');
    $('#profile_submit_button').on('click', submitCreate);
    // This activates the popover subsystem.
    $('[data-toggle="popover"]').popover({
      trigger: 'hover',
      placement: 'auto',
      container: 'body',
    });
    parseRspec();
  }

  function updateEditBody()
  {
    var projlist = [window.PROFILE_NAME];
    var fields = {
      profile_name: window.PROFILE_NAME,
      profile_pid: window.PROFILE_PROJECT,
      profile_script: editor.getValue(),
      profile_rspec: rspec,
      profile_who: window.PROFILE_WHO
    };
    var manage_html = manageTemplate({
      formfields: fields,
      projects: projlist,
      title: 'Update Profile',
      notifyupdate: false,
      viewing: false,
      version_uuid: window.PROFILE_VERSION_UUID,
      latest_uuid: window.PROFILE_LATEST_UUID,
      action: 'edit',
      button_label: 'Update',
      candelete: false,
      canmodify: false,
      canpublish: false,
      isadmin: false,
      history: false,
      activity: false,
      manual: false,
      copyuuid: null,
      snapuuid: null,
      general_error: '',
      isapt: window.ISAPT,
      disabled: true,
      versions: [],
      withpublishing: false,
      genilib_editor: true,
      canrepo: false,
      fromrepo: false
    });
    manage_html = aptforms.FormatFormFieldsHorizontal(manage_html,
						      {'wide': false });
    $('#create-body').html(manage_html);
    $('#profile_name').prop('readonly', true);
    $('#profile_instructions').prop('readonly', true);
    $('#profile_description').prop('readonly', true);
    $('#profile_pid').prop('readonly', true);
    $('.permission-checkbox').hide();
    $('#profile_submit_button').removeAttr('disabled');
    $('#profile_submit_button').on('click', submitEdit);
    $('#quickvm_create_profile_form').attr('action', 'manage_profile.php?uuid=' + window.PROFILE_LATEST_UUID);
    // This activates the popover subsystem.
    $('[data-toggle="popover"]').popover({
      trigger: 'hover',
      placement: 'auto',
      container: 'body',
    });
    parseRspec();
  }

  function parseRspec()
  {
    var xmlDoc = null;
    try
    {
      xmlDoc = $.parseXML(rspec);
    }
    catch (err)
    {
      console.log('Could not parse XML', err);
      $('#profile_description').parent().parent().parent().hide();
      $('#profile_instructions').parent().parent().parent().hide();
    }
    if (xmlDoc)
    {
      var xml    = $(xmlDoc);
	
      $('#profile_description').val("");
      $(xml).find("rspec_tour > description").each(function() {
	var text = $(this).text();
	$('#profile_description').val(text);
      });
      $('#profile_instructions').val("");
      $(xml).find("rspec_tour > instructions").each(function() {
	var text = $(this).text();
	$('#profile_instructions').val(text);
      });
    }
  }

  function beforeUnload()
  {
    return 'You have unsaved changes!';
  }

  function submitEdit(event)
  {
    $(window).off('beforeunload.portal');
    $('#waitwait-modal').modal('show');
    return true;
  }

  function submitCreate(event)
  {
    $(window).off('beforeunload.portal');
    $('#waitwait-modal').modal('show');
    return true;
  }
  
  $(document).ready(initialize);
});
