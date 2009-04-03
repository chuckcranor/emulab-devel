/*
 * EMULAB-COPYRIGHT
 * Copyright (c) 2003-2009 University of Utah and the Flux Group.
 * All rights reserved.
 */

static const char rcsid[] = "$Id: annotate_rspec.cc,v 1.1.2.1 2009-04-03 17:38:02 tarunp Exp $";

#include "annotate_rspec.h"

#include <xercesc/util/PlatformUtils.hpp>

#include <xercesc/dom/DOM.hpp>
#include <xercesc/dom/DOMImplementation.hpp>
#include <xercesc/dom/DOMImplementationLS.hpp>
#include <xercesc/dom/DOMWriter.hpp>

#include <xercesc/framework/StdOutFormatTarget.hpp>
#include <xercesc/framework/LocalFileFormatTarget.hpp>
#include <xercesc/parsers/XercesDOMParser.hpp>
#include <xercesc/util/XMLUni.hpp>

#include <xercesc/util/XercesDefs.hpp>
#include <xercesc/sax/ErrorHandler.hpp>
#include <xercesc/sax/SAXParseException.hpp>

#include <xercesc/util/OutOfMemoryException.hpp>

#include <xercesc/sax2/XMLReaderFactory.hpp>

#include "xstr.h"
#include "xmlhelpers.h"

#include <utility>
#include <list>
#include <string>
				 
#define XMLDEBUG(x) (cerr << x);
				 
#ifdef WITH_XML

extern DOMDocument* doc;
				 
extern DOMElement* root;
extern DOMElement* vroot;
extern DOMElement* proot;

extern map<string, DOMElement*>* pelements;

XERCES_CPP_NAMESPACE_USE

using namespace std;

/* element_type specifies whether the element being annotated is a node or a link 
 */
void annotate_vtop (const char* v_name, const char* p_name, char element_type)
{
	DOMElement* node = getNodeByName(root, v_name);
	node -> setAttribute (XStr("assigned_to").x(), XStr(p_name).x());
}

