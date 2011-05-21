/*
 * EMULAB-COPYRIGHT
 * Copyright (c) 2000-2010 University of Utah and the Flux Group.
 * All rights reserved.
 */

#ifndef __PCLASS_H
#define __PCLASS_H

#include <map>

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
public:
  tb_pclass() : name(), size(0), used_members(0), disabled(false), refcount(0),
    is_dynamic(false) {;}

  typedef map<fstring,tb_pnodelist*> pclass_members_map;
  typedef hash_set<tb_pnode*,hashptr<tb_pnode*> > tb_pnodeset;
  typedef hash_map<fstring,tb_pnodeset*> pclass_members_set;

  int add_member(tb_pnode *p, bool is_own_class);

  fstring name;			// purely for debugging
  int size;
  int used_members;
  pclass_members_map members;

  bool disabled;

  // A count of how many nodes can use this pclass
  // For use with PRUNE_PCLASSES
  int refcount;

  // Is this a dynamic plcass? If false, it's a "real" one
  bool is_dynamic;

  friend ostream &operator<<(ostream &o, const tb_pclass& p)
  {
    o << p.name << " size=" << p.size <<
      " used_members=" << p.used_members << " disabled=" << p.disabled <<
      " is_dynamic=" << p.is_dynamic << "\n";
    pclass_members_map::const_iterator dit;
    for (dit=p.members.begin();dit!=p.members.end();++dit) {
      o << "  " << (*dit).first << ":\n";
      o << *((*dit).second) << endl;
    }
    o << endl;
    return o;
  }
};

typedef list<tb_pclass*> pclass_list;
typedef vector<tb_pclass*> pclass_vector;
typedef pair<int,pclass_vector*> tt_entry;
typedef hash_map<fstring,tt_entry> pclass_types;

/* Constants */
#define PCLASS_BASE_WEIGHT 1
#define PCLASS_NEIGHBOR_WEIGHT 1
#define PCLASS_UTIL_WEIGHT 1
#define PCLASS_FDS_WEIGHT 2

/* routines defined in pclass.cc */
// Sets pclasses and type_table globals -
// Takes two arguments - a physical graph, and a flag indicating whether or not
// each physical node should get its own pclass (effectively disabling
// pclasses)
int generate_pclasses(tb_pgraph &PG, bool pclass_for_each_pnode,
	bool dynamic_pclasses);

/* The following two routines sets and remove mappings in pclass
   datastructures */
int pclass_set(tb_vnode *v,tb_pnode *p);
int pclass_unset(tb_pnode *p);

// This should be called when the pnode becomes free (and pclass_unset should
// still be called first)
int pclass_reset_maps(tb_pnode *p); 

void pclass_debug();

int count_enabled_pclasses();

#endif
