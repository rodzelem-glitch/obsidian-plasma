"use client";

import React from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

const Logo = ({ className }: { className?: string }) => (
    <img 
        src="/tektrakker-logo-web.webp" 
        alt="TekTrakker" 
        width={150}
        height={40}
        className={`max-w-full max-h-full object-contain ${className || 'h-auto'}`}
    />
);

interface LandingHeaderProps {
    backButton?: {
        label: string;
        href: string;
    };
    onShowDemoOptions?: () => void;
}

export const LandingHeader: React.FC<LandingHeaderProps> = ({ backButton, onShowDemoOptions }) => {
    return (
        <nav className={`border-b border-slate-200 backdrop-blur-md fixed w-full z-50 bg-white/80 ${backButton ? 'h-16' : 'h-24'}`}>
            <div className="max-w-7xl mx-auto px-6 h-full flex justify-between items-center">
                {backButton ? (
                    <Link href={backButton.href} className="flex items-center gap-2 text-slate-500 hover:text-slate-900 transition-colors">
                        <ArrowLeft size={20} />
                        <span className="font-medium font-sans">{backButton.label}</span>
                    </Link>
                ) : (
                    <Link href="/" className="flex items-center cursor-pointer">
                        <Logo className="h-14 w-auto text-primary-600" />
                    </Link>
                )}
                
                {!backButton && (
                    <div className="flex gap-4 items-center">
                        <Link href="https://app.tektrakker.com/#/login" className="text-sm font-bold text-slate-600 hover:text-slate-900 whitespace-nowrap p-2">Customer Portal / Login</Link>
                        {onShowDemoOptions && (
                            <button onClick={onShowDemoOptions} className="bg-primary-700 hover:bg-primary-800 text-white text-sm font-black px-4 md:px-8 py-3 rounded-full transition-all shadow-lg hover:shadow-xl hover:scale-[1.02]">Free Interactive Demo</button>
                        )}
                        <Link href="https://app.tektrakker.com/#/login?view=register_business" className="bg-orange-700 hover:bg-orange-800 text-white text-sm font-black px-4 md:px-8 py-3 rounded-full transition-all shadow-lg hover:shadow-xl hover:scale-[1.02]">Start Your Free Trial</Link>
                    </div>
                )}

                {backButton && (
                    <>
                        <Logo className="h-8 w-auto" />
                        <div className="w-[72px]"></div> {/* Spacer for centering */}
                    </>
                )}
            </div>
        </nav>
    );
};
