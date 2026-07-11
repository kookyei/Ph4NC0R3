#!/usr/bin/env python3
"""
P4nth0mAgent - Advanced Wi-Fi Telemetry & Control Service
==========================================================
Provides a local REST + WebSocket API for the P4NTH0MC0R3 dashboard.
Features:
  - Adapter enumeration (Windows, Linux, macOS)
  - Network scanning with caching and background updates
  - Real-time push via SocketIO
  - Optional network connection (OS specific)
  - Simulated fallback data for development/filming
"""

import subprocess
import platform
import sys
import webbrowser
import argparse
import logging
import json
import threading
import time
import re
from datetime import datetime
from typing import List, Dict, Optional, Any

# Try to import Flask & extensions
# ------------------------------------------------------------
# Self Update Check & Robust Injector
# ------------------------------------------------------------
def check_for_self_updates():
    import urllib.request
    import hashlib
    import os
    import sys
    print("[*] Checking for updates from GitHub...")
    url = "https://raw.githubusercontent.com/kookyei/Ph4NC0R3/main/p4nth0m_agent.py"
    try:
        req = urllib.request.Request(url, headers={'Cache-Control': 'no-cache'})
        with urllib.request.urlopen(req, timeout=5) as response:
            latest_code_bytes = response.read()
            
        latest_code = latest_code_bytes.decode('utf-8', errors='ignore')
        
        # Landmark to split on
        landmark = "# Configuration"
        if landmark not in latest_code:
            landmark = "DEFAULT_SCAN_INTERVAL"
            
        if landmark in latest_code:
            # We split the remote code from the landmark onwards
            parts = latest_code.split(landmark, 1)
            remote_app_logic = landmark + parts[1]
            
            # Read our current file to get the setup block (everything before landmark)
            current_file = os.path.abspath(__file__)
            with open(current_file, "r", encoding="utf-8", errors="ignore") as f:
                current_full_code = f.read()
                
            current_setup_block = current_full_code.split(landmark, 1)[0]
            
            # Reconstruct the advanced code
            advanced_code = current_setup_block + remote_app_logic
            
            # If the current local file is different from the reconstructed advanced code, update it!
            if hashlib.sha256(advanced_code.encode('utf-8')).hexdigest() != hashlib.sha256(current_full_code.encode('utf-8')).hexdigest():
                print("[!] Update found! Downloading and applying with robust enhancements...")
                with open(current_file, "w", encoding="utf-8") as f:
                    f.write(advanced_code)
                print("[+] Update applied successfully. Restarting agent...")
                os.execv(sys.executable, [sys.executable] + sys.argv)
            else:
                print("[+] Agent is up to date.")
        else:
            print("[-] Remote update format not recognized. Skipping update.")
    except Exception as e:
        print(f"[-] Failed to check for updates: {e}")


# ------------------------------------------------------------
# WSGI/Mature Server Entry Point
# ------------------------------------------------------------
# Expose the Flask app object as 'application' or 'app' for WSGI servers
# e.g., gunicorn -k eventlet -w 1 p4nth0m_agent:app

if __name__ == '__main__':

    check_for_self_updates()


def robust_dependency_check():
    import sys
    import subprocess
    import platform
    
    deps_import_map = {
        "flask": "flask",
        "eventlet": "eventlet",
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
        # Ensure pip is available
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
            # APT Fallback
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
                
        # Final Verification
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
            print("    (or use --break-system-packages / virtual environment / apt-get)", file=sys.stderr)
            sys.exit(1)
        else:
            print("[+] Dependencies successfully resolved and installed.", file=sys.stderr)

robust_dependency_check()


try:
    import eventlet
    eventlet.monkey_patch()
    print('[+] Eventlet monkey patched for async web server')
except ImportError:
    pass

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

# ------------------------------------------------------------
# Configuration
# ------------------------------------------------------------
DEFAULT_SCAN_INTERVAL = 30  # seconds
DEFAULT_PORT = 5000
DEFAULT_HOST = "0.0.0.0"

# ------------------------------------------------------------
# Logging setup
# ------------------------------------------------------------
logging.basicConfig(
    level=logging.CRITICAL,  # Only show critical errors to keep terminal clean
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.NullHandler()] # Discard all logs to prevent terminal output
)
logger = logging.getLogger("P4nth0mAgent")

