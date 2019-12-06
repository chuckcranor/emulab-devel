<?php
#
# Copyright (c) 2006-2019 University of Utah and the Flux Group.
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

# Set this variable when fetching health status of portal
# aggregates instead of using them.
$PORTAL_HEALTH = 0;

#
# This needs to go into the DB.
#
class Aggregate
{
    var	$aggregate;
    var $typeinfo;
    var $statusinfo;
    
    #
    # Constructor by lookup by urn
    #
    function Aggregate($urn) {
	$safe_urn = addslashes($urn);

	$query_result =
	    DBQueryWarn("select * from apt_aggregates where urn='$safe_urn'");

	if (!$query_result || !mysql_num_rows($query_result)) {
	    $this->aggregate = null;
	    return;
	}
	$this->aggregate = mysql_fetch_array($query_result);
        $this->typeinfo  = array();

        #
        # Get the type info
        #
        $query_result =
            DBQueryWarn("select * from apt_aggregate_nodetypes ".
                        "where urn='$safe_urn'");
	while ($row = mysql_fetch_array($query_result)) {
	    $type = $row["type"];
            $this->typeinfo[$type] = array("count" => $row["count"],
                                           "free"  => $row["free"]);
        }

        #
        # And the status info.
        #
        $query_result =
            DBQueryWarn("select * from apt_aggregate_status ".
                        "where urn='$safe_urn'");
	if ($query_result || mysql_num_rows($query_result)) {
            $this->statusinfo = mysql_fetch_array($query_result);
        }
    }
    # accessors
    function field($name) {
	return (is_null($this->aggregate) ? -1 : $this->aggregate[$name]);
    }
    function name()	    { return $this->field('name'); }
    function nickname()	    { return $this->field('nickname'); }
    function urn()	    { return $this->field('urn'); }
    function abbreviation() { return $this->field('abbreviation'); }
    function weburl()	    { return $this->field('weburl'); }
    function disabled()     { return $this->field('disabled'); }
    function adminonly()    { return $this->field('adminonly'); }
    function has_datasets() { return $this->field('has_datasets'); }
    function reservations() { return $this->field('reservations'); }
    function nomonitor()    { return $this->field('nomonitor'); }
    function nolocalimages(){ return $this->field('nolocalimages'); }
    function prestageimages(){ return $this->field('prestageimages'); }
    function precalcmaxext(){ return $this->field('precalcmaxext'); }
    function portals()      { return $this->field('portals'); }
    function canuse_feature(){ return $this->field('canuse_feature'); }

    # accessors for the status info.
    function sfield($name) {
	return (is_null($this->statusinfo) ? null : $this->statusinfo[$name]);
    }
    function status()       { return $this->sfield('status'); }
    function last_success() { return $this->sfield('last_success'); }
    function last_attempt() { return $this->sfield('last_attempt'); }
    function pcount()       { return $this->sfield('pcount'); }
    function pfree()        { return $this->sfield('pfree'); }
    function vcount()       { return $this->sfield('vcount'); }
    function vfree()        { return $this->sfield('vfree'); }
    function last_error()   { return $this->sfield('last_error'); }

    # Hmm, how does one cause an error in a php constructor?
    function IsValid() {
	return !is_null($this->aggregate);
    }

    # Powder Portal, is an aggregate an FE.
    function isFE() {
        global $PORTAL_GENESIS;
        
        if ($PORTAL_GENESIS == "powder" &&
            preg_match("/powderwireless\.net/", $this->urn())) {
            return 1;
        }
        return 0;
    }

    # Powder Portal, Emulab is not a "federate", all others are.
    function isfederate() {
        global $PORTAL_GENESIS;
        if ($PORTAL_GENESIS == "powder") {
            if ($this->nickname() == "Emulab") {
                return 0;
            }
            return 1;
        }
        return $this->field('isfederate');
    }

    # Lookup up by urn,
    function Lookup($urn) {
	$foo = new Aggregate($urn);

	if ($foo->IsValid()) {
	    return $foo;
	}	
	return null;
    }

