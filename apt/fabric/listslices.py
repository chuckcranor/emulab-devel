import argparse
import traceback
import sys
from fabrictestbed_extensions.fablib.fablib import FablibManager

FABRIC_RC = "./fabric_rc"

parser = argparse.ArgumentParser()
parser.add_argument('-j', '--json', action='store_true')

def usage():
    print(parser.usage())
    sys.exit(-1)
    pass

args = parser.parse_args()
if args.json:
    output ="json"
else:
    output = "text"
    pass

try:
    fablib = FablibManager(fabric_rc=FABRIC_RC, auto_token_refresh=False)
    fablib.list_slices(output=output, fields=['id','name','state','lease_end'])

except Exception as e:
    print(traceback.format_exc())
    print(f"Exception: {e}")
    sys.exit(-1)
    pass
