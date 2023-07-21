#!/usr/bin/perl -W

#
# Copyright (c) 2010-2023 University of Utah and the Flux Group.
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

#
# snmpit module for Planet Technology industrial switch.
# Unfortunately, these switches do not support VLAN operations via SNMP,
# so we have to use the CLI.
#
# XXX Copied from the CLI based Netscout module.
#

package snmpit_planet;
use strict;
use Data::Dumper;

$| = 1; # Turn off line buffering on output

use English;
use SNMP; 
use snmpit_lib;
use libdb;

use libtestbed;
use Expect;
use Lan;
use Port;


# CLI constants
my $CLI_TIMEOUT = 30;

# Most are defined in snmpit_lib, let's not repeat or change
#my $PORT_FORMAT_IFINDEX   = 1;
#my $PORT_FORMAT_MODPORT   = 2;
#my $PORT_FORMAT_NODEPORT  = 3;
#my $PORT_FORMAT_PORT      = 4;
#my $PORT_FORMAT_PORTINDEX = 5;
my $PORT_FORMAT_NATIVE     = 6;

my %emptyVlans = ();

#
# XXX safety net: make sure we don't remove this vlan from any port.
#
# This is the Emulab/CloudLab/Powder hardware management VLAN. We don't want
# to lose contact with any far-flung, hard to access Powder end-point switches.
#
my $SACRED_VLAN	   = 10;

#
# All functions are based on snmpit_hp class.
#
# NOTES: This device is a layer 1 switch that has no idea
# about VLAN. We use the port name on switch as VLAN name here. 
# So in this module, vlan_id and vlan_number are the same 
# thing. vlan_id acts as the port name.
#
# Another fact: the port name can't exist without naming
# a port. So we can't find a VLAN if no ports are in it.
#

#
# Creates a new object.
#
# usage: new($classname,$devicename,$debuglevel,$community)
#        returns a new object.
#
# We actually donot use SNMP, the SNMP values here, like
# community, are just for compatibility.
#
sub new($$$;$) {

    # The next two lines are some voodoo taken from perltoot(1)
    my $proto = shift;
    my $class = ref($proto) || $proto;

    my $name = shift;
    my $debugLevel = shift;
    my $community = shift;  # actually the password for ssh

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

    if (!exists($options->{"username"}) || !exists($options->{"password"})) {
	warn "ERROR: No credentials found for OS10 switch $self->{NAME}\n";
	return undef;
    }
    $self->{USER} = $options->{"username"};
    $self->{PASSWORD} = $options->{"password"};

    # other global variables
    $self->{DOALLPORTS} = 0;
    $self->{DOALLPORTS} = 1;
    $self->{SKIPIGMP} = 1;
    $self->{WARNED} = 0;

    if ($self->{DEBUG}) {
        print "snmpit_planet initializing $self->{NAME}, " .
            "debug level $self->{DEBUG}\n" ;   
    }

    $self->{SESS} = undef;
    $self->{CLI_PROMPT} = $self->{NAME} . "# ";

    # Make it a class object
    bless($self, $class);

    #
    # Do lazy initialization of the Expect object.
    #
    $self->{SESS} = undef;

    return $self;
}

#
# Create an Expect object that spawns the ssh process 
# to switch.
#
sub createExpectObject($)
{
    my $self = shift;
    
    my $spawn_cmd = "ssh -l $self->{USER} $self->{NAME}";
    # Create Expect object and initialize it:
    my $exp = new Expect();
    if (!$exp) {
        # upper layer will check this
        return undef;
    }

    $exp->log_stdout(0);
    $exp->spawn($spawn_cmd)
    or die "Cannot spawn $spawn_cmd: $!\n";
    $exp->expect($CLI_TIMEOUT,
         ["$self->{USER}\@$self->{NAME}'s password:" => sub { my $e = shift;
                               $e->send($self->{PASSWORD}."\n");
                               exp_continue;}],
         ["Are you sure you want to continue connecting (yes/no)?" => sub { 
                               # Only occurs for the first time connection...
                               my $e = shift;
                               $e->send("yes\n");
                               exp_continue;}],
         ["Permission denied, please try again." => sub { 
                               die "Password incorrect!\n";} ],
         [ timeout => sub { die "Timeout when connect to switch!\n";} ],
         $self->{CLI_PROMPT} );

    $exp->debug(0);
    return $exp;
}

#
# Convert to and from made-up port indicies.
# These are needed by snmpit_stack when dealing with interswitch links.
# Simple mapping:
#
# 1Gb ports:   port number, 1-8+
# 2.5Gb ports: 250 + port number, 251-252+
# 10Gb ports:  1000 + port number, 1001-1002+
#
# Note that this mappping could be changed at will, it does not persist
# anywhere outside of this snmpit instance.
#
sub Index2native($$)
{
    my ($self, $ix) = @_;

    # XXX assumes all ports are 1/<something>.
    if ($ix > 0 && $ix < 100) {
	return "GigabitEthernet 1/$ix";
    }
    if ($ix > 250 && $ix < 350) {
	$ix -= 250;
	return "2.5GigabitEthernet 1/$ix";
    }
    if ($ix > 1000 && $ix < 1100) {
	$ix -= 1000;
	return "10GigabitEthernet 1/$ix";
    }

    return "??";
}

sub native2Index($$)
{
    my ($self, $iface) = @_;
    my $ix = -1;

    # XXX assumes all ports are 1/<something>.
    if ($iface =~ /^(\S*)GigabitEthernet\s+1\/(\d+)$/) {
	if (!defined($1) || $1 eq "") {
	    $ix = int($2);
	} elsif ($1 eq "2.5") {
	    $ix = 250 + int($2);
	} elsif ($1 eq "10") {
	    $ix = 1000 + int($2);
	}
    }
    return $ix;
}

sub PortInstance2native($$)
{
    my ($self, $port) = @_;

    my $dbiface = $port->iface();
    if ($dbiface =~ /^(\S*)gigabit(\d+\/\d+)$/) {
	return "${1}GigabitEthernet $2";
    }
    return $dbiface;
}

