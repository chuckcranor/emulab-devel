
#include "config.h"

#include <math.h>
#include <stdio.h>
#include <assert.h>
#include <string.h>

#include "log.h"
#include "obstacles.h"
#include "pilotConnection.h"

extern int debug;

struct pilot_connection_data pc_data;

struct pilot_connection *pc_add_robot(struct robot_config *rc)
{
    struct pilot_connection *retval;
    struct mtp_packet imp;

    assert(rc != NULL);

    retval = &pc_data.pcd_connections[pc_data.pcd_connection_count];
    pc_data.pcd_connection_count += 1;
    
    retval->pc_robot = rc;
    retval->pc_slave.sc_pilot = retval;
    retval->pc_master.mc_pilot = retval;

    if (debug > 1) {
	info("debug: connecting to %s\n", rc->hostname);
    }

#if 1
    mtp_init_packet(&imp,
		    MA_Opcode, MTP_CONTROL_INIT,
		    MA_Role, MTP_ROLE_RMC,
		    MA_Message, "rmcd v0.1",
		    MA_TAG_DONE);
    if ((retval->pc_handle = mtp_create_handle2(rc->hostname,
						PILOT_SERVERPORT,
						NULL)) == NULL) {
	fatal("robot mtp_create_handle");
    }
    else if (mtp_send_packet(retval->pc_handle, &imp) != MTP_PP_SUCCESS) {
	fatal("could not send init packet");
    }
    else {
	retval->pc_flags |= PCF_CONNECTED;
    }
#endif
    
    return retval;
}

void pc_dump_info(void)
{
    int lpc;

    info("info: pilot list\n");
    for (lpc = 0; lpc < pc_data.pcd_connection_count; lpc++) {
	struct pilot_connection *pc;
	
	pc = &pc_data.pcd_connections[lpc];
	info("  %s: flags=0x%x; state=%s; tries=%d\n"
	     "    actual: %.2f %.2f %.2f\tlast:  %.2f %.2f %.2f\n"
	     "    waypt:  %.2f %.2f %.2f %s\n"
	     "    goal:   %.2f %.2f %.2f\n",
	     pc->pc_robot->hostname,
	     pc->pc_flags);
    }
}

struct pilot_connection *pc_find_pilot(int robot_id)
{
    struct pilot_connection *retval = NULL;
    int lpc;
    
    assert(robot_id >= 0);

    for (lpc = 0; (lpc < pc_data.pcd_connection_count) && !retval; lpc++) {
	struct pilot_connection *pc = &pc_data.pcd_connections[lpc];

	if (pc->pc_robot->id == robot_id) {
	    retval = pc;
	}
    }
    
    return retval;
}

void pc_handle_emc_packet(struct pilot_connection *pc, struct mtp_packet *mp)
{
    assert(pc != NULL);
    assert(mp != NULL);

    sc_handle_emc_packet(&pc->pc_slave, mp);
    if (pc->pc_slave.sc_state == SS_IDLE) {
	mc_handle_emc_packet(&pc->pc_master, mp);
    }
    else {
	pc->pc_control_mode = PCM_SLAVE;
    }
}

void pc_handle_pilot_packet(struct pilot_connection *pc, struct mtp_packet *mp)
{
    assert(pc != NULL);
    assert(mp != NULL);
    
    if (debug > 1) {
	fprintf(stderr, "%s pilot packet: ", pc->pc_robot->hostname);
	mtp_print_packet(stderr, mp);
    }

    switch (pc->pc_control_mode) {
    case PCM_SLAVE:
	sc_handle_pilot_packet(&pc->pc_slave, mp);
	if (pc->pc_slave.sc_state == SS_IDLE) {
	    pc->pc_control_mode = PCM_MASTER;
	    mc_handle_switch(&pc->pc_master);
	}
	break;
    case PCM_MASTER:
	mc_handle_pilot_packet(&pc->pc_master, mp);
	break;
    }
}

void pc_handle_signal(fd_set *rready, fd_set *wready)
{
    int lpc;
    
    assert(rready != NULL);
    // assert(wready != NULL);

    for (lpc = 0; lpc < pc_data.pcd_connection_count; lpc++) {
	struct pilot_connection *pc = &pc_data.pcd_connections[lpc];
	mtp_handle_t mh = pc->pc_handle;

	if ((mh != NULL) && FD_ISSET(mh->mh_fd, rready)) {
	    do {
		struct mtp_packet mp;

		if (mtp_receive_packet(mh, &mp) != MTP_PP_SUCCESS) {
		    pc->pc_flags &= ~PCF_CONNECTED;
		    pc->pc_flags |= PCF_CONNECTING;

		    fatal("lost pilot connection");
		}
		else {
		    pc_handle_pilot_packet(pc, &mp);
		}
	    } while ((pc->pc_flags & PCF_CONNECTED) && (mh->mh_remaining > 0));
	}
    }
}

void pc_handle_timeout(struct timeval *current_time)
{
    int lpc;

    assert(current_time != NULL);

    for (lpc = 0; lpc < pc_data.pcd_connection_count; lpc++) {
	struct pilot_connection *pc = &pc_data.pcd_connections[lpc];

	if (pc->pc_control_mode == PCM_MASTER)
	    mc_handle_tick(&pc->pc_master);
    }
}
