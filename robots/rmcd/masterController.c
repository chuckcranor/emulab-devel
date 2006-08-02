/*
 * EMULAB-COPYRIGHT
 * Copyright (c) 2005 University of Utah and the Flux Group.
 * All rights reserved.
 */

/**
 * @file masterController.c
 *
 */

#include "config.h"

#include <math.h>
#include <stdio.h>
#include <stdarg.h>
#include <assert.h>

#include "log.h"
#include "rmcd.h"
#include "rclip.h"
#include "obstacles.h"
#include "pathPlanning.h"
#include "pilotConnection.h"
#include "masterController.h"

// Continuous paths:
#include "cPaths.h"
#include "wpPath.h"

// Nonlinear controllers:
#include "posController.h"
#include "kinController.h"


struct master_controller_data mc_data;
extern FILE *slogfilep;

extern int nl_ctrlch;
extern char *wpfile;

/**
 * Do a fuzzy comparison of two values.
 *
 * @param x1 The first value.
 * @param x2 The second value.
 * @param tol The amount of tolerance to take into account when doing the
 * comparison.
 */
#define cmp_fuzzy(x1, x2, tol)				\
  ((((x1) - (tol)) < (x2)) && (x2 < ((x1) + (tol))))





int mc_invariant(struct master_controller *mc)
{
    assert(mc != NULL);

    return 1;
}

static int mc_set_goal(struct master_controller *mc, mtp_packet_t *mp)
{
    int retval = 0;

    assert(mc != NULL);
    assert(mc_invariant(mc));
    assert(mp != NULL);

    mc->mc_pause_time = 0;
    mc->mc_flags &= ~(MCF_CONTACT);
    mc->mc_tries_remaining = mc_data.mcd_max_refine_retries;
    mc->mc_plan.pp_goal_pos = mp->data.mtp_payload_u.command_goto.position;
    mc->mc_plan.pp_speed = mp->data.mtp_payload_u.command_goto.speed;

    ob_rem_obstacle(mc->mc_self_obstacle);
    mc->mc_self_obstacle = NULL;

    switch (mc->mc_pilot->pc_control_mode) {
    case PCM_NONE:
	break;
    case PCM_MASTER:
	mtp_send_packet2(mc->mc_pilot->pc_handle,
			 MA_Opcode, MTP_COMMAND_STOP,
			 MA_Role, MTP_ROLE_RMC,
			 MA_RobotID, mc->mc_pilot->pc_robot->id,
			 MA_CommandID, MASTER_COMMAND_ID,
			 MA_TAG_DONE);

	mc->mc_pilot->pc_flags |= PCF_EXPECTING_RESPONSE;
	mc->mc_pilot->pc_connection_timeout = STOP_RESPONSE_TIMEOUT;

	pc_zero_stats(mc->mc_pilot);
	pc_stats_start_pos(mc->mc_pilot,&(mc->mc_plan.pp_goal_pos));
	pc_stats_start_time(mc->mc_pilot);
	break;
    case PCM_SLAVE:
	if (debug > 1) {
	    info("%s is wiggling, waiting for new position\n",
		 mc->mc_pilot->pc_robot->hostname);
	}

	mtp_send_packet2(pc_data.pcd_emc_handle,
			 MA_Opcode, MTP_REQUEST_POSITION,
			 MA_Role, MTP_ROLE_RMC,
			 MA_RobotID, mc->mc_pilot->pc_robot->id,
			 MA_TAG_DONE);

	// don't print here -- cause the previous move, if any, finished
	// more or less successfully...
	pc_zero_stats(mc->mc_pilot);
	pc_stats_start_pos(mc->mc_pilot,&(mc->mc_plan.pp_goal_pos));
	break;
    }

    return retval;
}



static int mc_maketraj(struct master_controller *mc, mtp_packet_t *mp) {
    int retval = 0;
    struct timeval tv_current;


    assert(mc != NULL);
    assert(mc_invariant(mc));
    assert(mp != NULL);

    if (3 == nl_ctrlch) {
    if (0 == mc->tr_size) {
        // No current trajectory, call trajectory generator

        // Get waypoints
        wp_loadfile(mc->wps,
                    &(mc->wp_size),
                    &(mc->cf),
                    wpfile);


        // Generate a trajectory
        cp_maketraj(&(mc->cf),
                    mc->td,
                    &(mc->tr_size),
                    mc->wps,
                    mc->wp_size);


        // Initialize controller parameters
        kc_init_params(&(mc->kcp));

        // Initialize controller-related parameters in mc struct
        mc->speedlimit = 2.0; // FIXME: define this somewhere else (check with rmcd flags -- it might already be there.)

        gettimeofday(&tv_current, NULL);
        mc->tf_start = (double)(tv_current.tv_sec) +
                       (double)(tv_current.tv_usec) / 1000000.0;


        if (debug) {
            info("[mc_maketraj]: Created reference trajectory.\n");
        }
    }
    else {
        if (debug) {
            info("[mc_maketraj]: Already have a reference trajectory.\n");
        }
    }
    }



    return retval;

}



