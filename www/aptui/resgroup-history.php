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
# Moving to bootstrap 5 slowly. 
$BOOTSTRAP5OK = true;

chdir("..");
include("defs.php3");
include("webtask.php");
chdir("apt");
include("quickvm_sup.php");
$page_title = "Reservation Group History";

#
# Get current user.
#
RedirectSecure();
$this_user = CheckLoginOrRedirect();
$this_uid  = $this_user->uid();
$isadmin   = (ISADMIN() ? 1 : 0);

#
# Verify page arguments. 
#
$optargs = OptionalPageArguments("all",            PAGEARG_BOOLEAN,
                                 "target_user",    PAGEARG_USER,
                                 "target_project", PAGEARG_PROJECT);
if ($all) {
    if (!$isadmin && !ISFOREIGN_ADMIN()) {
        SPITUSERERROR("You do not have permission to view this information!");
        return;
    }
}
elseif (isset($target_project)) {
    $target_pid = $target_project->pid();

    if (!$isadmin && !ISFOREIGN_ADMIN() &&
        !$target_project->AccessCheck($this_user, $TB_PROJECT_READINFO)) {
        SPITUSERERROR("You do not have permission to view this information!");
        return;
    }
}
else {
    if (! isset($target_user)) {
        $target_user = $this_user;
    }
    $target_uid = $target_user->uid();

    if (!$isadmin && !ISFOREIGN_ADMIN() &&
        !$target_user->AccessCheck($this_user, $TB_USERINFO_READINFO)) {
        SPITUSERERROR("You do not have permission to view this information!");
        return;
    }
}
SPITHEADER(1);

# Place to hang the toplevel template.
echo "<div id='main-body'></div>\n";

echo "<script type='text/javascript'>\n";
echo "   window.ISADMIN  = $isadmin;\n";
if (!$all) {
    if (isset($target_project)) {
        echo "   window.PID      = '$target_pid';\n";
    }
    else {
        echo "   window.UID      = '$target_uid';\n";
    }
}
echo "</script>\n";

REQUIRE_UNDERSCORE();
REQUIRE_SUP();
REQUIRE_MOMENT();
REQUIRE_TABLESORTER();
AddTemplateList(array("resgroup-history", "resgroup-list",
                      "oops-modal", "waitwait-modal"));
SPITREQUIRE("js/resgroup-history.js");
SPITFOOTER();
?>
