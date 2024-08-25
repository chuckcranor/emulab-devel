Upgrading Emulab servers from FreeBSD 12.3 to 13.3.

These are fairly specific, but not always exact instructions for the process.
They are also oriented toward the CloudLab family of clusters, hence the
references to mothership, Clemson, Wisconsin, Apt, etc.

The most significant changes are:
 * The amd automounter is gone
 * The original ZFS implementation has been replaced with OpenZFS
 * bind 9.16 to bind 9.18
 * php 7.4 to php 8.1
 * mysql 5.7 to MariaDB 10.6

Start with the boss node, and then you will repeat the instructions for ops.
Note that there are a couple of steps below that you only do on the boss or
the ops node, so pay attention!

A. Things to do in advance of shutting down Emulab.

   These first few steps can be done in advance of shutting down your site.
   These include making a backup, fetching the new release files and merging
   in local changes, building a custom kernel (if you use one), and stashing
   away state about your current packages.

1. BACKUP IF YOU CAN!

   If your boss and ops are VM on Xen, you can create shadows of the disks
   that you can roll back to. Really only need to backup the root disk which
   has all the FreeBSD stuff. Login to the control node and:

   # for thinly provisioned VMs
   sudo lvcreate -s -n boss.backup xen-vg/boss
   sudo lvcreate -s -n ops.backup xen-vg/ops
   
   # apt/cloudlab utah/clemson
   sudo lvcreate -s -L 17g -n boss.backup xen-vg/boss
   sudo lvcreate -s -L 17g -n ops.backup xen-vg/ops

   # umass
   sudo lvcreate -s -L 18g -n boss.backup xen-vg/boss.root
   sudo lvcreate -s -L 18g -n ops.backup xen-vg/ops.root

   For regular LVM volumes, this will seriously degrade the performance of the
   upgrade process due to the inefficiencies of disk writes when shadows are
   present, but it is worth it to avoid a total screw up.

   For thinly-provisioned snapshots of thin volumes, snapshots should not
   affect the performance of the upgrade significantly.

1b. Make sure you have sufficient disk space!

   I have never run out of disk space during the process below, but if
   you did, I suspect it could be a mess to recover. If you have at least
   4GB free on the root filesystem, you should be fine. Otherwise, you
   might need to make some space.

1c. (boss only) Change your home directory temporarily to a local directory.

   If you are currently using AMD and ZFS (WITHAMD=1, WITHZFS=1 in defs-*
   file), you will need to make this temporary change to work around AMD
   being removed in FreeBSD 13.3. If you are not using AMD or ZFS or you are
   already using the automounter (autofs) then skip to step 2.

   Since I am lazy, I just copy my whole homedir to /usr/testbed/data or
   whatever local, non-root filesystem has GBs of space. At a minimum you
   will probably want your dotfiles and space for an Emulab source and build
   trees (for the next step).

   Then use `vipw` to change your home directory to that place and logout
   and back in again.

2. Update Emulab software on existing system.

   To making things easier later, it is best to upgrade your Emulab software
   before you start the OS upgrade. In particular, there are startup file
   changes related to MariaDB and Apache that will need to be in place after
   the new packages are installed. All SW changes should be backward
   compatible, so there is no danger to doing this now.

   Follow the instructions in "install/README-upgrade-php81-sw.txt" in the
   Emulab source directory to do this. If possible, it would be good to at
   least reboot the boss node and make sure there are no issues with startup.

