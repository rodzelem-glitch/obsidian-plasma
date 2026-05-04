import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MarketingFooter } from '../../components/layout/MarketingFooter';
import { 
    Wrench, ArrowRight, ShieldCheck, History, FileText,
    Search, CheckCircle, Home, ArrowLeft
} from 'lucide-react';
import { Logo } from '../../components/ui/Logo';
import LandingChatbot from '../../components/LandingChatbot';

const PropertyOwnerMarketing: React.FC = () => {
    const navigate = useNavigate();

    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    const backgroundStyle = { backgroundImage: 'radial-gradient(#2563eb 1px, transparent 1px)', backgroundSize: '30px 30px' } as React.CSSProperties;

    return (
        <div className="min-h-screen flex flex-col font-sans bg-slate-50 selection:bg-blue-500 selection:text-white">
            
            {/* Navbar */}
            <nav className="fixed top-0 w-full z-50 bg-white/90 backdrop-blur-md border-b border-slate-200 shadow-sm transition-all duration-300">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center h-16 md:h-20">
                        <div className="flex items-center cursor-pointer" onClick={() => navigate('/')}>
                            <Logo className="h-8 md:h-10 w-auto" />
                        </div>
                        <div className="flex items-center gap-3">
                            <button onClick={() => navigate('/')} className="flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-blue-600 transition-colors hidden sm:flex">
                                <ArrowLeft size={16} /> Back to Home
                            </button>
                            <button 
                                onClick={() => window.location.href = 'https://app.tektrakker.com/login'} 
                                className="text-slate-600 font-bold hover:text-blue-600 transition-colors whitespace-nowrap"
                            >
                                Pro Software Login
                            </button>
                        </div>
                    </div>
                </div>
            </nav>

            {/* Content */}
            <div className="pt-24 md:pt-32 pb-20 flex-1 flex flex-col justify-center items-center text-center px-4 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-100/50 to-white opacity-100 z-0" />
                {/* eslint-disable-next-line react/forbid-dom-props */}
                <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={backgroundStyle}></div> {/* NOSONAR */}
                
                <div className="relative z-10 max-w-3xl mx-auto">
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-100 text-blue-800 text-sm font-bold uppercase tracking-widest mb-8 border border-blue-200 shadow-sm">
                        <Home size={16} /> 100% Free For Homeowners
                    </div>

                    <h1 className="text-5xl md:text-7xl font-black text-slate-900 mb-6 tracking-tight leading-tight">
                        Your Property's <br/><span className="text-blue-600">Digital Service History</span>
                    </h1>
                    
                    <p className="text-xl text-slate-600 mb-12 font-medium leading-relaxed max-w-2xl mx-auto">
                        Stop searching for receipts and warranty info in a shoebox. Keep all your property service records, past invoices, and maintenance logs in one secure, digital vault.
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-left mb-16">
                        <div className="bg-white p-6 rounded-2xl shadow-xl shadow-blue-900/5 border border-slate-100 flex flex-col gap-3 group hover:-translate-y-1 transition-transform">
                            <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-colors text-blue-600">
                                <History size={24}/>
                            </div>
                            <h3 className="font-bold text-slate-900 text-lg">Service History Log</h3>
                            <p className="text-slate-500 text-sm leading-relaxed">Track every repair, installation, and preventative maintenance visit historically linked to your address.</p>
                        </div>
                        <div className="bg-white p-6 rounded-2xl shadow-xl shadow-blue-900/5 border border-slate-100 flex flex-col gap-3 group hover:-translate-y-1 transition-transform">
                            <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-colors text-blue-600">
                                <FileText size={24}/>
                            </div>
                            <h3 className="font-bold text-slate-900 text-lg">Receipts & Docs</h3>
                            <p className="text-slate-500 text-sm leading-relaxed">Never lose an invoice again. Access PDF receipts, before/after photos, and proposals instantly.</p>
                        </div>
                        <div className="bg-white p-6 rounded-2xl shadow-xl shadow-blue-900/5 border border-slate-100 flex flex-col gap-3 group hover:-translate-y-1 transition-transform">
                            <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-colors text-blue-600">
                                <ShieldCheck size={24}/>
                            </div>
                            <h3 className="font-bold text-slate-900 text-lg">Warranty Tracker</h3>
                            <p className="text-slate-500 text-sm leading-relaxed">Know exactly when your equipment is covered. Avoid paying for repairs on parts still under manufacturer warranty.</p>
                        </div>
                        <div className="bg-white p-6 rounded-2xl shadow-xl shadow-blue-900/5 border border-slate-100 flex flex-col gap-3 group hover:-translate-y-1 transition-transform">
                            <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-colors text-blue-600">
                                <Search size={24}/>
                            </div>
                            <h3 className="font-bold text-slate-900 text-lg">Hire Trusted Pros</h3>
                            <p className="text-slate-500 text-sm leading-relaxed">Browse the Native Marketplace to find verified, licensed TekTrakker professionals in your exact zip code.</p>
                        </div>
                    </div>
                    
                    <div className="flex flex-col items-center">
                        <button onClick={() => window.location.href = 'https://app.tektrakker.com/login?view=register_customer'} className="w-full sm:w-auto px-8 md:px-12 py-5 bg-blue-600 text-white rounded-2xl font-black text-xl shadow-xl shadow-blue-500/30 hover:bg-blue-700 hover:shadow-2xl transition-all flex items-center justify-center gap-3">
                            Create Your Free Vault <ArrowRight size={24} />
                        </button>
                        <button onClick={() => window.location.href = 'https://app.tektrakker.com/login'} className="mt-6 font-bold text-slate-500 hover:text-blue-600 transition-colors">
                            Already have an account? Log in
                        </button>
                    </div>
                </div>
            </div>

            {/* Trust Footer */}
            <MarketingFooter />

            <LandingChatbot />
        </div>
    );
};

export default PropertyOwnerMarketing;
