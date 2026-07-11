import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Wifi, RefreshCw, ServerOff, Server, Terminal, Copy, Check, ShieldAlert, Signal, Activity, Lock, Unlock, Radio, Fingerprint, Database, Zap, ArrowRight, LayoutDashboard, ChevronDown, BarChart3, Play, Square, Settings, Key, X, Download, Skull, Cpu, Ghost, Hexagon } from 'lucide-react';
import { getPythonAgentCode } from './pythonCode';
import { motion, AnimatePresence } from 'motion/react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { io, Socket } from 'socket.io-client';
import Markdown from 'react-markdown';

interface Adapter {
  id: string;
  name: string;
  mac?: string;
  state?: string;
}

interface WifiNetwork {
  ssid: string;
  bssid: string;
  signal: string;
  security: string;
  channel?: string;
  frequency?: string;
  vendor?: string;
}

const parseSignal = (signalStr: string): number => {
  if (!signalStr || signalStr === 'N/A') return 0;
  if (signalStr.includes('%')) {
    const val = parseInt(signalStr.replace('%', '').trim(), 10);
    return isNaN(val) ? 0 : val;
  }
  if (signalStr.toLowerCase().includes('dbm')) {
    const val = parseInt(signalStr.toLowerCase().replace('dbm', '').trim(), 10);
    if (isNaN(val)) return 0;
    const percentage = 2 * (val + 100);
    return Math.max(0, Math.min(100, Math.round(percentage)));
  }
  const val = parseInt(signalStr.trim(), 10);
  return isNaN(val) ? 0 : val;
};

const getSignalColorClass = (percentage: number) => {
  if (percentage >= 75) return 'text-neon-green bg-neon-green/10 border-neon-green/30 shadow-[0_0_10px_rgba(0,255,65,0.2)]';
  if (percentage >= 40) return 'text-yellow-500 bg-yellow-500/10 border-yellow-500/30 shadow-[0_0_10px_rgba(234,179,8,0.2)]';
  return 'text-red-500 bg-red-500/10 border-red-500/30 shadow-[0_0_10px_rgba(239,68,68,0.2)] animate-pulse';
};

const getSignalColorHex = (percentage: number) => {
  if (percentage >= 75) return '#00ff41'; // neon-green
  if (percentage >= 40) return '#eab308'; // yellow-500
  return '#ef4444'; // red-500
};

