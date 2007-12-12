/*
 * EMULAB-COPYRIGHT
 * Copyright (c) 2000-2005 University of Utah and the Flux Group.
 * All rights reserved.
 */

/*
 * Shared for defintions for frisbee client/server code.
 */

#include <stdlib.h>
#include <stdio.h>
#include <limits.h>	/* CHAR_BIT */
#include <pthread.h>
#include <string.h>
#include <netinet/in.h>
#include <errno.h>
#include <inttypes.h>
#include <sys/time.h>

#include "log.h"

/*
 * Ethernet MTU (1514) - eth header (14) - min UDP/IP (28) - BLOCK msg
 * header (24).
 */
#define MAXBLOCKSIZE	1448

/*
 * Images are broken into chunks which are the standalone unit of decompression
 * Chunks are broken into blocks which are the unit of transmission
 */
#define CHUNKSIZE	1024
#define BLOCKSIZE	1024

/* This will allow for 2^16 chunks which allow for compressed images
 * to be up to 2^15*2^10*2^10 = 2^35 = 32 Terabytes */
typedef int16_t ChunkId_t;

/*
 * Make sure we can fit a block in a single ethernet MTU.
 * This limits the maximum block size to 1448 with the current protocol
 * headers on Ethernet.
 */
#if BLOCKSIZE > MAXBLOCKSIZE
#error "Invalid block size"
#endif

/*
 * Make sure we can represent a bitmap of blocks in a single packet.
 * This limits the maximum number of blocks in a chunk to 1448*8 == 11584.
 * With the maximum block size of 1448, this limits a chunk to no more
 * than 16,773,632 bytes (just under 16MB).
 */
#if (CHUNKSIZE%CHAR_BIT) != 0 || (CHUNKSIZE/CHAR_BIT) > MAXBLOCKSIZE
#error "Invalid chunk size"
#endif

/*
 * Chunk buffers and output write buffers constitute most of the memory
 * used in the system.  These should be sized to fit in the physical memory
 * of the client (forcing pieces of frisbee to be paged out to disk, even
 * if there is a swap disk to use, is not a very efficient way to load disks!)
 *
 * MAXCHUNKBUFS is the number of BLOCKSIZE*CHUNKSIZE chunk buffers used to
 * receive data from the network.  With the default values, these are 1MB
 * each.
 *
 * MAXWRITEBUFMEM is the amount, in MB, of write buffer memory in the client.
 * This is the amount of queued write data that can be pending.  A value of
 * zero means unlimited.
 *
 * The ratio of the number of these two buffer types depends on the ratio
 * of network to disk speed and the degree of compression in the image.
 */
#define MAXCHUNKBUFS	64	/* 64MB with default chunk size */
#define MAXWRITEBUFMEM	64	/* in MB */

/*
 * Socket buffer size, used for both send and receive in client and
 * server right now.
 */
#define SOCKBUFSIZE	(200 * 1024)

/*
 * The number of read-ahead chunks that the client will request
 * at a time. No point in requesting too far ahead either, since they
 * are uncompressed/written at a fraction of the network transfer speed.
 * Also, with multiple clients at different stages, each requesting blocks,
 * it is likely that there will be plenty more chunks ready or in progress.
 */
#define MAXREADAHEAD	2
#define MAXINPROGRESS	8

/*
 * Timeout (in usecs) for packet receive. The idletimer number is how
 * many PKT timeouts we allow before requesting more data from the server.
 * That is, if we go TIMEOUT usecs without getting a packet, then ask for
 * more.
 */
#define PKTRCV_TIMEOUT		30000
#define CLIENT_IDLETIMER_COUNT	3
#define TIMEOUT_HZ		(1000000 / PKTRCV_TIMEOUT)
#define TIMEOUT_HALFHZ		(TIMEOUT_HZ / 2)

/*
 * Timeout (in seconds!) server will hang around with no active clients.
 * Make it zero to never exit. 
 */
#define SERVER_INACTIVE_SECONDS	(60 * 30)

/*
 * The number of disk read blocks in a single read on the server.
 * Must be an integer divisor of CHUNKSIZE.
 */
#define SERVER_READ_SIZE	32

