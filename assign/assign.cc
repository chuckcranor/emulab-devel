#include <limits.h>

// XXX - This needs to be replaced by something more generic, wchar is
// not always an integer.
#define WCHAR_MIN INT_MIN
#define WCHAR_MAX INT_MAX

#include <hash_map>
#include <slist>
#include <rope>
#include <queue>

#include <boost/config.hpp>
#include <boost/utility.hpp>
#include <boost/property_map.hpp>
#include <boost/graph/graph_traits.hpp>
#include <boost/graph/adjacency_list.hpp>
#include <boost/graph/dijkstra_shortest_paths.hpp>

#include <fstream.h>
#include <iostream.h>
#include <time.h>
#include <stdlib.h>
#include <math.h>
#include <sys/types.h>
#include <sys/time.h>
#include <sys/resource.h>

using namespace boost;

#include "common.h"
#include "physical.h"
#include "virtual.h"
#include "vclass.h"
#include "pclass.h"
#include "score.h"

#ifdef USE_OPTIMAL
#define OPTIMAL_SCORE(edges,nodes) (nodes*SCORE_PNODE + \
                                    nodes/opt_nodes_per_sw*SCORE_SWITCH + \
                                    edges*((SCORE_INTRASWITCH_LINK+ \
                                    SCORE_DIRECT_LINK*2)*4+\
                                    SCORE_INTERSWITCH_LINK)/opt_nodes_per_sw)
#else
#define OPTIMAL_SCORE(edges,nodes) 0
#endif


// Here we set up all our graphs.  Need to create the graphs
// themselves and then setup the property maps.
tb_pgraph PG;
tb_pgraph_vertex_pmap pvertex_pmap = get(vertex_data, PG);
tb_pgraph_edge_pmap pedge_pmap = get(edge_data, PG);
tb_sgraph SG;
tb_sgraph_vertex_pmap svertex_pmap = get(vertex_data, SG);
tb_sgraph_edge_pmap sedge_pmap = get(edge_data, SG);
tb_vgraph VG;
tb_vgraph_vertex_pmap vvertex_pmap = get(vertex_data, VG);
tb_vgraph_edge_pmap vedge_pmap = get(edge_data, VG);

// Map of physical node name to its vertex descriptor.
name_pvertex_map pname2vertex;

// A simple list of physical types.
name_slist ptypes;

// Map of virtual node name to its vertex descriptor.
name_vvertex_map vname2vertex;

// Map of virtual node name to the physical node name it's fixed too.
// The domain is the set of all fixed virtual nodes and the range is
// the set of all fixed physical nodes.
name_name_map fixed_nodes;

// List of virtual types by name.
name_slist vtypes;

// Priority queue of unassigned virtual nodes.  Basically a fancy way
// of randomly choosing a unassigned virtual node.  When nodes become
// unassigned they are placed in the queue with a random priority.
vvertex_int_priority_queue unassigned_nodes;

// Map from a pnode* to the the corresponding pvertex.
pnode_pvertex_map pnode2vertex;

// A list of all pclasses.
pclass_list pclasses;

// Map of a type to a tt_entry, a vector of pclasses and the size of
// the vector.
pclass_types type_table;

// This datastructure contains all the information needed to calculate
// the shortest path between any two switches.  Indexed by svertex,
// the value will be a predicate map (indexed by svertex as well) of
// the shortest paths for the given vertex.
switch_pred_map_map switch_preds;

// A hash function for graph edges.
struct hashedge {
  size_t operator()(vedge const &A) const {
    return (size_t) (10000*target(A,VG)+source(A,VG));
  }
};

typedef hash_map<vvertex,pvertex> node_map;
typedef hash_map<vvertex,bool> assigned_map;
typedef hash_map<pvertex,crope> type_map;
typedef hash_map<vedge,tb_link_info,hashedge> link_map;

// A scaling constant for the temperature in determining whether to
// accept a change.
static double sensitivity = 0.1;

// The number of accepts of increase that took place during the annealing.
int accepts;

// The number of iterations that took place.
int iters;

// These variables store the best solution.
node_map absassignment;		// assignment field of vnode
assigned_map absassigned;	// assigned field of vnode
type_map abstypes;		// type field of vnode
link_map abslinks;		// link_info field of vnode
violated_info absvinfo;		// vinfo
double absbest;			// score
int absbestviolated;		// violated
int iters_to_best = 0;		// iters

