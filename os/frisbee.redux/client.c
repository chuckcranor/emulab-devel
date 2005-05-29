/*
 * EMULAB-COPYRIGHT
 * Copyright (c) 2000-2005 University of Utah and the Flux Group.
 * All rights reserved.
 */

/*
 * Frisbee client.
 *
 * TODO: Deal with a dead server. Its possible that too many clients
 * could swamp the boss with unanswerable requests. Might need some 
 * backoff code.
 */
#include <sys/types.h>
#include <sys/socket.h>
#include <netinet/in.h>
#include <arpa/inet.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <syslog.h>
#include <signal.h>
#include <stdarg.h>
#include <pthread.h>
#include <assert.h>
#include "decls.h"
#include "utils.h"
#include "trace.h"

#ifdef DOEVENTS
#include "event.h"

static char *eventserver;
static Event_t event;
static int exitstatus;
#endif

/* Tunable constants */
static int	maxchunkbufs = MAXCHUNKBUFS;
static int	maxwritebufmem = MAXWRITEBUFMEM;
static int	maxmem = 0;
static int	pkttimeout = PKTRCV_TIMEOUT;
static int	idletimer = CLIENT_IDLETIMER_COUNT;
static int	maxreadahead = MAXREADAHEAD;
static int	maxinprogress = MAXINPROGRESS;
static int	redodelay = CLIENT_REQUEST_REDO_DELAY;
static int	idledelay = CLIENT_WRITER_IDLE_DELAY;
static int	startdelay = 0, startat = 0;

static int		nothreads = 0;
static int		nodecompress = 0;
static int		tracing = 0;
static char		traceprefix[64];
static int		randomize = 1;
static struct timeval stamp;
static struct in_addr serverip;

/* Forward Decls */
static void	PlayFrisbee(NetInfo_t *ni);
static void	GotBlock(NetInfo_t *ni, Packet_t *p);
static void	RequestChunk(NetInfo_t *ni, int timedout);
static void	RequestStamp(int chunk, int block, int count, void *arg);
static int	RequestRedoTime(int chunk, unsigned long long curtime);
extern int	ImageUnzipInit(char *filename, int slice, int debug, int zero,
			       int nothreads, int dostype, int dodots,
			       unsigned long writebufmem);
extern void	ImageUnzipSetChunkCount(unsigned long chunkcount);
extern void	ImageUnzipSetMemory(unsigned long writebufmem);
extern int	ImageWriteChunk(int chunkno, char *chunkdata);
extern int	ImageUnzipChunk(char *chunkdata);
extern void	ImageUnzipFlush(void);
extern int	ImageUnzipQuit(void);

/*
 * Chunk descriptor, one for each CHUNKSIZE*BLOCKSIZE bytes of an image file.
 * For each chunk, record its state and the time at which it was last
 * requested by someone.  Ours indicates a previous request was made by us.
 */
typedef struct {
	unsigned long long lastreq:62;
	unsigned long long ours:1;
	unsigned long long done:1;
} Chunk_t;

Chunk_t		  *Chunks;		/* Chunk descriptors */
ChunkBuffer_t     *ChunkBuffer;		/* The cache */
ChunkBufferData_t *ChunkBufferData;	/* The cache */
ChunkId_t         *ChunkBufferIdx;      /* Index into the Cache */
int		  TotalChunkCount;	/* Total number of chunks in file */
int		  IdleCounter;		/* Countdown to request more data */


/* The ChunkRequestList is the order in which new chunks are
 * requested.  The first list is a given to by the server and is a
 * hint to the order in which to request chunks in order to be able to
 * get data that is already in its cache.  The second is the complete
 * list of chunks, which is generally in a random order. */
typedef struct {
	int		size; 
 	ChunkId_t	*data;
	pthread_mutex_t *lock;
} ChunkRequestList_t;
pthread_mutex_t ChunkRequestListLock = PTHREAD_MUTEX_INITIALIZER;
ChunkRequestList_t ChunkRequestLists[2] = {{0, NULL, &ChunkRequestListLock}, 
					   {0, NULL, NULL}};

#ifdef STATS
extern unsigned long decompblocks, writeridles;	/* XXX imageunzip.c */
static ClientStats_t	Stats;
#define DOSTAT(x)	(Stats.u.v1.x)
#else
#define DOSTAT(x)
#endif

static char *usagestr = 
 "usage: frisbee [-drzbn] [-s #] <-p #> <-m ipaddr> <output filename>\n"
 " -d              Turn on debugging. Multiple -d options increase output.\n"
 " -r              Randomly delay first request by up to one second.\n"
 " -z              Zero fill unused block ranges (default is to seek past).\n"
 " -b              Use broadcast instead of multicast\n"
 " -n              Do not use extra threads in diskwriter\n"
 " -p portnum      Specify a port number.\n"
 " -m mcastaddr    Specify a multicast address in dotted notation.\n"
 " -i mcastif      Specify a multicast interface in dotted notation.\n"
 " -s slice        Output to DOS slice (DOS numbering 1-4)\n"
 "                 NOTE: Must specify a raw disk device for output filename.\n"
 "\n"
 "tuning options (if you don't know what they are, don't use em!):\n"
 " -C MB           Max MB of memory to use for network chunk buffering.\n"
 " -W MB           Max MB of memory to use for disk write buffering.\n"
 " -M MB           Max MB of memory to use for buffering\n"
 "                 (Half used for network, half for disk).\n"
 " -I ms           The time interval (millisec) between re-requests of a chunk.\n"
 " -R #            The max number of chunks we will request ahead.\n"
 " -O              Make chunk requests in increasing order (default is random order).\n"
 "\n";

static void
usage()
{
	fprintf(stderr, usagestr);
	exit(1);
}

void (*DiskIdleCallback)();
static void
WriterIdleCallback(int isidle)
{
	CLEVENT(1, EV_CLIWRSTATUS, isidle, 0, 0, 0);
}

int StartClient(NetInfo_t * ni);

