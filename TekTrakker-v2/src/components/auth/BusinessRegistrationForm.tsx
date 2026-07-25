
import React, { useMemo } from 'react';
import { Capacitor } from '@capacitor/core';
import { CreditCard, Tag, Check, Loader2 } from 'lucide-react';
import { InputField } from './AuthFields';
import { PlanCard } from './PlanCard';
import type { PlatformSettings } from 'types';

interface BusinessRegistrationFormProps {
    bizRegStep: 1 | 2;
    setBizRegStep: (step: 1 | 2) => void;
    businessName: string;
    setBusinessName: (val: string) => void;
    ownerName: string;
    setOwnerName: (val: string) => void;
    businessPhone: string;
    setBusinessPhone: (val: string) => void;
    email: string;
    setEmail: (val: string) => void;
    password: string;
    setPassword: (val: string) => void;
    promoCode: string;
    setPromoCode: (val: string) => void;
    selectedPlan: string;
    setSelectedPlan: (plan: 'starter' | 'growth' | 'enterprise' | 'payments_only') => void;
    platformSettings: PlatformSettings | null;
    consentGiven: boolean;
    setConsentGiven: (val: boolean) => void;
    termsAccepted: boolean;
    setTermsAccepted: (val: boolean) => void;
    ccName: string;
    setCcName: (val: string) => void;
    ccNumber: string;
    setCcNumber: (val: string) => void;
    ccExp: string;
    setCcExp: (val: string) => void;
    ccCvc: string;
    setCcCvc: (val: string) => void;
    handleNextStepBusiness: (e: React.FormEvent) => void;
    handleRegisterBusiness: (e: React.FormEvent) => void;
    isLoading: boolean;
    brandColor: string;
    setView: (view: 'login' | 'register_business' | 'register_user' | 'forgot_password') => void;
    handleVerifyPromo: () => void;
    isValidPromo: boolean;
}

