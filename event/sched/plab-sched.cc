/*
 * EMULAB-COPYRIGHT
 * Copyright (c) 2000-2006 University of Utah and the Flux Group.
 * All rights reserved.
 */

/*
 * plab-sched.c --
 *
 *      event scheduler for plab
 *
 *      The event scheduler is an event system client; it operates by
 *      subscribing to the EVENT_SCHEDULE event, enqueuing the event
 *      notifications it receives, and resending the notifications at
 *      the indicated times.
 *
 */

#include "config.h"

#include <stdio.h>
#include <signal.h>
#include <sys/time.h>
#include <sys/types.h>
#include <sys/stat.h>
#include <sys/wait.h>
#include <sys/param.h>
#include <time.h>
#include <unistd.h>
#include <math.h>
#include <ctype.h>
#include <pwd.h>
#include <pthread.h>
#include <assert.h>
#include <paths.h>
#include <sys/socket.h>
#include <netinet/in.h>
#include <arpa/inet.h>
#include <netdb.h>

#include "plab-sched.h"
#include "log.h"
#include "tbdefs.h"
#include "popenf.h"
#include "systemf.h"
#include <map>
#include <string>
#include <iostream>

#define EVENTKEYS_FILE "/var/emulab/boot/eventkeys"
#define EVENTKEYS_SCRIPT "/usr/local/etc/emulab/eventkeysdump.pl"
#define OFFSETFILE "/var/emulab/boot/offset"

static void enqueue(event_handle_t handle,
		    event_notification_t notification,
		    void *data);
static void dequeue(event_handle_t handle);
static void schedule_reloadevent(event_handle_t handle);
static void update_eventkeys();
static void callback(event_handle_t handle,
		     event_notification_t notification, 
		     void *data);
static bool is_expt_active(event_handle_t handle, 
			   event_notification_t notification);
void adjust_offset(sched_event_t *event);

static char *progname;
int debug;
static char nodeidstr[BUFSIZ], ipaddr[32];
static std::map<std::string, std::string> keysmap; // expt -> key

static void sigpass(int sig)
{
	info("plab-sched: received signal %d, exiting\n", sig);
	
	exit(0);
}

static void sigpanic(int sig)
{
	info("plab-sched: sigpanic %d\n", sig);

	abort();
}


void
usage(void)
{
	fprintf(stderr,
		"Usage: %s [-hVd] [OPTIONS]\n"
		"\n"
		"Optional arguments:\n"
		"  -h          Print this message\n"
		"  -V          Print version information\n"
		"  -d          Turn on debugging\n"
		"  -s server   Specify location of elvind server. "
		"(Default: localhost)\n"
		"  -p port     Specify port number of elvind server\n"
		"  -l logfile  Specify logfile to direct output\n"
		"\n",
		progname);
	exit(-1);
}



int
main(int argc, char *argv[])
{
	address_tuple_t tuple;
	event_handle_t handle;
	char *server = NULL;
	char *port = NULL;
	char *pnodeid = NULL;
	char *log = NULL;
	char *keyfile = NULL;
	char buf[BUFSIZ];
	int c;
	char hostname[MAXHOSTNAMELEN];
        struct in_addr myip;
	struct hostent *he;
			
	progname = argv[0];

	/* Initialize event queue semaphores: */
	sched_event_init();

	while ((c = getopt(argc, argv, "hrs:p:dl:n:")) != -1) {
		switch (c) {
		case 'h':
			usage();
			break;
		case 'd':
			debug++;
			break;
		case 's':
			server = optarg;
			break;
		case 'p':
			port = optarg;
			break;
		case 'l':
			log = optarg;
			break;
                case 'n':
		        pnodeid = optarg;
		        break;
		default:
			usage();
			break;
		}
	}
	argc -= optind;
	argv += optind;

        if (argc)
	  usage();

        if (! pnodeid)
	  fatal("Must provide pnodeid and local elvin port");



	setenv("LOGDIR", LOGDIR, 1);

	if (log)
		loginit(0, log);

	if (!debug) {
	  daemon(0, 0);
	  loginit(0, "/var/emulab/logs/plabsched.log");
        }

	signal(SIGTERM, sigpass);
	signal(SIGINT, sigpass);
	signal(SIGQUIT, sigpass);
	
	signal(SIGSEGV, sigpanic);
	signal(SIGBUS, sigpanic);
	
        /*
         * Get our IP address. Thats how we name this host to the
         * event System.
         */
        if (gethostname(hostname, MAXHOSTNAMELEN) == -1) {
	  fatal("could not get hostname: %s\n", strerror(errno));
        }
        if (! (he = gethostbyname(hostname))) {
	  fatal("could not get IP address from hostname: %s", hostname);
        }
        memcpy((char *)&myip, he->h_addr, he->h_length);
        strcpy(ipaddr, inet_ntoa(myip));

        snprintf(nodeidstr, sizeof(nodeidstr), "__%s_proxy", pnodeid);

	/*
	 * Convert server/port to elvin thing.
	 *
	 * XXX This elvin string stuff should be moved down a layer. 
	 */
	if (!server)
		server = "localhost";
	
	snprintf(buf, sizeof(buf), "elvin://%s%s%s",
		 server,
		 (port ? ":"  : ""),
		 (port ? port : ""));
	server = buf;

	/* Register with the event system: */
	handle = event_register(server, 1);
	if (handle == NULL) {
		fatal("could not register with event system");
	}

	
	/*
	 * Construct an address tuple for event subscription. We set the 
	 * scheduler flag to indicate we want to capture those notifications.
	 */
	tuple = address_tuple_alloc();
	if (tuple == NULL) {
		fatal("could not allocate an address tuple");
	}

	tuple->scheduler = 2;
	
	if (event_subscribe(handle, enqueue, tuple, NULL) == NULL) {
		fatal("could not subscribe to EVENT_SCHEDULE event");
	}

	address_tuple_free(tuple);
        tuple = address_tuple_alloc();

	snprintf(buf, sizeof(buf), "%s,%s",
                 TBDB_EVENTTYPE_UPDATE, TBDB_EVENTTYPE_CLEAR);

        tuple->eventtype = buf;
	tuple->objtype = TBDB_OBJECTTYPE_EVPROXY;
	if (event_subscribe(handle, callback, tuple, NULL) == NULL) {
	  fatal("could not subscribe to EVENT_SCHEDULE event");
	}
	
	update_eventkeys();
	schedule_reloadevent(handle);

	dequeue(handle);

}


