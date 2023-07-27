//
// Show a topology in an iframe and send rspecs to it for display.
// Might be in a modal, in which case the ShowModal is here.
// The element must be visible before Jacks can draw it properly.
//
$(function () {
window.ShowTopoIframe = (function ()
{
    'use strict';

    function create(target, selector, rspec, callback, showinfo)
    {
	var ismodal = $(target).hasClass("modal");
	var JACKS_NS = "http://www.protogeni.net/resources/rspec/ext/jacks/1";
	var multisite = false;
	var first;
	var rest = null;

	/*
	 * On this path we might get a list (as for manifests).
	 */
	if (Array.isArray(rspec)) {
	    rest  = _.rest(rspec);
	    first = _.first(rspec);
	}
	else {
	    first = rspec;
	}
	var xmlDoc = $.parseXML(first);
	var xmlXML = $(xmlDoc);

	/*
	 * See how many sites. Do not use multiSite if no sites or
	 * only one site. 
	 */
	var sites  = {};

	$(xmlXML).find("node").each(function() {
	    var node_id  = $(this).attr("client_id");
	    var site     = this.getElementsByTagNameNS(JACKS_NS, 'site');
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
	if (Object.keys(sites) > 1) {
	    multisite = true;
	}

	/*
	 * Once the viewer is ready, we can send it the rspec(s).
	 */
	var viewerReady = function (viewer) {
	    if (first) {
		if (ismodal) {
		    $(target).one("shown.bs.modal", function () {
			viewer.add(first);
			if (rest) {
			    _.each(rest, function(xml) {
				viewer.add(xml);
			    });
			}
		    });
		    $(target).modal('show');
		}
		else {
		    viewer.add(first);
		    if (rest) {
			_.each(rest, function(xml) {
			    viewer.add(xml);
			});
		    }
		}
	    }
	};

	var viewer = window.JacksViewer.create({
	    "root"       : target,
	    "selector"   : selector,
	    "showinfo"   : showinfo,
	    "multisite"  : multisite,
	    "modified_callback" : function (object) {
		console.info(object);
		if (callback) {
		    callback(object.rspec);
		}
	    },
	    "ready_callback" : function () { viewerReady(viewer); },
	});
	
	console.info("ShowTopoIframe", ismodal, viewer, first);

	/*
	 * This only adds a single rspec, it will not be a list.
	 */
	return function (rspec) {
	    viewer.clear();
	    
	    if (ismodal) {
		$(target).one("shown.bs.modal", function () {
		    viewer.add(rspec);
		});
		$(target).modal('show');
	    }
	    else {
		viewer.add(rspec);
	    }
	}
    }
    return create;
}
)();

window.JacksEditor = (function ()
{
    'use strict';

    var templates = APT_OPTIONS.fetchTemplateList(['edit-modal',
						   'edit-inline']);
        
    function create(root, isViewer, isInline,
		    withoutSelection, withoutMenu, withoutMultiSite, options)
    {
	var id       = "iframe-" + Math.random().toString(36).substring(2,15);
	var url      = "jacks-editor.php?embedded=1";
	var ifclass  = "showtopology-iframe";
	var callback = null;
	var cancel_callback = null;

	console.info("JackEditor.create", root);

	// I do not think we use inline any more. 
	if (isInline) {
	    $(root).html(templates['edit-inline']);
	}
	else {
	    $(root).html(templates['edit-modal']);
	}
	if (isViewer) {
	    $(root).find(".modal-header h3").html('Topology Viewer');
	}
	else {
	    $(root).find('#edit-save').click(function () {
		acceptEdit();
	    });
	}
	$(root).find('#edit-cancel, #edit-dismiss').click(function () {
	    cancelEdit();
	});
	
	$(root).find('.edittopology-bare')
	    .html('<iframe id="' + id + '" ' +
		  '        class="' + ifclass + '" ' +
		  '        width="100%" height="100%" ' +
                  '        src="' + url + '">');
	    
	var iframe = $('#' + id)[0];
	    
	var iframeWindow = (iframe.contentWindow ?
			    iframe.contentWindow :
			    iframe.contentDocument.defaultView);

	iframeWindow.addEventListener('load', function (event) {
	    console.info("loaded");

	    var message = {
		action: "create",
		isViewer: isViewer,
		isInline: isInline,
		withoutSelection: withoutSelection,
		withoutMenu: withoutMenu,
		withoutMultiSite: withoutMultiSite,
		options: options,
	    };
	    iframeWindow.postMessage(message, "*");
	}, { "once" : true });

	function show(xml, callback_func, cancel_callback_func, button_label)
	{
	    if (button_label === undefined || button_label == null) {
		$(root).find('#edit-save').html("Accept");
	    }
	    else {
		$(root).find('#edit-save').html(button_label);
	    }
	    callback = callback_func;
	    cancel_callback = cancel_callback_func;

	    var message = {
		action: "show",
		xml: xml,
	    };

	    if (!isInline) {
		// wait for modal before telling Jacks to draw. 
		$(root).find(".modal").one('shown.bs.modal', function () {
		    iframeWindow.postMessage(message, "*");
		});
		$(root).find(".modal").modal('show');
	    }
	    else {
		iframeWindow.postMessage(message, "*");
	    }
	}

	function acceptEdit()
	{
	    if (callback) {
		iframeWindow.AcceptEditCallback = function (xml) {
		    console.info("acceptEdit", xml);
		    callback(xml);
		    $(root).find('.modal').modal('hide');
		};
	    }
	    var message = {
		action: "fetchxml",
	    };
	    iframeWindow.postMessage(message, "*");
	}

	function cancelEdit()
	{
	    $(root).find('.modal').modal('hide');
	    
	    if (cancel_callback) {
		cancel_callback();
	    }
	}

	function clear()
	{
	    var message = {
		action: "clear",
	    };
	    iframeWindow.postMessage(message, "*");
	}
	return {
	    show: show,
	    clear: clear,
	};
    }

    return {
	create: create,
    };
}
)();

window.JacksViewer = (function ()
{
    'use strict';

    function create(args)
    {
	var id       = "iframe-" + Math.random().toString(36).substring(2,15);
	var url      = "jacks-viewer.php?embedded=1";
	var ifclass  = "showtopology-iframe";
	if (_.has(args, "ifclass")) {
	    ifclass += " " + args.ifclass;
	}
	console.info("JackViewer.create", args);

	$(args.root).find(args.selector)
	    .html('<iframe id="' + id + '" ' +
		  '        class="' + ifclass + '" ' +
		  '        width="100%" height="100%" ' +
                  '        src="' + url + '">');
	    
	var iframe = $('#' + id)[0];
	    
	var iframeWindow = (iframe.contentWindow ?
			    iframe.contentWindow :
			    iframe.contentDocument.defaultView);

	if (args.modified_callback) {
	    iframeWindow.JacksViewerModifiedCallback = function (object) {
		args.modified_callback(object);
	    };
	}
	if (args.click_callback) {
	    iframeWindow.JacksViewerClickCallback = function (object) {
		args.click_callback(object);
	    };
	}
	/*
	 * Propogate to parent so menus close, etc.
	 */
	iframeWindow.addEventListener('click', function (event) {
	    $('html').trigger("click");
	});

	/*
	 * We want to know when its ready to go before we send
	 * it the first XML file.
	 */
	iframeWindow.JacksViewerReadyCallback = function () {
	    console.info("ready");
	    if (args.xml) {
		add(args.xml);
	    }
	    if (args.ready_callback) {
		args.ready_callback();
	    }
	};

	iframeWindow.addEventListener('load', function (event) {
	    console.info("loaded");

	    var message = {
		action: "create",
		multisite: args.multisite,
		showinfo: args.showinfo,
		aggregates: args.aggregates,
	    };
	    iframeWindow.postMessage(message, "*");
	}, { "once" : true });

	function add(xml)
	{
	    console.info("ADD", xml);
	    var message = {
		action: "add",
		xml: xml,
	    };
	    iframeWindow.postMessage(message, "*");
	}

	function clear()
	{
	    var message = {
		action: "clear",
	    };
	    iframeWindow.postMessage(message, "*");
	}
	return {
	    add: add,
	    clear: clear,
	    iframe: function () { return iframeWindow.document; },
	};
    }

    return {
	create: create,
    };
}
)();
});
