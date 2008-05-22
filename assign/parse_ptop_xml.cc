/*
 * EMULAB-COPYRIGHT
 * Copyright (c) 2008 University of Utah and the Flux Group.
 * All rights reserved.
 */

/*
 * XML Parser for ptop files
 */

static const char rcsid[] = "$Id: parse_ptop_xml.cc,v 1.3.8.4 2008-05-22 22:11:19 ricci Exp $";

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
void populate_nodes(DOMElement *root, tb_pgraph &pg, tb_sgraph &sg);
void populate_links(DOMElement *root);
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
    
    populate_nodes(root,pg,sg);
    //populate_links(root);
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
void populate_nodes(DOMElement *root, tb_pgraph &pg, tb_sgraph &sg) {
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
     * This post-pass binds subnodes to their
     */
    bind_ptop_subnodes(pg);
}