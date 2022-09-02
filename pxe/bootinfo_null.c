/*
 * Copyright (c) 2000-2022 University of Utah and the Flux Group.
 * 
 * {{{EMULAB-LICENSE
 * 
 * This file is part of the Emulab network testbed software.
 * 
 * This file is free software: you can redistribute it and/or modify it
 * under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or (at
 * your option) any later version.
 * 
 * This file is distributed in the hope that it will be useful, but WITHOUT
 * ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
 * FITNESS FOR A PARTICULAR PURPOSE.  See the GNU Affero General Public
 * License for more details.
 * 
 * You should have received a copy of the GNU Affero General Public License
 * along with this file.  If not, see <http://www.gnu.org/licenses/>.
 * 
 * }}}
 */

#include <sys/types.h>
#include <netinet/in.h>
#include <stdio.h>

#include "bootwhat.h"
#include "bootinfo.h"

#ifdef USE_NULL_DB

/*
 * For now, hardwired.
 */
#define NETBOOT		"/tftpboot/netboot"
#define MFSBOOT		"/tftpboot/recovery_linux"

int
open_bootinfo_db(void)
{
	return 0;
}

int
findnode_bootinfo_db(struct in_addr ipaddr, int *events)
{
	*events = 0;
	return 1;
}

int
query_bootinfo_db(struct in_addr ipaddr, char *node_id, int version,
		  boot_what_t *info, char* key)
{
#if 0
	info->type  = BIBOOTWHAT_TYPE_MB;
	info->flags = 0;
	info->what.mb.tftp_ip.s_addr = 0;
	strncpy(info->what.mb.filename, NETBOOT, sizeof(info->what.mb.filename));
#endif
#if 0
	info->type  = BIBOOTWHAT_TYPE_SYSID;
	info->flags = 0;
	info->what.sysid = 165; /* BSD */
#endif
#if 1
	info->type  = BIBOOTWHAT_TYPE_MFS;
	info->flags = 0;
	strncpy(info->what.mfs, MFSBOOT, sizeof(info->what.mfs));
#endif
	return 0;
}

int
close_bootinfo_db(void)
{
	return 0;
}
#endif
