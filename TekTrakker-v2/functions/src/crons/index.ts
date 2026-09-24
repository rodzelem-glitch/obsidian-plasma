/* eslint-disable @typescript-eslint/no-explicit-any */
import * as functions from "firebase-functions/v1";
import * as admin from "firebase-admin";
import * as nodemailer from "nodemailer";

if (admin.apps.length === 0) {
    try { admin.initializeApp(); } catch { /* ignore */ }
}
const db = admin.firestore();

export const automatedMaintenanceReminders = functions.pubsub.schedule('0 9 * * *')
    .timeZone('America/New_York')
    .onRun(async () => {
        try {
            const now = new Date();
            // Pre-cache organizations to eliminate N+1 round-trip queries inside loop
            const orgsSnap = await db.collection('organizations').get();
            const orgsCache: { [key: string]: any /* eslint-disable-line @typescript-eslint/no-explicit-any */ } = {};
            orgsSnap.forEach(o => { orgsCache[o.id] = o.data(); });

            const customersSnap = await db.collection('customers').get();
            const batchOperations: Promise<any /* eslint-disable-line @typescript-eslint/no-explicit-any */>[] = [];

            for (const doc of customersSnap.docs) {
                const customer = doc.data();
                if (!customer.equipment || !Array.isArray(customer.equipment)) continue;

                let orgName = 'Service Provider';
                let orgEmail = '';
                let orgLicense = '';

                if (customer.organizationId && customer.organizationId !== 'unaffiliated') {
                    const orgData = orgsCache[customer.organizationId] || { name: 'Service Provider' };
                    orgName = orgData.name || 'Service Provider';
                    orgEmail = orgData.email || '';
                    orgLicense = orgData.licenseNumber || orgData.license || '';
                }

                const licenseFooterText = orgLicense ? `\n\nState License: ${orgLicense}` : '';
                const licenseFooterHtml = orgLicense ? `<br/><br/><small style="color:#6b7280;font-size:12px;">State License: ${orgLicense}</small>` : '';

                let hasWarrantiedHVAC = false;

                customer.equipment.forEach((asset: any /* eslint-disable-line @typescript-eslint/no-explicit-any */) => {
                    // Check if maintenance tracking applies (opt-out model: tracked unless requiresMaintenance === false)
                    const isTracked = asset.warranty?.requiresMaintenance !== false;
                    const intervalMonths = asset.warranty?.maintenanceIntervalMonths || 6;

                    if (isTracked && intervalMonths > 0) {
                        let baseDate: Date | null = null;
                        if (asset.warranty?.lastMaintenanceDate) {
                            baseDate = new Date(asset.warranty.lastMaintenanceDate);
                        } else if (asset.installDate) {
                            baseDate = new Date(asset.installDate);
                        } else if (asset.warranty?.manufacturerStartDate) {
                            baseDate = new Date(asset.warranty.manufacturerStartDate);
                            baseDate.setDate(baseDate.getDate() + 1); // fix offset
                        } else if (customer.createdAt) {
                            baseDate = new Date(customer.createdAt);
                        }

                        if (baseDate && !isNaN(baseDate.getTime())) {
                            const nextDate = new Date(baseDate);
                            nextDate.setMonth(nextDate.getMonth() + intervalMonths);
                            // Advance in seasonal intervals until the active/upcoming cycle
                            while (nextDate.getTime() < now.getTime() - (15 * 86400000)) {
                                nextDate.setMonth(nextDate.getMonth() + intervalMonths);
                            }

                            const diffTime = nextDate.getTime() - now.getTime();
                            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                            // Send reminder if exactly 30 days out or 7 days out
                            if (diffDays === 30 || diffDays === 7) {
                                if (customer.email) {
                                    // Write to mail collection for Trigger Email Extension
                                    const portalUrl = `https://tektrakker-v2.web.app/#/portal/auth?orgId=${customer.organizationId}`;
                                    const mailDoc = {
                                        toUids: [doc.id],
                                        to: customer.email,
                                        message: {
                                            from: `${orgName} <platform@tektrakker.com>`,
                                            replyTo: orgEmail || 'rvavrecan@tekairinc.com',
                                            subject: `Action Required: Maintenance due for your ${asset.brand || ''} Equipment`,
                                            text: `Hello ${customer.name || 'Valued Customer'},\n\nThis is an automated reminder from ${orgName} that your ${asset.brand || 'HVAC'} ${asset.type || 'system'} is due for routine warranty maintenance in ${diffDays} days.\n\nPlease schedule an appointment through your portal to maintain your warranty compliance: ${portalUrl}\n\nThank you,\n${orgName}${licenseFooterText}`,
                                            html: `<p>Hello <strong>${customer.name || 'Valued Customer'}</strong>,</p>
                                                   <p>This is an automated reminder from <strong>${orgName}</strong> that your <strong>${asset.brand || 'HVAC'} ${asset.type || 'system'}</strong> is due for routine warranty maintenance in <strong>${diffDays} days</strong>.</p>
                                                   <p>Please schedule an appointment through your portal to maintain your warranty coverage.</p>
                                                   <p><a href="${portalUrl}" style="background-color:#2563eb;color:white;padding:10px 15px;text-decoration:none;border-radius:5px;display:inline-block;margin-top:10px;">Access Service Portal to Schedule</a></p>
                                                   <p>Thank you,<br/><strong>${orgName}</strong></p>${licenseFooterHtml}`
                                        }
                                    };
                                    batchOperations.push(db.collection('mail').add(mailDoc));
                                }
                            }
                        }
                    }

                    // Check if this is an HVAC asset for the monthly filter reminder
                    const typeStr = (asset.type || '').toLowerCase();
                    if (typeStr.includes('ac') || typeStr.includes('heat') || typeStr.includes('furnace') || typeStr.includes('air') || typeStr.includes('hvac') || typeStr.includes('split') || typeStr.includes('handler') || typeStr.includes('condenser')) {
                        hasWarrantiedHVAC = true;
                    }
                });

                // On the 1st of the month, send a filter reminder to those with warrantied HVAC systems
                if (now.getDate() === 1 && hasWarrantiedHVAC && customer.email) {
                    const filterMailDoc = {
                        toUids: [doc.id],
                        to: customer.email,
                        message: {
                            from: `${orgName} <platform@tektrakker.com>`,
                            replyTo: orgEmail || 'rvavrecan@tekairinc.com',
                            subject: `Monthly Reminder: Time to Check Your Air Filters - ${orgName}`,
                            text: `Hello ${customer.name || 'Valued Customer'},\n\nThis is your monthly automated reminder from ${orgName} to check and replace the air filters in your HVAC system. Clean filters ensure your system runs efficiently and maintains its active warranty coverage.\n\nThank you,\n${orgName}${licenseFooterText}`,
                            html: `<p>Hello <strong>${customer.name || 'Valued Customer'}</strong>,</p>
                                    <p>This is your monthly automated reminder from <strong>${orgName}</strong> to <strong>check and replace the air filters</strong> in your HVAC system.</p>
                                    <p>Clean filters ensure your system runs efficiently, keeps your air clean, and prevents expensive damages that may void your active warranty coverage.</p>
                                    <p>Thank you for staying on top of your maintenance!<br/><strong>${orgName}</strong></p>${licenseFooterHtml}`
                        }
                    };
                    batchOperations.push(db.collection('mail').add(filterMailDoc));
                }
            }

            await Promise.all(batchOperations);
            functions.logger.info(`Automated Maintenance Sweep completed. Dispatched ${batchOperations.length} email reminders.`);

        } catch (error) {
            functions.logger.error("Failed to run automatedMaintenanceReminders:", error);
        }
    });

export const enforceHardQuotas = functions.pubsub.schedule('every 24 hours').onRun(async () => {
    const orgsSnap = await db.collection('organizations').where('subscriptionStatus', '==', 'active').get();

    // Limits: 100,000 Customers or 100,000 Jobs per organization heavily translates to more than \/mo of reads/storage.
    const SAFETY_LIMIT_COUNT = 100000;

    for (const org of orgsSnap.docs) {
        const orgId = org.id;

        try {
            const customersSnap = await db.collection('customers').where('organizationId', '==', orgId).count().get();
            const jobsSnap = await db.collection('jobs').where('organizationId', '==', orgId).count().get();

            const totalDocs = customersSnap.data().count + jobsSnap.data().count;

            if (totalDocs > SAFETY_LIMIT_COUNT) {
                functions.logger.warn(`Org ${orgId} surpassed infra limit proxy (${totalDocs} docs). Suspending.`);
                await org.ref.update({ subscriptionStatus: 'suspended_quota' });
            }
        } catch (e) {
            console.error('Failed to analyze quota for', orgId, e);
        }
    }
});

