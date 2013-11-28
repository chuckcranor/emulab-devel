#!/usr/bin/perl -wT
#
# Copyright (c) 2013 University of Utah and the Flux Group.
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
# Support functions for the libvnode API and also for bscontrol which is
# a proxy for the blockstore server control program on boss.
#

package libfreenas;
use Exporter;
@ISA    = "Exporter";
@EXPORT = qw( 
              freenasPoolList
              freenasVolumeList
	      freenasVolumeCreate
	      freenasVolumeDestroy
	    );

use strict;
use English;
use Data::Dumper;
use Socket;
use File::Basename;
use File::Path;
use File::Copy;

# Pull in libvnode and other Emulab stuff
BEGIN { require "/etc/emulab/paths.pm"; import emulabpaths; }
use libutil;
use libtestbed;
use libsetup;

#
# Constants
#
my $GLOBAL_CONF_LOCK     = "blkconf";
my $ZPOOL_CMD            = "/sbin/zpool";
my $ZFS_CMD              = "/sbin/zfs";
my $ZPOOL_STATUS_UNKNOWN = "unknown";
my $ZPOOL_STATUS_ONLINE  = "online";
my $ZPOOL_LOW_WATERMARK  = 2 * 2**10; # 2GiB, expressed in MiB
my $FREENAS_MNT_PREFIX   = "/mnt";
my $ISCSI_GLOBAL_PORTAL  = 1;
my $SER_PREFIX           = "d0d0";
my $VLAN_IFACE_PREFIX    = "vlan";
my $MAX_RETRY_COUNT      = 5;
my $SLICE_BUSY_WAIT      = 10;
my $SLICE_GONE_WAIT      = 5;
my $IFCONFIG             = "/sbin/ifconfig";
my $ALIASMASK            = "255.255.255.255";

# storageconfig constants
# XXX: should go somewhere more general
my $BS_CLASS_SAN         = "SAN";
my $BS_PROTO_ISCSI       = "iSCSI";
my $BS_UUID_TYPE_IQN     = "iqn";

# CLI stuff
my $FREENAS_CLI          = "$BINDIR/freenas-config";
my $CLI_VERB_IFACE       = "interface";
my $CLI_VERB_IST_EXTENT  = "ist_extent";
my $CLI_VERB_IST_AUTHI   = "ist_authinit";
my $CLI_VERB_IST_TARGET  = "ist";
my $CLI_VERB_IST_ASSOC   = "ist_assoc";
my $CLI_VERB_VLAN        = "vlan";
my $CLI_VERB_VOLUME      = "volume";
my $CLI_VERB_POOL        = "pool";

my %cliverbs = (
    $CLI_VERB_IFACE      => 1,
    $CLI_VERB_IST_EXTENT => 1,
    $CLI_VERB_IST_AUTHI  => 1,
    $CLI_VERB_IST_TARGET => 1,
    $CLI_VERB_IST_ASSOC  => 1,
    $CLI_VERB_VLAN       => 1,
    $CLI_VERB_VOLUME     => 1,
    $CLI_VERB_POOL       => 1,
    );

#
# Global variables
#
my $debug  = 0;

sub freenasPoolList();
sub freenasVolumeList();
sub freenasVolumeCreate($$$);
sub freenasVolumeDestroy($$);

#
# Local Functions
#
sub parseFreeNASListing($);
sub runFreeNASCmd($$);
sub getSliceList();
sub parseSliceName($);
sub parseSlicePath($);
sub calcSliceSizes($);
sub getIfConfig($);
sub getVlan($);
sub getNextAuthITag();
sub genSerial();
sub findAuthITag($);
sub createVlanInterface($$);
sub removeVlanInterface($$);
sub setupIPAlias($;$);
sub runBlockstoreCmds($$$);
sub listPool();
sub allocSlice($$$$);
sub exportSlice($$$$);
sub deallocSlice($$$$);
sub unexportSlice($$$$);

# Dispatch table for storage configuration commands.
my %setup_cmds = (
    "SLICE"  => \&allocSlice,
    "EXPORT" => \&exportSlice
);

