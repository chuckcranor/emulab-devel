/*
 * EMULAB-COPYRIGHT
 * Copyright (c) 2005-2007 University of Utah and the Flux Group.
 * All rights reserved.
 */

static const char rcsid[] = "$Id: parse_vtop_xml.cc,v 1.1.2.3 2009-04-03 16:48:24 tarunp Exp $";

#include "port.h"

#include <boost/config.hpp>
#include <boost/utility.hpp>
#include <boost/property_map.hpp>
#include <boost/graph/graph_traits.hpp>
#include <boost/graph/adjacency_list.hpp>

#include <iostream>

using namespace boost;

#include "common.h"
#include "vclass.h"
#include "delay.h"
#include "physical.h"
#include "virtual.h"
#include "parser.h"
#include "anneal.h"
#include "string.h"
#include "parse_vtop_xml.h"
#include "xmlhelpers.h"
#include "xstr.h"
#include "parse_error_handler.h"

extern name_vvertex_map vname2vertex;
extern name_name_map fixed_nodes;
extern name_name_map node_hints;
extern name_count_map vtypes;
extern name_list_map vclasses;
extern vvertex_vector virtual_nodes;
extern name_vclass_map vclass_map;

#define XMLDEBUG(x) (cout << x);


#define top_error(s) errors++;cout << "TOP:" << line << ": " << s << endl
#define top_error_noline(s) errors++;cout << "TOP: " << s << endl

#if 0
// Used to do late binding of subnode names to vnodes, so that we're no
// dependant on their ordering in the top file, which can be annoying to get
// right.
// Returns the number of errors found
int bind_top_subnodes() {
    int errors = 0;

    // Iterate through all vnodes looking for ones that are subnodes
    vvertex_iterator vit,vendit;
    tie(vit,vendit) = vertices(vg);
    for (;vit != vendit;++vit) {
	tb_vnode *vnode = get(vvertex_pmap, *vit);
	if (!vnode->subnode_of_name.empty()) {
	    if (vname2vertex.find(vnode->subnode_of_name)
		    == vname2vertex.end()) {
		top_error_noline(vnode->name << " is a subnode of a " <<
			"non-existent node, " << vnode->subnode_of_name << ".");
		continue;
	    }
	    vvertex parent_vv = vname2vertex[vnode->subnode_of_name];
	    vnode->subnode_of = get(vvertex_pmap,parent_vv);
	    vnode->subnode_of->subnodes.push_back(vnode);
	}
    }

    return errors;
}
#endif

// extern name_vclass_map vclass_map;
// extern name_name_map fixed_nodes;
// extern name_name_map node_hints;

DOMElement *root = NULL;

bool populate_nodes (DOMElement* root, tb_vgraph &vg);
bool populate_links (DOMElement* root, tb_vgraph &vg);
bool populate_vclasses (DOMElement* root, tb_vgraph &vg);

int bind_vtop_subnodes (tb_vgraph &vg);

int parse_vtop_xml(tb_vgraph &vg, char* filename) {
    
    /*
     * Initialize the XML parser
     */
    XMLPlatformUtils::Initialize();
    
    //XMLReader xerces = XMLReaderFactory::createXMLReader("org.apache.xerces.parsers.SAXParser");
    
    XercesDOMParser *parser = new XercesDOMParser;
    parser->setValidationScheme(XercesDOMParser::Val_Always);
    parser->setDoNamespaces(true);
    parser->setDoSchema(true);
    parser->setValidationSchemaFullChecking(true);
    
    parser -> setExternalSchemaLocation ("http://emulab.net/resources/vtop/0.2 vtop.xsd");
        
    ParseErrorHandler *handler = new ParseErrorHandler();
    parser->setErrorHandler(handler);
    
    /*
     * Do the actual parsing
     */
    parser->parse(filename);
    
	if (handler->sawError()) {
		cerr << "There were " << parser -> getErrorCount() << " errors. Please correct the errors and try again." << endl;
		exit(EXIT_FATAL);
	}

    DOMDocument *doc = parser->getDocument();
    root = doc->getDocumentElement();
    
	XMLDEBUG("Starting vclass population ... " << endl);
    if (!populate_vclasses(root, vg))
	{
		cerr << "Error reading vclasses from virtual topology " << filename << endl;
		exit (EXIT_FATAL);
	}	
	XMLDEBUG ("Finishing vclass population ... " << endl);
	

	XMLDEBUG("Starting node population ... " << endl);
    if (!populate_nodes(root, vg))
	{
		cerr << "Error reading nodes from virtual topology " << filename << endl;
		exit (EXIT_FATAL);
	}
	XMLDEBUG("Finishing node population ..." << endl);
 
	XMLDEBUG("Starting link population ... " << endl);
	if (!populate_links(root, vg))
	{	
		cerr << "Error reading links from virtual topology " << filename << endl;
		exit (EXIT_FATAL);
	}
	XMLDEBUG ("Finishing link population ... " << endl);
					

    // Clean up parser memory
    // delete parser;
    //XMLPlatformUtils::Terminate();
    return 0;
}

