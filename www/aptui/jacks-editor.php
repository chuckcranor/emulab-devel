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
chdir("..");
include("defs.php3");
chdir("apt");
include("quickvm_sup.php");
$page_title = "Jacks Editor";

#
# Get current user.
#
RedirectSecure();
$this_user = CheckLoginOrRedirect();

#
# Embed the Jacks topology editor in an iframe.
#
if ($embedded) {
    SPITHEADER(1);

    echo "<div id='page-body'><div class='jacks'></div>\n";

    REQUIRE_UNDERSCORE();
    REQUIRE_SUP();
    REQUIRE_JACKS_EDITOR();
    SPITREQUIRE("js/jacks-editor.js");
    SPITFOOTER();
    return;
}

?>
