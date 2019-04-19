<?php
#
# Copyright (c) 2019 University of Utah and the Flux Group.
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
# Map mysql_* calls to mysqli_* calls
#

#
# mysql_* API last connection ID
# XXX It appears that the only time we make calls with an implicit linkid
# is when we are accessing the initial open of tbdb (see dbdefs.php).
# So we set this linkid that first time we open a DB, just like dbdefs.php.
#
$_mysql_linkid = 0;

function mysql_connect($host, $user, $pswd = "none", $newlink = FALSE, $flags = 0)
{
    global $_mysql_linkid;

    $linkid = mysqli_connect($host, $user, $pswd);
    if ($_mysql_linkid == 0) {
        $_mysql_linkid = $linkid;
    }
    return $linkid;
}

function mysql_select_db($dbname, $linkid = NULL)
{
    if (is_null($linkid)) {
	TBERROR("mysql_select_db: must specify linkid!", 1);
    }

    return mysqli_select_db($linkid, $dbname);
}

function mysql_query($query, $linkid = NULL)
{
    global $_mysql_linkid;

    $linkid = is_null($linkid) ? $_mysql_linkid : $linkid;
    return mysqli_query($linkid, $query);
}

function mysql_num_rows($result)
{
    return mysqli_num_rows($result);
}

function mysql_fetch_array($result, $rtype = MYSQLI_BOTH)
{
    return mysqli_fetch_array($result, $rtype);
}

function mysql_fetch_assoc($result)
{
    return mysqli_fetch_assoc($result);
}

function mysql_fetch_row($result)
{
    return mysqli_fetch_row($result);
}

function mysql_escape_string($stuff)
{
    global $_mysql_linkid;

    $linkid = $_mysql_linkid;
    # XXX is this really the same? There is some doubt:
    # https://www.php.net/manual/en/function.mysqli-escape-string.php
    return mysqli_escape_string($linkid, $stuff);
}

function mysql_insert_id($linkid = NULL)
{
    global $_mysql_linkid;

    $linkid = is_null($linkid) ? $_mysql_linkid : $linkid;
    return mysqli_insert_id($linkid);
}

function mysql_data_seek($result, $rownum)
{
    return mysqli_data_seek($result, $rownum);
}

function mysql_error($linkid)
{
    return mysqli_error($linkid);
}

function mysql_affected_rows($linkid = NULL)
{
    if (is_null($linkid)) {
	TBERROR("mysql_affected_rows: must specify linkid!", 1);
    }
    
    return mysqli_affected_rows($linkid);
}

function mysql_real_escape_string($stuff, $linkid = NULL)
{
    if (is_null($linkid)) {
	TBERROR("mysql_real_escape_string: must specify linkid!", 1);
    }
    
    return mysqli_real_escape_string($linkid, $stuff);
}
