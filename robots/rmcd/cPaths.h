/*
 * EMULAB-COPYRIGHT
 * Copyright (c) 2006 University of Utah and the Flux Group.
 * All rights reserved.
 */

#include "kinController.h"

#ifndef _rmcd_cpaths_h
#define _rmcd_cpaths_h


/**
 * @file cPaths.h
 *
 * Header file for the continuous path generator. These functions provide
 * the components needed for trajectory generation.
 */




#define cp_MAX_WP 100
#define cp_MAX_SEGMENTS 200
#define cp_MAX_TRAJ_POINTS 10000

extern int debug;





/** cPath_cfg struct
 */
struct cPaths_cfg {
    float v_start;
    float v_des;
    float radius;
};



/** init_pdata struct
 */
struct init_pdata {
    int type; // 0 for line-arc segments

    int wp_size;

    float v; // velocity
    float radius; // curve radius
};

/** Pathdata struct
 */
struct pathdata {
    int type;
    float pt_start[2]; // Segment start point
    float pt_end[2];   // Segment end point
    float pt_center[2]; // Center point

    float v; // Desired end velocity

    float start_angle; // Start angle
    float end_angle;   // End angle

    float sweep; // delta

    float gamma;
    float alpha;

    int sign; // Sign of curve: + left, - right
    float radius; // Radius of circular arc
};


/** Control points for trim function
 */
struct cpts {
    float a[2];
    float b[2];
    float c[2];
    float radius;
    float angle;
};


/** Trim points (output from lseg_trim
 */
struct tpts {
    float pt_start[2];
    float pt_end[2];
    float pt_center[2];
    float gamma;
    int sign;
};


/** Parametric trajectory data point
 */
struct tdata {
    double t; /* timestamp */
    float x;
    float y;
    float phi;
    float v;
    float omega; /* phi dot */
};







/** Main path generator
 *
 * @param tr Trajectory data out
 * @param wps Waypoint data in
 * @param t_size Number of trajectory data points
 * @param wp_size Number of waypoints
 */
void cp_maketraj(struct cPaths_cfg *cfg,
                 struct tdata *tr,
                 int *tr_size,
                 struct robot_position *wps,
                 int wp_size);

/** Path data builder, from build_pathdata.m
 *
 * @param pds Pathdata list out
 * @param wps Waypoints
 */
void cp_build_pathdata(struct pathdata *pd,
                       struct robot_position *wps,
                       struct init_pdata *ipd,
                       int *pd_size);


/** Line segment trim/fillet function, from lseg_trim
 *
 * @param tp Trim points
 * @param cpt Control points
 */
void cp_lseg_trim(struct tpts *tp, struct cpts *cpt);



/** Grab current interpolated reference trajectory data point
 *
 * @param tr Trajectory data
 * @param tr_size Size of trajectory data
 * @param tt Trajectory data point out
 * @param t Current trajectory time
 */
int cp_grabref(struct tdata *tr,
               int tr_size,
               struct tdata *tt,
               double t);


#endif
