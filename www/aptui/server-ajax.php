<?php
#
# Copyright (c) 2000-2016 University of Utah and the Flux Group.
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
chdir("apt");
include("quickvm_sup.php");
# Must be after quickvm_sup.php since it changes the auth domain.
include_once("../session.php");

#
# Poor man routing description.
#
$routing = array("myprofiles" =>
			array("file"    => "myprofiles.ajax",
			      "guest"   => false,
			      "methods" => array("GetProfile" =>
						      "Do_GetProfile")),
		 "geni-login" =>
			array("file"    => "geni-login.ajax",
			      "guest"   => true,
			      "methods" => array("GetSignerInfo" =>
						      "Do_GetSignerInfo",
						 "CreateSecret" =>
						      "Do_CreateSecret",
						 "VerifySpeaksfor" =>
						      "Do_VerifySpeaksfor")),
		 "dashboard" =>
			array("file"    => "dashboard.ajax",
			      "guest"   => false,
			      "methods" => array("GetStats" =>
						      "Do_GetStats")),
		 "rspec2genilib" =>
			array("file"    => "rspec2genilib.ajax",
			      "guest"   => false,
			      "methods" => array("Convert" =>
						      "Do_Convert")),
		 "cluster-status" =>
			array("file"    => "cluster-status.ajax",
			      "guest"   => false,
			      "methods" => array("GetStatus" =>
                                                    "Do_GetStatus",
                                                 "GetPreReservations" =>
						      "Do_GetPreReservations")),
		 "sumstats" =>
			array("file"    => "sumstats.ajax",
			      "guest"   => false,
			      "methods" => array("GetDurationInfo" =>
						      "Do_GetDurationInfo")),
		 "instantiate" =>
			array("file"    => "instantiate.ajax",
			      "guest"   => true,
			      "methods" => array("GetProfile" =>
						     "Do_GetProfile",
						 "CheckForm" =>
						     "Do_CheckForm",
						 "RunScript" =>
						     "Do_RunScript",
						 "VerifyEmail" =>
						     "Do_VerifyEmail",
						 "Submit" =>
						     "Do_Submit",
						 "Instantiate" =>
						     "Do_Instantiate",
						 "GetParameters" =>
                                                     "Do_GetParameters",
						 "GetImageInfo" =>
						     "Do_GetImageInfo",
						 "MarkFavorite" =>
						     "Do_MarkFavorite",
						 "ClearFavorite" =>
						     "Do_ClearFavorite")),
		 "manage_profile" =>
			array("file"    => "manage_profile.ajax",
			      "guest"   => false,
			      "methods" => array("CloneStatus" =>
						     "Do_CloneStatus",
						 "DeleteProfile" =>
						     "Do_DeleteProfile",
						 "PublishProfile" =>
						     "Do_PublishProfile",
						 "InstantiateAsGuest" =>
						     "Do_GuestInstantiate",
						 "CheckScript" =>
						     "Do_CheckScript",
						 "BindParameters" =>
						     "Do_BindParameters",
						 "ConvertClassic" =>
                                                     "Do_ConvertClassic",
						 "UpdateRepository" =>
                                                     "Do_UpdateRepository",
						 "UpdateFromMaster" =>
                                                     "Do_UpdateMaster",
						 "GetRepository" =>
                                                     "Do_GetRepository",
						 "GetRepoSource" =>
                                                     "Do_GetRepoSource",
						 "GetBranchList" =>
                                                     "Do_GetBranchList",
						 "GetCommitInfo" =>
                                                     "Do_GetCommitInfo",
						 "GetCommitList" =>
                                                     "Do_GetCommitList")),
		 "status" =>
			array("file"    => "status.ajax",
			      "guest"   => true,
			      "methods" => array("GetInstanceStatus" =>
						   "Do_GetInstanceStatus",
						 "ExpInfo" =>
						    "Do_ExpInfo",
						 "IdleData" =>
						    "Do_IdleData",
						 "Utilization" =>
						    "Do_Utilization",
						 "TerminateInstance" =>
						    "Do_TerminateInstance",
						 "GetInstanceManifest" =>
						    "Do_GetInstanceManifest",
						 "GetSSHAuthObject" =>
						    "Do_GetSSHAuthObject",
						 "ConsoleURL" =>
						     "Do_ConsoleURL",
						 "DeleteNodes" =>
						     "Do_DeleteNodes",
						 "RequestExtension" =>
						     "Do_RequestExtension",
						 "DenyExtension" =>
						     "Do_DenyExtension",
						 "MoreInfo" =>
						     "Do_MoreInfo",
						 "SchedTerminate" =>
						     "Do_SchedTerminate",
						 "SnapShot" =>
						     "Do_Snapshot",
						 "SnapshotStatus" =>
                                                     "Do_SnapshotStatus",
						 "Reboot" =>
                                                     "Do_Reboot",
						 "Reload" =>
                                                     "Do_Reload",
						 "Refresh" =>
						     "Do_Refresh",
						 "ReloadTopology" =>
						     "Do_ReloadTopology",
						 "DecryptBlocks" =>
						     "Do_DecryptBlocks",
						 "Lockout" =>
                                                     "Do_Lockout",
						 "Lockdown" =>
                                                     "Do_Lockdown",
						 "Quarantine" =>
						     "Do_Quarantine",
						 "LinktestControl" =>
						     "Do_Linktest",
						 "OpenstackStats" =>
						     "Do_OpenstackStats",
						 "MaxExtension" =>
						     "Do_MaxExtension",
						 "dismissExtensionDenied" =>
						     "Do_DismissExtensionDenied",
						 "GetHealthStatus" =>
						    "Do_GetHealthStatus")),
		 "approveuser" =>
			array("file"    => "approveuser.ajax",
			      "guest"   => false,
			      "methods" => array("approve" =>
						     "Do_Approve",
						 "deny" =>
						      "Do_Deny")),
		 "dataset" =>
			array("file"    => "dataset.ajax",
			      "guest"   => false,
			      "methods" => array("create" =>
						      "Do_CreateDataset",
						 "modify" =>
						      "Do_ModifyDataset",
						 "delete" =>
						      "Do_DeleteDataset",
						 "refresh" =>
						      "Do_RefreshDataset",
						 "approve" =>
						     "Do_ApproveDataset",
						 "extend" =>
                                                      "Do_ExtendDataset",
						 "getinfo" =>
						      "Do_GetInfo")),
		 "ssh-keys" =>
			array("file"    => "ssh-keys.ajax",
			      "guest"   => false,
			      "methods" => array("addkey" =>
						      "Do_AddKey",
						 "deletekey" =>
                                                      "Do_DeleteKey")),
		 "myaccount" =>
			array("file"    => "myaccount.ajax",
			      "guest"   => false,
                              "unapproved" => true,
			      "methods" => array("update" =>
                                                 "Do_Update")),
		 "lists" =>
			array("file"    => "lists.ajax",
			      "guest"   => false,
			      "methods" => array("SearchUsers" =>
                                                     "Do_SearchUsers",
                                                 "SearchProjects" =>
                                                     "Do_SearchProjects")),
		 "user-dashboard" =>
			array("file"    => "user-dashboard.ajax",
			      "guest"   => false,
			      "methods" => array("ExperimentList" =>
						      "Do_ExperimentList",
                                                 "ClassicExperimentList" =>
						      "Do_ClassicExperimentList",
                                                 "ClassicProfileList" =>
						      "Do_ClassicProfileList",
                                                 "DatasetList" =>
						      "Do_DatasetList",
                                                 "ClassicDatasetList" =>
						      "Do_ClassicDatasetList",
                                                 "ProjectList" =>
                                                      "Do_ProjectList",
                                                 "UsageSummary" =>
                                                      "Do_UsageSummary",
                                                 "ProfileList" =>
                                                      "Do_ProfileList",
                                                 "Toggle" =>
                                                     "Do_Toggle",
                                                 "SendTestMessage" =>
                                                     "Do_SendTestMessage",
                                                 "NagPI" =>
                                                     "Do_NagPI",
                                                 "AccountDetails" =>
                                                     "Do_AccountDetails")),
		 "nag" =>
			array("file"    => "user-dashboard.ajax",
                              "unapproved" => true,
			      "guest"   => false,
			      "methods" => array("NagPI" =>
                                                     "Do_NagPI",)),
		 "show-project" =>
			array("file"    => "show-project.ajax",
			      "guest"   => false,
			      "methods" => array("ExperimentList" =>
						      "Do_ExperimentList",
                                                 "ClassicExperimentList" =>
						      "Do_ClassicExperimentList",
                                                 "ClassicProfileList" =>
						      "Do_ClassicProfileList",
                                                 "DatasetList" =>
						      "Do_DatasetList",
                                                 "ClassicDatasetList" =>
						      "Do_ClassicDatasetList",
                                                 "ProfileList" =>
                                                      "Do_ProfileList",
                                                 "MemberList" =>
                                                      "Do_MemberList",
                                                 "GroupList" =>
                                                      "Do_GroupList",
                                                 "UsageSummary" =>
                                                      "Do_UsageSummary",
                                                 "ProjectProfile" =>
                                                      "Do_ProjectProfile")),
		 "groups" =>
			array("file"    => "groups.ajax",
			      "guest"   => false,
			      "methods" => array("ExperimentList" =>
						      "Do_ExperimentList",
                                                 "ClassicExperimentList" =>
						     "Do_ClassicExperimentList",
                                                 "MemberList" =>
                                                      "Do_MemberList",
                                                 "EditMembership" =>
                                                      "Do_EditMembership",
                                                 "EditPrivs" =>
                                                      "Do_EditPrivs",
                                                 "Create" =>
                                                      "Do_CreateGroup",
                                                 "Delete" =>
                                                      "Do_DeleteGroup",
                                                 "GroupProfile" =>
                                                      "Do_GroupProfile")),
		 "ranking" =>
			array("file"    => "ranking.ajax",
			      "guest"   => false,
			      "methods" => array("RankList" =>
                                                     "Do_RankList")),
                 "announcement" =>
                        array("file"    => "announcement.ajax",
                              "guest"   => false,
                              "methods" => array("Dismiss" =>
                                                     "Do_Dismiss",
                                                 "Click" =>
                                                     "Do_Click")),
		 "reserve" =>
			array("file"    => "reserve.ajax",
			      "guest"   => false,
			      "methods" => array("Reserve" =>
                                                     "Do_Reserve",
                                                 "Validate" =>
                                                     "Do_Validate",
                                                 "ListReservations" =>
                                                     "Do_ListReservations",
                                                 "GetReservation" =>
                                                     "Do_GetReservation",
                                                 "Delete" =>
                                                     "Do_Delete")),
		 "news" =>
			array("file"    => "news.ajax",
			      "guest"   => true,
			      "methods" => array("create" =>
						      "Do_CreateNews",
						 "modify" =>
						      "Do_ModifyNews",
						 "delete" =>
						      "Do_DeleteNews",
						 "getnews" =>
						      "Do_GetNews")),
);

