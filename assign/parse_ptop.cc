
#include <limits.h>

// XXX - This needs to be replaced by something more generic, wchar is
// not always an integer.
#define WCHAR_MIN INT_MIN
#define WCHAR_MAX INT_MAX

#include <hash_map>
#include <slist>
#include <rope>
#include <hash_set>

#include <boost/config.hpp>
#include <boost/utility.hpp>
#include <boost/property_map.hpp>
#include <boost/graph/graph_traits.hpp>
#include <boost/graph/adjacency_list.hpp>

#include <iostream.h>
#include <string.h>
#include <stdio.h>

using namespace boost;

#include "common.h"
#include "physical.h"

extern name_pvertex_map pname2vertex;
extern name_slist ptypes;
extern tb_pgraph PG;

int parse_ptop(tb_pgraph &PG, tb_sgraph &SG, istream& i)
{
  pvertex no1;
  pedge ed1;
  char inbuf[255];
  char n1[32], n2[32];
  int size, num;
  int n=1;
  char *snext;
  char *snode;
  char *scur;
  char lname[32];
  int isswitch;

  while (!i.eof()) {
    char *ret;
    i.getline(inbuf, 254);
    ret = strchr(inbuf, '\n');
    if (ret) *ret = 0;
    if (strlen(inbuf) == 0) { continue; }
    
    if (!strncmp(inbuf, "node", 4)) {
      isswitch = 0;
      snext = inbuf;
      scur = strsep(&snext," ");
      if (strcmp("node",scur) != 0) {
	fprintf(stderr, "bad node line: %s\n", inbuf);
      } else {
	n++;
	scur = strsep(&snext," ");
	snode = scur;
#ifdef GRAPH_DEBUG
	cout << "Found phys. node '"<<snode<<"'\n";
#endif
	no1 = add_vertex(PG);
	tb_pnode *p = new tb_pnode();
	put(pvertex_pmap,no1,p);
	p->name = snode;
	p->typed = false;
	p->max_load = 0;
	p->current_load = 0;
	p->pnodes_used = 0;
	while ((scur = strsep(&snext," ")) != NULL &&
	       (strcmp(scur,"-"))) {
	  char *stype,*load=scur;
	  int iload;
	  stype = strsep(&load,":");
	  if (load) {
	    if (sscanf(load,"%d",&iload) != 1) {
	      fprintf(stderr,"Bad load specifier: %s\n",load);
	      iload=1;
	    }
	  } else {
	    iload=1;
	  }
	  ptypes.push_front(stype);
	  if (strcmp(stype,"switch") == 0) {
	    isswitch = 1;
	    p->types[stype] = 1;
	    svertex sw = add_vertex(SG);
	    tb_switch *s = new tb_switch();
	    put(svertex_pmap,sw,s);
	    s->mate = no1;
	    p->sgraph_switch = sw;
	  } else {
	    p->types[stype]=iload;
	  }
	}
	/* Either end of line or - .  Read in features */
	while ((scur = strsep(&snext," ")) != NULL) {
	  char *feature=scur;
	  double icost;
	  char *sfeat;
	  sfeat = strsep(&feature,":");
	  if ((! feature) || sscanf(feature,"%lg",&icost) != 1) {
	    fprintf(stderr,"Bad cost specifier for %s\n",sfeat);
	    icost = 0.01;
	  }
	  p->features[sfeat]=icost;
	}

	/* Done */
	pname2vertex[snode]=no1;
      }
    }
    else if (!strncmp(inbuf, "link", 4)) {
      if (sscanf(inbuf, "link %s %s %s %d %d", lname, n1, n2, &size, &num)
	  != 5) {
	fprintf(stderr, "bad link line: %s\n", inbuf);
      } else {
	char *snode,*smac;
	char *dnode,*dmac;
	smac = n1;
	dmac = n2;
	snode = strsep(&smac,":");
	dnode = strsep(&dmac,":");
	if (pname2vertex.find(snode) == pname2vertex.end()) {
	  fprintf(stderr,"PTOP error: Unknown source node %s\n",snode);
	  exit(1);
	}
	if (pname2vertex.find(dnode) == pname2vertex.end()) {
	  fprintf(stderr,"PTOP error: Unknown destination node %s\n",dnode);
	  exit(1);
	}
	pvertex node1 = pname2vertex[snode];
	pvertex node2 = pname2vertex[dnode];
	tb_pnode *pnode1 = get(pvertex_pmap,node1);
	tb_pnode *pnode2 = get(pvertex_pmap,node2);
#define ISSWITCH(n) (n->types.find("switch") != n->types.end())
	for (int i = 0; i < num; ++i) {
	  ed1=(add_edge(node1,node2,PG)).first;
	  tb_plink *pl = new tb_plink();
	  put(pedge_pmap,ed1,pl);
	  pl->bandwidth=size;
	  pl->bw_used=0;
	  pl->name=lname;
	  pl->emulated=0;
	  pl->nonemulated=0;
	  pl->interswitch=false;
	  if (smac)
	    pl->srcmac = smac;
	  else
	    pl->srcmac = "(null)";
	  if (dmac)
	    pl->dstmac = dmac;
	  else
	    pl->dstmac = "(null)";
	  if (ISSWITCH(pnode1) && ISSWITCH(pnode2)) {
	    if (i != 0) {
	      cout <<
		"Warning: Extra links between switches will be ignored." <<
		endl;
	    }
	    svertex src_switch = get(pvertex_pmap,node1)->sgraph_switch;
	    svertex dst_switch = get(pvertex_pmap,node2)->sgraph_switch;
	    sedge swedge = add_edge(src_switch,dst_switch,SG).first;
	    tb_slink *sl = new tb_slink();
	    put(sedge_pmap,swedge,sl);
	    sl->mate = ed1;
	    pl->interswitch=true;
	  }
	}
	if (ISSWITCH(pnode1) &&
	    ! ISSWITCH(pnode2)) 
	  get(pvertex_pmap,node2)->switches.insert(node1);
	else if (ISSWITCH(pnode2) &&
		 ! ISSWITCH(pnode1))
	  get(pvertex_pmap,node1)->switches.insert(node2);
      }
    } else {
      fprintf(stderr, "unknown directive: %s\n", inbuf);
    }
  }
  return n-1;
}

