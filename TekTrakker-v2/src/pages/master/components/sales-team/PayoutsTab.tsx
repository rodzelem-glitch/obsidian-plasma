
import React from 'react';
import Card from 'components/ui/Card';
import Table from 'components/ui/Table';
import Button from 'components/ui/Button';
import { CheckCircle } from 'lucide-react';
import type { User, PlatformCommission } from 'types';

interface PayoutsTabProps {
    payoutData: {
        totalPending: number;
        totalPaidYTD: number;
        buckets: { current: number; days30: number; days60: number; days90: number };
        displayList: PlatformCommission[];
    };
    payoutFilter: 'Pending' | 'Paid';
    setPayoutFilter: (filter: 'Pending' | 'Paid') => void;
    salesReps: User[];
    onMarkPaid: (commissionId: string) => void;
}

const PayoutsTab: React.FC<PayoutsTabProps> = ({ payoutData, payoutFilter, setPayoutFilter, salesReps, onMarkPaid }) => {
    return (
        <div className="space-y-6 animate-fade-in">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="bg-orange-50 border-orange-200 p-4">
                    <p className="text-xs font-black text-orange-700 uppercase tracking-widest">Total Pending</p>
                    <p className="text-2xl font-black text-orange-900 dark:text-white mt-1">${payoutData.totalPending.toLocaleString()}</p>
                </Card>
                <Card className="bg-emerald-50 border-emerald-200 p-4">
                    <p className="text-xs font-black text-emerald-700 uppercase tracking-widest">Paid YTD</p>
                    <p className="text-2xl font-black text-emerald-900 dark:text-white mt-1">${payoutData.totalPaidYTD.toLocaleString()}</p>
                </Card>
                <Card className="bg-slate-50 border-slate-200 p-4">
                    <p className="text-xs font-black text-slate-500 uppercase tracking-widest">30-60 Days Aging</p>
                    <p className="text-2xl font-black text-slate-800 dark:text-white mt-1">${payoutData.buckets.days30.toLocaleString()}</p>
                </Card>
                <Card className="bg-rose-50 border-rose-200 p-4">
                    <p className="text-xs font-black text-rose-700 uppercase tracking-widest">90+ Days Aging</p>
                    <p className="text-2xl font-black text-rose-900 dark:text-white mt-1">${payoutData.buckets.days90.toLocaleString()}</p>
                </Card>
            </div>

            <Card>
                <div className="flex justify-between items-center mb-6">
                    <h3 className="font-bold text-slate-900 dark:text-white">Commission Payouts</h3>
                    <div className="flex bg-slate-100 dark:bg-slate-700 p-1 rounded-lg">
                        <button onClick={() => setPayoutFilter('Pending')} className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${payoutFilter === 'Pending' ? 'bg-white text-orange-600 shadow' : 'text-slate-500'}`}>Pending</button>
                        <button onClick={() => setPayoutFilter('Paid')} className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${payoutFilter === 'Paid' ? 'bg-white text-emerald-600 shadow' : 'text-slate-500'}`}>Paid History</button>
                    </div>
                </div>

                <Table headers={['Representative', 'Organization/Deal', 'Earned Date', 'Aging', 'Amount', 'Action']}>
                    {payoutData.displayList.map(comm => {
                        const rep = salesReps.find(r => r.id === comm.repId);
                        const diffDays = Math.ceil((new Date().getTime() - new Date(comm.dateEarned).getTime()) / (1000 * 60 * 60 * 24));
                        return (
                            <tr key={comm.id} className="hover:bg-slate-50 dark:hover:bg-slate-800">
                                <td className="px-6 py-4 font-bold text-slate-900 dark:text-white">{rep ? `${rep.firstName} ${rep.lastName}` : 'Unknown Rep'}</td>
                                <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300">
                                    {comm.organizationName}
                                    <div className="text-[10px] text-slate-400">Rate: {(comm.rateUsed * 100).toFixed(0)}%</div>
                                </td>
                                <td className="px-6 py-4 text-sm font-mono">{new Date(comm.dateEarned).toLocaleDateString()}</td>
                                <td className="px-6 py-4">
                                    {payoutFilter === 'Pending' ? (
                                        <span className={`text-xs font-bold px-2 py-1 rounded ${diffDays > 30 ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'}`}>
                                            {diffDays} Days
                                        </span>
                                    ) : (
                                        <span className="text-xs text-emerald-600 font-bold flex items-center gap-1"><CheckCircle size={12}/> Paid</span>
                                    )}
                                </td>
                                <td className="px-6 py-4 font-black text-slate-800 dark:text-white">${comm.amount.toLocaleString()}</td>
                                <td className="px-6 py-4">
                                    {payoutFilter === 'Pending' && (
                                        <Button onClick={() => onMarkPaid(comm.id)} className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-8">
                                            Mark Paid
                                        </Button>
                                    )}
                                    {payoutFilter === 'Paid' && comm.datePaid && (
                                        <span className="text-xs text-slate-400">{new Date(comm.datePaid).toLocaleDateString()}</span>
                                    )}
                                </td>
                            </tr>
                        );
                    })}
                    {payoutData.displayList.length === 0 && <tr><td colSpan={6} className="p-4 md:p-8 text-center text-slate-500">No records found.</td></tr>}
                </Table>
            </Card>
        </div>
    );
};

export default PayoutsTab;
