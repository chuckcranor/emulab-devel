#! /usr/bin/env python

#
# EMULAB-COPYRIGHT
# Copyright (c) 2008 University of Utah and the Flux Group.
# All rights reserved.
#

#
# Converts the old .top files to XML
#

import re
import sys
import xml.dom
import xml.dom.minidom

# In case interface numbers are not specified for the source and destination of a link, assign an interface number to them. 
# The hope is that this number is large enough that it does not override genuine interface specified elsewhere in the file.
assignInterfaceNumber = 32768

def main ():
	
	helpString = "[USAGE] vtopgen <filename> [<filename> ...]"
	# At least one file should be specified
	if len(sys.argv) < 2:
		print helpString
	else:
		# The generated file name has .top replaced with .vtop.xml in the name of the original top file.
		for index in range (1, len(sys.argv)):
			srcFileName = sys.argv[index]
			destFileName = srcFileName.rpartition(".")[0] + ".vtop.xml"
			try:
				print "Generating " + destFileName + "...",
				generateVtop (srcFileName, destFileName)
				print "Done!"
			except IOError:
				print "Could not read from " + srcFileName + ". Check the file path and retry"
			except ConversionException, (e):
				print e.parameter

# Converts a .top file into a .xml file. 
def generateVtop (srcFileName, destFileName):

	topFile = open (srcFileName, "r")
	
	# Stores all the hints specified in the .top file
	# This is just in case where there are forward references 
	hints = {}
	
	# Stores all the forcibly assignments specified in the .top file
	# This is just in case there are forward references
	assigns = {}
	
	# In case interface numbers are not specified for the source and destination of a link, assign an interface number to them. 
	# The hope is that this number is large enough that it does not override genuine interface specified elsewhere in the file.
	assignInterfaceNumber = 32768
	
	xmlDocument = xml.dom.minidom.Document()
	
	root = xmlDocument.createElement("vtop")
	root.setAttribute ("pid", "testbed1")
	root.setAttribute ("eid", "xmltop")
	root.setAttribute ("xmlns", "http://emulab.net/resources/vtop/0.2")
	xmlDocument.appendChild(root)

	# Split each line of the *.top file on the basis of spaces between terms
	splitPattern = re.compile("\\s+")
	
	lineNumber = 0
	for line in topFile:
		splitLine = splitPattern.split(line)
		lineNumber = lineNumber + 1
	
		# If the line specifies a node...
		if (splitLine [0] == "node"):
			processNode(splitLine, xmlDocument, root)
	
		# If the line describes a link
		elif (splitLine [0] == "link"):
			processLink(splitLine, xmlDocument, root)
		
		# If the line specifies a virtual class
		elif (splitLine[0] == "make-vclass"):
			processVClass (splitLine, xmlDocument, root)			
			
		# If the line is a hint-line.
		elif (splitLine [0] == "node-hint"):
			processHintNodeLine (splitLine, xmlDocument, root)
				
		# If the line is a forced assignment line.
		elif (splitLine[0] == "fix-node"):
			processFixNodeLine (splitLine,xmlDocument, root)
			
	# Add hints to the nodes in the XML file
	for node, hint in hints.iteritems():
		addAttributeToNode (xmlDocument, node, "hint_to", hint)
		
	# If any nodes have been forcefully assigned, add the assignments
	for node, assigned in assigns.iteritems():
		addAttributeToNode (xmlDocument, node, "assigned_to", assigned)
		 
	# Write out the XML file
	vtopFile = open (destFileName, "w")
	xmlDocument.writexml (vtopFile)
	vtopFile.close ()

	topFile.close ()

# Processes a node
def processNode (splitLine,  xmlDocument,  root):
	# To keep track of whether or not a features and desires element has been added to the current node
	addedFeatureDesireSpecNode = False

	newNode = addNode (xmlDocument, root, "node")
	newNode.setAttribute ("name", splitLine[1])

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

	# Iterate through all the optional parameters on the line	
	for index in range(3, len(splitLine)):

		#If disallow_trivial_mix is present, put it under the NodeFlagSpec
		if (splitLine[index] == "disallow_trivial_mix"):
			addNode (xmlDocument, newNode, splitLine[index])
		#If subnode_of is present, find the parent node and add the appropriate node under NodeFlagSpec
		elif (splitLine[index].startswith("subnode_of")):
			(subNodeOf, parentNode) = splitLine[index].split(":")
			addNodeWithText(xmlDocument, newNode, "subnode_of", parentNode)
		# If an optional desire is present, put it under the features and desires node
		elif (splitLine[index].find(":") != -1):
			
			newFeatureDesireSpecNode = addNode (xmlDocument, newNode, "fd")
								
			# The feature name is optionally prepended with a 2 character prefix.
			# Detect the prefix and remove it from the feature name as appropriate
			(featureName, featureWeight) = splitLine[index].split(":")
			if (featureName[0] != "*" and featureName[0] != "?"):
				newFeatureDesireSpecNode.setAttribute("fd_name", featureName)
			else:
				newFeatureDesireSpecNode.setAttribute("fd_name", featureName[2:])

			newFeatureDesireSpecNode.setAttribute("fd_weight", featureWeight)
			if (float(featureWeight) >= 1.000000):
				newFeatureDesireSpecNode.setAttribute("violatable", "true")

			# The desire prefix is "*!"
			if (featureName[1] == "!"):
				newFeatureDesireSpecNode.setAttribute("global_operator", "OnceOnly")
			# The desire prefix is "*&"
			elif (featureName[1] == "&"):
				newFeatureDesireSpecNode.setAttribute("global_operator", "FirstFree")
			# The desire prefix is "?+"
			elif (featureName[1] == "+"):
				newFeatureDesireSpecNode.setAttribute("local_operator", "+")

