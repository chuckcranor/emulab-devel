<?php
#
# Copyright (c) 2000-2016 University of Utah and the Flux Group.
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
include_once("profile_defs.php");
include_once("instance_defs.php");
$page_title = "My Experiments";
$dblink = GetDBLink("sa");

#
# Verify page arguments.
#
$optargs = OptionalPageArguments("target_user",   PAGEARG_USER,
				 "all",           PAGEARG_BOOLEAN,
                                 "extend",        PAGEARG_BOOLEAN);

if (!isset($all)) {
    $all = 0;
}
# Admin only.
if (!isset($extend)) {
    $extend = 0;
}
#
# Get current user.
#
RedirectSecure();
$this_user = CheckLoginOrRedirect();

if (!isset($target_user)) {
    $target_user = $this_user;
}
if (!$this_user->SameUser($target_user)) {
    if (!ISADMIN()) {
	SPITUSERERROR("You do not have permission to view ".
		      "target user's profiles");
	exit();
    }
}
$target_idx  = $target_user->uid_idx();
$target_uuid = $target_user->uuid();

SPITHEADER(1);

echo "<link rel='stylesheet'
            href='css/tablesorter.css'>\n";

$query_result1 = null;
$query_result2 = null;

if (($all || $extend) && (ISADMIN() || ISFOREIGN_ADMIN())) {
    $where = "";
    $order = "order by expired,a.name";
    if ($extend) {
        $where  = "where a.extension_requested=1 or a.admin_lockdown=1";
        $order  = "order by s.expires asc";
    }
    $query_result1 = 
        DBQueryFatal("select a.*,s.expires,s.hrn,u.email,users.usr_name, ".
                     " (UNIX_TIMESTAMP(now()) > ".
                     "  UNIX_TIMESTAMP(s.expires)) as expired, ".
                     "  truncate(a.physnode_count * ".
                     "   ((UNIX_TIMESTAMP(now()) - ".
                     "     UNIX_TIMESTAMP(a.created)) / 3600.0),2) as phours, ".
                     " IFNULL(aggs.count,0) as aggrows, ".
                     " agg.aggregate_urn as aggrow_urn ".
                     "  from apt_instances as a ".
                     "left join (".
                     "    select uuid, COUNT(*) AS count ".
                     "    from apt_instance_aggregates group by uuid) AS aggs ".
                     "  on aggs.uuid=a.uuid ".
                     "left join apt_instance_aggregates as agg ".
                     "     on agg.uuid=a.uuid ".
                     "left join geni.geni_slices as s on ".
                     "     s.uuid=a.slice_uuid ".
                     "left join geni.geni_users as u on u.uuid=a.creator_uuid ".
                     "left join users on users.uid_idx=a.creator_idx ".
                     "$where $order");
}
else {
    $query_result1 =
        DBQueryFatal("select a.*,s.expires,s.hrn,u.email,users.usr_name, ".
                     " (UNIX_TIMESTAMP(now()) > ".
                     "  UNIX_TIMESTAMP(s.expires)) as expired, ".
                     "  truncate(a.physnode_count * ".
                     "   ((UNIX_TIMESTAMP(now()) - ".
                     "     UNIX_TIMESTAMP(a.created)) / 3600.0),2) as phours, ".
                     " IFNULL(aggs.count,0) as aggrows, ".
                     " agg.aggregate_urn as aggrow_urn".
                     "  from apt_instances as a ".
                     "left join (".
                     "    select uuid, COUNT(*) AS count ".
                     "    from apt_instance_aggregates group by uuid) AS aggs ".
                     "  on aggs.uuid=a.uuid ".
                     "left join apt_instance_aggregates as agg ".
                     "     on agg.uuid=a.uuid ".
                     "left join geni.geni_slices as s on ".
                     "     s.uuid=a.slice_uuid ".
                     "left join geni.geni_users as u on u.uuid=a.creator_uuid ".
                     "left join users on users.uid_idx=a.creator_idx ".
                     "where a.creator_uuid='$target_uuid'");

    $query_result2 =
        DBQueryFatal("select distinct a.*,s.expires,s.hrn,u.email, ".
                     " users.usr_name,  ".
                     " (UNIX_TIMESTAMP(now()) > ".
                     "  UNIX_TIMESTAMP(s.expires)) as expired, ".
                     "  truncate(a.physnode_count * ".
                     "   ((UNIX_TIMESTAMP(now()) - ".
                     "     UNIX_TIMESTAMP(a.created)) / 3600.0),2) as phours, ".
                     " IFNULL(aggs.count,0) as aggrows, ".
                     " agg.aggregate_urn as aggrow_urn ".
                     "  from apt_instances as a ".
                     "left join (".
                     "    select uuid, COUNT(*) AS count ".
                     "    from apt_instance_aggregates group by uuid) AS aggs ".
                     "  on aggs.uuid=a.uuid ".
                     "left join apt_instance_aggregates as agg ".
                     "     on agg.uuid=a.uuid ".
                     "left join geni.geni_slices as s on ".
                     "     s.uuid=a.slice_uuid ".
                     "left join geni.geni_users as u on u.uuid=a.creator_uuid ".
                     "left join group_membership as g on ".
                     "     g.uid_idx='$target_idx' and  ".
                     "     g.pid_idx=a.pid_idx ".
                     "left join users on users.uid_idx=a.creator_idx ".
                     "where a.creator_uuid='$target_uuid' or ".
                     "      g.uid_idx is not null ".
                     "order by a.creator");
}

