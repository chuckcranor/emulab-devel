<?php
#
# Copyright (c) 2000-2017, 2019 University of Utah and the Flux Group.
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
# Do not change this without changing quickvm_sup.php
$page_title = "Powder Shutdown";

#
# Get current user.
#
RedirectSecure();
$this_user = CheckLoginOrRedirect();
$isadmin   = (ISADMIN() ? 1 : 0);

if (!$isadmin) {
    $approved = 0;
    $project = Project::Lookup("PowderStop");
    
    if (!$project ||
        !$project->IsMember($this_user, $approved) || !$approved) {
        SPITUSERERROR("You do not have permission to access this page");
    }
}
SPITHEADER(1);

echo "<link rel='stylesheet'
            href='css/tablesorter.css'>\n";

# Place to hang the toplevel template.
echo "<div id='page-body'></div>\n";

echo "<script type='text/javascript'>\n";
echo "    window.ISADMIN    = $isadmin;\n";
echo "</script>\n";

echo "<script src='js/lib/jquery-2.0.3.min.js'></script>\n";
echo "<script src='js/lib/jquery.tablesorter.min.js'></script>\n";
echo "<script src='js/lib/jquery.tablesorter.widgets.min.js'></script>\n";

REQUIRE_UNDERSCORE();
REQUIRE_SUP();
REQUIRE_MOMENT();
SPITREQUIRE("js/powder-shutdown.js");

AddTemplateList(array("powder-shutdown", "waitwait-modal", "oops-modal"));
SPITFOOTER();
?>