static int mc_set_actual(struct master_controller *mc, mtp_packet_t *mp)
{
    int retval = 0;

    assert(mc != NULL);
    assert(mc_invariant(mc));
    assert(mp != NULL);

    mc->mc_plan.pp_last_pos = mc->mc_plan.pp_actual_pos;
    mc->mc_plan.pp_actual_pos =
	mp->data.mtp_payload_u.update_position.position;

    // set the current "final" stats pos
    pc_stats_end_pos(mc->mc_pilot,&(mc->mc_plan.pp_actual_pos));

    return retval;
}

static int mc_request_report(struct master_controller *mc, mtp_packet_t *mp)
{
    int retval = 0;

    assert(mc != NULL);
    assert(mc_invariant(mc));
    assert(mp != NULL);

    mtp_send_packet2(mc->mc_pilot->pc_handle,
		     MA_Opcode, MTP_REQUEST_REPORT,
		     MA_Role, MTP_ROLE_RMC,
		     MA_RobotID, mc->mc_pilot->pc_robot->id,
		     MA_TAG_DONE);

    mc->mc_pilot->pc_flags |= PCF_EXPECTING_RESPONSE;
    mc->mc_pilot->pc_connection_timeout = REPORT_RESPONSE_TIMEOUT;

    return retval;
}

static int mc_plot(struct master_controller *mc, mtp_packet_t *mp)
{
    float distance, theta;
    int retval = 0;

    assert(mc != NULL);
    assert(mc_invariant(mc));
    assert(mp != NULL);

    mtp_polar(&mc->mc_plan.pp_actual_pos,
	      &mc->mc_plan.pp_goal_pos,
	      &distance,
	      &theta);

    if ((mc->mc_tries_remaining <= 0) ||
	(distance < mc_data.mcd_meter_tolerance)) {

	if (cmp_fuzzy(mc->mc_plan.pp_actual_pos.theta,
		      mc->mc_plan.pp_goal_pos.theta,
		      mc_data.mcd_radian_tolerance)) {
	    mc->mc_pause_time = ~0;
	    assert(mc->mc_self_obstacle == NULL);
	    mc->mc_self_obstacle = ob_add_robot(&mc->mc_plan.pp_actual_pos,
						mc->mc_pilot->pc_robot->id);
	    mtp_send_packet2(pc_data.pcd_emc_handle,
			     MA_Opcode, MTP_UPDATE_POSITION,
			     MA_Role, MTP_ROLE_RMC,
			     MA_Position, &mc->mc_plan.pp_actual_pos,
			     MA_RobotID, mc->mc_pilot->pc_robot->id,
			     MA_Status, MTP_POSITION_STATUS_COMPLETE,
			     MA_TAG_DONE);

	    pc_stats_stop_time(mc->mc_pilot);
	    pc_print_stats(mc->mc_pilot);
	}
	else {
	    mtp_send_packet2(mc->mc_pilot->pc_handle,
			     MA_Opcode, MTP_COMMAND_GOTO,
			     MA_Role, MTP_ROLE_RMC,
			     MA_RobotID, mc->mc_pilot->pc_robot->id,
			     MA_CommandID, MASTER_COMMAND_ID,
			     MA_Theta, (mc->mc_plan.pp_goal_pos.theta -
					mc->mc_plan.pp_actual_pos.theta),
			     MA_TAG_DONE);

        if (debug) {
            info("[mc_plot]: Sending GOTO command to robot %d.\n",
                 mc->mc_pilot->pc_robot->id);
        }

	    mc->mc_pilot->pc_flags |= PCF_EXPECTING_RESPONSE;
	    mc->mc_pilot->pc_connection_timeout = WIGGLE_RESPONSE_TIMEOUT;
	}
    }
    else {
	struct robot_position *rp = NULL, _rp;

	/* call path planner */
	switch (pp_plot_waypoint(&mc->mc_plan)) {
	case PPC_NO_WAYPOINT:
	    rp = mtp_world2local(&_rp,
				 &mc->mc_plan.pp_actual_pos,
				 &mc->mc_plan.pp_goal_pos);
	    mc->mc_tries_remaining -= 1;

	    pc_stats_add_retry(mc->mc_pilot);

	    break;
	case PPC_WAYPOINT:
	    rp = mtp_world2local(&_rp,
				 &mc->mc_plan.pp_actual_pos,
				 &mc->mc_plan.pp_waypoint);
	    mc->mc_tries_remaining = mc_data.mcd_max_refine_retries;
	    break;
	case PPC_BLOCKED:
	case PPC_GOAL_IN_OBSTACLE:
	    mc->mc_pause_time = DEFAULT_PAUSE_TIME;
	    assert(mc->mc_self_obstacle == NULL);
	    mc->mc_self_obstacle = ob_add_robot(&mc->mc_plan.pp_actual_pos,
						mc->mc_pilot->pc_robot->id);
	    break;
	}

	if (rp != NULL) {

	    mtp_send_packet2(mc->mc_pilot->pc_handle,
			     MA_Opcode, MTP_COMMAND_GOTO,
			     MA_Role, MTP_ROLE_RMC,
			     MA_RobotID, mc->mc_pilot->pc_robot->id,
			     MA_CommandID, MASTER_COMMAND_ID,
			     MA_Position, rp,
			     MA_Speed, mc->mc_plan.pp_speed,
			     MA_TAG_DONE);

	    mc->mc_pilot->pc_flags |= PCF_EXPECTING_RESPONSE;
	    mc->mc_pilot->pc_connection_timeout = MOVE_RESPONSE_TIMEOUT;

        if (debug) {
            info("[mc_plot]: Sending GOTO command to robot %d.\n",
                 mc->mc_pilot->pc_robot->id);
        }


	}
    }

    return retval;
}

