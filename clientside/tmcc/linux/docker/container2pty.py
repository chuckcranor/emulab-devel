#!/usr/bin/env python

#
# This is a simple python script that attaches to a Docker container,
# and exports its stdout/err and stdin as a pty.
#
# We have this little python gem because it isn't possible to easily
# override the perl LWP::Protocol::SocketUnixAlt thing to steal its
# socket.  The standard python docker API wrapper, OTOH, gives it to us
# straightaway.
#

import os
import fcntl
import sys
import traceback
import pty
import docker
import select

if docker.version_info[0] < 2:
    import docker.client
    client = docker.client.AutoVersionClient()
    socket = client.attach_socket(
        resource_id=sys.argv[1],
        params=dict(stdout=True,stderr=True,stdin=True,stream=True,logs=True))
else:
    client = docker.from_env()
    container = client.containers.get(sys.argv[1])
    socket = container.attach_socket(
        params=dict(stdout=True,stderr=True,stdin=True,stream=True,logs=True))
sockfd = socket.fileno()
flags = fcntl.fcntl(sockfd,fcntl.F_GETFL)
fcntl.fcntl(sockfd,fcntl.F_SETFL,flags | os.O_NONBLOCK)
(mfd,sfd) = pty.openpty()
print os.ttyname(sfd)
if len(sys.argv) > 2:
    os.symlink(os.ttyname(sfd),sys.argv[2])
flags = fcntl.fcntl(mfd,fcntl.F_GETFL)
fcntl.fcntl(mfd,fcntl.F_SETFL,flags | os.O_NONBLOCK)

retval = 0
try:
    (sockbuf,mbuf) = ('','')
    while True:
        (rlist,wlist,xlist) = select.select([sockfd,mfd],[sockfd,mfd],[],None)
        if sockfd in rlist:
            sockbuf += socket.recv(4096)
        if mfd in rlist:
            mbuf += os.read(mfd,4096)
        if len(mbuf) and sockfd in wlist:
            n = socket.send(mbuf)
            if n < len(mbuf):
                mbuf = mbuf[n:]
            else:
                mbuf = ''
        if len(sockbuf) and mfd in wlist:
            n = os.write(mfd,sockbuf)
            if n < len(sockbuf):
                sockbuf = sockbuf[n:]
            else:
                sockbuf = ''
except:
    traceback.print_exc()
    retval = -1

try:
    os.close(mfd)
    os.close(sfd)
    socket.close()
except:
    pass
if len(sys.argv) > 2:
    os.unlink(sys.argv[2])
sys.exit(retval)
