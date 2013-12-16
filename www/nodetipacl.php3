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
include("defs.php3");
include_once("node_defs.php");
include("xmlrpc.php3");

#
# This script generates an "acl" file.
#

#
# Only known and logged in users can get acls..
#
$this_user = CheckLoginOrDie();
$uid       = $this_user->uid();
$isadmin   = ISADMIN();

#
# Verify form arguments.
#
$reqargs = RequiredPageArguments("node", PAGEARG_NODE);

# Need these below
$node_id = $node->node_id();

#
# Admin users can look at any node, but normal users can only control
# nodes in their own experiments.
#
# XXX is MODIFYINFO the correct one to check? (probably)
#
if (!$isadmin &&
    !$node->AccessCheck($this_user, $TB_NODEACCESS_READINFO)) {
    USERERROR("You do not have permission to tip to node $node_id!", 1);
}

# Array of arguments
$console = array();

#
# Ask outer emulab for the stuff we need. It does it own perm checks
#
if ($ELABINELAB) {
    $arghash = array();
    $arghash["node"] = $node_id;

    $results = XMLRPC($uid, "nobody", "elabinelab.console", $arghash);

    if (!$results ||
	! (isset($results{'server'})  && isset($results{'portnum'}) &&
	   isset($results{'keydata'}) && isset($results{'certsha'}))) {
	TBERROR("Did not get everything we needed from RPC call", 1);
    }

    $server  = $results['server'];
    $portnum = $results['portnum'];
    $keydata = $results['keydata'];
    $keylen  = strlen($keydata);
    $certhash= strtolower($results{'certsha'});
}
else {

    $query_result =
	DBQueryFatal("SELECT server, portnum, keylen, keydata, disabled " . 
		     "FROM tiplines WHERE node_id='$node_id'" );

    if (mysql_num_rows($query_result) == 0) {
	USERERROR("The node $node_id does not exist, ".
		  "or does not have a tipline!", 1);
    }
    $row = mysql_fetch_array($query_result);
    $server  = $row["server"];
    $portnum = $row["portnum"];
    $keylen  = $row["keylen"];
    $keydata = $row["keydata"];
    $disabled= $row["disabled"];

    if ($disabled) {
	USERERROR("The tipline for $node_id is currently disabled", 1);
    }

    #
    # Read in the fingerprint of the capture certificate
    #
    $capfile = "$TBETC_DIR/capture.fingerprint";
    $lines = file($capfile);
    if (!$lines) {
	TBERROR("Unable to open $capfile!",1);
    }

    $fingerline = rtrim($lines[0]);
    if (!preg_match("/Fingerprint=([\w:]+)$/",$fingerline,$matches)) {
	TBERROR("Unable to find fingerprint in string $fingerline!",1);
    }
    $certhash = str_replace(":","",strtolower($matches[1]));
}

if (! $BROWSER_CONSOLE_ENABLE) {
    $filename = $node_id . ".tbacl"; 

    header("Content-Type: text/x-testbed-acl");
    header("Content-Disposition: inline; filename=$filename;");
    header("Content-Description: ACL key file for a testbed node serial port");

    # XXX, should handle multiple tip lines gracefully somehow, 
    # but not important for now.

    echo "host:   $server\n";	
    echo "port:   $portnum\n";
    echo "keylen: $keylen\n";
    echo "key:    $keydata\n";
    echo "ssl-server-cert: $certhash\n";
    return;
}

#
# ShellInABox
#
$console["server"]   = $server;
$console["portnum"]  = $portnum;
$console["keylen"]   = $keylen;
$console["keydata"]  = $keydata;
$console["certhash"] = $certhash;

#
# Generate an authentication object to pass to the browser that
# is passed to the web server on ops. This is used to grant
# permission to the user to invoke tip to the console. 
#
function ConsoleAuthObject($uid, $nodeid, $console)
{
    global $USERNODE;
	
    $file = "/usr/testbed/etc/sshauth.key";
    
    #
    # We need the secret that is shared with ops.
    #
    $fp = fopen($file, "r");
    if (! $fp) {
	TBERROR("Error opening $file", 0);
	return null;
    }
    $key = fread($fp, 128);
    fclose($fp);
    if (!$key) {
	TBERROR("Could not get key from $file", 0);
	return null;
    }
    $key   = chop($key);
    $stuff = GENHASH();
    $now   = time();

    $authobj = array('uid'       => $uid,
		     'console'   => $console,
		     'stuff'     => $stuff,
		     'nodeid'    => $nodeid,
		     'timestamp' => $now,
		     'baseurl'   => "https://${USERNODE}",
		     'signature_method' => 'HMAC-SHA1',
		     'api_version' => '1.0',
		     'signature' => hash_hmac('sha1',
					      $uid . $stuff . $nodeid . $now .
					      " " . implode(",", $console),
					      $key),
    );
    return json_encode($authobj);
}
$console_auth = ConsoleAuthObject($uid, $node_id, $console);

PAGEHEADER("$nodeid Console");

$referrer = $_SERVER['HTTP_REFERER'];

echo "\n";
echo "<script src='https://code.jquery.com/jquery.js'></script>\n";
echo "<script>\n";
echo "var tbbaseurl = '$referrer';\n";
?>
function StartConsole(id, authobject)
{
    var jsonauth = $.parseJSON(authobject);
	
    var callback = function(stuff) {
        var split   = stuff.split(':');
        var session = split[0];
    	var port    = split[1];

        var url   = jsonauth.baseurl + ':' + port + '/' + '#' +
            encodeURIComponent(document.location.href) + ',' + session;
        console.log(url);
        var iwidth  = $('#' + id).width();
        var iheight = GetMaxHeight(id) - 50;

        $('#' + id).html('<iframe id="' + id + '_iframe" ' +
			   'width=' + iwidth + ' ' +
                           'height=' + iheight + ' ' +
                           'src=\'' + url + '\'>');

	//
	// Setup a custom event handler so we can kill the connection.
	//
	$('#' + id).on("killconsole",
		       { "url": jsonauth.baseurl + ':' + port + '/quit' +
			        '?session=' + session },
		       function(e) {
			   console.log("killconsole: " + e.data.url);
			   $.ajax({
     			       url: e.data.url,
			       type: 'GET',
			   });
		       });

	// Install a click handler for the X button.
	$("#" + id + "_kill").click(function(e) {
	    e.preventDefault();
	    // Trigger the custom event.
	    $("#" + id).trigger("killconsole");

	    PageReplace(tbbaseurl);
	})
    }
    var xmlthing = $.ajax({
	// the URL for the request
     	url: jsonauth.baseurl + '/d77e8041d1ad',
 
     	// the data to send (will be converted to a query string)
	data: {
	    auth: authobject,
	},
 
 	// Needs to be a POST to send the auth object.
	type: 'POST',
 
    	// Ask for plain text for easier parsing. 
	dataType : 'text',
    });
    xmlthing.done(callback);
}
</script>

<?php
echo "<div id='${nodeid}_console' style='width: 100%;'></div>";
echo "<center><button type=button id='${nodeid}_console_kill'>Close</button>" .
     "</center>\n";
echo "<script language=JavaScript>
      StartConsole('${nodeid}_console', '$console_auth');
      </script>\n";

PAGEFOOTER();
?>
