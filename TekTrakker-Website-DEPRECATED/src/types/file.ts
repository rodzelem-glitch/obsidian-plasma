
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
    metadata?: any;
}
