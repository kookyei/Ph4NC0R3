#!/usr/bin/env python3
import os
import sys
import subprocess
import platform
import webbrowser
import argparse
import logging
import json
import threading
import time
import re
from datetime import datetime
from typing import List, Dict, Optional, Any

# ------------------------------------------------------------
# Self Update Check & Robust Injector
# ------------------------------------------------------------
def robust_dependency_check():
    import sys
    import subprocess
    import platform
    
    deps_import_map = {
        "flask": "flask",
        "flask-cors": "flask_cors",
        "flask-socketio": "flask_socketio",
        "werkzeug": "werkzeug"
    }
    missing = []
    
    for pip_name, import_name in deps_import_map.items():
        try:
            __import__(import_name)
        except ImportError:
            missing.append(pip_name)
            
    if missing:
        print(f"[*] Missing packages: {', '.join(missing)}. Attempting strict installation...", file=sys.stderr)
        subprocess.call([sys.executable, "-m", "ensurepip", "--default-pip"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        
        install_commands = [
            [sys.executable, "-m", "pip", "install", "--quiet"] + missing,
            [sys.executable, "-m", "pip", "install", "--quiet", "--user"] + missing,
            [sys.executable, "-m", "pip", "install", "--quiet", "--break-system-packages"] + missing,
            [sys.executable, "-m", "pip", "install", "--quiet", "--user", "--break-system-packages"] + missing
        ]
        
        success = False
        for cmd in install_commands:
            if subprocess.call(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL) == 0:
                success = True
                break
                
        if not success and platform.system() == "Linux":
            try:
                subprocess.call(["sudo", "-n", "apt-get", "update", "-y"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                apt_pkgs = []
                for pkg in missing:
                    apt_pkg = "python3-flask-cors" if pkg == "flask-cors" else "python3-flask-socketio" if pkg == "flask-socketio" else f"python3-{pkg}"
                    apt_pkgs.append(apt_pkg)
                if subprocess.call(["sudo", "-n", "apt-get", "install", "-y"] + apt_pkgs, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL) == 0:
                    success = True
            except Exception:
                pass
                
        still_missing = []
        for pip_name, import_name in deps_import_map.items():
            try:
                __import__(import_name)
            except ImportError:
                still_missing.append(pip_name)
                
        if still_missing:
            print(f"[-] FATAL: Failed to resolve dependencies: {', '.join(still_missing)}", file=sys.stderr)
            print("[!] The program cannot continue. Please install them manually using:", file=sys.stderr)
            print(f"    pip install {' '.join(still_missing)}", file=sys.stderr)
            sys.exit(1)
        else:
            print("[+] Dependencies successfully resolved and installed.", file=sys.stderr)

robust_dependency_check()

from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
from flask_socketio import SocketIO, emit

def check_dependencies_on_startup():
    print("[*] P4NTH0MC0R3 Initialization Sequence Initiated...")
    print("[*] Verifying OS-level network interfaces and tools...")
    os_type = platform.system()
    missing_tools = []
    if os_type == "Linux":
        tools = ["nmcli", "iwconfig", "iwlist", "ip"]
        for t in tools:
            if subprocess.call(["which", t], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL) != 0:
                missing_tools.append(t)
    elif os_type == "Windows":
        tools = ["netsh"]
        for t in tools:
            if subprocess.call(["where", t], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL) != 0:
                missing_tools.append(t)
    elif os_type == "Darwin":
        tools = ["networksetup", "airport"]
        for t in tools:
            if t == "airport":
                if subprocess.call("ls /System/Library/PrivateFrameworks/Apple80211.framework/Versions/Current/Resources/airport", shell=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL) != 0:
                    missing_tools.append(t)
            elif subprocess.call(["which", t], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL) != 0:
                missing_tools.append(t)
    
    if missing_tools:
        print(f"[!] WARNING: The following system network tools were not found: {', '.join(missing_tools)}")
        print("[!] Some advanced Wi-Fi capabilities (scanning, connecting) may be restricted or fallback to simulated data.")
    else:
        print("[+] OS network toolchain is fully operational.")
    print("[+] Initialization sequence complete. Launching core engine...")

def find_project_dir():
    # 1. Check directory of this script
    script_dir = os.path.dirname(os.path.abspath(__file__))
    if os.path.exists(os.path.join(script_dir, 'package.json')):
        return script_dir
    # 2. Check current working directory
    if os.path.exists(os.path.join(os.getcwd(), 'package.json')):
        return os.getcwd()
    return None

def check_node_npm():
    print("[*] Detecting Node.js and npm installation...")
    try:
        node_ver = subprocess.check_output("node -v", shell=True, text=True, stderr=subprocess.PIPE).strip()
        print(f"[+] Node.js detected: {node_ver}")
    except Exception:
        print("[-] Error: Node.js is not installed or not found in system PATH.")
        print("[!] Please download and install Node.js (v24 recommended) from https://nodejs.org or via nvm.")
        print("[!] Frontend management cannot continue.")
        sys.exit(1)
        
    try:
        npm_ver = subprocess.check_output("npm -v", shell=True, text=True, stderr=subprocess.PIPE).strip()
        print(f"[+] npm detected: {npm_ver}")
    except Exception:
        print("[-] Error: npm is not installed or not found in system PATH.")
        print("[!] Frontend management cannot continue.")
        sys.exit(1)

def is_dependencies_missing_or_out_of_date(project_dir):
    node_modules_path = os.path.join(project_dir, 'node_modules')
    if not os.path.exists(node_modules_path):
        return True
        
    package_json_path = os.path.join(project_dir, 'package.json')
    package_lock_path = os.path.join(project_dir, 'package-lock.json')
    
    try:
        pkg_mtime = os.path.getmtime(package_json_path)
        modules_mtime = os.path.getmtime(node_modules_path)
        lock_mtime = os.path.getmtime(package_lock_path) if os.path.exists(package_lock_path) else 0
        
        if pkg_mtime > modules_mtime or lock_mtime > modules_mtime:
            return True
    except Exception:
        return True
        
    return False

def is_dist_missing_or_stale(project_dir):
    dist_dir = os.path.join(project_dir, 'dist')
    if not os.path.exists(dist_dir):
        return True
        
    src_dir = os.path.join(project_dir, 'src')
    if not os.path.exists(src_dir):
        return False
        
    max_src_mtime = 0
    for root, _, files in os.walk(src_dir):
        for f in files:
            fp = os.path.join(root, f)
            try:
                mtime = os.path.getmtime(fp)
                if mtime > max_src_mtime:
                    max_src_mtime = mtime
            except Exception:
                pass
                
    package_json_path = os.path.join(project_dir, 'package.json')
    try:
        pkg_mtime = os.path.getmtime(package_json_path)
        if pkg_mtime > max_src_mtime:
            max_src_mtime = pkg_mtime
    except Exception:
        pass
        
    dist_index = os.path.join(dist_dir, 'index.html')
    if not os.path.exists(dist_index):
        return True
        
    try:
        dist_mtime = os.path.getmtime(dist_index)
        return max_src_mtime > dist_mtime
    except Exception:
        return True

def run_npm_command_with_autofix(cmd, project_dir, max_retries=1):
    import shutil
    print(f"[*] Running command: {cmd}")
    
    current_cmd = cmd
    for attempt in range(1, max_retries + 2):
        try:
            result = subprocess.run(
                current_cmd,
                shell=True,
                cwd=project_dir,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                timeout=300
            )
            
            if result.returncode == 0:
                print(f"[+] Command succeeded: {current_cmd}")
                return True
                
            print(f"[-] Command failed with exit code {result.returncode}: {current_cmd}")
            print("--- STDOUT ---")
            print(result.stdout or "(empty)")
            print("--- STDERR ---")
            print(result.stderr or "(empty)")
            print("--------------")
            
            if attempt > max_retries:
                break
                
            stdout_err = ((result.stdout or "") + "\\n" + (result.stderr or "")).lower()
            print(f"[*] Diagnosing issue (Attempt {attempt} of {max_retries + 1})...")
            
            if "integrity" in stdout_err or "shasum" in stdout_err or "checksum" in stdout_err:
                print("[!] Diagnostic: Cache integrity / checksum error detected.")
                print("[*] Action: Cleaning npm cache and retrying...")
                subprocess.run("npm cache clean --force", shell=True, cwd=project_dir)
                
            elif "peer" in stdout_err or "conflicting peer dependency" in stdout_err:
                print("[!] Diagnostic: Conflicting peer dependencies detected.")
                print("[*] Action: Retrying with --legacy-peer-deps...")
                if "install" in current_cmd and "--legacy-peer-deps" not in current_cmd:
                    current_cmd += " --legacy-peer-deps"
                    
            elif "node_modules" in stdout_err or "lockfile" in stdout_err or "enoent" in stdout_err:
                print("[!] Diagnostic: Broken node_modules or stale lockfile detected.")
                print("[*] Action: Deleting node_modules and package-lock.json to perform fresh install...")
                node_modules_dir = os.path.join(project_dir, 'node_modules')
                if os.path.exists(node_modules_dir):
                    try:
                        shutil.rmtree(node_modules_dir)
                    except Exception as e:
                        print(f"[!] Warning: Could not remove node_modules: {e}")
                lock_file = os.path.join(project_dir, 'package-lock.json')
                if os.path.exists(lock_file):
                    try:
                        os.remove(lock_file)
                    except Exception as e:
                        print(f"[!] Warning: Could not remove package-lock.json: {e}")
                current_cmd = "npm install"
                
            else:
                print("[!] Diagnostic: Unknown npm compilation or installation issue.")
                print("[*] Action: Deleting node_modules, clearing npm cache, and trying a fresh install...")
                node_modules_dir = os.path.join(project_dir, 'node_modules')
                if os.path.exists(node_modules_dir):
                    try:
                        shutil.rmtree(node_modules_dir)
                    except Exception as e:
                        print(f"[!] Warning: Could not remove node_modules: {e}")
                subprocess.run("npm cache clean --force", shell=True, cwd=project_dir)
                current_cmd = "npm install"
                
            print(f"[*] Retrying with command: {current_cmd}...")
            
        except subprocess.TimeoutExpired:
            print(f"[-] Command timed out: {current_cmd}")
            if attempt > max_retries:
                break
            print("[*] Action: Retrying command...")
            
        except Exception as e:
            print(f"[-] Unexpected execution error: {e}")
            if attempt > max_retries:
                break
                
    print(f"[-] FATAL: Failed to execute npm command successfully: {cmd}")
    print("[!] Please resolve the npm issue manually and restart the agent.")
    sys.exit(1)

def manage_frontend_on_startup(debug_mode=False):
    project_dir = find_project_dir()
    if not project_dir:
        print("[-] Error: 'package.json' was not found in the project root.")
        print("[!] Skipping automated frontend management (fallback/inlined mode will be active).")
        return

    # 1. Detect Node.js and npm
    check_node_npm()

    # 2. Check and run npm install if dependencies are missing or out of date
    if is_dependencies_missing_or_out_of_date(project_dir):
        print("[*] Dependencies are missing or out of date. Running 'npm install'...")
        run_npm_command_with_autofix("npm install", project_dir)
    else:
        print("[+] All frontend dependencies are up-to-date.")

    # 3. Handle Development Mode vs Production Mode Build
    if debug_mode:
        print("[*] Running in Development Mode. Spawning dev server...")
        try:
            dev_process = subprocess.Popen(
                "npm run dev",
                shell=True,
                cwd=project_dir,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL
            )
            state.dev_process = dev_process
            
            # Wait until dev server is ready (responds on port 3000)
            import socket
            dev_ready = False
            start_time = time.time()
            timeout = 45
            print("[*] Waiting for frontend dev server to be ready on port 3000...")
            while time.time() - start_time < timeout:
                try:
                    with socket.create_connection(("127.0.0.1", 3000), timeout=1):
                        print("[+] Frontend development server is ready and responding on port 3000!")
                        dev_ready = True
                        break
                except (socket.timeout, ConnectionRefusedError):
                    time.sleep(1)
            
            if not dev_ready:
                print("[!] Warning: Frontend dev server did not respond on port 3000 within 45 seconds.")
        except Exception as e:
            print(f"[-] Failed to spawn frontend dev server: {e}")
    else:
        # Check and run build if missing or stale
        if is_dist_missing_or_stale(project_dir):
            print("[*] Compiled frontend (dist) is missing or stale. Running 'npm run build'...")
            run_npm_command_with_autofix("npm run build", project_dir)
        else:
            print("[+] Compiled frontend (dist) is up-to-date. Ready to serve.")

# ------------------------------------------------------------
# Configuration
# ------------------------------------------------------------
DEFAULT_SCAN_INTERVAL = 30  # seconds
DEFAULT_PORT = 5000
DEFAULT_HOST = "0.0.0.0"

logging.basicConfig(
    level=logging.CRITICAL,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.NullHandler()]
)
logger = logging.getLogger("P4nth0mAgent")

os.environ['WERKZEUG_RUN_MAIN'] = 'true'
log = logging.getLogger('werkzeug')
log.setLevel(logging.ERROR)
log.disabled = True

# ------------------------------------------------------------
# Global State
# ------------------------------------------------------------
class AgentState:
    def __init__(self):
        self.adapters: List[Dict] = []
        self.networks: List[Dict] = []
        self.last_scan: Optional[datetime] = None
        self.scanning_enabled: bool = False
        self.scan_interval: int = DEFAULT_SCAN_INTERVAL
        self.scan_thread: Optional[threading.Thread] = None
        self.selected_adapter: Optional[str] = None
        self.started_at: datetime = datetime.now()
        self.action_in_progress: bool = False
        self.dev_process: Optional[Any] = None
        self._lock = threading.Lock()

state = AgentState()

OUI_VENDORS = {
    "00:1A:2B": "Cisco",
    "00:11:22": "Apple",
    "00:50:F2": "Microsoft",
    "AA:BB:CC": "Simulated",
    "00:0C:29": "VMware",
    "00:50:56": "VMware",
}

def get_vendor(mac: str) -> str:
    if not mac or mac == "Unknown":
        return "Unknown"
    mac_upper = mac.upper()
    for oui, vendor in OUI_VENDORS.items():
        if mac_upper.startswith(oui.upper()):
            return vendor
    return "Unknown"

# ------------------------------------------------------------
# Adapter enumeration
# ------------------------------------------------------------
def get_system_adapters() -> List[Dict[str, str]]:
    os_type = platform.system()
    adapters = []
    try:
        if os_type == "Windows":
            output = subprocess.check_output(
                "netsh wlan show interfaces", shell=True, text=True, errors="ignore"
            )
            lines = output.splitlines()
            current = {}
            for line in lines:
                line = line.strip()
                if line.startswith("Name"):
                    current["name"] = line.split(":")[1].strip()
                elif line.startswith("Description"):
                    current["description"] = line.split(":")[1].strip()
                elif line.startswith("GUID"):
                    current["id"] = line.split(":")[1].strip()
                elif line.startswith("Physical address"):
                    current["mac"] = line.split(":")[1].strip().replace("-", ":")
                elif line.startswith("State"):
                    current["state"] = line.split(":")[1].strip()
                    if current and "id" in current:
                        adapters.append(current)
                        current = {}
        elif os_type == "Linux":
            try:
                output = subprocess.check_output(
                    "nmcli -t -f DEVICE,TYPE dev", shell=True, text=True, errors="ignore"
                )
                for line in output.splitlines():
                    if not line:
                        continue
                    parts = line.split(":")
                    if len(parts) >= 2 and parts[1] == "wifi":
                        dev = parts[0]
                        try:
                            mac_out = subprocess.check_output(
                                f"cat /sys/class/net/{dev}/address", shell=True, text=True, errors="ignore"
                            ).strip()
                        except:
                            mac_out = "Unknown"
                        adapters.append({
                            "id": dev,
                            "name": dev,
                            "mac": mac_out,
                            "state": "unknown"
                        })
            except:
                output = subprocess.check_output(
                    "iwconfig 2>/dev/null | grep -E '^[a-zA-Z0-9]+'", shell=True, text=True, errors="ignore"
                )
                for line in output.splitlines():
                    dev = line.split()[0]
                    adapters.append({"id": dev, "name": dev, "mac": "Unknown", "state": "unknown"})
        elif os_type == "Darwin":
            output = subprocess.check_output(
                "networksetup -listallhardwareports", shell=True, text=True, errors="ignore"
            )
            lines = output.splitlines()
            for i, line in enumerate(lines):
                if "Wi-Fi" in line or "AirPort" in line:
                    if i+1 < len(lines) and lines[i+1].startswith("Device:"):
                        dev = lines[i+1].split(":")[1].strip()
                        try:
                            mac_out = subprocess.check_output(
                                f"ifconfig {dev} | grep ether", shell=True, text=True, errors="ignore"
                            ).split()[1]
                        except:
                            mac_out = "Unknown"
                        adapters.append({
                            "id": dev,
                            "name": "Wi-Fi Interface",
                            "mac": mac_out,
                            "state": "unknown"
                        })
    except Exception as e:
        logger.error(f"Error enumerating adapters: {e}")
    
    # Always provide at least one simulated adapter as a fallback
    adapters.append({
        "id": "sim0",
        "name": "P4NTH0M Simulated SDR (Fallback)",
        "mac": "AA:BB:CC:DD:EE:FF",
        "state": "active"
    })
    return adapters

# ------------------------------------------------------------
# Scanning Engine (With simulated fallback)
# ------------------------------------------------------------
def scan_networks(adapter_id: Optional[str] = None, force: bool = False) -> List[Dict]:
    if not adapter_id:
        adapter_id = state.selected_adapter or "sim0"
        
    # If using simulated adapter, or scanning fails, return rich telemetry
    if adapter_id == "sim0":
        time.sleep(1.5)  # Simulate scanning latency
        import random
        # Seeded deterministic-ish simulated networks
        simulated = [
            {
                "ssid": "P4NTH0MC0R3_SECURE",
                "bssid": "00:11:22:33:44:55",
                "signal": 92 + random.randint(-2, 2),
                "channel": 6,
                "frequency": 2437,
                "security": "WPA3-Enterprise",
                "vendor": "Apple",
                "clients": 12,
                "is_vulnerable": False,
                "vulnerability_type": None
            },
            {
                "ssid": "NETGEAR_FREE_WIFI",
                "bssid": "A4:B3:C2:D1:E0:F9",
                "signal": 64 + random.randint(-5, 5),
                "channel": 1,
                "frequency": 2412,
                "security": "WEP (VULNERABLE)",
                "vendor": "Netgear",
                "clients": 3,
                "is_vulnerable": True,
                "vulnerability_type": "WEP Key Cracking vulnerability detected. Weak initialization vectors (IVs) allow rapid decryption."
            },
            {
                "ssid": "xfinitywifi",
                "bssid": "00:1A:2B:3C:4D:5E",
                "signal": 48 + random.randint(-3, 6),
                "channel": 11,
                "frequency": 2462,
                "security": "None (Open)",
                "vendor": "Cisco",
                "clients": 24,
                "is_vulnerable": True,
                "vulnerability_type": "Open network. Traffic is completely unencrypted and susceptible to active sniffing and sidejacking."
            },
            {
                "ssid": "Office_Corp",
                "bssid": "00:50:F2:88:99:AA",
                "signal": 78 + random.randint(-2, 2),
                "channel": 36,
                "frequency": 5180,
                "security": "WPA2-PSK (WPS Active)",
                "vendor": "Microsoft",
                "clients": 8,
                "is_vulnerable": True,
                "vulnerability_type": "WPS Pin brute-forcing (Pixie-Dust attack) active. Pin can be computed offline in seconds."
            },
            {
                "ssid": "HP-Print-45-LaserJet",
                "bssid": "FC:3F:DB:11:22:33",
                "signal": 35 + random.randint(-4, 4),
                "channel": 6,
                "frequency": 2437,
                "security": "WPA2-PSK",
                "vendor": "Hewlett-Packard",
                "clients": 1,
                "is_vulnerable": True,
                "vulnerability_type": "Wi-Fi Direct printer exploit possible. Allows bypassing corporate firewalls via bridged clients."
            }
        ]
        simulated.sort(key=lambda x: x['signal'], reverse=True)
        with state._lock:
            state.networks = simulated
            state.last_scan = datetime.now()
        return simulated

    # Real scanning
    networks = []
    os_type = platform.system()
    try:
        if os_type == "Linux":
            output = subprocess.check_output(
                f"sudo iwlist {adapter_id} scan", shell=True, text=True, errors="ignore"
            )
            cells = output.split("Cell ")
            for cell in cells:
                if not cell.strip():
                    continue
                net = {}
                # Address/BSSID
                bssid_match = re.search(r"Address:\s*([0-9A-Fa-f:]{17})", cell)
                if bssid_match:
                    net["bssid"] = bssid_match.group(1)
                else:
                    continue
                # ESSID
                essid_match = re.search(r'ESSID:"([^"]*)"', cell)
                net["ssid"] = essid_match.group(1) if essid_match else "Hidden Network"
                # Signal strength
                qual_match = re.search(r"Quality=([0-9]+)/([0-9]+)", cell)
                if qual_match:
                    q_val = int(qual_match.group(1))
                    q_max = int(qual_match.group(2))
                    net["signal"] = int((q_val / q_max) * 100)
                else:
                    level_match = re.search(r"Signal level=(-?[0-9]+)", cell)
                    if level_match:
                        dbm = int(level_match.group(1))
                        # convert dbm to percentage approx
                        net["signal"] = min(max(2 * (dbm + 100), 0), 100)
                    else:
                        net["signal"] = 50
                # Channel / Freq
                chan_match = re.search(r"Channel:([0-9]+)", cell)
                if chan_match:
                    net["channel"] = int(chan_match.group(1))
                else:
                    net["channel"] = 1
                freq_match = re.search(r"Frequency:([0-9.]+)\s*GHz", cell)
                if freq_match:
                    net["frequency"] = int(float(freq_match.group(1)) * 1000)
                else:
                    net["frequency"] = 2412
                # Security
                if "WPA3" in cell:
                    net["security"] = "WPA3"
                elif "WPA2" in cell:
                    net["security"] = "WPA2"
                elif "WEP" in cell:
                    net["security"] = "WEP"
                elif "Encryption key:off" in cell:
                    net["security"] = "None"
                else:
                    net["security"] = "WPA2"
                
                net["vendor"] = get_vendor(net["bssid"])
                net["clients"] = 0
                net["is_vulnerable"] = "WEP" in net["security"] or "None" in net["security"]
                net["vulnerability_type"] = "WEP Weak encryption" if "WEP" in net["security"] else "Open WiFi" if "None" in net["security"] else None
                networks.append(net)
                
        elif os_type == "Windows":
            output = subprocess.check_output(
                "netsh wlan show networks mode=bssid", shell=True, text=True, errors="ignore"
            )
            # Parse netsh output
            blocks = output.split("SSID ")
            for block in blocks[1:]:
                lines = block.splitlines()
                if not lines:
                    continue
                ssid = lines[0].split(":")[1].strip() if ":" in lines[0] else "Hidden Network"
                net = {"ssid": ssid, "security": "Unknown", "bssid": "Unknown", "signal": 50, "channel": 1, "frequency": 2412, "vendor": "Unknown", "clients": 0, "is_vulnerable": False, "vulnerability_type": None}
                for line in lines:
                    line = line.strip()
                    if line.startswith("Authentication"):
                        net["security"] = line.split(":")[1].strip()
                    elif line.startswith("BSSID"):
                        net["bssid"] = line.split(":")[1].strip()
                        net["vendor"] = get_vendor(net["bssid"])
                    elif line.startswith("Signal"):
                        net["signal"] = int(line.split(":")[1].strip().replace("%", ""))
                    elif line.startswith("Channel"):
                        net["channel"] = int(line.split(":")[1].strip())
                        net["frequency"] = 2400 + (net["channel"] * 5) # approximation
                networks.append(net)
                
        elif os_type == "Darwin":
            # macOS via airport cli
            cmd = "/System/Library/PrivateFrameworks/Apple80211.framework/Versions/Current/Resources/airport -s"
            output = subprocess.check_output(cmd, shell=True, text=True, errors="ignore")
            lines = output.splitlines()
            if lines:
                header = lines[0]
                for line in lines[1:]:
                    parts = line.split()
                    if len(parts) >= 6:
                        # Find MAC (BSSID)
                        mac_idx = -1
                        for i, part in enumerate(parts):
                            if re.match(r"^([0-9a-fA-F]{2}:){5}[0-9a-fA-F]{2}$", part):
                                mac_idx = i
                                break
                        if mac_idx == -1:
                            continue
                        ssid = " ".join(parts[0:mac_idx])
                        bssid = parts[mac_idx]
                        rssi = int(parts[mac_idx+1])
                        channel = int(parts[mac_idx+2].split(",")[0])
                        security = parts[mac_idx+4] if mac_idx+4 < len(parts) else "Unknown"
                        # RSSI to pct approx
                        signal = min(max(2 * (rssi + 100), 0), 100)
                        networks.append({
                            "ssid": ssid,
                            "bssid": bssid,
                            "signal": signal,
                            "channel": channel,
                            "frequency": 5000 if channel > 14 else 2412,
                            "security": security,
                            "vendor": get_vendor(bssid),
                            "clients": 0,
                            "is_vulnerable": "WEP" in security or "NONE" in security.upper(),
                            "vulnerability_type": "WEP Weak encryption" if "WEP" in security else "Open WiFi" if "NONE" in security.upper() else None
                        })
    except Exception as e:
        logger.error(f"Error performing physical scan: {e}. Falling back to simulated scan.")
        return scan_networks("sim0")

    if not networks:
        return scan_networks("sim0")
        
    networks.sort(key=lambda x: x['signal'], reverse=True)
    with state._lock:
        state.networks = networks
        state.last_scan = datetime.now()
    return networks

# ------------------------------------------------------------
# Detailed Network Info & Client Sniffing
# ------------------------------------------------------------
import threading
import socket

def scan_ports(ip: str) -> List[int]:
    open_ports = []
    common_ports = [21, 22, 23, 80, 443, 445, 3389, 8080, 8443]
    def check_port(p):
        try:
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                s.settimeout(0.3)
                if s.connect_ex((ip, p)) == 0:
                    open_ports.append(p)
        except:
            pass
    threads = []
    for port in common_ports:
        t = threading.Thread(target=check_port, args=(port,))
        t.start()
        threads.append(t)
    for t in threads:
        t.join()
    return sorted(open_ports)

def get_network_details(bssid: str, ssid: str) -> Dict[str, Any]:
    clients = []
    # Seeded simulated clients
    sim_clients_pool = [
        {"ip": "192.168.1.1", "mac": "00:1A:2B:11:11:11", "hostname": "Gateway_Router", "vendor": "Cisco", "os": "Linux Embedded", "active_ports": [80, 443]},
        {"ip": "192.168.1.104", "mac": "00:11:22:AA:BB:CC", "hostname": "Boss-MacBook-Pro", "vendor": "Apple", "os": "macOS Sequoia", "active_ports": [22]},
        {"ip": "192.168.1.121", "mac": "00:50:F2:77:88:99", "hostname": "SECURE-NAS", "vendor": "Microsoft", "os": "Windows Server 2022", "active_ports": [445, 3389]},
        {"ip": "192.168.1.189", "mac": "AA:BB:CC:99:99:99", "hostname": "Simulated_IoT_Cam", "vendor": "Simulated", "os": "FreeRTOS", "active_ports": [23, 80]},
        {"ip": "192.168.1.15", "mac": "00:0C:29:44:55:66", "hostname": "Dev-Ubuntu-VM", "vendor": "VMware", "os": "Ubuntu 22.04 LTS", "active_ports": [22, 80, 8080]}
    ]
    
    import random
    # Select a deterministic slice based on SSID hash
    h = sum(ord(c) for c in ssid) % (len(sim_clients_pool) + 1)
    h = max(h, 2)  # At least 2 clients
    clients = sim_clients_pool[:h]
    
    # Try to scan actual ARP cache if connected
    os_type = platform.system()
    try:
        if os_type == "Linux":
            arp_out = subprocess.check_output("arp -an", shell=True, text=True, errors="ignore")
            for line in arp_out.splitlines():
                m = re.search(r"\(([0-9.]+)\) at ([0-9a-fA-F:]{17})", line)
                if m:
                    ip, mac = m.group(1), m.group(2)
                    if not any(c['mac'].lower() == mac.lower() for c in clients):
                        clients.append({
                            "ip": ip,
                            "mac": mac,
                            "hostname": "Discovered_Client",
                            "vendor": get_vendor(mac),
                            "os": "Unknown OS",
                            "active_ports": []
                        })
    except Exception as e:
        logger.error(f"ARP scan skipped/failed: {e}")
        
    return {
        "bssid": bssid,
        "ssid": ssid,
        "clients_count": len(clients),
        "clients": clients,
        "scanned_at": datetime.now().isoformat(),
        "enc_type": "WPA3" if "WPA3" in ssid else "WEP" if "FREE" in ssid else "WPA2"
    }

# ------------------------------------------------------------
# Background worker thread
# ------------------------------------------------------------
def background_scanner():
    logger.info("Background scanner thread started.")
    while state.scanning_enabled:
        if state.action_in_progress:
            time.sleep(1)
            continue
            
        logger.info("Performing background scan update...")
        try:
            nets = scan_networks(state.selected_adapter, force=True)
            socketio.emit('networks_updated', {'networks': nets})
        except Exception as e:
            logger.error(f"Error in background scan: {e}")
            
        # Sleep in increments so we can exit quickly if stopped
        for _ in range(state.scan_interval):
            if not state.scanning_enabled:
                break
            time.sleep(1)
    logger.info("Background scanner thread stopped.")

def start_background_scan():
    with state._lock:
        if state.scanning_enabled:
            return
        state.scanning_enabled = True
        state.scan_thread = threading.Thread(target=background_scanner, daemon=True)
        state.scan_thread.start()

def stop_background_scan():
    with state._lock:
        state.scanning_enabled = False
        if state.scan_thread:
            state.scan_thread = None

# Error handling decorator
def api_error_handler(f):
    import functools
    @functools.wraps(f)
    def decorated_function(*args, **kwargs):
        try:
            return f(*args, **kwargs)
        except Exception as err:
            logger.error(f"API Error in {f.__name__}: {err}")
            return jsonify({"error": str(err)}), 500
    return decorated_function

# ------------------------------------------------------------
# Web Dashboard Serving
# ------------------------------------------------------------
app = Flask(__name__)
app.config['SECRET_KEY'] = 'p4nth0m-secret-key'
CORS(app)
socketio = SocketIO(app, cors_allowed_origins="*")

@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve_dashboard(path):
    dist_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'dist')
    if not os.path.exists(dist_dir):
        dist_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'dist')
    if os.path.exists(dist_dir):
        if path != "" and os.path.exists(os.path.join(dist_dir, path)):
            return send_from_directory(dist_dir, path)
        else:
            return send_from_directory(dist_dir, 'index.html')
    else:
        return """
        <html><head><title>P4NTH0M Agent</title></head>
        <body style="background:#0a0a0a; color:#00ffcc; font-family:monospace; padding:50px;">
        <h2>P4NTH0MC0R3 AGENT IS ONLINE</h2>
        <p>The API is running, but the compiled web dashboard was not found in the 'dist' directory.</p>
        <p>To view the dashboard, either run the Node.js development server or compile the frontend using 'npm run build'.</p>
        </body></html>
        """

# ------------------------------------------------------------
# API Endpoints
# ------------------------------------------------------------
def get_local_security_analysis(prompt: str, network_data: list) -> str:
    query = prompt.lower()
    
    total_networks = len(network_data)
    vulnerable_networks = [n for n in network_data if n.get('is_vulnerable') or 'wep' in n.get('security', '').lower() or 'none' in n.get('security', '').lower() or 'open' in n.get('security', '').lower()]
    wpa3_networks = [n for n in network_data if 'wpa3' in n.get('security', '').lower()]
    channels_used = sorted(list(set([n.get('channel') for n in network_data if n.get('channel') is not None])))
    clients_found = sum([n.get('clients_count', len(n.get('clients', []))) for n in network_data])
    
    response = "[P4NTH0MC0R3_AI COLD ENGINE DETECTED - LOCAL AGENT STANDALONE INTERACTIVE TERMINAL]\\n\\n"
    
    if 'help' in query or 'menu' in query or 'command' in query:
        response += """### AVAILABLE LOCAL AGENT SUBSYSTEMS & COMMANDS
Available autonomous modules to run on your local machine:

1. **WIFI RECONNAISSANCE** (`scan_networks`): Enumerates 802.11 beacons, extracts ESSIDs, BSSIDs, signal levels, channel frequencies, and encryption suites.
2. **ACTIVE ATTACK SURFACE ANALYSIS**: Identifies insecure open access points and highly vulnerable obsolete WEP protocols.
3. **CLIENT DISCOVERY & PROBING**: Sniffs ARP broadcasts to isolate connected nodes, runs non-intrusive TCP port sweeps to discover active ports (SSH, HTTP, Telnet, SMB).
4. **CREDENTIAL INJECTION & TESTING**: Tests custom authentication strings against target APs.

*Query suggestions:*
- "Analyze security threats"
- "Show network density and congestion"
- "Tell me about connected clients"
- "Explain active ports on the network\""""
    elif 'security' in query or 'threat' in query or 'vuln' in query or 'attack' in query or 'weak' in query:
        status_str = "⚠️ SEVERE ATTACK SURFACE DETECTED" if vulnerable_networks else "✅ HIGH ENCRYPTION PROFILE ACTIVE"
        response += f"### CYBERSECURITY RECON REPORT: THREAT TOPOGRAPHY\\n**Status**: {status_str}\\n\\nTotal Active Transmitters: **{total_networks}**\\nVulnerable/Insecure Beacons: **{len(vulnerable_networks)}**\\n\\n"
        if vulnerable_networks:
            response += "#### VULNERABILITY LOG:\\n"
            for idx, n in enumerate(vulnerable_networks):
                sec = n.get('security', 'Unknown')
                ssid = n.get('ssid', 'Hidden')
                bssid = n.get('bssid', 'Unknown')
                chan = n.get('channel', 'Unknown')
                vuln_type = n.get('vulnerability_type') or "No encryption active. Potential for active MITM (Man-in-the-Middle) sniffing, packet injection, and Session Hijacking."
                response += f"{idx + 1}. **{ssid}** [BSSID: `{bssid}` | Chan: {chan}]\\n   - **Security**: `{sec}`\\n   - **Threat Analysis**: {vuln_type}\\n\\n"
            response += """#### DEPLOYMENT RECOMMENDATIONS:
- Avoid associating with open or WEP nodes.
- Implement WPA3-SAE with PMF (Protected Management Frames) enabled to stop active deauth frame injections.
- Segregate IoT nodes into isolated VLAN pools."""
        else:
            response += "All detected active transmitters are utilizing secure protocol configurations (WPA2-PSK / WPA3). No open or legacy WEP beacons identified in the immediate physical radius. Continue normal operations."
    elif 'channel' in query or 'congest' in query or 'spectrum' in query or 'frequenc' in query or 'densit' in query:
        ch_str = ", ".join(map(str, channels_used)) if channels_used else "None"
        response += f"### RF EM SPECTRUM & CONGESTION TELEMETRY\\n- **Total Beacons in Range**: {total_networks}\\n- **Channels in Use**: {ch_str}\\n\\n#### CHANNEL SPECTRUM ANALYSIS:\\n"
        
        # Group by channel
        chan_map = {}
        for n in network_data:
            ch = n.get('channel', 1)
            if ch not in chan_map:
                chan_map[ch] = []
            chan_map[ch].append(n)
            
        for ch in sorted(chan_map.keys()):
            count = len(chan_map[ch])
            status_str = "⚠️ HIGHLY CONGESTED" if count > 3 else "MODERATE" if count > 1 else "LOW"
            response += f"- **Channel {ch}**: {count} active beacon(s) ({status_str})\\n"
            for n in chan_map[ch]:
                ssid = n.get('ssid', 'Hidden')
                sig = n.get('signal', 50)
                sec = n.get('security', 'WPA2')
                response += f"  - `{ssid}` (Signal: {sig}%) [{sec}]\\n"
                
        response += """\\n#### SPECTRAL RECONNAISSANCE SUMMARY:
- Overlapping channels in the 2.4GHz band (Channels 1, 6, 11) should be utilized to avoid adjacent-channel interference.
- High-frequency 5GHz bands show extremely low beacon saturation. Recommend migrating active payloads to high-frequency channels."""
    elif 'client' in query or 'device' in query or 'host' in query or 'ip' in query or 'mac' in query:
        response += f"### CLIENT DISCOVERY & NODE ENUMERATION\\n- **Connected Active Nodes Swept**: {clients_found} client devices detected across scanned SSIDs.\\n\\n"
        client_nets = [n for n in network_data if n.get('clients_count', 0) > 0 or n.get('clients')]
        if client_nets:
            for n in client_nets:
                ssid = n.get('ssid', 'Hidden')
                bssid = n.get('bssid', 'Unknown')
                response += f"#### ASSOCIATED CLIENTS ON \\\"{ssid}\\\" [`{bssid}`]:\\n"
                clients = n.get('clients', [])
                for c in clients:
                    hname = c.get('hostname', 'Unknown Host')
                    ip = c.get('ip', 'DHCP-Leased')
                    mac = c.get('mac', 'Unknown')
                    vendor = c.get('vendor', 'Unknown')
                    ops = c.get('os', 'Unknown Device')
                    ports = ", ".join([f"`{p}`" for p in c.get('active_ports', [])]) if c.get('active_ports') else "None detected"
                    response += f"- **{hname}** (`{ip}` | Mac: `{mac}`)\\n  - **Vendor**: {vendor}\\n  - **OS System**: `{ops}`\\n  - **Active TCP Ports**: {ports}\\n"
                response += "\\n"
        else:
            response += """No active associated clients detected in current scan range. 
Run a detailed probe scan on a specific target network (e.g. click a network from the left-side dashboard list) to begin sniffing active MAC and ARP broadcasts to enumerate connected smartphones, laptops, IoT gadgets, and network-attached storages."""
    elif 'port' in query or 'socket' in query or 'sweep' in query or 'service' in query:
        response += """### TCP PORT ANALYSIS & ACTIVE EXPLOIT MATRIX
- A port sweep on target hosts scans common TCP ports to locate running network services.

#### RECONNAISSANCE SIGNATURES:
- **Port 21 (FTP)**: Cleartext file transfers. Highly vulnerable to brute forcing and credential eavesdropping.
- **Port 22 (SSH)**: Encrypted shell access. Ensure keys are rotated and password-based root authentication is disabled.
- **Port 23 (Telnet)**: Legacy unencrypted remote shell. Critical security risk. Switch immediately to SSH.
- **Port 80 / 8080 (HTTP)**: Unsecured Web Servers. Analyze header configurations and look for legacy administration panels.
- **Port 443 / 8443 (HTTPS)**: Secure TLS sockets. Inspect certificate chains and TLS protocols (deprecate TLS 1.0/1.1).
- **Port 445 (SMB)**: Windows File Sharing. Ensure patched against EternalBlue (CVE-2017-0143) exploits.

Run active probes via the dashboard network details terminal to fetch the latest socket states for individual clients."""
    else:
        response += f"""### OFFLINE RECON SYSTEM STATUS REPORT
Current physical adapter active scan metrics analyzed:
- **Active Beacons**: {total_networks}
- **WPA3 Encrypted**: {len(wpa3_networks)}
- **WPA2 Encrypted**: {total_networks - len(wpa3_networks) - len(vulnerable_networks)}
- **Vulnerabilities**: {len(vulnerable_networks)}

*Systems are nominal. Awaiting input query. You can ask for assistance regarding:*
- **Security vulnerabilities & threats**
- **Channel congestion & spectrum analysis**
- **Connected clients & OS distribution**
- **Port sweeps & service enumeration**"""
        
    return response

@app.route('/api/ask', methods=['POST'])
@api_error_handler
def ask_endpoint():
    data = request.get_json() or {}
    prompt = data.get('prompt', '').strip()
    network_data = data.get('networkData', [])
    answer = get_local_security_analysis(prompt, network_data)
    return jsonify({"answer": answer})

@app.route('/api/status', methods=['GET'])
@api_error_handler
def status():
    uptime = (datetime.now() - state.started_at).total_seconds()
    return jsonify({
        "status": "running",
        "uptime_seconds": uptime,
        "scanning_enabled": state.scanning_enabled,
        "scan_interval": state.scan_interval,
        "selected_adapter": state.selected_adapter,
        "last_scan": state.last_scan.isoformat() if state.last_scan else None,
        "networks_count": len(state.networks),
        "adapters_count": len(state.adapters)
    })

@app.route('/api/adapters', methods=['GET'])
@api_error_handler
def adapters_endpoint():
    state.adapters = get_system_adapters()
    return jsonify({"adapters": state.adapters})

@app.route('/api/scan', methods=['GET', 'POST'])
@api_error_handler
def scan_endpoint():
    force = False
    adapter = None
    if request.method == 'POST':
        data = request.get_json() or {}
        force = data.get('force', False)
        adapter = data.get('adapterId')
    networks = scan_networks(adapter_id=adapter, force=force)
    return jsonify({"networks": networks})

@app.route('/api/network/details', methods=['GET'])
@api_error_handler
def network_details():
    bssid = request.args.get('bssid', 'Unknown')
    ssid = request.args.get('ssid', 'Unknown')
    pause_background = len(state.adapters) <= 1
    if pause_background:
        state.action_in_progress = True
        logger.info(f"Pausing background scanner for detailed action on {ssid}...")
        time.sleep(1)
    try:
        details = get_network_details(bssid, ssid)
    finally:
        if pause_background:
            state.action_in_progress = False
            logger.info("Resuming background scanner.")
    return jsonify(details)

@app.route('/api/scan/start', methods=['POST'])
@api_error_handler
def scan_start():
    start_background_scan()
    return jsonify({"status": "scanning_started", "interval": state.scan_interval})

@app.route('/api/scan/stop', methods=['POST'])
@api_error_handler
def scan_stop():
    stop_background_scan()
    return jsonify({"status": "scanning_stopped"})

@app.route('/api/scan/interval', methods=['POST'])
@api_error_handler
def set_interval():
    data = request.get_json()
    interval = data.get('interval', DEFAULT_SCAN_INTERVAL)
    if interval < 5:
        return jsonify({"error": "Interval must be at least 5 seconds"}), 400
    state.scan_interval = interval
    return jsonify({"status": "interval_updated", "interval": interval})

@app.route('/api/adapter/select', methods=['POST'])
@api_error_handler
def select_adapter():
    data = request.get_json()
    adapter = data.get('adapterId')
    if not any(a['id'] == adapter for a in state.adapters):
        return jsonify({"error": "Invalid adapter ID"}), 400
    state.selected_adapter = adapter
    return jsonify({"status": "adapter_selected", "adapter": adapter})

@app.route('/api/connect', methods=['POST'])
@api_error_handler
def connect_to_network():
    data = request.get_json()
    ssid = data.get('ssid')
    password = data.get('password', '')
    adapter = data.get('adapter', state.selected_adapter)
    if not ssid:
        return jsonify({"error": "SSID is required"}), 400
    os_type = platform.system()
    success = False
    message = ""
    try:
        if os_type == "Windows":
            message = "Windows connection not implemented in this demo."
        elif os_type == "Linux":
            cmd = f'nmcli dev wifi connect "{ssid}" password "{password}"'
            if adapter and adapter != "sim0":
                cmd += f' ifname {adapter}'
            subprocess.check_call(cmd, shell=True, timeout=30)
            success = True
            message = f"Connected to {ssid}"
        elif os_type == "Darwin":
            cmd = f'networksetup -setairportnetwork {adapter} "{ssid}" "{password}"'
            if not adapter or adapter == "sim0":
                out = subprocess.check_output("networksetup -listallhardwareports", shell=True, text=True)
                for line in out.splitlines():
                    if "Wi-Fi" in line or "AirPort" in line:
                        idx = out.splitlines().index(line)
                        if idx+1 < len(out.splitlines()) and out.splitlines()[idx+1].startswith("Device:"):
                            adapter = out.splitlines()[idx+1].split(":")[1].strip()
                            break
                if not adapter:
                    raise Exception("No Wi-Fi interface found")
            subprocess.check_call(cmd, shell=True, timeout=30)
            success = True
            message = f"Connected to {ssid}"
        else:
            message = "Unsupported OS for connection"
    except Exception as e:
        message = str(e)
        logger.error(f"Connection error: {e}")
    return jsonify({"success": success, "message": message})

# ------------------------------------------------------------
# SocketIO events
# ------------------------------------------------------------
@socketio.on('connect')
def handle_connect():
    logger.info("Web client connected")
    emit('connected', {'status': 'ok'})

@socketio.on('disconnect')
def handle_disconnect():
    logger.info("Web client disconnected")

# ------------------------------------------------------------
# Main entry point
# ------------------------------------------------------------
if __name__ == '__main__':
    parser = argparse.ArgumentParser(description="P4nth0mAgent - Advanced Wi-Fi Telemetry Service")
    parser.add_argument('--host', default=DEFAULT_HOST, help=f"Host to bind (default: {DEFAULT_HOST})")
    parser.add_argument('--port', type=int, default=DEFAULT_PORT, help=f"Port to bind (default: {DEFAULT_PORT})")
    parser.add_argument('--no-browser', action='store_true', help="Do not open browser automatically")
    parser.add_argument('--debug', action='store_true', help="Enable debug mode")
    parser.add_argument('--scan-interval', type=int, default=DEFAULT_SCAN_INTERVAL,
                        help=f"Background scan interval in seconds (default: {DEFAULT_SCAN_INTERVAL})")
    args = parser.parse_args()

    state.scan_interval = args.scan_interval
    state.adapters = get_system_adapters()
    if state.adapters:
        state.selected_adapter = state.adapters[0]['id']

    # Manage frontend lifecycle automatically before launching the server
    manage_frontend_on_startup(args.debug)

    # Register exit handler to terminate background npm run dev if it was started
    import atexit
    def cleanup_dev_server():
        if getattr(state, 'dev_process', None):
            print("[*] Terminating frontend development server background process...")
            try:
                state.dev_process.terminate()
                state.dev_process.wait(timeout=2)
            except Exception:
                pass
    atexit.register(cleanup_dev_server)

    start_background_scan()
    check_dependencies_on_startup()
    
    dashboard_url = f"http://localhost:{args.port}"
    print("\\n==========================================================================")
    print(" P4NTH0M_AGENT DEPLOYED & ACTIVE")
    print("==========================================================================")
    print(f" [*] Local Telemetry Bridge listening on: {args.host}:{args.port}")
    if args.debug:
        print(f" [+] Secure Dashboard Interface (Dev Server): http://localhost:3000")
    else:
        print(f" [+] Secure Dashboard Interface: {dashboard_url}")
    print(" [!] ACTION REQUIRED: Use the link above to access the dashboard.")
    print("==========================================================================\\n")

    # Launch browser automatically unless requested otherwise
    if not args.no_browser:
        target_url = "http://localhost:3000" if args.debug else dashboard_url
        def open_browser():
            time.sleep(1.5)
            print(f"[*] Opening dashboard in default web browser: {target_url}")
            webbrowser.open(target_url)
        threading.Thread(target=open_browser, daemon=True).start()

    import sys
    cli = sys.modules['flask.cli']
    cli.show_server_banner = lambda *x: None

    socketio.run(app, host=args.host, port=args.port, debug=args.debug, log_output=False)
