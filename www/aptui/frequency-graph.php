<?php
#
# Copyright (c) 2000-2023 University of Utah and the Flux Group.
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
$this_user = CheckLogin($check_status);
$isadmin   = 0;
# Operate as a guest user if not logged in,
if (! ($check_status & CHECKLOGIN_LOGGEDIN)) {
    $this_user = null;
}
elseif (ISADMIN()) {
    $isadmin = 1;
}

#
# Verify page arguments.
#
$optargs = OptionalPageArguments("cluster",   PAGEARG_STRING,
                                 "node_id",   PAGEARG_STRING,
                                 "iface",     PAGEARG_STRING,
                                 "logid",     PAGEARG_STRING,
                                 "archived",  PAGEARG_BOOLEAN,
                                 "baseline",  PAGEARG_BOOLEAN,
                                 "incident",  PAGEARG_BOOLEAN,
                                 "which",     PAGEARG_STRING,
                                 "endpoint",  PAGEARG_STRING,
                                 "range",     PAGEARG_STRING);

if (isset($which)) {
    if (! ($which == "rfmonitor" || $which == "rfbaseline" ||
           $which == "rfmonitor-mobile")) {
        SPITUSERERROR("Which graphs do you want to look at?");
        exit();
    }
}
elseif (isset($baseline)) {
    $which = "rfbaseline";    
}
else {
    $which = "rfmonitor";
}
if (!isset($archived)) {
    $archived = 0;
}
if (isset($endpoint)) {
    if (!TBvalid_node_id($endpoint)) {
        SPITUSERERROR("Illegal characters in endoint");
        exit();
    }
}
if ($which != "rfmonitor") {
    if (!$TBMAINSITE) {
        SPITUSERERROR("Not supported here.");
        exit();
    }
    $aggregate = Aggregate::ThisAggregate();
    #
    # Kill the cluster argument, this only makes sense at the Mothership
    #
    unset($cluster);
}
$incident = ($incident ? 1 : 0);

#
# The monitor looks at only one iface, rf0. That may change later.
# We always need the cluster argument. The others are optional.
#
if (isset($cluster)) {
    if (!TBvalid_node_id($cluster)) {
        SPITUSERERROR("Illegal characters in cluster");
        exit();
    }
    $aggregate = Aggregate::LookupByNickname($cluster);
    if (!$aggregate) {
        SPITUSERERROR("No such cluster: $cluster");
        exit();
    }
}
elseif ($which == "rfmonitor") {
    SPITUSERERROR("Missing cluster argument");
    exit();
}
else {
    $cluster = null;
}
if ($which == "rfmonitor" ||
    $which == "rfmonitor-mobile") {
    $url = $aggregate->weburl();
}
else {
    $url = "https://${USERNODE}";
}

if (isset($range)) {
    if (! (preg_match("/^\d+,\d+$/", $range) ||
           preg_match("/^\d+$/", $range))) {
        SPITUSERERROR("Illegal characters in range");
        exit();
    }
    $tokens = preg_split("/,/", $range);
    if (count($tokens) == 1) {
        $rangestart = $tokens[0];
    }
    else {
        $rangestart = $tokens[0];
        $rangeend   = $tokens[1];
    }
}

#
# Gack, convert mobile endpoint nickname to bus-xxxx since that is how
# synthing is uploading things. 
#
if ($which == "rfmonitor-mobile" && isset($endpoint)) {
    $aggregate = Aggregate::LookupByNickname($endpoint);
    if ($aggregate) {
        $endpoint = str_replace("Bus", "bus-", $endpoint);
    }
}

if (isset($node_id)) {
    if (!TBvalid_node_id($node_id)) {
        SPITUSERERROR("Illegal characters in node_id");
        exit();
    }
    $node_id = "'$node_id'";
}
else {
    $node_id = null;
}
#
# Ignore the iface, it is always rf0 for now.
#
if (isset($iface)) {    
    if (!TBvalid_node_id($iface)) {
        SPITUSERERROR("Illegal characters in iface");
        exit();
    }
    $iface = "'rf0'";
}
else {
    $iface = null;
}
if (isset($logid)) {
    if (!TBvalid_userdata($logid)) {
        SPITUSERERROR("Illegal logid: $logid");
        exit();
    }
    #
    # If a logid, we have to have node_id. 
    #
    if (!$node_id) {
        SPITUSERERROR("Missing node_id argument");
        exit();
    }
}
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
echo "    window.CLUSTER     = " . ($cluster ? "'$cluster'" : "null") . ";\n";
echo "    window.NODEID      = " . ($node_id ? $node_id : "null") . ";\n";
echo "    window.IFACE       = " . ($iface ? $iface : "null") . ";\n";
echo "    window.URL         = '$url';\n";
echo "    window.ARCHIVED    = $archived;\n";
echo "    window.WHICH       = '$which';\n";
echo "    window.INCIDENT    = $incident;\n";
if (isset($logid)) {
    echo "    window.LOGID       = '$logid';\n";
}
if (isset($endpoint)) {
    echo "    window.ENDPOINT    = '$endpoint';\n";
}
if (isset($range)) {
    echo "    window.RANGESTART  = $rangestart;\n";
    if (isset($rangeend)) {
        echo "    window.RANGEEND    = $rangeend;\n";
    }
}
echo "</script>\n";

REQUIRE_UNDERSCORE();
REQUIRE_SUP();
REQUIRE_MOMENT();
REQUIRE_APTFORMS();
AddLibrary("js/freqgraphs.js");
AddTemplateList(array("frequency-graph", "waitwait-modal", "oops-modal"));
SPITREQUIRE("js/frequency-graph.js",
            "<script src='js/lib/ponyfill.min.js'></script>\n".
            "<script src='js/lib/streamsaver.js'></script>\n".
            "<script src='js/lib/pako/pako.min.js'></script>\n".
            "<script src='js/lib/d3.v5.js'></script>\n");
SPITFOOTER();
?>
