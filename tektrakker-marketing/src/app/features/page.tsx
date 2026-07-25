"use client";

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { 
    Calendar, HandCoins, Smartphone, Layout, Heart, MapPin, 
    BarChart3, UserCircle, Layers, Bot, Cpu, Zap, Shield, 
    PhoneCall, Mail, Wrench, Search, ArrowRight, Grid, Sparkles, X
} from 'lucide-react';
import { platformFeatures } from '../data/content';
import { LandingHeader } from '../components/LandingHeader';
import { LandingFooter } from '../components/LandingFooter';
import LandingChatbot from '../components/LandingChatbot';

// Map feature slugs to Lucide icons
const iconMap: Record<string, React.ComponentType<any>> = {
    'scheduling-dispatch': Calendar,
    'invoicing-payments': HandCoins,
    'field-service-app': Smartphone,
    'estimating-proposals': Layout,
    'service-agreements': Heart,
    'geofenced-time-tracking': MapPin,
    'analytics-reporting': BarChart3,
    'client-management-crm': UserCircle,
    'contractor-bid-network': Layers,
    'ai-omni-channel-marketing': Bot,
    'ai-powered-estimating': Cpu,
    'ai-virtual-worker': Sparkles,
    'antigravity-ai': Zap,
    'osha-safety-reminders': Shield,
    'ringcentral-telephony': PhoneCall,
    'drip-email-campaigns': Mail,
    'custom-tools-marketplace': Wrench,
};

// Map feature slugs to custom categories
const categoryMap: Record<string, { category: string; categoryLabel: string }> = {
    'scheduling-dispatch': { category: 'operations', categoryLabel: 'Operations' },
    'field-service-app': { category: 'operations', categoryLabel: 'Operations' },
    'geofenced-time-tracking': { category: 'operations', categoryLabel: 'Operations' },
    'client-management-crm': { category: 'operations', categoryLabel: 'Operations' },
    'ringcentral-telephony': { category: 'operations', categoryLabel: 'Operations' },
    'custom-tools-marketplace': { category: 'operations', categoryLabel: 'Operations' },
    
    'invoicing-payments': { category: 'finance', categoryLabel: 'Sales & Finance' },
    'estimating-proposals': { category: 'finance', categoryLabel: 'Sales & Finance' },
    'service-agreements': { category: 'finance', categoryLabel: 'Sales & Finance' },
    
    'ai-virtual-worker': { category: 'ai', categoryLabel: 'AI & Automation' },
    'antigravity-ai': { category: 'ai', categoryLabel: 'AI & Automation' },
    'ai-omni-channel-marketing': { category: 'ai', categoryLabel: 'AI & Automation' },
    'ai-powered-estimating': { category: 'ai', categoryLabel: 'AI & Automation' },
    
    'analytics-reporting': { category: 'management', categoryLabel: 'Management & Growth' },
    'contractor-bid-network': { category: 'management', categoryLabel: 'Management & Growth' },
    'osha-safety-reminders': { category: 'management', categoryLabel: 'Management & Growth' },
    'drip-email-campaigns': { category: 'management', categoryLabel: 'Management & Growth' },
};

const CATEGORIES = [
    { id: 'all', label: 'All Capabilities', icon: Grid },
    { id: 'operations', label: 'Operations', icon: Calendar },
    { id: 'finance', label: 'Sales & Finance', icon: HandCoins },
    { id: 'ai', label: 'AI & Automation', icon: Sparkles },
    { id: 'management', label: 'Management & Growth', icon: BarChart3 }
];

