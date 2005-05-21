/*
 * EMULAB-COPYRIGHT
 * Copyright (c) 2000-2004 University of Utah and the Flux Group.
 * All rights reserved.
 */

#include "decls.h"

int		FrisbeeMode = FRISBEE_CLIENT;

int		killme = 0;
int		ServerDone = 0;

int client_main(int argc, char **argv);

int
main(int argc, char **argv)
{
        return client_main(argc, argv);
}

int 
RequestNeededForOthers(NetInfo_t *ni, int timedout, stamp_t stamp)
{
	return 0;
}

int
WorkQueueCount(int chunk)
{
	return 0;
}

void 
ServerSetFileInfo(int blocks)
{
	/* Nothing to do */
}

int AnyNeededForOthers()
{
	return 0;
}
