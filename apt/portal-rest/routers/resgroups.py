#
# Copyright (c) 2008-2025 University of Utah and the Flux Group.
# 
# {{{GENIPUBLIC-LICENSE
# 
# GENI Public License
# 
# Permission is hereby granted, free of charge, to any person obtaining
# a copy of this software and/or hardware specification (the "Work") to
# deal in the Work without restriction, including without limitation the
# rights to use, copy, modify, merge, publish, distribute, sublicense,
# and/or sell copies of the Work, and to permit persons to whom the Work
# is furnished to do so, subject to the following conditions:
# 
# The above copyright notice and this permission notice shall be
# included in all copies or substantial portions of the Work.
# 
# THE WORK IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
# OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
# MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
# NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
# HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
# WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
# OUT OF OR IN CONNECTION WITH THE WORK OR THE USE OR OTHER DEALINGS
# IN THE WORK.
# 
# }}}
#

import logging
import subprocess, shlex
import tempfile
import os
import re
import json
from enum import Enum

from typing import Annotated, Text, Union
from pydantic import BaseModel, Field
from uuid import UUID, uuid4
from datetime import datetime, time, timedelta

from fastapi import APIRouter, Depends, HTTPException, Header, Response, status
from fastapi import Query, Path, Body
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from sqlalchemy import select, text
from sqlalchemy.orm import Session

from ..database import get_DB
from ..dependencies import get_current_user, TBDatetimeGMT, SUEXEC
from ..dependencies import PortalException, PortalValidate, HandleShellError
from ..api.models import Error
from ..api.models import (
    ResGroup,
    ResGroupError,
    ResGroupNodeType,
    ResGroupRange,
    ResGroupRoute,
    ResGroupList,
    ResGroupNodeTypes,
    ResGroupRanges,
    ResGroupRoutes,
    ResGroupSearch,
    ResGroupSearchResult
)

# Testbed DB access lib
from libdb import *
from WebTask import WebTask
from APT_ORM import AptReservationGroups
import AccessCheck

# pydantic handles uuid,datetime,integer validation
ResGroupValidation = {
    "project"      : "projects:pid:required",
    "group"        : "groups:gid:optional",
    "reason"       : "projects:why:required",
    "powder_zones" : "default:tinytext:optional",
}

ResGroupResValidation = {
    "urn"         : "projects:manager_urn:required",
    "count"       : "default:int:required",
    "nodetype"    : "virt_nodes:type:required",
}

MANAGERESGROUP  = "webmanage_resgroup"

#
# As a Depends() parameter below, get the access check object for an experiment.
#
def get_resgroup_access(resgroup_id):
    try:
        resgroup_access = AccessCheck.ResGroup(str(resgroup_id))
    except Exception as ex:
        raise PortalException(status.HTTP_404_NOT_FOUND, str(ex))
    
    LOG.info("get_resgroup_access: %r: %r", str(resgroup_id), resgroup_access)
    return resgroup_access

LOG = logging.getLogger("uvicorn.error")

router = APIRouter(
    prefix="/resgroups",
    tags=["resgroups"]
)

@router.get("/")
def get_resgroups(
        current_user: Annotated[str, Depends(get_current_user)],
        resgroup_id: UUID = None,
        DB: Session = Depends(get_DB)) -> ResGroupList:
    LOG.info("get_resgroups: args: %r", resgroup_id)
    result = []
    clause = "";

    #
    # Easy thing to do here is just find all the matching experiments and then
    # check permission to generate a list.
    #
    # At the moment, just the current user experiments.
    #
    qres = DBQueryWarn("select uuid from apt_reservation_groups "+
                       "where creator_idx=%s", (current_user.uid_idx,))

    for row in qres:
        uuid = row[0];
        LOG.info("get_resgroups: uuid: %r", uuid)
        result.append(ConstructResGroup(DB, uuid))
        pass
    
    return ResGroupList(resgroups = result)


