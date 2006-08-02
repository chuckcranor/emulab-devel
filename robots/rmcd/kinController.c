/*
 * EMULAB-COPYRIGHT
 * Copyright (c) 2006 University of Utah and the Flux Group.
 * All rights reserved.
 */

/**
 * @file kinController.c
 *
 * Functions for nonlinear state feedback kinematic control
 */

#include <math.h>
#include <stdio.h>
#include <assert.h>

#include <gsl/gsl_errno.h>
#include <gsl/gsl_matrix.h>
#include <gsl/gsl_odeiv.h>

#include "kinController.h"



void kc_main(struct vwheels *wh,
             struct robot_position *cs,
             struct robot_position *cr,
             struct vo *vr,
             struct kc_params *pa) {
    /* The main control loop */

    struct robot_position_states pstates;
    struct sgains gains;
    struct vo vcom;


    assert(pa != NULL);
    assert(wh != NULL);
    assert(cs != NULL);
    assert(cr != NULL);
    assert(vr != NULL);


    if (debug > 1) {
        printf("[kc_main]: TT controller, Current: (t = %f) [%f %f], Ref: [%f %f]\n",
               cs->timestamp, cs->x, cs->y, cr->x, cr->y);

        if (ctrl_logging > 0) {
            printf("[kc_main]: CONTROLLER DATA LOGGING ENABLED.\n");
        } else {
            printf("[kc_main]: Controller data logging disabled.\n");
        }
    }


    if (log_reftraj != NULL) {
        // Log reference trajectory
        fprintf(log_reftraj, "%f %f %f %f\n",
                cr->timestamp,
                cr->x, cr->y, cr->theta);
        fflush(log_reftraj);
        if (debug > 3)
            printf("[kc_main]: Writing reference trajectory data to file.\n");
    }

    if (log_traj != NULL) {
        // Log actual trajectory
        fprintf(log_traj, "%f %f %f %f\n",
                cs->timestamp,
                cs->x, cs->y, cs->theta);
        fflush(log_traj);
        if (debug > 3)
            printf("[kc_main]: Writing actual trajectory data to file.\n");
    }


    /*************************************************
     * Translate the cartesian state data into polar *
     *************************************************/
    kc_cart2pol(&pstates, cs, cr, pa);

    if (debug > 2) {
        printf("Polar states: t = %f e = %f th = %f al = %f\n",
               pstates.timestamp, pstates.e, pstates.theta, pstates.alpha);
    }

    if (log_states != NULL) {
        // Log states
        fprintf(log_states, "%f %f %f %f %f\n",
                pstates.timestamp,
                pstates.e, pstates.theta, pstates.alpha,
                pa->dtheta);
        fflush(log_states);
        if (debug > 3)
            printf("[kc_main]: Writing state data to file.\n");
    }


    // Set e_init, if not already set
    if (0.0f == pa->e_init) {
        pa->e_init = pstates.e;

        if (debug) {
            printf("[kc_main]: Setting e_init = %f.\n", pa->e_init);
        }
    }


    /*********************************
     * Call gain calculator function *
     *********************************/
    kc_gains(&gains, &pstates, pa);

    if (log_gains != NULL) {
        // Log gains
        fprintf(log_gains, "%f %f %f %f %f %f %f\n",
                gains.timestamp,
                gains.r, gains.epsilon,
                gains.k1, gains.k2, gains.kv, gains.kc);
        fflush(log_gains);
        if (debug > 3)
            printf("[kc_main]: Writing gain data to file.\n");
    }



    /**********************************************************
     * Pass gains and polar state data to the core controller *
     **********************************************************/
    kc_controller(&vcom, &pstates, vr, &gains, pa);

    if (debug > 2) {
        printf("Velocity command (controller): t = %f v = %f omega = %f\n",
               vcom.timestamp, vcom.v, vcom.omega);
    }



    /* Update velocity command lists */
    if (debug > 2) {
        printf("* Updating velocity lists:\n");
    }

    kc_update(pa->v_list_t,
              pa->v_list,
              pa->dv_list,
              pa->dv_list_f,
              &(pa->dv),
              vcom.timestamp,
              vcom.v,
              K_dv_max);

    kc_update(pa->omega_list_t,
              pa->omega_list,
              pa->domega_list,
              pa->domega_list_f,
              &(pa->domega),
              vcom.timestamp,
              vcom.omega,
              K_domega_max);




    if (log_ctrl != NULL) {
        // Log controller output
        fprintf(log_ctrl, "%f %f %f %f %f\n",
                vcom.timestamp,
                vcom.v, vcom.omega,
                pa->dv, pa->domega);
        fflush(log_ctrl);
        if (debug > 3)
            printf("[kc_main]: Writing controller output data to file.\n");
    }






    /* Run velocity commands through dynamic extension */
    kc_dynamic_ext(&vcom, &gains, pa);


    if (debug > 2) {
        printf("Velocity command (dynamic extension): t = %f v = %f omega = %f\n",
               vcom.timestamp, vcom.v, vcom.omega);
    }

    if (log_dynext != NULL) {
        // Log dynamic extension output
        fprintf(log_dynext, "%f %f %f\n",
                vcom.timestamp, vcom.v, vcom.omega);
        fflush(log_dynext);
        if (debug > 3)
            printf("[kc_main]: Writing dynamic extension data to file.\n");
    }




    /* Translate robot velocities into wheel velocities */
    wh->timestamp = vcom.timestamp;
    wh->vl = vcom.v - 0.5f * K_radius * vcom.omega;
    wh->vr = vcom.v + 0.5f * K_radius * vcom.omega;

    /* Saturate wheel speeds */
    if (fabs(wh->vl) > K_w_max) {
        wh->vl = (wh->vl / fabs(wh->vl)) * K_w_max;
    }
    if (fabs(wh->vr) > K_w_max) {
        wh->vr = (wh->vr / fabs(wh->vr)) * K_w_max;
    }


    /* Override wheel speeds to perform system identification: */
//     wh->vl = 0.5f;
//     wh->vr = 0.5f;




    if (log_wheels != NULL) {
        // Log wheel speeds
        fprintf(log_wheels, "%f %f %f\n",
                wh->timestamp, wh->vl, wh->vr);
        fflush(log_wheels);
        if (debug > 3)
            printf("[kc_main]: Writing wheel speed data to file.\n");
    }





}



