import React from 'react';
import { useAppContext } from '../context/AppContext';
import { LogOut, ShieldAlert } from 'lucide-react';

const DemoBanner: React.FC = () => {
    const { state, exitDemo } = useAppContext();

    React.useEffect(() => {
        if (state.isDemoMode) {
            document.body.dataset.demoMode = 'true';
            
            const handleGlobalClick = (e: MouseEvent) => {
                const target = e.target as HTMLElement;
                const button = target.closest('button, [type="submit"], .btn') as HTMLElement;
                if (button) {
                    const text = button.innerText?.toLowerCase() || '';
                    const label = button.getAttribute('aria-label')?.toLowerCase() || '';
                    const isEditAction = ['save', 'delete', 'add ', 'create', 'update', 'remove'].some(keyword => text.includes(keyword) || label.includes(keyword));
                    if (isEditAction && !text.includes('demo')) {
                        e.preventDefault();
                        e.stopPropagation();
                        alert("Action blocked: The demo environment is locked for edits.");
                    }
                }
            };
            
            document.addEventListener('click', handleGlobalClick, true);
            
            return () => {
                delete document.body.dataset.demoMode;
                document.removeEventListener('click', handleGlobalClick, true);
            };
        } else {
            delete document.body.dataset.demoMode;
        }
    }, [state.isDemoMode]);

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
