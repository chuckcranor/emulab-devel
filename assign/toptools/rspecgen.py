#! /usr/bin/env python

#
# EMULAB-COPYRIGHT
# Copyright (c) 2008 University of Utah and the Flux Group.
# All rights reserved.
#

#
# Converts the old .top files to RSpec
#

import datetime
import os
import re
from sys import argv
import xml.dom.minidom

# In case interface numbers are not specified for the source and destination of a link, assign an interface number to them. 
# The hope is that this number is large enough that it does not override genuine interface specified elsewhere in the file.
assignInterfaceNumber = 32768

# A dictionary containing all the interfaces seen that they can be added to the nodes more efficiently later
nodeInterfaceMap = {}

def main ():
	
	helpString = "[USAGE] vtopgen <filename> [<filename> ...][--pretty]"
	# At least one file should be specified
	if len(argv) < 2:
		print helpString
	else:
		# The generated file name has .top replaced with .rspec.xml appended to the name of the original top file.
		prettyOutput = False
		srcFileNames = []
		destFileNames = []
		for index in range (1, len(argv)):
			if argv[index] == "--pretty":
				prettyOutput = True
				print "WARNING: Some parsers might have trouble parsing the XML if pretty output is enabled"
			else:
				srcFileNames.append(argv[index])
				destFileNames.append(argv[index].rpartition(".")[0] + ".rspec.xml")
				
		for index in range(0,len(srcFileNames)):
			srcFileName = srcFileNames[index]
			destFileName = destFileNames[index]
			try:
				print "Generating " + destFileName + "...",
				valid = generateRspec (srcFileName, destFileName, prettyOutput)
				if (valid == False):
					print "There were errors in the .top file: " + srcFileName
					os.remove (destFileName)
				else:
					print "Done!"
			except IOError:
				print "Could not read from " + srcFileName + ". Check the file path and retry"
			except ConversionException, (e):
				print e.parameter

# Converts a .top file into a .rspec file. 
def generateRspec (srcFileName, destFileName, prettyOutput):
	# This keeps track of whether or not the conversion is useful
	valid = True

	topFile = open (srcFileName, "r")
	
	# Stores all the hints specified in the .top file
	# This is just in case where there are forward references 
	hints = {}
	
	# Stores all the forcibly assignments specified in the .top file
	# This is just in case there are forward references
	assigns = {}
	
	xmlDocument = xml.dom.minidom.Document()
	
	root = xmlDocument.createElement("rspec")
	root.setAttribute ("type", "request")
	root.setAttribute ("generated", datetime.datetime.now().strftime('%Y-%m-%dT%H:%M:%S'))
	
	#TODO: Currently the file is valid for exactly 24 hours. This will definitely need to be changed at some point
	root.setAttribute ("valid_until", (datetime.datetime.now() + datetime.timedelta(1)).strftime('%Y-%m-%dT%H:%M:%S'))
	
	root.setAttribute ("xmlns", "http://www.protogeni.net/resources/rspec/0.1")
	xmlDocument.appendChild(root)

	#Split each line of the *.top file on the basis of spaces between terms
	splitPattern = re.compile("\\s+")
	
	lineNumber = 0
	for line in topFile:
		splitLine = splitPattern.split(line)
		lineNumber = lineNumber + 1
	
		# If the line specifies a node...
		if (splitLine [0] == "node"):
			processNodeLine (splitLine,xmlDocument, root)	
	
		# If the line describes a link
		elif (splitLine [0] == "link"):
			processLinkLine (splitLine,xmlDocument, root)	
		
		# TODO: There are no vclasses in RSpec. Am leaving this here for the moment in case this changes.
		# -----------------------------------------------------------------------------------------------
		## If the line specifies a virtual class
		#elif (splitLine[0] == "make-vclass"):
			#processVClassLine (splitLine,xmlDocument, root)

		# TODO: These are commented out for the moment until we decide exactly which should be included.
		# -----------------------------------------------------------------------------------------------
		## If the line is a hint-line.
		#elif (splitLine [0] == "node-hint"):
			#processHintNodeLine (splitLine,xmlDocument, root)
				
		# If the line is a forced assignment line.
		elif (splitLine[0] == "fix-node"):
			processFixNodeLine (splitLine,xmlDocument, root)
			
	## Add hints to the nodes in the XML file
	#for node, hint in hints.iteritems():
		#addAttributeToNode (xmlDocument, node, "hint_to", hint)
		
	# XXX: This is a problem. In the .top files, we have human-readable names for the physical nodes 
	# to which the virtual ones are assigned. We have no way of accessing the component_uuid's or the component manager uuid.
	# XXX: This is commented for the moment till we figure out what to do with it.
	# If any nodes have been forcefully assigned, add the assignments
	#for node, assigned in assigns.iteritems():
		#addAttributeToNode (xmlDocument, node, "assigned_to", assigned)
		 
	valid = sanityChecks (xmlDocument)
	processInterfaceDecls(xmlDocument, root)
			 
	# Write out the XML file
	rspecFile = open (destFileName, "w")
	if (prettyOutput == True):
		xmlDocument.writexml (rspecFile,"\t","\t","\n") 
	else:
		xmlDocument.writexml (rspecFile)
	
	rspecFile.close ()

	topFile.close ()
	
	return valid
