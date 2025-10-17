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
from pydantic import BaseModel, Field, AnyUrl, HttpUrl
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
from ..dependencies import TBDatetimeGMT, SUEXEC, DecodeToken
from ..dependencies import (
    PortalException,
    PortalValidate,
    PortalValidateOne,
    HandleShellError
)
from ..api.models import (
    Error,
    Version,
)

# Testbed DB access lib
from libdb import *
from WebTask import WebTask
from APT_ORM import UserJwtTokens
import AccessCheck

LOG = logging.getLogger("uvicorn.error")

router = APIRouter(
    prefix="/version",
    tags=["version"]
)

@router.get("/")
def get_version(
        current_user: Annotated[object, Depends(get_current_user)],
        DB: Session = Depends(get_DB)) -> Version:
    LOG.info("get_version: %r", current_user)

    qres = DBQueryWarn("select * from version_info", asDict=True)
    if qres == None or len(qres) == 0:
        raise PortalException(
            FStatus.HTTP_404_NOT_FOUND, "No version info available")

    commit = None
    version = None
    major = None
    minor = None
    stamp = None

    for row in qres:
        name  = row["name"]
        value = row["value"]

        if name == "commit":
            commit = value
        elif name == "dbrev":
            version = value
            (major,minor) = version.split(".")
        elif name == "buildinfo":
            stamp = datetime.strptime(value, "%m/%d/%Y").strftime("%Y-%m-%dT%H:%M:%SZ")
        pass

    return Version(
        commit=commit,
        version=version,
        build_timestamp=stamp,
        major=int(major),
        minor=int(minor),
        patch=0,
    )