3. Fetch the new release with freebsd-update.

   This will not install anything, it will just fetch the new files and merge
   local changes in. You can do this on both boss and ops simultaneously.

   Do not do it too far (i.e., more than a day) in advance, since the base
   system changes and your local mods may change as well. For example, new
   users might be added in the interim which would invalidate your merged
   changes. 

   Before fetching, make sure your /etc/freebsd-update.conf is correct,
   in particular the "Components" line.

   By default it will want to update your kernel ("kernel") and source tree
   ("src") as well as the binaries ("world"). Life will be much easier if you
   go with the flow and just let it do that. The only reason we had for using
   a non-GENERIC kernel was related to running in a VM with more that 4 "sda"
   (emulated SCSI) devices. There, the standard FreeBSD NCR driver was causing
   problems. The other reason might be if you had to add some non-standard
   driver.

   If you have a custom source tree (or update it yourself with svn or git)
   then remove "src" from the line:

     Components world kernel # don't update src

   If you have a custom kernel, then remove "kernel":

     Components world # don't update src or kernel

   However, because you are changing major releases, rebuilding your
   custom kernel (next step) will require rebuilding the entire world first,
   which takes a long time and pretty much eliminates the advantages of
   using the binary update system. So, you might reconsider why you have a
   custom kernel and move back to the default kernel instead. If you opt
   for the default GENERIC kernel, make sure to leave "kernel" in the
   components above.

   Once you have /etc/freebsd-update.conf squared away, do the "fetch"
   part of the upgrade:

     sudo freebsd-update -r 13.3-RELEASE upgrade

   Since this will ask you to merge a bunch of local changes into various
   files and will want to fire up an editor, you might want to make sure
   you get a *real* editor by doing:

     sudo -E EDITOR=emacs freebsd-update -r 13.3-RELEASE upgrade

   instead. Otherwise you will probably wind up with vi. If you forget,
   you can always temporarily (or permanently!) replace /usr/bin/vi with
   /usr/local/bin/emacs when it first prompts you to manually handle
   a merge.

   It will crunch for a long time and then probably want you to merge
   some conflicts. Many will just be removal of the old FreeBSD header,
   but some other possible diffs:

     /etc/hosts.allow. We customized this to block rpcbind, tftpd, and
     bootinfo access from outside the local network.

     /etc/ntp.conf. We may have replaced the version string with our own
     header. For the merge you should leave both. We leave out all the
     default restrict/server/etc. lines in favor of our own. Do leave in
     the "leapfile" info.

     /etc/syslog.conf. Leave in all the "Added by Emulab" changes. All of
     our stuff should be after the standard stuff before the "!*" and
     the includes of directories.

     /etc/newsyslog.conf. Leave in all the "Added by Emulab" changes. All of
     our stuff should be after the standard stuff before the includes of
     directories.

     /etc/inetd.conf (ops). We have an old "flashpolicy" line at the end that
     conflicts with their "prom-ctl" line somehow. Just remove our line and
     leave theirs.

     /etc/services. Remove our old "flashpolicy" line(s).

     /etc/ssh/ssh_config (ops). We have a couple of "Host *" options.
     Keep those at the end. Otherwise go with new changes.

     /etc/ttys. May be conflicts due to Xen console declaration.
     Go with the new stuff.

   NOTE: if you built and installed your system from sources originally,
   you may also get some conflicts with other files where it calls out diffs
   is the RCS header or in comments. Favor the newer versions of those to
   hopefully avoid future conflicts.

     REALLY IMPORTANT NOTE: if it shows you a diff and asks you if something
     "looks reasonable" and you answer "no", it will dump you out of the
     update entirely and you have to start over. It will *not* just let you
     fire up the editor and fix things!

   After handling the diffs, it will then show you several potentially long
   lists of files that it will be adding, deleting, etc. It uses "more" to
   display them, so you can 'q' out of those without dumping out of the
   update entirely (the last one will exit the update, but that is because
   it is done).

   DO NOT do the install as it suggested at the end. We will get there
   in step B3 below. There are some other things that might need doing first.

4. (Optional) Upgrade your custom kernel.

   [ I have not tested this section as we have stopped using a custom kernel. ]

   If you have a custom kernel config, then you should build and install
   a new kernel first. As mentioned in the last step, this will take a long
   time because you must build (but not install) the entire world before
   building the kernel. You can again do this on boss and ops simultaneously.

   Clone the FreeBSD 13.3 source repo:

   Using "--depth=1" on the Git command line keeps it from downloading the
   entire history and goes much faster. Leave that part off if you want the
   entire history.

     cd /usr
     sudo mv src Osrc
     git clone -b releng/13.3 --depth 1 https://git.freebsd.org/src.git
     <copy over your custom config file from Osrc/sys/amd64/conf/CUSTOM>

     cd src
     sudo make -j 8 buildworld
     sudo make -j 8 buildkernel KERNCONF=CUSTOM

5. Stash away the current set of packages you have installed.

   This will allow you to figure out the extra ports you have installed so
   that you can update them later. First make a list of everything installed:
   Do this on boss and then on ops. For boss:

   mkdir ~/upgrade
   cd ~/upgrade
   pkg query "%n-%v %R" > boss.pkg.list

   This is mostly to keep track of any ports you may have installed locally.
   One way to determine local installs is to see which ports did NOT come
   from the Emulab repository:

   grep -v 'Emulab$' boss.pkg.list | awk '{ print $1; }' > boss.pkg.local

   This will give you the list of packages that you may need to reinstall.

   You may want to list the dependencies of each to see what the top-level
   packages are and just install those. NOTE: this command may fail ugly if
   there is nothing in the boss.pkg.local file.

   pkg query -x "%n %v usedby=%#r" `cat boss.pkg.local` | \
       grep 'usedby=0' | awk '{ print $1; }' > boss.pkg.reinstall

   The corresponding commands when updating the ops node are:

   cd ~/upgrade
   pkg query "%n-%v %R" > ops.pkg.list
   grep -v 'Emulab$' ops.pkg.list | awk '{ print $1; }' > ops.pkg.local
   pkg query -x "%n %v usedby=%#r" `cat ops.pkg.local` | \
       grep 'usedby=0' | awk '{ print $1; }' > ops.pkg.reinstall

