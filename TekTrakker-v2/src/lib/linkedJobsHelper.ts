import { db } from 'lib/firebase';
import { cleanUndefinedFields } from 'lib/utils';
import type { Job, Proposal } from 'types';

export interface LinkedVisit {
    jobId: string;
    visitNumber: number;
    visitType?: string;
    appointmentTime?: string;
    technicianName?: string;
    arrivedTimeFormatted?: string | null;
    departedTimeFormatted?: string | null;
    durationFormatted?: string | null;
    workNotes?: string;
    files?: any[];
}

export interface AggregatedLinkedCluster {
    primaryJob: Job;
    allJobs: Job[];
    allVisits: LinkedVisit[];
    linkedProposals: Proposal[];
    linkedProposalIds: string[];
    combinedPoNumber: string;
    combinedContractRef: string;
    combinedWorkNotes: string;
    combinedFiles: any[];
    combinedItems: any[];
}

/**
 * Fetches and resolves all linked jobs, visits, proposals, and invoices for a given job.
 * Only links jobs that share:
 * 1. Explicit parentJobId / linkedJobIds
 * 2. OR identical PO / Work Order number for the same customer.
 * NEVER merges un-linked jobs just because they share a customer.
 */
export async function fetchLinkedClusterForJob(job: Job): Promise<AggregatedLinkedCluster> {
    const clusterMap = new Map<string, Job>();
    if (job && job.id) {
        clusterMap.set(job.id, job);
    }

    const customerId = job.customerId;
    const poNumber = job.poNumber || job.workOrderNumber || job.invoice?.poNumber;
    const linkedIds = new Set<string>([job.id, ...(job.linkedJobIds || [])]);
    if (job.parentJobId) linkedIds.add(job.parentJobId);

    // 1. Fetch by explicit linkedJobIds / parentJobId
    const fetchPromises: Promise<any>[] = [];
    for (const lId of linkedIds) {
        if (lId && !clusterMap.has(lId)) {
            fetchPromises.push(
                db.collection('jobs').doc(lId).get().then(doc => {
                    if (doc.exists) {
                        clusterMap.set(doc.id, { ...doc.data(), id: doc.id } as Job);
                    }
                }).catch(() => {})
            );
        }
    }

    // 2. Fetch by Work Order / PO number if present (and same customerId)
    if (poNumber && customerId) {
        fetchPromises.push(
            db.collection('jobs')
                .where('customerId', '==', customerId)
                .where('poNumber', '==', poNumber)
                .get()
                .then(snap => {
                    snap.docs.forEach(doc => {
                        if (!clusterMap.has(doc.id)) {
                            clusterMap.set(doc.id, { ...doc.data(), id: doc.id } as Job);
                        }
                    });
                }).catch(() => {})
        );
        fetchPromises.push(
            db.collection('jobs')
                .where('customerId', '==', customerId)
                .where('workOrderNumber', '==', poNumber)
                .get()
                .then(snap => {
                    snap.docs.forEach(doc => {
                        if (!clusterMap.has(doc.id)) {
                            clusterMap.set(doc.id, { ...doc.data(), id: doc.id } as Job);
                        }
                    });
                }).catch(() => {})
        );
    }

    await Promise.all(fetchPromises);

    const allJobs = Array.from(clusterMap.values()).sort((a, b) => {
        const timeA = new Date(a.appointmentTime || a.createdAt || 0).getTime();
        const timeB = new Date(b.appointmentTime || b.createdAt || 0).getTime();
        return timeA - timeB;
    });

    // The newest job is the last one in chronological order
    const newestJob = allJobs[allJobs.length - 1] || job;

    // Synchronize linkedJobIds on the newest job if needed
    const allJobIds = allJobs.map(j => j.id);
    const missingIds = allJobIds.filter(id => !(newestJob.linkedJobIds || []).includes(id));
    if (missingIds.length > 0 && newestJob.id) {
        const updatedLinked = Array.from(new Set([...(newestJob.linkedJobIds || []), ...allJobIds]));
        newestJob.linkedJobIds = updatedLinked;
        db.collection('jobs').doc(newestJob.id).update(cleanUndefinedFields({ linkedJobIds: updatedLinked })).catch(() => {});
    }

    // 3. Fetch all linked proposals
    const propMap = new Map<string, Proposal>();
    const propPromises: Promise<any>[] = [];

    const allPropIds = new Set<string>();
    allJobs.forEach(j => {
        if (j.proposalId) allPropIds.add(j.proposalId);
        if (j.projectId) allPropIds.add(j.projectId);
    });

    for (const pId of allPropIds) {
        propPromises.push(
            db.collection('proposals').doc(pId).get().then(doc => {
                if (doc.exists) {
                    propMap.set(doc.id, { ...doc.data(), id: doc.id } as Proposal);
                }
            }).catch(() => {})
        );
    }

    if (poNumber && customerId) {
        propPromises.push(
            db.collection('proposals')
                .where('customerId', '==', customerId)
                .where('poNumber', '==', poNumber)
                .get()
                .then(snap => {
                    snap.docs.forEach(doc => {
                        if (!propMap.has(doc.id)) {
                            propMap.set(doc.id, { ...doc.data(), id: doc.id } as Proposal);
                        }
                    });
                }).catch(() => {})
        );
    }

    await Promise.all(propPromises);
    const linkedProposals = Array.from(propMap.values());

    // 4. Construct Visits
    const allVisits: LinkedVisit[] = allJobs.map((j, idx) => {
        const checkIn = j.checkInTime || (j.timeEntries && j.timeEntries[0]?.checkInTime) || (j as any).geofenceEvents?.arrivedAt;
        const checkOut = j.checkOutTime || (j.timeEntries && j.timeEntries[0]?.checkOutTime) || (j as any).geofenceEvents?.departedAt;
        const formattedIn = checkIn ? new Date(checkIn).toLocaleString('en-US', { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : null;
        const formattedOut = checkOut ? new Date(checkOut).toLocaleString('en-US', { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : null;
        const durMin = (j as any).geofenceEvents?.durationMinutes || (j as any).timeOnSiteMinutes;

        return {
            jobId: j.id,
            visitNumber: idx + 1,
            visitType: j.visitType || (idx === 0 ? 'Diagnostic / Initial Visit' : `Follow-up Visit #${idx + 1}`),
            appointmentTime: j.appointmentTime,
            technicianName: j.assignedTechnicianName || 'Technician',
            arrivedTimeFormatted: formattedIn,
            departedTimeFormatted: formattedOut,
            durationFormatted: durMin ? `${durMin}m` : null,
            workNotes: j.notes?.workNotes || j.notes?.completion || j.notes?.work || j.techRecommendations || '',
            files: j.files || []
        };
    });

    // 5. Combine Work Notes & Findings
    const notesList: string[] = [];
    allJobs.forEach((j, i) => {
        const note = j.notes?.workNotes || j.notes?.completion || j.notes?.work || j.techRecommendations;
        if (note) {
            notesList.push(`Visit ${i + 1} (${j.appointmentTime ? new Date(j.appointmentTime).toLocaleDateString() : 'Service'}): ${note}`);
        }
    });

    // 6. Combine files
    const fileMap = new Map<string, any>();
    allJobs.forEach(j => {
        (j.files || []).forEach((f: any) => {
            const key = f.id || f.fileName || f.dataUrl;
            if (key && !fileMap.has(key)) {
                fileMap.set(key, f);
            }
        });
    });

    // 7. Combine Line Items
    const itemMap = new Map<string, any>();
    allJobs.forEach(j => {
        (j.invoice?.items || []).forEach((item: any) => {
            const key = item.id || `${item.description}-${item.unitPrice}`;
            if (key && !itemMap.has(key)) {
                itemMap.set(key, item);
            }
        });
    });
    linkedProposals.forEach(p => {
        (p.items || []).forEach((item: any) => {
            const key = item.id || `${item.description}-${item.unitPrice}`;
            if (key && !itemMap.has(key)) {
                itemMap.set(key, item);
            }
        });
    });

    const combinedPo = poNumber || newestJob.poNumber || newestJob.workOrderNumber || 'N/A';
    const combinedContractRef = newestJob.workOrderNumber ? `CONT-${newestJob.workOrderNumber}` : (newestJob.proposalId ? `CONT-${newestJob.proposalId}` : `CONT-JOB-${newestJob.id.slice(-6).toUpperCase()}`);

    return {
        primaryJob: newestJob,
        allJobs,
        allVisits,
        linkedProposals,
        linkedProposalIds: Array.from(allPropIds),
        combinedPoNumber: combinedPo,
        combinedContractRef,
        combinedWorkNotes: notesList.join('\n\n'),
        combinedFiles: Array.from(fileMap.values()),
        combinedItems: Array.from(itemMap.values())
    };
}
