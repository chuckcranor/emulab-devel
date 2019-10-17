<?php
#
# Copyright (c) 2000-2019 University of Utah and the Flux Group.
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
include_once("portal_defs.php");
include_once("instance_defs.php");
include_once("require.php");

#
# Global flag to disable accounts. We do this on some pages which
# should not display login/account info.
#
$disable_accounts = 0;

#
# Global flag for page embedded. We look directly into page arguments
# for this, rather then using standard argument processing in each page.
# Page embedding is used to contain an apt pages withing Emulab. 
#
$embedded = 0;
if (isset($_REQUEST["embedded"]) && $_REQUEST["embedded"]) {
    $embedded = 1;
}

# For backend scripts to know how they were invoked.
if (isset($_SERVER['SERVER_NAME'])) { 
    putenv("SERVER_NAME=" . $_SERVER['SERVER_NAME']);
}

#
# Redefine this so APT errors are styled properly. Called by PAGEERROR();.
#
$PAGEERROR_HANDLER = function($msg = null, $status_code = 0) {
    global $drewheader, $ISCLOUD, $ISPNET, $ISEMULAB, $ISAPT, $ISPOWDER;
    global $spatrequired, $TBMAINSITE, $PORTAL_HELPFORUM;
    global $APTMAIL, $APTMAILTO;

    if (! $drewheader) {
	SPITHEADER();
    }
    echo "<br>";
    if ($msg) {
        echo $msg;
    }
    echo "<script type='text/javascript'>\n";
    echo "    window.ISEMULAB  = " . ($ISEMULAB ? "1" : "0") . ";\n";
    echo "    window.ISCLOUD   = " . ($ISCLOUD  ? "1" : "0") . ";\n";
    echo "    window.ISPNET    = " . ($ISPNET   ? "1" : "0") . ";\n";
    echo "    window.ISPOWDER  = " . ($ISPOWDER ? "1" : "0") . ";\n";
    echo "    window.ISAPT     = " . ($ISAPT    ? "1" : "0") . ";\n";
    echo "    window.MAINSITE  = " . ($TBMAINSITE ? "1" : "0") . ";\n";
    echo "    window.APTMAIL   = \"$APTMAIL\"\n";
    echo "    window.APTMAILTO = \"$APTMAILTO\"\n";
    echo "    window.HELPFORUM = " .
        "'https://groups.google.com/d/forum/${PORTAL_HELPFORUM}';\n";
    echo "</script>\n";
    if (!$spatrequired) {
	echo "<script src='js/lib/jquery-2.0.3.min.js'></script>\n";
	SPITNULLREQUIRE();
    }
    SPITFOOTER();
    die("");
};

