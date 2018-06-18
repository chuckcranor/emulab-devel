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

# 
# Allow this to be fetched from pages loaded anywhere
#
header("Access-Control-Allow-Origin: *");

#
# For the Cloudlab front page, to display some current stats.
#
$blob = array();

#
# Number of active experiments.
#
$query_result =
    DBQueryFatal("select count(uuid) from apt_instances");
if ($query_result) {
    $row = mysql_fetch_array($query_result);
    $blob["active_experiments"] = $row[0];
}

#
# Number of experiments ever
#
$query_result =
    DBQueryFatal("select count(uuid) from apt_instance_history where servername='www.cloudlab.us'");
if ($query_result) {
    $row = mysql_fetch_array($query_result);
    $blob["total_experiments"] = $row[0];
}

#
# Number Cloudlab projects.
#
$query_result =
    DBQueryFatal("select count(pid) from projects ".
                 "where approved=1 and portal='cloudlab'");
if ($query_result) {
    $row = mysql_fetch_array($query_result);
    $blob["projects"] = $row[0];
}

#
# Number of users who have ever created an experiment.
#
$query_result =
    DBQueryFatal("(select distinct creator from apt_instance_history) ".
                 "union ".
                 "(select distinct creator from apt_instances)");
if ($query_result) {
    $blob["distinct_users"] = mysql_num_rows($query_result);
}

#
# Number of profiles (both public and private)
#
$query_result =
    DBQueryFatal("select count(uuid) from apt_profiles");
if ($query_result) {
    $row = mysql_fetch_array($query_result);
    $blob["profiles"] = $row[0];
}

#
# For the Emulab Portal frontpage, we return inuse/free counts for
# the allocatable node types, mostly so we have something interesting
# to show.
#
$typeinfo  = array();
$prunelist = Instance::NodeTypePruneList();

#
# Get total number of nodes.
#
$query_result =
   DBQueryFatal("select n.type,count(*) as count from nodes as n ".
                "left join node_types as nt on n.type=nt.type ".
                "left join node_type_attributes as attr on ".
                "     attr.type=n.type and ".
                "     attr.attrkey='noshowfreenodes' ".
                "where (role='testnode') and class='pc' and ".
                "      attr.attrvalue is null ".
                "group BY n.type");

while ($row = mysql_fetch_array($query_result)) {
    $type  = $row["type"];
    $count = $row["count"];

    if (!array_key_exists($type, $prunelist)) {
        $typeinfo[$type] = array("total" => $count, "free" => 0);
    }
}

# Get free totals by type.
$query_result =
   DBQueryFatal("select n.type,count(*) as count from nodes as n ".
                "left join node_types as nt on n.type=nt.type ".
                "left join reserved as r on r.node_id=n.node_id ".
                "left join node_type_attributes as attr on ".
                "     attr.type=n.type and ".
                "     attr.attrkey='noshowfreenodes' ".
                "where (role='testnode') and class='pc' and ".
                "      r.pid is null and ".
                "      attr.attrvalue is null and ".
                "      (n.reserved_pid is null) AND ".
                "      (n.eventstate='" . TBDB_NODESTATE_ISUP . "' or ".
                "       n.eventstate='" . TBDB_NODESTATE_POWEROFF . "' or ".
                "       n.eventstate='" . TBDB_NODESTATE_ALWAYSUP . "' or ".
                "       n.eventstate='" . TBDB_NODESTATE_PXEWAIT . "') ".
                "group BY n.type");

while ($row = mysql_fetch_array($query_result)) {
    $type  = $row["type"];
    $count = $row["count"];

    if (!array_key_exists($type, $prunelist)) {
        $typeinfo[$type]["free"] = $count;
    }
}

$blob["typeinfo"] = $typeinfo;

echo json_encode($blob);
