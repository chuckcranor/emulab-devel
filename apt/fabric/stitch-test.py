import traceback
from ipaddress import ip_address, IPv4Address, IPv4Network

from fabrictestbed_extensions.fablib.fablib import FablibManager
from fabrictestbed.slice_editor import (
    ExperimentTopology,
    Capacities,
    ComponentType,
    ComponentModelType,
    ServiceType,
    ComponentCatalog,
)
from fabrictestbed.slice_manager import SliceManager, Status, SliceState
from fabrictestbed.util.constants import Constants

try:
    fablib = FablibManager()
    fablib.show_config()

    # Create a slice
    slice = fablib.new_slice(name="myslice")

    # List of interfaces for the L2 network.
    interfaces = []

    # Add the Facility Port at Starlight
    facility_port = slice.add_facility_port(name="OCT-MGHPCC",
                                            site="MASS", vlan="3118")
    facility_port_iface = facility_port.get_interfaces()[0]
    interfaces.append(facility_port_iface)

    # Add the corresponding port at Cloudlab Utah.
    facility_port = slice.add_facility_port(name="Utah-Cloudlab-Powder",
                                            site="UTAH", vlan="3102")
    facility_port_iface = facility_port.get_interfaces()[0]
    interfaces.append(facility_port_iface)

    # Layer 2 network
    net = slice.add_l2network(name='link', interfaces=interfaces)

    # Submit the Request
    slice.submit()
except Exception as e:
    print(traceback.format_exc())
    print(f"Exception: {e}")