$PAGEHEADER_FUNCTION = function($thinheader = 0, $nomenu = false,
				 $inline = false, $ignore3 = NULL)
{
    global $PORTAL_MANUAL, $PORTAL_HELPFORUM, $APTMAIL, $APTMAILTO;
    global $TBMAINSITE, $APTTITLE, $FAVICON, $APTLOGO, $APTSTYLE, $ISAPT;
    global $GOOGLEUA, $ISCLOUD, $TBBASE;
    global $ISPNET, $ISPOWDER, $ISEMULAB;
    global $login_user, $login_status, $SUPPORT, $FIRSTUSER;
    global $disable_accounts, $page_title, $drewheader, $embedded;
    global $UI_EXTERNAL_ACCOUNTS;
    $cleanmode = (isset($_COOKIE['cleanmode']) &&
                  $_COOKIE['cleanmode'] == 1 ? 1 : 0);
    $showmenus = 0;
    $title = $APTTITLE;
    if (isset($page_title)) {
	$title .= " - $page_title";
    }
    $height = ($thinheader ? 150 : 250);
    $drewheader = 1;
    $nonav = 0;

    #
    # Figure out who is logged in, if anyone.
    #
    if (($login_user = CheckLogin($status)) != null) {
	$login_status = $status;
	$login_uid    = $login_user->uid();
        $ga_userid    = $login_user->ga_userid();
    }
    if ($login_user && !($login_status & CHECKLOGIN_WEBONLY)) {
        $showmenus = 1;
    }
    if ($login_user && $login_user->RequireAUP() &&
        $page_title != "AUP" && $page_title != "Logout") {
        $referrer = urlencode($_SERVER['REQUEST_URI']);
        header("Location: portal-aup.php?referrer=$referrer");
        return;
    }
    if ($login_user && $login_user->Licenses() &&
        $page_title != "Licenses" && $page_title != "Logout") {
        $referrer = urlencode($_SERVER['REQUEST_URI']);
        header("Location: licenses.php?referrer=$referrer");
        return;
    }
    if ($login_user && $login_uid == "powdstop") {
        $cleanmode = 1;
        $nonav = 1;
        if ($page_title != "Logout" &&
            $page_title != "Powder Shutdown") {
            header("Location: powder-shutdown.php");
        }
    }

    header("Expires: Mon, 26 Jul 1997 05:00:00 GMT");
    header("Cache-Control: no-cache, must-revalidate");
    header("Pragma: no-cache");

    echo "<html>
      <head>
        <title>$title</title>
        <link rel='shortcut icon' href='$FAVICON'
              type='image/vnd.microsoft.icon'>
        <link rel='stylesheet' href='css/bootstrap.css'>
        <link rel='stylesheet' href='css/quickvm.css'>
        <link rel='stylesheet' href='css/$APTSTYLE'>\n";
    if ($ISPOWDER) {
        echo "<link href='https://www.powderwireless.net/powder/fonts/raleway/style.css' rel='stylesheet'>";
    }
    if ($TBMAINSITE) {
        if ($ISEMULAB) {
            # This might still be used by google. 
            echo "<meta name='description' ".
                "content='emulab - network emulation testbed home'>\n";
        }
    }
    echo "<script src='js/lib/jquery.min.js'></script>\n";
    echo "<script>APT_CACHE_TOKEN='" . Instance::CacheToken() . "';</script>";
    echo "<script src='js/common.js?nocache=asdfasdf'></script>
        <link rel='stylesheet' href='css/jquery-steps.css'>
        <script src='$TBBASE/emulab_sup.js'></script>
      </head>\n";

    if ($inline) {
        echo "<body>\n";
    }
    else {
        echo "<body style='display: none;'>\n";
    }

    echo "<script type='text/javascript'>\n";
    echo "    window.ISEMULAB = " . ($ISEMULAB ? "1" : "0") . ";\n";
    echo "    window.ISCLOUD  = " . ($ISCLOUD  ? "1" : "0") . ";\n";
    echo "    window.ISPNET   = " . ($ISPNET   ? "1" : "0") . ";\n";
    echo "    window.ISPOWDER = " . ($ISPOWDER ? "1" : "0") . ";\n";
    echo "    window.ISAPT    = " . ($ISAPT    ? "1" : "0") . ";\n";
    echo "    window.MAINSITE = " . ($TBMAINSITE ? "1" : "0") . ";\n";
    echo "    window.MANUAL   = '$PORTAL_MANUAL';\n";
    echo "    window.HELPFORUM = " .
        "'https://groups.google.com/d/forum/${PORTAL_HELPFORUM}';\n";
    echo "    window.EMBEDDED = $embedded;\n";
    echo "    window.SUPPORT  = '$SUPPORT';\n";
    echo "    window.APTTILE  = '$APTTITLE';\n";
    echo "    window.APTMAIL   = \"$APTMAIL\"\n";
    echo "    window.APTMAILTO = \"$APTMAILTO\"\n";
    echo "</script>\n";
    
    if ($TBMAINSITE && !$embedded && file_exists("../google-analytics.php")) {
	readfile("../google-analytics.php");
	echo "<script type='text/javascript'>\n";
        echo "  ga('create', '$GOOGLEUA', 'auto');\n";
        if ($login_user) {
            echo "  ga('set', 'userId', '$ga_userid');\n";
        }
        echo "  ga('send', 'pageview');\n";
        echo "  window.GOOGLEUA  = '$GOOGLEUA';\n";
        echo "</script>";
    }

    echo "
    <!-- Container for body, needed for sticky footer -->
    <div id='wrap'>\n";

    if ($embedded) {
	goto embed;
    }
    if ($nomenu) {
        return;
    }

    #
    # This is the stuff to the right of the logo.
    # 
    $navbar_status = "";
    $navbar_right  = "";
    $aptmargin = "";
    if (!$ISCLOUD && !$ISPNET && !$ISEMULAB || $ISPOWDER)
    {
        $aptmargin = "margin-top: 7px;";
    }

    if (!$disable_accounts) {
        if ($login_user && ISADMINISTRATOR() && !$cleanmode) {
            $navbar_status .= 
                "<li class='apt-left admin-toggle-container'>\n";
            
	    if (ISADMIN()) {
		$url = CreateURL("toggle", $login_user,
				 "type", "adminon", "value", 0);

                $navbar_status .=
                    "<a href='/$url' class='admin-toggle'>
                          <img src='images/redball.gif'
                               style='height: 10px; $aptmargin'
                               border='0' alt='Admin On'></a>\n";
	    }
	    else {
		$url = CreateURL("toggle", $login_user,
				 "type", "adminon", "value", 1);

                $navbar_status .=
                    "<a href='/$url' class='admin-toggle'>
                          <img src='images/greenball.gif'
                               style='height: 10px; $aptmargin'
                               border='0' alt='Admin Off'></a>\n";
	    }
            $navbar_status .= "</li>\n";
	}
	if (!NOLOGINS()) {
	    if (!$login_user) {
		if ($UI_EXTERNAL_ACCOUNTS == 0) {
                    $navbar_right .=
                        "<li id='signupitem' class='apt-left'>" .
                        "  <a class='btn btn-success navbar-btn apt-navbar-btn'
                                    id='signupbutton'
                                    href='signup.php'>Sign Up</a></li>\n";
		}
		if ($page_title != "Login") {
                    $navbar_right .=
                        "<li id='loginitem' class='apt-left'>" .
                        "  <a class='btn btn-quickvm-home navbar-btn apt-navbar-btn'
                                    id='loginbutton'>Login</a></li>\n";
		}
		REQUIRE_GENI_AUTH();
	    }
	}
    }
    # This is for dealing with the narowest window class; we hide some of
    # the buttons when a logged in user shrinks the window the window down,
    # and turn them on inside the action menu.
    $hiddenxs = ($showmenus ? "hidden-xs" : "");

    SPITNAV($hiddenxs, $nonav, $navbar_status, $navbar_right, $login_uid);

    # Put announcements, if any, right below the header.
    if (!$cleanmode && $login_user && $login_user->IsActive() &&
        !($login_status & CHECKLOGIN_WEBONLY)) {
        # Always create empty div for announcements, for ajax update.
        echo "<div id='portal-announcement-div'>\n";
        #
        # When a classic user hits the Portal interface for the first time,
        # enter a announcement for the user to make sure they know what is
        # going on and how to return to the Classic interface. I put a canned
        # announcement in the announce script. 
        #
        if (!$login_user->portal() && !$login_user->portal_interface_warned()) {
            SUEXEC($FIRSTUSER, "nobody",
                   "webannounce -a -U $login_uid -p emulab -m 10 -P",
                   SUEXEC_ACTION_CONTINUE);            
            $login_user->SetPortalWarned();
        }
        $announcements = GET_ANNOUNCEMENTS($login_user);
        for ($i = 0; $i < count($announcements); $i++) {
            echo $announcements[$i];
        }
        echo "</div>";
    }
    if (NOLOGINS()) {
        $message = TBGetSiteVar("web/message");
    }
    if ($message && $message != "" && !$cleanmode) {
        echo "<div class='alert alert-warning alert-dismissible'
                 role='alert' style='margin-top: -10px; padding: 5px;'>
                <center>$message</center>
          </div>";
    }

    #
    # Watch for a classic user switching over from the classic interface,
    # but already logged in, and without an encrypted certificate.
    # We really want to generate one so stuff does not break.
    #
    if ($login_user && !ISADMIN() &&
        $login_user->IsActive() && $login_user->isClassic() &&
        !$login_user->HasEncryptedCert(1)) {
        $login_user->GenEncryptedCert();
    }

    if ($login_user && !$cleanmode) {
        $pending = $login_user->PendingMembership();

        if (count($pending)) {
            # Just deal with the first, that is enough.
            $unproj = $pending[0];
            $leader = $unproj->GetLeader();
            $pid    = $unproj->pid();
            $mailto = "mailto:" . $unproj->ApprovalEmailAddress() .
                "?Subject=Pending Project $pid";
                
            echo "<div class=alert-danger ";
            echo "     style='margin-bottom: 6px; margin-top: -10px'>";
            echo "<center><span>";

            if ($login_user->SameUser($leader)) {
                echo "Your project application is still under review. ";
                echo "<a href='$mailto' class=alert-link>";
                echo "Contact the Review Committee.</a>";
            }
            else {
                echo "Your request for membership in project '$pid' has not ";
                echo "yet been approved by the project leader. ";
                #
                # Lets not nag the PI for at least a day.
                #
                $membership = $unproj->MemberShipInfo($login_user);
                $applied = strtotime($membership["date_applied"]);
                if (time() - $applied > 3600 * 18) {
                    echo "<a href='#' class=alert-link ";
                    echo "   onclick=\"APT_OPTIONS.nagPI(" . "'$pid'" . ")\"";
                    echo "   style='text-decoration: underline'>";
                    echo "Remind the Project Leader.</a>";
                }
            }
            echo "</span></center></div>";
        }
        list($pcount, $phours) = Instance::CurrentUsage($login_user);
        list($foo, $weeksusage) = Instance::WeeksUsage($login_user);
        list($foo, $monthsusage) = Instance::MonthsUsage($login_user);
        list($rank, $ranktotal) = Instance::Ranking($login_user, 30);
        if ($phours || $weeksusage || $monthsusage) {
            echo "<center style='margin-bottom: 5px; margin-top: -8px'>";
            if ($phours) 
                $phours = sprintf("%.2f", $phours);
            echo "<span class='text-info'>
                       Current Usage: $phours Node Hours</span>";
            if ($weeksusage) {
                $weeksusage = sprintf("%.0f", $weeksusage);
                echo ", ";
                echo "<span class='text-warning'>
                       Prev Week: $weeksusage</span>";
            }
            if ($monthsusage) {
                $monthsusage = sprintf("%.0f", $monthsusage);
                echo ", ";
                echo "<span class='text-danger'>
                       Prev Month: $monthsusage</span>";
                if ($rank) {
                    echo "<span class='text-info'>
                          (30 day rank: $rank of $ranktotal users)</span>";
                }
            }
            echo "<a href='#' class='btn btn-xs' data-toggle='modal' ".
                "data-target='#myusage_modal'> ".
                "<span class='glyphicon glyphicon-question-sign' ".
                "      style='margin-bottom: 4px;'></span> ".
                "</a>";
            echo "</center>\n";
        }
        readfile("template/myusage.html");
    }

    if (!NOLOGINS() && !$login_user && $page_title != "Login") {
	SpitLoginModal("quickvm_login_modal");
	SpitWaitModal("waitwait-modal");
    }
embed:
    echo " <!-- Page content -->
           <div class='container-fluid'>\n";
};