void kc_controller(struct vo *v_out,
                   struct robot_position_states *st,
                   struct vo *v_ref,
                   struct sgains *ga,
                   struct kc_params *pa) {
    /* The core control law */

    float k_e, zeta, r_2, v_denom, kappa_r;


    assert(st != NULL);
    assert(v_ref != NULL);
    assert(ga != NULL);
    assert(pa != NULL);




    // Controller 'macros':
    zeta = 1.0f + ga->epsilon;
    k_e = sqrt(zeta - cos(2.0f * st->theta));
    r_2 = ga->r * sqrt(2.0f);

    v_denom = st->e * k_e + r_2 * sin(2.0f * st->theta) * sin(st->alpha);
    if (0.0f == v_denom) {
        v_out->v = 0.0f;
    }
    else {

        if (0.0f == v_ref->v) {
            kappa_r = 0.0f;
        }
        else {
            kappa_r = v_ref->omega / v_ref->v;
        }

        v_out->v = (ga->k1 * st->e * k_e * tanh(st->e - r_2 * k_e) +
                   v_ref->v * st->e * cos(st->theta) * k_e +
                   v_ref->v * r_2 * sin(2.0f * st->theta) *
                   (sin(st->theta) + kappa_r * st->e)) / v_denom;
    }


    v_out->omega = ga->k2 * tanh(st->theta + st->alpha) +
        2.0f * pa->dtheta + v_ref->omega;


    kc_sat(v_out);

    v_out->timestamp = st->timestamp;

}



