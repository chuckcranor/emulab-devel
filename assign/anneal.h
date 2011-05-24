/*
 * EMULAB-COPYRIGHT
 * Copyright (c) 2003-2010 University of Utah and the Flux Group.
 * All rights reserved.
 */

/*
 * Contains the actual functions to do simulated annealing
 */

#ifndef __ANNEAL_H
#define __ANNEAL_H

#include "port.h"

#include <boost/graph/adjacency_list.hpp>
using namespace boost;

#include <iostream>
using namespace std;

/*
 * We have to do these includes differently depending on which version of gcc
 * we're compiling with
 */
#ifdef NEW_GCC
#include <ext/hash_map>
#include <ext/slist>
using namespace __gnu_cxx;
#else
#include <hash_map>
#include <slist>
#endif

#include <math.h>

#include "delay.h"
#include "physical.h"
#include "pclass.h"
#include "fstring.h"
#include "solution.h"

// Some defaults for #defines
#ifndef NO_REVERT
#define NO_REVERT 0
#endif

#ifndef REVERT_VIOLATIONS
#define REVERT_VIOLATIONS 1
#endif

#ifdef PHYS_CHAIN_LEN
#define PHYSICAL(x) x
#else
#define PHYSICAL(x) 0
#endif

/*
 * TODO: Where do these go?
 */
typedef hash_map<fstring,fstring> name_name_map;
typedef slist<fstring> name_slist;

/*
 * Parameters used to control annealing - we put these in a struct so that
 * we can easily pass them around without having to make a bunch of globals.
 */
class annealing_parameters {
	
	/*
	 * For now, I don't think it makes sense to make a bunch of accesors, so
	 * we'll leave it all public
	 */

public:	
	
	/*
	 * Starting temperature (only used when not using melting)
	 */
	int init_temp;
	
	/*
	 * Used to control the probability of accepting a 0-cost change
	 * TODO: Need to document this better!
	 */
	int temp_prob;
	
	/*
	 * Temperature to stop at, when using the original (not 'chill') cooling
	 * schedule
	 */
	int temp_stop;
	
	/* 
	 * Rate at which we decrease the temperature, when using original cooling
	 * schedue.
	 */
	float temp_rate;
	
	/*
	 * If set to a value 0 or greater, don't stop annealing until we reach
	 * this temperature
	 */
	float temperature_guard;
	
	/*
	 * If set, do one round of hillclimbing at the end - basically, go back
	 * to the best solution, and run at a very low temperature so that only
	 * superior solutions will be accepted
	 */
	bool finish_hillclimb;


	/*
	 * Use a delta function, which is compared against a constant, epsilon, to
	 * determine when we're done, instead of stopping at a static temperature
	 */
	bool epsilon_terminate;
	
	/*
	 * Use the local derivative for epsilon_terminate - if this is off, we use the 
	 * total score delta divided by the total temperature delta.
	 */
	bool local_derivative;
	
	/*
	 * Our target inital acceptance rate while doing melting - we adjust the
	 * temperature so that this percentage of transitions would be accepted.
	 */
	float X0;
	
	/*
	 * Parameter used to calculate new temperature when using 'chill' cooling
	 * schedule.
	 * TODO: Need to document better!
	 */
	float delta;
	
	/*
	 * Minimum size of the neighborhood (length of Markov chain at each
	 * temperature step)
	 */
	int min_neighborhood_size;
	
	/*
	 * Scale the size of the neighborhood by this amount, to make assign
	 * try harder (or less hard). Set to 1.0 to get normal behavior.
	 */
	double scale_neighborhood;
	
	/*
	 * Try to target a specific runtime - disabled if set to 0
	 */
	double timetarget;
	
	/*
	 * Stop when we reach a specific time, no matter what - disabled if set
	 * to 0
	 */
	double timelimit;
	
	/*
	 * Allow for the generations of solutions that overload physical nodes -
	 * this still counts as a violation, however. The goal is to explore some
	 * intermediate states that might be on the path to better solutions
	 */
	bool allow_overload;
	
	/*
	 * Percentage of the time we use the 'connected pnode find' algorithm -
	 * instead of picking a new pnode at random, pick a pnode to which a
	 * neighbor of the given node is already mapped. (0 to disable)
	 */
	double use_connected_pnode_find;
	
	/*
	 * Perform a sanity check, in which, for every transition we try, map the
	 * node, then unmap it to make sure we get the same score back, then map
	 * it again and move on. Slows assign down a lot, but useful for finding
	 * bugs in the scoring system.
	 */
        bool scoring_selftest;
	
	/*
	 * Normally, we *don't* require fixed nodes to pass all of the checks
	 * that 'regular' nodes must to map - for example, we normally give them a
	 * pass on features/desires, assuming that if you've fixed a node, you
	 * know what you are doing. Setting this value to true re-enables those
	 * checks.
	 */
	bool check_fixed_nodes;
	
	/*
	 * This one is midly tricky, as it depends on the value of
	 * local_derivative - not sure a fucntion is the most efficient thing
	 * to do, but we'll give it a try.  
	 */ 	
        float get_epsilon() const;

        /*
         * When true, try to arrive at an intial temperature through a
         * special round of annealing
         */
        bool melt;
         
         /*
          * When *not* doing melting, this provides a temperature to start
          * with
          */
        double initial_temperature;
    
