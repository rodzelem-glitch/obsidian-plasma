
import React, { useState, useEffect, useMemo } from 'react';
import { useAppContext } from 'context/AppContext';
import Card from 'components/ui/Card';
import Table from 'components/ui/Table';
import Button from 'components/ui/Button';
import { db } from 'lib/firebase';
import type { ServiceAgreement, Organization } from 'types';
import { useNavigate } from 'react-router-dom';
import { 
    Users, DollarSign, Activity, TrendingUp, Search, 
    ShieldCheck, Building2, User, Calendar, ExternalLink, 
    ArrowUpRight, AlertCircle, Ban, Trash2
} from 'lucide-react';
import { globalConfirm } from "lib/globalConfirm";

const GlobalMembers: React.FC = () => {
    const { state, impersonateOrganization } = useAppContext();
    const navigate = useNavigate();
    const [allAgreements, setAllAgreements] = useState<ServiceAgreement[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState<string>('Active');

    // Fetch all agreements across the whole platform
    useEffect(() => {
        const fetchGlobalAgreements = async () => {
            setLoading(true);
            try {
                const snap = await db.collection('serviceAgreements').get();
                const agreements = snap.docs.map(doc => ({ ...doc.data(), id: doc.id } as ServiceAgreement));
                setAllAgreements(agreements);
            } catch (e) {
                console.error("Global fetch failed", e);
            } finally {
                setLoading(false);
            }
        };
        fetchGlobalAgreements();
    }, []);

    const metrics = useMemo(() => {
        const activeOnly = allAgreements.filter(a => a.status === 'Active');
        const cancelled = allAgreements.filter(a => a.status === 'Cancelled');
        
        const mrr = activeOnly.reduce((sum, a) => {
            return sum + (a.billingCycle === 'Monthly' ? a.price : a.price / 12);
        }, 0);

        const totalEver = allAgreements.length;
        const churnRate = totalEver > 0 ? (cancelled.length / totalEver) * 100 : 0;

        const healthScore = activeOnly.length > 0 
            ? (activeOnly.filter(a => a.visitsRemaining > 0).length / activeOnly.length) * 100 
            : 0;

        return { 
            activeCount: activeOnly.length, 
            cancelledCount: cancelled.length,
            mrr, 
            churnRate, 
            healthScore,
            totalEver
        };
    }, [allAgreements]);

    const filteredList = useMemo(() => {
        return allAgreements
            .filter(a => {
                const matchesStatus = filterStatus === 'All' || a.status === filterStatus;
                const matchesSearch = 
                    (a.customerName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                    (a.planName || '').toLowerCase().includes(searchTerm.toLowerCase());
                return matchesStatus && matchesSearch;
            })
            .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
    }, [allAgreements, searchTerm, filterStatus]);

    const handleInvestigate = async (orgId: string) => {
        const org = state.allOrganizations.find(o => o.id === orgId);
        if (org) {
            if (await globalConfirm(`Impersonate "${org.name}" to investigate membership issues?`)) {
                impersonateOrganization(org);
                navigate('/admin/customers');
            }
        } else {
            alert("Organization details not found.");
        }
    };

    const handleDeleteRecord = async (id: string) => {
        if (!await globalConfirm("Permanently delete this membership record from the platform? This cannot be undone.")) return;
        try {
            await db.collection('serviceAgreements').doc(id).delete();
            setAllAgreements(prev => prev.filter(a => a.id !== id));
            alert("Record deleted.");
        } catch (e) {
            alert("Delete failed.");
        }
    };

    const getOrgName = (orgId: string) => {
        const org = state.allOrganizations.find(o => o.id === orgId);
        return org ? org.name : 'Unknown Org';
    };

    const formatCurrency = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);

    // Churn Risk Organizations (Real counts based on status field)
    const churnRiskOrgs = useMemo(() => {
        const orgMap: Record<string, number> = {};
        allAgreements.filter(a => a.status === 'Cancelled').forEach(a => {
            orgMap[a.organizationId] = (orgMap[a.organizationId] || 0) + 1;
        });

        return Object.entries(orgMap)
            .map(([id, count]) => ({ id, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 3);
    }, [allAgreements]);

    return (
        <div className="space-y-6 pb-20">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Global Memberships</h2>
                    <p className="text-gray-600 dark:text-gray-400">Platform-wide maintenance plan health.</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="secondary" onClick={() => window.print()} className="w-auto flex items-center gap-2">
                        Export Report
                    </Button>
                </div>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <Card className="bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200">
                    <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-widest">Platform MRR</p>
                    <p className="text-3xl font-black text-emerald-900 dark:text-white mt-1">{formatCurrency(metrics.mrr)}</p>
                </Card>

                <Card className="bg-blue-50 dark:bg-blue-900/20 border-blue-200">
                    <p className="text-xs font-bold text-blue-700 dark:text-blue-400 uppercase tracking-widest">Total Members</p>
                    <p className="text-3xl font-black text-blue-900 dark:text-white mt-1">{metrics.activeCount}</p>
                </Card>

                <Card className="bg-orange-50 dark:bg-orange-900/20 border-orange-200">
                    <p className="text-xs font-bold text-orange-700 dark:text-orange-400 uppercase tracking-widest">Cancelled Records</p>
                    <p className="text-3xl font-black text-orange-900 dark:text-white mt-1">{metrics.cancelledCount}</p>
                    <p className="text-[10px] text-orange-600 font-bold mt-1 uppercase tracking-tighter">Current Count: {metrics.cancelledCount}</p>
                </Card>

                <Card className="bg-purple-50 dark:bg-purple-900/20 border-purple-200">
                    <p className="text-xs font-bold text-purple-700 dark:text-purple-400 uppercase tracking-widest">Plan Health</p>
                    <p className="text-3xl font-black text-purple-900 dark:text-white mt-1">{metrics.healthScore.toFixed(0)}%</p>
                </Card>
            </div>

            <Card className="shadow-lg">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                    <div className="relative flex-1 w-full">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input 
                            className="pl-10 w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-2.5 text-sm font-medium outline-none focus:ring-2 focus:ring-sky-500"
                            placeholder="Search by customer or plan..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className="flex bg-slate-100 dark:bg-slate-700 p-1 rounded-xl w-full md:w-auto">
                        {['All', 'Active', 'Cancelled'].map(status => (
                            <button
                                key={status}
                                onClick={() => setFilterStatus(status)}
                                className={`flex-1 md:flex-none px-6 py-2 text-xs font-black uppercase rounded-lg transition-all ${
                                    filterStatus === status 
                                        ? 'bg-white dark:bg-slate-600 text-sky-600 dark:text-sky-300 shadow-sm' 
                                        : 'text-slate-500'
                                }`}
                            >
                                {status}
                            </button>
                        ))}
                    </div>
                </div>

                <Table headers={['Member / Plan', 'Organization', 'Value', 'Status', 'Renewal', 'Actions']}>
                    {loading ? (
                        <tr><td colSpan={6} className="p-6 md:p-12 text-center text-slate-400 animate-pulse">Syncing...</td></tr>
                    ) : filteredList.map(agreement => (
                        <tr key={agreement.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                            <td className="px-6 py-5">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center"><User size={16}/></div>
                                    <div>
                                        <div className="font-bold text-slate-900 dark:text-white">{agreement.customerName}</div>
                                        <div className="text-[10px] font-bold text-sky-600 uppercase">{agreement.planName}</div>
                                    </div>
                                </div>
                            </td>
                            <td className="px-6 py-5 text-sm font-bold text-slate-600 dark:text-slate-400">{getOrgName(agreement.organizationId)}</td>
                            <td className="px-6 py-5 font-black text-slate-900 dark:text-white">{formatCurrency(agreement.price)}</td>
                            <td className="px-6 py-5">
                                <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase border ${
                                    agreement.status === 'Active' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                    agreement.status === 'Cancelled' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                                    'bg-slate-100 text-slate-700'
                                }`}>
                                    {agreement.status}
                                </span>
                            </td>
                            <td className="px-6 py-5 text-xs text-slate-500 font-bold">{new Date(agreement.endDate).toLocaleDateString()}</td>
                            <td className="px-6 py-5 flex items-center gap-2">
                                <button onClick={() => handleInvestigate(agreement.organizationId)} className="p-2.5 bg-sky-50 dark:bg-sky-900/30 rounded-lg text-sky-600 dark:text-sky-300 hover:bg-sky-100 transition-all" title="Investigate Org">
                                    <ExternalLink size={18}/>
                                </button>
                                <button onClick={() => handleDeleteRecord(agreement.id)} className="p-2.5 bg-rose-50 dark:bg-rose-900/30 rounded-lg text-rose-600 dark:text-rose-300 hover:bg-rose-100 transition-all" title="Delete record">
                                    <Trash2 size={18}/>
                                </button>
                            </td>
                        </tr>
                    ))}
                </Table>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="p-4 md:p-8 border-l-4 border-rose-500">
                    <h3 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2 mb-6">
                        <Ban size={22} className="text-rose-600"/> Platform Churn Risk Orgs
                    </h3>
                    <div className="space-y-4">
                        {churnRiskOrgs.length > 0 ? churnRiskOrgs.map(risk => (
                            <div key={risk.id} className="flex justify-between items-center p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700">
                                <div>
                                    <p className="font-black text-slate-900 dark:text-white">{getOrgName(risk.id)}</p>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase">{risk.count} Total Cancellations</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Button onClick={() => { setFilterStatus('Cancelled'); setSearchTerm(getOrgName(risk.id)); window.scrollTo({top: 400, behavior: 'smooth'}); }} variant="secondary" className="text-[10px] h-8 font-black uppercase px-4 border-slate-200 text-slate-600">View Cancelled</Button>
                                    <Button onClick={() => handleInvestigate(risk.id)} variant="secondary" className="text-[10px] h-8 font-black uppercase px-4 border-rose-200 text-rose-600">Impersonate</Button>
                                </div>
                            </div>
                        )) : (
                            <div className="p-4 text-center text-gray-500 text-sm">No cancellations detected.</div>
                        )}
                    </div>
                </Card>

                <Card className="p-4 md:p-8 border-l-4 border-amber-500">
                    <h3 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2 mb-6">
                        <AlertCircle size={22} className="text-amber-600"/> Upcoming Global Renewals
                    </h3>
                    <div className="space-y-4">
                        {allAgreements.filter(a => a.status === 'Active').slice(0, 3).map(a => (
                            <div key={a.id} className="flex justify-between items-center p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700">
                                <div>
                                    <p className="font-black text-slate-900 dark:text-white">{a.customerName}</p>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase">Renews: {new Date(a.endDate).toLocaleDateString()} • {getOrgName(a.organizationId)}</p>
                                </div>
                                <div className="text-right">
                                    <p className="font-black text-amber-600 text-sm uppercase">Next 30 Days</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </Card>
            </div>
        </div>
    );
};

export default GlobalMembers;
