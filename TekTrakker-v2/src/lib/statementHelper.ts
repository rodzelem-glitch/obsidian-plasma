/**
 * statementHelper.ts
 * Centralized Single Source of Truth for Customer Statement of Account calculations,
 * ledger transaction compilation, and aging analysis.
 */

export interface StatementAging {
    current: number;
    days30: number;
    days60: number;
    days90: number;
    older: number;
    over45: number;
}

export interface StatementTotals {
    totalBilled: number;
    totalPaid: number;
    totalDue: number;
    aging: StatementAging;
}

export interface StatementJobTransaction {
    job: any;
    invoice: any;
    total: number;
    paid: number;
    balance: number;
    runningBalance: number;
}

/**
 * Checks if a job or its associated invoice is cancelled, void, or empty shell.
 */
export const isJobCancelledOrVoid = (j: any): boolean => {
    if (!j) return true;
    const js = String(j.jobStatus || j.status || '').toLowerCase().trim();
    const invs = String(j.invoice?.status || '').toLowerCase().trim();
    const invNotes = String(j.invoice?.notes || j.invoice?.internalNotes || '').toLowerCase();
    
    // 1. Explicit cancelled or void checks on job or invoice status
    if (js.includes('cancel') || js.includes('void') || invs.includes('cancel') || invs.includes('void')) {
        return true;
    }
    if (j.isCancelled === true || j.isVoid === true || j.invoice?.isCancelled === true || j.invoice?.isVoid === true) {
        return true;
    }
    
    // 2. Invoice notes or descriptions indicating zeroed out / cancelled
    if (invNotes.includes('zeroed out') || invNotes.includes('cancelled') || invNotes.includes('canceled') || invNotes.includes('void')) {
        return true;
    }

    // 3. Exclude empty zero-dollar shell tickets without invoice id or without items
    const total = Number(j.invoice?.totalAmount ?? j.invoice?.amount ?? j.invoice?.grandTotal ?? 0);
    const hasItems = Array.isArray(j.invoice?.items) && j.invoice.items.length > 0;
    if (!j.invoice?.id || (total <= 0.001 && !hasItems)) {
        return true;
    }

    return false;
};

/**
 * Compiles chronological statement transactions from customer jobs with calculated running balances.
 */
export const computeCustomerStatementJobs = (
    customerJobs: any[] = [],
    statementUnpaidOnly: boolean = false
): StatementJobTransaction[] => {
    const invoiceJobs = customerJobs.filter(j => j && j.invoice && !isJobCancelledOrVoid(j));
    
    // Sort chronologically oldest first
    const sorted = [...invoiceJobs].sort((a, b) => {
        const dateA = new Date(a.appointmentTime || a.createdAt || 0).getTime();
        const dateB = new Date(b.appointmentTime || b.createdAt || 0).getTime();
        return dateA - dateB;
    });

    // Compute running balance
    let runningBalance = 0;
    const mapped: StatementJobTransaction[] = sorted.map(j => {
        const inv = j.invoice as any;
        const total = Number(inv.totalAmount ?? inv.amount ?? 0);
        const rawPaid = Number(inv.amountPaid || inv.depositPaidAmount || (inv.depositPaid ? (inv.depositAmount || 0) : 0) || 0);
        const paid = inv.status === 'Failed' ? 0 : (inv.status === 'Paid' ? (rawPaid > 0 ? rawPaid : total) : rawPaid);
        const clampedPaid = Math.min(total, Math.max(0, paid));
        const balance = Math.max(0, total - clampedPaid);
        runningBalance += (total - clampedPaid);
        
        return {
            job: j,
            invoice: inv,
            total,
            paid: clampedPaid,
            balance,
            runningBalance
        };
    });

    const filtered = mapped.filter(tx => !isJobCancelledOrVoid(tx.job) && (tx.total > 0 || (Array.isArray(tx.invoice?.items) && tx.invoice.items.length > 0)));

    if (!statementUnpaidOnly) return filtered;
    return filtered.filter(tx => tx.balance > 0.01 && tx.invoice?.status !== 'Paid');
};

/**
 * Calculates aging buckets and summary totals for customer invoices.
 */
export const computeCustomerStatementTotals = (
    customerJobs: any[] = [],
    asOfDate: Date = new Date()
): StatementTotals => {
    const invoiceJobs = customerJobs.filter(j => j && j.invoice && !isJobCancelledOrVoid(j));
    let totalBilled = 0;
    let totalPaid = 0;
    
    const now = new Date(asOfDate);
    now.setHours(0, 0, 0, 0);
    
    const aging: StatementAging = {
        current: 0,
        days30: 0,
        days60: 0,
        days90: 0,
        older: 0,
        over45: 0
    };

    invoiceJobs.forEach(j => {
        const inv = j.invoice as any;
        const t = Number(inv.totalAmount || inv.amount || 0);
        const p = inv.status === 'Failed' ? 0 : Number(inv.amountPaid || (inv.status === 'Paid' ? t : 0));
        totalBilled += t;
        totalPaid += p;
        
        if (inv.status !== 'Paid') {
            const bal = Math.max(0, t - p);
            const dateVal = j.appointmentTime || j.completedDate || inv.dueDate || j.createdAt;
            if (dateVal) {
                let dateObj = new Date(dateVal);
                if (typeof dateVal === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateVal)) {
                    dateObj = new Date(dateVal.replace(/-/g, '/'));
                }
                dateObj.setHours(0, 0, 0, 0);
                
                const daysOverdue = Math.floor((now.getTime() - dateObj.getTime()) / (1000 * 60 * 60 * 24));
                if (daysOverdue > 45) aging.over45 += bal;
                if (daysOverdue <= 0) aging.current += bal;
                else if (daysOverdue <= 30) aging.days30 += bal;
                else if (daysOverdue <= 60) aging.days60 += bal;
                else if (daysOverdue <= 90) aging.days90 += bal;
                else aging.older += bal;
            } else {
                aging.current += bal;
            }
        }
    });

    return {
        totalBilled,
        totalPaid,
        totalDue: Math.max(0, totalBilled - totalPaid),
        aging
    };
};
