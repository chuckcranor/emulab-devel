# -*- TCL -*-

source tb_compat.tcl

# XXX Build this in for now.
set HardwareTypes(pcvm850,cpu) 850.0
set HardwareTypes(pcvm850,ram) 256.0

set HardwareTypes(pcvm600,cpu) 600.0
set HardwareTypes(pcvm600,ram) 256.0

#
# Write to the tb-experimental log file, as defined by the tbxlogfile global
# variable.  If the tbxlogfile variable is not set, the message is sent to
# /dev/null.
#
# @param msg The message to write to the log file.
#
# @global tbxlogfile The path to the log file, if defined.
#
proc tbx-log {msg} {
    global tbxlogfile;

    if {[info exists tbxlogfile]} {
	puts $tbxlogfile $msg
    }
}

if {![info exists tbxexpdir]} {
    if {[info exists ::GLOBALS::pid] &&
        [info exists ::GLOBALS::gid] &&
        [info exists ::GLOBALS::eid]} {
	set tbxexpdir "/groups/${::GLOBALS::pid}/${::GLOBALS::gid}/exp/${::GLOBALS::eid}"
    } else {
	tbx-log "pid/gid/eid not defined..."
    }
} else {
    tbx-log "User defined tbxexpdir"
}

# Get any emulab generated feedback data.
if {[info exists tbxexpdir]} {
    if {[file exists "${tbxexpdir}/tbdata/feedback_data.tcl"]} {
	source "${tbxexpdir}/tbdata/feedback_data.tcl"
    }
}

#
# The tbx-feedback-vnode command is used to configure a virtual node using
# feedback data.  This command is assumed to be used in an iterative process
# where the user maps their experiment, runs their application, Emulab collects
# resource usage data, and the user remaps their experiment using the newly
# collected usage data.  The eventual goal of this process is to find a mapping
# where the topology requires fewer pnodes without sacrificing application QoS.
#
# Initially, there is no feedback data to work from, so a bootstrap phase is
# done to get some clean resource usage data.  Bootstrapping is simply a matter
# of forcing a one-to-one mapping by having each vnode reserve an entire pnode.
# Once the bootstrap data has been collected, the user can increase or decrease
# the reservations until they get application results that are consistent with
# the one-to-one mapping.  At this point, the user will probably want to
# increase the size of the topology.  The simplest approach would be to use the
# bootstrap data for nodes that will remain in the experiment and perform a
# bootstrap on the newly added nodes.  Alternatively, the user can divide nodes
# into resource classes (e.g. Client/Server) which are initialized using data
# derived from previous runs.  XXX more
#
# @param ns The Simulator object.
# @param node The vnode to configure.
# @param hardware The hardware type for the vnode (e.g. pcvm850)
# @param scale The amount to scale the feedback values when making
#   reservations.  (Default: 1.2)
# @param rclass A symbolic named used to identify the vnode's "resource class".
#   (Default: The node name)
#
# @global HardwareTypes A testbed provided table that describes the various
#   hardware types and their available resources.
# @global Reservations A user or testbed provided table that holds the
#   reservations to be made for each resource on a vnode.
#
proc tbx-feedback-vnode {ns node hardware {scale 1.2} {rclass ""}} {
    global HardwareTypes;  # Our supported hardware types.
    global Reservations;   # The reservations to make for nodes.
    global tbx_vnode_list; # vnode list file (used by slothd stuff).

    # Check our inputs,
    if {[array get HardwareTypes $hardware*] == ""} {
	error "*** Unknown hardware type: $hardware"
    }
    if {$scale <= 0.0} {
	error "*** Feedback scale is not greater than zero: $scale"
    }

    tbx-log "BEGIN feedback for $node"

    # ... set computed default values, and
    if {$rclass == ""} {
	set rclass $node
	tbx-log "  Using per-vnode rclass for $node"
    }

    if {[array get Reservations $node*] == ""} {
	# No node-specific values, try the rclass.
	if {[array get Reservations $rclass*] != ""} {
	    # Use bootstrap feedback from a previous topology,
	    set rcdefaults [array get Reservations $rclass*]
	    # ... change the rclass to the node name, and
	    regsub -all -- $rclass $rcdefaults $node rcdefaults
	    # ... add them to the Reservations table.
	    array set Reservations $rcdefaults
	    tbx-log "  Initializing node, $node, to $rclass values"
	} else {
	    # No feedback exists yet, so we get the hardware values,
	    set hwdefaults [array get HardwareTypes $hardware*]
	    # ... change the hardware name to the node name, and
	    regsub -all -- $hardware $hwdefaults $node hwdefaults
	    # ... add them to the Reservations table.
	    array set Reservations $hwdefaults
	    tbx-log "  Initializing node, $node, to $hardware values"
	}
    }

    # ... make the reservations.
    foreach name [array names Reservations $node,*] {
	# Get the type of reservation and
	set reservation_type [lindex [split $name {,}] 1]
	# ... its value.
	set raw_reservation [set Reservations($name)]
	# Then scale the reservation
	set desired_reservation [expr $raw_reservation * $scale]
	# ... making sure it is still within the range of the hardware.
	if {$desired_reservation <= 0.0} {
	    # XXX Not allowing negative values might be too restrictive...
	    error "*** Bad reservation value: $name = $raw_reservation"
	}
	if {[array get HardwareTypes $hardware,$reservation_type] == ""} {
	    # ignore
	} else {
	    set max_reservation [set HardwareTypes($hardware,$reservation_type)]
	    if {$desired_reservation > $max_reservation} {
		set desired_reservation $max_reservation
	    }
	    tbx-log "  $reservation_type: ${desired_reservation}"
	    # Finally, tell assign about our desire.
	    $node add-desire ?+${reservation_type} ${desired_reservation}
	}
    }

    # XXX Not sure if the following should be done here...
    tb-set-hardware $node $hardware

    tbx-log "END feedback for $node"
}