        /*
         * Be verbose during the annealing run
         */
        bool verbose;
	
	/*
	 * Use the 'chill' cooling schedule, which is the standard one from the
	 * SA literature. If this is false, use assign's older cooling method,
	 * which uses a constant multiplicative decrease to manage the temperature
	 */
        bool chill;
	
	/*
	 * Defaults
	 */
	annealing_parameters() :
		init_temp(10.0),
		temp_prob(130),
		temp_stop(2.0),
		temp_rate(0.9),
		temperature_guard(-1.0),
		finish_hillclimb(false),
		epsilon_terminate(true),
		local_derivative(true),
		X0(0.95),
		delta(2.0),
		min_neighborhood_size(1000),
		scale_neighborhood(1.0),
		timetarget(0.0),
		timelimit(0.0),
		allow_overload(false),
		use_connected_pnode_find(0.0),
		scoring_selftest(false),
		check_fixed_nodes(false),
		melt(true),
		initial_temperature(10.0),
		verbose(false),
		chill(true)
	{;}
	
	/*
	 * Useful for debugging
	 */
	friend ostream &operator<<(ostream &o, const annealing_parameters &ap);
};

/*
 * This class encapsulates the state of the annealing process
 * TODO:
 *   Make references to the global structures, instead of using the globals
 *     directly
 *   Keep things like the solution, best score, etc. inside the class
 *   Deal with returning the result to the caller
 */
class annealer {
public:
	explicit annealer(const annealing_parameters &_params) :
		params(_params), fixed_node_count(0),
		temp(0.0),  prev_score(0) {;};
	/*
	 * The big guy!
	 */
	void anneal();
	
	/*
	 * Print out a status report to the given ostream - useful for
	 * SIGINFO, etc.
	 */
	void status_report(ostream &o) const;
	
private:
	/*
	 * Decides based on the temperature if a new score should be accepted
	 * or not
	*/
	bool accept(double change, double temperature) const;
	
	/*
	 * Set up the fixed nodes, before we start annealing
	 */
	bool setup_fixed_nodes();
	
	/*
	 * Handle nodes that have been hinted to certain starting locations
	 */
        void setup_hinted_nodes();
    
        /*
         * Set up the unassigned_nodes structure from the current virtual topology
         */
        void setup_unassigned_nodes();
    
        /*
         * Do just what they say
         */
        void start_melting();
        void stop_melting();
    
        /*
         * Get ready to run a timestep
         */
        int init_tstep();
    
        /*
         * Calculate the neighborhood size for a given problem (maybe should)
         * move to neighborhood.h
         */ 
        int get_neighborsize() const;
    
	/*
	 * Annealing-specific parameters
	 */
	const annealing_parameters &params;
	
	/*
	 * Pseudo-constants - should not change after they are initially set.
	 * TODO: Many/most of these can move to virtual or physical topology
	 * objects
	 */
	 
        // Number of nodes in the virtual topology
        int vnode_count; 
	 
	// Number of fixed nodes in the topology
	int fixed_node_count;
	
	// Number of pclasses in the physical topology
	int pclass_count;

        // Size of the local neighborhood
	int neighborsize;
	
	/*
	 * Volatile variables - these change frequently during the run of
	 * the annealing loop
	 */
	 
	// Current temperature
	double temp;
	
	// Nodes that are not currently assigned
        slist<vvertex> unassigned_nodes;
    
        // Are we in the melting run or not?
        bool melting;
    
        // The score from the previous iteration
        // TODO: This can probably be handled better
        double prev_score;
	
	/*
	 * State that's used/modified by an individual timestep
	 */
	class tstep_state {
	        
	private:
	    // The outer annealing loop that is calling us
            annealer const *parent;
	    
        public:
            typedef std::vector<double> score_list;
        
            tstep_state(annealer const *_parent) 
                : parent(_parent), iterations(0), accepts(0), 
                  increase_count(0), decrease_count(0), avg_increase(0.0),
                  avg_score(parent->prev_score) {             
                    if (parent->params.chill) { 
                        // If we're going to use the chill cooling schedule, 
                        // size this structure so that it can hold all the
                        // scores it might be called upon to hold                
                        scores.resize(parent->neighborsize+1);
                        scores[0] = parent->prev_score;
                    }
                };
        
            // Number of iterations so far in this timestep
            int iterations;
        
            // Number of times we accepted a new solution
            int accepts;
        
            // Count the number of times the score increases and decreases
            int increase_count, decrease_count;
        
            // Average increase in score
            double avg_increase;
        
            // Average score for all solutions we consider
            double avg_score;
        
            // Scores recorded during this timestep
            score_list scores;
        
        };

};

/*
 * From assign.cc - time we started annealing
 */
extern double timestart;

/*
 * Globals - XXX made non-global!
 */
/* From assign.cc */
extern pclass_types type_table;
extern pclass_list pclasses;
extern pnode_pvertex_map pnode2vertex;
extern double best_score;
extern int best_violated, iters, iters_to_best;
extern name_vvertex_map vname2vertex;

extern pclass_types vnode_type_table;
extern solution best_solution;
extern vvertex_vector virtual_nodes;
extern name_pvertex_map pname2vertex;
extern name_name_map fixed_nodes;
extern name_name_map node_hints;

#endif