# Also silence Flask/Werkzeug logs
import os
os.environ['WERKZEUG_RUN_MAIN'] = 'true' # Prevent duplicate startup messages
log = logging.getLogger('werkzeug')
log.setLevel(logging.ERROR)
log.disabled = True

# ------------------------------------------------------------
# Global State
# ------------------------------------------------------------
class AgentState:
    """Holds the current state of the agent."""
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
        self._lock = threading.Lock()

state = AgentState()

# ------------------------------------------------------------
# Vendor OUI lookup (simplified)
# ------------------------------------------------------------
# A small local cache for common OUIs; could be extended from a file.
OUI_VENDORS = {
    "00:1A:2B": "Cisco",
    "00:11:22": "Apple",
    "00:50:F2": "Microsoft",
    "AA:BB:CC": "Simulated",
    "00:0C:29": "VMware",
    "00:50:56": "VMware",
}

def get_vendor(mac: str) -> str:
    """Return vendor name for a given MAC address."""
    if not mac or mac == "Unknown":
        return "Unknown"
    # Normalize MAC to uppercase and take first 8 chars (6 hex + colons)
    mac_upper = mac.upper()
    # Try full match first, then shortened
    for oui, vendor in OUI_VENDORS.items():
        if mac_upper.startswith(oui.upper()):
            return vendor
    return "Unknown"

# ------------------------------------------------------------
# Adapter enumeration
# ------------------------------------------------------------
def get_system_adapters() -> List[Dict[str, str]]:
    """
    Enumerate all Wi-Fi adapters on the system.
    Returns a list of dicts with 'id', 'name', and optional 'mac'.
    """
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
            # fallback if no full info
            if not adapters:
                # try to get from netsh wlan show drivers
                pass

        elif os_type == "Linux":
            # Use nmcli if available, else fallback to iwconfig
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
                        # get MAC
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
                # fallback to iwconfig
                output = subprocess.check_output(
                    "iwconfig 2>/dev/null | grep -E '^[a-zA-Z0-9]+'", shell=True, text=True, errors="ignore"
                )
                for line in output.splitlines():
                    dev = line.split()[0]
                    adapters.append({"id": dev, "name": dev, "mac": "Unknown", "state": "unknown"})

        elif os_type == "Darwin":  # macOS
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
                            "name": f"Wi-Fi ({dev})",
                            "mac": mac_out,
                            "state": "unknown"
                        })
    except Exception as e:
        logger.error(f"Error enumerating adapters: {e}")

    if not adapters:
        # Fallback simulated adapter
        adapters = [{
            "id": "sim0",
            "name": "Simulated Adapter",
            "mac": "AA:BB:CC:11:22:33",
            "state": "simulated"
        }]
    return adapters

