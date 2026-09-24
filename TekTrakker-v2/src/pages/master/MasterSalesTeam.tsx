import { cleanUndefinedFields } from '../../lib/utils';
import showToast from "lib/toast";

import React, { useState, useEffect, useMemo } from 'react';
import { useAppContext } from 'context/AppContext';
import Card from 'components/ui/Card';
import Table from 'components/ui/Table';
import Button from 'components/ui/Button';
import Modal from 'components/ui/Modal';
import Input from 'components/ui/Input';
import Select from 'components/ui/Select';
import Textarea from 'components/ui/Textarea';
import { db } from 'lib/firebase';
import type { User, CommissionSettings, PlatformCommission, PlatformLead, SalesIncentiveContest } from 'types';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { Users, FileText, Settings, DollarSign, PlusCircle, LayoutDashboard, TrendingUp, Download, Edit, Trash2, Save, Eye, GitMerge, HandCoins, Printer, CheckCircle, Trophy, Gift, Award, Sparkles, Calendar, Zap, Calculator } from 'lucide-react';
import DOMPurify from 'dompurify';
import { generateSalesRepContractHtml, formatContractWithSignature, DEFAULT_COMMISSION_RULES } from '../../utils/salesContractGenerator';

// Modular Components
import Form1099CopyA from './components/sales-team/Form1099CopyA';
import RosterTab from './components/sales-team/RosterTab';
import PerformanceTab from './components/sales-team/PerformanceTab';
import PayoutsTab from './components/sales-team/PayoutsTab';
import LeadsTab from './components/sales-team/LeadsTab';
import CustomRepCommissionModal from './components/sales-team/CustomRepCommissionModal';
import SalesScenarioCalculator from '../../components/sales/SalesScenarioCalculator';
import { useSearchParams } from 'react-router-dom';

