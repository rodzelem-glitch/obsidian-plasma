import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Bot, Sparkles, Zap, Shield, ArrowRight, CheckCircle, Infinity, Clock, DollarSign, Calendar, Package, FileText } from 'lucide-react';
import { Logo } from '../../components/ui/Logo';
import LandingChatbot from '../../components/LandingChatbot';

const VirtualWorkerMarketing: React.FC = () => {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-indigo-500 selection:text-white pb-20">
            {/* Navbar */}
            <nav className="border-b border-slate-200 backdrop-blur-md fixed w-full z-50 bg-white/80">
                <div className="max-w-7xl mx-auto px-6 h-24 flex justify-between items-center">
                    <div className="flex items-center cursor-pointer" onClick={() => navigate('/')}>
                        <Logo className="h-14 w-auto text-indigo-600" />
                    </div>
                    <div className="flex gap-4 items-center">
                        <button onClick={() => navigate('/login?view=login')} className="bg-indigo-100 hover:bg-indigo-200 text-indigo-700 border border-indigo-200 text-sm font-black px-4 md:px-8 py-3 rounded-full transition-all shadow-sm">
                            Login
                        </button>
                    </div>
                </div>
            </nav>

            <header className="pt-40 pb-20 px-6 relative overflow-hidden">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-indigo-600/10 rounded-full blur-[120px] -z-10" />
                <div className="max-w-7xl mx-auto text-center relative z-10">
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-50 border border-indigo-200 mb-8 animate-fade-in">
                        <Sparkles size={16} className="text-indigo-600" />
                        <span className="text-xs font-bold text-indigo-700 uppercase tracking-widest">Next Generation AI Platform</span>
                    </div>
                    <h1 className="text-5xl md:text-7xl font-black tracking-tight mb-8 leading-tight text-slate-900 mx-auto max-w-4xl">
                        Meet Your Newest <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600">Operations Manager.</span>
                    </h1>
                    <p className="text-xl text-slate-600 max-w-2xl mx-auto mb-10 leading-relaxed font-medium">
                        Hire the Virtual Worker Add-On. It works 24/7/365, never takes a sick day, understands your entire database instantly, and costs less than your daily coffee.
                    </p>
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mx-auto">
                        <button disabled className="h-16 px-10 rounded-2xl bg-indigo-600/50 text-white/50 font-black text-lg cursor-not-allowed flex items-center justify-center gap-2">
                            Coming Soon to TekTrakker <Clock size={20} />
                        </button>
                        <button onClick={() => navigate('/ai-worker-commands')} className="h-16 px-10 rounded-2xl bg-white text-indigo-600 border-2 border-indigo-100 hover:border-indigo-300 hover:bg-slate-50 font-black text-lg transition-all flex items-center justify-center gap-2 shadow-sm">
                            What can I tell my agent? <ArrowRight size={20} />
                        </button>
                    </div>
                </div>

                <div className="mt-20 max-w-5xl mx-auto relative perspective-1000">
                    <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500/20 to-purple-500/20 transform rotate-2 rounded-[3rem] blur-2xl"></div>
                    <div className="bg-white border border-slate-200 rounded-3xl shadow-2xl overflow-hidden relative z-10 w-full flex flex-col md:flex-row">
                        <div className="p-8 md:p-12 md:w-1/2 bg-slate-900 text-white flex flex-col justify-center">
                            <Bot size={48} className="text-indigo-400 mb-6" />
                            <h3 className="text-3xl font-black mb-4 tracking-tight">Chat with your business data, instantly.</h3>
                            <p className="text-slate-400 text-lg leading-relaxed mb-6">
                                The Virtual Worker has complete contextual memory of your operations. Ask it to find jobs, analyze revenue, summarize client histories, or rewrite emails.
                            </p>
                            <div className="space-y-4">
                                <div className="flex items-start gap-3 bg-slate-800/50 p-4 rounded-xl border border-slate-700">
                                    <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center shrink-0">
                                        <Bot size={16} className="text-indigo-400" />
                                    </div>
                                    <p className="text-sm font-medium">"I found 14 overdue invoices assigned to John Smith totaling $4,250. Should I draft a follow-up email?"</p>
                                </div>
                            </div>
                        </div>
                        <div className="p-8 md:p-12 md:w-1/2 bg-white flex flex-col justify-center space-y-8">
                            <div className="flex items-start gap-4">
                                <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0"><Zap size={24} /></div>
                                <div>
                                    <h4 className="font-bold text-lg text-slate-900 mb-1">Instant Answers</h4>
                                    <p className="text-slate-600 text-sm">Stop digging through endless menus. Just ask questions naturally.</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-4">
                                <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0"><Shield size={24} /></div>
                                <div>
                                    <h4 className="font-bold text-lg text-slate-900 mb-1">Secure & Private</h4>
                                    <p className="text-slate-600 text-sm">Your data never leaves your environment. It only reads what it absolutely needs.</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-4">
                                <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0"><Infinity size={24} /></div>
                                <div>
                                    <h4 className="font-bold text-lg text-slate-900 mb-1">Infinite Context</h4>
                                    <p className="text-slate-600 text-sm">Understands complex queries comparing jobs, customers, technicians, and timelines holistically.</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            <section className="py-24 px-6 bg-slate-100">
                <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-center gap-8 mb-16">
                    <img src="/mascot.png" alt="AI Mascot" className="w-40 h-40 object-contain filter drop-shadow-xl shrink-0" />
                    <div className="text-center md:text-left">
                        <h2 className="text-4xl font-black text-slate-900 mb-4">What can your Virtual Worker do?</h2>
                        <p className="text-xl text-slate-600 max-w-xl mx-auto md:mx-0">It's like having an administrative assistant looking at your screen, ready to help within milliseconds.</p>
                    </div>
                </div>
                
                <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
                    {[
                        { icon: DollarSign, title: "Financial Analysis", desc: "Ask 'How much revenue did we generate last month in Zip Code 90210?' and get instant calculations without exporting spreadsheets." },
                        { icon: Clock, title: "Efficiency Tracking", desc: "Notice exactly which technicians are consistently running behind schedule or taking longest on HVAC diagnostics." },
                        { icon: Bot, title: "Drafting & Comms", desc: "Draft highly personalized emails, SMS follow-ups, or proposal templates perfectly tailored to the requested job's context." },
                        { icon: Calendar, title: "Autonomous Scheduling", desc: "Book new jobs, assign the right technicians based on their current workload, and optimize routes without lifting a finger." },
                        { icon: Package, title: "Inventory Oversight", desc: "Check stock levels across all your vehicles and warehouses, or have the AI automatically draft purchase orders when parts run low." },
                        { icon: FileText, title: "Instant Invoicing", desc: "Generate and email invoices with secure payment links the exact second a technician marks a job as complete." }
                    ].map((feature, idx) => (
                        <div key={idx} className="bg-white rounded-3xl p-8 border border-slate-200 shadow-xl hover:-translate-y-2 transition-transform duration-300">
                            <div className="w-14 h-14 bg-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center mb-6">
                                <feature.icon size={28} />
                            </div>
                            <h3 className="text-2xl font-bold text-slate-900 mb-3">{feature.title}</h3>
                            <p className="text-slate-600 leading-relaxed">{feature.desc}</p>
                        </div>
                    ))}
                </div>
                
                <div className="text-center mt-16 w-full">
                    <h3 className="text-4xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600 drop-shadow-sm tracking-tight pb-2">And So Much More!</h3>
                </div>
            </section>
            
            <section className="py-20 px-6 bg-slate-900 text-white relative">
                <div className="max-w-5xl mx-auto text-center">
                    <h2 className="text-4xl font-black mb-6 tracking-tight">Transparent AI Pricing.</h2>
                    <p className="text-xl text-slate-400 mb-12 max-w-2xl mx-auto">
                        Hire your dedicated Virtual Worker for a flat monthly base rate, then seamlessly scale your operations using affordable usage tokens. No hidden fees.
                    </p>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
                        <div className="bg-slate-800 border border-slate-700 p-8 rounded-3xl shadow-2xl text-left flex flex-col relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-4 opacity-10">
                                <Bot size={120} />
                            </div>
                            <h3 className="text-2xl font-black text-white mb-2 relative z-10">Virtual Worker Add-On</h3>
                            <p className="text-slate-400 text-sm mb-6 flex-1 relative z-10">Unlocks the autonomous AI agent on your dashboard. Includes all routing, routing access, and contextual system memory.</p>
                            <div className="mt-auto relative z-10">
                                <p className="text-5xl font-black text-indigo-400 mb-2">$199<span className="text-xl text-slate-500">/mo</span></p>
                                <p className="text-emerald-400 text-sm font-bold flex items-center gap-1"><CheckCircle size={14}/> Base Capability</p>
                            </div>
                        </div>

                        <div className="bg-slate-800 border border-slate-700 p-8 rounded-3xl shadow-2xl text-left flex flex-col relative overflow-hidden">
                            <h3 className="text-2xl font-black text-white mb-2 relative z-10">AI Power Packs</h3>
                            <p className="text-slate-400 text-sm mb-6 flex-1 relative z-10">Instead of auto-billing you for forced overages, simply buy tokens. 1 Token ≈ a few words or pixels of processing power.</p>
                            <div className="mt-auto flex items-end justify-between border-t border-slate-700 pt-6 relative z-10">
                                <div>
                                    <p className="text-slate-300 font-bold mb-1">1,000,000 Tokens</p>
                                    <p className="text-emerald-400 text-sm font-bold flex items-center gap-1"><CheckCircle size={14}/> No auto-overcharges</p>
                                </div>
                                <p className="text-4xl font-black text-indigo-400">$10</p>
                            </div>
                        </div>
                    </div>
                    
                    <p className="text-slate-500 mt-10 text-sm max-w-2xl mx-auto">
                        If you run out of tokens, the Virtual Worker simply rests and pauses autonomous tasks until you purchase another Power Pack from your dashboard. Complete billing safely via Stripe or PayPal.
                    </p>
                </div>
            </section>

            <section className="py-24 px-6 relative bg-white overflow-hidden">
                <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-stretch justify-center gap-12">
                    <div className="flex-1 flex flex-col items-center md:items-start text-center md:text-left justify-center">
                        <h2 className="text-4xl md:text-5xl font-black text-slate-900 mb-6 leading-tight">Stop paying $20/hr for data entry.</h2>
                        <p className="text-xl text-slate-600 mb-10 leading-relaxed max-w-lg">
                            The Virtual Worker Add-On is priced on a highly scalable, usage-based model. You only pay for what you use using "tokens". 
                            The more your business scales, the more affordable your AI backbone becomes.
                        </p>
                        <div className="flex flex-col items-center md:items-start w-full">
                            <button disabled className="h-16 px-12 rounded-2xl bg-slate-200 text-slate-500 font-black text-xl flex items-center justify-center gap-2 cursor-not-allowed">
                                Coming Soon to TekTrakker <Clock size={22} />
                            </button>
                            <p className="mt-6 text-sm text-slate-400 font-bold uppercase tracking-widest flex items-center">Join the waitlist to receive access</p>
                        </div>
                    </div>
                    <div className="md:w-64 shrink-0 hidden md:flex items-center justify-center">
                        <img src="/mascot.png" alt="AI Mascot" className="max-h-[380px] h-full object-contain filter drop-shadow-[0_0_20px_rgba(99,102,241,0.3)] hover:-translate-y-2 transition-transform duration-500" />
                    </div>
                    <div className="w-full md:hidden flex justify-center mt-8">
                        <img src="/mascot.png" alt="AI Mascot" className="h-64 object-contain filter drop-shadow-xl" />
                    </div>
                </div>
            </section>

            <LandingChatbot />
        </div>
    );
};

export default VirtualWorkerMarketing;