export const automatedBidReminders = functions.pubsub.schedule('0 8 * * *').timeZone('America/New_York').onRun(async () => {
    try {
        const now = new Date();
        now.setHours(0,0,0,0);

        const bidsSnap = await db.collection('bids')
            .where('status', 'in', ['Draft', 'Analyzing', 'Costing', 'Review'])
            .get();

        const promises: Promise<any /* eslint-disable-line @typescript-eslint/no-explicit-any */>[] = [];

        for (const doc of bidsSnap.docs) {
            const bid = doc.data();
            const orgId = bid.organizationId;
            if (!orgId) continue;
            
            // Collect all upcoming dates for this bid
            const upcomingEvents: {name: string, date: Date}[] = [];
            
            if (bid.dueDate) {
                const parsed = new Date(bid.dueDate);
                if (!isNaN(parsed.getTime())) upcomingEvents.push({name: 'Final Proposal Due', date: parsed});
            }
            
            if (bid.importantDates && Array.isArray(bid.importantDates)) {
                bid.importantDates.forEach((d: any /* eslint-disable-line @typescript-eslint/no-explicit-any */) => {
                    const parsed = new Date(d.date);
                    if (!isNaN(parsed.getTime())) upcomingEvents.push({name: d.name, date: parsed});
                });
            }
            
            // Check if any date is exactly 3 days or 7 days away
            const notificationsToSend: string[] = [];
            
            upcomingEvents.forEach(event => {
                event.date.setHours(0,0,0,0);
                const diffTime = event.date.getTime() - now.getTime();
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                
                if (diffDays === 3 || diffDays === 7 || diffDays === 1) {
                    notificationsToSend.push(`${event.name} is in ${diffDays} day(s) (${event.date.toLocaleDateString()}).`);
                }
            });
            
            if (notificationsToSend.length > 0) {
                // Find users in this org who handle bids (or all admins)
                const usersSnap = await db.collection('users')
                    .where('organizationId', '==', orgId)
                    .get();
                    
                const admins = usersSnap.docs.filter(u => u.data().role === 'admin' || u.data().role === 'manager');
                
                for (const adminDoc of admins) {
                    const adminId = adminDoc.id;
                    const messageText = `Reminder for Bid "${bid.title || 'Untitled'}":\n` + notificationsToSend.join('\n');
                    
                    // Internal Notification
                    promises.push(db.collection('users').doc(adminId).collection('notifications').add({
                        title: 'Upcoming Bid Deadline',
                        message: messageText,
                        createdAt: new Date().toISOString(),
                        read: false,
                        link: `/admin/bid-workspace?id=${bid.id}`
                    }));
                    
                    // Email Reminder
                    const adminEmail = adminDoc.data().email;
                    if (adminEmail) {
                        promises.push(db.collection('mail_queue').add({ organizationId: orgId, to: adminEmail, message: { subject: 'Upcoming Bid Deadline Reminder', html: `<html><body style="font-family: sans-serif; padding: 20px;"><h2 style="color: #1e40af;">Upcoming Bid Deadline Reminder</h2><p>This is an automated reminder regarding the bid: <strong>${bid.title || 'Untitled'}</strong></p><p>The following deadlines are approaching:</p><ul>${notificationsToSend.map(n => '<li>' + n + '</li>').join('')}</ul><a href="https://tektrakker.web.app/admin/bid-workspace?id=${bid.id}" style="display:inline-block; padding: 10px 15px; background: #2563eb; color: white; text-decoration: none; border-radius: 5px;">View Bid in TekTrakker</a></body></html>` }, createdAt: new Date().toISOString() }));
                    }
                }
            }
        }
        
        await Promise.allSettled(promises);
    } catch (error) {
        functions.logger.error("Error in automatedBidReminders:", error);
    }
});

export const cleanupBidOnDelete = functions.firestore.document('bids/{bidId}').onDelete(async (snap, context) => {
    const bidId = context.params.bidId;
    const bidData = snap.data();
    const orgId = bidData.organizationId;
    if (!orgId) return;

    try {
        const usersSnap = await db.collection('users').where('organizationId', '==', orgId).get();
        const batch = db.batch();
        let count = 0;

        for (const userDoc of usersSnap.docs) {
            const notificationsSnap = await db.collection('users').doc(userDoc.id).collection('notifications')
                .where('link', '==', `/admin/bid-workspace?id=${bidId}`)
                .get();
                
            notificationsSnap.docs.forEach(doc => {
                batch.delete(doc.ref);
                count++;
            });
        }

        if (count > 0) {
            await batch.commit();
            functions.logger.info(`Deleted ${count} notifications for deleted bid ${bidId}`);
        }
    } catch (e) {
        functions.logger.error("Error cleaning up bid notifications:", e);
    }
});

