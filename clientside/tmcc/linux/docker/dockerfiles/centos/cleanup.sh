#!/bin/sh

set -x

if [ -f /tmp/sources.list.backup ]; then
    mv /tmp/sources.list.backup /etc/apt/sources.list
fi

yum clean all
rm -f /tmp/yum-updated
rm -rf /tmp/* /var/tmp*

exit 0
