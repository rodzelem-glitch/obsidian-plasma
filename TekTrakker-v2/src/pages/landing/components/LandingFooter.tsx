import React from 'react';
import { Logo } from '../../../components/ui/Logo';
import { Facebook } from 'lucide-react';

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

interface LandingFooterProps {
    onShowSupport?: () => void;
}

export const LandingFooter: React.FC<LandingFooterProps> = ({ onShowSupport }) => {
    return (
        <footer className="bg-slate-950 border-t border-white/5 py-16 md:py-24 px-6 w-full relative overflow-hidden">
            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary-600/10 rounded-full blur-[100px] pointer-events-none transform translate-x-1/2 -translate-y-1/2"></div>
            <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-x-8 gap-y-16 relative z-10">
                <div className="col-span-1">
                    <h4 className="text-white font-bold mb-6 uppercase tracking-wider text-xs">Platform</h4>
                    <ul className="space-y-4 text-sm font-medium text-slate-400">
                        <li><a href="https://tektrakker.com/features/scheduling-dispatch" className="hover:text-primary-400 transition-colors">Scheduling & Dispatch</a></li>
                        <li><a href="https://tektrakker.com/features/invoicing-payments" className="hover:text-primary-400 transition-colors">Invoicing & Payments</a></li>
                        <li><a href="https://tektrakker.com/features/field-service-app" className="hover:text-primary-400 transition-colors">Field Service App</a></li>
                        <li><a href="https://tektrakker.com/features/estimating-proposals" className="hover:text-primary-400 transition-colors">Estimating & Proposals</a></li>
                        <li><a href="https://tektrakker.com/features/service-agreements" className="hover:text-primary-400 transition-colors">Service Agreements</a></li>
                        <li><a href="https://tektrakker.com/features/ai-virtual-worker" className="hover:text-primary-400 transition-colors">AI Virtual Worker</a></li>
                    </ul>
                </div>

                <div className="col-span-1">
                    <h4 className="text-white font-bold mb-6 uppercase tracking-wider text-xs">Industries</h4>
                    <ul className="space-y-4 text-sm font-medium text-slate-400">
                        <li><a href="https://tektrakker.com/industries/hvac/" className="hover:text-primary-400 transition-colors">HVAC</a></li>
                        <li><a href="https://tektrakker.com/industries/plumbing/" className="hover:text-primary-400 transition-colors">Plumbing</a></li>
                        <li><a href="https://tektrakker.com/industries/electrical/" className="hover:text-primary-400 transition-colors">Electrical</a></li>
                        <li><a href="https://tektrakker.com/industries/landscaping/" className="hover:text-primary-400 transition-colors">Landscaping</a></li>
                        <li><a href="https://tektrakker.com/industries/cleaning/" className="hover:text-primary-400 transition-colors">Cleaning Services</a></li>
                        <li><a href="https://tektrakker.com/industries/painting/" className="hover:text-primary-400 transition-colors">Painting</a></li>
                        <li><a href="https://tektrakker.com/industries/roofing/" className="hover:text-primary-400 transition-colors">Roofing</a></li>
                        <li><a href="https://tektrakker.com/industries/contracting/" className="hover:text-primary-400 transition-colors">General Contracting</a></li>
                    </ul>
                </div>

                <div className="col-span-1">
                    <h4 className="text-white font-bold mb-6 uppercase tracking-wider text-xs">Industries</h4>
                    <ul className="space-y-4 text-sm font-medium text-slate-400">
                        <li><a href="https://tektrakker.com/industries/masonry/" className="hover:text-primary-400 transition-colors">Masonry</a></li>
                        <li><a href="https://tektrakker.com/industries/garage-door/" className="hover:text-primary-400 transition-colors">Garage Door</a></li>
                        <li><a href="https://tektrakker.com/industries/appliance-repair/" className="hover:text-primary-400 transition-colors">Appliance Repair</a></li>
                        <li><a href="https://tektrakker.com/industries/telecommunications/" className="hover:text-primary-400 transition-colors">Telecommunications</a></li>
                        <li><a href="https://tektrakker.com/industries/solar/" className="hover:text-primary-400 transition-colors">Solar Installation</a></li>
                        <li><a href="https://tektrakker.com/industries/security/" className="hover:text-primary-400 transition-colors">Security & Alarm</a></li>
                        <li><a href="https://tektrakker.com/industries/property-management/" className="hover:text-primary-400 transition-colors">Property Management</a></li>
                        <li><a href="https://tektrakker.com/industries/pet-grooming/" className="hover:text-primary-400 transition-colors">Pet Grooming</a></li>
                    </ul>
                </div>

                <div className="col-span-1">
                    <h4 className="text-white font-bold mb-6 uppercase tracking-wider text-xs">Resources</h4>
                    <ul className="space-y-4 text-sm font-medium text-slate-400">
                        <li><a href="https://tektrakker.com/faq" className="hover:text-primary-400 transition-colors">Help Center / FAQ</a></li>
                        <li><a href="/#/login?view=register_business" className="hover:text-primary-400 transition-colors">ROI Calculator</a></li>
                        <li><a href="/#/login?view=register_business" className="hover:text-primary-400 transition-colors">Integration Directory</a></li>
                        <li><a href="/#/homeowners" className="hover:text-primary-400 transition-colors">Homeowner Portal</a></li>
                        <li><a href="/#/login" className="hover:text-primary-400 transition-colors">Customer Login</a></li>
                    </ul>
                </div>

                <div className="col-span-1">
                    <h4 className="text-white font-bold mb-6 uppercase tracking-wider text-xs">Company</h4>
                    <ul className="space-y-4 text-sm font-medium text-slate-400">
                        <li><a href="https://tektrakker.com/about" className="hover:text-primary-400 transition-colors">About Us</a></li>
                        <li><a href="https://tektrakker.com/franchise" className="hover:text-primary-400 transition-colors">Franchise Opportunities</a></li>
                        {onShowSupport && (
                            <li><button onClick={onShowSupport} className="hover:text-primary-400 transition-colors">Contact Support</button></li>
                        )}
                        <li><a href="https://tektrakker.com/privacy" className="hover:text-primary-400 transition-colors">Privacy Policy</a></li>
                        <li><a href="https://tektrakker.com/terms" className="hover:text-primary-400 transition-colors">Terms of Service</a></li>
                        <li><a href="https://tektrakker.com/eula" className="hover:text-primary-400 transition-colors">End User License Agreement (EULA)</a></li>
                    </ul>
                </div>
            </div>

            <div className="max-w-7xl mx-auto w-full flex flex-col md:flex-row justify-between items-center md:items-end gap-8 mt-16 pt-8 border-t border-slate-800/50 relative z-10">
                <div className="text-slate-500 text-sm font-medium w-full md:w-1/3 text-center md:text-left order-3 md:order-1">
                    &copy; {new Date().getFullYear()} TekTrakker Inc.<br />All rights reserved.
                </div>

                <div className="flex flex-col items-center text-center w-full md:w-1/3 gap-4 order-1 md:order-2">
                    <a href="https://tektrakker.com" className="opacity-90 hover:opacity-100 transition-opacity" title="TekTrakker Homepage" aria-label="TekTrakker Homepage">
                        <Logo className="h-6 w-auto" />
                    </a>
                    <p className="text-slate-500 text-xs max-w-sm mx-auto leading-relaxed">
                        The all-in-one operating system built specifically for the trades. Stop managing software and start managing your business.
                    </p>
                    <div className="flex items-center justify-center gap-3">
                        <a href="https://www.facebook.com/share/1AyPhsNeN3/" target="_blank" rel="noopener noreferrer" aria-label="Facebook" className="w-8 h-8 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400 hover:text-[#1877F2] hover:border-[#1877F2] hover:bg-[#1877F2]/10 transition-all"><Facebook size={14} /></a>
                        <a href="https://twitter.com/TrakkerPlatform" target="_blank" rel="noopener noreferrer" aria-label="X (Twitter)" className="w-8 h-8 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400 hover:text-white hover:border-white hover:bg-white/10 transition-all"><XLogo size={14} /></a>
                        <a href="https://www.tiktok.com/@tektrakker" target="_blank" rel="noopener noreferrer" aria-label="TikTok" className="w-8 h-8 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400 hover:text-[#00f2fe] hover:border-[#00f2fe] hover:bg-[#00f2fe]/10 transition-all"><TikTok size={14} /></a>
                    </div>
                </div>

                <div className="flex items-center justify-center md:justify-end w-full md:w-1/3 gap-2 order-2 md:order-3 mb-4 md:mb-0">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.8)]"></span>
                    <span className="text-slate-400 text-sm font-bold">All Systems Operational</span>
                </div>
            </div>
        </footer>
    );
};
