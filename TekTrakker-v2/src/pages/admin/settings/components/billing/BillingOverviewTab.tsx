import React, { useState } from 'react';
import Card from 'components/ui/Card';
import { 
    Zap, CreditCard, Building2, Copy, Check, Calendar, Users, 
    Layers, Bot, ArrowUpRight, ShieldCheck, AlertCircle, Clock
} from 'lucide-react';
import showToast from 'lib/toast';
import { useAppContext } from 'context/AppContext';

interface BillingOverviewTabProps {
    billingDetails: {
        planName: string;
        monthlyCost: number;
        maxUsers: number;
        activeUsers: number;
        isExpired: boolean;
        isTrial: boolean;
        isFree: boolean;
        isPaused?: boolean;
        isCancelled?: boolean;
    };
    orgId: string;
    vaultedType?: string | null;
    hasVaultedMethod: boolean;
    vwUsage: { used: number; limit: number };
    divisionsCount: number;
    maxDivisions: number;
    virtualWorkerEnabled: boolean;
    onNavigateTab: (tabKey: string) => void;
}

export const BillingOverviewTab: React.FC<BillingOverviewTabProps> = ({
    billingDetails,
    orgId,
    vaultedType,
    hasVaultedMethod,
    vwUsage,
    divisionsCount,
    maxDivisions,
    virtualWorkerEnabled,
    onNavigateTab
}) => {
    const { state } = useAppContext();
    const [copiedSid, setCopiedSid] = useState(false);

    const planKey = (state.currentOrganization?.plan || 'starter').toLowerCase();
    const slaText = state.platformSettings?.plans?.[planKey]?.supportResponseTime || 
        (planKey === 'enterprise' ? '1-2 Hour Support SLA' : planKey === 'growth' ? '24-Hour Support SLA' : planKey === 'starter' ? '3-Day Guarantee' : 'Standard Support');

    const handleCopySid = () => {
        if (!orgId) return;
        navigator.clipboard.writeText(orgId);
        setCopiedSid(true);
        showToast.success("Organization SID copied to clipboard");
        setTimeout(() => setCopiedSid(false), 2000);
    };

    const tokenPct = vwUsage.limit > 0 ? Math.min(100, (vwUsage.used / vwUsage.limit) * 100) : 0;
    const userPct = billingDetails.maxUsers > 0 ? Math.min(100, (billingDetails.activeUsers / billingDetails.maxUsers) * 100) : 0;
    const divPct = maxDivisions > 0 ? Math.min(100, (divisionsCount / maxDivisions) * 100) : 0;

    return (
        <div className="space-y-6">
            {/* Top Account SID & Quick Status Header */}
            <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-xl relative overflow-hidden border border-slate-800">
                <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
                    <Zap size={220} className="text-blue-400" />
                </div>
                
                <div className="relative z-10 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
                    <div>
                        <div className="flex flex-wrap items-center gap-3 mb-3">
                            <span className="text-xs font-bold uppercase tracking-widest bg-blue-500/20 text-blue-300 px-3 py-1 rounded-full border border-blue-400/30">
                                Account Console
                            </span>
                            <span className="bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-xs font-bold px-2.5 py-1 rounded-full flex items-center gap-1">
                                <ShieldCheck size={12} /> {slaText}
                            </span>
                            {billingDetails.isTrial && (
                                <span className="bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-bold px-2.5 py-1 rounded-full flex items-center gap-1">
                                    <Clock size={12} /> 14-Day Trial
                                </span>
                            )}
                            {billingDetails.isFree && (
                                <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-bold px-2.5 py-1 rounded-full flex items-center gap-1">
                                    <ShieldCheck size={12} /> Partner Access
                                </span>
                            )}
                            {billingDetails.isPaused && (
                                <span className="bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-bold px-2.5 py-1 rounded-full">
                                    Subscription Paused
                                </span>
                            )}
                            {billingDetails.isCancelled && (
                                <span className="bg-red-500/20 text-red-300 border border-red-500/30 text-xs font-bold px-2.5 py-1 rounded-full">
                                    Cancelled
                                </span>
                            )}
                            {!billingDetails.isTrial && !billingDetails.isFree && !billingDetails.isPaused && !billingDetails.isCancelled && (
                                <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-bold px-2.5 py-1 rounded-full flex items-center gap-1">
                                    <Check size={12} /> Account Active
                                </span>
                            )}
                        </div>

                        <h2 className="text-3xl font-black tracking-tight text-white capitalize">
                            {billingDetails.planName} Plan
                        </h2>

                        <div className="flex items-center gap-2 mt-2 text-slate-400 text-sm">
                            <span>Account SID:</span>
                            <code className="bg-slate-800 px-2 py-0.5 rounded text-blue-400 font-mono text-xs border border-slate-700">
                                {orgId || 'org-unknown'}
                            </code>
                            <button 
                                onClick={handleCopySid}
                                className="p-1 hover:text-white transition-colors text-slate-400"
                                title="Copy Account SID"
                            >
                                {copiedSid ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                            </button>
                        </div>
                    </div>

                    <div className="flex flex-col items-start lg:items-end">
                        <div className="text-left lg:text-right">
                            <span className="text-xs text-slate-400 uppercase font-semibold tracking-wider">Current Monthly Rate</span>
                            <p className="text-4xl font-black text-white">
                                ${billingDetails.monthlyCost.toFixed(2)}
                                <span className="text-slate-400 text-base font-normal"> / mo</span>
                            </p>
                        </div>

                        <div className="flex flex-wrap gap-2 mt-4">
                            <button
                                onClick={() => onNavigateTab('plans')}
                                className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs px-4 py-2 rounded-lg transition shadow-lg flex items-center gap-1.5"
                            >
                                Upgrade Plan <ArrowUpRight size={14} />
                            </button>
                            <button
                                onClick={() => onNavigateTab('addons')}
                                className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs px-4 py-2 rounded-lg transition border border-slate-700 flex items-center gap-1.5"
                            >
                                <Zap size={14} className="text-amber-400" /> Add Tokens & Seats
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Quick Status Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="border border-slate-200 dark:border-slate-800 shadow-sm p-5">
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Payment Status</span>
                        <div className={`p-2 rounded-lg ${hasVaultedMethod ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30' : 'bg-amber-50 text-amber-600 dark:bg-amber-950/30'}`}>
                            {vaultedType === 'ach_debit' ? <Building2 size={18} /> : <CreditCard size={18} />}
                        </div>
                    </div>
                    <p className="text-lg font-bold text-slate-900 dark:text-white">
                        {hasVaultedMethod ? (vaultedType === 'ach_debit' ? 'Vaulted Bank (ACH)' : 'Vaulted Card') : 'No Card Linked'}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                        {hasVaultedMethod ? 'Automatic monthly charges enabled' : 'Add a payment method to avoid suspension'}
                    </p>
                    <button 
                        onClick={() => onNavigateTab('payment_methods')}
                        className="mt-3 text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                    >
                        {hasVaultedMethod ? 'Update Payment Method' : 'Add Payment Method'} →
                    </button>
                </Card>

                <Card className="border border-slate-200 dark:border-slate-800 shadow-sm p-5">
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Next Billing Date</span>
                        <div className="p-2 rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/30">
                            <Calendar size={18} />
                        </div>
                    </div>
                    <p className="text-lg font-bold text-slate-900 dark:text-white">
                        {new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">Auto-renews monthly unless cancelled</p>
                    <button 
                        onClick={() => onNavigateTab('invoices')}
                        className="mt-3 text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                    >
                        View Recent Invoices →
                    </button>
                </Card>

                <Card className="border border-slate-200 dark:border-slate-800 shadow-sm p-5">
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Virtual Worker Agent</span>
                        <div className={`p-2 rounded-lg ${virtualWorkerEnabled ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/30' : 'bg-slate-100 text-slate-400 dark:bg-slate-800'}`}>
                            <Bot size={18} />
                        </div>
                    </div>
                    <p className="text-lg font-bold text-slate-900 dark:text-white">
                        {virtualWorkerEnabled ? 'Active & Processing' : 'Disabled'}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                        {virtualWorkerEnabled ? 'Autonomous proposals & smart dispatch' : 'Enable AI worker in Add-ons'}
                    </p>
                    <button 
                        onClick={() => onNavigateTab('tokens')}
                        className="mt-3 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                    >
                        Token Consumption Logs →
                    </button>
                </Card>
            </div>

            {/* Metering & Resource Limits Panel */}
            <Card className="border border-slate-200 dark:border-slate-800 shadow-sm p-6 space-y-6">
                <div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <Zap className="text-amber-500" size={20} /> Current Usage & Metered Quotas
                    </h3>
                    <p className="text-xs text-slate-500">Real-time resource utilization against your active subscription limits</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* AI Token Meter */}
                    <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                                <Zap size={14} className="text-indigo-500" /> AI Tokens
                            </span>
                            <span className={`text-xs font-bold ${tokenPct >= 90 ? 'text-red-500' : 'text-indigo-600'}`}>
                                {tokenPct.toFixed(0)}%
                            </span>
                        </div>
                        <p className="text-xl font-bold text-slate-900 dark:text-white mb-2">
                            {vwUsage.used.toLocaleString()} <span className="text-xs text-slate-500 font-normal">/ {vwUsage.limit.toLocaleString()}</span>
                        </p>
                        <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2 overflow-hidden">
                            <div 
                                className={`h-2 rounded-full transition-all duration-500 ${tokenPct >= 90 ? 'bg-red-500' : 'bg-indigo-600'}`}
                                style={{ width: `${tokenPct}%` }}
                            />
                        </div>
                        {tokenPct >= 100 && (
                            <p className="text-[11px] text-red-500 mt-2 font-semibold flex items-center gap-1">
                                <AlertCircle size={12} /> Tokens depleted. AI tasks paused.
                            </p>
                        )}
                    </div>

                    {/* Active User Seats Meter */}
                    <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                                <Users size={14} className="text-blue-500" /> User Seats
                            </span>
                            <span className={`text-xs font-bold ${userPct >= 90 ? 'text-amber-500' : 'text-blue-600'}`}>
                                {userPct.toFixed(0)}%
                            </span>
                        </div>
                        <p className="text-xl font-bold text-slate-900 dark:text-white mb-2">
                            {billingDetails.activeUsers} <span className="text-xs text-slate-500 font-normal">/ {billingDetails.maxUsers} Active</span>
                        </p>
                        <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2 overflow-hidden">
                            <div 
                                className={`h-2 rounded-full transition-all duration-500 ${userPct >= 90 ? 'bg-amber-500' : 'bg-blue-600'}`}
                                style={{ width: `${userPct}%` }}
                            />
                        </div>
                        <p className="text-[11px] text-slate-500 mt-2">
                            {billingDetails.maxUsers - billingDetails.activeUsers} seats remaining in current plan
                        </p>
                    </div>

                    {/* Divisions Meter */}
                    <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                                <Layers size={14} className="text-emerald-500" /> Divisions & Brands
                            </span>
                            <span className={`text-xs font-bold ${divPct >= 90 ? 'text-amber-500' : 'text-emerald-600'}`}>
                                {divPct.toFixed(0)}%
                            </span>
                        </div>
                        <p className="text-xl font-bold text-slate-900 dark:text-white mb-2">
                            {divisionsCount} <span className="text-xs text-slate-500 font-normal">/ {maxDivisions} Configured</span>
                        </p>
                        <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2 overflow-hidden">
                            <div 
                                className={`h-2 rounded-full transition-all duration-500 ${divPct >= 90 ? 'bg-amber-500' : 'bg-emerald-600'}`}
                                style={{ width: `${divPct}%` }}
                            />
                        </div>
                        <p className="text-[11px] text-slate-500 mt-2">
                            Add extra division slots for $79/mo each
                        </p>
                    </div>
                </div>
            </Card>
        </div>
    );
};