export const checkApiKeyExpirations = functions.pubsub.schedule('0 9 * * *').timeZone('America/New_York').onRun(async () => {
    try {
        const now = new Date();
        now.setHours(0,0,0,0);
        
        const keysSnap = await db.collection('platformSettings').doc('api_keys').get();
        
        if (!keysSnap.exists) {
            const oneYearFromNow = new Date();
            oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);
            await db.collection('platformSettings').doc('api_keys').set({
                'SAM.gov': {
                    key: 'SAM-f4ad5cf0-1535-4a33-8c50-f2e78267fb11',
                    expiresAt: oneYearFromNow.toISOString()
                }
            });
            return;
        }

        const keysData = keysSnap.data() || {};
        const promises: Promise<any /* eslint-disable-line @typescript-eslint/no-explicit-any */>[] = [];
        const expiringKeys: string[] = [];

        Object.entries(keysData).forEach(([serviceName, data]: [string, any /* eslint-disable-line @typescript-eslint/no-explicit-any */]) => {
            if (data.expiresAt) {
                const expDate = new Date(data.expiresAt);
                expDate.setHours(0,0,0,0);
                const diffDays = Math.ceil((expDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                
                if ([30, 15, 7, 3, 1].includes(diffDays) || diffDays <= 0) {
                    expiringKeys.push(`${serviceName} API Key ${diffDays <= 0 ? 'HAS EXPIRED' : `expires in ${diffDays} day(s)`} on ${expDate.toLocaleDateString()}`);
                }
            }
        });

        if (expiringKeys.length > 0) {
            const masterAdmins = await db.collection('users').where('role', '==', 'master_admin').get();
            
            for (const adminDoc of masterAdmins.docs) {
                const adminEmail = adminDoc.data().email;
                if (adminEmail) {
                    promises.push(db.collection('mail_queue').add({ organizationId: 'system', to: adminEmail, message: { subject: 'API Key Expiration Warning', html: `<html><body style="font-family: sans-serif; padding: 20px;"><h2 style="color: #ef4444;">API Key Expiration Warning</h2><p>This is an automated system alert regarding your platform's API keys.</p><ul>${expiringKeys.map(k => '<li><strong>' + k + '</strong></li>').join('')}</ul><p>Please update the keys in the codebase and the platformSettings/api_keys Firestore document to prevent service interruption.</p></body></html>` }, createdAt: new Date().toISOString() }));
                }
            }
        }
        
        await Promise.allSettled(promises);
    } catch (error) {
        functions.logger.error("Error in checkApiKeyExpirations:", error);
    }
});

export const checkNewHireReporting = functions.pubsub.schedule('0 9 * * *').timeZone('America/New_York').onRun(async () => {
    try {
        const now = new Date();
        now.setHours(0,0,0,0);
        
        const staffRoles = ['employee', 'admin', 'supervisor', 'technician'];
        const usersSnap = await db.collection('users').where('role', 'in', staffRoles).get();
        
        const promises: Promise<any /* eslint-disable-line @typescript-eslint/no-explicit-any */>[] = [];
        
        for (const userDoc of usersSnap.docs) {
            const userData = userDoc.data();
            const hireDateStr = userData.hireDate;
            const orgId = userData.organizationId;
            
            if (!hireDateStr || !orgId) continue;
            
            const hireDate = new Date(hireDateStr);
            if (isNaN(hireDate.getTime())) continue;

            hireDate.setHours(0,0,0,0);
            
            const diffDays = Math.ceil((now.getTime() - hireDate.getTime()) / (1000 * 60 * 60 * 24));
            
            if (diffDays === 10 || diffDays === 15 || diffDays === 19) {
                // Find admins of this org
                const orgAdminsSnap = await db.collection('users')
                    .where('organizationId', '==', orgId)
                    .where('role', '==', 'admin')
                    .get();
                    
                for (const adminDoc of orgAdminsSnap.docs) {
                    const adminId = adminDoc.id;
                    const daysLeft = 20 - diffDays;
                    const messageText = `Reminder: Please report your new hire ${userData.firstName || ''} ${userData.lastName || ''} to the state registry. You have ${daysLeft} day(s) left.`;
                    
                    promises.push(db.collection('users').doc(adminId).collection('notifications').add({
                        title: 'Action Required: New Hire Reporting',
                        message: messageText,
                        createdAt: new Date().toISOString(),
                        read: false,
                        type: 'system_alert',
                        link: `/admin/workforce`
                    }));
                }
            }
        }
        
        await Promise.allSettled(promises);
    } catch (error) {
        functions.logger.error("Error in checkNewHireReporting:", error);
    }
});

export const checkProposalExpirations = functions.pubsub.schedule('0 9 * * *').timeZone('America/New_York').onRun(async () => {
    try {
        const now = new Date();
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const proposalsSnap = await db.collection('proposals')
            .where('status', 'in', ['Sent', 'Opened'])
            .get();

        let batch = db.batch();
        let count = 0;

        for (const doc of proposalsSnap.docs) {
            const data = doc.data();
            const sentAt = data.sentAt ? new Date(data.sentAt) : (data.createdAt ? new Date(data.createdAt) : null);
            
            if (sentAt && sentAt <= thirtyDaysAgo) {
                const updatedHistory = [
                    ...(data.trackingHistory || []),
                    {
                        status: 'Expired',
                        timestamp: now.toISOString(),
                        updatedBy: 'System',
                        notes: 'Proposal marked expired automatically after 30 days of inactivity'
                    }
                ];
                batch.update(doc.ref, {
                    status: 'Expired',
                    trackingHistory: updatedHistory,
                    updatedAt: now.toISOString()
                });
                count++;
                
                if (count % 400 === 0) {
                    await batch.commit();
                    batch = db.batch();
                }
            }
        }

        if (count % 400 !== 0) {
            await batch.commit();
        }

        if (count > 0) {
            functions.logger.info(`Automated Proposal Expiry Sweep: Marked ${count} proposals as Expired.`);
        } else {
            functions.logger.info(`Automated Proposal Expiry Sweep: No proposals to expire.`);
        }
    } catch (error) {
        functions.logger.error("Error in checkProposalExpirations:", error);
    }
});

export const userCalendarFeed = functions.https.onRequest(async (req, res) => {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.status(204).send('');
        return;
    }

    if (req.method !== 'GET') {
        res.status(405).send('Method Not Allowed');
        return;
    }

    try {
        const userId = req.query.userId as string;
        const orgId = req.query.orgId as string;

        if (!userId || !orgId) {
            res.status(400).send('Missing required parameters: userId and orgId');
            return;
        }

        // 1. Verify user exists and belongs to the organization
        const userDoc = await db.collection('users').doc(userId).get();
        if (!userDoc.exists) {
            res.status(404).send('User not found');
            return;
        }

        const userData = userDoc.data();
        if (!userData || userData.organizationId !== orgId) {
            res.status(403).send('Unauthorized access to this calendar feed');
            return;
        }

        // Helpers
        const formatIcsDate = (dateStr: any): string => {
            if (!dateStr) return new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
            try {
                const d = new Date(dateStr);
                if (isNaN(d.getTime())) {
                    return new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
                }
                return d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
            } catch {
                return new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
            }
        };

        const escapeIcsText = (str: any): string => {
            if (str === null || str === undefined) return '';
            const s = String(str);
            return s
                .replace(/\\/g, '\\\\')
                .replace(/,/g, '\\,')
                .replace(/;/g, '\\;')
                .replace(/\n/g, '\\n')
                .replace(/\r/g, '');
        };

        // 2. Fetch jobs
        const [jobsSnap1, jobsSnap2] = await Promise.all([
            db.collection('jobs')
                .where('organizationId', '==', orgId)
                .where('assignedTechnicianId', '==', userId)
                .get(),
            db.collection('jobs')
                .where('organizationId', '==', orgId)
                .where('assistants', 'array-contains', userId)
                .get()
        ]);

        const jobsMap = new Map<string, any>();
        jobsSnap1.docs.forEach(doc => jobsMap.set(doc.id, doc.data()));
        jobsSnap2.docs.forEach(doc => jobsMap.set(doc.id, doc.data()));
        const jobs = Array.from(jobsMap.values());

        // 3. Fetch company events
        const eventsSnap = await db.collection('events')
            .where('organizationId', '==', orgId)
            .get();

        const events = eventsSnap.docs.map(doc => doc.data()).filter(evt => {
            return !evt.attendees || evt.attendees.length === 0 || evt.attendees.includes(userId);
        });

        // 4. Generate ICS content
        const lines: string[] = [
            'BEGIN:VCALENDAR',
            'VERSION:2.0',
            'PRODID:-//TekTrakker//NONSGML Calendar Feed//EN',
            'CALSCALE:GREGORIAN',
            'METHOD:PUBLISH'
        ];

        // Add Jobs
        for (const job of jobs) {
            lines.push('BEGIN:VEVENT');
            lines.push(`UID:job_${job.id}`);
            lines.push(`DTSTAMP:${formatIcsDate(job.createdAt || job.appointmentTime)}`);
            lines.push(`DTSTART:${formatIcsDate(job.appointmentTime)}`);

            // Compute end time (default to +2h if missing)
            let endTime = job.endTime;
            if (!endTime && job.appointmentTime) {
                const startD = new Date(job.appointmentTime);
                if (!isNaN(startD.getTime())) {
                    startD.setHours(startD.getHours() + 2);
                    endTime = startD.toISOString();
                }
            }
            lines.push(`DTEND:${formatIcsDate(endTime || job.appointmentTime)}`);

            lines.push(`SUMMARY:${escapeIcsText('Job: ' + (job.customerName || 'Service Call'))}`);

            // Construct description
            const tasksStr = Array.isArray(job.tasks) && job.tasks.length > 0
                ? `Tasks: ${job.tasks.join(', ')}`
                : '';
            const instructionsStr = job.specialInstructions
                ? `Special Instructions: ${job.specialInstructions}`
                : '';
            const statusStr = `Status: ${job.jobStatus || 'Scheduled'}`;
            const descParts = [statusStr, tasksStr, instructionsStr].filter(p => p.length > 0);
            lines.push(`DESCRIPTION:${escapeIcsText(descParts.join('\\n'))}`);

            // Address location
            let locStr = '';
            if (job.address) {
                if (typeof job.address === 'string') {
                    locStr = job.address;
                } else if (typeof job.address === 'object') {
                    locStr = [
                        job.address.street,
                        job.address.city,
                        job.address.state,
                        job.address.zip
                    ].filter(Boolean).join(', ');
                }
            }
            if (locStr) {
                lines.push(`LOCATION:${escapeIcsText(locStr)}`);
            }

            lines.push('END:VEVENT');
        }

        // Add Corporate Events
        for (const event of events) {
            lines.push('BEGIN:VEVENT');
            lines.push(`UID:event_${event.id}`);
            lines.push(`DTSTAMP:${formatIcsDate(event.createdAt || event.startDate)}`);
            lines.push(`DTSTART:${formatIcsDate(event.startDate)}`);
            lines.push(`DTEND:${formatIcsDate(event.endDate || event.startDate)}`);
            lines.push(`SUMMARY:${escapeIcsText('Event: ' + (event.title || 'Company Event'))}`);

            const typeStr = `Type: ${event.type || 'meeting'}`;
            const descStr = event.description ? `Description: ${event.description}` : '';
            const virtualStr = event.isVirtual && event.virtualLink ? `Virtual Link: ${event.virtualLink}` : '';
            const descParts = [typeStr, descStr, virtualStr].filter(p => p.length > 0);
            lines.push(`DESCRIPTION:${escapeIcsText(descParts.join('\\n'))}`);

            let locStr = '';
            if (event.isVirtual) {
                locStr = event.virtualLink || 'Virtual Meeting';
            } else {
                locStr = event.location || '';
            }
            if (locStr) {
                lines.push(`LOCATION:${escapeIcsText(locStr)}`);
            }

            lines.push('END:VEVENT');
        }

        lines.push('END:VCALENDAR');

        const icsContent = lines.join('\r\n');

        res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="calendar.ics"');
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.status(200).send(icsContent);

    } catch (error: any) {
        functions.logger.error("Error in userCalendarFeed Cloud Function:", error);
        res.status(500).send("Internal Server Error");
    }
});

