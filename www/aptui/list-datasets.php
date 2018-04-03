<?php
#
# Copyright (c) 2000-2016, 2018 University of Utah and the Flux Group.
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
include("lease_defs.php");
include("blockstore_defs.php");
include("imageid_defs.php");
chdir("apt");
include("quickvm_sup.php");
include("dataset_defs.php");
$page_title = "My Datasets";

#
# Verify page arguments.
#
$optargs = OptionalPageArguments("target_user",   PAGEARG_USER,
				 "all",           PAGEARG_BOOLEAN);

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
$target_idx = $target_user->uid_idx();
$target_uid = $target_user->uid();

SPITHEADER(1);

echo "<link rel='stylesheet'
            href='css/tablesorter.css'>\n";

$whereclause1 = "where l.owner_uid='$target_uid' and ad.uuid is null";
$whereclause2 = "where v.creator='$target_uid' and v.isdataset=1";
$whereclause3 = "where d.creator_uid='$target_uid'";
$joinclause1  = "";
$joinclause2  = "left join image_versions as v on ".
    "              v.imageid=i.imageid and v.version=i.version ";
$joinclause3  = "";

if (isset($all)) {
    if (ISADMIN()) {
	$whereclause1 = "where ad.uuid is null";
	$whereclause2 = "where v.isdataset=1";
	$whereclause3 = "";
    }
    else {
	$joinclause1 =
	    "left join group_membership as g on ".
	    "     g.uid='$target_uid' and ".
	    "     g.pid=l.pid and g.pid_idx=g.gid_idx";
	$joinclause2 .=
	    "left join group_membership as g on ".
	    "     g.uid='$target_uid' and ".
	    "     g.pid=i.pid and g.pid_idx=g.gid_idx";
	$joinclause3 =
	    "left join group_membership as g on ".
	    "     g.uid='$target_uid' and ".
	    "     g.pid=d.pid and g.pid_idx=g.gid_idx";
	$whereclause1 =
	    "where l.owner_uid='$target_uid' or ".
	    "      g.uid_idx is not null ";
	$whereclause2 =
	    "where (v.creator='$target_uid' or ".
	    "       g.uid_idx is not null) and v.isdataset=1 ";
	$whereclause3 =
	    "where (d.creator_uid='$target_uid' or ".
	    "       g.uid_idx is not null) ";
    }
}
#
# In the main portal, we show only those datasets on the local cluster.
#
if ($ISEMULAB) {
    $whereclause3 .= "and agg.urn='$DEFAULT_AGGREGATE_URN'";
}

$classic_result =
    DBQueryFatal(
        "select uuid,type,name from ".
        "  ((select l.uuid as uuid,'lease' as type,l.lease_id as name ".
        "      from project_leases as l ".
        "    $joinclause1 ".
        "    left join apt_datasets as ad on ad.remote_uuid=l.uuid ".
        "     $whereclause1) ".
        "   union ".
        "   (select i.uuid as uuid,'image' as type,i.imagename as name ".
        "       from images as i ".
        "    $joinclause2 ".
        "    $whereclause2)) as foo order by name");

$portal_result =
    DBQueryFatal("select d.uuid,agg.nickname, ".
                 "  'dataset' as type from apt_datasets as d ".
                 "left join apt_aggregates as agg on agg.urn=d.aggregate_urn ".
                 "$joinclause3 ".
                 "$whereclause3 order by d.dataset_id");

echo "<div class='row'>
       <div class='col-lg-12 col-lg-offset-0
                   col-md-12 col-md-offset-0
                   col-sm-12 col-sm-offset-0
                   col-xs-12 col-xs-offset-0'>\n";

function SPITTABLE($which, $results, $where) {
    global $all,$embedded;

    if ($which == "main") {
        echo "<input class='form-control search' type='search' data-column='all'
             id='dataset_search' placeholder='Search'>\n";
    }
    echo "  <table class='tablesorter' id='${which}_table'>
             <thead>
              <tr>
               <th>Name</th>";
        if (isset($all) && ISADMIN()) {
            echo " <th>Creator</th>";
        }
        echo "     <th>Project</th>
                   <th>Type</th>\n";
        if ($where == "portal") {
            echo " <th>Cluster</th>\n";
        }
        echo "     <th>State</th>
                   <th>Size</th>
                   <th>Expires</th>
              </tr>
            </thead>
          <tbody>\n";

        while ($row = mysql_fetch_array($results)) {
            $uuid    = $row["uuid"];
            $type    = $row["type"];

            if ($type == "image") {
                $dataset = ImageDataset::Lookup($uuid);
            }
            elseif ($type == "lease") {
                $dataset = Lease::Lookup($uuid);
            }     
            elseif ($type == "dataset") {
                $dataset = Dataset::Lookup($uuid);
            }
            $idx     = $dataset->idx();
            $name    = $dataset->id();
            $dtype   = $dataset->type();
            $pid     = $dataset->pid();
            $creator = $dataset->owner_uid();
            $expires = $dataset->expires();
            $size    = $dataset->size() ? $dataset->size() : "0";
            #
            # The state is a bit of a problem, since local leases do not have
            # an "allocating" state. For a remote dataset, we get set to busy.
            # Need to unify this. But the main point is that we want to tell
            # the user that the dataset is busy allocation.
            #
            if ($dataset->state() == "busy" ||
                ($dataset->state() == "unapproved" && $dataset->locked())) {
                $state = "allocating";
            }
            else {
                $state = $dataset->state();
            }
            
            echo " <tr>
                <td><a href='show-dataset.php?uuid=$uuid&embedded=$embedded'>
                $name</a></td>\n";

            if (isset($all) && ISADMIN()) {
                echo "<td><a href='user-dashboard.php?user=$creator'>
		       $creator</a></td>";
            }
            echo "<td><a href='show-project.php?project=$pid'>$pid</a></td>
                    <td>$dtype</td>\n";
            if ($where == "portal") {
                $cluster = $row["nickname"];
                echo "<td>$cluster</th>";
            }
            echo "  <td>$state</td>
                    <td>$size MiB</td>
                    <td class='format-date'>$expires</td>
                 </tr>\n";
        }
        echo "   </tbody>
             </table>\n";
}

$message = "<b>No datasets to show you. Maybe you want to ".
    "<a id='embedded-anchors'
        href='create-dataset.php?embedded=$embedded'>create one?</a></b>
      <br><br>";

if ($embedded) {
    if (!mysql_num_rows($classic_result)) {
        echo $message;
    }
    else {
        SPITTABLE("main", $classic_result, "classic");
    }
}
else {
    if (!mysql_num_rows($portal_result)) {
        echo $message;
    }
    else {
        SPITTABLE("main", $portal_result, "portal");
    }
    if (mysql_num_rows($classic_result)) {
        echo "<br>\n";
        echo "<center><h4>Classic Emulab Datasets</h4></center>\n";
        SPITTABLE("classic", $classic_result, "classic");
        echo "<br>\n";
    }
}
echo "</div></div>\n";

echo "<script type='text/javascript'>\n";
echo "    window.AJAXURL  = 'server-ajax.php';\n";
echo "</script>\n";

REQUIRE_SUP();
REQUIRE_MOMENT();
SPITREQUIRE("js/list-datasets.js",
         "<script src='js/lib/jquery.tablesorter.min.js'></script>\n".
         "<script src='js/lib/jquery.tablesorter.widgets.min.js'></script>\n");
SPITFOOTER();
?>
