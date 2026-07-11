import re

with open('p4nth0m_agent.py', 'r') as f:
    code = f.read()

old_tail = """    # Print the local interface URL for the user
    dashboard_url = "http://localhost:5000"
    print("\\n==========================================================================")
    print(" P4NTH0M_AGENT DEPLOYED & ACTIVE")
    print("==========================================================================")
    print(f" [*] Local Telemetry Bridge listening on: {args.host}:{args.port}")
    print(f" [+] Secure Dashboard Interface: {dashboard_url}")
    print(" [!] ACTION REQUIRED: Click the link above to access the dashboard.")
    print("==========================================================================\\n")"""

new_tail = """    # Print the local interface URL for the user
    print("\\n==========================================================================")
    print(" P4NTH0M_AGENT DEPLOYED & ACTIVE")
    print("==========================================================================")
    print(f" [*] Local Telemetry Bridge listening on: {args.host}:{args.port}")
    print(" [!] ACTION REQUIRED: Return to the P4NTH0MC0R3 Web Dashboard in your browser.")
    print("==========================================================================\\n")"""

code = code.replace(old_tail, new_tail)

with open('p4nth0m_agent.py', 'w') as f:
    f.write(code)

print("Fixed output message.")
