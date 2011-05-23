/*
 * EMULAB-COPYRIGHT
 * Copyright (c) 2003-2010 University of Utah and the Flux Group.
 * All rights reserved.
 */

static const char rcsid[] = "$Id: anneal.cc,v 1.46 2009-05-20 18:06:07 tarunp Exp $";

#include "anneal.h"

#include "virtual.h"
#include "maps.h"
#include "common.h"
#include "score.h"
#include "vclass.h"
#include "neighborhood.h"

#include <vector>

// From assign.cc
#ifdef GNUPLOT_OUTPUT
extern FILE *scoresout, *tempout, *deltaout;
#endif

// Determines whether to accept a change of score difference 'change' at
// temperature 'temperature'.
inline bool annealer::accept(double change, double temperature) const {
  double p;
  int r;

  if (change == 0) {
    p = 1000 * temperature / params.temp_prob;
  } else {
    p = expf(change/temperature) * 1000;
  }
  r = RANDOM() % 1000;
  if (r < p) {
    return 1;
  }
  return 0;
}

inline float annealing_parameters::get_epsilon() const {
  if (this->local_derivative) {
    /*
     * We need a much smaller epsilon when looking at the local score changes,
     * since the absolute values are much smaller.
     */
    return 0.0001;
  } else {
    return 0.01;
  }
}

/*
 * Dump annealing parameters
 */
ostream &operator<<(ostream &o, const annealing_parameters &ap) {
    o << "Annealing Parameters:" << endl;
    if (ap.epsilon_terminate) {
        o << "    epsilon_terminate" << endl;
    }
    if (ap.finish_hillclimb) {
        o << "    finish_hillclimb" << endl;
    }
    if (ap.local_derivative) {
        o << "    local_derivative" << endl;
    }
    if (ap.melt) {
        o << "    melt" << endl;
    } else {
        o << "    initial_temperature: " << ap.initial_temperature << endl;    
    }
    if (ap.temperature_guard != -1.0) {
        o << "    temperature_guard = " << ap.temperature_guard << endl;
    }
    if (ap.timetarget > 0.0) {
        o << "    timetarget = " << ap.timetarget << endl;
    }
    if (ap.timelimit > 0.0) {
        o << "    timelimit = " << ap.timelimit << endl;
    }
    if (ap.allow_overload) {
        o << "    allow_overload" << endl;
    }
    if (ap.use_connected_pnode_find > 0.0) {
        o << "    use_connected_pnode_find = " << ap.use_connected_pnode_find
            << endl;
    }
    if (ap.scoring_selftest) {
        o << "    scoring_selftest" << endl;
    }
    if (ap.check_fixed_nodes) {
        o << "    check_fixed_nodes" << endl;
    }
    if (ap.scale_neighborhood != 1.0) {
        o << "    scale_neighborhood = " << ap.scale_neighborhood << endl;
    }
    
    return o;
}

void annealer::status_report(ostream &o) const {
  o << "I: " << iters << " T: " << temp << " S: " << get_score() << " V: "
    << violated << " (Best S: " << best_score << " V:" << best_violated << ")"
    << endl;	
}

