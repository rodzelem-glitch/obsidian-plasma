import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
    HardDrive, Folder, FolderPlus, FolderOpen, UploadCloud, Download, Eye, 
    Trash2, Edit3, Search, Filter, Plus, Grid, List, Sparkles, Clock, 
    ExternalLink, X, Check, Tag, ChevronRight, AlertCircle, Calendar, 
    User as UserIcon, Shield, ShieldCheck, ShieldAlert, Lock, Unlock, 
    Move, CornerDownRight, FileText, Image as ImageIcon, FileSpreadsheet, 
    FileCode, File, ArrowLeft, MoreVertical, RefreshCw, Layers, CheckSquare, 
    Square, HelpCircle, Building2, Users, UserCheck, Briefcase, ChevronDown
} from 'lucide-react';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import Textarea from '../../components/ui/Textarea';
import CustomerMasterModal from '../../components/modals/CustomerMasterModal';
import { useAppContext } from 'context/AppContext';
import { db, firebase } from 'lib/firebase';
import { uploadFileToStorage } from 'lib/storageService';
import { detectFileType } from 'lib/fileViewerHelper';
import showToast from 'lib/toast';
import { globalConfirm } from 'lib/globalConfirm';
import { cleanUndefinedFields } from 'lib/utils';
import type { User, Customer, Job, StoredFile, CompanyDriveFolder, CompanyDriveFile, DriveAccessLevel } from 'types';

const ACCESS_LEVEL_LABELS: Record<DriveAccessLevel, { label: string; icon: any; color: string; desc: string }> = {
    inherit: { 
        label: 'Inherit from Folder', 
        icon: Layers, 
        color: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400',
        desc: 'Uses the containing folder\'s permissions'
    },
    all_staff: { 
        label: 'All Organization Staff', 
        icon: Users, 
        color: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
        desc: 'Visible to every active employee and technician in the company'
    },
    management_only: { 
        label: 'Management & Supervisors', 
        icon: ShieldCheck, 
        color: 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800',
        desc: 'Restricted to Admins, Supervisors, and Managers'
    },
    technicians_only: { 
        label: 'Field Techs & Operations', 
        icon: Shield, 
        color: 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800',
        desc: 'Visible to Technicians, Lead Techs, and Managers'
    },
    office_only: { 
        label: 'Office Staff & Dispatch', 
        icon: Building2, 
        color: 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800',
        desc: 'Restricted to Dispatchers, Office Staff, and Managers'
    },
    admins_only: { 
        label: 'Admins & Master Admins Only', 
        icon: Lock, 
        color: 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800',
        desc: 'Strictly restricted to Organization Administrators'
    },
    custom_roles: { 
        label: 'Custom Role List', 
        icon: ShieldAlert, 
        color: 'bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800',
        desc: 'Accessible only by explicitly selected role designations'
    }
};

const FOLDER_COLORS = [
    { name: 'Amber Gold', value: 'amber', bg: 'bg-amber-500/10 text-amber-500 border-amber-300' },
    { name: 'Sky Blue', value: 'sky', bg: 'bg-sky-500/10 text-sky-500 border-sky-300' },
    { name: 'Emerald Green', value: 'emerald', bg: 'bg-emerald-500/10 text-emerald-500 border-emerald-300' },
    { name: 'Purple Royal', value: 'purple', bg: 'bg-purple-500/10 text-purple-500 border-purple-300' },
    { name: 'Rose Red', value: 'rose', bg: 'bg-rose-500/10 text-rose-500 border-rose-300' },
    { name: 'Indigo Dark', value: 'indigo', bg: 'bg-indigo-500/10 text-indigo-500 border-indigo-300' },
    { name: 'Slate Gray', value: 'slate', bg: 'bg-slate-500/10 text-slate-500 border-slate-300' },
];

const CUSTOMER_PRESET_CATEGORIES = [
    'Contracts & Agreements',
    'Blueprints & Schematics',
    'Permits & Municipal Forms',
    'Invoices & Receipts',
    'Equipment Manuals & Specs',
    'Warranties & Certificates',
    'Photos & Inspection Media',
    'Insurance & Tax (COI/W9)',
    'General Documents',
    'Service Visit Attachments'
];

const AVAILABLE_COMPANY_ROLES = [
    'admin',
    'supervisor',
    'both',
    'Manager',
    'Administrator',
    'Technician',
    'Lead Technician',
    'Dispatcher',
    'Office Staff',
    'employee',
    'Subcontractor'
];

