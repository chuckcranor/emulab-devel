#!/usr/bin/perl -w

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

#
# Power module for Enlogic Edge series power controllers
#
# supports new(ip), power(on|off|cyc[le],port), status
#

package power_enlogic;

$| = 1; # Turn off line buffering on output

use SNMP;
use strict;

#
# XXX for configurations in which the unit always returns error
# even when it works. This is from the APC module and we have never seen
# a failure here, but keep the variable just in case.
#
my $ignore_errors = 0;

#
# No need to read the MIBs more than once
#
my $gotmibs = 0;

sub new($$;$$) {

    # The next two lines are some voodoo taken from perltoot(1)
    my $proto = shift;
    my $class = ref($proto) || $proto;

    my $devicename = shift;
    my $debug = shift;
    my $timo = shift;

    if (!defined($debug)) {
	$debug = 0;
    }

    if ($debug) {
	print "$devicename: power_enlogic module initializing... debug level $debug\n";
    }

    if (!$gotmibs) {
	print "Fetching MIBs...\n" if $debug;
	$SNMP::debugging = ($debug - 5) if $debug > 5;
	my $mibpath = "/usr/local/share/snmp/mibs";
	&SNMP::addMibDirs($mibpath);
	# downloaded from Enlogic
	# https://www.enlogic.com/public/assets/images/1594135821-Enlogic_Edge_Mib_v1.1.mib
	# XXX mike hacked to fix broken date strings
	&SNMP::addMibFiles("$mibpath/Enlogic_Edge_Mib_v1.1.txt");
	SNMP::initMib();              # parses default list of Mib modules
	$SNMP::use_enums = 1;         # use enum values instead of only ints
	$gotmibs = 1;
    }
    print "Opening SNMP session to $devicename...\n" if $debug;
    my $sess;
    if ($timo) {
	print "Setting timeout to $timo seconds...\n" if $debug;
	# SNMP timeout is in microseconds
	$timo *= 1000000;
	$sess = new SNMP::Session(DestHost => $devicename,
				  Community => 'private',
				  Timeout => $timo,
				  Version => '2c');
    } else {
	$sess = new SNMP::Session(DestHost => $devicename,
				  Community => 'private',
				  Version => '2c');
    }
    if (!defined($sess)) {
	warn("ERROR: Unable to connect to $devicename via SNMP\n");
	return undef;
    }

    my $self = {};

    $self->{SESS} = $sess;
    $self->{DEBUG} = $debug;
    $self->{DEVICENAME} = $devicename;

    #
    # Both test SNMP to the device and make sure it meets the criteria
    # we support:
    #  - not more than one PDU in the chain
    # and get the number of phases and outlets.
    #
    my $rv = $sess->get("pduNumberPDU.0");
    if (!defined $rv) {
	warn("ERROR: cannot talk to $devicename via SNMP\n");
	return undef;
    }
    if ($rv > 1) {
	warn("WARNING: $rv PDUs in chain, only handle one right now.\n");
	$rv = 1;
    }
    $self->{CPDUS} = $rv;
    $rv = $sess->get("pduInputPhaseCount.1");
    if (!defined $rv || ($rv != 1 && $rv != 4)) {
	warn("WARNING: bogus phases value '$rv', assuming one.\n");
	$rv = 1;
    }
    $self->{PHASES} = $rv;
    $rv = $sess->get("pduOutletCount.1");
    if (!defined $rv || ($rv < 1 || $rv > 48)) {
	warn("WARNING: bogus outlets value '$rv', assuming 8.\n");
	$rv = 8;
    }
    $self->{OUTLETS} = $rv;
    print "$self->{DEVICENAME}: $self->{PHASES} phase, $self->{OUTLETS} outlets\n"
	if $debug;

    bless($self,$class);
    return $self;
}

my %CtlOIDS = (
    default => ["pduOutletControlCommand",
		"immediateOn", "immediateOff", "immediateReboot"]
);

