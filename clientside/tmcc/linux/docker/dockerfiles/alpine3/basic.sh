#!/bin/sh

set -x

apk update

# missing iputils-ping package from ubuntu process
apk add openssh-server rsyslog logrotate iproute2 iputils net-tools sudo bash \
    util-linux

## Permissions on these should be the same as the host, so preserve them.
#cp -p /tmp/src/ssh-host-keys/ssh_host* /etc/ssh/

## Install default SSH key for root and app.
mkdir -p /root/.ssh
chmod 700 /root/.ssh
chown root:root /root/.ssh

echo console >> /etc/securetty

exit 0
