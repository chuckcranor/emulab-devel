#
# Copyright (c) 2000-2025 University of Utah and the Flux Group.
# 
# {{{EMULAB-LICENSE
# 
# This file is part of the Emulab network testbed software.
# 
# This file is free software: you can redistribute it and/or modify it
# under the terms of the GNU Affero General Public License as published by
# the Free Software Foundation, either version 3 of the License, or (at
# your option) any later version.
# 
# This file is distributed in the hope that it will be useful, but WITHOUT
# ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
# FITNESS FOR A PARTICULAR PURPOSE.  See the GNU Affero General Public
# License for more details.
# 
# You should have received a copy of the GNU Affero General Public License
# along with this file.  If not, see <http://www.gnu.org/licenses/>.
# 
# }}}
#
# Utility routines for Emulab.
#
import sys
import re

if __name__ == "__main__":
    sys.path.append("/usr/testbed/devel/stoller/lib")
    pass

from libdb import *

#
# Checkslot stuff
#
TBDB_CHECKDBSLOT_NOFLAGS        = 0x0
TBDB_CHECKDBSLOT_WARN           = 0x1
TBDB_CHECKDBSLOT_ERROR          = 0x2

class ValidateSlots:
    def __init__(self):
        self.fields = {}
        self.lastError = None
        self.lastRE = None
        
        qres = DBQueryWarn("select * from table_regex", asDict=True);

        for row in qres:
            table_name  = row["table_name"]
            column_name = row["column_name"]

            self.fields[table_name + ":" + column_name] = {
                "check"       : row["check"],
                "check_type"  : row["check_type"],
                "column_type" : row["column_type"],
                "min"         : row["min"],
                "max"         : row["max"]
            }
            pass
        pass

    def lastErrorString(self):
        return self.lastError

    def _fieldData(self, table_name, column_name, flag):
        key = table_name + ":" + column_name
        fielddata = None
        toplevel = None

        while key in self.fields:
            fielddata = self.fields[key]
            
            #
            # See if a redirect to another entry.
            #
            if fielddata["check_type"] == "redirect":
                if toplevel == None:
                    toplevel = fielddata;
                    pass

                #print("Redirecting %s -> %s" % (key, fielddata["check"]))
                key = fielddata["check"]
                continue;
            break

        if fielddata == None:
            self.lastError = "Error-checking pattern missing from the database";
            if flag & TBDB_CHECKDBSLOT_WARN:
                print("*** WARNING: No slot data for %s" % (key,))
                pass
            return (None, None)

        # Return both entries.
        if toplevel != None:
            return (fielddata, toplevel)

        return (fielddata, None)
    
    def validate(self, token,
                 table_name, column_name, flag=TBDB_CHECKDBSLOT_NOFLAGS):
        key = table_name + ":" + column_name
        self.lastError = None
        fielddata, toplevel = self._fieldData(table_name, column_name, flag)
        if fielddata == None:
            return False
        
        check       = fielddata["check"]
        check_type  = fielddata["check_type"]
        column_type = fielddata["column_type"]
        if toplevel == None:
            column_min  = fielddata["min"]
            column_max  = fielddata["max"]
        else:
            column_min  = toplevel["min"]
            column_max  = toplevel["max"]
            pass

        # Make sure the regex is anchored. Its a mistake not to be!
        if not check.startswith("^"):
            check = "^" + check
            pass
        if not check.endswith("$"):
            check = check + "$"
            pass

        self.lastRE = check

        #print("%s: %s/%s/%s/%s/%s" %
        #      (key,check,check_type,column_type,column_min,column_max))

        # Check regex.
        if not re.match(check, str(token)):
            self.lastError = "Illegal characters"
            return False

        # Check min/max.
        if column_type == "text":
            tokenlen = len(token)

	    # Any length is okay if no min or max.
            if not (column_min or column_max):
                return True
            if tokenlen >= column_min and tokenlen <= column_max:
                return True
            if column_min and tokenlen < column_min:
                self.lastError = "Too Short"
                pass
            if column_max and tokenlen > column_max:
                self.lastError = "Too Long"
                pass
        elif column_type == "int" or column_type == "float":
	    # If both min/max are zero, then skip check; allow anything.
            if not (column_min or column_max):
                return True
            if token >= column_min and token <= column_max:
                return True
            if column_min and token < column_min:
                self.lastError = "Too Small"
                pass
            if column_max and token > column_max:
                self.lastError = "Too Big"
                pass
        else:
            self.lastError = "Unrecognized column_type " + column_type
            return False

        return False

    pass

#
# Testing
#
def Tester(token, pid, slot, validator, shouldbe):
    computed = validator.validate(token, pid, slot)
    print("%s:%s %r should be %r" % (pid, slot, token, shouldbe), end="")
    if computed == False:
        print(" (%s)" % validator.lastError);
    else:
        print("")
        pass
    if shouldbe != computed:
        print("  FAILED: (%r) " % (validator.lastRE,))
        pass
    pass

if __name__ == "__main__":
    validator = ValidateSlots()
    Tester(0, "projects", "public", validator, True)
    Tester("foo", "projects", "newpid", validator, True)
    Tester("0foo", "projects", "newpid", validator, False)
    Tester("foo-bar", "projects", "newpid", validator, True)
    Tester("foo_bar", "projects", "newpid", validator, False)
    Tester("f", "projects", "pid", validator, False)
    Tester("dd", "users", "shell", validator, False)
    Tester("dd", "users", "usr_shell", validator, False)
    Tester("bash", "users", "usr_shell", validator, True)
    Tester("gack", "users", "usr_email", validator, False)
    Tester("gack@gmail.com", "users", "usr_email", validator, True)
    Tester("gac'k@gmail.com", "users", "usr_email", validator, False)
    Tester("255.255", "virt_lans", "mask", validator, False)
    Tester("255.255.255.25", "virt_lans", "mask", validator, True)
    pass
