import React from 'react';
import { Check, X, Shield, Zap, Info } from 'lucide-react';

const TransparentPricingSection = () => {
    return (
        <section className="py-24 px-6 bg-slate-50 relative overflow-hidden" id="pricing">
            <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent"></div>
            
            <div className="max-w-6xl mx-auto">
                <div className="text-center mb-16">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold uppercase tracking-widest mb-4">
                        Transparent Pricing
                    </div>
                    <h2 className="text-4xl md:text-5xl font-black text-slate-900 mb-6 tracking-tight">Stop Paying for <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-orange-500">Opaque Licenses</span></h2>
                    <p className="text-xl text-slate-600 max-w-3xl mx-auto leading-relaxed">
                        Legacy field service platforms hit you with hidden fees, per-user seat licenses, and expensive add-ons. We believe in one simple, powerful platform for your entire company.
                    </p>
                </div>

                <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
                    {/* The "Other Guys" */}
                    <div className="bg-white rounded-[2rem] border border-slate-200 p-8 shadow-sm relative overflow-hidden group">
                        <div className="absolute top-0 inset-x-0 h-2 bg-slate-200"></div>
                        <h3 className="text-2xl font-black text-slate-400 mb-2">Legacy Platforms</h3>
                        <div className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-8">ServiceTitan, Housecall Pro, etc.</div>
                        
                        <div className="space-y-6">
                            <div className="flex items-start gap-4">
                                <div className="mt-1 bg-red-100 text-red-500 p-1 rounded-full shrink-0"><X size={16} strokeWidth={3} /></div>
                                <div>
                                    <h4 className="font-bold text-slate-800 text-lg">Per-User Licensing Fees</h4>
                                    <p className="text-slate-500 text-sm mt-1">Pay hundreds of dollars per month for every single technician you hire. Punishes growth.</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-4">
                                <div className="mt-1 bg-red-100 text-red-500 p-1 rounded-full shrink-0"><X size={16} strokeWidth={3} /></div>
                                <div>
                                    <h4 className="font-bold text-slate-800 text-lg">Hidden "Implementation" Fees</h4>
                                    <p className="text-slate-500 text-sm mt-1">Opaque $1,500+ onboarding fees just to set up the software you already pay for.</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-4">
                                <div className="mt-1 bg-red-100 text-red-500 p-1 rounded-full shrink-0"><X size={16} strokeWidth={3} /></div>
                                <div>
                                    <h4 className="font-bold text-slate-800 text-lg">Paywalled Features</h4>
                                    <p className="text-slate-500 text-sm mt-1">Want AI quoting or advanced dispatching? That requires the "Enterprise" tier.</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-4">
                                <div className="mt-1 bg-red-100 text-red-500 p-1 rounded-full shrink-0"><X size={16} strokeWidth={3} /></div>
                                <div>
                                    <h4 className="font-bold text-slate-800 text-lg">Long-Term Contracts</h4>
                                    <p className="text-slate-500 text-sm mt-1">Locked into 1-3 year agreements with strict cancellation penalties.</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* TekTrakker */}
                    <div className="bg-slate-900 rounded-[2rem] border border-slate-700 p-8 shadow-2xl relative overflow-hidden transform md:-translate-y-4 md:scale-105 z-10">
                        <div className="absolute top-0 right-0 p-32 bg-indigo-500/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
                        <div className="absolute top-0 inset-x-0 h-2 bg-gradient-to-r from-indigo-500 via-primary-500 to-emerald-500"></div>
                        
                        <div className="absolute top-8 right-8 bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-1 shadow-[0_0_15px_rgba(99,102,241,0.2)]">
                            <Shield size={12} /> Partner Model
                        </div>

                        <div className="relative z-10">
                            <h3 className="text-3xl font-black text-white mb-2 tracking-tight">TekTrakker</h3>
                            <div className="text-sm font-bold text-indigo-400 uppercase tracking-wider mb-8">The Unlimited Platform</div>
                            
                            <div className="space-y-6">
                                <div className="flex items-start gap-4">
                                    <div className="mt-1 bg-emerald-500/20 text-emerald-400 p-1 rounded-full shrink-0 shadow-[0_0_10px_rgba(52,211,153,0.3)]"><Check size={16} strokeWidth={3} /></div>
                                    <div>
                                        <h4 className="font-bold text-white text-lg flex items-center gap-2">Unlimited Users <span className="bg-indigo-600 text-white text-[9px] px-2 py-0.5 rounded-full uppercase tracking-wider">Free</span></h4>
                                        <p className="text-slate-400 text-sm mt-1">Add 5 or 50 technicians. Your software cost never goes up. We reward growth.</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-4">
                                    <div className="mt-1 bg-emerald-500/20 text-emerald-400 p-1 rounded-full shrink-0 shadow-[0_0_10px_rgba(52,211,153,0.3)]"><Check size={16} strokeWidth={3} /></div>
                                    <div>
                                        <h4 className="font-bold text-white text-lg">Zero Implementation Fees</h4>
                                        <p className="text-slate-400 text-sm mt-1">Free onboarding, free data migration, and free 1-on-1 team training.</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-4">
                                    <div className="mt-1 bg-emerald-500/20 text-emerald-400 p-1 rounded-full shrink-0 shadow-[0_0_10px_rgba(52,211,153,0.3)]"><Check size={16} strokeWidth={3} /></div>
                                    <div>
                                        <h4 className="font-bold text-white text-lg">Everything Included</h4>
                                        <p className="text-slate-400 text-sm mt-1">AI Quoting, Smart Dispatching, Inventory, and CRM. No tiered feature paywalls.</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-4">
                                    <div className="mt-1 bg-emerald-500/20 text-emerald-400 p-1 rounded-full shrink-0 shadow-[0_0_10px_rgba(52,211,153,0.3)]"><Check size={16} strokeWidth={3} /></div>
                                    <div>
                                        <h4 className="font-bold text-white text-lg">No Contracts</h4>
                                        <p className="text-slate-400 text-sm mt-1">Month-to-month. If we aren't delivering massive ROI, you can leave anytime.</p>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="mt-8 pt-6 border-t border-slate-700/50">
                                <a href="https://app.tektrakker.com/login?view=register_business" className="block w-full text-center bg-white text-slate-900 font-black py-4 rounded-xl hover:bg-indigo-50 transition-colors shadow-xl cursor-pointer text-lg">
                                    Start Your Free Trial
                                </a>
                                <p className="text-center text-xs text-slate-500 mt-4 flex items-center justify-center gap-1 font-medium">
                                    <Zap size={12} className="text-amber-400" /> Instant access. No credit card required.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

            </div>
        </section>
    );
};

export default TransparentPricingSection;
