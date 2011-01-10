#!/usr/bin/perl -w

#
# EMULAB-LGPL
# Copyright (c) 2000-2010 University of Utah and the Flux Group.
# Copyright (c) 2004-2010 Regents, University of California.
# All rights reserved.
#

package snmpit_stack;
use strict;

$| = 1; # Turn off line buffering on output

use English;
use SNMP;
use snmpit_lib;

use libdb;
use libtestbed;

our %devices;
our $parallelized = 1;

#
# Creates a new object. A list of devices that will be operated on is given
# so that the object knows which to connect to. A future version may not 
# require the device list, and dynamically connect to devices as appropriate
#
# usage: new(string name, string stack_id, int debuglevel, list of devicenames)
# returns a new object blessed into the snmpit_stack class
#

sub new($$$@) {

    # The next two lines are some voodoo taken from perltoot(1)
    my $proto = shift;
    my $class = ref($proto) || $proto;

    my $stack_id = shift;
    my $debuglevel = shift;
    my @devicenames = @_;

    #
    # Create the actual object
    #
    my $self = {};

    #
    # Set up some defaults
    #
    if (defined $debuglevel) {
	$self->{DEBUG} = $debuglevel;
	$snmpit_stack_child::child_debug = $debuglevel;
    } else {
	$self->{DEBUG} = 0;
    }

    $self->{STACKID} = $stack_id;
    $self->{MAX_VLAN} = 4095;
    $self->{MIN_VLAN} = 2;
    #
    # The name of the leader of this stack. We fall back on the old behavior of
    # using the stack name as the leader if the leader is not set
    #
    my $leader_name = getStackLeader($stack_id);
    if (!$leader_name) {
	$leader_name = $stack_id;
    }
    $self->{LEADERNAME} = $leader_name;

    #
    # Store the list of devices we're supposed to operate on
    #
    @{$self->{DEVICENAMES}} = @devicenames;

    # see if we can run parallelized
    if (main::peekopt('slow')) { $parallelized = 0; }
    if ($parallelized && (!(eval "require IO::EventMux") ||
				!(eval "require RPC::Async"))) {
	$parallelized = 0;
	if ($debuglevel) {
	    print "parallel snmpit_stack requires RPC::Async and friends\n";
	}
    }

    # must do this before spawning each device object, which forks().
    bless($self,$class);

    #
    # Make a device-dependant object for each switch
    # 
    foreach my $devicename (@devicenames) {
	print("Making device object for $devicename\n") if $self->{DEBUG};
	my $type = getDeviceType($devicename);
	my $device = $devices{$devicename};

	#
	# Check to see if this is a duplicate for *this* stack
	#
	if (defined($self->{DEVICES}{$devicename})) {
	    warn "WARNING: Device $devicename was specified twice, skipping\n";
	    next;
	}
	#
	# Also check to see if we already have made this device 
	# for a different stack ...
	# 
	die "Failed to create a device object for $devicename\n" unless
	    $device = $device || snmpit_jitdev->create($devicename,$type,$self);

	$self->{DEVICES}{$devicename} = $device;
	if ($devicename eq $self->{LEADERNAME}) {
	    $self->{LEADER} = $device;
	}

	if (defined($device->{MIN_VLAN}) &&
	    ($self->{MIN_VLAN} < $device->{MIN_VLAN}))
		{ $self->{MIN_VLAN} = $device->{MIN_VLAN}; }
	if (defined($device->{MAX_VLAN}) &&
	    ($self->{MAX_VLAN} > $device->{MAX_VLAN}))
		{ $self->{MAX_VLAN} = $device->{MAX_VLAN}; }
    }

    my %h = $self->reapCall("device_setup");
    while (my ($devicename, $aref) = each %h) {
       my $status = @$aref[0];
       die "$devicename $status\n" if ($status ne "OK");
    }
    return $self;
}

#
# List all VLANs on all switches in the stack
#
# usage: listVlans(self)
#
# returns: A list of VLAN information. Each entry is an array reference. The
#	array is in the form [id, num, members] where:
#		id is the VLAN identifier, as stored in the database
#		num is the 802.1Q vlan tag number.
#		members is a reference to an array of VLAN members
#
sub listVlans($) {
    my $self = shift;

    #
    # We need to 'collate' the results from each switch by putting together
    # the results from each switch, based on the VLAN identifier
    #
    my %vlans = ();
    while (my ($devicename, $device) = each %{$self->{DEVICES}}) {
	$device->listVlans_start();
    }
    my %collector = $self->reapCall("listVlans");
    foreach my $devicename (sort {tbsort($a,$b)} keys %{$self->{DEVICES}}) {
	my @dev_result = @{$collector{$devicename}};
	next if (!@dev_result);
	foreach my $line (@dev_result) {
	    my ($vlan_id, $vlan_number, $memberRef) = @$line;
	    ${$vlans{$vlan_id}}[0] = $vlan_number;
	    push @{${$vlans{$vlan_id}}[1]}, @$memberRef;
	}
    }

    #
    # Now, we put the information we've found in the format described by
    # the header comment for this function
    #
    my @vlanList;
    foreach my $vlan (sort {tbsort($a,$b)} keys %vlans) {
	push @vlanList, [$vlan, @{$vlans{$vlan}}];
    } 
    return @vlanList;
}

