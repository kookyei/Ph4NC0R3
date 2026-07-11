import re

with open('p4nth0m_agent.py', 'r') as f:
    code = f.read()

import_eventlet = """try:
    import eventlet
    eventlet.monkey_patch()
    print('[+] Eventlet monkey patched for async web server')
except ImportError:
    pass

"""

if import_eventlet in code:
    code = code.replace(import_eventlet, '')

# We will just write a tiny snippet that overrides the beginning of the file
# Or rather, let's just create a new script block
# But the user error is that they are running the script with python3 p4nth0m_agent.py, and it throws an error in eventlet monkey patching "Working outside of application context".
# Wait, look at the error from the user again:
# "An exception was thrown while monkey_patching for eventlet. to fix this error make sure you run eventlet.monkey_patch() before importing any other modules."
# AND it printed:
# "Traceback (most recent call last):
#   File "/usr/lib/python3/dist-packages/werkzeug/local.py", line 519, in _get_current_object
#     raise RuntimeError(unbound_message) from None
# RuntimeError: Working outside of application context."
#
# This typically happens if Flask or Werkzeug is imported BEFORE eventlet monkey patches.
# Let's completely nuke `eventlet.monkey_patch()` and just run without eventlet, or we do eventlet patching as the VERY first line of the file.

new_code = """#!/usr/bin/env python3
import sys

# VERY FIRST THING: Monkey patch eventlet if it's available
try:
    import eventlet
    eventlet.monkey_patch()
    print('[+] Eventlet monkey patched for async web server')
except Exception as e:
    pass
"""

# Let's remove the first line if it's a shebang
lines = code.split('\n')
if lines[0].startswith('#!'):
    lines = lines[1:]

code = new_code + '\n'.join(lines)

with open('p4nth0m_agent.py', 'w') as f:
    f.write(code)

print("Patched!")
