"use client";

import React from 'react';
import { resourcesData } from '../data/content';
import { LandingHeader } from '../components/LandingHeader';
import { LandingFooter } from '../components/LandingFooter';
import LandingChatbot from '../components/LandingChatbot';
import { Network, ArrowRight } from 'lucide-react';
import Link from 'next/link';

export default function IntegrationsPage() {
    const data = resourcesData['integrations'];

    const integrations = [
        { name: "QuickBooks Online", category: "Accounting", description: "Bi-directional sync for invoices, payments, and chart of accounts." },
        { name: "Xero", category: "Accounting", description: "Push invoices and receive payment updates seamlessly." },
        { name: "Mailchimp", category: "Marketing", description: "Automatically sync customer data for targeted email campaigns." },
        { name: "Twilio", category: "Communications", description: "Power all outbound SMS and voice communications." },
        { name: "Stripe", category: "Payments", description: "Secure credit card processing and vaulting." },
        { name: "Nextdoor", category: "Social", description: "Automatically publish completed jobs to local neighborhood feeds." },
        { name: "Facebook", category: "Social", description: "Omni-channel marketing directly from the field app." },
        { name: "Google Calendar", category: "Scheduling", description: "Sync technician schedules with their personal calendars." },
        { name: "Zapier", category: "Automation", description: "Connect to over 5,000+ apps to automate repetitive tasks." },
        { name: "Instagram", category: "Social", description: "Visually showcase completed projects and generate new leads." },
        { name: "Angi Leads", category: "Lead Generation", description: "Automatically import and respond to high-intent customer leads." },
        { name: "Thumbtack", category: "Lead Generation", description: "Seamlessly pull incoming service requests directly to your dispatch board." },
        { name: "Yelp", category: "Marketing", description: "Automate review requests and manage your local reputation." },
        { name: "Google Local Services", category: "Lead Generation", description: "Capture Google Guaranteed leads directly into your funnel." },
        { name: "RevenueCat", category: "Payments", description: "Manage mobile in-app purchases and recurring app subscriptions." }
    ];

    return (
        <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
            <LandingHeader backButton={{ label: 'Back to Home', href: '/' }} />
            
            <header className="pt-40 pb-20 px-6 bg-slate-900 text-white relative overflow-hidden">
                <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-primary-600/20 rounded-full blur-[100px] pointer-events-none" />
                <div className="max-w-4xl mx-auto text-center relative z-10">
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary-900 border border-primary-800 mb-8">
                        <Network size={16} className="text-primary-400" />
                        <span className="text-xs font-bold text-primary-400 uppercase tracking-widest">Ecosystem</span>
                    </div>
                    <h1 className="text-5xl md:text-6xl font-black tracking-tight mb-6">{data.title}</h1>
                    <p className="text-xl text-slate-300 max-w-2xl mx-auto leading-relaxed mb-10">{data.description}</p>
                </div>
            </header>

            <section className="py-24 px-6 max-w-7xl mx-auto">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {integrations.map((int, i) => (
                        <div key={i} className="bg-white rounded-3xl p-8 border border-slate-200 shadow-lg hover:-translate-y-2 transition-transform duration-300">
                            <span className="inline-block px-3 py-1 bg-slate-100 text-slate-600 text-xs font-bold rounded-full mb-4 uppercase tracking-wider">{int.category}</span>
                            <h3 className="text-2xl font-bold text-slate-900 mb-3">{int.name}</h3>
                            <p className="text-slate-600 leading-relaxed">{int.description}</p>
                        </div>
                    ))}
                </div>
            </section>

            <section className="py-24 px-6 bg-white">
                <div className="max-w-4xl mx-auto">
                    <h2 className="text-3xl font-black mb-8 text-center text-slate-900">Why Integration Matters</h2>
                    <div className="prose prose-lg prose-slate text-slate-600 mx-auto">
                        <p className="leading-relaxed">{data.deepDive}</p>
                    </div>
                </div>
            </section>

            <section className="py-20 px-6 bg-primary-50 text-center">
                <h2 className="text-3xl font-black text-slate-900 mb-6">Don&apos;t see your favorite tool?</h2>
                <p className="text-lg text-slate-600 mb-8 max-w-xl mx-auto">Our Open API allows your developers to connect TekTrakker to virtually any system on earth.</p>
                <Link href="https://app.tektrakker.com/#/login?view=register_business" className="inline-flex h-14 px-8 rounded-xl bg-primary-600 text-white font-bold hover:bg-primary-700 transition-all items-center gap-2">
                    Request an Integration <ArrowRight size={18} />
                </Link>
            </section>

            <LandingFooter />
            <LandingChatbot />
        </div>
    );
}
