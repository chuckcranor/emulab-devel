#!/usr/bin/perl -w
#
# Copyright (c) 2000-2013 University of Utah and the Flux Group.
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
use strict;
use Getopt::Std;
use English;
use Data::Dumper;
use POSIX qw(setsid);
use Socket;

#
# Invoked by xmcreate script to configure the control network for a vnode.
#
# NOTE: vmid should be an integer ID.
#
sub usage()
{
    print "Usage: emulab-cnet ".
	"vmid host_ip vnode_name vnode_ip (online|offline)\n";
    exit(1);
}

#
# Turn off line buffering on output
#
$| = 1;

# Drag in path stuff so we can find emulab stuff.
BEGIN { require "/etc/emulab/paths.pm"; import emulabpaths; }

#
# Load the OS independent support library. It will load the OS dependent
# library and initialize itself. 
# 
use libsetup;
use libtmcc;
use libutil;
use libtestbed;
use libgenvnode;

#
# Configure.
#
my $TMCD_PORT	= 7777;
my $SLOTHD_PORT = 8509;
my $EVPROXY_PORT= 16505;
my $IPTABLES	= "/sbin/iptables";

usage()
    if (@ARGV < 4);

my $vmid     = shift(@ARGV);
my $host_ip  = shift(@ARGV);
my $vnode_id = shift(@ARGV);
my $vnode_ip = shift(@ARGV);

# The caller (xmcreate) puts this into the environment.
my $vif         = $ENV{'vif'};
my $XENBUS_PATH = $ENV{'XENBUS_PATH'};
my $bridge      = `xenstore-read "$XENBUS_PATH/bridge"`;
chomp($bridge);

my ($bossdomain) = tmccbossinfo();
die("Could not get bossname from tmcc!")
    if (!defined($bossdomain));
if ($bossdomain =~ /^[-\w]+\.(.*)$/) {
    $bossdomain = $1;
}

# We need these IP addresses.
my $boss_ip = `host boss.${bossdomain} | grep 'has address'`;
if ($boss_ip =~ /has address ([0-9\.]*)$/) {
    $boss_ip = $1;
}
my $ops_ip = `host ops.${bossdomain} | grep 'has address'`;
if ($ops_ip =~ /has address ([0-9\.]*)$/) {
    $ops_ip = $1;
}
my $fs_ip = `host fs.${bossdomain} | grep 'has address'`;
if ($fs_ip =~ /has address ([0-9\.]*)$/) {
    $fs_ip = $1;
}
my $PCNET_IP_FILE   = "$BOOTDIR/myip";
my $PCNET_MASK_FILE = "$BOOTDIR/mynetmask";
my $PCNET_GW_FILE   = "$BOOTDIR/routerip";

my $cnet_ip   = `cat $PCNET_IP_FILE`;
my $cnet_mask = `cat $PCNET_MASK_FILE`;
my $cnet_gw   = `cat $PCNET_GW_FILE`;
chomp($cnet_ip);
chomp($cnet_mask);
chomp($cnet_gw);
my $network   = inet_ntoa(inet_aton($cnet_ip) & inet_aton($cnet_mask));

my ($jail_network,$jail_netmask) = findVirtControlNet();
# XXX InstaGeni Rack Hack. Hack until I decide on a better way
my $fs_jailip = "172.17.253.254";

# Each container gets a tmcc proxy running on another port.
my $local_tmcd_port = $TMCD_PORT + $vmid;

# Need this too.
my $outer_controlif = `cat $BOOTDIR/controlif`;
chomp($outer_controlif);

