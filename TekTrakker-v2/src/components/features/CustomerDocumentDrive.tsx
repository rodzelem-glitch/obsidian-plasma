import React, { useState, useMemo, useRef } from 'react';
import { 
    UploadCloud, Download, Eye, Trash2, Edit3, Search, Filter, Folder, FolderOpen, 
    FileText, Image as ImageIcon, FileSpreadsheet, FileCode, File, Plus, Grid, List, 
    Sparkles, Clock, HardDrive, ExternalLink, X, Check, Tag, ChevronRight, AlertCircle, 
    Calendar, User, Layers, ShieldCheck, FileCheck, RefreshCw, SlidersHorizontal, 
    CheckSquare, Square, Info, Paperclip, Wrench, Briefcase, ArrowLeft
} from 'lucide-react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Select from '../ui/Select';
import Textarea from '../ui/Textarea';
import { useAppContext } from 'context/AppContext';
import { db, firebase } from 'lib/firebase';
import { uploadFileToStorage } from 'lib/storageService';
import { detectFileType } from 'lib/fileViewerHelper';
import showToast from 'lib/toast';
import { globalConfirm } from 'lib/globalConfirm';
import { cleanUndefinedFields, isInternalExpenseFile } from 'lib/utils';
import type { Customer, StoredFile, Job, EquipmentAsset } from 'types';

export interface CustomerDocumentDriveProps {
    customer: Customer;
    customerJobs?: Job[];
    onUpdateCustomer?: (updated: Customer) => void;
}

const PRESET_CATEGORIES = [
    'Contracts & Agreements',
    'Blueprints & Schematics',
    'Permits & Municipal Forms',
    'Invoices & Receipts',
    'Equipment Manuals & Specs',
    'Warranties & Certificates',
    'Photos & Inspection Media',
    'Insurance & Tax (COI/W9)',
    'General Documents'
];

