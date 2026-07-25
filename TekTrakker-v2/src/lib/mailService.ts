import { getBaseUrl , cleanUndefinedFields } from "lib/utils";
import { db } from './firebase';

export interface EmailOptions {
    to: string | string[];
    subject?: string;
    text?: string;
    html?: string;
    type?: string;
    organizationId?: string;
    bypassOptOut?: boolean; // Set to true for transactional emails like Invoices, OTPs
    attachments?: any[];
    replyTo?: string;
    message?: {
        subject?: string;
        text?: string;
        html?: string;
        attachments?: any[];
        replyTo?: string;
    };
    skipAutoLog?: boolean;
}

export const sendEmail = async (options: EmailOptions) => {
    let recipients = Array.isArray(options.to) ? options.to : [options.to];
    
    // Check opt-outs
    if (!options.bypassOptOut) {
        const allowedRecipients = [];
        for (const email of recipients) {
            // Check global unsubscribe list
            const unsubDoc = await db.collection('unsubscribes').doc(email).get();
            if (!unsubDoc.exists) {
                allowedRecipients.push(email);
            }
        }
        recipients = allowedRecipients;
    }

    if (recipients.length === 0) return; // Everyone logged out

    const sendPromises = recipients.map(email => {
        const pFooterHtml = options.bypassOptOut ? '' : `
            <br><br>
            <hr style="border: none; border-top: 1px solid #eee; margin-top: 20px;">
            <p style="font-size: 12px; color: #666; text-align: center;">
                You received this email because you are subscribed to updates.
                <br>
                <a href="${getBaseUrl()}/#/unsubscribe?email=${encodeURIComponent(email)}" style="color: #6366f1;">Manage Preferences or Unsubscribe</a>
            </p>
        `;

        const subject = options.subject || options.message?.subject || 'Notification';
        const rawHtml = options.html || options.message?.html;
        const rawText = options.text || options.message?.text || '';
        const attachments = options.attachments || options.message?.attachments || [];
        const replyTo = options.replyTo || options.message?.replyTo;

        const finalHtml = rawHtml ? rawHtml + pFooterHtml : (rawText ? rawText.replace(/\n/g, '<br>') + pFooterHtml : '');

        const mailDoc: any = {
            to: email,
            message: {
                subject: subject,
                text: rawText,
                html: finalHtml,
                ...(replyTo ? { replyTo } : {}),
                ...(attachments.length > 0 ? { attachments } : {})
            },
            organizationId: options.organizationId || 'system',
            type: options.type || 'General',
            createdAt: new Date().toISOString()
        };

        return db.collection('mail_queue').add(cleanUndefinedFields(mailDoc));
    });

    await Promise.all(sendPromises);
};
