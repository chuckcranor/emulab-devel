#!/usr/bin/env python3

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
#     - Get all current configuration settings
#     - Get specific configuration settings
#
# * Device status
#     - Check device up/down status (ping)
#     - Check initialization status
#     - Wait for device initialization to complete
#
# Note: Power control and reboot are handled by the standard testbed
#       `node_reboot` and `power` scripts. Modules specifically for
#       handling Benetel RUs are present in these scripts. They use
#       this script to check device status and wait for initialization
#       to complete. Reboot should NEVER be run directly on the device
#       via remote shell. Doing so risks damage if a corresponding DU
#       is sending samples before initialization is complete (yes,
#       this is insane, but true).
#

import sys
#import tempfile
#import argparse
import time
import re

import paramiko.client as parcli
import paramiko.ssh_exception as parexc

class SSHWrapper(object):
    DEF_USER = "root"
    DEF_TIMEOUT = 30 # 30 seconds

    def __init__(self, device_addr, default_user = DEF_USER, default_keyfile = None):
        self.daddr = device_addr
        self.default_username = default_user
        self.default_keyfile = default_keyfile
        self.pcli = parcli.SSHClient()
        self.pcli.load_system_host_keys()
        self.pcli.set_missing_host_key_policy(parcli.AutoAddPolicy)
        self.connected = False
        self.sftp = None

    def connect(self, username=None, password=None, keyfile=None, timeout=DEF_TIMEOUT):
        self.pcli.close()
        self.connected = False
        if not username:
            username = self.default_username
        if not keyfile:
            keyfile = self.default_keyfile
            
        try:
            self.pcli.connect(self.daddr, username=username, password=password, key_filename=keyfile, timeout=timeout, allow_agent=False)
        except parexc.NoValidConnectionsError as e:
            print("Unable to connect to device: {}".format(e), file=sys.stderr)
        except parexc.BadHostKeyException as e:
            print("Host key problem encountered: {}".format(e), file=sys.stderr)
        except parexc.AuthenticationException as e:
            print("Failed to authenticate to device: {}".format(e), file=sys.stderr)
        except Exception as e:
            print("Error occured when trying to connect: {}".format(e), file=sys.stderr)
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
        # XXX: Reworked to use self.exec() due to compat issues.
        #rfile = self.open_remote_file(remote_path, "r")
        #rfile.prefetch()
        #res = rfile.readlines()
        #rfile.close()
        return self.exec(f"cat {remote_path}")[0]

    def write_remote_file(self, remote_path, lines, overwrite = False):
        exists = False
        try:
            self.get_sftp().stat(remote_path)
            exists = True
        except FileNotFoundError:
            exists = False
        if not overwrite and exists:
            raise RuntimeError("write_remote_file(): file exists, but `overwrite` was not set to True!")
        rfile = self.open_remote_file(remote_path, "w")
        rfile.writelines(lines)
        rfile.close()

    def grep_remote_file(self, remote_path, rexp, timeout = 0):
        res = []
        stoptime = time.time() + timeout
        # XXX: Reworked to use self.read_remote_file() due to incompat.
        #rfile = self.open_remote_file(remote_path, "r")
        #rfile.prefetch()
        while not res:
            #if rfile.tell() < rfile.stat().st_size:
            #    for ln in rfile.readlines():
            for ln in self.read_remote_file(remote_path):
                if re.search(rexp, ln):
                    res.append(ln)
            if timeout >= 0 and time.time() >= stoptime:
                break
            elif not res:
                time.sleep(1)
        rfile.close()
        return res

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
        'MIMO_mode': {
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
            'allowed_values': ('static_uncompressed', 'dynamic_uncompressed',
                               'static_compressed', 'dynamic_compressed')
        },
        'lf_prach_compression_enable': {
            'def': 'false',
            'allowed_values': ('true', 'false')
        },
        'TDD_mode': {
            'def': 'DDDDDDDSUU',
            'allowed_values': ('DDDDDDDSUU', 'DDDSUUDDDD', 'DDDSUUDSUU',
                               'DDSUUUDSUU', 'DDDSU')
        }
    }
    
    def __init__(self, settings = {}):
        self._check_and_set(settings)
        self.settings = settings

    def _check_and_set(self, settings):
        for k, v in self.DEFAULT_SETTINGS.items():
            if not k in settings:
                settings[k] = v['def']
            else:
                val = settings[k]
                if 'allowed_ranges' in v:
                    rfound = False
                    for rng in v['allowed_ranges']:
                        val = type(rng[0])(val)
                        if val >= rng[0] and val <= rng[1]:
                            rfound = True
                            break
                    if not rfound:
                        raise ValueError(f"BenetelConfig: value '{val}' provided for setting '{k}' is outside of allowed range(s)")
                if 'allowed_patterns' in v:
                    pfound = False
                    for pat in v['allowed_patterns']:
                        if re.search(f"^{pat}$", val):
                            pfound = True
                            break
                    if not pfound:
                        raise ValueError(f"BenetelConfig: value '{val}' provided for setting '{k}' does not match allowed pattern(s)")
                if 'allowed_values' in v:
                    av = v['allowed_values']
                    val = type(av[0])(val)
                    if not val in av:
                        raise ValueError(f"BenetelConfig: value '{val}' provided for setting '{k}' is not in the allowed set: {av}")


