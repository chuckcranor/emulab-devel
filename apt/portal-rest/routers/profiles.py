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
import html
from enum import Enum

from typing import Annotated, Text, Union
from pydantic import BaseModel, Field, AnyUrl
from uuid import UUID, uuid4
from datetime import datetime, time, timedelta

from fastapi import APIRouter, Depends, HTTPException, Header, Response, status
from fastapi import Query, Path, Body
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from sqlalchemy import select, text
from sqlalchemy.orm import Session

from ..database import get_DB
from ..dependencies import get_current_user, get_elaborate_header
from ..dependencies import TBDatetimeGMT, SUEXEC
from ..dependencies import PortalException, PortalValidate, HandleShellError
from ..api.models import (
    Error,
    Profile,
    ProfileCreate,
    ProfileList,
    ProfileVersion,
    ProfileModify,
)

# Testbed DB access lib
from libdb import *
from WebTask import WebTask
from APT_ORM import AptProfiles
import AccessCheck

# pydantic handles uuid,datetime,integer validation
ProfileValidation = {
    "project"        : "projects:pid:required",
    "group"          : "groups:gid:optional",
    "repository_url" : "default:tinytext:optional",
    "script"         : None,
}

ProfileModifyValidation = {
    "public"           : "default:boolean:optional",
    "project_writable" : "default:boolean:optional",
    "script"           : None,
}

MANAGEPROFILE  = "webmanage_profile"

#
# As a Depends() parameter below, get the access check object for an experiment.
#
def get_profile_access(profile_id):
    try:
        profile_access = AccessCheck.Profile(str(profile_id))
    except Exception as ex:
        raise PortalException(status.HTTP_404_NOT_FOUND, str(ex))
    
    LOG.info("get_profile_access: %r: %r", str(profile_id), profile_access)
    return profile_access

#
# As a Depends() parameter below, validate that profile_id is a UUID or pid,name
#
def check_profile_id(profile_id):
    LOG.info("check_profile_id %r", str(profile_id))

    if match := re.match("^([\-\w]+),([\-\w]+)$", profile_id):
        qres = DBQueryWarn("select uuid from apt_profiles "+
                           "where pid=%s and name=%s",
                           (match[1], match[2]))
        if qres == None or len(qres) != 1:
            raise PortalException(
                status.HTTP_404_NOTFOUND, "No such profile")
        row = qres[0]
        return row[0]

    try:
        foo = str(UUID(str(profile_id))) == str(profile_id)
    except Exception as ex:
        raise RequestValidationError(
            "Validation error for profile_id, not a valid UUID")
    
    return profile_id

#
# Check that a profile version exists,
#
def check_profile_version(profile_id, version_id):
    LOG.info("check_profile_version %r %r", str(profile_id), str(version_id))
    qres = DBQueryWarn("select i.uuid,v.uuid from apt_profiles as i " +
                       "join apt_profile_versions as v on " +
		       "   v.profileid=i.profileid " +
                       "where i.uuid=%s and v.uuid=%s",
                       (profile_id, version_id))
    if qres == None or len(qres) != 1:
        raise PortalException(
            status.HTTP_404_NOTFOUND, "No such profile version")

    return True
    

LOG = logging.getLogger("uvicorn.error")

router = APIRouter(
    prefix="/profiles",
    tags=["profiles"]
)

@router.get("/")
def get_profiles(
        current_user: Annotated[str, Depends(get_current_user)],
        profile_id: UUID = None,
        elaborate: bool = Depends(get_elaborate_header),
        DB: Session = Depends(get_DB)) -> ProfileList:
    LOG.info("get_profiles: args: %r", profile_id)
    result = []
    clause = "";

    #
    # Easy thing to do here is just find all the matching profiles and then
    # check permission to generate a list.
    #
    # At the moment, just the current user profiles
    #
    qres = DBQueryFatal("select p.uuid from apt_profiles as p " +
                        "left join apt_profile_versions as v on " +
                        "   v.profileid=p.profileid and " +
                        "   v.version=p.version " +
                        "where v.creator_idx=%s", (current_user.uid_idx,))

    for row in qres:
        uuid = row[0];
        result.append(ConstructProfile(DB, uuid, elaborate=elaborate))
        pass
    
    return ProfileList(profiles = result)


