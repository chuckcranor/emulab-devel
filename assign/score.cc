#include "port.h"

#include <stdlib.h>
#include <iostream.h>
#include <float.h>

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
#include "delay.h"
#include "physical.h"
#include "virtual.h"
#include "pclass.h"
#include "score.h"

extern switch_pred_map_map switch_preds;
extern name_pvertex_map pname2vertex;
extern name_vvertex_map vname2vertex;

double score;			// The score of the current mapping
int violated;			// How many times the restrictions
				// have been violated.

violated_info vinfo;		// specific info on violations

extern tb_vgraph VG;		// virtual graph
extern tb_pgraph PG;		// physical grpaph
extern tb_sgraph SG;		// switch fabric

extern vvertex_set delay_nodes;	// What delay nodes exist

bool direct_link(pvertex a,pvertex b,tb_vlink *vlink,pedge &edge);
void score_link(pedge pe,vedge ve);
void unscore_link(pedge pe,vedge ve);
bool find_link_to_switch(pvertex pv,pvertex switch_pv,tb_vlink *vlink,
			 pedge &out_edge);
int find_interswitch_path(pvertex src_pv,pvertex dest_pv,
			  int bandwidth,pedge_path &out_path,
			  pvertex_list &out_switches);
double fd_score(tb_vnode *vnode,tb_pnode *pnoder,int &out_fd_violated);
void score_link_info(vedge ve);
void unscore_link_info(vedge ve);
void remove_delay_node(vvertex delayv);
vvertex make_delay_node(vedge ve);

// defined in assign.cc
tb_pnode *find_pnode(tb_vnode *vn);
  
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

/* unscore_link_info(vedge ve)
 * This routine is the highest level link scorer.  It handles all
 * scoring that depends on the link_info of vlink.
 */
