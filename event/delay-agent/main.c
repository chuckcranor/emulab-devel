/*
 * EMULAB-COPYRIGHT
 * Copyright (c) 2000-2004, 2006-2007 University of Utah and the Flux Group.
 * All rights reserved.
 */

/*
 * agent-main.c --
 *
 *      Delay node agent main file
 *
 */

/*********************************INCLUDES********************************/
#define REAL_WORLD 1

#if REAL_WORLD
  #include "main.h"
#else
  #include "main-d.h"
#endif
/*********************************INCLUDES********************************/

/************************GLOBALS*****************************************/
/* for reading in lines from config. files*/
char line[MAX_LINE_LENGTH];

/* address_tuple_t for subscribing to events*/
address_tuple_t event_t = NULL;

/* handle returned by event_register*/
event_handle_t handle;

/* temporary buffer for forming the server URL*/
char buf[BUFSIZ];

/* This holds the mapping between links as relevant to the event system,
   and the physical interfaces and pipe numbers
 */
structlink_map *link_map;

/* holds the number of entries in the link_map*/
int link_index = 0;

/* Raw socket*/
int s_dummy;

/* agent IP address */
char *ipaddr = NULL;

/* my pid/eid for event subscription */
char *myexp  = NULL;

/* The list of linknames in tuple format, for the event subscription */
char myobjects[1024];
char lanobjects[1024];

structlink_map *old_map;
int old_length;

int debug = 0;

void reset_callback(event_handle_t handle,
		    event_notification_t notification, void *data);
char *myvnode;

/************************GLOBALS*****************************************/


/************************** FUNCTION DEFS *******************************/


/************************* main **************************************

 ************************* main **************************************/
void realloc_map(void)
{
  link_map = realloc(link_map, sizeof(structlink_map) * (link_index + 1));
  if (link_map == NULL) {
    error("out of memory\n");
    exit(1);
  }

  memset(&link_map[link_index], 0, sizeof(structlink_map));
  if ((link_map[link_index].line = malloc(MAX_LINE_LENGTH)) == NULL) {
    error("out of memory\n");
    exit(1);
  }
  link_map[link_index].line[0] = '\0';
}

