/* eslint-disable @typescript-eslint/no-explicit-any */
import * as functions from "firebase-functions/v1";
import * as admin from "firebase-admin";
import * as nodemailer from "nodemailer";
import sgMail from '@sendgrid/mail';
import * as xml2js from 'xml2js';
import axios from 'axios';
import { Buffer } from 'buffer';
import { trackEmailUsage } from '../usageTracking';

if (admin.apps.length === 0) {
    try { admin.initializeApp(); } catch { /* ignore */ }
}
const db = admin.firestore();

declare var process: any;

export const processMailQueue = functions.runWith({ secrets: ["SENDGRID_API_KEY"] }).firestore.document('mail_queue/{docId}').onCreate(async (snap) => {
    const payload = snap.data();
    const orgId = payload.organizationId;
    let smtpConfig: any = null;
    let orgName = "";
    let orgEmail = "";

    try {
        let orgData: any = null;
        if (orgId && orgId !== 'unaffiliated') {
            const orgDoc = await db.collection('organizations').doc(orgId).get();
            if (orgDoc.exists) {
                orgData = orgDoc.data() || {};
                orgName = orgData.name || "";
                orgEmail = orgData.email || "";
            }
        }

        if (payload.transport) {
            smtpConfig = payload.transport;
        } else if (orgId && orgId !== 'unaffiliated') {
            const secretDoc = await db.collection('organizations').doc(orgId).collection('secrets').doc('config').get();
            if (secretDoc.exists) {
                const secrets = secretDoc.data() || {};
                const isCampaign = ['PlatformCampaign', 'MarketingBlast', 'PlatformCampaignStudio'].includes(payload.type);
                if (isCampaign && secrets.campaignSmtpConfig && secrets.campaignSmtpConfig.host && secrets.campaignSmtpConfig.user && secrets.campaignSmtpConfig.pass) {
                    smtpConfig = secrets.campaignSmtpConfig;
                    functions.logger.info(`Using campaign-specific SMTP config for ${payload.type}`);
                } else if (secrets.smtpConfig && secrets.smtpConfig.host && secrets.smtpConfig.user && secrets.smtpConfig.pass) {
                    smtpConfig = secrets.smtpConfig;
                }
            } else if (orgData) {
                // Backward compatibility during migration window: Try reading from main org document if secrets don't exist yet
                const isCampaign = ['PlatformCampaign', 'MarketingBlast', 'PlatformCampaignStudio'].includes(payload.type);
                if (isCampaign && orgData.campaignSmtpConfig && orgData.campaignSmtpConfig.host && orgData.campaignSmtpConfig.user && orgData.campaignSmtpConfig.pass) {
                    smtpConfig = orgData.campaignSmtpConfig;
                } else if (orgData.smtpConfig && orgData.smtpConfig.host && orgData.smtpConfig.user && orgData.smtpConfig.pass) {
                    smtpConfig = orgData.smtpConfig;
                }
            }
        }

        // Fetch global platform settings to standardise email signature across all devices
        let signature = '<br><br><hr><p style="color: #64748b; font-size: 12px; margin-top: 20px;">Sent securely via TekTrakker Platform</p>';
        try {
            const platformDoc = await db.collection('platformSettings').doc('branding').get();
            if (platformDoc.exists) {
                const branding = platformDoc.data();
                if (branding && branding.emailSignature) {
                    signature = branding.emailSignature;
                }
            }
        } catch {
            functions.logger.warn("Could not fetch global branding settings for email signature.");
        }

        if (payload.message && payload.message.html) {
            payload.message.html += signature;
        }
        if (payload.message && payload.message.html && !payload.message.text) {
            payload.message.text = payload.message.html.replace(/<[^>]*>?/gm, '');
        }

        let sentViaCustomSmtp = false;

        // If organization has their SMTP set up, try sending directly via nodemailer
        if (smtpConfig) {
            try {
                functions.logger.info(`Attempting direct custom SMTP send for org ${orgId}...`);
                const transporter = nodemailer.createTransport({
                    host: smtpConfig.host,
                    port: smtpConfig.port || 587,
                    secure: smtpConfig.port === 465, // True for 465, false for others
                    auth: {
                        user: smtpConfig.user,
                        pass: smtpConfig.pass
                    }
                });

                const fromHeader = smtpConfig.fromName && smtpConfig.fromEmail 
                    ? `"${smtpConfig.fromName}" <${smtpConfig.fromEmail}>` 
                    : payload.message?.from || `"${smtpConfig.user}" <${smtpConfig.user}>`;

                const formattedSmtpAttachments = await Promise.all((payload.message?.attachments || []).map(async (att: any) => {
                    let base64Data = att.content || '';
                    const urlOrPath = att.path || att.url || '';

                    if (!base64Data && urlOrPath && (typeof urlOrPath === 'string') && (urlOrPath.startsWith('http://') || urlOrPath.startsWith('https://'))) {
                        try {
                            const dlRes = await axios.get(urlOrPath, { responseType: 'arraybuffer' });
                            return {
                                filename: att.filename || att.fileName || 'attachment.pdf',
                                content: Buffer.from(dlRes.data),
                                contentType: att.contentType || att.type || 'application/pdf'
                            };
                        } catch (dlErr) {
                            functions.logger.error(`Error downloading attachment for SMTP from ${urlOrPath}:`, dlErr);
                        }
                    }

                    if (base64Data && base64Data.includes('base64,')) {
                        base64Data = base64Data.split('base64,')[1];
                    }

                    return {
                        filename: att.filename || att.fileName || 'attachment.pdf',
                        content: base64Data,
                        encoding: 'base64',
                        contentType: att.contentType || att.type || 'application/pdf'
                    };
                }));

                const mailOptions = {
                    from: fromHeader,
                    to: payload.to,
                    subject: payload.message?.subject || 'Notification',
                    html: payload.message?.html,
                    text: payload.message?.text,
                    replyTo: payload.message?.replyTo,
                    attachments: formattedSmtpAttachments
                };

                const info = await transporter.sendMail(mailOptions);
                functions.logger.info(`Successfully sent email via custom SMTP for org ${orgId}:`, info.messageId);

                // Write the log to the 'mail' collection with a completed/success delivery state so it is kept in history but not sent again by the trigger-email extension
                await db.collection('mail').add({
                    ...payload,
                    delivery: {
                        state: "SUCCESS",
                        info: {
                            messageId: info.messageId,
                            response: info.response
                        },
                        attempts: 1,
                        endTime: admin.firestore.Timestamp.now(),
                        startTime: admin.firestore.Timestamp.now()
                    }
                });

                sentViaCustomSmtp = true;
            } catch (smtpError: any) {
                functions.logger.error(`Failed to send via custom SMTP for org ${orgId}. Falling back to platform email.`, smtpError);
                // Reset/clean payload so that we do not put SMTP config in final public mail document
                if (payload.transport) delete payload.transport;
            }
        }

        // Fallback: If custom SMTP failed or was never configured, send via platform default SMTP (SendGrid API)
        if (!sentViaCustomSmtp) {
            const sendgridApiKey = process.env.SENDGRID_API_KEY;
            if (sendgridApiKey) {
                try {
                    functions.logger.info(`Sending email via SendGrid API for org ${orgId}...`);
                    sgMail.setApiKey(sendgridApiKey);

                    const fromEmail = "notifications@mail.tektrakker.com"; // Verified sender domain
                    const fromName = payload.message?.fromName || (orgName ? `${orgName} via TekTrakker` : "TekTrakker");
                    
                    const msg: any = {
                        to: payload.to,
                        from: {
                            email: fromEmail,
                            name: fromName
                        },
                        subject: payload.message?.subject || 'Notification',
                        html: payload.message?.html,
                        text: payload.message?.text,
                        customArgs: {
                            organizationId: orgId || 'platform',
                            mailQueueId: snap.id,
                            proposalId: payload.proposalId || '',
                            invoiceId: payload.invoiceId || '',
                            jobId: payload.jobId || '',
                            type: payload.type || ''
                        }
                    };

                    const replyTo = payload.message?.replyTo || orgEmail;
                    if (replyTo) {
                        msg.replyTo = replyTo;
                    }

                    // Diagnostic: log attachment presence
                    const rawAttachments = payload.message?.attachments;
                    functions.logger.info(`Attachment check: hasAttachments=${!!rawAttachments}, count=${rawAttachments?.length || 0}, keys=${rawAttachments ? rawAttachments.map((a: any) => `[filename=${a.filename},contentLen=${(a.content || '').length},path=${a.path || a.url || 'NONE'}]`).join(', ') : 'N/A'}`);

                    if (payload.message?.attachments && payload.message.attachments.length > 0) {
                        msg.attachments = await Promise.all(payload.message.attachments.map(async (att: any) => {
                            let base64Data = att.content || '';
                            const urlOrPath = att.path || att.url || '';

                            if (!base64Data && urlOrPath && (typeof urlOrPath === 'string') && (urlOrPath.startsWith('http://') || urlOrPath.startsWith('https://'))) {
                                try {
                                    const dlRes = await axios.get(urlOrPath, { responseType: 'arraybuffer' });
                                    const dlBuffer = Buffer.from(dlRes.data);
                                    functions.logger.info(`Downloaded attachment from URL: status=${dlRes.status}, bufferLen=${dlBuffer.length}, contentType=${dlRes.headers['content-type']}`);
                                    base64Data = dlBuffer.toString('base64');
                                    functions.logger.info(`Converted to base64: length=${base64Data.length}, first50=${base64Data.substring(0, 50)}`);
                                } catch (dlErr) {
                                    functions.logger.error(`Error downloading attachment for SendGrid from ${urlOrPath}:`, dlErr);
                                }
                            }

                            if (base64Data && base64Data.includes('base64,')) {
                                base64Data = base64Data.split('base64,')[1];
                            }

                            functions.logger.info(`Final attachment for SendGrid: filename=${att.filename}, base64Len=${base64Data.length}`);

                            return {
                                content: base64Data,
                                filename: att.filename || att.fileName || 'attachment.pdf',
                                type: att.contentType || att.type || 'application/pdf',
                                disposition: att.disposition || 'attachment'
                            };
                        }));
                    }

                    const response = await sgMail.send(msg);
                    functions.logger.info(`Successfully sent email via SendGrid API for org ${orgId}:`, response);
                    await trackEmailUsage(orgId);

                    // Write log to the 'mail' collection with a completed/success delivery state
                    await db.collection('mail').add({
                        ...payload,
                        delivery: {
                            state: "SUCCESS",
                            info: {
                                messageId: response[0]?.headers?.['x-message-id'] || 'sg-api-send',
                                response: `SendGrid status: ${response[0]?.statusCode}`
                            },
                            attempts: 1,
                            endTime: admin.firestore.Timestamp.now(),
                            startTime: admin.firestore.Timestamp.now()
                        }
                    });
                } catch (sgError: any) {
                    functions.logger.error(`SendGrid API send failed for org ${orgId}. Falling back to Firestore mail queue.`, sgError);
                    await trackEmailUsage(orgId);
                    // Standard fallback: Forward payload to the final 'mail' collection for delivery via the Firebase extension trigger
                    await db.collection('mail').add(payload);
                }
            } else {
                functions.logger.warn(`SENDGRID_API_KEY is not configured. Falling back to default mail collection trigger.`);
                await trackEmailUsage(orgId);
                // Standard fallback: Forward payload to the final 'mail' collection for delivery via the Firebase extension trigger
                await db.collection('mail').add(payload);
            }
        }

        // Clean up the queue
        await snap.ref.delete();
    } catch (error) {
        functions.logger.error(`Failed to process mail queue for org ${orgId}`, error);
    }
});

