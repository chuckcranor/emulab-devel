$(function () {
window.instantiateCommon = (function () {
    var amlist        = null;
    var radioinfo     = null;
    var resgroups     = null;
    var resinfo       = null;
    var monitor       = null;
    var restrictions  = null;
    var multisite     = false;
    var siteTemplate  = null;
    var clusterTemplate = null;
    var JACKS_NS      = "http://www.protogeni.net/resources/rspec/ext/jacks/1";

    function initialize(args)
    {
	amlist    = args.amlist;
	radioinfo = args.radioinfo;
	resgroups = args.resgroups;
	multisite = args.multisite;
	monitor   = decodejson('#amstatus-json');
	console.info("monitor status", monitor);
	
	if ($('#restrictions-json').length) {
	    restrictions = decodejson('#restrictions-json');
	    console.info("cluster restrictions", restrictions);
	}

	// Assign health ratings and icons
	_.each(amlist, function(details, key) {
	    if (monitor && _.size(monitor)) {
		details["status"] = calculateAggregateStatus(monitor[key]);
	    }
	    else {
		details["status"] = null;
	    }
	});

	var templates      = APT_OPTIONS.fetchTemplateList(
	                          ['instantiate-templates']);
	var extraTemplates = templates['instantiate-templates'];
	var html           = $.parseHTML(extraTemplates, document, true);
	siteTemplate   = _.template($('#pickered-site-template', html).html());
	clusterTemplate= _.template($('#pickered-agg-template', html).html());
    }
    // Helper.
    function decodejson(id) {
	return JSON.parse(_.unescape($(id)[0].textContent));
    }
    
    /*
     * Try to select the clusters for the user based on the node types.
     * This might not be possible, if there is a conflict in the types.
     * Do what we can.
     */
    function setClusters(rspec)
    {
	var EMULAB_NS = "http://www.protogeni.net/resources/rspec/ext/emulab/1";
	var xmlDoc    = $.parseXML(rspec);
	var changed   = false;
	
	if (0) {
	    return rspec;
	}

	//console.info("SetClusters", rspec);

	// Find all the nodes, look for types nodes
	$(xmlDoc).find("node").each(function() {
	    var node         = this;
	    var node_id      = $(this).attr("client_id");
	    var htype        = $(node).find("hardware_type");
	    var manager_id   = $(node).attr("component_manager_id");
	    var component_id = $(node).attr("component_id");

	    // Skip anything with the manager already set.
	    if (manager_id) {
		return;
	    }
	    // Otherwise, we dig inside and find the hardware type
	    // or a component_id urn.
	    if (!(htype.length || component_id)) {
		return;
	    }
	    if (htype.length) {
		var type = $(htype).attr("name");
		console.info("SetClusters", node_id, type);
	    
		/*
		 * Find the cluster that has this type.
		 * Watch for same type at more then one cluster and bail.
		 */
		var found = 0;
	    
		_.each(amlist, function (details, urn) {
		    if (_.has(details.typeinfo, type)) {
			console.info("SetClusters", node_id, type, urn);
			manager_id = urn;
			found++;
		    }
		})
		if (found == 1) {
		    $(node).attr("component_manager_id", manager_id);
		    changed = true;
		}
	    }
	    else {
		// Must be a urn.
		var hrn = sup.ParseURN(component_id);
		if (hrn) {
		    manager_id = sup.CreateURN(hrn.domain, "authority", "cm");
		    $(node).attr("component_manager_id", manager_id);
		    changed = true;
		}
	    }
	});
	if (changed) {
	    rspec = (new XMLSerializer()).serializeToString(xmlDoc);
	}
	//console.info("SetClusters done", rspec);
	return rspec;
    }

    /*
     * Check for radio usage and no spectrum defined
     */
    function checkForRadioUsage(rspec)
    {
	var EMULAB_NS = "http://www.protogeni.net/resources/rspec/ext/emulab/1";
	var usingRadios      = false;
	var usingSpectrum    = false;
	var usingTransmitter = false;

	console.info("CheckForRadioUsage", amlist, radioinfo);

	if (radioinfo) {
	    var xmlDoc   = $.parseXML(rspec);
	    var spectrum = xmlDoc.getElementsByTagNameNS(EMULAB_NS, 'spectrum');
	    var routes   = xmlDoc.getElementsByTagNameNS(EMULAB_NS, 'busroute');
	    
	    console.info("CheckForRadioUsage", spectrum, routes);

	    // In case user changes profile,
	    usingRadios   = routes.length;
	    usingSpectrum = spectrum.length;
	    
	    /*
	     * Check for radio usage, alert the user that using radios
	     * without a spectrum specification is bad news.
	     */
	    $(xmlDoc).find("node").each(function() {
		// Gotta have a manager to know anything.
		var manager_urn = $(this).attr("component_manager_id");
		if (!manager_urn) {
		    return;
		}
		// Ditto the component ID
		var component_id = $(this).attr("component_id");
		if (!component_id) {
		    return;
		}
		// Might be a urn.
		var hrn = sup.ParseURN(component_id);
		if (hrn) {
		    component_id = hrn.id;
		}
		if (component_id.startsWith("oai-wb")) {
		    return;
		}
		//console.info("CheckForRadioUsage", manager_urn, component_id);
		
		if (_.has(radioinfo, manager_urn) &&
		    _.has(radioinfo[manager_urn], component_id)) {
		    usingRadios = true;
		    var radio = radioinfo[manager_urn][component_id];

		    if (_.has(radio, "frontends")) {
			_.each(radio.frontends, function (frontend, iface) {
			    if (frontend.transmit_frequencies != "") {
				usingTransmitter = true;
			    }
			});
		    }
		}
	    });
	    if (usingTransmitter && !spectrum.length) {
		sup.ShowModal('#nospectrum-warning');
	    }
	}
	return {"usingRadios"   : usingRadios,
		"usingSpectrum" : usingSpectrum};
    }

    /*
     * Build up a list of Aggregate selectors. Normally just one, but for
     * a multisite aggregate, need more then one.
     */
    function createAggregateSelectors(rspec, pid)
    {
	var xmlDoc = $.parseXML(rspec);
	var xml    = $(xmlDoc);
	var bound  = 0;
	var count  = 0;
	var ammap  = {};
	var siteIdToSiteNum = {};
	var sites  = {};
	var siteIdToAM = {};

	var nodecount  = $(xmlDoc).find("node").length;
	if (nodecount > 3000) {
	    window.DOCONSTRAINTS = 0;
	}
	console.info("CreateAggregateSelectors: ",
		     nodecount, window.DOCONSTRAINTS);

	/*
	 * Find the sites. Might not be any if not a multisite topology
	 */
	$(xml).find("node, emulab\\:routable_pool").each(function() {
	    var node_id = $(this).attr("client_id");
	    var site    = this.getElementsByTagNameNS(JACKS_NS, 'site');
	    var manager = $(this).attr("component_manager_id");

	    // Keep track of how many bound nodes, of the total.
	    count++;

	    if (manager && manager.length) {
		var hrn = sup.ParseURN(manager);
		if (! hrn) {
		    console.error("Could not parse urn: " + manager);
		    return;
		}
		// Bound node, no dropdown will be provided for these
		// nodes, and if all nodes are bound, no dropdown at all.
		bound++;
		ammap[manager] = manager;

		if (site.length) {
		    var siteid = $(site).attr("id");
		    if (siteid === undefined) {
			console.error("No site ID in " + site);
			return;
		    }
		    siteIdToAM[siteid] = manager;
		}
	    }
	    else if (site.length) {
		var siteid = $(site).attr("id");
		if (siteid === undefined) {
		    console.error("No site ID in " + site);
		    return;
		}
		sites[siteid] = siteid;
	    }
	});
	console.info("CreateAggregateSelectors2: ", count, bound, ammap);

	// All nodes bound, no dropdown.
	if (count == bound) {
	    $("#cluster_selector").addClass("hidden");
	    // Clear the form data.
	    $("#cluster_selector").html("");
	    // Tell the server not to whine about no aggregate selection.
	    $("#fully_bound").val("1");
	    // Need to set the "where" form field so that we pass the
	    // correct default aggregate to the backend.
	    if (_.size(ammap) == 1) {
		var manager = _.keys(ammap)[0];
		var name    = amlist[manager].name;
		
		$("#cluster_selector")
		    .html("<input name='where' type='hidden' " +
			  "value='" + name + "'>");
	    }
	    return;
	}

	// Clear for new profile.
	siteIdToSiteNum = {};
	var sitenum = 0;

	/*
	 * Create the dropdown selection lists. When only one choice, we
	 * force that choice. But if a slection has already been made, then
	 * we want to keep that as the selected cluster, its annoying to
	 * have it changed, since we call this multiple times (after
	 * constraints change, when the reservation info come in).
	 */
	var createDropdowns = function (selected) {
	    var gotfed   = 0;
	    var options  = "";
	    
	    _.each(amlist, function(details, urn) {
		/*
		 * Temp; do not show mobile if not an admin
		 */
		if (0 && details.ismobile == 1 && !isadmin) {
		    return;
		}
		/*
		 * Cluster restrictions for the selected project.
		 * This would make no sense on a single cluster
		 * portal (!MAINSITE).
		 */
		if (_.has(restrictions, pid)) {
		    if (!_.find(restrictions[pid],
				function(key) {
				    return urn == key;
				})) {
			console.info("Skipping cluster " + urn);
			return;
		    }
		}
		// Look for current or upcoming resgroups.
		var resgroup = null;
		if (_.has(resgroups.current, urn) &&
		    _.has(resgroups.current[urn], pid)) {
		    resgroup = {
			"which"   : "active",
			"class"   : "has_reservation",
			"project" : pid,
		    };
		}
		else if (_.has(resgroups.future, urn) &&
			 _.has(resgroups.future[urn], pid)) {
		    resgroup = {
			"which"   : "upcoming",
			"class"   : "future_reservation",
			"project" : pid,
		    };
		}

		//console.info("resgroup", resgroup, pid, urn);
		
		// If we see a federate, add the divider. Kinda gross.
		var addfed = 0;
		if (!gotfed && details.isfederate) {
		    addfed = gotfed = 1;
		}
		var name = details.name;
		options = options +
		    clusterTemplate({
			"name"     : name,
			"selected" : name === selected,
			"addfed"   : addfed,
			"urn"      : details.urn,
			"resgroup" : resgroup,
			"health"   : details["health"],
			"status"   : details["status"],
		    });
	    });
	    return options;
	};

	console.info(sites);
	console.info(ammap);

	// If multisite is disabled for the user, or no sites or 1 site.
	if (!multisite || Object.keys(sites).length == 0) {
	    var siteid = "nosite_selector";

	    /*
	     * Since we call this multiple times (after constraints change,
	     * when the reservation info come in), lets not change the
	     * selection if the user has already made one.
	     */
	    var selected;
	    if ($("#cluster_selector .select_where").length) {
		selected = $("#cluster_selector .select_where").val();
	    }
	    else {
		// Always default Powder dropdown to Emulab
		if (window.ISPOWDER) {
		    selected = "Emulab";
		}
	    }
	    var picker = $(siteTemplate({
		"siteid"    : siteid,
		"sitenum"   : sitenum,
		"multisite" : false,
		"clusters"  : createDropdowns(selected),
	    }));
	    $("#cluster_selector").html(picker);
	}
	else {
	    var pickers = [];
	    _.each(sites, function(siteid) {
		siteIdToSiteNum[siteid] = sitenum;
		var divID = '#site' + sitenum + 'cluster';

		/*
		 * Since we call this multiple times (after constraints change,
		 * when the reservation info come in), lets not change the
		 * selection if the user has already made one. 
		 */
		var selected;
		var hidden = false;
		if (_.has(siteIdToAM, siteid)) {
		    selected = amlist[siteIdToAM[siteid]].name;
		    hidden = true;
		}
		else if ($(divID).length) {
		    selected = $(divID + ' .select_where').val();
		}
		var picker = $(siteTemplate({
		    "siteid"    : siteid,
		    "sitenum"   : sitenum,
		    "multisite" : true,
		    "clusters"  : createDropdowns(selected),
		}));
		if (hidden) {
		    picker.addClass("hidden");
		}
		pickers.push(picker);
		sitenum++;
	    });
	    $("#cluster_selector").html("");
	    $("#cluster_selector").append(pickers);
	}
	$('#cluster_selector [data-toggle="tooltip"]').tooltip();	

	/* 
	 * When a choice is made, need to update the button contents 
	 * and the hidden form input.
	 */
	$("#cluster_selector .site-selector").find("ul li a")
	    .click(function (event) {
		event.preventDefault();
		var value    = $(this).attr("value");
		var urn      = $(this).closest("li").attr("urn");
		var tooltips = "";
		var where    = "";

		// Watch for reset back to "Please Select"
		if (value == "") {
		    value = "Please Select";
		    urn   = "";
		}
		else {
		    tooltips = $(this).find(".cluster-tooltips").html();
		    where   = value;
		}
		if ($(picker).find(".select_where").val() == where) {
		    // No change to be made. 
		    return;
		}
		var picker = $(this).closest(".site-selector");
		
		$(picker).find("button .value").html(value);
		$(picker).find("button .cluster-tooltips").html(tooltips);
		$(picker).find(".select_where").val(where);
		$(picker).find(".select_where").attr("urn", urn);
		$(picker).find("li").removeClass("selected");
		$(this).closest("li").addClass("selected");

		// Say something useful about current reservations
		generateReservationInfo(pid);
	    });

	/*
	 * Trigger any previous selections
	 */
	$("#cluster_selector .site-selector")
	    .find("ul li.selected").each(function () {
		$(this).find("a").click();
	    });
	$("#cluster_selector").removeClass("hidden");
    }

    function allClustersSelected() 
    {
	var allgood = 1;

	$('#cluster_selector').find('.select_where').each(function () {
	    if ($(this).val() == null || $(this).val() == "") {
		allgood = 0;
		return;
	    }
	});
	return allgood;
    }

    /*
     * Helper functions for above. Originally authored by Keith, but
     * cleaned up since then.
     */
    function calculateAggregateStatus(data)
    {
	var health        = 0;
	var status        = 0;
	var healthTooltip = "";
	var statusTooltip = "";
	var pickerClasses = [];

	if (! (data && _.size(data))) {
	    statusTooltip = "Testbed status unavailable";
	    pickerClasses = ['status_inactive', 'resource_inactive'];
	}
	else if (data.status == 'SUCCESS') {
	    if (data.health) {
		health = data.health;
		if (health > 50) {
		    healthTooltip = 'Testbed is healthy';
		    pickerClasses.push('status_healthy');
		}
		else if (health > 0) {
		    healthTooltip = 'Testbed is unhealthy';
		    pickerClasses.push('status_unhealthy');
		}
		else {
		    healthTooltip = 'Testbed is down';
		    pickerClasses.push('status_down');
		}
	    }
	    else {
		health = 100;
		healthTooltip = 'Testbed is up'
		pickerClasses.push('resource_healthy');
	    }
	    // Only care about PCs now. VMs are not interesting.
	    var available = parseInt(data.rawPCsAvailable);
	    var max       = parseInt(data.rawPCsTotal);
	    var ratio     = available / max;

	    status = available;
	    statusTooltip = available + "/" + max +
		"(" + Math.round(ratio*100) + '%) PCs available';

	    if (available > 20) {
		pickerClasses.push('resource_healthy');
	    }
	    else if (available > 10) {
		pickerClasses.push('resource_unhealthy');
	    }
	    else {
		pickerClasses.push('resource_down');
	    }
	}
	else {
	    healthTooltip = 'Testbed is down';
	    pickerClasses = ["resource_down", "status_down"];
	}
	return {
	    "health"        : health,
	    "status"        : status,
	    "healthTooltip" : healthTooltip,
	    "statusTooltip" : statusTooltip,
	    "pickerClasses" : pickerClasses.join(" "),
	};
    }

    /*
     * The idea here is to tell the user about current/active reservations
     * in the project they have selected, on the clusters they select. 
     */
    function generateReservationInfo(pid, res)
    {
	var warnings = [];

	if (res) {
	    resinfo = res;
	}
	if (pid == "") {
	    $('#reservation-warnings').addClass("hidden");
	    return;
	}

	$('#cluster_selector .site-selector').each(function () {
	    var urn   = $(this).find(".select_where").attr("urn");
	    var types = {};
	    
	    console.info("GenerateReservationInfo", urn);
	    
	    if (urn == "" || !_.has(resgroups.current[urn], pid)) {
		return;
	    }
	    /*
	     * Total up all reservations for each type reserved.
	     */
	    _.each(resgroups.current[urn][pid], function (group) {
		console.info(group);
		var type  = group.nodetype;
		var count = group.nodecount;

		if (!_.has(types, type)) {
		    types[type] = {"total" : 0, "rescount" : 0};
		}
		types[type].total    += count;
		types[type].rescount += 1;
	    });
	    console.info("GenerateReservationInfo", urn, types);

	    _.each(types, function (info, type) {
		var nodecount = info.total;
		var rescount  = info.rescount;
		var cluster   = amlist[urn].name;
		
		var text = "Project " + pid + " has " + rescount + " active " +
		    "reservation(s) at the " + cluster + " cluster for " +
		    nodecount + " " + type + " node(s)";

		/*
		 * If the reseservation info has come back, we also know
		 * how many of the type are in use.
		 */
		if (resinfo &&
		    _.has(resinfo, urn) &&
		    _.has(resinfo[urn].current, pid)) {
		    _.each(resinfo[urn].current[pid], function (cur) {
			if (cur.nodetype == type) {
			    text += " and is currently using " + cur.used;
			}
		    });
		}
		text += ".";
		warnings.push("<div class='alert alert-success alert-sm'>" +
			      text + "</div>");
	    });
	});
	if (_.size(warnings)) {
	    console.info("GenerateReservationInfo", warnings);
	    $('#reservation-warnings')
		.html(warnings.join(" "))
		.removeClass("hidden");
	}
	else {
	    $('#reservation-warnings').addClass("hidden");
	}
    }

    /*
     * When doing a modify, need to merge the new rspec with the old
     * one such that component_manager_ids for at least the nodes are
     * set from the manifest (since the rspec might not be one that
     * sets the manager_id. I do not think we need to worry about the
     * links or anything else.
     */
    function mergeRSpecAndManifest(rspec, manifest)
    {
	console.info("mergeRSpecAndManifest", rspec, manifest);
	/*
	 * Parse the rspec first and see if there are any nodes
	 * that need to be updates.
	 */
	var rspecNodes = {}
	var rspecDoc   = $.parseXML(rspec);

	/*
	 * Users are mostly going to add nodes to a single cluster
	 * experiment, or to a new cluster specified in the rspec ...
	 * So if there is only one cluster remember it, and set any
	 * unspecified new nodes to that cluster. 
	 */
	var sites = {};

	$(rspecDoc).find("node").each(function() {
	    var client_id    = $(this).attr("client_id");
	    var manager_id   = $(this).attr("component_manager_id");
	    var site         = this.getElementsByTagNameNS(JACKS_NS, 'site');
	    var siteid       = "__default__";

	    if (site.length) {
		siteid = $(site).attr("id");
		if (siteid === undefined) {
		    console.error("No site ID in " + site);
		    return;
		}
	    }
	    if (manager_id) {
		sites[siteid] = manager_id;
		return;
	    }
	    rspecNodes[client_id] = this;
	});
	if (!_.size(rspecNodes)) {
	    return rspec;
	}

	// Find the matching nodes in the manifest.
	var manifestDoc = $.parseXML(manifest);
	var modified    = false;

	$(manifestDoc).find("node").each(function() {
	    var client_id    = $(this).attr("client_id");
	    var manager_id   = $(this).attr("component_manager_id");
	    var site         = this.getElementsByTagNameNS(JACKS_NS, 'site');
	    var siteid       = "__default__";

	    if (site.length) {
		siteid = $(site).attr("id");
		if (siteid === undefined) {
		    console.error("No site ID in " + site);
		    return;
		}
	    }
	    
	    if (_.has(rspecNodes, client_id)) {
		var node = rspecNodes[client_id];
		
		$(node).attr("component_manager_id", manager_id);
		delete rspecNodes[client_id];
		modified = true;
		sites[siteid] = manager_id;
	    }
	});
	console.info("sites", sites);
	
	if (_.size(rspecNodes)) {
	    _.each(rspecNodes, function (node) {
		var site       = node.getElementsByTagNameNS(JACKS_NS, 'site');
		var siteid     = undefined;
		var manager_id = undefined;

		if (site.length) {
		    siteid = $(site).attr("id");
		    if (siteid === undefined) {
			console.error("No site ID in " + site);
			return;
		    }
		}
		console.info("siteid", siteid);
		/*
		 * A properly formed rspec will have site ids if the user
		 * wants more then one cluster and is waiting to bind them
		 * until instantiation or modify time. Without site ids
		 * we just have to guess. 
		 */
		if (siteid) {
		    if (_.has(sites, siteid)) {
			manager_id = sites[siteid];
		    }
		}
		else if (_.has(sites, "__default__")) {
		    manager_id = sites["__default__"];
		}
		if (manager_id) {
		    $(node).attr("component_manager_id", manager_id);
		    modified = true;
		}
	    });
	}
	if (modified) {
	    rspec = (new XMLSerializer()).serializeToString(rspecDoc);
	}
	return rspec;
    }

    /*
     * Set the component_manager_id for the site selectors.
     * On the "instantiate" path we do this in the backend, but seems
     * easier to do it here instead, rather then passing the hacky
     * "sites[]" array through to create_instance. 
     */
    function setSites(rspec)
    {
	console.info("setSites", rspec);

	if ($('#cluster_selector').find('.select_where').length == 0) {
	    console.info("setSites: no sites to set");
	    return rspec;
	}

	/*
	 * Get the selected urns.
	 */
	var sites = {};

	$('#cluster_selector').find('.select_where').each(function () {
	    var siteid = $(this).attr("data-siteid");
	    var urn    = $(this).attr("urn");
	    sites[siteid] = urn;
	});
	console.info("setSites", sites);
	
	/*
	 * Parse the rspec first and see if there are any nodes
	 * that need to be updates.
	 */
	var rspecDoc   = $.parseXML(rspec);

	$(rspecDoc).find("node").each(function() {
	    var manager_id   = $(this).attr("component_manager_id");
	    var site         = this.getElementsByTagNameNS(JACKS_NS, 'site');

	    if (manager_id || !site.length) {
		return;
	    }
	    siteid = $(site).attr("id");
	    if (!_.has(sites, siteid)) {
		console.info("setSites, no cluster for " + siteid);
		return;
	    }
	    $(this).attr("component_manager_id", sites[siteid]);
	    modified = true;
	});
	if (modified) {
	    rspec = (new XMLSerializer()).serializeToString(rspecDoc);
	}
	console.info("setSites, new rspec", rspec);
	return rspec;
    }

    // Exports from this module for use elsewhere
    return {
	initialize               : initialize,
	setClusters              : setClusters,
	checkForRadioUsage       : checkForRadioUsage,
	createAggregateSelectors : createAggregateSelectors,
	generateReservationInfo  : generateReservationInfo,
	mergeRSpecAndManifest    : mergeRSpecAndManifest,
	allClustersSelected      : allClustersSelected,
	setSites                 : setSites,
    };
})();
});


