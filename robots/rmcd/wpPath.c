/*
 * EMULAB-COPYRIGHT
 * Copyright (c) 2006 University of Utah and the Flux Group.
 * All rights reserved.
 */

#include <math.h>
#include <stdio.h>
#include <assert.h>

#include "wpPath.h"

void wp_loadfile(struct robot_position *wps,
                 int *num_wp,
                 struct cPaths_cfg *cf,
                 char *wp_filename) {

    FILE *wp_file = NULL;
    int fres;

    float xc = 0.0f, yc = 0.0f;
    int incr_i = 0;

    struct robot_position this_wp;



    this_wp.theta = 0.0f;
    this_wp.timestamp = 0.0;


    // Open file
    if (wp_filename) {
        if ((wp_file = fopen(wp_filename, "r")) == NULL) {
            fprintf(stderr, "ERROR: [wp_loadfile] Could not open waypoint file, %s.\n", wp_filename);
        }
        else {
            // Get waypoint data


            // First line is configuration data
            fres = fscanf(wp_file, "%f %f %f",
                          &(cf->v_start), &(cf->v_des), &(cf->radius));

            if (-1 == fres) {
                fprintf(stderr, "ERROR: [wp_loadfile] Abnormal termination in reading waypoint file, %s.\n", wp_filename);
            }


            while (-1 != fscanf(wp_file, "%f %f", &xc, &yc)) {

                if (debug) {
                    printf("wp: %f %f\n", xc, yc);
                }

                this_wp.x = xc;
                this_wp.y = yc;

                wps[incr_i] = this_wp;
                ++incr_i;
            }


        }
    }
    else {
        fprintf(stderr, "ERROR: [wp_loadfile] No waypoint file provided.\n");
    }

    *num_wp = incr_i;

}



void wp_loadmtp(struct robot_position *wps,
                int *num_wp,
                struct cPaths_cfg *cf) {

    // FIXME: does not do anything; need to get wp data from applet


}

