#!/bin/csh -f
#
# $Id: copy-data.sh,v 1.1.12.1 2007-12-12 01:01:42 kevina Exp $
#
# Automates the archival process.

set dataDir	=	/u1/ellard/data
set archiveDir	=	/home/lair/ellard/Work/SOS/EECS-Traces/lair62

cd $dataDir

foreach f ( *.gz )
	if (! -f "$archiveDir/$f" ) then
		cp "$f" "$archiveDir/$f"
		cmp "$f" "$archiveDir/$f"
	endif
end

exit 0
