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
import time
import shlex
from enum import Enum

from typing import Annotated, Text, Union
from pydantic import BaseModel, Field, AnyUrl
from uuid import UUID
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Header, Response, status
from fastapi import status as FStatus
from fastapi import Query, Path, Body
from fastapi.exceptions import RequestValidationError

from sqlalchemy import select, text
from sqlalchemy.orm import Session

from ..database import get_DB
from ..database import get_current_db, DBQuery
from ..dependencies import get_current_user, TBDatetimeGMT, SUEXEC
from ..dependencies import (
    PortalException,
    PortalValidate,
    PortalValidateOne,
    HandleShellError,
    get_elaborate_header,
)
from ..api.models import (
    Error,
    Experiment,
    ExperimentList,
    ExtensionRequest,
    ManifestArray,
    ExperimentModify,
    ExperimentCreate,
    AggregateStatus,
    AggregateNode,
    SnapshotRequest,
    SnapshotStatus,
)

LOG = logging.getLogger("uvicorn.error")

# Testbed DB access lib
from ..WebTask import WebTask
from APT_ORM import AptInstances
from app import AccessCheck

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
    "stop_at"          : None,
    "refspec"          : "default:tinytext:optional",
    "bindings"         : None,
    "sshpubkey"        : "default:text:optional",
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
        raise PortalException(FStatus.HTTP_404_NOT_FOUND, str(ex))
    
    LOG.info("get_experiment_access: %r: %r", str(experiment_id), experiment_access)
    return experiment_access

#
# As a Depends() parameter below, validate that experiment_id is a
# UUID or pid,name and a current experiment.
#
def check_experiment_id(experiment_id):
    LOG.info("check_experiment_id %r", str(experiment_id))
    DB = get_current_db()
    if match := re.match("^([\-\w]+),([\-\w]+)$", experiment_id):
        result = DBQuery(DB,
            text("select uuid from apt_instances "+
                           "where pid= :pid and name= :name"),
                           {"pid" : match[1], "name" : match[2]},
                           fatal=False
            )
        qres = result.all() if result is not None else None
        if qres == None or len(qres) != 1:
            raise PortalException(
                FStatus.HTTP_404_NOT_FOUND, "No such experiment")
        row = qres[0]
        return row[0]

    try:
        foo = str(UUID(str(experiment_id))) == str(experiment_id)
    except Exception as ex:
        raise RequestValidationError(
            "Validation error for experiment_id, not a valid UUID")

    result = DBQuery(DB,
        text("select uuid from apt_instances "+
            " where uuid=:experiment_id"),{"experiment_id" : experiment_id},
            fatal=False
        )
    qres = result.all() if result is not None else None
    if qres == None or len(qres) != 1:
        raise PortalException(
            FStatus.HTTP_404_NOT_FOUND, "No such experiment")
    
    return experiment_id

#
# Check validity of an experiment node.
# This is an inefficient way to do this, change later.
#
def check_experiment_node(DB: Session, experiment_id, client_id):
    stmt = select(AptInstances).where(text("uuid = :id"))
    result = DBQuery(DB, stmt, {'id': experiment_id}, fatal=False)
    row = result.first() if result is not None else None
    if row == None:
        raise PortalException(FStatus.HTTP_404_NOT_FOUND,
                              "%r is not a node in this experiment" % client_id)
    instance = row.AptInstances

    for aggregate in instance.aggregates:
        for sliver in aggregate.slivers:
            if sliver.client_id == client_id:
                return sliver
            pass
        pass
    
    raise PortalException(FStatus.HTTP_404_NOT_FOUND,
                          "%r is not a node in this experiment" % client_id)

