
import React from 'react';
import Card from 'components/ui/Card';
import { Zap } from 'lucide-react';

interface SubscriptionTabProps {
    billingDetails: {
        planName: string;
        monthlyCost: number;
        maxUsers: number;
        activeUsers: number;
        isExpired: boolean;
        isTrial: boolean;
        isFree: boolean;
    } | null;
    handleModifyBilling: () => void;
}

const SubscriptionTab: React.FC<SubscriptionTabProps> = ({ billingDetails, handleModifyBilling }) => {
    if (!billingDetails) return null;
    return (
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
                    </div>
                    <p className="text-slate-400">
                        {billingDetails.activeUsers} / {billingDetails.maxUsers} Active Users
                    </p>
                </div>
                <div className="text-right">
                    <p className="text-4xl font-black">${billingDetails.monthlyCost.toFixed(2)}<span className="text-sm font-medium text-slate-400">/mo</span></p>
                    <button onClick={handleModifyBilling} className="text-sm text-blue-400 hover:text-white underline mt-2">Manage Billing</button>
                </div>
            </div>
        </Card>
    );
};

export default SubscriptionTab;
