/*
 * EMULAB-COPYRIGHT
 * Copyright (c) 2005 University of Utah and the Flux Group.
 * All rights reserved.
 */

/**
 * @file posController.c
 *
 */

#include "config.h"

#include <math.h>
#include <stdio.h>
#include <stdarg.h>
#include <assert.h>

#include "rmcd.h"
#include "masterController.h"
#include "posController.h"


#define USE_POSTREG_B
#define K_radius 0.0889f


struct master_controller_data mc_data;
extern FILE *slogfilep;


void mc_nlctr_getstates(struct master_controller *mc,
			struct robot_position_states *robotcp,
                        struct robot_position *goalpos,
			struct robot_position *lastpos,
                        struct robot_position *robotpos) {
    /* calculate robot polar position states from current and goal positions
   * The goal position is the origin, with the current position offset
   */

   /* SIMPLE METHOD:
    *
    * e = sqrt(x^2 + y^2)
    * theta = atan2(-y, -x)
    * (phi = orientation of robot in goal reference frame)
    * alpha = theta - phi
    */

    struct robot_position_states robotcp_out;
    float lr, ltheta0;
    float r, theta0;

    assert(mc != NULL);
    assert(robotcp != NULL);
    assert(goalpos != NULL);
    assert(lastpos != NULL);
    assert(robotpos != NULL);

    mtp_polar(lastpos, goalpos, &lr, &ltheta0);
    mtp_polar(robotpos, goalpos, &r, &theta0);

#ifdef USE_POSTREG_B

    robotcp_out.e = r;
    robotcp_out.theta = mtp_theta(theta0 - goalpos->theta);
    robotcp_out.alpha = mtp_theta(theta0 - robotpos->theta);
    robotcp_out.timestamp = robotpos->timestamp;
#endif

#ifndef USE_POSTREG_B
    /*
     * Check if we're:
     *   1. Close to the goal.
     *   2. Making some amount of progress compared to our last position.
     *   3. Really close...
     */
    if ((r < STATE_TOL) && ((fabsf(r - lr) > 0.005) || (r < 0.0075))) {
	/*
	 * Position is as close as its gonna get, switch to refining the
	 * orientation.
	 */
	robotcp_out.e = 0.0f;
	robotcp_out.theta = goalpos->theta - robotpos->theta;
	robotcp_out.alpha = 0.0f;
	robotcp_out.timestamp = robotpos->timestamp;
    }
    else {
	robotcp_out.e = r;
	robotcp_out.theta = mtp_theta(theta0  - goalpos->theta);
	robotcp_out.alpha = mtp_theta(theta0 - robotpos->theta);
	robotcp_out.timestamp = robotpos->timestamp;

	/*
	 * Check if it would be easier to move the robot backwards instead of
	 * pivoting to get it going forwards.
	 */
	if ((robotcp_out.e < BASS_ACKWARDS_DIST) &&
	    (fabsf(robotcp_out.alpha) > M_PI_4) ) {
	    if (robotcp_out.alpha >= 0.0)
		robotcp_out.alpha -= M_PI;
	    else
		robotcp_out.alpha += M_PI;
	    if (robotcp_out.theta >= 0.0)
		robotcp_out.theta -= M_PI;
	    else
		robotcp_out.theta += M_PI;
	    robotcp_out.e *= -1.0;
	}
    }
#endif

    *robotcp = robotcp_out;
}



#ifdef USE_POSTREG_B
void mc_nlctr_controller(struct master_controller *mc,
                         float *Vl,
                         float *Vr,
                         struct robot_position_states *robotcp)
{
    /* ONLY MOVES FORWARD */

    float C_u, C_omega; /* controller outputs */
    float T_alpha; /* temporary alpha as divide-by-zero guard */

    /* controller parameters: */
    float K_gamma = 0.8f; /* aggressiveness of forward velocity */
    float K_h = 0.8f;
    float K_beta = 1.0f; /* aggressiveness of rotational velocity */

    float u_max = mc->mc_plan.pp_speed; /* u saturation (maximum speed) */
    float omega_max = 2.5;

    assert(Vl != NULL);
    assert(Vr != NULL);
    assert(robotcp != NULL);

    T_alpha = robotcp->alpha;
    if (0 == robotcp->alpha) {
        T_alpha = 1;
    }


    /* controller: */
    /***************/

    /* Linear velocity: */
    C_u = u_max * tanh(K_gamma * robotcp->e);

    /* Rotational velocity: */
    C_omega = sin(robotcp->alpha) * (1.0 + K_h * robotcp->theta / T_alpha) +
        K_beta * robotcp->alpha;

    /* 'hard' saturation */
    if (C_omega > omega_max) {
        C_omega = omega_max;
    }
    if (C_omega < -omega_max) {
        C_omega = -omega_max;
    }

    /******************/
    /* end controller */


    /* wheel velocity translator: */
    *Vl = C_u - K_radius * C_omega;
    *Vr = C_u + K_radius * C_omega;
    /* end wheel velocity translator */

}
#endif

#ifndef USE_POSTREG_B
void mc_nlctr_controller(struct master_controller *mc,
                         float *Vl,
                         float *Vr,
                         struct robot_position_states *robotcp)
{

    float C_u, C_omega; /* controller outputs */

    /* controller parameters: */
    float K_gamma = 0.8f; /* aggressiveness of forward velocity */
    float K_h = 1.0f;
    float K_k = 1.0f; /* aggressiveness of rotational velocity */
    /* (IRT alpha and theta) */

    float u_max = mc->mc_plan.pp_speed; /* u saturation (maximum speed) */
    float omega_max = 2.5;
    // float omega_max = 26.25f; /* wheels @ 2 m/s */
    // float omega_max = 13.125f; /* wheels @ 1 m/s */


//     float reverse = 1.0;

    assert(Vl != NULL);
    assert(Vr != NULL);
    assert(robotcp != NULL);

    // info("in %f %f %f\n", robotcp->e, robotcp->alpha, robotcp->theta);
/* state 'e' only shows up in the linear velocity portion of the controller:
 * (so we don't need to negate it
 */

/*
    if (robotcp->e < 0.0) {
// 	 We're moving backwards...
	robotcp->e *= -1.0f;
	reverse = -1.0f;
    }*/

    /* controller: */
    /***************/

    /* Linear velocity: */
    C_u = u_max * tanh(K_gamma * cos(robotcp->alpha) * robotcp->e / u_max);

    /* Rotational velocity: */
    if (0 == robotcp->alpha) {
	// C_omega = 0.0f;
	/* XXX I just made this up... -tss */
    /* modified by dmf: -- this should work to get the robot to refine theta
     * while alpha is zero (but I don't like this discontinuity :-(  )
     */
	C_omega = K_h * robotcp->theta;
    }
    else {
	C_omega = K_k * robotcp->alpha + K_gamma *
	    ((cos(robotcp->alpha)*sin(robotcp->alpha)) / robotcp->alpha) *
	    (robotcp->alpha + K_h * robotcp->theta);
    }

    /* 'hard' saturation */
    if (C_omega > omega_max) {
        C_omega = omega_max;
    }
    if (C_omega < -omega_max) {
        C_omega = -omega_max;
    }

    /******************/
    /* end controller */

    /* wheel velocity translator: */
    *Vl = C_u - K_radius * C_omega;
    *Vr = C_u + K_radius * C_omega;

    // info("out %f %f %f  %f %f\n", robotcp->e, robotcp->alpha, robotcp->theta, *Vl, *Vr);

    /* end wheel velocity translator */

}
#endif