static int mc_nlwrapper(struct master_controller *mc, mtp_packet_t *mp)
{
    /* Wrapper for the posture regulating nonlinear controller
     * (dmf)
     */

    float Vleft, Vright;
    robot_position_states rstates;
    robot_position_states rstates_goal;
    int at_goal = 0;

    assert(mc != NULL);
    assert(mc_invariant(mc));
    assert(mp != NULL);


    if (debug > 1)
	info("mc_nlwrapper: \n");

    if (!(mc->mc_flags & MCF_NULL_STARTED)) {
	mtp_send_packet2(mc->mc_pilot->pc_handle,
			 MA_Opcode, MTP_COMMAND_STARTNULL,
			 MA_Role, MTP_ROLE_RMC,
			 MA_RobotID, mc->mc_pilot->pc_robot->id,
			 MA_CommandID, MASTER_COMMAND_ID,
			 MA_Acceleration, NULL_ACCEL,
			 MA_TAG_DONE);

	mc->mc_flags |= MCF_NULL_STARTED;
    }

    if (mc->mc_flags & MCF_HAS_PATH_PLAN) {
        /* Already have a path plan */


        /* get states from position data for waypoint */
        mc_nlctr_getstates(mc,
			   &rstates,
                           &mc->mc_plan.pp_waypoint,
			   &mc->mc_plan.pp_last_pos,
                           &mc->mc_plan.pp_actual_pos);

        /* get states from position data for goal point */
        mc_nlctr_getstates(mc,
			   &rstates_goal,
                           &mc->mc_plan.pp_goal_pos,
			   &mc->mc_plan.pp_last_pos,
                           &mc->mc_plan.pp_actual_pos);

        if (debug > 1) {
            info("Current states (e,alpha,theta): %f %f %f\n",
                 rstates.e,
                 rstates.alpha,
		 rstates.theta);
            info("Current position: %f %f %f\n",
                 mc->mc_plan.pp_actual_pos.x,
                 mc->mc_plan.pp_actual_pos.y,
                 mc->mc_plan.pp_actual_pos.theta);
            info("Current goal point: %f %f %f\n",
                 mc->mc_plan.pp_waypoint.x,
                 mc->mc_plan.pp_waypoint.y,
                 mc->mc_plan.pp_waypoint.theta);
        }

        /* if states for goal position are close to zero,
         * send MTP_POSITION_STATUS_COMPLETE
         */
//         if ((fabsf(rstates_goal.alpha) < STATE_ATOL &&
//              fabsf(rstates_goal.theta) < STATE_ATOL) &&
//             rstates_goal.e == 0.0f) {
/* WHY e == 0 ??? -dmf */

        if ((fabsf(rstates_goal.alpha) < STATE_ATOL &&
             fabsf(rstates_goal.theta) < STATE_ATOL) &&
            fabsf(rstates_goal.e) < STATE_TOL) {

            info("Robot is at destination (%f)\n", rstates_goal.e);

	    mc->mc_flags &= ~MCF_HAS_PATH_PLAN;
	    at_goal = 1;
        }
	/* if states for waypoint are close to zero,
	 * need another waypoint
	 */
        else if ((mc->mc_plot_code == PPC_WAYPOINT) &&
		 (fabsf(rstates.alpha) < STATE_WAYPOINT_ATOL &&
		  fabsf(rstates.theta) < STATE_WAYPOINT_ATOL) &&

		 /*
		  * XXX This is kind of a hack for waypoints that are the same
		  * position as the goal, but not the right orientation (which
		  * happens when the heading is -pi, but the final orientation
		  * is 0.  So, we need to get right on top of the position
		  * before we switch to refining the orientation.
		  */
		 (((mc->mc_plan.pp_goal_pos.x == mc->mc_plan.pp_waypoint.x) &&
		   (mc->mc_plan.pp_goal_pos.y == mc->mc_plan.pp_waypoint.y)) ?
		  (rstates.e == 0.0f) :
		  (fabsf(rstates.e) < STATE_WAYPOINT_TOL))) {

	    info("Robot is at waypoint (%f)\n", rstates.e);

	    /* unset mc->mc_flags MCF_HAS_PATH_PLAN flag */
	    mc->mc_flags &= ~MCF_HAS_PATH_PLAN;
        }
    }

    if (at_goal) {
	/* tell EMCD */
	mtp_send_packet2(pc_data.pcd_emc_handle,
			 MA_Opcode, MTP_UPDATE_POSITION,
			 MA_Role, MTP_ROLE_RMC,
			 MA_Position, &mc->mc_plan.pp_actual_pos,
			 MA_RobotID, mc->mc_pilot->pc_robot->id,
			 MA_Status, MTP_POSITION_STATUS_COMPLETE,
			 MA_TAG_DONE);

	/* tell robot to STOP */
	mtp_send_packet2(mc->mc_pilot->pc_handle,
			 MA_Opcode, MTP_COMMAND_STOP,
			 MA_Role, MTP_ROLE_RMC,
			 MA_RobotID, mc->mc_pilot->pc_robot->id,
			 MA_CommandID, MASTER_COMMAND_ID,
			 MA_TAG_DONE);
    }
    else if (!(mc->mc_flags & MCF_HAS_PATH_PLAN)) {
        /* need a path plan, call path planner */

        if (debug > 1) {
            info("Need a path plan before sending wheelspeeds\n");
        }

	mc->mc_plot_code = pp_plot_waypoint(&mc->mc_plan);
        switch (mc->mc_plot_code) {
	case PPC_NO_WAYPOINT:
	    mc->mc_flags |= MCF_HAS_PATH_PLAN;
	    break;

	case PPC_WAYPOINT:
	    /* get next waypoint, to get orientation */

	    if (debug > 1) {
		info("Calling path planner to look ahead\n");
	    }

	    mc->mc_plan_lookahead = mc->mc_plan;
	    mc->mc_plan_lookahead.pp_actual_pos = mc->mc_plan.pp_waypoint;

	    switch (pp_plot_waypoint(&mc->mc_plan_lookahead)) {
	    case PPC_NO_WAYPOINT:
	    case PPC_WAYPOINT:
		if (debug) {
		    info("Waypoint orientation established\n");
		    info("Intermediate goal point is %f %f %f\n",
			 mc->mc_plan.pp_waypoint.x,
			 mc->mc_plan.pp_waypoint.y,
			 mc->mc_plan.pp_waypoint.theta);
		    info("Lookahead point is %f %f %f\n",
			 mc->mc_plan_lookahead.pp_waypoint.x,
			 mc->mc_plan_lookahead.pp_waypoint.y,
			 mc->mc_plan_lookahead.pp_waypoint.theta);
		}

		mc->mc_plan.pp_waypoint.theta =
		    atan2(mc->mc_plan.pp_waypoint.y -
			  mc->mc_plan_lookahead.pp_waypoint.y,
			  mc->mc_plan_lookahead.pp_waypoint.x -
			  mc->mc_plan.pp_waypoint.x);
		break;
	    default:
		mc->mc_plan.pp_waypoint.theta = mc->mc_plan.pp_goal_pos.theta;
		break;
	    }

	    /* set mc->mc_flags &= MCF_HAS_PATH_PLAN flag */
	    mc->mc_flags |= MCF_HAS_PATH_PLAN;
	    break;

	case PPC_BLOCKED:
	case PPC_GOAL_IN_OBSTACLE:
	    mc->mc_pause_time = DEFAULT_PAUSE_TIME;
	    assert(mc->mc_self_obstacle == NULL);
	    mc->mc_self_obstacle = ob_add_robot(&mc->mc_plan.pp_actual_pos,
						mc->mc_pilot->pc_robot->id);
	    /* tell robot to STOP */
	    mtp_send_packet2(mc->mc_pilot->pc_handle,
			     MA_Opcode, MTP_COMMAND_STOP,
			     MA_Role, MTP_ROLE_RMC,
			     MA_RobotID, mc->mc_pilot->pc_robot->id,
			     MA_CommandID, MASTER_COMMAND_ID,
			     MA_TAG_DONE);
	    break;
        }

	/* Need to recompute these... */

        /* get states from position data for waypoint */
	if (mc->mc_flags & MCF_HAS_PATH_PLAN) {
	    mc_nlctr_getstates(mc,
			       &rstates,
			       &mc->mc_plan.pp_waypoint,
			       &mc->mc_plan.pp_last_pos,
			       &mc->mc_plan.pp_actual_pos);
	    /*
	     * If distance and alpha are large, we want to pivot before moving.
	     */
	    if ((fabsf(rstates.e) > STATE_DIST_FAR) &&
		(fabsf(rstates.alpha) > STATE_ANGLE_BIG)) {
		mc->mc_plot_code = PPC_WAYPOINT;
		mc->mc_plan.pp_waypoint = mc->mc_plan.pp_actual_pos;
		mc->mc_plan.pp_waypoint.theta = rstates.alpha;
		mc_nlctr_getstates(mc,
				   &rstates,
				   &mc->mc_plan.pp_waypoint,
				   &mc->mc_plan.pp_last_pos,
				   &mc->mc_plan.pp_actual_pos);
	    }
	    /*
	     * If distance and theta are large, we want to pivot after the
	     * move.
	     */
	    else if ((fabsf(rstates.e) > STATE_DIST_FAR) &&
		     fabsf(rstates.theta) > STATE_ANGLE_BIG) {
		mc->mc_plot_code = PPC_WAYPOINT;
		mc->mc_plan.pp_waypoint.theta =
		    mc->mc_plan.pp_actual_pos.theta;
		mc_nlctr_getstates(mc,
				   &rstates,
				   &mc->mc_plan.pp_waypoint,
				   &mc->mc_plan.pp_last_pos,
				   &mc->mc_plan.pp_actual_pos);
	    }
	    info("in %f %f %f\n", rstates.e, rstates.alpha, rstates.theta);
	}
    }

    if (mc->mc_flags & MCF_HAS_PATH_PLAN) {
	/* run controller */
	mc_nlctr_controller(mc, &Vleft, &Vright, &rstates);

	if (debug > 1) {
	    info("Wheel speeds (L/R): %f %f\n", Vleft, Vright);
	}

    if (slogfilep != NULL) {
        fprintf(slogfilep,
		" %f x=%f y=%f th=%f  l=%f r=%f\n"
		"  e=%f a=%f th=%f\n",
                mc->mc_plan.pp_actual_pos.timestamp,
                mc->mc_plan.pp_actual_pos.x,
                mc->mc_plan.pp_actual_pos.y,
                mc->mc_plan.pp_actual_pos.theta,
                Vleft,
                Vright,
                rstates.e,
                rstates.alpha,
                rstates.theta);
    }

	/* send to robot */
	mtp_send_packet2(mc->mc_pilot->pc_handle,
			 MA_Opcode, MTP_COMMAND_WHEELS,
			 MA_Role, MTP_ROLE_RMC,
			 MA_CommandID, MASTER_COMMAND_ID,
			 MA_RobotID, mc->mc_pilot->pc_robot->id,
			 MA_vleft, (double)(Vleft),
			 MA_vright, (double)(Vright),
			 MA_TAG_DONE);
    }

    return 0;
}



