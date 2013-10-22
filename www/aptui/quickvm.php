<?php
#
# Copyright (c) 2000-2013 University of Utah and the Flux Group.
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
chdir("apt");
include("quickvm_sup.php");

#
# Verify page arguments.
#
$optargs = OptionalPageArguments("create",      PAGEARG_STRING,
				 "username",    PAGEARG_STRING,
				 "email",	PAGEARG_STRING,
				 "imageid",     PAGEARG_STRING,
				 "stuffing",    PAGEARG_STRING,
				 "verify",      PAGEARG_STRING,
				 "sshkey",	PAGEARG_STRING);

# Form defaults.
$username_default = "Pick a user name";
$email_default    = "Your email address";
$sshkey_default   = "Your SSH public key";
$imageid_default  = "UBUNTU12-64-STD";

$imageid_array = array($imageid_default => "UBUNTU 12.04 LTS",
		       "FBSD90-STD"   => "FreeBSD 9.0",
		       "FEDORA15-STD" => "Fedora 15");

function SPITFORM($username, $email, $sshkey, $imageid, $newuser, $errors)
{
    global $TBBASE, $TBMAIL_OPS;
    global $username_default, $email_default, $sshkey_default;
    global $imageid_default, $imageid_array;

    $username_value   = "";
    $email_value      = "";
    $sshkey_value     = "";
    $imageid_value    = "";
    $username_error   = "";
    $email_error      = "";
    $sshkey_error     = "";
    $imageid_error    = "";
    $internal_error   = null;

    if (isset($username) && $username != "") {
	$username_value = CleanString($username);
    }
    if (isset($email) && $email != "") {
	$email_value = CleanString($email);
    }
    if (isset($sshkey) && $sshkey != "") {
	$sshkey_value = CleanString($sshkey);
    }
    if (isset($imageid) && $imageid != "") {
	$imageid_value = CleanString($imageid);
    }
    if ($errors) {
	while (list ($name, $message) = each ($errors)) {
	# XSS prevention.
	    $message = CleanString($message);
	    if ($name == "username")
		$username_error = $message;
	    elseif ($name == "email")
		$email_error = $message;
	    elseif ($name == "sshkey")
		$sshkey_error = $message;
	    elseif ($name == "imageid")
		$imageid_error = $message;
	    elseif ($name == "internal") {
		$internal_error = $message;
	    }
	}
    }
    SPITHEADER();

    if ($internal_error) {
	echo "<center><h2>$internal_error</h2></center><br>\n";
    }

    echo "<form id='quickvm_form' class='uk-form uk-form-stacked'
            method='post' action='quickvm.php'>\n";
    echo "<div class='uk-panel uk-panel-box uk-panel-header
            uk-container-center uk-margin-bottom uk-width-1-3'>
        <h3 class='uk-panel-title'><i class='uk-icon-laptop'></i>
            Create an Experiment</h3>
            <div class='uk-form-row'>
               <div class='uk-form-controls'>
                <input name='username' id='username'
                       value='$username_value'
                       class='uk-width-100'
                       placeholder='$username_default' autofocus type='text'>
               </div>
		<label class='uk-form-label uk-text-small'
                       style='color: red'
                       for='username'>$username_error</label>
            </div>
            <div class='uk-form-row'>
               <div class='uk-form-controls'>
                <input name='email' id='email'
                       value='$email_value'
                       class='uk-width-100'
                       placeholder='$email_default' type='text' />
               </div>
		<label class='uk-form-label uk-text-small'
                       style='color: red'
                       for='email'>$email_error</label>
            </div>
            <div class='uk-form-row'>
               <div class='uk-form-controls'>
                <textarea id='sshkey' name='sshkey'
                          placeholder='$sshkey_default'
                          class='uk-width-100'
                          rows=5 cols=45>$sshkey_value</textarea>
               </div>
		<label class='uk-form-label uk-text-small'
                       style='color: red'
                       for='sshkey'>$sshkey_error</label>
            </div>
            <div class='uk-form-row'>
              <div class='uk-form-controls'>
                <select class='uk-align-left' name='imageid'>
                <option value=''>Select Profile</option>\n";
    while (list ($id, $title) = each ($imageid_array)) {
	$selected = "";
	
	if ($imageid_value == $id)
	    $selected = "selected";
	
	echo "<option $selected value='$id'>$title </option>\n";
    }
    echo "       </select>
               </div>
	        <label class='uk-form-label uk-text-small'
                       style='color: red'
                       for='imageid'>$imageid_error</label>
            </div>
            <div class='uk-form-row'>
            <button class='uk-button uk-button-primary uk-button-mini
                           uk-align-left'
	            type='button' name='reset'
                    onclick='formReset(); return false;'>
                    Reset Form</button>
            <button class='uk-button uk-button-primary uk-align-right'
	            type='submit' name='create'>Create!
	          <i class='uk-icon-chevron-sign-right'></i></button>
            </div>
        </div>\n";

    echo "<!-- This is the modal -->
          <div id='working' class='uk-modal'>
            <div class='uk-modal-dialog'>
                <a class='uk-modal-close uk-close'></a>
                <div class='uk-panel uk-panel-box'>
                    <h3 class='uk-panel-title'><span class='uk-text-warning'>
                    <i class='uk-icon-warning-sign'></i> Important</a></h3>
                    <p>Check your email for a verification code, and
                       enter it here:</p>
                        <input name='verify'
                               class='uk-form-width-medium'
                               placeholder='Verification code'
                               autofocus type='text' />
                        <button class='uk-button uk-button-primary'
                            type='submit' name='create'>
                            Create<i class='uk-icon-check-sign'>
                          </i></button>
                    </div>
            </div>
         </div>\n";

    if ($newuser) {
	if (is_string($newuser)) {
	    $stuffing = $newuser;
	}
	else {
	    $stuffing = substr(GENHASH(), 0, 16);
	}
	mail($email, "Confirm your email to create your Experiment",
	     "Here is your user verification code. Please copy and\n".
	     "paste this code into the box on the experiment page.\n\n".
	     "      $stuffing\n",
	     "From: $TBMAIL_OPS");
	echo "<input type='hidden' name='stuffing' value='$stuffing' />";
    }
    echo "</form>\n";

    echo "<SCRIPT LANGUAGE=JavaScript>\n";
    if ($newuser) {
	echo "ShowModal('#working');\n";
    }
    echo "function formReset()
          {
              resetForm($('#quickvm_form'));
          }
          </SCRIPT>\n";
}