bool populate_nodes (DOMElement *root, tb_vgraph &vg) {

	bool is_ok = true;

	DOMNodeList *nodes = root->getElementsByTagName(XStr("node").x());
    int nodeCount = nodes->getLength();
    XMLDEBUG("Found " << nodeCount << " nodes in vtop" << endl);

    for (size_t i = 0; i < nodeCount; i++) 
	{
		DOMNode *node = nodes->item(i);
		// This should not be able to fail, due to the fact that all elements in
		// this list came from the getElementsByTagName() call
		DOMElement *elt = dynamic_cast<DOMElement*>(node);
		XStr node_name(elt->getAttribute(XStr("name").x()));
		XStr node_assigned_to(elt->getAttribute(XStr("assigned_to").x()));
		XStr node_hint_to(elt->getAttribute(XStr("hint_to").x()));
		//XMLDEBUG("Got node " << name << endl);

		//XMLDEBUG("Node " << node_name << " assigned to " << node_assigned_to << endl);
		if (strcmp(node_assigned_to.c(), "") != 0)
			fixed_nodes[node_name.f()] = node_assigned_to.f();
		
		if (strcmp(node_hint_to.c(), "") != 0)
			node_hints[node_name.f()] = node_hint_to.f();
			
		// For a virtual node, it will always return only 1 node. 
		// In any other case, the error would have been caught by the validator earlier
		DOMElement *node_type = dynamic_cast<DOMElement*>(elt -> getElementsByTagName(XStr("node_type").x()) -> item(0));

		// If there is a type_slots node, it has the number of slots
		// Else there has to be an "unlimited" node.
		// If neither is present, the parser will have complained earlier.
		XStr node_type_name (getChildValue (node_type, "type_name"));
		int node_type_slots = 1;
		bool is_unlimited = false;
		bool is_static = hasChildTag (node_type, "static");

		if (hasChildTag (node_type, "type_slots"))
			node_type_slots = XStr(getChildValue (node_type, "type_slots")).i();
		// This check is redundant because the parser should have caught the error earlier
		else if (hasChildTag (node_type, "unlimited"))
			is_unlimited = true;
		
		XStr *subnode_of_name = NULL;
		if (hasChildTag (elt, "subnode_of"))
			subnode_of_name = new XStr(getChildValue (elt, "subnode_of"));

		bool is_unique = hasChildTag (elt, "unique");
		bool is_disallow_trivial_mix = hasChildTag (elt, "disallow_trivial_mix");
		
		tb_vclass *vclass;
	
		const char *str_node_type_name = node_type_name.c();
		bool no_type = false;
		name_vclass_map::iterator dit = vclass_map.find(node_type_name.f());
		if (dit != vclass_map.end()) {
			no_type = true;
			cout<<"Found a type called " << node_type_name.f() << " ?"<<endl;
			vclass = (*dit).second;
		} 
		else {
			vclass = NULL;
			if (vtypes.find(str_node_type_name) == vtypes.end()) {
				vtypes[str_node_type_name] = node_type_slots;
			} 
			else {
				vtypes[str_node_type_name] += node_type_slots;
			}
		}
		
		tb_vnode *v = NULL;
		if (no_type)
			v = new tb_vnode(node_name.c(), "", node_type_slots);
		else
			v = new tb_vnode(node_name.c(), str_node_type_name, node_type_slots);
		
		// Construct the vertex
		v -> disallow_trivial_mix = is_disallow_trivial_mix;
		if (subnode_of_name != NULL)
			v -> subnode_of_name = (*subnode_of_name).c();
		
		v->vclass = vclass;
		vvertex vv = add_vertex(vg);
		vname2vertex[node_name.c()] = vv;
		virtual_nodes.push_back(vv);
		put(vvertex_pmap,vv,v);
		
		parse_fds_vnode_xml (elt, &(v -> desires));
		v -> desires.sort();
	}	

	int errors = bind_vtop_subnodes (vg);
	if (errors > 0)
	{
		cerr << "Errors occurred while binding the subnodes. Check the virutal topology file." << endl;
		is_ok = false;
	}
	return is_ok;
}