export const autoTrackMileageOnClockOut = functions.firestore
    .document('shiftLogs/{shiftId}')
    .onWrite(async (change, context) => {
        const beforeData = change.before.exists ? change.before.data() : null;
        const afterData = change.after.exists ? change.after.data() : null;

        if (!afterData) return null;

        const clockOutNewlySet = afterData.clockOut && (!beforeData || !beforeData.clockOut);
        if (!clockOutNewlySet) {
            return null;
        }

        const { organizationId, userId, startLocation, endLocation, clockOut } = afterData;

        if (!userId || !organizationId) {
            functions.logger.info("Missing userId or organizationId in shiftLog, skipping mileage tracking.");
            return null;
        }

        if (!startLocation || !endLocation || 
            typeof startLocation.lat !== 'number' || typeof startLocation.lng !== 'number' ||
            typeof endLocation.lat !== 'number' || typeof endLocation.lng !== 'number') {
            functions.logger.info(`Missing startLocation or endLocation coords for shiftLog ${context.params.shiftId}, skipping mileage tracking.`);
            return null;
        }

        // Calculate Haversine distance
        const lat1 = startLocation.lat;
        const lon1 = startLocation.lng;
        const lat2 = endLocation.lat;
        const lon2 = endLocation.lng;

        const R = 3958.8; // Earth's radius in miles
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                  Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                  Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const distanceInMiles = R * c;

        const mileage = Math.round(distanceInMiles);
        const dateStr = typeof clockOut === 'string' ? clockOut.substring(0, 10) : new Date().toISOString().substring(0, 10);

        const db = admin.firestore();

        // Check if there is an existing vehicle log for this shift to avoid duplicates
        const logId = `vl-shift-${context.params.shiftId}`;
        const logRef = db.collection('vehicleLogs').doc(logId);
        const logDoc = await logRef.get();

        if (logDoc.exists) {
            functions.logger.info(`Vehicle log ${logId} already exists, skipping duplicate creation.`);
            return null;
        }

        // Fetch user info to get username / default vehicle if any
        let vehicleId = "personal";
        let isCompanyVehicle = false;
        try {
            const userDoc = await db.collection('users').doc(userId).get();
            if (userDoc.exists) {
                const userData = userDoc.data();
                if (userData?.assignedVehicleId) {
                    vehicleId = userData.assignedVehicleId;
                    isCompanyVehicle = true;
                }
            }
        } catch (err) {
            functions.logger.error("Error fetching user vehicle info:", err);
        }

        const newVehicleLog = {
            id: logId,
            organizationId,
            userId,
            vehicleId,
            date: dateStr,
            type: "Mileage",
            mileage,
            isCompanyVehicle,
            notes: `Auto-tracked mileage on clock out for shift ${context.params.shiftId}`,
            cost: 0,
            startLocation: { lat: lat1, lng: lon1 },
            endLocation: { lat: lat2, lng: lon2 },
            createdAt: new Date().toISOString()
        };

        await logRef.set(newVehicleLog);
        functions.logger.info(`Successfully created auto mileage log ${logId} with distance ${mileage} miles.`);
        return null;
    });

export const outreachEmailWarmup = functions.pubsub.schedule('0 9,14,18 * * *').timeZone('America/New_York').onRun(async () => {
    functions.logger.info("Starting automated outreach email warmup run...");

    try {
        // 1. Fetch the campaign SMTP config from secrets config
        const secretDoc = await db.collection('organizations').doc('platform').collection('secrets').doc('config').get();
        if (!secretDoc.exists) {
            functions.logger.warn("No platform secrets config document found. Skipping warmup.");
            return;
        }

        const secrets = secretDoc.data() || {};
        const smtpConfig = secrets.campaignSmtpConfig;

        if (!smtpConfig || !smtpConfig.host || !smtpConfig.user || !smtpConfig.pass) {
            functions.logger.warn("Campaign SMTP configuration is missing or incomplete. Skipping warmup.");
            return;
        }

        // 2. Prepare random topics for conversations
        const conversations = [
            {
                subject: "Inquiry about partnership integrations",
                body: "Hello, I wanted to follow up and see if you had any availability to discuss the partnership integration details we talked about. Let me know what day works best.",
                replySubject: "Re: Inquiry about partnership integrations",
                replyBody: "Thanks for reaching out. Yes, I have some time next Tuesday morning. Let me send over a calendar invite so we can sync."
            },
            {
                subject: "Question regarding custom tool setup",
                body: "Hi there, we are checking the new custom tool settings and wanted to verify if you received the latest project proposal document. Let me know when you get a chance.",
                replySubject: "Re: Question regarding custom tool setup",
                replyBody: "Yes, I received the proposal and it looks good. We are going to review it with the team and get back to you shortly."
            },
            {
                subject: "API integration verification check",
                body: "Hi team, quick question on the API documentation. Do we need to whitelist the domain before testing the endpoints? Thanks!",
                replySubject: "Re: API integration verification check",
                replyBody: "Hello, yes you will need to add the domain to your authorized origins in the console first. Let me know if you need help with that."
            },
            {
                subject: "Follow up on scheduling next week's sync",
                body: "Hi, hope you are having a productive week. Can we schedule a short 10-minute sync next Tuesday morning to review the new features? Let me know your thoughts.",
                replySubject: "Re: Follow up on scheduling next week's sync",
                replyBody: "Hi! Next Tuesday at 10 AM works perfectly for me. Talk to you then!"
            },
            {
                subject: "Question on platform service options",
                body: "Hello, I was looking at the service details page and had a quick question regarding the custom booster tiers. Is there a setup limit?",
                replySubject: "Re: Question on platform service options",
                replyBody: "Hi, no there is no setup limit on the booster packs; they scale dynamically based on your organization's API usage. Let me know if you want to schedule a call."
            }
        ];

        const randomIndex = Math.floor(Math.random() * conversations.length);
        const choice = conversations[randomIndex];

        // Add a slight randomization marker to subjects/bodies so spam filters don't mark duplicates
        const randomMarker = Math.random().toString(36).substring(7).toUpperCase();
        const outboundSubject = `${choice.subject} [#${randomMarker}]`;
        const outboundBody = `<p>${choice.body}</p><p style="color: #cbd5e1; font-size: 10px; margin-top: 15px;">System warmup ping ${randomMarker}</p>`;
        const inboundSubject = `${choice.replySubject} [#${randomMarker}]`;
        const inboundBody = `<p>${choice.replyBody}</p><p style="color: #cbd5e1; font-size: 10px; margin-top: 15px;">System warmup reply ${randomMarker}</p>`;

        // 3. Send outbound email (sales@tektrakker.info -> platform@tektrakker.com) via dedicated SMTP
        const transporter = nodemailer.createTransport({
            host: smtpConfig.host,
            port: smtpConfig.port || 587,
            secure: smtpConfig.port === 465,
            auth: {
                user: smtpConfig.user,
                pass: smtpConfig.pass
            }
        });

        const fromHeader = `"${smtpConfig.fromName || 'TekTrakker Outreach'}" <${smtpConfig.fromEmail || smtpConfig.user}>`;
        
        functions.logger.info("Sending warmup email from sales@tektrakker.info to platform@tektrakker.com...");
        const info = await transporter.sendMail({
            from: fromHeader,
            to: 'platform@tektrakker.com',
            subject: outboundSubject,
            html: outboundBody
        });
        functions.logger.info("Sent warmup outbound email:", info.messageId);

        // 4. Queue inbound email (platform@tektrakker.com -> sales@tektrakker.info) via platform's standard default mail queue
        functions.logger.info("Queueing warmup reply from platform@tektrakker.com to sales@tektrakker.info...");
        await db.collection('mail_queue').add({
            to: [smtpConfig.fromEmail || smtpConfig.user],
            message: {
                subject: inboundSubject,
                html: inboundBody,
                replyTo: 'platform@tektrakker.com'
            },
            organizationId: 'platform',
            type: 'SystemWarmup',
            createdAt: new Date().toISOString()
        });
        functions.logger.info("Successfully queued warmup reply.");

    } catch (error) {
        functions.logger.error("Error running outreach email warmup:", error);
    }
});

