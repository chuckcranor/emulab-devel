/*
 * EMULAB-COPYRIGHT
 * Copyright (c) 2004 University of Utah and the Flux Group.
 * All rights reserved.
 */

#ifndef __FEATUREDESIRE_H
#define __FEATUREDESIRE_H

#include <rope>
#include <map>
#include <set>

/*
 * Base class for features and desires - not intended to be used directly, only
 * to be subclassed by tb_feature and tb_desire
 */
class tb_featuredesire {
    public:

	/*
	 * Note: Constructor is below - use get_featuredesire_obj instead
	 */

	~tb_featuredesire() { ; }

	/*
	 * Get the object for a particular feature/desire - if one does not
	 * exist, creates a new one. Otherwise, returns the existing object
	 */
	static tb_featuredesire *get_featuredesire_obj(const crope name);

	/*
	 * Silly accessor functions
	 */
	inline bool  is_global()        const { return global;          }
	inline bool  is_local()         const { return local;           }
	inline int   global_use_count() const { return in_use_globally; }
	inline crope name()             const { return my_name;         }

	/*
	 * Operators, primarily for use with the STL
	 */
	inline bool operator==(const tb_featuredesire &o) const {
	    return (id == o.id);
	}

	inline bool operator<(const tb_featuredesire &o) const {
	    return (id < o.id);
	}

	friend ostream &operator<<(ostream &o, const tb_featuredesire &fd);

	/*
	 * Functions for maintaining state for global FDs
	 */
	void add_global_user(int howmany = 1);
	void remove_global_user(int howmany = 1);



    private:
	/*
	 * This is private, so that we can force callers to go through the
	 * static get_featuredesire_obj function which uses the existing desire
	 * if there is one
	 */
	explicit tb_featuredesire(crope _my_name);

	// Globally unique identifier
	int id;

	// String name of this FD, used for debugging purposes only
	crope my_name;

	// Flags
	bool global;          // Whether this FD has global scope
	bool g_one_is_okay;   // If global, we can have one without penalty
	bool g_more_than_one; // If global, more than one doesn't incur
			      // additional penalty
	bool local;           // Whether this FD has local scope
	bool l_additive;      // If a local FD, is additive

	// Counts how many instances of this feature are in use across all
	// nodes - for use with global nodes
	int in_use_globally;

	typedef map<crope,tb_featuredesire*> name_featuredesire_map;
	static name_featuredesire_map featuredesires_by_name;
};

/*
 * This class stores information about a particular feature or desire for a
 * particular node, rather than global information about the feature or desire.
 */
class tb_node_featuredesire {
    public:
	tb_node_featuredesire(crope _name, double _weight);

	~tb_node_featuredesire() { ; }

	/*
	 * Operators, mostly for use with the STL
	 */
	const bool operator==(const tb_node_featuredesire &o) const {
	    // Note: Compares that two FDs are have the same name/ID, but NOT
	    // that they have the same weight - see equivalent() below for that
	    return(*featuredesire_obj == *(o.featuredesire_obj));
	}

	const bool operator<(const tb_node_featuredesire &o) const {
	    return(*featuredesire_obj < *(o.featuredesire_obj));
	}

	// Since we have to use == to compare names, for the STL's sake, this
	// function checks to make sure that the node-specific parts are
	// equivalent too
	const bool equivalent(const tb_node_featuredesire &o) const {
	    return ((*this == o) && (weight == o.weight) &&
		    (violateable == o.violateable));
	}

	/*
	 * Silly accesors
	 */
	inline const bool   is_violateable() const { return violateable; }
	inline const double cost()           const { return weight;      }

	/*
	 * Proxy functions for the stuff in tb_featuredesire
	 */
	const crope name()      const { return featuredesire_obj->name();      }
	const bool  is_local()  const { return featuredesire_obj->is_local();  }
	const bool  is_global() const { return featuredesire_obj->is_global(); }

	void add_global_user() const {
	    featuredesire_obj->add_global_user();
	}

	void remove_global_user() const {
	    featuredesire_obj->remove_global_user();
	}

    protected:

	double weight;
	bool violateable;
	tb_featuredesire *featuredesire_obj;
};

/*
 * Types to hold virtual nodes' sets of desires and physical nodes' sets of
 * features
 */
typedef set<tb_node_featuredesire> node_feature_set;
typedef set<tb_node_featuredesire> node_desire_set;
typedef set<tb_node_featuredesire> node_fd_set;

/*
 * Kind of like an iterator, but not quite - used for going through a virtual
 * node's desires and a physical node's features, and deterimining which are
 * only in one set, and which are in both
 */
class tb_featuredesire_set_iterator {
    public:
	/*
	 * Constructors
	 */
	tb_featuredesire_set_iterator(node_fd_set::iterator _begin1,
		node_fd_set::iterator _end1,
		node_fd_set::iterator _begin2,
		node_fd_set::iterator _end2);

	// Enum for indicating which set(s) an element belongs to
	typedef enum { FIRST_ONLY, SECOND_ONLY, BOTH } set_membership;

	// Return whether or not we've iterated to the end of both sets
	bool done() const;

	// If we have a membership() of BOTH, do they pass the equivalence
	// test?
	bool both_equiv() const;

	// Is either of the two elements violateable?
	bool either_violateable() const;

	// XXX - proper function protype
	void operator++(int);

	// Return the member of the set we're currently iterating to
	const tb_node_featuredesire &operator*() const {
	    return *current;
	}
	
	// Return the member of the set we're currently iterating to
	const tb_node_featuredesire *operator->() const {
	    return &*current;
	}

	// Return the set membership of the current element
	const set_membership membership() const {
	    return current_membership;
	}

    private:
	node_fd_set::iterator it1, end1;
	node_fd_set::iterator it2, end2;
	node_fd_set::iterator current;
	set_membership current_membership;
};

#endif
