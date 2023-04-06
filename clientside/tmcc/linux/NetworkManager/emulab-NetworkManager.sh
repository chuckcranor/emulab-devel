#!/bin/sh

iface=$1
if [ -z "$iface" ]; then
    echo "ERROR: must provide an interface as the sole argument"
    exit 1
fi
nprefix=/run/NetworkManager/system-connections
ifacefile=$nprefix/$iface.nmconnection

if [ -e /etc/emulab/paths.sh ]; then
    . /etc/emulab/paths.sh
else
    BOOTDIR=/var/emulab/boot
    LOGDIR=/var/emulab/logs
fi

mkdir -p $LOGDIR
LOGFILE=$LOGDIR/emulab-NetworkManager-$iface.log
echo "`date`: ${iface}: starting" | tee -a $LOGFILE 2>&1

found=0
while [ ! $found -eq 1 ]; do
    # If the control net iface was found, and it's not us, exit.
    if [ -e /run/cnet ]; then
        excnet=`cat /run/cnet`
        if [ ! "$excnet" = "$iface" ]; then
            echo "`date`: ${iface}: control net is not us, removing $iface from NetworkManager and $ifacefile" | tee -a $LOGFILE 2>&1
	    rm -f $ifacefile
	    nmcli connection delete $iface
	    exit 0
        fi
    fi

    nmcli --fields GENERAL.STATE  connection show $iface | grep -q activated
    if [ $? -eq 0 ]; then
	echo "`date`: ${iface}: control net is us" | tee -a $LOGFILE 2>&1
	mkdir -p /run/emulab
	echo "$iface" > /run/cnet
	found=1
	#echo "`date`: ${iface}: unsetting ipv4.dhcp-timeout for $iface" | tee -a $LOGFILE 2>&1
        #nmcli connection modify $iface ipv4.dhcp-timeout infinity
    fi
done

#
# If the control net iface was us, remove the remaining *.nmconnection files
# and connections from the running NetworkManager.
#
if [ $found -eq 1 ]; then
    echo "`date`: emulab-NetworkManager[$$]: found $iface as control net"
    controlif=`cat /run/cnet`
    for filename in `ls -1 $nprefix`; do
        ( echo $filename | grep $controlif.nmconnection) && continue
        ( echo $filename | grep '.nmconnection$' ) || continue
        file=$nprefix/$filename
	grep -q "Description=.*Emulab" $file
	if [ ! $? -eq 0 ]; then
	    echo "`date`: ${iface}: $file is not ours; ignoring" | tee -a $LOGFILE 2>&1
	    continue
	fi
	ifa=`echo $file | sed -ne 's|^interface-name=\(.*\)$|\1|p'`
	rm -f $file
	ip link set $ifa down
	nmcli connection delete $ifa || true
	echo "`date`: ${iface}: downed $ifa" | tee -a $LOGFILE 2>&1
    done
fi

#
# Write some metadata in /var/emulab/boot.  `nmcli connection show <iface>`
# has what we need.
#
mkdir -p $BOOTDIR
mkdir -p /run/emulab
nmcli -t connection show $iface \
    | grep -E 'GENERAL|IP4|DHCP4|IP6' \
    | sed \
        -e '/^\([^:]*\).*$/ !b' \
        -e h \
        -e 's//\1/' \
        -e 'y|.-[]|___ |' \
        -e 's| ||' \
        -e G \
        -e 's|\(.*\)\n\([^:]*:\)\(.*\)$|\1="\3"|' \
        -e 's/DHCP4_OPTION_[0-9]*="\([^ ]*\) = \(.*\)"$/DHCP4_OPTION_\1="\2"/' \
    > /run/emulab-NetworkManager-nmcli-show-$iface.sh
#    > /run/emulab-nmcli-show-$iface.sh

if [ -s /run/emulab-NetworkManager-nmcli-show-$iface.sh ]; then
    . /run/emulab-NetworkManager-nmcli-show-$iface.sh
    echo "`date`: ${iface}: writing cnet metadata in $BOOTDIR" | tee -a $LOGFILE 2>&1
else
    echo "`date`: ${iface}: no cnet metadata to write for $iface in $BOOTDIR; aborting!" | tee -a $LOGFILE 2>&1
    exit 1
fi

# Actually do the metadata file writes.
#echo $DHCP4_OPTION_dhcp_server_identifier > $BOOTDIR/bossip
BOSSIP=`echo $DHCP4_OPTION_domain_name_servers | cut -d' ' -f1`
echo $BOSSIP > $BOOTDIR/bossip
echo $BOSSIP > /run/emulab/bossip
echo $DHCP4_OPTION_host_name > $BOOTDIR/realname
echo $DHCP4_OPTION_routers > $BOOTDIR/routerip
echo $DHCP4_OPTION_ip_address > $BOOTDIR/myip
echo $DHCP4_OPTION_subnet_mask > $BOOTDIR/mynetmask
echo $DHCP4_OPTION_domain_name > $BOOTDIR/mydomain
echo $iface > $BOOTDIR/controlif
#
# For Xen-based vnodes we record the vnode name where the scripts expect it.
# XXX this works because only Xen-based vnodes DHCP.
#
case "$DHCP4_OPTION_host_name" in
    pcvm*)
	echo $DHCP4_OPTION_host_name > $BOOTDIR/vmname
	;;
esac

#
# Make sure the hostname is set to something sane.
#
if [ `hostname -s` != "$DHCP4_OPTION_host_name" ]; then
    hostname $DHCP4_OPTION_host_name
fi

#
# Ensure /etc/resolv.conf is set to something sane.  We are not using
# systemd-resolved, so all we want is for /etc/resolv.conf to point to
# /run/systemd/resolve/resolv.conf .  But if it doesn't, just update it
# in place.
#
#if [ -L /etc/resolv.conf \
#     -a ! -f `readlink -f /etc/resolv.conf` \
#     -a -f /run/systemd/resolve/resolv.conf ]; then
#    echo "`date`: fixing /etc/resolv.conf to point to /run/systemd/resolve/resolv.conf" | tee -a $LOGFILE 2>&1
#    ln -sf /run/systemd/resolve/resolv.conf /etc/resolv.conf
#elif [ ! -L /etc/resolv.conf ]; then
#    echo "`date`: updating static /etc/resolv.conf; should be symlink!" | tee -a $LOGFILE 2>&1
#    rm -f /etc/resolv.conf
#    for ns in $DNS ; do
#	echo nameserver $ns >> /etc/resolv.conf
#    done
#    echo search $DOMAINNAME >> /etc/resolv.conf
#fi

#
# See if the Testbed configuration software wants to change the hostname.
#
if [ -x $BINDIR/sethostname.dhclient ]; then
    $BINDIR/sethostname.dhclient >>$LOGDIR/dhclient.log 2>&1
fi

echo "`date`: ${iface}: done!" | tee -a $LOGFILE 2>&1

#
# Tell other scripts waiting on us that we are done.
#
touch /run/cnet-done

exit 0
