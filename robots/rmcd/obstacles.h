
#ifndef _obstacles_h
#define _obstacles_h

#include "mtp.h"
#include "rclip.h"

#define OBSTACLE_BUFFER 0.25f

#define DYNAMIC_OBSTACLE_SIZE 0.10f

struct obstacle_config *ob_find_obstacle(struct mtp_config_rmc *mcr,
					 rc_line_t line);

struct obstacle_config *ob_make_obstacle(struct obstacle_config *oc_out,
					 struct robot_position *actual,
					 struct contact_point *cp_local);

void ob_merge_obstacles(struct obstacle_config *dst,
			struct obstacle_config *src);

#endif
