<?php
#
# Copyright (c) 2000-2019 University of Utah and the Flux Group.
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
include_once("osinfo_defs.php");
include_once("geni_defs.php");
include_once("webtask.php");
chdir("apt");
include("quickvm_sup.php");
include_once("instance_defs.php");
include_once("profile_defs.php");
# Must be after quickvm_sup.php since it changes the auth domain.
include_once("../session.php");
$page_title = "Instantiate a Profile";
$dblink = GetDBLink("sa");

#
# Get current user but make sure coming in on SSL. Guest users allowed
# via APT Portal.
#
RedirectSecure();
$this_user = CheckLogin($check_status);
if (isset($this_user)) {
    CheckLoginOrDie(CHECKLOGIN_NONLOCAL|CHECKLOGIN_WEBONLY);
    if (NOPROJECTMEMBERSHIP()) {
        return NoProjectMembershipError($this_user);
    }
}
else {
    RedirectLoginPage();
}

#
# Verify page arguments.
#
$optargs = OptionalPageArguments("create",        PAGEARG_STRING,
				 "profile",       PAGEARG_STRING,
				 "version",       PAGEARG_INTEGER,
				 "project",       PAGEARG_PROJECT,
				 "default",       PAGEARG_STRING,
				 "from",          PAGEARG_STRING,
				 "refspec",       PAGEARG_STRING,
				 "formfields",    PAGEARG_ARRAY);

# Need to make non-hardcoded
$maxduration = 16;

$skipfirststep = 0;
if (isset($from) && ($from == "manage-profile" || $from == "show-profile")) {
    $skipfirststep = 1;
}

if ($this_user) {
    $projlist = $this_user->ProjectAccessList($TB_PROJECT_CREATEEXPT);
    #
    # Cull out the nonlocal projects, we do not want to show those
    # since they are just the holding projects.
    #
    $tmp = array();
    while (list($pid) = each($projlist)) {
        # Watch out for killing page variable called "project"
        $proj = Project::Lookup($pid);
        if ($proj && !$proj->IsNonLocal()) {
            $tmp[$pid] = $projlist[$pid];
        }
    }
    $projlist = $tmp;
    
    if (count($projlist) == 0) {
	SPITUSERERROR("You do not belong to any projects with permission to ".
                      "create new experiments. Please contact your project ".
                      "leader to grant you the neccessary privilege.");
	exit();
    }
}
if ($ISCLOUD) {
    $portal_default_profile = TBGetSiteVar("cloudlab/default_profile");
    list ($profile_default_pid,
          $profile_default) = explode(',', $portal_default_profile);
}
elseif ($ISPNET) {
    $portal_default_profile = TBGetSiteVar("phantomnet/default_profile");
    list ($profile_default_pid,
          $profile_default) = explode(',', $portal_default_profile);
}
elseif ($ISPOWDER) {
    $portal_default_profile = "PhantomNet,OAI-Real-Hardware";
    list ($profile_default_pid,
          $profile_default) = explode(',', $portal_default_profile);
}
else {
    $portal_default_profile = TBGetSiteVar("portal/default_profile");
    list ($profile_default_pid,
          $profile_default) = explode(',', $portal_default_profile);
}
$profile_array  = array();
$usageinfo      = UserUsageInfo($this_user);

