from fabrictestbed_extensions.fablib.fablib import FablibManager

import traceback

try:
  fablib = FablibManager()

  fablib.show_config()

  # Create a slice
  slice = fablib.new_slice(name="hello_fabric")

  # Add a node
  node = slice.add_node(name='node1')

  # Submit the Request
  slice.submit()


  for node in slice.get_nodes():
    stdout, stderr = node.execute('echo Hello, FABRIC from node `hostname -s`')
except Exception as e:
  print(traceback.format_exc())
  print(f"Exception: {e}")
