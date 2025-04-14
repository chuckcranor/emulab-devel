# -*- python -*-
#
# Copyright (c) 2000-2025 University of Utah and the Flux Group.
# 
# {{{EMULAB-LICENSE
# 
# This file is part of the Emulab network testbed software.
# 
# This file is free software: you can redistribute it and/or modify it
# under the terms of the GNU Affero General Public License as published by
# the Free Software Foundation, either version 3 of the License, or (at
# your option) any later version.
# 
# This file is distributed in the hope that it will be useful, but WITHOUT
# ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
# FITNESS FOR A PARTICULAR PURPOSE.  See the GNU Affero General Public
# License for more details.
# 
# You should have received a copy of the GNU Affero General Public License
# along with this file.  If not, see <http://www.gnu.org/licenses/>.
# 
# }}}
#
import sys
import os
from . import config

import logging
from fastapi import Depends, FastAPI, Header, Request
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware

from .routers import experiments
from .routers import resgroups
from .routers import profiles
from .dependencies import PortalException, get_current_user
from .api.models import Error

origins = [
    "http://localhost",
    "http://gitlab.flux.utah.edu"
]

LOG = logging.getLogger("uvicorn.error")
LOG.setLevel(logging.INFO)

app = FastAPI(
    dependencies=[Depends(get_current_user)]
)

@app.exception_handler(PortalException)
def portal_exception_handler(request: Request, exc: PortalException):
    return JSONResponse(
        status_code=exc.code,
        content=Error(error = exc.message, code = exc.code).model_dump()
    )

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request, exc):
    return JSONResponse(
        status_code=400,
        content=Error(error = str(exc), code = 400).model_dump()
    )

@app.get("/")
async def root():
    return {"message": "Cloudlab Portal API Server"}

app.include_router(experiments.router)
app.include_router(resgroups.router)
app.include_router(profiles.router)
