import argparse
import os

sites = [
    "boss.apt.emulab.net",
    "boss.utah.cloudlab.us",
    "boss.clemson.cloudlab.us",
    "boss.wisc.cloudlab.us",
    "boss.cloudlab.umass.edu",
    
    "boss.bookstore.powderwireless.net",
    "boss.ebc.powderwireless.net",
    "boss.cpg.powderwireless.net",
    "boss.guesthouse.powderwireless.net",
    "boss.humanities.powderwireless.net",
    "boss.law73.powderwireless.net",
    "boss.madsen.powderwireless.net",
    "boss.moran.powderwireless.net",
    "boss.sagepoint.powderwireless.net",
    "boss.web.powderwireless.net",
]

wap = "/usr/testbed/sbin/withadminprivs"
import_image = "/usr/testbed/sbin/image_import"

def main():
    parser = argparse.ArgumentParser(
                        prog='trasnfer-images',
                        description='SSH to Cloudlab sites and initiate image import to update them to the latest verion of the specified image id')
    parser.add_argument('image')
    parser.add_argument('-i', '--impotent',
                        action='store_true')
    args = parser.parse_args()
    for site in sites:
        image = args.image
        if image == "UBUNTU22-64-STD" and site == "boss.utah.cloudlab.us":
            image = "UBUNTU22-64-X86"
        print("\n\n\n")
        print("==================")
        print(site)
        print("==================")
        command = f"ssh -o ConnectTimeout=5 -o StrictHostKeyChecking=no -l elabman {site} {wap} {import_image} -g -r emulab-ops,{image}"
        print(command + "\n")
        if not args.impotent:
            os.system(command)

if __name__ == "__main__":
    main()
