Upgrading Emulab servers from FreeBSD 11.3 to 12.3.

These are fairly specific, but not always exact instructions for the process.
They are also oriented toward the CloudLab family of clusters, hence the
references to mothership, Clemson, Wisconsin, Apt, etc.

The most significant changes are:
 * python2.7 has been replaced by python 3.8
 * swig3 has been replaced by swig4

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

   # wisconsin
   sudo lvcreate -s -L 40g -n boss.backup xen-vg/boss
   sudo lvcreate -s -L 40g -n ops.backup xen-vg/ops

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

2. Fetch the new release with freebsd-update.

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

     sudo freebsd-update -r 12.3-RELEASE upgrade

   Since this will ask you to merge a bunch of local changes into various
   files and will want to fire up an editor, you might want to make sure
   you get a *real* editor by doing:

     sudo -E EDITOR=emacs freebsd-update -r 12.3-RELEASE upgrade

   instead. Otherwise you will probably wind up with vi. If you forget,
   you can always temporarily (or permanently!) replace /usr/bin/vi with
   /usr/local/bin/emacs when it first prompts you to manually handle
   a merge.

   It will crunch for a long time and then probably want you to merge
   some conflicts. Many will just be the FreeBSD header, but some other
   possible diffs:

     /etc/hosts.allow. We customized this to block rpcbind, tftpd, and
     bootinfo access from outside the local network.

     /etc/ntp.conf. We may have replaced the version string with our own
     header. For the merge you should leave both. We leave out all the
     default restrict/server/etc. lines in favor of our own. Do leave in
     the "leapfile" info.

     /etc/syslog.conf. They finally got rid of "ppp" and its exclusion
     may cause some diffs. Take that out of our version and leave in all
     the "Added by Emulab" changes. All of our stuff should be before the
     "!*" and includes of directories.

     /etc/inetd.conf (ops). We have a "flashpolicy" line at the end that
     conflicts with their "prom-sysctl" somehow. Just remove our line and
     leave theirs.

     /etc/ssh/ssh_config (ops). We have a couple of "Host *" options.
     Keep those and use the new version string.

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

3. (Optional) Upgrade your custom kernel.

   If you have a custom kernel config, then you should build and install
   a new kernel first. As mentioned in the last step, this will take a long
   time because you must build (but not install) the entire world before
   building the kernel. You can again do this on boss and ops simultaneously.

   Clone the FreeBSD 12.3 source repo:

   cd /usr
   sudo mv src Osrc
   sudo svn checkout -q svn://svn0.us-west.freebsd.org/base/releng/12.3 src
   <copy over your custom config file from Osrc/sys/amd64/conf/CUSTOM>

   cd src
   sudo make -j 8 buildworld
   sudo make -j 8 buildkernel KERNCONF=CUSTOM

4. Stash away the current set of packages you have installed.

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
   packages are and just install those.

   pkg query -x "%n %v usedby=%#r" `cat boss.pkg.local` | \
       grep 'usedby=0' | awk '{ print $1; }' > boss.pkg.reinstall

   Now login to ops and do the same thing:

   cd ~/upgrade
   pkg query "%n-%v %R" > ops.pkg.list
   grep -v 'Emulab$' ops.pkg.list | awk '{ print $1; }' > ops.pkg.local
   pkg query -x "%n %v usedby=%#r" `cat ops.pkg.local` | \
       grep 'usedby=0' | awk '{ print $1; }' > ops.pkg.reinstall

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

     # The following may or may not be installed
     sudo /usr/local/etc/rc.d/capture stop
     sudo /usr/local/etc/rc.d/telegraf stop

   ops:
     sudo /usr/local/etc/rc.d/1.mysql-server.sh stop
     sudo /usr/local/etc/rc.d/apache24 stop
     sudo /usr/local/etc/rc.d/webssh.sh stop

     # The following may or may not be installed
     sudo /usr/local/etc/rc.d/capture stop
     sudo /usr/local/etc/rc.d/telegraf stop   

   On the Utah clusters you may need to also need to stop some additional
   services:

     sudo /usr/local/etc/rc.d/bareos-fd stop