@router.get("/{resgroup_id}")
def get_resgroup(
        current_user: Annotated[object, Depends(get_current_user)],
        resgroup_id: UUID,
        resgroup_access = Depends(get_resgroup_access),
        DB: Session = Depends(get_DB)) -> ResGroup:

    if not resgroup_access.AccessCheck(
            current_user, AccessCheck.TB_RESGROUP_READ):
        raise PortalException(status.HTTP_401_UNAUTHORIZED, "Not enough permission")
    
    return ConstructResGroup(DB, resgroup_id)


@router.post("/search",
             summary="Search for an available time slot to reserve a group of resources.")
def search_resgroup(
        current_user: Annotated[str, Depends(get_current_user)],
        hours: int,
        resgroup: ResGroupSearch,
        response: Response,
        DB: Session = Depends(get_DB)) -> Union[ResGroupSearchResult, ResGroupError]:
    LOG.info("search_resgroup: args: %r", resgroup)
    try:
        group = AccessCheck.ProjectGroup(resgroup.project, resgroup.group)
    except Exception as ex:
        raise PortalException(status.HTTP_404_NOT_FOUND, str(ex))

    if not group.AccessCheck(current_user, AccessCheck.TB_PROJECT_CREATEEXPT):
        raise PortalException(status.HTTP_401_UNAUTHORIZED, "Not enough permission")

    #
    # manage_resgroups gets 3 dicts, one for each of clusters,ranges,routes
    # Everything else is passed on the command line.
    #
    # We fill in the UUIDs here.
    #
    blob = {
        "clusters" : {},
        "ranges"   : {},
        "routes"   : {},
    }
    clusters = {}
    ranges   = {}
    routes   = {}

    #
    # On this path, fill in uuids. 
    #
    if resgroup.nodetypes:
        for res in resgroup.nodetypes.items:
            # This will raise a validation error
            PortalValidate(res, ResGroupResValidation, strict=False);
        
            id = str(uuid4())
            blob["clusters"][id] = {
                "uuid"    : id,
                "count"   : res.count,
                "type"    : res.nodetype,
                "cluster" : res.urn,
            }
            clusters[id] = res
            pass
        pass

    if resgroup.ranges:
        for res in resgroup.ranges.items:
            # No validation is needed, pydantic handles this one.
            id = str(uuid4())
            blob["ranges"][id] = {
                "uuid"      : id,
                "freq_low"  : res.min_freq,
                "freq_high" : res.max_freq,
            }
            ranges[id] = res
            pass
        pass
    #
    # XXX Need routes!
    #

    jsonFile = None
    with tempfile.NamedTemporaryFile(mode='w+', delete=False) as fp:
        fp.write(json.dumps(blob))
        fp.flush()
        os.chmod(fp.name, 0o644)
        jsonFile = fp.name
        pass

    #
    # Need a WebTask here, for the returning uuid and for errors.
    #
    webtask = WebTask.CreateAnonymous()
    command = MANAGERESGROUP + " -t " + webtask.task_id + " findfirstfit "
    command += "-d " + str(hours) + " "
    command += group.pid + "/" + group.gid + " " + jsonFile

    completed = SUEXEC(current_user, group, command);
    os.unlink(jsonFile)
    
    if completed.returncode != 0:
        webtask.Delete()
        if completed.returncode < 0:
            return HandleShellError(completed)
        # We want a different return code here.
        return HandleShellError(completed, code=status.HTTP_406_NOT_ACCEPTABLE)

    webtask.Refresh()
    start_at = webtask["start"];
    expires_at = webtask["end"]
    webtask.Delete()
    
    # These are GMTs
    return ResGroupSearchResult(
        start_at = start_at,
        expires_at = expires_at
    )