#
# Check admission control (load average, too many waiting)
#
def checkAdmissionControl():
    DB = get_current_db()
    load1,load5,load15 = os.getloadavg()
    if load1 > 15:
        raise PortalException(
            FStatus.HTTP_429_TOO_MANY_REQUESTS,
            "Load average to high: " + str(load1))

    result = DBQuery(DB,
        text("select value from emulab_locks where name='create_instance_lock'"),
        fatal=False
    )
    qres = result.all() if result is not None else None
    if qres == None or len(qres) != 1:
        raise PortalException(
            FStatus.HTTP_500_INTERNAL_SERVER_ERROR, "Internal server error")

    row = qres[0]
    count = row[0]
    if count > 10:
        raise PortalException(
            FStatus.HTTP_429_TOO_MANY_REQUESTS,
            "Too many experiments waiting: " + str(count))
    pass

#
# Grab the webtask for an instance
#
def get_apt_instance_webtask(experiment_id):
    DB = get_current_db()
    result = DBQuery(DB,
        text("select webtask_id from apt_instances "+
                       "where uuid=:experiment_id"), {"experiment_id" : experiment_id},
                       fatal=False
        )
    qres = result.all() if result is not None else None
    if qres == None or len(qres) != 1:
        raise PortalException(
            FStatus.HTTP_404_NOT_FOUND, "No such experiment")

    row = qres[0]
    # There is a short time when the webtask_id of a new instance is not set.
    if not row[0]:
        return None
    
    return WebTask(row[0])

#
# Create a SnapshotStatus for an instance,
#
def get_apt_instance_snapshot_status(experiment_id):
    webtask = get_apt_instance_webtask(experiment_id)
    if not webtask:
        return None

    if not webtask.HasAttribute("snapshot_id"):
        return None
    snapshot_id = webtask["snapshot_id"]

    # Strip off the units, that was a bad idea a long time ago.
    # Might not have an image size yet.
    image_size = 0
    if webtask.HasAttribute("image_size"):
        image_size = webtask["image_size"]
        if type(image_size) == str:
            if image_size[-2:] == "KB":
                image_size = image_size[:-2]
                pass
            pass
        pass

    image_status = "unknown"
    if webtask.HasAttribute("image_status"):
        image_status = webtask["image_status"]
        pass
    
    status = SnapshotStatus(
        id = snapshot_id,
        status = image_status,
        image_size = image_size,
        image_urn = webtask["image_urn"],
    )
    if webtask.HasAttribute("image_stamp"):
        status.status_timestamp = TBDatetimeGMT(
            datetime.fromtimestamp(int(webtask["image_stamp"])))
        pass
    
    if webtask.HasExited():
        if webtask.exitcode:
            status.error_message = webtask["output"]
            pass
        pass
    
    return status

def get_experiment_expiration(experiment_id):
    DB = get_current_db()
    result = DBQuery(DB,
        text("select s.expires from apt_instances as i "+
                       "join geni.geni_slices as s on "+
                       "  s.uuid=i.slice_uuid "+
                       "where i.uuid= :experiment_id"),{"experiment_id" : experiment_id},
                       fatal=False
    )
    qres = result.all() if result is not None else None
    if qres == None or len(qres) != 1:
        raise PortalException(
            FStatus.HTTP_404_NOT_FOUND, "No such experiment")

    row = qres[0]
    return row[0]


