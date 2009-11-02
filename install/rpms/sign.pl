#!/usr/bin/perl -w

use strict;
use Expect;

my $PASSFILE = "/proj/emulab-ops/emulab-repo.key/p";
open(PFD,$PASSFILE) 
    or die "open($PASSFILE): $!\n";
my $PASSPHRASE = <PFD>;
close(PFD);

my $e = Expect->spawn("rpm","--addsign",@ARGV)
    or die "Expect\->spawn(rpm): $!\n";
$e->expect(undef,[ "Enter pass phrase: " => sub { my $e = shift;
						  $e->send($PASSPHRASE);
						  exp_continue; } ]);
$e->soft_close();

exit(0);