export const sendgridWebhook = functions.https.onRequest(async (req, res) => {
    if (req.method !== 'POST') {
        res.status(405).send('Method Not Allowed');
        return;
    }

    try {
        const events = req.body;
        if (!Array.isArray(events)) {
            res.status(400).send('Invalid payload: expected an array of events.');
            return;
        }

        const batch = db.batch();

        for (const event of events) {
            const { event: eventType, mailQueueId, proposalId, invoiceId, organizationId, email, timestamp } = event;
            functions.logger.info(`Received SendGrid webhook event [${eventType}] for mailQueueId ${mailQueueId}, org: ${organizationId}`);

            // 1. Log event details to the Firestore mail collection
            if (mailQueueId) {
                const mailRef = db.collection('mail').doc(mailQueueId);
                batch.set(mailRef, {
                    delivery: {
                        status: eventType,
                        updatedAt: new Date(timestamp * 1000).toISOString(),
                        lastEvent: eventType
                    }
                }, { merge: true });
            }

            // 2. Track proposal events (Opened, Clicked)
            if (proposalId) {
                const proposalRef = db.collection('proposals').doc(proposalId);
                const trackingEntry = {
                    status: eventType === 'open' ? 'Opened (Email)' : eventType === 'click' ? 'Clicked Link (Email)' : `Email ${eventType}`,
                    timestamp: new Date(timestamp * 1000).toISOString(),
                    updatedBy: 'SendGrid Webhook',
                    notes: `Event [${eventType}] registered for recipient ${email}`
                };
                batch.update(proposalRef, {
                    trackingHistory: admin.firestore.FieldValue.arrayUnion(trackingEntry)
                });
            }

            // 3. Track invoice events (logs to invoice timeline)
            if (invoiceId) {
                const orgId = organizationId || 'platform';
                const trackingEntry = {
                    event: `Email ${eventType}`,
                    timestamp: new Date(timestamp * 1000).toISOString(),
                    notes: `Email sent to ${email} was ${eventType}`
                };

                // Update nested invoice timeline
                const invoiceRef = db.collection('organizations').doc(orgId).collection('invoices').doc(invoiceId);
                const timelineRef = invoiceRef.collection('timeline').doc(`sg_${eventType}_${timestamp}`);
                batch.set(timelineRef, trackingEntry);

                // Also update root invoice timeline
                const rootInvoiceRef = db.collection('invoices').doc(invoiceId);
                const rootTimelineRef = rootInvoiceRef.collection('timeline').doc(`sg_${eventType}_${timestamp}`);
                batch.set(rootTimelineRef, trackingEntry);
            }
        }

        await batch.commit();
        res.status(200).send('OK');
    } catch (error) {
        functions.logger.error('Error processing SendGrid webhook:', error);
        res.status(500).send('Internal Server Error');
    }
});

