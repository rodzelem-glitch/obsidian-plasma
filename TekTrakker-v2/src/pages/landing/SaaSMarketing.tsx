import showToast from "lib/toast";

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Zap, Shield, BarChart3, Smartphone,
    CheckCircle, ArrowRight, Cpu, Users, DollarSign,
    Heart, TrendingUp, Layers, MapPin, Star, X, Mail,
    UserCircle, Wrench, Layout, HandCoins, Bot, Facebook
} from 'lucide-react';
import { Logo } from '../../components/ui/Logo';
import { useAppContext } from 'context/AppContext';
import LandingChatbot from '../../components/LandingChatbot';


const AnimatedCard: React.FC<{ children: React.ReactNode; direction: 'left' | 'right'; delay?: number }> = ({ children, direction, delay = 0 }) => {
    const [isVisible, setIsVisible] = useState(false);
    const ref = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        const observer = new IntersectionObserver(([entry]) => {
            if (entry.isIntersecting) {
                setIsVisible(true);
                observer.disconnect();
            }
        }, { threshold: 0.2 });

        if (ref.current) observer.observe(ref.current);
        return () => observer.disconnect();
    }, []);

    const baseClass = "transition-all duration-1000 ease-out transform";
    const hiddenClass = direction === 'left' ? "opacity-0 -translate-x-24" : "opacity-0 translate-x-24";
    const visibleClass = "opacity-100 translate-x-0";

    return (
        <div 
            ref={ref} 
            className={`${baseClass} ${isVisible ? visibleClass : hiddenClass} transition-delay-var`} 
            style={{ '--delay': `${delay}ms` } as React.CSSProperties}
        >
            {children}
        </div>
    );
};

