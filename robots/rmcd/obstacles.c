
#include "config.h"

#include <math.h>
#include <stdio.h>
#include <assert.h>

#include "rclip.h"
#include "obstacles.h"

#define min(x, y) ((x) < (y)) ? (x) : (y)
#define max(x, y) ((x) > (y)) ? (x) : (y)

struct obstacle_config *ob_find_obstacle(struct mtp_config_rmc *mcr,
					 rc_line_t line)
{
    struct obstacle_config *retval = NULL;
    int lpc;

    assert(mcr != NULL);
    
    for (lpc = 0; lpc < mcr->obstacles.obstacles_len; lpc++) {
	struct rc_line line_cp = *line;
	struct obstacle_config *oc;
	
	oc = &mcr->obstacles.obstacles_val[lpc];
	printf(" %f %f -> %f %f  --  %f %f %f %f\n",
	       line->x0, line->y0,
	       line->x1, line->y1,
	       oc->xmin, oc->ymin,
	       oc->xmax, oc->ymax);
	if (rc_clip_line(&line_cp, oc)) {
	    retval = oc;
	    break;
	}
    }

    return retval;
}

struct obstacle_config *ob_make_obstacle(struct obstacle_config *oc_out,
					 struct robot_position *actual,
					 struct contact_point *cp_local)
{
    struct contact_point cp_world;
    float local_bearing;
    
    assert(oc_out != NULL);
    assert(actual != NULL);
    assert(cp_local != NULL);
    
    local_bearing = atan2f(cp_local->y, cp_local->x);
    
    oc_out->id = -1000; // XXX

    switch (mtp_compass(local_bearing)) {
    case MCF_EAST:
    case MCF_NORTH|MCF_EAST:
    case MCF_SOUTH|MCF_EAST:
	cp_local->x = 0.15;
	cp_local->y = 0.0;
	break;

    case MCF_NORTH:
	cp_local->y = 0.15;
	break;
    case MCF_SOUTH:
	cp_local->y = 0.15;
	break;
	
    case MCF_WEST:
    case MCF_NORTH|MCF_WEST:
    case MCF_SOUTH|MCF_WEST:
	cp_local->x = -0.15;
	cp_local->y = 0.0;
	break;

    default:
	assert(0);
	break;
    }
    
    REL2ABS(&cp_world, actual->theta, cp_local, actual);
    
    oc_out->xmin = cp_world.x - OBSTACLE_BUFFER - DYNAMIC_OBSTACLE_SIZE;
    oc_out->xmax = cp_world.x + OBSTACLE_BUFFER + DYNAMIC_OBSTACLE_SIZE;
    oc_out->ymin = cp_world.y - OBSTACLE_BUFFER - DYNAMIC_OBSTACLE_SIZE;
    oc_out->ymax = cp_world.y + OBSTACLE_BUFFER + DYNAMIC_OBSTACLE_SIZE;

    return oc_out;
}

void ob_merge_obstacles(struct obstacle_config *dst,
			struct obstacle_config *src)
{
    assert(dst != NULL);
    assert(src != NULL);
    
    dst->xmin = min(src->xmin, dst->xmin);
    dst->ymin = min(src->ymin, dst->ymin);
    dst->xmax = max(src->xmax, dst->xmax);
    dst->ymax = max(src->ymax, dst->ymax);
}