export const sendMonthlyCommercialStatements = functions.pubsub.schedule('0 9 28-31 * *')
    .timeZone('America/New_York')
    .onRun(async () => {
        try {
            // 1. Check if today is the last day of the month in America/New_York timezone
            const nyDateStr = new Date().toLocaleString("en-US", { timeZone: "America/New_York" });
            const nyDate = new Date(nyDateStr);
            const tomorrow = new Date(nyDate);
            tomorrow.setDate(nyDate.getDate() + 1);

            if (tomorrow.getDate() !== 1) {
                functions.logger.info(`Today (${nyDate.toDateString()}) is not the last day of the month in America/New_York. Skipping statement run.`);
                return;
            }

            functions.logger.info("Executing automated monthly Statement of Account runs...");

            // 2. Query all organizations where autoSendMonthlyStatements is true
            const orgsSnap = await db.collection('organizations')
                .where('autoSendMonthlyStatements', '==', true)
                .get();

            if (orgsSnap.empty) {
                functions.logger.info("No organizations have automated monthly statements enabled.");
                return;
            }

            for (const orgDoc of orgsSnap.docs) {
                const orgId = orgDoc.id;
                const orgData = orgDoc.data();
                
                // Skip if suspended/inactive
                if (orgData.subscriptionStatus && !['active', 'trialing'].includes(orgData.subscriptionStatus)) {
                    functions.logger.info(`Skipping inactive organization ${orgId} (${orgData.name})`);
                    continue;
                }

                functions.logger.info(`Processing monthly statements for organization: ${orgData.name || orgId}`);

                const orgName = orgData.name || 'Service Provider';
                const orgPhone = orgData.phone || '';
                const orgEmail = orgData.email || '';
                const orgAddress = orgData.address 
                    ? `${orgData.address.street || ''}, ${orgData.address.city || ''}, ${orgData.address.state || ''} ${orgData.address.zip || ''}`
                    : '';

                // Fetch jobs for this organization to compile invoice ledgers
                const jobsSnap = await db.collection('jobs')
                    .where('organizationId', '==', orgId)
                    .get();

                // Group jobs by customerId (skipping deleted jobs)
                const jobsByCustomer: { [customerId: string]: any[] } = {};
                jobsSnap.forEach(jobDoc => {
                    const job = { id: jobDoc.id, ...jobDoc.data() } as any;
                    if (job.deleted || job.deletedAt || job.jobStatus === 'Deleted' || job.status === 'Deleted') {
                        return;
                    }
                    if (job.customerId) {
                        if (!jobsByCustomer[job.customerId]) {
                            jobsByCustomer[job.customerId] = [];
                        }
                        jobsByCustomer[job.customerId].push(job);
                    }
                });

                // Fetch commercial customers for this organization
                const customersSnap = await db.collection('customers')
                    .where('organizationId', '==', orgId)
                    .where('customerType', '==', 'Commercial')
                    .get();

                for (const custDoc of customersSnap.docs) {
                    const customer = { id: custDoc.id, ...custDoc.data() } as any;
                    const emailTarget = customer.billingContact?.email || customer.email;

                    if (!emailTarget) {
                        functions.logger.warn(`Commercial customer ${customer.name || customer.id} has no email. Skipping statement.`);
                        continue;
                    }

                    const customerJobs = jobsByCustomer[customer.id] || [];
                    const rawInvoiceJobs = customerJobs.filter(j => {
                        if (!j.invoice) return false;
                        const status = ((j.invoice as any).status || '').toLowerCase();
                        return status !== 'void' && status !== 'draft' && status !== 'cancelled';
                    });

                    if (rawInvoiceJobs.length === 0) {
                        continue;
                    }

                    // Deduplicate jobs with identical invoice IDs (keep Paid or newest record)
                    const seenInvoices = new Map<string, any>();
                    const validInvoiceJobs: any[] = [];

                    rawInvoiceJobs.forEach(j => {
                        const invId = j.invoice?.id ? String(j.invoice.id).trim().toUpperCase() : null;
                        if (!invId) {
                            validInvoiceJobs.push(j);
                            return;
                        }
                        if (seenInvoices.has(invId)) {
                            const existing = seenInvoices.get(invId);
                            const existingPaid = (existing.invoice as any)?.status === 'Paid';
                            const currentPaid = (j.invoice as any)?.status === 'Paid';

                            if (currentPaid && !existingPaid) {
                                const idx = validInvoiceJobs.indexOf(existing);
                                if (idx !== -1) validInvoiceJobs[idx] = j;
                                seenInvoices.set(invId, j);
                            } else if (!currentPaid && existingPaid) {
                                return;
                            } else {
                                const timeExisting = new Date(existing.updatedAt || existing.createdAt || 0).getTime();
                                const timeCurrent = new Date(j.updatedAt || j.createdAt || 0).getTime();
                                if (timeCurrent > timeExisting) {
                                    const idx = validInvoiceJobs.indexOf(existing);
                                    if (idx !== -1) validInvoiceJobs[idx] = j;
                                    seenInvoices.set(invId, j);
                                }
                            }
                        } else {
                            seenInvoices.set(invId, j);
                            validInvoiceJobs.push(j);
                        }
                    });

                    // Build rolledInMap for linked/incorporated diagnostic jobs
                    const rolledInMap = new Map<string, { targetJobId: string; targetInvoiceId: string; targetAmount: number }>();
                    validInvoiceJobs.forEach(j => {
                        if (!j.linkedJobIds?.length && !j.parentJobId) return;

                        const linked = validInvoiceJobs.filter(o => 
                            o.id !== j.id && 
                            (o.parentJobId === j.id || j.parentJobId === o.id || (j.linkedJobIds || []).includes(o.id) || (o.linkedJobIds || []).includes(j.id))
                        );

                        linked.forEach(other => {
                            const otherInv = other.invoice as any;
                            if (!otherInv || !otherInv.items) return;

                            const currentInvId = (j.invoice?.id || j.id).toLowerCase();
                            const cleanInvId = currentInvId.replace(/^inv-/i, '');
                            const currentJobIdShort = j.id.replace(/^job-inv-/i, '').replace(/^job-/i, '');

                            const incorporatesThisJob = (otherInv.items || []).some((item: any) => {
                                const str = ((item.name || '') + ' ' + (item.description || '')).toLowerCase();
                                return str.includes('diagnostic') || str.includes('service call') || str.includes(cleanInvId) || str.includes(currentJobIdShort);
                            });

                            const isOtherNewer = new Date(other.createdAt || 0).getTime() > new Date(j.createdAt || 0).getTime();
                            if (isOtherNewer && (incorporatesThisJob || other.parentJobId === j.id)) {
                                rolledInMap.set(j.id, {
                                    targetJobId: other.id,
                                    targetInvoiceId: otherInv.id || `INV-${other.id.slice(-6).toUpperCase()}`,
                                    targetAmount: Number(otherInv.totalAmount) || Number(otherInv.amount) || 0
                                });
                            }
                        });
                    });

                    // Sort chronologically oldest first
                    const sorted = [...validInvoiceJobs].sort((a, b) => {
                        const dateA = new Date(a.appointmentTime || a.createdAt || 0).getTime();
                        const dateB = new Date(b.appointmentTime || b.createdAt || 0).getTime();
                        return dateA - dateB;
                    });

                    // Compute ledger running balances
                    let totalBilled = 0;
                    let totalPaid = 0;
                    const agingNow = new Date();
                    agingNow.setHours(0, 0, 0, 0);

                    const aging = {
                        current: 0,
                        days30: 0,
                        days60: 0,
                        days90: 0,
                        older: 0
                    };

                    let runningBalance = 0;
                    const mapped = sorted.map(j => {
                        const inv = j.invoice;
                        const rolledInfo = rolledInMap.get(j.id);
                        const rawTotal = inv.totalAmount || inv.amount || 0;
                        const total = rolledInfo ? 0 : rawTotal;
                        const paid = inv.status === 'Failed' ? 0 : (inv.amountPaid || (inv.status === 'Paid' ? total : 0));
                        const balance = Math.max(0, total - paid);
                        
                        totalBilled += total;
                        totalPaid += paid;
                        runningBalance += (total - paid);

                        if (inv.status !== 'Paid' && !rolledInfo) {
                            const dateVal = inv.dueDate || j.appointmentTime || j.createdAt;
                            if (dateVal) {
                                let dateObj = new Date(dateVal);
                                if (typeof dateVal === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateVal)) {
                                    dateObj = new Date(dateVal.replace(/-/g, '/'));
                                }
                                dateObj.setHours(0, 0, 0, 0);

                                const daysOverdue = Math.floor((agingNow.getTime() - dateObj.getTime()) / (1000 * 60 * 60 * 24));
                                if (daysOverdue <= 0) aging.current += balance;
                                else if (daysOverdue <= 30) aging.days30 += balance;
                                else if (daysOverdue <= 60) aging.days60 += balance;
                                else if (daysOverdue <= 90) aging.days90 += balance;
                                else aging.older += balance;
                            } else {
                                aging.current += balance;
                            }
                        }

                        return {
                            job: j,
                            invoice: inv,
                            total,
                            paid,
                            balance,
                            runningBalance
                        };
                    });

                    const totalDue = Math.max(0, totalBilled - totalPaid);

                    // Skip if customer has no outstanding balance
                    if (totalDue <= 0.01) {
                        continue;
                    }

                    // Build Statement PDF/HTML containing only unpaid (open) invoices
                    const statementJobs = mapped.filter(tx => tx.balance > 0.01 && tx.invoice?.status !== 'Paid');
                    if (statementJobs.length === 0) {
                        continue;
                    }

                    const dates = statementJobs.map(tx => new Date(tx.job.appointmentTime || tx.job.createdAt || 0).getTime());
                    const minDate = dates.length > 0 ? new Date(Math.min(...dates)).toLocaleDateString('en-US') : 'N/A';
                    const maxDate = dates.length > 0 ? new Date(Math.max(...dates)).toLocaleDateString('en-US') : 'N/A';
                    const statementPeriod = `${minDate} - ${maxDate}`;
                    const statementNumber = `SOA-${customer.id.slice(0, 8).toUpperCase()}-${Date.now().toString().slice(-6)}`;

                    const invoiceRows = statementJobs.map((tx, idx) => {
                        const j = tx.job;
                        const inv = tx.invoice;
                        const t = tx.total;
                        const p = tx.paid;
                        const d = tx.balance;
                        const rb = tx.runningBalance;
                        const addressStr = typeof j.address === 'string' ? j.address : `${j.address?.street || ''}, ${j.address?.city || ''}`;
                        const zebraColor = idx % 2 === 0 ? '#f8fafc' : '#ffffff';
                        const statusStyle = inv.status === 'Paid' 
                            ? 'color: #15803d; background-color: #f0fdf4; border: 1px solid #bbf7d0;' 
                            : 'color: #b91c1c; background-color: #fef2f2; border: 1px solid #fecaca;';

                        return `
                            <tr style="background-color: ${zebraColor};">
                                <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; font-size: 11px;">${new Date(j.appointmentTime || j.createdAt || '').toLocaleDateString('en-US')}</td>
                                <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; font-size: 11px; font-weight: bold;">#${inv.id || j.id.slice(0, 8)}</td>
                                <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; font-size: 11px;">
                                    <strong>${j.locationName || j.customerName || 'Main Address'}</strong><br/>
                                    <span style="font-size: 10px; color: #64748b;">${addressStr}</span>
                                </td>
                                <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; font-size: 11px; font-family: monospace;">${j.poNumber || '—'}</td>
                                <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; font-size: 11px; text-align: right;">${t.toFixed(2)}</td>
                                <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; font-size: 11px; text-align: right;">${p.toFixed(2)}</td>
                                <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; font-size: 11px; text-align: right; font-weight: bold; color: ${d > 0.01 ? '#dc2626' : '#1e293b'};">${d.toFixed(2)}</td>
                                <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; font-size: 11px; text-align: right; font-weight: bold;">${rb.toFixed(2)}</td>
                                <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; font-size: 11px; text-align: center;">
                                    <span style="display: inline-block; font-size: 9px; font-weight: 700; text-transform: uppercase; padding: 1px 4px; border-radius: 3px; ${statusStyle}">
                                        ${inv.status || 'Unpaid'}
                                    </span>
                                </td>
                            </tr>
                        `;
                    }).join('');

                    const mailPayload = {
                        organizationId: orgId,
                        to: [emailTarget.trim().toLowerCase()],
                        message: {
                            subject: `Statement of Account: ${customer.name}`,
                            html: `
                                <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 750px; margin: auto; padding: 30px; border: 1px solid #e2e8f0; color: #1e293b; font-size: 12px; line-height: 1.5; background-color: #ffffff;">
                                    
                                    <!-- Header Section -->
                                    <table style="width: 100%; border-collapse: collapse; margin-bottom: 25px;">
                                        <tr>
                                            <td>
                                                <h2 style="font-size: 22px; font-weight: 800; color: #123A63; text-transform: uppercase; margin: 0; letter-spacing: -0.5px;">Statement of Account</h2>
                                                <p style="margin: 5px 0 0; font-size: 11px; color: #64748b;">Statement Date: ${new Date().toLocaleDateString('en-US')} | Statement #: ${statementNumber}</p>
                                            </td>
                                            <td style="font-size: 11px; color: #475569; text-align: right; line-height: 1.4; vertical-align: top;">
                                                <strong style="font-size: 12px; color: #1e293b;">${orgName}</strong><br/>
                                                ${orgAddress}<br/>
                                                Phone: ${orgPhone}
                                            </td>
                                        </tr>
                                    </table>
                                    
                                    <div style="border-bottom: 2px solid #123A63; margin-bottom: 20px;"></div>

                                    <!-- Customer & Terms -->
                                    <table style="width: 100%; border-collapse: collapse; margin-bottom: 25px;">
                                        <tr>
                                            <td style="width: 50%; vertical-align: top; padding-right: 15px;">
                                                <div style="font-size: 9px; font-weight: 700; color: #123A63; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #e2e8f0; padding-bottom: 3px; margin-bottom: 6px;">Client Information</div>
                                                <p style="margin: 2px 0;"><strong>${customer.name}</strong></p>
                                                <p style="margin: 2px 0; color: #334155;">${customer.address || ''}</p>
                                            </td>
                                            <td style="width: 50%; vertical-align: top; padding-left: 15px;">
                                                <div style="font-size: 9px; font-weight: 700; color: #123A63; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #e2e8f0; padding-bottom: 3px; margin-bottom: 6px;">Account Summary & Terms</div>
                                                <p style="margin: 2px 0; color: #334155;">Client Code: <strong>${customer.id.slice(0, 8).toUpperCase()}</strong></p>
                                                <p style="margin: 2px 0; color: #334155;">Account Number: <strong>${customer.id.replace(/\D/g, '')}</strong></p>
                                                <p style="margin: 2px 0; color: #334155;">Payment Terms: <strong>${customer.paymentTerms || 'Net 30'}</strong></p>
                                                <p style="margin: 2px 0; color: #334155;">Statement Period: <strong>${statementPeriod}</strong></p>
                                            </td>
                                        </tr>
                                    </table>

                                    <p style="color: #334155; margin-bottom: 20px;">Dear Finance Team,</p>
                                    <p style="color: #334155; margin-bottom: 25px;">Please find below the corporate Statement of Account for <strong>${customer.name}</strong> summarizing all recent service invoices, payments, and outstanding balances.</p>

                                    <!-- Financial Summary -->
                                    <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px; border: 1px solid #cbd5e1;">
                                        <tr>
                                            <th style="background-color: #123A63; color: #ffffff; font-weight: 700; font-size: 9px; text-transform: uppercase; text-align: center; padding: 6px; border: 1px solid #123A63;">Previous Balance</th>
                                            <th style="background-color: #123A63; color: #ffffff; font-weight: 700; font-size: 9px; text-transform: uppercase; text-align: center; padding: 6px; border: 1px solid #123A63;">New Charges</th>
                                            <th style="background-color: #123A63; color: #ffffff; font-weight: 700; font-size: 9px; text-transform: uppercase; text-align: center; padding: 6px; border: 1px solid #123A63;">Payments Received</th>
                                            <th style="background-color: #123A63; color: #ffffff; font-weight: 700; font-size: 9px; text-transform: uppercase; text-align: center; padding: 6px; border: 1px solid #123A63;">Adjustments</th>
                                            <th style="background-color: #0f2d50; color: #ffffff; font-weight: 700; font-size: 9px; text-transform: uppercase; text-align: center; padding: 6px; border: 1px solid #0f2d50;">Amount Due</th>
                                        </tr>
                                        <tr>
                                            <td style="padding: 10px; text-align: center; font-size: 13px; font-weight: 700; border: 1px solid #cbd5e1; background-color: #f8fafc;">$0.00</td>
                                            <td style="padding: 10px; text-align: center; font-size: 13px; font-weight: 700; border: 1px solid #cbd5e1; background-color: #f8fafc;">$${totalBilled.toFixed(2)}</td>
                                            <td style="padding: 10px; text-align: center; font-size: 13px; font-weight: 700; border: 1px solid #cbd5e1; background-color: #f8fafc; color: #16a34a;">$${totalPaid.toFixed(2)}</td>
                                            <td style="padding: 10px; text-align: center; font-size: 13px; font-weight: 700; border: 1px solid #cbd5e1; background-color: #f8fafc;">$0.00</td>
                                            <td style="padding: 10px; text-align: center; font-size: 14px; font-weight: 700; border: 1px solid #cbd5e1; background-color: #f1f5f9; color: #dc2626;">$${totalDue.toFixed(2)}</td>
                                        </tr>
                                    </table>

                                    <!-- Transaction Ledger -->
                                    <table style="width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 25px;">
                                        <thead>
                                            <tr style="background-color: #123A63;">
                                                <th style="color: #ffffff; padding: 8px; text-align: left; font-weight: bold; text-transform: uppercase; border-bottom: 2px solid #0f2d50;">Date</th>
                                                <th style="color: #ffffff; padding: 8px; text-align: left; font-weight: bold; text-transform: uppercase; border-bottom: 2px solid #0f2d50;">Invoice #</th>
                                                <th style="color: #ffffff; padding: 8px; text-align: left; font-weight: bold; text-transform: uppercase; border-bottom: 2px solid #0f2d50;">Property / Location</th>
                                                <th style="color: #ffffff; padding: 8px; text-align: left; font-weight: bold; text-transform: uppercase; border-bottom: 2px solid #0f2d50;">Ref / PO #</th>
                                                <th style="color: #ffffff; padding: 8px; text-align: right; font-weight: bold; text-transform: uppercase; border-bottom: 2px solid #0f2d50;">Debit (Dr)</th>
                                                <th style="color: #ffffff; padding: 8px; text-align: right; font-weight: bold; text-transform: uppercase; border-bottom: 2px solid #0f2d50;">Credit (Cr)</th>
                                                <th style="color: #ffffff; padding: 8px; text-align: right; font-weight: bold; text-transform: uppercase; border-bottom: 2px solid #0f2d50;">Balance</th>
                                                <th style="color: #ffffff; padding: 8px; text-align: right; font-weight: bold; text-transform: uppercase; border-bottom: 2px solid #0f2d50;">Running Bal</th>
                                                <th style="color: #ffffff; padding: 8px; text-align: center; font-weight: bold; text-transform: uppercase; border-bottom: 2px solid #0f2d50;">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            ${invoiceRows}
                                        </tbody>
                                    </table>

                                    <!-- Aging Summary -->
                                    <div style="font-size: 9px; font-weight: 700; color: #123A63; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px;">Aging Analysis (Unpaid Balances)</div>
                                    <table style="width: 100%; border-collapse: collapse; border: 1px solid #cbd5e1; margin-bottom: 35px;">
                                        <tr>
                                            <th style="background-color: #f1f5f9; color: #475569; font-weight: bold; font-size: 8px; text-transform: uppercase; text-align: center; padding: 5px; border: 1px solid #cbd5e1;">Current</th>
                                            <th style="background-color: #f1f5f9; color: #475569; font-weight: bold; font-size: 8px; text-transform: uppercase; text-align: center; padding: 5px; border: 1px solid #cbd5e1;">1 - 30 Days</th>
                                            <th style="background-color: #f1f5f9; color: #475569; font-weight: bold; font-size: 8px; text-transform: uppercase; text-align: center; padding: 5px; border: 1px solid #cbd5e1;">31 - 60 Days</th>
                                            <th style="background-color: #f1f5f9; color: #475569; font-weight: bold; font-size: 8px; text-transform: uppercase; text-align: center; padding: 5px; border: 1px solid #cbd5e1;">61 - 90 Days</th>
                                            <th style="background-color: #f1f5f9; color: #475569; font-weight: bold; font-size: 8px; text-transform: uppercase; text-align: center; padding: 5px; border: 1px solid #cbd5e1;">90+ Days</th>
                                            <th style="background-color: #123A63; color: #ffffff; font-weight: bold; font-size: 8px; text-transform: uppercase; text-align: center; padding: 5px; border: 1px solid #cbd5e1;">Total Outstanding</th>
                                        </tr>
                                        <tr>
                                            <td style="padding: 8px; text-align: center; font-size: 11px; font-weight: bold; border: 1px solid #cbd5e1;">$${aging.current.toFixed(2)}</td>
                                            <td style="padding: 8px; text-align: center; font-size: 11px; font-weight: bold; border: 1px solid #cbd5e1; color: ${aging.days30 > 0 ? '#b45309' : '#1e293b'};">$${aging.days30.toFixed(2)}</td>
                                            <td style="padding: 8px; text-align: center; font-size: 11px; font-weight: bold; border: 1px solid #cbd5e1; color: ${aging.days60 > 0 ? '#b45309' : '#1e293b'};">$${aging.days60.toFixed(2)}</td>
                                            <td style="padding: 8px; text-align: center; font-size: 11px; font-weight: bold; border: 1px solid #cbd5e1; color: ${aging.days90 > 0 ? '#dc2626' : '#1e293b'};">$${aging.days90.toFixed(2)}</td>
                                            <td style="padding: 8px; text-align: center; font-size: 11px; font-weight: bold; border: 1px solid #cbd5e1; color: ${aging.older > 0 ? '#dc2626' : '#1e293b'};">$${aging.older.toFixed(2)}</td>
                                            <td style="padding: 8px; text-align: center; font-size: 11px; font-weight: bold; border: 1px solid #cbd5e1; background-color: #f8fafc; color: #dc2626;">$${totalDue.toFixed(2)}</td>
                                        </tr>
                                    </table>

                                    <div style="border-top: 1px solid #e2e8f0; padding-top: 15px; font-size: 10px; color: #64748b;">
                                        <strong>Corporate Remittance Instructions:</strong><br/>
                                        Please remit check payments payable to <strong>${orgName}</strong> or contact billing at <strong>${orgEmail}</strong> for ACH bank wiring details. Reference the statement number on your remittance advice.<br/>
                                        <span style="font-size: 8px; color: #94a3b8; display: block; margin-top: 10px;">CONFIDENTIALITY DISCLAIMER: This email and any attachments contain confidential proprietary financial information intended solely for the customer named above.</span>
                                    </div>
                                </div>
                            `,
                            text: `Statement of Account for ${customer.name}. Outstanding Balance: $${totalDue.toFixed(2)}.`,
                            replyTo: orgEmail
                        },
                        type: 'Statement'
                    };

                    await db.collection('mail_queue').add(mailPayload);
                    functions.logger.info(`Queued Statement of Account email for customer: ${customer.name} (due: $${totalDue.toFixed(2)})`);
                }
            }
        } catch (error) {
            functions.logger.error("Error running sendMonthlyCommercialStatements scheduled function:", error);
        }
    });


