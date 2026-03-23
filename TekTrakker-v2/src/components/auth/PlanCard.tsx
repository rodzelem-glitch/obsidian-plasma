import React from 'react';
import { CheckCircle } from 'lucide-react';

export const PlanCard = ({ id, name, price, users, selectedPlan, setSelectedPlan }: any) => (
    <div 
      onClick={() => setSelectedPlan(id)}
      className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${selectedPlan === id ? 'border-blue-500 bg-blue-500/10' : 'border-slate-700 bg-slate-800/50 hover:border-slate-500'}`}
    >
        <div className="flex justify-between items-center mb-2">
            <span className="font-bold text-white text-sm uppercase tracking-widest">{name}</span>
            {selectedPlan === id && <CheckCircle size={16} className="text-blue-500"/>}
        </div>
        <p className="text-2xl font-black text-white">${price}<span className="text-xs font-normal text-slate-400">/mo</span></p>
        <p className="text-[10px] text-slate-400 mt-1">{users} Users Included</p>
    </div>
);
