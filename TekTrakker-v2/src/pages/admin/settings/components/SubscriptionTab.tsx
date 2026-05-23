import showToast from "lib/toast";
import React, { useState, useEffect } from 'react';
import Card from 'components/ui/Card';
import { Zap, Bot, Plus } from 'lucide-react';
import CancelSubscriptionModal from './CancelSubscriptionModal';
import { db, functions } from 'lib/firebase';
import { doc, getDoc, updateDoc, increment } from 'firebase/firestore';
import { useAppContext } from 'context/AppContext';
import { Capacitor } from '@capacitor/core';
import { KortSetupForm } from 'components/payment/KortSetupForm';
import { CreditCard, Building2 } from 'lucide-react';

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

const SubscriptionTab: React.FC<SubscriptionTabProps> = ({ billingDetails, handleModifyBilling, handleReactivate }) => {
    const { state } = useAppContext();
    const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
    const [vwUsage, setVwUsage] = useState({ used: 0, limit: 0 });
    const [isTestingBilling, setIsTestingBilling] = useState(false);

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
        } catch (error) {
            console.error("Test subscription payment error:", error);
            showToast.error(error.message || "Test subscription payment failed.");
        } finally {
            setIsTestingBilling(false);
        }
    };
    const orgId = state.currentOrganization?.id;
    const isVwEnabled = state.currentOrganization?.virtualWorkerEnabled;
    const hasVaultedMethod = !!state.currentOrganization?.platformVaultedPaymentMethodId;
    const vaultedType = state.currentOrganization?.platformVaultedPaymentType;
    const [isAddingPaymentMethod, setIsAddingPaymentMethod] = useState(false);

    useEffect(() => {
        if (!orgId || !isVwEnabled) return;
        const fetchUsage = async () => {
            const d = await getDoc(doc(db, 'aiUsage', orgId));
            if (d.exists()) {
                setVwUsage({
                    used: d.data().virtualWorkerTokensUsed || 0,
                    limit: d.data().virtualWorkerLimitTokens || 0
                });
            }
        };
        fetchUsage();
    }, [orgId, isVwEnabled]);

    const handleTopUp = async () => {
        if (!orgId) return;
        
        if (!hasVaultedMethod) {
            showToast.error("Please add a payment method first to purchase Power Packs.");
            return;
        }

        if (window.confirm("Purchase 1,000,000 Virtual Worker Power Pack tokens for $10.00 using your saved payment method?")) {
            try {
                // Here you would typically call your Cloud Function to process the Kort payment
                // For now, we simulate the success if they have a vaulted method
                showToast.warn("Processing payment via Kort...");
                
                setTimeout(async () => {
                    await updateDoc(doc(db, 'aiUsage', orgId), {
                        virtualWorkerLimitTokens: increment(1000000)
                    });
                    setVwUsage(prev => ({ ...prev, limit: prev.limit + 1000000 }));
                    showToast.warn("Virtual Worker Power Pack tokens added successfully!");
                }, 1000);
            } catch (error) {
                showToast.error("Transaction failed.");
            }
        }
    };

    if (!billingDetails) return null;
    
    return (
        <div className="space-y-6">
            <Card className="bg-gradient-to-r from-slate-900 to-slate-800 text-white border-0 shadow-xl overflow-hidden relative">
                <div className="absolute top-0 right-0 p-4 md:p-8 opacity-10">
                    <Zap size={150} />
                </div>
                <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <h3 className="text-3xl font-black uppercase tracking-tight">{billingDetails.planName} Plan</h3>
                            {billingDetails.isTrial && <span className="bg-blue-500 text-white text-xs font-bold px-2 py-1 rounded uppercase">Trial Active</span>}
                            {billingDetails.isFree && <span className="bg-emerald-500 text-white text-xs font-bold px-2 py-1 rounded uppercase">Partner Account</span>}
                            {billingDetails.isPaused && <span className="bg-amber-500 text-white text-xs font-bold px-2 py-1 rounded uppercase">Paused</span>}
                            {billingDetails.isCancelled && <span className="bg-red-500 text-white text-xs font-bold px-2 py-1 rounded uppercase">Cancelled</span>}
                        </div>
                        <p className="text-slate-400">
                            {billingDetails.activeUsers} / {billingDetails.maxUsers} Active Users
                        </p>
                    </div>
                    <div className="text-right flex flex-col items-end">
                        <p className="text-4xl font-black">${billingDetails.monthlyCost.toFixed(2)}<span className="text-sm font-medium text-slate-400">/mo</span></p>
                        <div className="flex gap-4 mt-4 items-center">
                            {(billingDetails.isPaused || billingDetails.isCancelled) ? (
                                <button onClick={handleReactivate} className="text-sm font-bold px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded">Reactivate Subscription</button>
                            ) : (
                                <button onClick={() => setIsCancelModalOpen(true)} className="text-xs text-red-400 hover:text-red-300 transition-colors">Cancel Subscription</button>
                            )}
                            {!(billingDetails.isPaused || billingDetails.isCancelled) && (
                                <button onClick={handleModifyBilling} className="text-sm font-bold text-blue-400 hover:text-white underline">Manage Billing</button>
                            )}
                        </div>
                    </div>
                </div>

                <CancelSubscriptionModal 
                    isOpen={isCancelModalOpen} 
                    onClose={() => setIsCancelModalOpen(false)} 
                />
            </Card>

            <Card className="border border-slate-200 shadow-sm">
                    <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center">
                            <CreditCard size={24} />
                        </div>
                        <div>
                            <h3 className="font-bold text-lg text-slate-900">Payment Method</h3>
                            <p className="text-sm text-slate-500">Manage your card or bank account for automated subscription billing.</p>
                        </div>
                    </div>
                    {!isAddingPaymentMethod && (
                        <button 
                            onClick={() => setIsAddingPaymentMethod(true)}
                            className="text-sm font-bold text-blue-600 hover:text-blue-700 bg-blue-50 px-4 py-2 rounded-lg"
                        >
                            {hasVaultedMethod ? 'Update Payment Method' : 'Add Payment Method'}
                        </button>
                    )}
                </div>

                {isAddingPaymentMethod ? (
                    <div className="mt-4 flex flex-col items-center border-t border-slate-100 pt-6">
                        <KortSetupForm 
                            onSuccess={() => {
                                setIsAddingPaymentMethod(false);
                            }}
                            onError={(err) => console.error(err)}
                        />
                        <button 
                            onClick={() => setIsAddingPaymentMethod(false)}
                            className="mt-4 text-sm text-slate-500 hover:text-slate-700 font-medium"
                        >
                            Cancel
                        </button>
                    </div>
                ) : (
                    hasVaultedMethod ? (
                        <div className="mt-4 p-4 border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20 dark:border-emerald-900 rounded-lg flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                                    {vaultedType === 'ach_debit' ? <Building2 size={16} /> : <CreditCard size={16} />}
                                </div>
                                <div>
                                    <p className="font-semibold text-emerald-900 dark:text-emerald-300 text-sm">Securely Vaulted</p>
                                    <p className="text-xs text-emerald-700 dark:text-emerald-400">Your {vaultedType === 'ach_debit' ? 'bank account' : 'credit card'} is linked for automatic payments.</p>
                                </div>
                            </div>
                            <button
                                onClick={handleTestSubscriptionBilling}
                                disabled={isTestingBilling}
                                className="text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-lg transition-colors shadow-sm disabled:opacity-50"
                            >
                                {isTestingBilling ? 'Testing Billing...' : 'Test Subscription Payment'}
                            </button>
                        </div>
                    ) : (
                        <div className="mt-4 p-4 border border-amber-200 bg-amber-50 rounded-lg text-amber-800 text-sm">
                            No payment method on file. Please add a payment method to ensure uninterrupted service.
                        </div>
                    )
                )}
            </Card>

            {isVwEnabled && (
                <Card className="border border-indigo-100 shadow-sm">
                    <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-lg flex items-center justify-center">
                                <Bot size={24} />
                            </div>
                            <div>
                                <h3 className="font-bold text-lg text-slate-900">Virtual Worker AI limits</h3>
                                <p className="text-sm text-slate-500">Manage your automated assistant usage</p>
                            </div>
                        </div>
                        {!Capacitor.isNativePlatform() && (
                            <button 
                                onClick={handleTopUp}
                                className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded font-medium hover:bg-indigo-700 transition h-fit"
                            >
                                <Plus size={16} /> Power Pack
                            </button>
                        )}
                    </div>
                    
                    <div className="bg-slate-50 border border-slate-100 rounded-lg p-5 mt-4">
                        <div className="flex justify-between items-end mb-2">
                            <div>
                                <p className="text-sm font-medium text-slate-700">Token Usage</p>
                                <p className="text-2xl font-bold text-slate-900">
                                    {vwUsage.used.toLocaleString()} <span className="text-sm font-normal text-slate-500">/ {vwUsage.limit.toLocaleString()}</span>
                                </p>
                            </div>
                            <p className="text-sm font-medium text-indigo-600">
                                {vwUsage.limit > 0 ? Math.min(100, (vwUsage.used / vwUsage.limit) * 100).toFixed(1) : 0}% Used
                            </p>
                        </div>
                        <div className="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden">
                            <div 
                                className={`h-2.5 rounded-full ${(vwUsage.used >= vwUsage.limit) ? 'bg-red-500' : 'bg-indigo-600'}`}
                                ref={(el) => { if(el) el.style.width = `${vwUsage.limit > 0 ? Math.min(100, (vwUsage.used / vwUsage.limit) * 100) : 0}%`; }}
                            ></div>
                        </div>
                        {vwUsage.used >= vwUsage.limit && vwUsage.limit > 0 && (
                            <p className="text-red-500 text-sm mt-3 font-semibold">Limit reached. The Virtual Worker has been temporarily suspended. Purchase a Power Pack to resume.</p>
                        )}
                        <p className="text-xs text-slate-500 mt-4 leading-relaxed">
                            Virtual Worker tasks consume tokens. Standard queries use approximately 100-200 tokens. 
                            If you hit your organization's limit, the virtual worker will pause until you buy a power pack top-up.
                        </p>
                    </div>
                </Card>
            )}
        </div>
    );
};

export default SubscriptionTab;
