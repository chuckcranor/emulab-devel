#!/usr/bin/perl -w

#
# Copyright (c) 2013 University of Utah and the Flux Group.
# Copyright (c) 2006-2013 Universiteit Gent.
# Copyright (c) 2004-2006 Regents, University of California.
# 
# {{{EMULAB-LGPL
# 
# This file is part of the Emulab network testbed software.
# 
# This file is free software; you can redistribute it and/or modify it
# under the terms of the GNU Lesser General Public License as published by
# the Free Software Foundation; either version 2.1 of the License, or (at
# your option) any later version.
# 
# This file is distributed in the hope that it will be useful, but WITHOUT
# ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
# FITNESS FOR A PARTICULAR PURPOSE.  See the GNU Lesser General Public
# License for more details.
# 
# You should have received a copy of the GNU Lesser General Public License
# along with this file.  If not, see <http://www.gnu.org/licenses/>.
# 
# }}}
#

# TODO:
# Currently this module does not support setting due to lacking MIB support.
# - portDuplex
# - portAdminSpeed
# - set/get autoneg

#
# snmpit module for Force10 switches
#

package snmpit_force10;
use strict;
use Data::Dumper;

$| = 1; # Turn off line buffering on output

use English;
use SNMP;
use snmpit_lib;
use Port;

#
# These are the commands that can be passed to the portControl function
# below
#
my %cmdOIDs =
(
	"enable"  => ["ifAdminStatus","up"],
	"disable" => ["ifAdminStatus","down"],
	#"1000mbit"=> ["portAdminSpeed","s1000000000"], # commented out = not supported by FTOS-EF-7.4.2.3
	#"100mbit" => ["portAdminSpeed","s100000000"],  #
	#"10mbit"  => ["portAdminSpeed","s10000000"],   #
	#"full"    => ["portDuplex","full"],            #
	#"half"    => ["portDuplex","half"],            #
	#"auto"    => ["portAdminSpeed","autoDetect",   #
	#              "portDuplex","auto"]
);

#
# Force10 Chassis configuration info
#
my $ChassisInfo = {
    "force10c300" => {
        "moduleSlots"           => 8,   # Max # of modules in chassis
        "maxPortsPerModule"     => 48,  # Max # of ports in any module
        "bitmaskBitsPerModule"  => 224, # Number of bits per module
    },
    "force10e1200" => {
        "moduleSlots"           => 14,  # Max # of modules in chassis
        "maxPortsPerModule"     => 48,  # Max # of ports in any module
        "bitmaskBitsPerModule"  => 96,  # Number of bits per module
    },
    "force10s55" => {
        "moduleSlots"           => 1,   # Max # of modules in chassis
        "maxPortsPerModule"     => 64,  # Max # of ports in any module
        "bitmaskBitsPerModule"  => 768, # Number of bits per module
    },
};

# XXX - The static offset approach appears to be unrealiable, so we look up
# the ifindex using the "ifDescr" table.  Each vlan has an "interface" listed
# there.
#
# Force10 calculates ifIndex for VLANs as 0b10_0001_0000001_1110_00000000000000 + 802.1Q VLAN tag number
#
#my $vlanNumberToIfindexOffset = 1107787776;

#
# Force10 FTOS-EF-7.4.2.3 cannot set purely numeric administrative VLAN names (dot1qVlanStaticName) (by design...)
# So we prepend some alphabetical characters when setting, end strip them when getting
#
my $vlanStaticNamePrefix = "emuID";

#
# Ports can be passed around in three formats:
# ifindex : positive integer corresponding to the interface index
#           (eg. 311476282 for gi 8/35)
# modport : dotted module.port format, following the physical reality of
#           Force10 switches (eg. 5/42)
# nodeport: node:port pair, referring to the node that the switch port is
# 	        connected to (eg. "pc42:1")
#
# See the function convertPortFormat below for conversions between these
# formats
#
my $PORT_FORMAT_IFINDEX  = 1;
my $PORT_FORMAT_MODPORT  = 2;
my $PORT_FORMAT_PORT     = 3;