/*
 * Parameters for server network usage:
 *
 *	SERVER_BURST_SIZE	Max BLOCKSIZE packets sent in a burst.
 *				Should be a multiple of SERVER_READ_SIZE
 *				Should be less than SOCKBUFSIZE/BLOCKSIZE,
 *				bursts of greater than the send socket
 *				buffer size are almost certain to cause
 *				lost packets.
 *	SERVER_BURST_GAP	Delay in usec between output bursts.
 *				Given the typical scheduling granularity
 *				of 10ms for most unix systems, this
 *				will likely be set to either 0 or 10000.
 *				On FreeBSD we set the clock to 1ms
 *				granularity.
 *
 * Together with the BLOCKSIZE, these two params form a theoretical upper
 * bound on bandwidth consumption for the server.  That upper bound (for
 * ethernet) is:
 *
 *	(1000000 / SERVER_BURST_GAP)		# bursts per second
 *	* (BLOCKSIZE+24+42) * SERVER_BURST_SIZE	# * wire size of a burst
 *
 * which for the default 1k packets, gap of 1ms and burst of 16 packets
 * is about 17.4MB/sec.  That is beyond the capacity of a 100Mb ethernet
 * but with a 1ms granularity clock, the average gap size is going to be
 * 1.5ms yielding 11.6MB/sec.  In practice, the server is ultimately
 * throttled by clients' ability to generate requests which is limited by
 * their ability to decompress and write to disk.
 */
#define SERVER_BURST_SIZE	16
#define SERVER_BURST_GAP	2000

/*
 * Max burst size when doing dynamic bandwidth adjustment.
 * Needs to be large enough to induce loss.
 */ 
#define SERVER_DYNBURST_SIZE	128

/*
 * How long (in usecs) to wait before re-reqesting a chunk.
 * It will take the server more than:
 *
 *	(CHUNKSIZE/SERVER_BURST_SIZE) * SERVER_BURST_GAP
 *
 * usec (0.13 sec with defaults) for each each chunk it pumps out,
 * and we conservatively assume that there are a fair number of other
 * chunks that must be processed before it gets to our chunk.
 *
 * XXX don't like making the client rely on compiled in server constants,
 * lets just set it to 1 second right now.
 */
#define CLIENT_REQUEST_REDO_DELAY	1000000

/*
 * How long for the writer to sleep if there are no blocks currently
 * ready to write.  Allow a full server burst period, assuming that
 * something in the next burst will complete a block.
 */
#define CLIENT_WRITER_IDLE_DELAY	1000

/*
 * Paramaters for cache hints
 */
#define CACHE_HINT_SEND_INTERVAL	1000000 /* In usecs */
#define CACHE_HINT_TRIES		2

/*
 * Client parameters and statistics.
 */
#define CLIENT_STATS_VERSION	1
typedef struct {
	int	version;
	union {
		struct {
			int	runsec;
			int	runmsec;
			int	delayms;
			unsigned long long rbyteswritten;
			unsigned long long ebyteswritten;
			int	chunkbufs;
			int	maxreadahead;
			int	maxinprogress;
			int	pkttimeout;
			int	startdelay;
			int	idletimer;
			int	idledelay;
			int	redodelay;
			int	randomize;
			unsigned long	nochunksready;
			unsigned long	nofreechunks;
			unsigned long	dupchunk;
			unsigned long	dupblock;
			unsigned long	prequests;
			unsigned long	recvidles;
			unsigned long	joinattempts;
			unsigned long	requests;
			unsigned long	decompblocks;
			unsigned long	writeridles;
			int	writebufmem;
			unsigned long	lostblocks;
			unsigned long	rerequests;
		} v1;
		unsigned long limit[256];
	} u;
} ClientStats_t;

typedef struct {
	char		map[CHUNKSIZE/CHAR_BIT];
} BlockMap_t;

/*
 * Packet defs.
 */
