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
        <footer className="bg-slate-950 border-t border-white/5 py-12 px-6 w-full">
            <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
                <a href="/#/" aria-label="Go to Home" title="Home" className="flex items-center gap-2 opacity-50 grayscale hover:grayscale-0 hover:opacity-100 transition-all">
                    <Logo className="h-8 w-auto" />
                </a>
                <div className="flex items-center gap-6 text-sm text-slate-500 font-medium">
                    <a href="/#/faq" className="hover:text-white transition-colors">FAQ</a>
                    <a href="/#/privacy" className="hover:text-white transition-colors">Privacy Policy</a>
                    <a href="/#/terms" className="hover:text-white transition-colors">Terms of Service</a>
                    {onShowSupport && (
                        <button onClick={onShowSupport} className="hover:text-white transition-colors">Support</button>
                    )}
                </div>
                <div className="flex items-center gap-4">
                    <a href="https://www.facebook.com/share/1AyPhsNeN3/" target="_blank" rel="noopener noreferrer" aria-label="Facebook" title="Facebook" className="text-slate-500 hover:text-[#1877F2] transition-all hover:scale-110">
                        <Facebook size={20} />
                    </a>
                    <a href="https://twitter.com/TrakkerPlatform" target="_blank" rel="noopener noreferrer" aria-label="X (Twitter)" title="X (Twitter)" className="text-slate-500 hover:text-white transition-all hover:scale-110">
                        <XLogo size={20} />
                    </a>
                    <a href="https://www.tiktok.com/@tektrakker" target="_blank" rel="noopener noreferrer" aria-label="TikTok" title="TikTok" className="text-slate-500 hover:text-[#00f2fe] transition-all hover:scale-110">
                        <TikTok size={20} />
                    </a>
                </div>
                <div className="text-slate-600 text-xs font-medium">&copy; 2026 TekTrakker Inc. All rights reserved.</div>
            </div>
        </footer>
    );
};