#
# List all ports on all switches in the stack
#
# usage: listPorts(self)
#
# returns: A list of port information. Each entry is an array reference. The
#	array is in the form [id, enabled, link, speed, duplex] where:
#		id is the port identifier (in node:port form)
#		enabled is "yes" if the port is enabled, "no" otherwise
#		link is "up" if the port has carrier, "down" otherwise
#		speed is in the form "XMbps"
#		duplex is "full" or "half"
#
sub listPorts($) {
    my $self = shift;

    #
    # All we really need to do here is collate the results of listing the
    # ports on all devices
    #
    my %portinfo = (); 
    while (my ($devicename, $device) = each %{$self->{DEVICES}}) {
	$device->listPorts_start();
    }
    my %h = $self->reapCall('listPorts');
    foreach my $rref (@h{sort {tbsort($a,$b)} keys %h}) {
	foreach my $line (@$rref) {
	    my $port = $$line[0];
	    if (defined $portinfo{$port}) {
		warn "WARNING: Two ports found for $port\n";
	    }
	    $portinfo{$port} = $line;
	}
    }

    return map $portinfo{$_}, sort {tbsort($a,$b)} keys %portinfo;
}

#
# internal helper function for makeVlanPorts.
#
sub modPortForm($$) {
    my ($dev,$port) = @_;
    if ($port =~ /^(\w+):(\d+)/) {$port = portnum($port);}
    if ($port =~ /$dev:(\d+).(\d+)/) { $port = "$1.$2";}
    elsif ($port =~ /(\d+).(\d+)/) {$port = $port;}
    else { print "modPortForm: couldn't grok $port\n"; }
    return $port;
}

#
# Allocate a vlan number currently not in use on the stack.
# The process calling this must lock out other allocations
# until the vlan is instantiated or the number is reserved
# in the database.
#
# usage: newVlanNumber(self, vlan_identifier)
#
# returns a number in $self->{VLAN_MIN} ... $self->{VLAN_MAX}
# or zero indicating failure: either that the id exists,
# or the number space is full.
#
sub newVlanNumber($$;$$$) {
    my ($self, $vlan_id, $reqnum, $bydev_p, $exclude_p) = @_;
    my ($bydev, %vlans, %allnums, @nulllist);

    $self->debug("stack::newVlanNumber $vlan_id\n");

    $bydev = $bydev_p && $$bydev_p;
    %vlans = $self->findVlans2(\@nulllist,\$bydev);
    if (defined($bydev_p) && !defined($$bydev_p)) { $$bydev_p = $bydev; }

    my $number = $vlans{$vlan_id};
    if ($number) {
	if ($reqnum && ($reqnum != $number)) {
	    print "The vlan $vlan_id already exists with tag $number, ".
		    "instead of the requested number $reqnum\n";
	    return 0;
	}
	return $number;
    } else {
	return $reqnum if ($reqnum);
    }

    @allnums{values %vlans} = undef;
    if (!defined($exclude_p)) {
	my @excluded = getReservedVlanTags();
	$exclude_p = \@excluded;
    }
    @allnums{@$exclude_p} = undef;

    $number = $self->{MIN_VLAN}-1;
    my $lim = $self->{MAX_VLAN};
    do { ++$number }
	until (!(exists($allnums{$number})) || ($number > $lim));
    return $number <= $lim ? $number : 0;
}

#
# Allocate vlan numbers for a set of vlans. 
#
# usage: newVlanNumbers(self, \@vlan_identifiers)
#
# returns a hash giving the assigned numbers, a hash saying which
# vlan_ids already exist on this stack, and a hash that can be reused
# by planVlan to avoid redunantly surveying all the switches for
# existing vlans.
# 
sub newVlanNumbers($$) {
    my ($self, $vlanids_p) = @_;
    my ($bydev, $oldnum, $newnum);
    my (%assigned, %existing, @exclude, @nulllist);

    return () unless ($vlanids_p && @$vlanids_p);

    $self->lock();
    @exclude = getReservedVlanTags();
    %existing = $self->findVlans2(\@nulllist, \$bydev);
    foreach my $vlan_id (@$vlanids_p) {
	$oldnum = getReservedVlanTag($vlan_id);
	$newnum = $self->newVlanNumber($vlan_id,$oldnum,\$bydev,\@exclude);
	if (!$newnum) {
	    self->unlock();
	    return undef;
	}
	reserveVlanTag($vlan_id, $newnum);
	$assigned{$vlan_id} = $newnum;
	push @exclude, $newnum;
    }
    $self->unlock();
    return [\%assigned, \%existing, $bydev];
}

sub mapStackPorts($$;$)
{
    my ($self, $ports, $prim) = @_;
    my (%bigmap, %checkedmap, %missing) = mapPortsToDevices(@$ports);
    my $selfdevs = $self->{DEVICES};
    my $m1 = "stack " . $self->{STACKID} . " doesn't include switch";
    @missing{@$ports} = undef;

    while (my ($devname, $portlist) = each %bigmap) {
	if ($selfdevs->{$devname}) {
	    $checkedmap{$devname} = $portlist;
	    delete @missing{$portlist && @$portlist};
	} else {
	    if ($prim || $self->{DEBUG}) 
		{ print "$m1 $devname having ports @$portlist\n"; }
	    return () if ($prim);
	}
    }
    return () if ($prim && scalar(%missing));
    return %checkedmap;
}