sub power {
    my $self = shift;
    my $op = shift;
    my @ports = @_;
    my $oids = $CtlOIDS{"default"};
    my $iscycle = 0;

    if    ($op eq "on")  { $op = @$oids[1]; }
    elsif ($op eq "off") { $op = @$oids[2]; }
    elsif ($op =~ /cyc/) { $op = @$oids[3]; $iscycle = 1; }

    my $errors = 0;

    # XXX PDU in chain is always one for now
    my $cpdu = 1;

    foreach my $port (@ports) {
	if ($port < 1 || $port > $self->{OUTLETS}) {
	    print STDERR "$self->{DEVICENAME}: WARNING: bogus port $port ignored...\n";
	}
	print STDERR "**** Controlling outlet $port\n" if ($self->{DEBUG});

	#
	# XXX Using pduOutletControlCommand with immediateReboot always
	# powers on the outlet immediately after the power off, without
	# delaying for the documented pduOutletControlRebootOffTime seconds.
	#
	# XXX Using pduOutletControlRebootCmd does the same.
	#
	# XXX Using pduOutletControlCommand with delayedReboot results in
	# no power off at all.
	#
	# XXX Using pduOutletControlCommand with immediateOff, followed by
	# a pduOutletControlOnCmd with an explicit delay specified, still
	# causes an immediate power on.
	#
	# The only choice left is to turn it off, explicitly wait the time
	# ourselves with sleep, and then immediately power on. This is going
	# to make for a very slow power command if rebooting multiple ports!
	#
	if ($iscycle) {
	    # do an immediate off command
	    if ($self->UpdateField(@$oids[0],$cpdu,$port,@$oids[2]) == 0) {
		# read how long to delay before power on
		my $delay = $self->{SESS}->get("pduOutletControlRebootOffTime.$cpdu.$port");
		if ($delay && $delay > 0) {
		    sleep($delay > 10 ? 10 : $delay);
		}
		if ($self->UpdateField(@$oids[0],$cpdu,$port,@$oids[1]) != 0) {
		    print STDERR "Outlet $port control (reboot on) failed.\n";
		    $errors++;
		}
	    } else {
		print STDERR "Outlet $port control (reboot off) failed.\n";
		$errors++;
	    }
	}
	elsif ($self->UpdateField(@$oids[0],$cpdu,$port,$op)) {
	    print STDERR "Outlet $port control failed.\n";
	    $errors++;
	}
    }

    return $errors;
}

#
# Right now we return outlet status, current, power and energy.
#
sub status {
    my $self = shift;
    my $statusp = shift;
    my %status;
    my $Status = 0;

    # XXX PDU in chain is always one for now
    my $cpdu = "1";

    print "$self->{DEVICENAME}: getting status\n" if $self->{DEBUG};

    # XXX ugh, need to make one call per outlet to get status
    foreach my $port (1..$self->{OUTLETS}) {
	$Status = $self->{SESS}->get("pduOutletControlStatus.$cpdu.$port");
	if (!defined $Status) {
	    print STDERR $self->{DEVICENAME}, ": no answer from device\n";
	    return 1;
	}
	$status{"outlet$port"} = $Status;
	print "Outlet $port is '$Status'\n" if $self->{DEBUG} > 1;
    }

    if ($statusp) {
	%$statusp = %status;
    }

    # Find current power and current usage
    $Status = $self->{SESS}->get("pduInputPowerWatts.$cpdu");
    if (defined($Status) && $Status >= 0) {
	$status{power} = $Status;
	print "Power: $status{power} Watts\n" if $self->{DEBUG} > 1;
    }
    $Status = $self->{SESS}->get("pduInputTotalCurrent.$cpdu");
    if (defined($Status) && $Status >= 0) {
	$status{current} = sprintf "%.2f", int($Status)/100;
	print "Current: $status{current} Amps\n" if $self->{DEBUG} > 1;
    }

    # Find energy use since last reset of counter
    $Status = $self->{SESS}->get("pduInputResettableEnergy.$cpdu");
    if (defined($Status) && $Status >= 0) {
	$status{energy} = sprintf "%.3f", int($Status)/1000;
	print "Energy = $status{energy} KW hours\n" if $self->{DEBUG} > 1;
    }

    if ($statusp) {
       %$statusp = %status;
    }
    return 0;
}