/**
 * Daily End-Of-Day Auto-Checkout & Job Completion Scheduled Cloud Function for TekAir
 * Runs daily at 20:00 (8:00 PM CST) in America/Chicago timezone.
 * Checks open jobs for TekAir (org-1765817997819), inspects technician presence (files, geofence, notes),
 * logs missing in/out times, marks jobs as Completed, and emails operations@tekairinc.com.
 */
export const tekAirEndOfDayAutoCheckoutCron = functions.pubsub.schedule('0 20 * * *')
    .timeZone('America/Chicago')
    .onRun(async () => {
        functions.logger.info('[tekAirEndOfDayAutoCheckoutCron] Function disabled per user request. No automated job status changes performed.');
        return null;
    });

/**
 * Quarterly PCI ASV Scan Reminder Cloud Function for TekAir Inc.
 * Runs quarterly on the 1st of February, May, August, and November at 9:00 AM CST.
 * Sends an automated reminder email to TekAir operations & management to verify their quarterly ASV scan status for tekairinc.com.
 */
export const tekAirQuarterlyPciScanCron = functions.pubsub.schedule('0 9 1 2,5,8,11 *')
    .timeZone('America/Chicago')
    .onRun(async () => {
        try {
            const recipientEmails = ['rvavrecan@tekairinc.com', 'roderick@tekairinc.com', 'operations@tekairinc.com'];
            functions.logger.info('[tekAirQuarterlyPciScanCron] Sending quarterly PCI ASV scan reminder to TekAir.');

            const emailHtml = `
                <div style="font-family: Arial, sans-serif; color: #1e293b; max-width: 650px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; padding: 24px; background-color: #ffffff;">
                    <div style="text-align: center; border-bottom: 2px solid #0ea5e9; padding-bottom: 16px; margin-bottom: 20px;">
                        <h2 style="color: #0369a1; margin: 0;">TekAir PCI DSS Quarterly ASV Scan Reminder</h2>
                        <p style="color: #64748b; margin-top: 6px;">Automated Quarterly Compliance Notification</p>
                    </div>
                    <p>Hello TekAir Team,</p>
                    <p>This is your automated quarterly reminder to verify and ensure PCI DSS compliance for TekAir Inc.</p>
                    <div style="background-color: #f0f9ff; border-left: 4px solid #0ea5e9; padding: 16px; margin: 20px 0; border-radius: 4px;">
                        <h3 style="margin: 0 0 8px 0; color: #0284c7; font-size: 16px;">Required Action Item:</h3>
                        <ul style="margin: 0; padding-left: 20px; color: #334155; line-height: 1.6;">
                            <li>Log in to your PCI Merchant Compliance Portal (SecurityMetrics / Merchant Provider).</li>
                            <li>Confirm that the quarterly ASV vulnerability scan for <strong>tekairinc.com</strong> is completed and showing a <strong>Passing / Compliant</strong> status.</li>
                            <li>If auto-scheduling is enabled, verify the passing report has been submitted to your payment acquirer.</li>
                        </ul>
                    </div>
                    <p style="font-size: 13px; color: #64748b; line-height: 1.5;">
                        <em>Note: Card processing inside TekTrakker is tokenized via Kort Payments (Tilled) hosted iFrames under SAQ A. Maintaining your quarterly ASV scan verification ensures ongoing merchant compliance.</em>
                    </p>
                </div>
            `;

            await db.collection('mail').add({
                to: recipientEmails,
                message: {
                    subject: 'Action Required: TekAir Quarterly PCI DSS ASV Scan Verification',
                    html: emailHtml
                },
                createdAt: new Date().toISOString()
            });

            functions.logger.info(`[tekAirQuarterlyPciScanCron] Successfully queued PCI reminder email to ${recipientEmails.join(', ')}`);
            return null;
        } catch (error) {
            functions.logger.error('[tekAirQuarterlyPciScanCron] Error executing PCI scan reminder function:', error);
            return null;
        }
    });