int
client_main(int argc, char **argv)
{
	int	ch, mem;
	char   *filename;
	int	zero = 0;
	int	dostype = -1;
        int     slice = 0;
	NetInfo_t ni = NETINFO_INIT;
	int	_debug = 0;

        optreset = 1;
        optind = 1;
	while ((ch = getopt(argc, argv, "dhp:m:s:i:tbznT:r:E:D:C:W:S:M:R:I:ON")) != -1)
		switch(ch) {
		case 'd':
                        _debug++;
			break;
			
		case 'b':
			ni.broadcast = 1;
			break;
			
#ifdef DOEVENTS
		case 'E':
			eventserver = optarg;
			break;
#endif

		case 'p':
			ni.portnum = atoi(optarg);
			break;
			
		case 'm':
			inet_aton(optarg, &ni.mcastaddr);
			break;

		case 'n':
			nothreads++;
			break;

		case 'i':
			inet_aton(optarg, &ni.mcastif);
			break;

		case 'r':
			startdelay = atoi(optarg);
			break;

		case 's':
			slice = atoi(optarg);
			break;

		case 'S':
			if (!inet_aton(optarg, &serverip)) {
				fprintf(stderr, "Invalid server IP `%s'\n",
					optarg);
				exit(1);
			}
			break;

		case 't':
			tracing++;
			break;

		case 'T':
			strncpy(traceprefix, optarg, sizeof(traceprefix));
			break;

		case 'z':
			zero++;
			break;

		case 'D':
			dostype = atoi(optarg);
			break;

		case 'C':
			mem = atoi(optarg);
			if (mem < 1)
				mem = 1;
			else if (mem > 1024)
				mem = 1024;
			maxchunkbufs = (mem * 1024 * 1024) /
				(sizeof(ChunkBuffer_t) + sizeof(ChunkBufferData_t));
			break;

		case 'W':
			mem = atoi(optarg);
			if (mem < 1)
				mem = 1;
			else if (mem > 1024)
				mem = 1024;
			maxwritebufmem = mem;
			break;

		case 'M':
			mem = atoi(optarg);
			if (mem < 2)
				mem = 2;
			else if (mem > 2048)
				mem = 2048;
			maxmem = mem;
			break;

		case 'R':
			maxreadahead = atoi(optarg);
			if (maxinprogress < maxreadahead * 4) {
				maxinprogress = maxreadahead * 4;
				if (maxinprogress > maxchunkbufs)
					maxinprogress = maxchunkbufs;
			}
			break;

		case 'I':
			redodelay = atoi(optarg) * 1000;
			if (redodelay < 0)
				redodelay = 0;
			break;

		case 'O':
			randomize = 0;
			break;

		case 'N':
			nodecompress = 1;
			break;

		case 'h':
		case '?':
		default:
			usage();
		}

	if (_debug > debug) 
		debug = _debug;

	argc -= optind;
	argv += optind;

	if (argc != 1)
		usage();
	filename = argv[0];

	if (!ni.portnum || ! ni.mcastaddr.s_addr)
		usage();

	
	ClientLogInit();
	ClientNetInit(&ni);

#ifdef DOEVENTS
	if (eventserver != NULL && EventInit(eventserver) != 0) {
		log("Failed to initialize event system, events ignored");
		eventserver = NULL;
	}
	if (eventserver != NULL) {
		log("Waiting for START event...");
		EventWait(EV_ANY, &event);
		if (event.type != EV_START)
			goto done;

	again:
		if (event.data.start.startdelay > 0)
			startdelay = event.data.start.startdelay;
		else
			startdelay = 0;
		if (event.data.start.startat > 0)
			startat = event.data.start.startat;
		else
			startat = 0;
		if (event.data.start.pkttimeout >= 0)
			pkttimeout = event.data.start.pkttimeout;
		else
			pkttimeout = PKTRCV_TIMEOUT;
		if (event.data.start.idletimer >= 0)
			idletimer = event.data.start.idletimer;
		else
			idletimer = CLIENT_IDLETIMER_COUNT;
		if (event.data.start.chunkbufs >= 0 &&
		    event.data.start.chunkbufs <= 1024)
			maxchunkbufs = event.data.start.chunkbufs;
		else
			maxchunkbufs = MAXCHUNKBUFS;
		if (event.data.start.writebufmem >= 0 &&
		    event.data.start.writebufmem < 4096)
			maxwritebufmem = event.data.start.writebufmem;
		else
			maxwritebufmem = MAXWRITEBUFMEM;
		if (event.data.start.maxmem >= 0 &&
		    event.data.start.maxmem < 4096)
			maxmem = event.data.start.maxmem;
		else
			maxmem = 0;
		if (event.data.start.readahead >= 0 &&
		    event.data.start.readahead <= maxchunkbufs)
			maxreadahead = event.data.start.readahead;
		else
			maxreadahead = MAXREADAHEAD;
		if (event.data.start.inprogress >= 0 &&
		    event.data.start.inprogress <= maxchunkbufs)
			maxinprogress = event.data.start.inprogress;
		else
			maxinprogress = MAXINPROGRESS;
		if (event.data.start.redodelay >= 0)
			redodelay = event.data.start.redodelay;
		else
			redodelay = CLIENT_REQUEST_REDO_DELAY;
		if (event.data.start.idledelay >= 0)
			idledelay = event.data.start.idledelay;
		else
			idledelay = CLIENT_WRITER_IDLE_DELAY;

		if (event.data.start.slice >= 0)
			slice = event.data.start.slice;
		else
			slice = 0;
		if (event.data.start.zerofill >= 0)
			zero = event.data.start.zerofill;
		else
			zero = 0;
		if (event.data.start.randomize >= 0)
			randomize = event.data.start.randomize;
		else
			randomize = 1;
		if (event.data.start.nothreads >= 0)
			nothreads = event.data.start.nothreads;
		else
			nothreads = 0;
		if (event.data.start.dostype >= 0)
			dostype = event.data.start.dostype;
		else
			dostype = -1;
		if (event.data.start.debug >= 0)
			debug = event.data.start.debug;
		else
			debug = 0;
		if (event.data.start.trace >= 0)
			tracing = event.data.start.trace;
		else
			tracing = 0;
		if (event.data.start.traceprefix[0] > 0)
			strncpy(traceprefix, event.data.start.traceprefix, 64);
		else
			traceprefix[0] = 0;

		log("Starting: slice=%d, startat=%d, startdelay=%d, zero=%d, "
		    "randomize=%d, nothreads=%d, debug=%d, tracing=%d, "
		    "pkttimeout=%d, idletimer=%d, idledelay=%d, redodelay=%d, "
		    "maxmem=%d, chunkbufs=%d, maxwritebumfem=%d, "
		    "maxreadahead=%d, maxinprogress=%d",
		    slice, startat, startdelay, zero, randomize, nothreads,
		    debug, tracing, pkttimeout, idletimer, idledelay, redodelay,
		    maxmem, maxchunkbufs, maxwritebufmem,
		    maxreadahead, maxinprogress);
	}
#endif

	redodelay = sleeptime(redodelay, "request retry delay", 0);
	idledelay = sleeptime(idledelay, "writer idle delay", 0);

	/*
	 * Set initial memory limits.  These may be adjusted when we
	 * find out how big the image is.
	 */
	if (maxmem != 0) {
		/* XXX divide it up 50/50 */
		maxchunkbufs = (maxmem/2 * 1024*1024) / (sizeof(ChunkBuffer_t) + sizeof(ChunkBufferData_t));
		maxwritebufmem = maxmem/2;
	}

	ImageUnzipInit(filename, slice, debug, zero, nothreads, dostype, 3,
		       maxwritebufmem*1024*1024);

	if (tracing) {
		ClientTraceInit(traceprefix);
		TraceStart(tracing);
		if (!nothreads)
			DiskIdleCallback = WriterIdleCallback;
	}

	PlayFrisbee(&ni);

	if (tracing) {
		TraceStop();
		TraceDump();
	}

	ImageUnzipQuit();

#ifdef DOEVENTS
	if (eventserver != NULL) {
		log("Waiting for START/STOP event...");
		EventWait(EV_ANY, &event);
		if (event.type == EV_START) {
#ifdef STATS
			memset(&Stats, 0, sizeof(Stats));
#endif
			goto again;
		}
	done:
		if (event.type == EV_STOP && event.data.stop.exitstatus >= 0)
			exitstatus = event.data.stop.exitstatus;
		return exitstatus; /* Don't use exit since client_main
                                      may need to return */
	}
#endif

        return 0; /* Don't use exit since client_main may need to
                     return */
}

