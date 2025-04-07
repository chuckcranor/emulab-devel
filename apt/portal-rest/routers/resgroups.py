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
    ResGroupReservation,
    ResGroupRange,
    ResGroupRoute,
    ResGroupList,
    ResGroupReservationList,
    ResGroupRangeList,
    ResGroupRouteList,
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
    LOG.info("get_resgroups: current_user: %r", current_user)
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


@router.post("/", status_code=status.HTTP_201_CREATED)
def create_resgroup(
        current_user: Annotated[str, Depends(get_current_user)],
        resgroup: ResGroup,
        response: Response,
        DB: Session = Depends(get_DB)) -> Union[ResGroup, ResGroupError]:
    LOG.info("delete_resgroups: current_user: %r", current_user)
    LOG.info("create_resgroup: args: %r", resgroup)
    try:
        group = AccessCheck.ProjectGroup(resgroup.project, resgroup.group)
    except Exception as ex:
        raise PortalException(status.HTTP_404_NOT_FOUND, str(ex))

    if not group.AccessCheck(current_user, AccessCheck.TB_PROJECT_CREATEEXPT):
        raise PortalException(status.HTTP_401_UNAUTHORIZED, "Not enough permission")

    resgroup = create_resgroup_shared(current_user, group, resgroup)
    # Status contained in the object sent by the caller.
    if isinstance(resgroup, ResGroupError):
        response.status_code = status.HTTP_406_NOT_ACCEPTABLE
        return resgroup

    return ConstructResGroup(DB, resgroup)

#
# This code is shared with .patch (modify)
#
def create_resgroup_shared(user, group, resgroup, resgroup_id = None):
    # This will raise a validation error
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
    for res in resgroup.clusters.root:
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

    for res in resgroup.ranges.root:
        id = str(uuid4())
        blob["ranges"][id] = {
            "uuid"      : id,
            "freq_low"  : res.min_freq,
            "freq_high" : res.max_freq,
        }
        ranges[id] = res
        pass

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

    if not resgroup.expires_at:
        raise RequestValidationError("Must provide an expiration")
    else:
        options += " -e " + str(int(resgroup.expires_at.timestamp()))
        pass

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
    args = resgroup.project + "/" + resgroup.group + " " + jsonFile
    
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
        os.unlink(jsonFile)
        return HandleShellError(completed)

    webtask.Refresh()
    results = webtask["results"];

    #
    # Well, this is fun. The return results are associated with each of
    # the three arrays. If anything is an error then we bail completely.
    #
    errors = 0
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
        os.unlink(jsonFile)
        return ResGroupError(
            error = "There are %d issues with this reservation group" % errors,
            errorCode = 1,
            clusters = ResGroupReservationList(root=list(clusters.values())),
            ranges = ResGroupRangeList(root=list(ranges.values())),
            routes = ResGroupRouteList(root=list(routes.values())))

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
    resgroup_id = results["uuid"]
    
    webtask.Delete()
    return resgroup


@router.put("/{resgroup_id}",
            summary="Modify a reservation group")
def update_resgroup(
        current_user: Annotated[str, Depends(get_current_user)],
        resgroup_id: UUID,
        resgroup: ResGroup,
        resgroup_access = Depends(get_resgroup_access),
        DB: Session = Depends(get_DB)) -> ResGroup:
    LOG.info("update_resgroup: current_user: %r", current_user)
    LOG.info("update_resgroup: args: %r, %r", resgroup_id, resgroup)

    if not resgroup_access.AccessCheck(
            current_user, AccessCheck.TB_RESGROUP_MODIFY):
        raise PortalException(status.HTTP_401_UNAUTHORIZED, "Not enough permission")

    create_resgroup_shared(current_user,
                           resgroup_access.group, resgroup, resgroup_id)
    return ConstructResGroup(DB, resgroup_id)


@router.delete("/{resgroup_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_resgroup(
        current_user: Annotated[str, Depends(get_current_user)],
        resgroup_id: UUID,
        resgroup_access = Depends(get_resgroup_access),
        DB: Session = Depends(get_DB)):
    LOG.info("delete_resgroup: current_user: %r", current_user)
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

    clusters = []
    ranges   = []
    routes   = []
        
    if elaborate == True:
        for res in resgroup.reservations:
            clusters.append(ResGroupReservation(
                resgroup_id=res.uuid,
                urn=res.aggregate_urn,
                remote_id=res.remote_uuid,
                nodetype=res.type,
                count=res.count,
                approved_at=TBDatetimeGMT(res.approved),
                canceled_at=TBDatetimeGMT(res.canceled),
                deleted_at=TBDatetimeGMT(res.deleted),
            ))
            pass
        for res in resgroup.ranges:
            ranges.append(ResGroupRange(
                resgroup_id=res.uuid,
                range_id=res.freq_uuid,
                min_freq=res.freq_low,
                max_freq=res.freq_high,
                approved_at=TBDatetimeGMT(res.approved),
                canceled_at=TBDatetimeGMT(res.canceled),
            ))
            pass
        for res in resgroup.routes:
            ranges.append(ResGroupRoute(
                resgroup_id=res.uuid,
                route_id=route_uuid,
                route_name=routename,
                approved_at=TBDatetimeGMT(res.approved),
                canceled_at=TBDatetimeGMT(res.canceled),
            ))
            pass
        pass
    
    #
    # Use the model to create the return value
    #
    resgroup = ResGroup(
        id = resgroup.uuid,
        reason = resgroup.reason,
        project = resgroup.pid,
        group = resgroup.gid,
        creator = resgroup.creator_uid,
        created_at = TBDatetimeGMT(resgroup.created),
        start_at = TBDatetimeGMT(resgroup.start),
        expires_at = TBDatetimeGMT(resgroup.end),
        clusters = ResGroupReservationList(root=clusters),
        ranges = ResGroupRangeList(root=ranges),
        routes = ResGroupRouteList(root=routes),
    )
    return resgroup

