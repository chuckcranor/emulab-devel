<?php
#
# Copyright (c) 2000-2022 University of Utah and the Flux Group.
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
include("webtask.php");
chdir("apt");
include("quickvm_sup.php");
$page_title = "List RF Ranges";

#
# Get current user.
#
RedirectSecure();
$this_user = CheckLoginOrRedirect();
$this_uid  = $this_user->uid();

if (!ISADMIN()) {
    SPITUSERERROR("You do not have permission to view this page");
}

SPITHEADER(1);

# Place to hang the toplevel template.
echo "<div id='main-body'></div>\n";

REQUIRE_UNDERSCORE();
REQUIRE_SUP();
REQUIRE_MOMENT();
REQUIRE_TABLESORTER(
    array("js/lib/tablesorter/widgets/widget-filter-formatter-jui.js"));
AddTemplateList(array("list-rfranges", "rfrange-history",
                      "oops-modal", "waitwait-modal"));
SPITREQUIRE("js/list-rfranges.js",
            "<script src='js/lib/jquery-ui.js'></script>");

echo "<link rel='stylesheet'
            href='css/jquery-ui.min.css'>\n";
echo "<link rel='stylesheet'
            href='css/tablesorter-filter.formatter.css'>\n";

SPITFOOTER();
?>
