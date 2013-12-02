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
$dblink = GetDBLink("sa");

#
# Verify page arguments.
#
$optargs = OptionalPageArguments("create",      PAGEARG_STRING,
				 "username",    PAGEARG_STRING,
				 "email",	PAGEARG_STRING,
				 "profile",     PAGEARG_STRING,
				 "stuffing",    PAGEARG_STRING,
				 "verify",      PAGEARG_STRING,
				 "sshkey",	PAGEARG_STRING,
				 "ajax_request",  PAGEARG_BOOLEAN,
				 "ajax_method",   PAGEARG_STRING,
				 "ajax_argument", PAGEARG_STRING);

#
# Deal with ajax requests.
#
if (isset($ajax_request)) {
    if ($ajax_method == "getprofile") {
	$profile_name = addslashes($ajax_argument);
	$query_result =
	    DBQueryWarn("select * from quickvm_rspecs ".
			"where name='$profile_name'", $dblink);

	if (!$query_result || !mysql_num_rows($query_result)) {
	    SPITAJAX_ERROR(1, "No such profile!");
	    exit();
	}
	$row = mysql_fetch_array($query_result);
	
	SPITAJAX_RESPONSE(array('rspec' => $row['rspec'],
				'name'  => $row['name'],
				'description' => $row['description']));
    }
    exit();
}

# Form defaults.
$username_default = "Pick a user name";
$email_default    = "Your email address";
$sshkey_default   = "Your SSH public key";
$profile_default  = "UBUNTU12-64-STD";
$profile_array    = array();

$query_result =
    DBQueryFatal("select * from quickvm_rspecs", $dblink);
while ($row = mysql_fetch_array($query_result)) {
    $profile_array[$row["name"]] = $row["name"];
}

