import type { Job, ShiftLog, User } from 'types';

export interface JobDiscrepancy {
    jobId: string;
    customerName: string;
    customerAddress: string;
    technicianId: string;
    technicianName: string;
    appointmentTime: string;
    reportedCheckIn: string;
    reportedCheckOut: string | null;
    shiftClockIn: string | null;
    shiftClockOut: string | null;
    discrepancyType: 'FORGOTTEN_CHECKOUT' | 'NO_MATCHING_SHIFT' | 'DURATION_MISMATCH';
    discrepancyHours: number;
    description: string;
    suggestedCheckOut: string | null;
    suggestedTimeOnSiteMinutes: number | null;
}

export function detectTimeDiscrepancies(
    jobs: Job[],
    shiftLogsMap: Record<string, ShiftLog[]> | ShiftLog[],
    users: User[]
): JobDiscrepancy[] {
    const discrepancies: JobDiscrepancy[] = [];

    const getShiftLogsForUser = (userId: string): ShiftLog[] => {
        if (Array.isArray(shiftLogsMap)) {
            return shiftLogsMap.filter(s => s.userId === userId);
        }
        return shiftLogsMap[userId] || [];
    };

    const userMap = new Map<string, User>();
    users.forEach(u => userMap.set(u.id, u));

    jobs.forEach(job => {
        if (!job.checkInTime || job.deleted || job.archived) return;

        const techId = job.assignedTechnicianId;
        if (!techId) return;

        const techUser = userMap.get(techId);
        const techName = job.assignedTechnicianName || (techUser ? `${techUser.firstName || ''} ${techUser.lastName || ''}`.trim() : 'Technician');

        const jobInMs = new Date(job.checkInTime).getTime();
        const jobOutMs = job.checkOutTime ? new Date(job.checkOutTime).getTime() : null;

        const userShifts = getShiftLogsForUser(techId);
        
        // Find shift matching the checkIn date or within 24 hours of job checkIn
        const matchingShift = userShifts.find(shift => {
            const shiftInMs = new Date(shift.clockIn).getTime();
            const shiftOutMs = shift.clockOut ? new Date(shift.clockOut).getTime() : Date.now();
            return jobInMs >= (shiftInMs - 3600000) && jobInMs <= (shiftOutMs + 3600000);
        });

        const addressStr = typeof job.address === 'string'
            ? job.address
            : (job.address ? `${(job.address as any).street || ''}, ${(job.address as any).city || ''}` : '');

        if (!matchingShift) {
            discrepancies.push({
                jobId: job.id,
                customerName: job.customerName || 'Customer',
                customerAddress: addressStr,
                technicianId: techId,
                technicianName: techName,
                appointmentTime: job.appointmentTime,
                reportedCheckIn: job.checkInTime,
                reportedCheckOut: job.checkOutTime || null,
                shiftClockIn: null,
                shiftClockOut: null,
                discrepancyType: 'NO_MATCHING_SHIFT',
                discrepancyHours: jobOutMs ? Number(((jobOutMs - jobInMs) / 3600000).toFixed(1)) : 0,
                description: 'Job checked in without an active clocked-in technician shift.',
                suggestedCheckOut: job.checkOutTime || null,
                suggestedTimeOnSiteMinutes: job.timeOnSiteMinutes || null
            });
            return;
        }

        const shiftOutMs = matchingShift.clockOut ? new Date(matchingShift.clockOut).getTime() : null;

        // Case 1: FORGOTTEN CHECKOUT (Job checkout occurs > 2 hrs after shift ended, or job is still checked in while shift has ended)
        if (shiftOutMs && (
            !jobOutMs || 
            (jobOutMs > (shiftOutMs + 2 * 3600000))
        )) {
            const calculatedDurationMs = shiftOutMs - jobInMs;
            const suggestedDurationMins = Math.max(15, Math.round(calculatedDurationMs / 60000));
            const extraHours = jobOutMs 
                ? ((jobOutMs - shiftOutMs) / 3600000) 
                : ((Date.now() - shiftOutMs) / 3600000);

            discrepancies.push({
                jobId: job.id,
                customerName: job.customerName || 'Customer',
                customerAddress: addressStr,
                technicianId: techId,
                technicianName: techName,
                appointmentTime: job.appointmentTime,
                reportedCheckIn: job.checkInTime,
                reportedCheckOut: job.checkOutTime || null,
                shiftClockIn: matchingShift.clockIn,
                shiftClockOut: matchingShift.clockOut || null,
                discrepancyType: 'FORGOTTEN_CHECKOUT',
                discrepancyHours: Number(extraHours.toFixed(1)),
                description: `Job check-out delayed by ${extraHours.toFixed(1)} hours past technician's physical shift clock-out.`,
                suggestedCheckOut: matchingShift.clockOut || null,
                suggestedTimeOnSiteMinutes: suggestedDurationMins
            });
        }
        // Case 2: DURATION MISMATCH
        else if (jobOutMs && shiftOutMs) {
            const jobDurationHrs = (jobOutMs - jobInMs) / 3600000;
            const shiftDurationHrs = (shiftOutMs - new Date(matchingShift.clockIn).getTime()) / 3600000;
            const diffHours = jobDurationHrs - shiftDurationHrs;

            if (diffHours > 0.5) {
                discrepancies.push({
                    jobId: job.id,
                    customerName: job.customerName || 'Customer',
                    customerAddress: addressStr,
                    technicianId: techId,
                    technicianName: techName,
                    appointmentTime: job.appointmentTime,
                    reportedCheckIn: job.checkInTime,
                    reportedCheckOut: job.checkOutTime,
                    shiftClockIn: matchingShift.clockIn,
                    shiftClockOut: matchingShift.clockOut,
                    discrepancyType: 'DURATION_MISMATCH',
                    discrepancyHours: Number(diffHours.toFixed(1)),
                    description: `Reported on-site duration (${jobDurationHrs.toFixed(1)}h) exceeds technician shift (${shiftDurationHrs.toFixed(1)}h) by ${diffHours.toFixed(1)} hours.`,
                    suggestedCheckOut: matchingShift.clockOut,
                    suggestedTimeOnSiteMinutes: Math.round((shiftOutMs - jobInMs) / 60000)
                });
            }
        }
    });

    return discrepancies;
}
