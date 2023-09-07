import argparse
import traceback
import sys
from fabrictestbed_extensions.fablib.fablib import FablibManager

#
# The argument is a site name.
#
parser = argparse.ArgumentParser()
parser.add_argument('--site', required=True, metavar='<site>')
parser.add_argument('--asjson', action='store_true')

def usage():
    print(parser.usage())
    sys.exit(-1)
    pass

args = parser.parse_args()

try:
  fablib = FablibManager()
  
  fablib.show_config()
  print(fablib.get_site_advertisement(args.site))

except Exception as e:
  print(traceback.format_exc())
  print(f"Exception: {e}")
