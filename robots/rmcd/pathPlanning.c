
#include "config.h"

#include <math.h>
#include <assert.h>

#include "rclip.h"
#include "pilotConnection.h"
#include "pathPlanning.h"

#define PP_TOL 0.1

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
            /* can not get to final point */
            printf("pp_plot_waypoint: goal is in obstacle.\n");
	    retval = PPC_GOAL_IN_OBSTACLE;
	}
	else if ((rc_clip_line(&rl, oc) == 0) ||
		 (hypotf(rl.x0 - rl.x1, rl.y0 - rl.y1) < 0.20)) {
            /* no intersection */
            printf("pp_plot_waypoint: no intersection detected.\n");
	    retval = PPC_NO_WAYPOINT;
	}
	else {
            /* intersection detected */
   	    /* assign a new waypoint */
            printf("pp_plot_waypoint: intersection detected.\n");

	    /* int new_rc = 0, alt_rc = 0; */


/* compass heading stuff */
/*
	    float bearing;
	    int compass;



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
*/

/* corner point stuff */
/*
	    rc_corner(new_rc, waypoint_out, oc);

	    if (!pp_point_in_bounds(waypoint_out->x, waypoint_out->y)) {
		new_rc = alt_rc;
		rc_corner(new_rc, waypoint_out, oc);

		if (!pp_point_in_bounds(waypoint_out->x, waypoint_out->y)) {
		    retval = PPC_BLOCKED;
		}
	    }
*/

            if (1 == pp_next_cornerpoint(actual, oc, goal, waypoint_out)) {
              /* corner point assigned */
              printf("pp_plot_waypoint: new waypoint assigned.\n");
              retval = PPC_WAYPOINT;
            }
            else {
              /* ERROR */
              retval = PPC_BLOCKED;
              printf("pp_plot_waypoint: error assigning waypoint.\n");
            }
	} /* intersection detected */




    }

    /* restrict final waypoint to MAX_DISTANCE */
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



pp_point_type_t pp_point_identify(struct robot_position *rpoint,
                                  struct obstacle_config *oc) {
  /* determine the point type of rpoint */

  pp_point_type_t retval;
  robot_position this_cp;

  retval = PPT_DETACHED;


  /* is this a corner point? Check each corner of this obstacle */
  this_cp.x = oc->xmin;
  this_cp.y = oc->ymin;
  this_cp.theta = 0;

  if (PP_TOL > pp_point_distance(rpoint, &this_cp)) {
    retval = PPT_CORNERPOINT;
  }

  this_cp.y = oc->ymax;
  if (PP_TOL > pp_point_distance(rpoint, &this_cp)) {
    retval = PPT_CORNERPOINT;
  }

  this_cp.x = oc->xmax;
  if (PP_TOL > pp_point_distance(rpoint, &this_cp)) {
    retval = PPT_CORNERPOINT;
  }

  this_cp.y = oc->ymin;
  if (PP_TOL > pp_point_distance(rpoint, &this_cp)) {
    retval = PPT_CORNERPOINT;
  }



  /* is this point in bounds? */
  if (!(pp_point_in_bounds(rpoint->x, rpoint->y))) {
    retval = PPT_OUTOFBOUNDS;
    printf("pp_point_identify says this point is out of bounds\n");
  }


  /* debugging output */
  if (PPT_CORNERPOINT == retval) {
    printf("pp_point_identify says this point is a corner point\n");
  }


  return retval;

}



int pp_next_cornerpoint(struct robot_position *actual,
                        struct obstacle_config *oc,
                        struct robot_position *goal,
                        struct robot_position *cp_out)
{


  int retval = 0;

  float bl_dist, br_dist, tl_dist, tr_dist;
  float bl_distg, br_distg, tl_distg, tr_distg;
  float min_dist;

  robot_position this_cp;


  /* determine the distnace to each corner point from the IP and FP */
  this_cp.x = oc->xmin;
  this_cp.y = oc->ymin;
  bl_dist = pp_point_distance(actual, &this_cp);
  bl_distg = pp_point_distance(goal, &this_cp);

  this_cp.y = oc->ymax;
  tl_dist = pp_point_distance(actual, &this_cp);
  tl_distg = pp_point_distance(goal, &this_cp);

  this_cp.x = oc->xmax;
  tr_dist = pp_point_distance(actual, &this_cp);
  tr_distg = pp_point_distance(goal, &this_cp);

  this_cp.y = oc->ymin;
  br_dist = pp_point_distance(actual, &this_cp);
  br_distg = pp_point_distance(goal, &this_cp);



  if (PPT_CORNERPOINT == pp_point_identify(actual, oc)) {
    /* actual point is already a corner point */
    /* proceed to the next CP nearest the FP */

    if (PP_TOL > bl_dist || PP_TOL > tr_dist) {
      /* This is the bottom left or top right corner point */
      /* the next corner point is BR or TL, find the closest */

      if (br_distg < tl_distg) {
        /* bottom right is closer, go there */
        cp_out->x = oc->xmax;
        cp_out->y = oc->ymin;
        retval = 1;
      }
      else {
        /* top left is closer, OR EQUAL, go there */
        cp_out->x = oc->xmin;
        cp_out->y = oc->ymax;
        retval = 1;
      }
    }
    else {
      /* This is the top left or bottom right corner point */
      /* the next corner point is BL or TR, find the closest */

      if (bl_distg < tr_distg) {
        /* bottom left is closer, go there */
        cp_out->x = oc->xmin;
        cp_out->y = oc->ymin;
        retval = 1;
      }
      else {
        /* top right is closer, OR EQUAL, go there */
        cp_out->x = oc->xmax;
        cp_out->y = oc->ymax;
        retval = 1;
      }

    }

  }

  if (PPT_DETACHED == pp_point_identify(actual, oc)) {
    /* actual point is detached from obstacle boundary */
    /* proceed to the CP nearest the IP */

    min_dist = bl_dist;
    cp_out->x = oc->xmin;
    cp_out->y = oc->ymin;

    if (br_dist < min_dist) {
      min_dist = br_dist;
      cp_out->x = oc->xmax;
      cp_out->y = oc->ymin;
    }

    if (tl_dist < min_dist) {
      min_dist = tl_dist;
      cp_out->x = oc->xmin;
      cp_out->y = oc->ymax;
    }

    if (tr_dist < min_dist) {
      min_dist = tr_dist;
      cp_out->x = oc->xmax;
      cp_out->y = oc->ymax;
    }

    retval = 1;
  }


  return retval;

}



float pp_point_distance(struct robot_position *pt1,
			struct robot_position *pt2) {
  /* simple radial distance between two points */
  return (hypotf(pt1->x - pt2->x, pt1->y - pt2->y));
}