# Processes a link 
def processLink (splitLine,  xmlDocument,  root):
	global assignInterfaceNumber
	
	newLinkNode = addNode(xmlDocument, root, "link")
	newLinkNode.setAttribute ("name", splitLine[1])
	
	# Find the source name and the source interface. 
	# If the node has no interface specified, assign it a "safe" interface number
	# Increment the interface number
	srcNameInterface = splitLine[2]
	if (srcNameInterface.find(":") != -1):
		(srcName, srcInterface) = srcNameInterface.split(":")
	else:
		srcName = srcNameInterface
		srcInterface = assignInterfaceNumber
		assignInterfaceNumber = assignInterfaceNumber + 1
	
	# Do the same thing for the destination interface
	destNameInterface = splitLine [3]
	if (destNameInterface.find(":") != -1):
		(destName, destInterface) = destNameInterface.split(":")
	else:
		destName = destNameInterface
		destInterface = assignInterfaceNumber
		assignInterfaceNumber = assignInterfaceNumber + 1
	
	# Add a source interface element
	sourceInterfaceNode = addNode(xmlDocument, newLinkNode, "source_interface")
	sourceInterfaceNode.setAttribute("node_name", srcName)
	sourceInterfaceNode.setAttribute("interface_name", str(srcInterface))
	
	# Add a destination interface element
	destinationInterfaceNode = addNode(xmlDocument, newLinkNode, "destination_interface")
	destinationInterfaceNode.setAttribute("node_name", destName)
	destinationInterfaceNode.setAttribute("interface_name", str(destInterface))
	
	# Add other stuff that appears on the line
	addNodeWithText(xmlDocument, newLinkNode, "bandwidth", splitLine[4])
	addNodeWithText(xmlDocument, newLinkNode, "latency", splitLine[5])
	addNodeWithText(xmlDocument, newLinkNode, "packet_loss", splitLine[6])
	
	# Add a link_type element
	newLinkTypeNode = addNode (xmlDocument, newLinkNode, "link_type")
	newLinkTypeNode.setAttribute("type_name", splitLine[7])
	
	# Run through the optional parameters at the end of the line
	for index in range(8, len(splitLine)):
		# If fixsrciface or fixdstiface are found
		if (splitLine[index].find(":") != -1):
			(fixIface, ifaceName) = splitLine[index].split(":")
			addNodeWithText(xmlDocument, newLinkNode, fixIface, ifaceName)
		elif (splitLine[index] == "emulated"):
			addNode(xmlDocument, newLinkNode, "multiplex_ok")
		elif(splitLine[index] != ""):
			addNode(xmlDocument, newLinkNode, splitLine[index])

# Process a v-class file
def processVClass (splitLine, xmlDocument, root):
	newVClassNode = addNode (xmlDocument, root, "vclass")
	newVClassNode.setAttribute ("name", splitLine[1])
	
	# TODO: Need to take care of the hard case later
	addNode (xmlDocument, newVClassNode, "soft")
	addNodeWithText (xmlDocument, newVClassNode, "weight", splitLine[2])
	
	# The remaining entries on this line will be physical_types.
	for index in range(3, len(splitLine)):
		if (splitLine[index] != ""):
			addNodeWithText (xmlDocument, newVClassNode, "physical_type", splitLine[index])

# Process a node-assignment line
def processFixNodeLine (splitLine, xmlDocument, root):
	# If multiple assignments are provided for the same node, an error is displayed. 
	# If the node is being assigned for the first time, it is added to the assigns dictionary
	if (assigns.has_key(splitLine[1]) == True):
		raise ConversionException ("Multiple assignments specified for the same node '" + splitLine[1] + "'", lineNumber, lines)
	else:
		assigns[splitLine[1]] = splitLine[2]
	
# Process a node hint line
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
# The child node has a textnode within it with the text "nodeText"
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
    
