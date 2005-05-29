/*
 * EMULAB-COPYRIGHT
 * Copyright (c) 2000-2003 University of Utah and the Flux Group.
 * All rights reserved.
 */

#include "decls.h"

int		debug = 0;

pthread_mutex_t GlobalLock = PTHREAD_MUTEX_INITIALIZER;

pthread_mutex_t	StartupLock = PTHREAD_MUTEX_INITIALIZER;
pthread_cond_t	StartupCond = PTHREAD_COND_INITIALIZER;
int		StartupState = 0;

#ifdef GLOBAL_LOCK_STATS
int		GlobalLockGets = 0;
int		GlobalLockContention = 0;
stamp_t		GlobalLockStart = 0;
const char *	GlobalLockFile = "";
int		GlobalLockLineNo = 0;
stamp_t		GlobalLockMinTime = (stamp_t)-1;
stamp_t		GlobalLockTotalTime = 0;
stamp_t		GlobalLockMaxTime = 0;
const char *	GlobalLockMaxFile = "";
int		GlobalLockMaxLineNo = 0;

void
_GetGlobalLock(const char * file, int lineno) 
{
	//fprintf(stderr, "GETTING LOCK\n");
	int res = pthread_mutex_trylock(&GlobalLock);
	if (res == EBUSY) {
		res = pthread_mutex_lock(&GlobalLock);
		GlobalLockContention++;
	} 
	MutexCheck(res, "pthread_mutex_lock");
	GlobalLockGets++;
#ifdef GLOBAL_LOCK_TIME
	GlobalLockStart = GetStamp();
	GlobalLockFile   = file;
	GlobalLockLineNo = lineno;
#endif
	//fprintf(stderr, "GOT LOCK\n");
}

void
ReleaseGlobalLock() 
{
	//fprintf(stderr, "RELEASING LOCK\n");
#ifdef GLOBAL_LOCK_TIME
	stamp_t stop, t;
	stop = GetStamp();
	t = stop - GlobalLockStart;
	GlobalLockTotalTime += t;
	if (t < GlobalLockMinTime) 
		GlobalLockMinTime = t;
	if (t > GlobalLockMaxTime) {
		GlobalLockMaxTime = t;
		GlobalLockMaxFile = GlobalLockFile;
		GlobalLockMaxLineNo = GlobalLockLineNo;
	}
#endif
	int res = pthread_mutex_unlock(&GlobalLock);
	MutexCheck(res, "pthread_mutex_unlock");
	//fprintf(stderr, "RELEASED LOCK\n");
}


void
PrintGlobalLockStats()
{
	printf("Global Lock Stats: %d/%d\n", 
	       GlobalLockContention, GlobalLockGets);
#ifdef GLOBAL_LOCK_TIME
	printf("Global Lock Time: %f %f %f\n",
	       GlobalLockMinTime/1000000.0,
	       (double)GlobalLockTotalTime/GlobalLockGets/1000000.0,
	       GlobalLockMaxTime/1000000.0);
	printf("Max Time Loc: %s: %d\n",
	       GlobalLockMaxFile, GlobalLockMaxLineNo);
#endif
}

#else

void
PrintGlobalLockStats()
{
	/* Nothing to do */
}

#endif
