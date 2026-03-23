
import React from 'react';
import type { User } from 'types';
import Header from './Header';
import BottomNav from './BottomNav';

const EmployeeLayout: React.FC<{ user: User; onLogout: () => void; children?: React.ReactNode }> = ({ user, onLogout, children }) => (
  <div className="flex flex-col h-screen font-sans text-gray-900 dark:text-gray-200 bg-gray-100 dark:bg-gray-900 transition-colors">
    <Header user={user} onLogout={onLogout} />
    <main className="flex-grow overflow-y-auto pb-24 pt-16">
      {children}
    </main>
    <BottomNav />
  </div>
);

export default EmployeeLayout;
