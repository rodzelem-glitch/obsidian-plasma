
import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Building2, Users, ShieldCheck, CreditCard, Briefcase, UserCheck, FileText, BarChart2, MessageSquare, BrainCircuit } from 'lucide-react';
import type { User } from '../../types';

interface MasterSidebarProps {
  user: User;
  onLogout: () => void;
  isOpen?: boolean;
  onClose?: () => void;
}

const MasterSidebar: React.FC<MasterSidebarProps> = ({ user, onLogout, isOpen = false, onClose }) => {
  const location = useLocation();
  const navigate = useNavigate();

  const navItems = [
    { path: '/master/dashboard', label: 'Overview', icon: LayoutDashboard },
    { path: '/master/analytics', label: 'Platform Analytics', icon: BarChart2 },
    { path: '/master/ai-usage', label: 'AI Usage Metrics', icon: BrainCircuit },
    { path: '/master/organizations', label: 'Organizations', icon: Building2 },
    { path: '/master/members', label: 'Global Members', icon: ShieldCheck },
    { path: '/master/users', label: 'Global Users', icon: Users },
    { path: '/master/messages', label: 'Messages', icon: MessageSquare },
    { path: '/master/customers', label: 'Global Customers', icon: UserCheck },
    { path: '/master/compliance', label: 'Compliance Registry', icon: FileText },
    { path: '/master/billing', label: 'Platform Billing', icon: CreditCard },
    { path: '/master/sales-team', label: 'Sales Force', icon: Briefcase },
  ];

  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 z-20 bg-black bg-opacity-50 sm:hidden transition-opacity" onClick={onClose}></div>
      )}

      <aside className={`fixed sm:static inset-y-0 left-0 z-30 w-64 bg-slate-900 text-white border-r border-slate-800 transform transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : '-translate-x-full sm:translate-x-0'} flex flex-col h-full`}>
        <div className="flex items-center justify-center h-16 border-b border-slate-800 bg-slate-900 px-4">
            <span className="text-xl font-bold text-sky-400 truncate w-full text-center">Master Admin</span>
        </div>

        <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-1 custom-scrollbar">
            {navItems.map((item) => (
                <Link
                    key={item.path}
                    to={item.path}
                    onClick={onClose}
                    className={`flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors group ${
                        location.pathname.startsWith(item.path)
                            ? 'bg-sky-600 text-white'
                            : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                    }`}
                >
                    <item.icon className={`mr-3 h-5 w-5 flex-shrink-0 ${location.pathname.startsWith(item.path) ? 'text-white' : 'text-slate-400 group-hover:text-white'}`} />
                    {item.label}
                </Link>
            ))}
        </nav>

        <div className="p-4 border-t border-slate-800 bg-slate-900 space-y-3">
            <button
                onClick={() => navigate('/sales/dashboard')}
                className="w-full flex items-center justify-center px-4 py-2 border border-purple-500 text-purple-400 rounded-md shadow-sm text-sm font-medium bg-transparent hover:bg-purple-900/30 focus:outline-none transition-colors"
            >
                Switch to Sales View
            </button>

            <button
                onClick={() => navigate('/briefing')}
                className="w-full flex items-center justify-center px-4 py-2 border border-sky-500 text-sky-400 rounded-md shadow-sm text-sm font-medium bg-transparent hover:bg-sky-900/30 focus:outline-none transition-colors"
            >
                Switch to Tech View
            </button>

            <div className="flex items-center">
                <div className="h-8 w-8 rounded-full bg-sky-900 flex items-center justify-center text-sky-300 font-bold shrink-0">
                    {user.firstName ? user.firstName[0] : 'U'}
                </div>
                <div className="ml-3 overflow-hidden">
                    <p className="text-sm font-medium text-white truncate">{user.firstName} {user.lastName}</p>
                    <p className="text-xs text-slate-400">Platform Owner</p>
                </div>
            </div>
            <button onClick={onLogout} className="w-full flex items-center justify-center px-4 py-2 border border-slate-700 rounded-md shadow-sm text-sm font-medium text-slate-300 hover:bg-slate-800 focus:outline-none transition-colors">
                Log Out
            </button>
        </div>
      </aside>
    </>
  );
};

export default MasterSidebar;
