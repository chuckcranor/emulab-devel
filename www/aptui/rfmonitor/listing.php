<?php
#
# Copyright (c) 2000-2022 University of Utah and the Flux Group.
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
$node_id = null;
if (isset($_REQUEST["node_id"]) && $_REQUEST["node_id"] != "" &&
    preg_match("/^[-\w]+$/", $_REQUEST["node_id"])) {
    $node_id = $_REQUEST["node_id"];
}

function getFileList($dir)
{
    global $node_id;
    $now = time();
    $listing = array();
    chdir($dir);

    // open pointer to directory and read list of files
    $d = dir(".");
    if (!$d) {
        exit("Failed to open $dir for reading");
    }
    while (($entry = $d->read()) !== FALSE) {
        if (is_dir($entry)) {
            if ($entry == "." || $entry == "..") {
                continue;
            }
            $listing[] = [
                'name'     => $entry,
                'subdir'   => getFileList($entry),
            ];
            continue;
        }
        #
        # Only time stamped .gz files
        #
        $match = null;
        if (!preg_match("/\-(\d+)\.csv\.gz$/", $entry, $match)) {
            continue;
        }
        #
        # Lets limit to previous few days.
        #
        $timestamp = $match[1];
        if ($now - $timestamp > (3600 * 24 * 3)) {
            continue;
        }
        if ($node_id) {
            if (!preg_match("/^${node_id}/", $entry)) {
                continue;
            }
        }
        $listing[] = [
            'name'     => $entry,
            'lastmod'  => filemtime($entry),
        ];
    }
    $d->close();
    if ($dir != ".") {
        chdir("..");
    }
    return $listing;
}
$listing = getFileList(".");

header("Content-Type: text/plain");
header("Expires: Mon, 26 Jul 1997 05:00:00 GMT");
header("Cache-Control: no-cache, must-revalidate");
header("Pragma: no-cache");

echo json_encode($listing);

?>