// --- SUBCONTRACTOR PAYOUT SYNC CRON ---
export const syncSubcontractorPayouts = functions.pubsub.schedule('0 23 * * *')
    .timeZone('America/New_York')
    .onRun(async () => {
        try {
            const orgsSnap = await db.collection('organizations').where('status', '==', 'active').get();
            let totalPayoutsProcessed = 0;

            for (const org of orgsSnap.docs) {
                const orgId = org.id;

                // Query for completed jobs needing flat-rate payouts
                const jobsSnap = await db.collection('jobs')
                    .where('organizationId', '==', orgId)
                    .where('jobStatus', '==', 'Completed')
                    .where('payoutStatus', '==', 'pending')
                    .get();

                if (jobsSnap.empty) continue;

                for (const jobDoc of jobsSnap.docs) {
                    const job = jobDoc.data();

                    if (job.assignedTechnicianId && job.subcontractorFlatRate) {
                        const techDoc = await db.collection('users').doc(job.assignedTechnicianId).get();
                        if (techDoc.exists && techDoc.data()?.role === 'Subcontractor') {
                            // Natively route flat-rate splits to external partners
                            const payoutRef = db.collection('payouts').doc();
                            await payoutRef.set({
                                id: payoutRef.id,
                                organizationId: orgId,
                                subcontractorId: techDoc.id,
                                jobId: job.id,
                                amount: job.subcontractorFlatRate,
                                status: 'processing',
                                initiatedAt: new Date().toISOString()
                            });

                            await jobDoc.ref.update({
                                payoutStatus: 'processing',
                                payoutId: payoutRef.id
                            });

                            totalPayoutsProcessed++;
                        }
                    }
                }
            }
            functions.logger.info(`Successfully processed ${totalPayoutsProcessed} subcontractor payout splits natively.`);
        } catch (e) {
            functions.logger.error("Global Subcontractor Payout Sync Failed:", e);
        }
    });

