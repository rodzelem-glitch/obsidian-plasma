import React, { useState } from 'react';
import type { User } from 'types';
import MasterSidebar from './MasterSidebar';

interface MasterLayoutProps {
  user: User;
  onLogout: () => void;
  children?: React.ReactNode;
}

const MasterLayout: React.FC<MasterLayoutProps> = ({ user, onLogout, children }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className="flex h-[100dvh] bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-200 font-sans transition-colors">
      <MasterSidebar 
        user={user} 
        onLogout={onLogout} 
        isOpen={isSidebarOpen} 
        onClose={() => setIsSidebarOpen(false)} 
      />
      
      <div className="flex-1 flex flex-col overflow-hidden">
         {/* Mobile Header */}
         <header className="bg-white dark:bg-slate-800 shadow-md sm:hidden border-b border-slate-200 dark:border-slate-700 fixed top-0 w-full z-20 pt-safe">
           <div className="px-4 h-16 flex items-center justify-between">
              <div className="flex items-center gap-3">
                  <button 
                    onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                    className="text-slate-500 hover:text-primary-600 dark:hover:text-white focus:outline-none"
                    aria-label="Toggle Menu"
                    title="Toggle Menu"
                  >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                      </svg>
                  </button>
                  <h1 className="text-xl font-bold text-primary-600 dark:text-primary-400">Master Admin</h1>
              </div>
           </div>
         </header>
         
        <main id="main-scroll-container" className="flex-1 overflow-x-hidden overflow-y-auto bg-slate-50 dark:bg-slate-900 p-4 sm:p-6 lg:p-8 pt-[calc(5rem+env(safe-area-inset-top,0px))] sm:pt-6">

            <div className="min-h-full">
              {children}
            </div>        </main>
      </div>
    </div>
  );
};

export default MasterLayout;