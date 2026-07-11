const fs = require('fs');
let code = fs.readFileSync('src/App.tsx.backup', 'utf8');

// Just simple string replacements, no regexes for the fetch calls that might match weird things
code = code.replace("io('http://127.0.0.1:5000'", "io('' /* proxy to backend */");

code = code.replace("fetch('http://127.0.0.1:5000/api/status'", "fetch('/api/status'");
code = code.replace("fetch('http://127.0.0.1:5000/api/adapters'", "fetch('/api/adapters'");
code = code.replace("fetch('http://127.0.0.1:5000/api/adapter/select'", "fetch('/api/adapter/select'");
code = code.replace("fetch('http://127.0.0.1:5000/api/scan'", "fetch('/api/scan'");
code = code.replace("fetch(`http://127.0.0.1:5000${endpoint}`", "fetch(endpoint");
code = code.replace("fetch('http://127.0.0.1:5000/api/connect'", "fetch('/api/connect'");
code = code.replace("fetch(`http://127.0.0.1:5000/api/network/details?bssid=${encodeURIComponent(net.bssid)}&ssid=${encodeURIComponent(net.ssid)}`)", "fetch(`/api/network/details?bssid=${encodeURIComponent(net.bssid)}&ssid=${encodeURIComponent(net.ssid)}`)");


fs.writeFileSync('src/App.tsx', code);
