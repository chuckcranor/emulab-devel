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
echo "<div id='main-body'>
 <style>
  i.tablesorter-icon {
     top: unset;
  }
 </style>
 <div class='row'>
  <div class='col-sm-12'>
    <table id='portal-hardware-table' class='tablesorter hidden'>
      <thead>
       <tr>
        <th class='sorter-false' colspan=5></th>
        <th class='sorter-false text-center' colspan=6>CPU</th>
        <th class='sorter-false'></th>
        <th class='sorter-false text-center' colspan=4>Storage</th>
        <th class='sorter-false text-center' colspan=7>Network</th>
        <th class='sorter-false text-center'></th>
        <th class='sorter-false text-center'></th>
       </tr>
      </thead>
      <tbody>
      </tbody>
    </table>
  </div>
 </div>
</div>";

$all = Aggregate::AllAggregatesList();
$amlist  = array();
foreach ($all as $index => $aggregate) {
    $urn = $aggregate->urn();
    $am  = $aggregate->name();
    $url = $aggregate->weburl();

    $amlist[$urn] = array(
        "urn"   => $urn,
        "url"   => $url,
        "name"  => $am,
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
echo "<style>
  .tablesorter-bootstrap .tablesorter-header i.tablesorter-icon {
     top: unset;
  }
 </style>\n";
SPITREQUIRE("js/portal-hardware.js");
SPITFOOTER();
?>