function SPITROWS($showall, $name, $result)
{
    global $TBBASE, $urn_mapping, $all, $extend;
    
    echo "<input class='form-control search' type='search' data-column='all'
             id='experiment_search_${name}' placeholder='Search'>\n";

    echo "  <table class='tablesorter' id='tablesorter_${name}'>
         <thead>
          <tr>
           <th>Name</th>
           <th>Profile</th>\n";
    if ($showall || $all) {
        echo "     <th>Creator</th>\n";
    }
    echo "     <th>Project</th>
               <th>Status</th>
               <th>Cluster</th>
               <th>PCs</th>
               <th>PHours<b>[1]</b></th>
               <th>VMs</th>\n";
    echo "     <th>Created</th>
               <th>Expires</th>
               </tr>
             </thead>
         <tbody>\n";
    
    while ($row = mysql_fetch_array($result)) {
        $profile_id   = $row["profile_id"];
        $version      = $row["profile_version"];
        $uuid         = $row["uuid"];
        $name         = $row["name"];
        $status       = $row["status"];
        $canceled     = $row["canceled"];
        $created      = DateStringGMT($row["created"]);
        $expires      = DateStringGMT($row["expires"]);
        $expired      = $row["expired"];
        $creator_idx  = $row["creator_idx"];
        $profile_name = "$profile_id:$version";
        $creator_uid  = $row["creator"];
        $creator_name = $row["usr_name"];
        $pid          = $row["pid"];
        $pcount       = $row["physnode_count"];
        $vcount       = $row["virtnode_count"];
        $extending    = $row["extension_requested"];
        $lockdown     = $row["admin_lockdown"] || $row["user_lockdown"] ? 1 : 0;
        $phours       = $row["phours"];
        list($foo,$hrn) = preg_split("/\./", $row["hrn"]);
        $email        = $row["email"];

        if ($extend) {
            if (! ($extending || $expired)) {
                continue;
            }
        }
        # If a guest user, use email instead.
        if (isset($email)) {
            $creator = $email;
        }
        elseif (ISADMIN()) {
            $creator = "<a href='user-dashboard.php?user=$creator_uid'>".
                "$creator_name</a>";
        }
        else {
            $creator = $creator_uid;
        }
        if ($row["expired"]) {
            $status = "expired";
        }
        elseif ($canceled) {
            $status = "canceled";
        }
        $profile = Profile::Lookup($profile_id, $version);
        if ($profile) {
            $profile_name  = $profile->name();
            $profile_uuid  = $profile->uuid();
        }
        if (!isset($name)) {
            $name = $hrn;
        }
        #
        # If arows non-zero, then we use that for aggregate_urn,
        # and if its more then 1, we need to consume the extras rows
        # to get the rest of the aggregate urns.
        #
        if ($row["aggrows"] > 0) {
            $cluster = $urn_mapping[$row["aggrow_urn"]];

            for ($i = 1; $i < $row["aggrows"]; $i++) {
                $row = mysql_fetch_array($result);
                $cluster .= "," . $urn_mapping[$row["aggrow_urn"]];
            }
        }
        else {
            $cluster = $urn_mapping[$row["aggregate_urn"]];
        }
        
        echo " <tr><td>\n";
        if ($all || $extend) {
            if (ISADMIN() || ISFOREIGN_ADMIN()) {
                if ($all) {
                    echo "<a href='status.php?uuid=$uuid'>$name</a>";
                }
                else {
                    echo "<a href='adminextend.php?uuid=$uuid'>$name</a>";
                }
            }
            else {
                echo $name;
            }
        }
        else {
            echo "<a href='status.php?uuid=$uuid'>$name</a>";
        }
        echo "</td>\n";
        if ($profile) {
            echo "<td><a href='show-profile.php?uuid=$profile_uuid'>
                      $profile_name</a></td>";
        }
        else {
            echo "<td>$profile_name</td>\n";
        }
        if ($showall) {
            echo "<td>$creator</td>";
        }
        if (ISADMIN()) {
            echo "  <td><a href='show-project.php?pid=$pid'>".
                "$pid</a></td>";
        }
        else {
            echo "  <td>$pid</td>\n";
        }
        echo "  <td>$status</td>\n";
        echo "  <td>$cluster</td>\n";
        echo "  <td>$pcount</td>";
        echo "  <td>$phours</td>";
        echo "  <td>$vcount</td>";
        echo "  <td class='format-date'>$created</td>\n";

        $style = ($lockdown ? "style='color: red;'" : "");
        echo "  <td class='format-date' $style>$expires</td>";
        echo "</tr>\n";
    }
    echo "   </tbody>
        </table>\n";
    echo "[1] <b>PHours</b>: Number of nodes times number of hours in use.<br>";
}

