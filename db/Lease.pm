#!/usr/bin/perl -wT
#
# Copyright (c) 2012,2013 University of Utah and the Flux Group.
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
package Lease;

use strict;
use Exporter;
use vars qw(@ISA @EXPORT);

@ISA    = "Exporter";
@EXPORT = qw ( );

use libdb;
use libtestbed;
use English;
use Date::Parse;
use Data::Dumper;
use overload ('""' => 'Stringify');

my @LEASE_TYPES = ();
my $MINLEASELEN = 1 * 24 * 60 * 60   # One day.

# Cache of instances to avoid regenerating them.
my %leases	= ();
my $debug	= 0;

# Little helper and debug function.
sub mysystem($)
{
    my ($command) = @_;

    print STDERR "Running '$command'\n"
	if ($debug);
    return system($command);
}

#
# Accessors
#
sub lease_id($)        {return $_[0]->{'DBROW'}->{'lease_id'}; }
sub pid($)             {return $_[0]->{'DBROW'}->{'pid'}; }
sub idx($)             {return $_[0]->{'DBROW'}->{'lease_idx'}; }
sub lease_idx($)       {return $_[0]->idx(); }
sub owner($)           {return $_[0]->{'DBROW'}->{'owner_uid'}; }
sub type($)            {return $_[0]->{'DBROW'}->{'type'}; }
sub inception($)       {return str2time($_[0]->{'DBROW'}->{'inception'}); }
sub lease_end($)       {return str2time($_[0]->{'DBROW'}->{'lease_end'}); }
sub expiration($)      {return $_[0]->lease_end(); }
sub last_used($)       {return str2time($_[0]->{'DBROW'}->{'last_used'}); }
sub state($)           {return $_[0]->{'DBROW'}->{'state'}; }
sub statestamp($)      {return str2time($_[0]->{'DBROW'}->{'statestamp'}); }


#
# Lookup a lease in the DB and return an object representing it.
#
sub Lookup($$;$)
{
    my ($class, $pid, $lease_id) = @_;
    my ($wclause);

    # Determine how we were called.  If only a single parameter was passed
    # to the method, then it should be a lease index.  If both are passed in,
    # then they are what their variable names imply.
    if (!defined($lease_id)) {
	my $idx = $pid;
	if ($idx !~ /^\d+$/) {
	    print STDERR "Lease->Lookup: single parameter to call must be a numeric index.\n";
	    return undef;
	}
	# Look in cache first
	return $leases{$idx}
	    if (exists($leases{$idx}));

	$wclause = "lease_idx=$idx";
    } else {
	# Look in cache first
	return $leases{"$pid:$lease_id"}
	    if (exists($leases{"$pid:$lease_id"}));

	$wclause = "pid='$pid' and lease_id='$lease_id'";
    }

    my $self              = {};
    $self->{"LOCKED"}     = 0;
    $self->{"LOCKER_PID"} = 0;
    $self->{"ATTRS"}      = undef;  # load lazily

    # Load lease from DB, if it exists. Otherwise, return undef.
    my $query_result =
	DBQueryWarn("select * from project_leases where $wclause");

    return undef
	if (!$query_result || !$query_result->numrows);

    $self->{'DBROW'} = $query_result->fetchrow_hashref();;
    bless($self, $class);

    # Add to cache (dual lookup).
    $leases{$self->pid() + ":" + $self->lease_id()} = $self;
    $leases{$self->idx()} = $self;
    return $self;
}

#
# Force a reload of the data.
#
sub LookupSync($$;$) {
    my ($class, $pid, $lease_id) = @_;
    my ($lease_idx, $plid);

    if (!defined($lease_id)) {
	$lease_idx = $pid;
	if (exists($leases{$lease_idx})) {
	    $plid = 
		$leases{$lease_idx}->pid() + ":" + 
		$leases{$lease_idx}->lease_id();
	}
    } else {
	$plid = "$pid:$lease_id";
	if (exists($leases{$plid})) {
	    $lease_idx = $leases{$plid}->idx();
	}
    }

    # delete from cache
    delete($leases{$lease_idx})
        if (defined($lease_idx) && exists($leases{$lease_idx}));
    delete($leases{$plid})
        if (defined($plid) && exists($leases{$plid}));

    return Lookup($class, $lease_idx);
}

