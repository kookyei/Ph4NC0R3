with open('p4nth0m_agent.py', 'r') as f:
    code = f.read()

# Just manually strip lines
lines = code.split('\n')
new_lines = []
skip = False
for line in lines:
    if line.startswith('try:'):
        # Look ahead to see if it's the eventlet block
        idx = lines.index(line)
        if idx + 1 < len(lines) and 'import eventlet' in lines[idx+1]:
            skip = True
            continue
    if skip and line.startswith('except Exception:'):
        continue
    if skip and line.strip() == 'pass':
        skip = False
        continue
    if not skip:
        new_lines.append(line)

code = '\n'.join(new_lines)
code = code.replace("'eventlet': 'eventlet',", "")
code = code.replace("'eventlet': 'eventlet'", "")

with open('p4nth0m_agent.py', 'w') as f:
    f.write(code)

print("Stripped!")
