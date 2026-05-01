
import React from 'react';
import type { User } from 'types';
import { Logo } from '../ui/Logo';

const CustomerLayout: React.FC<{ user: User; onLogout: () => void; children?: React.ReactNode }> = ({ user, onLogout, children }) => (
  <div className="flex flex-col h-screen font-sans text-gray-900 dark:text-gray-200 bg-gray-100 dark:bg-gray-900 transition-colors overflow-hidden">
    <header className="bg-white dark:bg-gray-800 shadow border-b border-gray-200 dark:border-gray-700 py-4 px-6 sticky top-0 z-50 pt-[calc(1rem+env(safe-area-inset-top,0px))]">
        <div className="flex justify-between items-center max-w-7xl mx-auto w-full">
            <Logo className="h-5 w-auto" />
            <div className="flex items-center gap-4">
                <span className="text-sm font-medium text-gray-600 dark:text-gray-300 hidden sm:block">{user.firstName}</span>
                <button onClick={onLogout} className="text-sm font-medium text-red-500 hover:text-red-700">Logout</button>
            </div>
        </div>
    </header>
    <main className="flex-grow overflow-y-auto" id="main-scroll-container">

        <div className="min-h-full">
           {children}
        </div>    </main>
    <footer className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 py-6 text-center text-xs text-gray-500">
        &copy; {new Date().getFullYear()} TekTrakker Inc.
    </footer>
  </div>
);

export default CustomerLayout;