6. Install automounter files

   change defs file to get rid of WITHAMD
   cd obj/autofs; gmake all install
   make symlinks from /usr/testbed/etc/autofs_boss.sh to /etc/auto_{users,proj,groups}


B. Updating the base FreeBSD system

1. (CloudLab clusters only) Shut the cluster down at the portal.

   Maybe 10-15 minutes before you plan on starting the upgrade, take
   the cluster offline at the CloudLab portal to allow things to settle:

     # On mothership boss
     wap manage_aggregate <clustername> chflag disabled yes

   Cluster name comes from running "wap manage_aggregate list" on
   the Mothership boss. Use the "Nickname".
   
2. If you are on the boss node, shutdown the testbed and some other services
   right off the bat.

   boss:
     sudo /usr/testbed/sbin/testbed-control shutdown
     sudo /usr/local/etc/rc.d/apache24 stop
     sudo /usr/local/etc/rc.d/tftpd-hpa.sh stop

     # The following may or may not be installed.
     test -x /usr/local/etc/rc.d/capture && \
         sudo /usr/local/etc/rc.d/capture stop
     test -x /usr/local/etc/rc.d/capture.sh && \
         sudo /usr/local/etc/rc.d/capture.sh stop
     test -x /usr/local/etc/rc.d/telegraf && \
         sudo /usr/local/etc/rc.d/telegraf stop

   ops:
     sudo /usr/local/etc/rc.d/apache24 stop

     # The following may or may not be installed
     test -x /usr/local/etc/rc.d/1.mysql-server.sh && \
         sudo /usr/local/etc/rc.d/1.mysql-server.sh stop
     test -x /usr/local/etc/rc.d/webssh.sh && \
         sudo /usr/local/etc/rc.d/webssh.sh stop
     test -x /usr/local/etc/rc.d/capture.sh && \
         sudo /usr/local/etc/rc.d/capture.sh stop
     test -x /usr/local/etc/rc.d/telegraf && \
         sudo /usr/local/etc/rc.d/telegraf stop
     test -x /usr/local/etc/rc.d/3.mfrisbeed-ops.sh && \
         sudo /usr/local/etc/rc.d/3.mfrisbeed-ops.sh stop
     
   On the Utah clusters you may need to also need to stop some additional
   services:

     # boss and ops:
     sudo /usr/local/etc/rc.d/bareos-fd stop

Other newer stuff:

 * what about eventsys proxies?

3. Before installing the new binaries/libraries/etc., you might want to back
   up the files that have Emulab changes just in case. The easiest thing to do
   is just:

     sudo rm -rf /Oetc
     sudo cp -rp /etc /Oetc

4. Install the new system binaries/libraries/etc:

   If it has been more than a day or so since you did the "upgrade"
   command back in step A2, then you might consider doing it again because
   new users and group might have been added. Doing it again basically
   throws away everything it built up on the previous run and you will
   have to go through all the manual merging again. Or you can try the
   WORKAROUND below.

   Once you are satisfied, do the install of the new binaries:

    sudo /usr/sbin/freebsd-update install

    After a while it will want you to reboot the new kernel.

5. Reboot AFTER making some checks.

   This step is called out because some extra action have to take place
   first. Most importantly, you need to make sure that the second-stage
   boot loader is the correct one:

      cd /boot
      sudo rm loader
      sudo ln loader_4th loader

  If it is linked to the newer LUA boot loader, the node might NOT BOOT.

  If you built a custom kernel back in step A3, install it now before you
  reboot:

   cd /usr/src
   sudo make installkernel KERNCONF=CUSTOM

   When I did the custom kernel install, I saw errors of the form:

      kldxref /boot/kernel
      kldxref: unknown metadata record 4 in file atacard.ko
      kldxref: unknown metadata record 4 in file atp.ko
      ...

   They did not seem to affect the following boot.

   WEIRD SPECIAL CASE: if your boss and ops are in an Emulab elabinelab
   experiment using Xen "pvh" VMs, you will have to install a copy of
   the kernel on the _physical_ host in /vminfo/vminfo/pcvmXXX-X/kernel
   for both boss and ops.

   If the node is using ZFS you should probably export any zpools at this
   point since the ZFS implementation has changed between 12.x and 13.x.
   You may be able to just login as root and then:

     zfs unmount -a
     zpool export <pool> ...

   I don't think this is strictly necessary as I have always been able to
   just naively shutdown and then just import the zpool(s) when I come
   back up in 13.3. Either way, you will need to re-import any pools after
   reboot as directed below. Note that the re-import can take minutes if
   you have lots of filesystems.

   BE AWARE that you will need to make sure you can login as root after
   reboot if you just "let it happen" because your homedir may not mount!

   NOTE: I have noticed a couple of times on VM-based elabinelab boss/ops
   upgrades that the root filesystem has some issues after the upgrade,
   so it is good to run an fsck. I prefer to do this while shutting down.
   Before you do this, make sure you first have access to the console!

   sudo shutdown now

   umount -at nfs
   umount -at ufs
   accton	# turn off accounting that has a file open on /
   mount -o ro -u /
   fsck -y /
   reboot

   NOTE: when rebooting boss, mysqlcheck might take awhile (5-10 minutes).
   During this time, it won't say much...^T is your friend. The ops reboot
   will also take awhile for the ZFS mounts, but it will talk to you while
   it is doing it.

