

import React from 'react';
import { notFound } from 'next/navigation';
import { industriesData } from '../../data/content';
import { LandingHeader } from '../../components/LandingHeader';
import { LandingFooter } from '../../components/LandingFooter';
import LandingChatbot from '../../components/LandingChatbot';
import { Briefcase, ArrowRight, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';

export function generateStaticParams() {
    return Object.keys(industriesData).map((slug) => ({
        slug: slug,
    }));
}

export const dynamicParams = false;

export default async function IndustryPage({ params }: { params: Promise<{ slug: string }> }) {
    const resolvedParams = await params;
    const industry = industriesData[resolvedParams.slug as keyof typeof industriesData];

    if (!industry) {
        notFound();
    }

    return (
        <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
            <LandingHeader />
            
            <header className="pt-40 pb-20 px-6 relative overflow-hidden bg-slate-950 text-white border-b border-slate-800">
                {industry.heroImage && (
                    <div 
                        className="absolute inset-0 z-0 opacity-30 bg-cover bg-center mix-blend-luminosity"
                        // eslint-disable-next-line react/forbid-dom-props
                        style={{ backgroundImage: `url(${industry.heroImage})` }}
                    />
                )}
                <div className="absolute top-0 right-0 w-[800px] h-[500px] bg-primary-600/40 rounded-full blur-[120px] pointer-events-none transform translate-x-1/3 -translate-y-1/3 z-0" />
                <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-blue-900/30 rounded-full blur-[150px] pointer-events-none transform -translate-x-1/2 translate-y-1/2 z-0" />
                <div className="max-w-4xl mx-auto text-center relative z-10">
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary-500/10 border border-primary-500/30 mb-8">
                        <Briefcase size={16} className="text-primary-400" />
                        <span className="text-xs font-bold text-primary-400 uppercase tracking-widest">Industry Solution</span>
                    </div>
                    <h1 className="text-5xl md:text-7xl font-black tracking-tight mb-8 leading-tight">
                        {industry.title}
                    </h1>
                    <p className="text-2xl font-medium text-slate-300 mb-6">{industry.subtitle}</p>
                    <p className="text-xl text-slate-400 mb-12 leading-relaxed max-w-3xl mx-auto">
                        {industry.description}
                    </p>
                    <Link href="https://app.tektrakker.com/#/login?view=register_business" className="inline-flex h-16 px-10 rounded-2xl bg-primary-600 text-white font-black text-lg hover:bg-primary-500 transition-all shadow-[0_0_40px_rgba(37,99,235,0.4)] hover:scale-[1.02] items-center justify-center gap-2">
                        Get Started Free <ArrowRight size={20} />
                    </Link>
                </div>
            </header>

            <section className="py-24 px-6 bg-white">
                <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
                    <div>
                        <h2 className="text-4xl font-black text-slate-900 mb-8">The operating system for modern {industry.title.toLowerCase().replace(' software', '')} businesses.</h2>
                        <div className="prose prose-lg prose-slate text-slate-600">
                            <p className="whitespace-pre-wrap leading-relaxed">{industry.deepDive}</p>
                        </div>
                    </div>
                    <div className="bg-slate-50 border border-slate-200 rounded-3xl p-10 shadow-xl">
                        <h3 className="text-2xl font-bold text-slate-900 mb-8">Specific Capabilities</h3>
                        <ul className="space-y-6">
                            {industry.features.map((feature, idx) => (
                                <li key={idx} className="flex items-start gap-4">
                                    <CheckCircle2 className="text-primary-600 mt-1 shrink-0" size={24} />
                                    <span className="text-lg text-slate-700 font-medium">{feature}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            </section>

            <section className="py-24 px-6 bg-primary-900 text-white text-center">
                <div className="max-w-3xl mx-auto">
                    <h2 className="text-4xl font-black mb-6">Ready to dominate your market?</h2>
                    <p className="text-xl text-primary-200 mb-10">Join thousands of {industry.title.toLowerCase().replace(' software', '')} professionals who trust TekTrakker to run their entire operation.</p>
                    <Link href="https://app.tektrakker.com/#/login?view=register_business" className="inline-flex h-16 px-10 rounded-2xl bg-white text-primary-900 font-black text-lg hover:bg-slate-100 transition-all shadow-xl hover:-translate-y-1 items-center justify-center">
                        Start Your 14-Day Free Trial
                    </Link>
                </div>
            </section>

            <LandingFooter />
            <LandingChatbot />
        </div>
    );
}
