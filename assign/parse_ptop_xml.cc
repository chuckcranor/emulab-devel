/*
 * EMULAB-COPYRIGHT
 * Copyright (c) 2008 University of Utah and the Flux Group.
 * All rights reserved.
 */

/*
 * XML Parser for ptop files
 */

static const char rcsid[] = "$Id: parse_ptop_xml.cc,v 1.3.8.5 2008-05-23 00:38:37 ricci Exp $";

#include "parse_ptop_xml.h"
#include "xmlhelpers.h"

#define XMLDEBUG(x) (cerr << x)

/*
 * XXX: Do I have to release lists when done with them?
 */

/*
 * XXX: Global: This is really bad!
 */
extern name_pvertex_map pname2vertex;

/*
 * TODO: This should be moved out of parse_top.cc, where it currently
 * resides.
 */
int bind_ptop_subnodes(tb_pgraph &pg);

/*
 * These are not meant to be used outside of this file, so they are only
 * declared in here
 */
bool populate_nodes(DOMElement *root, tb_pgraph &pg, tb_sgraph &sg);
bool populate_links(DOMElement *root, tb_pgraph &pg);
void populate_policies(DOMElement *root);

int parse_ptop_xml(tb_pgraph &pg, tb_sgraph &sg, char *filename) {
    /* 
     * Fire up the XML parser
     */
    XMLPlatformUtils::Initialize();
    
    XercesDOMParser *parser = new XercesDOMParser;
    
    /*
     * Enable some of the features we'll be using: validation, namespaces, etc.
     */
    parser->setValidationScheme(XercesDOMParser::Val_Always);
    parser->setDoNamespaces(true);
    parser->setDoSchema(true);
    parser->setValidationSchemaFullChecking(true);
    
    /*
     * Must validate against the ptop schema
     * XXX: Isn't actually validating for some reason
     */
    parser->loadGrammar("ptop.xsd",1,true);
    
    /*
     * Just use a default error handler - must admin it's not clear to me why
     * we are supposed to use a SAX error handler for this, but this is what
     * the docs say....
     */    
    ErrorHandler* errHandler = (ErrorHandler*) new HandlerBase();
    parser->setErrorHandler(errHandler);
    
    /*
     * Do the actual parse
     */
    parser->parse(filename);
    
    /*
     * Get the root of the document - we're going to be using the same root
     * for all subsequent calls
     */
    DOMDocument *doc = parser->getDocument();
    DOMElement *root = doc->getDocumentElement();
    
    /*
     * These three calls do the real work of populating the assign data
     * structures
     */
    if (!populate_nodes(root,pg,sg)) {
	cerr << "Error reading nodes from physical topology " << filename
	    << endl;
	exit(EXIT_FATAL);
    }
    if (!populate_links(root,pg)) {
	cerr << "Error reading links from physical topology " << filename
	    << endl;
	exit(EXIT_FATAL);
    }
    //populate_policies(root);
    
    /*
     * XXX: Cause an actual error message to get printed
     */
    //if (errHandler->sawError()) {
	//exit(EXIT_FATAL);
    //}
    
    cerr << "Ptop parsing finished" << endl;
    
    /*
     * All done, clean up memory
     */
    XMLPlatformUtils::Terminate();
    return 0;
}

/*
 * Pull nodes from the document, and populate assign's own data structures
 */
