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
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.exc import OperationalError, SQLAlchemyError
from contextvars import ContextVar

from libtestbed import SENDMAIL

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
            DB.rollback()
            last_exc = e
            LOG.warning("Error: could not reconnect to mysqld!, %s", e)
        except SQLAlchemyError as e:
            DB.rollback()
            last_exc = e
            tbmsg = f"{stmt}\n{params}\n\n{traceback.format_exc(*sys.exc_info())}"
            if __dbMailOnFail:
                SENDMAIL(__dbFailMailAddr, "DB query failed(Portal-Rest)", f"DB query failed:\n\n{tbmsg}",
                         __dbFailMailAddr)
            break
            
    if fatal:
        raise RuntimeError("DBQuery failed") from last_exc
    return None

@event.listens_for(engine.pool, "connect")
def log_connect(dbapi_connection, connection_record):
        LOG.info("New DB connection create")


@event.listens_for(engine.pool, "checkout")
def log_checkout(dbapi_connection, connection_record, connection_proxy):
    LOG.info(f"Connection checked out. Pool Status: {engine.pool.checkedout()}/{engine.pool.size()} active")

@event.listens_for(engine.pool, "checkin")
def log_checkin(dbapi_connection, connection_record):
    LOG.info(f"Connection returned to pool. Pool Status: {engine.pool.checkedout()}/{engine.pool.size()} active")