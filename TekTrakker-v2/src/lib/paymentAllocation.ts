import { Job } from '../types';

export interface OpenInvoiceItem {
    jobId: string;
    invoiceId: string;
    date: string;
    dateTime: number;
    poNumber?: string;
    workOrderNumber?: string;
    locationName?: string;
    address?: string;
    totalAmount: number;
    amountPaid: number;
    balanceDue: number;
    job: Job;
}

export interface PaymentAllocationResult {
    matchedJobIds: string[];
    allocations: { [jobId: string]: number };
    strategyUsed: 'exact_combination' | 'fifo' | 'manual';
    totalAllocated: number;
    unallocatedAmount: number;
}

/**
 * Extracts and sorts all open invoices (unpaid or partially paid) for a customer.
 */
export function getCustomerOpenInvoices(jobs: Job[], customerId?: string): OpenInvoiceItem[] {
    const openItems: OpenInvoiceItem[] = [];

    const targetJobs = jobs.filter(j => {
        if (j.deleted) return false;
        if (customerId && j.customerId !== customerId) return false;
        if (!j.invoice) return false;
        const status = j.invoice.status;
        if (status === 'Paid' || status === 'Cancelled' || status === 'Void') return false;
        return true;
    });

    for (const job of targetJobs) {
        const inv = job.invoice!;
        const total = Number(inv.totalAmount) || Number(inv.amount) || 0;
        if (total <= 0) continue;

        const paymentsSum = Array.isArray(inv.payments) 
            ? inv.payments.reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0)
            : 0;
        
        const depositAmt = (job.depositPaid || inv.depositPaid) 
            ? (Number(job.depositAmount) || Number(inv.depositAmount) || 0)
            : 0;

        const directPaid = Number(inv.amountPaid) || 0;
        const effectivePaid = Math.max(directPaid, paymentsSum, depositAmt);
        const balanceDue = Math.max(0, parseFloat((total - effectivePaid).toFixed(2)));

        if (balanceDue > 0.009) {
            const rawDate = job.appointmentTime || job.createdAt || new Date().toISOString();
            const dateTime = new Date(rawDate).getTime();
            const dateStr = new Date(rawDate).toLocaleDateString();

            const addr = typeof job.address === 'string' 
                ? job.address 
                : `${(job.address as any)?.street || ''}, ${(job.address as any)?.city || ''}`.trim();

            openItems.push({
                jobId: job.id,
                invoiceId: inv.id || job.id.slice(0, 8),
                date: dateStr,
                dateTime: isNaN(dateTime) ? 0 : dateTime,
                poNumber: job.poNumber,
                workOrderNumber: job.workOrderNumber,
                locationName: job.locationName || job.customerName || 'Main Address',
                address: addr,
                totalAmount: total,
                amountPaid: effectivePaid,
                balanceDue: balanceDue,
                job: job
            });
        }
    }

    // Sort chronologically (oldest first)
    openItems.sort((a, b) => a.dateTime - b.dateTime);
    return openItems;
}

/**
 * Finds if there exists an exact combination of open invoices whose balanceDue sums to targetAmount.
 * Uses recursive search with tolerance of $0.01 for rounding.
 */
export function findExactSubsetSum(items: OpenInvoiceItem[], targetAmount: number): OpenInvoiceItem[] | null {
    const targetCents = Math.round(targetAmount * 100);
    if (targetCents <= 0) return null;

    const n = items.length;
    if (n === 0) return null;

    // Single item exact match check first
    for (const item of items) {
        const itemCents = Math.round(item.balanceDue * 100);
        if (itemCents === targetCents) {
            return [item];
        }
    }

    // Subset search for combinations up to length n
    let bestSubset: OpenInvoiceItem[] | null = null;

    function search(index: number, currentCents: number, currentSubset: OpenInvoiceItem[]) {
        if (bestSubset) return; // Stop if already found
        if (currentCents === targetCents) {
            bestSubset = [...currentSubset];
            return;
        }
        if (currentCents > targetCents || index >= n) return;

        // Try including current item
        const itemCents = Math.round(items[index].balanceDue * 100);
        currentSubset.push(items[index]);
        search(index + 1, currentCents + itemCents, currentSubset);
        currentSubset.pop();

        // Try skipping current item
        search(index + 1, currentCents, currentSubset);
    }

    search(0, 0, []);
    return bestSubset;
}

/**
 * Automatically allocates a payment across open invoices:
 * 1. Checks for exact subset combination match first.
 * 2. If no exact subset found, falls back to FIFO waterfall from oldest to newest.
 */
export function autoAllocatePayment(openInvoices: OpenInvoiceItem[], paymentAmount: number): PaymentAllocationResult {
    const safePayment = Math.max(0, parseFloat((paymentAmount || 0).toFixed(2)));
    if (safePayment <= 0 || openInvoices.length === 0) {
        return {
            matchedJobIds: [],
            allocations: {},
            strategyUsed: 'fifo',
            totalAllocated: 0,
            unallocatedAmount: safePayment
        };
    }

    // Strategy 1: Exact subset combination match
    const exactMatch = findExactSubsetSum(openInvoices, safePayment);
    if (exactMatch && exactMatch.length > 0) {
        const allocations: { [jobId: string]: number } = {};
        const matchedJobIds: string[] = [];
        let totalAllocated = 0;

        for (const item of exactMatch) {
            allocations[item.jobId] = item.balanceDue;
            matchedJobIds.push(item.jobId);
            totalAllocated += item.balanceDue;
        }

        return {
            matchedJobIds,
            allocations,
            strategyUsed: 'exact_combination',
            totalAllocated: parseFloat(totalAllocated.toFixed(2)),
            unallocatedAmount: Math.max(0, parseFloat((safePayment - totalAllocated).toFixed(2)))
        };
    }

    // Strategy 2: FIFO Waterfall (oldest to newest)
    const allocations: { [jobId: string]: number } = {};
    const matchedJobIds: string[] = [];
    let remainingToAllocate = safePayment;

    for (const item of openInvoices) {
        if (remainingToAllocate <= 0) break;

        const alloc = Math.min(item.balanceDue, remainingToAllocate);
        if (alloc > 0) {
            const roundedAlloc = parseFloat(alloc.toFixed(2));
            allocations[item.jobId] = roundedAlloc;
            matchedJobIds.push(item.jobId);
            remainingToAllocate = parseFloat((remainingToAllocate - roundedAlloc).toFixed(2));
        }
    }

    const totalAllocated = parseFloat((safePayment - remainingToAllocate).toFixed(2));

    return {
        matchedJobIds,
        allocations,
        strategyUsed: 'fifo',
        totalAllocated,
        unallocatedAmount: remainingToAllocate
    };
}