my %teardown_cmds = (
    "SLICE"  => \&deallocSlice,
    "EXPORT" => \&unexportSlice
);

#
# Turn off line buffering on output
#
$| = 1;

sub setDebug($)
{
    $debug = shift;
    print "libfreenas: debug=$debug\n"
	if ($debug);
}

sub freenasVolumeList()
{
    my $vollist = {};

    #
    # Extract blockstores from the freenas volume info and augment
    # with slice info where it exists.
    # 
    my @slist = parseFreeNASListing($CLI_VERB_IST_EXTENT);
    my %inames = ();
    foreach my $slice (@slist) {
	if ($slice->{'path'} =~ /^zvol\/([-\w]+\/[-\w+]+)$/) {
	    $inames{$1} = $slice->{'name'};
	}
    }

    my @zvols = parseFreeNASListing($CLI_VERB_VOLUME);
    foreach my $zvol (@zvols) {
	my $vol = {};
	if ($zvol->{'vol_name'} =~ /^([-\w]+)\/([-\w+]+)$/) {
	    $vol->{'pool'} = $1;
	    $vol->{'volume'} = $2;
	    $vol->{'size'} = convertToMebi($zvol->{'vol_size'});
	    if (exists($inames{$zvol->{'vol_name'}})) {
		$vol->{'iname'} = $inames{$zvol->{'vol_name'}};
	    }
	    $vollist->{$vol->{'volume'}} = $vol;
	}
    }

    return $vollist;
}

sub freenasPoolList() {
    return listPool();
}

sub freenasVolumeCreate($$$)
{
    my ($pool, $volname, $size) = @_;
    my $sconf = { "BSID" => $pool, "VOLSIZE" => $size };
    my $priv = {};
    return allocSlice($volname, $sconf, undef, $priv);
}

sub freenasVolumeDestroy($$)
{
    my ($pool, $volname) = @_;
    my $sconf = { "BSID" => $pool };
    my $priv = {};
    return deallocSlice($volname, $sconf, undef, $priv);
}

#######################################################################
# package-local functions
#

#
# Run a FreeNAS CLI command, checking for a return error and other
# such things.  We check that the incoming verb is valid.  Command line
# argument string needs to be untainted or this will fail.
#
# Throws exceptions (dies), passing along errors in $@.
#
sub runFreeNASCmd($$) {
    my ($verb, $argstr) = @_;

    my $errstate = 0;
    my $message;

    die "Invalid FreeNAS CLI verb: $verb"
	unless exists($cliverbs{$verb});

    print "DEBUG: blockstore_runFreeNASCmd:\n".
	"\trunning: $verb $argstr\n" if $debug;

    my $output = `$FREENAS_CLI $verb $argstr 2>&1`;

    if ($? != 0) {
	$errstate = 1;
	$output =~ /^(.+Error: .+)$/;
	$message = defined($1) ? $1 : "Error code: $?";
    } elsif ($output =~ /"error": true/) {
	$errstate = 1;
	$output =~ /"message": "([^"]+)"/;
	$message = $1;
    }

    if ($errstate) {
	print STDERR $output if $debug;
	die $message;
    }

    return 0;
}

# Run our custom FreeNAS CLI to extract info.  
#
# Returns an array of hash references.  Each hash contains info from
# one line of output.  The hash keys are the field names from the
# header (first line of output).  The hash values are the
# corresponding pieces of data at each field location in a line.
sub parseFreeNASListing($) {
    my $verb = shift;
    my @retlist = ();

    # XXX: should check that a valid verb was passed in.

    open(CLI, "$FREENAS_CLI $verb list |") or
	die "Can't run FreeNAS CLI: $!";

    my $header = <CLI>;

    return @retlist
	if !defined($header) or !$header;

    chomp $header;
    my @fields = split(/\t/, $header);

    while (my $line = <CLI>) {
	chomp $line;
	my @lparts = split(/\t/, $line);
	if (scalar(@lparts) != scalar(@fields)) {
	    warn("*** WARNING: blockstore_parseFreeNASListing: ".
		 "Bad output from CLI ($verb): $line");
	    next;
	}
	my %lineh = ();
	for (my $i = 0; $i < scalar(@fields); $i++) {
	    $lineh{$fields[$i]} = $lparts[$i];
	}
	push @retlist, \%lineh;
    }
    close(CLI);
    return @retlist;
}

