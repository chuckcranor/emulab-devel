/*
 * ASSUMPTIONS:
 *  1. Any switch can get to any other switch either directly
 *     or via at most one other switch (star formation).
 */

// Note on variable names: BGL has generic 'edge' and 'vertex'.  When
// these are translated to 'tb_*' structures the variables end in
// r.  I.e. dst -> dstr.  dst is a node, and dstr is a tb_pnode or similar.
#include <limits.h>

// XXX - This needs to be replaced by something more generic, wchar is
// not always an integer.
#define WCHAR_MIN INT_MIN
#define WCHAR_MAX INT_MAX

#include <iostream.h>

#include <hash_map>
#include <rope>
#include <queue>
#include <slist>
#include <hash_set>

#include <boost/config.hpp>
#include <boost/utility.hpp>
#include <boost/property_map.hpp>
#include <boost/graph/graph_traits.hpp>
#include <boost/graph/adjacency_list.hpp>

using namespace boost;

#include "common.h"
#include "vclass.h"
#include "physical.h"
#include "virtual.h"
#include "pclass.h"
#include "score.h"

extern switch_pred_map_map switch_preds;

double score;			// The score of the current mapping
int violated;			// How many times the restrictions
				// have been violated.

violated_info vinfo;		// specific info on violations

extern tb_vgraph VG;		// virtual graph
extern tb_pgraph PG;		// physical grpaph
extern tb_sgraph SG;		// switch fabric

bool direct_link(pvertex a,pvertex b,pedge *edge);
void score_link(pedge e,vedge v);
void unscore_link(pedge e,vedge v);
bool find_link_to_switch(pvertex pv,pvertex switch_pv,pedge &out_edge);
int find_interswitch_path(pvertex src_pv,pvertex dest_pv,
			  int bandwidth,pedge_path &out_path,
			  pvertex_list &out_switches);
double fd_score(tb_vnode *vnode,tb_pnode *pnoder,int &out_fd_violated);

#ifdef SCORE_DEBUG_MORE
#define SADD(amount) cerr << "SADD: " << #amount << "=" << amount << " from " << score;score+=amount;cerr << " to " << score << endl
#define SSUB(amount)  cerr << "SSUB: " << #amount << "=" << amount << " from " << score;score-=amount;cerr << " to " << score << endl
#else
#define SADD(amount) score += amount
#define SSUB(amount) score -= amount
#endif

#ifdef SCORE_DEBUG
#define SDEBUG(a) a
#else
#define SDEBUG(a)
#endif

/*
 * score()
 * Returns the score.
 */
double get_score() {return score;}

/*
 * init_score()
 * This initialized the scoring system.  It also clears all
 * assignments.
 */
void init_score()
{
  SDEBUG(cerr << "SCORE: Initializing" << endl);
  score=0;
  violated=0;
  vinfo.unassigned = vinfo.pnode_load = 0;
  vinfo.no_connection = vinfo.link_users = vinfo.bandwidth = 0;

  vvertex_iterator vvertex_it,end_vvertex_it;
  tie(vvertex_it,end_vvertex_it) = vertices(VG);
  for (;vvertex_it!=end_vvertex_it;++vvertex_it) {
    tb_vnode *vnode=get(vvertex_pmap,*vvertex_it);
    vnode->assigned = false;
    SADD(SCORE_UNASSIGNED);
    vinfo.unassigned++;
    violated++;
  }
  vedge_iterator vedge_it,end_vedge_it;
  tie(vedge_it,end_vedge_it) = edges(VG);
  for (;vedge_it!=end_vedge_it;++vedge_it) {
    tb_vlink *vlink=get(vedge_pmap,*vedge_it);
    vlink->link_info.type=tb_link_info::LINK_UNKNOWN;
    vlink->no_connection=false;
  }
  pvertex_iterator pvertex_it,end_pvertex_it;
  tie(pvertex_it,end_pvertex_it) = vertices(PG);
  for (;pvertex_it!=end_pvertex_it;++pvertex_it) {
    tb_pnode *pn=get(pvertex_pmap,*pvertex_it);
    pn->typed=false;
    pn->current_load=0;
    pn->pnodes_used=0;
    pn->switch_used_links=0;
  }
  pedge_iterator pedge_it,end_pedge_it;
  tie(pedge_it,end_pedge_it) = edges(PG);
  for (;pedge_it!=end_pedge_it;++pedge_it) {
    tb_plink *plink=get(pedge_pmap,*pedge_it);
    plink->bw_used=0;
    plink->emulated=0;
    plink->nonemulated=0;
  }

  SDEBUG(cerr << "  score=" << score << " violated=" << violated << endl);
}