bool populate_links (DOMElement *root, tb_vgraph &vg) {

	bool is_ok = true;
	
	DOMNodeList *links = root->getElementsByTagName(XStr("link").x());
	int linkCount = links->getLength();
	XMLDEBUG("Found " << links->getLength()  << " links in vtop" << endl);
	
	for (size_t i = 0; i < linkCount; i++) {
		DOMNode *link = links->item(i);
		DOMElement *elt = dynamic_cast<DOMElement*>(link);
        
		XStr link_name(elt->getAttribute(XStr("name").x()));
        
        //XMLDEBUG("Got link " << link_name << endl);
    
        /*
		* Get source and destination interfaces - we use knowledge of the
		* schema that there is awlays exactly one source and one destination
		*/
		DOMNodeList *src_iface_container =
				elt->getElementsByTagName(XStr("source_interface").x());
		node_interface_pair source =
				parse_interface_xml(dynamic_cast<DOMElement*>
				(src_iface_container->item(0)));
		XStr link_src_node(source.first);
		XStr link_src_iface(source.second);
        
        //XMLDEBUG("  Source: " << link_src_node << " / " << link_src_iface << endl);
        
		DOMNodeList *dst_iface_container =
				elt->getElementsByTagName(XStr("destination_interface").x());
		node_interface_pair dest =
				parse_interface_xml(dynamic_cast<DOMElement*>
				(dst_iface_container->item(0)));
		XStr link_dst_node(dest.first);
		XStr link_dst_iface(dest.second);
        
        //XMLDEBUG("  Destination: " << link_src_node << " / " << link_src_iface << endl);
        
        /*
		* Check to make sure the referenced nodes actually exist
		*/
		if (vname2vertex.find(link_src_node.c()) == vname2vertex.end()) {
			cerr << "Bad link, non-existent source node " << link_src_node;
			is_ok = false;
			continue;
		}
		if (vname2vertex.find(link_dst_node.c()) == vname2vertex.end()) {
			cerr << "Bad link, non-existent destination node " << link_dst_node;
			is_ok = false;
			continue;
		}
    
        /*
		* Find the nodes in the existing data structures
		*/
		vvertex src_vertex = vname2vertex[link_src_node.c()];
		vvertex dst_vertex = vname2vertex[link_dst_node.c()];
		tb_vnode *src_vnode = get(vvertex_pmap,src_vertex);
		tb_vnode *dst_vnode = get(vvertex_pmap,dst_vertex);
        
        /*
		* Get standard link characteristics
		*/
		XStr link_bandwidth(getChildValue(elt,"bandwidth"));
		XStr link_latency(getChildValue(elt,"latency"));
		XStr link_packet_loss(getChildValue(elt,"packet_loss"));
        
		/* 
		 * Get extra link characteristics
		 */
		bool emulated = hasChildTag (elt, "multiplex_ok");
		bool allow_delayed = !hasChildTag (elt, "nodelay");
		
		bool allow_trivial = false;
		#ifdef ALLOW_TRIVIAL_DEFAULT
			allow_trivial = true;
		#else
			allow_trivial = false;
		#endif	
		allow_trivial = hasChildTag(elt, "trivial_ok");
		
		bool fix_src_iface = false;
		bool fix_dst_iface = false;
		fstring fixed_src_iface = "";
		fstring fixed_dst_iface = "";
		if ((fix_src_iface = hasChildTag(elt, "fixsrciface")))
			fixed_src_iface = XStr(getChildValue (elt, "fixsrciface")).f();
		if ((fix_dst_iface = hasChildTag(elt, "fixdstiface")))
			fixed_dst_iface = XStr(getChildValue (elt, "fixdstiface")).f();
		
        //XMLDEBUG("  bw = " << link_bandwidth << " latency = " << link_latency << " loss = " << link_packet_loss << endl);
        
        /*
		 * Start getting link types - we know there is at least one, and we
		 * need it for the constructor
		 */
		DOMNodeList *type = elt->getElementsByTagName(XStr ("link_type").x());
		DOMElement *type_tag = dynamic_cast<DOMElement*>(type->item(0));
		XStr link_type(getChildValue(type_tag, "type_name"));
        
        //XMLDEBUG ("type_name = " << link_type << endl);
		if (emulated) 
		{
			if (!allow_trivial) 
			{
				src_vnode->total_bandwidth += link_bandwidth.i();
				dst_vnode->total_bandwidth += link_bandwidth.i();
			}
		} 
		else 
		{
			src_vnode->num_links++;
			dst_vnode->num_links++;
			src_vnode->link_counts[link_type.c()]++;
			dst_vnode->link_counts[link_type.c()]++;
		}

		//XMLDEBUG ("Got here" << endl);
        /*
		* Create the actual link object
		*/
		vedge virt_edge = (add_edge(src_vertex,dst_vertex,vg)).first;
        
		tb_vlink *virt_link = new tb_vlink();
        
		virt_link-> name = link_name.f();
		virt_link-> type = link_type.f();
		//if (fix_src_iface)
		//{
			virt_link-> fix_src_iface = fix_src_iface;
			virt_link-> src_iface = (fixed_src_iface);//.f();
		//}
		//if (fix_dst_iface)
		//{
			virt_link-> fix_dst_iface = fix_dst_iface;
			virt_link-> dst_iface = (fixed_dst_iface);//.f();
		//}
		virt_link-> emulated = emulated;
		virt_link-> allow_delayed = allow_delayed;
		virt_link-> allow_trivial = allow_trivial;
		virt_link-> no_connection = true;
		virt_link->delay_info.bandwidth = link_bandwidth.i();
		virt_link->delay_info.delay = link_latency.i();
		virt_link->delay_info.loss = link_packet_loss.d();
		virt_link->src = src_vertex;
		virt_link->dst = dst_vertex;
	
        // XXX: Should not be manual
		put(vedge_pmap, virt_edge, virt_link);
		
	}
	return is_ok;
}

