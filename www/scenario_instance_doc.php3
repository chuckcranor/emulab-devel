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

$scenario_id = rawurldecode($scenario_id);
$scenario_instance = rawurldecode($scenario_instance);

echo "<center><h2>$scenario_id - $scenario_instance</h2></center>\n";

$query_result = DBQueryFatal("SELECT notes from scenarios where " .
			     "scenario_id = \"$scenario_id\" and " .
			     "scenario_instance = \"$scenario_instance\"");
list($notes) = mysql_fetch_array($query_result);

print "<pre>$notes</pre>\n";

PAGEFOOTER();

?>