/* When this is finished the state will reflect the best solution found. */
void annealer::anneal() {
     
  cout << "Annealing." << endl;

  // Print out parameters so that we can check them
  cout << params;

  /*
   * The score and number of violations at the start of the inner annealing
   * loop
   */
  double prev_score = 0;
  int prev_violated = 0;

  float temp_rate = params.temp_rate;

  /*
   * 
   */
  double new_score = 0;
  double scorediff;
 
  // The number of iterations that took place.
  iters = 0;
  iters_to_best = 0;
  int accepts = 0;
  
  // Used for figuring out how much time we might have wasted
  double time_to_first_valid = 0.0;
  double time_to_best = 0.0;

  int nnodes = num_vertices(VG);
  //int npnodes = num_vertices(PG);
  int npclasses = pclasses.size();
  
  bool done = false;
 
  int trans;

  pvertex oldpos;
  bool oldassigned;
  double meltedtemp;
  temp = params.init_temp;
  double deltatemp, deltaavg;
  
  /*
   * Used only for statistical purposes
   */
  int solutions_considered = 0;
  int valid_solutions_considered = 0;
  int solutions_accepted = 0;
  int valid_solutions_accepted = 0;

#ifdef VERBOSE
  cout << "Initialized to cycles="<<cycles<<" mintrans="
       << mintrans<<" naccepts="<<naccepts<< endl;
#endif

  /*
   * Set up the initial counts
   */
  init_score();

  /*
   * Handle the fixed nodes in the topology
   */
  bool fix_failed = setup_fixed_nodes();
  if (fix_failed){
      cout << "*** Some fixed nodes failed to map" << endl;
      exit(EXIT_UNRETRYABLE);
  }

  /* 
   * We'll check against this later to make sure that whe we've unmapped
   * everything, the score is the same
   */
  double initial_score = get_score();

  /*
   * Handle node hints - we do this _after_ we've figured out the initial
   * score, since, unlike fixed nodes, hints get unmapped before we do the
   * final mapping. Also, we ignore any hints for vnodes which have already
   * been assigned - they must have been fixed, and that over-rides the hint.
   */
  setup_hinted_nodes();
  
  /*
   * Set up the unassigned_nodes structure so that we know what work we
   * need to do!
   * TODO: This might move to the virtual topology structure
   */
  setup_unassigned_nodes(); 
   
  /*
   * Set up initial conditions - what we've got is the best solution so far
   */
  prev_score = get_score();
  prev_violated = violated;
  best_score = prev_score;
  best_violated = prev_violated;
  
  // Copy the current assignments into the best_solution variable.
  best_solution.set(VG);


  /*
   * The neighborhood size is the number of solutions we can reach with one
   * transition operation - it's roughly the number of virtual nodes times the
   * number of pclasses. This is how long we usually stick with a given 
   * temperature.
   */
   
  // Subtract the number of fixed nodes from nnodes, since they don't really
  // count
  if (fixed_node_count > 0) {
     cout << "Adjusting dificulty estimate for fixed nodes, " <<
             (nnodes - fixed_node_count) << " remain.\n";
  }

  int neighborsize;
  neighborsize = (nnodes - fixed_node_count) * npclasses;
  if (neighborsize < params.min_neighborhood_size) {
    neighborsize = params.min_neighborhood_size;
  }

  // Allow scaling of the neighborhood size, so we can make assign try harder
  // (or less hard)
  neighborsize = (int)(neighborsize * params.scale_neighborhood);

#ifdef CHILL
  std::vector<double> scores;
  scores.resize(neighborsize+1);
#endif

  if (fixed_node_count >= nnodes) {
    cout << "All nodes are fixed.  No annealing." << endl;
    done = true;
  }
  
  vvertex vv;
  tb_vnode *vn;

  // Crap added by ricci
  bool melting;
  int nincreases, ndecreases;
  double avgincrease;
  double avgscore;
  double initialavg;
  double stddev;
  bool finished; 
  bool forcerevert; 
  // Lame, we have to do this on a seperate line, or the compiler gets mad about
  // the goto above crossing initialization. Well, okay, okay, I know the goto
  // itself is lame....
  finished = forcerevert = false;
  int tsteps;
  int mintsteps;
	
  double meltstart;

#define MAX_AVG_HIST 16
  double avghist[MAX_AVG_HIST];
  int hstart, nhist;
  hstart = nhist = 0;
  double lasttemp;
  double smoothedavg, lastsmoothed;
  lastsmoothed = 500000.0f;
  lasttemp = 5000.0f;
  int melttrials;
  melttrials = 0;

  bool finishedonce;
  finishedonce = false;

  tsteps = 0;
  mintsteps = MAX_AVG_HIST;
  tsteps = 0;
  mintsteps = MAX_AVG_HIST;
  tsteps = 0;
  mintsteps = MAX_AVG_HIST;

  // Make sure the last two don't prevent us from running!
  avgscore = initialavg = 1.0;

  stddev = 0;

  /*
   * Initial temperature calcuation/melting
   */
  if (params.melt) {
      melting = true;
  } else {
      melting = false;
      temp = params.initial_temperature;
      cout << "Starting with initial temperature " << temp << endl;
  }
 
  meltstart = used_time();
  
  
  /*
   * The main annealing loop!
   * Each iteration is a temperature step - how we get out of the loop depends
   * on what the termination condition is. Normally, we have a target temperature
   * at which we stop, but with epsilon_terminate, we watch the derivative of the
   * average temperature, and break out of the loop when it gets small enough.
   */
  while(!done && (params.epsilon_terminate || (temp >= params.temp_stop))) {
      
#ifdef VERBOSE
    cout << "Temperature:  " << temp << " Best: " << best_score <<
      " (" << best_violated << ")" << endl;
#endif

    /*
     * Initialize this temperature step
     */
    trans = 0;
    accepts = 0;
    nincreases = ndecreases = 0;
    avgincrease = 0.0;
    avgscore = prev_score;
#ifdef CHILL
    scores[0] = prev_score;
#endif

    // Adjust the number of transitions we're going to do based on the number
    // of pclasses that are actually 'in play'
    int transitions = (int)(neighborsize *
      (count_enabled_pclasses() *1.0 / pclasses.size()));
    assert(transitions <= neighborsize);

    if (melting) {
      cout << "Doing melting run" << endl;
    }

    /*
     * The inner loop - 
     * Each iteration of this inner loop corresponds to one attempt to try a new
     * solution. When we're melting, we have a special number of transitions
     * we're shooting for.
     */
    while ((melting && (trans < neighborsize))
	    || (trans < transitions)) {

    RDEBUG(cout << "ANNEALING: Loop starts with score " << get_score() <<
            " violations " << violated << endl;)

#ifdef STATS
      cout << "STATS temp:" << temp << " score:" << get_score() <<
	" violated:" << violated << " trans:" << trans <<
	" accepts:" << accepts << " current_time:" <<
	used_time() << endl;
#endif 
      pvertex newpos;
      trans++;
      iters++;

      /*
       * Find a virtual node to map -
       * If there are any virtual nodes that are not yet mapped, start with
       *   those
       * If not, find some other random vnode, which we'll unmap then remap
       */
      if (! unassigned_nodes.empty()) {
        // Pick a random node from the list of unassigned nodes
        int choice = RANDOM() % unassigned_nodes.size();
        slist<vvertex>::iterator uit = unassigned_nodes.begin();
        for (int i = 0; i < choice; i++) { uit++; }
        assert(uit != unassigned_nodes.end());

        vv = *uit;
	assert(!get(vvertex_pmap,vv)->assigned);
        unassigned_nodes.erase(uit);
        RDEBUG(cout << "Using unassigned node " << choice << ": " <<
                get(vvertex_pmap,vv)->name << " (" <<
                unassigned_nodes.size() << " in queue)" << endl;)
      } else {
	int start = RANDOM()%nnodes;
	int choice = start;
	while (get(vvertex_pmap,virtual_nodes[choice])->fixed) {
	  choice = (choice +1) % nnodes;
	  if (choice == start) {
	      choice = -1;
	      break;
	  }
	}
	if (choice >= 0) {
	    vv = virtual_nodes[choice];
	} else {
	    cout << "**** Error, unable to find any non-fixed nodes" << endl;
	    exit(EXIT_UNRETRYABLE);
	}
      }      
      vn = get(vvertex_pmap,vv);
      RDEBUG(cout << "Reassigning " << vn->name << endl;)
	  
      /*
       * Keep track of the old assignment for this node
       */
      oldassigned = vn->assigned;
      oldpos = vn->assignment;

      if (oldassigned) {
          RDEBUG(cout << "   was assigned to " <<
                  get(pvertex_pmap,oldpos)->name << endl;)
      }
      
      /*
       * Problem: If we free the chosen vnode now, we might just try remapping
       * it to the same pnode. If FREE_IMMEDIATELY is not set, we do the 
       * later, after we've chosen a pnode unmapping
       */
#ifdef FREE_IMMEDIATELY
      if (oldassigned) {
	remove_node(vv);
	RDEBUG(cout << "Freeing up " << vn->name << endl;)
      }
#endif
      
      /*
       * We have to handle vnodes with vtypes (vclasses) specially - we have
       * to make the vtype pick a type to masquerade as for now.
       */
      if (vn->vclass != NULL) {
	vn->type = vn->vclass->choose_type();
#ifdef SCORE_DEBUG
	cerr << "vclass " << vn->vclass->get_name()  << ": choose type for " <<
	    vn->name << " = " << vn->type << " dominant = " <<
	    vn->vclass->get_dominant() << endl;
#endif
      }
      
      // Did we free a node?
      bool freednode = false;
      
      /* 
       * Find a pnode to map this vnode to
       */
      tb_pnode *newpnode = NULL;
      if ((params.use_connected_pnode_find != 0)
	  && ((RANDOM() % 1000) < (params.use_connected_pnode_find * 1000))) {
        RDEBUG(cout << "   using find_pnode_connected" << endl;)
	newpnode = find_pnode_connected(vv,vn,params.allow_overload);
      }
      
      /* 
       * If not using the connected find, or it failed to find a node, then
       * fall back on the regular algorithm to find a pnode
       */
      if (newpnode == NULL) {
        RDEBUG(cout << "   using find_pnode" << endl;)
	newpnode = find_pnode(vn, params.allow_overload);
      }
      
      /*
       * If we didn't free the vnode up above, do it now
       */
#ifndef FREE_IMMEDIATELY
      if (oldassigned) {
	RDEBUG(cout << "removing: !lan, oldassigned" << endl;)
	remove_node(vv);
      }
#endif
      
      /*
       * If we didn't find a node to map this vnode to, free up some other
       * vnode so that we can make progress - otherwise, we could get stuck
       */
      if (newpnode == NULL) {
	// Push this node back onto the unassigned map
	unassigned_nodes.push_front(vv);
	int start = RANDOM()%nnodes;
	int toremove = start;
	while (get(vvertex_pmap,virtual_nodes[toremove])->fixed ||
	       (! get(vvertex_pmap,virtual_nodes[toremove])->assigned)) {
	    toremove = (toremove +1) % nnodes;
	  if (toremove == start) {
	    toremove = -1;
            RDEBUG(cout << "Not removing a node" << endl;)
	    break;
	  }	
        }	
        if (toremove >= 0) {
          RDEBUG(cout << "removing: freeing up node " <<
                  get(vvertex_pmap,virtual_nodes[toremove])->name << endl;)
          remove_node(virtual_nodes[toremove]);
          unassigned_nodes.push_front(virtual_nodes[toremove]);
        }	
      
        /*
         * Start again with another vnode - which will probably be the same one,
         * since we just marked it as unmapped. But now, there will be at least one
         * free pnode
         */
        RDEBUG(cout << "Failed to find a possible mapping; try again..." << endl;)
        continue;	
      }
    
      /*
       * Okay, we've got pnode to map this vnode to - let's do it
       */
      if (newpnode != NULL) {	
        RDEBUG(cout << "MOVE: " << vn->name << " to " << newpnode->name << " " << endl;)
        newpos = pnode2vertex[newpnode];
        if (params.scoring_selftest) {
	  // Run a little test here - see if the score we get by adding	
	  // this node, then removing it, is the same one we had before
	  double oldscore = get_score();
	  int oldviolated = violated;
	  double tempscore = -1.0;
	  int tempviolated = -1;
	  if (!add_node(vv,newpos,false,false,false)) {
	    tempscore = get_score();
	    tempviolated = violated;
	    remove_node(vv);
	  }	
	  if (!compare_scores(oldscore,get_score()) || (oldviolated != violated)) {
	    cerr << "Scoring problem adding a mapping - oldscore was " <<
		oldscore <<  " current score is " << get_score() << " tempscore was "
		<< tempscore << endl;
	    cerr << "oldviolated was " << oldviolated << " newviolated is "
		<< violated << " tempviolated was " << tempviolated << endl;
	    cerr << "I was tring to map " << vn->name << " to " <<
		newpnode->name << endl;
	    print_solution(best_solution);
	    cerr << vinfo;
	    abort();
          }
        }
      
        /*
         * Actually try the new mapping - if it fails, the node is still
         * unassigned, and we go back and try with another
         */
        if (add_node(vv,newpos,false,false,false) != 0) {
	  unassigned_nodes.push_front(vv);
          RDEBUG(cout << "failed" << endl;)
	  continue;
        }
      } else { // pnode != NULL
        if (freednode) {
	  continue;
        }	
      }
      
      // Bookkeeping
      solutions_considered++;
      if (violated == 0) {
        valid_solutions_considered++;
      }

      /*
       * Okay, now that we've mapped some new node, let's check the scoring
       */
      new_score = get_score();
      assert(new_score >= 0);

      // Negative means bad
      scorediff = prev_score - new_score;
      // This looks funny, because < 0 means worse, which means an increase in
      // score
      if (scorediff < 0) {
        nincreases++;
        avgincrease = avgincrease * (nincreases -1) / nincreases +
  		    (-scorediff)  / nincreases;
      } else {
        ndecreases++;
      }	
   
      /*
       * Here are all the various conditions for deciding if we're going to accept
       * this transition
       */
      bool accepttrans = false;
      if (melting) {
        // When melting, we take everything!
	accepttrans = true;
	RDEBUG(cout << "accept: melting" << endl;)
      } else {
#ifdef NO_VIOLATIONS
        // Here, we don't consider violations at all, just whether the regular
        // simulated annealing accept conditions
	if (new_score < prev_score) {
	    accepttrans = true;
	    RDEBUG(cout << "accept: better (" << new_score << "," << prev_score
		   << ")" << endl;)
        } else if (accept(scorediff,temp)) {
  	  accepttrans = true;
	  RDEBUG(cout << "accept: metropolis (" << new_score << ","
		 << prev_score << "," << expf(scorediff/(temp*sensitivity))
		 << ")" << endl;)
        }
#else
#ifdef SPECIAL_VIOLATION_TREATMENT
        /*
         * In this ifdef, we always accept new solutions that have fewer
         * violations than the old solution, and when we're trying to
         * determine whether or not to accept a new solution with a higher
         * score, we don't take violations into the account.
         *
         * The problem with this shows up at low temperatures. What can often
         * happen is that we accept a solution with worse violations but a
         * better (or similar) score. Then, if we were to try, say the first
         * solution (or a score-equivalent one) again, we'd accept it again.
         *
         * What this leads to is 'thrashing', where we have a whole lot of
         * variation of scores over time, but are not making any real
         * progress. This prevents the cooling schedule from converging for
         * much, much longer than it should really take.
         */
        RDEBUG(cout << "CRITERIA: v=" << violated << " bv=" <<
                prev_violated << " ns=" << new_score << " ps=" <<
                prev_score << " sd=" << scorediff << " t=" << temp << endl;)
        if ((violated == prev_violated) && (new_score < prev_score)) {
	  accepttrans = true;
	  RDEBUG(cout << "accept: better (" << new_score << "," << prev_score
		 << ")" << endl;)
	} else if (violated < prev_violated) {
	  accepttrans = true;
	  RDEBUG(cout << "accept: better (violations) (" << new_score << ","
		 << prev_score << "," << violated << "," << prev_violated
		 << ")" << endl;)
	    //cout << "Violations: (new) " << violated << endl;
	    //cout << vinfo;
        } else if (accept(scorediff,temp)) {
	  accepttrans = true;
	  RDEBUG(cout << "accept: metropolis (" << new_score << ","
		 << prev_score << "," << scorediff << "," << temp
		 << ")" << endl;)
        }
#else // no SPECIAL_VIOLATION_TREATMENT
        /*
         * In this branch of the ifdef, we give violations no special
         * treatment when it comes to accepting new solution - we just add
         * them into the score. This makes assign behave in a more 'classic'
         * simulated annealing manner.
         *
         * One consequence, though, is that we have to be more careful with
         * scores. We do not want to be able to get into a situation where
         * adding a violation results in a _lower_ score than a solution with
         * fewer violations.
         */
        double adjusted_new_score = new_score + violated * VIOLATION_SCORE;
        double adjusted_old_score = prev_score + prev_violated * VIOLATION_SCORE;

        if (adjusted_new_score < adjusted_old_score) {
          accepttrans = true;
        } else if (accept(adjusted_old_score - adjusted_new_score,temp)) {
	  accepttrans = true;
        }

#endif // SPECIAL_VIOLATION_TREATMENT

      }
#endif // NO_VIOLATIONS

      /* 
       * Okay, we've decided to accep this transition - do some bookkeeping
       */
      if (accepttrans) {
	// Accept change
	prev_score = new_score;
	prev_violated = violated;
	
	// Bookeeping
        solutions_accepted++;
	if (violated == 0) {
          valid_solutions_accepted++;
	}
	
	if (violated == 0 && (time_to_first_valid == 0.0)) {
        cout << "    Found first valid solution on iteration " << iters << endl;
        time_to_first_valid = used_time() - meltstart;
    }

#ifdef GNUPLOT_OUTPUT
	fprintf(tempout,"%f\n",temp);
	fprintf(scoresout,"%f\n",new_score);
	fprintf(deltaout,"%f\n",-scorediff);
#endif // GNUPLOT_OUTPUT

	avgscore += new_score;
	accepts++;

#ifdef CHILL
	 if (!melting) {
             assert(accepts <= neighborsize);
	     scores[accepts] = new_score;
	 }
#endif // CHILL

        /*
         * Okay, if this is the best score we've gotten so far, let's do some
	 * further bookkeeping - copy it into the structures for our best solution
	 */
#ifdef NO_VIOLATIONS
	if (new_score < best_score) {
#else // NO_VIOLATIONS
	if ((violated < best_violated) ||
	    ((violated == best_violated) &&
	     (new_score < best_score))) {
#endif // NO_VIOLATIONS
	    
#ifdef SCORE_DEBUG
	  cerr << "New best solution." << endl;
#endif // SCORE_DEBUG
      best_solution.set(VG);
	  best_score = new_score;
	  best_violated = violated;
	  iters_to_best = iters;
      time_to_best = used_time() - meltstart;
#ifdef SCORE_DEBUG
	  cerr << "New best recorded" << endl;
#endif
	}
      } else { // !acceptrans
	// Reject change, go back to the state we were in before
	RDEBUG(cout << "removing: rejected change" << endl;)
	remove_node(vv);
	if (oldassigned) {
	  add_node(vv,oldpos,false,false,false);
	} else {
          unassigned_nodes.push_front(vv);
        }
      }

      /*
       * If we're melting, we do a little extra bookkeeping to do, becuase the
       * goal of melting is to come up with an initial temperature such that
       * almost every transition will be accepted
       */
      if (melting) {
	temp = avgincrease /
	  log(nincreases/ (nincreases * params.X0 - ndecreases * (1 - params.X0)));
	if (!(temp > 0.0)) {
	    temp = 0.0;
	}
      }
      
      /*
       * With timelimit set, we just give up after our time limit
       */
      if ((params.timelimit != 0.0) && 
		((used_time() - timestart) > params.timelimit)) {
	printf("Reached end of run time, finishing\n");
	forcerevert = true;
	finished = true;
	goto NOTQUITEDONE;
      }

    } /* End of inner annealing loop */
     

NOTQUITEDONE:

    RDEBUG(printf("avgscore: %f = %f / %i\n",avgscore / (accepts +1),avgscore,accepts+1);)
	
    /*
     * Most of the code past this point concerns itself with the cooling
     * schedule (what the next temperature step should be
     */
	
    // Keep an average of the score over this temperature step	
    avgscore = avgscore / (accepts +1);

    /*
     * If we were melting, then we we need to pick an initial temperature
     */
    if (melting) {
      melting = false;
      initialavg = avgscore;
      meltedtemp = temp;
      RDEBUG(cout << "Melting finished with a temperature of " << temp
	<< " avg score was " << initialavg << endl;)
      if (!(meltedtemp > 0.0)) { // This backwards expression to catch NaNs
	cout << "    Finished annealing while melting!" << endl;
	finished = true;
	forcerevert = true;
      } else {
          cout << "Finished melting, picked temperature " << temp << endl;
      }
      /*
       * With timetarget, we look at how long melting took, then use that to
       * estimate how many temperature steps it will take to hit our time
       * target. We adjust our cooling schedule accordingly.
       */
      if (params.timetarget != 0.0) {
	double melttime = used_time() - meltstart;
	double timeleft = params.timetarget - melttime;
	double stepsleft = timeleft / melttime;
	cout << "Melting took " << melttime << " seconds, will try for "
	  << stepsleft << " temperature steps" << endl;
	temp_rate = pow(params.temp_stop/temp,1/stepsleft);
	cout << "Timelimit: " << params.timetarget << " Timeleft: " << timeleft
	  << " temp_rate: " << temp_rate << endl;
      }
    } else {
      /*
       * The CHILL cooling schedule is the standard one from the Simulated
       * Annealing literature - it lower the temperature based on the standard
       * deviation of the scores of accepted configurations
       */
#ifdef CHILL
      if (!melting) {
	  stddev = 0;
	  for (int i = 0; i <= accepts; i++) {
	    stddev += pow(scores[i] - avgscore,2);
	  }
	  stddev /= (accepts +1);
	  stddev = sqrt(stddev);
	  temp = temp / (1 + (temp * log(1 + params.delta))/(3  * stddev));
      }
#else
      /* 
       * This is assign's original cooling schedule - more predictable, but not
       * at all reactive to the problem at hand
       */
      temp *= temp_rate;
#endif
    }


    /*
     * Debugging
     */
#ifdef DEBUG_TSTEP
    if (epsilon_terminate) {
#ifdef CHILL
        RDEBUG(printf("temp_end: %f %f %f\n",temp,temp * avgscore / initialavg,stddev);)
#else /* CHILL */
        RDEBUG(printf("temp_end: %f %f\n",temp,temp * avgscore / initialavg);)
#endif /* CHILL */
    } else { /* epsilon_terminate */
        printf("temp_end: %f ",temp);
        if (trans >= mintrans) {
	        if (accepts >= naccepts) {
	            printf("both");
	        } else {
	            printf("trans %f",accepts*1.0/naccepts);
	        }
        } else {
	        printf("accepts %f",trans*1.0/mintrans);
        }
        printf("\n");
    } /* epsilon_terminate */
#endif /* DEBUG_TSTEP */
    
    RDEBUG(
    printf("temp_end: temp: %f ratio: %f stddev: %f\n",temp,temp * avgscore / initialavg,stddev);
    );

    /*
     * The next section of code deals with termination conditions - how do we
     * decide that we're done?
     */
    
    /*
     * Keep a history of the average scores over the last MAX_AVG_HIST
     * temperature steps. We treat the avghist array like a ring buffer.
     * Add this temperature step to the history, and computer a smoothed
     * average.
     */
    smoothedavg = avgscore / (nhist + 1);
    for (int j = 0; j < nhist; j++) {
      smoothedavg += avghist[(hstart + j) % MAX_AVG_HIST] / (nhist + 1);
    }

    avghist[(hstart + nhist) % MAX_AVG_HIST] = avgscore;
    if (nhist < MAX_AVG_HIST) {
      nhist++;
    } else {
      hstart = (hstart +1) % MAX_AVG_HIST;
    }

    /*
     * Are we computing the derivative of the average temperatures over the
     * whole history, or just the most recent one?
     */
    if (params.local_derivative) {
      deltaavg = lastsmoothed - smoothedavg;
      deltatemp = lasttemp - temp;
    } else {
      deltaavg = initialavg - smoothedavg;
      deltatemp = meltedtemp - temp;
    }

    lastsmoothed = smoothedavg;
    lasttemp = temp;

    /*
     * epsilon_terminate means that we define some small number, epsilon, and
     * the derivative of the average change in temperature gets below that
     * epsilon (ie. we have stopped getting improvements in score), we're done
     */
    if (params.epsilon_terminate) {
        RDEBUG(
           printf("avgs: real: %f, smoothed %f, initial: %f\n",avgscore,smoothedavg,initialavg);
           printf("epsilon: (%f) %f / %f * %f / %f < %f (%f)\n", fabs(deltaavg), temp, initialavg,
    	   deltaavg, deltatemp, epsilon,(temp / initialavg) * (deltaavg/ deltatemp));
        );
        // We have a mininum number of timestepss, and *might* have a minimum
        // temperature that we must reach before we will stop. Note that the
        // temperature_guard clause is formulated to give the correct result
        // even when temp goes to nan
        if ((tsteps >= mintsteps) &&
                ((params.temperature_guard < 0) ||
                !(temp > params.temperature_guard)) &&
        /*
         * ALLOW_NEGATIVE_DELTA controls whether we're willing to stop if the
         * derivative gets small and negative, not just small and positive.
         */
#ifdef ALLOW_NEGATIVE_DELTA
    	((temp < 0) || isnan(temp) ||
    //	 || (fabs((temp / initialavg) * (deltaavg/ deltatemp)) < epsilon))) {
    	 ((temp / initialavg) * (deltaavg/ deltatemp)) < params.get_epsilon())) {
#else /* ALLOW_NEGATIVE_DELTA */
    	(deltaavg > 0) && ((temp / initialavg) * (deltaavg/ deltatemp) < params.get_epsilon())) {
#endif /* ALLOW_NEGATIVE_DELTA */
        
            /*
             * Normally, we are done here.
             */
    		forcerevert = true;
            if (!params.finish_hillclimb) {
                finished = true;
            } else {
                /*
                 * This option goes back to the best result we ever found, and
                 * goes one more round - the idea is to finish up with a very
                 * low temperature, at which will will probably take only
                 * better solutions (hillclimbing)
                 */
                if (!finishedonce &&
                     ((best_violated <= violated) && (best_score < prev_score))) {
                    finishedonce = true;
                    cout << "Epsilon Terminated, but going back to a better solution"
                        << endl;
                } else {
                    finished = true;
                }
            }
        }
    } /* epsilon_terminate */
    
    /*
     * RANDOM_ASSIGNMENT is not really very random, but we stop after the first
     * valid solution we get
     */
#ifdef RANDOM_ASSIGNMENT
    if (violated == 0) {
       finished = true;
    }
#endif

    /*
     * REALLY_RANDOM_ASSIGNMENT stops after we've assigned all nodes, whether or
     * not our solution is valid
     */
#ifdef REALLY_RANDOM_ASSIGNMENT
    if (unassigned_nodes.size() == 0) {
      finished = true;
    }
#endif

    /*
     * The following section deals with reverting. This is not standard
     * Simulated Annealing at all. In assign, a revert means that we go back
     * to some previous solution (usually a better one). There are lots of
     * things that could trigger this, so we use a bool to check if any of
     * them happened.
     */
    bool revert = false;
    
    /*
     * Some of the termination condidtions force a revert when they decide
     * they're finished. This is fine - of course, we want to return the best
     * solution we ever found, which might not be the one we're sitting at right
     * now.
     */
    if (forcerevert) {
      cout << "Reverting: forced" << endl;
      revert = true;
    }
    if (!params.epsilon_terminate && (temp < params.temp_stop)) {
       cout << "Reverting: finished annealing" << endl;
       revert = true;
    }
  
    /*
     * Okay, NO_REVERT is not the best possible name for this ifdef. 
     * Historically, assign used to revert to the best solution at the end of
     * every temperature step. This is definitely NOT kosher. In my mind, it
     * assign too susceptible to falling into local minima. Anyhow, the idea is
     * that we go back to the best soltion if the current solution is worse than
     * it either in violations or in score.
     */
#ifndef NO_REVERT
    if (REVERT_VIOLATIONS && (best_violated < violated)) {
	cout << "Reverting: REVERT_VIOLATIONS" << endl;
	revert = true;
    }
    if (best_score < prev_score) {
	cout << "Reverting: best score" << endl;
	revert = true;
    }
#endif

    /*
     * This is the code to do the actual revert.
     * IMPORTANT: At this time, a revert does not take you back to _exactly_ the
     * same state as before, because there are some things, like link
     * assignments, that we don't save. Since the way these get mapped is
     * dependant on the order they happen in, and this order is almost certainly
     * different than the order they got mapped during annealing, there can be
     * discrepancies (ie. now we have violations, when before we had none.)
     */
    vvertex_iterator vvertex_it,end_vvertex_it;
    vedge_iterator vedge_it,end_vedge_it;
    if (revert) {
      cout << "Reverting to best solution\n";
      /*
       * We start out by unmapping every vnode that's currently allocated
       */
      tie(vvertex_it,end_vvertex_it) = vertices(VG);
      for (;vvertex_it!=end_vvertex_it;++vvertex_it) {
	tb_vnode *vnode = get(vvertex_pmap,*vvertex_it);
	if (vnode->fixed) continue;
	if (vnode->assigned) {
	  RDEBUG(cout << "removing: revert " << vnode->name << endl;)
	  remove_node(*vvertex_it);
          // Add to the list of unassigned nodes in case we're going to
          // keep annealing
          unassigned_nodes.push_front(*vvertex_it);
	} else {
	  RDEBUG(cout << "not removing: revert " << vnode->name << endl;)
	}
      }

      // Check to make sure that our 'clean' solution scores the same as
      // the initial score - if not, that indicates a bug
      if (!compare_scores(get_score(),initial_score)) {
	  cout << "*** WARNING: 'Clean' score does not match initial score" <<
	      endl << "     This indicates a bug - contact the operators" <<
	      endl << "     (initial score: " << initial_score <<
	      ", current score: " << get_score() << ")" << endl;
      }
      
      /* 
       * Now, go through the previous best solution, and add all of the node
       * mappings back in.
       */
      tie(vvertex_it,end_vvertex_it) = vertices(VG);
      for (;vvertex_it!=end_vvertex_it;++vvertex_it) {
	tb_vnode *vnode = get(vvertex_pmap,*vvertex_it);
	if (vnode->fixed) continue;
	if (best_solution.is_assigned(*vvertex_it)) {
	  if (vnode->vclass != NULL) {
	    vnode->type = best_solution.get_vtype_assignment(*vvertex_it);
	  }
	  assert(!add_node(*vvertex_it,best_solution.get_assignment(*vvertex_it),true,false,true));
          // Remove from list of unassigned nodes
          unassigned_nodes.remove(*vvertex_it);
	}
      }
      
      /*
       * Add back in the old link resolutions
       */
      tie(vedge_it,end_vedge_it) = edges(VG);
      for (;vedge_it != end_vedge_it; ++vedge_it) {
	  tb_vlink *vlink = get(vedge_pmap,*vedge_it);
          tb_vnode *src_vnode = get(vvertex_pmap,vlink->src);
          tb_vnode *dst_vnode = get(vvertex_pmap,vlink->dst);
	  if (best_solution.link_is_assigned(*vedge_it)) {
	      // XXX: It's crappy that I have to do all this work here - something
	      // needs re-organzing
	      /*
	       * This line does the actual link mapping revert
		*/
	      vlink->link_info = best_solution.get_link_assignment(*vedge_it);
	      
	      if (!dst_vnode->assigned || !src_vnode->assigned) {
		  // This shouldn't happen, but don't try to score links which
		  // don't have both endpoints assigned.
		  continue;
	      }
              if (dst_vnode->fixed && src_vnode->fixed) {
                  // If both endpoints were fixed, this link never got
                  // unmapped, so don't map it again
                  continue;
              }
	      tb_pnode *src_pnode = get(pvertex_pmap,src_vnode->assignment);
	      tb_pnode *dst_pnode = get(pvertex_pmap,dst_vnode->assignment);
	      
	      /*
	       * Okay, now that we've jumped through enough hoops, we can actually
	       * do the scoring
	       */
              mark_vlink_assigned(vlink);
	      score_link_info(*vedge_it, src_pnode, dst_pnode, src_vnode, dst_vnode);
	  } else {
              /*
               * If one endpoint or the other was unmapped, we just note that
               * the link wasn't mapped - however, if both endpoints were
               * mapped, then we have to make sure the score reflects that.
               */
	      if (!dst_vnode->assigned || !src_vnode->assigned) {
                  if (!vlink->no_connection) {
                      mark_vlink_unassigned(vlink);
                  }
              }
	  }
      }
    } // End of reverting code

    /*
     * Whew, that's it!
     */
    tsteps++;

    if (finished) {
        done = true;
    }
  } /* End of outer annealing loop */

  cout << "Done annealing" << endl;
  
  /*
   * Print out some useful statistics
   */
  double finished_time = used_time();
  double annealing_time = finished_time - meltstart;
  
  cout << "    Total annealing time: " << annealing_time << endl;
  cout << "    Total temperature steps: " << tsteps << endl;
  cout << "    Total iterations: " << iters << endl;
  cout << "    Finshed at temperature: " << temp << endl;
  cout << "    Average iterations per second: " << (iters/annealing_time)
       << endl;
  cout << "    Number of solutions considered: " << solutions_considered
       << endl;
  cout << "    Fraction of iterations during which a solution was considered: "
       << ((solutions_considered*1.0)/iters) << endl;
  cout << "    Fraction of solutions accepted: "
       << ((solutions_accepted*1.0)/solutions_considered) << endl;
  cout << "    Fraction of potential solutions that were valid: "
       << ((valid_solutions_considered*1.0)/solutions_considered) << endl;
  cout << "    Fraction of accepted solutions that were valid: "
       << ((valid_solutions_accepted*1.0)/solutions_accepted) << endl;
  if (time_to_first_valid > 0.0) {
    cout << "    Fraction of time to find first valid solution: "
         << (time_to_first_valid / annealing_time) << endl;
  }

  if (time_to_best > 0.0) {
    cout << "    Fraction of time to find best solution: "
         << (time_to_best / annealing_time) << endl;
  }
  
} // End of anneal()

/*
 * Set up fixed nodes
 */
bool annealer::setup_fixed_nodes() {
    
    fixed_node_count = 0;
    
    /* 
     * Count of nodes which could not be fixed - we wait until we've tried to fix
     * all nodes before bailing, so that the user gets to see all of the
     * messages.
     */
    int fix_failed = 0;
    for (name_name_map::iterator fixed_it=fixed_nodes.begin();
         fixed_it!=fixed_nodes.end();
         ++fixed_it) {
    
        if (vname2vertex.find((*fixed_it).first) == vname2vertex.end()) {
            cout << "*** Fixed virtual node: " << (*fixed_it).first <<
                    " does not exist." << endl;
            fix_failed++;
            continue;
        }
        
        vvertex vv = vname2vertex[(*fixed_it).first];
        if (pname2vertex.find((*fixed_it).second) == pname2vertex.end()) {
            cout << "*** Fixed physical node: " << (*fixed_it).second <<
                    " not available." << endl;
            fix_failed++;
            continue;
        }
        
        pvertex pv = pname2vertex[(*fixed_it).second];
        tb_vnode *vn = get(vvertex_pmap,vv);
        tb_pnode *pn = get(pvertex_pmap,pv);
        if (vn->vclass != NULL) {
            // Find a type on this physical node that can satisfy something in the
            // virtual class
            if (pn->typed) {
                if (vn->vclass->has_type(pn->current_type)) {
                    vn->type = pn->current_type;
                }
            } else {
                for (tb_pnode::types_list::iterator i = pn->type_list.begin();
                     i != pn->type_list.end();
                     i++) {
                    // For now, if we find more than one match, we pick the first. It's
                    // possible that picking some other type would give us a better
                    // score, but let's noty worry about that
                    if (vn->vclass->has_type((*i)->get_ptype()->name())) {
                        vn->type = (*i)->get_ptype()->name();
                        break;
                    }
                }
            }
        
            if (vn->type.empty()) {
                // This is an internal error, so it's okay to handle it in a different
                // way from the others
                cout << "*** Unable to find a type for fixed, vtyped, node " << vn->name
                     << endl;
                exit(EXIT_FATAL);
            } else {
                cout << "Setting type of vclass node " << vn->name << " to "
                     << vn->type << "\n";
            }
        }

        /*
         * Normally, we want to bypass some checks in add_node for fixed nodes -
         * but not always (usually for testing purposes).
         */
         
        bool skip_checks = true;
        if (params.check_fixed_nodes) {
            skip_checks = false;
        }

        if (add_node(vv,pv,false,skip_checks,false) == 1) {
            cout << "*** Fixed node: Could not map " << vn->name <<
                    " to " << pn->name << endl;
            fix_failed++;
            continue;
        }
        
        vn->fixed = true;

        fixed_node_count++;
    }

    return (fix_failed > 0);
}

/*
 * Assign hinted nodes to their starting locations
 */
void annealer::setup_hinted_nodes() {
    for (name_name_map::iterator hint_it = node_hints.begin();
         hint_it!=node_hints.end();
         ++hint_it) {
             
        if (vname2vertex.find((*hint_it).first) == vname2vertex.end()) {
            cout << "Warning: Hinted node: " << (*hint_it).first <<
    	            "does not exist." << endl;
            continue;
        }
    
        vvertex vv = vname2vertex[(*hint_it).first];
        if (pname2vertex.find((*hint_it).second) == pname2vertex.end()) {
          cout << "Warning: Hinted node: " << (*hint_it).second <<
    	          " not available." << endl;
          continue;
        }
    
        pvertex pv = pname2vertex[(*hint_it).second];
        tb_vnode *vn = get(vvertex_pmap,vv);
        tb_pnode *pn = get(pvertex_pmap,pv);
        if (vn->assigned) {
            cout << "Warning: Skipping hint for node " << vn->name << ", which is "
    	         << "fixed in place" << endl;
            continue;
        }
        if (add_node(vv,pv,false,false,false) == 1) {
            cout << "Warning: Hinted node: Could not map " << vn->name <<
    	            " to " << pn->name << endl;
            continue;
        }
    }
}

/*
 * Make a list of all nodes that are currently unassigned
 */
void annealer::setup_unassigned_nodes() {
    
    unassigned_nodes.clear();
    
    // Simple, just go through the topology looking for unassigned nodes
    vvertex_iterator vit,veit;
    tie(vit,veit) = vertices(VG);
    for (;vit!=veit;++vit) {
        tb_vnode *vn = get(vvertex_pmap,*vit);
        if (!vn->assigned) {
    	    unassigned_nodes.push_front(*vit);
        }
    }
}