/* Enqueue event notifications as they arrive. */
static void
enqueue(event_handle_t handle, event_notification_t notification, void *data)
{
  char expt[TBDB_FLEN_PID + TBDB_FLEN_EID + 1];
  sched_event_t event;
  event.length = 1;
  
  if (!event_notification_get_expt(handle, notification, expt, sizeof(expt))) {
    error("No EXPT field in the event");
    return;
  }

  /* Get the event's firing time: */
  if (! event_notification_get_int32(handle, notification, "time_usec",
				     (int *) &event.time.tv_usec) ||
      ! event_notification_get_int32(handle, notification, "time_sec",
				     (int *) &event.time.tv_sec)) {
    error("could not get time from notification %p\n", notification);
  }


  /* Authenticate the event */
  std::string exp(expt);
  std::map<std::string, std::string>::iterator member =
    keysmap.find(exp);
  
  if(member == keysmap.end()) {
    error("enqueue: got an event from a non-active expt: strange!!\n");
    return;
  }
  std::string key = member->second;
  
  if (event_notification_check_hmac_withkeydata(handle,notification, 
						key.size(), 
						(char *)key.c_str())) {
    error("HMAC does not match \n");
    return;
  }
      
    
  /*
   * Clone the event notification, since we want the
   * notification to live beyond the callback function:
   */
  event.notification =
    event_notification_clone(handle, notification);
  
  if (!event.notification) {
    error("event_notification_clone failed!\n");
    return;
  }
  
  /*
   * Clear the scheduler flag. Not allowed to do this above
   * the loop cause the notification thats comes in is
   * "read-only".
   */
  if (! event_notification_remove(handle,
				  event.notification,
				  "SCHEDULER") ||
      ! event_notification_put_int32(handle,
				     event.notification,
				     "SCHEDULER",
				     0)) {
    error("could not clear scheduler attribute of "
	  "notification %p\n", event.notification);
    return;
  }

  adjust_offset(&event);
  
  if (debug) {
    struct timeval now;
    
    gettimeofday(&now, NULL);
    
    info("Sched: "
	 "note:%p at:%ld:%d now:%ld:%d \n",
	 event.notification,
	 event.time.tv_sec, event.time.tv_usec,
	 now.tv_sec, now.tv_usec 
	 );
  }
  
  
  /*
   * Enqueue the event notification for resending at the
   * indicated time:
   */
  event_notification_insert_hmac_withkeydata(handle, event.notification,
					    key.size(),
					    (char *)key.c_str());
  sched_event_enqueue(event);
}


/* Dequeue events from the event queue and fire them at the
   appropriate time.  Runs in a separate thread. */
static void
dequeue(event_handle_t handle)
{
	sched_event_t next_event;
	struct timeval now;
	
	while (1) {
		if (sched_event_dequeue(&next_event, 1) < 0)
			break;
	
		/* check if the expt is still active or not */
		if (!is_expt_active(handle,next_event.notification)) {
		  break;
		}

		/* Fire event. */
		if (debug)
			gettimeofday(&now, NULL);

		if (debug) {
			info("Fire:  note:%p at:%ld:%d now:%ld:%d \n",
			     next_event.notification,
			     next_event.time.tv_sec, next_event.time.tv_usec,
			     now.tv_sec,
			     now.tv_usec);
		}

		if (event_notify(handle, next_event.notification) == 0) {
		  error("could not fire event\n");
		}
		
		sched_event_free(handle, &next_event);
	}
}



