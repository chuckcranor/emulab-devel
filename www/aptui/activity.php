<?php
#
# Copyright (c) 2000-2018 University of Utah and the Flux Group.
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
include("profile_defs.php");
$page_title = "My Profiles";

#
# Verify page arguments.
#
$optargs = OptionalPageArguments("target_user",    PAGEARG_USER,
				 "target_project", PAGEARG_PROJECT,
                                 "portalonly",     PAGEARG_BOOLEAN,
                                 "min",            PAGEARG_INTEGER,
                                 "max",            PAGEARG_INTEGER);
#
# Get current user.
#
RedirectSecure();
$this_user = CheckLoginOrRedirect();
SPITHEADER(1);

if (!(ISADMIN() || ISFOREIGN_ADMIN())) {
    if (isset($target_user)) {
        if (!$target_user->SameUser($this_user)) {
            SPITUSERERROR("Not enough permission to view this page!");
        }
    }
    elseif (isset($target_project)) {
        $approved = 0;
        
        if (!$target_project->IsMember($this_user, $approved) && $approved) {
            SPITUSERERROR("Not enough permission to view this page!");
        }
    }
    else {
        $target_user = $this_user;
    }
}
$instances = array();

#
# Allow for targeted searches
#
$whereclause = "";

if (isset($target_user)) {
    $target_idx  = $target_user->idx();
    $whereclause = "where h.creator_idx='$target_idx'";
}
elseif (isset($target_project)) {
    $target_idx   = $target_project->pid_idx();
    $whereclause = "where h.pid_idx='$target_idx'";
}
if (isset($portalonly) && $portalonly) {
    if ($whereclause != "") {
        $whereclause = "$whereclause and ";
    }
    else {
        $whereclause = "where ";
    }
    $whereclause .= "servername='$APTHOST' ";
}
# Lets default to last three months if neither min or max provided
if (! (isset($min) || isset($max))) {
    $min = time() - (90 * 3600 * 24);
}
if (isset($min) || isset($max)) {
    if ($whereclause != "") {
        $whereclause = "$whereclause and ";
    }
    else {
        $whereclause = "where ";
    }
    if (isset($min)) {
        $whereclause .= "UNIX_TIMESTAMP(h.started) > $min ";
        if (isset($max)) {
            $whereclause .= "and ";
        }
    }
    if (isset($max)) {
        $whereclause .= "UNIX_TIMESTAMP(h.started) < $max ";
    }
}
$portals = array();
if ($TBMAINSITE) {
    $portals["www.aptlab.net"]         = "APT";
    $portals["www.cloudlab.us"]        = "Cloud";
    $portals["www.emulab.net"]         = "Emulab";
    $portals["www.phantomnet.org"]     = "Phantom";
    $portals["www.powderwireless.net"] = "Powder";
}
else {
    $portals[$APTHOST] = "Emulab";
}
$query_result =
    DBQueryFatal("select h.uuid,h.profile_version,h.created, ".
                 "    h.started,h.destroyed,h.servername, ".
		 "    h.creator,p.uuid as profile_uuid,h.pid,u.email, ".
                 "    h.physnode_count,h.virtnode_count,".
                 "    h.name as instance_name,p.name as profile_name, ".
                 "    truncate(h.physnode_count * ".
                 "      ((UNIX_TIMESTAMP(h.destroyed) - ".
                 "        UNIX_TIMESTAMP(h.started)) / 3600.0),2) as phours, ".
                 "    GROUP_CONCAT(aa.abbreviation) as clusters ".
		 "  from apt_instance_history as h ".
                 "left join apt_instance_aggregate_history as ia ".
                 "     on ia.uuid=h.uuid ".
                 "left join apt_aggregates as aa on aa.urn=ia.aggregate_urn ".
		 "left join apt_profile_versions as p on ".
		 "     p.profileid=h.profile_id and ".
		 "     p.version=h.profile_version ".
		 "left join geni.geni_users as u on u.uuid=h.creator_uuid ".
                 $whereclause . " " .
		 "group by h.uuid order by h.started desc");