sub native2PortInstance($$)
{
    my ($self, $iface) = @_;

    if ($iface =~ /^(\S*)GigabitEthernet\s+(\d+\/\d+)$/) {
	my $port = Port->LookupByIface($self->{NAME}, "${1}gigabit${2}");
	if ($port) {
	    return $port;
	}
    }
    my $string = Port->Tokens2IfaceString($self->{NAME}, $iface);
    return Port->LookupByStringForced($string);
}

#
# Converting port formats.
# XXX We need this as snmpit_stack wants to get/use ifindex's when dealing
# with interswitch links.
#
sub convertPortFormat($$@)
{
    my $self = shift;
    my $output = shift;

    my @ports = @_;

    my $id = $self->{NAME} . "::convertPortFormat";

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
	warn "$id: Given a bad list of ports\n";
	return undef;
    }

    my $input = undef;
    if (Port->isPort($sample)) {
	$input = $PORT_FORMAT_PORT;
    }
    elsif ($sample =~ /^(2\.5|10)?Gigabit/) {
	$input = $PORT_FORMAT_NATIVE;
    }
    elsif ($sample =~ /^\d+$/) {
        $input = $PORT_FORMAT_IFINDEX;
    }
    else {
	warn "$id: do not support input port format of '$sample'\n";
	return undef;
    }
    
    #
    # It's possible the ports are already in the right format
    #
    if ($input == $output) {
	return @ports;
    }

    if ($input == $PORT_FORMAT_PORT) {
	my @swports = map $_->getEndByNode($self->{NAME}), @ports;

	if ($output == $PORT_FORMAT_NATIVE) {
	    my @nports = map $self->PortInstance2native($_), @swports;
	    return @nports;
	}
	elsif ($output == $PORT_FORMAT_IFINDEX) {
	    my @nports = map $self->PortInstance2native($_), @swports;
	    my @ix = map $self->native2Index($_), @nports;
	    return @ix;
	}
    }
    elsif ($input == $PORT_FORMAT_NATIVE) {
	if ($output == $PORT_FORMAT_PORT) {
	    my @swports = map $self->native2PortInstance($_), @ports;
	    return @swports
	}	
	elsif ($output == $PORT_FORMAT_IFINDEX) {
	    my @ix = map $self->native2Index($_), @ports;
	    return @ix;
	}
    }
    elsif ($input == $PORT_FORMAT_IFINDEX) {
	if ($output == $PORT_FORMAT_PORT) {
	    my @nports = map $self->Index2native($_), @ports;
	    my @swports = map $self->native2PortInstance($_), @nports;
	    return @swports
	}	
	elsif ($output == $PORT_FORMAT_NATIVE) {
	    my @nports = map $self->Index2native($_), @ports;
	    return @nports
	}	
    }

    #
    # Some combination we don't know how to handle
    #
    warn "$id: Bad input/output combination ($input/$output)\n";
    return undef;    
}


##############################################################################