function SPITHEADER($thinheader = 0,
		    $ignore1 = NULL, $ignore2 = NULL, $ignore3 = NULL)
{
    global $PAGEHEADER_FUNCTION;

    $PAGEHEADER_FUNCTION($thinheader, $ignore1, $ignore2, $ignore3);
}

function SPITNAV($hiddenxs, $nonav, $navbar_status, $navbar_right, $login_uid)
{
    global $PORTAL_MANUAL, $APTLOGO, $login_status, $login_user, $TBMAINSITE;
    global $THISHOMEBASE, $ISEMULAB, $ISPNET, $ISPOWDER, $TBBASE;
    global $PORTAL_WIKI;
    global $UI_EXTERNAL_ACCOUNTS;
    $hiddenxs = "";
echo "

<div class='navbar portal-navbar' role='navigation'>
   <div class='navbar-header'>
      <button type='button' class='navbar-toggle collapsed' data-toggle='collapse' data-target='#main-navbar-collapse' aria-expanded='false'>
        <span class='sr-only'>Toggle navigation</span>
        <span class='icon-bar'></span>
        <span class='icon-bar'></span>
        <span class='icon-bar'></span>
      </button>
      <a class='navbar-brand' href='landing.php'><img src='images/$APTLOGO'/></a>";
echo "
    </div>

<div class='collapse navbar-collapse navbar-inner' id='main-navbar-collapse'>";
echo "  <ul class='nav navbar-nav navbar-left apt-left'>";
    if (! $TBMAINSITE) {
    #if (1) {
      echo "<li class='local-name apt-left apt-nav-item'>" . $THISHOMEBASE . "</li>";
    }

   if ($login_user && !$nonav && !($login_status & CHECKLOGIN_WEBONLY)) {

    if ($login_user->IsActive()) {
      $then = time() - (90 * 3600 * 24);
    
echo "
    <li id='quickvm_actions_menu' class='dropdown apt-left apt-nav-item $hiddenxs'> 
      <a href='#'
	 class='dropdown-toggle btn btn-quickvm-home navbar-btn'
	 data-toggle='dropdown'>
	Experiments <b class='caret'></b></a>
      <ul class='dropdown-menu'>
	<li><a href='instantiate.php'>Start Experiment</a></li>
	<li><a href='manage_profile.php'>Create Experiment Profile</a></li>
       <li><a href='reserve.php'>Reserve Nodes</a></li>
       <li><a href='resinfo.php'>Resource Availability</a></li>
       <li><a href='cluster-status.php'>Cluster Status</a></li>
        ";
echo " <li class='divider'></li>
        <li><a href='user-dashboard.php#experiments'>
	    My Experiments</a></li>
	<li><a href='user-dashboard.php#profiles'>
            My Profiles</a></li>
        <li><a href='list-reservations.php'>
            My Reservations</a></li>
        <li><a href='activity.php?user=$login_uid&min=$then'>
                            My History</a></li>";
# Classic users, using the Portal, get a link back to it. SAD!
if (!$login_user->portal()) {
    echo " <li class='divider'></li>";
    echo " <li><a href='$TBBASE/classic.php'>Emulab Classic</a></li>";
}
      echo "
    </ul>
    </li>
    <li id='quickvm_actions_menu' class='dropdown apt-left apt-nav-item $hiddenxs'> 
      <a href='#'
	 class='dropdown-toggle btn btn-quickvm-home navbar-btn'
	 data-toggle='dropdown'>
	Storage <b class='caret'></b></a>
      <ul class='dropdown-menu'>
	<li><a href='create-dataset.php'>Create Dataset</a></li>
	<li><a href='user-dashboard.php#datasets'>
	    My Datasets</a></li>
	<li><a href='list-images.php'>My Disk Images</a></li>
        <li><a href='images.php'>Other Disk Images</a></li>
      </ul>
    </li>
    ";
    }

    if ($login_user->IsActive() && (ISADMIN() || ISFOREIGN_ADMIN())) {
               echo "<li id='quickvm_actions_menu' class='dropdown apt-left apt-nav-item'>
                  <a href='#'
                        class='dropdown-toggle btn btn-quickvm-home navbar-btn'
                        data-toggle='dropdown'>
                    Admin <b class='caret'></b></a>
                  <ul class='dropdown-menu'>\n";
 	       if (ISADMIN() && HaveNews()) {
	           echo "  <li><a href='news.php'>News ";
	           if (NewNews()) {
	               echo "<span class='glyphicon glyphicon-asterisk ".
		            "             text-success' ".
		            "      style='margin-bottom: 4px;'></span> ";
	           }
	           echo "     </a></li>\n";
	       }
               echo "  <li><a href='dashboard.php'>DashBoard</a></li>";
               echo "  <li><a href='aggregate-status.php'>Cluster Status</a></li>";
               $then = time() - (14 * 3600 * 24);
               echo "  <li><a href='activity.php?min=$then'>
                            History Data</a></li>
		               <li><a href='sumstats.php?min=$then'>Summary Stats</a></li>
		      <li><a href='ranking.php'>User/Proj Ranking</a></li>";
		               echo "<li><a href='experiments.php#extending'>
                            Extension Requests</a></li>";
		               echo "<li><a href='experiments.php#all'>
                            All Experiments</a></li>
		                 <li><a href='list-profiles.php'>
                            All Profiles</a></li>
                                 <li><a href='list-reservations.php?force=1'>
                            All Reservations</a></li>
                                 <li><a href='list-resgroups.php'>
                            All ResGroups</a></li>
 		                 <li><a href='list-datasets.php'>
                            All Datasets</a></li>
                                 <li><a href='images.php?all=1'>
                            All Images</a></li>
                                 <li><a href='list-vlans.php'>
                            All Vlans</a></li>
                                 <li><a href='instance-errors.php'>
                            Experiment Errors</a></li>
                                 <li><a href='lists.php'>
                            Users/Projects</a></li>
                                 <li><a href='approve-projects.php'>
                            Approve new projects</a></li>
                                 <li><a href='sitevars.php'>
                            Edit Site Variables</a></li>";
                               echo " </ul>
        </li>\n";
    }
   }
   echo "</ul>";
   echo "  <ul class='nav navbar-nav navbar-right apt-right'>
    $navbar_status
    $navbar_right\n";

   echo "<li id='quickvm_actions_menu'
                 class='dropdown apt-left apt-nav-item'>
               <a href='#'
	          class='dropdown-toggle btn btn-quickvm-home navbar-btn'
	          data-toggle='dropdown'>Docs <b class='caret'></b></a>
               <ul class='dropdown-menu'>
                 <li><a href='$PORTAL_MANUAL' target='_blank'>Manual</a></li>";
   if ($PORTAL_WIKI) {
       echo "    <li><a href='$PORTAL_WIKI' target='_blank'>Wiki</a></li>";
   }
   echo "        <li><a href='example-profiles.php'
                                 target='_blank'>Example Profiles</a></li>";
   echo "      </ul>
         </li>\n";


   if ($login_user) {
   echo "
    <li id='quickvm_actions_menu' class='dropdown apt-left apt-nav-item'> 
      <a href='#'
	 class='dropdown-toggle btn btn-quickvm-home navbar-btn'
	 data-toggle='dropdown'>
	$login_uid <b class='caret'></b></a>
      <ul class='dropdown-menu'>\n";
       if (!$nonav && !($login_status & CHECKLOGIN_WEBONLY)) {
           echo "
	        <li><a href='myaccount.php'>Manage Account</a></li>
		<li><a href='signup.php'>Start/Join Project</a></li>";
           if ($UI_EXTERNAL_ACCOUNTS == 0) {
	        echo "<li><a href='changepswd.php'>Change Password</a></li>";
           }
               if ($login_user->isActive()) {
                   echo "
                 <li><a href='getcreds.php'>Download Credentials</a></li>
    	         <li><a href='ssh-keys.php'>Manage SSH Keys</a></li>
                 <li class='divider'></li>";
               }
       }
       echo "<li><a href='logout.php'>Logout</a></li>";
       echo "</ul>
           </li>";
    }
  echo "</ul>";
  echo "</div></div>";

}