    function LookupByNickname($nickname) {
	$safe_nickname = addslashes($nickname);

	$query_result =
            DBQueryWarn("select urn from apt_aggregates ".
                        "where nickname='$safe_nickname'");

	if (!$query_result || !mysql_num_rows($query_result)) {
	    return null;
	}
	$row = mysql_fetch_array($query_result);
	$urn = $row['urn'];

        return Aggregate::Lookup($urn);
    }
    #
    # Lookup using the short auth name (emulab.net).
    #
    function LookupByDomain($domain) {
        if (! preg_match("/^[-\w\.]+$/", $domain)) {
            return null;
        }
        $query_result =
            DBQueryWarn("select urn from apt_aggregates ".
                        "where urn like 'urn:publicid:IDN+${domain}+%'");
	if (!$query_result || !mysql_num_rows($query_result)) {
            return null;
        }
	$row = mysql_fetch_array($query_result);
	$urn = $row['urn'];

        return Aggregate::Lookup($urn);
    }

    #
    # Generate the free nodes URL from the web url.
    #
    function FreeNodesURL() {
        return $this->weburl() . "/node_usage/freenodes.svg";
    }

    #
    # Return a list of aggregates supporting datasets.
    #
    function SupportsDatasetsList() {
	$result  = array();

	$query_result =
	    DBQueryFatal("select urn from apt_aggregates ".
			 "where has_datasets!=0 and disabled=0");

	while ($row = mysql_fetch_array($query_result)) {
	    $urn = $row["urn"];

	    if (! ($aggregate = Aggregate::Lookup($urn))) {
		TBERROR("Aggregate::SupportsDatasetsList: ".
			"Could not load aggregate $urn!", 1);
	    }
            if ($aggregate->adminonly() && !(ISADMIN() || STUDLY())) {
                continue;
            }
	    $result[] = $aggregate;
	}
        return $result;
    }

    #
    # Return a list of aggregates supporting reservations,
    #
    function SupportsReservations($user = null) {
	$ordered   = array();
        $unordered = array();
        global $PORTAL_GENESIS;

        $query_result =
            DBQueryFatal("select urn from apt_aggregates ".
                         "where disabled=0 and reservations=1 and ".
                         "      FIND_IN_SET('$PORTAL_GENESIS', portals) ".
                         ($PORTAL_GENESIS != "powder" ?
                          "order by isfederate,name" : "order by nickname"));
        
	while ($row = mysql_fetch_array($query_result)) {
	    $urn = $row["urn"];
            $allowed = 1;

	    if (! ($aggregate = Aggregate::Lookup($urn))) {
		TBERROR("Aggregate::SupportsReservations: ".
			"Could not load aggregate $urn!", 1);
	    }
            # Admins always see everything.
            if (ISADMIN()) {
                $allowed = 1;
            }
            elseif ($aggregate->adminonly() && !(ISADMIN() || STUDLY())) {
                $allowed = 0;
            }
            elseif ($user && $aggregate->canuse_feature()) {
                $allowed = 0;
                $feature = $PORTAL_GENESIS . "-" . $aggregate->canuse_feature();

                # Does the user have the feature?
                if (FeatureEnabled($feature, $user, null, null)) {
                    $allowed = 1;
                }
                else {
                    # If not, see if in a project that has it enabled.
                    $projects = $user->ProjectMembershipList();
                    foreach ($projects as $project) {
                        $approved = 0;
                        $group    = $project->DefaultGroup();
                        
                        if ($project->approved() &&
                            !$project->disabled() &&
                            # Must be approved in the project.
                            $project->IsMember($user, $approved) && $approved &&
                            FeatureEnabled($feature, null, $group, null)) {
                            $allowed = 1;
                            break;
                        }
                    }
                }
            }
            if ($allowed) {
                $ordered[] = $aggregate;
                $unordered[$aggregate->nickname()] = $aggregate;
            }
	}
        #
        # Ick, Powder ordering. Need a better way to deal with this.
        #
        if ($PORTAL_GENESIS == "powder") {
            $ordered = array();
            $ordered[] = $unordered["Emulab"];
            $ordered[] = $unordered["Utah"];
            foreach ($unordered as $aggregate) {
                if ($aggregate->nickname() != "Emulab" &&
                    $aggregate->nickname() != "Utah") {
                    $ordered[] = $aggregate;
                }
            }
        }
        return $ordered;
    }

