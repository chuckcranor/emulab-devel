/*
 * EMULAB-COPYRIGHT
 * Copyright (c) 2000-2005 University of Utah and the Flux Group.
 * All rights reserved.
 */

/*
 * event-sched.h --
 *
 *      This file contains definitions for the testbed event
 *      scheduler.
 *
 */

#ifndef __SCHED_H__
#define __SCHED_H__

#include <stdio.h>
#include <sys/time.h>
#include "event.h"
#include "log.h"
#include "tbdefs.h"

#include "listNode.h"

#ifndef MAXHOSTNAMELEN
#define MAXHOSTNAMELEN 64
#endif /* MAXHOSTNAMELEN */

#define LOGDIR		"/local/logs"

#ifdef __cplusplus
extern "C" {
#endif

/* Scheduler-internal representation of an event. */
typedef struct sched_event {
	union {
		struct agent *s;
		struct agent **m;
	} agent;
	event_notification_t notification;
	struct timeval time;			/* event firing time */
	unsigned short length;
	unsigned short flags;
} sched_event_t;


extern int debug;


/*
 * Function prototypes:
 */

void sched_event_free(event_handle_t handle, sched_event_t *se);
int sched_event_prepare(event_handle_t handle, sched_event_t *se);
int sched_event_enqueue_copy(event_handle_t handle,
			     sched_event_t *se,
			     struct timeval *new_time);

/* queue.c */
void sched_event_init(void);
int sched_event_enqueue(sched_event_t event);
int sched_event_dequeue(sched_event_t *event, int wait);
void sched_event_queue_dump(FILE *fp);

extern char build_info[];

#ifdef __cplusplus
}
#endif

#endif /* __SCHED_H__ */
