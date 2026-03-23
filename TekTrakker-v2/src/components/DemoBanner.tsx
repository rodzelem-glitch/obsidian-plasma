import React from 'react';
import { useAppContext } from '../context/AppContext';
import { LogOut, ShieldAlert } from 'lucide-react';

const DemoBanner: React.FC = () => {
    const { state, exitDemo } = useAppContext();

    if (!state.isDemoMode) return null;

    // Adjust banner position based on user role
    const bannerClass = state.currentUser?.role === 'employee' 
        ? "fixed bottom-24 left-0 w-full bg-amber-600 text-white z-[999] px-4 py-2 flex justify-between items-center shadow-lg animate-in slide-in-from-bottom duration-300"
        : "fixed bottom-0 left-0 w-full bg-amber-600 text-white z-[9999] px-4 py-2 flex justify-between items-center shadow-lg animate-in slide-in-from-bottom duration-300";

    return (
        <div className={bannerClass}>
            <div className="flex items-center gap-3">
                <ShieldAlert size={20} className="animate-pulse" />
                <div className="text-sm font-bold uppercase tracking-tight">
                    Demo Mode: <span className="text-amber-100">Viewing as {state.currentUser?.role}</span>
                </div>
                <div className="hidden md:block text-[10px] bg-black/20 px-2 py-0.5 rounded font-medium">
                    Changes are temporary and will not be saved.
                </div>
            </div>
            <button 
                onClick={exitDemo}
                className="bg-white text-amber-600 px-4 py-1 rounded-full text-xs font-black uppercase hover:bg-amber-50 transition-colors flex items-center gap-2"
            >
                <LogOut size={14} /> Exit Demo
            </button>
        </div>
    );
};

export default DemoBanner;