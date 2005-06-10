/*
 * EMULAB-COPYRIGHT
 * Copyright (c) 2000-2003 University of Utah and the Flux Group.
 * All rights reserved.
 */

#include <time.h>
#include <string.h>

static inline int
pasttime(struct timeval *cur, struct timeval *next)
{
	return (cur->tv_sec > next->tv_sec ||
		(cur->tv_sec == next->tv_sec &&
		 cur->tv_usec >= next->tv_usec));
}

static inline void
addtime(struct timeval *next, struct timeval *cur, struct timeval *inc)
{
	next->tv_sec = cur->tv_sec + inc->tv_sec;
	next->tv_usec = cur->tv_usec + inc->tv_usec;
	if (next->tv_usec >= 1000000) {
		next->tv_usec -= 1000000;
		next->tv_sec++;
	}
}

static inline void
subtime(struct timeval *next, struct timeval *cur, struct timeval *dec)
{
	if (cur->tv_usec < dec->tv_usec) {
		next->tv_usec = (cur->tv_usec + 1000000) - dec->tv_usec;
		next->tv_sec = (cur->tv_sec - 1) - dec->tv_sec;
	} else {
		next->tv_usec = cur->tv_usec - dec->tv_usec;
		next->tv_sec = cur->tv_sec - dec->tv_sec;
	}
}

static inline void
addusec(struct timeval *next, struct timeval *cur, unsigned long usec)
{
	next->tv_sec = cur->tv_sec;
	next->tv_usec = cur->tv_usec + usec;
	while (next->tv_usec >= 1000000) {
		next->tv_usec -= 1000000;
		next->tv_sec++;
	}
}

static inline long
cmptime(const struct timeval * x, const struct timeval * y)
{
	long d;
	d = x->tv_sec - y->tv_sec;
	if (d != 0) return d;
	d = x->tv_usec - y->tv_usec;
	return d;
}

/* Prototypes */
char   *CurrentTimeString(void);
int	sleeptime(unsigned int usecs, char *str, int doround);
int	fsleep(unsigned int usecs);
int	sleeptil(struct timeval *nexttime);
void	BlockMapInit(BlockMap_t *blockmap, int block, int count);
void	BlockMapAdd(BlockMap_t *blockmap, int block, int count);
int	BlockMapAlloc(BlockMap_t *blockmap, int block);
int	BlockMapIsAlloc(const BlockMap_t *blockmap, int block, int count);
int	BlockMapExtract(BlockMap_t *blockmap, int *blockp);
void	BlockMapInvert(const BlockMap_t *oldmap, BlockMap_t *newmap);
int	BlockMapMerge(const BlockMap_t *frommap, BlockMap_t *tomap);
int     BlockMapSubstract(BlockMap_t *dest, const BlockMap_t *x, const BlockMap_t *y);
int	BlockMapFirst(BlockMap_t *blockmap);
int	BlockMapApply(BlockMap_t *blockmap, int chunk,
		      void (*func)(int, int, int, void *), void *farg);
void	ClientStatsDump(unsigned int id, ClientStats_t *stats);

static inline void
BlockMapClear(BlockMap_t *blockmap)
{
	memset(blockmap, 0, sizeof(BlockMap_t));
}

static inline void
BlockMapSetAll(BlockMap_t *blockmap)
{
	memset(blockmap, 0xFF, sizeof(BlockMap_t));
}

static inline int
BlockMapHave(const BlockMap_t *blockmap, int block)
{
	return blockmap->map[block/CHAR_BIT] & (1 << (block % CHAR_BIT));
}

static inline int
BlockMapSet(BlockMap_t *blockmap, int block, int val)
{
	int prev = BlockMapHave(blockmap, block);
	if (val)
		blockmap->map[block/CHAR_BIT] |= (1 << (block % CHAR_BIT));
	else
		blockmap->map[block/CHAR_BIT] &= ~(1 << (block % CHAR_BIT));
	return prev;
}

static inline int
BlockMapCount(const BlockMap_t *blockmap)
{
	return BlockMapIsAlloc(blockmap, 0, BLOCKSIZE);
}

