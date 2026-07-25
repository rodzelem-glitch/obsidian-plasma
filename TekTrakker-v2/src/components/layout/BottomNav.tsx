
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { BriefingIcon, TimeLogIcon, CalculatorIcon, ChatBubbleLeftRightIcon } from '@constants';
import { CalendarDays } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { triggerHapticFeedback } from '../../lib/haptics';
import { useLanguage } from 'context/LanguageContext';

const navItems = [
  { path: '/briefing/', label: 'Briefing', icon: BriefingIcon, tourKey: 'briefing' },
  { path: '/briefing/scheduling', label: 'Schedule', icon: CalendarDays, tourKey: 'scheduling' },
  { path: '/briefing/timelog', label: 'Time', icon: TimeLogIcon, tourKey: 'timelog' },
  { path: '/briefing/tools', label: 'Tools', icon: CalculatorIcon, tourKey: 'tools' },
  { path: '/briefing/messages', label: 'Chat', icon: ChatBubbleLeftRightIcon, tourKey: 'messages' },
];

const BottomNav: React.FC = () => {
  const location = useLocation();
  const isIOS = Capacitor.getPlatform() === 'ios';
  const { t } = useLanguage();

  return (
    <nav className={`fixed bottom-0 left-0 right-0 border-t shadow-[0_-4px_20px_rgba(0,0,0,0.08)] z-50 pb-[env(safe-area-inset-bottom,0px)] ${isIOS ? 'bg-white/90 dark:bg-slate-950/90 backdrop-blur-xl border-slate-200/50 dark:border-slate-700/50' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'}`}>
      <div className="mx-auto max-w-7xl px-0.5">
        <div className="grid grid-cols-5 h-[68px]">
          {navItems.map((item) => {
            const isBriefingTab = item.path === '/briefing/';
            const isActive = isBriefingTab 
              ? (location.pathname === '/' || location.pathname === '/briefing' || location.pathname === '/briefing/')
              : location.pathname.startsWith(item.path);

            return (
              <Link
                key={item.path}
                to={item.path}
                data-tour={`nav-${item.tourKey}`}
                onClick={() => triggerHapticFeedback()}
                className={`flex flex-col items-center justify-center text-[10px] sm:text-[11px] font-bold transition-all duration-150 relative min-h-[48px] active:scale-95 touch-manipulation ${
                  isActive ? 'text-primary-600 dark:text-primary-400' : 'text-slate-400 dark:text-slate-500 hover:text-primary-500'
                }`}
              >
                {isActive && (
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-[3px] rounded-full bg-primary-500 shadow-sm" />
                )}
                <item.icon className={`w-5 h-5 sm:w-6 sm:h-6 mb-1 transition-transform duration-200 ${isActive ? 'scale-110' : ''}`} />
                <span className="truncate w-full text-center leading-tight px-0.5">{t(item.label)}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
};

export default BottomNav;
