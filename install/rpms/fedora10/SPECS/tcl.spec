%define majorver 8.4

Summary: Tcl scripting language development environment
Name: tcl
Version: %{majorver}.17
Release: 1%{?dist}
Epoch: 1 
License: TCL
Group: Development/Languages
URL: http://tcl.sourceforge.net/
Source0: http://puzzle.dl.sourceforge.net/sourceforge/tcl/tcl%{version}-src.tar.gz
Source1: http://superb-east.dl.sourceforge.net/sourceforge/tcl/tcl%{version}-html.tar.gz
BuildRoot: %{_tmppath}/%{name}-%{version}-%{release}-root-%(%{__id_u} -n)
Buildrequires: autoconf
Provides: tcl(abi) = %{majorver}
#Provides: libtcl%{majorver}.so
Patch1: tcl-confi.patch
Patch2: tcl-8.4.7-path.patch

%description
The Tcl (Tool Command Language) provides a powerful platform for
creating integration applications that tie together diverse
applications, protocols, devices, and frameworks. When paired with the
Tk toolkit, Tcl provides a fastest and powerful way to create
cross-platform GUI applications.  Tcl can also be used for a variety
of web-related tasks and for creating powerful command languages for
applications.

%package devel
Summary: Tcl scripting language development environment
Group: Development/Languages
Requires: %{name} = %{epoch}:%{version}-%{release}

%description devel
The Tcl (Tool Command Language) provides a powerful platform for
creating integration applications that tie together diverse
applications, protocols, devices, and frameworks. When paired with the
Tk toolkit, Tcl provides a fastest and powerful way to create
cross-platform GUI applications.  Tcl can also be used for a variety
of web-related tasks and for creating powerful command languages for
applications.

The package contains the development files and man pages for tcl.

%package html
Summary: Tcl/Tk manual in html format
Group: Development/Libraries
URL: http://superb-east.dl.sourceforge.net/sourceforge/tcl/tcl%{version}-html.tar.gz

%description html
Tcl/Tk is a powerful scripting language and GUI toolkit.

This package contains the html manual.

%prep
%setup -T -D -c %{name}-%{version} -q -a 0 -a 1
cd %{name}%{version}
chmod -x generic/tclThreadAlloc.c

%patch1 -p1 -b .confi
%patch2 -p1 -b .path

%build
cd %{name}%{version}/unix
autoconf
%configure --enable-threads
make %{?_smp_mflags} TCL_LIBRARY=%{_datadir}/%{name}%{majorver}

%check
# don't run "make test" by default
%{?_without_check: %define _without_check 0}
%{!?_without_check: %define _without_check 1}

%if ! %{_without_check}
  make test
%endif

%pre
# fix rpm can't replace dir with symlink
if [ -d /usr/lib/tcl8.4 ]; then
	rm -rf /usr/lib/tcl8.4;
fi

%install
rm -rf $RPM_BUILD_ROOT
cd %{name}%{version}
make install -C unix INSTALL_ROOT=$RPM_BUILD_ROOT TCL_LIBRARY=%{_datadir}/%{name}%{majorver}

ln -s tclsh%{majorver} $RPM_BUILD_ROOT%{_bindir}/tclsh

# for linking with -lib%{name}
ln -s lib%{name}%{majorver}.so $RPM_BUILD_ROOT%{_libdir}/lib%{name}.so

mkdir -p $RPM_BUILD_ROOT/%{_libdir}/
ln -s %{_datadir}/%{name}%{majorver} $RPM_BUILD_ROOT/%{_libdir}/%{name}%{majorver}

#mkdir -p %{buildroot}%{_prefix}/lib
#ln -s %{_datadir}/%{name}%{majorver} %{buildroot}%{_prefix}/lib/%{name}%{majorver}

