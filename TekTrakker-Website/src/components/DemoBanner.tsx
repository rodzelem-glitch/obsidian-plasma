import React from 'react';
import { useAppContext } from '../context/AppContext';
import { LogOut, ShieldAlert } from 'lucide-react';

const DemoBanner: React.FC = () => {
    const { state, exitDemo } = useAppContext();

    if (!state.isDemoMode) return null;

    // Adjust bubble position based on user role to avoid bottom navigation bars
    const bannerClass = state.currentUser?.role === 'employee' 
        ? "fixed bottom-24 right-4 bg-amber-600 text-white z-[5000] px-4 py-2 rounded-full flex gap-3 items-center shadow-2xl animate-in slide-in-from-right duration-300 border-2 border-white"
        : "fixed bottom-6 right-4 bg-amber-600 text-white z-[5000] px-4 py-2 rounded-full flex gap-3 items-center shadow-2xl animate-in slide-in-from-right duration-300 border-2 border-white";

    return (
        <div className={bannerClass}>
            <div className="flex items-center gap-2 cursor-help" title="Changes made in demo mode are not saved.">
                <ShieldAlert size={16} className="animate-pulse" />
                <div className="text-xs font-bold uppercase tracking-tight">
                    Demo: {state.currentUser?.role}
                </div>
            </div>
            <div className="w-px h-6 bg-amber-500/50 mx-1"></div>
            <button 
                onClick={exitDemo}
                title="Exit Demo"
                className="bg-white text-amber-600 px-3 py-1.5 rounded-full text-[10px] font-black uppercase hover:bg-amber-50 transition-colors flex items-center gap-1.5 shadow-sm"
            >
                <LogOut size={12} /> Exit
            </button>
        </div>
    );
};

export default DemoBanner;