/*
 * This removes a virtual node from the assignments, adjusting
 * the score appropriately.
 */
void remove_node(vvertex vv)
{
  /* Find pnode assigned to */
  tb_vnode *vnode = get(vvertex_pmap,vv);
  tb_pnode *pnode = get(pvertex_pmap,vnode->assignment);

  SDEBUG(cerr <<  "SCORE: remove_node(" << vnode->name << ")" << endl);
  SDEBUG(cerr <<  "  assignment=" << pnode->name << endl);
#ifdef SCORE_DEBUG_LOTS
  cerr << *vnode;
  cerr << *pnode;
#endif

  assert(pnode != NULL);

  pclass_unset(pnode);

  // pclass
  if (pnode->my_class->used == 0) {
    SDEBUG(cerr << "  freeing pclass" << endl);
    SSUB(SCORE_PCLASS);
  }

  // vclass
  if (vnode->vclass != NULL) {
    double score_delta = vnode->vclass->unassign_node(vnode->type);
    SDEBUG(cerr << "  vclass unassign " << score_delta << endl);
    
    if (score_delta <= -1) {
      violated--;
      vinfo.vclass--;
    }
    SSUB(-score_delta*SCORE_VCLASS);
  }
  
  // remove the scores associated with each edge
  voedge_iterator vedge_it,end_vedge_it;
  tie(vedge_it,end_vedge_it) = out_edges(vv,VG);
  for (;vedge_it!=end_vedge_it;++vedge_it) {
    tb_vlink *vlink = get(vedge_pmap,*vedge_it);
    vvertex dest_vv = target(*vedge_it,VG);
    if (dest_vv == vv)
      dest_vv = source(*vedge_it,VG);
    tb_vnode *dest_vnode = get(vvertex_pmap,dest_vv);
    SDEBUG(cerr << "  edge to " << dest_vnode->name << endl);

    if (vlink->no_connection) {
      SDEBUG(cerr << "  link no longer in violation.\n";)
      SSUB(SCORE_NO_CONNECTION);
      vlink->no_connection=false;
      vinfo.no_connection--;
      violated--;
    }
    
    if (! dest_vnode->assigned) continue;
    
    if (vlink->link_info.type == tb_link_info::LINK_DIRECT) {
      // DIRECT LINK
      SDEBUG(cerr << "   direct link" << endl);
      unscore_link(vlink->link_info.plinks.front(),*vedge_it);
      vlink->link_info.plinks.clear();
    } else if (vlink->link_info.type == tb_link_info::LINK_INTERSWITCH) {
      // INTERSWITCH LINK
      SDEBUG(cerr << "  interswitch link" << endl);

      pedge_path &path = vlink->link_info.plinks;
      SSUB(SCORE_INTERSWITCH_LINK);
      for (pedge_path::iterator it=path.begin();
	   it != path.end();++it) {
	unscore_link(*it,*vedge_it);
      }
      path.clear();
      for (pvertex_list::iterator it = vlink->link_info.switches.begin();
	   it != vlink->link_info.switches.end();++it) {
	tb_pnode *the_switch = get(pvertex_pmap,*it);
	if (--the_switch->switch_used_links == 0) {
	  SDEBUG(cerr << "  releasing switch" << endl);
	  SSUB(SCORE_SWITCH);
	}
      }
      vlink->link_info.switches.clear();
    } else if (vlink->link_info.type == tb_link_info::LINK_INTRASWITCH) {
      // INTRASWITCH LINK
      SDEBUG(cerr << "   intraswitch link" << endl);
      SSUB(SCORE_INTRASWITCH_LINK);

      unscore_link(vlink->link_info.plinks.front(),*vedge_it);
      unscore_link(vlink->link_info.plinks.back(),*vedge_it);
      vlink->link_info.plinks.clear();
      tb_pnode *the_switch = get(pvertex_pmap,
				 vlink->link_info.switches.front());
      if (--the_switch->switch_used_links == 0) {
	SDEBUG(cerr << "  releasing switch" << endl);
	SSUB(SCORE_SWITCH);
      }
      vlink->link_info.switches.clear();
    }
  }

  // adjust pnode scores
  pnode->current_load--;
  vnode->assigned = false;
  if (pnode->current_load == 0) {
    // release pnode
    SDEBUG(cerr << "  releasing pnode" << endl);
    SSUB(SCORE_PNODE);
    
    // revert pnode type
    pnode->typed=false;
  } else if (pnode->current_load >= pnode->max_load) {
    SDEBUG(cerr << "  reducing penalty, new load=" << pnode->current_load <<
	   " (>= " << pnode->max_load << ")" << endl);
    SSUB(SCORE_PNODE_PENALTY);
    vinfo.pnode_load--;
    violated--;
  }

  // add score for unassigned node
  SADD(SCORE_UNASSIGNED);
  vinfo.unassigned++;
  violated++;

  // features/desires
  int fd_violated;
  double fds=fd_score(vnode,pnode,fd_violated);
  SSUB(fds);
  violated -= fd_violated;
  vinfo.desires -= fd_violated;

  
#ifdef SCORE_DEBUG_LOTS
  cerr << *vnode;
  cerr << *pnode;
#endif
  SDEBUG(cerr << "  new score = " << score << " new violated = " << violated << endl);
}

