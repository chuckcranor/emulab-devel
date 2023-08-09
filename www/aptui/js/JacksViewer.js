$(function () {
window.JacksViewer = (function ()
{
    'use strict';

    var canvasOptions = {
	"aggregates": [
	    {
		"id": "urn:publicid:IDN+utah.cloudlab.us+authority+cm",
		"name": "Cloudlab Utah"
	    },
	    {
		"id": "urn:publicid:IDN+wisc.cloudlab.us+authority+cm",
		"name": "Cloudlab Wisconsin"
	    },
	    {
		"id": "urn:publicid:IDN+clemson.cloudlab.us+authority+cm",
		"name": "Cloudlab Clemson"
	    },
	    {
		"id": "urn:publicid:IDN+utahddc.geniracks.net+authority+cm",
		"name": "IG UtahDDC"
	    },
	    {
		"id": "urn:publicid:IDN+apt.emulab.net+authority+cm",
		"name": "Apt Utah"
	    },
	    {
		"id": "urn:publicid:IDN+emulab.net+authority+cm",
		"name": "Emulab"
	    },
	    {
		"id": "urn:publicid:IDN+wall2.ilabt.iminds.be+authority+cm",
		"name": "iMinds Virt Wall 2"
	    },
	    {
		"id": "urn:publicid:IDN+uky.emulab.net+authority+cm",
		"name": "UKY Emulab"
	    }
	]
    };

    function JacksViewer (showinfo, multiSite, aggregates, ready_callback,
			  modified_callback, click_callback)
    {
	this.instance = null;
	this.input = null;
	this.output = null;
	this.xml = null;
	this.selectionPane = showinfo;
	this.multisite = multiSite;
	this.ready_callback = ready_callback;
	this.modified_callback = modified_callback;
	this.click_callback = click_callback;
	if (aggregates) {
	    canvasOptions.aggregates = aggregates;
	}
	this.render();
    }

    JacksViewer.prototype = {
	render: function ()
	{
	    var makeInstance = function () {
		var me = this;
		
		this.instance = new window.Jacks({
		    mode: "viewer",
		    source: 'rspec',
		    root: '.jacks',
		    multiSite: this.multisite,
		    nodeSelect: this.selectionPane,
		    readyCallback: _.bind(this.jacksReady, this),
		    show: {
			rspec: false,
			tour: false,
			version: false,
			menu: false,
			selectInfo: this.selectionPane
		    },
		    canvasOptions: canvasOptions,
		});
	    }.bind(this);

	    makeInstance();
	},

	// Add a single manifest to the topology
	add: function (xml)
	{
	    //console.info("JacksViewer: Add", this.xml);
	    
	    if (this.xml) {
		this.input.trigger('add-topology', [{ rspec: xml }]);
	    }
	    else {
		this.input.trigger('change-topology', [{ rspec: xml }]);
	    }
	    this.xml = xml;
	},

	// Clear the topology.
	clear: function ()
	{
	    this.xml = null;

	    this.input.trigger('change-topology', []);
	},

	jacksReady: function (input, output)
	{
	    var that = this;
	    console.info("jacksReady", that);
	    
	    this.input = input;
	    this.output = output;

	    if (this.modified_callback) {
		this.output.on('modified-topology', function (object) {
		    that.modified_callback(object);
		});
	    }
	    if (this.click_callback) {
		this.output.on('click-event', function (object) {
		    that.click_callback(object);
		});
	    }
	    if (this.ready_callback) {
		this.ready_callback(this);
	    }
	},
    };
    return JacksViewer;
})();
});