echo "<div class='row'>
        <div class='col-lg-12 col-lg-offset-0
                    col-md-12 col-md-offset-0
                    col-sm-12 col-sm-offset-0
                    col-xs-12 col-xs-offset-0'>\n";

if (mysql_num_rows($query_result1) == 0) {
    $message = "<b>No experiments to show you.</b> ";

    if (! ($all || $extend)) {
        $message .= "Maybe you want to ".
            "<b><a href='instantiate.php'>start one?</a></b><br>";
    }
    echo $message;
}
else {
    if (ISADMIN() && !$extend) {
        echo "<a href='myexperiments.php?extend=1'>
              Show Outstanding Extensions Requests</a><br>";
    }
    SPITROWS($all, "table1", $query_result1);
}
if ($query_result2 && mysql_num_rows($query_result2)) {
    echo "<br>\n";
    echo "Other experiments in my projects";
    echo "<br>\n";
    SPITROWS(1, "table2", $query_result2);
}

echo " </div>
      </div>\n";

echo "<script src='js/lib/jquery-2.0.3.min.js'></script>\n";
echo "<script src='js/lib/jquery.tablesorter.min.js'></script>\n";
echo "<script src='js/lib/jquery.tablesorter.widgets.min.js'></script>\n";

REQUIRE_SUP();
REQUIRE_MOMENT();
SPITREQUIRE("js/myexperiments.js");

SPITFOOTER();
?>
