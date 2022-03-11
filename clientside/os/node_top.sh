#!/bin/sh

SYSTEM=`uname -s`
if [ $SYSTEM == "FreeBSD" ]; then
    topcmd="top -d 1 -a"
else
    topcmd="top -b -n 1 -w 120"
fi
lscmd1="/bin/ls -lat /tmp"
lscmd2="/bin/ls -lat /etc"
smibin="/usr/bin/nvidia-smi";
smicmd="$smibin pmon -c 1"

echo "$topcmd"
echo "------------------------------------------------------"
$topcmd | head -n 20

if [ -x $smibin ]; then
    echo "------------------------------------------------------"
    echo ""
    echo "$smicmd"
    echo "------------------------------------------------------"
    $smicmd
fi

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