6. Finish the install

   When it comes back up, you should login and shutdown services that
   restarted, including some that won't work right.

   boss:
     sudo /usr/testbed/sbin/testbed-control shutdown
     sudo /usr/local/etc/rc.d/apache24 stop
     sudo /usr/local/etc/rc.d/tftpd-hpa.sh stop
     sudo /usr/local/etc/rc.d/2.dhcpd.sh stop
     sudo /usr/local/etc/rc.d/2.mysql-server.sh stop

     # The following may or may not be installed
     test -x /usr/local/etc/rc.d/capture && \
         sudo /usr/local/etc/rc.d/capture stop
     test -x /usr/local/etc/rc.d/capture.sh && \
         sudo /usr/local/etc/rc.d/capture.sh stop
     test -x /usr/local/etc/rc.d/telegraf && \
         sudo /usr/local/etc/rc.d/telegraf stop

   ops:
     sudo /usr/local/etc/rc.d/apache24 stop

     # The following may or may not be installed
     test -x /usr/local/etc/rc.d/1.mysql-server.sh && \
         sudo /usr/local/etc/rc.d/1.mysql-server.sh stop
     test -x /usr/local/etc/rc.d/webssh.sh && \
         sudo /usr/local/etc/rc.d/webssh.sh stop
     test -x /usr/local/etc/rc.d/capture.sh && \
         sudo /usr/local/etc/rc.d/capture.sh stop
     test -x /usr/local/etc/rc.d/telegraf && \
         sudo /usr/local/etc/rc.d/telegraf stop
     test -x /usr/local/etc/rc.d/3.mfrisbeed-ops.sh && \
         sudo /usr/local/etc/rc.d/3.mfrisbeed-ops.sh stop

   Utah:
     sudo /usr/local/etc/rc.d/bareos-fd stop

   Now you should re-import any ZFS zpools:

     # see what the pools are
     zpool import
     # import each one
     # on ops there is probably only one, and it can take minutes to import
     zpool import <pool>
     ...

   NOTE: there is a goofiness when upgrading from 12.3 to 13.3. It is
   apparently not prepared for /usr/include/c++/v1/{__string,__tuple} to
   exist but not be a directory. You should remove those two files now
   or else the install below will throw errors and not install the new
   versions. This will come back to haunt you when you build Emulab SW
   later if you do not correct this now:

     sudo rm /usr/include/c++/v1/__string /usr/include/c++/v1/__tuple

   Now run freebsd-update to finish:

     # this can take 10+ minutes
     sudo /usr/sbin/freebsd-update install

   NOTE that it will tell you to rebuild all third-party packages and
   run freebsd-update again to get rid of old libraries. We do this later
   below, so don't worry about it now.

   NOTE also that I have found `sshd` to need restarting after the upgrade
   of else you will not be able to connect:

     sudo /etc/rc.d/sshd restart

   If a long time (hours to days) passed between the time you did the
   freebsd-update "fetch" and when you do the "install", you should check
   to see if any new Emulab users/groups have been added to the system in
   the interim. You can compare the files you stashed off in /Oetc to the
   ones that have now been updated in /etc:

     sudo diff /Oetc/passwd /etc/passwd
     sudo diff /Oetc/group /etc/group

   If there are differences, other than new FreeBSD users or groups
   (ids lower than 1000), you will need to manually merge the new accounts
   from /Oetc to /etc.

   Even if you don't add new accounts manually above, rebuild the password
   database as we have had inconsistencies in the past:
   
     sudo pwd_mkdb -p /etc/master.passwd

   In general, if you are paranoid you can now compare against the files
   you saved to make sure all the Emulab changes were propagated; e.g.:

     sudo diff -r /Oetc /etc

   Of course, this will show you every change made by the update as well,
   so you might just want to focus on important file that you may have
   changed as part of the initial Emulab setup such as:

     /etc/group
     /etc/hosts
     /etc/master.passwd
     /etc/ntp.conf
     /etc/ssh/sshd_config
     /etc/ttys
   

   Watch our for files that have appeared and disappeared as well:

     sudo diff -r /Oetc /etc | grep '^Only'

   If you are happy you can remove /Oetc, but I would keep it around
   for a few days/weeks in case something comes up.

   IMPORTANT NOTE: if your /etc/timezone file is old and out of sync, it
   may cause problems for perl and our Emulab software config. Since the
   upgrade will install new /usr/share/zoneinfo files, make sure you are
   in sync with those:

      sudo tzsetup -r

