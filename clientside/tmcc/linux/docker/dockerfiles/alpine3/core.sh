#!/bin/sh

set -x

# add testing branch to repo for tcsh package
echo "@testing http://nl.alpinelinux.org/alpine/edge/testing" >> /etc/apk/repositories

apk update

# missing perl-modules package from ubuntu version
apk add ca-certificates sudo python wget patch nano file \
  perl perl-libwww psmisc tcsh@testing zsh mksh

#
# Create these traditional NFS mountpoints now.  Scripts get unhappy
# about them if they're not there.
#
mkdir -p /users /proj /groups /share

exit 0