static int mc_kcwrapper(struct master_controller *mc, mtp_packet_t *mp)
{
    /* Wrapper for the nonlinear kinematic trajectory
     * tracking controller
     * (dmf)
     */




    struct tdata this_td; // Reference trajectory datum

    struct vwheels wspeed; // Wheel speed data

    struct robot_position tcur; // Current robot position
    struct robot_position tref; // Reference robot position
    struct vo vref; // Reference velocity


    int kcgo = 1;
    int refval;
    int tstop = 0;

    struct timeval tv_current;

    float e_cur;



    assert(mc != NULL);
    assert(mc_invariant(mc));
    assert(mp != NULL);

    if (debug > 1)
        info("=| Hello from mc_kcwrapper. |=\n");






    // Start null primitive if needed
    if (!(mc->mc_flags & MCF_NULL_STARTED)) {
        mtp_send_packet2(mc->mc_pilot->pc_handle,
                         MA_Opcode, MTP_COMMAND_STARTNULL,
                         MA_Role, MTP_ROLE_RMC,
                         MA_RobotID, mc->mc_pilot->pc_robot->id,
                         MA_CommandID, MASTER_COMMAND_ID,
                         MA_Acceleration, NULL_ACCEL,
                         MA_TAG_DONE);

        mc->mc_flags |= MCF_NULL_STARTED;

        // Set new start time
        // FIXME: this is hacked
        // The trajectory should get created right before the move,
        // but it gets created at the first goto.
        gettimeofday(&tv_current, NULL);
        mc->tf_start = (double)(tv_current.tv_sec) +
                       (double)(tv_current.tv_usec) / 1000000.0;

    }



    /* Set localized position */
    tcur = mc->mc_plan.pp_actual_pos;

    // Flip the y values:
    /* FUCKING BATSHIT INSANE STUPID BULLSHIT COORDINATE SYSTEM,
     * FUCK YOU.
     */
//         tref.y = -tref.y;
    tcur.y = -tcur.y;


    // Get current reference time:
    gettimeofday(&tv_current, NULL);
    mc->tf_cur = (double)(tv_current.tv_sec) +
                 (double)(tv_current.tv_usec) / 1000000.0 -
                 mc->tf_start;

    if (debug > 2) {
        printf("[mc_kcwrapper]: tf_start = %f, tf_current = %f\n",
               mc->tf_start, mc->tf_cur);
    }

    /* Set reference position */
    refval = cp_grabref(mc->td, mc->tr_size, &this_td, mc->tf_cur);

    tref.timestamp = this_td.t;
    tref.x = this_td.x;
    tref.y = this_td.y;
    tref.theta = this_td.phi;

    vref.timestamp = this_td.t;
    vref.v = this_td.v;
    vref.omega = this_td.omega;

    /* Set current position to local timestamp */
    tcur.timestamp = this_td.t;

    /* Set e current */
    e_cur = sqrt(pow(tcur.x - tref.x, 2) +
                 pow(tcur.y - tref.y, 2));


    /* Stopping criteria */
    if (refval != 0 && e_cur < E_BUBBLE) {
        info("[mc_kcwrapper]: Trajectory tracking completed. (Success)\n");
        tstop = 1;
    }

    if (e_cur > E_CUTOFF) {
        if (debug) {
            info("[mc_kcwrapper]: Aborting controller. Robot is too far away from reference trajectory.\n");
            if (debug > 2) {
            printf("[mc_kcwrapper]: e = %f, e_max = %f\n",
                   e_cur, E_CUTOFF);
            printf("[mc_kcwrapper]: xr = %f yr = %f, xc = %f yc = %f\n",
                   tref.x, tref.y, tcur.x, tcur.y);
            }
        }
        tstop = 1;
    }


    if (1 == tstop) {
        /*
         * send MTP_POSITION_STATUS_COMPLETE,
         * and stop the robot.
         */

        if (debug) {
            info("[mc_kcwrapper]: Stopping the robot.\n");
        }

        mc->mc_flags &= ~MCF_HAS_PATH_PLAN;
        mc->mc_flags &= ~MCF_NULL_STARTED;

        /* tell EMCD */
        mtp_send_packet2(pc_data.pcd_emc_handle,
                         MA_Opcode, MTP_UPDATE_POSITION,
                         MA_Role, MTP_ROLE_RMC,
                         MA_Position, &mc->mc_plan.pp_actual_pos,
                         MA_RobotID, mc->mc_pilot->pc_robot->id,
                         MA_Status, MTP_POSITION_STATUS_COMPLETE,
                         MA_TAG_DONE);

        /* tell robot to STOP */
        mtp_send_packet2(mc->mc_pilot->pc_handle,
                         MA_Opcode, MTP_COMMAND_STOP,
                         MA_Role, MTP_ROLE_RMC,
                         MA_RobotID, mc->mc_pilot->pc_robot->id,
                         MA_CommandID, MASTER_COMMAND_ID,
                         MA_TAG_DONE);

        kcgo = 0;
        mc->tr_size = 0;

    }
    else {
        // Create a trajectory here if none exists
        if (0 == mc->tr_size) {
            if (debug) {
                printf("[mc_kcwrapper]: No reference trajectory, creating new one.\n");
            }
            mc_maketraj(mc, mp);
        }

        // Recheck for existing trajectory
        if (0 == mc->tr_size) {
            // No reference trajectory
            kcgo = 0;
            if (debug) {
                fprintf(stderr, "ERROR [mc_kcwrapper]: Still no reference trajectory.\n");
            }
        }
    }






    if (kcgo) {


        if (debug > 3) {
            info("[mc_kcwrapper]: Ref = [%f %f %f] Cur = [%f %f %f]\n",
                 tref.timestamp, tref.x, tref.y,
                 tcur.timestamp, tcur.x, tcur.y);
        }


        /* Initialize wheel speeds */
        wspeed.vl = 0.0f;
        wspeed.vr = 0.0f;

        /* Call controller */
        kc_main(&wspeed, &tcur, &tref, &vref, &(mc->kcp));


        /* Apply wheel speed limits */
        if (wspeed.vl > mc->speedlimit)
            wspeed.vl = mc->speedlimit;
        if (wspeed.vl < -mc->speedlimit)
            wspeed.vl = -mc->speedlimit;
        if (wspeed.vr > mc->speedlimit)
            wspeed.vr = mc->speedlimit;
        if (wspeed.vr < -mc->speedlimit)
            wspeed.vr = -mc->speedlimit;

        if (debug > 2) {
            printf("[mc_kcwrapper]: Wheel speeds L/R: %f %f\n",
                   wspeed.vl, wspeed.vr);
        }



        /* send wheel speeds to robot */
        mtp_send_packet2(mc->mc_pilot->pc_handle,
                         MA_Opcode, MTP_COMMAND_WHEELS,
                         MA_Role, MTP_ROLE_RMC,
                         MA_CommandID, MASTER_COMMAND_ID,
                         MA_RobotID, mc->mc_pilot->pc_robot->id,
                         MA_vleft, (double)(wspeed.vl),
                         MA_vright, (double)(wspeed.vr),
                         MA_TAG_DONE);



    }
    else {
        if (debug) {
            printf("[mc_kcwrapper]: Controller aborted. Wheel speeds not sent.\n");
        }
    }

    return 0;

}