// --- YEAR-END 1099 FILING DEADLINE & COMPLIANCE REMINDERS ---
export const checkYearEnd1099FilingDeadlines = functions.pubsub.schedule('0 9 * * *')
    .timeZone('America/New_York')
    .onRun(async () => {
        try {
            const now = new Date();
            const month = now.getMonth(); // 0 = Jan, 11 = Dec
            const date = now.getDate();

            // Active filing season: December (prep alerts) and January (critical filing deadlines)
            const isFilingSeason = month === 11 || month === 0;
            if (!isFilingSeason) return;

            const taxYear = month === 11 ? now.getFullYear() : now.getFullYear() - 1;
            const isMilestoneDate = 
                (month === 11 && (date === 15 || date === 31)) || 
                (month === 0 && (date === 10 || date === 20 || date >= 25));

            if (!isMilestoneDate) return;

            const orgsSnap = await db.collection('organizations').where('status', '==', 'active').get();
            const promises: Promise<any>[] = [];

            for (const orgDoc of orgsSnap.docs) {
                const orgId = orgDoc.id;
                const orgData = orgDoc.data();
                const orgName = orgData.name || 'TekAir Inc.';

                // Query all paid Subcontractor Labor expenses for this tax year
                const expensesSnap = await db.collection('expenses')
                    .where('organizationId', '==', orgId)
                    .where('category', '==', 'Subcontractor Labor')
                    .where('status', '==', 'Paid')
                    .get();

                if (expensesSnap.empty) continue;

                // Aggregate payouts by subcontractor
                const subTotals: { [key: string]: { name: string; total: number; count: number } } = {};
                for (const doc of expensesSnap.docs) {
                    const e = doc.data();
                    const expDate = e.date ? String(e.date) : '';
                    const expYear = expDate ? new Date(expDate).getFullYear() : null;
                    if (expYear !== taxYear) continue;

                    const key = e.subcontractorId || e.vendor || 'Unknown Partner';
                    const amount = Number(e.amount) || 0;
                    if (!subTotals[key]) {
                        subTotals[key] = { name: e.vendor || 'Subcontractor Partner', total: 0, count: 0 };
                    }
                    subTotals[key].total += amount;
                    subTotals[key].count += 1;
                }

                // Filter subcontractors meeting or exceeding IRS $600 threshold
                const eligibleSubs = Object.values(subTotals).filter(s => s.total >= 600);
                if (eligibleSubs.length === 0) continue;

                const total1099Amount = eligibleSubs.reduce((sum, s) => sum + s.total, 0);

                // Fetch admins to notify
                const adminsSnap = await db.collection('users')
                    .where('organizationId', '==', orgId)
                    .where('role', 'in', ['admin', 'master_admin', 'both'])
                    .get();

                const deadlineText = month === 0 
                    ? `Action Required: IRS Form 1099-NEC statutory filing and furnishing deadline is January 31, ${now.getFullYear()}.`
                    : `Year-End Tax Preparation: Review and verify subcontractor 1099-NEC reports before the January 31 deadline.`;

                const subject = `IRS Form 1099-NEC Filing Reminder (${taxYear}) - ${orgName}`;

                for (const adminDoc of adminsSnap.docs) {
                    const adminId = adminDoc.id;
                    const adminData = adminDoc.data();

                    // 1. Root notifications collection
                    promises.push(db.collection('notifications').add({
                        userId: adminId,
                        organizationId: orgId,
                        title: subject,
                        body: `${eligibleSubs.length} subcontractor(s) reached the IRS $600+ threshold for ${taxYear} ($${total1099Amount.toFixed(2)} total). ${deadlineText}`,
                        message: `${eligibleSubs.length} subcontractor(s) reached the IRS $600+ threshold for ${taxYear} ($${total1099Amount.toFixed(2)} total). ${deadlineText}`,
                        type: '1099_year_end_reminder',
                        link: '/admin/workforce?tab=subcontractors',
                        read: false,
                        createdAt: new Date().toISOString()
                    }));

                    // 2. User subcollection notifications
                    promises.push(db.collection('users').doc(adminId).collection('notifications').add({
                        title: subject,
                        message: `${eligibleSubs.length} subcontractor(s) have reached the IRS $600+ threshold for ${taxYear} (Total: $${total1099Amount.toFixed(2)}). Ensure forms are dispatched by January 31.`,
                        type: '1099_year_end_reminder',
                        link: '/admin/workforce?tab=subcontractors',
                        read: false,
                        createdAt: new Date().toISOString()
                    }));

                    // 3. Email Notification via mail queue
                    if (adminData.email) {
                        const emailHtml = `
                            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1e293b; line-height: 1.6;">
                                <div style="background-color: #0f172a; color: #ffffff; padding: 20px; border-radius: 8px 8px 0 0;">
                                    <h2 style="margin: 0; font-size: 18px;">IRS Form 1099-NEC Annual Filing Reminder</h2>
                                    <p style="margin: 4px 0 0 0; font-size: 12px; color: #94a3b8;">Tax Year ${taxYear} • ${orgName}</p>
                                </div>
                                <div style="padding: 24px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 8px 8px; background-color: #ffffff;">
                                    <p>Hello <strong>${adminData.firstName || 'Administrator'}</strong>,</p>
                                    <p>${deadlineText}</p>
                                    
                                    <div style="background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; padding: 16px; margin: 16px 0;">
                                        <p style="margin: 0 0 8px 0; font-size: 13px;"><strong>1099-NEC Eligible Subcontractors (≥ $600):</strong></p>
                                        <table style="width: 100%; font-size: 12px; border-collapse: collapse;">
                                            <thead>
                                                <tr style="background-color: #f1f5f9; text-align: left;">
                                                    <th style="padding: 6px 8px;">Subcontractor</th>
                                                    <th style="padding: 6px 8px; text-align: right;">YTD Paid</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                ${eligibleSubs.map(s => `
                                                    <tr style="border-bottom: 1px solid #f1f5f9;">
                                                        <td style="padding: 6px 8px; font-weight: 600;">${s.name}</td>
                                                        <td style="padding: 6px 8px; text-align: right; font-family: monospace; font-weight: 700; color: #047857;">$${s.total.toFixed(2)}</td>
                                                    </tr>
                                                `).join('')}
                                            </tbody>
                                            <tfoot>
                                                <tr style="background-color: #f1f5f9; font-weight: 800;">
                                                    <td style="padding: 6px 8px;">Total 1099 Volume:</td>
                                                    <td style="padding: 6px 8px; text-align: right; font-family: monospace; color: #047857;">$${total1099Amount.toFixed(2)}</td>
                                                </tr>
                                            </tfoot>
                                        </table>
                                    </div>

                                    <div style="margin: 20px 0;">
                                        <a href="https://tektrakker.web.app/#/admin/workforce?tab=subcontractors" style="background-color: #4f46e5; color: #ffffff; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: 700; font-size: 13px; display: inline-block;">
                                            Open 1099 Filing Center in TekTrakker
                                        </a>
                                    </div>
                                    <p style="font-size: 11px; color: #94a3b8; margin: 0;">
                                        All Forms 1099-NEC can be generated, printed, and emailed directly from the Subcontractors workforce tab.
                                    </p>
                                </div>
                            </div>
                        `;

                        promises.push(db.collection('mail_queue').add({
                            organizationId: orgId,
                            to: adminData.email,
                            message: { subject, html: emailHtml },
                            createdAt: new Date().toISOString()
                        }));
                    }
                }
            }

            await Promise.all(promises);
            functions.logger.info(`Successfully ran checkYearEnd1099FilingDeadlines cron.`);
        } catch (e) {
            functions.logger.error("Year-End 1099 Filing Cron Failed:", e);
        }
    });
