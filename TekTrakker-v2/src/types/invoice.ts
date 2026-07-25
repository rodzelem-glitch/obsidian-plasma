
export interface InvoiceLineItem {
    id: string;
    name?: string; // Added name field
    description: string;
    quantity: number;
    unitPrice: number;
    total: number;
    type: 'Labor' | 'Part' | 'Part/Labor' | 'Fee' | 'Discount' | 'Service';
    taxable?: boolean;
    isPercentage?: boolean;
    percentageRate?: number;
}

export interface InvoiceDetails {
    additionalFeePercent?: number;
    additionalFeeName?: string;
    additionalFeeAmount?: number;
    id: string;
    poNumber?: string | null;
    proposalId?: string | null;
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
    retainagePercent?: number;
    workmanshipWarrantyMonths?: number;
    partsWarrantyMonths?: number;
    warrantyNotes?: string;
    warrantyDisclaimerAgreed?: boolean;
    warrantyIssuedDate?: string | null;
    membershipEnrollment?: any;
}

