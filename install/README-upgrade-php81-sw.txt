Update Emulab software to the so-called "php81" branch on existing pre-FreeBSD
13.3 system. This branch reflects changes to support not just PHP 8.1, but also
MariaDB and other third-party packages that are current with FreeBSD 13.3.

Note that we do all these updates from the boss node. You should not need to
login to the ops node. This is primarily for the benefit of our Powder fixed
and mobile endpoint aggregates where the "ops node" is just a jail running on
the boss. Where necessary, you will just ssh over to the ops node/jail to
perform things not done by the "boss-install" target on boss.

1. Checkout the source

Right now, since this is all on a branch, you have to clone that branch of
the repo into a new source tree and copy over the defs-* file from the original
soruce tree:

    git clone -b php81 \
        https://gitlab.flux.utah.edu/emulab/emulab-devel.git testbed-new
    cp <current-defs-file> testbed-new/defs-foo
    mkdir -p obj

2. Install a missing package to satisfy a non-backward compatible change:

   On the boss node I had made a non-backward compatible change in the main
   tree, and a boss build now requires that the "cracklib" package be
   installed. So on the boss node first do:

     sudo pkg install -r Emulab cracklib

3. Build and install the new software

   Note that we do this strictly through the boss-install target on boss.
   This is because the ops "node" on our fixed and mobile endpoints is a
   minimal jail, not really capable of an opsfs-install.

     cd obj/boss
     ../../testbed-new/configure --with-TBDEFS=../../testbed-new/defs-foo
      gmake
      sudo gmake boss-install

   If your DB needs updating, then the make will fail and it will tell
   you what do do:

      sudo gmake update-testbed
      
   Note that the "update-testbed" target will actually disable the testbed
   and turn it back on again at the end. Also that this command may take
   awhile and provide no output (the output goes into a file in /var/tmp).

4. Install other non-essential changes

   The new source tree includes a number of changes to components that
   are normally only installed when setting up the testbed. These include
   startup scripts and configuration files. While these changes are *not*
   needed when running the current FreeBSD 11.x or 12.x OSes on the servers,
   they will be needed when the OS is updated to FreeBSD 13. So you can decide
   whether you want to make the changes now, or as part of the OS upgrade.

   To reinstall the startup scripts:

   On boss:

      cd <objdir>/rc.d
      # diff committed versions vs what is installed
      gmake diff

      # install all if diffs seem reasonable, otherwise hand merge
      sudo gmake install
   
   On ops:

      cd <objdir>/rc.d
      # diff committed versions vs what is installed
      gmake control-diff

      # install all if diffs seem reasonable, otherwise hand merge
      sudo gmake control-install
   
   Something else that is not automatically installed every time are Apache
   config files. You will need an updated version of the main `httpd.conf`
   file for later when PHP 8.1 is installed. So diff the version in
   obj/boss/apache24 with the installed version(s) in /usr/local/etc/apache24.
   NOTE CAREFULLY that the main httpd.conf file may be installed as
   httpd-www.conf rather than httpd.conf. So check for the existence of the
   former first:

      cd ~/obj/apache
      # boss config: check for httpd-www.conf:
      diff httpd.conf /usr/local/etc/apache24/httpd-www.conf

      # or, if that does not exist:
      diff httpd.conf /usr/local/etc/apache24/httpd.conf

   Also check the -geni version if it exists:

      diff httpd-geni.conf /usr/local/etc/apache24/httpd-geni.conf

   And the ops version:
   
      # convoluted way to check ops httpd.conf:
      ssh ops diff obj/apache/httpd.conf-ops /usr/local/etc/apache24/httpd.conf

   You may need to do some manual merging of the two versions if local
   changes have been made to the installed version.

   For the current use, it is important to make sure the "SSLProtocols"
   variable is set correctly as in the committed version(s) of the config
   files.

   For future use, when PHP is upgraded to 8.1, you should add the
   `<IfFile "/usr/local/libexec/apache24/libphp.so">` section to your
   existing config (*before* the libphp7.so and libphp5.so sections)
   because the php81 port has renamed the installed PHP module.