void dump_ptop(ostream &o)
{
  pvertex_iterator pvertex_it,end_pvertex_it;
  tie(pvertex_it,end_pvertex_it) = vertices(PG);
  for (;pvertex_it!=end_pvertex_it;++pvertex_it) {
    tb_pnode *pnode = get(pvertex_pmap,*pvertex_it);
    o << "node " << pnode->name;
    for (tb_pnode::types_map::iterator it=pnode->types.begin();
	 it!=pnode->types.end();++it) {
      o << " " << (*it).first << ":" << (*it).second;
    }
    if (pnode->features.size() > 0) {
      o << " -";
      for (tb_pnode::features_map::iterator it = pnode->features.begin();
	   it!=pnode->features.end();it++) {
	o << " " << (*it).first << ":" << (*it).second;
      }
    }
    o << endl;
  }

  pedge_iterator pedge_it,end_pedge_it;
  tie(pedge_it,end_pedge_it) = edges(PG);
  for (;pedge_it!=end_pedge_it;++pedge_it) {
    tb_plink *plink = get(pedge_pmap,*pedge_it);
    cout << "link " << plink->name << " " << 
      get(pvertex_pmap,source(*pedge_it,PG))->name <<
      ":" << plink->srcmac << " " <<
      get(pvertex_pmap,target(*pedge_it,PG))->name <<
      ":" << plink->dstmac << " " << plink->bandwidth << "1" << endl;
  }
}
