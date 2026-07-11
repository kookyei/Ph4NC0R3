const fs = require('fs');

let code = fs.readFileSync('p4nth0m_agent.py', 'utf8');

// I will make sure the agent's port logic is what they want
// and also ensure there are no eventlet crashes if the user runs it natively

// Update the eventlet patch just in case
code = code.replace(
    /import eventlet\n    eventlet.monkey_patch\(\)/,
    "import eventlet\n    eventlet.monkey_patch()\n    print('[+] Eventlet monkey patched for async web server')"
);

fs.writeFileSync('p4nth0m_agent.py', code);
