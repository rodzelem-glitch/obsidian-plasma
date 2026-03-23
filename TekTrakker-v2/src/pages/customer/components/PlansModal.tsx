
import React, { useState } from 'react';
import Modal from 'components/ui/Modal';
import Button from 'components/ui/Button';
import { Tag, CheckCircle, Minus, Plus, AlertCircle } from 'lucide-react';
import { PayPalScriptProvider, PayPalButtons } from "@paypal/react-paypal-js";
import type { MembershipPlan, Organization } from 'types';

interface PlansModalProps {
    isOpen: boolean;
    onClose: () => void;
    plans: MembershipPlan[];
    organization: Organization | null;
    onApprove: (data: any, plan: MembershipPlan, systemCount: number) => Promise<void>;
}

const PlansModal: React.FC<PlansModalProps> = ({ isOpen, onClose, plans, organization, onApprove }) => {
    const [selectedPlan, setSelectedPlan] = useState<MembershipPlan | null>(null);
    const [systemCount, setSystemCount] = useState(1);

    const sortedPlans = [...plans].sort((a, b) => a.monthlyPrice - b.monthlyPrice);

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="VIP Membership Plans" size="lg">
            <div className="space-y-6">
                {sortedPlans.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 px-4 text-center bg-slate-50 dark:bg-slate-800 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700">
                        <AlertCircle size={48} className="text-slate-300 mb-4" />
                        <h4 className="text-lg font-bold text-slate-600 dark:text-slate-300 mb-2">No Plans Available</h4>
                        <p className="text-slate-500 text-sm max-w-md">
                            This provider is not yet offering online membership enrollment. Please contact their office directly for service agreement options.
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-4">
                        {sortedPlans.map(plan => (
                            <div 
                                key={plan.id} 
                                onClick={() => { setSelectedPlan(plan); setSystemCount(1); }} 
                                className={`p-6 rounded-[2rem] border-4 cursor-pointer transition-all ${
                                    selectedPlan?.id === plan.id 
                                        ? 'border-primary-600 bg-primary-50 dark:bg-primary-900/10' 
                                        : 'border-slate-100 dark:border-slate-800 hover:border-slate-200'
                                }`}
                            >
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <h4 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">{plan.name}</h4>
                                        <div className="flex gap-2 mt-2">
                                            <span className="bg-emerald-100 text-emerald-700 text-[10px] font-black px-2 py-0.5 rounded-full">
                                                {plan.visitsPerYear} VISITS / YR
                                            </span>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-3xl font-black text-primary-600">${plan.monthlyPrice}</p>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase">per month</p>
                                    </div>
                                </div>

                                {plan.benefits && plan.benefits.length > 0 ? (
                                    <ul className="mb-4 space-y-2">
                                        <li className="text-sm text-slate-700 dark:text-slate-200 flex items-center gap-2 font-bold bg-green-50 dark:bg-green-900/20 px-3 py-2 rounded-xl">
                                            <Tag size={16} className="text-emerald-500 shrink-0" />
                                            {plan.discountPercentage}% OFF {plan.discountScope === 'Both' ? 'Parts & Labor' : plan.discountScope}
                                        </li>
                                        {plan.benefits.map((benefit, i) => (
                                            <li key={i} className="text-sm text-slate-600 dark:text-slate-300 flex items-center gap-2 px-1">
                                                <CheckCircle size={16} className="text-emerald-500 shrink-0" /> {benefit}
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <div className="mb-4 p-4 bg-slate-50 dark:bg-slate-800 rounded-xl text-xs text-slate-500 italic text-center">
                                        Contact office for full plan benefits details.
                                    </div>
                                )}

                                {selectedPlan?.id === plan.id && (
                                    <div className="pt-4 border-t border-primary-200 dark:border-primary-800 animate-fade-in space-y-4">
                                        <div className="p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                                            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Number of Systems</label>
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    <button 
                                                        onClick={(e) => { e.stopPropagation(); setSystemCount(Math.max(1, systemCount - 1)); }} 
                                                        className="p-2 rounded-lg bg-gray-100 dark:bg-slate-700 border hover:bg-slate-200"
                                                    >
                                                        <Minus size={16} />
                                                    </button>
                                                    <span className="text-xl font-black">{systemCount}</span>
                                                    <button 
                                                        onClick={(e) => { e.stopPropagation(); setSystemCount(systemCount + 1); }} 
                                                        className="p-2 rounded-lg bg-gray-100 dark:bg-slate-700 border hover:bg-slate-200"
                                                    >
                                                        <Plus size={16} />
                                                    </button>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-xs text-slate-400">Total Monthly</p>
                                                    <p className="text-xl font-black text-primary-600">
                                                        ${(plan.monthlyPrice + ((systemCount - 1) * (plan.pricePerAdditionalSystem || 0))).toFixed(2)}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>

                                        {organization?.paypalClientId ? (
                                            <PayPalScriptProvider options={{ clientId: organization.paypalClientId, intent: "subscription", vault: true }}>
                                                <PayPalButtons 
                                                    style={{ layout: "vertical", shape: "pill", color: "blue", label: "subscribe" }} 
                                                    createSubscription={(_data, actions) => actions.subscription.create({ 
                                                        plan_id: plan.paypalPlanId || '', 
                                                        quantity: systemCount.toString() 
                                                    })} 
                                                    onApprove={(data) => onApprove(data, plan, systemCount)} 
                                                />
                                            </PayPalScriptProvider>
                                        ) : (
                                            <div className="p-4 bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200 text-xs font-bold text-center rounded-xl border border-amber-100 dark:border-amber-800">
                                                Online enrollment currently disabled for this provider.
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </Modal>
    );
};

export default PlansModal;
