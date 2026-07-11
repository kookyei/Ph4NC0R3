const fs = require('fs');
let code = fs.readFileSync('p4nth0m_agent.py', 'utf8');

// The user asked to include running automatically on mature servers if nodejs etc.
// They want the python agent to run on apache/nginx/eventlet/wsgi seamlessly.
// We added eventlet. We can add a WSGI entry point at the bottom to make it compatible with waitress/gunicorn etc.

const wsgi = `
# ------------------------------------------------------------
# WSGI/Mature Server Entry Point
# ------------------------------------------------------------
# Expose the Flask app object as 'application' or 'app' for WSGI servers
# e.g., gunicorn -k eventlet -w 1 p4nth0m_agent:app

if __name__ == '__main__':
`;

code = code.replace(/if __name__ == '__main__':/, wsgi);

fs.writeFileSync('p4nth0m_agent.py', code);