#define MAX_CHUNKLST_SIZE ((MAXBLOCKSIZE - sizeof(int)*8)/sizeof(ChunkId_t))
typedef struct {
	struct {
		int		type;
		int		subtype;
		int		datalen; /* Useful amount of data in packet */
		unsigned int	srcip;   /* Filled in by network level. */
	} hdr;
	union {
		/*
		 * Join/leave the Team. Send a randomized ID, and receive
		 * the number of blocks in the file. This is strictly
		 * informational; the info is reported in the log file.
		 * We must return the number of chunks in the file though.
		 */
		union {
			unsigned int	clientid;
			int		blockcount;
		} join;
		
		struct {
			unsigned int	clientid;
			int		elapsed;	/* Stats only */
		} leave;

		/*
		 * A data block, indexed by chunk,block.
		 */
		struct {
			int		chunk;
			int		block;
			char		buf[BLOCKSIZE];
		} block;

		/*
		 * A request for a data block, indexed by chunk,block.
		 */
		struct {
			int		chunk;
			int		block;
			int		count;	/* Number of blocks */
		} request;

		/*
		 * Partial chunk request, a bit map of the desired blocks
		 * for a chunk.  An alternative to issuing multiple standard
		 * requests.  Retries is a hint to the server for congestion
		 * control, non-zero if this is a retry of an earlier request
		 * we made.
		 */
		struct {
			int		chunk;
			int		retries;
			BlockMap_t	blockmap;
		} prequest;

		/*
		 * Leave reporting client params/stats
		 */
		struct {
			unsigned int	clientid;
			int		elapsed;
			ClientStats_t	stats;
		} leave2;

		/*
		 * Report what is in the cache to the clients.
		 * & Reply to incache with what is needed by client.
		 */

		struct {
			int		size;
			ChunkId_t	data[MAX_CHUNKLST_SIZE];
		} chunklst;

	} msg;
} Packet_t;
#define PKTTYPE_REQUEST		1
#define PKTTYPE_REPLY		2

#define PKTSUBTYPE_JOIN		1
#define PKTSUBTYPE_LEAVE	2
#define PKTSUBTYPE_BLOCK	3
#define PKTSUBTYPE_REQUEST	4
#define PKTSUBTYPE_LEAVE2	5
#define PKTSUBTYPE_PREQUEST	6
#define PKTSUBTYPE_INCACHE	7
#define PKTSUBTYPE_NEED		8

/*
 * Struct to hold Network information.
 */
typedef struct {
	int		portnum;
	int		broadcast;
	struct in_addr	mcastaddr;
	struct in_addr	mcastif;
	int		sock;
	struct in_addr	myipaddr;
	int		nobufdelay;
	pthread_mutex_t * lock;
} NetInfo_t;

#define NETINFO_INIT {0,0,{0},{0},-1,{0},-1,NULL}

/*
 * Protos.
 */
int	ClientNetInit(NetInfo_t *ni);
int	ServerNetInit(NetInfo_t *ni);
int	ServerNetMCKeepAlive(NetInfo_t *ni);
unsigned long ClientNetID(NetInfo_t *ni);
int	PacketReceive(NetInfo_t *ni, Packet_t *p);
void	PacketSend(NetInfo_t *ni, Packet_t *p, int *resends);
void	PacketReply(NetInfo_t *ni, Packet_t *p);
int	PacketValid(NetInfo_t *ni, Packet_t *p, int nchunks);
void	dump_network(NetInfo_t *ni);

/*
 * Globals
 */

extern int		debug;

#define FRISBEE_CLIENT		1
#define FRISBEE_SERVER		2
#define FRISBEE_PROXY		4
extern int		FrisbeeMode;

#define PROXY_MODE (FrisbeeMode & FRISBEE_PROXY)

/*
 *
 */


typedef unsigned long long stamp_t;

static inline stamp_t
GetStamp()
{
	struct timeval tv;

	gettimeofday(&tv, 0);
	return (unsigned long long)tv.tv_sec * 1000000 + tv.tv_usec;
}


void MutexFail(int res, const char * str, const char * file, int lineno);

static inline void
_MutexLock(pthread_mutex_t * l, const char * file, int lineno)
{
	int res = pthread_mutex_lock(l);
	if (res != 0)
		MutexFail(res, "pthread_mutex_lock", file, lineno);
}

static inline int
_MutexTryLock(pthread_mutex_t * l, const char * file, int lineno)
{
	int res = pthread_mutex_trylock(l);
	if (res != 0 && res != EBUSY)
		MutexFail(res, "pthread_mutex_trylock", file, lineno);
	return res;
}


static inline void
_MutexUnlock(pthread_mutex_t * l, const char * file, int lineno)
{
	int res = pthread_mutex_unlock(l);
	if (res != 0)
		MutexFail(res, "pthread_mutex_unlock", file, lineno);
}

#define MutexLock(l)    _MutexLock(l, __FILE__, __LINE__)
#define MutexTryLock(l) _MutexTryLock(l, __FILE__, __LINE__)
#define MutexUnlock(l)  _MutexUnlock(l, __FILE__, __LINE__)

/* #define CHUNKBUFFER_LOCK_STATS 1 */
/* #define CHUNKBUFFER_LOCK_TIME  1 */

extern pthread_mutex_t ChunkBufferLock;

#ifndef CHUNKBUFFER_LOCK_STATS

