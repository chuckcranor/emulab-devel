
#include "config.h"

#include <math.h>
#include <assert.h>

#include "rclip.h"
#include "pilotConnection.h"
#include "pathPlanning.h"

static int pp_point_in_bounds(float x, float y)
{
    int lpc, boxes_len, retval = 0;
    struct box *boxes;

    boxes = pc_data.pcd_config->bounds.bounds_val;
    boxes_len = pc_data.pcd_config->bounds.bounds_len;

    for (lpc = 0; lpc < boxes_len; lpc++) {
	if (x >= boxes[lpc].x && y >= boxes[lpc].y &&
	    x <= (boxes[lpc].x + boxes[lpc].width) && 
	    y <= (boxes[lpc].y + boxes[lpc].height)) {
	    retval = 1;
	    break;
	}
    }

    return retval;
}

#if 0
static int pp_point_in_obstacle(float x, float y)
{
    int lpc, oc_len, retval = 0;
    struct obstacle_config *oc;

    oc = pc_data.pcd_config->obstacles.obstacles_val;
    oc_len = pc_data.pcd_config->obstacles.obstacles_len;

    for (lpc = 0; lpc < oc_len; lpc++) {
	if (x >= oc[lpc].xmin && y >= oc[lpc].ymin &&
	    x <= oc[lpc].xmax && y <= oc[lpc].ymax) {
	    retval = 1;
	    break;
	}
    }

    return retval;
}
#endif

pp_plot_code_t pp_plot_waypoint(struct robot_position *actual,
				struct obstacle_config *oc,
				struct robot_position *goal,
				struct robot_position *waypoint_out)
{
    float distance, theta;
    pp_plot_code_t retval;

    assert(actual != NULL);
    assert(goal != NULL);
    assert(waypoint_out != NULL);

