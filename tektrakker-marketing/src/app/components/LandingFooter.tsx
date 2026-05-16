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

const InstagramIcon = ({ size = 20, className = "" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.07zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
    </svg>
);

const YoutubeIcon = ({ size = 20, className = "" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
        <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.5 12 3.5 12 3.5s-7.505 0-9.377.55a3.015 3.015 0 0 0-2.122 2.136C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.55 9.376.55 9.376.55s7.505 0 9.377-.55a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
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
                        <li><Link href="/payment-processing/" className="hover:text-primary-400 transition-colors">Payment Processing</Link></li>
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
                        <a href="https://www.instagram.com/tektrakker" target="_blank" rel="noopener noreferrer" aria-label="Instagram" className="w-8 h-8 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400 hover:text-[#E1306C] hover:border-[#E1306C] hover:bg-[#E1306C]/10 transition-all"><InstagramIcon size={14} /></a>
                        <a href="https://www.tiktok.com/@tektrakker" target="_blank" rel="noopener noreferrer" aria-label="TikTok" className="w-8 h-8 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400 hover:text-[#00f2fe] hover:border-[#00f2fe] hover:bg-[#00f2fe]/10 transition-all"><TikTok size={14} /></a>
                        <a href="https://www.youtube.com/@tektrakker" target="_blank" rel="noopener noreferrer" aria-label="YouTube" className="w-8 h-8 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400 hover:text-[#FF0000] hover:border-[#FF0000] hover:bg-[#FF0000]/10 transition-all"><YoutubeIcon size={14} /></a>
                        <a href="https://www.linkedin.com/company/tektrakker" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn" className="w-8 h-8 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400 hover:text-[#0A66C2] hover:border-[#0A66C2] hover:bg-[#0A66C2]/10 transition-all"><LinkedinIcon size={14} /></a>
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