# ------------------------------------------------------------
# Network scanning (cached)
# ------------------------------------------------------------
def scan_networks(adapter_id: Optional[str] = None, force: bool = False) -> List[Dict]:
    """
    Perform a Wi-Fi scan and return list of networks.
    If force=False and cache is fresh, return cached data.
    """
    with state._lock:
        # Return cache if not forced and we have recent data
        if not force and state.networks and state.last_scan:
            age = (datetime.now() - state.last_scan).total_seconds()
            if age < 60:  # cache for 60 seconds if not forced
                logger.debug("Returning cached scan results")
                return state.networks

    logger.info("Performing Wi-Fi scan...")
    networks = []
    os_type = platform.system()
    adapter = adapter_id or state.selected_adapter

    try:
        if os_type == "Windows":
            cmd = "netsh wlan show networks mode=bssid"
            if adapter and adapter != "sim0" and adapter != "default":
                cmd = f'netsh wlan show networks interface="{adapter}" mode=bssid'
            output = subprocess.check_output(cmd, shell=True, text=True, errors="ignore")
            lines = output.splitlines()
            current_ssid = "Unknown"
            current_bssid = "Unknown"
            current_signal = "N/A"
            current_security = "Unknown"
            current_channel = "N/A"
            for line in lines:
                line = line.strip()
                if line.startswith("SSID") and not line.startswith("SSIDs"):
                    parts = line.split(":")
                    if len(parts) > 1:
                        current_ssid = parts[1].strip()
                elif line.startswith("BSSID"):
                    parts = line.split(":")
                    if len(parts) >= 2:
                        current_bssid = ":".join(parts[1:]).strip()
                elif line.startswith("Signal"):
                    current_signal = line.split(":")[1].strip()
                elif line.startswith("Authentication"):
                    current_security = line.split(":")[1].strip()
                elif line.startswith("Channel"):
                    current_channel = line.split(":")[1].strip()
                    # When we get channel, we have a complete network entry
                    if current_ssid and current_bssid:
                        networks.append({
                            "ssid": current_ssid,
                            "bssid": current_bssid,
                            "signal": current_signal,
                            "security": current_security,
                            "channel": current_channel,
                            "vendor": get_vendor(current_bssid)
                        })
                        # Reset for next
                        current_bssid = "Unknown"
                        current_signal = "N/A"
                        current_security = "Unknown"
                        current_channel = "N/A"

        elif os_type == "Linux":
            # Use nmcli for detailed info
            cmd = "nmcli -t -f SSID,BSSID,SIGNAL,SECURITY,CHAN,FREQ dev wifi"
            if adapter and adapter != "sim0":
                cmd = f'nmcli -t -f SSID,BSSID,SIGNAL,SECURITY,CHAN,FREQ dev wifi list ifname {adapter}'
            output = subprocess.check_output(cmd, shell=True, text=True, errors="ignore")
            for line in output.splitlines():
                if not line:
                    continue
                parts = line.split(":")
                if len(parts) >= 6:
                    ssid = parts[0]
                    bssid = parts[1]
                    signal = parts[2] + "%"
                    security = parts[3]
                    channel = parts[4]
                    freq = parts[5]
                    networks.append({
                        "ssid": ssid,
                        "bssid": bssid,
                        "signal": signal,
                        "security": security,
                        "channel": channel,
                        "frequency": freq,
                        "vendor": get_vendor(bssid)
                    })
                elif len(parts) >= 4:  # fallback for older nmcli
                    ssid = parts[0]
                    bssid = parts[1]
                    signal = parts[2] + "%"
                    security = parts[3]
                    networks.append({
                        "ssid": ssid,
                        "bssid": bssid,
                        "signal": signal,
                        "security": security,
                        "channel": "N/A",
                        "vendor": get_vendor(bssid)
                    })

        elif os_type == "Darwin":
            # Use airport
            airport_cmd = "/System/Library/PrivateFrameworks/Apple80211.framework/Versions/Current/Resources/airport"
            cmd = f"{airport_cmd} -s"
            if adapter and adapter != "sim0":
                cmd = f"{airport_cmd} {adapter} -s"
            output = subprocess.check_output(cmd, shell=True, text=True, errors="ignore")
            lines = output.splitlines()
            if lines:
                # First line is header: SSID BSSID RSSI CHANNEL HT CC SECURITY
                header = lines[0].split()
                # Determine columns
                for line in lines[1:]:
                    if not line.strip():
                        continue
                    parts = re.split(r'\\s{2,}', line.strip())  # split on multiple spaces
                    if len(parts) >= 6:
                        ssid = parts[0]
                        bssid = parts[1]
                        signal = parts[2] + " dBm"
                        channel = parts[3]
                        security = parts[-1]
                        networks.append({
                            "ssid": ssid,
                            "bssid": bssid,
                            "signal": signal,
                            "security": security,
                            "channel": channel,
                            "vendor": get_vendor(bssid)
                        })
    except Exception as e:
        logger.error(f"Scanning error: {e}")

    # If no real networks found, fallback to simulated data
    if not networks:
        logger.warning("No real networks detected; using fallback simulated data.")
        networks = [
            {"ssid": "Simulated_WiFi_5G", "bssid": "00:1A:2B:3C:4D:5E", "signal": "80%", "security": "WPA3", "channel": "6", "vendor": "Cisco"},
            {"ssid": "Guest_Network", "bssid": "AA:BB:CC:DD:EE:02", "signal": "45%", "security": "Open", "channel": "11", "vendor": "Simulated"},
            {"ssid": "Office_2.4G", "bssid": "11:22:33:44:55:66", "signal": "70%", "security": "WPA2", "channel": "1", "vendor": "Unknown"},
        ]

    # Update cache
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
    """Perform a quick SYN-like connect scan on common ports."""
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
    """
    Get detailed information about a specific network and its connected clients.
    NOTE: Real client detection on arbitrary APs requires monitor mode and root privileges.
    We attempt a best-effort scan using the local ARP table. This will only show clients
    if you are currently connected to the target network.
    """
    clients = []
    os_type = platform.system()
    note = "Showing local ARP cache. Real client detection on arbitrary networks requires Monitor Mode and root."
    
    try:
        if os_type == "Windows":
            out = subprocess.check_output("arp -a", shell=True, text=True, errors="ignore")
            for line in out.splitlines():
                if "dynamic" in line.lower():
                    parts = line.split()
                    if len(parts) >= 2:
                        ip = parts[0]
                        mac = parts[1].replace("-", ":").upper()
                        vendor_name = get_vendor(mac)
                        
                        device_type = "Network Device"
                        vendor_lower = vendor_name.lower()
                        if any(k in vendor_lower for k in ["apple", "samsung", "google", "huawei", "oneplus", "motorola", "oppo", "vivo", "xiaomi", "nokia", "sony ericsson", "rim", "blackberry", "htc", "lge"]):
                            device_type = "Mobile / Tablet"
                        elif any(k in vendor_lower for k in ["intel", "dell", "hp", "lenovo", "asus", "acer", "microsoft", "toshiba", "fujitsu", "alienware", "msi", "razer", "clevo", "system76", "framework"]):
                            device_type = "Computer / Laptop"
                        elif any(k in vendor_lower for k in ["amazon", "roku", "sonos", "vizio", "lg", "philips", "google", "nest", "ring", "wyze", "eufy", "arlo", "belkin", "wemo", "tuya", "smartthings", "irobot"]):
                            device_type = "Smart Home / IoT"
                        elif any(k in vendor_lower for k in ["cisco", "netgear", "tp-link", "ubiquiti", "aruba", "juniper", "d-link", "linksys", "mikrotik", "fortinet", "palo alto", "synology", "qnap"]):
                            device_type = "Router / Switch / NAS"
                        elif any(k in vendor_lower for k in ["sony", "nintendo", "microsoft", "valve", "nvidia", "sega", "atari"]):
                             device_type = "Gaming Console"
                        elif "unknown" in vendor_lower:
                             device_type = "Unidentified Endpoint"
                        
                        clients.append({
                            "mac": mac,
                            "ip": ip,
                            "vendor": vendor_name,
                            "device_type": device_type,
                            "signal": "N/A",
                            "open_ports": scan_ports(ip)
                        })
        elif os_type == "Linux":
            out = subprocess.check_output("ip neigh", shell=True, text=True, errors="ignore")
            for line in out.splitlines():
                parts = line.split()
                if len(parts) >= 5 and "lladdr" in parts:
                    ip = parts[0]
                    mac = parts[parts.index("lladdr") + 1].upper()
                    vendor_name = get_vendor(mac)
                    device_type = "Network Device"
                    vendor_lower = vendor_name.lower()
                    if any(k in vendor_lower for k in ["apple", "samsung", "google", "huawei", "oneplus", "motorola", "oppo", "vivo", "xiaomi", "nokia", "sony ericsson", "rim", "blackberry", "htc", "lge"]):
                        device_type = "Mobile / Tablet"
                    elif any(k in vendor_lower for k in ["intel", "dell", "hp", "lenovo", "asus", "acer", "microsoft", "toshiba", "fujitsu", "alienware", "msi", "razer", "clevo", "system76", "framework"]):
                        device_type = "Computer / Laptop"
                    elif any(k in vendor_lower for k in ["amazon", "roku", "sonos", "vizio", "lg", "philips", "google", "nest", "ring", "wyze", "eufy", "arlo", "belkin", "wemo", "tuya", "smartthings", "irobot"]):
                        device_type = "Smart Home / IoT"
                    elif any(k in vendor_lower for k in ["cisco", "netgear", "tp-link", "ubiquiti", "aruba", "juniper", "d-link", "linksys", "mikrotik", "fortinet", "palo alto", "synology", "qnap"]):
                        device_type = "Router / Switch / NAS"
                    elif any(k in vendor_lower for k in ["sony", "nintendo", "microsoft", "valve", "nvidia", "sega", "atari"]):
                         device_type = "Gaming Console"
                    elif "unknown" in vendor_lower:
                         device_type = "Unidentified Endpoint"
                        
                    clients.append({
                        "mac": mac,
                        "ip": ip,
                        "vendor": vendor_name,
                        "device_type": device_type,
                        "signal": "N/A",
                        "open_ports": scan_ports(ip)
                    })
        elif os_type == "Darwin":
            out = subprocess.check_output("arp -a", shell=True, text=True, errors="ignore")
            for line in out.splitlines():
                import re
                match = re.search(r'\(([\d\.]+)\) at (([0-9a-fA-F]{1,2}:){5}[0-9a-fA-F]{1,2})', line)
                if match:
                    ip = match.group(1)
                    mac = match.group(2)
                    mac = ":".join([f"{int(x, 16):02X}" for x in mac.split(":")])
                    vendor_name = get_vendor(mac)
                    device_type = "Network Device"
                    vendor_lower = vendor_name.lower()
                    if any(k in vendor_lower for k in ["apple", "samsung", "google", "huawei", "oneplus", "motorola", "oppo", "vivo", "xiaomi", "nokia", "sony ericsson", "rim", "blackberry", "htc", "lge"]):
                        device_type = "Mobile / Tablet"
                    elif any(k in vendor_lower for k in ["intel", "dell", "hp", "lenovo", "asus", "acer", "microsoft", "toshiba", "fujitsu", "alienware", "msi", "razer", "clevo", "system76", "framework"]):
                        device_type = "Computer / Laptop"
                    elif any(k in vendor_lower for k in ["amazon", "roku", "sonos", "vizio", "lg", "philips", "google", "nest", "ring", "wyze", "eufy", "arlo", "belkin", "wemo", "tuya", "smartthings", "irobot"]):
                        device_type = "Smart Home / IoT"
                    elif any(k in vendor_lower for k in ["cisco", "netgear", "tp-link", "ubiquiti", "aruba", "juniper", "d-link", "linksys", "mikrotik", "fortinet", "palo alto", "synology", "qnap"]):
                        device_type = "Router / Switch / NAS"
                    elif any(k in vendor_lower for k in ["sony", "nintendo", "microsoft", "valve", "nvidia", "sega", "atari"]):
                         device_type = "Gaming Console"
                    elif "unknown" in vendor_lower:
                         device_type = "Unidentified Endpoint"
                        
                    clients.append({
                        "mac": mac,
                        "ip": ip,
                        "vendor": vendor_name,
                        "device_type": device_type,
                        "signal": "N/A",
                        "open_ports": scan_ports(ip)
                    })
    except Exception as e:
        note = f"ARP scan failed: {e}"

    # Remove duplicates based on MAC
    unique_clients = []
    seen = set()
    for c in clients:
        if c["mac"] not in seen:
            seen.add(c["mac"])
            unique_clients.append(c)

    return {
        "bssid": bssid,
        "ssid": ssid,
        "clients": unique_clients,
        "note": note
    }

