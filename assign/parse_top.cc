#include <limits.h>

// XXX - This needs to be replaced by something more generic, wchar is
// not always an integer.
#define WCHAR_MIN INT_MIN
#define WCHAR_MAX INT_MAX

#include <hash_map>
#include <slist>
#include <queue>
#include <rope>

#include <boost/config.hpp>
#include <boost/utility.hpp>
#include <boost/property_map.hpp>
#include <boost/graph/graph_traits.hpp>
#include <boost/graph/adjacency_list.hpp>

#include <iostream.h>
#include <string.h>
#include <stdio.h>
#include <stdlib.h>

using namespace boost;

#include "common.h"
#include "vclass.h"
#include "physical.h"
#include "virtual.h"

extern name_vvertex_map vname2vertex;
extern name_name_map fixed_nodes;
extern name_slist vtypes;
extern tb_vgraph VG;

name_vclass_map vclass_map;

int parse_top(tb_vgraph &VG, istream& i)
{
  vvertex no1;
  char inbuf[255];
  char n1[1024], n2[1024],emustring[1024];
  char lname[1024];
  int num_nodes = 0;
  int bw;
  int r;

  bool emulated=false;
  
  while (!i.eof()) {
    char *ret;
    i.getline(inbuf, 254);
    ret = strchr(inbuf, '\n');
    if (ret) *ret = 0;
    if (strlen(inbuf) == 0) { continue; }
	    
    if (!strncmp(inbuf, "node", 4)) {
      char *snext = inbuf;
      char *scur = strsep(&snext," ");
      if (strcmp("node",scur) != 0) {
	fprintf(stderr, "bad node line: %s\n", inbuf);
      } else {
	scur=strsep(&snext," ");
	num_nodes++;
	no1 = add_vertex(VG);
	tb_vnode *v = new tb_vnode();
	put(vvertex_pmap,no1,v);
	v->name = scur;
	vname2vertex[scur]=no1;
	scur=strsep(&snext," ");
	name_vclass_map::iterator dit = vclass_map.find(scur);
	if (dit != vclass_map.end()) {
	  v->type="";
	  v->vclass = (*dit).second;
	} else {
	  v->type=scur;
	  v->vclass=NULL;
	  vtypes.push_front(v->type);
	}
	v->fixed = false;	// this may get set to true later
	
	/* Read in desires */
	while ((scur=strsep(&snext," ")) != NULL) {
	  char *desire = scur;
	  char *sdesire;
	  double iweight;
	  sdesire = strsep(&desire,":");
	  if ((! desire) || sscanf(desire,"%lg",&iweight) != 1) {
	    fprintf(stderr,"Bad desire specifier for %s\n",sdesire);
	    iweight = 0.01;
	  }
	  v->desires[sdesire]=iweight;
	}
      }
    } else if (!strncmp(inbuf, "link", 4)) {
      r=sscanf(inbuf, "link %s %s %s %d %s", lname, n1, n2,&bw,emustring);
      if ((r <= 3) || ((r == 5) && strcmp(emustring,"emulated"))) {
	fprintf(stderr, "bad link line: %s\n", inbuf);
      } else {
	if (r == 4) {
	  emulated = false;
	} else {
	  emulated = true;
	}
	vedge e;
	vvertex node1 = vname2vertex[n1];
	vvertex node2 = vname2vertex[n2];
	e = add_edge(node1,node2,VG).first;
	tb_vlink *l = new tb_vlink();
	put(vedge_pmap,e,l);
	l->bandwidth = bw;
	l->link_info.type = tb_link_info::LINK_UNKNOWN;
	l->no_connection = false;
	l->name=lname;
	l->emulated = emulated;
      }
    } else if (! strncmp(inbuf, "fix-node",8)) {
      r=sscanf(inbuf,"fix-node %s %s",n1,n2);
      if (r != 2) {
	fprintf(stderr, "bad fix-node line: %s\n",inbuf);
      } else {
	fixed_nodes[n1]=n2;
      }
    } else if (! strncmp(inbuf, "make-vclass",11)) {
      char *snext = inbuf;
      char *scur = strsep(&snext," ");
      if (strcmp("make-vclass",scur) != 0) {
	fprintf(stderr,"bad vclass line: %s\n",inbuf);
      } else {
	scur=strsep(&snext," ");
	crope vclass_name(scur);
	scur=strsep(&snext," ");
	double weight;
	if (sscanf(scur,"%lg",&weight) != 1) {
	  fprintf(stderr,"bad vclass weight: %s\n",inbuf);
	  weight=0.5;
	}
	tb_vclass *v = new tb_vclass(vclass_name,weight);
	vclass_map[vclass_name]=v;
	while ((scur = strsep(&snext, " ")) != NULL) {
	  v->add_type(scur);
	  vtypes.push_front(scur);
	}
      }
    } else {
      fprintf(stderr, "unknown directive: %s\n", inbuf);
    }
  }

  return num_nodes;
}

void dump_top(ostream &o)
{
  for (name_vclass_map::iterator it=vclass_map.begin();
       it != vclass_map.end();++it) {
    tb_vclass *vclass = (*it).second;
    o << "make-vclass " << vclass->name << " " << vclass->weight;
    for (tb_vclass::members_map::iterator it=vclass->members.begin();
	 it != vclass->members.end();++it) {
      o << " " << (*it).first;
    }
    o << endl;
  }
  
  for (name_name_map::iterator it=fixed_nodes.begin();
       it != fixed_nodes.end();++it) {
    o << "fix-node " << (*it).first << " " << (*it).second << endl;
  }
  
  vvertex_iterator vvertex_it,end_vvertex_it;
  tie(vvertex_it,end_vvertex_it) = vertices(VG);
  for (;vvertex_it!=end_vvertex_it;++vvertex_it) {
    tb_vnode *vnode = get(vvertex_pmap,*vvertex_it);
    o << "node " << vnode->name << " ";
    if (vnode->vclass != NULL) {
      o << vnode->vclass->name;
    } else {
      o << vnode->type;
    }
    for (tb_vnode::desires_map::iterator it = vnode->desires.begin();
	 it!=vnode->desires.end();it++) {
      o << " " << (*it).first << ":" << (*it).second;
    }
    o << endl;
  }

  vedge_iterator vedge_it,end_vedge_it;
  tie(vedge_it,end_vedge_it) = edges(VG);
  for (;vedge_it!=end_vedge_it;++vedge_it) {
    tb_vlink *vlink = get(vedge_pmap,*vedge_it);
    o << "link " << vlink->name << " " <<
      get(vvertex_pmap,source(*vedge_it,VG))->name << " " <<
      get(vvertex_pmap,target(*vedge_it,VG))->name << " " <<
      vlink->bandwidth;
    if (vlink->emulated) {
      o << "emulated";
    }
    o << endl;
  }
}