static int mc_ctrl_wrapper(struct master_controller *mc, mtp_packet_t *mp) {
    /* Call a nonlinear controller, based on runtime configuration
     */

    int retval = 0;


    assert(mc != NULL);
    assert(mc_invariant(mc));
    assert(mp != NULL);


    switch (nl_ctrlch) {
    case 0:
        // WTF: this should not be called, no controller chosen
        if (debug) {
            info("[mc_ctrl_wrapper]: No nonlinear controller chosen. Use the -n flag when starting RMCD.\n");
        }
        break;
    case 1:
        if (debug > 1) {
            info("[mc_ctrl_wrapper]: Using posture regulator A.\n");
        }
        retval = mc_nlwrapper(mc, mp);
        break;
    case 2:
        if (debug > 1) {
            info("[mc_ctrl_wrapper]: Using posture regulator B.\n");
        }
        retval = mc_nlwrapper(mc, mp);
        break;
    case 3:
        if (debug > 1) {
            info("[mc_ctrl_wrapper]: Using kinematic TT controller.\n");
        }
        retval = mc_kcwrapper(mc, mp);
        break;
    default:
        // Unknown controller
        fatal("[mc_ctrl_wrapper]: unknown controller type.\n");
    }

    return retval;

}











int mc_handle_emc_packet(struct master_controller *mc, mtp_packet_t *mp)
{
    int rc, retval = 0;

    assert(mc != NULL);
    assert(mc_invariant(mc));
    assert(mp != NULL);

    rc = mtp_dispatch(mc, mp,
		      MD_Integer, mc->mc_flags,
		      MD_Integer, mc->mc_pause_time,

		      MD_OnOpcode, MTP_COMMAND_GOTO,
		      MD_Call, mc_set_goal,
              MD_AlsoCall, mc_maketraj, /* create ref trajectory */


		      /*
		       * Always update the position before calling anything
		       * else.
		       */
		      MD_OnOpcode, MTP_UPDATE_POSITION,
		      MD_AlsoCall, mc_set_actual,

              /* Call a nonlinear controller */
		      MD_OnOpcode, MTP_UPDATE_POSITION,
		      MD_OnStatus, MTP_POSITION_STATUS_MOVING,
		      MD_OnClearedFlags, MCF_CONTACT,
		      MD_OnInteger /* mc_pause_time */, 0,
		      MD_Call, mc_ctrl_wrapper,

		      /* The sensors fired, get a report before moving. */
		      MD_OnFlags, MCF_CONTACT,
		      MD_OnOpcode, MTP_UPDATE_POSITION,
		      MD_OnStatus, MTP_POSITION_STATUS_UNKNOWN,
		      MD_Call, mc_request_report,

		      MD_OnOpcode, MTP_UPDATE_POSITION,
		      MD_OnStatus, MTP_POSITION_STATUS_UNKNOWN,
		      MD_Call, mc_plot,

		      MD_OnOpcode, MTP_UPDATE_POSITION,
		      MD_OnStatus, MTP_POSITION_STATUS_MOVING,
		      MD_Return,

		      MD_TAG_DONE);

    return retval;
}