int main(int argc, char **argv)
{
  char c;
  char *server = "localhost";
  char * port  = NULL;
  char *map_file = NULL;
  char *log_file = NULL;
  char *pid_file = NULL;
  char *keyfile = NULL;
  FILE *mp = NULL;
  //char *log = NULL;
  char buf[BUFSIZ];

#if REAL_WORLD
  char ipbuf[BUFSIZ];
#endif
  
  opterr = 0;

  /* get params from the optstring */
  while ((c = getopt(argc, argv, "s:p:f:dE:l:i:k:j")) != -1) {
        switch (c) {
	  case 'd':
	      debug++;
	      break;
          case 's':
              server = optarg;
              break;
	  case 'p':
	      port = optarg;
	      break;
	  case 'f':
	      map_file = optarg;
	      break;
	  case 'l':
	      log_file = optarg;
	      break;
	  case 'i':
	      pid_file = optarg;
	      break;
	  case 'E':
	      myexp = optarg;
	      break;
	  case 'k':
	      keyfile = optarg;
	      break;
	  case 'j':
	      myvnode = optarg;
	      break;
	  case '?':
          default:
	      usage(argv[0]);
	      break;
        }
    }

  /*Check if all params are specified, otherwise, print usage and exit*/
  if(NULL == server || NULL == map_file)
      usage(argv[0]);

  if (debug)
     loginit(0, log_file);
  else {
      /* Become a daemon */
      daemon(0, 0);
      
      if (log_file)
	  loginit(0, log_file);
      else
	  loginit(1, "agent-thing");
  }

  /* open the map file*/
  if(NULL == (mp = fopen(map_file,"r")))
    {
      error("cannot open %s \n", map_file);
      exit(-1);
    }

  {

    char * temp = NULL;
    char *sep = " \n";
    char *lastname = NULL;

    realloc_map();
    while(fgets(link_map[link_index].line, MAX_LINE_LENGTH, mp)){
      temp = link_map[link_index].line;
      link_map[link_index].linkname = strsep(&temp, sep);
      link_map[link_index].linktype = strsep(&temp, sep);

      if(!strcmp(link_map[link_index].linktype,"duplex")){
	/*
	 * By convention, the first pipe is towards the switch if its
	 * a lan node delay. This is important cause of queue params,
	 * which we do not want to set on the pipe coming from the switch.
	 */
        link_map[link_index].vnodes[0] = strsep(&temp, sep);
	link_map[link_index].vnodes[1] = strsep(&temp,sep);
        link_map[link_index].interfaces[0] = strsep(&temp, sep);
	link_map[link_index].interfaces[1] = strsep(&temp,sep);
	link_map[link_index].pipes[0] = atoi(strsep(&temp,sep));
	link_map[link_index].pipes[1] = atoi(strsep(&temp,sep));
	sprintf(link_map[link_index].linkvnodes[0], "%s-%s",
		link_map[link_index].linkname, link_map[link_index].vnodes[0]);
	sprintf(link_map[link_index].linkvnodes[1], "%s-%s",
		link_map[link_index].linkname, link_map[link_index].vnodes[1]);

	if (!strcmp(link_map[link_index].vnodes[0],
		    link_map[link_index].vnodes[1])) {
	  link_map[link_index].islan = 1;
	}
	link_map[link_index].numpipes = 2;
      }
      else{
        link_map[link_index].vnodes[0] = strsep(&temp, sep);
        link_map[link_index].interfaces[0] = strsep(&temp, sep);
	link_map[link_index].pipes[0] = atoi(strsep(&temp,sep));
	sprintf(link_map[link_index].linkvnodes[0], "%s-%s",
		link_map[link_index].linkname, link_map[link_index].vnodes[0]);
	link_map[link_index].numpipes = 1;
      }

      /*
       * Form the comma separated list of linkname for the subscription
       * There are two objects, one for the lan, and one for lan-vnode.
       */
      /* Do not have name yet, so add it to the string */
      if (strlen(myobjects)) {
        strcat(myobjects, ",");
      }
      if (lastname == NULL || strcmp(lastname, link_map[link_index].linkname)){
	sprintf(&myobjects[strlen(myobjects)], "%s,",
		link_map[link_index].linkname);

	/* For the reset event below */
	if (strlen(lanobjects))
	  strcat(lanobjects, ",");
	sprintf(&lanobjects[strlen(lanobjects)], "%s",
		link_map[link_index].linkname);

	if (lastname)
	  free(lastname);
	lastname = strdup(link_map[link_index].linkname);
      }
      sprintf(&myobjects[strlen(myobjects)], "%s",
	      link_map[link_index].linkvnodes[0]);

      if(!strcmp(link_map[link_index].linktype,"duplex") &&
	 !link_map[link_index].islan) {
        sprintf(&myobjects[strlen(myobjects)], ",%s",
		link_map[link_index].linkvnodes[1]);
      }
      link_index++;
      realloc_map();
    }
  }

  old_map = link_map;
  old_length = link_index;

  /* close the map-file*/
  fclose(mp);
    
  /* create a raw socket to configure Dummynet through setsockopt*/
  
#if REAL_WORLD
  s_dummy = socket( AF_INET, SOCK_RAW, IPPROTO_RAW );
  if ( s_dummy < 0 ){
    error("cant create raw socket\n");
    return 1;
  }

/* this gets the current pipe params from dummynet and populates
     the link map table
   */
  if (get_link_info() == 0){
    error("cant get the link pipe params from dummynet\n");
    return 1;
  }

  /* dump the link_map to log*/
  dump_link_map();
  
  
 /*
  * Get our IP address. Thats how we name ourselves to the
  * Testbed Event System. 
  */
  if (ipaddr == NULL) {
     struct hostent	*he;
     struct in_addr	myip;
	    
     if (gethostname(buf, sizeof(buf)) < 0) {
	    error("could not get hostname");
	    return 1;
	}

      if (! (he = gethostbyname(buf))) {
	   error("could not get IP address from hostname");
	   return 1;
       }
       memcpy((char *)&myip, he->h_addr, he->h_length);
       strcpy(ipbuf, inet_ntoa(myip));
       ipaddr = ipbuf;
   }
#endif
  /*
   * Write out a pidfile.
   */
  if (pid_file)
	  strcpy(buf, pid_file);
  else
	  sprintf(buf, "%s/delayagent.pid", _PATH_VARRUN);
  mp = fopen(buf, "w");
  if (mp != NULL) {
	  fprintf(mp, "%d\n", getpid());
	  (void) fclose(mp);
  }
  
  /* Convert server/port to elvin thing.
   */
   if (server) {
	    snprintf(buf, sizeof(buf), "elvin://%s%s%s",
		     server,
		     (port ? ":"  : ""),
		     (port ? port : ""));
	    server = buf;
    }
  
  /* register with the event system*/

  handle = event_register_withkeyfile(server, 0, keyfile);
   if (handle == NULL) {
       error("could not register with event system\n");
       return 1;
   }

  if (debug)
    info("registered with the event server\n");
  else {
    struct timeval tv;
    gettimeofday(&tv, NULL);
    info("%d.%06d: %s: starting\n", tv.tv_sec, tv.tv_usec, myexp);
  }

 /* allocate an address_tuple*/
  event_t = address_tuple_alloc();

  /* fill up the tuple, before calling event_subscribe*/
  fill_tuple(event_t);
      
  /*subscribe to the event*/
   if (event_subscribe(handle, agent_callback, event_t, NULL) == NULL) {
        error("could not subscribe to %d event\n",event_t->eventtype);
        return 1;
    }

   if (!debug)
     info("  subscribed to: %s/%s\n", event_t->objname, event_t->eventtype);

  if (strlen(lanobjects)) {
    strcat(lanobjects, ",");
    strcat(lanobjects, ADDRESSTUPLE_ALL);
    event_t->objname   = lanobjects;
    event_t->objtype   = TBDB_OBJECTTYPE_LINK;
    event_t->eventtype = TBDB_EVENTTYPE_RESET;
    event_t->host      = ADDRESSTUPLE_ANY;
    event_t->expt      = myexp;
    
    if (event_subscribe(handle, reset_callback, event_t, NULL) == NULL) {
      error("could not subscribe to %d event\n", event_t->eventtype);
      return 1;
    }

    if (!debug)
      info("  subscribed to: %s/%s\n", event_t->objname, event_t->eventtype);
  }
  
  if (debug)
    info("subscribed...\n");

  /* free the memory for the address tuple*/
  address_tuple_free(event_t);

  if (debug)
    info("entering the main loop\n");
  /* enter the event loop */
   event_main(handle);
  
#ifdef DEBUG
  info("exiting function main\n");
#endif
  return 0;
}

