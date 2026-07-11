import re

with open('p4nth0m_agent.py', 'r') as f:
    code = f.read()

# We know the first few lines are:
# #!/usr/bin/env python3
# import sys
# try:
#     import eventlet
#     eventlet.monkey_patch()
#     ...

# Let's clean it up completely. I will extract the core script, remove any eventlet monkey patching, and put exactly one at the top.

# Strip out ALL eventlet monkey patches
code = re.sub(r'try:\s*import eventlet\s*eventlet\.monkey_patch\(\).*?except.*?pass\s*', '', code, flags=re.DOTALL)
code = re.sub(r'try:\s*import eventlet\s*eventlet\.monkey_patch\(\).*?except.*?\s*', '', code, flags=re.DOTALL)
code = re.sub(r'import eventlet\s*eventlet\.monkey_patch\(\)\s*print\(\'\[\+\] Eventlet monkey patched for async web server\'\)', '', code, flags=re.DOTALL)

# Re-add at the top
header = """#!/usr/bin/env python3
import sys
import os

try:
    import eventlet
    eventlet.monkey_patch()
    # We don't print anything here so it's clean, or we just keep it simple.
except Exception:
    pass

"""

if code.startswith("#!"):
    code = code[code.find('\n')+1:]

code = header + code.lstrip()

with open('p4nth0m_agent.py', 'w') as f:
    f.write(code)

print("Patched cleanly!")
