<?php
#
# Copyright (c) 2000-2025 University of Utah and the Flux Group.
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
include_once("instance_defs.php");
include_once("aggregate_defs.php");
$page_title = "Import Cloud Image";

#
# Get current user.
#
RedirectSecure();
$this_user = CheckLoginOrRedirect();
if (NOPROJECTMEMBERSHIP()) {
    return NoProjectMembershipError($this_user);
}
SPITHEADER(1);

# Place to hang the toplevel template.
echo "<div id='main-body'></div>\n";

#
# See what projects the user can do this in.
#
$projlist = $this_user->ProjectAccessList($TB_PROJECT_MAKEIMAGEID);

#
# Pass project list through. Need to convert to list without groups.
# When editing, pass through a single value. The template treats a
# a single value as a read-only field.
#
$plist = array();
foreach ($projlist as $p => $unused) {
    $plist[] = $p;
}
if (ISADMIN() && isset($project)) {
    $plist[] = $project->pid();
}
echo "<script type='text/plain' id='projects-json'>\n";
echo htmlentities(json_encode($plist), ENT_COMPAT);
echo "</script>\n";

REQUIRE_UNDERSCORE();
REQUIRE_SUP();
REQUIRE_MOMENT();
REQUIRE_APTFORMS();
AddTemplateList(array("importclimage",
                      "oops-modal", "waitwait-modal", "confirm-modal"));
SPITREQUIRE("js/importclimage.js");
SPITFOOTER();
?>
