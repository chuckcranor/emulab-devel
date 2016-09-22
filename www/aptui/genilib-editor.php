<?php
#
# Copyright (c) 2000-2016 University of Utah and the Flux Group.
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
include_once("profile_defs.php");
$page_title = "Genilib Editor";

#
# Get current user.
#
RedirectSecure();
$this_user = CheckLogin($check_status);
if (isset($this_user)) {
    # Allow unapproved users to edit their profile ...
    CheckLoginOrDie(CHECKLOGIN_UNAPPROVED|CHECKLOGIN_NONLOCAL);
}
else {
    CheckLoginOrRedirect();
}

#
# Verify page arguments.
#
$optargs = OptionalPageArguments("uuid",   PAGEARG_STRING,
                                 "profile",PAGEARG_STRING,
                                 "project",PAGEARG_PROJECT,
				 "version",PAGEARG_INTEGER);
$canedit = 0;
$disabled = 0;
$source = "";
$profileObject = null;
$profileWho = "private";

if (isset($uuid))  {
    $profileObject = Profile::Lookup($uuid);
}
elseif (isset($project) && isset($profile) && isset($version)) {
    $profileObject = Profile::LookupByName($project, $profile, $version);
}
elseif (isset($project) && isset($profile)) {
    $profileObject = Profile::LookupByName($project, $profile);
}

if (isset($profileObject)) {
    $source = $profileObject->script();
    $canedit      = ($profileObject->CanEdit($this_user) ? 1 : 0);
    $disabled     = ($profileObject->isDisabled() ? 1 : 0);
    if ($profileObject->shared()) {
       $profileWho = "shared";
    }
}

# We use a session. in case we need to do verification
session_start();
session_unset();

SPITHEADER(1);
echo "<script>\n";

if (isset($profileObject)) {
  echo "window.PROFILE_NAME = '" . $profileObject->name() . "';";
  echo "window.PROFILE_PROJECT = '" . $profileObject->pid() . "';";
  echo "window.PROFILE_VERSION_UUID = '" . $profileObject->uuid() . "';";
  echo "window.PROFILE_LATEST_UUID = '" . $profileObject->profile_uuid() . "';";
  echo "window.PROFILE_WHO = '" . $profileWho . "';";
}

echo "window.PROFILE_CANEDIT = $canedit;\n";
echo "window.PROFILE_DISABLED = $disabled;\n";
#echo "window.APT_OPTIONS.nopassword = $nopassword;\n";
echo "</script>\n";
echo "<link rel='stylesheet' href='css/bootstrap-formhelpers.min.css'>\n";
echo "<link rel='stylesheet' href='css/genilib-editor.css'>\n";
echo "<div id='page-body'></div>\n";
echo "<div id='oops_div'></div>\n";
echo "<div id='waitwait_div'></div>\n";

echo "<script type='text/plain' id='source'>\n";
echo base64_encode($source);
#echo htmlentities(json_encode($defaults)) . "\n";
echo "</script>\n";

# Pass project list through. Need to convert to list without groups.
# When editing, pass through a single value. The template treats a
# a single value as a read-only field.
$projlist = $this_user->ProjectAccessList($TB_PROJECT_CREATEEXPT);
$plist = array();
while (list($proj) = each($projlist)) {
  $plist[] = $proj;
}
echo "<script type='text/plain' id='projects-json'>\n";
echo htmlentities(json_encode($plist));
echo "</script>\n";


echo "<script src='js/lib/jquery-2.0.3.min.js'></script>\n";
echo "<script src='js/lib/bootstrap.js'></script>\n";
echo "<script src='https://cdn.jsdelivr.net/ace/1.2.3/noconflict/ace.js'></script>\n";
echo "<script src='https://cdn.jsdelivr.net/ace/1.2.3/noconflict/keybinding-vim.js'></script>\n";
echo "<script src='https://cdn.jsdelivr.net/ace/1.2.3/noconflict/keybinding-emacs.js'></script>\n";
echo "<script src='js/lib/require.js' data-main='js/genilib-editor'></script>";

$PORTAL_TEMPLATES = array("genilib-editor", "oops-modal", "waitwait-modal", "manage-profile");
SPITFOOTER();

?>
