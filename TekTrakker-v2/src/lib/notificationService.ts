import { cleanUndefinedFields } from './utils';
import { db, auth } from './firebase';
import { generateUserEmailSignatureHtml } from './signatureHelper';
import { uploadFileToStorage } from './storageService';

export interface NotificationPayload {
    title: string;
    body: string;
    message?: string;
    data?: Record<string, any>;
    type?: string;
    link?: string;
    url?: string;
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

        const link = payload.link || payload.url || (payload.data?.url || payload.data?.link) || null;
        const msgBody = payload.body || payload.message || '';

        await db.collection('notifications').add(cleanUndefinedFields({
            userId,
            organizationId: orgId,
            ...payload,
            message: msgBody,
            body: msgBody,
            link: link,
            read: false,
            readBy: [],
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
 * Specifically notifies admins when a technician finishes a job,
 * requesting admin review, accuracy verification, and billing document dispatch.
 */
export const notifyAdminsJobPendingReview = async (
    job: any,
    techName: string,
    organizationId: string
) => {
    try {
        const woRef = job.poNumber || job.workOrderNumber || (job.id ? job.id.slice(-6).toUpperCase() : 'N/A');
        const custName = job.customerName || 'Customer';
        const orgId = organizationId || job.organizationId || 'unaffiliated';

        const payload: NotificationPayload = {
            title: `📋 Job Needs Review: WO #${woRef}`,
            body: `Tech ${techName} finished job for ${custName}. Please verify accuracy, time entries, photos, and send billing documents.`,
            type: 'job_needs_review',
            link: `/admin/operations?tab=jobs&jobId=${job.id}`,
            data: {
                jobId: job.id,
                customerId: job.customerId,
                organizationId: orgId
            }
        };

        // 1. Send in-app notification to all organization admins
        await notifyAdmins(orgId, payload);

        // 2. Queue email alert to admin emails if logged in
        if (auth.currentUser && !auth.currentUser.isAnonymous) {
            try {
                const adminsSnap = await db.collection('users')
                    .where('organizationId', '==', orgId)
                    .where('role', 'in', ['admin', 'master_admin', 'both'])
                    .get();

                const adminEmails = adminsSnap.docs
                    .map(d => d.data().email)
                    .filter(e => typeof e === 'string' && e.trim() !== '');

                if (adminEmails.length > 0) {
                    const checkInStr = job.checkInTime ? new Date(job.checkInTime).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : 'N/A';
                    const checkOutStr = job.checkOutTime ? new Date(job.checkOutTime).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
                    const emailHtml = `
                        <div style="font-family: Arial, sans-serif; color: #1e293b; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; background-color: #ffffff;">
                            <div style="text-align: center; border-bottom: 2px solid #f59e0b; padding-bottom: 16px; margin-bottom: 20px;">
                                <h2 style="color: #92400e; margin: 0;">📋 Technician Job Completed - Verification Required</h2>
                                <p style="color: #64748b; margin-top: 6px;">Work Order #${woRef} • ${custName}</p>
                            </div>
                            <p>Hello Admin,</p>
                            <p>Technician <strong>${techName}</strong> has completed their work on site and marked the job ready for office review.</p>
                            <div style="background-color: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 16px; margin: 20px 0;">
                                <h4 style="margin-top: 0; color: #92400e; text-transform: uppercase; font-size: 11px; letter-spacing: 0.05em;">Action Required:</h4>
                                <ul style="margin: 0; padding-left: 20px; font-size: 13px; color: #78350f;">
                                    <li>Verify site check-in/out duration (${checkInStr} - ${checkOutStr}).</li>
                                    <li>Inspect technician diagnostic & repair notes.</li>
                                    <li>Confirm uploaded site photos and customer sign-off signature.</li>
                                    <li>Verify line items, labor charges, and send billing documents to customer.</li>
                                </ul>
                            </div>
                            <p style="font-size: 12px; color: #64748b;">This job is now highlighted under <strong>Needs Review</strong> on your Dispatch Board and Job History.</p>
                        </div>
                    `;

                    await db.collection('mail').add(cleanUndefinedFields({
                        to: adminEmails,
                        message: {
                            subject: `⚠️ Action Required: Verify Job #${woRef} (${custName}) & Send Billing`,
                            html: emailHtml
                        },
                        organizationId: orgId,
                        status: 'pending',
                        createdAt: new Date().toISOString()
                    }));
                }
            } catch (mailErr) {
                console.error("Failed to queue admin job review email alert:", mailErr);
            }
        }
    } catch (err) {
        console.error("Failed to notify admins of job pending review:", err);
    }
};

/**
 * Centralized, single source of truth helper to sanitize email attachments.
 * Ensures attachments with remote HTTP/HTTPS URLs (like Firebase Storage) strip inline base64
 * so Firestore documents stay tiny (~2-5 KB) and never exceed Google Cloud Eventarc's 512KB payload ceiling (Error 400).
 * Also auto-uploads data URIs or large raw base64 content (>50KB) to Firebase Storage.
 */
export const sanitizeEmailAttachments = async (rawAttachments: any[], orgId?: string): Promise<any[]> => {
    if (!Array.isArray(rawAttachments) || rawAttachments.length === 0) {
        return [];
    }

    const sanitizedAtts: any[] = [];
    let cumulativeInlineBytes = 0;

    for (const att of rawAttachments) {
        if (!att) continue;
        const filename = String(att.filename || att.name || att.fileName || 'attachment.pdf');
        const contentType = String(att.contentType || att.mimeType || att.type || 'application/pdf');
        const cleanAtt: any = { filename, contentType };

        const rawPath = att.path || att.url || att.fileUrl;
        if (rawPath && typeof rawPath === 'string' && rawPath.length > 0) {
            cleanAtt.path = rawPath;
        }

        const rawContent = att.content || att.dataUrl;
        if (rawContent && typeof rawContent === 'string' && rawContent.length > 0) {
            cleanAtt.content = rawContent;
            cleanAtt.encoding = att.encoding || 'base64';
        }

        // Case 1: Remote HTTP/HTTPS URL is present (e.g. Firebase Storage download URL).
        // Nodemailer and SendGrid stream/download directly from remote URLs.
        // Stripping inline base64 reduces attachment payload in Firestore from ~375KB to ~250 bytes.
        if (cleanAtt.path && (cleanAtt.path.startsWith('http://') || cleanAtt.path.startsWith('https://'))) {
            delete cleanAtt.content;
            delete cleanAtt.encoding;
        }

        // Case 2: Attachment path is a data: URI string (e.g. from canvas or jsPDF output).
        // Offload to Firebase Storage so the Firestore document does not embed massive base64 text.
        if (cleanAtt.path && cleanAtt.path.startsWith('data:')) {
            try {
                const cleanName = filename.replace(/[^a-zA-Z0-9_.-]/g, '_');
                const targetOrg = orgId || 'public';
                const storagePath = `organizations/${targetOrg}/email_attachments/${Date.now()}_${cleanName}`;
                const downloadUrl = await uploadFileToStorage(storagePath, cleanAtt.path);
                if (downloadUrl) {
                    cleanAtt.path = downloadUrl;
                    delete cleanAtt.content;
                    delete cleanAtt.encoding;
                }
            } catch (uploadErr) {
                console.warn("[sanitizeEmailAttachments] Failed to upload data URI attachment to storage:", uploadErr);
            }
        }

        // Case 3: No remote path provided, but large inline content is present (> 50KB).
        // Auto-offload to Firebase Storage to prevent Eventarc 512KB payload drops.
        if (!cleanAtt.path && cleanAtt.content && cleanAtt.content.length > 50000) {
            try {
                const cleanName = filename.replace(/[^a-zA-Z0-9_.-]/g, '_');
                const targetOrg = orgId || 'public';
                const storagePath = `organizations/${targetOrg}/email_attachments/${Date.now()}_${cleanName}`;
                const dataUri = cleanAtt.content.startsWith('data:') 
                    ? cleanAtt.content 
                    : `data:${contentType};base64,${cleanAtt.content}`;
                const downloadUrl = await uploadFileToStorage(storagePath, dataUri);
                if (downloadUrl) {
                    cleanAtt.path = downloadUrl;
                    delete cleanAtt.content;
                    delete cleanAtt.encoding;
                }
            } catch (uploadErr) {
                console.warn("[sanitizeEmailAttachments] Failed to upload inline content to storage:", uploadErr);
            }
        }

        // Case 4: Small inline content remaining (< 50KB) without remote path (e.g. signature image).
        // Keep inline only if cumulative payload across all attachments remains under 120KB.
        if (!cleanAtt.path && cleanAtt.content) {
            if (cumulativeInlineBytes + cleanAtt.content.length > 120000) {
                try {
                    const cleanName = filename.replace(/[^a-zA-Z0-9_.-]/g, '_');
                    const targetOrg = orgId || 'public';
                    const storagePath = `organizations/${targetOrg}/email_attachments/${Date.now()}_${cleanName}`;
                    const dataUri = cleanAtt.content.startsWith('data:') 
                        ? cleanAtt.content 
                        : `data:${contentType};base64,${cleanAtt.content}`;
                    const downloadUrl = await uploadFileToStorage(storagePath, dataUri);
                    if (downloadUrl) {
                        cleanAtt.path = downloadUrl;
                        delete cleanAtt.content;
                        delete cleanAtt.encoding;
                    }
                } catch {
                    console.warn("[sanitizeEmailAttachments] Cumulative inline attachment budget exceeded for:", filename);
                }
            } else {
                cumulativeInlineBytes += cleanAtt.content.length;
            }
        }

        if (cleanAtt.content || cleanAtt.path) {
            sanitizedAtts.push(cleanAtt);
        }
    }

    return sanitizedAtts;
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

        // --- 23rd Group PDF-Only Link Stripping Safeguard ---
        // 23rd Group email provider filters out any email containing web links or URLs.
        const recipientsList = Array.isArray(mailPayload.to) ? mailPayload.to : [mailPayload.to || ''];
        const is23rdTarget = recipientsList.some((e: string) => typeof e === 'string' && e.includes('23rdgroup')) || mailPayload.strictPdfOnly;

        if (is23rdTarget) {
            console.info("23rd Group recipient detected: stripping all web links and enforcing raw PDF attachments.");
            if (mailPayload.message.html) {
                mailPayload.message.html = mailPayload.message.html
                    .replace(/<a\s+href="[^"]*">([^<]*)<\/a>/gi, '$1')
                    .replace(/https?:\/\/[^\s<]+/gi, '');
            }
            if (mailPayload.message.text) {
                mailPayload.message.text = mailPayload.message.text
                    .replace(/https?:\/\/[^\s]+/gi, '');
            }
        }

        // Sanitize message object to ensure only valid fields (subject, text, html, replyTo, attachments) are sent
        const rawMsg = mailPayload.message || {};
        let finalHtml = String(rawMsg.html || '');

        // Automatically append sender signature if senderUser is provided and signature is not already included
        if (mailPayload.senderUser && mailPayload.includeSignature !== false) {
            const sigHtml = mailPayload.senderUser.emailSignatureHtml || generateUserEmailSignatureHtml(mailPayload.senderUser, org);
            if (sigHtml && !finalHtml.includes(sigHtml) && !finalHtml.includes('table cellpadding="0" cellspacing="0" border="0"')) {
                finalHtml += `<br/><br/>${sigHtml}`;
            }
        }

        // Append standard confidentiality & security disclaimer for outbound documents & links if not already present
        const hasDisclaimer = finalHtml.includes('Confidentiality') || finalHtml.includes('CONFIDENTIALITY');
        const hasLinksOrAttachments = finalHtml.includes('/#/') || finalHtml.includes('href=') || (Array.isArray(rawMsg.attachments) && rawMsg.attachments.length > 0);
        if (!hasDisclaimer && hasLinksOrAttachments) {
            finalHtml += `
                <div style="margin-top: 24px; padding: 12px 14px; background-color: #f8fafc; border-left: 3px solid #94a3b8; border-radius: 6px; font-size: 11px; color: #64748b; line-height: 1.45; text-align: left;">
                    <strong style="color: #334155;">🔒 Confidentiality &amp; Security Notice:</strong> This email, including any linked documents, invoices, proposals, reports, or attachments, contains confidential business and financial information intended solely for the authorized recipient. Please do not forward or share these secure links or materials with unauthorized viewers. If you have received this communication in error, please notify the sender immediately and delete this message.
                </div>
            `;
        }

        // Resolve company sender display name and reply-to to ensure recipient receives email from organization brand
        let orgName = (org?.name || org?.businessName || '').trim();
        let orgEmail = org?.email;

        const targetOrgId = org?.id || mailPayload.organizationId;
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
        const resolvedFrom = rawMsg.from || mailPayload.from || defaultFrom;
        const resolvedReplyTo = rawMsg.replyTo || mailPayload.replyTo || orgEmail || 'Operations@tekairinc.com';

        const cleanMsg: any = {
            from: resolvedFrom,
            replyTo: resolvedReplyTo,
            subject: String(rawMsg.subject || 'Notification'),
            html: finalHtml,
            text: String(rawMsg.text || (finalHtml ? finalHtml.replace(/<[^>]*>?/gm, '') : ''))
        };
        if (resolvedReplyTo) {
            cleanMsg.replyTo = String(resolvedReplyTo);
        }

        // Sanitize attachments array using centralized helper to prevent Eventarc payload drops
        let sanitizedAttachments: any[] = [];
        if (Array.isArray(rawMsg.attachments) && rawMsg.attachments.length > 0) {
            sanitizedAttachments = await sanitizeEmailAttachments(rawMsg.attachments, targetOrgId || org?.id);
        }

        const MAX_ATTACHMENTS_PER_EMAIL = 3;
        let result: any = null;

        // If 3 or fewer attachments (or explicitly requested to skip splitting), dispatch in a single email
        if (sanitizedAttachments.length <= MAX_ATTACHMENTS_PER_EMAIL || mailPayload.skipSplit) {
            if (sanitizedAttachments.length > 0) {
                cleanMsg.attachments = sanitizedAttachments;
            }
            mailPayload.from = resolvedFrom;
            mailPayload.replyTo = resolvedReplyTo;
            mailPayload.message = cleanMsg;

            result = await db.collection('mail').add(cleanUndefinedFields(mailPayload));
        } else {
            // Sort attachments so primary documents (Invoices, Reports, Proposals, Statements, Work Orders)
            // are prioritized in Part 1.
            const isPrimaryDoc = (fn: string) => {
                const lower = (fn || '').toLowerCase();
                return lower.includes('invoice') || lower.includes('service_report') || lower.includes('report') || lower.includes('proposal') || lower.includes('statement') || lower.includes('workorder') || lower.includes('work_order');
            };

            const primaryDocs = sanitizedAttachments.filter(a => isPrimaryDoc(a.filename));
            const secondaryDocs = sanitizedAttachments.filter(a => !isPrimaryDoc(a.filename));
            const sortedAttachments = [...primaryDocs, ...secondaryDocs];

            // Chunk into groups of at most MAX_ATTACHMENTS_PER_EMAIL
            const attachmentChunks: any[][] = [];
            for (let i = 0; i < sortedAttachments.length; i += MAX_ATTACHMENTS_PER_EMAIL) {
                attachmentChunks.push(sortedAttachments.slice(i, i + MAX_ATTACHMENTS_PER_EMAIL));
            }

            const totalParts = attachmentChunks.length;
            console.info(`[sendEmail] Splitting ${sortedAttachments.length} attachments into ${totalParts} separate emails to ensure 100% mailbox delivery.`);

            // Dispatch Part 1 (Primary Email)
            const part1NoticeHtml = `
                <div style="margin-top: 20px; padding: 12px 14px; background-color: #f1f5f9; border-left: 3px solid #3b82f6; border-radius: 6px; font-size: 12px; color: #475569; line-height: 1.5;">
                    📎 <strong>Delivery Notice:</strong> This documentation includes multiple files and photos. To ensure delivery without email provider size restrictions, additional attachments are being sent in <strong>${totalParts - 1} accompanying email(s)</strong> (Parts 2 to ${totalParts}).
                </div>
            `;
            const part1Msg = {
                ...cleanMsg,
                html: cleanMsg.html + part1NoticeHtml,
                attachments: attachmentChunks[0]
            };

            const part1Payload = {
                ...mailPayload,
                from: resolvedFrom,
                replyTo: resolvedReplyTo,
                message: part1Msg
            };

            result = await db.collection('mail').add(cleanUndefinedFields(part1Payload));

            // Dispatch Supplementary Emails (Part 2 to N)
            for (let p = 1; p < totalParts; p++) {
                const partNum = p + 1;
                const chunkAtts = attachmentChunks[p];
                const attNamesList = chunkAtts.map(a => `<li style="margin-bottom: 4px;"><code>${a.filename}</code></li>`).join('');

                const supplementaryHtml = `
                    <div style="font-family: Arial, sans-serif; color: #334155; font-size: 14px; line-height: 1.6;">
                        <div style="padding: 16px; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; margin-bottom: 20px;">
                            <h3 style="margin-top: 0; color: #1e293b; font-size: 16px;">Attached Documentation (Part ${partNum} of ${totalParts})</h3>
                            <p style="margin-bottom: 8px;">Please find the accompanying documentation and photo attachments for <strong>${cleanMsg.subject}</strong> attached below:</p>
                            <ul style="padding-left: 20px; margin-bottom: 0;">
                                ${attNamesList}
                            </ul>
                        </div>
                    </div>
                `;

                const supplementaryMsg = {
                    from: resolvedFrom,
                    replyTo: resolvedReplyTo,
                    subject: `${cleanMsg.subject} - Documentation (Part ${partNum} of ${totalParts})`,
                    html: supplementaryHtml,
                    text: `Attached documentation (Part ${partNum} of ${totalParts}) for ${cleanMsg.subject}.\n\nFiles attached: ${chunkAtts.map(a => a.filename).join(', ')}`,
                    attachments: chunkAtts
                };

                const supplementaryPayload = {
                    ...mailPayload,
                    from: resolvedFrom,
                    replyTo: resolvedReplyTo,
                    message: supplementaryMsg,
                    skipAutoLog: true,
                    createdAt: new Date().toISOString()
                };

                await db.collection('mail').add(cleanUndefinedFields(supplementaryPayload));
            }
        }

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
