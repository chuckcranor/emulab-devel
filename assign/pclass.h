/*
 * EMULAB-COPYRIGHT
 * Copyright (c) 2000-2010 University of Utah and the Flux Group.
 * All rights reserved.
 */

#ifndef __PCLASS_H
#define __PCLASS_H

#include <map>

/* Structures containing pclasses */
typedef list<tb_pclass*> pclass_list;
typedef vector<tb_pclass*> pclass_vector;
typedef pair<int,pclass_vector*> tt_entry;
typedef hash_map<fstring,tt_entry> pclass_types;

/* Constants */
#define PCLASS_BASE_WEIGHT 1
#define PCLASS_NEIGHBOR_WEIGHT 1
#define PCLASS_UTIL_WEIGHT 1
#define PCLASS_FDS_WEIGHT 2

/*
 * Defined in assign.cc - indicates whether or not we should use pclasses
 */
extern bool use_pclasses;

/*
 * tb pnode list is a data structure that acts like list but has
 * O(1) removal.  It is a list of tb_pnode*.
 */
class tb_pnodelist {

public:
	/*
	 * These have to be public so that others can declare iterators
	 */
	typedef list<tb_pnode*> pnode_list;
	typedef pnode_list::iterator list_iter;
	

	/*
	 * These do the same thing as the standard list functions
	 */
	list_iter begin();
	list_iter end();	
	list_iter push_front(tb_pnode *p);
	list_iter push_back(tb_pnode *p);
	int remove(tb_pnode *p);
	int exists(tb_pnode *p);
	tb_pnode *front();
	int size();
	
	/*
	 * For debugging - print out the whole list
	 */
	friend ostream &operator<<(ostream &o, const tb_pnodelist& l);
		
private:
	pnode_list L;
	typedef hash_map<tb_pnode*,list_iter,hashptr<tb_pnode*> > pnode_iter_map;
	pnode_iter_map D;


};

class tb_pclass {

	/*
	 * Functions that are not part of the class, but which operate on tb_pclass
	 * objects. Defined in pclass.cc
	 */
	
	// Sets pclasses and type_table globals -
	// Takes two arguments - a physical graph, and a flag indicating whether or not
	// each physical node should get its own pclass (effectively disabling
	// pclasses)
	friend int generate_pclasses(tb_pgraph &PG, bool pclass_for_each_pnode,
		bool dynamic_pclasses);

	/* The following two routines sets and remove mappings in pclass
	   datastructures */
	friend int pclass_set(tb_vnode *v,tb_pnode *p);
	friend int pclass_unset(tb_pnode *p);

	// This should be called when the pnode becomes free (and pclass_unset should
	// still be called first)
	friend int pclass_reset_maps(tb_pnode *p); 

	// Print out gobs of debugging information
	friend void pclass_debug();

	// Does exactly what it says
	friend int count_enabled_pclasses();
	
	// Checks to make that nodes are in 'own' classes (used with dynamic
	// pclasses) XOR their regular pclass - if a node is in both at the same
	// time (or neither), this is a bug
	friend void assert_own_class_invariant(tb_pnode *p);
	
	// From neighborhood.h - not ideal to make this a friend, but it lets me
	// avoid exposing member iterators to the outside
	friend tb_pnode *find_pnode(tb_vnode *vn, bool allow_overload);

public:
	/*
	 * Member functions
	 */
	explicit tb_pclass(fstring _name) : name(_name), size(0), used_members(0),
		disabled(false), refcount(0), dynamic(false) {;}

	typedef map<fstring,tb_pnodelist*> pclass_members_map;
	typedef pclass_members_map::const_iterator iterator;
	typedef hash_set<tb_pnode*,hashptr<tb_pnode*> > tb_pnodeset;
	typedef hash_map<fstring,tb_pnodeset*> pclass_members_set;

	// Add a member to the class - is this a pclass that is a 'private' class
	// for an individual node?
	int add_member(tb_pnode *p, bool is_own_class);
	
	// Indicate that a node can use this pclass
	void add_ref();

	// True if at least one node can use this pclass
	bool is_referenced() const;
	
	// True if any members of this pclass are in use
	bool any_used_members() const;
	
	// True if this is a dynamic (AKA 'self', or 'private') pclass
	bool is_dynamic() const;
	
	// True if the pclass has been disabled
	bool is_disabled() const;
	
	// Get a node of a particular type - can return an arbitrary node
	tb_pnode *get_node_of_type(fstring);
	
	// Does the pclass have at least one member of this type?
	bool has_member_of_type(fstring);
	
	// Iterators
	iterator begin() const;
	iterator end() const;

private:

	// Purely for debugging
	fstring name;

	// How many nodes are members, and how many of those have been used?
	int size;
	int used_members;
	
	// Members - indexed by type
	pclass_members_map members;

	// This is used when doing dynamic pclasses - we disable dynamic pclasses
	// when the only member is acting as a member of its 'regular' pclass
	bool disabled;

	// A count of how many nodes can use this pclass
	// For use with PRUNE_PCLASSES
	int refcount;

	// Is this a dynamic plcass? If false, it's a "real" one
	bool dynamic;

	// For debugging
	friend ostream &operator<<(ostream &o, const tb_pclass& p);
};

/*
 * Yes, you have to delcare friend functions twice; rather lame
 */
int generate_pclasses(tb_pgraph &PG, bool pclass_for_each_pnode,
	bool dynamic_pclasses);
void pclass_debug();
int pclass_set(tb_vnode *v,tb_pnode *p);
int pclass_unset(tb_pnode *p);
int pclass_reset_maps(tb_pnode *p); 
int count_enabled_pclasses();
void assert_own_class_invariant(tb_pnode *p);

#endif