if (!isset($create)) {
    #
    # Look for cookie that tells us who the user is. 
    #
    $username = null;
    $email    = null;
    $sshkey   = null;
    
    if (isset($_COOKIE['quickvm_user'])) {
	$geniuser = GeniUser::Lookup("sa", $_COOKIE['quickvm_user']);
	if ($geniuser) {
	    #
	    # Look for existing quickvm. User not allowed to create
	    # another one.
	    #
	    $quickvm = QuickVM::LookupByCreator($geniuser->uuid());
	    if ($quickvm && $quickvm->status() != "terminating") {
		header("Location: quickvm_status.php?uuid=" . $quickvm->uuid());
		return;
	    }
	    $username = $geniuser->name();
	    $email    = $geniuser->email();
	    $sshkey   = $geniuser->SSHKey();
	}
    }
    SPITFORM($username, $email, $sshkey, null, false, null);
    SPITFOOTER();
    return;
}
#
# Otherwise, must validate and redisplay if errors
#
$errors = array();
$args   = array();

if (!isset($email) || $email == "" || $email == $email_default) {
    $errors["email"] = "Missing Field";
}
elseif (! TBvalid_email($email)) {
    $errors["email"] = TBFieldErrorString();
}

if (!isset($username) || $username == "" || $username == $username_default) {
    $errors["username"] = "Missing Field";
}
elseif (! TBvalid_uid($username)) {
    $errors["username"] = TBFieldErrorString();
}
elseif (User::LookupByUid($username)) {
    # Do not allow uid overlap with real users.
    $errors["username"] = "Already in use";
}

if (!isset($imageid) || $imageid == "") {
    $errors["imageid"] = "No selection made";
}
elseif (! array_key_exists($imageid, $imageid_array)) {
    $errors["imageid"] = "Invalid Profile: $imageid";
}
elseif (! OSinfo::LookupByName($TBOPSPID, $imageid)) {
    $errors["imageid"] = "Nonexistant Profile: $imageid";
}

if (count($errors)) {
    SPITFORM($username, $email, $sshkey, $imageid, false, $errors);
    SPITFOOTER();
    return;
}

#
# More sanity checks. 
#
$exists = GeniUser::LookupByEmail("sa", $email);
if ($exists) {
    if ($exists->name() != $username) {    
	$errors["email"] = "Already in use by another user";
	unset($exists);
    }
}
# Existing users are allowed to resuse their ssh key, but can supply
# a new one if they want.
if (!isset($sshkey) || $sshkey == "" || $sshkey == $sshkey_default) {
    if (!$exists) {
	$errors["sshkey"] = "Missing Field";
    }
}
else {
    $args["sshkey"] = $sshkey;
}

if (count($errors)) {
    SPITFORM($username, $email, $sshkey, $imageid, false, $errors);
    SPITFOOTER();
    return;
}
$args["username"] = $username;
$args["email"]    = $email;
$args["imageid"]  = $imageid;

