#!/usr/bin/perl -w

#
# Copyright (c) 2000-2020 University of Utah and the Flux Group.
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

use English;
use Getopt::Std;

#
# Turn off line buffering on output
#
$| = 1;

#
# Untaint the path
# 
$ENV{'PATH'} = "/bin:/sbin:/usr/bin:";
delete @ENV{'IFS', 'CDPATH', 'ENV', 'BASH_ENV'};

# Drag in path stuff so we can find emulab stuff.
BEGIN { require "/etc/emulab/paths.pm"; import emulabpaths; }
use libsetup;
use liblocsetup;

#
# No configure vars.
#
my $sudo = "";
my $zipper = "$LBINDIR/imagezip";
my $uploader = "$LBINDIR/frisupload";
my $frisbee = "$LBINDIR/frisbee";
my $localdir = "/local";
my $impotent = 0;
my $verbose = 0;
my $isxen   = 0;
my $domfs   = 0;

#
# Map DB (BSD-ish) disknames into actual /dev device names on
# FreeBSD or Linux.
#
#
# Map DB (BSD-ish) disknames into actual /dev device names on
# FreeBSD or Linux.
#
sub map_diskname($)
{
    my ($dev) = @_;
    my ($dtype, $dunit);
    my $devname = undef;

    #
    # When called on XEN, the diskname is correct, and in fact we will
    # just mess it up.
    #
    return $dev
	if ($isxen);

    # strip off /dev/ if it is there
    $dev =~ s/^\/dev\///;

    if ($dev =~ /^([-a-zA-Z_]+)(\d+)$/) {
	($dtype,$dunit) = ($1,$2);
    } else {
	goto verify;
    }

    # Hack for the Linux MFS: we still use the BSD device
    # names in the database so we try to convert them to
    # the equivalent Linux devices here.  This happens to
    # work at the moment, but if device names change again
    # it could break.
    if ($^O eq 'linux') {
	# XXX hack for NVMe
	if ($dtype eq "nvd") {
	    $devname = "/dev/nvme${dunit}n1";
	    goto verify;
	}
	# XXX hack for FreeBSD SATA
	if ($dtype eq 'ad' && $dunit > 3) {
	    $dunit -= 4
	}
	$dtype = "sd";
	$dunit =~ y/01234567/abcdefgh/;

	#
	# XXX woeful TPM dongle-boot hack.
	# If we are imaging /dev/sda and dmesg reports that
	# that device is write-protected, assume it is the boot dongle
	# and use /dev/sdb instead!
	#
	if ($dunit eq "a") {
	    if (!system("dmesg | fgrep -q '[sda] Write Protect is on'")) {
		print STDERR "WARNING: suspect dongle-booted node, using sdb instead of sda\n";
		$dunit = "b";
	    }
	}
    }
    $devname = "/dev/$dtype$dunit";

  verify:

    #
    # XXX the Linux kernel has a non-deterministic way of naming at least
    # NVMe devices. So we independently determine what we think the boot
    # disk should be based on what is on all of the disks. If our heuristics
    # don't find any disk or we find more than one possible disk, then
    # we just stick with the specified disk. Only if we find exactly one
    # disk that is different than the specified disk, do we change it.
    #
    if (-x "$BINDIR/findbootdisk.pl") {
	my $sdev = $devname;
	$sdev =~ s/^\/dev\///;
	my $devstr = `$sudo $BINDIR/findbootdisk.pl`;
	chomp($devstr);
	@devs = split(' ', $devstr);
	if (@devs == 0) {
	    print STDERR "WARNING: found no partitioned disk, ".
		"using $sdev anyway.\n";
	} elsif (@devs > 1) {
	    print STDERR "WARNING: found multiple partitioned disks (".
		join(", ", @devs),
		"), using specified disk ($sdev).\n";
	} elsif ($sdev ne $devs[0]) {
	    print STDERR "WARNING: found partitioned disk ($devs[0]) ".
		"different than specified disk ($sdev), ".
		"using $devs[0] instead.\n";
	}
    }

    return $devname;
}

if (@ARGV == 0) {
    print STDERR "map_diskname bsd-device-name\n";
    exit(1);
}

#
# If we are running as a user, then we will need sudo
#
if ($EUID != 0) {
    for my $path (qw#/usr/local/bin /usr/bin#) {
	if (-e "$path/sudo") {
	    $sudo = "$path/sudo";
	    last;
	}
    }
}

print "$ARGV[0] -> ", map_diskname($ARGV[0]), "\n";
exit(0);
