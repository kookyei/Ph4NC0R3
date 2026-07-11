const fs = require('fs');

// We need a clean App.tsx that just works.
let code = `
import React, { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { Terminal, Wifi, Shield, ShieldAlert, ShieldCheck, Activity, Cpu, Server, Lock, Unlock, Database, Globe, RefreshCw, Layers } from 'lucide-react';
import { getPythonAgentCode } from './pythonCode';

interface WifiNetwork {
  bssid: string;
  ssid: string;
  signal_level: number;
  quality: number;
  frequency: string;
  encryption: string;
  channel: string;
  last_seen?: number;
}

interface AiAnalysis {
  status: 'idle' | 'loading' | 'success' | 'error';
  answer: string;
  error?: string;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'setup'>('setup');
  const [networks, setNetworks] = useState<WifiNetwork[]>([]);
  const [adapters, setAdapters] = useState<any[]>([]);
  const [selectedAdapter, setSelectedAdapter] = useState<string>('');
  const [isScanning, setIsScanning] = useState(false);
  const [serverStatus, setServerStatus] = useState<'connected' | 'disconnected' | 'connecting'>('disconnected');
  const [backendVersion, setBackendVersion] = useState<string>('');
  
  const [connectNetwork, setConnectNetwork] = useState<WifiNetwork | null>(null);
  const [connectPassword, setConnectPassword] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectMessage, setConnectMessage] = useState('');

  const [aiAnalysis, setAiAnalysis] = useState<AiAnalysis>({ status: 'idle', answer: '' });
  const [aiPrompt, setAiPrompt] = useState('Analyze this network environment for potential vulnerabilities and signal topography.');

  const socketRef = useRef<Socket | null>(null);
  
  // Use relative path for all API calls to match the local Express/Python server
  const API_BASE = '';

  useEffect(() => {
    // Connect to the local server
    const socket = io(API_BASE || '/');
    socketRef.current = socket;

    socket.on('connect', () => {
      setServerStatus('connected');
      fetchServerStatus();
      fetchAdapters();
    });

    socket.on('disconnect', () => {
      setServerStatus('disconnected');
    });

    socket.on('networks_updated', (data: { networks: WifiNetwork[], timestamp: number }) => {
      setNetworks(data.networks);
      setIsScanning(false);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const fetchServerStatus = async () => {
    try {
      const response = await fetch(\`\${API_BASE}/api/status\`);
      if (response.ok) {
        const data = await response.json();
        setBackendVersion(data.version);
      }
    } catch (e) {
      console.error('Failed to fetch status', e);
    }
  };

  const fetchAdapters = async () => {
    try {
      const response = await fetch(\`\${API_BASE}/api/adapters\`);
      if (response.ok) {
        const data = await response.json();
        setAdapters(data.adapters);
        if (data.adapters.length > 0 && !selectedAdapter) {
          handleAdapterSelect(data.adapters[0].id);
        }
      }
    } catch (e) {
      console.error('Failed to fetch adapters', e);
    }
  };

  const handleAdapterSelect = async (id: string) => {
    setSelectedAdapter(id);
    try {
      await fetch(\`\${API_BASE}/api/adapter/select\`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adapter: id })
      });
      handleScan();
    } catch (e) {
      console.error('Failed to select adapter', e);
    }
  };

  const handleScan = async () => {
    setIsScanning(true);
    try {
      await fetch(\`\${API_BASE}/api/scan\`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bg_only: false })
      });
    } catch (e) {
      setIsScanning(false);
      console.error('Failed to start scan', e);
    }
  };

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!connectNetwork) return;
    
    setIsConnecting(true);
    setConnectMessage('Attempting to connect...');
    
    try {
      const res = await fetch(\`\${API_BASE}/api/connect\`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ssid: connectNetwork.ssid,
          bssid: connectNetwork.bssid,
          password: connectPassword
        })
      });
      
      const data = await res.json();
      if (data.status === 'success') {
        setConnectMessage('Connection successful!');
        setTimeout(() => {
          setConnectNetwork(null);
          setConnectPassword('');
          setConnectMessage('');
        }, 2000);
      } else {
        setConnectMessage(\`Failed: \${data.message}\`);
      }
    } catch (e) {
      setConnectMessage('Error connecting to network');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleAiAnalysis = async () => {
    if (networks.length === 0) return;
    
    setAiAnalysis({ status: 'loading', answer: '' });
    
    try {
      // In production, this would call our Express server with Gemini API key
      const response = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: aiPrompt,
          networkData: networks.slice(0, 10) // Send top 10 to fit in prompt easily
        })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setAiAnalysis({ status: 'success', answer: data.answer });
      } else {
        setAiAnalysis({ status: 'error', answer: '', error: data.error || 'Failed to analyze' });
      }
    } catch (e) {
      setAiAnalysis({ status: 'error', answer: '', error: 'Network error during analysis' });
    }
  };

  // UI rendering
  return (
    <div className="min-h-screen bg-black text-green-500 font-mono flex flex-col selection:bg-green-900 selection:text-green-100">
      <header className="border-b border-green-900/50 bg-black/80 backdrop-blur-md sticky top-0 z-50 p-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Activity className="text-green-500 animate-pulse" />
            <h1 className="text-xl font-bold tracking-wider">P4NTH0MC0R3</h1>
          </div>
          <div className="flex gap-4">
            <button 
              onClick={() => setActiveTab('dashboard')}
              className={\`px-4 py-2 uppercase text-xs tracking-widest transition-colors \${activeTab === 'dashboard' ? 'bg-green-900/40 text-green-400 border border-green-500/30' : 'text-green-700 hover:text-green-500'}\`}
            >
              Dashboard
            </button>
            <button 
              onClick={() => setActiveTab('setup')}
              className={\`px-4 py-2 uppercase text-xs tracking-widest transition-colors \${activeTab === 'setup' ? 'bg-green-900/40 text-green-400 border border-green-500/30' : 'text-green-700 hover:text-green-500'}\`}
            >
              Agent Setup
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 p-6 max-w-7xl mx-auto w-full">
        {activeTab === 'dashboard' ? (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="border border-green-900/50 bg-black/40 p-4">
                <div className="text-xs text-green-700 mb-2 uppercase tracking-widest">Agent Link</div>
                <div className="flex items-center gap-2 text-sm">
                  <div className={\`w-2 h-2 rounded-full \${serverStatus === 'connected' ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-red-500'}\`}></div>
                  {serverStatus === 'connected' ? 'ONLINE' : 'OFFLINE'}
                </div>
              </div>
              <div className="border border-green-900/50 bg-black/40 p-4">
                <div className="text-xs text-green-700 mb-2 uppercase tracking-widest">Adapter</div>
                <div className="text-sm">
                  {adapters.length > 0 ? (
                    <select 
                      value={selectedAdapter} 
                      onChange={(e) => handleAdapterSelect(e.target.value)}
                      className="bg-transparent border-b border-green-900/50 text-green-400 outline-none w-full pb-1"
                    >
                      {adapters.map(a => (
                        <option key={a.id} value={a.id} className="bg-black text-green-500">{a.name}</option>
                      ))}
                    </select>
                  ) : 'No adapters found'}
                </div>
              </div>
              <div className="border border-green-900/50 bg-black/40 p-4 flex items-center justify-between">
                <div>
                  <div className="text-xs text-green-700 mb-2 uppercase tracking-widest">Active Targets</div>
                  <div className="text-2xl">{networks.length}</div>
                </div>
                <button 
                  onClick={handleScan}
                  disabled={isScanning}
                  className="bg-green-900/20 hover:bg-green-900/40 border border-green-500/30 p-3 transition-colors disabled:opacity-50"
                >
                  <RefreshCw className={\`w-5 h-5 \${isScanning ? 'animate-spin' : ''}\`} />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 border border-green-900/50 bg-black/40 p-0 overflow-hidden">
                <div className="bg-green-900/20 border-b border-green-900/50 px-4 py-3 flex items-center gap-2">
                  <Terminal className="w-4 h-4" />
                  <h2 className="text-sm tracking-widest uppercase">Environment Telemetry</h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-green-900/30 text-green-700 text-xs tracking-wider">
                        <th className="p-3 font-normal">SSID</th>
                        <th className="p-3 font-normal">BSSID</th>
                        <th className="p-3 font-normal">SIG</th>
                        <th className="p-3 font-normal">CH</th>
                        <th className="p-3 font-normal">ENC</th>
                        <th className="p-3 font-normal text-right">ACT</th>
                      </tr>
                    </thead>
                    <tbody>
                      {networks.length > 0 ? (
                        networks.map((net, i) => (
                          <tr key={\`\${net.bssid}-\${i}\`} className="border-b border-green-900/20 hover:bg-green-900/10 transition-colors">
                            <td className="p-3 font-medium text-green-400">{net.ssid || '<HIDDEN>'}</td>
                            <td className="p-3 text-green-600 font-mono text-xs">{net.bssid}</td>
                            <td className="p-3">
                              <div className="flex items-center gap-2">
                                <div className="w-16 h-1 bg-green-900/30 rounded-full overflow-hidden">
                                  <div 
                                    className={\`h-full \${net.quality > 70 ? 'bg-green-500' : net.quality > 40 ? 'bg-yellow-500' : 'bg-red-500'}\`}
                                    style={{ width: \`\${Math.min(100, Math.max(0, net.quality))}%\` }}
                                  ></div>
                                </div>
                                <span className="text-xs text-green-700">{net.signal_level}</span>
                              </div>
                            </td>
                            <td className="p-3 text-green-600">{net.channel}</td>
                            <td className="p-3">
                              <span className="px-2 py-1 bg-green-900/20 text-green-600 text-[10px] uppercase tracking-wider border border-green-900/30">
                                {net.encryption}
                              </span>
                            </td>
                            <td className="p-3 text-right">
                              <button 
                                onClick={() => setConnectNetwork(net)}
                                className="text-xs px-3 py-1 border border-green-500/30 hover:bg-green-500/10 transition-colors"
                              >
                                CONNECT
                              </button>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={6} className="p-8 text-center text-green-700">
                            {isScanning ? 'SCANNING FREQUENCIES...' : 'NO SIGNALS DETECTED. INITIATE SCAN.'}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="space-y-6">
                <div className="border border-green-900/50 bg-black/40 flex flex-col h-[500px]">
                  <div className="bg-green-900/20 border-b border-green-900/50 px-4 py-3 flex items-center gap-2">
                    <Cpu className="w-4 h-4" />
                    <h2 className="text-sm tracking-widest uppercase">P4NTH0MC0R3 AI</h2>
                  </div>
                  <div className="p-4 flex-1 overflow-y-auto">
                    {aiAnalysis.status === 'idle' && (
                      <div className="text-green-700 text-sm h-full flex items-center justify-center text-center">
                        AWAITING ANALYSIS DIRECTIVES
                      </div>
                    )}
                    {aiAnalysis.status === 'loading' && (
                      <div className="text-green-400 text-sm h-full flex flex-col items-center justify-center text-center space-y-4">
                        <Activity className="w-8 h-8 animate-spin" />
                        <div>PROCESSING TELEMETRY...</div>
                      </div>
                    )}
                    {aiAnalysis.status === 'error' && (
                      <div className="text-red-400 text-sm border border-red-900/50 p-4 bg-red-900/10">
                        <ShieldAlert className="w-6 h-6 mb-2" />
                        SYSTEM ERROR: {aiAnalysis.error}
                      </div>
                    )}
                    {aiAnalysis.status === 'success' && (
                      <div className="text-sm text-green-300 leading-relaxed whitespace-pre-wrap font-sans">
                        {aiAnalysis.answer}
                      </div>
                    )}
                  </div>
                  <div className="p-3 border-t border-green-900/50 bg-black/60">
                    <div className="flex gap-2">
                      <input 
                        type="text" 
                        value={aiPrompt}
                        onChange={(e) => setAiPrompt(e.target.value)}
                        className="flex-1 bg-green-900/10 border border-green-900/50 px-3 py-2 text-sm text-green-400 outline-none focus:border-green-500/50"
                        placeholder="Directive..."
                      />
                      <button 
                        onClick={handleAiAnalysis}
                        disabled={aiAnalysis.status === 'loading' || networks.length === 0}
                        className="bg-green-900/30 hover:bg-green-900/50 border border-green-500/30 px-4 py-2 text-sm transition-colors disabled:opacity-50"
                      >
                        EXEC
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto space-y-8">
            <div className="border border-green-900/50 bg-black/40 p-6">
              <h2 className="text-xl font-bold tracking-widest mb-4 flex items-center gap-2">
                <Server className="w-5 h-5" />
                PYTHON AGENT DEPLOYMENT
              </h2>
              <p className="text-green-700 mb-6 leading-relaxed">
                To enable live network telemetry, the local P4NTH0M_AGENT must be deployed on the target machine. This script enumerates hardware adapters, performs raw 802.11 scans, and bridges the data to this dashboard via WebSocket.
              </p>
              
              <div className="space-y-4">
                <div className="bg-green-900/10 border border-green-900/50 p-4">
                  <div className="text-xs text-green-600 mb-2 uppercase tracking-widest">Step 1: Download Agent</div>
                  <div className="flex items-center gap-3">
                    <button 
                      onClick={() => {
                        const blob = new Blob([getPythonAgentCode()], { type: 'text/plain' });
                        const url = window.URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = 'p4nth0m_agent.py';
                        a.click();
                      }}
                      className="bg-green-900/30 border border-green-500/40 hover:bg-green-900/50 px-4 py-2 text-sm uppercase tracking-wider transition-colors"
                    >
                      DOWNLOAD P4NTH0M_AGENT.PY
                    </button>
                    <span className="text-sm text-green-700">Contains self-updating logic and fallback simulation.</span>
                  </div>
                </div>

                <div className="bg-green-900/10 border border-green-900/50 p-4">
                  <div className="text-xs text-green-600 mb-2 uppercase tracking-widest">Step 2: Execute Payload</div>
                  <div className="bg-black border border-green-900/30 p-3 font-mono text-sm text-green-400">
                    python3 p4nth0m_agent.py
                  </div>
                  <p className="text-xs text-green-700 mt-2">
                    Dependencies (Flask, Flask-SocketIO, Eventlet) will be installed automatically if pip is available. Run with root/admin privileges for raw adapter access.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {connectNetwork && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="border border-green-500 bg-black max-w-md w-full shadow-[0_0_30px_rgba(34,197,94,0.1)]">
            <div className="bg-green-900/20 border-b border-green-900 px-4 py-3 flex justify-between items-center">
              <h3 className="font-bold tracking-wider uppercase">AUTHENTICATE</h3>
              <button onClick={() => !isConnecting && setConnectNetwork(null)} className="text-green-700 hover:text-green-400">X</button>
            </div>
            <form onSubmit={handleConnect} className="p-6 space-y-6">
              <div>
                <div className="text-xs text-green-700 mb-1">TARGET SSID</div>
                <div className="text-lg text-green-400">{connectNetwork.ssid || connectNetwork.bssid}</div>
              </div>
              <div>
                <div className="text-xs text-green-700 mb-1">CREDENTIALS</div>
                <input 
                  type="password" 
                  value={connectPassword}
                  onChange={e => setConnectPassword(e.target.value)}
                  disabled={isConnecting}
                  className="w-full bg-green-900/10 border border-green-900/50 px-3 py-2 text-green-400 outline-none focus:border-green-500/50 disabled:opacity-50 font-sans"
                  placeholder="Password..."
                  autoFocus
                />
              </div>
              
              {connectMessage && (
                <div className={\`text-sm p-3 border \${connectMessage.includes('successful') ? 'bg-green-900/20 border-green-500/50 text-green-400' : connectMessage.includes('Failed') || connectMessage.includes('Error') ? 'bg-red-900/20 border-red-500/50 text-red-400' : 'bg-green-900/10 border-green-900/50 text-green-500'}\`}>
                  {connectMessage}
                </div>
              )}

              <div className="flex gap-3 justify-end">
                <button 
                  type="button"
                  onClick={() => setConnectNetwork(null)}
                  disabled={isConnecting}
                  className="px-4 py-2 border border-green-900/50 text-green-600 hover:text-green-400 disabled:opacity-50"
                >
                  CANCEL
                </button>
                <button 
                  type="submit"
                  disabled={isConnecting || !connectPassword}
                  className="bg-green-900/30 hover:bg-green-900/50 border border-green-500/50 px-4 py-2 text-green-400 transition-colors disabled:opacity-50"
                >
                  {isConnecting ? 'NEGOTIATING...' : 'INJECT KEY'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
`;

fs.writeFileSync('src/App.tsx', code);
