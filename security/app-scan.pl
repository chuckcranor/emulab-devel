my $file = "app-ports.txt";
my $dotcp = 1;
my $doudp = 0;

my @tcpports = ();
my @udpports = ();

if (! -e $file) {
    die("No $file file");
}

if (open(FD, "<$file")) {
    while (<FD>) {
	if (/^(\d+)\/(tcp|udp).*# (.*)$/) {
	    if ($2 eq "tcp") {
		push @tcpports, $1;
	    } elsif ($2 eq "udp") {
		push @udpports, $1;
	    }
	}
    }
}

if (@ARGV == 0) {
    print STDERR "Usage: $0 host ...\n";
    exit(1);
}
foreach my $host (@ARGV) {
    # TCP
    if ($dotcp) {
	my $portarg = "-p T:" . join(',', @tcpports);
	print STDERR "Doing 'nmap $portarg $host'\n"
	    if (0);
	system("nmap $portarg $host");
    }

    # UDP. Note UDP takes a long time.
    if ($doudp) {
	my $portarg = "-sU -p U:" . join(',', @udpports);
	print STDERR "Doing 'nmap $portarg $host'\n"
	    if (0);
	system("nmap $portarg $host");
    }
}
exit(0);