bool populate_vclasses (DOMElement *root, tb_vgraph &vg)
{
	bool is_ok = true;

	DOMNodeList *vclass_elements = root->getElementsByTagName(XStr("vclass").x());
	int vclassCount = vclass_elements->getLength();
	XMLDEBUG("Found " << vclassCount << " vclasses in vtop" << endl);

	for (size_t i = 0; i < vclassCount; i++) 
	{
		DOMNode *vclass = vclass_elements->item(i);
		
		// This should not be able to fail, due to the fact that all elements in
		// this list came from the getElementsByTagName() call
		DOMElement *elt = dynamic_cast<DOMElement*>(vclass);
		
		XStr vclass_name (elt->getAttribute(XStr("name").x()));
		const char *str_vclass_name = vclass_name.c();
		
		tb_vclass *v = NULL;
		/* 
		 * XXX: Have not dealt with the case when the hard tag is present.
		 * Will have to do this before we can use this correctly
		 */
		if (hasChildTag (elt, "hard"))
		{
			// Deal with it here
		}
		else if (hasChildTag (elt, "soft"))
		{
			XStr vclass_weight (getChildValue(elt, "weight"));
			v = new tb_vclass(vclass_name.f(),vclass_weight.d());
			if (v == NULL)
			{
				cerr << "Could not create vclass: " << vclass_name << endl;
				is_ok = false;
				continue;
			}
			vclass_map[str_vclass_name] = v;
		}
		
		/* Get all the physical types for the vclass */
		DOMNodeList *phys_types = elt->getElementsByTagName(XStr("physical_type").x());
		for (int j = 0; j < phys_types->getLength(); j++) 
		{
			DOMElement* phys_type = dynamic_cast<DOMElement*>(phys_types -> item(j));
			XStr phys_type_name (phys_type -> getFirstChild() -> getNodeValue());
			v->add_type(phys_type_name.f());
			vclasses[str_vclass_name].push_back(phys_type_name.f());
		}
	}
	return is_ok;
}

