
import React, { useState, Suspense, lazy } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
    Wrench, Briefcase, ArrowRight, ShieldCheck, Zap, History, FileText, 
    Search, DollarSign, BarChart3, Globe, Smartphone, Users, CheckCircle, Map, Building
} from 'lucide-react';
import { Logo } from '../../components/ui/Logo';
const LandingChatbot = lazy(() => import('../../components/LandingChatbot'));
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';

// Utility to delay background chunk execution until after LCP paint
const NavigationDelayer: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [shouldRender, setShouldRender] = useState(false);
    React.useEffect(() => {
        const t = setTimeout(() => setShouldRender(true), 3500);
        return () => clearTimeout(t);
    }, []);
    return shouldRender ? <>{children}</> : null;
};

const SplitHome: React.FC = () => {
  const navigate = useNavigate();
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handlePrimaryActionClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevents the parent div's onClick from firing
    setIsModalOpen(true);
  };

  return (
    <div className="min-h-screen flex flex-col font-sans">
      
      {/* Navbar */}
      <nav className="fixed top-0 w-full z-50 bg-white/90 backdrop-blur-md border-b border-slate-100 shadow-sm transition-all duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16 md:h-20">
                <div className="flex-shrink-0 cursor-pointer" onClick={() => window.scrollTo(0,0)}>
                    <Logo className="h-8 md:h-10 w-auto" />
                </div>
                <div className="hidden md:flex space-x-8">
                    <button onClick={() => document.getElementById('property-owner-section')?.scrollIntoView({ behavior: 'smooth' })} className="text-slate-600 font-bold hover:text-blue-600 transition-colors">For Property Owners</button>
                    <button onClick={() => document.getElementById('business-section')?.scrollIntoView({ behavior: 'smooth' })} className="text-slate-600 font-bold hover:text-emerald-600 transition-colors">For Pros</button>
                </div>
                <div className="flex items-center gap-3">
                    <button 
                        onClick={() => navigate('/login')} 
                        className="px-4 py-2 text-slate-700 font-bold text-sm hover:text-slate-900 transition-colors"
                    >
                        Log In
                    </button>
                    <button 
                        onClick={() => setIsModalOpen(true)} 
                        className="px-5 py-2.5 bg-blue-600 text-white rounded-full font-bold text-sm hover:bg-blue-700 shadow-lg shadow-blue-500/30 transition-all transform hover:-translate-y-0.5"
                    >
                        Get Started
                    </button>
                </div>
            </div>
        </div>
      </nav>

      {/* Hero Split Section */}
      <div className="pt-16 md:pt-20 flex-1 flex flex-col md:flex-row">
        
        {/* Left: Property Owner Funnel */}
        <div 
            id="property-owner-section"
            className="flex-1 bg-slate-50 relative overflow-hidden group hover:flex-[1.1] transition-all duration-500 ease-in-out cursor-pointer flex flex-col justify-center items-center text-center p-4 md:p-8 md:p-16 border-b md:border-b-0 md:border-r border-slate-200"
            onClick={() => setIsModalOpen(true)}
        >
            <div className="absolute inset-0 bg-gradient-to-br from-blue-50/50 to-white/50 opacity-100 z-0" />
            <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#2563eb 1px, transparent 1px)', backgroundSize: '30px 30px' }}></div>
            
            <div className="relative z-10 max-w-lg mx-auto transform group-hover:-translate-y-1 transition-transform duration-500">
                <div className="inline-flex items-center justify-center p-4 bg-white rounded-2xl shadow-xl shadow-blue-100 mb-8 ring-1 ring-blue-50 group-hover:scale-105 transition-transform">
                    <Wrench className="text-blue-600 w-10 h-10" />
                </div>
                
                <h2 className="text-4xl md:text-5xl font-black text-slate-900 mb-4 tracking-tight leading-tight">
                    Your Property's <br/><span className="text-blue-600">Digital Service History</span>
                </h2>
                
                <p className="text-lg text-slate-600 mb-8 font-medium leading-relaxed">
                    Stop searching for receipts and warranty info. <br className="hidden md:block" />
                    Keep all your property service records in one secure vault.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-left mb-10">
                    <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex items-start gap-3">
                        <History className="text-blue-500 mt-1 shrink-0" size={20}/>
                        <div>
                            <p className="font-bold text-slate-800 text-sm">Service History</p>
                            <p className="text-xs text-slate-500">Track every repair & install.</p>
                        </div>
                    </div>
                    <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex items-start gap-3">
                        <FileText className="text-blue-500 mt-1 shrink-0" size={20}/>
                        <div>
                            <p className="font-bold text-slate-800 text-sm">Receipts & Docs</p>
                            <p className="text-xs text-slate-500">Never lose an invoice again.</p>
                        </div>
                    </div>
                    <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex items-start gap-3">
                        <ShieldCheck className="text-blue-500 mt-1 shrink-0" size={20}/>
                        <div>
                            <p className="font-bold text-slate-800 text-sm">Warranty Tracker</p>
                            <p className="text-xs text-slate-500">Know when you're covered.</p>
                        </div>
                    </div>
                    <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex items-start gap-3">
                        <Search className="text-blue-500 mt-1 shrink-0" size={20}/>
                        <div>
                            <p className="font-bold text-slate-800 text-sm">Trusted Pros</p>
                            <p className="text-xs text-slate-500">Find verified technicians.</p>
                        </div>
                    </div>
                </div>
                
                <div className="flex flex-col items-center">
                    <button onClick={handlePrimaryActionClick} className="w-full sm:w-auto px-4 md:px-8 py-4 bg-blue-600 text-white rounded-xl font-black text-lg shadow-xl shadow-blue-500/20 hover:bg-blue-700 hover:shadow-2xl transition-all flex items-center justify-center gap-2 group-hover:gap-4">
                        Find a Pro & Get Started <ArrowRight size={20} />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); navigate('/login'); }} className="mt-4 text-sm font-bold text-blue-600 hover:underline">
                        Already have an account? Log in
                    </button>
                </div>
            </div>
        </div>

        {/* Right: Business Funnel */}
        <div 
            id="business-section"
            className="flex-1 bg-slate-950 relative overflow-hidden group hover:flex-[1.1] transition-all duration-500 ease-in-out cursor-pointer flex flex-col justify-center items-center text-center p-4 md:p-8 md:p-16"
            onClick={() => navigate('/pro')}
        >
            <div className="absolute inset-0 bg-gradient-to-bl from-slate-900 to-slate-950 opacity-95 z-0" />
            <div className="absolute inset-0 opacity-[0.05] pointer-events-none" style={{ backgroundImage: 'linear-gradient(45deg, #10b981 1px, transparent 1px)', backgroundSize: '40px 40px' }}></div>

            <div className="relative z-10 max-w-lg mx-auto transform group-hover:-translate-y-1 transition-transform duration-500">
                 <div className="inline-flex items-center justify-center p-4 bg-slate-800 rounded-2xl shadow-2xl shadow-emerald-900/50 mb-8 ring-1 ring-white/10 group-hover:scale-105 transition-transform">
                    <Briefcase className="text-emerald-400 w-10 h-10" />
                </div>

                <h2 className="text-4xl md:text-5xl font-black text-white mb-4 tracking-tight leading-tight">
                    Scale Your <br/><span className="text-emerald-400">Service Business</span>
                </h2>
                
                <p className="text-lg text-slate-400 mb-8 font-medium leading-relaxed">
                    The AI Operating System designed to cut overhead, <br className="hidden md:block" />
                    boost productivity, and increase your bottom line.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-left mb-10">
                    <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-800 flex items-start gap-3">
                        <Zap className="text-emerald-400 mt-1 shrink-0" size={20}/>
                        <div>
                            <p className="font-bold text-white text-sm">AI Dispatching</p>
                            <p className="text-xs text-slate-400">Optimize routes automatically.</p>
                        </div>
                    </div>
                    <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-800 flex items-start gap-3">
                        <DollarSign className="text-emerald-400 mt-1 shrink-0" size={20}/>
                        <div>
                            <p className="font-bold text-white text-sm">Instant Invoicing</p>
                            <p className="text-xs text-slate-400">Get paid faster, on site.</p>
                        </div>
                    </div>
                    <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-800 flex items-start gap-3">
                        <Globe className="text-emerald-400 mt-1 shrink-0" size={20}/>
                        <div>
                            <p className="font-bold text-white text-sm">Web Integration</p>
                            <p className="text-xs text-slate-400">Bookings directly from your site.</p>
                        </div>
                    </div>
                    <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-800 flex items-start gap-3">
                        <BarChart3 className="text-emerald-400 mt-1 shrink-0" size={20}/>
                        <div>
                            <p className="font-bold text-white text-sm">Profit Analytics</p>
                            <p className="text-xs text-slate-400">Know your numbers real-time.</p>
                        </div>
                    </div>
                </div>
                
                <div className="flex flex-col items-center">
                    <button className="w-full sm:w-auto px-4 md:px-8 py-4 bg-emerald-700 text-white rounded-xl font-black text-lg shadow-xl shadow-emerald-500/20 hover:bg-emerald-800 hover:shadow-2xl transition-all flex items-center justify-center gap-2 group-hover:gap-4">
                        Boost Your Revenue <ArrowRight size={20} />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); navigate('/login'); }} className="mt-4 text-sm font-bold text-emerald-400 hover:underline">
                        Partner Login
                    </button>
                </div>
            </div>
        </div>

      </div>

      {/* Trust Badges / Footer Strip */}
      <div className="bg-white border-t border-slate-100 py-6 md:py-8">
        <div className="max-w-7xl mx-auto px-4 flex flex-wrap justify-center items-center gap-x-8 gap-y-4 md:gap-x-12 text-slate-500 font-bold text-xs uppercase tracking-widest">
            <span className="flex items-center gap-2 text-slate-500">
                <CheckCircle size={16} className="text-blue-500"/> Verified Professionals
            </span>
            <span className="flex items-center gap-2 text-slate-500">
                <CheckCircle size={16} className="text-blue-500"/> Bank-Level Security
            </span>
            <span className="flex items-center gap-2 text-slate-500">
                <CheckCircle size={16} className="text-blue-500"/> 24/7 Support
            </span>
            <Link to="/eula" className="hover:text-slate-900 transition-colors">EULA</Link>
            <Link to="/terms" className="hover:text-slate-900 transition-colors">Terms</Link>
            <Link to="/privacy" className="hover:text-slate-900 transition-colors">Privacy</Link>

        </div>
      </div>

      <NavigationDelayer>
        <Suspense fallback={null}>
          <LandingChatbot />
        </Suspense>
      </NavigationDelayer>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="How would you like to proceed?">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
            <Button variant="outline" onClick={() => { navigate('/book'); setIsModalOpen(false); }} className="h-24 text-lg">
                <Map className="mr-2"/> Book the Nearest Pro
            </Button>
            <Button variant="outline" onClick={() => { navigate('/marketplace'); setIsModalOpen(false); }} className="h-24 text-lg">
                <Building className="mr-2"/> Search Marketplace
            </Button>
        </div>
      </Modal>
    </div>
  );
};

export default SplitHome;
