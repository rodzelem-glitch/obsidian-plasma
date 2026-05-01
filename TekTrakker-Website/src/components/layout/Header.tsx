import React, { useState, useEffect } from 'react';
import type { User } from 'types';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAppContext } from 'context/AppContext';
import { Logo, LogoIcon } from '../ui/Logo';
import TopNavActions from '../common/TopNavActions';
import { Capacitor } from '@capacitor/core';

interface HeaderProps {
    user: User;
    onLogout: () => void;
}

const Header: React.FC<HeaderProps> = ({ user, onLogout }) => {
    const navigate = useNavigate();
    const { state, dispatch } = useAppContext();
    const location = useLocation();
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    
    const isIOS = Capacitor.getPlatform() === 'ios';

    // Reset menu on route change
    useEffect(() => {
        setIsMenuOpen(false);
    }, [location]);

    const companyName = state.currentOrganization?.name || 'TekTrakker';

    // Helper to check if user has access to Admin layout
    const canSeeAdmin = user.role === 'both' || user.role === 'supervisor' || user.role === 'admin' || user.role === 'master_admin';

    return (
        <header className={`fixed top-0 w-full z-[100] border-b transition-colors pt-safe ${isIOS ? 'bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-slate-200/50 dark:border-slate-800/50' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'}`}>
            <div className="mx-auto max-w-7xl px-3 sm:px-6 lg:px-8">
                <div className="flex h-[52px] items-center justify-between">
                    <div className="flex items-center gap-3">
                        <LogoIcon className="h-7 w-7" />
                        {/* Org Name Badge - compact */}
                        <span className="text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-1 rounded-md hidden sm:block max-w-[180px] truncate">
                            {companyName}
                        </span>
                    </div>

                    <div className="flex items-center space-x-2 sm:space-x-3">
                        <TopNavActions user={user} onLogout={onLogout} />
                        {canSeeAdmin && (
                            <button 
                                onClick={() => navigate('/admin/dashboard')} 
                                className="flex items-center text-xs font-semibold text-primary-600 dark:text-primary-400 border border-primary-500/40 px-2.5 py-1.5 rounded-lg hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors min-h-[32px]" 
                                title="Admin Dashboard"
                            >
                                <span className="md:hidden font-bold">A</span>
                                <span className="hidden md:inline">Admin</span>
                            </button>
                        )}
                        <button 
                            onClick={onLogout} 
                            className="flex items-center text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-red-500 dark:hover:text-red-400 transition-colors min-h-[32px] px-1" 
                            title="Log Out"
                        >
                            <span className="md:hidden">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                            </span>
                            <span className="hidden md:inline">Log Out</span>
                        </button>
                    </div>
                </div>
            </div>
        </header>
    );
};

export default Header;
