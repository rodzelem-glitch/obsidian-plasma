import React from 'react';
import Card from 'components/ui/Card';
import Table from 'components/ui/Table';
import { 
    CheckCircle, XCircle, FileText, DollarSign, Edit, Trash2, 
    Clock, ShieldAlert, Sliders, Activity, UserCheck, AlertTriangle, UserX
} from 'lucide-react';
import type { User } from 'types';

interface RosterTabProps {
    salesReps: User[];
    onOpenContract: (rep: User) => void;
    onOpenTaxView: (rep: User) => void;
    onEditRep: (rep: User) => void;
    onDeleteRep: (userId: string) => void;
    onEditCompensation?: (rep: User) => void;
}

const RosterTab: React.FC<RosterTabProps> = ({ 
    salesReps, 
    onOpenContract, 
    onOpenTaxView, 
    onEditRep, 
    onDeleteRep,
    onEditCompensation 
}) => {
    // Activity Calculation Helper
    const getActivityInfo = (rep: User) => {
        if (!rep.lastLoginAt) {
            return {
                label: 'Never Logged In',
                days: null,
                status: 'never',
                badgeClass: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
                dotClass: 'bg-slate-400',
                description: 'No recorded portal logins'
            };
        }

        const lastLoginTime = new Date(rep.lastLoginAt).getTime();
        const diffMs = Date.now() - lastLoginTime;
        const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        let timeStr = 'Today';
        if (days === 1) timeStr = 'Yesterday';
        else if (days > 1) timeStr = `${days}d ago`;

        if (days < 7) {
            return {
                label: `Active (${timeStr})`,
                days,
                status: 'active',
                badgeClass: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
                dotClass: 'bg-emerald-500 animate-pulse',
                description: `Logged in ${timeStr}`
            };
        } else if (days < 30) {
            return {
                label: `Infrequent (${timeStr})`,
                days,
                status: 'infrequent',
                badgeClass: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
                dotClass: 'bg-blue-500',
                description: `Last active ${timeStr}`
            };
        } else if (days < 60) {
            return {
                label: `At Risk (${days}d Inactive)`,
                days,
                status: 'warning',
                badgeClass: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
                dotClass: 'bg-amber-500',
                description: `${days} days without login. Section 10 notice to cure pending.`
            };
        } else {
            return {
                label: `Abandoned (${days}d Inactive)`,
                days,
                status: 'abandoned',
                badgeClass: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
                dotClass: 'bg-red-500',
                description: `${days} days inactive! Section 10 platform abandonment cliff reached.`
            };
        }
    };

    // Summary counters
    const activeCount = salesReps.filter(r => {
        if (!r.lastLoginAt) return false;
        const d = Math.floor((Date.now() - new Date(r.lastLoginAt).getTime()) / (1000 * 60 * 60 * 24));
        return d < 14;
    }).length;

    const atRiskCount = salesReps.filter(r => {
        if (!r.lastLoginAt) return false;
        const d = Math.floor((Date.now() - new Date(r.lastLoginAt).getTime()) / (1000 * 60 * 60 * 24));
        return d >= 14 && d < 60;
    }).length;

    const abandonedCount = salesReps.filter(r => {
        if (!r.lastLoginAt) return false;
        const d = Math.floor((Date.now() - new Date(r.lastLoginAt).getTime()) / (1000 * 60 * 60 * 24));
        return d >= 60;
    }).length;

    return (
        <div className="space-y-4">
            {/* Activity & Inactivity Audit Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center gap-3">
                    <div className="p-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg">
                        <UserCheck size={18} />
                    </div>
                    <div>
                        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Total Roster</span>
                        <span className="text-xl font-black text-slate-900 dark:text-white">{salesReps.length} reps</span>
                    </div>
                </div>

                <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl border border-emerald-200 dark:border-emerald-800 flex items-center gap-3">
                    <div className="p-2 bg-emerald-500 text-white rounded-lg">
                        <Activity size={18} />
                    </div>
                    <div>
                        <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300 uppercase tracking-wider block">Active (&lt;14d)</span>
                        <span className="text-xl font-black text-emerald-800 dark:text-emerald-200">{activeCount} reps</span>
                    </div>
                </div>

                <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-800 flex items-center gap-3">
                    <div className="p-2 bg-amber-500 text-white rounded-lg">
                        <AlertTriangle size={18} />
                    </div>
                    <div>
                        <span className="text-[11px] font-bold text-amber-700 dark:text-amber-300 uppercase tracking-wider block">At Risk (14-59d)</span>
                        <span className="text-xl font-black text-amber-800 dark:text-amber-200">{atRiskCount} reps</span>
                    </div>
                </div>

                <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-800 flex items-center gap-3">
                    <div className="p-2 bg-red-500 text-white rounded-lg">
                        <UserX size={18} />
                    </div>
                    <div>
                        <span className="text-[11px] font-bold text-red-700 dark:text-red-300 uppercase tracking-wider block">Abandoned (60d+)</span>
                        <span className="text-xl font-black text-red-800 dark:text-red-200">{abandonedCount} reps</span>
                    </div>
                </div>
            </div>

            <Card>
                <Table headers={['Representative', 'Login & Platform Activity', 'Sales Status', 'Comp Plan', 'Contract', 'Actions']}>
                    {salesReps.map(rep => {
                        const status = rep.salesRepStatus || 'Active';
                        const activity = getActivityInfo(rep);
                        const hasCustomRules = !!rep.customCommissionSettings;

                        return (
                            <tr key={rep.id} className="hover:bg-slate-50 dark:hover:bg-slate-800">
                                <td className="px-6 py-4">
                                    <div className="font-bold text-slate-900 dark:text-white">{rep.firstName} {rep.lastName}</div>
                                    <div className="text-xs text-slate-500">{rep.email}</div>
                                </td>

                                {/* Login & Activity Column */}
                                <td className="px-6 py-4">
                                    <div className="flex flex-col gap-1">
                                        <span 
                                            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold w-fit ${activity.badgeClass}`}
                                            title={activity.description}
                                        >
                                            <span className={`w-2 h-2 rounded-full ${activity.dotClass}`}></span>
                                            {activity.label}
                                        </span>
                                        {rep.lastSalesActivityAt && (
                                            <span className="text-[10px] text-slate-400">
                                                Deal activity: {new Date(rep.lastSalesActivityAt).toLocaleDateString()}
                                            </span>
                                        )}
                                    </div>
                                </td>

                                <td className="px-6 py-4">
                                    {status === 'Active' && (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
                                            <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span> Active
                                        </span>
                                    )}
                                    {status === 'Suspended' && (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300" title="Quarterly quota missed. Lifetime residuals paused.">
                                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span> Suspended
                                        </span>
                                    )}
                                    {(status === 'Forfeited' || status === 'Inactive') && (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300" title="Inactivity cliff or platform abandonment reached. Residuals permanently terminated.">
                                            <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span> Forfeited
                                        </span>
                                    )}
                                </td>

                                {/* Plan Type Column */}
                                <td className="px-6 py-4">
                                    {hasCustomRules ? (
                                        <button 
                                            onClick={() => onEditCompensation?.(rep)}
                                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300 hover:bg-purple-200 transition-colors"
                                            title="Click to view or edit individual compensation rules"
                                        >
                                            <Sliders size={11} /> Custom Plan ({(rep.customCommissionSettings!.baseRate * 100).toFixed(0)}%)
                                        </button>
                                    ) : (
                                        <button 
                                            onClick={() => onEditCompensation?.(rep)}
                                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300 hover:bg-slate-200 transition-colors"
                                            title="Click to override with custom rules"
                                        >
                                            Default Plan
                                        </button>
                                    )}
                                </td>

                                <td className="px-6 py-4">
                                    {rep.salesContractSigned ? (
                                        <span className="flex items-center gap-1 text-green-600 font-bold text-xs uppercase">
                                            <CheckCircle size={14} /> Signed
                                        </span>
                                    ) : (
                                        <span className="flex items-center gap-1 text-red-500 font-bold text-xs uppercase">
                                            <XCircle size={14} /> Pending
                                        </span>
                                    )}
                                </td>

                                <td className="px-6 py-4 flex gap-2.5">
                                    <button onClick={() => onOpenContract(rep)} className="text-blue-600 hover:underline text-xs font-bold flex items-center gap-1">
                                        <FileText size={14} /> Contract
                                    </button>
                                    <button onClick={() => onEditCompensation?.(rep)} className="text-purple-600 hover:underline text-xs font-bold flex items-center gap-1">
                                        <Sliders size={14} /> Comp
                                    </button>
                                    <button onClick={() => onOpenTaxView(rep)} className="text-slate-600 hover:underline text-xs font-bold flex items-center gap-1">
                                        <DollarSign size={14} /> Tax
                                    </button>
                                    <button onClick={() => onEditRep(rep)} className="text-slate-600 hover:underline text-xs font-bold flex items-center gap-1">
                                        <Edit size={14} /> Edit
                                    </button>
                                    <button onClick={() => onDeleteRep(rep.id)} className="text-red-600 hover:underline text-xs font-bold flex items-center gap-1">
                                        <Trash2 size={14} /> Delete
                                    </button>
                                </td>
                            </tr>
                        );
                    })}
                    {salesReps.length === 0 && <tr><td colSpan={6} className="p-4 md:p-8 text-center text-slate-500">No sales representatives found.</td></tr>}
                </Table>
            </Card>
        </div>
    );
};

export default RosterTab;
