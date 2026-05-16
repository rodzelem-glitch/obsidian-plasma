
export interface InvoiceLineItem {
    id: string;
    name?: string; // Added name field
    description: string;
    quantity: number;
    unitPrice: number;
    total: number;
    type: 'Labor' | 'Part' | 'Part/Labor' | 'Fee' | 'Discount';
    taxable?: boolean;
}

export interface InvoiceDetails {
    additionalFeePercent?: number;
    additionalFeeName?: string;
    additionalFeeAmount?: number;
    id: string;
    items: InvoiceLineItem[];
    subtotal: number;
    taxRate: number;
    taxAmount: number;
    totalAmount: number; 
    status: 'Paid' | 'Unpaid' | 'Pending';
    dueDate?: string | null;
    notes?: string | null;
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
}
