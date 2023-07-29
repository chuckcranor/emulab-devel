#
# Copyright (c) 2008-2023 University of Utah and the Flux Group.
# 
# {{{GENIPUBLIC-LICENSE
# 
# GENI Public License
# 
# Permission is hereby granted, free of charge, to any person obtaining
# a copy of this software and/or hardware specification (the "Work") to
# deal in the Work without restriction, including without limitation the
# rights to use, copy, modify, merge, publish, distribute, sublicense,
# and/or sell copies of the Work, and to permit persons to whom the Work
# is furnished to do so, subject to the following conditions:
# 
# The above copyright notice and this permission notice shall be
# included in all copies or substantial portions of the Work.
# 
# THE WORK IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
# OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
# MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
# NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
# HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
# WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
# OUT OF OR IN CONNECTION WITH THE WORK OR THE USE OR OTHER DEALINGS
# IN THE WORK.
# 
# }}}
#
import argparse
import traceback
import sys

from fabrictestbed_extensions.fablib.fablib import FablibManager

#
# Map the site name to the facility port name.
#
FABRICNAMES = {
    "UTAH" : "Utah-Cloudlab-Powder",
    "MASS" : "OCT-MGHPCC",
    "CLEM" : "Clemson-CloudLab"
}

#
# The required argument is a slice name
#
parser = argparse.ArgumentParser()

def usage():
    print(parser.usage())
    sys.exit(-1)
    pass

#
# The arguments are a slice name and a list of links.
# Each link is linkname:site1:tag1,site2:tag2
#
parser = argparse.ArgumentParser()
parser.add_argument('-n', '--impotent', action='store_true')
parser.add_argument('--logfile',
                    help='Filename for fablib debug log')
parser.add_argument('--name', required=True,
                    metavar='<pid-eid>')
parser.add_argument('--links', nargs='+',
                    metavar='linkname,site1:tag1,site2:tag2')

def usage():
    print(parser.usage())
    sys.exit(-1)
    pass

args = parser.parse_args()

fablib = FablibManager(log_file=args.logfile)

# Create a slice
slice = fablib.new_slice(name=args.name)

for link in args.links:
    tokens = link.split(',')
    if len(tokens) != 3:
        usage()
        pass
    linkname = tokens[0]
    site1 = tokens[1].split(':')
    site2 = tokens[2].split(':')
    if len(site1) != 2 or len(site2) != 2:
        usage()
        pass
    site1site,site1tag = site1
    site2site,site2tag = site2

    site1name = FABRICNAMES[site1site]
    site2name = FABRICNAMES[site2site]

    print("Adding link " + linkname)

    # Facility Port at site1
    print("  Adding facility port 1: " + site1name + ":" + site1tag);
    facility_port_1 = slice.add_facility_port(name=site1name,
                                              site=site1site, vlan=site1tag)
    facility_port_iface_1 = facility_port_1.get_interfaces()[0]

    # Facility Port at site2
    print("  Adding facility port 2: " + site2name + ":" + site2tag);
    facility_port_2 = slice.add_facility_port(name=site2name,
                                              site=site2site, vlan=site2tag)
    facility_port_iface_2 = facility_port_2.get_interfaces()[0]

    # Layer 2 network
    slice.add_l2network(name=linkname,
                        interfaces=[facility_port_iface_1,
                                    facility_port_iface_2], type='L2STS')
    pass

fablib.show_config()

if args.impotent:
    print("Not stitching as directed")
else:
    try:
        # Submit the Request
        print("Submitting the slice request")
        slice.submit()
    except Exception as e:
        print(traceback.format_exc())
        print(f"Exception: {e}")
        sys.exit(-1)
        pass
    pass

