const fs = require('fs');

let code = fs.readFileSync('src/App.tsx', 'utf8');

code = code.replace("const API_BASE = '';", "const API_BASE = 'http://127.0.0.1:5000';");

fs.writeFileSync('src/App.tsx', code);