// Determines whether to accept a change of score difference 'change' at
// temperature 'temperature'.
inline int accept(float change, float temperature)
{
  float p;
  int r;

  if (change == 0) {
    p = 1000 * temperature / temp_prob;
  } else {
    p = expf(change/(temperature*sensitivity)) * 1000;
  }
  r = std::random() % 1000;
  if (r < p) {
    accepts++;
    return 1;
  }
  return 0;
}

float used_time()
{
  struct rusage ru;
  getrusage(RUSAGE_SELF,&ru);
  return ru.ru_utime.tv_sec+ru.ru_utime.tv_usec/1000000.0+
    ru.ru_stime.tv_sec+ru.ru_stime.tv_usec/1000000.0;
}

void read_physical_topology(char *filename)
{
  ifstream ptopfile;
  ptopfile.open(filename);
  cout << "Physical Graph: " << parse_ptop(PG,SG,ptopfile) << endl;

#ifdef DUMP_GRAPH
  {
    cout << "Physical Graph:" << endl;
    
    pvertex_iterator vit,vendit;
    tie(vit,vendit) = vertices(PG);
    
    for (;vit != vendit;vit++) {
      tb_pnode *p = get(pvertex_pmap,*vit);
      cout << *vit << "\t" << *p;
    }
    
    pedge_iterator eit,eendit;
    tie(eit,eendit) = edges(PG);

    for (;eit != eendit;eit++) {
      tb_plink *p = get(pedge_pmap,*eit);
      cout << *eit << " (" << source(*eit,PG) << " <-> " <<
	target(*eit,PG) << ")\t" << *p;
    }
  }
#endif

#ifdef GRAPH_DEBUG
  {
    cout << "Switch Graph:" << endl;
    

    svertex_iterator vit,vendit;
    tie(vit,vendit) = vertices(SG);
    
    for (;vit != vendit;vit++) {
      tb_switch *p = get(svertex_pmap,*vit);
      cout << *vit << "\t" << *p;
    }
    
    sedge_iterator eit,eendit;
    tie(eit,eendit) = edges(SG);

    for (;eit != eendit;eit++) {
      tb_slink *p = get(sedge_pmap,*eit);
      cout << *eit << " (" << source(*eit,SG) << " <-> " <<
	target(*eit,SG) << ")\t" << *p;
    }
  }
#endif

  // Set up pnode2vertex
  pvertex_iterator pvit,pvendit;
  tie(pvit,pvendit) = vertices(PG);
  for (;pvit != pvendit;pvit++) {
    pnode2vertex[get(pvertex_pmap,*pvit)]=*pvit;
  }

}

void calculate_switch_MST()
{
  // Calculute MST
  cout << "Calculating shortest paths on switch fabric." << endl;
  tb_sgraph_weight_pmap sweight_pmap = get(edge_weight, SG);
  sedge_iterator seit,seendit;
  tie(seit,seendit) = edges(SG);
  for (;seit != seendit;seit++) {
    tb_slink *slink = get(sedge_pmap,*seit);
    put(sweight_pmap,*seit,
	100000000-get(pedge_pmap,slink->mate)->bandwidth);
  }
  svertex_iterator svit,svendit;
  tie(svit,svendit) = vertices(SG);
  for (;svit != svendit;svit++) {
    switch_preds[*svit] = new switch_pred_map(num_vertices(SG));
    dijkstra_shortest_paths(SG,*svit,
    			    predecessor_map(&((*switch_preds[*svit])[0])));
  }

#ifdef GRAPH_DEBUG
  cout << "Shortest paths" << endl;
  tie(svit,svendit) = vertices(SG);
  for (;svit != svendit;svit++) {
    cout << *svit << ":" << endl;
    for (unsigned int i = 0;i<num_vertices(SG);++i) {
      cout << i << " " << (*switch_preds[*svit])[i] << endl;
    }
  }
#endif
}

void read_virtual_topology(char *filename)
{
  ifstream topfile;
  topfile.open(filename);
  cout << "Virtual Graph: " << parse_top(VG,topfile) << endl;
 
#ifdef DUMP_GRAPH
  {
    cout << "Virtual Graph:" << endl;
    

    vvertex_iterator vit,vendit;
    tie(vit,vendit) = vertices(VG);
    
    for (;vit != vendit;vit++) {
      tb_vnode *p = get(vvertex_pmap,*vit);
      cout << *vit << "\t" << *p;
    }
    
    vedge_iterator eit,eendit;
    tie(eit,eendit) = edges(VG);

    for (;eit != eendit;eit++) {
      tb_vlink *p = get(vedge_pmap,*eit);
      cout << *eit << " (" << source(*eit,VG) << " <-> " <<
	target(*eit,VG) << ")\t" << *p;
    }
  }  
#endif
}

