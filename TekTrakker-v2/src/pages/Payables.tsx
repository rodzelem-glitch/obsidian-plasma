import showToast from "lib/toast";

import React, { useState, useMemo, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import { db } from '../lib/firebase';
import Table from '../components/ui/Table';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { CheckCircle, Clock, Search, Filter, ArrowUpRight, Building2, User } from 'lucide-react';
import type { Job } from '../types';
import { globalConfirm } from "lib/globalConfirm";

interface PayableRecord {
    id: string;
    organizationId: string;
    subcontractorId: string;
    jobId: string;
    amount: number;
    status: 'Unpaid' | 'Paid';
    createdAt: string;
    companyName: string;
    customerName: string;
    paidAt?: string;
}

const Payables: React.FC = () => {
    const { state } = useAppContext();
    const [payables, setPayables] = useState<PayableRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState<'all' | 'Unpaid' | 'Paid'>('all');

    useEffect(() => {
        if (!state.currentOrganization) return;
        const unsub = db.collection('payables')
            .where('organizationId', '==', state.currentOrganization.id)
            .onSnapshot(snap => {
                const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as PayableRecord));
                list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
                setPayables(list);
                setLoading(false);
            });
        return () => unsub();
    }, [state.currentOrganization]);

    const handleMarkPaid = async (id: string) => {
        if (!await globalConfirm("Mark this payable as settled?")) return;
        try {
            await db.collection('payables').doc(id).update({
                status: 'Paid',
                paidAt: new Date().toISOString()
            });
        } catch (e) { showToast.warn("Failed to update status."); }
    };

    const filteredPayables = useMemo(() => {
        return payables.filter(p => {
            const matchesSearch = p.companyName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                                 p.customerName.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesStatus = filterStatus === 'all' || p.status === filterStatus;
            return matchesSearch && matchesStatus;
        });
    }, [payables, searchTerm, filterStatus]);

    const stats = useMemo(() => {
        const unpaid = payables.filter(p => p.status === 'Unpaid').reduce((sum, p) => sum + p.amount, 0);
        const paid = payables.filter(p => p.status === 'Paid').reduce((sum, p) => sum + p.amount, 0);
        return { unpaid, paid };
    }, [payables]);

    if (loading) return <div className="p-4 md:p-8 text-center text-slate-500">Loading Payables...</div>;

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="bg-amber-50 border-amber-200">
                    <p className="text-[10px] font-black uppercase text-amber-600 tracking-widest">Total Outstanding</p>
                    <p className="text-3xl font-black text-amber-900 mt-1">${stats.unpaid.toLocaleString()}</p>
                </Card>
                <Card className="bg-emerald-50 border-emerald-200">
                    <p className="text-[10px] font-black uppercase text-emerald-600 tracking-widest">Total Settled (YTD)</p>
                    <p className="text-3xl font-black text-emerald-900 mt-1">${stats.paid.toLocaleString()}</p>
                </Card>
            </div>

            <Card>
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                    <div className="relative w-full md:w-96">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input 
                            placeholder="Search by partner or customer..." 
                            className="w-full pl-10 pr-4 py-2 text-sm rounded-xl border border-slate-200 bg-slate-50 dark:bg-slate-800 dark:border-slate-700"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className="flex gap-2 w-full md:w-auto">
                        <select 
                            className="text-sm border border-slate-200 rounded-xl px-4 py-2 bg-white dark:bg-slate-800 dark:border-slate-700 font-bold"
                            value={filterStatus}
                            onChange={e => setFilterStatus(e.target.value as any)}
                        >
                            <option value="all">All Statuses</option>
                            <option value="Unpaid">Unpaid Only</option>
                            <option value="Paid">Paid Only</option>
                        </select>
                    </div>
                </div>

                <Table headers={['Partner Organization', 'Customer / Job', 'Date Created', 'Amount', 'Status', 'Actions']}>
                    {filteredPayables.map(p => (
                        <tr key={p.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                            <td className="px-6 py-4">
                                <div className="flex items-center gap-2">
                                    <Building2 size={16} className="text-slate-400" />
                                    <span className="font-bold text-slate-900 dark:text-white">{p.companyName}</span>
                                </div>
                            </td>
                            <td className="px-6 py-4">
                                <div className="flex flex-col">
                                    <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 font-medium">
                                        <User size={12} /> {p.customerName}
                                    </div>
                                    <span className="text-[10px] text-slate-400 font-mono mt-1">{p.jobId.substring(0, 12)}</span>
                                </div>
                            </td>
                            <td className="px-6 py-4 text-xs text-slate-500 font-medium">
                                {new Date(p.createdAt).toLocaleDateString()}
                            </td>
                            <td className="px-6 py-4">
                                <span className="font-black text-slate-900 dark:text-white">${p.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                            </td>
                            <td className="px-6 py-4">
                                <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase w-fit ${p.status === 'Paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                                    {p.status === 'Paid' ? <CheckCircle size={10} /> : <Clock size={10} />}
                                    {p.status}
                                </div>
                            </td>
                            <td className="px-6 py-4">
                                {p.status === 'Unpaid' && (
                                    <Button size="sm" onClick={() => handleMarkPaid(p.id)} className="h-8 text-[10px] font-black uppercase px-4 bg-emerald-600">
                                        Mark Paid
                                    </Button>
                                )}
                                {p.status === 'Paid' && (
                                    <span className="text-[10px] font-bold text-slate-400 uppercase italic">
                                        Settled {new Date(p.paidAt!).toLocaleDateString()}
                                    </span>
                                )}
                            </td>
                        </tr>
                    ))}
                    {filteredPayables.length === 0 && (
                        <tr>
                            <td colSpan={6} className="px-6 py-12 text-center text-slate-400 italic">No payables found.</td>
                        </tr>
                    )}
                </Table>
            </Card>
        </div>
    );
};

export default Payables;
