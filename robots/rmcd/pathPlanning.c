
#include "config.h"

#include <math.h>
#include <assert.h>

#include "rclip.h"
#include "pilotConnection.h"
#include "pathPlanning.h"

#define PP_TOL 0.1


static int pp_point_in_bounds(float x, float y)
{
    int lpc, occ = 0, oc_length, boxes_len, retval = 0;
    struct box *boxes;
    struct obstacle_config *oc_list;

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
    
    oc_list = pc_data.pcd_config->obstacles.obstacles_val;
    oc_length = pc_data.pcd_config->obstacles.obstacles_len;
    
    if (1 == retval) {
      for (occ = 0; occ < oc_length; occ++) {
        if (x > oc_list[occ].xmin && y > oc_list[occ].ymin &&
            x < oc_list[occ].xmax && y < oc_list[occ].ymax) {
          retval = 0;
          break;
        }
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
				struct robot_position *goal,
				struct robot_position *waypoint_out)
{
    float distance, theta;
    pp_plot_code_t retval;


    /* refer to masterController.c, line 290 */
    /* in ob_find_obstacle.c */

    /* pc_data.pcd_config->obstacles.obstacles_len */
    /* pc_data.pcd_config->obstacles.obstacles_val[] */
    
    int incr_o, oc_length;
    float cp_dist;
    float cp_mindist;
    
    struct robot_position waypoint_temp;   
    struct obstacle_config *oc;
    
    struct rc_line rl;
    rc_code_t rc;
    
    
    assert(actual != NULL);
    assert(goal != NULL);
    assert(waypoint_out != NULL);

    retval = PPC_NO_WAYPOINT; /* if nothing else */
    
    /* set waypoints */
    *waypoint_out = *goal;
    waypoint_temp = *goal;
    
    cp_dist = 0.0f;
    cp_mindist = pp_point_distance(actual, goal);
   
    
    oc = pc_data.pcd_config->obstacles.obstacles_val;
    oc_length = pc_data.pcd_config->obstacles.obstacles_len;
    
    printf("pp_plot_waypoint: sending robot to %f, %f\n", waypoint_temp.x, waypoint_temp.y);
    printf("pp_plot_waypoint: currently at %f, %f\n", actual->x, actual->y);
    
    if (oc_length > 0) {
      /* hellish nightmare (obstacles exist!) */
      printf("pp_plot_waypoint: checking obstacles\n");
      
      /* go through every obstacle in the list */
      for (incr_o = 0; incr_o < oc_length; incr_o++) {

	rl.x0 = actual->x;
	rl.y0 = actual->y;
	rl.x1 = goal->x;
	rl.y1 = goal->y;

 

        
	rc = rc_compute_closest(&rl.x0, &rl.y0, &oc[incr_o]);
	if (rc_compute_code(goal->x, goal->y, &oc[incr_o]) == 0) {
            /* can not get to final point */
            printf("pp_plot_waypoint: goal is inside this obstacle! [%d]\n", incr_o);
            printf("Obstacle at: %f/%f, %f/%f\n", oc->xmin, oc->ymin, oc->xmax, oc->ymax);
	    /* retval = PPC_GOAL_IN_OBSTACLE; */
            /* don't give up here */
	}
 
 	
	if ((rc_clip_line(&rl, &oc[incr_o]) == 0) ||
		 (hypotf(rl.x0 - rl.x1, rl.y0 - rl.y1) < 0.20)) {
            /* no intersection -- DO NOTHING */
//             printf("pp_plot_waypoint: no intersection detected for this obstacle. [%d]\n", incr_o);
	}
	else {
          /* intersection detected -- assign a new waypoint */
//           printf("pp_plot_waypoint: intersection detected.\n");
          printf("pp_plot_waypoint: intersection detected for this obstacle. [%d]\n", incr_o);
          printf("Obstacle at: %f/%f, %f/%f\n", oc->xmin, oc->ymin, oc->xmax, oc->ymax);
          

          
#if 0
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
		    new_rc = RCF_TOP|RCF_LEdata.pcd_configFT;
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

#endif
          
          /* get next corner point */
	  if (0 == pp_next_cornerpoint(actual, &oc[incr_o], goal, &waypoint_temp)) {
            /* blocked -- GIVE UP */
            printf("pp_plot_waypoint: ERROR: failed to find next corner point!\n");
            return PPC_BLOCKED;
          }
	} /* intersection detected */

 	cp_dist = pp_point_distance(actual, &waypoint_temp);
 

 	printf("pp_plot_waypoint: this waypoint [%d] distance: %f\n", incr_o, cp_dist);
  	printf("pp_plot_waypoint: ** current minimum waypoint distance: %f\n", cp_mindist);
  
  
        if (cp_dist < cp_mindist) {
          /* choose the closest waypoint to the actual [current] position */
          printf("pp_plot_waypoint: new waypoint set. [%d]\n", incr_o);
          *waypoint_out = waypoint_temp;
          cp_mindist = pp_point_distance(actual, waypoint_out);
          retval = PPC_WAYPOINT;
        }
 
  
  
    } /* obstacle list iteration */
 } /* obstacles exist */
 
 

 
   
 
 
 
 
 /* restrict final waypoint to MAX_DISTANCE */
 mtp_polar(actual,
           (retval == PPC_WAYPOINT) ? waypoint_out : goal,
           &distance,
           &theta);
 if (distance > pc_data.pcd_max_distance) {
   mtp_cartesian(actual, pc_data.pcd_max_distance, theta, waypoint_out);
   retval = PPC_WAYPOINT;
 }

 
 if (PPC_WAYPOINT == retval) {
   printf("pp_plot_waypoint finished: WAYPOINT SET\n");
 }
 
 if (PPC_NO_WAYPOINT == retval) {
   printf("pp_plot_waypoint finished: NO WAYPOINT\n");
 }
 
 if (PPC_BLOCKED == retval) {
   printf("pp_plot_waypoint finished: *** BLOCKED ***\n");
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
  if (!(pp_point_in_bounds(rpoint->x, rpoint->y)) && PPT_CORNERPOINT != retval) {
    /* if this is already determined to be a corner point, ignore
     * out-of-bounds identification for now */
    retval = PPT_OUTOFBOUNDS;
    printf("pp_point_identify: %f, %f is out of bounds\n", rpoint->x, rpoint->y);
  }


  /* debugging output */
  if (PPT_CORNERPOINT == retval) {
    printf("pp_point_identify: %f, %f is a corner point\n", rpoint->x, rpoint->y);
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
  float min_dist = 0;

  robot_position cp_bl; /* bottom left corner point */
  robot_position cp_tl; /* top left corner point */
  robot_position cp_br; /* bottom right corner point */
  robot_position cp_tr; /* top right corner point */

  /* corner points of this obstacle */
  /* SWAP ymin/ymax because of y coord system is AFU */
  cp_bl.x = oc->xmin;
  cp_bl.y = oc->ymax;
  
  cp_tl.x = oc->xmin;
  cp_tl.y = oc->ymin;
  
  cp_br.x = oc->xmax;
  cp_br.y = oc->ymax;
  
  cp_tr.x = oc->xmax;
  cp_tr.y = oc->ymin;
  
  /* get the distances to each CP from the IP, and FP */
  bl_dist = pp_point_distance(actual, &cp_bl);
  bl_distg = pp_point_distance(goal, &cp_bl);

  tl_dist = pp_point_distance(actual, &cp_tl);
  tl_distg = pp_point_distance(goal, &cp_tl);

  br_dist = pp_point_distance(actual, &cp_br);
  br_distg = pp_point_distance(goal, &cp_br);
  
  tr_dist = pp_point_distance(actual, &cp_tr);
  tr_distg = pp_point_distance(goal, &cp_tr);




  if (PPT_CORNERPOINT == pp_point_identify(actual, oc)) {
    /* actual point is already a corner point */
    /* proceed to the next CP nearest the FP */

    if (PP_TOL > bl_dist || PP_TOL > tr_dist) {
      /* This is the bottom left or top right corner point */
      /* the next corner point is BR or TL, find the closest */

      printf("pp_next_corner_point: currently at bottom-left or top-right, going to next corner point.\n");
      
      if (!pp_point_in_bounds(cp_br.x, cp_br.y) &&
          !pp_point_in_bounds(cp_tl.x, cp_tl.y)) {
        /* neither CP is in bounds -- CAN'T GO ANYWHERE */
        printf("pp_next_corner_point: No corner points are in bounds\n");
      }
      
      if (pp_point_in_bounds(cp_br.x, cp_br.y) &&
          !pp_point_in_bounds(cp_tl.x, cp_tl.y)) {
        /* bottom right CP is in bounds, but top left is not */
        cp_out = &cp_br; /* must go to bottom right */
        printf("pp_next_corner_point: must go to bottom right\n");
        retval = 1;
      }
      
      if (!pp_point_in_bounds(cp_br.x, cp_br.y) &&
          pp_point_in_bounds(cp_tl.x, cp_tl.y)) {
        /* top left CP is in bounds, but bottom right is not */
        cp_out = &cp_tl; /* must go to top left */
        printf("pp_next_corner_point: must go to top left\n");
        retval = 1;
      }
      
      if (pp_point_in_bounds(cp_br.x, cp_br.y) &&
          pp_point_in_bounds(cp_tl.x, cp_tl.y)) {
        /* both CPs are in bounds
         * go to the closest CP to the FP
         */
        
        if (br_distg < tl_distg) {
          /* bottom right is closer */
          cp_out = &cp_br;
          printf("pp_next_corner_point: going to bottom right\n");
          retval = 1;
        }
        else {
          /* top left is closer, or EQUAL */
          cp_out = &cp_tl;
          printf("pp_next_corner_point: going to top left\n");
          retval = 1;
        }
      }  
    }
    else {
      /* This is the top left or bottom right corner point */
      /* the next corner point is BL or TR, find the closest */

      printf("pp_next_corner_point: currently at top left or bottom right, going to next corner point.\n");
      
      if (!pp_point_in_bounds(cp_bl.x, cp_bl.y) &&
          !pp_point_in_bounds(cp_tr.x, cp_tr.y)) {
        /* neither CP is in bounds -- CAN'T GO ANYWHERE */
        printf("pp_next_corner_point: No corner points are in bounds\n");
      }
      
      if (pp_point_in_bounds(cp_bl.x, cp_bl.y) &&
          !pp_point_in_bounds(cp_tr.x, cp_tr.y)) {
        /* bottom left CP is in bounds, but top right is not */
        cp_out = &cp_bl; /* must go to bottom left */
        printf("pp_next_corner_point: must go to bottom left\n");
        retval = 1;
      }
      
      if (!pp_point_in_bounds(cp_bl.x, cp_bl.y) &&
          pp_point_in_bounds(cp_tr.x, cp_tr.y)) {
        /* top right CP is in bounds, but bottom left is not */
        cp_out = &cp_tr; /* must go to top right */
        printf("pp_next_corner_point: must go to top right\n");
        retval = 1;
      }
      
      if (pp_point_in_bounds(cp_bl.x, cp_bl.y) &&
          pp_point_in_bounds(cp_tr.x, cp_tr.y)) {
        /* both CPs are in bounds
         * go to the closest CP to the FP
         */
        
        if (bl_distg < tr_distg) {
          /* bottom left is closer */
          cp_out = &cp_bl;
          printf("pp_next_corner_point: going to bottom left\n");
          retval = 1;
        }
        else {
          /* top right is closer, or EQUAL */
          cp_out = &cp_tr;
          printf("pp_next_corner_point: going to top right\n");
          retval = 1;
        }
      }
    }

  }

  if (PPT_DETACHED == pp_point_identify(actual, oc)) {
    /* actual point is detached from obstacle boundary */
    /* proceed to the CP nearest the IP */
    /* CHANGE HERE TO ADD OPTIMIZATION */
    
    printf("pp_next_corner_point: not current at a corner point, going to nearest corner point in bounds.\n");
    
    if (pp_point_in_bounds(cp_bl.x, cp_bl.y)) {
      min_dist = bl_dist;
      cp_out = &cp_bl;
      retval = 1;
    } else if (pp_point_in_bounds(cp_br.x, cp_br.y)) {
      min_dist = br_dist;
      cp_out = &cp_br;
      retval = 1;
    } else if (pp_point_in_bounds(cp_tl.x, cp_tl.y)) {
      min_dist = tl_dist;
      cp_out = &cp_tl;
      retval = 1;
    } else if (pp_point_in_bounds(cp_tr.x, cp_tr.y)) {
      min_dist = tr_dist;
      cp_out = &cp_tr;
      retval = 1;
    } else {
      /* no corner points are in bounds!! */
      printf("pp_next_corner_point: All corner points for this obstacle are out of bounds!\n");
    }
    
    /* find the minimum
     * (don't need to look at bottom left
     */
    
    if (br_dist < min_dist && pp_point_in_bounds(cp_br.x, cp_br.y)) {
      min_dist = br_dist;
      cp_out = &cp_br;
    }
    
    if (tl_dist < min_dist && pp_point_in_bounds(cp_tl.x, cp_tl.y)) {
      min_dist = tl_dist;
      cp_out = &cp_tl;
    }
    
    if (tr_dist < min_dist && pp_point_in_bounds(cp_tr.x, cp_tr.y)) {
      min_dist = tr_dist;
      cp_out = &cp_tr;
    }
  }


  


  return retval;

}



float pp_point_distance(struct robot_position *pt1,
			struct robot_position *pt2) {
  /* simple radial distance between two points */
  return (hypotf(pt1->x - pt2->x, pt1->y - pt2->y));
}