int bind_vtop_subnodes(tb_vgraph &vg) {
    int errors = 0;

    // Iterate through all vnodes looking for ones that are subnodes
    vvertex_iterator vit,vendit;
    tie(vit,vendit) = vertices(vg);
    for (;vit != vendit;++vit) {
	tb_vnode *vnode = get(vvertex_pmap, *vit);
	if (!vnode->subnode_of_name.empty()) {
	    if (vname2vertex.find(vnode->subnode_of_name)
		    == vname2vertex.end()) {
		top_error_noline(vnode->name << " is a subnode of a " <<
			"non-existent node, " << vnode->subnode_of_name << ".");
		continue;
	    }
	    vvertex parent_vv = vname2vertex[vnode->subnode_of_name];
	    vnode->subnode_of = get(vvertex_pmap,parent_vv);
	    vnode->subnode_of->subnodes.push_back(vnode);
	}
    }

    return errors;
}

#if 0
int parse_top(tb_vgraph &vg, istream& i)
{
  string_vector parsed_line;
  int errors=0,line=0;
  int num_nodes = 0;
  char inbuf[1024];
  
  while (!i.eof()) {
    line++;
    i.getline(inbuf,1024);
    parsed_line = split_line(inbuf,' ');
    if (parsed_line.size() == 0) {continue;}

    string command = parsed_line[0];

    if (command == string("node")) {
      if (parsed_line.size() < 3) {
	top_error("Bad node line, too few arguments.");
      } else {
	string name = parsed_line[1];
	string unparsed_type = parsed_line[2];

	// Type might now a have a 'number of slots' assoicated with it
	string type;
	string typecount_str;
	split_two(unparsed_type,':',type,typecount_str,"1");

	int typecount;
	if (sscanf(typecount_str.c_str(),"%i",&typecount) != 1) {
	    top_error("Bad type slot count.");
	    typecount = 1;
	}

	num_nodes++;
	tb_vnode *v = new tb_vnode();
	vvertex vv = add_vertex(vg);
	vname2vertex[name] = vv;
	virtual_nodes.push_back(vv);
	put(vvertex_pmap,vv,v);
	v->name = name;
	name_vclass_map::iterator dit = vclass_map.find(type);
	if (dit != vclass_map.end()) {
	  v->type="";
	  v->vclass = (*dit).second;
	} else {
	  v->type=type;
	  v->vclass=NULL;
	  if (vtypes.find(v->type) == vtypes.end()) {
	      vtypes[v->type] = typecount;
	  } else {
	      vtypes[v->type] += typecount;
	  }
	}
	v->typecount = typecount;
#ifdef PER_VNODE_TT
	v->num_links = 0;
	v->total_bandwidth = 0;
#endif
	v->disallow_trivial_mix = false;
	v->nontrivial_links = v->trivial_links = 0;
	
	for (unsigned int i = 3;i < parsed_line.size();++i) {
	  string desirename,desireweight;
	  if (split_two(parsed_line[i],':',desirename,desireweight,"0") == 1) {
	      // It must be a flag?
	      if (parsed_line[i] == string("disallow_trivial_mix")) {
		  v->disallow_trivial_mix = true;
	      } else {
		  top_error("Unknown flag or bad desire (missing weight)");
	      }
	  } else {
	      if (desirename == string("subnode_of")) {
		  // Okay, it's not a desire, it's a subnode declaration
		  if (!v->subnode_of_name.empty()) {
		      top_error("Can only be a subnode of one node");
		      continue;
		  }
		  v->subnode_of_name = desireweight;

	      } else {
		  double gweight;
		  if (sscanf(desireweight.c_str(),"%lg",&gweight) != 1) {
		      top_error("Bad desire, bad weight.");
		      gweight = 0;
		  }
		  v->desires.push_front(
			  tb_node_featuredesire(desirename,gweight));
	      }
	  }
	}
	v->desires.sort();
      }
    } else if (command == string("link")) {
      if (parsed_line.size() < 8) {
	top_error("Bad link line, too few arguments.");
      } else {
	string name = parsed_line[1];
	string src = parsed_line[2];
	string dst = parsed_line[3];
	string link_type = parsed_line[7];
	string bw,bwunder,bwover;
	string delay,delayunder,delayover;
	string loss,lossunder,lossover;
	string bwweight,delayweight,lossweight;
	string_vector parsed_delay,parsed_bw,parsed_loss;
	parsed_bw = split_line(parsed_line[4],':');
	bw = parsed_bw[0];
	if (parsed_bw.size() == 1) {
	  bwunder = "0";
	  bwover = "0";
	  bwweight = "1";
	} else if (parsed_bw.size() == 3) {
	  bwunder = parsed_bw[1];
	  bwover = parsed_bw[2];
	  bwweight = "1";
	} else if (parsed_bw.size() == 4) {
	  bwunder = parsed_bw[1];
	  bwover = parsed_bw[2];
	  bwweight = parsed_bw[3];
	} else {
	  top_error("Bad link line, bad bandwidth specifier.");
	}
	parsed_delay = split_line(parsed_line[5],':');
	delay = parsed_delay[0];
	if (parsed_delay.size() == 1) {
	  delayunder = "0";
	  delayover = "0";
	  delayweight = "1";
	} else if (parsed_delay.size() == 3) {
	  delayunder = parsed_delay[1];
	  delayover = parsed_delay[2];
	  delayweight = "1";
	} else if (parsed_delay.size() == 4) {
	  delayunder = parsed_delay[1];
	  delayover = parsed_delay[2];
	  delayweight = parsed_delay[3];
	} else {
	  top_error("Bad link line, bad delay specifier.");
	}
	parsed_loss = split_line(parsed_line[6],':');
	loss = parsed_loss[0];
	if (parsed_loss.size() == 1) {
	  lossunder = "0";
	  lossover = "0";
	  lossweight = "1";
	} else if (parsed_loss.size() == 3) {
	  lossunder = parsed_loss[1];
	  lossover = parsed_loss[2];
	  lossweight = "1";
	} else if (parsed_loss.size() == 4) {
	  lossunder = parsed_loss[1];
	  lossover = parsed_loss[2];
	  lossweight = parsed_loss[4];
	} else {
	  top_error("Bad link line, bad loss specifier.");
	}

	vedge e;
	// Check to make sure the nodes in the link actually exist
	if (vname2vertex.find(src) == vname2vertex.end()) {
	  top_error("Bad link line, non-existent node.");
	  continue;
	}
	if (vname2vertex.find(dst) == vname2vertex.end()) {
	  top_error("Bad link line, non-existent node.");
	  continue;
	}

	vvertex node1 = vname2vertex[src];
	vvertex node2 = vname2vertex[dst];
	e = add_edge(node1,node2,vg).first;
	tb_vlink *l = new tb_vlink();
	l->src = node1;
	l->dst = node2;
	l->type = link_type;
	put(vedge_pmap,e,l);

	if ((sscanf(bw.c_str(),"%d",&(l->delay_info.bandwidth)) != 1) ||
	    (sscanf(bwunder.c_str(),"%d",&(l->delay_info.bw_under)) != 1) ||
	    (sscanf(bwover.c_str(),"%d",&(l->delay_info.bw_over)) != 1) ||
	    (sscanf(bwweight.c_str(),"%lg",&(l->delay_info.bw_weight)) != 1) ||
	    (sscanf(delay.c_str(),"%d",&(l->delay_info.delay)) != 1) ||
	    (sscanf(delayunder.c_str(),"%d",&(l->delay_info.delay_under)) != 1) ||
	    (sscanf(delayover.c_str(),"%d",&(l->delay_info.delay_over)) != 1) ||
	    (sscanf(delayweight.c_str(),"%lg",&(l->delay_info.delay_weight)) != 1) ||
	    (sscanf(loss.c_str(),"%lg",&(l->delay_info.loss)) != 1) ||
	    (sscanf(lossunder.c_str(),"%lg",&(l->delay_info.loss_under)) != 1) ||
	    (sscanf(lossover.c_str(),"%lg",&(l->delay_info.loss_over)) != 1) ||
	    (sscanf(lossweight.c_str(),"%lg",&(l->delay_info.loss_weight)) != 1)) {
	  top_error("Bad line line, bad delay characteristics.");
	}
	l->no_connection = false;
	l->name = name;
	l->allow_delayed = true;
#ifdef ALLOW_TRIVIAL_DEFAULT
	l->allow_trivial = true;
#else
	l->allow_trivial = false;
#endif
	l->emulated = false;
	
	for (unsigned int i = 8;i < parsed_line.size();++i) {
	  if (parsed_line[i] == string("nodelay")) {
	    l->allow_delayed = false;
	  } else if (parsed_line[i] == string("emulated")) {
	    l->emulated = true;
	  } else if (parsed_line[i] == string("trivial_ok")) {
	    l->allow_trivial = true;
	  } else {
	    top_error("bad link line, unknown tag: " <<
		      parsed_line[i] << ".");
	  }
	}
	
#ifdef PER_VNODE_TT
	tb_vnode *vnode1 = get(vvertex_pmap,node1);
	tb_vnode *vnode2 = get(vvertex_pmap,node2);
	if (l->emulated) {
	    if (!l->allow_trivial) {
		vnode1->total_bandwidth += l->delay_info.bandwidth;
		vnode2->total_bandwidth += l->delay_info.bandwidth;
	    }
	} else {
	    vnode1->num_links++;
	    vnode2->num_links++;
	    vnode1->link_counts[link_type]++;
	    vnode2->link_counts[link_type]++;
	}
#endif
      }
    } else if (command == string("make-vclass")) {
      if (parsed_line.size() < 4) {
	top_error("Bad vclass line, too few arguments.");
      } else {
	string name = parsed_line[1];
	string weight = parsed_line[2];
	double gweight;
	if (sscanf(weight.c_str(),"%lg",&gweight) != 1) {
	  top_error("Bad vclass line, invalid weight.");
	  gweight = 0;
	}
	
	tb_vclass *v = new tb_vclass(name,gweight);
	vclass_map[name] = v;
	for (unsigned int i = 3;i<parsed_line.size();++i) {
	  v->add_type(parsed_line[i]);
	  vclasses[name].push_back(parsed_line[i]);
	}
      }
    } else if (command == string("fix-node")) {
      if (parsed_line.size() != 3) {
	top_error("Bad fix-node line, wrong number of arguments.");
      } else {
	string virtualnode = parsed_line[1];
	string physicalnode = parsed_line[2];
	fixed_nodes[virtualnode] = physicalnode;
      }
    } else if (command == string("node-hint")) {
      if (parsed_line.size() != 3) {
	top_error("Bad node-hint line, wrong number of arguments.");
      } else {
	string virtualnode = parsed_line[1];
	string physicalnode = parsed_line[2];
	node_hints[virtualnode] = physicalnode;
      }
    } else {
      top_error("Unknown directive: " << command << ".");
    }
  }

  errors += bind_top_subnodes();

  if (errors > 0) {exit(EXIT_FATAL);}
  
  return num_nodes;
}
#endif // 0