STARTEXPT      = "webstart-experiment "
MODIFYEXPT     = "webmodify-experiment "
MANAGEINSTANCE = "webmanage_instance "
EXTENDEXPT     = MANAGEINSTANCE + " extend "
STOPEXPT       = MANAGEINSTANCE + " terminate "
CONNECTLAN     = MANAGEINSTANCE + " connectsharedlan "
SNAPSHOT       = MANAGEINSTANCE + " snapshot "

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
        elaborate: bool = Depends(get_elaborate_header),
        DB: Session = Depends(get_DB)) -> ExperimentList:
    LOG.info("get_experiments: current_user: %r", current_user)
    LOG.info("get_experiments: args: %r, %r, %r", experiment_id, creator, project)
    experiments = []
    clause = "";

    #
    # Easy thing to do here is just find all the matching experiments and then
    # check permission to generate a list.
    #
    # At the moment, just the current user experiments.
    #
    result = DBQuery(DB,
        text("select uuid,pid from apt_instances "+
                       "where creator_idx= :current_user"), {"current_user" : current_user.uid_idx},
                       fatal=False
        )
    qres = result.all() if result is not None else []
    for row in qres:
        uuid = row[0]
        pid  = row[1]

        if project:
            if pid == project:
                experiments.append(ConstructExperiment(DB, uuid, elaborate=elaborate))
                pass
            pass
        elif experiment_id:
            if str(uuid) == str(experiment_id):
                experiments.append(ConstructExperiment(DB, uuid, elaborate=elaborate))
                pass
            pass
        else:
            experiments.append(ConstructExperiment(DB, uuid, elaborate=elaborate))
            pass
        pass
    
    return ExperimentList(experiments = experiments)

@router.get("/{experiment_id}")
def get_experiment(
        current_user: Annotated[object, Depends(get_current_user)],
        experiment_id: Annotated[str, Depends(check_experiment_id)],
        elaborate: bool = Depends(get_elaborate_header),
        experiment_access = Depends(get_experiment_access),
        DB: Session = Depends(get_DB)) -> Experiment:

    if not experiment_access.AccessCheck(
            current_user, AccessCheck.TB_EXPT_READINFO):
        raise PortalException(FStatus.HTTP_401_UNAUTHORIZED, "Not enough permission")
    
    # Delay to cut down on tight loop polling
    time.sleep(3)
    
    return ConstructExperiment(DB, experiment_id, elaborate=elaborate)

#
# At the moment, the only update is "extend"
#
@router.put("/{experiment_id}",
            summary="Extend an experiment")
def update_experiment(
        current_user: Annotated[str, Depends(get_current_user)],
        experiment_id: Annotated[str, Path(), Depends(check_experiment_id)],
        extension: Annotated[ExtensionRequest, Body()],
        experiment_access = Depends(get_experiment_access),
        DB: Session = Depends(get_DB)) -> Experiment:
    LOG.info("update_experiment: args: %r, %r", experiment_id, extension)

    if not (extension.expires_at or extension.extend_by):
        raise RequestValidationError("Must provide expires_at or extend_by")

    if extension.expires_at and extension.extend_by:
        raise RequestValidationError("Must provide only one of expires_at or extend_by")

    if not experiment_access.AccessCheck(
            current_user, AccessCheck.TB_EXPT_READINFO):
        raise PortalException(FStatus.HTTP_401_UNAUTHORIZED, "Not enough permission")

    command = EXTENDEXPT + " " + str(experiment_id)

    reasonFile = None
    if extension.reason:
        # This will raise an Exception
        PortalValidateOne("reason", extension.reason, "default", "fulltext")
        
        with tempfile.NamedTemporaryFile(mode='w+', delete=False) as fp:
            fp.write(extension.reason)
            fp.flush()
            os.chmod(fp.name, 0o644)
            reasonFile = fp.name
            pass
        command += " -f " + reasonFile
    else:
        command += " -m '" + "Experiment extended via the REST API" + "'"
        pass
        
    # Either way is fine.
    if extension.expires_at:
        command += " '" + str(extension.expires_at) + "'"
    else:
        command += " " + str(extension.extend_by) + " "
        pass

    completed = SUEXEC(current_user, experiment_access.group, command)
    if reasonFile:
        os.unlink(reasonFile)
        pass
    LOG.info(completed)
    if completed.returncode != 0:
        return HandleShellError(completed)

    return ConstructExperiment(DB, experiment_id)