/*
 * int add_node(node node,int ploc)
 * Add a mapping of node to ploc and adjust score appropriately.
 * Returns 1 in the case of an incompatible mapping.  This should
 * never happen as the same checks should be in place in a higher
 * level.  (Optimization?)
 */
int add_node(vvertex vv,pvertex pv)
{
  tb_vnode *vnode = get(vvertex_pmap,vv);
  tb_pnode *pnode = get(pvertex_pmap,pv);

  SDEBUG(cerr << "SCORE: add_node(" << vnode->name << "," <<
	 pnode->name << ")" << endl);
#ifdef SCORE_DEBUG_LOTS
  cerr << *vnode;
  cerr << *pnode;
#endif
  SDEBUG(cerr << "  vnode type = " << vnode->type << endl);
  
  // set up pnode
  // figure out type
  if (!pnode->typed) {
    SDEBUG(cerr << "  virgin pnode" << endl);
    SDEBUG(cerr << "    vtype = " << vnode->type << endl);

    // Remove check assuming at higher level?
    // Remove higher level checks?
    pnode->max_load=0;
    if (pnode->types.find(vnode->type) != pnode->types.end()) {
      pnode->max_load = pnode->types[vnode->type];
    }
    if (pnode->max_load == 0) {
      // didn't find a type
      SDEBUG(cerr << "  no matching type" << endl);
      return 1;
    }
    
    pnode->current_type=vnode->type;
    pnode->typed=true;

    SDEBUG(cerr << "  matching type found (" <<pnode->current_type <<
	   ", max = " << pnode->max_load << ")" << endl);
  } else {
    SDEBUG(cerr << "  pnode already has type" << endl);
    if (pnode->current_type != vnode->type) {
      SDEBUG(cerr << "  incompatible types" << endl);
      return 1;
    } else {
      SDEBUG(cerr << "  comaptible types" << endl);
      if (pnode->current_load == pnode->max_load) {
	/* XXX - We could ignore this check and let the code
	   at the end of the routine penalize for going over
	   load.  Failing here seems to work better though. */

	// XXX is this a bug?  do we need to revert the pnode/vnode to
	// it's initial state.
	SDEBUG(cerr << "  node is full" << endl);
	return 1;
      }
    }
  }
  
  // set up links
  voedge_iterator vedge_it,end_vedge_it;
  tie(vedge_it,end_vedge_it) = out_edges(vv,VG);	    
  for (;vedge_it!=end_vedge_it;++vedge_it) {
    tb_vlink *vlink = get(vedge_pmap,*vedge_it);
    vvertex dest_vv = target(*vedge_it,VG);
    if (dest_vv == vv)
      dest_vv = source(*vedge_it,VG);
    tb_vnode *dest_vnode = get(vvertex_pmap,dest_vv);

    pedge pe;
    
    SDEBUG(cerr << "  edge to " << dest_vnode->name << endl);

    if (dest_vnode->assigned) {
      pvertex dest_pv = dest_vnode->assignment;
      tb_pnode *dest_pnode = get(pvertex_pmap,dest_pv);

      SDEBUG(cerr << "   goes to " << dest_pnode->name << endl);

      if (dest_pv == pv) {
	SDEBUG(cerr << "  trivial link" << endl);
	vlink->link_info.type = tb_link_info::LINK_TRIVIAL;
      } else {
	SDEBUG(cerr << "  finding link resolutions" << endl);
	// We need to calculate all possible link resolutions, stick them
	// in a nice datastructure along with their weights, and then
	// select one randomly.
	typedef vector<tb_link_info> resolution_vector;
	typedef vector<pvertex_list> switchlist_vector;

	resolution_vector resolutions(10);
	int resolution_index = 0;
	float total_weight = 0;
	
	// Direct link
	if (direct_link(dest_pv,pv,&pe)) {
	  resolutions[resolution_index].type = tb_link_info::LINK_DIRECT;
	  resolutions[resolution_index].plinks.push_back(pe);
	  resolution_index++;
	  total_weight += LINK_RESOLVE_DIRECT;
	  SDEBUG(cerr << "    direct_link " << pe << endl);
	}
	// Intraswitch link
	pedge first,second;
	for (pvertex_set::iterator switch_it = pnode->switches.begin();
	     switch_it != pnode->switches.end();++switch_it) {
	  if (dest_pnode->switches.find(*switch_it) != 
	      dest_pnode->switches.end()) {
	    find_link_to_switch(pv,*switch_it,first);
	    find_link_to_switch(dest_pv,*switch_it,second);
	    resolutions[resolution_index].type = tb_link_info::LINK_INTRASWITCH;
	    resolutions[resolution_index].plinks.push_back(first);
	    resolutions[resolution_index].plinks.push_back(second);
	    resolutions[resolution_index].switches.push_front(*switch_it);
	    resolution_index++;
	    total_weight += LINK_RESOLVE_INTRASWITCH;
	    SDEBUG(cerr << "    intraswitch " << first << " and " << second << endl);
	  }
	}
	// Interswitch paths
	for (pvertex_set::iterator source_switch_it = pnode->switches.begin();
	     source_switch_it != pnode->switches.end();
	     ++source_switch_it) {
	  for (pvertex_set::iterator dest_switch_it = dest_pnode->switches.begin();
	       dest_switch_it != dest_pnode->switches.end();
	       ++dest_switch_it) {
	    if (*source_switch_it == *dest_switch_it) continue;
	    if (find_interswitch_path(*source_switch_it,*dest_switch_it,vlink->bandwidth,
				      resolutions[resolution_index].plinks,
				      resolutions[resolution_index].switches) != 0) {
	      resolutions[resolution_index].type = tb_link_info::LINK_INTERSWITCH;
	      find_link_to_switch(pv,*source_switch_it,first);
	      find_link_to_switch(dest_pv,*dest_switch_it,second);
	      resolutions[resolution_index].plinks.push_front(first);
	      resolutions[resolution_index].plinks.push_back(second);
	      resolution_index++;
	      total_weight += LINK_RESOLVE_INTERSWITCH;
	      SDEBUG(cerr << "    interswitch " <<
		     get(pvertex_pmap,*source_switch_it)->name << " and " <<
		     get(pvertex_pmap,*dest_switch_it)->name << endl);
	    }
	  }
	}

	// check for no link
	if (resolution_index == 0) {
	  SDEBUG(cerr << "  Could not find any resolutions." << endl);
	  SADD(SCORE_NO_CONNECTION);
	  vlink->no_connection=true;
	  vinfo.no_connection++;
	  violated++;
	} else {
	  // Check to see if we are fixing a violation
	  if (vlink->no_connection) {
	    SDEBUG(cerr << "  Fixing previous violations." << endl);
	    SSUB(SCORE_NO_CONNECTION);
	    vlink->no_connection=false;
	    vinfo.no_connection--;
	    violated--;
	  }
	  
	  // Choose a link
	  float choice = std::random()%(int)total_weight;
	  int index;
	  tb_pnode *the_switch;
	  for (index = 0;index < resolution_index;++index) {
	    switch (resolutions[index].type) {
	    case tb_link_info::LINK_DIRECT:
	      choice -= LINK_RESOLVE_DIRECT; break;
	    case tb_link_info::LINK_INTRASWITCH:
	      choice -= LINK_RESOLVE_INTRASWITCH; break;
	    case tb_link_info::LINK_INTERSWITCH:
	      choice -= LINK_RESOLVE_INTERSWITCH; break;
	    case tb_link_info::LINK_UNKNOWN:
	    case tb_link_info::LINK_TRIVIAL:
	      cerr << "Internal error: Should not be here." << endl;
	      exit(1);
	      break;
	    }
	    if (choice < 0) break;
	  }
	  vlink->link_info = resolutions[index];
	  SDEBUG(cerr << "  choice:" << vlink->link_info;)
	    switch (vlink->link_info.type) {
	    case tb_link_info::LINK_DIRECT:
	      SADD(SCORE_DIRECT_LINK);
	      score_link(vlink->link_info.plinks.front(),*vedge_it);
	      break;
	    case tb_link_info::LINK_INTRASWITCH:
	      SADD(SCORE_INTRASWITCH_LINK);
	      score_link(vlink->link_info.plinks.front(),*vedge_it);
	      score_link(vlink->link_info.plinks.back(),*vedge_it);
	      the_switch = get(pvertex_pmap,
			       vlink->link_info.switches.front());
	      if (++the_switch->switch_used_links == 1) {
		SDEBUG(cerr << "  new switch" << endl);
		SADD(SCORE_SWITCH);
	      }
	      break;
	    case tb_link_info::LINK_INTERSWITCH:
	      SADD(SCORE_INTERSWITCH_LINK);
	      for (pedge_path::iterator plink_It = vlink->link_info.plinks.begin();
		   plink_It != vlink->link_info.plinks.end();
		   ++plink_It) {
		score_link(*plink_It,*vedge_it);
	      }
	      for (pvertex_list::iterator switch_it = vlink->link_info.switches.begin();
		   switch_it != vlink->link_info.switches.end();++switch_it) {
		the_switch = get(pvertex_pmap,*switch_it);
		if (++the_switch->switch_used_links == 1) {
		  SDEBUG(cerr << "  new switch" << endl);
		  SADD(SCORE_SWITCH);
		}
	      }
	      break;
	    case tb_link_info::LINK_UNKNOWN:
	    case tb_link_info::LINK_TRIVIAL:
	      cerr << "Internal error: Should not be here either." << endl;
	      exit(1);
	      break;
	    }
	}
      }
    }
  }
  
  // finish setting up pnode
  pnode->current_load++;

  vnode->assignment = pv;
  vnode->assigned = true;
  if (pnode->current_load > pnode->max_load) {
    SDEBUG(cerr << "  load to high - penalty (" << pnode->current_load <<
	   ")" << endl);
    SADD(SCORE_PNODE_PENALTY);
    vinfo.pnode_load++;
    violated++;
  } else {
    SDEBUG(cerr << "  load is fine" << endl);
  }
  if (pnode->current_load == 1) {
    SDEBUG(cerr << "  new pnode" << endl);
    SADD(SCORE_PNODE);
  }

  // node no longer unassigned
  SSUB(SCORE_UNASSIGNED);
  vinfo.unassigned--;
  violated--;

  // features/desires
  int fd_violated;
  double fds = fd_score(vnode,pnode,fd_violated);
  SADD(fds);
  violated += fd_violated;
  vinfo.desires += fd_violated;

  // pclass
  if (pnode->my_class->used == 0) {
    SDEBUG(cerr << "  new pclass" << endl);
    SADD(SCORE_PCLASS);
  }

  // vclass
  if (vnode->vclass != NULL) {
    double score_delta = vnode->vclass->assign_node(vnode->type);
    SDEBUG(cerr << "  vclass assign " << score_delta << endl);
    SADD(score_delta*SCORE_VCLASS);
    if (score_delta >= 1) {
      violated++;
      vinfo.vclass++;
    }
  }

#ifdef SCORE_DEBUG_LOTS
  cerr << *vnode;
  cerr << *pnode;
#endif
  SDEBUG(cerr << "  assignment=" << vnode->assignment << endl);
  SDEBUG(cerr << "  new score=" << score << " new violated=" << violated << endl);
  
  pclass_set(vnode,pnode);
  
  return 0;
  }

