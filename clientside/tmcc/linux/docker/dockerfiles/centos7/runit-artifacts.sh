#!/bin/sh

#
# Builds the artifacts required for runit on CentOS/Fedora (namely,
# runit itself, since runit is not packaged for those distros).
#

if [ -n "$DESTDIR" ]; then
    export DESTDIR="$DESTDIR/runit"
    mkdir -p $DESTDIR
fi

[ ! -f /tmp/yum-updated ] && yum makecache && touch /tmp/yum-updated

yum -y install rpmdevtools git glibc-static which gcc make
yum -y install gcc make
cd /tmp
git clone https://github.com/imeyer/runit-rpm runit-rpm
cd runit-rpm
./build.sh
cp -p ~/rpmbuild/RPMS/*/*.rpm $DESTDIR/
cd /tmp
rm -rf runit-rpm ~/rpmbuild

exit 0
