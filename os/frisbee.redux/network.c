/*
 * EMULAB-COPYRIGHT
 * Copyright (c) 2000-2006 University of Utah and the Flux Group.
 * All rights reserved.
 */

/*
 * Network routines.
 */
#include <sys/types.h>
#include <sys/socket.h>
#include <sys/time.h>
#include <netinet/in.h>
#include <arpa/inet.h>
#include <netdb.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <signal.h>
#include <errno.h>
#include "decls.h"
#include "utils.h"

#ifdef STATS
unsigned long nonetbufs;
#define DOSTAT(x)	(x)
#else
#define DOSTAT(x)
#endif

/* Max number of times to attempt bind to port before failing. */
#define MAXBINDATTEMPTS		2

/* Max number of hops multicast hops. */
#define MCAST_TTL		5

static void
CommonInit(NetInfo_t *ni)
{
	struct sockaddr_in	name;
	struct timeval		timeout;
	int			i;
	char			buf[BUFSIZ];
	struct hostent		*he;

	if ((ni->sock = socket(PF_INET, SOCK_DGRAM, IPPROTO_UDP)) < 0)
		pfatal("Could not allocate a socket");

	i = SOCKBUFSIZE;
	if (setsockopt(ni->sock, SOL_SOCKET, SO_SNDBUF, &i, sizeof(i)) < 0)
		pwarning("Could not increase send socket buffer size to %d",
			 SOCKBUFSIZE);
    
	/* i = PROXY_MODE ? 2000 * 1024 : SOCKBUFSIZE; */
	i = SOCKBUFSIZE;
	if (setsockopt(ni->sock, SOL_SOCKET, SO_RCVBUF, &i, sizeof(i)) < 0)
		pwarning("Could not increase recv socket buffer size to %d",
			 SOCKBUFSIZE);

	name.sin_family      = AF_INET;
	name.sin_port	     = htons(ni->portnum);
	name.sin_addr.s_addr = htonl(INADDR_ANY);

	i = MAXBINDATTEMPTS;
	while (i) {
		if (bind(ni->sock, (struct sockaddr *)&name, sizeof(name)) == 0)
			break;

		/*
		 * Note that we exit with a magic value. 
		 * This is for server wrapper-scripts so that they can
		 * differentiate this case and try again with a different port.
		 */
		if (--i == 0) {
			error("Could not bind to port %d!\n", ni->portnum);
			exit(EADDRINUSE);
		}

		pwarning("Bind to port %d failed. Will try %d more times!",
			 ni->portnum, i);
		sleep(5);
	}
	log("Bound to port %d", ni->portnum);

	/*
	 * At present, we use a multicast address in both directions.
	 */
	if ((ntohl(ni->mcastaddr.s_addr) >> 28) == 14) {
		unsigned int loop = 0, ttl = MCAST_TTL;
		struct ip_mreq mreq;

		log("Using Multicast");

		mreq.imr_multiaddr.s_addr = ni->mcastaddr.s_addr;

		if (ni->mcastif.s_addr)
			mreq.imr_interface.s_addr = ni->mcastif.s_addr;
		else
			mreq.imr_interface.s_addr = htonl(INADDR_ANY);

		if (setsockopt(ni->sock, IPPROTO_IP, IP_ADD_MEMBERSHIP,
			       &mreq, sizeof(mreq)) < 0)
			pfatal("setsockopt(IPPROTO_IP, IP_ADD_MEMBERSHIP)");

		if (setsockopt(ni->sock, IPPROTO_IP, IP_MULTICAST_TTL,
			       &ttl, sizeof(ttl)) < 0) 
			pfatal("setsockopt(IPPROTO_IP, IP_MULTICAST_TTL)");

		/* Disable local echo */
		if (setsockopt(ni->sock, IPPROTO_IP, IP_MULTICAST_LOOP,
			       &loop, sizeof(loop)) < 0)
			pfatal("setsockopt(IPPROTO_IP, IP_MULTICAST_LOOP)");

		if (ni->mcastif.s_addr &&
		    setsockopt(ni->sock, IPPROTO_IP, IP_MULTICAST_IF,
			       &ni->mcastif, sizeof(ni->mcastif)) < 0) {
			pfatal("setsockopt(IPPROTO_IP, IP_MULTICAST_IF)");
		}

	} else if (ni->broadcast) {
		/*
		 * Otherwise, we use a broadcast addr. 
		 */
		i = 1;

		log("Setting broadcast mode\n");
		
		if (setsockopt(ni->sock, SOL_SOCKET, SO_BROADCAST,
			       &i, sizeof(i)) < 0)
			pfatal("setsockopt(SOL_SOCKET, SO_BROADCAST)");
	}

	/*
	 * We use a socket level timeout instead of polling for data.
	 */
	timeout.tv_sec  = 0;
	timeout.tv_usec = PKTRCV_TIMEOUT;
	
	if (setsockopt(ni->sock, SOL_SOCKET, SO_RCVTIMEO,
		       &timeout, sizeof(timeout)) < 0)
		pfatal("setsockopt(SOL_SOCKET, SO_RCVTIMEO)");

	/*
	 * If a specific interface IP is specified, use that to
	 * tag our outgoing packets.  Otherwise we use the IP address
	 * associated with our hostname.
	 */
	if (ni->mcastif.s_addr)
		ni->myipaddr.s_addr = ni->mcastif.s_addr;
	else {
		if (gethostname(buf, sizeof(buf)) < 0)
			pfatal("gethostname failed");

		if ((he = gethostbyname(buf)) == 0)
			fatal("gethostbyname: %s", hstrerror(h_errno));

		memcpy((char *)&ni->myipaddr, he->h_addr, sizeof(ni->myipaddr));
	}

	/*
	 * Compute the out of buffer space delay.
	 */
	if (ni->nobufdelay < 0)
		ni->nobufdelay = sleeptime(100, NULL, 1);
}