// This will get called when a node or a direct link needs to be annotated
void annotate_rspec (const char* v_name, const char* p_name)
{
	DOMElement* vnode = getElementByAttributeValue(vroot, "node", "virtual_id", v_name);
	// If a vnode by that name was found, then go ahead. If not, that element should be a link
	// We are not terribly concerned about having to scan the entire physical topology twice
	// because direct links are never really going to happen
	if (vnode != NULL)
	{
		DOMElement* pnode = (pelements->find(p_name))->second;
		if (pnode->hasAttribute (XStr("component_name").x()))
			vnode->setAttribute (XStr("component_name").x(), XStr(pnode->getAttribute(XStr("component_name").x())).x());
		vnode->setAttribute (XStr("component_uuid").x(), XStr(pnode->getAttribute(XStr("component_uuid").x())).x());
		vnode->setAttribute (XStr("component_manager_uuid").x(), XStr(pnode->getAttribute(XStr("component_manager_uuid").x())).x());
	}
	else
	{
		DOMElement* vlink = getElementByAttributeValue(vroot, "link", "virtual_id", v_name);
		DOMElement* plink = (pelements->find(p_name))->second;
		
		// Create a single_hop_link element
		DOMElement* single_hop_element = doc->createElement(XStr("single_hop_link").x());
		
		// Create the link element which will be inside the single hop link
		DOMElement* link = doc->createElement(XStr("link").x());
		copy_component_spec(plink, link);

		DOMElement* plink_src_iface = getElementByTagName (getElementByTagName(plink, "source_interface"), "interface");
		DOMElement* plink_dst_iface = getElementByTagName (getElementByTagName(plink, "destination_interface"), "interface");
		
		DOMElement* vlink_src_iface = getElementByTagName (getElementByTagName(vlink, "source_interface"), "interface");
		DOMElement* vlink_dst_iface = getElementByTagName (getElementByTagName(vlink, "destination_interface"), "interface");

		// The physical link specified in the ptop file may be oriented backwards
		// as compared to the virtual link requested. 
		// In this case, annotating the interfaces becomes complicated
		
		// Find the virtual nodes which are the end points of the virtual link
		DOMElement* v_src_node = getElementByAttributeValue(vroot, "node", "virtual_id", XStr(vlink_src_iface->getAttribute(XStr("virtual_node_id").x())).c());
		DOMElement* v_dst_node = getElementByAttributeValue(vroot, "node", "virtual_id", XStr(vlink_dst_iface->getAttribute(XStr("virtual_node_id").x())).c());
				
		// Get the component uuid of the physical node to which they were mapped
		// This works because the nodes are always annotated before the links
		XStr v_src_node_component_uuid (v_src_node->getAttribute(XStr("component_uuid").x()));
		XStr v_dst_node_component_uuid (v_dst_node->getAttribute(XStr("component_uuid").x()));
		
		// Get the physical nodes which are the end points of the physical link
		XStr p_src_node_uuid (plink_src_iface->getAttribute(XStr("component_node_uuid").x()));
		XStr p_dst_node_uuid (plink_dst_iface->getAttribute(XStr("component_node_uuid").x()));
		
		// If the component uuids of the source and destination nodes as obtained from the physical link specification
		// and the annotated virtual nodes are the same, then annotating the link is straightforward
		if (strcmp(v_src_node_component_uuid.c(), p_src_node_uuid.c()) == 0
				  && (strcmp(v_dst_node_component_uuid.c(), p_dst_node_uuid.c()) == 0))
		{
			// Annotate the virtual link interfaces
			annotate_interface(vlink, "source_interface", plink_src_iface); 
			annotate_interface(vlink, "destination_interface", plink_dst_iface);
			
			// Add interface specifications to the link in the single hop element
			link->appendChild(doc->importNode(dynamic_cast<DOMNode*>(getElementByTagName(plink,"source_interface")), true));
			link->appendChild(doc->importNode(dynamic_cast<DOMNode*>(getElementByTagName(plink,"destination_interface")), true));
		}
		// If the component uuid of the annotated source node in the virtual specification is the same as
		// the component uuid of the destination node of the link as determined from the physical link specification
		// and vice versa,
		// reverse the interface specification before annotating the link
		else if (strcmp(v_src_node_component_uuid.c(), p_dst_node_uuid.c()) == 0
					   && (strcmp(v_dst_node_component_uuid.c(), p_src_node_uuid.c()) == 0))
		{
			// Annotate the virtual link interfaces
			annotate_interface(vlink, "source_interface", plink_dst_iface); 
			annotate_interface(vlink, "destination_interface", plink_src_iface);
			
			// Create an empty interface spec in the link
			create_interface_spec(link);
			
			// Add interface specifications to the link in the single hop element
			annotate_interface(link, "source_interface", plink_dst_iface);
			annotate_interface(link, "destination_interface", plink_src_iface);
		}
		// This should never happen
		else {	throw "Something weird just happened"; }
		
		// Annotate the interface elements on the nodes
		XStr src_node_virtual_interface_name (vlink_src_iface->getAttribute(XStr("virtual_interface_name").x()));
		XStr src_node_component_interface_name (vlink_src_iface->getAttribute(XStr("component_interface_name").x()));
		
		XStr dst_node_virtual_interface_name (vlink_dst_iface->getAttribute(XStr("virtual_interface_name").x()));
		XStr dst_node_component_interface_name (vlink_dst_iface->getAttribute(XStr("component_interface_name").x()));
		
		annotate_interface(v_src_node_component_uuid, src_node_virtual_interface_name.c(), src_node_component_interface_name.c());
		annotate_interface(v_dst_node_component_uuid, dst_node_virtual_interface_name.c(), dst_node_component_interface_name.c());
		
		single_hop_element->appendChild(link);
		vlink->appendChild(single_hop_element);
	}
}