class BenetelWrapper(object):
    DEF_SSH_USER = "root"
    DEF_RADIO_ONLINE_TIMEOUT = 300
    FW_VERSION_FILE = "/etc/benetel-rootfs-version"
    RADIO_BOOT_LOG = "/tmp/logs/radio_status"
    RADIO_ONLINE_STATUS_PATTERN = r'^[INFO] Radio bringup complete'
    RADIO_SETUP_SCRIPT = "/usr/sbin/radio_setup_a.sh"
    RADIO_CONFIG_FILE = "/etc/ru_config.cfg"

    SINGLE_FILE_SETTINGS = {
        'center_frequency': '/etc/ru-center-frequency-mhz',
        'bandwidth': '/etc/ru-bandwidth',
    }
    RADIO_SETUP_SCRIPT_SETTINGS = ('fh_cplane_vlan', 'fh_uplane_vlan', 'du_cplane_maddr', 'du_uplane_maddr')
    RADIO_CONFIG_FILE_SETTINGS = ('MMIMO_mode', 'downlink_scaling', 'prach_format', 'compression', 'lf_prach_compression_enable')

    SETTINGS_HANDLERS = {}

    def __init__(self, mgmt_addr, username=DEF_SSH_USER, keyfile=None):
        self.mgmt_addr = mgmt_addr
        self.username = username
        self.keyfile = keyfile
        self.radio_script_settings = {}
        self.radio_config_settings = {}
        self.init_settings_handlers()
        self.ssh = SSHWrapper(mgmt_addr, default_user=self.username, default_keyfile=self.keyfile)

    def init_settings_handlers(self):
        for stg in SINGLE_FILE_SETTINGS.keys():
            self.SETTINGS_HANDLERS[stg] = {}
            self.SETTINGS_HANDLERS[stg]['get'] = self.get_single_file_setting
            # self.SETTINGS_HANDLERS[stg]['set'] = self.set_single_file_setting
        for stg in RADIO_SETUP_SCRIPT_SETTINGS:
            self.SETTINGS_HANDLERS[stg] = {}
            self.SETTINGS_HANDLERS[stg]['get'] = self.get_radio_setup_script_setting
            # self.SETTINGS_HANDLERS[stg]['set'] = self.set_radio_setup_script_setting
        for stg in RADIO_CONFIG_FILE_SETTINGS:
            self.SETTINGS_HANDLERS[stg] = {}
            self.SETTINGS_HANDLERS[stg]['get'] = self.get_radio_config_file_setting
            # self.SETTINGS_HANDLERS[stg]['set'] = self.set_radio_config_file_setting

    def get_ssh_session(self, password = None):
        if not self.ssh.is_connected():
            res = self.ssh.connect(password = password)
            if not res:
                raise RuntimeError("Could not connect to Benetel node!")
        return self.ssh

    def is_ssh_connected(self):
        return self.ssh.is_connected()
    
    def get_firmware_version(self):
        return self.get_ssh_session().read_remote_file(self.FW_VERSION_FILE)[0].strip()

    def get_single_file_setting(self, setting):
        rfile = self.SINGLE_FILE_SETTINGS[setting]
        return self.get_ssh_session().read_remote_file(rfile)[0].strip()

    def get_radio_setup_script_setting(self, setting, force_read = False):
        if force_read or not self.radio_script_settings:
            settings = {}
            for ln in self.get_ssh_session().read_remote_file(self.RADIO_SETUP_SCRIPT):
                m = re.search(r'-w C([0-9A-Fa-f]+) -x 0x([0-9A-Fa-f]+)', ln)
                if m:
                    settings[m[1]] = m[2]
            self.radio_script_settings['fh_cplane_vlan'] = settings['0331']
            self.radio_script_settings['fh_uplane_vlan'] = settings['0318']
            self.radio_script_settings['du_cplane_mac'] = settings['031A'] + settings['0319']
            self.radio_script_settings['du_uplane_mac'] = settings['0316'] + settings['0315']
        return self.radio_script_settings[setting]

    def get_radio_config_file_setting(self, setting, force_read = False):
        if force_read or not self.radio_config_settings:
            for ln in self.get_ssh_session().read_remote_file(self.RADIO_CONFIG_FILE):
                for stg in self.RADIO_CONFIG_FILE_SETTINGS:
                    m = re.search(r'^\s*' + stg + r'\s*=\s*(\w+)', ln)
                    if m:
                        self.radio_config_settings[stg] = m[1]
        return self.radio_config_settings[setting]

    def get_device_setting(self, setting):
        return self.SETTINGS_HANDLERS[setting]['get'](setting)
    
    def get_all_device_settings(self):
        return BenetelConfig({setting: handlers['get'](setting) for setting, handlers in self.SETTINGS_HANDLERS.items()})

    def wait_for_radio_online(self, timeout = DEF_RADIO_ONLINE_TIMEOUT):
        self.get_ssh_session().grep_remote_file(self.RADIO_BOOT_LOG, self.RADIO_ONLINE_STATUS_PATTERN, timeout = timeout)
