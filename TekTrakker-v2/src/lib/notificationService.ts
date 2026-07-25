import { cleanUndefinedFields } from './utils';
import { db, auth } from './firebase';

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
        if (userId === 'rodzelem@gmail.com' || userId === 'ryanvavrecan@gmail.com') {
            // Forward to actual master admins instead of the email string
            const masterAdminsSnapshot = await db.collection('users')
                .where('role', '==', 'master_admin')
                .get();
            
            for (const doc of masterAdminsSnapshot.docs) {
                await sendNotification(doc.id, payload, organizationId || 'platform');
            }
            return;
        }

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

        await db.collection('notifications').add(cleanUndefinedFields({
            userId,
            organizationId: orgId,
            ...payload,
            status: 'pending',
            createdAt: new Date().toISOString()
        }));
    } catch (error) {
        console.error("Failed to send notification:", error);
    }
};

/**
 * Notifies all admin users in the organization.
 */
export const notifyAdmins = async (organizationId: string, payload: NotificationPayload) => {
    // Check if user is logged in before querying the user database on client-side.
    // Anonymous/unauthenticated guests don't have read access to the users collection.
    if (!auth.currentUser || auth.currentUser.isAnonymous) {
        console.info("[Notification] Unauthenticated/anonymous user: Offloading admin notification to backend trigger.");
        return;
    }

    try {
        const adminsSnapshot = await db.collection('users')
            .where('organizationId', '==', organizationId)
            .where('role', 'in', ['admin', 'master_admin', 'both'])
            .get();

        const adminIds = adminsSnapshot.docs.map(doc => doc.id);
        

        const BATCH_SIZE = 50;
        for (let i = 0; i < adminIds.length; i += BATCH_SIZE) {
            const chunk = adminIds.slice(i, i + BATCH_SIZE);
            const notifications = chunk.map(id => sendNotification(id, payload));
            await Promise.all(notifications);
        }
    } catch (error) {
        console.error("Failed to notify admins:", error);
    }
};

/**
 * Centralized email sending utility that handles SMTP configurations and standard headers.
 */
export const sendEmail = async (org: any, payload: { to: string | string[], message: { subject: string, html: string, text?: string, from?: string, replyTo?: string, attachments?: any[] }, type?: string, [key: string]: any }) => {
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

        // Protect against Firestore 1MB document size limit when sending emails with heavy PDF attachments
        if (Array.isArray(mailPayload.message?.attachments)) {
            mailPayload.message.attachments = mailPayload.message.attachments.map((att: any) => {
                const attCopy = { ...att };
                if (attCopy.path && attCopy.content && attCopy.content.length > 500000) {
                    console.info(`Attachment ${attCopy.filename} exceeds 500KB inline limit; relying on Storage path: ${attCopy.path}`);
                    delete attCopy.content;
                }
                return attCopy;
            });
        }

        const result = await db.collection('mail_queue').add(cleanUndefinedFields(mailPayload));

        // Auto-log outgoing communication to 'messages' and customer communications subcollection (unless caller specified skipAutoLog)
        if (!mailPayload.skipAutoLog) {
            try {
                const firstTo = Array.isArray(mailPayload.to) ? mailPayload.to[0] : (mailPayload.to || '');
                const toRecipients = Array.isArray(mailPayload.to) ? mailPayload.to.join(', ') : (mailPayload.to || '');
                const subjectStr = mailPayload.message?.subject || mailPayload.type || 'Email Sent';
                const bodyStr = mailPayload.message?.text || mailPayload.message?.html?.replace(/<[^>]*>?/gm, '') || '';
                const nowIso = new Date().toISOString();

                let targetCustId = mailPayload.customerId || null;

                // If targetCustId not directly in payload, lookup by email
                if (!targetCustId && firstTo) {
                    const custSnap = await db.collection('customers')
                        .where('email', '==', firstTo.toLowerCase().trim())
                        .limit(1)
                        .get()
                        .catch(() => null);
                    if (custSnap && !custSnap.empty) {
                        targetCustId = custSnap.docs[0].id;
                    }
                }

                // 1. Record in global messages collection
                const msgObj: any = {
                    id: `msg-auto-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                    senderId: 'staff',
                    senderName: 'Staff System',
                    receiverId: firstTo,
                    customerId: targetCustId,
                    to: toRecipients,
                    content: bodyStr.slice(0, 500),
                    subject: subjectStr,
                    timestamp: nowIso,
                    createdAt: nowIso,
                    organizationId: org?.id || null,
                    type: 'email'
                };
                await db.collection('messages').doc(msgObj.id).set(cleanUndefinedFields(msgObj)).catch(() => {});

                // 2. Record in customer communications subcollection
                if (targetCustId) {
                    const commEntry = {
                        id: `comm-auto-${Date.now()}`,
                        type: mailPayload.type || 'email_out',
                        title: subjectStr,
                        subtitle: `To: ${toRecipients}`,
                        content: bodyStr.slice(0, 500),
                        badgeLabel: mailPayload.type || 'Email Sent',
                        badgeColor: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400',
                        timestamp: nowIso,
                        senderName: 'System'
                    };
                    await db.collection('customers').doc(targetCustId).collection('communications').doc(commEntry.id).set(cleanUndefinedFields(commEntry)).catch(() => {});
                }
            } catch (logErr) {
                console.warn("Non-fatal: Could not auto-log communication", logErr);
            }
        }

        return result;
    } catch (error) {
        console.error("[NotificationService] ERROR sending email:", error);
        throw error;
    }
};
