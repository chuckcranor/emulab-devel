import argparse
import traceback
import sys
from fabrictestbed_extensions.fablib.fablib import FablibManager

FABRIC_RC = "./fabric_rc"

#
# The argument is a slice name.
#
parser = argparse.ArgumentParser()
parser.add_argument('--name', required=True, metavar='<slicename>')

def usage():
    print(parser.usage())
    sys.exit(-1)
    pass

args = parser.parse_args()

try:
    fablib = FablibManager(fabric_rc=FABRIC_RC, auto_token_refresh=False)

    slices = fablib.get_slices()
    for slice in slices:
        if slice.get_name() == args.name or slice.get_slice_id() == args.name:
            slice.delete()
            pass
        # Found a slice
        sys.exit(0)
        pass
    # Slice not found is okay
    sys.exit(0)

except Exception as e:
    print(traceback.format_exc())
    print(f"Exception: {e}")
    sys.exit(-1)
    pass
