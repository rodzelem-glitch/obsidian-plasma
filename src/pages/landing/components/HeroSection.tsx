
import React from 'react';
import { ArrowRight } from 'lucide-react';

interface HeroSectionProps {
    onStartDemo: () => void;
    onStartTrial: () => void;
}

const HeroSection: React.FC<HeroSectionProps> = ({ onStartDemo, onStartTrial }) => {
    return (
        <header className="pt-40 pb-20 px-6 relative overflow-hidden">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-primary-600/20 rounded-full blur-[120px] -z-10" />
            <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
                <div>
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-900/30 border border-blue-500/30 mb-8 animate-fade-in">
                        <span className="flex h-2 w-2 rounded-full bg-blue-400 animate-pulse"></span>
                        <span className="text-xs font-bold text-blue-300 uppercase tracking-widest">Reclaim Your Evenings</span>
                    </div>
                    
                    <h1 className="text-5xl md:text-7xl font-black tracking-tight mb-8 leading-tight">
                        Stop Being a Slave to <br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-400 to-indigo-400">Paperwork.</span>
                    </h1>
                    
                    <p className="text-xl text-slate-400 max-w-xl mb-10 leading-relaxed font-medium">
                        You didn't start a business to work 16 hours a day. TekTrakker eliminates the chaos of scheduling, chasing payments, and managing techs so you can finally breathe.
                    </p>
                    
                    <div className="flex flex-col sm:flex-row gap-4">
                        <button onClick={onStartDemo} className="h-16 px-10 rounded-2xl bg-primary-600 text-white font-black text-lg hover:bg-primary-500 transition-all shadow-lg shadow-primary-600/20 hover:scale-105 flex items-center justify-center gap-2">
                            Start Exploring Now <ArrowRight size={20} />
                        </button>
                        <button onClick={onStartTrial} className="h-16 px-10 rounded-2xl bg-slate-800 border border-white/10 text-white font-bold text-lg hover:bg-slate-700 transition-all">
                            14-Day Free Trial
                        </button>
                    </div>
                </div>
                {/* ROICalculator will be a separate component */}
            </div>
        </header>
    );
};

export default HeroSection;
