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
import time
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Header, Response, status
from fastapi import Query, Path, Body
from fastapi import status as FStatus
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from sqlalchemy import select, text
from sqlalchemy.orm import Session

from ..database import get_DB, DBQuery
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
    Token,
    RawToken,
    TokenRole,
    TokenScope,
    Auth0TokenRequest
)

# Testbed DB access lib
from ..WebTask import WebTask
from APT_ORM import UserJwtTokens, UserSsoCodes
import AccessCheck

MANAGETOKENS = "webmanage_tokens"

LOG = logging.getLogger("uvicorn.error")

router = APIRouter(
    prefix="/tokens",
    tags=["tokens"]
)

@router.get("/this")
def get_token(
        current_user: Annotated[object, Depends(get_current_user)],
        x_api_token: Annotated[str, Header()],
        DB: Session = Depends(get_DB)) -> Token:
    LOG.info("get_token: %r", current_user)

    # The token is already verified.
    try:
        claims = DecodeToken(x_api_token)
    except Exception as exc:
        raise HTTPException(status_code=400,
                            detail="Token invalid: " + str(exc))

    return ConstructToken(DB, claims["jti"])

#
# Refresh token.
#
@router.put("/this/refresh", status_code=FStatus.HTTP_201_CREATED)
def refresh_token(
        current_user: Annotated[object, Depends(get_current_user)],
        x_api_token: Annotated[str, Header()],
        DB: Session = Depends(get_DB)) -> Token:
    LOG.info("refresh_token: %r", current_user)

    # The token is already verified.
    try:
        claims = DecodeToken(x_api_token)
    except Exception as exc:
        raise HTTPException(status_code=400,
                            detail="Token invalid: " + str(exc))

    webtask = WebTask.CreateAnonymous()
    command = MANAGETOKENS + " -t " + webtask.task_id + " "
    command  = command + " create -r " + current_user.uid

    completed = SUEXEC(current_user, "nobody", command);
    if completed.returncode != 0:
        webtask.Delete()
        return HandleShellError(completed)

    webtask.Refresh()
    token = webtask["result"]

    try:
        claims = DecodeToken(token)
    except Exception as exc:
        raise HTTPException(status_code=500,
                            detail="New Token invalid: " + str(exc))

    return ConstructToken(DB, claims["jti"])

#
# Redeem a code to get an auth0 token for a user. RDZ SSO
#
@router.post("/redeem", status_code=status.HTTP_201_CREATED)
def get_redeem(
        stuff: Auth0TokenRequest = None,
        DB: Session = Depends(get_DB)) -> RawToken:
    LOG.info("get_redeem: %r", stuff)

    if stuff == None or not hasattr(stuff, "code") or stuff.code == None:
        raise PortalException(
            status.HTTP_400_BAD_REQUEST, "Must supply a code")
    code = stuff.code

    if not re.match("^([\w]+)$", code):
        raise PortalException(
            status.HTTP_400_BAD_REQUEST, "Invalid code")

    # Validate the code here.
    stmt = select(UserSsoCodes).where(text("code = :id"))
    result = DBQuery(DB, stmt, {'id': code}, fatal=False)
    row = result.first() if result is not None else None
    if row == None:
        raise HTTPException(
            status_code=404, detail="No such code " + str(code)
        )
    dbcode = row.UserSsoCodes
    expires = dbcode.expires.timestamp()
    LOG.info("row: %r", dbcode)
    LOG.info("expires: %r %r", expires, time.time())
    if time.time() > expires:
        DBQuery(DB, text(
            "delete from user_sso_codes where idx=:dbcode"),
                     {"dbcode" : dbcode.idx}, fatal=True
            )
        raise PortalException(
            status.HTTP_400_BAD_REQUEST, "Code has expired")

    # Use once, no errors tolerated
    DBQuery(DB,
        text("delete from user_sso_codes where idx=:dbcode"),
                 {"dbcode" : dbcode.idx}, fatal=True)

    # Now create the auth0 token (which is not stored in the DB).
    webtask = WebTask.CreateAnonymous()
    command = MANAGETOKENS + " -t " + webtask.task_id + " "
    command  = command + " create -Z " + dbcode.uid

    completed = SUEXEC(dbcode.uid, "nobody", command);
    if completed.returncode != 0:
        webtask.Delete()
        return HandleShellError(completed)

    webtask.Refresh()
    token = webtask["result"]
    
    return RawToken(token = token)

#
# Construct a Token that matches the openapi description.
#
def ConstructToken(DB: Session, token_uuid):
    stmt = select(UserJwtTokens).where(text("uuid = :id"))
    result = DBQuery(DB, stmt, {'id': token_uuid}, fatal=False)
    row = result.first() if result is not None else None
    if row == None:
        raise HTTPException(
            status_code=404, detail="No such token " + str(token_uuid)
        )            
    dbtoken = row.UserJwtTokens
    newtoken = Token(
        id = dbtoken.uuid,
        user = dbtoken.uid,
        token = dbtoken.token,
        issued_at = TBDatetimeGMT(dbtoken.issued),
        expires_at = TBDatetimeGMT(dbtoken.expires),
        role = TokenRole(dbtoken.role),
        scope = TokenScope(dbtoken.scope_type)
    )
    if dbtoken.scope_value:
        newtoken.scope_value = dbtoken.scope_value
        pass
    return newtoken
