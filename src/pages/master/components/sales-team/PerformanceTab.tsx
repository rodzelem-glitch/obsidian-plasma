
import React from 'react';
import Card from 'components/ui/Card';
import Table from 'components/ui/Table';
import type { User } from 'types';

interface PerformanceTabProps {
    repStats: (User & { totalLeads: number; totalRevenue: number; wins: number; conversionRate: number })[];
}

const PerformanceTab: React.FC<PerformanceTabProps> = ({ repStats }) => {
    const formatCurrency = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 p-6">
                    <p className="text-xs font-black text-emerald-700 uppercase tracking-widest mb-1">Total Pipeline Revenue</p>
                    <p className="text-3xl font-black text-emerald-900 dark:text-white">${repStats.reduce((sum, r) => sum + r.totalRevenue, 0).toLocaleString()}</p>
                </Card>
                <Card className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 p-6">
                    <p className="text-xs font-black text-blue-700 uppercase tracking-widest mb-1">Active Leads</p>
                    <p className="text-3xl font-black text-blue-900 dark:text-white">{repStats.reduce((sum, r) => sum + r.totalLeads, 0)}</p>
                </Card>
                <Card className="bg-purple-50 dark:bg-purple-900/20 border-purple-200 p-6">
                    <p className="text-xs font-black text-purple-700 uppercase tracking-widest mb-1">Closed Deals</p>
                    <p className="text-3xl font-black text-purple-900 dark:text-white">{repStats.reduce((sum, r) => sum + r.wins, 0)}</p>
                </Card>
            </div>

            <Card>
                <h3 className="font-bold text-slate-900 dark:text-white mb-4">Rep Leaderboard</h3>
                <Table headers={['Representative', 'Closed Revenue', 'Total Leads', 'Close Rate', 'Status']}>
                    {repStats.map((rep, idx) => (
                        <tr key={rep.id} className="hover:bg-slate-50 dark:hover:bg-slate-800">
                            <td className="px-6 py-4">
                                <div className="flex items-center gap-3">
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs text-white ${idx === 0 ? 'bg-yellow-500' : idx === 1 ? 'bg-slate-400' : 'bg-slate-300'}`}>
                                        #{idx + 1}
                                    </div>
                                    <span className="font-bold text-slate-900 dark:text-white">{rep.firstName} {rep.lastName}</span>
                                </div>
                            </td>
                            <td className="px-6 py-4 font-black text-emerald-600">{formatCurrency(rep.totalRevenue)}</td>
                            <td className="px-6 py-4">{rep.totalLeads}</td>
                            <td className="px-6 py-4">
                                <div className="flex items-center gap-2">
                                    <div className="w-16 h-2 bg-slate-200 rounded-full overflow-hidden">
                                        <div className="h-full bg-blue-500" style={{ width: `${Math.min(100, rep.conversionRate)}%` }}></div>
                                    </div>
                                    <span className="text-xs font-bold">{rep.conversionRate.toFixed(1)}%</span>
                                </div>
                            </td>
                            <td className="px-6 py-4">
                                <span className={`text-[10px] font-black uppercase px-2 py-1 rounded ${rep.totalRevenue > 0 ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                                    {rep.totalRevenue > 0 ? 'Active' : 'No Sales'}
                                </span>
                            </td>
                        </tr>
                    ))}
                </Table>
            </Card>
        </div>
    );
};

export default PerformanceTab;
