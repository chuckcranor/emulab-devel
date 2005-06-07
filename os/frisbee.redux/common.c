/*
 * EMULAB-COPYRIGHT
 * Copyright (c) 2000-2003 University of Utah and the Flux Group.
 * All rights reserved.
 */

#include "decls.h"

int		debug = 0;

pthread_mutex_t ChunkBufferLock = PTHREAD_MUTEX_INITIALIZER;

pthread_mutex_t	StartupLock = PTHREAD_MUTEX_INITIALIZER;
pthread_cond_t	StartupCond = PTHREAD_COND_INITIALIZER;
int		StartupState = 0;

int		redodelay = CLIENT_REQUEST_REDO_DELAY;

#ifdef CHUNKBUFFER_LOCK_STATS
int		ChunkBufferLockGets = 0;
int		ChunkBufferLockContention = 0;
stamp_t		ChunkBufferLockStart = 0;
const char *	ChunkBufferLockFile = "";
int		ChunkBufferLockLineNo = 0;
stamp_t		ChunkBufferLockMinTime = (stamp_t)-1;
stamp_t		ChunkBufferLockTotalTime = 0;
stamp_t		ChunkBufferLockMaxTime = 0;
const char *	ChunkBufferLockMaxFile = "";
int		ChunkBufferLockMaxLineNo = 0;

int
_GetChunkBufferLock(const char * file, int lineno, int tryonly) 
{
	int res = pthread_mutex_trylock(&ChunkBufferLock);
	if (res == EBUSY) {
		if (tryonly) return res;
		res = pthread_mutex_lock(&ChunkBufferLock);
		ChunkBufferLockContention++;
	}
	if (res != 0)
		MutexFail(res, "pthread_mutex_lock", file, lineno);
	ChunkBufferLockGets++;
#ifdef CHUNKBUFFER_LOCK_TIME
	ChunkBufferLockStart = GetStamp();
	ChunkBufferLockFile   = file;
	ChunkBufferLockLineNo = lineno;
#endif
	return 0;
}

void
_ReleaseChunkBufferLock(const char * file, int lineno) 
{
#ifdef CHUNKBUFFER_LOCK_TIME
	stamp_t stop, t;
	stop = GetStamp();
	t = stop - ChunkBufferLockStart;
	ChunkBufferLockTotalTime += t;
	if (t < ChunkBufferLockMinTime) 
		ChunkBufferLockMinTime = t;
	if (t > ChunkBufferLockMaxTime) {
		ChunkBufferLockMaxTime = t;
		ChunkBufferLockMaxFile = ChunkBufferLockFile;
		ChunkBufferLockMaxLineNo = ChunkBufferLockLineNo;
	}
#endif
	int res = pthread_mutex_unlock(&ChunkBufferLock);
	if (res != 0)
		MutexFail(res, "pthread_mutex_unlock", file, lineno);
}


void
PrintChunkBufferLockStats()
{
	printf("ChunkBuffer Lock Stats: %d/%d\n", 
	       ChunkBufferLockContention, ChunkBufferLockGets);
#ifdef CHUNKBUFFER_LOCK_TIME
	printf("ChunkBuffer Lock Time: %f %f %f\n",
	       ChunkBufferLockMinTime/1000000.0,
	       (double)ChunkBufferLockTotalTime/ChunkBufferLockGets/1000000.0,
	       ChunkBufferLockMaxTime/1000000.0);
	printf("Max Time Loc: %s: %d\n",
	       ChunkBufferLockMaxFile, ChunkBufferLockMaxLineNo);
#endif
}

#else

void
PrintChunkBufferLockStats()
{
	/* Nothing to do */
}

#endif

void
MutexFail(int res, const char * str, const char * file, int lineno)
{
	char buf[256];
	strerror_r(res, buf, 256);
	fprintf(stderr, "%s: %d: %s: %s\n", file, lineno, str, buf);
	abort();
}



