
#ifndef _rmcd_master_controller_h
#define _rmcd_master_controller_h

#include "mtp.h"

struct pilot_connection;

enum {
    MCB_HAS_WAYPOINT,
    MCB_HAS_OBSTACLE,
    MCB_CONTACT,
};

enum {
    MCF_HAS_WAYPOINT = (1L << MCB_HAS_WAYPOINT),
    MCF_HAS_OBSTACLE = (1L << MCB_HAS_OBSTACLE),
    MCF_CONTACT = (1L << MCB_CONTACT),
};

struct master_controller {
    struct pilot_connection *mc_pilot;
    unsigned long mc_flags;
    unsigned long mc_pause_time;
    struct robot_position mc_actual_pos;
    struct robot_position mc_last_pos;
    struct robot_position mc_waypoint;
    int mc_tries_remaining;
    struct robot_position mc_goal_pos;
    struct obstacle_config mc_obstacle;
    unsigned int mc_waypoint_tries;
    struct timeval mc_waypoint_timestamp;
};

#define DEFAULT_PAUSE_TIME 10

int mc_handle_pilot_packet(struct master_controller *mc, mtp_packet_t *mp);
int mc_handle_emc_packet(struct master_controller *mc, mtp_packet_t *mp);
int mc_handle_switch(struct master_controller *mc);
int mc_handle_tick(struct master_controller *mc);

#endif
