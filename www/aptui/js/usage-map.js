/*
 * Culled from http://bl.ocks.org/michellechandra/0b2ce4923dc9b5809922
 */
$(function ()
{
    'use strict';
    var d3 = d3v5;

    var templates = APT_OPTIONS.fetchTemplateList(['usage-map']);

    function initialize()
    {
	window.APT_OPTIONS.initialize(sup);

	$('#main-body').html(_.template(templates['usage-map']));

	if (window.WHICHMAP !== undefined) {
	    ShowUsageMap(window.WHICHMAP);
	}
	else {
	    ShowUsageMap("states");
	    ShowUsageMap("countries");
	}
    }
    function ShowUsageMap(whichmap)
    {
	var selector = (whichmap == "states" ? "#states-map" : "#country-map");
	//Width and height of map
	var width;
	var height;

	if (window.EMBEDDED) {
	    width  = $(window).width() - 50;
	    height = $(window).height() - 50;
	    console.info(width, height);
	}
	else {
	    width  = 1000;
	    height = 500;
	}

	// D3 Projection
	var projection;

	if (whichmap == "states") {
	    projection = 
		d3.geoAlbersUsa()
		.translate([width/2, height/2]) // translate to center of screen
		.scale([height * 2]);	  // scale things down so see entire US
	}
	else {
	    height = height - 10;
	    
	    projection =
		d3.geoNaturalEarth1()
		.scale(width / 1.6 / Math.PI)
		.center([0, 10])
		.translate([width / 2, height / 2]);
	}
     
	// Define path generator that convert GeoJSON to SVG paths
	var path =
	    d3.geoPath()
	    .projection(projection);  

	// Define linear scale for output
	var color = d3.scaleThreshold()
	    .range(['#fff5f0','#fee0d2','#fcbba1',
		    '#fc9272','#fb6a4a','#ef3b2c',
		    '#cb181d','#a50f15','#67000d'])
	    .domain([0,5,20,25,45,55,200,500,1000]);

	// Scale for the circles.
	var radius = d3.scaleSqrt()
	    .domain([0,1050])
	    .range([0, 30]);

	// Create SVG element and append map to the SVG
	var svg = d3.select(selector)
	    .append("svg")
	    .attr("width", width)
	    .attr("height", height);
     
	// Append Div for tooltip to SVG
	var tooltip = d3.select(selector)
	    .append("div")   
    	    .attr("class", "tooltip")               
    	    .style("opacity", 0);

	var csvfile;
	var jsonfile;
	var portal = (window.ISPOWDER ? "powder" : "cloudlab");

	if (whichmap == "states") {
	    csvfile  = "us-counts-" + portal + ".csv";
	    jsonfile = "us-states.json";
	}
	else {
	    csvfile  = "world-counts-" + portal + ".csv";
	    jsonfile = "world.json";
	}
	csvfile  = "usage-maps/" + csvfile;
	jsonfile = "usage-maps/" + jsonfile;

	// Load in my counts data
	var P1 = d3.csv(csvfile);
	// Load GeoJSON data.
	var P2 = d3.json(jsonfile);

	Promise.all([P1, P2]).then(function(alldata) {
	    var data = alldata[0];
	    var json = alldata[1];
	    console.info(data, json);

	    // Loop through each value in the .csv file
	    for (var i = 0; i < data.length; i++) {
		// Grab state or country name
		var name = data[i].name;

		// Grab data value 
		var count = data[i].count;

		// Find the corresponding feature inside the GeoJSON
		for (var j = 0; j < json.features.length; j++)  {
		    var jsonName = json.features[j].properties.name;

		    if (name == jsonName) {
			// Copy the data value into the JSON
			json.features[j].properties.visited = count; 
			break;
		    }
		}
	    }

	    // Bind the data to the SVG and create one path per GeoJSON feature
	    svg.selectAll("path")
		.data(json.features)
		.enter()
		.append("path")
		.attr("d", path)
		.style("stroke", "#fff")
		.style("stroke-width", "1")
		.style("fill", function(d) {
		    // Get data value
		    var value = d.properties.visited;

		    if (0 && value) {
			// For heat map
			return color(value);
		    }
		    else {
			return "#d5ded9";
		    }
		})
		.on("mouseover", function(d) {
		    var count = d.properties.visited;
		    var name  = d.properties.name;

		    if (count === undefined) {
			return;
		    }
	    
    		    tooltip.style("opacity", .9);      
		    tooltip.html("<center>" + name + "<br>" +
				 count + " users" + "</center>");
		    tooltip
			.style("left", (d3.event.pageX) + "px")     
			.style("top", (d3.event.pageY - 28) + "px");    
		})   
		.on("mousemove", function(d) {       
		    tooltip
			.style("left", (d3.event.pageX) + "px")     
			.style("top", (d3.event.pageY - 28) + "px");    
		})
		.on("mouseout", function(d) {       
		    tooltip.style("opacity", 0);   
		});

	    // Add the circles.
	    svg.append('g')
		.selectAll("circle")
		.data(json.features)
		.enter()
		.append('circle')
		.attr('r', function(d) {
		    var name  = d.properties.name;
		    var count = d.properties.visited;
		    
		    if (whichmap == "countries" && name == "USA") {
			count = parseInt(count / 7);
		    }
		    return radius(count);
		})
		.attr('fill', 'rgba(103, 65, 114, 0.5)')
		.attr('stroke', 'black')
		.attr("transform",function(d) {
		    var p = path.centroid(d);
		    return "translate("+p+")";
		})
		.on("mouseover", function(d) {
		    var count = d.properties.visited;
		    var name  = d.properties.name;

		    if (count === undefined) {
			return;
		    }
	    
    		    tooltip.style("opacity", .9);      
		    tooltip.html("<center>" + name + "<br>" +
				 count + " users" + "</center>");
		    tooltip
			.style("left", (d3.event.pageX) + "px")     
			.style("top", (d3.event.pageY - 28) + "px");    
		})   
		.on("mousemove", function(d) {       
		    tooltip
			.style("left", (d3.event.pageX) + "px")     
			.style("top", (d3.event.pageY - 28) + "px");    
		})
		.on("mouseout", function(d) {       
		    tooltip.style("opacity", 0);   
		});       
	});
	$(selector).removeClass("hidden");
    }
    $(document).ready(initialize);
});
