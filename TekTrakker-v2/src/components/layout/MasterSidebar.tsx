
import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Building2, Users, ShieldCheck, CreditCard, Briefcase, UserCheck, FileText, BarChart2, MessageSquare, BrainCircuit, Database, Moon, Sun, Network, Megaphone } from 'lucide-react';
import type { User } from '../../types';
import { useAppContext } from '../../context/AppContext';

interface MasterSidebarProps {
  user: User;
  onLogout: () => void;
  isOpen?: boolean;
  onClose?: () => void;
}

const MasterSidebar: React.FC<MasterSidebarProps> = ({ user, onLogout, isOpen = false, onClose }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { state, dispatch } = useAppContext();



  const navGroups = [
    {
      group: 'Core Admin',
      items: [
        { path: '/master/dashboard', label: 'Overview', icon: LayoutDashboard },
        { path: '/master/analytics', label: 'Platform Analytics', icon: BarChart2 },
        { path: '/master/integration-requests', label: 'Integration Requests', icon: Network },
        { path: '/master/campaigns', label: 'Campaign Studio', icon: Megaphone },
        { path: '/master/ai-usage', label: 'AI Usage Metrics', icon: BrainCircuit },
        { path: '/master/ai-reports', label: 'AI Worker Reports', icon: FileText },
        { path: '/master/storage-usage', label: 'Storage Metrics', icon: Database },
      ]
    },
    {
      group: 'Tenant Management',
      items: [
        { path: '/master/organizations', label: 'Organizations', icon: Building2 },
        { path: '/master/franchises', label: 'Franchises & White-Label', icon: Network },
        { path: '/master/billing', label: 'Platform Billing', icon: CreditCard },
        { path: '/master/franchise-billing', label: 'Franchise Billing', icon: CreditCard },
        { path: '/master/members', label: 'Global Members', icon: ShieldCheck },
        { path: '/master/compliance', label: 'Compliance Registry', icon: FileText },
      ]
    },
    {
      group: 'People & Communication',
      items: [
        { path: '/master/users', label: 'Global Users', icon: Users },
        { path: '/master/customers', label: 'Global Customers', icon: UserCheck },
        { path: '/master/sales-team', label: 'Sales Force', icon: Briefcase },
        { path: '/master/messages', label: 'Messages', icon: MessageSquare },
      ]
    }
  ];

  const isPlatformOwner = state.isMasterAdmin;
  const isFranchiseAdmin = user.role === 'franchise_admin';

  let filteredNavGroups = navGroups.map(group => {
     let filteredItems = group.items;
     if (isFranchiseAdmin && !isPlatformOwner) {
         const excludePaths = [
             '/master/billing',
             '/master/analytics'
         ];
         filteredItems = filteredItems.filter(item => !excludePaths.includes(item.path));
         
         filteredItems = filteredItems.map(item => {
             if (item.path === '/master/franchises') {
                  return { ...item, label: 'Settings & Branding' };
             }
             if (item.label.includes('Global ') || item.label.includes('Platform ')) {
                 return { ...item, label: item.label.replace('Global ', '').replace('Platform ', '') };
             }
             return item;
         });
     } else if (isPlatformOwner) {
         // Platform owner excludes franchise billing
         const excludePaths = ['/master/franchise-billing'];
         filteredItems = filteredItems.filter(item => !excludePaths.includes(item.path));
     }
     return { ...group, items: filteredItems };
  }).filter(group => group.items.length > 0);

  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 z-20 bg-black bg-opacity-50 sm:hidden transition-opacity" onClick={onClose}></div>
      )}

      <aside className={`fixed sm:static inset-y-0 left-0 z-30 w-64 bg-white dark:bg-slate-800 text-slate-900 dark:text-white border-r border-slate-200 dark:border-slate-700 transform transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : '-translate-x-full sm:translate-x-0'} flex flex-col h-full`}>
        <div className="flex items-center justify-center h-16 border-b border-slate-200 dark:border-slate-700 px-4 pt-safe">
            <span className="text-xl font-bold text-primary-600 dark:text-primary-400 truncate w-full text-center">Master Admin</span>
        </div>

        <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-1 custom-scrollbar">
            {filteredNavGroups.map((group, gIdx) => (
                <div key={gIdx} className="mb-6">
                    <h3 className="px-4 mb-2 text-xs font-bold text-slate-400 uppercase tracking-widest">{group.group}</h3>
                    <div className="space-y-1">
                        {group.items.map((item) => (
                            <Link
                                key={item.path}
                                to={item.path}
                                onClick={onClose}
                                className={`flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors group ${
                                    location.pathname.startsWith(item.path)
                                        ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400'
                                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white'
                                }`}
                            >
                                <item.icon className={`mr-3 h-5 w-5 flex-shrink-0 ${location.pathname.startsWith(item.path) ? 'text-primary-600 dark:text-primary-400' : 'text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300'}`} />
                                {item.label}
                            </Link>
                        ))}
                    </div>
                </div>
            ))}
        </nav>

        <div className="p-4 pb-[calc(1rem+var(--sab,env(safe-area-inset-bottom,0px)))] border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 space-y-3">
            {isPlatformOwner && (
                <button
                    onClick={() => navigate('/sales/dashboard')}
                    className="w-full flex items-center justify-center px-4 py-2 border border-purple-500 text-purple-400 rounded-md shadow-sm text-sm font-medium bg-transparent hover:bg-purple-900/30 focus:outline-none transition-colors"
                >
                    Switch to Sales View
                </button>
            )}



            <div className="flex items-center">
                <div className="h-8 w-8 rounded-full bg-primary-100 dark:bg-primary-900 flex items-center justify-center text-primary-700 dark:text-primary-300 font-bold shrink-0">
                    {user.firstName ? user.firstName[0] : 'U'}
                </div>
                <div className="ml-3 overflow-hidden">
                    <p className="text-sm font-medium text-slate-700 dark:text-white truncate">{user.firstName} {user.lastName}</p>
                    <p className="text-xs text-slate-500 truncate">{isPlatformOwner ? 'Platform Owner' : 'Franchise Partner'}</p>
                </div>
            </div>
            <button onClick={onLogout} className="w-full flex items-center justify-center px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 focus:outline-none transition-colors">
                Log Out
            </button>
        </div>
      </aside>
    </>
  );
};

export default MasterSidebar;
