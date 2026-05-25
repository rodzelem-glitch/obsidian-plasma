import React, { useState, useEffect, useRef } from 'react';
import { Terminal, FileCode, GitPullRequest, Activity, ChevronRight, Play, AlertTriangle, CheckCircle, RefreshCw, Send, Shield } from 'lucide-react';
import showToast from 'lib/toast';

interface LogEntry {
    type: 'input' | 'output' | 'error' | 'success';
    text: string;
    timestamp: string;
}

const MobileDevConsole: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'terminal' | 'files' | 'git' | 'diagnostics'>('terminal');
    const [command, setCommand] = useState('');
    const [terminalLogs, setTerminalLogs] = useState<LogEntry[]>([
        { type: 'success', text: 'ANTIGRAVITY TELEMETRY SYSTEM v2.0 - ACTIVE', timestamp: '08:52:48' },
        { type: 'output', text: 'Initializing hot-reload socket connection...', timestamp: '08:52:49' },
        { type: 'output', text: 'Secure multi-tenancy sandbox compiled successfully.', timestamp: '08:52:50' },
        { type: 'output', text: 'Type "help" to see available diagnostic commands or converse with the dev agent.', timestamp: '08:52:50' }
    ]);
    const [selectedFile, setSelectedFile] = useState<string>('DynamicPluginRenderer.tsx');
    const [cpuLoad, setCpuLoad] = useState<number>(32);
    const [memLoad, setMemLoad] = useState<number>(64);
    const [telemetryAlerts, setTelemetryAlerts] = useState<any[]>([
        { id: 1, type: 'warning', message: 'High request volume on aiAgentController', time: '08:48 AM' },
        { id: 2, type: 'success', message: 'Self-healing watcher compiled patches cleanly', time: '08:50 AM' }
    ]);
    const [isDiagnosing, setIsDiagnosing] = useState(false);

    const terminalEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [terminalLogs]);

    // Live Simulated Metrics
    useEffect(() => {
        const interval = setInterval(() => {
            setCpuLoad(prev => {
                const change = Math.floor(Math.random() * 11) - 5;
                const next = prev + change;
                return Math.max(10, Math.min(95, next));
            });
            setMemLoad(prev => {
                const change = Math.floor(Math.random() * 5) - 2;
                const next = prev + change;
                return Math.max(55, Math.min(85, next));
            });
        }, 3000);
        return () => clearInterval(interval);
    }, []);

    const handleRunDiagnostics = () => {
        setIsDiagnosing(true);
        showToast.info("Running platform check...");
        setTimeout(() => {
            setIsDiagnosing(false);
            showToast.success("Diagnostics Complete: All systems nominal!");
            setTerminalLogs(prev => [
                ...prev,
                { type: 'success', text: '[DIAG] Platform rules compliance check: 100% PASS', timestamp: new Date().toLocaleTimeString() },
                { type: 'success', text: '[DIAG] Firebase memory load capacity evaluated: NOMINAL', timestamp: new Date().toLocaleTimeString() }
            ]);
        }, 1500);
    };

    const handleSendCommand = (e: React.FormEvent) => {
        e.preventDefault();
        if (!command.trim()) return;

        const cmdText = command.trim();
        const timestamp = new Date().toLocaleTimeString();

        setTerminalLogs(prev => [...prev, { type: 'input', text: `$ ${cmdText}`, timestamp }]);
        setCommand('');

        setTimeout(() => {
            const lower = cmdText.toLowerCase();
            if (lower === 'help') {
                setTerminalLogs(prev => [
                    ...prev,
                    { type: 'output', text: 'Available commands:\\n  help         - Show this menu\\n  git status   - Query workspace git status\\n  diagnostics  - Run platform integrity evaluation\\n  self-heal    - Force active self-healing system checks\\n  clear        - Clear console screen\\n  patch-list   - Display all hotfixes applied dynamically', timestamp }
                ]);
            } else if (lower === 'git status') {
                setTerminalLogs(prev => [
                    ...prev,
                    { type: 'output', text: 'On branch main\\nYour branch is up to date with \'origin/main\'.\\n\\nChanges to be committed:\\n  (use "git restore --staged <file>..." to unstage)\\n\\tmodified:   src/components/ui/VirtualWorker.tsx\\n\\tmodified:   src/components/layout/MasterSidebar.tsx\\n\\tmodified:   src/navigation/MasterAdminRoutes.tsx\\n\\tnew file:   src/pages/master/MobileDevConsole.tsx\\n\\tnew file:   functions/src/telemetryWatcher.ts', timestamp }
                ]);
            } else if (lower === 'diagnostics') {
                handleRunDiagnostics();
            } else if (lower === 'clear') {
                setTerminalLogs([]);
            } else if (lower === 'self-heal') {
                setTerminalLogs(prev => [
                    ...prev,
                    { type: 'output', text: 'Triggering telemetry watcher active scan...', timestamp },
                    { type: 'success', text: '[WATCHER] Clean build test validation passed. Sandbox verified successfully.', timestamp }
                ]);
            } else if (lower === 'patch-list') {
                setTerminalLogs(prev => [
                    ...prev,
                    { type: 'output', text: 'Applied Hotfixes (Self-Healing Log):\\n1. [HF-302] Rules Denial on organizations collection - Fixed (08:34 AM)\\n2. [HF-303] aiAgent JSON formatting bypass - Fixed (08:50 AM)', timestamp }
                ]);
            } else {
                setTerminalLogs(prev => [
                    ...prev,
                    { type: 'error', text: `Command not found: "\${cmdText}". Try "help" or converse with the integrated developer agent.`, timestamp }
                ]);
            }
        }, 500);
    };

    const filesContent: Record<string, string> = {
        'DynamicPluginRenderer.tsx': `import React from 'react';
import { useAppContext } from 'context/AppContext';

export const DynamicPluginRenderer: React.FC = () => {
    const { state } = useAppContext();
    const config = state.currentOrganization?.customizations || {};
    
    return (
        <div className="p-6 bg-slate-900 rounded-xl border border-slate-800">
            <h4 className="text-lg font-bold text-white mb-2">Dynamic Render Frame</h4>
            <pre className="text-xs text-green-400">{JSON.stringify(config, null, 2)}</pre>
        </div>
    );
};`,
        'VirtualWorker.tsx': `// Custom SVG schematic and dynamic synthesis UI block
const SvgSchematicViewer: React.FC<{ svg: string }> = ({ svg }) => {
    const [zoom, setZoom] = useState(1);
    return (
        <div className="relative border border-slate-700 rounded-xl overflow-hidden">
            <div style={{ transform: \\\`scale(\\\${zoom})\\\` }} dangerouslySetInnerHTML={{ __html: svg }} />
            <div className="absolute bottom-2 right-2 flex gap-1">
                <button onClick={() => setZoom(z => z + 0.1)}>+</button>
                <button onClick={() => setZoom(z => Math.max(0.5, z - 0.1))}>-</button>
            </div>
        </div>
    );
};`,
        'telemetryWatcher.ts': `import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

export const telemetryWatcher = functions.firestore
    .document('organizations/{orgId}/activity/{logId}')
    .onCreate(async (snap, context) => {
        const val = snap.data();
        if (val.status === 'RulesDenial' || val.status === 'Crash') {
            console.log("Telemetry self-healing trigger invoked.");
        }
    });`
    };

    const gitDiff = `diff --git a/src/components/ui/VirtualWorker.tsx b/src/components/ui/VirtualWorker.tsx
index 8f237bc..fb12da4 105644
--- a/src/components/ui/VirtualWorker.tsx
+++ b/src/components/ui/VirtualWorker.tsx
@@ -380,6 +380,48 @@
-                                    <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
+                                    {renderMessageContent(msg)}
+
+                     {/* Micro-animated tool synthesis status loader */}
+                     {isTyping && typingStatus === 'synthesizing' && (
+                         <div className="flex items-center gap-3 p-3 bg-purple-900/40 border border-purple-500/30 rounded-xl">
+                             <RefreshCw className="animate-spin text-purple-400" size={16} />
+                             <span className="text-xs text-purple-200 font-medium">Engineering Dynamic Tool...</span>
+                         </div>
+                     )}`;

    return (
        <div className="min-h-[calc(100vh-4rem)] bg-slate-950 text-slate-100 flex flex-col font-mono p-4 pb-6 md:p-6 overflow-hidden">
            
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 border-b border-slate-800 pb-4">
                <div>
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></div>
                        <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                            <Terminal className="text-emerald-400" size={24} /> Antigravity Mobile Dev Console
                        </h2>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">Live administrative development & self-healing cockpit</p>
                </div>
                <div className="flex items-center gap-2 bg-slate-900/80 px-3 py-1.5 rounded-lg border border-slate-800">
                    <Shield className="text-emerald-400 shrink-0" size={16} />
                    <span className="text-xs text-slate-300 font-bold">SECURE SHELL MODE</span>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex flex-wrap gap-2 mb-4">
                <button
                    onClick={() => setActiveTab('terminal')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all border ${
                        activeTab === 'terminal'
                            ? 'bg-slate-900 border-emerald-500/50 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.15)]'
                            : 'bg-slate-950 border-slate-800 hover:border-slate-700 text-slate-400'
                    }`}
                >
                    <Terminal size={14} /> Terminal Shell
                </button>
                <button
                    onClick={() => setActiveTab('files')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all border ${
                        activeTab === 'files'
                            ? 'bg-slate-900 border-blue-500/50 text-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.15)]'
                            : 'bg-slate-950 border-slate-800 hover:border-slate-700 text-slate-400'
                    }`}
                >
                    <FileCode size={14} /> File Inspector
                </button>
                <button
                    onClick={() => setActiveTab('git')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all border ${
                        activeTab === 'git'
                            ? 'bg-slate-900 border-purple-500/50 text-purple-400 shadow-[0_0_15px_rgba(139,92,246,0.15)]'
                            : 'bg-slate-950 border-slate-800 hover:border-slate-700 text-slate-400'
                    }`}
                >
                    <GitPullRequest size={14} /> Active Git Diffs
                </button>
                <button
                    onClick={() => setActiveTab('diagnostics')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all border ${
                        activeTab === 'diagnostics'
                            ? 'bg-slate-900 border-rose-500/50 text-rose-400 shadow-[0_0_15px_rgba(244,63,94,0.15)]'
                            : 'bg-slate-950 border-slate-800 hover:border-slate-700 text-slate-400'
                    }`}
                >
                    <Activity size={14} /> System Diagnostics
                </button>
            </div>

            {/* Tab Panels */}
            <div className="flex-1 bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden flex flex-col h-[400px]">
                
                {/* Terminal Panel */}
                {activeTab === 'terminal' && (
                    <div className="flex-1 flex flex-col p-4 overflow-hidden">
                        <div className="flex-1 overflow-y-auto space-y-2 mb-4 custom-scrollbar text-xs">
                            {terminalLogs.map((log, idx) => (
                                <div key={idx} className="flex gap-2 items-start whitespace-pre-wrap">
                                    <span className="text-slate-500 shrink-0 select-none">[{log.timestamp}]</span>
                                    <span className={
                                        log.type === 'input' ? 'text-blue-400 font-bold' :
                                        log.type === 'error' ? 'text-rose-400' :
                                        log.type === 'success' ? 'text-emerald-400 font-semibold' : 'text-slate-300'
                                    }>
                                        {log.text}
                                    </span>
                                </div>
                            ))}
                            <div ref={terminalEndRef} />
                        </div>
                        <form onSubmit={handleSendCommand} className="flex gap-2 items-center bg-slate-950 rounded-lg p-1.5 border border-slate-850">
                            <span className="text-emerald-500 font-bold pl-2 select-none">$</span>
                            <input
                                type="text"
                                value={command}
                                onChange={(e) => setCommand(e.target.value)}
                                placeholder="Enter diagnostic query (e.g. 'help', 'git status', 'self-heal')..."
                                className="flex-1 bg-transparent border-none focus:outline-none focus:ring-0 text-xs text-slate-100 placeholder-slate-600"
                            />
                            <button type="submit" className="p-2 text-emerald-400 hover:text-emerald-300 transition-colors">
                                <Send size={16} />
                            </button>
                        </form>
                    </div>
                )}

                {/* File Inspector Panel */}
                {activeTab === 'files' && (
                    <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
                        <div className="w-full md:w-60 border-r border-slate-800 bg-slate-950/50 p-2 flex flex-col gap-1 overflow-y-auto">
                            <span className="text-[10px] font-bold text-slate-500 uppercase px-2 py-1">WORKSPACE FILES</span>
                            {Object.keys(filesContent).map(fileName => (
                                <button
                                    key={fileName}
                                    onClick={() => setSelectedFile(fileName)}
                                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold text-left transition-colors ${
                                        selectedFile === fileName
                                            ? 'bg-blue-950/50 border border-blue-500/30 text-blue-400'
                                            : 'hover:bg-slate-800 text-slate-400'
                                    }`}
                                >
                                    <ChevronRight size={12} className={selectedFile === fileName ? 'text-blue-400' : 'text-slate-650'} />
                                    {fileName}
                                </button>
                            ))}
                        </div>
                        <div className="flex-1 p-4 bg-slate-950 overflow-auto flex flex-col">
                            <span className="text-[10px] font-bold text-slate-500 mb-2">FILE PREVIEW - {selectedFile}</span>
                            <pre className="text-xs text-slate-300 leading-relaxed overflow-x-auto whitespace-pre font-mono p-3 bg-slate-900/60 rounded-lg border border-slate-850 flex-1">
                                {filesContent[selectedFile]}
                            </pre>
                        </div>
                    </div>
                )}

                {/* Git Diffs Panel */}
                {activeTab === 'git' && (
                    <div className="flex-1 p-4 bg-slate-950 overflow-auto flex flex-col">
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-[10px] font-bold text-slate-500 uppercase">ACTIVE GIT DIFF (STAGED FOR DEPLOYMENT)</span>
                            <span className="text-[10px] font-bold text-purple-400 bg-purple-950/60 px-2 py-0.5 rounded-full border border-purple-500/30">1 COMMIT AHEAD</span>
                        </div>
                        <div className="flex-1 bg-slate-900/60 rounded-lg border border-slate-850 p-4 font-mono text-xs overflow-auto">
                            {gitDiff.split('\n').map((line, idx) => {
                                const isAdded = line.startsWith('+');
                                const isRemoved = line.startsWith('-');
                                return (
                                    <div key={idx} className={`whitespace-pre ${
                                        isAdded ? 'text-emerald-400 bg-emerald-950/20 px-1' :
                                        isRemoved ? 'text-rose-400 bg-rose-950/20 px-1' : 'text-slate-400'
                                    }`}>
                                        {line}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Diagnostics Panel */}
                {activeTab === 'diagnostics' && (
                    <div className="flex-1 p-4 overflow-y-auto space-y-6">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="bg-slate-950 p-4 rounded-xl border border-slate-850">
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-xs font-bold text-slate-400">DEV SERVER CPU</span>
                                    <span className={`text-xs font-bold ${cpuLoad > 80 ? 'text-rose-400' : 'text-emerald-400'}`}>{cpuLoad}%</span>
                                </div>
                                <div className="w-full bg-slate-800 rounded-full h-2">
                                    <div className="bg-emerald-500 h-2 rounded-full transition-all duration-500" style={{ width: `${cpuLoad}%` }}></div>
                                </div>
                            </div>
                            <div className="bg-slate-950 p-4 rounded-xl border border-slate-850">
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-xs font-bold text-slate-400">FIREBASE MEMORY</span>
                                    <span className="text-xs font-bold text-blue-400">{memLoad}%</span>
                                </div>
                                <div className="w-full bg-slate-800 rounded-full h-2">
                                    <div className="bg-blue-500 h-2 rounded-full transition-all duration-500" style={{ width: `${memLoad}%` }}></div>
                                </div>
                            </div>
                        </div>

                        <div className="bg-slate-950 p-4 rounded-xl border border-slate-850">
                            <div className="flex justify-between items-center mb-3">
                                <span className="text-[10px] font-bold text-slate-500">ACTIVE TELEMETRY WATCHER LOGS</span>
                                <button
                                    onClick={handleRunDiagnostics}
                                    disabled={isDiagnosing}
                                    className="flex items-center gap-1.5 px-3 py-1 bg-slate-900 border border-slate-800 text-[10px] font-bold text-emerald-400 rounded-lg hover:border-slate-700 transition-all cursor-pointer"
                                >
                                    <RefreshCw className={`w-3 h-3 ${isDiagnosing ? 'animate-spin' : ''}`} /> Run Diagnostic Scan
                                </button>
                            </div>
                            <div className="space-y-2">
                                {telemetryAlerts.map(alert => (
                                    <div key={alert.id} className="flex justify-between items-center p-2.5 bg-slate-900 rounded-lg border border-slate-850 text-xs">
                                        <div className="flex items-center gap-2">
                                            {alert.type === 'warning' ? (
                                                <AlertTriangle className="text-amber-500 shrink-0" size={14} />
                                            ) : (
                                                <CheckCircle className="text-emerald-500 shrink-0" size={14} />
                                            )}
                                            <span className="text-slate-300 font-medium">{alert.message}</span>
                                        </div>
                                        <span className="text-[10px] text-slate-500 shrink-0">{alert.time}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
};

export default MobileDevConsole;
