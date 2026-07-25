
import React from 'react';
import type { User } from 'types';
import Header from './Header';
import BottomNav from './BottomNav';

import OnboardingTour, { useOnboardingTour } from '../ui/OnboardingTour';

const EmployeeLayout: React.FC<{ user: User; onLogout: () => void; children?: React.ReactNode }> = ({ user, onLogout, children }) => {
  const { showTour, completeTour } = useOnboardingTour(user?.id);

  return (
    <div className="flex flex-col min-h-[100dvh] font-sans text-gray-900 dark:text-gray-200 bg-gray-100 dark:bg-gray-900 transition-colors relative">
      <Header user={user} onLogout={onLogout} />
      <main 
        className="flex-grow pb-[calc(88px+env(safe-area-inset-bottom,0px))] pt-[calc(3.5rem+env(safe-area-inset-top,0px))] touch-pan-y" 
        id="main-scroll-container"
      >
          <div className="min-h-full">
             {children}
          </div>
      </main>
      <BottomNav />
      {showTour && (
          <OnboardingTour
              isTechView={true}
              userId={user?.id || ''}
              onComplete={completeTour}
          />
      )}
    </div>
  );
};

export default EmployeeLayout;
