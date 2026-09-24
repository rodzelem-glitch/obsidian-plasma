/**
 * Centralized Canonical Financial Engine for TekTrakker
 * Single Source of Truth for all Invoice, Proposal, and Job financial calculations.
 * 
 * All computed fields are persisted directly to Firestore on document write/update
 * so viewers, PDF generators, and payment links consume pre-calculated database fields.
 */

export interface FinancialLineItem {
    id?: string;
    name?: string;
    title?: string;
    description?: string;
    quantity?: number;
    unitPrice?: number;
    price?: number;
    total?: number;
    taxable?: boolean;
    type?: string;
    subItems?: any[];
}

export interface FinancialInput {
    items?: FinancialLineItem[];
    taxRate?: number; // e.g. 0.0825 or 8.25
    taxAmount?: number;
    subtotal?: number;
    totalAmount?: number;
    additionalFeePercent?: number;
    additionalFeeName?: string;
    additionalFeeAmount?: number;
    requireDeposit?: boolean;
    depositType?: 'percentage' | 'fixed' | 'flat' | 'none' | string;
    depositValue?: number;
    depositAmount?: number;
    depositPaid?: boolean;
    depositPaidAmount?: number;
    depositNotes?: string;
    amountPaid?: number;
    amountRefunded?: number;
    netPaid?: number;
    payments?: any[];
    refunds?: any[];
    paymentTerms?: string;
    status?: string;
    retainagePercent?: number;
}

export interface CanonicalFinancials {
    subtotal: number;
    taxableAmount: number;
    taxRate: number; // Decimal (e.g. 0.0825)
    taxRatePercent: number; // Display percentage (e.g. 8.25)
    taxAmount: number;
    additionalFeeName: string;
    additionalFeePercent: number;
    additionalFeeAmount: number;
    grandTotal: number;
    totalAmount: number; // Alias for grandTotal
    total: number; // Alias for grandTotal
    amount: number; // Alias for grandTotal
    retainagePercent: number;
    retainageAmount: number;
    
    // Deposit Details
    depositType: 'percentage' | 'fixed' | 'flat' | 'none';
    depositValue: number;
    depositRequired: number;
    depositAmount: number; // Alias for depositRequired
    depositPaid: boolean;
    depositPaidAmount: number;
    depositNotes: string;
    
    // Payment & Balance Details
    amountPaid: number;
    amountRefunded: number;
    netPaid: number;
    payments?: any[];
    refunds?: any[];
    balanceDue: number;
    balanceRemaining: number; // Alias for balanceDue
    amountDueToday: number;
    amountDueNet: number;
    
    // Terms & Status
    paymentTerms: string;
    paymentTermsLabel: string;
    isNetTerms: boolean;
    financialStatus: 'PAID' | 'PARTIALLY_PAID' | 'DEPOSIT_PAID' | 'UNPAID' | 'OVERDUE';
}

/**
 * Standard rounding utility to 2 decimal places to prevent floating point inaccuracies.
 */
export const roundCurrency = (amount: number | null | undefined): number => {
    if (amount === null || amount === undefined || isNaN(amount)) return 0;
    return Math.round((Number(amount) + Number.EPSILON) * 100) / 100;
};

/**
 * Formats a numerical currency value into a standard USD string ($X,XXX.XX).
 */
