import type { Job } from '../types';

export interface JobVisitEntry {
    checkInTime: string;
    checkOutTime?: string | null;
    timeOnSiteMinutes?: number | null;
    method?: string;
    techName?: string;
    id?: string;
}

export interface JobTimeSummary {
    hasTimeRecorded: boolean;
    checkInTime: string | null;
    checkOutTime: string | null;
    formattedInTime: string | null;
    formattedOutTime: string | null;
    formattedInDate: string | null;
    formattedOutDate: string | null;
    formattedInDateTime: string | null;
    formattedOutDateTime: string | null;
    timeOnSiteMinutes: number | null;
    formattedDuration: string | null;
    visits: JobVisitEntry[];
    status: 'completed' | 'in_progress' | 'not_recorded';
}

/**
 * Safely parses any ISO date/time string or timestamp into a valid Date object.
 */
export const parseJobDate = (val: any): Date | null => {
    if (!val) return null;
    if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
    if (typeof val?.toDate === 'function') {
        try {
            const d = val.toDate();
            return isNaN(d.getTime()) ? null : d;
        } catch {
            return null;
        }
    }
    if (typeof val === 'number') {
        const d = new Date(val);
        return isNaN(d.getTime()) ? null : d;
    }
    if (typeof val === 'string') {
        const d = new Date(val);
        return isNaN(d.getTime()) ? null : d;
    }
    return null;
};

/**
 * Universal extractor for job In/Out times, visit history, and site duration.
 * Checks all possible storage shapes (timeEntries, checkInTime, checkInLogs, clockIn, startedAt, geofenceEvents).
 */
