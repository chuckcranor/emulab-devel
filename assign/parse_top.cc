#include "port.h"

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
extern name_name_map rfixed_nodes;
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
	crope bwweight,delayweight,lossweight;
	string_vector parsed_delay,parsed_bw,parsed_loss;
	crope rbw,rbwunder,rbwover;
	crope rdelay,rdelayunder,rdelayover;
	crope rloss,rlossunder,rlossover;
	crope rbwweight,rdelayweight,rlossweight;
	string_vector rparsed_delay,rparsed_bw,rparsed_loss;
	
	parsed_bw = split_line(parsed_line[4],':');
	bw = parsed_bw[0];
	if (parsed_bw.size() == 1) {
	  bwunder = "0";
	  bwover = "0";
	  bwweight = "1";
	} else if (parsed_bw.size() == 3) {
	  bwunder = parsed_bw[1];
	  bwover = parsed_bw[2];
	  bwweight = "1";
	} else if (parsed_bw.size() == 4) {
	  bwunder = parsed_bw[1];
	  bwover = parsed_bw[2];
	  bwweight = parsed_bw[3];
	} else {
	  top_error("Bad link line, bad bandwidth specifier.");
	}
	parsed_delay = split_line(parsed_line[5],':');
	delay = parsed_delay[0];
	if (parsed_delay.size() == 1) {
	  delayunder = "0";
	  delayover = "0";
	  delayweight = "1";
	} else if (parsed_delay.size() == 3) {
	  delayunder = parsed_delay[1];
	  delayover = parsed_delay[2];
	  delayweight = "1";
	} else if (parsed_delay.size() == 4) {
	  delayunder = parsed_delay[1];
	  delayover = parsed_delay[2];
	  delayweight = parsed_delay[3];
	} else {
	  top_error("Bad link line, bad delay specifier.");
	}
	parsed_loss = split_line(parsed_line[6],':');
	loss = parsed_loss[0];
	if (parsed_loss.size() == 1) {
	  lossunder = "0";
	  lossover = "0";
	  lossweight = "1";
	} else if (parsed_loss.size() == 3) {
	  lossunder = parsed_loss[1];
	  lossover = parsed_loss[2];
	  lossweight = "1";
	} else if (parsed_loss.size() == 4) {
	  lossunder = parsed_loss[1];
	  lossover = parsed_loss[2];
	  lossweight = parsed_loss[4];
	} else {
	  top_error("Bad link line, bad loss specifier.");
	}

	int next_arg = 7;
	if (parsed_line.size() > 9) {
	  next_arg = 10;
	  rparsed_bw = split_line(parsed_line[7],':');
	  rbw = rparsed_bw[0];
	  if (rparsed_bw.size() == 1) {
	    rbwunder = "0";
	    rbwover = "0";
	    rbwweight = "1";
	  } else if (rparsed_bw.size() == 3) {
	    rbwunder = rparsed_bw[1];
	    rbwover = rparsed_bw[2];
	    rbwweight = "1";
	  } else if (rparsed_bw.size() == 4) {
	    rbwunder = rparsed_bw[1];
	    rbwover = rparsed_bw[2];
	    rbwweight = rparsed_bw[3];
	  } else {
	    top_error("Bad link line, bad rbandwidth specifier.");
	  }
	  rparsed_delay = split_line(parsed_line[8],':');
	  rdelay = rparsed_delay[0];
	  if (rparsed_delay.size() == 1) {
	    rdelayunder = "0";
	    rdelayover = "0";
	    rdelayweight = "1";
	  } else if (rparsed_delay.size() == 3) {
	    rdelayunder = rparsed_delay[1];
	    rdelayover = rparsed_delay[2];
	    rdelayweight = "1";
	  } else if (rparsed_delay.size() == 4) {
	    rdelayunder = rparsed_delay[1];
	    rdelayover = rparsed_delay[2];
	    rdelayweight = rparsed_delay[3];
	  } else {
	    top_error("Bad link line, bad delay specifier.");
	  }
	  rparsed_loss = split_line(parsed_line[9],':');
	  rloss = rparsed_loss[0];
	  if (rparsed_loss.size() == 1) {
	    rlossunder = "0";
	    rlossover = "0";
	    rlossweight = "1";
	  } else if (rparsed_loss.size() == 3) {
	    rlossunder = rparsed_loss[1];
	    rlossover = rparsed_loss[2];
	    rlossweight = "1";
	  } else if (rparsed_loss.size() == 4) {
	    rlossunder = rparsed_loss[1];
	    rlossover = rparsed_loss[2];
	    rlossweight = rparsed_loss[4];
	  } else {
	    top_error("Bad link line, bad rloss specifier.");
	  }
	} else {
	  rbw = bw;
	  rbwunder = bwunder;
	  rbwover = bwover;
	  rbwweight = bwweight;
	  rdelay = delay;
	  rdelayunder = delayunder;
	  rdelayover = delayover;
	  rdelayweight = delayweight;
	  rloss = loss;
	  rlossunder = lossunder;
	  rlossover = lossover;
	  rlossweight = lossweight;
	}
	vedge e;
	vvertex node1 = vname2vertex[src];
	vvertex node2 = vname2vertex[dst];
	e = add_edge(node1,node2,VG).first;
	tb_vlink *l = new tb_vlink();
	put(vedge_pmap,e,l);
	
	if ((sscanf(bw.c_str(),"%d",&(l->delay_info.bandwidth)) != 1) ||
	    (sscanf(bwunder.c_str(),"%d",&(l->delay_info.bw_under)) != 1) ||
	    (sscanf(bwover.c_str(),"%d",&(l->delay_info.bw_over)) != 1) ||
	    (sscanf(bwweight.c_str(),"%lg",&(l->delay_info.bw_weight)) != 1) ||
	    (sscanf(delay.c_str(),"%d",&(l->delay_info.delay)) != 1) ||
	    (sscanf(delayunder.c_str(),"%d",&(l->delay_info.delay_under)) != 1) ||
	    (sscanf(delayover.c_str(),"%d",&(l->delay_info.delay_over)) != 1) ||
	    (sscanf(delayweight.c_str(),"%lg",&(l->delay_info.delay_weight)) != 1) ||
	    (sscanf(loss.c_str(),"%lg",&(l->delay_info.loss)) != 1) ||
	    (sscanf(lossunder.c_str(),"%lg",&(l->delay_info.loss_under)) != 1) ||
	    (sscanf(lossover.c_str(),"%lg",&(l->delay_info.loss_over)) != 1) ||
	    (sscanf(lossweight.c_str(),"%lg",&(l->delay_info.loss_weight)) != 1)) {
	  top_error("Bad line line, bad delay characteristics.");
	}

	if ((sscanf(rbw.c_str(),"%d",&(l->rdelay_info.bandwidth)) != 1) ||
	    (sscanf(rbwunder.c_str(),"%d",&(l->rdelay_info.bw_under)) != 1) ||
	    (sscanf(rbwover.c_str(),"%d",&(l->rdelay_info.bw_over)) != 1) ||
	    (sscanf(rbwweight.c_str(),"%lg",&(l->rdelay_info.bw_weight)) != 1) ||
	    (sscanf(rdelay.c_str(),"%d",&(l->rdelay_info.delay)) != 1) ||
	    (sscanf(rdelayunder.c_str(),"%d",&(l->rdelay_info.delay_under)) != 1) ||
	    (sscanf(rdelayover.c_str(),"%d",&(l->rdelay_info.delay_over)) != 1) ||
	    (sscanf(rdelayweight.c_str(),"%lg",&(l->rdelay_info.delay_weight)) != 1) ||
	    (sscanf(rloss.c_str(),"%lg",&(l->rdelay_info.loss)) != 1) ||
	    (sscanf(rlossunder.c_str(),"%lg",&(l->rdelay_info.loss_under)) != 1) ||
	    (sscanf(rlossover.c_str(),"%lg",&(l->rdelay_info.loss_over)) != 1) ||
	    (sscanf(rlossweight.c_str(),"%lg",&(l->rdelay_info.loss_weight)) != 1)) {
	  top_error("Bad line line, bad reverse delay characteristics.");
	}
      
	l->no_connection = false;
	l->name = name;
	l->allow_delayed = true;
	l->emulated = false;
	l->must_delayed = false;
	
	for (unsigned int i = next_arg;i < parsed_line.size();++i) {
	  if (parsed_line[i].compare("nodelay") == 0) {
	    if (l->must_delayed) {
	      top_error("Can not have both mustdelay and nodelay.");
	    }
	    l->allow_delayed = false;
	  } else if (parsed_line[i].compare("emulated") == 0) {
	    l->emulated = true;
	  } else if (parsed_line[i].compare("mustdelay") == 0) {
	    if (l->allow_delayed == false) {
	      top_error("Can not have both mustdelay and nodelay.");
	    }
	    l->must_delayed = true;
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
	rfixed_nodes[physicalnode] = virtualnode;
      }
    } else {
      top_error("Unknown directive: " << command << ".");
    }
  }

  if (errors > 0) {exit(1);}
  
  return num_nodes;
}