/*
 * The client receive thread. This thread takes in packets from the server.
 */
void *
ClientRecvThread(void *arg)
{
	NetInfo_t      *ni = (NetInfo_t *)arg;
	Packet_t	packet, *p = &packet;
	int		BackOff;
	static int	gotone;

	if (debug)
		log("Receive pthread starting up ...");

	/*
	 * Use this to control the rate at which we request blocks.
	 * The IdleCounter is how many ticks we let pass without a
	 * useful block, before we make another request. We want that to
	 * be short, but not too short; we do not want to pummel the
	 * server. 
	 */
	IdleCounter = idletimer;

	/*
	 * This is another throttling mechanism; avoid making repeated
	 * requests to a server that is not running. That is, if the server
	 * is not responding, slowly back off our request rate (to about
	 * one a second) until the server starts responding.  This will
	 * prevent a large group of clients from pummeling the server
	 * machine, when there is no server running to respond (say, if the
	 * server process died).
	 */
	BackOff = 0;

	while (1) {
#ifdef NEVENTS
		static int needstamp = 1;
		struct timeval pstamp;
		if (needstamp) {
			gettimeofday(&pstamp, 0);
			needstamp = 0;
		}
#endif

		/*
		 * If we go too long without getting a block, we want
		 * to make another chunk request.
		 *
		 * XXX fixme: should probably be if it hasn't received
		 * a block that it is able to make use of.  But that has
		 * problems in that any new request we make will wind up
		 * at the end of the server work list, and we might not
		 * see that block for longer than our timeout period,
		 * leading us to issue another request, etc.
		 */
		if (PacketReceive(ni, p) != 0) {
		        pthread_testcancel();
			if (--IdleCounter <= 0) {
				if (gotone)
					DOSTAT(recvidles++);
				CLEVENT(2, EV_CLIRTIMO,
					pstamp.tv_sec, pstamp.tv_usec, 0, 0);
#ifdef NEVENTS
				needstamp = 1;
#endif
				RequestChunk(ni, 1);
				IdleCounter = idletimer;

				if (BackOff++) {
					IdleCounter += BackOff;
					if (BackOff > TIMEOUT_HZ)
						BackOff = TIMEOUT_HZ;
				}
			}
			continue;
		}
		pthread_testcancel();
		gotone = 1;
		
		if (! PacketValid(ni, p, TotalChunkCount)) {
			log("received bad packet %d/%d, ignored",
			    p->hdr.type, p->hdr.subtype);
			continue;
		}

		switch (p->hdr.subtype) {
		case PKTSUBTYPE_BLOCK:
			/*
			 * Ensure blocks comes from where we expect.
			 * The validity of hdr.srcip has already been checked.
			 */
			if (serverip.s_addr != 0 &&
			    serverip.s_addr != p->hdr.srcip) {
				struct in_addr tmp = { p->hdr.srcip };
				log("received BLOCK from non-server %s",
				    inet_ntoa(tmp));
				continue;
			}

			CLEVENT(BackOff ? 1 : 3, EV_CLIGOTPKT,
				pstamp.tv_sec, pstamp.tv_usec, 0, 0);
#ifdef NEVENTS
			needstamp = 1;
#endif
			BackOff = 0;
			GotBlock(ni, p);
			/*
			 * We may have missed the request for this chunk/block
			 * so treat the arrival of a block as an indication
			 * that someone requested it.
			 */
			RequestStamp(p->msg.block.chunk, p->msg.block.block,
				     1, 0);
			break;

		case PKTSUBTYPE_REQUEST:
			CLEVENT(4, EV_CLIREQMSG,
				p->hdr.srcip, p->msg.request.chunk,
				p->msg.request.block, p->msg.request.count);
			RequestStamp(p->msg.request.chunk, p->msg.request.block,
				     p->msg.request.count, 0);
			break;

		case PKTSUBTYPE_PREQUEST:
			CLEVENT(4, EV_CLIPREQMSG,
				p->hdr.srcip, p->msg.request.chunk, 0, 0);
			BlockMapApply(&p->msg.prequest.blockmap,
				      p->msg.prequest.chunk, RequestStamp, 0);
			break;

		case PKTSUBTYPE_INCACHE:
			MutexLock(ChunkRequestLists[0].lock);
			memcpy(ChunkRequestLists[0].data, p->msg.incache.chunklst,
			       sizeof(ChunkId_t) * p->msg.incache.size);
			ChunkRequestLists[0].size = p->msg.incache.size;
			if (debug)
				log("Received cache hint: %d .. ", ChunkRequestLists[0].data[0]);
			MutexUnlock(ChunkRequestLists[0].lock);
			break;

		case PKTSUBTYPE_JOIN:
		case PKTSUBTYPE_LEAVE:
			/* Ignore these. They are from other clients. */
			CLEVENT(4, EV_OCLIMSG,
				p->hdr.srcip, p->hdr.subtype, 0, 0);
			break;
		}
	}
}