// This is called when an intraswitch or interswitch link has to be annotated
void annotate_rspec (const char* v_name, list<const char*>* links)
{
	// These are the paths from the source to the first switch
	// and from the last switch to the destination
	const char* psrc_name = links->front();	
	const char* pdst_name = links->back();	
	DOMElement* p_src_switch_link = (pelements->find(psrc_name))->second;
	DOMElement* p_switch_dst_link = (pelements->find(pdst_name))->second;
	
	// Remove these links from the list
	// If it is an intra-switch link, the list should now be empty.
	links->pop_front();
	links->pop_back();
		
	// Get the virtual link from the virtual topology
	DOMElement* vlink = getElementByAttributeValue (vroot, "link", "virtual_id", v_name);
	// Get the virtual interface names
	XStr src_iface_virtual_interface_name (getElementByTagName(vlink, "source_interface")->getAttribute(XStr("virtual_interface_name").x()));
	XStr dst_iface_virtual_interface_name (getElementByTagName(vlink, "destination_interface")->getAttribute(XStr("virtual_interface_name").x()));
	
	// Annotate the interface elements on the virtual link
	annotate_interface(p_src_switch_link, vlink, src_iface_virtual_interface_name.c(), "source_interface");
	annotate_interface(p_switch_dst_link, vlink, dst_iface_virtual_interface_name.c(), "destination_interface");
	
	// Now we create the multi-hop component spec The intermediate node will be the switch.
	// The first link will be the link from the source to the switch.
	// The last link will be the link from the switch to the destination.
	DOMElement* multi_hop = doc->createElement(XStr("multi_hop_link").x());
	
	DOMElement* multi_hop_first_link = doc->createElement(XStr("link").x());
	copy_component_spec(p_src_switch_link, multi_hop_first_link);
	multi_hop_first_link->appendChild(doc->importNode(dynamic_cast<DOMNode*>(getElementByTagName(p_src_switch_link, "source_interface")), true));
	multi_hop_first_link->appendChild(doc->importNode(dynamic_cast<DOMNode*>(getElementByTagName(p_src_switch_link, "destination_interface")), true));
	multi_hop->appendChild(multi_hop_first_link);
	
	// Create the intermediate nodes and links, if any
	for (DOMElement *prev = multi_hop_first_link; !links->empty(); )
	{
		DOMElement* p_switch_switch_link = find_next_link_in_path(prev, links);
		create_hop(p_switch_switch_link, multi_hop, false);
		prev = p_switch_switch_link;
	}
	// Create a hop from the last switch to the destination
	create_hop (p_switch_dst_link, multi_hop, true);

	// Add this to the virtual link
	vlink->appendChild(dynamic_cast<DOMNode*>(multi_hop));
}

// Finds the next link in the path returned by assign
// Assign sometimes reverses the links on the path from the source to the destination, 
// so you need to look at the entire path to find the next link
DOMElement* find_next_link_in_path (DOMElement *prev, list<const char*>* links)
{
	list<const char*>::iterator it;
	DOMElement* link = NULL;
	for (it = links->begin(); it != links->end(); ++it)
	{
		link = (pelements->find(*it))->second;
		XStr link_src(getElementByTagName(getElementByTagName (link, "source_interface"), "interface")->getAttribute(XStr("component_node_uuid").x()));
		XStr prev_dst(getElementByTagName(getElementByTagName (link, "source_interface"), "interface")->getAttribute(XStr("component_node_uuid").x()));
		if (strcmp(link_src.c(), prev_dst.c()) == 0)
		{
			links->remove(*it);
			break;
		}
	}
	return link;
}

