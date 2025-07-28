#!/bin/sh

TBROOT="/usr/testbed"
APIPATH="$TBROOT/portal-rest"
GUNICORN="$TBROOT/portal-rest/venv/bin/gunicorn"
UVICORN="$TBROOT/portal-rest/venv/bin/uvicorn"
PIDFILE="/var/run/portal-rest.pid"
LOGFILE="$TBROOT/log/portal-rest.log"
USER="nobody"
GROUP="nobody"

# Ick
CERTFILE="$TBROOT/certbot/etc/live/www.emulab.net/cert.pem"
KEYFILE="$TBROOT/certbot/etc/live/www.emulab.net/privkey.key"
CAFILE="$TBROOT/certbot/etc/live/www.emulab.net/fullchain.pem"
#CERTFILE="$TBROOT/etc/genirpc.pem"
#KEYFILE="$TBROOT/etc/genirpc.pem"
#CAFILE="$TBROOT/etc/emulab.pem"

ADDRESS="0.0.0.0"
PORT=43794
WORKERS=1
LOGARGS="--log-file $LOGFILE --capture-output"

sudo $GUNICORN -w $WORKERS -b ${ADDRESS}:${PORT} --pid $PIDFILE \
	  --worker-class uvicorn.workers.UvicornWorker \
	  --user $USER --group $GROUP \
	  --log-level debug --name portal-rest \
	  --keyfile $KEYFILE --certfile $CERTFILE --ca-certs $CAFILE \
	  app.main:app

#$UVICORN --workers $WORKERS --host $ADDRESS --port $PORT \
#	 --log-level debug \
#	 --ssl-keyfile $KEYFILE --ssl-certfile $CERTFILE --ssl-ca-certs $CAFILE \
#	 app.main:app