/*
 * The heart of the game.
 */
static void
ChunkerStartup(NetInfo_t *ni)
{
	pthread_t	child_pid;
	void		*ignored;
	int		chunkcount = TotalChunkCount;
	int		i, wasidle = 0;
	static int	gotone;

	/*
	 * Allocate the chunk descriptors, request list and cache buffers.
	 */
	Chunks = calloc(chunkcount, sizeof(*Chunks));
	if (Chunks == NULL)
		fatal("Chunks: No more memory");

	ChunkRequestLists[0].data = calloc(MAX_CHUNKLST_SIZE, sizeof(ChunkId_t));
	ChunkRequestLists[1].data = calloc(chunkcount, sizeof(ChunkId_t));
	if (ChunkRequestLists[0].data == NULL || ChunkRequestLists[1].data == NULL)
		fatal("ChunkRequestList: No more memory");
	ChunkRequestLists[0].size = 0;
	ChunkRequestLists[1].size = chunkcount;

	ChunkBuffer = malloc(maxchunkbufs * sizeof(ChunkBuffer_t));
	ChunkBufferData = malloc(maxchunkbufs * sizeof(ChunkBufferData_t));
	if (ChunkBuffer == NULL || ChunkBufferData == NULL)
		fatal("ChunkBuffer: No more memory");

	ChunkBufferIdx = malloc(chunkcount * sizeof(ChunkId_t));
	if (ChunkBufferIdx == NULL)
		fatal("ChunkBufferIdx: No more memory");
		
	/*
	 * Initilize ChunkBuffer and set all the buffers to "free"
	 */
	for (i = 0; i < maxchunkbufs; i++) {
		ChunkBuffer[i].thischunk = -1;
		ChunkBuffer[i].neededself = 0;
		ChunkBuffer[i].pending = 0;
		ChunkBuffer[i].stamp = 0;
		ChunkBuffer[i].d = &ChunkBufferData[i];
	}

	for (i = 0; i < chunkcount; i++)
		ChunkBufferIdx[i] = -1;

	for (i = 0; i < TotalChunkCount; i++)
		ChunkRequestLists[1].data[i] = i;
	
	/*
	 * We randomize the block selection so that multiple clients
	 * do not end up getting stalled by each other. That is, if
	 * all the clients were requesting blocks in order, then all
	 * the clients would end up waiting until the last client was
	 * done (since the server processes client requests in FIFO
	 * order).
	 */
	if (randomize) {
		for (i = 0; i < 50 * TotalChunkCount; i++) {
			int c1 = random() % TotalChunkCount;
			int c2 = random() % TotalChunkCount;
			int t1 = ChunkRequestLists[1].data[c1];
			int t2 = ChunkRequestLists[1].data[c2];

			ChunkRequestLists[1].data[c2] = t1;
			ChunkRequestLists[1].data[c1] = t2;
		}
	}

	if (PROXY_MODE) {
		StartupState |= STARTUP_CLIENT_READY;
		MutexUnlock(&StartupLock);
		pthread_cond_broadcast(&StartupCond);
	}

	if (pthread_create(&child_pid, NULL,
			   ClientRecvThread, (void *)ni)) {
		fatal("Failed to create pthread!");
	}

	/*
	 * Loop until all chunks have been received and written to disk.
	 */
	while (chunkcount && !killme) {
		/*
		 * Search the chunk cache for a chunk that is ready to write.
		 * If CHUNK_FULL is set than the chunk is garnateed not to
		 * be modified, so no need to lock.
		 */
		for (i = 0; i < maxchunkbufs; i++)
			if (ChunkBuffer[i].neededself && 
			    ChunkBuffer[i].state == CHUNK_FULL)
				break;

		/*
		 * If nothing to do, then get out of the way for a while.
		 * XXX should be a condition variable.
		 */
		if (i == maxchunkbufs) {
#ifdef DOEVENTS
			Event_t event;
			if (eventserver != NULL &&
			    EventCheck(&event) && event.type == EV_STOP) {
				log("Aborted after %d chunks",
				    TotalChunkCount-chunkcount);
				break;
			}
#endif
			if (!wasidle) {
				CLEVENT(1, EV_CLIDCIDLE, 0, 0, 0, 0);
				if (debug)
					log("No chunks ready to write!");
			}
			if (gotone)
				DOSTAT(nochunksready++);
			fsleep(idledelay);
			wasidle++;
			continue;
		}
		gotone = 1;

		/*
		 * We have a completed chunk. Write it to disk.
		 */


		if (debug)
			log("Writing chunk %d (buffer %d) after idle=%d.%03d",
			    ChunkBuffer[i].thischunk, i,
			    (wasidle*idledelay) / 1000000,
			    ((wasidle*idledelay) % 1000000) / 1000);

		CLEVENT(1, EV_CLIDCSTART,
			ChunkBuffer[i].thischunk, wasidle,
			decompblocks, writeridles);
		wasidle = 0;

		if (nodecompress) {
			if (ImageWriteChunk(ChunkBuffer[i].thischunk,
					    ChunkBufferData[i].blocks[0].data))
				pfatal("ImageWriteChunk failed");
		} else {
			if (ImageUnzipChunk(ChunkBufferData[i].blocks[0].data))
				pfatal("ImageUnzipChunk failed");
		}

		/*
		 * Okay, free the slot up for another chunk.
		 *
		 */
		ChunkBuffer[i].neededself = 0;
		chunkcount--;
		CLEVENT(1, EV_CLIDCDONE,
			ChunkBuffer[i].thischunk, chunkcount,
			decompblocks, writeridles);
	}

	/*
	 * Make sure any asynchronous writes are done
	 * and collect stats from the unzipper.
	 */
	ImageUnzipFlush();
#ifdef STATS
	{
		extern long long totaledata, totalrdata;
		
		Stats.u.v1.decompblocks = decompblocks;
		Stats.u.v1.writeridles = writeridles;
		Stats.u.v1.ebyteswritten = totaledata;
		Stats.u.v1.rbyteswritten = totalrdata;
	}
#endif

	/*
	 * Kill the child and wait for it before returning when not
	 * running as a proxy.. We do not want the child absorbing any
	 * more packets, cause that would mess up the termination
	 * handshake with the server.
	 */
	log("CHUNKER DONE");

	if (!killme && PROXY_MODE) {
		while (!(killme || ServerDone)) {
			fsleep(100000);
		}
	}

	pthread_cancel(child_pid);
	pthread_join(child_pid, &ignored);


	free(ChunkBuffer);
	free(ChunkBufferData);
	free(ChunkRequestLists[0].data);
	free(ChunkRequestLists[1].data);
	free(Chunks);
}

