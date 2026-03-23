
import React from 'react';
import Card from 'components/ui/Card';
import Button from 'components/ui/Button';
import { ShieldCheck, Clock, DollarSign } from '@constants';
import type { ServiceAgreement } from 'types';

interface MembershipSectionProps {
    membership: ServiceAgreement | null;
    endDate?: string;
    estimatedSavings: number;
    onViewPlans: () => void;
}

const MembershipSection: React.FC<MembershipSectionProps> = ({ membership, endDate, estimatedSavings, onViewPlans }) => {
    if (membership) {
        return (
            <div className="relative overflow-hidden rounded-[2.5rem] bg-slate-900 shadow-2xl">
                <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-primary-600/20 to-transparent opacity-50"></div>
                <div className="relative z-10 p-4 md:p-8 md:p-12">
                    <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-10">
                        <div className="space-y-4">
                            <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary-500/10 text-primary-400 rounded-full border border-primary-500/20">
                                <ShieldCheck size={16} /> <span className="text-xs font-black uppercase tracking-widest">{membership.planName} MEMBER</span>
                            </div>
                            <h2 className="text-4xl md:text-5xl font-black text-white tracking-tighter">Your Membership is <span className="text-emerald-400">Active</span></h2>
                            <div className="flex flex-wrap gap-6 text-slate-400 text-sm font-medium">
                                <div className="flex items-center gap-2"><Clock size={16} /> Renew Date: {new Date(membership.endDate).toLocaleDateString()}</div>
                                <div className="flex items-center gap-2"><DollarSign size={16} /> Estimated Savings: <span className="text-emerald-400 font-bold">${estimatedSavings}</span></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <Card className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-[2.5rem] p-4 md:p-10 text-white shadow-2xl relative overflow-hidden border-none">
            <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-8 text-center md:text-left">
                <div>
                    <h2 className="text-3xl font-black tracking-tight mb-2">Join the Preferred Customer Club</h2>
                    <p className="text-slate-400 max-w-md">Unlock priority scheduling, free maintenance visits, and exclusive discounts on all repairs.</p>
                </div>
                <Button className="w-auto px-12 h-14 text-lg font-black bg-primary-600 hover:bg-primary-700 shadow-xl" onClick={onViewPlans}>View Membership Plans</Button>
            </div>
        </Card>
    );
};

export default MembershipSection;