    if (oc == NULL) {
	retval = PPC_NO_WAYPOINT;
    }
    else {
	struct rc_line rl;
	rc_code_t rc;
	
	rl.x0 = actual->x;
	rl.y0 = actual->y;
	rl.x1 = goal->x;
	rl.y1 = goal->y;
	
	rc = rc_compute_closest(&rl.x0, &rl.y0, oc);
	if (rc_compute_code(goal->x, goal->y, oc) == 0) {
	    retval = PPC_GOAL_IN_OBSTACLE;
	}
	else if ((rc_clip_line(&rl, oc) == 0) ||
		 (hypotf(rl.x0 - rl.x1, rl.y0 - rl.y1) < 0.20)) {
	    retval = PPC_NO_WAYPOINT;
	}
	else {
	    int new_rc = 0, alt_rc = 0;
	    float bearing;
	    int compass;

	    retval = PPC_WAYPOINT;
	    
	    bearing = atan2f(rl.y0 - rl.y1, rl.x1 - rl.x0);
	    compass = mtp_compass(bearing);
	    
	    switch (rc) {
	    case RCF_TOP|RCF_LEFT:
		if (compass & MCF_EAST) {
		    new_rc = RCF_TOP|RCF_RIGHT;
		    alt_rc = ~new_rc & RCF_ALL;
		}
		else if (compass & MCF_SOUTH) {
		    new_rc = RCF_BOTTOM|RCF_LEFT;
		    alt_rc = ~new_rc & RCF_ALL;
		}
		else {
		    assert(0);
		}
		break;
	    case RCF_BOTTOM|RCF_LEFT:
		if (compass & MCF_EAST) {
		    new_rc = RCF_BOTTOM|RCF_RIGHT;
		    alt_rc = ~new_rc & RCF_ALL;
		}
		else if (compass & MCF_NORTH) {
		    new_rc = RCF_TOP|RCF_LEFT;
		    alt_rc = ~new_rc & RCF_ALL;
		}
		else {
		    assert(0);
		}
		break;
	    case RCF_BOTTOM|RCF_RIGHT:
		if (compass == (MCF_NORTH|MCF_WEST)) {
		    new_rc = RCF_BOTTOM|RCF_LEFT;
		    alt_rc = ~new_rc & RCF_ALL;
		}
		else if (compass & MCF_NORTH) {
		    new_rc = RCF_TOP|RCF_RIGHT;
		    alt_rc = ~new_rc & RCF_ALL;
		}
		else if (compass & MCF_WEST) {
		    new_rc = RCF_BOTTOM|RCF_LEFT;
		    alt_rc = ~new_rc & RCF_ALL;
		}
		else {
		    assert(0);
		}
		break;
	    case RCF_TOP|RCF_RIGHT:
		if (compass & MCF_SOUTH) {
		    new_rc = RCF_BOTTOM|RCF_RIGHT;
		    alt_rc = ~new_rc & RCF_ALL;
		}
		else if (compass & MCF_WEST) {
		    new_rc = RCF_TOP|RCF_LEFT;
		    alt_rc = ~new_rc & RCF_ALL;
		}
		else {
		    assert(0);
		}
		break;
	    case RCF_LEFT:
		if (compass & MCF_EAST) {
		    new_rc = rc_closest_corner(rl.x0, rl.y0, oc);
		    alt_rc = new_rc ^ (RCF_TOP|RCF_BOTTOM);
		}
		else if (compass & MCF_NORTH) {
		    new_rc = RCF_TOP|RCF_LEFT;
		    alt_rc = RCF_BOTTOM|RCF_LEFT;
		}
		else if (compass & MCF_SOUTH) {
		    new_rc = RCF_BOTTOM|RCF_LEFT;
		    alt_rc = RCF_TOP|RCF_LEFT;
		}
		else {
		    assert(0);
		}
		break;
	    case RCF_TOP:
		if (compass & MCF_SOUTH) {
		    new_rc = rc_closest_corner(rl.x0, rl.y0, oc);
		    alt_rc = new_rc ^ (RCF_LEFT|RCF_RIGHT);
		}
		else if (compass & MCF_EAST) {
		    new_rc = RCF_TOP|RCF_RIGHT;
		    alt_rc = RCF_TOP|RCF_LEFT;
		}
		else if (compass & MCF_WEST) {
		    new_rc = RCF_TOP|RCF_LEFT;
		    alt_rc = RCF_TOP|RCF_RIGHT;
		}
		else {
		    assert(0);
		}
		break;
	    case RCF_RIGHT:
		if (compass & MCF_WEST) {
		    new_rc = rc_closest_corner(rl.x0, rl.y0, oc);
		    alt_rc = new_rc ^ (RCF_TOP|RCF_BOTTOM);
		}
		else if (compass & MCF_NORTH) {
		    new_rc = RCF_TOP|RCF_RIGHT;
		    alt_rc = RCF_BOTTOM|RCF_LEFT;
		}
		else if (compass & MCF_SOUTH) {
		    new_rc = RCF_BOTTOM|RCF_RIGHT;
		    alt_rc = RCF_TOP|RCF_LEFT;
		}
		else {
		    assert(0);
		}
		break;
	    case RCF_BOTTOM:
		if (compass & MCF_NORTH) {
		    new_rc = rc_closest_corner(rl.x0, rl.y0, oc);
		    alt_rc = new_rc ^ (RCF_LEFT|RCF_RIGHT);
		}
		else if (compass & MCF_EAST) {
		    new_rc = RCF_BOTTOM|RCF_RIGHT;
		    alt_rc = RCF_BOTTOM|RCF_LEFT;
		}
		else if (compass & MCF_WEST) {
		    new_rc = RCF_BOTTOM|RCF_LEFT;
		    alt_rc = RCF_BOTTOM|RCF_RIGHT;
		}
		else {
		    assert(0);
		}
		break;

	    default:
		assert(0);
		break;
	    }

	    rc_corner(new_rc, waypoint_out, oc);

	    if (!pp_point_in_bounds(waypoint_out->x, waypoint_out->y)) {
		new_rc = alt_rc;
		rc_corner(new_rc, waypoint_out, oc);
		
		if (!pp_point_in_bounds(waypoint_out->x, waypoint_out->y)) {
		    retval = PPC_BLOCKED;
		}
	    }
	}
    }
    
    mtp_polar(actual,
	      (retval == PPC_WAYPOINT) ? waypoint_out : goal,
	      &distance,
	      &theta);
    if (distance > MAX_DISTANCE) {
	mtp_cartesian(actual, MAX_DISTANCE, theta, waypoint_out);
	
	retval = PPC_WAYPOINT;
    }

    return retval;
}