static int mc_update_flags(struct master_controller *mc, mtp_packet_t *mp)
{
    mtp_status_t ms;
    int retval = 0;

    assert(mc != NULL);
    assert(mc_invariant(mc));
    assert(mp != NULL);

    ms = mp->data.mtp_payload_u.update_position.status;

    switch (ms) {
    case MTP_POSITION_STATUS_CONTACT:
	mc->mc_flags |= MCF_CONTACT;
	break;

    default:
	mc->mc_flags &= ~MCF_CONTACT;
	mc->mc_flags &= ~MCF_NULL_STARTED;
	break;
    }

    return retval;
}

static int mc_pause(struct master_controller *mc, mtp_packet_t *mp)
{
    int retval = 0;

    assert(mc != NULL);
    assert(mc_invariant(mc));
    assert(mp != NULL);

    mc->mc_pilot->pc_flags &= ~PCF_EXPECTING_RESPONSE;
    mc->mc_pause_time = DEFAULT_PAUSE_TIME;
    if (mc->mc_self_obstacle == NULL)
	mc->mc_self_obstacle = ob_add_robot(&mc->mc_plan.pp_actual_pos,
					    mc->mc_pilot->pc_robot->id);

    return retval;
}

static int mc_request_position(struct master_controller *mc, mtp_packet_t *mp)
{
    int retval = 0;

    assert(mc != NULL);
    assert(mc_invariant(mc));

    mc->mc_pause_time = 0;
    ob_rem_obstacle(mc->mc_self_obstacle);
    mc->mc_self_obstacle = NULL;
    mc->mc_pilot->pc_flags &= ~PCF_EXPECTING_RESPONSE;
    mtp_send_packet2(pc_data.pcd_emc_handle,
		     MA_Opcode, MTP_REQUEST_POSITION,
		     MA_Role, MTP_ROLE_RMC,
		     MA_RobotID, mc->mc_pilot->pc_robot->id,
		     MA_TAG_DONE);

    return retval;
}

