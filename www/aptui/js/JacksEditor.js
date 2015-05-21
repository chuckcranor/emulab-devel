define(['underscore', 'js/lib/text!template/edit-modal.html', 'js/lib/text!template/edit-inline.html'],
function (_, editModalString, editInlineString)
{
    'use strict';

    var context = {
	canvasOptions: {
	    "defaults": [
		{
		    "name": "Add VM",
		    "image": "urn:publicid:IDN+utahddc.geniracks.net+image+emulab-ops:UBUNTU12-64-STD",
		    "type": "emulab-xen"
		}
	    ],
	    "images": [
/*
			{
			    "id": "urn:publicid:IDN+utahddc.geniracks.net+image+emulab-ops:FBSD100-64-STD",
			    "name": "FreeBSD 10.0 64-bit version"
			},
*/
		{
		    "id": "urn:publicid:IDN+utahddc.geniracks.net+image+emulab-ops:UBUNTU12-64-STD",
		    "name": "Ubuntu 12.04 LTS 64-bit"
		}/*,
			{
			    "id": "urn:publicid:IDN+utahddc.geniracks.net+image+emulab-ops:UBUNTU14-64-STD",
			    "name": "Ubuntu 14.04 LTS 64-bit"
			}*/
	    ],
	    "types": [
		{
		    "id": "emulab-xen",
		    "name": "Emulab Xen VM"
		}
	    ]
	}
    };

    var waitingInstances = [];
    var contextFetched = false;

    var contextUrl = 'https://www.emulab.net/protogeni/jacks-context/cloudlab-utah.json';
    if (window.ISCLOUD)
    {
	$('#edit_topo_modal_button').prop('disabled', true);
	$.get(contextUrl).then(contextReady, contextFail);
    }
    else
    {
      contextFetched = true;
    }

    function contextReady(data)
    {
	$('#edit_topo_modal_button').prop('disabled', false);
	context = data;
        contextFetched = true;
        _.each(waitingInstances, function (f) {
	  f();
	});
    }

    function contextFail(fail1, fail2)
    {
	console.log('Failed to fetch Jacks context', fail1, fail2);
	alert('Failed to fetch Jacks context from ' + contextUrl);
    }

    function JacksEditor (root, isViewer, isInline, withoutSelection, withoutMenu)
    {
	this.root = root;
	this.instance = null;
	this.input = null;
	this.output = null;
	this.xml = null;
	this.mode = 'editor';
	this.selectionPane = true;
	this.menu = true;
	if (isViewer)
	{
	    this.mode = 'viewer';
	}
    this.shown = false;

	if (isInline) {
		this.inline = 'inline';
	}
	// A little backward, but I didn't want the addition of these parameters to
	// mess up code elsewhere. The previous values for these parts of the context was true.
	if (withoutSelection) {
		this.selectionPane = false;
	}
	if (withoutMenu) {
		this.menu = false;
	}
	this.render();
    }

    JacksEditor.prototype = {

	render: function ()
	{
		if (this.inline == 'inline')
		{
			this.root.html(editInlineString);
		}
		else
		{
	    	this.root.html(editModalString);
	    	this.root.find('#quickvm_editmodal').on('shown.bs.modal', _.bind(this.handleShown, this));
		}
	    if (this.mode !== 'editor')
	    {
		this.root.find('.modal-header h3').html('Topology Viewer');
	    }
	    this.root.find('#edit-save').click(_.bind(this.fetchXml, this));
	    this.root.find('#edit-cancel, #edit-dismiss')
	      .click(_.bind(this.cancelEdit, this));
	    var makeInstance = function () {
	      this.instance = new window.Jacks({
		mode: this.mode,
		source: 'rspec',
		root: '#edit_nopicker',
		multiSite: true,
		nodeSelect: this.selectionPane,
		readyCallback: _.bind(this.jacksReady, this),
		show: {
		    rspec: false,
		    tour: false,
		    version: false,
		    menu: this.menu,
		    selectInfo: this.selectionPane
		},
		canvasOptions: context.canvasOptions,
		constraints: context.constraints
	      });
	    }.bind(this);

	    if (contextFetched)
	    {
	      makeInstance();
	    }
	    else
	    {
	      waitingInstances.push(makeInstance);
	    }
	},

	// Show a modal that lets the user edit their rspec. Callback
	// is called with a new rspec if they click ok.
	show: function (newXml, callback, cancel_callback, button_label)
	{
	    this.xml = newXml;
	    this.callback = callback;
	    if (cancel_callback === undefined) {
		cancel_callback = null;
	    }
	    this.cancel_callback = cancel_callback;
	    if (button_label === undefined || button_label == null) {
		this.root.find('#edit-save').html("Accept");
	    }
	    else {
		this.root.find('#edit-save').html(button_label);
	    }
	    if (this.input)
	    {
	    	if (this.inline == 'inline') {
	    		this.handleShown();
	    	}
	    	else {
				this.root.find('#quickvm_editmodal').modal('show');
	    	}
	    }
	},

	// Hide the modal.
	hide: function ()
	{
	    this.xml = null;
	    this.root.find('#quickvm_editmodal').modal('hide');
	},

	handleShown: function ()
	{
	    var expression = /^\s*$/;
	    if (this.xml && ! expression.exec(this.xml))
	    {
	      console.log('before: ', this.xml);
		var rspec = $.parseXML(this.xml);
		convertNamespace(rspec.documentElement);
	      console.log('after: ', rspec.documentElement.outerHTML);
		this.input.trigger('change-topology',
				   [{ rspec: rspec.documentElement.outerHTML }]);
	    }
	    else
	    {
		this.input.trigger('change-topology', [{
		    rspec:
		    '<rspec '+
			'xmlns="http://www.geni.net/resources/rspec/3" '+
			'xmlns:emulab="http://www.protogeni.net/resources/rspec/ext/emulab/1" '+
			'xmlns:tour="http://www.protogeni.net/resources/rspec/ext/apt-tour/1" '+
			'xmlns:jacks="http://www.protogeni.net/resources/rspec/ext/jacks/1" '+
			'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" '+
			'xsi:schemaLocation="http://www.geni.net/resources/rspec/3 http://www.geni.net/resources/rspec/3/request.xsd">'+
			'</rspec>'
		}]);
	    }
	},

	jacksReady: function (input, output)
	{
	    this.input = input;
	    this.output = output;
	    if (this.xml)
	    {
		this.show(this.xml);
	    }
	},

	fetchXml: function ()
	{
	    var that = this;
	    var fetchDone = function (topology) {
		that.output.off('fetch-topology', fetchDone);
		that.callback(topology[0].rspec);
		that.hide();
	    };

	    this.output.on('fetch-topology', fetchDone);
	    this.input.trigger('fetch-topology');
	},

	cancelEdit: function ()
	{
	    this.root.find('#quickvm_editmodal').modal('hide');
	    
	    if (this.cancel_callback !== null) {
		this.cancel_callback();
	    }
	}
    };

    var v2ns = 'http://www.protogeni.net/resources/rspec/2';
    var v3ns = 'http://www.geni.net/resources/rspec/3';

    function convertNamespace(el)
    {
	if (el.namespaceURI === v2ns)
	{
	    el.setAttribute('xmlns', v3ns);
	}
	_.each(el.children, convertNamespace);
    }

    return JacksEditor;
});
