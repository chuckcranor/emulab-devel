
#include "config.h"

#include <math.h>
#include <stdio.h>
#include <stdarg.h>
#include <assert.h>

#include "log.h"
#include "rclip.h"
#include "obstacles.h"
#include "pathPlanning.h"
#include "pilotConnection.h"
#include "masterController.h"

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

static int mc_set_goal(struct master_controller *mc, mtp_packet_t *mp)
{

    int retval = 0;
    
    assert(mc != NULL);
    assert(mp != NULL);

    mc->mc_pause_time = 0;
    mc->mc_flags &= ~(MCF_HAS_WAYPOINT|MCF_HAS_OBSTACLE|MCF_CONTACT);
    mc->mc_tries_remaining = pc_data.pcd_max_refine_retries;
    mc->mc_goal_pos = mp->data.mtp_payload_u.command_goto.position;

    if (mc->mc_pilot->pc_control_mode == PCM_MASTER) {
	mtp_packet_t smp;
	
	mtp_init_packet(&smp,
			MA_Opcode, MTP_COMMAND_STOP,
			MA_Role, MTP_ROLE_RMC,
			MA_RobotID, mc->mc_pilot->pc_robot->id,
			MA_CommandID, MASTER_COMMAND_ID,
			MA_TAG_DONE);
	mtp_send_packet(mc->mc_pilot->pc_handle, &smp);

	//pc_stats_stop_time(mc->mc_pilot);
	//pc_stats_msg("fp");
	//pc_print_stats(mc->mc_pilot);
	pc_zero_stats(mc->mc_pilot);
	pc_stats_start_pos(mc->mc_pilot,&(mc->mc_goal_pos));
	pc_stats_start_time(mc->mc_pilot);

    }
    else {
	mtp_packet_t rmp;
	
	mtp_init_packet(&rmp,
			MA_Opcode, MTP_REQUEST_POSITION,
			MA_Role, MTP_ROLE_RMC,
			MA_RobotID, mc->mc_pilot->pc_robot->id,
			MA_TAG_DONE);
	mtp_send_packet(pc_data.pcd_emc_handle, &rmp);

	// don't print here -- cause the previous move, if any, finished 
	// more or less successfully...
        pc_zero_stats(mc->mc_pilot);
        pc_stats_start_pos(mc->mc_pilot,&(mc->mc_goal_pos));

    }
    
    return retval;
}

static int mc_set_actual(struct master_controller *mc, mtp_packet_t *mp)
{
    int retval = 0;
    
    assert(mc != NULL);
    assert(mp != NULL);

    mc->mc_actual_pos = mp->data.mtp_payload_u.update_position.position;

    // set the current "final" stats pos
    pc_stats_end_pos(mc->mc_pilot,&(mc->mc_actual_pos));
    
    return retval;
}

static int mc_request_report(struct master_controller *mc, mtp_packet_t *mp)
{
    mtp_packet_t rmp;
    int retval = 0;
    
    assert(mc != NULL);
    assert(mp != NULL);

    mtp_init_packet(&rmp,
		    MA_Opcode, MTP_REQUEST_REPORT,
		    MA_Role, MTP_ROLE_RMC,
		    MA_RobotID, mc->mc_pilot->pc_robot->id,
		    MA_TAG_DONE);
    mtp_send_packet(mc->mc_pilot->pc_handle, &rmp);
    
    return retval;
}

