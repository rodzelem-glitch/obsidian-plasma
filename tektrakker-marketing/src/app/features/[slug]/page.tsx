

import React from 'react';
import { notFound } from 'next/navigation';
import { platformFeatures } from '../../data/content';
import { LandingHeader } from '../../components/LandingHeader';
import { LandingFooter } from '../../components/LandingFooter';
import LandingChatbot from '../../components/LandingChatbot';
import { CheckCircle, ArrowRight } from 'lucide-react';
import Link from 'next/link';

export function generateStaticParams() {
    return Object.keys(platformFeatures).map((slug) => ({
        slug: slug,
    }));
}

export const dynamicParams = false;

export default async function FeaturePage({ params }: { params: Promise<{ slug: string }> }) {
    const resolvedParams = await params;
    const featureData = platformFeatures[resolvedParams.slug as keyof typeof platformFeatures];

    if (!featureData) {
        notFound();
    }

    return (
        <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
            <LandingHeader />
            
            <header className="pt-40 pb-20 px-6 relative overflow-hidden bg-white border-b border-slate-200">
                <div className="absolute top-0 right-0 w-[800px] h-[500px] bg-primary-600/10 rounded-full blur-[120px] pointer-events-none transform translate-x-1/3 -translate-y-1/3" />
                <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 items-center relative z-10">
                    <div>
                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary-50 border border-primary-200 mb-8">
                            <span className="text-xs font-bold text-primary-700 uppercase tracking-widest">Platform Feature</span>
                        </div>
                        <h1 className="text-5xl md:text-6xl font-black tracking-tight mb-6 leading-tight text-slate-900">
                            {featureData.title}
                        </h1>
                        <p className="text-2xl font-bold text-slate-700 mb-6">{featureData.subtitle}</p>
                        <p className="text-lg text-slate-600 mb-10 leading-relaxed max-w-xl">
                            {featureData.description}
                        </p>
                        <Link href="https://app.tektrakker.com/#/login?view=register_business" className="inline-flex h-16 px-10 rounded-2xl bg-primary-600 text-white font-black text-lg hover:bg-primary-700 transition-all shadow-lg shadow-primary-600/20 hover:scale-[1.02] items-center justify-center gap-2">
                            Start Your Free Trial <ArrowRight size={20} />
                        </Link>
                    </div>
                    <div className="relative rounded-3xl overflow-hidden shadow-2xl border border-slate-200 bg-slate-100 aspect-[4/3] flex items-center justify-center">
                        {featureData.heroImage ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={featureData.heroImage} alt={featureData.title} className="w-full h-full object-cover" />
                        ) : (
                            <div className="text-slate-400 font-bold">Interactive Demo Preview</div>
                        )}
                    </div>
                </div>
            </header>

            <section className="py-24 px-6">
                <div className="max-w-7xl mx-auto">
                    <div className="text-center mb-16">
                        <h2 className="text-4xl font-black text-slate-900 mb-4">Core Benefits</h2>
                        <p className="text-xl text-slate-600 max-w-2xl mx-auto">How this feature transforms your daily operations.</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        {featureData.benefits.map((b, i) => (
                            <div key={i} className="bg-white p-8 rounded-3xl border border-slate-200 shadow-xl hover:-translate-y-2 transition-transform duration-300">
                                <div className="w-12 h-12 rounded-2xl bg-primary-100 text-primary-600 flex items-center justify-center mb-6">
                                    <CheckCircle size={24} />
                                </div>
                                <h3 className="text-xl font-bold text-slate-900 mb-4">{b.title}</h3>
                                <p className="text-slate-600 leading-relaxed">{b.description}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            <section className="py-24 px-6 bg-slate-900 text-white relative overflow-hidden">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary-600/20 rounded-full blur-[150px] pointer-events-none"></div>
                <div className="max-w-4xl mx-auto relative z-10 text-center">
                    <h2 className="text-4xl md:text-5xl font-black mb-8">{featureData.deepDive.title}</h2>
                    <p className="text-lg md:text-xl text-slate-300 leading-relaxed whitespace-pre-wrap text-left bg-slate-800/50 p-8 md:p-12 rounded-3xl border border-slate-700/50 shadow-2xl">
                        {featureData.deepDive.content}
                    </p>
                </div>
            </section>

            <section className="py-24 px-6 bg-white">
                <div className="max-w-3xl mx-auto">
                    <h2 className="text-4xl font-black text-slate-900 text-center mb-16">Frequently Asked Questions</h2>
                    <div className="space-y-6">
                        {featureData.faq.map((f, i) => (
                            <div key={i} className="bg-slate-50 border border-slate-200 rounded-2xl p-8">
                                <h4 className="text-xl font-bold text-slate-900 mb-3">{f.q}</h4>
                                <p className="text-slate-600 leading-relaxed">{f.a}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            <LandingFooter />
            <LandingChatbot />
        </div>
    );
}
