"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { 
    ArrowRight, CheckCircle2, Shield, Zap, Lock, 
    Check, X, Bot, Building2, User, Users 
} from 'lucide-react';
import { LandingHeader } from '../components/LandingHeader';
import { LandingFooter } from '../components/LandingFooter';

export default function Pricing() {
    const [isAnnual, setIsAnnual] = useState(false);

    const plans = [
        {
            name: "Starter Plan",
            desc: "Perfect for solo operators and independent tradespeople.",
            priceMonthly: 49,
            priceAnnual: 550,
            maxUsers: "1 User Included",
            features: [
                "Single User Account",
                "Basic CRM & Client Profiles",
                "Mobile App (Offline Sync)",
                "Estimates & Invoicing",
                "Online Booking Widget",
                "Standard Email Support",
                "1,000,000 AI Tokens / Month"
            ],
            cta: "Start 14-Day Free Trial",
            ctaLink: "https://app.tektrakker.com/#/login?view=register_business&plan=starter",
            popular: false
        },
        {
            name: "Growth Plan",
            desc: "Designed for expanding service teams and active dispatcher routing.",
            priceMonthly: 149,
            priceAnnual: 1500,
            maxUsers: "Up to 5 Users Included",
            features: [
                "Up to 5 User Accounts",
                "Advanced Drag-and-Drop Dispatch",
                "Geofenced Time & Mileage Tracking",
                "Good, Better, Best Proposal Engine",
                "QuickBooks Online Integration",
                "24/7 Priority Support",
                "1,500,000 AI Tokens / Month"
            ],
            cta: "Start 14-Day Free Trial",
            ctaLink: "https://app.tektrakker.com/#/login?view=register_business&plan=growth",
            popular: true
        },
        {
            name: "Enterprise Plan",
            desc: "Unlimited power for large fleets and multi-location operations.",
            priceMonthly: 350,
            priceAnnual: 3500,
            maxUsers: "Unlimited Users Included",
            features: [
                "Unlimited User Accounts",
                "Full Custom Branding",
                "API Access & Webhooks",
                "Collaborative Operations Board",
                "Custom Field Technician Tools",
                "Dedicated Success Manager",
                "10,000,000 AI Tokens / Month"
            ],
            cta: "Start Unlimited Trial",
            ctaLink: "https://app.tektrakker.com/#/login?view=register_business&plan=enterprise",
            popular: false
        }
    ];

    return (
        <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-indigo-500 selection:text-white flex flex-col">
            {/* Global Header */}
            <LandingHeader />

            <main className="max-w-7xl mx-auto px-6 py-32 flex-1 w-full">
                
                {/* VSL Hero Section */}
                <div className="text-center mb-16">
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs font-bold uppercase tracking-widest mb-6">
                        Transparent, Flat-Rate Pricing
                    </div>
                    <h1 className="text-5xl md:text-7xl font-black tracking-tight mb-8 leading-tight text-slate-900">
                        Stop Losing Money To <br/>
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-indigo-800">Inefficient Workflows.</span>
                    </h1>
                    <p className="text-xl text-slate-600 max-w-2xl mx-auto mb-12 font-medium">
                        Choose the plan that fits your business. Scale your operations, recover lost revenue, and let our AI automate the dispatch details.
                    </p>

                    {/* Billing Toggle Switcher */}
                    <div className="flex items-center justify-center gap-4 mb-16">
                        <span className={`text-lg font-bold transition-colors ${!isAnnual ? 'text-slate-900' : 'text-slate-400'}`}>Monthly</span>
                        <button 
                            onClick={() => setIsAnnual(!isAnnual)}
                            className="w-16 h-8 rounded-full bg-slate-200 border border-slate-300 p-1 flex items-center cursor-pointer transition-all duration-300 relative focus:outline-none"
                            aria-label="Toggle annual billing"
                        >
                            <div className={`w-6 h-6 rounded-full bg-indigo-600 shadow-md transform transition-transform duration-300 ${isAnnual ? 'translate-x-8' : 'translate-x-0'}`}></div>
                        </button>
                        <span className={`text-lg font-bold flex items-center gap-2 transition-colors ${isAnnual ? 'text-slate-900' : 'text-slate-400'}`}>
                            Annually
                            <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-bold border border-emerald-200">Save 20%</span>
                        </span>
                    </div>
                </div>

                {/* Pricing Cards Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch mb-24">
                    {plans.map((plan, i) => {
                        const price = isAnnual ? plan.priceAnnual : plan.priceMonthly;
                        const pricePeriod = isAnnual ? "/yr" : "/mo";
                        const monthlyEquivalent = isAnnual ? Math.round(plan.priceAnnual / 12) : plan.priceMonthly;

                        return (
                            <div 
                                key={i}
                                className={`rounded-[2.5rem] bg-white p-8 md:p-10 border transition-all duration-300 flex flex-col justify-between relative ${
                                    plan.popular 
                                    ? 'border-indigo-600 ring-2 ring-indigo-500/20 shadow-2xl scale-[1.03] lg:-translate-y-2' 
                                    : 'border-slate-200 hover:border-slate-300 shadow-lg'
                                }`}
                            >
                                {plan.popular && (
                                    <div className="absolute top-0 right-1/2 translate-x-1/2 -translate-y-1/2 px-4 py-1.5 rounded-full bg-indigo-600 text-white text-xs font-black uppercase tracking-widest shadow-md">
                                        Most Popular
                                    </div>
                                )}

                                <div className="space-y-6">
                                    <div>
                                        <h3 className="text-2xl font-black mb-2 text-slate-900">{plan.name}</h3>
                                        <p className="text-slate-500 text-sm leading-relaxed font-medium">{plan.desc}</p>
                                    </div>

                                    <div className="pb-6 border-b border-slate-100">
                                        <div className="flex items-baseline gap-2">
                                            <span className="text-5xl font-black text-slate-900">${price}</span>
                                            <span className="text-slate-500 text-lg font-bold">{pricePeriod}</span>
                                        </div>
                                        {isAnnual && (
                                            <p className="text-emerald-600 text-sm font-bold mt-2">
                                                Equivalent to ~${monthlyEquivalent}/month
                                            </p>
                                        )}
                                        <div className="mt-4 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-50 border border-slate-200 text-slate-600 text-xs font-bold">
                                            <User size={12} className="text-indigo-600" />
                                            {plan.maxUsers}
                                        </div>
                                    </div>

                                    <ul className="space-y-4">
                                        {plan.features.map((feature, fIndex) => (
                                            <li key={fIndex} className="flex items-start gap-3 text-sm font-medium">
                                                <div className="p-0.5 rounded-full bg-indigo-50 text-indigo-600 mt-0.5 border border-indigo-100">
                                                    <Check size={14} className="stroke-[3]" />
                                                </div>
                                                <span className="text-slate-600">{feature}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>

                                <div className="mt-8 pt-6 border-t border-slate-100">
                                    <Link 
                                        href={plan.ctaLink} 
                                        className={`w-full py-4 text-center font-black rounded-2xl block transition-all hover:scale-[1.02] active:scale-[0.98] ${
                                            plan.popular 
                                            ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg hover:shadow-xl shadow-indigo-600/20' 
                                            : 'bg-slate-900 hover:bg-slate-800 text-white'
                                        }`}
                                    >
                                        {plan.cta}
                                    </Link>
                                    <p className="text-center text-xs text-slate-400 mt-3 font-semibold">
                                        14-Day Trial. No Credit Card Required.
                                    </p>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* AI Virtual Worker Module */}
                <div className="bg-gradient-to-br from-indigo-50 to-indigo-100/50 border border-indigo-200 rounded-[3rem] p-8 md:p-16 mb-24 relative overflow-hidden shadow-xl">
                    <div className="absolute -right-20 -bottom-20 w-96 h-96 bg-indigo-200/40 rounded-full blur-[100px] pointer-events-none"></div>
                    
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
                        <div className="lg:col-span-7 space-y-6">
                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-100 border border-indigo-200 text-indigo-700 text-xs font-bold uppercase tracking-widest">
                                Optional Add-On
                            </div>
                            <h2 className="text-4xl md:text-5xl font-black tracking-tight leading-tight text-slate-950">
                                Hire Your 24/7 <br/>
                                <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-violet-600">Autonomous AI Worker</span>
                            </h2>
                            <p className="text-slate-600 text-lg leading-relaxed font-medium">
                                Enable autonomous dispatch operations. Our Virtual Worker reads schedules, audits invoices, books customer estimates, and coordinates dispatches in the background so you can take back your evenings.
                            </p>
                            
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="flex gap-3 items-start p-4 bg-white rounded-2xl border border-slate-200 shadow-sm">
                                    <Bot className="text-indigo-600 mt-1 shrink-0" size={20} />
                                    <div>
                                        <h4 className="font-bold text-slate-900 text-sm">Autonomous Dispatch</h4>
                                        <p className="text-xs text-slate-500 leading-relaxed mt-1 font-medium">Slots in emergency jobs based on live drive times.</p>
                                    </div>
                                </div>
                                <div className="flex gap-3 items-start p-4 bg-white rounded-2xl border border-slate-200 shadow-sm">
                                    <Shield className="text-indigo-600 mt-1 shrink-0" size={20} />
                                    <div>
                                        <h4 className="font-bold text-slate-900 text-sm">Invoice Audit & Draft</h4>
                                        <p className="text-xs text-slate-500 leading-relaxed mt-1 font-medium">Scans timesheets for leakage before billing is finalized.</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="lg:col-span-5 space-y-6">
                            <div className="bg-white border border-slate-200 rounded-3xl p-8 space-y-6 shadow-xl">
                                <div>
                                    <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                                        <Bot size={20} className="text-indigo-600" />
                                        Virtual Worker Subscription
                                    </h3>
                                    <p className="text-xs text-slate-500 mt-1 font-medium">Adds autonomous AI access to any plan.</p>
                                </div>

                                <div className="space-y-4 pb-6 border-b border-slate-100">
                                    <div className="flex justify-between items-baseline">
                                        <span className="text-slate-700 font-bold text-sm">Monthly Plan</span>
                                        <div className="text-right">
                                            <span className="text-3xl font-black text-indigo-600">$49.99</span>
                                            <span className="text-slate-500 text-xs font-bold">/mo</span>
                                        </div>
                                    </div>
                                    <div className="flex justify-between items-baseline">
                                        <span className="text-slate-700 font-bold text-sm">One-Time Lifetime</span>
                                        <div className="text-right">
                                            <span className="text-2xl font-black text-indigo-600">$1,999</span>
                                            <span className="text-slate-500 text-xs font-bold"> flat</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <div className="flex justify-between text-xs font-bold">
                                        <span className="text-slate-700">AI Power Pack (Top-up)</span>
                                        <span className="text-emerald-600 font-extrabold">+$10.00</span>
                                    </div>
                                    <p className="text-[11px] text-slate-500 leading-relaxed font-semibold">
                                        We never auto-charge overages. If you reach your plan's token limit, top up with 1,000,000 extra tokens for just $10.
                                    </p>
                                </div>

                                <Link 
                                    href="https://app.tektrakker.com/#/login" 
                                    className="w-full py-4 text-center font-black bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl block transition-all shadow-md shadow-indigo-600/10"
                                >
                                    Activate AI Worker
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Franchise PAAS Block */}
                <div className="bg-white border border-slate-200 rounded-[2.5rem] p-8 md:p-12 mb-24 flex flex-col md:flex-row justify-between items-center gap-8 relative overflow-hidden shadow-lg">
                    <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-r from-purple-500/5 to-transparent pointer-events-none"></div>
                    <div className="flex items-center gap-6">
                        <div className="p-4 bg-purple-50 text-purple-600 rounded-3xl shrink-0 hidden md:block border border-purple-100">
                            <Building2 size={40} />
                        </div>
                        <div className="space-y-2">
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-purple-50 border border-purple-100 text-purple-700 text-[10px] font-bold uppercase tracking-wider">
                                B2B White-Labeling
                            </div>
                            <h3 className="text-2xl font-black text-slate-900">White-Label Franchise PAAS License</h3>
                            <p className="text-slate-600 text-sm leading-relaxed max-w-2xl font-medium">
                                Run the entire TekTrakker platform on your custom domain with your logo and brand colors. Turnkey corporate infrastructure. Custom Setup: $1,500 DNS/setup + $999/mo base subscription, plus revenue share options or a $48,000 Lifetime Access License.
                            </p>
                        </div>
                    </div>
                    <Link 
                        href="/franchise" 
                        className="h-14 px-8 bg-purple-600 hover:bg-purple-700 text-white font-black rounded-2xl flex items-center justify-center shrink-0 gap-2 transition-all hover:scale-105 active:scale-95 shadow-lg shadow-purple-600/10"
                    >
                        Configure Franchise <ArrowRight size={18} />
                    </Link>
                </div>

                {/* SEO-Crawlable Comparison Table */}
                <div className="mb-24">
                    <div className="text-center mb-12">
                        <h2 className="text-3xl font-black text-slate-900 mb-4">Complete Feature Comparison</h2>
                        <p className="text-slate-500 font-medium">Review all details side-by-side to find the right tier for your operations.</p>
                    </div>

                    <div className="w-full overflow-x-auto border border-slate-200 rounded-3xl bg-white shadow-xl">
                        <table className="w-full border-collapse text-left min-w-[700px]">
                            <thead>
                                <tr className="border-b border-slate-200 bg-slate-50">
                                    <th className="p-6 text-sm font-black uppercase tracking-wider text-slate-500">Core Capabilities</th>
                                    <th className="p-6 text-sm font-black uppercase tracking-wider text-slate-800">Starter ($49/mo)</th>
                                    <th className="p-6 text-sm font-black uppercase tracking-wider text-slate-800">Growth ($149/mo)</th>
                                    <th className="p-6 text-sm font-black uppercase tracking-wider text-slate-800">Enterprise ($350/mo)</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-slate-600 font-medium">
                                <tr>
                                    <td className="p-6 font-bold text-slate-900 text-sm">Included User Seats</td>
                                    <td className="p-6 text-sm">1 User</td>
                                    <td className="p-6 text-sm">5 Users</td>
                                    <td className="p-6 text-sm font-bold text-indigo-600">Unlimited Users</td>
                                </tr>
                                <tr>
                                    <td className="p-6 font-bold text-slate-900 text-sm">Additional User Cost</td>
                                    <td className="p-6 text-sm">Not Available</td>
                                    <td className="p-6 text-sm">$30 / user / month</td>
                                    <td className="p-6 text-sm text-emerald-600 font-bold">$0 (Included)</td>
                                </tr>
                                <tr>
                                    <td className="p-6 font-bold text-slate-900 text-sm">Customer Database (CRM)</td>
                                    <td className="p-6"><Check className="text-indigo-600" size={20} /></td>
                                    <td className="p-6"><Check className="text-indigo-600" size={20} /></td>
                                    <td className="p-6"><Check className="text-indigo-600" size={20} /></td>
                                </tr>
                                <tr>
                                    <td className="p-6 font-bold text-slate-900 text-sm">Offline Dispatch App</td>
                                    <td className="p-6"><Check className="text-indigo-600" size={20} /></td>
                                    <td className="p-6"><Check className="text-indigo-600" size={20} /></td>
                                    <td className="p-6"><Check className="text-indigo-600" size={20} /></td>
                                </tr>
                                <tr>
                                    <td className="p-6 font-bold text-slate-900 text-sm">Online Booking Widget</td>
                                    <td className="p-6"><Check className="text-indigo-600" size={20} /></td>
                                    <td className="p-6"><Check className="text-indigo-600" size={20} /></td>
                                    <td className="p-6"><Check className="text-indigo-600" size={20} /></td>
                                </tr>
                                <tr>
                                    <td className="p-6 font-bold text-slate-900 text-sm">GPS Fleet Tracking</td>
                                    <td className="p-6"><X className="text-slate-300" size={20} /></td>
                                    <td className="p-6"><Check className="text-indigo-600" size={20} /></td>
                                    <td className="p-6"><Check className="text-indigo-600" size={20} /></td>
                                </tr>
                                <tr>
                                    <td className="p-6 font-bold text-slate-900 text-sm">Good/Better/Best Estimating</td>
                                    <td className="p-6"><X className="text-slate-300" size={20} /></td>
                                    <td className="p-6"><Check className="text-indigo-600" size={20} /></td>
                                    <td className="p-6"><Check className="text-indigo-600" size={20} /></td>
                                </tr>
                                <tr>
                                    <td className="p-6 font-bold text-slate-900 text-sm">QuickBooks Online Sync</td>
                                    <td className="p-6"><X className="text-slate-300" size={20} /></td>
                                    <td className="p-6"><Check className="text-indigo-600" size={20} /></td>
                                    <td className="p-6"><Check className="text-indigo-600" size={20} /></td>
                                </tr>
                                <tr>
                                    <td className="p-6 font-bold text-slate-900 text-sm">Monthly AI Token Limit</td>
                                    <td className="p-6 text-sm">1,000,000 Tokens</td>
                                    <td className="p-6 text-sm">1,500,000 Tokens</td>
                                    <td className="p-6 text-sm font-bold text-indigo-650">10,000,000 Tokens</td>
                                </tr>
                                <tr>
                                    <td className="p-6 font-bold text-slate-900 text-sm">Custom Branding & Subdomain</td>
                                    <td className="p-6"><X className="text-slate-300" size={20} /></td>
                                    <td className="p-6"><X className="text-slate-300" size={20} /></td>
                                    <td className="p-6"><Check className="text-indigo-600" size={20} /></td>
                                </tr>
                                <tr>
                                    <td className="p-6 font-bold text-slate-900 text-sm">Developer API & Webhooks</td>
                                    <td className="p-6"><X className="text-slate-300" size={20} /></td>
                                    <td className="p-6"><X className="text-slate-300" size={20} /></td>
                                    <td className="p-6"><Check className="text-indigo-600" size={20} /></td>
                                </tr>
                                <tr>
                                    <td className="p-6 font-bold text-slate-900 text-sm">Custom Tech Tool Builder</td>
                                    <td className="p-6"><X className="text-slate-300" size={20} /></td>
                                    <td className="p-6"><X className="text-slate-300" size={20} /></td>
                                    <td className="p-6"><Check className="text-indigo-600" size={20} /></td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>



                {/* Secure Badge Section */}
                <div className="mt-24 text-center space-y-6">
                    <div className="flex justify-center items-center gap-6 flex-wrap text-slate-400">
                        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider"><Shield size={16} /> 256-Bit SSL Encrypted</div>
                        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider"><Lock size={16} /> PCI-DSS Compliant Gateway</div>
                    </div>
                    <p className="text-xs text-slate-500 max-w-lg mx-auto font-medium">
                        Subscriptions are billed in USD. Payments are processed securely via Stripe. By signing up, you agree to our Terms of Service and End User License Agreement (EULA).
                    </p>
                </div>

            </main>

            {/* Conversational Q&A Section for LLM/AI Engine Optimization */}
            <section className="py-20 px-6 bg-slate-100 border-t border-slate-200">
                <div className="max-w-4xl mx-auto text-left">
                    <div className="text-center mb-12">
                        <h2 className="text-3xl font-black text-slate-900 tracking-tight">TekTrakker Platform Pricing Q&A</h2>
                        <p className="text-slate-600 mt-2 font-medium">Direct answers to help you understand our flat-rate plans and pricing structures.</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200/60">
                            <h3 className="font-bold text-slate-900 mb-2">Q: How much does TekTrakker cost, and is there an annual discount?</h3>
                            <p className="text-slate-600 text-sm leading-relaxed font-medium">
                                A: TekTrakker offers three flat-rate SaaS plans: the Starter Plan is $49/mo (or $550/yr), the Growth Plan is $149/mo (or $1,500/yr), and the Enterprise Plan is $350/mo (or $3,500/yr). Choosing an annual plan saves you up to 20% compared to month-to-month billing.
                            </p>
                        </div>
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200/60">
                            <h3 className="font-bold text-slate-900 mb-2">Q: Are there user seat limits or excess user fees?</h3>
                            <p className="text-slate-600 text-sm leading-relaxed font-medium">
                                A: The Starter Plan is limited to 1 user. The Growth Plan includes up to 5 user slots, with additional users costing $30/user/month. The Enterprise Plan has no seat limits and includes unlimited office and field users for a flat $350/month fee.
                            </p>
                        </div>
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200/60">
                            <h3 className="font-bold text-slate-900 mb-2">Q: How is the AI Virtual Worker priced and billed?</h3>
                            <p className="text-slate-600 text-sm leading-relaxed font-medium">
                                A: The AI Virtual Worker is available as a platform-wide add-on for $49.99/month (or a $1,999 one-time lifetime license). This add-on gives your system the ability to automate scheduling, dispatching, and invoicing in the background. It consumes AI Tokens from your plan's monthly allocation.
                            </p>
                        </div>
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200/60">
                            <h3 className="font-bold text-slate-900 mb-2">Q: Are there any hidden transaction fees or per-job commissions?</h3>
                            <p className="text-slate-600 text-sm leading-relaxed font-medium">
                                A: No. TekTrakker does not charge transaction commissions, per-job fees, or booking premiums. You only pay your flat monthly or annual subscription rate. Standard processing fees apply only for card payments processed through Stripe or Square integrations.
                            </p>
                        </div>
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200/60">
                            <h3 className="font-bold text-slate-900 mb-2">Q: Do you offer a plan for large franchises or white-label partners?</h3>
                            <p className="text-slate-600 text-sm leading-relaxed font-medium">
                                A: Yes! We offer a completely dedicated White-Label Franchise PAAS License. This program allows you to run TekTrakker under your own brand, logo, and domain. It costs a $1,500 one-time Setup/DNS fee and a $999/month flat retainer, plus usage-based revenue sharing ($10/user/mo and $19.99/virtual worker/mo). You can also secure a Franchise Lifetime Access License for $48,000.
                            </p>
                        </div>
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200/60">
                            <h3 className="font-bold text-slate-900 mb-2">Q: How does the 14-day free trial work?</h3>
                            <p className="text-slate-600 text-sm leading-relaxed font-medium">
                                A: You can sign up for any tier without entering a credit card. You get full access to the chosen plan's features for 14 days. Before your trial ends, we will notify you to add a payment method if you wish to continue using TekTrakker.
                            </p>
                        </div>
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200/60">
                            <h3 className="font-bold text-slate-900 mb-2">Q: How is TekTrakker's unlimited user flat-pricing sustainable compared to ServiceTitan or Jobber?</h3>
                            <p className="text-slate-600 text-sm leading-relaxed font-medium">
                                A: Legacy FSM platforms operate on older database architectures that scale inefficiently, passing high cloud/server costs and bloated sales team commissions onto their customers. TekTrakker is engineered on modern, serverless Google Cloud architecture. Since we don't have high corporate overhead, bloated sales forces, or per-seat licensing friction, we operate profitably while passing 100% of these structural savings directly to our customers.
                            </p>
                        </div>
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200/60">
                            <h3 className="font-bold text-slate-900 mb-2">Q: How reliable is TekTrakker's infrastructure and how mature is its support?</h3>
                            <p className="text-slate-600 text-sm leading-relaxed font-medium">
                                A: TekTrakker boasts a 99.99% uptime record, utilising fully redundant data centers and offline-first mobile synchronization so your technicians never lose access to jobs, checklists, or maps. As a certified Service-Disabled Veteran-Owned Small Business (SDVOSB), we support our clients with dedicated, US-based support engineers who assist with onboarding, data migration, and live training.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Global Footer */}
            <LandingFooter />
        </div>
    );
}