function GET_ANNOUNCEMENTS($user, $update = true)
{
  global $PORTAL_GENESIS;
  $uid = $user->uid();
  $uid_idx = $user->uid_idx();
  $result = array();

  # Add an apt_announcement_info entry for any announcements which don't have one
  $query_result = DBQueryWarn('select a.idx from apt_announcements as a left join apt_announcement_info as i on a.idx=i.aid and ((a.uid_idx is NULL and i.uid_idx="'.$uid_idx.'") or (a.uid_idx is not NULL and a.uid_idx=i.uid_idx)) where a.portal="'.$PORTAL_GENESIS.'" and a.retired=0 and i.uid_idx is NULL and (a.uid_idx is NULL or a.uid_idx="'.$uid_idx.'")');
  while ($row = mysql_fetch_row($query_result)) {
      DBQueryWarn('insert into apt_announcement_info set aid="'.$row[0].'", uid_idx="'.$uid_idx.'",seen_count=0');
  }

  $query_result =
      DBQueryWarn('select a.idx, a.text, a.link_label, a.link_url, '.
                 '    i.seen_count, a.style, a.priority '.
                  'from apt_announcements as a '.
                  'left join apt_announcement_info as i on a.idx=i.aid '.
                  'where (a.uid_idx is NULL or a.uid_idx="'.$uid_idx.'") and '.
                  '      a.retired = 0 and a.portal="'.$PORTAL_GENESIS.'" and '.
                  '      i.uid_idx="'.$uid_idx.'" and '.
                  '      i.dismissed = 0 and i.clicked = 0 and '.
                  '      (a.max_seen = 0 or i.seen_count < a.max_seen) and '.
                  '      (a.display_start is null or now() > a.display_start) and '.
                  '      (a.display_end is null or now() < a.display_end) '.
                  'order by a.priority asc');

  while ($row = mysql_fetch_array($query_result)) {
      $text   = $row["text"];
      $style  = $row["style"];
      $label  = $row["link_label"];
      $url    = $row["link_url"];
      $aid    = $row["idx"];
      $count  = $row["seen_count"];

      if ($update) {
          $count = $count + 1;
          DBQueryWarn("update apt_announcement_info set ".
                      "  seen_count='$count' ".
                      "where aid='$aid' and uid_idx='$uid_idx'");
      }
      $html =
          "<div class='alert $style alert-dismissible' ".
          "     role='alert' style='margin-top: -10px; margin-bottom: 12px; ".
          "     margin-left: 40px; margin-right: 40px; ".
          "     padding-top: 10px; padding-bottom: 10px;'>\n";
      $html .=
          "  <button onclick='window.APT_OPTIONS.announceDismiss($aid)' " .
          "     type='button' class='close' ".
          "     data-dismiss='alert' aria-label='Close'>".
          "    <span aria-hidden='true'>&times;</span></button>".
          "      <span>$text</span>";

      if ($url) {
          $url = preg_replace('/\{uid_idx\}/', $uid_idx, $url);
          $url = preg_replace('/\{uid\}/', $uid, $url);

          $html .=
              "  <a href='$url' class='btn btn-xs btn-default' target='_blank' ".
              "    onclick='window.APT_OPTIONS.announceClick($aid)'>$label</a>";
      }
      $html .= "\n</div>\n";
      $result[] = $html;
  }
  return $result;
}

