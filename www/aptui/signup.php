<?php
#
# Copyright (c) 2000-2018 University of Utah and the Flux Group.
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
$page_title = "Signup";
# Do not create anything, just do the checks.
$debug = 0;
# Update mode.
$promoting = 0;
# Powder licenses
$license_defs = array();

#
# Get current user.
#
RedirectSecure();
$this_user = CheckLogin($check_status);
if (isset($this_user)) {
    # Allow unapproved users to join multiple groups ...
    CheckLoginOrDie(CHECKLOGIN_UNAPPROVED|CHECKLOGIN_NONLOCAL);
}

# Force nonlocal user to provide more complete personal info.
if ($this_user && $this_user->IsNonLocal()) {
    # Might want to use a different test, or add a flag to the users table
    # indicating that a user has been promoted to allow project create/join.
    if (!$this_user->country() || $this_user->country() == "") {
        $promoting = 1;
    }
}

#
# Verify page arguments.
#
$optargs = OptionalPageArguments("create",       PAGEARG_STRING,
				 "uid",		 PAGEARG_STRING,
				 "email",        PAGEARG_STRING,
				 "pid",          PAGEARG_STRING,
				 "verify",       PAGEARG_STRING,
				 "finished",     PAGEARG_BOOLEAN,
				 "joinproject",  PAGEARG_BOOLEAN,
                                 "toomany",      PAGEARG_BOOLEAN,
				 "formfields",   PAGEARG_ARRAY);

# List of licenses for Powder.
if ($ISPOWDER) {
    $query_result = DBQueryFatal("select * from licenses");

    while ($row = mysql_fetch_array($query_result)) {
        $license_defs[$row["license_name"]] =
            array("license_name" => $row["license_name"],
                  "form_text"    => $row["form_text"],
                  "description_type" => $row["description_type"],
                  "description_text" => $row["description_text"]);
    }
}

#
# Spit the form
#
function SPITFORM($formfields, $showverify, $errors)
{
    global $TBDB_UIDLEN, $TBDB_PIDLEN, $TBDOCBASE, $WWWHOST;
    global $ACCOUNTWARNING, $EMAILWARNING, $this_user, $joinproject, $toomany;
    global $promoting, $ISPOWDER, $license_defs;
    $button_label = "Create Account";

    SPITHEADER(1);

    echo "<link rel='stylesheet'
                href='css/bootstrap-formhelpers.min.css'>\n";

    echo "<div id='signup-body'></div>\n";
    echo "<div id='toomany_div'></div>\n";
    echo "<script type='text/plain' id='form-json'>\n";
    echo htmlentities(json_encode($formfields)) . "\n";
    echo "</script>\n";
    echo "<script type='text/plain' id='error-json'>\n";
    echo htmlentities(json_encode($errors));
    echo "</script>\n";
    echo "<script type='text/plain' id='licenses-json'>\n";
    echo htmlentities(json_encode($license_defs));
    echo "</script>\n";
    echo "<script type='text/javascript'>\n";

    if (isset($joinproject)) {
	$joinproject = ($joinproject ? "true" : "false");
	echo "window.APT_OPTIONS.joinproject = $joinproject;\n";
    } else {
	echo "window.APT_OPTIONS.joinproject = false;\n";
    }
    if ($showverify) {
        echo "window.APT_OPTIONS.ShowVerifyModal = true;\n";
    }
    if ($this_user) {
        echo "window.APT_OPTIONS.this_user = true;\n";
        if ($promoting) {
            echo "window.APT_OPTIONS.promoting = true;\n";
        }
        else {
            echo "window.APT_OPTIONS.promoting = false;\n";
        }
    }
    else {
	echo "window.APT_OPTIONS.this_user = false;\n";
    }
    if ($toomany) {
	echo "window.APT_OPTIONS.toomany = true;\n";
    }
    else {
	echo "window.APT_OPTIONS.toomany = false;\n";
    }

    echo "</script>\n";

    echo "<script src='js/lib/jquery-2.0.3.min.js'></script>\n";

    REQUIRE_UNDERSCORE();
    REQUIRE_SUP();
    REQUIRE_MARKED();
    REQUIRE_APTFORMS();
    REQUIRE_FORMHELPERS();
    SPITREQUIRE("js/signup.js");

    AddTemplateList(array("about-account", "verify-modal", "signup-personal", "signup-project", "signup", "toomany-modal"));
    SPITFOOTER();
}

