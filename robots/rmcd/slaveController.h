
#ifndef _rmcd_slave_controller_h
#define _rmcd_slave_controller_h

#include "mtp.h"

struct pilot_connection;

typedef enum {
    SS_IDLE,
    SS_START_WIGGLING,
    SS_WIGGLING,

    SS_MAX
} slave_state_t;

enum {
    SCB_REVERSE,
};

enum {
    SCF_REVERSE = (1L << SCB_REVERSE),
};

struct slave_controller {
    struct pilot_connection *sc_pilot;
    slave_state_t sc_state;
    unsigned long sc_flags;
};

int sc_handle_pilot_packet(struct slave_controller *sc, mtp_packet_t *mp);
int sc_handle_emc_packet(struct slave_controller *sc, mtp_packet_t *mp);

#endif
