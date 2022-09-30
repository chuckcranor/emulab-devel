#!/bin/sh

DIR="/var/tmp"
STARTLOG="$DIR/startup.log"
START="$DIR/geni_startup.*"
FILES="$START $STARTLOG $DIR/startup-*.txt"

for file in $FILES
do
    echo "$file"
    echo "-----------------------------------------------------------"
    /bin/cat $file
    echo "-----------------------------------------------------------"
    echo ""
done

exit 0
