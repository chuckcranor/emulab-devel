/*
 * EMULAB-COPYRIGHT
 * Copyright (c) 2008 University of Utah and the Flux Group.
 * All rights reserved.
 */

#include "xmlhelpers.h"
#include "xstr.h"

const XMLCh* getChildValue(const DOMElement *tag, const char *name) {
    DOMNodeList *list = tag->getElementsByTagName(XStr(name).x());
    if (list->getLength() != 1) {
	throw "Incorrect number of child elements in getChildValue()";
    } else {
	return dynamic_cast<DOMElement*>(list->item(0))->getFirstChild()->getNodeValue();
    }
}

/*
 * TODO: Better error handling
 */
bool hasChildTag(const DOMElement *tag, const char *name) {
    return (tag->getElementsByTagName(XStr(name).x())->getLength() > 0);
}

int parse_fds_xml(const DOMElement *tag, node_fd_set *fd_set) {
    DOMNodeList *fds = tag->getElementsByTagName(XStr("fd").x());
    for (int i = 0; i < fds->getLength(); i++) {
	DOMElement *elt = dynamic_cast<DOMElement*>(fds->item(i));
	XStr fd_name(getChildValue(elt,"fd_name"));
	XStr fd_weight(getChildValue(elt,"fd_weight"));

	bool violatable = hasChildTag(elt, "violatable");
	featuredesire::fd_type fd_type;
	if (hasChildTag(elt,"local")) {
	    /*
	     * Right now, there is only one type of local feature
	     */
	    fd_type = featuredesire::FD_TYPE_LOCAL_ADDITIVE;
	} else if (hasChildTag(elt,"global")) {
	    XStr fd_operator(getChildValue(elt,"operator"));
	    if (fd_operator == "OnceOnly") {
		fd_type = featuredesire::FD_TYPE_GLOBAL_ONE_IS_OKAY;
	    } else {
		fd_type = featuredesire::FD_TYPE_GLOBAL_MORE_THAN_ONE;
	    }
	} else {
	    fd_type = featuredesire::FD_TYPE_NORMAL;
	}
	
	fd_set->push_front(tb_node_featuredesire(fd_name.c(), fd_weight.d(),
						 violatable, fd_type));
	
    }
    return fds->getLength();
}