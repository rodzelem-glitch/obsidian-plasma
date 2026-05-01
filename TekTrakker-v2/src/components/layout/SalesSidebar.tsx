
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, DollarSign, Target, FileText, Wrench, Receipt, Rocket, MessageSquare } from 'lucide-react';
import type { User } from '../../types';
import { Logo } from '../ui/Logo';

interface SalesSidebarProps {
  user: User;
  onLogout: () => void;
  isOpen?: boolean;
  onClose?: () => void;
}

const SalesSidebar: React.FC<SalesSidebarProps> = ({ user, onLogout, isOpen = false, onClose }) => {
  const location = useLocation();

  const navGroups = [
    {
        group: 'Sales Pipeline',
        items: [
            { path: '/sales/dashboard', label: 'Overview', icon: LayoutDashboard },
            { path: '/sales/leads', label: 'My Leads', icon: Users },
            { path: '/sales/pipeline', label: 'Pipeline', icon: Target },
        ]
    },
    {
        group: 'Outreach',
        items: [
            { path: '/sales/campaigns', label: 'Campaigns', icon: Rocket },
            { path: '/sales/messages', label: 'Messages', icon: MessageSquare },
        ]
    },
    {
        group: 'Enablement',
        items: [
            { path: '/sales/resources', label: 'Resources', icon: FileText },
            { path: '/sales/tools', label: 'Tools & UTM', icon: Wrench },
        ]
    },
    {
        group: 'Backoffice',
        items: [
            { path: '/sales/commissions', label: 'Commissions', icon: DollarSign },
            { path: '/sales/expenses', label: 'Expenses & Tax', icon: Receipt },
        ]
    }
  ];

  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 z-20 bg-black bg-opacity-50 sm:hidden transition-opacity" onClick={onClose}></div>
      )}

      <aside className={`fixed sm:static inset-y-0 left-0 z-30 w-64 bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 transform transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : '-translate-x-full sm:translate-x-0'} flex flex-col h-full`}>
        <div className="flex items-center justify-center h-16 border-b border-slate-200 dark:border-slate-700 px-4 pt-safe">
            <Logo className="h-8 w-auto" />
            <span className="ml-2 text-xs font-black text-primary-600 uppercase tracking-widest border border-primary-200 rounded px-1">SALES</span>
        </div>

        <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-1 custom-scrollbar">
            {navGroups.map((group, gIdx) => (
                <div key={gIdx} className="mb-6">
                    <h3 className="px-4 mb-2 text-xs font-bold text-slate-400 uppercase tracking-widest">{group.group}</h3>
                    <div className="space-y-1">
                        {group.items.map((item) => (
                            <Link
                                key={item.path}
                                to={item.path}
                                onClick={onClose}
                                className={`flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors group ${
                                    location.pathname === item.path
                                        ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400'
                                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'
                                }`}
                            >
                                <item.icon className={`mr-3 h-5 w-5 flex-shrink-0 ${location.pathname === item.path ? 'text-primary-600 dark:text-primary-400' : 'text-slate-400 group-hover:text-slate-600'}`} />
                                {item.label}
                            </Link>
                        ))}
                    </div>
                </div>
            ))}
        </nav>

        <div className="p-4 pb-[calc(1rem+var(--sab,env(safe-area-inset-bottom,0px)))] border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 space-y-3">
            <div className="flex items-center">
                <div className="h-8 w-8 rounded-full bg-primary-100 dark:bg-primary-900 flex items-center justify-center text-primary-700 dark:text-primary-300 font-bold shrink-0">
                    {user.firstName ? user.firstName[0] : 'U'}
                </div>
                <div className="ml-3 overflow-hidden">
                    <p className="text-sm font-medium text-slate-700 dark:text-white truncate">{user.firstName} {user.lastName}</p>
                    <p className="text-xs text-slate-500 truncate">Platform Sales</p>
                </div>
            </div>
            {user.role === 'master_admin' && (
                <button
                    onClick={() => window.location.href = '/#/master/dashboard'}
                    className="w-full mb-3 flex items-center justify-center px-4 py-2 border border-purple-500 text-purple-600 dark:text-purple-400 rounded-md shadow-sm text-sm font-medium bg-transparent hover:bg-purple-50 dark:hover:bg-purple-900/30 focus:outline-none transition-colors"
                >
                    Return to Master Admin
                </button>
            )}
            <button onClick={onLogout} className="w-full flex items-center justify-center px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 focus:outline-none transition-colors">
                Log Out
            </button>
        </div>
      </aside>
    </>
  );
};

export default SalesSidebar;