#
# usage: planVlan(self, vlan_id, vlan_num, vlansbydevp, porthash_ptr[, jostle]);
#
# Create a structure distributing which ports and trunks will be added
# to an new or existing vlan by switch.
#
# returns: plan (hash) on success
# returns: undef on error
#
sub planVlan($$$$$;$) {
    my ($self, $vlan_id, $vlan_num, $devnums, $portsref, $jostle) = @_;
    my ($newnum, %switches, @switches, %trunks, @trunks);
    my (%already, %bigplan);

    #
    # Split up the ports among the devices involved
    #
    my %portmap = mapStackPorts($self,[keys %$portsref]);
    @switches{keys %portmap} = (1) x keys %portmap;
    while (my ($dev, $lref) = each %$devnums) {
	$already{$dev} = $switches{$dev} = 1 if ($lref->{$vlan_id});
    }
    #
    # Determine which trunks and possible transit-only switches
    # are necessary to complete the picture. We will assume that
    # if the vlan already exsists on both sides of the trunk it
    # was previously added to the trunk.  If we are flushing
    # the FDB we need to record all trunks, however.
    #
    %trunks = getTrunks();
    @trunks = getTrunksFromSwitches(\%trunks, keys %switches);
    foreach my $trunk (@trunks) {
	my ($src,$dst) = @$trunk;
	$switches{$src} = $switches{$dst} = 1;
	if ($jostle || !($already{$src} && $already{$dst})) {
	    push @{$portmap{$src}}, @{$trunks{$src}->{$dst}};
	    push @{$portmap{$dst}}, @{$trunks{$dst}->{$src}};
	}
    }
    #
    # Pivot by switch, collecting arguments into a convenient form
    #
    foreach my $dev (keys %switches) {
	next unless ($portmap{$dev});
	my %devplan;
	foreach my $port (@{$portmap{$dev}})
	    { $devplan{modPortForm($dev,$port)} = $portsref->{$port}; }
	$bigplan{$dev} = [$vlan_id, $vlan_num, $already{$dev}, \%devplan];
    }
    return \%bigplan;
}

#
# usage: jostle(self, bumplistp, vlansbydevp);
#
# Used to remove stale references from a switch's FDB
# when a port leaves a remaining vlan, because the mac might be
# reachable by bridging from a different trunk than previously.
#
sub jostle($$$) {
    my ($self, $bumpedlistp, $devnums) = @_;
    my $namehash = $self->findVlanNames($bumpedlistp, $devnums);
    my %jplan;

    print "will jostle vlan(s)";
    while (my ($vlan_id, $vlan_number) = each %$namehash) {
	print " $vlan_id($vlan_number)";
	my $vplan = $self->planVlan($vlan_id, $vlan_number, $devnums, {}, 1);
	while (my ($dev, $devplan) = each %$vplan) {
	    my ($igname, $dvlan, $igexists, $trunkhash) = @$devplan;
	    foreach my $trunk (keys %$trunkhash) {
		push @{$jplan{$dev}}, 'resetVlanIfOnTrunk', [$trunk, $dvlan];
	    }
	}
    }
    print " ... ";
    $self->invokePlan('metaSequence', \%jplan);
    print " done\n";
}

#
# helper function to decipher results when metaSequence() gets invoked().
#
sub countMetaErrors($$) {
    my ($self, $h) = @_;
    my ($errors, %displaced, %failed) = (0);

    while (my ($dev, $lref) = each %$h) {
	while (@$lref) {
	    my ($func, $vref) = (shift @$lref, shift @$lref);
	    my ($rv) = @$vref;
	    if (($func eq 'setVlansOnTrunk') || ($func eq 'removeVlan')) {
		$errors += ($rv eq 0);
	    } elsif (($func eq 'removePortsFromVlan') ||
		     ($func eq 'removeSomePortsFromVlan')) {
		$errors += $rv;
	    } elsif ($func eq 'metaMakeVlan') {
		if ($rv->{errors})
		    { $errors += $rv->{errors}; $failed{$rv->{vlan}} = 1;}
		if (my $dvp = $rv->{DISPLACED_VLANS})
		    { @displaced{@$dvp} = (); }
	    } else {
		print "countMetaErrors: can't parse $func\n";
	    }
	}
    }
    return { errors => $errors, DISPLACED_VLANS => [keys %displaced], 
		FAILED_VLANS => [keys %failed] };
}

sub doVlanPlans($$)
{
    my ($self, $planslist) = @_;
    my %plansbydev;

    foreach my $plan (@$planslist) {
	while (my ($dev, $aref) = each %$plan) {
	    push @{$plansbydev{$dev}}, 'metaMakeVlan', $aref;
	}
    }
    my %h = $self->invokePlan('metaSequence',\%plansbydev);
    my $result = countMetaErrors($self, \%h);
    $result->{bydev} = \%h;
    return $result;
}

#
# Creates a VLAN with the given VLAN identifier on the stack. If ports are
# given, puts them into the newly created VLAN. It is not an error to
# invoke this to put ports into an existing vlan.  Parallel version.
#
# usage: makeVlan(self, vlan_id, plist_ptr, [vlan_num, jostle]);
#
# returns: vlan number on success
# returns: 0 on failure
#
sub makeVlanPorts($$$;$$) {
    my ($self, $vlan_id, $portsref, $number, $jostle) = @_;
    my ($errors, $results, $newnum, $devnums) = (0);

    $self->lock();
    LOCKBLOCK: {
	$newnum = $self->newVlanNumber($vlan_id, $number, \$devnums);
	if ($newnum == 0) {
		last LOCKBLOCK;
	}
	my $bigplan = $self->planVlan($vlan_id, $newnum, $devnums, $portsref);
	$results = $self->doVlanPlans([$bigplan]);
	if ($results->{errors}) {$newnum = 0;}
	print ($newnum ? "Succeeded\n" : "Failed\n");
    }
    $self->unlock();
    $self->jostle($results->{DISPLACED_VLANS}, $devnums)
	if ($newnum && $jostle && $results && @{$results->{DISPLACED_VLANS}});
    return $newnum;
}

#
# Given VLAN indentifiers from the database, finds the 802.1Q VLAN
# number for them. If no VLAN id is given, returns mappings for the entire
# switch.
# 
# usage: findVlans($self, @vlan_ids)
#        returns a hash mapping VLAN ids to 802.1Q VLAN numbers
#
sub findVlans($@) {
    my ($self, @vlan_ids) = @_;
    return findVlans2($self,\@vlan_ids);
}