// returns "best" direct link between a and b.
// best = less users
//        break ties with minimum bw_used
bool direct_link(pvertex a,pvertex b,pedge *edge)
{
  pvertex dest_pv;
  pedge best_pedge;
  tb_plink *plink;
  tb_plink *best_plink = NULL;
  poedge_iterator pedge_it,end_pedge_it;
  tie(pedge_it,end_pedge_it) = out_edges(a,PG);
  for (;pedge_it!=end_pedge_it;++pedge_it) {
    dest_pv = target(*pedge_it,PG);
    if (dest_pv == a)
      dest_pv = source(*pedge_it,PG);
    if (dest_pv == b) {
      plink = get(pedge_pmap,*pedge_it);
      if (! best_plink ||
	  ((plink->emulated+plink->nonemulated <
	    best_plink->emulated+best_plink->nonemulated) ||
	   (plink->emulated+plink->nonemulated ==
	    best_plink->emulated+best_plink->nonemulated) &&
	   (plink->bw_used < best_plink->bw_used))) {
	best_pedge = *pedge_it;
	best_plink = plink;
      }
    }
  }
  if (best_plink == NULL) return false;
  *edge = best_pedge;
  return true;
}

bool find_link_to_switch(pvertex pv,pvertex switch_pv,pedge &out_edge)
{
  pvertex dest_pv;
  float best_bw=1000.0;
  int best_users = 1000;
  float bw;
  pedge best_pedge;
  bool found_best=false;
  poedge_iterator pedge_it,end_pedge_it;
  tie(pedge_it,end_pedge_it) = out_edges(pv,PG);
  for (;pedge_it!=end_pedge_it;++pedge_it) {
    dest_pv = target(*pedge_it,PG);
    if (dest_pv == pv)
      dest_pv = source(*pedge_it,PG);
    if (dest_pv == switch_pv) {
      tb_plink *plink = get(pedge_pmap,*pedge_it);
      bw = plink->bw_used / plink->bandwidth;
      if ((plink->emulated+plink->nonemulated < best_users) ||
	  ((plink->emulated+plink->nonemulated == best_users) &&
	   (bw < best_bw))) {
	best_pedge = *pedge_it;
	found_best = true;
	best_bw = bw;
	best_users = plink->emulated+plink->nonemulated;
      }
    }
  }

  if (found_best) {
    out_edge = best_pedge;
    return true;
  } else {
    return false;
  }
}