bool populate_nodes(DOMElement *root, tb_pgraph &pg, tb_sgraph &sg) {
    /*
     * Get a list of all nodes in this document
     */
    DOMNodeList *nodes = root->getElementsByTagName(XStr("node").x());
    XMLDEBUG("Found " << nodes->getLength()  << " nodes in ptop" << endl);
    for (size_t i = 0; i < nodes->getLength(); i++) {
	DOMNode *node = nodes->item(i);
	// This should not be able to fail, due to the fact that all elements in
	// this list came from the getElementsByTagName() call
	DOMElement *elt = dynamic_cast<DOMElement*>(node);
	XStr name(elt->getAttribute(XStr("name").x()));
	XMLDEBUG("Got node " << name << endl);
	
	/*
	 * TODO: These three steps shouldn't be 'manual'
	 */
	pvertex pv = add_vertex(pg);
	// XXX: This is wrong!
	tb_pnode *p = new tb_pnode(name.f());
	// XXX: Global
	put(pvertex_pmap,pv,p);
	
	/*
	 * Add on types
	 */
	DOMNodeList *types = elt->getElementsByTagName(XStr("node_type").x());
	for (int i = 0; i < types->getLength(); i++) {
	    
	    DOMElement *typetag = dynamic_cast<DOMElement*>(types->item(i));
	    XStr type_name(getChildValue(typetag, "type_name"));
	    
	    /*
	     * Check to see if it's a static type
	     */
	    bool is_static;
	    if (hasChildTag(typetag,"static")) {
		is_static = true;
	    } else {
		is_static = false;
	    }
	    
	    /*
	     * ... and how many slots it has
	     * XXX: Need a real 'unlimited' value!
	     */
	    int type_slots;
	    if (hasChildTag(typetag,"unlimited")) {
		type_slots = 1000;
	    } else {
		XStr type_slot_string(getChildValue(typetag,"type_slots"));
		type_slots = type_slot_string.i();
	    }
	    XMLDEBUG("  has type " << type_name << " with " << type_slots
		     << " slots" << endl);
	    
	    /*
	     * Make a tb_ptype structure for this guy - or just add this node to
	     * it if it already exists
	     * XXX: This should not be "manual"!
	     */
	    if (ptypes.find(type_name.c()) == ptypes.end()) {
		ptypes[type_name.c()] = new tb_ptype(type_name.c());
	    }
	    ptypes[type_name.c()]->add_slots(type_slots);
	    tb_ptype *ptype = ptypes[type_name.c()];
	    
	    /*
	     * For the moment, we treat switches specially - when we get the
	     * "forwarding" code working correctly, this special treatment
	     * will go away.
	     * TODO: This should not be in the parser, it should be somewhere
	     * else!
	     */
	    if (type_name == "switch") {
		p->is_switch = true;
		p->types["switch"] = new tb_pnode::type_record(1,false,ptype);
		svertex sv = add_vertex(sg);
		tb_switch *s = new tb_switch();
		put(svertex_pmap,sv,s);
		s->mate = pv;
		p->sgraph_switch = sv;
		p->switches.insert(pv);
	    } else {
		p->types[type_name.c()] = 
		    new tb_pnode::type_record(type_slots,is_static,ptype);
	    }
	    p->type_list.push_back(p->types[type_name.c()]);
	}
	
	/*
	 * Parse out the features
	 */
	parse_fds_xml(elt,&(p->features));
	
	/*
	 * Finally, pull out any special node flags
	 */
	if (hasChildTag(elt,"trivial_bw")) {
	    XStr trivial_bw(getChildValue(elt,"trivial_bw"));
	    p->trivial_bw = trivial_bw.i();
	    XMLDEBUG("  Trivial bandwidth: " << trivial_bw << endl);
	}
	
	if (hasChildTag(elt,"subnode_of")) {
	    XStr subnode_of_name(getChildValue(elt,"subnode_of"));
	    p->subnode_of_name = subnode_of_name.f();
	    XMLDEBUG("  Subnode of: " << subnode_of_name << endl);
	}
	
	if (hasChildTag(elt,"unique")) {
	    p->unique = true;
	    XMLDEBUG("  Unique" << endl);
	}
	
	/*
	 * XXX: Is this really necessary?
	 */
	p->features.sort();
	
	/*
	 * XXX: This shouldn't be "manual"
	 */
	pname2vertex[name.c()] = pv;
    }
    
    /*
     * This post-pass binds subnodes to their parents
     */
    bind_ptop_subnodes(pg);
    
    /*
     * Indicate no errors
     */
    return true;
}

/*
 * Pull the links from the ptop file, and populate assign's own data sturctures
 */
