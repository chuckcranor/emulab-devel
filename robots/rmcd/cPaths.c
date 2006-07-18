/*
 * EMULAB-COPYRIGHT
 * Copyright (c) 2006 University of Utah and the Flux Group.
 * All rights reserved.
 */

#include <math.h>
#include <stdio.h>
#include <assert.h>

#include "cPaths.h"


void cp_maketraj(struct cPaths_cfg *cfg,
                 struct tdata *tr,
                 int *tr_size,
                 struct robot_position *wps,
                 int wp_size) {
    /* Build a line-arc trajectory using closed-form methods.
     * From maketraj_cf.m
     */


    // Data to pass to cp_build_pathdata():
    struct init_pdata ipd;
    struct pathdata pdata[cp_MAX_SEGMENTS];



    int incr_i, pd_size;
    float v_1, v_2, last_v;

    float t_current, t_step, t_total;
    int s_count = 0;

    float kappa;
    float t_lcur, t, th;
    float s_total, s_cur, delta;

    float xy_cur[2], phi_cur;

    float v_cur, v_next;


    assert(wps != NULL);


    if (debug) {
        printf("[cp_maketraj]: Generating line-arc trajectory from waypoint data.\n");
    }


    /*******************
     * Initialize data *
     *******************/

    // Time values:
    t_current = 0.0f;
    t_step = 1.0f / 30.0f;



    /**********************
     * Initial Path data: *
     **********************/

    ipd.type = 0; // line-arc segments

    ipd.wp_size = wp_size;
    if (debug > 1) {
        printf("[cp_maketraj]: Number of waypoints: %d\n", ipd.wp_size);
    }

    ipd.v = cfg->v_des;
    ipd.radius = cfg->radius;



    // Build path data
    cp_build_pathdata(pdata, wps, &ipd, &pd_size);







    if (debug > 1) {
        printf("[cp_maketraj]: Number of segments: %d\n", pd_size);
    }

    // For each path segment
    for (incr_i = 0; incr_i < pd_size; ++incr_i) {

        if (debug > 1) {
            printf("[cp_maketraj]: [%d] path segment.\n", incr_i);
        }

        /***************************
         * set boundary velocities *
         ***************************/

        if (0 == incr_i) {
            v_1 = cfg->v_start;
        }
        else {
            v_1 = pdata[incr_i-1].v;
        }

        if (pd_size == incr_i) {
            v_2 = 0;
        }
        else {
            v_2 = pdata[incr_i].v;
        }



        /*******************************************************
         * Calculate path posture data points for this segment *
         *******************************************************/


        if (0 == pdata[incr_i].type) {
            // line segment
            if (debug > 2) {
                printf("[cp_maketraj]: This is a line segment.\n");
            }
            kappa = 0.0f;
            s_total = sqrt(pow(pdata[incr_i].pt_end[0] -
                               pdata[incr_i].pt_start[0],2) +
                           pow(pdata[incr_i].pt_end[1] -
                               pdata[incr_i].pt_start[1],2));
        }
        else {
            // curve segment
            if (debug > 2) {
                printf("[cp_maketraj]: This is a curve segment.\n");
            }
            kappa = pdata[incr_i].sign / pdata[incr_i].radius;
            s_total = pdata[incr_i].radius * pdata[incr_i].gamma;
        }

        if (debug > 3) {
            printf("[cp_maketraj]: s_total = %f\n", s_total);
        }



        /*****************************************
         * Calculate total time for this segment *
         *****************************************/

        t_total = (2.0f * s_total) / (v_1 + v_2);

        // Initialize parameters:
        s_cur = 0.0f; // Current position along segment
        t_lcur = 0.0f; // local current time

        if (debug > 2) {
            printf("[cp_maketraj]: Calculating trajectory data points.\n");
        }


        while (fabs(s_cur) < s_total) {


            // Calculate current t value
            t = s_cur / s_total;

            if (debug > 5) {
                printf("[%d] s_count = %d, t = %f s_cur = %f, s_total = %f \n", incr_i, s_count, t, s_cur, s_total);
            }


            if (0 == pdata[incr_i].type) {
                // (line)

                xy_cur[0] = pdata[incr_i].pt_start[0] + t *
                     (pdata[incr_i].pt_end[0] - pdata[incr_i].pt_start[0]);
                xy_cur[1] = pdata[incr_i].pt_start[1] + t *
                     (pdata[incr_i].pt_end[1] - pdata[incr_i].pt_start[1]);
                phi_cur = pdata[incr_i].start_angle;

            }
            else {
                // (curve)

                phi_cur = t * pdata[incr_i].sign * pdata[incr_i].gamma + pdata[incr_i].start_angle;
                th = phi_cur - M_PI / 2.0f;
                xy_cur[0] = pdata[incr_i].pt_center[0] +
                    pdata[incr_i].sign * pdata[incr_i].radius * cos(th);
                xy_cur[1] = pdata[incr_i].pt_center[1] +
                    pdata[incr_i].sign * pdata[incr_i].radius * sin(th);

            }


            // Current velocity
            v_cur = v_1 + (v_2 - v_1) * (t_lcur / t_total);
            v_next = v_1 + (v_2 - v_1) * ((t_lcur + t_step) / t_total);



            // Write out points:
            if (s_count < cp_MAX_TRAJ_POINTS) {
                tr[s_count].t = t_current;

                tr[s_count].x = xy_cur[0];
                tr[s_count].y = xy_cur[1];
                tr[s_count].phi = phi_cur;

                tr[s_count].v = v_cur;
                tr[s_count].omega = v_cur * kappa;
            }

            // Next position on arc:
            delta = fabs(t_step * (v_cur + v_next) / 2.0f);
            s_cur = s_cur + delta;
            t_current = t_current + t_step;
            t_lcur = t_lcur + t_step;
            ++s_count;

            if (debug > 4) {
                printf("[cp_maketraj]: t_current = %f, t_lcur = %f\n", t_current, t_lcur);
                printf("[cp_maketraj]: delta = %f, v_cur = %f, v_next = %f, t_step = %f\n", delta, v_cur, v_next, t_step);
            }


            if (s_count >= cp_MAX_TRAJ_POINTS) {
                s_cur = s_total + 1;
                printf("ERROR: [cp_maketraj]: Too many trajectory data points.\n");
            }


        } // while (s_cur < s_total)
    } // foreach path segment



    // Postprocess theta
    for (incr_i = 0; incr_i < s_count; ++incr_i) {
        if (tr[incr_i].phi > M_PI) {
            tr[incr_i].phi = tr[incr_i].phi - 2.0f * M_PI;
        }

        if (tr[incr_i].phi < -M_PI) {
            tr[incr_i].phi = tr[incr_i].phi + 2.0f * M_PI;
        }
    }


    *tr_size = s_count;

    if (debug > 2) {
        printf("[cp_maketraj]: Trajectory generation complete.\n");
    }

}



