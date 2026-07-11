import re

with open('p4nth0m_agent.py', 'r') as f:
    code = f.read()

# 1. Strip the try/except block for eventlet monkey patch
code = re.sub(r'try:\s*import eventlet\s*eventlet\.monkey_patch\(\)\s*#.*?except Exception:\s*pass', '', code, flags=re.DOTALL)
code = re.sub(r'try:\s*import eventlet\s*eventlet\.monkey_patch\(\)\s*except.*?:.*?pass', '', code, flags=re.DOTALL)

# 2. Strip eventlet from dependencies
code = code.replace("'eventlet': 'eventlet',", "")
code = code.replace("'eventlet': 'eventlet'", "")

# Let's clean up any leading empty lines
code = re.sub(r'^(#!/usr/bin/env python3\nimport sys\nimport os)\s+', r'\1\n', code)

with open('p4nth0m_agent.py', 'w') as f:
    f.write(code)

print("Stripped eventlet successfully!")
