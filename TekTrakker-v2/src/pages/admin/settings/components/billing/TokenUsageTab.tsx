import React, { useState, useEffect } from 'react';
import Card from 'components/ui/Card';
import { Zap, Activity, RefreshCw, CheckCircle, ShieldAlert, Bot, FileText, Send, MessageSquare } from 'lucide-react';
import { db } from 'lib/firebase';
import { doc, updateDoc, onSnapshot } from 'firebase/firestore';
import { useAppContext } from 'context/AppContext';
import showToast from 'lib/toast';

interface TokenUsageTabProps {
    orgId: string;
    vwUsage: { used: number; limit: number };
    hasVaultedMethod: boolean;
}

export const TokenUsageTab: React.FC<TokenUsageTabProps> = ({ orgId, vwUsage, hasVaultedMethod }) => {
    const { state, dispatch } = useAppContext();
    const autoSettings = (state.currentOrganization as any)?.autoRechargeSettings || {
        enabled: false,
        thresholdPct: 10,
        powerPackCount: 1
    };

    const [autoEnabled, setAutoEnabled] = useState<boolean>(autoSettings.enabled);
    const [thresholdPct, setThresholdPct] = useState<number>(autoSettings.thresholdPct || 10);
    const [isSavingAuto, setIsSavingAuto] = useState(false);
    const [taskUsageMap, setTaskUsageMap] = useState<Record<string, number>>({});

    useEffect(() => {
        if (!orgId) return;
        const unsub = onSnapshot(doc(db, 'aiUsage', orgId), (snapshot) => {
            if (snapshot.exists()) {
                setTaskUsageMap(snapshot.data()?.tasks || {});
            }
        });
        return () => unsub();
    }, [orgId]);

    const tokenPct = vwUsage.limit > 0 ? Math.min(100, (vwUsage.used / vwUsage.limit) * 100) : 0;
    const remainingTokens = Math.max(0, vwUsage.limit - vwUsage.used);

    const totalRecordedTaskTokens = Object.values(taskUsageMap).reduce((a, b) => a + (Number(b) || 0), 0);
    const baseTotal = totalRecordedTaskTokens > 0 ? totalRecordedTaskTokens : vwUsage.used;

    const featureCategories = [
        { name: 'Interactive Smart Proposals', icon: FileText, key: 'Interactive Smart Proposals', desc: 'Generates dynamic pricing tiers, equipment specs, and financing calculations.' },
        { name: 'Autonomous Dispatch & Routing', icon: Send, key: 'Autonomous Dispatch & Routing', desc: 'Optimizes technician schedules, geo-location travel, and shift assignments.' },
        { name: 'Work Order & Inspection Summaries', icon: Activity, key: 'Work Order & Inspection Summaries', desc: 'Summarizes diagnostic readings, photo tags, and unit work history.' },
        { name: 'Customer AI Assistant & Messaging', icon: MessageSquare, key: 'Customer AI Assistant & Messaging', desc: 'Powers public booking assistant and automated SMS customer replies.' },
        { name: 'Analyze RFP & Bids', icon: Bot, key: 'Analyze RFP', desc: 'Extracts scope of work, deadlines, and itemized tasks from RFP documents.' },
        { name: 'Virtual AI Worker', icon: Bot, key: 'Virtual AI Worker', desc: 'Autonomous background tasks, workflow actions, and field automation.' }
    ];

    const featureBreakdown = featureCategories.map(cat => {
        const rawTokens = Number(taskUsageMap[cat.key] || 0);
        const pct = baseTotal > 0 ? Math.min(100, Math.round((rawTokens / baseTotal) * 100)) : 0;
        return {
            ...cat,
            tokenCount: rawTokens,
            pct
        };
    });

    const handleSaveAutoRecharge = async () => {
        if (!orgId) return;
        if (autoEnabled && !hasVaultedMethod) {
            showToast.error("You must link a payment method under Payment Methods before enabling auto-recharge.");
            return;
        }

        setIsSavingAuto(true);
        try {
            const newAutoSettings = {
                enabled: autoEnabled,
                thresholdPct,
                powerPackCount: 1,
                updatedAt: new Date().toISOString()
            };

            await updateDoc(doc(db, 'organizations', orgId), {
                autoRechargeSettings: newAutoSettings
            });

            if (state.currentOrganization) {
                dispatch({
                    type: 'UPDATE_ORGANIZATION',
                    payload: { ...state.currentOrganization, autoRechargeSettings: newAutoSettings as any }
                });
            }

            showToast.success("Auto-recharge rules updated successfully!");
        } catch (error: any) {
            showToast.error("Failed to save auto-recharge settings: " + error.message);
        } finally {
            setIsSavingAuto(false);
        }
    };

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                    <Zap className="text-indigo-600 dark:text-indigo-400" size={24} /> AI Token Metering & Auto-Recharge
                </h2>
                <p className="text-xs text-slate-500">
                    Monitor token allocation across features and set up automatic top-up rules to prevent service interruptions.
                </p>
            </div>

            {/* Token Balance Summary */}
            <Card className="border border-indigo-100 dark:border-indigo-950/60 shadow-sm p-6 space-y-4">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                            Monthly Token Balance
                        </span>
                        <div className="flex items-baseline gap-3 mt-1">
                            <span className="text-4xl font-black text-slate-900 dark:text-white">
                                {remainingTokens.toLocaleString()}
                            </span>
                            <span className="text-xs font-semibold text-slate-500">
                                Tokens Remaining / {vwUsage.limit.toLocaleString()} Limit
                            </span>
                        </div>
                    </div>

                    <div className="bg-slate-50 dark:bg-slate-800 px-4 py-3 rounded-xl border border-slate-100 dark:border-slate-700 text-right">
                        <span className="text-xs text-slate-500 font-semibold block">Usage Level</span>
                        <span className={`text-xl font-bold ${tokenPct >= 90 ? 'text-red-500' : 'text-indigo-600 dark:text-indigo-400'}`}>
                            {tokenPct.toFixed(1)}% Used
                        </span>
                    </div>
                </div>

                <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-3 overflow-hidden">
                    <div 
                        className={`h-3 rounded-full transition-all duration-500 ${tokenPct >= 90 ? 'bg-red-500' : 'bg-indigo-600'}`}
                        style={{ width: `${tokenPct}%` }}
                    />
                </div>

                <div className="flex justify-between items-center text-xs text-slate-500">
                    <span>0 Tokens</span>
                    <span>{vwUsage.used.toLocaleString()} Used</span>
                    <span>{vwUsage.limit.toLocaleString()} Cap</span>
                </div>
            </Card>

            {/* Feature Usage Breakdown */}
            <Card className="border border-slate-200 dark:border-slate-800 shadow-sm p-6 space-y-4">
                <h3 className="font-bold text-lg text-slate-900 dark:text-white flex items-center gap-2">
                    <Activity size={18} className="text-blue-500" /> Usage Breakdown by Capability
                </h3>
                <p className="text-xs text-slate-500">Estimated distribution of AI processing tokens across platform operations</p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                    {featureBreakdown.map((item, idx) => {
                        const Icon = item.icon;
                        const tokenCount = item.tokenCount;

                        return (
                            <div key={idx} className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-700 space-y-2">
                                <div className="flex justify-between items-center">
                                    <div className="flex items-center gap-2 font-bold text-sm text-slate-900 dark:text-white">
                                        <Icon size={16} className="text-indigo-500" />
                                        <span>{item.name}</span>
                                    </div>
                                    <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded">
                                        {item.pct}% ({tokenCount.toLocaleString()} tokens)
                                    </span>
                                </div>
                                <p className="text-xs text-slate-500 leading-relaxed">{item.desc}</p>
                                <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-1.5 overflow-hidden">
                                    <div className="bg-indigo-500 h-1.5 rounded-full" style={{ width: `${item.pct}%` }} />
                                </div>
                            </div>
                        );
                    })}
                </div>
            </Card>

            {/* Auto-Recharge Settings Panel */}
            <Card className="border border-slate-200 dark:border-slate-800 shadow-sm p-6 space-y-6">
                <div className="flex items-start justify-between">
                    <div>
                        <h3 className="font-bold text-lg text-slate-900 dark:text-white flex items-center gap-2">
                            <RefreshCw size={20} className="text-emerald-500" /> Automatic Token Auto-Recharge Rules
                        </h3>
                        <p className="text-xs text-slate-500 mt-0.5">
                            Automatically purchase a $5 AI Power Pack (1,000,000 tokens) whenever your remaining token balance drops below a set threshold.
                        </p>
                    </div>

                    <label className="relative inline-flex items-center cursor-pointer">
                        <input 
                            type="checkbox" 
                            checked={autoEnabled} 
                            onChange={e => setAutoEnabled(e.target.checked)} 
                            className="sr-only peer" 
                        />
                        <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                    </label>
                </div>

                {autoEnabled && (
                    <div className="p-4 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                    Trigger Threshold (% Remaining Tokens)
                                </label>
                                <select
                                    value={thresholdPct}
                                    onChange={e => setThresholdPct(Number(e.target.value))}
                                    className="w-full text-sm font-semibold bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 text-slate-900 dark:text-white"
                                >
                                    <option value={5}>5% Remaining Tokens</option>
                                    <option value={10}>10% Remaining Tokens (Recommended)</option>
                                    <option value={20}>20% Remaining Tokens</option>
                                    <option value={25}>25% Remaining Tokens</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                    Auto-Purchase Action
                                </label>
                                <input
                                    type="text"
                                    disabled
                                    value="Buy 1x AI Power Pack (1M tokens for $5.00)"
                                    className="w-full text-sm font-medium bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-slate-500 cursor-not-allowed"
                                />
                            </div>
                        </div>

                        {!hasVaultedMethod && (
                            <p className="text-xs text-amber-600 font-semibold flex items-center gap-1">
                                <ShieldAlert size={14} /> You need to add a payment method before auto-recharge can trigger.
                            </p>
                        )}
                    </div>
                )}

                <div className="flex justify-end pt-2">
                    <button
                        onClick={handleSaveAutoRecharge}
                        disabled={isSavingAuto}
                        className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-md transition disabled:opacity-50 flex items-center gap-1.5"
                    >
                        <CheckCircle size={14} /> {isSavingAuto ? 'Saving Rules...' : 'Save Auto-Recharge Rules'}
                    </button>
                </div>
            </Card>
        </div>
    );
};
