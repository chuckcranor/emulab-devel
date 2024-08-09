$(function ()
{
    'use strict';
    var amlist;
    var networkCards = {};
    var templates = APT_OPTIONS.fetchTemplateList(['portal-hardware']);

    var GPUMATRIX = 
        "https://docs.nvidia.com/datacenter/tesla/drivers/index.html#software-matrix";
    
    var URL = "https://docs.google.com/spreadsheets/d/" +
	"1g212f80szvu2ylzukoemplifmwnmpw7qrecnlqtqsqs/export?format=csv";
    if (0) {
        // New version
        URL = "https://docs.google.com/spreadsheets/d/" +
            "1AVKGnqTBErsrfdlasV53afjnLOtiapKGD8aDtd-Yfcs/export?format=csv";
    }
    else {
        // Mike
        URL = "https://docs.google.com/spreadsheets/d/" +
            "1Jv27hFLqkmwtV3lCPkQSFNqWPy_dcA87NRytxihP7t4/export?format=csv";
    }
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

    // Silly chars.
    var charArray = 'abcdefghijklmnopqrstuvwxyz'

    /*
      Clemson:
      r6525:   1x100G Mellanox MT27800 [ConnectX-5]
      r650:    1x100G Mellanox MT27800 [ConnectX-5]
      r7525:   1x25G Mellanox MT27800 [ConnectX-5]
               2x100G Mellanox MT42822 BlueField-2 [ConnectX-6 Dx]
      ibm8335: 1x10G Broadcom NetXtreme II BCM57800
      c6420:   1x10G Intel X710 SFP+
      c4130:   1x10G Intel X710 SFP+
      dss7500: 1x10G Intel 2P X520
      c6320:   1x10G Intel 82599ES SFI/SFP+
      c8220x:  1x10G Intel 82599ES SFI/SFP+
      c8220:   1x10G Intel 82599ES SFI/SFP+

      Wisconsin:
      d8545:  1x200G Mellanox MT28908 [ConnectX-6]
      d7525:  1x200G Mellanox MT28908 [ConnectX-6]
      sm220u: 2x100G Mellanox MT2892 [ConnectX-6 Dx]
      sm110p: 2x100G Mellanox MT2892 [ConnectX-6 Dx]
      c4130:  2x10G Intel 82599ES SFI/SFP+
      c240g5: 2x25G Mellanox MT2894 [ConnectX-6 Lx]
      c220g5: 2x10G Intel X710 SFP+
      c240g2: 2x10G Intel 82599ES SFI/SFP+
      c220g2: 2x10G Intel 82599ES SFI/SFP+
      c240g1: 2x10G Intel 82599ES SFI/SFP+
      c220g1: 2x10G Intel 82599ES SFI/SFP+

      Utah:
      d750:       3x25G Broadcom BCM57504 NetXtreme-E
      c6525-100g: 1x25G Mellanox MT27800 [ConnectX-5]
                  1x100G Mellanox MT28800 [ConnectX-5 Ex]
      c6525-25g:  2x25G Mellanox MT27800 [ConnectX-5]
      d6515:      1x25G Broadcom BCM57414 NetXtreme-E (RDMA)
                  2x100G Mellanox MT28800 [ConnectX-5 Ex]
      xl170:      1x25G Mellanox MT27710 [ConnectX-4 Lx]
      m510:       1x10G Mellanox MT27520 [ConnectX-3 Pro]
      m400:       1x10G Mellanox MT27520 [ConnectX-3 Pro]

      APT:
      r320:       1x10G Mellanox MT27500 [ConnectX-3]
      r6220:      1x10G Intel 2P X520

      Emulab:
      d840:   2x40G Intel XL710 QSFP+
      D740:   2x10G Intel X710 SFP+
      d820:   4x10G Intel 2P X520
      d430:   2-4x1G Intel I350
              2-4x10G Intel X710 SFP+
      d710:   4-5x1G Broadcom NetXtreme II BCM5709

     */

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
	    html += "<th " + classes + style + placeholder + ">" + key + "</th>";
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
	html += "<th class='hide-impl filter-onlyAvail'>Cards</th>";
	html += "</tr>";
	$('#portal-hardware-table thead').append(html);

	_.each(data, function (row) {
	    //console.info(row);

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

                    if (!_.has(networkCards, card)) {
                        var val = _.size(networkCards);
                        networkCards[card] = val;
                        $('#network-select')
                            .append("<option value='" + card + "'>" + card + "</option>");
                    }
                }
            });
            
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
		html += "<td class='text-nowrap" + border + "'>";
		
		if (key == "Type name") {
		    var cluster = row["Cluster"]
		    var link    = typeLinks[cluster];
			
		    html += "<a href='" + link + "' target=_blank>" + val + "</a>";
		    hwtype = val;
		}
		else if (key == "Processor type") {
		    var link = row["Processor Link"];
		    link = link.replace("%23", "#");
		    
		    html += "<a href='" + link + "' target=_blank>" + val + "</a>";
		}
		else if (key == "GPU model") {
		    var link = row["GPU Link"];
		    link = link.replace("%23", "#");
		    
		    html += "<a href='" + link + "' target=_blank>" + val + "</a>";
		}
		else if (key == "GPU arch") {
		    html += "<a href='" + GPUMATRIX + "' target=_blank>" + val + "</a>";
		}
                else if (_.has(networks, key) && networks[key]) {
                    html += "<a href='' data-toggle='tooltip' data-bs-toggle='tooltip' " +
                        "data-bs-trigger=hover title='" + networks[key] + "'>" +
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
                }
                index++;
	    });
	    // Duplicate first column
	    html += "<td class='text-nowrap group-border-left'>" + hwtype + "</td>";
            // Network cards hidden column.
	    html += "<td class='hide-impl'>";
            html += row["Network Cards"];
            html += "</td>";
	    html += "</tr>";
	    $('#portal-hardware-table tbody').append(html);
	});
	$('#portal-hardware-table').removeClass("hidden");

	var table = $('#portal-hardware-table')
	    .tablesorter({
		theme : 'bootstrap',
		widgets : [ "uitheme", "filter", "zebra"],

                // hidden filter input/selects will resize the
                // columns, so try to minimize the change
                widthFixed : true,
                
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
                        13 : {
                            "< 480"      : function(e, n, f, i, $r, c, data) {
                                console.info(n);
                                return n < 480; },
                            "480 - 1000"  : function(e, n, f, i, $r, c, data) {
                                console.info(n);
                                return n >= 480 && n < 1000; },
                            "1000 - 3000"    : function(e, n, f, i, $r, c, data) {
                                console.info(n);
                                return n >= 480 && n < 3000; },
                            "> 3000"        : function(e, n, f, i, $r, c, data) {
                                console.info(n);
                                return n >= 3000; },
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
            console.info("Reset Filters");
            table.trigger('filterReset');

            $('.search-select').each(function () {
                $(this).find('option[value=""]').prop("selected", true);
            });
        });

        /*
         * Watch for changes in the search panel selectors, and reflect
         * those changes to the tablesorter filter row selectors. Must
         * trigger a change event to get tablesorter to update.
         */
        $('.search-select').change(function (event) {
            event.preventDefault();
            console.info(event, event.target);

            var column     = $(event.target).data("column");
            var value      = $(event.target).val();
            var tsFilter   = $(".tablesorter-filter-row " +
                               "td[data-column=" + column + "]").find("input, select");
            console.info(column, value, tsFilter);
            $(tsFilter).val(value);

            $(table).one('filterEnd', function(event, config) {
                /*
                 * Now need to reflect changes in the *other* tablesorter selectors,
                 * to the panel selectors.
                 */
                $('.tablesorter-filter-row select:not([data-column=' + column + '])')
                    .each(function () {
                        var column   = $(this).data("column");
                        var selected = $(this).find("option:selected");
                        var selector = $(".search-select[data-column=" + column + "]");
                        console.info("other", column, selector, $(selected).val());
                    
                        // Remove all the options from panel selector
                        $(selector).find('option:not([value=""])').remove();
                        console.info($(selector));

                        // Clone the options from the tablesorter option list.
                        $(this).find('option:not([value=""])').each(function () {
                            var clone = $(this).clone();
                            if (selected.length && $(selected).val() == $(clone).val()) {
                                $(clone).prop("selected", true);
                            }
                            $(selector).append(clone);
                        });
                    });
            });
            if ($(tsFilter).prop('nodeName') == "SELECT") {
                $(tsFilter).change();
            }
            else {
                $(tsFilter).blur();
            }
        });

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
