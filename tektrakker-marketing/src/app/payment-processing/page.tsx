"use client";

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import {
    ArrowLeft, ArrowRight, Zap, DollarSign, TrendingDown, Shield, CheckCircle2,
    CreditCard, BarChart3, Calculator, ChevronDown, Star, BadgePercent, Minus
} from 'lucide-react';

// Competitor rate structures (simplified for comparison)
const COMPETITORS = [
    { name: 'Square', rate: 2.6, perTx: 0.10, monthlyFee: 0, label: 'Square', color: '#1A1A2E' },
    { name: 'Stripe', rate: 2.9, perTx: 0.30, monthlyFee: 0, label: 'Stripe', color: '#635BFF' },
    { name: 'PayPal', rate: 3.49, perTx: 0.49, monthlyFee: 0, label: 'PayPal', color: '#003087' },
    { name: 'Clover', rate: 2.3, perTx: 0.10, monthlyFee: 14.95, label: 'Clover', color: '#43B02A' },
    { name: 'Toast', rate: 2.99, perTx: 0.15, monthlyFee: 0, label: 'Toast (Pay-as-you-go)', color: '#FF6600' },
    { name: 'Authorize.net', rate: 2.9, perTx: 0.30, monthlyFee: 25, label: 'Authorize.net', color: '#1C3A5F' },
];

const TEKTRAKKER = { rate: 2.7, perTx: 0.25, monthlyFee: 0 };

function formatCurrency(value: number): string {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);
}

function formatCurrencyExact(value: number): string {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
}

