/*
 * EMULAB-COPYRIGHT
 * Copyright (c) 2005-2008 University of Utah and the Flux Group.
 * All rights reserved.
 */

/*
 * xmlhelpers.h - Classes and functions to make XML parsing a little easier
 */

#ifndef __XMLHELPERS_H
#define __XMLHELPERS_H

#include <xercesc/dom/DOM.hpp>
#include <xercesc/util/XMLString.hpp>
XERCES_CPP_NAMESPACE_USE

#include "featuredesire.h"

/*
 * Convenience function - get the value of some sub-tag when we expect only
 * one. Should only be used when the schema requires exactly one child with
 * this name.
 */
const XMLCh* getChildValue(const DOMElement *tag, const char *name);

/*
 * Convenience function - return true if the given element has a tag with the
 * given name (at least one), or false if not.
 */
bool hasChildTag(const DOMElement *tag, const char *name);

/*
 * Parse all features and desires that are children of the given tag, and add
 * them on to the list given. Returns the number of features and desires
 * parsed.
 */
int parse_fds_xml(const DOMElement *tag, node_fd_set *fd_set);

/*
 * Get a node and interface name from an object containing an interface tag
 * (such as a source_interface tag)
 */
typedef pair<const XMLCh*, const XMLCh*> node_interface_pair;
node_interface_pair parse_interface_xml(const DOMElement *tag);

#endif