7. (Utah only) Apply Emulab patches to select system utilities.

   We have patched a couple of system utilities to better handle the
   large number of users, groups and filesystem mounts that the Emulab
   Mothership and assorted CloudLab clusters sport. Other sites really
   don't need to (and probably should not) do this.

   Make sure you have the appropriate FreeBSD source tree installed.

     cd /usr
     sudo git clone -b releng/13.3 --depth 1 https://git.freebsd.org/src.git

   If you did not for some reason grab the `php81` branch of the Emulab
   source tree, do that now:

     cd ~
     git clone -b php81 \
         https://gitlab.flux.utah.edu/emulab/emulab-devel.git testbed-new

   Since you probably don't have any of the FreeBSD "tests" infrastructure
   installed, you need to prevent it from attempting to install stuff there.
   Edit /etc/src.conf and add the line:

     WITHOUT_TESTS=yes

   Now patch, build, and install the Emulab versions:

     # on boss you just need the "pw" patch
     cd /usr/src/usr.sbin/pw
     sudo patch -p1 < ~/testbed-new/patches/FreeBSD-13.3-pw-2.patch
     sudo make obj
     sudo make all install clean

     # on ops you should install all patches
     cd /usr/src/usr.sbin/pw
     sudo patch -p1 < ~/testbed-new/patches/FreeBSD-13.3-pw-2.patch
     sudo make obj
     sudo make all install clean
     # mountd has been fixed, but we still have stats gathering and optims.
     cd /usr/src/usr.sbin/mountd
     sudo patch -p1 < ~/testbed-new/patches/FreeBSD-13.3-mountd.patch
     sudo make obj
     sudo make all install clean
     cd /usr/src/sbin/mount
     sudo patch -p1 < ~/testbed-new/patches/FreeBSD-13.3-mount.patch
     sudo make obj
     sudo make all install clean

8. Back up your database before switching from mysql to mariadb (boss only)

     # restart old mysqld
     sudo /usr/local/etc/rc.d/2.mysql-server.sh start

     # this dump could be GBs in size and take a long time to dump
     # make sure the destination has enough space
     sudo chmod 775 /usr/testbed/backup
     mysqldump --all-databases --single-transaction --quick \
         --lock-tables=false > /usr/testbed/backup/mysql-full-backup.sql
     cp -p /usr/local/etc/mysql/my.cnf /usr/testbed/backup/my.cnf-5.7
     sudo chmod 755 /usr/testbed/backup

     # and shutdown again
     sudo /usr/local/etc/rc.d/2.mysql-server.sh stop

9. How did that work out for ya?
 
   If all went well, skip to C (Updating ports/packages).

   If that didn't work, contact testbed-ops.

C. Updating ports/packages

   Updating the core ports from 12.3 to 13.3 is pretty easy if you were
   running the most recent set of 12.3 packages. Note that if you installed
   extra ports, upgrading will require a bit more work.

   Before starting, make sure that mysqld and Apache are not running
   (see A3 above) as both will be getting upgraded (PHP in the Apache case).

0. If you forgot to save off your package info back in A4, or it has been
   awhile, then you might want to go back and do that now.

   You may also want to back up config files for third-party packages:

      sudo rm -rf /usr/local/Oetc
      sudo cp -rp /usr/local/etc /usr/local/Oetc

1. Modify your /etc/pkg/Emulab.conf file, replacing "12.3" with "13.3" in
   the "url" line:

      sudo sed -i .bak -e 's;/12.3/;/13.3/;' /etc/pkg/Emulab.conf

2. Update the pkg tool and install new packages:

   Since you changed major versions it will prompt you to run
   "pkg bootstrap". That won't work with the Emulab package repository,
   so instead just reinstall pkg:

    sudo pkg update
    sudo -E ASSUME_ALWAYS_YES=true pkg install -f -r Emulab pkg
    sudo -E ASSUME_ALWAYS_YES=true pkg upgrade -r Emulab