# ------------------------------------------------------------
# Background scanning thread
# ------------------------------------------------------------
def background_scanner():
    """Background thread that periodically scans and emits updates."""
    logger.info("Background scanner started.")
    while state.scanning_enabled:
        if state.action_in_progress:
            time.sleep(1)
            continue
            
        try:
            scan_networks(force=True)
            # Emit via SocketIO if available
            try:
                socketio.emit('networks_updated', {'networks': state.networks, 'timestamp': time.time()})
            except NameError:
                pass
        except Exception as e:
            logger.error(f"Background scan error: {e}")
        
        # Wait for next interval in chunks so we can interrupt quickly if needed
        for _ in range(state.scan_interval * 2): # half-second chunks
            if not state.scanning_enabled or state.action_in_progress:
                break
            time.sleep(0.5)

def start_background_scan():
    """Start the background scanner thread if not already running."""
    if state.scan_thread and state.scan_thread.is_alive():
        logger.info("Background scanner already running.")
        return
    state.scanning_enabled = True
    state.scan_thread = threading.Thread(target=background_scanner, daemon=True)
    state.scan_thread.start()

def stop_background_scan():
    """Stop the background scanner."""
    state.scanning_enabled = False
    if state.scan_thread:
        state.scan_thread.join(timeout=2)
        state.scan_thread = None
        logger.info("Background scanner stopped.")

