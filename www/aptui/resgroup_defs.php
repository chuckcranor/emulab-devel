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
include_once("aggregate_defs.php");

#
# Reservation Groups
#
class ReservationGroup
{
    var	$resgroup;
    var $reservations;
    var $rfreservations;
    
    #
    # Constructor by lookup by urn
    #
    function ReservationGroup($uuid) {
	$safe_uuid = addslashes($uuid);

	$query_result =
	    DBQueryWarn("select * from apt_reservation_groups ".
                        "where uuid='$safe_uuid'");

	if (!$query_result || !mysql_num_rows($query_result)) {
	    $this->resgroup = null;
	    return;
	}
	$this->resgroup     = mysql_fetch_array($query_result);
        $this->reservations =
            ReservationGroupReservation::LookupForGroup($this);
        $this->rfreservations =
            ReservationGroupRFReservation::LookupForGroup($this);
    }
    # accessors
    function reservations()   { return $this->reservations; }
    function rfreservations() { return $this->rfreservations; }
    function field($name) {
	return (is_null($this->resgroup) ? -1 : $this->resgroup[$name]);
    }
    function uuid()	    { return $this->field('uuid'); }
    function pid()	    { return $this->field('pid'); }
    function pid_idx()      { return $this->field('pid_idx'); }
    function creator_uid()  { return $this->field('creator_uid'); }
    function creator_idx()  { return $this->field('creator_idx'); }
    function start()        { return $this->field('start'); }
    function end()          { return $this->field('end'); }
    function created()      { return $this->field('created'); }
    function deleted()      { return $this->field('deleted'); }
    function locked()       { return $this->field('locked'); }
    function locker_pid()   { return $this->field('locker_pid'); }
    function reason()       { return $this->field('reason'); }

    # Project of resgroup.
    function Project() {
        return Project::Lookup($this->pid_idx());
    }

    # Hmm, how does one cause an error in a php constructor?
    function IsValid() {
	return !is_null($this->resgroup);
    }

    # Lookup up by uuid,
    function Lookup($uuid) {
	$foo = new ReservationGroup($uuid);

	if ($foo->IsValid()) {
	    return $foo;
	}	
	return null;
    }

    # Lookup for a user.
    function LookupForUser($user)
    {
        $uid_idx = $user->uid_idx();
        $result = array();
        
        $query_result = DBQueryFatal("select uuid from apt_reservation_groups ".
                                     "where creator_idx='$uid_idx'");
	while ($row = mysql_fetch_array($query_result)) {
            $reservation = ReservationGroup::Lookup($row["uuid"]);
            if ($reservation) {
                $result[] = $reservation;
            }
        }
        return $result;
    }

    # Lookup all (admin)
    function LookupAll()
    {
        $result = array();
        
        $query_result = DBQueryFatal("select uuid from apt_reservation_groups");
	while ($row = mysql_fetch_array($query_result)) {
            $reservation = ReservationGroup::Lookup($row["uuid"]);
            if ($reservation) {
                $result[] = $reservation;
            }
        }
        return $result;
    }

    #
    # Lookup group by a member of the group
    #
    function LookupByMemberReservation($remote_uuid)
    {
        $safe_uuid = addslashes($remote_uuid);
        
	$query_result =
	    DBQueryFatal("select uuid from apt_reservation_group_reservations ".
                         "where remote_uuid='$safe_uuid'");

	if (!$query_result || !mysql_num_rows($query_result)) {
	    return null;
	}
	$row = mysql_fetch_array($query_result);
        return ReservationGroup::Lookup($row["uuid"]);
    }

    #
    # Convert reservations to a list of aggregates.
    #
    function AggregateList()
    {
        $uuid   = $this->uuid();
        $result = array();
        $query_result =
            DBQueryFatal("select distinct aggregate_urn ".
                         "  from apt_reservation_group_reservations ".
                         "where uuid='$uuid'");

	while ($row = mysql_fetch_array($query_result)) {
            $aggregate = Aggregate::Lookup($row["aggregate_urn"]);
            if ($aggregate) {
                $result[] = $aggregate;
            }
        }
        return $result;
    }

    # Find specific reservation.
    function Reservation($uuid) {
        foreach ($this->reservations() as $reservation) {
            if ($reservation->remote_uuid() == $uuid) {
                return $reservation;
            }
        }
        foreach ($this->rfreservations() as $reservation) {
            if ($reservation->freq_uuid() == $uuid) {
                return $reservation;
            }
        }
        return null;
    }

    # Are any of the reservation approved
    function PartiallyApproved()
    {
        foreach ($this->reservations() as $reservation) {
            if ($reservation->approved()) {
                return 1;
            }
        }
        foreach ($this->rfreservations() as $reservation) {
            if ($reservation->approved()) {
                return 1;
            }
        }
        return 0;
    }
}

