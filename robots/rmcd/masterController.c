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

struct master_controller_data mc_data;

/**
 * Do a fuzzy comparison of two values.
 *
 * @param x1 The first value.
 * @param x2 The second value.
 * @param tol The amount of tolerance to take into account when doing the
 * comparison.
 */
#define cmp_fuzzy(x1, x2, tol) \
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

static int mc_set_actual(struct master_controller *mc, mtp_packet_t *mp)
{
    int retval = 0;
    
    assert(mc != NULL);
    assert(mc_invariant(mc));
    assert(mp != NULL);

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
	    
	    mc->mc_pilot->pc_flags |= PCF_EXPECTING_RESPONSE;
	    mc->mc_pilot->pc_connection_timeout = WIGGLE_RESPONSE_TIMEOUT;
	}
    }
    else {
	struct robot_position *rp = NULL, _rp;
	
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
	}
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

		      MD_OnOpcode, MTP_COMMAND_GOTO,
		      MD_Call, mc_set_goal,

		      /*
		       * Always update the position before calling anything
		       * else.
		       */
		      MD_OnOpcode, MTP_UPDATE_POSITION,
		      MD_AlsoCall, mc_set_actual,

		      /* The sensors fired, get a report before moving. */
		      MD_OnFlags, MCF_CONTACT,
		      MD_OnOpcode, MTP_UPDATE_POSITION,
		      MD_Call, mc_request_report,

		      MD_OnOpcode, MTP_UPDATE_POSITION,
		      MD_Call, mc_plot,

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
    
    return retval;
}

static int mc_request_position(struct master_controller *mc, mtp_packet_t *mp)
{
    int retval = 0;
    
    assert(mc != NULL);
    assert(mc_invariant(mc));

    mc->mc_pause_time = 0;
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
	if ((pc == NULL) || (pc->pc_master.mc_pause_time > 0))
	    ob_found_obstacle(&mc->mc_plan.pp_actual_pos, &cp);
	else
	    compass = MCF_EAST|MCF_WEST;
    }

    switch (compass) {
    case MCF_EAST|MCF_WEST:
	info("%s cannot move!\n", mc->mc_pilot->pc_robot->hostname);
	mc->mc_pause_time = DEFAULT_PAUSE_TIME;
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

		      /* Ignore any packets not sent by this controller. */
		      MD_OnCommandID, SLAVE_COMMAND_ID,
		      MD_Return,

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

	if (mc->mc_pause_time == 0) {
	    retval = mc_request_position(mc, NULL);
	}
    }

    return retval;
}
