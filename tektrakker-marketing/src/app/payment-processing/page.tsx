"use client";

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import {
    ArrowRight, Zap, DollarSign, TrendingDown, Shield, CheckCircle2,
    CreditCard, BarChart3, Calculator, ChevronDown, Star, BadgePercent, Minus
} from 'lucide-react';
import { LandingHeader } from '../components/LandingHeader';
import { LandingFooter } from '../components/LandingFooter';

// Competitor rate structures (simplified for comparison)
const COMPETITORS = [
    { name: 'Square', rate: 2.9, perTx: 0.30, monthlyFee: 29, label: 'Square (Online)', color: '#1A1A2E' },
    { name: 'Stripe', rate: 2.9, perTx: 0.30, monthlyFee: 0, label: 'Stripe', color: '#635BFF' },
    { name: 'PayPal', rate: 3.49, perTx: 0.49, monthlyFee: 0, label: 'PayPal', color: '#003087' },
    { name: 'Toast', rate: 2.99, perTx: 0.15, monthlyFee: 0, label: 'Toast (Pay-as-you-go)', color: '#FF6600' },
    { name: 'Authorize.net', rate: 2.9, perTx: 0.30, monthlyFee: 25, label: 'Authorize.net', color: '#1C3A5F' },
];

// Flat-rate model
const TEKTRAKKER = { rate: 2.79, perTx: 0.25, monthlyFee: 0 };

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
        <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-blue-500/30">
            {/* Global Header */}
            <LandingHeader />

            <main className="max-w-6xl mx-auto px-4 pt-32 pb-16 md:pt-36 md:pb-24">

                {/* Hero */}
                <div className="text-center mb-20">
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold uppercase tracking-widest mb-6 border border-emerald-200">
                        <BadgePercent size={14} /> Built-In Payment Processing
                    </div>
                    <h1 className="text-5xl md:text-7xl font-black tracking-tight mb-6 leading-tight text-slate-900">
                        Keep More of <br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-500 via-blue-500 to-cyan-500">
                            Every Dollar You Earn.
                        </span>
                    </h1>
                    <p className="text-xl text-slate-600 max-w-3xl mx-auto mb-4">
                        TekTrakker&apos;s integrated payment processing gives you a simple, transparent flat rate — 
                        no hidden fees, no surprise markups, no monthly minimums.
                    </p>
                    <div className="flex items-center justify-center gap-3 mt-8">
                        <div className="flex flex-col items-center bg-white border border-slate-200 rounded-2xl px-6 py-4 shadow-lg">
                            <div className="flex items-baseline gap-1">
                                <span className="text-4xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-500 to-blue-500">2.79%</span>
                                <span className="text-2xl text-slate-400 font-bold mx-1">+</span>
                                <span className="text-4xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-500 to-cyan-500">$0.25</span>
                            </div>
                            <span className="text-xs text-slate-400 mt-1">Transparent flat-rate pricing</span>
                        </div>
                    </div>
                    <p className="text-sm text-slate-500 mt-3">per transaction • no monthly fees • no contracts</p>
                </div>

                {/* Interactive Calculator Section */}
                <div className="relative mb-20">
                    <div className="absolute inset-0 bg-gradient-to-b from-primary-600/5 via-transparent to-transparent rounded-[2rem] -z-10"></div>
                    
                    <div className="bg-white backdrop-blur-xl border border-slate-200 rounded-[2rem] p-8 md:p-12 shadow-2xl">
                        <div className="flex items-center gap-3 mb-10">
                            <div className="p-3 bg-blue-50 rounded-xl">
                                <Calculator size={24} className="text-blue-600" />
                            </div>
                            <div>
                                <h2 className="text-2xl font-black text-slate-900">Savings Calculator</h2>
                                <p className="text-sm text-slate-500">See exactly how much you&apos;ll save compared to other processors.</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
                            {/* Monthly Revenue Slider */}
                            <div className="space-y-4">
                                <div className="flex justify-between items-baseline">
                                    <label className="text-sm font-bold text-slate-600">Monthly Revenue</label>
                                    <span className="text-3xl font-black text-slate-900">{formatCurrency(monthlyRevenue)}</span>
                                </div>
                                <input
                                    type="range"
                                    min={5000}
                                    max={500000}
                                    step={5000}
                                    value={monthlyRevenue}
                                    onChange={e => setMonthlyRevenue(Number(e.target.value))}
                                    aria-label="Monthly Revenue"
                                    className="w-full h-2 bg-slate-200 rounded-full appearance-none cursor-pointer accent-primary-600
                                    [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full 
                                    [&::-webkit-slider-thumb]:bg-primary-600 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:shadow-[0_0_10px_rgba(37,99,235,0.4)]
                                    [&::-webkit-slider-thumb]:cursor-grab [&::-webkit-slider-thumb]:active:cursor-grabbing"
                                />
                                <div className="flex justify-between text-xs text-slate-400">
                                    <span>$5K</span><span>$250K</span><span>$500K</span>
                                </div>
                            </div>

                            {/* Average Ticket Slider */}
                            <div className="space-y-4">
                                <div className="flex justify-between items-baseline">
                                    <label className="text-sm font-bold text-slate-600">Average Ticket Size</label>
                                    <span className="text-3xl font-black text-slate-900">{formatCurrency(avgTicket)}</span>
                                </div>
                                <input
                                    type="range"
                                    min={50}
                                    max={5000}
                                    step={25}
                                    value={avgTicket}
                                    onChange={e => setAvgTicket(Number(e.target.value))}
                                    aria-label="Average Ticket Size"
                                    className="w-full h-2 bg-slate-200 rounded-full appearance-none cursor-pointer accent-primary-600
                                    [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full 
                                    [&::-webkit-slider-thumb]:bg-primary-600 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:shadow-[0_0_10px_rgba(37,99,235,0.4)]
                                    [&::-webkit-slider-thumb]:cursor-grab [&::-webkit-slider-thumb]:active:cursor-grabbing"
                                />
                                <div className="flex justify-between text-xs text-slate-400">
                                    <span>$50</span><span>$2,500</span><span>$5,000</span>
                                </div>
                            </div>
                        </div>

                        {/* Summary Stats */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-12">
                            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 text-center">
                                <div className="text-sm text-slate-500 mb-1 font-medium">Monthly Transactions</div>
                                <div className="text-3xl font-black text-slate-900">{calculations.transactions.toLocaleString()}</div>
                            </div>
                            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 text-center">
                                <div className="text-sm text-emerald-600 mb-1 font-medium">Your TekTrakker Cost</div>
                                <div className="text-3xl font-black text-emerald-600">{formatCurrencyExact(calculations.tekTrakkerMonthly)}<span className="text-lg text-emerald-500">/mo</span></div>
                            </div>
                            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6 text-center">
                                <div className="text-sm text-blue-600 mb-1 font-medium">Max Annual Savings</div>
                                <div className="text-3xl font-black text-blue-600">
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
                            <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-slate-700">
                                <BarChart3 size={20} className="text-blue-600" /> Processor Comparison
                            </h3>

                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-slate-200 text-left">
                                            <th className="pb-3 font-bold text-slate-500 pr-4">Processor</th>
                                            <th className="pb-3 font-bold text-slate-500 text-right pr-4">Rate</th>
                                            <th className="pb-3 font-bold text-slate-500 text-right pr-4">Monthly Cost</th>
                                            <th className="pb-3 font-bold text-slate-500 text-right pr-4">Annual Cost</th>
                                            <th className="pb-3 font-bold text-slate-500 text-right">Your Savings</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {/* TekTrakker Row */}
                                        <tr className="border-b border-emerald-200 bg-emerald-50">
                                            <td className="py-4 pr-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-emerald-500 flex items-center justify-center shrink-0">
                                                        <Zap size={16} className="text-white" />
                                                    </div>
                                                    <div>
                                                        <span className="font-black text-emerald-700">TekTrakker</span>
                                                        <div className="text-[11px] text-emerald-500">Your rate</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="py-4 text-right pr-4 font-mono font-bold text-emerald-700">2.79% + $0.25</td>
                                            <td className="py-4 text-right pr-4 font-mono font-bold text-emerald-700">{formatCurrencyExact(calculations.tekTrakkerMonthly)}</td>
                                            <td className="py-4 text-right pr-4 font-mono font-bold text-emerald-700">{formatCurrencyExact(calculations.tekTrakkerAnnual)}</td>
                                            <td className="py-4 text-right">
                                                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold">
                                                    <CheckCircle2 size={12} /> Baseline
                                                </span>
                                            </td>
                                        </tr>

                                        {/* Competitors */}
                                        {displayedCompetitors.map(c => (
                                            <tr key={c.name} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                                                <td className="py-4 pr-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-slate-100 border border-slate-200">
                                                            <CreditCard size={14} className="text-slate-400" />
                                                        </div>
                                                        <div>
                                                            <span className="font-bold text-slate-800">{c.name}</span>
                                                            {c.monthlyFee > 0 && <div className="text-[11px] text-slate-400">+${c.monthlyFee}/mo fee</div>}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="py-4 text-right pr-4 font-mono text-slate-500">{c.rate}% + ${c.perTx.toFixed(2)}</td>
                                                <td className="py-4 text-right pr-4 font-mono text-slate-700">{formatCurrencyExact(c.monthly)}</td>
                                                <td className="py-4 text-right pr-4 font-mono text-slate-700">{formatCurrencyExact(c.annual)}</td>
                                                <td className="py-4 text-right">
                                                    {c.savingsAnnual > 0 ? (
                                                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-blue-50 text-blue-600 text-xs font-bold border border-blue-200">
                                                            <TrendingDown size={12} /> {formatCurrency(c.savingsAnnual)}/yr
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-red-50 text-red-600 text-xs font-bold border border-red-200">
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
                                    className="mt-4 mx-auto flex items-center gap-2 text-sm font-bold text-blue-600 hover:text-blue-700 transition-colors"
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
                        <h2 className="text-4xl font-black tracking-tight leading-tight text-slate-900">
                            One Platform.<br />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-500 to-blue-500">Zero Extra Software.</span>
                        </h2>
                        <p className="text-lg text-slate-600 leading-relaxed">
                            Most service businesses juggle Square, QuickBooks, scheduling apps, and manual invoicing. 
                            TekTrakker replaces all of it — scheduling, dispatch, proposals, invoicing, <strong className="text-slate-900">and payments</strong> — 
                            in one unified platform.
                        </p>
                        <div className="space-y-4">
                            {[
                                '2.79% + $0.25 - transparent flat-rate pricing',
                                'Accept cards, ACH, and digital wallets',
                                'Funds deposited in 1-2 business days',
                                'Automatic invoice reconciliation',
                                'PCI-DSS Level 1 compliance built-in',
                                'No monthly minimums, no cancellation fees',
                            ].map((item, i) => (
                                <div key={i} className="flex items-start gap-3">
                                    <CheckCircle2 size={18} className="text-emerald-500 mt-0.5 shrink-0" />
                                    <span className="text-slate-700">{item}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Visual Card */}
                    <div className="relative">
                        <div className="absolute inset-0 bg-gradient-to-br from-blue-600/10 to-emerald-600/10 rounded-[2rem] blur-3xl -z-10"></div>
                        <div className="bg-white border border-slate-200 rounded-[2rem] p-8 space-y-6 shadow-xl">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="p-2 bg-emerald-50 rounded-lg"><DollarSign size={20} className="text-emerald-600" /></div>
                                <h3 className="font-black text-lg text-slate-900">Why Service Businesses Love It</h3>
                            </div>
                            
                            <div className="space-y-4">
                                <div className="bg-slate-50 rounded-xl p-5 border border-slate-200">
                                    <div className="text-sm text-slate-500 mb-2">Average savings per year</div>
                                    <div className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-500 to-blue-500">$2,400+</div>
                                    <div className="text-xs text-slate-400 mt-1">compared to Square on $50K monthly volume</div>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 text-center">
                                        <div className="text-2xl font-black text-slate-900">1-2</div>
                                        <div className="text-xs text-slate-500 mt-1">Day Deposits</div>
                                    </div>
                                    <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 text-center">
                                        <div className="text-2xl font-black text-slate-900">0</div>
                                        <div className="text-xs text-slate-500 mt-1">Hidden Fees</div>
                                    </div>
                                </div>

                                <div className="bg-gradient-to-r from-blue-50 to-slate-50 rounded-xl p-5 border border-blue-200">
                                    <div className="flex gap-1 text-yellow-400 mb-3">
                                        {[1,2,3,4,5].map(s => <Star key={s} fill="currentColor" size={14} />)}
                                    </div>
                                    <p className="text-sm italic text-slate-700 mb-3">
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
                <div className="text-center bg-gradient-to-br from-primary-700 via-primary-800 to-indigo-900 rounded-[2rem] border border-primary-600/50 p-12 md:p-16 shadow-2xl">
                    <h2 className="text-4xl md:text-5xl font-black mb-4 tracking-tight text-white">
                        Ready to Stop Overpaying?
                    </h2>
                    <p className="text-lg text-primary-200 max-w-2xl mx-auto mb-8">
                        Start your 14-day free trial and see the savings for yourself. 
                        Payment processing is included with every TekTrakker plan — no extra signup required.
                    </p>
                    <Link href="https://app.tektrakker.com/#/login?view=register_business" className="inline-flex items-center gap-3 px-10 py-5 bg-white hover:bg-slate-50 text-primary-800 font-black text-xl rounded-2xl shadow-[0_0_40px_rgba(255,255,255,0.15)] transition-all hover:scale-[1.02] active:scale-[0.98]">
                        Start Free Trial <ArrowRight size={24} />
                    </Link>
                    <div className="mt-6">
                        <Link href="/payment-processing-signup" className="inline-flex items-center gap-2 text-sm font-bold text-white/80 hover:text-white border border-white/20 hover:border-white/40 px-6 py-3 rounded-xl transition-all backdrop-blur-sm">
                            <CreditCard size={16} /> Just need payments? Start at $20/mo <ArrowRight size={14} />
                        </Link>
                    </div>
                    <div className="flex items-center justify-center gap-6 mt-6 text-sm text-primary-300">
                        <span className="flex items-center gap-1"><Shield size={14} /> PCI Compliant</span>
                        <span>•</span>
                        <span>Cancel anytime</span>
                    </div>
                </div>

            </main>

            {/* Global Footer */}
            <LandingFooter />
        </div>
    );
}
