%define name vcg
%define version 1.30
%define realversion 20050204
%define url http://vcg.sourceforge.net/

%define release_num 1
%define release %{release_num}.emulab%{?date:.%{date}}

%define debug_package %{nil}

Name:		%{name}
Version:	%{version}
Release:	%{release}
Summary:	The VCG tool reads a textual and readable specification of a graph and visualizes  the graph.

Group:		Graphing
License:	GPLv2
URL:		%{url}
Source:	      	%{name}.%{realversion}.tgz
BuildRoot:	%{_tmppath}/%{name}-%{version}-%{release}-root-%(%{__id_u} -n)

BuildRequires:	make, imake, gcc, libXext, libXext-devel, tcsh
Requires:	libXext

Provides:	vcg

# either I'm stupid or imake is ... gnu make just can't handle an 'all::' line
# probably it's me
patch1:	   	vcg-imake-stupidity.patch

%description
The VCG tool reads a textual and readable specification of a graph and
visualizes the graph.  If not all positions of nodes are fixed, the tool
layouts the graph using several heuristics as reducing the number of crossings,
minimizing the size of edges, centering of nodes.  The specification language
of the VCG tool is nearly compatible to GRL, the language of the edge tool, but
contains many extensions. The VCG tool allows folding of dynamically or
statically specified regions of the graph.  It uses colors and runs on X11. (An
older version runs on Sunview).

%prep
%setup -n %{name}.%{version}
%patch1 -p0

%build
make

%install
rm -rf $RPM_BUILD_ROOT
mkdir -p  $RPM_BUILD_ROOT
mkdir -p  $RPM_BUILD_ROOT/usr/bin
mkdir -p  $RPM_BUILD_ROOT/usr/X11R6/bin

install src/xvcg $RPM_BUILD_ROOT/usr/bin
# "historical" reasons, nae doubt
ln -sf ../../bin/xvcg $RPM_BUILD_ROOT/usr/X11R6/bin/xvcg

%clean
rm -rf $RPM_BUILD_ROOT

%files
%defattr(-,root,root,-)
%doc COPYING doc/README.* doc/*.txt doc/*.ps
/usr/bin/*
/usr/X11R6/bin/xvcg

%changelog

 * Tue Sep 10 2008 David Johnson <johnsond@cs.utah.edu> 
   - initial version.
