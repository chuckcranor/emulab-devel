#!/bin/sh

echo "Waiting for udev to settle..."
udevadm settle -t 0 \
    && stat -t /run/systemd/network/*.network \
    && exit 0
while true; do
    udevadm settle -t 5 \
        && stat -t /run/systemd/network/*.network
    if [ $? -eq 0 ]; then
	break
    else
	echo "Still waiting for udev to settle..."
    fi
    sleep 1
done

exit 0
