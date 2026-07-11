const fs = require('fs');

// We should confirm src/App.tsx exports correctly.
let code = fs.readFileSync('src/App.tsx', 'utf8');

if (!code.includes("export default function App() {")) {
    console.log("No export default App found.");
} else {
    console.log("Export is present.");
}