class ReservationGroupReservation
{
    var $reservation;
    
    #
    # Constructor to lookup a single reservation in a group.
    #
    function ReservationGroupReservation($group, $urn, $type) {
	$uuid = $group->uuid();
        $safe_urn  = addslashes($urn);
        $safe_type = addslashes($type);

	$query_result =
	    DBQueryWarn("select * from apt_reservation_group_reservations ".
			"where uuid='$uuid' and ".
                        "      aggregate_urn='$safe_urn' and ".
                        "      type='$safe_type'");

	if (!$query_result || !mysql_num_rows($query_result)) {
	    $this->reservation = null;
	    return;
	}
	$this->reservation = mysql_fetch_array($query_result);
    }
    # accessors
    function field($name) {
	return (is_null($this->reservation) ? -1 : $this->reservation[$name]);
    }
    function uuid()	    { return $this->field('uuid'); }
    function aggregate_urn(){ return $this->field('aggregate_urn'); }
    function remote_uuid()  { return $this->field('remote_uuid'); }
    function type()	    { return $this->field('type'); }
    function count()	    { return $this->field('count'); }
    function using()	    { return $this->field('using'); }
    function utilization()  { return $this->field('utilization'); }
    function submitted()    { return $this->field('submitted'); }
    function approved()     { return $this->field('approved'); }
    function deleted()	    { return $this->field('deleted'); }
    function canceled()     { return $this->field('canceled'); }
    function jsondata()     { return $this->field('jsondata'); }
    function approved_pushed()     { return $this->field('approved_pushed'); }
    function canceled_pushed()     { return $this->field('canceled_pushed'); }
    function cancel_canceled()     { return $this->field('cancel_canceled'); }
    function deleted_pushed()      { return $this->field('deleted_pushed'); }
    
    # Hmm, how does one cause an error in a php constructor?
    function IsValid() {
	return !is_null($this->reservation);
    }

    function Lookup($group, $urn, $type) {
	$foo = new ReservationGroupReservation($group, $urn, $type);

	if ($foo->IsValid()) {
            return $foo;
        }
        return null;
    }

    #
    # Lookup all reservations for a group
    #
    function LookupForGroup($group) {
        $result = array();
        $uuid   = $group->uuid();

        $query_result =
            DBQueryFatal("select type,aggregate_urn ".
                         "  from apt_reservation_group_reservations ".
                         "where uuid='$uuid'");

	while ($row = mysql_fetch_array($query_result)) {
            $res = ReservationGroupReservation::Lookup($group,
                                                        $row['aggregate_urn'],
                                                        $row['type']);
            if ($res) {
                $result[] = $res;
            }
        }
        return $result;
    }

    function Aggregate() {
        return Aggregate::Lookup($this->aggregate_urn());
    }
}
class ReservationGroupRFReservation
{
    var $reservation;
    
    #
    # Constructor to lookup a single reservation in a group.
    #
    function ReservationGroupRFReservation($group, $freq_uuid) {
	$uuid = $group->uuid();
        $safe_uuid  = addslashes($freq_uuid);

	$query_result =
	    DBQueryWarn("select * from apt_reservation_group_rf_reservations ".
			"where uuid='$uuid' and ".
                        "      freq_uuid='$safe_uuid'");

	if (!$query_result || !mysql_num_rows($query_result)) {
	    $this->reservation = null;
	    return;
	}
	$this->reservation = mysql_fetch_array($query_result);
    }
    # accessors
    function field($name) {
	return (is_null($this->reservation) ? -1 : $this->reservation[$name]);
    }
    function uuid()	    { return $this->field('uuid'); }
    function freq_uuid()    { return $this->field('freq_uuid'); }
    function freq_low()	    { return $this->field('freq_low'); }
    function freq_high()    { return $this->field('freq_high'); }
    function submitted()    { return $this->field('submitted'); }
    function approved()     { return $this->field('approved'); }
    function canceled()     { return $this->field('canceled'); }
    
    # Hmm, how does one cause an error in a php constructor?
    function IsValid() {
	return !is_null($this->reservation);
    }

    function Lookup($group, $uuid) {
	$foo = new ReservationGroupRFReservation($group, $uuid);

	if ($foo->IsValid()) {
            return $foo;
        }
        return null;
    }

    #
    # Lookup all reservations for a group
    #
    function LookupForGroup($group) {
        $result = array();
        $uuid   = $group->uuid();

        $query_result =
            DBQueryFatal("select freq_uuid ".
                         "  from apt_reservation_group_rf_reservations ".
                         "where uuid='$uuid'");

	while ($row = mysql_fetch_array($query_result)) {
            $res = ReservationGroupRFReservation::Lookup($group,
                                                         $row['freq_uuid']);
            if ($res) {
                $result[] = $res;
            }
        }
        return $result;
    }
}

?>
