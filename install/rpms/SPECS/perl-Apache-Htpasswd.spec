%define name perl-Apache-Htpasswd
%define pname Apache-Htpasswd
%define version 1.8
%define url http://search.cpan.org/CPAN/authors/id/K/KM/KMELTZ/%{pname}-%{version}.tar.gz

%define release_num 1
%define release %{release_num}.emulab%{?date:.%{date}}

%define debug_package %{nil}

%define perlvers %(perl -V | grep revision | sed -n -e 's/^.*revision \\([0-9]*\\) version \\([0-9]*\\) subversion \\([0-9]*\\).*/\\1.\\2.\\3/p')

Name:		%{name}
Version:	%{version}
Release:	%{release}
Summary:	Apache::Htpasswd - Manage Unix crypt-style password file.

Group:		Web
License:	GPL v2
URL:		%{url}
Source:	      	%{pname}-%{version}.tar.gz
BuildRoot:	%{_tmppath}/%{name}-%{version}-%{release}-root-%(%{__id_u} -n)

BuildRequires:	coreutils, make, perl, perl-Crypt-PasswdMD5, perl-Digest-SHA1, perl-ExtUtils-MakeMaker
Requires:	perl, perl-Crypt-PasswdMD5, perl-Digest-SHA1

Provides:	perl-Apache-Htpasswd, perl(Apache::Htpasswd)

%description
This module comes with a set of methods to use with htaccess password
files. These files (and htaccess) are used to do Basic Authentication on
a web server.

%prep
%setup -n %{pname}-%{version}

%build
perl Makefile.PL prefix=/usr
make 

%install
rm -rf $RPM_BUILD_ROOT
mkdir -p  $RPM_BUILD_ROOT/
make DESTDIR=$RPM_BUILD_ROOT install

%clean
rm -rf $RPM_BUILD_ROOT

%files
%defattr(-,root,root,-)
%doc
/usr/lib*/perl5/%{perlvers}/*-linux-thread-multi/perllocal.pod
/usr/lib*/perl5/site_perl/%{perlvers}/Apache/Htpasswd.pm
/usr/lib*/perl5/site_perl/%{perlvers}/*-linux-thread-multi/auto/Apache/Htpasswd/.packlist
/usr/share/man/man3/Apache::Htpasswd.3pm.gz

%post

%changelog

 * Mon Dec 01 2008 David Johnson <johnsond@cs.utah.edu> 
   - initial version.