export const sendgridInboundParseWebhook = functions.https.onRequest(async (req, res) => {
    if (req.method !== 'POST') {
        res.status(405).send('Method Not Allowed');
        return;
    }

    try {
        let fields: Record<string, any> = {};
        const attachments: Array<{ filename: string; contentType: string; buffer: Buffer }> = [];

        const contentType = req.headers['content-type'] || '';
        if (contentType.includes('multipart/form-data')) {
            await new Promise<void>((resolve, reject) => {
                let Busboy: any;
                try {
                    Busboy = require('busboy');
                } catch {
                    try {
                        Busboy = require('@fastify/busboy');
                    } catch {
                        Busboy = null;
                    }
                }

                if (!Busboy) {
                    fields = req.body || {};
                    return resolve();
                }

                const busboy = Busboy({ headers: req.headers });

                busboy.on('field', (fieldname: string, val: string) => {
                    fields[fieldname] = val;
                });

                busboy.on('file', (fieldname: string, file: any, filenameInfo: any, encoding: string, mimetype: string) => {
                    const filename = typeof filenameInfo === 'string' ? filenameInfo : filenameInfo?.filename || 'attachment';
                    const mimeType = typeof filenameInfo === 'object' && filenameInfo?.mimeType ? filenameInfo.mimeType : mimetype || 'application/octet-stream';
                    const chunks: Buffer[] = [];
                    file.on('data', (data: any) => chunks.push(data));
                    file.on('end', () => {
                        attachments.push({
                            filename,
                            contentType: mimeType,
                            buffer: Buffer.concat(chunks)
                        });
                    });
                });

                busboy.on('finish', () => resolve());
                busboy.on('error', (err: any) => reject(err));

                if ((req as any).rawBody) {
                    busboy.end((req as any).rawBody);
                } else {
                    req.pipe(busboy);
                }
            });
        } else {
            fields = req.body || {};
        }

        // 1. Extract recipient email & parse Org Slug
        let recipientRaw = fields.to || fields.envelope?.to?.[0] || '';
        if (typeof recipientRaw !== 'string' && Array.isArray(recipientRaw)) {
            recipientRaw = recipientRaw[0] || '';
        }

        // Clean recipient: e.g. "Acme HVAC <acme-hvac@inbound.mail.tektrakker.com>" -> "acme-hvac@inbound.mail.tektrakker.com"
        const emailMatch = recipientRaw.match(/<([^>]+)>/) || [null, recipientRaw];
        const cleanRecipient = (emailMatch[1] || recipientRaw).trim().toLowerCase();

        // Extract prefix before @
        const slugPrefix = cleanRecipient.split('@')[0] || '';
        // Clean slug (strip any plus tags if present e.g. acme-hvac+test -> acme-hvac)
        const orgSlug = slugPrefix.split('+')[0].trim().toLowerCase();

        functions.logger.info(`Received SendGrid Inbound email for recipient [${cleanRecipient}], orgSlug [${orgSlug}]`);

        // 2. Find Organization in Firestore
        let orgId = '';

        if (orgSlug) {
            // Search by slug first
            let orgSnap = await db.collection('organizations').where('slug', '==', orgSlug).limit(1).get();
            if (orgSnap.empty) {
                // Try searching by customInboundSlug
                orgSnap = await db.collection('organizations').where('customInboundSlug', '==', orgSlug).limit(1).get();
            }
            if (orgSnap.empty) {
                // Try direct doc ID match
                const directDoc = await db.collection('organizations').doc(orgSlug).get();
                if (directDoc.exists) {
                    orgId = directDoc.id;
                }
            } else {
                orgId = orgSnap.docs[0].id;
            }
        }

        if (!orgId && orgSlug) {
            // Try matching user email prefix (e.g. roderick@inbound.mail.tektrakker.com -> user roderick@tekairinc.com)
            const usersSnap = await db.collection('users').select('email', 'organizationId').limit(100).get();
            for (const userDoc of usersSnap.docs) {
                const uData = userDoc.data();
                const uEmail = (uData.email || '').toLowerCase();
                const uPrefix = uEmail.split('@')[0].trim();
                if (uPrefix && uPrefix === orgSlug && uData.organizationId) {
                    orgId = uData.organizationId;
                    functions.logger.info(`Resolved organization [${orgId}] via user email prefix match for [${uEmail}]`);
                    break;
                }
            }
        }

        if (!orgId && orgSlug) {
            // Try fuzzy matching organization name (e.g. "tekair" or "tekairinc" or "acmehvac")
            const allOrgs = await db.collection('organizations').select('name').limit(100).get();
            const sanitizedSlug = orgSlug.replace(/[^a-z0-9]/g, '');
            for (const doc of allOrgs.docs) {
                const data = doc.data();
                const sanitizedName = (data.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
                if (sanitizedName && (sanitizedName === sanitizedSlug || sanitizedName.includes(sanitizedSlug) || sanitizedSlug.includes(sanitizedName))) {
                    orgId = doc.id;
                    functions.logger.info(`Resolved organization [${orgId}] (${data.name}) via fuzzy name match for slug [${orgSlug}]`);
                    break;
                }
            }
        }

        // Fallback: If no org matched, log to unmatchedInboundEmails for diagnostic recovery
        if (!orgId) {
            functions.logger.warn(`Could not resolve organization for inbound slug: ${orgSlug}`);
            await db.collection('unmatchedInboundEmails').add({
                recipient: cleanRecipient,
                orgSlug,
                from: fields.from || '',
                subject: fields.subject || '(No Subject)',
                text: fields.text || '',
                html: fields.html || '',
                receivedAt: new Date().toISOString(),
                createdAt: admin.firestore.FieldValue.serverTimestamp()
            });
            res.status(200).send('OK (Unmatched logged)');
            return;
        }

        // 3. Extract Sender & Clean Email
        const senderRaw = fields.from || '';
        const senderMatch = senderRaw.match(/<([^>]+)>/) || [null, senderRaw];
        const cleanFromEmail = (senderMatch[1] || senderRaw).trim().toLowerCase();
        const senderDisplayName = senderRaw.replace(/<[^>]+>/, '').replace(/"/g, '').trim() || cleanFromEmail;

        const subject = fields.subject || '(No Subject)';
        const bodyText = fields.text || '';
        const bodyHtml = fields.html || '';

        // 4. Check for Auto-Verification Email (e.g., Google Workspace Forwarding Confirmation)
        const isVerificationEmail = subject.toLowerCase().includes('forwarding confirmation') ||
            subject.toLowerCase().includes('verification') ||
            bodyText.toLowerCase().includes('forwarding confirmation code') ||
            bodyText.toLowerCase().includes('has requested to automatically forward mail');

        let verificationCode = '';
        if (isVerificationEmail) {
            const codeMatch = bodyText.match(/Confirmation code:\s*([0-9a-zA-Z-]+)/i) ||
                bodyText.match(/code:\s*([0-9a-zA-Z]{6,12})/i);
            if (codeMatch) {
                verificationCode = codeMatch[1];
            }

            await db.collection('organizations').doc(orgId).collection('settings').doc('inboundEmail').set({
                verificationCode,
                verificationEmailSubject: subject,
                verificationEmailBody: bodyText,
                lastVerificationReceivedAt: new Date().toISOString(),
                status: verificationCode ? 'verification_code_received' : 'verification_email_received'
            }, { merge: true });

            functions.logger.info(`Captured forwarding verification code [${verificationCode}] for org [${orgId}]`);
        }

        // 5. Match Customer & Job in Organization
        let customerId = null;
        let customerName = null;
        let isWorkOrderEmail = false;
        let workOrderContactName = null;

        if (cleanFromEmail) {
            const customerSnap = await db.collection('customers')
                .where('organizationId', '==', orgId)
                .where('email', '==', cleanFromEmail)
                .limit(1)
                .get();

            if (!customerSnap.empty) {
                customerId = customerSnap.docs[0].id;
                customerName = customerSnap.docs[0].data()?.name || senderDisplayName;
            } else {
                // Search within customer contacts
                const allCustomersSnap = await db.collection('customers')
                    .where('organizationId', '==', orgId)
                    .get();

                for (const doc of allCustomersSnap.docs) {
                    const custData = doc.data();
                    const contacts = custData?.contacts || [];
                    const matchedContact = contacts.find((cnt: any) => cnt.email && cnt.email.trim().toLowerCase() === cleanFromEmail);
                    if (matchedContact) {
                        customerId = doc.id;
                        customerName = custData.name || senderDisplayName;
                        workOrderContactName = matchedContact.name || null;
                        if (
                            matchedContact.isIncomingWorkOrderContact || 
                            (matchedContact.contactRoles || []).includes('incoming_workorders') ||
                            matchedContact.title?.toLowerCase().includes('incoming work order') ||
                            matchedContact.title?.toLowerCase().includes('incoming workorder')
                        ) {
                            isWorkOrderEmail = true;
                        }
                        break;
                    }
                }
            }
        }

        // Try extracting Work Order / Job ID from subject or body
        let jobId = null;
        const jobMatch = subject.match(/(?:WO|JOB|PROP)[#-]?\s*([0-9A-Za-z-]+)/i);
        if (jobMatch) {
            jobId = jobMatch[1];
        }

        // 6. Upload Attachments to Storage if present
        const savedAttachments: Array<{ filename: string; contentType: string; url: string }> = [];
        if (attachments.length > 0) {
            const bucket = admin.storage().bucket();
            for (const att of attachments) {
                try {
                    const filePath = `orgs/${orgId}/inbound_emails/${Date.now()}_${att.filename}`;
                    const fileRef = bucket.file(filePath);
                    await fileRef.save(att.buffer, {
                        contentType: att.contentType,
                        metadata: {
                            orgId,
                            originalName: att.filename
                        }
                    });
                    await fileRef.makePublic().catch(() => {});
                    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${filePath}`;
                    savedAttachments.push({
                        filename: att.filename,
                        contentType: att.contentType,
                        url: publicUrl
                    });
                } catch (attErr) {
                    functions.logger.error(`Failed to upload attachment ${att.filename}`, attErr);
                }
            }
        }

        // 7. Write to Firestore `inboundEmails` collection under Organization
        const emailDocRef = db.collection('organizations').doc(orgId).collection('inboundEmails').doc();
        const emailRecord = {
            id: emailDocRef.id,
            organizationId: orgId,
            from: cleanFromEmail,
            fromRaw: senderRaw,
            senderName: senderDisplayName,
            to: cleanRecipient,
            cc: fields.cc || '',
            bcc: fields.bcc || '',
            subject,
            text: bodyText,
            html: bodyHtml,
            spamScore: fields.spam_score || '0',
            attachments: savedAttachments,
            customerId,
            customerName,
            workOrderContactName,
            isWorkOrderEmail,
            jobId,
            status: 'unread',
            isVerificationEmail,
            verificationCode,
            receivedAt: new Date().toISOString(),
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        };

        await emailDocRef.set(emailRecord);

        // Also add to customer communications log if customer was matched
        if (customerId) {
            await db.collection('customers').doc(customerId).collection('communications').doc(emailRecord.id).set({
                id: emailRecord.id,
                type: 'email',
                direction: 'inbound',
                from: cleanFromEmail,
                to: cleanRecipient,
                subject,
                body: bodyText,
                timestamp: emailRecord.receivedAt,
                attachments: savedAttachments
            }, { merge: true }).catch((commErr: any) => {
                functions.logger.warn(`Failed to mirror communication to customer ${customerId}`, commErr);
            });
        }

        // 8. Create Notification for Organization Dispatchers/Admins
        await db.collection('organizations').doc(orgId).collection('notifications').add({
            title: `New Inbound Email from ${senderDisplayName}`,
            message: subject,
            type: 'inbound_email',
            emailId: emailRecord.id,
            customerId,
            read: false,
            createdAt: new Date().toISOString()
        }).catch(() => {});

        functions.logger.info(`Successfully stored inbound email [${emailRecord.id}] for org [${orgId}]`);
        res.status(200).send('OK');
    } catch (error: any) {
        functions.logger.error('Error handling SendGrid Inbound Parse webhook', error);
        res.status(500).send(`Internal Error: ${error?.message || error}`);
    }
});

export const measureQuickWebhook = functions.https.onRequest(async (req, res) => {
    // Only accept POST requests for incoming webhooks
    if (req.method !== 'POST') {
        res.status(405).send('Method Not Allowed');
        return;
    }

    try {
        const payload = req.body;
        // NOTE: In production with live API keys, we would verify the measureQuick HMAC signature here.

        // Extract routing details
        const jobId = payload.jobId || req.query.jobId;
        const orgId = payload.organizationId || req.query.orgId;

        if (!jobId || !orgId) {
            res.status(400).send('Missing required routing parameters: jobId or organizationId');
            return;
        }

        // Construct the strictly-typed DiagnosticReport record
        const reportId = `mq_${Date.now()}`;
        const report = {
            id: reportId,
            jobId: jobId as string,
            organizationId: orgId as string,
            source: 'measureQuick',
            healthScore: payload.healthScore || null,
            systemType: payload.systemType || null,
            pdfReportUrl: payload.pdfReportUrl || null,
            measurements: payload.measurements || {},
            diagnostics: payload.diagnostics || [],
            createdAt: new Date().toISOString()
        };

        // Save it to the specific Job's sub-collection
        await db.collection('jobs').doc(jobId as string).collection('diagnostics').doc(reportId).set(report);

        functions.logger.info(`Successfully parsed measureQuick report for job ${jobId}`);
        res.status(200).send({ success: true, reportId });

    } catch (error) {
        functions.logger.error('Error processing measureQuick webhook payload', error);
        res.status(500).send('Internal Server Error');
    }
});

export const trackEmailOpen = functions.https.onRequest(async (req, res) => {
    // Permit any email client (Gmail, Outlook, etc) to render the image
    res.set('Access-Control-Allow-Origin', '*');

    const campaignId = req.query.campaignId as string;
    const customerId = req.query.customerId as string;

    if (campaignId) {
        const campaignRef = db.collection('marketingCampaigns').doc(campaignId);
        try {
            await db.runTransaction(async (transaction) => {
                const doc = await transaction.get(campaignRef);
                if (doc.exists) {
                    const data = doc.data() || {};
                    const openedBy = data.openedBy || [];

                    // Conditionally record the specific Customer ID natively
                    if (customerId && !openedBy.includes(customerId)) {
                        transaction.update(campaignRef, {
                            readCount: admin.firestore.FieldValue.increment(1),
                            openedBy: admin.firestore.FieldValue.arrayUnion(customerId)
                        });
                    } else if (!customerId) {
                        transaction.update(campaignRef, {
                            readCount: admin.firestore.FieldValue.increment(1)
                        });
                    }
                }
            });
        } catch (err) {
            functions.logger.error("Pixel Execution Dump:", err);
        }
    }
    // Flush a 1-byte transparent Base64 payload back to the mail client cache
    const pixel = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
    res.set('Content-Type', 'image/gif');
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
    res.send(pixel);
});

// ==========================================
// UNIVERSAL LEAD WEBHOOK (GOOGLE ADS, ZAPIER)
// ==========================================
export const incomingLeadWebhook = functions.runWith({
    timeoutSeconds: 30,
    memory: "256MB"
    // @ts-ignore
}).https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') { res.status(204).send(''); return; }
    if (req.method !== 'POST') { res.status(405).send('Method Not Allowed'); return; }

    try {
        const orgId = req.query.orgId as string || req.body.orgId || req.body.organizationId;
        if (!orgId) { res.status(400).send('Missing orgId (Query Parameter or JSON Body required)'); return; }

        const secretDoc = await admin.firestore().collection('organizations').doc(orgId).collection('secrets').doc('config').get();
        if (!secretDoc.exists) { res.status(403).send("Organization not configured for webhooks."); return; }

        const configuredKey = secretDoc.data()?.webhookSecretKey;
        if (!configuredKey) { res.status(403).send("Webhook secret key not generated for this organization."); return; }

        const providedKey = req.query.apiKey || req.headers.authorization?.replace('Bearer ', '') || req.body.google_key || req.body.googleKey || req.body.apiKey;
        if (providedKey !== configuredKey) { res.status(401).send("Unauthorized Webhook Key."); return; }

        let firstName = req.body.firstName || req.body.customerName || req.body.name || 'Unknown';
        let lastName = req.body.lastName || '';
        let phone = req.body.phone || req.body.phoneNumber || '';
        let email = req.body.email || req.body.emailAddress || '';
        let notes = req.body.notes || req.body.description || req.body.issue || 'Lead ingested via Webhook.';

        // Google Ads Form Payload Format
        if (req.body.user_column_data && Array.isArray(req.body.user_column_data)) {
            req.body.user_column_data.forEach((col: any /* eslint-disable-line @typescript-eslint/no-explicit-any */) => {
                if (col.column_id === 'FIRST_NAME') firstName = col.string_value;
                if (col.column_id === 'LAST_NAME') lastName = col.string_value;
                if (col.column_id === 'PHONE_NUMBER') phone = col.string_value;
                if (col.column_id === 'EMAIL') email = col.string_value;
            });
            notes = 'Lead ingested via Google Ads Campaign.';
        }

        const customerName = `${firstName} ${lastName}`.trim();
        const db = admin.firestore();

        // --- Advanced Webhook Deduplication and Portal Invite ---
        let customerId = '';
        let existingCustomerData: any /* eslint-disable-line @typescript-eslint/no-explicit-any */ = null;

        const matchName = customerName.toLowerCase().trim();
        const matchPhone = phone.replace(/\D/g, '');
        const matchEmail = email.toLowerCase().trim();

        const customersSnapshot = await db.collection('customers').where('organizationId', '==', orgId).limit(200).get();
        const existingDoc = customersSnapshot.docs.find(d => {
            const data = d.data();
            const dName = (data.name || '').toLowerCase().trim();
            const dPhone = (data.phone || '').replace(/\D/g, '');
            const dEmail = (data.email || '').toLowerCase().trim();

            if (dName === matchName && ((matchPhone && dPhone === matchPhone) || (matchEmail && dEmail === matchEmail))) return true;
            if ((matchPhone && dPhone === matchPhone) || (matchEmail && dEmail === matchEmail)) return true;
            return false;
        });

        if (existingDoc) {
            customerId = existingDoc.id;
            existingCustomerData = existingDoc.data();
            const updates: any /* eslint-disable-line @typescript-eslint/no-explicit-any */ = {};
            if (phone && !existingCustomerData.phone) updates.phone = phone;
            if (email && !existingCustomerData.email) updates.email = email;
            if (Object.keys(updates).length > 0) await existingDoc.ref.update(updates);
        } else {
            const newCustomerRef = db.collection('customers').doc();
            await newCustomerRef.set({
                id: newCustomerRef.id,
                organizationId: orgId, name: customerName, email, phone, status: 'active', tags: ['webhook-lead'],
                createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
            });
            customerId = newCustomerRef.id;
        }

        const jobId = `job-${Date.now()}`;
        await db.collection('jobs').doc(jobId).set({
            id: jobId, organizationId: orgId, customerId, title: 'New Webhook Lead Request', status: 'Unassigned', priority: 'Medium',
            description: notes, customerName, customerPhone: phone || existingCustomerData?.phone || '', createdAt: new Date().toISOString()
        });

        // Trigger Automated Portal Invitation Location
        const targetEmail = email || existingCustomerData?.email;
        if (targetEmail) {
            let webhookOrgName = 'TekAir Inc.';
            let webhookOrgEmail = 'Operations@tekairinc.com';
            if (orgId && orgId !== 'unaffiliated') {
                try {
                    const orgSnap = await db.collection('organizations').doc(orgId).get();
                    if (orgSnap.exists) {
                        const oData = orgSnap.data();
                        if (oData?.name) webhookOrgName = oData.name;
                        if (oData?.email) webhookOrgEmail = oData.email;
                    }
                } catch { /* fallback */ }
            }
            const fromHeader = `"${webhookOrgName.replace(/"/g, "'")}" <platform@tektrakker.com>`;

            await db.collection('mail').add({
                to: [targetEmail],
                from: fromHeader,
                replyTo: webhookOrgEmail,
                organizationId: orgId,
                message: {
                    from: fromHeader,
                    replyTo: webhookOrgEmail,
                    subject: `Your Service Request Has Been Received - ${webhookOrgName}`,
                    html: `
                        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
                            <h2>Hi ${firstName || customerName.split(' ')[0]},</h2>
                            <p>Thanks for reaching out! We've secured your service request with <strong>${webhookOrgName}</strong> and our team is reviewing it now.</p>
                            <p>You can view your appointment details, update your information, and manage your account via our secure portal:</p>
                            <div style="text-align: center; margin: 30px 0;">
                                <a href="https://app.tektrakker.com/portal/${customerId}" style="background-color: #0ea5e9; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">View Your Portal</a>
                            </div>
                            <p>If you don't use the button above, copy and paste this link: https://app.tektrakker.com/portal/${customerId}</p>
                            <br/>
                            <p>Best regards,</p>
                            <p><strong>${webhookOrgName}</strong></p>
                        </div>
                    `
                }
            });
        }

        functions.logger.info(`Successfully ingested lead job ${jobId} for Org ${orgId}`);
        res.status(200).send({ success: true, message: "Lead processed successfully." });
    } catch (error: any /* eslint-disable-line @typescript-eslint/no-explicit-any */) {
        functions.logger.error("Webhook Error:", error);
        res.status(500).send({ error: "Internal Server Error processing webhook.", message: error.message });
    }
});

// --- B2B SUPPLIER PUNCHOUT (cXML) ---

export const initiatePunchoutSession = functions.https.onCall(async (data, context) => {
    if (!context.auth) throw new functions.https.HttpsError("unauthenticated", "User must be logged in.");
    const orgId = context.auth.token.organizationId;
    if (!orgId) throw new functions.https.HttpsError("permission-denied", "User has no organization tied.");

    // 1. Fetch the organization's settings
    const secretsDoc = await db.collection('organizations').doc(orgId).collection('secrets').doc('config').get();
    const config = secretsDoc.data()?.punchoutConfig;
    if (!config || !config.setupUrl || !config.sharedSecret) {
        throw new functions.https.HttpsError("failed-precondition", "B2B PunchOut is not fully configured in your Settings.");
    }

    const { fromDomain, fromIdentity, toDomain, toIdentity, sharedSecret, setupUrl } = config;
    if (!fromIdentity || !toIdentity) throw new functions.https.HttpsError("failed-precondition", "PunchOut identity config is incomplete.");

    // The webhook URL built dynamically (We can also use req host if needed, but hardcoding the standard FB URL here for standard cloud functions)
    const browserFormPostURL = `https://${process.env.GCP_PROJECT || 'us-central1-tektrakker'}.cloudfunctions.net/punchoutWebhook?orgId=${orgId}`;

    // 2. Build the cXML Setup Request
    const payloadID = `setup_${Date.now()}@tektrakker`;
    const cxmlObject = {
        cXML: {
            $: {
                payloadID: payloadID,
                timestamp: new Date().toISOString(),
                version: "1.2.008",
                "xml:lang": "en-US"
            },
            Header: [{
                From: [{ Credential: [{ $: { domain: fromDomain }, Identity: [fromIdentity] }] }],
                To: [{ Credential: [{ $: { domain: toDomain }, Identity: [toIdentity] }] }],
                Sender: [{
                    Credential: [{
                        $: { domain: fromDomain },
                        Identity: [fromIdentity],
                        SharedSecret: [sharedSecret]
                    }],
                    UserAgent: ["TekTrakker B2B Agent"]
                }]
            }],
            Request: [{
                $: { deploymentMode: "production" },
                PunchOutSetupRequest: [{
                    $: { operation: "create" },
                    BuyerCookie: [JSON.stringify({ userId: context.auth.uid, jobId: data.jobId || 'GENERAL' })],
                    Extrinsic: [{ $: { name: "UserEmail" }, _: context.auth.token.email || 'user@example.com' }],
                    BrowserFormPost: [{ URL: [browserFormPostURL] }],
                    Contact: [{
                        Name: [{ $: { "xml:lang": "en" }, _: context.auth.token.name || 'TekTrakker Technician' }],
                        Email: [context.auth.token.email || 'platform@tektrakker.com']
                    }]
                }]
            }]
        }
    };

    // 3. Post to Supplier
    const builder = new xml2js.Builder({ headless: true });
    const xml = builder.buildObject(cxmlObject);
    const doctype = '<!DOCTYPE cXML SYSTEM "http://xml.cxml.org/schemas/cXML/1.2.014/cXML.dtd">\n';
    const finalXml = doctype + xml;

    try {
        const response = await fetch(setupUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/xml', 'Accept': 'application/xml' },
            body: finalXml
        });

        const responseText = await response.text();
        const parser = new xml2js.Parser({ explicitArray: false });
        const result = await parser.parseStringPromise(responseText);

        const statusCode = result?.cXML?.Response?.Status?.$?.code;
        if (statusCode === "200") {
            const startPageUrl = result?.cXML?.Response?.PunchOutSetupResponse?.StartPage?.URL;
            if (startPageUrl) {
                return { success: true, url: startPageUrl };
            }
        }

        const errMsg = result?.cXML?.Response?.Status?.$?.text || "Unknown supplier error";
        functions.logger.error("PunchOut Setup Failed", responseText);
        throw new functions.https.HttpsError("internal", "Supplier rejected standard handshake: " + errMsg);

    } catch (e: any /* eslint-disable-line @typescript-eslint/no-explicit-any */) {
        functions.logger.error("PunchOut Fetch Error:", e);
        throw new functions.https.HttpsError("internal", e.message || "Failed to contact supplier.");
    }
});


export const punchoutWebhook = functions.https.onRequest(async (req, res) => {
    // Standard cXML HTTP Post from supplier returning cart
    if (req.method !== 'POST') {
        res.status(405).send('Method Not Allowed');
        return;
    }

    // Use rawBody buffer or string fallback
    const rawXml = (req as any /* eslint-disable-line @typescript-eslint/no-explicit-any */).rawBody ? (req as any /* eslint-disable-line @typescript-eslint/no-explicit-any */).rawBody.toString() : req.body;
    let orgId = req.query.orgId as string;

    if (!rawXml) {
        res.status(400).send("Empty payload");
        return;
    }

    try {
        const parser = new xml2js.Parser({ explicitArray: false });
        const result = await parser.parseStringPromise(rawXml);

        const orderMessage = result?.cXML?.Message?.PunchOutOrderMessage;
        if (!orderMessage) {
            res.status(400).send("Not a valid PunchOutOrderMessage");
            return;
        }

        let buyerCookie = orderMessage.BuyerCookie;
        let jobId = 'GENERAL';
        let userId = 'SYSTEM';
        if (typeof buyerCookie === 'string' && buyerCookie.startsWith('{')) {
            try {
                const cookieMap = JSON.parse(buyerCookie);
                if (cookieMap.jobId) jobId = cookieMap.jobId;
                if (cookieMap.userId) userId = cookieMap.userId;
            } catch { /* ignore */ }
        }

        const totalAmount = parseFloat(orderMessage.PunchOutOrderMessageHeader?.Total?.Money?._ || '0');
        let itemsField = orderMessage.ItemIn || [];
        if (!Array.isArray(itemsField)) itemsField = [itemsField]; // Normalize if single item

        const itemDescriptions = itemsField.map((i: any /* eslint-disable-line @typescript-eslint/no-explicit-any */) => {
            const desc = i.ItemDetail?.Description?._ || i.ItemDetail?.Description || 'Unknown part';
            const price = i.ItemDetail?.UnitPrice?.Money?._ || '0.00';
            const qty = i.$?.quantity || '0';
            return `${qty}x ${desc} @ ${price}`;
        });

        const partsList = itemDescriptions.join(', ');

        // Push the order natively into the TekTrakker DB
        if (orgId) {
            const newPartOrder = {
                id: `po-${Date.now()}`,
                organizationId: orgId,
                jobId: jobId,
                parts: partsList || 'Unknown B2B Order',
                cost: totalAmount,
                status: 'Procured via Supplier Cart',
                fulfillmentMethod: 'B2B PunchOut Integration',
                orderedBy: userId,
                createdAt: new Date().toISOString(),
                supplierTransactionID: result?.cXML?.$?.payloadID || 'Unknown'
            };
            await db.collection('partOrders').doc(newPartOrder.id).set(newPartOrder);
        }

        // Must send 200 OK cXML back acknowledging receipt or supplier will retry
        const replyXml = `<!DOCTYPE cXML SYSTEM "http://xml.cxml.org/schemas/cXML/1.2.014/cXML.dtd">
<cXML payloadID="webhook_reply_${Date.now()}@tektrakker" timestamp="${new Date().toISOString()}" version="1.2.014">
   <Response>
      <Status code="200" text="OK"/>
   </Response>
</cXML>`;

        res.set('Content-Type', 'application/xml');
        res.status(200).send(replyXml);

    } catch (e) {
        functions.logger.error("PunchOut Webhook Parsing Error:", e);
        res.status(500).send('Internal Server Error parsing XML');
    }
});
