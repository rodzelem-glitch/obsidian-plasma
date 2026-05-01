import showToast from "lib/toast";
import React, { useState, useEffect, useMemo } from 'react';
import { useAppContext } from 'context/AppContext';
import Card from 'components/ui/Card';
import Table from 'components/ui/Table';
import Button from 'components/ui/Button';
import Input from 'components/ui/Input';
import Modal from 'components/ui/Modal';
import Toggle from 'components/ui/Toggle';
import { CreditCard, Receipt, Building2, TrendingUp, Settings, Gift, Percent, Plus, Search, Palette, FileText, Trash2, Mail, Eye } from 'lucide-react';
import { db } from 'lib/firebase';
import type { Organization, Job } from 'types';

const FranchiseBilling: React.FC = () => {
    const { state } = useAppContext();
    const orgs = state.allOrganizations;
    const user = state.currentUser;

    const [activeTab, setActiveTab] = useState<'dashboard' | 'invoices' | 'settings' | null>(null);
    const [filterType, setFilterType] = useState<'all' | 'active' | 'expired' | 'enterprise' | 'trial'>('all');
    const [franchiseSettings, setFranchiseSettings] = useState<any>({
        stripeSecretKey: '',
        paypalClientId: '',
        paypalClientSecret: '',
        squareAccessToken: '',
        squareLocationId: '',
        plans: {
            starter: { monthly: 99, annual: 990 },
            growth: { monthly: 149, annual: 1490 },
            enterprise: { monthly: 299, annual: 2990 },
            extraUser: 10
        }
    });
    const [invoices, setInvoices] = useState<Job[]>([]);
    const [isLoadingInvoices, setIsLoadingInvoices] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    // Filter organizations belonging to this franchise
    const franchiseOrgs = useMemo(() => {
        return orgs.filter(o => o.franchiseId === user?.franchiseId);
    }, [orgs, user?.franchiseId]);
    
    const validOrgs = useMemo(() => {
        return franchiseOrgs.filter(o => {
            const orgName = (o.name || '').toLowerCase();
            return !(orgName.includes('test') || orgName.includes('demo') || (o as any).isDemo);
        });
    }, [franchiseOrgs]);

    const stats = useMemo(() => {
        const active = validOrgs.filter(o => o.subscriptionStatus === 'active');
        const trial = validOrgs.filter(o => o.subscriptionStatus === 'trial');
        const expired = validOrgs.filter(o => o.subscriptionExpiryDate && new Date(o.subscriptionExpiryDate) < new Date());
        const mrr = active.reduce((sum, o) => {
            if (o.isFreeAccess) return sum;
            const base = franchiseSettings.plans?.[o.plan || 'starter']?.monthly || 0;
            const userFee = (o.additionalUserSlots || 0) * (franchiseSettings.plans?.extraUser || 0);
            return sum + ((base + userFee) * (1 - ((o.customDiscountPct || 0) / 100)));
        }, 0);
        return { mrr, activeCount: active.length, trialCount: trial.length, expiredCount: expired.length, enterpriseCount: active.filter(o => o.plan === 'enterprise').length };
    }, [validOrgs, franchiseSettings.plans]);

    const filteredOrgs = franchiseOrgs.filter(o => {
        if (filterType === 'active') return o.subscriptionStatus === 'active';
        if (filterType === 'trial') return o.subscriptionStatus === 'trial';
        if (filterType === 'expired') return o.subscriptionExpiryDate && new Date(o.subscriptionExpiryDate) < new Date();
        if (filterType === 'enterprise') return o.plan === 'enterprise';
        return true;
    });

    useEffect(() => {
        if (!user?.franchiseId) return;

        const loadSettings = async () => {
            const doc = await db.collection('franchises').doc(user.franchiseId!).get();
            if (doc.exists && doc.data()?.billingConfig) {
                setFranchiseSettings(doc.data()!.billingConfig);
            }
        };
        loadSettings();
    }, [user?.franchiseId]);

    useEffect(() => {
        if (activeTab === 'invoices' && user?.franchiseId) {
            setIsLoadingInvoices(true);
            const unsub = db.collection('jobs')
                .where('franchiseId', '==', user.franchiseId)
                .where('source', '==', 'FranchiseAdmin')
                .limit(100)
                .onSnapshot(snap => {
                    setInvoices(snap.docs.map(d => ({ ...d.data(), id: d.id } as Job)));
                    setIsLoadingInvoices(false);
                });
            return () => unsub();
        }
    }, [activeTab, user?.franchiseId]);

    const handleSaveSettings = async () => {
        if (!user?.franchiseId) return;
        setIsSaving(true);
        try {
            await db.collection('franchises').doc(user.franchiseId).update({
                billingConfig: franchiseSettings
            });
            showToast.warn('Billing parameters saved successfully. All embedded checkouts for your users will now route to your gateway.');
        } catch(e) {
            showToast.warn('Failed to save settings');
            console.error(e);
        }
        setIsSaving(false);
    };

    const formatCurrency = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);

    return (
        <div className="space-y-6 pb-20 fade-in">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div onClick={() => setActiveTab('dashboard')} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-all cursor-pointer p-6 flex flex-col group overflow-hidden relative">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="h-12 w-12 bg-blue-100 dark:bg-blue-900/30 text-blue-600 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform"><TrendingUp size={24} /></div>
                        <div>
                            <h3 className="font-bold text-lg">Revenue Dashboard</h3>
                            <p className="text-sm text-slate-500">MRR & Overview</p>
                        </div>
                    </div>
                </div>

                <div onClick={() => setActiveTab('invoices')} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-all cursor-pointer p-6 flex flex-col group overflow-hidden relative">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="h-12 w-12 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform"><Receipt size={24} /></div>
                        <div>
                            <h3 className="font-bold text-lg">Paper Trail</h3>
                            <p className="text-sm text-slate-500">Sent Invoices</p>
                        </div>
                    </div>
                </div>

                <div onClick={() => setActiveTab('settings')} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-all cursor-pointer p-6 flex flex-col group overflow-hidden relative">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="h-12 w-12 bg-purple-100 dark:bg-purple-900/30 text-purple-600 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform"><Settings size={24} /></div>
                        <div>
                            <h3 className="font-bold text-lg">Payment Settings</h3>
                            <p className="text-sm text-slate-500">Gateways & Pricing</p>
                        </div>
                    </div>
                </div>
            </div>

            <Modal isOpen={activeTab === 'dashboard'} onClose={() => setActiveTab(null)} title="Revenue Dashboard" size="full">
                <>
                    <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
                        <Card className="border-l-4 border-emerald-500 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800" onClick={() => setFilterType('all')}><p className="text-xs font-bold text-slate-500 uppercase">Estimated MRR</p><p className="text-2xl font-black text-slate-900 dark:text-white">{formatCurrency(stats.mrr)}</p></Card>
                        <Card className="border-l-4 border-sky-500 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800" onClick={() => setFilterType('active')}><p className="text-xs font-bold text-slate-500 uppercase">Active</p><p className="text-2xl font-black text-slate-900 dark:text-white">{stats.activeCount}</p></Card>
                        <Card className="border-l-4 border-amber-500 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800" onClick={() => setFilterType('trial')}><p className="text-xs font-bold text-slate-500 uppercase">Trials</p><p className="text-2xl font-black text-slate-900 dark:text-white">{stats.trialCount}</p></Card>
                        <Card className="border-l-4 border-purple-500 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800" onClick={() => setFilterType('enterprise')}><p className="text-xs font-bold text-slate-500 uppercase">Enterprise</p><p className="text-2xl font-black text-slate-900 dark:text-white">{stats.enterpriseCount}</p></Card>
                        <Card className="border-l-4 border-rose-500 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800" onClick={() => setFilterType('expired')}><p className="text-xs font-bold text-slate-500 uppercase">Expired</p><p className="text-2xl font-black text-slate-900 dark:text-white">{stats.expiredCount}</p></Card>
                    </div>

                    <Card className="shadow-lg mt-6">
                        <h3 className="text-lg font-bold mb-4">Your Enrolled Organizations</h3>
                        <Table headers={['Organization', 'Contact Email', 'Current Plan', 'Est. Value', 'Status']}>
                            {filteredOrgs.map(org => {
                                const val = org.isFreeAccess ? 0 : ((franchiseSettings.plans?.[org.plan || 'starter']?.monthly || 0) * (1 - ((org.customDiscountPct || 0) / 100)));
                                return (
                                <tr key={org.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-6 py-4 font-black">{org.name}</td>
                                    <td className="px-6 py-4">{org.email}</td>
                                    <td className="px-6 py-4 capitalize">{org.plan || 'Starter'}</td>
                                    <td className="px-6 py-4 font-black text-sky-600">{formatCurrency(val)}</td>
                                    <td className="px-6 py-4 capitalize font-bold text-emerald-600">{org.subscriptionStatus}</td>
                                </tr>
                                )
                            })}
                        </Table>
                    </Card>
                </>
            </Modal>

            <Modal isOpen={activeTab === 'invoices'} onClose={() => setActiveTab(null)} title="Paper Trail & Sent Invoices" size="full">
                <Card className="shadow-lg">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-xl font-bold">Paper Trail & Sent Invoices</h3>
                    </div>
                    {isLoadingInvoices ? (
                        <div className="p-4 md:p-8 text-center text-gray-500">Loading your transactions...</div>
                    ) : (
                        <Table headers={['Billed To', 'Date', 'Amount', 'Status']}>
                            {invoices.length === 0 && (
                                <tr><td colSpan={4} className="text-center py-6 text-gray-500">No invoices have been generated yet. Set up your payment gateway in settings.</td></tr>
                            )}
                            {invoices.map(inv => (
                                <tr key={inv.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-6 py-4 font-bold">{inv.customerName}</td>
                                    <td className="px-6 py-4">{inv.createdAt ? new Date(inv.createdAt).toLocaleDateString() : 'N/A'}</td>
                                    <td className="px-6 py-4 font-black">{formatCurrency(inv.invoice?.totalAmount || 0)}</td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2 py-1 rounded text-xs font-bold ${inv.invoice?.status === 'Paid' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                                            {inv.invoice?.status || 'Draft'}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </Table>
                    )}
                </Card>
            </Modal>

            <Modal isOpen={activeTab === 'settings'} onClose={() => setActiveTab(null)} title="Payment Settings" size="full">
                <Card className="max-w-4xl mx-auto shadow-lg">
                    <div className="flex items-center gap-3 mb-8 border-b pb-4">
                        <div className="h-12 w-12 rounded-xl bg-blue-100 text-blue-600 flex justify-center items-center">
                            <CreditCard size={24} />
                        </div>
                        <div>
                            <h3 className="text-2xl font-black">Configure Your Gateway</h3>
                            <p className="text-gray-500 text-sm">Enter your personal payment keys to intercept onboarding payments directly to your bank account.</p>
                        </div>
                    </div>

                    <div className="space-y-8">
                        {/* Stripe */}
                        <div className="p-6 bg-slate-50 dark:bg-slate-800 rounded-2xl border">
                            <h4 className="font-bold mb-4 text-[#635BFF] flex items-center gap-2">Stripe Integration</h4>
                            <div className="grid grid-cols-1 gap-4">
                                <Input label="Secret API Key (sk_live_...)" value={franchiseSettings.stripeSecretKey || ''} onChange={(e) => setFranchiseSettings({...franchiseSettings, stripeSecretKey: e.target.value})} placeholder="sk_live_..." />
                                <Input label="Webhook Signing Secret (whsec_...)" value={franchiseSettings.stripeWebhookSecret || ''} onChange={(e) => setFranchiseSettings({...franchiseSettings, stripeWebhookSecret: e.target.value})} placeholder="whsec_..." />
                            </div>
                        </div>

                        {/* PayPal */}
                        <div className="p-6 bg-slate-50 dark:bg-slate-800 rounded-2xl border">
                            <h4 className="font-bold mb-4 text-[#003087] flex items-center gap-2">PayPal Integration</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Input label="Client ID" value={franchiseSettings.paypalClientId || ''} onChange={(e) => setFranchiseSettings({...franchiseSettings, paypalClientId: e.target.value})} placeholder="Live Client ID" />
                                <Input label="Client Secret" value={franchiseSettings.paypalClientSecret || ''} onChange={(e) => setFranchiseSettings({...franchiseSettings, paypalClientSecret: e.target.value})} placeholder="Live Client Secret" />
                            </div>
                        </div>

                        {/* Square */}
                        <div className="p-6 bg-slate-50 dark:bg-slate-800 rounded-2xl border">
                            <h4 className="font-bold mb-4 text-slate-800 dark:text-slate-200 flex items-center gap-2">Square Integration</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Input label="Production Access Token" value={franchiseSettings.squareAccessToken || ''} onChange={(e) => setFranchiseSettings({...franchiseSettings, squareAccessToken: e.target.value})} placeholder="sq0p..." />
                                <Input label="Location ID" value={franchiseSettings.squareLocationId || ''} onChange={(e) => setFranchiseSettings({...franchiseSettings, squareLocationId: e.target.value})} placeholder="L..." />
                            </div>
                        </div>

                        <div className="p-6 bg-blue-50 dark:bg-blue-900/20 rounded-2xl border border-blue-100 dark:border-blue-800">
                            <h4 className="font-bold mb-4 text-blue-800 dark:text-blue-200">Set the Plans & Pricing for your Customers</h4>
                            <p className="text-xs text-blue-600 mb-6">How much do you want your white-label software to cost for your enrolled organizations? Define your 3-tier plans below.</p>
                            
                            <div className="grid grid-cols-1 gap-8">
                                {(['starter', 'growth', 'enterprise'] as const).map(pKey => (
                                    <div key={pKey} className="p-6 bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 space-y-6">
                                        <div className="flex justify-between items-center">
                                            <h4 className="font-black text-sm uppercase text-sky-600 tracking-widest">{pKey} Tier</h4>
                                            <span className="text-[10px] bg-slate-200 dark:bg-slate-700 px-2 py-1 rounded font-bold">Max Users: {franchiseSettings.plans?.[pKey]?.maxUsers || 0}</span>
                                        </div>
                                        
                                        <div className="space-y-4">
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <Input label="Monthly ($)" type="number" value={franchiseSettings.plans?.[pKey]?.monthly || 0} onChange={e => setFranchiseSettings({...franchiseSettings, plans: {...franchiseSettings.plans, [pKey]: {...franchiseSettings.plans?.[pKey], monthly: parseFloat(e.target.value) || 0}}})} />
                                                <Input label="Annual ($)" type="number" value={franchiseSettings.plans?.[pKey]?.annual || 0} onChange={e => setFranchiseSettings({...franchiseSettings, plans: {...franchiseSettings.plans, [pKey]: {...franchiseSettings.plans?.[pKey], annual: parseFloat(e.target.value) || 0}}})} />
                                            </div>
                                            <div className="flex gap-4 items-center">
                                                <div className="flex-1">
                                                    <Input label="Max Users" type="number" disabled={!!franchiseSettings.plans?.[pKey]?.unlimitedUsers} value={franchiseSettings.plans?.[pKey]?.unlimitedUsers ? 999999 : franchiseSettings.plans?.[pKey]?.maxUsers || 0} onChange={e => setFranchiseSettings({...franchiseSettings, plans: {...franchiseSettings.plans, [pKey]: {...franchiseSettings.plans?.[pKey], maxUsers: parseInt(e.target.value) || 0}}})} />
                                                </div>
                                                <div className="pt-6">
                                                    <Toggle label="Unlimited Users" enabled={!!franchiseSettings.plans?.[pKey]?.unlimitedUsers} onChange={v => setFranchiseSettings({...franchiseSettings, plans: {...franchiseSettings.plans, [pKey]: {...franchiseSettings.plans?.[pKey], unlimitedUsers: v}}})} />
                                                </div>
                                            </div>
                                            <div className="pt-3 border-t dark:border-slate-800">
                                                <label className="text-sm font-medium mb-1 block">Ribbon Promotion Text</label>
                                                <div className="flex gap-4 items-center">
                                                    <Toggle label="Enable Ribbon" enabled={!!franchiseSettings.plans?.[pKey]?.ribbonText} onChange={v => setFranchiseSettings({...franchiseSettings, plans: {...franchiseSettings.plans, [pKey]: {...franchiseSettings.plans?.[pKey], ribbonText: v ? 'Launch Special' : ''}}})} />
                                                    <div className="flex-1">
                                                        {!!franchiseSettings.plans?.[pKey]?.ribbonText && <Input placeholder="e.g. Launch Special" value={franchiseSettings.plans?.[pKey]?.ribbonText || ''} onChange={e => setFranchiseSettings({...franchiseSettings, plans: {...franchiseSettings.plans, [pKey]: {...franchiseSettings.plans?.[pKey], ribbonText: e.target.value}}})} />}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="pt-3 border-t dark:border-slate-800">
                                                <label className="text-sm font-medium mb-3 block">Features Included</label>
                                                <div className="grid grid-cols-2 gap-3 mb-4">
                                                    {[
                                                        { id: 'publicBooking', name: 'Online Booking' }, { id: 'proposals', name: 'Interactive Proposals' },
                                                        { id: 'timeTracking', name: 'Time & Mileage Tracking' }, { id: 'inventory', name: 'Fleet & Inventory' },
                                                        { id: 'salesCrm', name: 'Sales Pipeline (CRM)' }, { id: 'hrDocuments', name: 'HR & Documents' },
                                                        { id: 'careerPage', name: 'Recruiting Portal' }, { id: 'ai', name: 'AI Features' },
                                                        { id: 'quickbooks', name: 'QuickBooks Sync' }, { id: 'subcontractors', name: 'Subcontractors' },
                                                        { id: '1099', name: 'Tax 1099 Generation' }, { id: 'api', name: 'API & Webhooks' },
                                                        { id: 'branding', name: 'Custom Branding' }
                                                    ].map(ft => {
                                                        const isEnabled = (franchiseSettings.plans?.[pKey]?.features || []).includes(ft.id);
                                                        return (
                                                            <label key={ft.id} className="flex items-center gap-2 cursor-pointer hover:bg-slate-800/30 p-1 rounded transition-colors">
                                                                <input 
                                                                    type="checkbox" 
                                                                    checked={isEnabled}
                                                                    onChange={(e) => {
                                                                        const current = franchiseSettings.plans?.[pKey]?.features || [];
                                                                        const next = e.target.checked ? [...current, ft.id] : current.filter((x: string) => x !== ft.id);
                                                                        setFranchiseSettings({...franchiseSettings, plans: {...franchiseSettings.plans, [pKey]: {...franchiseSettings.plans?.[pKey], features: next}}});
                                                                    }}
                                                                    className="rounded bg-slate-700 border-slate-600 text-sky-500 focus:ring-sky-500"
                                                                />
                                                                <span className="text-xs font-semibold">{ft.name}</span>
                                                            </label>
                                                        );
                                                    })}
                                                </div>
                                                
                                                {(franchiseSettings.plans?.[pKey]?.features || []).includes('ai') && (
                                                    <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl border border-indigo-100 dark:border-indigo-800/50">
                                                        <Input 
                                                            label="AI Tokens Allowed / Month" 
                                                            type="number" 
                                                            value={franchiseSettings.plans?.[pKey]?.aiTokensPerMonth || 0} 
                                                            onChange={e => setFranchiseSettings({...franchiseSettings, plans: {...franchiseSettings.plans, [pKey]: {...franchiseSettings.plans?.[pKey], aiTokensPerMonth: parseInt(e.target.value) || 0}}})} 
                                                        />
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <div className="space-y-4 pt-4 border-t dark:border-slate-800">
                                            <Input label="Monthly PayPal Plan ID" value={franchiseSettings.plans?.[pKey]?.paypalMonthlyId || ''} onChange={e => setFranchiseSettings({...franchiseSettings, plans: {...franchiseSettings.plans, [pKey]: {...franchiseSettings.plans?.[pKey], paypalMonthlyId: e.target.value}}})} />
                                            <Input label="Annual PayPal Plan ID" value={franchiseSettings.plans?.[pKey]?.paypalAnnualId || ''} onChange={e => setFranchiseSettings({...franchiseSettings, plans: {...franchiseSettings.plans, [pKey]: {...franchiseSettings.plans?.[pKey], paypalAnnualId: e.target.value}}})} />
                                        </div>
                                    </div>
                                ))}

                                <div className="mt-8 pt-8 border-t border-blue-100 dark:border-blue-800">
                                    <div className="max-w-md">
                                        <h5 className="font-bold text-sm text-blue-800 dark:text-blue-200">Extra Seat / User Add-on Fee</h5>
                                        <p className="text-xs text-blue-600 mt-1 mb-4">Fee charged per extra user above the plan limit.</p>
                                        <Input label="Monthly Fee Per Extra User ($)" type="number" value={franchiseSettings.plans?.extraUser || 0} onChange={(e) => setFranchiseSettings({...franchiseSettings, plans: { ...franchiseSettings.plans, extraUser: parseFloat(e.target.value) || 0 } })} />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-end">
                            <Button onClick={handleSaveSettings} disabled={isSaving} className="h-12 px-10 font-bold shadow">
                                {isSaving ? 'Saving...' : 'Lock API Credentials'}
                            </Button>
                        </div>
                    </div>
                </Card>
            </Modal>
        </div>
    );
};

export default FranchiseBilling;
