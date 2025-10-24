#!/bin/sh
#

host=$1
if [ "$host" == "" ]; then
    echo "Must supply a host name"
    exit 1
fi

ssh -A elabman@${host} "sudo mkdir -p /usr/testbed/www/mirror/repos.emulab.net && sudo chown -R elabman /usr/testbed/www/mirror && rsync -avz $USER@ops.emulab.net:/z/linux-package-repos/www/powder --exclude=powder/ubuntu/conf /usr/testbed/www/mirror/repos.emulab.net/ && rsync -avz $USER@ops.emulab.net:/z/linux-package-repos/www/powder-endpoints --exclude=powder-endpoints/ubuntu/conf /usr/testbed/www/mirror/repos.emulab.net/ && rsync -avz $USER@ops.emulab.net:/z/linux-package-repos/www/emulab.key /usr/testbed/www/mirror/repos.emulab.net/ && rsync -avz $USER@ops.emulab.net:/z/linux-package-repos/www/powder-testing --exclude=powder-testing/ubuntu/conf /usr/testbed/www/mirror/repos.emulab.net/"
