from fabrictestbed_extensions.fablib.fablib import FablibManager

import traceback

try:
  fablib = FablibManager()
  
  fablib.show_config()
  print(fablib.get_site_advertisement("UTAH"))

except Exception as e:
  print(traceback.format_exc())
  print(f"Exception: {e}")