/*
 * Note that someone has made a request from the server right now.
 * This is either a request by us or one we snooped.
 *
 * We use the time stamp to determine when we should repeat a request to
 * the server.  If we update the stamp here, we are further delaying
 * a re-request.  The general strategy is: if a chunk request contains
 * any blocks that we will be able to use, we update the stamp to delay
 * what would otherwise be a redundant request.
 */
static void
RequestStamp(int chunk, int block, int count, void *arg)
{
	int stampme = 0;

	/*
	 * If not doing delays, don't bother with the stamp
	 */
	if (redodelay == 0)
		return;

	/*
	 * Common case of a complete chunk request, always stamp.
	 * This will include chunks we have already written and wouldn't
	 * be re-requesting, but updating the stamp doesn't hurt anything.
	 */
	if (block == 0 && count == CHUNKSIZE)
		stampme = 1;
	/*
	 * Else, request is for a partial chunk. If we are not currently
	 * processing this chunk, then the chunk data will be of use to
	 * us so we update the stamp.  Again, this includes chunks we
	 * are already finished with, but no harm.
	 */
	else if (! Chunks[chunk].done)
		stampme = 1;
	/*
	 * Otherwise, this is a partial chunk request for which we have
	 * already received some blocks.  We need to determine if the
	 * request contains any blocks that we need to complete our copy
	 * of the chunk.  If so, we conservatively update the stamp as it
	 * implies there is at least some chunk data coming that we will
	 * be able to use.  If the request contains only blocks that we
	 * already have, then the returned data will be of no use to us
	 * for completing our copy and we will still have to make a
	 * further request (i.e., we don't stamp).
	 */
	else {
		int i;

		for (i = 0; i < maxchunkbufs; i++)
			if (ChunkBuffer[i].thischunk == chunk &&
			    ChunkBuffer[i].state == CHUNK_FILLING)
				break;
		if (i < maxchunkbufs &&
		    BlockMapIsAlloc(&ChunkBufferData[i].blockmap, block, count)
		    != count)
				stampme = 1;
	}

	if (stampme) {
		struct timeval tv;

		gettimeofday(&tv, 0);
		Chunks[chunk].lastreq =
			(unsigned long long)tv.tv_sec * 1000000 + tv.tv_usec;
		CLEVENT(5, EV_CLISTAMP, chunk, tv.tv_sec, tv.tv_usec, 0);
	}
}

/*
 * Returns 1 if we have not made (or seen) a request for the given chunk
 * "for awhile", 0 otherwise.
 */
static int
RequestRedoTime(int chunk, unsigned long long curtime)
{
	if (Chunks[chunk].lastreq == 0 || redodelay == 0 ||
	    (int)(curtime - Chunks[chunk].lastreq) >= redodelay)
		return 1;
	return 0;
}

/*
 * Receive a single data block. If the block is for a chunk in progress, then
 * insert the data and check for a completed chunk. It will be up to the main
 * thread to process that chunk.
 *
 * If the block is the first of some chunk, then try to allocate a new chunk.
 * If the chunk buffer is full, then drop the block. If this happens, it
 * indicates the chunk buffer is not big enough, and should be increased.
 *
 * Will lock 
 */
