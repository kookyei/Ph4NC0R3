const fs = require('fs');
let code = fs.readFileSync('p4nth0m_agent.py', 'utf8');

// 1. Add eventlet to dependencies
code = code.replace(
    /"flask": "flask",/,
    '"flask": "flask",\n        "eventlet": "eventlet",'
);

// 2. Add send_from_directory to imports
code = code.replace(
    /from flask import Flask, jsonify, request/g,
    'from flask import Flask, jsonify, request, send_from_directory'
);

// 3. Add static file serving route
const staticRoute = `
# ------------------------------------------------------------
# Web Dashboard Serving
# ------------------------------------------------------------
@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve_dashboard(path):
    import os
    dist_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'dist')
    
    # Try parent dir dist if we are in a subfolder
    if not os.path.exists(dist_dir):
        dist_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'dist')

    if os.path.exists(dist_dir):
        if path != "" and os.path.exists(os.path.join(dist_dir, path)):
            return send_from_directory(dist_dir, path)
        else:
            return send_from_directory(dist_dir, 'index.html')
    else:
        return """
        <html><head><title>P4NTH0M Agent</title></head>
        <body style="background:#0a0a0a; color:#00ffcc; font-family:monospace; padding:50px;">
        <h2>P4NTH0MC0R3 AGENT IS ONLINE</h2>
        <p>The API is running, but the compiled web dashboard was not found in the 'dist' directory.</p>
        <p>To view the dashboard, either run the Node.js development server or compile the frontend using 'npm run build'.</p>
        </body></html>
        """
`;

code = code.replace(
    /# API Endpoints/g,
    staticRoute + "\n# API Endpoints"
);

// 4. Update the console output URL to just 5000
code = code.replace(
    /dashboard_url = "http:\/\/localhost:3000"/,
    'dashboard_url = "http://localhost:5000"'
);

// 5. Update socketio.run to remove allow_unsafe_werkzeug
code = code.replace(
    /socketio\.run\(app, host=args\.host, port=args\.port, debug=args\.debug, allow_unsafe_werkzeug=True, log_output=False\)/,
    'socketio.run(app, host=args.host, port=args.port, debug=args.debug, log_output=False)'
);

fs.writeFileSync('p4nth0m_agent.py', code);
