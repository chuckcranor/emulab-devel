#!/usr/bin/env python

#
# This library contains common code for wrapping interactions with blackbox
# devices via SSH, such as COTS O-RUs.
#

import os
import sys
import time
import logging
import re
import subprocess
from abc import ABC, abstractmethod
from paramiko.client import SSHClient, AutoAddPolicy

##############################################################################
#
# Class with various handy utility functions
#
class Utilities(object):
    WAIT_PING_SLEEP=2

    @staticmethod
    def mk_logger(name, log_level = logging.INFO):
        lgr = logging.getLogger(name)
        lgr.setLevel(log_level)
        ch = logging.StreamHandler()
        fmt = logging.Formatter('{asctime}: {name}.{funcName}(): [{levelname}]: {message}', style='{')
        ch.setFormatter(fmt)
        lgr.addHandler(ch)
        return lgr

    @staticmethod
    def ping(host, count=2):
        ping = None
        ping_paths = ("/sbin/ping", "/bin/ping", "/usr/bin/ping")
        for path in ping_paths:
            if os.path.exists(path):
                ping = path
        if not ping:
            raise RuntimeError("Utilities.ping(): Could not find ping binary!")
        cmd = [ping, "-c", str(count), host]
        return subprocess.run(cmd, capture_output=True).returncode

    @staticmethod
    def wait_for_ping(host, timeout, invert = False):
        stime = time.time()
        while time.time() <= stime + timeout:
            res = Utilities.ping(host)
            if (not invert and res == 0) or (invert and res > 0):
                return
            time.sleep(Utilities.WAIT_PING_SLEEP)
        raise TimeoutError(
            "Utilities.wait_for_ping(): Timed out waiting for ping result!")

    @staticmethod
    def whoami(obj):
        klass = obj.__class__.__name__
        func = sys._getframe(1).f_code.co_name
        return f"{klass}.{func}()"


##############################################################################
#
# Generic Device configuration abstract class (must be inherited).
#
class DeviceConfig(ABC):
    DEFAULT_SETTINGS = {
        'example_ranges': {
            'def': 100.3,
            'allowed_ranges': ((88.1, 107.9),)
        },
        'example_values': {
            'def': 20.0,
            'allowed_values': (20.0, 40.0, 60.0, 80.0, 100.0)
        },
        'example_patterns': {
            'def': '000000000000',
            'allowed_patterns': (r'[0-9A-Fa-f]{12}',)
        },
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
            raise KeyError(f"{Utilities.whoami(self)}: key '{key}' is invalid.")
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
                        f"{Utilities.whoami(self)}: value '{value}' provided for "
                        f"setting '{key}' is outside of allowed range(s)")
        if 'allowed_patterns' in vchk:
            pfound = False
            for pat in vchk['allowed_patterns']:
                if re.search(f"^{pat}$", value):
                    pfound = True
                    break
                if not pfound:
                    raise ValueError(
                        f"{Utilities.whoami(self)}: value '{value}' provided for "
                        f"setting '{key}' does not match allowed pattern(s)")
        if 'allowed_values' in vchk:
            av = vchk['allowed_values']
            value = type(av[0])(value)
            if not value in av:
                raise ValueError(
                    f"{Utilities.whoami(self)}: value '{value}' provided for "
                    f"setting '{key}' is not in the allowed set: {av}")
        self._settings[key] = value