@router.get("/{profile_id}")
def get_profile(
        current_user: Annotated[object, Depends(get_current_user)],
        profile_id: Annotated[str, Depends(check_profile_id)],
        elaborate: bool = Depends(get_elaborate_header),
        profile_access = Depends(get_profile_access),
        DB: Session = Depends(get_DB)) -> Profile:
    LOG.info("get_profile: %r", profile_id)

    if not profile_access.AccessCheck(
            current_user, AccessCheck.TB_PROFILE_READINFO):
        raise PortalException(status.HTTP_401_UNAUTHORIZED, "Not enough permission")

    return ConstructProfile(DB, profile_id, elaborate=elaborate)

@router.get("/{profile_id}/versions/{version_id}")
def get_profile_version(
        current_user: Annotated[object, Depends(get_current_user)],
        profile_id: Annotated[str, Depends(check_profile_id)],
        version_id: UUID,
        profile_access = Depends(get_profile_access),
        DB: Session = Depends(get_DB)) -> Profile:

    if not profile_access.AccessCheck(
            current_user, AccessCheck.TB_PROFILE_READINFO):
        raise PortalException(status.HTTP_401_UNAUTHORIZED, "Not enough permission")
    
    # Does this profile version actually exist, this will raise an Exception.
    check_profile_version(profile_id, version_id);

    return ConstructProfile(DB, profile_id, version_id=version_id)


@router.post("/", status_code=status.HTTP_201_CREATED)
def create_profile(
        current_user: Annotated[str, Depends(get_current_user)],
        createargs: ProfileCreate,
        response: Response,
        DB: Session = Depends(get_DB)) -> Profile:
    LOG.info("create_profile: args: %r", createargs)
    try:
        group = AccessCheck.ProjectGroup(createargs.project)
    except Exception as ex:
        raise PortalException(status.HTTP_404_NOT_FOUND, str(ex))

    if not group.AccessCheck(current_user, AccessCheck.TB_PROJECT_CREATEPROFILE):
        raise PortalException(status.HTTP_401_UNAUTHORIZED, "Not enough permission")

    return create_profile(current_user, group, createargs)

#
# Initial create. 
#
def create_profile(user, group, args):
    xmlFile = None

    # This will raise a validation error
    PortalValidate(args, ProfileValidation, strict=False);

    if not (args.script or args.repository_url):
        raise RequestValidationError(
            "Must provide a script or a repository_url")

    #
    # manage_profile takes a simple xml file.
    #
    with tempfile.NamedTemporaryFile(mode='w+', delete=False) as fp:
        fp.write("<profile>\n");
        fp.write("<attribute name='profile_pid'>");
        fp.write("  <value>" + args.project + "</value>");
        fp.write("</attribute>\n");
        fp.write("<attribute name='profile_name'>");
        fp.write("  <value>" +
                 html.escape(args.name, quote=True)  + "</value>");
        fp.write("</attribute>\n");
        if args.script:
            fp.write("<attribute name='script'>");
            fp.write("   <value>" +
                     html.escape(args.script, quote=True)  + "</value>");
            fp.write("</attribute>\n");
        elif args.repository_url:
            fp.write("<attribute name='profile_repourl'>");
            fp.write("  <value>" +
                     html.escape(args.repository_url, quote=True)  + "</value>");
            fp.write("</attribute>\n");
            pass
        if args.public:
            fp.write("<attribute name='profile_shared'>1</attribute>\n");
            pass
        if args.project_writable:
            fp.write("<attribute name='profile_write'>1</attribute>\n");
            pass
        
        fp.write("</profile>\n");
        fp.flush()
        os.chmod(fp.name, 0o644)
        xmlFile = fp.name
        pass
    
    #
    # Need a WebTask here, for the returning uuid and for errors.
    #
    webtask = WebTask.CreateAnonymous()
    command = MANAGEPROFILE + " -t " + webtask.task_id + " create " + xmlFile

    completed = SUEXEC(user, group, command);
    if completed.returncode != 0:
        webtask.Delete()
        os.unlink(xmlFile)
        return HandleShellError(completed)

    os.unlink(xmlFile)
    webtask.Refresh()
    results = webtask["results"];
    profile_id = results["uuid"]
    webtask.Delete()
    return ConstructProfile(DB, profile_id)


