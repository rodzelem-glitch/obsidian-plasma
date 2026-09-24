
export interface SubLineItem {
    id: string;
    description: string;
    quantity?: number;
    unitPrice?: number;
    total?: number;
}

export interface InvoiceLineItem {
    id: string;
    name?: string; // Added name field
    description: string;
    quantity: number;
    unitPrice: number;
    total: number;
    type: 'Labor' | 'Part' | 'Part/Labor' | 'Fee' | 'Discount' | 'Service' | 'Tip';
    taxable?: boolean;
    isPercentage?: boolean;
    percentageRate?: number;
    subItems?: SubLineItem[];
    isWarrantyWork?: boolean;
    isExtendedWarranty?: boolean;
    extendedWarrantyData?: {
        planSku?: string;
        planName?: string;
        coverageTier?: string;
        termYears?: number;
        equipmentId?: string;
        equipmentName?: string;
        equipmentSerial?: string;
        wholesaleCost?: number;
        markupPercentage?: number;
        contractorLaborRate?: number;
    };
    cost?: number;
    vendorCost?: number;
    markupPct?: number;
    tier?: string;
}

export interface InvoiceDetails {
    additionalFeePercent?: number;
    additionalFeeName?: string;
    additionalFeeAmount?: number;
    tipAmount?: number;
    id: string;
    referenceNumber?: string | null;
    invoiceNumber?: string | null;
    poNumber?: string | null;
    proposalId?: string | null;
    proposalNumber?: string | null;
    items: InvoiceLineItem[];
    subtotal: number;
    taxRate: number;
    taxAmount: number;
    totalAmount: number; 
    status: 'Paid' | 'Unpaid' | 'Pending' | 'Partially Paid' | 'Failed' | 'Payment Pending';
    signatureUrl?: string | null;
    signatureMetadata?: any;
    signatureHistory?: any[];
    dueDate?: string | null;
    paymentTerms?: string | null;
    invoiceDate?: string | null;
    date?: string | null;
    notes?: string | null;
    amountPaid?: number;
    amount: number; 
    paidDate?: string | null;
    billToName?: string;
    billToAddress?: string;
    accountingSynced?: boolean;
    accountingSyncDate?: string;
    paidTo?: string; // Added for B2B
    paymentRecipientName?: string; // Added for B2B
    paymentMethod?: string;
    paymentProofUrl?: string | null; // Added for proof of payment
    paymentProofDate?: string | null;
    recommendations?: string;
    sentAt?: string;
    remindersSent?: string[];
    opened?: boolean;
    openedAt?: string;
    displayFormat?: 'itemized' | 'progressive';
    retainagePercent?: number;
    retainageAmount?: number;
    workmanshipWarrantyMonths?: number;
    partsWarrantyMonths?: number;
    warrantyNotes?: string;
    warrantyDisclaimerAgreed?: boolean;
    warrantyIssuedDate?: string | null;
    membershipEnrollment?: any;
    extendedWarrantyPlan?: any;
    depositType?: 'flat' | 'percentage' | 'none';
    depositValue?: number;
    depositAmount?: number;
    depositRequired?: number;
    depositNotes?: string;
    depositPaid?: boolean;
    depositPaidAmount?: number;
    grandTotal?: number;
    balanceDue?: number;
    balanceRemaining?: number;
    amountDueToday?: number;
    amountDueNet?: number;
    paymentTermsLabel?: string;
    financialStatus?: 'PAID' | 'PARTIALLY_PAID' | 'DEPOSIT_PAID' | 'UNPAID' | 'OVERDUE';
    hideRolledInNotice?: boolean;
    payments?: InvoicePaymentRecord[];
    refunds?: InvoiceRefundRecord[];
    amountRefunded?: number;
    netPaid?: number;
    processedPaymentIntentIds?: string[];
    lastFailureReason?: string;
    failedDate?: string;
}

export interface InvoiceRefundRecord {
    id: string;
    refundId?: string;
    paymentIntentId?: string;
    amount: number;
    date: string;
    reason?: string;
    method?: string;
    reference?: string;
    notes?: string;
    status?: string;
    createdAt?: string;
}

export interface InvoicePaymentRecord {
    id: string;
    paymentIntentId?: string;
    amount: number;
    baseAmount?: number;
    fee?: number;
    tip?: number;
    date: string;
    method?: string;
    reference?: string;
    notes?: string;
    status?: string;
    createdAt?: string;
}

export interface PaymentRequest {
    id: string;
    organizationId: string;
    customerId?: string | null;
    customerName: string;
    customerEmail?: string | null;
    customerPhone?: string | null;
    amount: number;
    title: string;
    description?: string | null;
    status: 'pending' | 'paid' | 'cancelled' | 'failed';
    type?: 'deposit' | 'custom' | 'retainer' | 'service_fee';
    jobId?: string | null;
    proposalId?: string | null;
    createdAt: string;
    createdBy?: string | null;
    paidAt?: string | null;
    paymentId?: string | null;
    paymentMethod?: string | null;
    signatureUrl?: string | null;
    signatureDate?: string | null;
    notes?: string | null;
    allowCustomAmount?: boolean;
    minAmount?: number;
    maxAmount?: number;
}

