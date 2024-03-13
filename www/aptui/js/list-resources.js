$(function ()
{
    'use strict';

    var templates = APT_OPTIONS.fetchTemplateList(['list-resources',
						   'resources-list']);
    var EMULAB_NS = "http://www.protogeni.net/resources/rspec/ext/emulab/1";
    var instances = null;
    var showBlockstores = false;
    var showVMs = false;
    var amlist  = null;

    function initialize()
    {
	window.APT_OPTIONS.initialize(sup);

	amlist = decodejson("#amlist-json");
	console.info("amlist", amlist);

	$('#main-body').html(templates['list-resources']);
	$('#admin-controls').removeClass("hidden");

	// Toggles for blockstores and VMs,
	$('#showVMs, #showBlockstores').change(function (event) {
	    event.preventDefault();
	    var checked = $(this).prop("checked");
	    var which   = $(this).attr("id");
	    console.info(which, checked)
	    if (which == "showVMs") {
		showVMs = checked;
	    }
	    else {
		showBlockstores = checked;
	    }
	    console.info(showVMs, showBlockstores);
	    if (instances == null) {
		return;
	    }
	    GeneratePageBody();
	});

	sup.CallServerMethod(null, "resources", "ResourceList", null,
			     function(json) {
				 console.info("resources", json);
				 $('#waiting').addClass("hidden");
				 if (json.code) {
				     alert("Could not get resource list " +
					   "from server: " + json.value);
				     return;
				 }
				 instances = json.value;
				 GeneratePageBody();
			     });
    }

    function GeneratePageBody()
    {
	$('#resources-count span').html(_.size(instances));
	$('#resources-count').removeClass("hidden");
	$('#table-div').html("");
	
	var collated = {};
	_.each(instances, function(details, uuid) {
	    _.each(details.slivers, function(sliver, aggregate_urn) {
		var resNodes = null;
		var typelist = {};
		var xml = $.parseXML(sliver.manifest);

		// Watch for wrong portal.
		if (_.has(amlist, aggregate_urn)) {
		    resNodes = amlist[aggregate_urn].reservable_nodes;
		}

		$(xml).find("node, emulab\\:vhost").each(function() {
		    // Only nodes that match the aggregate being processed,
		    // since we send the same rspec to every aggregate.
		    var manager_urn = $(this).attr("component_manager_id");
		    if (!manager_urn.length ||
			manager_urn != aggregate_urn) {
			return;
		    }
		    var tag     = $(this).prop("tagName");
		    var isvhost = (tag == "emulab:vhost" ? 1 : 0);
		    var vnode   = this.getElementsByTagNameNS(EMULAB_NS,
								  'vnode');
		    if (vnode.length) {
			var hwtype = $(vnode).attr("hardware_type");
			var name   = $(vnode).attr("name");

			// Reservable nodes shown as themselves.
			if (resNodes && _.has(resNodes, name)) {
			    hwtype = name;
			}
			
			if (!_.has(typelist, hwtype)) {
			    typelist[hwtype] = 0;
			}
			typelist[hwtype]++;
		    }
		});
		if (_.size(typelist)) {
		    if (!_.has(collated, uuid)) {
			collated[uuid] = {};
		    }
		    collated[uuid][aggregate_urn] = {
			"typelist"   : typelist,
			"cluster"    : sliver.name,
			"creator"    : details.creator,
			"name"       : details.name,
			"started"    : details.started,
			"expires"    : details.expires,
			"portal"     : details.portal,
			"pid"        : details.pid,
		    };
		}
	    });
	});
	console.info("collated", collated);
	if (!_.size(collated)) {
	    return;
	}
	var template = _.template(templates["resources-list"]);
	var html = template({
	    "resources"       : collated,
	    "showCreator"     : true,
	    "showProject"     : true,
	    "showPortal"      : window.MAINSITE,
	    "showReserved"    : false,
	    "showBlockstores" : showBlockstores,
	    "showVMs"         : showVMs,
	});
	$('#table-div').html(html);
	    
	// Format dates with moment before display.
	$('.format-date').each(function() {
	    var date = $.trim($(this).html());
	    if (date != "") {
		$(this).html(moment($(this).html()).format("lll"));
	    }
	});

	/*
	 * Some kind of bad interaction between filtering and zebra and
	 * bootstrap. This removes table-striped which causes the zebra
	 * rows to get messed up after a filter is applied.
	 */
	$.extend($.tablesorter.themes.bootstrap, {
	    table  : 'table table-bordered',
	});
	
	var table = $("#resources-table")
	    .tablesorter({
		theme : 'bootstrap',
		headerTemplate : '{content} {icon}',
		widgets: ["uitheme", "filter", "zebra"],
		sortList: [[1,0]],		

		widgetOptions: {
		    // include child row content while filtering, if true
		    filter_childRows  : true,
		    // include all columns in the search.
		    filter_anyMatch   : true,
		    // class name applied to filter row and each input
		    filter_cssFilter  : 'form-control input-sm',
		    // search from beginning
		    filter_startsWith : false,
		    // Set this option to false for case sensitive search
		    filter_ignoreCase : true,
		    // Only one search box.
		    filter_columnFilters : true,
		},
	    });

	// Target the $('.search') input using built in functioning
	// this binds to the search using "search" and "keyup"
	// Allows using filter_liveSearch or delayed search &
	// pressing escape to cancel the search
	$.tablesorter.filter.bindSearch(table, $('#resources_table_search'));

	// Update the count of matched experiments
	table.bind('filterEnd', function(e, filter) {
	    $('#resources-count span').html(filter.filteredRows);
	});
    }

    // Helper.
    function decodejson(id) {
	return JSON.parse(_.unescape($(id)[0].textContent));
    }
    
    $(document).ready(initialize);
});
