<?php
#
# Copyright (c) 2000-2015 University of Utah and the Flux Group.
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
}
elseif ($ISCLOUD) {
    RedirectLoginPage();
}

#
# Verify page arguments.
#
$optargs = OptionalPageArguments("create",        PAGEARG_STRING,
				 "profile",       PAGEARG_STRING,
				 "version",       PAGEARG_INTEGER,
				 "stuffing",      PAGEARG_STRING,
				 "verify",        PAGEARG_STRING,
				 "project",       PAGEARG_PROJECT,
				 "asguest",       PAGEARG_BOOLEAN,
				 "default",       PAGEARG_STRING,
				 "formfields",    PAGEARG_ARRAY);

if ($ISAPT && !$this_user) {
    #
    # If user appears to have an account, go to login page.
    # Continue as guest on that page.
    #
    if (REMEMBERED_ID()) {
	if (isset($asguest) && $asguest) {
	    # User clicked on continue as guest. If we do not delete the
	    # cookie, then user will go through the same loop next time
            # they click the Home button, since that points here. So delete
	    # the UID cookie. Not sure I like this.
	    ClearRememberedID();
	}
	else {
            header("Location: login.php?from=instantiate&referrer=".
                   urlencode($_SERVER['REQUEST_URI']));
	}
    }
}
if ($this_user) {
    $projlist = $this_user->ProjectAccessList($TB_PROJECT_CREATEEXPT);
    if (count($projlist) == 0) {
	SPITUSERERROR("You do not belong to any projects with permission to ".
                      "create new experiments. Please contact your project ".
                      "leader to grant you the neccessary privilege.");
	exit();
    }
}
if ($ISCLOUD) {
    $profile_default     = "ARM64OpenStack";
    $profile_default_pid = "emulab-ops";
}
else {
    $profile_default     = "OneVM";
    $profile_default_pid = $TBOPSPID;
}
$profile_array  = array();
$am_array       = Instance::DefaultAggregateList();

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
    if (! $obj) {
	SPITUSERERROR("No such profile: $profile");
	exit();
    }
    if (IsValidUUID($profile)) {
	#
	# If uuid was to profile, then find the most recently published
	# version and instantiate that, since what we have is the most
	# recent version, but might not be published.
	#
	if ($profile == $obj->profile_uuid() && !$obj->published()) {
	    $obj = $obj->LookupMostRecentPublished();
	    if (! $obj) {
		SPITUSERERROR("No published version for profile");
		exit();
	    }
	}
        $profile = $obj;
	$profile_array[$profile->uuid()] = $profile->name();
	$profilename = $profile->name();
    }
    else {
	#
	# If no version provided, then find the most recently published
	# version and instantiate that, since what we have is the most
	# recent version, but might not be published.
	#
	if (!isset($version) && !$obj->published()) {
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
	$profile_array[$profile->uuid()] = $profile->name();
	$profilename = $profile->name();
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
	    "     g.pid_idx=v.pid_idx and g.pid_idx=g.gid_idx";
	$whereclause =
	    "p.public=1 or p.shared=1 or v.creator_idx='$this_idx' or ".
	    "g.uid_idx is not null ";
    }

    $query_result =
	DBQueryFatal("select p.*,v.* from apt_profiles as p ".
		     "left join apt_profile_versions as v on ".
		     "     v.profileid=p.profileid and ".
		     "     v.version=p.version ".
		     "$joinclause ".
		     "where locked is null and ($whereclause) ".
		     "order by p.topdog desc");
    while ($row = mysql_fetch_array($query_result)) {
	$profile_array[$row["uuid"]] = $row["name"];
        if (isset($default)) {
            if ($default == $row["uuid"]) {
                $profile_default = $row["uuid"];
            }
        }
        elseif ($row["pid"] == $profile_default_pid &&
                $row["name"] == $profile_default) {
	    $profile_default = $row["uuid"];
	}
    }
}

