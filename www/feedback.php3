<?php
#
# EMULAB-COPYRIGHT
# Copyright (c) 2000-2004 University of Utah and the Flux Group.
# All rights reserved.
#
include("defs.php3");
include("showstuff.php3");

#
# No PAGEHEADER since we spit out a Location header later. See below.
# 

#
# Only known and logged in users can do this.
#
$uid = GETLOGIN();
LOGGEDINORDIE($uid);

#
# Check to make sure a valid experiment.
#
if (isset($pid) && strcmp($pid, "") &&
    isset($eid) && strcmp($eid, "")) {
    if (! TBvalid_eid($eid)) {
	PAGEARGERROR("$eid is contains invalid characters!");
    }
    if (! TBvalid_pid($pid)) {
	PAGEARGERROR("$pid is contains invalid characters!");
    }
    if (! TBValidExperiment($pid, $eid)) {
	USERERROR("$pid/$eid is not a valid experiment!", 1);
    }
    if (! TBExptAccessCheck($uid, $pid, $eid, $TB_EXPT_MODIFY)) {
	USERERROR("You do not have permission to run feedback on $pid/$eid!",
		  1);
    }
}
else {
    PAGEARGERROR("Must specify pid and eid!");
}

$query_result = DBQueryFatal("select gid,linktest_level from experiments ".
				 "where pid='$pid' and eid='$eid'");
$row = mysql_fetch_array($query_result);
$gid = $row[0];

if (!isset($duration) || $duration == "") {
	$duration = 30;
}
elseif (! TBvalid_tinyint($duration) || $duration < 0) {
	PAGEARGERROR("Duration must be an integer > 0");
}

if ($canceled) {
    PAGEHEADER("Record Feedback");
	
    echo "<center><h3><br>
          Operation canceled!
          </h3></center>\n";
    
    PAGEFOOTER();
    return;
}

if (!$confirmed) {
    PAGEHEADER("Record feedback");

    echo "<font size=+2>Experiment <b>".
	"<a href='showproject.php3?pid=$pid'>$pid</a>/".
	"<a href='showexp.php3?pid=$pid&eid=$eid'>$eid</a></b></font>\n";

    echo "<center><font size=+2><br>
              How much feedback data should be recorded?
              </font>\n";

    SHOWEXP($pid, $eid, 1);

    echo "<form action=feedback.php3 method=post>";
    echo "<input type=hidden name=pid value=$pid>\n";
    echo "<input type=hidden name=eid value=$eid>\n";

    echo "<table align=center border=1>\n";
    echo "<tr>
              <td>
              <input type='text' name='duration' value='$duration'> seconds
              </td>
          </tr>
          </table><br>\n";

    echo "<b><input type=submit name=confirmed value=Confirm></b>\n";
    echo "<b><input type=submit name=canceled value=Cancel></b>\n";
    echo "</form>\n";
    echo "</center>\n";

    PAGEFOOTER();
    return;
}

#
# A cleanup function to keep the child from becoming a zombie, since
# the script is terminated, but the children are left to roam.
#
$fp = 0;

function SPEWCLEANUP()
{
    global $fp;

    if (connection_aborted() && $fp) {
	pclose($fp);
    }
    exit();
}
register_shutdown_function("SPEWCLEANUP");
ignore_user_abort(1);

# For backend.
TBGroupUnixInfo($pid, $gid, $unix_gid, $unix_name);

$fp = popen("$TBSUEXEC_PATH $uid $unix_gid webfeedback $pid $eid $duration",
	    "r");
if (! $fp) {
    USERERROR("Feedback failed!", 1);
}

header("Content-Type: text/plain");
header("Expires: Mon, 26 Jul 1997 05:00:00 GMT");
header("Cache-Control: no-cache, must-revalidate");
header("Pragma: no-cache");
flush();

echo date("D M d G:i:s T");
echo "\n";
echo "Recording feedback for $duration seconds\n";
flush();
while (!feof($fp)) {
    $string = fgets($fp, 1024);
    echo "$string";
    flush();
}
$retval = pclose($fp);
$fp = 0;
if ($retval == 0)
    echo "Feedback run was successful!\n";
echo date("D M d G:i:s T");
echo "\n";

?>
