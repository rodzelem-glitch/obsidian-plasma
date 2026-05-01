
import React, { useState, useEffect, useMemo } from 'react';
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
import { globalConfirm } from "lib/globalConfirm";
import showToast from "lib/toast";

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
  const [hiddenPaths, setHiddenPaths] = useState<string[]>([]);
  const [isCollapsedPreference, setIsCollapsedPreference] = useState(() => {
     if (typeof window !== 'undefined') {
         return localStorage.getItem('sidebar-collapsed') === 'true';
     }
     return false;
  });
  
  const [isMobile, setIsMobile] = useState(() => {
      if (typeof window !== 'undefined') {
          return window.innerWidth < 640;
      }
      return false;
  });

  useEffect(() => {
      const handleResize = () => {
          setIsMobile(window.innerWidth < 640);
      };
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isCollapsed = isCollapsedPreference && !isMobile;

  const handleToggleCollapse = () => {
      const newVal = !isCollapsedPreference;
      setIsCollapsedPreference(newVal);
      localStorage.setItem('sidebar-collapsed', String(newVal));
  };

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
        { path: '/admin/hr', label: 'HR & Payroll', icon: BriefcaseIcon, roles: ['admin', 'both'] },
        { path: '/admin/projects', label: 'Project Management', icon: FolderKanban, roles: ['admin', 'both', 'supervisor'] },
        { path: '/admin/messages', label: 'Messages', icon: ChatBubbleLeftRightIcon, roles: ['admin', 'both', 'supervisor'] },
      ]
    },
    {
      group: 'Office & Finances',
      items: [
        { path: '/admin/customers', label: 'Customer Center', icon: BuildingOfficeIcon, roles: ['admin', 'both'] },
        { path: '/admin/financials', label: 'Financials', icon: FinancialIcon, roles: ['admin', 'both'] },
        { path: '/admin/contracts', label: 'Bid Optimization', icon: FileText, roles: ['admin', 'both'] },
        { path: '/admin/contractor-network', label: 'Contractor Network', icon: UsersIcon, roles: ['admin', 'both'] },
      ]
    },
    {
      group: 'Sales & Marketing',
      items: [
        { path: '/admin/marketing-hub', label: 'Sales & Marketing Hub', icon: MegaphoneIcon, roles: ['admin', 'both'], featureKey: 'salesCrm' },
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
        { path: '/admin/ai-reports', label: 'AI Worker Reports', icon: FileText, roles: ['admin', 'both', 'supervisor'] },
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
      const defaultOrder = navGroups.flatMap(g => [`__group__:${g.group}`, ...g.items.map(i => i.path)]);

      if (prefs && Array.isArray(prefs) && prefs.length > 0) {
          let mergedOrder = [...prefs];
          
          if (!mergedOrder.some(p => p.startsWith('__group__:'))) {
               mergedOrder = [];
               navGroups.forEach(g => {
                   mergedOrder.push(`__group__:${g.group}`);
                   g.items.forEach(i => {
                       if (prefs.includes(i.path)) mergedOrder.push(i.path);
                   });
               });
          }
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

      if (user.preferences?.hiddenSidebarPaths) {
          setHiddenPaths(user.preferences.hiddenSidebarPaths);
      } else {
          setHiddenPaths([]);
      }
  }, [user.preferences]);

  const allItemsRecord = useMemo(() => navGroups.reduce((acc, g) => {
      g.items.forEach(i => {
          acc[i.path] = i;
      });
      return acc;
  }, {} as Record<string, any>), []);

  const processedItems = orderedPaths.map(path => {
      if (path.startsWith('__group__:')) {
          const originalGroup = path.split('__group__:')[1];
          return { isGroup: true, originalGroup, label: customLabels[originalGroup] || originalGroup, path };
      } else {
          const item = allItemsRecord[path];
          if (!item) return null;
          if (item.featureKey && !hasFeature(item.featureKey)) return null;
          let roleAllowed = false;
          if (user.role === 'master_admin' || user.role === 'admin' || user.role === 'both' || isDemo) roleAllowed = true;
          else if (user.role === 'supervisor') roleAllowed = item.roles.includes('supervisor');
          if (!roleAllowed) return null;

          return { isGroup: false, ...item, originalLabel: item.label, label: customLabels[item.path] || item.label, path };
      }
  }).filter(Boolean) as any[];

  const moveGlobalItem = (currentIndex: number, direction: -1 | 1) => {
      if (currentIndex + direction < 0 || currentIndex + direction >= processedItems.length) return;
      
      const newOrder = [...orderedPaths];
      
      const itemToMoveStr = processedItems[currentIndex].path;
      const itemToSwapStr = processedItems[currentIndex + direction].path;

      const idx1 = newOrder.indexOf(itemToMoveStr);
      const idx2 = newOrder.indexOf(itemToSwapStr);

      if (idx1 !== -1 && idx2 !== -1) {
          newOrder[idx1] = itemToSwapStr;
          newOrder[idx2] = itemToMoveStr;
          setOrderedPaths(newOrder);
      }
  };

  const saveOrder = async () => {
      if (!user.id) return;
      try {
          await db.collection('users').doc(user.id).set({
              preferences: { sidebarOrder: orderedPaths, customLabels, hiddenSidebarPaths: hiddenPaths }
          }, { merge: true });

          dispatch({ type: 'UPDATE_EMPLOYEE', payload: { ...user, preferences: { ...user.preferences, sidebarOrder: orderedPaths, customLabels, hiddenSidebarPaths: hiddenPaths } } });
          setIsCustomizeOpen(false);
      } catch (e) {
          console.error(e);
          showToast.error("Failed to save preferences.");
      }
  };

  const resetToDefaults = async () => {
      if (!user.id) return;
      if (!window.confirm("Are you sure you want to revert to the default platform navigation? All custom names will be lost.")) return;
      try {
          await db.collection('users').doc(user.id).set({
              preferences: { sidebarOrder: null, customLabels: null, hiddenSidebarPaths: null }
          }, { merge: true });

          const defaultOrder = navGroups.flatMap(g => g.items.map(i => i.path));
          setOrderedPaths(defaultOrder);
          setCustomLabels({});
          setHiddenPaths([]);
          
          dispatch({ type: 'UPDATE_EMPLOYEE', payload: { ...user, preferences: { ...user.preferences, sidebarOrder: undefined, customLabels: undefined, hiddenSidebarPaths: undefined } } });
          setIsCustomizeOpen(false);
      } catch (e) {
          console.error(e);
          showToast.error("Failed to reset preferences.");
      }
  };


  const toggleHidden = (path: string) => {
      setHiddenPaths(prev => prev.includes(path) ? prev.filter(p => p !== path) : [...prev, path]);
  };

  // Helper to check if user has access to multiple layouts
  const canSwitchToTech = user.role === 'both' || user.role === 'master_admin' || user.role === 'admin' || user.role === 'supervisor' || isDemo;

  return (
    <>
      <Modal isOpen={isCustomizeOpen} onClose={() => setIsCustomizeOpen(false)} title="Customize Menu Layout">
          <div className="space-y-2 max-h-[60vh] overflow-y-auto custom-scrollbar p-1">
              <p className="text-xs text-gray-500 bg-gray-100 dark:bg-gray-800 p-2 rounded mb-2">You can click on any group title or page name to dynamically rename them. Move items anywhere or click the eye icon to hide them permanently.</p>
              {processedItems.map((item, idx) => {
                  const isHidden = hiddenPaths.includes(item.path);
                  return (
                  <div key={item.path} className={`flex justify-between items-center p-2 rounded shadow-sm border transition-opacity ${isHidden ? 'opacity-40' : 'opacity-100'} ${item.isGroup ? 'bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-600 mt-4' : 'bg-white dark:bg-gray-700 ml-4 border-gray-100 dark:border-gray-600'}`}>
                      <div className="flex flex-1 items-center gap-2">
                          <button onClick={() => toggleHidden(item.path)} className="w-6 h-6 flex items-center justify-center shrink-0 hover:bg-gray-200 dark:hover:bg-gray-600 rounded text-gray-500 transition-colors" title={isHidden ? "Show in Sidebar" : "Hide from Sidebar"}>
                              {isHidden ? (
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                              ) : (
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                              )}
                          </button>
                          {!item.isGroup && <item.icon size={16} className="text-gray-500 shrink-0"/>}
                          <input 
                              value={customLabels[item.isGroup ? item.originalGroup : item.path] !== undefined ? customLabels[item.isGroup ? item.originalGroup : item.path] : (item.isGroup ? item.originalGroup : item.originalLabel)}
                              onChange={(e) => setCustomLabels({...customLabels, [item.isGroup ? item.originalGroup : item.path]: e.target.value})}
                              placeholder={item.isGroup ? item.originalGroup : item.originalLabel}
                              className={`bg-transparent border-b border-dashed border-transparent hover:border-gray-300 dark:hover:border-gray-600 focus:outline-none focus:border-primary-500 w-full ${item.isGroup ? 'text-xs font-bold text-gray-700 uppercase tracking-widest' : 'text-sm font-medium text-gray-900 dark:text-white max-w-[200px]'}`}
                          />
                      </div>
                      <div className="flex gap-1 shrink-0 ml-2">
                          <button onClick={() => moveGlobalItem(idx, -1)} disabled={idx === 0} className="w-6 h-6 flex items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-600 rounded disabled:opacity-30 text-gray-600 dark:text-gray-300">↑</button>
                          <button onClick={() => moveGlobalItem(idx, 1)} disabled={idx === processedItems.length - 1} className="w-6 h-6 flex items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-600 rounded disabled:opacity-30 text-gray-600 dark:text-gray-300">↓</button>
                      </div>
                  </div>
              )})}
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
          className="fixed inset-0 z-[90] bg-black bg-opacity-50 sm:hidden transition-opacity"
          onClick={onClose}
        ></div>
      )}

      <aside
        className={`fixed sm:static inset-y-0 left-0 z-[100] ${isCollapsed ? 'w-20' : 'w-64'} bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700/80 transform transition-all duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full sm:translate-x-0'
        } flex flex-col h-[100dvh] max-h-screen`}
      >
        <div className="flex items-center justify-center h-16 border-b border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-800 p-2 relative group pt-safe overflow-hidden shrink-0">
            {!isCollapsed ? (
                <Logo className="h-10 sm:h-12 max-w-full" />
            ) : (
                <div className="text-2xl font-black text-primary-600 dark:text-primary-400 select-none">T</div>
            )}
            
            {!isCollapsed && (
                <button
                    onClick={() => setIsCustomizeOpen(true)}
                    className="absolute right-8 sm:right-10 top-1/2 -translate-y-1/2 text-slate-300 hover:text-primary-600 transition-colors p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700"
                    title="Customize Navigation Layout"
                >
                    <SettingsIcon size={16} />
                </button>
            )}

            <button
                onClick={handleToggleCollapse}
                className={`absolute right-1 top-1/2 -translate-y-1/2 text-slate-400 hover:text-primary-600 transition-colors p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 hidden sm:flex`}
                title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
            >
                <svg className={`w-5 h-5 transition-transform duration-300 ${isCollapsed ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" /></svg>
            </button>
        </div>

        <nav className="flex-1 overflow-y-auto overflow-x-hidden overscroll-contain py-4 px-2 space-y-1 custom-scrollbar">
            {processedItems.map((item, idx) => {
                if (hiddenPaths.includes(item.path)) return null;
                
                if (item.isGroup) {
                    return (
                        <h3 key={item.path} className={`px-2 md:px-4 mb-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest ${idx > 0 ? 'mt-6' : ''} ${isCollapsed ? 'flex justify-center' : ''}`}>
                            {isCollapsed ? <div className="w-8 h-px bg-slate-200 dark:bg-slate-600" /> : item.label}
                        </h3>
                    );
                } else {
                    return (
                        <Link
                            key={item.path}
                            to={item.path}
                            onClick={onClose}
                            title={isCollapsed ? item.label : undefined}
                            className={`flex items-center ${isCollapsed ? 'justify-center px-0' : 'px-4'} py-2.5 text-sm font-medium rounded-lg transition-all duration-150 group ${
                                location.pathname.startsWith(item.path)
                                    ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 border-l-[3px] border-primary-500 ml-0 pl-[13px]'
                                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50 border-l-[3px] border-transparent'
                            }`}
                        >
                            <item.icon className={`${isCollapsed ? 'mr-0' : 'mr-3'} h-5 w-5 flex-shrink-0 transition-all ${
                                location.pathname.startsWith(item.path)
                                    ? 'text-primary-600 dark:text-primary-400'
                                    : 'text-gray-400 group-hover:text-gray-500 dark:group-hover:text-gray-300'
                            }`} />
                            {!isCollapsed && <span className="truncate whitespace-nowrap">{item.label}</span>}
                        </Link>
                    );
                }
            })}
        </nav>

        <div className={`p-4 pb-[calc(1rem+var(--sab,env(safe-area-inset-bottom,0px)))] border-t border-slate-200 dark:border-slate-700/80 bg-slate-50 dark:bg-slate-800/80 space-y-3 ${isCollapsed ? 'px-2 flex flex-col items-center' : ''}`}>

            {canSwitchToTech && (
                <button
                    onClick={() => navigate('/briefing')}
                    title={isCollapsed ? "Switch to Tech View" : undefined}
                    className={`w-full flex items-center justify-center px-4 py-2 border border-primary-600 dark:border-primary-500 text-primary-600 dark:text-primary-400 rounded-md shadow-sm text-sm font-medium bg-transparent hover:bg-primary-50 dark:hover:bg-primary-900/20 focus:outline-none transition-colors ${isCollapsed ? 'px-0' : ''}`}
                >
                    {isCollapsed ? (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                    ) : (
                        'Switch to Tech View'
                    )}
                </button>
            )}

            <div className={`flex items-center ${isCollapsed ? 'justify-center w-full' : ''}`}>
                <div className="h-8 w-8 rounded-full bg-primary-100 dark:bg-primary-900 flex items-center justify-center text-primary-700 dark:text-primary-300 font-bold shrink-0">
                    {user.firstName ? user.firstName[0] : 'U'}
                </div>
                {!isCollapsed && (
                    <div className="ml-3 overflow-hidden transition-opacity">
                        <p className="text-sm font-medium text-gray-700 dark:text-gray-200 truncate">{user.firstName} {user.lastName}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">{user.role ? user.role.replace('_', ' ') : 'User'}</p>
                    </div>
                )}
            </div>
            {!isCollapsed && (
                <button
                    onClick={onLogout}
                    className="w-full flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none transition-colors"
                >
                    Log Out
                </button>
            )}
            {isCollapsed && (
                <button
                    onClick={onLogout}
                    title="Log Out"
                    className="w-full flex items-center justify-center py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none transition-colors"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                </button>
            )}
        </div>
      </aside>
    </>
  );
};

export default AdminSidebar;
