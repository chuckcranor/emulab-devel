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

import sys
import re

if __name__ == "__main__":
    sys.path.append("/usr/testbed/devel/stoller/lib")
    pass
from libdb import *

#
# Numerics for project level trust strings, for comparison
#
PROJMEMBERTRUST_NONE            = 0
PROJMEMBERTRUST_USER            = 1
PROJMEMBERTRUST_ROOT            = 2
PROJMEMBERTRUST_LOCALROOT       = 2
PROJMEMBERTRUST_GROUPROOT       = 3
PROJMEMBERTRUST_PROJROOT        = 4
PROJMEMBERTRUST_ADMIN           = 5

#
# Convert a trust string to the above numeric values.
#
def TBTrustConvert(trust_string):
    if trust_string == "none":
        return PROJMEMBERTRUST_NONE

    if trust_string == "user":
        return PROJMEMBERTRUST_USER

    if trust_string == "local_root":
        return PROJMEMBERTRUST_LOCALROOT

    if trust_string == "group_root":
        return PROJMEMBERTRUST_GROUPROOT
    
    if trust_string == "project_root":
        return PROJMEMBERTRUST_PROJROOT

    if trust_string == "admin":
        return PROJMEMBERTRUST_ADMIN

    print("*** Invalid trust value " + trust_string)
    sys.exit(-1)
    pass

#
# Return true if the given trust string is >= to the minimum required.
# The trust value can be either numeric or a string
#
def TBMinTrust(trust_value, minimum):
    if minimum < PROJMEMBERTRUST_NONE or minimum > PROJMEMBERTRUST_ADMIN:
        print("*** Invalid minimum trust " + minimum)
        sys.exit(-1)
        pass

    if type(trust_value) == str:
        trust_value = TBTrustConvert(trust_value)
        pass

    return trust_value >= minimum

#
# Raise an exception if no such ...
#
class NoSuchUser(Exception):
    def __init__(self, msg):
        self.msg=msg
        pass

class NoSuchProject(Exception):
    def __init__(self, msg):
        self.msg=msg
        pass

class NoSuchExperiment(Exception):
    def __init__(self, msg):
        self.msg=msg
        pass

class NoSuchResGroup(Exception):
    def __init__(self, msg):
        self.msg=msg
        pass

class NoSuchProfile(Exception):
    def __init__(self, msg):
        self.msg=msg
        pass

class AccessCheckError(Exception):
    def __init__(self, msg):
        self.msg=msg
        pass

#
# Collect user access in their project membership.
#
class UserAccess:
    def __init__(self, user, role = "user"):
        self.membership = {}
        self.mapping = {}
        self.role = role

        if type(user) == str:
            if re.match("^\w+\-\w+\-\w+\-\w+\-\w+$", user):
                qres = DBQueryWarn("select uid,uid_idx,admin from users " +
                                   "where uid_uuid=%s and status!='archived'",
                                   (DBQuoteSpecial(user),))
            elif re.match("^[\w]*$", user):
                qres = DBQueryWarn("select uid,uid_idx,admin from users " +
                                   "where uid=%s and status!='archived'",
                                   (DBQuoteSpecial(user),))
                pass
            pass
        elif type(user) == int:
            qres = DBQueryWarn("select uid,uid_idx,admin from users " +
                               "where uid_idx=%s",
                               (DBQuoteSpecial(user),))
        else:
            raise NoSuchUser("No such user: %s" % (user,))

        if not qres or len(qres) != 1:
            raise NoSuchUser("No such user: %s" % (user,))

        self.uid     = qres[0][0]
        self.uid_idx = qres[0][1]
        self.isadmin = qres[0][2]

        if role == "admin" and self.isadmin == 0:
            raise AccessCheckError("%s is not allowed to be an admin" % (user,))
            
        qresult = DBQueryWarn("select * from group_membership as g " +
                              "where g.uid_idx=%s", (self.uid_idx,),
                              asDict=True)

        if not len(qresult):
            raise NoSuchUser("No such user: %s" % (user,))

        for row in qresult:
            pid     = row["pid"]
            pid_idx = row["pid_idx"]
            gid     = row["gid"]
            gid_idx = row["gid_idx"]
            trust   = row["trust"]
            key     = str(pid_idx) + ":" + str(gid_idx)
            mapping = str(pid) + ":" + str(gid)

            self.membership[key] = trust
            self.mapping[key] = mapping
            pass
        pass

    #
    # User trust value in a Group.
    #
    def GroupTrust(self, group):
        if self.role == "admin":
            return PROJMEMBERTRUST_ADMIN
        
        if not group.pidgid in self.membership:
            return PROJMEMBERTRUST_NONE
        
        return TBTrustConvert(self.membership[group.pidgid])

    pass

