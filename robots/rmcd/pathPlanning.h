
#ifndef _rmcd_path_planning_h
#define _rmcd_path_planning_h

#include "mtp.h"

// #define MAX_DISTANCE 1.5f
// Now defined in pc_data, by argument in rmcd.c

typedef enum {
    PPC_NO_WAYPOINT,
    PPC_WAYPOINT,
    PPC_BLOCKED,
    PPC_GOAL_IN_OBSTACLE,
} pp_plot_code_t;

typedef enum {
    PPT_BOUNDARYPOINT,
    PPT_CORNERPOINT,
    PPT_NEXTPOINT,
    PPT_DETACHED,
    PPT_OUTOFBOUNDS,
} pp_point_type_t;

pp_plot_code_t pp_plot_waypoint(struct robot_position *actual,
				struct robot_position *goal,
				struct robot_position *waypoint_out);

pp_point_type_t pp_point_identify(struct robot_position *rpoint,
                                  struct obstacle_config *oc);
                                  


int pp_next_cornerpoint(struct robot_position *actual,
                        struct obstacle_config *oc,
                        struct robot_position *goal,
                        struct robot_position *cp_out);
                        
float pp_point_distance(struct robot_position *pt1,
			struct robot_position *pt2);
#endif