#
# explicit object destructor to ensure we get rid of circular refs.
#
sub DESTROY($) {
    my ($self) = @_;

    $self->{'LOCKED'} = undef;
    $self->{'LOCKER_PID'} = undef;
    $self->{'ATTRS'} = undef;
    $self->{'DBROW'} = undef;
}

#
# Create a new lease.
#
sub Create($$;$) {
    my ($class, $argref, $attrs) = @_;

    my ($lease_id, $pid, $uid, $type, $lease_end, $state);

    return undef
	if (!ref($argref));

    $lease_id  = $argref->{'lease_id'};
    $pid       = $argref->{'pid'};
    $uid       = $argref->{'uid'};
    $type      = $argref->{'type'};
    $lease_end = $argref->{'lease_end'};
    $state     = $argref->{'state'};
    
    if (!($lease_id && $pid && $uid && $type && $leasend && $state)) {
	print STDERR "Lease->Create: Missing required parameters in argref\n";
	return undef;
    }

    # Sanity checks for incoming arguments
    if (!TBcheck_dbslot($lease_id, "project_leases", "lease_id")) {
	print STDERR "Lease->Create: Bad data for lease id: " + 
	    $DBFieldErrstr + "\n";
	return undef;
    }

    if (ref($pid) ne "Project") {
	my $npid = Project->Lookup($pid);
	if (!defined($npid)) {
	    print STDERR "Lease->Create: Bad/Unknown project: $pid\n";
	    return undef;
	}
	$pid = $npid;
    }

    if (ref($uid) ne "User") {
	my $nuid = User->Lookup($uid);
	if (!defined($nuid)) {
	    print STDERR "Lease->Create: Bad/unknown user: $uid\n";
	    return undef;
	}
	$uid = $nuid
    }

    # User must belong to incoming project.  The code calling into Create()
    # should have already checked to be sure that the caller has permission
    # to create the lease in the first place.
    if (!$pid->LookupUser($uid)) {
	print STDERR "Lease->Create: User $uid is not a member of project $pid\n";
	return undef;
    }
    
    # If lease types ever grow to be many and complex, then this info will
    # have to come from a DB table instead of a static list in this module.
    if (!grep {/^$type$/} @LEASE_TYPES) {
	print STDERR "Lease->Create: Unknown lease type: $type\n";
	return undef;
    }

    # XXX: minimum lease length should be changeable via sitevar.
    if ($lease_end !~ /^\d+$/) {
	print "Lease->Create: Invalid lease end time: $lease_end\n";
	return undef;
    }
    if ($lease_end < time() + $MINLEASELEN) {
	print STDERR "Lease->Create: Lease end is not far enough in the future.\n";
	return undef;
    }

    if (!grep {/^$state$/} @LEASE_STATES) {
	print STDERR "Lease->Create: Unknown lease state: $state\n";
	return undef;
    }

    # Get a unique lease index and slam this stuff into the DB.
    my $lease_idx = TBGetUniqueIndex('next_leaseidx');

    DBQueryWarn("insert into project_leases set ".
		"lease_idx=$lease_idx,".
		"lease_id='$lease_id',".
		"pid='". $pid->pid() ."',".
		"owner_uid='". $uid->uid() ."',".
		"type='$type',".
		"lease_end=FROM_UNIXTIME($lease_end),".
		"state='$state',".
		"statestamp=NOW(),"
		"inception=NOW()")
	or return undef;

    # Now add attributes, if passed in.
    if ($attrs) {
	while (my ($key,$valp) = each %{$attrs}) {
	    my ($val, $type);
	    if (ref($valp) eq "HASH") {
		$val  = DBQuoteSpecial($valp->{'value'});
		$type = $valp->{'type'} || "string";
	    } else {
		$val  = DBQuoteSpecial($valp);
		$type = "string";
	    }
	    DBQueryWarn("insert into lease_attributes set ".
			"lease_idx=$lease_idx,".
			"attrkey='$key',".
			"attrval='$val',".
			"attrtype='$type'")
		or return undef;
	}
    }

    return Lookup($class, $pid->pid(), $lease_id);
}