$PAGEFOOTER_FUNCTION = function($ignored = NULL) {
    global $PORTAL_HELPFORUM, $PORTAL_NSFNUMBER, $embedded, $PORTAL_TEMPLATES;

    echo "</div>";
    if (!$ignored) {
        echo "</div>\n";
    }
    if (!$embedded) {
        if ($PORTAL_NSFNUMBER) {
            SpitNSFModal();
        }
        echo "
          <!--- Footer -->
          <div>
           <div id='footer'>
            <div class='pull-left'>
              <a href='http://www.emulab.net' target='_blank'>
                 Powered by
                 <img src='images/emulab-whiteout.png' id='elabpower'></a>
            </div>
            <span>Question or comment? Join the
               <a href='https://groups.google.com/forum/#!forum/${PORTAL_HELPFORUM}'
                  target='_blank'>Help Forum</a></span>
               <div class='pull-right'>\n";
        if ($PORTAL_NSFNUMBER) {
            echo " <a data-toggle='modal' style='margin-right: 10px;'
                   href='#nsf_supported_modal'
	           data-target='#nsf_supported_modal'>Supported by NSF</a>\n";
        }
        echo "&copy; 2019
              <a href='http://www.utah.edu' target='_blank'>
                 The University of Utah</a>
            </div>
           </div>
          </div>
          <!-- Placed at the end of the document so the pages load faster -->\n";
    }
    EchoTemplateList($PORTAL_TEMPLATES);
    echo "</body></html>\n";
};