// this uses the shortest paths calculated over the switch graph to
// find a path between src and dst.  It passes out list<edge>, a list
// of the edges used. (assumed to be empty to begin with).
// Returns 0 if no path exists and 1 otherwise.
int find_interswitch_path(pvertex src_pv,pvertex dest_pv,
			  int bandwidth,pedge_path &out_path,
			  pvertex_list &out_switches)
{
  // We know the shortest path from src to node already.  It's stored
  // in switch_preds[src] and is a node_array<edge>.  Let P be this
  // array.  We can trace our shortest path by starting at the end and
  // following the pred edges back until we reach src.  We need to be
  // careful though because the switch_preds deals with elements of SG
  // and we have elements of PG.

  svertex src_sv = get(pvertex_pmap,src_pv)->sgraph_switch;
  svertex dest_sv = get(pvertex_pmap,dest_pv)->sgraph_switch;

  sedge current_se;
  svertex current_sv = dest_sv;
  switch_pred_map &preds = *switch_preds[src_sv];
  
  if (preds[dest_sv] == dest_sv) {
    // unreachable
    return 0;
  }
  while (current_sv != src_sv) {
    out_switches.push_front(current_sv);
    current_se = edge(current_sv,preds[current_sv],SG).first;
    out_path.push_back(get(sedge_pmap,current_se)->mate);
    current_sv = preds[current_sv];
  }
  out_switches.push_front(current_sv);
  return 1;
}

