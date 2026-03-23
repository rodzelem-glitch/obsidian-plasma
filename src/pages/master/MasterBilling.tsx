
import React, { useMemo, useState, useEffect } from 'react';
import { useAppContext } from 'context/AppContext';
import Card from 'components/ui/Card';
import Table from 'components/ui/Table';
import Button from 'components/ui/Button';
import Modal from 'components/ui/Modal';
import Input from 'components/ui/Input';
import Select from 'components/ui/Select';
import Toggle from 'components/ui/Toggle';
import Textarea from 'components/ui/Textarea';
import { 
    CreditCard, TrendingUp, Activity, Calendar, Send, 
    ArrowUpRight, Gift, Percent, Receipt, Plus, Search, Building2, Palette, FileText, Trash2, Mail, Eye
} from 'lucide-react';
import { db } from 'lib/firebase';
import type { Organization, Job, InvoiceLineItem, PlatformSettings, Address } from 'types';
import InvoiceEditorModal from 'components/modals/InvoiceEditorModal';
import DocumentPreview from 'components/ui/DocumentPreview';
import { globalConfirm } from "lib/globalConfirm";

const MasterBilling: React.FC = () => {
    const { state, dispatch } = useAppContext();
    const orgs = state.allOrganizations;

    // --- STATE ---
    const [activeTab, setActiveTab] = useState<'dashboard' | 'invoices' | 'settings'>('dashboard');
    const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);
    const [isManageModalOpen, setIsManageModalOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [filterType, setFilterType] = useState<'all' | 'active' | 'expired' | 'enterprise' | 'trial'>('all');
    
    // Invoices State
    const [platformInvoices, setPlatformInvoices] = useState<Job[]>([]);
    const [editingInvoiceId, setEditingInvoiceId] = useState<string | null>(null);
    const [isLoadingInvoices, setIsLoadingInvoices] = useState(false);
    
    // Preview State
    const [previewJob, setPreviewJob] = useState<Job | null>(null);

    // --- PRODUCTION FALLBACKS RESTORED ---
    const [config, setConfig] = useState<PlatformSettings>({
        id: 'platform_billing',
        plans: {
            starter: { 
                monthly: 99, 
                annual: 999, 
                maxUsers: 1, 
                paypalMonthlyId: 'P-36181239RW6804649NFSIE3Q',
                paypalAnnualId: 'P-892978607P5661743NF2NQ3Q'
            },
            growth: { 
                monthly: 249, 
                annual: 2499, 
                maxUsers: 5, 
                paypalMonthlyId: 'P-28654892HJ758760TNFSINHI',
                paypalAnnualId: 'P-8J157027AL934662ANF2NRRQ'
            },
            enterprise: { 
                monthly: 499, 
                annual: 4999, 
                maxUsers: 15, 
                paypalMonthlyId: 'P-0BT11107TW308654VNFSIPKQ',
                paypalAnnualId: 'P-8XG25679MV633610PNF2NSHQ'
            }
        },
        excessUserFee: 25,
        updatedAt: new Date().toISOString(),
        platformPaypalClientId: 'AVrcsgHKXDm2LBYBYgDhSppJADPQ_aqdLFm9PX1j2vwYFiWRiZu_oxzMrTNJchmSVih7S49B_HLkNFcB'
    });
    
    const [platformOrg, setPlatformOrg] = useState<Organization | null>(null);
    const editingJob = useMemo(() => platformInvoices.find(j => j.id === editingInvoiceId), [platformInvoices, editingInvoiceId]);

    // Synchronize with AppContext (Live DB updates)
    useEffect(() => {
        if (state.platformSettings) {
            setConfig(state.platformSettings);
        }
    }, [state.platformSettings]);

    // Fetch Platform Organization Details
    useEffect(() => {
        const fetchPlatformOrg = async () => {
            try {
                const doc = await db.collection('organizations').doc('platform').get();
                if (doc.exists) {
                    setPlatformOrg({ ...doc.data(), id: doc.id } as Organization);
                } else {
                    const defaultPlatform: Organization = { 
                        id: 'platform', 
                        name: 'TekTrakker', 
                        email: 'billing@tektrakker.com', 
                        phone: '', 
                        address: { street: '', city: '', state: '', zip: '' }, 
                        subscriptionStatus: 'active' 
                    };
                    await db.collection('organizations').doc('platform').set(defaultPlatform);
                    setPlatformOrg(defaultPlatform);
                }
            } catch (e) { console.error(e); }
        };
        fetchPlatformOrg();
    }, []);

    // Fetch Invoices
    useEffect(() => {
        if (activeTab === 'invoices') {
            setIsLoadingInvoices(true);
            const unsub = db.collection('jobs')
                .where('source', '==', 'PlatformAdmin')
                .limit(100)
                .onSnapshot((snap) => {
                    const jobs = snap.docs.map(d => ({ ...d.data(), id: d.id } as Job));
                    jobs.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
                    setPlatformInvoices(jobs);
                    setIsLoadingInvoices(false);
                }, () => setIsLoadingInvoices(false));
            return () => unsub();
        }
    }, [activeTab]);

    const [upgradePlan, setUpgradePlan] = useState<Organization['plan']>('starter');
    const [additionalUsers, setAdditionalUsers] = useState(0);
    const [customCharge, setCustomCharge] = useState(0);
    const [isFreeAccess, setIsFreeAccess] = useState(false);
    const [customDiscountPct, setCustomDiscountPct] = useState(0);
    const [notes, setNotes] = useState('');

    const getBasePrice = (plan: string) => config.plans[plan as keyof typeof config.plans]?.monthly || 99;
    const getUserFee = () => config.excessUserFee || 25;

    const stats = useMemo(() => {
        const active = orgs.filter(o => o.subscriptionStatus === 'active');
        const trial = orgs.filter(o => o.subscriptionStatus === 'trial');
        const expired = orgs.filter(o => o.subscriptionExpiryDate && new Date(o.subscriptionExpiryDate) < new Date());
        const mrr = active.reduce((sum, o) => {
            if (o.isFreeAccess) return sum;
            const base = getBasePrice(o.plan || 'starter');
            const userFee = (o.additionalUserSlots || 0) * getUserFee();
            return sum + ((base + userFee) * (1 - ((o.customDiscountPct || 0) / 100)));
        }, 0);
        return { mrr, activeCount: active.length, trialCount: trial.length, expiredCount: expired.length, enterpriseCount: active.filter(o => o.plan === 'enterprise').length, growthCount: active.filter(o => o.plan === 'growth').length, starterCount: active.filter(o => o.plan === 'starter').length };
    }, [orgs, config]);

    const filteredOrgs = orgs.filter(o => {
        if (filterType === 'active') return o.subscriptionStatus === 'active';
        if (filterType === 'trial') return o.subscriptionStatus === 'trial';
        if (filterType === 'expired') return o.subscriptionExpiryDate && new Date(o.subscriptionExpiryDate) < new Date();
        if (filterType === 'enterprise') return o.plan === 'enterprise';
        return true;
    });

    const formatCurrency = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);

    const handleOpenManage = (org: Organization) => {
        setSelectedOrg(org);
        setUpgradePlan(org.plan || 'starter');
        setAdditionalUsers(org.additionalUserSlots || 0);
        setCustomCharge(0);
        setIsFreeAccess(org.isFreeAccess || false);
        setCustomDiscountPct(org.customDiscountPct || 0);
        setNotes('');
        setIsManageModalOpen(true);
    };

    const handleSaveConfig = async () => {
        setIsSubmitting(true);
        try {
            await db.collection('platformSettings').doc('global').set({ ...config, updatedAt: new Date().toISOString() });
            if (platformOrg) await db.collection('organizations').doc('platform').update(platformOrg);
            alert("Settings updated successfully and synchronized.");
        } catch (e) { alert("Failed to update config."); }
        finally { setIsSubmitting(false); }
    };

    const handleGenerateUpgradeInvoice = async () => {
        if (!selectedOrg) return;
        setIsSubmitting(true);

        const basePrice = isFreeAccess ? 0 : getBasePrice(upgradePlan || 'starter');
        const userCosts = isFreeAccess ? 0 : (additionalUsers * getUserFee());
        const grossSubtotal = basePrice + userCosts + customCharge;
        const discountAmount = isFreeAccess ? 0 : (grossSubtotal * (customDiscountPct / 100));
        const netBeforeTax = Math.max(0, grossSubtotal - discountAmount);

        const isTexas = (selectedOrg.address?.state || '').trim().toUpperCase() === 'TX';
        const taxRate = isTexas ? 0.066 : 0;
        const taxAmount = netBeforeTax * taxRate;
        const finalTotal = netBeforeTax + taxAmount;

        const jobId = `platform-inv-${Date.now()}`;
        const invoiceData: any = {
            id: jobId,
            organizationId: 'platform',
            customerName: selectedOrg.name,
            customerId: selectedOrg.id,
            customerEmail: selectedOrg.email,
            address: selectedOrg.address,
            tasks: ['Platform Subscription Upgrade'],
            jobStatus: 'Completed',
            appointmentTime: new Date().toISOString(),
            source: 'PlatformAdmin',
            invoice: {
                id: `SAAS-${Date.now()}`,
                status: finalTotal === 0 ? 'Paid' : 'Unpaid',
                items: [{ id: 'item-1', description: `Upgrade to ${upgradePlan?.toUpperCase()}`, quantity: 1, unitPrice: basePrice, total: basePrice, type: 'Fee' }],
                subtotal: netBeforeTax,
                taxRate: taxRate,
                taxAmount: taxAmount,
                totalAmount: finalTotal,
                amount: finalTotal
            },
            jobEvents: [],
            createdAt: new Date().toISOString()
        };

        try {
            await db.collection('jobs').doc(jobId).set(invoiceData);
            await db.collection('organizations').doc(selectedOrg.id).update({ plan: upgradePlan, isFreeAccess: isFreeAccess, customDiscountPct: customDiscountPct, additionalUserSlots: additionalUsers });
            alert(`Upgrade processed. Total: ${formatCurrency(finalTotal)}`);
            setIsManageModalOpen(false);
        } catch (e) { alert("Failed to generate upgrade invoice."); }
        finally { setIsSubmitting(false); }
    };

    const handleSendRenewalReminder = async (org: Organization) => {
        if (!org.email) {
            alert("Organization email missing.");
            return;
        }

        if (!await globalConfirm(`Send renewal reminder to ${org.name} (${org.email})?`)) return;

        setIsSubmitting(true);
        try {
            const orgName = platformOrg?.name || 'TekTrakker';
            await db.collection('mail').add({
                to: [org.email],
                message: {
                    subject: `Subscription Renewal Reminder - ${orgName}`,
                    html: `
                        <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 8px;">
                            <h2 style="color: #0284c7;">Renewal Reminder</h2>
                            <p>Hi ${org.name},</p>
                            <p>This is a friendly reminder that your subscription for <strong>${orgName}</strong> is approaching its renewal date.</p>
                            <p>Current Plan: <strong>${org.plan?.toUpperCase()}</strong></p>
                            <p>Expiry Date: <strong>${org.subscriptionExpiryDate || 'N/A'}</strong></p>
                            <div style="margin: 20px 0;">
                                <a href="${window.location.origin}/#/billing" style="background-color: #0284c7; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Manage Subscription</a>
                            </div>
                            <p>If you have any questions, please reply to this email.</p>
                            <p>Thank you for being a valued partner!</p>
                        </div>
                    `,
                },
                organizationId: 'platform',
                type: 'RenewalReminder',
                createdAt: new Date().toISOString()
            });
            alert(`Renewal reminder sent to ${org.email}`);
        } catch (e) {
            console.error(e);
            alert("Failed to send reminder.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="space-y-6 pb-20">
            {editingInvoiceId && <InvoiceEditorModal isOpen={true} onClose={() => setEditingInvoiceId(null)} jobId={editingInvoiceId} />}
            {previewJob && <DocumentPreview type="Invoice" data={previewJob} onClose={() => setPreviewJob(null)} organization={platformOrg} />}

            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Platform Revenue Management</h2>
                    <p className="text-gray-600 dark:text-gray-400 font-medium">Production billing settings and overview.</p>
                </div>
                <div className="flex gap-2 bg-gray-200 dark:bg-gray-700 p-1 rounded-lg w-full overflow-x-auto whitespace-nowrap scrollbar-hide">
                    <button onClick={() => setActiveTab('dashboard')} className={`shrink-0 min-w-max whitespace-nowrap px-4 py-2 text-sm font-bold rounded-md ${activeTab === 'dashboard' ? 'bg-white dark:bg-gray-800 text-primary-600 dark:text-white shadow' : 'text-gray-600 dark:text-gray-300'}`}>Dashboard</button>
                    <button onClick={() => setActiveTab('invoices')} className={`shrink-0 min-w-max whitespace-nowrap px-4 py-2 text-sm font-bold rounded-md ${activeTab === 'invoices' ? 'bg-white dark:bg-gray-800 text-primary-600 dark:text-white shadow' : 'text-gray-600 dark:text-gray-300'}`}>Invoices</button>
                    <button onClick={() => setActiveTab('settings')} className={`shrink-0 min-w-max whitespace-nowrap px-4 py-2 text-sm font-bold rounded-md ${activeTab === 'settings' ? 'bg-white dark:bg-gray-800 text-primary-600 dark:text-white shadow' : 'text-gray-600 dark:text-gray-300'}`}>Settings</button>
                </div>
            </header>

            {activeTab === 'dashboard' && (
                <>
                    <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
                        <Card className="border-l-4 border-emerald-500" onClick={() => setFilterType('all')}><p className="text-xs font-bold text-slate-500 uppercase">Estimated MRR</p><p className="text-2xl font-black text-slate-900 dark:text-white">{formatCurrency(stats.mrr)}</p></Card>
                        <Card className="border-l-4 border-sky-500" onClick={() => setFilterType('active')}><p className="text-xs font-bold text-slate-500 uppercase">Active</p><p className="text-2xl font-black text-slate-900 dark:text-white">{stats.activeCount}</p></Card>
                        <Card className="border-l-4 border-amber-500" onClick={() => setFilterType('trial')}><p className="text-xs font-bold text-slate-500 uppercase">Trials</p><p className="text-2xl font-black text-slate-900 dark:text-white">{stats.trialCount}</p></Card>
                        <Card className="border-l-4 border-purple-500" onClick={() => setFilterType('enterprise')}><p className="text-xs font-bold text-slate-500 uppercase">Enterprise</p><p className="text-2xl font-black text-slate-900 dark:text-white">{stats.enterpriseCount}</p></Card>
                        <Card className="border-l-4 border-rose-500" onClick={() => setFilterType('expired')}><p className="text-xs font-bold text-slate-500 uppercase">Expired</p><p className="text-2xl font-black text-slate-900 dark:text-white">{stats.expiredCount}</p></Card>
                    </div>

                    <Card className="shadow-lg mt-6">
                        <Table headers={['Organization', 'Plan', 'Renewal', 'Value', 'Status', 'Actions']}>
                            {filteredOrgs.map(org => {
                                const val = org.isFreeAccess ? 0 : (getBasePrice(org.plan || 'starter') * (1 - ((org.customDiscountPct || 0) / 100)));
                                return (
                                    <tr key={org.id} className="hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer" onClick={() => handleOpenManage(org)}>
                                        <td className="px-6 py-4 font-black">{org.name}</td>
                                        <td className="px-6 py-4 capitalize">{org.plan}</td>
                                        <td className="px-6 py-4 text-xs">{org.subscriptionExpiryDate || 'N/A'}</td>
                                        <td className="px-6 py-4 font-black">{formatCurrency(val)}</td>
                                        <td className="px-6 py-4 capitalize font-bold">{org.subscriptionStatus}</td>
                                        <td className="px-6 py-4 flex gap-2">
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); handleSendRenewalReminder(org); }} 
                                                className="p-2 text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
                                                title="Send Renewal Reminder"
                                            >
                                                <Mail size={16} />
                                            </button>
                                            <ArrowUpRight size={14} className="mt-2 text-gray-400" />
                                        </td>
                                    </tr>
                                );
                            })}
                        </Table>
                    </Card>
                </>
            )}

            {activeTab === 'invoices' && (
                <Card className="shadow-lg">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-xl font-bold">Platform Invoices</h3>
                    </div>
                    {isLoadingInvoices ? (
                        <div className="p-4 md:p-8 text-center text-gray-500">Loading invoices...</div>
                    ) : (
                        <Table headers={['Customer', 'Date', 'Amount', 'Status', 'Actions']}>
                            {platformInvoices.map(inv => (
                                <tr key={inv.id} className="hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                                    <td className="px-6 py-4 font-bold">{inv.customerName}</td>
                                    <td className="px-6 py-4">{inv.createdAt ? new Date(inv.createdAt).toLocaleDateString() : 'N/A'}</td>
                                    <td className="px-6 py-4 font-black">{formatCurrency(inv.invoice?.totalAmount || 0)}</td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2 py-1 rounded text-xs font-bold ${inv.invoice?.status === 'Paid' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                                            {inv.invoice?.status || 'Draft'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 flex gap-2">
                                        <Button variant="secondary" onClick={() => setEditingInvoiceId(inv.id)} className="flex items-center gap-1">
                                            Edit
                                        </Button>
                                        <Button variant="secondary" onClick={() => setPreviewJob(inv)} className="flex items-center gap-1">
                                            <Eye size={14} /> Preview
                                        </Button>
                                    </td>
                                </tr>
                            ))}
                        </Table>
                    )}
                </Card>
            )}

            {activeTab === 'settings' && (
                <Card className="max-w-6xl mx-auto">
                    <h3 className="text-2xl font-black mb-8">Platform Configuration</h3>
                    <div className="space-y-10">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <Input label="Platform Name" value={platformOrg?.name || ''} onChange={e => setPlatformOrg(p => p ? {...p, name: e.target.value} : null)} />
                            <Input label="Billing Email" value={platformOrg?.email || ''} onChange={e => setPlatformOrg(p => p ? {...p, email: e.target.value} : null)} />
                        </div>

                        <div className="p-6 bg-blue-50 dark:bg-blue-900/20 rounded-3xl border border-blue-100 dark:border-blue-800">
                            <h4 className="font-black text-sm uppercase text-blue-600 tracking-widest mb-4 flex items-center gap-2"><CreditCard size={18}/> PayPal Master Configuration</h4>
                            <Input label="Platform PayPal Client ID" value={config.platformPaypalClientId || ''} onChange={e => setConfig({...config, platformPaypalClientId: e.target.value})} />
                            <div className="mt-4 max-w-xs">
                                <Input label="Excess User Fee ($/mo)" type="number" value={config.excessUserFee} onChange={e => setConfig({...config, excessUserFee: parseFloat(e.target.value)})} />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                            {(['starter', 'growth', 'enterprise'] as const).map(pKey => (
                                <div key={pKey} className="p-6 bg-slate-50 dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-6">
                                    <div className="flex justify-between items-center">
                                        <h4 className="font-black text-sm uppercase text-sky-600 tracking-widest">{pKey} Tier</h4>
                                        <span className="text-[10px] bg-slate-200 dark:bg-slate-700 px-2 py-1 rounded font-bold">Max Users: {config.plans[pKey].maxUsers}</span>
                                    </div>
                                    
                                    <div className="space-y-4">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <Input label="Monthly ($)" type="number" value={config.plans[pKey].monthly} onChange={e => setConfig({...config, plans: {...config.plans, [pKey]: {...config.plans[pKey], monthly: parseFloat(e.target.value)}}})} />
                                            <Input label="Annual ($)" type="number" value={config.plans[pKey].annual} onChange={e => setConfig({...config, plans: {...config.plans, [pKey]: {...config.plans[pKey], annual: parseFloat(e.target.value)}}})} />
                                        </div>
                                        <Input label="Max Users" type="number" value={config.plans[pKey].maxUsers} onChange={e => setConfig({...config, plans: {...config.plans, [pKey]: {...config.plans[pKey], maxUsers: parseInt(e.target.value)}}})} />
                                    </div>

                                    <div className="space-y-4 pt-4 border-t dark:border-slate-800">
                                        <Input label="Monthly PayPal Plan ID" value={config.plans[pKey].paypalMonthlyId || ''} onChange={e => setConfig({...config, plans: {...config.plans, [pKey]: {...config.plans[pKey], paypalMonthlyId: e.target.value}}})} />
                                        <Input label="Annual PayPal Plan ID" value={config.plans[pKey].paypalAnnualId || ''} onChange={e => setConfig({...config, plans: {...config.plans, [pKey]: {...config.plans[pKey], paypalAnnualId: e.target.value}}})} />
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="flex justify-end pt-6 border-t dark:border-slate-800">
                            <Button onClick={handleSaveConfig} disabled={isSubmitting} className="h-14 px-12 text-lg font-black shadow-xl shadow-primary-500/20">Save All Platform Settings</Button>
                        </div>
                    </div>
                </Card>
            )}

            <Modal isOpen={isManageModalOpen} onClose={() => setIsManageModalOpen(false)} title="Manage Organization Subscription" size="lg">
                {selectedOrg && (
                    <div className="space-y-6">
                        <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl border flex items-center justify-between">
                            <div>
                                <p className="font-black text-xl">{selectedOrg.name}</p>
                                <p className="text-xs text-slate-500 font-bold">{selectedOrg.email}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-[10px] font-black uppercase text-slate-400">Current Plan</p>
                                <p className="font-black text-sky-600">{selectedOrg.plan?.toUpperCase() || 'NONE'}</p>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Select label="Change Plan Tier" value={upgradePlan} onChange={e => setUpgradePlan(e.target.value as any)}>
                                <option value="starter">Starter</option>
                                <option value="growth">Growth</option>
                                <option value="enterprise">Enterprise</option>
                            </Select>
                            <Input label="Additional User Slots" type="number" value={additionalUsers} onChange={e => setAdditionalUsers(parseInt(e.target.value) || 0)} />
                        </div>
                        <div className="p-5 bg-blue-50 dark:bg-blue-900/10 rounded-2xl border flex flex-col md:flex-row gap-6 items-center">
                            <Toggle label="Free Platform Access" enabled={isFreeAccess} onChange={setIsFreeAccess} />
                            <div className="flex-1 w-full">
                                <Input label="Special Discount (%)" type="number" value={customDiscountPct} onChange={e => setCustomDiscountPct(parseFloat(e.target.value) || 0)} />
                            </div>
                        </div>
                        <div className="p-4 md:p-8 bg-slate-900 text-white rounded-3xl text-center border-4 border-sky-500/30">
                            <p className="text-xs font-black text-sky-400 uppercase tracking-widest mb-2">Calculated Subscription Upgrade</p>
                            <div className="text-5xl font-black">
                                {isFreeAccess ? <span className="text-emerald-400">Complimentary</span> : formatCurrency((getBasePrice(upgradePlan || 'starter') + (additionalUsers * getUserFee())) * (1 - (customDiscountPct / 100)))}
                            </div>
                        </div>
                        <div className="flex gap-3 pt-4">
                            <Button variant="secondary" onClick={() => setIsManageModalOpen(false)} className="flex-1">Cancel</Button>
                            <Button onClick={handleGenerateUpgradeInvoice} disabled={isSubmitting} className="flex-1 h-12 font-black shadow-lg">Generate & Send Invoice</Button>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
};

export default MasterBilling;
