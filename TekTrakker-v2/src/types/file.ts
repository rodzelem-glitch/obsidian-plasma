export interface StoredFile {
    id: string;
    organizationId: string;
    parentId?: string;
    parentType?: 'job' | 'customer' | 'project' | 'bid';
    fileName: string;
    fileType: string;
    dataUrl: string;
    createdAt: string;
    uploadedBy: string;
    metadata?: Record<string, any>;
    label?: string;
    url?: string;
}