void kc_dynamic_ext(struct vo *vc,
                    struct sgains *ga,
                    struct kc_params *pa) {
    /* Dynamic extension */


    double v, omega;
    int stat_v, stat_o;


    assert(vc != NULL);
    assert(ga != NULL);
    assert(pa != NULL);



    // Dynamic extension is bypassed if dydt(v,omega) == 0
    // FIXME: the dynamic extension blows up if dydt == 0 for too long

    if (pa->dv != 0.0f) {
        stat_v = kc_dynamic_ext_solve(&v,
                                      pa->v_last.v,
                                      ga->kv,
                                      vc->v,
                                      pa->dv);
        if (stat_v != GSL_SUCCESS) {
            printf("ERROR: Dynamic extension failure (v)\n");
            v = 0.0;
        }

    }

    if (pa->domega != 0.0f) {
        stat_o = kc_dynamic_ext_solve(&omega,
                                      pa->v_last.omega,
                                      ga->kc,
                                      vc->omega,
                                      pa->domega);

        if (stat_o != GSL_SUCCESS) {
            printf("ERROR: Dynamic extension failure (omega)\n");
            omega = 0.0;
        }

    }



    if (debug > 4) {
        printf("DYNEXT: v = %f omega = %f\n", v, omega);
    }


    // Set output:
    // (vc->timestamp is passed through)
    vc->v = (float)(v);
    vc->omega = (float)(omega);

    kc_sat(vc);

    pa->v_last.v = (float)(v);
    pa->v_last.omega = (float)(omega);

}



int kc_dynamic_ext_solve(double *y_out,
                         double y_in,
                         double gain,
                         double v_d,
                         double v_dd) {



    const gsl_odeiv_step_type *T = gsl_odeiv_step_rk8pd;

    gsl_odeiv_step *s = gsl_odeiv_step_alloc(T,2);
    gsl_odeiv_control *c = gsl_odeiv_control_y_new(1e-6, 0.0);
    gsl_odeiv_evolve *e = gsl_odeiv_evolve_alloc(2);

    double params[] = {gain, v_d, v_dd};

    double t = 0.0;
    double tl = 1.0 / 30.0;
    double h = 1e-6;
    double y[] = {y_in};

    int status = 0;

    gsl_odeiv_system sys_de = {kc_dynamic_ext_func, NULL, 2, params};






    while (t < tl) {
        status = gsl_odeiv_evolve_apply(e, c, s, &sys_de, &t, tl, &h, y);

        if (status != GSL_SUCCESS) {
            break;
        }
    }

    *y_out = y[0];

    gsl_odeiv_evolve_free(e);
    gsl_odeiv_control_free(c);
    gsl_odeiv_step_free(s);

    return status;

}



int kc_dynamic_ext_func(double t,
                        const double y[],
                        double f[],
                        void *params) {

    // Get gain, v_dot, v_d out of params
    double *p;
    double gain, v_d, v_dot;


    p = (double *)params;
    gain = p[0];
    v_d = p[1];
    v_dot = p[2];

    if (gain < 0) {
        if (debug) {
            printf("kc_dynamic_ext_solve: WARNING: gain < 0 (%f)\n",
                   gain);
            printf("**** SETTING GAIN TO ZERO ****\n");
        }
        gain = 0.0;
    }


    f[0] = -gain * (y[0] - v_d) + v_dot;

    return GSL_SUCCESS;
}



