<?php
#
# Copyright (c) 2000-2017 University of Utah and the Flux Group.
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
# Must be after quickvm_sup.php since it changes the auth domain.
include_once("../session.php");
$page_title = "Manage Profile";
$notifyupdate = 0;
$notifyclone = 0;

#
# Get current user.
#
RedirectSecure();
$this_user = CheckLoginOrRedirect();
$this_idx  = $this_user->uid_idx();

#
# Verify page arguments.
#
$optargs = OptionalPageArguments("create",      PAGEARG_STRING,
				 "action",      PAGEARG_STRING,
				 "uuid",        PAGEARG_STRING,
                                 "fromexp",      PAGEARG_STRING,
				 "copyuuid",    PAGEARG_STRING,
				 "snapuuid",    PAGEARG_STRING,
				 "finished",    PAGEARG_BOOLEAN,
				 "formfields",  PAGEARG_ARRAY);

#
# Spit the form
#
function SPITFORM($formfields, $errors)
{
    global $this_user, $projlist, $action, $profile, $DEFAULT_AGGREGATE;
    global $notifyupdate, $notifyclone, $copyuuid, $snapuuid, $am_array;
    global $ISCLOUD, $fromexp;
    global $version_array, $WITHPUBLISHING;
    $viewing    = 0;
    $candelete  = 0;
    $canmodify  = 0;
    $canpublish = 0;
    $history    = 0;
    $activity   = 0;
    $ispp       = 0;
    $isadmin    = (ISADMIN() ? 1 : 0);
    $canrepo    = (ISADMIN() || STUDLY() ? 1 : 0);
    $multisite  = 1;
    $cloning    = 0;
    $disabled   = 0;
    $version_uuid = "null";
    $profile_uuid = "null";
    $latest_uuid    = "null";
    $latest_version = "null";

    if ($action == "edit") {
	$button_label = "Save";
	$viewing      = 1;
	$version_uuid = "'" . $profile->uuid() . "'";
	$profile_uuid = "'" . $profile->profile_uuid() . "'";
	$candelete    = ($profile->CanDelete($this_user) ? 1 : 0);
	$history      = ($profile->HasHistory() ? 1 : 0);
	$canmodify    = ($profile->CanModify() ? 1 : 0);
	$canpublish   = ($profile->CanPublish() ? 1 : 0);
	$activity     = ($profile->HasActivity() ? 1 : 0);
	$ispp         = ($profile->isParameterized() ? 1 : 0);
        $disabled     = ($profile->isDisabled() ? 1 : 0);
	if ($canmodify) {
	    $title    = "Modify Profile";
	}
	else {
	    $title    = "View Profile";
	}
        $latest_profile = Profile::Lookup($profile->profile_uuid());
        $latest_uuid    = "'" . $latest_profile->uuid() . "'";
        $latest_version = $latest_profile->version();
    }
    else  {
        # New page action is now create, not copy or clone.
        if ($action == "copy" || $action == "clone") {
            if ($action == "clone") {
                $cloning = 1;
            }
	    $action = "create";
        }
	$button_label = "Create";
	$title        = "Create Profile";
    }

    SPITHEADER(1);

    echo "<div id='ppviewmodal_div'></div>\n";
    # Place to hang the toplevel template.
    echo "<div id='manage-body'></div>\n";

    # I think this will take care of XSS prevention?
    echo "<script type='text/plain' id='form-json'>\n";
    echo htmlentities(json_encode($formfields)) . "\n";
    echo "</script>\n";
    echo "<script type='text/plain' id='error-json'>\n";
    echo htmlentities(json_encode($errors));
    echo "</script>\n";

    $amlist = array();
    $amdefault = "";
    if ($viewing && ($ISCLOUD || ISADMIN() || STUDLY())) {
        while (list($index, $aggregate) = each($am_array)) {
            $urn = $aggregate->urn();
            $am  = $aggregate->name();
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

    # Pass project list through. Need to convert to list without groups.
    # When editing, pass through a single value. The template treats a
    # a single value as a read-only field.
    $plist = array();
    if ($viewing) {
	$plist[] = $formfields["profile_pid"];
    }
    else {
	while (list($project) = each($projlist)) {
	    $plist[] = $project;
	}
    }
    echo "<script type='text/plain' id='projects-json'>\n";
    echo htmlentities(json_encode($plist));
    echo "</script>\n";

    if ($viewing) {
        echo "<script type='text/plain' id='versions-json'>\n";
        echo json_encode($version_array);
        echo "</script>\n";
    }
    
    echo "<link rel='stylesheet'
            href='css/jquery-ui-1.10.4.custom.min.css'>\n";
    echo "<link rel='stylesheet'
            href='css/jquery.appendGrid-1.3.1.min.css'>\n";
    # For progress bubbles in the imaging modal.
    echo "<link rel='stylesheet' href='css/progress.css'>\n";
    echo "<link rel='stylesheet' href='css/codemirror.css'>\n";

    echo "<script type='text/javascript'>\n";
    echo "    window.VIEWING  = $viewing;\n";
    echo "    window.VERSION_UUID = $version_uuid;\n";
    echo "    window.PROFILE_UUID = $profile_uuid;\n";
    echo "    window.LATEST_UUID = $latest_uuid;\n";
    echo "    window.LATEST_VERSION = $latest_version;\n";
    echo "    window.UPDATED  = $notifyupdate;\n";
    echo "    window.SNAPPING = $notifyclone;\n";
    echo "    window.AJAXURL  = 'server-ajax.php';\n";
    echo "    window.ACTION   = '$action';\n";
    echo "    window.CANDELETE= $candelete;\n";
    echo "    window.CANMODIFY= $canmodify;\n";
    echo "    window.CANPUBLISH= $canpublish;\n";
    echo "    window.DISABLED= $disabled;\n";
    echo "    window.ISADMIN  = $isadmin;\n";
    echo "    window.MULTISITE  = $multisite;\n";
    echo "    window.HISTORY  = $history;\n";
    echo "    window.CLONING  = $cloning;\n";
    echo "    window.ACTIVITY = $activity;\n";
    echo "    window.TITLE    = '$title';\n";
    echo "    window.AMDEFAULT= '$amdefault';\n";
    echo "    window.BUTTONLABEL = '$button_label';\n";
    echo "    window.ISPPPROFILE = $ispp;\n";
    echo "    window.WITHPUBLISHING = $WITHPUBLISHING;\n";
    if (isset($copyuuid)) {
	echo "    window.COPYUUID = '$copyuuid';\n";
    }
    elseif (isset($snapuuid)) {
	echo "    window.SNAPUUID = '$snapuuid';\n";
    }
    if (isset($fromexp)) {
	echo "    window.EXPUUID = '$fromexp';\n";
    }
    echo "    window.CANREPO = $canrepo;\n";
    echo "</script>\n";
    echo "<script src='js/lib/jquery-ui.js'></script>\n";
    echo "<script src='js/lib/jquery.appendGrid-1.3.1.min.js'></script>\n";
    echo "<script src='js/lib/codemirror-min.js'></script>\n";

    REQUIRE_UNDERSCORE();
    REQUIRE_SUP();
    REQUIRE_FILESIZE();
    REQUIRE_JACKS_EDITOR();
    REQUIRE_IMAGE();
    REQUIRE_MOMENT();
    REQUIRE_APTFORMS();
    REQUIRE_FILESTYLE();
    REQUIRE_MARKED();
    AddLibrary("js/gitrepo.js");
    SPITREQUIRE("js/manage_profile.js");

    AddTemplateList(array('manage-profile', 'waitwait-modal', 'renderer-modal', 'showtopo-modal', 'oops-modal', 'rspectextview-modal', 'guest-instantiate', 'publish-modal', 'instantiate-modal', 'share-modal', 'gitrepo-picker'));
    SPITFOOTER();
}

$am_array = Instance::DefaultAggregateList();

#
# See what projects the user can do this in.
#
$projlist = $this_user->ProjectAccessList($TB_PROJECT_CREATEEXPT);

if (isset($action) && ($action == "edit" || $action == "copy")) {
    if (!isset($uuid)) {
	SPITUSERERROR("Must provide uuid!");
    }
    else {
	$profile = Profile::Lookup($uuid);
	if (!$profile) {
	    SPITUSERERROR("No such profile!");
	}
	else if ($profile->locked()) {
	    SPITUSERERROR("Profile is currently locked!");
	}
	else if ($profile->deleted()) {
	    SPITUSERERROR("Profile is has been deleted!");
	}
	if ($action == "edit") {
	    if ($this_idx != $profile->creator_idx() && !ISADMIN()) {
		SPITUSERERROR("Not enough permission!");
	    }
	}
	elseif (!$profile->CanView($this_user) && !ISADMIN()) {
	    SPITUSERERROR("Not enough permission!");
	}
        #
        # Spit out the version history.
        #
        $version_array  = array();
        $profileid      = $profile->profileid();

        $query_result =
            DBQueryFatal("select v.*,DATE(v.created) as created, ".
                         "    vp.uuid as parent_uuid ".
                         "  from apt_profile_versions as v ".
                         "left join apt_profile_versions as vp on ".
                         "     v.parent_profileid is not null and ".
                         "     vp.profileid=v.parent_profileid and ".
                         "     vp.version=v.parent_version ".
                         "where v.profileid='$profileid' and ".
                         "      v.deleted is null ".
                         "order by v.created desc");

        while ($row = mysql_fetch_array($query_result)) {
            $uuid    = $row["uuid"];
            $puuid   = $row["parent_uuid"];
            $version = $row["version"];
            $pversion= $row["parent_version"];
            $created = $row["created"];
            $published = $row["published"];
            $repourl = $row["repourl"];
            $rspec   = $row["rspec"];
            $desc    = '';
            $obj     = array();

            if (!$published) {
                $published = " ";
            }
            else {
                $published = date("Y-m-d", strtotime($published));
            }
            $parsed_xml = simplexml_load_string($rspec);
            if ($parsed_xml &&
                $parsed_xml->rspec_tour &&
                $parsed_xml->rspec_tour->description) {
                $desc = (string) $parsed_xml->rspec_tour->description;
            }
            $obj["uuid"]    = $uuid;
            $obj["version"] = $version;
            $obj["description"] = $desc;
            $obj["created"]     = $created;
            $obj["published"]   = $published;
            $obj["parent_uuid"] = $puuid;
            $obj["parent_version"] = $pversion;
            $version_array[] = $obj;
        }
    }
}

# We use a session.
session_start();

if (! isset($create)) {
    $errors   = array();
    $defaults = array();

    # Default action is create.
    if (! isset($action) || $action == "") {
	$action = "create";
    }
    
    if (! (isset($projlist) && count($projlist))) {
	$errors["error"] =
	    "You do not appear to be a member of any projects in which ".
	    "you have permission to create new profiles";
    }
    if ($action == "edit" || $action == "clone" || $action == "copy") {
	if ($action == "clone" || $action == "copy") {
	    if ($action == "clone") {
		if (! (isset($snapuuid) && IsValidUUID($snapuuid))) {
		    $errors["error"] = "No experiment specified for clone!";
		}
		$instance = Instance::Lookup($snapuuid);
		if (!$instance) {
		    SPITUSERERROR("No such instance to clone!");
		}
		else if ($this_idx != $instance->creator_idx() && !ISADMIN()) {
		    SPITUSERERROR("Not enough permission!");
		}
                else if ($instance->status() != "ready") {
		    SPITUSERERROR("Instance is busy, cannot clone it. " .
                                  "Please try again later.");
                }
		$profile = Profile::Lookup($instance->profile_id(),
					   $instance->profile_version());
		if (!$profile) {
		    SPITUSERERROR("Cannot load profile!");
		}
		if (!$profile->CanView($this_user)) {
		    SPITUSERERROR("Not allowed to access this profile!");
		}
	    }
            elseif ($action == "copy") {
                # Pass this along through the new create page.
                $copyuuid = $profile->uuid();
            }
	    $defaults["profile_rspec"]  = $profile->rspec();
	    $defaults["profile_who"]   = "private";
	    if ($profile->script() && $profile->script() != "") {
		$defaults["profile_script"] = $profile->script();
	    }
            # Default the project if in only one project.
	    if (count($projlist) == 1) {
		list($project) = each($projlist);
		reset($projlist);
		$defaults["profile_pid"] = $project;
	    }
	}
	else {
	    $defaults["profile_pid"]         = $profile->pid();
	    $defaults["profile_name"]        = $profile->name();
	    $defaults["profile_version"]     = $profile->version();
	    $defaults["profile_rspec"]       = $profile->rspec();
	    if ($profile->script() && $profile->script() != "") {
		$defaults["profile_script"] = $profile->script();
	    }
	    if ($profile->repourl() && $profile->repourl() != "") {
		$defaults["profile_repourl"]  = $profile->repourl();
                # Need this so JS code knows when HEAD changes.
		$defaults["profile_repohash"]  = $profile->repohash();
	    }
	    $defaults["profile_creator"]     = $profile->creator();
	    $defaults["profile_updater"]     = $profile->updater();
	    $defaults["profile_created"]     =
		DateStringGMT($profile->created());
	    $defaults["profile_published"]   =
		($profile->published() ?
		 DateStringGMT($profile->published()) : "");
	    $defaults["profile_version_url"] = $profile->URL();
	    $defaults["profile_profile_url"] = $profile->ProfileURL();
	    $defaults["profile_listed"]      =
		($profile->listed() ? "checked" : "");
	    $defaults["profile_who"] =
		($profile->shared() ? "shared" : 
		 ($profile->ispublic() ? "public" : "private"));
	    $defaults["profile_topdog"]      =
		($profile->topdog() ? "checked" : "");
	    $defaults["profile_disabled"]      =
		($profile->isDisabled() ? "checked" : "");

	    # Warm fuzzy message.
	    if (isset($_SESSION["notifyupdate"])) {
		$notifyupdate = 1;
		unset($_SESSION["notifyupdate"]);
		session_destroy();
		session_commit();
	    }
	}
        #
        # See if we have a task running in the background
        # for this profile. At the moment it can only be a
        # clone task. If there is one, we have to tell
        # the js code to show the status of the clone.
        #
        $webtask = $profile->webtask();
        if ($webtask->TaskValue("cloning")) {
            $notifyclone = 1;
        }
    }
    else {
	# Default the project if in only one project.
	if (count($projlist) == 1) {
	    list($project) = each($projlist);
	    reset($projlist);
	    $defaults["profile_pid"] = $project;
	}
	$defaults["profile_who"]   = "private";

        #
        # If coming from a classic emulab experiment, then do permission checks
        # and then use the NS file for the script. Also set the project.
        #
        if (isset($fromexp) && $fromexp != "") {
            $experiment = Experiment::LookupByUUID($fromexp);
            if (!$experiment) {
                SPITUSERERROR("No such classic emulab experiment!");
            }
            if (!$experiment->AccessCheck($this_user, $TB_EXPT_MODIFY)) {
                SPITUSERERROR("Not enough permission to create a profile from ".
                              "this classic emulab experiment");
            }
	    $defaults["profile_pid"] = $experiment->pid();
        }
    }
    SPITFORM($defaults, $errors);
    return;
}

#
# Otherwise, must validate and redisplay if errors
#
$errors = array();

#
# Quick check for required fields.
#
$required = array("pid", "name");

foreach ($required as $key) {
    if (!isset($formfields["profile_${key}"]) ||
	strcmp($formfields["profile_${key}"], "") == 0) {
	$errors["profile_${key}"] = "Missing Field";
    }
    elseif (! TBcheck_dbslot($formfields["profile_${key}"], "apt_profiles", $key,
			     TBDB_CHECKDBSLOT_WARN|TBDB_CHECKDBSLOT_ERROR)) {
	$errors["profile_${key}"] = TBFieldErrorString();
    }
}

if (isset($formfields["profile_rspec"]) &&
	$formfields["profile_rspec"] != "") {
    if (! TBvalid_rspec($formfields["profile_rspec"])) {
	$errors["profile_rspec"] = TBFieldErrorString();	
    }
    else {
	$rspec = $formfields["profile_rspec"];
    }
}
else {
    # Best place to put the error. 
    $errors["sourcefile"] = "Missing Field";
}

# Present these errors before we call out to do anything else.
if (count($errors)) {
    SPITFORM($formfields, $errors);
    return;
}

#
# Project has to exist. We need to know it for the SUEXEC call
# below. 
#
$project = Project::LookupByPid($formfields["profile_pid"]);
if (!$project) {
    $errors["profile_pid"] = "No such project";
}
# User better be a member.
if (!ISADMIN() && $project && 
    (!$project->IsMember($this_user, $isapproved) || !$isapproved)) {
    $errors["profile_pid"] = "Illegal project";
}

#
# Convert profile_who to arguments.
#
if (!isset($formfields["profile_who"]) || $formfields["profile_who"] == "") {
    $errors["profile_who"] = "Missing value";
}
else {
    $who = $formfields["profile_who"];
    if (! ($who == "private" || $who == "shared" || $who == "public")) {
	$errors["profile_who"] = "Illegal value";
    }
}

# Sanity check repourl.
if (!isset($action) &&
    isset($formfields["profile_repourl"]) &&
    $formfields["profile_repourl"] != "") {
    if (!TBvalid_URL($formfields["profile_repourl"])) {
	$errors["error"] = "Invalid repository URL!";
    }
}

#
# Sanity check the snapuuid argument when doing a clone.
#
if (isset($action) && $action == "clone") {
    if (!isset($snapuuid) || $snapuuid == "" || !IsValidUUID($snapuuid)) {
	$errors["error"] = "Invalid experiment specified for clone!";
    }
    $instance = Instance::Lookup($snapuuid);
    if (!$instance) {
	$errors["error"] = "No such experiment to clone!";
    }
    else if ($this_idx != $instance->creator_idx() && !ISADMIN()) {
	$errors["error"] = "Not enough permission!";
    }
    else if (! Profile::Lookup($instance->profile_id(),
			       $instance->profile_version())) {
	$errors["error"] = "Cannot load profile for instance!";    }
}

# Present these errors before we call out to do anything else.
if (count($errors)) {
    SPITFORM($formfields, $errors);
    return;
}

#
# Pass to the backend as an XML data file. If this gets too complicated,
# we might eed to do all the checking in the backend and have it pass
# back the error set. 
#
# Generate a temporary file and write in the XML goo.
#
$xmlname = tempnam("/tmp", "newprofile");
if (! $xmlname) {
    TBERROR("Could not create temporary filename", 0);
    $errors["error"] = "Internal error; Could not create temp file";
    SPITFORM($formfields, $errors);
    return;
}
elseif (! ($fp = fopen($xmlname, "w"))) {
    TBERROR("Could not open temp file $xmlname", 0);
    $errors["error"] = "Internal error; Could not open temp file";
    SPITFORM($formfields, $errors);
    unlink($xmlname);
    return;
}
else {
    fwrite($fp, "<profile>\n");
    fwrite($fp, "<attribute name='profile_pid'>");
    fwrite($fp, "  <value>" . $formfields["profile_pid"] . "</value>");
    fwrite($fp, "</attribute>\n");
    fwrite($fp, "<attribute name='profile_name'>");
    fwrite($fp, "  <value>" .
	   htmlspecialchars($formfields["profile_name"]) . "</value>");
    fwrite($fp, "</attribute>\n");
    fwrite($fp, "<attribute name='rspec'>");
    fwrite($fp, "  <value>" . htmlspecialchars($rspec) . "</value>");
    fwrite($fp, "</attribute>\n");
    if (isset($formfields["profile_script"]) &&
	$formfields["profile_script"] != "") {
	fwrite($fp, "<attribute name='script'>");
	fwrite($fp, "  <value>" .
	       htmlspecialchars($formfields["profile_script"]) .
	       "</value>");
	fwrite($fp, "</attribute>\n");
    }
    if (isset($formfields["profile_repourl"]) &&
	$formfields["profile_repourl"] != "") {
	fwrite($fp, "<attribute name='repourl'>");
	fwrite($fp, "  <value>" .
	       htmlspecialchars($formfields["profile_repourl"]) .
	       "</value>");
	fwrite($fp, "</attribute>\n");
    }
    #
    # When the profile is created we mark it listed=public if a mere
    # user. Mere users cannot change the value later. Admin users can
    # always set/change the value.
    #
    if ($action != "edit" || ISADMIN()) {
        fwrite($fp, "<attribute name='profile_listed'><value>");
        if (ISADMIN()) {
            if (isset($formfields["profile_listed"]) &&
                $formfields["profile_listed"] == "checked") {
                fwrite($fp, "1");
            }
            else {
                fwrite($fp, "0");
            }
        }
        elseif ($action != "edit") {
            fwrite($fp, ($who == "public" ? "1" : "0"));
        }
        fwrite($fp, "</value></attribute>\n");
    }
    fwrite($fp, "<attribute name='profile_shared'><value>" .
	   ($who == "shared" ? 1 : 0) . "</value></attribute>\n");
    fwrite($fp, "<attribute name='profile_public'><value>" .
	   ($who == "public" ? 1 : 0) . "</value></attribute>\n");
    if (ISADMIN()) {
	fwrite($fp, "<attribute name='profile_topdog'><value>");
	if (isset($formfields["profile_topdog"]) &&
	    $formfields["profile_topdog"] == "checked") {
	    fwrite($fp, "1");
	}
	else {
	    fwrite($fp, "0");
	}
	fwrite($fp, "</value></attribute>\n");
	fwrite($fp, "<attribute name='profile_disabled'><value>");
	if (isset($formfields["profile_disabled"]) &&
	    $formfields["profile_disabled"] == "checked") {
	    fwrite($fp, "1");
	}
	else {
	    fwrite($fp, "0");
	}
	fwrite($fp, "</value></attribute>\n");
	fwrite($fp, "<attribute name='profile_disable_all'><value>");
	if (isset($formfields["profile_disable_all"]) &&
	    $formfields["profile_disable_all"] == "checked") {
	    fwrite($fp, "1");
	}
	else {
	    fwrite($fp, "0");
	}
	fwrite($fp, "</value></attribute>\n");
    }
    fwrite($fp, "</profile>\n");
    fclose($fp);
    chmod($xmlname, 0666);
}

#
# Call out to the backend.
#
$webtask    = WebTask::CreateAnonymous();
$webtask_id = $webtask->task_id();
$command    = "webmanage_profile ";

if ($action == "edit") {
    $command .= " update -t $webtask_id " . $profile->uuid();
}
else {
    $command .= " create -t $webtask_id ";
    if (isset($copyuuid)) {
        $command .= "-c " . escapeshellarg($copyuuid);
    }
    elseif (isset($snapuuid)) {
        $command .= "-s " . escapeshellarg($snapuuid);
    }
}
$command .= " $xmlname";

$retval = SUEXEC($this_user->uid(), $project->unix_gid(), $command,
		 SUEXEC_ACTION_IGNORE);
if ($retval) {
    if ($retval < 0) {
	$errors["error"] = "Internal Error; please try again later.";
	SUEXECERROR(SUEXEC_ACTION_CONTINUE);
    }
    else {
        $webtask->Refresh();
        if ($webtask->TaskValue("output")) {
            $parsed = simplexml_load_string($webtask->TaskValue("output"));
        }
	if (!$parsed) {
	    $errors["error"] = "Internal Error; please try again later.";
	    TBERROR("Could not parse XML output:\n$suexec_output\n", 0);
	}
	else {
	    foreach ($parsed->error as $error) {
		$errors[(string)$error['name']] = (string)$error;
	    }
	}
    }
    $webtask->Delete();
}
unlink($xmlname);
if (count($errors)) {
    SPITFORM($formfields, $errors);
    return;
}

#
# Need the index to pass back through. But when its an edit operation,
# we have to let the backend tell us it created a new version, since
# we want to return to that.
#
if ($action == "edit") {
    $webtask->Refresh();
    if ($webtask->TaskValue("newProfile")) {
        $profile = Profile::Lookup($webtask->TaskValue("newProfile"));
    }
}
else {
    $profile = Profile::LookupByName($project, $formfields["profile_name"]);
}

# Done with this, unless doing a snapshot (needed for imaging status).
if (!isset($snapuuid)) {
    $webtask->Delete();
}

if ($profile) {
    $uuid = $profile->uuid();
}
else {
    header("Location: $APTBASE/user-dashboard.php#profiles");
}
if ($action == "edit") {
    $_SESSION["notifyupdate"] = 1;
}
header("Location: $APTBASE/manage_profile.php?action=edit&uuid=$uuid");

?>
