import traceback
from fabrictestbed_extensions.fablib.fablib import FablibManager

FABRIC_RC = "./fabric_rc"

try:
    fablib = FablibManager(fabric_rc=FABRIC_RC, auto_token_refresh=False)
    fablib.show_config()

    # Create a slice
    slice = fablib.new_slice(name="myslice2")

    # List of interfaces for the L2 network.
    interfaces = []

    facility_port = slice.add_facility_port(name="CloudLab-Clemson",
                                            site="CLEM", vlan="3157")
    facility_port_iface = facility_port.get_interfaces()[0]
    interfaces.append(facility_port_iface)

    facility_port = slice.add_facility_port(name="Utah-Cloudlab-Powder",
                                            site="UTAH", vlan="3400")
    facility_port_iface = facility_port.get_interfaces()[0]
    interfaces.append(facility_port_iface)

    print(str(interfaces))

    # Layer 2 network
    net = slice.add_l2network(name='link', interfaces=interfaces, type='L2STS')

    # Submit the Request
    slice.submit()
except Exception as e:
    print(traceback.format_exc())
    print(f"Exception: {e}")