void kc_cart2pol(struct robot_position_states *pst,
                 struct robot_position *cst_act,
                 struct robot_position *cst_ref,
                 struct kc_params *pa) {
    /* Cartesian to polar state transformation */


    double xdiff, ydiff;
    float theta_delta;
    int incr_i;


    assert(cst_act != NULL);
    assert(cst_ref != NULL);
    assert(pa != NULL);



    xdiff = cst_act->x - cst_ref->x;
    ydiff = cst_act->y - cst_ref->y;


    pst->e = sqrt(pow(xdiff,2) + pow(ydiff,2));

    pst->theta = atan2(-ydiff, -xdiff) - cst_ref->theta;

    /* Consider last theta: */
    theta_delta = pst->theta - pa->theta_list[K_dlist_max - 1];

    /* Deal with jumps */
    if (fabs(theta_delta) >= M_PI) {
        /* Discontinuity detected */

        if (theta_delta > 0.0f) {
            pst->theta = pst->theta - 2 * M_PI;
        }
        else {
            pst->theta = pst->theta + 2 * M_PI;
        }
    }

    pst->alpha = pst->theta - cst_act->theta + cst_ref->theta;



    // Same timestamp as position measurement:
    pst->timestamp = cst_act->timestamp;



    // Update theta list, and get derivative
    if (1 == pa->theta_flood) {
        pa->theta_flood = 0;

        for (incr_i = 0; incr_i < K_dlist_max; ++incr_i) {
            pa->theta_list_t[incr_i] = pst->timestamp;
            pa->theta_list[incr_i] = pst->theta;
        }
    }
    else {

        if (debug > 2) {
            printf("* Updating theta list:\n");
        }

        kc_update(pa->theta_list_t,
                  pa->theta_list,
                  pa->dtheta_list,
                  pa->dtheta_list_f,
                  &(pa->dtheta),
                  pst->timestamp,
                  pst->theta,
                  K_domega_max);
    }




}



void kc_gains(struct sgains *gains,
              struct robot_position_states *pst,
              struct kc_params *pa) {
    /* Gain Calculation */

    float l1, l2;

    float g1 = 1.3;
    float k1_min = 0.2;
    float k1_max = 0.5;

    float e0;


    assert(pst != NULL);
    assert(pa != NULL);


    // Minimum value for e_init: (1 cm)
    if (pa->e_init < 0.01f)
        pa->e_init = 0.01f;


    gains->timestamp = pst->timestamp;

    // Set static gains:
    gains->r = K_R;
    gains->epsilon = K_EPSILON;
    gains->kv = K_KV;
    gains->kc = K_KC;


    // Fallback values:
    gains->k1 = k1_min;
    gains->k2 = 0.5f;

    // Calculate k_1:

    if (0.0f != pst->e) {
        gains->k1 = (k1_max - k1_min) * (1.0f - tanh(g1 / pst->e)) + k1_min;
    }

#ifdef K_K1
    gains->k1 = K_K1;
#endif



    // Calculate k_2:

    e0 = pa->e_init;
    if (e0 < 0.01f)
        e0 = 0.01;


    if (0.0f == pst->alpha) {
        l1 = 1.0f;
    }
    else {
        l1 = tanh(1.0f / (2.0f * fabs(pst->alpha)));
    }

    if (0.0f == pst->e) {
        l2 = 1.0f;
    }
    else {
        l2 = tanh(1.0f / pst->e);
    }

//     gains->k2 = (0.3f / e0) * l1 + 0.3f * l2;
    gains->k2 = (0.01f / e0) * l1 + 0.3f * l2;


    if (gains->k2 < 0.0f)
        gains->k2 = 0.0f;
    if (gains->k2 > 0.95 * K_KC)
        gains->k2 = 0.95 * K_KC;


#ifdef K_K2
    gains->k2 = K_K2;
#endif



// OLD WAY:
// // (lateral distance)
//     lambda = fabs(pst->e * sin(pst->theta));
//
//     if (0.0f == pst->alpha) {
//         tanh_alpha = 1.0f;
//     }
//     else {
//         tanh_alpha = tanh(1.0f / (2.0f * fabs(pst->alpha)));
//     }
//
//     if (0.0f == lambda) {
//         tanh_lambda = 1.0f;
//     }
//     else {
//         tanh_lambda = tanh(1.0f / lambda);
//     }
//
//     gains->k2 = (0.3f / pa->e_init) * tanh_alpha + 0.3f * tanh_lambda;



    if (debug) {
        if (gains->k1 >= gains->kv) {
            printf("kc_gains: WARNING: k1 >= kv (%f, %f)\n",
                   gains->k1, gains->kv);
            printf("**** THIS MAY CAUSE INSTABILITY ****\n");
        }

        if (gains->k2 >= gains->kc) {
            printf("kc_gains: WARNING: k2 >= kc (%f, %f)\n",
                   gains->k2, gains->kc);
            printf("**** THIS MAY CAUSE INSTABILITY ****\n");
        }
    }


}



