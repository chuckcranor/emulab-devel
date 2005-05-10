/*
 * EMULAB-COPYRIGHT
 * Copyright (c) 2005 University of Utah and the Flux Group.
 * All rights reserved.
 */

#ifndef _obstacles_h
#define _obstacles_h

/**
 * @file obstacles.h
 *
 * Static and dynamic obstacle management.
 */

#include "mtp.h"
#include "rclip.h"
#include "listNode.h"

/**
 * The size of the buffer zone around the obstacles, in meters.
 *
 * XXX This is for the garcia's only.  Other robots will require different
 * buffer sizes.
 */
#define OBSTACLE_BUFFER 0.25f

/**
 * Our guesstimate of the size of an obstacle detected by the robot's sensors.
 * The object is assumed to be square, so the number is the length in meters
 * for one side.
 */
#define DYNAMIC_OBSTACLE_SIZE 0.10f

/**
 * The number of seconds to wait before removing a dynamically created obstacle
 * or restoring an expanded obstacle to its natural size.
 */
#define OB_DECAY_START 30

/**
 * 
 */
struct obstacle_node {
    struct lnMinNode on_link;		/*< Link list node. */
    int on_decay_seconds;		/*< Time until reduction/removal. */
    struct obstacle_config on_natural;	/*< Natural size of the obstacle. */
    struct obstacle_config on_expanded;	/*< Natural size + buffer + other. */
};

/**
 * Initialize the obstacle list.
 */
void ob_init(void);

/**
 * Dump the current obstacle list to stderr.
 */
void ob_dump_info(void);

/**
 * Add an obstacle to the list.
 *
 * @param oc An initialized obstacle_config specification.
 * @return The obstacle_node created to track the given obstacle.
 */
struct obstacle_node *ob_add_obstacle(struct obstacle_config *oc);

/**
 * Find an obstacle that intersects the given line.
 *
 * @param rl_inout An initialized line object.
 * @return The first obstacle found to intersect the given line or NULL if none
 * could be found.
 */
struct obstacle_node *ob_find_intersect(rc_line_t rl_inout);

/**
 * @param actual
 * @param goal
 * @param distance_out
 * @param cross_out
 */
struct obstacle_node *ob_find_intersect2(struct robot_position *actual,
					 struct robot_position *goal,
					 float *distance_out,
					 float *cross_out);

/**
 * Find an existing obstacle that overlaps with the given one.
 *
 * @param oc An initialized obstacle_config.
 * @return The first obstacle_node found to intersect the given obstacle.
 */
struct obstacle_node *ob_find_overlap(struct obstacle_config *oc);

void ob_obstacle_location(struct contact_point *dst,
			  struct robot_position *actual,
			  struct contact_point *cp_local);

/**
 * Construct a dynamic obstacle that was detected by a robot.  If the robot
 * detects an obstacle that overlaps with an existing obstacle, it preexisting
 * one will be expanded.  Otherwise, a new obstacle is created and added to the
 * list.  After a short period of time, the obstacle list will be restored on
 * the assumption that the new obstacle was transient.
 *
 * @param actual The current position of the robot that detected the obstacle.
 * @param cp_local The approximate distance of the detected obstacle from the
 * robot.  The values should be in robot local coordinates, for example a
 * contact point of (0.1,0.0) would be ten centimeters in front of the head of
 * robot.
 * @return A new or existing obstacle_node that encompasses the newly detected
 * obstacle.
 */
struct obstacle_node *ob_found_obstacle(struct robot_position *actual,
					struct contact_point *cp_world);

/**
 * 
 */
void ob_merge_obstacles(struct obstacle_config *dst,
			struct obstacle_config *src);

/**
 * 
 */
void ob_expand_obstacle(struct obstacle_config *dst, 
			struct obstacle_config *src,
			float amount);

/**
 * 
 */
void ob_tick(void);

struct obstacle_data {
    struct lnMinList od_active;
    struct lnMinList od_free_list;
};

extern struct obstacle_data ob_data;

#endif
