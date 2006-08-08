/*
 * EMULAB-COPYRIGHT
 * Copyright (c) 2006 University of Utah and the Flux Group.
 * All rights reserved.
 */



// Pick ONE:
// #define NOT_IN_RMCD
#include "mtp.h"

/**
 * @file kinController.h
 *
 * Header file for the state feedback kinematic controller. These functions
 * provide the components needed for trajectory tracking.
 */


#ifndef _rmcd_kin_controller_h
#define _rmcd_kin_controller_h


/* There are dummies for robot_position and robot_position_states below.
 * Comment those out, and uncomment this next line before integration
 * with RMCD
 */
// #include "mtp.h"


// Robot wheel (axle) radius in meters
#define K_radius 0.0889f

// Maximum wheel speed
#define K_w_max 2.0f

// Robot maximum linear velocity and acceleration
#define K_v_max 1.0f
#define K_dv_max 2.0f

// Robot maximum angular velocity and acceleration
#define K_omega_max 5.6243f
#define K_domega_max 20.0f

// Number of values to store for differentiation
#define K_dlist_max 5

/* CONTROLLER PARAMETERS:
 ************************/
/* BEST: R = 0.02, eps = 0.003, k1 = 0.85, k2 = 0.3, kv = 3.0, kc = 3.0 */

// Path manifold radius:
#define K_R 0.02f

// Epsilon, 'nudge'
#define K_EPSILON 0.003f
// Outside of noise envelope of vision system (0.02)

// Controller gain k1
#define K_K1 0.85f

// Controller gain k2
#define K_K2 0.3f


// Dynamic extension 'v' gain:
#define K_KV 3.0f

// Dynamic extension 'omega' gain:
#define K_KC 3.0f





// Debugging: log data from all components
// Reference trajectory
extern FILE *log_reftraj;
extern char *lfile_reftraj;

// Actual trajectory
extern FILE *log_traj;
extern char *lfile_traj;

// Polar states: (t, e, theta, alpha, theta_dot)
extern FILE *log_states;
extern char *lfile_states;

// Gains: (t, r, epsilon, k1, k2, kv, kc)
extern FILE *log_gains;
extern char *lfile_gains;

// Controller output (t, v, omega, v_dot, omega_dot)
extern FILE *log_ctrl;
extern char *lfile_ctrl;

// Dynamic extension output (t, v, omega)
extern FILE *log_dynext;
extern char *lfile_dynext;

// Wheel speeds: (t, vl, vr)
extern FILE *log_wheels;
extern char *lfile_wheels;

extern int ctrl_logging;



extern int debug;

#ifdef NOT_IN_RMCD

// ALTERNATE robot_position
struct robot_position {
    float x;
    float y;
    float theta;
    double timestamp;
};

// ALTERNATE robot_position_states
struct robot_position_states {
    float e;
    float theta;
    float alpha;
    double timestamp;
};

#endif


/**
 * Velocity commands v, omega
 */
struct vo {
    double timestamp; // timestamp
    float v; // linear velocity
    float omega; // angular velocity
};


/**
 * Controller and dynamic extension gains
 */
struct sgains {
    double timestamp; // timestamp
    float r; // radius of circle
    float epsilon; // eps
    float k1; // controller gain for v
    float k2; // controller gain for omega
    float kv; // dynamic extension gain for v
    float kc; // dynamic extension gain for omega
};


/**
 * Wheel velocities
 */
struct vwheels {
    double timestamp; // timestamp
    double vl; // Left wheel velocity
    double vr; // Right wheel velocity
};



/**
 * kinController parameters
 */
struct kc_params {

    float e_init;

    int theta_flood;

    float dtheta; // Current derivative of theta
    double theta_list_t[K_dlist_max]; // Timestamps for theta list
    float theta_list[K_dlist_max];    // List of theta values
    float dtheta_list[K_dlist_max];   // Raw theta derivative list
    float dtheta_list_f[K_dlist_max]; // Filtered theta d list

//     double vo_t[K_dlist_max];

    float dv; // Current derivative of v
    double v_list_t[K_dlist_max]; // Timestamps for v list
    float v_list[K_dlist_max];    // List of v values
    float dv_list[K_dlist_max];   // Raw v derivative list
    float dv_list_f[K_dlist_max]; // Filtered v d list