static int mc_process_report(struct master_controller *mc, mtp_packet_t *mp)
{
    int lpc, compass = 0, retval = 0;
    struct mtp_contact_report *mcr;

    assert(mc != NULL);
    assert(mc_invariant(mc));
    assert(mp != NULL);

    mc->mc_flags &= ~MCF_HAS_PATH_PLAN;
    mc->mc_pilot->pc_flags &= ~PCF_EXPECTING_RESPONSE;
    mcr = &mp->data.mtp_payload_u.contact_report;

    for (lpc = 0; lpc < mcr->count; lpc++) {
	struct pilot_connection *pc;
	struct robot_position rp;
	struct contact_point cp;
	float local_bearing;

	local_bearing = atan2f(mcr->points[lpc].y, mcr->points[lpc].x);
	compass |= (mtp_compass(local_bearing) & (MCF_EAST|MCF_WEST));

	ob_obstacle_location(&cp,
			     &mc->mc_plan.pp_actual_pos,
			     &mcr->points[lpc]);
	rp.x = cp.x;
	rp.y = cp.y;
	pc = pc_find_pilot_by_location(&rp, 0.40, mc->mc_pilot);
	info("loc %p %u\n", pc, pc != NULL ? pc->pc_master.mc_pause_time : 0);
	if (pc == NULL) {
	    ob_found_obstacle(&mc->mc_plan.pp_actual_pos, &cp);
	}
	else if (pc->pc_master.mc_self_obstacle == NULL) {
	    compass = MCF_EAST|MCF_WEST;
	}
    }

    switch (compass) {
    case MCF_EAST|MCF_WEST:
	info("%s cannot move!\n", mc->mc_pilot->pc_robot->hostname);
	mc->mc_pause_time = DEFAULT_PAUSE_TIME;
	mc->mc_self_obstacle = ob_add_robot(&mc->mc_plan.pp_actual_pos,
					    mc->mc_pilot->pc_robot->id);
	break;
    case MCF_EAST:
    case MCF_WEST:
	info("%s detected an obstacle to the %s\n",
	     mc->mc_pilot->pc_robot->hostname,
	     MTP_COMPASS_STRING(compass));
	mtp_send_packet2(mc->mc_pilot->pc_handle,
			 MA_Opcode, MTP_COMMAND_GOTO,
			 MA_Role, MTP_ROLE_RMC,
			 MA_X, compass == MCF_EAST ? -0.1 : 0.1,
			 MA_RobotID, mc->mc_pilot->pc_robot->id,
			 MA_CommandID, MASTER_COMMAND_ID,
			 MA_Speed, 0.1,
			 MA_TAG_DONE);
	break;
    case 0:
	info("%s's obstacle disappeared\n", mc->mc_pilot->pc_robot->hostname);
	mc->mc_flags &= ~(MCF_CONTACT|MCF_NULL_STARTED);
	mc_request_position(mc, NULL);
	break;

    default:
	assert(0);
	break;
    }

    return retval;
}

