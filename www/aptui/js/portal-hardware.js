$(function ()
{
    'use strict';
    var amlist;
    var templates = APT_OPTIONS.fetchTemplateList(['portal-hardware']);

    var GPUMATRIX = 
        "https://docs.nvidia.com/datacenter/tesla/drivers/index.html#software-matrix";
    
    var URL = "https://docs.google.com/spreadsheets/d/" +
	"1g212f80szvu2ylzukoemplifmwnmpw7qrecnlqtqsqs/export?format=csv";
    if (true) {
        // New version
        URL = "https://docs.google.com/spreadsheets/d/" +
            "1AVKGnqTBErsrfdlasV53afjnLOtiapKGD8aDtd-Yfcs/export?format=csv";
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

    // Yuck.
    var groupings = [
        4,  // Quantity
        5,  // CPU
        11, // Storage
        12, // Network
        16, // GPUs
        24, // Trailing type column
    ];

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
            var style  = " style='padding-left: 2px !important; " +
                "padding-right: 2px !important;'";
            var border = "";
            if (_.contains(groupings, index)) {
                border = " class=group-border-left";
            }
            console.info(key, border, parseInt(index));
            if (key == "Original Quantity") {
                key = "Orig";
            }
	    html += "<th" + border + style + ">" + key + "</th>";
	    if (key == "Circa") {
		html += "<th" + style + ">lshw</th>";
	    }
            else if (key == "Orig") {
		html += "<th" + style + ">Now</th>";
		html += "<th" + style + ">Free</th>";
            }
            index++;
	});
	// Duplicate first column
	html += "<th class=group-border-left>Type Name</th>";
	html += "</tr>";
	$('#portal-hardware-table thead').append(html);

	_.each(data, function (row) {
	    console.info(row);

            /*
             * Determine network cards for each resident speed.
             */
            var networkCards = {
                "100 Mbps" : null,
                "1 Gbps"   : null,
                "10 Gbps"  : null,
                "25 Gbps"  : null,
                "40 Gbps"  : null,
                "100 Gbps" : null,
                "200 Gbps" : null,
            };
            var cards = row["Network Cards"].split(",");
            _.each(_.keys(networkCards), function(speed, index) {
                var card = cards[index];
                if (card !== undefined && card != "") {
                    networkCards[speed] = card;
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
                else if (_.has(networkCards, key) && networkCards[key]) {
                    html += "<a data-toggle='tooltip' data-bs-toggle='tooltip' " +
                        "data-bs-trigger=hover title='" + networkCards[key] + "'>" +
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
                else if (key == "Original Quantity") {
		    var urn  = row["URN"];
                    var now  = amlist[urn].typeinfo[hwtype].count;
                    var free = amlist[urn].typeinfo[hwtype].free;
                    
		    html += "<td>";
		    html += now;
		    html += "</td>";
		    html += "<td>";
		    html += free;
		    html += "</td>";
                }
                index++;
	    });
	    // Duplicate first column
	    html += "<td class='text-nowrap group-border-left'>" + hwtype + "</td>";
	    html += "</tr>";
	    $('#portal-hardware-table tbody').append(html);
	});
	$('#portal-hardware-table').removeClass("hidden");

	$('#portal-hardware-table')
	    .tablesorter({
		theme : 'bootstrap',
		widgets : [ "uitheme", "filter" ],
                tableClass: "table-hover",
                cssHeader: "foobar",
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
		    filter_columnFilters : false,
		    // Search as typing
		    filter_liveSearch : true,
		},
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
