#
# First grab some default variable presets.
#
include Makefile.defaults

#
# For each pkg, we have several variables that can be defined.
#
# List of sources for this package that we have to fetch before build (don't
# include sources in CVS!).
#   SOURCES-$(pkg) = 
# Self-explanatory...
#   RPMBUILDFLAGS-$(pkg) = 
# RPM install options for one of our packages that is a local dependency (see
# below).
#   INSTALLOPTS-$(pkg) = 
# RPM install files for one of our packages that is a locally-built dependency
# (see below).  The "macros" %{VERSION}, ARCH will expand; we get VERSION from
# spectool by asking for the version and release; ARCH is set to i686 if 
# platform is x86, or if the RPMBUILDFLAGS-$(pkg) contains the substring
# "noarch", noarch, or else uname -m.  Finally, we'll add a prefix
# ($(MYBUILDROOT)/RPMS/ARCH
#   INSTALLFILES-$(pkg) = %{NAME}-%{VERSION}
# These are the distro packages we need to install to build $(pkg).
#   BUILDDEPS-$(pkg) = 
# These are the packages we must build and install BEFORE building $(pkg).
#   LOCALBUILDDEPS-$(pkg) = 
#

#PKGS = otcl mailman
PKGS = emulab-boss emulab-ops emulab-fs emulab-compat emulab-supplemental-mibs \
	otcl ulsshxmlrpcpp pubsub vcg perl-Apache-Htpasswd metis mrouted \
	cvsd flyspray mailman mu-conference twiki

SOURCEBASEURL = http://repoman.emulab.net/build/SOURCES

RPMBUILDFLAGS-emulab-boss = -bb --target noarch
SOURCES-emulab-boss = $(call find-spec-sources,emulab-boss)
BUILDDEPS-emulab-boss = $(call find-spec-builddeps,emulab-boss)
LOCALBUILDDEPS-emulab-boss = 
INSTALLOPTS-emulab-boss = 

RPMBUILDFLAGS-emulab-ops = -bb --target noarch
SOURCES-emulab-ops = $(call find-spec-sources,emulab-ops)
BUILDDEPS-emulab-ops = $(call find-spec-builddeps,emulab-ops)
LOCALBUILDDEPS-emulab-ops = 
INSTALLOPTS-emulab-ops = 

RPMBUILDFLAGS-emulab-fs = -bb --target noarch
SOURCES-emulab-fs = $(call find-spec-sources,emulab-fs)
BUILDDEPS-emulab-fs =$(call find-spec-builddeps,emulab-fs)
LOCALBUILDDEPS-emulab-fs = 
INSTALLOPTS-emulab-fs = 

RPMBUILDFLAGS-emulab-compat = -bb --target noarch
SOURCES-emulab-compat = $(call find-spec-sources,emulab-compat)
BUILDDEPS-emulab-compat = $(call find-spec-builddeps,emulab-compat)
LOCALBUILDDEPS-emulab-compat = 
INSTALLOPTS-emulab-compat = 

RPMBUILDFLAGS-emulab-supplemental-mibs = -bb --target noarch
SOURCES-emulab-supplemental-mibs = $(call find-spec-sources,emulab-supplemental-mibs)
BUILDDEPS-emulab-supplemental-mibs = $(call find-spec-builddeps,emulab-supplemental-mibs)
LOCALBUILDDEPS-emulab-supplemental-mibs = 
INSTALLOPTS-emulab-supplemental-mibs = 

RPMBUILDFLAGS-otcl = 
SOURCES-otcl = $(call find-spec-sources,otcl)
CVSSOURCES-otcl = otcl-hashentry-delete.patch otcl-ld-whoopsie.patch \
	otcl-varTable-hash-stuff.patch otcl-x11-headers.patch
BUILDDEPS-otcl = $(call find-spec-builddeps,otcl)
LOCALBUILDDEPS-otcl = 
INSTALLOPTS-otcl = 
SOURCEFETCHMETHOD-otcl = rsync
SOURCEBASEURL-otcl = ops.emulab.net:/share/fedora/emulab-repo/build/SOURCES

RPMBUILDFLAGS-ulsshxmlrpcpp = 
SOURCES-ulsshxmlrpcpp = $(call find-spec-sources,ulsshxmlrpcpp)
CVSSOURCES-ulsshxmlrpcpp = ulsshxmlrpcpp-0.1.2-include-stuff.patch \
	ulsshxmlrpcpp-0.1.2-64bit-lint.patch
BUILDDEPS-ulsshxmlrpcpp = $(call find-spec-builddeps,ulsshxmlrpcpp)
LOCALBUILDDEPS-ulsshxmlrpcpp = 
INSTALLOPTS-ulsshxmlrpcpp = 

RPMBUILDFLAGS-pubsub = 
SOURCES-pubsub = $(call find-spec-sources,pubsub)
BUILDDEPS-pubsub = $(call find-spec-builddeps,pubsub)
LOCALBUILDDEPS-pubsub = 
INSTALLOPTS-pubsub = 

