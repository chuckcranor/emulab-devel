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
    assert(featuredesire_obj != NULL);
}

/*********************************************************************
 * tb_featuredesire_set_iterator
 *********************************************************************/

tb_featuredesire_set_iterator::tb_featuredesire_set_iterator(
	node_fd_set::iterator _begin1, node_fd_set::iterator _end1,
	node_fd_set::iterator _begin2, node_fd_set::iterator _end2) :
	    it1(_begin1), end1(_end1), it2(_begin2), end2(_end2) {
    /*
     * Figure out what the next element of the set is
     */
    // First check to see if we've hit the end of both lists
    if ((it1 == end1) && (it2 == end2)) {
	current = end1;
    } else if ((it1 != end1) && ((it2 == end2) || (*it1 < *it2))) {
	// If one has hit the end of the list, go with the other - otherwise,
	// go with the smaller of the two.
	current_membership = FIRST_ONLY;
	current = it1;
    } else if ((it1 == end1) || (*it2 < *it1)) {
	current_membership = SECOND_ONLY;
	current = it2;
    } else {
	// If neither is smaller, they must be equal
	current = it1;
	current_membership = BOTH;
    }
}

bool tb_featuredesire_set_iterator::done() const {
    return((it1 == end1) && (it2 == end2));
}

void tb_featuredesire_set_iterator::operator++(int) {
    /*
     * Advance the iterator(s)
     */
    // Make sure they don't try to go off the end of the list
    assert((it1 != end1) || (it2 != end2));
    // If one iterator has gone off the end of its list, advance the other one
    // - otherwise, go with the smaller one. Or, if they are equal,  increment
    // both.
    if ((it1 != end1) && ((it2 == end2) ||  (*it1 < *it2))) {
	it1++;
    } else if ((it1 == end1) || (*it2 < *it1)) {
	it2++;
    } else {
	// If neither was smaller, they must be equal - advance both
	it1++;
	it2++;
    }

    /*
     * Figure out what the next element of the set is
     */
    // First check to see if we've hit the end of both lists
    if ((it1 == end1) && (it2 == end2)) {
	current = end1;
    } else if ((it2 == end2) || (*it1 < *it2)) {
	// If one has hit the end of the list, go with the other - otherwise,
	// go with the smaller of the two.
	current_membership = FIRST_ONLY;
	current = it1;
    } else if ((it1 == end1) || (*it2 < *it1)) {
	current_membership = SECOND_ONLY;
	current = it2;
    } else {
	// If neither is smaller, they must be equal
	current = it1;
	current_membership = BOTH;
    }
}

bool tb_featuredesire_set_iterator::both_equiv() const {
    assert(current_membership == BOTH);
    return (it1->equivalent(*it2));
}

bool tb_featuredesire_set_iterator::either_violateable() const {
    if (current_membership == BOTH) {
	return (it1->is_violateable() || it2->is_violateable());
    } else {
	return current->is_violateable();
    }
}
