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
PAGEHEADER("Scenarios");

#
# Only known and logged in users can do this.
#
$uid = GETLOGIN();
LOGGEDINORDIE($uid);

$columns = 4;
$imagepath = "/scenarios";
$imagedir = "$TBDIR" . "www/scenarios";
$defaultimg = "default.jpg";

if (is_null($exclusive_mode)) {
  $exclusive_mode = 0;
}

#
# Extract information on all scenarios.
# This is stored in the array (of arrays) scenarios.
#
$query_result = DBQueryFatal("SELECT scenario_id,scenario_instance,status,category " .
	"FROM scenarios ORDER by category, scenario_id");
$scenarios = array();
$categories = array();
$scenario_list = array();
$cur = "";
while (list($scenario_id,$scenario_instance,$status,$category) = 
       mysql_fetch_array($query_result)) {
  $scenarios[$scenario_id][] = $scenario_instance;
  $categories[$scenario_id] = $category;
  if ($scenario_id != $cur) {
    $scenario_list[] = $scenario_id;
    $cur = $scenario_id;
  }
}

#
# Display a grid of scenarios
#
$row = 0;
$column = 0;
echo "<center><h2>Scenarios</h2></center>\n";
echo "<p><b>Resource Mode:</b> ";
if ($exclusive_mode == 0) {
  echo "Shared (<a href=" . $_SERVER['PHP_SELF'] . "?exclusive_mode=1>Switch to Exclusive)</a>";
} else {
  echo "Exclusive (<a href=" . $_SERVER['PHP_SELF'] . "?exclusive_mode=0>Switch to Shared)</a>";
}
$curcategory = "FOO";
$first = 1;
$numscenarios = count($scenarios);
foreach ($scenario_list as $scenario_id) {
  $total = count($scenarios[$scenario_id]);
  $free = 0;
  foreach ($scenarios[$scenario_id] as $scenario_instance) {
    if (SCAvailableP($scenario_id,$scenario_instance,$exclusive_mode)) {
      $free++;
    }
  }

  $cat = $categories[$scenario_id];
  if ($cat != $curcategory) {
    if ($first == 0) {
      echo "</tr></table></center>\n";
    }
    $first = 0;
    echo "<h2>$cat</h2>\n";
    echo "<center><table>\n";
    echo "<tr>";
    $curcategory = $cat;
  }

  echo "<td><center><a href=scenario_doc.php3?scenario_id=" .
    rawurlencode($scenario_id) . ">";
  echo "<img src=";
  if (file_exists($imagedir . "/" . $scenario_id . ".jpg")) {
    echo $imagepath . "/" . $scenario_id . ".jpg";
  } else {
    echo $imagepath . "/" . $defaultimg;
  }
  echo "><br>\n";
  echo "$scenario_id</a><br>\n";
  echo "Avail: $free/$total</center></td>";
  $column++;
  if ($column == $columns) {
    echo "</tr>\n";
    if ($row*$columns+$column != $numscenarios) {
      echo "<tr>";
    }
    $row++;
    $column = 0;
  }
}
echo "</table></center>";

#
# Standard Testbed Footer
# 
PAGEFOOTER();
?>