export default function FeaturesPage() {
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('all');

    // Parse platformFeatures object and augment with category & status metadata
    const featuresList = useMemo(() => {
        return Object.entries(platformFeatures).map(([slug, feature]) => {
            const meta = categoryMap[slug] || { category: 'operations', categoryLabel: 'Operations' };
            const IconComponent = iconMap[slug] || Zap;
            
            // Mark newer features as 'New'
            const isNew = [
                'antigravity-ai', 
                'osha-safety-reminders', 
                'ringcentral-telephony', 
                'drip-email-campaigns', 
                'custom-tools-marketplace'
            ].includes(slug);

            return {
                slug,
                title: feature.title,
                subtitle: feature.subtitle,
                description: feature.description,
                theme: feature.theme,
                benefits: feature.benefits,
                category: meta.category,
                categoryLabel: meta.categoryLabel,
                icon: IconComponent,
                isNew
            };
        });
    }, []);

    // Filter features list based on search and category selections
    const filteredFeatures = useMemo(() => {
        return featuresList.filter((feature) => {
            const matchesCategory = selectedCategory === 'all' || feature.category === selectedCategory;
            const matchesSearch = searchQuery === '' || 
                feature.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                feature.subtitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
                feature.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                feature.benefits.some(b => b.title.toLowerCase().includes(searchQuery.toLowerCase()) || b.description.toLowerCase().includes(searchQuery.toLowerCase()));
            
            return matchesCategory && matchesSearch;
        });
    }, [featuresList, selectedCategory, searchQuery]);

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 font-sans antialiased overflow-x-hidden selection:bg-blue-500/30">
            <LandingHeader />

            {/* Hero Section */}
            <section className="pt-32 md:pt-40 pb-16 px-6 relative overflow-hidden bg-gradient-to-b from-blue-950/20 via-slate-900 to-slate-950">
                {/* Glowing Ambience */}
                <div className="absolute top-0 right-0 w-[400px] md:w-[750px] h-[300px] md:h-[500px] rounded-full blur-[100px] md:blur-[180px] pointer-events-none transform translate-x-1/4 -translate-y-1/4 bg-blue-600/10" />
                <div className="absolute top-1/3 left-0 w-[300px] md:w-[500px] h-[300px] md:h-[400px] rounded-full blur-[100px] md:blur-[150px] pointer-events-none transform -translate-x-1/2 bg-indigo-500/5" />

                <div className="max-w-7xl mx-auto text-center relative z-10">
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-blue-500/20 bg-blue-500/10 text-blue-400 mb-6 backdrop-blur-md">
                        <Sparkles size={14} className="animate-pulse" />
                        <span className="text-[10px] md:text-xs font-black uppercase tracking-widest">Workspace Capabilities</span>
                    </div>
                    <h1 className="text-4xl md:text-6xl lg:text-7xl font-black tracking-tight mb-6 leading-tight text-white">
                        The Command Center for <br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-400 to-cyan-400">
                            Modern Trade Operations
                        </span>
                    </h1>
                    <p className="text-lg md:text-xl text-slate-400 max-w-3xl mx-auto leading-relaxed">
                        Explore the complete suite of visual tracking, smart billing, and native AI co-piloting tools designed to maximize your billable hours and grow your business.
                    </p>
                </div>
            </section>

            {/* Interactive Filters & Search Hub */}
            <section className="py-8 px-6 sticky top-24 z-40 bg-slate-950/80 backdrop-blur-lg border-y border-slate-900">
                <div className="max-w-7xl mx-auto flex flex-col md:flex-row gap-4 items-center justify-between">
                    {/* Search Bar */}
                    <div className="relative w-full md:max-w-md">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                        <input 
                            type="text" 
                            placeholder="Search features or benefits..." 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-slate-900/60 border border-slate-800 rounded-2xl pl-12 pr-10 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                        />
                        {searchQuery && (
                            <button 
                                onClick={() => setSearchQuery('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-500 hover:text-white rounded-full bg-slate-800 hover:bg-slate-700 transition-colors"
                            >
                                <X size={12} />
                            </button>
                        )}
                    </div>

                    {/* Category Selector Tabs */}
                    <div className="flex gap-2 overflow-x-auto w-full md:w-auto pb-2 md:pb-0 no-scrollbar scroll-smooth">
                        {CATEGORIES.map((cat) => {
                            const CatIcon = cat.icon;
                            const isActive = selectedCategory === cat.id;
                            return (
                                <button
                                    key={cat.id}
                                    onClick={() => setSelectedCategory(cat.id)}
                                    className={`flex items-center gap-2 px-4 py-2.5 rounded-full border text-xs font-black whitespace-nowrap transition-all duration-200 ${
                                        isActive 
                                            ? 'bg-gradient-to-r from-blue-600 to-indigo-600 border-transparent text-white shadow-lg shadow-blue-500/20' 
                                            : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                                    }`}
                                >
                                    <CatIcon size={14} />
                                    {cat.label}
                                </button>
                            );
                        })}
                    </div>
                </div>
            </section>

            {/* Features Catalog Grid */}
            <section className="py-16 md:py-24 px-6 relative">
                <div className="max-w-7xl mx-auto">
                    {filteredFeatures.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 relative z-10">
                            {filteredFeatures.map((feature) => {
                                const theme = feature.theme || {
                                    primaryAccent: "from-blue-500 to-indigo-600",
                                    iconColor: "text-blue-500 bg-blue-500/10",
                                    glowColor: "rgba(59, 130, 246, 0.15)",
                                    bgGradient: "from-blue-950/20 via-slate-900 to-slate-950",
                                    badgeColor: "bg-blue-500/10 text-blue-400 border-blue-500/20"
                                };
                                const FeatureIcon = feature.icon;

                                return (
                                    <div 
                                        key={feature.slug} 
                                        className="group bg-slate-900/40 p-8 rounded-3xl border border-slate-900 hover:border-slate-800 hover:-translate-y-1.5 transition-all duration-300 flex flex-col justify-between shadow-xl relative overflow-hidden"
                                    >
                                        {/* Glowing Card Highlight on Hover */}
                                        <div 
                                            className="absolute top-0 right-0 w-[150px] h-[150px] rounded-full blur-[80px] opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                                            style={{ backgroundColor: theme.glowColor || 'rgba(59, 130, 246, 0.12)' }}
                                        />

                                        <div>
                                            <div className="flex justify-between items-start mb-6">
                                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-105 ${theme.iconColor}`}>
                                                    <FeatureIcon size={24} />
                                                </div>
                                                <div className="flex gap-2">
                                                    {feature.isNew && (
                                                        <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 bg-blue-600 text-white rounded-full">New</span>
                                                    )}
                                                    <span className="text-[9px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border border-slate-800 bg-slate-950 text-slate-400">
                                                        {feature.categoryLabel}
                                                    </span>
                                                </div>
                                            </div>

                                            <h3 className="text-xl font-bold text-white mb-2 leading-snug group-hover:text-blue-400 transition-colors">
                                                {feature.title}
                                            </h3>
                                            <p className="text-xs text-slate-400 mb-6 font-semibold tracking-wide italic">
                                                {feature.subtitle}
                                            </p>
                                            <p className="text-sm text-slate-300 leading-relaxed mb-6 line-clamp-3">
                                                {feature.description}
                                            </p>

                                            {/* Key Highlights */}
                                            <div className="border-t border-slate-900 pt-6 mb-6">
                                                <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Operational Value</span>
                                                <p className="text-xs text-slate-400 leading-relaxed font-medium mt-1">
                                                    {feature.benefits[0]?.description || "Increases business efficiency and reduces manual steps."}
                                                </p>
                                            </div>
                                        </div>

                                        <Link 
                                            href={`/features/${feature.slug}/`}
                                            className={`w-full py-3 px-4 rounded-xl border border-slate-800 hover:border-transparent bg-slate-950/40 hover:bg-gradient-to-r ${theme.primaryAccent} text-slate-200 hover:text-white font-black text-xs flex items-center justify-center gap-2 transition-all`}
                                        >
                                            Explore Detailed Feature Guide <ArrowRight size={14} />
                                        </Link>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="text-center py-20 bg-slate-900/20 border border-slate-900 rounded-3xl p-8 relative overflow-hidden">
                            <div className="w-16 h-16 rounded-full bg-slate-900 flex items-center justify-center mx-auto mb-6 text-slate-600">
                                <Search size={28} />
                            </div>
                            <h3 className="text-xl font-bold text-white mb-2">No matching capabilities found</h3>
                            <p className="text-sm text-slate-500 max-w-md mx-auto">
                                We couldn't find any features matching &quot;{searchQuery}&quot;. Try adjusting your search keywords or switching filter categories.
                            </p>
                        </div>
                    )}
                </div>
            </section>

            {/* Bottom Call to Action */}
            <section className="py-20 md:py-28 px-6 bg-slate-900/30 border-t border-slate-900 relative">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(37,99,235,0.05),transparent)] pointer-events-none" />
                <div className="max-w-4xl mx-auto text-center relative z-10">
                    <h2 className="text-3xl md:text-5xl font-black text-white mb-6 tracking-tight">
                        Ready to Transform Your Operations?
                    </h2>
                    <p className="text-lg text-slate-400 mb-10 leading-relaxed max-w-2xl mx-auto">
                        Sign up for our 14-day free trial and experience the full power of the TekTrakker platform. Set up is done in minutes, cancel anytime.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                        <Link 
                            href="https://app.tektrakker.com/#/login?view=register_business" 
                            className="w-full sm:w-auto h-16 px-10 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-black text-lg hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl shadow-blue-500/20 flex items-center justify-center gap-2"
                        >
                            Start Your Free Trial <ArrowRight size={20} />
                        </Link>
                        <Link 
                            href="/pricing/" 
                            className="w-full sm:w-auto h-16 px-10 rounded-2xl border border-slate-800 hover:border-slate-700 bg-slate-900/60 hover:bg-slate-900 text-slate-300 font-black text-lg transition-all flex items-center justify-center"
                        >
                            View Transparent Pricing
                        </Link>
                    </div>
                </div>
            </section>

            <LandingFooter />
            <LandingChatbot />
        </div>
    );
}
