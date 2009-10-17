%define name flyspray
%define version r205
%define url http://flyspray.org/

%define release_num 1
%define release %{release_num}.emulab%{?date:.%{date}}

%define debug_package %{nil}

Name:		%{name}
Version:	%{version}
Release:	%{release}
Summary:	Flyspray is an uncomplicated, web-based bug tracking system for assisting with software development.

Group:		Source Code Management
License:	LGPL v2.1
URL:		%{url}
Source:	      	%{name}-%{version}.tar.gz
BuildRoot:	%{_tmppath}/%{name}-%{version}-%{release}-root-%(%{__id_u} -n)

Requires:	httpd, php, php-adodb

Provides:	flyspray

patch1:		notify.patch
patch2:		perf.patch
patch3:		scripts.patch
patch4:		theme.patch
patch5:		xmlrpc.patch
patch6:		includes.patch

%description
Flyspray is an uncomplicated, web-based bug tracking system written in PHP for
assisting with software development. It was originally conceived when the Psi
Jabber client project couldn't find a bugtracker that suited their needs, and
has been made available for everyone to use for their own projects.

%prep
%setup -n %{name}-%{version}
%patch1 -p0
%patch2 -p0
%patch3 -p0
%patch4 -p0
%patch5 -p0
%patch6 -p0
rm -rf `find . -type d | grep \.svn\$ | xargs`

%build

%install
rm -rf $RPM_BUILD_ROOT
mkdir -p  $RPM_BUILD_ROOT/var/www/html/flyspray
cp -pR ./* $RPM_BUILD_ROOT/var/www/html/flyspray/

%clean
rm -rf $RPM_BUILD_ROOT

%files
%defattr(-,root,root,-)
%doc
/var/www/html/flyspray/addons/*
/var/www/html/flyspray/adodb/
/var/www/html/flyspray/attachments/
/var/www/html/flyspray/docs/*
/var/www/html/flyspray/favicon.ico
/var/www/html/flyspray/*.php
/var/www/html/flyspray/includes/*
/var/www/html/flyspray/lang/*
/var/www/html/flyspray/scripts/*
/var/www/html/flyspray/setup/*
/var/www/html/flyspray/sql/*
/var/www/html/flyspray/templates/*
/var/www/html/flyspray/tests/*
/var/www/html/flyspray/themes/*

%post
chown nobody /var/www/html/flyspray/attachments
chmod u+rwx /var/www/html/flyspray/attachments

%changelog

 * Mon Dec 01 2008 David Johnson <johnsond@cs.utah.edu> 
   - initial version.