#
# Check user access to another user
#
TB_USERINFO_READINFO            = 1
TB_USERINFO_MODIFYINFO          = 2
TB_USERINFO_MIN                 = TB_USERINFO_READINFO
TB_USERINFO_MAX                 = TB_USERINFO_MODIFYINFO

class User:
    def __init__(self, user, role = "user"):
        if isinstance(user, User):
            self.access = user.access
        else:
            self.access = UserAccess(user, role=role)
            pass
        pass

    def GroupTrust(self, group):
        return self.access.GroupTrust(group)

    @property
    def uid(self):
        return self.access.uid
    
    @property
    def uid_idx(self):
        return self.access.uid_idx
    
    def AccessCheck(self, source_user, access_type):
        if isinstance(source_user, User):
            source_access = source_user.access
        else:
            source_access = UserAccess(source_user)
            pass

        if (access_type < TB_USERINFO_MIN or
	    access_type > TB_USERINFO_MAX):
            raise AccessCheckError("*** Invalid access type: %r" % (access_type,))

        # User can muck with his own stuff.
        if self.access.uid_idx == source_access.uid_idx:
            return True

        # Ditto admins
        if source_access.role == "admin":
            return True

        if False:
            print(str(self.access.uid))
            print(str(self.access.membership))
            print(str(source_access.uid))
            print(str(source_access.membership))
            pass

        #
        # For MODIFY only project/group root in same project as user.
        # For READ, must be in the same project.
        #
        for pidgid in source_access.membership:
            if pidgid in self.access.membership:
                if access_type == TB_USERINFO_MODIFYINFO:
                    if (source_access.membership[pidgid] == "project_root" or
                        source_access.membership[pidgid] == "group_root"):
                        return True
                    pass
                elif source_access.membership[pidgid] != "none":
                    return True
                pass
            pass

        # Otherwise users cannot see each other.
        return False
    pass
        
#
# Project Group
#
TB_PROJECT_READINFO             = 1
TB_PROJECT_MAKEGROUP            = 2
TB_PROJECT_EDITGROUP            = 3
TB_PROJECT_GROUPGRABUSERS       = 4
TB_PROJECT_BESTOWGROUPROOT      = 5
TB_PROJECT_DELGROUP             = 6
TB_PROJECT_LEADGROUP            = 7
TB_PROJECT_ADDUSER              = 8
TB_PROJECT_DELUSER              = 9
TB_PROJECT_MAKEOSID             = 10
TB_PROJECT_DELOSID              = 11
TB_PROJECT_MAKEIMAGEID          = 12
TB_PROJECT_DELIMAGEID           = 13
TB_PROJECT_CREATEEXPT           = 14
TB_PROJECT_CREATELEASE          = 15
TB_PROJECT_CREATEPROFILE        = 16
TB_PROJECT_MIN                  = TB_PROJECT_READINFO
TB_PROJECT_MAX                  = TB_PROJECT_CREATEPROFILE

