#!/usr/bin/perl -w

#
# Copyright (c) 2025 University of Utah and the Flux Group.
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
# Attempt to locate an Emulab-ish boot disk.
# There are many levels of heuristic we could use here, but we just settle for
# finding exactly one disk with partition 1, 2, and 3. This covers both our
# historic MBR based layout and the newer GPT based layout.
# Returns the name(s) of potential boot disk(s).
#
# Usage: findbootdisk [ hint ... ]
# where "hint" could someday be one or more of:
#    prefix=(sd|nvme|ad|ada|da|nvd|nda)
#         Candidate disk(s) must start with the given prefix.
#    serial=(<serial_number>|lowest|highest)
#         If "lowest" or "highest", pick the disk with the lowest/highest SN
#         value as determined by a naive perl sort(). Otherwise the given
#         string must match the disk SN.
#    size=<num_sectors>
#         Size of disk/partition must match.
#    parts=N[,N ...]
#         Disk must contain the given partition(s); e.g. "part=1,2,3".
#
# XXX for FreeBSD MFS:
# * can get disks+sizes with "dmesg | grep '512 byte sectors'"
# * get disks with "sysctl -n kern.disks"; e.g., "nvd1 nvd0"
# * get disks+parts+size with
#     "sysctl -n kern.geom.conftxt | grep -E ' (DISK|PART) '"
#   the output still will require considerable parsing.
# * can get non-NVMe serial numbers with "dmesg | grep 'Serial Number'"
#
# See https://gitlab.com/mezantrop/geom_show for an awk script that parses
# the kern.geom.confxml output.
#
use Data::Dumper;

my $debug = 0;

my %hints = ();
foreach my $hint (@ARGV) {
    if ($hint =~ /^(prefix|serial|size|parts)=(.*)$/) {
	$hints{$1} = $2;
    }
}

# Default is to find all Emulab-style disk layouts
if (keys(%hints) == 0) {
    $hints{'parts'} = "1,2,3";
}

if ( ! -e "/proc/partitions" ) {
    print STDERR "Only works with /proc/partitions right now.\n";
    exit(1);
}

my @lines = `cat /proc/partitions`;
chomp @lines;

my %disks = ();
my $prefix = exists($hints{'prefix'}) ? $hints{'prefix'} : "";
if ($prefix) {
    print STDERR "Looking at only '$prefix' disks to ID boot disk.\n";
}

foreach my $line (@lines) {
    my ($size,$unit,$pstr,$pnum,$disk);

    if ((!$prefix || $prefix eq "sd") &&
	$line =~ /^\s*\d+\s+\d+\s+(\d+)\s+sd([a-z]+)(\d+)?/) {
	($size,$unit,$pstr,$pnum) = ($1,$2,undef,$3);
	$disk = "sd$unit";
    } elsif ((!$prefix || $prefix eq "nvme") &&
	     $line =~ /^\s*\d+\s+\d+\s+(\d+)\s+nvme(\d+)n1(p(\d+))?/) {
	($size,$unit,$pstr,$pnum) = ($1,$2,$3,$4);
	$disk = "nvme${unit}n1";
    } elsif ($prefix &&
	     $line =~ /^\s*\d+\s+\d+\s+(\d+)\s+${prefix}(\d+)(p(\d+))?/) {
	($size,$unit,$pstr,$pnum) = ($1,$2,$3,$4);
	$disk = "$prefix$unit";
    } else {
	next;
    }
    if (!exists($disks{$disk})) {
	@{$disks{$disk}} = ();
    }
    if (defined($pnum)) {
	${$disks{$disk}}[$pnum] = $size * 2;
    } else {
	${$disks{$disk}}[0] = $size * 2;
    }
}

print STDERR "Disk info:\n", Dumper(\%disks), "\n"
    if ($debug);

my @bdisk = ();

# Look up by serial number
my $SMARTCTL = "/usr/sbin/smartctl";

if (exists($hints{'serial'}) && $hints{'serial'} ne "none") {
    my $sn = $hints{'serial'};
    my $match = ($sn eq "lowest" || $sn eq "highest") ? 0 : 1;
    my %snlist = ();

    if ($match) {
	print STDERR "Looking for serial number '$sn' as boot disk.\n";
    } else {
	print STDERR "Looking for $sn serial number as boot disk.\n";
    }

    foreach my $disk (keys(%disks)) {
	my $dsn = "";

	if (-r "/sys/class/block/$disk/device/serial") {
	    $dsn = `cat /sys/class/block/$disk/device/serial`;
	    chomp $dsn;
	    $dsn =~ s/\s*$//;
	} elsif (-x "$SMARTCTL") {
	    @lines = `$SMARTCTL -i /dev/$disk`;
	    foreach my $line (@lines) {
		if ($line =~ /^serial number:\s+(\S+)/i) {
		    $dsn = $1;
		    last;
		}
	    }
	}
	if ($dsn) {
	    print STDERR "Got serial '$dsn', looking for '$sn'\n"
		if ($debug);
	    if ($match && $dsn eq $sn) {
		push @bdisk, $disk;
		# XXX there should only be one
		last;
	    } elsif (!$match) {
		$snlist{$dsn} = $disk;
	    }
	}
    }
    if (!$match && keys(%snlist) > 0) {
	my @tlist;
	if ($sn eq "lowest") {
	    @tlist = sort keys(%snlist);
	} else {
	    @tlist = sort {$b cmp $a} keys(%snlist);
	}
	push @bdisk, $snlist{$tlist[0]};
    }
    goto done;
}

if (exists($hints{'parts'})) {
    print STDERR "Looking for existence of partitions " . $hints{'parts'} .
	" to ID boot disk.\n";
    @plist = split(',', $hints{'parts'});
    DISK: foreach my $disk (keys(%disks)) {
	foreach my $part (@plist) {
	    next DISK
		if (!exists(${$disks{$disk}}[$part]));
	}
	push @bdisk, $disk;
    }
    goto done;
}

 done:
    
print join(' ', sort(@bdisk)), "\n"
    if (@bdisk > 0);
exit(0);
