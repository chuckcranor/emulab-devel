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
chdir("aptui-mockup");
include("quickvm_sup.php");

SPITHEADER();

#
# We need the secret that is shared with ops.
#
$fp = fopen("/usr/testbed/etc/gateone.key", "r");
if (! $fp) {
    TBERROR("Error opening /usr/testbed/etc/gateone.key", 1);
}
list($api_key,$secret) = preg_split('/:/', fread($fp, 128));
fclose($fp);
if (!($secret && $api_key)) {
    TBERROR("Could not get kets from gateone.key", 1);
}
$secret = chop($secret);

$authobj = array(
    'api_key' => $api_key,
    'upn' => 'stoller',
    'timestamp' => time() . '000',
    'signature_method' => 'HMAC-SHA1',
    'api_version' => '1.0'
    );
$authobj['signature'] = hash_hmac('sha1',
				  $authobj['api_key'] . $authobj['upn'] .
				  $authobj['timestamp'], $secret);
$valid_json_auth_object = json_encode($authobj);

#
# Oh jeez, by default multiple instances share the same session and
# you end up with two tabs talking to the same terminal. Dumb. I have
# to actually tell the gateone code to not do this by providing a
# unique location parameter. 
#
$location = uniqid("loc");

echo "<SCRIPT LANGUAGE=JavaScript>
              window.onload = function() {
		 GateOne.location = '$location';
                 // Initialize Gate One:
                 GateOne.init({url:  'https://users.emulab.net:1090/gateone',
  	             autoConnectURL: 'ssh://stoller@pc493',
		     showToolbar: false,
		     terminalFont: 'monospace',
                     auth: $valid_json_auth_object});
              }
          </Script>\n";

echo "<div class='uk-panel uk-panel-box uk-panel-header
           uk-container-center uk-margin-bottom'>\n";

echo "<div id='gateone_container'
	       style='width: 60em; height: 30em; ".
                     "font-family: monospace'>
         <div id='gateone'></div></div>\n";

echo "</div>\n";

SPITFOOTER();
?>