static void
GotBlock(NetInfo_t *ni, Packet_t *p)
{
	int	chunk = p->msg.block.chunk;
	int	block = p->msg.block.block;
	int	i, free = -1;
	stamp_t mindate = (unsigned long long)-1;
	static int lastnoroomchunk = -1, lastnoroomblocks, inprogress;

	GetGlobalLock();

	/*
	 * Search the chunk buffer for a match (or a free one).
	 */
	if (ChunkBufferIdx[chunk] != -1)
		i = ChunkBufferIdx[chunk];
	else for (i = 0; i < maxchunkbufs; i++) {
		if (!ChunkBuffer[i].neededself && !ChunkBuffer[i].pending) {
			if (ChunkBuffer[i].stamp < mindate) {
				free = i;
				mindate = ChunkBuffer[i].stamp;
			}
			continue;
		}
	}
	if (i == maxchunkbufs) {
		/*
		 * Did not find it. Allocate the free one, or drop the
		 * packet if there is no free chunk.
		 */
		if (free == -1) {
			if (chunk != lastnoroomchunk) {
				CLEVENT(1, EV_CLINOROOM, chunk, block,
					lastnoroomblocks, 0);
				lastnoroomchunk = chunk;
				lastnoroomblocks = 0;
				if (debug)
					log("No free buffer for chunk %d!",
					    chunk);
			}
			lastnoroomblocks++;
			DOSTAT(nofreechunks++);
			ReleaseGlobalLock();
			return;
		}
		lastnoroomchunk = -1;
		lastnoroomblocks = 0;

		/*
		 * Was this chunk already processed? 
		 */
		if (Chunks[chunk].done && !PROXY_MODE) {
			CLEVENT(3, EV_CLIDUPCHUNK, chunk, block, 0, 0);
			DOSTAT(dupchunk++);
			if (debug > 2)
				log("Duplicate chunk %d ignored!", chunk);
			ReleaseGlobalLock();
			return;
		}

		if (debug)
			log("Starting chunk %d (buffer %d)", chunk, free);

		i = free;
		if (ChunkBuffer[i].thischunk != -1)
			ChunkBufferIdx[ChunkBuffer[i].thischunk] = -1;

		ChunkBuffer[i].state      = CHUNK_FILLING;
		ChunkBuffer[i].thischunk  = chunk;
		ChunkBufferData[i].blockcount = CHUNKSIZE;
		BlockMapClear(&ChunkBufferData[i].blockmap);

		ChunkBuffer[i].neededself = !Chunks[chunk].done;
		if (PROXY_MODE) {
			ChunkBuffer[i].pending = WorkQueueCount(chunk);
		} else {
			ChunkBuffer[i].pending = 0;
		}

		ChunkBufferIdx[chunk] = i;

		Chunks[chunk].done = 1;

		inprogress++;
		CLEVENT(1, EV_CLISCHUNK, chunk, block, inprogress, 0);
	}

	/*
	 * Insert the block and update the metainfo. We have to watch for
	 * duplicate blocks in the same chunk since another client may
	 * issue a request for a lost block, and we will see that even if
	 * we do not need it (cause of broadcast/multicast).
	 *
	 * We update the metadata after the block is copied to avoid a
	 * race condition as the data in the block may be read without
	 * getting a lock.
	 */
	if (BlockMapHave(&ChunkBufferData[i].blockmap, block)) {
		CLEVENT(3, EV_CLIDUPBLOCK, chunk, block, 0, 0);
		DOSTAT(dupblock++);
		if (debug > 2)
			log("Duplicate block %d in chunk %d", block, chunk);
		ReleaseGlobalLock();
		return;
	}
	memcpy(ChunkBufferData[i].blocks[block].data, p->msg.block.buf, BLOCKSIZE);
	BlockMapSet(&ChunkBufferData[i].blockmap, block, 1);
	ChunkBufferData[i].blockcount--;
	ChunkBuffer[i].stamp = GetStamp();

#ifdef NEVENTS
	/*
	 * If we switched chunks before completing the previous, make a note.
	 */
	{
		static int lastchunk = -1, lastblock, lastchunkbuf;

		if (lastchunk != -1 && chunk != lastchunk &&
		    lastchunk == ChunkBuffer[lastchunkbuf].thischunk &&
		    ChunkBuffer[lastchunkbuf].state == CHUNK_FILLING)
			CLEVENT(1, EV_CLILCHUNK, lastchunk, lastblock,
				ChunkBufferData[lastchunkbuf].blockcount, 0);
		lastchunkbuf = i;
		lastchunk = chunk;
		lastblock = block;
		CLEVENT(3, EV_CLIBLOCK, chunk, block,
			ChunkBufferData[i].blockcount, 0);
	}
#endif

	/*
	 * Anytime we receive a packet thats needed, reset the idle counter.
	 * This will prevent us from sending too many requests.
	 */
	IdleCounter = idletimer;

	/*
	 * Is the chunk complete? If so, then release it to the main thread.
	 */
	if (ChunkBuffer[i].neededself && ChunkBufferData[i].blockcount == 0) {
		inprogress--;
		CLEVENT(1, EV_CLIECHUNK, chunk, block, inprogress, 0);
		if (debug)
			log("Releasing chunk %d to main thread", chunk);
		ChunkBuffer[i].state = CHUNK_FULL;

		/*
		 * Send off a request for a chunk we do not have yet. This
		 * should be enough to ensure that there is more work to do
		 * by the time the main thread finishes the chunk we just
		 * released.
		 */
		ReleaseGlobalLock();
		RequestChunk(ni, 0);
	} else {
		ReleaseGlobalLock();
	}
}

/*
 * Request a chunk/block/range we do not have.
 */
int
PossiblyRequestMissing(NetInfo_t *ni, int timedout, unsigned long long stamp,
		       int chunk, BlockMap_t *map, int count,
		       int origlocked)
{
	Packet_t	packet, *p = &packet;

	/*
	 * Make sure this chunk is eligible for re-request.
	 */
	if (! timedout && ! RequestRedoTime(chunk, stamp)) {
		return 0;
	}
	
	if (origlocked)
		ReleaseGlobalLock();

	/*
	 * Request all the missing blocks
	 */
	DOSTAT(prequests++);

	if (debug)
		log("Requesting %d missing blocks of chunk:%d", count, chunk);
	
	p->hdr.type       = PKTTYPE_REQUEST;
	p->hdr.subtype    = PKTSUBTYPE_PREQUEST;
	p->hdr.datalen    = sizeof(p->msg.prequest);
	p->msg.prequest.chunk = chunk;
	p->msg.prequest.retries = Chunks[chunk].ours;
	BlockMapInvert(map, &p->msg.prequest.blockmap);
	PacketSend(ni, p, 0);
#ifdef STATS
	assert(count == BlockMapIsAlloc(&p->msg.prequest.blockmap,0,CHUNKSIZE));
	if (count == 0)
		log("Request 0 blocks from chunk %d", chunk);
	Stats.u.v1.lostblocks += count;
	Stats.u.v1.requests++;
	if (Chunks[chunk].ours)
		Stats.u.v1.rerequests++;
#endif
	CLEVENT(1, EV_CLIPREQ, chunk, count, 0, 0);

	/*
	 * Since stamps are per-chunk and we wouldn't be here
	 * unless we were requesting something we are missing
	 * we can just unconditionally stamp the chunk.
	 */
	RequestStamp(chunk, 0, CHUNKSIZE, (void *)1);
	Chunks[chunk].ours = 1;

	if (origlocked)
		GetGlobalLock();
	
	return 1;
}

int PossiblyRequestNeeded(NetInfo_t *ni, int timedout, unsigned long long stamp,
			  int chunk, BlockMap_t *need, int count,
			  int locked)
{
	BlockMap_t map;
	BlockMapInvert(need, &map);
	return PossiblyRequestMissing(ni, timedout, stamp,
				      chunk, &map, count,
				      locked);
}


/*
 * Request a chunk/block/range we do not have.
 */
static void
RequestRange(NetInfo_t *ni, int chunk, int block, int count)
{
	Packet_t	packet, *p = &packet;

	if (debug)
		log("Requesting chunk:%d block:%d count:%d",
		    chunk, block, count);
	
	p->hdr.type       = PKTTYPE_REQUEST;
	p->hdr.subtype    = PKTSUBTYPE_REQUEST;
	p->hdr.datalen    = sizeof(p->msg.request);
	p->msg.request.chunk = chunk;
	p->msg.request.block = block;
	p->msg.request.count = count;
	PacketSend(ni, p, 0);
	CLEVENT(1, EV_CLIREQ, chunk, block, count, 0);
	DOSTAT(requests++);

	RequestStamp(chunk, block, count, (void *)1);
	Chunks[chunk].ours = 1;
}

