
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { BriefingIcon, TimeLogIcon, CalculatorIcon, WrenchScrewdriverIcon, ChatBubbleLeftRightIcon, PaymentsIcon } from '@constants';

const navItems = [
  { path: '/briefing/', label: 'Briefing', icon: BriefingIcon },
  { path: '/briefing/timelog', label: 'Time Log', icon: TimeLogIcon },
  { path: '/briefing/proposal', label: 'Estimator', icon: WrenchScrewdriverIcon },
  { path: '/briefing/payments', label: 'Payments', icon: PaymentsIcon },
  { path: '/briefing/tools', label: 'Tools', icon: CalculatorIcon },
  { path: '/briefing/messages', label: 'Chat', icon: ChatBubbleLeftRightIcon },
];

const BottomNav: React.FC = () => {
  const location = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-gray-800 border-t border-gray-700 shadow-lg z-50">
      <div className="mx-auto max-w-7xl px-2 sm:px-6 lg:px-8">
        <div className="grid grid-cols-6 h-20">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex flex-col items-center justify-center text-[10px] sm:text-sm font-medium transition-colors duration-200 ${
                  isActive ? 'text-primary-400' : 'text-gray-400 hover:text-primary-400'
                }`}
              >
                <item.icon className="w-5 h-5 sm:w-6 sm:h-6 mb-1" />
                <span className="truncate w-full text-center">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
};

export default BottomNav;
