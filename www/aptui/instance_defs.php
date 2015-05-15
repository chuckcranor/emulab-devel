<?php
#
# Copyright (c) 2006-2015 University of Utah and the Flux Group.
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

if ($ISCLOUD) {
    $DEFAULT_AGGREGATE = "Utah Cloudlab";
}
else {
    $DEFAULT_AGGREGATE = "Utah APT";
}

$urn_mapping =
    array("urn:publicid:IDN+utah.cloudlab.us+authority+cm"      => "Utah",
          "urn:publicid:IDN+wisc.cloudlab.us+authority+cm"      => "Wisc",
          "urn:publicid:IDN+clemson.cloudlab.us+authority+cm"   => "Clem",
          "urn:publicid:IDN+apt.emulab.net+authority+cm"        => "APT",
          "urn:publicid:IDN+emulab.net+authority+cm"            => "MS",
          "urn:publicid:IDN+utahddc.geniracks.net+authority+cm" => "DDC");

$freenodes_mapping =
    array("urn:publicid:IDN+utah.cloudlab.us+authority+cm"      =>
          "https://www.utah.cloudlab.us/node_usage/freenodes.svg",
          "urn:publicid:IDN+wisc.cloudlab.us+authority+cm"      =>
          "https://www.wisc.cloudlab.us/node_usage/freenodes.svg",
          "urn:publicid:IDN+clemson.cloudlab.us+authority+cm"   =>
          "https://www.clemson.cloudlab.us/node_usage/freenodes.svg",
          "urn:publicid:IDN+apt.emulab.net+authority+cm"        =>
          "https://www.apt.emulab.net/node_usage/freenodes.svg",
          "urn:publicid:IDN+emulab.net+authority+cm"            =>
          "https://www.emulab.net/node_usage/freenodes.svg");

class Instance
{
    var	$instance;
    
    #
    # Constructor by lookup on unique index.
    #
    function Instance($uuid) {
	$safe_uuid = addslashes($uuid);

	$query_result =
	    DBQueryWarn("select * from apt_instances ".
			"where uuid='$safe_uuid'");

	if (!$query_result || !mysql_num_rows($query_result)) {
	    $this->instance = null;
	    return;
	}
	$this->instance  = mysql_fetch_array($query_result);
        $this->slivers   = InstanceSliver::LookupForInstance($this);
        if (!count($this->slivers) && $this->aggregate_urn()) {
            $this->slivers =
                array(InstanceSliver::Lookup($this, $this->aggregate_urn()));
        }
    }
    # accessors
    function slivers()      { return $this->slivers; }
    function field($name) {
	return (is_null($this->instance) ? -1 : $this->instance[$name]);
    }
    function uuid()	    { return $this->field('uuid'); }
    function name()	    { return $this->field('name'); }
    function slice_uuid()   { return $this->field('slice_uuid'); }
    function creator()	    { return $this->field('creator'); }
    function creator_idx()  { return $this->field('creator_idx'); }
    function creator_uuid() { return $this->field('creator_uuid'); }
    function created()	    { return $this->field('created'); }
    function profile_id()   { return $this->field('profile_id'); }
    function profile_version() { return $this->field('profile_version'); }
    function status()	    { return $this->field('status'); }
    function pid()	    { return $this->field('pid'); }
    function pid_idx()	    { return $this->field('pid_idx'); }
    function public_url()   { return $this->field('public_url'); }
    function manifest()	    { return $this->field('manifest'); }
    function admin_lockdown() { return $this->field('admin_lockdown'); }
    function user_lockdown(){ return $this->field('user_lockdown'); }
    function extension_count()   { return $this->field('extension_count'); }
    function extension_days()    { return $this->field('extension_days'); }
    function extension_reason()  { return $this->field('extension_reason'); }
    function extension_history() { return $this->field('extension_history'); }
    function extension_lockout() { return $this->field('extension_adminonly'); }
    function servername()   { return $this->field('servername'); }
    function aggregate_urn(){ return $this->field('aggregate_urn'); }
    function IsAPT() {
	return preg_match('/aptlab/', $this->servername());
    }
    function IsCloud() {
	return preg_match('/cloudlab/', $this->servername());
    }
    
