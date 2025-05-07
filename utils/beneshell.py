#!/usr/bin/env python

#
# This script manages Benetel O-RU devices. It does not (and should
# not grow) any testbed-specific dependencies, so that it may be used
# on any system that runs Python and has SSH binaries in the path.
#
# This script is able to perform various operations on Benetel RU devices:
#
# * Configuration management
#     - Reset all managed configuration values to defaults
#     - Update specific configuration settings
#     - Get (all) current configuration settings
#
# * Device status
#     - Check device up/down status (ping)
#     - Check radio initialization status
#     - Wait for radio initialization to complete
#     - Get firmware version
#
# Note: Power control and reboot are handled by the standard testbed
#       `node_reboot` and `power` scripts. Modules specifically for
#       handling Benetel RUs should be present in these scripts. They use
#       this script to check device status and wait for initialization
#       to complete. Reboot should NEVER be run directly on the device
#       via remote shell. Doing so risks damage if a corresponding DU
#       is sending samples before initialization is complete (yes,
#       this is insane, but true).
#

import sys
import time
import logging
import re
import json
import subprocess
from argparse import ArgumentParser
from getpass import getpass
from paramiko.client import SSHClient, AutoAddPolicy

### Global utility functions

def _mk_logger(name, def_lvl = logging.INFO):
    lgr = logging.getLogger(name)
    lgr.setLevel(def_lvl)
    ch = logging.StreamHandler()
    fmt = logging.Formatter('{asctime}: {name}.{funcName}: [{levelname}]: {message}', style='{')
    ch.setFormatter(fmt)
    lgr.addHandler(ch)
    return lgr

def _ping(host, count=1):
    arg = "-n" if sys.platform.lower() in ('windows', 'cygwin') else "-c"
    cmd = ['ping', arg, str(count), host]
    return subprocess.run(cmd, capture_output=True).returncode

def _whoami(obj):
    klass = obj.__class__.__name__
    func = sys._getframe(1).f_code.co_name
    return f"{klass}.{func}()"