static int mc_plot(struct master_controller *mc, mtp_packet_t *mp)
{
    float distance, theta;
    int retval = 0;
    
    assert(mc != NULL);
    assert(mp != NULL);

    mtp_polar(&mc->mc_actual_pos, &mc->mc_goal_pos, &distance, &theta);

    if ((mc->mc_tries_remaining <= 0) || (distance <
					  pc_data.pcd_meter_tolerance)) {

	// new: take the finish timestamp and dump data
      //pc_stats_stop_time(mc->mc_pilot);

      /* done moving */
	if (cmp_fuzzy(mc->mc_actual_pos.theta,
		      mc->mc_goal_pos.theta,
		      pc_data.pcd_radian_tolerance)) {
            /* made it */
	    mtp_packet_t ump;
	    
	    mtp_init_packet(&ump,
			    MA_Opcode, MTP_UPDATE_POSITION,
			    MA_Role, MTP_ROLE_RMC,
			    MA_Position, &mc->mc_actual_pos,
			    MA_RobotID, mc->mc_pilot->pc_robot->id,
			    MA_Status, MTP_POSITION_STATUS_COMPLETE,
			    MA_TAG_DONE);
	    mtp_send_packet(pc_data.pcd_emc_handle, &ump);

	    pc_stats_stop_time(mc->mc_pilot);
	    pc_print_stats(mc->mc_pilot);

	    //pc_stats_msg(mc->mc_pilot,PC_STATS_MSG_SUCCESS);

	}
	else {
            /* failed */
	    mtp_packet_t gmp;

	    mtp_init_packet(&gmp,
			    MA_Opcode, MTP_COMMAND_GOTO,
			    MA_Role, MTP_ROLE_RMC,
			    MA_RobotID, mc->mc_pilot->pc_robot->id,
			    MA_CommandID, MASTER_COMMAND_ID,
			    MA_Theta, (mc->mc_goal_pos.theta -
				       mc->mc_actual_pos.theta),
			    MA_TAG_DONE);
	    mtp_send_packet(mc->mc_pilot->pc_handle, &gmp);

	    //pc_stats_msg(mc->mc_pilot,PC_STATS_MSG_FAILURE);

	}

	//pc_print_stats(mc->mc_pilot);
	//pc_zero_stats(mc->mc_pilot);

    }
    else {
	/* still moving */
	struct robot_position *rp = NULL, _rp;
	
	switch (pp_plot_waypoint(&mc->mc_actual_pos,
				 &mc->mc_goal_pos,
				 &mc->mc_waypoint)) {
	case PPC_NO_WAYPOINT:
	    info("no waypoint\n");
	    rp = mtp_world2local(&_rp, &mc->mc_actual_pos, &mc->mc_goal_pos);
	    mc->mc_tries_remaining -= 1;

	    pc_stats_add_retry(mc->mc_pilot);

	    break;
	case PPC_WAYPOINT:
	    info("waypoint\n");
	    rp = mtp_world2local(&_rp, &mc->mc_actual_pos, &mc->mc_waypoint);
	    mc->mc_tries_remaining = pc_data.pcd_max_refine_retries;
	    break;
	case PPC_BLOCKED:
	case PPC_GOAL_IN_OBSTACLE:
	    info("blocked\n");
	    mc->mc_pause_time = DEFAULT_PAUSE_TIME;
	    break;
	}

	if (rp != NULL) {
	    mtp_packet_t gmp;

	    info("move to %.2f %.2f\n", rp->x, rp->y);
	    mtp_init_packet(&gmp,
			    MA_Opcode, MTP_COMMAND_GOTO,
			    MA_Role, MTP_ROLE_RMC,
			    MA_RobotID, mc->mc_pilot->pc_robot->id,
			    MA_CommandID, MASTER_COMMAND_ID,
			    MA_Position, rp,
			    MA_TAG_DONE);
	    mtp_send_packet(mc->mc_pilot->pc_handle, &gmp);
	}
    }

    return retval;
}