3. Tweak package installs:

   REALLY, REALLY IMPORTANT: at some point, the perl port stopped installing
   the /usr/bin/perl link which we use heavily in Emulab scripts. Ditto for
   python and the /usr/local/bin/python link. Make sure those two symlinks
   exist and are correct:

      # see if they exist
      ls -la /usr/bin/perl /usr/local/bin/python
      # update em
      sudo ln -sfn /usr/local/bin/perl /usr/bin/perl
      sudo ln -sfn /usr/local/bin/python3.9 /usr/local/bin/python
      # verify they resolve
      ls -laL /usr/bin/perl /usr/local/bin/python

   REALLY, REALLY IMPORTANT PART 2: Because perl changed, you will need
   to make sure that the event library SWIG-generated perl module is rebuilt,
   and then all the event clients. Otherwise you will get bus errors when
   they all try to start. So do not skip step E2 below!

   REALLY, REALLY IMPORTANT PART 3 (boss node only): For those with Moonshot
   chassis, you cannot use an ipmitool port *newer* than 1.8.15 due to issues
   with "double bridged" requests. Either ipmitool or HPE got it wrong and it
   doesn't behave like ipmitool expects as of commit 6dec83ff on
   Sat Jul 25 13:15:41 2015. Anyway, you will need to replace the standard
   ipmitool install with the "emulab-ipmitool-old-1.8.15_1" package from
   the emulab repository, unless you already had it installed. This is
   unfortunately a bit complicated and warranted its own README file in
   the Emulab source repo:

     install/ports/README-update-moonshot-ipmitool

   The short version is:

     # unlock package if it is locked and remove it
     sudo pkg unlock emulab-ipmitool-old
     sudo pkg delete -f emulab-ipmitool-old

     # force an upgrade to reinstall the new (wrong) ipmitool
     sudo pkg upgrade -r Emulab -f emulab-boss

     # delete just that package
     sudo pkg delete -f ipmitool

     # re-add the old (right) ipmitool USING THE PACKAGE
     # (which you will need to copy over to /tmp)
     cd /tmp
     sudo pkg add -M emulab-ipmitool-old-1.8.15_1.pkg

     # change the dependency
     sudo pkg set -n ipmitool:emulab-ipmitool-old

   But ONLY do this if you have Moonshot chassis.

3b. Additional package cleanup.

   IMPORTANT: we run apache as 'nobody' but the FreeBSD default is 'www'.
   One place this makes a difference is on boss for the fcgid module where
   a directory is installed as accessible by only 'www'. You will need to
   fix this:

     # boss only
     sudo chown nobody:nobody /var/run/fcgidsock
     sudo chmod 770 /var/run/fcgidsock

   To be extra tidy, get rid of any abandoned ports on boss and ops.
   Look carefully at what the following wants to do (it will prompt you).
   If there is any doubt, just say no. Note that `jove` is no longer
   available as a package, so if you want it, lock it down first.

     # keep jove around
     sudo pkg lock jove

     sudo pkg autoremove
   
   To make sure your packages are in a consistent state you should check
   everything:

     sudo pkg check -adBs
   
   If you discover in "check" that "autoremove" took out a library
   (e.g. libsodium) required by a package (e.g., vim), then you can just
   forcibly reinstall the package ala:

     sudo pkg install -f -r Emulab vim

   and then rerun the check.

4. Reinstall wssh (ops only).

   For Cloudlab clusters, the `wssh` install has to be updated by hand for
   python3 since it does not come from a package. See install/phases/webssh
   for details, but I think this will do it:

    # on ops
    cd /tmp
    git clone https://gitlab.flux.utah.edu/emulab/webssh.git
    cd webssh
    sudo python setup.py install

5. Reinstall geni-lib (Geni sites only, do from boss)

   This is really a Python 2 to Python 3 change and could be done sooner
   than now, but we do it here. Note that we do this from boss but it is
   actually installed on ops (via NFS):

     # on boss
     cd /tmp
     git clone https://gitlab.flux.utah.edu/emulab/geni-lib.git
     sudo rsync -av --delete geni-lib/ /usr/testbed/opsdir/lib/geni-lib

