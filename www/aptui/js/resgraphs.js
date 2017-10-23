//
// Reservation timeline graph.
//
$(function () {
window.ShowResGraph = (function ()
{
    'use strict';
 
    function ProcessData(forecast) {
	var index  = 0;
	var datums = [];

	/*
	 * For the interactive tooltip to work, every has data set has to
	 * have same set of x axis values (timestamps). So we are first
	 * going to create a hash of hashes; the keys are the time stamps
	 * and the value is a hash of type => free for that timestamp.
	 */
	var stamps  = {};

	// Each node type
	for (var type in forecast) {
	    // This is an array of objects.
	    var array = forecast[type];
	
	    if (array.length == 1) {
		if (parseInt(array[0].free) == 0) {
		    continue;
		}
		array.push($.extend({}, array[0]));
		array[1].t = parseInt(array[1].t) + (30 * 3600 * 24);
	    }

	    /*
	     * Hmm, Gary says there can be duplicate entries for the same
	     * time stamp, and we want the last one. So have to splice those
	     * out before we process. Yuck.
	     */
	    if (array.length > 1) {
		var temp = [];
		for (var i = 0; i < array.length - 1; i++) {
		    var data     = array[i];
		    var nextdata = array[i + 1];
		    
		    if (data.t == nextdata.t) {
			continue;
		    }
		    temp.push(data);
		}
		// Tack on last one.
		if (temp[temp.length - 1].t != array[array.length - 1].t) {
		    temp.push(array[array.length - 1]);
		}
		array = temp;
	    }

	    for (var i = 0; i < array.length; i++) {
		var data  = array[i];
		var stamp = data.t;
		var free  = parseInt(data.free);

		if (! _.has(stamps, stamp)) {
		    stamps[stamp] = {};
		}
		stamps[stamp][type] = free;

		/*
		 * We want the changes to look like step functions not
		 * slopes, so each time we change add another entry for
		 * the previous second with the old free count.
		 */
		if (i > 0) {
		    var lastfree  = parseInt(array[i - 1].free);
		    var prevstamp = stamp - 1;

		    if (! _.has(stamps, prevstamp)) {
			stamps[prevstamp] = {};
		    }
		    stamps[prevstamp][type] = lastfree;
		}
	    }
	}
	/*
	 * Well, this can happen; no datapoints cause no reservations
	 * and no experiments.
	 */
	if (Object.keys(stamps).length == 0) {
	    return null;
	}
	
	/*
	 * Create a sorted (by timestamp) array of the per-stamp hashes.
	 */
	var array = Object.keys(stamps).map(function (key) {
	    return {stamp  : key,
		    counts : stamps[key]};
	});
	array = array.sort(function(obj1, obj2) {
	    // Ascending: first stamp less than the previous
	    return obj1.stamp - obj2.stamp;
	});
	
	/*
	 * Nuts, the first timestamp does not always include all the
	 * types. It should ... so fill those in with the first count
	 * we find in the ordered array.
	 */
	for (var i = 1; i < array.length; i++) {
	    var counts = array[i].counts;

	    // Each node type
	    for (var type in counts) {
		if (!_.has(array[0].counts, type)) {
		    array[0].counts[type] = counts[type];
		}
	    }
	}
	// The first array element now has all the types we want to graph.
	var types = Object.keys(array[0].counts);

	/*
	 * Okay, since each time stamp has to have data points for every
	 * type, go through each stamp and fill in the missing values from
	 * the immediately preceeding stamp. All of this to make the
	 * fancy tooltip work right! Sheesh.
	 */
	for (var i = 1; i < array.length; i++) {
	    var counts = array[i].counts;

	    // Each node type
	    for (var t = 0; t < types.length; t++) {
		var type = types[t];
		
		if (!_.has(counts, type)) {
		    counts[type] = array[i - 1].counts[type];
		}
	    }
	}
	//console.info(array);

	/*
	 * Finally, create the series data for NVD3.
	 */
	for (var t = 0; t < types.length; t++) {
	    var type = types[t];
	    var values = [];
	    
	    datums[index++] = {
		"key"    : type,
		"area"   : 0,
		"values" : values,
	    };

	    for (var i = 0; i < array.length; i++) {
		var stamp  = array[i].stamp;
		var counts = array[i].counts;

		values[i] = {
		    // convert seconds to milliseconds.
		    "x" : stamp * 1000,
		    "y" : counts[type],
		};
	    }
	}
	return datums;
    }

    function CreateGraph(datums, selector, click_callback) {
	var id = '#' + selector;
	$(id).removeClass("hidden");
	$(id + ' svg').html("");

	window.nv.addGraph(function() {
	    var chart  = window.nv.models.lineChart();
	    var ylabel = "Free Nodes";

	    chart.margin({"left":25,"right":15,"top":20,"bottom":20});

	    chart.xAxis.tickFormat(function(d) {
		return d3.time.format('%m/%d')(new Date(d))
            });	    
	    //chart.yAxis.axisLabel(ylabel);

	    var intformater = d3.format(',.0f');
	    var formatter = function (d) {
		return intformater(d);
	    };
	    chart.yAxis.tickFormat(formatter);
	    chart.useInteractiveGuideline(true);
	    
	    d3.select(id + ' svg')
		.datum(datums)
		.call(chart);

            // set up the tooltip to display full dates
            var tsFormat = d3.time.format('%b %-d, %I:%M%p');
            var tooltip = chart.interactiveLayer.tooltip;
            tooltip.headerFormatter(function (d) {
		return tsFormat(new Date(d));
	    });

	    /*
	     * When user clicks in the graph, send the timestamp back
	     * to the caller for changing the form. 
	     */
	    if (click_callback) {
		chart.lines.dispatch.on("elementClick", function(e) {
		    console.info(e);
		    click_callback(new Date(e[0].point.x));
		});
	    }
	    window.nv.utils.windowResize(chart.update);
	});
    }
    // Pass in forecast info for a single aggregate.
    return function(args) {
	console.info("ShowResGraph", args);
	
	var datums = ProcessData(args.forecast);
	if (datums == null) {
	    return;
	}
	console.info("datums", datums);
	CreateGraph(datums, args.selector, args.click_callback);
    };
}
)();
});