export default function PaymentProcessing() {
    const [monthlyRevenue, setMonthlyRevenue] = useState(50000);
    const [avgTicket, setAvgTicket] = useState(350);
    const [showAllCompetitors, setShowAllCompetitors] = useState(false);

    const calculations = useMemo(() => {
        const transactions = Math.round(monthlyRevenue / avgTicket);
        const tekTrakkerMonthly = (monthlyRevenue * (TEKTRAKKER.rate / 100)) + (transactions * TEKTRAKKER.perTx) + TEKTRAKKER.monthlyFee;
        const tekTrakkerAnnual = tekTrakkerMonthly * 12;

        const competitorResults = COMPETITORS.map(c => {
            const monthly = (monthlyRevenue * (c.rate / 100)) + (transactions * c.perTx) + c.monthlyFee;
            const annual = monthly * 12;
            const savingsMonthly = monthly - tekTrakkerMonthly;
            const savingsAnnual = annual - tekTrakkerAnnual;
            return {
                ...c,
                monthly,
                annual,
                savingsMonthly,
                savingsAnnual,
            };
        });

        // Sort by most savings (biggest first)
        competitorResults.sort((a, b) => b.savingsAnnual - a.savingsAnnual);

        const maxSavings = competitorResults[0];

        return { transactions, tekTrakkerMonthly, tekTrakkerAnnual, competitorResults, maxSavings };
    }, [monthlyRevenue, avgTicket]);

    const displayedCompetitors = showAllCompetitors ? calculations.competitorResults : calculations.competitorResults.slice(0, 3);

    return (
        <div className="min-h-screen bg-[#0a0f1c] text-white font-sans selection:bg-blue-500/30">
            {/* Header */}
            <header className="p-6 border-b border-white/5 bg-black/20 backdrop-blur-md sticky top-0 z-50">
                <div className="max-w-6xl mx-auto flex justify-between items-center">
                    <div className="flex items-center gap-6">
                        <Link href="/" className="font-black text-2xl tracking-tighter text-white flex items-center gap-2">
                            <Zap size={24} className="text-blue-500" /> TekTrakker
                        </Link>
                        <Link href="/" className="flex items-center gap-2 text-sm font-bold text-slate-400 hover:text-white transition-colors">
                            <ArrowLeft size={16} /> Back to Home
                        </Link>
                    </div>
                    <div className="flex items-center gap-4 text-sm font-medium text-slate-400">
                        <Shield size={16} /> PCI Compliant
                    </div>
                </div>
            </header>

            <main className="max-w-6xl mx-auto px-4 py-16 md:py-24">

                {/* Hero */}
                <div className="text-center mb-20">
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-bold uppercase tracking-widest mb-6 border border-emerald-500/20">
                        <BadgePercent size={14} /> Built-In Payment Processing
                    </div>
                    <h1 className="text-5xl md:text-7xl font-black tracking-tight mb-6 leading-tight">
                        Keep More of <br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-blue-400 to-cyan-400">
                            Every Dollar You Earn.
                        </span>
                    </h1>
                    <p className="text-xl text-slate-400 max-w-3xl mx-auto mb-4">
                        TekTrakker&apos;s integrated payment processing gives you a simple, transparent flat rate — 
                        no hidden fees, no surprise markups, no monthly minimums.
                    </p>
                    <div className="flex items-center justify-center gap-3 mt-8">
                        <div className="flex items-baseline gap-1 bg-white/5 border border-white/10 rounded-2xl px-6 py-4">
                            <span className="text-5xl md:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-blue-400">2.7%</span>
                            <span className="text-2xl text-slate-400 font-bold mx-1">+</span>
                            <span className="text-5xl md:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400">$0.25</span>
                        </div>
                    </div>
                    <p className="text-sm text-slate-500 mt-3">per transaction • no monthly fees • no contracts</p>
                </div>

                {/* Interactive Calculator Section */}
                <div className="relative mb-20">
                    <div className="absolute inset-0 bg-gradient-to-b from-blue-600/5 via-transparent to-transparent rounded-[2rem] -z-10"></div>
                    
                    <div className="bg-slate-900/80 backdrop-blur-xl border border-white/10 rounded-[2rem] p-8 md:p-12 shadow-2xl">
                        <div className="flex items-center gap-3 mb-10">
                            <div className="p-3 bg-blue-500/20 rounded-xl">
                                <Calculator size={24} className="text-blue-400" />
                            </div>
                            <div>
                                <h2 className="text-2xl font-black">Savings Calculator</h2>
                                <p className="text-sm text-slate-400">See exactly how much you&apos;ll save compared to other processors.</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
                            {/* Monthly Revenue Slider */}
                            <div className="space-y-4">
                                <div className="flex justify-between items-baseline">
                                    <label className="text-sm font-bold text-slate-300">Monthly Revenue</label>
                                    <span className="text-3xl font-black text-white">{formatCurrency(monthlyRevenue)}</span>
                                </div>
                                <input
                                    type="range"
                                    min={5000}
                                    max={500000}
                                    step={5000}
                                    value={monthlyRevenue}
                                    onChange={e => setMonthlyRevenue(Number(e.target.value))}
                                    className="w-full h-2 bg-slate-700 rounded-full appearance-none cursor-pointer accent-blue-500
                                    [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full 
                                    [&::-webkit-slider-thumb]:bg-blue-500 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:shadow-[0_0_10px_rgba(59,130,246,0.5)]
                                    [&::-webkit-slider-thumb]:cursor-grab [&::-webkit-slider-thumb]:active:cursor-grabbing"
                                />
                                <div className="flex justify-between text-xs text-slate-500">
                                    <span>$5K</span><span>$250K</span><span>$500K</span>
                                </div>
                            </div>

                            {/* Average Ticket Slider */}
                            <div className="space-y-4">
                                <div className="flex justify-between items-baseline">
                                    <label className="text-sm font-bold text-slate-300">Average Ticket Size</label>
                                    <span className="text-3xl font-black text-white">{formatCurrency(avgTicket)}</span>
                                </div>
                                <input
                                    type="range"
                                    min={50}
                                    max={5000}
                                    step={25}
                                    value={avgTicket}
                                    onChange={e => setAvgTicket(Number(e.target.value))}
                                    className="w-full h-2 bg-slate-700 rounded-full appearance-none cursor-pointer accent-blue-500
                                    [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full 
                                    [&::-webkit-slider-thumb]:bg-blue-500 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:shadow-[0_0_10px_rgba(59,130,246,0.5)]
                                    [&::-webkit-slider-thumb]:cursor-grab [&::-webkit-slider-thumb]:active:cursor-grabbing"
                                />
                                <div className="flex justify-between text-xs text-slate-500">
                                    <span>$50</span><span>$2,500</span><span>$5,000</span>
                                </div>
                            </div>
                        </div>

                        {/* Summary Stats */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-12">
                            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 text-center">
                                <div className="text-sm text-slate-400 mb-1 font-medium">Monthly Transactions</div>
                                <div className="text-3xl font-black text-white">{calculations.transactions.toLocaleString()}</div>
                            </div>
                            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-6 text-center">
                                <div className="text-sm text-emerald-400 mb-1 font-medium">Your TekTrakker Cost</div>
                                <div className="text-3xl font-black text-emerald-400">{formatCurrencyExact(calculations.tekTrakkerMonthly)}<span className="text-lg text-emerald-600">/mo</span></div>
                            </div>
                            <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-6 text-center">
                                <div className="text-sm text-blue-400 mb-1 font-medium">Max Annual Savings</div>
                                <div className="text-3xl font-black text-blue-400">
                                    {calculations.maxSavings.savingsAnnual > 0 
                                        ? `${formatCurrency(calculations.maxSavings.savingsAnnual)}`
                                        : 'Already lowest!'
                                    }
                                </div>
                                {calculations.maxSavings.savingsAnnual > 0 && (
                                    <div className="text-xs text-blue-500 mt-1">vs. {calculations.maxSavings.name}</div>
                                )}
                            </div>
                        </div>

                        {/* Competitor Comparison Table */}
                        <div>
                            <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-slate-200">
                                <BarChart3 size={20} className="text-blue-500" /> Processor Comparison
                            </h3>

                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-white/10 text-left">
                                            <th className="pb-3 font-bold text-slate-400 pr-4">Processor</th>
                                            <th className="pb-3 font-bold text-slate-400 text-right pr-4">Rate</th>
                                            <th className="pb-3 font-bold text-slate-400 text-right pr-4">Monthly Cost</th>
                                            <th className="pb-3 font-bold text-slate-400 text-right pr-4">Annual Cost</th>
                                            <th className="pb-3 font-bold text-slate-400 text-right">Your Savings</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {/* TekTrakker Row */}
                                        <tr className="border-b border-emerald-500/20 bg-emerald-500/5">
                                            <td className="py-4 pr-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-emerald-500 flex items-center justify-center shrink-0">
                                                        <Zap size={16} className="text-white" />
                                                    </div>
                                                    <div>
                                                        <span className="font-black text-emerald-400">TekTrakker</span>
                                                        <div className="text-[11px] text-emerald-600">Your rate</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="py-4 text-right pr-4 font-mono font-bold text-emerald-400">2.7% + $0.25</td>
                                            <td className="py-4 text-right pr-4 font-mono font-bold text-emerald-400">{formatCurrencyExact(calculations.tekTrakkerMonthly)}</td>
                                            <td className="py-4 text-right pr-4 font-mono font-bold text-emerald-400">{formatCurrencyExact(calculations.tekTrakkerAnnual)}</td>
                                            <td className="py-4 text-right">
                                                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-bold">
                                                    <CheckCircle2 size={12} /> Baseline
                                                </span>
                                            </td>
                                        </tr>

                                        {/* Competitors */}
                                        {displayedCompetitors.map(c => (
                                            <tr key={c.name} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                                                <td className="py-4 pr-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-slate-800 border border-slate-700">
                                                            <CreditCard size={14} className="text-slate-400" />
                                                        </div>
                                                        <div>
                                                            <span className="font-bold text-slate-200">{c.name}</span>
                                                            {c.monthlyFee > 0 && <div className="text-[11px] text-slate-500">+${c.monthlyFee}/mo fee</div>}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="py-4 text-right pr-4 font-mono text-slate-400">{c.rate}% + ${c.perTx.toFixed(2)}</td>
                                                <td className="py-4 text-right pr-4 font-mono text-slate-300">{formatCurrencyExact(c.monthly)}</td>
                                                <td className="py-4 text-right pr-4 font-mono text-slate-300">{formatCurrencyExact(c.annual)}</td>
                                                <td className="py-4 text-right">
                                                    {c.savingsAnnual > 0 ? (
                                                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-blue-500/10 text-blue-400 text-xs font-bold">
                                                            <TrendingDown size={12} /> {formatCurrency(c.savingsAnnual)}/yr
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-red-500/10 text-red-400 text-xs font-bold">
                                                            <Minus size={12} /> {formatCurrency(Math.abs(c.savingsAnnual))}/yr more
                                                        </span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {!showAllCompetitors && calculations.competitorResults.length > 3 && (
                                <button
                                    onClick={() => setShowAllCompetitors(true)}
                                    className="mt-4 mx-auto flex items-center gap-2 text-sm font-bold text-blue-400 hover:text-blue-300 transition-colors"
                                >
                                    Show All {calculations.competitorResults.length} Processors <ChevronDown size={16} />
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* Value Proposition Section */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 mb-20 items-center">
                    <div className="space-y-6">
                        <h2 className="text-4xl font-black tracking-tight leading-tight">
                            One Platform.<br />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-blue-400">Zero Extra Software.</span>
                        </h2>
                        <p className="text-lg text-slate-400 leading-relaxed">
                            Most service businesses juggle Square, QuickBooks, scheduling apps, and manual invoicing. 
                            TekTrakker replaces all of it — scheduling, dispatch, proposals, invoicing, <strong className="text-white">and payments</strong> — 
                            in one unified platform.
                        </p>
                        <div className="space-y-4">
                            {[
                                'Flat 2.7% + $0.25 — no hidden interchange markups',
                                'Accept cards, ACH, and digital wallets',
                                'Funds deposited in 1-2 business days',
                                'Automatic invoice reconciliation',
                                'PCI-DSS Level 1 compliance built-in',
                                'No monthly minimums, no cancellation fees',
                            ].map((item, i) => (
                                <div key={i} className="flex items-start gap-3">
                                    <CheckCircle2 size={18} className="text-emerald-400 mt-0.5 shrink-0" />
                                    <span className="text-slate-300">{item}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Visual Card */}
                    <div className="relative">
                        <div className="absolute inset-0 bg-gradient-to-br from-blue-600/20 to-emerald-600/20 rounded-[2rem] blur-3xl -z-10"></div>
                        <div className="bg-slate-900/80 border border-white/10 rounded-[2rem] p-8 space-y-6">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="p-2 bg-emerald-500/20 rounded-lg"><DollarSign size={20} className="text-emerald-400" /></div>
                                <h3 className="font-black text-lg">Why Service Businesses Love It</h3>
                            </div>
                            
                            <div className="space-y-4">
                                <div className="bg-white/5 rounded-xl p-5 border border-white/5">
                                    <div className="text-sm text-slate-400 mb-2">Average savings per year</div>
                                    <div className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-blue-400">$2,400+</div>
                                    <div className="text-xs text-slate-500 mt-1">compared to Square on $50K monthly volume</div>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div className="bg-white/5 rounded-xl p-4 border border-white/5 text-center">
                                        <div className="text-2xl font-black text-white">1-2</div>
                                        <div className="text-xs text-slate-400 mt-1">Day Deposits</div>
                                    </div>
                                    <div className="bg-white/5 rounded-xl p-4 border border-white/5 text-center">
                                        <div className="text-2xl font-black text-white">0</div>
                                        <div className="text-xs text-slate-400 mt-1">Hidden Fees</div>
                                    </div>
                                </div>

                                <div className="bg-gradient-to-r from-blue-900/30 to-slate-900 rounded-xl p-5 border border-blue-500/20">
                                    <div className="flex gap-1 text-yellow-400 mb-3">
                                        {[1,2,3,4,5].map(s => <Star key={s} fill="currentColor" size={14} />)}
                                    </div>
                                    <p className="text-sm italic text-slate-300 mb-3">
                                        &quot;Switching from Square saved us over $300 a month. The best part? 
                                        I don&apos;t need a separate app for payments anymore — it&apos;s all inside TekTrakker.&quot;
                                    </p>
                                    <div className="text-xs text-slate-500 font-bold">— Mike R., Owner, Reliable Plumbing Co.</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* CTA Section */}
                <div className="text-center bg-gradient-to-br from-blue-900/30 via-slate-900 to-emerald-900/20 rounded-[2rem] border border-white/10 p-12 md:p-16">
                    <h2 className="text-4xl md:text-5xl font-black mb-4 tracking-tight">
                        Ready to Stop Overpaying?
                    </h2>
                    <p className="text-lg text-slate-400 max-w-2xl mx-auto mb-8">
                        Start your 14-day free trial and see the savings for yourself. 
                        Payment processing is included with every TekTrakker plan — no extra signup required.
                    </p>
                    <Link href="https://app.tektrakker.com/#/login?view=register_business" className="inline-flex items-center gap-3 px-10 py-5 bg-gradient-to-r from-blue-600 to-emerald-600 hover:from-blue-500 hover:to-emerald-500 text-white font-black text-xl rounded-2xl shadow-[0_0_40px_rgba(37,99,235,0.3)] transition-all hover:scale-[1.02] active:scale-[0.98]">
                        Start Free Trial <ArrowRight size={24} />
                    </Link>
                    <div className="flex items-center justify-center gap-6 mt-6 text-sm text-slate-500">
                        <span className="flex items-center gap-1"><Shield size={14} /> PCI Compliant</span>
                        <span>•</span>
                        <span>No credit card required</span>
                        <span>•</span>
                        <span>Cancel anytime</span>
                    </div>
                </div>

            </main>

            {/* Footer */}
            <footer className="border-t border-white/5 mt-16 py-8 text-center text-sm text-slate-500">
                © {new Date().getFullYear()} TekTrakker. All rights reserved.
            </footer>
        </div>
    );
}