proc tbx-feedback-vlink {ns link {scale 1.2}} {
    global Reservations;   # The reservations to make for nodes.
    global tbx_vnode_list; # vnode list file (used by slothd stuff).

    tbx-log "BEGIN feedback for link $link"

    if {[array get Reservations $link*] == ""} {
	# No feedback yet...
    }

    foreach name [array names Reservations ${link},bw] {
	# Get the type of reservation and
	set reservation_type [lindex [split $name {,}] 1]
	# ... its value.
	set raw_reservation [set Reservations($name)]
	# Get the maximum allowed value and
	set max_reservation 0
	foreach pair [$link array names bandwidth] {
	    if {[$link set bandwidth($pair)] > $max_reservation} {
		set max_reservation [$link set bandwidth($pair)]
	    }
	}
	# ... fix any measuring/shaping error.
	if {$raw_reservation > $max_reservation} {
	    tbx-log "  request > max: $raw_reservation $max_reservation"
	    set raw_reservation $max_reservation
	}
	# Then scale the reservation
	set desired_reservation [expr int(sqrt($raw_reservation * $max_reservation))]
	# ... making sure it is still within the range of the hardware.
	if {$desired_reservation <= 0.0} {
	    # XXX Not allowing negative values might be too restrictive...
	    error "*** Bad reservation value: $name = $raw_reservation"
	}
	if {$desired_reservation > $max_reservation} {
	    set desired_reservation $max_reservation
	}

	tbx-log "  $reservation_type: ${desired_reservation}"

	# Finally, adjust the cap.
	tb-set-link-est-bandwidth $link ${desired_reservation}kb
	# foreach pair [$link array names bandwidth] {
	#     $link set bandwidth($pair) $desired_reservation
	# }
    }
    
    tbx-log "END feedback for link $link"
}
