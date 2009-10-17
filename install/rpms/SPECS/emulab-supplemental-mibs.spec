%define name emulab-supplemental-mibs
%define version 0.01
%define url http://www.emulab.net

%define release_num 1
%define release %{release_num}.emulab%{?date:.%{date}}

%define debug_package %{nil}

Name:		%{name}
Version:	%{version}
Release:	%{release}
Summary:	Supplemental MIB files needed for Emulab SNMP support.

Group:		Language
License:	MIT
URL:		%{url}
Source:	      	%{name}.tar.gz
BuildRoot:	%{_tmppath}/%{name}-%{version}-%{release}-root-%(%{__id_u} -n)

#BuildRequires:	make, autoconf, gcc, tcl, tcl-devel, tk, tk-devel, libXt-devel
Requires:	net-snmp

Provides:	emulab-supplemental-mibs

%description
Supplemental MIB files needed for Emulab SNMP support.  At last
check, net-snmp did not provide these.

%prep
%setup -n %{name}

%build

%install
rm -rf $RPM_BUILD_ROOT
mkdir -p  $RPM_BUILD_ROOT
mkdir -p  $RPM_BUILD_ROOT/usr/share/snmp/mibs

install ENTITY-MIB.txt $RPM_BUILD_ROOT/usr/share/snmp/mibs
install FDDI-SMT73-MIB.txt $RPM_BUILD_ROOT/usr/share/snmp/mibs
install TOKEN-RING-RMON-MIB.txt $RPM_BUILD_ROOT/usr/share/snmp/mibs

%clean
rm -rf $RPM_BUILD_ROOT

%files
%defattr(-,root,root,-)
%doc
/usr/share/snmp/mibs/*

%post

%changelog

 * Mon Dec 01 2008 David Johnson <johnsond@cs.utah.edu> 
   - initial version.
