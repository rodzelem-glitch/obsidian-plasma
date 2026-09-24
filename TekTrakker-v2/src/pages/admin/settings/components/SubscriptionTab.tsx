import showToast from "lib/toast";
import React, { useState, useEffect } from 'react';
import Card from 'components/ui/Card';
import { 
    Zap, Bot, Plus, CreditCard, Building2, LayoutDashboard, 
    ShoppingBag, Activity, FileText, ChevronRight, RefreshCw, AlertCircle
} from 'lucide-react';
import CancelSubscriptionModal from './CancelSubscriptionModal';
import { db, functions } from 'lib/firebase';
import { doc, getDoc, updateDoc, increment } from 'firebase/firestore';
import { useAppContext } from 'context/AppContext';
import { Capacitor } from '@capacitor/core';
import { KortSetupForm } from 'components/payment/KortSetupForm';

import { BillingOverviewTab } from './billing/BillingOverviewTab';
import { PlanUpgradeTab } from './billing/PlanUpgradeTab';
import { AddonsMarketplaceTab } from './billing/AddonsMarketplaceTab';
import { TokenUsageTab } from './billing/TokenUsageTab';
import { InvoicesTab } from './billing/InvoicesTab';

interface SubscriptionTabProps {
    billingDetails: {
        planName: string;
        monthlyCost: number;
        maxUsers: number;
        activeUsers: number;
        isExpired: boolean;
        isTrial: boolean;
        isFree: boolean;
        isPaused?: boolean;
        isCancelled?: boolean;
    } | null;
    handleModifyBilling: () => void;
    handleReactivate: () => void;
}

type BillingSubTab = 'overview' | 'plans' | 'addons' | 'tokens' | 'payment_methods' | 'invoices';