/*********************** usage *********************************************
This function prints the usage to stderr and then exits with an error value

*********************** usage *********************************************/

/* prints the usage and exits with error*/
void usage(char *progname)
{
#ifdef DEBUG
  info("entering function usage\n");
#endif
  
  fprintf(stderr, "Usage: %s -s server [-p port] [-k keyfile] "
	  "-f link-map-file\n",
	  progname);
  exit(-1);
}


/************************* fill_tuple **********************************

************************** fill_tuple **********************************/

void fill_tuple(address_tuple_t at)
{
#ifdef DEBUG
  info("entering function fill_tuple\n");
#endif
  /* fill the objectname, objecttype and the eventtype from the file*/
  at->objname = myobjects;
  at->objtype = TBDB_OBJECTTYPE_LINK;
  at->eventtype = TBDB_EVENTTYPE_UP ","
	  TBDB_EVENTTYPE_DOWN "," TBDB_EVENTTYPE_MODIFY ","
	  TBDB_EVENTTYPE_CLEAR "," TBDB_EVENTTYPE_CREATE;
  at->expt = myexp;
  at->host = ADDRESSTUPLE_ANY;

  if (debug)
    info("tuple: %s -- %s\n", myobjects, myexp);
  
  /*fill in other values, dont know what to fill in yet*/
  at->site = ADDRESSTUPLE_ANY;
  at->group= ADDRESSTUPLE_ANY;
  at->scheduler = 0;
#ifdef DEBUG
  info("leaving function fill_tuple\n");
#endif
  return;
}

/***************************dump_link_map******************************
 Debugging aides.*/