@router.post("/{experiment_id}/vlan/{source_lan}/connect",
             status_code=FStatus.HTTP_204_NO_CONTENT)
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

    if not experiment_access.AccessCheck(
            current_user, AccessCheck.TB_EXPT_MODIFY):
        raise PortalException(FStatus.HTTP_401_UNAUTHORIZED, "Not enough permission")

    command = CONNECTLAN + " " + str(experiment_id) + " " + str(source_lan) + " "
    command += str(target_id) + " " + str(target_lan) + " "

    completed = SUEXEC(current_user, experiment_access.group, command)
    LOG.info(completed)
    if completed.returncode != 0:
        return HandleShellError(completed)

    pass


@router.post("/{experiment_id}/vlan/{source_lan}/disconnect",
             status_code=FStatus.HTTP_204_NO_CONTENT)
def disconnect_experiment_vlan(
        current_user: Annotated[str, Depends(get_current_user)],
        experiment_id: Annotated[str, Depends(check_experiment_id)],
        source_lan: Annotated[str, Path(pattern="^[-\w]+$")],
        experiment_access = Depends(get_experiment_access),
        DB: Session = Depends(get_DB)):
    LOG.info("disconnect_experiment_vlan: args: %r, %r", experiment_id, source_lan)

    if not experiment_access.AccessCheck(
            current_user, AccessCheck.TB_EXPT_MODIFY):
        raise PortalException(FStatus.HTTP_401_UNAUTHORIZED, "Not enough permission")

    command = CONNECTLAN + " " + str(experiment_id) + " -r " + str(source_lan)
    
    completed = SUEXEC(current_user, experiment_access.group, command)
    LOG.info(completed)
    if completed.returncode != 0:
        return HandleShellError(completed)

    pass


@router.delete("/{experiment_id}", status_code=FStatus.HTTP_204_NO_CONTENT)
def delete_experiment(
        current_user: Annotated[str, Depends(get_current_user)],
        experiment_id: Annotated[str, Depends(check_experiment_id)],
        experiment_access = Depends(get_experiment_access),
        DB: Session = Depends(get_DB)):
    
    if not experiment_access.AccessCheck(
            current_user, AccessCheck.TB_EXPT_READINFO):
        raise PortalException(FStatus.HTTP_401_UNAUTHORIZED, "Not enough permission")
    
    command = STOPEXPT + " " + str(experiment_id);
    completed = SUEXEC(current_user, experiment_access.group, command)
    LOG.info(completed)
    if completed.returncode != 0:
        return HandleShellError(completed)

    pass


