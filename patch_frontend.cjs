const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

// Replace hardcoded URLs with a base URL
const baseUrlCode = `
// Determine API Base URL dynamically
const getApiBaseUrl = () => {
  // If we are served from port 5000 (Python), use relative paths or same host
  if (window.location.port === '5000') {
    return '';
  }
  // Otherwise, we are likely in Vite dev server (5173) or Cloud (3000), so connect to local agent
  return 'http://127.0.0.1:5000';
};
const API_BASE = getApiBaseUrl();
`;

if (!code.includes("const API_BASE = getApiBaseUrl();")) {
    code = code.replace(/export default function App\(\) {/, baseUrlCode + "\\nexport default function App() {");
    
    // Replace hardcoded fetches
    code = code.replace(/http:\/\/127\.0\.0\.1:5000/g, '${API_BASE}');
    
    // Replace io URL
    code = code.replace(/io\('\$\{API_BASE\}'/g, "io(API_BASE || '/'");
}

fs.writeFileSync('src/App.tsx', code);