int
ClientNetInit(NetInfo_t *ni)
{
	CommonInit(ni);
	
	return 1;
}

unsigned long
ClientNetID(NetInfo_t *ni)
{
	return ntohl(ni->myipaddr.s_addr);
}

int
ServerNetInit(NetInfo_t *ni)
{
	log("ServerNetInit");
  
	CommonInit(ni);

	return 1;
}

/*
 * XXX hack.
 *
 * Cisco switches without a multicast router defined have an unfortunate
 * habit of losing our IGMP membership.  This function allows us to send
 * a report message to remind the switch we are still around.
 *
 * We need a better way to do this!
 */
int
ServerNetMCKeepAlive(NetInfo_t *ni)
{
	struct ip_mreq mreq;

	if (ni->broadcast || (ntohl(ni->mcastaddr.s_addr) >> 28) != 14)
		return 0;

	if (ni->sock == -1)
		return 1;

	mreq.imr_multiaddr.s_addr = ni->mcastaddr.s_addr;
	if (ni->mcastif.s_addr)
		mreq.imr_interface.s_addr = ni->mcastif.s_addr;
	else
		mreq.imr_interface.s_addr = htonl(INADDR_ANY);

	if (setsockopt(ni->sock, IPPROTO_IP, IP_DROP_MEMBERSHIP,
		       &mreq, sizeof(mreq)) < 0 ||
	    setsockopt(ni->sock, IPPROTO_IP, IP_ADD_MEMBERSHIP,
		       &mreq, sizeof(mreq)) < 0)
		return 1;
	return 0;
}

/*
 * Look for a packet on the socket. Propogate the errors back to the caller
 * exactly as the system call does. Remember that we set up a socket timeout
 * above, so we will get EWOULDBLOCK errors when no data is available. 
 *
 * The amount of data received is determined from the datalen of the hdr.
 * All packets are actually the same size/structure. 
 *
 * Returns 0 for a good packet, 1 for a back packet, -1 on timeout.
 */
int
PacketReceive(NetInfo_t *ni, Packet_t *p)
{
	struct sockaddr_in from;
	int		   mlen;
	unsigned int	   alen;

	alen = sizeof(from);
	bzero(&from, alen);

	if ((mlen = recvfrom(ni->sock, p, sizeof(*p), 0,
			     (struct sockaddr *)&from, &alen)) < 0) {
		if (errno == EWOULDBLOCK)
			return -1;
		pfatal("PacketReceive(recvfrom)");
	}
	
	/*
	 * Basic integrity checks
	 */
	if (mlen < sizeof(p->hdr) + p->hdr.datalen) {
		log("Bad message length (%d != %d)",
		    mlen, p->hdr.datalen);
		return 1;
	}
	if (p->hdr.srcip != from.sin_addr.s_addr) {
		log("Bad message source (%x != %x)",
		    ntohl(from.sin_addr.s_addr), ntohl(p->hdr.srcip));
		return 1;
	}

	return 0;
}

/*
 * We use blocking sends since there is no point in giving up. All packets
 * go to the same place, whether client or server.
 *
 * The amount of data sent is determined from the datalen of the packet hdr.
 * All packets are actually the same size/structure.
 */
