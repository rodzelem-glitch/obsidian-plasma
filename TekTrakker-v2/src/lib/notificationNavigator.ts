import { cleanUndefinedFields } from './utils';
import { db, firebase } from './firebase';
import type { Notification, User } from 'types';

/**
 * Evaluates whether a notification has been read by the current user.
 * Supports individual notification flags (read: true) as well as broadcast
 * multi-recipient read tracking (readBy: string[]).
 */
export const isNotificationRead = (
    notification: Partial<Notification> | null | undefined,
    currentUser?: User | null
): boolean => {
    if (!notification) return true;
    if (notification.read === true) return true;

    if (currentUser && Array.isArray(notification.readBy)) {
        if (currentUser.id && notification.readBy.includes(currentUser.id)) return true;
        if (currentUser.email && notification.readBy.includes(currentUser.email)) return true;
    }

    return false;
};

/**
 * Resolves the destination URL for a notification with full role awareness.
 * Automatically handles routing differences between Admin, Technician/Employee,
 * Master Admin, Sales, and Customer roles.
 */
export const getNotificationTargetUrl = (
    notification: Partial<Notification> | null | undefined,
    currentUser?: User | null
): string | null => {
    if (!notification) return null;

    const data = notification.data || {};
    const notifType = (notification.type || data.type || '').toLowerCase();
    const explicitLink = notification.link || notification.url || data.url || data.link || data.targetUrl;

    const role = currentUser?.role || 'employee';
    const isTechOrEmployee = role === 'employee' || role === 'Technician' || role === 'Subcontractor';
    const isAdmin = role === 'admin' || role === 'master_admin' || role === 'both' || role === 'supervisor';
    const isMasterAdmin = role === 'master_admin';
    const isCustomer = role === 'customer';

    // 1. Direct Explicit Link Handling with Role-Aware Path Translation
    if (explicitLink && typeof explicitLink === 'string' && explicitLink.trim() !== '' && explicitLink !== '/') {
        let cleanLink = explicitLink.trim();
        // Remove hash prefix if present for uniform React Router navigation
        cleanLink = cleanLink.replace(/^(\/#\/|#\/)/, '/');
        if (!cleanLink.startsWith('/')) cleanLink = `/${cleanLink}`;

        // If tech/employee receives an admin-prefixed link, translate to employee route
        if (isTechOrEmployee) {
            if (cleanLink.startsWith('/admin/messages') || cleanLink.startsWith('/admin/communications')) {
                return cleanLink.replace(/^\/admin\/(messages|communications)/, '/briefing/communications');
            }
            if (cleanLink.startsWith('/messages') || cleanLink.startsWith('/communications')) {
                return `/briefing${cleanLink}`;
            }
            if (cleanLink.startsWith('/admin/jobs') || cleanLink.startsWith('/admin/operations') || cleanLink.startsWith('/admin/dispatch')) {
                const urlObj = new URL(`http://localhost${cleanLink}`);
                const jId = urlObj.searchParams.get('jobId') || urlObj.searchParams.get('search') || data.jobId;
                return jId ? `/briefing?jobId=${jId}` : '/briefing';
            }
            if (cleanLink.startsWith('/admin/proposals') || cleanLink.startsWith('/admin/proposal')) {
                return '/briefing/proposal';
            }
        }

        // If admin receives an employee-prefixed link, translate to admin route
        if (isAdmin) {
            if (cleanLink.startsWith('/briefing/messages') || cleanLink.startsWith('/briefing/communications')) {
                return cleanLink.replace(/^\/briefing\/(messages|communications)/, '/admin/communications');
            }
        }

        return cleanLink;
    }

    // 2. Derive Destination from Notification Type & Data Payloads

    // --- A. Messages & Chat ---
    if (notifType === 'message' || notifType === 'broadcast' || notifType === 'chat' || notifType === 'sms_received') {
        const senderId = data.senderId || notification.senderId;
        const customerId = data.customerId;
        const partnerParam = senderId ? `&partner=${encodeURIComponent(senderId)}` : '';
        const custParam = customerId ? `&customerId=${encodeURIComponent(customerId)}` : '';

        if (isCustomer) {
            return '/portal';
        }
        if (isTechOrEmployee) {
            if (customerId) return `/briefing/communications?tab=customers${custParam}`;
            return `/briefing/communications?tab=team${partnerParam}`;
        }
        if (isMasterAdmin) {
            if (customerId) return `/master/communications?tab=customers${custParam}`;
            return `/master/communications?tab=team${partnerParam}`;
        }
        // Default Admin
        if (customerId) return `/admin/communications?tab=customers${custParam}`;
        return `/admin/communications?tab=team${partnerParam}`;
    }

    // --- B. Job Assignment, Reschedule, or Status Update ---
    if (
        notifType === 'job_assignment' ||
        notifType === 'job_rescheduled' ||
        notifType === 'job_update' ||
        notifType === 'new_job' ||
        notifType === 'reopennotification'
    ) {
        const jobId = data.jobId || data.id;
        if (isCustomer) {
            return '/portal';
        }
        if (isTechOrEmployee) {
            return jobId ? `/briefing?jobId=${encodeURIComponent(jobId)}` : '/briefing';
        }
        return jobId ? `/admin/operations?tab=jobs&jobId=${encodeURIComponent(jobId)}` : '/admin/operations';
    }

    // --- C. Job Needs Review (Tech finished job) ---
    if (notifType === 'job_needs_review' || notifType === 'job_completed') {
        const jobId = data.jobId || data.id;
        if (isTechOrEmployee) {
            return jobId ? `/briefing?jobId=${encodeURIComponent(jobId)}` : '/briefing';
        }
        return jobId ? `/admin/operations?tab=jobs&jobId=${encodeURIComponent(jobId)}` : '/admin/operations';
    }

    // --- D. Invoice Signed & Invoice Paid ---
    if (
        notifType === 'invoice_signed' ||
        notifType === 'invoice_paid' ||
        notifType === 'payment_received' ||
        notifType === 'deposit_paid'
    ) {
        const jobId = data.jobId || data.id || data.invoiceId;
        if (jobId) {
            return `/invoice/${encodeURIComponent(jobId)}`;
        }
        if (isAdmin) {
            return '/admin/records?tab=invoices';
        }
        return isTechOrEmployee ? '/briefing' : '/portal';
    }

    // --- E. Proposal Accepted, Signed, or Shared ---
    if (
        notifType === 'proposal_accepted' ||
        notifType === 'proposal_signed' ||
        notifType === 'proposal_share_warning' ||
        notifType === 'proposal'
    ) {
        const proposalId = data.proposalId || data.id;
        if (proposalId) {
            return `/proposal-view/${encodeURIComponent(proposalId)}`;
        }
        if (isAdmin) {
            return '/admin/records?tab=proposals';
        }
        return isTechOrEmployee ? '/briefing/proposal' : '/portal';
    }

    // --- F. Subcontractor Compliance & Document Alerts ---
    if (
        notifType === 'subcontractor_compliance' ||
        notifType === 'compliance_alert' ||
        notifType === 'compliance'
    ) {
        if (isAdmin) {
            return '/admin/contracting';
        }
        return '/briefing';
    }

    // --- G. System Alerts & Verification Audits ---
    if (notifType === 'system_alert' || notifType === 'alert') {
        if (isAdmin) {
            return '/admin/dashboard/alerts';
        }
        return isTechOrEmployee ? '/briefing' : '/portal';
    }

    // --- H. Fallback for Role ---
    if (isCustomer) return '/portal';
    if (isTechOrEmployee) return '/briefing';
    if (isMasterAdmin) return '/master/dashboard';
    return '/admin/dashboard';
};

/**
 * Persists read state to Firestore for a single notification document.
 */
export const markNotificationInDb = async (
    notificationId: string,
    currentUser?: User | null
): Promise<void> => {
    if (!notificationId) return;
    try {
        const updateData: Record<string, any> = { read: true };
        if (currentUser?.id || currentUser?.email) {
            const userIdentifiers = [currentUser.id, currentUser.email].filter(Boolean) as string[];
            updateData.readBy = firebase.firestore.FieldValue.arrayUnion(...userIdentifiers);
        }
        await db.collection('notifications').doc(notificationId).update(cleanUndefinedFields(updateData));
    } catch (err) {
        console.warn(`[NotificationNavigator] Could not update notification ${notificationId} in Firestore:`, err);
    }
};

/**
 * Persists read state to Firestore for a batch of notifications (e.g. Mark all as read).
 */
export const markAllNotificationsInDb = async (
    notifications: (Partial<Notification> | { id: string })[],
    currentUser?: User | null
): Promise<void> => {
    if (!notifications || notifications.length === 0) return;
    try {
        const userIdentifiers = [currentUser?.id, currentUser?.email].filter(Boolean) as string[];
        const updatePayload: Record<string, any> = { read: true };
        if (userIdentifiers.length > 0) {
            updatePayload.readBy = firebase.firestore.FieldValue.arrayUnion(...userIdentifiers);
        }

        const BATCH_SIZE = 50;
        for (let i = 0; i < notifications.length; i += BATCH_SIZE) {
            const chunk = notifications.slice(i, i + BATCH_SIZE);
            const batch = db.batch();
            chunk.forEach(n => {
                if (n.id) {
                    const docRef = db.collection('notifications').doc(n.id);
                    batch.update(docRef, cleanUndefinedFields(updatePayload));
                }
            });
            await batch.commit().catch(err => {
                console.warn("[NotificationNavigator] Batch mark all as read error, falling back to individual updates:", err);
                chunk.forEach(n => {
                    if (n.id) {
                        db.collection('notifications').doc(n.id).update(cleanUndefinedFields(updatePayload)).catch(() => {});
                    }
                });
            });
        }
    } catch (err) {
        console.warn("[NotificationNavigator] markAllNotificationsInDb failed:", err);
    }
};

/**
 * Complete click handler for in-app bell items and native/web notification action handlers.
 * Marks the notification as read, updates local state, and navigates immediately to the destination.
 */
export const handleNotificationClick = async (
    notification: Partial<Notification>,
    options: {
        currentUser?: User | null;
        navigate?: (url: string) => void;
        dispatch?: (action: any) => void;
        onComplete?: () => void;
    }
): Promise<void> => {
    const { currentUser, navigate, dispatch, onComplete } = options;

    if (notification.id) {
        // 1. Optimistically update local reducer state
        if (dispatch) {
            dispatch({
                type: 'MARK_NOTIFICATION_READ',
                payload: {
                    id: notification.id,
                    userId: currentUser?.id,
                    userEmail: currentUser?.email
                }
            });
        }

        // 2. Persist to Firestore
        markNotificationInDb(notification.id, currentUser).catch(() => {});
    }

    // 3. Resolve destination URL
    const targetUrl = getNotificationTargetUrl(notification, currentUser);

    if (onComplete) {
        onComplete();
    }

    // 4. Navigate to destination
    if (targetUrl) {
        if (navigate) {
            navigate(targetUrl);
        } else {
            // Fallback for native push handler outside React Router context
            const cleanRoute = targetUrl.replace(/^(\/#\/|#\/)/, '/');
            window.location.hash = `#${cleanRoute.startsWith('/') ? cleanRoute : `/${cleanRoute}`}`;
        }
    }
};