#
# Run through list of storage commands and execute them, checking
# for errors.  (Should have a lock before doing this.)
#
sub runBlockstoreCmds($$$) {
    my ($vnode_id, $vnconfig, $private) = @_;
    my $sconfigs = $vnconfig->{'storageconfig'};
    
    foreach my $sconf (@$sconfigs) {
	my $cmd = $sconf->{'CMD'};
	if (exists($setup_cmds{$cmd})) {
	    if ($setup_cmds{$cmd}->($vnode_id, $sconf, 
				    $vnconfig, $private) != 0) {
		warn("*** ERROR: blockstore_runBlockstoreCmds: ".
		     "Failed to execute setup command: $cmd");
		return -1;
	    }
	} else {
	    warn("*** ERROR: blockstore_runBlockstoreCmds: ".
		 "Don't know how to execute: $cmd");
	    return -1;
	}
    }

    return 0;
}

# Yank information about blockstore slices out of FreeNAS.
# Note: this is an expensive call - may want to re-visit caching some of
# this later if performance becomes a problem.
sub getSliceList() {
    my $sliceshash = {};

    # Grab list of slices (iscsi extents) from FreeNAS
    my @slist = parseFreeNASListing($CLI_VERB_IST_EXTENT);

    # Just return if there are no slices.
    return if !@slist;

    # Go through each slice hash, culling out extra info.
    # Save hash in global list.  Throw out malformed stuff.
    foreach my $slice (@slist) {
	my ($pid,$eid,$volname) = parseSliceName($slice->{'name'});
	my ($bsid, $vnode_id) = parseSlicePath($slice->{'path'});
	if (!defined($pid) || !defined($bsid)) {
	    warn("*** WARNING: blockstore_getSliceList: ".
		 "malformed slice entry, skipping.");
	    next;
	}
	$slice->{'pid'} = $pid;
	$slice->{'eid'} = $eid;
	$slice->{'volname'} = $volname;
	$slice->{'bsid'} = $bsid;
	$slice->{'vnode_id'} = $vnode_id;
	$sliceshash->{$vnode_id} = $slice;
    }

    # Do the messy work of getting slice size info into mebibytes.
    calcSliceSizes($sliceshash);

    return $sliceshash;
}

# helper function.
# Slice names look like: 'iqn.<date>.<tld>.<domain>:<pid>:<eid>:<volname>'
sub parseSliceName($) {
    my $name = shift;
    my @parts = split(/:/, $name);
    if (scalar(@parts) != 4) {
	warn("*** WARNING: blockstore_parseSliceName: Bad slice name: $name");
	return undef;
    }
    shift @parts;
    return @parts;
}