6. Convert to MariaDB (boss only)

   You will need to fix up /usr/local/etc/mysql/my.cnf:

     cd /usr/local/etc/mysql
     sudo mv my.cnf my.cnf.bak
     sudo cp my.cnf.sample my.cnf

   Then copy the "Added by Emulab" client/server section(s) from the end
   of my.cnf.bak to the end of the new my.cnf. This section should be *after*
   the "includedir" directive so that it overrides things in there.
   It should look something like:

   ...
   #
   # include *.cnf from the config directory
   #
   !includedir /usr/local/etc/mysql/conf.d/

   # Added by Emulab
   [mysql]
   prompt                          = [\d]>\_
   no_auto_rehash

   [mysqld]
   innodb_buffer_pool_size         = 128M
   innodb_data_file_path           = ibdata1:16M:autoextend
   innodb_temp_data_file_path      = ibtmp1:48M:autoextend
   performance_schema              = OFF
   log-error                       = /usr/testbed/log/mysqld-error.log
   # End of Emulab added section

   NOTE that I have also now added the log-error option setting. So make
   sure the file exists and is properly protected:

     sudo cp /dev/null /usr/testbed/log/mysqld-error.log
     sudo chown mysql:mysql /usr/testbed/log/mysqld-error.log
     sudo chmod 640 /usr/testbed/log/mysqld-error.log

   Make sure all the symlinks are in place:

     sudo ln -sfn /usr/testbed/data/mysql /var/db/mysql
     sudo mkdir -p /usr/testbed/data/mysql_tmpdir
     sudo chown mysql:mysql /usr/testbed/data/mysql_tmpdir
     sudo ln -sfn /usr/testbed/data/mysql_tmpdir /var/db/mysql_tmpdir

   Restart mysqld and see if it works. First make sure that you installed
   the new version of the rc.d/2.mysql-server.sh file. It should have a
   section for "$major -eq 10", which is MariaDB 10.6. If all is well:

     # restart mysqld
     sudo /usr/local/etc/rc.d/2.mysql-server.sh start

     # make sure it is running
     # if you get a prompt, all is well
     # otherwise look at /usr/testbed/log/mysqld-error.log
     mysql tbdb
     quit

     # convert to mariadb
     sudo mariadb-upgrade

     # run some other (redundant) checks as well
     # XXX need the stop/start to reset the grant table from the upgrade
     # XXX both could take minutes to run
     sudo /usr/local/etc/rc.d/2.mysql-server.sh stop
     sudo /usr/local/etc/rc.d/2.mysql-server.sh start
     mysqlcheck --all-databases --check-upgrade
     sudo /usr/local/etc/rc.d/2.tbdbcheck.sh start

     # stop it again
     sudo /usr/local/etc/rc.d/2.mysql-server.sh stop

7. Critical hack fix to Apache (boss only)

   Any configuration of the latest Apache server that uses PHP needs to have
   Address Space Layout Randomization (ASLR) turned off. See:
   https://bugs.freebsd.org/bugzilla/show_bug.cgi?id=268318
   Otherwise, the server will crash whenever you do a "graceful" restart
   which we do every morning from crontab in "getcacerts". This can also
   happen when the Apache logfiles are rolled. So for now, turning off ASLR
   works for us. Add this to boss's /etc/rc.conf file:

     # XXX (hopefully) prevents crashs on "graceful" restart of apache
     apache24_aslr_disable="YES"