bool populate_links(DOMElement *root, tb_pgraph &pg) {
    
    bool errors = false;
    
    /*
     * TODO: Support the "PENALIZE_BANDWIDTH" option?
     * TODO: Support the "FIX_PLINK_ENDPOINTS" and "FIX_PLINKS_DEFAULT" options?
     */
    DOMNodeList *links = root->getElementsByTagName(XStr("link").x());
    XMLDEBUG("Found " << links->getLength()  << " links in ptop" << endl);
    for (size_t i = 0; i < links->getLength(); i++) {
	DOMNode *link = links->item(i);
	DOMElement *elt = dynamic_cast<DOMElement*>(link);
	
	XStr name(elt->getAttribute(XStr("name").x()));
	XMLDEBUG("Got link " << name << endl);

	/*
	 * Get source and destination interfaces - we use knowledge of the
	 * schema that there is awlays exactly one source and one destination
	 */
	DOMNodeList *src_iface_container =
	    elt->getElementsByTagName(XStr("source_interface").x());
	node_interface_pair source =
	    parse_interface_xml(dynamic_cast<DOMElement*>
				(src_iface_container->item(0)));
	XStr src_node(source.first);
	XStr src_iface(source.second);
	
	XMLDEBUG("  Source: " << src_node << " / " << src_iface << endl);
	
	DOMNodeList *dst_iface_container =
	    elt->getElementsByTagName(XStr("destination_interface").x());
	node_interface_pair dest =
	    parse_interface_xml(dynamic_cast<DOMElement*>
				(dst_iface_container->item(0)));
	XStr dst_node(dest.first);
	XStr dst_iface(dest.second);
	
	XMLDEBUG("  Destination: " << src_node << " / " << src_iface << endl);
	
	/*
	 * Check to make sure the referenced nodes actually exist
	 */
	if (pname2vertex.find(src_node.c()) == pname2vertex.end()) {
	    cerr << "Bad link, non-existent source node " << src_node;
	    errors = true;
	    continue;
	}
	if (pname2vertex.find(dst_node.c()) == pname2vertex.end()) {
	    cerr << "Bad link, non-existent destination node " << dst_node;
	    errors = true;
	    continue;
	}

	/*
	 * Find the nodes in the existing data structures
	 */
	pvertex src_vertex = pname2vertex[src_node.c()];
	pvertex dst_vertex = pname2vertex[dst_node.c()];
	tb_pnode *src_pnode = get(pvertex_pmap,src_vertex);
	tb_pnode *dst_pnode = get(pvertex_pmap,dst_vertex);
	
	/*
	 * Get standard link characteristics
	 */
	XStr bandwidth(getChildValue(elt,"bandwidth"));
	XStr latency(getChildValue(elt,"latency"));
	XStr packet_loss(getChildValue(elt,"packet_loss"));
	XMLDEBUG("  bw = " << bandwidth << " latency = " << latency <<
		 " loss = " << packet_loss << endl);
	
	/*
	 * Start getting link types - we know there is at least one, and we
	 * need it for the constructor
	 */
	DOMNodeList *types = elt->getElementsByTagName(XStr("link_type").x());
	DOMElement *first_type_tag = dynamic_cast<DOMElement*>(types->item(0));
	XStr first_type(first_type_tag->getFirstChild()->getNodeValue());
	
	/*
	 * Create the actual link object
	 */
	pedge phys_edge = (add_edge(src_vertex,dst_vertex,pg)).first;
	// XXX: Link type!?
	// XXX: Don't want to use (null) src and dest macs, but would break
	// other stuff if I remove them... bummer!
	tb_plink *phys_link =
	    new tb_plink(name.c(), tb_plink::PLINK_NORMAL, first_type.c(),
			 "(null)", "(null)", src_iface.c(), dst_iface.c());
	
	phys_link->delay_info.bandwidth = bandwidth.i();
	phys_link->delay_info.delay = latency.i();
	phys_link->delay_info.loss = packet_loss.d();
	
	// XXX: Should not be manual
	put(pedge_pmap, phys_edge, phys_link);
	
	/*
	 * Add in the rest of the link types we found
	 */

	for (int i = 1; i < types->getLength(); i++) {
	    DOMElement *link_type = dynamic_cast<DOMElement*>(types->item(i));
	    XStr type_name(getChildValue(link_type,"type_name"));
	    XMLDEBUG("  Link has type " << type_name << endl);
	    // XXX: Should not be manual
	    phys_link->types.insert(type_name.c());
	    src_pnode->link_counts[type_name.c()]++;
	    dst_pnode->link_counts[type_name.c()]++;
	}
    
	// XXX: Special treatment for switches
    }
    
    return !errors;
    
#if 0
    
#define ISSWITCH(n) (n->types.find("switch") != n->types.end())

    

	if (ISSWITCH(srcnode) && ISSWITCH(dstnode)) {
	    if (cur != 0) {
		cout <<
		"Warning: Extra links between switches will be ignored. (" <<
		name << ")" << endl;
		} else {
		    svertex src_switch = get(pvertex_pmap,srcv)->sgraph_switch;
		    svertex dst_switch = get(pvertex_pmap,dstv)->sgraph_switch;
		    sedge swedge = add_edge(src_switch,dst_switch,sg).first;
		    tb_slink *sl = new tb_slink();
		    put(sedge_pmap,swedge,sl);
		    sl->mate = pe;
		    pl->is_type = tb_plink::PLINK_INTERSWITCH;
		}
		}
		srcnode->total_interfaces++;
		dstnode->total_interfaces++;
		srcnode->link_counts[link_type]++;
		dstnode->link_counts[link_type]++;
		// There can be more than one link type
		for (size_t i = 8; i < parsed_line.size(); i++) {
		    fstring extra_link_type = parsed_line[i];
		    pl->types.insert(extra_link_type);
		    srcnode->link_counts[extra_link_type]++;
		    dstnode->link_counts[extra_link_type]++;
		}
		if (ISSWITCH(srcnode) &&
		    ! ISSWITCH(dstnode)) {
		    dstnode->switches.insert(srcv);
#ifdef PER_VNODE_TT
		    dstnode->total_bandwidth += ibw;
#endif
		}
		else if (ISSWITCH(dstnode) &&
			 ! ISSWITCH(srcnode)) {
		    srcnode->switches.insert(dstv);
#ifdef PER_VNODE_TT
		    srcnode->total_bandwidth += ibw;
#endif
		}

#endif
}