#
# We setup a bunch of iptables rules when a container goes online, and
# then clear them when it goes offline.
#
sub Online()
{
    # Prevent dhcp requests from leaving the physical host.
    mysystem2("$IPTABLES -A FORWARD -o $bridge -m pkttype ".
	      "--pkt-type broadcast " .
	      "-m physdev --physdev-in $vif --physdev-is-bridged ".
	      "--physdev-out $outer_controlif -j DROP");
    return -1
	if ($?);

    #
    # We ask vif-bridge to turn on antispoofing; this rule would negate that.
    #
    if (0) {
	mysystem2("$IPTABLES -A FORWARD -m physdev ".
		  "--physdev-in $vif -j ACCEPT");
	return -1
	    if ($?);
    }
    
    # Start a tmcc proxy (handles both TCP and UDP)
    my $tmccpid = fork();
    if ($tmccpid) {
	# Give child a chance to react.
	sleep(1);
	mysystem2("echo $tmccpid > /var/run/tmccproxy-$vnode_id.pid");
    }
    else {
	POSIX::setsid();
	
	exec("$BINDIR/tmcc.bin -d -t 15 -n $vnode_id ".
	       "  -X $host_ip:$local_tmcd_port -s $boss_ip -p $TMCD_PORT ".
	       "  -o $LOGDIR/tmccproxy.$vnode_id.log");
	die("Failed to exec tmcc proxy"); 
    }

    # Reroute tmcd calls to the proxy on the physical host
    mysystem2("$IPTABLES -t nat -A PREROUTING -j DNAT -p tcp ".
	   "  --dport $TMCD_PORT -d $boss_ip -s $vnode_ip ".
	   "  --to-destination $host_ip:$local_tmcd_port");
    return -1
	if ($?);

    mysystem2("$IPTABLES -t nat -A PREROUTING -j DNAT -p udp ".
	   "  --dport $TMCD_PORT -d $boss_ip -s $vnode_ip ".
	   "  --to-destination $host_ip:$local_tmcd_port");
    return -1
	if ($?);

    # Reroute evproxy to use the local daemon.
    mysystem2("$IPTABLES -t nat -A PREROUTING -j DNAT -p tcp ".
	   "  --dport $EVPROXY_PORT -d $ops_ip -s $vnode_ip ".
	   "  --to-destination $host_ip:$EVPROXY_PORT");
    return -1
	if ($?);
    
    #
    # GROSS! source-nat all traffic destined the fs node, to come from the
    # vnode host, so that NFS mounts work. We do this for non-shared nodes.
    # Shared nodes do the mounts normally from inside the guest. The reason
    # for this distinction is that on a shared host, we ask vif-bridge to
    # turn on antispoofing so that the guest cannot use an IP address other
    # then what we assign. On a non-shared node, the user can log into the
    # physical host and pick any IP they want, but as long as the NFS server
    # is exporting only to the physical IP, they won't be able to mount
    # any directories outside their project. The NFS server *does* export
    # filesystems to the guest IPs if the guest is on a shared host.
    # 
    if (!SHAREDHOST()) {
	mysystem2("$IPTABLES -t nat -A POSTROUTING -j SNAT ".
	       "  --to-source $host_ip -s $vnode_ip -d $fs_ip,$fs_jailip ".
	       "  -o $bridge");
	return -1
	    if ($?);
    }

    # 
    # If the source is from the vnode, headed to the local control 
    # net, no need for any NAT; just let it through.
    #
    # On a remote node (pcpg) we are not bridged to the control
    # network, and so we route to the control network, and then
    # rely on the SNAT rule below. 
    #
    if (!REMOTEDED()) {
	mysystem2("$IPTABLES -t nat -A POSTROUTING -j ACCEPT " . 
		  " -s $vnode_ip -d $network/$cnet_mask");
	return -1
	    if ($?);

	#
	# Boss/ops/fs specific rules in case the control network is
	# segmented like it is in Utah.
	#
	mysystem2("$IPTABLES -t nat -A POSTROUTING -j ACCEPT " . 
		  " -s $vnode_ip -d $boss_ip,$ops_ip");
	return -1
	    if ($?);
    }

    # 
    # Ditto for the jail network. On a remote node, the only
    # jail network in on our node, and all of them are bridged
    # togther anyway. 
    # 
    mysystem2("$IPTABLES -t nat -A POSTROUTING -j ACCEPT " . 
	      " -s $vnode_ip -d $jail_network/$jail_netmask");
    return -1
	if ($?);

    # 
    # Otherwise, setup NAT so that traffic leaving the vnode on its 
    # control net IP, that has been routed out the phys host's
    # control net iface, is NAT'd to the phys host's control
    # net IP, using SNAT.
    # 
    mysystem2("$IPTABLES -t nat -A POSTROUTING ".
	      " -s $vnode_ip -o $outer_controlif -j SNAT --to-source $host_ip");
    
    return 0;
}

