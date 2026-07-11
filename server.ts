import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";

dotenv.config();

function getLocalSecurityAnalysis(prompt: string, networkData: any[]): string {
  const query = prompt.toLowerCase();
  
  // Base network stats
  const totalNetworks = networkData?.length || 0;
  const vulnerableNetworks = networkData?.filter(n => n.is_vulnerable || n.security?.toLowerCase().includes('wep') || n.security?.toLowerCase().includes('none') || n.security?.toLowerCase().includes('open')) || [];
  const wpa3Networks = networkData?.filter(n => n.security?.toUpperCase().includes('WPA3')) || [];
  const channelsUsed = Array.from(new Set(networkData?.map(n => n.channel) || []));
  const clientsFound = networkData?.reduce((acc, n) => acc + (n.clients_count || n.clients?.length || 0), 0) || 0;

  let response = `[P4NTH0MC0R3_AI COLD ENGINE DETECTED - OFFLINE STANDALONE INTERACTIVE TERMINAL]

`;

  if (query.includes('help') || query.includes('menu') || query.includes('command')) {
    response += `### AVAILABLE LOCAL AGENT SUBSYSTEMS & COMMANDS
Available autonomous modules to run on your local machine:

1. **WIFI RECONNAISSANCE** (\`scan_networks\`): Enumerates 802.11 beacons, extracts ESSIDs, BSSIDs, signal levels, channel frequencies, and encryption suites.
2. **ACTIVE ATTACK SURFACE ANALYSIS**: Identifies insecure open access points and highly vulnerable obsolete WEP protocols.
3. **CLIENT DISCOVERY & PROBING**: Sniffs ARP broadcasts to isolate connected nodes, runs non-intrusive TCP port sweeps to discover active ports (SSH, HTTP, Telnet, SMB).
4. **CREDENTIAL INJECTION & TESTING**: Tests custom authentication strings against target APs.

*Query suggestions:*
- "Analyze security threats"
- "Show network density and congestion"
- "Tell me about connected clients"
- "Explain active ports on the network"`;
  } else if (query.includes('security') || query.includes('threat') || query.includes('vuln') || query.includes('attack') || query.includes('weak')) {
    response += `### CYBERSECURITY RECON REPORT: THREAT TOPOGRAPHY
**Status**: ${vulnerableNetworks.length > 0 ? "⚠️ SEVERE ATTACK SURFACE DETECTED" : "✅ HIGH ENCRYPTION PROFILE ACTIVE"}

Total Active Transmitters: **${totalNetworks}**
Vulnerable/Insecure Beacons: **${vulnerableNetworks.length}**

`;
    if (vulnerableNetworks.length > 0) {
      response += `#### VULNERABILITY LOG:\n`;
      vulnerableNetworks.forEach((n, idx) => {
        response += `${idx + 1}. **${n.ssid}** [BSSID: \`${n.bssid}\` | Chan: ${n.channel}]
   - **Security**: \`${n.security}\`
   - **Threat Analysis**: ${n.vulnerability_type || "No encryption active. Potential for active MITM (Man-in-the-Middle) sniffing, packet injection, and Session Hijacking."}\n\n`;
      });
      response += `#### DEPLOYMENT RECOMMENDATIONS:
- Avoid associating with open or WEP nodes.
- Implement WPA3-SAE with PMF (Protected Management Frames) enabled to stop active deauth frame injections.
- Segregate IoT nodes into isolated VLAN pools.`;
    } else {
      response += `All detected active transmitters are utilizing secure protocol configurations (WPA2-PSK / WPA3). No open or legacy WEP beacons identified in the immediate physical radius. Continue normal operations.`;
    }
  } else if (query.includes('channel') || query.includes('congest') || query.includes('spectrum') || query.includes('frequenc') || query.includes('densit')) {
    response += `### RF EM SPECTRUM & CONGESTION TELEMETRY
- **Total Beacons in Range**: ${totalNetworks}
- **Channels in Use**: ${channelsUsed.length > 0 ? channelsUsed.sort((a,b)=>a-b).join(', ') : 'None'}

#### CHANNEL SPECTRUM ANALYSIS:
`;
    // Group networks by channel
    const chanMap: { [key: number]: any[] } = {};
    networkData?.forEach(n => {
      chanMap[n.channel] = chanMap[n.channel] || [];
      chanMap[n.channel].push(n);
    });

    Object.keys(chanMap).forEach(ch => {
      const num = parseInt(ch);
      const count = chanMap[num].length;
      let status = "LOW";
      if (count > 3) status = "⚠️ HIGHLY CONGESTED";
      else if (count > 1) status = "MODERATE";
      
      response += `- **Channel ${ch}**: ${count} active beacon(s) (${status})\n`;
      chanMap[num].forEach(n => {
        response += `  - \`${n.ssid}\` (Signal: ${n.signal}%) [${n.security}]\n`;
      });
    });
    
    response += `\n#### SPECTRAL RECONNAISSANCE SUMMARY:
- Overlapping channels in the 2.4GHz band (Channels 1, 6, 11) should be utilized to avoid adjacent-channel interference.
- High-frequency 5GHz bands show extremely low beacon saturation. Recommend migrating active payloads to high-frequency channels.`;
  } else if (query.includes('client') || query.includes('device') || query.includes('host') || query.includes('ip') || query.includes('mac')) {
    response += `### CLIENT DISCOVERY & NODE ENUMERATION
- **Connected Active Nodes Swept**: ${clientsFound} client devices detected across scanned SSIDs.

`;
    const clientNets = networkData?.filter(n => n.clients_count > 0 || n.clients?.length > 0) || [];
    if (clientNets.length > 0) {
      clientNets.forEach(n => {
        response += `#### ASSOCIATED CLIENTS ON "${n.ssid}" [\`${n.bssid}\`]:\n`;
        const clients = n.clients || [];
        clients.forEach((c: any) => {
          response += `- **${c.hostname || 'Unknown Host'}** (\`${c.ip || 'DHCP-Leased'}\` | Mac: \`${c.mac}\`)
  - **Vendor**: ${c.vendor || 'Unknown'}
  - **OS System**: \`${c.os || 'Unknown Device'}\`
  - **Active TCP Ports**: ${c.active_ports?.length > 0 ? c.active_ports.map((p: any) => `\`${p}\``).join(', ') : 'None detected'}\n`;
        });
        response += `\n`;
      });
    } else {
      response += `No active associated clients detected in current scan range. 
Run a detailed probe scan on a specific target network (e.g. click a network from the left-side dashboard list) to begin sniffing active MAC and ARP broadcasts to enumerate connected smartphones, laptops, IoT gadgets, and network-attached storages.`;
    }
  } else if (query.includes('port') || query.includes('socket') || query.includes('sweep') || query.includes('service')) {
    response += `### TCP PORT ANALYSIS & ACTIVE EXPLOIT MATRIX
- A port sweep on target hosts scans common TCP ports to locate running network services.

#### RECONNAISSANCE SIGNATURES:
- **Port 21 (FTP)**: Cleartext file transfers. Highly vulnerable to brute forcing and credential eavesdropping.
- **Port 22 (SSH)**: Encrypted shell access. Ensure keys are rotated and password-based root authentication is disabled.
- **Port 23 (Telnet)**: Legacy unencrypted remote shell. Critical security risk. Switch immediately to SSH.
- **Port 80 / 8080 (HTTP)**: Unsecured Web Servers. Analyze header configurations and look for legacy administration panels.
- **Port 443 / 8443 (HTTPS)**: Secure TLS sockets. Inspect certificate chains and TLS protocols (deprecate TLS 1.0/1.1).
- **Port 445 (SMB)**: Windows File Sharing. Ensure patched against EternalBlue (CVE-2017-0143) exploits.

Run active probes via the dashboard network details terminal to fetch the latest socket states for individual clients.`;
  } else {
    response += `### OFFLINE RECON SYSTEM STATUS REPORT
Current physical adapter active scan metrics analyzed:
- **Active Beacons**: ${totalNetworks}
- **WPA3 Encrypted**: ${wpa3Networks.length}
- **WPA2 Encrypted**: ${totalNetworks - wpa3Networks.length - vulnerableNetworks.length}
- **Vulnerabilities**: ${vulnerableNetworks.length}

*Systems are nominal. Awaiting input query. You can ask for assistance regarding:*
- **Security vulnerabilities & threats**
- **Channel congestion & spectrum analysis**
- **Connected clients & OS distribution**
- **Port sweeps & service enumeration**`;
  }

  return response;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "50mb" }));

  // API route for AI network analysis (Offline Local Analyser)
  app.post("/api/ask", async (req, res) => {
    try {
      const { prompt, networkData } = req.body;
      const answer = getLocalSecurityAnalysis(prompt || "", networkData || []);
      res.json({ answer });
    } catch (error: any) {
      console.error("Local Heuristics Error:", error);
      res.status(500).json({ error: error.message || "Failed to generate local response." });
    }
  });

  // API route to download the compiled/embedded Python agent script
  app.get("/api/agent/download", (req, res) => {
    try {
      const agentPath = path.join(process.cwd(), "p4nth0m_agent.py");
      res.download(agentPath, "p4nth0m_agent.py");
    } catch (err: any) {
      console.error("Error sending agent file:", err);
      res.status(500).json({ error: "Failed to download agent script." });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