sub findVlans2($$;$) {
    my ($self, $idref, $bydevref) = @_;
    my @vlan_ids = @$idref;
    my ($results, %mapping) = ({});

    $self->debug("snmpit_stack::findVlans( @vlan_ids )\n");
    if ($bydevref && $$bydevref) {
	$results = $$bydevref;
    } else {
	foreach my $device (values %{$self->{DEVICES}})
	    { $device->findVlans_start(@vlan_ids); }
	my %h = $self->reapCall("findVlans");
	foreach my $dev (keys %h)
	    { $results->{$dev} = { @{$h{$dev}} } if (defined($h{$dev})); }
	$$bydevref = $results if (defined($bydevref));
    }
    while (my ($devicename, $devmapref) = each %$results) {
	while (my ($id, $num) = each %$devmapref) {
	    if (defined(my $oldnum = $mapping{$id})) {
		if (defined($num) && ($num != $oldnum)) {
		    warn "Incompatible 802.1Q tag assignments for $id\n" .
		       "    Saw $num on $devicename, but was $oldnum before\n";
		}
	    } else
		{ $mapping{$id} = $num; }
	}
    }
    return %mapping;
}

#
# Given multiple 802.1Q VLAN tags, find the identifiers.
# Returns names to numbers, e.g. for use in jostle() below.
#
sub findVlanNames($$;$) {
    my ($self, $numsp, $bydevref) = @_;
    my (%namehash, @nulllist);

    my %allvlans = $self->findVlans2(\@nulllist, \$bydevref);
    while (my ($vlan, $num) = each %allvlans) {
	$namehash{$vlan} = $num if (grep {$_ eq $num} @$numsp);
    }
    return \%namehash;
}


#
# Given a single VLAN indentifier, find the 802.1Q VLAN tag for it. 
# 
# usage: findVlan($self, $vlan_id)
#        returns the number if found
#        0 otherwise;
#
sub findVlan($$) {
    my ($self, $vlan_id) = @_;

    $self->debug("snmpit_stack::findVlan( $vlan_id )\n");
    if ($parallelized) {
	my %dev_map = $self->findVlans($vlan_id);
	my $vlan_num = $dev_map{$vlan_id};
	return defined($vlan_num) ? $vlan_num : 0;
    }
    foreach my $devicename (sort {tbsort($a,$b)} keys %{$self->{DEVICES}}) {
	my $device = $self->{DEVICES}->{$devicename};
	my %dev_map = $device->findVlans($vlan_id);
	my $vlan_num = $dev_map{$vlan_id};
	if (defined($vlan_num)) { return $vlan_num; }
    }
    return 0;
}

#
# Check to see if the given VLAN exists in the stack
#
# usage: vlanExists(self, vlan identifier)
#
# returns 1 if the VLAN exists
#         0 otherwise
#
sub vlanExists($$) {
    my ($self, $vlan_id) = @_;

    return $self->findVlan($vlan_id) != 0;
}

#
# Return a list of which VLANs from the input set exist on this stack
#
# usage: existantVlans(self, vlan identifiers)
#
# returns: a list containing the VLANs from the input set that exist on this
# 	stack
#
sub existantVlans($@) {
    my $self = shift;
    my @vlan_ids = @_;

    my %mapping = $self->findVlans(@vlan_ids);

    return grep { defined($mapping{$_}) } @vlan_ids;
}

#
# Removes a VLAN from the stack. This implicitly removes all ports from the
# VLAN. It is an error to remove a VLAN that does not exist.
#
# usage: removeVlan(self, vlan identifiers)
# usage: removeVlans(self, \@vlan_identifiers, [\%allvlansbydev, \%pruneplan])
#
# returns: 1 on success
# returns: 0 on failure
#
sub removeVlan($@) { 
    my ($self, @vlan_ids) = @_;

    return $self->removeVlans(\@vlan_ids);
}

sub removeVlans($$;$$) {
    my ($self, $vlist, $devnums, $pruneplan) = @_;
    my @vlan_ids = $vlist && @$vlist;
    my %bigplan = $pruneplan ? (%$pruneplan ) : ();

    #
    # Exit early if no VLANs given
    #
    if (!@vlan_ids && !$pruneplan) {
	return 1;
    }

    #
    # Make sure that all vlans exist
    #
    my %vlan_numbers = $self->findVlans2(\@vlan_ids,\$devnums);
    if (my @missing_vlans = grep {!$vlan_numbers{$_};} @vlan_ids) {
	warn "ERROR: VLANs @missing_vlans not found on stack!";
    }

    #
    # Now, we go through each device scheduling all the VLANs on that
    # device to be removed.  Note that the order no longer matters -
    # CreateVlan's descendants inspect all switches simultaneously,
    # so it will not interfere with another snmpit processes.
    #
    foreach my $devname (keys %$devnums) {
	my $devhash = $devnums->{$devname};
	if ($devhash && (my @devids = grep {$devhash->{$_};} @vlan_ids)) {
	    push @{$bigplan{$devname}}, 'removeVlan', [@{$devhash}{@devids}];
	}
    }
    my %h = $self->invokePlan('metaSequence',\%bigplan);
    return ! $self->countMetaErrors(\%h)->{errors};
}

#
# Schedule ports or trunks to be removed from a vlan
#
sub planPortRemoval($$$$$$) {
    my ($self, $vlan_id, $areTrunks, $plist, $plan, $bydev) = @_;
    #
    # As mentioned above, order is no longer important.
    #
    my %map = $self->mapStackPorts($plist);
    foreach my $dev (keys %map) {
	my ($devlist, $devmap, $devnum) = $map{$dev};
	next if (!$devlist);
	($devmap = $bydev->{$dev}) && ($devnum = $devmap->{$vlan_id});
	if (!$devnum) {
	    warn "ERROR: VLAN $vlan_id didn't contain @$devlist ".
		 "on device $dev\n";
	    return 0;
	}
	my @devports = map {modPortForm($dev,$_);} @$devlist;
	if (!$areTrunks) {
	    push @{$plan->{$dev}},
		    'removeSomePortsFromVlan', [$devnum, @devports];
	} else {
	    foreach my $port (@devports) {
		push @{$plan->{$dev}}, 'setVlansOnTrunk', [$port, 0, $devnum];
	    }
	}
    }
    return 1;
}

