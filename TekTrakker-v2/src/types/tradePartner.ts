export type TradePartnerCategory = 
    | 'parts_house' 
    | 'equipment_rental' 
    | 'subcontractor' 
    | 'fabricator' 
    | 'tools_fleet' 
    | 'disposal_reclaim';

export type TradePartnerPaymentTerms = 
    | 'Net 15' 
    | 'Net 30' 
    | 'Net 60' 
    | '2% 10 Net 30' 
    | 'Due on Receipt' 
    | 'COD' 
    | 'Credit Card';

export type TradePartnerStatus = 'Active' | 'On Hold' | 'Inactive';

export interface TradePartner {
    id: string;
    organizationId: string;
    name: string;
    category: TradePartnerCategory;
    trade?: string;
    status: TradePartnerStatus;
    
    // Trade Credit & Terms
    hasCreditAccount: boolean;
    accountNumber?: string;
    creditLimit?: number;
    currentBalance?: number;
    availableCredit?: number;
    paymentTerms: TradePartnerPaymentTerms;
    earlyPayDiscount?: {
        percentage: number;
        withinDays: number;
    };
    statementCycleDay?: number;
    
    // Contact & Reps
    primaryContact?: string;
    phone: string;
    email?: string;
    website?: string;
    counterPhone?: string;
    emergencyAfterHoursPhone?: string;
    branchAddress?: string;
    insideSalesRep?: {
        name: string;
        phone: string;
        email: string;
    };
    
    // Purchasing Rules
    authorizedPurchasers?: string[];
    maxSpendWithoutApproval?: number;
    requirePoNumber?: boolean;
    requireJobLink?: boolean;
    
    // Compliance & Tax
    resaleCertificateOnFile?: {
        certificateNumber: string;
        expirationDate?: string;
        fileUrl?: string;
    };
    w9OnFile?: boolean;
    w9FileUrl?: string;
    taxId?: string;
    insuranceCois?: Array<{
        type: 'General Liability' | 'Workers Comp' | 'Riggers Liability' | 'Equipment Floater';
        policyNumber?: string;
        expiresAt: string;
        fileUrl?: string;
    }>;
    
    notes?: string;
    createdAt: string;
    updatedAt: string;
}

export type ExternalQuoteStatus = 
    | 'Received' 
    | 'Linked to Job' 
    | 'Imported to Proposal' 
    | 'Approved' 
    | 'Settled' 
    | 'Archived';

export interface ExternalQuoteLineItem {
    id: string;
    name: string;
    description?: string;
    quantity: number;
    unitCost: number;
    totalCost: number;
    category?: 'equipment' | 'materials' | 'labor' | 'crane_rigging' | 'permit' | 'freight' | 'other';
}

export interface ExternalQuoteProposal {
    id: string;
    organizationId: string;
    tradePartnerId?: string;
    vendorName: string;
    quoteNumber: string;
    title: string;
    category: TradePartnerCategory;
    quoteDate: string;
    expirationDate?: string;
    
    totalAmount: number;
    subtotal?: number;
    taxAmount?: number;
    depositRequired?: number;
    depositPercentage?: number;
    paymentTerms?: string;
    
    status: ExternalQuoteStatus;
    fileUrl?: string;
    fileName?: string;
    fileSize?: number;
    description?: string;
    lineItems?: ExternalQuoteLineItem[];
    
    // Links to TekTrakker Entities
    linkedJobId?: string;
    linkedJobName?: string;
    linkedCustomerName?: string;
    linkedWorkOrderNumber?: string;
    
    linkedProposalId?: string;
    linkedProposalNumber?: string;
    
    // Settlement & Expense Conversion
    settledExpenseId?: string;
    settledPayableId?: string;
    settledAt?: string;
    settledAmount?: number;
    
    internalNotes?: string;
    createdAt: string;
    updatedAt: string;
}
