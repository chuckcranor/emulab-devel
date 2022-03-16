#!/bin/sh

SYSTEM=`uname -s`
if [ "$SYSTEM" = "FreeBSD" ]; then
    topcmd="top -d 1 -a"
else
    topcmd="top -b -n 1 -w 120"
fi
lscmd1="/bin/ls -lat /tmp"
lscmd2="/bin/ls -lat /etc"
smibin="/usr/bin/nvidia-smi";
smicmd="$smibin pmon -c 1"

if [ "$1" != "-GPU" ]; then
    uname -a
    echo ""
    if [ -e /etc/lsb-release ]; then
	cat /etc/lsb-release
    fi
    echo "$topcmd"
    echo "------------------------------------------------------"
    $topcmd | head -n 20
fi

if [ -x $smibin ]; then
    if [ "$1" != "-GPU" ]; then
	echo "------------------------------------------------------"
	echo ""
    fi
    echo "$smicmd"
    echo "------------------------------------------------------"
    $smicmd
fi

if [ "$1" != "-GPU" ]; then
    echo "------------------------------------------------------"
    echo ""
    echo "$lscmd1"
    echo "------------------------------------------------------"
    $lscmd1 | head -n 20
    echo "------------------------------------------------------"
    echo ""

    echo "$lscmd2"
    echo "------------------------------------------------------"
    $lscmd2 | head -n 20
fi

