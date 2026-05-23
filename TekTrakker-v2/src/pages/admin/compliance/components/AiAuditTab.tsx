import showToast from "lib/toast";
import React, { useState, useEffect } from 'react';
import { db, functions } from 'lib/firebase';
import { useAppContext } from 'context/AppContext';
import { Loader2, Bot, AlertTriangle, CheckCircle, Search, Calendar, Undo2, Sparkles, Cpu, Wrench } from 'lucide-react';
import Input from 'components/ui/Input';
import Modal from 'components/ui/Modal';
import Button from 'components/ui/Button';

interface AiLog {
    id: string;
    organizationId: string;
    userId: string;
    userName: string;
    userEmail: string;
    toolName: string;
    toolArgs: any;
    prompt: string;
    status: 'Completed' | 'Error' | 'Undone';
    statusMessage: string;
    timestamp: string;
    revertData?: any;
}

const AiAuditTab: React.FC = () => {
    const { state } = useAppContext();
    const isMasterAdmin = state.currentUser?.role === 'master_admin' || state.currentUser?.email === 'rodzelem@gmail.com';
    const [logs, setLogs] = useState<AiLog[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    // Rollout promotion states
    const [isRolloutModalOpen, setIsRolloutModalOpen] = useState(false);
    const [selectedLogForRollout, setSelectedLogForRollout] = useState<AiLog | null>(null);
    const [rolloutToolName, setRolloutToolName] = useState('');
    const [rolloutCapability, setRolloutCapability] = useState('');
    const [rolloutInputParams, setRolloutInputParams] = useState('');
    const [rolloutDataMutations, setRolloutDataMutations] = useState('');
    const [rolloutSource, setRolloutSource] = useState('');

    useEffect(() => {
        if (!state.currentOrganization) return;
        
        let isMounted = true;
        const fetchLogs = async () => {
            try {
                const snapshot = await db.collection('aiActivityLogs')
                    .where('organizationId', '==', state.currentOrganization!.id)
                    .orderBy('timestamp', 'desc')
                    .limit(100)
                    .get();
                
                if (isMounted) {
                    setLogs(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as AiLog)));
                    setIsLoading(false);
                }
            } catch (err) {
                console.error("Failed to fetch AI logs:", err);
                if (isMounted) setIsLoading(false);
            }
        };
        fetchLogs();
        return () => { isMounted = false; };
    }, [state.currentOrganization]);

    const isHighlyRecommended = (log: AiLog): boolean => {
        const text = (log.prompt + ' ' + log.toolName).toLowerCase();
        const keywords = ['safety', 'compliance', 'checklist', 'vacuum', 'micron', 'material', 'consumed', 'part', 'approval', 'warranty', 'psi'];
        return keywords.some(kw => text.includes(kw));
    };

    const generateSynthesizedToolData = (log: AiLog) => {
        const prompt = log.prompt.toLowerCase();
        let toolName = log.toolName || 'customTool';
        toolName = toolName.replace(/[^a-zA-Z0-9]/g, '');
        if (toolName === 'callGeminiAI' || toolName === 'synthesizedTool' || toolName === 'customTool') {
            if (prompt.includes('safety') || prompt.includes('compliance')) toolName = 'safetyComplianceChecklist';
            else if (prompt.includes('vacuum') || prompt.includes('micron')) toolName = 'vacuumBaselines';
            else if (prompt.includes('material') || prompt.includes('part') || prompt.includes('consumed')) toolName = 'materialsConsumed';
            else if (prompt.includes('approval') || prompt.includes('authorize')) toolName = 'customerApprovals';
            else if (prompt.includes('warranty')) toolName = 'compressorWarranty';
            else toolName = 'logActivityDetails';
        }

        let requestedCapability = `Allows technicians to automatically ${log.prompt.replace(/please|create|add|generate|log/gi, '').trim()}`;
        if (requestedCapability.length > 150) {
            requestedCapability = requestedCapability.slice(0, 147) + '...';
        }

        let inputParametersObj: Record<string, string> = {};
        if (log.toolArgs && typeof log.toolArgs === 'object' && Object.keys(log.toolArgs).length > 0) {
            Object.entries(log.toolArgs).forEach(([key, val]) => {
                if (typeof val === 'number') inputParametersObj[key] = 'number';
                else if (typeof val === 'boolean') inputParametersObj[key] = 'boolean';
                else inputParametersObj[key] = 'string';
            });
        } else {
            if (prompt.includes('safety') || prompt.includes('compliance')) {
                inputParametersObj = { hasPPE: 'boolean', powerDisconnected: 'boolean', workspaceSafe: 'boolean', notes: 'string' };
            } else if (prompt.includes('vacuum') || prompt.includes('micron')) {
                inputParametersObj = { targetMicrons: 'number', achievedMicrons: 'number', leakPassed: 'boolean', decayRate: 'number' };
            } else if (prompt.includes('material') || prompt.includes('part') || prompt.includes('consumed')) {
                inputParametersObj = { partName: 'string', quantity: 'number', unit: 'string', isBillable: 'boolean' };
            } else if (prompt.includes('approval') || prompt.includes('authorize')) {
                inputParametersObj = { customerName: 'string', approvalType: 'string', termsAccepted: 'boolean', authorizedAmount: 'number' };
            } else if (prompt.includes('warranty')) {
                inputParametersObj = { serialNumber: 'string', modelNumber: 'string', tonnage: 'number', isEligible: 'boolean' };
            } else {
                inputParametersObj = { notes: 'string', status: 'string' };
            }
        }

        const dataMutations = `Logs custom data parameters into organization synthesizedData collection.`;

        const compiledSource = `/**
 * Synthesized Tool: ${toolName}
 * Created for: ${requestedCapability}
 * Generated autonomously by Antigravity Synthesis Engine.
 */
import * as admin from 'firebase-admin';

export async function executeSynthesizedTool(orgId: string, params: any) {
    const db = admin.firestore();
    const batch = db.batch();
    
    const recordRef = db.collection('organizations').doc(orgId).collection('synthesizedData').doc();
    batch.set(recordRef, {
        id: recordRef.id,
        toolName: "${toolName}",
        loggedParams: params,
        createdAt: new Date().toISOString()
    });
    
    await batch.commit();
    return { success: true, refId: recordRef.id };
}`;

        return {
            toolName,
            requestedCapability,
            inputParameters: JSON.stringify(inputParametersObj, null, 2),
            dataMutations,
            compiledSource,
            status: 'active' as const
        };
    };

    const handleOpenRolloutModal = (log: AiLog) => {
        const toolData = generateSynthesizedToolData(log);
        setSelectedLogForRollout(log);
        setRolloutToolName(toolData.toolName);
        setRolloutCapability(toolData.requestedCapability);
        setRolloutInputParams(toolData.inputParameters);
        setRolloutDataMutations(toolData.dataMutations);
        setRolloutSource(toolData.compiledSource);
        setIsRolloutModalOpen(true);
    };

    const handleConfirmRollout = async () => {
        if (!rolloutToolName.trim()) {
            showToast.error("Please enter a tool name.");
            return;
        }
        const cleanName = rolloutToolName.trim().replace(/[^a-zA-Z0-9]/g, '');
        if (cleanName !== rolloutToolName) {
            showToast.error("Tool name must be alphanumeric camelCase (no spaces).");
            return;
        }

        try {
            JSON.parse(rolloutInputParams);
        } catch (e) {
            showToast.error("Input parameters must be a valid JSON.");
            return;
        }

        const orgId = state.currentOrganization?.id || 'demo-org';
        const isDemo = state.isDemoMode;
        const adminEmail = state.currentUser?.email || 'platform@tektrakker.com';

        const toolData = {
            toolName: cleanName,
            requestedCapability: rolloutCapability,
            inputParameters: rolloutInputParams,
            dataMutations: rolloutDataMutations,
            compiledSource: rolloutSource,
            status: 'active' as const,
            createdAt: new Date().toISOString()
        };

        try {
            if (isDemo || orgId === 'demo-org') {
                const saved = localStorage.getItem(`demo-technician-tools`);
                let toolsList = saved ? JSON.parse(saved) : [];
                toolsList = toolsList.filter((t: any) => t.toolName !== cleanName);
                toolsList.push({ id: `synth-${Date.now()}`, ...toolData });
                localStorage.setItem(`demo-technician-tools`, JSON.stringify(toolsList));
                showToast.success(isMasterAdmin ? "Successfully promoted to global tool in demo mode!" : "Successfully promoted to organization tools in demo mode!");
            } else {
                await db.collection('organizations').doc(orgId).collection('synthesizedTools').doc(cleanName).set(toolData);
                if (isMasterAdmin) {
                    await db.collection('globalSynthesizedTools').doc(cleanName).set({ ...toolData, promotedByOrg: orgId });
                }
                
                const mailRef = db.collection('mail').doc();
                await mailRef.set({
                    to: adminEmail,
                    message: {
                        from: 'TekTrakker Security Portal <no-reply@tektrakker.com>',
                        subject: `[TekTrakker ${isMasterAdmin ? 'Global' : 'Organization'} Rollout] Dynamic Custom Tool Promoted: ${cleanName}`,
                        text: `Hello,\n\nA custom technician tool has been promoted to ${isMasterAdmin ? 'GLOBAL' : 'ORGANIZATION'} status from the AI Operations Ledger by an administrator.\n\n- Tool Name: ${cleanName}\n- Requested Capability: ${rolloutCapability}\n- Source Log Prompt: "${selectedLogForRollout?.prompt}"\n- Promoted By: ${adminEmail}\n\nThis tool is now live for all technicians in your organization.\n\nBest regards,\nTekTrakker Security Portal`,
                        html: `<p>Hello,</p>
                               <p>A custom technician tool has been promoted to <strong>${isMasterAdmin ? 'GLOBAL' : 'ORGANIZATION'}</strong> status from the AI Operations Ledger by an administrator.</p>
                               <ul>
                                   <li><strong>Tool Name:</strong> <code>${cleanName}</code></li>
                                   <li><strong>Requested Capability:</strong> ${rolloutCapability}</li>
                                   <li><strong>Source Log Prompt:</strong> <em>"${selectedLogForRollout?.prompt}"</em></li>
                                   <li><strong>Promoted By:</strong> ${adminEmail}</li>
                                </ul>
                               <p>This tool is now hot-linked and live for all field technicians in your organization.</p>
                               <hr/>
                               <p><em>This is an automated platform operations report.</em></p>`
                    }
                });
                showToast.success(isMasterAdmin 
                    ? "Successfully promoted to global tool & audit report dispatched!" 
                    : "Successfully promoted to organization tools & audit report dispatched!");
            }
            setIsRolloutModalOpen(false);
        } catch (err: any) {
            console.error("Rollout failed:", err);
            showToast.error("Failed to rollout tool: " + err.message);
        }
    };

    const filteredLogs = logs.filter(log => 
        log.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.toolName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.prompt.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const recommendedLogs = logs.filter(isHighlyRecommended);

    const handleUndo = async (log: AiLog) => {
        if (!window.confirm("Are you sure you want to securely reverse this AI database transaction?")) return;
        
        try {
            const undoFn = functions.httpsCallable('undoAiAction');
            await undoFn({ logId: log.id });
            
            setLogs(prev => prev.map(l => l.id === log.id ? { ...l, status: 'Undone', statusMessage: 'Action securely reversed by administrator.' } : l));
        } catch (e: any) {
            showToast.warn(`Failed to undo action: ${e.message}`);
        }
    };

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-gray-500">
                <Loader2 className="w-8 h-8 animate-spin mb-4" />
                <p>Loading AI Operations Ledger...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Smart Recommendation alerts header panel */}
            {recommendedLogs.length > 0 && (
                <div className="bg-gradient-to-r from-purple-900/30 to-indigo-900/30 backdrop-blur-md border border-purple-500/30 p-5 rounded-2xl shadow-xl space-y-4 mb-6 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 rounded-full blur-2xl pointer-events-none" />
                    <div className="flex items-start gap-4">
                        <div className="p-3 bg-purple-600/20 border border-purple-400/30 rounded-xl text-purple-400 animate-pulse">
                            <Bot size={24} />
                        </div>
                        <div className="space-y-1">
                            <h4 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                                Autonomous Smart Recommendations
                                <span className="text-[9px] bg-purple-500 text-white font-extrabold px-2 py-0.5 rounded-full animate-bounce">AI INSIGHT</span>
                            </h4>
                            <p className="text-xs text-purple-200/80">
                                The recommendation engine has scanned the activity ledger and identified {recommendedLogs.length} operational procedure(s) that would make highly valuable interactive widgets for your technicians.
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
                        {recommendedLogs.slice(0, 3).map((log) => {
                            const suggestion = generateSynthesizedToolData(log);
                            return (
                                <div key={log.id} className="bg-slate-900/60 border border-purple-500/20 p-4 rounded-xl flex flex-col justify-between space-y-3 hover:border-purple-400/40 transition-colors">
                                    <div className="space-y-2">
                                        <div className="flex justify-between items-start">
                                            <span className="font-mono text-[10px] text-purple-400 bg-purple-950/40 px-2 py-0.5 rounded border border-purple-900/40">
                                                {suggestion.toolName}
                                            </span>
                                            <span className="text-[9px] text-gray-500">{new Date(log.timestamp).toLocaleDateString()}</span>
                                        </div>
                                        <p className="text-xs text-gray-300 line-clamp-2 italic">
                                            "{log.prompt}"
                                        </p>
                                        <p className="text-[10px] text-purple-300 font-medium">
                                            💡 Expected widget: {suggestion.requestedCapability}
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => handleOpenRolloutModal(log)}
                                        className="w-full py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-black uppercase tracking-wider transition-all active:scale-[0.98] shadow-md flex items-center justify-center gap-1.5"
                                    >
                                        <Cpu size={12} /> Quick Rollout
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
                <div>
                    <h3 className="text-lg font-bold flex items-center gap-2">
                        <Bot className="text-teal-500" size={20} />
                        Virtual Worker Ledger
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Review all database actions executed by the AI.</p>
                </div>
                <div className="w-full sm:w-72">
                    <Input 
                        icon={<Search size={16} />}
                        placeholder="Search logs by staff or tool..." 
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            {filteredLogs.length === 0 ? (
                <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-xl border border-dashed border-gray-300 dark:border-gray-700">
                    <Bot size={48} className="mx-auto text-gray-400 dark:text-gray-600 mb-4 opacity-50" />
                    <p className="font-medium text-gray-600 dark:text-gray-400">No AI operations found.</p>
                    <p className="text-sm text-gray-500">The Virtual Worker hasn't completed any tracked actions yet.</p>
                </div>
            ) : (
                <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-gray-50 dark:bg-gray-900/50 text-gray-600 dark:text-gray-400 top-0 border-b border-gray-200 dark:border-gray-700">
                                <tr>
                                    <th className="px-6 py-4 font-semibold">Timestamp</th>
                                    <th className="px-6 py-4 font-semibold">Issued By</th>
                                    <th className="px-6 py-4 font-semibold">Original Prompt</th>
                                    <th className="px-6 py-4 font-semibold">Tool Execution</th>
                                    <th className="px-6 py-4 font-semibold text-center">Status / Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                                {filteredLogs.map(log => (
                                    <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors">
                                        <td className="px-6 py-4 align-top">
                                            <div className="flex items-center gap-1.5 text-gray-600 dark:text-gray-400">
                                                <Calendar size={14} />
                                                <span className="whitespace-nowrap">{new Date(log.timestamp).toLocaleString()}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 align-top">
                                            <div className="font-medium text-gray-900 dark:text-white">{log.userName}</div>
                                            <div className="text-xs text-gray-500">{log.userEmail}</div>
                                        </td>
                                        <td className="px-6 py-4 align-top">
                                            <p className="text-gray-700 dark:text-gray-300 max-w-sm italic">"{log.prompt}"</p>
                                        </td>
                                        <td className="px-6 py-4 align-top">
                                            <div className="flex flex-col gap-1.5 items-start">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <div className="font-mono text-xs text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded inline-block">
                                                        {log.toolName}
                                                    </div>
                                                    {isHighlyRecommended(log) && (
                                                        <span className="inline-flex items-center gap-1 text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/30 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border border-purple-200 dark:border-purple-800 animate-pulse">
                                                            ✨ Recommended
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="text-xs text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-900 p-2 rounded border border-gray-200 dark:border-gray-700 max-w-xs overflow-x-auto">
                                                    <pre>{JSON.stringify(log.toolArgs, null, 2)}</pre>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 align-top text-center">
                                            <div className="flex flex-col items-center gap-2">
                                                {log.status === 'Completed' ? (
                                                    <span className="inline-flex items-center gap-1 text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-2.5 py-1 rounded-full text-xs font-semibold font-mono border border-green-200 dark:border-green-800">
                                                        <CheckCircle size={12} /> SUCCESS
                                                    </span>
                                                ) : log.status === 'Undone' ? (
                                                    <span className="inline-flex items-center gap-1 text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20 px-2.5 py-1 rounded-full text-xs font-semibold font-mono border border-orange-200 dark:border-orange-800">
                                                        <Undo2 size={12} /> REVERSED
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-2.5 py-1 rounded-full text-xs font-semibold font-mono border border-red-200 dark:border-red-800">
                                                        <AlertTriangle size={12} /> FAILED
                                                    </span>
                                                )}
                                                
                                                <div className="text-xs text-gray-500 max-w-[200px] truncate" title={log.statusMessage}>
                                                    {log.statusMessage}
                                                </div>

                                                {log.status === 'Completed' && (
                                                    <div className="w-full flex flex-col gap-1.5 mt-2">
                                                        <button 
                                                            onClick={() => handleOpenRolloutModal(log)}
                                                            className="w-full py-1.5 px-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1 transition-all active:scale-95 shadow-sm"
                                                        >
                                                            <Cpu size={12} /> {isMasterAdmin ? "Implement Globally" : "Implement for Org"}
                                                        </button>
                                                        {log.revertData && (
                                                            <button 
                                                                onClick={() => handleUndo(log)}
                                                                className="w-full py-1.5 px-2 bg-gray-100 dark:bg-gray-800 hover:bg-red-100 dark:hover:bg-red-900/40 text-gray-700 dark:text-gray-300 hover:text-red-600 rounded text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors border border-gray-200 dark:border-gray-700"
                                                            >
                                                                <Undo2 size={12} /> Undo Action
                                                            </button>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Custom rollout promotion modal */}
            {isRolloutModalOpen && selectedLogForRollout && (
                <Modal
                    isOpen={isRolloutModalOpen}
                    onClose={() => setIsRolloutModalOpen(false)}
                    title={isMasterAdmin ? "Promote AI Operation to Global Widget" : "Promote AI Operation to Organization Widget"}
                    size="md"
                >
                    <div className="space-y-4 p-2">
                        <div className="p-3 bg-purple-50 dark:bg-purple-950/20 border border-purple-100 dark:border-purple-900/30 rounded-xl">
                            <p className="text-[10px] font-extrabold uppercase tracking-wider text-purple-600 dark:text-purple-400">Source AI Prompt</p>
                            <p className="text-xs text-slate-700 dark:text-slate-200 mt-0.5 italic">"{selectedLogForRollout.prompt}"</p>
                        </div>
                        
                        <div>
                            <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">Tool Name (camelCase)</label>
                            <Input
                                placeholder="e.g. rolloutChecklist"
                                value={rolloutToolName}
                                onChange={(e: any) => setRolloutToolName(e.target.value)}
                            />
                        </div>

                        <div>
                            <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">Trigger Description / Capability</label>
                            <Input
                                placeholder="e.g. Record custom technician vacuum details"
                                value={rolloutCapability}
                                onChange={(e: any) => setRolloutCapability(e.target.value)}
                            />
                        </div>

                        <div>
                            <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">Input Parameters Schema (JSON)</label>
                            <textarea
                                value={rolloutInputParams}
                                onChange={(e) => setRolloutInputParams(e.target.value)}
                                className="w-full font-mono text-xs p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-gray-900 text-slate-700 dark:text-white focus:ring-2 focus:ring-purple-500 h-24"
                            />
                        </div>

                        <div>
                            <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">Database Mutation Plan</label>
                            <Input
                                placeholder="e.g. Appends records inside synthesizedData collection"
                                value={rolloutDataMutations}
                                onChange={(e: any) => setRolloutDataMutations(e.target.value)}
                            />
                        </div>

                        <div>
                            <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">TypeScript Code Implementation</label>
                            <textarea
                                value={rolloutSource}
                                onChange={(e) => setRolloutSource(e.target.value)}
                                className="w-full font-mono text-[10px] p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-gray-900 text-slate-700 dark:text-white focus:ring-2 focus:ring-purple-500 h-32"
                            />
                        </div>

                        <div className="flex gap-2 pt-4">
                            <Button 
                                type="button" 
                                onClick={() => setIsRolloutModalOpen(false)}
                                variant="secondary" 
                                className="flex-1 py-2 text-xs uppercase tracking-wider font-extrabold"
                            >
                                Cancel
                            </Button>
                            <Button 
                                type="button"
                                onClick={handleConfirmRollout}
                                variant="primary" 
                                className="flex-1 py-2 text-xs uppercase tracking-wider font-extrabold bg-purple-600 hover:bg-purple-700"
                            >
                                {isMasterAdmin ? "Confirm & Rollout Globally" : "Confirm & Rollout for Org"}
                            </Button>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
};

export default AiAuditTab;