@router.post("/", status_code=status.HTTP_201_CREATED)
def create_resgroup(
        current_user: Annotated[str, Depends(get_current_user)],
        resgroup: ResGroup,
        response: Response,
        DB: Session = Depends(get_DB)) -> Union[ResGroup, ResGroupError]:
    LOG.info("create_resgroup: args: %r", resgroup)
    try:
        group = AccessCheck.ProjectGroup(resgroup.project, resgroup.group)
    except Exception as ex:
        raise PortalException(status.HTTP_404_NOT_FOUND, str(ex))

    if not group.AccessCheck(current_user, AccessCheck.TB_PROJECT_CREATEEXPT):
        raise PortalException(status.HTTP_401_UNAUTHORIZED, "Not enough permission")

    # Start and expires are optional to support search.
    if not resgroup.start_at:
        raise RequestValidationError("Required field 'start_at' not provided")
    
    if not resgroup.expires_at and not resgroup.duration:
        raise RequestValidationError("Must provide 'expires_at' or 'duration'")

    resgroup_id = create_resgroup_shared(current_user, group, resgroup)
    # Status contained in the object sent by the caller.
    if isinstance(resgroup_id, ResGroupError):
        response.status_code = status.HTTP_406_NOT_ACCEPTABLE
        return resgroup_id

    return ConstructResGroup(DB, resgroup_id)

#
# This code is shared with .patch (modify)
#
def create_resgroup_shared(user, group, resgroup, resgroup_id = None):
    # This will raise a validation errora
    PortalValidate(resgroup, ResGroupValidation, strict=False);

    #
    # manage_resgroups gets 3 dicts, one for each of clusters,ranges,routes
    # Everything else is passed on the command line.
    #
    # We fill in the UUIDs here.
    #
    blob = {
        "clusters" : {},
        "ranges"   : {},
        "routes"   : {},
    }
    clusters = {}
    ranges   = {}
    routes   = {}

    #
    # On this path, fill in uuids. 
    #
    if resgroup.nodetypes:
        for res in resgroup.nodetypes.items:
            # This will raise a validation error
            PortalValidate(res, ResGroupResValidation, strict=False);
        
            id = str(uuid4())
            blob["clusters"][id] = {
                "uuid"    : id,
                "count"   : res.count,
                "type"    : res.nodetype,
                "cluster" : res.urn,
            }
            clusters[id] = res
            pass
        pass

    if resgroup.ranges:
        for res in resgroup.ranges.items:
            # No validation is needed, pydantic handles this one.
            id = str(uuid4())
            blob["ranges"][id] = {
                "uuid"      : id,
                "freq_low"  : res.min_freq,
                "freq_high" : res.max_freq,
            }
            ranges[id] = res
            pass
        pass

    #
    # XXX Need routes!
    #

    #
    # Need a WebTask here, for the returning uuid and for errors.
    #
    webtask = WebTask.CreateAnonymous()
    command = MANAGERESGROUP + " -t " + webtask.task_id + " reserve "
    options = ""

    # Start can be null, means start now.
    if resgroup.start_at:
        options += " -s " + str(int(resgroup.start_at.timestamp()))
        pass

    expires = None
    if resgroup.expires_at:
        expires = int(resgroup.expires_at.timestamp())
    elif resgroup.duration:
        if resgroup.start_at:
            expires = (int(resgroup.start_at.timestamp()) +
                       (3600 * resgroup.duration))
        else:
            expires = time.time() + (3600 * resgroup.duration)
            pass
    else:
        raise RequestValidationError("Must provide an expiration or duration")
    options += " -e " + str(expires)

    if resgroup.powder_zones:
        options += " -Z '" + resgroup.powder_zones + "'"
        pass

    reasonFile = None
    with tempfile.NamedTemporaryFile(mode='w+', delete=False) as fp:
        fp.write(resgroup.reason)
        fp.flush()
        os.chmod(fp.name, 0o644)
        reasonFile = fp.name
        pass
    options += " -N " + reasonFile

    jsonFile = None
    with tempfile.NamedTemporaryFile(mode='w+', delete=False) as fp:
        fp.write(json.dumps(blob))
        fp.flush()
        os.chmod(fp.name, 0o644)
        jsonFile = fp.name
        pass
    args = group.pid + "/" + group.gid + " " + jsonFile
    
    checkonly = command + " -n " + options + " " + args
    command   = command + options + " " + args

    # Checkonly mode. No zero exit is unusual. Actual status are in the
    # return results
    completed = SUEXEC(user, group, checkonly);
    if completed.returncode != 0:
        webtask.Delete()
        if reasonFile:
            os.unlink(reasonFile)
            pass
        #os.unlink(jsonFile)
        return HandleShellError(completed)

    webtask.Refresh()
    results = webtask["results"];

    #
    # Well, this is fun. The return results are associated with each of
    # the three arrays. If anything is an error then we bail completely.
    #
    errors = 0
    for uuid,res in results["cluster_results"]["clusters"].items():
        if "errcode" in res:
            clusters[uuid].errorCode = res["errcode"]
            errors = errors + 1
            pass
        if "output" in res:
            clusters[uuid].error = res["output"]
            pass
        pass
    for uuid,res in results["range_results"]["ranges"].items():
        if "errcode" in res:
            ranges[uuid].errorCode = res["errcode"]
            errors = errors + 1
            pass
        if "output" in res:
            ranges[uuid].error = res["output"]
            pass
        pass
    if errors:
        webtask.Delete()
        if reasonFile:
            os.unlink(reasonFile)
            pass
        #os.unlink(jsonFile)
        return ResGroupError(
            error = "There are %d issues with this reservation group" % errors,
            errorCode = 1,
            clusters = ResGroupNodeTypes(items=list(clusters.values())),
            ranges = ResGroupRanges(items=list(ranges.values())),
            routes = ResGroupRoutes(items=list(routes.values())))

    #
    # OK, do it for real. 
    #
    webtask.Reset()
    completed = SUEXEC(user, group, command);
    if completed.returncode != 0:
        webtask.Delete()
        if reasonFile:
            os.unlink(reasonFile)
            pass
        os.unlink(jsonFile)
        return HandleShellError(completed)

    webtask.Refresh()
    results = webtask["results"];
    resgroup_uuid = results["uuid"]
    webtask.Delete()
    return resgroup_uuid