mkdir -p $RPM_BUILD_ROOT/%{_includedir}/%{name}-private/{generic,unix}
find generic unix -name "*.h" -exec cp -p '{}' $RPM_BUILD_ROOT/%{_includedir}/%{name}-private/'{}' ';'
( cd $RPM_BUILD_ROOT/%{_includedir}
	for i in *.h ; do
		[ -f $RPM_BUILD_ROOT/%{_includedir}/%{name}-private/generic/$i ] && ln -sf ../../$i $RPM_BUILD_ROOT/%{_includedir}/%{name}-private/generic ;
	done
)

# remove buildroot traces
sed -i -e "s|$PWD/unix|%{_libdir}|; s|$PWD|%{_includedir}/%{name}-private|" $RPM_BUILD_ROOT/%{_libdir}/%{name}Config.sh
rm -rf $RPM_BUILD_ROOT/%{_datadir}/%{name}%{majorver}/tclAppInit.c
rm -rf $RPM_BUILD_ROOT/%{_datadir}/%{name}%{majorver}/ldAix

%clean
rm -rf $RPM_BUILD_ROOT

%post -p /sbin/ldconfig

%postun -p /sbin/ldconfig

%files
%defattr(-,root,root,-)
%{_bindir}/tclsh*
%{_datadir}/%{name}%{majorver}
%{_libdir}/lib%{name}%{majorver}.so
%{_mandir}/man1/*
%{_mandir}/man3/*
%{_mandir}/mann/*
%{_libdir}/%{name}%{majorver}
%doc %{name}%{version}/README %{name}%{version}/changes 
%doc %{name}%{version}/license.terms

%files devel
%defattr(-,root,root,-)
%{_includedir}/*
%{_libdir}/lib%{name}stub%{majorver}.a
%{_libdir}/lib%{name}.so
%{_libdir}/%{name}Config.sh
#%doc is in html

%files html
%defattr(-,root,root,-)
%doc %{name}%{version}/html/*

%changelog
* Wed Jan 23 2008 Marcela Maslanova <mmaslano@redhat.com> - 1:8.4.17-1
- update 8.4.17

* Wed Sep 26 2007 Marcela Maslanova <mmaslano@redhat.com> - 1:8.4.15-5
- fix of patch - set auto_path was broken
- Resolves: rhbz#306321

* Fri Aug 24 2007 Marcela Maslanova <mmaslano@redhat.com> - 1:8.4.15-4
- rebuild for mass rebuild
- check license & path for 32b/64b fix

* Thu Aug  9 2007 Marcela Maslanova <mmaslano@redhat.com> - 1:8.4.15-3
- Resolves: rhbz#251410

* Mon Aug 6 2007 Michael Thomas <wart@kobold.org> - 1:8.4.15-2
- Explicitly add %%{_datadir}/tcl8.4 and %%{_libdir}/tcl8.4 to the
  auto_path.

* Tue May 22 2007 Marcela Maslanova <mmaslano@redhat.com> - 1:8.4.15-1
- Update Tcl-8.4.15

* Tue May 22 2007 Marcela Maslanova <mmaslano@redhat.com> - 1:8.4.13-18
- rhbz#235812

* Tue Apr  3 2007 Marcela Maslanova <mmaslano@redhat.com> - 1:8.4.13-16
- rhbz#227725

* Tue Apr  3 2007 Marcela Maslanova <mmaslano@redhat.com> - 1:8.4.13-15
- cleaning spec

* Tue Mar 21 2007 Marcela Maslanova <mmaslano@redhat.com> - 1:8.4.13-14
- multilib problem, rhbz#227200

* Tue Feb 27 2007 Marcela Maslanova <mmaslano@redhat.com> - 1:8.4.13-12
- review

* Thu Feb 21 2007 Marcela Maslanova <mmaslano@redhat.com> - 1:8.4.13-11
- review

* Thu Feb 15 2007 Marcela Maslanova <mmaslano@redhat.com> - 1:8.4.13-10
- review

* Tue Feb 13 2007 Marcela Maslanova <mmaslano@redhat.com> - 1:8.4.13-9
- review again

* Fri Feb 09 2007 David Cantrell <dcantrell@redhat.com> - 1:8.4.13-8
- rebuild

* Thu Feb  8 2007 Marcela Maslanova <mmaslano@redhat.com> - 1:8.4.13-7
- downgrade back to 8.4.13
- rhbz #226479 review

* Mon Feb  5 2007 Marcela Maslanova <mmaslano@redhat.com> - 8.5a5-8
- rhbz#227173

* Sun Feb  4 2007 Jakub Jelinek <jakub@redhat.com> - 8.5a5-7
- fix broken stack checking code (#226785)

* Thu Jan 25 2007 Marcela Maslanova <mmaslano@redhat.com> - 8.5a5-6
- rebuilt for obsoletes rhbz#217735

* Thu Jan 25 2007 Marcela Maslanova <mmaslano@redhat.com> - 8.5a5-5
- rebuilt

* Mon Dec 18 2006 Marcela Maslanova <mmaslano@redhat.com> - 8.5a5-4
- change in spec for compatibility with tk, version 8.5a5
- Resolves: rhbz#160441

* Thu Jul 20 2006 David Cantrell <dcantrell@redhat.com> - 8.4.13-3
- Fix cflags patch so it applies correctly
- Changes $(CFLAGS) to ${CFLAGS} in cflags patch

* Thu Jul 20 2006 David Cantrell <dcantrell@redhat.com> - 8.4.13-2
- Patch from Dennis Gilmore <dennis@ausil.us> for sparc64 (#199375)

* Wed Jul 12 2006 Jesse Keating <jkeating@redhat.com> - 8.4.13-1.2
- rebuild

* Wed Apr 19 2006 David Cantrell <dcantrell@redhat.com> - 8.4.13-1
- Upgraded to Tcl 8.4.13

* Fri Feb 17 2006 David Cantrell <dcantrell@redhat.com> - 8.4.12-4
- Enable threads (#181871)

* Fri Feb 10 2006 Jesse Keating <jkeating@redhat.com> - 8.4.12-3.2
- bump again for double-long bug on ppc(64)

* Tue Feb 07 2006 Jesse Keating <jkeating@redhat.com> - 8.4.12-3.1
- rebuilt for new gcc4.1 snapshot and glibc changes

* Thu Feb 02 2006 David Cantrell <dcantrell@redhat.com> - 8.4.12-3
- Patched syntax errors in configure and tcl.m4 so it works with bash

* Thu Feb 02 2006 David Cantrell <dcantrell@redhat.com> - 8.4.12-2
- Don't use ksh on ia64

* Thu Feb 02 2006 David Cantrell <dcantrell@redhat.com> - 8.4.12-1
- Upgraded to tcl-8.4.12
- Use ksh rather than bash for the configure script (known bug w/ bash-3.1)
- Generate HTML docs from source
- Add in the Tk source for HTML doc generation

* Fri Dec 09 2005 Jesse Keating <jkeating@redhat.com>
- rebuilt

* Fri Jul  1 2005 Jens Petersen <petersen@redhat.com> - 8.4.11-1
- update to latest stable release
  - update tcl-8.4-autoconf.patch
- buildrequire sed and use it instead of perl for editting tclConfig.sh

* Wed Mar  9 2005 Jens Petersen <petersen@redhat.com> - 8.4.9-3
- rebuild with gcc 4

* Tue Dec 14 2004 Jens Petersen <petersen@redhat.com> - 8.4.9-2
- move tclConfig.sh into -devel (Axel Thimm, 142724)

* Thu Dec  9 2004 Jens Petersen <petersen@redhat.com> - 8.4.9-1
- new stable release

* Wed Nov 24 2004 Jens Petersen <petersen@redhat.com> - 8.4.8-1
- update to latest release

* Fri Oct 15 2004 Jens Petersen <petersen@redhat.com> - 8.4.7-2
- improve tcl8.3.5-tclConfig-package-path-90160.patch to look in libdir in
  addition to datadir for packages, so that tclsh can load binary packages
  in lib64 (135310)

* Fri Jul 30 2004 Jens Petersen <petersen@redhat.com> - 8.4.7-1
- update to 8.4.7
  - replace tcl-8.4.5-no_rpath.patch by tcl-8.4-no_rpath.patch
  - replace tcl-8.4.5-autoconf.patch by tcl-8.4-autoconf.patch
- no longer obsolete itcl

* Tue Jun 15 2004 Elliot Lee <sopwith@redhat.com>
- rebuilt

* Thu May 13 2004 Jens Petersen <petersen@redhat.com> - 8.4.6-1
- update to 8.4.6

* Wed Apr 21 2004 Warren Togami <wtogami@redhat.com> - 8.4.5-7
- obsolete former itcl package (#121414)

* Wed Mar 10 2004 Jens Petersen <petersen@redhat.com> - 8.4.5-6
- apply tcl-8.4.5-autoconf.patch to build with autoconf 2.5x
  (Robert Scheck, #116773)
- use %%{name} more extensively for script portability
- run "make test" by default when building (can be disabled with
  "--without check")
- add a backwards compatible symlink {_prefix}/lib/tk8.4 ->
  {_datadir}/tk8.4 (Michal Jaegermann, part of #90160)
- use "mkdir -p" instead of "mkdirhier" (Robert Scheck, #116771)
- include some doc files

* Tue Mar 02 2004 Elliot Lee <sopwith@redhat.com> - 8.4.5-5.1
- rebuilt

* Fri Feb 13 2004 Elliot Lee <sopwith@redhat.com> - 8.4.5-5
- rebuilt

* Mon Feb  2 2004 Jens Petersen <petersen@redhat.com> - 8.4.5-4
- include all private .h files under {_includedir}/tcl-private

* Mon Dec  1 2003 Thomas Woerner <twoerner@redhat.com> 8.4.5-3
- removed rpath (patch 4)

* Fri Nov 28 2003 Jens Petersen <petersen@redhat.com> - 8.4.5-2
- put private header files under generic and unix subdirs
- include real generic/tclPort.h not just a symlink to tclUnixPort.h
- add tclMath.h to {_includedir}/tcl-private/generic for building tk
- remove build remnants from tclConfig.sh

* Thu Nov 27 2003 Jens Petersen <petersen@redhat.com> - 8.4.5-1
- new package split out from tcltk
- update to tcl 8.4.5 (#88429)
  - drop tcl-8.3.3-heiierarchy.patch, tcl-8.3.3-dlopen.patch
	 and tcl8.3.5-koi8-u.enc-88806.patch
- include private include headers under {_includedir}/tcl-private
- filtered changelog for tcl
- buildrequire autoconf213 (#110583) [mvd@mylinux.com.ua]

* Wed Sep 17 2003 Matt Wilson <msw@redhat.com> 8.3.5-92
- rebuild again for #91211

* Wed Sep 17 2003 Matt Wilson <msw@redhat.com> 8.3.5-91
- rebuild to fix gzipped file md5sums (#91211)

* Fri Jul 04 2003 Jens Petersen <petersen@redhat.com> - 8.3.5-90
- split out devel files from tcl and tk into -devel subpackages (#90087)
- fix tcl package path in tclConfig.sh to point to datadir (#90160)
  [reported by Michal Jaegermann]
- remove gratuitous whitespace in koi8-u.enc (#88806)
  [reported with fix by Victor Cheburkin]
- update ucs4 patch to also change regcustom.h, but disable it for now (#89098)

* Thu Feb  6 2003 Jens Petersen <petersen@redhat.com> - 8.3.5-88
- use ucs4 wide chars since python now does (tkinter)

* Fri Jan 17 2003 Jens Petersen <petersen@redhat.com> - 8.3.5-85
- add some requires

* Tue Jan 14 2003 Jens Petersen <petersen@redhat.com> - 8.3.5-84
- link all libs with DT_SONAME using tcl.m4 patch (#81297)
- drop synthetic lib provides
- remove obsolete patches from srpm
- update buildrequires
- use buildroot instead of RPM_BUILD_ROOT
- install all man pages under mandir, instead of moving some from /usr/man
- install libtcl and libtk mode 755
- introduce _genfilelist macro for clean single-sweep find filelist generation
  for each package
- use perl to remove buildroot prefix from filelists

* Tue Jan  7 2003 Jeff Johnson <jbj@redhat.com> 8.3.5-80
- rebuild to generate deps for4 DSO's w/o DT_SONAME correctly.

* Sat Jan  4 2003 Jeff Johnson <jbj@redhat.com> 8.3.5-79
- set execute bits on library so that requires are generated.

* Tue Dec 10 2002 Jens Petersen <petersen@redhat.com> 8.3.5-78
- make lib symlinks to .so not .so.0

* Tue Dec 10 2002 Jens Petersen <petersen@redhat.com> 8.3.5-77
- fix summary-not-capitalized for tclx, tcllib, tcl-html

* Mon Dec  9 2002 Jens Petersen <petersen@redhat.com> 8.3.5-76
- make it build on x86_64 (details below)
- don't explicitly update config.{guess,sub} since %%configure does it for us
- added "--without check" rpmbuild option to disable running tests in future
- build and install tcl and tk with script files under datadir (not libdir)
- generate filelists from datadir and not from mandir from now on

* Tue Dec  3 2002 Jens Petersen <petersen@redhat.com>
- update to tcl-8.3.5, tk-8.3.5, tcl-html-8.3.5
- update url for tcl, tk, tclx, itcl, tcllib
- build without all makecfg patches for now
  - in particular use upstream versioned library name convention
- add backward compatible lib symlinks for now
- add unversioned symlinks for versioned bindir files
- use make's -C option rather than jumping in and out of source dirs
  during install
- use INSTALL_ROOT destdir-like make variable instead of makeinstall
  for all subpackages except tix and itcl

* Mon Oct 21 2002 Jens Petersen <petersen@redhat.com>
- update to tcl-8.3.4, tk-8.3.4 (#75600), tcllib-1.3, itcl-3.2.1,
  tix-8.1.3 (#59098)
- drop obsolete tcl cruft, tcl refcount, tix perf patches
- added tcltk html manual
- drop the crud compat dir symlinks in libdir
- package now builds without tcl or tk installed (partly #52606)
  - replace all relative paths by absolutes ones, using new tcltktop
  - give absolute paths to tcl and tk when configuring
  - give buildroot bindir path to tcllib make
  - export buildroot libdir in LD_LIBRARY_PATH when installing
- replace tclvers and tkvers by tcltkvers and use it
- replace tcl_major and tk_major by tcltk_major and use it
- don't explicitly provide 64bit libs on ia64 and sparc64

* Mon Jan 07 2002 Florian La Roche <Florian.LaRoche@redhat.de>
- fix config.guess and config.sub to newer versions

* Mon Aug 29 2001 Adrian Havill <havill@redhat.com>

* Mon Aug  8 2001 Adrian Havill <havill@redhat.com>
- re-enable glibc string and math inlines; recent gcc is a-ok.
- optimize at -O2 instead of -O
- rename "soname" patches related to makefile/autoconf changes
- added elf "needed" for tk, tclx, tix, itk

* Thu Jul 19 2001 Adrian Havill <havill@redhat.com>
- used %%makeinstall to brute force fix any remaining unflexible makefile dirs
- fixed bad ref count release in tcl (bug 49406)
- revert --enable-threads, linux is (still) not ready (yet) (bug 49251)

* Sun Jul  8 2001 Adrian Havill <havill@redhat.com>
- refresh all sources to latest stable (TODO: separate expect/expectk)
- massage out some build stuff to patches (TODO: libtoolize hacked constants)
- remove patches already rolled into the upstream
- removed RPATH (bugs 45569, 46085, 46086), added SONAMEs to ELFs
- changed shared object filenames to something less gross
- reenable threads which seem to work now
- made compile-friendly for IA64

* Sun Jun 24 2001 Elliot Lee <sopwith@redhat.com>
- Bump release + rebuild for 7.2.

* Fri Mar 23 2001 Bill Nottingham <notting@redhat.com>
- bzip2 sources

* Mon Mar 19 2001 Preston Brown <pbrown@redhat.com>
- build fix from ahavill.

* Tue Feb 13 2001 Adrian Havill <havill@redhat.com>
- added "ja_JP.eucJP" to locale list for tcl

* Tue Feb 13 2001 Adrian Havill <havill@redhat.com>
- rebuild so make check passes

* Fri Oct 20 2000 Than Ngo <than@redhat.com>
- rebuild with -O0 on alpha (bug #19461)

* Thu Aug 17 2000 Jeff Johnson <jbj@redhat.com>
- summaries from specspo.

* Thu Aug  3 2000 Jeff Johnson <jbj@redhat.com>
- merge "best known" patches from searching, stubs were broken.

* Thu Jul 27 2000 Jeff Johnson <jbj@redhat.com>
- rebuild against "working" util-linux col.

* Wed Jul 12 2000 Prospector <bugzilla@redhat.com>
- automatic rebuild

* Fri Jun 16 2000 Jeff Johnson <jbj@redhat.com>
- don't mess with %%{_libdir}, it's gonna be a FHS pita.

* Fri Jun  2 2000 Jeff Johnson <jbj@redhat.com>
- FHS packaging changes.
- revert --enable-threads, linux is not ready (yet) (#11789).
- tcl/tk: update to 8.3.1 (#10779).
- abstract major tcltk version for soname expansion etc.

* Sat Mar 18 2000 Jeff Johnson <jbj@redhat.com>
- update to (tcl,tk}-8.2.3, expect-5.31, and itcl-3.1.0, URL's as well.
- use perl to drill out pre-pended RPM_BUILD_ROOT.
- configure with --enable-threads (experimental).
- correct hierarchy spelling (#7082).

* Tue Mar  7 2000 Jeff Johnson <jbj@redhat.com>
- rebuild for sparc baud rates > 38400.

* Mon Feb  7 2000 Bill Nottingham <notting@redhat.com>
- handle compressed manpages

* Thu Feb 03 2000 Elliot Lee <sopwith@redhat.com>
- Make changes from bug number 7602
- Apply patch from bug number 7537
- Apply fix from bug number 7157
- Add fixes from bug #7601 to the runtcl patch

* Wed Feb 02 2000 Cristian Gafton <gafton@redhat.com>
- fix descriptions
- man pages are compressed (whatapain)

* Tue Nov 30 1999 Jakub Jelinek <jakub@redhat.com>
- compile on systems where SIGPWR == SIGLOST.

* Sat May  1 1999 Jeff Johnson <jbj@redhat.com>
- update tcl/tk to 8.0.5.

* Tue Feb 16 1999 Jeff Johnson <jbj@redhat.com>
- upgrade tcl/tk/tclX to 8.0.4

* Tue Jan 12 1999 Cristian Gafton <gafton@redhat.com>
- call libtoolize to allow building on the arm
- build for glibc 2.1
- strip binaries

* Thu Sep 10 1998 Jeff Johnson <jbj@redhat.com>
- update tcl/tk/tclX to 8.0.3, expect is updated also.

* Thu May 07 1998 Prospector System <bugs@redhat.com>
- translations modified for de, fr, tr

* Thu Apr 09 1998 Erik Troan <ewt@redhat.com>
- updated version numbers of tcl/tk to relflect inclusion of p2

* Wed Mar 25 1998 Cristian Gafton <gafton@redhat.com>
- updated tcl/tk to patch level 2

* Wed Oct 22 1997 Otto Hammersmith <otto@redhat.com>
- added patch to remove libieee test in configure.in for tcl and tk.
  Shouldn't be needed anymore for glibc systems, but this isn't the "proper" 
  solution for all systems
- fixed src urls

* Mon Oct 06 1997 Erik Troan <ewt@redhat.com>
- removed version numbers from descriptions

* Mon Sep 22 1997 Erik Troan <ewt@redhat.com>
- updated to tcl/tk 8.0 and related versions of packages

* Tue Jun 17 1997 Erik Troan <ewt@redhat.com>
- built against glibc