if (isset($finished) && $finished) {
    SPITHEADER(1);
    echo "Thank you! Stay tuned for email notifying you that your account has ".
	"been activated. Please be sure ".
	"to set your spam filter to allow all email from '@${OURDOMAIN}' and ".
	"'@flux.utah.edu'.".
    SPITNULLREQUIRE();
    SPITFOOTER();
    exit(0);
}

#
# If not clicked, then put up a form.
#
if (! isset($create)) {
    $defaults = array();
    $errors   = array();

    # Default to start
    if (!isset($joinproject)) {
        $joinproject = 0;
        $defaults["startorjoin"] = "start";
    }
    elseif ($joinproject) {
        $defaults["startorjoin"] = "join";
    }
    else {
        $defaults["startorjoin"] = "start";
    }

    if (count($license_defs)) {
        foreach ($license_defs as $name => $value) {
            $defaults["license_" . $name] = "no";
        }
    }

    if ($this_user && $promoting) {
        $defaults["uid"]         = $this_user->uid();
        $defaults["fullname"]    = $this_user->name();
        $defaults["email"]       = $this_user->email();
        $defaults["city"]        = $this_user->city();
        $defaults["state"]       = $this_user->state();
        $defaults["country"]     = $this_user->country();
        $defaults["affiliation"] = $this_user->affil();
    }
    else {
        if (isset($uid)) {
            $defaults["uid"] = CleanString($uid);
        }
        if (isset($email)) {
            $defaults["email"] = CleanString($email);
        }
    }
    if (isset($pid)) {
        $defaults["pid"] = CleanString($pid);
        $defaults["startorjoin"] = "join";
        $joinproject = 1;
    }
    
    SPITFORM($defaults, 0, $errors);
    return;
}

#
# Otherwise, must validate and redisplay if errors
#
$errors = array();

# Optional licenses;
$licenses = array();

#
# Check for start or join right away so we know what we be doing.
#
if (!isset($formfields["startorjoin"]) || $formfields["startorjoin"] == "") {
    $errors["error"] = "Neither start or join selected";
    SPITFORM($defaults, 0, $errors);
    return;
}
if ($formfields["startorjoin"] == "join") {
    $joinproject = 1;
}

