/*
 * EMULAB-COPYRIGHT
 * Copyright (c) 2004 University of Utah and the Flux Group.
 * All rights reserved.
 */

/*
 * featuredesire.cc - implementation of the objects from featuredesire.h
 */

#include "featuredesire.h"
#include "common.h"

/*********************************************************************
 * tb_featuredesire
 *********************************************************************/
tb_featuredesire::name_featuredesire_map
    tb_featuredesire::featuredesires_by_name;


/*
 * Constructor
 */
tb_featuredesire::tb_featuredesire(crope _my_name) : my_name(_my_name),
				    global(false), local(false),
				    l_additive(false), g_one_is_okay(false),
				    g_more_than_one(false),
				    in_use_globally(0) { 
    static int highest_id = 0;
		
    // Pick a unique numeric identifier for this feature/desire
    id = highest_id++;

    // Find out which flags should be set for this feature/desire from the name
    switch (my_name[0]) {
	case '?':
	    // A local feature - the second character tell us what kind.
	    // Currently only additive are supported
	    local = true;
	    switch(my_name[1]) {
		case '+':
		    l_additive = true;
		    break;
		default:
		    cerr << "*** Invalid local feature type in feature " <<
			my_name << endl;
		    exit(EXIT_FATAL);
	    }
	    break;
	case '*':
	    // A global feature - the second character tells us what kind.
	    global = true;
	    switch(my_name[1]) {
		case '&':
		    g_one_is_okay = true;
		    break;
		case '!':
		    g_more_than_one = true;
		    break;
		default:
		    cerr << "*** Invalid global feature type in feature " <<
			my_name << endl;
		    exit(EXIT_FATAL);
	    }
	    break;
	default:
	    // Just a regular feature
	    break;
    }

    // Place this into the map for finding featuredesire objects by
    // name
    assert(featuredesires_by_name.find(my_name)
	    == featuredesires_by_name.end());
    featuredesires_by_name[my_name] = this;
}

/*
 * Operators
 */
ostream &operator<<(ostream &o, const tb_featuredesire &fd) {
    // Perhaps this should print more information like the flags and/or global
    // use count
    o << fd.my_name;
}


/*
 * Static functions
 */
tb_featuredesire *tb_featuredesire::get_featuredesire_obj(const crope name) {
    name_featuredesire_map::iterator it =
	featuredesires_by_name.find(name);
    if (it == featuredesires_by_name.end()) {
	return new tb_featuredesire(name);
    } else {
	return it->second;
    }
}

/*
 * Functions for maintaining state for global FDs
 */
void tb_featuredesire::add_global_user(int howmany) {
    assert(global);
    in_use_globally += howmany;
}	

void tb_featuredesire::remove_global_user(int howmany) {
    assert(global);
    in_use_globally -= howmany;
    assert(in_use_globally >= 0);
}

/*********************************************************************
 * tb_node_featuredesire
 *********************************************************************/

/*
 * Constructor
 */
tb_node_featuredesire::tb_node_featuredesire(crope _name, double _weight) :
	weight(_weight), violateable(false) {
    // We'll want to change in the in the future to seperate out the notions of
    // score and violations
    if (weight >= FD_VIOLATION_WEIGHT) {
	violateable = true;
    }
    featuredesire_obj = tb_featuredesire::get_featuredesire_obj(_name);
}