class ProjectGroup:
    def __init__(self, project, group = None):
        if group == None:
            group = project;
            pass
        
        if type(project) == str:
            if re.match("^[\-\w]+$", project):
                qres = DBQueryWarn("select pid,pid_idx,disabled from projects " +
                                   "where pid=%s",
                                   (DBQuoteSpecial(project),))
                pass
        elif type(project) == int:
            qres = DBQueryWarn("select pid,pid_idx,disabled from projects " +
                               "where pid_idx=%s", (project,))
        else:
            raise NoSuchProject("No such project: %s" % (project,))

        if not qres or len(qres) != 1:
            raise NoSuchProject("No such project: %s" % (project,))

        self.pid      = qres[0][0]
        self.pid_idx  = qres[0][1]
        self.disabled = qres[0][2]

        if type(group) == str:
            if re.match("^[\-\w]+$", group):
                qres = DBQueryWarn("select gid,gid_idx,leader_idx,unix_gid " +
                                   "  from groups " +
                                   "where pid_idx=%s and gid=%s",
                                   (self.pid_idx, DBQuoteSpecial(group)))
                pass
        elif type(group) == int:
            qres = DBQueryWarn("select gid,gid_idx,leader_idx,unix_gid " +
                               "  from groups " +
                               "where pid_idx=%s and gid_idx=%s",
                               (self.pid_idx, group))
        else:
            raise NoSuchProject("No such group: %s:%s" % (project,group))

        if not qres or len(qres) != 1:
            raise NoSuchProject("No such group: %s:%s" % (project,group))

        self.gid        = qres[0][0]
        self.gid_idx    = qres[0][1]
        self.leader_idx = qres[0][2]
        self.unix_gid   = qres[0][3]
        self.pidgid     = str(self.pid_idx) + ":" + str(self.gid_idx)

        if self.pid_idx == self.gid_idx:
            self.project = self;
        else:
            self.project = ProjectGroup(self.pid_idx, self.pid_idx)
            pass
        pass

    def AccessCheck(self, user, access_type):
        if isinstance(user, User):
            self.user = user
        else:
            self.user = User(user)
            pass

        user_trust = self.user.GroupTrust(self)
        project_trust = self.user.GroupTrust(self.project)
        
        if (access_type < TB_PROJECT_MIN or
	    access_type > TB_PROJECT_MAX):
            raise AccessCheckError("*** Invalid access type: %r" % (access_type,))

        if access_type == TB_PROJECT_READINFO:
	    #
	    # Group root in the project can see any group.
	    #
            if TBMinTrust(user_trust, PROJMEMBERTRUST_GROUPROOT):
                return True
            
            if self.project.leader_idx == user.uid_idx:
                return True

            return TBMinTrust(user_trust, PROJMEMBERTRUST_USER)

        #
        # Nothing else is allowed if the project is disabled
        #
        if self.disabled:
            return False

        if (access_type == TB_PROJECT_MAKEGROUP or
            access_type == TB_PROJECT_DELGROUP):
            #
            # Project leader can always do this
            #
            if access_type == TB_PROJECT_DELGROUP:
                if self.project.leader_idx == user.uid_idx:
                    return True
                pass
            
            return TBMinTrust(user_trust, PROJMEMBERTRUST_GROUPROOT)

        if access_type == TB_PROJECT_LEADGROUP:
            #
            # Allow mere user (in default group) to lead a subgroup.
            #
            return TBMinTrust(user_trust, PROJMEMBERTRUST_USER)

        if access_type == TB_PROJECT_CREATEPROFILE:
	    #
	    # Temporary until we can do per subgroup profiles.
	    #
            return TBMinTrust(user_trust, PROJMEMBERTRUST_LOCALROOT)

        if (access_type == TB_PROJECT_MAKEOSID or 
            access_type == TB_PROJECT_MAKEIMAGEID or
            access_type == TB_PROJECT_CREATEEXPT or
            access_type == TB_PROJECT_CREATELEASE):
            return TBMinTrust(user_trust, PROJMEMBERTRUST_LOCALROOT)

        if (access_type == TB_PROJECT_ADDUSER or
            access_type == TB_PROJECT_DELUSER or
            access_type == TB_PROJECT_EDITGROUP):
            #
            # If user is project_root or group_root in default group, 
            # allow them to add/edit/remove users in any group.
            #
            if TBMinTrust(project_trust, PROJMEMBERTRUST_GROUPROOT):
                return True

            #
            # Otherwise, editing a group requires group_root in that group.
            #            
            return TBMinTrust(user_trust, PROJMEMBERTRUST_GROUPROOT)
        
        if access_type == TB_PROJECT_BESTOWGROUPROOT:
            #
            # If user is project_root,
            # allow them to bestow group_root in any group.
            #
            if TBMinTrust(user_trust, PROJMEMBERTRUST_PROJROOT):
                return True

            if self.gid_idx == self.pid_idx:
                #
                # Only project_root can bestow group_root in default group, 
                # and we already established that they are not project_root,
                # so fail.
                #
                return False
            #
            # Non-default group.
            # group_root in default group may bestow group_root in any subgroup.
            #
            if TBMinTrust(project_trust, PROJMEMBERTRUST_GROUPROOT):
                return True

            #
            # Otherwise group_root in a subgroup may bestow in that subgroup
            #
            return TBMinTrust(user_trust, PROJMEMBERTRUST_GROUPROOT)

        if access_type == TB_PROJECT_GROUPGRABUSERS:
            #
            # Only project_root or group_root in default group
            # may grab (involuntarily add) users into groups.
            #
            if TBMinTrust(project_trust, PROJMEMBERTRUST_GROUPROOT):
                return True
            pass
        
        return False
    pass

