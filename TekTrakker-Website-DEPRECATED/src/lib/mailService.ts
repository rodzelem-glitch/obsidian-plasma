import { getBaseUrl } from "lib/utils";
import { db } from './firebase';

export interface EmailOptions {
    to: string | string[];
    subject: string;
    text?: string;
    html?: string;
    type?: string;
    organizationId?: string;
    bypassOptOut?: boolean; // Set to true for transactional emails like Invoices, OTPs
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

    const footerHtml = options.bypassOptOut ? '' : `
        <br><br>
        <hr style="border: none; border-top: 1px solid #eee; margin-top: 20px;">
        <p style="font-size: 12px; color: #666; text-align: center;">
            You received this email because you are subscribed to updates.
            <br>
            <a href="${getBaseUrl()}/#/unsubscribe?email={{recipient_email}}" style="color: #6366f1;">Manage Preferences or Unsubscribe</a>
        </p>
    `;

    // Note: Trigger Email extension doesn't natively swap {{recipient_email}} if using 'to' array with multiple people,
    // so it's best to send separate emails if there are multiple recipients, or just link generically.
    // For simplicity, we just use a generic unsubscribe link. Realistically, we can encode the email in the URL.
    
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

        const finalHtml = options.html ? options.html + pFooterHtml : (options.text ? options.text.replace(/\n/g, '<br>') + pFooterHtml : '');

        return db.collection('mail').add({
            to: email,
            message: {
                subject: options.subject,
                text: options.text,
                html: finalHtml
            },
            organizationId: options.organizationId || 'system',
            type: options.type || 'General',
            createdAt: new Date().toISOString()
        });
    });

    await Promise.all(sendPromises);
};
