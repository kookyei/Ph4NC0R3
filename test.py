# A quick python script to verify our syntax changes
try:
    import ast
    with open('p4nth0m_agent.py', 'r') as f:
        ast.parse(f.read())
    print("Syntax OK")
except Exception as e:
    print(f"Syntax Error: {e}")