#
# See if user exists and is verified. We send email with a code, which
# they have to paste back into a box we add to the form. See above.
#
# We also get here if the user exists, but the browser did not have
# the tokens, as will happen if switching to another browser. We
# force the user to repeat the verification with the same code we
# have stored in the DB.
#
if (!$exists || !isset($_COOKIE['quickvm_authkey']) ||
    $_COOKIE['quickvm_authkey'] != $exists->auth_token()) {
    if (isset($stuffing) && $stuffing != "") {
	if (! (isset($verify) && $verify == $stuffing)) {
	    SPITFORM($username, $email, $sshkey, $imageid, $stuffing, $errors);
	    SPITFOOTER();
	    return;
	}
	#
	# If this is an existing user and they give us the right code,
	# we can check again for an existing VM and redirect to the
	# status page, like we do above.
	#
	if ($exists) {
	    $quickvm = QuickVM::LookupByCreator($exists->uuid());
	    if ($quickvm && $quickvm->status() != "terminating") {
		header("Location: quickvm_status.php?uuid=" . $quickvm->uuid());
		return;
	    }
	}
	# Pass to backend to save in user object.
	$args["auth_token"] = $stuffing;
    }
    else {
	# Existing user, use existing auth token.
	# New user, we create a new one.
	$token = ($exists ? $exists->auth_token() : true);

	SPITFORM($username, $email, $sshkey, $imageid, $token, $errors);
	SPITFOOTER();
	return;
    }
}

# This is so we can look up the slice after the backend creates it.
$args["name"] = substr(GENHASH(), 0, 16);

#
# Generate a temporary file and write in the XML goo. 
#
$xmlname = tempnam("/tmp", "quickvm");
if (! $xmlname) {
    TBERROR("Could not create temporary filename", 0);
    $errors["internal"] = "Transient error(1); please try again later.";
}
elseif (! ($fp = fopen($xmlname, "w"))) {
    TBERROR("Could not open temp file $xmlname", 0);
    $errors["internal"] = "Transient error(2); please try again later.";
}
else {
    fwrite($fp, "<quickvm>\n");
    foreach ($args as $name => $value) {
	fwrite($fp, "<attribute name=\"$name\">");
	fwrite($fp, "  <value>" . htmlspecialchars($value) . "</value>");
	fwrite($fp, "</attribute>\n");
    }
    fwrite($fp, "</quickvm>\n");
    fclose($fp);
    chmod($xmlname, 0666);
}
if (count($errors)) {
    SPITFORM($username, $email, $sshkey, $imageid, false, $errors);
    SPITFOOTER();
    return;
}

#
# Invoke the backend. This will create the user and the slice record
# in the SA database, and then fork off in the background. If the
# first part works, we can return to the user and use some nifty ajax
# and javascript to watch for progress. We use a cookie that holds
# the slice uuid so that the JS code can ask about it.
#
#
$retval = SUEXEC("nobody", "nobody", "webquickvm $xmlname",
		 SUEXEC_ACTION_CONTINUE);

if ($retval != 0) {
    if ($retval < 0) {
	$errors["internal"] = "Transient error(3); please try again later.";
    }
    else {
	if (count($suexec_output_array)) {
	    $line = $suexec_output_array[$i];
	    $errors["internal"] = $line;
	}
	else {
	    $errors["internal"] = "Transient error(4); please try again later.";
	}
    }
    SPITFORM($username, $email, $sshkey, $imageid, false, $errors);
    SPITFOOTER();
    return;
}
unlink($xmlname);

$quickvm = QuickVM::LookupByName($args["name"]);
if (!$quickvm) {
    $errors["internal"] = "Transient error(5); please try again later.";
    SPITFORM($username, $email, $sshkey, $imageid, false, $errors);
    SPITFOOTER();
    return;
}
$creator = GeniUser::Lookup("sa", $quickvm->creator_uuid());
if (! $creator) {
    $errors["internal"] = "Transient error(6); please try again later.";
    SPITFORM($username, $email, $sshkey, $imageid, false, $errors);
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
if (stristr($_SERVER["SERVER_NAME"], $TBAUTHDOMAIN)) {
    $cookiedomain = $TBAUTHDOMAIN;
}
else {
    $cookiedomain = $_SERVER["SERVER_NAME"];
}
    
setcookie("quickvm_user",
	  $creator->uuid(), time() + (24 * 3600 * 30),
	  "/", $cookiedomain, 0);
setcookie("quickvm_authkey",
	  $creator->auth_token(), time() + (24 * 3600 * 30),
	  "/", $cookiedomain, 0);

header("Location: quickvm_status.php?uuid=" . $quickvm->uuid());
?>