const SubscriptionTab: React.FC<SubscriptionTabProps> = ({ billingDetails, handleModifyBilling, handleReactivate }) => {
    const { state, dispatch } = useAppContext();
    const [activeSubTab, setActiveSubTab] = useState<BillingSubTab>('overview');
    const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
    const [vwUsage, setVwUsage] = useState({ used: 0, limit: 0 });
    const [isTestingBilling, setIsTestingBilling] = useState(false);
    const [isAddingPaymentMethod, setIsAddingPaymentMethod] = useState(false);

    const orgId = state.currentOrganization?.id;
    const orgName = state.currentOrganization?.name || 'Organization';
    const isVwEnabled = !!state.currentOrganization?.virtualWorkerEnabled;
    const hasVaultedMethod = !!state.currentOrganization?.platformVaultedPaymentMethodId;
    const vaultedType = state.currentOrganization?.platformVaultedPaymentType;

    const currentPlanKey = state.currentOrganization?.plan || 'starter';
    const planTokenLimit = state.platformSettings?.plans?.[currentPlanKey]?.aiTokensPerMonth || 
        (currentPlanKey === 'enterprise' ? 15000000 : currentPlanKey === 'business' ? 8000000 : currentPlanKey === 'growth' ? 3000000 : 1000000);

    const additionalUserSlots = state.currentOrganization?.additionalUserSlots || 0;
    const additionalDivisionsSlots = state.currentOrganization?.additionalDivisionsSlots || 0;
    const divisionsCount = state.currentOrganization?.divisions?.length || 0;
    const maxDivisions = 1 + additionalDivisionsSlots;

    useEffect(() => {
        if (!orgId) return;
        const fetchUsage = async () => {
            try {
                const d = await getDoc(doc(db, 'aiUsage', orgId));
                if (d.exists()) {
                    const data = d.data();
                    setVwUsage({
                        used: data.virtualWorkerTokensUsed || data.totalTokensUsed || 0,
                        limit: data.virtualWorkerLimitTokens || data.tokenLimit || planTokenLimit
                    });
                } else {
                    setVwUsage({
                        used: 0,
                        limit: planTokenLimit
                    });
                }
            } catch (err) {
                console.error("Error fetching AI token usage:", err);
            }
        };
        fetchUsage();
    }, [orgId, planTokenLimit]);

    const handleTestSubscriptionBilling = async () => {
        if (!orgId) return;
        setIsTestingBilling(true);
        try {
            const testFn = functions.httpsCallable('testKortSubscriptionPayment');
            const res = await testFn({ organizationId: orgId });
            if (res.data && res.data.success) {
                showToast.success(res.data.message || "Test subscription payment processed successfully!");
            } else {
                showToast.error("Failed to process payment.");
            }
        } catch (error: any) {
            console.error("Test subscription payment error:", error);
            showToast.error(error.message || "Test subscription payment failed.");
        } finally {
            setIsTestingBilling(false);
        }
    };

    const handleTopUpSuccess = (tokensAdded: number) => {
        setVwUsage(prev => ({ ...prev, limit: prev.limit + tokensAdded }));
    };

    if (!billingDetails) return null;

    const subTabs: { key: BillingSubTab; label: string; icon: any }[] = [
        { key: 'overview', label: 'Overview & Metering', icon: LayoutDashboard },
        { key: 'plans', label: 'Subscription Plans', icon: Zap },
        { key: 'addons', label: 'Products & Add-Ons', icon: ShoppingBag },
        { key: 'tokens', label: 'AI Token Usage', icon: Activity },
        { key: 'payment_methods', label: 'Payment Methods', icon: CreditCard },
        { key: 'invoices', label: 'Invoices & Receipts', icon: FileText }
    ];

    return (
        <div className="space-y-6">
            {/* Top Navigation Tabs */}
            <div className="flex border-b border-slate-200 dark:border-slate-800 overflow-x-auto no-scrollbar gap-1">
                {subTabs.map((tab) => {
                    const Icon = tab.icon;
                    const isActive = activeSubTab === tab.key;

                    return (
                        <button
                            key={tab.key}
                            onClick={() => setActiveSubTab(tab.key)}
                            className={`flex items-center gap-2 px-4 py-3 text-xs font-bold whitespace-nowrap transition border-b-2 ${
                                isActive
                                    ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400 bg-blue-50/50 dark:bg-blue-950/20'
                                    : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white'
                            }`}
                        >
                            <Icon size={16} className={isActive ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400'} />
                            <span>{tab.label}</span>
                        </button>
                    );
                })}
            </div>

            {/* Sub-Tab 1: Overview */}
            {activeSubTab === 'overview' && (
                <BillingOverviewTab
                    billingDetails={billingDetails}
                    orgId={orgId || ''}
                    vaultedType={vaultedType}
                    hasVaultedMethod={hasVaultedMethod}
                    vwUsage={vwUsage}
                    divisionsCount={divisionsCount}
                    maxDivisions={maxDivisions}
                    virtualWorkerEnabled={isVwEnabled}
                    onNavigateTab={(tabKey) => setActiveSubTab(tabKey as BillingSubTab)}
                />
            )}

            {/* Sub-Tab 2: Plans & Tier Upgrades */}
            {activeSubTab === 'plans' && (
                <PlanUpgradeTab
                    currentPlan={billingDetails.planName}
                    orgId={orgId || ''}
                />
            )}

            {/* Sub-Tab 3: Add-Ons Marketplace */}
            {activeSubTab === 'addons' && (
                <AddonsMarketplaceTab
                    orgId={orgId || ''}
                    hasVaultedMethod={hasVaultedMethod}
                    additionalUserSlots={additionalUserSlots}
                    additionalDivisionsSlots={additionalDivisionsSlots}
                    virtualWorkerEnabled={isVwEnabled}
                    aiVoiceAssistantEnabled={!!state.currentOrganization?.aiVoiceAssistantEnabled}
                    onTopUpSuccess={handleTopUpSuccess}
                    onNavigateTab={(tabKey) => setActiveSubTab(tabKey as BillingSubTab)}
                />
            )}

            {/* Sub-Tab 4: AI Token Metering */}
            {activeSubTab === 'tokens' && (
                <TokenUsageTab
                    orgId={orgId || ''}
                    vwUsage={vwUsage}
                    hasVaultedMethod={hasVaultedMethod}
                />
            )}

            {/* Sub-Tab 5: Payment Methods */}
            {activeSubTab === 'payment_methods' && (
                <div className="space-y-6">
                    <Card className="border border-slate-200 dark:border-slate-800 shadow-sm p-6">
                        <div className="flex items-start justify-between">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-10 h-10 bg-blue-50 text-blue-600 dark:bg-blue-950/40 rounded-xl flex items-center justify-center">
                                    <CreditCard size={24} />
                                </div>
                                <div>
                                    <h3 className="font-bold text-lg text-slate-900 dark:text-white">Payment Method & Automated Billing</h3>
                                    <p className="text-xs text-slate-500">Manage your credit card or ACH bank account for automated subscription billing.</p>
                                </div>
                            </div>
                            {!isAddingPaymentMethod && (
                                <button 
                                    onClick={() => setIsAddingPaymentMethod(true)}
                                    className="text-xs font-bold text-blue-600 hover:text-blue-700 bg-blue-50 dark:bg-blue-950/40 dark:text-blue-400 px-4 py-2 rounded-xl border border-blue-100 dark:border-blue-900"
                                >
                                    {hasVaultedMethod ? 'Update Payment Method' : 'Add Payment Method'}
                                </button>
                            )}
                        </div>

                        {isAddingPaymentMethod ? (
                            <div className="mt-4 flex flex-col items-center border-t border-slate-100 dark:border-slate-800 pt-6">
                                <KortSetupForm 
                                    onSuccess={async () => {
                                        setIsAddingPaymentMethod(false);
                                        if (orgId) {
                                            try {
                                                await updateDoc(doc(db, 'organizations', orgId), {
                                                    subscriptionStatus: 'active',
                                                    paymentMethodAttached: true,
                                                    updatedAt: new Date().toISOString()
                                                });
                                                dispatch({
                                                    type: 'UPDATE_ORGANIZATION',
                                                    payload: { ...state.currentOrganization, subscriptionStatus: 'active', paymentMethodAttached: true }
                                                });
                                                showToast.success("Payment method linked successfully! Your account is now active.");
                                            } catch (err) {
                                                console.error("Failed to activate subscription:", err);
                                            }
                                        }
                                    }}
                                    onError={(err) => console.error(err)}
                                />
                                <button 
                                    onClick={() => setIsAddingPaymentMethod(false)}
                                    className="mt-4 text-xs text-slate-500 hover:text-slate-700 font-medium"
                                >
                                    Cancel
                                </button>
                            </div>
                        ) : (
                            hasVaultedMethod ? (
                                <div className="mt-4 p-4 border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20 dark:border-emerald-900 rounded-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                                            {vaultedType === 'ach_debit' ? <Building2 size={20} /> : <CreditCard size={20} />}
                                        </div>
                                        <div>
                                            <p className="font-bold text-emerald-900 dark:text-emerald-300 text-sm">Securely Vaulted</p>
                                            <p className="text-xs text-emerald-700 dark:text-emerald-400">
                                                Your {vaultedType === 'ach_debit' ? 'bank account (ACH Debit)' : 'credit card'} is linked for automatic payments.
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={handleTestSubscriptionBilling}
                                        disabled={isTestingBilling}
                                        className="text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl transition shadow-sm disabled:opacity-50"
                                    >
                                        {isTestingBilling ? 'Testing Billing...' : 'Test Subscription Payment'}
                                    </button>
                                </div>
                            ) : (
                                <div className="mt-4 p-4 border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-900 rounded-xl text-amber-800 dark:text-amber-300 text-xs">
                                    No payment method on file. Please add a payment method to ensure uninterrupted platform access.
                                </div>
                            )
                        )}
                    </Card>
                </div>
            )}

            {/* Sub-Tab 6: Invoices & Receipts */}
            {activeSubTab === 'invoices' && (
                <InvoicesTab orgId={orgId || ''} orgName={orgName} />
            )}

            {/* Cancel Subscription Modal */}
            <CancelSubscriptionModal 
                isOpen={isCancelModalOpen} 
                onClose={() => setIsCancelModalOpen(false)} 
            />
        </div>
    );
};

export default SubscriptionTab;
