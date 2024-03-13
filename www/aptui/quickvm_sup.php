<?php
#
# Copyright (c) 2000-2023 University of Utah and the Flux Group.
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
#
# Slowly moving to bootstrap 5. Defined in the page
#
if (!isset($BOOTSTRAP5OK)) {
    $BOOTSTRAP5OK = false;
}
if (!isset($BOOTSTRAP5ONLY)) {
    $BOOTSTRAP5ONLY = false;
}
# allow URL override
if (isset($_REQUEST["bootstrap5"])) {
    if ($_REQUEST["bootstrap5"] == 1) {
        $BOOTSTRAP5OK = true;
    }
    else {
        $BOOTSTRAP5OK = false;
    }
}
define("BOOTSTRAP5", $BOOTSTRAP5OK || $BOOTSTRAP5ONLY);

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

# Global flage to allow specific pages to let themselves be iframed.
$page_allowframing = 0;

# For backend scripts to know how they were invoked.
if (isset($_SERVER['SERVER_NAME'])) { 
    putenv("SERVER_NAME=" . $_SERVER['SERVER_NAME']);
}

#
# Spit out the global variables we always want. 
#
$spatglobals = 0;

function SpitGlobals()
{
    global $spatglobals;
    global $ISCLOUD, $ISPNET, $ISEMULAB, $ISAPT, $ISPOWDER;
    global $TBMAINSITE, $PORTAL_HELPFORUM, $APTBASE;
    global $APTMAIL, $APTMAILTO, $PROTOGENI_GENIWEBLOGIN, $TBBASE;
    global $PORTAL_MANUAL, $PORTAL_WIKI, $PORTAL_NSFNUMBER;
    global $embedded, $SUPPORT, $APTTITLE, $PORTAL_NAME, $TBBASE;

    echo "<script type='text/javascript'>\n";
    echo "    window.ISEMULAB  = " . ($ISEMULAB ? "1" : "0") . ";\n";
    echo "    window.ISCLOUD   = " . ($ISCLOUD  ? "1" : "0") . ";\n";
    echo "    window.ISPNET    = " . ($ISPNET   ? "1" : "0") . ";\n";
    echo "    window.ISPOWDER  = " . ($ISPOWDER ? "1" : "0") . ";\n";
    echo "    window.ISAPT     = " . ($ISAPT    ? "1" : "0") . ";\n";
    echo "    window.MAINSITE  = " . ($TBMAINSITE ? "1" : "0") . ";\n";
    echo "    window.PGENILOGIN  = " .
        ($PROTOGENI_GENIWEBLOGIN ? "1" : "0") . ";\n";
    echo "    window.APTMAIL   = \"$APTMAIL\"\n";
    echo "    window.APTMAILTO = \"$APTMAILTO\"\n";
    echo "    window.HELPFORUM = " .
        "'https://groups.google.com/d/forum/${PORTAL_HELPFORUM}';\n";
    echo "    window.CLASSIC  = '$TBBASE';\n";
    echo "    window.MANUAL   = '$PORTAL_MANUAL';\n";
    if ($PORTAL_WIKI) {
        echo "    window.WIKI     = '$PORTAL_WIKI';\n";
    }
    if ($PORTAL_NSFNUMBER) {
        echo "    window.PORTAL_NSFNUMBER = '$PORTAL_NSFNUMBER';\n";
    }
    echo "    window.EMBEDDED = $embedded;\n";
    echo "    window.SUPPORT  = '$SUPPORT';\n";
    echo "    window.APTTILE  = '$APTTITLE';\n";
    echo "    window.APTMAIL   = \"$APTMAIL\";\n";
    echo "    window.APTMAILTO = \"$APTMAILTO\";\n";
    echo "    window.PORTAL_NAME = \"$PORTAL_NAME\"\n";
    echo "    window.CLASSIC = '$TBBASE';\n";
    echo "</script>\n";
    
    $spatglobals = 1;
}

