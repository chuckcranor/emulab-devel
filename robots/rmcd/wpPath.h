/*
 * EMULAB-COPYRIGHT
 * Copyright (c) 2006 University of Utah and the Flux Group.
 * All rights reserved.
 */

#include "cPaths.h"




// Maximum number of waypoints:
#define wp_MAX_WP 50

#ifndef _rmcd_wppath_h
#define _rmcd_wppath_h

/**
 * @file wpPath.h
 *
 * Header file for optaining waypoint data, to be sent to the
 * continuous path generator.
 */



/** Load waypoint data from a file
 *
 * @param wps Waypoint list
 * @param num_wp Number of waypoints
 * @param cf Path configuration data
 * @param wp_filename Waypoint data file to load
 */
void wp_loadfile(struct robot_position *wps,
                 int *num_wp,
                 struct cPaths_cfg *cf,
                 char *wp_filename);



/** Load waypoint data from mtp connection
 *
 * @param wps Waypoint list
 * @param num_wp Number of waypoints
 * @param cf Path configuration data
 */
void wp_loadmtp(struct robot_position *wps,
                int *num_wp,
                struct cPaths_cfg *cf);



#endif

