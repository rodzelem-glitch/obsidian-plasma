import React from 'react';
import { CheckCircle, ShieldCheck } from 'lucide-react';

interface PlanCardProps {
    id: string;
    name: string;
    price: string | number;
    users: string;
    ribbonText?: string;
    supportResponseTime?: string;
    selectedPlan: string;
    setSelectedPlan: (id: string) => void;
}

export const PlanCard: React.FC<PlanCardProps> = ({ id, name, price, users, ribbonText, supportResponseTime, selectedPlan, setSelectedPlan }) => (
    <button 
      type="button"
      onClick={() => setSelectedPlan(id)}
      className={`w-full text-left relative overflow-hidden p-4 rounded-xl border-2 cursor-pointer transition-all ${selectedPlan === id ? 'border-primary-500 bg-primary-500/10' : 'border-slate-700 bg-slate-800/50 hover:border-slate-500'}`}
    >
        {ribbonText && (
            <div className="absolute top-0 right-0">
                <div className="bg-emerald-500 text-white text-[10px] font-bold uppercase tracking-wider py-1 px-3 rounded-bl-lg shadow-lg">
                    {ribbonText}
                </div>
            </div>
        )}
        <div className="flex justify-between items-center mb-2 pr-20">
            <span className="font-bold text-white text-sm uppercase tracking-widest">{name}</span>
            {selectedPlan === id && <CheckCircle size={16} className="text-primary-500"/>}
        </div>
        <p className="text-2xl font-black text-white">${price}<span className="text-xs font-normal text-slate-400">/mo</span></p>
        <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-700/50">
            <p className="text-[10px] text-slate-400">{users}</p>
            {supportResponseTime && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
                    <ShieldCheck size={11} className="text-indigo-400" />
                    {supportResponseTime}
                </span>
            )}
        </div>
    </button>
);