##############################################################################
#
# SSHWrapper class definition
#
class SSHWrapper(object):
    DEF_USER = "root"
    DEF_TIMEOUT = 30 # 30 seconds

    def __init__(self, device_addr, default_user = DEF_USER,
                 default_keyfile = None):
        self.daddr = device_addr
        self.default_username = default_user
        self.default_keyfile = default_keyfile
        self.lgr = _mk_logger(self.__class__.__name__)
        self.pcli = SSHClient()
        self.pcli.load_system_host_keys()
        self.pcli.set_missing_host_key_policy(AutoAddPolicy)
        self.connected = False
        self.sftp = None

    def connect(self, username=None, password=None, keyfile=None,
                timeout=DEF_TIMEOUT):
        self.pcli.close()
        self.connected = False
        if not username:
            username = self.default_username
        if not keyfile:
            keyfile = self.default_keyfile
        try:
            self.pcli.connect(
                self.daddr, username=username, password=password,
                key_filename=keyfile, timeout=timeout, allow_agent=False)
        except Exception as e:
            self.lgr.warning(f"Error occured when trying to connect to {self.daddr}: {e}")
            raise
        else:
            self.connected = True
        return self.connected

    def is_connected(self):
        return self.connected
    
    def close(self):
        self.pcli.close()
        self.connected = False

    def exec(self, cmd, indata = None):
        stdin, stdout, stderr = self.pcli.exec_command(cmd)
        if indata:
            stdin.write(indata)
            stdin.flush()
            stdin.close()
        rstdout = list(stdout)
        rstderr = list(stderr)
        stdout.close()
        stderr.close()
        return rstdout, rstderr

    def get_sftp(self):
        if not self.sftp or self.sftp.sock.closed:
            self.sftp = self.pcli.open_sftp()
        return self.sftp

    def close_sftp(self):
        if self.sftp:
            self.sftp.close()
            self.sftp = None

    def open_remote_file(self, remote_path, mode="r"):
        return self.get_sftp().open(remote_path, mode)

    def read_remote_file(self, remote_path):
        # XXX: Reworked to use self.exec() to `cat` the file due to
        #      compat issues with SFTP on the Benetel.
        #rfile = self.open_remote_file(remote_path, "r")
        #rfile.prefetch()
        #res = rfile.readlines()
        #rfile.close()
        self.stat_remote_file(remote_path)
        return self.exec(f"cat {remote_path}")[0]

    def write_remote_file(self, remote_path, lines, overwrite = False):
        # XXX: Reworked to use self.exec() and `cat` to write files
        #      due to compat issues with SFTP on the Benetel.
        exists = False
        try:
            #self.get_sftp().stat(remote_path)
            self.stat_remote_file(remote_path)
            exists = True
        except FileNotFoundError:
            exists = False
        if not overwrite and exists:
            raise RuntimeError(f"{_whoami(self)}: file exists, but "
                               "`overwrite` was not set to True!")
        #rfile = self.open_remote_file(remote_path, "w")
        #rfile.writelines(lines)
        #rfile.close()
        res = self.exec(f"cat - > {remote_path}", '\n'.join(lines))
        if res[1]:
            err = res[1][0].strip()
            raise RuntimeError(f"{_whoami(self)}: {err}")

    def stat_remote_file(self, remote_path):
        """
        This function assumes a linux-compatible stat command!
        """
        res = self.exec(f"stat -t {remote_path}")
        if not res[0] and res[1]:
            err = res[1][0].strip()
            if re.search("No such file", err):
                raise FileNotFoundError(f"{_whoami(self)}: {err}")
            raise RuntimeError(f"{_whoami(self)}: {remote_path}: {err}")
        st = res[0][0].strip().split()
        stat_dict = {
            "fname": st[0],
            "size": int(st[1]),
            "blocks": int(st[2]),
            "uid": int(st[4]),
            "gid": int(st[5]),
            "atime": int(st[11]),
            "mtime": int(st[12]),
            "ctime": int(st[13]),
            "btime": int(st[14])
        }
        return stat_dict

    def grep_remote_file(self, remote_path, rexp, timeout = 0):
        res = []
        stoptime = time.time() + timeout
        #rfile = self.open_remote_file(remote_path, "r")
        #rfile.prefetch()
        # XXX: Reworked to use `tail` due to SFTP compat issues on
        #      Benetel. Known issue: This can leave "tail" commands
        #      running on the remote host until the Paramiko ssh session
        #      is closed.  Need to revisit...
        follow_opt = "-f" if timeout > 0 else ""
        stdin, stdout, stderr = \
            self.pcli.exec_command(f"tail -n +1 {follow_opt} {remote_path}")
        while not res:
            #if rfile.tell() < rfile.stat().st_size:
            #    for ln in rfile.readlines():
            cursize = self.stat_remote_file(remote_path)['size']
            while stdout.tell() < cursize:
                ln = stdout.readline()
                if re.search(rexp, ln):
                    res.append(ln)
            if timeout >= 0 and time.time() >= stoptime:
                break
            elif not res:
                time.sleep(1)
        stdin.close()
        stdout.close()
        stderr.close()
        #rfile.close()
        return res