void
sched_event_free(event_handle_t handle, sched_event_t *se)
{
	assert(handle != NULL);
	assert(se != NULL);

	if (se->length == 0) {
	}
	else {
		event_notification_free(handle, se->notification);
		se->notification = NULL;
	}
}


static void schedule_reloadevent(event_handle_t handle) {
  event_notification_t notification;
  address_tuple_t tuple = address_tuple_alloc();

  struct timeval now;
  gettimeofday(&now, NULL);

  if (tuple == NULL) {
    fatal("could not allocate an address tuple");
  }
  
  tuple->objtype = TBDB_OBJECTTYPE_PLABSCHED;
  tuple->objname = nodeidstr;
  tuple->eventtype = TBDB_EVENTTYPE_RELOAD;
  tuple->host = ipaddr;
  
  notification = event_notification_alloc(handle, tuple);
  
  if (notification == NULL) {
    fatal("could not allocate notification\n");
  }
  
  if (event_schedule(handle, notification, &now) == 0) {
    error("could not schedule update event.\n");
  }

  info("Scheduled scheduler RELOAD event.\n");

  event_notification_free(handle, notification);
  
  address_tuple_free(tuple);

}

/* Makes a tmcc call for eventkeys, and thens refreshes
 * the local cache
 */

static void update_eventkeys() {
  char buf[BUFSIZ], buf1[BUFSIZ];
  int num;

  /* run the script to refresh the eventkeys file */
  system(EVENTKEYS_SCRIPT);

  FILE *fd = fopen(EVENTKEYS_FILE, "r");  
  
  if (fd  == NULL) {
    error("Not able to open %s file\n", EVENTKEYS_FILE);
    return;
  }
  
  keysmap.clear();
  
  while ((num = fscanf(fd, "%s %s\n", buf, buf1)) != EOF) {
    std::string expt(buf);
    std::string key(buf1);
    keysmap[expt] = key;
    
  }
  
}


/*
 * Handle incoming UPDATE/CLEAR events from the remote server.
 */
static void
callback(event_handle_t handle, event_notification_t notification, void *data)
{
  char            eventtype[TBDB_FLEN_EVEVENTTYPE];
  char            objecttype[TBDB_FLEN_EVOBJTYPE];
  char expt[TBDB_FLEN_PID + TBDB_FLEN_EID + 1];

  
  event_notification_get_eventtype(handle,
				   notification, eventtype, sizeof(eventtype));
  event_notification_get_objtype(handle,
				 notification, objecttype, sizeof(objecttype));
  event_notification_get_expt(handle, notification, expt, sizeof(expt));
 
  if ((strcmp(objecttype,TBDB_OBJECTTYPE_EVPROXY) == 0)) {
    if (strcmp(eventtype,TBDB_EVENTTYPE_UPDATE) == 0) {
      update_eventkeys();
    } else if (strcmp(eventtype,TBDB_EVENTTYPE_CLEAR) == 0) {
      std::string exp(expt);
      std::map<std::string, std::string>::iterator member =
	keysmap.find(exp);

      if(member != keysmap.end()) {
	keysmap.erase(exp);
	info("erasing expt %s from keysmap\n", expt);
	return;
      }
    }
  } 
}


static bool 
is_expt_active(event_handle_t handle, event_notification_t notification) {
  char expt[TBDB_FLEN_PID + TBDB_FLEN_EID + 1];

  if (!event_notification_get_expt(handle, notification, expt, sizeof(expt))) {
    error("No EXPT field in the event");
    return false;
  }

  std::string exp(expt);
  std::map<std::string, std::string>::iterator member =
    keysmap.find(exp);

  if(member == keysmap.end()) {
    return false;
  }

  return true;

}


/* Adjusts the time of the event based on time offset between
 * local clock and ntp1.emulab.net server
 */

void adjust_offset(sched_event_t *event) {
  int num;
  float offset;

  FILE *fd = fopen(OFFSETFILE, "r");

  if (fd  == NULL) {
    error("Not able to open %s file\n", OFFSETFILE);
    return;
  }
  num = fscanf(fd, "%f\n", &offset);
  fclose(fd);

  if (num == EOF) return;

  /* update the event time */
  if (offset > 0) {
    int secs = floorf(offset);
    int usecs = (offset - secs) * 1000000;
    event->time.tv_sec = event->time.tv_sec - secs;
   
    if (event->time.tv_usec < usecs) {
      event->time.tv_sec--;
      event->time.tv_usec = event->time.tv_usec - usecs + 1000000;
    }
  } else {
    int secs = ceilf(offset);
    int usecs = (offset - secs) * 1000000;
    event->time.tv_sec = event->time.tv_sec - secs;
    event->time.tv_usec = event->time.tv_usec - usecs;
    
    if (event->time.tv_usec > 1000000) {
      event->time.tv_sec++;
      event->time.tv_usec = event->time.tv_usec - 1000000;
    }
  }
}