#
# These fields are required
#
if (!$this_user || $promoting) {
    if (!isset($formfields["uid"]) ||
	strcmp($formfields["uid"], "") == 0) {
	$errors["uid"] = "Missing Field";
    }
    elseif (!TBvalid_uid($formfields["uid"])) {
	$errors["uid"] = TBFieldErrorString();
    }
    elseif (!$promoting &&
            (User::Lookup($formfields["uid"]) ||
             posix_getpwnam($formfields["uid"]))) {
	$errors["uid"] = "Already in use. Pick another";
    }
    if (!isset($formfields["fullname"]) ||
	strcmp($formfields["fullname"], "") == 0) {
	$errors["fullname"] = "Missing Field";
    }
    elseif (! TBvalid_usrname($formfields["fullname"])) {
	$errors["fullname"] = TBFieldErrorString();
    }
    # Make sure user name has at least two tokens!
    $tokens = preg_split("/[\s]+/", $formfields["fullname"],
			 -1, PREG_SPLIT_NO_EMPTY);
    if (count($tokens) < 2) {
	$errors["fullname"] = "Please provide a first and last name";
    }
    if (!isset($formfields["email"]) ||
	strcmp($formfields["email"], "") == 0) {
	$errors["email"] = "Missing Field";
    }
    elseif (! TBvalid_email($formfields["email"])) {
	$errors["email"] = TBFieldErrorString();
    }
    elseif (!$promoting &&
            User::LookupByEmail($formfields["email"])) {
        #
        # Treat this error separate. Not allowed.
        #
	$errors["email"] =
	    "Already in use. Did you forget to login?";
    }
    if (!isset($formfields["affiliation"]) ||
	strcmp($formfields["affiliation"], "") == 0) {
	$errors["affiliation"] = "Missing Field";
    }
    elseif (! TBvalid_affiliation($formfields["affiliation"])) {
	$errors["affiliation"] = TBFieldErrorString();
    }
    if (!isset($formfields["country"]) ||
	strcmp($formfields["country"], "") == 0) {
	$errors["country"] = "Missing Field";
    }
    elseif (! TBvalid_country($formfields["country"])) {
	$errors["country"] = TBFieldErrorString();
    }
    if (!isset($formfields["state"]) ||
	strcmp($formfields["state"], "") == 0) {
	$errors["state"] = "Missing Field";
    }
    elseif (! TBvalid_state($formfields["state"])) {
	$errors["state"] = TBFieldErrorString();
    }
    if (!isset($formfields["city"]) ||
	strcmp($formfields["city"], "") == 0) {
	$errors["city"] = "Missing Field";
    }
    elseif (! TBvalid_city($formfields["city"])) {
	$errors["city"] = TBFieldErrorString();
    }
    if (!$promoting) {
        if (!isset($formfields["password1"]) ||
            strcmp($formfields["password1"], "") == 0) {
            $errors["password1"] = "Missing Field";
        }
        if (!isset($formfields["password2"]) ||
            strcmp($formfields["password2"], "") == 0) {
            $errors["password2"] = "Missing Field";
        }
        elseif (strcmp($formfields["password1"], $formfields["password2"])) {
            $errors["password2"] = "Does not match password";
        }
        elseif (! CHECKPASSWORD($formfields["uid"],
                                $formfields["password1"],
                                $formfields["fullname"],
                                $formfields["email"], $checkerror)) {
            $errors["password1"] = "$checkerror";
        }
    }
}

if (!isset($formfields["pid"]) ||
    strcmp($formfields["pid"], "") == 0) {
    $errors["pid"] = "Missing Field";
}
else {
    # Lets not allow pids that are too long, via this interface.
    if (strlen($formfields["pid"]) > $TBDB_PIDLEN) {
	$errors["pid"] =
	    "too long - $TBDB_PIDLEN chars maximum";
    }
    elseif (!TBvalid_newpid($formfields["pid"])) {
	$errors["pid"] = TBFieldErrorString();
    }
    $project = Project::LookupByPid($formfields["pid"]);
    if ($joinproject) {
	if (!$project) {
	    $errors["pid"] = "No such project. Did you spell it properly?";
	}
    }
    elseif ($project) {
	$errors["pid"] = "Already in use. Select another";
    }
}
if (!$joinproject) {
    if (!isset($formfields["proj_title"]) ||
	strcmp($formfields["proj_title"], "") == 0) {
	$errors["proj_title"] = "Missing Field";
    }
    elseif (! TBvalid_description($formfields["proj_title"])) {
	$errors["proj_title"] = TBFieldErrorString();
    }
    if (!isset($formfields["proj_url"]) ||
	strcmp($formfields["proj_url"], "") == 0 ||
	strcmp($formfields["proj_url"], $HTTPTAG) == 0) {    
	$errors["proj_url"] = "Missing Field";
    }
    elseif (! CHECKURL($formfields["proj_url"], $urlerror)) {
	$errors["proj_url"] = $urlerror;
    }
    if (!isset($formfields["proj_why"]) ||
	strcmp($formfields["proj_why"], "") == 0) {
	$errors["proj_why"] = "Missing Field";
    }
    elseif (! TBvalid_why($formfields["proj_why"])) {
	$errors["proj_why"] = TBFieldErrorString();
    }
    if (count($license_defs)) {
        foreach ($license_defs as $name => $value) {
            $fname = "license_" . $name;

            if (isset($formfields[$fname]) && $formfields[$fname] == "yes") {
                $licenses[$name] = "yes";
            }
        }
    }
}

