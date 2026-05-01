
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
import { Logo } from '../ui/Logo';
import { useFeatureGating } from 'hooks/useFeatureGating';
import Modal from '../ui/Modal';
import { db } from 'lib/firebase';

interface AdminSidebarProps {
  user: User;
  onLogout: () => void;
  isOpen?: boolean;
  onClose?: () => void;
}

const AdminSidebar: React.FC<AdminSidebarProps> = ({ user, onLogout, isOpen = false, onClose }) => {
  const { state, dispatch } = useAppContext();
  const { hasFeature } = useFeatureGating();
  const navigate = useNavigate();
  const location = useLocation();
  const isDemo = user.role === 'platform_sales' && state.currentOrganization?.id === 'demo-org-1766848718439';

  const [isCustomizeOpen, setIsCustomizeOpen] = useState(false);
  const [orderedPaths, setOrderedPaths] = useState<string[]>([]);
  const [customLabels, setCustomLabels] = useState<Record<string, string>>({});

  const navGroups = [
    {
      group: 'Core Tracking',
      items: [
        { path: '/admin/dashboard', label: 'Dashboard', icon: DashboardIcon, roles: ['admin', 'both', 'supervisor'] },
        { path: '/admin/analytics', label: 'Executive Analytics', icon: BadgeIcon, roles: ['admin', 'both'] }
      ]
    },
    {
      group: 'Field & Operations',
      items: [
        { path: '/admin/operations', label: 'Operations', icon: TimeLogIcon, roles: ['admin', 'both', 'supervisor'] },
        { path: '/admin/workforce', label: 'Workforce', icon: UsersIcon, roles: ['admin', 'both', 'supervisor'] },
        { path: '/admin/projects', label: 'Project Management', icon: FolderKanban, roles: ['admin', 'both', 'supervisor'] },
        { path: '/admin/messages', label: 'Messages', icon: ChatBubbleLeftRightIcon, roles: ['admin', 'both', 'supervisor'] },
      ]
    },
    {
      group: 'Office & Finances',
      items: [
        { path: '/admin/customers', label: 'Customer Center', icon: BuildingOfficeIcon, roles: ['admin', 'both'] },
        { path: '/admin/financials', label: 'Financials', icon: FinancialIcon, roles: ['admin', 'both'] },
        { path: '/admin/contracts', label: 'Gov Contracts', icon: FileText, roles: ['admin', 'both'] },
      ]
    },
    {
      group: 'Sales & Marketing',
      items: [
        { path: '/admin/campaigns', label: 'Marketing Campaigns', icon: MegaphoneIcon, roles: ['admin', 'both'], featureKey: 'salesCrm' },
        { path: '/admin/reviews', label: 'Reviews', icon: Star, roles: ['admin', 'both'] },
      ]
    },
    {
      group: 'Backoffice & Compliance',
      items: [
        { path: '/admin/records', label: 'Records and assets', icon: BoxIcon, roles: ['admin', 'both'], featureKey: 'inventory' },
        { path: '/admin/compliance', label: 'Compliance and safety', icon: Shield, roles: ['admin', 'both', 'supervisor'], featureKey: 'hrDocuments' },
        { path: '/admin/hiring', label: 'ATS', icon: BriefcaseIcon, roles: ['admin', 'both'], featureKey: 'careerPage' },
        { path: '/admin/estimator', label: 'Estimator settings', icon: WrenchScrewdriverIcon, roles: ['admin', 'both'], featureKey: 'proposals' },
        { path: '/admin/settings', label: 'Settings', icon: SettingsIcon, roles: ['admin', 'both'] },
      ]
    },
    {
      group: 'Help & Training',
      items: [
        { path: '/admin/training', label: 'Video Training Hub', icon: BriefcaseIcon, roles: ['admin', 'both', 'supervisor'] }
      ]
    }
  ];

  useEffect(() => {
      const prefs = user.preferences?.sidebarOrder;
      const defaultOrder = navGroups.flatMap(g => g.items.map(i => i.path));

      if (prefs && prefs.length > 0) {
          const mergedOrder = [...prefs];
          defaultOrder.forEach(p => {
              if (!mergedOrder.includes(p)) mergedOrder.push(p);
          });
          setOrderedPaths(mergedOrder);
      } else {
          setOrderedPaths(defaultOrder);
      }
      
      if (user.preferences?.customLabels) {
          setCustomLabels(user.preferences.customLabels);
      } else {
          setCustomLabels({});
      }
  }, [user.preferences]);

  const processedGroups = navGroups.map(group => {
      const filteredItems = group.items.filter(item => {
          if (item.featureKey && !hasFeature(item.featureKey)) return false;
          let roleAllowed = false;
          if (user.role === 'master_admin' || user.role === 'admin' || user.role === 'both' || isDemo) roleAllowed = true;
          else if (user.role === 'supervisor') roleAllowed = item.roles.includes('supervisor');
          return roleAllowed;
      }).sort((a, b) => {
          const idxA = orderedPaths.indexOf(a.path);
          const idxB = orderedPaths.indexOf(b.path);
          return (idxA === -1 ? 999 : idxA) - (idxB === -1 ? 999 : idxB);
      }).map(i => ({ ...i, originalLabel: i.label, label: customLabels[i.path] || i.label }));
      
      return { ...group, originalGroup: group.group, group: customLabels[group.group] || group.group, items: filteredItems };
  }).filter(group => group.items.length > 0);

  const moveItemInGroup = (groupIndex: number, itemIndex: number, direction: -1 | 1) => {
      const newOrder = [...orderedPaths];
      const groupItems = processedGroups[groupIndex].items;
      // We rely on the original paths to determine movement logic
      const itemToMove = groupItems[itemIndex].path;
      const itemToSwapWith = groupItems[itemIndex + direction]?.path;
      
      if (!itemToSwapWith) return;

      const idx1 = newOrder.indexOf(itemToMove);
      const idx2 = newOrder.indexOf(itemToSwapWith);

      if (idx1 !== -1 && idx2 !== -1) {
          newOrder[idx1] = itemToSwapWith;
          newOrder[idx2] = itemToMove;
          setOrderedPaths(newOrder);
      }
  };

  const saveOrder = async () => {
      if (!user.id) return;
      try {
          await db.collection('users').doc(user.id).set({
              preferences: { sidebarOrder: orderedPaths, customLabels }
          }, { merge: true });

          dispatch({ type: 'UPDATE_EMPLOYEE', payload: { ...user, preferences: { ...user.preferences, sidebarOrder: orderedPaths, customLabels } } });
          setIsCustomizeOpen(false);
      } catch (e) {
          console.error(e);
          alert("Failed to save preferences.");
      }
  };

  const resetToDefaults = async () => {
      if (!user.id) return;
      if (!window.confirm("Are you sure you want to revert to the default platform navigation? All custom names will be lost.")) return;
      try {
          await db.collection('users').doc(user.id).set({
              preferences: { sidebarOrder: null, customLabels: null }
          }, { merge: true });

          const defaultOrder = navGroups.flatMap(g => g.items.map(i => i.path));
          setOrderedPaths(defaultOrder);
          setCustomLabels({});
          
          dispatch({ type: 'UPDATE_EMPLOYEE', payload: { ...user, preferences: { ...user.preferences, sidebarOrder: undefined, customLabels: undefined } } });
          setIsCustomizeOpen(false);
      } catch (e) {
          console.error(e);
          alert("Failed to reset preferences.");
      }
  };

  const toggleTheme = () => {
      dispatch({ type: 'TOGGLE_THEME' });
  };

  // Helper to check if user has access to multiple layouts
  const canSwitchToTech = user.role === 'both' || user.role === 'master_admin' || user.role === 'admin' || user.role === 'supervisor' || isDemo;

  return (
    <>
      <Modal isOpen={isCustomizeOpen} onClose={() => setIsCustomizeOpen(false)} title="Customize Menu Layout">
          <div className="space-y-4 max-h-[60vh] overflow-y-auto custom-scrollbar p-1">
              <p className="text-xs text-gray-500 bg-gray-100 dark:bg-gray-800 p-2 rounded mb-2">You can click on any group title or page name to dynamically rename them!</p>
              {processedGroups.map((group, grpIdx) => (
                  <div key={group.originalGroup} className="border border-gray-200 dark:border-gray-600 p-3 rounded-lg bg-gray-50 dark:bg-gray-800">
                      <input 
                          value={customLabels[group.originalGroup] !== undefined ? customLabels[group.originalGroup] : group.originalGroup}
                          onChange={(e) => setCustomLabels({...customLabels, [group.originalGroup]: e.target.value})}
                          placeholder={group.originalGroup}
                          className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3 bg-transparent border-b border-dashed border-gray-300 dark:border-gray-600 focus:outline-none focus:border-primary-500 hover:border-gray-400 w-full"
                      />
                      <div className="space-y-2">
                      {group.items.map((item, idx) => (
                          <div key={item.path} className="flex justify-between items-center p-2 bg-white dark:bg-gray-700 rounded shadow-sm border border-gray-100 dark:border-gray-600">
                              <div className="flex flex-1 items-center gap-2">
                                  <item.icon size={16} className="text-gray-500 shrink-0"/>
                                  <input 
                                      value={customLabels[item.path] !== undefined ? customLabels[item.path] : (item as any).originalLabel}
                                      onChange={(e) => setCustomLabels({...customLabels, [item.path]: e.target.value})}
                                      placeholder={(item as any).originalLabel}
                                      className="text-sm font-medium text-gray-900 dark:text-white bg-transparent border-b border-dashed border-transparent hover:border-gray-300 dark:hover:border-gray-600 focus:outline-none focus:border-primary-500 w-full max-w-[200px]"
                                  />
                              </div>
                              <div className="flex gap-1 shrink-0 ml-2">
                                  <button onClick={() => moveItemInGroup(grpIdx, idx, -1)} disabled={idx === 0} className="w-6 h-6 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-600 rounded disabled:opacity-30 text-gray-600 dark:text-gray-300">↑</button>
                                  <button onClick={() => moveItemInGroup(grpIdx, idx, 1)} disabled={idx === group.items.length - 1} className="w-6 h-6 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-600 rounded disabled:opacity-30 text-gray-600 dark:text-gray-300">↓</button>
                              </div>
                          </div>
                      ))}
                      </div>
                  </div>
              ))}
          </div>
          <div className="flex justify-between items-center pt-4 border-t border-gray-200 dark:border-gray-700 mt-2">
              <button onClick={resetToDefaults} className="text-sm text-red-600 font-medium hover:text-red-800 transition-colors">Reset Defaults</button>
              <div className="flex gap-2">
                  <button onClick={() => setIsCustomizeOpen(false)} className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300 transition-colors hover:text-gray-900">Cancel</button>
                  <button onClick={saveOrder} className="px-4 py-2 text-sm bg-primary-600 text-white rounded hover:bg-primary-700 transition-colors shadow-sm">Save Layout</button>
              </div>
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
        <div className="flex items-center justify-center h-16 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 relative group pt-safe">
            <Logo className="h-12 max-w-full" />
            <button
                onClick={() => setIsCustomizeOpen(true)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-primary-600 transition-colors p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700"
                title="Customize Navigation Layout"
            >
                <SettingsIcon size={20} />
            </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-1 custom-scrollbar">
            {processedGroups.map((group, gIdx) => (
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
                        ))}
                    </div>
                </div>
            ))}
        </nav>

        <div className="p-4 pb-[calc(1rem+var(--sab,env(safe-area-inset-bottom,0px)))] border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 space-y-3">
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