# helper function.
# Paths look like this: '/mnt/<blockstore_id>/<vnode_id>' for file-based
# extent (slice), and 'zvol/<blockstore_id>/<vnode_id>' for zvol extents.
sub parseSlicePath($) {
    my $path = shift;

    my @parts = split(/\//, $path);
    shift @parts
	if (scalar(@parts) == 4 && !$parts[0]); # chomp leading slash part
    if (scalar(@parts) != 3 ||  $parts[0] !~ /^(mnt|zvol)$/i) {
	warn("*** WARNING: blockstore_parseSlicePath: ".
	     "malformed slice path: $path");
	return undef;
    }
    shift @parts;
    return @parts;
}

sub calcSliceSizes($) {
    my $sliceshash = shift;

    my @zvols = parseFreeNASListing($CLI_VERB_VOLUME);

    # Ugh... Have to look up size via the "volume" list for
    # zvol slices.
    foreach my $slice (values(%$sliceshash)) {
	my $bsid    = $slice->{'bsid'};
	my $vnode_id = $slice->{'vnode_id'};
	my $type    = lc($slice->{'type'});

	my $size = undef;

	if ($type eq "zvol") {
	    foreach my $zvol (@zvols) {
		#print STDERR "DEBUG: volume: ". $zvol->{'vol_name'} ."\n";
		if ($zvol->{'vol_name'} eq "$bsid/$vnode_id") {
		    $size = $zvol->{'vol_size'};
		    last;
		}
	    }
	    if (!defined($size)) {
		warn("*** WARNING: blockstore_calcSliceList: ".
		     "Could not find matching volume entry for ".
		     "zvol slice: $slice->{'name'}");
		next;
	    }
	    $size .= "B"; # Fix up units (value is \d{1,3}[TGM]).
	} elsif ($type eq "file") {
	    $size = $slice->{'filesize'};
	    $size =~ s/B$/iB/; # re-write with correct units.
	}
	$slice->{'size'} = convertToMebi($size);
    }
    return;
}

#
# Return information on all of the volume pools available on this host.
# Note: to get exact sizes, we may want to execute our own zfs command, e.g:
#
#   zfs get -Hp available,used rz-1
#
# where "rz-1" is the "root" of the pool. We need to use zfs because zpool
# doesn't have a '-p' option.
#
sub listPool() {
    my $poolh = {};
    my @pools = parseFreeNASListing($CLI_VERB_POOL);
    
    # Create hash with pool name as key.  Stuff in some sentinel values
    # in case we don't get a match from 'zpool list' below.
    foreach my $pool (@pools) {
	$pool->{'size'} = 0;
	$pool->{'avail'} = 0;
	$poolh->{$pool->{'volume_name'}} = $pool;
    }

    # Yuck - have to go after capacity and status info by calling the
    # 'zfs' command line utility since the CLI doesn't return this info.
    open(ZFS, "$ZFS_CMD list -H -o name,used,avail |") or
	die "Can't run 'zfs list'!";

    while (my $line = <ZFS>) {
	chomp $line;
	my ($pname, $pused, $pavail) = split(/\s+/, $line);
	next if $pname =~ /\//;  # filter out zvols.
	if (exists($poolh->{$pname})) {
	    my $pool = $poolh->{$pname};
	    $pused  = convertToMebi($pused);
	    $pavail = convertToMebi($pavail);
	    $pool->{'size'}  = $pused + $pavail;
	    $pool->{'avail'} = $pavail;
	} else {
	    warn("*** WARNING: blockstore_getPoolInfo: ".
		 "No FreeNAS entry for zpool: $pname");
	}
    }

    return $poolh;
}

# Allocate a slice based on information from Emulab Central
# XXX: Do 'sliceconfig' parameter checking.
sub allocSlice($$$$) {
    my ($vnode_id, $sconf, $vnconfig, $priv) = @_;

    my $pools  = listPool();

    # Does the requested pool exist?
    my $bsid = untaintHostname($sconf->{'BSID'});
    my $destpool;
    if (exists($pools->{$bsid})) {
	$destpool = $pools->{$bsid};
	$priv->{'bsid'} = $bsid; # save for future calls.
    } else {
	warn("*** ERROR: blockstore_allocSlice: ".
	     "Requested pool not found: $bsid!");
	return -1;
    }

    # Is there enough space on the requested blockstore?  If not, there is
    # a discrepancy between reality and the Emulab database.
    my $size = untaintNumber($sconf->{'VOLSIZE'});
    if ($size + $ZPOOL_LOW_WATERMARK > $destpool->{'avail'}) {
	warn("*** ERROR: blockstore_allocSlice: ". 
	     "Not enough space remaining in requested pool: $bsid");
	return -1;
    }

    # Allocate slice in zpool
    # XXX: check on size conversion.
    eval { runFreeNASCmd($CLI_VERB_VOLUME, 
			 "add $bsid $vnode_id ${size}MB off") };
    if ($@) {
	warn("*** ERROR: blockstore_allocSlice: ".
	     "slice allocation failed: $@");
	return -1;
    }

    return 0;
}

# Setup device export.
sub exportSlice($$$$) {
    my ($vnode_id, $sconf, $vnconfig, $priv) = @_;

    # Should only be one ifconfig entry - checked earlier.
    my $ifcfg   = (@{$vnconfig->{'ifconfig'}})[0];
    my $nmask   = $ifcfg->{'IPMASK'};
    my $cmask   = libutil::CIDRmask($nmask);
    my $network = libutil::ipToNetwork($ifcfg->{'IPADDR'}, $nmask);
    if (!$cmask || !$network) {
	warn("*** ERROR: blockstore_exportSlice: ".
	     "Error calculating ip network information.");
	return -1;
    }
    
    # Extract bsid as stashed away in prior setup.
    if (!exists($priv->{'bsid'})) {
	$priv->{'bsid'} = untaintHostname($sconf->{'BSID'});
    }
    my $bsid = $priv->{'bsid'};
    if (!defined($bsid)) {
	warn("*** ERROR: blockstore_exportSlice: ".
	     "blockstore ID not found!");
	return -1;
    }

    # Scrub request - we only support SAN/iSCSI at this point.
    if (!exists($sconf->{'CLASS'}) || $sconf->{'CLASS'} ne $BS_CLASS_SAN) {
	warn("*** ERROR: blockstore_exportSlice: ".
	     "invalid or missing blockstore class!");
	return -1;
    }

    if (!exists($sconf->{'PROTO'}) || $sconf->{'PROTO'} ne $BS_PROTO_ISCSI) {
	warn("*** ERROR: blockstore_exportSlice: ".
	     "invalid or missing blockstore protocol!");
	return -1;
    }

    if (!exists($sconf->{'VOLNAME'})) {
	warn("*** ERROR: blockstore_exportSlice: ".
	     "missing volume name!");
	return -1;
    }
    my $volname = $sconf->{'VOLNAME'};

    if (!exists($sconf->{'UUID'}) || 
	!exists($sconf->{'UUID_TYPE'}) ||
	$sconf->{'UUID_TYPE'} ne $BS_UUID_TYPE_IQN)
    {
	warn("*** ERROR: blockstore_exportSlice: ".
	     "bad UUID information!");
	return -1;
    }
    if ($sconf->{'UUID'} !~ /^([-\.:\w]+)$/) {
	warn("*** ERROR: blockstore_exportSlice: ".
	     "bad characters in UUID!");
	return -1;
    }
    my $iqn = $1; # untaint.

    # Create iSCSI extent
    eval { runFreeNASCmd($CLI_VERB_IST_EXTENT, 
			 "add $iqn $bsid/$vnode_id") };
    if ($@) {
	warn("*** ERROR: blockstore_exportSlice: ".
	     "Failed to create iSCSI extent: $@");
	return -1;
    }

    # Create iSCSI auth group
    my $tag = getNextAuthITag();
    if ($tag !~ /^(\d+)$/) {
	warn("*** ERROR: blockstore_exportSlice: ".
	     "bad tag returned from getNextAuthITag: $tag");
	return -1;
    }
    $tag = $1; # untaint.
    eval { runFreeNASCmd($CLI_VERB_IST_AUTHI,
			 "add $tag ALL $network/$cmask $vnode_id") };
    if ($@) {
	warn("*** ERROR: blockstore_exportSlice: ".
	     "Failed to create iSCSI auth group: $@");
	return -1;
    }

    # Create iSCSI target
    my $serial = genSerial();
    eval { runFreeNASCmd($CLI_VERB_IST_TARGET,
		      "add $iqn $serial $ISCSI_GLOBAL_PORTAL ".
			 "$tag Auto -1") };
    if ($@) {
	warn("*** ERROR: blockstore_exportSlice: ".
	     "Failed to create iSCSI target: $@");
	return -1;
    }

    # Bind iSCSI target to slice (extent)
    eval { runFreeNASCmd($CLI_VERB_IST_ASSOC,
			 "add $iqn $iqn") };
    if ($@) {
	warn("*** ERROR: blockstore_exportSlice: ".
	     "Failed to associate iSCSI target with extent: $@");
	return -1;
    }

    # All setup and exported!
    return 0;
}

# Helper function.
# Locate and return tag for given network, if it exists.
sub findAuthITag($) {
    my ($vnode_id,) = @_;

    return undef
	if !defined($vnode_id);

    my @authentries = parseFreeNASListing($CLI_VERB_IST_AUTHI);

    return undef
	if !@authentries;

    foreach my $authent (@authentries) {
	if ($authent->{'comment'} eq $vnode_id) {
	    return $authent->{'tag'};
	}
    }

    return undef;
}

# Helper function.
# Locate and return next unused tag ID for iSCSI initiator groups.
sub getNextAuthITag() {
    my @authentries = parseFreeNASListing($CLI_VERB_IST_AUTHI);

    my $maxtag = 1;

    return $maxtag
	if !@authentries;

    foreach my $authent (@authentries) {
	my $curtag = $authent->{'tag'};
	next if !defined($curtag) || $curtag !~ /^\d+$/;
	$maxtag = $curtag > $maxtag ? $curtag : $maxtag;
    }

    return $maxtag+1;
}

# Helper function - Generate a random serial number for an iSCSI target
sub genSerial() {
    my $rand_hex = join "", map { unpack "H*", chr(rand(256)) } 1..6;
    return $SER_PREFIX . $rand_hex;
}

# Helper function - get the _single_ ifconfig line passed in via tmcd.
# If there is more than one, then there is a problem.
sub getIfConfig($) {
    my ($vnconfig,) = @_;

    my $ifconfigs = $vnconfig->{'ifconfig'};
    
    if (@$ifconfigs != 1) {
	warn("*** ERROR: blockstore_getIfConfig: ".
	     "Wrong number of network interfaces.  There can be only one!");
	return undef;
    }

    my $ifc = @$ifconfigs[0];

    if ($ifc->{'ITYPE'} ne "vlan") {
	warn("*** ERROR: blockstore_getIfConfig: ".
	     "Interface must be of type 'vlan'!");
	return undef;
    }

    return $ifc;
}

# Helper function - search output of FreeNAS vlan CLI command for the
# presence of the vlan name passed in.  Return what is found.
sub getVlan($) {
    my ($vtag,) = @_;

    return undef
	if (!defined($vtag) || $vtag !~ /^(\d+)$/);

    my @vlans = parseFreeNASListing($CLI_VERB_VLAN);

    my $retval = undef;
    foreach my $vlan (@vlans) {
	if ($vtag == $vlan->{'tag'}) {
	    $retval = $vlan;
	    last;
	}
    }
    
    return $retval;
}

sub addressExists($) {
    my ($iface,) = @_;
    my $retval = 0;
    
    my $ifc_out = `$IFCONFIG $iface`;
    if ($? != 0) {
	warn("*** ERROR: blockstore_addressExists: ".
	     "Problem running ifconfig: $?");
	$retval = undef;
    } elsif ($ifc_out =~ /inet \d+\.\d+\.\d+\.\d+/) {
	$retval = 1;
    } 

    return $retval;
}

#
# Make a vlan interface for this node (tagged, vlan).
#
sub createVlanInterface($$) {
    my ($vnode_id, $vnconfig) = @_;

    my $ifc    = getIfConfig($vnconfig);
    if (!defined($ifc)) {
	warn("*** ERROR: blockstore_createVlanInterface: ".
	     "No valid interface record found!");
	return -1;
    }

    my $vtag   = $ifc->{'VTAG'};
    my $pmac   = $ifc->{'PMAC'};
    my $piface = $ifc->{'IFACE'};
    my $lname  = $ifc->{'LAN'};

    my $viface = $VLAN_IFACE_PREFIX . $vtag;

    # Untaint stuff.
    if ($piface !~ /^([-\w]+)$/) {
	warn("*** ERROR: blockstore_createVlanInterface: ". 
	     "bad data physical interface name!");
	return -1;
    }
    $piface = $1;

    if ($pmac !~ /^([a-fA-F0-9:]+)$/) {
	warn("*** ERROR: blockstore_createVlanInterface: ". 
	     "bad data in physical mac address!");
	return -1;
    }
    $pmac = $1;

    if ($vtag !~ /^(\d+)$/) {
	warn("*** ERROR: blockstore_createVlanInterface: ". 
	     "bad data in vlan tag!");
	return -1;
    }
    $vtag = $1;

    # see if vlan already exists.  do sanity checks to make sure this
    # is the correct vlan for this interface, and then create it.
    my $vlan = getVlan($vtag);
    if ($vlan) {
	my $vlabel = $vlan->{'description'};
	# This is not a fool-proof consistency check, but the odds of
	# having an existing vlan with the same LAN name and vlan tag
	# as one in a different experiment are vanishingly small.
	if ($vlabel ne $lname) {
	    warn("*** ERROR: blockstore_createVlanInterface: ".
		 "Mismatched vlan: $lname != $vlabel");
	    return -1;
	}
    }
    # vlan does not exist.
    else {
	# Create the vlan entry in FreeNAS.
	eval { runFreeNASCmd($CLI_VERB_VLAN,
			     "add $piface $viface $vtag $lname") };
	if ($@) {
	    warn("*** ERROR: blockstore_createVlanInterface: ". 
		 "failure while creating vlan interface: $@");
	    return -1;
	}

	# Create the vlan interface.
	eval { runFreeNASCmd($CLI_VERB_IFACE,
			     "add $viface $lname") };
	if ($@) {
	    warn("*** ERROR: blockstore_createVlanInterface: ".
		 "failure while setting vlan interface parameters: $@");
	    return -1;
	}
    }

    # All done.
    return 0;
}

# Create (or remove) the ephemeral IP alias for this blockstore.
sub setupIPAlias($;$) {
    my ($vnconfig, $teardown) = @_;

    my $ifc    = getIfConfig($vnconfig);
    if (!defined($ifc)) {
	warn("*** ERROR: blockstore_createVlanInterface: ".
	     "No valid interface record found!");
	return -1;
    }

    my $vtag   = $ifc->{'VTAG'};
    my $ip     = $ifc->{'IPADDR'};
    my $qmask  = $ifc->{'IPMASK'};

    my $viface = $VLAN_IFACE_PREFIX . $vtag;

    if ($ip !~ /^([\.\d]+)$/) {
	warn("*** ERROR: blockstore_createVlanInterface: ". 
	     "bad data in IP address!");
	return -1;
    }
    $ip = $1;

    if ($qmask !~ /^([\.\d]+)$/) {
	warn("*** ERROR: blockstore_createVlanInterface: ". 
	     "bad characters in subnet!");
	return -1;
    }
    # If this is the first blockstore on the lan, then use the real netmask,
    # otherwise this is yet another alias on the same interface, so use the
    # all 1's mask.
    $qmask = addressExists($viface) ? $ALIASMASK : $1;

    if ($teardown) {
	if (system("$IFCONFIG $viface -alias $ip") != 0) {
	    warn("*** ERROR: blockstore_createVlanInterface: ".
		 "ifconfig failed while setting IP alias parameters: $?");
	}
    } else {
	# Add an alias for this psuedo-VM.  Have to do this underneath FreeNAS
	# because it makes adding and removing them ridiculously impractical.
	if (system("$IFCONFIG $viface alias $ip netmask $qmask") != 0) {
	    warn("*** ERROR: blockstore_createVlanInterface: ".
		 "ifconfig failed while clearing IP alias parameters: $?");
	}
    }

    return 0;
}

#
# Remove previously created VLAN interface.  Will only actually do
# something if all IP aliases have been removed.  I.e., the last
# pseudo-VM in the vlan on this blockstore host that passes through
# here will result in interface removal.
#
sub removeVlanInterface($$) {
    my ($vnode_id, $vnconfig) = @_;

    # Fetch the interface record for this pseudo-VM
    my $ifc    = getIfConfig($vnconfig);
    if (!defined($ifc)) {
	warn("*** ERROR: blockstore_removeVlanInterface: ".
	     "No valid interface record found!");
	return -1;
    }

    my $vtag   = $ifc->{'VTAG'};
    my $viface = $VLAN_IFACE_PREFIX . $vtag;

    # Does FreeNAS have record of this vlan?  If not, it's probably safe
    # to assume the interface isn't there, so there is nothing to do here.
    if (!getVlan($vtag)) {
	warn("*** WARNING: blockstore_removeVlanInterface: ".
	     "Vlan entry does not exist...");
	return 0;
    }

    if (!addressExists($viface)) {
	# No more addresses: Delete the vlan interface.
	eval { runFreeNASCmd($CLI_VERB_VLAN,
			     "del $viface") };
	if ($@) {
	    warn("*** ERROR: blockstore_removeVlanInterface: ".
		 "failure while removing vlan interface: $@");
	}
    }

    return 0;
}

sub unexportSlice($$$$) {
    my ($vnode_id, $sconf, $vnconfig, $priv) = @_;

    # All of the sanity checking was done when we first created and
    # exported this blockstore.  Assume nothing has changed...
    my $volname = $sconf->{'VOLNAME'};
    $sconf->{'UUID'} =~ /^([-\.:\w]+)$/;
    my $iqn = $1; # untaint.

    # Remove iSCSI target.  This will also zap the target-to-extent
    # association.
    eval { runFreeNASCmd($CLI_VERB_IST_TARGET,
			 "del $iqn") };
    if ($@) {
	warn("*** WARNING: blockstore_unexportSlice: ".
	     "Failed to remove iSCSI target: $@");
    }

    # Remove iSCSI auth group
    my $tag = findAuthITag($vnode_id);
    if ($tag && $tag =~ /^(\d+)$/) {
	$tag = $1; # untaint.
	eval { runFreeNASCmd($CLI_VERB_IST_AUTHI,
			     "del $tag") };
	if ($@) {
	    warn("*** WARNING: blockstore_unexportSlice: ".
		 "Failed to remove iSCSI auth group: $@");
	}
    }

    # Remove iSCSI extent.
    eval { runFreeNASCmd($CLI_VERB_IST_EXTENT, 
			 "del $iqn") };
    if ($@) {
	warn("*** WARNING: blockstore_unexportSlice: ".
	     "Failed to remove iSCSI extent: $@");
    }

    # All torn down and unexported!
    return 0;
}

sub deallocSlice($$$$) {
    my ($vnode_id, $sconf, $vnconfig, $priv) = @_;
    my $bsid = $sconf->{'BSID'};

    # Deallocate slice.  Wrap in loop to enable retries.
    my $count;
    for ($count = 1; $count <= $MAX_RETRY_COUNT; $count++) {
	eval { runFreeNASCmd($CLI_VERB_VOLUME, 
			     "del $bsid $vnode_id") };
	# Process exceptions thrown during deletion attempt.  Retry on
	# some errors.
	if ($@) { 
	    if ($@ =~ /dataset is busy/) {
		warn("*** WARNING: blockstore_deallocSlice: ".
		     "Slice is busy.  Waiting a bit before trying ".
		     "to free again (count=$count).");
		sleep $SLICE_BUSY_WAIT;
	    }
	    elsif ($@ =~ /does not exist/) {
		if ($count < $MAX_RETRY_COUNT) {
		    warn("*** WARNING: blockstore_deallocSlice: ".
			 "Blockstore slice seems to be gone, retrying.");
		    # Bump counter to just under termination to try once more.
		    $count = $MAX_RETRY_COUNT-1;
		    sleep $SLICE_GONE_WAIT;
		} else {
		    warn("*** WARNING: blockstore_deallocSlice: ".
			 "Blockstore slice still seems to be gone.");
		    # Bail now because we don't want to report this as an
		    # error to the caller.
		    return 0;
		}
	    } 
	    else {
		warn("*** ERROR: blockstore_deallocSlice: ".
		     "slice removal failed: $@");
		return -1;
	    }
	} else {
	    # No error condition - jump out of loop.
	    last;
	}
    }

    # Note: Checks for lingering slices will be performed separately in
    # consistency checking routines.

    if ($count > $MAX_RETRY_COUNT) {
	warn("*** WARNING: blockstore_deallocSlice: ".
	     "Could not free slice after several attempts!");
	return -1;
    }

    return 0;
}

# Required perl foo
1;