# ------------------------------------------------------------
# Flask + SocketIO App
# ------------------------------------------------------------

from functools import wraps
from flask import make_response

def api_error_handler(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        try:
            return f(*args, **kwargs)
        except Exception as e:
            logger.error(f"API Error in {f.__name__}: {str(e)}", exc_info=True)
            return jsonify({"error": "Internal server error", "message": str(e), "success": False}), 500
    return decorated_function
app = Flask(__name__)
app.config['SECRET_KEY'] = 'p4nth0m-secret-key'
CORS(app)
socketio = SocketIO(app, cors_allowed_origins="*")

# ------------------------------------------------------------

# ------------------------------------------------------------
# Web Dashboard Serving
# ------------------------------------------------------------
@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve_dashboard(path):
    import os
    dist_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'dist')
    
    # Try parent dir dist if we are in a subfolder
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

# API Endpoints
# ------------------------------------------------------------
@app.route('/api/status', methods=['GET'])
@api_error_handler
def status():
    """Return agent status and uptime."""
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
    """Return list of available Wi-Fi adapters."""
    # Refresh adapters list
    state.adapters = get_system_adapters()
    return jsonify({"adapters": state.adapters})

@app.route('/api/scan', methods=['GET', 'POST'])
@api_error_handler
def scan_endpoint():
    """Perform a network scan. POST can force refresh."""
    force = False
    adapter = None
    if request.method == 'POST':
        data = request.get_json() or {}
        force = data.get('force', False)
        adapter = data.get('adapterId')
    # If adapter is provided and different from current, temporarily use it
    networks = scan_networks(adapter_id=adapter, force=force)
    return jsonify({"networks": networks})