void anneal()
{
  cout << "Annealing." << endl;

  double newscore = 0;
  double bestscore = 0;
  
  iters = 0;
  iters_to_best =0;
  accepts = 0;
  
  float scorediff;

  int nnodes = num_vertices(VG);
  
  float cycles = CYCLES*(float)(nnodes + num_edges(VG));
  float optimal = OPTIMAL_SCORE(num_edges(VG),nnodes);
    
#ifdef STATS
  cout << "STATS_OPTIMAL = " << optimal << endl;
#endif

  int mintrans = (int)cycles;
  int trans;
  int naccepts = 20*nnodes;
  pvertex oldpos;
  bool oldassigned;
  int bestviolated;
  int num_fixed=0;
  float temp = init_temp;

#ifdef VERBOSE
  cout << "Initialized to cycles="<<cycles<<" optimal="<<optimal<<" mintrans="
       << mintrans<<" naccepts="<<naccepts<< endl;
#endif

  /* Set up the initial counts */
  init_score();

  /* Set up fixed nodes */
  for (name_name_map::iterator fixed_it=fixed_nodes.begin();
       fixed_it!=fixed_nodes.end();++fixed_it) {
    if (vname2vertex.find((*fixed_it).first) == vname2vertex.end()) {
      cerr << "Fixed node: " << (*fixed_it).first <<
	"does not exist." << endl;
      exit(1);
    }
    vvertex vv = vname2vertex[(*fixed_it).first];
    pvertex pv = pname2vertex[(*fixed_it).second];
    tb_vnode *vn = get(vvertex_pmap,vv);
    tb_pnode *pn = get(pvertex_pmap,pv);
    if (vn->vclass != NULL) {
      cerr << "Can not have fixed nodes be in a vclass!.\n";
      exit(1);
    }
    int old_violated = violated;
    if ((add_node(vv,pv) == 1) || (violated >= old_violated)) {
      cerr << "Fixed node: Could not map " << vn->name <<
	" to " << pn->name << endl;
      exit(1);
    }
    vn->fixed = true;
    num_fixed++;
  }

  bestscore = get_score();
  bestviolated = violated;

#ifdef VERBOSE
  cout << "Problem started with score "<<bestscore<<" and "<< violated
       << " violations." << endl;
#endif

  absbest = bestscore;
  absbestviolated = bestviolated;

  vvertex_iterator vit,veit;
  tie(vit,veit) = vertices(VG);
  for (;vit!=veit;++vit) {
    tb_vnode *vn = get(vvertex_pmap,*vit);
    absassigned[*vit] = vn->assigned;
    if (vn->assigned) {
      assert(vn->fixed);
      absassignment[*vit] = vn->assignment;
      absvinfo = vinfo;
      voedge_iterator eit,eeit;
      tie(eit,eeit) = out_edges(*vit,VG);
      for (;eit != eeit;++eit) {
	abslinks[*eit] = get(vedge_pmap,*eit)->link_info;
      }
      abstypes[*vit] = vn->type;
    } else {
      unassigned_nodes.push(vvertex_int_pair(*vit,std::random()));
    }
  }

  if (num_fixed == nnodes) {
    cout << "All nodes are fixed.  No annealing." << endl;
    goto DONE;
  }
  
  // Annealing loop!
  vvertex vv;
  tb_vnode *vn;
  while (temp >= temp_stop) {
#ifdef VERBOSE
    cout << "Temperature:  " << temp << " AbsBest: " << absbest <<
      " (" << absbestviolated << ")" << endl;
#endif
    trans = 0;
    accepts = 0;
    
    while (trans < mintrans && accepts < naccepts) {
#ifdef STATS
      cout << "STATS temp:" << temp << " score:" << get_score() <<
	" violated:" << violated << " trans:" << trans <<
	" accepts:" << accepts << endl;
#endif STATS
      pvertex newpos;
      trans++;
      iters++;
      
      if (! unassigned_nodes.empty()) {
	vv = unassigned_nodes.top().first;
	unassigned_nodes.pop();
      } else {
	vv = std::random()%nnodes;
	while (get(vvertex_pmap,vv)->fixed) {
	  vv = std::random()%nnodes;
	}
      }
      
      vn = get(vvertex_pmap,vv);
      oldassigned = vn->assigned;
      oldpos = vn->assignment;
      
      if (oldassigned) {
	remove_node(vv);
      }
      
      if (vn->vclass != NULL) {
	vn->type = vn->vclass->choose_type();
#ifdef SCORE_DEBUG
	cerr << "vclass " << vn->vclass->name  << ": choose type = "
	     << vn->type << " dominant = " << vn->vclass->dominant << endl;
#endif
      }
      tt_entry tt = type_table[vn->type];
      int num_types = tt.first;
      pclass_vector *acceptable_types = tt.second;
      
      // Loop will break eventually
      tb_pnode *newpnode;
      int i = std::random()%num_types;
      int first = i;
      bool found_pclass = true;
      for (;;) {
	i = (i+1)%num_types;
	newpnode = (*acceptable_types)[i]->members[vn->type]->front();
#ifdef PCLASS_DEBUG
	cerr << "Found pclass: " <<
	  (*acceptable_types)[i]->name << " and node " <<
	  (newpnode == NULL ? "NULL" : newpnode->name) << "\n";
#endif	
	if (newpnode != NULL) {
	  newpos = pnode2vertex[newpnode];
	  if (add_node(vv,newpos) == 0) {
	    if (vinfo.no_connection == 0) {
	      // HACK: We do this to avoid searching areas with
	      // invalid connections.  Empircally this results in
	      // significantly better performance in most casers.
	      break; // main exit condition
	    } else {
	      remove_node(vv);
	    }
	  }
	}
	
	if (i == first) {
	  // no available nodes
	  // need to free up a node.
	  vvertex toremove = std::random()%nnodes;
	  while (get(vvertex_pmap,toremove)->fixed ||
		 (! get(vvertex_pmap,toremove)->assigned)) {
	    toremove = std::random()%nnodes;
	  }
	  remove_node(toremove);
	  unassigned_nodes.push(vvertex_int_pair(toremove,std::random()));
	  found_pclass=false;
	  break;
	}
      }
      
      if (! found_pclass) {
	unassigned_nodes.push(vvertex_int_pair(vv,std::random()));
	continue;
      }
      
      newscore = get_score();
      
      // Negative means bad
      scorediff = bestscore - newscore;
      
      // Complicated expression that no one really understands
      if ((newscore < optimal) || (violated < bestviolated) ||
	  ((violated == bestviolated) && (newscore < bestscore)) ||
	  accept(scorediff*((bestviolated - violated)/2), temp)) {
	bestscore = newscore;
	bestviolated = violated;
	accepts++;
	if ((violated < absbestviolated) ||
	    ((violated == absbestviolated) &&
	     (newscore < absbest))) {
	  tie(vit,veit) = vertices(VG);
	  for (;vit!=veit;++vit) {
	    absassignment[*vit] = get(vvertex_pmap,*vit)->assignment;
	    absvinfo = vinfo;
	    voedge_iterator eit,eeit;
	    tie(eit,eeit) = out_edges(*vit,VG);
	    for (;eit != eeit;++eit) {
	      abslinks[*eit] = get(vedge_pmap,*eit)->link_info;
	    }
	    absassigned[*vit] = get(vvertex_pmap,*vit)->assigned;
	    abstypes[*vit] = get(vvertex_pmap,*vit)->type;
	  }
	  absbest = newscore;
	  absbestviolated = violated;
	  iters_to_best = iters;
	}
	if (newscore < optimal) {
	  cout << "OPTIMAL ( " << optimal << ")" << endl;
	  goto DONE;
	}
	// Accept change
      } else {
	// Reject change
	remove_node(vv);
	if (oldassigned) {
	  add_node(vv,oldpos);
	}
      }
    }
    temp *= temp_rate;
  }
 DONE:
  cout << "Done" << endl;
}

