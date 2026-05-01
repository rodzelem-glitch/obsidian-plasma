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
import type { User, CommissionSettings, PlatformCommission, PlatformLead } from 'types';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { Users, FileText, Settings, DollarSign, PlusCircle, LayoutDashboard, TrendingUp, Download, Edit, Trash2, Save, Eye, GitMerge, HandCoins, Printer } from 'lucide-react';
import DOMPurify from 'dompurify';

// Modular Components
import Form1099CopyA from './components/sales-team/Form1099CopyA';
import RosterTab from './components/sales-team/RosterTab';
import PerformanceTab from './components/sales-team/PerformanceTab';
import PayoutsTab from './components/sales-team/PayoutsTab';

const DEFAULT_COMMISSION_RULES: CommissionSettings = {
    baseRate: 0.25, acceleratorRate: 0.30, annualQuota: 500000, renewalRate: 0.05,
    rampUpMonths: { phase1: 3, phase1QuotaPct: 0.50, phase2: 6, phase2QuotaPct: 0.75 }
};

const MasterSalesTeam: React.FC = () => {
    const { state } = useAppContext();
    const [activeTab, setActiveTab] = useState<'roster' | 'performance' | 'payouts'>('roster');
    const [salesReps, setSalesReps] = useState<User[]>([]);
    const [allLeads, setAllLeads] = useState<PlatformLead[]>([]);
    const [commissions, setCommissions] = useState<PlatformCommission[]>([]);
    
    // UI State
    const [isAddRepModalOpen, setIsAddRepModalOpen] = useState(false);
    const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
    const [viewContractRep, setViewContractRep] = useState<User | null>(null);
    const [viewTaxRep, setViewTaxRep] = useState<User | null>(null);
    const [commissionRules, setCommissionRules] = useState<CommissionSettings>(DEFAULT_COMMISSION_RULES);
    const [isEditingContract, setIsEditingContract] = useState(false);
    const [editedContractContent, setEditedContractContent] = useState('');
    const [repEarnings, setRepEarnings] = useState<number>(0);
    const [newRepData, setNewRepData] = useState({ 
        firstName: '', lastName: '', email: '', tempPassword: '',
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
        db.collection('settings').doc('commission_rules').get().then(doc => { if (doc.exists) setCommissionRules(doc.data() as CommissionSettings); });
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
        const buckets = { current: 0, days30: 0, days60: 0, days90: 0 };
        const now = new Date();
        pending.forEach(c => {
            const diff = Math.ceil((now.getTime() - new Date(c.dateEarned).getTime()) / 86400000);
            if (diff <= 30) buckets.current += c.amount; else if (diff <= 60) buckets.days30 += c.amount; else if (diff <= 90) buckets.days60 += c.amount; else buckets.days90 += c.amount;
        });
        return { 
            totalPending: pending.reduce((s, c) => s + c.amount, 0), totalPaidYTD: paid.reduce((s, c) => s + c.amount, 0), buckets,
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

            await db.collection('organizations').doc('platform').set({ id: 'platform', name: 'TekTrakker Platform', subscriptionStatus: 'active', plan: 'enterprise', email: 'platform@tektrakker.com', phone: '555-000-0000', createdAt: new Date().toISOString() }, { merge: true });
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
                notes: '',
                ...(!state.isMasterAdmin && state.currentUser?.franchiseId ? { franchiseId: state.currentUser.franchiseId } : {})
            };
            await db.collection('users').doc(userId).set(user);
            setIsAddRepModalOpen(false);
            showToast.warn(`Sales Rep Created Successfully! Instruct them to login using the credentials you just assigned.`);
            setNewRepData({ firstName: '', lastName: '', email: '', tempPassword: '', useCustomRules: false, customRules: DEFAULT_COMMISSION_RULES });
        } catch (e: any) { showToast.warn(e.message); }
    };

    const handleEditRep = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingRepId) return;
        try {
            const updatePayload: any = { 
                firstName: newRepData.firstName, 
                lastName: newRepData.lastName, 
                email: newRepData.email.toLowerCase().trim() 
            };
            if (newRepData.useCustomRules) {
                updatePayload.customCommissionSettings = newRepData.customRules;
            } else {
                updatePayload.customCommissionSettings = null;
            }
            await db.collection('users').doc(editingRepId).update(updatePayload);
            setIsAddRepModalOpen(false);
            setEditingRepId(null);
            setNewRepData({ firstName: '', lastName: '', email: '', tempPassword: '', useCustomRules: false, customRules: DEFAULT_COMMISSION_RULES });
        } catch (e: any) { showToast.warn(e.message); }
    };

    const handleMerge = async () => {
        if (!masterId || !duplicateId) return;
        setIsMerging(true);
        try {
            const batch = db.batch();
            const leads = await db.collection('platformLeads').where('repId', '==', duplicateId).get();
            leads.forEach(d => batch.update(d.ref, { repId: masterId }));
            batch.delete(db.collection('users').doc(duplicateId));
            await batch.commit();
            setIsMergeModalOpen(false);
        } catch(e: any) { showToast.warn(e.message); } finally { setIsMerging(false); }
    };

    const handleOpenContract = (rep: User) => {
        setViewContractRep(rep);
        setEditedContractContent(rep.salesContractContent || "");
        setIsEditingContract(false);
    };

    const handleSaveContractContent = async () => {
        if (!viewContractRep) return;
        await db.collection('users').doc(viewContractRep.id).update({ salesContractContent: editedContractContent });
        setIsEditingContract(false);
    };

    const handleSaveSettings = async () => {
        try {
            await db.collection('settings').doc('commission_rules').set(commissionRules, { merge: true });
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
                    <Button onClick={() => setIsMergeModalOpen(true)} variant="secondary"><GitMerge size={18}/> Merge</Button>
                    <Button onClick={() => setIsSettingsModalOpen(true)} variant="secondary"><Settings size={18}/> Rules</Button>
                    <Button onClick={() => { setIsEditingRep(false); setIsAddRepModalOpen(true); }}><PlusCircle size={18}/> Add Rep</Button>
                </div>
            </header>

            <div className="flex gap-2 bg-gray-200 dark:bg-gray-700 p-1 rounded-lg w-full overflow-x-auto whitespace-nowrap scrollbar-hide">
                {['roster', 'performance', 'payouts'].map(t => (
                    <button key={t} onClick={() => setActiveTab(t as any)} className={`shrink-0 min-w-max whitespace-nowrap px-4 py-2 text-sm font-bold rounded-md uppercase ${activeTab === t ? 'bg-white shadow' : 'text-slate-500'}`}>{t}</button>
                ))}
            </div>

            {activeTab === 'roster' && <RosterTab salesReps={salesReps} onOpenContract={handleOpenContract} onOpenTaxView={async (rep) => { setViewTaxRep(rep); }} onEditRep={(rep) => { 
                setEditingRepId(rep.id); 
                setNewRepData({ 
                    firstName: rep.firstName, lastName: rep.lastName, email: rep.email || '', tempPassword: '',
                    useCustomRules: !!rep.customCommissionSettings,
                    customRules: rep.customCommissionSettings || commissionRules || DEFAULT_COMMISSION_RULES 
                });
                setIsEditingRep(true); 
                setIsAddRepModalOpen(true); 
            }} onDeleteRep={(id) => db.collection('users').doc(id).delete()} />}
            {activeTab === 'performance' && <PerformanceTab repStats={repStats} />}
            {activeTab === 'payouts' && <PayoutsTab payoutData={payoutData} payoutFilter={payoutFilter} setPayoutFilter={setPayoutFilter} salesReps={salesReps} onMarkPaid={(id) => db.collection('platformCommissions').doc(id).update({ status: 'Paid', datePaid: new Date().toISOString() })} />}

            {isSettingsModalOpen && (
                <Modal isOpen={true} onClose={() => setIsSettingsModalOpen(false)} title="Commission Rules">
                    <div className="space-y-4">
                        <Input label="Base Rate (%)" type="number" value={commissionRules.baseRate * 100} onChange={e => setCommissionRules({...commissionRules, baseRate: parseFloat(e.target.value) / 100})} />
                        <Input label="Accelerator Rate (%)" type="number" value={commissionRules.acceleratorRate * 100} onChange={e => setCommissionRules({...commissionRules, acceleratorRate: parseFloat(e.target.value) / 100})} />
                        <Input label="Annual Quota ($)" type="number" value={commissionRules.annualQuota} onChange={e => setCommissionRules({...commissionRules, annualQuota: parseFloat(e.target.value)})} />
                        <Input label="Renewal Rate (%)" type="number" value={commissionRules.renewalRate * 100} onChange={e => setCommissionRules({...commissionRules, renewalRate: parseFloat(e.target.value) / 100})} />
                        <div className="pt-4 border-t">
                            <h4 className="font-bold text-sm mb-2">Ramp-Up Period</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Input label="Phase 1 (Months)" type="number" value={commissionRules.rampUpMonths.phase1} onChange={e => setCommissionRules({...commissionRules, rampUpMonths: {...commissionRules.rampUpMonths, phase1: parseInt(e.target.value)}})} />
                                <Input label="Phase 1 Quota (%)" type="number" value={commissionRules.rampUpMonths.phase1QuotaPct * 100} onChange={e => setCommissionRules({...commissionRules, rampUpMonths: {...commissionRules.rampUpMonths, phase1QuotaPct: parseFloat(e.target.value) / 100}})} />
                                <Input label="Phase 2 (Months)" type="number" value={commissionRules.rampUpMonths.phase2} onChange={e => setCommissionRules({...commissionRules, rampUpMonths: {...commissionRules.rampUpMonths, phase2: parseInt(e.target.value)}})} />
                                <Input label="Phase 2 Quota (%)" type="number" value={commissionRules.rampUpMonths.phase2QuotaPct * 100} onChange={e => setCommissionRules({...commissionRules, rampUpMonths: {...commissionRules.rampUpMonths, phase2QuotaPct: parseFloat(e.target.value) / 100}})} />
                            </div>
                        </div>
                        <div className="flex justify-end gap-2 pt-4">
                            <Button variant="secondary" onClick={() => setIsSettingsModalOpen(false)}>Cancel</Button>
                            <Button onClick={handleSaveSettings}>Save Rules</Button>
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
                            <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
                                <label className="flex items-center gap-2 font-bold cursor-pointer mb-2">
                                    <input type="checkbox" checked={newRepData.useCustomRules} onChange={e => setNewRepData({...newRepData, useCustomRules: e.target.checked})} />
                                    Use Custom Commission Override
                                </label>
                                
                                {newRepData.useCustomRules && (
                                    <div className="p-4 border border-blue-200 bg-blue-50 dark:bg-blue-900/10 dark:border-blue-800 rounded-lg space-y-4 shadow-inner">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <Input label="Base Rate (%)" type="number" value={newRepData.customRules.baseRate * 100} onChange={e => setNewRepData({...newRepData, customRules: {...newRepData.customRules, baseRate: parseFloat(e.target.value)/100}})} />
                                            <Input label="Accelerator (%)" type="number" value={newRepData.customRules.acceleratorRate * 100} onChange={e => setNewRepData({...newRepData, customRules: {...newRepData.customRules, acceleratorRate: parseFloat(e.target.value)/100}})} />
                                            <Input label="Annual Quota ($)" type="number" value={newRepData.customRules.annualQuota} onChange={e => setNewRepData({...newRepData, customRules: {...newRepData.customRules, annualQuota: parseFloat(e.target.value)}})} />
                                            <Input label="Renewal Rate (%)" type="number" value={newRepData.customRules.renewalRate * 100} onChange={e => setNewRepData({...newRepData, customRules: {...newRepData.customRules, renewalRate: parseFloat(e.target.value)/100}})} />
                                        </div>
                                    </div>
                                )}
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
                <Modal isOpen={true} onClose={() => setViewContractRep(null)} title={`Sales Contract - ${viewContractRep.firstName} ${viewContractRep.lastName}`}>
                    <div className="space-y-4">
                        {isEditingContract ? (
                            <Textarea 
                                value={editedContractContent} 
                                onChange={(e) => setEditedContractContent(e.target.value)}
                                rows={20}
                                className="font-mono text-sm"
                            />
                        ) : (
                            <div className="p-4 bg-slate-100 dark:bg-slate-800 rounded-md h-96 overflow-y-auto wysiwyg-content prose dark:prose-invert max-w-none"
                                dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(viewContractRep.salesContractContent || 'No contract content available.') }}
                            />
                        )}
                        <div className="flex justify-between items-center">
                            <div>
                                <Button onClick={() => window.print()} variant="secondary" className="flex items-center gap-2"><Printer size={16}/> Print</Button>
                            </div>
                            <div className="flex gap-2">
                                {isEditingContract ? (
                                    <Button onClick={handleSaveContractContent} className="flex items-center gap-2"><Save size={16}/> Save</Button>
                                ) : (
                                    <Button onClick={() => setIsEditingContract(true)} className="flex items-center gap-2"><Edit size={16}/> Edit</Button>
                                )}
                                <Button variant="secondary" onClick={() => setViewContractRep(null)}>Close</Button>
                            </div>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
};

export default MasterSalesTeam;
