/*
 * EMULAB-COPYRIGHT
 * Copyright (c) 2000-2004 University of Utah and the Flux Group.
 * All rights reserved.
 */

/*
 * Stuff specific to when using Frisbee as a Proxy
 */

#include <stdlib.h>
#include "decls.h"
#include "utils.h"

typedef struct {
	pthread_mutex_t		lock;
	struct NeededNode	*head;
} Needed_t;

typedef struct NeededNode {
	int		chunk;		/* Which chunk */
	int		nblocks;	/* Number of blocks in map */
	BlockMap_t	blockmap;	/* Which blocks of the chunk */
	struct NeededNode * next;
} NeededNode_t;

Needed_t Needed = {PTHREAD_MUTEX_INITIALIZER, NULL};

int 
AnyNeededForOthers()
{
	Needed_t * ths = &Needed;
	return ths->head ? 1 : 0;
}

static void 
AddNeededI(Needed_t * ths,
	   int chunk, int nblocks, const BlockMap_t *blockmap,
	   NeededNode_t * n)
{
	NeededNode_t * cur;

	/* Check if the chunk is already on the list and if so merge */
	for (cur = ths->head; cur != NULL; cur = cur->next) {
		if (cur->chunk != chunk) continue;
		cur->nblocks += BlockMapMerge(blockmap, &cur->blockmap);
		if (n) free(n);
		return;
	}

	/* Otherwise add to the head of the list */
	if (!n) {
		n = malloc(sizeof(NeededNode_t));
		n->chunk = chunk;
		n->nblocks = nblocks;
		n->blockmap = *blockmap;
	}
	n->next = ths->head;
	ths->head = n;
}


void 
AddNeededForOthers(int chunk, int nblocks, BlockMap_t *blockmap)
{
	Needed_t * ths = &Needed;
	MutexLock(&ths->lock);
	AddNeededI(ths, chunk, nblocks, blockmap, NULL);
	MutexUnlock(&ths->lock);
}

int
RequestNeededForOthers(NetInfo_t *ni, int timedout, stamp_t stamp)
{
	Needed_t * ths = &Needed;
	NeededNode_t *cur = NULL;
	ChunkBuffer_t *cached,*avail;
	BlockMap_t need;
	int need_c = -1;
	int add_req_chunks = 0;

	while (1) {
		MutexLock(&ths->lock);
		if (ths->head) {
			cur = ths->head;
			ths->head = ths->head->next;
			GetChunkBufferLock();
			cached = GetCachedChunk(cur->chunk);
			/* If needed by self don't request as it has
			 * already been done. */
			if (cached && cached->neededself) {
				ReleaseChunkBufferLock();
				MutexUnlock(&ths->lock);
				continue;
			}
			avail = ReserveChunk(cur->chunk);
			if (!avail) {
				ReleaseChunkBufferLock();
				MutexUnlock(&ths->lock);
				continue;
			}
			if (cached) {
				need_c = BlockMapSubstract(&need, 
							   &cur->blockmap, 
							   &cached->d->blockmap);
			} else {
				need = cur->blockmap;
				need_c = cur->nblocks;
			}

			if (need_c == 0) {
				avail->reserved--;	
				ReleaseChunkBufferLock();	
				MutexUnlock(&ths->lock);
				continue;
			}

			ReleaseChunkBufferLock();	
		} else {
			cur = NULL;
			MutexUnlock(&ths->lock);
			break;
		}
		MutexUnlock(&ths->lock);
		RequestNeeded(ni, cur->chunk, &need, need_c, "clients");
		free(cur);
		if (!cached)
			add_req_chunks++;
	}

	return add_req_chunks;
}

static void
SigInfoHandler(int sig)
{
	/* This is used for debugging, I'm not sure if is 100% safe to
	   use in a signal handler since it writes to stdout --
	   kevina */
	DumpCache();
}

void *
AuxThread(void * arg)
{
	NetInfo_t      *ni = (NetInfo_t *)arg;
	Packet_t	packet, *p = &packet;

	MutexLock(&StartupLock);
	while (!(StartupState & STARTUP_CLIENT_READY)) {
		pthread_cond_wait(&StartupCond, &StartupLock);
	}
	MutexUnlock(&StartupLock);

	log("Aux Thread Starting");

	/* signal(SIGINFO, SigInfoHandler); */

	while (1) {
		fsleep(CACHE_HINT_SEND_INTERVAL);
		/* DumpCache(); */
		p->hdr.type = PKTTYPE_REQUEST;
		p->hdr.subtype = PKTSUBTYPE_INCACHE;
		p->hdr.datalen = sizeof(p->msg.chunklst);
		p->msg.chunklst.size = GetChunklst(p->msg.chunklst.data);
		if (p->msg.chunklst.size < 0) 
			continue;
		if (debug)
			log("Sending cache hint: %d ...", p->msg.chunklst.data[0]);
		PacketSend(ni, p, 0);
	}

	return NULL;
}

int
StartAuxThread(NetInfo_t * ni, pthread_t * t)
{
	int res;
	if (UseCacheHints) {
		res = pthread_create(t, NULL, AuxThread, ni);
		if (res)
			fatal("Failed to create pthread!");
		return 1;
	} else {
		return 0;
	}
}
