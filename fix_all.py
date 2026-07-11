import re

with open('p4nth0m_agent.py', 'r') as f:
    code = f.read()

# 1. Nuke the auto-updater
code = re.sub(r'def update_from_github\(\):.*?update_from_github\(\)\s*', '', code, flags=re.DOTALL)

# 2. Nuke eventlet monkey patch entirely
code = re.sub(r'try:\s*import eventlet\s*eventlet\.monkey_patch\(\).*?except.*?pass', '', code, flags=re.DOTALL)
code = re.sub(r'import eventlet\s*eventlet\.monkey_patch\(\)', '', code)

# 3. Nuke eventlet from dependency checker
code = code.replace('"eventlet": "eventlet",', '')
code = code.replace('"eventlet": "eventlet"', '')

# 4. Fix that syntax error at the end (newline in string)
code = code.replace('print("\n [*] Local Telemetry Bridge listening on:', 'print("\\n [*] Local Telemetry Bridge listening on:')

with open('p4nth0m_agent.py', 'w') as f:
    f.write(code)

print("Agent patched permanently!")