int mc_handle_pilot_packet(struct master_controller *mc, mtp_packet_t *mp)
{
    int rc, retval = 0;

    assert(mc != NULL);
    assert(mc_invariant(mc));
    assert(mp != NULL);

    rc = mtp_dispatch(mc, mp,
		      MD_Integer, mc->mc_flags,

		      /* Ignore any packets not sent by this controller. */
		      MD_OnCommandID, SLAVE_COMMAND_ID,
		      MD_Return,

		      MD_OnOpcode, MTP_UPDATE_POSITION,
		      MD_OnStatus, MTP_POSITION_STATUS_CONTACT,
		      MD_OnFlags, MCF_NULL_STARTED,
		      MD_AlsoCall, mc_request_report,

		      /* Always update some flags before other calls. */
		      MD_OnOpcode, MTP_UPDATE_POSITION,
		      MD_AlsoCall, mc_update_flags,

		      MD_OnOpcode, MTP_UPDATE_POSITION,
		      MD_OnStatus, MTP_POSITION_STATUS_ERROR,
		      MD_Call, mc_pause,

		      MD_OnOpcode, MTP_UPDATE_POSITION,
		      MD_Call, mc_request_position,

		      MD_OnOpcode, MTP_CONTACT_REPORT,
		      MD_Call, mc_process_report,

		      MD_TAG_DONE);

    return retval;
}

int mc_handle_switch(struct master_controller *mc)
{
    int retval = 0;

    assert(mc != NULL);
    assert(mc_invariant(mc));

    retval = mc_request_position(mc, NULL);

    return retval;
}

int mc_handle_tick(struct master_controller *mc)
{
    int retval = 0;

    assert(mc != NULL);
    assert(mc_invariant(mc));

    if (mc->mc_pause_time > 0) {
	mc->mc_pause_time -= 1;

	if (mc->mc_pause_time == 0)
	    retval = mc_request_position(mc, NULL);
    }

    return retval;
}






