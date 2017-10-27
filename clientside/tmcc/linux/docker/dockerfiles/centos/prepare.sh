#!/bin/sh

set -x

export CENTOS_MIRROR=http://mirror.chpc.utah.edu/pub/centos/

if [ -n "$UBUNTU_MIRROR" -a ! -f /tmp/sources.list.backup ]; then
    cp -p /etc/apt/sources.list /tmp/sources.list.backup
    sed -i -r -e "s|http://.*.ubuntu.com/ubuntu|$UBUNTU_MIRROR|" \
	/etc/apt/sources.list
fi

[ ! -f /tmp/yum-updated ] && yum updateinfo && touch /tmp/yum-updated

exit 0
