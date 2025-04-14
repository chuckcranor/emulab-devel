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
from pydantic import BaseModel, Field, AnyUrl
from uuid import UUID
from datetime import datetime, time, timedelta

from fastapi import APIRouter, Depends, HTTPException, Header, Response, status
from fastapi import Query, Path, Body
from fastapi.exceptions import RequestValidationError

from sqlalchemy import select, text
from sqlalchemy.orm import Session

from ..database import get_DB
from ..dependencies import get_current_user, TBDatetimeGMT, SUEXEC
from ..dependencies import PortalException, PortalValidate, HandleShellError
from ..api.models import Error
from ..api.models import Experiment, ExperimentList, ManifestArray
from ..api.models import ExperimentModify, ExperimentCreate
from ..api.models import AggregateStatus
from ..api.models import AggregateNode

# Testbed DB access lib
from libdb import *
from WebTask import WebTask
from APT_ORM import AptInstances
import AccessCheck

# pydantic handles uuid,datetime,integer validation
ExperimentValidation = {
    "project"          : "projects:pid:required",
    "group"            : "groups:gid:optional",
    "name"             : "experiments:eid:required",
    "profile_project"  : "projects:pid:required",
    "profile_name"     : "apt_profiles:name:required",
    "paramset_name"    : "apt_profiles:name:optional",
    "paramset_owner"   : "users:uid:optional",
    "duration"         : "default:int:optional",
    "start_at"         : None,
    "expires_at"       : None,
    "refspec"          : "default:tinytext:optional",
    "bindings"         : None,
}

#
# Standard operations to apply to experiment nodes or a single node.
#
class NodeOps(str, Enum):
    reboot     = "reboot"
    reload     = "reload"
    stop       = "stop"
    start      = "start"
    powercycle = "powercycle"
    pass

#
# As a Depends() parameter below, get the access check object for an experiment.
#
def get_experiment_access(experiment_id):
    try:
        experiment_access = AccessCheck.Experiment(str(experiment_id))
    except Exception as ex:
        raise PortalException(status.HTTP_404_NOT_FOUND, str(ex))
    
    LOG.info("get_experiment_access: %r: %r", str(experiment_id), experiment_access)
    return experiment_access

#
# As a Depends() parameter below, validate that experiment_id is a UUID or pid,name
#
def check_experiment_id(experiment_id):
    LOG.info("check_experiment_id %r", str(experiment_id))

    if match := re.match("^([\-\w]+),([\-\w]+)$", experiment_id):
        qres = DBQueryWarn("select uuid from apt_instances "+
                           "where pid=%s and name=%s",
                           (match[1], match[2]))
        if qres == None or len(qres) != 1:
            raise PortalException(
                status.HTTP_404_NOTFOUND, "No such experiment")
        row = qres[0]
        return row[0]

    try:
        foo = str(UUID(str(experiment_id))) == str(experiment_id)
    except Exception as ex:
        raise RequestValidationError(
            "Validation error for experiment_id, not a valid UUID")
    
    return experiment_id

#
# Check admission control (load average, too many waiting)
#
def checkAdmissionControl():
    load1,load5,load15 = os.getloadavg()
    if load1 > 15:
        raise PortalException(
            status.HTTP_429_TOO_MANY_REQUESTS,
            "Load average to high: " + str(load1))

    qres = DBQueryFatal("select value from emulab_locks " +
                        "where name='create_instance_lock'");

    if qres == None or len(qres) != 1:
        raise PortalException(
            status.HTTP_500_INTERNAL_SERVER_ERROR, "Internal server error")

    row = qres[0]
    count = row[0]
    if count > 10:
        raise PortalException(
            status.HTTP_429_TOO_MANY_REQUESTS,
            "Too many experiments waiting: " + str(count))
    pass


#
# This needs to be configured.
#
STARTEXPT      = "webstart-experiment "
MODIFYEXPT     = "webmodify-experiment "
MANAGEINSTANCE = "webmanage_instance "
EXTENDEXPT     = MANAGEINSTANCE + " extend "
STOPEXPT       = MANAGEINSTANCE + " terminate "
CONNECTLAN     = MANAGEINSTANCE + " connectsharedlan "

LOG = logging.getLogger("uvicorn.error")

router = APIRouter(
    prefix="/experiments",
    tags=["experiments"]
)