void cp_build_pathdata(struct pathdata *pd,
                       struct robot_position *wps,
                       struct init_pdata *ipd,
                       int *pd_size) {
    /* Build the path data structure list --
     * Adapted from build_pathdata.m
    */



    struct tpts tp;
    struct cpts cpt;


    float this_x, this_y, this_angle, last_angle;
    int current_segment, incr_i, wp_size;


    assert(wps != NULL);
    assert(ipd != NULL);


    /****************************************************
     * Build the first segment:                         *
     * a straight line between the first two waypoints: *
     ****************************************************/


    pd[0].type = 0; // line segment

    pd[0].pt_start[0] = wps[0].x;
    pd[0].pt_start[1] = wps[0].y;

    pd[0].pt_end[0] = wps[1].x;
    pd[0].pt_end[1] = wps[1].y;

    pd[0].pt_center[0] = pd[0].pt_start[0];
    pd[0].pt_center[1] = pd[0].pt_start[1];

    pd[0].v = ipd->v;


    /* Calculate the angle for the first segment */
    this_x = wps[1].x - wps[0].x;
    this_y = wps[1].y - wps[0].y;
    this_angle = atan2(this_y, this_x);

    pd[0].start_angle = this_angle;
    pd[0].end_angle = this_angle;

    // Some dummy values not needed for line segments:
    pd[0].sweep = 0.0f;
    pd[0].sign = 0;
    pd[0].radius = 0.0f;





    current_segment = 1;
    for (incr_i = 2; incr_i < ipd->wp_size; ++incr_i) {

        /* Angle of previous segment */
        last_angle = this_angle;

        /* Calculate the angle of this segment */
        this_x = wps[incr_i].x - wps[incr_i-1].x;
        this_y = wps[incr_i].y - wps[incr_i-1].y;
        this_angle = atan2(this_y, this_x);

        if (this_angle == last_angle) {
            /* path angles are equal, build a straight line segment */
            pd[current_segment].pt_start[0] = wps[incr_i-1].x;
            pd[current_segment].pt_start[1] = wps[incr_i-1].y;

            pd[current_segment].pt_end[0] = wps[incr_i].x;
            pd[current_segment].pt_end[1] = wps[incr_i].y;

            pd[current_segment].v = ipd->v;

            pd[current_segment].type = 0; // Line segment

            pd[current_segment].start_angle = this_angle;
            pd[current_segment].end_angle = this_angle;
            ++current_segment;
        }
        else {
            /* path angles are not equal, build a curved segment */

            // Get the three control points for this curve:
            cpt.a[0] = pd[current_segment-1].pt_start[0];
            cpt.a[1] = pd[current_segment-1].pt_start[1];

            cpt.b[0] = pd[current_segment-1].pt_end[0];
            cpt.b[1] = pd[current_segment-1].pt_end[1];

            cpt.c[0] = wps[incr_i].x;
            cpt.c[1] = wps[incr_i].y;

            cpt.radius = ipd->radius;

            // Fix the angle:
            cpt.angle = this_angle - last_angle;
            if (cpt.angle > M_PI) {
                cpt.angle = cpt.angle - 2.0f * M_PI;
            }
            if (cpt.angle < -M_PI) {
                cpt.angle = cpt.angle + 2.0f * M_PI;
            }

            cp_lseg_trim(&tp, &cpt);

            // Trim the last segment
            pd[current_segment-1].pt_end[0] = tp.pt_start[0];
            pd[current_segment-1].pt_end[1] = tp.pt_start[1];


            // Insert a curved segment
            pd[current_segment].pt_start[0] = tp.pt_start[0];
            pd[current_segment].pt_start[1] = tp.pt_start[1];

            pd[current_segment].pt_end[0] = tp.pt_end[0];
            pd[current_segment].pt_end[1] = tp.pt_end[1];

            pd[current_segment].v = ipd->v;

            pd[current_segment].pt_center[0] = tp.pt_center[0];
            pd[current_segment].pt_center[1] = tp.pt_center[1];

            pd[current_segment].gamma = tp.gamma;
            pd[current_segment].sign = tp.sign;
            pd[current_segment].radius = cpt.radius;
            pd[current_segment].start_angle = pd[current_segment-1].start_angle;
            pd[current_segment].end_angle = this_angle;
            pd[current_segment].alpha = cpt.angle;
            pd[current_segment].type = 1;

            ++current_segment;



            // Add trimmed line segment up to current waypoint
            pd[current_segment].pt_start[0] = tp.pt_end[0];
            pd[current_segment].pt_start[1] = tp.pt_end[1];

            pd[current_segment].pt_end[0] = wps[incr_i].x;
            pd[current_segment].pt_end[1] = wps[incr_i].y;

            pd[current_segment].v = ipd->v;
            pd[current_segment].type = 0;

            pd[current_segment].start_angle = this_angle;
            pd[current_segment].end_angle = this_angle;

            ++current_segment;
        }
    }


    // Set ending velocity of final segment to zero
    pd[current_segment-1].v = 0.0f;



    *pd_size = current_segment;

}



