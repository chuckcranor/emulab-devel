$(function () {
window.ShowPowderMap = (function()
{
    'use strict';

    var templates      = APT_OPTIONS.fetchTemplateList(['powder-filters']);
    //var PowderMap      = "ede4026643ec40f7b73ab12d6c01b1da";
    var PowderMap      = "6bb70a0d4abf42fa9efb159db1f169f6";
    var Container      = null;
    var Options        = null;
    var View           = null;
    var Map            = null;
    var Graphic        = null;
    var GraphicsLayer  = null;
    var WatchUtils     = null;
    var ResInfo        = null;
    var LOCATION_URL   = "https://www.uofubus.com/Services/JSONPRelay.svc/" +
	"GetMapVehiclePoints?ApiKey=ride1791";
    var ROUTES_URL     = "https://www.uofubus.com/Services/JSONPRelay.svc/" +
	"GetRoutesForMapWithScheduleWithEncodedLine?ApiKey=ride1791";
    
    // These are the routes we care about. 
    var routeList      = {"19" : null,
			  "64" : null,
			  "65" : null,
			  "66" : null,
			  "68" : null,
			  "72" : null};
    /*
     * These are layers we need to control externally.
     */
    var Layers = {
	"FE"  : {
	    "data"   : null,	// Raw data
	    "all"    : null,
	    "filter" : null,
	},
	"BS"  : {
	    "data"   : null,	// Raw data
	    "all"    : null,
	    "filter" : null,
	},
    };

    // x,y is the point to test
    // cx, cy is circle center, and radius is circle radius
    function pointInCircle(x, y, cx, cy, radius)
    {
	//console.info("pointInCircle", x, y, cx, cy, radius);
	
	var distancesquared = (x - cx) * (x - cx) + (y - cy) * (y - cy);
	return distancesquared <= radius * radius;
    }		

    function DrawBaseMap(route)
    {
	require([
	    "dojo/number",
	    "esri/WebMap",
	    "esri/views/MapView",
	    "esri/Graphic",
	    "esri/layers/GraphicsLayer",
	    "esri/widgets/LayerList",
	    "esri/widgets/Home",
	    "esri/widgets/Expand",
            "esri/widgets/DistanceMeasurement2D",
            "esri/widgets/ScaleBar",
	    "esri/core/watchUtils",
  	    "dojo/domReady!"
	], function (number, WebMap, MapView, graphic,
		     graphicslayer, LayerList,
		     Home, Expand, Distance2D, ScaleBar, watchutils) {
	    Graphic       = graphic;
	    GraphicsLayer = graphicslayer;
	    WatchUtils    = watchutils;

	    // Need this later for filtering
	    if (Options.showreserved) {
		var callback = function (json) {
		    console.info("reserve info", json);
		    if (json.code) {
			console.info("Could not get resinfo: " + json.value);
			return;
		    }
		    ResInfo = json.value;
		};
		sup.CallServerMethod(null, "resgroup",
				     "ListReservationGroups",
				     {"useronly" : true}, callback);
	    }
	    
	    Map = new WebMap({
		basemap: "gray",
		portalItem: {
		    // autocasts as new PortalItem()
		    id: PowderMap
		}
            });
            View = new MapView({
		map: Map,
		zoom: 15,
		// Slightly shifted to the left to avoid being covered
		// by the filter/layer widgets.
		center: [-111.84000, 40.763451],
		container: Container,
	    });
	    // Do not show any of the the base layers in the Legend.
	    Map.load().then(function () {
		Map.allLayers.forEach(function (layer) {
		    layer.listMode = "hide";
		});
	    });
	    View.when(function() {
		if (Options.showlegend) {
		    // Layer list to turn them on and off.
		    var layerList = new LayerList({
			view: View
		    });
		    var expand = new Expand({
			expandIconClass: "esri-icon-layer-list",
			view: View,
			content: layerList,
			expanded: true
		    });
		    // Add widget to the top right corner of the view
		    View.ui.add(expand, "top-right");
		}
		var homeWidget = new Home({
		    view: View
		});
		View.ui.add(homeWidget, "top-left");

		var scalebar = new ScaleBar({
		    view: View,
		    unit: "dual",
		});
		View.ui.add(scalebar, "bottom-left");

		// Add a distance widget button.
		var button =
		    $('<button class="action-button esri-icon-measure-line" '+
		      '        id="distanceButton" '+
		      '   title="Measure distance between two or more points" '+
		      '        type="button"></button>');
		View.ui.add($(button).get(0), "top-left");

		var distanceWidget = null;

		$('#distanceButton').click(function (event) {
		    console.info("distance");

		    if (distanceWidget) {
			View.ui.remove(distanceWidget);
			distanceWidget.destroy();			
			distanceWidget = null;
		    }
		    else {
			distanceWidget = new Distance2D({
			    view: View,
			    unit: "yards",
			});
			console.info(distanceWidget);

			// skip the initial 'new measurement' button
			distanceWidget.viewModel.newMeasurement();
			
			// Show the actual widget under the button.
			View.ui.add(distanceWidget, "top-left");

			// Very silly, there is no API to change the
			// instructions, which are incomplete.
			window.setTimeout(function() {
			    var text =
				$(".esri-distance-measurement-2d__hint-text")
				.text();

			    text += ". Double click to end measurement.";
			    $(".esri-distance-measurement-2d__hint-text")
				.text(text);
			}, 25);
		    }
		});

		// Base layers
		DrawCoverageArea();
		DrawDataCenters();
		DrawFixedEndpoints();
		DrawBaseStations();

		if (Options.showfilter) {
		    var wrapper = document.createElement("div");
		    $(wrapper).html(templates['powder-filters']);
		    $(wrapper).css("width", "230px");

		    var expand = new Expand({
			expandIconClass: "esri-icon-filter",
			view: View,
			content: wrapper,
			expanded: true
		    });
		    View.ui.add(expand, "bottom-right");
		}

		// And now we can get the route data.
		if (Options.showmobile) {
		    GetRouteData(SetupRoutes);
		}
	    });

	    if (Options.showmobile) {
		View.on("click", function (event) {
		    //console.info("clicked", event);
		    var x = event.x;
		    var y = event.y;
		    var bus = null;

		    _.each(routeList, function (route) {
			_.each(route.buses, function (b) {
			    //console.info("bus", b);
			    var point = View.toScreen(b.pointGraphic.geometry);
			    var cx    = point.x;
			    var cy    = point.y;

			    if (pointInCircle(x, y, cx, cy, 5)) {
				console.info("cool", b);
				bus = b;
				return;
			    }
			});
		    });
		    if (bus) {
			event.stopPropagation();
			DrawPopup(bus.RouteID, bus.Name);
		    }
		});
	    }
	});
    }

    /*
     * Setup the filtering options events.
     */
    function SetupFilteringOptions()
    {
	console.info("SetupFilteringOptions");
	
	var filter = function () {
	    UnmarkFixedEndpoints();
	    UnmarkBaseStations();
	    FilterFixedEndpoints();
	    FilterBaseStations();
	};
	$('.radio-type, .range-one input, .range-two input')
	    .change(function (event) {
		filter();
	    });

	var keyup_timeout = null;
	
	$('.range-low, .range-high').on("keyup", function (event) {
	    window.clearTimeout(keyup_timeout);

	    keyup_timeout =
		window.setTimeout(function() {
		    filter();
		}, 200);
	});

	if (Options.showreserved) {
	    $('#show-reserved-checkbox').removeClass("hidden");
	}

	/*
	 * I hate radio buttons cause not allowed to deselect.
	 * But this choice needs to be a radio selection.
	 */
	$('#show-available, #show-reserved').change(function (event) {
	    var availChecked = $('#show-available').is(":checked");
	    var resChecked   = $('#show-reserved').is(":checked");
	    var which        = $(event.target).attr("id");

	    if (availChecked && resChecked) {
		if (which == "show-available") {
		    $('#show-reserved').prop("checked", false);
		}
		else {
		    $('#show-available').prop("checked", false);
		}
	    }
	    filter();
	});
    }

    /*
     * Draw the coverage area
     */
    function DrawCoverageArea()
    {
	var layer = GraphicsLayer({
	    title: "Coverage Area",
	});
	var symbol = {
	    type: "simple-line",
	    color: "green",
	    width: 2
	};
	var line = {
	    type: "polyline",
	    paths: [[-111.856023, 40.775713],
		    [-111.826851, 40.775713],
		    [-111.826851, 40.754204],
		    [-111.856023, 40.754204],
		    [-111.856023, 40.775713],
		   ]
	};
	var graphic = new Graphic({
	    geometry:      line,
	    symbol:        symbol,
	});
	layer.listMode = "hide";
	layer.add(graphic);
	Map.add(layer);
    }

    /*
     * Draw the datacenters. This is hardwired here, they ain't going anyplace.
     */
    var dataCenters = [
	{
	    "ID": "Fort Douglas Data Center",
	    "Y": 40.7659667,
	    "X": -111.830693,
	    "Type": "Compute Resources",
	    "Details": "https://docs.powderwireless.net/hardware.html#%28part._powder-ne-hw%29"
	},
	{
	    "ID": "MEB Data Center",
	    "Y": 40.7685099,
	    "X": -111.8464161,
	    "Type": "Compute Resources",
	    "Details": "https://docs.powderwireless.net/hardware.html#%28part._powder-ne-hw%29"
	}
    ];
    
    function DrawDataCenters()
    {
	var layer = GraphicsLayer({
	    title: "Data Centers",
	});
	var symbol = {
	    type: "picture-marker",
	    url: "images/datacenter.png",
	    width: "24px",
	    height: "24px",
	};
	_.each(dataCenters, function (details) {
	    var point = {
		type: "point", // autocasts as new Point()
		longitude: details.X,
		latitude: details.Y,
            };
	    var attributes = {
		name        : details.ID,
		description : details.Type,
		latitude    : details.X,
		longitude   : details.Y,
		url         : details.Details,
	    };
	    var popup = {
		title: details.ID,
		content: [{
		    type: "fields",
		    fieldInfos: [
			{
			    fieldName: "name",
			    label: "Name"
			},
			{
			    fieldName: "description",
			    label: "Description"
			},
			{
			    fieldName: "latitude",
			    label: "Latitude"
			},
			{
			    fieldName: "longitude",
			    label: "Longitude"
			},
			{
			    fieldName: "url",
			    label: "Details"
			},
		    ],
		}],
	    };
	    var graphic = new Graphic({
		geometry:      point,
		symbol:        symbol,
		attributes:    attributes,
		popupTemplate: popup,
	    });
	    layer.add(graphic);
	});
	Map.add(layer);
    }
     
    function DrawFixedEndpoints()
    {
	var url = "https://docs.powderwireless.net/hardware.html" +
	    "#%28part._powder-fe-hw%29";
	
	var layer = GraphicsLayer({
	    title: "Fixed Endpoints",
	})
	// Hidden layer to mark filtered FEs
	var filter = GraphicsLayer({
	    title: "Filtered Fixed Endpoints",
	})
	filter.listMode = "hide";
	Map.add(filter);
	Layers["FE"].filter = filter;

	// Add now so it goes into the legend in the correct order, and
	// on top of the filter layer.
	Map.add(layer);
	Layers["BS"].all = layer;

	// Turn on/off the filter layer when the main layer is turned on/off.
        WatchUtils.init(layer, "visible", function(visible) {
	    filter.visible = visible;
	});

	var callback = function (json) {
	    // XXX
	    if (Options.showfilter) {
		SetupFilteringOptions();
	    }
	    
	    console.info("DrawFixedEndpoints", json);
	    if (json.code) {
		console.info("Could not get fixed endpoints: " + json.value);
		return;
	    }
	    var endpoints = json.value;
	    Layers["FE"].data = endpoints;
	    
	    var symbol = {
		type: "picture-marker",
		url: "images/cell.png",
		width: "24px",
		height: "24px",
	    };
	    _.each(endpoints, function (details) {
		var mapurl = " https://maps.google.com/maps?q=" +
		    details.latitude + "," + details.longitude;
		
		var point = {
		    type: "point", // autocasts as new Point()
		    longitude: details.longitude,
		    latitude: details.latitude,
		};
		var attributes = {
		    nickname    : details.nickname,
		    description : "Ground Level Fixed Endpoint",
		    equipment   : "B210 SDR",
		    latitude    : details.latitude,
		    longitude   : details.longitude,
		    mapurl      : mapurl,
		    url         : url,
		};
		var popupcontent = [
			{
			    type: "fields",
			    fieldInfos: [
				{
				    fieldName: "nickname",
				    label: "Nickname"
				},
				{
				    fieldName: "description",
				    label: "Description"
				},
				{
				    fieldName: "equipment",
				    label: "Equipment"
				},
				{
				    fieldName: "latitude",
				    label: "Latitude"
				},
				{
				    fieldName: "longitude",
				    label: "Longitude"
				},
				{
				    fieldName: "mapurl",
				    label: "Google Map"
				},
				{
				    fieldName: "url",
				    label: "Hardware Details"
				},
			    ],
			},
		];
		// Add additional tables for the radio info.
		if (details.radioinfo) {
		    _.each(details.radioinfo, function (info, index) {
			var node_id = info.node_id;
			var prefix  = "radioinfo " + node_id + " ";

			attributes[prefix + "node_id"]    = node_id;
			attributes[prefix + "radio_type"] = info.radio_type;
			attributes[prefix + "tx_freq"] =
			    info.transmit_frequencies;
			attributes[prefix + "rx_freq"] =
			    info.receive_frequencies;
			attributes[prefix + "notes"] = info.notes;
			attributes[prefix + "free"]  =
			    (details.reservable_nodes[node_id].available ?
			     "Yes" : "No");

			var content = {
			    type: "fields",
			    fieldInfos: [
				{
				    fieldName: prefix + "node_id",
				    label: "Node ID"
				},
				{
				    fieldName: prefix + "free",
				    label: "Available?"
				},
				{
				    fieldName: prefix + "radio_type",
				    label: "Radio Type"
				},
				{
				    fieldName: prefix + "tx_freq",
				    label: "TX Frequencies"
				},
				{
				    fieldName: prefix + "rx_freq",
				    label: "RX Frequencies"
				},
				{
				    fieldName: prefix + "notes",
				    label: "Notes"
				},
			    ]
			};
			popupcontent.push(content);

			/*
			 * Parse the comma separated strings into arrays
			 * of low/high frequency info.
			 */
			info["txRanges"] = [];
			info["rxRanges"] = [];

			if (info.transmit_frequencies != "") {
			    _.each(info.transmit_frequencies.split(","),
				   function (range) {
				       var tokens = range.split("-");

				       info.txRanges.push({
					   "low"  : parseInt(tokens[0]),
					   "high" : parseInt(tokens[1]),
				       });
				   });
			}
			if (info.receive_frequencies != "") {
			    _.each(info.receive_frequencies.split(","),
				   function (range) {
				       var tokens = range.split("-");

				       info.rxRanges.push({
					   "low"  : parseInt(tokens[0]),
					   "high" : parseInt(tokens[1]),
				       });
				   });
			}
		    });
		}
		//console.info(attributes, popupcontent);
		
		var popup = {
		    title: details.name,
		    content: popupcontent,
		};
		var graphic = new Graphic({
		    geometry:      point,
		    symbol:        symbol,
		    attributes:    attributes,
		    popupTemplate: popup,
		});
		layer.add(graphic);
		
		// Add label text below the icon
		var textGraphic = new Graphic({
		    geometry: {
			type: "point",
			longitude: details.longitude,
			latitude: details.latitude,
		    },
		    symbol: {
			type: "text",
			color: [25,25,25],
			text: details.name,
			xoffset: 0,
			yoffset: -15,
			font: {
			    size: 8,
			    weight: "bold",
			}
		    }
		});
		layer.add(textGraphic);
	    });
	};
    	sup.CallServerMethod(null, "map-support", "GetFixedEndpoints",
			     null, callback);
    }

    /*
     * Mark an FE on the filter layer.
     */
    function MarkFixedEndpoint(name, partial)
    {
	var endpoints = Layers["FE"].data;
	var layer     = Layers["FE"].filter;
	var endpoint  = null;

	_.each(endpoints, function (details) {
	    if (details.name == name) {
		endpoint = details;
	    }
	});
	if (!endpoint) {
	    console.info("MarkFixedEndpoint: Could not find " + name);
	    return;
	}
	// First create a point geometry (location of the FE).
        var point = {
            type:	"point", // autocasts as new Point()
            longitude:  endpoint.longitude,
            latitude:   endpoint.latitude,
        };

        // Create a symbol for drawing a circle around it
        var symbol = {
            type:	"simple-marker",
            color:	[0, 0, 0, 0],
	    size:       "34px",
            outline: {
		color: (partial ? "purple" : "green"),
		width: 3,
            }
        };
	var graphic = new Graphic({
	    geometry:      point,
	    symbol:        symbol,
	});
	layer.add(graphic);
    }
    function UnmarkFixedEndpoints()
    {
        Layers["FE"].filter.removeAll();
    }

    /*
     * Filter the Fixed Endpoints. Work in progress.
     */
    function FilterFixedEndpoints()
    {
	var endpoints = Layers["FE"].data;
	var layer     = Layers["FE"].filter;

	_.each(endpoints, function (details, urn) {
	    var showme = 0;
	    
	    if (details.radioinfo) {
		_.each(details.radioinfo, function (info, index) {
		    var node_id = info.node_id;

		    // Basically an "and" of all marked clauses.
		    var passed = undefined;
		    var update = function (val) {
			val = (val ? true : false);
			
			if (passed === undefined) {
			    passed = val;
			    return;
			}
			if (passed == false) {
			    return;
			}
			passed = val;
		    };

		    if ($('#show-available').is(":checked")) {
			update(details.reservable_nodes[node_id].available);
		    }
		    if (Options.showreserved &&
			$('#show-reserved').is(":checked")) {
			update(isReserved(urn, node_id));
		    }
		    if ($('.radio-type').is(":checked")) {
			var found = false;
			
			$('.radio-type').each(function () {
			    var type = $(this).data("radio-type");
			    var checked = $(this).is(":checked");

			    if (checked) {
				var radio = info.radio_type;
				if (radio.includes(type)) {
				    found = true;
				}
			    }
			});
			update(found);
		    }
		    if ($('.range-one .range-checkbox').is(":checked") &&
			$.trim($('.range-one .range-low').val()) != "" &&
			$.trim($('.range-one .range-high').val()) != "") {
			FilterRange(".range-one", info, update);
		    }
		    if ($('.range-two .range-checkbox').is(":checked") &&
			$.trim($('.range-two .range-low').val()) != "" &&
			$.trim($('.range-two .range-high').val()) != "") {
			FilterRange(".range-two", info, update);
		    }
		    // Only one node has to pass all tests
		    if (passed === true) {
			showme++;
		    }
		});
	    }
	    if (showme) {
		MarkFixedEndpoint(details.name,
				  showme != _.size(details.radioinfo));
	    }
	});
    }
    function FilterRange(which, info, updater)
    {
	var tx       = $(which + " .range-tx").is(":checked");
	var rx       = $(which + " .range-rx").is(":checked");
	var low      = parseInt($.trim($(which + " .range-low").val()));
	var high     = parseInt($.trim($(which + " .range-high").val()));
	var txRanges = info.txRanges;
	var rxRanges = info.rxRanges;

	if (low > high) {
	    // silent ignore.
	    return;
	}

	//console.info("FilterRange", info, tx, rx, low, high);

	if (tx) {
	    if (_.size(txRanges)) {
		_.each(txRanges, function (range) {
		    updater(low  >= range.low && low  <= range.high &&
			    high >= range.low && high <= range.high);
		});
	    }
	    else {
		updater(false);
	    }
	}
	if (rx) {
	    if (_.size(rxRanges)) {
		_.each(rxRanges, function (range) {
		    updater(low  >= range.low && low  <= range.high &&
			    high >= range.low && high <= range.high);
		});
	    }
	    else {
		updater(false);
	    }
	}
    }
    // This could be optimized a bit. 
    function isReserved(urn, node_id)
    {
	//console.info("isReserved", urn, node_id);
	var result = false;

	_.each(ResInfo, function (resgroup) {
	    if (result) {
		return;
	    }
	    if (resgroup.clusters) {
		_.each(resgroup.clusters, function (res) {
		    if (res.cluster_urn == urn && res.type == node_id) {
			result = true;
			return;
		    }
		});
	    }
	});
        return result;
    }
     
    /*
     * Draw the Base Stations
     */
    function DrawBaseStations()
    {
	var url = "https://docs.powderwireless.net/hardware.html" +
	    "#%28part._powder-bs-hw%29";
	var layer = GraphicsLayer({
	    title: "Base Stations",
	})

	// Hidden layer to mark filtered BSs
	var filter = GraphicsLayer({
	    title: "Filtered Base Stations",
	})
	filter.listMode = "hide";
	Map.add(filter);
	Layers["BS"].filter = filter;

	// Add now so it goes into the legend in the correct order, and
	// on top of the filter layer.
	Map.add(layer);
	Layers["BS"].all = layer;

	// Turn on/off the filter layer when the main layer is turned on/off.
        WatchUtils.init(layer, "visible", function(visible) {
	    filter.visible = visible;
	});

	var callback = function (json) {
	    console.info("DrawBaseStations", json);
	    if (json.code) {
		console.info("Could not get base stations: " + json.value);
		return;
	    }
	    var baseStations = json.value;
	    Layers["BS"].data = baseStations;

	    var symbol = {
		type: "picture-marker",
		url: "images/base-station.png",
		width: "24px",
		height: "24px",
	    };
	    _.each(baseStations, function (details) {
		var point = {
		    type: "point", // autocasts as new Point()
		    latitude: details.latitude,
		    longitude: details.longitude,
		};
		var attributes = {
		    name        : details.name,
		    description : details.type,
		    longitude   : details.longitude,
		    latitude    : details.latitude,
		    url         : url,
		    mapurl      : details.street,
		};
		var popupcontent = [
			{
			    type: "fields",
			    fieldInfos: [
				{
				    fieldName: "name",
				    label: "Name"
				},
				{
				    fieldName: "description",
				    label: "Description"
				},
				{
				    fieldName: "latitude",
				    label: "Latitude"
				},
				{
				    fieldName: "longitude",
				    label: "Longitude"
				},
				{
				    fieldName: "mapurl",
				    label: "Street View"
				},
				{
				    fieldName: "url",
				    label: "Hardware Details"
				},
			    ],
			},
		];
		// Add additional tables for the radio info.
		if (details.radioinfo) {
		    _.each(details.radioinfo, function (info, index) {
			var node_id = info.node_id;
			var prefix  = "radioinfo " + node_id + " ";

			attributes[prefix + "node_id"]    = node_id;
			attributes[prefix + "radio_type"] = info.radio_type;
			attributes[prefix + "tx_freq"] =
			    info.transmit_frequencies;
			attributes[prefix + "rx_freq"] =
			    info.receive_frequencies;
			attributes[prefix + "notes"] = info.notes;
			attributes[prefix + "free"]  =
			    (info.available ? "Yes" : "No");

			var content = {
			    type: "fields",
			    fieldInfos: [
				{
				    fieldName: prefix + "node_id",
				    label: "Node ID"
				},
				{
				    fieldName: prefix + "free",
				    label: "Available?"
				},
				{
				    fieldName: prefix + "radio_type",
				    label: "Radio Type"
				},
				{
				    fieldName: prefix + "tx_freq",
				    label: "TX Frequencies"
				},
				{
				    fieldName: prefix + "rx_freq",
				    label: "RX Frequencies"
				},
				{
				    fieldName: prefix + "notes",
				    label: "Notes"
				},
			    ]
			};
			popupcontent.push(content);

			/*
			 * Parse the comma separated strings into arrays
			 * of low/high frequency info.
			 */
			info["txRanges"] = [];
			info["rxRanges"] = [];
			
			_.each(info.transmit_frequencies.split(","),
			       function (range) {
				   var tokens = range.split("-");

				   info.txRanges.push({
				       "low"  : tokens[0],
				       "high" : tokens[1]
				   });
			       });
			_.each(info.receive_frequencies.split(","),
			       function (range) {
				   var tokens = range.split("-");

				   info.rxRanges.push({
				       "low"  : tokens[0],
				       "high" : tokens[1]
				   });
			       });
		    });
		}
		var popup = {
		    title: details.name,
		    content: popupcontent,
		};
		var graphic = new Graphic({
		    geometry:      point,
		    symbol:        symbol,
		    attributes:    attributes,
		    popupTemplate: popup,
		});
		layer.add(graphic);

		// Add label text below the icon
		var textGraphic = new Graphic({
		    geometry: {
			type: "point",
			longitude: details.longitude,
			latitude: details.latitude,
		    },
		    symbol: {
			type: "text",
			color: [25,25,25],
			text: details.name,
			xoffset: 0,
			yoffset: 10,
			font: {
			    size: 8,
			    weight: "bold",
			}
		    }
		});
		layer.add(textGraphic);
	    });
	};
	sup.CallServerMethod(null, "map-support", "GetBaseStations",
			     null, callback);
    }
    /*
     * Mark a BS on the filter layer.
     */
    function MarkBaseStation(name, partial)
    {
	var basestations = Layers["BS"].data;
	var layer        = Layers["BS"].filter;
	var basestation  = null;

	_.each(basestations, function (details) {
	    if (details.name == name) {
		basestation = details;
	    }
	});
	if (!basestation) {
	    console.info("MarkBaseStation: Could not find " + name);
	    return;
	}
	// First create a point geometry (location of the BS).
        var point = {
            type:	"point", // autocasts as new Point()
            longitude:  basestation.longitude,
            latitude:   basestation.latitude,
        };

        // Create a symbol for drawing a circle around it
        var symbol = {
            type:	"simple-marker",
            color:	[0, 0, 0, 0],
	    size:       "34px",
            outline: {
		// autocasts as new SimpleLineSymbol()
		color: (partial ? "purple" : "green"),
		width: 3,
            }
        };
	var graphic = new Graphic({
	    geometry:      point,
	    symbol:        symbol,
	});
	layer.add(graphic);
    }
    function UnmarkBaseStations()
    {
        Layers["BS"].filter.removeAll();
    }
    function FilterBaseStations()
    {
	var basestations = Layers["BS"].data;
	var layer        = Layers["BS"].filter;
	
	_.each(basestations, function (details) {
	    var showme = 0;
	    
	    if (details.radioinfo) {
		_.each(details.radioinfo, function (info, index) {
		    var node_id = info.node_id;

		    // Basically an "and" of all marked clauses.
		    var passed = undefined;
		    var update = function (val) {
			val = (val ? true : false);
			
			if (passed === undefined) {
			    passed = val;
			    return;
			}
			if (passed == false) {
			    return;
			}
			passed = val;
		    };

		    if ($('#show-available').is(":checked")) {
			update(info.available);
		    }
		    if (Options.showreserved &&
			$('#show-reserved').is(":checked")) {
			update(isReserved(details.cluster_urn, node_id));
		    }
		    if ($('.radio-type').is(":checked")) {
			var found = false;
			
			$('.radio-type').each(function () {
			    var type = $(this).data("radio-type");
			    var checked = $(this).is(":checked");

			    if (checked) {
				var radio = info.radio_type;
				if (radio.includes(type)) {
				    found = true;
				}
			    }
			});
			update(found);
		    }
		    if ($('.range-one .range-checkbox').is(":checked") &&
			$.trim($('.range-one .range-low').val()) != "" &&
			$.trim($('.range-one .range-high').val()) != "") {
			FilterRange(".range-one", info, update);
		    }
		    if ($('.range-two .range-checkbox').is(":checked") &&
			$.trim($('.range-two .range-low').val()) != "" &&
			$.trim($('.range-two .range-high').val()) != "") {
			FilterRange(".range-two", info, update);
		    }
		    // Only one node has to pass all tests
		    if (passed === true) {
			showme++;
		    }
		});
	    }
	    if (showme) {
		MarkBaseStation(details.name,
				showme != _.size(details.radioinfo));		
	    }
	});
    }

    /*
     * Get the route lists and draw each route.
     */
    function SetupRoutes(data)
    {
	console.info("SetupRoutes", data);

	// Grab the routes we care about and draw the paths.
	_.each(data, function(route) {
	    var routeID = route.RouteID;
	    
	    if (_.has(routeList, routeID)) {
		routeList[routeID] = {
		    "data"  : route,
		    "path"  : polylineDecode(route.EncodedPolyline),
		    "layer" : null,
		    "buses" : {},
		};
		DrawRoute(routeID);
	    }
	});
	PollLocationData();
	console.info("view", View);
	console.info("map", Map);
	
    }
    function GetRouteData(handler)
    {
	$.getJSON(ROUTES_URL, function (data) {
	    handler(data);
	});
    }

    /*
     * Draw a single route path on the basemap.
     */
    function DrawRoute(routeID)
    {
	console.info("DrawRoute", routeID, routeList[routeID]);

	var name  = routeList[routeID].data.Description;
	var path  = routeList[routeID].path;
	var layer = GraphicsLayer({
	    title: name,
	})

	var symbol = {
	    type: "simple-line",
	    color: routeList[routeID].data.MapLineColor,
	    width: 2
	};
	var line = {
	    type: "polyline",
	    paths: [path]
	};
	var graphic = new Graphic({
	    geometry:   line,
	    symbol:     symbol,
	});
	layer.visible = false;
	layer.add(graphic);
	Map.add(layer);
	routeList[routeID].layer = layer;

	// start with Red showing.
	if (routeID == 68) {
	    ShowRoute(routeID);
	}
    }
    function ShowRoute(routeID)
    {
	var layer = routeList[routeID].layer;
	
	layer.visible = true;
    }
    function HideRoute(routeID)
    {
	var layer = routeList[routeID].layer;
	
	layer.visible = false;
    }

    /*
     * Periodically update the location info and move the dots.
     */
    function UpdateLocationData()
    {
	$.ajax({
	    dataType: "json",
	    url: LOCATION_URL,
	    cache: false,
	    success: function (data) {
		//console.info("PollLocationData", data);
		_.each(data, function (bus) {
		    var routeID = bus.RouteID;

		    if (_.has(routeList, routeID)) {
			UpdateBusLocation(routeID, bus);
		    }
		});
	    }
	});
    }
    function PollLocationData()
    {
	UpdateLocationData();
	setInterval(UpdateLocationData, 5000);
    }

    /*
     * Move (add) one bus on a route.
     */
    function UpdateBusLocation(routeID, data)
    {
	var layer        = routeList[routeID].layer;
	var buses        = routeList[routeID].buses;
	var color        = routeList[routeID].data.MapLineColor;
	var routeDesc    = routeList[routeID].data.Description;
	var busname      = data.Name;

	var point = {
	    type:      "point", // autocasts as new Point()
	    longitude: data.Longitude,
	    latitude:  data.Latitude
        };
        var markerSymbol = {
	    type: "simple-marker", // autocasts as new SimpleMarkerSymbol()
	    color: color,
	    size: 8
	};
	var attributes = {
	    routeID     : routeID,
	    busname     : busname,
	    routeDesc   : routeDesc,
	    latitude    : data.Latitude,
	    longitude   : data.Longitude,
	    groundSpeed : data.GroundSpeed,
	    heading     : data.Heading,
	    earthurl    : " https://earth.google.com/web/search/" +
		data.Latitude + "," + data.Longitude,
	    mapurl      : " https://maps.google.com/maps?q=" +
		data.Latitude + "," + data.Longitude,
	};
	var popup = {
	    title: "Bus " + busname + " on " + routeDesc,
	    content: [{
		type: "fields",
		fieldInfos: [
                    {
			fieldName: "busname",
			label: "Bus Name"
                    },
                    {
			fieldName: "routeDesc",
			label: "Route"
                    },
                    {
			fieldName: "latitude",
			label: "Latitude"
                    },
                    {
			fieldName: "longitude",
			label: "Longitude"
                    },
                    {
			fieldName: "groundSpeed",
			label: "Speed"
                    },
                    {
			fieldName: "heading",
			label: "Heading"
                    },
                    {
			fieldName: "mapurl",
			label: "Google Map"
                    },
                    {
			fieldName: "earthurl",
			label: "Google Earth"
                    },
		],
	    }],
	}
        var pointGraphic = new Graphic({
	    geometry:   point,
	    symbol:     markerSymbol,
	    attributes: attributes,
	    popupTemplate: popup,
        });
	// Kill the old point.
	if (_.has(buses, busname)) {
	    var oldpointGraphic = buses[busname].pointGraphic;
	    layer.remove(oldpointGraphic);
	}
	// Add the new point and remember it
	data.pointGraphic = pointGraphic;
	routeList[routeID].buses[busname] = data;
	layer.add(pointGraphic);
    }

    /*
     * This is called from the click handlerr above, to show the popup
     * associated with the point graphic.
     */
    function DrawPopup(routeID, Name)
    {
	console.info("DrawPopup", routeID, Name);
	
	var bus     = routeList[routeID].buses[Name];
	var graphic = bus.pointGraphic;

	View.popup.open({
            location: graphic.geometry,
            features: [graphic],
	});
    }

    /*
     * Draw the fake bus motion.
     */
    function DrawFake(routeID)
    {
	var layer        = routeList[routeID].layer;
	var path         = routeList[routeID].path;
	var color        = routeList[routeID].data.MapLineColor;
	var pointGraphic = null;
	var pointIndex   = 200;

	setInterval(function () {
	    if (pointGraphic) {
		layer.remove(pointGraphic);
		pointGraphic = null;
	    }
	    if (pointIndex >= path.length) {
		pointIndex = 0;
	    }
	    var coords = path[pointIndex++];
	    
	    var point = {
		type:      "point", // autocasts as new Point()
		longitude: coords[0],
		latitude:  coords[1]
            };
            var markerSymbol = {
		type: "simple-marker", // autocasts as new SimpleMarkerSymbol()
		color: color,
		size: 8
	    };
            pointGraphic = new Graphic({
		geometry: point,
		symbol: markerSymbol
            });
	    layer.add(pointGraphic);
	}, 1500);
    }

    /**
     * Decodes to a [latitude, longitude] coordinates array.
     *
     * This is adapted from the implementation in Project-OSRM.
     *
     * @param {String} str
     * @param {Number} precision
     * @returns {Array}
     *
     * @see https://github.com/Project-OSRM/osrm-frontend/blob/master/WebContent/routing/OSRM.RoutingGeometry.js
     */
    function polylineDecode(str, precision)
    {
	var index = 0,
            lat = 0,
            lng = 0,
            coordinates = [],
            shift = 0,
            result = 0,
            byte = null,
            latitude_change,
            longitude_change,
            factor = Math.pow(10, Number.isInteger(precision) ? precision : 5);

	// Coordinates have variable length when encoded, so just keep
	// track of whether we've hit the end of the string. In each
	// loop iteration, a single coordinate is decoded.
	while (index < str.length) {

            // Reset shift, result, and byte
            byte = null;
            shift = 0;
            result = 0;

            do {
		byte = str.charCodeAt(index++) - 63;
		result |= (byte & 0x1f) << shift;
		shift += 5;
            } while (byte >= 0x20);

            latitude_change = ((result & 1) ? ~(result >> 1) : (result >> 1));

            shift = result = 0;

            do {
		byte = str.charCodeAt(index++) - 63;
		result |= (byte & 0x1f) << shift;
		shift += 5;
            } while (byte >= 0x20);

            longitude_change = ((result & 1) ? ~(result >> 1) : (result >> 1));

            lat += latitude_change;
            lng += longitude_change;

            coordinates.push([lng / factor, lat / factor]);
	}
	return coordinates;
    }

    return function(id, options)
    {
	Container = $(id).get(0);
	Options   = options;
	
	DrawBaseMap();
    }
})()
});