// The is_final_hop flag is used because on the last hop of an interswitch or intraswitch link,
// the source and destination interface specifications have to be reversed.
void create_hop (DOMElement* p_switch_dst_link, DOMElement* multi_hop_element, bool is_final_hop)
{
	// If the link is the final link between a switch and a destination node, 
	// the switch data is found on the destination of the link.
	// This is because the advertisement has all links originating from the node and going to the switch
	// For switch-switch links, it is the other way around
	DOMElement* p_switch_from_link;
	if (is_final_hop)
		p_switch_from_link = getElementByTagName (getElementByTagName (p_switch_dst_link, "destination_interface"), "interface");
	else
		p_switch_from_link = getElementByTagName (getElementByTagName (p_switch_dst_link, "source_interface"), "interface");
	XStr switch_id(p_switch_from_link->getAttribute(XStr("component_node_uuid").x()));
	DOMElement* p_switch = getElementByAttributeValue(proot, "node", "component_uuid", switch_id.c());

	// The first node in the hop. This is the switch.
	// Add the switch details to the hop node.
	DOMElement* hop_node = doc->createElement(XStr("node").x());
	copy_component_spec(p_switch, hop_node);
	(dynamic_cast<DOMNode*>(multi_hop_element))->appendChild(dynamic_cast<DOMNode*>(hop_node));
	
	// Now for the link from the switch to the destination
	DOMElement* hop_link = doc->createElement(XStr("link").x());
	copy_component_spec(p_switch_dst_link, hop_link);
	
	if (is_final_hop)
	{
		// Things get a little complicated while setting up the interfaces for the final switch to destination link
		// In the physical topology, all links are from a node to a switch
		// When we build a component path, we want to show a complete path from the source to the destination
		// So we need to reverse the source and destination interfaces of the switch-destination link
		
		// Create the source and destination interface nodes and their children
		create_interface_spec(hop_link);
		
		// Get the interface elements on the switch to destination link
		DOMElement* src_iface = getElementByTagName(getElementByTagName(p_switch_dst_link, "source_interface"), "interface");
		DOMElement* dst_iface = getElementByTagName(getElementByTagName(p_switch_dst_link, "destination_interface"), "interface");
		
		// Annotate the interfaces
		annotate_interface(hop_link, "source_interface", dst_iface);
		annotate_interface(hop_link, "destination_interface", src_iface);
	}
	else
	{
		hop_link->appendChild(doc->importNode(dynamic_cast<DOMNode*>(getElementByTagName(p_switch_dst_link, "source_interface")), true));
		hop_link->appendChild(doc->importNode(dynamic_cast<DOMNode*>(getElementByTagName(p_switch_dst_link, "destination_interface")), true));
	}
	
	// Put it all together
	(dynamic_cast<DOMNode*>(multi_hop_element))->appendChild(dynamic_cast<DOMNode*>(hop_link));
}

// Annotates the interface element for a node to switch link
void annotate_interface(DOMElement* plink, DOMElement* vlink, const char* src_iface_virt_iface_name, const char* interface_type)
{
	// Get the interface element of the link which connects the source of the link and the switch
	DOMElement* src_switch_iface = getElementByTagName (getElementByTagName (plink, "source_interface"), "interface");
	// Get information about that interface element
	XStr src_iface_node_uuid (src_switch_iface->getAttribute(XStr("component_node_uuid").x()));
	XStr src_iface_interface_name (src_switch_iface->getAttribute(XStr("component_interface_name").x()));

	// Update the interfaces on the source node
	annotate_interface(src_iface_node_uuid.c(), src_iface_virt_iface_name, src_iface_interface_name.c());
	// Update the interface on the source to switch link
	annotate_interface(vlink, interface_type, src_switch_iface);
}

// Annotates the interface elements on nodes
void annotate_interface(const char* node_uuid, const char* virtual_iface_name, const char* component_iface_name)
{
	// Get the virtual node which is the source of this virtual link
	// Finding the node using the component_uuid will work because 
	// the XML tree has been annotated at this point with the physical node assignments.
	// If the links are ever reported before nodes, this will not work.
	// In the case of pcvm's, multiple requests get mapped to the same physical node.
	// In that case, a list will be returned, and we need to look at the list to find the correct element
	vector<const DOMElement*> nodes = getElementsByAttributeValue (vroot, "node", "component_uuid", node_uuid);
	// Get the interface for the node and update 
	DOMElement* iface_decl = getElementByAttributeValue(nodes, "interface", "virtual_name", virtual_iface_name);
	iface_decl->setAttribute (XStr("component_name").x(), XStr(component_iface_name).x());
}