#
# Remove some ports from a single vlan.
#
# usage: removeSomePortsFromVlan(self, vlanid, portlist)
#
# returns: 1 on success
# returns: 0 on failure
#
sub removeSomePortsFromVlan($$@) {
    my $self = shift;
    my $vlan_id = shift;
    my @ports = @_;

    my ($plan, $bydev) = ({});
    my %vlan_numbers = $self->findVlans2([$vlan_id],\$bydev);
    return 0
	unless $self->planPortRemoval($vlan_id, 0, \@ports, $plan, $bydev);
    my %h = $self->invokePlan('metaSequence',$plan);
    return ! $self->countMetaErrors(\%h)->{errors};
}

#
# Remove some trunks from a single vlan.
#
# usage: removeSomePortsFromTrunk(self, vlanid, portlist)
#
# returns: 1 on success
# returns: 0 on failure
#
# $device->removeSomePortsFromVlan() now checks whether a port is trunk
# so this function is only an optimization, not really necessary.
#
sub removeSomePortsFromTrunk($$@) {
    my $self = shift;
    my $vlan_id = shift;
    my @ports = @_;

    my ($plan, $bydev) = ({});
    my %vlan_numbers = $self->findVlans2([$vlan_id],\$bydev);
    return 0
	unless $self->planPortRemoval($vlan_id, 1, \@ports, $plan, $bydev);
    my %h = $self->invokePlan('metaSequence',$plan);
    return ! $self->countMetaErrors(\%h)->{errors};
}

#
# Set a variable associated with a port. 
# TODO: Need a list of variables here
#
sub portControl ($$@) { 
    my ($self, $cmd, @ports) = @_;
    my %portDeviceMap = mapStackPorts($self,\@ports);
    my $errors = 0;

    while (my ($devicename,$ports) = each %portDeviceMap) {
	$self->{DEVICES}{$devicename}->portControl_start($cmd,@$ports);
    }
    my %h = $self->reapCall('portControl');
    map { $errors += @$_[0]; } values %h;
    return $errors;
}

#
# Get port statistics for all devices in the stack
#
sub getStats($) {
    my $self = shift;
    my %stats;
    my $id = "WARNING: stack::getStats:";

    #
    # All we really need to do here is collate the results of listing the
    # ports on all devices
    #
    foreach my $device (values %{$self->{DEVICES}})
	{ $device->getStats_start(); }
    my %h = $self->reapCall('getStats');
    while (my ($devname, $lref) = each %h) {
	foreach my $line (@$lref) {
	    my $port = $$line[0];
	    if (!defined($port))
		{ warn "$id: unnamed port from $devname\n"; next; }
	    if (grep {!defined($_);} @$line)
		{ warn "$id: $devname/$port had undefined values"; next;}
	    if (scalar(@$line) < 13)
		{ warn "$id: $devname/$port had too few values"; next;}
	    warn "$id: Two ports found for $port\n" if (defined $stats{$port});
	    $stats{$port} = $line;
	}
    }
    return map $stats{$_}, sort {tbsort($a,$b)} keys %stats;
}

#
# Turns on trunking on a given port, allowing only the given VLANs on it
#
# usage: enableTrunking2(self, port, equaltrunking, vlan identifier list)
#
# formerly was enableTrunking() without the predicate to decline to put
# the port in dual mode.
#
# returns: 1 on success
# returns: 0 on failure
#
sub enableTrunking2($$$@) {
    my ($self, $port, $equaltrunking, @vlan_ids) = @_;
    my %map;

    return 0 unless (%map = $self->mapStackPorts([$port],1));

    if (!@vlan_ids) {
	if (!$equaltrunking) {
	    warn "ERROR: No VLAN passed to enableTrunking()!\n";
	    return 0;
	}
	my ($devname) = keys %map;
	return $self->{DEVICES}->{$devname}->enablePortTrunking2($port, 1, 1);
    }

    my ($bigplan, $bydev) = [];
    my %stackvlans = $self->findVlans2(\@vlan_ids,\$bydev);
    my $portplan = {$port => [$equaltrunking ? 'trunkequal' : 'trunkdual']};

    foreach my $vlan (@vlan_ids) {
	if (!defined($stackvlans{$vlan})) {
	    warn "stack::enableTrunking2: requested VLAN $vlan not on stack\n"; 
	    return 0;
	}
	push @$bigplan,
	    $self->planVlan($vlan, $stackvlans{$vlan}, $bydev, $portplan);
	$portplan->{$port} = undef;
    }
    my $result = $self->doVlanPlans($bigplan);
    return $result->{errors} ? 0 : 1;
}

#
# Turns off trunking for a given port
#
# usage: disableTrunking(self, ports)
#
# returns: 1 on success
# returns: 0 on failure
#
sub disableTrunking($@) {
    my ($self, @ports) = @_;
    my $rv = 1;

    return $rv if (!@ports);
    #
    # Split up the ports among the devices involved
    #
    my %map =  mapStackPorts($self,\@ports);

    #
    # Simply make the appropriate call on the devices
    # and look for any failures;
    #
    my %h = $self->invokePlan('disablePortTrunking',\%map);
    map { $rv = $rv && @$_[0]; } values %h;

    return $rv;
}

#
# Prints out a debugging message, but only if debugging is on. If a level is
# given, the debuglevel must be >= that level for the message to print. If
# the level is omitted, 1 is assumed
#
# Usage: debug($self, $message, $level)
#
sub debug($$;$) {
    my $self = shift;
    my $string = shift;
    my $debuglevel = shift;
   if (!(defined $debuglevel)) {
	$debuglevel = 1;
    }
    if ($self->{DEBUG} >= $debuglevel) {
	print STDERR $string;
    }
}

