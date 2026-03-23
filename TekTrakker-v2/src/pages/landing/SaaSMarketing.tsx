
import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
    Zap, Shield, BarChart3, Smartphone, 
    CheckCircle, ArrowRight, Play, Cpu, Users, DollarSign,
    Heart, Clock, TrendingUp, Layers, MapPin, Star, X, Mail,
    UserCircle, Wrench, Layout, HandCoins
} from 'lucide-react';
import { Logo } from '../../components/ui/Logo';
import { useAppContext } from 'context/AppContext';
import LandingChatbot from '../../components/LandingChatbot';

const ROICalculator = () => {
    const [techs, setTechs] = useState(5);
    const [jobsPerDay, setJobsPerDay] = useState(3);
    const [avgTicket, setAvgTicket] = useState(350);

    const weeklyExtraJobs = techs * 1; 
    const monthlyExtraRevenueJobs = weeklyExtraJobs * avgTicket * 4;
    
    const monthlyUpsellRevenue = (techs * jobsPerDay * 20) * (avgTicket * 0.15);
    const totalMonthlyGain = monthlyExtraRevenueJobs + monthlyUpsellRevenue;

    return (
        <div className="bg-slate-900 rounded-3xl p-4 md:p-8 border border-white/10 shadow-2xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-32 bg-primary-600/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:bg-primary-600/30 transition-all duration-700"></div>
            <h3 className="text-2xl font-black text-white mb-2 flex items-center gap-2 relative z-10">
                <DollarSign className="text-emerald-400" /> Your Potential Growth
            </h3>
            <p className="text-slate-400 text-sm mb-6 relative z-10">See how much money you're leaving on the table.</p>
            
            <div className="space-y-6 mb-8 relative z-10">
                <div>
                    <label className="flex justify-between text-sm font-bold text-slate-400 mb-2">
                        <span>Technicians on the road</span>
                        <span className="text-white">{techs}</span>
                    </label>
                    <input type="range" min="1" max="50" value={techs} onChange={e => setTechs(Number(e.target.value))} className="w-full accent-primary-500 h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer"/>
                </div>
                <div>
                    <label className="flex justify-between text-sm font-bold text-slate-400 mb-2">
                        <span>Avg Jobs / Day</span>
                        <span className="text-white">{jobsPerDay}</span>
                    </label>
                    <input type="range" min="1" max="8" value={jobsPerDay} onChange={e => setJobsPerDay(Number(e.target.value))} className="w-full accent-primary-500 h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer"/>
                </div>
                <div>
                    <label className="flex justify-between text-sm font-bold text-slate-400 mb-2">
                        <span>Avg Ticket Size ($)</span>
                        <span className="text-white">${avgTicket}</span>
                    </label>
                    <input type="range" min="100" max="2000" step="50" value={avgTicket} onChange={e => setAvgTicket(Number(e.target.value))} className="w-full accent-primary-500 h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer"/>
                </div>
            </div>

            <div className="bg-gradient-to-br from-emerald-600 to-emerald-800 rounded-2xl p-6 text-center relative z-10 shadow-lg transform hover:scale-[1.02] transition-transform">
                <p className="text-emerald-100 text-sm font-bold uppercase tracking-widest mb-1">Recovered Monthly Revenue</p>
                <p className="text-4xl md:text-5xl font-black text-white tracking-tight">
                    +${totalMonthlyGain.toLocaleString(undefined, {maximumFractionDigits: 0})}
                </p>
                <p className="text-xs text-emerald-200 mt-2 opacity-80">
                    *Don't let inefficiency steal this from you.
                </p>
            </div>
        </div>
    );
};

interface SupportModalProps {
    onClose: () => void;
    onSubmit: (formData: { name: string; email: string; message: string }) => Promise<void>;
}

