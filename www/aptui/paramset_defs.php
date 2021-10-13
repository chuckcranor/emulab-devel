<?php
#
# Copyright (c) 2006-2021 University of Utah and the Flux Group.
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

class Paramset
{
    var	$paramset;
    var $profile;
    var $project;

    function Paramset($uuid) {
        $query_result = null;
        
	if (preg_match("/^\w+\-\w+\-\w+\-\w+\-\w+$/", $uuid)) {
            $query_result = DBQueryFatal("select * from apt_parameter_sets ".
                                         "where uuid='$uuid'");
        }
	if (!$query_result || !mysql_num_rows($query_result)) {
	    $this->paramset = null;
	    return;
	}
	$this->paramset = mysql_fetch_array($query_result);
        $this->project  = null;
        $this->profile  = null;
    }
    # accessors
    function field($name) {
	return (is_null($this->paramset) ? -1 : $this->paramset[$name]);
    }
    function uuid()	    { return $this->field('uuid'); }
    function uid()          { return $this->field('uid'); }
    function uid_idx()      { return $this->field('uid_idx'); }
    function created()	    { return $this->field('created'); }
    function name()	    { return $this->field('name'); }
    function description()  { return $this->field('description'); }
    function public()	    { return $this->field('public'); }
    function profileid()    { return $this->field('profileid'); }
    function version_uuid() { return $this->field('version_uuid'); }
    function reporef()	    { return $this->field('reporef'); }
    function repohash()	    { return $this->field('repohash'); }

    # Profile of paramset
    function Profile() {
        if ($this->profile) {
            return $this->profile;
        }
        $this->profile = Profile::Lookup($this->profileid);
        return $this->profile;
    }
    # Project of paramset
    function Project() {
        if ($this->project) {
            return $this->project;
        }
        $profile = $this->Profile();
        if (!$profile) {
            return null;
        }
        $this->project = Project::Lookup($profile->pid_idx());
        return $this->project;
    }
    function IsBound() {
	return $this->version_uuid() ? 1 : 0;
    }

    # Hmm, how does one cause an error in a php constructor?
    function IsValid() {
	return !is_null($this->paramset);
    }

    # Lookup up a single paramset
    function Lookup($token) {
	$foo = new Paramset($token);

	if ($foo->IsValid()) {
            # Insert into cache.
	    return $foo;
	}	
	return null;
    }

    #
    # Permission check; does user have permission use the set
    #
    function CanUse($user) {
	$uuid = $this->uuid();

        if (ISADMIN()) {
            return 1;
        }
	if ($this->ispublic() || $this->isCreator($user)) {
	    return 1;
	}
	# Otherwise a project membership test.
	$project = $this->Project();
	if (!$project) {
	    return 0;
	}
	$isapproved = 0;
	if ($project->IsMember($user, $isapproved) && $isapproved) {
	    return 1;
	}
	return 0;
    }
    function CanEdit($user) {
	$uuid = $this->uuid();

        if (ISADMIN()) {
            return 1;
        }
        if ($this->isCreator($user)) {
	    return 1;
	}
        return 0;
    }
    function CanDelete($user) {
        if ($this->CanEdit($user)) {
            return 1;
        }
        $project = $this->Project();
	if (!$project) {
	    return 0;
	}
        if ($project->IsLeader($user)) {
	    return 1;
        }
        return 0;
    }
    function isCreator($user) {
        if ($user->uid_idx() == $this->uid_idx()) {
	    return 1;
        }
        return 0;
    }
}
?>