    # Hmm, how does one cause an error in a php constructor?
    function IsValid() {
	return !is_null($this->instance);
    }

    # Lookup up an instance by idx. 
    function Lookup($idx) {
	$foo = new Instance($idx);

	if ($foo->IsValid()) {
            # Insert into cache.
	    return $foo;
	}	
	return null;
    }

    function LookupByCreator($token) {
	$safe_token = addslashes($token);

	$query_result =
	    DBQueryFatal("select uuid from apt_instances ".
			 "where creator_uuid='$safe_token'");

	if (! ($query_result && mysql_num_rows($query_result))) {
	    return null;
	}
	$row = mysql_fetch_row($query_result);
	$uuid = $row[0];
 	return Instance::Lookup($uuid);
    }

    function LookupByName($project, $token) {
	$safe_token = addslashes($token);
        $pid_idx    = $project->pid_idx();

	$query_result =
	    DBQueryFatal("select uuid from apt_instances ".
			 "where pid_idx='$pid_idx' and name='$safe_token'");

	if (! ($query_result && mysql_num_rows($query_result))) {
	    return null;
	}
	$row = mysql_fetch_row($query_result);
	$uuid = $row[0];
 	return Instance::Lookup($uuid);
    }

    #
    # Refresh an instance by reloading from the DB.
    #
    function Refresh() {
	if (! $this->IsValid())
	    return -1;

	$uuid = $this->uuid();

	$query_result =
	    DBQueryWarn("select * from apt_instances where uuid='$uuid'");
    
	if (!$query_result || !mysql_num_rows($query_result)) {
	    $this->instance  = NULL;
	    return -1;
	}
	$this->instance = mysql_fetch_array($query_result);
	return 0;
    }
    #
    # Class function to create a new Instance
    #
    function Instantiate($creator, $options, $args, &$errors) {
	global $suexec_output, $suexec_output_array;

	# So we can look up the slice after the backend creates it.
	$uuid = NewUUID();

	#
        # Generate a temporary file and write in the XML goo. 
	#
	$xmlname = tempnam("/tmp", "quickvm");
	if (! $xmlname) {
	    TBERROR("Could not create temporary filename", 0);
	    $errors["error"] = "Transient error(1); please try again later.";
	    return null;
	}
	elseif (! ($fp = fopen($xmlname, "w"))) {
	    TBERROR("Could not open temp file $xmlname", 0);
	    $errors["error"] = "Transient error(2); please try again later.";
	    return null;
	}
	else {
	    fwrite($fp, "<quickvm>\n");
	    foreach ($args as $name => $value) {
		fwrite($fp, "<attribute name=\"$name\">");
		fwrite($fp, "  <value>" . htmlspecialchars($value) .
		       "</value>");
		fwrite($fp, "</attribute>\n");
	    }
	    fwrite($fp, "</quickvm>\n");
	    fclose($fp);
	    chmod($xmlname, 0666);
	}
	# 
	# With a real user, run as that user. 
	#
	$uid = ($creator ? $creator->uid() : "nobody");
	$pid = "nobody";
	if ($creator && $creator->FirstApprovedProject()) {
	    $pid = $creator->FirstApprovedProject()->pid();
	}
	if (isset($_SERVER['REMOTE_ADDR'])) { 
	    putenv("REMOTE_ADDR=" . $_SERVER['REMOTE_ADDR']);
	}
	if (isset($_SERVER['SERVER_NAME'])) { 
	    putenv("SERVER_NAME=" . $_SERVER['SERVER_NAME']);
	}
	$retval = SUEXEC($uid, $pid,
			 "webcreate_instance $options -u $uuid $xmlname",
			 SUEXEC_ACTION_IGNORE);

	if ($retval != 0) {
	    if ($retval < 0) {
		SUEXECERROR(SUEXEC_ACTION_CONTINUE);
		$errors["error"] =
		    "Transient error(3); please try again later.";
	    }
	    else {
		if (count($suexec_output_array)) {
		    $line = $suexec_output_array[0];
		    $errors["error"] = $line;
		}
		else {
		    SUEXECERROR(SUEXEC_ACTION_CONTINUE);
		    $errors["error"] =
			"Transient error(4); please try again later.";
		}
	    }
	    return null;
	}
	unlink($xmlname);

	$instance = Instance::Lookup($uuid);
	if (!$instance) {
	    $errors["error"] = "Transient error(5); please try again later.";
	    return null;
	}
	if (!$creator) {
	    $creator = GeniUser::Lookup("sa", $instance->creator_uuid());
	}
	if (!$creator) {
	    $errors["error"] = "Transient error(6); please try again later.";
	    return null;
	}
	return array($instance, $creator);
    }