#
# if using the super secret URL, make sure the profile exists, and
# add to the array now since it might not be public or belong to the user.
#
if (isset($profile)) {
    #
    # Guest users must use the uuid, but logged in users may use the
    # internal index. But, we have to support simple the URL too, which
    # is /p/project/profilename, but only for public profiles.
    #
    if (isset($project) && isset($profile)) {
	$obj = Profile::LookupByName($project, $profile, $version);
    }
    elseif ($this_user || IsValidUUID($profile)) {
	$obj = Profile::Lookup($profile);
    }
    else {
	SPITUSERERROR("Illegal profile for guest user: $profile");
	exit();
    }
    if (! $obj || $obj->deleted()) {
	SPITUSERERROR("No such profile: $profile");
	exit();
    }
    if (IsValidUUID($profile)) {
	#
	# If uuid was to profile, then find the most recently published
	# version and instantiate that, since what we have is the most
	# recent version, but might not be published.
	#
	if (0 && $profile == $obj->profile_uuid() && !$obj->published()) {
	    $obj = $obj->LookupMostRecentPublished();
	    if (! $obj) {
		SPITUSERERROR("No published version for profile");
		exit();
	    }
	}
        $profile = $obj;
	$profile_array[$profile->uuid()] =
            array("name"      => $profile->name(),
                  "profileid" => $profile->profileid(),
                  "project"   => $profile->pid(),
                  "pid"       => $profile->pid(), # JS messes with project.
                  "creator"   => $profile->creator(),
                  "usecount"  => $profile->usecount(),
                  "favorite"  => $profile->isFavorite($this_user));
	$profilename = $profile->name();
    }
    else {
	#
	# If no version provided, then find the most recently published
	# version and instantiate that, since what we have is the most
	# recent version, but might not be published.
	#
	if (0 && !isset($version) && !$obj->published()) {
	    $obj = $obj->LookupMostRecentPublished();
	    if (! $obj) {
		SPITUSERERROR("No published version for profile");
		exit();
	    }
	}
	 
	#
	# Must be public or pass the permission test for the user.
	#
	if (! ($obj->ispublic() ||
	       (isset($this_user) && $obj->CanInstantiate($this_user)))) {
	    SPITUSERERROR("No permission to use profile: $profile");
	    exit();
	}
	$profile = $obj;
	$profile_array[$profile->uuid()] = 
            array("name"      => $profile->name(),
                  "profileid" => $profile->profileid(),
                  "project"   => $profile->pid(),
                  "pid"       => $profile->pid(), # JS messes with project.
                  "creator"   => $profile->creator(),
                  "usecount"  => $profile->usecount(),
                  "favorite"  => $profile->isFavorite($this_user));
	$profilename = $profile->name();
    }
    if ($profile->isDisabled()) {
        SPITUSERERROR("This profile is disabled!");
        exit();
    }
}
else {
    #
    # Find all the public and user profiles. We use the UUID instead of
    # indicies cause we do not want to leak internal DB state to guest
    # users. Need to decide on what clause to use, depending on whether
    # a guest user or not.
    #
    $joinclause   = "";
    $whereclause  = "";
    if (!isset($this_user)) {
	$whereclause = "p.public=1";
    }
    else {
	$this_idx = $this_user->uid_idx();
	$joinclause =
	    "left join group_membership as g on ".
	    "     g.uid_idx='$this_idx' and ".
	    "     g.pid_idx=v.pid_idx and g.pid_idx=g.gid_idx ".
            "left join apt_profile_favorites as f on ".
            "     f.profileid=p.profileid and f.uid_idx='$this_idx'";
                    
	$whereclause =
	    "p.public=1 or p.shared=1 or v.creator_idx='$this_idx' or ".
	    "g.uid_idx is not null ";
    }

    $query_result =
	DBQueryFatal("select p.uuid,p.name,p.pid,v.creator,p.profileid, ".
                     "     p.usecount,f.marked ".
                     "   from apt_profiles as p ".
		     "left join apt_profile_versions as v on ".
		     "     v.profileid=p.profileid and ".
		     "     v.version=p.version ".
		     "$joinclause ".
		     "where locked is null and p.disabled=0 and ".
                     "      v.disabled=0 and ($whereclause) ");
    while ($row = mysql_fetch_array($query_result)) {
	$profile_array[$row["uuid"]] =
            array("name"      => $row["name"],
                  "profileid" => $row["profileid"],
                  "project"   => $row["pid"],
                  "pid"       => $row["pid"],
                  "creator"   => $row["creator"],
                  "usecount"  => $row["usecount"],
                  "favorite"  => $row["marked"] ? 1 : 0);
        if ($row["pid"] == $profile_default_pid &&
            $row["name"] == $profile_default) {
	    $profile_default = $row["uuid"];
	}
    }
    #
    # A specific profile, but we still want to give the user the selection
    # list above, but the profile might not be in the list if it is not
    # the highest numbered version.
    #
    if (isset($default)) {
        if (IsValidUUID($default)) {
            $obj = Profile::Lookup($default);
            if (!$obj) {
                SPITUSERERROR("Unknown default profile: $default");
                exit();
            }
            if (! ($obj->ispublic() ||
                   (isset($this_user) && $obj->CanInstantiate($this_user)))) {
                SPITUSERERROR("No permission to use profile: $default");
                exit();
            }
            if ($obj->isDisabled()) {
                SPITUSERERROR("This profile is disabled!");
                exit();
            }
            #
            # See if we have the version or profile uuid in the list
            # already, do not add twice since we do not show versions
            # in the picker list.
            #
            if (array_key_exists($obj->profile_uuid(), $profile_array)) {
                unset($profile_array[$obj->profile_uuid()]);
            }
            $profile_array[$obj->uuid()] = $obj->name();
                    array("name"      => $obj->name(),
                          "profileid" => $obj->profileid(),
                          "project"   => $obj->pid(),
                          "pid"       => $obj->pid(),
                          "creator"   => $obj->creator(),
                          "usecount"  => $obj->usecount(),
                          "favorite"  => $obj->isFavorite($this_user));
            $profile_default = $obj->uuid();
        }
        else {
            SPITUSERERROR("Illegal default profile: $default");
            exit();
        }
    }
}

