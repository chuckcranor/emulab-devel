%define name twiki
%define version 4.1
%define url http://www.emulab.net/downloads/%{name}-%{version}.tgz

%define release_num 1
%define release %{release_num}.emulab%{?date:.%{date}}

%define debug_package %{nil}

Name:		%{name}
Version:	%{version}
Release:	%{release}
Summary:	TWiki is a flexible and powerful web-based collaboration platform.

Group:		Collaboration
License:	GPL v2
URL:		%{url}
Source:	      	%{name}-%{version}.tgz
BuildRoot:	%{_tmppath}/%{name}-%{version}-%{release}-root-%(%{__id_u} -n)

BuildRequires:	coreutils
Requires:	httpd, perl, cvs

Provides:	twiki, perl(TWiki::Plugins::WysiwygPlugin::HTML2TML::WC), perl(TWiki::Contrib::Build)

%description
TWiki is a flexible and powerful web-based collaboration 
platform that allows you to run a dynamic intranet site, a 
project development space, a document management system, a 
knowledge base, an issue tracking system and many other 
groupware application. TWiki looks and feels like a normal 
intranet or Web site. Users can freely change or create 
content from any Web browser, without requiring special 
browser plugins.

%prep
%setup -c -n %{name}-%{version}

%build

%install
rm -rf $RPM_BUILD_ROOT
mkdir -p  $RPM_BUILD_ROOT/var/www/html/twiki
cp -pR ./* $RPM_BUILD_ROOT/var/www/html/twiki

%clean
rm -rf $RPM_BUILD_ROOT

#
# Yes, we do assume that apache is being run by nobody, not apache!
#
%files
%defattr(-,nobody,nobody,-)
%doc
/var/www/html/twiki

%post

%changelog

 * Mon Dec 01 2008 David Johnson <johnsond@cs.utah.edu> 
   - initial version.