##############################################################################
#
# BenetelConfig class definition
#
class BenetelConfig(object):
    DEFAULT_SETTINGS = {
        'center_frequency': {
            'def': 3370.2,
            'allowed_ranges': ((3358.0,3600.0),)
        },
        'bandwidth': {
            'def': 20000000,
            'allowed_values': (20000000, 40000000)
        },
        'fh_cplane_vlan': {
            'def': 1,
            'allowed_ranges': ((1,4096),)
        },
        'fh_uplane_vlan': {
            'def': 1,
            'allowed_ranges': ((1,4096),)
        },
        'du_cplane_mac': {
            'def': '000000000000',
            'allowed_patterns': (r'[0-9A-Fa-f]{12}',)
        },
        'du_uplane_mac': {
            'def': '000000000000',
            'allowed_patterns': (r'[0-9A-Fa-f]{12}',)
        },
        'mimo_mode': {
            'def': '2_4',
            'allowed_values': ('1_3','2_4','1_2_3_4_4x2','1_2_3_4_4x4')
        },
        'downlink_scaling': {
            'def': 0,
            'allowed_values': (0, 6, 12, 18)
        },
        'prach_format': {
            'def': 'short',
            'allowed_values': ('short', 'long')
        },
        'compression': {
            'def': 'dynamic_compressed',
            'allowed_values': ('static_uncompressed', 'static_compressed',
                               'dynamic_uncompressed', 'dynamic_compressed')
        },
        'lf_prach_compression_enable': {
            'def': 'false',
            'allowed_values': ('true', 'false')
        },
# TDD setting needs special attention...
#        'TDD_mode': {
#            'def': 'DDDDDDDSUU',
#            'allowed_values': ('DDDDDDDSUU', 'DDDSUUDDDD', 'DDDSUUDSUU',
#                               'DDSUUUDSUU', 'DDDSU')
#        }
    }
    
    def __init__(self, settings = {}):
        self._settings = {}
        self._check_and_set(settings)

    def _check_and_set(self, settings):
        for k, v in self.DEFAULT_SETTINGS.items():
            if not k in settings:
                self[k] = v['def']
            else:
                self[k] = settings[k]

    def keys(self):
        return self._settings.keys()

    def values(self):
        return self._settings.values()

    def items(self):
        return self._settings.items()

    def update(self, partial):
        for k,v in partial.items():
            self[k] = v

    def __len__(self):
        return len(self._settings)

    def __iter__(self):
        return iter(self._settings)

    def __contains__(self, item):
        return item in self._settings

    def __getitem__(self, key):
        return self._settings[key]

    def __repr__(self):
        return repr(self._settings)

    def __setitem__(self, key, value):
        if not key in self.DEFAULT_SETTINGS:
            raise KeyError(f"{_whoami(self)}: key '{key}' is invalid.")
        vchk = self.DEFAULT_SETTINGS[key]
        if 'allowed_ranges' in vchk:
            rfound = False
            for rng in vchk['allowed_ranges']:
                value = type(rng[0])(value)
                if rng[0] <= value <= rng[1]:
                    rfound = True
                    break
                if not rfound:
                    raise ValueError(
                        f"{_whoami(self)}: value '{value}' provided for "
                        f"setting '{key}' is outside of allowed range(s)")
        if 'allowed_patterns' in vchk:
            pfound = False
            for pat in vchk['allowed_patterns']:
                if re.search(f"^{pat}$", value):
                    pfound = True
                    break
                if not pfound:
                    raise ValueError(
                        f"{_whoami(self)}: value '{value}' provided for "
                        f"setting '{key}' does not match allowed pattern(s)")
        if 'allowed_values' in vchk:
            av = vchk['allowed_values']
            value = type(av[0])(value)
            if not value in av:
                raise ValueError(
                    f"{_whoami(self)}: value '{value}' provided for "
                    f"setting '{key}' is not in the allowed set: {av}")
        self._settings[key] = value

