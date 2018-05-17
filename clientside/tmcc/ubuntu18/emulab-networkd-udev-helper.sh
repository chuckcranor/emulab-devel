#!/bin/sh

#
# This simply drops a .network file for interface $1 into
# /run/systemd/network so that networkd can pick it up, unless it gets
# overridden.
#

iface=$1
if [ -z "$iface" ]; then
    echo "ERROR: must provide an interface as the sole argument"
    exit 1
fi

#
# NB, if the user has overridden this by some file in
# /etc/systemd/network, that takes precedence, and this won't be run.
# We have specific code in emulab-networkd.sh that is run from
# emulab-networkd-online@.service that checks to see if this file was
# used or not; we only handle the iface there if this file got used.
#
mkdir -p /run/systemd/network
cat <<EOF > /run/systemd/network/${iface}.network
[Match]
Name=$iface

[Network]
Description=Emulab control net search on $iface
DHCP=yes

[DHCP]
CriticalConnection=yes
PreferredLifetime=forever
UseNTP=yes
UseHostname=yes
UseDomains=yes
EOF

exit 0
