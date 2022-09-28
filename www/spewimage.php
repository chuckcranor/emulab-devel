<?php
#
# Copyright (c) 2003-2019, 2022 University of Utah and the Flux Group.
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
include_once("imageid_defs.php");

function SPITERROR($code, $msg)
{
    header("HTTP/1.0 $code $msg");
    exit();
}

#
# Capture script errors and report back to user.
#
$session_interactive  = 0;
$session_errorhandler = 'handle_error';

function handle_error($message, $death)
{
    SPITERROR(400, $message);
}

#
# Must be SSL, even though we do not require an account login.
#
if (!isset($_SERVER["SSL_PROTOCOL"])) {
    SPITERROR(400, "Must use https:// to access this page!");
}

#
# Verify page arguments.
#
$reqargs = RequiredPageArguments("image",	PAGEARG_IMAGE,
				 "access_key",	PAGEARG_STRING);
$optargs = OptionalPageArguments("stamp",       PAGEARG_INTEGER,
                                 "delta",       PAGEARG_BOOLEAN,
                                 "sigfile",     PAGEARG_BOOLEAN);

#
# A cleanup function to keep the child from becoming a zombie.
#
$fp = 0;

function SPEWCLEANUP()
{
    global $fp;

    if (!$fp) {
        exit(0);
    }
    # 
    # Either we aborted or client aborted before we sent everything.
    # Make sure we flush whatever is left since we cannot kill the
    # process, no handle on it. I would use proc_open(), but then I
    # would have to make sense of it. 
    #
    while (!feof($fp)) {
        $string = fgets($fp);
    }
    pclose($fp);
    $fp = 0;
    exit();
}
set_time_limit(0);
register_shutdown_function("SPEWCLEANUP");

#
# Invoke backend script to do it all.
#
$imageid    = $image->imageid();
$versid     = $image->versid();
$access_key = escapeshellarg($access_key);
$arg        = "";
$arg       .= (isset($stamp) ? "-t " . escapeshellarg($stamp) : "");
$arg       .= (isset($sigfile) && $sigfile ? "-s " : "");
$arg       .= (isset($delta) && $delta ? "-e " : "");
$group      = $image->Group();
$pid        = $group->pid();
$unix_gid   = $group->unix_gid();
$project    = $image->Project();
$unix_pid   = $project->unix_gid();
$rangearg   = "";

if ($image->noexport()) {
    SPITERROR(403, "This image is marked as export restricted");
}
if (!$image->isglobal()) {
    SPITERROR(403, "No permission to access image");
}

#
# Check for RANGE header. We support a singlw range, there is no
# reason for the client to ask for multiple ranges for an image.
#
if (isset($_SERVER['HTTP_RANGE'])) {
    // Delimiters are case insensitive
    if (preg_match('/bytes=(\d*)\-$/i', $_SERVER['HTTP_RANGE'], $matches) ||
        preg_match('/bytes=(\d*)\-(\d*)$/i', $_SERVER['HTTP_RANGE'], $matches)){
        $rangearg = "-r " . $matches[1] . "-";
        if (count($matches) == 3) {
            $rangearg .= $matches[2];
        }
    }
    else {
        SPITERROR(416, "Client requested invalid Range.");
    }
}

#
# We want to support HEAD requests to avoid sending the file.
#
$ishead  = 0;
$headarg = "";
if ($_SERVER['REQUEST_METHOD'] == "HEAD") {
    $ishead  = 1;
    $headarg = "-h";
}

if ($fp = popen("$TBSUEXEC_PATH nobody $unix_pid,$unix_gid ".
		"webspewimage $arg $headarg $rangearg -k $access_key $versid",
                "r")) {
    header("Content-Type: application/octet-stream");
    header("Cache-Control: no-cache, must-revalidate");
    header("Pragma: no-cache");

    $headers = array();

    #
    # There are always headers.
    #
    while (!feof($fp)) {
        $string = fgets($fp);
        if ($string) {
            if ($string == "\n") {
                # Header terminator when sending the entire image.
                break;
            }
            $headers[] = rtrim($string);
        }
    }

    #
    # If sending just the headers stop now and get status since it
    # might be an error instead of headers.
    #
    # Getting EOF when $ishead is zero, means an error.
    #
    if ($ishead || feof($fp)) {
        $retval = pclose($fp);
        error_log("spewimage: $retval");
        # For the shutdown handler above
        $fp = 0;
        if ($retval == 255 || $retval < 0) {
            error_log("spewimage output:\n" . join("\n", $headers));
            SPITERROR(404, "Could not verify file");
        }
    }
    # Send the headers.
    foreach ($headers as $header) {
        header($header);
    }
    flush();

    if ($ishead) {
        if ($retval) {        
            if ($retval == 2) {
                SPITERROR(304, "File has not changed");
            }
            else {
                SPITERROR(404, "Could not verify file: $retval!");
            }
        }
        flush();
        exit();
    }

    #
    # And spew the rest of the file.
    #
    while (!feof($fp)) {
        $stuff = fread($fp, 1024*32);
        if ($stuff) {
            print($stuff);
            flush();
        }
    }
    $retval = pclose($fp);
    # For the shutdown handler above
    $fp = 0;
    if ($retval == 255 || $retval < 0) {
        error_log("spewimage: failed after sending the headers");
        exit();
    }
    flush();
}
else {
    SPITERROR(404, "Could not find $file!");
}

?>