// this does scoring for over users and over bandwidth on edges.
void score_link(pedge pe,vedge ve)
{
  tb_plink *plink = get(pedge_pmap,pe);
  tb_vlink *vlink = get(vedge_pmap,ve);

  SDEBUG(cerr << "  score_link(" << pe << ") - " << plink->name << " / " <<
	 vlink->name << endl);

  if (! plink->interswitch) {
    // need too account for three things here, the possiblity of a new plink
    // the user of a new emulated link, and a possible violation.
    if (vlink->emulated) {
      plink->emulated++;
      SADD(SCORE_EMULATED_LINK);
    }
    else plink->nonemulated++;
    if (plink->nonemulated+plink->emulated == 1) {
      // new link
      SDEBUG(cerr << "    first user" << endl);
      SADD(SCORE_DIRECT_LINK);
    } else {
      // check for violation, basically if this is the first of it's
      // type to be added.
      if (((! vlink->emulated) && (plink->nonemulated == 1)) ||
	  ((vlink->emulated) && (plink->emulated == 1))) {
	SDEBUG(cerr << "    link user - penalty" << endl);
	SADD(SCORE_DIRECT_LINK_PENALTY);
	vinfo.link_users++;
	violated++;
      }
    }
  }
    
  // bandwidth
  int prev_bw = plink->bw_used;
  plink->bw_used += vlink->bandwidth;
  if ((plink->bw_used > plink->bandwidth) &&
      (prev_bw <= plink->bandwidth)) {
    SDEBUG(cerr << "    went over bandwidth (" << plink->bw_used << " > " <<
	   plink->bandwidth << ")" << endl);
    violated++;
    vinfo.bandwidth++;
    SADD(SCORE_OVER_BANDWIDTH);
  }
}

