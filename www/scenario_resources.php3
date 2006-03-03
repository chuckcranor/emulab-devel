<?php

#
# Copyright (c) 2005 Paul Barford
# 
# We provide the Schooner testbed management software (below described 
# as "Schooner") on an AS IS basis, and do not warrant its validity or 
# performance.  We reserve the right to update, modify, or discontinue
# this software at any time.  We shall have no obligation to supply such 
# updates or modifications or any other form of support to you.
# 
# This license is for research uses.  For such uses, there is no
# charge. We define "research use" to mean you may freely use it
# inside your organization for whatever purposes you see fit. But you
# may not re-distribute Schooner or parts of Schooner, in any form
# source or binary (including derivatives), electronic or otherwise,
# to any other organization or entity without our permission.
# 
# (for other uses, please contact us at wail@cs.wisc.edu)
# 
# All warranties, including without limitation, any warranty of
# merchantability or fitness for a particular purpose, are hereby
# excluded.
# 
# By your use of Schooner, you understand and agree that we (or any
# other person or entity with proprietary rights in Schooner) are
# under no obligation to provide either maintenance services,
# update services, notices of latent defects, or correction of
# defects for Schooner.
# 
# Even if advised of the possibility of such damages, under no
# circumstances shall we (or any other person or entity with
# proprietary rights in the software licensed hereunder) be liable
# to you or any third party for direct, indirect, or consequential
# damages of any character regardless of type of action, including,
# without limitation, loss of profits, loss of use, loss of good
# will, or computer failure or malfunction.  You agree to indemnify
# us (and any other person or entity with proprietary rights in the
# software licensed hereunder) for any and all liability it may
# incur to third parties resulting from your use of Schooner.
#

include("defs.php3");

#
# Standard Testbed Header
#
PAGEHEADER("Scenario Resources");

#
# Only known and logged in users can do this.
#
$uid = GETLOGIN();
LOGGEDINORDIE($uid);

$scenario_id = rawurldecode($scenario_id);
$scenario_instance = rawurldecode($scenario_instance);

echo "<center><h2>$scenario_id/$scenario_instance</h2></center>\n";

echo "<center>\n";
echo "<tr><td><b>Resource</b></td><td><b>Current Use</b></td></tr>\n";
$qr = DBQueryFatal("SELECT resource_id,resource_type " .
		   "FROM scenario_resources " .
		   "WHERE scenario_id=\"$scenario_id\" " .
		   "AND scenario_instance=\"$scenario_instance\"");
while (list($resource_id,$resource_type) = mysql_fetch_row($qr)) {
  echo "<tr><td>$resource_id</td><td>$resource_type</td>";
  $qr2 = DBQueryFatal("SELECT sru.scenario_id,sru.scenario_instance," .
		      "es.pid,es.eid,es.resource_policy " .
		      "FROM scenario_resource_use as sru " .
		      "LEFT JOIN experiment_scenarios as es " .
		      "ON es.scenario_id=sru.scenario_id " . 
		      "AND es.scenario_instance=sru.scenario_instance " .
		      "WHERE sru.resource_id=\"$resource_id\"");
  if (mysql_num_rows($qr2) == 0) {   
    echo "<td><font color=green>Available</font></td>";
  } elseif (mysql_num_rows($qr2) == 1) {
    list($scenario_id,$scenario_instance,$pid,$eid,$resource_policy) =
      mysql_fetch_row($qr2);
    if (($resource_type == "mutex") || ($resource_type == "exclusive")) {
      echo "<td><font color=red>In use:</font> ";
    } else {
      echo "<td><font color=orange>Shared by:</font> ";
    }
    echo "<a href=scenario_doc?scanario_id=" . rawurlencode($scenario_id) . 
      ">$scenario_id</a>/" .
      "<a href=scenario_resources.php3?scenario_id=" . 
      rawurlencode($scenario_id) . "&scenario_instance=" .
      rawurlencode($scenario_instance) . ">$scenario_instance</a>" .
      " (<a href=showproject.php3?pid=$pid>$pid</a>/" .
      "<a href=showexp.php3?pid=$pid&eid=$eid>$eid</a>)</td>";
  } else {
    echo "<td><font color=orange>Shared by:</font><br> ";
    while (list($scenario_id,$scenario_instance,$pid,$eid,$resource_policy) =
	   mysql_fetch_row($qr2)) {
      echo "<a href=scenario_doc?scanario_id=" . rawurlencode($scenario_id) . 
	">$scenario_id</a>/" .
	"<a href=scenario_resources.php3?scenario_id=" . 
	rawurlencode($scenario_id) . "&scenario_instance=" .
	rawurlencode($scenario_instance) . ">$scenario_instance</a>" .
	" (<a href=showproject.php3?pid=$pid>$pid</a>/" .
	"<a href=showexp.php3?pid=$pid&eid=$eid>$eid</a>)<br>";
    }
    echo "</td>";
  }
  echo "</tr>";
}

#
# Standard Testbed Footer
# 
PAGEFOOTER();
?>
