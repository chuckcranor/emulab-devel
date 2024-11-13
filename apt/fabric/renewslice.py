import argparse
import traceback
import sys
from fabrictestbed_extensions.fablib.fablib import FablibManager

FABRIC_RC = "./fabric_rc"

#
# The argument is a slice name.
#
parser = argparse.ArgumentParser()
parser.add_argument('--sliceid', required=True, metavar='<sliceid>')
parser.add_argument('--when', required=True, metavar='<UTC>')

def usage():
    print(parser.usage())
    sys.exit(-1)
    pass

args = parser.parse_args()

try:
    # Hardwired in the code.
    fablib = FablibManager(fabric_rc=FABRIC_RC, auto_token_refresh=False)
    fablib.show_config()
    slices = fablib.get_slices()
    for slice in slices:
        if slice.get_slice_id() == args.sliceid:
            slice.renew(args.when)
            sys.exit(0)
            pass
        pass
    # Slice not found.
    sys.exit(1)

except Exception as e:
    print(traceback.format_exc())
    print(f"Exception: {e}")
    sys.exit(-1)
    pass