void cp_lseg_trim(struct tpts *tp, struct cpts *cpt) {
    /* Create a fillet for an arc --
     * Adapted from lseg_trim.m
     */

    struct tpts tp_tmp;

    float ab[2], bc[2];
    float theta_ab, theta_bc;

    float cross_abc;

    int sign_df, sign_ef;

    float uv_df[2], uv_ef[2];

    float a_off_ab[2], b_off_ab[2];
    float b_off_bc[2], c_off_bc[2];

    float x1, x2, x3, x4;
    float y1, y2, y3, y4;

    float d[2], e[2], f[2];

    float dot_de, norm_df, norm_ef;

    float l1_det, l2_det, denom_det;


    assert(cpt != NULL);

    /* Line segments */
    ab[0] = cpt->b[0] - cpt->a[0];
    ab[1] = cpt->b[1] - cpt->a[1];

    bc[0] = cpt->c[0] - cpt->b[0];
    bc[1] = cpt->c[1] - cpt->b[1];

    cross_abc = (ab[0] * bc[1]) - (ab[1] * bc[0]);

    theta_ab = atan2(ab[1], ab[0]);
    theta_bc = atan2(bc[1], bc[0]);

    if (cross_abc >= 0) { sign_df = 1;  }
    else                { sign_df = -1; }

    if (cross_abc >= 0) { sign_ef = 1;  }
    else                { sign_ef = -1; }


    /* Unit vectors for line segment offsets */
    uv_df[0] = -sign_df * ab[1] / sqrt(ab[0]*ab[0] + ab[1]*ab[1]);
    uv_df[1] =  sign_df * ab[0] / sqrt(ab[0]*ab[0] + ab[1]*ab[1]);

    uv_ef[0] = -sign_ef * bc[1] / sqrt(bc[0]*bc[0] + bc[1]*bc[1]);
    uv_ef[1] =  sign_ef * bc[0] / sqrt(bc[0]*bc[0] + bc[1]*bc[1]);


    /* Offset line segment points */
    a_off_ab[0] = cpt->a[0] + cpt->radius * uv_df[0];
    a_off_ab[1] = cpt->a[1] + cpt->radius * uv_df[1];

    b_off_ab[0] = cpt->b[0] + cpt->radius * uv_df[0];
    b_off_ab[1] = cpt->b[1] + cpt->radius * uv_df[1];


    b_off_bc[0] = cpt->b[0] + cpt->radius * uv_ef[0];
    b_off_bc[1] = cpt->b[1] + cpt->radius * uv_ef[1];

    c_off_bc[0] = cpt->c[0] + cpt->radius * uv_ef[0];
    c_off_bc[1] = cpt->c[1] + cpt->radius * uv_ef[1];


    /* Get the intersection point of the offset lines */
    x1 = a_off_ab[0];
    y1 = a_off_ab[1];

    x2 = b_off_ab[0];
    y2 = b_off_ab[1];

    x3 = b_off_bc[0];
    y3 = b_off_bc[1];

    x4 = c_off_bc[0];
    y4 = c_off_bc[1];

    l1_det = x1 * y2 - y1 * x2;
    l2_det = x3 * y4 - y3 * x4;

    denom_det = (x1-x2) * (y3-y4) - (y1-y2) * (x3-x4);


    if (0.0f == denom_det) {
        // degenerate case
        f[0] = cpt->b[0];
        f[1] = cpt->b[1];
    }
    else {
        f[0] = (l1_det*(x3-x4) - (x1-x2)*l2_det) / denom_det;
        f[1] = (l1_det*(y3-y4) - (y1-y2)*l2_det) / denom_det;
    }


    /* Calculate d, and e (the start and end points of the arc) */
    d[0] = f[0] - cpt->radius * uv_df[0];
    d[1] = f[1] - cpt->radius * uv_df[1];

    e[0] = f[0] - cpt->radius * uv_ef[0];
    e[1] = f[1] - cpt->radius * uv_ef[1];


    /* Calculate the sweep angle */
    dot_de = (d[0]-f[0]) * (e[0]-f[0]) + (d[1]-f[1]) * (e[1]-f[1]);
    norm_df = sqrt((d[0]-f[0])*(d[0]-f[0]) + (d[1]-f[1])*(d[1]-f[1]));
    norm_ef = sqrt((e[0]-f[0])*(e[0]-f[0]) + (e[1]-f[1])*(e[1]-f[1]));

    tp_tmp.gamma = acos(dot_de / (norm_df * norm_ef));

    /* Calculate the 'sign' of the curve */
    if (cpt->angle >= 0) { tp_tmp.sign = 1;  }
    else                 { tp_tmp.sign = -1; }


    tp_tmp.pt_start[0] = d[0];
    tp_tmp.pt_start[1] = d[1];

    tp_tmp.pt_end[0] = e[0];
    tp_tmp.pt_end[1] = e[1];

    tp_tmp.pt_center[0] = f[0];
    tp_tmp.pt_center[1] = f[1];

    *tp = tp_tmp;

}