##############################################################################
#
# BenetelWrapper class definition
#
class BenetelWrapper(object):
    DEF_SSH_USER = "root"
    DEF_SSH_PASSWD = ""
    DEF_BOOT_TIMEOUT = 120
    DEF_SHUTDOWN_TIME = 30
    DEF_RADIO_ONLINE_TIMEOUT = 300
    DEF_PING_TIMEOUT = 5
    WAIT_PING_SLEEP = 1
    WAIT_LOG_SLEEP = 1
    FW_VERSION_UNKNOWN = "*UNKNOWN*"
    FW_VERSION_FILE = "/etc/benetel-rootfs-version"
    RADIO_BOOT_LOG = "/tmp/logs/radio_status"
    RADIO_ONLINE_STATUS_PATTERN = r'^\[INFO\] Radio bringup complete'
    RADIO_SETUP_SCRIPT = "/usr/sbin/radio_setup_a.sh"
    RADIO_SETUP_SCRIPT_PATTERN = r'-w (C[0-9A-Fa-f]+) -x 0x([0-9A-Fa-f]+)'
    RADIO_CONFIG_FILE = "/etc/ru_config.cfg"
    RADIO_CONFIG_FILE_PATTERN = r'^\s*(\w+)\s*=\s*(\w+)'
    SINGLE_FILE_SETTINGS_MAP = {
        'center_frequency': '/etc/ru-center-frequency-mhz',
        'bandwidth': '/etc/ru-bandwidth',
    }
    RADIO_SETUP_SCRIPT_SETTINGS = \
        ('fh_cplane_vlan', 'fh_uplane_vlan', 'du_cplane_mac',
         'du_uplane_mac')
    RADIO_CONFIG_FILE_SETTINGS = \
        ('mimo_mode', 'downlink_scaling', 'prach_format',
         'compression', 'lf_prach_compression_enable')

    def __init__(self, mgmt_addr, username=DEF_SSH_USER, keyfile=None):
        self.addr = mgmt_addr
        self.lgr = _mk_logger(self.__class__.__name__)
        self.fwversion = self.FW_VERSION_UNKNOWN
        self._ssh = SSHWrapper(mgmt_addr, default_user=username,
                               default_keyfile=keyfile)

    def connect_session(self, password = DEF_SSH_PASSWD, retries = 0):
        self.wait_for_ping()
        self._ssh.connect(password = password)
        try:
            contents = self._ssh.read_remote_file(self.FW_VERSION_FILE)
        except FileNotFoundError as e:
            self._ssh.close()
            self.lgr.warning("Remote host is not a Benetel RU?")
            raise
        self.fwversion = contents[0].strip()

    def get_session(self):
        if not self.is_connected():
            self.connect_session()
        return self._ssh

    def close_session(self):
        self._ssh.close()

    def is_connected(self):
        return self._ssh.is_connected()

    def get_firmware_version(self):
        return self.fwversion

    def wait_for_ping(self, timeout = DEF_PING_TIMEOUT, invert = False):
        ctime = time.time()
        tmo = ctime + timeout
        while ctime <= tmo:
            res = _ping(self.addr)
            if (not invert and res == 0) or (invert and res > 0):
                return
            time.sleep(self.WAIT_PING_SLEEP)
            ctime = time.time()
        raise TimeoutError(f"{_whoami(self)}: Timed out waiting for ping reply.")

    def reboot(self):
        self.get_session().exec("reboot")
        self.wait_for_ping(self.DEF_SHUTDOWN_TIME, invert=True)
        self.close_session()
        self.lgr.info("Device rebooted.")

    def wait_for_radio_online(self, timeout = DEF_RADIO_ONLINE_TIMEOUT):
        res = []
        stime = time.time()
        self.wait_for_ping(self.DEF_BOOT_TIMEOUT)
        self.lgr.info("Device pings. Waiting for radio.")
        while time.time() <= stime + self.DEF_BOOT_TIMEOUT:
            try:
                res = self.get_session().\
                    grep_remote_file(
                        self.RADIO_BOOT_LOG,
                        self.RADIO_ONLINE_STATUS_PATTERN,
                        timeout = timeout)
            except FileNotFoundError:
                time.sleep(self.WAIT_LOG_SLEEP)
            else:
                break
        if len(res) > 0:
            self.lgr.info("Radio is ready.")
            return True
        return False

    def _fetch_single_file_setting(self, setting):
        rfile = self.SINGLE_FILE_SETTINGS_MAP[setting]
        return self.get_session().read_remote_file(rfile)[0].strip()

    def _push_single_file_setting(self, setting, value):
        rfile = self.SINGLE_FILE_SETTINGS_MAP[setting]
        outlines = (str(value),)
        self.get_session().write_remote_file(rfile, outlines, overwrite=True)

    def _fetch_radio_setup_script_settings(self):
        settings = {}
        scrset = {}
        for ln in self.get_session().\
                read_remote_file(self.RADIO_SETUP_SCRIPT):
            m = re.search(self.RADIO_SETUP_SCRIPT_PATTERN, ln)
            if m:
                scrset[m[1]] = m[2]
        settings['fh_cplane_vlan'] = int(scrset['C0331'], base=16)
        settings['fh_uplane_vlan'] = int(scrset['C0318'], base=16)
        settings['du_cplane_mac'] = scrset['C031A'] + scrset['C0319']
        settings['du_uplane_mac'] = scrset['C0316'] + scrset['C0315']
        return settings

    def _push_radio_setup_script_settings(self, settings):
        outlines = []
        prepat = r'-w \1 -x 0x'
        subst = {
            'C0331': prepat +
            format(settings['fh_cplane_vlan'], 'X'),
            'C0318': prepat +
            format(settings['fh_uplane_vlan'], 'X'),
            'C0330': prepat +
            format(settings['fh_uplane_vlan'], 'X'),
            'C031A': prepat +
            settings['du_cplane_mac'][0:4].upper(),
            'C0319': prepat +
            settings['du_cplane_mac'][4:].upper(),
            'C0316': prepat +
            settings['du_uplane_mac'][0:4].upper(),
            'C0315': prepat +
            settings['du_uplane_mac'][4:].upper(),
        }
        for ln in self.get_session().\
                read_remote_file(self.RADIO_SETUP_SCRIPT):
            ln = ln.rstrip()
            m = re.search(self.RADIO_SETUP_SCRIPT_PATTERN, ln)
            if m and m[1] in subst:
                res = re.sub(self.RADIO_SETUP_SCRIPT_PATTERN, subst[m[1]], ln)
                outlines.append(res)
            else:
                outlines.append(ln)
        outlines.append("") # Add final newline...
        self.get_session().\
            write_remote_file(self.RADIO_SETUP_SCRIPT, outlines, overwrite=True)

    def _fetch_radio_config_file_settings(self):
        settings = {}
        for ln in self.get_session().\
                read_remote_file(self.RADIO_CONFIG_FILE):
            m = re.search(self.RADIO_CONFIG_FILE_PATTERN, ln)
            if m and m[1] in self.RADIO_CONFIG_FILE_SETTINGS:
                settings[m[1]] = m[2]
        return settings

    def _push_radio_config_file_settings(self, settings):
        outlines = []
        for ln in self.get_session().\
                read_remote_file(self.RADIO_CONFIG_FILE):
            ln = ln.rstrip()
            m = re.search(self.RADIO_CONFIG_FILE_PATTERN, ln)
            if m and m[1] in self.RADIO_CONFIG_FILE_SETTINGS:
                outlines.append(
                    re.sub(self.RADIO_CONFIG_FILE_PATTERN,
                           r'\1=' + str(settings[m[1]]), ln))
            else:
                outlines.append(ln)
        outlines.append("") # Add final newline since this is a script...
        self.get_session().\
            write_remote_file(self.RADIO_CONFIG_FILE, outlines, overwrite=True)

    def fetch_settings(self):
        settings = BenetelConfig()
        for stg in self.SINGLE_FILE_SETTINGS_MAP.keys():
            settings[stg] = self._fetch_single_file_setting(stg)
        settings.update(self._fetch_radio_setup_script_settings())
        settings.update(self._fetch_radio_config_file_settings())
        return settings

    def push_settings(self, settings):
        if not type(settings) == BenetelConfig:
            raise ValueError(f"{_whoami(self)}: 'settings' argument must be a BenetelConfig object!")
        for stg in self.SINGLE_FILE_SETTINGS_MAP.keys():
            self._push_single_file_setting(stg, settings[stg])
        self._push_radio_setup_script_settings(settings)
        self._push_radio_config_file_settings(settings)

