import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, CheckCircle2, Shield, Zap, Lock, PlayCircle, Star } from 'lucide-react';

const SaaSCheckoutFunnel: React.FC = () => {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen bg-[#0a0f1c] text-white font-sans selection:bg-blue-500/30">
            {/* Minimal Header */}
            <header className="p-6 border-b border-white/5 bg-black/20 backdrop-blur-md sticky top-0 z-50">
                <div className="max-w-6xl mx-auto flex justify-between items-center">
                    <div className="font-black text-2xl tracking-tighter text-white flex items-center gap-2">
                        <Zap size={24} className="text-blue-500" /> TekTrakker
                    </div>
                    <div className="flex items-center gap-4 text-sm font-medium text-slate-400">
                        <Lock size={16} /> Secure Checkout
                    </div>
                </div>
            </header>

            <main className="max-w-5xl mx-auto px-4 py-16 md:py-24">
                
                {/* VSL Hero Section */}
                <div className="text-center mb-16">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 text-blue-400 text-xs font-bold uppercase tracking-widest mb-6">
                        Limited Time Offer
                    </div>
                    <h1 className="text-5xl md:text-7xl font-black tracking-tight mb-8 leading-tight">
                        Stop Losing Money To <br/> <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">Inefficient Workflows.</span>
                    </h1>
                    <p className="text-xl text-slate-400 max-w-2xl mx-auto mb-12">
                        Watch this short 3-minute video to see exactly how TekTrakker automatically closes your open estimates, tracks your fleet, and scales your service business overnight.
                    </p>

                    {/* VSL Video Container */}
                    <div className="w-full max-w-4xl mx-auto aspect-video bg-slate-900 rounded-3xl border border-white/10 shadow-2xl relative overflow-hidden group cursor-pointer flex items-center justify-center mb-16">
                        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1581092160562-40aa08e78837?ixlib=rb-4.0.3&auto=format&fit=crop&w=2000&q=80')] bg-cover bg-center opacity-40 mix-blend-overlay group-hover:scale-105 transition-transform duration-1000"></div>
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-transparent"></div>
                        <button title="Play Video" aria-label="Play Video" className="relative z-10 w-24 h-24 bg-blue-600 rounded-full flex items-center justify-center shadow-[0_0_50px_rgba(37,99,235,0.5)] group-hover:bg-blue-500 transition-all group-hover:scale-110">
                            <PlayCircle size={48} className="text-white ml-2" />
                        </button>
                    </div>
                </div>

                {/* Split Content: Pitch & Checkout Form */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-24 items-start">
                    
                    {/* Left Column: Value Prop */}
                    <div className="lg:col-span-7 space-y-12">
                        <div>
                            <h2 className="text-3xl font-bold mb-6">Everything You Need To Scale</h2>
                            <div className="space-y-4">
                                {[
                                    "Automated Omnichannel Reminders (Email & SMS)",
                                    "GPS Fleet & Technician Routing Dashboard",
                                    "Good, Better, Best Tiered Proposal Engine",
                                    "AI-Powered Operations & Timesheet Auditing",
                                    "Built-in Customer Portal & Online Payments"
                                ].map((perk, i) => (
                                    <div key={i} className="flex items-center gap-4 bg-white/5 p-4 rounded-2xl border border-white/5">
                                        <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-full shrink-0">
                                            <CheckCircle2 size={24} />
                                        </div>
                                        <span className="text-lg font-medium text-slate-200">{perk}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Social Proof */}
                        <div className="p-8 bg-gradient-to-br from-blue-900/20 to-slate-900 rounded-3xl border border-blue-500/20">
                            <div className="flex gap-1 text-yellow-400 mb-4">
                                {[1,2,3,4,5].map(s => <Star key={s} fill="currentColor" size={20} />)}
                            </div>
                            <p className="text-xl italic text-slate-300 leading-relaxed mb-6">
                                "We deployed TekTrakker on a Monday. By Friday, the automated SMS reminders recovered $14,000 in unpaid proposals we completely forgot about. It pays for itself."
                            </p>
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-full bg-slate-700 flex items-center justify-center font-bold">JD</div>
                                <div>
                                    <div className="font-bold text-white">John Davis</div>
                                    <div className="text-sm text-slate-400">Owner, Davis HVAC</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Checkout/Pricing Selection */}
                    <div className="lg:col-span-5 sticky top-24">
                        <div className="bg-slate-900 border border-slate-700 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-3 bg-blue-600 text-white font-bold text-xs uppercase tracking-wider rounded-bl-3xl">
                                Recommended
                            </div>
                            
                            <h3 className="text-2xl font-black mb-2">Pro Business Tier</h3>
                            <p className="text-slate-400 mb-8 pb-8 border-b border-slate-800">Unlock the entire platform immediately.</p>
                            
                            <div className="flex items-baseline gap-2 mb-8">
                                <span className="text-5xl font-black">$299</span>
                                <span className="text-slate-400">/month</span>
                            </div>

                            <button onClick={() => navigate('/register')} className="w-full py-5 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-black text-xl rounded-2xl shadow-[0_0_40px_rgba(37,99,235,0.3)] transition-all flex items-center justify-center gap-3 mb-6 hover:scale-[1.02] active:scale-[0.98]">
                                Start 14-Day Free Trial <ArrowRight size={24} />
                            </button>

                            <div className="flex items-center justify-center gap-2 text-sm text-slate-400 font-medium">
                                <Shield size={16} /> Bank-Level Stripe Encryption
                            </div>
                            
                            <div className="mt-8 space-y-3">
                                <div className="flex items-center gap-3 text-sm text-slate-300">
                                    <CheckCircle2 size={16} className="text-blue-500" /> Cancel anytime. No contracts.
                                </div>
                                <div className="flex items-center gap-3 text-sm text-slate-300">
                                    <CheckCircle2 size={16} className="text-blue-500" /> VIP Onboarding Call Included.
                                </div>
                                <div className="flex items-center gap-3 text-sm text-slate-300">
                                    <CheckCircle2 size={16} className="text-blue-500" /> 100% Data Export Guarantee.
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default SaaSCheckoutFunnel;
