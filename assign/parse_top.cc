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

using namespace boost;

#include "common.h"
#include "vclass.h"
#include "delay.h"
#include "physical.h"
#include "virtual.h"
#include "parser.h"

extern name_vvertex_map vname2vertex;
extern name_name_map fixed_nodes;
extern name_slist vtypes;
extern vvertex_vector virtual_nodes;

#define top_error(s) errors++;cerr << "TOP:" << line << ": " << s << endl

int parse_top(tb_vgraph &VG, istream& i)
{
  name_vclass_map vclass_map;
  string_vector parsed_line;
  int errors=0,line=0;
  int num_nodes = 0;
  char inbuf[1024];
  
  while (!i.eof()) {
    line++;
    i.getline(inbuf,1024);
    parsed_line = split_line(inbuf,' ');
    if (parsed_line.size() == 0) {continue;}

    crope command = parsed_line[0];

    if (command.compare("node") == 0) {
      if (parsed_line.size() < 3) {
	top_error("Bad node line, too few arguments.");
      } else {
	crope name = parsed_line[1];
	crope type = parsed_line[2];
	num_nodes++;
	tb_vnode *v = new tb_vnode();
	vvertex vv = add_vertex(VG);
	vname2vertex[name] = vv;
	virtual_nodes.push_back(vv);
	put(vvertex_pmap,vv,v);
	v->name = name;
	name_vclass_map::iterator dit = vclass_map.find(type);
	if (dit != vclass_map.end()) {
	  v->type="";
	  v->vclass = (*dit).second;
	} else {
	  v->type=type;
	  v->vclass=NULL;
	  vtypes.push_front(v->type);
	}
	v->fixed = false;	// this may get set to true later
	
	for (unsigned int i = 3;i < parsed_line.size();++i) {
	  crope desirename,desireweight;
	  if (split_two(parsed_line[i],':',desirename,desireweight,"0") == 1) {
	    top_error("Bad desire, missing weight.");
	  }
	  double gweight;
	  if (sscanf(desireweight.c_str(),"%lg",&gweight) != 1) {
	    top_error("Bad desire, bad weight.");
	    gweight = 0;
	  }
	  v->desires[desirename] = gweight;
	}
      }
    } else if (command.compare("link") == 0) {
      if (parsed_line.size() < 7) {
	top_error("Bad link line, too few arguments.");
      } else {
	crope name = parsed_line[1];
	crope src = parsed_line[2];
	crope dst = parsed_line[3];
	crope bw,bwunder,bwover;
	crope delay,delayunder,delayover;
	crope loss,lossunder,lossover;
	string_vector parsed_delay,parsed_bw,parsed_loss;
	parsed_bw = split_line(parsed_line[4],':');
	bw = parsed_bw[0];
	if (parsed_bw.size() == 1) {
	  bwunder = "0";
	  bwover = "0";
	} else if (parsed_bw.size() == 3) {
	  bwunder = parsed_bw[1];
	  bwover = parsed_bw[2];
	} else {
	  top_error("Bad link line, bad bandwidth specifier.");
	}
	parsed_delay = split_line(parsed_line[5],':');
	delay = parsed_delay[0];
	if (parsed_delay.size() == 1) {
	  delayunder = "0";
	  delayover = "0";
	} else if (parsed_delay.size() == 3) {
	  delayunder = parsed_delay[1];
	  delayover = parsed_delay[2];
	} else {
	  top_error("Bad link line, bad delay specifier.");
	}
	parsed_loss = split_line(parsed_line[6],':');
	loss = parsed_loss[0];
	if (parsed_loss.size() == 1) {
	  lossunder = "0";
	  lossover = "0";
	} else if (parsed_loss.size() == 3) {
	  lossunder = parsed_loss[1];
	  lossover = parsed_loss[2];
	} else {
	  top_error("Bad link line, bad loss specifier.");
	}

	vedge e;
	vvertex node1 = vname2vertex[src];
	vvertex node2 = vname2vertex[dst];
	e = add_edge(node1,node2,VG).first;
	tb_vlink *l = new tb_vlink();
	put(vedge_pmap,e,l);
	
	int ibw,ibwunder,ibwover,idelay,idelayunder,idelayover;
	double gloss,glossunder,glossover;

	if ((sscanf(bw.c_str(),"%d",&ibw) != 1) ||
	    (sscanf(bwunder.c_str(),"%d",&ibwunder) != 1) ||
	    (sscanf(bwover.c_str(),"%d",&ibwover) != 1) ||
	    (sscanf(delay.c_str(),"%d",&idelay) != 1) ||
	    (sscanf(delayunder.c_str(),"%d",&idelayunder) != 1) ||
	    (sscanf(delayover.c_str(),"%d",&idelayover) != 1) ||
	    (sscanf(loss.c_str(),"%lg",&gloss) != 1) ||
	    (sscanf(lossunder.c_str(),"%lg",&glossunder) != 1) ||
	    (sscanf(lossover.c_str(),"%lg",&glossover) != 1)) {
	  top_error("Bad line line, bad delay characteristics.");
	} else {
	  l->delay_info = tb_delay_info(ibw,idelay,gloss);
	  l->delay_under = tb_delay_info(ibwunder,idelayunder,glossunder);
	  l->delay_over = tb_delay_info(ibwover,idelayover,glossover);
	}
	l->no_connection = false;
	l->name = name;
	l->allow_delayed = true;
	l->emulated = false;
	
	for (unsigned int i = 7;i < parsed_line.size();++i) {
	  if (parsed_line[i].compare("nodelay") == 0) {
	    l->allow_delayed = false;
	  } else if (parsed_line[i].compare("emulated") == 0) {
	    l->emulated = true;
	  } else {
	    top_error("bad link line, unknown tag: " <<
		      parsed_line[i] << ".");
	  }
	}
      }
    } else if (command.compare("make-vclass") == 0) {
      if (parsed_line.size() < 4) {
	top_error("Bad vclass line, too few arguments.");
      } else {
	crope name = parsed_line[1];
	crope weight = parsed_line[2];
	double gweight;
	if (sscanf(weight.c_str(),"%lg",&gweight) != 1) {
	  top_error("Bad vclass line, invalid weight.");
	  gweight = 0;
	}
	
	tb_vclass *v = new tb_vclass(name,gweight);
	vclass_map[name] = v;
	for (unsigned int i = 3;i<parsed_line.size();++i) {
	  v->add_type(parsed_line[i]);
	  vtypes.push_front(parsed_line[i]);
	}
      }
    } else if (command.compare("fix-node") == 0) {
      if (parsed_line.size() != 3) {
	top_error("Bad fix-node line, wrong number of arguments.");
      } else {
	crope virtualnode = parsed_line[1];
	crope physicalnode = parsed_line[2];
	fixed_nodes[virtualnode] = physicalnode;
      }
    } else {
      top_error("Unknown directive: " << command << ".");
    }
  }

  if (errors > 0) {exit(1);}
  
  return num_nodes;
}
