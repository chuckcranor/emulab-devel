
#ifndef _pilot_connection_h
#define _pilot_connection_h

#include <sys/types.h>
#include <sys/time.h>
#include <unistd.h>

#include "mtp.h"
#include "slaveController.h"
#include "masterController.h"

enum {
    UNUSED_COMMAND_ID,

    MASTER_COMMAND_ID,
    SLAVE_COMMAND_ID,
};

typedef enum {
    PCM_MASTER,
    PCM_SLAVE,
} pilot_control_mode_t;

enum {
    PCB_CONNECTING,
    PCB_CONNECTED,
};

enum {
    PCF_CONNECTING = (1L << PCB_CONNECTING),
    PCF_CONNECTED = (1L << PCB_CONNECTED),
};

struct pilot_connection {
    struct robot_config *pc_robot;
    mtp_handle_t pc_handle;
    unsigned long pc_flags;
    pilot_control_mode_t pc_control_mode;
    struct slave_controller pc_slave;
    struct master_controller pc_master;
};

struct pilot_connection *pc_add_robot(struct robot_config *rc);

void pc_dump_info(void);

struct pilot_connection *pc_find_pilot(int robot_id);

void pc_handle_emc_packet(struct pilot_connection *pc, mtp_packet_t *mp);
void pc_handle_pilot_packet(struct pilot_connection *pc, mtp_packet_t *mp);
void pc_handle_signal(fd_set *rready, fd_set *wready);
void pc_handle_timeout(struct timeval *current_time);

/**
 * How close does the robot have to be before it is considered at the intended
 * position.  Measurement is in meters(?).
 */
// #define METER_TOLERANCE 0.025

#define WAYPOINT_TOLERANCE 0.25

/**
 * How close does the angle have to be before it is considered at the intended
 * angle.
 */
// #define RADIAN_TOLERANCE 0.09

/**
 * Maximum number of times to try and refine the position before giving up.
 */
// #define MAX_REFINE_RETRIES 4

#define MAX_PILOT_CONNECTIONS 128

#define PILOT_SERVERPORT 2531

struct pilot_connection_data {
    struct pilot_connection pcd_connections[MAX_PILOT_CONNECTIONS];
    unsigned int pcd_connection_count;
    struct mtp_config_rmc *pcd_config;
    mtp_handle_t pcd_emc_handle;
    
    unsigned int pcd_max_refine_retries;
    
    float pcd_meter_tolerance;
    float pcd_radian_tolerance; 
    
    float pcd_max_distance;
};

extern struct pilot_connection_data pc_data;

#endif