my $lock_held = 0;

sub lock($) {
    my $self = shift;
    my $stackid = $self->{STACKID};
    my $token = "snmpit_numbering";
    my $old_umask = umask(0);
    die if (TBScriptLock($token,0,1800) != TBSCRIPTLOCK_OKAY());
    umask($old_umask);
    $lock_held = 1;
}

sub unlock($) {
	if ($lock_held) { TBScriptUnlock(); $lock_held = 0;}
}

sub reapCall($$) {
    my ($self,$proc) = @_;
    $self->debug("snmpit_stack::reapCall($proc)\n");
    return snmpit_jitdev::reapCall($proc);
}

sub invokePlan($$$) {
    my ($self, $proc, $plan) = @_;
    while (my ($devname, $aref) = each %$plan) {
	my $device = $self->{DEVICES}->{$devname};
	$device && $device->startChildCall($proc, ($aref && @$aref));
    }
    return reapCall($self,$proc);
}

sub wrapOpenFlow($$$;@)
{
    my ($self, $op, $vlan_id, @args) = @_;
    my ($errors, $bydev, %plan, %ports) = (0);
    my ($ignore, $vlan_number) = $self->findVlans2([$vlan_id],\$bydev);
    while (my ($devicename, $devmap) = each %$bydev) {
	if (!defined($devmap->{$vlan_id})) {
	    #
	    # Not sure if this is an error or not.
	    # Not all devices in a stack may have the given VLAN.
	    #
	    $self->debug("$devicename has no VLAN $vlan_id, ignore it. \n");
	    next;
	}
	$plan{$devicename} = [$op, $vlan_id, @args];
    }
    my %h = $self->invokePlan('metaOpenFlow', \%plan);
    while (my ($devicename, $href) = each %h) {
	if ($op eq 'getUsedOpenflowListenerPorts') {
	    my %dports = ($href && @$href);
	    @ports{keys %dports} = values %dports;
	} else {
	    if (!defined($href)) { 
		$errors += 1;
		next;
	    }
	    my $value = @{$href}[0];
	    $errors += ($op eq 'setOpenflowListener') ? ($value == 0) : $value;
	}
    }
    return %ports if ($op eq 'getUsedOpenflowListenerPorts');
    return $errors;
}

#
# Enable Openflow
#
# enableOpenflow(self, vlan_id);
# return # of errors
#
sub enableOpenflow($$) {
    my $self = shift;
    my $vlan_id = shift;

    return $self->wrapOpenFlow('enableOpenflow',$vlan_id);
}

#
# Disable Openflow
# 
# disableOpenflow(self, vlan_id);
# return # of errors
#
sub disableOpenflow($$) {
    my $self = shift;
    my $vlan_id = shift;
    
    return $self->wrapOpenFlow('disableOpenflow',$vlan_id);
}

#
# Set Openflow controller on VLAN
# 
# setController(self, vlan_id, controller);
# return # of errors
#
sub setOpenflowController($$$) {
    my $self = shift;
    my $vlan_id = shift;
    my $controller = shift;
    
    return $self->wrapOpenFlow('setOpenflowController',$vlan_id, $controller);
}

#
# Set Openflow listener on VLAN
#
# setListener(self, vlan_id, listener);
# return # of errors
#
sub setOpenflowListener($$$) {
    my $self = shift;
    my $vlan_id = shift;
    my $listener = shift;
    
    return $self->wrapOpenFlow('setOpenflowListener',$vlan_id, $listener);
}
    

#
# Get used Openflow listener ports
#
# getUsedOpenflowListenerPorts(self, vlan_id)
#
sub getUsedOpenflowListenerPorts($$) {
    my $self = shift;
    my $vlan_id = shift;

    return $self->wrapOpenFlow('getUsedOpenflowListenerPorts',$vlan_id);
}

package snmpit_jitdev;
use Dumpvalue;
our $jitdev_dumper;

# class method to do lazy creation of devs.
# don't want to do an snmp connect, walk tables unless we have to.
# snmpit_jitdev->create($devicename, $type, $parent);


sub create($$$$) {
    my ($class, $name, $type, $parent) = @_;
    my $self = { NAME => $name, TYPE => $type,
		PARENT => $parent, DEBUG => $parent->{DEBUG}};
    # The device options get recorded in the fork,
    # so we have to do them here too (so we can fish out # min and max vlan)
    my $options = snmpit_lib::getDeviceOptions($name);
    $self->{MIN_VLAN} = $options->{'min_vlan'} if ($options);
    $self->{MAX_VLAN} = $options->{'max_vlan'} if ($options);
    if ($parent->{DEBUG} && !$jitdev_dumper) { $jitdev_dumper = new Dumpvalue; }
    bless ($self, $class);
    $devices{$name} = $self;
    $self->spawn() if ($snmpit_stack::parallelized);
    $self->startChildCall("device_setup",$name);
    # reapCall("device_setup"); done in snmpit_stack::new();
    return $self;
}

sub debug($$;$) { return &snmpit_stack::debug(@_); }

