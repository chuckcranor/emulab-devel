#!/bin/sh

# PROVIDE: densedebug
# REQUIRE: testbed
# KEYWORD: shutdown

SITES="wasatch mario moran guesthouse ebc ustar"

if [ -n "$2" ]; then
    SITES=$2
fi

case "$1" in
    start|faststart|quietstart|onestart|forcestart)
	for dbs in $SITES; do
	    /usr/testbed/sbin/frontend-logger -i 10 \
		-l /usr/testbed/archive/log/frontend/frontend-dense-$dbs.log \
		-p /var/run/frontend-dense-$dbs.pid $dbs
	    sleep 1
	done
	echo -n "dense-debugging"
	;;
    stop|faststop|quietstop|onestop|forcestop)
	for dbs in $SITES; do
	    if [ -r /var/run/frontend-dense-$dbs.pid ]; then
		kill `cat /var/run/frontend-dense-$dbs.pid`
	    fi
	done
	;;
    *)
	echo ""
	echo "Usage: `basename $0` { start | stop }"
	echo ""
	exit 64
	;;
esac
exit 0