#
# Redefine this so we return XML instead of html for all errors.
#
$PAGEERROR_HANDLER = function($msg, $status_code = 0) {
    if ($status_code == 0) {
	$status_code = 1;
    }
    SPITAJAX_ERROR(1, $msg);
    return;
};

#
# Included file determines if guest user okay.
#
$this_user = CheckLogin($check_status);

#
# Check user login, called by included code. Basically just a
# way to let guest users pass through when allowed, without
# duplicating the code in each file.
#
function CheckLoginForAjax($route)
{
    global $this_user, $check_status;
    $guestokay = false;
    $unapprovedokay = false;
    
    if (array_key_exists("guest", $route)) {
        $guestokay = $route["guest"];
    }
    if (array_key_exists("unapproved", $route)) {
        $unapprovedokay = $route["unapproved"];
    }

    # Known user, but timed out.
    if ($check_status & CHECKLOGIN_TIMEDOUT) {
	SPITAJAX_ERROR(2, "Your login has timed out");
	exit(2);
    }
    # Logged in user always okay.
    if (isset($this_user)) {
	if ($check_status & CHECKLOGIN_MAYBEVALID) {
	    SPITAJAX_ERROR(2, "Your login cannot be verified. Cookie problem?");
	    exit(2);
	}
        # Known user, but not frozen.
        if ($check_status & CHECKLOGIN_FROZEN) {
            SPITAJAX_ERROR(2, "Your account has been frozen");
            exit(2);
        }
        if (! $unapprovedokay) {
            # Known user, but not approved.
            if ($check_status & CHECKLOGIN_UNAPPROVED) {
	        SPITAJAX_ERROR(2, "Your account has not been approved yet");
                exit(2);
            }
            # Known user, but not active.
            if (! ($check_status & CHECKLOGIN_ACTIVE)) {
                SPITAJAX_ERROR(2, "Your account is no longer active");
                exit(2);
            }
        }
        # Kludge, still thinking about it. If a geni user has no project
        # permissions at their SA, then we mark the acount as WEBONLY, and
        # deny access to anything that is not marked as guest okay. 
	if ($check_status & CHECKLOGIN_WEBONLY && !$guestokay) {
	    SPITAJAX_ERROR(2, "Your account is not allowed to do this");
	    exit(2);
        }
	return;
    }
    if (!$guestokay) {
	SPITAJAX_ERROR(2, "You are not logged in");	
	exit(2);
    }
}