    function UserHasInstances($user) {
	$uuid = $user->uuid();

	$query_result =
	    DBQueryFatal("select uuid from apt_instances ".
			 "where creator_uuid='$uuid'");

	return mysql_num_rows($query_result);
    }

    function SendEmail($to, $subject, $msg, $headers) {
	TBMAIL($to, $subject, $msg, $headers);
    }

    #
    # How many experiments has a guest user created
    #
    function GuestInstanceCount($geniuser) {
        $uid = $geniuser->uid();
        
        $query_result =
            DBQueryFatal("select count(h.uuid) from apt_instance_history as h ".
                         "left join geni.geni_users as u on ".
                         "     u.uuid=h.creator_uuid ".
                         "where h.creator='$uid' and u.email is not null");
        
	$row = mysql_fetch_row($query_result);
	return $row[0];
    }

    #
    # Return aggregate based on the current user.
    #
    function DefaultAggregateList() {
        global $ISCLOUD;
        if ($ISCLOUD) {
          $am_array = array(
                          'Cloudlab Utah' =>
                          "urn:publicid:IDN+utah.cloudlab.us+authority+cm",
			  'Cloudlab Wisconsin' =>
			  "urn:publicid:IDN+wisc.cloudlab.us+authority+cm",
			  'Cloudlab Clemson' =>
			  "urn:publicid:IDN+clemson.cloudlab.us+authority+cm",
                          'APT Utah' =>
                          "urn:publicid:IDN+apt.emulab.net+authority+cm",
                          'IG UtahDDC' =>
                          "urn:publicid:IDN+utahddc.geniracks.net+authority+cm"
          );
        } else {
          $am_array = array(
                          'Cloudlab Utah' =>
                          "urn:publicid:IDN+utah.cloudlab.us+authority+cm",
                          'APT Utah' =>
                          "urn:publicid:IDN+apt.emulab.net+authority+cm",
                          'IG UtahDDC' =>
                          "urn:publicid:IDN+utahddc.geniracks.net+authority+cm",
                          'Utah PG'  =>
                          "urn:publicid:IDN+emulab.net+authority+cm"
          );
        }
        return $am_array;
    }
    # helper
    function ParseURN($urn)
    {
        if (preg_match("/^[^+]*\+([^+]+)\+([^+]+)\+(.+)$/", $urn, $matches)) {
            return array($matches[1], $matches[2], $matches[3]);
        }
        return array();
    }

    function SetExtensionReason($reason)
    {
	$uuid = $this->uuid();
        $safe_reason = mysql_escape_string($reason);

        DBQueryWarn("update apt_instances set ".
                    "  extension_reason='$safe_reason' ".
                    "where uuid='$uuid'");
    }

    function AddExtensionHistory($text)
    {
	$uuid = $this->uuid();
        $safe_text = mysql_escape_string($text);

        DBQueryWarn("update apt_instances set ".
                    "extension_history=CONCAT('$safe_text',".
                    "IFNULL(extension_history,'')) ".
                    "where uuid='$uuid'");
    }

