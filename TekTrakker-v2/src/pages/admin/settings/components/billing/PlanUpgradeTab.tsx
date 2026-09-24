import React, { useState, useMemo } from 'react';
import Card from 'components/ui/Card';
import { Zap, Check, ArrowRight, ShieldCheck, HelpCircle, Sparkles } from 'lucide-react';
import { db } from 'lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { useAppContext } from 'context/AppContext';
import showToast from 'lib/toast';

interface PlanUpgradeTabProps {
    currentPlan: string;
    orgId: string;
    onPlanUpdated?: () => void;
}

export const PlanUpgradeTab: React.FC<PlanUpgradeTabProps> = ({ currentPlan, orgId }) => {
    const { state, dispatch } = useAppContext();
    const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [selectedPlanForModal, setSelectedPlanForModal] = useState<string | null>(null);

    const ps = state.platformSettings?.plans;

    const plansConfig = useMemo(() => [
        {
            key: 'starter',
            name: 'TekTrakker Starter',
            monthlyPrice: ps?.starter?.monthly ?? 49,
            annualPrice: ps?.starter?.annual ? Math.round(ps.starter.annual / 12) : 39,
            popular: false,
            badge: ps?.starter?.ribbonText || 'Essential',
            users: ps?.starter?.unlimitedUsers ? 'Unlimited User Seats Included' : `${ps?.starter?.maxUsers ?? 1} User Seat${(ps?.starter?.maxUsers ?? 1) > 1 ? 's' : ''} Included`,
            aiTokens: `${((ps?.starter?.aiTokensPerMonth ?? 1000000) / 1000000).toLocaleString()}M AI Processing Tokens`,
            supportResponseTime: ps?.starter?.supportResponseTime || '3-Day Guarantee',
            features: [
                'Full Field Service Management',
                'Job Scheduling & Mobile Dispatching',
                'Customer Portal & Invoicing',
                '2,500 Included Transactional Emails / month',
                'Basic AI Proposals & Pricebook',
                'Single Division/Trade Management',
                'Email Support'
            ]
        },
        {
            key: 'growth',
            name: 'TekTrakker Growth',
            monthlyPrice: ps?.growth?.monthly ?? 149,
            annualPrice: ps?.growth?.annual ? Math.round(ps.growth.annual / 12) : 119,
            popular: true,
            badge: ps?.growth?.ribbonText || 'Most Popular',
            users: ps?.growth?.unlimitedUsers ? 'Unlimited User Seats Included' : `${ps?.growth?.maxUsers ?? 5} User Seats Included`,
            aiTokens: `${((ps?.growth?.aiTokensPerMonth ?? 3000000) / 1000000).toLocaleString()}M AI Processing Tokens`,
            supportResponseTime: ps?.growth?.supportResponseTime || '24-Hour Support SLA',
            features: [
                'Everything in Starter, plus:',
                'Multi-Trade & Subcontractor Hub',
                '10,000 Included Transactional Emails / month',
                'Advanced Financials & Accounting Sync',
                'Interactive Smart Proposal Generator',
                'Automated Customer SMS Notifications',
                'Up to 3 Division Slots',
                'Priority Email & Phone Support'
            ]
        },
        {
            key: 'business',
            name: 'TekTrakker Business',
            monthlyPrice: ps?.business?.monthly ?? 249,
            annualPrice: ps?.business?.annual ? Math.round(ps.business.annual / 12) : 199,
            popular: false,
            badge: ps?.business?.ribbonText || 'Scale Team',
            users: ps?.business?.unlimitedUsers ? 'Unlimited User Seats Included' : `${ps?.business?.maxUsers ?? 20} User Seats Included`,
            aiTokens: `${((ps?.business?.aiTokensPerMonth ?? 8000000) / 1000000).toLocaleString()}M AI Processing Tokens`,
            supportResponseTime: ps?.business?.supportResponseTime || 'Same-Day Priority SLA',
            features: [
                'Everything in Growth, plus:',
                '20 User Seats Included',
                '35,000 Included Transactional Emails / month',
                'Up to 5 Division / Trade Slots',
                'Advanced Multi-Department Workflows',
                'Subcontractor & Vendor Hub',
                'Same-Day Dedicated Support'
            ]
        },
        {
            key: 'enterprise',
            name: 'TekTrakker Enterprise',
            monthlyPrice: ps?.enterprise?.monthly ?? 350,
            annualPrice: ps?.enterprise?.annual ? Math.round(ps.enterprise.annual / 12) : 279,
            popular: false,
            badge: ps?.enterprise?.ribbonText || 'Scale Unlimited',
            users: ps?.enterprise?.unlimitedUsers !== false ? 'Unlimited User Seats Included' : `${ps?.enterprise?.maxUsers ?? 999} User Seats Included`,
            aiTokens: `${((ps?.enterprise?.aiTokensPerMonth ?? 15000000) / 1000000).toLocaleString()}M AI Processing Tokens`,
            supportResponseTime: ps?.enterprise?.supportResponseTime || '1-2 Hour Dedicated Support SLA',
            features: [
                'Everything in Growth, plus:',
                'Unlimited User Seats & Licenses',
                '100,000 Included Transactional Emails / month',
                'Unlimited Division & Franchise Slots',
                'Virtual Worker Add-On Integration Ready',
                'Multi-Franchise & Custom Branding',
                'Dedicated Account Manager & SLA Support',
                'Custom Webhooks & API Integration',
                '24/7 Priority Emergency Support'
            ]
        },
        {
            key: 'payments_only',
            name: 'Payments Only Gateway',
            monthlyPrice: ps?.payments_only?.monthly ?? 10,
            annualPrice: ps?.payments_only?.annual ? Math.round(ps.payments_only.annual / 12) : 8,
            popular: false,
            badge: ps?.payments_only?.ribbonText || 'Standalone',
            users: 'Unlimited User Seats Included',
            aiTokens: '0 AI Tokens',
            supportResponseTime: ps?.payments_only?.supportResponseTime || 'Standard Support',
            features: [
                'TekTrakker Custom Payment Processing',
                'Interactive Invoice Editor & Billing',
                'Credit Card & ACH Processing',
                'Customer Payment Vaulting',
                'Automated Statement Generation'
            ]
        }
    ], [ps]);

    const handleSelectPlan = (planKey: string) => {
        if (planKey === currentPlan) return;
        setSelectedPlanForModal(planKey);
    };

    const confirmPlanChange = async () => {
        if (!selectedPlanForModal || !orgId) return;
        setIsSubmitting(true);
        try {
            await updateDoc(doc(db, 'organizations', orgId), {
                plan: selectedPlanForModal,
                billingCycle: billingCycle,
                updatedAt: new Date().toISOString()
            });

            if (state.currentOrganization) {
                dispatch({
                    type: 'UPDATE_ORGANIZATION',
                    payload: { ...state.currentOrganization, plan: selectedPlanForModal as any }
                });
            }

            showToast.success(`Successfully switched subscription plan to ${selectedPlanForModal.toUpperCase()}!`);
            setSelectedPlanForModal(null);
        } catch (error: any) {
            console.error("Failed to update plan:", error);
            showToast.error("Failed to update plan: " + (error.message || 'Unknown error'));
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="space-y-8">
            {/* Header & Billing Cycle Toggle */}
            <div className="text-center max-w-3xl mx-auto space-y-4">
                <span className="text-xs font-bold uppercase tracking-widest text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 px-3 py-1 rounded-full border border-blue-200 dark:border-blue-800">
                    Flexible Pricing Tiers
                </span>
                <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                    Upgrade Your Organization Subscription
                </h2>
                <p className="text-slate-500 text-sm">
                    Select the plan that best fits your business size and field tech team. Upgrade or downgrade anytime.
                </p>

                {/* Monthly / Annual Switch */}
                <div className="flex items-center justify-center gap-3 pt-2">
                    <span className={`text-sm font-semibold ${billingCycle === 'monthly' ? 'text-slate-900 dark:text-white' : 'text-slate-400'}`}>
                        Monthly Billing
                    </span>
                    <button
                        onClick={() => setBillingCycle(prev => prev === 'monthly' ? 'annual' : 'monthly')}
                        className="relative w-14 h-8 bg-blue-600 rounded-full p-1 transition-colors duration-200 focus:outline-none"
                    >
                        <div 
                            className={`w-6 h-6 bg-white rounded-full shadow-md transform transition-transform duration-200 ${
                                billingCycle === 'annual' ? 'translate-x-6' : 'translate-x-0'
                            }`}
                        />
                    </button>
                    <span className={`text-sm font-semibold flex items-center gap-1.5 ${billingCycle === 'annual' ? 'text-slate-900 dark:text-white' : 'text-slate-400'}`}>
                        Annual Billing 
                        <span className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-300 dark:border-emerald-800">
                            Save 20%
                        </span>
                    </span>
                </div>
            </div>

            {/* Plans Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {plansConfig.map((plan) => {
                    const price = billingCycle === 'annual' ? plan.annualPrice : plan.monthlyPrice;
                    const isCurrent = currentPlan === plan.key;

                    return (
                        <Card 
                            key={plan.key}
                            className={`relative border flex flex-col justify-between p-6 transition-all duration-200 ${
                                plan.popular 
                                    ? 'border-blue-500 ring-2 ring-blue-500/20 shadow-xl bg-gradient-to-b from-blue-50/40 to-transparent dark:from-blue-950/20' 
                                    : 'border-slate-200 dark:border-slate-800 shadow-sm hover:border-slate-300 dark:hover:border-slate-700'
                            }`}
                        >
                            {plan.popular && (
                                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-[10px] font-black uppercase px-3 py-1 rounded-full shadow flex items-center gap-1">
                                    <Sparkles size={12} /> {plan.badge}
                                </div>
                            )}

                            <div>
                                <div className="flex justify-between items-center mb-2">
                                    <h3 className="font-extrabold text-lg text-slate-900 dark:text-white">{plan.name}</h3>
                                    {isCurrent && (
                                        <span className="bg-emerald-500 text-white text-[10px] font-bold px-2 py-0.5 rounded uppercase">
                                            Current
                                        </span>
                                    )}
                                </div>

                                <div className="my-4">
                                    <span className="text-4xl font-black text-slate-900 dark:text-white">${price}</span>
                                    <span className="text-xs font-semibold text-slate-500"> / month</span>
                                    {billingCycle === 'annual' && (
                                        <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium mt-1">
                                            Billed annually (${price * 12}/yr)
                                        </p>
                                    )}
                                </div>

                                <div className="space-y-2 mb-6 text-xs border-t border-slate-100 dark:border-slate-800 pt-4">
                                    <p className="font-bold text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
                                        <ShieldCheck size={14} /> {plan.users}
                                    </p>
                                    <p className="font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5">
                                        <Zap size={14} /> {plan.aiTokens}
                                    </p>
                                </div>

                                <ul className="space-y-2.5 text-xs text-slate-600 dark:text-slate-300 mb-6">
                                    {plan.features.map((feat, idx) => (
                                        <li key={idx} className="flex items-start gap-2">
                                            <Check size={14} className="text-emerald-500 shrink-0 mt-0.5" />
                                            <span>{feat}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            <button
                                onClick={() => handleSelectPlan(plan.key)}
                                disabled={isCurrent}
                                className={`w-full py-2.5 px-4 rounded-xl font-bold text-xs transition flex items-center justify-center gap-1.5 ${
                                    isCurrent
                                        ? 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500 cursor-default'
                                        : plan.popular
                                            ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-md'
                                            : 'bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-800 dark:hover:bg-slate-700'
                                }`}
                            >
                                {isCurrent ? 'Current Active Plan' : 'Select Plan'} <ArrowRight size={14} />
                            </button>
                        </Card>
                    );
                })}
            </div>

            {/* Confirmation Modal */}
            {selectedPlanForModal && (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
                        <div className="flex items-center gap-3 text-blue-600">
                            <div className="p-3 bg-blue-50 dark:bg-blue-950/40 rounded-xl">
                                <Sparkles size={24} />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Confirm Plan Upgrade</h3>
                                <p className="text-xs text-slate-500">Update organization subscription tier</p>
                            </div>
                        </div>

                        <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-700 text-sm space-y-2">
                            <div className="flex justify-between">
                                <span className="text-slate-500">New Plan:</span>
                                <span className="font-bold text-slate-900 dark:text-white capitalize">{selectedPlanForModal}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-500">Billing Cycle:</span>
                                <span className="font-bold text-slate-900 dark:text-white capitalize">{billingCycle}</span>
                            </div>
                        </div>

                        <p className="text-xs text-slate-500 leading-relaxed">
                            Your billing interval will be adjusted immediately. Unused time on your previous plan will be prorated towards your new plan total.
                        </p>

                        <div className="flex justify-end gap-3 pt-2">
                            <button
                                onClick={() => setSelectedPlanForModal(null)}
                                className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-slate-900"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmPlanChange}
                                disabled={isSubmitting}
                                className="px-5 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white rounded-xl shadow-md transition disabled:opacity-50"
                            >
                                {isSubmitting ? 'Processing...' : 'Confirm Upgrade'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
