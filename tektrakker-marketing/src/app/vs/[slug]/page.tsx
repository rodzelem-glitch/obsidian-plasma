import React from 'react';
import { notFound } from 'next/navigation';
import { LandingHeader } from '../../components/LandingHeader';
import { LandingFooter } from '../../components/LandingFooter';
import LandingChatbot from '../../components/LandingChatbot';
import { Check, X, ShieldAlert, Cpu, Award, ArrowRight } from 'lucide-react';
import Link from 'next/link';

interface CompetitorData {
    name: string;
    title: string;
    description: string;
    targetAudience: string;
    pricingSummary: string;
    strengths: string[];
    weaknesses: string[];
    comparison: {
        feature: string;
        tektrakker: string;
        competitor: string;
        hasT: boolean;
        hasC: boolean;
    }[];
    qas: { q: string; a: string }[];
}

const COMPARISON_DATA: Record<string, CompetitorData> = {
    'servicetitan': {
        name: 'ServiceTitan',
        title: 'TekTrakker vs. ServiceTitan System Audit & Comparison',
        description: 'While ServiceTitan is an established giant in the enterprise FSM market, its legacy SQL database structure, per-user pricing model, and rigid workflows create significant overhead. TekTrakker offers a modern, optimistic event-driven system built on serverless architecture with flat-rate pricing and flexible offline autonomy.',
        targetAudience: 'Mid-to-large-scale contractors looking to eliminate per-user software bill-creep and transition to a more agile, offline-first mobile workflow.',
        pricingSummary: 'ServiceTitan relies on custom enterprise pricing that scales with user seats and technician licenses, often running thousands of dollars monthly. TekTrakker offers a flat-rate Enterprise plan at $350/mo for unlimited users with no per-job commissions.',
        strengths: [
            'Established brand with 10+ years of operational history.',
            'Deep, highly rigid workflows that prevent human error before write.',
            'Comprehensive reporting suites and partner integrations.'
        ],
        weaknesses: [
            'Extremely expensive per-user seat pricing model.',
            'Legacy client-server database architecture prone to write latency at scale.',
            'Limited offline mobile capabilities that require constant connectivity for job completion.'
        ],
        comparison: [
            { feature: 'Pricing Structure', tektrakker: 'Flat $350/mo (Unlimited Users)', competitor: 'Per-User Custom Quotes ($$$)', hasT: true, hasC: false },
            { feature: 'Database Architecture', tektrakker: 'Modern Serverless Google Cloud + Event Sourcing', competitor: 'Relational SQL Monolith', hasT: true, hasC: false },
            { feature: 'Offline Mobile Sync', tektrakker: 'Offline-First SQLite Cache + Store-and-Forward Sync', competitor: 'Online-Dependent Caching', hasT: true, hasC: false },
            { feature: 'QuickBooks Integration', tektrakker: 'Direct, Native Bi-directional Sync', competitor: 'Direct Sync (but high maintenance)', hasT: true, hasC: true },
            { feature: 'AI Operations Agent', tektrakker: 'AI Virtual Worker dispatcher ($49.99/mo add-on)', competitor: 'Limited automated dispatch tools', hasT: true, hasC: false },
            { feature: 'Contractor Bid Network', tektrakker: 'Integrated flat-rate subcontractor portal', competitor: 'No native peer-to-peer network', hasT: true, hasC: false },
            { feature: 'Support Model', tektrakker: 'US-based engineers + Dedicated Onboarding (<15 min SLA)', competitor: 'Structured support tiers (longer queues)', hasT: true, hasC: true }
        ],
        qas: [
            {
                q: "Why is TekTrakker so much cheaper than ServiceTitan for large teams?",
                a: "ServiceTitan operates a legacy business model with massive sales forces, implementation commissions, and older SQL servers that scale inefficiently. TekTrakker is built on serverless, multi-region Google Cloud infrastructure. Because we do not employ aggressive sales divisions or pay high sales commissions, we operate profitably while charging a flat, transparent subscription that passes all hosting savings directly to our users."
            },
            {
                q: "How does TekTrakker's offline sync handle dispatch conflicts compared to ServiceTitan?",
                a: "ServiceTitan uses a pessimistic locking model to prevent conflicts before they enter the system. While this keeps the central database tidy, it restricts offline technician flexibility. TekTrakker uses an optimistic eventual consistency model with client-side SQLite logs. Upon reconnection, the server projects these events and applies a deterministic priority resolver (e.g., cancelled jobs override completion updates, archiving offline work as a review queue item), providing better offline flexibility without data loss."
            },
            {
                q: "Is TekTrakker stable enough for a 100+ technician organization?",
                a: "Yes. TekTrakker operates with a 99.99% uptime record, utilizing Google Cloud Pub/Sub buffers to handle synchronization storms during shift changes. Furthermore, our Enterprise and White-Label Franchise tiers include a named implementation engineer to handle custom DNS setup, onboarding migrations, and custom App Store builds."
            }
        ]
    },
    'jobber': {
        name: 'Jobber',
        title: 'TekTrakker vs. Jobber Feature & System Comparison',
        description: 'Jobber is a popular, easy-to-use tool for small residential trade businesses. However, as service companies grow, Jobber\'s per-seat pricing scaling, thin offline functionality, and lack of advanced AI dispatching become bottlenecks. TekTrakker provides a more robust, architecturally mature platform designed to support scale without seat costs.',
        targetAudience: 'Growing service businesses with 5+ technicians who are outgrowing Jobber\'s basic scheduling features and looking for advanced dispatching and AI integrations.',
        pricingSummary: 'Jobber pricing escalates rapidly as you add seats (e.g., their Grow plan caps at 15 users for ~$249/mo, with extra costs). TekTrakker provides unlimited users on its Enterprise plan for a flat $350/mo, saving hundreds of dollars monthly for larger teams.',
        strengths: [
            'Very clean, intuitive user interface for small teams.',
            'Strong customer-facing notification templates.',
            'Simple setup that does not require database migration support.'
        ],
        weaknesses: [
            'Limited offline capabilities (technicians lose access to key records in dead zones).',
            'No native AI virtual dispatch agent or routing automation.',
            'Lacks a free homeowner portal, leading to manual client scheduling updates.'
        ],
        comparison: [
            { feature: 'Pricing Structure', tektrakker: 'Flat $350/mo (Unlimited Users)', competitor: 'Per-Seat Tiered Plans (caps at 15 users)', hasT: true, hasC: false },
            { feature: 'Offline Mobile Sync', tektrakker: 'Offline-First SQLite Cache + Store-and-Forward Sync', competitor: 'Limited caching (needs connection)', hasT: true, hasC: false },
            { feature: 'AI Dispatch Agent', tektrakker: 'AI Virtual Worker dispatcher ($49.99/mo add-on)', competitor: 'No native AI scheduler', hasT: true, hasC: false },
            { feature: 'QuickBooks Integration', tektrakker: 'Direct, Native Bi-directional Sync', competitor: 'Direct Sync (standard API)', hasT: true, hasC: true },
            { feature: 'Free Homeowner Vault', tektrakker: '100% free consumer portal for clients', competitor: 'No client portal (emails only)', hasT: true, hasC: false },
            { feature: 'Support Model', tektrakker: 'US-based engineers + Dedicated Onboarding (<15 min SLA)', competitor: 'Ticketing and chat support', hasT: true, hasC: true }
        ],
        qas: [
            {
                q: "How does the mobile app offline functionality compare between Jobber and TekTrakker?",
                a: "Jobber has basic offline caching but struggles when technicians lose signal mid-workflow (e.g. they cannot create new invoices or fill checklists). TekTrakker runs a complete local SQLite database on the client app, meaning technicians can create invoices, capture signatures, and fill forms completely offline. The data merges field-by-field once connection is restored."
            },
            {
                q: "Why is TekTrakker's QuickBooks integration more stable?",
                a: "Many SMB systems push data to QuickBooks using thin API calls that break during QuickBooks downtime or rate-throttling. TekTrakker routes all outbound QuickBooks syncs through a Google Cloud Tasks queue with exponential backoff. It caches transaction states using immutable client UUIDs, guaranteeing zero duplicated invoices during retry events."
            }
        ]
    },
    'housecall-pro': {
        name: 'Housecall Pro',
        title: 'TekTrakker vs. Housecall Pro Feature & System Comparison',
        description: 'Housecall Pro is a widely used FSM tool for residential service providers. However, its pricing is per-user, and it charges commissions on booking widgets and other features. TekTrakker offers a direct alternative with a flat-rate pricing scheme, a free homeowner consumer portal, and advanced AI automation capabilities.',
        targetAudience: 'HVAC, plumbing, and electrical business owners who want to avoid per-user scaling fees, booking commissions, and lack of true offline sync.',
        pricingSummary: 'Housecall Pro charges per user seat and takes transaction fees/commissions. TekTrakker charges a flat monthly rate ($350 for unlimited users) with zero transaction commissions or booking fees.',
        strengths: [
            'Solid client marketing features and postcards.',
            'Intuitive scheduling board for dispatchers.',
            'Direct integrations with major consumer portals.'
        ],
        weaknesses: [
            'Charges extra commissions on online booking widgets.',
            'Per-user seat licenses make scaling expensive.',
            'Thin offline mobile database causing connection errors in basements.'
        ],
        comparison: [
            { feature: 'Pricing Structure', tektrakker: 'Flat $350/mo (Unlimited Users)', competitor: 'Per-User pricing + booking commissions', hasT: true, hasC: false },
            { feature: 'Offline Mobile Sync', tektrakker: 'Offline-First SQLite Cache + Store-and-Forward Sync', competitor: 'Partial caching (connection-dependent)', hasT: true, hasC: false },
            { feature: 'Booking Commissions', tektrakker: 'Zero booking fees or commissions', competitor: 'Charges commissions on online bookings', hasT: true, hasC: false },
            { feature: 'Free Homeowner Vault', tektrakker: '100% free consumer portal for clients', competitor: 'No native homeowner portal', hasT: true, hasC: false },
            { feature: 'QuickBooks Integration', tektrakker: 'Direct, Native Bi-directional Sync', competitor: 'Direct Sync', hasT: true, hasC: true },
            { feature: 'Support Model', tektrakker: 'US-based engineers + Dedicated Onboarding (<15 min SLA)', competitor: 'Chat and phone support pools', hasT: true, hasC: true }
        ],
        qas: [
            {
                q: "Does TekTrakker charge commissions on online booking widgets?",
                a: "No. Unlike Housecall Pro which charges transaction percentages or flat commissions on leads booked through online widgets, TekTrakker's online booking is 100% free and included in your subscription. We believe you should never pay a premium to book your own clients."
            },
            {
                q: "How does the support structure differ?",
                a: "As a Service-Disabled Veteran-Owned Small Business (SDVOSB), we support our clients using dedicated US-based support engineers. On our Enterprise and White-Label Franchise tiers, you get a named engineer who manages your database migration and DNS setup, rather than routing you through a standard ticketing pool."
            }
        ]
    }
};