#
# Modify
#
@router.patch("/{profile_id}")
def modify_profile(
        current_user: Annotated[object, Depends(get_current_user)],
        profile_id: Annotated[str, Depends(check_profile_id)],
        modifyargs: ProfileModify,
        profile_access = Depends(get_profile_access),
        DB: Session = Depends(get_DB)) -> Profile:
    LOG.info("modify_profile: args: %r", modifyargs)

    if not profile_access.AccessCheck(
            current_user, AccessCheck.TB_PROFILE_MODIFY):
        raise PortalException(status.HTTP_401_UNAUTHORIZED, "Not enough permission")

    return modify_profile(current_user, profile_access.group, modifyargs, profile_id)

def modify_profile(user, group, args, profile_id):
    xmlFile = None

    # This will raise a validation error
    PortalValidate(args, ProfileModifyValidation, strict=False);

    #
    # manage_profile takes a simple xml file.
    #
    with tempfile.NamedTemporaryFile(mode='w+', delete=False) as fp:
        fp.write("<profile>\n");
        if args.script:
            fp.write("<attribute name='script'>")
            fp.write("   <value>" +
                     html.escape(args.script, quote=True)  + "</value>")
            fp.write("</attribute>\n")
        if args.public:
            fp.write("<attribute name='profile_shared'>")
            fp.write(str(int(args.public)))
            fp.write("</attribute>\n")
            pass
        if args.project_writable:
            fp.write("<attribute name='profile_write'>")
            fp.write(str(int(args.project_writable)))
            fp.write("</attribute>\n")
            pass
        
        fp.write("</profile>\n")
        fp.flush()
        os.chmod(fp.name, 0o644)
        xmlFile = fp.name
        pass
    
    #
    # Need a WebTask here, for the returning uuid and for errors.
    #
    webtask = WebTask.CreateAnonymous()
    command = MANAGEPROFILE + " -t " + webtask.task_id + " modify " + xmlFile

    completed = SUEXEC(user, group, command);
    if completed.returncode != 0:
        webtask.Delete()
        os.unlink(xmlFile)
        return HandleShellError(completed)

    os.unlink(xmlFile)
    webtask.Refresh()
    results = webtask["results"]
    #
    # Not every update results in a new profile version. 
    #
    version_id = None
    if "newProfile" in results:
        version_id = results["newProfile"]
        pass
    webtask.Delete()
    return ConstructProfile(DB, profile_id, version_id=version_id)

#
# Update a repo backed profile from its repository. Nothing else.
#
@router.put("/{profile_id}")
def update_profile(
        current_user: Annotated[object, Depends(get_current_user)],
        profile_id: Annotated[str, Depends(check_profile_id)],
        profile_access = Depends(get_profile_access),
        DB: Session = Depends(get_DB)) -> Profile:

    if not profile_access.AccessCheck(
            current_user, AccessCheck.TB_PROFILE_MODIFY):
        raise PortalException(status.HTTP_401_UNAUTHORIZED, "Not enough permission")

    #
    # Lets make sure its a repo backed profile.
    #
    stmt = select(AptProfiles).where(text("uuid = :id"))
    row = DB.execute(stmt, {'id': profile_id}).first()
    if not row:
        raise HTTPException(
            status_code=404, detail="No such profile"
        )            
    profile = row.AptProfiles
    # Always profile zero ...
    current = profile.versions[profile.version]
    if not current.repourl:
        raise PortalException(status.HTTP_404_BAD_REQUEST,
                              "Not a repository backed profile ")

    command = MANAGEPROFILE + " updatefromrepo " + profile_id

    completed = SUEXEC(current_user, profile_access.group, command);
    if completed.returncode != 0:
        webtask.Delete()
        os.unlink(xmlFile)
        return HandleShellError(completed)

    return ConstructProfile(DB, profile_id)


