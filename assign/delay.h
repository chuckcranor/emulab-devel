#ifndef __DELAY_H
#define __DELAY_H

class tb_pnode;

class tb_delay_info {
public:
  tb_delay_info(int bw,int d,double l) : bandwidth(bw), delay(d), loss(l) {;}
  tb_delay_info() : bandwidth(100), delay(0), loss(0) {;}
  tb_delay_info(int bw) : bandwidth(bw), delay(0), loss(0) {;}
  tb_delay_info(tb_delay_info &o) {
    bandwidth=o.bandwidth;delay=o.delay;loss=o.loss;
  }

  int bandwidth;
  int delay;
  double loss;

  double distance(tb_delay_info &o) {
    return (fabs((double)o.bandwidth/(double)bandwidth-1)+
	    fabs(o.loss/loss-1)+
	    fabs((double)o.delay/(double)delay-1))/3;
  }

  friend ostream &operator<<(ostream &o, const tb_delay_info& delay)
  {
    o << "tb_delay_info: bw=" << delay.bandwidth << " delay=" <<
      delay.delay  << " loss=" << delay.loss << endl;
    return o;
  }
};

class tb_delay_node {
public:
  tb_pnode *pnode;		// which pnode we're in
  tb_delay_info delay;		// how much this delay node delays

  friend ostream &operator<<(ostream &o, const tb_delay_node& delay)
  {
    o << "TO BE IMPLEMENTED!" << endl;
    return o;
  }
};

#endif __DELAY_H


