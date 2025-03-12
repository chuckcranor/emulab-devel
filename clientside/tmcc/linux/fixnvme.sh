#!/bin/sh
#
# Make sure there is only one NVMe namespace on the given controller
# Exits zero on success.
#
checkonly=0
device=$1
bsize=512

if [ -z "$device" -o ! -e "$device" ]; then
    echo "Usage: $0 <nvme-device> [doit]"
    exit 1
fi

if [ -z "$2" -o x$2 != xdoit ]; then
    echo "$device: WARNING: just checking, NOT fixing"
    checkonly=1
fi

#inuse=`blkid | grep $device`
#if [ -n "$inuse" ]; then
#    echo "$device: WARNING appears to be in use, will not modify"
#    checkonly=1
#fi

# XXX make sure we have up to date info
nvme ns-rescan $device

# XXX "nvme list $device" will show namespaces on all nvme? devices so
# we use "nvme list-ns" instead.
spaces=`nvme list-ns $device -a | wc -l`
if [ $? -ne 0 -o -z "$spaces" ]; then
    echo "WARNING: could not figure out how man NVMe namespaces there are"
    exit 1
fi
if [ $spaces -gt 1 ]; then
    echo "WARNING: found $spaces NVMe namespaces on $device, clearing..."
    if [ $checkonly -ne 0 ]; then
	echo "CHECK: would delete all namespaces"
	exit 0
    fi
    nvme delete-ns $device -n 0xFFFFFFFF || {
	echo "WARNING: could not delete $spaces namespaces on $device!"
	exit 1
    }
    spaces=0
    sleep 5
fi
if [ $spaces -eq 0 ]; then
    echo "NOTE: creating a single NVMe namespaces on $device..."
    msize=`nvme id-ctrl $device | grep ^tnvmcap | awk '{print $NF}'`
    if [ $? -ne 0 ]; then
	echo "WARNING: could not determine capacity of device, not configured!"
	exit 1
    fi
    ctrl=`nvme id-ctrl $device | grep ^cntlid | awk '{print $NF}'`
    if [ $? -ne 0 ]; then
	echo "WARNING: could not determine controller ID of device, not configured!"
	exit 1
    fi
    blocks=`expr $msize / $bsize`
    if [ $checkonly -ne 0 ]; then
	echo "CHECK: would create namespace 1 with $blocks blocks"
	exit 0
    fi
    nvme create-ns $device --nsze=$blocks --ncap=$blocks --flbas=0 --dps=0 || {
	echo "WARNING: could not create namespace, not configured!"
	exit 1
    }
    nvme attach-ns $device --namespace-id=1 --controllers=$ctrl || {
	echo "WARNING: could not attach namespace to controller!"
	exit 1
    }
    sleep 2
else
    # Single namespace already existed, make sure LBA format is correct
    ns=${device}n1
    format=`nvme id-ns $ns -H | fgrep '(in use)'`
    if [ $? -ne 0 -o -z "$format" ]; then
	echo "WARNING: could not determine LBA format of $n1!"
	exit 1
    fi
    lba=`echo $format | sed -E -e 's/LBA Format[ 	]+([0-9]).*/\1/'`
    if [ "x$lba" != "x0" ]; then
	echo "WARNING: $n1 has wrong LBA format ($lba), fixing..."
	if [ $checkonly -ne 0 ]; then
	    echo "CHECK: would reformat namespace 1 with 512 byte blocks"
	    exit 0
	fi
	nvme format --lbaf 0 --force --reset $ns || {
	    echo "WARNING: could not set LBA Format 0 on $ns!"
	    exit 1
	}
    fi
fi

#echo "All good!"
exit 0
