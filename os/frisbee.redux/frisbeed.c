/*
 * EMULAB-COPYRIGHT
 * Copyright (c) 2000-2004 University of Utah and the Flux Group.
 * All rights reserved.
 */

#include <stdlib.h>

#include "decls.h"

int		FrisbeeMode = FRISBEE_SERVER;

int server_main(int argc, char **argv);

int
main(int argc, char **argv)
{
        return server_main(argc, argv);
}

ChunkBuffer_t * 
GetCachedChunk(int chunkno)
{
	/* This function should only be called when in proxy mode */
	abort(); 
	return 0;
}

void 
AddNeededForOthers(int chunk, int nblocks, BlockMap_t *blockmap)
{
	/* Nothing to do */
}

int
StartAuxThread(NetInfo_t * ni, pthread_t * t)
{
	return 0;
}
