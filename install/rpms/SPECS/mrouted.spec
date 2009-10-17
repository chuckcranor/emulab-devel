%define name mrouted
%define baseversion 3.9
%define extraversion beta3
%define version %{baseversion}.%{extraversion}
%define url ftp://ftp.research.att.com/pub/fenner/mrouted/

%define realversion %{baseversion}-%{extraversion}

%define release_num 1
%define release %{release_num}.emulab%{?date:.%{date}}

%define debug_package %{nil}

Name:		%{name}
Version:	%{version}
Release:	%{release}
Summary:	mrouted is an implementation of the DVMRP multicast routing protocol. It turns a UNIX workstation into a DVMRP multicast router with tunnel support, in order to cross non-multicast-aware routers.

Group:		Networking
License:	Stanford Custom License
URL:		%{url}
Source:	      	%{name}-%{realversion}.tar.gz
BuildRoot:	%{_tmppath}/%{name}-%{realversion}-%{release}-root-%(%{__id_u} -n)

BuildRequires:	make, gcc
Requires:	bash

Provides:	mrouted

patch1:	        mrouted-3.9-beta3-1.1.diff
patch2:		mrouted-3.9-beta3-1.1-linuxheaders.diff
patch3:		mrouted-3.9-beta3-1.1-fedora-initscript.diff

%description
mrouted is an implementation of the DVMRP multicast routing protocol. It turns
a UNIX workstation into a DVMRP multicast router with tunnel support, in order
to cross non-multicast-aware routers.

%prep
%setup -n %{name}-%{realversion}
#pwd
#find .
#cd %{name}-%{version}
%patch1 -p1
%patch2 -p1
%patch3 -p1
#cd ..

%build
make
gzip mrouted.8
gzip mrinfo.8
gzip map-mbone.8


%install
rm -rf $RPM_BUILD_ROOT
mkdir -p  $RPM_BUILD_ROOT
mkdir -p  $RPM_BUILD_ROOT/usr/sbin
mkdir -p  $RPM_BUILD_ROOT/usr/share/man/man8
mkdir -p  $RPM_BUILD_ROOT/usr/share/doc/%{name}-%{realversion}
mkdir -p  $RPM_BUILD_ROOT/etc
mkdir -p  $RPM_BUILD_ROOT/etc/rc.d/init.d

install -m 755 mrinfo $RPM_BUILD_ROOT/usr/sbin/
install -m 755 mrouted $RPM_BUILD_ROOT/usr/sbin/
install -m 755 map-mbone $RPM_BUILD_ROOT/usr/sbin/
install -m 644 mrouted.8.gz $RPM_BUILD_ROOT/usr/share/man/man8/
install -m 644 mrinfo.8.gz $RPM_BUILD_ROOT/usr/share/man/man8/
install -m 644 map-mbone.8.gz $RPM_BUILD_ROOT/usr/share/man/man8/
install -m 644 LICENSE $RPM_BUILD_ROOT/usr/share/doc/%{name}-%{realversion}/
install -m 644 README-%{realversion}.%{name} $RPM_BUILD_ROOT/usr/share/doc/%{name}-%{realversion}/
install -m 644 mrouted.conf $RPM_BUILD_ROOT/etc/
install -m 755 fedora/mrouted.init.d $RPM_BUILD_ROOT/etc/rc.d/init.d/mrouted

%clean
rm -rf $RPM_BUILD_ROOT

%files
%defattr(-,root,root,-)
%doc
/usr/sbin/*
/usr/share/man/man8*
/usr/share/doc/%{name}-%{realversion}/*
/etc/mrouted.conf
/etc/rc.d/init.d/mrouted

%post

%changelog

 * Wed Nov 12 2008 David Johnson <johnsond@cs.utah.edu> 
   - initial version.