export const OrganizationDrive: React.FC = () => {
    const navigate = useNavigate();
    const { state, dispatch } = useAppContext();
    const currentUser = state.currentUser;
    const activeOrg = state.currentOrganization;
    const activeOrgId = activeOrg?.id || currentUser?.organizationId;

    const isAdmin = currentUser?.role === 'master_admin' || currentUser?.role === 'admin' || currentUser?.role === 'both';

    // State for company folders and files
    const [folders, setFolders] = useState<CompanyDriveFolder[]>([]);
    const [companyFiles, setCompanyFiles] = useState<CompanyDriveFile[]>([]);
    const [loading, setLoading] = useState(true);

    // Active Navigation Path
    const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);

    // Navigation Back Helper
    const handleGoBack = () => {
        if (currentFolderId === null) {
            navigate('/admin/dashboard');
            return;
        }

        if (currentFolderId === 'system:customers') {
            setCurrentFolderId(null);
            return;
        }

        if (currentFolderId.startsWith('customer:')) {
            const parts = currentFolderId.split(':');
            if (parts[2]) {
                // Inside customer category -> go to customer folder
                setCurrentFolderId(`customer:${parts[1]}`);
            } else {
                // Inside customer folder -> go to Customers & Accounts
                setCurrentFolderId('system:customers');
            }
            return;
        }

        // Standard company folder: find parent folder
        const currentFolder = folders.find(f => f.id === currentFolderId);
        setCurrentFolderId(currentFolder?.parentId || null);
    };

    // Customer Master Modal Launcher
    const [activeCustomerModalId, setActiveCustomerModalId] = useState<string | null>(null);

    // View Mode & Filtering States
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [searchTerm, setSearchTerm] = useState('');
    const [searchScope, setSearchScope] = useState<'current' | 'all'>('current');
    const [fileTypeFilter, setFileTypeFilter] = useState<string>('ALL');
    const [accessLevelFilter, setAccessLevelFilter] = useState<string>('ALL');
    const [sortBy, setSortBy] = useState<'name_asc' | 'name_desc' | 'date_desc' | 'date_asc' | 'size_desc' | 'size_asc'>('name_asc');
    const [isDragOver, setIsDragOver] = useState(false);

    // Testing perspective (for admins to test what other roles see)
    const [previewRole, setPreviewRole] = useState<string>('ACTUAL');

    // Modals
    const [isCreateFolderOpen, setIsCreateFolderOpen] = useState(false);
    const [folderFormName, setFolderFormName] = useState('');
    const [folderFormColor, setFolderFormColor] = useState('amber');
    const [folderFormAccessLevel, setFolderFormAccessLevel] = useState<DriveAccessLevel>('all_staff');
    const [folderFormRoles, setFolderFormRoles] = useState<string[]>([]);
    const [folderFormDescription, setFolderFormDescription] = useState('');
    const [editingFolder, setEditingFolder] = useState<CompanyDriveFolder | null>(null);

    // Upload Modal
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
    const [pendingUploads, setPendingUploads] = useState<Array<{
        file: File;
        title: string;
        folderId: string | null;
        customerCategory?: string;
        accessLevel: DriveAccessLevel;
        allowedRoles: string[];
        tags: string;
        description: string;
    }>>([]);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgressText, setUploadProgressText] = useState('');
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    // File Preview Modal
    const [previewingFile, setPreviewingFile] = useState<any | null>(null);

    // Edit Permissions Modal
    const [permItem, setPermItem] = useState<{ type: 'file' | 'folder'; item: any } | null>(null);
    const [permAccessLevel, setPermAccessLevel] = useState<DriveAccessLevel>('all_staff');
    const [permAllowedRoles, setPermAllowedRoles] = useState<string[]>([]);
    const [permIsLocked, setPermIsLocked] = useState(false);
    const [isSavingPerms, setIsSavingPerms] = useState(false);

    // Recursive helper to determine if candidateId is a descendant of ancestorId
    const isDescendantOf = (
        candidateId: string | null,
        ancestorId: string,
        allFolders: CompanyDriveFolder[]
    ): boolean => {
        if (!candidateId) return false;
        if (candidateId === ancestorId) return true;
        let curr = allFolders.find(f => f.id === candidateId);
        let depth = 0;
        while (curr && curr.parentId && depth < 50) {
            if (curr.parentId === ancestorId) return true;
            curr = allFolders.find(f => f.id === curr.parentId);
            depth++;
        }
        return false;
    };

    // Helper to construct breadcrumb path array for any folder ID
    const getFolderBreadcrumbPath = (
        folderId: string | null,
        allFolders: CompanyDriveFolder[]
    ): Array<{ id: string | null; name: string }> => {
        if (!folderId) {
            return [{ id: null, name: 'Root (Top Level Drive)' }];
        }
        const chain: Array<{ id: string | null; name: string }> = [];
        let curr = allFolders.find(f => f.id === folderId);
        let safety = 0;
        while (curr && safety < 30) {
            chain.unshift({ id: curr.id, name: curr.name });
            if (curr.parentId) {
                curr = allFolders.find(f => f.id === curr?.parentId);
            } else {
                break;
            }
            safety++;
        }
        return [{ id: null, name: 'Root' }, ...chain];
    };

    // Helper to construct breadcrumb string for display
    const getFolderDisplayPath = (
        folderId: string | null,
        allFolders: CompanyDriveFolder[]
    ): string => {
        const crumbs = getFolderBreadcrumbPath(folderId, allFolders);
        return crumbs.map(c => c.name).join(' / ');
    };

    // Move Item Modal (Google Drive Style Drill-Down)
    const [movingItem, setMovingItem] = useState<{ type: 'file' | 'folder'; item: any } | null>(null);
    const [targetMoveFolderId, setTargetMoveFolderId] = useState<string | null>(null);
    const [moveNavFolderId, setMoveNavFolderId] = useState<string | null>(null);
    const [isCreatingFolderInModal, setIsCreatingFolderInModal] = useState(false);
    const [newFolderNameInModal, setNewFolderNameInModal] = useState('');
    const [newFolderColorInModal, setNewFolderColorInModal] = useState('amber');
    const [customerMoveCategory, setCustomerMoveCategory] = useState('General Documents');
    const [moveFolderSearchTerm, setMoveFolderSearchTerm] = useState('');
    const [isMoving, setIsMoving] = useState(false);

    // Upload Destination & Drill-Down Folder Picker
    const [globalUploadFolderId, setGlobalUploadFolderId] = useState<string | null>(null);
    const [isFolderPickerOpen, setIsFolderPickerOpen] = useState(false);
    const [pickerNavFolderId, setPickerNavFolderId] = useState<string | null>(null);
    const [pickerSelectedFolderId, setPickerSelectedFolderId] = useState<string | null>(null);
    const [pickerTargetItemIndex, setPickerTargetItemIndex] = useState<number | null>(null); // null = all uploads
    const [isCreatingFolderInPicker, setIsCreatingFolderInPicker] = useState(false);
    const [newFolderNameInPicker, setNewFolderNameInPicker] = useState('');
    const [newFolderColorInPicker, setNewFolderColorInPicker] = useState('amber');
    const [pickerSearchTerm, setPickerSearchTerm] = useState('');

    // Drag & Drop Moving (Google Drive Style Direct Manipulation)
    const [draggedDriveItem, setDraggedDriveItem] = useState<{
        type: 'file' | 'folder';
        id: string;
        name: string;
        parentId?: string | null;
        customerId?: string;
    } | null>(null);
    const [dropTargetFolderId, setDropTargetFolderId] = useState<string | null>(null);

    // 1. Subscribe to Company Folders and Files (Strict Multi-Tenant Isolation)
    useEffect(() => {
        if (!activeOrgId) {
            setLoading(false);
            return;
        }

        setLoading(true);

        const unsubFolders = db.collection('organizations').doc(activeOrgId).collection('drive_folders')
            .onSnapshot(snap => {
                const folderList: CompanyDriveFolder[] = [];
                snap.forEach(doc => {
                    folderList.push({ id: doc.id, ...doc.data() } as CompanyDriveFolder);
                });
                setFolders(folderList);
            }, err => {
                console.warn("Drive folders listener notice:", err?.message || err);
            });

        const unsubFiles = db.collection('organizations').doc(activeOrgId).collection('drive_files')
            .onSnapshot(snap => {
                const fileList: CompanyDriveFile[] = [];
                snap.forEach(doc => {
                    const data = doc.data();
                    fileList.push({ id: doc.id, ...data, folderId: data.folderId ?? null } as CompanyDriveFile);
                });
                setCompanyFiles(fileList);
                setLoading(false);
            }, err => {
                console.warn("Drive files listener notice:", err?.message || err);
                setLoading(false);
            });

        return () => {
            unsubFolders();
            unsubFiles();
        };
    }, [activeOrgId]);

    const computeFileSize = (rawSizeVal: any, urlVal?: string, dataUrlVal?: string): number => {
        let size = typeof rawSizeVal === 'number' ? rawSizeVal : Number(rawSizeVal || 0);
        if (!isNaN(size) && size > 0) return size;
        const targetUrl = dataUrlVal || urlVal || '';
        if (targetUrl.startsWith('data:')) {
            const commaIdx = targetUrl.indexOf(',');
            const base64Len = commaIdx >= 0 ? targetUrl.length - (commaIdx + 1) : targetUrl.length;
            return Math.round(base64Len * 0.75);
        }
        if (targetUrl.startsWith('http') || targetUrl.startsWith('blob')) {
            return 180 * 1024;
        }
        return 50 * 1024;
    };

    // 2. Aggregate all Customer Files from state.customers and customerJobs
    const unifiedCustomerFiles = useMemo(() => {
        const list: Array<CompanyDriveFile & { customerId: string; customerName: string; parentType: string; originCategory: string }> = [];
        const customers = state.customers || [];
        const jobs = state.jobs || [];

        customers.forEach(customer => {
            // Direct customer files
            if (customer.files && Array.isArray(customer.files)) {
                customer.files.forEach(f => {
                    const cat = String(f.metadata?.category || 'General Documents');
                    const createdAt = f.createdAt || (customer as any).createdAt || new Date().toISOString();
                    const sizeBytes = computeFileSize(f.metadata?.sizeBytes || (f.metadata as any)?.size, f.url, f.dataUrl);
                    list.push({
                        id: f.id || `cf-${customer.id}-${f.fileName}`,
                        organizationId: customer.organizationId || activeOrgId || '',
                        folderId: `customer:${customer.id}:${cat}`,
                        fileName: f.fileName,
                        label: f.label || f.fileName,
                        fileType: f.fileType || 'application/pdf',
                        url: f.dataUrl || f.url || '',
                        dataUrl: f.dataUrl || f.url,
                        sizeBytes: sizeBytes,
                        accessLevel: 'all_staff',
                        tags: Array.isArray(f.metadata?.tags) ? f.metadata.tags : [],
                        description: f.metadata?.description ? String(f.metadata.description) : '',
                        createdAt: createdAt,
                        createdBy: f.uploadedBy || 'Staff Member',
                        updatedAt: createdAt,
                        customerId: customer.id,
                        customerName: customer.name,
                        parentType: 'customer',
                        originCategory: cat
                    });
                });
            }

            // Legacy customer compliance documents
            if ((customer as any).documents && Array.isArray((customer as any).documents)) {
                (customer as any).documents.forEach((cd: any) => {
                    const cat = cd.type || 'Insurance & Tax (COI/W9)';
                    const createdAt = cd.uploadedAt || (customer as any).createdAt || new Date().toISOString();
                    const sizeBytes = computeFileSize(cd.size, cd.url, cd.dataUrl);
                    list.push({
                        id: cd.id || `cc-${customer.id}-${cd.name}`,
                        organizationId: customer.organizationId || activeOrgId || '',
                        folderId: `customer:${customer.id}:${cat}`,
                        fileName: cd.name || 'Compliance Document',
                        label: cd.name || 'Compliance Document',
                        fileType: cd.fileType || 'application/pdf',
                        url: cd.dataUrl || cd.url || '',
                        dataUrl: cd.dataUrl || cd.url,
                        sizeBytes: sizeBytes,
                        accessLevel: 'all_staff',
                        tags: ['Compliance'],
                        description: cd.notes || '',
                        createdAt: createdAt,
                        createdBy: cd.uploadedBy || 'Staff Member',
                        updatedAt: createdAt,
                        customerId: customer.id,
                        customerName: customer.name,
                        parentType: 'customer',
                        originCategory: cat
                    });
                });
            }

            // Customer Jobs / Visit Attachments
            const customerJobs = jobs.filter(j => j.customerId === customer.id);
            customerJobs.forEach(job => {
                if (job.files && Array.isArray(job.files)) {
                    job.files.forEach(jf => {
                        const jobTitle = (job.tasks && job.tasks.length > 0 ? job.tasks.join(', ') : '') || (job as any).title || (job as any).jobType || `Job #${job.id.slice(-6)}`;
                        const createdAt = jf.createdAt || (job as any).createdAt || new Date().toISOString();
                        const sizeBytes = computeFileSize(jf.metadata?.sizeBytes || (jf.metadata as any)?.size, jf.url, jf.dataUrl);
                        list.push({
                            id: jf.id || `jf-${job.id}-${jf.fileName}`,
                            organizationId: job.organizationId || activeOrgId || '',
                            folderId: `customer:${customer.id}:Service Visit Attachments`,
                            fileName: jf.fileName,
                            label: jf.label || `${jf.fileName} (${jobTitle})`,
                            fileType: jf.fileType || 'image/jpeg',
                            url: jf.dataUrl || jf.url || '',
                            dataUrl: jf.dataUrl || jf.url,
                            sizeBytes: sizeBytes,
                            accessLevel: 'all_staff',
                            tags: ['Service Visit', jobTitle],
                            description: `Attachment from visit: ${jobTitle} (${job.jobNumber || ''})`,
                            createdAt: createdAt,
                            createdBy: jf.uploadedBy || job.assignedTechnicianName || 'Technician',
                            updatedAt: createdAt,
                            customerId: customer.id,
                            customerName: customer.name,
                            parentType: 'job',
                            originCategory: 'Service Visit Attachments'
                        });
                    });
                }
            });
        });

        return list;
    }, [state.customers, state.jobs, activeOrgId]);

    // Current effective user role for access checks
    const effectiveRole = useMemo(() => {
        if (!isAdmin || previewRole === 'ACTUAL') {
            return currentUser?.role || 'employee';
        }
        return previewRole;
    }, [isAdmin, previewRole, currentUser?.role]);

    // Access control permission evaluator
    const checkAccess = (
        accessLevel: DriveAccessLevel, 
        allowedRoles?: string[], 
        parentFolderId?: string | null
    ): boolean => {
        if (isAdmin && previewRole === 'ACTUAL') return true;

        let level = accessLevel;
        let roles = allowedRoles || [];

        if (level === 'inherit' && parentFolderId && !parentFolderId.startsWith('customer:')) {
            const parent = folders.find(f => f.id === parentFolderId);
            if (parent) {
                level = parent.accessLevel;
                roles = parent.allowedRoles || [];
            } else {
                level = 'all_staff';
            }
        }

        if (level === 'all_staff' || !level) return true;

        if (level === 'management_only') {
            return ['master_admin', 'admin', 'both', 'supervisor', 'Manager', 'Administrator'].includes(effectiveRole);
        }

        if (level === 'technicians_only') {
            return ['Technician', 'Lead Technician', 'employee', 'master_admin', 'admin', 'both', 'supervisor', 'Manager'].includes(effectiveRole);
        }

        if (level === 'office_only') {
            return ['Dispatcher', 'Office Staff', 'master_admin', 'admin', 'both', 'supervisor', 'Manager'].includes(effectiveRole);
        }

        if (level === 'admins_only') {
            return ['master_admin', 'admin', 'both'].includes(effectiveRole);
        }

        if (level === 'custom_roles') {
            if (['master_admin', 'admin', 'both'].includes(effectiveRole)) return true;
            return roles.includes(effectiveRole);
        }

        return true;
    };

    // Active Customer Context (when inside a customer folder)
    const activeCustomerContext = useMemo(() => {
        if (!currentFolderId || !currentFolderId.startsWith('customer:')) return null;
        const parts = currentFolderId.split(':');
        const customerId = parts[1];
        const category = parts[2] || null;
        const customer = (state.customers || []).find(c => c.id === customerId);
        return { customerId, category, customer };
    }, [currentFolderId, state.customers]);

    // Breadcrumb path computation (supporting virtual customer folders)
    const breadcrumbPath = useMemo(() => {
        const path: Array<{ id: string | null; name: string }> = [{ id: null, name: 'Organization Drive' }];
        if (!currentFolderId) return path;

        if (currentFolderId === 'system:customers') {
            path.push({ id: 'system:customers', name: 'Customers & Accounts' });
            return path;
        }

        if (currentFolderId.startsWith('customer:')) {
            path.push({ id: 'system:customers', name: 'Customers & Accounts' });
            const parts = currentFolderId.split(':');
            const customerId = parts[1];
            const category = parts[2] || null;
            const customer = (state.customers || []).find(c => c.id === customerId);
            const customerName = customer?.name || 'Customer Folder';

            path.push({ id: `customer:${customerId}`, name: customerName });

            if (category) {
                path.push({ id: currentFolderId, name: category });
            }
            return path;
        }

        // Standard Company Drive Folder Chain
        const chain: Array<{ id: string; name: string }> = [];
        let curr: CompanyDriveFolder | undefined = folders.find(f => f.id === currentFolderId);

        let safety = 0;
        while (curr && safety < 20) {
            chain.unshift({ id: curr.id, name: curr.name });
            if (curr.parentId) {
                curr = folders.find(f => f.id === curr?.parentId);
            } else {
                break;
            }
            safety++;
        }

        return [...path, ...chain];
    }, [currentFolderId, folders, state.customers]);

    // Subfolders in current view (Company folders, Smart system folders, or Customer folders)
    const visibleSubfolders = useMemo(() => {
        // 1. ROOT VIEW: Company Root Folders + Smart System Folder 'Customers & Accounts'
        if (currentFolderId === null) {
            const rootCompanyFolders = folders.filter(f => {
                if (f.parentId !== null) return false;
                return checkAccess(f.accessLevel, f.allowedRoles, null);
            }).sort((a, b) => a.name.localeCompare(b.name));

            // Create Virtual Root Folder for Customers
            const totalCustomerFilesCount = unifiedCustomerFiles.length;
            const customersWithFilesCount = new Set(unifiedCustomerFiles.map(f => f.customerId)).size;

            const customersSystemFolder: any = {
                id: 'system:customers',
                name: 'Customers & Accounts',
                parentId: null,
                color: 'sky',
                accessLevel: 'all_staff',
                isSystemFolder: true,
                badgeText: `${customersWithFilesCount} Accounts • ${totalCustomerFilesCount} Files`,
                description: 'Organized nested folders for each customer account, contracts, blueprints, and visit media.'
            };

            return [customersSystemFolder, ...rootCompanyFolders];
        }

        // 2. INSIDE 'system:customers': Show Folders for Each Customer
        if (currentFolderId === 'system:customers') {
            const customers = state.customers || [];
            return customers.map(c => {
                const cFiles = unifiedCustomerFiles.filter(f => f.customerId === c.id);
                const addressStr = c.address ? (typeof c.address === 'string' ? c.address : `${(c.address as any).city || ''}, ${(c.address as any).state || ''}`) : '';
                return {
                    id: `customer:${c.id}`,
                    name: c.name,
                    parentId: 'system:customers',
                    color: 'indigo',
                    accessLevel: 'all_staff',
                    isCustomerFolder: true,
                    customerId: c.id,
                    badgeText: `${cFiles.length} ${cFiles.length === 1 ? 'file' : 'files'}`,
                    description: addressStr
                };
            }).sort((a, b) => a.name.localeCompare(b.name));
        }

        // 3. INSIDE A SPECIFIC CUSTOMER FOLDER: Show Category Folders
        if (currentFolderId.startsWith('customer:') && !currentFolderId.split(':')[2]) {
            const customerId = currentFolderId.split(':')[1];
            const cFiles = unifiedCustomerFiles.filter(f => f.customerId === customerId);

            return CUSTOMER_PRESET_CATEGORIES.map(cat => {
                const count = cFiles.filter(f => f.originCategory === cat).length;
                return {
                    id: `customer:${customerId}:${cat}`,
                    name: cat,
                    parentId: currentFolderId,
                    color: cat === 'Contracts & Agreements' ? 'purple' : cat === 'Blueprints & Schematics' ? 'sky' : cat === 'Service Visit Attachments' ? 'indigo' : 'amber',
                    accessLevel: 'all_staff',
                    isCustomerCategoryFolder: true,
                    badgeText: `${count} ${count === 1 ? 'file' : 'files'}`,
                    description: `${cat} for this customer.`
                };
            });
        }

        // 4. INSIDE A CATEGORY FOLDER: No further subfolders
        if (currentFolderId.startsWith('customer:') && currentFolderId.split(':')[2]) {
            return [];
        }

        // 5. STANDARD COMPANY SUBFOLDERS
        return folders.filter(f => {
            if (f.parentId !== currentFolderId) return false;
            return checkAccess(f.accessLevel, f.allowedRoles, f.parentId);
        }).sort((a, b) => a.name.localeCompare(b.name));
    }, [currentFolderId, folders, unifiedCustomerFiles, state.customers, effectiveRole, previewRole, isAdmin]);

    // Visible Files in Current View
    const visibleFiles = useMemo(() => {
        let candidateFiles: any[] = [];

        if (searchScope === 'all' && searchTerm.trim()) {
            candidateFiles = [...companyFiles, ...unifiedCustomerFiles];
        } else if (currentFolderId === null) {
            candidateFiles = companyFiles.filter(f => f.folderId === null || !f.folderId);
        } else if (currentFolderId === 'system:customers') {
            candidateFiles = [];
        } else if (currentFolderId.startsWith('customer:')) {
            const parts = currentFolderId.split(':');
            const customerId = parts[1];
            const category = parts[2] || null;

            if (category) {
                candidateFiles = unifiedCustomerFiles.filter(f => f.customerId === customerId && f.originCategory === category);
            } else {
                candidateFiles = unifiedCustomerFiles.filter(f => f.customerId === customerId);
            }
        } else {
            candidateFiles = companyFiles.filter(f => f.folderId === currentFolderId);
        }

        return candidateFiles.filter(file => {
            if (!checkAccess(file.accessLevel, file.allowedRoles, file.folderId)) {
                return false;
            }

            if (fileTypeFilter !== 'ALL') {
                const typeInfo = detectFileType(file.url || file.dataUrl || '', file.fileName, file.fileType);
                if (fileTypeFilter === 'pdf' && !typeInfo.isPdf) return false;
                if (fileTypeFilter === 'image' && !typeInfo.isImage) return false;
                if (fileTypeFilter === 'office' && !typeInfo.isOfficeDoc) return false;
                if (fileTypeFilter === 'other' && (typeInfo.isPdf || typeInfo.isImage || typeInfo.isOfficeDoc)) return false;
            }

            if (accessLevelFilter !== 'ALL') {
                if (file.accessLevel !== accessLevelFilter) return false;
            }

            if (searchTerm.trim()) {
                const term = searchTerm.toLowerCase().trim();
                const fileName = (file.fileName || '').toLowerCase();
                const label = (file.label || '').toLowerCase();
                const description = (file.description || '').toLowerCase();
                const customerName = (file.customerName || '').toLowerCase();
                const tags = Array.isArray(file.tags) ? file.tags.join(' ').toLowerCase() : '';

                const matches = fileName.includes(term) || 
                                label.includes(term) || 
                                description.includes(term) || 
                                customerName.includes(term) ||
                                tags.includes(term);
                if (!matches) return false;
            }

            return true;
        }).sort((a, b) => {
            if (sortBy === 'name_asc') return (a.label || a.fileName).localeCompare(b.label || b.fileName);
            if (sortBy === 'name_desc') return (b.label || b.fileName).localeCompare(a.label || a.fileName);
            if (sortBy === 'date_desc') return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
            if (sortBy === 'date_asc') return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
            if (sortBy === 'size_desc') return (b.sizeBytes || 0) - (a.sizeBytes || 0);
            if (sortBy === 'size_asc') return (a.sizeBytes || 0) - (b.sizeBytes || 0);
            return 0;
        });
    }, [companyFiles, unifiedCustomerFiles, currentFolderId, searchScope, searchTerm, fileTypeFilter, accessLevelFilter, sortBy, effectiveRole, previewRole, isAdmin]);

    const formatBytes = (bytes?: number) => {
        if (!bytes || bytes <= 0) return '0 B';
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    const driveMetrics = useMemo(() => {
        let totalBytes = 0;
        let companyBytes = 0;
        let customerBytes = 0;

        companyFiles.forEach(f => {
            const sz = computeFileSize(f.sizeBytes, f.url, f.dataUrl);
            totalBytes += sz;
            companyBytes += sz;
        });

        let directCustomerCount = 0;
        let jobFilesCount = 0;

        unifiedCustomerFiles.forEach(f => {
            const sz = computeFileSize(f.sizeBytes, f.url, f.dataUrl);
            totalBytes += sz;
            customerBytes += sz;
            if (f.parentType === 'customer') directCustomerCount++;
            else if (f.parentType === 'job') jobFilesCount++;
        });

        const customersCount = (state.customers || []).length;
        const accountsWithFiles = new Set(unifiedCustomerFiles.map(f => f.customerId)).size;

        return {
            totalCompanyFolders: folders.length,
            totalCompanyFiles: companyFiles.length,
            totalCustomerFiles: unifiedCustomerFiles.length,
            directCustomerFiles: directCustomerCount,
            jobFilesCount: jobFilesCount,
            totalCustomerAccounts: customersCount,
            accountsWithFiles: accountsWithFiles,
            totalFiles: companyFiles.length + unifiedCustomerFiles.length,
            totalBytes,
            companyBytes,
            customerBytes
        };
    }, [folders, companyFiles, unifiedCustomerFiles, state.customers]);

    const getFolderItemCounts = (folderId: string) => {
        if (folderId === 'system:customers') {
            return { subFoldersCount: state.customers?.length || 0, filesCount: unifiedCustomerFiles.length, total: unifiedCustomerFiles.length };
        }
        if (folderId.startsWith('customer:')) {
            const parts = folderId.split(':');
            const cId = parts[1];
            const cat = parts[2];
            const cFiles = unifiedCustomerFiles.filter(f => f.customerId === cId && (!cat || f.originCategory === cat));
            return { subFoldersCount: cat ? 0 : CUSTOMER_PRESET_CATEGORIES.length, filesCount: cFiles.length, total: cFiles.length };
        }
        const subF = folders.filter(f => f.parentId === folderId).length;
        const subFiles = companyFiles.filter(f => f.folderId === folderId).length;
        return { subFoldersCount: subF, filesCount: subFiles, total: subF + subFiles };
    };

    const renderFileTypeIcon = (file: any, sizeClass: string = "w-6 h-6") => {
        const src = file.url || file.dataUrl || '';
        const info = detectFileType(src, file.fileName, file.fileType);

        if (info.isPdf) return <FileText className={`${sizeClass} text-rose-500`} />;
        if (info.isImage) return <ImageIcon className={`${sizeClass} text-emerald-500`} />;
        if (info.isOfficeDoc) return <FileSpreadsheet className={`${sizeClass} text-blue-500`} />;
        if (info.isHtml || info.isText) return <FileCode className={`${sizeClass} text-amber-500`} />;
        return <File className={`${sizeClass} text-slate-500`} />;
    };

    const handleFilesSelected = (selected: FileList | File[]) => {
        const fileList = Array.from(selected);
        if (fileList.length === 0) return;

        const defaultCategory = activeCustomerContext?.category || 'General Documents';
        const initialCompanyFolderId = currentFolderId && !currentFolderId.startsWith('system:') && !currentFolderId.startsWith('customer:') ? currentFolderId : null;

        setGlobalUploadFolderId(initialCompanyFolderId);

        const prepared = fileList.map(file => {
            const cleanTitle = file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");
            return {
                file,
                title: cleanTitle,
                folderId: initialCompanyFolderId,
                customerCategory: defaultCategory,
                accessLevel: 'all_staff' as DriveAccessLevel,
                allowedRoles: [],
                tags: '',
                description: ''
            };
        });

        setPendingUploads(prepared);
        setIsUploadModalOpen(true);
    };

    const handleOpenFolderPicker = (targetItemIdx: number | null) => {
        setPickerTargetItemIndex(targetItemIdx);
        const startingFolderId = targetItemIdx !== null
            ? (pendingUploads[targetItemIdx]?.folderId || null)
            : (globalUploadFolderId || null);
        setPickerNavFolderId(startingFolderId);
        setPickerSelectedFolderId(startingFolderId);
        setIsCreatingFolderInPicker(false);
        setNewFolderNameInPicker('');
        setPickerSearchTerm('');
        setIsFolderPickerOpen(true);
    };

    const handleCreateFolderInPicker = async (parentId: string | null, name: string, color: string = 'amber'): Promise<string | null> => {
        if (!activeOrgId || !name.trim()) return null;
        try {
            const authorName = currentUser 
                ? `${currentUser.firstName || ''} ${currentUser.lastName || ''}`.trim() || currentUser.username
                : 'Admin Staff';
            const newFolder: Omit<CompanyDriveFolder, 'id'> = {
                organizationId: activeOrgId,
                name: name.trim(),
                parentId: parentId || null,
                color: color,
                accessLevel: 'all_staff',
                allowedRoles: [],
                description: '',
                createdAt: new Date().toISOString(),
                createdBy: authorName,
                createdById: currentUser?.id || '',
                updatedAt: new Date().toISOString()
            };
            const docRef = await db.collection('organizations').doc(activeOrgId).collection('drive_folders').add(cleanUndefinedFields(newFolder));
            showToast.success(`Created folder "${name.trim()}"`);
            return docRef.id;
        } catch (err: any) {
            console.error("Create folder error:", err);
            showToast.error(`Failed to create folder: ${err.message || 'Error'}`);
            return null;
        }
    };

    const handleExecuteUpload = async () => {
        if (!activeOrgId) {
            showToast.error("Organization missing. Please refresh.");
            return;
        }

        setIsUploading(true);

        try {
            const isInsideCustomer = activeCustomerContext && activeCustomerContext.customerId;

            if (isInsideCustomer) {
                const targetCustomer = activeCustomerContext.customer;
                if (!targetCustomer) throw new Error("Customer not found.");

                const uploadedCustomerFiles: StoredFile[] = [];

                for (let i = 0; i < pendingUploads.length; i++) {
                    const item = pendingUploads[i];
                    setUploadProgressText(`Uploading to ${targetCustomer.name}: ${item.file.name}...`);

                    const safeName = item.file.name ? item.file.name.replace(/[^a-zA-Z0-9.\-_]/g, '') : 'document.pdf';
                    const storagePath = `organizations/${activeOrgId}/customers/${targetCustomer.id}/drive/${Date.now()}_${safeName}`;
                    const downloadUrl = await uploadFileToStorage(storagePath, item.file);

                    const tagsArray = item.tags ? item.tags.split(',').map(t => t.trim()).filter(Boolean) : [];

                    const newStoredFile: StoredFile = {
                        id: `file-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
                        organizationId: activeOrgId,
                        parentId: targetCustomer.id,
                        parentType: 'customer',
                        fileName: item.file.name,
                        fileType: item.file.type || 'application/octet-stream',
                        dataUrl: downloadUrl,
                        url: downloadUrl,
                        createdAt: new Date().toISOString(),
                        uploadedBy: currentUser ? `${currentUser.firstName || ''} ${currentUser.lastName || ''}`.trim() : 'Staff Member',
                        label: item.title.trim() || item.file.name,
                        metadata: {
                            category: item.customerCategory || activeCustomerContext.category || 'General Documents',
                            tags: tagsArray,
                            description: item.description.trim(),
                            sizeBytes: item.file.size,
                            source: 'org_drive_customer_upload'
                        }
                    };

                    uploadedCustomerFiles.push(newStoredFile);
                }

                if (uploadedCustomerFiles.length > 0) {
                    const updatedFiles = [...(targetCustomer.files || []), ...uploadedCustomerFiles];
                    await db.collection('customers').doc(targetCustomer.id).update(cleanUndefinedFields({
                        files: updatedFiles,
                        updatedAt: new Date().toISOString()
                    }));

                    const updatedCustomer = { ...targetCustomer, files: updatedFiles };
                    dispatch({ type: 'UPDATE_CUSTOMER', payload: updatedCustomer });
                    showToast.success(`Uploaded ${uploadedCustomerFiles.length} file(s) to ${targetCustomer.name}'s folder.`);
                }
            } else {
                for (let i = 0; i < pendingUploads.length; i++) {
                    const item = pendingUploads[i];
                    setUploadProgressText(`Uploading ${i + 1} of ${pendingUploads.length}: ${item.file.name}...`);

                    if (item.file.size > 50 * 1024 * 1024) {
                        showToast.warn(`File ${item.file.name} is too large (>50MB). Skipping.`);
                        continue;
                    }

                    const safeName = item.file.name ? item.file.name.replace(/[^a-zA-Z0-9.\-_]/g, '') : 'document.pdf';
                    const folderSegment = item.folderId ? `folder_${item.folderId}` : 'root';
                    const storagePath = `organizations/${activeOrgId}/company_drive/${folderSegment}/${Date.now()}_${safeName}`;

                    const downloadUrl = await uploadFileToStorage(storagePath, item.file);

                    const tagsArray = item.tags
                        ? item.tags.split(',').map(t => t.trim()).filter(Boolean)
                        : [];

                    const uploaderName = currentUser 
                        ? `${currentUser.firstName || ''} ${currentUser.lastName || ''}`.trim() || currentUser.username
                        : 'Admin Staff';

                    const newDriveFile: Omit<CompanyDriveFile, 'id'> = {
                        organizationId: activeOrgId,
                        folderId: item.folderId || null,
                        fileName: item.file.name,
                        label: item.title.trim() || item.file.name,
                        fileType: item.file.type || 'application/octet-stream',
                        url: downloadUrl,
                        dataUrl: downloadUrl,
                        sizeBytes: item.file.size,
                        accessLevel: item.accessLevel,
                        allowedRoles: item.allowedRoles,
                        tags: tagsArray,
                        description: item.description.trim(),
                        createdAt: new Date().toISOString(),
                        createdBy: uploaderName,
                        createdById: currentUser?.id || '',
                        updatedAt: new Date().toISOString()
                    };

                    await db.collection('organizations').doc(activeOrgId).collection('drive_files').add(cleanUndefinedFields(newDriveFile));
                }

                showToast.success(`Uploaded ${pendingUploads.length} ${pendingUploads.length === 1 ? 'document' : 'documents'} to Organization Drive.`);
            }

            setIsUploadModalOpen(false);
            setPendingUploads([]);
        } catch (err: any) {
            console.error("Upload Error:", err);
            showToast.error(`Upload failed: ${err.message || 'Unknown error'}`);
        } finally {
            setIsUploading(false);
            setUploadProgressText('');
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleSaveFolder = async () => {
        if (!activeOrgId) return;
        if (!folderFormName.trim()) {
            showToast.error("Please enter a folder name.");
            return;
        }

        try {
            const authorName = currentUser 
                ? `${currentUser.firstName || ''} ${currentUser.lastName || ''}`.trim() || currentUser.username
                : 'Admin Staff';

            if (editingFolder) {
                await db.collection('organizations').doc(activeOrgId).collection('drive_folders').doc(editingFolder.id).update(cleanUndefinedFields({
                    name: folderFormName.trim(),
                    color: folderFormColor,
                    accessLevel: folderFormAccessLevel,
                    allowedRoles: folderFormRoles,
                    description: folderFormDescription.trim(),
                    updatedAt: new Date().toISOString()
                }));
                showToast.success("Folder updated successfully.");
            } else {
                const newFolder: Omit<CompanyDriveFolder, 'id'> = {
                    organizationId: activeOrgId,
                    name: folderFormName.trim(),
                    parentId: currentFolderId && !currentFolderId.startsWith('system:') && !currentFolderId.startsWith('customer:') ? currentFolderId : null,
                    color: folderFormColor,
                    accessLevel: folderFormAccessLevel,
                    allowedRoles: folderFormRoles,
                    description: folderFormDescription.trim(),
                    createdAt: new Date().toISOString(),
                    createdBy: authorName,
                    createdById: currentUser?.id || '',
                    updatedAt: new Date().toISOString()
                };
                await db.collection('organizations').doc(activeOrgId).collection('drive_folders').add(cleanUndefinedFields(newFolder));
                showToast.success(`Created folder "${folderFormName.trim()}"`);
            }

            setIsCreateFolderOpen(false);
            setEditingFolder(null);
            setFolderFormName('');
            setFolderFormDescription('');
            setFolderFormRoles([]);
        } catch (err: any) {
            console.error("Save Folder Error:", err);
            showToast.error(`Failed to save folder: ${err.message || 'Error'}`);
        }
    };

    const handleOpenEditFolder = (folder: CompanyDriveFolder, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        if ((folder as any).isSystemFolder || (folder as any).isCustomerFolder || (folder as any).isCustomerCategoryFolder) return;
        setEditingFolder(folder);
        setFolderFormName(folder.name);
        setFolderFormColor(folder.color || 'amber');
        setFolderFormAccessLevel(folder.accessLevel || 'all_staff');
        setFolderFormRoles(folder.allowedRoles || []);
        setFolderFormDescription(folder.description || '');
        setIsCreateFolderOpen(true);
    };

    const handleDeleteFolder = async (folder: any, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        if (folder.isSystemFolder || folder.isCustomerFolder || folder.isCustomerCategoryFolder) return;
        if (!activeOrgId) return;

        const counts = getFolderItemCounts(folder.id);
        const warningMsg = counts.total > 0
            ? `Folder "${folder.name}" contains ${counts.filesCount} file(s) and ${counts.subFoldersCount} subfolder(s). Deleting it will permanently remove all nested contents. Continue?`
            : `Permanently delete folder "${folder.name}"?`;

        if (!await globalConfirm(warningMsg)) return;

        try {
            const deleteRecursively = async (fId: string) => {
                const subFiles = companyFiles.filter(f => f.folderId === fId);
                for (const sf of subFiles) {
                    await db.collection('organizations').doc(activeOrgId).collection('drive_files').doc(sf.id).delete();
                }
                const childFolders = folders.filter(f => f.parentId === fId);
                for (const cf of childFolders) {
                    await deleteRecursively(cf.id);
                }
                await db.collection('organizations').doc(activeOrgId).collection('drive_folders').doc(fId).delete();
            };

            await deleteRecursively(folder.id);

            if (currentFolderId === folder.id) {
                setCurrentFolderId(folder.parentId || null);
            }

            showToast.success(`Deleted folder "${folder.name}"`);
        } catch (err: any) {
            console.error("Delete Folder Error:", err);
            showToast.error(`Failed to delete folder: ${err.message || 'Error'}`);
        }
    };

    const handleDeleteFile = async (file: any, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        if (!activeOrgId) return;

        if (file.isLocked && !isAdmin) {
            showToast.error("This document is locked and cannot be deleted.");
            return;
        }

        const displayName = file.label || file.fileName;
        if (!await globalConfirm(`Permanently delete "${displayName}"?`)) {
            return;
        }

        try {
            if (file.customerId) {
                const targetCustomer = (state.customers || []).find(c => c.id === file.customerId);
                if (targetCustomer) {
                    const updatedFiles = (targetCustomer.files || []).filter(f => f.id !== file.id && (f.dataUrl || f.url) !== (file.dataUrl || file.url));
                    await db.collection('customers').doc(targetCustomer.id).update(cleanUndefinedFields({
                        files: updatedFiles,
                        updatedAt: new Date().toISOString()
                    }));
                    dispatch({ type: 'UPDATE_CUSTOMER', payload: { ...targetCustomer, files: updatedFiles } });
                }
            } else {
                await db.collection('organizations').doc(activeOrgId).collection('drive_files').doc(file.id).delete();
            }

            showToast.success(`Deleted ${displayName}`);
            if (previewingFile?.id === file.id) setPreviewingFile(null);
        } catch (err: any) {
            console.error("Delete File Error:", err);
            showToast.error(`Failed to delete: ${err.message || 'Error'}`);
        }
    };

    const handleOpenPermissions = (item: any, type: 'file' | 'folder', e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        setPermItem({ type, item });
        setPermAccessLevel(item.accessLevel || (type === 'file' ? 'inherit' : 'all_staff'));
        setPermAllowedRoles(item.allowedRoles || []);
        setPermIsLocked(type === 'file' ? !!item.isLocked : false);
    };

    const handleSavePermissions = async () => {
        if (!permItem || !activeOrgId) return;
        setIsSavingPerms(true);

        try {
            if (permItem.item.customerId) {
                showToast.info("Customer file permissions are managed by customer privacy controls.");
                setPermItem(null);
                return;
            }

            const collectionName = permItem.type === 'file' ? 'drive_files' : 'drive_folders';
            const updates: any = {
                accessLevel: permAccessLevel,
                allowedRoles: permAllowedRoles,
                updatedAt: new Date().toISOString()
            };

            if (permItem.type === 'file') {
                updates.isLocked = permIsLocked;
            }

            await db.collection('organizations').doc(activeOrgId).collection(collectionName).doc(permItem.item.id).update(cleanUndefinedFields(updates));

            showToast.success("Access controls updated successfully.");
            setPermItem(null);
        } catch (err: any) {
            console.error("Save Permissions Error:", err);
            showToast.error(`Failed to update permissions: ${err.message || 'Error'}`);
        } finally {
            setIsSavingPerms(false);
        }
    };

    const handleOpenMove = (item: any, type: 'file' | 'folder', e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        setMovingItem({ type, item });
        const initialParent = type === 'file' ? (item.folderId || null) : (item.parentId || null);
        setTargetMoveFolderId(initialParent);
        setMoveNavFolderId(initialParent);
        setIsCreatingFolderInModal(false);
        setNewFolderNameInModal('');
        setMoveFolderSearchTerm('');
        if (item.customerId) {
            setCustomerMoveCategory(item.originCategory || 'General Documents');
        }
    };

    const handleExecuteMove = async () => {
        if (!movingItem || !activeOrgId) return;
        setIsMoving(true);

        try {
            if (movingItem.item.customerId) {
                // Moving a customer document between customer category folders
                const customerId = movingItem.item.customerId;
                const targetCategory = customerMoveCategory || 'General Documents';
                const targetCustomer = (state.customers || []).find(c => c.id === customerId);
                if (!targetCustomer) {
                    throw new Error("Customer account not found.");
                }

                const updatedFiles = (targetCustomer.files || []).map(f => {
                    const isTargetFile = f.id === movingItem.item.id || 
                        (movingItem.item.fileName && f.fileName === movingItem.item.fileName && (f.dataUrl === movingItem.item.url || f.url === movingItem.item.url));
                    if (isTargetFile) {
                        return {
                            ...f,
                            metadata: {
                                ...(f.metadata || {}),
                                category: targetCategory
                            }
                        };
                    }
                    return f;
                });

                await db.collection('customers').doc(customerId).update(cleanUndefinedFields({
                    files: updatedFiles,
                    updatedAt: new Date().toISOString()
                }));

                const updatedCustomer = { ...targetCustomer, files: updatedFiles };
                dispatch({ type: 'UPDATE_CUSTOMER', payload: updatedCustomer });
                showToast.success(`Moved document to ${targetCategory}`);
                setMovingItem(null);
                return;
            }

            if (movingItem.type === 'file') {
                if ((movingItem.item.folderId || null) === (targetMoveFolderId || null)) {
                    showToast.info("File is already in this folder.");
                    setIsMoving(false);
                    return;
                }

                await db.collection('organizations').doc(activeOrgId).collection('drive_files').doc(movingItem.item.id).update(cleanUndefinedFields({
                    folderId: targetMoveFolderId,
                    updatedAt: new Date().toISOString()
                }));
                const destName = targetMoveFolderId ? (folders.find(f => f.id === targetMoveFolderId)?.name || 'folder') : 'Root Drive';
                showToast.success(`Moved "${movingItem.item.label || movingItem.item.fileName}" to ${destName}.`);
            } else {
                if (targetMoveFolderId === movingItem.item.id) {
                    showToast.error("Cannot move a folder into itself.");
                    setIsMoving(false);
                    return;
                }
                if (targetMoveFolderId && isDescendantOf(targetMoveFolderId, movingItem.item.id, folders)) {
                    showToast.error("Cannot move a folder into one of its own child folders.");
                    setIsMoving(false);
                    return;
                }
                if ((movingItem.item.parentId || null) === (targetMoveFolderId || null)) {
                    showToast.info("Folder is already in this location.");
                    setIsMoving(false);
                    return;
                }

                await db.collection('organizations').doc(activeOrgId).collection('drive_folders').doc(movingItem.item.id).update(cleanUndefinedFields({
                    parentId: targetMoveFolderId,
                    updatedAt: new Date().toISOString()
                }));
                const destName = targetMoveFolderId ? (folders.find(f => f.id === targetMoveFolderId)?.name || 'folder') : 'Root Drive';
                showToast.success(`Moved folder "${movingItem.item.name}" to ${destName}.`);
            }

            setMovingItem(null);
        } catch (err: any) {
            console.error("Move Error:", err);
            showToast.error(`Failed to move item: ${err.message || 'Error'}`);
        } finally {
            setIsMoving(false);
        }
    };

    // Validation helper for drag-and-drop targets
    const isValidDropTarget = (targetFolderId: string | null): boolean => {
        if (!draggedDriveItem) return false;
        if (draggedDriveItem.type === 'file') {
            if (draggedDriveItem.customerId) {
                if (!targetFolderId || !targetFolderId.startsWith('customer:')) return false;
                const parts = targetFolderId.split(':');
                return parts[1] === draggedDriveItem.customerId && !!parts[2];
            }
            if (targetFolderId && (targetFolderId.startsWith('customer:') || targetFolderId.startsWith('system:'))) return false;
            return (draggedDriveItem.parentId || null) !== (targetFolderId || null);
        } else {
            if (targetFolderId && (targetFolderId.startsWith('customer:') || targetFolderId.startsWith('system:'))) return false;
            if (targetFolderId === draggedDriveItem.id) return false;
            if (draggedDriveItem.parentId === targetFolderId) return false;
            if (targetFolderId && isDescendantOf(targetFolderId, draggedDriveItem.id, folders)) return false;
            return true;
        }
    };

    // Direct move execution (for Drag & Drop)
    const handleDirectMove = async (
        item: { type: 'file' | 'folder'; id: string; name: string; parentId?: string | null; customerId?: string },
        targetFolderId: string | null
    ) => {
        if (!activeOrgId) return;
        try {
            if (item.type === 'file') {
                if (item.customerId) {
                    if (targetFolderId && targetFolderId.startsWith('customer:')) {
                        const parts = targetFolderId.split(':');
                        const cId = parts[1];
                        const cat = parts[2];
                        if (cId === item.customerId && cat) {
                            const targetCustomer = (state.customers || []).find(c => c.id === cId);
                            if (targetCustomer && targetCustomer.files) {
                                const updatedFiles = targetCustomer.files.map(f => {
                                    if (f.id === item.id) {
                                        return {
                                            ...f,
                                            metadata: { ...(f.metadata || {}), category: cat }
                                        };
                                    }
                                    return f;
                                });
                                await db.collection('customers').doc(cId).update(cleanUndefinedFields({
                                    files: updatedFiles,
                                    updatedAt: new Date().toISOString()
                                }));
                                dispatch({ type: 'UPDATE_CUSTOMER', payload: { ...targetCustomer, files: updatedFiles } });
                                showToast.success(`Moved "${item.name}" to ${cat}`);
                            }
                        }
                    }
                    return;
                }

                if ((item.parentId || null) === (targetFolderId || null)) return;

                await db.collection('organizations').doc(activeOrgId).collection('drive_files').doc(item.id).update(cleanUndefinedFields({
                    folderId: targetFolderId,
                    updatedAt: new Date().toISOString()
                }));
                const destName = targetFolderId ? (folders.find(f => f.id === targetFolderId)?.name || 'folder') : 'Root Drive';
                showToast.success(`Moved "${item.name}" to ${destName}`);
            } else {
                if (item.id === targetFolderId) {
                    showToast.error("Cannot move a folder into itself.");
                    return;
                }
                if (targetFolderId && isDescendantOf(targetFolderId, item.id, folders)) {
                    showToast.error("Cannot move a folder into one of its own child folders.");
                    return;
                }
                if ((item.parentId || null) === (targetFolderId || null)) return;

                await db.collection('organizations').doc(activeOrgId).collection('drive_folders').doc(item.id).update(cleanUndefinedFields({
                    parentId: targetFolderId,
                    updatedAt: new Date().toISOString()
                }));
                const destName = targetFolderId ? (folders.find(f => f.id === targetFolderId)?.name || 'folder') : 'Root Drive';
                showToast.success(`Moved folder "${item.name}" to ${destName}`);
            }
        } catch (err: any) {
            console.error("Direct move error:", err);
            showToast.error(`Move failed: ${err.message || 'Error'}`);
        }
    };

    const handleDownloadFile = async (file: any, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        const fileUrl = file.url || file.dataUrl;
        if (!fileUrl) {
            showToast.error("Download URL not found.");
            return;
        }

        let downloadName = file.label || file.fileName || 'document';
        if (!downloadName.includes('.') && file.fileType) {
            if (file.fileType.includes('pdf')) downloadName += '.pdf';
            else if (file.fileType.includes('jpeg') || file.fileType.includes('jpg')) downloadName += '.jpg';
            else if (file.fileType.includes('png')) downloadName += '.png';
        }

        try {
            if (fileUrl.startsWith('data:')) {
                const link = document.createElement('a');
                link.href = fileUrl;
                link.download = downloadName;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                showToast.success(`Downloading ${downloadName}`);
                return;
            }

            const response = await fetch(fileUrl, { mode: 'cors' });
            if (!response.ok) throw new Error("Fetch failed");
            const blob = await response.blob();
            const blobUrl = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = blobUrl;
            link.download = downloadName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(blobUrl);
            showToast.success(`Downloading ${downloadName}`);
        } catch (err) {
            const link = document.createElement('a');
            link.href = fileUrl;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            link.download = downloadName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    };

    return (
        <div className="space-y-6">
            {/* Header with Stats & Organization Badge */}
            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="flex items-center gap-3.5">
                        <button
                            type="button"
                            onClick={handleGoBack}
                            className="p-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-2xl transition-all flex items-center gap-1.5 text-xs font-bold shadow-xs cursor-pointer group shrink-0 border border-slate-200 dark:border-slate-700"
                            title={currentFolderId === null ? "Back to Dashboard" : "Back to Previous Level"}
                        >
                            <ArrowLeft size={18} className="group-hover:-translate-x-0.5 transition-transform" />
                            <span className="hidden sm:inline">{currentFolderId === null ? "Dashboard" : "Back"}</span>
                        </button>
                        <div className="p-3.5 bg-gradient-to-br from-[#123A63] to-[#0A2540] text-white rounded-2xl shadow-md">
                            <HardDrive size={28} />
                        </div>
                        <div>
                            <div className="flex items-center gap-2 flex-wrap">
                                <h2 className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                                    Organization Cloud Drive
                                </h2>
                                <span className="px-2.5 py-0.5 bg-sky-100 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 text-xs font-extrabold rounded-full">
                                    {activeOrg?.name || 'Company Shared Drive'}
                                </span>
                                <span className="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-[11px] font-bold rounded-full flex items-center gap-1">
                                    <ShieldCheck size={12} /> Multi-Tenant Isolated
                                </span>
                            </div>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-2xl">
                                Company-wide repository for SOPs, training manuals, fleet docs, licenses, and nested customer documents with granular access controls.
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2.5 flex-wrap">
                        {isAdmin && (
                            <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
                                <span className="text-[11px] font-bold text-slate-500">Perspective:</span>
                                <select
                                    aria-label="Preview perspective"
                                    title="Preview perspective"
                                    value={previewRole}
                                    onChange={(e) => setPreviewRole(e.target.value)}
                                    className="bg-transparent font-bold text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer"
                                >
                                    <option value="ACTUAL">Full Admin (All Files)</option>
                                    <option value="Technician">Field Technician</option>
                                    <option value="Dispatcher">Dispatcher / Office</option>
                                    <option value="Manager">Supervisor / Manager</option>
                                    <option value="employee">Standard Employee</option>
                                    <option value="Subcontractor">Subcontractor</option>
                                </select>
                            </div>
                        )}

                        <input 
                            ref={fileInputRef}
                            type="file" 
                            multiple 
                            className="hidden" 
                            onChange={(e) => {
                                if (e.target.files) handleFilesSelected(e.target.files);
                            }}
                        />

                        {isAdmin && !currentFolderId?.startsWith('customer:') && currentFolderId !== 'system:customers' && (
                            <Button 
                                onClick={() => {
                                    setEditingFolder(null);
                                    setFolderFormName('');
                                    setFolderFormColor('amber');
                                    setFolderFormAccessLevel('all_staff');
                                    setFolderFormRoles([]);
                                    setFolderFormDescription('');
                                    setIsCreateFolderOpen(true);
                                }}
                                variant="secondary"
                                className="text-xs font-bold px-3.5 py-2 rounded-xl flex items-center gap-1.5 cursor-pointer shadow-xs"
                            >
                                <FolderPlus size={16} className="text-amber-500" />
                                <span>New Folder</span>
                            </Button>
                        )}

                        <Button 
                            onClick={() => fileInputRef.current?.click()}
                            className="bg-[#123A63] hover:bg-[#0A2540] text-white text-xs font-bold px-4 py-2 rounded-xl shadow-sm flex items-center gap-2 cursor-pointer transition-all"
                        >
                            <UploadCloud size={16} />
                            <span>
                                {activeCustomerContext?.customer ? `Upload to ${activeCustomerContext.customer.name}` : 'Upload Files'}
                            </span>
                        </Button>
                    </div>
                </div>

                {/* Storage Metrics Row */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-slate-100 dark:border-slate-800/80 text-xs">
                    <div className="bg-slate-50 dark:bg-slate-800/40 p-2.5 rounded-xl border border-slate-150 dark:border-slate-800">
                        <div className="text-slate-400 dark:text-slate-500 text-[10px] font-bold uppercase tracking-wider">Company Folders</div>
                        <div className="text-sm font-extrabold text-slate-800 dark:text-slate-200 mt-0.5">
                            {driveMetrics.totalCompanyFolders} Custom Folders
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5 truncate">
                            + 📁 Customers Directory
                        </div>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-800/40 p-2.5 rounded-xl border border-slate-150 dark:border-slate-800">
                        <div className="text-slate-400 dark:text-slate-500 text-[10px] font-bold uppercase tracking-wider">Customer Accounts</div>
                        <div className="text-sm font-extrabold text-slate-800 dark:text-slate-200 mt-0.5">
                            {driveMetrics.totalCustomerAccounts} Accounts
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5 truncate" title={`${driveMetrics.directCustomerFiles} Drive Docs • ${driveMetrics.jobFilesCount} Visit Media`}>
                            {driveMetrics.directCustomerFiles} Drive Docs &bull; {driveMetrics.jobFilesCount} Visit Media
                        </div>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-800/40 p-2.5 rounded-xl border border-slate-150 dark:border-slate-800">
                        <div className="text-slate-400 dark:text-slate-500 text-[10px] font-bold uppercase tracking-wider">Total Drive Files</div>
                        <div className="text-sm font-extrabold text-primary-600 dark:text-primary-400 mt-0.5">
                            {driveMetrics.totalFiles} Files
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5 truncate">
                            {driveMetrics.totalCompanyFiles} Company &bull; {driveMetrics.totalCustomerFiles} Customer
                        </div>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-800/40 p-2.5 rounded-xl border border-slate-150 dark:border-slate-800">
                        <div className="text-slate-400 dark:text-slate-500 text-[10px] font-bold uppercase tracking-wider">Cloud Storage Used</div>
                        <div className="text-sm font-extrabold text-[#123A63] dark:text-sky-400 mt-0.5">
                            {formatBytes(driveMetrics.totalBytes)}
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5 truncate">
                            {formatBytes(driveMetrics.companyBytes)} Co. &bull; {formatBytes(driveMetrics.customerBytes)} Cust.
                        </div>
                    </div>
                </div>
            </div>

            {/* Interactive Breadcrumb Navigation Bar */}
            <div className="bg-white dark:bg-slate-900 px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between gap-3 overflow-x-auto custom-scrollbar">
                <div className="flex items-center gap-1.5 text-xs flex-nowrap shrink-0">
                    {currentFolderId !== null && (
                        <button
                            type="button"
                            onClick={handleGoBack}
                            className="px-2.5 py-1 rounded-lg font-bold transition-all flex items-center gap-1 cursor-pointer text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-xs shrink-0 mr-1 shadow-xs"
                            title="Go up one level"
                        >
                            <ArrowLeft size={13} />
                            <span>Up</span>
                        </button>
                    )}
                    {breadcrumbPath.map((crumb, idx) => {
                        const isLast = idx === breadcrumbPath.length - 1;
                        const isCrumbDropTarget = dropTargetFolderId === `crumb-${crumb.id || 'root'}`;
                        const canDropOnCrumb = !!(draggedDriveItem && !isLast && isValidDropTarget(crumb.id));

                        return (
                            <React.Fragment key={crumb.id || 'root'}>
                                {idx > 0 && <ChevronRight size={14} className="text-slate-400 shrink-0" />}
                                <button
                                    type="button"
                                    onClick={() => setCurrentFolderId(crumb.id)}
                                    onDragOver={(e) => {
                                        if (canDropOnCrumb) {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            setDropTargetFolderId(`crumb-${crumb.id || 'root'}`);
                                        }
                                    }}
                                    onDragLeave={(e) => {
                                        e.stopPropagation();
                                        if (dropTargetFolderId === `crumb-${crumb.id || 'root'}`) {
                                            setDropTargetFolderId(null);
                                        }
                                    }}
                                    onDrop={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        if (canDropOnCrumb && draggedDriveItem) {
                                            handleDirectMove(draggedDriveItem, crumb.id);
                                        }
                                        setDropTargetFolderId(null);
                                        setDraggedDriveItem(null);
                                    }}
                                    className={`px-2.5 py-1 rounded-lg font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                                        isCrumbDropTarget
                                            ? 'bg-sky-500 text-white shadow-md ring-2 ring-sky-400 scale-105'
                                            : isLast 
                                            ? 'bg-slate-100 dark:bg-slate-800 text-[#123A63] dark:text-sky-400 shadow-xs' 
                                            : 'text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/50'
                                    }`}
                                >
                                    {idx === 0 ? (
                                        <HardDrive size={14} className={isCrumbDropTarget ? 'text-white' : 'text-sky-600'} />
                                    ) : crumb.id === 'system:customers' ? (
                                        <Users size={14} className={isCrumbDropTarget ? 'text-white' : 'text-sky-600'} />
                                    ) : crumb.id?.startsWith('customer:') && !crumb.id.split(':')[2] ? (
                                        <Building2 size={14} className={isCrumbDropTarget ? 'text-white' : 'text-indigo-600'} />
                                    ) : (
                                        <FolderOpen size={14} className={isCrumbDropTarget ? 'text-white' : 'text-amber-500'} />
                                    )}
                                    <span>{crumb.name}</span>
                                </button>
                            </React.Fragment>
                        );
                    })}
                </div>

                {activeCustomerContext?.customer && (
                    <div className="flex items-center gap-2 shrink-0">
                        <Button
                            onClick={() => setActiveCustomerModalId(activeCustomerContext.customerId)}
                            variant="secondary"
                            className="text-xs flex items-center gap-1.5 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800 font-bold"
                        >
                            <ExternalLink size={13} />
                            <span>Open {activeCustomerContext.customer.name}&apos;s Profile</span>
                        </Button>
                    </div>
                )}
            </div>

            {/* Drag & Drop Main Zone */}
            <div 
                onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                onDragLeave={(e) => { e.preventDefault(); setIsDragOver(false); }}
                onDrop={(e) => {
                    e.preventDefault();
                    setIsDragOver(false);
                    if (e.dataTransfer.files) {
                        handleFilesSelected(e.dataTransfer.files);
                    }
                }}
                className={`transition-all duration-200 rounded-2xl border-2 border-dashed p-4 text-center cursor-pointer ${
                    isDragOver 
                        ? 'border-primary-500 bg-primary-500/10 scale-[0.99] shadow-inner' 
                        : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 hover:border-primary-400 hover:bg-primary-50/20'
                }`}
                onClick={() => fileInputRef.current?.click()}
            >
                <div className="flex flex-col sm:flex-row items-center justify-center gap-3 py-2">
                    <div className="p-2.5 bg-sky-100 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 rounded-full">
                        <UploadCloud size={20} />
                    </div>
                    <div className="text-left text-xs">
                        <span className="font-bold text-slate-800 dark:text-slate-200">
                            Drop documents into <span className="text-[#123A63] dark:text-sky-400 font-extrabold">{breadcrumbPath[breadcrumbPath.length - 1]?.name || 'Root Drive'}</span>, or <span className="underline text-sky-600">browse device</span>
                        </span>
                        <p className="text-slate-400 text-[11px] mt-0.5">
                            {activeCustomerContext?.customer 
                                ? `Files will be stored directly under ${activeCustomerContext.customer.name}'s account records.`
                                : 'Upload company PDFs, manuals, Word/Excel templates, licenses, safety guidelines, and SOPs.'}
                        </p>
                    </div>
                </div>
            </div>

            {/* Search, Filters, and View Switcher Toolbar */}
            <div className="bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col md:flex-row items-center justify-between gap-3">
                <div className="flex items-center gap-2 w-full md:w-auto flex-1 max-w-md">
                    <div className="relative w-full">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input 
                            type="text"
                            placeholder="Search title, customer name, tags..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-8 pr-8 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-1 focus:ring-primary-500 text-slate-900 dark:text-white placeholder:text-slate-400"
                        />
                        {searchTerm && (
                            <button 
                                type="button" 
                                onClick={() => setSearchTerm('')} 
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                            >
                                <X size={12} />
                            </button>
                        )}
                    </div>

                    <select
                        aria-label="Search Scope"
                        title="Search Scope"
                        value={searchScope}
                        onChange={(e) => setSearchScope(e.target.value as any)}
                        className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2 py-1.5 text-xs text-slate-700 dark:text-slate-200 focus:outline-none cursor-pointer shrink-0"
                    >
                        <option value="current">In Folder</option>
                        <option value="all">Entire Drive &amp; Customers</option>
                    </select>
                </div>

                <div className="flex items-center gap-2 flex-wrap w-full md:w-auto justify-end text-xs">
                    <select
                        aria-label="Filter by file type"
                        title="Filter by file type"
                        value={fileTypeFilter}
                        onChange={(e) => setFileTypeFilter(e.target.value)}
                        className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-slate-700 dark:text-slate-200 cursor-pointer focus:outline-none"
                    >
                        <option value="ALL">All File Types</option>
                        <option value="pdf">PDF Documents</option>
                        <option value="image">Images &amp; Photos</option>
                        <option value="office">Word / Excel / Office</option>
                        <option value="other">Other Formats</option>
                    </select>

                    <select
                        aria-label="Sort documents"
                        title="Sort documents"
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value as any)}
                        className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-slate-700 dark:text-slate-200 cursor-pointer focus:outline-none"
                    >
                        <option value="name_asc">Name (A &rarr; Z)</option>
                        <option value="name_desc">Name (Z &rarr; A)</option>
                        <option value="date_desc">Newest First</option>
                        <option value="date_asc">Oldest First</option>
                        <option value="size_desc">Size (Largest)</option>
                        <option value="size_asc">Size (Smallest)</option>
                    </select>

                    <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-xl border border-slate-200 dark:border-slate-700">
                        <button
                            type="button"
                            onClick={() => setViewMode('grid')}
                            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                                viewMode === 'grid' 
                                    ? 'bg-white dark:bg-slate-700 text-[#123A63] dark:text-sky-400 shadow-xs' 
                                    : 'text-slate-400 hover:text-slate-600'
                            }`}
                            title="Grid View"
                        >
                            <Grid size={14} />
                        </button>
                        <button
                            type="button"
                            onClick={() => setViewMode('list')}
                            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                                viewMode === 'list' 
                                    ? 'bg-white dark:bg-slate-700 text-[#123A63] dark:text-sky-400 shadow-xs' 
                                    : 'text-slate-400 hover:text-slate-600'
                            }`}
                            title="List View"
                        >
                            <List size={14} />
                        </button>
                    </div>
                </div>
            </div>

            {/* FOLDERS SECTION */}
            {visibleSubfolders.length > 0 && (
                <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold uppercase text-slate-400 dark:text-slate-500 tracking-wider">
                            Folders ({visibleSubfolders.length})
                        </h4>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5">
                        {visibleSubfolders.map(folder => {
                            const counts = getFolderItemCounts(folder.id);
                            const accessInfo = ACCESS_LEVEL_LABELS[folder.accessLevel] || ACCESS_LEVEL_LABELS.all_staff;
                            const folderColorConfig = FOLDER_COLORS.find(c => c.value === folder.color) || FOLDER_COLORS[0];
                            const isSystemFolder = (folder as any).isSystemFolder;
                            const isCustomerFolder = (folder as any).isCustomerFolder;
                            const isDraggable = !isSystemFolder && !isCustomerFolder && !(folder as any).isCustomerCategoryFolder;
                            const isDropTarget = dropTargetFolderId === folder.id;
                            const canDropOnThisFolder = !!(draggedDriveItem && isValidDropTarget(folder.id));

                            return (
                                <div
                                    key={folder.id}
                                    draggable={isDraggable}
                                    onDragStart={(e) => {
                                        if (!isDraggable) return;
                                        e.dataTransfer.setData('text/plain', folder.id);
                                        setDraggedDriveItem({
                                            type: 'folder',
                                            id: folder.id,
                                            name: folder.name,
                                            parentId: folder.parentId
                                        });
                                    }}
                                    onDragEnd={() => {
                                        setDraggedDriveItem(null);
                                        setDropTargetFolderId(null);
                                    }}
                                    onDragOver={(e) => {
                                        if (canDropOnThisFolder) {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            setDropTargetFolderId(folder.id);
                                        }
                                    }}
                                    onDragLeave={(e) => {
                                        e.stopPropagation();
                                        if (dropTargetFolderId === folder.id) {
                                            setDropTargetFolderId(null);
                                        }
                                    }}
                                    onDrop={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        if (canDropOnThisFolder && draggedDriveItem) {
                                            handleDirectMove(draggedDriveItem, folder.id);
                                        }
                                        setDropTargetFolderId(null);
                                        setDraggedDriveItem(null);
                                    }}
                                    onClick={() => setCurrentFolderId(folder.id)}
                                    className={`p-4 rounded-2xl border transition-all cursor-pointer group flex flex-col justify-between relative ${
                                        isDropTarget
                                            ? 'ring-2 ring-sky-500 bg-sky-50 dark:bg-sky-950/60 shadow-lg scale-[1.02] border-sky-400'
                                            : isSystemFolder
                                            ? 'bg-gradient-to-br from-sky-50 to-indigo-50/50 dark:from-sky-950/30 dark:to-indigo-950/20 border-sky-300 dark:border-sky-800 shadow-xs hover:shadow-md hover:border-sky-500'
                                            : isCustomerFolder
                                            ? 'bg-white dark:bg-slate-900 border-indigo-200 dark:border-indigo-900/60 hover:border-indigo-500 hover:shadow-md'
                                            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-sky-500/50 hover:shadow-md'
                                    }`}
                                >
                                    {isDropTarget && (
                                        <div className="absolute inset-0 bg-sky-500/10 backdrop-blur-2xs rounded-2xl flex items-center justify-center pointer-events-none z-10 border-2 border-dashed border-sky-500">
                                            <span className="px-2.5 py-1 bg-sky-600 text-white rounded-lg text-xs font-bold shadow-md flex items-center gap-1.5 animate-pulse">
                                                <CornerDownRight size={13} /> Drop to Move Here
                                            </span>
                                        </div>
                                    )}
                                    <div className="flex items-start justify-between gap-2 mb-2">
                                        <div className="flex items-center gap-3">
                                            <div className={`p-2.5 rounded-xl border ${
                                                isSystemFolder 
                                                    ? 'bg-sky-500 text-white border-sky-600 shadow-sm'
                                                    : isCustomerFolder
                                                    ? 'bg-indigo-500/10 text-indigo-600 border-indigo-300'
                                                    : folderColorConfig.bg
                                            }`}>
                                                {isSystemFolder ? <Users size={20} /> : isCustomerFolder ? <Building2 size={20} /> : <Folder size={20} />}
                                            </div>
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-1.5">
                                                    <h5 className="text-xs font-bold text-slate-900 dark:text-white truncate group-hover:text-sky-600 transition-colors" title={folder.name}>
                                                        {folder.name}
                                                    </h5>
                                                </div>
                                                <p className="text-[10px] text-slate-400 mt-0.5 truncate">
                                                    {(folder as any).badgeText || `${counts.filesCount} files`}
                                                </p>
                                            </div>
                                        </div>

                                        {isAdmin && !isSystemFolder && !isCustomerFolder && !(folder as any).isCustomerCategoryFolder && (
                                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                                                <button
                                                    type="button"
                                                    onClick={(e) => handleOpenMove(folder, 'folder', e)}
                                                    className="p-1 hover:text-sky-600 text-slate-400 transition-colors cursor-pointer"
                                                    title="Move Folder"
                                                >
                                                    <Move size={12} />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={(e) => handleOpenPermissions(folder, 'folder', e)}
                                                    className="p-1 hover:text-sky-600 text-slate-400 transition-colors cursor-pointer"
                                                    title="Access Permissions"
                                                >
                                                    <Lock size={12} />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={(e) => handleOpenEditFolder(folder, e)}
                                                    className="p-1 hover:text-sky-600 text-slate-400 transition-colors cursor-pointer"
                                                    title="Rename / Edit"
                                                >
                                                    <Edit3 size={12} />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={(e) => handleDeleteFolder(folder, e)}
                                                    className="p-1 hover:text-red-600 text-slate-400 transition-colors cursor-pointer"
                                                    title="Delete Folder"
                                                >
                                                    <Trash2 size={12} />
                                                </button>
                                            </div>
                                        )}

                                        {isCustomerFolder && (
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setActiveCustomerModalId((folder as any).customerId);
                                                }}
                                                className="p-1.5 text-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded-lg transition-colors"
                                                title="Open Customer Profile"
                                            >
                                                <ExternalLink size={13} />
                                            </button>
                                        )}
                                    </div>

                                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[10px]">
                                        <span className={`px-2 py-0.5 rounded-md font-bold truncate max-w-[150px] ${
                                            isSystemFolder 
                                                ? 'bg-sky-100 dark:bg-sky-950/80 text-sky-800 dark:text-sky-300'
                                                : isCustomerFolder
                                                ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300'
                                                : accessInfo.color
                                        }`}>
                                            {isSystemFolder ? 'System Directory' : isCustomerFolder ? 'Customer Account' : accessInfo.label}
                                        </span>
                                        <ChevronRight size={12} className="text-slate-300 group-hover:translate-x-0.5 transition-transform" />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* FILES SECTION */}
            <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase text-slate-400 dark:text-slate-500 tracking-wider">
                        Files ({visibleFiles.length})
                    </h4>
                </div>

                {visibleFiles.length === 0 && visibleSubfolders.length === 0 ? (
                    <div className="text-center py-16 bg-white dark:bg-slate-900 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl p-6">
                        <div className="p-4 bg-slate-100 dark:bg-slate-800 rounded-full w-16 h-16 mx-auto flex items-center justify-center text-slate-400 mb-3">
                            <FolderOpen size={32} />
                        </div>
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white">This folder is empty</h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
                            {searchTerm || fileTypeFilter !== 'ALL' || accessLevelFilter !== 'ALL'
                                ? 'No documents matched your active search or filters.'
                                : 'Upload company documents, policies, or create subfolders to organize this directory.'}
                        </p>
                        <div className="mt-4 flex items-center justify-center gap-2">
                            <Button 
                                onClick={() => fileInputRef.current?.click()}
                                className="bg-[#123A63] text-white text-xs font-bold"
                            >
                                <UploadCloud size={14} className="mr-1.5" /> Upload Documents
                            </Button>
                        </div>
                    </div>
                ) : visibleFiles.length === 0 ? (
                    <div className="text-center py-8 bg-slate-50/50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-400">
                        No direct files in this view. Browse the folders above or upload a document.
                    </div>
                ) : viewMode === 'grid' ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {visibleFiles.map(file => {
                            const fileSrc = file.url || file.dataUrl || '';
                            const typeInfo = detectFileType(fileSrc, file.fileName, file.fileType);
                            const displayTitle = file.label || file.fileName;
                            const accessInfo = ACCESS_LEVEL_LABELS[file.accessLevel] || ACCESS_LEVEL_LABELS.all_staff;
                            const tags: string[] = Array.isArray(file.tags) ? file.tags : [];
                            const isCustomerFile = !!file.customerId;

                            return (
                                <div 
                                    key={file.id}
                                    draggable={true}
                                    onDragStart={(e) => {
                                        e.dataTransfer.setData('text/plain', file.id);
                                        setDraggedDriveItem({
                                            type: 'file',
                                            id: file.id,
                                            name: displayTitle,
                                            parentId: file.folderId,
                                            customerId: file.customerId
                                        });
                                    }}
                                    onDragEnd={() => {
                                        setDraggedDriveItem(null);
                                        setDropTargetFolderId(null);
                                    }}
                                    className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-sky-500/50 hover:shadow-md transition-all flex flex-col justify-between overflow-hidden group cursor-grab active:cursor-grabbing"
                                >
                                    <div 
                                        className="h-36 bg-slate-100 dark:bg-slate-800/60 relative cursor-pointer overflow-hidden flex items-center justify-center border-b border-slate-100 dark:border-slate-800"
                                        onClick={() => setPreviewingFile(file)}
                                    >
                                        {typeInfo.isImage ? (
                                            <img 
                                                src={fileSrc} 
                                                alt={displayTitle} 
                                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" 
                                            />
                                        ) : (
                                            <div className="flex flex-col items-center justify-center p-4 text-center">
                                                {renderFileTypeIcon(file, "w-12 h-12 mb-2")}
                                                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                                                    {typeInfo.extension ? typeInfo.extension.toUpperCase() : 'DOCUMENT'}
                                                </span>
                                            </div>
                                        )}

                                        <div className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 backdrop-blur-xs">
                                            <button
                                                type="button"
                                                onClick={(e) => { e.stopPropagation(); setPreviewingFile(file); }}
                                                className="p-2 bg-white/90 hover:bg-white text-slate-900 rounded-full shadow-md transition-transform hover:scale-110 cursor-pointer"
                                                title="Quick Preview"
                                            >
                                                <Eye size={14} />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={(e) => handleDownloadFile(file, e)}
                                                className="p-2 bg-white/90 hover:bg-white text-slate-900 rounded-full shadow-md transition-transform hover:scale-110 cursor-pointer"
                                                title="Download File"
                                            >
                                                <Download size={14} />
                                            </button>
                                            {isAdmin && !isCustomerFile && (
                                                <button
                                                    type="button"
                                                    onClick={(e) => handleOpenPermissions(file, 'file', e)}
                                                    className="p-2 bg-white/90 hover:bg-white text-slate-900 rounded-full shadow-md transition-transform hover:scale-110 cursor-pointer"
                                                    title="Access Permissions"
                                                >
                                                    <Lock size={14} />
                                                </button>
                                            )}
                                        </div>

                                        <div className="absolute top-2 left-2 flex items-center gap-1">
                                            {isCustomerFile ? (
                                                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-600/90 text-white backdrop-blur-md shadow-xs flex items-center gap-1">
                                                    <Building2 size={10} /> {file.customerName}
                                                </span>
                                            ) : file.isLocked ? (
                                                <span className="p-1 bg-amber-500 text-white rounded-md shadow-xs flex items-center" title="Document Locked">
                                                    <Lock size={11} />
                                                </span>
                                            ) : null}
                                        </div>

                                        <div className="absolute top-2 right-2">
                                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold backdrop-blur-md shadow-xs max-w-[130px] truncate block ${
                                                isCustomerFile
                                                    ? 'bg-white/90 dark:bg-slate-900/90 text-slate-700 dark:text-slate-300'
                                                    : accessInfo.color
                                            }`}>
                                                {isCustomerFile ? file.originCategory : accessInfo.label}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="p-3.5 space-y-2 flex-1 flex flex-col justify-between">
                                        <div>
                                            <h5 
                                                onClick={() => setPreviewingFile(file)}
                                                className="text-xs font-bold text-slate-900 dark:text-white truncate cursor-pointer hover:text-sky-600 transition-colors"
                                                title={displayTitle}
                                            >
                                                {displayTitle}
                                            </h5>
                                            {file.label && file.fileName && file.label !== file.fileName && (
                                                <p className="text-[10px] text-slate-400 truncate mt-0.5" title={file.fileName}>
                                                    {file.fileName}
                                                </p>
                                            )}

                                            {file.description && (
                                                <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 mt-1 italic">
                                                    {file.description}
                                                </p>
                                            )}

                                            {tags.length > 0 && (
                                                <div className="flex items-center gap-1 flex-wrap mt-2">
                                                    {tags.slice(0, 3).map((tag, idx) => (
                                                        <span key={idx} className="inline-flex items-center gap-0.5 text-[9px] font-semibold px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded">
                                                            <Tag size={8} /> {tag}
                                                        </span>
                                                    ))}
                                                    {tags.length > 3 && (
                                                        <span className="text-[9px] text-slate-400 font-bold">
                                                            +{tags.length - 3}
                                                        </span>
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                        <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[10px] text-slate-400">
                                            <div className="flex items-center gap-2">
                                                <span>{new Date(file.createdAt || 0).toLocaleDateString()}</span>
                                                <span>&bull;</span>
                                                <span>{formatBytes(file.sizeBytes)}</span>
                                            </div>

                                            <div className="flex items-center gap-1">
                                                <button
                                                    type="button"
                                                    onClick={(e) => handleDownloadFile(file, e)}
                                                    className="p-1 hover:text-sky-600 transition-colors cursor-pointer"
                                                    title="Download"
                                                >
                                                    <Download size={13} />
                                                </button>
                                                {isAdmin && (
                                                    <button
                                                        type="button"
                                                        onClick={(e) => handleOpenMove(file, 'file', e)}
                                                        className="p-1 hover:text-sky-600 transition-colors cursor-pointer"
                                                        title={isCustomerFile ? "Move to Category" : "Move to Folder"}
                                                    >
                                                        <Move size={13} />
                                                    </button>
                                                )}
                                                {isAdmin && (
                                                    <button
                                                        type="button"
                                                        onClick={(e) => handleDeleteFile(file, e)}
                                                        className="p-1 hover:text-red-600 transition-colors cursor-pointer"
                                                        title="Delete"
                                                    >
                                                        <Trash2 size={13} />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs">
                                <thead className="bg-slate-50 dark:bg-slate-800/50 text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500 border-b border-slate-200 dark:border-slate-800">
                                    <tr>
                                        <th className="px-4 py-3">Document</th>
                                        <th className="px-4 py-3">Category / Level</th>
                                        <th className="px-4 py-3">Account / Location</th>
                                        <th className="px-4 py-3">Size</th>
                                        <th className="px-4 py-3">Uploaded By</th>
                                        <th className="px-4 py-3">Date Added</th>
                                        <th className="px-4 py-3 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {visibleFiles.map(file => {
                                        const displayTitle = file.label || file.fileName;
                                        const accessInfo = ACCESS_LEVEL_LABELS[file.accessLevel] || ACCESS_LEVEL_LABELS.all_staff;
                                        const isCustomerFile = !!file.customerId;

                                        return (
                                            <tr
                                                key={file.id}
                                                draggable={true}
                                                onDragStart={(e) => {
                                                    e.dataTransfer.setData('text/plain', file.id);
                                                    setDraggedDriveItem({
                                                        type: 'file',
                                                        id: file.id,
                                                        name: displayTitle,
                                                        parentId: file.folderId,
                                                        customerId: file.customerId
                                                    });
                                                }}
                                                onDragEnd={() => {
                                                    setDraggedDriveItem(null);
                                                    setDropTargetFolderId(null);
                                                }}
                                                className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors cursor-pointer group cursor-grab active:cursor-grabbing"
                                                onClick={() => setPreviewingFile(file)}
                                            >
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center gap-2.5">
                                                        {renderFileTypeIcon(file, "w-5 h-5 shrink-0")}
                                                        <div className="min-w-0 max-w-sm">
                                                            <div className="flex items-center gap-1.5">
                                                                <p className="font-bold text-slate-900 dark:text-white truncate group-hover:text-sky-600 transition-colors">
                                                                    {displayTitle}
                                                                </p>
                                                                {file.isLocked && <Lock size={11} className="text-amber-500 shrink-0" />}
                                                            </div>
                                                            {file.label && file.fileName && file.label !== file.fileName && (
                                                                <p className="text-[10px] text-slate-400 truncate">
                                                                    {file.fileName}
                                                                </p>
                                                            )}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                                        isCustomerFile ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300' : accessInfo.color
                                                    }`}>
                                                        {isCustomerFile ? file.originCategory : accessInfo.label}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                                                    {isCustomerFile ? (
                                                        <span className="font-bold text-slate-700 dark:text-slate-300">
                                                            {file.customerName}
                                                        </span>
                                                    ) : (
                                                        'Company Drive'
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                                                    {formatBytes(file.sizeBytes)}
                                                </td>
                                                <td className="px-4 py-3 text-slate-500 dark:text-slate-400 truncate max-w-[120px]">
                                                    {file.createdBy || 'Staff'}
                                                </td>
                                                <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                                                    {new Date(file.createdAt || 0).toLocaleDateString()}
                                                </td>
                                                <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                                                    <div className="flex items-center justify-end gap-1.5">
                                                        <button
                                                            type="button"
                                                            onClick={() => setPreviewingFile(file)}
                                                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors"
                                                            title="Preview"
                                                        >
                                                            <Eye size={13} />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={(e) => handleDownloadFile(file, e)}
                                                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors"
                                                            title="Download"
                                                        >
                                                            <Download size={13} />
                                                        </button>
                                                        {isAdmin && !isCustomerFile && (
                                                            <button
                                                                type="button"
                                                                onClick={(e) => handleOpenPermissions(file, 'file', e)}
                                                                className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors"
                                                                title="Permissions"
                                                            >
                                                                <Lock size={13} />
                                                            </button>
                                                        )}
                                                        {isAdmin && (
                                                            <button
                                                                type="button"
                                                                onClick={(e) => handleOpenMove(file, 'file', e)}
                                                                className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors"
                                                                title={isCustomerFile ? "Move to Category" : "Move to Folder"}
                                                            >
                                                                <Move size={13} />
                                                            </button>
                                                        )}
                                                        {isAdmin && (
                                                            <button
                                                                type="button"
                                                                onClick={(e) => handleDeleteFile(file, e)}
                                                                className="p-1.5 rounded-lg bg-red-50 hover:bg-red-100 dark:bg-red-950/40 dark:hover:bg-red-900/60 text-red-600 transition-colors"
                                                                title="Delete"
                                                            >
                                                                <Trash2 size={13} />
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>

            {/* CREATE / EDIT FOLDER MODAL */}
            <Modal
                isOpen={isCreateFolderOpen}
                onClose={() => setIsCreateFolderOpen(false)}
                title={editingFolder ? 'Edit Folder Settings' : 'Create New Folder'}
                size="md"
            >
                <div className="space-y-4 p-1">
                    <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                            Folder Name *
                        </label>
                        <input
                            type="text"
                            value={folderFormName}
                            onChange={(e) => setFolderFormName(e.target.value)}
                            placeholder="e.g. OSHA Safety Guidelines 2026"
                            className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                            Folder Color Tag
                        </label>
                        <div className="flex items-center gap-2 flex-wrap">
                            {FOLDER_COLORS.map(c => (
                                <button
                                    key={c.value}
                                    type="button"
                                    onClick={() => setFolderFormColor(c.value)}
                                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 cursor-pointer ${
                                        folderFormColor === c.value
                                            ? 'ring-2 ring-primary-500 font-extrabold shadow-xs ' + c.bg
                                            : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                                    }`}
                                >
                                    <Folder size={14} />
                                    <span>{c.name}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                            Default Access Control Level *
                        </label>
                        <select
                            aria-label="Access Control Level"
                            title="Access Control Level"
                            value={folderFormAccessLevel}
                            onChange={(e) => setFolderFormAccessLevel(e.target.value as DriveAccessLevel)}
                            className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                        >
                            <option value="all_staff">All Organization Staff</option>
                            <option value="management_only">Management &amp; Supervisors Only</option>
                            <option value="technicians_only">Field Techs &amp; Operations</option>
                            <option value="office_only">Office Staff &amp; Dispatch</option>
                            <option value="admins_only">Admins &amp; Master Admins Only</option>
                            <option value="custom_roles">Custom Role Selection...</option>
                        </select>
                        <p className="text-[10px] text-slate-400 mt-1">
                            {ACCESS_LEVEL_LABELS[folderFormAccessLevel]?.desc}
                        </p>
                    </div>

                    {folderFormAccessLevel === 'custom_roles' && (
                        <div>
                            <label className="block text-xs font-bold text-purple-600 dark:text-purple-400 mb-1.5">
                                Select Allowed Roles:
                            </label>
                            <div className="grid grid-cols-2 gap-2 bg-purple-50/50 dark:bg-purple-950/20 p-3 rounded-xl border border-purple-200 dark:border-purple-800">
                                {AVAILABLE_COMPANY_ROLES.map(role => {
                                    const checked = folderFormRoles.includes(role);
                                    return (
                                        <label key={role} className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
                                            <input 
                                                type="checkbox"
                                                checked={checked}
                                                onChange={() => {
                                                    if (checked) {
                                                        setFolderFormRoles(folderFormRoles.filter(r => r !== role));
                                                    } else {
                                                        setFolderFormRoles([...folderFormRoles, role]);
                                                    }
                                                }}
                                                className="rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                                            />
                                            <span>{role}</span>
                                        </label>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                            Description / Guidelines (Optional)
                        </label>
                        <Textarea
                            value={folderFormDescription}
                            onChange={(e) => setFolderFormDescription(e.target.value)}
                            placeholder="Add context about documents stored in this folder..."
                            rows={2}
                        />
                    </div>

                    <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                        <Button variant="secondary" onClick={() => setIsCreateFolderOpen(false)}>
                            Cancel
                        </Button>
                        <Button onClick={handleSaveFolder} className="bg-[#123A63] hover:bg-[#0A2540] text-white font-bold">
                            {editingFolder ? 'Save Changes' : 'Create Folder'}
                        </Button>
                    </div>
                </div>
            </Modal>

            {/* UPLOAD & LABEL MODAL */}
            <Modal
                isOpen={isUploadModalOpen}
                onClose={() => !isUploading && setIsUploadModalOpen(false)}
                title={activeCustomerContext?.customer ? `Upload to ${activeCustomerContext.customer.name}` : 'Upload to Organization Drive'}
                size="lg"
            >
                <div className="space-y-5 p-1">
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                        {activeCustomerContext?.customer
                            ? `Files uploaded here will be stored directly in ${activeCustomerContext.customer.name}'s Document Drive.`
                            : 'Configure document labels, destination folder, and tags before storing in the organization drive.'}
                    </p>

                    {/* TOP DESTINATION BANNER (For Organization Drive) */}
                    {!activeCustomerContext?.customer && (
                        <div className="p-3.5 bg-gradient-to-r from-sky-50 to-indigo-50/50 dark:from-sky-950/30 dark:to-indigo-950/20 rounded-2xl border border-sky-200 dark:border-sky-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-sky-500 text-white rounded-xl shadow-xs">
                                    <FolderOpen size={18} />
                                </div>
                                <div className="min-w-0">
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                                        Upload Destination
                                    </span>
                                    <div className="flex items-center gap-1.5 text-xs font-extrabold text-slate-900 dark:text-white mt-0.5 truncate">
                                        <span>📁</span>
                                        <span className="truncate">{getFolderDisplayPath(globalUploadFolderId, folders)}</span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                                <Button
                                    type="button"
                                    variant="secondary"
                                    onClick={() => handleOpenFolderPicker(null)}
                                    className="text-xs font-bold px-3 py-1.5 rounded-xl flex items-center gap-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-xs hover:border-sky-500 cursor-pointer"
                                >
                                    <FolderPlus size={14} className="text-sky-600" />
                                    <span>Browse / Drill Down</span>
                                </Button>
                            </div>
                        </div>
                    )}

                    <div className="space-y-4 max-h-[60vh] overflow-y-auto custom-scrollbar pr-1">
                        {pendingUploads.map((item, idx) => (
                            <div key={idx} className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <FileText size={16} className="text-[#123A63] dark:text-sky-400 shrink-0" />
                                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate max-w-xs">
                                            {item.file.name}
                                        </span>
                                    </div>
                                    <span className="text-[10px] text-slate-400 font-semibold">
                                        {formatBytes(item.file.size)}
                                    </span>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                                            Document Title / Label *
                                        </label>
                                        <input
                                            type="text"
                                            value={item.title}
                                            onChange={(e) => {
                                                const updated = [...pendingUploads];
                                                updated[idx].title = e.target.value;
                                                setPendingUploads(updated);
                                            }}
                                            placeholder="e.g. Signed Service Agreement 2026"
                                            className="w-full text-xs p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                                        />
                                    </div>

                                    {activeCustomerContext?.customer ? (
                                        <div>
                                            <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                                                Customer Category *
                                            </label>
                                            <select
                                                aria-label="Customer Category"
                                                title="Customer Category"
                                                value={item.customerCategory || 'General Documents'}
                                                onChange={(e) => {
                                                    const updated = [...pendingUploads];
                                                    updated[idx].customerCategory = e.target.value;
                                                    setPendingUploads(updated);
                                                }}
                                                className="w-full text-xs p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                                            >
                                                {CUSTOMER_PRESET_CATEGORIES.map(cat => (
                                                    <option key={cat} value={cat}>{cat}</option>
                                                ))}
                                            </select>
                                        </div>
                                    ) : (
                                        <div>
                                            <div className="flex items-center justify-between mb-1">
                                                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300">
                                                    Destination Folder
                                                </label>
                                                <button
                                                    type="button"
                                                    onClick={() => handleOpenFolderPicker(idx)}
                                                    className="text-[11px] font-bold text-sky-600 hover:text-sky-700 flex items-center gap-1 cursor-pointer"
                                                >
                                                    <FolderOpen size={12} />
                                                    <span>Drill Down</span>
                                                </button>
                                            </div>
                                            <div 
                                                onClick={() => handleOpenFolderPicker(idx)}
                                                className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white flex items-center justify-between cursor-pointer hover:border-sky-500 transition-colors"
                                            >
                                                <div className="flex items-center gap-2 truncate">
                                                    <Folder size={14} className="text-amber-500 shrink-0" />
                                                    <span className="truncate font-semibold text-slate-700 dark:text-slate-200">
                                                        {getFolderDisplayPath(item.folderId, folders)}
                                                    </span>
                                                </div>
                                                <ChevronRight size={14} className="text-slate-400 shrink-0 ml-1" />
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                                            Tags (comma separated)
                                        </label>
                                        <input
                                            type="text"
                                            value={item.tags}
                                            onChange={(e) => {
                                                const updated = [...pendingUploads];
                                                updated[idx].tags = e.target.value;
                                                setPendingUploads(updated);
                                            }}
                                            placeholder="e.g. 2026, Signed, Urgent"
                                            className="w-full text-xs p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                                            Notes / Description (Optional)
                                        </label>
                                        <input
                                            type="text"
                                            value={item.description}
                                            onChange={(e) => {
                                                const updated = [...pendingUploads];
                                                updated[idx].description = e.target.value;
                                                setPendingUploads(updated);
                                            }}
                                            placeholder="Add context or notes..."
                                            className="w-full text-xs p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                                        />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {isUploading && (
                        <div className="p-3 bg-sky-50 dark:bg-sky-950/40 rounded-xl border border-sky-200 dark:border-sky-800 text-center">
                            <p className="text-xs font-bold text-sky-700 dark:text-sky-300 animate-pulse">
                                {uploadProgressText || 'Uploading...'}
                            </p>
                        </div>
                    )}

                    <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                        <Button 
                            variant="secondary" 
                            onClick={() => setIsUploadModalOpen(false)}
                            disabled={isUploading}
                        >
                            Cancel
                        </Button>
                        <Button 
                            onClick={handleExecuteUpload} 
                            disabled={isUploading || pendingUploads.length === 0}
                            className="bg-[#123A63] hover:bg-[#0A2540] text-white font-bold"
                        >
                            {isUploading ? 'Uploading...' : `Upload ${pendingUploads.length} ${pendingUploads.length === 1 ? 'Document' : 'Documents'}`}
                        </Button>
                    </div>
                </div>
            </Modal>

            {/* DRILL-DOWN FOLDER PICKER MODAL (For Uploads) */}
            {isFolderPickerOpen && (
                <Modal
                    isOpen={isFolderPickerOpen}
                    onClose={() => setIsFolderPickerOpen(false)}
                    title={pickerTargetItemIndex === null ? "Choose Upload Destination (All Files)" : `Choose Destination for "${pendingUploads[pickerTargetItemIndex]?.title || 'File'}"`}
                    size="md"
                >
                    <div className="space-y-4 p-1">
                        {/* Search & Breadcrumb Bar */}
                        <div className="space-y-2">
                            <div className="relative">
                                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    type="text"
                                    placeholder="Search folders by name..."
                                    value={pickerSearchTerm}
                                    onChange={(e) => setPickerSearchTerm(e.target.value)}
                                    className="w-full pl-8 pr-8 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-1 focus:ring-primary-500 text-slate-900 dark:text-white"
                                />
                                {pickerSearchTerm && (
                                    <button
                                        type="button"
                                        onClick={() => setPickerSearchTerm('')}
                                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                                    >
                                        <X size={12} />
                                    </button>
                                )}
                            </div>

                            {/* Breadcrumbs trail */}
                            {!pickerSearchTerm && (
                                <div className="flex items-center gap-1.5 p-2 bg-slate-100 dark:bg-slate-800/80 rounded-xl text-xs overflow-x-auto custom-scrollbar">
                                    {pickerNavFolderId !== null && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const currentF = folders.find(f => f.id === pickerNavFolderId);
                                                setPickerNavFolderId(currentF?.parentId || null);
                                                setPickerSelectedFolderId(currentF?.parentId || null);
                                            }}
                                            className="px-2 py-0.5 rounded-lg bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 text-[11px] font-bold flex items-center gap-1 shadow-2xs shrink-0 cursor-pointer"
                                            title="Up one level"
                                        >
                                            <ArrowLeft size={11} /> Up
                                        </button>
                                    )}
                                    {getFolderBreadcrumbPath(pickerNavFolderId, folders).map((crumb, idx, arr) => (
                                        <React.Fragment key={crumb.id || 'root'}>
                                            {idx > 0 && <ChevronRight size={12} className="text-slate-400 shrink-0" />}
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setPickerNavFolderId(crumb.id);
                                                    setPickerSelectedFolderId(crumb.id);
                                                }}
                                                className={`px-2 py-0.5 rounded-lg text-[11px] font-bold truncate transition-colors cursor-pointer shrink-0 ${
                                                    idx === arr.length - 1
                                                        ? 'bg-sky-500 text-white shadow-2xs'
                                                        : 'text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700'
                                                }`}
                                            >
                                                {idx === 0 ? '📁 Root' : crumb.name}
                                            </button>
                                        </React.Fragment>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Inline Create Subfolder Toggle */}
                        <div className="flex items-center justify-between pt-1">
                            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                                {pickerSearchTerm ? 'Search Results' : 'Folders at this level'}
                            </span>
                            {!pickerSearchTerm && (
                                <button
                                    type="button"
                                    onClick={() => setIsCreatingFolderInPicker(!isCreatingFolderInPicker)}
                                    className="text-[11px] font-bold text-sky-600 hover:text-sky-700 flex items-center gap-1 cursor-pointer"
                                >
                                    <Plus size={12} />
                                    <span>New Subfolder</span>
                                </button>
                            )}
                        </div>

                        {/* Inline folder creation form */}
                        {isCreatingFolderInPicker && (
                            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2.5">
                                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300">
                                    New Subfolder Name
                                </label>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="text"
                                        placeholder="e.g. 2026 Invoices"
                                        value={newFolderNameInPicker}
                                        onChange={(e) => setNewFolderNameInPicker(e.target.value)}
                                        className="flex-1 text-xs p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                                        autoFocus
                                        onKeyDown={async (e) => {
                                            if (e.key === 'Enter' && newFolderNameInPicker.trim()) {
                                                const newId = await handleCreateFolderInPicker(pickerNavFolderId, newFolderNameInPicker, newFolderColorInPicker);
                                                if (newId) {
                                                    setPickerSelectedFolderId(newId);
                                                    setPickerNavFolderId(newId);
                                                    setIsCreatingFolderInPicker(false);
                                                    setNewFolderNameInPicker('');
                                                }
                                            }
                                        }}
                                    />
                                    <div className="flex items-center gap-1">
                                        {FOLDER_COLORS.slice(0, 4).map(c => (
                                            <button
                                                key={c.value}
                                                type="button"
                                                onClick={() => setNewFolderColorInPicker(c.value)}
                                                className={`w-5 h-5 rounded-full ${
                                                    c.value === 'amber' ? 'bg-amber-500' :
                                                    c.value === 'sky' ? 'bg-sky-500' :
                                                    c.value === 'emerald' ? 'bg-emerald-500' : 'bg-purple-500'
                                                } ${newFolderColorInPicker === c.value ? 'ring-2 ring-offset-1 ring-slate-900 dark:ring-white' : 'opacity-70'} cursor-pointer`}
                                            />
                                        ))}
                                    </div>
                                </div>
                                <div className="flex items-center justify-end gap-2">
                                    <Button
                                        type="button"
                                        variant="secondary"
                                        size="sm"
                                        onClick={() => {
                                            setIsCreatingFolderInPicker(false);
                                            setNewFolderNameInPicker('');
                                        }}
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        type="button"
                                        size="sm"
                                        onClick={async () => {
                                            if (!newFolderNameInPicker.trim()) return;
                                            const newId = await handleCreateFolderInPicker(pickerNavFolderId, newFolderNameInPicker, newFolderColorInPicker);
                                            if (newId) {
                                                setPickerSelectedFolderId(newId);
                                                setPickerNavFolderId(newId);
                                                setIsCreatingFolderInPicker(false);
                                                setNewFolderNameInPicker('');
                                            }
                                        }}
                                        className="bg-[#123A63] text-white font-bold text-xs"
                                    >
                                        Create &amp; Select
                                    </Button>
                                </div>
                            </div>
                        )}

                        {/* List of subfolders with drilldown navigation */}
                        <div className="space-y-1.5 max-h-[40vh] overflow-y-auto custom-scrollbar pr-1">
                            {/* Option for Root (Top Level) when browsing Root */}
                            {!pickerSearchTerm && pickerNavFolderId === null && (
                                <div
                                    onClick={() => setPickerSelectedFolderId(null)}
                                    className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                                        pickerSelectedFolderId === null
                                            ? 'bg-sky-50 dark:bg-sky-950/40 border-sky-500 ring-1 ring-sky-500'
                                            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-sky-300'
                                    }`}
                                >
                                    <div className="flex items-center gap-2.5">
                                        <div className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                                            <HardDrive size={16} />
                                        </div>
                                        <div>
                                            <span className="text-xs font-bold text-slate-900 dark:text-white">
                                                📁 Root (Top Level Drive)
                                            </span>
                                            <p className="text-[10px] text-slate-400">Store directly in top level directory</p>
                                        </div>
                                    </div>
                                    {pickerSelectedFolderId === null && (
                                        <span className="p-1 bg-sky-500 text-white rounded-full">
                                            <Check size={12} />
                                        </span>
                                    )}
                                </div>
                            )}

                            {/* Subfolder items */}
                            {(() => {
                                const displayedFolders = pickerSearchTerm.trim()
                                    ? folders.filter(f => f.name.toLowerCase().includes(pickerSearchTerm.toLowerCase().trim()))
                                    : folders.filter(f => f.parentId === pickerNavFolderId);

                                if (displayedFolders.length === 0 && (pickerSearchTerm || pickerNavFolderId !== null)) {
                                    return (
                                        <div className="py-8 text-center bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700 text-xs text-slate-400">
                                            {pickerSearchTerm ? 'No folders matched your search.' : 'No subfolders inside this folder.'}
                                        </div>
                                    );
                                }

                                return displayedFolders.map(f => {
                                    const isSelected = pickerSelectedFolderId === f.id;
                                    const childCount = folders.filter(sub => sub.parentId === f.id).length;
                                    const fColor = FOLDER_COLORS.find(c => c.value === f.color) || FOLDER_COLORS[0];

                                    return (
                                        <div
                                            key={f.id}
                                            onClick={() => setPickerSelectedFolderId(f.id)}
                                            className={`p-2.5 rounded-xl border flex items-center justify-between cursor-pointer transition-all group ${
                                                isSelected
                                                    ? 'bg-sky-50 dark:bg-sky-950/40 border-sky-500 ring-1 ring-sky-500'
                                                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-sky-300'
                                            }`}
                                        >
                                            <div className="flex items-center gap-2.5 min-w-0">
                                                <div className={`p-1.5 rounded-lg border ${fColor.bg}`}>
                                                    <Folder size={16} />
                                                </div>
                                                <div className="min-w-0">
                                                    <h5 className="text-xs font-bold text-slate-900 dark:text-white truncate">
                                                        {f.name}
                                                    </h5>
                                                    <p className="text-[10px] text-slate-400 truncate">
                                                        {pickerSearchTerm ? getFolderDisplayPath(f.id, folders) : `${childCount} subfolder${childCount === 1 ? '' : 's'}`}
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-1.5 shrink-0 ml-2" onClick={(e) => e.stopPropagation()}>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setPickerNavFolderId(f.id);
                                                        setPickerSelectedFolderId(f.id);
                                                        setPickerSearchTerm('');
                                                    }}
                                                    className="px-2 py-1 bg-slate-100 hover:bg-sky-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 hover:text-sky-600 rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
                                                    title="Drill down into this folder"
                                                >
                                                    <span>Open</span>
                                                    <ChevronRight size={12} />
                                                </button>
                                                {isSelected && (
                                                    <span className="p-1 bg-sky-500 text-white rounded-full">
                                                        <Check size={12} />
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    );
                                });
                            })()}
                        </div>

                        {/* Footer with confirmation */}
                        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
                            <div className="text-xs text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                                <span className="font-bold text-slate-400">Target:</span>
                                <span className="font-extrabold text-slate-900 dark:text-white truncate">
                                    📁 {getFolderDisplayPath(pickerSelectedFolderId, folders)}
                                </span>
                            </div>

                            <div className="flex justify-end gap-2">
                                <Button
                                    variant="secondary"
                                    onClick={() => setIsFolderPickerOpen(false)}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    onClick={() => {
                                        if (pickerTargetItemIndex === null) {
                                            setGlobalUploadFolderId(pickerSelectedFolderId);
                                            const updated = pendingUploads.map(item => ({
                                                ...item,
                                                folderId: pickerSelectedFolderId
                                            }));
                                            setPendingUploads(updated);
                                        } else {
                                            const updated = [...pendingUploads];
                                            if (updated[pickerTargetItemIndex]) {
                                                updated[pickerTargetItemIndex].folderId = pickerSelectedFolderId;
                                                setPendingUploads(updated);
                                            }
                                        }
                                        setIsFolderPickerOpen(false);
                                    }}
                                    className="bg-[#123A63] hover:bg-[#0A2540] text-white font-bold text-xs"
                                >
                                    Select This Folder
                                </Button>
                            </div>
                        </div>
                    </div>
                </Modal>
            )}

            {/* EDIT ACCESS PERMISSIONS MODAL */}
            {permItem && (
                <Modal
                    isOpen={!!permItem}
                    onClose={() => !isSavingPerms && setPermItem(null)}
                    title={`Access Controls: ${(permItem.item as any).label || (permItem.item as any).name || (permItem.item as any).fileName}`}
                    size="md"
                >
                    <div className="space-y-4 p-1">
                        <div>
                            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                Access Level Designation *
                            </label>
                            <select
                                aria-label="Access Level"
                                title="Access Level"
                                value={permAccessLevel}
                                onChange={(e) => setPermAccessLevel(e.target.value as DriveAccessLevel)}
                                className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                            >
                                {permItem.type === 'file' && (
                                    <option value="inherit">Inherit from Containing Folder</option>
                                )}
                                <option value="all_staff">All Organization Staff</option>
                                <option value="management_only">Management &amp; Supervisors Only</option>
                                <option value="technicians_only">Field Techs &amp; Operations</option>
                                <option value="office_only">Office Staff &amp; Dispatch</option>
                                <option value="admins_only">Admins &amp; Master Admins Only</option>
                                <option value="custom_roles">Custom Role Selection...</option>
                            </select>
                            <p className="text-[10px] text-slate-400 mt-1">
                                {ACCESS_LEVEL_LABELS[permAccessLevel]?.desc}
                            </p>
                        </div>

                        {permAccessLevel === 'custom_roles' && (
                            <div>
                                <label className="block text-xs font-bold text-purple-600 dark:text-purple-400 mb-1.5">
                                    Allowed Roles:
                                </label>
                                <div className="grid grid-cols-2 gap-2 bg-purple-50/50 dark:bg-purple-950/20 p-3 rounded-xl border border-purple-200 dark:border-purple-800">
                                    {AVAILABLE_COMPANY_ROLES.map(role => {
                                        const checked = permAllowedRoles.includes(role);
                                        return (
                                            <label key={role} className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
                                                <input 
                                                    type="checkbox"
                                                    checked={checked}
                                                    onChange={() => {
                                                        if (checked) {
                                                            setPermAllowedRoles(permAllowedRoles.filter(r => r !== role));
                                                        } else {
                                                            setPermAllowedRoles([...permAllowedRoles, role]);
                                                        }
                                                    }}
                                                    className="rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                                                />
                                                <span>{role}</span>
                                            </label>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {permItem.type === 'file' && (
                            <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                                <label className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer">
                                    <input 
                                        type="checkbox"
                                        checked={permIsLocked}
                                        onChange={(e) => setPermIsLocked(e.target.checked)}
                                        className="rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                                    />
                                    <span>Lock Document (Prevents non-admins from modifying or deleting)</span>
                                </label>
                            </div>
                        )}

                        <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                            <Button variant="secondary" onClick={() => setPermItem(null)} disabled={isSavingPerms}>
                                Cancel
                            </Button>
                            <Button onClick={handleSavePermissions} disabled={isSavingPerms} className="bg-[#123A63] hover:bg-[#0A2540] text-white font-bold">
                                {isSavingPerms ? 'Saving...' : 'Save Permissions'}
                            </Button>
                        </div>
                    </div>
                </Modal>
            )}

            {/* MOVE ITEM MODAL (Google Drive Style Drill-Down & Organize) */}
            {movingItem && (
                <Modal
                    isOpen={!!movingItem}
                    onClose={() => !isMoving && setMovingItem(null)}
                    title={`Move "${(movingItem.item as any).label || (movingItem.item as any).name || (movingItem.item as any).fileName}"`}
                    size="md"
                >
                    <div className="space-y-4 p-1">
                        {/* CUSTOMER FILE MOVE: Move between categories */}
                        {movingItem.item.customerId ? (
                            <div className="space-y-3">
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                    Select destination category in <span className="font-bold text-slate-800 dark:text-slate-200">{movingItem.item.customerName}</span>&apos;s account:
                                </p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[50vh] overflow-y-auto custom-scrollbar pr-1">
                                    {CUSTOMER_PRESET_CATEGORIES.map(cat => {
                                        const isSelected = customerMoveCategory === cat;
                                        const isCurrentCat = movingItem.item.originCategory === cat;

                                        return (
                                            <div
                                                key={cat}
                                                onClick={() => setCustomerMoveCategory(cat)}
                                                className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                                                    isSelected
                                                        ? 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-500 ring-1 ring-indigo-500'
                                                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-indigo-300'
                                                }`}
                                            >
                                                <div className="flex items-center gap-2 truncate">
                                                    <Folder size={16} className={isSelected ? 'text-indigo-600' : 'text-amber-500'} />
                                                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                                                        {cat}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-1.5 shrink-0 ml-1">
                                                    {isCurrentCat && (
                                                        <span className="text-[10px] text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded-md">
                                                            Current
                                                        </span>
                                                    )}
                                                    {isSelected && (
                                                        <span className="p-1 bg-indigo-600 text-white rounded-full">
                                                            <Check size={12} />
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                                <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                                    <Button variant="secondary" onClick={() => setMovingItem(null)} disabled={isMoving}>
                                        Cancel
                                    </Button>
                                    <Button 
                                        onClick={handleExecuteMove} 
                                        disabled={isMoving || customerMoveCategory === movingItem.item.originCategory} 
                                        className="bg-[#123A63] hover:bg-[#0A2540] text-white font-bold"
                                    >
                                        {isMoving ? 'Moving...' : customerMoveCategory === movingItem.item.originCategory ? 'Already in this category' : 'Move to Category'}
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            /* COMPANY FILE OR FOLDER MOVE: Google Drive Drill-Down Navigation */
                            <div className="space-y-3.5">
                                {/* Current Location Indicator */}
                                <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700">
                                    <span className="font-bold text-slate-400">Current Location:</span>
                                    <span className="font-extrabold text-slate-700 dark:text-slate-200 truncate">
                                        📁 {getFolderDisplayPath(movingItem.type === 'file' ? movingItem.item.folderId : movingItem.item.parentId, folders)}
                                    </span>
                                </div>

                                {/* Search & Breadcrumb Bar */}
                                <div className="space-y-2">
                                    <div className="relative">
                                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                        <input
                                            type="text"
                                            placeholder="Search destination folders..."
                                            value={moveFolderSearchTerm}
                                            onChange={(e) => setMoveFolderSearchTerm(e.target.value)}
                                            className="w-full pl-8 pr-8 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-1 focus:ring-primary-500 text-slate-900 dark:text-white"
                                        />
                                        {moveFolderSearchTerm && (
                                            <button
                                                type="button"
                                                onClick={() => setMoveFolderSearchTerm('')}
                                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                                            >
                                                <X size={12} />
                                            </button>
                                        )}
                                    </div>

                                    {/* Breadcrumbs trail */}
                                    {!moveFolderSearchTerm && (
                                        <div className="flex items-center gap-1.5 p-2 bg-slate-100 dark:bg-slate-800/80 rounded-xl text-xs overflow-x-auto custom-scrollbar">
                                            {moveNavFolderId !== null && (
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const currentF = folders.find(f => f.id === moveNavFolderId);
                                                        setMoveNavFolderId(currentF?.parentId || null);
                                                        setTargetMoveFolderId(currentF?.parentId || null);
                                                    }}
                                                    className="px-2 py-0.5 rounded-lg bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 text-[11px] font-bold flex items-center gap-1 shadow-2xs shrink-0 cursor-pointer"
                                                    title="Up one level"
                                                >
                                                    <ArrowLeft size={11} /> Up
                                                </button>
                                            )}
                                            {getFolderBreadcrumbPath(moveNavFolderId, folders).map((crumb, idx, arr) => (
                                                <React.Fragment key={crumb.id || 'root'}>
                                                    {idx > 0 && <ChevronRight size={12} className="text-slate-400 shrink-0" />}
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setMoveNavFolderId(crumb.id);
                                                            setTargetMoveFolderId(crumb.id);
                                                        }}
                                                        className={`px-2 py-0.5 rounded-lg text-[11px] font-bold truncate transition-colors cursor-pointer shrink-0 ${
                                                            idx === arr.length - 1
                                                                ? 'bg-sky-500 text-white shadow-2xs'
                                                                : 'text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700'
                                                        }`}
                                                    >
                                                        {idx === 0 ? '📁 Root' : crumb.name}
                                                    </button>
                                                </React.Fragment>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Inline Create Subfolder in Move Dialog */}
                                <div className="flex items-center justify-between pt-1">
                                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                                        {moveFolderSearchTerm ? 'Search Results' : 'Folders at this level'}
                                    </span>
                                    {!moveFolderSearchTerm && (
                                        <button
                                            type="button"
                                            onClick={() => setIsCreatingFolderInModal(!isCreatingFolderInModal)}
                                            className="text-[11px] font-bold text-sky-600 hover:text-sky-700 flex items-center gap-1 cursor-pointer"
                                        >
                                            <Plus size={12} />
                                            <span>New Subfolder</span>
                                        </button>
                                    )}
                                </div>

                                {/* Inline folder creation form */}
                                {isCreatingFolderInModal && (
                                    <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2.5">
                                        <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300">
                                            Create Destination Subfolder
                                        </label>
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="text"
                                                placeholder="e.g. Completed Projects"
                                                value={newFolderNameInModal}
                                                onChange={(e) => setNewFolderNameInModal(e.target.value)}
                                                className="flex-1 text-xs p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                                                autoFocus
                                                onKeyDown={async (e) => {
                                                    if (e.key === 'Enter' && newFolderNameInModal.trim()) {
                                                        const newId = await handleCreateFolderInPicker(moveNavFolderId, newFolderNameInModal, newFolderColorInModal);
                                                        if (newId) {
                                                            setTargetMoveFolderId(newId);
                                                            setMoveNavFolderId(newId);
                                                            setIsCreatingFolderInModal(false);
                                                            setNewFolderNameInModal('');
                                                        }
                                                    }
                                                }}
                                            />
                                            <div className="flex items-center gap-1">
                                                {FOLDER_COLORS.slice(0, 4).map(c => (
                                                    <button
                                                        key={c.value}
                                                        type="button"
                                                        onClick={() => setNewFolderColorInModal(c.value)}
                                                        className={`w-5 h-5 rounded-full ${
                                                            c.value === 'amber' ? 'bg-amber-500' :
                                                            c.value === 'sky' ? 'bg-sky-500' :
                                                            c.value === 'emerald' ? 'bg-emerald-500' : 'bg-purple-500'
                                                        } ${newFolderColorInModal === c.value ? 'ring-2 ring-offset-1 ring-slate-900 dark:ring-white' : 'opacity-70'} cursor-pointer`}
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-end gap-2">
                                            <Button
                                                type="button"
                                                variant="secondary"
                                                size="sm"
                                                onClick={() => {
                                                    setIsCreatingFolderInModal(false);
                                                    setNewFolderNameInModal('');
                                                }}
                                            >
                                                Cancel
                                            </Button>
                                            <Button
                                                type="button"
                                                size="sm"
                                                onClick={async () => {
                                                    if (!newFolderNameInModal.trim()) return;
                                                    const newId = await handleCreateFolderInPicker(moveNavFolderId, newFolderNameInModal, newFolderColorInModal);
                                                    if (newId) {
                                                        setTargetMoveFolderId(newId);
                                                        setMoveNavFolderId(newId);
                                                        setIsCreatingFolderInModal(false);
                                                        setNewFolderNameInModal('');
                                                    }
                                                }}
                                                className="bg-[#123A63] text-white font-bold text-xs"
                                            >
                                                Create &amp; Select
                                            </Button>
                                        </div>
                                    </div>
                                )}

                                {/* Subfolder list with cycle prevention & drilldown */}
                                <div className="space-y-1.5 max-h-[42vh] overflow-y-auto custom-scrollbar pr-1">
                                    {/* Option for Root (Top Level) when browsing Root */}
                                    {!moveFolderSearchTerm && moveNavFolderId === null && (
                                        <div
                                            onClick={() => setTargetMoveFolderId(null)}
                                            className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                                                targetMoveFolderId === null
                                                    ? 'bg-sky-50 dark:bg-sky-950/40 border-sky-500 ring-1 ring-sky-500'
                                                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-sky-300'
                                            }`}
                                        >
                                            <div className="flex items-center gap-2.5">
                                                <div className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                                                    <HardDrive size={16} />
                                                </div>
                                                <div>
                                                    <span className="text-xs font-bold text-slate-900 dark:text-white">
                                                        📁 Root (Top Level Drive)
                                                    </span>
                                                    <p className="text-[10px] text-slate-400">Move directly to the top level directory</p>
                                                </div>
                                            </div>
                                            {targetMoveFolderId === null && (
                                                <span className="p-1 bg-sky-500 text-white rounded-full">
                                                    <Check size={12} />
                                                </span>
                                            )}
                                        </div>
                                    )}

                                    {/* Folder items */}
                                    {(() => {
                                        const displayedFolders = moveFolderSearchTerm.trim()
                                            ? folders.filter(f => f.name.toLowerCase().includes(moveFolderSearchTerm.toLowerCase().trim()))
                                            : folders.filter(f => f.parentId === moveNavFolderId);

                                        if (displayedFolders.length === 0 && (moveFolderSearchTerm || moveNavFolderId !== null)) {
                                            return (
                                                <div className="py-8 text-center bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700 text-xs text-slate-400">
                                                    {moveFolderSearchTerm ? 'No folders matched your search.' : 'No subfolders inside this folder.'}
                                                </div>
                                            );
                                        }

                                        return displayedFolders.map(f => {
                                            const isSelected = targetMoveFolderId === f.id;
                                            const isSelfOrDescendant = movingItem.type === 'folder' && (f.id === movingItem.item.id || isDescendantOf(f.id, movingItem.item.id, folders));
                                            const childCount = folders.filter(sub => sub.parentId === f.id).length;
                                            const fColor = FOLDER_COLORS.find(c => c.value === f.color) || FOLDER_COLORS[0];

                                            if (isSelfOrDescendant) {
                                                return (
                                                    <div
                                                        key={f.id}
                                                        className="p-2.5 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40 opacity-50 cursor-not-allowed flex items-center justify-between"
                                                        title="Cannot move a folder into itself or its own subfolder"
                                                    >
                                                        <div className="flex items-center gap-2.5 min-w-0">
                                                            <div className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-400">
                                                                <Folder size={16} />
                                                            </div>
                                                            <div className="min-w-0">
                                                                <h5 className="text-xs font-bold text-slate-400 truncate">
                                                                    {f.name}
                                                                </h5>
                                                                <p className="text-[10px] text-rose-500 font-semibold truncate">
                                                                    Cannot move into self or child folder
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            }

                                            return (
                                                <div
                                                    key={f.id}
                                                    onClick={() => setTargetMoveFolderId(f.id)}
                                                    className={`p-2.5 rounded-xl border flex items-center justify-between cursor-pointer transition-all group ${
                                                        isSelected
                                                            ? 'bg-sky-50 dark:bg-sky-950/40 border-sky-500 ring-1 ring-sky-500'
                                                            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-sky-300'
                                                    }`}
                                                >
                                                    <div className="flex items-center gap-2.5 min-w-0">
                                                        <div className={`p-1.5 rounded-lg border ${fColor.bg}`}>
                                                            <Folder size={16} />
                                                        </div>
                                                        <div className="min-w-0">
                                                            <h5 className="text-xs font-bold text-slate-900 dark:text-white truncate">
                                                                {f.name}
                                                            </h5>
                                                            <p className="text-[10px] text-slate-400 truncate">
                                                                {moveFolderSearchTerm ? getFolderDisplayPath(f.id, folders) : `${childCount} subfolder${childCount === 1 ? '' : 's'}`}
                                                            </p>
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center gap-1.5 shrink-0 ml-2" onClick={(e) => e.stopPropagation()}>
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setMoveNavFolderId(f.id);
                                                                setTargetMoveFolderId(f.id);
                                                                setMoveFolderSearchTerm('');
                                                            }}
                                                            className="px-2 py-1 bg-slate-100 hover:bg-sky-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 hover:text-sky-600 rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
                                                            title="Drill down into this folder"
                                                        >
                                                            <span>Open</span>
                                                            <ChevronRight size={12} />
                                                        </button>
                                                        {isSelected && (
                                                            <span className="p-1 bg-sky-500 text-white rounded-full">
                                                                <Check size={12} />
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        });
                                    })()}
                                </div>

                                {/* Destination Confirmation & Actions */}
                                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
                                    <div className="text-xs text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                                        <span className="font-bold text-slate-400">Move to:</span>
                                        <span className="font-extrabold text-slate-900 dark:text-white truncate">
                                            📁 {getFolderDisplayPath(targetMoveFolderId, folders)}
                                        </span>
                                    </div>

                                    <div className="flex justify-end gap-2">
                                        <Button variant="secondary" onClick={() => setMovingItem(null)} disabled={isMoving}>
                                            Cancel
                                        </Button>
                                        <Button 
                                            onClick={handleExecuteMove} 
                                            disabled={isMoving || (movingItem.type === 'file' ? movingItem.item.folderId : movingItem.item.parentId) === targetMoveFolderId} 
                                            className="bg-[#123A63] hover:bg-[#0A2540] text-white font-bold"
                                        >
                                            {isMoving 
                                                ? 'Moving...' 
                                                : (movingItem.type === 'file' ? movingItem.item.folderId : movingItem.item.parentId) === targetMoveFolderId
                                                ? 'Already in this folder'
                                                : 'Move Here'}
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </Modal>
            )}

            {/* UNIVERSAL FILE PREVIEW MODAL */}
            {previewingFile && (() => {
                const fileSrc = previewingFile.url || previewingFile.dataUrl || '';
                const typeInfo = detectFileType(fileSrc, previewingFile.fileName, previewingFile.fileType);
                const displayTitle = previewingFile.label || previewingFile.fileName;
                const accessInfo = ACCESS_LEVEL_LABELS[previewingFile.accessLevel] || ACCESS_LEVEL_LABELS.all_staff;
                const tags: string[] = Array.isArray(previewingFile.tags) ? previewingFile.tags : [];
                const isCustomerFile = !!previewingFile.customerId;

                return (
                    <Modal
                        isOpen={!!previewingFile}
                        onClose={() => setPreviewingFile(null)}
                        title=""
                        size="xl"
                    >
                        <div className="space-y-4 p-1">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
                                <div>
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <h4 className="text-base font-extrabold text-slate-900 dark:text-white">
                                            {displayTitle}
                                        </h4>
                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                            isCustomerFile ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : accessInfo.color
                                        }`}>
                                            {isCustomerFile ? previewingFile.originCategory : accessInfo.label}
                                        </span>
                                        {isCustomerFile && (
                                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-600 text-white flex items-center gap-1">
                                                <Building2 size={10} /> {previewingFile.customerName}
                                            </span>
                                        )}
                                        {previewingFile.isLocked && (
                                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 flex items-center gap-1">
                                                <Lock size={10} /> Locked
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-xs text-slate-400 mt-0.5">
                                        {previewingFile.fileName} &bull; {formatBytes(previewingFile.sizeBytes)} &bull; Added {new Date(previewingFile.createdAt || 0).toLocaleDateString()} by {previewingFile.createdBy || 'Staff'}
                                    </p>
                                </div>

                                <div className="flex items-center gap-2 flex-wrap">
                                    {isCustomerFile && (
                                        <Button
                                            onClick={() => setActiveCustomerModalId(previewingFile.customerId)}
                                            variant="secondary"
                                            className="text-xs flex items-center gap-1.5 font-bold"
                                        >
                                            <ExternalLink size={13} /> View Customer Profile
                                        </Button>
                                    )}
                                    {isAdmin && !isCustomerFile && (
                                        <Button
                                            onClick={() => handleOpenPermissions(previewingFile, 'file')}
                                            variant="secondary"
                                            className="text-xs flex items-center gap-1.5"
                                        >
                                            <Lock size={14} /> Permissions
                                        </Button>
                                    )}
                                    <Button
                                        onClick={(e) => handleDownloadFile(previewingFile, e)}
                                        className="bg-[#123A63] hover:bg-[#0A2540] text-white text-xs font-bold flex items-center gap-1.5"
                                    >
                                        <Download size={14} /> Download
                                    </Button>
                                    {fileSrc && (
                                        <a
                                            href={fileSrc}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors"
                                            title="Open in new window"
                                        >
                                            <ExternalLink size={14} />
                                        </a>
                                    )}
                                </div>
                            </div>

                            <div className="bg-slate-950 rounded-2xl overflow-hidden flex items-center justify-center min-h-[400px] max-h-[70vh] shadow-2xl p-2">
                                {typeInfo.isImage ? (
                                    <img 
                                        src={fileSrc} 
                                        className="max-w-full max-h-[65vh] object-contain rounded-lg" 
                                        alt={displayTitle}
                                    />
                                ) : typeInfo.isHtml ? (
                                    <iframe 
                                        srcDoc={fileSrc.startsWith('data:text/html;base64,') ? decodeURIComponent(escape(atob(fileSrc.split('base64,')[1]))) : undefined}
                                        src={!fileSrc.startsWith('data:text/html;base64,') ? fileSrc : undefined} 
                                        className="w-full h-[60vh] border-0 bg-white rounded-lg" 
                                        title={displayTitle} 
                                    />
                                ) : typeInfo.isPdf ? (
                                    <iframe 
                                        src={fileSrc} 
                                        className="w-full h-[60vh] border-0 bg-white rounded-lg" 
                                        title={displayTitle} 
                                    />
                                ) : typeInfo.googleDocsViewerUrl ? (
                                    <iframe 
                                        src={typeInfo.googleDocsViewerUrl} 
                                        className="w-full h-[60vh] border-0 bg-white rounded-lg" 
                                        title={displayTitle} 
                                    />
                                ) : (
                                    <div className="p-12 text-center text-white space-y-4">
                                        <FileText size={64} className="mx-auto text-slate-500" />
                                        <div>
                                            <p className="font-bold text-base">{displayTitle}</p>
                                            <p className="text-xs text-slate-400 mt-1">This format cannot be rendered inline.</p>
                                        </div>
                                        <Button
                                            onClick={(e) => handleDownloadFile(previewingFile, e)}
                                            className="bg-[#123A63] text-white px-6 py-2.5 rounded-xl font-bold hover:bg-[#0A2540] inline-flex items-center gap-2"
                                        >
                                            <Download size={16} /> Download File
                                        </Button>
                                    </div>
                                )}
                            </div>

                            {(previewingFile.description || tags.length > 0) && (
                                <div className="p-3 bg-slate-50 dark:bg-slate-850 rounded-xl border border-slate-200 dark:border-slate-800 text-xs space-y-1.5">
                                    {previewingFile.description && (
                                        <p className="text-slate-600 dark:text-slate-300">
                                            <span className="font-bold">Description:</span> {previewingFile.description}
                                        </p>
                                    )}
                                    {tags.length > 0 && (
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                            <span className="font-bold text-slate-500">Tags:</span>
                                            {tags.map((tag: string, i: number) => (
                                                <span key={i} className="px-2 py-0.5 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded text-[10px] font-bold">
                                                    #{tag}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </Modal>
                );
            })()}

            {/* CUSTOMER MASTER MODAL EMBED */}
            {activeCustomerModalId && (
                <CustomerMasterModal
                    isOpen={true}
                    onClose={() => setActiveCustomerModalId(null)}
                    customerId={activeCustomerModalId}
                />
            )}
        </div>
    );
};

export default OrganizationDrive;
