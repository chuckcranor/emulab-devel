<?php
#
# Copyright (c) 2000-2024 University of Utah and the Flux Group.
# 
# {{{EMULAB-LICENSE
# 
# This file is part of the Emulab network testbed software.
# 
# This file is free software: you can redistribute it and/or modify it
# under the terms of the GNU Affero General Public License as published by
# the Free Software Foundation, either version 3 of the License, or (at
# your option) any later version.
# 
# This file is distributed in the hope that it will be useful, but WITHOUT
# ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
# FITNESS FOR A PARTICULAR PURPOSE.  See the GNU Affero General Public
# License for more details.
# 
# You should have received a copy of the GNU Affero General Public License
# along with this file.  If not, see <http://www.gnu.org/licenses/>.
# 
# }}}
#
chdir("..");
include("defs.php3");
chdir("apt");
include("quickvm_sup.php");
# Must be after quickvm_sup.php since it changes the auth domain.
$page_title = "Portal Hardware";

SPITHEADER(1);

# Place to hang the toplevel template.
echo "<div id='main-body'></div>\n";

$all = Aggregate::AllAggregatesList();
$amlist  = array();
foreach ($all as $index => $aggregate) {
    $urn = $aggregate->urn();
    $am  = $aggregate->name();
    $url = $aggregate->weburl();
    $typeinfo = $aggregate->typeinfo;

    foreach ($aggregate->ReservableNodes(1) as $node => $info) {
        $typename = $info["type"];
        if (!array_key_exists($typename, $typeinfo)) {
            $typeinfo[$typename] = array("count" => 0, "free" => 0);
        }
        $typeinfo[$typename]["count"]++;
        if ($info["available"]) {
            $typeinfo[$typename]["free"]++;
        }
    }
    $amlist[$urn] = array(
        "urn"   => $urn,
        "url"   => $url,
        "name"  => $am,
        "typeinfo" => $typeinfo,
    );
}
echo "<script type='text/plain' id='amlist-json'>\n";
echo htmlentities(json_encode($amlist, JSON_NUMERIC_CHECK), ENT_COMPAT);
echo "</script>\n";

REQUIRE_UNDERSCORE();
REQUIRE_SUP();
REQUIRE_MOMENT();
REQUIRE_MARKED();
REQUIRE_TABLESORTER();
AddLibrary("js/lib/jquery.csv.js");
SPITREQUIRE("js/portal-hardware.js");
AddTemplate("portal-hardware");
SPITFOOTER();
?>
