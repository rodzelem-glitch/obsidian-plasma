"use client";

import React from 'react';
import Link from 'next/link';
import {
    ArrowRight, CreditCard, FileText, Receipt, CheckCircle2,
    Shield, Users, Zap, BadgePercent, DollarSign, Clock
} from 'lucide-react';
import { LandingHeader } from '../components/LandingHeader';
import { LandingFooter } from '../components/LandingFooter';
import type { Metadata } from 'next';

const SIGNUP_URL = 'https://app.tektrakker.com/#/login?view=register_business&plan=payments_only';

const FEATURES = [
    {
        icon: Receipt,
        title: 'Professional Invoicing',
        description: 'Create and send polished, branded invoices in seconds. Track payment status in real time.'
    },
    {
        icon: FileText,
        title: 'Proposals & Estimates',
        description: 'Build detailed proposals with line items, send them to clients, and convert accepted proposals directly to invoices.'
    },
    {
        icon: CreditCard,
        title: 'Accept Any Payment',
        description: 'Credit cards, debit cards, and ACH bank transfers — give your clients the flexibility to pay how they want.'
    },
    {
        icon: BadgePercent,
        title: 'Flat-Rate Pricing',
        description: 'Transparent 2.79% + $0.25 per transaction. No hidden fees, no monthly minimums, no surprises.'
    },
    {
        icon: Users,
        title: 'Unlimited Users',
        description: 'Add your entire team — dispatchers, office staff, and field techs — at no extra cost.'
    },
    {
        icon: Shield,
        title: 'PCI-Compliant & Secure',
        description: 'Bank-grade encryption and PCI DSS Level 1 compliance. Your customers\' data is always protected.'
    }
];

const COMPARISON = [
    { feature: 'Monthly Platform Fee', tektrakker: '$10/mo', competitors: '$0–$99/mo' },
    { feature: 'Processing Rate', tektrakker: '2.79%', competitors: '2.9%–3.5%' },
    { feature: 'Per-Transaction Fee', tektrakker: '$0.25', competitors: '$0.10–$0.49' },
    { feature: 'Invoicing', tektrakker: true, competitors: 'Extra cost' },
    { feature: 'Proposals & Estimates', tektrakker: true, competitors: 'Extra cost' },
    { feature: 'Unlimited Users', tektrakker: true, competitors: 'Per-seat pricing' },
    { feature: 'Monthly Minimum', tektrakker: 'None', competitors: '$25–$100' },
    { feature: 'Long-term Contract', tektrakker: 'None', competitors: '1–3 years' },
];

const STEPS = [
    { step: '1', title: 'Create Your Account', description: 'Sign up in under 2 minutes. No long forms, no paperwork.' },
    { step: '2', title: 'Complete Merchant Setup', description: 'Our guided onboarding verifies your business and gets you approved fast.' },
    { step: '3', title: 'Start Getting Paid', description: 'Send your first invoice and accept payments the same day.' },
];

