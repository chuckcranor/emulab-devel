#!/bin/sh

#
# This simply drops a .nmconnection file for interface $1 into
# /run/NetworkManager/system-connections so that NetworkManager can pick
# it up, unless it gets overridden.
#

iface=$1
if [ -z "$iface" ]; then
    echo "ERROR: must provide an interface as the sole argument"
    exit 1
fi

ifacemac=`cat /sys/class/net/$iface/address | sed -ne 's/^\([a-fA-F0-9:]*\)$/\1/p' | tr ABCDEF abcdef | tr -d :`

CMDLINECNETMAC=`cat /proc/cmdline | sed -ne 's/^.* emulabcnet=\([a-fA-F0-9:]*\) *.*$/\1/p' | tr ABCDEF abcdef | tr -d :`
if [ -n "$CMDLINECNETMAC" -a -n "$ifacemac" ]; then
    for sifpath in /sys/class/net/* ; do
	sifname=`basename $sifpath`
	if [ -s $sifpath/address ]; then
	    sifmac=`cat $sifpath/address | sed -ne 's/^\([a-fA-F0-9:]*\)$/\1/p' | tr ABCDEF abcdef | tr -d :`
	    if [ -z "$sifmac" ]; then
		continue
	    fi

	    # If CMDLINECNETMAC exists on our system, and does *not* match
	    # our input iface name, do *not* generate a $iface.network file
	    # for systemd-networkd.
	    if [ "$sifmac" = "$CMDLINECNETMAC" -a ! "$ifacemac" = "$CMDLINECNETMAC" ]; then
		echo "Skipping $iface ($ifacemac) in favor of existing, hinted $CMDLINECNETMAC"
		exit 0
	    fi
	fi
    done
fi

#
# If this is a management interface, ignore it.
#
((echo "$iface" | grep -qi idrac) || (echo "$iface" | grep -qi ilo)) && exit 0

mkdir -p /run/NetworkManager/system-connections
cat <<EOF > /run/NetworkManager/system-connections/$iface.nmconnection
[device]
match-device=interface-name:$iface
#managed=1
keep-configuration=1

[connection]
id=$iface
type=ethernet
interface-name=$iface
autoconnect=1

[ipv4]
method=auto
dhcp-hostname=0
dhcp-timeout=2147483647
EOF

chmod 600 /run/NetworkManager/system-connections/$iface.nmconnection

exit 0