function SPITFOOTER($ignored = null)
{
    global $PAGEFOOTER_FUNCTION;

    $PAGEFOOTER_FUNCTION($ignored);
}

function SPITUSERERROR($msg)
{
    PAGEERROR($msg, 0);
}

function NoProjectMembershipError($this_user)
{
    global $drewheader, $PAGEERROR_HANDLER;
    
    if (! $drewheader) {
	SPITHEADER();
    }
    echo "<br>";
    echo "<p class=lead>";
    echo "Oops, you are not a member of any projects in which you have ".
        "permission to access this page! ";
    echo "</p>";
    echo "<p>";
    if ($this_user->IsNonLocal()) {
        echo
            "Typically this is because you are not a member of any projects ".
            "at your home portal (say, the Geni Portal). You must log into ".
            "your home portal and request membership in a project, or start ".
            "your own project. Once your membership or project is approved ".
            "at your home portal, you can come back here and log back in.";
    }
    else {
        echo
            "Typically this is because you are not yet an approved member of ".
            "any projects with sufficient privileges. If you are still ".
            "awaiting approval or need your privileges adjusted, please ".
            "contact your project leader. If you are waiting for a new ".
            "project to be approved, please be patient, it can take a week ".
            "to approve a new project request.";
    }
    echo "</p>";
    echo "<br>";
    $PAGEERROR_HANDLER();
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
}

