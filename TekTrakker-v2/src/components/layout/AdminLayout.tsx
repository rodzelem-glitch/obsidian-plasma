import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { User } from 'types';
import AdminSidebar from './AdminSidebar';
import { Logo } from '../ui/Logo';
import VirtualWorker from '../ui/VirtualWorker';
import TopNavActions from '../common/TopNavActions';
import PageHeader from '../ui/PageHeader';
import OnboardingTour, { useOnboardingTour } from '../ui/OnboardingTour';
import { useAppContext } from 'context/AppContext';

interface AdminLayoutProps {
  user: User;
  onLogout: () => void;
  children?: React.ReactNode;
}

const AdminLayout: React.FC<AdminLayoutProps> = ({ user, onLogout, children }) => {
  const navigate = useNavigate();
  const { state } = useAppContext();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isCollapsedPreference, setIsCollapsedPreference] = useState(() => {
     if (typeof window !== 'undefined') {
         return localStorage.getItem('sidebar-collapsed') === 'true';
     }
     return false;
  });

  const { showTour, completeTour } = useOnboardingTour(user?.id);
  const isPaymentsOnly = state.currentOrganization?.plan === 'payments_only';

  const handleToggleCollapse = () => {
      const newVal = !isCollapsedPreference;
      setIsCollapsedPreference(newVal);
      localStorage.setItem('sidebar-collapsed', String(newVal));
  };

  return (
    <div className="flex min-h-[100dvh] w-full bg-slate-50 dark:bg-slate-900 text-gray-900 dark:text-gray-200 font-sans transition-colors relative items-start">
      <AdminSidebar 
        user={user} 
        onLogout={onLogout} 
        isOpen={isSidebarOpen} 
        onClose={() => setIsSidebarOpen(false)}
        isCollapsedOverride={isCollapsedPreference}
        onToggleCollapse={handleToggleCollapse}
      />

      <div className={`hidden sm:block transition-all duration-300 ease-in-out shrink-0 ${isCollapsedPreference ? 'w-20' : 'w-64'}`} />
      
      <div className="flex-1 flex flex-col relative min-w-0 min-h-[100dvh]">
         <header className="sticky top-0 bg-white dark:bg-slate-800 shadow-sm border-b border-slate-200 dark:border-slate-700/80 z-40 transition-colors pt-safe shrink-0">
           <div className="px-4 h-16 flex items-center justify-between">
              <div className="flex items-center gap-3">
                  <button 
                    onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                    data-tour="menu-toggle-btn"
                    className="text-gray-500 hover:text-primary-600 focus:outline-none"
                    aria-label="Toggle Menu"
                    title="Toggle Menu"
                  >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                      </svg>
                  </button>
                  <Logo className="h-5 w-auto" />
              </div>
              <TopNavActions user={user} onLogout={onLogout} />
           </div>
         </header>
        <main id="main-scroll-container" className="flex-1 bg-slate-50 dark:bg-slate-900 p-4 sm:p-6 lg:p-8 transition-colors pb-safe">
            <div className="min-h-full max-w-7xl mx-auto pb-8">
              <PageHeader />
              {children}
            </div>
        </main>
      </div>
      {showTour && (
          <OnboardingTour
              isPaymentsOnly={isPaymentsOnly}
              userId={user?.id || ''}
              onComplete={completeTour}
          />
      )}
    </div>
  );
};

export default AdminLayout;
