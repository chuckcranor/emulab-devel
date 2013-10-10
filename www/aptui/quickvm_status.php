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
chdir("aptui");
include("quickvm_sup.php");

$ajax_request = 0;

#
# Verify page arguments.
#
$reqargs = OptionalPageArguments("uuid",          PAGEARG_STRING,
				 "ajax_request",  PAGEARG_BOOLEAN,
				 "ajax_method",   PAGEARG_STRING,
				 "ajax_argument", PAGEARG_STRING);
if (!isset($uuid)) {
    if ($ajax_request) {
	SPITAJAX_ERROR("must provide uuid");
	exit();
    }
    SPITHEADER(1);
    echo "<div class='tm-section tm-section-color-white'>
            <div class='uk-container uk-container-center uk-text-center'>
              <p class='uk-text-large'>
               What experiment would you like to look at?
              </p>
          </div></div>\n";
    SPITFOOTER();
    return;
}

#
# See if the quickvm exists. If not, redirect back to the create page
#
$quickvm = QuickVM::Lookup($uuid);
if (!$quickvm) {
    if ($ajax_request) {
	SPITAJAX_ERROR("no such quickvm uuid");
	exit();
    }
    SPITHEADER(1);
    echo "<div class='tm-section tm-section-color-white'>
            <div class='uk-container uk-container-center uk-text-center'>
              <p class='uk-text-large'>
               Experiment does not exist. Redirecting to the front page.
              </p>
          </div></div>\n";
    SPITFOOTER();
    flush();
    sleep(3);
    PAGEREPLACE("quickvm.php");
    return;
}
$creator = GeniUser::Lookup("sa", $quickvm->creator_uuid());
if (!$creator) {
    if ($ajax_request) {
	SPITAJAX_ERROR("no such quickvm uuid");
	exit();
    }
    SPITHEADER(1);
    echo "<div class='tm-section tm-section-color-white'>
            <div class='uk-container uk-container-center uk-text-center'>
              <p class='uk-text-large'>
               Hmm, there seems to be a problem.
              </p>
          </div></div>\n";
    SPITFOOTER();
    TBERROR("No creator for quickvm $uuid", 0);
    return;
}
$slice = GeniSlice::Lookup("sa", $quickvm->slice_uuid());
if (!$slice) {
    if ($ajax_request) {
	SPITAJAX_ERROR("no such quickvm uuid");
	exit();
    }
    SPITHEADER(1);
    echo "<div class='tm-section tm-section-color-white'>
            <div class='uk-container uk-container-center uk-text-center'>
              <p class='uk-text-large'>
               Hmm, there seems to be a problem.
              </p>
          </div></div>\n";
    SPITFOOTER();
    TBERROR("No slice for quickvm $uuid", 0);
    return;
}

#
# Deal with ajax requests.
#
if (isset($ajax_request)) {
    if ($ajax_method == "status") {
	SPITAJAX_RESPONSE($quickvm->status());
    }
    elseif ($ajax_method == "terminate") {
	SUEXEC("nobody", "nobody", "webquickvm -k $uuid",
	       SUEXEC_ACTION_IGNORE);
	SPITAJAX_RESPONSE("");
    }
    elseif ($ajax_method == "manifest") {
	SPITAJAX_RESPONSE($quickvm->manifest());
    }
    elseif ($ajax_method == "gettopomap") {
	$experiment = Experiment::LookupByUUID($slice->uuid());
	if (!$experiment) {
	    return "";
	}
	$pid = $experiment->pid();
	$eid = $experiment->eid();
	SPITAJAX_RESPONSE(GetTopoMap($creator->uid(), $pid, $eid));
    }
    elseif ($ajax_method == "gateone_authobject") {
	SPITAJAX_RESPONSE(GateOneAuthObject($creator->uid()));
    }
    elseif ($ajax_method == "request_extension") {
	TBMAIL($TBMAIL_OPS, "Request Extension", $ajax_argument);
	SPITAJAX_RESPONSE("");
    }
    elseif ($ajax_method == "extend") {
	TBMAIL($TBMAIL_OPS, "Extend", $ajax_argument);
	SPITAJAX_RESPONSE("");
    }
    exit();
}
SPITHEADER(1);

$style = "style='border: none;'";
$slice_urn       = $slice->urn();
$slice_expires   = gmdate("Y-m-d H:i:s", strtotime($slice->expires())) . " GMT";
$quickvm_status  = $quickvm->status();
$sshkey          = chunk_split($creator->SSHKey(), 40);
$creator_uid     = $creator->uid();
$creator_email   = $creator->email();
$quickvm_profile = $quickvm->profile();
$slice_url       = "";
$color           = "";
$spin            = 1;
if ($quickvm_status == "failed") {
    $color = "color=red";
    $spin  = 0;
}
elseif ($quickvm_status == "ready") {
    $color = "color=green";
    $spin  = 0;
}
elseif ($quickvm_status == "created") {
    $spinwidth = "33";
}
elseif ($quickvm_status == "provisioned") {
    $spinwidth = "66";
}

echo "<div class='uk-panel uk-panel-box uk-panel-header
           uk-container-center uk-margin-bottom uk-width-2-3'>\n";