sub snap($) {
    my ($self) = @_;

    if (!defined($self->{OBJ})) {
	my $devicename = $self->{NAME};
	my $type = $self->{TYPE};
	my $device;

	if ($self->{DEBUG}) { print "snapping $devicename \n"; }

	#
	# We check the type for two reasons: to determine which kind of
	# object to create, and for some sanity checking to make sure
	# we weren't given devicenames for devices that aren't switches.
	#
	SWITCH: for ($type) {
	    (/cisco/) && do {
		use snmpit_cisco;
		$device = new snmpit_cisco($devicename,$self->{DEBUG});
		last;
		}; # /cisco/
	    (/foundry1500/ || /foundry9604/)
		    && do {
		use snmpit_foundry;
		$device = new snmpit_foundry($devicename,$self->{DEBUG});
		last;
		}; # /foundry.*/
	    (/nortel1100/ || /nortel5510/)
		    && do {
		use snmpit_nortel;
		$device = new snmpit_nortel($devicename,$self->{DEBUG});
		last;
		}; # /nortel.*/
	    (/hp/)
		    && do {
		use snmpit_hp;
		$device = new snmpit_hp($devicename,$self->{DEBUG});
		last;
		}; # /hp.*/
	    print "Device $devicename is not of a known type\n";
	}
	if (!$device) {
	    print "Device $devicename could not be instantiated, \n";
	    return undef;
	}
	# this is busted for delayed initialization
	# Foundry, Nortel's, and HP's have no device specific reason
	# to reduce the range, and someday the cisco code should be
	# amended to support 1025 <= tag < 4096.

	my $parent = $self->{PARENT};

	if (defined($device->{MIN_VLAN}) &&
	    ($parent->{MIN_VLAN} < $device->{MIN_VLAN}))
		{ $parent->{MIN_VLAN} = $device->{MIN_VLAN}; }
	if (defined($device->{MAX_VLAN}) &&
	    ($parent->{MAX_VLAN} > $device->{MAX_VLAN}))
		{ $parent->{MAX_VLAN} = $device->{MAX_VLAN}; }
	$self->{OBJ} = $device;

	# someday soon.
	# %$self = ( %$device );
	# bless($self, ref($device));
    }
}


sub DESTROY () { undef ; }

sub AUTOLOAD($@) {
    my ($self, @args) = @_;
    my $method =  our $AUTOLOAD;
    my ($cname,$name) = split "::", $method;
    my $proc;
    if ($jitdev_dumper) { print "Trapping $method \n" ; }
    if ($name =~ /(\w*)_start$/) {
	$proc = $1;
	return $self->startChildCall($proc, @args);
    } 
    if ($name =~ /(\w*)_reap$/) {
	$proc = $1;
	return reapCall($proc);
    }
    $proc = $name;
    $self->startChildCall($proc, @args);
    my %result = reapCall($proc);
    my @rlist =  @{$result{$self->{NAME}}};
    if (wantarray()) { return @rlist; }
    else {return $rlist[0];}
}

# Everything below here is for multithreading stack calls;

use Socket;
use Fcntl;

#for now only allow one outstanding proc per dev;

my %cur_procs;
my %cur_callids;
my %cur_results;
my %fh_to_rpc;
my $mux;
my $fake_callid = 0;

sub URL_connect_fork() {
    my ($parentSock, $childSock);
    {
	local $^F = 1024; # avoid close-on-exec flag being set
	socketpair($parentSock, $childSock, AF_UNIX, SOCK_STREAM, PF_UNSPEC);
    }
    my $client_pid = fork;
    if ($client_pid == 0) { # child process
	close $parentSock;
	snmpit_stack_child::child_loop($childSock);
	exit(0);
    }
    close $childSock;
    return $parentSock;
}

sub rpcCallback(@) {
    my ($devname, $proc, @result) = @_;
    if ($snmpit_stack_child::child_debug && $jitdev_dumper) 
    {
	print "rpcCallback($devname, $proc)\n";
	# my $wrap = [ @_ ];
	# $jitdev_dumper->dumpValue($wrap);
    }
    my $oproc = $cur_procs{$devname};
    if (!defined($oproc)) { return ;}
    if ($oproc ne $proc) {
	print "rpcCallback($devname) overwriting $oproc by $proc\n";
    }
    @{$cur_results{$devname}} = @result;
    delete $cur_callids{$devname};
}

sub startChildCall($$;@) {
    my ($self, $proc, @args) = @_;
    my $devname = $self->{NAME};
    $self->debug("$devname -> startChildCall($proc)\n");
    if (!defined($cur_procs{$devname})) {
       $cur_procs{$devname} = $proc;
    } else {
	print "$devname ->startChildCall($proc) already calling "
		. $cur_procs{$devname} . "\n";
	return undef;
    }
    if (!$snmpit_stack::parallelized) {
	my $this_callid = $cur_callids{$devname} = ++$fake_callid;
	my @arglist = ($this_callid, $devname, $proc, @args);
	rpcCallback(snmpit_stack_child::rpc_call_wrapper(@arglist));
	return $this_callid;
    }
    my $rpc = $self->{ARPC}->{RPC};
    $cur_callids{$devname} =
	$rpc->call_wrapper($devname, $proc, @args, \&rpcCallback);
}

my ($CL_CALLED, $CL_WAITING, $CL_RESULTS) = (0, 1, 2);

sub callLists($$) {
    my ($op, $proc) = @_;
    my @result;
    while ( my ($devname, $procname) = each %cur_procs) {
	next if $procname ne $proc;
	my $id = $cur_callids{$devname};
	next if ($op == $CL_WAITING && !defined($id));
	push @result, $devname;
	push @result, $cur_results{$devname} if ($op == $CL_RESULTS);
    }
    return @result;
}

sub reapCall($) {
    my ($proc) = @_;
    while (scalar(callLists($CL_WAITING, $proc))) {
	my $event = $mux->mux or next;
	my $rpc = $fh_to_rpc{$event->{fh}};
	$rpc->io($event);
    }
    my @callers = callLists($CL_CALLED, $proc);
    my @result = callLists($CL_RESULTS, $proc);
    foreach my $devname (@callers) {
	delete $cur_procs{$devname};
	delete $cur_results{$devname};
    }
    return @result;
}

sub spawn($){
    my $self = shift;
    my $name = $snmpit_stack_child::child_name = $self->{NAME};

    require IO::EventMux;
    require RPC::Async::Client;

    $self->debug("spawning $name\n");
    $mux = IO::EventMux->new if (!defined($mux));
    my $arpc = $self->{ARPC} = {};
    my $fh = $arpc->{FH} = URL_connect_fork();  # forks() !
    # $mux->add($fh); needed for ARPCv2
    my $rpc = $arpc->{RPC} = RPC::Async::Client->new($mux, $fh);
    $fh_to_rpc{$fh} = $rpc;
}

