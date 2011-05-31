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
// XXX: Should be passed in!
extern FILE *scoresout, *tempout, *deltaout;

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
         * We need a much smaller epsilon when looking at the local score
         * changes, since the absolute values are much smaller.
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
    o << "Iterations: " << total_iterations << " Temp: " << temp << " Score: "
        << get_score() << " Violations: " << violated
        << " (Best S: " << best_score << " V:" << best_violated << ")"
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

    int prev_violated = 0;

    double new_score = 0;

    pvertex oldpos;
    bool oldassigned;
    temp = params.init_temp;

    int tsteps = 0;

    double avghist[params.min_tsteps];

    int hstart = 0, nhist = 0;
    double lasttemp = 5000.0f;
    double smoothedavg, lastsmoothed = 500000.0f;

    bool finished_once = false;

    /*
     * Grab some values that we'll use a lot
     */
    pclass_count = pclasses.size();
    vnode_count = num_vertices(VG);

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
    initial_score = get_score();

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
    neighborsize = this->get_neighborsize();


    if (fixed_node_count >= vnode_count) {
        cout << "All nodes are fixed.  No annealing." << endl;
        finished = true;
    }

    /*
     * Initialize melting, or set starting temperature
     */
    if (params.melt) {
        this->start_melting();
    } else {
        temp = params.initial_temperature;
        cout << "Starting with initial temperature " << temp << endl;
    }

    /*
     * Record when we started the annealing loop
     */
    stats.start();

    /*
     * The main annealing loop!
     * Each iteration is a temperature step
     */
    while(!finished) {

        if (params.verbose) {
            this->status_report(cout);
        }

        /*
         * Initialize this temperature step - we get back the number of
         * iterations we should do at this temperature
         */
        int iterations_per_tstep = this->init_tstep();

        /*
         * Object that we'll use to keep track of the state of this individual
         * timestep
         */    
        tstep_state tstate(this,tsteps);

        /*
         * The inner loop - 
         * Each iteration of this inner loop corresponds to one attempt to try
         * a new solution. When we're melting, we have a special number of
         * transitions we're shooting for.
         */
        while (tstate.iterations < iterations_per_tstep) {

            tstate.iterations++;
            total_iterations++;

            /*
             * Find a virtual node to map -
             * If there are any virtual nodes that are not yet mapped, start
             * with those If not, find some other random vnode, which we'll
             * unmap then remap
             */
            vvertex vv;
            if (! unassigned_nodes.empty()) {
                // Pick a random node from the list of unassigned nodes
                vv = pick_unassigned_vnode();
            } else {
                vv = pick_assigned_vnode();
            }

            tb_vnode *vn = get(vvertex_pmap,vv);

            /*
             * Keep track of the old assignment for this node
             */
            oldassigned = vn->assigned;
            oldpos = vn->assignment;

            /*
             * Problem: If we free the chosen vnode now, we might just try
             * remapping it to the same pnode. So, we do that after picking
             * a pnode
             */

            /*
             * We have to handle vnodes with vtypes (vclasses) specially -
             * we have to make the vtype pick a type to masquerade as for
             * now.
             */
            if (vn->vclass != NULL) {
                vn->type = vn->vclass->choose_type();
            }

            /* 
             * Find a pnode to map this vnode to
             */
            tb_pnode *newpnode = NULL;
            if ((params.use_connected_pnode_find != 0)
                    && ((RANDOM() % 1000) <
                        (params.use_connected_pnode_find * 1000))) {
                newpnode =
                    find_pnode_connected(vv,vn,params.allow_overload);
            }

            /* 
             * If not using the connected find, or it failed to find a node,
             * then fall back on the regular algorithm to find a pnode
             */
            if (newpnode == NULL) {
                newpnode = find_pnode(vn, params.allow_overload);
            }

            /*
             * Free up the node now
             */
            if (oldassigned) {
                remove_node(vv);
            }

            /*
             * If we didn't find a node to map this vnode to, free up some
             * other vnode so that we can make progress - otherwise, we
             * could get stuck
             */
            if (newpnode == NULL) {
                /*
                 * Push this node back onto the unassigned map - we won't
                 * be trying to assign it to something this time through
                 */
                unassigned_nodes.push_front(vv);
                
                /*
                 * Free up a random, already-assigned, node
                 */
                vvertex free_me = pick_assigned_vnode();
                remove_node(free_me);
                unassigned_nodes.push_front(free_me);

                /*
                 * Start again with another vnode
                 */
                continue;        
            }

            /*
             * Okay, we've got pnode to map this vnode to - let's do it
             */
            if (newpnode != NULL) {
                // Have to get the pvertex associated with the tb_vpnode
                pvertex newpos = pnode2vertex[newpnode];

                /*
                 * First, we might want to run a sanity check on our scores -
                 * this abort()s if the check fails
                 */
                if (params.scoring_selftest) {
                    scoring_selftest(vv,newpos);
                }

                /*
                 * Actually try the new mapping - if it fails, the node is
                 * still unassigned, and we go back and try with another
                 */
                if (add_node(vv,newpos,false,false,false) != 0) {
                    unassigned_nodes.push_front(vv);
                    continue;
                }
            }

            stats.solution_considered(violated == 0);

            /*
             * Okay, now that we've mapped some new node, let's check the
             * scoring, so that we can decide if we're going to accept it
             */
            new_score = get_score();
            assert(new_score >= 0);

            /*
             * Negative is bad - it means the score increased
             */
            double scorediff = prev_score - new_score;
            
            // This looks funny, because < 0 means worse, which means an
            // increase in score
            if (scorediff < 0) {
                tstate.increase_count++;
                tstate.avg_increase = tstate.avg_increase *
                    (tstate.increase_count -1) / tstate.increase_count
                    + (-scorediff)  / tstate.increase_count;
            } else {
                tstate.decrease_count++;
            }        

            /*
             * Decide if we're going to accept this transition or not
             */
            bool accepttrans = accept_transition(new_score, prev_score,
                    violated, prev_violated);

            /* 
             * Okay, we've decided to accep this transition - do some
             * bookkeeping
             */
            if (accepttrans) {
                // Accept change
                prev_score = new_score;
                prev_violated = violated;

                // Bookeeping
                stats.solution_accepted(violated == 0);

                if (violated == 0 && !stats.found_valid()) {
                    stats.first_valid_solution(total_iterations);
                }

                // gnuplot data files
                if (tempout != NULL) {
                    fprintf(tempout,"%f\n",temp);
                    fprintf(scoresout,"%f\n",new_score);
                    fprintf(deltaout,"%f\n",-scorediff);
                }

                tstate.avg_score += new_score;
                tstate.accepts++;

                /*
                 * In the 'chill' cooling schedule, we have to keep track of
                 * all scores we've seen
                 */
                if (params.chill && !melting) {
                    assert(tstate.accepts <= neighborsize);
                    tstate.scores[tstate.accepts] = new_score;
                }

                /*
                 * Okay, if this is the best score we've gotten so far,
                 * let's do some further bookkeeping - copy it into the
                 * structures for our best solution
                 */
                if (best_score_so_far(new_score,violated)) {
                    set_best_solution(VG,new_score,violated);
                }
            } else { // !acceptrans
                stats.solution_rejected(violated == 0);
                // Reject change, go back to the state we were in before
                if (oldassigned) {
                    remove_node(vv);
                    add_node(vv,oldpos,false,false,false);
                } else {
                    unassigned_nodes.push_front(vv);
                }
            }

            /*
             * If we're melting, we do a little extra bookkeeping to do,
             * becuase the goal of melting is to come up with an initial
             * temperature such that almost every transition will be
             * accepted
             */
            if (melting) {
                temp = adjust_melting_temperature(tstate);
            }

            /*
             * With timelimit set, we just give up after our time limit
             */
            if ((params.timelimit != 0.0) && 
                    ((used_time() - timestart) > params.timelimit)) {
                printf("Reached end of run time, finishing\n");
                forcerevert = true;
                finished = true;

                // This exits the inner annealing loop
                break;
            }

        } /* End of inner annealing loop */

        /*
         * Most of the code past this point concerns itself with the cooling
         * schedule (what the next temperature step should be
         */

        // Keep an average of the score over this temperature step        
        tstate.avg_score = tstate.avg_score / (tstate.accepts +1);

        /*
         * Get the temperature for the next timestep
         */
        temp = next_temperature(tstate);

        /*
         * The next section of code deals with termination conditions - how do
         * we decide that we're done?
         */

        /*
         * Keep a history of the average scores over the last min_tsteps
         * temperature steps. We treat the avghist array like a ring buffer.
         * Add this temperature step to the history, and computer a smoothed
         * average.
         */
        smoothedavg = tstate.avg_score / (nhist + 1);
        for (int j = 0; j < nhist; j++) {
            smoothedavg += avghist[(hstart + j) % params.min_tsteps] / (nhist + 1);
        }

        avghist[(hstart + nhist) % params.min_tsteps] = tstate.avg_score;
        if (nhist < params.min_tsteps) {
            nhist++;
        } else {
            hstart = (hstart +1) % params.min_tsteps;
        }

        /*
         * Are we computing the derivative of the average temperatures over the
         * whole history, or just the most recent one?
         */
        if (params.local_derivative) {
            tstate.deltaavg = lastsmoothed - smoothedavg;
            tstate.deltatemp = lasttemp - temp;
        } else {
            tstate.deltaavg = initialavg - smoothedavg;
            tstate.deltatemp = meltedtemp - temp;
        }

        lastsmoothed = smoothedavg;
        lasttemp = temp;

        /*
         * If we've finished once already (this due to finish_hillclimb), then
         * we are done when we hit this.
         */
        if (finished_once) {
            finished = true;
        } else if (params.epsilon_terminate) {
            /*
             * epsilon_terminate means that we define some small number,
             * epsilon, and the derivative of the average change in temperature
             * gets below that epsilon (ie. we have stopped getting
             * improvements in score),
             * we're done
             */
            
            // This condition is complicated enough that it's encapsulated
            // in a function
            if (check_epsilon_condition(tstate)) {
                /*
                 * Normally, we are done here.
                 */
                forcerevert = true;
                if (!params.finish_hillclimb) {
                    finished = true;
                } else {
                    /*
                     * This option goes back to the best result we ever found,
                     * and goes one more round - the idea is to finish up with
                     * a very low temperature, at which will will probably take
                     * only better solutions (hillclimbing).
                     * (Note that we have already forced a revert above.)
                     */
                    cout << "Finishing with a round of hill-climbing " << 
                        endl;
                    temp = 0.0;
                    finished_once = true;
                }
            }
        } else { /* epsilon_terminate */
            /*
             * If we're not using epsilon termination, we simply
             * look to see if the temperature has gone below a threshold
             */
            if (temp < params.temp_stop) {
                finished = true;
            }
        }


        /*
         * RANDOM_ASSIGNMENT is not really very random, but we stop after the
         * first valid solution we get
         */
        if (params.random_assignment && (violated == 0)) {
            finished = true;
        }

        /*
         * REALLY_RANDOM_ASSIGNMENT stops after we've assigned all nodes,
         * whether or not our solution is valid
         */
        if (params.really_random_assignment && (unassigned_nodes.size() == 0)) {
            finished = true;
        }

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
         * they're finished. This is fine - of course, we want to return the
         * best solution we ever found, which might not be the one we're
         * sitting at right now.
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
         * Historically, assign used to revert to the best solution at the end
         * of every temperature step. This is definitely NOT kosher. In my
         * mind, it assign too susceptible to falling into local minima.
         * Anyhow, the idea is that we go back to the best soltion if the
         * current solution is worse than it either in violations or in score.
         */
        if (params.revert_every_tstep) {
            if (params.revert_violations && (best_violated < violated)) {
                cout << "Reverting: revert_violations" << endl;
                revert = true;
            }
            if (best_score < prev_score) {
                cout << "Reverting: best score" << endl;
                revert = true;
            }
        }

        if (revert) {
            cout << "Reverting to best solution\n";
            revert_to_solution(best_solution);
        }


        /*
         * Whew, that's it!
         */
        tsteps++;

    } /* End of outer annealing loop */

    // Close out the stats gathering
    stats.stop();

    cout << "Done annealing" << endl;

    /*
     * Print out some useful statistics
     */
    stats.dump_stats(cout,total_iterations);

} // End of anneal()

