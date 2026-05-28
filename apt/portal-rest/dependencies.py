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
from . import config

import subprocess, shlex
import time
from datetime import datetime, timezone
import logging
from typing import Annotated
from fastapi import Header, HTTPException, status, Depends
from fastapi.exceptions import RequestValidationError
import jwt
from cryptography.x509 import load_pem_x509_certificate
from cryptography.hazmat.primitives import serialization

# Emulab
import AccessCheck
import emutil

#sqlalchemy
from sqlalchemy.orm import Session
from sqlalchemy import text 
from .database import get_DB, DBQuery

LOG = logging.getLogger("uvicorn.error")

class PortalException(Exception):
    def __init__(self, code, message: str):
        self.code = code
        self.message = message
        pass
    pass

#
# Stub
#
def get_token_header(x_api_token: Annotated[str, Header()]):
    #LOG.info("API Token: %r", x_api_token)
    if not x_api_token or x_api_token == "":
        raise HTTPException(status_code=400, detail="X-API-Token header invalid")
    return x_api_token

#
# Check for elaborate header
#
def get_elaborate_header(x_api_elaborate: Annotated[str, Header()] = None):
    if not x_api_elaborate or x_api_elaborate == "":
        return False
    return True

#
# Convert the api_token to a user access object
#
def get_current_user(x_api_token: Annotated[str, Header()], DB : Session = Depends(get_DB)):
    if not x_api_token or x_api_token == "":
        raise HTTPException(status_code=400, detail="X-API-Token header invalid")
    try:
        claims = DecodeToken(x_api_token)
    except Exception as exc:
        raise HTTPException(status_code=400,
                            detail="Token invalid: " + str(exc))
    LOG.info("Current user claims: %r", claims)

    #
    # We store the token data in the DB, so for now we actually
    # do not bother with what is in the token.
    #
    result = DBQuery(DB,
        text("select *,UNIX_TIMESTAMP(expires) as unixexp " +
                       "  from user_jwt_tokens " +
                       "  where uuid= :jti"),
                       {"jti" : claims["jti"]},
                       fatal=False
                    )
    qres = result.mappings().all() if result is not None else None
    if not qres or len(qres) != 1:
        raise HTTPException(status_code=401,
                            detail="Token has been revoked")
    
    token = qres[0]
    expires = token["unixexp"]
    if expires < time.time():
        raise HTTPException(status_code=401,
                            detail="Token has expired")

    role        = token["role"]
    uid_idx     = token["uid_idx"]
    scope_type  = token["scope_type"]
    scope_value = token["scope_value"]

    try:
        user = AccessCheck.User(
            uid_idx, role=role, scope=scope_type, scope_value=scope_value)
    except Exception as exc:
        raise HTTPException(status_code=401, detail=str(exc))
    
    LOG.info("Current user: %r", user)
    return user

#
# Convert our DB local times to GMT,
#
def TBDatetimeGMT(dtstr):
    if dtstr == None or dtstr == "":
        return None

    if dtstr == "now":
        dt = datetime.now()
        return dt.astimezone(timezone.utc)

    dtstr = str(dtstr)
    dt = datetime.fromisoformat(dtstr)
    return dt.astimezone(timezone.utc)

#
# Decode/Verify token and return user info.
#
def DecodeToken(token):
    with open(config.EMULAB_CERT, 'rb') as certfile:
        cert = load_pem_x509_certificate(certfile.read())
        certbytes = cert.public_key().public_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PublicFormat.SubjectPublicKeyInfo)

        # This will raise an exception.
        return jwt.decode(token, certbytes, algorithms=["RS256"],
                          options={"verify_signature" : True,
                                   "verify_exp" : True})
    pass

#
# Validate a list of fields coming in.
#
def PortalValidate(instance, validation, strict=True):
    model_dict = instance.model_dump()
    validator  = emutil.ValidateSlots()
    for key,value in model_dict.items():
        if not key in validation:
            if strict:
                raise RequestValidationError(
                    "No validation recipe for '%r'" % (key))
            continue

        # If the recipe is present but not set, assume checked elsewhere.
        if validation[key] == None:
            continue
        
        table,column,reqopt = validation[key].split(":");
        if not table or not column or not reqopt:
            raise RequestValidationError(
                "Malformed validation recipe for '%r'" % (key))

        if reqopt == "required" and value == None:
            raise RequestValidationError(
                "Required field '%s' not provided" % (key))
        if value == None:
            continue

        if not validator.validate(value, table, column):
            raise RequestValidationError(
                "Validation error for field '%s' - %s" % (key, validator.lastError))
        pass
    pass

def PortalValidateOne(field, value, table, column):
    validator  = emutil.ValidateSlots()
    if not validator.validate(value, table, column):
        raise RequestValidationError(
            "Validation error for field '%s' - %s" % (field, validator.lastError))
    return True
    
#
# Return errors from shell commands.
# Positive error code goes to the user, negative error code goes to us.
#
def HandleShellError(completed, code = None, message = None):
    if completed.returncode > 0:
        if code == None:
            code = status.HTTP_400_BAD_REQUEST
            pass
        if message == None:
            message = completed.stdout
            pass
        raise PortalException(code, message)
    else:
        if message:
            LOG.info(message)
            pass
        LOG.info(completed.stdout)
        if code == None:
            code = status.HTTP_500_INTERNAL_SERVER_ERROR
            pass
        raise PortalException(code, "Internal server error")
    pass

#
# Use suexec to run a command as a uid/pid
#
def SUEXEC(user, group, command):
    if type(user) == str:
        uid = user
    else:
        uid = user.uid
        pass
    if type(group) == str:
        gid = group
    else:
        gid = group.unix_gid
        pass
    
    suexec_command = "%s %s %s %s" % (config.TBSUEXEC_PATH, uid, gid, command)
    LOG.info("SUEXEC: %s", suexec_command)

    completed = subprocess.run(shlex.split(suexec_command),
                               stdout=subprocess.PIPE, stderr=subprocess.STDOUT)

    # Odd.
    if completed.returncode == 255:
        completed.returncode = -1
        pass

    # suexec internal error.
    if (completed.returncode > 101 and completed.returncode <= 125 and
        completed.stdout == b""):
        LOG.info(completed)
        raise PortalException(
            status.HTTP_500_INTERNAL_SERVER_ERROR, "Internal server error")

    return completed
