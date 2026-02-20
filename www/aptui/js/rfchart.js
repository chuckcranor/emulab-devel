//
// RF Range charts
//
// This code is mostly stolen from various example graphs on the D3
// tutorial website. 
//
$(function () {
window.CreateRangeCharts = (function ()
{
    'use strict';
    var d3   = d3v5;

    /*
     * Range/graph we show in tabs.
     */
    var rfRanges = {
	"cbrs"    :  { "low": 3350, "high": 3700, "ranges" : [], "zoom": null},
	"ism2400" :  { "low": 2390, "high": 2483.5, "ranges" : [], "zoom": null},
	"unii5800" : { "low": 5725, "high": 5850, "ranges" : [], "zoom": null},
    };

    var testRanges = {
	"cbrs" : [
	    {
		"uuid"      :  "1111",
		"startDate" :  new Date("Sun Apr 9 01:36:45 PDT 2022"),
		"endDate"   :  new Date("Sun Apr 9 02:36:45 PDT 2022"),
		"low"       :  3580,
		"high"      :  3581,
	    },
	    {
		"uuid"      :  "2222",
		"startDate" :  new Date("Sun Apr 15 01:36:45 PDT 2022"),
		"endDate"   :  new Date("Sun Apr 30 02:36:45 PDT 2022"),
		"low"       :  3580,
		"high"      :  3580.1,
	    },
	    {
		"uuid"      :  "3333",
		"startDate" :  new Date("Sun Apr 15 01:36:45 PDT 2022"),
		"endDate"   :  new Date("Sun Apr 30 02:36:45 PDT 2022"),
		"low"       :  3650,
		"high"      :  3660,
	    },
	    {
		"uuid"      :  "4444",
		"startDate" :  new Date("Sun Mar 30 01:36:45 PDT 2022"),
		"endDate"   :  new Date("Sun Apr 6 02:36:45 PDT 2022"),
		"low"       :  3550,
		"high"      :  3560,
	    },
	    {
		"uuid"      :  "5555",
		"startDate" :  new Date("Sun Mar 31 01:36:45 PDT 2022"),
		"endDate"   :  new Date("Sun Apr 3 02:36:45 PDT 2022"),
		"low"       :  3560,
		"high"      :  3580,
	    },
	],
	"ism2400" : [
	    {
		"uuid"      :  "1111",
		"startDate" :  new Date("Sun Apr 9 01:36:45 PDT 2022"),
		"endDate"   :  new Date("Sun Apr 11 02:36:45 PDT 2022"),
		"low"       :  2410,
		"high"      :  2420,
	    },
	    {
		"uuid"      :  "2222",
		"startDate" :  new Date("Sun Apr 15 01:36:45 PDT 2022"),
		"endDate"   :  new Date("Sun Apr 30 02:36:45 PDT 2022"),
		"low"       :  2450,
		"high"      :  2455,
	    },
	    {
		"uuid"      :  "3333",
		"startDate" :  new Date("Sun Apr 10 01:36:45 PDT 2022"),
		"endDate"   :  new Date("Sun Apr 20 02:36:45 PDT 2022"),
		"low"       :  2460,
		"high"      :  2470,
	    },
	],
	"unii5800" : [ ],
    };

    // Standard d3 margins.
    var margin = {
	top	: 30,
	right	: 40,
	bottom	: 30,
	left	: 40,
    };

    function initialize(args)
    {
	var selector = args.selector;
	var reserved = args.reserved;
	var inuse    = args.inuse;

	/*
	 * Assign the ranges to the aproper group.
	 */
	_.each(reserved.concat(inuse), function (range) {
	    var low    = parseFloat(range.freq_low);
	    var high   = parseFloat(range.freq_high);

	    for (const [key, rfrange] of Object.entries(rfRanges)) {
		if (low >= rfrange.low && high <= rfrange.high) {
		    rfrange.ranges.push({
			"start"    : new Date(range.start),
			"end"      : new Date(range.end),
			"low"      : low,
			"high"     : high,
			"isexp"    : range.isexp || 0,
			"approved" : range.approved || 0,
                        "powder_zones" : range.powder_zones,
                        // This is a reservation or an instance
                        "target"   : range,
		    });
		    return;
		}
	    }
	});
	console.info("rfRanges", rfRanges);

	/*
	 * Set up handlers to draw the graph *after* the tab is show.
	 */
	_.each(rfRanges, function (details, name) {
	    var rangeID       = "#" + name + "-ranges";
	    var rangeSVG      = rangeID + " svg";
	    var rangeSelector = 'a[href="' + rangeID + '"]';
	    var low           = details.low;
	    var high          = details.high;

	    if (_.has(args, "activate") && args.activate == name) {
		details.zoom = CreateGraph(rangeID, low, high, details.ranges);
		return;
	    }

	    $(selector + " " + rangeSelector)
		.on('shown.bs.tab', function (e) {
		    console.info(e);
		    if ($(rangeSVG).length == 0) {
			details.zoom = 
			    CreateGraph(rangeID, low, high, details.ranges);
		    }
		});
	});
	
	/*
	 * And setup the zoom controls to operate on the active chart
	 */
	$(selector + " .zoom-in").click(function (event) {
	    event.preventDefault();
	    var id = $(selector + " .tab-content .active").attr("id");
	    Zoom(id, "in");
	});
	$(selector + " .zoom-out").click(function (event) {
	    event.preventDefault();
	    var id = $(selector + " .tab-content .active").attr("id");
	    Zoom(id, "out");
	});
    }

    function Zoom(which, dir)
    {
	// XXX bad naming.
	var id = which.replace("-ranges", "");
	if (_.has(rfRanges, id) && rfRanges[id].zoom) {
	    rfRanges[id].zoom(dir);
	}
    }

    function CreateGraph(selector, low, high, ranges)
    {
	selector = selector + " .range-chart";
	var title = "Reserved and Inuse ranges from " + low + "MHz" +
	    " to " + high + "MHz";
	// Cause of redraw after project change.
	$(selector).html("");
	
	var parentWidth     = $(selector).width();
	var parentHeight    = $(selector).height();
	var parentTop       = $(selector).position().top;
	var parentLeft      = $(selector).position().left;
	var width           = parentWidth - margin.left - margin.right;
	var height          = parentHeight - margin.top - margin.bottom;
	var yDomain         = [low, high];
	var tickFormat      = "%m/%d";
	var timeDomainStart = new Date();
	var timeDomainEnd   = new Date();

	console.info("height", height, "width", width);

	if (ranges.length) {
	    timeDomainEnd = new Date(d3.max(ranges, d => d.end).valueOf());
	}
	timeDomainEnd.setDate(timeDomainEnd.getDate() + 7);

	// Transform for range bars.
	var rectTransform = function(d) {
	    var x = xScale(d.start);
	    var y = yScale(d.high);
	    
	    return "translate(" + x + "," + y + ")";
	};

	var xScale = d3.scaleTime()
	    .domain([ timeDomainStart, timeDomainEnd ])
	    .range([ 0, width ])
	    .clamp(true);

	var yScale = d3.scaleLinear()
	    .domain(yDomain)
	    .range([height, 0])
	    .clamp(true);

	var xAxis = d3.axisBottom()
	    .scale(xScale)
	    .tickFormat(d3.timeFormat(tickFormat));

	var yAxisL = d3.axisLeft()
	    .scale(yScale)
	    .tickSize(-width)
	    .ticks(20);

	var yAxisR = d3.axisRight()
	    .scale(yScale)
	    .tickSize(0)
	    .ticks(20);

	var zoom = d3.zoom()
	    .scaleExtent([1, 8])
	    .translateExtent([[0, 0], [width, height]])
	    .extent([[0, 0], [width, height]])
	    .on("zoom", zoomed);

	var svg = d3.select(selector)
	    .append("svg")
	    .attr("class", "chart")
	    .attr("width", $(selector).width())
	    .attr("height", $(selector).height())
	    .append("g")
	    .attr("class", "chart-inner")
	    .attr("transform",
		  "translate(" + margin.left + ", " + margin.top + ")");

	svg.append("text")
	    .lower()
            .style("text-anchor", "middle")
            .text(title)
	    .attr("transform", "translate(" + width / 2 + ",-10)")

	svg.selectAll(".chart")
	    .data(ranges)
	    .enter()
	    .append("rect")
	    .attr("rx", 2)
	    .attr("ry", 2)
	    .attr("class", function (d) {
                console.info(d);
                var classes = "range-bar ";
                if (d.powder_zones == "Outdoor") {
                    classes += "range-bar-outdoor ";
                }
                if (d.isexp == 0 && !d.approved) {
                    classes += "range-bar-unapproved ";
                }
                return classes;
	    })
	    .attr("y", 0)
	    .attr("transform", rectTransform)
	    .attr("height", function(d) {
		return yScale(d.low) - yScale(d.high);
	    })
	    .attr("width", function(d) { 
		return Math.max(1,(xScale(d.end) - xScale(d.start))); 
	    });

        // Admins can click on the rect to bring up the reservation or instance.
        if (window.ISADMIN) {
            var foo = d3.selectAll(selector + " .chart rect");
            foo.style("cursor", "pointer");
            foo.on("click", function (d) { ClickHandler(d) });
        }

	var gXaxis = svg.append("g")
	    .attr("class", "x-axis")
	    .attr("transform", "translate(0, " + height + ")")
	    .call(xAxis);

	var gYaxisL = svg.append("g")
	    .attr("class", "y-axis y-axis-right")
	    .attr("transform", "translate(0, " + 0 + ")")
	    .call(yAxisL);

	svg.selectAll(".y-axis-right .tick:not(:first-of-type) line")
            .attr("stroke-opacity", 0.5)
            .attr("stroke-dasharray", "2,2");

	var gYaxisR = svg.append("g")
	    .attr("class", "y-axis")
	    .attr("transform", "translate(" + width + ",0)")
	    .call(yAxisR);

	svg.selectAll(".range-bar, .range-bar-unapproved")
	    .on("mouseover", ShowTooltip)
	    .on("mousemove", MoveTooltip)
	    .on("mouseout", HideTooltip);

	// The wheel.zoom disable has to be *after* the .call(zoom).
	var zoomer = svg.append("rect")
	    .attr("class", "range-chart-zoom")
	    .attr("width", width)
	    .attr("height", height)
	    .attr("transform", "translate(0,0)")
	    .lower()
	    .call(zoom)
	    .on("wheel.zoom", null);

	function zoomed() {
	    // new scale
	    var newX = d3.event.transform.rescaleX(xScale);
	    var newY = d3.event.transform.rescaleY(yScale);
	    //console.info(d3.event.transform.k, newX, newY);
    
	    // redraw the axis
	    gXaxis.call(xAxis.scale(newX));
	    gYaxisL.call(yAxisL.scale(newY));
	    gYaxisR.call(yAxisR.scale(newY));

	    // update new tick lines.
	    svg.selectAll(".y-axis-right .tick:not(:first-of-type) line")
		.attr("stroke-opacity", 0.5)
		.attr("stroke-dasharray", "2,2");

	    svg.selectAll(".range-bar, .range-bar-unapproved")
		.attr("width", function(d) { 
		    return Math.max(1,(newX(d.end) - newX(d.start)))
		})
		.attr("height", function(d) { 
		    return newY(d.low) - newY(d.high);
		})
		.attr("transform", function(d) {
		    return "translate(" +
			newX(d.start) + "," + newY(d.high) + ")";
		});
	}

	// Watch for tooltip getting crunched against right border.
	function tipXpos()
	{
	    var xpos = d3.event.offsetX;
	    var tipwidth = $(".range-chart-tooltip").width();

	    if (xpos + tipwidth > width) {
		xpos = xpos - (tipwidth + 30);
	    }
	    else {
		xpos += 15;
	    }
	    return xpos;
	}

	function ShowTooltip(d)
	{
	    //console.info("ShowTooltip", d, d3.event);
	    //var tipHeight = $(".range-chart-tooltip").height();
	    //var xpos      = xScale(d.end) + parentLeft;
	    //var ypos      = yScale(d.high) - (parentHeight - tipHeight);
	    
	    //console.info(pleft, x(d.start), ptop, y(d.high))

	    $(".range-chart-tooltip .tooltip-range")
		.html(d.low + "MHz - " + d.high + "MHz");
	    $(".range-chart-tooltip .tooltip-start")
		.html(moment(d.start).format("lll"));
	    $(".range-chart-tooltip .tooltip-end")
		.html(moment(d.end).format("lll"));
	    $(".range-chart-tooltip .tooltip-approved")
		.html(d.approved || d.isexp ? "Yes" : "No");
	    $(".range-chart-tooltip .tooltip-zones")
		.html(d.powder_zones ? d.powder_zones : "Outdoor");

	    $(".range-chart-tooltip")
		.css("top", d3.event.offsetY + "px");
	    $(".range-chart-tooltip")
		.css("left", tipXpos() + "px");
	    $(".range-chart-tooltip").css("visibility", "visible");
	}
	function MoveTooltip(d)
	{
	    //console.info("MoveTooltip", d, d3.event);
	    
	    $(".range-chart-tooltip")
		.css("top", d3.event.offsetY + "px");
	    $(".range-chart-tooltip")
		.css("left", tipXpos() + "px");
	}
	function HideTooltip(d)
	{
	    //console.info("HideTooltip", d);
	    $(".range-chart-tooltip").css("visibility", "hidden");
	}

        function ClickHandler(d)
        {
            console.info("ClickHandler", d);
            var target = d.target;
            var url;

            if (_.has(target, "res_uuid")) {
                url = "resgroup.php?edit=1&uuid=" + target.res_uuid;
            }
            else if (_.has(target, "instance_uuid")) {
                url = "status.php?uuid=" + target.instance_uuid;
            }
            else {
                return;
            }
            window.open(url, "");
        }

	// return a zoom function to the caller for the panel buttons.
	return function (dir) {
	    if (dir == "in") {
		zoomer.transition().call(zoom.scaleBy, 2.0);		
	    }
	    else {
		zoomer.transition().call(zoom.scaleBy, 0.5);
	    }
	};
    }

    return function(args) {
	initialize(args);
    };
}
)();
});