// Annotates the interface elements on links
void annotate_interface(DOMElement* link, const char* interface_type, DOMElement* component_interface)
{
	DOMElement* vlink_src_iface = getElementByTagName (getElementByTagName (link, interface_type), "interface");
	const XMLCh* component_node_uuid = XStr("component_node_uuid").x();
	const XMLCh* component_interface_name = XStr("component_interface_name").x();
	vlink_src_iface->setAttribute(component_node_uuid, component_interface->getAttribute(component_node_uuid));
	vlink_src_iface->setAttribute(component_interface_name, component_interface->getAttribute(component_interface_name));
/*	vlink_src_iface->appendChild(doc->importNode(dynamic_cast<DOMNode*>(getElementByTagName(component_interface, "component_node_uuid")), true));
	vlink_src_iface->appendChild(doc->importNode(dynamic_cast<DOMNode*>(getElementByTagName(component_interface, "component_interface_name")), true));*/
}

// Copies the component spec from the source to the destination
void copy_component_spec(DOMElement* src, DOMElement* dst)
{
	if (src->hasAttribute (XStr("component_name").x()))
		dst->setAttribute (XStr("component_name").x(), XStr(src->getAttribute(XStr("component_name").x())).x());
	dst->setAttribute (XStr("component_uuid").x(), XStr(src->getAttribute(XStr("component_uuid").x())).x());
	dst->setAttribute (XStr("component_manager_uuid").x(), XStr(src->getAttribute(XStr("component_manager_uuid").x())).x());
}

// Creates source_interface and destination_interface tags with empty interface elements on the specified link
void create_interface_spec(DOMElement *link)
{
	DOMNode* link_src_iface = dynamic_cast<DOMNode*>(doc->createElement(XStr("source_interface").x()));
	DOMNode* link_src_iface_iface = dynamic_cast<DOMNode*>(doc->createElement(XStr("interface").x()));
	DOMNode* link_dst_iface = dynamic_cast<DOMNode*>(doc->createElement(XStr("destination_interface").x()));
	DOMNode* link_dst_iface_iface = dynamic_cast<DOMNode*>(doc->createElement(XStr("interface").x()));
	
	link_src_iface->appendChild(link_src_iface_iface);
	link_dst_iface->appendChild(link_dst_iface_iface);
	
	(dynamic_cast<DOMNode*>(link))->appendChild(link_src_iface);
	(dynamic_cast<DOMNode*>(link))->appendChild(link_dst_iface);
}

// Writes out the annotated rspec to disk
void write_annotated_file (const char* filename)
{
	cout << "Writing annotated rspec to " << filename << endl;
		
	// Get the current implementation
	DOMImplementation *impl = DOMImplementationRegistry::getDOMImplementation(NULL);
		
	// Construct the DOMWriter
	DOMWriter* writer = ((DOMImplementationLS*)impl)->createDOMWriter();
		
	// Make the output look pretty
	if (writer->canSetFeature(XMLUni::fgDOMWRTFormatPrettyPrint, true))
		writer->setFeature(XMLUni::fgDOMWRTFormatPrettyPrint, true);
		
	// Set the byte-order-mark feature      
	if (writer->canSetFeature(XMLUni::fgDOMWRTBOM, true))
		writer->setFeature(XMLUni::fgDOMWRTBOM, true);
		
	// Construct the LocalFileFormatTarget
	XMLFormatTarget *outputFile = new LocalFileFormatTarget(filename);
		
	// Serialize a DOMNode to the local file "<some-file-name>.xml"
	writer->writeNode(outputFile, *dynamic_cast<DOMNode*>(vroot));
		
	// Flush the buffer to ensure all contents are written
	outputFile->flush();
		
	// Release the memory
	writer->release();
}

#endif
