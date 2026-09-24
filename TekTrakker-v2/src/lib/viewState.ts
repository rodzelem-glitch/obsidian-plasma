import type { User } from '../types';
import { db } from './firebase';

export type ActiveViewMode = 'tech' | 'admin' | 'master' | 'sales' | 'customer';

/**
 * Retrieves the user's active view mode preference from profile preferences or local device storage.
 */
export const getActiveView = (user?: User | null): string | null => {
    if (user?.preferences && typeof user.preferences === 'object' && (user.preferences as any).activeView) {
        return (user.preferences as any).activeView as string;
    }
    if (typeof window !== 'undefined') {
        if (user?.id) {
            const savedUserView = localStorage.getItem(`tt_last_active_view_${user.id}`);
            if (savedUserView) return savedUserView;
        }
        const savedGlobalView = localStorage.getItem('tt_last_active_view');
        if (savedGlobalView) return savedGlobalView;
    }
    return null;
};

const lastPersistedViews: Record<string, string> = {};
let persistTimeout: any = null;

/**
 * Persists the active view mode both immediately to local device storage and asynchronously to Firestore user preferences.
 */
export const setActiveView = (view: ActiveViewMode, userId?: string): void => {
    if (typeof window !== 'undefined') {
        localStorage.setItem('tt_last_active_view', view);
        if (userId) {
            localStorage.setItem(`tt_last_active_view_${userId}`, view);
        }
    }
    if (!userId || !db) return;

    // Fast return: if already persisted for this user in this session, avoid redundant writes
    if (lastPersistedViews[userId] === view) {
        return;
    }

    lastPersistedViews[userId] = view;

    if (persistTimeout) {
        clearTimeout(persistTimeout);
    }

    persistTimeout = setTimeout(() => {
        db.collection('users').doc(userId).set({
            preferences: { activeView: view }
        }, { merge: true }).catch((err) => {
            console.warn('[viewState] Failed to persist activeView in Firestore:', err);
            delete lastPersistedViews[userId];
        });
    }, 1500);
};

/**
 * Resolves the primary redirect path for a user taking into account sticky view preferences (e.g. Tech View vs Admin View).
 */
export const resolveUserRedirectPath = (user: User | null, isMasterAdmin: boolean): string => {
    if (!user) return '/login';
    if ((user.role as string) === 'kort_tester') return '/admin/kort-playground';

    const preferredView = getActiveView(user);

    // Multi-role users who can access Admin, Tech, Master, or Sales views
    const canAccessAdmin = isMasterAdmin || user.role === 'admin' || user.role === 'both' || user.role === 'supervisor' || user.role === 'master_admin';
    const canAccessTech = isMasterAdmin || user.role === 'admin' || user.role === 'both' || user.role === 'supervisor' || user.role === 'master_admin' || user.role === 'employee' || user.role === 'Technician' || user.role === 'Subcontractor';
    const canAccessMaster = isMasterAdmin || user.role === 'franchise_admin';
    const canAccessSales = user.role === 'platform_sales' || isMasterAdmin;

    // Platform Master Admins should always default to /master/dashboard unless explicitly switching to tech or sales
    const isPlatformMaster = isMasterAdmin || user.role === 'master_admin';
    if (isPlatformMaster && preferredView !== 'tech' && preferredView !== 'employee' && preferredView !== 'sales') {
        return '/master/dashboard';
    }

    if (preferredView === 'tech' || preferredView === 'employee') {
        if (canAccessTech) {
            if (!user.organizationId || user.organizationId === 'unaffiliated') {
                return '/marketplace';
            }
            return '/briefing';
        }
    } else if (preferredView === 'admin') {
        if (canAccessAdmin) return '/admin/dashboard';
    } else if (preferredView === 'sales') {
        if (canAccessSales) return '/sales/dashboard';
    } else if (preferredView === 'master') {
        if (canAccessMaster) return '/master/dashboard';
    } else if (preferredView === 'customer') {
        if (user.role === 'customer') {
            return (!user.organizationId || user.organizationId === 'unaffiliated') ? '/marketplace' : '/portal';
        }
    }

    // Default fallbacks based on primary role
    if (isMasterAdmin || user.role === 'franchise_admin') return '/master/dashboard';
    if (user.role === 'platform_sales') return '/sales/dashboard';
    if (user.role === 'admin' || user.role === 'both' || user.role === 'supervisor') return '/admin/dashboard';
    if (user.role === 'customer') {
        if (!user.organizationId || user.organizationId === 'unaffiliated') {
            return '/marketplace';
        }
        return '/portal';
    }
    if (user.role === 'employee' || user.role === 'Subcontractor' || user.role === 'Technician') {
        if (!user.organizationId || user.organizationId === 'unaffiliated') {
            return '/marketplace';
        }
        return '/briefing';
    }

    const path = (!user.organizationId || user.organizationId === 'unaffiliated' || !user.role) ? '/marketplace' : '/login';
    return path;
};