/***************************dump_link_map******************************/
void dump_link(structlink_map *lmentry)
{
    int j;

    info ("===============================================================\n");
    info("linkname = %s\n", lmentry->linkname);
    info("linktype = %s\n", lmentry->linktype);
    info("linkstatus = %d \n", lmentry->stat);
    if (lmentry->clouddir)
      info("clouddir  = %d \n", lmentry->clouddir);
    info("numpipes   = %d \n", lmentry->numpipes);
    info("islan      = %d \n", lmentry->islan);
    info("dest       = %s \n", lmentry->fs.dest);
    info("protocol   = %s \n", lmentry->fs.protocol);
    info("srcport    = %d \n", lmentry->fs.srcport);
    info("dstport    = %d \n", lmentry->fs.dstport);

    for (j = 0; j < lmentry->numpipes; j++) {
      info("Pipe %d params:\n", j);
      info("interface = %s\n", lmentry->interfaces[j]);
      info("pipe num  = %d\n", lmentry->pipes[j]);
      info("vnode     = %s\n", lmentry->vnodes[j]);
      info("linkvnode = %s\n", lmentry->linkvnodes[j]);

      info("delay = %d bw = %d plr = %f\n",  lmentry->params[j].delay.delay,
	   lmentry->params[j].bw.bandwidth, lmentry->params[j].loss.plr);
      info("q_size = %d buckets = %d n_qs = %d flags_p = %d\n",
	   lmentry->params[j].q_size, lmentry->params[j].buckets,
	   lmentry->params[j].n_qs, lmentry->params[j].flags_p);
      
      if(lmentry->params[j].flags_p & PIPE_Q_IS_RED){
        info(" queue is RED min_th = %d max_th = %d w_q = %f max_p = %f\n",
	     lmentry->params[j].red_gred_params.min_th,
	     lmentry->params[j].red_gred_params.max_th,
	     lmentry->params[j].red_gred_params.w_q,
	     lmentry->params[j].red_gred_params.max_p);
      }
      else if(lmentry->params[j].flags_p & PIPE_Q_IS_GRED){
	info(" queue is GRED min_th = %d max_th = %d w_q = %f max_p = %f\n",
	     lmentry->params[j].red_gred_params.min_th,
	     lmentry->params[j].red_gred_params.max_th,
	     lmentry->params[j].red_gred_params.w_q,
	     lmentry->params[j].red_gred_params.max_p);
      }
      else info("queue is droptail\n");
      info ("-----------------------------------------------------------\n");
    }
}

void dump_link_map()
{
  int i;
  struct timeval tv;

  gettimeofday(&tv, NULL);
  info("dump at %ld.%d\n", tv.tv_sec, tv.tv_usec);
  for (i = 0; i < link_index; i++) {
    dump_link(&link_map[i]);  
  }
}

void
reset_callback(event_handle_t handle,
		event_notification_t notification, void *data)
{
	char		buf[BUFSIZ];
	char		objname[TBDB_FLEN_EVOBJNAME];
	char		*prog = "delaysetup";
	unsigned long	token = ~0;
	int		errcode = 0;
	char		*redir = ">/dev/null";

	event_notification_get_objname(handle, notification,
				       objname, sizeof(objname));

	if (debug) {
	  info("Got a RESET event!\n");
	  redir = "";
	} else {
	  struct timeval tv;
	  gettimeofday(&tv, NULL);
	  info("%d.%06d: %s: RESET\n", tv.tv_sec, tv.tv_usec, objname);
	}

	if (myvnode)
		sprintf(buf, "%s -r -j %s %s", prog, myvnode, redir);
	else
		sprintf(buf, "%s -r %s", prog, redir);
	errcode = system(buf);

	event_notification_get_int32(handle, notification,
				     "TOKEN", (int32_t *)&token);

	/* ... notify the scheduler of the completion. */
	event_do(handle,
		 EA_Experiment, myexp,
		 EA_Type, TBDB_OBJECTTYPE_LINK,
		 EA_Name, objname,
		 EA_Event, TBDB_EVENTTYPE_COMPLETE,
		 EA_ArgInteger, "ERROR", errcode,
		 EA_ArgInteger, "CTOKEN", token,
		 EA_TAG_DONE);
}
/************************** FUNCTION DEFS *******************************/