export default function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'setup'>('setup');
  const [networks, setNetworks] = useState<WifiNetwork[]>([]);
  const [adapters, setAdapters] = useState<Adapter[]>([]);
  const [selectedAdapter, setSelectedAdapter] = useState<string>('');
  const [isScanning, setIsScanning] = useState(false);
  const [serverStatus, setServerStatus] = useState<'connected' | 'disconnected' | 'checking'>('checking');
  const [copied, setCopied] = useState(false);
  const [backgroundScanning, setBackgroundScanning] = useState(false);
  const [scanInterval, setScanInterval] = useState(30);
  const [uptime, setUptime] = useState(0);

  // Connect Modal State
  const [connectModalOpen, setConnectModalOpen] = useState(false);
  const [connectNetwork, setConnectNetwork] = useState<WifiNetwork | null>(null);
  const [connectPassword, setConnectPassword] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectMessage, setConnectMessage] = useState('');

  // Details Modal State
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [selectedNetworkDetails, setSelectedNetworkDetails] = useState<any>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);

  // AI Chat State
  const [isAiOpen, setIsAiOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiHistory, setAiHistory] = useState<{role: 'user' | 'ai', content: string}[]>([]);
  const [isAiLoading, setIsAiLoading] = useState(false);

  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    // Initialize Socket.IO connection
    const socket = io('http://127.0.0.1:5000', {
      reconnectionAttempts: Infinity,
      reconnectionDelay: 2000,
      timeout: 5000
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setServerStatus('connected');
      fetchServerStatus();
      fetchAdapters();
    });

    socket.on('disconnect', () => {
      setServerStatus('disconnected');
      setBackgroundScanning(false);
    });

    socket.on('networks_updated', (data: { networks: WifiNetwork[], timestamp: number }) => {
      setNetworks(data.networks || []);
    });

    // Fallback polling for status
    const statusInterval = setInterval(fetchServerStatus, 10000);

    return () => {
      socket.disconnect();
      clearInterval(statusInterval);
    };
  }, []);

  useEffect(() => {
    if (serverStatus === 'connected' && activeTab === 'setup') {
      setActiveTab('dashboard');
    }
  }, [serverStatus, activeTab]);

  const fetchServerStatus = async () => {
    try {
      const response = await fetch('http://127.0.0.1:5000/api/status', { signal: AbortSignal.timeout(2000) });
      if (response.ok) {
        const data = await response.json();
        setServerStatus('connected');
        setBackgroundScanning(data.scanning_enabled);
        setScanInterval(data.scan_interval);
        setUptime(data.uptime_seconds);
        if (data.selected_adapter && !selectedAdapter) {
          setSelectedAdapter(data.selected_adapter);
        }
      }
    } catch (e) {
      setServerStatus('disconnected');
    }
  };

  const fetchAdapters = async () => {
    try {
      const response = await fetch('http://127.0.0.1:5000/api/adapters', { signal: AbortSignal.timeout(2000) });
      if (response.ok) {
        const data = await response.json();
        const availableAdapters = data.adapters || [];
        setAdapters(availableAdapters);
        
        if (!selectedAdapter && availableAdapters.length > 0) {
          setSelectedAdapter(availableAdapters[0].id);
        }
      }
    } catch (e) {
      console.error('Failed to fetch adapters', e);
    }
  };

  const handleAdapterChange = async (newAdapter: string) => {
    setSelectedAdapter(newAdapter);
    try {
      await fetch('http://127.0.0.1:5000/api/adapter/select', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adapterId: newAdapter })
      });
      handleScan(newAdapter, true);
    } catch (e) {
      console.error('Failed to select adapter', e);
    }
  };

  const handleScan = async (adapterIdToUse?: string, force = true) => {
    setIsScanning(true);
    try {
      if (serverStatus !== 'connected') return;

      const id = adapterIdToUse || selectedAdapter;
      const res = await fetch('http://127.0.0.1:5000/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adapterId: id, force })
      });
      const data = await res.json();
      setNetworks(data.networks || []);
    } catch (error) {
      console.error('Failed to fetch networks:', error);
    } finally {
      setIsScanning(false);
    }
  };

  const toggleBackgroundScan = async () => {
    try {
      const endpoint = backgroundScanning ? '/api/scan/stop' : '/api/scan/start';
      const res = await fetch(`http://127.0.0.1:5000${endpoint}`, { method: 'POST' });
      if (res.ok) {
        setBackgroundScanning(!backgroundScanning);
      }
    } catch (error) {
      console.error('Failed to toggle background scan:', error);
    }
  };

  const handleConnectClick = (net: WifiNetwork) => {
    setConnectNetwork(net);
    setConnectPassword('');
    setConnectMessage('');
    setConnectModalOpen(true);
  };

  const handleConnectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!connectNetwork) return;

    setIsConnecting(true);
    setConnectMessage('Attempting to connect... This may take up to 30 seconds.');
    try {
      const res = await fetch('http://127.0.0.1:5000/api/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ssid: connectNetwork.ssid,
          password: connectPassword,
          adapter: selectedAdapter
        })
      });
      const data = await res.json();
      if (data.success) {
        setConnectMessage(`Successfully connected to ${connectNetwork.ssid}!`);
        setTimeout(() => setConnectModalOpen(false), 2000);
      } else {
        setConnectMessage(`Failed: ${data.message}`);
      }
    } catch (error) {
      setConnectMessage('Error connecting to the agent.');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleNetworkClick = async (net: WifiNetwork) => {
    setDetailsModalOpen(true);
    setSelectedNetworkDetails({ ...net, clients: null, note: null }); // basic info while loading
    setIsLoadingDetails(true);
    try {
      const res = await fetch(`http://127.0.0.1:5000/api/network/details?bssid=${encodeURIComponent(net.bssid)}&ssid=${encodeURIComponent(net.ssid)}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedNetworkDetails(data);
      }
    } catch (e) {
      console.error('Failed to fetch details:', e);
    } finally {
      setIsLoadingDetails(false);
    }
  };

  const handleAiSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiPrompt.trim()) return;

    const userMessage = aiPrompt;
    setAiPrompt('');
    setAiHistory(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsAiLoading(true);

    try {
      const res = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: userMessage,
          networkData: networks
        })
      });
      
      const data = await res.json();
      
      if (res.ok) {
        setAiHistory(prev => [...prev, { role: 'ai', content: data.answer }]);
      } else {
        setAiHistory(prev => [...prev, { role: 'ai', content: `Error: ${data.error}` }]);
      }
    } catch (error) {
      setAiHistory(prev => [...prev, { role: 'ai', content: 'Connection to AI service failed.' }]);
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(getPythonAgentCode());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadCode = () => {
    const code = getPythonAgentCode();
    const blob = new Blob([code], { type: 'text/x-python' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'p4nth0m_agent.py';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCopyCommand = (os: string) => {
    let cmd = "";
    if (os === "windows") cmd = "python p4nth0m_agent.py";
    else cmd = "python3 p4nth0m_agent.py";
    navigator.clipboard.writeText(cmd);
    alert(`Copied command for ${os}`);
  };

  const formatUptime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  };

  // Process data for charts
  const parsedNetworks = useMemo(() => {
    return networks
      .map(net => ({
        ...net,
        displayName: net.ssid || 'Hidden Network',
        signalPercent: parseSignal(net.signal)
      }))
      .sort((a, b) => b.signalPercent - a.signalPercent);
  }, [networks]);

  const topNetworks = useMemo(() => parsedNetworks.slice(0, 7), [parsedNetworks]);
  const openNetworks = useMemo(() => parsedNetworks.filter(n => n.security.toLowerCase() === 'open'), [parsedNetworks]);
  const strongestNetwork = parsedNetworks[0] || null;

  return (
    <div className="min-h-screen bg-black text-neon-blue/80 font-sans selection:bg-neon-green/30 relative overflow-hidden">
      {/* Global Scanline Effect */}
      <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
        <div className="w-full h-8 bg-gradient-to-b from-transparent via-neon-green/5 to-transparent opacity-50 animate-scanline"></div>
      </div>
      {/* Dynamic Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-neon-green/5 blur-[120px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-neon-blue/5 blur-[120px]"></div>
      </div>

      <header className="relative z-10 border-b border-neon-green/30 bg-black/80 backdrop-blur-xl px-6 py-4 flex items-center justify-between sticky top-0 shadow-[0_4px_40px_rgba(0,255,65,0.1)]">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-black rounded-xl text-neon-green shadow-[0_0_25px_rgba(0,255,65,0.6)] border-2 border-neon-green/60 animate-pulse-glow relative group overflow-hidden flex items-center justify-center p-1">
            <div className="absolute inset-0 bg-neon-green/20 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <div className="absolute top-0 left-0 w-full h-0.5 bg-neon-green/80 animate-scanline"></div>
            <img src="/logo.svg" alt="P4NTH0MC0R3 Logo" className="w-full h-full relative z-10 animate-glitch group-hover:scale-110 transition-transform object-contain" />
          </div>
          <div>
            <h1 className="text-3xl font-black tracking-tighter text-white flex items-center gap-2 font-mono group cursor-default">
              <span className="group-hover:animate-glitch-text transition-all drop-shadow-[0_0_10px_rgba(255,255,255,0.8)]">P4NTH0M</span>
              <span className="text-neon-green group-hover:animate-glitch-text transition-all drop-shadow-[0_0_15px_rgba(0,255,65,0.9)]">C0R3</span>
              <span className="px-2 py-0.5 ml-2 rounded-none bg-neon-green/20 text-neon-green text-[10px] font-mono tracking-widest border border-neon-green/50 animate-pulse shadow-[0_0_10px_rgba(0,255,65,0.5)] hidden sm:inline-block">OVERRIDE</span>
            </h1>
          </div>
        </div>
        
        <div className="flex items-center gap-6">
          <div className="hidden md:flex bg-black/40 p-1 rounded-xl border border-neon-green/20 shadow-[0_0_10px_rgba(0,255,65,0.05)]">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`flex items-center gap-2 px-4 py-1.5 text-sm font-mono font-medium rounded-lg transition-all duration-300 ${activeTab === 'dashboard' ? 'bg-neon-green/20 text-neon-green shadow-sm border border-neon-green/30' : 'text-neon-green/40 hover:text-neon-green/70'}`}
            >
              <LayoutDashboard size={16} />
              SYS_TELEMETRY
            </button>
            <button
              onClick={() => setActiveTab('setup')}
              className={`flex items-center gap-2 px-4 py-1.5 text-sm font-mono font-medium rounded-lg transition-all duration-300 ${activeTab === 'setup' ? 'bg-neon-green/20 text-neon-green shadow-sm border border-neon-green/30' : 'text-neon-green/40 hover:text-neon-green/70'}`}
            >
              <Terminal size={16} />
              AGENT_DEPLOY
            </button>
          </div>

          <div className="flex items-center gap-3">
            {serverStatus === 'connected' && uptime > 0 && (
              <span className="text-xs font-mono text-neon-blue/70 hidden sm:inline-block">
                UPTIME: {formatUptime(uptime)}
              </span>
            )}
            <div className={`flex items-center gap-2.5 text-xs font-mono px-3 py-1.5 rounded-lg border shadow-[0_0_10px_rgba(0,0,0,0.5)] ${serverStatus === 'connected' ? 'bg-neon-green/10 text-neon-green border-neon-green/30' : serverStatus === 'checking' ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/30' : 'bg-red-500/10 text-red-500 border-red-500/30'}`}>
              <div className="relative flex h-2 w-2">
                {(serverStatus === 'connected' || serverStatus === 'checking') && (
                  <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${serverStatus === 'connected' ? 'bg-neon-green' : 'bg-yellow-500'}`}></span>
                )}
                <span className={`relative inline-flex rounded-full h-2 w-2 ${serverStatus === 'connected' ? 'bg-neon-green' : serverStatus === 'checking' ? 'bg-yellow-500' : 'bg-red-500'}`}></span>
              </div>
              {serverStatus === 'connected' ? 'SYS_ONLINE' : serverStatus === 'checking' ? 'HANDSHAKE' : 'SYS_OFFLINE'}
            </div>
          </div>
        </div>
      </header>

      <main className="relative z-10 max-w-7xl mx-auto p-6 mt-4 pb-20">
        <AnimatePresence mode="wait">
          {activeTab === 'dashboard' ? (
            <motion.div 
              key="dashboard"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
              className="space-y-6"
            >
              {/* Top Controls */}
              <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-black/80 border border-neon-green/20 p-4 rounded-xl backdrop-blur-md shadow-[inset_0_0_20px_rgba(0,255,65,0.02)] relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-neon-green/50"></div>
                <div>
                  <h2 className="text-lg font-bold text-white font-mono tracking-wide uppercase">SIGINT <span className="text-neon-green font-light">ANALYSIS</span></h2>
                  <p className="text-neon-blue/70 text-sm mt-0.5 font-mono tracking-widest">Real-time local 802.11 environment telemetry.</p>
                </div>
                <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
                  <div className="relative w-full sm:w-auto min-w-[200px]">
                    <select 
                      value={selectedAdapter}
                      onChange={(e) => handleAdapterChange(e.target.value)}
                      className="w-full appearance-none bg-black border border-neon-green/30 text-neon-green font-mono text-sm rounded-lg px-4 py-2.5 pr-10 outline-none focus:border-neon-green focus:ring-1 focus:ring-neon-green/50 transition-all cursor-pointer hover:bg-neon-green/5 shadow-[0_0_10px_rgba(0,255,65,0.05)]"
                      disabled={serverStatus !== 'connected'}
                    >
                      {adapters.length === 0 ? (
                        <option value="">Awaiting Adapters...</option>
                      ) : (
                        adapters.map(adapter => (
                          <option key={adapter.id} value={adapter.id} className="bg-black text-neon-green font-mono">
                            {adapter.name} {adapter.mac && adapter.mac !== 'Unknown' ? `[${adapter.mac}]` : ''}
                          </option>
                        ))
                      )}
                    </select>
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-neon-green/50">
                      <ChevronDown size={16} />
                    </div>
                  </div>

                  <button
                    onClick={toggleBackgroundScan}
                    disabled={serverStatus !== 'connected'}
                    className={`group relative flex items-center gap-2 px-5 py-2.5 rounded-lg font-mono font-bold text-sm disabled:opacity-50 transition-all active:scale-95 overflow-hidden whitespace-nowrap shadow-[0_0_10px_rgba(0,0,0,0.5)] ${backgroundScanning ? 'bg-red-500/10 text-red-500 border border-red-500/30 hover:bg-red-500/20' : 'bg-black text-white border border-neon-green/30 hover:bg-neon-green/10 hover:border-neon-green/50 hover:text-neon-green'}`}
                  >
                    {backgroundScanning ? (
                      <><Square size={14} className="fill-current" /> STOP_AUTOCAST</>
                    ) : (
                      <><Play size={14} className="fill-current text-neon-green group-hover:animate-pulse" /> START_AUTOCAST</>
                    )}
                  </button>

                  <button
                    onClick={() => handleScan(selectedAdapter, true)}
                    disabled={isScanning || serverStatus !== 'connected'}
                    className="group relative flex items-center gap-2 px-6 py-2.5 bg-neon-green/10 text-neon-green border border-neon-green/40 hover:bg-neon-green/20 hover:border-neon-green hover:shadow-[0_0_15px_rgba(0,255,65,0.3)] rounded-lg font-mono font-bold text-sm disabled:opacity-50 transition-all active:scale-95 overflow-hidden whitespace-nowrap"
                  >
                    {isScanning && <div className="absolute inset-0 bg-neon-green/10 animate-pulse"></div>}
                    <RefreshCw size={16} className={isScanning ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-500'} />
                    {isScanning ? 'POLLING...' : 'FORCE_SCAN'}
                  </button>
                </div>
              </div>

              {parsedNetworks.length > 0 ? (
                <>
                  {/* Stats Row */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <motion.div initial={{opacity: 0, scale: 0.95}} animate={{opacity: 1, scale: 1}} transition={{delay: 0.1}} className="bg-black border border-neon-green/20 p-5 rounded-xl relative overflow-hidden group shadow-[0_0_15px_rgba(0,255,65,0.02)] hover:border-neon-green/50 transition-all">
                      <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity text-neon-green">
                        <Wifi size={64} />
                      </div>
                      <div className="flex justify-between items-start mb-4 relative z-10">
                        <div className="p-2 bg-neon-green/10 text-neon-green border border-neon-green/20 rounded-lg"><Wifi size={18} /></div>
                        <span className="text-2xl font-bold text-white font-mono">{parsedNetworks.length}</span>
                      </div>
                      <p className="text-neon-blue/70 text-sm relative z-10 font-mono tracking-widest uppercase">TOTAL_NETWORKS</p>
                    </motion.div>
                    
                    <motion.div initial={{opacity: 0, scale: 0.95}} animate={{opacity: 1, scale: 1}} transition={{delay: 0.15}} className="bg-black border border-neon-blue/20 p-5 rounded-xl relative overflow-hidden group shadow-[0_0_15px_rgba(0,240,255,0.02)] hover:border-neon-blue/50 transition-all">
                      <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity text-neon-blue">
                        <Zap size={64} />
                      </div>
                      <div className="flex justify-between items-start mb-4 relative z-10">
                        <div className="p-2 bg-neon-blue/10 text-neon-blue border border-neon-blue/20 rounded-lg"><Zap size={18} /></div>
                        <span className="text-2xl font-bold text-white font-mono">{strongestNetwork ? strongestNetwork.signalPercent + '%' : 'N/A'}</span>
                      </div>
                      <p className="text-neon-blue/70 text-sm relative z-10 font-mono tracking-widest uppercase">PEAK_SIGNAL</p>
                    </motion.div>

                    <motion.div initial={{opacity: 0, scale: 0.95}} animate={{opacity: 1, scale: 1}} transition={{delay: 0.2}} className="bg-black border border-purple-500/20 p-5 rounded-xl relative overflow-hidden group shadow-[0_0_15px_rgba(168,85,247,0.02)] hover:border-purple-500/50 transition-all">
                      <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity text-purple-400">
                        <Lock size={64} />
                      </div>
                      <div className="flex justify-between items-start mb-4 relative z-10">
                        <div className="p-2 bg-purple-500/10 text-purple-400 border border-purple-500/20 rounded-lg"><Lock size={18} /></div>
                        <span className="text-2xl font-bold text-white font-mono">{parsedNetworks.length - openNetworks.length}</span>
                      </div>
                      <p className="text-purple-400/70 text-sm relative z-10 font-mono tracking-widest uppercase">SECURED_NETS</p>
                    </motion.div>

                    <motion.div initial={{opacity: 0, scale: 0.95}} animate={{opacity: 1, scale: 1}} transition={{delay: 0.25}} className="bg-black border border-red-500/20 p-5 rounded-xl relative overflow-hidden group shadow-[0_0_15px_rgba(239,68,68,0.02)] hover:border-red-500/50 transition-all">
                      <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity text-red-500">
                        <Unlock size={64} />
                      </div>
                      <div className="flex justify-between items-start mb-4 relative z-10">
                        <div className="p-2 bg-red-500/10 text-red-500 border border-red-500/20 rounded-lg"><Unlock size={18} /></div>
                        <span className="text-2xl font-bold text-white font-mono">{openNetworks.length}</span>
                      </div>
                      <p className="text-red-400/70 text-sm relative z-10 font-mono tracking-widest uppercase">VULNERABLE_NETS</p>
                    </motion.div>
                  </div>

                  {/* Chart Section */}
                  <motion.div initial={{opacity: 0, y: 20}} animate={{opacity: 1, y: 0}} transition={{delay: 0.3}} className="bg-black border border-neon-green/20 p-6 rounded-xl relative shadow-[inset_0_0_30px_rgba(0,255,65,0.02)]">
                    <div className="absolute top-0 right-0 w-full h-full bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-neon-green/5 via-transparent to-transparent pointer-events-none"></div>
                    <div className="flex items-center justify-between mb-6 relative z-10">
                      <div className="flex items-center gap-2">
                        <BarChart3 size={18} className="text-neon-green" />
                        <h3 className="font-bold text-white font-mono tracking-widest uppercase">SIGNAL_TOPOGRAPHY</h3>
                      </div>
                      <div className="text-xs font-mono text-neon-green/50 flex items-center gap-3 tracking-widest">
                        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-neon-green shadow-[0_0_5px_rgba(0,255,65,0.8)]"></span> OPTIMAL</span>
                        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-yellow-500 shadow-[0_0_5px_rgba(234,179,8,0.8)]"></span> DEGRADED</span>
                        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_5px_rgba(239,68,68,0.8)]"></span> CRITICAL</span>
                      </div>
                    </div>
                    <div className="h-[250px] w-full relative z-10">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={topNetworks} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#00ff4120" vertical={false} />
                          <XAxis dataKey="displayName" stroke="#00ff4160" fontSize={12} tickLine={false} axisLine={false} fontFamily="monospace" />
                          <YAxis stroke="#00ff4160" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `${val}%`} fontFamily="monospace" />
                          <Tooltip 
                            cursor={{ fill: '#00ff4110' }}
                            contentStyle={{ backgroundColor: '#000000', border: '1px solid #00ff4140', borderRadius: '4px', fontFamily: 'monospace' }}
                            itemStyle={{ color: '#00ff41' }}
                            formatter={(value: number, name: string, props: any) => [`${value}% (${props.payload.signal})`, 'SIGNAL']}
                          />
                          <Bar dataKey="signalPercent" radius={[4, 4, 0, 0]} maxBarSize={60}>
                            {topNetworks.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={getSignalColorHex(entry.signalPercent)} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </motion.div>

                  {/* Network List Grid */}
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-bold text-white font-mono tracking-widest uppercase flex items-center gap-2">
                        <Database size={18} className="text-neon-green" />
                        DETECTED_NODES
                      </h3>
                      <span className="text-xs text-neon-green/50 font-mono">SORT: SIGNAL_DESC</span>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                      {parsedNetworks.map((net, i) => (
                        <motion.div 
                          initial={{opacity: 0, scale: 0.95}} 
                          animate={{opacity: 1, scale: 1}} 
                          transition={{delay: 0.05 * Math.min(i, 15)}}
                          key={`${net.bssid}-${i}`} 
                          onClick={() => handleNetworkClick(net)}
                          className="group relative bg-black border border-neon-green/20 rounded-xl p-5 hover:bg-neon-green/5 hover:border-neon-green/50 transition-all overflow-hidden flex flex-col justify-between cursor-pointer shadow-[0_0_10px_rgba(0,255,65,0.02)]"
                        >
                          <div className="absolute top-0 right-0 w-32 h-32 bg-neon-green/10 rounded-full blur-[50px] -mr-16 -mt-16 transition-opacity group-hover:opacity-100 opacity-0 pointer-events-none"></div>
                          
                          <div className="flex justify-between items-start mb-5 relative z-10">
                            <div className="flex items-start gap-3">
                              <div className="mt-1">
                                {net.security.toLowerCase() === 'open' ? (
                                  <Unlock size={18} className="text-red-500 animate-pulse" />
                                ) : (
                                  <Lock size={18} className="text-neon-green/50" />
                                )}
                              </div>
                              <div>
                                <h3 className={`font-bold text-lg leading-tight font-mono truncate max-w-[150px] ${net.security.toLowerCase() === 'open' ? 'text-red-400' : 'text-white'}`}>
                                  {net.ssid || '<HIDDEN>'}
                                </h3>
                                <p className="text-xs text-neon-blue/70 font-mono mt-1 flex items-center gap-1.5 opacity-80">
                                  <Fingerprint size={12} />
                                  {net.bssid}
                                </p>
                              </div>
                            </div>
                            <div className={`flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-md border ${getSignalColorClass(net.signalPercent)}`}>
                              <Signal size={12} />
                              {net.signalPercent}%
                            </div>
                          </div>
                          
                          <div className="space-y-3 relative z-10">
                            <div>
                              <div className="flex justify-between text-xs mb-1.5 font-mono tracking-widest">
                                <span className="text-neon-green/50">SIGNAL_STRENGTH</span>
                                <span className="text-neon-green">{net.signal}</span>
                              </div>
                              <div className="h-1.5 w-full bg-black/50 rounded-full overflow-hidden border border-neon-green/10">
                                <motion.div 
                                  initial={{ width: 0 }}
                                  animate={{ width: `${net.signalPercent}%` }}
                                  transition={{ duration: 1, delay: 0.2 }}
                                  className="h-full rounded-full shadow-[0_0_10px_rgba(0,255,65,0.8)]"
                                  style={{ backgroundColor: getSignalColorHex(net.signalPercent) }}
                                ></motion.div>
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2 text-xs pt-3 border-t border-neon-green/20">
                              <div>
                                <span className="text-neon-green/50 block mb-1 font-mono uppercase tracking-widest">ENCRYPTION</span>
                                <span className={`font-mono ${net.security.toLowerCase() === 'open' ? 'text-red-500 drop-shadow-[0_0_5px_rgba(239,68,68,0.5)]' : 'text-neon-blue'} truncate block`} title={net.security}>
                                  {net.security}
                                </span>
                              </div>
                              <div>
                                <span className="text-neon-green/50 block mb-1 font-mono uppercase tracking-widest">FREQUENCY</span>
                                <span className="font-mono text-neon-blue block truncate">
                                  {net.channel && net.channel !== 'N/A' ? `CH_${net.channel}` : 'N/A'} {net.frequency ? `[${net.frequency}]` : ''}
                                </span>
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                              <div>
                                <span className="text-neon-green/50 block mb-1 font-mono uppercase tracking-widest">HARDWARE</span>
                                <span className="font-mono text-white block truncate opacity-80" title={net.vendor || 'Unknown'}>
                                  {net.vendor || 'UNKNOWN_OUI'}
                                </span>
                              </div>
                              <div className="flex items-end justify-end">
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleConnectClick(net);
                                  }}
                                  className="text-[10px] uppercase tracking-widest font-bold text-black hover:text-black bg-neon-green hover:bg-white px-2 py-1 rounded transition-colors shadow-[0_0_10px_rgba(0,255,65,0.2)]"
                                >
                                  INJECT
                                </button>
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center py-20 px-4 bg-black border border-neon-green/30 border-dashed rounded-xl shadow-[inset_0_0_50px_rgba(0,255,65,0.02)]">
                  <div className="p-4 bg-neon-green/10 rounded-full mb-4 shadow-[0_0_20px_rgba(0,255,65,0.1)]">
                    <Radio size={32} className="text-neon-green animate-pulse" />
                  </div>
                  <h3 className="text-neon-green font-bold text-lg mb-2 font-mono tracking-widest uppercase">SPECTRUM_CLEAR</h3>
                  <p className="text-zinc-400 text-sm text-center max-w-sm font-mono">
                    No active 802.11 transmissions detected in your immediate environment. Initiate telemetry scan.
                  </p>
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div 
              key="setup"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
            >
              <div className="bg-black border border-neon-green/30 rounded-xl overflow-hidden shadow-[0_0_30px_rgba(0,255,65,0.05)] relative">
                {/* Decorative Terminal Header */}
                <div className="h-10 bg-neon-green/10 border-b border-neon-green/30 flex items-center px-4 gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500/80"></div>
                  <div className="w-3 h-3 rounded-full bg-yellow-500/80"></div>
                  <div className="w-3 h-3 rounded-full bg-neon-green/80 shadow-[0_0_5px_rgba(0,255,65,0.5)]"></div>
                  <span className="text-xs text-neon-green/70 font-mono ml-4 tracking-widest">root@SYS_CORE:~</span>
                </div>

                <div className="p-8 md:p-10 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-neon-green/5 rounded-full blur-[100px] pointer-events-none"></div>
                  <div className="flex items-center gap-4 mb-6 relative z-10">
                    <div className="bg-black text-neon-green p-3 rounded-xl border-2 border-neon-green/50 shadow-[0_0_20px_rgba(0,255,65,0.4)] relative overflow-hidden group">
                      <div className="absolute inset-0 bg-neon-green/20 animate-pulse"></div>
                      <Ghost size={32} className="relative z-10 drop-shadow-[0_0_8px_rgba(0,255,65,1)] group-hover:animate-glitch" />
                    </div>
                    <div>
                      <h2 className="text-3xl font-black text-white font-mono uppercase tracking-tighter drop-shadow-[0_0_10px_rgba(255,255,255,0.5)]">
                        <span className="text-neon-green group-hover:animate-glitch-text">P4NTH0MC0R3</span>_AGENT <span className="text-neon-green/50 font-light">DEPLOYMENT</span>
                      </h2>
                      <p className="text-neon-blue/80 mt-1 font-mono text-sm tracking-wide">Deploy the highly-classified telemetry bridge to expose physical interfaces to this dashboard.</p>
                    </div>
                  </div>
                  
                  <div className="space-y-8 mt-10">
                    <div className="relative">
                      <div className="absolute left-0 top-0 bottom-0 w-px bg-neon-green/30"></div>
                      
                      <div className="relative pl-8 pb-8">
                        <div className="absolute left-[-5px] top-1 w-2.5 h-2.5 rounded-full bg-neon-green shadow-[0_0_10px_rgba(0,255,65,0.8)] ring-4 ring-black"></div>
                        <h3 className="text-sm font-bold tracking-widest text-neon-green font-mono uppercase mb-3">PHASE_1: DEPENDENCIES</h3>
                        <p className="text-sm text-neon-blue/70 mb-4 font-mono">Ensure Python 3 is installed, then install required telemetry packages.</p>
                        <div className="bg-black border border-neon-green/30 rounded-xl p-4 font-mono text-sm text-white shadow-[inset_0_0_20px_rgba(0,255,65,0.05)] flex items-center gap-3 overflow-x-auto">
                          <ArrowRight size={14} className="text-neon-green shrink-0 animate-pulse" />
                          <span className="whitespace-nowrap">pip install flask flask-cors flask-socketio</span>
                        </div>
                      </div>

                      <div className="relative pl-8 pb-8">
                        <div className="absolute left-[-5px] top-1 w-2.5 h-2.5 rounded-full bg-neon-green shadow-[0_0_10px_rgba(0,255,65,0.8)] ring-4 ring-black"></div>
                        <h3 className="text-sm font-bold tracking-widest text-neon-green font-mono uppercase mb-3">PHASE_2: DEPLOY_SCRIPT</h3>
                        <p className="text-sm text-neon-blue/70 mb-4 font-mono">Save and execute the agent script on your target machine.</p>
                        
                        <div className="border border-neon-green/30 rounded-xl overflow-hidden bg-black shadow-[0_0_20px_rgba(0,255,65,0.05)]">
                          <div className="bg-neon-green/10 border-b border-neon-green/30 px-4 py-3 flex items-center justify-between">
                            <span className="text-xs font-mono text-neon-green flex items-center gap-2">
                              p4nth0m_agent.py
                            </span>
                            <div className="flex gap-2">
                              <button 
                                onClick={handleDownloadCode}
                                className="group flex items-center gap-1.5 text-xs font-medium text-white bg-black hover:bg-neon-green/10 border border-neon-green/30 px-3 py-1.5 rounded-lg transition-all"
                              >
                                <Download size={14} className="text-neon-green/70 group-hover:text-neon-green" />
                                <span className="text-neon-green/70 group-hover:text-neon-green">DOWNLOAD .PY</span>
                              </button>
                              <button 
                                onClick={handleCopyCode}
                                className="group flex items-center gap-1.5 text-xs font-medium text-white bg-black hover:bg-neon-green/10 border border-neon-green/30 px-3 py-1.5 rounded-lg transition-all"
                              >
                                {copied ? <Check size={14} className="text-neon-green" /> : <Copy size={14} className="text-neon-green/70 group-hover:text-neon-green" />}
                                <span className={copied ? "text-neon-green" : "text-neon-green/70 group-hover:text-neon-green"}>{copied ? 'COPIED' : 'COPY'}</span>
                              </button>
                            </div>
                          </div>
                          <div className="p-5 overflow-x-auto max-h-[400px] custom-scrollbar">
                            <pre className="font-mono text-xs text-neon-blue/80 leading-relaxed">
                              {getPythonAgentCode()}
                            </pre>
                          </div>
                        </div>
                      </div>

                      <div className="relative pl-8">
                        <div className="absolute left-[-5px] top-1 w-2.5 h-2.5 rounded-full bg-neon-green shadow-[0_0_10px_rgba(0,255,65,0.8)] ring-4 ring-black"></div>
                        <h3 className="text-sm font-bold tracking-widest text-neon-green font-mono uppercase mb-3">PHASE_3: EXECUTION</h3>
                        <p className="text-sm text-neon-blue/70 mb-4 font-mono">Run the agent script. Dependencies are auto-installed. The dashboard will connect automatically via WebSockets.</p>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* Linux / macOS */}
                          <div className="bg-black border border-neon-green/30 rounded-xl p-4 shadow-[inset_0_0_20px_rgba(0,255,65,0.05)] relative group">
                             <div className="flex justify-between items-center mb-2">
                                <span className="text-xs text-neon-green/70 font-mono tracking-widest">LINUX / MACOS</span>
                                <button onClick={() => handleCopyCommand('linux')} className="text-neon-blue/50 hover:text-neon-blue transition-colors">
                                  <Copy size={14} />
                                </button>
                             </div>
                             <div className="font-mono text-sm text-white flex items-center gap-2">
                               <ArrowRight size={14} className="text-neon-green shrink-0" />
                               <span className="whitespace-nowrap">python3 p4nth0m_agent.py</span>
                             </div>
                          </div>

                          {/* Windows */}
                          <div className="bg-black border border-neon-green/30 rounded-xl p-4 shadow-[inset_0_0_20px_rgba(0,255,65,0.05)] relative group">
                             <div className="flex justify-between items-center mb-2">
                                <span className="text-xs text-neon-green/70 font-mono tracking-widest">WINDOWS</span>
                                <button onClick={() => handleCopyCommand('windows')} className="text-neon-blue/50 hover:text-neon-blue transition-colors">
                                  <Copy size={14} />
                                </button>
                             </div>
                             <div className="font-mono text-sm text-white flex items-center gap-2">
                               <ArrowRight size={14} className="text-neon-green shrink-0" />
                               <span className="whitespace-nowrap">python p4nth0m_agent.py</span>
                             </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <AnimatePresence>
                      {serverStatus === 'connected' ? (
                        <motion.div 
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className="bg-neon-green/10 border border-neon-green/30 rounded-xl p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4 mt-8 shadow-[0_0_15px_rgba(0,255,65,0.1)] relative overflow-hidden"
                        >
                          <div className="absolute top-0 right-0 p-4 opacity-10">
                            <Wifi size={100} className="text-neon-green" />
                          </div>
                          <div className="p-3 bg-neon-green/20 rounded-full text-neon-green shrink-0 relative z-10">
                            <Check size={24} />
                          </div>
                          <div className="flex-1 relative z-10">
                            <h4 className="font-bold text-white font-mono tracking-widest mb-1 text-neon-green">TELEMETRY_LINK_ESTABLISHED</h4>
                            <p className="text-sm text-neon-green/60 leading-relaxed font-mono">
                              P4nth0mAgent is running and active. Telemetry pipeline is established.
                            </p>
                          </div>
                          <button
                            onClick={() => setActiveTab('dashboard')}
                            className="px-4 py-2 bg-neon-green text-black font-bold font-mono tracking-wider text-sm rounded-lg hover:bg-white transition-colors whitespace-nowrap shadow-[0_0_15px_rgba(0,255,65,0.3)] relative z-10"
                          >
                            ACCESS_RADAR
                          </button>
                        </motion.div>
                      ) : (
                        <motion.div 
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className="bg-black border border-yellow-500/30 rounded-xl p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4 mt-8 shadow-[0_0_15px_rgba(245,158,11,0.05)]"
                        >
                          <div className="p-3 bg-yellow-500/10 rounded-full text-yellow-500 shrink-0">
                            <Activity size={24} className="animate-pulse" />
                          </div>
                          <div>
                            <h4 className="font-bold text-yellow-500 font-mono tracking-widest mb-1">AWAITING_CONNECTION</h4>
                            <p className="text-sm text-yellow-500/70 font-mono leading-relaxed">
                              Run the agent script and wait for the handshake...
                            </p>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Connect Modal */}
      <AnimatePresence>
        {connectModalOpen && connectNetwork && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/80 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-black border border-neon-green/30 rounded-xl p-6 w-full max-w-md shadow-[0_0_50px_rgba(0,255,65,0.1)] relative"
            >
              <button 
                onClick={() => setConnectModalOpen(false)}
                className="absolute top-4 right-4 text-neon-green/50 hover:text-neon-green transition-colors"
              >
                <X size={20} />
              </button>
              
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2.5 bg-neon-green/10 text-neon-green rounded-lg border border-neon-green/20">
                  <Wifi size={20} className="animate-pulse" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white font-mono tracking-widest uppercase">ESTABLISH_LINK</h3>
                  <p className="text-xs text-neon-blue/70 font-mono">{connectNetwork.bssid}</p>
                </div>
              </div>

              <form onSubmit={handleConnectSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-neon-green mb-1.5 font-mono tracking-widest">TARGET_SSID</label>
                  <input 
                    type="text" 
                    value={connectNetwork.ssid} 
                    disabled
                    className="w-full bg-black border border-neon-green/20 rounded-lg px-4 py-3 text-white text-sm font-mono cursor-not-allowed opacity-70"
                  />
                </div>

                {connectNetwork.security.toLowerCase() !== 'open' && (
                  <div>
                    <label className="block text-xs font-bold text-neon-green mb-1.5 font-mono tracking-widest">DECRYPTION_KEY</label>
                    <div className="relative">
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-neon-green/50">
                        <Key size={16} />
                      </div>
                      <input 
                        type="password" 
                        value={connectPassword}
                        onChange={(e) => setConnectPassword(e.target.value)}
                        placeholder="Enter decryption key"
                        className="w-full bg-black/40 border border-neon-green/30 focus:border-neon-green focus:ring-1 focus:ring-neon-green rounded-lg pl-11 pr-4 py-3 text-neon-green text-sm font-mono outline-none transition-all placeholder:text-neon-green/30 shadow-[inset_0_0_10px_rgba(0,255,65,0.05)]"
                        required
                        autoFocus
                      />
                    </div>
                  </div>
                )}

                {connectMessage && (
                  <div className={`p-3 rounded-lg text-sm font-mono border ${connectMessage.includes('Success') ? 'bg-neon-green/10 text-neon-green border-neon-green/30 shadow-[0_0_10px_rgba(0,255,65,0.1)]' : connectMessage.includes('Attempting') ? 'bg-neon-blue/10 text-neon-blue border-neon-blue/30' : 'bg-red-500/10 text-red-500 border-red-500/30 shadow-[0_0_10px_rgba(239,68,68,0.1)]'}`}>
                    {connectMessage}
                  </div>
                )}

                <div className="pt-4 flex gap-3">
                  <button 
                    type="button"
                    onClick={() => setConnectModalOpen(false)}
                    className="flex-1 px-4 py-2.5 rounded-lg border border-neon-green/30 text-neon-green/70 font-mono tracking-widest text-sm hover:text-neon-green hover:bg-neon-green/5 transition-colors"
                  >
                    ABORT
                  </button>
                  <button 
                    type="submit"
                    disabled={isConnecting}
                    className="flex-1 px-4 py-2.5 rounded-lg bg-neon-green hover:bg-white text-black font-bold font-mono tracking-widest text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:bg-neon-green/50 shadow-[0_0_15px_rgba(0,255,65,0.2)]"
                  >
                    {isConnecting ? <RefreshCw size={16} className="animate-spin" /> : null}
                    {isConnecting ? 'INJECTING...' : 'EXECUTE'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Details Modal */}
      <AnimatePresence>
        {detailsModalOpen && selectedNetworkDetails && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/80 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-black border border-neon-green/30 rounded-xl p-6 w-full max-w-2xl shadow-[0_0_50px_rgba(0,255,65,0.1)] relative max-h-[90vh] overflow-y-auto custom-scrollbar"
            >
              <button 
                onClick={() => setDetailsModalOpen(false)}
                className="absolute top-4 right-4 text-neon-green/50 hover:text-neon-green transition-colors"
              >
                <X size={20} />
              </button>
              
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2.5 bg-neon-green/10 text-neon-green rounded-lg border border-neon-green/20">
                  <Activity size={20} className="animate-pulse" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white font-mono">{selectedNetworkDetails.ssid || '<HIDDEN_SSID>'}</h3>
                  <p className="text-xs text-neon-blue/70 font-mono">{selectedNetworkDetails.bssid}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-neon-green/5 border border-neon-green/20 p-4 rounded-lg shadow-[inset_0_0_10px_rgba(0,255,65,0.02)]">
                  <span className="text-xs text-neon-green/50 font-mono tracking-widest block mb-1">SIGNAL_STRENGTH</span>
                  <span className="font-mono text-neon-green font-bold text-lg">{selectedNetworkDetails.signal}</span>
                </div>
                <div className="bg-neon-green/5 border border-neon-green/20 p-4 rounded-lg shadow-[inset_0_0_10px_rgba(0,255,65,0.02)]">
                  <span className="text-xs text-neon-green/50 font-mono tracking-widest block mb-1">ENCRYPTION</span>
                  <span className="font-mono text-neon-green font-bold text-lg">{selectedNetworkDetails.security}</span>
                </div>
                <div className="bg-neon-green/5 border border-neon-green/20 p-4 rounded-lg shadow-[inset_0_0_10px_rgba(0,255,65,0.02)]">
                  <span className="text-xs text-neon-green/50 font-mono tracking-widest block mb-1">CH_FREQUENCY</span>
                  <span className="font-mono text-neon-green font-bold text-lg">{selectedNetworkDetails.channel || 'N/A'}</span>
                </div>
                <div className="bg-neon-green/5 border border-neon-green/20 p-4 rounded-lg shadow-[inset_0_0_10px_rgba(0,255,65,0.02)]">
                  <span className="text-xs text-neon-green/50 font-mono tracking-widest block mb-1">HARDWARE_MFR</span>
                  <span className="font-mono text-neon-green font-bold truncate block" title={selectedNetworkDetails.vendor}>{selectedNetworkDetails.vendor || 'UNKNOWN'}</span>
                </div>
              </div>

              {/* Security Audit Section */}
              <div className="mb-6 p-4 rounded-xl bg-black border border-neon-green/20 relative overflow-hidden shadow-[inset_0_0_20px_rgba(0,255,65,0.02)]">
                <div className="absolute top-0 left-0 w-1 h-full bg-neon-green/50"></div>
                <div className="flex items-center gap-2 mb-3">
                  <ShieldAlert size={16} className={
                    selectedNetworkDetails.security?.includes('Open') ? 'text-red-500 animate-pulse' :
                    selectedNetworkDetails.security?.includes('WEP') ? 'text-orange-500' :
                    selectedNetworkDetails.security?.includes('WPA3') ? 'text-neon-green' :
                    'text-yellow-500'
                  } />
                  <span className="text-sm font-bold text-white font-mono tracking-widest">SECURITY_AUDIT</span>
                </div>
                
                <div className="flex flex-col gap-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-neon-green/50 font-mono tracking-widest uppercase">ENCRYPTION_STANDARD</span>
                    <span className={`font-mono font-bold tracking-widest ${
                      selectedNetworkDetails.security?.includes('Open') ? 'text-red-500 drop-shadow-[0_0_5px_rgba(239,68,68,0.5)]' :
                      selectedNetworkDetails.security?.includes('WEP') ? 'text-orange-500' :
                      selectedNetworkDetails.security?.includes('WPA3') ? 'text-neon-green drop-shadow-[0_0_5px_rgba(0,255,65,0.5)]' :
                      'text-yellow-500'
                    }`}>
                      {selectedNetworkDetails.security?.includes('Open') ? 'CRITICAL RISK (OPEN)' :
                       selectedNetworkDetails.security?.includes('WEP') ? 'HIGH RISK (WEP)' :
                       selectedNetworkDetails.security?.includes('WPA3') ? 'SECURE (WPA3)' :
                       'MODERATE RISK (WPA2)'}
                    </span>
                  </div>
                  
                  <div className="w-full bg-white/5 rounded-full h-1.5 mt-1 overflow-hidden">
                    <div className={`h-full rounded-full ${
                      selectedNetworkDetails.security?.includes('Open') ? 'bg-red-500 w-[10%] shadow-[0_0_10px_rgba(239,68,68,0.8)]' :
                      selectedNetworkDetails.security?.includes('WEP') ? 'bg-orange-500 w-[30%]' :
                      selectedNetworkDetails.security?.includes('WPA3') ? 'bg-neon-green w-[100%] shadow-[0_0_10px_rgba(0,255,65,0.8)]' :
                      'bg-yellow-500 w-[80%]'
                    }`} />
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-bold text-white font-mono tracking-widest mb-3 flex items-center gap-2">
                  <Terminal size={16} className="text-neon-green" />
                  CONNECTED_NODES
                </h4>
                
                {isLoadingDetails ? (
                  <div className="flex flex-col items-center justify-center py-10 bg-black border border-neon-green/30 rounded-xl relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1 bg-neon-green/50 animate-scanline"></div>
                    <RefreshCw size={24} className="animate-spin text-neon-green mb-2" />
                    <span className="text-sm text-neon-green font-mono">INTERROGATING TARGET...</span>
                  </div>
                ) : (
                  <>
                    {selectedNetworkDetails.note && (
                      <div className="mb-4 text-xs bg-red-500/10 text-red-400 border border-red-500/30 p-3 rounded-lg flex items-start gap-2 shadow-[0_0_10px_rgba(239,68,68,0.1)]">
                        <ShieldAlert size={14} className="shrink-0 mt-0.5 animate-pulse" />
                        <p className="font-mono">{selectedNetworkDetails.note}</p>
                      </div>
                    )}
                    
                    {selectedNetworkDetails.clients && selectedNetworkDetails.clients.length > 0 ? (
                      <div className="bg-black border border-neon-green/20 rounded-xl overflow-hidden overflow-x-auto shadow-[0_0_15px_rgba(0,255,65,0.05)]">
                        <table className="w-full text-left text-sm min-w-[600px]">
                          <thead className="bg-neon-green/5 text-neon-green/70 text-xs uppercase font-mono border-b border-neon-green/20">
                            <tr>
                              <th className="px-4 py-3 font-medium tracking-wider">TARGET_IP / MAC</th>
                              <th className="px-4 py-3 font-medium tracking-wider">DEVICE_FINGERPRINT</th>
                              <th className="px-4 py-3 font-medium tracking-wider">EXPOSED_SERVICES</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-neon-green/10 text-white">
                            {selectedNetworkDetails.clients.map((client: any, idx: number) => (
                              <tr key={idx} className="hover:bg-neon-green/5 transition-colors group">
                                <td className="px-4 py-3 font-mono text-xs relative">
                                  <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-transparent group-hover:bg-neon-green transition-colors"></div>
                                  <div className="text-neon-green font-bold mb-1 drop-shadow-[0_0_5px_rgba(0,255,65,0.5)]">{client.ip || 'Unknown IP'}</div>
                                  <div className="text-neon-blue/50 opacity-70 group-hover:opacity-100 transition-opacity">{client.mac}</div>
                                </td>
                                <td className="px-4 py-3">
                                  <div className="font-medium text-white font-mono">{client.device_type}</div>
                                  <div className="text-xs text-neon-blue/70 font-mono mt-0.5">{client.vendor}</div>
                                </td>
                                <td className="px-4 py-3">
                                  {client.open_ports && client.open_ports.length > 0 ? (
                                    <div className="flex flex-wrap gap-1.5">
                                      {client.open_ports.map((port: number) => (
                                        <span key={port} className="px-1.5 py-0.5 bg-red-500/20 text-red-500 border border-red-500/30 rounded text-[10px] font-mono shadow-[0_0_5px_rgba(239,68,68,0.2)]">
                                          {port}
                                        </span>
                                      ))}
                                    </div>
                                  ) : (
                                    <span className="text-neon-green/50 text-xs italic font-mono">SECURE</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="text-center py-8 bg-black border border-neon-green/20 rounded-lg text-neon-green/50 text-sm font-mono shadow-[inset_0_0_20px_rgba(0,255,65,0.02)]">
                        NO_CLIENTS_DETECTED
                      </div>
                    )}
                  </>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Floating AI Agent Button */}
      <div className="fixed bottom-6 right-6 z-40">
        <AnimatePresence>
          {isAiOpen && (
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.9 }}
              className="absolute bottom-16 right-0 w-80 sm:w-96 bg-black border border-neon-green/30 rounded-lg shadow-[0_0_30px_rgba(0,255,65,0.15)] flex flex-col overflow-hidden"
              style={{ height: '500px', maxHeight: '80vh' }}
            >
              <div className="bg-black/90 border-b border-neon-green/50 px-4 py-3 flex items-center justify-between shrink-0 shadow-[0_4px_20px_rgba(0,255,65,0.1)] relative overflow-hidden">
                <div className="absolute inset-0 bg-neon-green/5 animate-pulse"></div>
                <div className="absolute bottom-0 left-0 w-full h-px bg-neon-green/80 animate-scanline"></div>
                <div className="flex items-center gap-2 relative z-10">
                  <Skull size={18} className="text-neon-green animate-glitch drop-shadow-[0_0_5px_rgba(0,255,65,1)]" />
                  <span className="font-bold text-white font-mono tracking-widest drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]">
                    <span className="text-neon-green">P4NTH0M</span>C0R3_AI
                  </span>
                </div>
                <button onClick={() => setIsAiOpen(false)} className="text-neon-green/60 hover:text-neon-green relative z-10 hover:rotate-90 transition-all">
                  <X size={18} />
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-black relative">
                <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-neon-green/5 via-transparent to-transparent pointer-events-none"></div>
                {aiHistory.length === 0 ? (
                  <div className="text-center text-neon-green/50 text-sm mt-8 font-mono relative z-10">
                    <Hexagon size={48} className="mx-auto mb-4 opacity-50 text-neon-green animate-pulse-glow" />
                    <p>Query P4NTH0MC0R3_AI regarding telemetry data, security anomalies, or target APs.</p>
                  </div>
                ) : (
                  aiHistory.map((msg, i) => (
                    <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[85%] rounded-lg px-4 py-2 text-sm font-mono ${msg.role === 'user' ? 'bg-neon-green/20 text-neon-green border border-neon-green/30 rounded-br-none shadow-[0_0_10px_rgba(0,255,65,0.1)]' : 'bg-black border border-neon-blue/30 text-neon-blue rounded-bl-none shadow-[0_0_10px_rgba(0,240,255,0.05)]'}`}>
                        {msg.role === 'user' ? (
                          msg.content
                        ) : (
                          <div className="prose prose-invert prose-sm max-w-none text-neon-blue">
                            <Markdown>{msg.content}</Markdown>
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
                {isAiLoading && (
                  <div className="flex justify-start">
                    <div className="bg-black border border-neon-blue/30 text-neon-blue rounded-lg rounded-bl-none px-4 py-2 text-sm font-mono flex items-center gap-2 shadow-[0_0_10px_rgba(0,240,255,0.05)]">
                      <RefreshCw size={14} className="animate-spin" /> <span className="animate-pulse">PROCESSING_QUERY...</span>
                    </div>
                  </div>
                )}
              </div>
              
              <form onSubmit={handleAiSubmit} className="p-3 bg-black border-t border-neon-green/30 shrink-0 flex gap-2">
                <input
                  type="text"
                  value={aiPrompt}
                  onChange={e => setAiPrompt(e.target.value)}
                  placeholder="Query P4NTH0MC0R3_AI..."
                  className="flex-1 bg-neon-green/5 border border-neon-green/20 focus:border-neon-green/50 rounded-lg px-3 py-2 text-sm text-neon-green font-mono outline-none placeholder:text-neon-green/30"
                />
                <button 
                  type="submit" 
                  disabled={isAiLoading || !aiPrompt.trim()}
                  className="bg-neon-green/20 hover:bg-neon-green/40 disabled:opacity-50 text-neon-green border border-neon-green/30 rounded-lg px-3 flex items-center justify-center transition-colors shadow-[0_0_10px_rgba(0,255,65,0.1)]"
                >
                  <ArrowRight size={16} />
                </button>
              </form>
            </motion.div>
          )}
        </AnimatePresence>

        <button
          onClick={() => setIsAiOpen(!isAiOpen)}
          className={`w-14 h-14 rounded-full shadow-[0_0_20px_rgba(0,255,65,0.4)] flex items-center justify-center transition-all duration-300 ${isAiOpen ? 'bg-black text-neon-green border border-neon-green rotate-90 scale-95' : 'bg-black text-neon-green border border-neon-green hover:bg-neon-green/10 hover:shadow-[0_0_30px_rgba(0,255,65,0.7)] hover:scale-105 group'}`}
        >
          {isAiOpen ? <X size={24} /> : <Ghost size={24} className="animate-pulse group-hover:animate-glitch drop-shadow-[0_0_5px_rgba(0,255,65,1)]" />}
        </button>
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #121212;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #333;
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #444;
        }
      `}} />
    </div>
  );
}
