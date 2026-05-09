import React from 'react';
import { LandingHeader } from '../components/LandingHeader';
import { LandingFooter } from '../components/LandingFooter';
import LandingChatbot from '../components/LandingChatbot';
import { Shield, Target, Users, Award } from 'lucide-react';
import Link from 'next/link';

export default function AboutPage() {
    return (
        <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
            <LandingHeader />
            
            <header className="pt-40 pb-20 px-6 relative overflow-hidden bg-slate-950 text-white border-b border-slate-800">
                <div 
                    className="absolute inset-0 z-0 opacity-20 bg-cover bg-center mix-blend-overlay"
                    // eslint-disable-next-line react/forbid-dom-props
                    style={{ backgroundImage: `url(/images/about_us_hero_1778355123377.png)` }}
                />
                <div className="absolute top-0 right-0 w-[800px] h-[500px] bg-primary-600/40 rounded-full blur-[120px] pointer-events-none transform translate-x-1/3 -translate-y-1/3 z-0" />
                <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-emerald-900/30 rounded-full blur-[150px] pointer-events-none transform -translate-x-1/2 translate-y-1/2 z-0" />
                
                <div className="max-w-4xl mx-auto text-center relative z-10">
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/30 mb-8">
                        <Award size={16} className="text-emerald-400" />
                        <span className="text-xs font-bold text-emerald-400 uppercase tracking-widest">A Certified SDVOSB</span>
                    </div>
                    <h1 className="text-5xl md:text-7xl font-black tracking-tight mb-8 leading-tight">
                        Built for the Trades. <br className="hidden md:block"/> Backed by Service.
                    </h1>
                    <p className="text-2xl font-medium text-slate-300 mb-6">
                        We are a Service-Disabled Veteran-Owned Small Business (SDVOSB) dedicated to empowering the blue-collar backbone of America.
                    </p>
                </div>
            </header>

            <section className="py-24 px-6 bg-white">
                <div className="max-w-4xl mx-auto">
                    <h2 className="text-4xl font-black text-slate-900 mb-8 text-center">Our Mission</h2>
                    <div className="prose prose-lg prose-slate text-slate-600 mx-auto">
                        <p className="leading-relaxed mb-6">
                            At TekTrakker, we know what it means to serve. As a proud <strong>Service-Disabled Veteran-Owned Small Business (SDVOSB)</strong>, our founding principles are rooted in integrity, discipline, and a relentless pursuit of excellence. We took the lessons learned in military service and applied them to solving the most complex logistical challenges in the field service industry.
                        </p>
                        <p className="leading-relaxed mb-6">
                            We exist to help service industry companies of all sizes succeed. Whether you are an ambitious owner-operator just opening your doors for the first time, or a massive enterprise dispatching hundreds of trucks across multiple states, TekTrakker provides the comprehensive digital infrastructure you need to thrive. 
                        </p>
                        <p className="leading-relaxed mb-6">
                            For decades, the trades have been underserved by technology. Software was either too simplistic to handle real-world complexities or too clunky and expensive to justify. We built TekTrakker from the ground up to be different. It is an all-in-one operating system that eliminates friction, drives profitability, and restores work-life balance to hard-working service professionals.
                        </p>
                    </div>
                </div>
            </section>

            <section className="py-24 px-6 bg-slate-50 border-t border-slate-200">
                <div className="max-w-7xl mx-auto">
                    <h2 className="text-3xl font-black text-center mb-16 text-slate-900">Why Choose TekTrakker?</h2>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
                        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm hover:shadow-lg transition-shadow">
                            <div className="w-14 h-14 bg-primary-100 text-primary-600 rounded-2xl flex items-center justify-center mb-6">
                                <Shield size={28} />
                            </div>
                            <h3 className="text-xl font-bold mb-4">Veteran Led</h3>
                            <p className="text-slate-600 leading-relaxed">
                                We approach business with the same dedication, strategic planning, and unwavering commitment to the mission that we learned in the military. When you partner with us, you are partnering with a team that won't quit until the job is done.
                            </p>
                        </div>
                        
                        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm hover:shadow-lg transition-shadow">
                            <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mb-6">
                                <Target size={28} />
                            </div>
                            <h3 className="text-xl font-bold mb-4">Built for Scale</h3>
                            <p className="text-slate-600 leading-relaxed">
                                Our platform grows with you. We provide the foundational tools necessary to get a new business off the ground, and the advanced enterprise capabilities required to manage multi-million dollar operations.
                            </p>
                        </div>
                        
                        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm hover:shadow-lg transition-shadow">
                            <div className="w-14 h-14 bg-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center mb-6">
                                <Users size={28} />
                            </div>
                            <h3 className="text-xl font-bold mb-4">True Partnership</h3>
                            <p className="text-slate-600 leading-relaxed">
                                We don't just sell software; we forge partnerships. Our onboarding and support teams are deeply invested in your success, providing ongoing training, best practices, and continuous platform enhancements.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            <section className="py-24 px-6 bg-primary-900 text-white text-center">
                <div className="max-w-3xl mx-auto">
                    <h2 className="text-4xl font-black mb-6">Ready to scale your service business?</h2>
                    <p className="text-xl text-primary-200 mb-10">Join the thousands of trade professionals who trust TekTrakker to power their daily operations.</p>
                    <Link href="https://app.tektrakker.com/#/login?view=register_business" className="inline-flex h-16 px-10 rounded-2xl bg-white text-primary-900 font-black text-lg hover:bg-slate-100 transition-all shadow-xl hover:-translate-y-1 items-center justify-center">
                        Start Your Free Trial
                    </Link>
                </div>
            </section>

            <LandingFooter />
            <LandingChatbot />
        </div>
    );
}
