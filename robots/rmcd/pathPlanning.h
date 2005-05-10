/*
 * EMULAB-COPYRIGHT
 * Copyright (c) 2005 University of Utah and the Flux Group.
 * All rights reserved.
 */

#ifndef _rmcd_path_planning_h
#define _rmcd_path_planning_h

/**
 * @file pathPlanning.h
 *
 * 
 */

#include "listNode.h"
#include "mtp.h"

/**
 * Return codes for pp_plot_waypoint.
 */
typedef enum {
    PPC_NO_WAYPOINT,		/*< No obstructions, clear to move. */
    PPC_WAYPOINT,		/*< Path obstructed, need to move around. */
    PPC_BLOCKED,		/*< Path completely blocked, try later. */
    PPC_GOAL_IN_OBSTACLE,	/*< Goal is inside an obstacle. */
} pp_plot_code_t;

/**
 * 
 */
typedef enum {
    PPT_CORNERPOINT,
    PPT_DETACHED,
    PPT_OUTOFBOUNDS,
} pp_point_type_t;

enum {
    PPB_HAS_OBSTACLE,
};

enum {
    PPF_HAS_OBSTACLE = (1L << PPB_HAS_OBSTACLE),
};

/**
 *
 */
struct path_plan {
    struct lnMinNode pp_link;
    unsigned long pp_flags;
    struct robot_config *pp_robot;
    struct robot_position pp_last_pos;
    struct robot_position pp_actual_pos;
    struct robot_position pp_waypoint;
    struct robot_position pp_goal_pos;
    struct obstacle_config pp_obstacle;
    float pp_speed;
};

/**
 * Plot a path for 
 *
 * @param pp 
 * @return 
 */
pp_plot_code_t pp_plot_waypoint(struct path_plan *pp);

struct path_planning_data {
    /**
     * Array of bounds for the array.
     */
    struct box *ppd_bounds;

    /**
     * The length of the ppd_bounds array.
     */
    unsigned int ppd_bounds_len;
    
    /**
     * The maximum distance allowed for a line segment.  XXX This is a hack to
     * keep the robot from going too far off course because of a bad angle from
     * vision and such.
     */
    float ppd_max_distance;
};

extern struct path_planning_data pp_data;

#endif
