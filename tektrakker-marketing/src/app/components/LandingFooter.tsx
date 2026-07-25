"use client";

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';

const Logo = ({ className }: { className?: string }) => (
    <Image 
        src="/tektrakker-logo-web.webp" 
        alt="TekTrakker" 
        width={160}
        height={32}
        className={`object-contain ${className || 'h-auto'}`}
    />
);

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

const FacebookIcon = ({ size = 20, className = "" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.469h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.469h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
);

const LinkedinIcon = ({ size = 20, className = "" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
        <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
    </svg>
);



interface LandingFooterProps {
    onShowSupport?: () => void;
}

export const LandingFooter: React.FC<LandingFooterProps> = ({ onShowSupport }) => {
    return (
        <footer className="bg-slate-950 border-t border-white/5 py-16 md:py-24 px-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary-600/10 rounded-full blur-[100px] pointer-events-none transform translate-x-1/2 -translate-y-1/2"></div>
            <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-x-8 gap-y-16 relative z-10">
                <div className="col-span-1">
                    <h4 className="text-white font-bold mb-6 uppercase tracking-wider text-xs">Platform</h4>
                    <ul className="space-y-4 text-sm font-medium text-slate-400">
                        <li><Link href="/features/scheduling-dispatch/" className="hover:text-primary-400 transition-colors">Scheduling & Dispatch</Link></li>
                        <li><Link href="/features/invoicing-payments/" className="hover:text-primary-400 transition-colors">Invoicing & Payments</Link></li>
                        <li><Link href="/features/field-service-app/" className="hover:text-primary-400 transition-colors">Field Service App</Link></li>
                        <li><Link href="/features/estimating-proposals/" className="hover:text-primary-400 transition-colors">Estimating & Proposals</Link></li>
                        <li><Link href="/features/service-agreements/" className="hover:text-primary-400 transition-colors">Service Agreements</Link></li>
                        <li><Link href="/features/ai-virtual-worker/" className="hover:text-primary-400 transition-colors">AI Virtual Worker</Link></li>
                        <li><Link href="/payment-processing-signup/" className="hover:text-primary-400 transition-colors">Payment Processing</Link></li>
                        <li><Link href="/pricing/" className="hover:text-primary-400 transition-colors">Transparent Pricing</Link></li>
                    </ul>
                </div>

                <div className="col-span-1">
                    <h4 className="text-white font-bold mb-6 uppercase tracking-wider text-xs">Industries</h4>
                    <ul className="space-y-4 text-sm font-medium text-slate-400">
                        <li><Link href="/industries/hvac/" className="hover:text-primary-400 transition-colors">HVAC</Link></li>
                        <li><Link href="/industries/plumbing/" className="hover:text-primary-400 transition-colors">Plumbing</Link></li>
                        <li><Link href="/industries/electrical/" className="hover:text-primary-400 transition-colors">Electrical</Link></li>
                        <li><Link href="/industries/landscaping/" className="hover:text-primary-400 transition-colors">Landscaping</Link></li>
                        <li><Link href="/industries/cleaning/" className="hover:text-primary-400 transition-colors">Cleaning Services</Link></li>
                        <li><Link href="/industries/painting/" className="hover:text-primary-400 transition-colors">Painting</Link></li>
                        <li><Link href="/industries/roofing/" className="hover:text-primary-400 transition-colors">Roofing</Link></li>
                        <li><Link href="/industries/contracting/" className="hover:text-primary-400 transition-colors">General Contracting</Link></li>
                    </ul>
                </div>

                <div className="col-span-1">
                    <h4 className="text-white font-bold mb-6 uppercase tracking-wider text-xs">Industries</h4>
                    <ul className="space-y-4 text-sm font-medium text-slate-400">
                        <li><Link href="/industries/masonry/" className="hover:text-primary-400 transition-colors">Masonry</Link></li>
                        <li><Link href="/industries/garage-door/" className="hover:text-primary-400 transition-colors">Garage Door</Link></li>
                        <li><Link href="/industries/appliance-repair/" className="hover:text-primary-400 transition-colors">Appliance Repair</Link></li>
                        <li><Link href="/industries/telecommunications/" className="hover:text-primary-400 transition-colors">Telecommunications</Link></li>
                        <li><Link href="/industries/solar/" className="hover:text-primary-400 transition-colors">Solar Installation</Link></li>
                        <li><Link href="/industries/security/" className="hover:text-primary-400 transition-colors">Security & Alarm</Link></li>
                        <li><Link href="/industries/property-management/" className="hover:text-primary-400 transition-colors">Property Management</Link></li>
                        <li><Link href="/industries/pet-grooming/" className="hover:text-primary-400 transition-colors">Pet Grooming</Link></li>
                    </ul>
                </div>

                <div className="col-span-1">
                    <h4 className="text-white font-bold mb-6 uppercase tracking-wider text-xs">Resources</h4>
                    <ul className="space-y-4 text-sm font-medium text-slate-400">
                        <li><Link href="/faq/" className="hover:text-primary-400 transition-colors">Help Center / FAQ</Link></li>
                        <li><Link href="/roi-calculator/" className="hover:text-primary-400 transition-colors">ROI Calculator</Link></li>
                        <li><Link href="/integrations/" className="hover:text-primary-400 transition-colors">Integration Directory</Link></li>
                        <li><a href="https://nextinsurance.sjv.io/c/7280120/1148969/14516" target="_blank" rel="noopener noreferrer" className="hover:text-primary-400 transition-colors">Insurance/Bonds</a></li>
                        <li><a href="https://app.tektrakker.com/#/homeowners" className="hover:text-primary-400 transition-colors">Homeowner Portal</a></li>
                        <li><a href="https://app.tektrakker.com/#/login" className="hover:text-primary-400 transition-colors">Customer Login</a></li>
                    </ul>
                </div>

                <div className="col-span-1">
                    <h4 className="text-white font-bold mb-6 uppercase tracking-wider text-xs">Company</h4>
                    <ul className="space-y-4 text-sm font-medium text-slate-400">
                        <li><Link href="/about/" className="hover:text-primary-400 transition-colors">About Us</Link></li>
                        <li><Link href="/franchise/" className="hover:text-primary-400 transition-colors">Franchise Opportunities</Link></li>
                        {onShowSupport && (
                            <li><button onClick={onShowSupport} className="hover:text-primary-400 transition-colors">Contact Support</button></li>
                        )}
                        <li><Link href="/privacy/" className="hover:text-primary-400 transition-colors">Privacy Policy</Link></li>
                        <li><Link href="/terms/" className="hover:text-primary-400 transition-colors">Terms of Service</Link></li>
                        <li><Link href="/eula/" className="hover:text-primary-400 transition-colors">End User License Agreement (EULA)</Link></li>
                    </ul>
                </div>
            </div>

            <div className="max-w-7xl mx-auto w-full flex flex-col md:flex-row justify-between items-center md:items-end gap-8 mt-16 pt-8 border-t border-slate-800/50 relative z-10">
                <div className="text-slate-400 text-sm font-medium w-full md:w-1/3 text-center md:text-left order-3 md:order-1">
                    &copy; {new Date().getFullYear()} TekTrakker Inc.<br />All rights reserved.
                </div>

                <div className="flex flex-col items-center text-center w-full md:w-1/3 gap-4 order-1 md:order-2">
                    <Link href="/" className="opacity-90 hover:opacity-100 transition-opacity">
                        <Logo className="h-6 w-auto" />
                    </Link>
                    <p className="text-slate-400 text-xs max-w-sm mx-auto leading-relaxed">
                        The all-in-one operating system built specifically for the trades. Stop managing software and start managing your business.
                    </p>
                    <div className="flex items-center justify-center gap-3">
                        <a href="https://www.facebook.com/share/1AyPhsNeN3/" target="_blank" rel="noopener noreferrer" aria-label="Facebook" className="w-8 h-8 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400 hover:text-[#1877F2] hover:border-[#1877F2] hover:bg-[#1877F2]/10 transition-all"><FacebookIcon size={14} /></a>
                        <a href="https://twitter.com/TrakkerPlatform" target="_blank" rel="noopener noreferrer" aria-label="X (Twitter)" className="w-8 h-8 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400 hover:text-white hover:border-white hover:bg-white/10 transition-all"><XLogo size={14} /></a>
                        <a href="https://www.tiktok.com/@tektrakker" target="_blank" rel="noopener noreferrer" aria-label="TikTok" className="w-8 h-8 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400 hover:text-[#00f2fe] hover:border-[#00f2fe] hover:bg-[#00f2fe]/10 transition-all"><TikTok size={14} /></a>
                        <a href="https://www.linkedin.com/company/tektrakker" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn" className="w-8 h-8 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400 hover:text-[#0A66C2] hover:border-[#0A66C2] hover:bg-[#0A66C2]/10 transition-all"><LinkedinIcon size={14} /></a>
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-center md:justify-end w-full md:w-1/3 gap-3 order-2 md:order-3 mb-4 md:mb-0">
                    <a href="https://apps.apple.com/ph/app/tektrakker/id6761885811" target="_blank" rel="noopener noreferrer" className="flex items-center justify-center w-[160px] gap-3 bg-white/5 text-white px-4 py-2 rounded-xl hover:bg-white/10 transition-colors border border-white/10">
                        <svg viewBox="0 0 384 512" className="w-6 h-6 fill-current"><path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z"/></svg>
                        <div className="flex flex-col text-left">
                            <span className="text-[10px] leading-tight text-slate-400">Download on the</span>
                            <span className="text-sm font-bold leading-tight text-white">App Store</span>
                        </div>
                    </a>
                    <a href="https://play.google.com/store/apps/details?id=com.tektrakker&pcampaignid=web_share" target="_blank" rel="noopener noreferrer" className="flex items-center justify-center w-[160px] gap-3 bg-white/5 text-white px-4 py-2 rounded-xl hover:bg-white/10 transition-colors border border-white/10">
                        <svg viewBox="0 0 512 512" className="w-6 h-6 fill-current"><path d="M325.3 234.3L104.6 13l280.8 161.2-60.1 60.1zM47 0C34 6.8 25.3 19.2 25.3 35.3v441.3c0 16.1 8.7 28.5 21.7 35.3l256.6-256L47 0zm425.2 225.6l-58.9-34.1-65.7 64.5 65.7 64.5 60.1-34.1c18-14.3 18-46.5-1.2-60.8zM104.6 499l280.8-161.2-60.1-60.1L104.6 499z"/></svg>
                        <div className="flex flex-col text-left">
                            <span className="text-[10px] leading-tight text-slate-400">GET IT ON</span>
                            <span className="text-sm font-bold leading-tight text-white">Google Play</span>
                        </div>
                    </a>
                </div>
            </div>
        </footer>
    );
};