const SupportModal: React.FC<SupportModalProps> = ({ onClose, onSubmit }) => {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [message, setMessage] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSubmitted, setIsSubmitted] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        
        try {
            await onSubmit({ name, email, message });
            setIsSubmitted(true);
        } catch (error) {
            console.error("Support form submission error:", error);
            alert("There was an error sending your message. Please try again.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
            <div className="w-full max-w-lg bg-slate-900 rounded-3xl shadow-2xl border border-white/10 relative">
                <button 
                    onClick={onClose} 
                    className="absolute top-4 right-4 text-white/50 hover:text-white transition-colors p-2 bg-white/10 rounded-full"
                >
                    <X size={24} />
                </button>
                
                <div className="p-4 md:p-10">
                    {isSubmitted ? (
                        <div className="text-center py-10">
                            <CheckCircle className="text-emerald-500 w-16 h-16 mx-auto mb-4" />
                            <h3 className="text-2xl font-black text-white mb-2">Message Sent!</h3>
                            <p className="text-slate-400">Thanks for reaching out. We'll get back to you at {email} within 24 hours.</p>
                            <button
                                onClick={onClose}
                                className="mt-8 bg-primary-600 hover:bg-primary-500 text-white font-bold px-4 md:px-8 py-3 rounded-full transition-all"
                            >
                                Close
                            </button>
                        </div>
                    ) : (
                        <>
                            <h3 className="text-2xl font-black text-white mb-2 flex items-center gap-3">
                                <Mail className="text-primary-400" />
                                Contact Support
                            </h3>
                            <p className="text-slate-400 text-sm mb-8">Have a question or need help? Send us a message.</p>
                            
                            <form onSubmit={handleSubmit} className="space-y-5">
                                <div>
                                    <label className="text-xs font-bold text-slate-400">Your Name</label>
                                    <input 
                                        type="text"
                                        value={name}
                                        onChange={e => setName(e.target.value)}
                                        required
                                        className="w-full mt-1 bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-400">Your Email</label>
                                    <input 
                                        type="email"
                                        value={email}
                                        onChange={e => setEmail(e.target.value)}
                                        required
                                        className="w-full mt-1 bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-400">Message</label>
                                    <textarea
                                        value={message}
                                        onChange={e => setMessage(e.target.value)}
                                        required
                                        rows={4}
                                        className="w-full mt-1 bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                                    ></textarea>
                                </div>
                                <button 
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="w-full py-4 rounded-lg bg-primary-600 text-white font-bold hover:bg-primary-500 transition-all shadow-lg shadow-primary-500/25 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isSubmitting ? 'Sending...' : 'Send Message'}
                                </button>
                            </form>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};


const SaaSMarketing: React.FC = () => {
    const navigate = useNavigate();
    const { state, startDemo } = useAppContext();
    const [showSupportModal, setShowSupportModal] = useState(false);
    const [showDemoOptions, setShowDemoOptions] = useState(false);

    const handleSupportSubmit = async (formData: { name: string; email: string; message: string }) => {
        // Mock submission
        await new Promise(resolve => setTimeout(resolve, 1500));
    };

    return (
        <div className="min-h-screen bg-slate-950 text-white font-sans selection:bg-primary-500 selection:text-white">
            {/* Navbar */}
            <nav className="border-b border-white/5 backdrop-blur-md fixed w-full z-50 bg-slate-950/80">
                <div className="max-w-7xl mx-auto px-6 h-24 flex justify-between items-center">
                    <div className="flex items-center cursor-pointer" onClick={() => navigate('/')}><Logo className="h-14 w-auto" /></div>
                    <div className="flex gap-4 items-center">
                        <button onClick={() => navigate('/login')} className="text-sm font-bold text-slate-300 hover:text-white hidden sm:block">Login</button>
                        <button onClick={() => setShowDemoOptions(true)} className="bg-primary-600 hover:bg-primary-500 text-white text-sm font-black px-4 md:px-8 py-3 rounded-full transition-all shadow-lg hover:shadow-xl hover:scale-105">Free Interactive Demo</button>
                        <button onClick={() => navigate('/login?view=register_business')} className="bg-green-600 hover:bg-green-500 text-white text-sm font-black px-4 md:px-8 py-3 rounded-full transition-all shadow-lg hover:shadow-xl hover:scale-105">Start Your Free Trial</button>
                    </div>
                </div>
            </nav>

            {/* DEMO OPTIONS MODAL */}
            {showDemoOptions && (
                <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
                    <div className="w-full max-w-4xl bg-slate-900 rounded-[2.5rem] border border-white/10 p-4 md:p-8 md:p-12 relative shadow-2xl">
                        <button onClick={() => setShowDemoOptions(false)} className="absolute top-6 right-6 text-white/50 hover:text-white p-2 bg-white/5 rounded-full transition-colors"><X size={32}/></button>
                        <div className="text-center mb-10">
                            <h2 className="text-3xl md:text-4xl font-black mb-4">Choose Your Experience</h2>
                            <p className="text-slate-400">Explore TekTrakker from any perspective. No login required.</p>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {[
                                { role: 'admin', icon: Shield, label: 'View as Admin', color: 'bg-indigo-600', desc: 'Dispatch & Ops' },
                                { role: 'employee', icon: Wrench, label: 'View as Technician', color: 'bg-emerald-600', desc: 'Field App Flow' },
                                { role: 'customer', icon: Users, label: 'View as Customer', color: 'bg-orange-600', desc: 'Self-Service Portal' }
                            ].map((opt) => (
                                <button key={opt.role} onClick={() => startDemo(opt.role as any)} className="p-6 rounded-3xl bg-slate-800 border border-white/5 hover:border-primary-500 transition-all text-left group flex flex-col h-full hover:bg-slate-800">
                                    <div className={`w-12 h-12 rounded-2xl ${opt.color} flex items-center justify-center mb-6 group-hover:scale-110 transition-transform shadow-lg`}><opt.icon size={24} /></div>
                                    <h4 className="font-bold text-lg mb-2">{opt.label}</h4>
                                    <p className="text-xs text-slate-400 leading-relaxed mb-6 flex-1">{opt.desc}</p>
                                    <div className="flex items-center gap-2 text-xs font-black uppercase text-primary-400 group-hover:gap-4 transition-all">Launch Demo <ArrowRight size={14}/></div>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}
            
            {showSupportModal && <SupportModal onClose={() => setShowSupportModal(false)} onSubmit={handleSupportSubmit} />}
            
            <header className="pt-40 pb-20 px-6 relative overflow-hidden">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-primary-600/20 rounded-full blur-[120px] -z-10" />
                <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
                    <div>
                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-900/30 border border-blue-500/30 mb-8 animate-fade-in"><span className="flex h-2 w-2 rounded-full bg-blue-400 animate-pulse"></span><span className="text-xs font-bold text-blue-300 uppercase tracking-widest">Reclaim Your Evenings</span></div>
                        <h1 className="text-5xl md:text-7xl font-black tracking-tight mb-8 leading-tight">Stop Being a Slave to <br /><span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-400 to-indigo-400">Paperwork.</span></h1>
                        <p className="text-xl text-slate-400 max-w-xl mb-10 leading-relaxed font-medium">You didn't start a business to work 16 hours a day. TekTrakker eliminates the chaos of scheduling, chasing payments, and managing techs so you can finally breathe.</p>
                        <div className="flex flex-col sm:flex-row gap-4">
                            <button onClick={() => setShowDemoOptions(true)} className="h-16 px-10 rounded-2xl bg-primary-600 text-white font-black text-lg hover:bg-primary-50 transition-all shadow-lg shadow-primary-600/20 hover:scale-105 flex items-center justify-center gap-2">Start Exploring Now <ArrowRight size={20} /></button>
                        </div>
                        <p className="mt-6 text-sm text-slate-500 font-medium"><span className="text-emerald-400">✓</span> 14-Day Free Trial &nbsp;<span className="text-emerald-400">✓</span> Cancel anytime</p>
                    </div>
                    <div className="relative"><ROICalculator /></div>
                </div>
            </header>

            <section className="py-20 px-6 bg-slate-900">
                <div className="max-w-7xl mx-auto text-center">
                    <h2 className="text-4xl font-black text-white mb-4">Streamline Your Entire Operation</h2>
                    <p className="text-xl text-slate-400 max-w-2xl mx-auto mb-16">TekTrakker offers an all-in-one platform to manage every aspect of your service business, from first contact to final payment.</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12">
                        <div className="bg-slate-800/50 p-4 md:p-8 rounded-2xl border border-white/10 text-left transform hover:scale-[1.02] transition-transform shadow-lg"><Zap className="text-primary-400 mb-4" size={36} /><h3 className="text-2xl font-bold text-white mb-2">Effortless Scheduling & Dispatch</h3><p className="text-slate-400">Drag-and-drop job scheduling, automated dispatching, and real-time technician tracking keep your team on track and your customers informed.</p></div>
                        <div className="bg-slate-800/50 p-4 md:p-8 rounded-2xl border border-white/10 text-left transform hover:scale-[1.02] transition-transform shadow-lg"><Shield className="text-green-400 mb-4" size={36} /><h3 className="text-2xl font-bold text-white mb-2">Automated Invoicing & Payments</h3><p className="text-slate-400">Generate professional invoices, accept online payments, and automate follow-ups to get paid faster with less hassle.</p></div>
                        <div className="bg-slate-800/50 p-4 md:p-8 rounded-2xl border border-white/10 text-left transform hover:scale-[1.02] transition-transform shadow-lg"><BarChart3 className="text-purple-400 mb-4" size={36} /><h3 className="text-2xl font-bold text-white mb-2">Powerful Analytics & Reporting</h3><p className="text-slate-400">Gain insights into your business performance with customizable dashboards, revenue tracking, and technician efficiency reports.</p></div>
                        <div className="bg-slate-800/50 p-4 md:p-8 rounded-2xl border border-white/10 text-left transform hover:scale-[1.02] transition-transform shadow-lg"><Smartphone className="text-orange-400 mb-4" size={36} /><h3 className="text-2xl font-bold text-white mb-2">Mobile App for Technicians</h3><p className="text-slate-400">Empower your field team with a dedicated mobile app for job details, checklists, time tracking, and on-site invoicing.</p></div>
                        <div className="bg-slate-800/50 p-4 md:p-8 rounded-2xl border border-white/10 text-left transform hover:scale-[1.02] transition-transform shadow-lg"><Users className="text-cyan-400 mb-4" size={36} /><h3 className="text-2xl font-bold text-white mb-2">Customer Management</h3><p className="text-slate-400">Keep all customer information, service history, and communication logs in one place for personalized service.</p></div>
                        <div className="bg-slate-800/50 p-4 md:p-8 rounded-2xl border border-white/10 text-left transform hover:scale-[1.02] transition-transform shadow-lg"><Cpu className="text-pink-400 mb-4" size={36} /><h3 className="text-2xl font-bold text-white mb-2">AI-Powered Estimating</h3><p className="text-slate-400">Generate accurate quotes and proposals faster with our intelligent estimating tools that learn from your data.</p></div>
                    </div>
                </div>
            </section>

            <section className="py-20 px-6 relative overflow-hidden">
                <div className="max-w-4xl mx-auto text-center">
                    <Star className="text-yellow-400 w-12 h-12 mx-auto mb-6" fill="currentColor" />
                    <blockquote className="text-3xl md:text-4xl font-black text-white leading-tight mb-8">"TekTrakker has revolutionized how we do business. We've cut admin time by 50% and increased our monthly revenue by 20% in just six months."</blockquote>
                    <p className="text-lg font-bold text-primary-300">Sarah Chen, CEO of <span className="text-white">UrbanScape Landscaping</span></p>
                </div>
            </section>

            <section className="py-20 px-6 bg-slate-900">
                <div className="max-w-7xl mx-auto"><h2 className="text-4xl font-black text-white text-center mb-16">How TekTrakker Gives You Back Your Life</h2>
                <div className="relative">
                        <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-white/10 transform -translate-x-1/2 hidden lg:block"></div>
                        
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-16 gap-y-12 items-center">
                            {/* Step 1 */}
                            <div className="flex flex-col lg:flex-row items-start lg:items-center gap-6">
                                <div className="flex-shrink-0 w-16 h-16 bg-primary-600 rounded-full flex items-center justify-center text-3xl font-black shadow-lg">
                                    <span className="text-white">1</span>
                                </div>
                                <div className="lg:text-left">
                                    <h3 className="text-2xl font-bold text-white mb-2">Simple Job Creation</h3>
                                    <p className="text-slate-400">
                                        Easily create new jobs, add customer details, notes, and required services in minutes. Our intuitive interface makes it a breeze.
                                    </p>
                                </div>
                            </div>
                            <div className="hidden lg:block"></div> {/* Placeholder for alignment */}

                            {/* Step 2 */}
                            <div className="hidden lg:block"></div> {/* Placeholder for alignment */}
                            <div className="flex flex-col lg:flex-row-reverse items-start lg:items-center gap-6">
                                <div className="flex-shrink-0 w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center text-3xl font-black shadow-lg">
                                    <span className="text-white">2</span>
                                </div>
                                <div className="lg:text-right">
                                    <h3 className="text-2xl font-bold text-white mb-2">Smart Scheduling & Dispatch</h3>
                                    <p className="text-slate-400">
                                        Assign jobs to the right technicians, optimize routes, and dispatch with a click. Technicians get instant updates on their mobile app.
                                    </p>
                                </div>
                            </div>

                            {/* Step 3 */}
                            <div className="flex flex-col lg:flex-row items-start lg:items-center gap-6">
                                <div className="flex-shrink-0 w-16 h-16 bg-green-600 rounded-full flex items-center justify-center text-3xl font-black shadow-lg">
                                    <span className="text-white">3</span>
                                </div>
                                <div className="lg:text-left">
                                    <h3 className="text-2xl font-bold text-white mb-2">On-Site Completion & Invoicing</h3>
                                    <p className="text-slate-400">
                                        Technicians complete checklists, capture signatures, and generate invoices directly from the field. Collect payments instantly.
                                    </p>
                                </div>
                            </div>
                            <div className="hidden lg:block"></div> {/* Placeholder for alignment */}

                            {/* Step 4 */}
                            <div className="hidden lg:block"></div> {/* Placeholder for alignment */}
                            <div className="flex flex-col lg:flex-row-reverse items-start lg:items-center gap-6">
                                <div className="flex-shrink-0 w-16 h-16 bg-purple-600 rounded-full flex items-center justify-center text-3xl font-black shadow-lg">
                                    <span className="text-white">4</span>
                                </div>
                                <div className="lg:text-right">
                                    <h3 className="text-2xl font-bold text-white mb-2">Automated Follow-ups & Reviews</h3>
                                    <p className="text-slate-400">
                                        TekTrakker handles post-service communications, sends reminders, and solicits customer reviews to boost your reputation.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Call to Action */}
            <section className="py-20 px-6 text-center">
                <div className="max-w-3xl mx-auto">
                    <h2 className="text-4xl md:text-5xl font-black text-white mb-6 leading-tight">Ready to Stop Drowning in Paperwork?</h2>
                    <p className="text-xl text-slate-400 mb-10">Join hundreds of service businesses who are reclaiming their time and scaling their operations with TekTrakker.</p>
                    <button onClick={() => navigate('/login?view=register_business')} className="h-16 px-12 rounded-2xl bg-primary-600 text-white font-black text-xl hover:bg-primary-50 transition-all shadow-lg shadow-primary-600/20 hover:scale-105 flex items-center justify-center gap-2 mx-auto">Start Your Free 14-Day Trial <ArrowRight size={22} /></button>
                </div>
            </section>
            
            <footer className="bg-slate-950 border-t border-white/5 py-12 px-6">
                <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
                    <div className="flex items-center gap-2 opacity-50 grayscale hover:grayscale-0 transition-all"><Logo className="h-8 w-auto" /></div>
                    <div className="flex gap-8 text-sm text-slate-500 font-medium">
                        <a href="/#/privacy" className="hover:text-white transition-colors">Privacy Policy</a>
                        <a href="/#/terms" className="hover:text-white transition-colors">Terms of Service</a>
                        <button onClick={() => setShowSupportModal(true)} className="hover:text-white transition-colors">Support</button>
                    </div>
                    <div className="text-slate-600 text-xs font-medium">&copy; 2025 TekTrakker Inc. All rights reserved.</div>
                </div>
            </footer>

            <LandingChatbot />
        </div>
    );
};

export default SaaSMarketing;
