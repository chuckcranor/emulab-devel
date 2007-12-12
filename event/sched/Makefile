#
# EMULAB-COPYRIGHT
# Copyright (c) 2002 University of Utah and the Flux Group.
# All rights reserved.
#
# Makefile for building event scheduler
#
# $Id: Makefile,v 1.4.50.1 2007-12-12 01:01:10 kevina Exp $

CC		= gcc
CFLAGS		= -g -I. -I../lib -Wall -DDEBUG
LDFLAGS		=
LIBS		= -lpthread -L../lib -levent

CFLAGS         += `elvin-config --cflags vin4mt`
LIBS           += `elvin-config --libs vin4mt`

MV		= mv -f
RM		= rm -f

program		= event-sched
source		= event-sched.c queue.c
object		= event-sched.o queue.o
header		= event-sched.h

.c.o:
	$(CC) $(CFLAGS) -c $<

default: $(program)

$(program): $(object)
	$(CC) $(LDFLAGS) -o $@ $^ $(LIBS) $(LIBS)

$(program): ../lib/libevent.a

$(object): $(header) ../lib/event.h

clean:
	$(RM) $(program) $(object)