@router.post("/", status_code=FStatus.HTTP_201_CREATED)
def create_experiment(
        current_user: Annotated[str, Depends(get_current_user)],
        create: ExperimentCreate = None,
        DB: Session = Depends(get_DB)) -> Experiment:
    LOG.info("create_experiment: args: %r", create)
    try:
        group = AccessCheck.ProjectGroup(create.project, create.group)
    except Exception as ex:
        raise PortalException(FStatus.HTTP_404_NOT_FOUND, str(ex))

    if not group.AccessCheck(current_user, AccessCheck.TB_PROJECT_CREATEEXPT):
        raise PortalException(FStatus.HTTP_401_UNAUTHORIZED, "Not enough permission")

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
    elif create.stop_at != None:
        command += "--stop " + str(int(create.stop_at.timestamp())) + " "
        pass
    if create.start_at != None:
        command += "--start " + str(int(create.start_at.timestamp())) + " "
        pass
    if create.refspec != None:
        command += "--refspec " + shlex.quote(create.refspec) + " "
        pass

    # An extra ssh public key for the experiment.
    pubkeyFile = None
    if create.sshpubkey:
        LOG.info("PubKey: %r", create.sshpubkey)
        with tempfile.NamedTemporaryFile(mode='w+', delete=False) as fp:
            fp.write(create.sshpubkey)
            fp.flush()
            os.chmod(fp.name, 0o644)
            pubkeyFile = fp.name
            pass
        command += "--sshpubkey " + pubkeyFile + " "
        pass

    bindingsFile = None
    if create.bindings:
        bindings_json = create.bindings.model_dump_json()
        LOG.info("Bindings: %r", bindings_json)
        with tempfile.NamedTemporaryFile(mode='w+', delete=False) as fp:
            fp.write(bindings_json)
            fp.flush()
            os.chmod(fp.name, 0o644)
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
    if pubkeyFile:
        os.unlink(pubkeyFile)
        pass
    if completed.returncode != 0:
        return HandleShellError(completed)

    result = DBQuery(DB,
        text("select uuid from apt_instances "+
                       "where pid=:pid and name=:name"),
                       {"pid" : create.project, "name" : create.name},
                       fatal=False
        )
    qres = result.all() if result is not None else None
    if qres == None or len(qres) != 1:
        raise PortalException(FStatus.HTTP_404_NOT_FOUND,
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
        raise PortalException(FStatus.HTTP_401_UNAUTHORIZED, "Not enough permission")

    # This will raise a TOO_MANY_REQUESTS error.
    checkAdmissionControl()

    if False:
        return ConstructExperiment(DB, experiment_id)

    bindings_json = modify_info.bindings.model_dump_json()

    # Boss runs an old version of python, missing delete_on_close, hence the
    # flush instead of close. But as long as the file is deleted when it goes
    # out of scope, we are good.
    with tempfile.NamedTemporaryFile(mode='w+') as fp:
        fp.write(bindings_json)
        os.chmod(fp.name, 0o644)
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
        raise PortalException(FStatus.HTTP_401_UNAUTHORIZED, "Not enough permission")

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
        raise PortalException(FStatus.HTTP_401_UNAUTHORIZED, "Not enough permission")

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
        raise PortalException(FStatus.HTTP_401_UNAUTHORIZED, "Not enough permission")

    command = "%s %s %s -b " % (MANAGEINSTANCE, operation.name, str(experiment_id))

    completed = SUEXEC(current_user, experiment_access.group, command)
    if completed.returncode != 0:
        return HandleShellError(completed)

    # Delay a moment to let status change.
    time.sleep(3)
    # Need to force this since we hare holding a stale DB object
    DB.expire_all()
    return ConstructExperiment(DB, experiment_id)


@router.post("/{experiment_id}/snapshot/{client_id}")
def snapshot_experiment_node(
        current_user: Annotated[str, Depends(get_current_user)],
        experiment_id: Annotated[str, Depends(check_experiment_id)],
        client_id: Annotated[str, Path(pattern="^[-\w]+$")],
        snapshotReq: SnapshotRequest,
        experiment_access = Depends(get_experiment_access),
        DB: Session = Depends(get_DB)) -> SnapshotStatus:
    LOG.info("snapshot_experiment_node: args: %r %r %r",
             experiment_id, client_id, snapshotReq)

    if not experiment_access.AccessCheck(
            current_user, AccessCheck.TB_EXPT_UPDATE):
        raise PortalException(FStatus.HTTP_401_UNAUTHORIZED, "Not enough permission")

    # This will raise an error
    check_experiment_node(DB, experiment_id, client_id)
    # Ditto
    PortalValidateOne("image_name", snapshotReq.image_name, "images", "imagename")

    command = "%s %s -n %s -i %s -O image-only" % (
        SNAPSHOT, str(experiment_id), client_id, snapshotReq.image_name)
    LOG.info(command)

    # We need to clear the instance webtask since that is where the status
    # goes, including the snapshot_id
    webtask = get_apt_instance_webtask(experiment_id);
    LOG.info("webtask %r", webtask)
    webtask.Reset()

    completed = SUEXEC(current_user, experiment_access.group, command)
    if completed.returncode != 0:
        return HandleShellError(completed)

    webtask.Refresh();

    return SnapshotStatus(
        id = webtask["snapshot_id"],
        status = "started",
        status_timestamp = TBDatetimeGMT("now"),
        image_size = 0,
        image_urn = webtask["image_urn"],
    )

@router.get("/{experiment_id}/snapshot/{snapshot_id}")
def get_experiment_snapshot_status(
        current_user: Annotated[str, Depends(get_current_user)],
        experiment_id: Annotated[str, Depends(check_experiment_id)],
        snapshot_id: UUID,
        experiment_access = Depends(get_experiment_access),
        DB: Session = Depends(get_DB)) -> SnapshotStatus:
    LOG.info("get_experiment_snapshot_status: args: %r %r",
             experiment_id, snapshot_id)

    if not experiment_access.AccessCheck(
            current_user, AccessCheck.TB_EXPT_READINFO):
        raise PortalException(
            FStatus.HTTP_401_UNAUTHORIZED, "Not enough permission")

    webtask = get_apt_instance_webtask(experiment_id)
    LOG.info("webtask %r %r", webtask["snapshot_id"], str(snapshot_id))
    try:
        if str(snapshot_id) != webtask["snapshot_id"]:
            raise PortalException(
                FStatus.HTTP_404_NOT_FOUND, "Snapshot ID is invalid")
    except:
        raise PortalException(
            FStatus.HTTP_404_NOT_FOUND, "Snapshot ID is invalid")

    # Delay to cut down on tight loop polling
    time.sleep(5)
    
    return get_apt_instance_snapshot_status(experiment_id)

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
        raise PortalException(FStatus.HTTP_401_UNAUTHORIZED, "Not enough permission")

    # This will raise an error
    check_experiment_node(DB, experiment_id, client_id)

    command = "%s %s %s -b %s" % (
        MANAGEINSTANCE, operation.name, str(experiment_id), client_id)

    completed = SUEXEC(current_user, experiment_access.group, command)
    if completed.returncode != 0:
        return HandleShellError(completed)

    # Delay a moment to let status change.
    time.sleep(3)
    # Need to force this since we hare holding a stale DB object
    DB.expire_all()
    return ConstructExperimentNode(DB, experiment_id, client_id)

#
# Construct an Experiment that matches the openapi description.
#
def ConstructExperiment(DB: Session, experiment_id, elaborate=True):
    if True:
        stmt = select(AptInstances).where(text("uuid = :id"))
        result = DBQuery(DB, stmt, {'id': experiment_id}, fatal=False)
        row = result.first() if result is not None else None
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
            expires_at = TBDatetimeGMT(get_experiment_expiration(experiment_id)),
            bindings = bindings,
            #
            # Huh, we do not have an updated timestamp
            #updated_at = TBDatetimeGMT(str(instance.updated)),
            status = instance.status,
            wbstore_id = instance.slice_uuid,
            # The URL is generated on the fly in APT_Instance.
            #url = "https://",
            aggregates = aggregate_list,
            sshpubkey = instance.sshpubkey,
        )
        if instance.repourl:
            exp.repository_url = AnyUrl(instance.repourl)
            exp.repository_refspec = instance.reporef
            exp.repository_hash = instance.repohash
            pass

        snapshot_status = get_apt_instance_snapshot_status(experiment_id)
        if snapshot_status:
            exp.last_snapshot_status = snapshot_status
            pass
            
        return exp
    pass

def ConstructExperimentNode(DB: Session,
                            experiment_id, client_id, elaborate=True):
    stmt = select(AptInstances).where(text("uuid = :id"))
    result = DBQuery(DB, stmt, {'id': experiment_id}, fatal=False)
    row = result.first() if result is not None else None
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
        raise PortalException(FStatus.HTTP_404_NOT_FOUND,
                              "%r is not a node in this experiment" % client_id)
    return node

#
# Array of manifests
#
def ConstructExperimentManifests(DB: Session, experiment_id):
    if True:
        stmt = select(AptInstances).where(text("uuid = :id"))
        result = DBQuery(DB, stmt, {'id': experiment_id}, fatal=False)
        row = result.first() if result is not None else None
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