##############################################################################
#
# Top-level code (main script entry point)
#
def connect(args):
    bw = BenetelWrapper(args.address, args.username)
    passwd = getpass() if args.password else ""
    bw.connect_session(password=passwd)
    passwd = None
    return bw

def update_config(args, bw):
    cfg = []
    json_data = None
    if args.json_config == "-":
        json_data = sys.stdin.read()
    else:
        with open(args.json_config, "r") as cfg_f:
            json_data = cfg_f.read()
    cfg = json.loads(json_data)
    dcfg = bw.fetch_settings()
    dcfg.update(cfg)
    bw.push_settings(dcfg)

def parse_args():
    parser = ArgumentParser()
    parser.add_argument("address", help="Address (hostname or IP) of the device.")
    parser.add_argument("-u", "--username", default=BenetelWrapper.DEF_SSH_USER, help="Username to supply when logging in to device.")
    parser.add_argument("-p", "--password", action="store_true", help="Read password from command line.")
    parser.add_argument("-g", "--get-config", action="store_true", help="Get configuration from device and print to stdout in JSON format.")
    parser.add_argument("-j", "--json-config", help="Apply configuration, specified in a JSON file, to the device (specify '-' to read config from stdin). Does NOT imply the `reboot` argument.")
    parser.add_argument("-r", "--reboot", action="store_true", help="Reboot the RU (via `reboot` over SSH session). Performed after most other actions (see `--wait` argument).")
    parser.add_argument("-w", "--wait", type=int, default=-1, help="Wait for the radio on the device to become active, timing out after WAIT seconds. Does NOT imply the `reboot` argument. This action is performed last (after all other actions complete).")
    return parser.parse_args()
   
def main():
    args = parse_args()
    lgr = _mk_logger("beneshell")
    bw = None
    try:
        bw = connect(args)
        if not args.get_config:
            lgr.info(f"Connected to {args.address}. Firmware: {bw.get_firmware_version()}")
    except:
        lgr.exception("Failed to connect to the device:")
        return 1
    if args.json_config:
        try:
            update_config(args, bw)
        except:
            lgr.exception("Failed to update configuration on device:")
            return 1
        else:
            lgr.info("Device settings updated successfully.")
    if args.get_config:
        try:
            dcfg = bw.fetch_settings()
            print(json.dumps(dict(dcfg), sort_keys=True, indent=4))
        except:
            lgr.exception("Failed to fetch or print device configuration:")
            return 1
    if args.reboot:
        lgr.info("Rebooting device.")
        try:
            bw.reboot()
        except:
            lgr.exception("Failure encountered while trying to reboot device:")
            return 1
    if args.wait >= 0:
        res = False
        try:
            res = bw.wait_for_radio_online(args.wait)
        except:
            lgr.exception("Failed while waiting for radio to come online:")
            return 1
        if not res:
            lgr.warning("Timed out while waiting for radio to come online.")
            return 1
    return 0

if __name__ == "__main__":
    sys.exit(main())