#
# So we can capture stderr. Sheesh.
# 
function myexec($cmd)
{
    ignore_user_abort(1);

    $myexec_output_array = array();
    $myexec_output       = "";
    $myexec_retval       = 0;
    
    exec("$cmd 2>&1", $myexec_output_array, $myexec_retval);
    if ($myexec_retval) {
	for ($i = 0; $i < count($myexec_output_array); $i++) {
	    $myexec_output .= "$myexec_output_array[$i]\n";
	}
	$foo  = "Shell Program Error. Exit status: $myexec_retval\n";
	$foo .= "  '$cmd'\n";
	$foo .= "\n";
	$foo .= $myexec_output;
	TBERROR($foo, 0);
	return 1;
    }
    return 0;
}

#
# Verify page arguments.
#
$optargs = RequiredPageArguments("ajax_route",    PAGEARG_STRING,
				 "ajax_method",   PAGEARG_STRING,
				 "ajax_args",     PAGEARG_ARRAY);

#
# Verify page and method.
#
if (! array_key_exists($ajax_route, $routing)) {
    SPITAJAX_ERROR(1, "Invalid route: $ajax_route");
    exit(1);
}
if (! array_key_exists($ajax_method, $routing[$ajax_route]["methods"])) {
    SPITAJAX_ERROR(1, "Invalid method: $ajax_route,$ajax_method");
    exit(1);
}
CheckLoginForAjax($routing[$ajax_route]);
include($routing[$ajax_route]["file"]);
call_user_func($routing[$ajax_route]["methods"][$ajax_method]);

?>
