import React, { useState, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Zap, Shield, BarChart3, Smartphone,
    CheckCircle, ArrowRight, Cpu, Users, DollarSign,
    Heart, TrendingUp, Layers, MapPin, Star, X,
    Wrench, Layout,
    Phone, FileText, Camera
} from 'lucide-react';
import { Logo } from '../../components/ui/Logo';

import { Helmet } from 'react-helmet-async';
import { motion, AnimatePresence } from 'framer-motion';
import { MarketingFooter } from '../../components/layout/MarketingFooter';

const LandingChatbot = lazy(() => import('../../components/LandingChatbot'));
import TransparentPricingSection from './components/TransparentPricingSection';

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

    const delayStyle = { '--delay': `${delay}ms` } as React.CSSProperties;

    return (
        <div // NOSONAR
            ref={ref} 
            className={`${baseClass} ${isVisible ? visibleClass : hiddenClass} transition-delay-var`} 
            style={delayStyle} 
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
                    {bars.map((height, i) => {
                        const containerStyle = { height: `${height}%` } as React.CSSProperties;
                        const innerStyle = { height: `${height * 0.8}%` } as React.CSSProperties;
                        return (
                        <div // NOSONAR
                            key={i} 
                            className="flex-1 bg-indigo-200 rounded-t-sm relative group transition-all duration-1000 ease-in-out" 
                            style={containerStyle}
                        >
                            <div // NOSONAR
                                className="w-full bg-indigo-500 absolute bottom-0 rounded-t-sm transition-all duration-1000" 
                                style={innerStyle}
                            ></div>
                        </div>
                    )})}
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
                    {bars.map((height, i) => {
                        const containerStyle = { height: `${height}%` } as React.CSSProperties;
                        const innerStyle = { height: `${height * 0.7}%` } as React.CSSProperties;
                        return (
                        <div // NOSONAR
                            key={i} 
                            className="flex-1 bg-primary-200 rounded-t-sm relative group transition-all duration-1000 ease-in-out" 
                            style={containerStyle}
                        >
                            <div className="absolute bottom-full mb-1 opacity-0 group-hover:opacity-100 transition-opacity w-full text-center text-[10px] font-bold text-primary-700">${(height * 150).toLocaleString()}</div>
                            <div // NOSONAR
                                className="w-full bg-primary-500 absolute bottom-0 rounded-t-sm transition-all duration-1000" 
                                style={innerStyle}
                            ></div>
                        </div>
                    )})}
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
                        <div key={i} className="text-xl md:text-2xl font-black text-slate-500 hover:text-slate-700 transition-colors cursor-default whitespace-nowrap mx-8">
                            {name}
                        </div>
                    ))}
                </div>
                <div className="flex w-1/2 justify-around items-center">
                    {integrations.map((name, i) => (
                        <div key={`dup-${i}`} className="text-xl md:text-2xl font-black text-slate-500 hover:text-slate-700 transition-colors cursor-default whitespace-nowrap mx-8">
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
                        <img src="https://firebasestorage.googleapis.com/v0/b/tektrakker.firebasestorage.app/o/public_assets%2Forg-1765817997819%2Flogo_stable_1774702115808.png?alt=media&token=08c347fe-a7b0-40d9-b23f-6a2adecf63e9" alt="TekAir Inc Logo" width="200" height="56" loading="lazy" className="h-10 md:h-14 w-auto object-contain drop-shadow-sm" />
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


const AppWireframe = () => (
    <div className="absolute inset-0 z-0 overflow-hidden opacity-[0.45] select-none pointer-events-none filter blur-[3px]">
        {/* Fake Sidebar */}
        <div className="absolute left-0 top-0 bottom-0 w-16 bg-slate-900 flex flex-col items-center py-4 gap-6">
            <div className="w-8 h-8 rounded-xl bg-primary-600 shadow-lg shadow-primary-600/30 mb-4"></div>
            <div className="w-6 h-6 rounded-lg bg-indigo-500/80"></div>
            <div className="w-6 h-6 rounded-lg bg-slate-700"></div>
            <div className="w-6 h-6 rounded-lg bg-slate-700"></div>
            <div className="w-6 h-6 rounded-lg bg-slate-700"></div>
            <div className="w-6 h-6 rounded-lg bg-slate-700 mt-auto"></div>
        </div>
        {/* Fake Header */}
        <div className="absolute left-16 top-0 right-0 h-14 border-b border-slate-200 bg-white flex items-center px-6 justify-between shadow-sm z-10">
            <div className="flex gap-4 items-center">
                <div className="w-32 h-4 rounded bg-slate-200"></div>
                <div className="w-16 h-6 rounded-full bg-emerald-100 border border-emerald-200"></div>
            </div>
            <div className="flex gap-4 items-center">
                <div className="w-24 h-8 rounded-lg bg-primary-50"></div>
                <div className="w-8 h-8 rounded-full bg-indigo-100 border-2 border-indigo-200"></div>
            </div>
        </div>
        {/* Fake Content Area */}
        <div className="absolute left-16 top-14 right-0 bottom-0 bg-slate-50/80 p-6 flex flex-col gap-6 overflow-hidden">
            <div className="flex gap-4">
                {/* Stat Card 1 */}
                <div className="flex-1 h-24 bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex flex-col justify-between relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-16 h-16 bg-emerald-50 rounded-bl-full"></div>
                    <div className="w-16 h-3 bg-slate-100 rounded-full"></div>
                    <div className="flex items-end gap-2">
                        <div className="w-24 h-8 bg-slate-800 rounded-lg"></div>
                        <div className="w-12 h-4 bg-emerald-400 rounded-md"></div>
                    </div>
                </div>
                {/* Stat Card 2 */}
                <div className="flex-1 h-24 bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex flex-col justify-between relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-16 h-16 bg-indigo-50 rounded-bl-full"></div>
                    <div className="w-20 h-3 bg-slate-100 rounded-full"></div>
                    <div className="flex items-end gap-2">
                        <div className="w-20 h-8 bg-slate-800 rounded-lg"></div>
                        <div className="w-12 h-4 bg-red-400 rounded-md"></div>
                    </div>
                </div>
                {/* Stat Card 3 */}
                <div className="flex-1 h-24 bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex flex-col justify-between bg-gradient-to-br from-indigo-600 to-indigo-800 border-none">
                    <div className="w-16 h-3 bg-indigo-400/50 rounded-full"></div>
                    <div className="flex items-end gap-2">
                        <div className="w-24 h-8 bg-white rounded-lg"></div>
                    </div>
                </div>
            </div>
            
            <div className="flex gap-6 h-full">
                {/* Fake Chart / Main Board */}
                <div className="flex-[2] bg-white rounded-xl border border-slate-200 shadow-sm p-5 flex flex-col">
                    <div className="flex justify-between items-center mb-6">
                        <div className="w-32 h-4 bg-slate-200 rounded-md"></div>
                        <div className="w-24 h-8 bg-slate-100 rounded-lg"></div>
                    </div>
                    {/* Fake Bar Chart */}
                    <div className="flex-1 flex items-end justify-between gap-2 px-2 pb-2 border-b border-slate-100">
                        <div className="w-full h-[40%] bg-indigo-100 rounded-t-md"></div>
                        <div className="w-full h-[70%] bg-indigo-500 rounded-t-md shadow-sm"></div>
                        <div className="w-full h-[30%] bg-indigo-100 rounded-t-md"></div>
                        <div className="w-full h-[90%] bg-emerald-400 rounded-t-md shadow-sm"></div>
                        <div className="w-full h-[50%] bg-indigo-100 rounded-t-md"></div>
                        <div className="w-full h-[80%] bg-primary-500 rounded-t-md shadow-sm"></div>
                        <div className="w-full h-[60%] bg-indigo-100 rounded-t-md"></div>
                    </div>
                </div>
                
                {/* Fake Activity Feed / Right Panel */}
                <div className="flex-[1] bg-white rounded-xl border border-slate-200 shadow-sm p-5 flex flex-col gap-4">
                    <div className="w-24 h-4 bg-slate-200 rounded-md mb-2"></div>
                    {[1,2,3,4].map((i) => (
                        <div key={i} className="flex gap-3 items-start">
                            <div className={`w-8 h-8 rounded-full shrink-0 ${i%2===0 ? 'bg-orange-100' : 'bg-sky-100'}`}></div>
                            <div className="flex-1 space-y-2 py-1">
                                <div className="w-full h-2.5 bg-slate-200 rounded-full"></div>
                                <div className="w-2/3 h-2 bg-slate-100 rounded-full"></div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    </div>
);

const InteractiveFeatures = () => {
    const [activeFeature, setActiveFeature] = useState(0);
    const features = [
        { id: 0, icon: Smartphone, color: 'text-sky-600', bg: 'bg-sky-100', title: 'Native Field App', desc: 'Technicians can view jobs, build quotes, take photos, and process credit cards instantly on iOS & Android.' },
        { id: 1, icon: Zap, color: 'text-primary-600', bg: 'bg-primary-100', title: 'Smart Dispatching', desc: 'Drag-and-drop scheduling with real-time GPS tracking ensures your team is always on the fastest route.' },
        { id: 2, icon: Users, color: 'text-indigo-600', bg: 'bg-indigo-100', title: 'Free Local Leads', desc: 'Stop paying Angi or Yelp. Get free, high-intent leads natively from our Homeowner Consumer Portal.' },
        { id: 3, icon: Cpu, color: 'text-pink-600', bg: 'bg-pink-100', title: 'AI-Powered Quoting', desc: 'Generate hyper-accurate Good/Better/Best proposals in seconds using your historical win-rates.' },
        { id: 4, icon: Heart, color: 'text-red-600', bg: 'bg-red-100', title: 'Recurring Memberships', desc: 'Automatically charge cards on file for maintenance agreements and build massive recurring revenue.' },
        { id: 5, icon: Layers, color: 'text-blue-600', bg: 'bg-blue-100', title: 'Contractor Bid Network', desc: 'Outsource excess jobs to trusted local contractors or bid on their overflow work. Scale without hiring.' }
    ];

    const renderMockup = (id: number) => {
        switch (id) {
            case 0:
                return (
                    <div className="flex flex-col h-full bg-slate-50/60 backdrop-blur-md rounded-b-[2rem] border-x border-b border-slate-200 overflow-hidden relative shadow-[inset_0_2px_10px_rgba(0,0,0,0.02)]">
                        {/* Map Header Mock */}
                        <div className="h-32 bg-slate-100 relative overflow-hidden">
                            {/* Static Map Mockup to save performance */}
                            <div className="absolute inset-0 bg-[#e5e3df] pointer-events-none filter saturate-[1.2] opacity-80">
                                {/* Fake roads */}
                                <div className="absolute top-1/4 left-0 right-0 h-2 bg-white/70 rotate-12 transform origin-left"></div>
                                <div className="absolute top-1/2 left-0 right-0 h-3 bg-white/80 -rotate-6 transform origin-right"></div>
                                <div className="absolute top-0 bottom-0 left-1/3 w-2 bg-white/70 rotate-3 transform origin-top"></div>
                                <div className="absolute top-0 bottom-0 right-1/4 w-3 bg-white/90 -rotate-12 transform origin-bottom"></div>
                                {/* Fake parks */}
                                <div className="absolute top-1/4 right-1/3 w-16 h-16 bg-[#c5e3c6] rounded-full blur-md"></div>
                                <div className="absolute bottom-1/4 left-1/4 w-20 h-12 bg-[#c5e3c6] rounded-[40%] blur-sm"></div>
                            </div>
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 bg-blue-500/20 rounded-full flex items-center justify-center animate-pulse">
                                <div className="w-4 h-4 bg-blue-600 rounded-full border-[3px] border-white shadow-lg"></div>
                            </div>
                        </div>
                        <div className="flex-1 p-4 flex flex-col gap-3 -mt-6">
                            <div className="bg-white/95 backdrop-blur-md rounded-2xl p-4 shadow-lg border border-slate-100 flex flex-col gap-3 relative z-10">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-[10px] font-black uppercase text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded border border-emerald-200">En Route</span>
                                            <span className="text-[10px] font-bold text-slate-500">#4092</span>
                                        </div>
                                        <div className="font-bold text-slate-900 text-sm">Emergency HVAC Repair</div>
                                    </div>
                                    <div className="w-8 h-8 rounded-full bg-slate-100/80 flex items-center justify-center border border-slate-200">
                                        <Phone size={14} className="text-slate-600" />
                                    </div>
                                </div>
                                <div className="h-px w-full bg-slate-100"></div>
                                <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-full bg-indigo-100/80 text-indigo-700 flex items-center justify-center font-bold text-xs border border-indigo-200">SJ</div>
                                    <div>
                                        <p className="text-xs font-bold text-slate-800">Sarah Jenkins</p>
                                        <p className="text-[10px] text-slate-500 flex items-center gap-1"><MapPin size={10} /> 123 Elm Street, San Antonio TX</p>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="grid grid-cols-4 gap-2 mt-auto relative z-10">
                                {[
                                    { icon: CheckCircle, label: 'Arrive', color: 'bg-emerald-50/90 text-emerald-600 border-emerald-200' },
                                    { icon: FileText, label: 'Quote', color: 'bg-indigo-50/90 text-indigo-600 border-indigo-200' },
                                    { icon: Camera, label: 'Photos', color: 'bg-sky-50/90 text-sky-600 border-sky-200' },
                                    { icon: DollarSign, label: 'Pay', color: 'bg-slate-800/90 text-white border-slate-700' }
                                ].map((btn, i) => (
                                    <div key={i} className={`flex flex-col items-center justify-center gap-1 p-2 rounded-xl border backdrop-blur-md ${btn.color} shadow-sm hover:scale-105 transition-transform cursor-pointer`}>
                                        <btn.icon size={16} />
                                        <span className="text-[9px] font-bold text-slate-800">{btn.label}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                );
            case 1:
                return (
                    <div className="flex flex-col h-full bg-slate-50/90 backdrop-blur-md rounded-b-[2rem] border-x border-b border-slate-200 overflow-hidden relative shadow-sm">
                        <div className="flex border-b border-slate-200 bg-white px-2 py-2 shadow-sm relative z-10">
                            <div className="w-14"></div>
                            {['8 AM', '10 AM', '12 PM', '2 PM'].map((time, i) => (
                                <div key={i} className="flex-1 text-[10px] font-bold text-slate-500 text-center border-l border-slate-100 relative">
                                    {time}
                                </div>
                            ))}
                        </div>
                        <div className="flex-1 overflow-hidden flex flex-col pt-3 pb-4 gap-3 px-2 relative">
                            {/* Time indicator line */}
                            <div className="absolute top-0 bottom-0 left-[38%] w-[2px] bg-red-500/80 z-20 shadow-[0_0_8px_rgba(239,68,68,0.5)]">
                                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3 h-3 bg-red-500 rounded-full border-2 border-white shadow-sm"></div>
                            </div>
                            
                            {/* Grid lines */}
                            <div className="absolute inset-0 left-16 flex pointer-events-none z-0">
                                <div className="flex-1 border-l border-slate-200/50"></div>
                                <div className="flex-1 border-l border-slate-200/50"></div>
                                <div className="flex-1 border-l border-slate-200/50"></div>
                                <div className="flex-1 border-l border-slate-200/50"></div>
                            </div>
                            
                            {[
                                { tech: 'Mike', role: 'HVAC', color: 'bg-emerald-500 text-white shadow-emerald-500/20', jobs: [{w: '25%', l: '5%', t: 'Tune Up'}, {w: '35%', l: '35%', t: 'Install'}] },
                                { tech: 'Sarah', role: 'Plumb', color: 'bg-indigo-500 text-white shadow-indigo-500/20', jobs: [{w: '18%', l: '8%', t: 'Leak'}, {w: '40%', l: '45%', t: 'Heater Replace'}] },
                                { tech: 'John', role: 'Elec', color: 'bg-orange-500 text-white shadow-orange-500/20', jobs: [{w: '45%', l: '15%', t: 'Panel Upgrade'}] }
                            ].map((row, i) => (
                                <div key={i} className="flex items-center gap-3 relative z-10 group">
                                    <div className="w-14 shrink-0 flex flex-col items-center bg-white rounded-xl py-1.5 shadow-sm border border-slate-100 group-hover:border-slate-300 transition-colors">
                                        <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-xs font-black text-slate-700 shadow-inner">
                                            <img src={`https://i.pravatar.cc/100?img=${i+10}`} alt="Tech" className="w-full h-full rounded-full object-cover" />
                                        </div>
                                        <div className="text-[9px] text-slate-600 font-bold mt-1 text-center">{row.role}</div>
                                    </div>
                                    <div className="flex-1 h-12 relative bg-slate-100/50 rounded-xl border border-slate-200/50 group-hover:bg-slate-100 transition-colors">
                                        {row.jobs.map((job, j) => {
                                            const jobStyle = { width: job.w, left: job.l } as React.CSSProperties;
                                            return (
                                            <div // NOSONAR
                                                key={j} 
                                                className={`absolute top-1/2 -translate-y-1/2 h-8 rounded-lg shadow-md flex items-center px-2 overflow-hidden hover:scale-[1.02] transition-transform cursor-pointer ${row.color}`} 
                                                style={jobStyle}
                                            >
                                                <div className="w-1 h-full bg-black/10 absolute left-0 top-0"></div>
                                                <span className="text-[10px] font-bold truncate ml-1">{job.t}</span>
                                            </div>
                                        )})}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                );
            case 2:
                return (
                    <div className="flex flex-col h-full bg-slate-50/60 backdrop-blur-md rounded-b-[2rem] border-x border-b border-slate-200 overflow-hidden relative p-4">
                        <div className="absolute top-0 inset-x-0 h-32 bg-gradient-to-b from-indigo-500/10 to-transparent"></div>
                        <div className="bg-white/95 backdrop-blur-md border border-slate-200 rounded-2xl p-5 shadow-xl relative z-10 hover:border-indigo-300 transition-colors cursor-pointer group mt-4">
                            <div className="absolute -top-3 -right-3 w-12 h-12 bg-indigo-500 text-white rounded-full flex items-center justify-center shadow-lg transform group-hover:scale-110 transition-transform"><Zap size={20} fill="currentColor" /></div>
                            
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200 overflow-hidden"><img src="https://i.pravatar.cc/100?img=5" alt="Avatar" className="w-full h-full object-cover" /></div>
                                <div>
                                    <div className="font-bold text-slate-900 text-sm">Michael Chang</div>
                                    <div className="flex items-center gap-1 text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded w-max mt-0.5">
                                        <MapPin size={10} /> 3.2 Miles Away
                                    </div>
                                </div>
                            </div>
                            
                            <div className="mb-4">
                                <div className="font-black text-slate-800 text-base mb-1">A/C Not Blowing Cold Air</div>
                                <p className="text-xs text-slate-600 leading-relaxed border-l-2 border-indigo-200 pl-3">"System is running but the air coming out of the vents is room temperature. Need someone to check freon levels."</p>
                            </div>
                            
                            <div className="flex justify-between items-center bg-slate-50 p-3 rounded-xl border border-slate-100 mb-4">
                                <div>
                                    <div className="text-[10px] font-bold text-slate-500 uppercase">Est. Value</div>
                                    <div className="text-sm font-black text-emerald-600">$150 - $450</div>
                                </div>
                                <div>
                                    <div className="text-[10px] font-bold text-slate-500 uppercase">Cost to Accept</div>
                                    <div className="text-sm font-black text-slate-900 line-through decoration-red-500 decoration-2 mr-1">$25</div>
                                    <span className="text-sm font-black text-indigo-600">FREE</span>
                                </div>
                            </div>
                            
                            <button className="w-full bg-indigo-600 text-white text-sm font-black py-3 rounded-xl hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-600/20 group-hover:-translate-y-0.5">Accept Lead</button>
                        </div>
                    </div>
                );
            case 3:
                return (
                    <div className="flex flex-col h-full bg-slate-50/60 backdrop-blur-md rounded-b-[2rem] border-x border-b border-slate-200 overflow-hidden relative px-6 gap-3 justify-center">
                        <div className="bg-white/90 backdrop-blur-md border border-slate-200 rounded-xl p-3 flex justify-between items-center opacity-80 hover:opacity-100 transition-opacity cursor-pointer relative z-10 w-full mx-auto max-w-[280px]">
                            <div>
                                <div className="text-xs font-black text-slate-800 uppercase tracking-wider mb-0.5">Good Option</div>
                                <div className="text-[10px] font-medium text-slate-500">Basic Repair • 30 Day Warr</div>
                            </div>
                            <div className="text-base font-black text-slate-900">$450</div>
                        </div>
                        
                        <div className="bg-slate-900/95 backdrop-blur-md border border-slate-800 rounded-2xl p-4 shadow-2xl relative transform scale-105 z-20 cursor-pointer w-full mx-auto max-w-[280px]">
                            <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-gradient-to-r from-pink-500 to-rose-500 text-white text-[9px] font-black uppercase px-3 py-1 rounded-full shadow-lg border border-pink-400/50 whitespace-nowrap">Most Popular (76% Select)</div>
                            <div className="flex justify-between items-start mb-3 mt-1">
                                <div>
                                    <div className="text-sm font-black text-white uppercase tracking-wider mb-0.5">Better Option</div>
                                    <div className="text-[10px] text-pink-400 font-bold flex items-center gap-1"><CheckCircle size={10} /> 1 Year Warranty</div>
                                </div>
                                <div className="text-xl font-black text-white">$850</div>
                            </div>
                            <div className="space-y-1.5 mb-4">
                                {['Replace Condenser Fan', 'Recharge Refrigerant', 'Deep Coil Cleaning'].map((item, i) => (
                                    <div key={i} className="flex items-center gap-2 text-[10px] text-slate-300">
                                        <CheckCircle size={10} className="text-emerald-400 shrink-0" /> {item}
                                    </div>
                                ))}
                            </div>
                            <button className="w-full bg-white text-slate-900 text-xs font-black py-2.5 rounded-lg hover:bg-slate-100 transition-colors">Customer Selected</button>
                        </div>
                        
                        <div className="bg-white/90 backdrop-blur-md border border-slate-200 rounded-xl p-3 flex justify-between items-center opacity-80 hover:opacity-100 transition-opacity cursor-pointer mt-1 relative z-10 w-full mx-auto max-w-[280px]">
                            <div>
                                <div className="text-xs font-black text-slate-800 uppercase tracking-wider mb-0.5">Best Option</div>
                                <div className="text-[10px] font-medium text-slate-500">Full Replacement • 10 Yr Warr</div>
                            </div>
                            <div className="text-base font-black text-slate-900">$6,200</div>
                        </div>
                    </div>
                );
            case 4:
                return (
                    <div className="flex flex-col h-full bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-100/60 via-slate-50/60 to-slate-100/60 backdrop-blur-md rounded-b-[2rem] border-x border-b border-slate-200 overflow-hidden relative p-6 justify-center">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/10 rounded-full blur-3xl"></div>
                        
                        <div className="bg-white/80 backdrop-blur-xl border border-white rounded-3xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.08)] text-center relative z-10 group cursor-pointer hover:border-red-200 transition-colors">
                            <div className="absolute inset-0 bg-gradient-to-b from-white/50 to-transparent rounded-3xl pointer-events-none"></div>
                            
                            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-red-100 to-rose-100 border-4 border-white shadow-xl flex items-center justify-center mx-auto mb-4 relative group-hover:scale-105 transition-transform">
                                <Heart size={36} className="text-red-600 drop-shadow-sm" fill="currentColor" />
                                <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-emerald-500 text-white flex items-center justify-center border-2 border-white shadow-sm"><Shield size={12} fill="currentColor" /></div>
                            </div>
                            
                            <div className="font-black text-slate-900 text-xl mb-1">Platinum Shield</div>
                            <p className="text-xs font-bold text-slate-500 mb-4 bg-slate-100 px-3 py-1 rounded-full inline-block">Active • Member since '23</p>
                            
                            <div className="flex items-baseline justify-center gap-1 mb-6">
                                <span className="text-4xl font-black text-slate-900">$49</span>
                                <span className="text-sm font-bold text-slate-500">/mo</span>
                            </div>
                            
                            <div className="bg-slate-50/80 backdrop-blur-md rounded-2xl p-3 border border-slate-100 text-left">
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-[10px] font-bold text-slate-600 uppercase">Next Billing Cycle</span>
                                    <span className="text-[10px] font-black text-emerald-600">Auto-Pay</span>
                                </div>
                                <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                                    <div className="w-3/4 h-full bg-gradient-to-r from-emerald-400 to-emerald-500 rounded-full relative">
                                        <div className="absolute inset-0 bg-white/20 animate-[marquee_2s_linear_infinite]"></div>
                                    </div>
                                </div>
                                <div className="flex justify-between items-center mt-2">
                                    <span className="text-[9px] font-medium text-slate-500">Oct 15</span>
                                    <span className="text-[9px] font-medium text-slate-500">Nov 15</span>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            case 5:
                return (
                    <div className="flex flex-col h-full bg-slate-50/60 backdrop-blur-md rounded-b-[2rem] border-x border-b border-slate-200 overflow-hidden relative p-4 gap-4 justify-center">
                        <div className="bg-slate-900/95 backdrop-blur-md rounded-2xl p-5 shadow-2xl text-white relative overflow-hidden group cursor-pointer hover:shadow-blue-500/20 transition-all z-10">
                            <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-blue-600/30 to-transparent transform translate-x-4 group-hover:translate-x-0 transition-transform"></div>
                            <div className="absolute -top-10 -right-10 w-24 h-24 bg-blue-500/20 rounded-full blur-xl"></div>
                            
                            <div className="flex justify-between items-start mb-3 relative z-10">
                                <span className="bg-blue-500/20 text-blue-400 text-[9px] font-black uppercase px-2 py-1 rounded border border-blue-500/30 tracking-wider">Network RFP</span>
                                <span className="text-[10px] font-bold text-slate-500 flex items-center gap-1"><MapPin size={10} /> Local</span>
                            </div>
                            
                            <div className="font-bold text-base mb-2 relative z-10 leading-tight">Need 5 Commercial Boilers Installed Next Week</div>
                            <div className="flex flex-wrap gap-2 mb-4 relative z-10">
                                <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded">HVAC</span>
                                <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded">Commercial</span>
                                <span className="text-[10px] font-bold text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded border border-emerald-400/20">Budget: $25k+</span>
                            </div>
                            
                            <button className="w-full bg-blue-600 hover:bg-blue-500 text-white text-xs font-black py-2.5 rounded-xl transition-colors shadow-lg relative z-10">Submit Network Bid</button>
                        </div>
                        
                        <div className="bg-white/90 backdrop-blur-md border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col gap-3 relative overflow-hidden z-10">
                            <div className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-500"></div>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center border border-slate-200">
                                        <Logo className="w-4 h-4 opacity-50 grayscale" />
                                    </div>
                                    <div>
                                        <div className="text-[11px] font-black text-slate-800">TekAir Inc. <span className="font-medium text-slate-500 font-normal">bid on your RFP</span></div>
                                        <div className="text-[9px] text-slate-500">2 minutes ago • Rated 4.9/5</div>
                                    </div>
                                </div>
                            </div>
                            <div className="bg-slate-50 rounded-lg p-2 flex justify-between items-center border border-slate-100">
                                <span className="text-[10px] font-bold text-slate-600 uppercase">Bid Amount</span>
                                <span className="text-sm font-black text-emerald-600">$22,400</span>
                            </div>
                        </div>
                    </div>
                );
            default:
                return null;
        }
    };

    return (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col lg:flex-row h-auto lg:h-[600px]">
            <div className="w-full lg:w-1/3 bg-slate-50 border-r border-slate-200 flex flex-col p-2 overflow-y-auto custom-scrollbar">
                {features.map((feature) => (
                    <button 
                        key={feature.id} 
                        onClick={() => setActiveFeature(feature.id)}
                        className={`text-left p-4 rounded-2xl transition-all duration-300 flex items-start gap-4 mb-2 ${activeFeature === feature.id ? 'bg-white shadow-lg border border-slate-200 scale-[1.02]' : 'hover:bg-slate-100 border border-transparent'}`}
                    >
                        <div className={`p-3 rounded-xl ${feature.bg} ${feature.color} shrink-0`}>
                            <feature.icon size={24} />
                        </div>
                        <div>
                            <h3 className={`font-bold mb-1 ${activeFeature === feature.id ? 'text-slate-900' : 'text-slate-600'}`}>{feature.title}</h3>
                            <p className={`text-xs leading-relaxed ${activeFeature === feature.id ? 'text-slate-600' : 'text-slate-500'}`}>{feature.desc}</p>
                        </div>
                    </button>
                ))}
            </div>
            <div className="flex-1 bg-slate-100 relative p-8 flex items-center justify-center overflow-hidden">
                <AnimatePresence mode="wait">
                    <motion.div 
                        key={activeFeature}
                        initial={{ opacity: 0, y: 20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -20, scale: 0.95 }}
                        transition={{ duration: 0.3 }}
                        className="w-full max-w-md bg-white rounded-[2rem] shadow-2xl border border-slate-200 aspect-[9/16] relative overflow-hidden"
                    >
                        {/* Dynamic Mockups based on active tab */}
                        <div className="absolute top-0 w-full h-12 bg-slate-900 flex items-center justify-between px-6 z-10">
                            <span className="text-white font-bold text-xs">9:41</span>
                            <div className="flex gap-2"><div className="w-4 h-3 bg-white rounded-sm"></div><div className="w-3 h-3 bg-white rounded-full"></div></div>
                        </div>
                        <div className="pt-4 p-0 h-full flex flex-col relative z-20">
                            <div className="flex items-center gap-3 mb-4 px-6">
                                <div className={`w-10 h-10 rounded-xl ${features[activeFeature].bg} ${features[activeFeature].color} flex items-center justify-center shadow-sm shrink-0`}>
                                    {React.createElement(features[activeFeature].icon, { size: 20 })}
                                </div>
                                <h3 className="text-xl font-black text-slate-900 leading-tight">{features[activeFeature].title}</h3>
                            </div>
                            
                            <div className="flex-1 w-full mt-2 relative rounded-b-[2rem] overflow-hidden">
                                <AppWireframe />
                                {renderMockup(activeFeature)}
                            </div>
                        </div>
                    </motion.div>
                </AnimatePresence>
            </div>
        </div>
    );
};

const SaaSMarketing: React.FC = () => {
    const navigate = useNavigate();
    const [showDemoOptions, setShowDemoOptions] = useState(false);
    const [activeMockTab, setActiveMockTab] = useState<'layout' | 'users' | 'analytics' | 'wrench'>('layout');

    return (
        <main className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-primary-500 selection:text-white">
            <Helmet>
                <title>TekTrakker | #1 Field Service Management Software</title>
                <meta name="description" content="TekTrakker is the all-in-one field service management software for modern contractors. Includes scheduling, invoicing, AI estimators, and a native bid network." />
                <script type="application/ld+json">
                {`
                    {
                        "@context": "https://schema.org",
                        "@type": "SoftwareApplication",
                        "name": "TekTrakker",
                        "applicationCategory": "BusinessApplication",
                        "operatingSystem": "Web, iOS, Android",
                        "offers": {
                            "@type": "Offer",
                            "price": "0",
                            "priceCurrency": "USD",
                            "description": "14-Day Free Trial"
                        },
                        "aggregateRating": {
                            "@type": "AggregateRating",
                            "ratingValue": "4.9",
                            "ratingCount": "1840"
                        }
                    }
                `}
                </script>
            </Helmet>

            {/* Navbar */}
            <nav className="border-b border-slate-200 backdrop-blur-md fixed w-full z-50 bg-white/80">
                <div className="max-w-7xl mx-auto px-6 h-24 flex justify-between items-center">
                    <div role="button" aria-label="Go to Home" title="Go to Home" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') navigate('/'); }} className="flex items-center cursor-pointer" onClick={() => navigate('/')}><Logo className="h-14 w-auto text-primary-600" /></div>
                    <div className="flex gap-4 items-center">
                        <button onClick={() => window.location.href = 'https://app.tektrakker.com/login'} className="text-sm font-bold text-slate-600 hover:text-slate-900 whitespace-nowrap">Customer Portal / Login</button>
                        <button onClick={() => setShowDemoOptions(true)} className="bg-slate-900 hover:bg-primary-700 text-white text-sm font-black px-4 md:px-8 py-3 rounded-full transition-all shadow-lg hover:shadow-xl hover:scale-[1.02] cursor-pointer">Free Interactive Demo</button>
                        <button onClick={() => window.location.href = 'https://app.tektrakker.com/login?view=register_business'} className="bg-slate-900 hover:bg-orange-700 text-white text-sm font-black px-4 md:px-8 py-3 rounded-full transition-all shadow-lg hover:shadow-xl hover:scale-[1.02]">Start Your Free Trial</button>
                    </div>
                </div>
            </nav>

            {/* DEMO OPTIONS MODAL */}
            {showDemoOptions && (
                <div className="fixed inset-0 z-[100] bg-slate-900/40 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
                    <div className="w-full max-w-4xl bg-white rounded-[2.5rem] border border-slate-200 p-4 md:p-8 md:p-12 relative shadow-2xl">
                        <button onClick={() => setShowDemoOptions(false)} aria-label="Close Demo Modal" title="Close" className="absolute top-6 right-6 text-slate-500 hover:text-slate-600 p-2 bg-slate-100 rounded-full transition-colors"><X size={32} /></button>
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
                                <button key={opt.role} onClick={() => window.location.href = `https://app.tektrakker.com/pro/apex?role=${opt.role}&source=marketing&returnUrl=${encodeURIComponent(window.location.href)}`} className="p-6 rounded-3xl bg-slate-50 border border-slate-200 hover:border-primary-500 transition-all text-left group flex flex-col h-full hover:bg-slate-100 shadow-sm">
                                    <div className={`w-12 h-12 rounded-2xl ${opt.color} flex items-center justify-center mb-6 group-hover:scale-110 transition-transform shadow-lg`}><opt.icon className="text-white" size={24} /></div>
                                    <h3 className="font-bold text-lg mb-2 text-slate-900">{opt.label}</h3>
                                    <p className="text-xs text-slate-500 leading-relaxed mb-6 flex-1">{opt.desc}</p>
                                    <div className="flex items-center gap-2 text-xs font-black uppercase text-primary-600 group-hover:gap-4 transition-all">Launch Demo <ArrowRight size={14} /></div>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}



            <header className="pt-40 pb-20 px-6 relative overflow-hidden">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-primary-600/10 rounded-full blur-[120px] -z-10" />
                <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
                    <div>
                        <Logo className="h-16 md:h-16 w-auto mb-8 animate-fade-in" />
                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-50 border border-blue-200 mb-8 animate-fade-in"><span className="flex h-2 w-2 rounded-full bg-blue-500 animate-pulse"></span><span className="text-xs font-bold text-blue-700 uppercase tracking-widest">Reclaim Your Evenings</span></div>
                        <h1 className="text-5xl md:text-6xl font-black tracking-tight mb-4 leading-tight text-slate-900">
                            The #1 Field Service Management Software
                        </h1>
                        <h2 className="text-2xl font-bold text-slate-500 mb-8">Stop Being a Slave to Paperwork.</h2>
                        <p className="text-xl text-slate-600 max-w-xl mb-10 leading-relaxed font-medium">You didn't start a business to work 16 hours a day. TekTrakker eliminates the chaos of scheduling, chasing payments, and managing techs so you can finally breathe.</p>
                        <div className="flex flex-col sm:flex-row gap-4">
                            <button onClick={() => setShowDemoOptions(true)} className="h-16 px-10 rounded-2xl bg-slate-900 text-white font-black text-lg hover:bg-primary-700 transition-all shadow-lg shadow-primary-600/20 hover:scale-[1.02] flex items-center justify-center gap-2 cursor-pointer">Start Exploring Now <ArrowRight size={20} /></button>
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
                                    <div role="button" aria-label="Layout View" title="Layout View" onClick={() => setActiveMockTab('layout')} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setActiveMockTab('layout'); }} tabIndex={0} className={`w-10 h-10 rounded-xl flex items-center justify-center cursor-pointer transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 ${activeMockTab === 'layout' ? 'bg-primary-100' : 'hover:bg-slate-200'}`}><Layout className={activeMockTab === 'layout' ? "text-primary-600" : "text-slate-500"} size={20} /></div>
                                    <div role="button" aria-label="Users View" title="Users View" onClick={() => setActiveMockTab('users')} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setActiveMockTab('users'); }} tabIndex={0} className={`w-10 h-10 rounded-xl flex items-center justify-center cursor-pointer transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 ${activeMockTab === 'users' ? 'bg-primary-100' : 'hover:bg-slate-200'}`}><Users className={activeMockTab === 'users' ? "text-primary-600" : "text-slate-500"} size={20} /></div>
                                    <div role="button" aria-label="Analytics View" title="Analytics View" onClick={() => setActiveMockTab('analytics')} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setActiveMockTab('analytics'); }} tabIndex={0} className={`w-10 h-10 rounded-xl flex items-center justify-center cursor-pointer transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 ${activeMockTab === 'analytics' ? 'bg-primary-100' : 'hover:bg-slate-200'}`}><BarChart3 className={activeMockTab === 'analytics' ? "text-primary-600" : "text-slate-500"} size={20} /></div>
                                    <div role="button" aria-label="Wrench View" title="Wrench View" onClick={() => setActiveMockTab('wrench')} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setActiveMockTab('wrench'); }} tabIndex={0} className={`w-10 h-10 rounded-xl flex items-center justify-center cursor-pointer transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 ${activeMockTab === 'wrench' ? 'bg-primary-100' : 'hover:bg-slate-200'}`}><Wrench className={activeMockTab === 'wrench' ? "text-primary-600" : "text-slate-500"} size={20} /></div>
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

            <section id="interactive-demo" className="py-20 px-6 bg-slate-100">
                <div className="max-w-7xl mx-auto text-center">
                    <h2 className="text-4xl font-black text-slate-900 mb-4">Streamline Your Entire Operation</h2>
                    <p className="text-xl text-slate-600 max-w-2xl mx-auto mb-16">TekTrakker offers an all-in-one platform to manage every aspect of your service business, from first contact to final payment.</p>
                    <InteractiveFeatures />
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
                    <button onClick={() => window.location.href = 'https://app.tektrakker.com/login?view=register_business'} className="h-16 px-12 rounded-2xl bg-slate-900 text-white font-black text-xl hover:bg-orange-700 transition-all shadow-lg shadow-orange-600/20 hover:scale-[1.02] flex items-center justify-center gap-2 mx-auto">Start Your Free 14-Day Trial <ArrowRight size={22} /></button>
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
                        <img src="/mascot.webp" alt="AI Mascot" width="400" height="717" loading="lazy" className="w-full h-full object-contain filter drop-shadow-[0_0_15px_rgba(99,102,241,0.5)] group-hover:scale-110 transition-transform duration-500 origin-bottom" />
                    </div>
                    <div role="button" aria-label="Virtual Worker Info" title="Virtual Worker Info" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') navigate('/ai-worker'); }} className="flex-1 relative z-10 text-white cursor-pointer" onClick={() => navigate('/ai-worker')}>
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-xs font-bold uppercase tracking-widest mb-4">
                            AI Powered Agent
                        </div>
                        <h3 className="text-3xl font-black mb-4">Scale gracefully with the Virtual Worker Add-On</h3>
                        <p className="text-lg text-slate-500 mb-0 leading-relaxed">
                            Stop hiring expensive administrators for data entry. Add a dedicated AI agent to your organization that understands your entire dispatch board, customer history, and financials, available 24/7.
                        </p>
                    </div>
                    <div className="relative z-10 w-full md:w-auto shrink-0 flex flex-col items-center">
                        <img src="/mascot.webp" alt="AI Mascot" width="400" height="717" loading="lazy" className="w-16 h-16 object-contain filter drop-shadow-[0_0_10px_rgba(99,102,241,0.5)] md:hidden mb-4" />
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
                    <div className="flex-1 relative z-10">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold uppercase tracking-widest mb-4">Grow Without Hiring</div>
                        <h3 className="text-3xl font-black text-slate-900 mb-4">Tap into the Contractor Bid Network</h3>
                        <p className="text-lg text-slate-600 mb-0">Have more jobs than you can handle? Need to keep your team busy during the slow season? Our integrated network allows you to instantly broadcast RFPs to trusted local contractors or bid on jobs they can't fulfill.</p>
                    </div>
                    <div className="relative z-10 w-full md:w-auto shrink-0 flex flex-col items-center">
                        <a href="https://app.tektrakker.com/login?view=register_business" className="w-full md:w-auto px-8 py-4 bg-emerald-600 text-white font-black text-lg rounded-xl hover:bg-emerald-700 transition-all shadow-xl hover:shadow-2xl flex items-center justify-center gap-2 group-hover:scale-105 cursor-pointer">
                            Join the Network <ArrowRight size={20} />
                        </a>
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
                        <p className="text-lg text-slate-500 mb-0 leading-relaxed font-medium">
                            Stop breaking your back to build someone else's business. Take control of your financial future and build generational wealth with our turnkey trade business franchise model, powered exclusively by this very platform.
                        </p>
                    </div>
                    <div className="relative z-10 w-full md:w-auto shrink-0 flex flex-col gap-4">
                        <button onClick={() => navigate('/franchise')} className="w-full md:w-auto px-10 py-5 bg-gradient-to-r from-yellow-500 to-yellow-600 text-slate-900 font-black text-lg rounded-2xl hover:from-yellow-400 hover:to-yellow-500 transition-all shadow-xl shadow-yellow-500/25 flex items-center justify-center gap-3 group-hover:scale-105 active:scale-95 cursor-pointer">
                            Explore Franchising <ArrowRight size={22} className="text-slate-900" />
                        </button>
                    </div>
                </div>
                </AnimatedCard>
            </section>

            <TransparentPricingSection />

            <PartnerTestimonial />

            <MarketingFooter />

            <Suspense fallback={null}>
                <LandingChatbot />
            </Suspense>
        </main>
    );
};

export default SaaSMarketing;