#
# helper to do CLI command and check the error msg
#
sub doCLICmd($$;$)
{
    my ($self, $cmd, $nofilter) = @_;
    my $output = "";
    my $exp = $self->{SESS};
    my $id = $self->{NAME} . "::doCLICmd";

    if (!$exp) {
	#
	# Create the Expect object, lazy initialization.
	#
	# We'd better set a long timeout on Planet switch
	# to keep the connection alive.
	$self->{SESS} = $self->createExpectObject();
	if (!$self->{SESS}) {
	    warn "$id: WARNING: Unable to connect to $self->{NAME}\n";
	    return (1, "Unable to connect to switch $self->{NAME}.");
	}
	$exp = $self->{SESS};
    }

    $exp->clear_accum(); # Clean the accumulated output, as a rule.
    $self->debug("$id: issue command '$cmd'\n",2);
    $exp->send($cmd . "\n");
    my ($pos, $err) =
	$exp->expect($CLI_TIMEOUT,
		     [$self->{CLI_PROMPT} => sub {
			 my $e = shift;
			 $output = $e->before();
		      }] );
    if ($err && $err eq "1:TIMEOUT" && !$self->{WARNED}) {
	print STDERR "$id: WARNING: ".
	    "timeout from expect, may need to disable pager on switch\n";
	$self->{WARNED} = 1;
    }

    if ($err) {
	$self->debug("$id: expect error '$err' in doCLICmd\n",2);
	return(1, "expect $err");
    }
    my @foutput = ();
    my $errors = 0;
    my ($cmdstart) = split /\n/, $cmd;
    $cmdstart = quotemeta($cmdstart);
    foreach my $line (split /\n/, $output) {
	$line =~ s/\r//;
	
	# If filtering and line start with the prompt, assume it is an echo
	if (!$nofilter && $line =~ /^$self->{NAME}(#|\(config)/) {
	    next;
	}
	# ditto if it is an echo of the (start of the) command
	if (!$nofilter && $line =~ /^$cmdstart/) {
	    next;
	}

	# An error message. When filtering, return just the error message.
	if ($line =~ /^\% (.*)$/) {
	    $errors++;
	    if (!$nofilter) {
		return(1, $1);
	    }
	}
	push @foutput, $line;
    }
    $output = join("\n", @foutput);

    $self->debug("$id: errors=$errors, output:\n|$output|\n", 4);
    return ($errors ? 1 : 0, $output);
}


#
# get the raw CLI output of a command
#
sub getRawOutput($$)
{
    my ($self, $cmd) = @_;
    my ($rt, $output) = $self->doCLICmd($cmd, 1);
    if ( !$rt ) {        
        my $qcmd = quotemeta($cmd);
        if ( $output =~ /^($qcmd)/ ) {
            return substr($output, length($cmd)+1);
        }        
    }

    return undef;
}

#
# Set a variable associated with a port.
#
# usage: portControl($self, $command, @ports)
#     returns 0 on success.
#     returns number of failed ports on failure.
#     returns -1 if the operation is unsupported
#
sub portControl ($$@) {
    my $self = shift;
    my $id = $self->{NAME} . ":portControl";

    my $cmd = shift;
    my @pcports = @_;
    my $errors = 0;
    my $scmd;

    $self->debug("portControl: $cmd -> (".Port->toStrings(@pcports).")\n");

    if ($cmd !~ /^(enable|disable)$/) {
	warn "$id: ignoring '$cmd' for @pcports\n";
	return 1;
    }

    my @ports = $self->convertPortFormat($PORT_FORMAT_NATIVE, @pcports);

    $self->lock();

    foreach my $pstr (@ports) {
	if ($cmd eq "enable") {
	    $scmd = "conf t\nint $pstr\nno shutdown\nexit\nexit";
	} else {
	    $scmd = "conf t\nint $pstr\nshutdown\nexit\nexit";
	}
	my ($rv, $output) = $self->doCLICmd($scmd);
	if ($rv) {
	    warn "$id: '$cmd' failed: $output\n";
	}
	$errors += $rv;
    }

    $self->unlock();
    return $errors;
}

#
# Given VLAN indentifiers from the database, finds the 802.1Q VLAN tag
# number for them. If not VLAN id is given, returns mappings for the entire
# switch.
#
# usage: findVlans($self, @vlan_ids)
#        returns a hash mapping VLAN ids to VLAN tag numbers
#        any VLANs not found have NULL VLAN numbers
#
sub findVlans($@) { 
    my $self = shift;
    my @vlan_ids = @_;
    my %mapping = ();
    my $id = $self->{NAME} . "::findVlans";
    
    if (scalar(@vlan_ids) > 0) { @mapping{@vlan_ids} = undef; }

    # 
    # Get info for all vlans
    #
    my ($rv, $output) = $self->doCLICmd("show vlan brief");
    if ($rv) {
	warn("$id: Could not get VLAN list from switch: $output\n");
	return undef;
    }
    foreach my $line ( split /\n/, $output ) {
	if ($line =~ /^(\d+)\s+(\S+)/) {
	    if (!@vlan_ids || exists($mapping{$2})) {
		$mapping{$2} = $1;
	    }
	}
    }
    return %mapping;
}


#
# Given a VLAN identifier from the database, find the VLAN tag that is
# assigned to that VLAN. Retries several times (to account for propagation
# delays) unless the $no_retry option is given.
#
# usage: findVlan($self, $vlan_id,$no_retry)
#        returns the VLAN number for the given vlan_id if it exists
#        returns undef if the VLAN id is not found
#
sub findVlan($$;$) { 
    my $self = shift;
    my $vlan_id = shift;
    my $no_retry = shift;
    my $id = "$self->{NAME}::findVlan($vlan_id)";

    my $max_tries;
    if ($no_retry) {
	$max_tries = 1;
    } else {
	$max_tries = 10;
    }

    # We try this a few times, with 1 second sleeps, since it can take
    # a while for VLAN information to propagate
    foreach my $try (1 .. $max_tries) {
	my ($rt, $output) = $self->doCLICmd("show vlan name $vlan_id");
	if (!$rt) {
	    foreach my $line (split /\n/, $output) {
		if ($line =~ /^(\d+)\s+$vlan_id\s+/) {
		    return $1;
		}
	    }
	}

	# only try again if error is that the VLAN does not exist
	if ($output !~ /VLAN name does not exist/) {
	    last;
	}

	# Wait before we try again
	if ($try < $max_tries) {
	    $self->debug("$id: failed, trying again\n");
	    sleep 1;
	}
    }

    return undef;
}

# 
# Check to see if the given 802.1Q VLAN tag exists on the switch
#
# usage: vlanNumberExists($self, $vlan_number)
#        returns 1 if the VLAN exists, 0 otherwise
#
sub vlanNumberExists($$) {
    my ($self, $vlan_number) = @_;

    my %vmap = $self->findVlans();
    foreach my $id (keys(%vmap)) {
	if ($vmap{$id} == $vlan_number) {
	    return 1;
	}
    }

    return 0;
}

#   
# Create a VLAN on this switch, with the given identifier (which comes from
# the database) and given 802.1Q tag number ($vlan_number). 
#
# usage: createVlan($self, $vlan_id, $vlan_number)
#        returns the new VLAN number on success
#        returns 0 on failure
#
sub createVlan($$$;$) {
    my $self = shift;
    my $vlan_id = shift;
    my $vlan_number = shift;
    my $otherargs = shift;
    my $id = $self->{NAME} . "::createVlan($vlan_id, $vlan_number)";

    #
    # Make sure it is a legit vlan tag number
    #
    if (!defined($vlan_number) || $vlan_number < 2) {
        warn "$id: ERROR: Called with invalid or no VLAN number\n";
        return 0;
    }

    # Check to see if the requested vlan number already exists.
    if ($self->vlanNumberExists($vlan_number)) {
	warn "$id: ERROR: VLAN $vlan_number already exists\n";
	return 0;
    }

    # Was OpenFlow requested?  If so, they lose!
    if ($otherargs && ref($otherargs) eq 'HASH' && 
	exists($otherargs->{"ofenabled"}) && $otherargs->{"ofenabled"} == 1) {
	warn "$id: ERROR: Openflow not supported\n";
	return 0;
    }

    print "Creating VLAN $vlan_id as VLAN #$vlan_number on " .
        "$self->{NAME} ...\n";

    my $cmd = "conf t\nvlan $vlan_number\nname $vlan_id\nexit\nexit";
    my ($rt, $output) = $self->doCLICmd($cmd);
    if ($rt == 0) {
	return $vlan_number;
    }
    warn("$id: ERROR: $output\n");
    return 0;
}

sub parsePortRange($)
{
    my $pstr = shift;
    my @ports = ();
    my @range = split(',', $pstr);

    foreach my $p (@range) {
	if ($p =~ /^(\d+)$/) {
	    push @ports, $1;
	} elsif ($p =~ /^(\d+)-(\d+)$/) {
	    my ($lo, $hi) = ($1, $2);
	    # XXX these are unused ports
	    if ($lo == 1 && $hi == 4095) {
		$lo = $hi = 0;
	    }
	    for (my $i = $lo; $i <= $hi; $i++) {
		push @ports, $i;
	    }
	}
    }
    return @ports;
}

sub expandPortList($)
{
    my $pstr = shift;
    my @ports = ();
    my $pnum;

    if (!$pstr) {
	return @ports;
    }
    
    if ($pstr =~ /\s*Gi\s1\/([-\d,]+)/) {
	foreach $pnum (parsePortRange($1)) {
	    push @ports, "GigabitEthernet 1/$pnum";
	}
    }
    if ($pstr =~ /\s*2\.5G\s1\/([-\d,]+)/) {
	foreach $pnum (parsePortRange($1)) {
	    push @ports, "2.5GigabitEthernet 1/$pnum";
	}
    }
    if ($pstr =~ /\s*10G\s1\/([-\d,]+)/) {
	foreach $pnum (parsePortRange($1)) {
	    push @ports, "10GigabitEthernet 1/$pnum";
	}
    }
    return @ports;
}

sub getPortInfo($@)
{
    my $self = shift;
    my @pcports = @_;
    my $id = $self->{NAME} . "::getPortInfo";

    my %map = ();

    #
    # Get info for all ports, including the mode (trunk, access) and
    # allowed vlans.
    #
    my ($rv, $info) = $self->doCLICmd("show int * switchport");
    if ($rv) {
	warn "$id: Could not get port list from switch: $info\n";
	return undef;
    }
    my $iface = "";
    foreach my $line ( split /\n/, $info ) {
	if ($line =~ /^Name: (.*)$/) {
	    $iface = $1;
	    if (!exists($map{$iface})) {
		@{$map{$iface}{'vlans'}} = ();
	    } else {
		warn "$id: found '$iface' more than once?!\n";
	    }
	    next;
	}
	if ($line =~ /^Administrative mode: (.*)$/) {
	    if ($1 eq "trunk" || $1 eq "hybrid") {
		$map{$iface}{'trunk'} = 1;
	    } else {
		$map{$iface}{'trunk'} = 0;
	    }
	    next;
	}
	if ($line =~ /^Access Mode VLAN: (\d+)$/) {
	    if ($map{$iface}{'trunk'} == 0) {
		push @{$map{$iface}{'vlans'}}, $1;
	    }
	    next;
	}
	if ($line =~ /^Trunk Native Mode VLAN: (\d+)$/) {
	    if ($map{$iface}{'trunk'} == 1) {
		$map{$iface}{'nvlan'} = $1;
	    } else {
		$map{$iface}{'nvlan'} = 0;
	    }
	    next;
	}
	if ($line =~ /^Allowed VLANs: ([-,\d]+)$/) {
	    if ($map{$iface}{'trunk'} == 1) {
		my @ports = parsePortRange($1);
		if (@ports == 1 && $ports[0] == 0) {
		    warn "$id: misconfigured trunk $iface allows all VLANs!\n";
		}
		@{$map{$iface}{'vlans'}} = @ports;
	    }
	    next;
	}
    }

    $self->debug("$id: map table:\n".Dumper(%map)."\n",3);
    return %map;
}

#
# Put the given ports in the given VLAN. The VLAN is given as an 802.1Q 
# tag number, not the DB VLAN ID.
############################################################
# Semantics:
#
#   Port state:
#      access mode, vlan1 untagged:
#          add port to vlan_number untagged.
#      access mode, vlan_number untagged:
#	   do nothing
#      access mode, other vlan untagged:
#          add port to vlan_number untagged.
#      trunk mode, no access vlan, other tagged vlans:
#          add port to vlan_number tagged.
#      trunk mode, access vlan not vlan1, other tagged vlans:
#          add port to vlan_number tagged, if untagged vlan is vlan1, remove
#
# Mellanox 'free': switchportMode='access' AND vlan tag = 1
#
############################################################
#
# usage: setPortVlan($self, $vlan_number, @ports)
#     returns 0 on success.
#     returns the number of failed ports on failure.
#
sub setPortVlan($$@) {
    my $self = shift;
    my $vlan_number = shift;
    my @pcports = @_;
    my $id = $self->{NAME} . "::setPortVlan($vlan_number)";
    my $errors = 0;

    $self->debug("$id: entering\n");
    $self->debug("ports: " . Port->toStrings(@pcports). "\n");

    if (@pcports == 0) {
	return 0;
    }
    
    if ($vlan_number == 1) {
	warn "$id: ERROR: should not invoke with vlan1!\n";
	return scalar(@pcports);
    }

    # Make sure the vlan exists
    if (!$self->vlanNumberExists($vlan_number)) {
	warn "$id: ERROR: Could not find vlan $vlan_number\n";
	return scalar(@pcports);
    }

    my @ports = $self->convertPortFormat($PORT_FORMAT_NATIVE, @pcports);
    $self->debug("converted ports: " . Port->toStrings(@ports). "\n");

    $self->lock();

    my %pmap = $self->getPortInfo();
    foreach my $pstr (@ports) {
	#
	# Every port should be in some vlan, at least the default vlan1.
	# If not fail on that port.
	#
	if (!exists($pmap{$pstr}) || !exists($pmap{$pstr}{'vlans'})) {
	    warn "$id: ERROR: port $pstr not in a VLAN!?\n";
	    $errors++;
	    next;
	}

	my @vlans = @{$pmap{$pstr}{'vlans'}};

	#
	# If this vlan is already on the port, we are done.
	#
	if (grep {$_ == $vlan_number} @vlans) {
	    $self->debug("$id: $vlan_number is already on port $pstr\n",2);
	    next;
	}

	#
	# Port in access mode, change to the new vlan.
	# XXX sanity: don't allow change from the sacred vlan.
	#
	if ($pmap{$pstr}{'trunk'} == 0) {
	    $self->debug("$id: make $vlan_number access vlan for port $pstr\n",2);
	    if ($vlans[0] == $SACRED_VLAN) {
		warn "$id: Cannot change from VLAN $SACRED_VLAN on $pstr\n";
		next;
	    }
	    my $cmd = "conf t\nint $pstr\nswitchport access vlan $vlan_number\n";
	    # If taking out of vlan 1, we need to enable as well
	    if ($vlans[0] == 1) {
		$cmd .= "no shutdown\n";
	    }
	    $cmd .= "exit\nexit";
	    my ($rv, $info) = $self->doCLICmd($cmd);
	    if ($rv) {
		warn "$id: Could not set VLAN on $pstr: $info\n";
		next;
	    }
	}

	#
	# A trunk, add the port.
	#
	# XXX when we put a port in trunk mode, we explicitly put it in
	# vlan1 since otherwise the default is to allow all existing vlans.
	# So if this port was in just vlan1 before, remove that now.
	#
	# XXX note: no check for sacred vlan because switchs can carry both
	# management and experiment vlans.
	#
	else {
	    $self->debug("$id: add $vlan_number to trunk port $pstr\n",2);
	    my $cmd = "conf t\nint $pstr\nswitchport trunk allowed vlan add $vlan_number\nexit\nexit";
	    my ($rv, $info) = $self->doCLICmd($cmd);
	    if ($rv) {
		warn "$id: Could not set VLAN on $pstr: $info\n";
		next;
	    }

	    # If vlan 1 is on the trunk as a placeholder, remove it now
	    # This also indicates that we need to enable the port
	    if (@vlans == 1 && $vlans[0] == 1) {
		$self->debug("$id: remove VLAN 1 from trunk port $pstr\n",2);
		my $cmd = "conf t\nint $pstr\nswitchport trunk allowed vlan remove 1\nno shutdown\nexit\nexit";
		my ($rv, $info) = $self->doCLICmd($cmd);
		if ($rv) {
		    warn "$id: Could not set VLAN on $pstr: $info\n";
		    next;
		}
	    }
	}
    }

    $self->unlock();
    return $errors;
}


#
# Remove the given ports from the given VLAN. The VLAN is given as an 802.1Q 
# tag number.
#
# XXX This is actually an internal routine and is not called by snmpit or
# snmpit_stack.
#
# usage: delPortVlan($self, $vlan_number, @ports)
#	 returns 0 on success.
#	 returns the number of failed ports on failure.
#
sub delPortVlan($$@) {
    my $self = shift;
    my $vlan_number = shift;
    my @pcports = @_;
    my $id = $self->{NAME} . "::delPortVlan($vlan_number)";
    my $errors = 0;

    $self->debug("$id: entering\n");
    $self->debug("ports: " . Port->toStrings(@pcports) . "\n");

    if (@pcports == 0) {
	return 0;
    }

    if ($vlan_number == 1) {
	warn "$id: ERROR: should not invoke with vlan1!\n";
	return scalar(@pcports);
    }
    if ($vlan_number == $SACRED_VLAN) {
	warn "$id: ERROR: Cannot remove VLAN $SACRED_VLAN from any port!\n";
	return scalar(@pcports);
    }

    my @ports = $self->convertPortFormat($PORT_FORMAT_NATIVE, @pcports);

    $self->lock();

    my %pmap = $self->getPortInfo();
    foreach my $pstr (@ports) {
	#
	# Every port should be in at least vlan1, if not fail on that port.
	#
	if (!exists($pmap{$pstr}) || !exists($pmap{$pstr}{'vlans'})) {
	    warn "$id: ERROR: port $pstr not in a VLAN!?\n";
	    $errors++;
	    next;
	}
	my @vlans = @{$pmap{$pstr}{'vlans'}};

	#
	# If this vlan is not on the port, we are done.
	#
	if (!grep {$_ == $vlan_number} @vlans) {
	    $self->debug("$id: $vlan_number is not on port $pstr\n",2);
	    next;
	}

	#
	# Port in access mode, change port back to vlan1 and disable port
	#
	if ($pmap{$pstr}{'trunk'} == 0) {
	    $self->debug("$id: set access vlan to VLAN 1 for port $pstr\n",2);
	    my $cmd = "conf t\nint $pstr\nswitchport access vlan 1\nshutdown\nexit\nexit";
	    my ($rv, $info) = $self->doCLICmd($cmd);
	    if ($rv) {
		warn "$id: Could not disable or remove VLAN $vlan_number (set VLAN 1) on $pstr: $info\n";
		next;
	    }
	}

	#
	# A trunk, remove the VLAN.
	#
	# XXX when we remove the last vlan from a port, it falls back to
	# the default which is to allow all existing vlans over the port.
	# So if this port was in just vlan1 before, remove that now.
	#
	else {
	    $self->debug("$id: remove $vlan_number from trunk port $pstr\n",2);
	    my $cmd = "conf t\nint $pstr\nswitchport trunk allowed vlan remove $vlan_number\nexit\nexit";
	    my ($rv, $info) = $self->doCLICmd($cmd);
	    if ($rv) {
		warn "$id: Could not set VLAN on $pstr: $info\n";
		next;
	    }

	    # no other vlans, put back vlan 1
	    if (@vlans == 1) {
		$self->debug("$id: adding back VLAN 1 to trunk port $pstr\n",2);
		my $cmd = "conf t\nint $pstr\nswitchport trunk allowed vlan add 1\nexit\nexit";
		my ($rv, $info) = $self->doCLICmd($cmd);
		if ($rv) {
		    warn "$id: Could not add back VLAN 1 on $pstr: $info\n";
		    next;
		}
	    }
	}
    }

    $self->unlock();
    return $errors;
}

#
# Disables all ports in the given VLANS. Each VLAN is given as a VLAN
# 802.1Q tag value.
#
# usage: removePortsFromVlan(self,@vlan)
#     returns 0 on success.
#     returns the number of failed ports on failure.
#
sub removePortsFromVlan($@) {
    my $self = shift;
    my @vlan_numbers = @_;
    my $errors = 0;
    my $id = $self->{NAME} . "::removePortsFromVlan";

    if (@vlan_numbers == 0) {
	return 0;
    }

    # XXX sanity: don't do this list includes the sacred VLAN
    if (grep {$_ == $SACRED_VLAN} @vlan_numbers) {
	warn "$id: ERROR: Cannot remove vlan $SACRED_VLAN from any port\n";
	return 1;
    }

    # Get complete Port/Vlan info
    my %pmap = $self->getPortInfo();
    foreach my $pstr (keys %pmap) {
	my @vlans = @{$pmap{$pstr}{'vlans'}};

	# For an access port, see its access VLAN is on the list and remove it
	if ($pmap{$pstr}{'trunk'} == 0) {
	    my $avlan = $vlans[0];
	    if ($avlan != 1 && grep {$_ == $avlan} @vlan_numbers) {
		$self->debug("$id: disable and set access vlan to VLAN 1 for port $pstr\n",2);
		my $cmd = "conf t\nint $pstr\nswitchport access vlan 1\nshutdown\nexit\nexit";
		my ($rv, $info) = $self->doCLICmd($cmd);
		if ($rv) {
		    warn "$id: Could not disable and set access VLAN to 1 on $pstr: $info\n";
		    $errors++;
		    next;
		}
	    }
	}
	# For a trunk port remove all vlans from the list that are allowed
	else {
	    my @dvlans = ();
	    my $stillgotone = 0;
	    foreach my $avlan (@vlans) {
		if ($avlan != 1 && grep {$_ == $avlan} @vlan_numbers) {
		    push @dvlans, $avlan;
		} else {
		    $stillgotone = 1;
		}
	    }
	    if (@dvlans == 0) {
		$self->debug("$id: no vlans from set on trunk port $pstr\n",3);
		next;
	    }

	    my $vstr = join(',', @dvlans);
	    $self->debug("$id: remove vlans $vstr from trunk port $pstr\n",2);
	    my $cmd = "conf t\nint $pstr\nswitchport trunk allowed vlan remove $vstr\nexit\nexit";
	    my ($rv, $info) = $self->doCLICmd($cmd);
	    if ($rv) {
		warn "$id: Could not remove vlans in set from trunk port $pstr: $info\n";
		$errors++;
		next;
	    }

	    # no other vlans, put back vlan 1
	    if ($stillgotone == 0) {
		$self->debug("$id: adding back VLAN 1 to trunk port $pstr\n",2);
		my $cmd = "conf t\nint $pstr\nswitchport trunk allowed vlan add 1\nexit\nexit";
		my ($rv, $info) = $self->doCLICmd($cmd);
		if ($rv) {
		    warn "$id: Could not add back VLAN 1 on $pstr: $info\n";
		    $errors++;
		    next;
		}
	    }
	}
    }

    return $errors;
}

#
# Removes and disables some ports in a given VLAN.
# The VLAN is given as a VLAN 802.1Q tag value.
#
# This function is the same to delPortVlan because
# disconnect a connection will disable its two endports
# at the same time.
#
# usage: removeSomePortsFromVlan(self,vlan,@ports)
#     returns 0 on sucess.
#     returns the number of failed ports on failure.
#
sub removeSomePortsFromVlan($$@) {
    my ($self, $vlan_number, @ports) = @_;
    return $self->delPortVlan($vlan_number, @ports);
}

#
# Remove the given VLANs from this switch. The VLANs are given as 802.1Q
# VLAN tag numbers (so NOT as vlan_ids from the database!)
#
# usage: removeVlan(self,int vlan)
#	 returns 1 on success
#	 returns 0 on failure
#
sub removeVlan($@) {
    my $self = shift;
    my @vlan_numbers = @_;
    my $id = $self->{NAME} . "::removeVlan";
    my $errors = 0;

    $self->debug("$id: removing VLANs: @vlan_numbers\n");

    #
    # XXX removing a VLAN does not seem to remove it from all the ports.
    # What does it even mean to have a non-existent VLAN on a port!?
    # Anyway, it is what it is, so we first remove the VLANs from all
    # ports and then remove the vlan.
    #
    foreach my $vlan_id (@vlan_numbers) {
	if ($vlan_id == 1) {
	    warn "$id: WARNING: refusing to remove vlan 1!\n";
	    next;
	}
	# XXX we also won't remove the sacred vlan
	if ($vlan_id == $SACRED_VLAN) {
	    warn "$id: WARNING: refusing to remove vlan $SACRED_VLAN!\n";
	    next;
	}
        if ($self->removePortsFromVlan($vlan_id)) {
	    $self->debug("$id: removing ports from VLAN $vlan_id failed\n");
            $errors++;
	    next;
        }

	my $cmd = "conf t\nno vlan $vlan_id\nexit";
	my ($rt, $output) = $self->doCLICmd($cmd);
	if ($rt) {
	    warn("$id: ERROR: Removal of VLAN $vlan_id failed: $output\n");
	    $errors++;
	} else {
	    print "Removed VLAN $vlan_id on switch $self->{NAME}.\n";    
	}
    }

    return ($errors == 0) ? 1 : 0;
}


#
# Determine if a VLAN has any members 
# (Used by stack->switchesWithPortsInVlan())
#
sub vlanHasPorts($$) {
    my ($self, $vlan_number) = @_;
    my $id = $self->{NAME} . "::vlanHasPorts";

    my %pmap = $self->getPortInfo();
    foreach my $pstr (keys %pmap) {
	if (grep {$_ == $vlan_number} @{$pmap{$pstr}{'vlans'}}) {
	    return 1;
	}
    }
    return 0;
}


#
# List all VLANs on the device
#
# usage: listVlans($self)
#
# returns: A list of VLAN information. Each entry is an array reference. The
#	array is in the form [id, num, members] where:
#		id is the VLAN identifier, as stored in the database
#		num is the 802.1Q vlan tag number.
#		members is a reference to an array of VLAN members
#
sub listVlans($) {
    my $self = shift;
    my $id = $self->{NAME} . ":listVlans";
    my @list = ();
    
    # 
    # Get info for all vlans
    #
    my ($rv, $output) = $self->doCLICmd("show vlan brief");
    if ($rv) {
	warn("$id: Could not get VLAN list from switch: $output\n");
	return undef;
    }
    foreach my $line ( split /\n/, $output ) {
	if ($line =~ /^(\d+)\s+(\S+)(?:\s+(.+))?$/) {
	    my ($tag, $id, $pstr) = ($1, $2, $3);
	    my @swports = expandPortList($pstr);
	    my @pcports = $self->convertPortFormat($PORT_FORMAT_PORT, @swports);
	    push @list, [$id, $tag, \@pcports];
	}
    }
    return @list;
}

#
# List all ports on the device
#
# usage: listPorts($self)
# see snmpit_cisco_stack.pm for a description of return value format
#
sub listPorts($) {
    my $self = shift;
    my $id = $self->{NAME} . ":listPorts";
    my @ports = ();

    my $raw = $self->getRawOutput("show int * status");
    if (!defined($raw)) {
        warn "$id could not get port rawinfo *\n";
	return undef;
    }
    foreach my $line ( split /\n/, $raw ) {	
	my $port;
	my $iface;
	my $enabled;
	my $up     = "down";
	my $speed  = "???";
	my $duplex = "full";

	my @token = split('\s+', $line);

	# weed out lines that do not matter
	if (@token < 8) {
	    next;
	}
	if ($token[0] !~ /^\S*GigabitEthernet$/ ||
	    $token[1] !~ /^\d+\/\d+$/) {
	    next;
	}

	# First/second token are the interface name
	my $pstr = $token[0] . " " . $token[1];
	($port) = $self->convertPortFormat($PORT_FORMAT_PORT, $pstr);
	if (ref($port)) {
	    $port = $port->getOtherEndPort();
	} else {
	    warn "$id: Could not map to DB Port: '$pstr'\n";
	    next;
	}

	$enabled = $token[2];
	
	my $status = $token[7];
	if ($status =~ /^(\w+)fdx$/) {
	    $up = "up";
	    if ($1 eq "100") {
		$speed = 100;
	    } elsif ($1 eq "1G") {
		$speed = 1000;
	    } elsif ($1 eq "2.5G") {
		$speed = 2500;
	    } elsif ($1 eq "10G") {
		$speed = 10000;
	    }
	} elsif ($status eq "Down") {
	    $up = "down";
	}
#	$speed .= "Mbps";

	push(@ports, [$port, $enabled, $up, $speed, $duplex]);
    }
    return @ports;
}

# 
# Get statistics for ports on the switch
#
# Unsupported operation on Planet IGS-series switch via CLI.
#
# usage: getStats($self)
# see snmpit_cisco_stack.pm for a description of return value format
#
#
sub getStats() {
    my $self = shift;

    warn "Port statistics are unavaialble on our Planet switch.";
    return undef;
}


#
# Enable or disable VLANs on a trunk port.
#
# usage: setVlansOnTrunk(self, modport, value, vlan_numbers)
#        modport: module.port of the trunk to operate on
#        value: 0 to disallow the VLAN on the trunk, 1 to allow it
#	 vlan_numbers: An array of 802.1Q VLAN numbers to operate on
#        Returns 1 on success, 0 otherwise
#
sub setVlansOnTrunk($$$$) {
    my ($self, $modport, $value, @vlan_numbers) = @_;
    my $errors = 0;
    my $id = $self->{NAME} . "::setVlansOnTrunk";

    $self->debug("$id: entering, modport: $modport, value: $value, vlans: ".join(",",@vlan_numbers)."\n");

    #
    # Some error checking (from HP)
    #
    if (($value != 1) && ($value != 0)) {
	warn "$id: WARNING: Invalid value $value passed to function.\n";
	return 0;
    }
    if (grep(/^1$/,@vlan_numbers)) {
	warn "$id: WARNING: VLAN 1 passed to function.\n";
	return 0;
    }

    # Get complete Port/Vlan info
    my %pmap = $self->getPortInfo();

    my ($iface) = $self->convertPortFormat($PORT_FORMAT_NATIVE, $modport);
    if (!$iface) {
	warn "$id: WARNING: Could not get switch iface name for port $modport\n";
	return 0;
    }

    # Make sure the port is in trunk mode
    if (!exists($pmap{$iface}) || $pmap{$iface}{'trunk'} == 0) {
	warn "$id: $modport (switch iface $iface) is not a trunk port\n";
	return 0;
    }

    # Add or remove the vlan from the trunk on the port or portchannel.
    foreach my $vlan (@vlan_numbers) {
	next unless $self->vlanNumberExists($vlan);
	if ($value == 1) {
	    $errors += $self->setPortVlan($vlan, $iface);
	} else {
	    $errors += $self->delPortVlan($vlan, $iface);
	}
    }

    return $errors ? 0 : 1;
}

#
# Get the ifindex for an EtherChannel (trunk given as a list of ports)
# where "trunk" here means interswitch link.
#
# usage: getChannelIfIndex(self, ports)
#        Returns: undef if more than one port is given, and no channel is found
#           an ifindex if a channel is found and/or only one port is given
#
sub getChannelIfIndex($@) {
    my $self = shift;
    my @ports = @_;
    my $id = $self->{NAME}."::getChannelIfIndex";
    my $chifindex = undef;

    $self->debug("$id: entering\n",2);
    $self->debug("ports: " . Port->toStrings(@ports). "\n",2);

    #
    # @ports should contain just port channel names (e.g., "port-channel1")
    # so our job is easy.
    #
    my @swports = $self->convertPortFormat($PORT_FORMAT_NATIVE, @ports);
    if (@swports > 1) {
	warn "$id: ERROR did not expect more than one port: " .
	    join(' ', @swports) . "\n";
	return undef;
    }

    my $port = $swports[0];
    my %pmap = $self->getPortInfo();

    #
    # Just return the port channel index.
    #
    # XXX this is old cisco-ish behavior that snmpit_stack seems to expect
    # for interswitch links that are not port channels.
    #
    if ($pmap{$port}{'trunk'} == 1) {
	$chifindex = $self->native2Index($port);
	$self->debug("found regular port '$port', ifindex $chifindex\n",2);
    }
    else {
	warn "$id: ERROR unexpected non-port-channel, non-trunk port '$port'\n";
	return undef;
    }

    return $chifindex;
}

#
# Enable trunking on a port.
# Here we mean trunking in the "carries more than one vlan" sense.
#
# It is not clear whether we could be called on a port that is already in
# trunk mode and what should happen if it is (i.e., do we remove the existing
# set of ports?) So until we know otherwise, don't allow it.
#
# usage: enablePortTrunking2(self, modport, nativevlan, equaltrunking)
#        modport: module.port of the trunk to operate on
#        nativevlan: VLAN number of the native VLAN for this trunk
#	 equaltrunk: don't do dual mode; tag native VLAN also.
#
# Returns 1 on success, 0 otherwise
#
sub enablePortTrunking2($$$$) {
    my ($self,$port,$native_vlan,$equaltrunking) = @_;
    my $id = $self->{NAME} .
		"::enablePortTrunking2($port,$native_vlan,$equaltrunking)";

    $self->debug($id."\n");

    #
    # XXX only allow equal trunking for now, til we see if !equal is ever used
    #
    if (!$equaltrunking) {
	warn "$id: ERROR: Only handle equal trunking right now.\n";
	return 0;
    }

    # Get complete Port/Vlan info
    my %pmap = $self->getPortInfo();

    my ($iface) = $self->convertPortFormat($PORT_FORMAT_NATIVE, $port);
    if (!$iface) {
	warn "$id: WARNING: Could not get name for port $port\n";
	return 0;
    }

    #
    # Put it in trunk mode if not already and explicitly remove all vlans.
    #
    if (!$pmap{$iface}{'trunk'}) {
	# XXX sanity: don't do this if the port is in the sacred vlan
	if (grep {$_ == $SACRED_VLAN} @{$pmap{$iface}{'vlans'}}) {
	    warn "$id: ERROR: refusing to trunk $iface with vlan $SACRED_VLAN\n";
	    return 0;
	}

	my $cmd = "conf t\nint $iface\nswitchport mode trunk\nexit\nexit";
	my ($rv, $output) = $self->doCLICmd($cmd);
	if ($rv) {
	    warn("$id: Could not put iface $iface in trunk mode: $output\n");
	    return 0;
	}

	# explicitly remove allowed vlans, otherwise it would allow all vlans.
	# XXX optimize: combine with previous command
	$cmd = "conf t\nint $iface\nswitchport trunk allowed vlan none\nexit\nexit";
	($rv, $output) = $self->doCLICmd($cmd);
	if ($rv) {
	    warn("$id: WARNING: could not remove allowed vlans from iface $iface: $output\n");
	}
    }

    #
    # In equal trunking mode, add native vlan tagged to the trunk and remove
    # any access vlan.
    #
    # XXX if this fails, the port could be left in trunk mode where it was
    #     not previously.
    #
    if ($equaltrunking) {
	my $cmd = "conf t\nint $iface\nswitchport trunk allowed vlan add $native_vlan\nexit\nexit";
	my ($rv, $output) = $self->doCLICmd($cmd);
	if ($rv) {
	    warn("$id: Could not add native vlan to trunk: $output\n");
	    return 0;
	}

	$cmd = "conf t\nint $iface\nno switchport access vlan\nexit\nexit";
	($rv, $output) = $self->doCLICmd($cmd);
	if ($rv) {
	    warn("$id: WARNING: could not remove access vlan from trunk: $output\n");
	}
    }

    #
    # Otherwise add the specified native vlan as the access vlan
    # XXX we don't do dual mode right now.
    #
    else {
	;
    }

    return 1;
}

#
# Disable trunking on a port.
# Here we mean trunking in the "carries more than one vlan" sense.
#
# Apparently, when there is also an access VLAN, the port should be left in
# that VLAN. If there is no access VLAN, it should be put in vlan1.
# XXX I think this only applies to !equal trunking. Since we don't implement
# that, we always just set the access vlan to 1 when disabling trunking.
# 
# usage: disablePortTrunking(self, modport)
#        Returns 1 on success, 0 otherwise
#
# Planet notes:
# Make sure to "switchport trunk allowed vlans none"
#
sub disablePortTrunking($$) {
    my ($self,$port) = @_;
    my $id = $self->{NAME} .
		"::disablePortTrunking2($port)";

    $self->debug($id."\n");

    my ($iface) = $self->convertPortFormat($PORT_FORMAT_NATIVE, $port);
    if (!$iface) {
	warn "$id: WARNING: Could not get iface for port $port\n";
	return 0;
    }

    # Get complete Port/Vlan info
    my %pmap = $self->getPortInfo();

    # If not a trunk port, nothing to do
    if ($pmap{$iface}{'trunk'} == 0) {
	warn "$id: WARNING: port is not in Trunk mode, doing nothing.\n";
	return 1;
    }

    # XXX sanity: don't do this if trunk includes the sacred VLAN
    if (grep {$_ == $SACRED_VLAN} @{$pmap{$iface}{'vlans'}}) {
	warn "$id: ERROR: refusing to untrunk $iface with vlan $SACRED_VLAN\n";
	return 0;
    }

    # XXX for now revert it to vlan 1 for access vlan.
    # This may change some day if we do non-equal trunking.
    my $avlan = 1;

    # Remove from trunk mode
    my $cmd = "conf t\nint $iface\nswitchport mode access\nexit\nexit";
    my ($rv, $output) = $self->doCLICmd($cmd);
    if ($rv) {
	warn("$id: Could not remove iface $iface from trunk mode: $output\n");
	return 0;
    }

    # Clear allowed trunk vlans
    $cmd = "conf t\nint $iface\nswitchport trunk allowed vlan none\nexit\nexit";
    ($rv, $output) = $self->doCLICmd($cmd);
    if ($rv) {
	warn("$id: WARNING: could not remove allowed vlans from iface $iface: $output\n");
    }

    # Revert to access mode, if vlan 1 then shutdown the port as well
    $cmd = "conf t\nint $iface\nswitchport access vlan $avlan\n";
    if ($avlan == 1) {
	$cmd .= "shutdown\n";
    }
    $cmd .= "exit\nexit";
    ($rv, $output) = $self->doCLICmd($cmd);
    if ($rv) {
	warn("$id: WARNING: could not set access vlan to $avlan for iface $iface: $output\n");
    }

    return 1;
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
    my $token = "snmpit_" . $self->{NAME};
    if ($lock_held == 0) {
        my $old_umask = umask(0);
        die if (TBScriptLock($token,0,1800) != TBSCRIPTLOCK_OKAY());
        umask($old_umask);
    }
    $lock_held = 1;
}

sub unlock($) {
    if ($lock_held == 1) { TBScriptUnlock();}
    $lock_held = 0;
}


#
# Enable Openflow
#
sub enableOpenflow($$) {
    warn "ERROR: Planet switch doesn't support Openflow now";
    return 0;
}

#
# Disable Openflow
#
sub disableOpenflow($$) {
    warn "ERROR: Planet switch doesn't support Openflow now";
    return 0;
}

#
# Set controller
#
sub setOpenflowController($$$) {
    warn "ERROR: Planet switch doesn't support Openflow now";
    return 0;
}

#
# Set listener
#
sub setOpenflowListener($$$) {
    warn "ERROR: Planet switch doesn't support Openflow now";
    return 0;
}

#
# Get used listener ports
#
sub getUsedOpenflowListenerPorts($) {
    my %ports = ();

    warn "ERROR: Planet switch doesn't support Openflow now";
    return %ports;
}


#
# Check if Openflow is supported on this switch
#
sub isOpenflowSupported($) {
    return 0;
}


#
# Print warning messages for empty VLANs that will be deleted 
# after unloading the package.
#
END 
{

}

# End with true
1;