#
# Experiment (APT Instance), not Classic
#
TB_EXPT_READINFO                = 1
TB_EXPT_MODIFY                  = 2
TB_EXPT_DESTROY                 = 3
TB_EXPT_UPDATE                  = 4
TB_EXPT_MIN                     = TB_EXPT_READINFO
TB_EXPT_MAX                     = TB_EXPT_UPDATE

class Experiment:
    def __init__(self, arg1, arg2 = None):
        qres = None
        
        if type(arg1) == str:
            if re.match("^\w+\-\w+\-\w+\-\w+\-\w+$", arg1):
                qres = DBQueryWarn("select pid,pid_idx,gid,gid_idx," +
                                   "    creator,creator_idx,name " +
                                   " from apt_instances " +
                                   "where uuid=%s", (arg1,), asDict=True)
                pass
            elif matched := re.match("^([\-\w]+),([\-\w]+)$", arg1):
                qres = DBQueryWarn("select pid,pid_idx,gid,gid_idx," +
                                   "    creator,creator_idx,name " +
                                   " from apt_instances " +
                                   "where pid=%s and name=%s",
                                   (matched[1], matched[2]), asDict=True)
                pass
            elif (arg2 and re.match("^[\-\w]+$", arg1) and
                  re.match("^[\-\w]+$", arg2)):
                qres = DBQueryWarn("select pid,pid_idx,gid,gid_idx," +
                                   "    creator,creator_idx,name " +
                                   " from apt_instances " +
                                   "where pid=%s and name=%s", (arg1,arg2),
                                   asDict=True)
                pass
            pass
        else:
            raise NoSuchExperiment("No such experiment: %s:%s" % (arg1,arg2))

        if qres == None or len(qres) != 1:
            raise NoSuchExperiment("No such experiment: %s:%s" % (arg1,arg2))

        row = qres[0]
        self.name        = row["name"]
        self.pid         = row["pid"]
        self.pid_idx     = row["pid_idx"]
        self.gid         = row["gid"]
        self.gid_idx     = row["gid_idx"]
        self.creator     = row["creator"]
        self.creator_idx = row["creator_idx"]
        self.projgroup   = ProjectGroup(self.pid_idx, self.gid_idx);
        pass

    @property
    def group(self):
        return self.projgroup
    
    def AccessCheck(self, user, access_type):
        if isinstance(user, User):
            user = user
        else:
            user = User(user)
            pass

        if (access_type < TB_EXPT_MIN or
	    access_type > TB_EXPT_MAX):
            raise AccessCheckError("*** Invalid access type: %r" % (access_type,))

        # User can muck with his own stuff.
        if self.creator_idx == user.uid_idx:
            return True

        if access_type == TB_EXPT_READINFO:
            mintrust = PROJMEMBERTRUST_USER
        else:
            mintrust = PROJMEMBERTRUST_GROUPROOT
            pass

        #
        # Either proper permission in the group, or group_root in the project.
        # This lets group_roots muck with other people's experiments, including
        # those in groups they do not belong to.
        #
        group_trust = user.GroupTrust(self.projgroup)
        project_trust = user.GroupTrust(self.projgroup.project)
        
        return (TBMinTrust(group_trust, mintrust) or
                TBMinTrust(project_trust, PROJMEMBERTRUST_GROUPROOT));
    
    pass