@router.get("/")
def get_experiments(
        current_user: Annotated[str, Depends(get_current_user)],
        experiment_id: UUID = None,
        creator: str = None,
        project: str = None,
        DB: Session = Depends(get_DB)) -> ExperimentList:
    LOG.info("get_experiments: current_user: %r", current_user)
    LOG.info("get_experiments: args: %r, %r, %r", experiment_id, creator, project)
    result = []
    clause = "";

    #
    # Easy thing to do here is just find all the matching experiments and then
    # check permission to generate a list.
    #
    # At the moment, just the current user experiments.
    #
    qres = DBQueryWarn("select uuid from apt_instances "+
                       "where creator_idx=%s", (current_user.uid_idx,))

    for row in qres:
        uuid = row[0];
        LOG.info("get_experiments: uuid: %r", uuid)
        result.append(ConstructExperiment(DB, uuid))
        pass
    
    return ExperimentList(experiments = result)

@router.get("/{experiment_id}")
def get_experiment(
        current_user: Annotated[object, Depends(get_current_user)],
        experiment_id: Annotated[str, Depends(check_experiment_id)],
        experiment_access = Depends(get_experiment_access),
        DB: Session = Depends(get_DB)) -> Experiment:

    if not experiment_access.AccessCheck(
            current_user, AccessCheck.TB_EXPT_READINFO):
        raise PortalException(status.HTTP_401_UNAUTHORIZED, "Not enough permission")
    
    return ConstructExperiment(DB, experiment_id)


#
# At the moment, the only update is "extend"
#
@router.put("/{experiment_id}",
            summary="Extend an experiment")
def update_experiment(
        current_user: Annotated[str, Depends(get_current_user)],
        experiment_id: Annotated[str, Depends(check_experiment_id)],
        expires_at: Annotated[datetime, Query()],
        experiment_access = Depends(get_experiment_access),
        DB: Session = Depends(get_DB)) -> Experiment:
    LOG.info("update_experiment: args: %r, %r", experiment_id, expires_at)

    if not experiment_access.AccessCheck(
            current_user, AccessCheck.TB_EXPT_READINFO):
        raise PortalException(status.HTTP_401_UNAUTHORIZED, "Not enough permission")

    command = EXTENDEXPT + " " + str(experiment_id)
    command += " -m '" + "Experiment extended via the REST API" + "'"
    command += " '" + str(expires_at) + "'"

    completed = SUEXEC(current_user, experiment_access.group, command)
    LOG.info(completed)
    if completed.returncode != 0:
        return HandleShellError(completed)

    return ConstructExperiment(DB, experiment_id)


@router.post("/experiments/{experiment_id}/vlan/{source_lan}/connect",
             status_code=status.HTTP_204_NO_CONTENT)
def connect_experiment_vlan(
        current_user: Annotated[str, Depends(get_current_user)],
        experiment_id: Annotated[str, Depends(check_experiment_id)],
        source_lan: Annotated[str, Path(pattern="^[-\w]+$")],
        target_id: str,
        target_lan: Annotated[str, Query(pattern="^[-\w]+$")],
        experiment_access = Depends(get_experiment_access),
        DB: Session = Depends(get_DB)):
    LOG.info("connect_experiment_vlan: args: %r,%r %r,%r",
             experiment_id, source_lan, target_id, target_lan)

    # This will throw a validation error.
    check_experiment_id(target_id)

    if not experiment_access.AccessCheck(
            current_user, AccessCheck.TB_EXPT_MODIFY):
        raise PortalException(status.HTTP_401_UNAUTHORIZED, "Not enough permission")

    command = CONNECTLAN + " " + str(experiment_id) + " " + str(source_lan) + " "
    command += str(target_id) + " " + str(target_lan) + " "

    completed = SUEXEC(current_user, experiment_access.group, command)
    LOG.info(completed)
    if completed.returncode != 0:
        return HandleShellError(completed)

    pass


@router.post("/experiments/{experiment_id}/vlan/{source_lan}/disconnect",
             status_code=status.HTTP_204_NO_CONTENT)
def disconnect_experiment_vlan(
        current_user: Annotated[str, Depends(get_current_user)],
        experiment_id: Annotated[str, Depends(check_experiment_id)],
        source_lan: Annotated[str, Path(pattern="^[-\w]+$")],
        experiment_access = Depends(get_experiment_access),
        DB: Session = Depends(get_DB)):
    LOG.info("disconnect_experiment_vlan: args: %r, %r", experiment_id, source_lan)

    if not experiment_access.AccessCheck(
            current_user, AccessCheck.TB_EXPT_MODIFY):
        raise PortalException(status.HTTP_401_UNAUTHORIZED, "Not enough permission")

    command = CONNECTLAN + " " + str(experiment_id) + " -r " + str(source_lan)
    
    completed = SUEXEC(current_user, experiment_access.group, command)
    LOG.info(completed)
    if completed.returncode != 0:
        return HandleShellError(completed)

    pass


