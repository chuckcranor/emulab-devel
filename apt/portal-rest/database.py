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
import logging
import traceback, sys
from . import config
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.exc import OperationalError, SQLAlchemyError
from contextvars import ContextVar

from libtestbed import *

LOG = logging.getLogger("uvicorn.error")

__dbQueryMaxtries = 2
__dbMailOnFail = True
__dbFailMailAddr = config.DB_FAIL_MAIL_ADDR

engine = create_engine(config.DATABASE_URL, echo=False, pool_recycle=3600)
SessionLocal = sessionmaker(autoflush=True, bind=engine)

db_session : ContextVar = ContextVar('db_session', default=None)

def get_current_db():
    return db_session.get()

def get_DB():
    yield db_session.get()

def DBQuery(DB, stmt, params=None, *, fatal=False):
    params = params or {}
    last_exc = None
    tries = __dbQueryMaxtries
    for _ in range(tries):
        try:
            return DB.execute(stmt, params)
        except OperationalError as e:
            last_exc = e
            LOG.warning("Error: could not reconnect to mysqld!, %s", e)
            DB.rollback()
        except SQLAlchemyError as e:
            last_exc = e
            tbmsg = f"{stmt}\n{params}\n\n{traceback.format_exc()}"
            if __dbMailOnFail:
                SENDMAIL(__dbFailMailAddr, "DB query failed", f"DB query failed:\n\n{tbmsg}",
                         __dbFailMailAddr)
            break
            
    if fatal:
        raise RuntimeError("DBQuery failed") from last_exc
    return None

