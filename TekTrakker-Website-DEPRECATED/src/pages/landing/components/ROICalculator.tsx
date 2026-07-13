
import React, { useState } from 'react';
import { DollarSign } from 'lucide-react';

const ROICalculator = () => {
    const [techs, setTechs] = useState(5);
    const [jobsPerDay, setJobsPerDay] = useState(3);
    const [avgTicket, setAvgTicket] = useState(350);

    const weeklyExtraJobs = techs * 1; 
    const monthlyExtraRevenueJobs = weeklyExtraJobs * avgTicket * 4;
    
    const monthlyUpsellRevenue = (techs * jobsPerDay * 20) * (avgTicket * 0.15);
    const totalMonthlyGain = monthlyExtraRevenueJobs + monthlyUpsellRevenue;

    return (
        <div className="bg-slate-900 rounded-3xl p-4 md:p-8 border border-white/10 shadow-2xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-32 bg-primary-600/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:bg-primary-600/30 transition-all duration-700"></div>
            <h3 className="text-2xl font-black text-white mb-2 flex items-center gap-2 relative z-10">
                <DollarSign className="text-emerald-400" /> Your Potential Growth
            </h3>
            <p className="text-slate-400 text-sm mb-6 relative z-10">See how much money you're leaving on the table.</p>
            
            <div className="space-y-6 mb-8 relative z-10">
                <div>
                    <label className="flex justify-between text-sm font-bold text-slate-400 mb-2">
                        <span>Technicians on the road</span>
                        <span className="text-white">{techs}</span>
                    </label>
                    <input type="range" min="1" max="50" value={techs} onChange={e => setTechs(Number(e.target.value))} className="w-full accent-primary-500 h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer"/>
                </div>
                <div>
                    <label className="flex justify-between text-sm font-bold text-slate-400 mb-2">
                        <span>Avg Jobs / Day</span>
                        <span className="text-white">{jobsPerDay}</span>
                    </label>
                    <input type="range" min="1" max="8" value={jobsPerDay} onChange={e => setJobsPerDay(Number(e.target.value))} className="w-full accent-primary-500 h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer"/>
                </div>
                <div>
                    <label className="flex justify-between text-sm font-bold text-slate-400 mb-2">
                        <span>Avg Ticket Size ($)</span>
                        <span className="text-white">${avgTicket}</span>
                    </label>
                    <input type="range" min="100" max="2000" step="50" value={avgTicket} onChange={e => setAvgTicket(Number(e.target.value))} className="w-full accent-primary-500 h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer"/>
                </div>
            </div>

            <div className="bg-gradient-to-br from-emerald-600 to-emerald-800 rounded-2xl p-6 text-center relative z-10 shadow-lg transform hover:scale-[1.02] transition-transform">
                <p className="text-emerald-100 text-sm font-bold uppercase tracking-widest mb-1">Recovered Monthly Revenue</p>
                <p className="text-4xl md:text-5xl font-black text-white tracking-tight">
                    +${totalMonthlyGain.toLocaleString(undefined, {maximumFractionDigits: 0})}
                </p>
                <p className="text-xs text-emerald-200 mt-2 opacity-80">
                    *Don't let inefficiency steal this from you.
                </p>
            </div>
        </div>
    );
};

export default ROICalculator;