@router.put("/{resgroup_id}",
            summary="Modify a reservation group")
def update_resgroup(
        current_user: Annotated[str, Depends(get_current_user)],
        resgroup_id: UUID,
        resgroup: ResGroup,
        resgroup_access = Depends(get_resgroup_access),
        DB: Session = Depends(get_DB)) -> ResGroup:
    LOG.info("update_resgroup: args: %r, %r", resgroup_id, resgroup)

    if not resgroup_access.AccessCheck(
            current_user, AccessCheck.TB_RESGROUP_MODIFY):
        raise PortalException(status.HTTP_401_UNAUTHORIZED, "Not enough permission")

    create_resgroup_shared(current_user,
                           resgroup_access.group, resgroup, resgroup_id)
    return ConstructResGroup(DB, resgroup_id)

@router.post("/{resgroup_id}/reservations", status_code=status.HTTP_201_CREATED)
def add_resgroup_reservation(
        current_user: Annotated[str, Depends(get_current_user)],
        resgroup_id: UUID,
        reservation: Union[ResGroupNodeType, ResGroupRange],
        resgroup_access = Depends(get_resgroup_access),
        DB: Session = Depends(get_DB)) -> ResGroup:
    LOG.info("add_resgroup_reservation: args: %r %r", resgroup_id, reservation)
    
    return ConstructResGroup(DB, resgroup_id)
    pass

@router.put("/{resgroup_id}/reservations/{reservation_id}")
def update_resgroup_reservation(
        current_user: Annotated[str, Depends(get_current_user)],
        resgroup_id: UUID,
        reservation_id: UUID,
        reservation: Union[ResGroupNodeType, ResGroupRange],
        resgroup_access = Depends(get_resgroup_access),
        DB: Session = Depends(get_DB)) -> ResGroup:
    LOG.info("update_resgroup_reservation: args: %r %r %r",
             resgroup_id, reservation_id, reservation)
    
    return ConstructResGroup(DB, resgroup_id)
    pass

@router.delete("/{resgroup_id}/reservations/{reservation_id}",
               status_code=status.HTTP_204_NO_CONTENT)
