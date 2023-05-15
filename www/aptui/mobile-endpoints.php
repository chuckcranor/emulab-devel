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
chdir("apt");
include("quickvm_sup.php");
include_once("aggregate_defs.php");
$page_title = "Mobile Endpoints";

#
# Get current user.
#
RedirectSecure();
$this_user = CheckLoginOrRedirect();
$this_idx  = $this_user->uid_idx();
$this_uid  = $this_user->uid();
$isadmin   = (ISADMIN() ? 1 : 0);

#
# Verify page arguments.
#
$optargs = OptionalPageArguments("showmap", PAGEARG_BOOLEAN);
$showmap = ($showmap ? 1 : 0);

SPITHEADER(1);

# Place to hang the toplevel template.
echo "<div id='main-body'></div>\n";

# Place to hang the modals.
echo "<div id='oops_div'></div>
      <div id='waitwait_div'></div>\n";

echo "<script type='text/javascript'>\n";
echo "    window.ISADMIN     = $isadmin;\n";
echo "    window.SHOWMAP     = $showmap;\n";
echo "</script>\n";

REQUIRE_UNDERSCORE();
REQUIRE_SUP();
REQUIRE_MOMENT();
REQUIRE_TABLESORTER();
AddTemplateList(array("mobile-endpoints", "waitwait-modal", "oops-modal"));
SPITREQUIRE("js/mobile-endpoints.js");
SPITFOOTER();
?>
