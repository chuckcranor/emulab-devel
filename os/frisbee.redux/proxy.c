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
	struct NeededNode	*head;
} Needed_t;

typedef struct NeededNode {
	int		chunk;		/* Which chunk */
	int		nblocks;	/* Number of blocks in map */
	BlockMap_t	blockmap;	/* Which blocks of the chunk */
	struct NeededNode * next;
} NeededNode_t;

Needed_t Needed = {NULL};

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
	GetGlobalLock();
	AddNeededI(ths, chunk, nblocks, blockmap, NULL);
	ReleaseGlobalLock();
}

int
RequestNeededForOthers(NetInfo_t *ni, int timedout, stamp_t stamp)
{
	Needed_t * ths = &Needed;
	NeededNode_t *cur = NULL, *unsent = NULL;
	ChunkBuffer_t *cached;
	BlockMap_t need;
	int need_c = -1;
	int sent;
	int add_req_chunks = 0;
	int availbufs;

	if (!ths->head)
		return 0;

	GetGlobalLock();

	availbufs = CalcFreeBufs(NULL);

	while (1) {
		if (ths->head) {
			cur = ths->head;
			ths->head = ths->head->next;
			cached = GetCachedChunk(cur->chunk);
			/* If needed by self don't request as it has
			 * already been done. */
			if (cached && cached->neededself) {
				continue;
			} else if (cached) {
				need_c = BlockMapSubstract(&need, 
							   &cur->blockmap, 
							   &cached->d->blockmap);
			} else if (availbufs) {
				need = cur->blockmap;
				need_c = cur->nblocks;
			} else { // cached && cached->neededself
				continue;
			}
			
			if (need_c == 0)
				continue;
		} else {
			cur = NULL;
			break;
		}
		sent = PossiblyRequestNeeded(ni, timedout, stamp,
					     cur->chunk, &need, need_c, 
					     LOCKED);
		if (sent) {
			if (debug)
				log("Requested %d blocks of chunk:%d for clients.",
				    need_c, cur->chunk);
			free(cur);
			if (!cached) {
				add_req_chunks++;
				availbufs--;
			}
		} else {
			cur->next = unsent;
			unsent = cur;
		}
	}

	if (unsent) {
		while (unsent) {
			cur = unsent;
			unsent = unsent->next;
			AddNeededI(ths, cur->chunk, cur->nblocks, &cur->blockmap, cur);
		}
	}

	ReleaseGlobalLock();
	return add_req_chunks;
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

	while (1) {
		fsleep(1000000);
		p->hdr.type = PKTTYPE_REQUEST;
		p->hdr.subtype = PKTSUBTYPE_INCACHE;
		p->hdr.datalen = sizeof(p->msg.incache);
		p->msg.incache.size = GetChunklst(p->msg.incache.chunklst);
		if (p->msg.incache.size < 0) 
			continue;
		if (debug)
			log("Sending cache hint: %d ...", p->msg.incache.chunklst[0]);
		PacketSend(ni, p, 0);
	}
	return NULL;
}

int
StartAuxThread(NetInfo_t * ni, pthread_t * t)
{
	int res;
	if (PROXY_MODE && SendCacheHints) {
		res = pthread_create(t, NULL, AuxThread, ni);
		if (res)
			fatal("Failed to create pthread!");
		return 1;
	} else {
		return 0;
	}
}
