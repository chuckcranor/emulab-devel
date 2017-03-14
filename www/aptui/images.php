<?php
#
# Copyright (c) 2000-2017 University of Utah and the Flux Group.
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
$page_title = "Image List";

#
# Verify page arguments.
#
$optargs = OptionalPageArguments("target_user", PAGEARG_USER,
                                 "all",         PAGEARG_BOOLEAN);

#
# Get current user.
#
RedirectSecure();
$this_user = CheckLoginOrRedirect();
# Ignore all flag if not an admin
if (!ISADMIN()) {
    $all = 0;
}
elseif (!isset($all)) {
    $all = 0;
}

if (!isset($target_user)) {
    $target_user = $this_user;
}
if (!$this_user->SameUser($target_user)) {
    if (!ISADMIN()) {
	SPITUSERERROR("You do not have permission to view ".
		      "target user's images");
	exit();
    }
    # Do not show admin access images if targeting a different user.
    $all = 0;
}
$target_idx = $target_user->uid_idx();
$projlist   = $target_user->ProjectAccessList($TB_PROJECT_CREATEEXPT);

SPITHEADER(1);

echo "<link rel='stylesheet'
            href='css/tablesorter-blue.css'>\n";

# Place to hang the toplevel template.
echo "<div id='main-body'></div>\n";

if (ISADMIN() && $all) {
    $joinclause  = "";
    $whereclause = "";
}
else {
    #
    # User is allowed to view the list of all global images, and all images
    # in his project. Include images in the subgroups too, since its okay
    # for the all project members to see the descriptors. They need proper 
    # permission to use/modify the image/descriptor of course, but that is
    # checked in the pages that do that stuff. In other words, ignore the
    # shared flag in the descriptors.
    #
    $uid_idx = $target_user->uid_idx();

    $joinclause =     
	"left join image_permissions as p1 on ".
	"     p1.imageid=i.imageid and p1.permission_type='group' ".
	"left join image_permissions as p2 on ".
	"     p2.imageid=i.imageid and p2.permission_type='user' and ".
	"     p2.permission_idx='$uid_idx' ".
	"left join group_membership as g on ".
	"     g.uid_idx='$uid_idx' and  ".
	"     (g.pid_idx=i.pid_idx or ".
        "      g.gid_idx=p1.permission_idx) ";
    
    $whereclause = "and (iv.global or p2.imageid is not null or ".
                 "g.uid_idx is not null) ";
}
$query =
    "select distinct iv.*,ov.* from images as i ".
    "left join image_versions as iv on ".
    "          iv.imageid=i.imageid and iv.version=i.version ".
    "left join os_info_versions as ov on ".
    "          i.imageid=ov.osid and ov.vers=i.version ".
    "left join osidtoimageid as map on map.osid=i.imageid ".
    $joinclause .
    "where (iv.ezid = 1 or iv.isdataset = 1) $whereclause ".
    "order by i.imagename";

$query_result = DBQueryFatal($query);

$images = array();
$domain = $OURDOMAIN;
if ($TBMAINSITE)
{
  $domain = "emulab.net";
}

while ($row = mysql_fetch_array($query_result)) {
	$imageid = $row["imageid"];
        $name    = $row["imagename"];
        $pid     = $row["pid"];
        $urn     = "urn:publicid:IDN+${domain}+image+${pid}//${name}";
        $blob    = array();

        #
        # This is for the hidden search filter column. It indicates how 
        # the user has access to the image. Creator, project, public.
        #
        $filters = array();
        if ($row["creator_idx"] == $target_user->uid_idx()) {
            $filters[] = "creator";
        }
        if (array_key_exists($pid, $projlist)) {
            $filters[] = "project";
        }
        if ($pid == "emulab-ops") {
            $filters[] = "system";
        }
        if ($row["global"] != "0") {
            $filters[] = "public";
        }
        # If none of the filters match, then mark as admin so we can show
        # those under a separate checkbox.
        if (!count($filters)) {
            $filters[] = "admin";
        }
        
        $blob["imageid"]     = $imageid;
        $blob["description"] = $row["description"];
        $blob["imagename"]   = $row["imagename"];
        $blob["created"]     = DateStringGMT($row["created"]);
        $blob["pid"]         = $row["pid"];
        $blob["pid_idx"]     = $row["pid_idx"];
        $blob["global"]      = $row["global"];
        $blob["creator"]     = $row["creator"];
        $blob["creator_idx"] = $row["creator_idx"];
        $blob["urn"]         = $urn;
        $blob["filter"]      = implode(",", $filters);
	$blob["url"]         = $TBBASE . "/" .
                             CreateURL("showimageid",
                                       URLARG_IMAGEID, $imageid);

        $images[] = $blob;
}
echo "<script type='text/plain' id='images-json'>\n";
echo htmlentities(json_encode($images)) . "\n";
echo "</script>\n";

echo "<script type='text/javascript'>\n";
$isadmin = (isset($this_user) && ISADMIN() ? 1 : 0);
echo "    window.ISADMIN    = $isadmin;\n";
echo "    window.ALL        = $all;\n";
echo "</script>\n";
echo "<script src='js/lib/jquery-2.0.3.min.js'></script>\n";
echo "<script src='js/lib/jquery.tablesorter.min.js'></script>\n";
echo "<script src='js/lib/jquery.tablesorter.widgets.min.js'></script>\n";

REQUIRE_UNDERSCORE();
REQUIRE_SUP();
REQUIRE_MOMENT();
SPITREQUIRE("js/images.js");

AddTemplate("images");
SPITFOOTER();
?>