#End function generateRspec

# Does a whole bumch of checks to ensure everthing is as it should be
def sanityChecks (xmlDocument):
	valid = True
	# If there is a node specified as a source/destination for any interface,
	# we need to make sure that it exists.
	# Since we are being nice and letting users specify nodes in interfaces without having to first declare them,
	# we need to jump through some hoops here to make sure that things are as they should be.
	xmlNodes = xmlDocument.getElementsByTagName("node")
	nodes = []
	for node in xmlNodes:
		nodes.append(node.attributes["virtual_id"].nodeValue)
		
	nodesInInterfaces = nodeInterfaceMap.keys()
	for key in nodesInInterfaces:
		if (key not in nodes):
			valid = False
			break
	
	return valid
	

# Add InterfaceDecl's to the node.
def processInterfaceDecls (xmlDocument, root):
	nodes = xmlDocument.getElementsByTagName("node")
	for node in nodes:
		nodeID = node.attributes["virtual_id"].nodeValue
		if (nodeInterfaceMap.has_key(nodeID)):
			interfaces = nodeInterfaceMap[nodeID].split("/")
			for interface in interfaces: 
				newInterfaceNode = addNode (xmlDocument, node, "interface")
				newInterfaceNode.setAttribute ("virtual_id", interface)

# Process a node line
def processNodeLine (splitLine, xmlDocument, root):
	# To keep track of whether or not a features and desires element has been added to the current node
	addedFeatureDesireSpecNode = False

	# Add attributes to the node
	newNode = addNode (xmlDocument, root, "node")
	# TODO: Currently the ID for the node is the same as the name. 
	# This has to change to something more appropriate
	newNode.setAttribute ("virtual_id", splitLine[1])
	# TODO: Currently, all nodes are listed as being emulab nodes.
	# Possibly, we can look at the node name and decide whether or not it is PlanetLab node
	newNode.setAttribute ("virtualization_type", "emulab-vnode")

	newNodeTypeNode = addNode (xmlDocument, newNode, "node_type")
	# The number of type_slots is optional. Default to 1. 
	# If there is no ':' in the name, then the number of slots is 1, else it is whatever number follows the ':'
	nodeTypeNameAndSlot = splitLine[2].split(":")
	nodeTypeName = nodeTypeNameAndSlot[0]
	nodeTypeSlots = 1
	if (len(nodeTypeNameAndSlot) == 2):
		nodeTypeSlots = nodeTypeNameAndSlot[1]

	# If the name starts with a *, the the node is to be marked static
	isNodeStatic = False
	if (nodeTypeName[0] == "*"):
		nodeTypeName = nodeTypeName[1:]
		isNodeStatic = True
		
	newNodeTypeNode.setAttribute("type_name", nodeTypeName)
	#addNodeWithText (xmlDocument, newNodeTypeNode, "type_name", nodeTypeName)
	# If the number of slots is *, then the number of slots is unlimited
	if (nodeTypeSlots == "*"):
		newNodeTypeNode.setAttribute("type_slots", "unlimited")
	else:
		newNodeTypeNode.setAttribute("type_slots", str(nodeTypeSlots))
	
	if (isNodeStatic):
		newNodeTypeNode.setAttribute("static", "true")
	
## TODO: We need to decide how to deal with static nodes	
	#if (isNodeStatic):
		#addNode (xmlDocument, newNodeTypeNode, "static")

# TODO: Confirm that this stuff is not part of the RSpec
	## Iterate through all the optional parameters on the line	
	#for index in range(3, len(splitLine)):

		##If disallow_trivial_mix is present, put it under the NodeFlagSpec
		#if (splitLine[index] == "disallow_trivial_mix"):
			#addNode (xmlDocument, newNode, splitLine[index])
		##If subnode_of is present, find the parent node and add the appropriate node under NodeFlagSpec
		#elif (splitLine[index].startswith("subnode_of")):
			#(subNodeOf, parentNode) = splitLine[index].split(":")
			#addNodeWithText(xmlDocument, newNode, "subnode_of", parentNode)
			
