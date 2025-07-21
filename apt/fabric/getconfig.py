import traceback
from os import getenv

from fabrictestbed_extensions.fablib.fablib import FablibManager

FABRIC_RC = "./fabric_rc"
LOG_FILE  = getenv("FABRIC_LOG_FILE")

try:
    fablib = FablibManager(
        fabric_rc=FABRIC_RC, log_file=LOG_FILE, auto_token_refresh=False)
    fablib.show_config()

except Exception as e:
    print(traceback.format_exc())
    print(f"Exception: {e}")