void unscore_link(pedge pe,vedge ve)
{
  tb_plink *plink = get(pedge_pmap,pe);
  tb_vlink *vlink = get(vedge_pmap,ve);
  
  SDEBUG(cerr << "  unscore_link(" << pe << "," << ve << ")" << endl);

  if (!plink->interswitch) {
    if (vlink->emulated) {
      plink->emulated--;
      SSUB(SCORE_EMULATED_LINK);
    } else {
      plink->nonemulated--;
    }
    if (plink->nonemulated+plink->emulated == 0) {
      // link no longer used
      SDEBUG(cerr << "   freeing link" << endl);
      SSUB(SCORE_DIRECT_LINK);
    } else {
      // check to see if re freed up a violation, basically did
      // we remove the last of it's link type.
      if ((vlink->emulated && (plink->emulated == 0)) ||
	  ((! vlink->emulated) && plink->nonemulated == 0)) {
	// all good
	SDEBUG(cerr << "   users ok" << endl);
	SSUB(SCORE_DIRECT_LINK_PENALTY);
	vinfo.link_users--;
	violated--;
      }
    }
  }
  
  // bandwidth check
  int prev_bw = plink->bw_used;
  plink->bw_used -= vlink->bandwidth;
  if ((plink->bw_used <= plink->bandwidth) &&
      (prev_bw > plink->bandwidth)) {
    SDEBUG(cerr << "   went under bandwidth (" << plink->bw_used << " <= " <<
	   plink->bandwidth << ")" << endl);
    violated--;
    vinfo.bandwidth--;
    SSUB(SCORE_OVER_BANDWIDTH);
  }

  vlink->link_info.type = tb_link_info::LINK_UNKNOWN;
}

double fd_score(tb_vnode *vnode,tb_pnode *pnode,int &fd_violated)
{
  double fd_score=0;
  fd_violated=0;

  double value;
  tb_vnode::desires_map::iterator desire_it;
  tb_pnode::features_map::iterator feature_it;
  for (desire_it = vnode->desires.begin();
       desire_it != vnode->desires.end();
       desire_it++) {
    feature_it = pnode->features.find((*desire_it).second);
    SDEBUG(cerr << "  desire = " << (*desire_it).first << " " <<
	   (*desire_it).second << endl);

    if (feature_it == pnode->features.end()) {
      // Unmatched desire.  Add cost.
      SDEBUG(cerr << "    unmatched" << endl);
      value = (*desire_it).second;
      fd_score += SCORE_DESIRE*value;
      if (value >= 1) {
	fd_violated++;
      }
    }
  }
  for (feature_it = pnode->features.begin();
       feature_it != pnode->features.end();++feature_it) {
    desire_it = vnode->desires.find((*feature_it).second);
    SDEBUG(cerr << "  feature = " << (*feature_it).first
	   << " " << (*feature_it).second << endl);

    if (desire_it == vnode->desires.end()) {
      // Unused feature.  Add weight
      SDEBUG(cerr << "    unused" << endl);
      value = (*feature_it).second;
      fd_score+=SCORE_FEATURE*value;
    }
  }

  return fd_score;
}