function SPITAJAX_ERROR($code, $msg)
{
    $results = array(
	'code'  => $code,
	'value' => $msg
	);
    echo json_encode($results);
}

#
# Spit out an info tooltip.
#
function SpitToolTip($info)
{
    echo "<a href='#' class='btn btn-xs' data-toggle='popover' ".
	"data-content='$info'> ".
        "<span class='glyphicon glyphicon-question-sign'></span> ".
        "</a>\n";
}

#
# Spit out the verify modal. We are not using real password authentication
# like the rest of the Emulab website. Assumed to be inside of a form
# that handles a create button.
#
function SpitVerifyModal($id, $label)
{
    echo "<!-- This is the user verify modal -->
          <div id='$id' class='modal fade'>
            <div class='modal-dialog'>
            <div class='modal-content'>
               <div class='modal-header'>
                <button type='button' class='close' data-dismiss='modal'
                   aria-hidden='true'>&times;</button>
                <h3>Important</h3>
               </div>
               <div class='modal-body'>
                    <p>Check your email for a verification code, and
                       enter it here:</p>
                       <div class='form-group'>
                        <input name='verify' class='form-control'
                               placeholder='Verification code'
                               autofocus type='text' />
                       </div>
                       <div class='form-group'>
                        <button class='btn btn-primary form-control'
                            id='verify_modal_submit'
                            type='submit' name='create'>
                            $label</button>
                       </div>
               </div>
            </div>
            </div>
         </div>\n";
}

#
# Spit out the login modal. 
#
function SpitLoginModal($id)
{
    global $PORTAL_PASSWORD_HELP;
    global $APTTITLE, $ISCLOUD, $ISPNET, $ISPOWDER;
    $referrer = CleanString($_SERVER['REQUEST_URI']);
?>
    <!-- This is the login modal -->
    <div id='<?php echo $id ?>' class='modal fade' role='dialog'>
        <div class='modal-dialog'>
        <div id='quickvm_login_form_error'
             class='align-center'></div>
        <div class='modal-content'>
           <div class='modal-header'>
            <button type='button' class='close' data-dismiss='modal'
               aria-hidden='true'>&times;</button>
               <h4 class='modal-title'>Log in to <?php echo $APTTITLE ?></h4>
           </div>
           <form id='quickvm_login_form'
                 role='form'
                 method='post' action='login.php'>
           <input type=hidden name=referrer value='<?php echo $referrer ?>'>
           <div class='modal-body form-horizontal'>
             <div class='form-group'>
                <label for='uid' class='col-sm-2 control-label'>Username</label>
                <div class='col-sm-10'>
                    <input name='uid' class='form-control'
                           placeholder='<?php echo $PORTAL_PASSWORD_HELP ?>'
                           autofocus type='text'>
                </div>
             </div>
             <div class='form-group'>
                <label for='password' class='col-sm-2 control-label'>Password
					  </label>
                <div class='col-sm-10'>
                   <input name='password' class='form-control'
                          placeholder='Password'
                          type='password'>
                </div>
             </div>
             <div class='form-group'>
               <div class='col-sm-offset-2 col-sm-10'>
<?php
    if ($ISCLOUD || $ISPNET) {
	?>
                 <button class='btn btn-info btn-sm pull-left' disabled
		    type='button'
                    data-toggle="tooltip" data-placement="left"
		    title="You can use your geni credentials to login"
                    id='quickvm_geni_login_button'>Geni User?</button>
        <?php
    }
?>
                 <button class='btn btn-primary btn-sm pull-right'
                         id='quickvm_login_modal_button'
                         type='submit' name='login'>Login</button>
               </div>
             </div>
           </div>
           </form>
        </div>
        </div>
     </div>
<?php
}

