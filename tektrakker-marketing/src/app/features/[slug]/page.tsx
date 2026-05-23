import React from 'react';
import { notFound } from 'next/navigation';
import { platformFeatures } from '../../data/content';
import { LandingHeader } from '../../components/LandingHeader';
import { LandingFooter } from '../../components/LandingFooter';
import LandingChatbot from '../../components/LandingChatbot';
import { CheckCircle, ArrowRight, HelpCircle } from 'lucide-react';
import Link from 'next/link';
import { FeatureVisualizer } from '../components/FeatureVisualizer';

export function generateStaticParams() {
    return Object.keys(platformFeatures).map((slug) => ({
        slug: slug,
    }));
}

export const dynamicParams = false;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
    const resolvedParams = await params;
    const featureData = platformFeatures[resolvedParams.slug as keyof typeof platformFeatures];
    if (!featureData) {
        return {
            title: 'Feature Not Found | TekTrakker',
            description: 'The requested platform feature could not be found.'
        };
    }
    return {
        title: `${featureData.title} | TekTrakker Platform`,
        description: `${featureData.subtitle}. ${featureData.description.slice(0, 150)}...`,
        openGraph: {
            title: `${featureData.title} | TekTrakker Platform`,
            description: featureData.subtitle,
            type: 'website',
        }
    };
}

export default async function FeaturePage({ params }: { params: Promise<{ slug: string }> }) {
    const resolvedParams = await params;
    const featureData = platformFeatures[resolvedParams.slug as keyof typeof platformFeatures];

    if (!featureData) {
        notFound();
    }

    const theme = featureData.theme || {
        primaryAccent: "from-blue-500 to-indigo-600",
        iconColor: "text-blue-500 bg-blue-500/10",
        glowColor: "rgba(59, 130, 246, 0.15)",
        bgGradient: "from-blue-950/20 via-slate-900 to-slate-950",
        badgeColor: "bg-blue-500/10 text-blue-400 border-blue-500/20"
    };

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 font-sans antialiased overflow-x-hidden selection:bg-blue-500/30">
            <LandingHeader />
            
            {/* Hero Section */}
            <section className={`pt-32 md:pt-40 pb-20 md:pb-28 px-6 relative overflow-hidden bg-gradient-to-b ${theme.bgGradient}`}>
                {/* Visual Ambient Glowing Blobs */}
                <div 
                    className="absolute top-0 right-0 w-[400px] md:w-[700px] h-[300px] md:h-[500px] rounded-full blur-[100px] md:blur-[150px] pointer-events-none transform translate-x-1/4 -translate-y-1/4 transition-all duration-1000"
                    style={{ backgroundColor: theme.glowColor || 'rgba(59, 130, 246, 0.15)' }}
                />
                <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-slate-900/40 rounded-full blur-[80px] pointer-events-none transform -translate-x-1/2 translate-y-1/2" />

                <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center relative z-10">
                    <div className="lg:col-span-6 flex flex-col items-start">
                        <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full border mb-6 backdrop-blur-md transition-all ${theme.badgeColor}`}>
                            <span className="text-[10px] md:text-xs font-black uppercase tracking-widest">Platform Feature</span>
                        </div>
                        <h1 className="text-4xl md:text-6xl font-black tracking-tight mb-6 leading-tight text-white bg-clip-text">
                            {featureData.title}
                        </h1>
                        <p className="text-xl md:text-2xl font-bold text-slate-300 mb-6 leading-snug">{featureData.subtitle}</p>
                        <p className="text-base md:text-lg text-slate-400 mb-8 leading-relaxed max-w-xl">
                            {featureData.description}
                        </p>
                        <Link 
                            href="https://app.tektrakker.com/#/login?view=register_business" 
                            className={`inline-flex h-14 px-8 rounded-2xl bg-gradient-to-r ${theme.primaryAccent} text-white font-black text-base hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl hover:shadow-2xl hover:shadow-primary-500/10 items-center justify-center gap-2`}
                        >
                            Start Your Free Trial <ArrowRight size={18} />
                        </Link>
                    </div>
                    <div className="lg:col-span-6 w-full flex items-center justify-center relative">
                        <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 to-purple-500/5 rounded-3xl blur-2xl -z-10" />
                        <FeatureVisualizer slug={resolvedParams.slug} />
                    </div>
                </div>
            </section>

            {/* Core Benefits Section */}
            <section className="py-20 md:py-28 px-6 bg-slate-900/50 border-t border-b border-slate-900 relative">
                <div className="max-w-7xl mx-auto">
                    <div className="text-center mb-16 relative z-10">
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Why it matters</span>
                        <h2 className="text-3xl md:text-4xl font-black text-white mt-2 mb-4">Transforming Your Daily Operations</h2>
                        <p className="text-base md:text-lg text-slate-400 max-w-2xl mx-auto">Discover the tangible business benefits of integrating this premium workspace feature.</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative z-10">
                        {featureData.benefits.map((b, i) => (
                            <div key={i} className="group bg-slate-950/80 p-8 rounded-3xl border border-slate-800/80 shadow-2xl hover:-translate-y-2 hover:border-slate-700/80 transition-all duration-300 flex flex-col justify-between min-h-[260px]">
                                <div>
                                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-6 transition-transform group-hover:scale-110 ${theme.iconColor}`}>
                                        <CheckCircle size={22} />
                                    </div>
                                    <h3 className="text-lg md:text-xl font-bold text-white mb-3 group-hover:text-slate-200 transition-colors">{b.title}</h3>
                                    <p className="text-sm md:text-base text-slate-400 leading-relaxed">{b.description}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Deep Dive Section */}
            <section className="py-20 md:py-28 px-6 relative overflow-hidden bg-slate-950">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-slate-900/50 rounded-full blur-[120px] pointer-events-none"></div>
                <div className="max-w-4xl mx-auto relative z-10 text-center">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">A closer look</span>
                    <h2 className="text-3xl md:text-4xl font-black text-white mt-2 mb-8">{featureData.deepDive.title}</h2>
                    <div className="bg-slate-900/40 backdrop-blur-md text-slate-300 leading-relaxed whitespace-pre-wrap text-left p-8 md:p-12 rounded-3xl border border-slate-800/80 shadow-2xl relative overflow-hidden group">
                        <div className="absolute top-0 left-0 w-1.5 h-full bg-gradient-to-b from-transparent via-slate-700 to-transparent group-hover:via-slate-500 transition-all" />
                        <p className="text-sm md:text-base text-slate-300 leading-relaxed font-normal">
                            {featureData.deepDive.content}
                        </p>
                    </div>
                </div>
            </section>

            {/* FAQ Section */}
            <section className="py-20 md:py-28 px-6 bg-slate-900/20 border-t border-slate-900">
                <div className="max-w-4xl mx-auto">
                    <div className="text-center mb-16">
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Answering your questions</span>
                        <h2 className="text-3xl md:text-4xl font-black text-white mt-2 mb-4">Frequently Asked Questions</h2>
                    </div>
                    <div className="space-y-4">
                        {featureData.faq.map((f, i) => (
                            <div key={i} className="bg-slate-950/60 border border-slate-800/60 hover:border-slate-700/60 rounded-2xl p-6 md:p-8 transition-colors flex gap-4 text-left">
                                <div className="mt-1 text-slate-500 shrink-0">
                                    <HelpCircle size={20} className="text-slate-400" />
                                </div>
                                <div>
                                    <h4 className="text-base md:text-lg font-black text-white mb-2 leading-snug">{f.q}</h4>
                                    <p className="text-xs md:text-sm text-slate-400 leading-relaxed">{f.a}</p>
                                </div>
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