#
# Reservation Groups
#
TB_RESGROUP_READ                = 1
TB_RESGROUP_MODIFY              = 2
TB_RESGROUP_MIN                 = TB_RESGROUP_READ
TB_RESGROUP_MAX                 = TB_RESGROUP_MODIFY

class ResGroup:
    def __init__(self, arg1):
        qres = None
        
        if type(arg1) == str:
            if re.match("^\w+\-\w+\-\w+\-\w+\-\w+$", arg1):
                qres = DBQueryWarn("select pid,pid_idx,gid,gid_idx," +
                                   "    creator_uid,creator_idx " +
                                   " from apt_reservation_groups " +
                                   "where uuid=%s", (arg1,), asDict=True)
                pass
            pass
        else:
            raise NoSuchResGroup("No such resgroup: %s" % (arg1,))

        if qres == None or len(qres) != 1:
            raise NoSuchResGroup("No such resgroup: %s" % (arg1,))

        row = qres[0]
        self.pid         = row["pid"]
        self.pid_idx     = row["pid_idx"]
        self.gid         = row["gid"]
        self.gid_idx     = row["gid_idx"]
        self.creator     = row["creator_uid"]
        self.creator_idx = row["creator_idx"]
        self.projgroup   = ProjectGroup(self.pid_idx, self.gid_idx);
        pass

    @property
    def group(self):
        return self.projgroup
    
    def AccessCheck(self, user, access_type):
        if isinstance(user, User):
            user = user
        else:
            user = User(user)
            pass

        if (access_type < TB_RESGROUP_MIN or
	    access_type > TB_RESGROUP_MAX):
            raise AccessCheckError("*** Invalid access type: %r" % (access_type,))

        # User can muck with his own stuff.
        if self.creator_idx == user.uid_idx:
            return True

        if access_type == TB_RESGROUP_READ:
            mintrust = PROJMEMBERTRUST_LOCALROOT
        else:
            mintrust = PROJMEMBERTRUST_GROUPROOT
            pass

        #
        # Either proper permission in the group, or group_root in the project.
        # This lets group_roots muck with other people's experiments, including
        # those in groups they do not belong to.
        #
        group_trust = user.GroupTrust(self.projgroup)
        project_trust = user.GroupTrust(self.projgroup.project)
        #print(str(group_trust))
        #print(str(project_trust))

        return (TBMinTrust(group_trust, mintrust) or
                TBMinTrust(project_trust, PROJMEMBERTRUST_GROUPROOT));
    
    pass

#
# Profiles
#
TB_PROFILE_READINFO            = 1
TB_PROFILE_MODIFY              = 2
TB_PROFILE_DESTROY             = 3
TB_PROFILE_UPDATE              = 4
TB_PROFILE_MIN                 = TB_PROFILE_READINFO
TB_PROFILE_MAX                 = TB_PROFILE_UPDATE

