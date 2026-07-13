
import React from 'react';
import type { User } from 'types';
import Header from './Header';
import BottomNav from './BottomNav';
import VirtualWorker from '../ui/VirtualWorker';
import { LiveSupportFloatingButton } from '../common/LiveSupportComponent';

const EmployeeLayout: React.FC<{ user: User; onLogout: () => void; children?: React.ReactNode }> = ({ user, onLogout, children }) => (
  <div className="flex flex-col h-screen font-sans text-gray-900 dark:text-gray-200 bg-gray-100 dark:bg-gray-900 transition-colors overflow-hidden relative">
    <Header user={user} onLogout={onLogout} />
    <main 
      className="flex-grow overflow-y-auto overflow-x-hidden pb-[84px] pt-[calc(3.5rem+env(safe-area-inset-top,0px))]" 
      id="main-scroll-container"
    >
        <div className="min-h-full">
           {children}
        </div>
    </main>
    <BottomNav />

  </div>
);

export default EmployeeLayout;
