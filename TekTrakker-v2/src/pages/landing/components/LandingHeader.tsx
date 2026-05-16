import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Logo } from '../../../components/ui/Logo';
import { ChevronLeft } from 'lucide-react';

interface LandingHeaderProps {
    showAuthButtons?: boolean;
    onShowDemoOptions?: () => void;
    backButton?: {
        label: string;
        href?: string;
        onClick?: () => void;
    };
    title?: string;
}

export const LandingHeader: React.FC<LandingHeaderProps> = ({ 
    showAuthButtons = false, 
    onShowDemoOptions,
    backButton,
    title
}) => {
    const navigate = useNavigate();

    return (
        <nav className="border-b border-slate-200 dark:border-slate-700 backdrop-blur-md fixed w-full z-50 bg-white/80 dark:bg-slate-900/80">
            <div className="max-w-7xl mx-auto px-6 h-24 flex justify-between items-center">
                <div className="flex items-center gap-6">
                    <div 
                        role="button" 
                        aria-label="Go to Home" 
                        title="Go to Home" 
                        tabIndex={0} 
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') window.location.href = 'https://tektrakker.com'; }} 
                        className="flex items-center cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary-500 rounded-lg p-1" 
                        onClick={() => window.location.href = 'https://tektrakker.com'}
                    >
                        <Logo className="h-14 w-auto text-primary-600" />
                        {title && (
                            <span className="ml-4 font-black text-xl text-slate-900 dark:text-white hidden md:block">
                                {title}
                            </span>
                        )}
                    </div>
                    
                    {backButton && (
                        <button 
                            onClick={backButton.onClick || (() => {
                                if (backButton.href?.startsWith('http')) {
                                    window.location.href = backButton.href;
                                } else if (backButton.href) {
                                    navigate(backButton.href);
                                } else {
                                    navigate(-1);
                                }
                            })} 
                            className="flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-primary-600 transition-colors"
                        >
                            <ChevronLeft size={16} /> {backButton.label}
                        </button>
                    )}
                </div>

                {showAuthButtons && (
                    <div className="flex gap-4 items-center">
                        <button onClick={() => navigate('/login')} className="text-sm font-bold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white whitespace-nowrap hidden sm:block">Customer Portal / Login</button>
                        {onShowDemoOptions && (
                            <button onClick={onShowDemoOptions} className="bg-primary-600 hover:bg-primary-700 text-white text-sm font-black px-4 md:px-8 py-3 rounded-full transition-all shadow-lg hover:shadow-xl hover:scale-[1.02]">Free Interactive Demo</button>
                        )}
                        <button onClick={() => navigate('/login?view=register_business')} className="bg-orange-600 hover:bg-orange-700 text-white text-sm font-black px-4 md:px-8 py-3 rounded-full transition-all shadow-lg hover:shadow-xl hover:scale-[1.02]">Start Your Free Trial</button>
                    </div>
                )}
            </div>
        </nav>
    );
};
