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
    assetId?: string;
    url?: string;
}

export type DriveAccessLevel = 
    | 'inherit' 
    | 'all_staff' 
    | 'management_only' 
    | 'technicians_only' 
    | 'office_only' 
    | 'admins_only' 
    | 'custom_roles';

export interface CompanyDriveFolder {
    id: string;
    organizationId: string;
    name: string;
    parentId: string | null; // null for root, parent folder id for nested subfolder
    color?: string; // e.g. amber, blue, emerald, purple, rose, slate
    accessLevel: DriveAccessLevel;
    allowedRoles?: string[];
    description?: string;
    createdAt: string;
    createdBy: string;
    createdById?: string;
    updatedAt: string;
}

export interface CompanyDriveFile {
    id: string;
    organizationId: string;
    folderId: string | null; // null for root, folder ID for subfolder
    fileName: string;
    label: string;
    fileType: string;
    url: string;
    dataUrl?: string;
    sizeBytes: number;
    accessLevel: DriveAccessLevel;
    allowedRoles?: string[];
    allowedUserIds?: string[];
    isLocked?: boolean;
    tags?: string[];
    description?: string;
    version?: number;
    createdAt: string;
    createdBy: string;
    createdById?: string;
    updatedAt: string;
}