function SPITFORM($formfields, $newuser, $errors)
{
    global $TBBASE, $APTMAIL, $ISCLOUD;
    global $profile_array, $this_user, $profilename, $profile, $am_array;
    global $projlist;
    $amlist     = array();
    $showabout  = ($ISCLOUD || !$this_user ? 1 : 0);
    $registered = (isset($this_user) ? "true" : "false");
    $webonly    = (isset($this_user) &&
                   $this_user->webonly() ? "true" : "false");
    $nopprspec  = (!isset($this_user) || $this_user->IsNonLocal() ?
                   "true" : "false");
    $portal     = "";
    # Gack.
    if (isset($this_user) && $this_user->IsNonLocal()) {
        if (preg_match("/^[^+]*\+([^+]+)\+([^+]+)\+(.+)$/",
                       $this_user->nonlocal_id(), $matches) &&
            $matches[1] == "ch.geni.net") {
            $portal = "https://portal.geni.net/";
        }
    }

    # XSS prevention.
    while (list ($key, $val) = each ($formfields)) {
	$formfields[$key] = CleanString($val);
    }
    # XSS prevention.
    if ($errors) {
	while (list ($key, $val) = each ($errors)) {
	    # Skip internal error, we want the html in those errors
	    # and we know it is safe.
	    if ($key == "error") {
		continue;
	    }
	    $errors[$key] = CleanString($val);
	}
    }

    $formatter = function($field, $html) use ($errors) {
	$class = "form-group";
	if ($errors && array_key_exists($field, $errors)) {
	    $class .= " has-error";
	}
	echo "<div class='$class'>\n";
	echo "     $html\n";
	if ($errors && array_key_exists($field, $errors)) {
	    echo "<label class='control-label' for='$field'>" .
		$errors[$field] . "</label>\n";
	}
	echo "</div>\n";
    };

    SPITHEADER(1);

    echo "<div id='ppviewmodal_div'></div>\n";
    echo "<div class='row'>
          <div class='col-lg-6  col-lg-offset-3
                      col-md-6  col-md-offset-3
                      col-sm-8  col-sm-offset-2
                      col-xs-12 col-xs-offset-0'>\n";

    # Placeholder for the "about" panel, which is now a template file.
    echo "<div id='about_div'></div>\n";

    echo "<form id='quickvm_form' role='form'
            enctype='multipart/form-data'
            method='post' action='instantiate.php'>\n";
    if (!$this_user) {
	echo "<div class='panel panel-default'>
                <div class='panel-heading'>
                   <h3 class='panel-title'>\n";
    }
    else {
	echo "<h3 style='margin-top: 0px;'>";
    }
    echo "<center>Start Experiment";
    if (isset($profilename)) {
        echo " using profile &quot;$profilename&quot";
    }
    echo "</center></h3>\n";
    if (!$this_user) {
	echo "   </div>
	      <div class='panel-body'>\n";
    }
    
    #
    # If linked to a specific profile, description goes here
    #
    if ($profile) {
	$cluster = ($ISCLOUD ? "Cloudlab" : "APT");
	
	if (!$this_user) {
	    echo "  <p>Fill out the form below to run an experiment ".
		"using this profile:</p>\n";
	}
        # Note: Following line is also duplicated below
        echo "  <blockquote><p><span id='selected_profile_description'></span></p></blockquote>\n";
        echo "  <p>When you click the &quot;Create&quot; button, the virtual or
                   physical machines described in the profile will be booted
                   on ${cluster}'s hardware<p>\n";
    }

    echo "   <fieldset>\n";

    #
    # Look for non-specific error.
    #
    if ($errors && array_key_exists("error", $errors)) {
	echo "<font color=red><center>" . $errors["error"] .
	    "</center></font><br>";
    }

    #
    # Ask for user information
    #
    if (!isset($this_user)) {
	$formatter("username", 
		  "<input name=\"formfields[username]\"
		          value='" . $formfields["username"] . "'
                          class='form-control'
                          placeholder='Pick a user name'
                          autofocus type='text'>");
   
	$formatter("email", 
		  "<input name=\"formfields[email]\"
                          type='text'
                          value='" . $formfields["email"] . "'
                          class='form-control'
                          placeholder='Your email address' type='text'>");
    }
    # We put the ssh stuff in two different places, so make it a function.
    $spitsshkeystuff = function() use ($formfields, $formatter) {
	if ($formfields["sshkey"] == "") {
	    $title_text = "<span class='text-warning'>
                    No SSH key, browser shell only!<span>";
	    $expand_text = "Add Key";
	}
	else {
	    $title_text = "<span class='text-info'>
                    Your SSH key</span>";
	    $expand_text = "Update";
	}
        echo "<div class='form-group row' style='margin-bottom: 0px;'>";
        echo "  <div class='col-md-12'>
                  <div class='panel panel-default'>\n";
        echo "      <div class='panel-heading'>$title_text
                     <a class='pull-right'
                        data-toggle='collapse' href='#mysshkey'>
                      $expand_text</a>\n";
        echo "      </div>\n";
	echo "      <div id='mysshkey' class='panel-collapse collapse'>\n";
        echo "       <div class='panel-body'>";
	
	$formatter("keyfile",
		   "<span class='help-block'>
                     Upload a file or paste it in the text box. This will ".
		   "allow you to login using your favorite ssh client. Without ".
		   "a SSH key, you will be limited to using a shell window in ".
		   "your browser. If you already see a key here, you can ".
		   "change it and we will remember your new key for next time. ".
                   "Don't know how to generate your SSH key? ".
		   "See <a href='https://help.github.com/articles/generating-ssh-keys'>this tutorial.</a></span>".
		   "<input type=file name='keyfile'>");

	$formatter("sshkey", 
		  "<textarea name=\"formfields[sshkey]\" 
                             placeholder='Paste in your ssh public key.'
                             class='form-control'
                             rows=4 cols=45>" . $formfields["sshkey"] .
                  "</textarea>");

        echo "       </div>";
        echo "       <div class='clearfix'></div>";
        echo "      </div>";
        echo "    </div>";
        echo "</div></div>"; # End of panel/row.
    };
    if (!isset($this_user)) {
	$spitsshkeystuff();
    }

    #
    # Only print profile selection box if we weren't linked to a specific
    # profile
    #
    if (!isset($profile)) {
        echo "<div class='form-group row' style='margin-bottom: 0px;'>";
        echo "<input id='selected_profile' type='hidden' 
                       name='formfields[profile]'/>";
        echo "<div class='col-md-12'><div class='panel panel-default'>\n";
        echo "<div class='panel-heading'>
                  <span class='panel-title'><strong>Selected Profile:</strong> 
                  <span id='selected_profile_text'>
                  </span></span>\n";
        if ($errors && array_key_exists("profile", $errors)) {
            echo "<label class='control-label' for='inputError'>" .
                $errors["profile"] .
                " </label>\n";
        }
        echo " </div>\n";
        # Note: Following line is also duplicated above
        echo "<div class='panel-body'>";
        echo "  <div id='selected_profile_description'></div>\n";
        echo "</div>";
        echo "<div class='panel-footer'>";
        if (isset($this_user) && !$this_user->webonly()) {
            echo "<button class='btn btn-default btn-sm pull-left' 
                         type='button' id='profile_copy_button'
                         style='margin-right: 10px;'
		    data-toggle='popover'
		    data-delay='{hide:1500, show:500}'
		    data-html='true'
		    data-content='When you copy a profile
		    you are creating a new profile that
		    uses the same source code and metadata (description,
		    instructions) as the original profile, but without
		    creating a new disk image. Instead, the new profile uses
		    whatever images the original profile uses.'>Copy Profile
                  </button>";
            echo "<button class='btn btn-default btn-sm pull-left'
                          type='button' id='profile_show_button'>
                    Show Profile
                  </button>";
        }
        echo "<button id='profile' class='btn btn-primary btn-sm pull-right' 
                         type='button' name='profile_button'>
                    Change Profile
                  </button>";
        echo "<div class='clearfix'></div>";
        echo "</div>";
        echo "</div></div></div>"; # End of panel/row.
    }
    else {
	echo "<input id='selected_profile' type='hidden'
                     name='formfields[profile]'
                     value='" . $formfields["profile"] . "'>\n";

	# Send the original argument for the initial array stuff above.
        # Needs more work.
        $thisuuid = $profile->uuid();
	echo "<input type='hidden' name='profile' value='$thisuuid'>\n";
    }
    if (isset($this_user) && !$this_user->webonly()) {
        echo "<div class='panel panel-info'>\n";
        echo "  <div class='panel-body bg-info' style='padding: 5px;'>\n";
        #
        # Local users, show a link to the ssh keys page.
        # Nonlocal users, remind them ssh keys go into their portal.
        #
        if ($this_user->IsNonLocal()) {
            echo "<div>";
            echo "  <div>
                    GENI Users; be sure to add ssh keys at <b>your</b> portal if
                    you want to log in from your desktop, else you
	            will be limited to using a shell window in your browser. 
                    </div>
                  </div>\n";
        }
        else {
            echo "<div>";
            echo "  <div>
                     <a href='ssh-keys.php'>Manage your SSH keys</a> if
                     you want to log in from your desktop, else you
		     will be limited to using a shell window in your browser. 
                    </div>
                  </div>\n";
        }
        echo "  </div>\n";
        echo "</div>\n";
    }

    #
    # Spit out an experient name box, which is optional and prefilled
    # with a default.
    #
    if ($this_user && ISADMIN()) {
        $thisclass = "form-group";
        if ($errors && array_key_exists("name", $errors)) {
            $thisclass .= " has-error";
        }
        echo "<div class='form-horizontal'>
                <div class='$thisclass'>
                  <label class='col-sm-4 control-label'
                         style='text-align: right;'>Name:</label>
                  <div class='col-sm-6'
                       data-toggle='popover'
		       data-delay='{hide:1500, show:500}'
		       data-html='true'
		       data-content='Provide a unique name to identity your
                           new experiment. If you are in
                           the habit of starting more then one experiment at
                           a time this is really handy when trying to tell
                           one experiment from another, or when referring to
                           an experiment when asking for help.'>
                    <input id='experiment_name'
                           placeholder='Optional'
                           class='form-control'
                           name='formfields[name]'
                           value='" . $formfields["name"] . "'>\n";
        if ($errors && array_key_exists("name", $errors)) {
            echo "  <label class='control-label'>". $errors["name"] . "</label>";
        }
        echo "    </div>
                </div>
              </div>\n";
    }
     
    #
    # Spit out a project selection list if more then one project membership
    #
    if ($this_user && !$this_user->webonly()) {
        if (count($projlist) == 1) {
            echo "<input id='profile_pid' type='hidden'
                     name='formfields[pid]'
                     value='" . $formfields["pid"] . "'>\n";
        }
        else {
            $project_options = "";
            while (list($pid) = each($projlist)) {
                $selected = "";
                if ($formfields["pid"] == $pid) {
                    $selected = "selected";
                }
                $project_options .= 
                    "<option $selected value='$pid'>$pid</option>\n";
            }
            $html =
                "<div class='form-horizontal'><div class='form-group'>
                   <label class='col-sm-4 control-label'
                      style='text-align: right;'>Project:</label>
                   <div class='col-sm-6'>
                       <select name=\"formfields[pid]\"
		              id='profile_pid' class='form-control'>
                       $project_options</select></div></div></div>\n";
            echo $html;
        }
    }

    if (isset($this_user) && !$this_user->webonly() && 
        ($ISCLOUD || ISADMIN() || STUDLY())) {
	$am_options = "";
	while (list($am, $urn) = each($am_array)) {
	    $amlist[] = $am;
	    $selected = "";
	    if ($formfields["where"] == $am) {
		$selected = "selected";
	    }
	    $am_options .= 
		"<option $selected value='$am'>$am</option>\n";
	}
        $html = "<div id='aggregate_selector'>
                  <div class='form-horizontal' id='nosite_selector'>
                   <div class='form-group'>
                   <label class='col-sm-4 control-label'
                      style='text-align: right;'>
       <a href=cluster-status.php target=_blank>Cluster:</a></label>
                   <div class='col-sm-6'>
                       <select name=\"formfields[where]\"
		              id='profile_where' class='form-control'>
                       $am_options</select><br>
		       <div class='alert alert-warning' id='where-warning' style='display: none'>This profile only works on some clusters. Incompatible clusters are unselectable.</div>
</div></div></div>";
        $html = $html . "<div id='site_selector' class='hidden'></div></div>";
        echo $html;
    }
    echo "</fieldset>
           <div class='form-group row'>
           <div class='col-sm-6 col-sm-offset-3'>
           <button class='btn btn-primary btn-block hidden'
              id='configurator_button'
              type='button'>Configure
           </button>
           <button class='btn btn-success btn-block' id='instantiate_submit'
              type='submit' name='create'>Create!
           </button>
           </div>
           </div>
        </div>\n";
    if (!isset($this_user)) {
        echo "</div>
              </div>\n";
	SpitVerifyModal("verify_modal", "Create");
    
	if ($newuser) {
	    if (is_string($newuser)) {
		$stuffing = $newuser;
	    }
	    else {
		$stuffing = substr(GENHASH(), 0, 16);
	    }
	    mail($formfields["email"],
		 "aptlab.net: Verification code for creating your experiment",
		 "Here is your user verification code. Please copy and\n".
		 "paste this code into the box on the experiment page.\n\n".
		 "      $stuffing\n",
		 "From: $APTMAIL");
	    echo "<input type='hidden' name='stuffing' value='$stuffing' />";
	}
    }
    echo "</div>\n";
    # This is for a PP rspec.
    echo "<textarea name='formfields[pp_rspec]'
		    id='pp_rspec_textarea'
                    class='form-control hidden'
                    type='textarea'></textarea>\n";
    echo "</form>\n";

    SpitTopologyViewModal("quickvm_topomodal", $profile_array);
    echo "<div id='waitwait_div'></div>\n";
    echo "<div id='ppmodal_div'></div>\n";
    echo "<div id='instantiate_div'></div>\n";
    echo "<div id='editmodal_div'></div>\n";
    SpitOopsModal("oops");

    if (isset($this_user) && !$this_user->webonly() &&
        ($ISCLOUD || ISADMIN() || STUDLY())) {
	echo "<script type='text/plain' id='amlist-json'>\n";
	echo htmlentities(json_encode($amlist));
	echo "</script>\n";
    }
    echo "<script type='text/javascript'>\n";
    echo "    window.PROFILE    = '" . $formfields["profile"] . "';\n";
    echo "    window.AJAXURL    = 'server-ajax.php';\n";
    echo "    window.SHOWABOUT  = $showabout;\n";
    echo "    window.NOPPRSPEC  = $nopprspec;\n";
    echo "    window.REGISTERED = $registered;\n";
    echo "    window.WEBONLY    = $webonly;\n";
    echo "    window.PORTAL     = '$portal';\n";
    if ($newuser) {
	echo "window.APT_OPTIONS.isNewUser = true;\n";
    }
    echo "</script>\n";
    echo "<script src='js/lib/jquery-2.0.3.min.js'></script>\n";
    echo "<script src='js/lib/bootstrap.js'></script>\n";
    echo "<script src='js/lib/require.js' data-main='js/instantiate'></script>";
}

if (!isset($create)) {
    $defaults = array();
    $defaults["username"] = "";
    $defaults["email"]    = "";
    $defaults["sshkey"]   = "";
    $defaults["profile"]  = (isset($profile) ?
                             $profile->uuid() : $profile_default);
    $defaults["where"]    = $DEFAULT_AGGREGATE;
    if ($this_user && count($projlist)) {
	list($project, $grouplist) = each($projlist);
        $defaults["pid"] = $project;
        reset($projlist);
    }
    else {
        $defaults["pid"] = "";
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
    SPITFORM($defaults, false, array());
    echo "<div style='display: none'><div id='jacks-dummy'></div></div>\n";
    SPITFOOTER();
    return;
}
#
# Otherwise, must validate and redisplay if errors
#
$errors = array();
$args   = array();

if (!$this_user) {
    #
    # These check do not matter for a logged in user; we ignore the values.
    #
    if (!isset($formfields["email"]) || $formfields["email"] == "") {
	$errors["email"] = "Missing Field";
    }
    elseif (! TBvalid_email($formfields["email"])) {
	$errors["email"] = TBFieldErrorString();
    }
    if (!isset($formfields["username"]) || $formfields["username"] == "") {
	$errors["username"] = "Missing Field";
    }
    elseif (! TBvalid_uid($formfields["username"])) {
	$errors["username"] = TBFieldErrorString();
    }
    elseif (User::LookupByUid($formfields["username"])) {
        # Do not allow uid overlap with real users.
	$errors["username"] = "Already in use - if you have an Emulab account, log in first";
    }
}
if (!isset($formfields["profile"]) || $formfields["profile"] == "") {
    $errors["profile"] = "No selection made";
}
elseif (! array_key_exists($formfields["profile"], $profile_array)) {
    $errors["profile"] = "Invalid Profile: " . $formfields["profile"];
}
else {
    $profile = Profile::Lookup($formfields["profile"]);
    if (!$profile) {
	$errors["profile"] = "No such profile in the database";
    }
}

if ($this_user) {
    #
    # Project has to exist.  
    #
    $project = Project::LookupByPid($formfields["pid"]);
    if (!$project) {
        $errors["pid"] = "No such project";
    }
    # User better be a member.
    elseif (!ISADMIN() &&
        (!$project->IsMember($this_user, $isapproved) || !$isapproved)) {
        $errors["pid"] = "Illegal project";
    }
    else {
        $args["pid"] = $project->pid_idx();
    }

    # Experiment name is optional, we generate one later.
    if (isset($formfields["name"]) && $formfields["name"] != "") {
        if (strlen($formfields["name"]) > 16) {
            $errors["name"] = "Too long; must be <= 16 characters";
        }
        elseif (!TBvalid_eid($formfields["name"])) {
            $errors["name"] = TBFieldErrorString();
        }
        elseif ($project &&
                Instance::LookupByName($project, $formfields["name"])) {
            $errors["name"] = "Already in use by another experiment";
        }
        else {
            $args["instance_name"] = $formfields["name"];
        }
    }
}

#
# More sanity checks. 
#
if (!$this_user) {
    $geniuser = GeniUser::LookupByEmail("sa", $formfields["email"]);
    if ($geniuser) {
	if ($geniuser->name() != $formfields["username"]) {    
            $errors["email"] = "Already in use by another guest user";
	    unset($geniuser);
	}
    }
}

#
# Real users are allowed to use Paramterized Profiles, which means
# we could get an rspec.
#
if ($profile && $profile->isParameterized() && 
    $this_user && !$this_user->IsNonLocal() &&
    isset($formfields["pp_rspec"]) && $formfields["pp_rspec"] != "") {
    $args["rspec"] = $formfields["pp_rspec"];
}

#
# Allow admin users to select the Aggregate. Experimental.
#
$aggregate_urn = "";
$sitemap = array();

if ($this_user && ($ISCLOUD || ISADMIN() || STUDLY())) {
    if (isset($formfields["sites"]) && is_array($formfields["sites"])) {
        while (list($siteid, $am) = each($formfields["sites"])) {
            if (array_key_exists($am, $am_array)) {
                $sitemap[$siteid] = $am_array[$am];
            }
            else {
                $errors["sites"] = "Invalid Aggregate";
                break;
            }
        }
    }
    elseif (isset($formfields["where"]) &&
            $formfields["where"] != "" &&
            array_key_exists($formfields["where"], $am_array)) {
	    $aggregate_urn = $am_array[$formfields["where"]];
    }
    else {
        $errors["where"] = "Invalid Aggregate";
    }
}
if (count($errors)) {
    SPITFORM($formfields, false, $errors);
    SPITFOOTER();
    return;
}

#
# SSH keys are now optional for guest users; they just have to
# use the web based ssh window.
#
# Backend verifies pubkey and returns error. We first look for a 
# file and then fall back to an inline field.
#
if (isset($_FILES['keyfile']) &&
    $_FILES['keyfile']['name'] != "" &&
    $_FILES['keyfile']['name'] != "none") {

    $localfile = $_FILES['keyfile']['tmp_name'];
    $args["sshkey"] = file_get_contents($localfile);
    #
    # The filename will be lost on another trip through the browser.
    # So stick the key into the box.
    #
    $formfields["sshkey"] = $args["sshkey"];
}
elseif (isset($formfields["sshkey"]) && $formfields["sshkey"] != "") {
    $args["sshkey"] = $formfields["sshkey"];
}

if (count($errors)) {
    SPITFORM($formfields, false, $errors);
    SPITFOOTER();
    return;
}
# Silently ignore the form for a logged in user. 
$args["username"] = ($this_user ? $this_user->uid() : $formfields["username"]);
$args["email"]    = ($this_user ? $this_user->email() : $formfields["email"]);
$args["profile"]  = $formfields["profile"];

#
# See if user exists and is verified. We send email with a code, which
# they have to paste back into a box we add to the form. See above.
#
# We also get here if the user exists, but the browser did not have
# the tokens, as will happen if switching to another browser. We
# force the user to repeat the verification with the same code we
# have stored in the DB.
#
if (!$this_user &&
    (!$geniuser || !isset($_COOKIE['quickvm_authkey']) ||
     $_COOKIE['quickvm_authkey'] != $geniuser->auth_token())) {
    if (isset($stuffing) && $stuffing != "") {
	if (! (isset($verify) && $verify == $stuffing)) {
	    SPITFORM($formfields, $stuffing, $errors);
	    SPITFOOTER();
	    return;
	}
	#
	# If this is an existing user and they give us the right code,
	# we can check again for an existing VM and redirect to the
	# status page, like we do above.
	#
	if ($geniuser) {
	    $instance = Instance::LookupByCreator($geniuser->uuid());
	    if ($instance && $instance->status() != "terminating") {
		# Reset this cookie so status page is happy and so we
                # will stop asking.
		setcookie("quickvm_user",
			  $geniuser->uuid(), time() + (24 * 3600 * 30),
			  "/", $TBAUTHDOMAIN, 0);
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
	}
	# Pass to backend to save in user object.
	$args["auth_token"] = $stuffing;
    }
    else {
	# Existing user, use existing auth token.
	# New user, we create a new one.
	$token = ($geniuser ? $geniuser->auth_token() : true);

	SPITFORM($formfields, $token, $errors);
	SPITFOOTER();
	return;
    }
}

# Admins can change aggregate.
$options = "";

if ($aggregate_urn != "") {
    $options = " -a '$aggregate_urn'";
}
elseif (count($sitemap)) {
    while (list($siteid, $urn) = each($sitemap)) {
        $options .= "--site 'site:${siteid}=${urn}' ";
    }
}

#
# Invoke the backend.
#
list ($instance, $creator) =
    Instance::Instantiate($this_user, $options, $args, $errors);

if (!$instance) {
    SPITFORM($formfields, false, $errors);
    SPITFOOTER();
    return;
}
    
#
# Remember the user and auth key so that we can verify.
#
# The cookie handling is a pain since we run this under the aptlab
# virtual host, but the config uses a different domain, and so the
# cookies do not work. So, we have to look at our SERVER_NAME and
# set the cookie appropriately. 
#
if (!$this_user) {
    $cookiedomain = $TBAUTHDOMAIN;

    setcookie("quickvm_user",
	      $creator->uuid(), time() + (24 * 3600 * 30),
	      "/", $cookiedomain, 0);
    setcookie("quickvm_authkey",
	      $creator->auth_token(), time() + (24 * 3600 * 30),
	      "/", $cookiedomain, 0);
}
header("Location: status.php?uuid=" . $instance->uuid());
?>
