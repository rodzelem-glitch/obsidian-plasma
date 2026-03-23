
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { User } from 'types';
import AdminSidebar from './AdminSidebar';
import { Logo } from '../ui/Logo';

interface AdminLayoutProps {
  user: User;
  onLogout: () => void;
  children?: React.ReactNode;
}

const AdminLayout: React.FC<AdminLayoutProps> = ({ user, onLogout, children }) => {
  const navigate = useNavigate();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-200 font-sans transition-colors">
      <AdminSidebar 
        user={user} 
        onLogout={onLogout} 
        isOpen={isSidebarOpen} 
        onClose={() => setIsSidebarOpen(false)} 
      />
      
      <div className="flex-1 flex flex-col overflow-hidden">
         <header className="bg-white dark:bg-gray-900 shadow-md sm:hidden border-b border-gray-200 dark:border-gray-700 fixed top-0 w-full z-20 transition-colors">
           <div className="px-4 h-16 flex items-center justify-between">
              <div className="flex items-center gap-3">
                  <button 
                    onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                    className="text-gray-500 hover:text-primary-600 focus:outline-none"
                  >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                      </svg>
                  </button>
                  <Logo className="h-10 w-auto" />
              </div>
           </div>
         </header>
         
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-100 dark:bg-gray-800 p-4 sm:p-6 lg:p-8 pt-20 sm:pt-6 transition-colors">
          {children}
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
