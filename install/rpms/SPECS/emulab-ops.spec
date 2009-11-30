%define name emulab-ops
%define version 2.0
%define elab_url http://www.emulab.net

%define release_num 2
%define release %{release_num}.emulab%{?date:.%{date}}

Name:		%{name}
Version:	%{version}
Release:	%{release}
Summary:	A metapackage with dependencies for an Emulab OPS server.

Group:		System Environment/Daemons
License:	AGPL
URL:		%{elab_url}
#Source0:	
BuildRoot:	%{_tmppath}/%{name}-%{version}-%{release}-root-%(%{__id_u} -n)

#BuildRequires:	
Requires:	emulab-compat
Requires:	make, gcc, gcc-c++, sudo, rsync, samba, nfs-utils, mhash
Requires:	zlib
%if 0%{?fedora} >= 9
Requires:	zlib-static
%endif
Requires:	mysql, mysql-server, mysql-devel
Requires:	perl, perl-suidperl, perl-BSD-Resource, perl-DBD-MySQL, perl-DBI, perl-XML-Parser, perl-XML-Simple, perl-XML-LibXML, perl-CGI-Session, perl-GDGraph, perl-HTML-Parser, perl-Digest-SHA1, perl-Digest-SHA, perl-Digest-HMAC, perl-MD5
Requires:	sendmail, sendmail-cf
# let otcl pull these in!: tcl, tk, tcl-devel, tk-devel
Requires:	otcl
Requires:	libXt-devel
Requires:	wget, curl
Requires:	python, python-devel, MySQL-python, m2crypto
Requires:	httpd, mod_auth_mysql, mod_ssl
Requires:	php, php-adodb
# Emulab-ish stuff
Requires:	pubsub, ulsshxmlrpcpp
Requires:	xinetd
Requires:	expat-devel

Conflicts:	nscd

Provides:	emulab-ops

%description
This is the OPS "metapackage", which is essentially a big dependency container
of all the packages that need to be installed on an Emulab OPS server.

%prep
mkdir -p $RPM_BUILD_ROOT

%build

%install
#echo "Nothing to install for emulab-ops!"

%clean
rm -rf $RPM_BUILD_ROOT

%files
%defattr(-,root,root,-)
%doc

%changelog

 * Mon Sep 09 2008 David Johnson <johnsond@cs.utah.edu> 
   - initial version.