    #
    # Return the list of allowed aggregates based on the portal in use.
    #
    function DefaultAggregateList($user = null) {
        global $PORTAL_GENESIS, $PORTAL_HEALTH;
	$genesis = $PORTAL_GENESIS;
	if ($PORTAL_HEALTH)
	{
	  $genesis = "cloudlab";
	}
	$am_array = array();

        $query_result =
            DBQueryFatal("select urn from apt_aggregates ".
                         "where disabled=0 and ".
                         "      FIND_IN_SET('$genesis', portals)");
        
	while ($row = mysql_fetch_array($query_result)) {
            $urn       = $row["urn"];
            $allowed   = 1;

	    if (! ($aggregate = Aggregate::Lookup($urn))) {
		TBERROR("Aggregate::DefaultAggregateList: ".
			"Could not load aggregate $urn!", 1);
	    }
            # Admins always see everything.
            if (ISADMIN()) {
                $allowed = 1;
            }
            elseif ($aggregate->adminonly() && !(ISADMIN() || STUDLY())) {
                $allowed = 0;
            }
            elseif ($user && $aggregate->canuse_feature()) {
                $allowed = 0;
                $feature = $PORTAL_GENESIS . "-" . $aggregate->canuse_feature();

                # Does the user have the feature?
                if (FeatureEnabled($feature, $user, null, null)) {
                    $allowed = 1;
                }
                else {
                    # If not, see if in a project that has it enabled.
                    $projects = $user->ProjectMembershipList();
                    foreach ($projects as $project) {
                        $approved = 0;
                        $group    = $project->DefaultGroup();
                        
                        if ($project->approved() &&
                            !$project->disabled() &&
                            # Must be approved in the project.
                            $project->IsMember($user, $approved) && $approved &&
                            FeatureEnabled($feature, null, $group, null)) {
                            $allowed = 1;
                            break;

                        }
                    }
                }
            }
            if ($allowed) {
                $am_array[$urn] = $aggregate;
            }
        }
        return $am_array;
    }

    #
    # All aggregates
    #
    function AllAggregatesList() {
        $am_array = array();

        $query_result =
             DBQueryFatal("select urn from apt_aggregates");
        
	while ($row = mysql_fetch_array($query_result)) {
            $urn       = $row["urn"];
	    if (! ($aggregate = Aggregate::Lookup($urn))) {
		TBERROR("Aggregate::SupportsReservations: ".
			"Could not load aggregate $urn!", 1);
	    }
	    $am_array[$urn] = $aggregate;
        }
        return $am_array;
    }

    function ThisAggregate()
    {
        global $DEFAULT_AGGREGATE_URN;

        if (! ($aggregate = Aggregate::Lookup($DEFAULT_AGGREGATE_URN))) {
            TBERROR("Aggregate::SupportsReservations: ".
                    "Could not load aggregate $urn!", 1);
        }
        return $aggregate;
    }

    #
    # List of types available at this aggregate. For now we just want
    # the type names.
    #
    function TypeList()
    {
        $result = array();

        foreach ($this->typeinfo as $type => $info) {
            $result[$type] = $type;
        }
        return $result;
    }

    #
    # Array of type attributes for the specified type.
    #
    function TypeAttributes($type)
    {
        $result = array();
        $urn    = $this->urn();

        $query_result =
            DBQueryFatal("select attrkey,attrvalue from ".
                         "  apt_aggregate_nodetype_attributes ".
                         "where type='$type' and urn='$urn'");

        if (!mysql_num_rows($query_result)) {
            return null;
        }
        while ($row = mysql_fetch_array($query_result)) {
            $result[$row["attrkey"]] = $row["attrvalue"];
        }
        return $result;
    }

    #
    # Reservable nodes.
    #
    function ReservableNodes()
    {
        $result = array();
        $urn    = $this->urn();

        $query_result =
            DBQueryFatal("select node_id,type from ".
                         "  apt_aggregate_reservable_nodes ".
                         "where urn='$urn'");

        if (!mysql_num_rows($query_result)) {
            return null;
        }
        while ($row = mysql_fetch_array($query_result)) {
            $result[$row["node_id"]] = $row["type"];
        }
        return $result;
    }
}

#
# We use this in a lot of places, so build it all the time.
#
$urn_mapping = array();

$query_result =
    DBQueryFatal("select urn,abbreviation from apt_aggregates");
while ($row = mysql_fetch_array($query_result)) {
    $urn_mapping[$row["urn"]] = $row["abbreviation"];
}

?>
