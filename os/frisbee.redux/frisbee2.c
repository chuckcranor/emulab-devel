/*
 * EMULAB-COPYRIGHT
 * Copyright (c) 2000-2004 University of Utah and the Flux Group.
 * All rights reserved.
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>

int		debug = 0;

int client_main(int argc, char **argv);
int server_main(int argc, char **argv);

static char *usagestr = 
 "usage: frisbeed2 client|server ...\n"
 "\n"
 "client usage: frisbee2 client [-drzbn] [-s #] <-p #> <-m ipaddr> <filename>\n"
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
 "client tuning options (if you don't know what they are, don't use em!):\n"
 " -C MB           Max MB of memory to use for network chunk buffering.\n"
 " -W MB           Max MB of memory to use for disk write buffering.\n"
 " -M MB           Max MB of memory to use for buffering\n"
 "                 (Half used for network, half for disk).\n"
 " -I ms           The time interval (millisec) between re-requests of a chunk.\n"
 " -R #            The max number of chunks we will request ahead.\n"
 " -O              Make chunk requests in increasing order (default is random order).\n"
 "\n"
 "server usage: frisbeed2 server [-d] <-p #> <-m mcastaddr> <filename>\n"
 " -d              Turn on debugging. Multiple -d options increase output.\n"
 " -p portnum      Specify a port number to listen on.\n"
 " -m mcastaddr    Specify a multicast address in dotted notation.\n"
 " -i mcastif      Specify a multicast interface in dotted notation.\n"
 " -b              Use broadcast instead of multicast\n"
 "\n";

static int
usage()
{
	fprintf(stderr, usagestr);
	return 1;
}

static void
shift_args(int *argc, char **argv)
{
        memmove(argv + 1, argv + 2, sizeof(char *)*(*argc - 2));
        (*argc)--;
}

int
main(int argc, char **argv)
{
        if (argc < 2) {
                return usage();
        } else if (strcmp(argv[1], "client") == 0) {
                shift_args(&argc, argv);
                return client_main(argc, argv);
        } else if (strcmp(argv[1], "server") == 0) {
                shift_args(&argc, argv);
                return server_main(argc, argv);
        } else {
                return usage();
        }
}