@app.route('/api/network/details', methods=['GET'])
@api_error_handler
def network_details():
    """Get advanced details and clients for a specific network."""
    bssid = request.args.get('bssid', 'Unknown')
    ssid = request.args.get('ssid', 'Unknown')
    
    # If we only have 1 adapter (or simulated), pause background scanning
    pause_background = len(state.adapters) <= 1
    if pause_background:
        state.action_in_progress = True
        logger.info(f"Pausing background scanner for detailed action on {ssid}...")
        # Brief pause to ensure background thread finishes its current loop if it was waiting
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
    """Start background periodic scanning."""
    start_background_scan()
    return jsonify({"status": "scanning_started", "interval": state.scan_interval})

@app.route('/api/scan/stop', methods=['POST'])
@api_error_handler
def scan_stop():
    """Stop background periodic scanning."""
    stop_background_scan()
    return jsonify({"status": "scanning_stopped"})

@app.route('/api/scan/interval', methods=['POST'])
@api_error_handler
def set_interval():
    """Set the background scan interval in seconds."""
    data = request.get_json()
    interval = data.get('interval', DEFAULT_SCAN_INTERVAL)
    if interval < 5:
        return jsonify({"error": "Interval must be at least 5 seconds"}), 400
    state.scan_interval = interval
    return jsonify({"status": "interval_updated", "interval": interval})