const MasterSalesTeam: React.FC = () => {
    const { state } = useAppContext();
    const [searchParams] = useSearchParams();
    const [activeTab, setActiveTab] = useState<'leads' | 'roster' | 'performance' | 'payouts'>(() => {
        const tab = searchParams.get('tab');
        if (tab === 'roster' || tab === 'performance' || tab === 'payouts') return tab;
        return 'leads';
    });
    const [salesReps, setSalesReps] = useState<User[]>([]);
    const [allLeads, setAllLeads] = useState<PlatformLead[]>([]);
    const [commissions, setCommissions] = useState<PlatformCommission[]>([]);
    
    // UI State
    const [isAddRepModalOpen, setIsAddRepModalOpen] = useState(false);
    const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
    const [viewContractRep, setViewContractRep] = useState<User | null>(null);
    const [viewTaxRep, setViewTaxRep] = useState<User | null>(null);
    const [commissionRules, setCommissionRules] = useState<CommissionSettings>(DEFAULT_COMMISSION_RULES);
    const [isContestModalOpen, setIsContestModalOpen] = useState(false);
    const [contestData, setContestData] = useState<SalesIncentiveContest>({
        title: 'Monthly Sales Spotlight Sprint',
        description: 'Top producer this month wins the spotlight incentive reward!',
        rewardType: 'prize',
        rewardValue: '75" Sony 4K OLED Smart TV',
        startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
        endDate: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().split('T')[0],
        criteriaType: 'top_volume',
        targetThreshold: 2500,
        isActive: true
    });
    const [isEditingContract, setIsEditingContract] = useState(false);
    const [editedContractContent, setEditedContractContent] = useState('');
    const [repEarnings, setRepEarnings] = useState<number>(0);
    const [compModalRep, setCompModalRep] = useState<User | null>(null);
    const [isSimulatorModalOpen, setIsSimulatorModalOpen] = useState(false);
    const [newRepData, setNewRepData] = useState<{
        firstName: string;
        lastName: string;
        email: string;
        tempPassword?: string;
        salesRepStatus?: 'Active' | 'Suspended' | 'Forfeited' | 'Inactive';
        useCustomRules: boolean;
        customRules: CommissionSettings;
    }>({ 
        firstName: '', lastName: '', email: '', tempPassword: '',
        salesRepStatus: 'Active',
        useCustomRules: false, customRules: DEFAULT_COMMISSION_RULES 
    });
    const [isEditingRep, setIsEditingRep] = useState(false);
    const [editingRepId, setEditingRepId] = useState<string | null>(null);
    const [isMergeModalOpen, setIsMergeModalOpen] = useState(false);
    const [masterId, setMasterId] = useState('');
    const [duplicateId, setDuplicateId] = useState('');
    const [isMerging, setIsMerging] = useState(false);
    const [payoutFilter, setPayoutFilter] = useState<'Pending' | 'Paid'>('Pending');
    
    // 1099 Specific State
    const [activeTaxTab, setActiveTaxTab] = useState<'1099' | 'W9'>('1099');
    const [taxYear, setTaxYear] = useState<number>(new Date().getFullYear());
    const [taxAmountOverride, setTaxAmountOverride] = useState<string>('');

    useEffect(() => {
        if (!state.currentUser) return;
        const isFranchiseAdmin = !state.isMasterAdmin && state.currentUser?.franchiseId;
        const myFranchiseId = state.currentUser?.franchiseId;

        let repsQuery: any = db.collection('users').where('role', '==', 'platform_sales');
        let leadsQuery: any = db.collection('platformLeads');
        let commsQuery: any = db.collection('platformCommissions');

        if (isFranchiseAdmin && myFranchiseId) {
            repsQuery = repsQuery.where('franchiseId', '==', myFranchiseId);
            leadsQuery = leadsQuery.where('franchiseId', '==', myFranchiseId);
            commsQuery = commsQuery.where('franchiseId', '==', myFranchiseId);
        }

        const unsub = repsQuery.onSnapshot((snap: any) => setSalesReps(snap.docs.map((d: any) => ({ ...d.data(), id: d.id } as User))));
        const unsubLeads = leadsQuery.onSnapshot((snap: any) => setAllLeads(snap.docs.map((d: any) => ({ ...d.data(), id: d.id } as PlatformLead))));
        const unsubComms = commsQuery.onSnapshot((snap: any) => setCommissions(snap.docs.map((d: any) => ({ ...d.data(), id: d.id } as PlatformCommission))));
        db.collection('settings').doc('commission_rules').get().then(doc => { 
            if (doc.exists) {
                const data = doc.data() as CommissionSettings;
                setCommissionRules(data);
                if (data.activeMonthlyIncentive) {
                    setContestData(data.activeMonthlyIncentive);
                }
            }
        });
        return () => { unsub(); unsubLeads(); unsubComms(); };
    }, [state.isMasterAdmin, state.currentUser?.franchiseId]);

    const repStats = useMemo(() => {
        return salesReps.map(rep => {
            const myLeads = allLeads.filter(l => l.repId === rep.id);
            const wins = myLeads.filter(l => l.status === 'Closed Won');
            return {
                ...rep, totalLeads: myLeads.length, wins: wins.length,
                totalRevenue: wins.reduce((sum, l) => sum + (l.value || 0), 0),
                conversionRate: myLeads.length > 0 ? (wins.length / myLeads.length) * 100 : 0
            };
        }).sort((a,b) => b.totalRevenue - a.totalRevenue);
    }, [salesReps, allLeads]);

    const payoutData = useMemo(() => {
        const pending = commissions.filter(c => c.status === 'Pending');
        const paid = commissions.filter(c => c.status === 'Paid');
        
        const pendingEarned = pending.filter(c => c.customerPaymentStatus === 'Paid');
        const pendingUnearned = pending.filter(c => c.customerPaymentStatus !== 'Paid');
        
        const buckets = { current: 0, days30: 0, days60: 0, days90: 0 };
        const now = new Date();
        pendingEarned.forEach(c => {
            const diff = Math.ceil((now.getTime() - new Date(c.dateEarned).getTime()) / 86400000);
            if (diff <= 30) buckets.current += c.amount; else if (diff <= 60) buckets.days30 += c.amount; else if (diff <= 90) buckets.days60 += c.amount; else buckets.days90 += c.amount;
        });
        return { 
            totalPending: pendingEarned.reduce((s, c) => s + c.amount, 0), 
            totalAwaitingPayment: pendingUnearned.reduce((s, c) => s + c.amount, 0),
            totalPaidYTD: paid.reduce((s, c) => s + c.amount, 0), 
            buckets,
            displayList: payoutFilter === 'Pending' ? pending : paid
        };
    }, [commissions, payoutFilter]);

    const calculatedTaxEarnings = useMemo(() => {
        if (!viewTaxRep) return 0;
        const paid = commissions.filter(c => c.repId === viewTaxRep.id && c.status === 'Paid' && new Date(c.dateEarned).getFullYear() === taxYear);
        return paid.reduce((s, c) => s + c.amount, 0);
    }, [viewTaxRep, taxYear, commissions]);

    const finalTaxAmount = taxAmountOverride ? parseFloat(taxAmountOverride) : calculatedTaxEarnings;

    const handleAddRep = async (e: React.FormEvent) => {
        e.preventDefault();
        const userId = newRepData.email.toLowerCase().trim();
        try {
            const createAuth = httpsCallable(getFunctions(), 'createUserAuth');
            await createAuth({
                email: userId,
                password: newRepData.tempPassword,
                displayName: `${newRepData.firstName} ${newRepData.lastName}`,
                role: 'platform_sales',
                organizationId: 'platform'
            });

            await db.collection('organizations').doc('platform').set(cleanUndefinedFields({ id: 'platform', name: 'TekTrakker Platform', subscriptionStatus: 'active', plan: 'enterprise', email: 'platform@tektrakker.com', phone: '555-000-0000', createdAt: new Date().toISOString() }), { merge: true });
            const user: User = { 
                id: userId, 
                uid: userId, 
                organizationId: 'platform', 
                role: 'platform_sales', 
                firstName: newRepData.firstName, 
                lastName: newRepData.lastName, 
                email: userId, 
                username: userId.split('@')[0], 
                status: 'active', 
                payRate: 0, 
                ptoAccrued: 0, 
                salesContractSigned: false, 
                hireDate: new Date().toISOString(), 
                salesRepStatus: newRepData.salesRepStatus || 'Active',
                lastSalesActivityAt: new Date().toISOString(),
                lastSalesLoginAt: new Date().toISOString(),
                notes: '',
                ...(!state.isMasterAdmin && state.currentUser?.franchiseId ? { franchiseId: state.currentUser.franchiseId } : {})
            };
            await db.collection('users').doc(userId).set(cleanUndefinedFields(user));
            setIsAddRepModalOpen(false);
            showToast.warn(`Sales Rep Created Successfully! Instruct them to login using the credentials you just assigned.`);
            setNewRepData({ firstName: '', lastName: '', email: '', tempPassword: '', salesRepStatus: 'Active', useCustomRules: false, customRules: DEFAULT_COMMISSION_RULES });
        } catch (e: any) { showToast.warn(e.message); }
    };

    const handleEditRep = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingRepId) return;
        try {
            const updatePayload: any = { 
                firstName: newRepData.firstName, 
                lastName: newRepData.lastName, 
                email: newRepData.email.toLowerCase().trim(),
                salesRepStatus: newRepData.salesRepStatus || 'Active'
            };
            if (newRepData.useCustomRules) {
                updatePayload.customCommissionSettings = newRepData.customRules;
            } else {
                updatePayload.customCommissionSettings = null;
            }
            await db.collection('users').doc(editingRepId).update(cleanUndefinedFields(updatePayload));
            setIsAddRepModalOpen(false);
            setEditingRepId(null);
            setNewRepData({ firstName: '', lastName: '', email: '', tempPassword: '', salesRepStatus: 'Active', useCustomRules: false, customRules: DEFAULT_COMMISSION_RULES });
        } catch (e: any) { showToast.warn(e.message); }
    };

    const handleMerge = async () => {
        if (!masterId || !duplicateId) return;
        setIsMerging(true);
        try {
            const batch = db.batch();
            const leads = await db.collection('platformLeads').where('repId', '==', duplicateId).get();
            leads.forEach(d => batch.update(d.ref, cleanUndefinedFields({ repId: masterId })));
            batch.delete(db.collection('users').doc(duplicateId));
            await batch.commit();
            setIsMergeModalOpen(false);
        } catch(e: any) { showToast.warn(e.message); } finally { setIsMerging(false); }
    };

    const handleOpenContract = (rep: User) => {
        setViewContractRep(rep);
        const effectiveRules = rep.customCommissionSettings || commissionRules || DEFAULT_COMMISSION_RULES;
        const content = rep.customCommissionSettings 
            ? generateSalesRepContractHtml(rep, effectiveRules)
            : (rep.salesContractContent || generateSalesRepContractHtml(rep, effectiveRules));
        setEditedContractContent(content);
        setIsEditingContract(false);
    };

    const handleSaveContractContent = async () => {
        if (!viewContractRep) return;
        await db.collection('users').doc(viewContractRep.id).update(cleanUndefinedFields({ salesContractContent: editedContractContent }));
        setViewContractRep(prev => prev ? ({ ...prev, salesContractContent: editedContractContent }) : null);
        setSalesReps(prev => prev.map(r => r.id === viewContractRep.id ? ({ ...r, salesContractContent: editedContractContent }) : r));
        setIsEditingContract(false);
        showToast.success("Contract terms saved.");
    };

    const contestLeaderboard = useMemo(() => {
        if (!contestData) return [];
        const start = new Date(contestData.startDate).getTime();
        const end = new Date(contestData.endDate + 'T23:59:59').getTime();

        return salesReps.map(rep => {
            const repWins = allLeads.filter(l => {
                if (l.repId !== rep.id || l.status !== 'Closed Won') return false;
                const t = new Date(l.updatedAt || l.createdAt || 0).getTime();
                return t >= start && t <= end;
            });

            const repComms = commissions.filter(c => {
                if (c.repId !== rep.id) return false;
                if (c.customerPaymentStatus !== 'Paid' && c.status !== 'Paid') return false;
                const t = new Date(c.dateEarned || c.createdAt || 0).getTime();
                return t >= start && t <= end;
            });

            const mrr = repComms.reduce((sum, c: any) => sum + (c.mrrValue !== undefined ? c.mrrValue : (c.isAnnual ? (c.baseAmount / 12) : c.baseAmount)), 0);
            const volume = repWins.reduce((sum, l) => sum + (l.value || 0), 0);
            const deals = repWins.length;
            const raffleTickets = deals;

            let qualified = false;
            if (contestData.criteriaType === 'threshold_volume') {
                qualified = (mrr >= (contestData.targetThreshold || 0)) || (volume >= (contestData.targetThreshold || 0));
            } else if (contestData.criteriaType === 'threshold_deals') {
                qualified = deals >= (contestData.targetThreshold || 0);
            } else if (contestData.criteriaType === 'raffle') {
                qualified = raffleTickets > 0;
            } else {
                qualified = deals > 0;
            }

            return {
                rep,
                deals,
                mrr,
                volume,
                raffleTickets,
                qualified
            };
        }).sort((a, b) => {
            if (contestData.criteriaType === 'top_deals') return b.deals - a.deals;
            return (b.mrr || b.volume) - (a.mrr || a.volume);
        });
    }, [salesReps, allLeads, commissions, contestData]);

    const handleSaveContest = async () => {
        try {
            const updatedRules: CommissionSettings = {
                ...commissionRules,
                activeMonthlyIncentive: {
                    ...contestData,
                    updatedAt: new Date().toISOString()
                }
            };
            await db.collection('settings').doc('commission_rules').set(cleanUndefinedFields(updatedRules), { merge: true });
            await db.collection('settings').doc('active_sales_incentive').set(cleanUndefinedFields({
                ...contestData,
                updatedAt: new Date().toISOString()
            }), { merge: true });
            setCommissionRules(updatedRules);
            setIsContestModalOpen(false);
            showToast.success("Monthly Contest / Spiff settings saved!");
        } catch (e: any) {
            showToast.warn(e.message || "Failed to save contest.");
        }
    };

    const handleSaveSettings = async () => {
        try {
            await db.collection('settings').doc('commission_rules').set(cleanUndefinedFields(commissionRules), { merge: true });
            setIsSettingsModalOpen(false);
            showToast.warn("Commission rules updated.");
        } catch (e) {
            showToast.warn("Failed to save settings.");
        }
    };

    return (
        <div className="space-y-6">
            <header className="flex justify-between items-center">
                <div className="flex gap-2">
                    <Button onClick={() => setIsContestModalOpen(true)} className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold flex items-center gap-1.5 shadow-sm">
                        <Trophy size={16} /> Monthly Contest {commissionRules.activeMonthlyIncentive?.isActive ? '⚡' : ''}
                    </Button>
                    <Button onClick={() => setIsSimulatorModalOpen(true)} variant="secondary" className="flex items-center gap-1.5 font-bold">
                        <Calculator size={16} /> Simulator
                    </Button>
                    <Button onClick={() => setIsMergeModalOpen(true)} variant="secondary"><GitMerge size={18}/> Merge</Button>
                    <Button onClick={() => setIsSettingsModalOpen(true)} variant="secondary"><Settings size={18}/> Rules</Button>
                    <Button onClick={() => { setIsEditingRep(false); setIsAddRepModalOpen(true); }}><PlusCircle size={18}/> Add Rep</Button>
                </div>
            </header>

            {commissionRules.activeMonthlyIncentive?.isActive && (
                <div className="bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-amber-500/15 border border-amber-300 dark:border-amber-700/60 p-4 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-amber-500 text-white rounded-xl shadow-sm">
                            <Trophy size={20} />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] font-black uppercase tracking-wider text-amber-800 dark:text-amber-300 bg-amber-100 dark:bg-amber-950/60 px-2 py-0.5 rounded border border-amber-200 dark:border-amber-800">Active Monthly Spiff</span>
                                <h3 className="font-bold text-slate-900 dark:text-white text-sm sm:text-base">{commissionRules.activeMonthlyIncentive.title}</h3>
                            </div>
                            <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                                <strong>Reward:</strong> <span className="font-bold text-amber-600 dark:text-amber-400">{commissionRules.activeMonthlyIncentive.rewardValue}</span> ({commissionRules.activeMonthlyIncentive.rewardType.toUpperCase()}) &bull; Active: {commissionRules.activeMonthlyIncentive.startDate} to {commissionRules.activeMonthlyIncentive.endDate}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button onClick={() => setIsContestModalOpen(true)} variant="secondary" className="text-xs h-8 flex items-center gap-1">
                            <Trophy size={14}/> Standings & Rules
                        </Button>
                    </div>
                </div>
            )}

            <div className="flex gap-2 bg-gray-200 dark:bg-gray-700 p-1 rounded-lg w-full overflow-x-auto whitespace-nowrap scrollbar-hide">
                {[
                    { key: 'leads', label: `Platform Leads (${allLeads.length})` },
                    { key: 'roster', label: 'Sales Roster' },
                    { key: 'performance', label: 'Performance' },
                    { key: 'payouts', label: 'Payouts' }
                ].map(t => (
                    <button 
                        key={t.key} 
                        onClick={() => setActiveTab(t.key as any)} 
                        className={`shrink-0 min-w-max whitespace-nowrap px-4 py-2 text-sm font-bold rounded-md uppercase transition-all ${
                            activeTab === t.key ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                        }`}
                    >
                        {t.label}
                    </button>
                ))}
            </div>

            {activeTab === 'leads' && <LeadsTab leads={allLeads} salesReps={salesReps} />}
            {activeTab === 'roster' && (
                <RosterTab 
                    salesReps={salesReps} 
                    onOpenContract={handleOpenContract} 
                    onOpenTaxView={async (rep) => { setViewTaxRep(rep); }} 
                    onEditRep={(rep) => { 
                        setEditingRepId(rep.id); 
                        setNewRepData({ 
                            firstName: rep.firstName, lastName: rep.lastName, email: rep.email || '', tempPassword: '',
                            salesRepStatus: rep.salesRepStatus || 'Active',
                            useCustomRules: !!rep.customCommissionSettings,
                            customRules: rep.customCommissionSettings || commissionRules || DEFAULT_COMMISSION_RULES 
                        });
                        setIsEditingRep(true); 
                        setIsAddRepModalOpen(true); 
                    }} 
                    onDeleteRep={(id) => db.collection('users').doc(id).delete()}
                    onEditCompensation={(rep) => setCompModalRep(rep)}
                />
            )}
            {activeTab === 'performance' && <PerformanceTab repStats={repStats} />}
            {activeTab === 'payouts' && <PayoutsTab payoutData={payoutData} payoutFilter={payoutFilter} setPayoutFilter={setPayoutFilter} salesReps={salesReps} onMarkPaid={(id) => db.collection('platformCommissions').doc(id).update(cleanUndefinedFields({ status: 'Paid', datePaid: new Date().toISOString() }))} />}

            {isSettingsModalOpen && (
                <Modal isOpen={true} onClose={() => setIsSettingsModalOpen(false)} title="Commission Rules & Production Targets" size="lg">
                    <div className="space-y-4 max-h-[75vh] overflow-y-auto p-2">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Input label="Year 1 Base Rate (%)" type="number" value={commissionRules.baseRate * 100} onChange={e => setCommissionRules({...commissionRules, baseRate: parseFloat(e.target.value) / 100})} />
                            <Input label="Annual Prepaid Plan Kicker (%)" type="number" value={((commissionRules.annualPrepaidKickerRate ?? 0.05) * 100)} onChange={e => setCommissionRules({...commissionRules, annualPrepaidKickerRate: parseFloat(e.target.value) / 100})} />
                            <Input label="Year 2 Renewal Rate (%)" type="number" value={((commissionRules.year2Rate !== undefined ? commissionRules.year2Rate : commissionRules.renewalRate) ?? 0.05) * 100} onChange={e => {
                                const r = parseFloat(e.target.value) / 100;
                                setCommissionRules({...commissionRules, year2Rate: r, renewalRate: r});
                            }} />
                            <Input label="Year 3+ Lifetime Residual (%)" type="number" value={((commissionRules.lifetimeRate ?? 0.03) * 100)} onChange={e => setCommissionRules({...commissionRules, lifetimeRate: parseFloat(e.target.value) / 100})} />
                            <Input label="Annual Quota Benchmark ($)" type="number" value={commissionRules.annualQuota} onChange={e => setCommissionRules({...commissionRules, annualQuota: parseFloat(e.target.value)})} />
                            <Input label="Quarterly Min Production (Deals)" type="number" value={commissionRules.quarterlyMinDeals ?? 3} onChange={e => setCommissionRules({...commissionRules, quarterlyMinDeals: parseInt(e.target.value)})} />
                            <Input label="Inactivity Sunset Cliff (Days)" type="number" value={commissionRules.inactivityCliffDays ?? 180} onChange={e => setCommissionRules({...commissionRules, inactivityCliffDays: parseInt(e.target.value)})} />
                            <Input label="Platform Abandonment (Days)" type="number" value={commissionRules.abandonmentDays ?? 60} onChange={e => setCommissionRules({...commissionRules, abandonmentDays: parseInt(e.target.value)})} />
                        </div>

                        <div className="pt-3 border-t">
                            <h4 className="font-bold text-sm mb-2 flex items-center gap-1.5 text-slate-800 dark:text-white">
                                <Zap size={16} className="text-amber-500" /> Monthly New-MRR Accelerators & Performance Bonuses
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs mb-3">
                                <div className="p-3 bg-slate-50 dark:bg-slate-800 border rounded-lg">
                                    <span className="font-bold text-slate-700 dark:text-slate-300 block">Base Bracket (&lt; $2,000 MRR)</span>
                                    <span className="text-slate-500 text-[11px]">25.0% Standard Base Rate</span>
                                </div>
                                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                                    <span className="font-bold text-blue-700 dark:text-blue-300 block">Tier 1 ($2,000 – $2,499 MRR)</span>
                                    <span className="text-blue-600 dark:text-blue-400 font-bold text-[11px]">27.5% Accelerated Rate</span>
                                </div>
                                <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg">
                                    <span className="font-bold text-emerald-700 dark:text-emerald-300 block">Top Producer ($2,500+ MRR)</span>
                                    <span className="text-emerald-600 dark:text-emerald-400 font-bold text-[11px]">30.0% Max Accelerated Rate</span>
                                </div>
                            </div>
                            <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-lg border text-xs space-y-1">
                                <span className="font-bold text-slate-700 dark:text-slate-300 block">Monthly Performance Cash Bonuses (Highest Achieved Paid):</span>
                                <p className="text-slate-500">$1k MRR &rarr; $250 | $2k &rarr; $500 | $3k &rarr; $1,000 | $4k &rarr; $1,500 | $5k &rarr; $2,500 | $7.5k &rarr; $4,000 | $10k+ &rarr; $7,500</p>
                            </div>
                        </div>

                        <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded text-xs text-amber-800 dark:text-amber-300">
                            <strong>Policy Note:</strong> Variable metered usage (storage, AI tokens, SMS, voice minutes) is strictly non-commissionable. Year 3+ lifetime residuals pause if quarterly quota is missed, and permanently forfeit after {commissionRules.inactivityCliffDays ?? 180} days or {commissionRules.abandonmentDays ?? 60} days of platform abandonment.
                        </div>

                        <div className="pt-4 border-t">
                            <h4 className="font-bold text-sm mb-2">Ramp-Up Period</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Input label="Phase 1 (Months)" type="number" value={commissionRules.rampUpMonths.phase1} onChange={e => setCommissionRules({...commissionRules, rampUpMonths: {...commissionRules.rampUpMonths, phase1: parseInt(e.target.value)}})} />
                                <Input label="Phase 1 Quota (%)" type="number" value={commissionRules.rampUpMonths.phase1QuotaPct * 100} onChange={e => setCommissionRules({...commissionRules, rampUpMonths: {...commissionRules.rampUpMonths, phase1QuotaPct: parseFloat(e.target.value) / 100}})} />
                                <Input label="Phase 2 (Months)" type="number" value={commissionRules.rampUpMonths.phase2} onChange={e => setCommissionRules({...commissionRules, rampUpMonths: {...commissionRules.rampUpMonths, phase2: parseInt(e.target.value)}})} />
                                <Input label="Phase 2 Quota (%)" type="number" value={commissionRules.rampUpMonths.phase2QuotaPct * 100} onChange={e => setCommissionRules({...commissionRules, rampUpMonths: {...commissionRules.rampUpMonths, phase2QuotaPct: parseFloat(e.target.value) / 100}})} />
                            </div>
                        </div>
                        <div className="flex justify-end gap-2 pt-4 border-t">
                            <Button variant="secondary" onClick={() => setIsSettingsModalOpen(false)}>Cancel</Button>
                            <Button onClick={handleSaveSettings}>Save Rules</Button>
                        </div>
                    </div>
                </Modal>
            )}

            {isContestModalOpen && (
                <Modal isOpen={true} onClose={() => setIsContestModalOpen(false)} title="Monthly Incentive / Contest Spiff Manager" size="lg">
                    <div className="space-y-4 max-h-[78vh] overflow-y-auto p-2">
                        <div className="bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-amber-500/10 border border-amber-300 dark:border-amber-700/60 p-4 rounded-xl flex items-start gap-3">
                            <Trophy size={28} className="text-amber-500 shrink-0 mt-0.5" />
                            <div>
                                <h4 className="font-bold text-slate-900 dark:text-white text-sm">Customizable Monthly Spotlight Reward</h4>
                                <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                                    Spin up or adjust monthly rewards, TV giveaways, milestone raffles, or cash spiffs at any time. When active, this incentive is prominently featured across all sales representative portals with real-time countdowns and qualification tracking.
                                </p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Input 
                                label="Contest / Incentive Title" 
                                value={contestData.title} 
                                onChange={e => setContestData({ ...contestData, title: e.target.value })} 
                                placeholder="e.g. September Sales Sprint"
                                required
                            />
                            <Input 
                                label="Prize / Reward Value" 
                                value={contestData.rewardValue} 
                                onChange={e => setContestData({ ...contestData, rewardValue: e.target.value })} 
                                placeholder='e.g. 75" Sony 4K OLED Smart TV or $1,000 Cash'
                                required
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <Select 
                                label="Reward Type" 
                                value={contestData.rewardType} 
                                onChange={e => setContestData({ ...contestData, rewardType: e.target.value as any })}
                            >
                                <option value="prize">Physical Prize / Electronics (e.g. 75" TV)</option>
                                <option value="cash">Direct Cash Spiff Bonus</option>
                                <option value="raffle">Milestone Raffle Ticket Giveaway</option>
                                <option value="experience">Experience / Travel / Event</option>
                                <option value="custom">Custom Reward</option>
                            </Select>
                            <Input 
                                label="Start Date" 
                                type="date" 
                                value={contestData.startDate} 
                                onChange={e => setContestData({ ...contestData, startDate: e.target.value })} 
                                required
                            />
                            <Input 
                                label="End Date" 
                                type="date" 
                                value={contestData.endDate} 
                                onChange={e => setContestData({ ...contestData, endDate: e.target.value })} 
                                required
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Select 
                                label="Qualification Criteria" 
                                value={contestData.criteriaType} 
                                onChange={e => setContestData({ ...contestData, criteriaType: e.target.value as any })}
                            >
                                <option value="top_volume">Top Volume Producer (Highest New MRR Collected)</option>
                                <option value="top_deals">Most Closed-Won Deals (Highest Count)</option>
                                <option value="threshold_volume">MRR Milestone Target (Reach $X in New MRR)</option>
                                <option value="threshold_deals">Deal Count Milestone (Close X or more Deals)</option>
                                <option value="raffle">Raffle Entries (1 Ticket per Closed Deal)</option>
                            </Select>
                            {(contestData.criteriaType === 'threshold_volume' || contestData.criteriaType === 'threshold_deals') ? (
                                <Input 
                                    label={contestData.criteriaType === 'threshold_volume' ? "Target MRR Threshold ($)" : "Target Deal Count"} 
                                    type="number" 
                                    value={contestData.targetThreshold || 0} 
                                    onChange={e => setContestData({ ...contestData, targetThreshold: parseFloat(e.target.value) || 0 })} 
                                />
                            ) : (
                                <div className="flex items-center pt-6">
                                    <span className="text-xs text-slate-500 italic">
                                        {contestData.criteriaType === 'top_volume' && "Rep with highest new MRR cleared during the active window wins."}
                                        {contestData.criteriaType === 'top_deals' && "Rep with highest number of closed won deals wins."}
                                        {contestData.criteriaType === 'raffle' && "Every closed won deal automatically awards 1 raffle entry ticket."}
                                    </span>
                                </div>
                            )}
                        </div>

                        <Textarea 
                            label="Contest Description & Rules" 
                            value={contestData.description} 
                            onChange={e => setContestData({ ...contestData, description: e.target.value })} 
                            rows={2} 
                            placeholder="Describe rules, eligibility criteria, and delivery timeline..."
                        />

                        <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-lg border">
                            <div>
                                <span className="text-sm font-bold text-slate-800 dark:text-white block">Contest Active Status</span>
                                <span className="text-xs text-slate-500">When enabled, this contest appears live in all sales rep dashboards.</span>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input 
                                    type="checkbox" 
                                    checked={contestData.isActive} 
                                    onChange={e => setContestData({ ...contestData, isActive: e.target.checked })} 
                                    className="sr-only peer"
                                />
                                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-600"></div>
                            </label>
                        </div>

                        {/* Live Standings Preview */}
                        <div className="pt-3 border-t">
                            <h4 className="font-bold text-sm mb-2 flex items-center justify-between">
                                <span className="flex items-center gap-1.5"><Trophy size={16} className="text-amber-500"/> Current Contest Standings</span>
                                <span className="text-xs text-slate-400 font-normal">Window: {contestData.startDate} to {contestData.endDate}</span>
                            </h4>
                            <div className="border rounded-lg overflow-hidden">
                                <table className="w-full text-left text-xs">
                                    <thead className="bg-slate-100 dark:bg-slate-800 border-b">
                                        <tr>
                                            <th className="p-2.5 font-bold">Rank</th>
                                            <th className="p-2.5 font-bold">Sales Representative</th>
                                            <th className="p-2.5 font-bold text-right">Closed Deals</th>
                                            <th className="p-2.5 font-bold text-right">New MRR</th>
                                            {contestData.criteriaType === 'raffle' && <th className="p-2.5 font-bold text-right">Raffle Tickets</th>}
                                            <th className="p-2.5 font-bold text-center">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                        {contestLeaderboard.length === 0 ? (
                                            <tr>
                                                <td colSpan={6} className="p-4 text-center text-slate-400 italic">No sales activity recorded for this window yet.</td>
                                            </tr>
                                        ) : (
                                            contestLeaderboard.map((item, idx) => (
                                                <tr key={item.rep.id} className={idx === 0 && item.qualified ? "bg-amber-50/50 dark:bg-amber-950/20 font-bold" : ""}>
                                                    <td className="p-2.5">
                                                        {idx === 0 && item.qualified ? '🥇 1st' : idx === 1 && item.qualified ? '🥈 2nd' : idx === 2 && item.qualified ? '🥉 3rd' : `#${idx + 1}`}
                                                    </td>
                                                    <td className="p-2.5">{item.rep.firstName} {item.rep.lastName}</td>
                                                    <td className="p-2.5 text-right">{item.deals}</td>
                                                    <td className="p-2.5 text-right font-mono">${item.mrr.toFixed(2)}</td>
                                                    {contestData.criteriaType === 'raffle' && (
                                                        <td className="p-2.5 text-right font-mono text-amber-600 font-bold">{item.raffleTickets} 🎟️</td>
                                                    )}
                                                    <td className="p-2.5 text-center">
                                                        {item.qualified ? (
                                                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                                                                Qualified
                                                            </span>
                                                        ) : (
                                                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
                                                                In Progress
                                                            </span>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div className="flex justify-end gap-2 pt-4 border-t">
                            <Button variant="secondary" onClick={() => setIsContestModalOpen(false)}>Cancel</Button>
                            <Button onClick={handleSaveContest} className="bg-amber-600 hover:bg-amber-700 text-white font-bold">Save & Publish Contest</Button>
                        </div>
                    </div>
                </Modal>
            )}

             {isAddRepModalOpen && (
                 <Modal isOpen={true} onClose={() => setIsAddRepModalOpen(false)} title={isEditingRep ? "Edit Rep" : "Add New Rep"}>
                    <form onSubmit={isEditingRep ? handleEditRep : handleAddRep} className="space-y-4 max-h-[70vh] overflow-y-auto p-2">
                        <Input label="First Name" value={newRepData.firstName} onChange={e => setNewRepData({...newRepData, firstName: e.target.value})} required/>
                        <Input label="Last Name" value={newRepData.lastName} onChange={e => setNewRepData({...newRepData, lastName: e.target.value})} required/>
                        <Input label="Email" value={newRepData.email} onChange={e => setNewRepData({...newRepData, email: e.target.value})} required/>
                        {!isEditingRep && <Input label="Temporary Password" type="password" value={newRepData.tempPassword} onChange={e => setNewRepData({...newRepData, tempPassword: e.target.value})} required/>}
                        
                        {isEditingRep && (
                            <div className="space-y-4 pt-2">
                                <Select 
                                    label="Sales Representative Status" 
                                    value={newRepData.salesRepStatus || 'Active'} 
                                    onChange={e => setNewRepData({...newRepData, salesRepStatus: e.target.value as any})}
                                >
                                    <option value="Active">Active - Full Commissions & Residuals</option>
                                    <option value="Suspended">Suspended - Quota Missed (Residuals Paused)</option>
                                    <option value="Forfeited">Forfeited / Inactive - Inactivity Cliff (Residuals Terminated)</option>
                                </Select>
                                <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
                                    <label className="flex items-center gap-2 font-bold cursor-pointer mb-2">
                                        <input type="checkbox" checked={newRepData.useCustomRules} onChange={e => setNewRepData({...newRepData, useCustomRules: e.target.checked})} />
                                        Use Custom Commission Override
                                    </label>
                                    
                                    {newRepData.useCustomRules && (
                                        <div className="p-4 border border-blue-200 bg-blue-50 dark:bg-blue-900/10 dark:border-blue-800 rounded-lg space-y-4 shadow-inner">
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <Input label="Year 1 Base (%)" type="number" value={newRepData.customRules.baseRate * 100} onChange={e => setNewRepData({...newRepData, customRules: {...newRepData.customRules, baseRate: parseFloat(e.target.value)/100}})} />
                                                <Input label="Year 2 Renewal (%)" type="number" value={((newRepData.customRules.year2Rate !== undefined ? newRepData.customRules.year2Rate : newRepData.customRules.renewalRate) ?? 0.05) * 100} onChange={e => {
                                                    const r = parseFloat(e.target.value)/100;
                                                    setNewRepData({...newRepData, customRules: {...newRepData.customRules, year2Rate: r, renewalRate: r}});
                                                }} />
                                                <Input label="Year 3+ Lifetime (%)" type="number" value={((newRepData.customRules.lifetimeRate ?? 0.03) * 100)} onChange={e => setNewRepData({...newRepData, customRules: {...newRepData.customRules, lifetimeRate: parseFloat(e.target.value)/100}})} />
                                                <Input label="Accelerator (%)" type="number" value={newRepData.customRules.acceleratorRate * 100} onChange={e => setNewRepData({...newRepData, customRules: {...newRepData.customRules, acceleratorRate: parseFloat(e.target.value)/100}})} />
                                                <Input label="Annual Quota ($)" type="number" value={newRepData.customRules.annualQuota} onChange={e => setNewRepData({...newRepData, customRules: {...newRepData.customRules, annualQuota: parseFloat(e.target.value)}})} />
                                                <Input label="Quarterly Min Deals" type="number" value={newRepData.customRules.quarterlyMinDeals ?? 3} onChange={e => setNewRepData({...newRepData, customRules: {...newRepData.customRules, quarterlyMinDeals: parseInt(e.target.value)}})} />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        <div className="flex justify-end gap-2 pt-4">
                            <Button variant="secondary" type="button" onClick={() => setIsAddRepModalOpen(false)}>Cancel</Button>
                            <Button type="submit">Save</Button>
                        </div>
                    </form>
                 </Modal>
            )}
            
            {viewTaxRep && (
                <Modal isOpen={true} onClose={() => { setViewTaxRep(null); setTaxAmountOverride(''); setActiveTaxTab('1099'); }} title="Tax Documents">
                    <div className="space-y-4">
                        <div className="flex gap-2 bg-gray-200 dark:bg-gray-700 p-1 rounded-lg w-full overflow-x-auto whitespace-nowrap scrollbar-hide">
                            <button onClick={() => setActiveTaxTab('1099')} className={`shrink-0 min-w-max whitespace-nowrap px-4 py-2 text-sm font-bold rounded-md uppercase ${activeTaxTab === '1099' ? 'bg-white text-blue-600 shadow' : 'text-slate-500'}`}>1099-NEC Generation</button>
                            <button onClick={() => setActiveTaxTab('W9')} className={`shrink-0 min-w-max whitespace-nowrap px-4 py-2 text-sm font-bold rounded-md uppercase ${activeTaxTab === 'W9' ? 'bg-white text-blue-600 shadow' : 'text-slate-500'}`}>Form W-9</button>
                        </div>
                        
                        {activeTaxTab === '1099' && (
                            <div className="space-y-4 animate-in fade-in">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 dark:bg-slate-800 p-4 rounded-lg">
                                    <Input label="Tax Year" type="number" value={taxYear} onChange={e => setTaxYear(parseInt(e.target.value))} />
                                    <Input label="Override Amount ($) (Manual Job)" type="number" value={taxAmountOverride} onChange={e => setTaxAmountOverride(e.target.value)} placeholder={`Aggregate Paid: $${calculatedTaxEarnings.toFixed(2)}`} />
                                </div>
                                <div className="text-xs text-slate-500 mb-2 px-2">
                                   The calculated amount inherently includes all commissions marked "Paid" within the selected tax year for this rep. For manually entered job amounts, provide an override.
                                </div>
                                <Form1099CopyA recipient={viewTaxRep} amount={finalTaxAmount || 0} year={taxYear} />
                                <div className="flex justify-end pt-4">
                                    <Button onClick={() => window.print()} className="flex items-center gap-2"><Printer size={16}/> Print Tax Form</Button>
                                </div>
                            </div>
                        )}

                        {activeTaxTab === 'W9' && (
                            <div className="space-y-4 animate-in fade-in">
                                {viewTaxRep.taxW9Content ? (
                                    <>
                                        <div className="p-4 bg-slate-100 dark:bg-slate-800 rounded-md h-[600px] overflow-y-auto wysiwyg-content prose dark:prose-invert max-w-none"
                                             dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(viewTaxRep.taxW9Content) }}
                                        />
                                        <div className="flex justify-end items-center pt-4">
                                            <Button onClick={() => window.print()} className="flex items-center gap-2"><Printer size={16}/> Print W-9</Button>
                                        </div>
                                    </>
                                ) : (
                                    <div className="p-8 text-center text-slate-500 bg-slate-50 dark:bg-slate-800 rounded-lg">
                                        This Sales Rep has not submitted a W-9 form yet.
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </Modal>
            )}

            {viewContractRep && (
                <Modal isOpen={true} onClose={() => setViewContractRep(null)} title={`Sales Agreement - ${viewContractRep.firstName} ${viewContractRep.lastName}`} size="lg">
                    <div className="space-y-4">
                        <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Agreement Status:</span>
                                {viewContractRep.salesContractSigned ? (
                                    <span className="inline-flex items-center gap-1.5 text-emerald-700 bg-emerald-100 dark:bg-emerald-950/60 dark:text-emerald-300 font-bold text-xs px-2.5 py-1 rounded-full border border-emerald-300 dark:border-emerald-800">
                                        <CheckCircle size={14} /> Signed on {viewContractRep.salesContractDate ? new Date(viewContractRep.salesContractDate).toLocaleDateString() : 'File'}
                                    </span>
                                ) : (
                                    <span className="inline-flex items-center gap-1.5 text-amber-700 bg-amber-100 dark:bg-amber-950/60 dark:text-amber-300 font-bold text-xs px-2.5 py-1 rounded-full border border-amber-300 dark:border-amber-800">
                                        Pending Representative Signature
                                    </span>
                                )}
                            </div>
                            <span className="text-xs text-slate-400">
                                {viewContractRep.email}
                            </span>
                        </div>

                        {isEditingContract ? (
                            <Textarea 
                                value={editedContractContent} 
                                onChange={(e) => setEditedContractContent(e.target.value)}
                                rows={20}
                                className="font-mono text-xs"
                            />
                        ) : (
                            <div className="p-6 bg-white dark:bg-slate-900 border rounded-xl h-[520px] overflow-y-auto wysiwyg-content prose dark:prose-invert max-w-none shadow-inner"
                                dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(formatContractWithSignature(editedContractContent, viewContractRep)) }}
                            />
                        )}
                        <div className="flex justify-between items-center pt-2">
                            <div>
                                <Button onClick={() => {
                                    const win = window.open('', '_blank');
                                    if (win) {
                                        const printHtml = DOMPurify.sanitize(formatContractWithSignature(editedContractContent, viewContractRep));
                                        win.document.write(`<html><head><title>Sales Agreement - ${viewContractRep.firstName} ${viewContractRep.lastName}</title><style>body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; padding: 40px; line-height: 1.6; max-width: 850px; margin: 0 auto; }</style></head><body>${printHtml}</body></html>`);
                                        win.document.close();
                                        setTimeout(() => { win.focus(); win.print(); }, 400);
                                    }
                                }} variant="secondary" className="flex items-center gap-2"><Printer size={16}/> Print Agreement</Button>
                            </div>
                            <div className="flex gap-2">
                                {isEditingContract ? (
                                    <Button onClick={handleSaveContractContent} className="flex items-center gap-2"><Save size={16}/> Save Changes</Button>
                                ) : (
                                    <Button onClick={() => setIsEditingContract(true)} className="flex items-center gap-2"><Edit size={16}/> Edit Agreement</Button>
                                )}
                                <Button variant="secondary" onClick={() => setViewContractRep(null)}>Close</Button>
                            </div>
                        </div>
                    </div>
                </Modal>
            )}

            {compModalRep && (
                <CustomRepCommissionModal
                    rep={compModalRep}
                    globalRules={commissionRules}
                    isOpen={true}
                    onClose={() => setCompModalRep(null)}
                    onSaved={() => {
                        setCompModalRep(null);
                    }}
                />
            )}

            {isSimulatorModalOpen && (
                <Modal 
                    isOpen={true} 
                    onClose={() => setIsSimulatorModalOpen(false)} 
                    title="Platform Sales Compensation Simulator"
                    size="xl"
                >
                    <div className="p-2 max-h-[80vh] overflow-y-auto">
                        <SalesScenarioCalculator rules={commissionRules} isModal={true} />
                    </div>
                </Modal>
            )}
        </div>
    );
};

export default MasterSalesTeam;
