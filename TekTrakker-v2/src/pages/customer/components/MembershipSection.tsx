
import React, { useMemo } from 'react';
import Card from 'components/ui/Card';
import Button from 'components/ui/Button';
import { ShieldCheck, Clock, DollarSign, Repeat, Zap, TrendingUp, Gift, Star, Calendar, CheckCircle2 } from 'lucide-react';
import type { ServiceAgreement, Job } from 'types';

interface MembershipSectionProps {
    membership: ServiceAgreement | null;
    endDate?: string;
    estimatedSavings: number;
    onViewPlans: () => void;
    onCancelPlan?: () => void;
    completedJobs?: Job[]; // To calculate actual value delivered
    monthlyPrice?: number;
}

const StatCard: React.FC<{ icon: React.ReactNode; label: string; value: React.ReactNode; accent?: string }> = ({ icon, label, value, accent = 'text-white' }) => (
    <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 flex flex-col gap-2">
        <div className="text-white/60">{icon}</div>
        <p className="text-white/60 text-[10px] uppercase font-black tracking-widest">{label}</p>
        <p className={`text-2xl font-black ${accent}`}>{value}</p>
    </div>
);

const MembershipSection: React.FC<MembershipSectionProps> = ({ membership, endDate, estimatedSavings, onViewPlans, onCancelPlan, completedJobs = [], monthlyPrice }) => {
    const planStats = useMemo(() => {
        if (!membership) return null;

        const startDate = new Date(membership.startDate || Date.now());
        const renewDate = new Date(membership.endDate);
        const now = new Date();
        const monthsActive = Math.max(0, (now.getFullYear() - startDate.getFullYear()) * 12 + (now.getMonth() - startDate.getMonth()));
        const pricePerMonth = monthlyPrice || membership.price || 0;
        const totalPaid = monthsActive * pricePerMonth;
        const visitsUsed = (membership.visitsTotal || 0) - (membership.visitsRemaining || 0);
        const valuePerVisit = 185; // Average service call value
        const valueDelivered = visitsUsed * valuePerVisit;
        const discountSavings = completedJobs.reduce((sum, j) => sum + ((j.invoice?.totalAmount || j.invoice?.amount || 0) * 0.15), 0);
        const totalValue = valueDelivered + discountSavings;
        const roi = totalPaid > 0 ? ((totalValue - totalPaid) / totalPaid) * 100 : 0;

        // Future projection (remaining months in plan)
        const monthsRemaining = Math.max(0, (renewDate.getFullYear() - now.getFullYear()) * 12 + (renewDate.getMonth() - now.getMonth()));
        const projectedFutureValue = (membership.visitsRemaining || 0) * valuePerVisit;
        const planDiscount = (membership as any).discountPercentage || 15;
        
        return { monthsActive, totalPaid, visitsUsed, valueDelivered, discountSavings, totalValue, roi, monthsRemaining, projectedFutureValue, planDiscount };
    }, [membership, completedJobs, monthlyPrice]);

    if (membership && planStats) {
        const visitsBar = membership.visitsTotal > 0 ? Math.round((membership.visitsRemaining / membership.visitsTotal) * 100) : 0;

        return (
            <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-slate-900 via-primary-950 to-slate-900 shadow-2xl">
                {/* Decorative blobs */}
                <div className="absolute top-0 right-0 w-80 h-80 bg-primary-600/20 rounded-full -translate-y-1/2 translate-x-1/3 blur-3xl pointer-events-none"></div>
                <div className="absolute bottom-0 left-0 w-60 h-60 bg-indigo-600/10 rounded-full translate-y-1/2 -translate-x-1/4 blur-3xl pointer-events-none"></div>

                <div className="relative z-10 p-6 md:p-10 space-y-8">
                    {/* Header */}
                    <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                        <div>
                            <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500/10 text-emerald-400 rounded-full border border-emerald-500/20 mb-3">
                                <ShieldCheck size={14} />
                                <span className="text-xs font-black uppercase tracking-widest">{membership.planName} Member</span>
                                <span className="ml-1 px-1.5 py-0.5 bg-emerald-500 text-white rounded-md text-[9px] font-black">ACTIVE</span>
                            </div>
                            <h2 className="text-3xl md:text-4xl font-black text-white tracking-tighter">Your Membership<br/><span className="text-emerald-400">Dashboard</span></h2>
                        </div>
                        <div className="text-right text-white/50 text-xs">
                            <p className="font-bold">Renews</p>
                            <p className="font-black text-white text-sm">{new Date(membership.endDate).toLocaleDateString()}</p>
                            <p className="mt-1 text-[10px]">{planStats.monthsRemaining} months remaining</p>
                            {onCancelPlan && (
                                <button onClick={onCancelPlan} className="mt-2 text-[10px] text-red-500 hover:text-red-400 font-bold tracking-widest uppercase transition-colors">
                                    Cancel Subscription
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <StatCard icon={<Calendar size={18}/>} label="Visits Remaining" value={<>{membership.visitsRemaining} <span className="text-sm font-medium text-white/50">/ {membership.visitsTotal}</span></>} accent="text-white" />
                        <StatCard icon={<Gift size={18}/>} label="Member Discount" value={`${planStats.planDiscount}%`} accent="text-emerald-400" />
                        <StatCard icon={<DollarSign size={18}/>} label="Value Delivered" value={`$${planStats.totalValue.toFixed(0)}`} accent="text-emerald-400" />
                        <StatCard icon={<TrendingUp size={18}/>} label="Your Savings" value={`$${Math.max(0, planStats.totalValue - planStats.totalPaid).toFixed(0)}`} accent="text-yellow-400" />
                    </div>

                    {/* Visits Progress Bar */}
                    <div className="bg-white/5 rounded-2xl p-5">
                        <div className="flex justify-between items-center mb-3">
                            <p className="text-white/70 text-xs font-black uppercase tracking-widest">Annual Visit Usage</p>
                            <p className="text-white text-sm font-black">{planStats.visitsUsed} of {membership.visitsTotal} used</p>
                        </div>
                        <div className="h-3 bg-white/10 rounded-full overflow-hidden">
                            <div 
                                className="h-full bg-gradient-to-r from-primary-400 to-emerald-400 rounded-full transition-all duration-700"
                                style={{ width: `${100 - visitsBar}%` }}
                            />
                        </div>
                        <p className="text-white/40 text-[10px] mt-2">{membership.visitsRemaining} visits available • Est. future value: <span className="text-emerald-400 font-bold">${planStats.projectedFutureValue}</span></p>
                    </div>

                    {/* Value Breakdown */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className="bg-white/5 rounded-2xl p-4 flex items-center gap-3">
                            <Repeat size={20} className="text-primary-400 shrink-0" />
                            <div>
                                <p className="text-white/50 text-[10px] uppercase font-black">Monthly Investment</p>
                                <p className="text-white font-black">${planStats.totalPaid.toFixed(0)} <span className="text-white/40 text-xs font-medium">paid to date</span></p>
                            </div>
                        </div>
                        <div className="bg-white/5 rounded-2xl p-4 flex items-center gap-3">
                            <Zap size={20} className="text-yellow-400 shrink-0" />
                            <div>
                                <p className="text-white/50 text-[10px] uppercase font-black">Discount Savings</p>
                                <p className="text-emerald-400 font-black">${planStats.discountSavings.toFixed(0)} <span className="text-white/40 text-xs font-medium">on repairs</span></p>
                            </div>
                        </div>
                        <div className="bg-white/5 rounded-2xl p-4 flex items-center gap-3">
                            <Star size={20} className="text-yellow-400 shrink-0" />
                            <div>
                                <p className="text-white/50 text-[10px] uppercase font-black">Plan ROI</p>
                                <p className={`font-black ${planStats.roi >= 0 ? 'text-emerald-400' : 'text-white'}`}>{planStats.roi >= 0 ? '+' : ''}{planStats.roi.toFixed(0)}%</p>
                            </div>
                        </div>
                    </div>

                    {/* Benefits Checklist */}
                    <div className="border-t border-white/10 pt-6">
                        <p className="text-white/50 text-[10px] uppercase font-black tracking-widest mb-3">Included Benefits</p>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                            {[
                                'Priority Scheduling',
                                `${planStats.planDiscount}% Repair Discounts`,
                                `${membership.visitsTotal} Annual Tune-Ups`,
                                'Free System Diagnostics',
                                'Parts Warranty Coverage',
                                '24/7 Emergency Line',
                            ].map(benefit => (
                                <div key={benefit} className="flex items-center gap-2 text-white/70 text-xs">
                                    <CheckCircle2 size={12} className="text-emerald-400 shrink-0" />
                                    {benefit}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <Card className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-[2.5rem] p-4 md:p-10 text-white shadow-2xl relative overflow-hidden border-none">
            <div className="absolute top-0 right-0 w-64 h-64 bg-primary-600/20 rounded-full -translate-y-1/3 translate-x-1/4 blur-2xl pointer-events-none"></div>
            <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-8 text-center md:text-left">
                <div>
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-primary-500/20 text-primary-300 rounded-full text-xs font-black mb-3 border border-primary-500/30">
                        <ShieldCheck size={12} /> Membership Plans Available
                    </div>
                    <h2 className="text-3xl font-black tracking-tight mb-2">Join the Preferred Customer Club</h2>
                    <p className="text-slate-400 max-w-md">Unlock priority scheduling, free maintenance visits, and exclusive discounts on all repairs.</p>
                    <div className="flex flex-wrap gap-3 mt-4 justify-center md:justify-start">
                        {['Priority Booking', '15% Off Repairs', 'Free Tune-Ups', '24/7 Emergency'].map(b => (
                            <span key={b} className="flex items-center gap-1 text-xs text-slate-300 bg-white/5 px-3 py-1 rounded-full border border-white/10">
                                <CheckCircle2 size={10} className="text-emerald-400" /> {b}
                            </span>
                        ))}
                    </div>
                </div>
                <Button className="w-auto px-12 h-14 text-lg font-black bg-primary-600 hover:bg-primary-700 shadow-xl shrink-0" onClick={onViewPlans}>View Membership Plans</Button>
            </div>
        </Card>
    );
};

export default MembershipSection;