#
# Please Wait.
#
function SpitWaitModal($id)
{
    echo "<!-- This is the Please Wait modal -->
          <div id='$id' class='modal fade'>
            <div class='modal-dialog'>
            <div class='modal-content'>
               <div class='modal-header'>
                <center><h3>Please Wait</h3></center>
               </div>
               <div class='modal-body'>
                 <center><img src='images/spinner.gif' /></center>
               </div>
            </div>
            </div>
         </div>\n";
    ?>
	<script>
	function ShowWaitModal(name) { $('#' + name).modal('show'); }
	function HideWaitModal(name) { $('#' + name).modal('hide'); }
	</script>
    <?php
}

#
# Oops modal.
#
function SpitOopsModal($id)
{
    echo "<!-- This is the Oops modal -->
          <div id='${id}_modal' class='modal fade'>
            <div class='modal-dialog'>
            <div class='modal-content'>
               <div class='modal-header'>
                 <button type='button'
                      class='btn btn-default btn-sm pull-right' 
                      data-dismiss='modal' aria-hidden='true'>
                   Close</button>
                 <center><h3>Oops!</h3></center>
               </div>
               <div class='modal-body'>
                 <div id='${id}_text'></div>
               </div>
            </div>
            </div>
         </div>\n";
}

function SpitNSFModal()
{
    global $PORTAL_NSFNUMBER;
    
    echo "<!-- This is the NSF Supported modal -->
          <div id='nsf_supported_modal' class='modal fade'>
            <div class='modal-dialog'>
             <div class='modal-content'>
              <div class='modal-body'>
                This material is based upon work supported by the
                National Science Foundation under Grant
                No. ${PORTAL_NSFNUMBER}. Any opinions, findings, and
                conclusions or recommendations expressed in this
                material are those of the author(s) and do not
                necessarily reflect the views of the National Science
                Foundation.
                <br><br>
                <center>
                <button type='button'
                     class='btn btn-default btn-sm' 
                     data-dismiss='modal' aria-hidden='true'>
                  Close</button>
                </center>
              </div>
             </div>
            </div>
         </div>\n";
}

function SpitPageReplace($newpage, $when = 0) {
    $when = $when * 1000;
    
    echo "<script type='text/javascript' language='javascript'>\n";
    echo "setTimeout(function f() { ";
    echo "   window.location.replace('$newpage'); }, $when)\n";
    echo "</script>\n";
}

#
# Generate an authentication object to pass to the browser that
# is passed to the web server on boss. This is used to grant
# permission to the user to invoke ssh to a local node using their
# emulab generated (no passphrase) key. This is basically a clone
# of what GateOne does, but that code was a mess. 
#
function SSHAuthObject($uid, $nodeid)
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
		     'stuff'     => $stuff,
		     'nodeid'    => $nodeid,
		     'timestamp' => $now,
		     'baseurl'   => "https://${USERNODE}",
		     'signature_method' => 'HMAC-SHA1',
		     'api_version' => '1.0',
		     'signature' => hash_hmac('sha1',
					      $uid . $stuff . $nodeid . $now,
					      $key),
    );
    return json_encode($authobj);
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

#
# Redirect request to https
#
function RedirectSecure()
{
    global $APTHOST;

    if (!isset($_SERVER["SSL_PROTOCOL"])) {
	header("Location: https://$APTHOST". $_SERVER['REQUEST_URI']);
	exit();
    }
}

#
# Redirect to the login page()
#
function RedirectLoginPage()
{
    # HTTP_REFERER will not work reliably when redirecting so
    # pass in the URI for this page as an argument
    header("Location: login.php?referrer=".
	   urlencode($_SERVER['REQUEST_URI']));
    exit(0);
}

#
# Check the login and redirect to login page. We use NONLOCAL modifier
# since the classic emulab interface refuses service to nonlocal users.
#
function CheckLoginOrRedirect($modifier = 0)
{
    RedirectSecure();
    
    $check_status = 0;
    $this_user    = CheckLogin($check_status);
    if (! ($check_status & CHECKLOGIN_LOGGEDIN)) {
	RedirectLoginPage();
    }
    CheckLoginConditions($check_status & ~($modifier|CHECKLOGIN_NONLOCAL));
    return $this_user;
}

#
# See if there is recent news and news of any kind.
#
function HaveNews()
{
    $query_result = DBQueryFatal("select idx from apt_news limit 1");
    return mysql_num_rows($query_result);
}
function NewNews()
{
    # Within the last week.
    $query_result = 
	DBQueryFatal("select idx from apt_news ".
                     "where (UNIX_TIMESTAMP(now()) - ".
                     "       UNIX_TIMESTAMP(created)) < (24 * 3600 * 7) ".
                     "limit 1");
    return mysql_num_rows($query_result);
}

?>
