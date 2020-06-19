<?php
#
# Copyright (c) 2000-2020 University of Utah and the Flux Group.
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
$page_title = "Frequency Graphs";

#
# Get current user.
#
RedirectSecure();
$this_user = CheckLoginOrRedirect();
$isadmin   = (ISADMIN() ? 1 : 0);

#
# Verify page arguments.
#
$reqargs = RequiredPageArguments("cluster",   PAGEARG_STRING,
                                 "node_id",   PAGEARG_STRING,
                                 "iface",     PAGEARG_STRING);
$optargs = OptionalPageArguments("logid",     PAGEARG_STRING,
                                 "archived",  PAGEARG_BOOLEAN);

#
# The monitor looks at only one iface, rf0. That may change later.
# We check the apt_aggregate_radioinfo table in the ajax call.
#
if (!TBvalid_node_id($cluster)) {
    SPITUSERERROR("Illegal characters in cluster");
    exit();
}
$aggregate = Aggregate::LookupByNickname($cluster);
if (!$aggregate) {
    SPITUSERERROR("No such cluster: $cluster");
    exit();
}
if (!TBvalid_node_id($node_id)) {
    SPITUSERERROR("Illegal characters in node_id");
    exit();
}
if (!TBvalid_node_id($iface)) {
    SPITUSERERROR("Illegal characters in iface");
    exit();
}
if ($iface != "rf0") {
    SPITUSERERROR("Illegal interface: $iface");
    exit();
}
if (isset($logid)) {
    if (!TBvalid_userdata($logid)) {
        SPITUSERERROR("Illegal logid: $logid");
        exit();
    }
}
if (!isset($archived)) {
    $archived = 0;
}
$url = $aggregate->weburl() . "/rfmonitor";
SPITHEADER(1);

echo "<link rel='stylesheet'
            href='css/frequency-graph.css'>\n";

# Place to hang the toplevel template.
echo "<div id='main-body'></div>\n";

# Place to hang the modals for now
echo "<div id='oops_div'></div>
      <div id='confirm_div'></div>
      <div id='waitwait_div'></div>\n";

echo "<script type='text/javascript'>\n";
echo "    window.CLUSTER     = '$cluster';\n";
echo "    window.NODEID      = '$node_id';\n";
echo "    window.IFACE       = '$iface';\n";
echo "    window.URL         = '$url';\n";
echo "    window.ARCHIVED    = $archived;\n";
if (isset($logid)) {
    echo "    window.LOGID       = '$logid';\n";
}
echo "</script>\n";

REQUIRE_UNDERSCORE();
REQUIRE_SUP();
REQUIRE_MOMENT();
REQUIRE_APTFORMS();
AddLibrary("js/freqgraphs.js");
AddTemplateList(array("frequency-graph", "waitwait-modal", "oops-modal"));
SPITREQUIRE("js/frequency-graph.js",
            "<script src='js/lib/streamsaver.js'></script>\n".
            "<script src='js/lib/pako/pako.min.js'></script>\n".
            "<script src='js/lib/d3.v5.js'></script>\n");
SPITFOOTER();
?>