sub Offline()
{
    # dhcp
    mysystem2("$IPTABLES -D FORWARD -o $bridge -m pkttype ".
	      "--pkt-type broadcast " .
	      "-m physdev --physdev-in $vif --physdev-is-bridged ".
	      "--physdev-out $outer_controlif -j DROP");

    # See above. 
    if (0) {
	mysystem2("$IPTABLES -D FORWARD -m physdev ".
		  "--physdev-in $vif -j ACCEPT");
    }

    # tmcc
    # Reroute tmcd calls to the proxy on the physical host
    mysystem2("$IPTABLES -t nat -D PREROUTING -j DNAT -p tcp ".
	   "  --dport $TMCD_PORT -d $boss_ip -s $vnode_ip ".
	   "  --to-destination $host_ip:$local_tmcd_port");
    mysystem2("$IPTABLES -t nat -D PREROUTING -j DNAT -p udp ".
	   "  --dport $TMCD_PORT -d $boss_ip -s $vnode_ip ".
	   "  --to-destination $host_ip:$local_tmcd_port");

    if (-e "/var/run/tmccproxy-$vnode_id.pid") {
	my $pid = `cat /var/run/tmccproxy-$vnode_id.pid`;
	chomp($pid);
	mysystem2("/bin/kill $pid");
    }

    if (!SHAREDHOST()) {
	mysystem2("$IPTABLES -t nat -D POSTROUTING -j SNAT ".
	       "  --to-source $host_ip -s $vnode_ip -d $fs_ip,$fs_jailip ".
	       "  -o $bridge");
    }

    mysystem2("$IPTABLES -t nat -D POSTROUTING -j ACCEPT " . 
		  " -s $vnode_ip -d $jail_network/$jail_netmask");

    if (!REMOTEDED()) {
	mysystem2("$IPTABLES -t nat -D POSTROUTING -j ACCEPT " . 
		  " -s $vnode_ip -d $network/$cnet_mask");

	mysystem2("$IPTABLES -t nat -D POSTROUTING -j ACCEPT " . 
		  " -s $vnode_ip -d $boss_ip,$ops_ip");
    }

    mysystem2("$IPTABLES -t nat -D POSTROUTING ".
	      " -s $vnode_ip -o $outer_controlif -j SNAT --to-source $host_ip");

    # evproxy
    mysystem2("$IPTABLES -t nat -D PREROUTING -j DNAT -p tcp ".
	   "  --dport $EVPROXY_PORT -d $ops_ip -s $vnode_ip ".
	   "  --to-destination $host_ip:$EVPROXY_PORT");

    return 0;
}

if (@ARGV) {
    #
    # Oh jeez, iptables is about the dumbest POS I've ever seen;
    # it fails if you run two at the same time. So we have to
    # serialize the calls. Rather then worry about each call, just
    # take a big lock here. 
    #
    if (TBScriptLock("iptables", 0, 300) != TBSCRIPTLOCK_OKAY()) {
	print STDERR "Could not get the iptables lock after a long time!\n";
	exit(-1);
    }

    #
    # First run the xen script to do the bridge interface. We do this
    # inside the lock since vif-bridge does some iptables stuff.
    #
    mysystem2("/etc/xen/scripts/vif-bridge @ARGV");
    if ($?) {
	TBScriptUnlock();
	exit(1);
    }
    my $rval = 0;
    my $op   = shift(@ARGV);
    if ($op eq "online") {
	$rval = Online();
    }
    elsif ($op eq "offline") {
	$rval = Offline();
    }
    TBScriptUnlock();
    exit($rval);
}
exit(0);
