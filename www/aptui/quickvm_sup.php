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
function SPITHEADER($thinheader = 0)
{
    $height = ($thinheader ? 150 : 250);
    
    echo "<html>
      <head>
        <title>AptLab.io - SSH</title>
        <!-- UIKit -->
        <link rel='stylesheet' href='uikit/css/uikit.almost-flat.css'>
        <link rel='stylesheet' href='quickvm.css'>
        <script src='gateone.js'></script>
        <script src='quickvm_sup.js'></script>
        <script src='/emulab_sup.js'></script>
        <script src='https://code.jquery.com/jquery.js'></script>
        <script src='uikit/js/uikit.js'></script>
      </head>
    <body>
    <!-- Container for body, needed for sticky footer -->
    <div id='bodycontainer'>
    <div id='bodycontent'>
    <div class='uk-width-100 uk-container-center'
         style='background-color: #ff6600'>
        <img class='uk-align-center' style='width: ${height}px'
             src='aptlogo.png'/>
    </div>\n";

}

function SPITFOOTER()
{
    echo "</div>
      </div>
      <!--- Footer -->
      <div id='footer' class='uk-width-100' style='background-color: #ff6600;'>
        <div class='uk-align-left'>Powered by
             <img src='emulab-whiteout.png' id='elabpower'></div>
        <div class='uk-align-right'>&copy; 2013 The University of Utah</div>
        </div>
      </div>
     </body></html>\n";
}

#
# Does not return; page exits.
#
function SPITAJAX_RESPONSE($value)
{
    $results = array(
	'code'  => 0,
	'value' => $value
	);
    echo json_encode($results);
    exit();
}

function SPITAJAX_ERROR($msg)
{
    $results = array(
	'code'  => 1,
	'value' => $msg
	);
    echo json_encode($results);
    exit();
}

function GateOneAuthObject($uid)
{
    #
    # We need the secret that is shared with ops.
    #
    $fp = fopen("/usr/testbed/etc/gateone.key", "r");
    if (! $fp) {
	TBERROR("Error opening /usr/testbed/etc/gateone.key", 0);
	return null;
    }
    list($api_key,$secret) = preg_split('/:/', fread($fp, 128));
    fclose($fp);
    if (!($secret && $api_key)) {
	TBERROR("Could not get kets from gateone.key", 0);
	return null;
    }
    $secret = chop($secret);

    $authobj = array(
	'api_key' => $api_key,
	'upn' => $uid,
	'timestamp' => time() . '000',
	'signature_method' => 'HMAC-SHA1',
	'api_version' => '1.0'
    );
    $authobj['signature'] = hash_hmac('sha1',
				      $authobj['api_key'] . $authobj['upn'] .
				      $authobj['timestamp'], $secret);
    $valid_json_auth_object = json_encode($authobj);

    return $valid_json_auth_object;
}

#
# This is a little odd; since we are using our local CM to create
# the experiment, we can just ask for the graphic directly.
#
function GetTopoMap($uid, $pid, $eid)
{
    global $TBSUEXEC_PATH;
    $xmlstuff = "";
    
    if ($fp = popen("$TBSUEXEC_PATH nobody nobody webvistopology ".
		    "-x -s $uid $pid $eid", "r")) {

	while (!feof($fp) && connection_status() == 0) {
	    $string = fgets($fp);
	    if ($string) {
		$xmlstuff .= $string;
	    }
	}
	return $xmlstuff;
    }
    else {
	return "";
    }
}

?>