def delete_resgroup_reservation(
        current_user: Annotated[str, Depends(get_current_user)],
        resgroup_id: UUID,
        reservation_id: UUID,
        resgroup_access = Depends(get_resgroup_access),
        DB: Session = Depends(get_DB)):
    LOG.info("delete_resgroup_reservation: args: %r %r", resgroup_id, reservation_id)
    
    if not resgroup_access.AccessCheck(
            current_user, AccessCheck.TB_RESGROUP_MODIFY):
        raise PortalException(status.HTTP_401_UNAUTHORIZED, "Not enough permission")

    # Lets check that the reservation_id is valid
    if not getResgroupReservation(DB, resgroup_id, reservation_id):
        raise PortalException(status.HTTP_404_NOT_FOUND,
                              "No such reservation_id in reservation group")

    command = MANAGERESGROUP + " delete " + str(resgroup_id)
    command += " " + str(reservation_id)
    completed = SUEXEC(current_user, resgroup_access.group, command)

    if completed.returncode != 0:
        return HandleShellError(completed)

    pass

@router.delete("/{resgroup_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_resgroup(
        current_user: Annotated[str, Depends(get_current_user)],
        resgroup_id: UUID,
        resgroup_access = Depends(get_resgroup_access),
        DB: Session = Depends(get_DB)):
    LOG.info("delete_resgroup: args: %r", resgroup_id)
    
    if not resgroup_access.AccessCheck(
            current_user, AccessCheck.TB_RESGROUP_MODIFY):
        raise PortalException(status.HTTP_401_UNAUTHORIZED, "Not enough permission")

    command = MANAGERESGROUP + " delete " + str(resgroup_id)
    completed = SUEXEC(current_user, resgroup_access.group, command)

    if completed.returncode != 0:
        return HandleShellError(completed)

    pass

#
# Find a reservation inside a resgroup. This is cumbersome cause of the
# Emulab table design. 
#
def getResgroupReservation(DB: Session, resgroup_id, reservation_id):
    stmt = select(AptReservationGroups).where(text("uuid = :id"))
    row = DB.execute(stmt, {'id': resgroup_id}).first()
    if not row:
        raise HTTPException(
            status_code=404, detail="No such resgroup"
        )            
    resgroup = row.AptReservationGroups
    if resgroup.reservations:
        for res in resgroup.reservations:
            if str(res.remote_uuid) == str(reservation_id):
                return res
            pass
        pass
    if resgroup.ranges:
        for res in resgroup.ranges:
            if str(res.freq_uuid) == str(reservation_id):
                return res
            pass
        pass

    return None

#
# Construct a Resgroup that matches the openapi description.
#
def ConstructResGroup(DB: Session, resgroup_id, elaborate=True):
    stmt = select(AptReservationGroups).where(text("uuid = :id"))
    row = DB.execute(stmt, {'id': resgroup_id}).first()
    if not row:
        raise HTTPException(
            status_code=404, detail="No such resgroup"
        )            
    print(str(row))
    resgroup = row.AptReservationGroups
    
    rval = ResGroup(
        id = resgroup.uuid,
        reason = resgroup.reason,
        project = resgroup.pid,
        group = resgroup.gid,
        creator = resgroup.creator_uid,
        created_at = TBDatetimeGMT(resgroup.created),
        start_at = TBDatetimeGMT(resgroup.start),
        expires_at = TBDatetimeGMT(resgroup.end))

    if elaborate == True:
        if resgroup.reservations:
            nodetypes = []
        
            for res in resgroup.reservations:
                nodetypes.append(ResGroupNodeType(
                    resgroup_id=res.uuid,
                    reservation_id=res.remote_uuid,
                    urn=res.aggregate_urn,
                    nodetype=res.type,
                    count=res.count,
                    approved_at=TBDatetimeGMT(res.approved),
                    canceled_at=TBDatetimeGMT(res.canceled),
                    deleted_at=TBDatetimeGMT(res.deleted),
                ))
                pass
            rval.nodetypes = ResGroupNodeTypes(items=nodetypes)
            pass

        if resgroup.ranges:
            ranges = []

            for res in resgroup.ranges:
                ranges.append(ResGroupRange(
                    resgroup_id=res.uuid,
                    reservation_id=res.freq_uuid,
                    min_freq=res.freq_low,
                    max_freq=res.freq_high,
                    approved_at=TBDatetimeGMT(res.approved),
                    canceled_at=TBDatetimeGMT(res.canceled)
                ))
                pass
            rval.ranges = ResGroupRanges(items=ranges)
            pass
        pass
    print(str(rval))
    return rval

