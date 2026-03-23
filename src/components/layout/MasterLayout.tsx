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
    <div className="flex h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-200 font-sans transition-colors">
      <MasterSidebar 
        user={user} 
        onLogout={onLogout} 
        isOpen={isSidebarOpen} 
        onClose={() => setIsSidebarOpen(false)} 
      />
      
      <div className="flex-1 flex flex-col overflow-hidden">
         {/* Mobile Header */}
         <header className="bg-slate-900 shadow-md sm:hidden border-b border-slate-700 fixed top-0 w-full z-20">
           <div className="px-4 h-16 flex items-center justify-between">
              <div className="flex items-center gap-3">
                  <button 
                    onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                    className="text-slate-400 hover:text-white focus:outline-none"
                  >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                      </svg>
                  </button>
                  <h1 className="text-xl font-bold text-sky-500">Master Admin</h1>
              </div>
           </div>
         </header>
         
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-slate-50 dark:bg-slate-900 p-4 sm:p-6 lg:p-8 pt-20 sm:pt-6">
          {children}
        </main>
      </div>
    </div>
  );
};

export default MasterLayout;