static void
RequestChunk(NetInfo_t *ni, int timedout)
{
	int		   i, j, k, l;
	int		   availbufs, fillingbufs;
	unsigned long long stamp = 0;
	int		   any_needed_for_others;
	ChunkId_t	   *toreq;

	CLEVENT(1, EV_CLIREQCHUNK, timedout, 0, 0, 0);

	if (! timedout) {
		struct timeval tv;

		gettimeofday(&tv, 0);
		stamp = (unsigned long long)tv.tv_sec * 1000000 + tv.tv_usec;
	}

	/*
	 * Look for unfinished chunks.
	 */

	for (i = 0; i < maxchunkbufs; i++) {

		/*
		 * Skip avail or full buffers or chunks not needed by
		 * the client itself.
		 */
		if (!ChunkBuffer[i].neededself || ChunkBuffer[i].state == CHUNK_FULL)
			continue;

		PossiblyRequestMissing(ni, timedout, stamp,
				       ChunkBuffer[i].thischunk,
				       &ChunkBufferData[i].blockmap,
				       ChunkBufferData[i].blockcount,
				       UNLOCKED);
	}

	any_needed_for_others = AnyNeededForOthers();

	RequestNeededForOthers(ni, timedout, stamp);

	availbufs = CalcFreeBufs(&fillingbufs);

	CLEVENT(2, EV_CLIREQRA, availbufs, fillingbufs, 0, 0);

	if (any_needed_for_others)
		return;
	/*
	 * Issue read-ahead requests.
	 *
	 * If we already have enough unfinished chunks on our plate
	 * or we have no room for read-ahead, don't do it.
	 */
	if (availbufs <= 0 || fillingbufs >= maxinprogress)
		return;

	/*
	 * Scan our request list looking for candidates.
	 */
	k = (maxreadahead > availbufs) ? availbufs : maxreadahead;
	if (k <= 0) 
		return;
	toreq = alloca(sizeof(ChunkId_t) * k);
	j = 0;
	for (l = 0; l < 2; l++) {
		ChunkRequestList_t * lst = &ChunkRequestLists[l];
		if (lst->size <= 0)
			continue;
		if (lst->lock)
			MutexLock(lst->lock);
		for (i = 0; i < lst->size && j < k; i++) {
			ChunkId_t chunk = lst->data[i];
			
			/* If already working on this chunk, skip it. */
			if (Chunks[chunk].done)
				continue;

			/* Otherwise add it to the list to req */
			toreq[j] = chunk;
			j++;
		}
		if (lst->lock)
			MutexUnlock(lst->lock);
	}
	if (debug && PROXY_MODE && j > 0)
		log("Requesting %d chunks for self", j);
	for (i = 0; i < j; ++i) {
		int chunk = toreq[i];
		/*
		 * Issue a request for the chunk if it isn't already
		 * on the way.  This chunk, whether requested or not
		 * is considered a read-ahead to us.
		 */
		if (timedout || RequestRedoTime(chunk, stamp))
			RequestRange(ni, chunk, 0, CHUNKSIZE);
	}
}

/*
 * Join the Frisbee team, and then go into the main loop above.
 */
