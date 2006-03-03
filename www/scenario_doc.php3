<?php

/*
 * Copyright (c) 2005 Paul Barford
 * 
 * We provide the Schooner testbed management software (below described 
 * as "Schooner") on an AS IS basis, and do not warrant its validity or 
 * performance.  We reserve the right to update, modify, or discontinue
 * this software at any time.  We shall have no obligation to supply such 
 * updates or modifications or any other form of support to you.
 * 
 * This license is for research uses.  For such uses, there is no
 * charge. We define "research use" to mean you may freely use it
 * inside your organization for whatever purposes you see fit. But you
 * may not re-distribute Schooner or parts of Schooner, in any form
 * source or binary (including derivatives), electronic or otherwise,
 * to any other organization or entity without our permission.
 * 
 * (for other uses, please contact us at wail@cs.wisc.edu)
 * 
 * All warranties, including without limitation, any warranty of
 * merchantability or fitness for a particular purpose, are hereby
 * excluded.
 * 
 * By your use of Schooner, you understand and agree that we (or any
 * other person or entity with proprietary rights in Schooner) are
 * under no obligation to provide either maintenance services,
 * update services, notices of latent defects, or correction of
 * defects for Schooner.
 * 
 * Even if advised of the possibility of such damages, under no
 * circumstances shall we (or any other person or entity with
 * proprietary rights in the software licensed hereunder) be liable
 * to you or any third party for direct, indirect, or consequential
 * damages of any character regardless of type of action, including,
 * without limitation, loss of profits, loss of use, loss of good
 * will, or computer failure or malfunction.  You agree to indemnify
 * us (and any other person or entity with proprietary rights in the
 * software licensed hereunder) for any and all liability it may
 * incur to third parties resulting from your use of Schooner.
 */

include("defs.php3");

#
# Standard Testbed Header
#
PAGEHEADER("Scenario Documentation");

#
# Only known and logged in users can do this.
#
$uid = GETLOGIN();
LOGGEDINORDIE($uid);
$isadmin = ISADMIN($uid);

$docdir = "$TBDIR" . "/www/scenarios";
$docpath = "/scenarios";
$defaultdoc = "$docdir/default.html";
$defaultimg = "$docpath/default.jpg";

$scenario_id = rawurldecode($scenario_id);

echo "<center><h2>$scenario_id</h2></center>\n";

$img = $docdir . "/" . $scenario_id . "_doc.jpg";
echo "<center><img src=";
if (file_exists($img)) {
  echo $docpath . "/" . $scenario_id . "_doc.jpg";
} else {
  echo $defaultimg;
}
echo "></center>";

$doc = $docdir . "/" . $scenario_id . ".html";
if (file_exists($doc)) {
  fpassthru(fopen($doc,"r"));
} else {
  fpassthru(fopen($defaultdoc,"r"));
}

$nsfile = $docdir . "/" . $scenario_id . ".ns";
if (file_exists($nsfile)) {
  echo "<h2>Example</h2>\n";
  echo "<pre>\n";
  fpassthru(fopen($nsfile,"r"));
  echo "</pre>\n";
  echo "<p><a href=$docpath/" . $scenario_id . ".ns>Download</a>\n";
}

echo "<center><h2>Instances</h2>\n";
echo "<table><tr>\n";
echo "<td><b>Instance</b></td>\n";
echo "<td><b>Status</b></td>\n";
echo "<td><b>Shared Availability</b></td>\n";
echo "<td><b>Exclusive Availability</b></td>\n";
echo "</tr>\n";
$query_result = DBQueryFatal("SELECT s.scenario_instance,s.status, " .
			     "es.pid, es.eid " .
			     "FROM scenarios as s LEFT JOIN " .
			     "experiment_scenarios as es " .
			     "ON es.scenario_instance = s.scenario_instance " .
			     "AND es.scenario_id = s.scenario_id " .
			     "WHERE s.scenario_id=\"$scenario_id\"");
while (list($scenario_instance,$status,$pid,$eid,$vname) = 
       mysql_fetch_array($query_result)) {
  echo "<tr><td><a href=scenario_instance_doc.php3?scenario_id=" .
	rawurlencode($scenario_id) . "&scenario_instance=" .
	rawurlencode($scenario_instance) . 
	">$scenario_instance</td><td>$status</td>";
  if ($status == "loaded") {
    echo "<td colspan=2><a href=scenario_resources.php3?scenario_id=" .
      rawurlencode($scenario_id) . "&scenario_instance=" .
      rawurlencode($scenario_instance) . 
      "><font color=blue>In Use</a></font></a> - " .
      "<a href=showproject.php3?pid=$pid>$pid</a>/" .
      "<a href=showexp.php3?pid=$pid&eid=$eid>$eid</a></td>";
  } else {
    if (SCAvailableP($scenario_id,$scenario_instance,0)) {
      echo "<td><a href=scenario_resources.php3?scenario_id=" .
	rawurlencode($scenario_id) . "&scenario_instance=" .
	rawurlencode($scenario_instance) . "><font color=green>Available" .
	"</font></a></td>";
    } else {
      echo "<td><a href=scenario_resources.php3?scenario_id=" .
	rawurlencode($scenario_id) . "&scenario_instance=" .
	rawurlencode($scenario_instance) . "><font color=red>Unavailable" .
	"</font></a></td>";
    }
    if (SCAvailableP($scenario_id,$scenario_instance,1)) {
      echo "<td><a href=scenario_resources.php3?scenario_id=" .
	rawurlencode($scenario_id) . "&scenario_instance=" .
	rawurlencode($scenario_instance) . "><font color=green>Available" .
	"</font></a></td>";
    } else {
      echo "<td><a href=scenario_resources.php3?scenario_id=" .
	rawurlencode($scenario_id) . "&scenario_instance=" .
	rawurlencode($scenario_instance) . "><font color=red>Unavailable" .
	"</font></a></td>";
    }
  }
  echo "</tr>\n";
}
echo "</table></center>";

PAGEFOOTER();

?>
