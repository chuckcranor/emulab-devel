<?php
#
# Copyright (c) 2000-2019 University of Utah and the Flux Group.
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
include_once("geni_defs.php");
chdir("apt");
include("quickvm_sup.php");
include_once("instance_defs.php");
include_once("aggregate_defs.php");
$page_title = "Cluster Status";

#
# Get current user.
#
RedirectSecure();
$this_user = CheckLoginOrRedirect();
$isadmin   = (ISADMIN() ? 1 : 0);
$isfadmin  = (ISFOREIGN_ADMIN() ? 1 : 0);

#
# Verify page arguments. Cluster is a domain that we turn into a URN.
#
$optargs = OptionalPageArguments("cluster",  PAGEARG_STRING);

if (isset($cluster)) {
    $aggregate = Aggregate::LookupByNickname($cluster);
    if (!$aggregate) {
        SPITUSERERROR("No such cluster: $cluster");
        exit();
    }
    if ($aggregate->adminonly() && !($isadmin || $isfadmin)) {
        SPITUSERERROR("No permission to view cluster: $cluster");
        exit();
    }
}
SPITHEADER(1);

#
# The apt_aggregates table should tell us what clusters, but for
# now it is always the local cluster
#
if (isset($aggregate)) {
    $aggregates = array($aggregate->nickname() => $aggregate->urn());
}
elseif ($ISCLOUD) {
    $aggregates =
        array("Emulab"    => "urn:publicid:IDN+emulab.net+authority+cm",
              "APT"       => "urn:publicid:IDN+apt.emulab.net+authority+cm",
              "Wisconsin" => "urn:publicid:IDN+wisc.cloudlab.us+authority+cm",
              "Clemson"   => "urn:publicid:IDN+clemson.cloudlab.us+authority+cm",
              "Utah"      => "urn:publicid:IDN+utah.cloudlab.us+authority+cm",
              "OneLab"    => "urn:publicid:IDN+lab.onelab.eu+authority+cm");
}
elseif ($ISPOWDER) {
    $tmp = Aggregate::DefaultAggregateList($this_user);
    $aggregates = array();
    foreach ($tmp as $urn => $aggregate) {
        $aggregates[$aggregate->nickname()] = $urn;
    }
}
else {
    $aggregate  = Aggregate::Lookup($DEFAULT_AGGREGATE_URN);
    $aggregates = array($aggregate->nickname() => $aggregate->urn());
}
echo "<link rel='stylesheet'
            href='css/tablesorter.css'>\n";

# Place to hang the toplevel template.
echo "<div id='page-body'></div>\n";

echo "<script type='text/javascript'>\n";
echo "    window.ISADMIN    = $isadmin;\n";
echo "    window.ISFADMIN   = $isfadmin;\n";
echo "</script>\n";

echo "<script type='text/plain' id='agglist-json'>\n";
echo htmlentities(json_encode($aggregates)) . "\n";
echo "</script>\n";

REQUIRE_UNDERSCORE();
REQUIRE_SUP();
REQUIRE_MOMENT();
SPITREQUIRE("js/cluster-status.js",
            "<script src='js/lib/jquery.tablesorter.min.js'></script>".
            "<script src='js/lib/jquery.tablesorter.widgets.min.js'></script>".
            "<script src='js/lib/sugar.min.js'></script>".
            "<script src='js/lib/jquery.tablesorter.parser-date.js'></script>");

AddTemplateList(array("cluster-status", "cluster-status-templates"));
SPITFOOTER();
?>
