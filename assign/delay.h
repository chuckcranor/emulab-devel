#ifndef __DELAY_H
#define __DELAY_H

#include <math.h>

class tb_pnode;

template <class T> inline double basic_distance(T a,T b) {
  if ((a == 0) || (b == 0)) return 1;
  if (a == b) return 0;
  double ab;
  if (a < b) {ab = b/a;} else {ab = a/b;}
  return exp(-1/(3*(ab-1)));
}
inline double delay_distance(int a, int b) {
  return basic_distance(a,b);
}
inline double bandwidth_distance(int a,int b) {
  return basic_distance(a,b);
}
inline double loss_distance(double a,double b) {
  return basic_distance(a,b);
}

class tb_delay_info {
public:
  int bandwidth;
  int delay;
  double loss;
  int bw_under,bw_over;
  int delay_under,delay_over;
  double loss_under,loss_over;
  double bw_weight,delay_weight,loss_weight;

  tb_delay_info() : bandwidth(0), delay(0), loss(0), bw_under(0),
		    bw_over(0), delay_under(0), delay_over(0),
		    loss_under(0), loss_over(0), bw_weight(0),
		    delay_weight(0), loss_weight(0) {;}
  
  double distance(tb_delay_info &target) {
    if (((bw_under != -1) && (target.bandwidth < bandwidth-bw_under)) ||
	((bw_over != -1) && (target.bandwidth > bandwidth+bw_over)) ||
	((delay_under != -1) && (target.delay < delay-delay_under)) ||
	((delay_over != -1) && (target.delay > delay+delay_over)) ||
	((loss_under != -1) && (target.loss < loss-loss_under)) ||
	((loss_over != -1) && (target.loss > loss+loss_over))) {
      return -1;
    }
    return (bandwidth_distance(target.bandwidth,bandwidth)*bw_weight+
	    delay_distance(target.delay,delay)*delay_weight+
	    loss_distance(target.loss,loss)*loss_weight)/3;
  }
  
  friend ostream &operator<<(ostream &o, const tb_delay_info& delay)
  {
    o << "tb_delay_info: bw=" << delay.bandwidth << "+" <<
      delay.bw_over << "-" << delay.bw_under << "/" << delay.bw_weight;
    o << " delay=" << delay.delay << "+" << delay.delay_over <<
      "-" << delay.delay_under << "/" << delay.delay_weight;
    o << " loss=" << delay.loss << "+" << delay.loss_over << "-" <<
      delay.loss_under << "/" << delay.loss_weight;
    o << endl;
    return o;
  }
};


#endif __DELAY_H