export const getJobTimeSummary = (job: Partial<Job> | null | undefined): JobTimeSummary => {
    if (!job) {
        return {
            hasTimeRecorded: false,
            checkInTime: null,
            checkOutTime: null,
            formattedInTime: null,
            formattedOutTime: null,
            formattedInDate: null,
            formattedOutDate: null,
            formattedInDateTime: null,
            formattedOutDateTime: null,
            timeOnSiteMinutes: null,
            formattedDuration: null,
            visits: [],
            status: 'not_recorded'
        };
    }

    const visits: JobVisitEntry[] = [];

    // 1. Collect from timeEntries array if populated
    if (Array.isArray(job.timeEntries) && job.timeEntries.length > 0) {
        job.timeEntries.forEach((entry: any, index: number) => {
            const inDate = parseJobDate(entry.checkInTime);
            if (inDate) {
                const outDate = parseJobDate(entry.checkOutTime);
                let duration = entry.timeOnSiteMinutes;
                if ((duration === undefined || duration === null) && outDate) {
                    duration = Math.max(0, Math.round((outDate.getTime() - inDate.getTime()) / 60000));
                }
                visits.push({
                    id: entry.id || `visit-${index}`,
                    checkInTime: inDate.toISOString(),
                    checkOutTime: outDate ? outDate.toISOString() : null,
                    timeOnSiteMinutes: typeof duration === 'number' ? duration : null,
                    method: entry.method || 'App',
                    techName: entry.techName
                });
            }
        });
    }

    // 2. If no timeEntries, inspect direct checkInTime & checkOutTime
    if (visits.length === 0) {
        const directIn = parseJobDate(job.checkInTime || (job as any).clockInTime || (job as any).clockIn || (job as any).startedAt || (job as any).actualStartTime || (job as any).geofenceEvents?.arrivedAt);
        const directOut = parseJobDate(job.checkOutTime || (job as any).clockOutTime || (job as any).clockOut || (job as any).completedAt || (job as any).actualEndTime || (job as any).geofenceEvents?.departedAt);

        if (directIn) {
            let duration = job.timeOnSiteMinutes;
            if ((duration === undefined || duration === null || duration === 0) && directOut) {
                duration = Math.max(0, Math.round((directOut.getTime() - directIn.getTime()) / 60000));
            }
            visits.push({
                id: 'visit-direct',
                checkInTime: directIn.toISOString(),
                checkOutTime: directOut ? directOut.toISOString() : null,
                timeOnSiteMinutes: typeof duration === 'number' ? duration : null,
                method: (job as any).checkInMethod || 'Manual'
            });
        }
    }

    // 3. If still no visits, inspect checkInLogs (e.g. from IVR, SMS, Webhook)
    if (visits.length === 0 && Array.isArray(job.checkInLogs) && job.checkInLogs.length > 0) {
        const checkInLogs = job.checkInLogs.filter((l: any) => l.action === 'check_in' || l.action === 'in');
        const checkOutLogs = job.checkInLogs.filter((l: any) => l.action === 'check_out' || l.action === 'out');

        if (checkInLogs.length > 0) {
            const firstIn = parseJobDate(checkInLogs[0].timestamp);
            const lastOut = checkOutLogs.length > 0 ? parseJobDate(checkOutLogs[checkOutLogs.length - 1].timestamp) : null;
            if (firstIn) {
                const duration = lastOut ? Math.max(0, Math.round((lastOut.getTime() - firstIn.getTime()) / 60000)) : null;
                visits.push({
                    id: 'visit-logs',
                    checkInTime: firstIn.toISOString(),
                    checkOutTime: lastOut ? lastOut.toISOString() : null,
                    timeOnSiteMinutes: duration,
                    method: checkInLogs[0].method || 'IVR / SMS',
                    techName: checkInLogs[0].techName
                });
            }
        }
    }

    const hasTimeRecorded = visits.length > 0;
    const earliestIn = visits.length > 0 ? visits[0].checkInTime : null;
    const latestOut = visits.length > 0 ? visits[visits.length - 1].checkOutTime || null : null;

    const inDate = earliestIn ? new Date(earliestIn) : null;
    const outDate = latestOut ? new Date(latestOut) : null;

    // Calculate total duration in minutes
    let totalMinutes = typeof job.timeOnSiteMinutes === 'number' && job.timeOnSiteMinutes > 0 
        ? job.timeOnSiteMinutes 
        : visits.reduce((acc, v) => acc + (v.timeOnSiteMinutes || 0), 0);

    if (totalMinutes === 0 && inDate && outDate) {
        totalMinutes = Math.max(0, Math.round((outDate.getTime() - inDate.getTime()) / 60000));
    }

    const formattedDuration = totalMinutes > 0
        ? (totalMinutes >= 60 ? `${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}m` : `${totalMinutes}m`)
        : null;

    const formattedInTime = inDate && !isNaN(inDate.getTime())
        ? inDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
        : null;

    const formattedOutTime = outDate && !isNaN(outDate.getTime())
        ? outDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
        : null;

    const formattedInDate = inDate && !isNaN(inDate.getTime())
        ? inDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
        : null;

    const formattedOutDate = outDate && !isNaN(outDate.getTime())
        ? outDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
        : null;

    const formattedInDateTime = inDate && !isNaN(inDate.getTime())
        ? `${inDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} ${formattedInTime}`
        : null;

    const formattedOutDateTime = outDate && !isNaN(outDate.getTime())
        ? `${outDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} ${formattedOutTime}`
        : null;

    let status: 'completed' | 'in_progress' | 'not_recorded' = 'not_recorded';
    if (hasTimeRecorded) {
        status = latestOut ? 'completed' : 'in_progress';
    }

    return {
        hasTimeRecorded,
        checkInTime: earliestIn,
        checkOutTime: latestOut,
        formattedInTime,
        formattedOutTime,
        formattedInDate,
        formattedOutDate,
        formattedInDateTime,
        formattedOutDateTime,
        timeOnSiteMinutes: totalMinutes > 0 ? totalMinutes : null,
        formattedDuration,
        visits,
        status
    };
};

/**
 * Format ISO datetime string for local <input type="datetime-local">
 */
export const formatDateTimeForInput = (isoString?: string | null): string => {
    if (!isoString) return '';
    try {
        const d = new Date(isoString);
        if (isNaN(d.getTime())) return '';
        const offset = d.getTimezoneOffset();
        const localDate = new Date(d.getTime() - (offset * 60 * 1000));
        return localDate.toISOString().slice(0, 16);
    } catch {
        return '';
    }
};

