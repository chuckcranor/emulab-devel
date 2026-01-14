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
$page_title = "Login";
AddTemplate("waitwait-modal");

#
# Get current user in case we need an error message.
#
$this_user = CheckLogin($check_status);
if ($this_user) {
    if (($check_status & CHECKLOGIN_MAYBEVALID) == CHECKLOGIN_MAYBEVALID) {
        $this_user = null;
    }
}

#
# Verify page arguments.
#
$optargs = OptionalPageArguments("adminmode",   PAGEARG_BOOLEAN,
                                 "cleanmode",   PAGEARG_BOOLEAN,
                                 # ZMS SSO
                                 "client_id",   PAGEARG_STRING,
                                 "redirect_uri",PAGEARG_STRING,
                                 "scope",       PAGEARG_STRING);
$referrer = null;
if (GetReferrer($referrer) != 0) {
    PAGEARGERROR("Invalid REFERRER");        
}
if ($referrer) {
    #error_log("login: " . $referrer);
}

# For devel tree debugging.
$debug = 0;

if (!$debug) {
    if (isset($client_id) && isset($redirect_uri)) {
        if ($client_id != $SSO_CLIENT_ID ||
            $redirect_uri != $SSO_REDIRECT_URI) {
            PAGEARGERROR("Invalid AUTH0 arguments");        
        }
    }
}

# Allow adminmode to be passed along to new login. Handy for letting admins
# log in when NOLOGINS() is on.
if (!isset($adminmode)) {
    $adminmode = 0;
}
else {
    $adminmode = 1;
}
# For Rob to make screen shots. We do not want to use the cookie here,
# just the url argument.
if (isset($_GET['cleanmode']) && $_GET['cleanmode']) {
    $cleanmode = 1;
}
else {
    $cleanmode = 0;
}

#
# Logged in user goes to the landing page unless its an SSO login
# since we want to give the user a chance to switch accounts.
#
if (0 && $this_user) {
    if (! (isset($client_id) && isset($redirect_uri))) {
	header("Location: $APTBASE/landing.php");
        ClearReferrer();
	return;
    }
}

if (NOLOGINS() && !$adminmode) {
    if ($ajax_request) {
	SPITAJAX_ERROR(1, "logins are temporarily disabled");
	exit();
    }
    SPITHEADER();
    SPITUSERERROR("Sorry, logins are temporarily disabled, ".
		  "please try again later.");
    echo "<script src='js/lib/jquery-2.0.3.min.js'></script>\n";
    SPITNULLREQUIRE();
    SPITFOOTER();
    return;
}
SPITHEADER(1);

# Place to hang the toplevel template.
echo "<div id='main-body'></div>\n";

echo "<script type='text/javascript'>\n";
echo "    window.PROTOGENI_GENIWEBLOGIN = $PROTOGENI_GENIWEBLOGIN;\n";
echo "    window.UI_EXTERNAL_ACCOUNTS  = $UI_EXTERNAL_ACCOUNTS;\n";
echo "    window.PORTAL_PASSWORD_HELP = '$PORTAL_PASSWORD_HELP';\n";
echo "    window.CLEANMODE = $cleanmode;\n";
echo "    window.ADMINMODE = $adminmode;\n";
if ($this_user) {
    $this_uid = $this_user->uid();
        
    echo "    window.CURRENT_UID = '$this_uid';\n";
}
if (isset($redirect_uri) && isset($client_id)) {
    echo "    window.REDIRECT_URI = '$redirect_uri';\n";
    echo "    window.CLIENT_ID = '$client_id';\n";
}
echo "</script>\n";

AddTemplate("login");
AddTemplate("nomore-genilogin-modal");
REQUIRE_UNDERSCORE();
REQUIRE_SUP();
REQUIRE_APTFORMS();
SPITREQUIRE("js/login.js");
SPITFOOTER();
?>
