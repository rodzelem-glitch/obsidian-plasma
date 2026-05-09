"use client";

import React, { useState } from 'react';
import { resourcesData } from '../data/content';
import { LandingHeader } from '../components/LandingHeader';
import { LandingFooter } from '../components/LandingFooter';
import LandingChatbot from '../components/LandingChatbot';
import { Calculator, ArrowRight, TrendingUp } from 'lucide-react';
import Link from 'next/link';

export default function ROICalculatorPage() {
    const data = resourcesData['roi-calculator'];
    const [techCount, setTechCount] = useState(5);
    const [avgTicket, setAvgTicket] = useState(450);
    const [jobsPerDay, setJobsPerDay] = useState(4);

    const currentMonthlyRevenue = techCount * avgTicket * jobsPerDay * 20; // 20 working days
    const projectedEfficiencyGain = currentMonthlyRevenue * 0.15; // 15% efficiency gain
    const projectedUpsellGain = currentMonthlyRevenue * 0.10; // 10% upsell increase via proposals
    const newMonthlyRevenue = currentMonthlyRevenue + projectedEfficiencyGain + projectedUpsellGain;

    return (
        <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
            <LandingHeader backButton={{ label: 'Back to Home', href: '/' }} />
            
            <header className="pt-40 pb-20 px-6 bg-white border-b border-slate-200">
                <div className="max-w-4xl mx-auto text-center">
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-50 border border-emerald-200 mb-8">
                        <Calculator size={16} className="text-emerald-600" />
                        <span className="text-xs font-bold text-emerald-700 uppercase tracking-widest">Growth Tool</span>
                    </div>
                    <h1 className="text-5xl md:text-6xl font-black tracking-tight mb-6">{data.title}</h1>
                    <p className="text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed">{data.description}</p>
                </div>
            </header>

            <section className="py-24 px-6">
                <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16">
                    <div className="bg-white p-10 rounded-3xl border border-slate-200 shadow-xl">
                        <h3 className="text-2xl font-bold mb-8">Input Your Metrics</h3>
                        
                        <div className="space-y-8">
                            <div>
                                <div className="flex justify-between mb-2">
                                    <label htmlFor="techCount" className="font-bold text-slate-700">Number of Field Technicians</label>
                                    <span className="font-bold text-primary-600">{techCount}</span>
                                </div>
                                <input id="techCount" title="Number of Field Technicians" type="range" min="1" max="50" value={techCount} onChange={(e) => setTechCount(parseInt(e.target.value))} className="w-full accent-primary-600" />
                            </div>

                            <div>
                                <div className="flex justify-between mb-2">
                                    <label htmlFor="avgTicket" className="font-bold text-slate-700">Average Ticket Size ($)</label>
                                    <span className="font-bold text-primary-600">${avgTicket}</span>
                                </div>
                                <input id="avgTicket" title="Average Ticket Size" type="range" min="100" max="5000" step="50" value={avgTicket} onChange={(e) => setAvgTicket(parseInt(e.target.value))} className="w-full accent-primary-600" />
                            </div>

                            <div>
                                <div className="flex justify-between mb-2">
                                    <label htmlFor="jobsPerDay" className="font-bold text-slate-700">Jobs Per Tech, Per Day</label>
                                    <span className="font-bold text-primary-600">{jobsPerDay}</span>
                                </div>
                                <input id="jobsPerDay" title="Jobs Per Tech, Per Day" type="range" min="1" max="10" value={jobsPerDay} onChange={(e) => setJobsPerDay(parseInt(e.target.value))} className="w-full accent-primary-600" />
                            </div>
                        </div>
                    </div>

                    <div className="bg-slate-900 rounded-3xl p-10 text-white shadow-2xl relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-emerald-500/20 rounded-full blur-[100px] pointer-events-none" />
                        
                        <div className="relative z-10">
                            <h3 className="text-xl font-bold text-slate-400 mb-2">Projected Monthly Revenue</h3>
                            <div className="text-6xl font-black text-white mb-8">
                                ${newMonthlyRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                            </div>

                            <div className="space-y-4 mb-12">
                                <div className="flex items-center justify-between p-4 bg-slate-800 rounded-xl">
                                    <span className="text-slate-300">Current Monthly Baseline</span>
                                    <span className="font-bold">${currentMonthlyRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                                </div>
                                <div className="flex items-center justify-between p-4 bg-emerald-900/30 border border-emerald-500/30 rounded-xl">
                                    <span className="text-emerald-400 flex items-center gap-2"><TrendingUp size={16} /> Recovered Inefficiency</span>
                                    <span className="font-bold text-emerald-400">+${projectedEfficiencyGain.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                                </div>
                                <div className="flex items-center justify-between p-4 bg-emerald-900/30 border border-emerald-500/30 rounded-xl">
                                    <span className="text-emerald-400 flex items-center gap-2"><TrendingUp size={16} /> Proposal Upsells</span>
                                    <span className="font-bold text-emerald-400">+${projectedUpsellGain.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                                </div>
                            </div>

                            <Link href="https://app.tektrakker.com/#/login?view=register_business" className="flex items-center justify-center h-16 w-full rounded-xl bg-emerald-500 text-slate-900 font-black text-lg hover:bg-emerald-400 transition-all gap-2 shadow-[0_0_20px_rgba(16,185,129,0.3)]">
                                Claim Your Revenue <ArrowRight size={20} />
                            </Link>
                        </div>
                    </div>
                </div>
            </section>

            <section className="py-24 px-6 bg-slate-100">
                <div className="max-w-4xl mx-auto">
                    <h2 className="text-3xl font-black mb-8 text-center text-slate-900">The Math Behind the Growth</h2>
                    <div className="prose prose-lg prose-slate text-slate-600 mx-auto">
                        <p className="leading-relaxed">{data.deepDive}</p>
                    </div>
                </div>
            </section>

            <LandingFooter />
            <LandingChatbot />
        </div>
    );
}