#
# Delete an existing lease.
#
sub Delete($) {
    my ($self) = @_;

    return -1
	if (!ref($self));

    my $idx  = $self->idx();
    my $plid = $self->pid() + ":" + $self->lease_id();

    DBQueryWarn("delete from project_leases where lease_idx=$idx")
	or return -1;
    
    DBQueryWarn("delete from leases_attributes where lease_idx=$idx")
	or return -1;

    delete($leases{$idx})
	if (exists($leases{$idx}));
    delete($leases{$plid})
	if (exists($leases{$plid}));

    return 0
}

#
# Return a list of all leases belonging to a particular project.
#
sub AllProjectLeases($$)
{
    my ($class, $pid)  = @_;
    my @leases = ();
    
    return undef
	if !defined($pid);

    if (ref($pid) eq "Project") {
	$pid = $pid->pid();
    }
    
    my $query_result =
	DBQueryWarn("select lease_id from leases where pid='$pid'");
    
    return ()
	if (!$query_result || !$query_result->numrows);

    while (my ($lease_id) = $query_result->fetchrow_array()) {
	my $lease = Lookup($class, $pid, $lease_id);

	# Something went wrong?
	return ()
	    if (!defined($lease));
	
	push(@leases, $lease);
    }
    return @leases;
}

#
# Grab all leases belonging to a particular user
#
sub AllUserLeases($$)
{
    my ($class, $uid)  = @_;
    my @leases = ();
    
    return undef
	if !defined($uid);

    if (ref($uid) eq "User") {
	$uid = $uid->uid();
    }
    
    my $query_result =
	DBQueryWarn("select lease_idx from leases where owner_uid='$uid'");
    
    return ()
	if (!$query_result || !$query_result->numrows);

    while (my ($lease_idx) = $query_result->fetchrow_array()) {
	my $lease = Lookup($class, $lease_idx);

	# Something went wrong?
	return ()
	    if (!defined($lease));
	
	push(@leases, $lease);
    }
    return @leases;
}

#
# Update fields in the project_leases table, as requested.
#
sub Update($$)
{
    my ($self, $argref) = @_;

    # Must be a real reference. 
    return -1
	if (! ref($self));

    my $idx = $self->idx();
    my @sets   = ();

    foreach my $key (keys(%{$argref})) {
	my $val = $argref->{$key};

	# Don't let caller update the lease's index - that would be bad.
	return -1
	    if ($key eq "lease_idx");

	# Treat NULL special.
	push (@sets, "${key}=" . ($val eq "NULL" ?
				  "NULL" : DBQuoteSpecial($val)));
    }

    my $query = "update project_leases set " . join(",", @sets) .
	" where lease_idx='$idx'";

    return -1
	if (! DBQueryWarn($query));

    return Refresh($self);
}

#
# Refresh a class instance by reloading from the DB.
#
sub Refresh($)
{
    my ($self) = @_;

    return -1
	if (! ref($self));

    my $idx = $self->idx();

    my $query_result =
	DBQueryWarn("select * from project_leases".
		    " where lease_idx='$idx'");

    return -1
	if (!$query_result || !$query_result->numrows);

    $self->{"DBROW"}    = $query_result->fetchrow_hashref();
    $self->{"PROJ"}     = $self->{"DBROW"}->{"pid"};
    $self->{"LEASE_ID"} = $self->{"DBROW"}->{"lease_id"};
    $self->{"IDX"}      = $self->{"DBROW"}->{"lease_idx"};
    $self->{"ATTRS"}    = undef;

    return 0;
}