#
# Update the array with extra info for the profile picker.
#
foreach ($profile_array as $uuid => &$details) {
    $profileid = $details["profileid"];
    $usecount  = $details["usecount"];
    $lastused  = 0;
    
    # If profile never used, no need to check if user has used it.
    if ($usecount) {
        if (array_key_exists($profileid, $usageinfo)) {
            $usecount = $usageinfo[$profileid]["count"];
            $lastused = $usageinfo[$profileid]["lastused"];
        }
    }
    $details["usecount"] = $usecount;
    $details["lastused"] = $lastused;
}
reset($profile_array);

function SPITFORM($formfields, $newuser, $errors)
{
    global $TBBASE, $APTMAIL, $ISAPT, $ISCLOUD, $ISPNET, $PORTAL_NAME;
    global $profile_array, $this_user, $profilename, $profile;
    global $projlist, $skipfirststep, $maxduration, $TBMAINSITE;
    global $refspec, $ISPOWDER;
    
    $showabout  = ($ISAPT && !$this_user ? 1 : 0);
    $registered = (isset($this_user) ? "true" : "false");
    # We use webonly to mark users that have no project membership
    # at the Geni portal.
    $webonly    = (isset($this_user) &&
                   $this_user->webonly() ? "true" : "false");
    $cancopy    = (isset($this_user) && !$this_user->webonly() ? 1 : 0);
    $nopprspec  = (!isset($this_user) ? "true" : "false");
    $portal     = "";
    $showpicker = (isset($profile) ? 0 : 1);
    if (isset($profilename)) {
        $profilename = "'$profilename'";
        $profilevers = $profile->version();
    }
    else {
        $profilename = "null";
        $profilevers = "null";
    }
    SPITHEADER(1);

    echo "<link rel='stylesheet' href='css/jquery-ui.min.css'>\n";
    echo "<link rel='stylesheet' href='css/picker.css'>\n";
    echo "<link rel='stylesheet' href='css/nv.d3.css'>\n";

    # I think this will take care of XSS prevention?
    echo "<script type='text/plain' id='form-json'>\n";
    echo htmlentities(json_encode($formfields)) . "\n";
    echo "</script>\n";
    echo "<script type='text/plain' id='error-json'>\n";
    echo htmlentities(json_encode($errors));
    echo "</script>\n";
    echo "<script type='text/plain' id='profiles-json'>\n";
    echo htmlentities(json_encode($profile_array));
    echo "</script>\n";
    
    # Gack.
    if (isset($this_user) && $this_user->IsNonLocal()) {
        if (preg_match("/^[^+]*\+([^+]+)\+([^+]+)\+(.+)$/",
                       $this_user->nonlocal_id(), $matches) &&
            $matches[1] == "ch.geni.net") {
            $portal = "https://portal.geni.net/";
        }
    }

    # Place to hang the toplevel template.
    echo "<div id='main-body'></div>\n";

    #
    # Spit out a project selection list if a real user.
    #
    if ($this_user && !$this_user->webonly()) {
        echo "<script type='text/plain' id='projects-json'>\n";
        echo htmlentities(json_encode($projlist));
        echo "</script>\n";
    }
    SpitAggregateStatus(true);

    SpitOopsModal("oops");
    echo "<script type='text/javascript'>\n";
    echo "    window.PROFILE    = '" . $formfields["profile"] . "';\n";
    echo "    window.PROFILENAME= $profilename;\n";
    echo "    window.PROFILEVERS= $profilevers;\n";
    echo "    window.AJAXURL    = 'server-ajax.php';\n";
    echo "    window.SHOWABOUT  = $showabout;\n";
    echo "    window.NOPPRSPEC  = $nopprspec;\n";
    echo "    window.REGISTERED = $registered;\n";
    echo "    window.WEBONLY    = $webonly;\n";
    echo "    window.PORTAL     = '$portal';\n";
    echo "    window.SHOWPICKER = $showpicker;\n";
    echo "    window.MAXDURATION = $maxduration;\n";
    echo "    window.CANCOPY = $cancopy;\n";
    $isadmin = (isset($this_user) && ISADMIN() ? 1 : 0);
    echo "    window.ISADMIN    = $isadmin;\n";
    $isstud = (isset($this_user) && STUDLY() ? 1 : 0);
    echo "    window.ISSTUD    = $isstud;\n";
    $multisite = (isset($this_user) && $ISCLOUD ? 1 : 0);
    echo "    window.MULTISITE  = $multisite;\n";
    $doconstraints = $TBMAINSITE;
    echo "    window.DOCONSTRAINTS = $doconstraints;\n";
    echo "    window.SKIPFIRSTSTEP = " . ($skipfirststep ? "true" : "false") . ";\n";
    echo "    window.PORTAL_NAME = '$PORTAL_NAME';\n";
    echo "    window.USERNAME = '" . $formfields["username"] . "';\n";
    if (isset($profile) && $profile->repourl()) {
        echo "    window.FROMREPO = true;\n";
        if (isset($refspec)) {
            echo "    window.REFSPEC = '$refspec';\n";
        }
    }
    else {
        echo "    window.FROMREPO = false;\n";
    }
    # Do we show an aggregate selector?
    if (isset($this_user) && !$this_user->webonly()
        && !$ISAPT && !$ISPNET && !$ISPOWDER) {
        echo "    window.CLUSTERSELECT = true;\n";
    }
    else {
        echo "    window.CLUSTERSELECT = false;\n";
    }
    echo "</script>\n";
    echo "<script src='js/lib/d3.v3.js'></script>\n";
    echo "<script src='js/lib/nv.d3.js'></script>\n";
    echo "<script src='js/lib/jquery-2.0.3.min.js'></script>\n";
    echo "<script src='js/lib/jquery-ui.js'></script>\n";
   
    REQUIRE_UNDERSCORE();
    REQUIRE_SUP();
    REQUIRE_PPWIZARDSTART();
    REQUIRE_JACKS_EDITOR();
    REQUIRE_WIZARD_TEMPLATE();
    REQUIRE_PICKER();
    REQUIRE_FORMHELPERS();
    REQUIRE_FILESTYLE();
    REQUIRE_MARKED();
    REQUIRE_MOMENT();
    REQUIRE_JACKSMOD();
    REQUIRE_JACKS();
    REQUIRE_JQUERY_STEPS();
    AddLibrary("js/resgraphs.js");
    AddLibrary("js/gitrepo.js");
    SPITREQUIRE("js/instantiate-new.js");
}

