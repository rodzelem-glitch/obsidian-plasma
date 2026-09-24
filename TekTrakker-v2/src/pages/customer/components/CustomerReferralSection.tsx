import React, { useState } from 'react';
import Card from 'components/ui/Card';
import Button from 'components/ui/Button';
import showToast from 'lib/toast';
import { 
    Sparkles, ArrowRight, Share2, Copy, Check, Send, 
    DollarSign, TrendingUp, Building2, ShieldCheck 
} from 'lucide-react';
import type { CustomerReferral } from 'types';

interface CustomerReferralSectionProps {
    referrals: CustomerReferral[];
    currentUser: any;
    onOpenTracker: () => void;
    onOpenInvite: () => void;
}

const HIGHLIGHT_TRADES = [
    'HVAC & Refrigeration',
    'Electrical & Solar',
    'Plumbing & Piping',
    'Roofing & Sheet Metal',
    'General Contracting',
    'Facility Management',
    'Landscaping',
    'Appliance Repair',
    'Commercial Cleaning',
    'Pest Control'
];

const CustomerReferralSection: React.FC<CustomerReferralSectionProps> = ({
    referrals,
    currentUser,
    onOpenTracker,
    onOpenInvite
}) => {
    const [copied, setCopied] = useState(false);

    const referralCode = React.useMemo(() => {
        const uid = currentUser?.uid || currentUser?.id || 'USER';
        const namePart = (currentUser?.firstName || currentUser?.email?.split('@')[0] || 'TEK').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
        const uidPart = uid.slice(0, 4).toUpperCase();
        return `${namePart}-${uidPart}`;
    }, [currentUser]);

    const referralLink = React.useMemo(() => {
        const uid = currentUser?.uid || currentUser?.id || '';
        return `https://app.tektrakker.com/#/signup?ref=${encodeURIComponent(referralCode)}&referrer=${encodeURIComponent(uid)}`;
    }, [referralCode, currentUser]);

    const activeConversions = referrals.filter(r => r.status === 'Active Customer');
    const estimatedMonthly = activeConversions.reduce((acc, curr) => acc + (curr.estimatedMonthlyCommission || 59.80), 0);

    const handleCopy = (e: React.MouseEvent) => {
        e.stopPropagation();
        navigator.clipboard.writeText(referralLink);
        setCopied(true);
        showToast.success('Referral link copied to clipboard!');
        setTimeout(() => setCopied(false), 3000);
    };

    return (
        <section className="mt-8 mb-4">
            <Card className="relative overflow-hidden border-2 border-indigo-200 dark:border-indigo-900/60 bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-950 text-white p-6 sm:p-8 rounded-[2rem] shadow-xl">
                {/* Decorative background glow */}
                <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none"></div>
                <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>

                <div className="relative z-10 space-y-6">
                    {/* Top Row: Pill Tag & Active Earnings Stat */}
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-xs font-black uppercase tracking-wider">
                            <Sparkles size={14} className="text-emerald-400" />
                            TekTrakker Business Partner Affiliate Program
                        </div>

                        {activeConversions.length > 0 && (
                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/30 border border-indigo-400/40 text-indigo-200 text-xs font-black">
                                <DollarSign size={13} className="text-emerald-400" />
                                Active Monthly Commission: <span className="text-emerald-400">${estimatedMonthly.toFixed(2)}/mo</span>
                            </div>
                        )}
                    </div>

                    {/* Headline & Body Copy */}
                    <div className="space-y-2 max-w-3xl">
                        <h3 className="text-xl sm:text-2xl font-black tracking-tight text-white">
                            Know a business that could streamline operations with TekTrakker?
                        </h3>
                        <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
                            Earn <strong className="text-emerald-400 font-black">up to 20% commission</strong> on subscription fees for every business or vendor you refer. Whether it’s a contractor, facility manager, or specialty trade provider, you get paid automatically for the first year of their active subscription.
                        </p>
                    </div>

                    {/* Supported Trade Badges */}
                    <div className="space-y-2">
                        <p className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                            <ShieldCheck size={14} className="text-indigo-400" /> We power operations across:
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                            {HIGHLIGHT_TRADES.map((trade) => (
                                <span 
                                    key={trade}
                                    className="px-2.5 py-1 rounded-full bg-slate-800/80 border border-indigo-800/40 text-[11px] font-bold text-indigo-200"
                                >
                                    {trade}
                                </span>
                            ))}
                            <span className="px-2.5 py-1 rounded-full bg-indigo-900/60 border border-indigo-700/60 text-[11px] font-bold text-indigo-300">
                                + Many More
                            </span>
                        </div>
                    </div>

                    {/* Action Row */}
                    <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 border-t border-indigo-900/60">
                        {/* Referral Link Box */}
                        <div className="flex items-center gap-2 bg-slate-900/90 border border-indigo-800/60 rounded-xl px-3 py-2 text-xs flex-1 max-w-md">
                            <span className="text-slate-400 font-bold uppercase text-[10px] shrink-0">Your Link:</span>
                            <span className="font-mono text-slate-200 truncate font-semibold">{referralLink}</span>
                            <button
                                onClick={handleCopy}
                                className="ml-auto p-1.5 hover:bg-indigo-900/60 rounded-lg text-indigo-300 hover:text-white transition-colors shrink-0 flex items-center gap-1 font-bold text-[11px]"
                                title="Copy Referral Link"
                            >
                                {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                                <span>{copied ? 'Copied' : 'Copy'}</span>
                            </button>
                        </div>

                        {/* CTA Buttons */}
                        <div className="flex gap-2.5 shrink-0 flex-wrap sm:flex-nowrap">
                            <button
                                onClick={onOpenTracker}
                                className="flex-1 sm:flex-initial text-xs font-black bg-white hover:bg-slate-100 text-slate-900 px-4 py-2.5 rounded-xl shadow-lg border border-slate-200 flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95"
                            >
                                <TrendingUp size={15} className="text-indigo-600" /> 
                                <span>View Earnings & Tracker ({referrals.length})</span>
                            </button>
                            <button
                                onClick={onOpenInvite}
                                className="flex-1 sm:flex-initial text-xs font-black bg-emerald-400 hover:bg-emerald-300 text-slate-950 px-4 py-2.5 rounded-xl shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95"
                            >
                                <Send size={15} /> 
                                <span>Send Referral Invite</span>
                            </button>
                        </div>
                    </div>
                </div>
            </Card>
        </section>
    );
};

export default CustomerReferralSection;
