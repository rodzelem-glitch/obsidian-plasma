
import React, { useState, useEffect } from 'react';
import { useAppContext } from 'context/AppContext';
import Card from 'components/ui/Card';
import Table from 'components/ui/Table';
import { db } from 'lib/firebase';
import type { PlatformCommission } from 'types';
import { DollarSign, CheckCircle, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const SalesCommissions: React.FC = () => {
    const { state } = useAppContext();
    const { currentUser } = state;
    const navigate = useNavigate();
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

    const totalPaid = commissions.filter(c => c.status === 'Paid').reduce((sum, c) => sum + c.amount, 0);
    const pendingPayoutEarned = commissions.filter(c => c.status === 'Pending' && c.customerPaymentStatus === 'Paid').reduce((sum, c) => sum + c.amount, 0);
    const awaitingCustomerPayment = commissions.filter(c => c.status === 'Pending' && c.customerPaymentStatus !== 'Paid').reduce((sum, c) => sum + c.amount, 0);
    const totalEarned = totalPaid + pendingPayoutEarned;

    const filteredList = commissions.filter(c => {
        if (filter === 'All') return true;
        if (filter === 'Paid') return c.status === 'Paid';
        if (filter === 'Pending') return c.status === 'Pending';
        return true;
    });

    return (
        <div className="space-y-6">
            <header className="flex items-start gap-4">
                <button onClick={() => navigate(-1)} title="Go Back" aria-label="Go Back" className="mt-1 p-2 -ml-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">
                    <ArrowLeft size={24} />
                </button>
                <div>
                    <h2 className="text-3xl font-bold text-slate-900 dark:text-white">Commission Ledger</h2>
                    <p className="text-slate-500">Track your earnings and payouts.</p>
                </div>
            </header>
 
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <Card 
                    className="bg-emerald-600 text-white border-0 shadow-lg cursor-pointer hover:scale-105 transition-transform animate-fade-in"
                    onClick={() => setFilter('All')}
                >
                    <p className="text-emerald-900/80 text-xs font-black uppercase tracking-widest">Total Earned (YTD)</p>
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
                    <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">Pending Payout (Earned)</p>
                    <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">${pendingPayoutEarned.toLocaleString()}</p>
                </Card>
                <Card 
                    className={`bg-white dark:bg-slate-800 border-l-4 border-slate-400 cursor-pointer hover:shadow-lg transition-all`}
                >
                    <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">Awaiting Cust. Payment</p>
                    <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">${awaitingCustomerPayment.toLocaleString()}</p>
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
                            <td className="px-6 py-4">${comm.baseAmount?.toLocaleString() || '0'}</td>
                            <td className="px-6 py-4">{comm.rateUsed ? (comm.rateUsed * 100).toFixed(0) : '0'}%</td>
                            <td className="px-6 py-4 font-bold text-emerald-600">+${comm.amount?.toLocaleString() || '0'}</td>
                            <td className="px-6 py-4">
                                <span className={`px-2 py-1 rounded text-xs font-black uppercase ${
                                    comm.status === 'Paid' ? 'bg-emerald-100 text-emerald-700' : 
                                    comm.customerPaymentStatus === 'Paid' ? 'bg-orange-100 text-orange-700' : 'bg-slate-100 text-slate-500'
                                }`}>
                                    {comm.status === 'Paid' ? 'Paid' : comm.customerPaymentStatus === 'Paid' ? 'Earned (Pending)' : 'Awaiting Cust. Pay'}
                                </span>
                            </td>
                        </tr>
                    ))}
                    {filteredList.length === 0 && <tr><td colSpan={6} className="p-4 md:p-8 text-center text-slate-500">No records found.</td></tr>}
                </Table>
            </Card>
        </div>
    );
};

export default SalesCommissions;