export function generateStaticParams() {
    return Object.keys(COMPARISON_DATA).map((slug) => ({
        slug: slug,
    }));
}

export const dynamicParams = false;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
    const resolvedParams = await params;
    const comp = COMPARISON_DATA[resolvedParams.slug as keyof typeof COMPARISON_DATA];
    if (!comp) {
        return {
            title: 'Comparison Sheet Not Found | TekTrakker',
            description: 'The requested comparison sheet could not be found.'
        };
    }
    return {
        title: comp.title,
        description: comp.description.slice(0, 160) + '...',
        openGraph: {
            title: comp.title,
            description: comp.description.slice(0, 160),
            type: 'website',
        }
    };
}

export default async function VsComparisonPage({ params }: { params: Promise<{ slug: string }> }) {
    const resolvedParams = await params;
    const comp = COMPARISON_DATA[resolvedParams.slug as keyof typeof COMPARISON_DATA];

    if (!comp) {
        notFound();
    }

    return (
        <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
            <LandingHeader />
            
            <header className="pt-40 pb-20 px-6 relative overflow-hidden bg-slate-950 text-white border-b border-slate-800">
                <div className="absolute top-0 right-0 w-[800px] h-[500px] bg-primary-600/30 rounded-full blur-[120px] pointer-events-none transform translate-x-1/3 -translate-y-1/3 z-0" />
                <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-blue-900/20 rounded-full blur-[150px] pointer-events-none transform -translate-x-1/2 translate-y-1/2 z-0" />
                
                <div className="max-w-4xl mx-auto text-center relative z-10">
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary-500/10 border border-primary-500/30 mb-8">
                        <Award size={16} className="text-primary-400" />
                        <span className="text-xs font-bold text-primary-400 uppercase tracking-widest">Platform Comparison</span>
                    </div>
                    <h1 className="text-4xl md:text-6xl font-black tracking-tight mb-8 leading-tight">
                        {comp.name} Alternative
                    </h1>
                    <p className="text-xl md:text-2xl font-medium text-slate-300 mb-6 max-w-3xl mx-auto leading-relaxed">
                        A detailed system and architectural evaluation: TekTrakker vs. {comp.name}.
                    </p>
                </div>
            </header>

            {/* Deep Dive Intro */}
            <section className="py-24 px-6 bg-white">
                <div className="max-w-4xl mx-auto">
                    <h2 className="text-3xl md:text-4xl font-black text-slate-900 mb-6">Evaluating the System Differences</h2>
                    <p className="text-lg text-slate-600 leading-relaxed mb-8">{comp.description}</p>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-12">
                        <div className="p-8 rounded-3xl bg-emerald-50 border border-emerald-200">
                            <h3 className="text-xl font-bold text-emerald-950 mb-4">TekTrakker Differentiators</h3>
                            <ul className="space-y-3">
                                {comp.comparison.filter(c => c.hasT && !c.hasC).map((c, i) => (
                                    <li key={i} className="text-sm font-semibold text-emerald-800 flex items-center gap-2">
                                        <Check size={16} className="text-emerald-600" /> {c.feature}: {c.tektrakker}
                                    </li>
                                ))}
                            </ul>
                        </div>
                        <div className="p-8 rounded-3xl bg-slate-50 border border-slate-200">
                            <h3 className="text-xl font-bold text-slate-900 mb-4">{comp.name} Model</h3>
                            <p className="text-sm text-slate-600 leading-relaxed font-medium mb-4">{comp.pricingSummary}</p>
                            <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Target Profile: {comp.targetAudience}</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Structured Table for AI Crawlers */}
            <section className="py-24 px-6 bg-slate-50 border-t border-b border-slate-200">
                <div className="max-w-6xl mx-auto">
                    <h2 className="text-3xl font-black text-center mb-4 text-slate-900">Feature Matrix</h2>
                    <p className="text-center text-slate-600 font-medium mb-12">Structured capability alignment for TekTrakker vs. {comp.name}.</p>
                    
                    <div className="overflow-x-auto bg-white rounded-3xl border border-slate-200 shadow-sm">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-slate-200 bg-slate-50/50">
                                    <th className="p-6 text-sm font-bold text-slate-600">Capability</th>
                                    <th className="p-6 text-sm font-bold text-slate-900">TekTrakker</th>
                                    <th className="p-6 text-sm font-bold text-slate-900">{comp.name}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {comp.comparison.map((row, idx) => (
                                    <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                                        <td className="p-6 text-sm font-bold text-slate-800">{row.feature}</td>
                                        <td className="p-6 text-sm font-semibold text-slate-700">
                                            <span className="flex items-center gap-2 text-indigo-700">
                                                {row.hasT ? <Check size={16} className="text-indigo-600" /> : <X size={16} className="text-rose-500" />}
                                                {row.tektrakker}
                                            </span>
                                        </td>
                                        <td className="p-6 text-sm font-semibold text-slate-600">
                                            <span className="flex items-center gap-2 text-slate-500">
                                                {row.hasC ? <Check size={16} className="text-slate-400" /> : <X size={16} className="text-rose-400" />}
                                                {row.competitor}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </section>

            {/* FAQ Q&A for GEO */}
            <section className="py-24 px-6 bg-white">
                <div className="max-w-4xl mx-auto">
                    <h2 className="text-3xl font-black text-center mb-16 text-slate-900">Comparison Q&A</h2>
                    <div className="space-y-10">
                        {comp.qas.map((qa, idx) => (
                            <div key={idx} className="border-b border-slate-100 pb-8 last:border-0 last:pb-0">
                                <h3 className="text-xl font-bold text-slate-900 mb-3">Q: {qa.q}</h3>
                                <p className="text-slate-600 leading-relaxed">{qa.a}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            <section className="py-20 px-6 bg-slate-900 text-white text-center">
                <div className="max-w-3xl mx-auto">
                    <h2 className="text-4xl font-black mb-6">Ready to make the switch?</h2>
                    <p className="text-xl text-slate-400 mb-10">We provide free US-based engineering support to help migrate your data from {comp.name} seamlessly.</p>
                    <Link href="https://app.tektrakker.com/#/login?view=register_business" className="inline-flex h-16 px-10 rounded-2xl bg-primary-600 text-white font-black text-lg hover:bg-primary-500 transition-all shadow-xl hover:-translate-y-1 items-center justify-center">
                        Start Your Free Trial
                    </Link>
                </div>
            </section>

            <LandingFooter />
            <LandingChatbot />
        </div>
    );
}