export const BusinessRegistrationForm: React.FC<BusinessRegistrationFormProps> = ({
    bizRegStep, setBizRegStep, businessName, setBusinessName, ownerName, setOwnerName,
    businessPhone, setBusinessPhone, email, setEmail, password, setPassword,
    promoCode, setPromoCode,
    selectedPlan, setSelectedPlan, platformSettings, consentGiven, setConsentGiven,
    termsAccepted, setTermsAccepted,
    ccName, setCcName, ccNumber, setCcNumber, ccExp, setCcExp, ccCvc, setCcCvc,
    handleNextStepBusiness, handleRegisterBusiness, isLoading, brandColor, setView,
    handleVerifyPromo, isValidPromo
}) => {
    const isPaymentsOnly = selectedPlan === 'payments_only';

    const planPrices = useMemo(() => {
        const cfg = platformSettings;
        return {
            starter: cfg?.plans?.starter?.monthly || 49,
            growth: cfg?.plans?.growth?.monthly || 149,
            enterprise: cfg?.plans?.enterprise?.monthly || 299,
            payments_only: cfg?.plans?.payments_only?.monthly || 10,
            starterUsers: cfg?.plans?.starter?.unlimitedUsers ? 'Unlimited' : `Up to ${cfg?.plans?.starter?.maxUsers || 5}`,
            growthUsers: cfg?.plans?.growth?.unlimitedUsers ? 'Unlimited' : `Up to ${cfg?.plans?.growth?.maxUsers || 15}`,
            enterpriseUsers: cfg?.plans?.enterprise?.unlimitedUsers ? 'Unlimited' : `Up to ${cfg?.plans?.enterprise?.maxUsers || 15}`,
            paymentsOnlyUsers: 'Unlimited',
            starterRibbon: cfg?.plans?.starter?.ribbonText || '',
            growthRibbon: cfg?.plans?.growth?.ribbonText || '',
            enterpriseRibbon: cfg?.plans?.enterprise?.ribbonText || '',
            userFee: cfg?.excessUserFee || 25
        };
    }, [platformSettings]);

    const isIOS = Capacitor.getPlatform() === 'ios';

    return (
        <form onSubmit={bizRegStep === 1 ? handleNextStepBusiness : handleRegisterBusiness} className="space-y-6">
            {bizRegStep === 1 ? (
                <>
                    <div className="space-y-4">
                        <InputField id="biz-name" name="businessName" label="Business Name" value={businessName} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setBusinessName(e.target.value)} required brandColor={brandColor} />
                        <InputField id="owner-name" name="ownerName" label="Owner Full Name" value={ownerName} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setOwnerName(e.target.value)} required brandColor={brandColor} />
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <InputField id="biz-phone" name="businessPhone" type="tel" label="Phone" value={businessPhone} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setBusinessPhone(e.target.value)} required brandColor={brandColor} />
                            <InputField id="email" name="email" type="email" label="Email" value={email} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)} required brandColor={brandColor} />
                        </div>
                        <InputField id="password" name="password" type="password" label="Create Password" value={password} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)} required autoComplete="new-password" brandColor={brandColor} />
                        
                        <div className="pt-2">
                             <div className="flex gap-2">
                                <div className="relative flex-1">
                                    <Tag className={`absolute left-3 top-1/2 -translate-y-1/2 ${isValidPromo ? 'text-emerald-500' : 'text-slate-500'}`} size={16} />
                                    <input 
                                        type="text" 
                                        placeholder="Promo Code (Optional)" 
                                        value={promoCode} 
                                        onChange={(e) => setPromoCode(e.target.value)}
                                        disabled={isValidPromo}
                                        className={`w-full pl-10 pr-4 py-3 bg-slate-800/50 border rounded-xl text-sm text-white placeholder:text-slate-600 focus:ring-1 transition-all ${isValidPromo ? 'border-emerald-500/50 ring-emerald-500' : 'border-slate-700 focus:border-blue-500 focus:ring-blue-500'}`}
                                    />
                                    {isValidPromo && <Check className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-500" size={16} />}
                                </div>
                                {!isValidPromo && promoCode && (
                                    <button 
                                        type="button" 
                                        onClick={handleVerifyPromo}
                                        disabled={isLoading}
                                        className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs font-bold text-white hover:bg-slate-700 transition-all flex items-center gap-2"
                                    >
                                        {isLoading ? <Loader2 size={14} className="animate-spin" /> : 'Apply'}
                                    </button>
                                )}
                             </div>
                        </div>
                    </div>

                    <div>
                        <p className="block text-xs font-semibold text-slate-300 mb-3 uppercase tracking-wider">Select Plan</p>
                        <div className="space-y-3">
                            {isPaymentsOnly ? (
                                <>
                                    <PlanCard id="payments_only" name="Payment Processing" price={planPrices.payments_only} users={`${planPrices.paymentsOnlyUsers} Users`} ribbonText="" selectedPlan={selectedPlan} setSelectedPlan={setSelectedPlan} />
                                    <p className="text-center text-xs text-slate-500">Includes manual Proposals, Invoicing, and Payment Processing.</p>
                                    <button type="button" onClick={() => setSelectedPlan('starter')} className="w-full text-xs text-blue-400 hover:text-blue-300 py-2 transition-colors">
                                        Need more features? View all plans →
                                    </button>
                                </>
                            ) : (
                                <>
                                    <PlanCard id="starter" name="TekTrakker Pro" price={planPrices.starter} users={`${planPrices.starterUsers} Users Included`} ribbonText={planPrices.starterRibbon} selectedPlan={selectedPlan} setSelectedPlan={setSelectedPlan} />
                                    <PlanCard id="growth" name="TekTrakker Premium" price={planPrices.growth} users={`${planPrices.growthUsers} Users Included`} ribbonText={planPrices.growthRibbon} selectedPlan={selectedPlan} setSelectedPlan={setSelectedPlan} />
                                    <PlanCard id="enterprise" name="TekTrakker Unlimited" price={planPrices.enterprise} users={`${planPrices.enterpriseUsers} Users Included`} ribbonText={planPrices.enterpriseRibbon} selectedPlan={selectedPlan} setSelectedPlan={setSelectedPlan} />
                                </>
                            )}
                        </div>
                    </div>

                    <div className="space-y-3">
                        <div className="flex items-start gap-3 p-3 bg-slate-800/50 rounded-lg border border-slate-700">
                            <input 
                                type="checkbox" 
                                id="biz-terms-agree" 
                                checked={termsAccepted} 
                                onChange={e => setTermsAccepted(e.target.checked)} 
                                className="mt-1 rounded bg-slate-700 border-slate-600 text-blue-500 focus:ring-blue-500" 
                                required
                            />
                            <label htmlFor="biz-terms-agree" className="text-xs text-slate-400">
                                I agree to the <a href="/#/terms" target="_blank" className="text-blue-400 hover:underline">SaaS Agreement</a> (including telephony & AI usage charges) and <a href="/#/privacy" target="_blank" className="text-blue-400 hover:underline">Privacy Policy</a>.
                            </label>
                        </div>
                        
                        <div className="flex items-start gap-3 p-3 bg-slate-800/50 rounded-lg border border-slate-700">
                            <input 
                                type="checkbox" 
                                id="biz-consent" 
                                checked={consentGiven} 
                                onChange={e => setConsentGiven(e.target.checked)} 
                                className="mt-1 rounded bg-slate-700 border-slate-600 text-blue-500 focus:ring-blue-500" 
                            />
                            <label htmlFor="biz-consent" className="text-xs text-slate-400 leading-relaxed">
                                I consent to receive automated text messages (SMS) from TekTrakker at the phone number provided, including business communications, account updates, and system notifications. Message frequency varies. Msg & data rates may apply. Reply STOP to cancel at any time. View our <a href="/#/privacy" target="_blank" className="text-blue-400 hover:underline">Privacy Policy</a>.
                            </label>
                        </div>
                    </div>

                    <button type="submit" className={`w-full py-4 rounded-xl font-bold text-white shadow-lg transition-all ${isValidPromo ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-500/20' : 'bg-blue-600 hover:bg-blue-500 shadow-blue-500/20'}`}>
                        {isValidPromo ? 'Register (Free Access)' : (isIOS ? 'Next: Add Subscription' : 'Register & Start Free Trial')}
                    </button>
                </>
            ) : (
                <>
                    <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700 text-center mb-6">
                        <p className="text-xs text-slate-400 uppercase tracking-widest mb-1">Selected Plan</p>
                        <p className="text-2xl font-black text-white">{selectedPlan === 'starter' ? 'TekTrakker Pro' : selectedPlan === 'growth' ? 'TekTrakker Premium' : selectedPlan === 'payments_only' ? 'Payment Processing' : 'TekTrakker Unlimited'}</p>
                        <p className="text-sm text-blue-400 font-bold">${planPrices[selectedPlan as keyof typeof planPrices]} / month</p>
                        <p className="text-xs text-slate-500 mt-2">{isIOS ? '1 Month Auto-Renewing Subscription' : isPaymentsOnly ? 'Billed Monthly • Cancel Anytime' : '14 Day Free Trial • Cancel Anytime'}</p>
                        {isIOS && (
                            <div className="mt-4 text-[10px] text-slate-400 text-left leading-relaxed space-y-2 border-t border-slate-700/50 pt-4">
                                <p>Payment will be charged to your Apple ID account at the confirmation of purchase. Subscription automatically renews unless it is canceled at least 24 hours before the end of the current period. Your account will be charged for renewal within 24 hours prior to the end of the current period.</p>
                                <p>You can manage and cancel your subscriptions by going to your account settings on the App Store after purchase.</p>
                                <div className="flex justify-center gap-4 pt-2">
                                    <a href="/#/eula" target="_blank" rel="noreferrer" className="text-blue-400 hover:text-white underline">Terms of Use (EULA)</a>
                                    <a href="/#/privacy" target="_blank" rel="noreferrer" className="text-blue-400 hover:text-white underline">Privacy Policy</a>
                                </div>
                            </div>
                        )}
                    </div>

                    {!isIOS && <div className="space-y-4">
                        <div className="p-3 bg-blue-900/20 border border-blue-500/30 rounded-lg flex items-start gap-3">
                            <CreditCard className="text-blue-400 mt-1" size={20} />
                            <div>
                                <p className="text-xs font-bold text-blue-300">Secure Payment Method</p>
                                <p className="text-[10px] text-slate-400 mt-1">{isPaymentsOnly ? 'Your card will be charged $10 today to activate your account.' : 'Your card will not be charged until your 14-day trial ends. We verify validity with a $0 authorization.'}</p>
                            </div>
                        </div>
                        
                        <InputField id="cc-name" name="ccName" label="Name on Card" value={ccName} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCcName(e.target.value)} required brandColor={brandColor} />
                        <InputField id="cc-number" name="ccNumber" label="Card Number" value={ccNumber} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCcNumber(e.target.value)} placeholder="0000 0000 0000 0000" required brandColor={brandColor} />
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <InputField id="cc-exp" name="ccExp" label="Expiry (MM/YY)" value={ccExp} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCcExp(e.target.value)} placeholder="MM/YY" required brandColor={brandColor} />
                            <InputField id="cc-cvc" name="ccCvc" label="CVC" value={ccCvc} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCcCvc(e.target.value)} placeholder="123" required brandColor={brandColor} />
                        </div>
                    </div>}

                    <div className="flex gap-4 pt-4">
                        <button type="button" onClick={() => setBizRegStep(1)} className="flex-1 py-4 rounded-xl font-bold text-slate-400 border border-slate-700 hover:bg-slate-800 transition-all">
                            Back
                        </button>
                        <button type="submit" disabled={isLoading} className="flex-[2] py-4 rounded-xl font-bold text-white bg-emerald-600 hover:bg-emerald-50 shadow-lg shadow-emerald-500/20 transition-all">
                            {isLoading ? 'Processing...' : (isIOS ? 'Subscribe & Finish Registration' : isPaymentsOnly ? 'Subscribe & Start' : 'Start Free Trial')}
                        </button>
                    </div>
                </>
            )}
            <button type="button" onClick={() => setView('login')} className="w-full text-xs text-slate-500 hover:text-white mt-4">Cancel Registration</button>
        </form>
    );
}