void unscore_link_info(vedge ve)
{
  tb_vlink *vlink = get(vedge_pmap,ve);
  if (vlink->link_info.type == tb_link_info::LINK_DIRECT) {
    // DIRECT LINK
    SDEBUG(cerr << "   direct link" << endl);
    unscore_link(vlink->link_info.plinks.front(),ve);
    vlink->link_info.plinks.clear();
  } else if (vlink->link_info.type == tb_link_info::LINK_INTERSWITCH) {
    // INTERSWITCH LINK
    SDEBUG(cerr << "  interswitch link" << endl);
    
    pedge_path &path = vlink->link_info.plinks;
    SSUB(SCORE_INTERSWITCH_LINK);
    for (pedge_path::iterator it=path.begin();
	 it != path.end();++it) {
      unscore_link(*it,ve);
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
    
    unscore_link(vlink->link_info.plinks.front(),ve);
    unscore_link(vlink->link_info.plinks.back(),ve);
    vlink->link_info.plinks.clear();
    tb_pnode *the_switch = get(pvertex_pmap,
			       vlink->link_info.switches.front());
    if (--the_switch->switch_used_links == 0) {
      SDEBUG(cerr << "  releasing switch" << endl);
      SSUB(SCORE_SWITCH);
    }
    vlink->link_info.switches.clear();
  } else if (vlink->link_info.type == tb_link_info::LINK_DELAYED) {
    SDEBUG(cerr << "    delayed link" << endl);
    SSUB(SCORE_DELAYED_LINK);
  }
  vlink->link_info.type = tb_link_info::LINK_UNKNOWN;
}
/*
 * This removes a virtual node from the assignments, adjusting
 * the score appropriately.  If removal is non NULL then it stores
 * a record of the removal in removal.
 */
void remove_node(vvertex vv,tb_removal_record *removal)
{
  /* Find pnode assigned to */
  tb_vnode *vnode = get(vvertex_pmap,vv);
  pvertex pv = vnode->assignment;
  tb_pnode *pnode = get(pvertex_pmap,pv);

  SDEBUG(cerr <<  "SCORE: remove_node(" << vnode->name << ")" << endl);
  SDEBUG(cerr <<  "  assignment=" << pnode->name << endl);
#ifdef SCORE_DEBUG_LOTS
  cerr << *vnode;
  cerr << *pnode;
#endif

  assert(pnode != NULL);

  if (removal) {
    removal->assignment = pv;
  }
  
  // remove the scores associated with each edge
  voedge_iterator vedge_it,end_vedge_it;
  tie(vedge_it,end_vedge_it) = out_edges(vv,VG);
  for (;vedge_it!=end_vedge_it;++vedge_it) {
    tb_vlink *vlink = get(vedge_pmap,*vedge_it);

    if (removal) {
      tb_removal_link_record &link_record = removal->links[vlink->name];
      link_record.link_info = vlink->link_info;
    }
    
    vvertex dest_vv = target(*vedge_it,VG);
    if (dest_vv == vv)
      dest_vv = source(*vedge_it,VG);
    tb_vnode *dest_vnode = get(vvertex_pmap,dest_vv);
    SDEBUG(cerr << "  edge to " << dest_vnode->name << endl);

    if (dest_vnode->type.compare("delay") == 0) {continue;}

    if (! dest_vnode->assigned) continue;

    if (vlink->no_connection) {
      SDEBUG(cerr << "  link no longer in violation.\n";)
      SSUB(SCORE_NO_CONNECTION);
      vlink->no_connection=false;
      vinfo.no_connection--;
      violated--;
    }
    
    if (vlink->link_info.type == tb_link_info::LINK_DELAYED) {
      SDEBUG(cerr << "  delayed link! removing delay node." << endl);
      if (removal) {
	tb_removal_link_record &link_record = removal->links[vlink->name];
	if (! link_record.delay_record) {
	  link_record.delay_record = new tb_removal_record();
	}
	remove_node(vlink->delay_node,link_record.delay_record);
      } else {
	remove_node(vlink->delay_node,NULL);
      }
      remove_delay_node(vlink->delay_node);
    }
    
    unscore_link_info(*vedge_it);
  }

  // pclass
  if (pnode->my_class) {
    pclass_unset(pnode);
  }
  if (pnode->my_class && (pnode->my_class->used == 0)) {
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

  // remove lan node if necessary
  if (vnode->type.compare("lan") == 0) {
    SDEBUG(cerr << "Deleting lan node." << endl);
    if (removal != NULL) {
      if (pnode->switches.begin() != pnode->switches.end()) {
	removal->lan_switch = *(pnode->switches.begin());
      } else {
	removal->lan_switch = (pvertex)NULL;
      }
    }
    delete_lan_node(pv);
  }
  
  SDEBUG(cerr << "  new score = " << score << " new violated = " << violated << endl);
}

/* score_link_info(vedge ve)
 * This routine is the highest level link scorer.  It handles all
 * scoring that depends on the link_info of vlink.
 */
void score_link_info(vedge ve)
{
  tb_vlink *vlink = get(vedge_pmap,ve);
  tb_pnode *the_switch;
  switch (vlink->link_info.type) {
  case tb_link_info::LINK_DIRECT:
    SADD(SCORE_DIRECT_LINK);
    score_link(vlink->link_info.plinks.front(),ve);
    break;
  case tb_link_info::LINK_INTRASWITCH:
    SADD(SCORE_INTRASWITCH_LINK);
    score_link(vlink->link_info.plinks.front(),ve);
    score_link(vlink->link_info.plinks.back(),ve);
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
      score_link(*plink_It,ve);
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
  case tb_link_info::LINK_DELAYED:
    SADD(SCORE_DELAYED_LINK);
    break;
  case tb_link_info::LINK_UNKNOWN:
  case tb_link_info::LINK_TRIVIAL:
    cerr << "Internal error: Should not be here either." << endl;
    exit(1);
    break;
  }
}

/*
 * int add_node(vvertex vv,pvertex pv,bool deterministic)
 * Add a mapping of vv to pv and adjust score appropriately.
 * Returns 1 in the case of an incompatible mapping.  If determinisitic
 * is true then it deterministically solves the link problem for best
 * score.  Note: deterministic takes considerably longer.
 */
int add_node(vvertex vv,pvertex pv, bool deterministic,
	     name2pnode_map *delays,tb_removal_record *removal)
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
      SDEBUG(cerr << "  compatible types" << endl);
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

  // Set up pclass, we do this early so that if we need to add a delay
  // node it finds the right node.
  // pclass
  pnode->current_load++;
  if (pnode->my_class && (pnode->my_class->used == 0)) {
    SDEBUG(cerr << "  new pclass" << endl);
    SADD(SCORE_PCLASS);
  }
  
  if (pnode->my_class) {
    pclass_set(vnode,pnode);
  }

  // more setting up pnode
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

    if (dest_vnode->type.compare("delay") == 0) {continue;}
		
    if (dest_vnode->assigned) {
      pvertex dest_pv = dest_vnode->assignment;
      tb_pnode *dest_pnode = get(pvertex_pmap,dest_pv);

      SDEBUG(cerr << "   goes to " << dest_pnode->name << endl);

      if (dest_pv == pv) {
	SDEBUG(cerr << "  trivial link" << endl);
	vlink->link_info.type = tb_link_info::LINK_TRIVIAL;
      } else {
	SDEBUG(cerr << "   finding link resolutions" << endl);
	// We need to calculate all possible link resolutions, stick them
	// in a nice datastructure along with their weights, and then
	// select one randomly.
	typedef vector<tb_link_info> resolution_vector;
	typedef vector<pvertex_list> switchlist_vector;
	
	resolution_vector resolutions(10);
	int resolution_index = 0;
	float total_weight = 0;
	
	// Direct link
	if (direct_link(dest_pv,pv,vlink,pe)) {
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
	  if (dest_pnode->switches.find(*switch_it) != dest_pnode->switches.end()) {
	    if (find_link_to_switch(pv,*switch_it,vlink,first) &&
		find_link_to_switch(dest_pv,*switch_it,vlink,second)) {
	      resolutions[resolution_index].type = tb_link_info::LINK_INTRASWITCH;
	      resolutions[resolution_index].plinks.push_back(first);
	      resolutions[resolution_index].plinks.push_back(second);
	      resolutions[resolution_index].switches.push_front(*switch_it);
	      resolution_index++;
	      total_weight += LINK_RESOLVE_INTRASWITCH;
	      SDEBUG(cerr << "    intraswitch " << first << " and " << second << endl);
	    }
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
	    if ((find_interswitch_path(*source_switch_it,*dest_switch_it,
				       max(vlink->delay_info.bandwidth,
					   vlink->rdelay_info.bandwidth),
				       resolutions[resolution_index].plinks,
				       resolutions[resolution_index].switches) != 0) &&
		find_link_to_switch(pv,*source_switch_it,vlink,first) &&
		find_link_to_switch(dest_pv,*dest_switch_it,vlink,second)) {
	      resolutions[resolution_index].type = tb_link_info::LINK_INTERSWITCH;
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
	if ((resolution_index == 0) && vlink->allow_delayed) {
	  SDEBUG(cerr << "   DELAYING" << endl);
	  
	  // Create virtual delay node and link with special free vlinks.
	  vvertex delayv = make_delay_node(*vedge_it);
	  tb_pnode *delaypnode;
	  if (delays == NULL) {
	    if (removal == NULL) {
	      delaypnode = find_pnode(get(vvertex_pmap,delayv));
	    } else {
	      delaypnode = get(pvertex_pmap,removal->links[vlink->name].delay_record->assignment);
	    }
	  } else {
	    delaypnode = (*delays)[get(vvertex_pmap,delayv)->name];
	  }

	  tb_removal_record *delay_removal = NULL;
	  if (removal)
	    delay_removal = removal->links[vlink->name].delay_record;
	  
	  // Assign delay node
	  if (add_node(delayv,pname2vertex[delaypnode->name],
		       deterministic,NULL,delay_removal) == 0) {
	    resolutions[0].type = tb_link_info::LINK_DELAYED;
	    resolution_index++;
	    total_weight = 0;
	    vlink->delay_node = delayv;
	    SDEBUG(cerr << "   delay success" << endl);
	  }
	  SDEBUG(cerr << "    DELAY DONE" << endl);
	}
	if (resolution_index == 0) {
	  SDEBUG(cerr << "    Could not find any resolutions." << endl);
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
	  int index;
	  if (!deterministic) {
	    if (removal == NULL) {
	      float choice;
	      if (total_weight > 0) {
		choice = std::random()%(int)total_weight;
	      } else {
		choice = 0;
	      }
	      for (index = 0;index < resolution_index;++index) {
		switch (resolutions[index].type) {
		case tb_link_info::LINK_DIRECT:
		  choice -= LINK_RESOLVE_DIRECT; break;
		case tb_link_info::LINK_INTRASWITCH:
		  choice -= LINK_RESOLVE_INTRASWITCH; break;
		case tb_link_info::LINK_INTERSWITCH:
		  choice -= LINK_RESOLVE_INTERSWITCH; break;
		case tb_link_info::LINK_DELAYED:
		  choice -= 1; break;
		case tb_link_info::LINK_UNKNOWN:
		case tb_link_info::LINK_TRIVIAL:
		  cerr << "Internal error: Should not be here." << endl;
		  exit(1);
		  break;
		}
		if (choice < 0) break;
	      }
	    }
	  } else {
	    // Deterministic
	    int bestindex=0;
	    int bestviolated = 10000;
	    double bestscore=10000.0;
	    int i;
	    for (i=0;i<resolution_index;++i) {
	      vlink->link_info = resolutions[i];
	      score_link_info(*vedge_it);
	      if ((score <= bestscore) &&
		  (violated <= bestviolated)) {
		bestscore = score;
		bestviolated = violated;
		bestindex = i;
	      }
	      unscore_link_info(*vedge_it);
	    }
	    index = bestindex;
	  }
	  if (removal != NULL) {
	    vlink->link_info = removal->links[vlink->name].link_info;
	  } else {
	    vlink->link_info = resolutions[index];
	  }
	  SDEBUG(cerr << "  choice:" << vlink->link_info);
	  score_link_info(*vedge_it);
	}
      }
    }
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

  SDEBUG(cerr << "  assignment=" << vnode->assignment << endl);
  SDEBUG(cerr << "  new score=" << score << " new violated=" << violated << endl);
  
  return 0;
  }

// returns "best" direct link between a and b.
// best = less users
//        break ties with minimum bw_used
bool direct_link(pvertex a,pvertex b,tb_vlink *vlink,pedge &edge)
{
  pvertex dest_pv;
  pedge best_pedge;
  tb_plink *plink;
  tb_plink *best_plink = NULL;
  poedge_iterator pedge_it,end_pedge_it;
  int best_users=0;
  double best_distance=0;
  tie(pedge_it,end_pedge_it) = out_edges(a,PG);
  for (;pedge_it!=end_pedge_it;++pedge_it) {
    dest_pv = target(*pedge_it,PG);
    if (dest_pv == a)
      dest_pv = source(*pedge_it,PG);
    if (dest_pv == b) {
      plink = get(pedge_pmap,*pedge_it);
      int users = plink->nonemulated;
      if (! vlink->emulated) {
	users += plink->emulated;
      }
      tb_delay_info physical_delay;
      physical_delay.bandwidth = plink->delay_info.bandwidth - plink->bw_used;
      physical_delay.delay = plink->delay_info.delay;
      physical_delay.loss = plink->delay_info.loss;
      double distance = (vlink->delay_info.distance(physical_delay) +
			 vlink->rdelay_info.distance(physical_delay))/2;
      if ((distance == -1) || (vlink->must_delayed)) {distance = DBL_MAX;}
      
      if ((! best_plink) ||
	  (users < best_users) ||
	  ((users == best_users) && (distance < best_distance))) {
	best_users = users;
	best_distance = distance;
	best_pedge = *pedge_it;
	best_plink = plink;
      }
    }
  }
  if (best_plink == NULL) {
    return false;
  } else {
    edge = best_pedge;
    return true;
  }
}

bool find_link_to_switch(pvertex pv,pvertex switch_pv,tb_vlink *vlink,
			 pedge &out_edge)
{
  pvertex dest_pv;
  double best_distance = 1000.0;
  int best_users = 1000;
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

      double distance;
      if (plink->type != tb_plink::PLINK_LAN) {
	tb_delay_info physical_delay;
	physical_delay.bandwidth = plink->delay_info.bandwidth - plink->bw_used;
	physical_delay.delay = plink->delay_info.delay;
	physical_delay.loss = plink->delay_info.loss;
	distance = (vlink->delay_info.distance(physical_delay) +
		    vlink->rdelay_info.distance(physical_delay))/2;
      } else {
	distance = 0;
      }
      int users;

      // For sticking emulated links in emulated links we only care
      // about the distance.
      users = plink->nonemulated;
      if (! vlink->emulated) {
	users += plink->emulated;
      }
      if ((distance == -1) || (vlink->must_delayed)) {
	// -1 == infinity
	continue;
      }
      if ((users < best_users) ||
	  ((users  == best_users) && (distance < best_distance))) {
	best_pedge = *pedge_it;
	best_distance = distance;
	found_best = true;
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
    out_switches.push_front(get(svertex_pmap,current_sv)->mate);
    current_se = edge(current_sv,preds[current_sv],SG).first;
    out_path.push_back(get(sedge_pmap,current_se)->mate);
    current_sv = preds[current_sv];
  }
  out_switches.push_front(get(svertex_pmap,current_sv)->mate);
  return 1;
}

// this does scoring for over users and over bandwidth on edges.
void score_link(pedge pe,vedge ve)
{
  tb_plink *plink = get(pedge_pmap,pe);
  tb_vlink *vlink = get(vedge_pmap,ve);

  SDEBUG(cerr << "  score_link(" << pe << ") - " << plink->name << " / " <<
	 vlink->name << endl);

#ifdef SCORE_DEBUG_LOTS
  cerr << *plink;
  cerr << *vlink;
#endif
  
  if (plink->type == tb_plink::PLINK_NORMAL) {
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

    tb_delay_info physical_delay;
    physical_delay.bandwidth = plink->delay_info.bandwidth - plink->bw_used;
    physical_delay.delay = plink->delay_info.delay;
    physical_delay.loss = plink->delay_info.loss;
    
    double distance = (vlink->delay_info.distance(physical_delay)+
		       vlink->rdelay_info.distance(physical_delay))/2;

    plink->bw_used += max(vlink->delay_info.bandwidth,
			  vlink->rdelay_info.bandwidth);

    if ((distance == -1) || (vlink->must_delayed)) {
      // violation
      SDEBUG(cerr << "    outside delay requirements." << endl);
      violated++;
      vinfo.delay++;
      SADD(SCORE_OUTSIDE_DELAY);
    } else {
      SADD(distance * SCORE_DELAY);
    }
  } else if (plink->type == tb_plink::PLINK_INTERSWITCH) {
    plink->bw_used += max(vlink->delay_info.bandwidth,
			  vlink->rdelay_info.bandwidth);
    if (plink->bw_used > plink->delay_info.bandwidth) {
      // interswitch over bandwidth
      vinfo.bandwidth++;
      violated++;
      SADD(SCORE_OVER_BANDWIDTH);
    }
  }
}

void unscore_link(pedge pe,vedge ve)
{
  tb_plink *plink = get(pedge_pmap,pe);
  tb_vlink *vlink = get(vedge_pmap,ve);

  SDEBUG(cerr << "  unscore_link(" << pe << ") - " << plink->name << " / " <<
	 vlink->name << endl);

#ifdef SCORE_DEBUG_LOTS
  cerr << *plink;
  cerr << *vlink;
#endif

  if (plink->type == tb_plink::PLINK_NORMAL) {
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
    
    plink->bw_used -= max(vlink->delay_info.bandwidth,
			  vlink->rdelay_info.bandwidth);

    tb_delay_info physical_delay;
    physical_delay.bandwidth = plink->delay_info.bandwidth - plink->bw_used;
    physical_delay.delay = plink->delay_info.delay;
    physical_delay.loss = plink->delay_info.loss;
    double distance = (vlink->delay_info.distance(physical_delay)+
		       vlink->rdelay_info.distance(physical_delay))/2;

    if ((distance == -1) || (vlink->must_delayed)) {
      // violation
      SDEBUG(cerr << "    removing delay violation." << endl);
      violated--;
      vinfo.delay--;
      SSUB(SCORE_OUTSIDE_DELAY);
    } else {
      SSUB(distance * SCORE_DELAY);
    }
  } else if (plink->type == tb_plink::PLINK_INTERSWITCH) {
    int oldbw = plink->bw_used;
    plink->bw_used -= max(vlink->delay_info.bandwidth,
			  vlink->rdelay_info.bandwidth);
    if ((oldbw > plink->delay_info.bandwidth) &&
	(plink->bw_used < plink->delay_info.bandwidth)) {
      //interswitch udner bandwidth
      vinfo.bandwidth--;
      violated--;
      SSUB(SCORE_OVER_BANDWIDTH);
    }
  }
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

/* make_lan_node(vvertex vv,name2pnode_map *delay_map,pvertex *switch)
 * This routines create a physical lan node and connects it to a switch
 * with a LAN plink.  Most of the code is in determining which switch to
 * connect the LAN node to.  Specifically, it connects it to the switch
 * which will maximize the number of intra (rather than inter) links for
 * assigned adjancent nodes of vv.
 *
 * If delay_map is non-null then make_lan_node will look in there for
 * delay nodes and use the delay nodes as the adjacent nodes.  This is to
 * make lan migration work.
 *
 * If switch is non null then it override the lan nodes attempt to find
 * a switch.  This is a dirty hack to make the removal record work
 * correctly.
 */
pvertex make_lan_node(vvertex vv,name2pnode_map *delay_map,pvertex *the_switch)
{
  typedef hash_map<pvertex,int,hashptr<void *> > switch_int_map;
  switch_int_map switch_counts;

  tb_vnode *vnode = get(vvertex_pmap,vv);

  SDEBUG(cerr << "make_lan_node(" << vnode->name << "," <<
	 delay_map << ")" << endl);
  
  // Choose switch
  pvertex largest_switch;
  int largest_switch_count=0;
  if (the_switch == NULL) {
    voedge_iterator vedge_it,end_vedge_it;
    tie(vedge_it,end_vedge_it) = out_edges(vv,VG);
    for (;vedge_it!=end_vedge_it;++vedge_it) {
      tb_vlink *vlink = get(vedge_pmap,*vedge_it);
      vvertex dest_vv = target(*vedge_it,VG);
      if (dest_vv == vv)
	dest_vv = source(*vedge_it,VG);
      tb_vnode *dest_vnode = get(vvertex_pmap,dest_vv);
      if (dest_vnode->assigned) {
	tb_pnode *dest_pnode;
	if ((! delay_map) ||
	    (delay_map->find(crope("delay-") + vlink->name)
	     == delay_map->end())) {
	  dest_pnode = get(pvertex_pmap,dest_vnode->assignment);
	} else {
	  dest_pnode = (*(delay_map->find(crope("delay-") + vlink->name))).second;
	}
	for (pvertex_set::iterator switch_it = dest_pnode->switches.begin();
	     switch_it != dest_pnode->switches.end();switch_it++) {
	  if (switch_counts.find(*switch_it) != switch_counts.end()) {
	    switch_counts[*switch_it]++;
	  } else {
	    switch_counts[*switch_it]=1;
	  }
	  if (switch_counts[*switch_it] > largest_switch_count) {
	    largest_switch = *switch_it;
	    largest_switch_count = switch_counts[*switch_it];
	  }
	}
      }
    }
  } else {
    if (*the_switch != NULL) {
      largest_switch = *the_switch;
      largest_switch_count = -1;
    } else {
      largest_switch_count = 0;
    }
  }

  SDEBUG(cerr << "  largest_switch=" << largest_switch <<
	 " largest_switch_count=" << largest_switch_count << endl);
  
  pvertex pv = add_vertex(PG);
  tb_pnode *p = new tb_pnode();
  put(pvertex_pmap,pv,p);
  p->name = "lan_";
  p->name += vnode->name;
  p->name += "_";
  p->typed = true;
  p->current_type = "lan";
  p->max_load = 1;
  p->current_load = 0;
  p->pnodes_used = 0;
  p->types["lan"] = 1;
  p->my_class = NULL;
  
  // If the below is false then we have an orphined lan node which will
  // quickly be destroyed when add_node fails.
  if (largest_switch_count != 0) {
    pedge pe = (add_edge(pv,largest_switch,PG)).first;
    tb_plink *pl = new tb_plink();
    put(pedge_pmap,pe,pl);
    pl->name = crope("lanlink_");
    pl->name += vnode->name;
    pl->type = tb_plink::PLINK_LAN;
    pl->srcmac = vnode->name;
    pl->dstmac = get(pvertex_pmap,largest_switch)->name;
    pl->bw_used = 0;
    pl->emulated = pl->nonemulated = 0;
    p->switches.insert(largest_switch);
    p->name += pl->dstmac;
  } else {
    p->name += "orphin";
  }

  return pv;
}

/* delete_lan_node(pvertex pv)
 * Removes the physical lan node and the physical lan link.  Assumes that
 * nothing is assigned to it.
 */
void delete_lan_node(pvertex pv)
{
  tb_pnode *pnode = get(pvertex_pmap,pv);

  SDEBUG(cerr << "delete_lan_node(" << pnode->name << ")" << endl);

  // delete LAN link
  typedef list<pedge> pedge_list;
  pedge_list to_free;
  
  poedge_iterator pedge_it,end_pedge_it;
  tie(pedge_it,end_pedge_it) = out_edges(pv,PG);
  // We need to copy because removing edges invalidates out iterators.
  for (;pedge_it != end_pedge_it;++pedge_it) {
    to_free.push_front(*pedge_it);
  }
  for (pedge_list::iterator free_it = to_free.begin();
       free_it != to_free.end();++free_it) {
    delete(get(pedge_pmap,*free_it));
    remove_edge(*free_it,PG);
  }

  remove_vertex(pv,PG);
  delete pnode;
}

vvertex make_delay_node(vedge ve)
{
  tb_vlink *vlink = get(vedge_pmap,ve);

  vvertex delayv;
  vedge src_edge,dst_edge;
  tb_vlink *src_vlink,*dst_vlink;

  tb_vnode *delay = new tb_vnode;

  delay->name = "delay-";
  delay->name += vlink->name;
  delay->type = "delay";
  delay->assigned = false;
  delay->delayed_link = vlink;
  delay->vclass = NULL;
    
  delayv = add_vertex(VG);
  vname2vertex[delay->name] = delayv;
  put(vvertex_pmap,delayv,delay);

  src_vlink = new tb_vlink;
  dst_vlink = new tb_vlink;

  src_edge = add_edge(source(ve,VG),delayv,VG).first;
  put(vedge_pmap,src_edge,src_vlink);
  dst_edge = add_edge(delayv,target(ve,VG),VG).first;
  put(vedge_pmap,dst_edge,dst_vlink);

  src_vlink->delay_info.bandwidth = vlink->delay_info.bandwidth;
  src_vlink->delay_info.bw_under = 0;
  src_vlink->delay_info.bw_over = -1;
  src_vlink->delay_info.delay = vlink->delay_info.delay;
  src_vlink->delay_info.delay_under = -1;
  src_vlink->delay_info.delay_over = 0;
  src_vlink->delay_info.loss = vlink->delay_info.loss;
  src_vlink->delay_info.loss_under = -1;
  src_vlink->delay_info.loss_over = 0;
  src_vlink->rdelay_info.bandwidth = vlink->rdelay_info.bandwidth;
  src_vlink->rdelay_info.bw_under = 0;
  src_vlink->rdelay_info.bw_over = -1;
  src_vlink->rdelay_info.delay = vlink->rdelay_info.delay;
  src_vlink->rdelay_info.delay_under = -1;
  src_vlink->rdelay_info.delay_over = 0;
  src_vlink->rdelay_info.loss = vlink->rdelay_info.loss;
  src_vlink->rdelay_info.loss_under = -1;
  src_vlink->rdelay_info.loss_over = 0;

  src_vlink->name = vlink->name;
  src_vlink->name += "-delaysrc";
  src_vlink->emulated = false;
  src_vlink->no_connection = 0;
  src_vlink->allow_delayed = false; // IMPORTANT!
  src_vlink->must_delayed = false;
    
  dst_vlink->delay_info.bandwidth = vlink->delay_info.bandwidth;
  dst_vlink->delay_info.bw_under = 0;
  dst_vlink->delay_info.bw_over = -1;
  dst_vlink->delay_info.delay = vlink->delay_info.delay;
  dst_vlink->delay_info.delay_under = -1;
  dst_vlink->delay_info.delay_over = 0;
  dst_vlink->delay_info.loss = vlink->delay_info.loss;
  dst_vlink->delay_info.loss_under = -1;
  dst_vlink->delay_info.loss_over = 0;
  dst_vlink->rdelay_info.bandwidth = vlink->rdelay_info.bandwidth;
  dst_vlink->rdelay_info.bw_under = 0;
  dst_vlink->rdelay_info.bw_over = -1;
  dst_vlink->rdelay_info.delay = vlink->rdelay_info.delay;
  dst_vlink->rdelay_info.delay_under = -1;
  dst_vlink->rdelay_info.delay_over = 0;
  dst_vlink->rdelay_info.loss = vlink->rdelay_info.loss;
  dst_vlink->rdelay_info.loss_under = -1;
  dst_vlink->rdelay_info.loss_over = 0;

  dst_vlink->name = vlink->name;
  dst_vlink->name += "-delaydst";
  dst_vlink->emulated = false;
  dst_vlink->no_connection = 0;
  dst_vlink->allow_delayed = false; // IMPORTANT!
  dst_vlink->must_delayed = false;

  delay->src_edge = src_edge;
  delay->dst_edge = dst_edge;

  vinfo.unassigned++;
  violated++;
  SADD(SCORE_UNASSIGNED);

  delay_nodes.insert(delayv);
  return delayv;
}

void remove_delay_node(vvertex delayv)
{
  tb_vnode *delay = get(vvertex_pmap,delayv);
  tb_vlink *src_vlink,*dst_vlink;

  assert(!delay->assigned);

  src_vlink = get(vedge_pmap,delay->src_edge);
  dst_vlink = get(vedge_pmap,delay->dst_edge);

  delete src_vlink;
  delete dst_vlink;

  vname2vertex.erase(delay->name);
  
  remove_edge(delay->src_edge,VG);
  remove_edge(delay->dst_edge,VG);

  remove_vertex(delayv,VG);
  
  vinfo.unassigned--;
  violated--;
  SSUB(SCORE_UNASSIGNED);

  delay_nodes.erase(delayv);
  
  delete delay;
}