int cp_grabref(struct tdata *tr,
                int tr_size,
                struct tdata *tt,
                double t) {
    /* Grab current interpolated reference trajectory data point
     */

    /* WARNING:
     * This functions assumes that timestamps in tr are
     * monotonically increasing.
     */

    int retval = 0;
    int incr_i = 0, count = 0, done = 0;
    double t_end = 0.0;
    double tz = 0.0;

    struct tdata ts1; // scratch
    struct tdata ts2; // scratch
    struct tdata ts3; // scratch
    // Yes, I know that this is not efficient. Too fucking bad, bitch.

    if (debug > 3) {
        info("[cp_grabref]: Calculating reference trajectory. (tr_size = %d, t = %f).\n",
             tr_size, t);
    }

    // Get time at last data point
    ts1 = tr[tr_size-1];
    t_end = ts1.t;

    // Start with incr_i near the target time, t
    if (0 == t_end) {
        incr_i = 0; // Shit, start at the beginning
        if (debug) {
            fprintf(stderr, "WARNING: [cp_grabref] could not calculate initial time index.\n");
        }
    }
    else {
        incr_i = (int)((t / t_end) * tr_size);
    }

    if (debug > 3) {
        info("[cp_grabref]: Grabbing trajectory point #%d.\n",
             incr_i);
    }

    // If t is greater than the end of the trajectory:
    if (t > t_end) {
        done = 1;
        *tt = tr[tr_size - 1];
    }


    while (0 == done) {

        if (incr_i < 0) {
            // Hit bottom
            if (debug > 3) {
                info("[cp_grabref]: Hit bottom. (incr_i = %d).\n",
                     incr_i);
            }

            incr_i = 0;
            done = 1;

            ts3 = tr[incr_i];
        }

        if (incr_i >= tr_size - 1) {
            // Hit top

            if (debug > 3) {
                info("[cp_grabref]: Hit top. (incr_i = %d).\n",
                     incr_i);
            }

            incr_i = tr_size - 1;
            done = 1;

            ts3 = tr[incr_i];
            retval = 1;
            // The trajectory is finished
        }



        if (0 == done) {

            // get this and next traj datum
            ts1 = tr[incr_i];
            ts2 = tr[incr_i + 1];

            if (debug > 3) {
                info("[cp_grabref]: Current timestamps: t1 = %f, t2 = %f\n",
                     ts1.t, ts2.t);
            }



            if (t >= ts1.t && t <= ts2.t) {
                // This is what we're looking for

                // linear interpolation
                if (0 == ts2.t - ts1.t) {
                    tz = 0.0;
                    if (debug) {
                        fprintf(stderr, "WARNING [cp_grabref] Divide by zero. Poorly spaced trajectory data.\n");
                    }
                }
                else {
                    tz = (t - ts1.t) / (ts2.t - ts1.t);
                }

                ts3.t = t;
                ts3.x = tz * (ts2.x - ts1.x) + ts1.x;
                ts3.y = tz * (ts2.y - ts1.y) + ts1.y;
                ts3.phi = tz * (ts2.phi - ts1.phi) + ts1.phi;
                ts3.v = tz * (ts2.v - ts1.v) + ts1.v;
                ts3.omega = tz * (ts2.omega - ts1.omega) + ts1.omega;

                done = 1;
            }
            else {

                if (t < ts1.t) {
                    if (debug > 3)
                        printf("[cp_grabref]: incr_i++\n");
                    incr_i -= 1;
                }

                if (t > ts2.t) {
                    if (debug > 3)
                        printf("[cp_grabref]: incr_i--\n");
                    incr_i += 1;
                }
            }

        }

        *tt = ts3;


        ++count;
        if (count > tr_size) {
            // Too much back and forth
            if (debug) {
                fprintf(stderr, "WARNING: [cp_grabref] Could not find given time value in trajectory data.\n");
            }
            done = 1;
        }

    }


    if (debug > 2) {
        printf("cp_grabref: converged in %d steps.\n", count);
    }


    return retval;

}