@router.delete("/{experiment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_experiment(
        current_user: Annotated[str, Depends(get_current_user)],
        experiment_id: Annotated[str, Depends(check_experiment_id)],
        experiment_access = Depends(get_experiment_access),
        DB: Session = Depends(get_DB)):
    
    if not experiment_access.AccessCheck(
            current_user, AccessCheck.TB_EXPT_READINFO):
        raise PortalException(status.HTTP_401_UNAUTHORIZED, "Not enough permission")
    
    command = STOPEXPT + " " + str(experiment_id);
    completed = SUEXEC(current_user, experiment_access.group, command)
    LOG.info(completed)
    if completed.returncode != 0:
        return HandleShellError(completed)

    pass


@router.post("/", status_code=status.HTTP_201_CREATED)
def create_experiment(
        current_user: Annotated[str, Depends(get_current_user)],
        create: ExperimentCreate = None,
        DB: Session = Depends(get_DB)) -> Experiment:
    LOG.info("create_experiment: args: %r", create)
    try:
        group = AccessCheck.ProjectGroup(create.project, create.group)
    except Exception as ex:
        raise PortalException(status.HTTP_404_NOT_FOUND, str(ex))

    if not group.AccessCheck(current_user, AccessCheck.TB_PROJECT_CREATEEXPT):
        raise PortalException(status.HTTP_401_UNAUTHORIZED, "Not enough permission")

    # This will raise a validation error
    PortalValidate(create, ExperimentValidation);

    # This will raise a TOO_MANY_REQUESTS error.
    checkAdmissionControl()

    #
    # The choice is, a paramset, a set of bindings in json, or just the
    # profile with no passed arguments.
    #
    # The refspec is optional and only applies to repo back profiles.
    #
    command = STARTEXPT + " --name %s " % (create.name,)
    if create.group == None:
        command += "--project %s " % (create.project,)
    else:
        command += "--project %s,%s " % (create.project, create.group)
        pass

    if create.duration != None:
        command += "--duration " + str(create.duration) + " "
    elif create.expires_at != None:
        command += "--stop " + str(create.expires_at) + " "
        pass
    if create.start_at != None:
        command += "--start " + str(create.start_at) + " "
        pass

    bindingsFile = None
    if create.bindings:
        with tempfile.NamedTemporaryFile(mode='w+', delete=False) as fp:
            fp.write(json.dumps(create.bindings))
            fp.flush()
            bindingsFile = fp.name
            pass
        command += "--bindings " + bindingsFile + " "
    elif create.paramset_name and create.paramset_owner:
        #
        # Need permission checks here.
        #
        command += "--paramset %s,%s " % (create.paramset_owner, create.paramset_name)
        pass

    command = command + " %s,%s" % (create.profile_project, create.profile_name)

    completed = SUEXEC(current_user, group, command)
    if bindingsFile:
        os.unlink(bindingsFile)
        pass
    if completed.returncode != 0:
        return HandleShellError(completed)

    qres = DBQueryWarn("select uuid from apt_instances "+
                       "where pid=%s and name=%s",
                       (create.project, create.name))
    if not qres or len(qres) != 1:
        raise PortalException(status.HTTP_404_NOT_FOUND,
                              "Experiment not found after creating")
    uuid = qres[0][0]
    return ConstructExperiment(DB, uuid, elaborate=False)


@router.patch("/{experiment_id}",
              summary="Modify a running experiment, must be a parameterized profile")
