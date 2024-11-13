#!/bin/sh

DIR="/var/tmp"
FILES="$DIR/startup-*.txt"

for file in $FILES
do
    echo "----- Begin Execute Log --------------------------------"
    echo "$file"
    /bin/cat $file
    echo "----- End Execute Log ----------------------------------"
    echo ""
done

exit 0