@router.delete("/{profile_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_profile(
        current_user: Annotated[str, Depends(get_current_user)],
        profile_id: Annotated[str, Depends(check_profile_id)],
        profile_access = Depends(get_profile_access),
        DB: Session = Depends(get_DB)):
    LOG.info("delete_profile: args: %r", profile_id)
    
    if not profile_access.AccessCheck(
            current_user, AccessCheck.TB_PROFILE_MODIFY):
        raise PortalException(status.HTTP_401_UNAUTHORIZED, "Not enough permission")

    command = MANAGEPROFILE + " delete " + str(profile_id)
    completed = SUEXEC(current_user, profile_access.group, command)

    if completed.returncode != 0:
        return HandleShellError(completed)

    pass

@router.delete("/{profile_id}/versions/{version_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_profile_version(
        current_user: Annotated[str, Depends(get_current_user)],
        profile_id: Annotated[str, Depends(check_profile_id)],
        version_id: UUID,
        profile_access = Depends(get_profile_access),
        DB: Session = Depends(get_DB)):
    LOG.info("delete_profile_version: args: %r ^r", profile_id, version_id)
    
    if not profile_access.AccessCheck(
            current_user, AccessCheck.TB_PROFILE_MODIFY):
        raise PortalException(status.HTTP_401_UNAUTHORIZED, "Not enough permission")

    # Does this profile version actually exist, this will raise an Exception.
    check_profile_version(profile_id, version_id);

    command = MANAGEPROFILE + " delete " + str(profile_id)
    completed = SUEXEC(current_user, profile_access.group, command)

    if completed.returncode != 0:
        return HandleShellError(completed)

    pass

#
# Construct a Profile that matches the openapi description.
#
def ConstructProfile(DB: Session, profile_id, version_id=None, elaborate=True):
    stmt = select(AptProfiles).where(text("uuid = :id"))
    row = DB.execute(stmt, {'id': profile_id}).first()
    if not row:
        raise HTTPException(
            status_code=404, detail="No such profile"
        )            
    #print(str(row))
    profile = row.AptProfiles

    versions = {}
    if elaborate or version_id:
        for version in profile.versions:
            uuid = version.uuid
            #print(str(uuid))
            if version_id and str(uuid) != str(version_id):
                continue
            
            paramdefs = None
            if version.paramdefs != None:
                paramdefs = json.loads(version.paramdefs)
                pass
        
            versions[uuid] = ProfileVersion(
                id = uuid,
                version = version.version,
                updater = version.updater,
                created_at = TBDatetimeGMT(version.created),
                deleted_at = TBDatetimeGMT(version.deleted),
                parameters = paramdefs,
            )
            pass
        pass

    current = profile.versions[profile.version]
    current_version = ProfileVersion(
        id = current.uuid,
        version = current.version,
        updater = current.updater,
        created_at = TBDatetimeGMT(current.created),
        parameters = None
    )
    if current.paramdefs != None:
        current_version.parameters = json.loads(current.paramdefs)
        pass

    #
    # Use the model to create the return value
    #
    result = Profile(
        id = profile.uuid,
        name = profile.name,
        version = profile.version,
        project = profile.pid,
        creator = profile.current.creator,
        # The original profile creation is in version 0.
        created_at = TBDatetimeGMT(profile.versions[0].created),
        # And updated is the created time of the last version
        updated_at = TBDatetimeGMT(profile.versions[-1].created),
        public = bool(profile.public),
        project_writable = bool(profile.project_write),
        profile_versions = versions,
        current_version = current_version
    )
    if current.repourl:
        result.repository_url = AnyUrl(current.repourl)
        result.repository_refspec = current.reporef
        result.repository_hash = current.repohash
        result.repository_githook = AnyUrl(
            "https://www.emulab.net:51369/githook/" + current.repokey)
        pass
    
    return result

