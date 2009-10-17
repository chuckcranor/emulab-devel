%define name cvsd
%define version 1.0.15
%define url http://ch.tudelft.nl/~arthur/cvsd/

%define release_num 1
%define release %{release_num}.emulab%{?date:.%{date}}

%define debug_package %{nil}

Name:		%{name}
Version:	%{version}
Release:	%{release}
Summary:	cvsd is a wrapper program for cvs in pserver mode.

Group:		Source Code Management
License:	GPL v2
URL:		%{url}
Source:	      	%{name}-%{version}.tar.gz
BuildRoot:	%{_tmppath}/%{name}-%{version}-%{release}-root-%(%{__id_u} -n)

BuildRequires:	make, autoconf, gcc, tcp_wrappers-devel, perl, cvs
Requires:	glibc, tcp_wrappers-libs, perl, cvs

Provides:	cvsd

patch1:         cvsd-fedora-initscript.patch

%description
cvsd is a wrapper program for cvs in pserver mode. It will run 'cvs pserver'
under a special uid/gid in a chroot jail.  cvsd is run as a daemon and is
controlled through a configuration file. It is relatively easy to configure and
tools are provided for setting up a rootjail.

%prep
%setup -n %{name}-%{version}
%patch1 -p1 

%build
%configure --prefix=/usr --with-libwrap
make 

%install
rm -rf $RPM_BUILD_ROOT
mkdir -p  $RPM_BUILD_ROOT
env DESTDIR=$RPM_BUILD_ROOT make install

%clean
rm -rf $RPM_BUILD_ROOT

%files
%defattr(-,root,root,-)
%doc
/usr/share/man/man8/*
/usr/share/man/man5/*
/usr/sbin/*
/etc/cvsd/*
/etc/init.d/*

%post

%changelog

 * Mon Dec 01 2008 David Johnson <johnsond@cs.utah.edu> 
   - initial version.
