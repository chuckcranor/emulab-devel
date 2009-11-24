%define name emulab-boss
%define version 2.0
%define elab_url http://www.emulab.net

%define release_num 4
%define release %{release_num}.emulab%{?date:.%{date}}

Name:		%{name}
Version:	%{version}
Release:	%{release}
Summary:	A metapackage with dependencies for an Emulab BOSS server.

Group:		System Environment/Daemons
License:	AGPL
URL:		%{elab_url}
#Source0:	
BuildRoot:	%{_tmppath}/%{name}-%{version}-%{release}-root-%(%{__id_u} -n)

#BuildRequires:	
Requires:	emulab-compat, emulab-supplemental-mibs
Requires:	make, gcc, gcc-c++
Requires:	zlib
%if 0%{?fedora} >= 9
Requires:	zlib-static
%endif
%if 0%{?fedora} >= 11
Requires:   openssl-static
Requires:   glibc-static
Requires:   libpcap-devel
Requires:   php-process
%endif
Requires:	nfs-utils
Requires:	mysql, mysql-server, mysql-devel
Requires:	perl, perl-suidperl, perl-BSD-Resource, perl-DBD-MySQL, perl-DBI, perl-XML-Parser, perl-XML-Simple, perl-XML-LibXML, perl-CGI-Session, perl-GDGraph, perl-HTML-Parser, perl-TimeDate, perl-RPC-XML, perl-IO-Tty, perl-MD5, perl-SNMP-Info, perl-SNMP_Session, perl-Digest-SHA1, perl-Digest-SHA, perl-Digest-HMAC, perl-MD5
Requires:	sendmail, sendmail-cf
# let otcl pull in tcl and tk!
Requires:	otcl
Requires:	wget, curl
Requires:	python, python-devel, MySQL-python, m2crypto
Requires:	httpd, mod_auth_mysql, mod_ssl
Requires:	php, php-adodb, php-mysql, php-mhash, php-xmlrpc
Requires:	graphviz
Requires:	fping, netpbm, vcg
Requires:	xinetd, tftp-server
Requires:	dhcp
Requires:	boost, boost-devel, metis
Requires:	swig
Requires:	cracklib, cracklib-dicts
Requires:	bind, bind-utils
# grab to get smb-passwd since configure needs it
Requires:	samba-common
# General deps
Requires:	make, autoconf, ntp, sudo, rsync, mhash, 
Requires:	openssh-server, openssh, openssh-clients
Requires:	openssl, openssl-devel
Requires:	rsyslog
Requires:	rcs
Requires:	expat-devel
Requires:	flex, byacc
Requires:	db4, db4-utils, db4-devel
# xml assign dep
Requires:	xerces-c-devel
# Emulab-ish stuff
Requires:	pubsub, ulsshxmlrpcpp

Conflicts:	nscd

provides:	emulab-boss


%description
This is the BOSS "metapackage", which is essentially a big dependency container
of all the packages that need to be installed on an Emulab BOSS server.

%prep
mkdir -p $RPM_BUILD_ROOT

%build

%install
#echo "Nothing to install for emulab-boss!"

%clean
rm -rf $RPM_BUILD_ROOT

%files
%defattr(-,root,root,-)
%doc

%changelog

 * Mon Sep 09 2008 David Johnson <johnsond@cs.utah.edu> 
   - initial version.
