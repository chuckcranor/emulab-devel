%define name emulab-compat
%define version 0.1
%define url http://www.emulab.net

%define release_num 2
%define release %{release_num}.emulab%{?date:.%{date}}

%define debug_package %{nil}

Name:		%{name}
Version:	%{version}
Release:	%{release}
Summary:	Any (FreeBSD) compat utils need by Emulab software.

Group:		Tools
License:	AGPLv3
URL:		%{url}
Source:	      	%{name}-%{version}.tar.gz
BuildRoot:	%{_tmppath}/%{name}-%{version}-%{release}-root-%(%{__id_u} -n)

BuildRequires:	coreutils
Requires:	coreutils, perl

Provides:	emulab-compat

%description
This package contains any (FreeBSD) compat utils need by Emulab software.

%prep
%setup -n %{name}-%{version}

%build

%install
#
# this bit of ugliness is essentially pulled from the Makefile,
# since I don't want to patch it with a DESTDIR and crap
#
rm -rf $RPM_BUILD_ROOT
mkdir -p  $RPM_BUILD_ROOT
mkdir -p  $RPM_BUILD_ROOT/sbin

# I would symlink, but bsdXsum needs to know which progname we were invoked by.
install -m 755 bsdXsum $RPM_BUILD_ROOT/sbin/md5
install -m 755 bsdXsum $RPM_BUILD_ROOT/sbin/sha1
install -m 755 bsdXsum $RPM_BUILD_ROOT/sbin/sha256

%clean
rm -rf $RPM_BUILD_ROOT

%files
%defattr(-,root,root,-)
%doc
/sbin/md5
/sbin/sha1
/sbin/sha256

%post

%changelog

 * Tue Nov 11 2008 David Johnson <johnsond@cs.utah.edu> 
   - initial version.
