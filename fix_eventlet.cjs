const fs = require('fs');

let code = fs.readFileSync('p4nth0m_agent.py', 'utf8');

// Remove the existing eventlet patch block
const patchBlock = `try:
    import eventlet
    eventlet.monkey_patch()
    print('[+] Eventlet monkey patched for async web server')
except ImportError:
    pass`;

code = code.replace(patchBlock, '');

// Prepend the eventlet patch to the top of the file after the docstring
const docstringEnd = `"""\n`;

const newPatch = `try:
    import eventlet
    eventlet.monkey_patch()
    print('[+] Eventlet monkey patched for async web server')
except ImportError:
    pass

`;

const parts = code.split(docstringEnd);
code = parts[0] + docstringEnd + newPatch + parts.slice(1).join(docstringEnd);

fs.writeFileSync('p4nth0m_agent.py', code);
