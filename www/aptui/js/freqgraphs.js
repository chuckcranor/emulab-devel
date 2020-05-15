//
// Frequency graphs, data from the monitors on the FEs/MEs/BSs.
//
// This code is mostly stolen from various example graphs on the D3
// tutorial website. 
//
$(function () {
window.ShowFrequencyGraph = (function ()
{
    'use strict';
    var d3 = d3v5;

    function CreateGraph(args, data) {
	//console.log(data);
	
	var selector     = args.selector + " .frequency-graph-subgraph";
	var parentWidth  = $(selector).width();
	var parentHeight = $(selector).height();

	var margin  = {top: 20, right: 20, bottom: 130, left: 55};
	var width   = parentWidth - margin.left - margin.right;
	var height  = parentHeight - margin.top - margin.bottom;
	var margin2 = {top: parentHeight - 80,
		       right: 20, bottom: 30, left: 55};
	var height2 = parentHeight - margin2.top - margin2.bottom;

	// Clear old graph
	$(selector).html("");

	console.info(margin, margin2);
	console.info(width, height, height2);

	var bisector = d3.bisector(function(d) { return d.frequency; }).left;
	var formatter = d3.format(".3f");

	var x = d3.scaleLinear().range([0, width]),
	    x2 = d3.scaleLinear().range([0, width]),
	    y = d3.scaleLinear().range([height, 0]),
	    y2 = d3.scaleLinear().range([height2, 0]);

	var xAxis = d3.axisBottom(x),
	    xAxis2 = d3.axisBottom(x2),
	    yAxis = d3.axisLeft(y);

	var brush = d3.brushX()
	    .extent([[0, 0], [width, height2]])
	    .on("brush end", brushed);

	var zoom = d3.zoom()
	    .scaleExtent([1, Infinity])
	    .translateExtent([[0, 0], [width, height]])
	    .extent([[0, 0], [width, height]])
	    .on("zoom", zoomed);

	var line = d3.line().curve(d3.curveStep)
            .x(function (d) { return x(d.frequency); })
            .y(function (d) { return y(d.power); });

	var line2 = d3.line().curve(d3.curveStep)
            .x(function (d) { return x2(d.frequency); })
            .y(function (d) { return y2(d.power); });

	var svg = d3.select(selector)
	    .append('svg')
            .attr("width", $(selector).width())
            .attr("height", $(selector).height());
	
	var clip = svg.append("defs").append("svg:clipPath")
            .attr("id", "clip")
            .append("svg:rect")
            .attr("width", width)
            .attr("height", height)
            .attr("x", 0)
            .attr("y", 0); 

	var Line_chart = svg.append("g")
            .attr("class", "focus")
            .attr("transform",
		  "translate(" + margin.left + "," + margin.top + ")")
	    .attr("clip-path", "url(#clip)");

	var focus = svg.append("g")
            .attr("class", "focus")
            .attr("transform",
		  "translate(" + margin.left + "," + margin.top + ")");

	var context = svg.append("g")
	    .attr("class", "context")
	    .attr("transform",
		  "translate(" + margin2.left + "," + margin2.top + ")");

	x.domain(d3.extent(data, function(d) { return d.frequency; }));
	// I want a little more pad above and below
	var power_extents = d3.extent(data, function(d) { return d.power; });
	console.info(power_extents);
	power_extents[0] = power_extents[0] - 2;
	power_extents[1] = power_extents[1] + 2;
	console.info(power_extents);
	y.domain(power_extents);
	x2.domain(x.domain());
	y2.domain(y.domain());

	focus.append("g")
	    .attr("class", "axis axis--x")
	    .attr("transform", "translate(0," + height + ")")
	    .call(xAxis);

	// text label for the x axis
	focus.append("text")             
	    .attr("y", height + margin.top + 15)
	    .attr("x", (width / 2))
	    .style("text-anchor", "middle")
	    .text("Frequency (MHz)");

	focus.append("g")
	    .attr("class", "axis axis--y")
	    .call(yAxis);

	// text label for the y axis
	focus.append("text")
	    .attr("transform", "rotate(-90)")
	    .attr("y", 0 - margin.left)
	    .attr("x",0 - (height / 2))
	    .attr("dy", "1em")
	    .style("text-anchor", "middle")
	    .text("Power (dB)");
	
	Line_chart.append("path")
	    .datum(data)
	    .attr("class", "line")
	    .attr("d", line);

	var tooltip = Line_chart.append("g")
	    .attr("class", "tooltip")
	    .style("opacity", "1.0")
	    .style("display", "none");

	tooltip.append("circle")
	    .attr("r", 5);

	var toolbox = tooltip.append("g")
	    .attr("class", "tooltip-box")
            .attr("transform", "translate(10,0)");

	toolbox.append("rect")
	    .attr("class", "tooltip-rect")
	    .attr("width", 125)
	    .attr("height", 50)
            .attr("y", -22)
	    .attr("rx", 4)
	    .attr("ry", 4);

	toolbox.append("text")
	    .attr("x", 5)
	    .attr("y", -2)
	    .text("Freq:");

	toolbox.append("text")
	    .attr("class", "tooltip-freq")
	    .attr("x", 65)
	    .attr("y", -2);

	toolbox.append("text")
	    .attr("x", 5)
	    .attr("y", 18)
	    .text("Power:");

	toolbox.append("text")
	    .attr("class", "tooltip-power")
	    .attr("x", 65)
	    .attr("y", 18);

	context.append("path")
	    .datum(data)
	    .attr("class", "line")
	    .attr("d", line2);

	context.append("g")
	    .attr("class", "axis axis--x")
	    .attr("transform", "translate(0," + height2 + ")")
	    .call(xAxis2);

	context.append("g")
	    .attr("class", "brush")
	    .call(brush)
	    .call(brush.move, x.range());

	svg.append("rect")
	    .attr("class", "zoom")
	    .attr("width", width)
	    .attr("height", height)
	    .attr("transform",
		  "translate(" + margin.left + "," + margin.top + ")")
	    .call(zoom)
	    .on("mouseover", function() { tooltip.style("display", null); })
	    .on("mouseout", function() { tooltip.style("display", "none");})
	    .on("mousemove", mousemove);

	function mousemove() {
	    var x0 = x.invert(d3.mouse(this)[0]),
		i = bisector(data, x0, 1),
		d0 = data[i - 1],
		d1 = data[i];
	    
	    var d = x0 - d0.frequency > d1.frequency - x0 ? d1 : d0;
	    //console.info(x0, d, x(d.frequency));

	    // Move the box to the left/right of the circle, if
	    // its near the right/left margin.
	    if (x(d.frequency) > width - 150) {
		toolbox.attr("transform", "translate(-140,0)");
	    }
	    else {
		toolbox.attr("transform", "translate(10,0)");
	    }
	    
	    tooltip.attr("transform",
			 "translate(" + x(d.frequency) +
			 "," + y(d.power) + ")");
	    tooltip.select(".tooltip-freq").text(formatter(d.frequency));
	    tooltip.select(".tooltip-power").text(formatter(d.power));
	}

	function brushed() {
	    if (d3.event.sourceEvent && d3.event.sourceEvent.type === "zoom")
		return; // ignore brush-by-zoom
	    var s = d3.event.selection || x2.range();
	    x.domain(s.map(x2.invert, x2));
	    Line_chart.select(".line").attr("d", line);
	    focus.select(".axis--x").call(xAxis);
	    svg.select(".zoom").call(zoom.transform, d3.zoomIdentity
				     .scale(width / (s[1] - s[0]))
				     .translate(-s[0], 0));
	}

	function zoomed() {
	    if (d3.event.sourceEvent && d3.event.sourceEvent.type === "brush")
		return; // ignore zoom-by-brush
	    var t = d3.event.transform;
	    x.domain(t.rescaleX(x2).domain());
	    Line_chart.select(".line").attr("d", line);
	    focus.select(".axis--x").call(xAxis);
	    context.select(".brush")
		.call(brush.move, x.range().map(t.invertX, t));
	}
    }

    function CreateBins(data)
    {
	var result = [];
	var bins   = [];
	console.info("CreateBins");

	_.each(data, function (d, index) {
	    var freq  = +d.frequency;
	    var power = +d.power;
	    var x     = Math.floor(freq);

	    if (!_.has(bins, x)) {
		var bin = {
		    "frequency" : x,
		    "max"       : power,
		    "min"       : power,
		    "avg"       : power,
		    "samples"   : [d],
		};
		bins[x] = bin;
		result.push(bin);
		return;
	    }
	    var bin = bins[x];
	    if (power > bin.max) {
		bin.max = power;
	    }
	    if (power < bin.min) {
		bin.min = power;
	    }
	    bin.samples.push(d);
	    var sum = 0;
	    _.each(bin.samples, function (d) {
		sum = sum + d.power;
	    });
	    bin.avg = sum / _.size(bin.samples);
	});
	//console.info("bins", result);
	return result;
    }

    var tooltipTemplate =
	'  <table class="table table-condensed border-none" ' +
	'         style="font-size: 14px;">' +
	'    <tbody>' +
	'      <tr>' +
	'        <td class="border-none">Frequency:</td>' +
	'        <td class="border-none tooltip-frequency"></td>' +
	'      </tr>' +
	'      <tr>' +
	'        <td class="border-none">Avg Power:</td>' +
	'        <td class="border-none tooltip-avg"></td>' +
	'      </tr>' +
	'      <tr>' +
	'        <td class="border-none">Max Power:</td>' +
	'        <td class="border-none tooltip-max"></td>' +
	'      </tr>' +
	'      <tr>' +
	'        <td class="border-none">Min Power:</td>' +
	'        <td class="border-none tooltip-min"></td>' +
	'      </tr>' +
	'    </tbody>' +
	'  </table>';
    
    function CreateBinGraph(args, data) {
	var bins         = CreateBins(data);
	var selector     = args.selector + " .frequency-graph-maingraph";
	var parentWidth  = $(selector).width();
	var parentHeight = $(selector).height();
	var ParentTop    = $(selector).position().top;
	var ParentLeft   = $(selector).position().left;

	// Clear old graph
	$(selector).html("");
	// And the sub graph.
	$(args.selector + " .frequency-graph-subgraph").html("");
	
	var margin  = {top: 20, right: 20, bottom: 130, left: 55};
	var width   = parentWidth - margin.left - margin.right;
	var height  = parentHeight - margin.top - margin.bottom;
	var margin2 = {top: parentHeight - 80,
		       right: 20, bottom: 30, left: 55};
	var height2 = parentHeight - margin2.top - margin2.bottom;

	console.info(margin, margin2);
	console.info(parentWidth, parentHeight, ParentTop, ParentLeft);
	console.info(width, height, height2);

	var bisector = d3.bisector(function(d) { return d.frequency; }).left;
	var formatter = d3.format(".3f");

	var x = d3.scaleLinear().range([0, width]),
	    x2 = d3.scaleLinear().range([0, width]),
	    y = d3.scaleLinear().range([height, 0]),
	    y2 = d3.scaleLinear().range([height2, 0]);

	var xAxis = d3.axisBottom(x),
	    xAxis2 = d3.axisBottom(x2),
	    yAxis = d3.axisLeft(y);

	var brush = d3.brushX()
	    .extent([[0, 0], [width, height2]])
	    .on("brush end", brushed);

	var zoom = d3.zoom()
	    .scaleExtent([1, Infinity])
	    .translateExtent([[0, 0], [width, height]])
	    .extent([[0, 0], [width, height]])
	    .on("zoom", zoomed);

	var line = d3.line().curve(d3.curveStep)
            .x(function (d) { return x(d.frequency); })
            .y(function (d) { return y(d.max); });

	var line2 = d3.line().curve(d3.curveStep)
            .x(function (d) { return x2(d.frequency); })
            .y(function (d) { return y2(d.max); });

	var svg = d3.select(selector)
	    .append('svg')
            .attr("width", $(selector).width())
            .attr("height", $(selector).height());
	
	var clip = svg.append("defs").append("svg:clipPath")
            .attr("id", "clip")
            .append("svg:rect")
            .attr("width", width)
            .attr("height", height)
            .attr("x", 0)
            .attr("y", 0); 

	var Line_chart = svg.append("g")
            .attr("class", "focus")
            .attr("transform",
		  "translate(" + margin.left + "," + margin.top + ")")
	    .attr("clip-path", "url(#clip)");

	var focus = svg.append("g")
            .attr("class", "focus")
            .attr("transform",
		  "translate(" + margin.left + "," + margin.top + ")");

	var context = svg.append("g")
	    .attr("class", "context")
	    .attr("transform",
		  "translate(" + margin2.left + "," + margin2.top + ")");

	x.domain(d3.extent(bins, function(d) { return d.frequency; }));
	y.domain(d3.extent(bins, function(d) { return d.max; }));
	x2.domain(x.domain());
	y2.domain(y.domain());

	focus.append("g")
	    .attr("class", "axis axis--x")
	    .attr("transform", "translate(0," + height + ")")
	    .call(xAxis);

	// text label for the x axis
	focus.append("text")             
	    .attr("y", height + margin.top + 15)
	    .attr("x", (width / 2))
	    .style("text-anchor", "middle")
	    .text("Frequency (MHz)");

	focus.append("g")
	    .attr("class", "axis axis--y")
	    .call(yAxis);

	// text label for the y axis
	focus.append("text")
	    .attr("transform", "rotate(-90)")
	    .attr("y", 0 - margin.left)
	    .attr("x",0 - (height / 2))
	    .attr("dy", "1em")
	    .style("text-anchor", "middle")
	    .text("Power (dB)");      
	
	Line_chart.append("path")
	    .datum(bins)
	    .attr("class", "line")
	    .attr("d", line);

	var tooltip = Line_chart.append("g")
	    .attr("class", "tooltip")
	    .style("opacity", "1.0")
	    .style("display", "none");

	tooltip.append("circle")
	    .attr("r", 5);

	context.append("path")
	    .datum(bins)
	    .attr("class", "line")
	    .attr("d", line2);

	context.append("g")
	    .attr("class", "axis axis--x")
	    .attr("transform", "translate(0," + height2 + ")")
	    .call(xAxis2);

	context.append("g")
	    .attr("class", "brush")
	    .call(brush)
	    .call(brush.move, x.range());

	svg.append("rect")
	    .attr("class", "zoom")
	    .attr("width", width)
	    .attr("height", height)
	    .attr("transform",
		  "translate(" + margin.left + "," + margin.top + ")")
	    .call(zoom)
	    .on("mouseover", ShowTooltip)
	    .on("mouseout", HideTooltip)
	    .on("mousemove", mousemove)
	    .on("click", DrawSubGraph);

	$('#tooltip-popover')
	    .popover({"content"   : tooltipTemplate,
		      "trigger"   : "manual",
		      "html"      : true,
		      "container" : selector,
		      "placement" : "auto",
		     });

	function HideTooltip()
	{
	    // The circle
	    tooltip.style("display", "none");;
	    // The box
	    $('#tooltip-popover').popover("hide");	    
	}

	function ShowTooltip()
	{
	    // The circle.
	    tooltip.style("display", null);
	}
    
	function mousemove() {
	    //console.info(d3.event, d3.mouse(this));
	    
	    var x0 = x.invert(d3.mouse(this)[0]),
		i = bisector(bins, x0, 1),
		d0 = bins[i - 1],
		d1 = bins[i];

	    var d = x0 - d0.frequency > d1.frequency - x0 ? d1 : d0;
	    //console.info(x0, d, x(d.frequency));
	    //console.info(x(d.frequency), y(d.avg));

	    tooltip.attr("transform",
			 "translate(" + x(d.frequency) +
			 "," + y(d.max) + ")");

	    // Bootstrap popover based tooltip.	    
	    var popover   = $('#tooltip-popover').data("bs.popover");
	    var isVisible = popover.tip().hasClass('in');
	    var updater   = function () {
		var content = popover.tip().find('.popover-content');
		var ptop    = Math.floor(ParentTop + y(d.max));
		var pleft   = Math.floor(ParentLeft + x(d.frequency));

		// Adjust ptop if its near the bottom or top.
		if (height - y(d.max) > popover.tip().height()) {
		    ptop = ptop + margin.top;
		}
		else {
		    ptop = ptop - (popover.tip().height() / 2);
		}
		// And pleft if too close to right side.
		if (x(d.frequency) > width - 150) {
		    pleft = pleft - 175;
		}
		else {
		    pleft = pleft + 70;
		}
		popover.tip().css("top", ptop + "px");
		popover.tip().css("left", pleft + "px");

		$(content).find(".tooltip-frequency")
		    .html(formatter(d.frequency));
		$(content).find(".tooltip-min")
		    .html(formatter(d.min));
		$(content).find(".tooltip-max")
		    .html(formatter(d.max));
		$(content).find(".tooltip-avg")
		    .html(formatter(d.avg));
	    };
	    if (isVisible) {
		updater();
	    }
	    else {
		$('#tooltip-popover')
		    .on("inserted.bs.popover", function (event) {
			popover.tip().addClass("tooltip-popover")
			popover.tip().find(".arrow").remove();
			updater();
			$('#tooltip-popover').off("inserted.bs.popover");
		    });
		$('#tooltip-popover').popover('show');
	    }
	}

	function brushed() {
	    if (d3.event.sourceEvent && d3.event.sourceEvent.type === "zoom")
		return; // ignore brush-by-zoom
	    var s = d3.event.selection || x2.range();
	    x.domain(s.map(x2.invert, x2));
	    Line_chart.select(".line").attr("d", line);
	    focus.select(".axis--x").call(xAxis);
	    svg.select(".zoom").call(zoom.transform, d3.zoomIdentity
				     .scale(width / (s[1] - s[0]))
				     .translate(-s[0], 0));
	}

	function zoomed() {
	    if (d3.event.sourceEvent && d3.event.sourceEvent.type === "brush")
		return; // ignore zoom-by-brush
	    var t = d3.event.transform;
	    x.domain(t.rescaleX(x2).domain());
	    Line_chart.select(".line").attr("d", line);
	    focus.select(".axis--x").call(xAxis);
	    context.select(".brush")
		.call(brush.move, x.range().map(t.invertX, t));
	}
	function DrawSubGraph()
	{
	    var x0   = x.invert(d3.mouse(this)[0]);
	    var i    = bisector(bins, x0, 1);
	    var d    = bins[i];
	    var freq = d.frequency;
	    var subdata = [];
	    var index   = (i < 25 ? 0 : i - 25);

	    for (i = index; i < index + 50; i++) {
		// Hmm, the CSV file appears to not be well sorted within
		// a frequency bin. Must be a string sort someplace.
		var sorted = bins[i].samples
		    .sort(function (a, b) { return a.frequency - b.frequency});
		subdata = subdata.concat(sorted);
	    }
	    CreateGraph(args, subdata);
	}
    }
    function type(d) {
	d.frequency = +d.frequency;
	d.power     = +d.power;
	return d;
    }

    function GetFrequencyData(datatype, route, method, args, callback)
    {
	var url = 'server-ajax.php';
	if (!datatype) {
	    datatype = "text";
	}

	var networkError = {
	    "code"  : -1,
	    "value" : "Server error, possible network failure.",
	};

	var jqxhr = $.ajax({
            // the URL for the request
            url: url,
            success: function (json) {
		window.APT_OPTIONS.gaAjaxEvent(route, method, json.code);
		if (callback !== undefined) {
		    callback(json);
		}
	    },
	    error: function (jqXHR, textStatus, errorThrown) {
		if (callback !== undefined) {
		    callback(networkError);
		}
	    },
 
            // the data to send (will be converted to a query string)
            data: {
		ajax_route:     route,
		ajax_method:    method,
		ajax_args:      args,
            },
 
            // whether this is a POST or GET request
            type: "GET",
 
            // the type of data we expect back
            dataType : datatype,
	});
	var defer = $.Deferred();
    
	jqxhr.done(function (data) {
	    defer.resolve(data);
	});
	jqxhr.fail(function (jqXHR, textStatus, errorThrown) {
	    networkError["jqXHR"] = jqXHR;
	    defer.resolve(networkError);
	});
	return defer;
    }

    // Easier to get a binary (gzip) file this way, since jquery does
    // not directly support doing this. 
    function GetBlob(url, success, failure) {
	var oReq = new XMLHttpRequest();
	oReq.open("GET", url, true);
	oReq.responseType = "arraybuffer";

	oReq.onload = function(oEvent) {
	    success(oReq.response)
	};
	oReq.onerror = function(oEvent) {
	    failure();
	};
	oReq.send();
    }

    /*
     * Saving this. It is faster to go directly to the aggregate, but
     * they all have to have valid certificates. Note that we cannot load
     * it via http from inside an https page, the browser will block it.
     */
    function SaveMe(args) {
	console.info("ShowFrequencyGraph", args);
	GetBlob(window.URL + ".gz",
		function (arrayBuffer) {
		    console.info("gz version");
		    var output = pako.inflate(arrayBuffer, { 'to': 'string' });
		    
		    var data = d3.csvParse(output, type);
		    CreateBinGraph(args, data);
		},
		function () {
		    $.get(window.URL)
			.done(function (data) {
			    console.info("text version");
			    data = d3.csvParse(data, type);
			    CreateBinGraph(args, data);
			})
			.fail(function() {
			    alert("Could not get data file: " + window.URL);
			});
		});
    }

    function BuildMenu(args)
    {
	var callback = function (value) {
	    // XXX This will always be a string. Need to
	    // figure out how to deal with errors.
	    if (typeof(value) == "object") {
		console.info("Could not get listing data: " + value.value);
		return;
	    }
	    var listing = JSON.parse(_.unescape(value));
	    console.info("listing", listing);
	    // Prune the items and then we sort them by the timestamp
	    var items   = [];
	    // nuc2:rf0-1588699912.csv.gz
	    var re = /([^:]+):([^\-]+)\-(\d+)\.csv\.gz/;
	    _.each(listing, function(info, index) {
		var name  = info.name;
		var match = name.match(re);
		//console.info(name, match);
		if (!match) {
		    return;
		}
		// Prune out other radios and interfaces.
		if (match[1] != args.node_id || match[2] != args.iface) {
		    return;
		}
		info["node_id"]  = match[1];
		info["iface"]    = match[2];
		info["logid"]    = parseInt(match[3]);
		info["cluster"]  = args.cluster;
		info["selector"] = args.selector;

		items.push(info)
	    });
	    // Sort by timestamp.
	    items.sort(function (a, b) {
		return b.logid - a.logid;
	    });
	    _.each(items, function(info, index) {
		var url = "frequency-graph.php" +
		    "?cluster="  + args.cluster +
		    "&node_id="  + info.node_id +
		    "&iface="    + info.iface +
		    "&logid="    + info.logid;
		if (info.archived) {
		    url + "&archived=" + info.archived;
		}
		var html =
		    "<li>" +
		    " <a href='" + url + "' index='<%- index %>'>" +
		    info.node_id + ":" + info.iface + " - " +
		    moment(info.logid, "X").format("L LTS") + "</a></li>";
		var item = $(html);
		// If the incoming args match this listing, start it active.
		if (args.logid &&
		    info.node_id == args.node_id &&
		    info.iface   == args.iface &&
		    info.logid   == args.logid) {
		    $(item).addClass("active");
		}
		$(item).find("a").click(function (event) {
		    event.preventDefault();
		    $('#moregraphs-dropdown').find("li").removeClass("active");
		    $(item).addClass("active");
		    $(".frequency-graph-date")
			.html(moment(info.logid, "X").format("L LTS"))
			.removeClass("hidden");
		    UpdateGraph(info);
		});
		$('#moregraphs-dropdown').append(item);
	    });
	};
	GetFrequencyData("html", "frequency-graph", "GetListing",
			 {"cluster"    : args.cluster,
			  "node_id"    : args.node_id,
			  "iface"      : args.iface,
			 },
			 callback);
    }

    function UpdateGraph(args)
    {
	/*
	 * Gack, we cannot get binary data with the jquery ajax call.
	 * Well there is lots of noise from google about how to mess
	 * with it, but instead I am just going to create a GET url
	 * that talks ajax server routine.
	 */
	var url = "server-ajax.php" +
	    "?ajax_route=frequency-graph" +
	    "&ajax_method=GetFrequencyData" +
	    "&ajax_args[cluster]=" + args.cluster +
	    "&ajax_args[node_id]=" + args.node_id +
	    "&ajax_args[iface]="   + args.iface;
	// Optional specific log.
	if (args.logid) {
	    url = url + "&ajax_args[logid]=" + args.logid;
	}
	if (args.archived) {
	    url = url + "&ajax_args[archived]=1";
	}
	console.info(url);

	GetBlob(url,
		function (arrayBuffer) {
		    console.info("gz version");
		    var output = pako.inflate(arrayBuffer, { 'to': 'string' });
		    
		    var data = d3.csvParse(output, type);
		    CreateBinGraph(args, data);
		},
		function () {
		    alert("Could not get data file: " + url);
		});
    }

    return function(args) {
	BuildMenu(args);
	UpdateGraph(args);
    };
}
)();
});
