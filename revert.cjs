const fs = require('fs');

// We have the original App.tsx running around line 88 with hardcoded 127.0.0.1
let code = fs.readFileSync('src/App.tsx.backup', 'utf8');

// The original broken return was this:
// return 'http://127.0.0.1:5000';

// We want to replace fetch('http://127.0.0.1:5000/api/...
// With fetch('/api/...

// AND update socket = io('http://127.0.0.1:5000'
// To socket = io('', ...

code = code.replace(/http:\/\/127\.0\.0\.1:5000/g, "");
// However, the proxy needs to be set up in vite.config.ts for local dev.
// In the cloud environment, the backend and frontend are on the same server, so "" is correct!

fs.writeFileSync('src/App.tsx', code);