# Present these errors before we call out to do anything else.
if (count($errors)) {
    SPITFORM($formfields, 0, $errors);
    return;
}

#
# Lets get the user to do the email verification now before
# we go any further. We use a session variable to store the
# key we send to the user in email.
#
if (!$this_user || $promoting) {
    session_start();
    if (!isset($_SESSION["verify_key"])) {
	$_SESSION["verify_key"] = substr(GENHASH(), 0, 16);
    }
    #
    # Once the user verifies okay, we remember that in the session
    # in case there is a later error below.
    #
    if (!isset($_SESSION["verified"])) {
	if (!isset($verify) || $verify == "" ||
	    $verify != $_SESSION["verify_key"]) {
	    mail($formfields["email"],
		 "Confirm your email to create your account",
		 "Here is your user verification code. Please copy and\n".
		 "paste this code into the box on the account page.\n\n".
		 "\t" . $_SESSION["verify_key"] . "\n",
		 "From: $APTMAIL");
	
	    #
            # Respit complete form but show the verify email modal.
	    #
	    SPITFORM($formfields, 1, $errors);
	    return;
	}
	#
        # Success. Lets remember that in case we get an error below and
        # the form is redisplayed. 
	#
	$_SESSION["verified"] = 1;
    }
}

if ($debug) {
    TBERROR("New APT User ($joinproject)" .
	    print_r($formfields, TRUE), 0);
    SPITFORM($formfields, 0, $errors);
    return;
}

#
# If a nonlocal user upgrading account, do a ModUserInfo and then
# continue as a normal user (even though they are still nonlocal).
#
if ($this_user && $promoting) {
    $args["name"]	   = $formfields["fullname"];
    $args["city"]          = $formfields["city"];
    $args["state"]         = $formfields["state"];
    $args["country"]       = $formfields["country"];
    $args["shell"]         = 'tcsh';
    $args["affiliation"]   = $formfields["affiliation"];

    if (! User::ModUserInfo($this_user, $this_user->uid(), $args, $errors)) {
        # Always respit the form so that the form fields are not lost.
        SPITFORM($formfields, 0, $errors);
        PAGEFOOTER();
        return;
    }
    $this_user->Refresh();
}