static void
PlayFrisbee(NetInfo_t *ni)
{
	Packet_t	packet, *p = &packet;
	struct timeval  estamp, timeo;
	unsigned int	myid;
	int		delay;

	gettimeofday(&stamp, 0);
	CLEVENT(1, EV_CLISTART, 0, 0, 0, 0);

	/*
	 * Init the random number generator. We randomize the block request
	 * sequence above, and its important that each client have a different
	 * sequence!
	 */
#ifdef __FreeBSD__
	srandomdev();
#else
	srandom(ClientNetID() ^ stamp.tv_sec ^ stamp.tv_usec ^ getpid());
#endif

	/*
	 * A random number ID. I do not think this is really necessary,
	 * but perhaps might be useful for determining when a client has
	 * crashed and returned.
	 */
	myid = random();
	
	/*
	 * To avoid a blast of messages from a large number of clients,
	 * we can delay a small amount before startup.  If startat is
	 * non-zero we delay for that number of seconds.  Otherwise, if
	 * startdelay is non-zero, the delay value is uniformly distributed
	 * between 0 and startdelay seconds, with ms granularity.
	 */
	if (startat > 0)
		delay = startat * 1000;
	else if (startdelay > 0)
		delay = random() % (startdelay * 1000);
	else
		delay = 0;
	if (delay) {
		if (debug)
			log("Starup delay: %d.%03d seconds",
			    delay/1000, delay%1000);
		DOSTAT(delayms = delay);
		fsleep(delay * 1000);
	}

	/*
	 * Send a join the team message. We block waiting for a reply
	 * since we need to know the total block size. We resend the
	 * message (dups are harmless) if we do not get a reply back.
	 */
	gettimeofday(&timeo, 0);
	while (1) {
		struct timeval now;

		gettimeofday(&now, 0);
		if (timercmp(&timeo, &now, <=)) {
#ifdef DOEVENTS
			Event_t event;
			if (eventserver != NULL &&
			    EventCheck(&event) && event.type == EV_STOP) {
				log("Aborted during JOIN");
				return;
			}
#endif
			CLEVENT(1, EV_CLIJOINREQ, myid, 0, 0, 0);
			DOSTAT(joinattempts++);
			p->hdr.type       = PKTTYPE_REQUEST;
			p->hdr.subtype    = PKTSUBTYPE_JOIN;
			p->hdr.datalen    = sizeof(p->msg.join);
			p->msg.join.clientid = myid;
			PacketSend(ni, p, 0);
			timeo.tv_sec = 0;
			timeo.tv_usec = 500000;
			timeradd(&timeo, &now, &timeo);
		}

		/*
		 * Throw away any data packets. We cannot start until
		 * we get a reply back.
		 */
		if (PacketReceive(ni, p) == 0 &&
		    p->hdr.subtype == PKTSUBTYPE_JOIN &&
		    p->hdr.type == PKTTYPE_REPLY) {
			CLEVENT(1, EV_CLIJOINREP,
				p->msg.join.blockcount, 0, 0, 0);
			break;
		}
	}
	gettimeofday(&timeo, 0);
	TotalChunkCount = p->msg.join.blockcount / CHUNKSIZE;
	ImageUnzipSetChunkCount(TotalChunkCount);
	ServerSetFileInfo(p->msg.join.blockcount);

	/*
	 * If we have partitioned up the memory and have allocated
	 * more chunkbufs than chunks in the file, reallocate the
	 * excess to disk buffering.  If the user has explicitly
	 * partitioned the memory, we leave everything as is.
	 */
	if (maxmem != 0 && maxchunkbufs > TotalChunkCount) {
		int excessmb;

		excessmb = ((maxchunkbufs - TotalChunkCount) *
			    (sizeof(ChunkBuffer_t) + sizeof(ChunkBufferData_t)))
			    / (1024 * 1024);
		maxchunkbufs = TotalChunkCount;
		if (excessmb > 0) {
			maxwritebufmem += excessmb;
			ImageUnzipSetMemory(maxwritebufmem*1024*1024);
		}
	}
 
	log("Joined the team after %d sec. ID is %u. "
	    "File is %d chunks (%d blocks)",
	    timeo.tv_sec - stamp.tv_sec,
	    myid, TotalChunkCount, p->msg.join.blockcount);

	ChunkerStartup(ni);

	gettimeofday(&estamp, 0);
	timersub(&estamp, &stamp, &estamp);
	
	/*
	 * Done! Send off a leave message, but do not worry about whether
	 * the server gets it. All the server does with it is print a
	 * timestamp, and that is not critical to operation.
	 */
	CLEVENT(1, EV_CLILEAVE, myid, estamp.tv_sec,
		(Stats.u.v1.rbyteswritten >> 32), Stats.u.v1.rbyteswritten);
#ifdef STATS
	p->hdr.type       = PKTTYPE_REQUEST;
	p->hdr.subtype    = PKTSUBTYPE_LEAVE2;
	p->hdr.datalen    = sizeof(p->msg.leave2);
	p->msg.leave2.clientid = myid;
	p->msg.leave2.elapsed  = estamp.tv_sec;
	Stats.version            = CLIENT_STATS_VERSION;
	Stats.u.v1.runsec        = estamp.tv_sec;
	Stats.u.v1.runmsec       = estamp.tv_usec / 1000;
	Stats.u.v1.chunkbufs     = maxchunkbufs;
	Stats.u.v1.writebufmem   = maxwritebufmem;
	Stats.u.v1.maxreadahead  = maxreadahead;
	Stats.u.v1.maxinprogress = maxinprogress;
	Stats.u.v1.pkttimeout    = pkttimeout;
	Stats.u.v1.startdelay    = startdelay;
	Stats.u.v1.idletimer     = idletimer;
	Stats.u.v1.idledelay     = idledelay;
	Stats.u.v1.redodelay     = redodelay;
	Stats.u.v1.randomize     = randomize;
	p->msg.leave2.stats      = Stats;
	PacketSend(ni, p, 0);

	log("");
	ClientStatsDump(myid, &Stats);
#else
	p->hdr.type       = PKTTYPE_REQUEST;
	p->hdr.subtype    = PKTSUBTYPE_LEAVE;
	p->hdr.datalen    = sizeof(p->msg.leave);
	p->msg.leave.clientid = myid;
	p->msg.leave.elapsed  = estamp.tv_sec;
	PacketSend(ni, p, 0);
#endif
	log("\nLeft the team after %ld seconds on the field!", estamp.tv_sec);
}


int CalcFreeBufs(int *filling)
{
	int i, avail = 0;
	if (filling) *filling = 0;
	for (i = 0; i < maxchunkbufs; i++) {
		if (!ChunkBuffer[i].neededself && !ChunkBuffer[i].pending)
			avail++;
		else if (filling)
			(*filling)++;
	}
	return avail;
}

ChunkBuffer_t * 
GetCachedChunk(int chunkno)
{
	int i;
	i = ChunkBufferIdx[chunkno];
	if (i == -1) return NULL;
	else return &ChunkBuffer[i];
}


#if 0
void GetChunk(NetInfo_t * ni, int chunkno, ChunkBuffer_t * res)
{
	/* Set up the environment so that there is only one chunk to
	   request.  And only one chunk to save the results to. */
	Chunks = 0; /* Should not be used */
	maxchunks = 1;
	ChunkBuffer = res;
	ChunkBuffer->thischunk = chunkno;
	ChunkBuffer->state = CHUNK_EMPTY;
	ChunkRequestListSize = 1;
	ChunkRequestList = &chunkno;
	ClientRecvThread(&ni);
}

#endif

int
GetChunklst(ChunkId_t chunklst[])
{
	int i, j;
	int size;
	stamp_t min = 0;
	struct data_t {
		stamp_t stamp;
		int     chunk;
	} data[MAX_CHUNKLST_SIZE];
	struct data_t tmp;
	struct data_t *p,*q,*m,*end;
	j = 0;
	GetGlobalLock();
	for (i = 0; i < maxchunkbufs; ++i) {
		if (ChunkBuffer[i].neededself 
		    || ChunkBuffer[i].pending  
		    || ChunkBuffer[i].thischunk == -1)
			continue;
		data[j].stamp = ChunkBuffer[i].stamp;
		data[j].chunk = ChunkBuffer[i].thischunk;
		++j;
		if (j == MAX_CHUNKLST_SIZE) break;
	}
	ReleaseGlobalLock();
	size = j;
	if (size == 0) return 0;
	end = data + size;
	/* insertion sort */
	m = end;
	min = (stamp_t)-1;
	for (p = data; p < end; p++) {
		for (q = p; q < end; q++) {
			if (q->stamp <= min) {
				min = q->stamp;
				m = q;
			}
		}
		assert(m < end);
		tmp = *p;
		*p = *m;
		*m = tmp;
	}

	for (i = 0; i < size; i++) {
		chunklst[i] = data[i].chunk;
	}

	for (; i < MAX_CHUNKLST_SIZE; i++)
		chunklst[i] = 0;

	

	return size;
}
