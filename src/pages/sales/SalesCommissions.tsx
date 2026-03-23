
import React, { useState, useEffect } from 'react';
import { useAppContext } from 'context/AppContext';
import Card from 'components/ui/Card';
import Table from 'components/ui/Table';
import { db } from 'lib/firebase';
import type { PlatformCommission } from 'types';
import { DollarSign, CheckCircle } from 'lucide-react';

const SalesCommissions: React.FC = () => {
    const { state } = useAppContext();
    const { currentUser } = state;
    const [commissions, setCommissions] = useState<PlatformCommission[]>([]);
    const [filter, setFilter] = useState<'All' | 'Paid' | 'Pending'>('All');

    useEffect(() => {
        if (!currentUser) return;
        const unsub = db.collection('platformCommissions')
            .where('repId', '==', currentUser.id)
            .onSnapshot(snap => {
                const data = snap.docs.map(d => ({ ...d.data(), id: d.id } as PlatformCommission));
                setCommissions(data);
            });
        return () => unsub();
    }, [currentUser]);

    const totalEarned = commissions.reduce((sum, c) => sum + c.amount, 0);
    const totalPaid = commissions.filter(c => c.status === 'Paid').reduce((sum, c) => sum + c.amount, 0);
    const pending = totalEarned - totalPaid;

    const filteredList = commissions.filter(c => filter === 'All' || c.status === filter);

    return (
        <div className="space-y-6">
            <header>
                <h2 className="text-3xl font-bold text-slate-900 dark:text-white">Commission Ledger</h2>
                <p className="text-slate-500">Track your earnings and payouts.</p>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card 
                    className="bg-emerald-600 text-white border-0 shadow-lg cursor-pointer hover:scale-105 transition-transform"
                    onClick={() => setFilter('All')}
                >
                    <p className="text-emerald-900/80 text-xs font-black uppercase tracking-widest">Total Earnings (YTD)</p>
                    <p className="text-4xl font-black mt-2 text-white drop-shadow-md">${totalEarned.toLocaleString()}</p>
                </Card>
                <Card 
                    className={`bg-white dark:bg-slate-800 border-l-4 border-blue-500 cursor-pointer hover:shadow-lg transition-all ${filter === 'Paid' ? 'ring-2 ring-blue-500' : ''}`}
                    onClick={() => setFilter('Paid')}
                >
                    <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">Paid Out</p>
                    <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">${totalPaid.toLocaleString()}</p>
                </Card>
                <Card 
                    className={`bg-white dark:bg-slate-800 border-l-4 border-orange-500 cursor-pointer hover:shadow-lg transition-all ${filter === 'Pending' ? 'ring-2 ring-orange-500' : ''}`}
                    onClick={() => setFilter('Pending')}
                >
                    <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">Pending Payout</p>
                    <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">${pending.toLocaleString()}</p>
                </Card>
            </div>

            <Card>
                <div className="flex justify-between items-center mb-4">
                     <h3 className="font-bold text-slate-700 dark:text-slate-300">Transaction History</h3>
                     <span className="text-xs font-bold uppercase bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded text-slate-500">Filter: {filter}</span>
                </div>
                <Table headers={['Date', 'Organization Sold', 'Deal Value', 'Rate', 'Commission', 'Status']}>
                    {filteredList.map(comm => (
                        <tr key={comm.id} className="hover:bg-slate-50 dark:hover:bg-slate-800 cursor-default">
                            <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">{new Date(comm.dateEarned).toLocaleDateString()}</td>
                            <td className="px-6 py-4 font-bold text-slate-900 dark:text-white">{comm.organizationName}</td>
                            <td className="px-6 py-4">${comm.baseAmount.toLocaleString()}</td>
                            <td className="px-6 py-4">{(comm.rateUsed * 100).toFixed(0)}%</td>
                            <td className="px-6 py-4 font-bold text-emerald-600">+${comm.amount.toLocaleString()}</td>
                            <td className="px-6 py-4">
                                <span className={`px-2 py-1 rounded text-xs font-black uppercase ${comm.status === 'Paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-orange-100 text-orange-700'}`}>
                                    {comm.status}
                                </span>
                            </td>
                        </tr>
                    ))}
                    {filteredList.length === 0 && <tr><td colSpan={6} className="p-4 md:p-8 text-center text-slate-400">No records found.</td></tr>}
                </Table>
            </Card>
        </div>
    );
};

export default SalesCommissions;