/*
    /*
			* Parse the nodes
			* Design decision - do we simply ask for all nodes, or do we actually walk
			* the whole structure?
			* We're not going to do much error checking in here, as we assume
			* that a lot of it was done by the validator.

							DOMNodeList *nodes = root->getElementsByTagName(XStr("node").x());
					XMLDEBUG("Found " << nodes->getLength() << " nodes" << endl);

					for (size_t i = 0; i < nodes->getLength(); i++) {

//DOMElement *node = dynamic_cast<DOMElement*>(nodes->item(i));
						DOMNode *node = nodes->item(i);
						DOMNamedNodeMap *atts = node->getAttributes();
						XStr *xstr = new XStr(atts->getNamedItem(XStr("name").x())->getNodeValue());
						fstring name = xstr->f();
						XMLDEBUG("Node name is: " << name << endl);
//cerr << "XML node name is: " << XStr(node->getNodeName()) << endl;
// XMLDEBUG("XML node type is: " << node->getNodeType() << endl);

						DOMElement *element = static_cast<DOMElement *>(node);
						//DOMElement *element = dynamic_cast<DOMElement *>(node);
						//DOMElement *element = (DOMElement*)node;
		
/*
						* Get the node's type and the number of slots it occupies

						DOMNodeList *typeL = element->getElementsByTagName(XStr("type_name").x());
						DOMElement *type = static_cast<DOMElement *>(typeL->item(0));
						//DOMElement *type = dynamic_cast<DOMElement *>(typeL->item(0));
						//DOMElement *type = (DOMElement *)(typeL->item(0));
						const XMLCh *typeX = type->getFirstChild()->getNodeValue();

						tb_vnode *v = new tb_vnode(name,XStr(typeX).c(),1);
						vvertex vv = add_vertex(vg);
						vname2vertex[name] = vv;
						virtual_nodes.push_back(vv);
						put(vvertex_pmap,vv,v);

						delete xstr;
					}
					*/
