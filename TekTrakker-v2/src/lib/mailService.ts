import { getBaseUrl , cleanUndefinedFields } from "lib/utils";
import { db } from './firebase';
import { generateUserEmailSignatureHtml } from './signatureHelper';
import { sanitizeEmailAttachments } from './notificationService';

export interface EmailOptions {
    to: string | string[];
    subject?: string;
    text?: string;
    html?: string;
    type?: string;
    organizationId?: string;
    organization?: any;
    senderUser?: any;
    includeSignature?: boolean;
    bypassOptOut?: boolean; // Set to true for transactional emails like Invoices, OTPs
    attachments?: any[];
    replyTo?: string;
    from?: string;
    message?: {
        subject?: string;
        text?: string;
        html?: string;
        attachments?: any[];
        replyTo?: string;
        from?: string;
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

    let orgName = (options.organization?.name || options.organization?.businessName || '').trim();
    let orgEmail = options.organization?.email;

    const targetOrgId = options.organization?.id || options.organizationId;
    if (!orgName && targetOrgId && targetOrgId !== 'system' && targetOrgId !== 'platform' && targetOrgId !== 'unaffiliated') {
        try {
            const orgDoc = await db.collection('organizations').doc(targetOrgId).get();
            if (orgDoc.exists) {
                const orgData = orgDoc.data();
                orgName = (orgData?.name || orgData?.businessName || '').trim();
                orgEmail = orgEmail || orgData?.email;
            }
        } catch { /* fallback */ }
    }

    const defaultFrom = orgName 
        ? `"${orgName.replace(/"/g, "'")}" <platform@tektrakker.com>` 
        : 'TekTrakker <platform@tektrakker.com>';
    const resolvedFrom = options.from || options.message?.from || defaultFrom;
    const resolvedReplyTo = options.replyTo || options.message?.replyTo || orgEmail || 'Operations@tekairinc.com';

    const rawAttachments = options.attachments || options.message?.attachments || [];
    const sanitizedAttachments = await sanitizeEmailAttachments(rawAttachments, targetOrgId);

    const sendPromises = recipients.map(async email => {
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
        const replyTo = options.replyTo || options.message?.replyTo;

        let finalHtml = rawHtml ? rawHtml + pFooterHtml : (rawText ? rawText.replace(/\n/g, '<br>') + pFooterHtml : '');

        // Append sender signature if provided and not yet embedded
        if (options.senderUser && options.includeSignature !== false) {
            const sigHtml = options.senderUser.emailSignatureHtml || generateUserEmailSignatureHtml(options.senderUser, options.organization);
            if (sigHtml && !finalHtml.includes(sigHtml) && !finalHtml.includes('table cellpadding="0" cellspacing="0" border="0"')) {
                finalHtml += `<br/><br/>${sigHtml}`;
            }
        }

        // Append standard confidentiality & security disclaimer for outbound documents & links if not already present
        const hasDisclaimer = finalHtml.includes('Confidentiality') || finalHtml.includes('CONFIDENTIALITY');
        const hasLinksOrAttachments = finalHtml.includes('/#/') || finalHtml.includes('href=') || sanitizedAttachments.length > 0;
        if (!hasDisclaimer && hasLinksOrAttachments) {
            finalHtml += `
                <div style="margin-top: 24px; padding: 12px 14px; background-color: #f8fafc; border-left: 3px solid #94a3b8; border-radius: 6px; font-size: 11px; color: #64748b; line-height: 1.45; text-align: left;">
                    <strong style="color: #334155;">🔒 Confidentiality &amp; Security Notice:</strong> This email, including any linked documents, invoices, proposals, reports, or attachments, contains confidential business and financial information intended solely for the authorized recipient. Please do not forward or share these secure links or materials with unauthorized viewers. If you have received this communication in error, please notify the sender immediately and delete this message.
                </div>
            `;
        }

        const MAX_ATTACHMENTS_PER_EMAIL = 3;

        if (sanitizedAttachments.length <= MAX_ATTACHMENTS_PER_EMAIL) {
            const mailDoc: any = {
                to: email,
                from: resolvedFrom,
                ...(resolvedReplyTo ? { replyTo: resolvedReplyTo } : {}),
                message: {
                    from: resolvedFrom,
                    subject: subject,
                    text: rawText,
                    html: finalHtml,
                    ...(resolvedReplyTo ? { replyTo: resolvedReplyTo } : {}),
                    ...(sanitizedAttachments.length > 0 ? { attachments: sanitizedAttachments } : {})
                },
                organizationId: options.organizationId || options.organization?.id || 'system',
                type: options.type || 'General',
                createdAt: new Date().toISOString()
            };

            return db.collection('mail').add(cleanUndefinedFields(mailDoc));
        }

        // Multi-part attachment splitter for mailService
        const attachmentChunks: any[][] = [];
        for (let i = 0; i < sanitizedAttachments.length; i += MAX_ATTACHMENTS_PER_EMAIL) {
            attachmentChunks.push(sanitizedAttachments.slice(i, i + MAX_ATTACHMENTS_PER_EMAIL));
        }

        const totalParts = attachmentChunks.length;
        const part1NoticeHtml = `
            <div style="margin-top: 20px; padding: 12px 14px; background-color: #f1f5f9; border-left: 3px solid #3b82f6; border-radius: 6px; font-size: 12px; color: #475569; line-height: 1.5;">
                📎 <strong>Delivery Notice:</strong> This email includes multiple attachments. Additional files are being delivered in <strong>${totalParts - 1} accompanying email(s)</strong> (Parts 2 to ${totalParts}) to guarantee reliable delivery.
            </div>
        `;

        const part1Doc: any = {
            to: email,
            from: resolvedFrom,
            ...(resolvedReplyTo ? { replyTo: resolvedReplyTo } : {}),
            message: {
                from: resolvedFrom,
                subject: subject,
                text: rawText,
                html: finalHtml + part1NoticeHtml,
                ...(resolvedReplyTo ? { replyTo: resolvedReplyTo } : {}),
                attachments: attachmentChunks[0]
            },
            organizationId: options.organizationId || options.organization?.id || 'system',
            type: options.type || 'General',
            createdAt: new Date().toISOString()
        };

        const firstPromise = db.collection('mail').add(cleanUndefinedFields(part1Doc));

        const followUpPromises = [];
        for (let p = 1; p < totalParts; p++) {
            const partNum = p + 1;
            const chunkAtts = attachmentChunks[p];
            const attNamesList = chunkAtts.map(a => `<li style="margin-bottom: 4px;"><code>${a.filename}</code></li>`).join('');

            const supplementaryHtml = `
                <div style="font-family: Arial, sans-serif; color: #334155; font-size: 14px; line-height: 1.6;">
                    <div style="padding: 16px; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; margin-bottom: 20px;">
                        <h3 style="margin-top: 0; color: #1e293b; font-size: 16px;">Attached Documentation (Part ${partNum} of ${totalParts})</h3>
                        <p style="margin-bottom: 8px;">Please find the accompanying documentation and attachments for <strong>${subject}</strong> attached below:</p>
                        <ul style="padding-left: 20px; margin-bottom: 0;">
                            ${attNamesList}
                        </ul>
                    </div>
                </div>
            `;

            const supplementaryDoc: any = {
                to: email,
                from: resolvedFrom,
                ...(resolvedReplyTo ? { replyTo: resolvedReplyTo } : {}),
                message: {
                    from: resolvedFrom,
                    subject: `${subject} - Additional Attachments (Part ${partNum} of ${totalParts})`,
                    text: `Attached documentation (Part ${partNum} of ${totalParts}) for ${subject}.\n\nFiles attached: ${chunkAtts.map(a => a.filename).join(', ')}`,
                    html: supplementaryHtml,
                    ...(resolvedReplyTo ? { replyTo: resolvedReplyTo } : {}),
                    attachments: chunkAtts
                },
                organizationId: options.organizationId || options.organization?.id || 'system',
                type: options.type || 'General',
                createdAt: new Date().toISOString()
            };

            followUpPromises.push(db.collection('mail').add(cleanUndefinedFields(supplementaryDoc)));
        }

        await Promise.all([firstPromise, ...followUpPromises]);
        return firstPromise;
    });

    await Promise.all(sendPromises);
};