    float domega; // Current derivative of omega
    double omega_list_t[K_dlist_max]; // Timestamps for omega list
    float omega_list[K_dlist_max];    // list of omega values
    float domega_list[K_dlist_max];   // Raw omega derivative list
    float domega_list_f[K_dlist_max]; // Filtered omega d list

    struct vo v_last;

    // Previous states:
    float theta_last;
    float alpha_last;

    // Initialization flags:
    int theta_flag;
    int alpha_flag;

};



/**
 * Call the main control loop
 *
 * @param wh Wheel velocity command
 * @param cs Current position
 * @param cr Reference position
 * @param vr Reference velocities
 * @param pa Main parameters
 */
void kc_main(struct vwheels *wh,
            struct robot_position *cs,
            struct robot_position *cr,
            struct vo *vr,
            struct kc_params *pa);



/**
 * Controller core
 *
 * @param v_out Controller output velocities
 * @param st Current states in polar form
 * @param v_ref Reference velocities
 * @param ga Controller gains
 * @param pa Main parameters
 */
void kc_controller(struct vo *v_out,
                   struct robot_position_states *st,
                   struct vo *v_ref,
                   struct sgains *ga,
                   struct kc_params *pa);



/**
 * Dynamic extension
 *
 * @param vc Current velocity command (input + output)
 * @param ga Controller gains
 * @param pa Controller parameters
 */
void kc_dynamic_ext(struct vo *vc,
                    struct sgains *ga,
                    struct kc_params *pa);



/**
 * Dynamic extension ODE system solver
 *
 *
 */
int kc_dynamic_ext_solve(double *y_out,
                         double y_in,
                         double gain,
                         double v_d,
                         double v_dd);



/**
 * Dynamic extension function --  (43) in Kim 2006
 *
 * @param t Time (ignored -- time invariant)
 * @param y Function input (v/kappa in this instance)
 * @param f Function output (v/kappa _dot in this instance)
 * @param params Parameters (gain, vdot, v_d)
 */
int kc_dynamic_ext_func(double t,
                        const double y[],
                        double f[],
                        void *params);

/**
 * Cartesian to polar coordinates state transformation
 *
 * @param pst Current states in polar form
 * @param cst_act Current (actual) states in cartesian form
 * @param cst_ref Reference states in cartesian form
 * @param ltheta Last value of theta
 */
void kc_cart2pol(struct robot_position_states *pst,
                 struct robot_position *cst_act,
                 struct robot_position *cst_ref,
                 struct kc_params *pa);



/**
 * Gain Calculation
 *
 * @param gains Output gains
 * @param pst Current states in polar form
 * @param e_init Initial value of state e
 */
void kc_gains(struct sgains *gains,
              struct robot_position_states *pst,
              struct kc_params *pa);



/**
 * Derivative of list of values
 *
 * @param dydt Derivative of y
 * @param tlist Array of time values for y
 * @param ylist Array of recent y values
 */
void kc_d(float *dydt,
          double *tlist,
          float *ylist,
          float vsat);



/**
 * Update an array, and calculate its derivative
 *
 * @param tlist List of timestamps
 * @param ylist List of values
 * @param dylist_raw Raw derivatives of ylist
 * @param dylist_filtered Filtered derivatives of ylist
 * @param dydt Derivative
 * @param t Time value for y
 * @param y Value to pop to end of array
 */
void kc_update(double *tlist,
               float *ylist,
               float *dylist_raw,
               float *dylist_filtered,
               float *dydt,
               double t,
               float y,
               float vsat);



/**
 * IIR (infinite impulse response) digital filter
 *
 * @param y_m Filter output
 * @param x_m_list List of raw values
 * @param y_m_list List of previous filter output
 */
void kc_IIRfilter(float *y_m,
                  float *x_m_list,
                  float *y_m_list);



/**
 * Initialize main parameters structure
 *
 * @param kp Main Parameters
 */
void kc_init_params(struct kc_params *kp);



/**
 * Saturate a velocity structure
 *
 * @param vs Velocity structure
 */
void kc_sat(struct vo *vs);



/**
 * Wrap up a phase angle (-pi --> +pi)
 *
 * @param th Angle
 */
float kc_wrap(float th);



/**
 * Unwind a phase angle
 *
 * @param th Current angle
 * @param thl Last angle
 */
float kc_unwrap(float th, float thl);

#endif