#
# Create the User first, then the Project/Group.
# Certain of these values must be escaped or otherwise sanitized.
#
if (!$this_user) {
    $args = array();
    $args["uid"]	   = $formfields["uid"];
    $args["name"]	   = $formfields["fullname"];
    $args["email"]         = $formfields["email"];
    $args["city"]          = $formfields["city"];
    $args["state"]         = $formfields["state"];
    $args["country"]       = $formfields["country"];
    $args["shell"]         = 'tcsh';
    $args["affiliation"]   = $formfields["affiliation"];
    $args["password"]      = $formfields["password1"];
    # Force initial SSL cert generation.
    $args["passphrase"]    = $formfields["password1"];
    # Flag to the backend.
    $args["portal"]	   = $PORTAL_GENESIS;

    #
    # Backend verifies pubkey and returns error. We first look for a 
    # file and then fall back to an inline field. See SPITFORM().
    #
    if (isset($_FILES['keyfile']) &&
	$_FILES['keyfile']['name'] != "" &&
	$_FILES['keyfile']['name'] != "none") {

	$localfile = $_FILES['keyfile']['tmp_name'];
	$args["pubkey"] = file_get_contents($localfile);
	$formfields["pubkey"] = $args["pubkey"];
    }
    elseif (isset($formfields["pubkey"]) && $formfields["pubkey"] != "") {
	$args["pubkey"] = $formfields["pubkey"];
    }

    #
    # Joining a project is a different path.
    #
    if ($joinproject) {
	if (! ($user = User::NewNewUser(0, $args, $error)) != 0) {
	    $errors["error"] = $error;
	    SPITFORM($formfields, 0, $errors);
	    return;
	}
	$group = $project->LoadDefaultGroup();
	if ($project->AddNewMember($user) < 0) {
	    TBERROR("Could not add new user to project group $pid", 1);
	}
	$group->NewMemberNotify($user);
	header("Location: instantiate.php");
	return;
    }

    # Just collect the user XML args here and pass the file to NewNewProject.
    # Underneath, newproj calls newuser with the XML file.
    #
    # Calling newuser down in Perl land makes creation of the leader account
    # and the project "atomic" from the user's point of view.  This avoids a
    # problem when the DB is locked for daily backup: in newproject, the call
    # on NewNewUser would block and then unblock and get done; meanwhile the
    # PHP thread went away so we never returned here to call NewNewProject.
    #
    if (! ($newuser_xml = User::NewNewUserXML($args, $error)) != 0) {
	$errors["error"] = $error;
	TBERROR("Error Creating new APT user XML:\n${error}\n\n" .
		print_r($args, TRUE), 0);
	SPITFORM($formfields, 0, $errors);
	return;
    }
}
elseif ($joinproject) {
    $isapproved = 0;
    if ($project->IsMember($this_user, $isapproved)) {
	$errors["pid"] = "You are already a member of the project! ";
	if (!$isapproved) {
	    $errors["pid"] .=
		"Please wait for your membership to be activated.";
	}
	SPITFORM($formfields, 0, $errors);
	return;
    }
    if ($project->AddNewMember($this_user) < 0) {
	TBERROR("Could not add new user to project group $pid", 1);
    }
    $group = $project->LoadDefaultGroup();
    $group->NewMemberNotify($this_user);
    header("Location: signup.php?finished=1");
    return;
}

#
# Now for the new Project
#
$args = array();
if (isset($newuser_xml)) {
    $args["newuser_xml"]   = $newuser_xml;
}
if ($this_user) {
    # An existing, logged-in user is starting the project.
    $args["leader"]	   = $this_user->uid();
}
$args["name"]		   = $formfields["pid"];
$args["short description"] = $formfields["proj_title"];
$args["URL"]               = $formfields["proj_url"];
$args["long description"]  = $formfields["proj_why"];
# We do not care about these anymore. Just default to something.
$args["members"]           = 1;
$args["num_pcs"]           = 1;
$args["public"]            = 1;
$args["linkedtous"]        = 1;
$args["plab"]              = 0;
$args["ron"]               = 0;
$args["funders"]           = "None";
$args["whynotpublic"]      = $PORTAL_GENESIS;
# Flag to the backend.
$args["portal"] 	   = $PORTAL_GENESIS;
# Add any requested licenses to the arguments.
foreach ($licenses as $name => $value) {
    $args["license_" . $name] = $value;
}
error_log(print_r($args, TRUE));

if (! ($project = Project::NewNewProject($args, $error))) {
    $errors["error"] = $error;
    if ($suexec_retval < 0) {
	TBERROR("Error Creating APT/CloudLab Project\n${error}\n\n" .
		print_r($args, TRUE), 0);

        SUEXECERROR(SUEXEC_ACTION_CONTINUE);
    }
    SPITFORM($formfields, 0, $errors);
    return;
}
SUEXECERROR(SUEXEC_ACTION_CONTINUE);

#
# Destroy the session if we had a new user. 
#
if (!$this_user) {
    session_destroy();
}

#
# Spit out a redirect so that the history does not include a post
# in it. The back button skips over the post and to the form.
# See above for conclusion.
# 
header("Location: signup.php?finished=1");

?>
