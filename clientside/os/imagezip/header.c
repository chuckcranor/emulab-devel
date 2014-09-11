/*
 * Copyright (c) 2014 University of Utah and the Flux Group.
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
#include "imagehdr.h"

/*
 * Utils for manipulating imagezip metadata (headers).
 */

void header_to_std(void *buf)
{
#if _BYTE_ORDER != IZ_BYTE_ORDER
	blockhdr_t *blkhdr = (blockhdr_t *) buf;
	int magic = blkhdr->magic;
	struct region *curregion, *regions;
	int nregion = 0, nreloc = 0, i;

	if (magic < COMPRESSED_V1 || magic > COMPRESSED_V4)
		return;

	nregion = blkhdr->regioncount;
	blkhdr->magic = htoiz32(blkhdr->magic);
	blkhdr->size = htoiz32(blkhdr->size);
	blkhdr->blockindex = htoiz32(blkhdr->blockindex);
	blkhdr->blocktotal = htoiz32(blkhdr->blocktotal);
	blkhdr->regionsize = htoiz32(blkhdr->regionsize);
	blkhdr->regioncount = htoiz32(blkhdr->regioncount);
	if (magic >= COMPRESSED_V2) {
		nreloc = blkhdr->reloccount;
		blkhdr->firstsect = htoiz32(blkhdr->firstsect);
		blkhdr->lastsect = htoiz32(blkhdr->lastsect);
		blkhdr->reloccount = htoiz32(blkhdr->reloccount);
	}
	if (magic >= COMPRESSED_V4) {
		blkhdr->enc_cipher = htoiz16(blkhdr->enc_cipher);
		blkhdr->csum_type = htoiz16(blkhdr->csum_type);
	}

	switch (magic) {
	case COMPRESSED_V1:
		regions = (struct region *)((struct blockhdr_V1 *)blkhdr + 1);
		break;
	case COMPRESSED_V2:
	case COMPRESSED_V3:
		regions = (struct region *)((struct blockhdr_V2 *)blkhdr + 1);
		break;
	case COMPRESSED_V4:
		regions = (struct region *)((struct blockhdr_V4 *)blkhdr + 1);
		break;
	}

	curregion = regions;
	for (i = 0; i < nregion; i++) {
		curregion->start = htoiz32(curregion->start);
		curregion->size = htoiz32(curregion->size);
		curregion++;
	}
	if (nreloc > 0) {
		struct blockreloc *reloc = (struct blockreloc *)curregion;

		for (i = 0; i < nreloc; i++) {
			reloc->type = htoiz32(reloc->type);
			reloc->sector = htoiz32(reloc->sector);
			reloc->sectoff = htoiz32(reloc->sectoff);
			reloc->size = htoiz32(reloc->size);
		}
	}
#endif
}

void header_from_std(void *buf)
{
#if _BYTE_ORDER != IZ_BYTE_ORDER
	blockhdr_t *blkhdr = (blockhdr_t *) buf;
	int magic = iztoh32(blkhdr->magic);
	struct region *curregion, *regions;
	int nregion = 0, nreloc = 0, i;

	/* XXX just return, the caller will also check the magic and fail */
	if (magic < COMPRESSED_V1 || magic > COMPRESSED_V4)
		return;

	blkhdr->magic = iztoh32(blkhdr->magic);
	blkhdr->size = iztoh32(blkhdr->size);
	blkhdr->blockindex = iztoh32(blkhdr->blockindex);
	blkhdr->blocktotal = iztoh32(blkhdr->blocktotal);
	blkhdr->regionsize = iztoh32(blkhdr->regionsize);
	blkhdr->regioncount = iztoh32(blkhdr->regioncount);
	nregion = blkhdr->regioncount;
	if (magic >= COMPRESSED_V2) {
		blkhdr->firstsect = iztoh32(blkhdr->firstsect);
		blkhdr->lastsect = iztoh32(blkhdr->lastsect);
		blkhdr->reloccount = iztoh32(blkhdr->reloccount);
		nreloc = blkhdr->reloccount;
	}
	if (magic >= COMPRESSED_V4) {
		blkhdr->enc_cipher = iztoh16(blkhdr->enc_cipher);
		blkhdr->csum_type = iztoh16(blkhdr->csum_type);
	}

	switch (magic) {
	case COMPRESSED_V1:
		regions = (struct region *)((struct blockhdr_V1 *)blkhdr + 1);
		break;
	case COMPRESSED_V2:
	case COMPRESSED_V3:
		regions = (struct region *)((struct blockhdr_V2 *)blkhdr + 1);
		break;
	case COMPRESSED_V4:
		regions = (struct region *)((struct blockhdr_V4 *)blkhdr + 1);
		break;
	}

	curregion = regions;
	for (i = 0; i < nregion; i++) {
		curregion->start = iztoh32(curregion->start);
		curregion->size = iztoh32(curregion->size);
		curregion++;
	}
	if (nreloc > 0) {
		struct blockreloc *reloc = (struct blockreloc *)curregion;

		for (i = 0; i < nreloc; i++) {
			reloc->type = iztoh32(reloc->type);
			reloc->sector = iztoh32(reloc->sector);
			reloc->sectoff = iztoh32(reloc->sectoff);
			reloc->size = iztoh32(reloc->size);
		}
	}
#endif
}
