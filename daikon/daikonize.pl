#!/usr/bin/perl -w

use POSIX qw(WIFEXITED WEXITSTATUS);

use strict;

my $prefix=$ENV{PREFIX};
my $envsetup=$ENV{ENVSETUP};

# MODES:
#   stage1
#   stage2
#   analyze
#   restore -- restore the state to a non-daikonzes state

# The real perl script is renamed to "*.real.pl"

sub dir_file ($) {/^(.+)\/(.+)$/ =~ $_[0]; return ($1,$2);}

my @perl_files = qw(libexec/assign_wrapper);
foreach (@perl_files) {$_ = "$prefix/$_";}
my %dirs;
foreach (@perl_files) {my ($d,$f) = dir_file $_; $dirs{$d} = 1;}
my @dirs = sort keys %dirs;


my $mode = $ARGV[0] || '';

sub create_shell_wrapper ( $$$$$ );
sub in_stage ( $$ ) ;
sub restore ();

if ($mode eq "stage1") 
{
    eval {
	foreach (@perl_files) {
	    my ($d,$f) = dir_file $_;
	    chdir $d;
	    die "File $f already in a daikonized state.  Run \"daikonize restore\" first.\n" 
		if -e "$f.real.pl";
	    rename $f, "$f.real.pl" or die "Unable to rename $f to $f.real.pl\n";
	    system "dfepl --absolute $f.real.pl";
	    die "dfepl failed.\n" unless WIFEXITED($?) && WEXITSTATUS($?) == 0;
	    create_shell_wrapper $d, $f, 'STAGE1', 'dtype-perl', 'daikon-untyped';
	}
	foreach my $d (@dirs) {
	    foreach (qw(daikon-instrumented daikon-output daikon-untyped)) {
		mkdir "$d/$_";
		chmod 0777, "$d/$_";
	    }
	}
    };
    if ($@) {
	print STDERR "ERROR: $@";
	if ($@ =~ /already in a daikonized state/) {
	    exit 1;
	} else {
	    print STDERR "Restoring to pre-daikonized state.\n";
	    restore;
	    exit 2;
	}
    }
    exit 0;
}
elsif ($mode eq "stage2")
{
    foreach (@perl_files) {
	my ($d,$f) = dir_file $_;
	chdir $d;
	die "File $f not in stage1.\n" unless in_stage $f, 1;
	system "dfepl --absolute -T $f.real.pl";
	die "dfepl failed.\n" unless WIFEXITED($?);
    }
    foreach (@perl_files) {
	my ($d,$f) = dir_file $_;
	chdir $d;
	create_shell_wrapper $d, $f, 'STAGE2', 'dtrace-perl', 'daikon-instrumented';
    }
    exit 0;
}
elsif ($mode eq "analyze")
{
    foreach (@perl_files) {
	my ($d,$f) = dir_file $_;
	chdir $d;
	die "File $f not in stage2.\n" unless in_stage $f, 2;
	chdir 'daikon-output';
	system "java daikon.Daikon --omit_from_output 0r -o $f.inv $f.real-main.decls $f.real-combined.dtrace";
	die "\"java daikon.Daikon\" failed\n" unless WIFEXITED($?);
    }
    exit 0;
}
elsif ($mode eq "restore")
{
    restore;
    exit 0;
}
elsif ($mode eq "clean")
{
    restore;
    foreach (@perl_files) {
	my ($d,$f) = dir_file $_;
	system "rm -f $d/daikon-*/$f.*; rm -f $d/daikon-*/$f-*";
    }
    foreach (@dirs) {
	system "rmdir $_/daikon-*";
    }
    exit 0;
}
else 
{
    print STDERR "Usage: daikonize stage1|stage2|analyze|restore|clean\n";
    exit 1;
}

sub restore ()
{
    foreach my $f (@perl_files) {
	return unless -e "$f.real.pl";
	rename "$f.real.pl", $f or print STDERR "Warning: Unable to restore file $f\n";
    }
}

sub create_shell_wrapper ($$$$$)
{
    my ($d, $f, $stage, $prog, $ed) = @_;
    #open F, "$f.real.pl";
    open F, ">$f" or die "Unable to create file $f\n";
    print F "#!/bin/bash\n";
    print F "# $stage\n\n";
    print F ". $envsetup\n\n";
    print F "exec $prog $d/$ed/$f.real.pl \"\$@\"\n";
    close F;
    chmod 0755, "$f";
}


sub in_stage ($$)
{
    my ($f, $stage) = @_;
    open F, "$f" or return 0;
    <F>;
    local $_ = <F>;    
    /^\# STAGE(.)/ or return 0;
    return $1 == $stage;
}