void print_solution()
{
  vvertex_iterator vit,veit;
  tb_vnode *vn;
  
  cout << "Nodes:" << endl;
  tie(vit,veit) = vertices(VG);
  for (;vit != veit;++vit) {
    vn = get(vvertex_pmap,*vit);
    if (! absassigned[*vit]) {
      cout << "unassigned: " << vn->name << endl;
    } else {
      cout << vn->name << " "
	   << get(pvertex_pmap,absassignment[*vit])->name << endl;
    }
  }
  cout << "End Nodes" << endl;
  cout << "Edges:" << endl;
  vedge_iterator eit,eendit;
  tie(eit,eendit) = edges(VG);
  for (;eit!=eendit;++eit) {
    tb_vlink *vlink = get(vedge_pmap,*eit);
    cout << vlink->name;
    if (abslinks[*eit].type == tb_link_info::LINK_DIRECT) {
      tb_plink *p = get(pedge_pmap,abslinks[*eit].plinks.front());
      cout << " direct " << p->name << " (" <<
	p->srcmac << "," << p->dstmac << ")" << endl;
    } else if (abslinks[*eit].type == tb_link_info::LINK_INTRASWITCH) {
      tb_plink *p = get(pedge_pmap,abslinks[*eit].plinks.front());
      tb_plink *p2 = get(pedge_pmap,abslinks[*eit].plinks.back());
      cout << " intraswitch " << p->name << " (" <<
	p->srcmac << "," << p->dstmac << ") " <<
	p2->name << " (" << p2->srcmac << "," << p2->dstmac <<
	")" << endl;
    } else if (abslinks[*eit].type == tb_link_info::LINK_INTERSWITCH) {
      cout << " interswitch ";
      for (pedge_path::iterator it=abslinks[*eit].plinks.begin();
	   it != abslinks[*eit].plinks.end();++it) {
	tb_plink *p = get(pedge_pmap,*it);
	cout << " " << p->name << " (" << p->srcmac << "," <<
	  p->dstmac << ")";
      }
      cout << endl;
    } else if (abslinks[*eit].type == tb_link_info::LINK_TRIVIAL) {
      cout << " trivial" << endl;
    } else {
      cout << " Unknown link type" << endl;
    }
  }
  cout << "End Edges" << endl;
  cout << "End solution" << endl;
}