void
PacketSend(NetInfo_t *ni, Packet_t *p, int *resends)
{
	struct sockaddr_in to;
	int		   len, delays;

	len = sizeof(p->hdr) + p->hdr.datalen;
	p->hdr.srcip = ni->myipaddr.s_addr;

	to.sin_family      = AF_INET;
	to.sin_port        = htons(ni->portnum);
	to.sin_addr.s_addr = ni->mcastaddr.s_addr;

	delays = 0;
	if (ni->lock) pthread_mutex_lock(ni->lock);
	while (sendto(ni->sock, (void *)p, len, 0,
		      (struct sockaddr *)&to, sizeof(to)) < 0) {
		if (errno != ENOBUFS)
			pfatal("PacketSend(sendto)");

		/*
		 * ENOBUFS means we ran out of mbufs. Okay to sleep a bit
		 * to let things drain.
		 */
		delays++;
		fsleep(ni->nobufdelay);
	}
	if (ni->lock) pthread_mutex_unlock(ni->lock);

	DOSTAT(nonetbufs += delays);
	if (resends != 0)
		*resends = delays;
}

/*
 * Basically the same as above, but instead of sending to the multicast
 * group, send to the (unicast) IP in the packet header. This simplifies
 * the logic in a number of places, by avoiding having to deal with
 * multicast packets that are not destined for us, but for someone else.
 */
void
PacketReply(NetInfo_t *ni, Packet_t *p)
{
	struct sockaddr_in to;
	int		   len;

	len = sizeof(p->hdr) + p->hdr.datalen;

	to.sin_family      = AF_INET;
	to.sin_port        = htons(ni->portnum);
	to.sin_addr.s_addr = p->hdr.srcip;
	p->hdr.srcip       = ni->myipaddr.s_addr;

	if (ni->lock) pthread_mutex_lock(ni->lock);
	while (sendto(ni->sock, (void *)p, len, 0, 
		      (struct sockaddr *)&to, sizeof(to)) < 0) {
		if (errno != ENOBUFS)
			pfatal("PacketSend(sendto)");

		/*
		 * ENOBUFS means we ran out of mbufs. Okay to sleep a bit
		 * to let things drain.
		 */
		DOSTAT(nonetbufs++);
		fsleep(ni->nobufdelay);
	}
	if (ni->lock) pthread_mutex_unlock(ni->lock);
}

int
PacketValid(NetInfo_t *ni, Packet_t *p, int nchunks)
{
	switch (p->hdr.type) {
	case PKTTYPE_REQUEST:
	case PKTTYPE_REPLY:
		break;
	default:
		return 0;
	}

	switch (p->hdr.subtype) {
	case PKTSUBTYPE_BLOCK:
		if (p->hdr.datalen < sizeof(p->msg.block))
			return 0;
		if (p->msg.block.chunk < 0 ||
		    p->msg.block.chunk >= nchunks ||
		    p->msg.block.block < 0 ||
		    p->msg.block.block >= CHUNKSIZE)
			return 0;
		break;
	case PKTSUBTYPE_REQUEST:
		if (p->hdr.datalen < sizeof(p->msg.request))
			return 0;
		if (p->msg.request.chunk < 0 ||
		    p->msg.request.chunk >= nchunks ||
		    p->msg.request.block < 0 ||
		    p->msg.request.block >= CHUNKSIZE ||
		    p->msg.request.count < 0 ||
		    p->msg.request.block+p->msg.request.count > CHUNKSIZE)
			return 0;
		break;
	case PKTSUBTYPE_PREQUEST:
		if (p->hdr.datalen < sizeof(p->msg.prequest))
			return 0;
		if (p->msg.prequest.chunk < 0 ||
		    p->msg.prequest.chunk >= nchunks)
			return 0;
		break;
	case PKTSUBTYPE_JOIN:
		if (p->hdr.datalen < sizeof(p->msg.join))
			return 0;
		break;
	case PKTSUBTYPE_LEAVE:
		if (p->hdr.datalen < sizeof(p->msg.leave))
			return 0;
		break;
	case PKTSUBTYPE_LEAVE2:
		if (p->hdr.datalen < sizeof(p->msg.leave2))
			return 0;
		break;
	case PKTSUBTYPE_INCACHE:
	case PKTSUBTYPE_NEED:
		if (p->hdr.datalen < sizeof(p->msg.chunklst))
			return 0;
		break;
	default:
		return 0;
	}

	return 1;
}