echo "<table class='uk-table uk-table-condensed' $style>\n";
if ($spin) {
    echo "<tr>\n";
    echo "<td colspan=2 class='uk-width-5-5' $style>\n";
    echo "<div id='quickvm_spinner'>\n";
    echo " <div id='quickvm_progress'
                class='uk-progress uk-progress-striped uk-active'>\n";
    echo "  <div class='uk-progress-bar'
                 id='quickvm_progress_bar'
                 style='width: ${spinwidth}%;'></div>\n";
    echo " </div>\n";
    echo "</div>\n";
    echo "</td>\n";
    echo "</tr>\n";
}
echo "<tr>\n";
echo "<td class='uk-width-1-5' $style>URN:</td>\n";
echo "<td class='uk-width-4-5' $style>$slice_urn</td>\n";
echo "</tr>\n";
echo "<tr>\n";
echo "<td class='uk-width-1-5' $style>State:</td>\n";
echo "<td id='quickvm_status'
          class='uk-width-4-5' $style>
          <font $color>$quickvm_status</font>\n";
echo "</td>\n";
echo "</tr>\n";
echo "<tr>\n";
echo "<td class='uk-width-1-5' $style>Profile:</td>\n";
echo "<td class='uk-width-4-5' $style>$quickvm_profile</td>\n";
echo "</tr>\n";
echo "<tr>\n";
echo "<td class='uk-width-1-5' $style>Expires:</td>\n";
echo "<td class='uk-width-4-5' $style>$slice_expires - Time left: 
         <span id='quickvm_countdown'></span></td>\n";
echo "</tr>\n";
echo "</table>\n";
echo "<div class='uk-float-right'>\n";
echo "  <button class='uk-button uk-button-primary'
           id='register_button' type=button
           onclick=\"ShowModal('#register_modal'); return false;\">
           Register</button>\n";
echo "  <button class='uk-button uk-button-success'
           id='extend_button' type=button
           onclick=\"ShowModal('#extend_modal'); return false;\">
           Extend</button>\n";
echo "  <button class='uk-button uk-button-danger'
           id='terminate_button' type=button
           onclick=\"ShowModal('#terminate_modal'); return false;\">
           Terminate</button>\n";
echo "</div>\n";
echo "</div>\n";

#
# The topo diagram goes inside this div, when it becomes available.
#
echo "<div id='showtopo_div'></div>\n";

#
# A modal to tell people how to register
#
echo "<!-- This is a modal -->
      <div id='register_modal' class='uk-modal'>
        <div class='uk-modal-dialog'>
          <a href='' class='uk-modal-close uk-close'></a>
          <h3>Register for an account</h3>
          <p>If you want to design your own experiments, have more then
             one active experiment at a time, or extend the life of an
             experiment longer, you should register for a full account.
             Click on the link below to take you to the registration page.
          </p><br>
               <button class='uk-button uk-button-primary uk-align-center'
                  onclick=\"RegisterAccount('$creator_uid',
                              '$creator_email'); return false;\"
                  type='submit' name='register'>Register</button>
        </div>
      </div>\n";

#
# A modal to tell people how to extend their experiment
#
echo "<!-- This is a modal -->
      <div id='extend_modal' class='uk-modal'>
        <div class='uk-modal-dialog'>
          <a href='' class='uk-modal-close uk-close'></a>
          <div class='uk-grid uk-grid-divider' data-uk-grid-match>
            <div class='uk-width-2-3'>
                If you want to extend this experiment so that it does
                not self-terminate at the time shown, you can request an
                extension code from us. Just tell us why. A reply will
                arrive via email as soon as possible.
              <form id='extend_request_form'> 
               <div class='uk-form-controls'>
                <textarea id='why_extend' name='why_extend'
                          placeholder='Tell us a story please'
                          class='uk-width-100 uk-align-center'
                          rows=5></textarea>
               <br>
               <button class='uk-button uk-button-primary uk-button-small
                       uk-align-center'
                       onclick=\"RequestExtension('$uuid'); return false;\"
                       type='submit' name='request'>Request Extension</button>
               </div>
              </form>
            </div>
	    <div class='uk-width-1-3'>
              <form id='extend_form'>
                <center>Got your code?</center><br>
                <div class='uk-form-controls'>
                <input id='extend_code' name='extend_code' 
                    class='uk-form-width-small uk-align-center'
                    placeholder='Extension code' autofocus type='text' />
               <br>
               <button class='uk-button uk-button-primary uk-button-small
                       uk-align-center'
                       onclick=\"Extend('$uuid'); return false;\"
                       type='submit' name='extend'>Extend</button>
               </div>
              </form>
            </div>
           </div>
        </div>
      </div>\n";

#
# A modal to verify termination.
#
echo "<!-- This is a modal -->
      <div id='terminate_modal' class='uk-modal'>
        <div class='uk-modal-dialog'>
          <a href='' class='uk-modal-close uk-close'></a>
            <p>Are you sure you want to terminate this experiment? 
               Click on the button below if you are really sure.</p><br>
               <button class='uk-button uk-button-primary uk-align-center'
                  onclick=\"Terminate('$uuid', 'quickvm.php'); return false;\"
                  type='submit' name='terminate'>Terminate</button>
        </div>
      </div>\n";

if (0) {
echo "<div class='uk-panel uk-panel-box uk-panel-header
           uk-container-center'>\n";

echo "  <div id='gateone_container'
	       style='font-family: monospace'>
           <div id='gateone' style='height: 20em; font-family: monospace'>
           </div>
        </div>\n";
echo "</div>\n";
}

$location = uniqid("loc");
$auth_object = GateOneAuthObject($creator_uid);

echo "<SCRIPT LANGUAGE=JavaScript>
                 InitQuickVM('$uuid', '$location', '$auth_object');
                 StartCountdownClock('$slice_expires');
              </SCRIPT>\n";

SPITFOOTER();
?>
