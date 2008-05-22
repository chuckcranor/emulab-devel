/*
 * EMULAB-COPYRIGHT
 * Copyright (c) 2007 University of Utah and the Flux Group.
 * All rights reserved.
 */

static const char rcsid[] = "$Id: parse_error_handler.cpp,v 1.1.2.2 2008-05-22 22:11:18 ricci Exp $";

#include "parse_error_handler.h"

void ParseErrorHandler::error(const SAXParseException& toCatch) {    
    cerr << "Error at file \"" << XStr(toCatch.getSystemId())
    << "\", line " << toCatch.getLineNumber()
    << ", column " << toCatch.getColumnNumber()
    << "\n   Message: " << XStr(toCatch.getMessage()) << endl;
    this->hadError = true;
}

void ParseErrorHandler::fatalError(const SAXParseException& toCatch) {
    XERCES_STD_QUALIFIER cerr << "Fatal Error at file \"" << XStr(toCatch.getSystemId())
    << "\", line " << toCatch.getLineNumber()
    << ", column " << toCatch.getColumnNumber()
    << "\n   Message: " << XStr(toCatch.getMessage()) << XERCES_STD_QUALIFIER endl;
    this->hadError = true;
}
 