%define name mu-conference
%define version 0.7
%define url https://gna.org/projects/mu-conference/

%define release_num 1
%define release %{release_num}.emulab%{?date:.%{date}}

%define debug_package %{nil}

Name:		%{name}
Version:	%{version}
Release:	%{release}
Summary:	MU-Conference is a component for a Jabber server. It provides an implementation of XEP-0045 which allow the creation of multi-users chat.

Group:		Chat
License:	GPLv2
URL:		%{url}
Source:	      	%{name}_%{version}.tar.gz
BuildRoot:	%{_tmppath}/%{name}_%{version}-%{release}-root-%(%{__id_u} -n)

BuildRequires:	make, autoconf, gcc, glib2-devel, expat-devel, libidn-devel, mysql, pkgconfig, mysql-devel
Requires:	jabberd, glib2, expat, libidn, mysql, mysql-server, mysql-libs

Provides:	mu-conference

%description
MU-Conference is a component for a Jabber server. It provides an implementation
of XEP-0045 which allow the creation of multi-users chat.

%prep
%setup -n %{name}_%{version}

%build
make 

%install
rm -rf $RPM_BUILD_ROOT
mkdir -p $RPM_BUILD_ROOT
mkdir -p $RPM_BUILD_ROOT/usr/bin
mkdir -p $RPM_BUILD_ROOT/usr/share/doc/%{name}-%{version}

install src/mu-conference $RPM_BUILD_ROOT/usr/bin
install -m 644 AUTHORS $RPM_BUILD_ROOT/usr/share/doc/%{name}-%{version}/
install -m 644 COPYING $RPM_BUILD_ROOT/usr/share/doc/%{name}-%{version}/
install -m 644 FAQ $RPM_BUILD_ROOT/usr/share/doc/%{name}-%{version}/
install -m 644 LICENSE $RPM_BUILD_ROOT/usr/share/doc/%{name}-%{version}/
install -m 644 README $RPM_BUILD_ROOT/usr/share/doc/%{name}-%{version}/
install -m 644 README.sql $RPM_BUILD_ROOT/usr/share/doc/%{name}-%{version}/
install -m 644 XEP0045_SUPPORT $RPM_BUILD_ROOT/usr/share/doc/%{name}-%{version}/
install -m 644 mu-conference.sql $RPM_BUILD_ROOT/usr/share/doc/%{name}-%{version}/
install -m 644 muc-default.xml $RPM_BUILD_ROOT/usr/share/doc/%{name}-%{version}/

%clean
rm -rf $RPM_BUILD_ROOT

%files
%defattr(-,root,root,-)
%doc
/usr/bin/mu-conference
/usr/share/doc/%{name}-%{version}/*

%post

%changelog

 * Fri Nov 21 2008 David Johnson <johnsond@cs.utah.edu> 
   - initial version.