#define GetChunkBufferLock() MutexLock(&ChunkBufferLock)
#define TryChunkBufferLock() MutexTryLock(&ChunkBufferLock)
#define ReleaseChunkBufferLock() MutexUnlock(&ChunkBufferLock);

#else

#define GetChunkBufferLock() _GetChunkBufferLock(__FILE__, __LINE__, 0)
#define TryChunkBufferLock()  _GetChunkBufferLock(__FILE__, __LINE__, 1)
#define ReleaseChunkBufferLock() _ReleaseChunkBufferLock(__FILE__, __LINE__)

int _GetChunkBufferLock(const char * file, int lineno, int tryonly);
void _ReleaseChunkBufferLock(const char * file, int lineno);

#endif

void PrintChunkBufferLockStats();

#define UNLOCKED 0
#define LOCKED   1

extern pthread_mutex_t  StartupLock;
extern pthread_cond_t   StartupCond;
extern int		StartupState;

#define STARTUP_CLIENT_READY 1
#define STARTUP_SERVER_READY 2

/*
 * Client
 */

extern int redodelay;

/*
 * The chunker data structure. For each chunk in progress, we maintain this
 * array of blocks (plus meta info). This serves as a cache to receive
 * blocks from the server while we write completed chunks to disk. The child
 * thread reads packets and updates this cache, while the parent thread
 * simply looks for completed blocks and writes them. The "inprogress" slot
 * serves a free/allocated flag, while the ready bit indicates that a chunk
 * is complete and ready to write to disk.
 *
 * If !neededself && !lastsent then a chunk may disappear at any time.
 * So be sure to use proper locking in this case.
 */

typedef struct {
	stamp_t    stamp;

	struct ChunkBufferData_t * d;

	ChunkId_t  thischunk;		/* Which chunk in progress */
	int8_t	   state;		/* State of chunk */
	int8_t	   hold;		/* Hold onto the chunk for one
 					 * reason or another */
	int8_t	   neededself;		/* If the chunk is needed by
					 * the client itself */
	int8_t	   pending;		/* Number of pending requests
					 * in the work queue */
	int8_t     reserved;
} ChunkBuffer_t;

typedef struct ChunkBufferData_t {
	int	   blockcount;		/* Number of blocks not received yet */
	BlockMap_t blockmap;		/* Which blocks have been received */
	struct {
		char	data[BLOCKSIZE];
	} blocks[CHUNKSIZE];		/* Actual block data */
} ChunkBufferData_t;

#define CHUNK_EMPTY	0
#define CHUNK_FILLING	1
#define CHUNK_FULL	2

#define NEEDED_EXPN 1
#define NEEDED_COMP 2


ChunkBuffer_t * GetCachedChunk(int chunkno);
int CalcFreeBufs();
void RequestRange(NetInfo_t *ni, int chunk, int block, int count, 
		  const char * forwho);
void RequestMissing(NetInfo_t *ni, int chunk, BlockMap_t *map, int count,
		    const char * forwho);
void RequestNeeded(NetInfo_t *ni, int chunk, BlockMap_t *map, int count,
		   const char * forwho);
int GetChunklst(ChunkId_t chunklst[]);
void HandleNeed(ChunkId_t chunklst[], int size);
ChunkBuffer_t * ReserveChunk(int chunk);
void DumpCache();

int ChunkOnDisk(int chunk);
ChunkBuffer_t * GetChunkFromDisk(int chunk, ChunkBuffer_t * d);

/*
 * Server
 */

extern int killme;
extern int ServerDone;
extern int UseCacheHints;
extern struct timeval LastReq;
int WorkQueueCount(int chunk);
void ServerSetFileInfo(int blocks);

/*
 * Proxy
 */

int AnyNeededForOthers();

/* Will lock */
void AddNeededForOthers(int chunk, int nblocks, BlockMap_t *blockmap);

/* RequestNeededForOthers returns the number of chunks it requested which were
 * not already in the cache */
/* Will lock */
int RequestNeededForOthers(NetInfo_t *ni, int timedout, stamp_t stamp);

int StartAuxThread(NetInfo_t * ni, pthread_t * t);

/*
 * CacheHelper
 */

static inline void
SyncMetaData(ChunkBuffer_t * p)
{
	if (UseCacheHints);
	else if (p->neededself || p->pending)
		p->hold = 1;
	else
		p->hold = 0;
	if (p->pending <= 0)
		p->reserved = 0;
}