Other newer stuff:

 * on ops, kill wssh
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

  After a while it will want you to reboot the new kernel. Before you reboot,
  if you built a custom kernel back in step A3, install it now:

   cd /usr/src
   sudo make installkernel KERNCONF=CUSTOM

   When I did the custom kernel install, I saw errors of the form:

      kldxref /boot/kernel
      kldxref: unknown metadata record 4 in file atacard.ko
      kldxref: unknown metadata record 4 in file atp.ko
      ...

   They did not seem to affect the following boot.

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

   When it comes back up, you should login and shutdown services that
   restarted, including some that won't work right.

   boss:
     sudo /usr/testbed/sbin/testbed-control shutdown
     sudo /usr/local/etc/rc.d/apache24 stop
     sudo /usr/local/etc/rc.d/2.dhcpd.sh stop
     sudo /usr/local/etc/rc.d/2.mysql-server.sh stop

     # The following may or may not be installed
     sudo /usr/local/etc/rc.d/capture stop
     sudo /usr/local/etc/rc.d/telegraf stop

   ops:
     sudo /usr/local/etc/rc.d/apache24 stop
     sudo /usr/local/etc/rc.d/webssh.sh stop

     # The following may or may not be installed
     sudo /usr/local/etc/rc.d/capture stop
     sudo /usr/local/etc/rc.d/telegraf stop

   Utah:
     sudo /usr/local/etc/rc.d/bareos-fd stop

   
   and then again run freebsd-update to finish:

    sudo /usr/sbin/freebsd-update install

   NOTE that it will tell you to rebuild all third-party packages and
   run freebsd-update again. We do this later below, so don't worry.

   WORKAROUND: if you want to ensure that no new users/groups have been
   added to the system since you did the "freebsd-update fetch", then
   you can compare the files you stashed off in /Oetc to the ones that
   have now been updated in /etc:

     sudo diff /Oetc/passwd /etc/passwd
     sudo diff /Oetc/group /etc/group

   If there are differences, other than new FreeBSD users (ntpd, tests),
   you will need to manually merge the new accounts from /Oetc to /etc.

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

   RANDOM: to avoid complaints from syslog about "unknown priority name"
   you need to create a missing directory:

     sudo mkdir -p /usr/local/etc/syslog.d

5. (Utah only) Apply Emulab patches to select system utilities.

   We have patched a couple of system utilities to better handle the
   large number of users, groups and filesystem mounts that the Emulab
   Mothership and assorted CloudLab clusters sport. Other sites really
   don't need to (and probably should not) do this.

   Make sure you have the appropriate FreeBSD source tree installed.

   Make sure you have the Emulab source tree checked out:

     cd ~
     git checkout https://gitlab.flux.utah.edu/emulab/emulab-devel.git testbed

   Since you probably don't have any of the FreeBSD "tests" infrastructure
   installed, you need to prevent it from attempting to install stuff there.
   Edit /etc/src.conf and add the line:

     WITHOUT_TESTS=yes

   Now patch, build, and install the Emulab versions:

     # on boss you just need the "pw" patch
     cd /usr/src/usr.sbin/pw
     sudo patch -p1 < ~/testbed/patches/FreeBSD-12.3-pw-2.patch
     sudo make obj
     sudo make all install clean

     # on ops you should install all patches
     cd /usr/src/usr.sbin/pw
     sudo patch -p1 < ~/testbed/patches/FreeBSD-12.3-pw-2.patch
     sudo make obj
     sudo make all install clean
     # mountd has been fixed, but we still have stats gathering and optims.
     cd /usr/src/usr.sbin/mountd
     sudo patch -p1 < ~/testbed/patches/FreeBSD-12.3-mountd.patch
     sudo make obj
     sudo make all install clean
     cd /usr/src/sbin/mount
     sudo patch -p1 < ~/testbed/patches/FreeBSD-12.3-mount.patch
     sudo make obj
     sudo make all install clean

6. How did that work out for ya?

   If all went well, skip to C (Updating ports/packages).

   If that didn't work, contact testbed-ops.

C. Updating ports/packages

   Updating the core ports from 11.3 to 12.3 is pretty easy if you were
   running the most recent set of 11.3 packages. Note that if you installed
   extra ports, upgrading will require a bit more work.

   You also need to ensure that Apache is not running (see A3 above)
   as PHP will be getting upgraded.

0. If you forgot to save off your package info back in A4, or it has been
   awhile, then you might want to go back and do that now.

   You may also want to back up config files for third-party packages:

      sudo rm -rf /usr/local/Oetc
      sudo cp -rp /usr/local/etc /usr/local/Oetc