export const CustomerDocumentDrive: React.FC<CustomerDocumentDriveProps> = ({
    customer,
    customerJobs = [],
    onUpdateCustomer
}) => {
    const { state, dispatch } = useAppContext();
    
    // UI View & Filter States
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
    const [selectedFileType, setSelectedFileType] = useState<string>('ALL');
    const [sourceFilter, setSourceFilter] = useState<'ALL' | 'customer' | 'job'>('ALL');
    const [searchTerm, setSearchTerm] = useState('');
    const [sortBy, setSortBy] = useState<'date_desc' | 'date_asc' | 'name_asc' | 'name_desc' | 'size_desc' | 'size_asc'>('date_desc');
    const [isDragOver, setIsDragOver] = useState(false);

    // Upload Flow States
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
    const [pendingUploadFiles, setPendingUploadFiles] = useState<Array<{
        file: File;
        title: string;
        category: string;
        customCategory?: string;
        tags: string;
        description: string;
        associatedEquipmentId?: string;
        associatedJobId?: string;
    }>>([]);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgressText, setUploadProgressText] = useState('');
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    // Edit Document Info State
    const [editingFile, setEditingFile] = useState<StoredFile | null>(null);
    const [editFormTitle, setEditFormTitle] = useState('');
    const [editFormCategory, setEditFormCategory] = useState('');
    const [editFormCustomCategory, setEditFormCustomCategory] = useState('');
    const [editFormTags, setEditFormTags] = useState('');
    const [editFormDescription, setEditFormDescription] = useState('');
    const [editFormEquipmentId, setEditFormEquipmentId] = useState('');
    const [isSavingEdit, setIsSavingEdit] = useState(false);

    // Preview Modal State
    const [previewingFile, setPreviewingFile] = useState<StoredFile | null>(null);

    // Aggregate all customer-related files
    const allUnifiedFiles = useMemo(() => {
        const list: StoredFile[] = [];

        // 1. Direct files stored on the customer (excluding internal/confidential documents)
        if (customer.files && Array.isArray(customer.files)) {
            customer.files.forEach(f => {
                if (isInternalExpenseFile(f)) return;
                list.push({
                    ...f,
                    parentType: 'customer',
                    parentId: customer.id
                });
            });
        }

        // 2. Company / Compliance documents stored in legacy customer fields
        if ((customer as any).documents && Array.isArray((customer as any).documents)) {
            (customer as any).documents.forEach((cd: any) => {
                if (isInternalExpenseFile(cd)) return;
                if (!list.some(existing => (existing.dataUrl || existing.url) === (cd.dataUrl || cd.url))) {
                    list.push({
                        id: cd.id || `comp-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
                        organizationId: customer.organizationId || state.currentOrganization?.id || '',
                        parentId: customer.id,
                        parentType: 'customer',
                        fileName: cd.name || 'Compliance Document',
                        fileType: cd.fileType || 'application/pdf',
                        dataUrl: cd.dataUrl || cd.url,
                        url: cd.url || cd.dataUrl,
                        createdAt: cd.uploadedAt || (customer as any).createdAt || new Date().toISOString(),
                        uploadedBy: cd.uploadedBy || 'Admin',
                        label: cd.name,
                        metadata: {
                            category: cd.type || 'Insurance & Tax (COI/W9)',
                            description: cd.notes || '',
                            size: cd.size
                        }
                    });
                }
            });
        }

        // 3. Files attached to jobs for this customer (excluding internal/confidential documents)
        customerJobs.forEach(job => {
            if (job.files && Array.isArray(job.files)) {
                job.files.forEach(jf => {
                    if (isInternalExpenseFile(jf)) return;
                    if (!list.some(existing => existing.id === jf.id)) {
                        const jobDisplayTitle = (job.tasks && job.tasks.length > 0 ? job.tasks.join(', ') : '') || (job as any).title || (job as any).jobType || `Job #${job.id.slice(-6)}`;
                        list.push({
                            ...jf,
                            parentType: 'job',
                            parentId: job.id,
                            metadata: {
                                ...(jf.metadata || {}),
                                jobTitle: jobDisplayTitle,
                                jobNumber: job.jobNumber,
                                technicianName: job.assignedTechnicianName
                            }
                        });
                    }
                });
            }
        });

        return list;
    }, [customer, customerJobs, state.currentOrganization?.id]);

    // Compute dynamic categories list from presets + custom metadata
    const availableCategories = useMemo(() => {
        const categoriesSet = new Set<string>(PRESET_CATEGORIES);
        allUnifiedFiles.forEach(f => {
            const cat = f.metadata?.category || (f.metadata as any)?.type;
            if (cat && typeof cat === 'string' && cat.trim()) {
                categoriesSet.add(cat.trim());
            }
        });
        return Array.from(categoriesSet).sort();
    }, [allUnifiedFiles]);

    // Category file counts
    const categoryCounts = useMemo(() => {
        const counts: Record<string, number> = { ALL: allUnifiedFiles.length };
        availableCategories.forEach(cat => { counts[cat] = 0; });
        
        allUnifiedFiles.forEach(f => {
            const cat = String(f.metadata?.category || (f.metadata as any)?.type || 'General Documents');
            if (counts[cat] !== undefined) {
                counts[cat]++;
            } else {
                counts[cat] = 1;
            }
        });

        return counts;
    }, [allUnifiedFiles, availableCategories]);

    // Total storage metrics
    const storageMetrics = useMemo(() => {
        let totalBytes = 0;
        allUnifiedFiles.forEach(f => {
            const rawSize = f.metadata?.sizeBytes || f.metadata?.size || (f as any).size;
            let sizeBytes = typeof rawSize === 'number' ? rawSize : Number(rawSize);
            if (isNaN(sizeBytes) || sizeBytes <= 0) {
                const urlStr = f.dataUrl || f.url || '';
                if (urlStr.startsWith('data:')) {
                    const commaIdx = urlStr.indexOf(',');
                    const base64Len = commaIdx >= 0 ? urlStr.length - (commaIdx + 1) : urlStr.length;
                    sizeBytes = Math.round(base64Len * 0.75);
                } else if (urlStr.startsWith('http') || urlStr.startsWith('blob')) {
                    sizeBytes = 180 * 1024;
                } else {
                    sizeBytes = 50 * 1024;
                }
            }
            totalBytes += sizeBytes;
        });
        return {
            totalFiles: allUnifiedFiles.length,
            directFilesCount: (customer.files || []).length,
            jobFilesCount: allUnifiedFiles.filter(f => f.parentType === 'job').length,
            totalBytes
        };
    }, [allUnifiedFiles, customer.files]);

    // Format bytes helper
    const formatBytes = (bytes?: any) => {
        const num = typeof bytes === 'number' ? bytes : Number(bytes);
        if (isNaN(num) || num <= 0) return '—';
        if (num < 1024) return `${num} B`;
        if (num < 1024 * 1024) return `${(num / 1024).toFixed(1)} KB`;
        return `${(num / (1024 * 1024)).toFixed(1)} MB`;
    };

    // Filter & sort files
    const filteredFiles = useMemo(() => {
        return allUnifiedFiles.filter(file => {
            // Source Filter
            if (sourceFilter === 'customer' && file.parentType !== 'customer') return false;
            if (sourceFilter === 'job' && file.parentType !== 'job') return false;

            // Category Filter
            if (selectedCategory !== 'ALL') {
                const cat = String(file.metadata?.category || (file.metadata as any)?.type || 'General Documents');
                if (cat !== selectedCategory) return false;
            }

            // File Type Filter
            if (selectedFileType !== 'ALL') {
                const src = file.dataUrl || file.url || '';
                const typeInfo = detectFileType(src, file.fileName, file.fileType);
                if (selectedFileType === 'pdf' && !typeInfo.isPdf) return false;
                if (selectedFileType === 'image' && !typeInfo.isImage) return false;
                if (selectedFileType === 'office' && !typeInfo.isOfficeDoc) return false;
                if (selectedFileType === 'other' && (typeInfo.isPdf || typeInfo.isImage || typeInfo.isOfficeDoc)) return false;
            }

            // Search Term
            if (searchTerm.trim()) {
                const term = searchTerm.toLowerCase().trim();
                const fileName = (file.fileName || '').toLowerCase();
                const label = (file.label || '').toLowerCase();
                const category = String(file.metadata?.category || '').toLowerCase();
                const description = String(file.metadata?.description || '').toLowerCase();
                const tags = Array.isArray(file.metadata?.tags) 
                    ? file.metadata.tags.join(' ').toLowerCase() 
                    : (typeof file.metadata?.tags === 'string' ? file.metadata.tags.toLowerCase() : '');
                const jobTitle = String(file.metadata?.jobTitle || '').toLowerCase();

                const matches = fileName.includes(term) || 
                                label.includes(term) || 
                                category.includes(term) || 
                                description.includes(term) || 
                                tags.includes(term) ||
                                jobTitle.includes(term);
                if (!matches) return false;
            }

            return true;
        }).sort((a, b) => {
            if (sortBy === 'date_desc') {
                return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
            }
            if (sortBy === 'date_asc') {
                return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
            }
            if (sortBy === 'name_asc') {
                const nameA = a.label || a.fileName || '';
                const nameB = b.label || b.fileName || '';
                return nameA.localeCompare(nameB);
            }
            if (sortBy === 'name_desc') {
                const nameA = a.label || a.fileName || '';
                const nameB = b.label || b.fileName || '';
                return nameB.localeCompare(nameA);
            }
            if (sortBy === 'size_desc') {
                const sizeA = Number(a.metadata?.sizeBytes || a.metadata?.size || 0);
                const sizeB = Number(b.metadata?.sizeBytes || b.metadata?.size || 0);
                return sizeB - sizeA;
            }
            if (sortBy === 'size_asc') {
                const sizeA = Number(a.metadata?.sizeBytes || a.metadata?.size || 0);
                const sizeB = Number(b.metadata?.sizeBytes || b.metadata?.size || 0);
                return sizeA - sizeB;
            }
            return 0;
        });
    }, [allUnifiedFiles, sourceFilter, selectedCategory, selectedFileType, searchTerm, sortBy]);

    // Handle files selected for upload
    const handleFilesSelected = (files: FileList | File[]) => {
        const fileList = Array.from(files);
        if (fileList.length === 0) return;

        const prepared = fileList.map(file => {
            const nameLower = file.name.toLowerCase();
            let guessedCat = 'General Documents';
            if (nameLower.includes('contract') || nameLower.includes('agreement') || nameLower.includes('proposal')) {
                guessedCat = 'Contracts & Agreements';
            } else if (nameLower.includes('permit') || nameLower.includes('city') || nameLower.includes('municipal')) {
                guessedCat = 'Permits & Municipal Forms';
            } else if (nameLower.includes('blueprint') || nameLower.includes('plan') || nameLower.includes('schematic') || nameLower.includes('cad')) {
                guessedCat = 'Blueprints & Schematics';
            } else if (nameLower.includes('invoice') || nameLower.includes('receipt') || nameLower.includes('bill')) {
                guessedCat = 'Invoices & Receipts';
            } else if (nameLower.includes('manual') || nameLower.includes('spec') || nameLower.includes('guide')) {
                guessedCat = 'Equipment Manuals & Specs';
            } else if (nameLower.includes('warranty') || nameLower.includes('cert') || nameLower.includes('coverage')) {
                guessedCat = 'Warranties & Certificates';
            } else if (nameLower.includes('coi') || nameLower.includes('insurance') || nameLower.includes('tax') || nameLower.includes('w9') || nameLower.includes('w-9')) {
                guessedCat = 'Insurance & Tax (COI/W9)';
            } else if (file.type.startsWith('image/')) {
                guessedCat = 'Photos & Inspection Media';
            }

            const cleanTitle = file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");

            return {
                file,
                title: cleanTitle,
                category: guessedCat,
                tags: '',
                description: '',
                associatedEquipmentId: '',
                associatedJobId: ''
            };
        });

        setPendingUploadFiles(prepared);
        setIsUploadModalOpen(true);
    };

    // Execute upload
    const handleExecuteUpload = async () => {
        if (!state.currentOrganization) {
            showToast.error("Organization missing. Please re-login.");
            return;
        }

        setIsUploading(true);
        const uploadedStoredFiles: StoredFile[] = [];

        try {
            for (let i = 0; i < pendingUploadFiles.length; i++) {
                const item = pendingUploadFiles[i];
                setUploadProgressText(`Uploading ${i + 1} of ${pendingUploadFiles.length}: ${item.file.name}...`);

                if (item.file.size > 25 * 1024 * 1024) {
                    showToast.warn(`File ${item.file.name} is too large (>25MB). Skipping.`);
                    continue;
                }

                const safeName = item.file.name ? item.file.name.replace(/[^a-zA-Z0-9.\-_]/g, '') : 'doc.pdf';
                const storagePath = `organizations/${state.currentOrganization.id}/customers/${customer.id}/drive/${Date.now()}_${safeName}`;
                const downloadUrl = await uploadFileToStorage(storagePath, item.file);

                const finalCategory = item.category === 'CUSTOM' && item.customCategory?.trim()
                    ? item.customCategory.trim()
                    : item.category;

                const tagsArray = item.tags
                    ? item.tags.split(',').map(t => t.trim()).filter(Boolean)
                    : [];

                const newStoredFile: StoredFile = {
                    id: `file-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
                    organizationId: state.currentOrganization.id,
                    parentId: customer.id,
                    parentType: 'customer',
                    fileName: item.file.name,
                    fileType: item.file.type || 'application/octet-stream',
                    dataUrl: downloadUrl,
                    url: downloadUrl,
                    createdAt: new Date().toISOString(),
                    uploadedBy: state.currentUser ? `${state.currentUser.firstName || ''} ${state.currentUser.lastName || ''}`.trim() : 'Staff Member',
                    label: item.title.trim() || item.file.name,
                    metadata: {
                        category: finalCategory,
                        tags: tagsArray,
                        description: item.description.trim(),
                        sizeBytes: item.file.size,
                        associatedEquipmentId: item.associatedEquipmentId || undefined,
                        associatedJobId: item.associatedJobId || undefined,
                        source: 'cloud_drive_upload'
                    }
                };

                uploadedStoredFiles.push(newStoredFile);
            }

            if (uploadedStoredFiles.length > 0) {
                const updatedFiles = [...(customer.files || []), ...uploadedStoredFiles];
                await db.collection('customers').doc(customer.id).update(cleanUndefinedFields({
                    files: updatedFiles,
                    updatedAt: new Date().toISOString()
                }));

                const updatedCustomer = { ...customer, files: updatedFiles };
                dispatch({ type: 'UPDATE_CUSTOMER', payload: updatedCustomer });
                if (onUpdateCustomer) onUpdateCustomer(updatedCustomer);

                showToast.success(`Successfully uploaded ${uploadedStoredFiles.length} ${uploadedStoredFiles.length === 1 ? 'document' : 'documents'} to Cloud Drive.`);
            }

            setIsUploadModalOpen(false);
            setPendingUploadFiles([]);
        } catch (err: any) {
            console.error("Upload Error:", err);
            showToast.error(`Upload failed: ${err.message || 'Unknown error'}`);
        } finally {
            setIsUploading(false);
            setUploadProgressText('');
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    // Open Edit Metadata Modal
    const handleOpenEditFile = (file: StoredFile) => {
        setEditingFile(file);
        setEditFormTitle(file.label || file.fileName || '');
        const currentCat = String(file.metadata?.category || 'General Documents');
        if (PRESET_CATEGORIES.includes(currentCat)) {
            setEditFormCategory(currentCat);
            setEditFormCustomCategory('');
        } else {
            setEditFormCategory('CUSTOM');
            setEditFormCustomCategory(currentCat);
        }
        const tags = Array.isArray(file.metadata?.tags) 
            ? file.metadata.tags.join(', ') 
            : (typeof file.metadata?.tags === 'string' ? String(file.metadata.tags) : '');
        setEditFormTags(tags);
        setEditFormDescription(String(file.metadata?.description || ''));
        setEditFormEquipmentId(String(file.metadata?.associatedEquipmentId || file.assetId || ''));
    };

    // Save Edited Metadata
    const handleSaveFileMetadata = async () => {
        if (!editingFile) return;
        setIsSavingEdit(true);

        try {
            const finalCat = editFormCategory === 'CUSTOM' && editFormCustomCategory.trim()
                ? editFormCustomCategory.trim()
                : editFormCategory;

            const tagsArray = editFormTags
                ? editFormTags.split(',').map(t => t.trim()).filter(Boolean)
                : [];

            if (editingFile.parentType === 'customer' || !editingFile.parentType) {
                const updatedFiles = (customer.files || []).map(f => {
                    if (f.id === editingFile.id || (editingFile.dataUrl && (f.dataUrl === editingFile.dataUrl || f.url === editingFile.dataUrl))) {
                        return {
                            ...f,
                            label: editFormTitle.trim() || f.fileName,
                            metadata: {
                                ...(f.metadata || {}),
                                category: finalCat,
                                tags: tagsArray,
                                description: editFormDescription.trim(),
                                associatedEquipmentId: editFormEquipmentId || undefined
                            }
                        };
                    }
                    return f;
                });

                await db.collection('customers').doc(customer.id).update(cleanUndefinedFields({
                    files: updatedFiles,
                    updatedAt: new Date().toISOString()
                }));

                const updatedCustomer = { ...customer, files: updatedFiles };
                dispatch({ type: 'UPDATE_CUSTOMER', payload: updatedCustomer });
                if (onUpdateCustomer) onUpdateCustomer(updatedCustomer);
            } else if (editingFile.parentType === 'job' && editingFile.parentId) {
                const targetJob = state.jobs.find(j => j.id === editingFile.parentId);
                if (targetJob) {
                    const updatedJobFiles = (targetJob.files || []).map(jf => {
                        if (jf.id === editingFile.id) {
                            return {
                                ...jf,
                                label: editFormTitle.trim() || jf.fileName,
                                metadata: {
                                    ...(jf.metadata || {}),
                                    category: finalCat,
                                    tags: tagsArray,
                                    description: editFormDescription.trim()
                                }
                            };
                        }
                        return jf;
                    });

                    await db.collection('jobs').doc(targetJob.id).update(cleanUndefinedFields({
                        files: updatedJobFiles,
                        updatedAt: new Date().toISOString()
                    }));
                    dispatch({ type: 'UPDATE_JOB', payload: { id: targetJob.id, files: updatedJobFiles } });
                }
            }

            showToast.success("Document details updated.");
            setEditingFile(null);
        } catch (err: any) {
            console.error("Save Metadata Error:", err);
            showToast.error(`Failed to update metadata: ${err.message || 'Error'}`);
        } finally {
            setIsSavingEdit(false);
        }
    };

    // Delete file
    const handleDeleteFile = async (file: StoredFile) => {
        const fileNameToDisplay = file.label || file.fileName || 'this file';
        if (!await globalConfirm(`Permanently delete "${fileNameToDisplay}" from this customer's drive?`)) {
            return;
        }

        try {
            const fileUrl = file.url || file.dataUrl;

            if (file.parentType === 'customer' || !file.parentType) {
                const updatedFiles = (customer.files || []).filter(f => {
                    if (file.id && f.id === file.id) return false;
                    if (fileUrl && (f.url === fileUrl || f.dataUrl === fileUrl)) return false;
                    return true;
                });

                await db.collection('customers').doc(customer.id).update(cleanUndefinedFields({
                    files: updatedFiles,
                    updatedAt: new Date().toISOString()
                }));

                const updatedCustomer = { ...customer, files: updatedFiles };
                dispatch({ type: 'UPDATE_CUSTOMER', payload: updatedCustomer });
                if (onUpdateCustomer) onUpdateCustomer(updatedCustomer);
            } else if (file.parentType === 'job' && file.parentId) {
                const targetJob = state.jobs.find(j => j.id === file.parentId);
                if (targetJob) {
                    const updatedJobFiles = (targetJob.files || []).filter(jf => {
                        if (file.id && jf.id === file.id) return false;
                        if (fileUrl && (jf.url === fileUrl || jf.dataUrl === fileUrl)) return false;
                        return true;
                    });

                    await db.collection('jobs').doc(targetJob.id).update(cleanUndefinedFields({
                        files: updatedJobFiles,
                        updatedAt: new Date().toISOString()
                    }));
                    dispatch({ type: 'UPDATE_JOB', payload: { id: targetJob.id, files: updatedJobFiles } });
                }
            }

            showToast.success(`Deleted ${fileNameToDisplay}`);
            if (previewingFile?.id === file.id) setPreviewingFile(null);
        } catch (err: any) {
            console.error("Delete Error:", err);
            showToast.error(`Failed to delete: ${err.message || 'Error'}`);
        }
    };

    // Download handler
    const handleDownloadFile = async (file: StoredFile, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        const fileUrl = file.dataUrl || file.url || '';
        if (!fileUrl) {
            showToast.error("Download URL not found.");
            return;
        }
        
        let downloadName = file.fileName || file.label || 'document';
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

    // Render File Type Icon Helper
    const renderFileTypeIcon = (file: StoredFile, sizeClass: string = "w-6 h-6") => {
        const src = file.dataUrl || file.url || '';
        const info = detectFileType(src, file.fileName, file.fileType);

        if (info.isPdf) return <FileText className={`${sizeClass} text-rose-500`} />;
        if (info.isImage) return <ImageIcon className={`${sizeClass} text-emerald-500`} />;
        if (info.isOfficeDoc) return <FileSpreadsheet className={`${sizeClass} text-blue-500`} />;
        if (info.isHtml || info.isText) return <FileCode className={`${sizeClass} text-amber-500`} />;
        return <File className={`${sizeClass} text-slate-500`} />;
    };

    return (
        <div className="space-y-5">
            {/* Top Stats & Quick Actions Header */}
            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="flex items-center gap-3.5">
                        <div className="p-3 bg-primary-50 dark:bg-primary-950/40 text-primary-600 dark:text-primary-400 rounded-xl border border-primary-100 dark:border-primary-900/50 shadow-xs">
                            <HardDrive size={24} />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                                    Customer Cloud Document Drive
                                </h3>
                                <span className="px-2 py-0.5 bg-primary-100 dark:bg-primary-950/60 text-primary-700 dark:text-primary-300 text-[11px] font-bold rounded-full">
                                    {storageMetrics.totalFiles} {storageMetrics.totalFiles === 1 ? 'file' : 'files'}
                                </span>
                            </div>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                Upload, label, categorize, and securely access blueprints, contracts, permits, manuals, and visit attachments for {customer.name}.
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2.5 flex-wrap">
                        <input 
                            ref={fileInputRef}
                            type="file" 
                            multiple 
                            className="hidden" 
                            onChange={(e) => {
                                if (e.target.files) handleFilesSelected(e.target.files);
                            }}
                        />
                        <Button 
                            onClick={() => fileInputRef.current?.click()}
                            className="bg-primary-600 hover:bg-primary-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-sm flex items-center gap-2 cursor-pointer transition-all"
                        >
                            <UploadCloud size={16} />
                            <span>Upload Document(s)</span>
                        </Button>
                    </div>
                </div>

                {/* Quick Storage & Category Counter Badges */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-slate-100 dark:border-slate-800/80 text-xs">
                    <div className="bg-slate-50 dark:bg-slate-800/40 p-2.5 rounded-xl border border-slate-150 dark:border-slate-800">
                        <div className="text-slate-400 dark:text-slate-500 text-[10px] font-bold uppercase tracking-wider">Drive Uploads</div>
                        <div className="text-sm font-extrabold text-slate-800 dark:text-slate-200 mt-0.5">
                            {storageMetrics.directFilesCount} files
                        </div>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-800/40 p-2.5 rounded-xl border border-slate-150 dark:border-slate-800">
                        <div className="text-slate-400 dark:text-slate-500 text-[10px] font-bold uppercase tracking-wider">Visit Attachments</div>
                        <div className="text-sm font-extrabold text-slate-800 dark:text-slate-200 mt-0.5">
                            {storageMetrics.jobFilesCount} files
                        </div>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-800/40 p-2.5 rounded-xl border border-slate-150 dark:border-slate-800">
                        <div className="text-slate-400 dark:text-slate-500 text-[10px] font-bold uppercase tracking-wider">Active Categories</div>
                        <div className="text-sm font-extrabold text-slate-800 dark:text-slate-200 mt-0.5">
                            {availableCategories.length} folders
                        </div>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-800/40 p-2.5 rounded-xl border border-slate-150 dark:border-slate-800">
                        <div className="text-slate-400 dark:text-slate-500 text-[10px] font-bold uppercase tracking-wider">Storage Used</div>
                        <div className="text-sm font-extrabold text-primary-600 dark:text-primary-400 mt-0.5">
                            {formatBytes(storageMetrics.totalBytes)}
                        </div>
                    </div>
                </div>
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
                    <div className="p-2.5 bg-primary-100 dark:bg-primary-950/60 text-primary-600 dark:text-primary-400 rounded-full">
                        <UploadCloud size={20} />
                    </div>
                    <div className="text-left text-xs">
                        <span className="font-bold text-slate-800 dark:text-slate-200">
                            Drag &amp; drop documents anywhere, or <span className="text-primary-600 dark:text-primary-400 underline">browse your device</span>
                        </span>
                        <p className="text-slate-400 text-[11px] mt-0.5">
                            Supports PDF contracts, CAD/blueprints, high-res photos, Word/Excel documents, permits, and equipment manuals.
                        </p>
                    </div>
                </div>
            </div>

            {/* Folders & Category Filter Pills */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 custom-scrollbar">
                {selectedCategory !== 'ALL' && (
                    <button
                        type="button"
                        onClick={() => setSelectedCategory('ALL')}
                        className="px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 cursor-pointer bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 shadow-xs"
                        title="Back to all categories"
                    >
                        <ArrowLeft size={14} />
                        <span>All Categories</span>
                    </button>
                )}
                <button
                    type="button"
                    onClick={() => setSelectedCategory('ALL')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 cursor-pointer ${
                        selectedCategory === 'ALL'
                            ? 'bg-[#123A63] text-white shadow-xs'
                            : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-slate-300'
                    }`}
                >
                    <FolderOpen size={14} />
                    <span>All Folders</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-extrabold ${
                        selectedCategory === 'ALL' ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-500'
                    }`}>
                        {categoryCounts['ALL'] || 0}
                    </span>
                </button>

                {availableCategories.map(cat => {
                    const count = categoryCounts[cat] || 0;
                    const isSelected = selectedCategory === cat;
                    return (
                        <button
                            key={cat}
                            type="button"
                            onClick={() => setSelectedCategory(cat)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 cursor-pointer ${
                                isSelected
                                    ? 'bg-[#123A63] text-white shadow-xs'
                                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-slate-300'
                            }`}
                        >
                            <Folder size={14} className={isSelected ? 'text-sky-300' : 'text-amber-500'} />
                            <span>{cat}</span>
                            {count > 0 && (
                                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-extrabold ${
                                    isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-500'
                                }`}>
                                    {count}
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>

            {/* Filter Toolbar: Search, File Type, Source, View Switcher */}
            <div className="bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col md:flex-row items-center justify-between gap-3">
                {/* Search input */}
                <div className="relative w-full md:w-72">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input 
                        type="text"
                        placeholder="Search document title, tags, notes..."
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

                {/* Secondary Filters */}
                <div className="flex items-center gap-2 flex-wrap w-full md:w-auto justify-end text-xs">
                    {/* File Type Filter */}
                    <select
                        aria-label="Filter by file type"
                        title="Filter by file type"
                        value={selectedFileType}
                        onChange={(e) => setSelectedFileType(e.target.value)}
                        className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-slate-700 dark:text-slate-200 cursor-pointer focus:outline-none"
                    >
                        <option value="ALL">All File Types</option>
                        <option value="pdf">PDF Documents</option>
                        <option value="image">Images &amp; Photos</option>
                        <option value="office">Word / Excel / Office</option>
                        <option value="other">Other Formats</option>
                    </select>

                    {/* Source Filter */}
                    <select
                        aria-label="Filter by document origin"
                        title="Filter by document origin"
                        value={sourceFilter}
                        onChange={(e) => setSourceFilter(e.target.value as any)}
                        className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-slate-700 dark:text-slate-200 cursor-pointer focus:outline-none"
                    >
                        <option value="ALL">All Sources (Drive &amp; Visits)</option>
                        <option value="customer">Direct Drive Uploads</option>
                        <option value="job">Service Visit Attachments</option>
                    </select>

                    {/* Sort Dropdown */}
                    <select
                        aria-label="Sort documents"
                        title="Sort documents"
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value as any)}
                        className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-slate-700 dark:text-slate-200 cursor-pointer focus:outline-none"
                    >
                        <option value="date_desc">Newest First</option>
                        <option value="date_asc">Oldest First</option>
                        <option value="name_asc">Name (A &rarr; Z)</option>
                        <option value="name_desc">Name (Z &rarr; A)</option>
                        <option value="size_desc">Size (Largest)</option>
                        <option value="size_asc">Size (Smallest)</option>
                    </select>

                    {/* View Switcher */}
                    <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-xl border border-slate-200 dark:border-slate-700">
                        <button
                            type="button"
                            onClick={() => setViewMode('grid')}
                            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                                viewMode === 'grid' 
                                    ? 'bg-white dark:bg-slate-700 text-primary-600 shadow-xs' 
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
                                    ? 'bg-white dark:bg-slate-700 text-primary-600 shadow-xs' 
                                    : 'text-slate-400 hover:text-slate-600'
                            }`}
                            title="List View"
                        >
                            <List size={14} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Document Results Content */}
            {filteredFiles.length === 0 ? (
                <div className="text-center py-16 bg-white dark:bg-slate-900 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl p-6">
                    <div className="p-4 bg-slate-100 dark:bg-slate-800 rounded-full w-16 h-16 mx-auto flex items-center justify-center text-slate-400 mb-3">
                        <FolderOpen size={32} />
                    </div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">No documents found</h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
                        {searchTerm || selectedCategory !== 'ALL' || selectedFileType !== 'ALL' || sourceFilter !== 'ALL'
                            ? 'Try clearing your search query or filters to see more documents.'
                            : 'Upload your first contract, blueprint, or manual to begin building this customer’s cloud drive.'}
                    </p>
                    <div className="mt-4">
                        <Button 
                            onClick={() => fileInputRef.current?.click()}
                            variant="secondary"
                            className="text-xs font-bold"
                        >
                            <Plus size={14} className="mr-1" /> Upload New File
                        </Button>
                    </div>
                </div>
            ) : viewMode === 'grid' ? (
                /* GRID VIEW */
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {filteredFiles.map(file => {
                        const fileSrc = file.dataUrl || file.url || '';
                        const typeInfo = detectFileType(fileSrc, file.fileName, file.fileType);
                        const categoryName = String(file.metadata?.category || (file.metadata as any)?.type || 'General Documents');
                        const displayTitle = file.label || file.fileName;
                        const isJobFile = file.parentType === 'job';
                        const tags: string[] = Array.isArray(file.metadata?.tags) 
                            ? file.metadata.tags 
                            : (typeof file.metadata?.tags === 'string' ? file.metadata.tags.split(',').map((t: string) => t.trim()).filter(Boolean) : []);

                        return (
                            <div 
                                key={file.id}
                                className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-primary-500/50 hover:shadow-md transition-all flex flex-col justify-between overflow-hidden group"
                            >
                                {/* Top preview thumbnail area */}
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

                                    {/* Hover overlay actions */}
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
                                        <button
                                            type="button"
                                            onClick={(e) => { e.stopPropagation(); handleOpenEditFile(file); }}
                                            className="p-2 bg-white/90 hover:bg-white text-slate-900 rounded-full shadow-md transition-transform hover:scale-110 cursor-pointer"
                                            title="Edit Label / Details"
                                        >
                                            <Edit3 size={14} />
                                        </button>
                                    </div>

                                    {/* Origin Badge */}
                                    <div className="absolute top-2 left-2 flex items-center gap-1">
                                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider backdrop-blur-md shadow-xs ${
                                            isJobFile 
                                                ? 'bg-indigo-600/90 text-white' 
                                                : 'bg-slate-900/80 text-white'
                                        }`}>
                                            {isJobFile ? 'Visit Attachment' : 'Drive File'}
                                        </span>
                                    </div>

                                    {/* Category Pill */}
                                    <div className="absolute top-2 right-2">
                                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-white/90 dark:bg-slate-900/90 text-slate-700 dark:text-slate-300 backdrop-blur-md shadow-xs max-w-[120px] truncate block">
                                            {categoryName}
                                        </span>
                                    </div>
                                </div>

                                {/* File Details Body */}
                                <div className="p-3.5 space-y-2 flex-1 flex flex-col justify-between">
                                    <div>
                                        <h5 
                                            onClick={() => setPreviewingFile(file)}
                                            className="text-xs font-bold text-slate-900 dark:text-white truncate cursor-pointer hover:text-primary-600 dark:hover:text-primary-400"
                                            title={displayTitle}
                                        >
                                            {displayTitle}
                                        </h5>
                                        {file.label && file.fileName && file.label !== file.fileName && (
                                            <p className="text-[10px] text-slate-400 truncate mt-0.5" title={file.fileName}>
                                                {file.fileName}
                                            </p>
                                        )}

                                        {file.metadata?.description && (
                                            <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 mt-1 italic">
                                                {String(file.metadata.description)}
                                            </p>
                                        )}

                                        {/* Tags */}
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

                                    {/* Bottom Meta & Action Row */}
                                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[10px] text-slate-400">
                                        <div className="flex items-center gap-2">
                                            <span>{new Date(file.createdAt || 0).toLocaleDateString()}</span>
                                            <span>&bull;</span>
                                            <span>{formatBytes(file.metadata?.sizeBytes || file.metadata?.size)}</span>
                                        </div>

                                        <div className="flex items-center gap-1">
                                            <button
                                                type="button"
                                                onClick={(e) => handleDownloadFile(file, e)}
                                                className="p-1 hover:text-primary-600 transition-colors cursor-pointer"
                                                title="Download"
                                            >
                                                <Download size={13} />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={(e) => { e.stopPropagation(); handleOpenEditFile(file); }}
                                                className="p-1 hover:text-primary-600 transition-colors cursor-pointer"
                                                title="Edit Info"
                                            >
                                                <Edit3 size={13} />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={(e) => { e.stopPropagation(); handleDeleteFile(file); }}
                                                className="p-1 hover:text-red-600 transition-colors cursor-pointer"
                                                title="Delete"
                                            >
                                                <Trash2 size={13} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                /* LIST VIEW */
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                            <thead className="bg-slate-50 dark:bg-slate-800/50 text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500 border-b border-slate-200 dark:border-slate-800">
                                <tr>
                                    <th className="px-4 py-3">Document Name</th>
                                    <th className="px-4 py-3">Folder / Category</th>
                                    <th className="px-4 py-3">Source</th>
                                    <th className="px-4 py-3">Size</th>
                                    <th className="px-4 py-3">Date Added</th>
                                    <th className="px-4 py-3">Uploaded By</th>
                                    <th className="px-4 py-3 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {filteredFiles.map(file => {
                                    const categoryName = String(file.metadata?.category || (file.metadata as any)?.type || 'General Documents');
                                    const displayTitle = file.label || file.fileName;
                                    const isJobFile = file.parentType === 'job';

                                    return (
                                        <tr 
                                            key={file.id}
                                            className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors cursor-pointer group"
                                            onClick={() => setPreviewingFile(file)}
                                        >
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-2.5">
                                                    {renderFileTypeIcon(file, "w-5 h-5 shrink-0")}
                                                    <div className="min-w-0 max-w-xs">
                                                        <p className="font-bold text-slate-900 dark:text-white truncate group-hover:text-primary-600 transition-colors">
                                                            {displayTitle}
                                                        </p>
                                                        {file.label && file.fileName && file.label !== file.fileName && (
                                                            <p className="text-[10px] text-slate-400 truncate">
                                                                {file.fileName}
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                                                    <Folder size={11} className="text-amber-500" />
                                                    {categoryName}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                                                    isJobFile 
                                                        ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300' 
                                                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                                                }`}>
                                                    {isJobFile ? 'Visit' : 'Drive'}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                                                {formatBytes(file.metadata?.sizeBytes || file.metadata?.size)}
                                            </td>
                                            <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                                                {new Date(file.createdAt || 0).toLocaleDateString()}
                                            </td>
                                            <td className="px-4 py-3 text-slate-500 dark:text-slate-400 truncate max-w-[120px]">
                                                {file.uploadedBy || 'Staff Member'}
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
                                                    <button
                                                        type="button"
                                                        onClick={() => handleOpenEditFile(file)}
                                                        className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors"
                                                        title="Edit Details"
                                                    >
                                                        <Edit3 size={13} />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleDeleteFile(file)}
                                                        className="p-1.5 rounded-lg bg-red-50 hover:bg-red-100 dark:bg-red-950/40 dark:hover:bg-red-900/60 text-red-600 transition-colors"
                                                        title="Delete"
                                                    >
                                                        <Trash2 size={13} />
                                                    </button>
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

            {/* UPLOAD & LABEL MODAL */}
            <Modal 
                isOpen={isUploadModalOpen} 
                onClose={() => !isUploading && setIsUploadModalOpen(false)}
                title="Upload & Label Documents"
                size="lg"
            >
                <div className="space-y-5 p-1">
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                        Label your documents with custom names, category folders, and tags for quick retrieval in {customer.name}’s Cloud Drive.
                    </p>

                    <div className="space-y-4 max-h-[60vh] overflow-y-auto custom-scrollbar pr-1">
                        {pendingUploadFiles.map((item, idx) => (
                            <div key={idx} className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <FileText size={16} className="text-primary-600 shrink-0" />
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
                                            Document Name / Title *
                                        </label>
                                        <input
                                            type="text"
                                            value={item.title}
                                            onChange={(e) => {
                                                const updated = [...pendingUploadFiles];
                                                updated[idx].title = e.target.value;
                                                setPendingUploadFiles(updated);
                                            }}
                                            placeholder="e.g. Master Service Agreement 2026"
                                            className="w-full text-xs p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                                            Folder / Category *
                                        </label>
                                        <select
                                            aria-label="Document Category"
                                            title="Document Category"
                                            value={item.category}
                                            onChange={(e) => {
                                                const updated = [...pendingUploadFiles];
                                                updated[idx].category = e.target.value;
                                                setPendingUploadFiles(updated);
                                            }}
                                            className="w-full text-xs p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                                        >
                                            {PRESET_CATEGORIES.map(cat => (
                                                <option key={cat} value={cat}>{cat}</option>
                                            ))}
                                            <option value="CUSTOM">+ Create Custom Category...</option>
                                        </select>
                                    </div>
                                </div>

                                {item.category === 'CUSTOM' && (
                                    <div>
                                        <label className="block text-[11px] font-bold text-primary-600 dark:text-primary-400 mb-1">
                                            Custom Category Name *
                                        </label>
                                        <input
                                            type="text"
                                            value={item.customCategory || ''}
                                            onChange={(e) => {
                                                const updated = [...pendingUploadFiles];
                                                updated[idx].customCategory = e.target.value;
                                                setPendingUploadFiles(updated);
                                            }}
                                            placeholder="e.g. Environmental Surveys"
                                            className="w-full text-xs p-2 rounded-xl border border-primary-300 dark:border-primary-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                                        />
                                    </div>
                                )}

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                                            Tags (comma separated)
                                        </label>
                                        <input
                                            type="text"
                                            value={item.tags}
                                            onChange={(e) => {
                                                const updated = [...pendingUploadFiles];
                                                updated[idx].tags = e.target.value;
                                                setPendingUploadFiles(updated);
                                            }}
                                            placeholder="e.g. Signed, Rooftop, 2026"
                                            className="w-full text-xs p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                                            Link to Equipment Unit (Optional)
                                        </label>
                                        <select
                                            aria-label="Link to Equipment"
                                            title="Link to Equipment"
                                            value={item.associatedEquipmentId || ''}
                                            onChange={(e) => {
                                                const updated = [...pendingUploadFiles];
                                                updated[idx].associatedEquipmentId = e.target.value;
                                                setPendingUploadFiles(updated);
                                            }}
                                            className="w-full text-xs p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                                        >
                                            <option value="">None (Customer General)</option>
                                            {(customer.equipment || []).map((eq: EquipmentAsset) => {
                                                const eqTitle = eq.name || eq.systemNickname || eq.modelNumber || eq.model || eq.brand || 'Unit';
                                                const eqSerial = eq.serialNumber || eq.serial || 'N/A';
                                                return (
                                                    <option key={eq.id} value={eq.id}>
                                                        {eqTitle} - SN: {eqSerial}
                                                    </option>
                                                );
                                            })}
                                        </select>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                                        Notes / Description (Optional)
                                    </label>
                                    <input
                                        type="text"
                                        value={item.description}
                                        onChange={(e) => {
                                            const updated = [...pendingUploadFiles];
                                            updated[idx].description = e.target.value;
                                            setPendingUploadFiles(updated);
                                        }}
                                        placeholder="Add any internal context or expiration note..."
                                        className="w-full text-xs p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                                    />
                                </div>
                            </div>
                        ))}
                    </div>

                    {isUploading && (
                        <div className="p-3 bg-primary-50 dark:bg-primary-950/40 rounded-xl border border-primary-200 dark:border-primary-800 text-center">
                            <p className="text-xs font-bold text-primary-700 dark:text-primary-300 animate-pulse">
                                {uploadProgressText || 'Uploading to Cloud Drive...'}
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
                            disabled={isUploading || pendingUploadFiles.length === 0}
                            className="bg-primary-600 hover:bg-primary-700 text-white font-bold"
                        >
                            {isUploading ? 'Uploading...' : `Upload ${pendingUploadFiles.length} ${pendingUploadFiles.length === 1 ? 'Document' : 'Documents'}`}
                        </Button>
                    </div>
                </div>
            </Modal>

            {/* EDIT DOCUMENT DETAILS MODAL */}
            {editingFile && (
                <Modal
                    isOpen={!!editingFile}
                    onClose={() => !isSavingEdit && setEditingFile(null)}
                    title="Edit Document Details"
                    size="md"
                >
                    <div className="space-y-4 p-1">
                        <div>
                            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                Document Title / Label *
                            </label>
                            <input
                                type="text"
                                value={editFormTitle}
                                onChange={(e) => setEditFormTitle(e.target.value)}
                                placeholder="Enter document label"
                                className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                            />
                            <p className="text-[10px] text-slate-400 mt-1">Original file: {editingFile.fileName}</p>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                Folder / Category *
                            </label>
                            <select
                                aria-label="Category"
                                title="Category"
                                value={editFormCategory}
                                onChange={(e) => setEditFormCategory(e.target.value)}
                                className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                            >
                                {PRESET_CATEGORIES.map(cat => (
                                    <option key={cat} value={cat}>{cat}</option>
                                ))}
                                <option value="CUSTOM">+ Create Custom Category...</option>
                            </select>
                        </div>

                        {editFormCategory === 'CUSTOM' && (
                            <div>
                                <label className="block text-xs font-bold text-primary-600 dark:text-primary-400 mb-1">
                                    Custom Category Name *
                                </label>
                                <input
                                    type="text"
                                    value={editFormCustomCategory}
                                    onChange={(e) => setEditFormCustomCategory(e.target.value)}
                                    placeholder="e.g. Fire Safety Certifications"
                                    className="w-full text-xs p-2.5 rounded-xl border border-primary-300 dark:border-primary-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                                />
                            </div>
                        )}

                        <div>
                            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                Tags (comma separated)
                            </label>
                            <input
                                type="text"
                                value={editFormTags}
                                onChange={(e) => setEditFormTags(e.target.value)}
                                placeholder="e.g. 2026, Boiler, Urgent"
                                className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                Link to Equipment Unit
                            </label>
                            <select
                                aria-label="Link to Equipment Unit"
                                title="Link to Equipment Unit"
                                value={editFormEquipmentId}
                                onChange={(e) => setEditFormEquipmentId(e.target.value)}
                                className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                            >
                                <option value="">None (Customer General)</option>
                                {(customer.equipment || []).map((eq: EquipmentAsset) => {
                                    const eqTitle = eq.name || eq.systemNickname || eq.modelNumber || eq.model || eq.brand || 'Unit';
                                    const eqSerial = eq.serialNumber || eq.serial || 'N/A';
                                    return (
                                        <option key={eq.id} value={eq.id}>
                                            {eqTitle} - SN: {eqSerial}
                                        </option>
                                    );
                                })}
                            </select>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                Notes / Description
                            </label>
                            <Textarea
                                value={editFormDescription}
                                onChange={(e) => setEditFormDescription(e.target.value)}
                                placeholder="Additional notes or specifications..."
                                rows={3}
                            />
                        </div>

                        <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                            <Button variant="secondary" onClick={() => setEditingFile(null)} disabled={isSavingEdit}>
                                Cancel
                            </Button>
                            <Button onClick={handleSaveFileMetadata} disabled={isSavingEdit} className="bg-primary-600 hover:bg-primary-700 text-white font-bold">
                                {isSavingEdit ? 'Saving...' : 'Save Changes'}
                            </Button>
                        </div>
                    </div>
                </Modal>
            )}

            {/* FULL UNIVERSAL FILE PREVIEW MODAL */}
            {previewingFile && (() => {
                const fileSrc = previewingFile.dataUrl || previewingFile.url || '';
                const typeInfo = detectFileType(fileSrc, previewingFile.fileName, previewingFile.fileType);
                const displayTitle = previewingFile.label || previewingFile.fileName;
                const previewCategory = String(previewingFile.metadata?.category || 'General Documents');
                const previewSize = formatBytes(previewingFile.metadata?.sizeBytes || previewingFile.metadata?.size);
                const previewDescription = previewingFile.metadata?.description ? String(previewingFile.metadata.description) : '';
                const previewTags: string[] = Array.isArray(previewingFile.metadata?.tags)
                    ? previewingFile.metadata.tags
                    : (typeof previewingFile.metadata?.tags === 'string' ? [previewingFile.metadata.tags] : []);

                return (
                    <Modal
                        isOpen={!!previewingFile}
                        onClose={() => setPreviewingFile(null)}
                        title=""
                        size="xl"
                    >
                        <div className="space-y-4 p-1">
                            {/* Preview Header */}
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h4 className="text-base font-extrabold text-slate-900 dark:text-white">
                                            {displayTitle}
                                        </h4>
                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary-100 dark:bg-primary-950/60 text-primary-700 dark:text-primary-300">
                                            {previewCategory}
                                        </span>
                                    </div>
                                    <p className="text-xs text-slate-400 mt-0.5">
                                        {previewingFile.fileName} &bull; {previewSize} &bull; Added {new Date(previewingFile.createdAt || 0).toLocaleDateString()}
                                    </p>
                                </div>

                                <div className="flex items-center gap-2">
                                    <Button
                                        onClick={() => handleOpenEditFile(previewingFile)}
                                        variant="secondary"
                                        className="text-xs flex items-center gap-1.5"
                                    >
                                        <Edit3 size={14} /> Edit Info
                                    </Button>
                                    <Button
                                        onClick={(e) => handleDownloadFile(previewingFile, e)}
                                        className="bg-primary-600 hover:bg-primary-700 text-white text-xs font-bold flex items-center gap-1.5"
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

                            {/* Preview Viewer Box */}
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
                                            className="bg-primary-600 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-primary-700 inline-flex items-center gap-2"
                                        >
                                            <Download size={16} /> Download File
                                        </Button>
                                    </div>
                                )}
                            </div>

                            {/* Additional Metadata Details Footer */}
                            {(previewDescription || previewTags.length > 0) && (
                                <div className="p-3 bg-slate-50 dark:bg-slate-850 rounded-xl border border-slate-200 dark:border-slate-800 text-xs space-y-1.5">
                                    {previewDescription && (
                                        <p className="text-slate-600 dark:text-slate-300">
                                            <span className="font-bold">Notes:</span> {previewDescription}
                                        </p>
                                    )}
                                    {previewTags.length > 0 && (
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                            <span className="font-bold text-slate-500">Tags:</span>
                                            {previewTags.map((tag: string, i: number) => (
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
        </div>
    );
};

export default CustomerDocumentDrive;
