
import React from 'react';
import Card from 'components/ui/Card';
import { User, BusinessDocument } from 'types';
import { CheckCircle, XCircle, Info } from 'lucide-react';

interface PolicyTrackingTabProps {
    employees: User[];
    policies: BusinessDocument[];
}

const PolicyTrackingTab: React.FC<PolicyTrackingTabProps> = ({ employees, policies }) => {
    return (
        <Card className="shadow-lg border-0">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Compliance Tracking Matrix</h3>
                    <p className="text-xs font-medium text-slate-500">Real-time status of all employee policy acknowledgments.</p>
                </div>
                <div className="flex gap-4">
                    <div className="flex items-center gap-1.5">
                        <CheckCircle size={14} className="text-emerald-500"/>
                        <span className="text-[10px] font-black uppercase text-slate-400">Signed</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <XCircle size={14} className="text-rose-300"/>
                        <span className="text-[10px] font-black uppercase text-slate-400">Pending</span>
                    </div>
                </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-100 dark:border-slate-800">
                <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
                    <thead className="bg-slate-50 dark:bg-slate-900">
                        <tr>
                            <th className="px-6 py-4 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest border-r dark:border-slate-800">Team Member</th>
                            {policies.map(p => (
                                <th key={p.id} className="px-4 py-4 text-center text-[10px] font-black text-slate-500 uppercase tracking-widest">
                                    <div className="max-w-[120px] mx-auto truncate" title={p.title}>{p.title}</div>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-slate-900 divide-y divide-slate-100 dark:divide-slate-800">
                        {employees.map(emp => (
                            <tr key={emp.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                <td className="px-6 py-4 whitespace-nowrap border-r dark:border-slate-800">
                                    <div className="flex flex-col">
                                        <span className="text-sm font-black text-slate-900 dark:text-white">{emp.firstName} {emp.lastName}</span>
                                        <span className="text-[10px] font-bold text-slate-400 uppercase">{emp.role.replace('_', ' ')}</span>
                                    </div>
                                </td>
                                {policies.map(p => {
                                    // Robust check for signature in metadata
                                    const signedDate = emp.signedPolicies?.[p.id];
                                    
                                    // Support legacy handbook date if applicable
                                    const legacySigned = (p.type === 'Handbook' || p.title.toLowerCase().includes('handbook')) && emp.handbookSignedDate;
                                    
                                    const isSigned = !!signedDate || !!legacySigned;
                                    const displayDate = signedDate || (legacySigned ? emp.handbookSignedDate : null);
                                    
                                    return (
                                        <td key={p.id} className="px-4 py-4 text-center">
                                            {isSigned ? (
                                                <div className="flex flex-col items-center gap-1 group relative">
                                                    <CheckCircle size={20} className="text-emerald-500" />
                                                    <span className="text-[8px] font-black text-emerald-600/50 uppercase">
                                                        {displayDate ? new Date(displayDate).toLocaleDateString() : 'SIGNED'}
                                                    </span>
                                                    {/* Tooltip for exact timestamp */}
                                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-slate-900 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-20">
                                                        Signed: {displayDate ? new Date(displayDate).toLocaleString() : 'N/A'}
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="flex flex-col items-center gap-1">
                                                    <XCircle size={20} className="text-slate-200 dark:text-slate-700" />
                                                    <span className="text-[8px] font-black text-slate-300 dark:text-slate-600 uppercase tracking-tighter">Required</span>
                                                </div>
                                            )}
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                        {employees.length === 0 && (
                            <tr><td colSpan={policies.length + 1} className="p-6 md:p-12 text-center text-slate-400 font-medium italic">No employees found in registry.</td></tr>
                        )}
                        {policies.length === 0 && (
                            <tr><td colSpan={employees.length + 1} className="p-6 md:p-12 text-center text-slate-400 font-medium italic">No active policies or handbooks found.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
            
            <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/10 rounded-2xl border border-blue-100 dark:border-blue-900 flex items-start gap-3">
                <Info size={18} className="text-blue-500 mt-0.5" />
                <div>
                    <p className="text-xs font-black text-blue-900 dark:text-blue-300 uppercase tracking-tight">Compliance Auto-Audit</p>
                    <p className="text-[11px] font-medium text-blue-700 dark:text-blue-400 mt-1">
                        Employees can sign these documents by navigating to the "Compliance &amp; Safety &gt; My Documents" tab. Once signed, the matrix above updates instantly.
                    </p>
                </div>
            </div>
        </Card>
    );
};

export default PolicyTrackingTab;