/*
 * Set up fixed nodes
 */
bool annealer::setup_fixed_nodes() {
    
    fixed_node_count = 0;
    
    /* 
     * Count of nodes which could not be fixed - we wait until we've tried to
     * fix all nodes before bailing, so that the user gets to see all of the
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
            // Find a type on this physical node that can satisfy something in
            // the virtual class
            if (pn->typed) {
                if (vn->vclass->has_type(pn->current_type)) {
                    vn->type = pn->current_type;
                }
            } else {
                for (tb_pnode::types_list::iterator i = pn->type_list.begin();
                     i != pn->type_list.end();
                     i++) {
                    // For now, if we find more than one match, we pick the
                    // first. It's possible that picking some other type would
                    // give us a better score, but let's noty worry about that
                    if (vn->vclass->has_type((*i)->get_ptype()->name())) {
                        vn->type = (*i)->get_ptype()->name();
                        break;
                    }
                }
            }
        
            if (vn->type.empty()) {
                // This is an internal error, so it's okay to handle it in a
                // different way from the others
                cout << "*** Unable to find a type for fixed, vtyped, node "
                     << vn->name << endl;
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
            cout << "Warning: Skipping hint for node " << vn->name
                  << ", which is " << "fixed in place" << endl;
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

/*
 * Does what it says, sets up the state for melting
 */
void annealer::start_melting() {
    cout << "Starting melting run" << endl;
    melting = true;
}

/*
 * Indicate that we're done melting, and pick a new temperature
 */
double annealer::stop_melting(const tstep_state &tstate) {
    
    // Flip it off in the main annealer object
    melting = false;

    // Record a few variable for use later (these are also in the main
    // annealer object)
    meltedtemp = temp;
    initialavg = tstate.avg_score;

    if (!(meltedtemp > 0.0)) { // This backwards expression catches NaNs
        cout << "    Finished annealing while melting!" << endl;
        finished = true;
        forcerevert = true;
    } else {
        cout << "Finished melting, picked temperature " << temp << endl;
    }

    /*
     * With timetarget, we look at how long melting took, then use that
     * to estimate how many temperature steps it will take to hit our
     * time target. We adjust our cooling schedule accordingly.
     */
    if (params.timetarget != 0.0) {
        double melttime = stats.time_used();
        double timeleft = params.timetarget - melttime;
        double stepsleft = timeleft / melttime;
        cout << "Melting took " << melttime << " seconds, will try for "
            << stepsleft << " temperature steps" << endl;
        temp_rate = pow(params.temp_stop/temp,1/stepsleft);
        cout << "Timelimit: " << params.timetarget
            << " Timeleft: " << timeleft
            << " temp_rate: " << temp_rate << endl;
    }

    /*
     * The initial temperature is the one we've already calcuated.
     */
    return temp;
}

/*
 * Adjust the temperature during melting - returns the new temperature
 */
double annealer::adjust_melting_temperature(const tstep_state &tstate) {
    double new_temperature = 
        tstate.avg_increase /
            log(tstate.increase_count/
                    (tstate.increase_count * params.X0 - 
                     tstate.decrease_count * (1 - params.X0)));
    if (!(new_temperature > 0.0)) {
        new_temperature = 0.0;
    }
    
    return new_temperature;
}

/*
 * Set up all the variables that need to be initialized at the beginning of a
 * temperature step. Returns the number of iterations this tstep should last
 * (which depends on whether or not we're currently melting)
 */
int annealer::init_tstep() {
      
    /*
     * The number of iterations for this tstep depends on a few different
     * things - if we're melting, we want to do a pretty large timestep.
     * Otherwise, we adjust to the number of enabled pclasses (though we
     * only disable pclasses when using dynamic pclasses; when dynamic
     * pclasses are not in use, this will have no effect)
     */ 
    if (melting) {
        return neighborsize;
    } else {
        // Adjust the number of transitions we're going to do based on the
        // number of pclasses that are actually 'in play'
        int iters = (int)(neighborsize *
            (count_enabled_pclasses() *1.0 / pclasses.size()));
        assert(iters <= neighborsize);
        return iters;
    }
}

int annealer::get_neighborsize() const {
    
    int size;
    
    // Subtract the number of fixed nodes from vnode_count, since they don't
    // really count
    if (fixed_node_count > 0) {
        cout << "Adjusting difficulty estimate for fixed nodes, " <<
            (vnode_count - fixed_node_count) << " remain.\n";
    }

    // Basic neighborhood size is the number of virtual nodes, multiplied by
    // the number of pclasses that we have.
    size = (vnode_count - fixed_node_count) * pclass_count;

    // We want to make sure we don't give up *too* fast - so cap the minimum
    // size of the neighborhood
    if (size < params.min_neighborhood_size) {
        size = params.min_neighborhood_size;
    }

    // Allow scaling of the neighborhood size, so we can make assign try harder
    // (or less hard)
    size = (int)(size * params.scale_neighborhood);
    
    return size;
}

/*
 * Pick a random noded from the set of currently unassigned nodes
 */
vvertex annealer::pick_unassigned_vnode() {

    /*
     * Pick a random number, then go that deep in the list
     */
    int choice = RANDOM() % unassigned_nodes.size();
    slist<vvertex>::iterator uit = unassigned_nodes.begin();
    for (int i = 0; i < choice; i++) { uit++; }
    assert(uit != unassigned_nodes.end());

    // Make sure it's not assigned!
    assert(!get(vvertex_pmap,*uit)->assigned);
    
    // Remove it from the list, it will get put back later if we don't take
    // the new assignment for it
    unassigned_nodes.erase(uit);
    
    return *uit;
}

/*
 * Pick a random node that's already assigned - we'll unassign it later
 */
vvertex annealer::pick_assigned_vnode() {

    /*
     * We can index directoy into the virtual nodes array, but we have to
     * skip fixed nodes. We should have skipped out early if all nodes were
     * fixed.
     * TODO: This biases towards selecting non-fixed nodes that come after
     * long sets of fixed nodes
     */
    int start = RANDOM()%vnode_count;
    int choice = start;
    while (get(vvertex_pmap,virtual_nodes[choice])->fixed) {
        choice = (choice +1) % vnode_count;
        if (choice == start) {
             choice = -1;
             break;
         }
    }
    
    if (choice >= 0) {
        return(virtual_nodes[choice]);
     } else {
        cout << "**** Error, unable to find any non-fixed nodes" << endl;
         exit(EXIT_UNRETRYABLE);
     }
}

void annealer::scoring_selftest(const vvertex &assign_me,
        const pvertex &new_assignment) {
    /*
     * See if the score we get by adding this node, then removing it, is the
     * same one we had before
     */

    double oldscore = get_score();
    int oldviolated = violated;

    double tempscore = -1.0;
    int tempviolated = -1;

    if (!add_node(assign_me,new_assignment,false,false,false)) {
        tempscore = get_score();
        tempviolated = violated;
        remove_node(assign_me);
    }        

    if (!compare_scores(oldscore,get_score()) ||
            (oldviolated != violated)) {
        cerr << "Scoring problem adding a mapping - "
            << "oldscore was " << oldscore
            <<  " current score is " << get_score()
            << " tempscore was " << tempscore << endl;
        cerr << "oldviolated was " << oldviolated
            << " newviolated is " << violated <<
            " tempviolated was " << tempviolated << endl;
        /* TODO: This is commented out until I have a more sane way to
         * deal with the vvertex/tb_vnode duality
        cerr << "I was tring to map " << vn->name
            << " to " << newpnode->name << endl;
        */
        print_solution(best_solution);
        cerr << vinfo;
        abort();
    }

    // Returns nothing, since it abort()s on failure
    return;
}

/*
 * Returns true if we should accept this transition, false if we should not
 */
bool annealer::accept_transition(double new_score, double old_score,
        int new_violations, int old_violations) {
    if (melting) {
        // When melting, we take everything!
        return true;
    }

    if (params.special_violation_treatment) {
        /*
         * In this branch, we always accept new solutions that have fewer
         * violations than the old solution, and when we're trying to determine
         * whether or not to accept a new solution with a higher score, we
         * don't take violations into the account.
         *
         * The problem with this shows up at low temperatures.  What can often
         * happen is that we accept a solution with worse violations but a
         * better (or similar) score. Then, if we were to try, say the first
         * solution (or a score-equivalent one) again, we'd accept it again.
         *
         * What this leads to is 'thrashing', where we have a whole lot of
         * variation of scores over time, but are not making any real progress.
         * This prevents the cooling schedule from converging for much, much
         * longer than it should really take.
         *
         * It also means that in situations where there are a *lot* of invalid
         * solutions, we find it very easy to pop back into invalid space,
         * which is not necesssarily a good thing
         */
        if ((new_violations == old_violations) && (new_score < old_score)) {
            // Same violation count, but better score: take it
            return true;
        } else if (new_violations < old_violations) {
            // Fewer violations: take it
            return true;
        } else if (accept(old_score - new_score,temp)) {
            // New violations > old violations, or violation count is the
            // same, but the new score is higher: check the metropolis
            // criteria
            return true;
        } else {
            // Otherwise, nope.
            return false;
        }
    } else {
        /*
         * Here, we use the regular simulated annealing score-based acceptance
         * criteria. However, we have to decide if we're going to include
         * violations in the score or not.
         */
        double adjusted_new_score;
        double adjusted_old_score;

        if (params.no_violations) {
            /*
             * We don't count violations at all
             */
            adjusted_new_score = new_score;
            adjusted_old_score = old_score;
        } else {
            /*
             * We add violations into the score
             * One consequence, though, is that we have to be more careful with
             * scores.  We do not want to be able to get into a situation where
             * adding a violation results in a _lower_ score than a solution
             * with fewer violations.
             */
            adjusted_new_score = new_score + new_violations * VIOLATION_SCORE;
            adjusted_old_score = old_score + old_violations * VIOLATION_SCORE;
        }

        /*
         * This is just the standard SA acceptance criteria - take better
         * scores, check the metropolis criteria for other scores.
         */
        if (adjusted_new_score < adjusted_old_score) {
            return true;
        } else if (accept(adjusted_old_score - adjusted_new_score,temp)) {
            return true;
        } else {
            return false;
        }
    }
}

double annealer::next_temperature(const tstep_state &tstate) {

    /*
     * If we were melting, then we we need to pick an initial temperature
     */
    if (melting) {
        return stop_melting(tstate);
    }

    /*
     * The CHILL cooling schedule is the standard one from the
     * Simulated Annealing literature - it lower the temperature based
     * on the standard deviation of the scores of accepted
     * configurations
     */
    if (params.chill) {
        double stddev = 0;
        for (int i = 0; i <= tstate.accepts; i++) {
            stddev += pow(tstate.scores[i] - tstate.avg_score,2);
        }
        stddev /= (tstate.accepts +1);
        stddev = sqrt(stddev);
        return temp / (1 + (temp * log(1 + params.delta))/(3  * stddev));
    } else {
        /* 
         * This is assign's original cooling schedule - more predictable,
         * but not at all reactive to the problem at hand
         */
        return temp * temp_rate;
    }
}

/*
 * Returns true if the current solution seems to be the best one we've seen
 * so far
 */
bool annealer::best_score_so_far(double new_score, int new_violated) {
    /*
     * If params.no_violations is set, then we just look at score
     */
    if (params.no_violations) {
        return (new_score < best_score);
    } else {
        return ((new_violated < best_violated) ||
                 ((new_violated == best_violated) &&
                  (new_score < best_score)));
    }
}

/*
 * Copy the current solution to the best solution
 */
void annealer::set_best_solution(const tb_vgraph &vg, double new_score,
        int violated) {
    best_solution.set(vg);
    best_score = new_score;
    best_violated = violated;
    stats.new_best_solution(total_iterations);
}

/*
 * This is the code to do the actual revert.  IMPORTANT: At this time,
 * a revert does not take you back to _exactly_ the same state as
 * before, because there are some things, like link assignments, that
 * we don't save. Since the way these get mapped is dependant on the
 * order they happen in, and this order is almost certainly different
 * than the order they got mapped during annealing, there can be
 * discrepancies (ie. now we have violations, when before we had none.)
 */
void annealer::revert_to_solution(const solution &sol) {

    vvertex_iterator vvertex_it,end_vvertex_it;
    vedge_iterator vedge_it,end_vedge_it;

    /*
     * We start out by unmapping every vnode that's currently allocated
     */
    tie(vvertex_it,end_vvertex_it) = vertices(VG);
    for (;vvertex_it!=end_vvertex_it;++vvertex_it) {
        tb_vnode *vnode = get(vvertex_pmap,*vvertex_it);
        if (vnode->fixed) continue;
        if (vnode->assigned) {
            remove_node(*vvertex_it);
        }
    }

    /*
     * Check to make sure that our 'clean' solution scores the same as the
     * initial score - if not, that indicates a bug
     */
    if (!compare_scores(get_score(),initial_score)) {
        cout << "*** WARNING: 'Clean' score does not match initial "
            << "score" << endl
            << "     This indicates a bug - contact the operators"
            << endl
            << "     (initial score: " << initial_score
            << ", current score: " << get_score() << ")" << endl;
    }

    /* 
     * Now, go through the given solution, and add all of the node mappings
     * back in.
     */
    tie(vvertex_it,end_vvertex_it) = vertices(VG);
    for (;vvertex_it!=end_vvertex_it;++vvertex_it) {
        tb_vnode *vnode = get(vvertex_pmap,*vvertex_it);
        if (vnode->fixed) continue;
        if (sol.is_assigned(*vvertex_it)) {
            if (vnode->vclass != NULL) {
                vnode->type = sol.get_vtype_assignment(*vvertex_it);
            }
            bool add_failed = add_node(*vvertex_it,
                    sol.get_assignment(*vvertex_it), true,false,true);
            assert(!add_failed);
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
        if (sol.link_is_assigned(*vedge_it)) {
            // XXX: It's crappy that I have to do all this work here -
            // something needs re-organzing
            /*
             * This line does the actual link mapping revert
             */
            vlink->link_info =
                sol.get_link_assignment(*vedge_it);

            if (!dst_vnode->assigned || !src_vnode->assigned) {
                // This shouldn't happen, but don't try to
                // score links which don't have both endpoints
                // assigned.
                continue;
            }
            if (dst_vnode->fixed && src_vnode->fixed) {
                // If both endpoints were fixed, this link never got
                // unmapped, so don't map it again
                continue;
            }

            tb_pnode *src_pnode =
                get(pvertex_pmap,src_vnode->assignment);
            tb_pnode *dst_pnode =
                get(pvertex_pmap,dst_vnode->assignment);

            /*
             * Okay, now that we've jumped through enough hoops, we can
             * actually do the scoring
             */
            mark_vlink_assigned(vlink);
            score_link_info(*vedge_it, src_pnode, dst_pnode,
                    src_vnode, dst_vnode);
        } else {
            /*
             * If one endpoint or the other was unmapped, we just note
             * that the link wasn't mapped - however, if both endpoints
             * were mapped, then we have to make sure the score
             * reflects that.
             */
            if (!dst_vnode->assigned || !src_vnode->assigned) {
                if (!vlink->no_connection) {
                    mark_vlink_unassigned(vlink);
                }
            }
        }
    }

    /*
     * Set up the unassigned_nodes structure, so that if we're going to
     * keep annealing (eg. as we do when hillclimbing at the end), it's correct
     */
    setup_unassigned_nodes();
}

bool annealer::check_epsilon_condition(const tstep_state &tstate) const {
    // We have a mininum number of timesteps, and *might* have a
    // minimum temperature that we must reach before we will stop. Note
    // that the temperature_guard clause is formulated to give the
    // correct result even when temp goes to nan
    /*
     * ALLOW_NEGATIVE_DELTA controls whether we're willing to
     * stop if the derivative gets small and negative, not just
     * small and positive.
     */
    //         || (fabs((temp / initialavg) * (deltaavg/ deltatemp)) < epsilon))) {
    // We have a minimum number of timesteps that we have to go through, to
    // avoid exiting early on relatively simple problems
    if (tstate.this_tstep < params.min_tsteps) {
        return false;
    }
    // If the temperature guard is enabled, make sure to honor it (note that
    // the temperature expression is a little funny to catch NaNs and the like
    if ((params.temperature_guard >= 0.0) &&
            (temp > params.temperature_guard)) {
        return false;
    }

    if (params.allow_negative_delta) {
        if (((temp < 0) || isnan(temp) ||
               ((temp / initialavg) * (tstate.deltaavg/ tstate.deltatemp)) <
               params.get_epsilon())) {
            return true;
        }
    } else {
        if ((tstate.deltaavg > 0) &&
                ((temp / initialavg) * (tstate.deltaavg/ tstate.deltatemp) <
                    params.get_epsilon())) {
            return true;
        }
    }

    // If neither of the conditions above matched, we're not done
    return false;
}

/*
 * Simple accessors for the annealer class
 */
double annealer::get_best_score()       const { return best_score;             }
int    annealer::get_best_violations()  const { return best_violated;          }
int    annealer::get_total_iterations() const { return total_iterations;       }
int    annealer::get_iters_to_best()    const { return stats.get_iters_to_best(); }

/*
 * Functions for the annealer::statistics class
 */
void annealer::statistics::start() {
    anneal_start_time = used_time();
}

void annealer::statistics::stop() {
    anneal_finished_time = time_used();
}

void annealer::statistics::solution_considered(bool valid) {
    solutions_considered++;
    if (valid) { valid_solutions_considered++; }
}

void annealer::statistics::solution_accepted(bool valid) {
    solutions_accepted++;
    if (valid) { valid_solutions_accepted++; }
}

void annealer::statistics::solution_rejected(bool valid) {
    solutions_rejected++;
    if (valid) { valid_solutions_rejected++; }
}

void annealer::statistics::first_valid_solution(int iteration) {
    cout << "    Found first valid solution on iteration "
         << iteration << endl;
    time_to_first_valid = used_time() - anneal_start_time;
}

bool annealer::statistics::found_valid() const {
    return (time_to_first_valid != 0.0);
}

double annealer::statistics::time_used() const {
    return used_time() - anneal_start_time;
}

void annealer::statistics::new_best_solution(int iteration) {
    iters_to_best = iteration;
    time_to_best = time_used();
}

int annealer::statistics::get_iters_to_best() const {
    return iters_to_best;
}

void annealer::statistics::dump_stats(ostream &o, int total_iterations) const {

    double annealing_time = anneal_finished_time - anneal_start_time;

    o << "    Total annealing time: " << annealing_time << endl;
    o << "    Total iterations: " << total_iterations << endl;
    o << "    Average iterations per second: "
      << (total_iterations/annealing_time) << endl;
    o << "    Number of solutions considered: " << solutions_considered
      << endl;
    o << "    Fraction of iterations during which a solution was considered: "
      << ((solutions_considered*1.0)/total_iterations) << endl;
    o << "    Fraction of solutions accepted: "
      << ((solutions_accepted*1.0)/solutions_considered) << endl;
    o << "    Fraction of potential solutions that were valid: "
      << ((valid_solutions_considered*1.0)/solutions_considered) << endl;
    o << "    Fraction of accepted solutions that were valid: "
      << ((valid_solutions_accepted*1.0)/solutions_accepted) << endl;
    o << "    Fraction of rejected solutions that were valid: "
      << ((valid_solutions_rejected*1.0)/solutions_rejected) << endl;
    o << "    Fraction of valid solutions that were accepted: "
      << ((valid_solutions_accepted*1.0)/valid_solutions_considered) << endl;
    o << "    Fraction of invalid solutions that were accepted: "
      << (solutions_accepted - valid_solutions_accepted*1.0) / 
         (solutions_considered - valid_solutions_considered*1.0) << endl;

    if (time_to_first_valid > 0.0) {
        o << "    Fraction of time to find first valid solution: "
          << (time_to_first_valid / annealing_time) << endl;
    }

    if (time_to_best > 0.0) {
        o << "    Fraction of time to find best solution: "
          << (time_to_best / annealing_time) << endl;
    }

}