    function BumpExtensionCount($granted)
    {
	$uuid = $this->uuid();

        DBQueryWarn("update apt_instances set ".
                    "  extension_count=extension_count+1, ".
                    "  extension_days=extension_days+${granted} ".
                    "where uuid='$uuid'");
    }
    #
    # Permission check; does user have permission to view instance.
    #
    function CanView($user) {
	if ($this->creator_idx() == $user->uid_idx()) {
	    return 1;
	}
	# Otherwise a project membership test.
	$project = Project::Lookup($this->pid_idx());
	if (!$project) {
	    return 0;
	}
	$isapproved = 0;
	if ($project->IsMember($user, $isapproved) && $isapproved) {
	    return 1;
	}
	return 0;
    }
    function CanModify($user) {
	if ($this->creator_idx() == $user->uid_idx()) {
	    return 1;
	}
        return 0;
    }

    #
    # Determine user current usage.
    #
    function CurrentUsage($user) {
        $user_idx = $user->idx();
        $pcount = 0;
        $phours = 0;

        $query_result =
            DBQueryFatal("select physnode_count, ".
                         " truncate(physnode_count * ".
                         "  ((UNIX_TIMESTAMP(now()) - ".
                         "    UNIX_TIMESTAMP(created)) / 3600.0),2) as phours ".
                         "  from apt_instances ".
                         "where creator_idx='$user_idx' and physnode_count>0");

        while ($row = mysql_fetch_array($query_result)) {
            $pcount += $row["physnode_count"];
            $phours += $row["phours"];
        }
        return array($pcount, $phours);
    }

    #
    # Return Caching Token, either the latest commit hash
    # or the current time for development trees.
    #
    function CacheToken() {
      if (preg_match("/\/dev\//", $_SERVER["SCRIPT_NAME"]))
      {
        return date('Y-m-d-H:i:s');
      }
      else
      {
          $query_result =
              DBQueryFatal("select value from version_info ".
                           "where name='commithash'");
          
          if (!$query_result || !mysql_num_rows($query_result)) {
              return date('Y-m-d-H:i:s');
          }
          $row = mysql_fetch_array($query_result);
          return $row[0];
      }
    }
}

class InstanceSliver
{
    var	$sliver;
    
    #
    # Constructor by lookup on unique index.
    #
    function InstanceSliver($instance, $urn) {
	$uuid = $instance->uuid();

	$query_result =
	    DBQueryWarn("select * from apt_instance_aggregates ".
			"where uuid='$uuid' and aggregate_urn='$urn'");

	if (!$query_result || !mysql_num_rows($query_result)) {
	    $this->sliver = null;
	    return;
	}
	$this->sliver = mysql_fetch_array($query_result);
    }
    # accessors
    function field($name) {
	return (is_null($this->sliver) ? -1 : $this->sliver[$name]);
    }
    function uuid()	    { return $this->field('uuid'); }
    function name()	    { return $this->field('name'); }
    function aggregate_urn(){ return $this->field('aggregate_urn'); }
    function status()	    { return $this->field('status'); }
    function public_url()   { return $this->field('public_url'); }
    function webtask_id()   { return $this->field('webtask_id'); }
    function manifest()	    { return $this->field('manifest'); }

    # Hmm, how does one cause an error in a php constructor?
    function IsValid() {
	return !is_null($this->sliver);
    }

    function Lookup($instance, $urn) {
	$foo = new InstanceSliver($instance, $urn);

	if ($foo->IsValid()) {
            return $foo;
        }
        #
        # Backwards compat for a while, create a fake one. 
        #
        $webtask = WebTask::LookupByObject($instance->uuid());
        $foo->sliver = array(
            "uuid" => $instance->uuid(),
            "name" => $instance->name(),
            "aggregate_urn" => $instance->aggregate_urn(),
            "status" => $instance->status(),
            "public_url" => $instance->public_url(),
            "manifest" => $instance->manifest(),
            "webtask_id" => $webtask->task_id(),
        );
        return $foo;
    }

    #
    # Lookup all slivers for an instance
    #
    function LookupForInstance($instance) {
        $result = array();
        $uuid   = $instance->uuid();

        $query_result =
            DBQueryFatal("select aggregate_urn from apt_instance_aggregates ".
                         "where uuid='$uuid'");

	while ($row = mysql_fetch_array($query_result)) {
            $sliver = InstanceSliver::Lookup($instance, $row['aggregate_urn']);
            if ($sliver) {
                $result[] = $sliver;
            }
        }
        return $result;
    }
}

?>
