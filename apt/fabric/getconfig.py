import traceback
from fabrictestbed_extensions.fablib.fablib import FablibManager

FABRIC_RC = "./fabric_rc"

try:
    fablib = FablibManager(fabric_rc=FABRIC_RC, auto_token_refresh=False)
    fablib.show_config()

except Exception as e:
    print(traceback.format_exc())
    print(f"Exception: {e}")
