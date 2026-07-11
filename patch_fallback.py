import re

with open('p4nth0m_agent.py', 'r') as f:
    code = f.read()

# Replace the HTML message
old_html = """        <html><head><title>P4NTH0M Agent</title></head>
        <body style="background:#0a0a0a; color:#00ffcc; font-family:monospace; padding:50px;">
        <h2>P4NTH0MC0R3 AGENT IS ONLINE</h2>
        <p>The API is running, but the compiled web dashboard was not found in the 'dist' directory.</p>
        <p>To view the dashboard, either run the Node.js development server or compile the frontend using 'npm run build'.</p>
        </body></html>"""

new_html = """        <html><head><title>P4NTH0M Agent</title></head>
        <body style="background:#0a0a0a; color:#00ffcc; font-family:monospace; padding:50px;">
        <h2>P4NTH0MC0R3 AGENT IS ACTIVE</h2>
        <p>The local telemetry bridge is successfully running.</p>
        <p>Please return to the web dashboard (AI Studio preview) in your browser to continue.</p>
        </body></html>"""

code = code.replace(old_html, new_html)

# Replace the console output
code = re.sub(r'dashboard_url = "http://localhost:5000".*?print\(" \[!\] ACTION REQUIRED: Click the link above to access the dashboard\."\)',
              'print("\\n [*] Local Telemetry Bridge listening on: " + str(args.host) + ":" + str(args.port))\\n    print(" [!] ACTION REQUIRED: Return to the P4NTH0MC0R3 Web Dashboard in your browser.")',
              code, flags=re.DOTALL)

with open('p4nth0m_agent.py', 'w') as f:
    f.write(code)

