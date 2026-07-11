with open('p4nth0m_agent.py', 'r') as f:
    code = f.read()

code = code.replace('print("\n [*] Local Telemetry Bridge listening on:', 'print("\\n [*] Local Telemetry Bridge listening on:')

with open('p4nth0m_agent.py', 'w') as f:
    f.write(code)
