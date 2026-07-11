const fs = require('fs');
const path = require('path');

function embed() {
  console.log('Embedding compiled dashboard into p4nth0m_agent.py...');

  const distDir = path.join(__dirname, 'dist');
  const indexHtmlPath = path.join(distDir, 'index.html');

  if (!fs.existsSync(indexHtmlPath)) {
    console.error('Error: dist/index.html not found! Run npm run build first.');
    process.exit(1);
  }

  let html = fs.readFileSync(indexHtmlPath, 'utf8');

  // Find css and js files in dist/assets
  const assetsDir = path.join(distDir, 'assets');
  if (!fs.existsSync(assetsDir)) {
    console.error('Error: dist/assets not found!');
    process.exit(1);
  }

  const files = fs.readdirSync(assetsDir);
  const cssFile = files.find(f => f.endsWith('.css'));
  const jsFile = files.find(f => f.endsWith('.js'));

  if (!cssFile || !jsFile) {
    console.error('Error: Could not find CSS or JS asset in dist/assets!');
    process.exit(1);
  }

  console.log(`Found CSS asset: ${cssFile}`);
  console.log(`Found JS asset: ${jsFile}`);

  const cssContent = fs.readFileSync(path.join(assetsDir, cssFile), 'utf8');
  const jsContent = fs.readFileSync(path.join(assetsDir, jsFile), 'utf8');

  // Replace links to stylesheet with inlined style tag
  // Pattern: <link rel="stylesheet" crossorigin href="/assets/index-*.css"> or similar
  html = html.replace(/<link[^>]*href="[^"]*\.css"[^>]*>/g, `<style>${cssContent}</style>`);

  // Replace script tag with inlined script tag
  // Pattern: <script type="module" crossorigin src="/assets/index-*.js"></script>
  html = html.replace(/<script[^>]*src="[^"]*\.js"[^>]*><\/script>/g, `<script type="module">${jsContent}</script>`);

  // We should also remove any other relative assets or scripts that could fail offline
  // Since we inlined the main CSS and JS, it's fully self-contained.

  // Escape the HTML for Python triple quotes
  // 1. Escape backslashes
  // 2. Escape triple double quotes
  const escapedHtml = html
    .replace(/\\/g, '\\\\')
    .replace(/"""/g, '\\"\\"\\"');

  // Read p4nth0m_agent.py
  const agentPath = path.join(__dirname, 'p4nth0m_agent.py');
  if (!fs.existsSync(agentPath)) {
    console.error('Error: p4nth0m_agent.py not found!');
    process.exit(1);
  }

  let agentCode = fs.readFileSync(agentPath, 'utf8');

  // We will find the fallback HTML block in serve_dashboard and replace it
  const fallbackRegex = /else:\s*return\s*"""[\s\S]*?"""/g;
  
  if (!agentCode.match(fallbackRegex)) {
    console.error('Warning: Could not find exact fallback HTML block in serve_dashboard in p4nth0m_agent.py');
    // Let's do a more flexible replacement
    // Look for the HTML block that starts with <html><head><title>P4NTH0M Agent</title></head>
    const fallbackHTMLStartRegex = /"""\s*<html><head><title>P4NTH0M Agent<\/title>[\s\S]*?<\/html>\s*"""/;
    if (agentCode.match(fallbackHTMLStartRegex)) {
      agentCode = agentCode.replace(fallbackHTMLStartRegex, `"""${escapedHtml}"""`);
      console.log('Replaced fallback HTML with inlined dashboard using flexible match.');
    } else {
      console.error('Error: Could not find serve_dashboard fallback block to replace!');
      process.exit(1);
    }
  } else {
    agentCode = agentCode.replace(fallbackRegex, `else:\n        return """${escapedHtml}"""`);
    console.log('Replaced fallback HTML with inlined dashboard.');
  }

  fs.writeFileSync(agentPath, agentCode, 'utf8');
  console.log('Successfully embedded beautiful dashboard into p4nth0m_agent.py!');
}

embed();