package snmpit_stack_child;

use strict 'refs';

my ($rpc, $owndev);
our ($child_debug, $child_name) = (0, "");

#
# This performs the loop waiting for requests and serving them
# gets passed the fd on which to listen.
#

sub child_loop($) {
    my ($sock) = @_;
    require IO::EventMux;
    require RPC::Async::Server;

    pdebug("starting child loop for $child_name\n");
    my $mux = IO::EventMux->new;
    # $mux->add($sock); needed for ARPCv2
    $rpc = RPC::Async::Server->new($mux, 'snmpit_stack_child::');
    $rpc->add_client($sock);
    while ($rpc->has_clients()) {
	my $event = $rpc->io($mux->mux) or next;
	pdebug("child loop after rpc->io()\n");
    }
    pdebug("Child($child_name)::child_loop after no more has_clients\n");
    exit(0);
}

#  XXXXXXXXXX CHANGE WHEN jitdev blesses objects into different package!!!!!!!!!

sub device_setup(@) {
    my ($devname) = @_;
    my $result;
    if ($owndev = $snmpit_stack::devices{$devname}) {
	snmpit_jitdev::snap($owndev);
    } else {
	print "snmpit_stack_child::setup couldn't find $devname\n";
    }
    $result = $owndev->{OBJ} ? "OK" : "device setup failed";
    pdebug("device_setup($devname) returns $result\n");
    return($result);
}

sub setPortVlan(@) {
    my $result = { errors => $owndev->{OBJ}->setPortVlan(@_)};
    if ($owndev->{OBJ}->{DISPLACED_VLANS}) {
	$result->{DISPLACED_VLANS} = [@{$owndev->{OBJ}->{DISPLACED_VLANS}}];
	$owndev->{OBJ}->{DISPLACED_VLANS} = undef;
    }
    return $result;
}

sub metaMakeVlan(@) {
    my ($vlan_id, $vlan_num, $already, $planp) = @_;
    my ($name, $errors, $error) = ($owndev->{NAME}, 0);

    if (!$already && !$owndev->{OBJ}->createVlan($vlan_id, $vlan_num)) {
	print "Error creating $vlan_id on $name\n ";
	return { errors => 1, vlan => $vlan_id};
    }
    #
    # Some devices require setting speeds before duplex, hence the sort.
    # When setting trunking the device may forget which vlan it belongs to
    # so we will do the port control first, since $dev->enablePortTrunking2
    # will put the port into the vlan for dual trunks and we would have
    # to do over again for equal trunks.  The only problem with this
    # strategy is if there are ever devices that refuse to set speed
    # and duplex while the port is disabled.
    #
    foreach my $port (keys %$planp) {
	my $pcmds = $planp->{$port};
	next unless ($pcmds);
	foreach my $cmd (sort @$pcmds) {
	    if ($cmd eq 'trunkdual') {
		$error = ! $owndev->{OBJ}->enablePortTrunking2
				($port, $vlan_num, 0);
		delete $planp->{$port};
	    } elsif ($cmd eq 'trunkequal') {
		$error = ! $owndev->{OBJ}->enablePortTrunking2
				($port, $vlan_num, 1);
	    } else {
		$error = $owndev->{OBJ}->portControl($cmd, $port);
	    }
	    if ($error) {
		print "metaVlan:$cmd failed for $port in $vlan_id on $name\n";
		$errors += $error;
	    }
	}
    }
    my $result = setPortVlan($vlan_num, keys %$planp);
    $result->{vlan} = $vlan_id;
    if ($result->{errors}) {
	print "Error populating $vlan_id on $name\n ";
    }
    $result->{errors} += $errors;
    return $result;
}

sub metaOpenFlow(@) {
    my ($worker,@args)= @_;
    if (!$owndev->{OBJ}->isOpenFlowSupported()) {
	#
	# TODO: Should this be an error?
	#
	warn "ERROR: Openflow is not supported on $owndev->{NAME} \n";
	return undef;
    }
    return $owndev->{OBJ}->$worker(@args);
}


# make this one work on a list of ports to parallelize snmpit -r
# to not make it block by device when there are many ports to untrunk.
sub disablePortTrunking(@){
    my @ports = @_;
    my @success = map {$owndev->{OBJ}->disablePortTrunking($_)} @ports;
    return (0 == scalar(grep {!$_} @success));
}

my %special_funcs = (
    metaMakeVlan => \&metaMakeVlan,
    metaOpenFlow => \&metaOpenFlow,
    metaSequence => \&metaSequence,
    disablePortTrunking => \&disablePortTrunking,
    device_setup => \&device_setup 
);

sub metaSequence(@)
{
    my @result;

    while (@_) {
	my $proc = shift;
	my $args = shift;
	my $special = $special_funcs{$proc};

	push @result, $proc,
	    [ $special ? $special->(@$args) : $owndev->{OBJ}->$proc(@$args) ];
    }
    return @result;
}

sub rpc_call_wrapper(@) {
    my ($called_id, $devname, $proc, @args) = @_;
    my @result;
    pdebug("Child($devname)::wrapping $proc\n");
    $owndev = $snmpit_stack::devices{$devname};
    if (!defined($owndev)) {
	@result = ("call_wrapper couldn't find device object for $devname");
    } elsif (my $special = $special_funcs{$proc}) {
	@result = $special->(@args);
    } else {
	@result = $owndev->{OBJ}->$proc(@args);
    }
    if ($snmpit_stack::parallelized) {
	$rpc->return($called_id, $devname, $proc, @result);
    } else {
	return($devname, $proc, @result);
    }
}

sub pdebug(@) { print "@_" if ($child_debug); }

# End with true
1;
