import { db } from './firebase';

export interface NotificationPayload {
    title: string;
    body: string;
    data?: Record<string, any>;
    type?: string;
}

/**
 * Sends a notification by adding it to the 'notifications' collection.
 * This should be picked up by a Firebase Cloud Function to send FCM/Push alerts.
 */
export const sendNotification = async (userId: string, payload: NotificationPayload, organizationId?: string) => {
    try {
        let orgId = organizationId;
        if (!orgId) {
            try {
                const u = await db.collection('users').doc(userId).get();
                orgId = u.data()?.organizationId || 'unaffiliated';
            } catch (err) {
                console.warn(`Could not fetch user ${userId} for notification org routing. Defaulting to unaffiliated.`, err);
                orgId = 'unaffiliated';
            }
        }

        await db.collection('notifications').add({
            userId,
            organizationId: orgId,
            ...payload,
            status: 'pending',
            createdAt: new Date().toISOString()
        });
    } catch (error) {
        console.error("Failed to send notification:", error);
    }
};

/**
 * Notifies all admin users in the organization.
 */
export const notifyAdmins = async (organizationId: string, payload: NotificationPayload) => {
    try {
        const adminsSnapshot = await db.collection('users')
            .where('organizationId', '==', organizationId)
            .where('role', 'in', ['admin', 'master_admin', 'both'])
            .get();

        const notifications = adminsSnapshot.docs.map(doc => sendNotification(doc.id, payload));
        await Promise.all(notifications);
    } catch (error) {
        console.error("Failed to notify admins:", error);
    }
};
/**
 * Centralized email sending utility that handles SMTP configurations and standard headers.
 */
export const sendEmail = async (org: any, payload: { to: string | string[], message: { subject: string, html: string, text?: string, from?: string, replyTo?: string }, type?: string, [key: string]: any }) => {
    try {
        // Sanitize payload (strip undefineds) and normalize emails
        const mailPayload: any = JSON.parse(JSON.stringify(payload));
        
        // Normalize 'to' field
        if (Array.isArray(mailPayload.to)) {
            mailPayload.to = mailPayload.to.map((e: any) => typeof e === 'string' ? e.toLowerCase().trim() : e);
        } else if (typeof mailPayload.to === 'string') {
            mailPayload.to = mailPayload.to.toLowerCase().trim();
        }

        mailPayload.organizationId = org?.id || 'unaffiliated';
        mailPayload.createdAt = new Date().toISOString();

        // Standardize message object
        if (!mailPayload.message) {
            mailPayload.message = { subject: 'Notification', html: 'Empty Notification' };
        }

        // Add a plain text version if missing for better deliverability
        if (mailPayload.message.html && !mailPayload.message.text) {
            mailPayload.message.text = mailPayload.message.html.replace(/<[^>]*>?/gm, '');
        }

        // In our new secure architecture, the frontend NEVER has access to the SMTP password.
        // We write the request to the 'mail_queue' collection.
        // A trusted Firebase Cloud Function will pick this up, securely inject the 'transport' passwords
        // from the locked 'secrets/config' document, and then forward it to the final 'mail' collection.
        
        const result = await db.collection('mail_queue').add(mailPayload);
        return result;
    } catch (error) {
        console.error("[NotificationService] ERROR sending email:", error);
        throw error;
    }
};
