As of FreeBSD 13.3, all you need to do to make sure your boss/ops packages
are up to date is:

    sudo pkg upgrade -r Emulab

If you have HP Moonshot nodes and had to install the older `ipmitool`, pkg
will probably tell you:

    New packages to be INSTALLED:
            ipmitool: 1.8.18_4 [Emulab]
    
    Installed packages to be UPGRADED:
            ...
    
    Installed packages to be REINSTALLED:
            emulab-boss-9.3 [Emulab] (direct dependency changed: ipmitool)

in which case, you have to do the following:

     # unlock package if it is locked and remove it
     sudo pkg unlock emulab-ipmitool-old
     sudo pkg delete -f emulab-ipmitool-old

     # force an upgrade to update your packages (will install wrong ipmitool)
     sudo pkg upgrade -r Emulab

     # delete just the ipmitool package
     sudo pkg delete -f ipmitool

     # re-add the old (right) ipmitool USING THE PACKAGE
     sudo pkg fetch -r Emulab emulab-ipmitool-old
     cd /var/cache/pkg
     sudo pkg add -M emulab-ipmitool-old-1.8.15_1.pkg

     # change the dependency
     sudo pkg set -n ipmitool:emulab-ipmitool-old

     # make sure all is well
     sudo pkg check -adBs
