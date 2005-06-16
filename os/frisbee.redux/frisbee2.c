/*
 * EMULAB-COPYRIGHT
 * Copyright (c) 2000-2004 University of Utah and the Flux Group.
 * All rights reserved.
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <pthread.h>
#include <unistd.h>

#include "decls.h"
#include "utils.h"

int		FrisbeeMode = 0;

typedef struct {
        int argc;
        char **argv;
} Args_t;

int client_main(int argc, char **argv);
int server_main(int argc, char **argv);

static void * 
ServerThread(void * args0) 
{
        Args_t * args = (Args_t *)args0;
        int res;
        res = server_main(args->argc, args->argv);
        return (void *)res;
}

static char *usagestr = 
 "usage: frisbeed2 [client|server ...] [-- server|client ...]\n"
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
 "Set the filename to \".\" to avoid saving an image to disk when in proxy mode.\n"
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
 "server usage: frisbeed2 server [-d] <-p #> <-m mcastaddr> [<filename>]\n"
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

int
main(int argc, char **argv)
{
        Args_t client_args, server_args;
        Args_t *args;
        int i, j;
        int res = -1;

	client_args.argc = 0;
        client_args.argv = (char **)calloc(argc, sizeof(char *));
        server_args.argc = 0;
        server_args.argv = (char **)calloc(argc, sizeof(char *));

        if (argc < 2)
                res = usage();
        else for (i = 1; i < argc; i++) {
                if (strcmp(argv[i], "client") == 0) {
                        args = &client_args;
                } else if (strcmp(argv[i], "server") == 0) {
                        args = &server_args;
                } else {
                        res = usage();
                        goto exit;
                }
                i++;
                args->argv[0] = argv[0];
                j = 1;
                for (; i < argc && strcmp(argv[i], "--") != 0; i++) {
                        args->argv[j] = argv[i];
                        j++;
                }
                args->argc = j;
        }

	FrisbeeMode = 0;
	if (client_args.argc > 0)
		FrisbeeMode |= FRISBEE_CLIENT;
	if (server_args.argc > 0)
		FrisbeeMode |= FRISBEE_SERVER;
	if (client_args.argc > 0 && server_args.argc > 0)
		FrisbeeMode |= FRISBEE_PROXY;

        if (FrisbeeMode & FRISBEE_PROXY) {
		pthread_t server_pid;
                void * server_res;

		fprintf(stderr, "Starting Server\n");
                res = pthread_create(&server_pid, NULL, ServerThread, &server_args);
                if (res != 0) fatal("Unable to start Server Thread");

		MutexLock(&StartupLock);
		while (!(StartupState & STARTUP_SERVER_READY))
		  pthread_cond_wait(&StartupCond, &StartupLock);

		fprintf(stderr, "Starting Client\n");
                res = client_main(client_args.argc, client_args.argv);
		if (debug)
			fprintf(stderr, "CLIENT DONE\n");
                if (res != 0) goto exit;

                pthread_join(server_pid, &server_res);
		if (debug)
			fprintf(stderr, "SERVER DONE\n");
                res = (int)server_res;

        } else if (FrisbeeMode & FRISBEE_CLIENT) {
                res = client_main(client_args.argc, client_args.argv);
        } else if (FrisbeeMode & FRISBEE_SERVER) {
                res = server_main(server_args.argc, server_args.argv);
        }
exit:
        free(client_args.argv);
        free(server_args.argv);

	PrintChunkBufferLockStats();

        return res;
}