1. Modify your /etc/pkg/Emulab.conf file, replacing "11.3" with "12.3" in
   the "url" line:

      sudo sed -i .bak -e 's;/11.3/;/12.3/;' /etc/pkg/Emulab.conf

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

      sudo ln -sfn /usr/local/bin/perl /usr/bin/perl
      sudo ln -sfn /usr/local/bin/python3.8 /usr/local/bin/python
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
     sudo pkg add -M /tmp/emulab-ipmitool-old-1.8.15_1.txz

     # change the dependency
     sudo pkg set -n ipmitool:emulab-ipmitool-old

   But ONLY do this if you have Moonshot chassis.

3b. Additional package cleanup.

   IMPORTANT: we run apache as 'nobody' but the FreeBSD default is 'www'.
   One place this makes a difference is on boss for the fcgid module where
   a directory is installed as accessable by only 'www'. You will need to
   fix this:

     # boss only
     sudo chown nobody:nobody /var/run/fcgidsock
     sudo chmod 770 /var/run/fcgidsock

   To be extra tidy, get rid of any abandoned ports on boss and ops.
   Look carefully at what the following wants to do (it will prompt you).
   If there is any doubt, just say no:

     sudo pkg autoremove
   
   To make sure your packages are in a consistent state you should check
   everything:

     sudo pkg check -adBs
   
   If you discover in "check" that "autoremove" took out a library
   (e.g. libsodium) required by a package (e.g., vim), then you can just
   forcibly reinstall the package ala:

     sudo pkg install -f -r Emulab vim

   and then rerun the check.

4. Changes from python2.7 to python 3.8?

   For Cloudlab clusters, the `wssh` install has to be updated by hand for python3
   since it does not come from a package. See install/phases/webssh for details, but
   I think this will do it:

    # on boss
    # nothing to do
    
    # on ops
    cd /tmp
    git clone https://gitlab.flux.utah.edu/emulab/webssh.git
    cd webssh
    sudo python setup.py install

5. Updates to mysql server (boss only).

   You should run mysql_upgrade to pick up any basic schema changes:

     # restart mysqld
     sudo /usr/local/etc/rc.d/2.mysql-server.sh start
     sudo /usr/local/bin/mysql_upgrade
     # stop it again
     sudo /usr/local/etc/rc.d/2.mysql-server.sh stop

6. Reinstall local ports.

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

   IMPORTANT NOTE: at Utah, we have bareos installed and the upgrade seems
   to remove the old bareos16-client so the command above will not pick up
   that bareos-client needs to be updated. So you will need to manually:

     sudo pkg install -r Emulab bareos18-client

   This is a point at which you might want to check for security problems:

     sudo pkg audit -F

   It is possible that some packages will have vulnerabilities, so unless
   it sounds really serious, just live with it.

7. Update your /etc/make.conf file in the event that you need to build a
   port from source in the future. Make sure your DEFAULT_VERSION line(s)
   look like:

DEFAULT_VERSIONS=perl5=5.32 python3=3.8 php=7.4 mysql=5.7 apache=2.4 tcltk=8.6
DEFAULT_VERSIONS+=ssl=base

D. Repeat steps B and C for ops.

E. Update Emulab software

1. Make sure your Emulab sources are up to date.

   You must use the emulab-devel repository at this point as only it has
   the necessary changes to support FreeBSD 12.3. If you don't already
   have an emulab-devel repo, clone it with:

   git clone https://gitlab.flux.utah.edu/emulab/emulab-devel.git

   Make sure to copy over your existing defs-* file to the new source
   tree.

2. Reconfigure, rebuild, and reinstall the software.

   You want everything to be built against the new ports and libraries
   anyway though, so just rebuild and install everything.

   Check the defs-* file you use and make sure that INCREMENTAL_MOUNTD=0
   (or remove the line entirely). The standard mountd now supports incremental
   updates by default.

   In your build tree, look at config.log to see how it was configured
   and then:

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

3. Re-enable the testbed on boss.

   # NOTE capture may not be installed
   sudo /usr/local/etc/rc.d/capture start
   sudo /usr/local/etc/rc.d/apache24 start
   sudo /usr/local/etc/rc.d/2.dhcpd.sh start
   sudo /usr/testbed/sbin/testbed-control boot

4. Re-run the freebsd-update again to remove old shared libraries.

   Now that everything has been rebuilt:

   sudo freebsd-update install

5. Reboot boss and ops again!

   NOTE: if you reboot ops after boss, you may need to restart all the
   event schedulers from boss:

   sudo /usr/testbed/sbin/eventsys_start

6. (CloudLab clusters only) Reenable the cluster at the portal.

     # On mothership boss
     wap manage_aggregate <clustername> chflag disabled no

   Cluster name comes from running "wap manage_aggregate list" on
   the Mothership boss. Use the "Nickname".
