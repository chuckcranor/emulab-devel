
#ifndef _rmcd_path_planning_h
#define _rmcd_path_planning_h

#include "mtp.h"

#define MAX_DISTANCE 1.5f

typedef enum {
    PPC_NO_WAYPOINT,
    PPC_WAYPOINT,
    PPC_BLOCKED,
    PPC_GOAL_IN_OBSTACLE,
} pp_plot_code_t;

pp_plot_code_t pp_plot_waypoint(struct robot_position *actual,
				struct obstacle_config *oc,
				struct robot_position *goal,
				struct robot_position *waypoint_out);

#endif