if (mysql_num_rows($query_result) == 0) {
    $message = "<b>Oops, there is no activity to show you.</b><br>";
    SPITUSERERROR($message);
    exit();
}

if (1) {
    while ($row = mysql_fetch_array($query_result)) {
        $uuid      = $row["uuid"];
	$pname     = $row["profile_name"];
        $iname     = $row["instance_name"];
	$pproj     = $row["pid"];
	$puuid     = $row["profile_uuid"];
	$created   = DateStringGMT($row["created"]);
	$started   = DateStringGMT($row["started"]);
	$destroyed = DateStringGMT($row["destroyed"]);
	$creator   = $row["creator"];
	$email     = $row["email"];
        $pcount    = $row["physnode_count"];
        $vcount    = $row["virtnode_count"];
        $phours    = $row["phours"];
        $portal    = $portals[$row["servername"]];
        $clusters  = $row["clusters"];
        # Backwards compat.
        if (!isset($pproj)) {
            $pproj = "";
        }
        if (!isset($destroyed)) {
            $destroyed = "";
        }
        if (!isset($iname)) {
            $iname = "&nbsp;";
        }
        
	# If a guest user, use email instead.
	if (isset($email)) {
	    $creator = $email;
	}

        # Save space with array instead of hash.
	$instance =
            array($pname, $pproj, $puuid, $pcount, $vcount,
                  $creator, $started, $destroyed, $phours, $iname,
                  $uuid, $created, $portal, $clusters);
                          
	$instances[] = $instance;
    }
}

# Place to hang the toplevel template.
echo "<div id='activity-body'></div>\n";

echo "<script type='text/javascript'>\n";
echo "    window.AJAXURL  = 'server-ajax.php';\n";
if (isset($min)) {
    echo "    window.MIN  = $min;\n";
}
else {
    echo "    window.MIN  = null;\n";
}
if (isset($max)) {
    echo "    window.MAX  = $max;\n";
}
else {
    echo "    window.MAX  = null;\n";
}
if (isset($target_user)) {
    echo "    window.ARG = 'user=$target_idx';\n";
}
elseif (isset($target_project)) {
    echo "    window.ARG = 'project=$target_idx';\n";
}
else {
    echo "    window.ARG = null;\n";
}
if (isset($portalonly) && $portalonly) {
    echo "    window.PORTALONLY = true;\n";
}
echo "</script>\n";
echo "<script type='text/plain' id='instances-json'>\n";
echo json_encode($instances);
echo "</script>\n";
echo "<link rel='stylesheet' href='css/tablesorter.css'>\n";
echo "<link rel='stylesheet' href='css/jQRangeSlider.css'>\n";
echo "<script src='js/lib/jquery-ui.js'></script>\n";
echo "<script src='js/lib/jQRangeSlider/jQRangeSliderMouseTouch.js'></script>\n";
echo "<script src='js/lib/jQRangeSlider/jQRangeSliderDraggable.js'></script>\n";
echo "<script src='js/lib/jQRangeSlider/jQRangeSliderHandle.js'></script>\n";
echo "<script src='js/lib/jQRangeSlider/jQRangeSliderBar.js'></script>\n";
echo "<script src='js/lib/jQRangeSlider/jQRangeSliderLabel.js'></script>\n";
echo "<script src='js/lib/jQRangeSlider/jQRangeSlider.js'></script>\n";
echo "<script src='js/lib/jQRangeSlider/jQDateRangeSliderHandle.js'></script>\n";
echo "<script src='js/lib/jQRangeSlider/jQDateRangeSlider.js'></script>\n";
echo "<script src='js/lib/jQRangeSlider/jQRuler.js'></script>\n";
echo "<script src='js/lib/jquery.tablesorter.min.js'></script>\n";
echo "<script src='js/lib/jquery.tablesorter.widgets.min.js'></script>\n";
echo "<script src='js/lib/jquery.tablesorter.widget-math.js'></script>\n";

REQUIRE_UNDERSCORE();
REQUIRE_SUP();
REQUIRE_MOMENT();
SPITREQUIRE("js/activity.js");

AddTemplate("activity");

SPITFOOTER();
?>
