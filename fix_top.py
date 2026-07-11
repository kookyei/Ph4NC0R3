with open('p4nth0m_agent.py', 'r') as f:
    lines = f.readlines()

new_lines = []
in_docstring = False
passed_docstring = False

for line in lines:
    if line.startswith('import sys') and not passed_docstring:
        continue
    if line.startswith('# VERY FIRST THING'):
        continue
    new_lines.append(line)

with open('p4nth0m_agent.py', 'w') as f:
    f.writelines(new_lines)
