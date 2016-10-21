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
include_once("webtask.php");
chdir("apt");
include("quickvm_sup.php");
include_once("profile_defs.php");
include_once("instance_defs.php");
$page_title = "Show Profile";

#
# Get current user.
#
RedirectSecure();
$this_user = CheckLoginOrRedirect(CHECKLOGIN_WEBONLY);
$this_idx  = $this_user->uid_idx();
$isadmin   = (ISADMIN() ? 1 : 0);

#
# Verify page arguments.
#
$optargs = OptionalPageArguments("uuid",   PAGEARG_STRING,
                                 "profile",PAGEARG_STRING,
                                 "project",PAGEARG_PROJECT,
                                 "source", PAGEARG_BOOLEAN,
                                 "rspec",  PAGEARG_BOOLEAN);
if (isset($uuid))  {
    $profile = Profile::Lookup($uuid);
}
elseif (isset($project) && isset($profile)) {
    $profile = Profile::LookupByName($project, $profile);
}    
else {
    SPITUSERERROR("Must provide a uuid or project/profile name!");
}
if (!$profile) {
    SPITUSERERROR("No such profile!");
}
if (!$profile->CanView($this_user) && !(ISADMIN() || ISFOREIGN_ADMIN())) {
    SPITUSERERROR("Not enough permission!");
}
# For the download source button.
if ($source || $rspec) {
    $filename = $profile->name() . ".xml";
    $stuff    = $profile->rspec();

    if ($source && $profile->script() && $profile->script() != "") {
        $stuff = $profile->script();
        $filename = $profile->name() . ".py";
    }
    header("Content-Type: text/plain");
    header("Content-Disposition: attachment; filename='${filename}'");
    echo $stuff;
    return;
}
SPITHEADER(1);
echo "<div id='ppviewmodal_div'></div>\n";

$profile_uuid = $profile->profile_uuid();
$version_uuid = $profile->uuid();
$ispp         = ($profile->isParameterized() ? 1 : 0);
$history      = ($profile->HasHistory() ? 1 : 0);
$canedit      = ($profile->CanEdit($this_user) ? 1 : 0);
$disabled     = ($profile->isDisabled() ? 1 : 0);

$defaults = array();
$defaults["profile_name"]        = $profile->name();
$defaults["profile_rspec"]       = $profile->rspec();
$defaults["profile_version"]     = $profile->version();
$defaults["profile_creator"]     = $profile->creator();
$defaults["profile_pid"]         = $profile->pid();
$defaults["profile_created"]     = DateStringGMT($profile->created());
$defaults["profile_published"]   = DateStringGMT($profile->published());
$defaults["profile_version_url"] = $profile->URL();
$defaults["profile_profile_url"] = $profile->ProfileURL();
if ($profile->script() && $profile->script() != "") {
    $defaults["profile_script"] = $profile->script();
}

# Place to hang the toplevel template.
echo "<div id='page-body'></div>\n";

echo "<link rel='stylesheet'
            href='css/jquery-ui-1.10.4.custom.min.css'>\n";
echo "<link rel='stylesheet' href='css/codemirror.css'>\n";

# I think this will take care of XSS prevention?
echo "<script type='text/plain' id='form-json'>\n";
echo htmlentities(json_encode($defaults)) . "\n";
echo "</script>\n";

$am_array = Instance::DefaultAggregateList();
$amlist   = array();
$amdefault = "";
if (($ISCLOUD || ISADMIN() || STUDLY())) {
    while (list($am) = each($am_array)) {
	$amlist[] = $am;
    }
    $amdefault = $DEFAULT_AGGREGATE;
    # Temporary override until constraint system in place.
    if ($profile->BestAggregate()) {
	$amdefault = $profile->BestAggregate();
    }
}
echo "<script type='text/plain' id='amlist-json'>\n";
echo htmlentities(json_encode($amlist));
echo "</script>\n";

echo "<script type='text/javascript'>\n";
echo "    window.PROFILE_UUID = '$profile_uuid';\n";
echo "    window.VERSION_UUID = '$version_uuid';\n";
echo "    window.AJAXURL      = 'server-ajax.php';\n";
echo "    window.ISADMIN      = $isadmin;\n";
echo "    window.CANEDIT      = $canedit;\n";
echo "    window.DISABLED     = $disabled;\n";
echo "    window.HISTORY      = $history;\n";
echo "    window.ISPPPROFILE  = $ispp;\n";
echo "    window.WITHPUBLISHING = $WITHPUBLISHING;\n";
echo "</script>\n";

echo "<script src='js/lib/codemirror-min.js'></script>\n";

REQUIRE_UNDERSCORE();
REQUIRE_SUP();
REQUIRE_MOMENT();
REQUIRE_MARKED();
SPITREQUIRE("js/show-profile.js",
            "<script src='js/lib/jquery-ui.js'></script>\n".
            "<script src='js/lib/jquery.appendGrid-1.3.1.min.js'></script>");

AddTemplateList(array("show-profile", "waitwait-modal", "renderer-modal", "showtopo-modal", "rspectextview-modal", "guest-instantiate", "instantiate-modal", "oops-modal", "share-modal"));
SPITFOOTER();

?>
