#!/bin/sh

# PROVIDE: densedebug
# REQUIRE: testbed
# KEYWORD: shutdown

case "$1" in
    start|faststart|quietstart|onestart|forcestart)
	/usr/testbed/sbin/daemon_wrapper -t -i 10 \
	   -l /usr/testbed/log/frontend-dense-ebc.log \
	   -p /var/run/frontend-dense-ebc.pid nc -d 10.11.13.192 111
  
	/usr/testbed/sbin/daemon_wrapper -t -i 10 \
	   -l /usr/testbed/log/frontend-dense-ustar.log \
	   -p /var/run/frontend-dense-ustar.pid nc -d 10.11.13.193 111

	    echo -n "dense-debugging"
	;;
    stop|faststop|quietstop|onestop|forcestop)
	if [ -r /var/run/frontend-dense-ebc.pid ]; then
	    kill `cat /var/run/frontend-dense-ebc.pid`
	fi
	if [ -r /var/run/frontend-dense-ustar.pid ]; then
	    kill `cat /var/run/frontend-dense-ustar.pid`
	fi
	;;
    *)
	echo ""
	echo "Usage: `basename $0` { start | stop }"
	echo ""
	exit 64
	;;
esac
exit 0