#
# Update to the given state and bump timestamp.
#
sub UpdateState($$) {
    my ($self, $state) = @_;

    return -1
	if (!ref($self));

    return -1
	if (!defined($state));

    if (!grep {/^$state$/} $LEASE_STATES) {
	print STDERR "Lease->UpdateState: Invalid state: $state\n";
	return -1;
    }

    my $idx = $self->idx();
    DBQueryWarn("update project_leases set state='$state',statestamp=NOW() ".
		"where lease_idx=$idx")
	or return -1;

    return 0;
}

#
# Bump last_used column
#
sub BumpLastUsed($) {
    my ($self) = @_;

    return -1
	if (!ref($self));

    my $idx = $self->idx();
    DBQueryWarn("update project_leases set last_used=NOW() where lease_idx=$idx");
    return 0;
}

#
# Add time to an existing lease
#
sub AddTime($$) {
    my ($self, $ntime) = @_;

    return -1
	if (!ref($self));

    if ($ntime < 1) {
	print STDERR "Lease->AddTime: Time to add must be a positive number of seconds.\n";
	return -1
    }

    my $idx = $self->idx();
    my $newend = $self->lease_end() + $ntime;
    DBQueryWarn("update project_leases set lease_end=FROM_UNIXTIME($newend) where lease_idx=$idx")
	or return -1;

    return 0;
}

#
# Set a specific lease end time
#
sub SetEndTime($$) {
    my ($self, $ntime) = @_;

    return -1
	if (!ref($self));

    if ($ntime < time()) {
	print STDERR "Lease->SetEndTime: Can't move lease end time into the past.\n";
	return -1
    }

    my $idx = $self->idx();
    DBQueryWarn("update project_leases set lease_end=FROM_UNIXTIME($ntime) where lease_idx=$idx")
	or return -1;

    return 0;
}

#
# Check to see if the lease has expired.
#
sub IsExpired($) {
    my ($self) = @_;
    
    if ($self->lease_end() < time()) {
	return 1;
    }

    return 0;
}

