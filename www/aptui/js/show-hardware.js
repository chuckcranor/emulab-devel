$(function ()
{
    'use strict';

    var templates = APT_OPTIONS.fetchTemplateList(['show-hardware',
						   'oops-modal',
						   'waitwait-modal']);
    var mainTemplate = _.template(templates['show-hardware']);
    var rootid = null;
    
    function initialize()
    {
	window.APT_OPTIONS.initialize(sup);
	var route;
	var args;
	var text;
	var id;
	var title = "Hardware info for ";

	// Generate the template.
	var html = mainTemplate({});
	$('#main-body').html(html);

	// Now we can do this.
	$('#oops_div').html(templates['oops-modal']);
	$('#waitwait_div').html(templates['waitwait-modal']);

	if (window.AMLIST !== undefined) {
	    text  = "Clusters";
	    title = title + "all clusters";
	}
	else if (window.TYPE !== undefined) {
	    route = "nodetype";
	    args  = {"type" : window.TYPE};
	    text  = window.TYPE;
	    title = title + "type " + window.TYPE;
	}
	else if (window.NODEID !== undefined) {
	    route = "node";
	    args  = {"node_id" : window.NODEID};
	    text  = window.NODEID;
	    title = title + "node " + window.NODEID;
	}
	else {
	    route = "nodetype";
	    args  = {"typelist" : window.TYPELIST};
	    text  = "Types";
	    title = title + "typelist " + window.TYPELIST;
	}
	$('.panel-title').html(title);

	// Search box
	var timer = false;
	$('#hardware-search').keyup(function () {
	    if (timer) {
		clearTimeout(timer);
	    }
	    timer = setTimeout(function () {
		var v = $('#hardware-search').val();
		$('#tree').jstree(true).search(v);
	    }, 500);
	});

	// Expand All button.
	$('#expand-all').click(function (event) {
	    if ($('#expand-all').data("expanded") == false) {
		$('#tree').jstree(true).open_all();
		$('#expand-all').data("expanded", true)
	    }
	    else {
		$('#tree').jstree(true).close_all();
		$('#tree').jstree(true).open_node(rootid, null, false);
		$('#expand-all').data("expanded", false)
	    }
	});
	if (window.AMLIST !== undefined) {
	    return GenerateClusters(text);
	}
	// Switch between summary and detailed.
	$('#summary').click(function (event) {
	    $('#tree').jstree(true).destroy(false);
	    if (window.SUMMARY) {
		window.SUMMARY = false;	
		$('#summary').html("Summary");
	    }
	    else {
		window.SUMMARY = true;
		$('#summary').html("Details");
	    }
	    $('#expand-all').attr("disabled", "disabled");
	    $('#hardware-search').removeAttr("disabled");
	    $('#summary').removeAttr("disabled");
	    Generate(text, route, args);
	});
	Generate(text, route, args);
    }

    /*
     * Regen the tree.
     */
    function Generate(text, route, args)
    {
	var root = {
	    "id"         : "root",
	    "text"       : text,
	    "children"   : [],
	    "properties" : {},
	    "values"     : [],
	    "state"      : {
		"opened"    : true,   // is the node open
		"disabled"  : false,  // is the node disabled
		"selected"  : false,  // is the node selected
	    },
	    "pretag" : "",
	};
	if (window.SUMMARY) {
	    args["summary"] = true;
	}
	else {
	    delete args["summary"];
	}
	sup.CallServerMethod(null, route, "GetHardwareInfo", args,
			     function(json) {
				 console.info("info", json);
				 if (json.code) {
				     alert("Could not get hardware info " +
					   "from server: " + json.value);
				     return;
				 }
				 var stuff = json.value;

				 if (_.size(stuff) == 1) {
				     var name    = Object.keys(stuff)[0];
				     var details = stuff[name];
				     GenerateOne(root, name, details);
				 }
				 else {
				     GenerateList(root, stuff);
				 }
				 GenerateJStree(root);
			     });
    }

    /*
     * Generate for all clusters in amlist.
     */
    function GenerateClusters(text)
    {
	var promises = [];
	var amlist   = JSON.parse(_.unescape($('#amlist-json')[0].textContent));
	var counter  = 0;
	console.info("amlist", amlist);

	var root = {
	    "id"         : "root",
	    "text"       : text,
	    "children"   : [],
	    "properties" : {},
	    "values"     : [],
	    "state"      : {
		"opened"    : true,   // is the node open
		"disabled"  : false,  // is the node disabled
		"selected"  : false,  // is the node selected
	    },
	    "pretag" : "",
	};
	
	_.each(amlist, function(details, urn) {
	    var url   = details.url;
	    var types = details.types;
	    var name  = details.name;
	    var args  = {
		"typelist" : Object.keys(types).join(",")
	    };

	    var callback = function (json) {
		console.info(urn, json);
		
		if (json.code) {
		    console.info("Could not get hardware info " +
				 "from server: " + json.value);
		    return;
		}
		var top = {
		    "id"         : urn,
		    "text"       : name,
		    "children"   : [],
		    "properties" : {},
		    "values"     : [],
		    "pretag"     : counter++,
		};
		GenerateList(top, json.value);
		root.children.push(top);
	    };
	    var promise = sup.CallServerMethodURL(url, "nodetype",
						  "GetHardwareInfo", args,
						  callback);
	    promises.push(promise);
	});
	$.when.apply($, promises).then(function () {
	    console.info("promises delivered");
	    GenerateJStree(root)
	    console.info(root);
	});
    }

    /*
     * Generate the json from a path list
     */
    function GenerateJson(root, paths, prefix)
    {
	var idx  = 0;
	var keys = Object.keys(paths);
	
	for (var i = 0; i < keys.length; i++) {
	    var path    = keys[i];
	    var val     = paths[path];
	    var tokens  = path.split("/");
	    var current = root;
	    var id      = prefix;

	    for (var j = 1; j < tokens.length; j++) {
		var token = tokens[j];
		id += "-" + idx++;

		if (j == tokens.length - 1) {
		    // Last token is a property of the current group.
		    // These are shown in the right side panel.
		    current.properties[token] = val;
		    current.values.push(val);
		    break;
		}
		var next = null;
		var children = current.children;
		for (var k = 0; k < children.length; k++) {
		    var child = children[k];
		    
		    if (child.text == token) {
			next = child;
			break;
		    }
		}
		if (!next) {
		    next = {
			"id"         : root.pretag + "-" + id,
			"text"       : token,
			"children"   : [],
			"properties" : {},
			"values"     : [],
		    };
		    current.children.push(next);
		}
		current = next;
	    }
	}
	console.info(root);
    }

    /*
     * Generate one type or node
     */
    function GenerateOne(root, name, details)
    {
	/*
	 * We add the updated time and uname
	 */
	details.paths["/updated"] = moment(details.updated).format("lll");
	if (details.uname) {
	    details.paths["/uname"]   = details.uname;
	}
	GenerateJson(root, details.paths, name);
	// We need the path keys below for search, so save for later.
	details.pathkeys = Object.keys(details.paths);
    }

    /*
     * Generate a list
     */
    function GenerateList(root, list)
    {
	_.each(list, function (details, name) {
	    // Watch for no data.
	    if (details.paths == null) {
		return;
	    }
	    var top = {
		"id"         : root.pretag + "-" + name,
		"text"       : name,
		"children"   : [],
		"properties" : {},
		"values"     : [],
		"pretag"     : root.pretag,
	    };
	    root.children.push(top);
	    GenerateOne(top, name, details);	
	});
    }

    /*
     * Generate the jstree.
     */
    function GenerateJStree(root)
    {
	rootid = root.id;
	
	$('#tree').jstree({
	    'core' : {
		'data' : [ root ],
		'force_text' : true,
		'check_callback' : false,
		'themes' : {
		    'name' : "default"
		}
	    },
	    'plugins' : ['search'],
	    'search' : {
		'search_callback' : function (str, node, f) {
		    if (f.search(node.text).isMatch) {
			return true;
		    }
		    // Search the property values for a match.
		    var length = node.original.values.length;
		    for (var i = 0; i < length; i++) {
			var val  = node.original.values[i];
			if (f.search(val).isMatch) {
			    return true;
			}
		    }
		    // No match, search the keys.
		    var keys = _.keys(node.original.properties);
		    for (var i = 0; i < keys.length; i++) {
			var prop = keys[i];
			if (f.search(prop).isMatch) {
			    return true;
			}
		    }
		},
	    },
	})
	.on('select_node.jstree', function (event, data) {
	    //console.info(data);
	    var node = data.node;
	    var properties = node.original.properties;
	    var html = "";

	    Object.keys(properties).sort().forEach(function(name) {
		var val = properties[name];

		html += "<dt>" + name + "</dt><dd>" + val + "</dd>";
	    });
	    $('#properties dl').html(html);
	});
	// Need a small delay before things are ready to be selected.
	setTimeout(function () {
	    $('#tree').jstree(true).select_node(rootid);
	}, 150);

	// Enable
	$('#expand-all').removeAttr("disabled");
	$('#hardware-search').removeAttr("disabled");
	$('#summary').removeAttr("disabled");
    }

    $(document).ready(initialize);
});
