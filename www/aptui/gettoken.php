<?php
#
# Copyright (c) 2000-2025 University of Utah and the Flux Group.
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
include_once("webtask.php");
chdir("apt");
include("quickvm_sup.php");
$FILENAME = "cloudlab";

RedirectSecure();
$this_user = CheckLoginOrRedirect();

#
# Verify page arguments.
#
$optargs = OptionalPageArguments("target_user", PAGEARG_USER);

if (! isset($target_user)) {
    $target_user = $this_user;
}
if (!$target_user->SameUser($this_user) && !ISADMIN()) {
    SPITUSERERROR("Not enough permission");
    return;
}

$target_uid = $target_user->uid();
$target_idx = $target_user->uid_idx();

#
# For now, short lived tokens until we are storing them in the DB.
#
$webtask = WebTask::CreateAnonymous();
if (!$webtask) {
    SPITUSERERROR("Internal webtask Error");
    return;
}
$retval = SUEXEC($this_user, "nobody",
                 "webmanage_tokens -t " . $webtask->task_id() .
                 " create -s $target_uid",
                 SUEXEC_ACTION_IGNORE);

if ($retval != 0) {
    SPITUSERERROR("Internal Error");
    $webtask->Delete();
    return;
}
$webtask->Refresh();
$token = $webtask->TaskValue("result");

header("Content-Type: text/plain");
header("Content-Disposition: attachment; filename=\"${FILENAME}.jwt\"");
echo $token;
echo "\n";

?>