if (!isset($create)) {
    $defaults = array();
    $defaults["username"] = "";
    $defaults["email"]    = "";
    $defaults["sshkey"]   = "";
    $defaults["profile"]  = (isset($profile) ?
                             $profile->uuid() : $profile_default);
    $defaults["where"]    = $DEFAULT_AGGREGATE;
    #
    # If the user is in the same project as the profile, default to that
    # project, else use the first in the list (which is ordered by last
    # time the user instantiated in it).
    #
    if ($this_user && count($projlist)) {
        if (isset($profile) &&
            array_key_exists($profile->pid(), $projlist)) {
            $project = $profile->pid();
        }
        else {
            list($project, $grouplist) = each($projlist);
            reset($projlist);
        }
        $defaults["pid"] = $project;
        $defaults["gid"] = $project;
    }
    else {
        $defaults["pid"] = "";
        $defaults["gid"] = "";
    }

    # 
    # Look for current user or cookie that tells us who the user is. 
    #
    if ($this_user) {
	$defaults["username"] = $this_user->uid();
	$defaults["email"]    = $this_user->email();
	#
	# Look for an key marked as an APT uploaded key and use that.
	# If no APT key, use any uploaded key; if the user leaves this
	# key in the form, it will become the official APT key.
	#
	$sshkey = $this_user->GetAPTSSHKey();
	if (!$sshkey) {
	    $sshkeys = $this_user->GetSSHKeys();
	    if (count($sshkeys)) {
		$sshkey = $sshkeys[0];
	    }
	}
	if ($sshkey) {
	    $defaults["sshkey"] = $sshkey;
	}
    }
    elseif (isset($_COOKIE['quickvm_user'])) {
	$geniuser = GeniUser::Lookup("sa", $_COOKIE['quickvm_user']);
	if ($geniuser) {
	    #
	    # Look for existing quickvm. User not allowed to create
	    # another one.
	    #
	    $instance = Instance::LookupByCreator($geniuser->uuid());
	    if ($instance && $instance->status() != "terminating") {
		header("Location: status.php?oneonly=1&uuid=" .
		       $instance->uuid());
		return;
	    }
            #
            # Watch for too many instances by guest user and redirect
            # to the signup page.
            #
            if (Instance::GuestInstanceCount($geniuser) > $MAXGUESTINSTANCES) {
		header("Location: signup.php?toomany=1");
		return;
            }
	    $defaults["username"] = $geniuser->name();
	    $defaults["email"]    = $geniuser->email();
	    $defaults["sshkey"]   = $geniuser->SSHKey();
	}
    }
    # We use a session, in case we need to do verification or other things.
    session_start();
    session_unset();

    SPITFORM($defaults, false, array());
    echo "<div style='display: none'><div id='jacks-dummy'></div></div>\n";

    AddTemplateList(array("instantiate-new",
                          "aboutapt", "aboutcloudlab", "aboutpnet",
                          "waitwait-modal", "rspectextview-modal",
                          "picker-template","reservation-graph"));
    SPITFOOTER();
    return;
}
?>