function SPITFORM($username, $email, $sshkey, $profile, $newuser, $errors)
{
    global $TBBASE, $TBMAIL_OPS;
    global $username_default, $email_default, $sshkey_default;
    global $profile_default, $profile_array;

    $username_value   = "";
    $email_value      = "";
    $sshkey_value     = "";
    $profile_value    = "";
    $username_error   = "";
    $email_error      = "";
    $sshkey_error     = "";
    $profile_error    = "";
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
    if (isset($profile) && $profile != "") {
	$profile_value = CleanString($profile);
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
	    elseif ($name == "profile")
		$profile_error = $message;
	    elseif ($name == "internal") {
		$internal_error = $message;
	    }
	}
    }
    SPITHEADER(1);

    if ($internal_error) {
	echo "<center><h2>$internal_error</h2></center><br>\n";
    }

    echo "<div class='row'>
          <div class='col-lg-6  col-lg-offset-3
                      col-md-6  col-md-offset-3
                      col-sm-8  col-sm-offset-2
                      col-xs-12 col-xs-offset-0'>\n";
    echo "<form id='quickvm_form' role='form'
            method='post' action='quickvm.php'>\n";
    echo "<div class='panel panel-default'>
           <div class='panel-heading'>
              <h3 class='panel-title'>
                 Create an Experiment</h3></div>
           <div class='panel-body'>
            <div class='form-group'>
                <input name='username' id='username'
                       value='$username_value'
                       class='form-control'
                       placeholder='$username_default' autofocus type='text'>
		<label style='color: red'
                       for='username'>$username_error</label>
            </div>
            <div class='form-group'>
                <input name='email' id='email' type='text'
                       value='$email_value'
                       class='form-control'
                       placeholder='$email_default' type='text' />
		<label 
                       style='color: red'
                       for='email'>$email_error</label>
            </div>
            <div class='form-group'>
                <textarea id='sshkey' name='sshkey'
                          placeholder='$sshkey_default'
                          class='form-control'
                          rows=4 cols=45>$sshkey_value</textarea>
		<label
                       style='color: red'
                       for='sshkey'>$sshkey_error</label>
            </div>
            <div class='form-group'>
                <select class='pull-left' id='profile_name'
                        name='profile'
                        onChange='ShowProfile(0);'>
                <option value=''>Select Profile</option>\n";
    while (list ($id, $title) = each ($profile_array)) {
	$selected = "";
	
	if ($profile_value == $id)
	    $selected = "selected";
	
	echo "<option $selected value='$id'>$title </option>\n";
    }
    echo "       </select>
	        <label
                       style='color: red'
                       for='profile'>$profile_error</label>
            </div>
            <button class='btn btn-primary pull-right'
	            type='submit' name='create'>Create!
	          </button>
            <br> 
            <button class='btn btn-primary btn-xs pull-left'
	            type='button' name='reset'
                    onclick='formReset(); return false;'>
                    Reset Form</button>
        </div>
        </div>
        </div>
        </div>\n";

    if (1) {
    echo "<!-- This is the user verify modal -->
          <div id='working' class='modal fade'>
            <div class='modal-dialog'>
            <div class='modal-content'>
               <div class='modal-header'>
                <button type='button' class='close' data-dismiss='modal'
                   aria-hidden='true'>&times;</button>
                <h3>Important</h3>
               </div>
               <div class='modal-body'>
                    <p>Check your email for a verification code, and
                       enter it here:</p>
                        <input name='verify'
                               placeholder='Verification code'
                               autofocus type='text' />
                        <button class='btn btn-primary'
                            type='submit' name='create'>
                            Create</button>
               </div>
            </div>
            </div>
         </div>\n";
    }

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

    echo "<!-- This is the topology view modal -->
          <div id='quickvm_topomodal' class='modal fade'>
            <div class='modal-dialog'  id='showtopo_dialog'>
            <div class='modal-content'>
               <div class='modal-header'>
                <button type='button' class='close' data-dismiss='modal'
                   aria-hidden='true'>&times;</button>
                <span id='showtopo_title'></span>
               </div>
               <div class='modal-body'>
                 <!-- This topo diagram goes inside this div -->
                 <div class='panel panel-default'
                            id='showtopo_container'>
                  <div class='panel-body'>
                   <div id='showtopo_div'></div>
                  </div>
                 </div>
	         <div id='scrollright'
                     class='pull-right' style='cursor: pointer; ".
	           "margin-bottom: 0px; margin-right: 5px;'>
                   <span class='glyphicon glyphicon-arrow-right'></span>
                 </div>
                 <div id='scrollleft'
                     class='pull-left' style='cursor: pointer; ".
	            "margin-bottom: 0px; margin-right: 5px;'>
                  <span class='glyphicon glyphicon-arrow-left'></span>
                 </div>
               </div>
               <div class='modal-footer'>
                 <span class='pull-left' id='showtopo_description'></span>
                 <div class='pull-right'>
                   <button id='showtopo_select'
                         class='btn btn-primary btn-xs'
                         type='submit' name='select'>
                            Select</button>
                 </div>
               </div>
            </div>
            </div>
         </div>\n";

    echo "<SCRIPT LANGUAGE=JavaScript>
               window.onload = InitProfileSelector;
          </SCRIPT>\n";
    echo "<script src='d3.v3.js'></script>\n";
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

if (!isset($profile) || $profile == "") {
    $errors["profile"] = "No selection made";
}
elseif (! array_key_exists($profile, $profile_array)) {
    $errors["profile"] = "Invalid Profile: $profile";
}
elseif (! in_array($profile, $profile_array)) {
    $errors["profile"] = "Nonexistant Profile: $profile";
}

if (count($errors)) {
    SPITFORM($username, $email, $sshkey, $profile, false, $errors);
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
    SPITFORM($username, $email, $sshkey, $profile, false, $errors);
    SPITFOOTER();
    return;
}
$args["username"] = $username;
$args["email"]    = $email;
$args["profile"]  = $profile;

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
	    SPITFORM($username, $email, $sshkey, $profile, $stuffing, $errors);
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

	SPITFORM($username, $email, $sshkey, $profile, $token, $errors);
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
    SPITFORM($username, $email, $sshkey, $profile, false, $errors);
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
    SPITFORM($username, $email, $sshkey, $profile, false, $errors);
    SPITFOOTER();
    return;
}
unlink($xmlname);

$quickvm = QuickVM::LookupByName($args["name"]);
if (!$quickvm) {
    $errors["internal"] = "Transient error(5); please try again later.";
    SPITFORM($username, $email, $sshkey, $profile, false, $errors);
    SPITFOOTER();
    return;
}
$creator = GeniUser::Lookup("sa", $quickvm->creator_uuid());
if (! $creator) {
    $errors["internal"] = "Transient error(6); please try again later.";
    SPITFORM($username, $email, $sshkey, $profile, false, $errors);
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
