
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
} violated_info;

extern double score;
extern int violated;
extern violated_info vinfo;

void init_score();
void remove_node(vvertex n);
int add_node(vvertex n,pvertex loc);
double get_score();
double fd_score(tb_vnode &vnoder,tb_pnode &pnoder,int *fd_violated);

#endif
