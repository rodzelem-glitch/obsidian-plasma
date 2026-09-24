import { db } from './firebase';
import { sendEmail } from './mailService';

export interface AutoCheckoutResult {
    updatedJobsCount: number;
    completedJobsCount: number;
    details: Array<{
        jobId: string;
        customerName: string;
        address: string;
        checkInTime: string;
        checkOutTime: string;
        timeOnSiteMinutes: number;
        statusChangedToCompleted: boolean;
        assignedTech: string;
    }>;
}

/**
 * Daily End-Of-Day Auto-Checkout & Job Completion Service for TekAir
 * Checks open jobs, checks tech geolocation/photo/notes activity, calculates in/out times,
 * marks jobs as completed if tech has left site, and emails operations@tekairinc.com.
 */
export const runTekAirEndOfDayAutoCheckout = async (
    targetOrgId: string = 'org-1765817997819',
    notificationEmail: string = 'operations@tekairinc.com'
): Promise<AutoCheckoutResult> => {
    const result: AutoCheckoutResult = {
        updatedJobsCount: 0,
        completedJobsCount: 0,
        details: []
    };

    try {
        console.log(`[AutoCheckoutService] Starting end-of-day check for organization: ${targetOrgId}`);

        // Fetch open jobs for the target organization
        const snapshot = await db.collection('jobs')
            .where('organizationId', '==', targetOrgId)
            .get();

        if (snapshot.empty) {
            console.log('[AutoCheckoutService] No jobs found for org.');
            return result;
        }

        const now = new Date();
        const nowIso = now.toISOString();

        for (const doc of snapshot.docs) {
            const job = { id: doc.id, ...doc.data() } as any;

            // Only inspect open jobs (Scheduled, In Progress, Needs Follow-up, etc.)
            if (job.jobStatus === 'Completed' || job.jobStatus === 'Cancelled') {
                continue;
            }

            // Gather all activity timestamps on this job (files/photos, notes, geofence, invoice)
            const timestamps: number[] = [];

            // 1. Files & photos uploaded by tech
            if (Array.isArray(job.files)) {
                job.files.forEach((f: any) => {
                    if (f.createdAt) {
                        const t = new Date(f.createdAt).getTime();
                        if (!isNaN(t)) timestamps.push(t);
                    }
                });
            }

            // 2. Geofence / location events
            if (job.geofenceEvents) {
                if (job.geofenceEvents.arrivedAt) {
                    const t = new Date(job.geofenceEvents.arrivedAt).getTime();
                    if (!isNaN(t)) timestamps.push(t);
                }
                if (job.geofenceEvents.departedAt) {
                    const t = new Date(job.geofenceEvents.departedAt).getTime();
                    if (!isNaN(t)) timestamps.push(t);
                }
            }

            // 3. Existing checkIn / checkOut / timeEntries
            if (job.checkInTime) {
                const t = new Date(job.checkInTime).getTime();
                if (!isNaN(t)) timestamps.push(t);
            }
            if (job.checkOutTime) {
                const t = new Date(job.checkOutTime).getTime();
                if (!isNaN(t)) timestamps.push(t);
            }
            if (Array.isArray(job.timeEntries)) {
                job.timeEntries.forEach((e: any) => {
                    if (e.checkInTime) {
                        const t = new Date(e.checkInTime).getTime();
                        if (!isNaN(t)) timestamps.push(t);
                    }
                    if (e.checkOutTime) {
                        const t = new Date(e.checkOutTime).getTime();
                        if (!isNaN(t)) timestamps.push(t);
                    }
                });
            }

            // 4. Job update timestamp or notes present
            if (job.updatedAt) {
                const t = new Date(job.updatedAt).getTime();
                if (!isNaN(t)) timestamps.push(t);
            }
            if (job.notes?.work || job.notes?.diagnosis || job.invoice?.date) {
                if (job.appointmentTime) {
                    const t = new Date(job.appointmentTime).getTime();
                    if (!isNaN(t)) timestamps.push(t);
                }
            }

            // If tech was physically present or work was performed
            if (timestamps.length > 0) {
                timestamps.sort((a, b) => a - b);
                const earliestMs = timestamps[0];
                const latestMs = timestamps[timestamps.length - 1];

                const checkInIso = job.checkInTime || new Date(earliestMs).toISOString();
                
                // If single activity timestamp (e.g. only 1 photo), assume minimum 45-minute visit
                let checkOutMs = latestMs;
                if (latestMs === earliestMs) {
                    checkOutMs = earliestMs + 45 * 60 * 1000;
                }
                const checkOutIso = job.checkOutTime || new Date(checkOutMs).toISOString();
                const durationMins = Math.max(15, Math.round((checkOutMs - earliestMs) / 60000));

                const needsCheckInUpdate = !job.checkInTime;
                const needsCheckOutUpdate = !job.checkOutTime;
                const needsStatusUpdate = job.jobStatus !== 'Completed';

                if (needsCheckInUpdate || needsCheckOutUpdate || needsStatusUpdate) {
                    const updatedEntries = [...(job.timeEntries || [])];
                    if (updatedEntries.length === 0 || !updatedEntries[0].checkOutTime) {
                        updatedEntries.unshift({
                            checkInTime: checkInIso,
                            checkOutTime: checkOutIso,
                            timeOnSiteMinutes: durationMins
                        });
                    }

                    const updates: any = {
                        checkInTime: checkInIso,
                        checkOutTime: checkOutIso,
                        timeOnSiteMinutes: durationMins,
                        timeEntries: updatedEntries,
                        jobStatus: 'Completed',
                        autoCompletedByEodCron: true,
                        autoCompletedAt: nowIso
                    };

                    await db.collection('jobs').doc(job.id).update(updates);

                    result.updatedJobsCount++;
                    if (needsStatusUpdate) result.completedJobsCount++;

                    result.details.push({
                        jobId: job.id,
                        customerName: job.customerName || 'Customer',
                        address: job.address || 'Site Location',
                        checkInTime: new Date(checkInIso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }),
                        checkOutTime: new Date(checkOutIso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }),
                        timeOnSiteMinutes: durationMins,
                        statusChangedToCompleted: needsStatusUpdate,
                        assignedTech: job.assignedTechnicianName || 'Technician'
                    });
                }
            }
        }

        // Send Email Notification to operations@tekairinc.com if any jobs were updated
        if (result.details.length > 0) {
            const tableRows = result.details.map(d => `
                <tr>
                    <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; font-weight: bold;">${d.jobId}</td>
                    <td style="padding: 10px; border-bottom: 1px solid #e2e8f0;">${d.customerName}</td>
                    <td style="padding: 10px; border-bottom: 1px solid #e2e8f0;">${d.address}</td>
                    <td style="padding: 10px; border-bottom: 1px solid #e2e8f0;">${d.assignedTech}</td>
                    <td style="padding: 10px; border-bottom: 1px solid #e2e8f0;">${d.checkInTime} - ${d.checkOutTime} (${d.timeOnSiteMinutes}m)</td>
                    <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; color: #16a34a; font-weight: bold;">
                        ${d.statusChangedToCompleted ? 'Marked Completed' : 'Time Entries Logged'}
                    </td>
                </tr>
            `).join('');

            const emailHtml = `
                <div style="font-family: Arial, sans-serif; color: #1e293b; max-width: 700px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; padding: 24px; background-color: #ffffff;">
                    <div style="text-align: center; border-bottom: 2px solid #3b82f6; padding-bottom: 16px; margin-bottom: 20px;">
                        <h2 style="color: #1e3a8a; margin: 0;">TekAir End-of-Day Automated Job Completion Report</h2>
                        <p style="color: #64748b; margin-top: 6px;">Daily Automated Site Activity & Check-Out Sync</p>
                    </div>

                    <p>Hi Ryan,</p>
                    <p>The daily automated end-of-day system check has completed for TekAir. The system detected technician activity/geofence data on open jobs where manual check-out was not submitted. The in/out times were recorded and the jobs were marked as <strong>Completed</strong>.</p>

                    <div style="margin: 20px 0;">
                        <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 13px;">
                            <thead>
                                <tr style="background-color: #f8fafc; color: #475569; text-transform: uppercase; font-size: 11px;">
                                    <th style="padding: 10px; border-bottom: 2px solid #cbd5e1;">Job ID</th>
                                    <th style="padding: 10px; border-bottom: 2px solid #cbd5e1;">Customer</th>
                                    <th style="padding: 10px; border-bottom: 2px solid #cbd5e1;">Address</th>
                                    <th style="padding: 10px; border-bottom: 2px solid #cbd5e1;">Tech</th>
                                    <th style="padding: 10px; border-bottom: 2px solid #cbd5e1;">Time On Site</th>
                                    <th style="padding: 10px; border-bottom: 2px solid #cbd5e1;">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${tableRows}
                            </tbody>
                        </table>
                    </div>

                    <p style="font-size: 12px; color: #64748b; margin-top: 24px;">
                        Total Jobs Updated: <strong>${result.updatedJobsCount}</strong> | Total Jobs Auto-Completed: <strong>${result.completedJobsCount}</strong>
                    </p>
                </div>
            `;

            await sendEmail({
                to: notificationEmail,
                subject: `TekAir End-of-Day Report: ${result.completedJobsCount} Open Job(s) Auto-Completed`,
                html: emailHtml,
                organizationId: targetOrgId,
                bypassOptOut: true
            });

            console.log(`[AutoCheckoutService] Sent automated end-of-day email to ${notificationEmail}`);
        } else {
            console.log('[AutoCheckoutService] No open jobs required auto-completion today.');
        }

    } catch (err) {
        console.error('[AutoCheckoutService] Error running end-of-day auto-checkout:', err);
    }

    return result;
};
