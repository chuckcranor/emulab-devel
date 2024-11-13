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
$BOOTSTRAP5ONLY = true;

chdir("..");
include("defs.php3");
include_once("geni_defs.php");
chdir("apt");
include("quickvm_sup.php");
include_once("instance_defs.php");
$page_title = "Summary Stats";

#
# Verify page arguments.
#
$optargs = OptionalPageArguments("showby",   PAGEARG_STRING,
                                 "min",      PAGEARG_INTEGER,
                                 "max",      PAGEARG_INTEGER);

#
# Get current user.
#
RedirectSecure();
$this_user = CheckLoginOrRedirect();
SPITHEADER(1);

if (! (ISADMIN() || ISFOREIGN_ADMIN())) {
    SPITUSERERROR("You do not have permission to view summary stats");
}

if (!isset($showby) || $showby == "user" || $showby == "creator") {
    $showby = "creator";
}
elseif ($showby == "project" || $showby == "pid") {
    $showby = "pid";
}
else {
    SPITUSERERROR("Bad showby argument");
}

# Place to hang the toplevel template.
echo "<div id='page-body'>
        <div id='sumstats-body'></div>
        <div id='waitwait_div'></div>
        <div id='oops_div'></div>
      </div>\n";

echo "<script type='text/javascript'>\n";
if (isset($min)) {
    echo "    window.MIN  = $min;\n";
}
else {
    echo "    window.MIN  = null;\n";
}
if (isset($max)) {
    echo "    window.MAX  = $max;\n";
}
else {
    echo "    window.MAX  = null;\n";
}
echo "    window.SHOWBY  =  '$showby';\n";
echo "</script>\n";

REQUIRE_SUP();
REQUIRE_MOMENT();
REQUIRE_JQUERY_UI();
REQUIRE_TABLESORTER(array('js/lib/tablesorter/widgets/widget-output.js'));
AddTemplateList(array("sumstats", "sumstats-table", "output-dropdown",
                      "waitwait-modal", "oops-modal"));
SPITREQUIRE("js/sumstats.js");
SPITFOOTER();
?>
