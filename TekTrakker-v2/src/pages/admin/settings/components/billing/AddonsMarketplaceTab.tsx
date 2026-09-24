import React, { useState } from 'react';
import Card from 'components/ui/Card';
import { Zap, Users, Layers, Bot, Plus, Minus, Check, CreditCard, ShoppingBag, ShieldAlert, PhoneCall } from 'lucide-react';
import { db } from 'lib/firebase';
import { doc, updateDoc, increment } from 'firebase/firestore';
import { useAppContext } from 'context/AppContext';
import showToast from 'lib/toast';
import { globalConfirm } from 'lib/globalConfirm';

interface AddonsMarketplaceTabProps {
    orgId: string;
    hasVaultedMethod: boolean;
    additionalUserSlots: number;
    additionalDivisionsSlots: number;
    virtualWorkerEnabled: boolean;
    aiVoiceAssistantEnabled?: boolean;
    onTopUpSuccess: (tokensAdded: number) => void;
    onNavigateTab?: (tabKey: string) => void;
}

export const AddonsMarketplaceTab: React.FC<AddonsMarketplaceTabProps> = ({
    orgId,
    hasVaultedMethod,
    additionalUserSlots,
    additionalDivisionsSlots,
    virtualWorkerEnabled,
    aiVoiceAssistantEnabled = false,
    onTopUpSuccess,
    onNavigateTab
}) => {
    const { state, dispatch } = useAppContext();

    const powerPackPrice = state.platformSettings?.aiPowerPackPrice ?? 5;
    const powerPackTokens = state.platformSettings?.aiPowerPackTokens ?? 1000000;
    const userFee = state.platformSettings?.excessUserFee ?? 25;
    const divisionFee = state.platformSettings?.divisionFee ?? 79;
    const virtualWorkerFee = state.platformSettings?.virtualWorkerFee ?? 49.99;
    const aiVoiceMonthlyFee = state.platformSettings?.aiVoiceAssistantMonthlyFee ?? 5.00;
    const aiVoicePerMinute = state.platformSettings?.aiVoiceAssistantRatePerMinute ?? 0.07;

    const [isPurchasingPowerPack, setIsPurchasingPowerPack] = useState(false);
    const [userSeatCount, setUserSeatCount] = useState(additionalUserSlots);
    const [divisionCount, setDivisionCount] = useState(additionalDivisionsSlots);
    const [isUpdatingSeats, setIsUpdatingSeats] = useState(false);
    const [isUpdatingDivisions, setIsUpdatingDivisions] = useState(false);
    const [isUpdatingAiVoice, setIsUpdatingAiVoice] = useState(false);

    // AI Power Pack Purchase
    const handleBuyPowerPack = async () => {
        if (!orgId) return;
        if (!hasVaultedMethod) {
            showToast.error("Please add a vaulted payment method first to purchase Power Packs.");
            return;
        }

        if (await globalConfirm(`Charge $${powerPackPrice.toFixed(2)} to your vaulted payment method to purchase ${powerPackTokens.toLocaleString()} AI Power Pack tokens?`, 'Purchase AI Power Pack', 'Confirm Purchase', 'Cancel')) {
            setIsPurchasingPowerPack(true);
            try {
                showToast.warn("Processing transaction via TekTrakker Custom Payments...");
                
                setTimeout(async () => {
                    await updateDoc(doc(db, 'aiUsage', orgId), {
                        virtualWorkerLimitTokens: increment(powerPackTokens),
                        tokenLimit: increment(powerPackTokens)
                    });
                    
                    onTopUpSuccess(powerPackTokens);
                    showToast.success(`Added ${powerPackTokens.toLocaleString()} AI Power Pack tokens!`);
                    setIsPurchasingPowerPack(false);
                }, 1000);
            } catch (error) {
                console.error("Power pack purchase failed:", error);
                showToast.error("Transaction failed.");
                setIsPurchasingPowerPack(false);
            }
        }
    };

    // User Seats update
    const handleSaveUserSeats = async (newSlots: number) => {
        if (!orgId || newSlots < 0) return;
        setIsUpdatingSeats(true);
        try {
            await updateDoc(doc(db, 'organizations', orgId), {
                additionalUserSlots: newSlots,
                updatedAt: new Date().toISOString()
            });

            if (state.currentOrganization) {
                dispatch({
                    type: 'UPDATE_ORGANIZATION',
                    payload: { ...state.currentOrganization, additionalUserSlots: newSlots }
                });
            }

            setUserSeatCount(newSlots);
            showToast.success(`Updated additional user seat slots to ${newSlots}`);
        } catch (error: any) {
            showToast.error("Failed to update user slots: " + error.message);
        } finally {
            setIsUpdatingSeats(false);
        }
    };

    // Division Slots update
    const handleSaveDivisions = async (newSlots: number) => {
        if (!orgId || newSlots < 0) return;
        setIsUpdatingDivisions(true);
        try {
            await updateDoc(doc(db, 'organizations', orgId), {
                additionalDivisionsSlots: newSlots,
                updatedAt: new Date().toISOString()
            });

            if (state.currentOrganization) {
                dispatch({
                    type: 'UPDATE_ORGANIZATION',
                    payload: { ...state.currentOrganization, additionalDivisionsSlots: newSlots }
                });
            }

            setDivisionCount(newSlots);
            showToast.success(`Updated additional division slots to ${newSlots}`);
        } catch (error: any) {
            showToast.error("Failed to update division slots: " + error.message);
        } finally {
            setIsUpdatingDivisions(false);
        }
    };

    // Toggle Virtual Worker
    const handleToggleVirtualWorker = async () => {
        if (!orgId) return;
        const newStatus = !virtualWorkerEnabled;
        try {
            await updateDoc(doc(db, 'organizations', orgId), {
                virtualWorkerEnabled: newStatus,
                updatedAt: new Date().toISOString()
            });

            if (state.currentOrganization) {
                dispatch({
                    type: 'UPDATE_ORGANIZATION',
                    payload: { ...state.currentOrganization, virtualWorkerEnabled: newStatus }
                });
            }

            showToast.success(`Virtual Worker Suite ${newStatus ? 'Activated' : 'Disabled'}`);
        } catch (error: any) {
            showToast.error("Failed to toggle Virtual Worker");
        }
    };

    // Toggle 24/7 AI Voice Receptionist
    const handleToggleAiVoiceAssistant = async () => {
        if (!orgId) return;
        const newStatus = !aiVoiceAssistantEnabled;
        setIsUpdatingAiVoice(true);
        try {
            await updateDoc(doc(db, 'organizations', orgId), {
                aiVoiceAssistantEnabled: newStatus,
                aiVoiceAssistantBillingType: 'monthly',
                updatedAt: new Date().toISOString()
            });

            if (state.currentOrganization) {
                dispatch({
                    type: 'UPDATE_ORGANIZATION',
                    payload: { 
                        ...state.currentOrganization, 
                        aiVoiceAssistantEnabled: newStatus,
                        aiVoiceAssistantBillingType: 'monthly'
                    }
                });
            }

            showToast.success(`24/7 AI Voice Receptionist ${newStatus ? 'Activated' : 'Disabled'}`);
        } catch (error: any) {
            showToast.error("Failed to toggle AI Voice Receptionist: " + error.message);
        } finally {
            setIsUpdatingAiVoice(false);
        }
    };

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                    <ShoppingBag className="text-blue-600" size={24} /> Products, Add-Ons & Capacity Upgrades
                </h2>
                <p className="text-xs text-slate-500">
                    Instantly top up AI tokens, expand user seat quotas, and enable advanced capabilities for your organization.
                </p>
            </div>

            {!hasVaultedMethod && (
                <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-xl text-amber-800 dark:text-amber-300 text-xs flex items-center gap-3">
                    <ShieldAlert size={20} className="shrink-0 text-amber-600" />
                    <div>
                        <p className="font-bold">No Vaulted Payment Method</p>
                        <p>Link a credit card or bank account under the Payment Methods tab to instantly purchase add-ons and top-ups.</p>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Product 1: AI Power Pack */}
                <Card className="border border-indigo-100 dark:border-indigo-950/60 shadow-sm p-6 flex flex-col justify-between space-y-4">
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 rounded-xl flex items-center justify-center">
                                <Zap size={22} />
                            </div>
                            <span className="bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-300 text-[10px] font-bold px-2.5 py-1 rounded-full uppercase border border-indigo-200 dark:border-indigo-800">
                                Instant Top-Up
                            </span>
                        </div>

                        <h3 className="font-bold text-lg text-slate-900 dark:text-white">AI Power Pack ({powerPackTokens.toLocaleString()} Tokens)</h3>
                        <p className="text-xs text-slate-500 mt-1">
                            Instantly add 1,000,000 processing tokens to your AI balance for interactive proposal building, smart dispatching, and automated quote generation.
                        </p>

                        <div className="mt-4">
                            <span className="text-3xl font-black text-slate-900 dark:text-white">${powerPackPrice.toFixed(2)}</span>
                            <span className="text-xs text-slate-500 font-medium"> / pack</span>
                        </div>
                    </div>

                    <button
                        onClick={handleBuyPowerPack}
                        disabled={isPurchasingPowerPack || !hasVaultedMethod}
                        className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold text-xs shadow-md transition disabled:opacity-50 flex items-center justify-center gap-1.5"
                    >
                        <Zap size={14} /> {isPurchasingPowerPack ? 'Processing Payment...' : `Purchase Power Pack ($${powerPackPrice})`}
                    </button>
                </Card>

                {/* Product 2: Extra User Seats (Disabled Ala Carte - Tier Upgrade Required) */}
                <Card className="border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 shadow-sm p-6 flex flex-col justify-between space-y-4">
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <div className="w-10 h-10 bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-xl flex items-center justify-center">
                                <Users size={22} />
                            </div>
                            <span className="bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 text-[10px] font-bold px-2.5 py-1 rounded-full uppercase border border-amber-200 dark:border-amber-800">
                                Tier Upgrade Required
                            </span>
                        </div>

                        <h3 className="font-bold text-lg text-slate-900 dark:text-white">Additional User Seats</h3>
                        <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                            Individual seat add-ons are disabled to enforce tier limits. To add more user licenses for your dispatchers, technicians, or office managers, please upgrade to the next subscription tier.
                        </p>

                        <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-950/40 rounded-xl border border-blue-200 dark:border-blue-800/60">
                            <p className="text-xs text-blue-900 dark:text-blue-200 font-medium space-y-1">
                                <span className="block font-bold">Plan User Quotas:</span>
                                <span className="block">• Starter: 1 User Seat</span>
                                <span className="block">• Growth: 5 User Seats</span>
                                <span className="block">• Business: 15 User Seats</span>
                                <span className="block">• Enterprise: Unlimited Seats</span>
                            </p>
                        </div>
                    </div>

                    <button
                        onClick={() => onNavigateTab?.('plans')}
                        className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-sm transition flex items-center justify-center gap-2"
                    >
                        <span>Upgrade Subscription Tier</span>
                        <Zap size={14} />
                    </button>
                </Card>

                {/* Product 3: Extra Division / Brand Slots */}
                <Card className="border border-emerald-100 dark:border-emerald-950/60 shadow-sm p-6 flex flex-col justify-between space-y-4">
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400 rounded-xl flex items-center justify-center">
                                <Layers size={22} />
                            </div>
                            <span className="bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-300 text-[10px] font-bold px-2.5 py-1 rounded-full uppercase border border-emerald-200 dark:border-emerald-800">
                                Multi-Brand
                            </span>
                        </div>

                        <h3 className="font-bold text-lg text-slate-900 dark:text-white">Additional Division Slots</h3>
                        <p className="text-xs text-slate-500 mt-1">
                            Operate multiple sub-brands, trade divisions (HVAC, Plumbing, Electrical), or regional branches within a single master organization account.
                        </p>

                        <div className="mt-4">
                            <span className="text-3xl font-black text-slate-900 dark:text-white">${divisionFee}</span>
                            <span className="text-xs text-slate-500 font-medium"> / division / month</span>
                        </div>
                    </div>

                    <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Extra Division Slots:</span>
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => handleSaveDivisions(Math.max(0, divisionCount - 1))}
                                disabled={isUpdatingDivisions || divisionCount <= 0}
                                className="w-8 h-8 rounded-lg bg-white dark:bg-slate-700 text-slate-700 dark:text-white border border-slate-200 dark:border-slate-600 flex items-center justify-center font-bold text-sm shadow-sm disabled:opacity-40"
                            >
                                <Minus size={14} />
                            </button>
                            <span className="font-black text-base text-slate-900 dark:text-white w-6 text-center">{divisionCount}</span>
                            <button
                                onClick={() => handleSaveDivisions(divisionCount + 1)}
                                disabled={isUpdatingDivisions}
                                className="w-8 h-8 rounded-lg bg-white dark:bg-slate-700 text-slate-700 dark:text-white border border-slate-200 dark:border-slate-600 flex items-center justify-center font-bold text-sm shadow-sm disabled:opacity-40"
                            >
                                <Plus size={14} />
                            </button>
                        </div>
                    </div>
                </Card>

                {/* Product 4: Virtual Worker Suite */}
                <Card className="border border-purple-100 dark:border-purple-950/60 shadow-sm p-6 flex flex-col justify-between space-y-4">
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-400 rounded-xl flex items-center justify-center">
                                <Bot size={22} />
                            </div>
                            <span className="bg-purple-50 dark:bg-purple-950 text-purple-600 dark:text-purple-300 text-[10px] font-bold px-2.5 py-1 rounded-full uppercase border border-purple-200 dark:border-purple-800">
                                Autonomous AI
                            </span>
                        </div>

                        <h3 className="font-bold text-lg text-slate-900 dark:text-white">Virtual Worker Automation Suite</h3>
                        <p className="text-xs text-slate-500 mt-1">
                            Enable 24/7 background AI dispatching, intelligent lead intake, automatic proposal generation, and email/SMS customer follow-ups.
                        </p>

                        <div className="mt-4 flex items-baseline gap-1">
                            <span className="text-3xl font-black text-slate-900 dark:text-white">${virtualWorkerFee.toFixed(2)}</span>
                            <span className="text-xs text-slate-500 font-medium"> / month</span>
                            {virtualWorkerEnabled && (
                                <span className="ml-2 bg-purple-100 dark:bg-purple-950/80 text-purple-700 dark:text-purple-300 text-xs font-bold px-2 py-0.5 rounded-full border border-purple-200 dark:border-purple-800">
                                    Active
                                </span>
                            )}
                        </div>
                    </div>

                    <button
                        onClick={handleToggleVirtualWorker}
                        className={`w-full py-2.5 px-4 rounded-xl font-bold text-xs shadow-md transition flex items-center justify-center gap-1.5 ${
                            virtualWorkerEnabled 
                                ? 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300 hover:bg-slate-300' 
                                : 'bg-purple-600 hover:bg-purple-500 text-white'
                        }`}
                    >
                        <Bot size={14} /> {virtualWorkerEnabled ? 'Disable Virtual Worker' : 'Enable Virtual Worker Suite ($49.99/mo)'}
                    </button>
                </Card>

                {/* Product 5: 24/7 AI Voice Receptionist */}
                <Card className="border border-sky-100 dark:border-sky-950/60 shadow-sm p-6 flex flex-col justify-between space-y-4">
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <div className="w-10 h-10 bg-sky-100 dark:bg-sky-900/50 text-sky-600 dark:text-sky-400 rounded-xl flex items-center justify-center">
                                <PhoneCall size={22} />
                            </div>
                            <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase border ${
                                aiVoiceAssistantEnabled 
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800' 
                                    : 'bg-sky-50 text-sky-600 border-sky-200 dark:bg-sky-950 dark:text-sky-300 dark:border-sky-800'
                            }`}>
                                {aiVoiceAssistantEnabled ? 'Active' : 'Add-On'}
                            </span>
                        </div>

                        <h3 className="font-bold text-lg text-slate-900 dark:text-white">24/7 AI Voice Receptionist</h3>
                        <p className="text-xs text-slate-500 mt-1">
                            Automate inbound calls, after-hours emergency triage, and direct customer appointment scheduling over the phone with conversational AI telephony.
                        </p>

                        <div className="mt-4 flex items-baseline gap-1">
                            <span className="text-3xl font-black text-slate-900 dark:text-white">${aiVoiceMonthlyFee.toFixed(2)}</span>
                            <span className="text-xs text-slate-500 font-medium"> / month + ${aiVoicePerMinute.toFixed(2)}/min</span>
                            {aiVoiceAssistantEnabled && (
                                <span className="ml-2 bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 text-xs font-bold px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                                    Active
                                </span>
                            )}
                        </div>
                    </div>

                    <button
                        onClick={handleToggleAiVoiceAssistant}
                        disabled={isUpdatingAiVoice}
                        className={`w-full py-2.5 px-4 rounded-xl font-bold text-xs shadow-md transition flex items-center justify-center gap-1.5 ${
                            aiVoiceAssistantEnabled 
                                ? 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300 hover:bg-slate-300' 
                                : 'bg-sky-600 hover:bg-sky-500 text-white'
                        }`}
                    >
                        <PhoneCall size={14} /> {isUpdatingAiVoice ? 'Updating...' : aiVoiceAssistantEnabled ? 'Disable Voice Assistant' : 'Enable AI Voice Assistant ($5/mo)'}
                    </button>
                </Card>
            </div>
        </div>
    );
};
