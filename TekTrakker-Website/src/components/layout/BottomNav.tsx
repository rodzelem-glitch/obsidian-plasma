
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { BriefingIcon, TimeLogIcon, CalculatorIcon, WrenchScrewdriverIcon, ChatBubbleLeftRightIcon, PaymentsIcon } from '@constants';
import { Capacitor } from '@capacitor/core';
import { triggerHapticFeedback } from '../../lib/haptics';

const navItems = [
  { path: '/briefing/', label: 'Briefing', icon: BriefingIcon },
  { path: '/briefing/timelog', label: 'Time', icon: TimeLogIcon },
  { path: '/briefing/proposal', label: 'Estimator', icon: WrenchScrewdriverIcon },
  { path: '/briefing/payments', label: 'Payments', icon: PaymentsIcon },
  { path: '/briefing/tools', label: 'Tools', icon: CalculatorIcon },
  { path: '/briefing/messages', label: 'Chat', icon: ChatBubbleLeftRightIcon },
];

const BottomNav: React.FC = () => {
  const location = useLocation();
  const isIOS = Capacitor.getPlatform() === 'ios';

  return (
    <nav className={`fixed bottom-0 left-0 right-0 border-t shadow-[0_-4px_20px_rgba(0,0,0,0.08)] z-50 pb-[env(safe-area-inset-bottom,0px)] ${isIOS ? 'bg-white/80 dark:bg-slate-950/80 backdrop-blur-xl border-slate-200/50 dark:border-slate-700/50' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'}`}>
      <div className="mx-auto max-w-7xl px-1">
        <div className="grid grid-cols-6 h-[68px]">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => triggerHapticFeedback()}
                className={`flex flex-col items-center justify-center text-[11px] font-semibold transition-all duration-200 relative ${
                  isActive ? 'text-primary-600 dark:text-primary-400' : 'text-slate-400 dark:text-slate-500 hover:text-primary-500'
                }`}
              >
                {isActive && (
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-[3px] rounded-full bg-primary-500" />
                )}
                <item.icon className={`w-6 h-6 mb-1 transition-transform duration-200 ${isActive ? 'scale-110' : ''}`} />
                <span className="truncate w-full text-center leading-tight">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
};

export default BottomNav;