## TODO: Features and desires are not part of rspec. Am leaving this here for the  moment
## in case we have extensions where we will need to add this stuff.
## This needs to be checked out and fixed as fast as possible			
			
		## If an optional desire is present, put it under the features and desires node
		#elif (splitLine[index].find(":") != -1):
			
			#newFeatureDesireSpecNode = addNode (xmlDocument, newNode, "fd")
								
			## The feature name is optionally prepended with a 2 character prefix.
			## Detect the prefix and remove it from the feature name as appropriate
			#(featureName, featureWeight) = splitLine[index].split(":")
			#if (featureName[0] != "*" and featureName[0] != "?"):
				#addNodeWithText(xmlDocument, newFeatureDesireSpecNode, "fd_name", featureName)
			#else:
				#addNodeWithText(xmlDocument, newFeatureDesireSpecNode, "fd_name", featureName[2:])

			#addNodeWithText(xmlDocument, newFeatureDesireSpecNode, "fd_weight", featureWeight)
			#if (float(featureWeight) >= 1.000000):
				#addNode (xmlDocument, newFeatureDesireSpecNode, "violatable")

			## The desire prefix is "*!"
			#if (featureName[1] == "!"):
				#newGlobalNode = addNode (xmlDocument, newFeatureDesireSpecNode, "global")
				#addNodeWithText(xmlDocument, newGlobalNode, "operator", "OnceOnly") 
			## The desire prefix is "*&"
			#elif (featureName[1] == "&"):
				#newGlobalNode = addNode (xmlDocument, newFeatureDesireSpecNode, "global")
				#addNodeWithText(xmlDocument, newGlobalNode, "operator", "FirstFree") 
			## The desire prefix is "?+"
			#elif (featureName[1] == "+"):
				#newLocalNode = addNode (xmlDocument, newFeatureDesireSpecNode, "local")
				#addNodeWithText (xmlDocument, newLocalNode, "operator", "+")

# Process a link line
# NOTES: assignInterfaceNumber is going to be modified whenever it is used
def processLinkLine (splitLine, xmlDocument, root):
	# XXX: Global variables are evil, I know but there didn't seem to be a nicer way of doing this
	# without having to use classes. And honestly, that seems like overkill for something like this
	global assignInterfaceNumber
	global nodeInterfaceMap

	newLinkNode = addNode(xmlDocument, root, "link")
	# TODO: This has to be a real ID at some point
	newLinkNode.setAttribute ("virtual_id", splitLine[1])
	# TODO: This looks weird here but it needs to be there 
	# to make sure that only virtual links that require
	# multiplexing on a physcial link get multiplexed
	newLinkNode.setAttribute ("virtualization_type", "emulab-vnode")
	
	# Find the source name and the source interface. 
	# If the node has no interface specified, assign it a "safe" interface number
	# Increment the interface number
	srcNameInterface = splitLine[2]
	if (srcNameInterface.find(":") != -1):
		(srcName, srcInterface) = srcNameInterface.split(":")
	else:
		srcName = srcNameInterface
		srcInterface = str(assignInterfaceNumber)
		assignInterfaceNumber = assignInterfaceNumber + 1
	
	# Do the same thing for the destination interface
	destNameInterface = splitLine [3]
	if (destNameInterface.find(":") != -1):
		(destName, destInterface) = destNameInterface.split(":")
	else:
		destName = destNameInterface
		destInterface = str(assignInterfaceNumber)
		assignInterfaceNumber = assignInterfaceNumber + 1
	
	# Process the link end points 
	# First the source element
	# Add a source interface element
	virtualSrcNodeID = srcName
	virtualSrcInterfaceName = srcInterface
	interfaceNode = addNode(xmlDocument, newLinkNode, "interface")
	interfaceNode.setAttribute("virtual_node_id", virtualSrcNodeID)
	interfaceNode.setAttribute("virtual_interface_name", virtualSrcInterfaceName)
	
	# Then the destination element
	# Add a destination interface element
	virtualDestNodeID = destName
	virtualDestInterfaceName = destInterface
	interfaceNode = addNode(xmlDocument, newLinkNode, "interface")
	interfaceNode.setAttribute("virtual_node_id", virtualDestNodeID)
	interfaceNode.setAttribute("virtual_interface_name", virtualDestInterfaceName)
	
	# Add both the source and destinations to the dictionary
	if (nodeInterfaceMap.has_key(virtualSrcNodeID)):
		nodeInterfaceMap [virtualSrcNodeID] = nodeInterfaceMap[virtualSrcNodeID] + "/" + virtualSrcInterfaceName
	else:
		nodeInterfaceMap [virtualSrcNodeID] = virtualSrcInterfaceName
		
	if (nodeInterfaceMap.has_key(virtualDestNodeID)):
		nodeInterfaceMap [virtualDestNodeID] = nodeInterfaceMap[virtualDestNodeID] + "/" + virtualDestInterfaceName
	else:
		nodeInterfaceMap [virtualDestNodeID] = virtualDestInterfaceName
	
	# Add other stuff that appears on the line. These are the link characteristics
	addNodeWithText(xmlDocument, newLinkNode, "bandwidth", splitLine[4])
	addNodeWithText(xmlDocument, newLinkNode, "latency", splitLine[5])
	addNodeWithText(xmlDocument, newLinkNode, "packet_loss", splitLine[6])
	
	# Add a link_type element
	newLinkTypeNode = addNode (xmlDocument, newLinkNode, "link_type")
	newLinkTypeNode.setAttribute("type_name", splitLine[7])
	