@app.route('/api/adapter/select', methods=['POST'])
@api_error_handler
def select_adapter():
    """Set the default adapter for scanning."""
    data = request.get_json()
    adapter = data.get('adapterId')
    # Validate if adapter exists
    if not any(a['id'] == adapter for a in state.adapters):
        return jsonify({"error": "Invalid adapter ID"}), 400
    state.selected_adapter = adapter
    return jsonify({"status": "adapter_selected", "adapter": adapter})

@app.route('/api/connect', methods=['POST'])
@api_error_handler
def connect_to_network():
    """
    Attempt to connect to a Wi-Fi network.
    Expects JSON: {"ssid": "Network", "password": "secret", "adapter": "wlan0"}.
    This is OS-specific and may require elevated privileges.
    """
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
            cmd = f'netsh wlan add profile filename="temp.xml" user=all'
            # We would need to generate an XML profile; for simplicity we skip.
            message = "Windows connection not implemented in this demo."
        elif os_type == "Linux":
            # Use nmcli
            cmd = f'nmcli dev wifi connect "{ssid}" password "{password}"'
            if adapter and adapter != "sim0":
                cmd += f' ifname {adapter}'
            subprocess.check_call(cmd, shell=True, timeout=30)
            success = True
            message = f"Connected to {ssid}"
        elif os_type == "Darwin":
            # Use networksetup or airport
            cmd = f'networksetup -setairportnetwork {adapter} "{ssid}" "{password}"'
            if not adapter or adapter == "sim0":
                # try to find Wi-Fi interface
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

    # Set scan interval
    state.scan_interval = args.scan_interval

    # Initial adapter enumeration
    state.adapters = get_system_adapters()
    if state.adapters:
        state.selected_adapter = state.adapters[0]['id']

    # Start background scanning by default
    start_background_scan()

    check_dependencies_on_startup()
    
    # Print the local interface URL for the user
    dashboard_url = "http://localhost:5000"
    print("\n==========================================================================")
    print(" P4NTH0M_AGENT DEPLOYED & ACTIVE")
    print("==========================================================================")
    print(f" [*] Local Telemetry Bridge listening on: {args.host}:{args.port}")
    print(f" [+] Secure Dashboard Interface: {dashboard_url}")
    print(" [!] ACTION REQUIRED: Click the link above to access the dashboard.")
    print("==========================================================================\n")

    # Disable flask output entirely
    import sys
    cli = sys.modules['flask.cli']
    cli.show_server_banner = lambda *x: None

    # Run with SocketIO silently
    socketio.run(app, host=args.host, port=args.port, debug=args.debug, log_output=False)