RPMBUILDFLAGS-vcg = 
SOURCES-vcg = $(call find-spec-sources,vcg)
CVSSOURCES-vcg = vcg-imake-stupidity.patch
BUILDDEPS-vcg = $(call find-spec-builddeps,vcg)
LOCALBUILDDEPS-vcg = 
INSTALLOPTS-vcg = 

RPMBUILDFLAGS-perl-Apache-Htpasswd = 
SOURCES-perl-Apache-Htpasswd = $(call find-spec-sources,perl-Apache-Htpasswd)
BUILDDEPS-perl-Apache-Htpasswd = $(call find-spec-builddeps,perl-Apache-Htpasswd)
LOCALBUILDDEPS-perl-Apache-Htpasswd = 
INSTALLOPTS-perl-Apache-Htpasswd = 

RPMBUILDFLAGS-metis = 
SOURCES-metis = $(call find-spec-sources,metis)
CVSSOURCES-metis = metis-4.0-libc-math.patch
BUILDDEPS-metis = $(call find-spec-builddeps,metis)
LOCALBUILDDEPS-metis = 
INSTALLOPTS-metis = 

RPMBUILDFLAGS-mrouted = 
SOURCES-mrouted = $(call find-spec-sources,mrouted)
CVSSOURCES-mrouted = mrouted-3.9-beta3-1.1.diff \
	mrouted-3.9-beta3-1.1-linuxheaders.diff \
	mrouted-3.9-beta3-1.1-fedora-initscript.diff
BUILDDEPS-mrouted = $(call find-spec-builddeps,mrouted)
LOCALBUILDDEPS-mrouted = 
INSTALLOPTS-mrouted = 

RPMBUILDFLAGS-cvsd = 
SOURCES-cvsd = $(call find-spec-sources,cvsd)
CVSSOURCES-cvsd = cvsd-fedora-initscript.patch
BUILDDEPS-cvsd = $(call find-spec-builddeps,cvsd)
LOCALBUILDDEPS-cvsd = 
INSTALLOPTS-cvsd = 

RPMBUILDFLAGS-flyspray = 
SOURCES-flyspray = $(call find-spec-sources,flyspray)
CVSSOURCES-flyspray = flyspray-includes.patch flyspray-notify.patch \
	flyspray-perf.patch flyspray-scripts.patch flyspray-theme.patch \
	flyspray-xmlrpc.patch
BUILDDEPS-flyspray = $(call find-spec-builddeps,flyspray)
LOCALBUILDDEPS-flyspray = 
INSTALLOPTS-flyspray = 

RPMBUILDFLAGS-mailman = 
SOURCES-mailman = $(call find-spec-sources,mailman)
CVSSOURCES-mailman = mailman-emulab-no-change-addr.patch \
	mailman-emulab-unquote-plus.patch
BUILDDEPS-mailman = $(call find-spec-builddeps,mailman)
LOCALBUILDDEPS-mailman = 
INSTALLOPTS-mailman = 

RPMBUILDFLAGS-mu-conference = 
SOURCES-mu-conference = $(call find-spec-sources,mu-conference)
BUILDDEPS-mu-conference = $(call find-spec-builddeps,mu-conference)
LOCALBUILDDEPS-mu-conference = 
INSTALLOPTS-mu-conference = 

RPMBUILDFLAGS-twiki = 
SOURCES-twiki = $(call find-spec-sources,twiki)
BUILDDEPS-twiki = $(call find-spec-builddeps,twiki)
LOCALBUILDDEPS-twiki = 
INSTALLOPTS-twiki = 


#pkg = 
#RPMBUILDFLAGS- = 
#SOURCES- = $(call find-spec-sources,)
#BUILDDEPS- =
#LOCALBUILDDEPS- = 
#INSTALLOPTS- = 

ifeq ($(DISTRO),fedora10)
	PKGS += tcl tk

	RPMBUILDFLAGS-tcl = 
	SOURCES-tcl = $(call find-spec-sources,tcl)
	BUILDDEPS-tcl = $(call find-spec-builddeps,tcl)
	LOCALBUILDDEPS-tcl = 
	INSTALLOPTS-tcl = 
	SOURCEFETCHMETHOD-tcl = rsync
	SOURCEBASEURL-tcl = ops.emulab.net:/share/fedora/emulab-repo/build/fedora10/SOURCES

	RPMBUILDFLAGS-tk = 
	SOURCES-tk = $(call find-spec-sources,tk)
	BUILDDEPS-tk = $(call find-spec-builddeps,tk)
	LOCALBUILDDEPS-tk = 
	INSTALLOPTS-tk = 
	SOURCEFETCHMETHOD-tcl = rsync
	SOURCEBASEURL-tcl = ops.emulab.net:/share/fedora/emulab-repo/build/fedora10/SOURCES
endif
ifeq ($(DISTRO),fedora11)
	PKGS += tcl tk
endif

include Makefile.rules
