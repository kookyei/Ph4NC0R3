const fs = require('fs');

let code = fs.readFileSync('p4nth0m_agent.py', 'utf8');

const dependencyChecker = `
def robust_dependency_check():
    import sys
    import subprocess
    
    required_packages = {
        'flask': 'Flask',
        'flask_cors': 'Flask-Cors',
        'flask_socketio': 'Flask-SocketIO',
        'eventlet': 'eventlet',
        'werkzeug': 'Werkzeug'
    }
    
    missing = []
    for pkg, install_name in required_packages.items():
        try:
            __import__(pkg)
        except ImportError:
            missing.append(install_name)
            
    if missing:
        print(f"[*] Missing packages: {', '.join(missing)}. Attempting strict installation...", file=sys.stderr)
        
        pip_cmds = [
            [sys.executable, '-m', 'pip', 'install'] + missing + ['--break-system-packages'],
            [sys.executable, '-m', 'pip', 'install'] + missing,
            ['pip3', 'install'] + missing + ['--break-system-packages'],
            ['pip', 'install'] + missing
        ]
        
        success = False
        for cmd in pip_cmds:
            try:
                result = subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                if result.returncode == 0:
                    success = True
                    break
            except Exception:
                pass
                
        if not success:
            print(f"[-] FATAL: Failed to resolve dependencies: {', '.join(missing)}", file=sys.stderr)
            print("[!] The program cannot continue. Please install them manually.", file=sys.stderr)
            sys.exit(1)
        else:
            print("[+] Dependencies successfully installed. Restarting agent...", file=sys.stderr)
            import os
            os.execl(sys.executable, sys.executable, *sys.argv)

robust_dependency_check()
`;

// Replace the current `robust_dependency_check` and its call
const regex = /def robust_dependency_check\(\):[\s\S]*?robust_dependency_check\(\)/;
code = code.replace(regex, dependencyChecker);

fs.writeFileSync('p4nth0m_agent.py', code);
