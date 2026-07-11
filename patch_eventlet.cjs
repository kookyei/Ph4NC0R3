const fs = require('fs');
let code = fs.readFileSync('p4nth0m_agent.py', 'utf8');

if (!code.includes("eventlet.monkey_patch()")) {
    const patchStr = `
try:
    import eventlet
    eventlet.monkey_patch()
except ImportError:
    pass

from flask import Flask`;
    code = code.replace(/from flask import Flask/, patchStr);
}

fs.writeFileSync('p4nth0m_agent.py', code);
