/*
 * EMULAB-COPYRIGHT
 * Copyright (c) 2005 University of Utah and the Flux Group.
 * All rights reserved.
 */


#ifndef _rmcd_posture_controller_h
#define _rmcd_posture_controller_h

/**
 * @file posController.h
 *
 * Header file for the posture stabilizing controllers. There are two
 * posture regulators, denoted as A and B.
 */

#include "mtp.h"
#include "masterController.h"


#define STATE_TOL 0.015f
#define STATE_ATOL 0.1f

#define STATE_DIST_FAR 2.0f
#define STATE_ANGLE_BIG M_PI_4

#define STATE_WAYPOINT_TOL 0.19f
#define STATE_WAYPOINT_ATOL 0.25f

#define BASS_ACKWARDS_DIST 0.5f

// use the 'B' posture regulator
// #define USE_POSTREG_B


/**
 * Get state data from positions and localization data
 *
 * @param mc Big damn master controller data struct
 * @param robotcp Robot states (e, theta, alpha)
 * @param goalpos Ultimate goal posture
 * @param lastpos Last position
 * @param robotpos Current robot position
 */
void mc_nlctr_getstates(struct master_controller *mc,
			struct robot_position_states *robotcp,
			struct robot_position *goalpos,
			struct robot_position *lastpos,
			struct robot_position *robotpos);


/**
 * Nonlinear controller -- posture regulator
 *
 * @param mc Master controller data structure
 * @param Vl Left wheel velocity
 * @param Vr Right wheel velocity
 * @param robotcp Current states (e, theta, alpha)
 */
void mc_nlctr_controller(struct master_controller *mc,
                         float *Vl,
                         float *Vr,
                         struct robot_position_states *robotcp);


#endif
