
#include "config.h"

#include <math.h>
#include <stdio.h>
#include <stdarg.h>
#include <assert.h>

#include "pilotConnection.h"
#include "slaveController.h"

static int sc_pass_update(struct slave_controller *sc, mtp_packet_t *mp)
{
    mtp_packet_t wmp;
    mtp_status_t ms;
    int retval = 0;
    
    assert(sc != NULL);
    assert(mp != NULL);

    ms = mp->data.mtp_payload_u.update_position.status;
    switch (ms) {
    case MTP_POSITION_STATUS_ABORTED:
	if (sc->sc_state == SS_START_WIGGLING)
	    ms = MTP_POSITION_STATUS_IDLE;
	break;
    case MTP_POSITION_STATUS_ERROR:
    case MTP_POSITION_STATUS_CONTACT:
	sc->sc_flags |= SCF_REVERSE;
	break;
    default:
	break;
    }
    
    mtp_init_packet(&wmp,
		    MA_Opcode, MTP_WIGGLE_STATUS,
		    MA_Role, MTP_ROLE_RMC,
		    MA_RobotID, sc->sc_pilot->pc_robot->id,
		    MA_Status, ms,
		    MA_TAG_DONE);
    mtp_send_packet(pc_data.pcd_emc_handle, &wmp);

    if (sc->sc_state == SS_WIGGLING) {
	sc->sc_state = SS_IDLE;
    }
    
    return retval;
}

int sc_handle_pilot_packet(struct slave_controller *sc, mtp_packet_t *mp)
{
    int rc, retval = 0;

    assert(sc != NULL);
    assert(mp != NULL);

    rc = mtp_dispatch(sc, mp,
		      MD_Integer, sc->sc_state,
		      
		      MD_OR | MD_OnInteger, SS_START_WIGGLING,
		      MD_OnInteger, SS_WIGGLING,
		      MD_OnOpcode, MTP_UPDATE_POSITION,
		      MD_Call, sc_pass_update,

		      MD_TAG_DONE);
    
    return retval;
}


static int sc_start_wiggling(struct slave_controller *sc, mtp_packet_t *mp)
{
    mtp_packet_t smp;
    int retval = 0;
    
    assert(sc != NULL);
    assert(mp != NULL);

    mtp_init_packet(&smp,
		    MA_Opcode, MTP_COMMAND_STOP,
		    MA_Role, MTP_ROLE_RMC,
		    MA_RobotID, sc->sc_pilot->pc_robot->id,
		    MA_CommandID, SLAVE_COMMAND_ID,
		    MA_TAG_DONE);
    mtp_send_packet(sc->sc_pilot->pc_handle, &smp);

    sc->sc_state = SS_START_WIGGLING;
    
    return retval;
}

static int sc_wiggling(struct slave_controller *sc, mtp_packet_t *mp)
{
    mtp_packet_t gmp;
    int retval = 0;
    
    assert(sc != NULL);
    assert(mp != NULL);

    mtp_init_packet(&gmp,
		    MA_Opcode, MTP_COMMAND_GOTO,
		    MA_Role, MTP_ROLE_RMC,
		    MA_RobotID, sc->sc_pilot->pc_robot->id,
		    MA_CommandID, SLAVE_COMMAND_ID,
		    MA_Theta, (sc->sc_flags & SCF_REVERSE) ? -M_PI : M_PI,
		    MA_TAG_DONE);
    mtp_send_packet(sc->sc_pilot->pc_handle, &gmp);

    sc->sc_state = SS_WIGGLING;
    sc->sc_flags &= ~SCF_REVERSE;
    
    return retval;
}

int sc_handle_emc_packet(struct slave_controller *sc, mtp_packet_t *mp)
{
    int rc, retval = 0;

    assert(sc != NULL);
    assert(mp != NULL);

    rc = mtp_dispatch(sc, mp,
		      MD_Integer, sc->sc_state,
		      
		      MD_OnInteger, SS_IDLE,
		      MD_OnOpcode, MTP_WIGGLE_REQUEST,
		      MD_OnWiggleType, MTP_WIGGLE_START,
		      MD_Call, sc_start_wiggling,

		      MD_OnInteger, SS_START_WIGGLING,
		      MD_OnOpcode, MTP_WIGGLE_REQUEST,
		      MD_OnWiggleType, MTP_WIGGLE_180_R,
		      MD_Call, sc_wiggling,

		      MD_TAG_DONE);
    
    return retval;
}