#
# Creates a new object.
#
# usage: new($classname,$devicename,$debuglevel,$community)
#        returns a new object, blessed into the snmpit_force10 class.
#
sub new($$$;$) {

    # The next two lines are some voodoo taken from perltoot(1)
    my $proto = shift;
    my $class = ref($proto) || $proto;

    my $name = shift;                       # the name of the switch, e.g. e1200a
    my $debugLevel = shift;
    my $community = shift;

    #
    # Create the actual object
    #
    my $self = {};

    #
    # Set the defaults for this object
    # 
    if (defined($debugLevel)) {
		$self->{DEBUG} = $debugLevel;
    } else {
		$self->{DEBUG} = 0;
    }
    $self->{BLOCK} = 1;
    $self->{CONFIRM} = 1;
    $self->{NAME} = $name;

    #
    # Get config options from the database
    #
    my $options = getDeviceOptions($self->{NAME});
    if (!$options) {
		warn "ERROR: Getting switch options for $self->{NAME}\n";
		return undef;
    }

    $self->{MIN_VLAN}         = $options->{'min_vlan'};
    $self->{MAX_VLAN}         = $options->{'max_vlan'};

    if ($community) { # Allow this to over-ride the default
		$self->{COMMUNITY}    = $community;
    } else {
		$self->{COMMUNITY}    = $options->{'snmp_community'};
    }

    #
    # Get devicetype from database
    #
    my $devicetype = getDeviceType($self->{NAME});
    $self->{TYPE}=$devicetype;

    #
    # set up hashes for pending vlans
    #
    $self->{IFINDEX} = {};     # Used for converting modport to ifIndex (somtimes called iid; e.g. 345555002) and vice versa
    $self->{PORTINDEX} = {};   # Will contain elements for experimental "interfaces" only (no VLANs, no Mgmgnt ifaces); format: ifIndex => ifDescr

    if ($self->{DEBUG}) {
		print "snmpit_force10 module initializing... debug level $self->{DEBUG}\n";
    }


    #
    # Set up SNMP module variables, and connect to the device
    #
    $SNMP::debugging = ($self->{DEBUG} - 2) if $self->{DEBUG} > 2;
    my $mibpath = '/usr/local/share/snmp/mibs';
    &SNMP::addMibDirs($mibpath);
    &SNMP::addMibFiles("$mibpath/SNMPv2-SMI.txt", "$mibpath/SNMPv2-TC.txt", 
	               "$mibpath/SNMPv2-MIB.txt", "$mibpath/IANAifType-MIB.txt",
		       "$mibpath/IF-MIB.txt",
		       "$mibpath/SNMP-FRAMEWORK-MIB.txt",
		       "$mibpath/SNMPv2-CONF.txt",
		       "$mibpath/BRIDGE-MIB.txt",
		       "$mibpath/P-BRIDGE-MIB.txt",
		       "$mibpath/Q-BRIDGE-MIB.txt",
		       "$mibpath/EtherLike-MIB.txt");
    $SNMP::save_descriptions = 1; # must be set prior to mib initialization
    SNMP::initMib();		  # parses default list of Mib modules 
    $SNMP::use_enums = 1;	  # use enum values instead of only ints

    warn ("Opening SNMP session to $self->{NAME}...") if ($self->{DEBUG});

    $self->{SESS} = new SNMP::Session(DestHost => $self->{NAME},Version => '2c',
				      Timeout => 4000000, Retries=> 12,
				      Community => $self->{COMMUNITY});

    if (!$self->{SESS}) {
	#
	# Bomb out if the session could not be established
	#
		warn "WARNING: Unable to connect via SNMP to $self->{NAME}\n";
		return undef;
    }

    #
    # Connecting an SNMP session doesn't necessarily mean you can actually get
    # packets to and from the switch. Test that by grabbing an OID that should
    # be on every switch. Let it retry a bunch, to hide transient failures
    #

    my $OS_details = snmpitGetFatal($self->{SESS},["sysDescr",0],30);
    print "Switch $self->{NAME} is running $OS_details\n" if $self->{DEBUG};

    #
    # The bless needs to occur before readifIndex(), since it's a class 
    # method
    #
    bless($self,$class);

    if (!$self->readifIndex()) {
	warn "WARNING: Unable to process ifindex table on $self->{NAME}\n";
	return undef;
    }
    
    return $self;
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


#
# Reads the IfIndex table from the switch, for SNMP functions that use 
# IfIndex rather than the module.port style. Fills out the objects IFINDEX
# and PORTINDEX members
#
# usage: readifIndex(self)
#        returns nothing but sets instance variable IFINDEX
#
sub readifIndex($) {
    my $self = shift;
    $self->debug("readifIndex:\n",2);
        
    my ($rows) = snmpitBulkwalkFatal($self->{SESS},["ifDescr"]);
    
    if (!$rows || !@{$rows}) {
	warn "readifIndex: ERROR: No interface description rows returned ".
	    "while attempting to build ifindex table.\n";
	return 0;
    }

    foreach my $result (@{$rows}) {
	my ($name,$iid,$descr) = @{$result};
	$self->debug("got $name, $iid, descr $descr ",2);
	if ($name ne "ifDescr") {
	    warn "readifIndex: WARNING: Foreign snmp var returned: $name";
	    return 0;
	}
	
	# will match "GigabitEthernet 9/47" but not "Vlan 123"
	if ($descr =~ /(\w*)\s+(\d+)\/(\d+)$/) {
	    my $type = $1;
	    my $module = $2;
	    my $port = $3;
	    # Force10 modules and ports start at 0 instead of 1.  Emulab
	    # convention is to be 1-based.
	    my $modport = "${module}.${port}";
	    my $ifIndex = $iid;
	    
	    # exclude e.g. ManagementEthernet ports
	    if ( $descr !~ /management/i) {
		$self->{IFINDEX}{$modport} = $ifIndex;
		$self->{IFINDEX}{$ifIndex} = $modport;
		$self->{PORTINDEX}{$ifIndex} = $descr;
		$self->debug("mod $module, port $port, modport $modport, descr $descr\n",2);
	    }
	}
    }

    # success
    return 1;
}


#
# Convert a set of ports to an alternate format. The input format is detected
# automatically. See the declarations of the constants at the top of this
# file for a description of the different port formats.
#
# usage: convertPortFormat($self, $output format, @ports)
#        returns a list of ports in the specified output format
#        returns undef if the output format is unknown
#
# TODO: Add debugging output, better comments, more sanity checking
#
sub convertPortFormat($$@) {
    my $self = shift;
    my $output = shift;
    my @ports = @_;

    #
    # Avoid warnings by exiting if no ports given
    # 
    if (!@ports) {
		return ();
    }

    #
    # We determine the type by sampling the first port given
    #
    my $sample = $ports[0];
    if (!defined($sample)) {
		warn "convertPortFormat: Given a bad list of ports\n";
		return undef;
    }

    my $input;
    SWITCH: for ($sample) {
	(Port->isPort($_)) && do { $input = $PORT_FORMAT_PORT; last; };
	(/^\d+$/) && do { $input = $PORT_FORMAT_IFINDEX; last; };
	(/^\d+\.\d+$/) && do { $input = $PORT_FORMAT_MODPORT; last; };
	warn "convertPortFormat: Unrecognized input sample: $sample\n";
	return undef;
    }

    #
    # It's possible the ports are already in the right format
    #
    if ($input == $output) {
	$self->debug("Not converting, input format = output format\n",2);
	return @ports;
    }

    if ($input == $PORT_FORMAT_IFINDEX) {
	if ($output == $PORT_FORMAT_MODPORT) {
	    $self->debug("Converting ifindex to modport\n",2);
	    return map $self->{IFINDEX}{$_}, @ports;
	} elsif ($output == $PORT_FORMAT_PORT) {
	    $self->debug("Converting ifindex to Port\n",2);
	    return map {Port->LookupByStringForced(
			    Port->Tokens2TripleString(
				$self->{NAME},
				split(/\./,$self->{IFINDEX}{$_})))} @ports;
	}
    } elsif ($input == $PORT_FORMAT_MODPORT) {
	if ($output == $PORT_FORMAT_IFINDEX) {
	    $self->debug("Converting modport to ifindex\n",2);
	    return map $self->{IFINDEX}{$_}, @ports;
	} elsif ($output == $PORT_FORMAT_PORT) {
	    $self->debug("Converting modport to Port\n",2);
	    return map {Port->LookupByStringForced(
			    Port->Tokens2TripleString(
				$self->{NAME},
				split(/\./,$_)))} @ports;
	}
    } elsif ($input == $PORT_FORMAT_PORT) {
	my @swports = map $_->getEndByNode($self->{NAME}), @ports;
	if ($output == $PORT_FORMAT_IFINDEX) {
	    $self->debug("Converting Port to ifindex\n",2);
	    return map $self->{IFINDEX}{$_->card() .".". $_->port()}, @swports;
	} elsif ($output == $PORT_FORMAT_MODPORT) {
	    $self->debug("Converting Port to modport\n",2);
	    return map $_->card() .".". $_->port(), @swports;
	}
    }

    #
    # Some combination we don't know how to handle
    #
    warn "convertPortFormat: Bad input/output combination ($input/$output)\n";
    return undef;
}

# Utility functions for handling vlan name prefix needed on the Force10
sub stripVlanPrefix($) {
    my $vlname = shift;

    if ($vlname =~ /^$vlanStaticNamePrefix(\d+)$/) {
	return $1;
    } else {
	return $vlname;
    }
}

sub addVlanPrefix($) {
    my $vlname = shift;
    
    return $vlanStaticNamePrefix.$vlname;
}


# Utility function for looking up ifindex for a vlan
sub getVlanIfindex($$) {
    my ($self, $vlan_number) = @_;

    my %results = ();
    my ($rows) = snmpitBulkwalkFatal($self->{SESS},["ifDescr"]);
    
    if (!$rows || !@{$rows}) {
	warn "getVlanIfindex: ERROR: No interface description rows returned.";
	return undef;
    }

    foreach my $result (@{$rows}) {
	my ($name,$iid,$descr) = @{$result};

	next unless $descr =~ /vlan\s+(\d+)/i;
	my $curvlnum = $1;

	$self->debug("getVlanIfindex: got $name, $iid, descr $descr\n",2);

	if ($vlan_number eq "ALL") {
	    $results{$curvlnum} = $iid;
	}
	elsif ($curvlnum == $vlan_number) {
	    return $iid;
	}
    }

    if ($vlan_number eq "ALL") {
	return %results;
    }

    # Not found.
    return undef;
}

# Utility function that grabs the port membership bitmask for a vlan.
# usage: getMemberBitmask($self, $vlan_ifindex)
# returns: bitmask as returned from switch via snmp (packed vector), 
#          or undef on failure.
sub getMemberBitmask($$) {
    my ($self, $vlidx) = @_;

    my $bitmask = $self->{SESS}->get(["dot1qVlanStaticEgressPorts",
				      $vlidx]);
    if (!$bitmask) {
	warn "getMemberBitmask: Error getting current membership bitmask for vlan with ifindex $vlidx\n";
	return undef;
    }

    return $bitmask;
}

# Utility function to punch in the egress and untagged port memeberships
# for the given vlan number (tag).  $onoff tells the function how to check
# the resulting membership list ("on" - add; "off" - remove).
# Returns the number of ports that failed to be (un)set.
sub setPortMembership($$$$$) {
        my ($self, $onoff, $eportmask, $uportmask, $vlifindex) = @_;

	# Grab the number of bits set in the untagged port mask.
	my $setcount = unpack("%32b*", $uportmask);

	# The egress ports and untagged ports have to be updated
	# simultaneously.
	my $status = $self->{SESS}->set([
	        ["dot1qVlanStaticEgressPorts", $vlifindex, 
			$eportmask, "OCTETSTR"], 
		["dot1qVlanStaticUntaggedPorts", $vlifindex, 
			$uportmask, "OCTETSTR"]
		]);

	# XXX: Look into why/when this happens ...
	# $status should contain "0 but true" if successful, but...
	# occasionally it is undefined (indicating failure) even when
	# the operation succeeds. So, the return value cannot be
	# trusted and we do our own little investigation. 
	if (!defined($status)) {
	    $self->debug("setPortMembership: Error setting port membership: $self->{SESS}->{ErrorStr}\n");
	}

	# Get the current membership bitmask for this vlan
	my $newmask = $self->getMemberBitmask($vlifindex);
	if (!defined($newmask)) {
		warn "setPortMembership: Error getting current ".
		     "membership bitmask for vlan with ifindex $vlifindex\n";
		return $setcount;
	}
	
	# Should return 0 if everything is alright, no. of failed
	# ports otherwise
	my $checkmask = $onoff eq "on" ? $eportmask : $uportmask;
	my $failcount = $self->checkBits($onoff, $checkmask, 
					 $newmask);

	if ($failcount) {
		warn "setPortMembership: Could not manipulate $failcount ".
		     "ports in vlan with ifindex vlifindex!\n";
	}

	return $failcount; # should be 0
}

#
# List all ports on the device
#
# usage: listPorts($self)
# see snmpit_cisco_stack.pm for a description of return value format
#
#
sub listPorts($) {
    my $self = shift;

    my %Nodeports = ();
    my %Able = ();
    my %Link = ();
    my %speed = ();
    my %duplex = ();

    my ($ifIndex, $status);

    #
    # Get the port configuration, including ifOperStatus (really up or down),
    # duplex, speed / whether or not it is autoconfiguring
    #			
    foreach $ifIndex (keys %{$self->{PORTINDEX}}) {

	#
	# Skip ports that don't seem to have anything interesting attached
	#
	my ($port) = $self->convertPortFormat($PORT_FORMAT_PORT, $ifIndex);
	my $nodeport = $port->getOtherEndPort();
	if (!defined($port) || !defined($nodeport) || 
	    $port->toString() eq $nodeport->toString()) {
	    $self->debug("Port $port not connected, skipping\n");
	    next;
	}
	$Nodeports{$ifIndex} = $nodeport;

	if ($status = snmpitGetWarn($self->{SESS},["ifAdminStatus",
						   $ifIndex])) {
	    $Able{$ifIndex} = ( $status =~ /up/ ? "yes" : "no" );
	}
    	
	if ($status = snmpitGetWarn($self->{SESS},["ifOperStatus",
						   $ifIndex])) {
	    $Link{$ifIndex} = $status;
	}
		
	if ($status = snmpitGetWarn($self->{SESS},["dot3StatsDuplexStatus",
						   $ifIndex])) {
	    $status =~ s/Duplex//;
	    $duplex{$ifIndex} = $status;
	}
	
	if ($status = snmpitGetWarn($self->{SESS},["ifHighSpeed",
						   $ifIndex])) {
	    $speed{$ifIndex} = $status . "Mbps";
	}
    }
    
    #
    # Put all of the data gathered in the loop into a list suitable for
    # returning
    #
    my @rv = ();
    foreach my $ifIndex ( sort keys %Able ) {
	if (! defined ($speed{$ifIndex}) ) { $speed{$ifIndex} = " "; }
	if (! defined ($duplex{$ifIndex}) ) { $duplex{$ifIndex} = "full"; }
	push @rv, [$Nodeports{$ifIndex},$Able{$ifIndex},$Link{$ifIndex},$speed{$ifIndex},$duplex{$ifIndex}];
    }
    return @rv;
}


#
# List all VLANs on the device
#
# usage: listVlans($self)
# see snmpit_cisco_stack.pm for a description of return value format
#
sub listVlans($) {
	my $self = shift;
	$self->debug("\n\nlistVlans:\n",2);
	
	my %Names = ();
	my %Numbers = ();
	my %Members = ();

	# get list of vlan names from dot1qVlanStaticName (Q-BRIDGE-MIB)
	# and save these in %Names with the ifIndexes (iids) as the key
	# (unlike ethernet ports, vlans aren't static, so this is done from
	# scratch each time instead of being stored in a hash by the constructor
	my ($results) = snmpitBulkwalkWarn($self->{SESS}, ["dot1qVlanStaticName"]);

	# $name should always be "dot1qVlanStaticName"
	foreach my $result (@{$results}) {
	    my ($name,$iid,$vlanname) = @{$result};
	    $self->debug("listVlans(): got $name, $iid, name $vlanname\n",2);
	    if ($name ne "dot1qVlanStaticName") {
		warn "listVlans: unexpected oid: $name\n";
		next;
	    }

	    # Must strip the prefix required on the Force10 to get the vlan id
	    # as known by Emulab.
	    $vlanname = stripVlanPrefix($vlanname);
	    $Names{$iid} = $vlanname;
	}
	
	my ($ifIndex, $status);
	
	# get corresponding VLAN numbers
	# (i.e. the "real" vlan tags as known by the switch, called 
	# "cisco-specific" in the snmpit_cisco.pm module;
	# with "vlan id" they mean the vlan name as known in the 
	# database = the administrative name in the switch, not the tag)
	foreach $ifIndex (keys %Names) {
	    if ($status = snmpitGetWarn($self->{SESS},
					["ifDescr",$ifIndex])) {
		if ($status =~ /^Vlan\s(\d+)$/) {
		    $Numbers{$ifIndex} = $1;
		} else {
		    warn "Unable to parse out vlan tag for ifindex $ifIndex\n";
		    return undef;
		}
	    } else {
		warn "Unable to get vlan tag for ifindex $ifIndex\n";
		return undef;
	    }
	}
	
	# get corresponding port bitmaps from dot1qVlanStaticEgressPorts
	# and find out the corresponding port ifIndexes
	foreach $ifIndex (keys %Names) {
	    my $membermask = $self->getMemberBitmask($ifIndex);
	    if (defined($membermask)) {
		my $indexes = $self->convertBitmaskToIfindexes($membermask);
		my @ports = $self->convertPortFormat($PORT_FORMAT_PORT, 
						     @{$indexes});
		$Members{$ifIndex} = \@ports;
	    } else {
		warn "Unable to get port membership for ifindex $ifIndex\n";
		return undef;
	    }
	}
	
	# create array to return to caller
	my @vlanInfo = ();
	foreach $ifIndex (sort {$a <=> $b} keys %Names) {
		push @vlanInfo, [$Names{$ifIndex},$Numbers{$ifIndex},
			$Members{$ifIndex}];
	}
	$self->debug(join("\n",(map {join ",", @$_} @vlanInfo))."\n");
	
	return @vlanInfo;
}

#
# Internal function which converts a bitmask (a binary string) to a list 
# of switch ports (ifIndexes)
#
sub convertBitmaskToIfindexes($$) {
    my $self = shift;
    my $bitmask = shift;

    # Store switch config in local vars for code readability
    my $type                 = $self->{TYPE};
    my $moduleSlots          = $ChassisInfo->{$type}->{moduleSlots};
    my $maxPortsPerModule    = $ChassisInfo->{$type}->{maxPortsPerModule};
    my $bitmaskBitsPerModule = $ChassisInfo->{$type}->{bitmaskBitsPerModule};

    my @ifIndexes;
                                                          
    # start at module 0
    my $mod = 0;                                          
    while ($mod < $moduleSlots) {
        # start at port 0
        my $port = 0;

        # loop over until maxports.  Not usefull to loop over
        # the padding bits, cause some switches use _a lot_ of
        # these bits !!
        while ($port < $maxPortsPerModule) {

            my $offset = 
                # start index for first port of the module
                $mod * $bitmaskBitsPerModule
                # start index for first port of the block of 8
                # ports containing the current port
                + (int($port / 8) * 8)
                # the offset we're actually looking for
                + (7 - ($port % 8));

            if ( vec($bitmask,$offset,1) ) { 
                push @ifIndexes, $self->{IFINDEX}{"${mod}.${port}"};
            }
            $port++;
        }
        $mod++;
    }

    return \@ifIndexes;
}

#
# Internal function which converts a list of switch ports (ifIndexes) to a
# bitmask (a binary string)
#
sub convertIfindexesToBitmask($@) {
    my $self = shift;
    my $ifIndexes = shift;

    # Store switch config in local vars for code readability
    my $type                 = $self->{TYPE};
    my $moduleSlots          = $ChassisInfo->{$type}->{moduleSlots};
    my $maxPortsPerModule    = $ChassisInfo->{$type}->{maxPortsPerModule};
    my $bitmaskBitsPerModule = $ChassisInfo->{$type}->{bitmaskBitsPerModule};

    # initialize ( to avoid perl warnings )
    my $bitmask = 0b0;
    # Overwrite our bitmask with zeroes
    for my $offset (0..($bitmaskBitsPerModule*$moduleSlots+7)) {
        vec($bitmask, $offset, 1) = 0b0;
    }

    # Convert all ifIndexes to modport format and parse modport information
    # to find out vec() offset and set the right bit
    my @modports = $self->convertPortFormat($PORT_FORMAT_MODPORT,@$ifIndexes);

    foreach my $modport (@modports) {
        $modport =~ /(\d+)\.(\d+)/;
        my $mod  = $1;
        my $port = $2;

        if ( $port >= $maxPortsPerModule )
        {
            warn "convertIfindexesToBitmask: Cannot set port larger than maxport";
            next;
        }

        
        my $offset = 
            # start index for first port of the module
            $mod * $bitmaskBitsPerModule
            # start index for first port of the block of 8
            # ports containing the current port
            + (int($port / 8) * 8)
            # the offset we're actually looking for
            + (7 - ($port % 8));

        vec($bitmask, $offset, 1) = 0b1;
    }
    
    # All set!
    return $bitmask;
}

#
# Internal function which compares two bitmasks of equal length
# and returns the number of differing bits
#
# usage: bitmasksDiffer($bitmask1, $bitmask2) 
#
sub bitmasksDiffer($$$) {
	my $self = shift;
	my $bm1 = shift;
	my $bm2 = shift;
	
	my $differingBits = 0;
	my $bm1unp = unpack('B*', $bm1);
	my @bm1unp = split //, $bm1unp; 
	my $bm2unp = unpack('B*', $bm2);
	my @bm2unp = split //, $bm2unp;
	
	if ( $#bm1unp == $#bm2unp ) { # must be of equal length
		for my $i (0 .. $#bm1unp) {
			if ($bm1unp[$i] != $bm2unp[$i]) {
				$self->debug("bitmasksDiffer(): bit with index $i differs!\n");
				$differingBits++;
			}
		}

		return $differingBits;
	}
	else {
		warn "bitmasksDiffer: ERROR: bitmasks to compare have ".
		    "differing length: \$bm1 has last index $#bm1unp ".
		    "and \$bm2 has last index $#bm2unp\n";
		return ( $#bm1unp > $#bm2unp ? $#bm1unp : $#bm2unp);
	}
}

#
# Internal function which checks if all set bits in a bitmask are set or not in
# another one. Both bitmasks must be of equal length.
# 
# Returns 0 if all bits of interest conform, otherwise returns the number of
# non-conforming bits
#
# usage: checkBits($requestedStatus, $bitsOfInterest, $bitmaskToInvestigate)
#        $requestedStatus can be "on" or "off"
#
sub checkBits($$$$) {
	my $self = shift;
	my $reqStatus = shift;
	my $bm1 = shift; # reference bitmask, defining which bits need to be checked
	my $bm2 = shift; # bitmask to investigate
	
	my $differingBits = 0;
	my $bm1unp = unpack('B*', $bm1);
	my @bm1unp = split //, $bm1unp; 
	my $bm2unp = unpack('B*', $bm2);
	my @bm2unp = split //, $bm2unp;
	
	if ( $#bm1unp == $#bm2unp ) { # must be of equal length
		if ($reqStatus eq "on") {
			for my $i (0 .. $#bm1unp) {
				if ($bm1unp[$i]) { # if bit is set
					if ($bm1unp[$i] != $bm2unp[$i]) {
						$self->debug("checkIfBitsAreSet(\"on\"): bit with index $i isn't set in the other bitmask, while it should be!\n");
						$differingBits++;
					}
				}
			}
		} elsif ($reqStatus eq "off") {
			for my $i (0 .. $#bm1unp) {
				if ($bm1unp[$i]) { # if bit is set
					if ($bm1unp[$i] == $bm2unp[$i]) {
						$self->debug("checkIfBitsAreSet(\"off\"): bit with index $i is set in the other bitmask, while it shouldn't be!\n");
						$differingBits++;
					}
				}
			}			
		} else {
			print "checkBits(): invalid requested status argument!\n";
			return ($#bm1unp + 1);
		}
	
		return $differingBits;
	} else {
		print "checkIfBitsAreSet(): I am not supposed to compare bitmasks of differing length!\n";
		print "\$bm1 has last index $#bm1unp and \$bm2 has last index $#bm2unp\n";
		return ( $#bm1unp > $#bm2unp ? $#bm1unp + 1 : $#bm2unp + 1);
	}
}


# 
# Check to see if the given "real" VLAN number (i.e. tag) exists on the switch
#
# usage: vlanNumberExists($self, $vlan_number)
#        returns 1 if the 802.1Q VLAN tag exists, 0 otherwise
#
sub vlanNumberExists($$) {
    my ($self, $vlan_number) = @_;

    # resolve the vlan number to an ifindex.  If no result, then no vlan...
    if (defined($self->getVlanIfindex($vlan_number))) {
	return 1;
    } else {
    	return 0;
    }
}

#
# Given VLAN indentifiers from the database, finds the cisco-specific VLAN
# number for them. If not VLAN id is given, returns mappings for the entire
# switch.
# 
# usage: findVlans($self, @vlan_ids)
#        returns a hash mapping VLAN ids to Cisco VLAN numbers
#        any VLANs not found have NULL VLAN numbers
#
sub findVlans($@) {
    my $self = shift;
    my @vlan_ids = @_;
    my %hash = ();
    my %Vlnum = ();


    # Build a mapping from vlan ifindex to vlan number.  Have to do this
    # each time since the set of vlans varies over time.
    my ($results) = snmpitBulkwalkWarn($self->{SESS}, ["ifDescr"]);
    foreach my $result (@{$results}) {
	my ($name,$iid,$vlid) = @{$result};
	$self->debug("findVlans: got $name, $iid, name $vlid\n",2);
	if ($name ne "ifDescr") {
	    warn "findVlans: unexpected oid: $name\n";
	    next;
	}
	if ($vlid =~ /vlan\s+(\d+)/i) {
	    $Vlnum{$iid} = $1;
	}
    }
    
    # Grab the list of vlans.
    ($results) = snmpitBulkwalkWarn($self->{SESS}, ["dot1qVlanStaticName"]);

    foreach my $result (@{$results}) {
	my ($name,$iid,$vlanname) = @{$result};
	$self->debug("findVlans(): got $name, $iid, name $vlanname\n",2);
	if ($name ne "dot1qVlanStaticName") {
	    warn "findVlans: unexpected oid: $name\n";
	    next;
	}

	# Must strip the prefix required on the Force10 to get the vlan id
	# as known by Emulab.
	$vlanname = stripVlanPrefix($vlanname);
	
	# add to hash if theres no @vlan_ids list (requesting all) or if the
	# vlan is actually in the list
	if ( (! @vlan_ids) || (grep {$_ eq $vlanname} @vlan_ids) ) {
	    $hash{$vlanname} = $Vlnum{$iid};
	}
    }

    return %hash;
}

#
# Given a VLAN identifier from the database, find the "cisco-specific VLAN
# number" that is assigned to that VLAN (= VLAN tag). Retries several times (to
# account for propagation delays) unless the $no_retry option is given.
#
# usage: findVlan($self, $vlan_id,$no_retry)
#        returns the VLAN number for the given vlan_id if it exists
#        returns undef if the VLAN id is not found
#
sub findVlan($$;$) { 
    my $self = shift;
    my $vlan_id = shift;
    my $no_retry = shift;
    
    my $max_tries;
    if ($no_retry) {
	$max_tries = 1;
    } else {
	$max_tries = 10;
    }

    # We try this a few times, with 1 second sleeps, since it can take
    # a while for VLAN information to propagate
    foreach my $try (1 .. $max_tries) {

	my %mapping = $self->findVlans($vlan_id);
	if (defined($mapping{$vlan_id})) {
	    return $mapping{$vlan_id};
	}

	# Wait before we try again
	if ($try < $max_tries) {
	    $self->debug("VLAN find failed, trying again\n");
	    sleep 1;
	}
    }

    # Didn't find it
    return undef;
}

#
# Determine if a VLAN has any members 
# (Used by stack->switchesWithPortsInVlan())
#
sub vlanHasPorts($$) {
    my ($self, $vlan_number) = @_;

    my $vlifindex = $self->getVlanIfindex($vlan_number);
    if (!defined($vlifindex)) {
	warn "vlanHasPorts: Could not lookup vlan index for vlan: $vlan_number\n";
	return 0;
    }

    my $membermask = $self->getMemberBitmask($vlifindex);
    if (!defined($membermask)) {
	warn "vlanHasPorts: Could not get membership bitmask for blan: $vlan_number\n";
	return 0;
    }
    my $setcount = pack("%32b*", $membermask);

    return $setcount ? 1 : 0;
}

#
# Create a VLAN on this switch, with the given identifier (which comes from
# the database) and given 802.1Q tag number ($vlan_number). 
#
# usage: createVlan($self, $vlan_id, $vlan_number)
#        returns the new VLAN number on success
#        returns 0 on failure
#
sub createVlan($$$) {
    my $self = shift;
    
    # as known in db and as will be saved in administrative vlan
    # name on switch
    my $vlan_id = shift;

    # 802.1Q vlan tag
    my $vlan_number = shift; 
	
    # Check to see if the requested vlan number already exists.
    if ($self->vlanNumberExists($vlan_number)) {
	warn "createVlan: WARNING: VLAN $vlan_number already exists\n";
	return 0;
    }

    # Create VLAN
    my $RetVal = snmpitSetWarn($self->{SESS},["dot1qVlanStaticRowStatus", 
					      $vlan_number, "createAndGo", 
					      "INTEGER"]);
    # $RetVal will be undefined if the set failed, or "1" if it succeeded.
    if (! defined($RetVal) )  { 
	warn "createVlan: ERROR: VLAN Create id '$vlan_id' as VLAN $vlan_number failed.\n";
	return 0;
    }

    # trying to use static ifindex offsets for vlans is unreliable.
    my $vlifindex = $self->getVlanIfindex($vlan_number);
    if (!defined($vlifindex)) {
	warn "createVlan: Could not lookup ifindex for vlan number: $vlan_number\n";
	return 0;
    }
    
    # Set administrative name to vlan_id as known in emulab db.
    # Prepend a string to the numeric id as Force10 doesn't allow all numberic
    # for a vlan name.
    $vlan_id = addVlanPrefix($vlan_id);
    $RetVal = snmpitSetWarn($self->{SESS},["dot1qVlanStaticName", 
					   $vlifindex,
					   $vlan_id,
					   "OCTETSTR"]);
    
    # $RetVal will be undefined if the set failed, or "1" if it succeeded.
    if (! defined($RetVal) )  { 
	warn "createVlan: Set VLAN name to '$vlan_id' failed, ".
	     "but VLAN $vlan_number was created! ".
	     "Manual cleanup required.\n";
	return 0;
    }

    return $vlan_number;
}

#
# Put the given ports in the given VLAN. The VLAN is given as an 802.1Q 
# tag number. (so NOT as a vlan_id from the database!)
#
# usage: setPortVlan($self, $vlan_number, @ports)
#	 returns 0 on sucess.
#	 returns the number of failed ports on failure
#
sub setPortVlan($$@) {
    my ($self, $vlan_number, @ports) = @_;

    my $RetVal; 
	
    # Run the port list through portmap to find the ports on the switch that
    # we are concerned with
    my @portlist = $self->convertPortFormat($PORT_FORMAT_IFINDEX, @ports);
    $self->debug("ports: " . join(",",@ports) . "\n");
    $self->debug("as ifIndexes: " . join(",",@portlist) . "\n");
	
    # Create a bitmask from this ifIndex list
    my $bitmask = $self->convertIfindexesToBitmask(\@portlist);
	
    # First remove the ports from all VLANs, just in case.
    # If a port is still untagged in a different VLAN, the set command would
    # fail.	
    my %vlifindexes = $self->getVlanIfindex("ALL");
    while (my ($vlnum, $vlifidx) = each %vlifindexes) {
	# removing untagged ports from default VLAN 1 wouldn't make sense
	next if ($vlnum == 1);

	# Only attempt to remove the ports if one or more appear in the
	# current member list.
	my $vlbitmask = $self->getMemberBitmask($vlifidx);
	if ($self->checkBits("off",$bitmask,$vlbitmask)) {
	    $self->debug("setPortVlan(): preventively attempting to ".
			 "remove @ports from vlan number $vlnum\n");
	    
	    $RetVal = $self->removeSelectPortsFromVlan($vlnum, @ports);
	    if ($RetVal) {
		$self->debug("setPortVlan(): error when making sure that ".
			     "@ports are removed from vlan $vlnum!\n");
	    }
	}
    }

    # get VLAN ifIndex
    my $vlanIfindex = $vlifindexes{$vlan_number};
    return $self->setPortMembership("on", $bitmask, $bitmask, $vlanIfindex);
}

# Removes and disables some ports in a given VLAN. The VLAN is given as a VLAN
# 802.1Q tag value.  Ports are known to be regular ports and not trunked.
#
# usage: removeSomePortsFromVlan(self,vlan,@ports)
#	 returns 0 on sucess.
#	 returns the number of failed ports on failure.
sub removeSomePortsFromVlan($$@) {
	my ($self, $vlan_number, @ports) = @_;
	return $self->removeSelectPortsFromVlan($vlan_number, @ports);
}

#
# Removes select ports from the given VLANS. Each VLAN is given as a VLAN
# 802.1Q tag value.
#
# usage: removeSelectPortsFromVlan(self,@vlan)
#	 returns 0 on sucess (!!!)
#	 returns the number of failed ports on failure.
#
sub removeSelectPortsFromVlan($$@) {
	my $self = shift;
	my $vlan_number = shift;
	my @ports = @_;

	# VLAN 1 is default VLAN, that's where all ports are supposed to go
	# so trying to remove them there doesn't make sense
	if ($vlan_number == 1) {
	    warn "removeSelectPortsFromVlan: WARNING: Attempt made to remove @ports from default VLAN 1\n";
	    return 0;
	}

	# Run the port list through portmap to find the ports on the switch that
	# we are concerned with
	my @portlist = $self->convertPortFormat($PORT_FORMAT_IFINDEX, @ports);
	$self->debug("removeSelectPortsFromVlan(): ports: " . join(",",@ports) . "\n");
	$self->debug("removeSelectPortsFromVlan(): as ifIndexes: " . join(",",@portlist) . "\n");
	
	# Create a bitmask from this ifIndex list
	my $bitmaskToRemove = $self->convertIfindexesToBitmask(\@portlist);

	# Create an all-zero bitmask of the appropriate length.
	my $allZeroBitmask = "00000000" x length($bitmaskToRemove);
        $allZeroBitmask = pack("B*", $allZeroBitmask);

	# Get the ifindex of the vlan.
	my $vlanIfindex = $self->getVlanIfindex($vlan_number);
	if (!defined($vlanIfindex)) {
	    warn "setPortMembership: Error getting ifindex for vlan number $vlan_number!\n";
	    return scalar(@ports);
	}

	return $self->setPortMembership("off", $allZeroBitmask, 
					$bitmaskToRemove, $vlanIfindex);
}


#
# Remove the given VLANs from this switch. Removes all ports from the VLAN,
# so it's not necessary to call removePortsFromVlan() first. The VLAN is
# given as a 802.1Q VLAN tag number (so NOT as a vlan_id from the database!)
#
# usage: removeVlan(self,int vlan)
#	 returns 1 on success
#	 returns 0 on failure
#
sub removeVlan($@) {
	my $self = shift;
	my @vlan_numbers = @_;
	my $errors = 0;
	my $DeleteOID = "dot1qVlanStaticRowStatus";
	my $name = $self->{NAME};

	foreach my $vlan_number (@vlan_numbers) {
		# Calculate ifIndex for this VLAN
		my $ifIndex = $self->getVlanIfindex($vlan_number);
		if (!defined($ifIndex)) {
		    warn "removeVlan: Error looking up vlan ifindex for vlan number $vlan_number.\n";
		    $errors++;
		    next;
		}
		
		# Perform the actual removal (no need to first remove all ports from
		# the VLAN)
		
		my $RetVal = undef;
		print "  Removing VLAN # $vlan_number ... ";
		$RetVal = $self->{SESS}->set([[$DeleteOID,$ifIndex,"destroy","INTEGER"]]);
		# $RetVal should contain "0 but true" if successful	
		if ( defined($RetVal) ) { 
			print "Removed VLAN $vlan_number on switch $name.\n";
		} else {
		    warn "removeVlan: ERROR: Removal of VLAN $vlan_number failed on switch $name.\n";
		    $errors++;
		    next;
		}
	}
	
	return ($errors == 0) ? 1 : 0;
}


#
# Removes ALL ports from the given VLANS. Each VLAN is given as a VLAN
# 802.1Q tag value.
#
# usage: removePortsFromVlan(self,@vlan)
#	 returns 0 on sucess (!!!)
#	 returns the number of failed ports on failure.
#
sub removePortsFromVlan($@) {
    my $self = shift;
    my @vlan_numbers = @_;
    my $errors = 0;

    foreach my $vlan_number (@vlan_numbers) {
    	$self->debug("removePortsFromVlan(): attempting to remove all ports from vlan_number $vlan_number\n");
    	
	# VLAN 1 is default VLAN, that's where all ports are supposed to go
	# so trying to remove them there doesn't make sense
	if ($vlan_number == 1) {
	    warn "removePortsFromVlan: WARNING: Attempt made to remove all ports from default VLAN 1\n";
	    next;
	}

	# Get the ifindex of the vlan.
	my $vlanIfindex = $self->getVlanIfindex($vlan_number);
	if (!defined($vlanIfindex)) {
	    warn "removePortsFromVlan: Error getting ifindex for vlan number $vlan_number!\n";
	    next;
	}
	
	# Get the current membership bitmask
	my $currentBitmask = $self->getMemberBitmask($vlanIfindex);
	if (!defined($currentBitmask)) {
	    warn "removePortsFromVlan: error getting current membership bitmask for vlan_number $vlan_number.\n";
	    # no membership bitmask => impossible to obtain number of ports
	    # anyway => next...
	    next;
	}
	
	# Create an all-zero bitmask
	my $allZeroBitmask = "00000000" x length($currentBitmask);
        $allZeroBitmask = pack("B*", $allZeroBitmask);
		
	$errors += $self->setPortMembership("off", $allZeroBitmask,
					    $currentBitmask, $vlanIfindex);
    }

    return $errors;
}


#
# Set a variable associated with a port. The commands to execute are given
# in the cmdOIDs hash above. A command can involve multiple OIDs.
#
# usage: portControl($self, $command, @ports)
#    returns 0 on success.
#    returns number of failed ports on failure.
#    returns -1 if the operation is unsupported
#
sub portControl ($$@) {
	my $self = shift;
	my $cmd = shift;
	my @ports = @_;

	$self->debug("portControl(): $cmd -> (@ports)\n");

	# Find the command in the %cmdOIDs hash (defined at the top of this file)
	if (defined $cmdOIDs{$cmd}) {
		my @oid = @{$cmdOIDs{$cmd}};
		my $errors = 0;

		# Convert the ports from the format they were given in to the format
		# required by the command... and probably FTOS will always require
		# ifIndexes.
		
		my $portFormat = $PORT_FORMAT_IFINDEX;
		my @portlist = $self->convertPortFormat($portFormat,@ports);

		# Some commands involve multiple SNMP commands, so we need to make
		# sure we get all of them
		while (@oid) {
			my $myoid = shift @oid;
			my $myval = shift @oid;

			$errors += $self->UpdateField($myoid,$myval,@portlist);
		}
		return $errors;
	} else {
		# Command not supported
		$self->debug("portControl(): Unsupported port control command ".
				"'$cmd' ignored.\n",1);
		return -1;
	}
}

#
# Sets a *single* OID to a desired value for a given list of ports (in ifIndex format)
#
# usage: UpdateField($self, $OID, $desired_value, @ports)
#    returns 0 on success
#    returns -1 on failure
#
sub UpdateField($$$@) {
	my $self = shift;
	my ($OID,$val,@ports)= @_;

	$self->debug("UpdateField(): OID $OID value $val ports @ports\n");

	my $RetVal = 0;
	my $result = 0;

    foreach my $port (@ports) {
		$self->debug("UpdateField(): checking port $port for $OID $val ...\n");
		$RetVal = $self->{SESS}->get([$OID,$port]);
		if (!defined $RetVal) {
			$self->debug("UpdateField(): Port $port, change to $val: ".
				"No answer from device\n");
			$result = -1;
		} else {
			$self->debug("UpdateField(): Port $port was $RetVal\n");
			if ($RetVal ne $val) {
				$self->debug("UpdateField(): Setting port $port to $val...\n");
				$RetVal = $self->{SESS}->set([[$OID,$port,$val,"INTEGER"]]);

				my $count = 6;
				while (($RetVal ne $val) && (--$count > 0)) { 
					sleep 1;
					$RetVal = $self->{SESS}->get([$OID,$port]);
					$self->debug("UpdateField(): Value for port $port is ".
						"currently $RetVal\n");
				}
				$result =  ($count > 0) ? 0 : -1;
				$self->debug("UpdateField(): ".
					($result ? "failed.\n" : "succeeded.\n") );
			}
		}
	}
	return $result;
}

# 
# Get statistics for ports on the switch
#
# usage: getPorts($self)
# see snmpit_cisco_stack.pm for a description of return value format
#
#
sub getStats() {
    my $self = shift;

    #
    # Walk the tree for the VLAN members
    #
    my $vars = new SNMP::VarList(['ifInOctets'],['ifInUcastPkts'],
    				 ['ifInNUcastPkts'],['ifInDiscards'],
				 ['ifInErrors'],['ifInUnknownProtos'],
				 ['ifOutOctets'],['ifOutUcastPkts'],
				 ['ifOutNUcastPkts'],['ifOutDiscards'],
				 ['ifOutErrors'],['ifOutQLen']);
    my @stats = $self->{SESS}->bulkwalk(0,32,$vars);

    my $i = 0;
    my %stats = ();
    my %allports = ();
    foreach my $array (@stats) {
	while (@$array) {
	    my ($name,$ifindex,$value) = @{shift @$array};

	    # filter out entries we don't care about.
            if (! defined $self->{IFINDEX}{$ifindex}) { next; }

	    # Convert to Port object, check connectivity, and stash metrics.
            my ($swport) = convertPortFormat($PORT_FORMAT_PORT, $ifindex);
            if (! defined $swport) { next; } # Skip if we don't know about it
            my $nportstr = $swport->getOtherEndPort()->toTripleString();
            $allports{$nportstr} = $swport;
	    ${$stats{$nportstr}}[$i] = $value;
	}
	$i++;
    }

    return map [$allports{$_},@{$stats{$_}}], sort {tbsort($a,$b)} keys %stats;
}

#
# Read a set of values for all given ports.
#
# usage: getFields(self,ports,oids)
#        ports: Reference to a list of ports, in any allowable port format
#        oids: A list of OIDs to retrieve values for
#
# On sucess, returns a two-dimensional list indexed by port,oid
#
sub getFields($$$) {
	my $self = shift;
	my ($ports,$oids) = @_;

	my @ifindicies = $self->convertPortFormat($PORT_FORMAT_IFINDEX,@$ports);
	my @oids = @$oids;

	# Put together an SNMP::VarList for all the values we want to get
	my @vars = ();
	foreach my $ifindex (@ifindicies) {
		foreach my $oid (@oids) {
			push @vars, ["$oid","$ifindex"];
		}
	}

	# If we try to ask for too many things at once, we get back really bogus
	# errors. So, we limit ourselves to an arbitrary number that, by
	# experimentation, works.
	my $maxvars = 16;
	my @results = ();
	while (@vars) {
		my $varList = new SNMP::VarList(splice(@vars,0,$maxvars));
		my $rv = $self->{SESS}->get($varList);
		push @results, @$varList;
	}
	    
	# Build up the two-dimensional list for returning
	my @return = ();
	foreach my $i (0 .. $#ifindicies) {
		foreach my $j (0 .. $#oids) {
			my $val = shift @results;
			$return[$i][$j] = $$val[2];
		}
	}

	return @return;
}


######
###### New switch backends
######

###
### methods below probably not needed;
###

#$device->enablePortTrunking2($self, $port, $vlan_number, $equaltrunking)
##        modport: module.port of the trunk to operate on
##        nativevlan: VLAN number of the native VLAN for this trunk
##        equaltrunk: don't do dual mode; tag PVID also.
##        Returns 1 on success, 0 otherwise
#
#$device->clearAllVlansOnTrunk($self, $modport)
##        modport: module.port of the trunk to operate on
##        Returns 1 on success, 0 otherwise (must be done before taking a
##        port out of trunking mode.
#
#(usually internal).
#
#$device->disablePortTrunking($self, $modport)
#        returns 1 on success, 0 on failure.
#
#$device->getChannelIfIndex($self, @ports)
#        this is used in the function immediately below; an interswitch
#        trunk maybe connected by several physical wires constituting
#        a logical trunk.  It is necessary on cisco's (and possibly
#        others) to return a special cookie for trunk operations.
#        this function only deals with one trunk at a time.
#
#$device->setVlansOnTrunk($self, $trunkIndex, $value, @vlan_number)
##        $trunkIndex: cookie returned above for the trunk on which to operate.
##        $value: 0 to disallow the VLAN on the trunk, 1 to allow it
##        #vlan_numbers: An array of 802.1Q VLAN numbers to operate on
##        Returns 1 on success, 0 otherwise
##
#
#$device->resetVlanIfOnTrunk($self, $modport, $vlan_number)
##        modport: module.port of the trunk to operate on
##        vlan_number: A 802.1Q VLAN tag number to check
##        return value currently ignored.  Takes vlan out of the trunk and puts
##        it back in to flush the FDB.
#
#


#
# Enable Openflow
#
sub enableOpenflow($$) {
    my $self = shift;
    my $vlan = shift;
    my $RetVal;
    
    #
    # Force10 switch doesn't support Openflow yet.
    #
    warn "ERROR: Force10 swith doesn't support Openflow now";
    return 0;
}

#
# Disable Openflow
#
sub disableOpenflow($$) {
    my $self = shift;
    my $vlan = shift;
    my $RetVal;
    
    #
    # Force10 switch doesn't support Openflow yet.
    #
    warn "ERROR: Force10 swith doesn't support Openflow now";
    return 0;
}

#
# Set controller
#
sub setOpenflowController($$$) {
    my $self = shift;
    my $vlan = shift;
    my $controller = shift;
    my $RetVal;
    
    #
    # Force10 switch doesn't support Openflow yet.
    #
    warn "ERROR: Force10 swith doesn't support Openflow now";
    return 0;
}

#
# Set listener
#
sub setOpenflowListener($$$) {
    my $self = shift;
    my $vlan = shift;
    my $listener = shift;
    my $RetVal;
    
    #
    # Force10 switch doesn't support Openflow yet.
    #
    warn "ERROR: Force10 swith doesn't support Openflow now";
    return 0;
}

#
# Get used listener ports
#
sub getUsedOpenflowListenerPorts($) {
    my $self = shift;
    my %ports = ();

    warn "ERROR: Force10 swith doesn't support Openflow now\n";

    return %ports;
}

#
# Check if Openflow is supported on this switch
#
sub isOpenflowSupported($) {
    #
    # Force10 switch doesn't support Openflow yet.
    #
    return 0;
}


# end with 1;
1;
