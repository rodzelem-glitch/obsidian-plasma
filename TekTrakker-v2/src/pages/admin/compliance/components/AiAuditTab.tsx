import showToast from "lib/toast";
import React, { useState, useEffect } from 'react';
import { db, functions } from 'lib/firebase';
import { useAppContext } from 'context/AppContext';
import { Loader2, Bot, AlertTriangle, CheckCircle, Search, Calendar, Undo2 } from 'lucide-react';
import Input from 'components/ui/Input';

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
    const [logs, setLogs] = useState<AiLog[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

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

    const filteredLogs = logs.filter(log => 
        log.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.toolName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.prompt.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleUndo = async (log: AiLog) => {
        if (!window.confirm("Are you sure you want to securely reverse this AI database transaction?")) return;
        
        try {
            const undoFn = functions.httpsCallable('undoAiAction');
            await undoFn({ logId: log.id });
            
            // Optimistically update UI
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
                                    <th className="px-6 py-4 font-semibold text-center">Status</th>
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
                                            <div className="font-mono text-xs text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded inline-block mb-2">
                                                {log.toolName}
                                            </div>
                                            <div className="text-xs text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-900 p-2 rounded border border-gray-200 dark:border-gray-700 max-w-xs overflow-x-auto">
                                                <pre>{JSON.stringify(log.toolArgs, null, 2)}</pre>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 align-top text-center">
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
                                            <div className="mt-2 text-xs text-gray-500 max-w-[200px] truncate" title={log.statusMessage}>
                                                {log.statusMessage}
                                            </div>
                                            {log.status === 'Completed' && log.revertData && (
                                                <button 
                                                    onClick={() => handleUndo(log)}
                                                    className="mt-3 w-full py-1.5 px-2 bg-gray-100 dark:bg-gray-800 hover:bg-red-100 dark:hover:bg-red-900/40 text-gray-700 dark:text-gray-300 hover:text-red-600 rounded text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors border border-gray-200 dark:border-gray-700"
                                                >
                                                    <Undo2 size={12} /> Undo Action
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AiAuditTab;