void kc_d(float *dydt,
          double *tlist,
          float *ylist,
          float vsat) {
    // Numerical differentiation of y[]


    float x_i, x_im1, x_ip1;
    float num1, num2, num3; // numerators
    float den1, den2, den3; // denominators
    int divzero = 0;

    assert(tlist != NULL);
    assert(ylist != NULL);


    // (page 630 in Numerical Methods book)
    // Backward finite difference method
    // f'(x) = (3*f(x_i) - 4*f(x_i - 1) + f(x_i - 2)) / 2h

    // Assumes constant, 30 Hz data rate

//     *dydt = (3.0 * ylist[K_dlist_max - 1] -
//            4.0 * ylist[K_dlist_max - 2] +
//            1.0 * ylist[K_dlist_max - 3]) * 15.0;




    /* Equation (23.9) page 634
     * Numerical Methods for Engineers, third edition,
     * Chapman, S. C. and Camale, R. P. 1998
     */

    /* 2nd order Lagrange interpolating polynomial */

//     x = tlist[K_dlist_max - 1]; // x
    x_im1 = tlist[K_dlist_max - 3]; // x_{i-1}
    x_i = tlist[K_dlist_max - 2]; // x_i
    x_ip1 = tlist[K_dlist_max - 1]; // x_{i+1}

    num1 = (x_ip1 - x_i);
    num2 = (x_ip1 - x_im1);
    num3 = (2*x_ip1 - x_im1 - x_i);

    den1 = (x_im1 - x_i) * (x_im1 - x_ip1);
    den2 = (x_i - x_im1) * (x_i - x_ip1);
    den3 = (x_ip1 - x_im1) * (x_ip1 - x_i);

    if (0 == den1)
        divzero = 1;
    if (0 == den2)
        divzero = 1;
    if (0 == den3)
        divzero = 1;

    if (0 == divzero) {
        *dydt = ylist[K_dlist_max - 3] * (num1 / den1) +
                ylist[K_dlist_max - 2] * (num2 / den2) +
                ylist[K_dlist_max - 1] * (num3 / den3);
    }
    else {
        *dydt = 0.0;
        if (debug > 3) {
            printf("[][] dydt !!! = 0\n");
            printf("     den1 = %f  den2 = %f  den3 = %f\n",
                   den1, den2, den3);
        }
    }



    // Saturate
    if (fabs(*dydt) > vsat) {
        *dydt = (*dydt / fabs(*dydt)) * vsat;
    }

    if (debug > 3) {
        printf("[][] dydt = %f\n", *dydt);
    }

}



void kc_update(double *tlist,
               float *ylist,
               float *dylist_raw,
               float *dylist_filtered,
               float *dydt,
               double t,
               float y,
               float vsat) {
    // Pop a new value on the end of the array,
    // and calculate the derivative


    int incr_i;


    assert(tlist != NULL);
    assert(ylist != NULL);
    assert(dylist_raw != NULL);
    assert(dylist_filtered != NULL);



    for (incr_i = 0; incr_i < K_dlist_max - 1; ++incr_i) {
        tlist[incr_i] = tlist[incr_i + 1];
        ylist[incr_i] = ylist[incr_i + 1];
        dylist_raw[incr_i] = dylist_raw[incr_i + 1];
    }

    tlist[K_dlist_max - 1] = t;
    ylist[K_dlist_max - 1] = y;



    // Update derivative
    kc_d(dydt, tlist, ylist, vsat);
    dylist_raw[K_dlist_max - 1] = *dydt;


    // Filter derivative
    kc_IIRfilter(dydt, dylist_raw, dylist_filtered);

    // Update filtered derivative
    for (incr_i = 0; incr_i < K_dlist_max - 1; ++incr_i) {
        dylist_filtered[incr_i] = dylist_filtered[incr_i + 1];
    }
    dylist_filtered[K_dlist_max - 1] = *dydt;



    if (debug > 3) {
        printf("  t List: ");
        for (incr_i = 0; incr_i < K_dlist_max; ++incr_i) {
            printf("%f ", tlist[incr_i]);
        }
        printf("\n");

        printf("  y List: ");
        for (incr_i = 0; incr_i < K_dlist_max; ++incr_i) {
            printf("%f ", ylist[incr_i]);
        }
        printf("\n");

        printf("  Raw dy List: ");
        for (incr_i = 0; incr_i < K_dlist_max; ++incr_i) {
            printf("%f ", dylist_raw[incr_i]);
        }
        printf("\n");

        printf("  Filtered dy List: ");
        for (incr_i = 0; incr_i < K_dlist_max; ++incr_i) {
            printf("%f ", dylist_filtered[incr_i]);
        }
        printf("\n");

        printf("  dydt: %f\n", *dydt);
    }

}