#ifndef ASSIGN_LIBRARY
int main(int argc,char **argv)
{
  // Convert options to the common.h parameters.
  parse_options(argv, options, noptions);
#ifdef SCORE_DEBUG
  dump_options("Configuration options:", options, noptions);
#endif

  // Get a seed
  int seed;
  if (getenv("ASSIGN_SEED") != NULL) {
    sscanf(getenv("ASSIGN_SEED"),"%d",&seed);
  } else {
    seed = time(NULL)+getpid();
  }
  cout << "seed = " << seed << endl;
  std::srandom(seed);

  if (argc != 3) {
    cerr << argv[0] << " ptopfile topfile" << endl;
    exit(0);
  }

  read_physical_topology(argv[1]);
  calculate_switch_MST();
  
  cout << "Generating physical equivalence classes:";
  generate_pclasses(PG);
  cout << pclasses.size() << endl;

#ifdef PCLASS_DEBUG
  pclass_debug();
#endif

  read_virtual_topology(argv[2]);

  cout << "Type preecheck." << endl;
  // Type precheck
  bool ok=true;
  for (name_slist::iterator it=vtypes.begin();
       it != vtypes.end();++it) {
    if (find(ptypes.begin(),ptypes.end(),*it) == ptypes.end()) {
      cout << "  No physical nodes of type " << *it << endl;
      ok=false;
    }
  }
  if (! ok) exit(-1);


  double timestart,timeend;
  timestart = used_time();
  anneal();
  timeend = used_time();
  
  cout << "   BEST SCORE:  " << absbest << " in " << iters <<
    " iters and " << timeend-timestart << " seconds" << endl;
  cout << "With " << absbestviolated << " violations" << endl;
  cout << "With " << accepts << " accepts of increases" << endl;
  cout << "Iters to find best score:  " << iters_to_best << endl;
  cout << "Violations: " << absbestviolated << endl;
  cout << "  unassigned: " << absvinfo.unassigned << endl;
  cout << "  pnode_load: " << absvinfo.pnode_load << endl;
  cout << "  no_connect: " << absvinfo.no_connection << endl;
  cout << "  link_users: " << absvinfo.link_users << endl;
  cout << "  bandwidth:  " << absvinfo.bandwidth << endl;
  cout << "  desires:    " << absvinfo.desires << endl;

  print_solution();
  
  return 0;
}
#endif

