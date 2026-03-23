
import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import type { User } from 'types';
import { useAppContext } from 'context/AppContext';
import {
    DashboardIcon, UsersIcon, BuildingOfficeIcon,
    TimeLogIcon, ChatBubbleLeftRightIcon,
    WrenchScrewdriverIcon, FinancialIcon, BoxIcon,
    SettingsIcon, BadgeIcon, BriefcaseIcon,
    Shield, MegaphoneIcon, TrendingUp, Star, FileText,
    FolderKanban
} from '@constants';
import Modal from '../ui/Modal';
import { db } from 'lib/firebase';
import { Logo } from '../ui/Logo';

interface AdminSidebarProps {
  user: User;
  onLogout: () => void;
  isOpen?: boolean;
  onClose?: () => void;
}

const AdminSidebar: React.FC<AdminSidebarProps> = ({ user, onLogout, isOpen = false, onClose }) => {
  const { state, dispatch } = useAppContext();
  const navigate = useNavigate();
  const location = useLocation();
  const [isCustomizeOpen, setIsCustomizeOpen] = useState(false);
  const [orderedPaths, setOrderedPaths] = useState<string[]>([]);

  const companyName = state.currentOrganization?.name || 'TekTrakker';

  const allNavItems = [
    { path: '/admin/dashboard', label: 'Dashboard', icon: DashboardIcon, roles: ['admin', 'both', 'supervisor'] },
    { path: '/admin/analytics', label: 'Executive Analytics', icon: BadgeIcon, roles: ['admin', 'both'] },
    { path: '/admin/financials', label: 'Financials', icon: FinancialIcon, roles: ['admin', 'both'] },
    { path: '/admin/operations', label: 'Operations', icon: TimeLogIcon, roles: ['admin', 'both', 'supervisor'] },
    { path: '/admin/customers', label: 'Customer Center', icon: BuildingOfficeIcon, roles: ['admin', 'both'] },
    { path: '/admin/workforce', label: 'Workforce', icon: UsersIcon, roles: ['admin', 'both', 'supervisor'] },
    { path: '/admin/projects', label: 'Project Management', icon: FolderKanban, roles: ['admin', 'both', 'supervisor'] },
    { path: '/admin/messages', label: 'Messages', icon: ChatBubbleLeftRightIcon, roles: ['admin', 'both', 'supervisor'] },
    { path: '/admin/records', label: 'Records and assets', icon: BoxIcon, roles: ['admin', 'both'] },
    { path: '/admin/compliance', label: 'Compliance and safety', icon: Shield, roles: ['admin', 'both', 'supervisor'] },
    { path: '/admin/hiring', label: 'ATS', icon: BriefcaseIcon, roles: ['admin', 'both'] },
    { path: '/admin/estimator', label: 'Estimator settings', icon: WrenchScrewdriverIcon, roles: ['admin', 'both'] },
    { path: '/admin/settings', label: 'Settings', icon: SettingsIcon, roles: ['admin', 'both'] },
    { path: '/admin/contracts', label: 'Gov Contracts', icon: FileText, roles: ['admin', 'both'] },
    { path: '/admin/reviews', label: 'Reviews', icon: Star, roles: ['admin', 'both'] },
  ];

  // Initialize order from user prefs or default
  useEffect(() => {
      const prefs = user.preferences?.sidebarOrder;
      const defaultOrder = allNavItems.map(i => i.path);

      if (prefs && prefs.length > 0) {
          const mergedOrder = [...prefs];
          defaultOrder.forEach(p => {
              if (!mergedOrder.includes(p)) mergedOrder.push(p);
          });
          setOrderedPaths(mergedOrder);
      } else {
          setOrderedPaths(defaultOrder);
      }
  }, [user.preferences]);

  const isDemo = user.role === 'platform_sales' && state.currentOrganization?.id === 'demo-org-1766848718439';

  const sortedItems = allNavItems.filter(item => {
      let roleAllowed = false;
      if (user.role === 'master_admin' || user.role === 'admin' || user.role === 'both' || isDemo) roleAllowed = true;
      else if (user.role === 'supervisor') roleAllowed = item.roles.includes('supervisor');
      return roleAllowed;
  }).sort((a, b) => {
      const idxA = orderedPaths.indexOf(a.path);
      const idxB = orderedPaths.indexOf(b.path);
      return (idxA === -1 ? 999 : idxA) - (idxB === -1 ? 999 : idxB);
  });

  const moveItem = (index: number, direction: -1 | 1) => {
      const newOrder = [...orderedPaths];
      const itemToMove = sortedItems[index].path;
      const currentRealIndex = newOrder.indexOf(itemToMove);

      if (currentRealIndex === -1) return;

      const swapIndex = currentRealIndex + direction;
      if (swapIndex < 0 || swapIndex >= newOrder.length) return;

      [newOrder[currentRealIndex], newOrder[swapIndex]] = [newOrder[swapIndex], newOrder[currentRealIndex]];
      setOrderedPaths(newOrder);
  };

  const saveOrder = async () => {
      if (!user.id) return;
      try {
          // Use set with merge: true to ensure the document/field exists
          await db.collection('users').doc(user.id).set({
              preferences: { sidebarOrder: orderedPaths }
          }, { merge: true });

          dispatch({ type: 'UPDATE_EMPLOYEE', payload: { ...user, preferences: { ...user.preferences, sidebarOrder: orderedPaths } } });
          setIsCustomizeOpen(false);
      } catch (e) {
          console.error(e);
          alert("Failed to save preferences.");
      }
  };

  const toggleTheme = () => {
      dispatch({ type: 'TOGGLE_THEME' });
  };

  // Helper to check if user has access to multiple layouts
  const canSwitchToTech = user.role === 'both' || user.role === 'master_admin' || user.role === 'admin' || user.role === 'supervisor' || isDemo;

  return (
    <>
      <Modal isOpen={isCustomizeOpen} onClose={() => setIsCustomizeOpen(false)} title="Customize Menu Order">
          <div className="space-y-2 max-h-[60vh] overflow-y-auto custom-scrollbar">
              {sortedItems.map((item, idx) => (
                  <div key={item.path} className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700 rounded border border-gray-200 dark:border-gray-600">
                      <div className="flex items-center gap-2">
                          <item.icon size={16} className="text-gray-500"/>
                          <span className="text-sm font-medium text-gray-900 dark:text-white">{item.label}</span>
                      </div>
                      <div className="flex gap-1">
                          <button onClick={() => moveItem(idx, -1)} disabled={idx === 0} className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded disabled:opacity-30">↑</button>
                          <button onClick={() => moveItem(idx, 1)} disabled={idx === sortedItems.length - 1} className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded disabled:opacity-30">↓</button>
                      </div>
                  </div>
              ))}
          </div>
          <div className="flex justify-end gap-2 pt-4">
              <button onClick={() => setIsCustomizeOpen(false)} className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300">Cancel</button>
              <button onClick={saveOrder} className="px-4 py-2 text-sm bg-primary-600 text-white rounded hover:bg-primary-700">Save Order</button>
          </div>
      </Modal>

      {isOpen && (
        <div
          className="fixed inset-0 z-20 bg-black bg-opacity-50 sm:hidden transition-opacity"
          onClick={onClose}
        ></div>
      )}

      <aside
        className={`fixed sm:static inset-y-0 left-0 z-30 w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 transform transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full sm:translate-x-0'
        } flex flex-col h-full`}
      >
        <div className="flex items-center justify-center h-16 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 relative group">
            <Logo className="h-12 max-w-full" />
            <button
                onClick={() => setIsCustomizeOpen(true)}
                className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 text-gray-400 hover:text-primary-600 transition-opacity"
                title="Customize Menu"
            >
                <SettingsIcon size={14} />
            </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-1 custom-scrollbar">
            {sortedItems.map((item) => (
                <div key={item.path}>
                    <Link
                        to={item.path}
                        onClick={onClose}
                        className={`flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors group ${
                            location.pathname.startsWith(item.path)
                                ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400'
                                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                        }`}
                    >
                        <item.icon className={`mr-3 h-5 w-5 flex-shrink-0 ${
                            location.pathname.startsWith(item.path)
                                ? 'text-primary-600 dark:text-primary-400'
                                : 'text-gray-400 group-hover:text-gray-500 dark:group-hover:text-gray-300'
                        }`} />
                        {item.label}
                    </Link>
                </div>
            ))}
        </nav>

        <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 space-y-3">
            <button onClick={toggleTheme} className="w-full flex items-center justify-center px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 focus:outline-none transition-colors">
                {state.theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
            </button>

            {canSwitchToTech && (
                <button
                    onClick={() => navigate('/briefing')}
                    className="w-full flex items-center justify-center px-4 py-2 border border-primary-600 dark:border-primary-500 text-primary-600 dark:text-primary-400 rounded-md shadow-sm text-sm font-medium bg-transparent hover:bg-primary-50 dark:hover:bg-primary-900/20 focus:outline-none transition-colors"
                >
                    Switch to Tech View
                </button>
            )}

            <div className="flex items-center">
                <div className="h-8 w-8 rounded-full bg-primary-100 dark:bg-primary-900 flex items-center justify-center text-primary-700 dark:text-primary-300 font-bold shrink-0">
                    {user.firstName ? user.firstName[0] : 'U'}
                </div>
                <div className="ml-3 overflow-hidden">
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-200 truncate">{user.firstName} {user.lastName}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">{user.role ? user.role.replace('_', ' ') : 'User'}</p>
                </div>
            </div>
            <button
                onClick={onLogout}
                className="w-full flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none transition-colors"
            >
                Log Out
            </button>
        </div>
      </aside>
    </>
  );
};

export default AdminSidebar;