def update_experiment(
        current_user: Annotated[str, Depends(get_current_user)],
        experiment_id: Annotated[str, Depends(check_experiment_id)],
        modify_info: Annotated[ExperimentModify, Body()],
        experiment_access = Depends(get_experiment_access),
        DB: Session = Depends(get_DB)) -> Experiment:
    LOG.info("modify_experiment: args: %r, %s", experiment_id, modify_info)

    if not experiment_access.AccessCheck(
            current_user, AccessCheck.TB_EXPT_READINFO):
        raise PortalException(status.HTTP_401_UNAUTHORIZED, "Not enough permission")

    # This will raise a TOO_MANY_REQUESTS error.
    checkAdmissionControl()

    if True:
        return ConstructExperiment(DB, experiment_id)

    # Boss runs an old version of python, missing delete_on_close, hence the
    # flush instead of close. But as long as the file is deleted when it goes
    # out of scope, we are good.
    with tempfile.NamedTemporaryFile(mode='w+') as fp:
        fp.write(modify_info.bindings)
        fp.flush()

        command = MODIFYEXPT + " --bindings %s %s " % (fp.name, str(experiment_id))

        completed = SUEXEC(current_user, experiment_access.group, command)
        if completed.returncode != 0:
            return HandleShellError(completed)
        pass
    
    return ConstructExperiment(DB, experiment_id)


@router.get("/{experiment_id}/node/{client_id}")
def get_experiment_node(
        current_user: Annotated[str, Depends(get_current_user)],
        experiment_id: Annotated[str, Depends(check_experiment_id)],
        client_id: Annotated[str, Path(pattern="^[-\w]+$")],
        experiment_access = Depends(get_experiment_access),
        DB: Session = Depends(get_DB)) -> AggregateNode:
    LOG.info("get_experiment_node: args: %r, %r", experiment_id, client_id)

    if not experiment_access.AccessCheck(
            current_user, AccessCheck.TB_EXPT_READINFO):
        raise PortalException(status.HTTP_401_UNAUTHORIZED, "Not enough permission")

    return ConstructExperimentNode(DB, experiment_id, client_id)


@router.get("/{experiment_id}/manifests")
def get_experiment_manifests(
        current_user: Annotated[str, Depends(get_current_user)],
        experiment_id: Annotated[str, Depends(check_experiment_id)],
        experiment_access = Depends(get_experiment_access),
        DB: Session = Depends(get_DB)) -> ManifestArray:
    LOG.info("get_experiment_manifests: args: %r", experiment_id)

    if not experiment_access.AccessCheck(
            current_user, AccessCheck.TB_EXPT_READINFO):
        raise PortalException(status.HTTP_401_UNAUTHORIZED, "Not enough permission")

    return ConstructExperimentManifests(DB, experiment_id)


@router.post("/{experiment_id}/nodes/{operation:str}")
def update_experiment_nodes(
        current_user: Annotated[str, Depends(get_current_user)],
        experiment_id: Annotated[str, Depends(check_experiment_id)],
        operation: Annotated[NodeOps, Path()],
        experiment_access = Depends(get_experiment_access),
        DB: Session = Depends(get_DB)) -> Experiment:
    LOG.info("update_experiment_nodes: args: %r,%s", experiment_id, operation)

    if not experiment_access.AccessCheck(
            current_user, AccessCheck.TB_EXPT_UPDATE):
        raise PortalException(status.HTTP_401_UNAUTHORIZED, "Not enough permission")

    command = "%s %s %s -b " % (MANAGEINSTANCE, operation, str(experiment_id))

    completed = SUEXEC(current_user, experiment_access.group, command)
    if completed.returncode != 0:
        return HandleShellError(completed)

    return ConstructExperiment(DB, experiment_id)


@router.post("/{experiment_id}/node/{client_id}/{operation:str}")
def update_experiment_node(
        current_user: Annotated[str, Depends(get_current_user)],
        experiment_id: Annotated[str, Depends(check_experiment_id)],
        client_id: Annotated[str, Path(pattern="^[-\w]+$")],
        operation: NodeOps,
        experiment_access = Depends(get_experiment_access),
        DB: Session = Depends(get_DB)) -> AggregateNode:
    LOG.info("update_experiment_node: args: %r,%s %r",
             experiment_id, operation, client_id)

    if not experiment_access.AccessCheck(
            current_user, AccessCheck.TB_EXPT_UPDATE):
        raise PortalException(status.HTTP_401_UNAUTHORIZED, "Not enough permission")

    # Simple way to make sure its a node in the experiment.
    # This will raise an exception.
    ignored = ConstructExperimentNode(DB, experiment_id, client_id)
    
    command = "%s %s %s -b %s" % (
        MANAGEINSTANCE, operation, str(experiment_id), client_id)

    completed = SUEXEC(current_user, experiment_access.group, command)
    if completed.returncode != 0:
        return HandleShellError(completed)

    return ConstructExperimentNode(DB, experiment_id, client_id)