8. Make changes for PHP 8.1

   You will need to inform PHP about where the DB socket is now.
   Go into obj/boss/apache and

     diff php.ini /usr/local/etc/php.ini

   The important fix you need is to add on boss is (you don't need this on ops):

     ;
     ; For mariadb
     ;
     mysqli.default_socket   =       "/var/run/mysql/mysql.sock"

   to the end.

   Also make sure that the logfile exists and has correct permissions

     sudo touch /usr/testbed/log/php-errors.log
     sudo chmod 666 /usr/testbed/log/php-errors.log

9. Reinstall local ports.

   To find ports that are installed but that are not part of the Emulab
   repository:
   
   # boss
   cd ~/upgrade
   pkg query "%t %n-%v %R" `cat boss.pkg.reinstall` |\
       grep -v Emulab | sort -n

   # ops
   cd ~/upgrade
   pkg query "%t %n-%v %R" `cat ops.pkg.reinstall` |\
       grep -v Emulab | sort -n

   These will be sorted by install time. You can see ones that are old
   and attempt to reinstall them with "pkg install". Note that just because
   they are old that doesn't mean they need to be reinstalled.

   Note that these local packages might reload some dependent packages
   from the FreeBSD repo, overwriting the versions installed from the Emulab
   repo. So once you have installed all of the additional packages, you should
   re-update from Emulab again:
   
      sudo -E ASSUME_ALWAYS_YES=true pkg upgrade -r Emulab

   This is a point at which you might want to check for security problems:

     sudo pkg audit -F

   It is possible that some packages will have vulnerabilities, so unless
   it sounds really serious, just live with it.

10. Update your /etc/make.conf file in the event that you need to build a
   port from source in the future. Make sure your DEFAULT_VERSION line(s)
   look like:

DEFAULT_VERSIONS=perl5=5.36 python3=3.9 php=8.1 mysql=106m apache=2.4 tcltk=8.6
DEFAULT_VERSIONS+=ssl=base

D. Repeat steps B and C for ops.

E. Update Emulab software

1. Make sure your Emulab sources are up to date.

   You must use the emulab-devel repository and the "php81" branch at this
   point as only it has the necessary changes to support FreeBSD 13.3.
   You should have cloned this above, if not:

     cd ~
     git clone -b php81 \
         https://gitlab.flux.utah.edu/emulab/emulab-devel.git testbed-new

   Make sure to copy over your existing defs-* file to the new source
   tree.

2. Switch from AMD to autofs (on boss, if needed).

   # Change defs file to set WITHAMD=0 (or comment out)
   # Also need ZFS_NOEXPORT=1? Does autofs work without ZFS?
   # install from autofs directory in Emulab tree
   # add autofs enables in /etc/rc.conf
     autofs_enable="YES"
     automountd_flags="-v"
     autounmountd_flags="-v"

3. Reconfigure, rebuild, and reinstall the software.

   RANDOM NOTE: I had this failure when building event_proxy.cc on ops:

      /usr/include/c++/v1/__fwd/get.h:18:10: fatal error: '__tuple/tuple_element.h' file not found
         18 | #include <__tuple/tuple_element.h>
	    |          ^~~~~~~~~~~~~~~~~~~~~~~~~
         1 error generated.

   Something about upgrading directly from 12.3 to 13.3 caused a couple of
   directories (__tuple and __string) to wind up missing. If you do:

      ls -la /usr/include/c++/v1/__tuple

   and it fails to find the directory, apply the following hack (boss and ops):

      cd /tmp
      fetch https://www.emulab.net/downloads/FreeBSD-13.3-c++-v1-missing.tar.gz
      sudo tar -C /usr/include/c++/v1 -xzf /tmp/FreeBSD-13.3-c++-v1-missing.tar.gz
   
   You want everything to be built against the new ports and libraries
   anyway though, so just rebuild and install everything.

   Check the defs-* file you use and make sure that INCREMENTAL_MOUNTD=0
   (or remove the line entirely). The standard mountd now supports incremental
   updates by default.

   It is very important that you reconfigure your build tree since we earlier
   compiled the new source in the old environment. So we completely remove
   the contents of the tree and reconfigure. In your build tree, look at
   config.log to see how it was configured and then:

      # on both (in different build trees!)
      cd <builddir>
      head config.log	# see what the configure line is
      sudo rm -rf *
      <run the configure line>

      # on ops -- do this first
      sudo gmake opsfs-install
      # mysql is no longer installed
      sudo rm /usr/local/etc/rc.d/1.mysql*

   The reason for the ops install is that, while boss-install updates
   most of the ops binaries/libraries via NFS, there are some that it
   doesn't. So by doing a separate build/install on ops, you are
   guaranteed to catch everything.

      # on boss -- do this after ops
      gmake
      sudo /usr/local/etc/rc.d/2.mysql-server.sh start

      # XXX hack, need to install these by hand first because of DB change
      sudo install -c -m 755 tbsetup/libtbsetup.pm /usr/testbed/lib/
      sudo install -c -m 755 db/emdbi.pm /usr/testbed/lib/

      sudo gmake boss-install

   If the boss install tells you that there are updates to install,
   run the command like it says:

      sudo gmake update-testbed
      
   This will actually turn the testbed back on at the end so you will
   not have to do #3 below. Note also that this command may take awhile
   and provide no feedback.

      # boss random: this file may be leftover from an elabinelab origin;
      # it should not be here (it SHOULD exist on ops)
      # BUT ONLY DO THIS IF IT IS NOT AN ELABINELAB
      sudo rm /usr/local/etc/rc.d/ctrlnode.sh

4. Switch to autofs (on boss, if needed):

      # make sure /etc/auto_master is right
      # make /etc/auto_{users,project,groups} symlinks
      # rerun exports setup
      # make sure enable lines are in /etc/rc.conf
      /etc/rc.d/{automountd,autounmountd,automount} start
      # undo local homedir hack

5. Re-enable the testbed on boss.

   sudo /usr/local/etc/rc.d/apache24 start
   sudo /usr/local/etc/rc.d/tftpd-hpa.sh start
   sudo /usr/local/etc/rc.d/2.dhcpd.sh start
   sudo /usr/testbed/sbin/testbed-control boot
   # NOTE capture may not be installed
   sudo /usr/local/etc/rc.d/capture.sh start

6. Re-run the freebsd-update again to remove old shared libraries.

   Now that everything has been rebuilt:

   sudo freebsd-update install

7. Reboot boss and ops again!

   NOTE: if you reboot ops after boss, you may need to restart all the
   event schedulers from boss:

   sudo /usr/testbed/sbin/eventsys_start

8. (CloudLab clusters only) Reenable the cluster at the portal.

     # On mothership boss
     wap manage_aggregate <clustername> chflag disabled no

   Cluster name comes from running "wap manage_aggregate list" on
   the Mothership boss. Use the "Nickname".

9. Things to watch out for

   * The new version of OpenSSH will no longer accept older Ciphers and
     Key exchange formats by default. If you have older switches/PDUs or
     other devices that need those, then you will need to change root's
     .ssh/config to have something like:

        Host OldNode
	Ciphers +3des-cbc
	KexAlgorithms diffie-hellman-group1-sha1
