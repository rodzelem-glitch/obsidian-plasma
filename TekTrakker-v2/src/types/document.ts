
export interface BusinessDocument {
    id: string;
    organizationId: string;
    title: string;
    type: 'Other' | 'Service Agreement' | 'Contract' | 'Policy' | 'Letter' | 'Membership Terms' | 'Handbook' | 'Master Upload' | 'Waiver Template' | 'Master Template' | 'Tax Form' | '1099-NEC';
    content: string; 
    createdAt: string;
    createdBy: string;
    context?: string;
    jobId?: string;
    url?: string;
}
