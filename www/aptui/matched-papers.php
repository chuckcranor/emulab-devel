<?php
#
# Copyright (c) 2000-2021 University of Utah and the Flux Group.
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
$page_title = "Matched Papers";

#
# Get current user.
#
RedirectSecure();
$this_user = CheckLogin($check_status);
if (isset($this_user)) {
    CheckLoginOrDie(CHECKLOGIN_NONLOCAL|CHECKLOGIN_WEBONLY);
    $isadmin  = (ISADMIN() ? 1 : 0);
}
else {
    $isadmin = 0;
}

SPITHEADER(1);

echo "<script type='text/javascript'>\n";
echo "  window.ISADMIN     = $isadmin;\n";
echo "</script>\n";

# Place to hang the toplevel template.
echo "<div id='main-body'></div>\n";
# Place to hang some modals.
echo "<div id='oops_div'></div>
      <div id='waitwait_div'></div>\n";

$query_result =
    DBQueryFatal("select u.uid_idx,p.* from user_scopus_info as u ".
                 "left join scopus_paper_info as p on ".
                 "     p.scopus_id=u.latest_abstract_id ".
                 "where p.scopus_id is not null and ".
                 "      p.cites='$PORTAL_GENESIS' ".
                 "order by p.pubdate desc");
$papers = array();
while ($row = mysql_fetch_array($query_result)) {
    $abstract_id = $row["scopus_id"];

    if (!array_key_exists("$abstract_id", $papers)) {
        $papers["$abstract_id"] = array(
            "latest_abstract_id"      => $row["scopus_id"],
            "latest_abstract_pubdate" => $row["pubdate"],
            "latest_abstract_pubtype" => $row["pubtype"],
            "latest_abstract_doi"     => $row["doi"],
            "latest_abstract_url"     => $row["url"],
            "latest_abstract_pubname" => $row["pubname"],
            "latest_abstract_title"   => $row["title"],
            "latest_abstract_authors" => $row["authors"],
            "uses"    => $row["uses"],
            "authors" => array(),
        );
    }
    $paper  = $papers["$abstract_id"];
    if ($isadmin) {
        $author = User::Lookup($row["uid_idx"]);
        if ($author) {
            $authors = $paper["authors"];
            $blob = array (
                "uid_idx"  => $author->uid_idx(),
                "uid"      => $author->uid(),
                "name"     => $author->name(),
            );
            $paper["authors"][] = $blob;
        }
    }
    # PHP scoping is dumb.
    $papers["$abstract_id"] = $paper;
}
echo "<script type='text/plain' id='papers-json'>\n";
echo json_encode($papers,
                 JSON_HEX_APOS|JSON_HEX_QUOT|JSON_HEX_TAG|JSON_HEX_AMP);
echo "</script>\n";

#
# List of papers not matched to a specific user.
#
$query_result =
    DBQueryFatal("select p.* from scopus_paper_info as p ".
                 "left join user_scopus_info as u on ".
                 "   u.latest_abstract_id=p.scopus_id ".
                 "where p.cites='$PORTAL_GENESIS' and u.uid is null ".
                 "order by p.pubdate desc");

$unmatched = array();
while ($row = mysql_fetch_array($query_result)) {
    $abstract_id = $row["scopus_id"];

    if (!array_key_exists("$abstract_id", $unmatched)) {
        $unmatched["$abstract_id"] = array(
            "latest_abstract_id"      => $row["scopus_id"],
            "latest_abstract_pubdate" => $row["pubdate"],
            "latest_abstract_pubtype" => $row["pubtype"],
            "latest_abstract_doi"     => $row["doi"],
            "latest_abstract_url"     => $row["url"],
            "latest_abstract_pubname" => $row["pubname"],
            "latest_abstract_title"   => $row["title"],
            "latest_abstract_authors" => $row["authors"],
            "uses"                    => $row["uses"],
        );
    }
}
echo "<script type='text/plain' id='unmatched-json'>\n";
echo json_encode($unmatched,
                 JSON_HEX_APOS|JSON_HEX_QUOT|JSON_HEX_TAG|JSON_HEX_AMP);
echo "</script>\n";

REQUIRE_UNDERSCORE();
REQUIRE_TABLESORTER();
REQUIRE_SUP();
REQUIRE_MOMENT();
REQUIRE_TABLESORTER();
SPITREQUIRE("js/matched-papers.js");

AddTemplateList(array("matched-papers",
                      "oops-modal", "waitwait-modal"));
SPITFOOTER();
?>
