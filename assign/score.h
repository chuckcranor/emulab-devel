
#ifndef _SCORE_H
#define _SCORE_H

typedef struct {
  int unassigned;
  int pnode_load;
  int no_connection;
  int link_users;
  int bandwidth;
  int desires;
  int vclass;
  int delay;
} violated_info;

class tb_removal_record;

class tb_removal_link_record {
public:
  tb_removal_link_record() : delay_record(NULL) {;}
  tb_link_info link_info;
  tb_removal_record *delay_record;
};
class tb_removal_record {
public:
  pvertex assignment;
  typedef hash_map<crope,tb_removal_link_record> link_record_map;
  link_record_map links;
  pvertex lan_switch;		// only for lan nodes
};

extern double score;
extern int violated;
extern violated_info vinfo;

void init_score();
void remove_node(vvertex vv,tb_removal_record *removal);
int add_node(vvertex vv,pvertex pv,bool deterministic,
	     name2pnode_map *delays,tb_removal_record *removal);
double get_score();
double fd_score(tb_vnode &vnoder,tb_pnode &pnoder,int *fd_violated);
pvertex make_lan_node(vvertex vv,name2pnode_map *delay_map,
		      pvertex *the_switch);
void delete_lan_node(pvertex pv);

#endif