void kc_IIRfilter(float *y_m,
                  float *x_m_list,
                  float *y_m_list) {
    // Infinite Impulse Response filter
    // Yes, this is slow, but it is general form

    /* Transformed direct form II filter
     * (From Fig. 5 of Youngshik's masters thesis.)
     *
     * Control System Prototyping: From DSP to Microcontroller
     * (Case Study: Throwing Robot Arm)
     * Kim, Youngshik
     * Department of Mechanical Engineering, University of Utah
     * May 2003
     */


    float a[K_dlist_max];
    float b[K_dlist_max];
    int incr_i;

    assert(y_m != NULL);
    assert(x_m_list != NULL);
    assert(y_m_list != NULL);



    // Initialize parameters
    for (incr_i = 0; incr_i < K_dlist_max - 1; ++incr_i) {
        a[incr_i] = 0.0f;
        b[incr_i] = 0.0f;
    }



    // FIXME: need to design filter
    // Filter parameters:
    a[0] = 1.0f; // IGNORED (see below)

    // Direct pass-through (no filtering):
//     b[0] = 1.0f;

    // 23.87 Hz corner frequency:
    a[1] = -0.7374f;


    b[0] = 0.1313f;
    b[1] = 0.1313f;



    *y_m = b[0] * x_m_list[K_dlist_max - 1];
    for (incr_i = 1; incr_i < K_dlist_max - 1; ++incr_i) {
        *y_m += b[incr_i] * x_m_list[K_dlist_max - (incr_i + 1)] +
                a[incr_i] * y_m_list[K_dlist_max - (incr_i)];
    }

}




void kc_init_params(struct kc_params *kp) {
    // Initialize parameter data

    int incr_i;

    assert(kp != NULL);



    for (incr_i = 0; incr_i < K_dlist_max; ++incr_i) {

        kp->theta_list_t[incr_i] = 0.0;
        kp->theta_list[incr_i] = 0.0f;
        kp->dtheta_list[incr_i] = 0.0f;
        kp->dtheta_list_f[incr_i] = 0.0f;

        kp->v_list_t[incr_i] = 0.0f;
        kp->v_list[incr_i] = 0.0f;
        kp->dv_list[incr_i] = 0.0f;
        kp->dv_list_f[incr_i] = 0.0f;

        kp->omega_list_t[incr_i] = 0.0f;
        kp->omega_list[incr_i] = 0.0f;
        kp->domega_list[incr_i] = 0.0f;
        kp->domega_list_f[incr_i] = 0.0f;

    }


    kp->e_init = 0.0f;

    kp->theta_flood = 1;

    kp->dtheta = 0.0f;
    kp->dv = 0.0f;
    kp->domega = 0.0f;


    kp->v_last.v = 0.0f;
    kp->v_last.omega = 0.0f;

}



void kc_sat(struct vo *vs) {
    // Saturate a velocity struct

    assert(vs != NULL);


    if (fabs(vs->v) > K_v_max) {
        vs->v = (vs->v / fabs(vs->v)) * K_v_max;
    }

    if (fabs(vs->omega) > K_omega_max) {
        vs->omega = (vs->omega / fabs(vs->omega)) * K_omega_max;
    }


}