#
# Construct an Experiment that matches the openapi description.
#
def ConstructExperiment(DB: Session, experiment_id, elaborate=True):
    if True:
        stmt = select(AptInstances).where(text("uuid = :id"))
        row = DB.execute(stmt, {'id': experiment_id}).first()
        if not row:
            raise HTTPException(
                status_code=404, detail="No such experiment"
            )            
        #print(str(row))
        instance = row.AptInstances
        #
        # Generate the list of status objects
        #
        aggregate_list = {}
        if elaborate == True:
            for aggregate in instance.aggregates:
                node_list = []

                for sliver in aggregate.slivers:
                    # Not all slivers have rawstate
                    rawstate = ""
                    if "rawstate" in sliver.sliver_data:
                        rawstate = sliver.sliver_data["rawstate"]
                        pass

                    node_status = AggregateNode(
                        urn = sliver.aggregate_urn,
                        client_id = sliver.client_id,
                        status = sliver.sliver_data["status"],
                        state = sliver.sliver_data["state"],
                        rawstate = rawstate,
                        #
                        # XXX hostname and ipv4 are in the manifest,
                        #
                        hostname = "<notyet>",
                        ipv4 = "<notyet>",
                    )
                    node_list.append(node_status)
                    pass

                agg_status = AggregateStatus(
                    urn=aggregate.aggregate_urn,
                    status=aggregate.status,
                    nodes=node_list,
                )
                aggregate_list[aggregate.aggregate_urn] = agg_status
                #aggregate_list.append(agg_status)
                pass
            pass
        
        #
        # Use the model to create the return value
        #
        bindings = {}
        if instance.params != None:
            bindings = json.loads(instance.params)
            pass
            
        exp = Experiment(
            id = instance.uuid,
            name = instance.name,
            project = instance.pid,
            profile_id = instance.profile.uuid,
            profile_name = instance.profile.name,
            profile_project = instance.profile.pid,
            creator = instance.creator,
            created_at = TBDatetimeGMT(instance.created),
            started_at = TBDatetimeGMT(instance.started),
            start_at = TBDatetimeGMT(instance.start_at),
            stop_at = TBDatetimeGMT(instance.stop_at),
            bindings = bindings,
            #
            # Huh, we do not have an updated timestamp
            #updated_at = TBDatetimeGMT(str(instance.updated)),
            status = instance.status,
            wbstore_id = instance.slice_uuid,
            # The URL is generated on the fly in APT_Instance.
            #url = "https://",
            aggregates = aggregate_list,
        )
        if instance.repourl:
            exp.repository_url = AnyUrl(instance.repourl)
            exp.repository_refspec = instance.reporef
            exp.repository_hash = instance.repohash
            pass
            
        return exp
    pass

def ConstructExperimentNode(DB: Session,
                            experiment_id, client_id, elaborate=True):
    stmt = select(AptInstances).where(text("uuid = :id"))
    row = DB.execute(stmt, {'id': experiment_id}).first()
    if not row:
        raise HTTPException(
            status_code=404, detail="No such experiment"
        )            
    #print(str(row))
    instance = row.AptInstances

    # Find the node we want, by its client_id
    node = None

    for aggregate in instance.aggregates:
        for sliver in aggregate.slivers:
            if sliver.client_id == client_id:
                node = AggregateNode(
                    urn = sliver.aggregate_urn,
                    client_id = sliver.client_id,
                    status = sliver.sliver_data["status"],
                    state = sliver.sliver_data["state"],
                    rawstate = sliver.sliver_data["rawstate"],
                    #
                    # XXX hostname and ipv4 are in the manifest,
                    #
                    hostname = "<notyet>",
                    ipv4 = "<notyet>",
                )
                break
            pass
        if node != None:
            break
        pass
    if node == None:
        raise PortalException(status.HTTP_404_NOT_FOUND,
                              "%r is not a node in this experiment" % client_id)
    return node

#
# Array of manifests
#
def ConstructExperimentManifests(DB: Session, experiment_id):
    if True:
        stmt = select(AptInstances).where(text("uuid = :id"))
        row = DB.execute(stmt, {'id': experiment_id}).first()
        if not row:
            raise HTTPException(
                status_code=404, detail="No such experiment"
            )            
        #print(str(row))
        instance = row.AptInstances
        #
        # Generate the list of status objects
        #
        aggregate_list = {}
        for aggregate in instance.aggregates:
            if aggregate.manifest:
                aggregate_list[aggregate.aggregate_urn] = aggregate.manifest
                pass
            pass

        return ManifestArray(aggregate_list)
    pass

