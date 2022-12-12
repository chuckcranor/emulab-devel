//
// TX graph
//
// This code is mostly stolen from various example graphs on the D3
// tutorial website. 
//
$(function () {
window.ShowTXGraph = (function ()
{
    'use strict';
    var d3 = d3v5;

    function CreateGraph(args) {
	//console.log(data);
	
	var selector     = args.selector + " .tx-graph";
	var popovers     = args.selector + " .txgraph-tooltip-popovers";
	var parentWidth  = $(selector).width();
	var parentHeight = $(selector).height();
	var ParentTop    = $(selector).parent().position().top;
	var ParentLeft   = $(selector).parent().position().left;
	var formatter    = d3.format(".3f");
	
	var margin  = {top: 20, right: 20, bottom: 50, left: 80};
	var width   = parentWidth - margin.left - margin.right;
	var height  = parentHeight - margin.top - margin.bottom;
	console.info(width, height);

	// Clear old graph stuff
	$(selector).html("");
	$(popovers).html("");

	// Hide the spinner since the graph draws fast.
	$(args.selector + " .txgraph-spinner").addClass("hidden");

	/*
	 * Bound the date axis by the experiment if we have one.
	 * Otherwise min/max TX with some pad to make it easier to
	 * zoom at the edges.
	 */
	var minDate;
	var maxDate;

	if (args.instance) {
	    minDate = new Date(args.instance.started);
	    if (_.has(args.instance, "destroyed") && args.instance.destroyed) {
		maxDate = new Date(args.instance.destroyed);
	    }
	    else {
		maxDate = new Date();
	    }
	}
	else {
	    minDate = d3.min(args.txlist, function(d) { return d.date; });
	    maxDate = d3.max(args.txlist, function(d) { return d.date; });
	    /*
	     * Need some pad to make it easier to zoom at the edges
	     * But needs to be proportional to date extemt.
	     */
	    var pad = (maxDate.getTime() - minDate.getTime()) * 0.01;
	    minDate = new Date(minDate.getTime() - pad);
	    maxDate = new Date(maxDate.getTime() + pad);
	}
	console.info(minDate, maxDate);
	
	var x = d3.scaleTime()
	    .domain([minDate, maxDate])
	    .range([0, width]);

	// Need a little padding on the Y axis
	var minFreq = d3.min(args.txlist, function(d) { return d.frequency; })
	var maxFreq = d3.max(args.txlist, function(d) { return d.frequency; })
	minFreq = minFreq - 0.05;
	maxFreq = maxFreq - 0.05;
	console.info(minFreq, maxFreq);

	var bandDomain = {};
	bandDomain[minFreq] = minFreq;
	bandDomain[maxFreq] = maxFreq;
	_.each(args.txlist, function (d) {
	    if (!_.has(bandDomain, d.frequency)) {
		bandDomain[d.frequency] = d.frequency;
	    }
	});
	// Convert to sorted array.
	bandDomain = _.keys(bandDomain).sort(function (a, b) {return a - b;});
	console.info(bandDomain);
	
	function bandTickValues(scale)
	{
	    if (_.size(bandDomain) < 50) {
		return bandDomain;
	    }
	    var scaled = [];
	    var mod    = Math.round(_.size(bandDomain) / (50 * scale));
	    if (mod == 0) {
		return bandDomain;
	    }
	    
	    scaled[0] = minFreq;
	    for (var i = 1; i < _.size(bandDomain); i++) {
		if (i % mod == 0) {
		    var frequency = bandDomain[i];
		    scaled.push(frequency);
		}
	    }
	    scaled.push(maxFreq)
	    //console.info("scaleBandRange", scaled);
	    return scaled;
	}
	    
	var y = d3.scalePoint()
	    .domain(bandDomain)
	    .range([height, 0]);

	var xAxis = d3.axisBottom(x);
	var yAxis = d3.axisLeft(y)
	    .tickValues(bandTickValues(1));

	// Needed for zooming/rescale
	var xCopy = x.copy();
	var yCopy = y.copy();

	// The data has 3 decimal places.
	yAxis.tickFormat(d3.format('.3f'));

	// Return a formatted date range for the X axis label.
	function currentDateRange()
	{
	    var domain  = x.domain();
	    var minDate = moment(domain[0]).format("ddd MMM D, hh:mm A")
	    var maxDate = moment(domain[1]).format("ddd MMM D, hh:mm A")

	    return minDate + " <-> " + maxDate;
	}

	var zoom = d3.zoom()
	    .scaleExtent([1, Infinity])
	    .translateExtent([[0, 0], [width, height]])
	    .extent([[0, 0], [width, height]])
	    .on("zoom", zoomed);

	var zoomy = d3.zoom()
	    .scaleExtent([1, Infinity])
	    .translateExtent([[0, 0], [width, height]])
	    .extent([[0, 0], [width, height]])
	    .on("zoom", zoomedy);

	var svg = d3.select(selector)
	    .append('svg')
            .attr("width", $(selector).width())
            .attr("height", $(selector).height())
	    .append("g")
            .attr("width", width)
            .attr("height", height)
	    .attr("transform",
		  "translate(" + margin.left + "," + margin.top + ")");

	// X axis
	svg.append("g")
	    .attr("class", "axis axis--x")
	    .attr("transform", "translate(0," + height + ")")
	    .call(xAxis);

	// text label for the x axis
	svg.append("text")
	    .attr("class", "xaxis-date-range")
	    .attr("y", height + margin.top + 15)
	    .attr("x", (width / 2))
	    .style("text-anchor", "middle")
	    .text(currentDateRange());

	svg.append("g")
	    .attr("class", "axis axis--y")
	    .attr("clip-path", "url(#clip-yaxis)")
	    .call(yAxis);

	// text label for the y axis
	svg.append("text")
	    .attr("transform", "rotate(-90)")
	    .attr("y", 0 - margin.left)
	    .attr("x",0 - (height / 2))
	    .attr("dy", "1em")
	    .style("text-anchor", "middle")
	    .text("Frequency (MHz)");

	var defs = svg.append("defs");

	defs.append("clipPath")
            .attr("id", "clip")
            .append("rect")
            .attr("width", width)
            .attr("height", height)
            .attr("x", 0)
            .attr("y", 0); 

	defs.append("clipPath")
            .attr("id", "clip-yaxis")
            .append("rect")
            .attr("width", margin.left + 10)
            .attr("height", height + 10)
            .attr("x", 0 - margin.left)
            .attr("y", -5); 

	var scatter = svg.append("g")
            .attr("class", "focus")
	    .attr("clip-path", "url(#clip)");

	if (0) {
	scatter.append('g')
	    .selectAll("dot")
	    .data(args.txlist)
	    .enter()
	    .append("circle")
	    .attr("class", function (d) {
		return "abovefloor-circles " + d.tooltip;
	    })
	    .attr("cx", function (d) { return x(d.date); } )
	    .attr("cy", function (d) { return y(d.frequency); } )
	    .attr("r", 4)
	    .style("fill", function(d) { return d.violation ? "red" : "blue"; })
	    .style("stroke", "none")
	    .on("mouseenter", function(d) { ShowTooltip(d); })
	    .on("mouseleave", function(d) { HideTooltip(d); });
	}
	else {
	scatter.append('g')
	    .selectAll("bars")
	    .data(args.txlist)
	    .enter()
	    .append("rect")
	    .attr("class", function (d) {
		return "abovefloor-circles " + d.tooltip;
	    })
	    .attr("width", 4)
	    .attr("height", 3)
            .attr("x", function (d) { return x(d.date); } )
            .attr("y", function (d) { return y(d.frequency); } )
	    .style("fill", function(d) { return d.violation ? "red" : "blue"; })
	    .style("stroke", "none")
	    .on("mouseenter", function(d) { ShowTooltip(d); })
	    .on("mouseleave", function(d) { HideTooltip(d); })
	    .on("click", function(d) { ShowExperiment(d); });
	}
	
	// Need to lower the zoom below the circles so mouseover/out propogates.
	svg.append("rect")
	    .attr("class", "zoom")
	    // Little bit of pad on the zoom so its easier to hit on the edge
	    .attr("width", width)
	    .attr("height", height)
	    .lower()
	    .call(zoom);

	svg.append("rect")
	    .attr("class", "zoom zoom-y")
            .attr("width", margin.left)
            .attr("height", height)
	    .attr("transform", "translate(-80,0)")
	    .call(zoomy);
	
	function zoomed() {
	    var t = d3.event.transform;
	    x.domain(t.rescaleX(xCopy).domain());
	    scatter.selectAll(".abovefloor-circles")
		.attr("x", function(d) { return x(d.date) });
	    svg.select(".axis--x").call(xAxis);
	    svg.select(".xaxis-date-range").text(currentDateRange());
	}

	function zoomedy() {
	    var t = d3.event.transform;
	    //console.info(t);
	    y.range([height, 0].map(d => t.applyY(d)));
	    scatter.selectAll(".abovefloor-circles")
		.attr("y", function(d) { return y(d.frequency) })
	    	.attr("height", Math.round(3 * t.k));
	    yAxis.tickValues(bandTickValues(t.k));
	    svg.select(".axis--y").call(yAxis);
	}

	// Bootstrap tooltips
	function ShowTooltip(d)
	{
	    //console.info("ShowTooltip", d, d3.event);
	    var tooltipClass = "#" + d.tooltip;
	    
	    if ($(tooltipClass).length == 0) {
		$(popovers).append("<div id=" + d.tooltip + "></div>");

		var clone = $("#txgraph-tooltipTemplate").clone();
		clone.find(".tooltip-freq")
		    .html(formatter(d.frequency));
		clone.find(".tooltip-nodeid")
		    .html(d.node_id);
		clone.find(".tooltip-cluster")
		    .html(d.cluster);
		clone.find(".tooltip-power")
		    .html(formatter(d.power));
		clone.find(".abovefloor")
		    .html(formatter(d.abovefloor));
		clone.find(".tooltip-time")
		    .html(moment(d.date).format("M/D hh:mm A"));
		if (args.instances) {
		    var record = args.instances[d.instance_uuid];

		    clone.find(".tooltip-pid")
			.html(record.pid);
		    clone.find(".tooltip-eid")
			.html(record.eid);
		    clone.find(".tooltip-uid")
			.html(record.uid);
		    clone.find(".tooltip-admin")
			.removeClass("hidden");
		}

		$(tooltipClass).popover({
		    "content"   : clone.html(),
		    "trigger"   : "manual",
		    "html"      : true,
		    "container" : selector,
		    "placement" : "auto",
		    "animation" : false,
		});
	    }
	    var popover = $(tooltipClass).data("bs.popover");
	    var ptop    = Math.floor(ParentTop + y(d.frequency));
	    var pleft   = Math.floor(ParentLeft + margin.left + x(d.date));
	    
	    $(tooltipClass)	    
		.on("inserted.bs.popover", function (event) {
		    // Adjust ptop if its near the bottom or top.
		    if (height - y(d.frequency) > popover.tip().height()) {
			ptop = ptop + margin.top;
		    }
		    else {
			ptop = ptop - (popover.tip().height() / 2);
		    }
		    // And pleft if too close to right side.
		    if (x(d.date) > width - popover.tip().width()) {
			pleft = pleft - (popover.tip().width() + 20);
		    }
		    else {
			pleft = pleft + 20;
		    }
		    $(tooltipClass).off("inserted.bs.popover");
		})
		.on("shown.bs.popover", function () {
		    popover.tip().css("top", ptop + "px");
		    popover.tip().css("left", pleft + "px");
		    $(tooltipClass).off("shown.bs.popover");
		});
	    $(tooltipClass).popover('show');
	}

	function HideTooltip(d)
	{
	    //console.info("HideTooltip", d, d3.event);
	    var tooltipClass = "#" + d.tooltip;
	    
	    $(tooltipClass).popover('hide');
	}

	function ShowExperiment(d)
	{
	    d3.event.preventDefault();
	    if (args.instances == null && args.instance == null) {
		return;
	    }
	    var record;
	    if (args.instances) {
		record = args.instances[d.instance_uuid];
	    }
	    else {
		record = args.instance;
	    }
	    if (_.has(record, "url")) {
		window.open(record.url, "_blank");
	    }
	}
    }
    function Ready(args) {
	var counter	 = 1;
	
	_.each(args.txlist, function (d) {
	    d.date = new Date(d.tstamp);
	    d.frequency = +d.frequency;
	    d.violation = +d.violation;
	    d.tooltip   = "tooltip-circle-" + counter;
	    counter = counter + 1;	    
	});
	CreateGraph(args);
    };
    function Rejected(selector, error) {
	if (error) {
	    sup.HideModal(selector, function () {
		sup.SpitOops("oops", error);
	    });
	}
	else {
	    // No data.
	    $(selector + " .txgraph-spinner").addClass("hidden");
	    $(selector + " .txgraph-nodata").removeClass("hidden");
	}
    }
    // Use the defer to wait for the RPC call to finish.
    return function(selector, defer) {
	$(selector + " .txgraph-spinner").removeClass("hidden");
	$(selector + " .txgraph-nodata").addClass("hidden");
	$(selector + " .tx-graph").html("");
	sup.ShowModal(selector, undefined, function () {
	    defer
		.then(function(args) { Ready(args); } )
		.fail(function(error) { Rejected(selector, error); } );
	});
    };
}
)();
});