class Profile:
    def __init__(self, arg1):
        qres = None

        #
        # pid,name refers to current version of profile.
        # uuid can refer to current version or a specific version.
        #
        if matched := re.match("^([\-\w]+),([\-\w]+)$", arg1):
            qres = DBQueryWarn("select i.pid,i.pid_idx,i.gid,i.gid_idx," +
                               "   v.creator,v.creator_idx, " +
                               "   i.public,i.project_write, " +
                               "   i.uuid,v.uuid as version_uuid " +
                               " from apt_profiles as i " +
                               "left join apt_profile_versions as v on " +
			       "   v.profileid=i.profileid and " +
			       "   v.version=i.version " +
                               "where i.pid=%s and i.name=%s",
                               (matched[1], matched[2]), asDict=True)
        elif re.match("^\w+\-\w+\-\w+\-\w+\-\w+$", arg1):
	    #
	    # First look to see if the uuid is for the profile itself,
	    # which means current version. Otherwise look for a
	    # version with the uuid.
	    #
            qres = DBQueryWarn("select i.pid,i.pid_idx,i.gid,i.gid_idx," +
                               "   v.creator,v.creator_idx, " +
                               "   i.public,i.project_write, " +
                               "   i.uuid,v.uuid as version_uuid " +
                               " from apt_profiles as i " +
                               "left join apt_profile_versions as v on " +
			       "   v.profileid=i.profileid and " +
			       "   v.version=i.version " +
                               "where i.uuid=%s", (arg1,), asDict=True)

            if qres == None or len(qres) == 0:
                qres = DBQueryWarn("select i.pid,i.pid_idx,i.gid,i.gid_idx," +
                                   "   v.creator,v.creator_idx, " +
                                   "   i.public,i.project_write, " +
                                   "   i.uuid,v.uuid as version_uuid " +
                                   " from apt_profile_versions as v " +
                                   "left join apt_profiles as i on " +
                                   "   v.profileid=i.profileid " +
                                   "where v.uuid=%s and v.deleted is null",
                                   (arg1,), asDict=True)
                pass
            pass
        else:
            raise NoSuchProfile("No such profile: %s" % (arg1,))

        if qres == None or len(qres) != 1:
            raise NoSuchProfile("No such profile: %s" % (arg1,))

        row = qres[0]
        self.pid          = row["pid"]
        self.pid_idx      = row["pid_idx"]
        self.gid          = row["gid"]
        self.gid_idx      = row["gid_idx"]
        self.creator      = row["creator"]
        self.creator_idx  = row["creator_idx"]
        self.uuid         = row["uuid"]
        self.version_uuid = row["version_uuid"]
        self.public       = row["public"]
        self.project_write= row["project_write"]
        self.projgroup    = ProjectGroup(self.pid_idx, self.gid_idx);
        pass

    @property
    def group(self):
        return self.projgroup
    
    def AccessCheck(self, user, access_type):
        if isinstance(user, User):
            user = user
        else:
            user = User(user)
            pass

        if (access_type < TB_PROFILE_MIN or
	    access_type > TB_PROFILE_MAX):
            raise AccessCheckError("*** Invalid access type: %r" % (access_type,))

        # User can muck with his own stuff.
        if self.creator_idx == user.uid_idx:
            return True

        if access_type == TB_PROFILE_READINFO:
            if self.public:
                return True
            
            mintrust = PROJMEMBERTRUST_LOCALROOT
        else:
            if self.project_write:
                mintrust = PROJMEMBERTRUST_LOCALROOT
            else:
                mintrust = PROJMEMBERTRUST_GROUPROOT
                pass
            pass

        #
        # Either proper permission in the group, or group_root in the project.
        # This lets group_roots muck with other people's experiments, including
        # those in groups they do not belong to.
        #
        group_trust = user.GroupTrust(self.projgroup)
        project_trust = user.GroupTrust(self.projgroup.project)
        #print(str(group_trust))
        #print(str(project_trust))

        return (TBMinTrust(group_trust, mintrust) or
                TBMinTrust(project_trust, PROJMEMBERTRUST_GROUPROOT));
    
#
# Testing
#
def TestAccess(what, shouldbe, computed):
    print(what + ":", computed)
    if shouldbe != computed:
        print("  FAILED")
        pass
    pass