const MockUpdatingCharts = ({ activeTab }: { activeTab: 'layout' | 'users' | 'analytics' | 'wrench' }) => {
    const [revenue, setRevenue] = useState(42850);
    const [jobs, setJobs] = useState(18);
    const [bars, setBars] = useState([40, 60, 45, 80, 50, 75, 90]);

    React.useEffect(() => {
        const interval = setInterval(() => {
            setRevenue(prev => prev + Math.floor(Math.random() * 500) - 100);
            setJobs(prev => prev + (Math.random() > 0.7 ? 1 : 0));
            setBars(prev => {
                const newBars = [...prev.slice(1), Math.floor(Math.random() * 60) + 30];
                return newBars;
            });
        }, 3000);
        return () => clearInterval(interval);
    }, []);

    if (activeTab === 'users') {
        return (
            <div className="mb-6 h-[256px] flex flex-col gap-2">
                <div className="text-sm font-bold text-slate-500 mb-2">Team Activity</div>
                {[
                    {name: "Alice Johnson", role: "Sr. Tech", status: "On Site", color: "bg-emerald-500"},
                    {name: "Bob Smith", role: "Plumber", status: "En Route", color: "bg-blue-500"},
                    {name: "Charlie Davis", role: "Electrician", status: "Available", color: "bg-green-500"},
                    {name: "Diana Evans", role: "HVAC Tech", status: "Off Duty", color: "bg-slate-300"},
                ].map((user, i) => (
                    <div key={i} className="bg-slate-50 border border-slate-200 rounded-lg p-3 flex justify-between items-center animate-fade-in">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-xs">{user.name[0]}</div>
                            <div>
                                <div className="text-sm font-bold text-slate-900">{user.name}</div>
                                <div className="text-xs text-slate-500">{user.role}</div>
                            </div>
                        </div>
                        <div className="flex items-center gap-1">
                            <span className={`w-2 h-2 rounded-full ${user.color}`}></span>
                            <span className="text-xs font-bold text-slate-600">{user.status}</span>
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    if (activeTab === 'wrench') {
        return (
            <div className="mb-6 h-[256px] flex flex-col gap-2">
                <div className="text-sm font-bold text-slate-500 mb-2">Recent Service Calls</div>
                {[
                    {id: "SRV-1042", issue: "A/C Not Cooling", customer: "Sarah Miller", time: "10:30 AM", status: "In Progress"},
                    {id: "SRV-1043", issue: "Leaking Pipe", customer: "John Doe", time: "11:15 AM", status: "Dispatched"},
                    {id: "SRV-1044", issue: "Electrical Short", customer: "Mike Ross", time: "1:00 PM", status: "Scheduled"},
                    {id: "SRV-1045", issue: "Furnace Maintenance", customer: "Emma Watson", time: "2:30 PM", status: "Scheduled"},
                ].map((call, i) => (
                    <div key={i} className="bg-slate-50 border border-slate-200 rounded-lg p-3 flex justify-between items-center animate-fade-in">
                        <div>
                            <div className="text-sm font-bold text-slate-900">{call.issue}</div>
                            <div className="text-xs text-slate-500">{call.id} • {call.customer}</div>
                        </div>
                        <div className="text-right">
                            <div className="text-xs font-bold text-slate-700">{call.time}</div>
                            <div className="text-[10px] uppercase font-bold text-primary-600">{call.status}</div>
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    if (activeTab === 'analytics') {
        return (
            <div className="mb-6 h-[256px] flex flex-col">
                 <div className="text-sm font-bold text-slate-500 mb-2">Revenue vs Target</div>
                 <div className="flex-1 bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col justify-end gap-2 relative">
                    <div className="absolute top-4 left-4 text-2xl font-black text-slate-900">${revenue.toLocaleString()}</div>
                    <div className="absolute top-4 right-4 text-xs font-bold text-emerald-600">+24% MoM</div>
                    <div className="flex items-end gap-2 h-2/3 w-full mt-auto">
                    {bars.map((height, i) => (
                        <div 
                            key={i} 
                            className="flex-1 bg-indigo-200 rounded-t-sm relative group transition-all duration-1000 ease-in-out" 
                            style={{ height: `${height}%` } as React.CSSProperties}
                        >
                            <div 
                                className="w-full bg-indigo-500 absolute bottom-0 rounded-t-sm transition-all duration-1000" 
                                style={{ height: `${height * 0.8}%` } as React.CSSProperties}
                            ></div>
                        </div>
                    ))}
                    </div>
                 </div>
            </div>
        );
    }

    return (
        <div className="mb-6">
            <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="h-24 bg-slate-50 rounded-xl border border-slate-200 p-4 flex flex-col justify-center relative overflow-hidden">
                    <div className="absolute -right-4 -bottom-4 opacity-5"><TrendingUp size={64} className="text-slate-900" /></div>
                    <div className="text-xs text-slate-500 font-bold mb-1">Weekly Revenue</div>
                    <div className="text-2xl font-black text-slate-900 transition-all duration-1000">${revenue.toLocaleString()}</div>
                    <div className="text-xs text-emerald-600 font-bold mt-1">+12.5% this week</div>
                </div>
                <div className="h-24 bg-slate-50 rounded-xl border border-slate-200 p-4 flex flex-col justify-center relative overflow-hidden">
                    <div className="absolute -right-4 -bottom-4 opacity-5"><Zap size={64} className="text-slate-900" /></div>
                    <div className="text-xs text-slate-500 font-bold mb-1">Active Jobs</div>
                    <div className="text-2xl font-black text-slate-900 transition-all duration-1000">{jobs} Dispatched</div>
                    <div className="text-xs text-blue-600 font-bold mt-1">All techs on-time</div>
                </div>
            </div>
            
            <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 mb-6">
                <div className="flex justify-between items-center mb-4">
                    <div className="text-xs text-slate-500 font-bold">Live Performance</div>
                    <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span> <span className="text-[10px] text-emerald-600 font-bold uppercase">Live</span></div>
                </div>
                <div className="flex items-end gap-2 h-24 w-full">
                    {bars.map((height, i) => (
                        <div 
                            key={i} 
                            className="flex-1 bg-primary-200 rounded-t-sm relative group transition-all duration-1000 ease-in-out" 
                            style={{ height: `${height}%` } as React.CSSProperties}
                        >
                            <div className="absolute bottom-full mb-1 opacity-0 group-hover:opacity-100 transition-opacity w-full text-center text-[10px] font-bold text-primary-700">${(height * 150).toLocaleString()}</div>
                            <div 
                                className="w-full bg-primary-500 absolute bottom-0 rounded-t-sm transition-all duration-1000" 
                                style={{ height: `${height * 0.7}%` } as React.CSSProperties}
                            ></div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

const IntegrationsMarquee = () => {
    const integrations = [
        'QuickBooks', 'Google Local Services', 'Mailchimp', 'Zapier', 'Twilio', 'Stripe', 'Square', 'Angi', 'Yelp', 'Xero', 'Salesforce', 'HubSpot', 'Podium', 'Thumbtack', 'ServiceMagic', 'HomeAdvisor', 'Gusto'
    ];
    return (
        <div className="w-full bg-white border-y border-slate-200 py-10 overflow-hidden relative">
            <div className="max-w-7xl mx-auto px-6 mb-8">
                <p className="text-center text-sm font-bold text-slate-500 uppercase tracking-widest flex items-center justify-center gap-2">
                    <span className="w-8 h-px bg-slate-300"></span>
                    Connects seamlessly with 70+ industry-leading tools
                    <span className="w-8 h-px bg-slate-300"></span>
                </p>
            </div>
            <div className="flex w-[200%] animate-marquee">
                <div className="flex w-1/2 justify-around items-center">
                    {integrations.map((name, i) => (
                        <div key={i} className="text-xl md:text-2xl font-black text-slate-300 hover:text-slate-500 transition-colors cursor-default whitespace-nowrap mx-8">
                            {name}
                        </div>
                    ))}
                </div>
                <div className="flex w-1/2 justify-around items-center">
                    {integrations.map((name, i) => (
                        <div key={`dup-${i}`} className="text-xl md:text-2xl font-black text-slate-300 hover:text-slate-500 transition-colors cursor-default whitespace-nowrap mx-8">
                            {name}
                        </div>
                    ))}
                </div>
            </div>
            <div className="absolute top-0 left-0 w-32 md:w-64 h-full bg-gradient-to-r from-white to-transparent pointer-events-none"></div>
            <div className="absolute top-0 right-0 w-32 md:w-64 h-full bg-gradient-to-l from-white to-transparent pointer-events-none"></div>
        </div>
    );
};

const PartnerTestimonial = () => {
    return (
        <div className="max-w-5xl mx-auto my-20 px-6 animate-fade-in group cursor-pointer">
            <a href="https://tekairinc.com" target="_blank" rel="noopener noreferrer" aria-label="Visit TekAir Inc" title="Visit TekAir Inc" className="block w-full text-center p-8 md:p-12 border border-slate-200 bg-white shadow-xl rounded-[2.5rem] relative overflow-hidden transition-all hover:scale-[1.02] hover:shadow-2xl hover:border-emerald-200">
                <div className="absolute top-0 right-0 p-32 bg-emerald-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:bg-emerald-500/20 transition-all duration-700"></div>
                <div className="relative z-10 flex flex-col items-center justify-center">
                    <div className="flex gap-1 mb-6 text-yellow-400">
                        {Array(5).fill(0).map((_, i) => <Star key={i} size={28} fill="currentColor" />)}
                    </div>
                    <p className="text-xl md:text-3xl font-black text-slate-800 leading-tight mb-8 max-w-3xl">
                        "TekTrakker completely transformed how we run our operations. Our techs love the field app, and the automated billing has recovered thousands of dollars in lost revenue. It's the only operating system we trust."
                    </p>
                    <div className="flex items-center justify-center gap-6">
                        <img src="https://firebasestorage.googleapis.com/v0/b/tektrakker.firebasestorage.app/o/public_assets%2Forg-1765817997819%2Flogo_stable_1774702115808.png?alt=media&token=08c347fe-a7b0-40d9-b23f-6a2adecf63e9" alt="TekAir Inc Logo" className="h-10 md:h-14 w-auto object-contain drop-shadow-sm" />
                        <div className="hidden md:block h-10 w-px bg-slate-200"></div>
                        <div className="text-left flex flex-col justify-center">
                            <span className="font-bold text-slate-900 border-b border-transparent group-hover:border-slate-400 transition-colors">Featured Partner</span>
                            <span className="text-sm font-medium text-slate-500">Top Tier AC & Heating</span>
                        </div>
                    </div>
                </div>
            </a>
        </div>
    );
};

const ROICalculator = () => {
    const [techs, setTechs] = useState(5);
    const [jobsPerDay, setJobsPerDay] = useState(3);
    const [avgTicket, setAvgTicket] = useState(350);

    const weeklyExtraJobs = techs * 1;
    const monthlyExtraRevenueJobs = weeklyExtraJobs * avgTicket * 4;

    const monthlyUpsellRevenue = (techs * jobsPerDay * 20) * (avgTicket * 0.15);
    const totalMonthlyGain = monthlyExtraRevenueJobs + monthlyUpsellRevenue;

    return (
        <div className="bg-white rounded-3xl p-4 md:p-8 border border-slate-200 shadow-2xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-32 bg-primary-600/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:bg-primary-600/20 transition-all duration-700"></div>
            <h3 className="text-2xl font-black text-slate-900 mb-2 flex items-center gap-2 relative z-10">
                <DollarSign className="text-emerald-500" /> Your Potential Growth
            </h3>
            <p className="text-slate-500 text-sm mb-6 relative z-10">See how much money you're leaving on the table.</p>

            <div className="space-y-6 mb-8 relative z-10">
                <div>
                    <label className="flex justify-between text-sm font-bold text-slate-600 mb-2">
                        <span>Technicians on the road</span>
                        <span className="text-slate-900">{techs}</span>
                    </label>
                    <input aria-label="Technicians on the road" title="Technicians on the road" type="range" min="1" max="50" value={techs} onChange={e => setTechs(Number(e.target.value))} className="w-full accent-primary-600 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2" />
                </div>
                <div>
                    <label className="flex justify-between text-sm font-bold text-slate-600 mb-2">
                        <span>Avg Jobs / Day</span>
                        <span className="text-slate-900">{jobsPerDay}</span>
                    </label>
                    <input aria-label="Avg Jobs per Day" title="Avg Jobs per Day" type="range" min="1" max="8" value={jobsPerDay} onChange={e => setJobsPerDay(Number(e.target.value))} className="w-full accent-primary-600 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2" />
                </div>
                <div>
                    <label className="flex justify-between text-sm font-bold text-slate-600 mb-2">
                        <span>Avg Ticket Size ($)</span>
                        <span className="text-slate-900">${avgTicket}</span>
                    </label>
                    <input aria-label="Avg Ticket Size" title="Avg Ticket Size" type="range" min="100" max="2000" step="50" value={avgTicket} onChange={e => setAvgTicket(Number(e.target.value))} className="w-full accent-primary-600 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2" />
                </div>
            </div>

            <div className="bg-gradient-to-br from-emerald-100 to-emerald-200 border border-emerald-300 rounded-2xl p-6 text-center relative z-10 shadow-lg transform hover:scale-[1.02] transition-transform">
                <p className="text-emerald-800 text-sm font-bold uppercase tracking-widest mb-1">Recovered Monthly Revenue</p>
                <p className="text-4xl md:text-5xl font-black text-emerald-900 tracking-tight">
                    +${totalMonthlyGain.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </p>
                <p className="text-xs text-emerald-700 mt-2 font-medium">
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
            showToast.warn("There was an error sending your message. Please try again.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] bg-slate-900/40 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
            <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200 relative">
                <button
                    onClick={onClose}
                    aria-label="Close form"
                    title="Close form"
                    className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors p-2 bg-slate-100 rounded-full"
                >
                    <X size={24} />
                </button>

                <div className="p-4 md:p-10">
                    {isSubmitted ? (
                        <div className="text-center py-10">
                            <CheckCircle className="text-emerald-500 w-16 h-16 mx-auto mb-4" />
                            <h3 className="text-2xl font-black text-slate-900 mb-2">Message Sent!</h3>
                            <p className="text-slate-600">Thanks for reaching out. We'll get back to you at {email} within 24 hours.</p>
                            <button onClick={onClose} className="mt-8 bg-primary-600 hover:bg-primary-700 text-white font-bold px-4 md:px-8 py-3 rounded-full transition-all">Close</button>
                        </div>
                    ) : (
                        <>
                            <h3 className="text-2xl font-black text-slate-900 mb-2 flex items-center gap-3">
                                <Mail className="text-primary-600" />
                                Contact Support
                            </h3>
                            <p className="text-slate-500 text-sm mb-8">Have a question or need help? Send us a message.</p>

                            <form onSubmit={handleSubmit} className="space-y-5">
                                <div>
                                    <label htmlFor="support-name" className="text-xs font-bold text-slate-600">Your Name</label>
                                    <input
                                        id="support-name" type="text" value={name} onChange={e => setName(e.target.value)} required title="Your Name" placeholder="Your Name"
                                        className="w-full mt-1 bg-white border border-slate-300 rounded-lg px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
                                    />
                                </div>
                                <div>
                                    <label htmlFor="support-email" className="text-xs font-bold text-slate-600">Your Email</label>
                                    <input
                                        id="support-email" type="email" value={email} onChange={e => setEmail(e.target.value)} required title="Your Email" placeholder="Your Email"
                                        className="w-full mt-1 bg-white border border-slate-300 rounded-lg px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
                                    />
                                </div>
                                <div>
                                    <label htmlFor="support-message" className="text-xs font-bold text-slate-600">Message</label>
                                    <textarea
                                        id="support-message" value={message} onChange={e => setMessage(e.target.value)} required rows={4} title="Message" placeholder="Type your message here..."
                                        className="w-full mt-1 bg-white border border-slate-300 rounded-lg px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
                                    ></textarea>
                                </div>
                                <button type="submit" disabled={isSubmitting} className="w-full py-4 rounded-lg bg-primary-600 text-white font-bold hover:bg-primary-700 transition-all shadow-lg shadow-primary-500/25 disabled:opacity-50 disabled:cursor-not-allowed">
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

const TikTok = ({ size = 20, className = "" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5v3a3 3 0 0 1-3-3v11a7 7 0 1 1-7-7" />
    </svg>
);

const XLogo = ({ size = 20, className = "" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
);

const SaaSMarketing: React.FC = () => {
    const navigate = useNavigate();
    const { startDemo } = useAppContext();
    const [showSupportModal, setShowSupportModal] = useState(false);
    const [showDemoOptions, setShowDemoOptions] = useState(false);
    const [activeMockTab, setActiveMockTab] = useState<'layout' | 'users' | 'analytics' | 'wrench'>('layout');

    const handleSupportSubmit = async () => {
        // Mock submission
        await new Promise(resolve => setTimeout(resolve, 1500));
    };

    return (
        <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-primary-500 selection:text-white">
            {/* Navbar */}
            <nav className="border-b border-slate-200 backdrop-blur-md fixed w-full z-50 bg-white/80">
                <div className="max-w-7xl mx-auto px-6 h-24 flex justify-between items-center">
                    <div role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') navigate('/'); }} className="flex items-center cursor-pointer" onClick={() => navigate('/')}><Logo className="h-14 w-auto text-primary-600" /></div>
                    <div className="flex gap-4 items-center">
                        <button onClick={() => navigate('/login')} className="text-sm font-bold text-slate-600 hover:text-slate-900 whitespace-nowrap">Customer Portal / Login</button>
                        <button onClick={() => setShowDemoOptions(true)} className="bg-primary-600 hover:bg-primary-700 text-white text-sm font-black px-4 md:px-8 py-3 rounded-full transition-all shadow-lg hover:shadow-xl hover:scale-[1.02]">Free Interactive Demo</button>
                        <button onClick={() => navigate('/login?view=register_business')} className="bg-orange-600 hover:bg-orange-700 text-white text-sm font-black px-4 md:px-8 py-3 rounded-full transition-all shadow-lg hover:shadow-xl hover:scale-[1.02]">Start Your Free Trial</button>
                    </div>
                </div>
            </nav>

            {/* DEMO OPTIONS MODAL */}
            {showDemoOptions && (
                <div className="fixed inset-0 z-[100] bg-slate-900/40 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
                    <div className="w-full max-w-4xl bg-white rounded-[2.5rem] border border-slate-200 p-4 md:p-8 md:p-12 relative shadow-2xl">
                        <button onClick={() => setShowDemoOptions(false)} aria-label="Close Demo Modal" title="Close" className="absolute top-6 right-6 text-slate-400 hover:text-slate-600 p-2 bg-slate-100 rounded-full transition-colors"><X size={32} /></button>
                        <div className="text-center mb-10">
                            <h2 className="text-3xl md:text-4xl font-black mb-4">Choose Your Experience</h2>
                            <p className="text-slate-500">Explore TekTrakker from any perspective. No login required.</p>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {[
                                { role: 'admin', icon: Shield, label: 'View as Admin', color: 'bg-indigo-600', desc: 'Dispatch & Ops' },
                                { role: 'employee', icon: Wrench, label: 'View as Technician', color: 'bg-emerald-600', desc: 'Field App Flow' },
                                { role: 'customer', icon: Users, label: 'View as Customer', color: 'bg-orange-600', desc: 'Self-Service Portal' }
                            ].map((opt) => (
                                <button key={opt.role} onClick={() => startDemo(opt.role as 'admin' | 'employee' | 'customer')} className="p-6 rounded-3xl bg-slate-50 border border-slate-200 hover:border-primary-500 transition-all text-left group flex flex-col h-full hover:bg-slate-100 shadow-sm">
                                    <div className={`w-12 h-12 rounded-2xl ${opt.color} flex items-center justify-center mb-6 group-hover:scale-110 transition-transform shadow-lg`}><opt.icon className="text-white" size={24} /></div>
                                    <h4 className="font-bold text-lg mb-2 text-slate-900">{opt.label}</h4>
                                    <p className="text-xs text-slate-500 leading-relaxed mb-6 flex-1">{opt.desc}</p>
                                    <div className="flex items-center gap-2 text-xs font-black uppercase text-primary-600 group-hover:gap-4 transition-all">Launch Demo <ArrowRight size={14} /></div>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {showSupportModal && <SupportModal onClose={() => setShowSupportModal(false)} onSubmit={handleSupportSubmit} />}

            <header className="pt-40 pb-20 px-6 relative overflow-hidden">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-primary-600/10 rounded-full blur-[120px] -z-10" />
                <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
                    <div>
                        <Logo className="h-16 md:h-16 w-auto mb-8 animate-fade-in" />
                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-50 border border-blue-200 mb-8 animate-fade-in"><span className="flex h-2 w-2 rounded-full bg-blue-500 animate-pulse"></span><span className="text-xs font-bold text-blue-700 uppercase tracking-widest">Reclaim Your Evenings</span></div>
                        <h1 className="text-5xl md:text-7xl font-black tracking-tight mb-8 leading-tight text-slate-900">Stop Being a Slave to <br /><span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-600 to-indigo-600">Paperwork.</span></h1>
                        <p className="text-xl text-slate-600 max-w-xl mb-10 leading-relaxed font-medium">You didn't start a business to work 16 hours a day. TekTrakker eliminates the chaos of scheduling, chasing payments, and managing techs so you can finally breathe.</p>
                        <div className="flex flex-col sm:flex-row gap-4">
                            <button onClick={() => setShowDemoOptions(true)} className="h-16 px-10 rounded-2xl bg-primary-600 text-white font-black text-lg hover:bg-primary-700 transition-all shadow-lg shadow-primary-600/20 hover:scale-[1.02] flex items-center justify-center gap-2">Start Exploring Now <ArrowRight size={20} /></button>
                        </div>
                        <div className="mt-6 flex flex-col sm:flex-row gap-4 sm:items-center">
                            <div className="flex items-center gap-1">
                                {[1, 2, 3, 4, 5].map(i => <Star key={i} size={16} fill="currentColor" className="text-yellow-400" />)}
                                <span className="ml-2 text-sm font-bold text-slate-700">4.9/5</span>
                            </div>
                            <span className="hidden sm:inline text-slate-300">|</span>
                            <p className="text-sm text-slate-500 font-medium"><span className="text-emerald-500 font-bold">✓</span> 14-Day Free Trial &nbsp;<span className="text-emerald-500 font-bold">✓</span> Cancel anytime</p>
                        </div>
                    </div>
                    <div className="relative perspective-1000 hidden md:block">
                        <div className="absolute inset-0 bg-gradient-to-tr from-primary-500/10 to-indigo-500/10 transform rotate-3 rounded-[3rem] blur-xl"></div>
                        <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden transform transition-transform hover:-translate-y-2 hover:rotate-1 duration-500 relative z-10 w-full">
                            {/* Mock Window Header */}
                            <div className="bg-slate-100 p-4 flex gap-2 border-b border-slate-200 items-center">
                                <div className="w-3 h-3 rounded-full bg-red-400"></div><div className="w-3 h-3 rounded-full bg-yellow-400"></div><div className="w-3 h-3 rounded-full bg-green-400"></div>
                                <span className="ml-4 text-xs font-bold text-slate-500 tracking-wider">TEKTRAKKER OPERATING SYSTEM</span>
                            </div>
                            {/* Dashboard Mock Layout */}
                            <div className="flex">
                                {/* Sidebar Mock */}
                                <div className="w-16 md:w-20 border-r border-slate-200 p-4 flex flex-col gap-4 hidden sm:flex items-center pt-8 bg-slate-50">
                                    <div role="button" onClick={() => setActiveMockTab('layout')} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setActiveMockTab('layout'); }} tabIndex={0} className={`w-10 h-10 rounded-xl flex items-center justify-center cursor-pointer transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 ${activeMockTab === 'layout' ? 'bg-primary-100' : 'hover:bg-slate-200'}`}><Layout className={activeMockTab === 'layout' ? "text-primary-600" : "text-slate-500"} size={20} /></div>
                                    <div role="button" onClick={() => setActiveMockTab('users')} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setActiveMockTab('users'); }} tabIndex={0} className={`w-10 h-10 rounded-xl flex items-center justify-center cursor-pointer transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 ${activeMockTab === 'users' ? 'bg-primary-100' : 'hover:bg-slate-200'}`}><Users className={activeMockTab === 'users' ? "text-primary-600" : "text-slate-500"} size={20} /></div>
                                    <div role="button" onClick={() => setActiveMockTab('analytics')} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setActiveMockTab('analytics'); }} tabIndex={0} className={`w-10 h-10 rounded-xl flex items-center justify-center cursor-pointer transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 ${activeMockTab === 'analytics' ? 'bg-primary-100' : 'hover:bg-slate-200'}`}><BarChart3 className={activeMockTab === 'analytics' ? "text-primary-600" : "text-slate-500"} size={20} /></div>
                                    <div role="button" onClick={() => setActiveMockTab('wrench')} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setActiveMockTab('wrench'); }} tabIndex={0} className={`w-10 h-10 rounded-xl flex items-center justify-center cursor-pointer transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 ${activeMockTab === 'wrench' ? 'bg-primary-100' : 'hover:bg-slate-200'}`}><Wrench className={activeMockTab === 'wrench' ? "text-primary-600" : "text-slate-500"} size={20} /></div>
                                </div>
                                {/* Main Content Mock */}
                                <div className="p-6 flex-1 bg-white">
                                    <MockUpdatingCharts activeTab={activeMockTab} />
                                    <ROICalculator />
                                </div>
                            </div>
                        </div>
                    </div>
                    {/* Mobile ROI version without the massive mockup styling */}
                    <div className="md:hidden relative"><ROICalculator /></div>
                </div>
            </header>

            <IntegrationsMarquee />

            <section className="py-20 px-6 bg-slate-100">
                <div className="max-w-7xl mx-auto text-center">
                    <h2 className="text-4xl font-black text-slate-900 mb-4">Streamline Your Entire Operation</h2>
                    <p className="text-xl text-slate-600 max-w-2xl mx-auto mb-16">TekTrakker offers an all-in-one platform to manage every aspect of your service business, from first contact to final payment.</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                        <div className="bg-white p-4 md:p-8 rounded-2xl border border-slate-200 text-left transform hover:scale-[1.02] transition-transform shadow-lg lg:col-span-2"><Zap className="text-primary-600 mb-4" size={36} /><h3 className="text-2xl font-bold text-slate-900 mb-2">Effortless Scheduling & Dispatch</h3><p className="text-slate-600">Drag-and-drop job scheduling, automated dispatching, and real-time technician tracking keep your team on track and your customers informed.</p></div>
                        <div className="bg-white p-4 md:p-8 rounded-2xl border border-indigo-200 text-left transform hover:scale-[1.02] transition-transform shadow-lg shadow-indigo-500/10 relative overflow-hidden lg:col-span-2"><div className="absolute top-0 right-0 bg-indigo-500 text-white text-[10px] font-black uppercase px-3 py-1 rounded-bl-lg">Exclusive</div><Users className="text-indigo-600 mb-4" size={36} /><h3 className="text-2xl font-bold text-slate-900 mb-2">Free Premium Homeowner Leads</h3><p className="text-slate-600">Stop paying per lead. TekTrakker connects you natively with local homeowners actively requesting service through our standalone Consumer Portal, entirely for free.</p></div>
                        <div className="bg-white p-4 md:p-8 rounded-2xl border border-slate-200 text-left transform hover:scale-[1.02] transition-transform shadow-lg"><HandCoins className="text-green-600 mb-4" size={36} /><h3 className="text-2xl font-bold text-slate-900 mb-2">Automated Invoicing & Payments</h3><p className="text-slate-600">Generate professional invoices, accept online payments, process credit cards directly on the field, and automate follow-ups to get paid faster.</p></div>
                        <div className="bg-white p-4 md:p-8 rounded-2xl border border-slate-200 text-left transform hover:scale-[1.02] transition-transform shadow-lg"><MapPin className="text-orange-600 mb-4" size={36} /><h3 className="text-2xl font-bold text-slate-900 mb-2">Geofenced Time Tracking</h3><p className="text-slate-600">Automatically track technician arrival and departure times using precise GPS geofencing. Ensure 100% accurate payroll and eliminate time theft effortlessly.</p></div>
                        <div className="bg-white p-4 md:p-8 rounded-2xl border border-slate-200 text-left transform hover:scale-[1.02] transition-transform shadow-lg"><Smartphone className="text-sky-600 mb-4" size={36} /><h3 className="text-2xl font-bold text-slate-900 mb-2">Mobile App for Technicians</h3><p className="text-slate-600">Empower your field team with a dedicated mobile app for job details, checklists, time tracking, picture taking, and full on-site sales presentations.</p></div>
                        <div className="bg-white p-4 md:p-8 rounded-2xl border border-slate-200 text-left transform hover:scale-[1.02] transition-transform shadow-lg"><Heart className="text-red-600 mb-4" size={36} /><h3 className="text-2xl font-bold text-slate-900 mb-2">Recurring Memberships</h3><p className="text-slate-600">Build incredible recurring revenue with native membership plans. Automatically charge cards on file, schedule preventative maintenance, and drive loyalty with ease.</p></div>
                        <div className="bg-white p-4 md:p-8 rounded-2xl border border-slate-200 text-left transform hover:scale-[1.02] transition-transform shadow-lg"><BarChart3 className="text-purple-600 mb-4" size={36} /><h3 className="text-2xl font-bold text-slate-900 mb-2">Powerful Analytics & Reporting</h3><p className="text-slate-600">Gain insights into your business performance with customizable dashboards, real-time P&L tracking, and advanced technician efficiency reports.</p></div>
                        <div className="bg-white p-4 md:p-8 rounded-2xl border border-slate-200 text-left transform hover:scale-[1.02] transition-transform shadow-lg"><UserCircle className="text-teal-600 mb-4" size={36} /><h3 className="text-2xl font-bold text-slate-900 mb-2">Client Management (CRM)</h3><p className="text-slate-600">Keep all customer information, detailed service history, equipment age, and native communication logs in one centralized, search-friendly place.</p></div>
                        <div className="bg-white p-4 md:p-8 rounded-2xl border border-slate-200 text-left transform hover:scale-[1.02] transition-transform shadow-lg"><Cpu className="text-pink-600 mb-4" size={36} /><h3 className="text-2xl font-bold text-slate-900 mb-2">AI-Powered Estimating</h3><p className="text-slate-600">Generate accurate quotes and Good/Better/Best proposals faster with our intelligent estimating tools that learn from your historical data and win rates.</p></div>
                        <div className="bg-white p-4 md:p-8 rounded-2xl border border-blue-200 text-left transform hover:scale-[1.02] transition-transform shadow-lg shadow-blue-500/10 relative overflow-hidden"><div className="absolute top-0 right-0 bg-blue-500 text-white text-[10px] font-black uppercase px-3 py-1 rounded-bl-lg">New</div><Layers className="text-blue-600 mb-4" size={36} /><h3 className="text-2xl font-bold text-slate-900 mb-2">Contractor Bid Network</h3><p className="text-slate-600">Outsource excess work or bid on available jobs from other businesses. Expand your capacity instantly without hiring.</p></div>
                        <div className="bg-white p-4 md:p-8 rounded-2xl border border-fuchsia-200 text-left transform hover:scale-[1.02] transition-transform shadow-lg shadow-fuchsia-500/10 relative overflow-hidden"><div className="absolute top-0 right-0 bg-fuchsia-500 text-white text-[10px] font-black uppercase px-3 py-1 rounded-bl-lg">New</div><Bot className="text-fuchsia-600 mb-4" size={36} /><h3 className="text-2xl font-bold text-slate-900 mb-2">AI Omni-Channel Marketing</h3><p className="text-slate-600">Automatically preview and publish perfectly formatted marketing content across all your social networks with a single click.</p></div>
                    </div>
                </div>
            </section>



            <section className="py-20 px-6 bg-white">
                <div className="max-w-7xl mx-auto bg-slate-100 border border-slate-200 p-10 md:p-16 rounded-[2.5rem] shadow-sm">
                    <h2 className="text-4xl font-black text-slate-900 text-center mb-16">How TekTrakker Gives You Back Your Life</h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                        {[
                            { step: "1", title: "Simple Job Creation", desc: "Easily create new jobs, add customer details, notes, and required services in minutes. Our intuitive interface makes it a breeze.", color: "bg-primary-600" },
                            { step: "2", title: "Smart Scheduling", desc: "Assign jobs to the right technicians, optimize routes, and dispatch with a click. Technicians get instant updates on their mobile app.", color: "bg-indigo-600" },
                            { step: "3", title: "On-Site Completion", desc: "Technicians complete checklists, capture signatures, and generate invoices directly from the field. Collect payments instantly.", color: "bg-emerald-600" },
                            { step: "4", title: "Automated Follow-ups", desc: "TekTrakker handles post-service communications, sends reminders, and solicits customer reviews to boost your reputation.", color: "bg-purple-600" },
                        ].map((item, idx) => (
                            <AnimatedCard key={idx} direction={idx % 2 === 0 ? 'left' : 'right'} delay={idx * 100}>
                                <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-xl hover:-translate-y-2 transition-transform duration-300 flex flex-col items-center text-center h-full">
                                    <div className={`w-14 h-14 rounded-full flex items-center justify-center text-2xl font-black text-white shadow-lg mb-6 ${item.color}`}>
                                        {item.step}
                                    </div>
                                    <h3 className="text-xl font-bold text-slate-900 mb-3">{item.title}</h3>
                                    <p className="text-slate-600 text-sm leading-relaxed flex-1">{item.desc}</p>
                                </div>
                            </AnimatedCard>
                        ))}
                    </div>
                </div>
            </section>

            {/* Call to Action */}
            <section className="py-20 px-6 text-center">
                <div className="max-w-3xl mx-auto mb-20">
                    <h2 className="text-4xl md:text-5xl font-black text-slate-900 mb-6 leading-tight">Ready to Stop Drowning in Paperwork?</h2>
                    <p className="text-xl text-slate-600 mb-10">Join hundreds of service businesses who are reclaiming their time and scaling their operations with TekTrakker.</p>
                    <button onClick={() => navigate('/login?view=register_business')} className="h-16 px-12 rounded-2xl bg-orange-600 text-white font-black text-xl hover:bg-orange-700 transition-all shadow-lg shadow-orange-600/20 hover:scale-[1.02] flex items-center justify-center gap-2 mx-auto">Start Your Free 14-Day Trial <ArrowRight size={22} /></button>
                </div>

                {/* Property Owners Cross-Pitch */}
                <AnimatedCard direction="left" delay={0}>
                <div className="max-w-5xl mx-auto bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-3xl p-8 md:p-12 text-left flex flex-col md:flex-row items-center justify-between gap-8 relative overflow-hidden group hover:border-blue-300 transition-colors shadow-lg shadow-blue-500/5 mb-8">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:bg-blue-500/20 transition-all duration-700 pointer-events-none"></div>
                    <div className="flex-1 relative z-10">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-bold uppercase tracking-widest mb-4">100% Free For Homeowners</div>
                        <h3 className="text-3xl font-black text-slate-900 mb-4">Are you a Property Owner?</h3>
                        <p className="text-lg text-slate-600 mb-0">Don't manage your property with a shoebox of receipts. Access your free dedicated consumer portal to track warranties, view service history, pay bills, and instantly book verified professionals in your area.</p>
                    </div>
                    <div className="relative z-10 w-full md:w-auto shrink-0">
                        <button onClick={() => navigate('/homeowners')} className="w-full md:w-auto px-8 py-4 bg-blue-600 text-white font-black text-lg rounded-xl hover:bg-blue-700 transition-all shadow-xl hover:shadow-2xl flex items-center justify-center gap-2 group-hover:scale-105">
                            Explore Property Owner Hub <ArrowRight size={20} />
                        </button>
                    </div>
                </div>
                </AnimatedCard>

                {/* Virtual Worker Pitch */}
                <AnimatedCard direction="right" delay={0}>
                <div className="max-w-5xl mx-auto bg-slate-900 border border-slate-700 rounded-3xl p-8 md:p-12 text-left flex flex-col md:flex-row items-center justify-between gap-8 relative overflow-hidden group hover:border-indigo-500/50 transition-colors shadow-lg shadow-indigo-500/10 mb-8">
                    <div className="absolute top-0 left-0 w-64 h-64 bg-indigo-500/20 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2 group-hover:bg-indigo-500/30 transition-all duration-700 pointer-events-none"></div>
                    <div className="relative z-10 w-36 h-36 md:w-48 md:h-48 shrink-0 hidden md:flex items-center justify-center">
                        <img src="/mascot.png" alt="AI Mascot" className="w-full h-full object-contain filter drop-shadow-[0_0_15px_rgba(99,102,241,0.5)] group-hover:scale-110 transition-transform duration-500 origin-bottom" />
                    </div>
                    <div role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') navigate('/ai-worker'); }} className="flex-1 relative z-10 text-white cursor-pointer" onClick={() => navigate('/ai-worker')}>
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-xs font-bold uppercase tracking-widest mb-4">
                            AI Powered Agent
                        </div>
                        <h3 className="text-3xl font-black mb-4">Scale gracefully with the Virtual Worker Add-On</h3>
                        <p className="text-lg text-slate-400 mb-0 leading-relaxed">
                            Stop hiring expensive administrators for data entry. Add a dedicated AI agent to your organization that understands your entire dispatch board, customer history, and financials, available 24/7.
                        </p>
                    </div>
                    <div className="relative z-10 w-full md:w-auto shrink-0 flex flex-col items-center">
                        <img src="/mascot.png" alt="AI Mascot" className="w-16 h-16 object-contain filter drop-shadow-[0_0_10px_rgba(99,102,241,0.5)] md:hidden mb-4" />
                        <button onClick={() => navigate('/ai-worker')} className="w-full md:w-auto px-8 py-4 bg-indigo-600 text-white font-black text-lg rounded-xl hover:bg-indigo-700 transition-all shadow-xl hover:shadow-2xl flex items-center justify-center gap-2 group-hover:scale-105">
                            Meet Your AI Worker <ArrowRight size={20} />
                        </button>
                    </div>
                </div>
                </AnimatedCard>

                {/* Contractor Network Pitch */}
                <AnimatedCard direction="left" delay={0}>
                <div className="max-w-5xl mx-auto bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-3xl p-8 md:p-12 text-left flex flex-col md:flex-row items-center justify-between gap-8 relative overflow-hidden group hover:border-emerald-300 transition-colors shadow-lg shadow-emerald-500/5 mb-8">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:bg-emerald-500/20 transition-all duration-700 pointer-events-none"></div>
                    <div role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') navigate('/login?view=register_business'); }} className="flex-1 relative z-10 cursor-pointer" onClick={() => navigate('/login?view=register_business')}>
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold uppercase tracking-widest mb-4">Grow Without Hiring</div>
                        <h3 className="text-3xl font-black text-slate-900 mb-4">Tap into the Contractor Bid Network</h3>
                        <p className="text-lg text-slate-600 mb-0">Have more jobs than you can handle? Need to keep your team busy during the slow season? Our integrated network allows you to instantly broadcast RFPs to trusted local contractors or bid on jobs they can't fulfill.</p>
                    </div>
                    <div className="relative z-10 w-full md:w-auto shrink-0 flex flex-col items-center">
                        <button onClick={() => navigate('/login?view=register_business')} className="w-full md:w-auto px-8 py-4 bg-emerald-600 text-white font-black text-lg rounded-xl hover:bg-emerald-700 transition-all shadow-xl hover:shadow-2xl flex items-center justify-center gap-2 group-hover:scale-105">
                            Join the Network <ArrowRight size={20} />
                        </button>
                    </div>
                </div>
                </AnimatedCard>

                {/* Franchise Pitch */}
                <AnimatedCard direction="right" delay={0}>
                <div className="max-w-5xl mx-auto bg-slate-900 border border-slate-700/50 rounded-3xl p-8 md:p-12 text-left flex flex-col md:flex-row items-center justify-between gap-8 relative overflow-hidden group hover:border-yellow-500/50 transition-all shadow-2xl shadow-yellow-500/10 mb-8">
                    {/* Background Gradients */}
                    <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-yellow-500/20 to-orange-500/20 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/2 group-hover:scale-110 group-hover:opacity-80 transition-all duration-700 pointer-events-none"></div>
                    <div className="absolute bottom-0 left-0 w-64 h-64 bg-slate-800/40 rounded-full blur-[60px] translate-y-1/2 -translate-x-1/2 pointer-events-none"></div>

                    <div className="flex-1 relative z-10">
                        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 text-xs font-black uppercase tracking-widest mb-4 shadow-sm shadow-yellow-500/5">
                            <span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse"></span>
                            Ownership Opportunities
                        </div>
                        <h3 className="text-4xl font-black text-white mb-4 tracking-tight">Franchise with TekTrakker</h3>
                        <p className="text-lg text-slate-400 mb-0 leading-relaxed font-medium">
                            Stop breaking your back to build someone else's business. Take control of your financial future and build generational wealth with our turnkey trade business franchise model, powered exclusively by this very platform.
                        </p>
                    </div>
                    <div className="relative z-10 w-full md:w-auto shrink-0 flex flex-col gap-4">
                        <button onClick={() => navigate('/franchise')} className="w-full md:w-auto px-10 py-5 bg-gradient-to-r from-yellow-500 to-yellow-600 text-slate-900 font-black text-lg rounded-2xl hover:from-yellow-400 hover:to-yellow-500 transition-all shadow-xl shadow-yellow-500/25 flex items-center justify-center gap-3 group-hover:scale-105 active:scale-95">
                            Explore Franchising <ArrowRight size={22} className="text-slate-900" />
                        </button>
                    </div>
                </div>
                </AnimatedCard>
            </section>

            <PartnerTestimonial />

            <footer className="bg-slate-950 border-t border-white/5 py-12 px-6">
                <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
                    <div className="flex items-center gap-2 opacity-50 grayscale hover:grayscale-0 transition-all"><Logo className="h-8 w-auto" /></div>
                    <div className="flex items-center gap-6 text-sm text-slate-500 font-medium">
                        <a href="/#/faq" className="hover:text-white transition-colors">FAQ</a>
                        <a href="/#/privacy" className="hover:text-white transition-colors">Privacy Policy</a>
                        <a href="/#/terms" className="hover:text-white transition-colors">Terms of Service</a>
                        <button onClick={() => setShowSupportModal(true)} className="hover:text-white transition-colors">Support</button>
                    </div>
                    <div className="flex items-center gap-4">
                        <a href="https://www.facebook.com/share/1AyPhsNeN3/" target="_blank" rel="noopener noreferrer" aria-label="Facebook" title="Facebook" className="text-slate-500 hover:text-[#1877F2] transition-all hover:scale-110"><Facebook size={20} /></a>
                        <a href="https://twitter.com/TrakkerPlatform" target="_blank" rel="noopener noreferrer" aria-label="X (Twitter)" title="X (Twitter)" className="text-slate-500 hover:text-white transition-all hover:scale-110"><XLogo size={20} /></a>
                        <a href="https://www.tiktok.com/@tektrakker" target="_blank" rel="noopener noreferrer" aria-label="TikTok" title="TikTok" className="text-slate-500 hover:text-[#00f2fe] transition-all hover:scale-110"><TikTok size={20} /></a>
                    </div>
                    <div className="text-slate-600 text-xs font-medium">&copy; 2026 TekTrakker Inc. All rights reserved.</div>
                </div>
            </footer>

            <LandingChatbot />
        </div>
    );
};

export default SaaSMarketing;