#
# Check Lease permissions for a specific user.
#
sub AccessCheck($$$) {
    my ($self, $user, $access_type) = @_;
    my $user_access = 0;

    if (ref($user) ne "User") {
	print STDERR "Lease->AccessCheck: 'user' argument must be a valid User object.\n";
	return 0;
    }

    if ($access_type < $LEASE_ACCESS_MIN || $access_type > $LEASE_ACCESS_MAX) {
	print STDERR "Lease->AccessCheck: Invalid access type: $access_type\n";
	return 0;
    }

    # Testbed admins have all privs.
    if ($user->IsAdmin() || $UID == 0 || $UID eq "root") {
	return 1;
    }

    # Some special cases
    if ($user->uid() eq $self->owner_uid()) {
	# Owning UID has all permissions.
	return 1;
    }

    # Need this for trust checks below.
    my $proj = Project->Lookup($self->pid());

    # Project managers can do anything to a lease that is attributed
    # to their project.
    if (TBMinTrust($proj->Trust($uid), PROJMEMBERTRUST_GROUPROOT())) {
	return 1;
    }

    # If the user is a member of the owning project, then they can at
    # least grab the lease's info.
    if (TBMinTrust($proj->Trust($uid), PROJMEMBERTRUST_USER())) {
	$user_access = LEASE_ACCESS_READINFO();
    }

    my $idx = $self->idx();
    my $qres = DBQueryWarn("select permission_type,permission_idx,allow_modify from lease_permissions where lease_idx=$idx");

    # If nothing was returned, just pass back the result based on the
    # special checks above.
    return (TBMinTrust($user_access, $access_type) ? 1 : 0)
	if !defined($qres);

    while (my ($perm_type, $perm_idx, $modify) = $qres->fetchrow_array()) {
	if ($perm_type eq "group") {
	    # If the user is a member of this group and has a minimum of
	    # trust, then give them the access listed in the db.
	    my $dbgroup = Group->Lookup($perm_idx);
	    if ($dbgroup && TBMinTrust($dbgroup->Trust($user), 
				       PROJMEMBERTRUST_LOCALROOT()) {
		$user_access = 
		    $modify ? LEASE_ACCESS_MODIFY() : LEASE_ACCESS_READ();
	    }
	} elsif ($perm_type eq "user") {
	    # If this is a user permission, and the incoming user arg matches,
	    # then give them the privileges listed in this entry.
	    my $dbuser = User->Lookup($perm_idx);
	    if (defined($dbuser) && $dbuser->uid() == $user->uid()) {
		$user_access = 
		    $modify ? LEASE_ACCESS_MODIFY() : LEASE_ACCESS_READ();
	    }
	} else {
	    print STDERR "Lease->AccessCheck: Unknown permission type in DB for lease index $idx: $perm_type\n";
	    return 0;
	}
    }

    return (TBMinTrust($user_access, $access_type) ? 1 : 0);
}

#
# Grant permission to access a Lease.
#
sub GrantAccess($$$)
{
    my ($self, $target, $modify) = @_;
    $modify = ($modify ? 1 : 0);

    my $idx      = $self->idx()();
    my $lease_id = $self->lease_id();
    my ($perm_idx, $perm_id, $perm_type);

    if (ref($target) eq "User") {
	$perm_idx  = $target->uid_idx();
	$perm_id   = $target->uid();
	$perm_type = "user";
    } 
    elsif (ref($target) eq "Group") {
	$perm_idx  = $target->gid_idx();
	$perm_id   = $target->pid() . "/" . $target->gid();
	$perm_type = "group";
    } 
    else {
	print STDERR "Lease->GrantAccess: Bad target: $target\n";
	return -1;
    }

    return -1
	if (!DBQueryWarn("replace into lease_permissions set ".
			 "  lease_idx=$idx, lease_id='$lease_id', ".
			 "  permission_type='$perm_type', ".
			 "  permission_id='$perm_id', ".
			 "  permission_idx='$perm_idx', ".
			 "  allow_modify='$modify'"));
    return 0;
}


#
# Revoke permission for a lease.
#
sub RevokeAccess($$)
{
    my ($self, $target) = @_;

    my $idx        = $self->idx();
    my ($perm_idx, $perm_type);

    if (ref($target) eq "User") {
	$perm_idx  = $target->uid_idx();
	$perm_type = "user";
    }
    elsif (ref($target) eq "Group") {
	$perm_idx  = $target->gid_idx();
	$perm_type = "group";
    }
    else {
	print STDERR "Lease->RevokeAccess: Bad target: $target\n";
	return -1;
    }

    return -1
	if (!DBQueryWarn("delete from lease_permissions ".
			 "where lease_idx=$idx' and ".
			 "  permission_type='$perm_type' and ".
			 "  permission_idx='$perm_idx'"));
    return 0;
}

#
# Load attributes if not already loaded.
#
sub LoadAttributes($)
{
    my ($self) = @_;

    return -1
	if (!ref($self));

    return 0
	if (defined($self->{"ATTRS"}));

    #
    # Get the attribute array.
    #
    my $idx = $self->idx();
    
    my $query_result =
	DBQueryWarn("select attrkey,attrvalue,attrtype".
		    "  from lease_attributes ".
		    "  where lease_idx='$idx'");

    $self->{"ATTRS"} = {};
    while (my ($key,$val,$type) = $query_result->fetchrow_array()) {
	$self->{"ATTRS"}->{$key} = { "key"   => $key,
				     "value" => $val,
				     "type"  => $type };
    }
    return 0;
}

#
# Stringify for output.
#
sub Stringify($)
{
    my ($self) = @_;
    
    my $lease_id  = $self->lease_id();
    my $pid = $self->pid();
    my $uid = $self->owner();

    return "[Lease: $pid/$lease_id/$uid]";
}

#
# Look for an attribute.
#
sub GetAttribute($$;$$$)
{
    my ($self, $attrkey, $pattrvalue, $pattrtype) = @_;
    
    goto bad
	if (!ref($self));

    $self->LoadAttributes() == 0
	or goto bad;

    if (!exists($self->{"ATTRS"}->{$attrkey})) {
	return undef
	    if (!defined($pattrvalue));
	$$pattrvalue = undef;
	return 0;
    }

    my $ref = $self->{"ATTRS"}->{$attrkey};

    # Return value instead if a $pattrvalue not provided. 
    return $ref->{'value'}
        if (!defined($pattrvalue));
    
    $$pattrvalue = $ref->{'value'};
    $$pattrtype  = $ref->{'type'}
        if (defined($pattrtype));

    return 0;
    
  bad:
    return undef
	if (!defined($pattrvalue));
    $$pattrvalue = undef;
    return -1;
}

#
# Grab all attributes.
#
sub GetAttributes($)
{
    my ($self) = @_;
    
    return undef
	if (!ref($self));

    $self->LoadAttributes() == 0
	or return undef;

    return $self->{"ATTRS"};
}


#
# Set the value of an attribute
#
sub SetAttribute($$$;$)
{
    my ($self, $attrkey, $attrvalue, $attrtype) = @_;
    
    return -1
	if (!ref($self));

    $self->LoadAttributes() == 0
	or return -1;

    $attrtype = "string"
	if (!defined($attrtype));
    my $safe_attrvalue = DBQuoteSpecial($attrvalue);
    my $idx = $self->idx();

    DBQueryWarn("replace into lease_attributes set ".
		"  lease_idx='$idx', attrkey='$attrkey', ".
		"  attrtype='$attrtype', attrvalue=$safe_attrvalue")
	or return -1;

    $self->{"ATTRS"}->{$attrkey} = {
	"key" => $attrkey
	"value" => $attrvalue,
	"type" => $attrtype
    };

    return 0;
}

#
# Remove an attribute
#
sub DeleteAttribute($$) {
    my ($self, $attrkey) @_;

    return -1
	if (!ref(self));

    my $idx = $self->idx();
    DBQueryWarn("delete from lease_attributes where lease_idx=$idx and attrkey='$attrkey'");

    delete($self->{"ATTRS"}->{$attrkey})
	if (exists($self->{"ATTRS"}->{$attrkey}));

    return 0;
}

#
# Lock and Unlock
#
sub Lock($)
{
    my ($self) = @_;

    # Must be a real reference. 
    return -1
	if (! ref($self));

    # Already locked?
    if ($self->GotLock()) {
	return 0;
    }

    return -1
	if (!DBQueryWarn("lock tables project_leases write"));

    my $idx = $self->idx();

    my $query_result =
	DBQueryWarn("update project_leases set locked=now(),locker_pid=$PID " .
		    "where lease_idx=$idx and locked is null");

    if (! $query_result ||
	$query_result->numrows == 0) {
	DBQueryWarn("unlock tables");
	return -1;
    }
    DBQueryWarn("unlock tables");
    $self->{'LOCKED'} = time();
    $self->{'LOCKER_PID'} = $PID;
    return 0;
}

sub Unlock($)
{
    my ($self) = @_;

    # Must be a real reference. 
    return -1
	if (! ref($self));

    my $idx   = $self->idx();

    return -1
	if (! DBQueryWarn("update project_leases set locked=null,locker_pid=0 " .
			  "where lease_idx=$idx"));
    
    $self->{'LOCKED'} = 0;
    $self->{'LOCKER_PID'} = 0;
    return 0;
}

sub GotLock($)
{
    my ($self) = @_;

    return 1
	if ($self->{'LOCKED'} &&
	    $self->{'LOCKER_PID'} == $PID);
    
    return 0;
}

#
# Wait to get lock.
#
sub WaitLock($$)
{
    my ($self, $seconds) = @_;

    # Must be a real reference. 
    return -1
	if (! ref($self));

    while ($seconds > 0) {
	return 0
	    if ($self->Lock() == 0);

	# Sleep and try again.
	sleep(5);
	$seconds -= 5;
    }
    # One last try.
    return $self->Lock();
}

# _Always_ make sure that this 1 is at the end of the file...

1;