## TODO: Confirm that link flags have no place in RSpec
## This needs to be done as soon as possible
	
	## Run through the optional parameters at the end of the line
	for index in range(8, len(splitLine)):
		# If fixsrciface or fixdstiface are found
		#if (splitLine[index].find(":") != -1):
			#(fixIface, ifaceName) = splitLine[index].split(":")
			#addNodeWithText(xmlDocument, newLinkNode, fixIface, ifaceName)
		if (splitLine[index] == "emulated"):
			newLinkNode.setAttribute ("virtualization_type", "raw")
		#elif(splitLine[index] != ""):
			#addNode(xmlDocument, newLinkNode, splitLine[index])

# Process a link line
def processVClassLine (splitLine, xmlDocument, root):
	newVClassNode = addNode (xmlDocument, root, "vclass")
	newVClassNode.setAttribute ("name", splitLine[1])
	
	# TODO: Need to take care of the hard case later
	addNode (xmlDocument, newVClassNode, "soft")
	addNodeWithText (xmlDocument, newVClassNode, "weight", splitLine[2])
	
	# The remaining entries on this line will be physical_types.
	for index in range(3, len(splitLine)):
		if (splitLine[index] != ""):
			addNodeWithText (xmlDocument, newVClassNode, "physical_type", splitLine[index])

# Process a link line
def processFixNodeLine (splitLine, xmlDocument, root):
	# If multiple assignments are provided for the same node, an error is displayed. 
	# If the node is being assigned for the first time, it is added to the assigns dictionary
	if (assigns.has_key(splitLine[1]) == True):
		raise ConversionException ("Multiple assignments specified for the same node '" + splitLine[1] + "'", lineNumber, lines)
	else:
		assigns[splitLine[1]] = splitLine[2]

# Process a link line
def processHintNodeLine (splitLine, xmlDocument, root):
	# If multiple hints are provided for the same node, an error is displayed. 
	# If a hint is being provided for the node for the first time, it is added to the hints dictionary
	if (hints.has_key(splitLine[1]) == True):
		raise ConversionException ("Multiple hints specified for the same node '" + splitLine[1] + "'", lineNumber, line)
	else:
		hints[splitLine[1]] = splitLine[2]

# A custom exception class in case something bad happens
class ConversionException(Exception):
	def __init__ (self, message, lineNumber, line):
		self.parameter = "CONVERSION EXCEPTION\nLine " + str(lineNumber) + ": " + line + "\n" + message
	def __str__(self):
		return repr(self.message)

# Creates a child node with name "nodeName" whose parent is "parent" in the XML document "document" 
def addNode (document, parent, nodeName):
    newNode = document.createElement (nodeName)
    parent.appendChild(newNode)
    return newNode

# Creates a child node with name "nodeName" whose parent is "parent" in the XML document "document" 
# The child node has a textnode within it with the text "NodeText"
def addNodeWithText (document, parent, nodeName, nodeText):
    newNode = document.createElement(nodeName)
    newTextNode = document.createTextNode(nodeText)
    newNode.appendChild(newTextNode)
    parent.appendChild(newNode)

# Adds an attribute to the element whose name attribute is "elementName" 
def addAttributeToNode (document, elementName, attributeName, attributeValue):
	# document.childNodes[0] gives you the root node 
	# Calling childNodes on that gives all the nodes in the document
	for node in document.childNodes[0].childNodes:
		if (node.attributes["name"].value == elementName):
			node.setAttribute (attributeName, attributeValue)
	
# Call the main function if this is called from the command line
if __name__ == "__main__":
    main ()
    