export default function PaymentProcessingSignup() {
    return (
        <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-emerald-500/30">
            <LandingHeader ctaUrl={SIGNUP_URL} ctaLabel="Get Started — $10/mo" />

            <main>
                {/* Hero Section */}
                <section className="relative pt-32 pb-20 md:pt-40 md:pb-28 overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-950" />
                    <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_30%_50%,rgba(16,185,129,0.3)_0%,transparent_50%),radial-gradient(circle_at_70%_80%,rgba(59,130,246,0.2)_0%,transparent_50%)]" />
                    
                    <div className="relative max-w-5xl mx-auto px-4 text-center">
                        <div className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-bold uppercase tracking-widest mb-8 border border-emerald-500/20 backdrop-blur-sm">
                            <DollarSign size={14} /> Payment Processing Only — $10/month
                        </div>

                        <h1 className="text-5xl md:text-7xl font-black tracking-tight mb-6 leading-[1.1] text-white">
                            Get Paid Faster.<br />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-cyan-400 to-blue-400">
                                Keep More.
                            </span>
                        </h1>

                        <p className="text-xl md:text-2xl text-slate-300 max-w-3xl mx-auto mb-6 leading-relaxed">
                            Professional invoicing, proposals, and payment processing — everything 
                            you need to bill clients and collect money. Nothing you don&apos;t.
                        </p>

                        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-10">
                            <Link 
                                href={SIGNUP_URL}
                                className="group inline-flex items-center gap-3 px-10 py-5 bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-black text-xl rounded-2xl shadow-[0_0_40px_rgba(16,185,129,0.3)] transition-all hover:scale-[1.02] active:scale-[0.98]"
                            >
                                Get Started for $10/mo
                                <ArrowRight size={22} className="transition-transform group-hover:translate-x-1" />
                            </Link>
                        </div>

                        {/* Price Highlight */}
                        <div className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-6">
                            <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl px-8 py-5 text-center">
                                <div className="text-4xl font-black text-white">$10</div>
                                <div className="text-sm text-slate-400">per month, flat</div>
                            </div>
                            <div className="text-2xl text-slate-600 font-bold">+</div>
                            <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl px-8 py-5 text-center">
                                <div className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">2.79%</div>
                                <div className="text-sm text-slate-400">+ $0.25 per transaction</div>
                            </div>
                        </div>
                        <p className="text-xs text-slate-500 mt-4">No contracts. No minimums. Cancel anytime.</p>
                    </div>
                </section>

                {/* What's Included */}
                <section className="py-20 md:py-28 bg-white">
                    <div className="max-w-6xl mx-auto px-4">
                        <div className="text-center mb-16">
                            <h2 className="text-4xl md:text-5xl font-black tracking-tight mb-4 text-slate-900">
                                Everything You Need to Get Paid
                            </h2>
                            <p className="text-lg text-slate-500 max-w-2xl mx-auto">
                                No bloated software, no features you&apos;ll never use. Just the tools that put money in your account.
                            </p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                            {FEATURES.map((feature, i) => (
                                <div 
                                    key={i}
                                    className="group bg-slate-50 border border-slate-200 rounded-2xl p-8 hover:shadow-xl hover:border-emerald-200 transition-all duration-300 hover:-translate-y-1"
                                >
                                    <div className="w-14 h-14 bg-gradient-to-br from-emerald-500 to-cyan-500 rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-emerald-500/20 group-hover:scale-110 transition-transform">
                                        <feature.icon size={24} className="text-white" />
                                    </div>
                                    <h3 className="text-xl font-black mb-3 text-slate-900">{feature.title}</h3>
                                    <p className="text-sm text-slate-500 leading-relaxed">{feature.description}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* How It Works */}
                <section className="py-20 md:py-28 bg-slate-50">
                    <div className="max-w-4xl mx-auto px-4">
                        <div className="text-center mb-16">
                            <h2 className="text-4xl md:text-5xl font-black tracking-tight mb-4 text-slate-900">
                                Up and Running in Minutes
                            </h2>
                            <p className="text-lg text-slate-500">Three steps. That&apos;s it.</p>
                        </div>

                        <div className="space-y-0">
                            {STEPS.map((step, i) => (
                                <div key={i} className="flex gap-6 items-start relative">
                                    <div className="flex flex-col items-center shrink-0">
                                        <div className="w-14 h-14 rounded-full bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center text-white font-black text-xl shadow-lg shadow-emerald-500/20">
                                            {step.step}
                                        </div>
                                        {i < STEPS.length - 1 && (
                                            <div className="w-0.5 h-16 bg-gradient-to-b from-emerald-300 to-transparent mt-2" />
                                        )}
                                    </div>
                                    <div className="pt-3 pb-8">
                                        <h3 className="text-xl font-black text-slate-900 mb-2">{step.title}</h3>
                                        <p className="text-slate-500">{step.description}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* Comparison Table */}
                <section className="py-20 md:py-28 bg-white">
                    <div className="max-w-4xl mx-auto px-4">
                        <div className="text-center mb-16">
                            <h2 className="text-4xl md:text-5xl font-black tracking-tight mb-4 text-slate-900">
                                How We Compare
                            </h2>
                            <p className="text-lg text-slate-500">Transparent pricing vs. the industry status quo.</p>
                        </div>

                        <div className="bg-slate-50 border border-slate-200 rounded-3xl overflow-hidden shadow-lg">
                            <div className="grid grid-cols-3 gap-0 bg-slate-900 text-white font-bold text-sm px-6 py-4">
                                <div>Feature</div>
                                <div className="text-center">TekTrakker</div>
                                <div className="text-center text-slate-400">Typical Competitors</div>
                            </div>
                            {COMPARISON.map((row, i) => (
                                <div key={i} className={`grid grid-cols-3 gap-0 px-6 py-4 text-sm border-t border-slate-200 ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}`}>
                                    <div className="font-bold text-slate-700">{row.feature}</div>
                                    <div className="text-center font-bold text-emerald-600 flex items-center justify-center gap-1">
                                        {row.tektrakker === true ? <CheckCircle2 size={16} className="text-emerald-500" /> : row.tektrakker}
                                    </div>
                                    <div className="text-center text-slate-500">{row.competitors}</div>
                                </div>
                            ))}
                        </div>

                        <div className="text-center mt-8">
                            <Link href="/payment-processing/" className="text-sm font-bold text-blue-600 hover:text-blue-700 transition-colors inline-flex items-center gap-1">
                                See detailed savings calculator <ArrowRight size={14} />
                            </Link>
                        </div>
                    </div>
                </section>

                {/* What This Plan Does NOT Include */}
                <section className="py-16 bg-slate-50 border-y border-slate-200">
                    <div className="max-w-4xl mx-auto px-4">
                        <div className="bg-white rounded-2xl border border-slate-200 p-8 md:p-12">
                            <h3 className="text-2xl font-black text-slate-900 mb-3">Need more than payments?</h3>
                            <p className="text-slate-500 mb-6">
                                This plan is built for businesses that just need invoicing and payment collection. 
                                If you also need scheduling, CRM, AI assistants, HR tools, or inventory management, 
                                check out our full-featured plans.
                            </p>
                            <Link 
                                href="/pricing/" 
                                className="inline-flex items-center gap-2 px-6 py-3 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition-all text-sm"
                            >
                                View All Plans <ArrowRight size={16} />
                            </Link>
                        </div>
                    </div>
                </section>

                {/* Final CTA */}
                <section className="relative py-24 md:py-32 overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-emerald-950 to-slate-900" />
                    <div className="absolute inset-0 opacity-30 bg-[radial-gradient(circle_at_50%_50%,rgba(16,185,129,0.3)_0%,transparent_60%)]" />
                    
                    <div className="relative max-w-3xl mx-auto px-4 text-center">
                        <div className="inline-flex items-center gap-2 text-emerald-400 text-sm font-bold uppercase tracking-widest mb-6">
                            <Clock size={16} /> Set up in under 5 minutes
                        </div>
                        <h2 className="text-4xl md:text-6xl font-black text-white mb-6 tracking-tight leading-tight">
                            Ready to Simplify<br />Your Payments?
                        </h2>
                        <p className="text-lg text-slate-300 mb-10 max-w-xl mx-auto">
                            $10/month. Unlimited users. Professional invoicing and the best processing rates in the industry.
                        </p>
                        <Link 
                            href={SIGNUP_URL}
                            className="group inline-flex items-center gap-3 px-12 py-6 bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-black text-xl rounded-2xl shadow-[0_0_60px_rgba(16,185,129,0.3)] transition-all hover:scale-[1.02] active:scale-[0.98]"
                        >
                            Start Accepting Payments Today
                            <ArrowRight size={22} className="transition-transform group-hover:translate-x-1" />
                        </Link>
                        <p className="text-xs text-slate-500 mt-6">No contracts • No minimums • Cancel anytime</p>
                    </div>
                </section>
            </main>

            <LandingFooter />
        </div>
    );
}
