import type { Job, Subcontractor, User } from '../types';

export interface PayableRecord {
    id: string;
    organizationId: string;
    subcontractorId: string;
    jobId: string;
    amount: number;
    orgNTE?: number;
    subNTE?: number;
    status: 'Unpaid' | 'Paid';
    createdAt: string;
    companyName: string;
    customerName: string;
    customerId?: string;
    workOrderNumber?: string;
    poNumber?: string;
    invoiceNumber?: string;
    paidAt?: string;
    isAutoCalculated?: boolean;
    subcontractorPhone?: string;
    paymentMethod?: string;
}

/**
 * Helper to calculate total subcontractor payables from both persisted Firestore payables
 * and completed jobs assigned to internal/external subcontractors that haven't been persisted yet.
 */
export function calculateSubcontractorPayables(
    jobs: Job[] = [],
    subcontractors: Subcontractor[] = [],
    users: User[] = [],
    existingPayables: PayableRecord[] = [],
    currentOrganizationId: string
): PayableRecord[] {
    if (!currentOrganizationId) return existingPayables;

    // Build linked job chains across all jobs in organization
    const jobChainMap = new Map<string, Set<string>>();
    jobs.forEach(j => {
        if (j.organizationId !== currentOrganizationId) return;
        const chain = new Set<string>([j.id]);
        if (j.parentJobId) chain.add(j.parentJobId);
        if (Array.isArray(j.linkedJobIds)) j.linkedJobIds.forEach(id => chain.add(id));

        // Group jobs sharing the exact same Work Order / PO number for the same customer
        const po = j.poNumber || j.workOrderNumber || j.invoice?.poNumber;
        if (po && po.trim().length > 1) {
            const cleanPo = po.replace(/^[#\s]+/, '').trim().toLowerCase();
            if (cleanPo.length > 1) {
                jobs.forEach(otherJob => {
                    if (otherJob.organizationId === currentOrganizationId && otherJob.id !== j.id) {
                        const otherPo = otherJob.poNumber || otherJob.workOrderNumber || otherJob.invoice?.poNumber;
                        if (otherPo) {
                            const cleanOtherPo = otherPo.replace(/^[#\s]+/, '').trim().toLowerCase();
                            if (cleanOtherPo === cleanPo) {
                                chain.add(otherJob.id);
                            }
                        }
                    }
                });
            }
        }

        chain.forEach(id => jobChainMap.set(id, chain));
    });
    jobs.forEach(j => {
        if (j.organizationId !== currentOrganizationId) return;
        const chain = jobChainMap.get(j.id);
        if (chain) {
            chain.forEach(id => {
                const subChain = jobChainMap.get(id);
                if (subChain && subChain !== chain) {
                    subChain.forEach(x => chain.add(x));
                    jobChainMap.set(id, chain);
                }
            });
        }
    });

    // Track job IDs that already have a payable document in Firestore or are part of a covered job chain
    const existingJobIds = new Set<string>();
    existingPayables.forEach(p => {
        if (p.jobId) {
            existingJobIds.add(p.jobId);
            const chain = jobChainMap.get(p.jobId);
            if (chain) chain.forEach(id => existingJobIds.add(id));
        }
    });

    // Filter jobs for current organization and completed status, ensuring no duplicates across linked job chains
    const completedJobsRaw = jobs.filter(j => 
        j.organizationId === currentOrganizationId && 
        (j.jobStatus === 'Completed' || (j as any).status === 'Completed') &&
        !existingJobIds.has(j.id)
    );

    const processedChains = new Set<string>();
    const completedJobs: Job[] = [];

    completedJobsRaw.forEach(j => {
        const chain = jobChainMap.get(j.id) || new Set([j.id]);
        const chainKey = Array.from(chain).sort().join('|');
        if (!processedChains.has(chainKey)) {
            processedChains.add(chainKey);
            const chainJobs = jobs.filter(x => chain.has(x.id));
            const primaryJob = chainJobs.find(x => x.invoice?.amount || (x as any).partnerPayoutAmount || x.subcontractorBill) || j;
            completedJobs.push(primaryJob);
        }
    });

    // Enrich persisted payables with job chain NTE details, work order number, and subcontractor phone
    const enrichedPayables = existingPayables.map(p => {
        if (!p.jobId) return p;
        const matchingJob = jobs.find(j => j.id === p.jobId);
        const chain = jobChainMap.get(p.jobId);
        const chainJobs = chain ? jobs.filter(x => chain.has(x.id)) : matchingJob ? [matchingJob] : [];
        const primaryJob = chainJobs.find(x => x.invoice?.amount || (x as any).partnerPayoutAmount || x.subcontractorBill) || chainJobs[0] || matchingJob;
        if (primaryJob) {
            const orgNTE = p.orgNTE || Number((primaryJob as any).clientNTE || (primaryJob as any).orgNTE || (primaryJob as any).customerNTE || (primaryJob as any).nte || primaryJob.invoice?.totalAmount || primaryJob.invoice?.amount || 0);
            const subNTE = p.subNTE || Number(primaryJob.subcontractorWorkOrder?.nte || (primaryJob.subcontractorWorkOrder as any)?.agreedAmount || 0);
            const subPhone = p.subcontractorPhone || (primaryJob as any).subcontractorPhone || primaryJob.subcontractorWorkOrder?.customSubPhone;
            const woNum = p.workOrderNumber || (primaryJob as any).workOrderNumber || (primaryJob as any).workOrder || (primaryJob.subcontractorWorkOrder as any)?.workOrderNumber || primaryJob.poNumber || (primaryJob.invoice as any)?.poNumber || primaryJob.linkedWorkOrderNumbers?.[0] || primaryJob.linkedPoNumbers?.[0] || (primaryJob as any).jobNumber;
            return {
                ...p,
                customerId: p.customerId || primaryJob.customerId,
                workOrderNumber: woNum || p.workOrderNumber,
                poNumber: p.poNumber || primaryJob.poNumber || (primaryJob.invoice as any)?.poNumber,
                orgNTE: orgNTE > 0 ? orgNTE : p.orgNTE,
                subNTE: subNTE > 0 ? subNTE : p.subNTE,
                subcontractorPhone: subPhone || p.subcontractorPhone
            };
        }
        return p;
    });

    const autoPayables: PayableRecord[] = [];

    for (const job of completedJobs) {
        // Determine if job is assigned to a subcontractor (internal or external)
        const partnerId = job.assignedPartnerId;
        const techId = job.assignedTechnicianId;
        const subId = job.subcontractorId;
        const assignedTechs = job.assignedTechnicians || [];

        // Look for matching subcontractor in state.subcontractors
        let sub = subcontractors.find(s => {
            if (s.id === subId || s.id === partnerId || s.id === techId || (s.linkedOrgId && s.linkedOrgId === partnerId)) return true;
            if (s.email) {
                const sEmail = s.email.toLowerCase().trim();
                const techEmail = users.find(u => u.id === techId)?.email?.toLowerCase().trim();
                if (techEmail && techEmail === sEmail) return true;
                if ((job as any).subcontractorEmail?.toLowerCase().trim() === sEmail) return true;
            }
            // Token name match
            const subNameTokens = Array.from(new Set([
                ...(s.companyName || '').toLowerCase().split(/\s+/),
                ...(s.contactName || '').toLowerCase().split(/\s+/)
            ])).filter(w => w.length > 1 && !['llc', 'inc', 'corp', 'co', 'services', 'hvac'].includes(w));

            if (subNameTokens.length > 0) {
                const techName = (job.assignedTechnicianName || (job as any).subcontractorName || (job as any).subcontractorBill?.vendorName || '').toLowerCase();
                if (techName && subNameTokens.every(tok => techName.includes(tok))) return true;
            }
            return false;
        });

        // Look for matching user in state.users
        const techUser = users.find(u => 
            u.id === techId || 
            assignedTechs.includes(u.id) ||
            u.id === subId
        );

        const isInternalSub = techUser && (
            techUser.role === 'Subcontractor' || 
            (techUser as any).isSubcontractor === true ||
            (techUser as any).subcontractorId ||
            techUser.role?.toLowerCase() === 'subcontractor'
        );

        const isSubJob = !!sub || !!isInternalSub || !!partnerId || !!job.subcontractorWorkOrder || !!job.subcontractorBill;

        if (!isSubJob) continue;

        // Determine subcontractor display name
        let companyName = 'Internal Subcontractor';
        if (sub) {
            companyName = sub.companyName || sub.contactName || 'Subcontractor';
        } else if (techUser) {
            companyName = `${techUser.firstName || ''} ${techUser.lastName || ''}`.trim() || techUser.email || 'Internal Subcontractor';
        } else if (job.assignedTechnicianName) {
            companyName = job.assignedTechnicianName;
        }

        // Calculate amount owed for this completed job
        let amount = 0;

        if (typeof (job as any).partnerPayoutAmount === 'number' && (job as any).partnerPayoutAmount > 0) {
            amount = (job as any).partnerPayoutAmount;
        } else if (typeof (job as any).subcontractorPayRate === 'number' && (job as any).subcontractorPayRate > 0) {
            amount = (job as any).subcontractorPayRate;
        } else if (typeof (job as any).subcontractorNteAmount === 'number' && (job as any).subcontractorNteAmount > 0) {
            amount = (job as any).subcontractorNteAmount;
        } else if (job.subcontractorBill?.subtotal && job.subcontractorBill.subtotal > 0) {
            amount = job.subcontractorBill.subtotal;
        } else if (job.subcontractorWorkOrder?.agreedAmount && job.subcontractorWorkOrder.agreedAmount > 0) {
            amount = job.subcontractorWorkOrder.agreedAmount;
        } else if (job.subcontractorWorkOrder?.nte && job.subcontractorWorkOrder.nte > 0) {
            amount = job.subcontractorWorkOrder.nte;
        } else {
            const invoiceTotal = job.invoice?.totalAmount || job.invoice?.amount || (job as any).total || 0;
            const pct = sub?.paymentPercentage ?? (techUser as any)?.paymentPercentage ?? job.subcontractorWorkOrder?.paymentPercentage;

            if (pct !== undefined && pct !== null && pct > 0) {
                amount = (invoiceTotal * pct) / 100;
            } else if (sub?.paymentType === 'percentage' && sub?.paymentPercentage) {
                amount = (invoiceTotal * sub.paymentPercentage) / 100;
            } else if (techUser?.hourlyRate && job.timeOnSiteMinutes && job.timeOnSiteMinutes > 0) {
                amount = (techUser.hourlyRate * job.timeOnSiteMinutes) / 60;
            } else if ((techUser as any)?.payRate && job.timeOnSiteMinutes && job.timeOnSiteMinutes > 0) {
                amount = ((techUser as any).payRate * job.timeOnSiteMinutes) / 60;
            } else if (sub?.flatRate && sub.flatRate > 0) {
                amount = sub.flatRate;
            } else {
                amount = 0;
            }
        }

        amount = Math.round(amount * 100) / 100;
        const orgNTE = Number((job as any).clientNTE || (job as any).orgNTE || (job as any).customerNTE || (job as any).nte || job.invoice?.totalAmount || 0);
        const subNTE = Number(job.subcontractorWorkOrder?.nte || (job.subcontractorWorkOrder as any)?.agreedAmount || 0);
        const subPhone = sub?.phone || techUser?.phone || (job as any).subcontractorPhone || job.subcontractorWorkOrder?.customSubPhone;
        const woNum = (job as any).workOrderNumber || (job as any).workOrder || (job.subcontractorWorkOrder as any)?.workOrderNumber || job.poNumber || (job.invoice as any)?.poNumber || job.linkedWorkOrderNumbers?.[0] || job.linkedPoNumbers?.[0] || (job as any).jobNumber;

        autoPayables.push({
            id: `auto-payable-${job.id}`,
            organizationId: currentOrganizationId,
            subcontractorId: sub?.id || techUser?.id || partnerId || techId || 'sub',
            jobId: job.id,
            customerId: job.customerId,
            workOrderNumber: woNum,
            poNumber: job.poNumber || (job.invoice as any)?.poNumber,
            amount,
            orgNTE: orgNTE > 0 ? orgNTE : undefined,
            subNTE: subNTE > 0 ? subNTE : undefined,
            status: 'Unpaid',
            createdAt: job.endTime || job.checkOutTime || job.appointmentTime || job.createdAt || new Date().toISOString(),
            companyName,
            customerName: job.customerName || 'N/A',
            isAutoCalculated: true,
            subcontractorPhone: subPhone
        });
    }

    // Combine persisted Firestore payables with auto-calculated completed job payables
    const allPayables = [...enrichedPayables, ...autoPayables];
    allPayables.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return allPayables;
}

export interface WorkOrderNTERecord {
    jobId: string;
    customerName: string;
    subcontractorName: string;
    nteAmount: number;
    woStatus: string;
    jobStatus: string;
    invoicedAmount: number;
    remainingBuffer: number;
    createdAt: string;
    workOrderNumber?: string;
}

/**
 * Extracts and calculates all Work Order NTE (Not-To-Exceed) budget limits
 * and compares them against actual invoiced/payable amounts.
 */
export function extractWorkOrderNTEs(
    jobs: Job[] = [],
    payables: PayableRecord[] = [],
    currentOrganizationId: string
): WorkOrderNTERecord[] {
    if (!currentOrganizationId) return [];

    const nteRecords: WorkOrderNTERecord[] = [];

    const orgJobs = jobs.filter(j => 
        j.organizationId === currentOrganizationId && 
        (j.subcontractorWorkOrder || (j as any).workOrder)
    );

    for (const job of orgJobs) {
        const wo = job.subcontractorWorkOrder || (job as any).workOrder;
        if (!wo) continue;

        const nteAmount = Number(wo.nte || wo.agreedAmount || 0);
        if (nteAmount <= 0) continue;

        // Find actual invoiced/payable amount linked to this job
        const matchingPayable = payables.find(p => p.jobId === job.id);
        const invoicedAmount = matchingPayable ? matchingPayable.amount : (job.subcontractorBill?.subtotal || 0);

        const subName = wo.subcontractorName || job.assignedTechnicianName || 'Subcontractor';

        nteRecords.push({
            jobId: job.id,
            customerName: job.customerName || 'N/A',
            subcontractorName: subName,
            nteAmount: Math.round(nteAmount * 100) / 100,
            woStatus: wo.status || 'pending',
            jobStatus: job.jobStatus || (job as any).status || 'Scheduled',
            invoicedAmount: Math.round(invoicedAmount * 100) / 100,
            remainingBuffer: Math.round((nteAmount - invoicedAmount) * 100) / 100,
            createdAt: wo.createdAt || job.appointmentTime || job.createdAt || new Date().toISOString(),
            workOrderNumber: wo.id || `WO-${job.id.substring(0, 6).toUpperCase()}`
        });
    }

    nteRecords.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return nteRecords;
}