if __name__ == "__main__":
    leebee    = User("leebee")
    leebee7   = User("leebee7")
    leebee44  = User("leebee44")
    brenda    = User("Brenda")
    stoller   = User("stoller")
    admin     = User("stoller", role="admin")
    testbed   = ProjectGroup("testbed", "testbed")
    lbsbox    = ProjectGroup("lbsbox", "lbsbox")
    lbsboxT1  = ProjectGroup("lbsbox", "T1")
    sensors   = Experiment("testbed", "tempsensors")
    rando     = Experiment("85ebf0e5-7aa8-11ef-a601-e4434b2381fc")
    #resgroupA = ResGroup("cb83e72a-04fd-11f0-af1a-e4434b2381fc")
    profileA  = Profile("emulab-ops,small-lan")
    profileB1 = Profile("95f0bfb3-7c5a-11ef-b3bd-e4434b2381fc")
    profileB2 = Profile("4cbae978-7ad2-11ef-b3bd-e4434b2381fc")
    
    TestAccess("stoller read leebee", True,
               leebee.AccessCheck(stoller, TB_USERINFO_READINFO))
    TestAccess("leebee read stoller", True,
               stoller.AccessCheck(leebee, TB_USERINFO_READINFO))
    TestAccess("stoller modify leebee", True,
               leebee.AccessCheck(stoller, TB_USERINFO_MODIFYINFO))
    TestAccess("leebee modify stoller", False,
               stoller.AccessCheck(leebee, TB_USERINFO_MODIFYINFO))
    TestAccess("leebee read brenda", False,
               brenda.AccessCheck(leebee, TB_USERINFO_READINFO))
    TestAccess("stoller admin read brenda", True,
               brenda.AccessCheck(admin, TB_USERINFO_READINFO))

    TestAccess("stoller read testbed", True,
               testbed.AccessCheck(stoller, TB_PROJECT_READINFO))
    TestAccess("stoller read lbsbox", False,
               lbsbox.AccessCheck(stoller, TB_PROJECT_READINFO))
    TestAccess("stoller admin read lbsbox", True,
               lbsbox.AccessCheck(admin, TB_PROJECT_READINFO))
    TestAccess("leebee create subgroup in lbsbox", True,
               lbsbox.AccessCheck(leebee, TB_PROJECT_MAKEGROUP))
    TestAccess("leebee7 create subgroup in lbsbox", False,
               lbsbox.AccessCheck(leebee7, TB_PROJECT_MAKEGROUP))
    TestAccess("leebee add user to subgroup in lbsbox", True,
               lbsboxT1.AccessCheck(leebee, TB_PROJECT_ADDUSER))
    TestAccess("leebee7 add user to subgroup in lbsbox", True,
               lbsboxT1.AccessCheck(leebee7, TB_PROJECT_ADDUSER))
    TestAccess("leebee44 add user to subgroup in lbsbox", False,
               lbsboxT1.AccessCheck(leebee44, TB_PROJECT_ADDUSER))
    TestAccess("stoller admin add user to subgroup in lbsbox", True,
               lbsboxT1.AccessCheck(admin, TB_PROJECT_ADDUSER))

    TestAccess("stoller read experiment sensors", True,
               sensors.AccessCheck(stoller, TB_EXPT_READINFO))
    TestAccess("leebee read experiment sensors", False,
               sensors.AccessCheck(leebee, TB_EXPT_READINFO))
    TestAccess("stoller modify experiment sensors", True,
               sensors.AccessCheck(stoller, TB_EXPT_MODIFY))
    TestAccess("leebee modify experiment sensors", False,
               sensors.AccessCheck(leebee, TB_EXPT_MODIFY))

    if False:
        TestAccess("leebee read resgroup A", True,
                   resgroupA.AccessCheck(leebee, TB_RESGROUP_READ))
        TestAccess("stoller read resgroup A", False,
                   resgroupA.AccessCheck(stoller, TB_RESGROUP_READ))
        TestAccess("stoller admin read resgroup A", True,
                   resgroupA.AccessCheck(admin, TB_RESGROUP_READ))
        pass

    TestAccess("stoller read profile profileA", True,
               profileA.AccessCheck(stoller, TB_PROFILE_READINFO))
    TestAccess("stoller read profile profileB1", False,
               profileB1.AccessCheck(stoller, TB_PROFILE_READINFO))
    TestAccess("stoller admin read profile profileB1", True,
               profileB1.AccessCheck(admin, TB_PROFILE_READINFO))
    TestAccess("leebee write profile profileB2", True,
               profileB2.AccessCheck(leebee, TB_PROFILE_MODIFY))

pass
