import traceback
from fabrictestbed_extensions.fablib.fablib import FablibManager

try:
    fablib = FablibManager()
    fablib.show_config()

except Exception as e:
    print(traceback.format_exc())
    print(f"Exception: {e}")