#
# Redefine this so APT errors are styled properly. Called by PAGEERROR();.
#
$PAGEERROR_HANDLER = function($msg = null, $status_code = 0) {
    global $drewheader;
    global $spatrequired, $spatglobals;
    global $APTBASE;

    if (! $drewheader) {
	SPITHEADER();
    }
    echo "<br>";
    if ($msg) {
        echo $msg;
    }
    if (! $spatglobals) {
        SpitGlobals();
    }
    if (!$spatrequired) {
	echo "<script src='$APTBASE/js/lib/jquery.min.js'></script>\n";
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
    global $GOOGLEUA, $ISCLOUD, $TBBASE, $PORTAL_GENESIS, $APTBASE;
    global $ISPNET, $ISPOWDER, $ISEMULAB, $PROTOGENI_GENIWEBLOGIN;
    global $THISHOMEBASE, $UI_DISABLE_DATASETS, $UI_DISABLE_RESERVATIONS;
    global $login_user, $login_status, $SUPPORT, $FIRSTUSER, $PORTAL_NAME;
    global $disable_accounts, $page_title, $drewheader, $embedded;
    global $UI_EXTERNAL_ACCOUNTS, $BrandMapping, $page_allowframing;
    global $PORTAL_WIKI, $PORTAL_NSFNUMBER, $GOOGLEGAIDS;

    
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
    $noannouncements = 0;
    $parsed_url = parse_url($_SERVER['REQUEST_URI']);
    $script = basename($parsed_url["path"]);

    #
    # Figure out who is logged in, if anyone.
    #
    if (($login_user = CheckLogin($status)) != null) {
	$login_status = $status;
	$login_uid    = $login_user->uid();
        $ga_userid    = $login_user->ga_userid();
        if ($login_user->IsTutorialUser()) {
            # TUTORIALPID
            $noannouncements = 1;
        }
    }
    if ($login_user && !($login_status & CHECKLOGIN_WEBONLY)) {
        $showmenus = 1;
    }
    if ($TBMAINSITE && $login_user &&
        $login_user->bound_portal() && $login_user->portal() &&
        $login_user->portal() != $PORTAL_GENESIS) {
        $portal_url  = $BrandMapping[$login_user->portal()];
        $portal_url .= str_replace("/portal/", "/", $_SERVER['REQUEST_URI']);
        header("Location: $portal_url");
        return;
    }
    if ($login_user && $login_uid == "powdstop") {
        $cleanmode = 1;
        $nonav = 1;
        if ($script != "logout.php" &&
            $script != "powder-shutdown.php") {
            header("Location: powder-shutdown.php");
        }
    }
    elseif ($login_user && ($login_status & CHECKLOGIN_PSWDEXPIRED)) {
        # Bypass the next set of checks, let this proceed. User will
        # be back here later.
        ;
    }
    elseif ($login_user && $login_user->IsActive()) {
        if ($login_user->NeedAccountUpdate()) {
            if ($script != "myaccount.php" && $script != "logout.php") {
                $referrer = urlencode($_SERVER['REQUEST_URI']);
                header("Location: myaccount.php".
                       "?referrer=$referrer&needupdate=1");
                return;
            }
        }
        elseif ($login_user->NeedScopusValidation()) {
            if ($script != "verify-match.php" && $script != "logout.php") {
                $referrer = urlencode($_SERVER['REQUEST_URI']);
                header("Location: verify-match.php?referrer=$referrer");
                return;
            }
        }
        elseif ($login_user->RequireAUP()) {
            if ($script != "portal-aup.php" && $script != "logout.php") {
                $referrer = urlencode($_SERVER['REQUEST_URI']);
                header("Location: portal-aup.php?referrer=$referrer");
                return;
            }
        }
        elseif ($login_user->Licenses()) {
            if ($script != "licenses.php" && $script != "logout.php") {
                $referrer = urlencode($_SERVER['REQUEST_URI']);
                header("Location: licenses.php?referrer=$referrer");
                return;
            }
        }
    }

    header("Expires: Mon, 26 Jul 1997 05:00:00 GMT");
    header("Cache-Control: no-cache, must-revalidate");
    header("Pragma: no-cache");
    if (!$page_allowframing) {
        header("X-Frame-Options: SAMEORIGIN");
    }
    
    echo "<html>
      <head>\n";
    if ($TBMAINSITE && !$embedded && $ISCLOUD && file_exists($GOOGLEGAIDS)) {
        echo "<!-- Google Tag Manager -->
              <script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
              new Date().getTime(),event:'gtm.js'});
              var f=d.getElementsByTagName(s)[0],
              j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';
              j.async=true;j.src=
              'https://www.googletagmanager.com/gtm.js?id='+i+dl;
              f.parentNode.insertBefore(j,f);
              })(window,document,'script','dataLayer','GTM-TSZK7GW');</script>
              <!-- End Google Tag Manager --> \n";
    }
    echo "<title>$title</title>
        <link rel='shortcut icon' href='$APTBASE/$FAVICON'
              type='image/vnd.microsoft.icon'>";
    if (BOOTSTRAP5) {
        echo "<link rel='stylesheet'
                    href='$APTBASE/css/bootstrap-5/bootstrap.css'>\n";
        echo "<link rel='stylesheet' href='$APTBASE/css/quickvm.css'>\n";
        echo "<link rel='stylesheet'
                    href='$APTBASE/css/bootstrap-5/compat.css'>\n";
    }
    else {
        echo "<link rel='stylesheet' href='$APTBASE/css/bootstrap.css'>";
        echo "<link rel='stylesheet' href='$APTBASE/css/quickvm.css'>";
        echo "<link rel='stylesheet'
                    href='$APTBASE/css/bootstrap-5/backwards.css'>\n";
    }
    echo "<link rel='stylesheet' href='$APTBASE/css/multilevel.css'>\n";
    echo "<link rel='stylesheet' href='$APTBASE/css/$APTSTYLE'>\n";
    if (!BOOTSTRAP5 && $ISEMULAB) {
        #
        # Ug, weird compat problem caused by the Emulab header and
        # flex boxes. Hard to fix, but this little change is easy
        # until all of the pages are converted.
        #
        echo "<style>\n";
        echo ".portal-navbar .navbar-header { margin-top: 0px; }\n";
        echo "</style>\n";
    }
    if ($TBMAINSITE) {
        if ($ISEMULAB) {
            # This might still be used by google. 
            echo "<meta name='description' ".
                "content='emulab - network emulation testbed home'>\n";
        }
    }
    echo "<script src='$APTBASE/js/lib/jquery.min.js'></script>\n";
    echo "<script>APT_CACHE_TOKEN='" . Instance::CacheToken() . "';</script>";
    echo "<script src='$APTBASE/js/common.js?nocache=asdfasdf'></script>
        <link rel='stylesheet' href='$APTBASE/css/jquery-steps.css'>
        <script src='$TBBASE/emulab_sup.js'></script>
        <script src='$APTBASE/js/lib/underscore-min.js'></script>
      </head>\n";

    if ($inline) {
        echo "<body>\n";
    }
    else {
        echo "<body style='display: none;'>\n";
    }

    echo "<script type='text/javascript'>\n";
    echo "    window.LOGINUID  = " .
        ($login_user ? "'$login_uid'" : "null") . ";\n";
    # For TUTORIALPID
    echo "    window.NOANNOUNCEMENTS = $noannouncements\n";
    echo "</script>\n";
    SpitGlobals();

    if ($TBMAINSITE && !$embedded && !$ISCLOUD && file_exists($GOOGLEGAIDS)) {
        $json = file_get_contents($GOOGLEGAIDS);
        $ids  = json_decode($json, true);

        if (array_key_exists($PORTAL_GENESIS, $ids)) {
            $gua = $ids[$PORTAL_GENESIS];
            $gaurl = "https://www.googletagmanager.com/gtag/js?id=${gua}";

            echo "<script async src='$gaurl'></script>
                  <script>
                     window.dataLayer = window.dataLayer || [];
                     function gtag(){dataLayer.push(arguments);}
                     gtag('js', new Date());\n";
            if ($login_user) {
                echo "gtag('config', '$gua', {'user_id' : '$ga_userid'});\n";
            }
            else {
                echo "gtag('config', '$gua');\n";
            }
            echo "window.GOOGLEUA = '$gua';
                  </script>\n";
        }
    }

    # HEADER variables
    $headervars = array();
    $addHeaderVariable = function ($name, $value) use (&$headervars) {
        $headervars[$name] = $value;
    };
    $addHeaderVariable("disable_accounts", $disable_accounts);
    $addHeaderVariable("cleanmode", $cleanmode);
    $addHeaderVariable("nonav", $nonav);
    $addHeaderVariable("login_uid", $login_user ? $login_uid : null);
    $addHeaderVariable("NOLOGINS", NOLOGINS() ? 1 : 0);
    $addHeaderVariable("UI_EXTERNAL_ACCOUNTS", $UI_EXTERNAL_ACCOUNTS);
    $addHeaderVariable("UI_DISABLE_RESERVATIONS", $UI_DISABLE_RESERVATIONS);
    $addHeaderVariable("UI_DISABLE_DATASETS", $UI_DISABLE_DATASETS);
    $addHeaderVariable("page_title", $page_title);
    if ($login_user) {
        $addHeaderVariable("isadministrator", ISADMINISTRATOR() ? 1 : 0);
        $addHeaderVariable("isadmin", ISADMIN() ? 1 : 0);
        $addHeaderVariable("isforeign_admin", ISFOREIGN_ADMIN() ? 1 : 0);
        $addHeaderVariable("WEBONLY", $login_status & CHECKLOGIN_WEBONLY ? 1 : 0);
        $addHeaderVariable("isactive", $login_user->IsActive() ? 1 : 0);
        $addHeaderVariable("classic_user", $login_user->portal() ? 0 : 1);
        $addHeaderVariable("newNews", $login_user->APTNewNews() ? 1 : 0);
        $addHeaderVariable("anyNews", $login_user->APTAnyNews() ? 1 : 0);
        $addHeaderVariable("login_idx", $login_user->uid_idx());
    }
    $addHeaderVariable("APTLOGO", "${APTBASE}/images/${APTLOGO}");
    $addHeaderVariable("THISHOMEBASE", $THISHOMEBASE);
    if (NOLOGINS()) {
        $message = TBGetSiteVar("web/message");
        if ($message && $message != "" && !$cleanmode) {
            $addHeaderVariable("message", $message);
        }
    }
    if ($login_user)  {
        $recents = Instance::RecentExperiments($login_user);
        if ($recents) {
            $addHeaderVariable("recents", $recents);
        }

        $pending = $login_user->PendingMembership();
        if (count($pending)) {
            # Just deal with the first, that is enough.
            $unproj = $pending[0];
            $leader = $unproj->GetLeader();
            $unpid  = $unproj->pid();
            
            if ($login_user->SameUser($leader)) {
                # Nag the approval committee.
                $mailto = $unproj->ApprovalEmailAddress() .
                        "?Subject=Pending Project $unpid";
                
                $addHeaderVariable("NAGUS", "${mailto}");
            }
            else {
                # Nag the PI.
                $addHeaderVariable("NAGPI", "${unpid}");
                #
                # Lets not nag the PI for at least a day.
                #
                $membership = $unproj->MemberShipInfo($login_user);
                $applied = strtotime($membership["date_applied"]);
                if (time() - $applied > 3600 * 18) {
                    $addHeaderVariable("NAGNOW", 1);
                }                    
            }
        }
        list($foo, $phours) = Instance::CurrentUsage($login_user);
        list($foo, $weeksusage) = Instance::WeeksUsage($login_user);
        list($foo, $monthsusage) = Instance::MonthsUsage($login_user);
        list($rank, $ranktotal) = Instance::Ranking($login_user, 30);
        if ($phours || $weeksusage || $monthsusage) {
            $addHeaderVariable("phours", sprintf("%.2f", $phours));
            $addHeaderVariable("week", sprintf("%.2f", $weeksusage));
            $addHeaderVariable("month", sprintf("%.2f", $monthsusage));
            $addHeaderVariable("rank", $rank);
            $addHeaderVariable("ranktotal", $ranktotal);
        }
    }
    if ($embedded) {
	goto embed;
    }
    echo "
    <!-- Container for body, needed for sticky footer -->
    <div id='wrap'>\n";

    if ($nomenu) {
        return;
    }

    #
    # The header navbar is now a template.
    #
    EchoTemplate("mainHeader", "template/header.html");
    echo "<div id='mainheader-div'></div>\n";
    
    echo "<script type='text/plain' id='mainheader-json'>\n";
    echo htmlentities(json_encode($headervars, JSON_NUMERIC_CHECK)) . "\n";
    echo "</script>\n";
    
    echo "<script type='text/javascript'>\n";
    echo "  window.APT_OPTIONS.drawMainHeader();\n";
    echo "</script>\n";

    if (!$disable_accounts && !NOLOGINS() && !$login_user) {
        REQUIRE_GENI_AUTH();
    }

    #
    # When a classic user hits the Portal interface for the first time,
    # enter a announcement for the user to make sure they know what is
    # going on and how to return to the Classic interface. I put a canned
    # announcement in the announce script. 
    #
    if ($login_user && $login_user->IsActive() &&
        !($login_status & CHECKLOGIN_WEBONLY) &&
        !$login_user->portal() && !$login_user->portal_interface_warned()) {
        SUEXEC($FIRSTUSER, "nobody",
               "webannounce -a -U $login_uid -p emulab -m 10 -P",
               SUEXEC_ACTION_CONTINUE);            
        $login_user->SetPortalWarned();
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

function GET_ANNOUNCEMENTS($user, $update = true)
{
  global $PORTAL_GENESIS;
  $uid = $user->uid();
  $uid_idx = $user->uid_idx();
  $result = array();

  #
  # Add an apt_announcement_info entry for any announcements this
  # user has not seen yet. We are not locking this table, but instead
  # we can use insert ignore to make sure we do not try get an error
  # in the obvious race; the user loading pages at the same time, say
  # when I restart Chrome and dozens of tabs all reload at the same time.
  # I was getting multiple alerts for same announcement cause of
  # mulitple entries in the apt_announcement_info for me. 
  #
  $query_result =
        DBQueryWarn('select a.idx from apt_announcements as a '.
                    'left join apt_announcement_info as i on '.
                    '     a.idx=i.aid and '.
                    '     ((a.uid_idx is NULL and i.uid_idx="'.$uid_idx.'") or '.
                    '      (a.uid_idx is not NULL and a.uid_idx=i.uid_idx)) '.
                    'where a.portal="'.$PORTAL_GENESIS.'" and '.
                    '      a.retired=0 and i.uid_idx is NULL and '.
                    '      (a.uid_idx is NULL or a.uid_idx="'.$uid_idx.'")');
  while ($row = mysql_fetch_row($query_result)) {
      DBQueryWarn('insert ignore into apt_announcement_info set '.
                  '    aid="'.$row[0].'", uid_idx="'.$uid_idx.'",seen_count=0');
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
          "     padding-top: 10px; padding-bottom: 10px;'>\n";
      $html .=
          "  <button onclick='window.APT_OPTIONS.announceDismiss($aid)' " .
          "     type='button' class='close btn-close' ".
          "     data-dismiss='alert' data-bs-dismiss='alert' aria-label='Close'>".
          "    <span aria-hidden='true'></span></button>".
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
    global $APTBASE;

    if (!$ignored) {
        echo "</div>\n";
    }
    if (!$embedded) {
        echo "</div>\n";
        
        #
        # The footer is now a template.
        #
        EchoTemplate("mainFooter", "template/footer.html");
        echo "<div id='mainfooter-div'></div>\n";
    
        echo "<script type='text/javascript'>\n";
        echo "  window.APT_OPTIONS.drawMainFooter();\n";
        echo "</script>\n";
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
function SignAuthObject($blob)
{
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
    $sig   = hash_hmac('sha1',
                       $blob["uid"] . $stuff . $blob["nodeid"] . $now,
                       $key);

    $blob["stuff"]     = $stuff;
    $blob["timestamp"] = $now;
    $blob["signature"] = $sig;

    return json_encode($blob);
}

function SSHAuthObject($uid, $hostport)
{
    global $USERNODE, $WWWHOST;
    global $BROWSER_CONSOLE_WEBSSH, $BROWSER_CONSOLE_PROXIED;
	
    if ($BROWSER_CONSOLE_PROXIED) {
        $baseurl = "https://${WWWHOST}";
    }
    else {
        $baseurl = "https://${USERNODE}";
    }
    if ($BROWSER_CONSOLE_WEBSSH) {
        # See httpd.conf
        $baseurl .= "/webssh";
    }
    $authobj = array('uid'       => $uid,
		     'nodeid'    => $hostport,
		     'baseurl'   => $baseurl,
		     'signature_method' => 'HMAC-SHA1',
                     'webssh'    => $BROWSER_CONSOLE_WEBSSH,
		     'api_version' => '1.0',
    );
    return SignAuthObject($authobj);
}
# Ditto for VNC
function VNCAuthObject($uid, $hostport)
{
    global $USERNODE, $WWWHOST;
    global $BROWSER_CONSOLE_WEBSSH, $BROWSER_CONSOLE_PROXIED;

    # Only when we are using webssh.
    if (!$BROWSER_CONSOLE_WEBSSH) {
        return null;
    }
	
    if ($BROWSER_CONSOLE_PROXIED) {
        $baseurl = "https://${WWWHOST}";
    }
    else {
        $baseurl = "https://${USERNODE}";
    }
    $authobj = array('uid'       => $uid,
		     'nodeid'    => $hostport,
		     'baseurl'   => $baseurl,
		     'signature_method' => 'HMAC-SHA1',
                     'vncproxy'  => 1,
		     'api_version' => '1.0',
    );
    return SignAuthObject($authobj);
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

?>
