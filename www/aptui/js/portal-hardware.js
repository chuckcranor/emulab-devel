$(function ()
{
    'use strict';
    var amlist;
    var networkCards        = {};
    var networkSpeeds       = {};
    var templates           = APT_OPTIONS.fetchTemplateList(['portal-hardware']);
    var matchingNodes       = 0;
    var lastNetCardOptions  = null;
    var lastNetSpeedOptions = null;
    var filterChanging      = null;

    var GPUMATRIX = 
        "https://docs.nvidia.com/datacenter/tesla/drivers/index.html#software-matrix";
    
    // Mike
    var URL = "https://docs.google.com/spreadsheets/d/" +
        "1Jv27hFLqkmwtV3lCPkQSFNqWPy_dcA87NRytxihP7t4/export?format=csv";

    var ignore = [
	"Max blockstore avail (GB)",
	"Control network speed",
	"Notes",
	"Processor Link",
	"URN",
	"GPU Link",
        "Network Cards",
    ];
    var typeLinks = {
	"Emulab" : "https://gitlab.flux.utah.edu/emulab/emulab-devel/wikis/Utah%20Cluster",
	"Powder" : "https://gitlab.flux.utah.edu/emulab/emulab-devel/wikis/Utah%20Cluster",
	"Apt"    : "http://docs.cloudlab.us/hardware.html#(part._apt-cluster)",
	"Cloudlab Utah" : "http://docs.cloudlab.us/hardware.html#(part._cloudlab-utah)",
	"Cloudlab Wisc" : "http://docs.cloudlab.us/hardware.html#(part._cloudlab-wisconsin)",
	"Cloudlab Clemson" : "http://docs.cloudlab.us/hardware.html#(part._cloudlab-clemson)",
	"Cloudlab UMass" : "http://docs.cloudlab.us/hardware.html#%28part._mass%29",
	"Onelab" : "http://docs.cloudlab.us/hardware.html#(part._cloudlab-utah)",
    };

    var gpus = {
        "K80"   : "https://www.techpowerup.com/gpu-specs/tesla-k80.c2616",
        "K40m"  : "https://www.techpowerup.com/gpu-specs/tesla-k40m.c2529",
        "A100"  : "https://www.techpowerup.com/gpu-specs/a100-pcie-40-gb.c3623",
        "P100"  : "https://www.techpowerup.com/gpu-specs/tesla-p100-pcie-16-gb.c2888",
        "V100"  : "https://www.techpowerup.com/gpu-specs/tesla-v100-pcie-32-gb.c3184",
        "A30"   : "https://www.techpowerup.com/gpu-specs/a30-pcie.c3792",
        "V100S" : "https://www.techpowerup.com/gpu-specs/tesla-v100s-pcie-32-gb.c3467",
    };

    // The columns get selectors
    var columnSelectors = [
        "Cluster",
        "Processor type",
        "DRAM (GB)",
        "GPU model",
        "Total threads",
        "Total disk (GB)",
        "Procs",
    ];

    // Yuck.
    var groupings = [
        4,  // Quantity
        5,  // CPU
        11, // Storage
        12, // Network
        16, // GPUs
        24, // Trailing type column
    ];

    function initialize()
    {
	window.APT_OPTIONS.initialize(sup);

	amlist = JSON.parse(_.unescape($('#amlist-json')[0].textContent));
	console.info("amlist", amlist);
	$('#main-body').html(templates["portal-hardware"]);
	
	$.ajax({
	    type: "GET",  
	    url: URL,
	    dataType: "text",       
	    success: function(response)  
	    {
		//console.info(response);
		/*
		 * First line is Mike's column grouping. Cut that out,
		 * and process it later.
		 */
		var lines = response.split('\n');
		var first = lines[0];
		var rest  = lines.slice(1).join('\n');
		
		var data = $.csv.toObjects(rest);
		PopulateTable(first, data);
	    }   
	});
    }

    function PopulateTable(first, data)
    {
	console.info("PopulateTable", data);
	var html = "<tr>";
        var index = 1;
        
	_.each(data[0], function (val, key) {
	    if (_.contains(ignore, key)) {
		return;
	    }
            //var placeholder = " data-placeholder='' ";
            var placeholder = " ";
            
            var style  = " style='padding-left: 2px !important; " +
                "padding-right: 2px !important;' ";
            var classes = [];
            
            if (_.contains(groupings, index)) {
                classes.push('group-border-left');
            }
            if (_.contains(columnSelectors, key)) {
                classes.push("filter-select", "filter-onlyAvail");
            }
            else if (key != "Total disk (GB)") {
                classes.push("filter-false");
            }
            if (classes.length == 0) {
                classes = "";
            }
            else {
                classes = "class='" + classes.join(" ") + "' ";
            }
            //console.info(key, classes, parseInt(index));
            if (key == "Number in service") {
                key = "Total";
            }
	    html += "<th " + classes + style + placeholder + ">" +
                key + "</th>";
	    if (key == "Circa") {
		html += "<th class=filter-false " + style + ">lshw</th>";
	    }
            else if (key == "Total") {
		html += "<th class=filter-false " + style + ">Free</th>";
            }
            index++;
	});
	// Duplicate first column
	html += "<th class='group-border-left filter-false'>Type Name</th>";
        // Network cards hidden column.
	html += "<th class='hide-impl filter-select filter-onlyAvail'>Cards</th>";
        // Architecture hidden column.
	html += "<th class='hide-impl filter-select filter-onlyAvail'>Arch</th>";
        // Network speeds hidden column.
	html += "<th class='hide-impl filter-select filter-onlyAvail'>Speeds</th>";
	html += "</tr>";
	$('#portal-hardware-table thead').append(html);

	_.each(data, function (row) {
	    //console.info(row);

            // For the hidden speeds row.
            var allspeeds = {};

            /*
             * Determine network cards for each resident speed.
             */
            var networks = {
                "100 Mbps" : null,
                "1 Gbps"   : null,
                "10 Gbps"  : null,
                "25 Gbps"  : null,
                "40 Gbps"  : null,
                "100 Gbps" : null,
                "200 Gbps" : null,
            };
            var cards = row["Network Cards"].split(",");
            _.each(_.keys(networks), function(speed, index) {
                var card = cards[index];
                if (card !== undefined && card != "") {
                    networks[speed] = card;
                    allspeeds[speed] = speed;

                    if (!_.has(networkCards, card)) {
                        var val = _.size(networkCards);
                        networkCards[card] = val;
                        $('#network-cards-select')
                            .append("<option value='" + card + "'>" +
                                    card + "</option>");
                    }
                    networkSpeeds[speed] = speed;
                }
            });

            var $arch;
	    var hwtype;
	    var html = "<tr>";
            index = 1;
	    _.each(row, function (val, key) {
		if (_.contains(ignore, key)) {
		    return;
		}
                var border = "";
                if (_.contains(groupings, index)) {
                    border = " group-border-left";
                }
                if (key == "Number in service") {
                    border += " total-nodes";
                }
		html += "<td class='text-nowrap" + border + "'>";
		
		if (key == "Type name") {
		    var cluster = row["Cluster"]
		    var link    = typeLinks[cluster];
			
		    html += "<a href='" + link + "' target=_blank>" +
                        val + "</a>";
		    hwtype = val;
		}
		else if (key == "Processor type") {
		    var link = row["Processor Link"];
		    link = link.replace("%23", "#");
		    
		    html += "<a href='" + link + "' target=_blank>" +
                        val + "</a>";

                    // For the Architecture filter.
	            var matches = val.match(/(intel|amd|arm|ibm|nvidia)/i);
	            if (matches) {
                        $arch = matches[1];
	            }
		}
		else if (key == "GPU model") {
		    var link = row["GPU Link"];
		    link = link.replace("%23", "#");
		    
		    html += "<a href='" + link + "' target=_blank>" +
                        val + "</a>";
		}
		else if (key == "GPU arch") {
		    html += "<a href='" + GPUMATRIX + "' target=_blank>" +
                        val + "</a>";
		}
                else if (_.has(networks, key) && networks[key]) {
                    html += "<a href='' data-toggle='tooltip' " + 
                        "data-bs-toggle='tooltip' " +
                        "data-bs-trigger=hover title='" + networks[key]
                        + "'>" +
                        val + "</a>";
                }
		else {
		    html += val;
		}
		html += "</td>";
		
		if (key == "Circa") {
		    var urn = row["URN"];
		    var url = amlist[urn].url +
			"/portal/show-hardware.php?type=" + hwtype;
		    var link = "<a href='" + url + "' target=_blank>" +
			"<span class='glyphicon glyphicon-link'></span></a>";

		    html += "<td class='text-nowrap'>";
		    html += link;
		    html += "</td>";
		}
                else if (key == "Number in service") {
		    var urn  = row["URN"];
                    var now  = amlist[urn].typeinfo[hwtype].count;
                    var free = amlist[urn].typeinfo[hwtype].free;
                    
		    html += "<td>";
		    html += free;
		    html += "</td>";
                    matchingNodes += parseInt(now);
                }
                index++;
	    });
	    // Duplicate first column
	    html += "<td class='text-nowrap group-border-left'>" +
                hwtype + "</td>";
            // Network cards hidden column.
	    html += "<td class='hide-impl network-cards-impl'>";
            html += row["Network Cards"];
            html += "</td>";
            // Architecture hidden column.
	    html += "<td class='hide-impl'>";
            html += $arch;
            html += "</td>";
            // Network speeds hidden column.
	    html += "<td class='hide-impl network-speeds-impl'>";
            html += _.values(allspeeds).join(",");
            html += "</td>";
            
	    html += "</tr>";
	    $('#portal-hardware-table tbody').append(html);
	});
	$('#portal-hardware-table').removeClass("hidden");
        $('#matching-nodes').html(matchingNodes);

        lastNetCardOptions  = _.keys(networkCards);
        lastNetSpeedOptions = _.keys(networkSpeeds);

	var table = $('#portal-hardware-table')
	    .tablesorter({
		theme : 'bootstrap',
		widgets : [ "uitheme", "filter", "zebra"],

                // hidden filter input/selects will resize the
                // columns, so try to minimize the change
                widthFixed : true,

                // tablesorter default is not what we want.
                sortInitialOrder: "desc",
                
		widgetOptions: {
		    // include child row content while filtering, if true
		    filter_childRows  : false,
		    // Set this option to false for case sensitive search
		    filter_ignoreCase : true,
		    // Only one search box.
		    filter_columnFilters : true,
		    // Search as typing
		    filter_liveSearch : false,
                    // Too confusing
                    filter_saveFilters : false,
                    // Special cases.
                    filter_functions : {
                        // Add these options to the select dropdown
                        7 : {
                            "< 16"      : function(e, n, f, i, $r, c, data) {
                                return n < 16; },
                            "16 - 32" : function(e, n, f, i, $r, c, data) {
                                return n >= 16 && n <= 32; },
                            "33 - 72" : function(e, n, f, i, $r, c, data) {
                                return n >= 33 && n <= 72; },
                            "> 72"      : function(e, n, f, i, $r, c, data) {
                                return n > 72; },
                        },
                        13 : {
                            "< 480"      : function(e, n, f, i, $r, c, data) {
                                return n < 480; },
                            "480 - 1000" : function(e, n, f, i, $r, c, data) {
                                return n >= 480 && n < 1000; },
                            "1000 - 3000" : function(e, n, f, i, $r, c, data) {
                                return n >= 480 && n < 3000; },
                            "> 3000"      : function(e, n, f, i, $r, c, data) {
                                return n >= 3000; },
                        },
                        31 : function(e, n, f, i, $r, c, data) {
                            return e.includes(f);
                        },
                        33 : function(e, n, f, i, $r, c, data) {
                            return e.includes(f);
                        },
                    },
                    filter_selectSource: {
                        31 : function(table, column) {
                            var selected = $('#network-cards-select').find("option:selected").val();
                            //console.info("B 31", selected, filterChanging);

                            if (filterChanging == 31 && selected != "") {
                                filterChanging = null;
                                return lastNetCardOptions;
                            }
                            var allcards = {};
                            $('#portal-hardware-table tbody tr:not(.filtered) .network-cards-impl')
                                .each(function () {
                                    //console.info($(this), $(this).text());
                                    _.each($(this).text().split(","), function (card) {
                                        if (card != "") {
                                            //console.info(card);
                                            allcards[card] = card;
                                        }
                                    })
                                });
                            lastNetCardOptions = _.keys(allcards);
                            return lastNetCardOptions;
                        },
                        33 : function(table, column) {
                            var selected = $('#network-speeds-select').find("option:selected").val();
                            //console.info("B 33", table, column, selected);

                            if (filterChanging == 33 && selected != "") {
                                filterChanging = null;
                                return lastNetSpeedOptions;
                            }

                            var allspeeds = {};
                            $('#portal-hardware-table tbody tr:not(.filtered) .network-speeds-impl')
                                .each(function () {
                                    //console.info($(this), $(this).text());
                                    _.each($(this).text().split(","), function (speed) {
                                        if (speed != "") {
                                            //console.info(speed);
                                            allspeeds[speed] = speed;
                                        }
                                    })
                                });
                            lastNetSpeedOptions = _.keys(allspeeds);
                            return lastNetSpeedOptions;
                        },
                    },
		},
	    });
        window.TABLE = table;

        $(".tablesorter-filter-row").addClass("hide-impl");

        /*
         * Clone the selectors to the search panel selectors
         */
        $('.tablesorter-filter-row select').each(function () {
            var column   = $(this).data("column");
            var selector = $(".search-select[data-column=" + column + "]");
            //console.info("selector column", column, selector);

            // Remove all the options from panel selector
            $(selector).find('option:not([value=""])').remove();

            // Clone the options from the tablesorter option list.
            $(this).find('option:not([value=""])').each(function () {
                $(selector).append($(this).clone());
            });
        });

        /*
         * Reset the tablesorter filters and the panel selectors.
         */
        $('.reset-filters').click(function (event) {
            event.preventDefault();
            //console.info("Reset Filters");
            table.trigger('filterReset');

            $('.search-select').each(function () {
                $(this).find('option[value=""]').prop("selected", true);
            });
            lastNetCardOptions  = _.keys(networkCards);
            lastNetSpeedOptions = _.keys(networkSpeeds);
        });

        /*
         * Watch for changes in the search panel selectors, and reflect
         * those changes to the tablesorter filter row selectors. Must
         * trigger a change event to get tablesorter to update.
         */
        $('.search-select').change(function (event) {
            event.preventDefault();
            //console.info(event, event.target);

            var column     = $(event.target).data("column");
            var value      = $(event.target).val();
            var tsFilter   = $(".tablesorter-filter-row " +
                               "td[data-column=" + column + "]")
                .find("input, select");

            filterChanging = column;
            console.info("search-select change", column, value, tsFilter);
            $(tsFilter).val(value);

            $(table).one('filterEnd', function(event, config) {
                /*
                 * Now need to reflect changes in the *other* tablesorter
                 * selectors, to the panel selectors.
                 */
                syncFilters(column);
                updateMatched();
            });
            
            if ($(tsFilter).prop('nodeName') == "SELECT") {
                $(tsFilter).change();
            }
            else {
                $(tsFilter).blur();
            }
        });

        /*
         * Sync tablesorter filters to the panel filters so that the panel
         * reflect changes in the tablesorter filters after filtering. The
         * optional argument is to avoid the filter that the user changed.
         */
        function syncFilters(skipColumn)
        {
            //console.info("syncFilters", skipColumn);
            
            var skipper = "";
            if (skipColumn !== undefined) {
                skipper = ':not([data-column=' + skipColumn + '])';

            }
            $('.tablesorter-filter-row select' + skipper)
                .each(function () {
                    var column   = $(this).data("column");
                    var selected = $(this).find("option:selected");
                    var selector = $(".search-select[data-column=" +
                                     column + "]");
                    //console.info("other", column, selector,
                    //$(selected).val());
                    
                    // Remove all the options from panel selector
                    $(selector).find('option:not([value=""])').remove();
                    //console.info($(selector));

                    // Clone the options from the tablesorter option list.
                    $(this).find('option:not([value=""])').each(function () {
                        var clone = $(this).clone();
                        if (selected.length &&
                            $(selected).val() == $(clone).val()) {
                            $(clone).prop("selected", true);
                        }
                        $(selector).append(clone);
                    });
                });
        }

        /*
         * Count up total number of nodes on each 
         */
        $(table).on('filterEnd.counter', function(event, config) {
            //console.info("filterEnd.counter");
            syncFilters();
            updateMatched();
        });
    
        /*
         * Update the matched nodes counter by scanning non-filterered rows
         */
        function updateMatched()
        {
            matchingNodes = 0;
            
            $('#portal-hardware-table tbody tr:not(.filtered)')
                .each(function () {
                    var total = $(this).find(".total-nodes").html()
                    matchingNodes += parseInt(total);
                });
            
            $('#matching-nodes').html(matchingNodes);
        }

	// This activates the popover subsystem.
	$('[data-toggle="popover"]').popover({
	    trigger: 'hover',
	});
	$('[data-toggle="tooltip"]').tooltip({
	    placement: 'right',
	});

    }

    $(document).ready(initialize);
});