sub UpdateField {
    my ($self,$OID,$cpdu,$port,$val) = @_;
    my $Status = 0;
    my $retval;

    if ($self->{DEBUG} > 1) {
	my $noid = SNMP::translateObj($OID);
	print "$self->{DEVICENAME}: sess=$self->{SESS} $OID ($noid) $port $val\n";
    }

    print "Checking port $port of $self->{DEVICENAME} for $val..." if $self->{DEBUG};
    $Status = $self->{SESS}->get("$OID.$cpdu.$port");
    if (!defined $Status) {
	print STDERR "Port $port, change to $val: No answer from device\n";
	return 1;
    } else {
	print "Okay.\nPort $port was '$Status'\n" if $self->{DEBUG};
	if ($Status ne $val) {
	    print "Setting $port to $val..." if $self->{DEBUG};
	    $retval = $self->{SESS}->set("$OID.$cpdu.$port", $val);
	    $retval = "" if (!defined($retval));
	    print "Set returned '$retval'\n" if $self->{DEBUG};
	    if ($retval) {
		return 0;
	    }
	    # XXX warn, but otherwise ignore errors
	    if ($ignore_errors) {
		print STDERR "WARNING: $port '$val' failed, ignoring\n";
		return 0;
	    }
	    return 1;
	}
	return 0;
    }
}

#
# RANDOM NOTES about MIBS from early testing.
#
# Enlogic prefix is ".1.3.6.1.4.1.38446"
# "pduNumberPDU" (number of PDUs in chain, max 4) is "<prefix>.4.1.1.1"
# "pduIdentTable" (one entry for PDU in chain) is ".4.1.1.2"
# "pduIdentTable[0] (first entry in chain) is ".4.1.1.2.1"
# "pduOutletCount" (outlets on PDU) is ".4.1.1.2.C.13"
#
# "pduInputTable" (one per PDU on chain) is ".4.1.2.1.C"
#   For PDU chain unit C:
#     ".4.1.2.1.C.6.1" total energy in KWh (<0 means not available)
#     ".4.1.2.1.C.7.1" date/time of last resettable total reset (<0 NA)
#     ".4.1.2.1.C.8.1" resettable total energy in Wh (<0 NA)
#
# "pduInputPhaseTable" (PDU x phase, max 3 phase) is ".4.1.2.2.C.e.1.P"
#   For first PDU, single phase:
#     ".4.1.2.2.1.3.1.1" input voltage in 0.1 V
#     ".4.1.2.2.1.11.1.1" input current in 0.01 A
#
# "pduOutletTable" (one per PDU x PDU outlets, 48 max) is ".4.1.5.1"
#   For outlet N:
#    ".4.1.5.1.1.1.1.N" index
#    ".4.1.5.1.1.2.1.N" name
#    ".4.1.5.1.1.3.1.N" type
#    ...
# "pduOutletControlTable" (PDU x PDU outlets, 48 max) is ".4.1.5.2"
#   For outlet N:
#    ".4.1.5.2.1.1.1.N" status (1==off, 2==on, 3==pendoff, 4==pendon)
#    ".4.1.5.2.1.2.1.N" turn off
#                       (read:  -1==no cmd pend, >=0==time left til cmd)
#                       (write: -1==cancel pend, >=0==time til cmd)
#    ".4.1.5.2.1.3.1.N" turn on
#                       (read:  -1==no cmd pend, >=0==time left til cmd)
#                       (write: -1==cancel pend, >=0==time til cmd)
#    ".4.1.5.2.1.4.1.N" cycle
#                       (read:  -1==no cmd pend, >=0==time left til cmd)
#                       (write: -1==cancel pend, >=0==time til cmd)
# "pduOutletControlCommand (PDU x PDU outlets) is ".4.1.5.2.1.10.1.N"
#    for outlet N. read: 1==off, 2==on; write: 1=off, 2==on, 5==reboot
#    

# End with true
1;