int mc_handle_emc_packet(struct master_controller *mc, mtp_packet_t *mp)
{
    int rc, retval = 0;
    
    assert(mc != NULL);
    assert(mp != NULL);

    rc = mtp_dispatch(mc, mp,
		      MD_Integer, mc->mc_flags,

		      MD_OnOpcode, MTP_COMMAND_GOTO,
		      MD_Call, mc_set_goal,

		      MD_OnOpcode, MTP_UPDATE_POSITION,
		      MD_AlsoCall, mc_set_actual,

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
    assert(mp != NULL);

    ms = mp->data.mtp_payload_u.update_position.status;
    
    switch (ms) {
    case MTP_POSITION_STATUS_CONTACT:
	printf("got contact\n");
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
    assert(mp != NULL);

    info("pause\n");
    mc->mc_pause_time = DEFAULT_PAUSE_TIME;
    
    return retval;
}

static int mc_request_position(struct master_controller *mc, mtp_packet_t *mp)
{
    mtp_packet_t rmp;
    int retval = 0;
    
    assert(mc != NULL);

    mtp_init_packet(&rmp,
		    MA_Opcode, MTP_REQUEST_POSITION,
		    MA_Role, MTP_ROLE_RMC,
		    MA_RobotID, mc->mc_pilot->pc_robot->id,
		    MA_TAG_DONE);
    mtp_send_packet(pc_data.pcd_emc_handle, &rmp);
    
    return retval;
}

static int mc_process_report(struct master_controller *mc, mtp_packet_t *mp)
{
    int lpc, compass = 0, retval = 0;
    struct mtp_contact_report *mcr;
    mtp_packet_t gmp;
    
    assert(mc != NULL);
    assert(mp != NULL);

    mcr = &mp->data.mtp_payload_u.contact_report;

    for (lpc = 0; lpc < mcr->count; lpc++) {
	struct obstacle_config *oc, oc_fake;
	struct contact_point cp;
	float local_bearing;
	struct rc_line rl;

	local_bearing = atan2f(mcr->points[lpc].y, mcr->points[lpc].x);
	compass |= (mtp_compass(local_bearing) & (MCF_EAST|MCF_WEST));
	
	REL2ABS(&cp,
		mc->mc_actual_pos.theta,
		&mcr->points[lpc],
		&mc->mc_actual_pos);
	
	rl.x0 = mc->mc_actual_pos.x;
	rl.y0 = mc->mc_actual_pos.y;
	rl.x1 = cp.x;
	rl.y1 = cp.y;
	
	if ((mc->mc_flags & MCF_HAS_OBSTACLE) ||
	    (oc = ob_find_obstacle(pc_data.pcd_config, &rl)) == NULL) {
	    oc = ob_make_obstacle(&oc_fake,
				  &mc->mc_actual_pos,
				  &mcr->points[lpc]);
	}

	if (mc->mc_flags & MCF_HAS_OBSTACLE) {
	    ob_merge_obstacles(&mc->mc_obstacle, oc);
	}
	else {
	    mc->mc_obstacle = *oc;
	    mc->mc_flags |= MCF_HAS_OBSTACLE;
	}
    }

    switch (compass) {
    case MCF_EAST|MCF_WEST:
	info("debug: %s cannot move!\n", mc->mc_pilot->pc_robot->hostname);
	mc->mc_pause_time = DEFAULT_PAUSE_TIME;
	break;
    case MCF_EAST:
    case MCF_WEST:
	mtp_init_packet(&gmp,
			MA_Opcode, MTP_COMMAND_GOTO,
			MA_Role, MTP_ROLE_RMC,
			MA_X, compass == MCF_EAST ? -0.1 : 0.1,
			MA_RobotID, mc->mc_pilot->pc_robot->id,
			MA_CommandID, MASTER_COMMAND_ID,
			MA_TAG_DONE);
	mtp_send_packet(mc->mc_pilot->pc_handle, &gmp);
	break;
    case 0:
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
    assert(mp != NULL);

    rc = mtp_dispatch(mc, mp,
		      
		      MD_OnCommandID, SLAVE_COMMAND_ID,
		      MD_Return,

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

    retval = mc_request_position(mc, NULL);

    return retval;
}

int mc_handle_tick(struct master_controller *mc)
{
    int retval = 0;
    
    assert(mc != NULL);

    if (mc->mc_pause_time > 0) {
	mc->mc_pause_time -= 1;

	if (mc->mc_pause_time == 0) {
	    retval = mc_request_position(mc, NULL);
	}
    }

    return retval;
}
