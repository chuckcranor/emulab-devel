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
#include <stdio.h>
#include <stdlib.h>
#include <unistd.h>
#include "sliceinfo.h"
#include "global.h"

static struct sliceinfo fsmap[] = {
	{ IZTYPE_UNUSED,	"UNUSED",	0 },
#ifdef WITH_GPT
	{ IZTYPE_BIOSBOOT,	"BIOS Boot",	read_rawslice },
	{ IZTYPE_FBSDBOOT,	"FreeBSD Boot",	read_rawslice },
	{ IZTYPE_FBSDSWAP,	"FreeBSD Swap",	read_bsdswapslice },
#endif
#ifdef WITH_FFS
	{ IZTYPE_386BSD,	"FreeBSD UFS1/2",	   read_bsdslice },
	{ IZTYPE_FBSDNOLABEL,	"FreeBSD UFS1/2 no label", read_bsdslicenl },
	{ IZTYPE_OPENBSD,	"OpenBSD FFS",		   read_bsdslice },
#endif
#ifdef WITH_EXTFS
	{ IZTYPE_LINUX,		"Linux EXT2/3/4",	read_linuxslice },
	{ IZTYPE_LINSWP,	"Linux Swap",		read_linuxswap },
#endif
#ifdef WITH_NTFS
	{ IZTYPE_NTFS,		"NTFS",		read_ntfsslice },
#endif
#ifdef WITH_FAT
	{ IZTYPE_FAT12,		"FAT12",	read_fatslice },
	{ IZTYPE_FAT16,		"FAT16",	read_fatslice },
	{ IZTYPE_FAT16L,	"FAT16L",	read_fatslice },
	{ IZTYPE_FAT16L_LBA,	"FAT16 LBA",	read_fatslice },
	{ IZTYPE_FAT32,		"FAT32",	read_fatslice },
	{ IZTYPE_FAT32_LBA,	"FAT32 LBA",	read_fatslice },
	{ IZTYPE_EFISYSTEM,	"EFI System (FAT)",	read_fatslice },
#endif
	{ IZTYPE_EXT,		"DOSEXT",	0 },
	{ IZTYPE_EXT_LBA,	"DOSEXT LBA",	0 },
	{ IZTYPE_INVALID,	"",		0 },
};

struct sliceinfo *
getslicemap(iz_type stype)
{
	struct sliceinfo *sinfo;

	for (sinfo = fsmap; sinfo->type != IZTYPE_INVALID; sinfo++)
		if (sinfo->type == stype)
			return sinfo;
	return 0;
}

void
printslicemap(void)
{
	int i;

	for (i = 1; fsmap[i].type != IZTYPE_INVALID; i++)
		if (fsmap[i].process != 0) {
			fprintf(stderr, "%s%s", i > 1 ? "," : "",
				fsmap[i].desc);
		}
}

void
dumpdiskinfo(struct iz_disk *disk)
{
	int i;
	char *bbstr = (disk->metasect > 0) ? "GPT" : "MBR";
	struct iz_slice	*parttab = disk->slices;

	fprintf(stderr, "Disk:            start %12u, size %12lu\n",
		0, (unsigned long)disk->dsize);
	fprintf(stderr, "Usable:          start %12lu, size %12lu\n",
		(unsigned long)disk->lodata,
		(unsigned long)disk->hidata - disk->lodata + 1);
	fprintf(stderr, "Partition range: start %12lu, size %12lu\n",
		(unsigned long)disk->losect,
		(unsigned long)disk->hisect - disk->losect + 1);
	fprintf(stderr, "%s Partitions (%s at lba %lu):\n",
		bbstr, bbstr, disk->metasect);
	for (i = 0; i < MAXSLICES; i++) {
		struct sliceinfo *sinfo;

		if (parttab[i].type == IZTYPE_INVALID)
			continue;

		fprintf(stderr, "  P%d: ", i+1);
		sinfo = getslicemap(parttab[i].type);
		if (sinfo == 0)
			fprintf(stderr, "0x%x", parttab[i].type);
		else
			fprintf(stderr, "%-12s", sinfo->desc);

		fprintf(stderr, "  start %12lu, size %12lu",
			(unsigned long)parttab[i].offset,
			(unsigned long)parttab[i].size);
		if (parttab[i].flags) {
			fprintf(stderr, " (");
			if (parttab[i].flags & IZFLAG_NOTSUP)
				fprintf(stderr, "Not supported,");
			if (parttab[i].flags & IZFLAG_IGNORE)
				fprintf(stderr, "IGNORED,");
			if (parttab[i].flags & IZFLAG_RAW)
				fprintf(stderr, "compress RAW");
			fprintf(stderr, ")\n");
		} else {
			fprintf(stderr, "\n");
		}
	}
	fprintf(stderr, "\n");
}