export const formatCurrency = (amount: number | string | null | undefined): string => {
    const num = Number(amount) || 0;
    if (num < 0) {
        return `-$${Math.abs(num).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    return `$${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

/**
 * Resolves human-readable label for payment terms.
 */
export const getCanonicalPaymentTermsLabel = (terms?: string, depositPaid: boolean = false, isPartiallyPaid: boolean = false): string => {
    const raw = (terms || 'due_upon_receipt').toLowerCase();
    
    if (raw.includes('net')) {
        const netNum = raw.replace(/[^0-9]/g, '') || '30';
        if (depositPaid) return `Deposit Paid • Net ${netNum}`;
        if (isPartiallyPaid) return `Partially Paid • Net ${netNum}`;
        return `Net ${netNum}`;
    }
    
    if (depositPaid) return 'Deposit Paid';
    if (isPartiallyPaid) return 'Partially Paid';
    return 'Due';
};

/**
 * Computes the complete, normalized set of canonical financial fields.
 */
export const computeCanonicalFinancials = (input: FinancialInput = {}): CanonicalFinancials => {
    const rawItems = Array.isArray(input.items) ? input.items : [];
    
    // 1. Subtotal calculation
    let calculatedSubtotal = 0;
    let taxableAmount = 0;
    
    if (rawItems.length > 0) {
        rawItems.forEach(item => {
            const qty = Number(item.quantity) || 1;
            const price = Number(item.unitPrice ?? item.price ?? (item as any).cost ?? (item as any).amount ?? (item as any).rate ?? 0);
            const lineTotal = item.total !== undefined && item.total !== null 
                ? Number(item.total) 
                : roundCurrency(qty * price);
            
            calculatedSubtotal += lineTotal;
            if (item.taxable !== false) {
                taxableAmount += lineTotal;
            }
        });
        // If calculated subtotal is 0 from incomplete item objects, but explicit subtotal or totalAmount exists, preserve it
        if (calculatedSubtotal === 0 && input.subtotal !== undefined && input.subtotal !== null && Number(input.subtotal) > 0) {
            calculatedSubtotal = Number(input.subtotal);
            taxableAmount = calculatedSubtotal;
        } else if (calculatedSubtotal === 0 && input.totalAmount !== undefined && input.totalAmount !== null && Number(input.totalAmount) > 0) {
            calculatedSubtotal = Number(input.totalAmount);
            taxableAmount = calculatedSubtotal;
        }
    } else if (input.subtotal !== undefined && input.subtotal !== null) {
        calculatedSubtotal = Number(input.subtotal);
        taxableAmount = calculatedSubtotal;
    } else if (input.totalAmount !== undefined && input.totalAmount !== null) {
        calculatedSubtotal = Number(input.totalAmount);
        taxableAmount = calculatedSubtotal;
    }
    
    const subtotal = roundCurrency(calculatedSubtotal);
    taxableAmount = roundCurrency(taxableAmount);

    // 2. Tax calculation
    let taxRateVal = input.taxRate !== undefined && input.taxRate !== null ? Number(input.taxRate) : 0.0825;
    if (taxRateVal > 1) {
        // Passed as percentage (e.g. 8.25)
        taxRateVal = taxRateVal / 100;
    }
    const taxRate = taxRateVal;
    const taxRatePercent = roundCurrency(taxRate * 100);

    const taxAmount = input.taxAmount !== undefined && input.taxAmount !== null
        ? roundCurrency(input.taxAmount)
        : (taxRate === 0 ? 0 : roundCurrency(taxableAmount * taxRate));

    // 3. Additional fees / adjustments
    const feePercent = Number(input.additionalFeePercent) || 0;
    const feeName = input.additionalFeeName || (feePercent ? 'Adjustment' : '');
    const additionalFeeAmount = input.additionalFeeAmount !== undefined && input.additionalFeeAmount !== null
        ? roundCurrency(input.additionalFeeAmount)
        : (feePercent ? roundCurrency(subtotal * (feePercent / 100)) : 0);

    // 4. Retainage calculation (for commercial/progressive billing)
    const retainagePercent = Number(input.retainagePercent) || 0;
    const retainageAmount = retainagePercent > 0 ? roundCurrency(subtotal * (retainagePercent / 100)) : 0;

    // 5. Grand total
    const grandTotal = input.totalAmount !== undefined && input.totalAmount !== null && subtotal === 0 && Number(input.totalAmount) > 0
        ? roundCurrency(input.totalAmount)
        : roundCurrency(subtotal + taxAmount + additionalFeeAmount);

    // 6. Deposit calculations
    const isExplicitlyDisabled = input.requireDeposit === false || input.depositType === 'none' || (input.depositValue === 0 && (!input.depositAmount || Number(input.depositAmount) === 0));
    const depType: 'percentage' | 'fixed' | 'flat' | 'none' = isExplicitlyDisabled
        ? 'none'
        : ((input.depositType as any) || (input.depositValue ? 'percentage' : (input.depositAmount ? 'fixed' : 'none')));
    const depValue = isExplicitlyDisabled ? 0 : (Number(input.depositValue) || 0);
    
    let depositRequired = 0;
    if (!isExplicitlyDisabled) {
        if (depType === 'percentage' && depValue > 0) {
            depositRequired = roundCurrency(grandTotal * (depValue / 100));
        } else if ((depType === 'fixed' || (depType as string) === 'flat') && depValue > 0) {
            depositRequired = roundCurrency(depValue);
        } else if (input.depositAmount !== undefined && input.depositAmount !== null && Number(input.depositAmount) > 0) {
            depositRequired = roundCurrency(Number(input.depositAmount));
        }
    }
    
    const depositPaidExplicit = !!input.depositPaid;
    const rawDepositPaidAmount = Number(input.depositPaidAmount) || (depositPaidExplicit ? depositRequired : 0);
    const depositPaidAmount = roundCurrency(Math.min(grandTotal, Math.max(0, rawDepositPaidAmount)));
    const depositPaid = depositPaidExplicit || (depositRequired > 0 && depositPaidAmount >= depositRequired);

    // 7. Amount Paid, Refunds, Net Paid & Balances
    const rawRefunds = Array.isArray(input.refunds) ? input.refunds : [];
    const rawPayments = Array.isArray(input.payments) ? input.payments : [];
    const totalRefundsFromArr = rawRefunds.reduce((sum: number, r: any) => sum + (Number(r.amount) || 0), 0);
    const amountRefunded = roundCurrency(input.amountRefunded !== undefined && input.amountRefunded !== null ? Number(input.amountRefunded) : totalRefundsFromArr);

    const totalPaymentsFromArr = rawPayments.reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0);
    const rawTotalPaid = Number(input.amountPaid) || totalPaymentsFromArr || 0;
    // Total payments cannot be less than collected deposit payments
    const effectivePaid = Math.max(rawTotalPaid, depositPaidAmount);
    const amountPaid = roundCurrency(effectivePaid);
    const netPaid = roundCurrency(input.netPaid !== undefined && input.netPaid !== null ? Number(input.netPaid) : Math.max(0, amountPaid - amountRefunded));
    
    // Balance due is grand total minus net amount paid
    const balanceDue = roundCurrency(Math.max(0, grandTotal - netPaid));

    // 8. Payment Terms & Due Today Breakdown
    const paymentTerms = (input.paymentTerms || 'due_upon_receipt').toLowerCase();
    const isNetTerms = paymentTerms.includes('net');

    let amountDueToday = 0;
    let amountDueNet = 0;

    if (balanceDue <= 0) {
        amountDueToday = 0;
        amountDueNet = 0;
    } else if (depositRequired > 0) {
        if (!depositPaid && depositPaidAmount < depositRequired) {
            amountDueToday = roundCurrency(Math.min(balanceDue, depositRequired - depositPaidAmount));
            amountDueNet = roundCurrency(Math.max(0, balanceDue - amountDueToday));
        } else {
            // Deposit is already satisfied
            amountDueToday = 0;
            amountDueNet = balanceDue;
        }
    } else {
        // No deposit required
        if (isNetTerms) {
            amountDueToday = 0;
            amountDueNet = balanceDue;
        } else {
            amountDueToday = balanceDue;
            amountDueNet = 0;
        }
    }

    // 9. Financial Status
    let financialStatus: 'PAID' | 'PARTIALLY_PAID' | 'DEPOSIT_PAID' | 'UNPAID' | 'OVERDUE' = 'UNPAID';
    if (balanceDue <= 0 || (netPaid >= grandTotal - 0.01 && grandTotal > 0)) {
        financialStatus = 'PAID';
    } else if (depositPaid && netPaid > 0) {
        financialStatus = 'DEPOSIT_PAID';
    } else if (netPaid > 0) {
        financialStatus = 'PARTIALLY_PAID';
    } else {
        financialStatus = 'UNPAID';
    }

    const paymentTermsLabel = getCanonicalPaymentTermsLabel(paymentTerms, depositPaid, netPaid > 0);

    return {
        subtotal,
        taxableAmount,
        taxRate,
        taxRatePercent,
        taxAmount,
        additionalFeeName: feeName,
        additionalFeePercent: feePercent,
        additionalFeeAmount,
        grandTotal,
        totalAmount: grandTotal,
        total: grandTotal,
        amount: grandTotal,
        retainagePercent,
        retainageAmount,

        depositType: depType,
        depositValue: depValue,
        depositRequired,
        depositAmount: depositRequired,
        depositPaid,
        depositPaidAmount,
        depositNotes: input.depositNotes || '',

        amountPaid,
        amountRefunded,
        netPaid,
        payments: rawPayments,
        refunds: rawRefunds,
        balanceDue,
        balanceRemaining: balanceDue,
        amountDueToday,
        amountDueNet,

        paymentTerms,
        paymentTermsLabel,
        isNetTerms,
        financialStatus
    };
};