##############################################################################
#
# SSHWrapper class definition
#
class SSHWrapper(object):
    DEF_LOG_LEVEL = logging.INFO
    DEF_USER = "root"
    DEF_TIMEOUT = 30 # 30 seconds

    def __init__(self, device_addr, default_user = DEF_USER,
                 default_keyfile = None, log_level = DEF_LOG_LEVEL):
        self.daddr = device_addr
        self.default_username = default_user
        self.default_keyfile = default_keyfile
        self.lgr = Utilities.mk_logger(self.__class__.__name__, log_level)
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

    def exec(self, cmd, indata = None, interactive = False):
        stdin, stdout, stderr = self.pcli.exec_command(cmd)
        if indata:
            stdin.write(indata)
            stdin.flush()
            if not interactive:
                stdin.close()
        if interactive:
            return stdin, stdout, stderr
        else:
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
            raise RuntimeError(f"{Utilities.whoami(self)}: file exists, but "
                               "`overwrite` was not set to True!")
        #rfile = self.open_remote_file(remote_path, "w")
        #rfile.writelines(lines)
        #rfile.close()
        res = self.exec(f"cat - > {remote_path}", '\n'.join(lines))
        if res[1]:
            err = res[1][0].strip()
            raise RuntimeError(f"{Utilities.whoami(self)}: {err}")

    def stat_remote_file(self, remote_path):
        """
        This function assumes a linux-compatible stat command on the remote!
        """
        res = self.exec(f"stat -t {remote_path}")
        if not res[0] and res[1]:
            err = res[1][0].strip()
            if re.search("No such file", err):
                raise FileNotFoundError(f"{Utilities.whoami(self)}: {err}")
            raise RuntimeError(f"{Utilities.whoami(self)}: {remote_path}: {err}")
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
# Device Wrapper abstract class. Uses SSHWrapper functionality.
#
class DeviceWrapper(ABC):
    DEF_LOG_LEVEL = logging.INFO
    DEF_USER = "root"
    DEF_PASSWD = ""
    DEF_PING_TIMEOUT = 5
    DEF_SHUTDOWN_TIME = 30
    DEF_RADIO_ONLINE_TIMEOUT = 300
    FW_VERSION_FILE = "/etc/version"
    FW_VERSION_UNKNOWN = "*UNKNOWN-FW-VERSION*"
    HW_MODEL_UNKNOWN = "*UNKNOWN-HW-TYPE*"
    DEF_BOOT_TIMEOUT = 120
    DEF_SHUTDOWN_TIME = 30

    def __init__(self, mgmt_addr, username=DEF_USER, keyfile=None,
                 log_level=DEF_LOG_LEVEL):
        self.addr = mgmt_addr
        self.lgr = Utilities.mk_logger(self.__class__.__name__, log_level)
        self._hardware = self.HW_MODEL_UNKNOWN
        self._fwversion = self.FW_VERSION_UNKNOWN
        self._username = username
        self._keyfile = keyfile
        self._ssh = SSHWrapper(mgmt_addr, default_user=username,
                               default_keyfile=keyfile, log_level = log_level)

    def connect_session(self, password = DEF_PASSWD,
                        ping_timeout = DEF_PING_TIMEOUT):
        Utilities.wait_for_ping(self.addr, ping_timeout)
        self._ssh.connect(password = password)
        try:
            contents = self._ssh.read_remote_file(self.FW_VERSION_FILE)
        except FileNotFoundError as e:
            self._ssh.close()
            self.lgr.warning("Remote host has no version file?")
            raise
        self._fwversion = contents[0].strip()

    def get_session(self):
        if not self.is_connected():
            self.connect_session()
        return self._ssh

    def close_session(self):
        self._ssh.close()

    def is_connected(self):
        return self._ssh.is_connected()

    def get_firmware_string(self):
        return self._fwversion

    def get_hardware_string(self):
        return self._hardware

    def reboot(self, pingwait=True):
        self.get_session().exec("reboot")
        if pingwait:
            Utilities.wait_for_ping(self.addr, self.DEF_SHUTDOWN_TIME,
                                    invert=True)
        self.close_session()
        self.lgr.info("Device rebooted.")

    def wait_for_radio_online(self, timeout = DEF_BOOT_TIMEOUT):
        stime = time.time()
        Utilities.wait_for_ping(self.addr, timeout)
        self.lgr.info("Device pings.")

    @abstractmethod
    def fetch_settings(self):
        raise RuntimeError("Child class did not define 'fetch_settings()'?!")

    @abstractmethod
    def push_settings(self):
        raise RuntimeError("Child class did not define 'push_settings()'?!")
