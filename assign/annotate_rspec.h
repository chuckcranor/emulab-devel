#ifndef __ANNOTATE_RSPEC_H
#define __ANNOTATE_RSPEC_H

#include <utility>
#include <list>

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

// Annotates the vtop xml file
void annotate_vtop (const char* v_name, const char* p_name, char element_type);

// Annotates nodes in the rspec
void annotate_rspec(const char* v_name, const char* p_name);

// Annotates intraswitch and direct links in the rspec
void annotate_rspec(const char* v_name, std::pair<const char*, const char*>* end_points);

// Annotates intraswitch and interswitch links in the rspec
void annotate_rspec(const char* v_name, std::list<const char*>* links);

// Annotates interswitch links in the rspec
void annotate_rspec(const char* v_name[], const char* p_name[]);

// Annotates the interface elements on links
void annotate_interface (xercesc::DOMElement* link, const char* interface_type, xercesc::DOMElement* component_interface);

// Annotates the interface element on nodes
void annotate_interface (const char* node_uuid, const char* virtual_iface_name, const char* component_iface_name);

// Annotates the interface elements on a node to switch link (and for a switch to node link)
void annotate_interface (xercesc::DOMElement* plink, xercesc::DOMElement* vlink, const char* src_iface_virt_iface_name, const char* interface_type);

// Creates a hop from a switch till the next end point
void create_hop (xercesc::DOMElement* p_switch_dst_link, xercesc::DOMElement* multi_hop_link, bool reverse);

// Copies the component spec from the source to the destination
void copy_component_spec(xercesc::DOMElement* src, xercesc::DOMElement* dst);

// Creates source_interface and destination_interface tags with empty interface elements on the specified link
void create_interface_spec(xercesc::DOMElement *link);

// Writes the annotated xml to disk
void write_annotated_file(const char* filename);

// Finds the next link in the path
xercesc::DOMElement* find_next_link_in_path (xercesc::DOMElement* prev, std::list<const char*>* links);

#endif
