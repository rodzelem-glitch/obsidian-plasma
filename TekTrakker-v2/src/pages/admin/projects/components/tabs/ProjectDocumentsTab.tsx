import React, { useState, useMemo, useRef } from 'react';
import { 
    UploadCloud, Download, Eye, Trash2, Edit3, Search, Filter, Folder, FolderOpen, 
    FileText, Image as ImageIcon, FileSpreadsheet, FileCode, File, Plus, LayoutGrid, List, 
    Sparkles, Clock, HardDrive, ExternalLink, X, Check, Tag, ChevronRight, AlertCircle, 
    Calendar, User, Layers, ShieldCheck, FileCheck, RefreshCw, DollarSign, Wrench, 
    HardHat, Briefcase, Paperclip, CheckCircle2, ArrowUpDown, RotateCcw, FileMinus, Archive
} from 'lucide-react';
import Modal from 'components/ui/Modal';
import Button from 'components/ui/Button';
import Input from 'components/ui/Input';
import Select from 'components/ui/Select';
import Textarea from 'components/ui/Textarea';
import Card from 'components/ui/Card';
import Table from 'components/ui/Table';
import { useAppContext } from 'context/AppContext';
import { useLanguage } from 'context/LanguageContext';
import { db } from 'lib/firebase';
import { uploadFileToStorage } from 'lib/storageService';
import { detectFileType } from 'lib/fileViewerHelper';
import showToast from 'lib/toast';
import { globalConfirm } from 'lib/globalConfirm';
import { cleanUndefinedFields, isInternalExpenseFile } from 'lib/utils';
import type { Project, StoredFile, Job, Expense, Proposal, Subcontractor, Permit } from 'types';

export interface ProjectDocumentsTabProps {
    project: Project;
    onUpdateProject?: (updatedProject: Project) => void;
}

export const PROJECT_DOCUMENT_CATEGORIES = [
    'Subcontractor Quotes',
    'Permits & Municipal Forms',
    'Parts & Vendor Quotes',
    'Receipts & Expense Invoices',
    'Contracts & Change Orders',
    'Blueprints & Schematics',
    'Site Photos & Media',
    'Inspection & Sign-offs',
    'General Project Documents'
];

export interface DocumentMetadata {
    category?: string;
    description?: string;
    tags?: string[] | string;
    amount?: number | string;
    associatedJobId?: string;
    associatedSubcontractorId?: string;
    associatedPermitId?: string;
    notes?: string;
    sizeBytes?: number;
    size?: number;
    [key: string]: any;
}

export interface UnifiedFile extends Omit<StoredFile, 'metadata'> {
    metadata?: DocumentMetadata;
    sourceType: 'project' | 'job' | 'expense' | 'proposal' | 'permit';
    sourceLabel: string;
    sourceRefId?: string;
    financialAmount?: number;
    isRemoved?: boolean;
}

const ProjectDocumentsTab: React.FC<ProjectDocumentsTabProps> = ({ project, onUpdateProject }) => {
    const { state, dispatch } = useAppContext();
    const { t } = useLanguage();

    // View & Filter States
    const [documentTabMode, setDocumentTabMode] = useState<'active' | 'removed'>('active');
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
    const [selectedSource, setSelectedSource] = useState<'ALL' | 'project' | 'job' | 'expense' | 'proposal'>('ALL');
    const [searchTerm, setSearchTerm] = useState('');
    const [sortBy, setSortBy] = useState<'date_desc' | 'date_asc' | 'name_asc' | 'name_desc' | 'amount_desc'>('date_desc');
    const [isDragOver, setIsDragOver] = useState(false);

    // Upload Modal State
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
    const [pendingUploadFiles, setPendingUploadFiles] = useState<Array<{
        file: File;
        title: string;
        category: string;
        customCategory?: string;
        associatedJobId?: string;
        associatedSubcontractorId?: string;
        associatedPermitId?: string;
        amount?: string;
        tags: string;
        description: string;
    }>>([]);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgressText, setUploadProgressText] = useState('');
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    // Edit Document Info State
    const [editingFile, setEditingFile] = useState<UnifiedFile | null>(null);
    const [editFormTitle, setEditFormTitle] = useState('');
    const [editFormCategory, setEditFormCategory] = useState('');
    const [editFormCustomCategory, setEditFormCustomCategory] = useState('');
    const [editFormJobId, setEditFormJobId] = useState('');
    const [editFormSubId, setEditFormSubId] = useState('');
    const [editFormPermitId, setEditFormPermitId] = useState('');
    const [editFormAmount, setEditFormAmount] = useState('');
    const [editFormTags, setEditFormTags] = useState('');
    const [editFormDescription, setEditFormDescription] = useState('');
    const [isSavingEdit, setIsSavingEdit] = useState(false);

    // Preview Modal State
    const [previewingFile, setPreviewingFile] = useState<UnifiedFile | null>(null);

    // Associated Entities for Linking Dropdowns
    const projectJobs = useMemo(() => {
        return (state.jobs || []).filter(j => j.projectId === project.id);
    }, [state.jobs, project.id]);

    const projectSubs = useMemo(() => {
        const subIds = project.assignedSubcontractorIds || [];
        return (state.subcontractors || []).filter(s => subIds.includes(s.id));
    }, [state.subcontractors, project.assignedSubcontractorIds]);

    const projectPermits = useMemo(() => {
        return project.permits || [];
    }, [project.permits]);

    // 1. Unified file aggregation across direct project files, jobs, expenses, proposals
    const allUnifiedFiles = useMemo<UnifiedFile[]>(() => {
        const list: UnifiedFile[] = [];
        const excludedIds = new Set(project.excludedFileIds || []);

        // Helper to dynamically resolve live proposal amounts from state.proposals
        const getLiveProposalAmount = (f: StoredFile) => {
            let amount = f.metadata?.amount ? Number(f.metadata.amount) : undefined;
            if (f.id?.toLowerCase().includes('prop-') || f.label?.includes('PROP-')) {
                const matchingProp = (state.proposals || []).find(p => 
                    (p.proposalNumber && (f.label?.includes(p.proposalNumber) || f.id?.includes(p.proposalNumber))) || 
                    (p.id && (f.id?.toLowerCase().includes(p.id.toLowerCase().replace(/[^a-z0-9]/g, '')) || f.label?.toLowerCase().includes(p.id.toLowerCase())))
                );
                if (matchingProp) {
                    const liveTotal = matchingProp.recommendedRoundedTotal || matchingProp.calculatedTotal || matchingProp.total;
                    if (liveTotal) amount = liveTotal;
                }
            }
            return amount;
        };

        // Direct active project files
        if (project.files && Array.isArray(project.files)) {
            project.files.forEach(f => {
                if (isInternalExpenseFile(f)) return;
                const liveAmount = getLiveProposalAmount(f);
                list.push({
                    ...f,
                    sourceType: 'project',
                    sourceLabel: t('Project File'),
                    financialAmount: liveAmount,
                    metadata: {
                        ...f.metadata,
                        amount: liveAmount !== undefined ? liveAmount : f.metadata?.amount
                    } as DocumentMetadata | undefined,
                    isRemoved: false
                });
            });
        }

        // Direct removed project files (archived non-destructively)
        if (project.removedFiles && Array.isArray(project.removedFiles)) {
            project.removedFiles.forEach(f => {
                if (isInternalExpenseFile(f)) return;
                const liveAmount = getLiveProposalAmount(f);
                list.push({
                    ...f,
                    sourceType: 'project',
                    sourceLabel: t('Project File'),
                    financialAmount: liveAmount,
                    metadata: {
                        ...f.metadata,
                        amount: liveAmount !== undefined ? liveAmount : f.metadata?.amount
                    } as DocumentMetadata | undefined,
                    isRemoved: true
                });
            });
        }

        // Files from linked jobs
        projectJobs.forEach(job => {
            if (job.files && Array.isArray(job.files)) {
                job.files.forEach(jf => {
                    if (isInternalExpenseFile(jf)) return;
                    if (!list.some(existing => existing.id === jf.id)) {
                        const jobDisplayTitle = (job.tasks && job.tasks.length > 0 ? job.tasks.join(', ') : '') || `Job #${job.id.slice(-6).toUpperCase()}`;
                        list.push({
                            ...jf,
                            sourceType: 'job',
                            sourceLabel: `Job #${job.id.slice(-6).toUpperCase()} (${jobDisplayTitle})`,
                            sourceRefId: job.id,
                            isRemoved: excludedIds.has(jf.id),
                            metadata: {
                                ...(jf.metadata as any || {}),
                                category: String(jf.metadata?.category || 'Site Photos & Media')
                            }
                        });
                    }
                });
            }
        });

        // Receipts from project expenses
        const projectExpenses = (state.expenses || []).filter(e => e.projectId === project.id);
        projectExpenses.forEach(exp => {
            const receiptUrls: string[] = Array.isArray((exp as any).receiptUrls) 
                ? (exp as any).receiptUrls 
                : (exp.receiptUrl ? [exp.receiptUrl] : ((exp as any).receiptData ? [(exp as any).receiptData] : []));

            receiptUrls.forEach((rUrl, idx) => {
                if (!rUrl) return;
                const receiptId = `exp-rec-${exp.id}-${idx}`;
                if (!list.some(existing => (existing.url || existing.dataUrl) === rUrl || existing.id === receiptId)) {
                    list.push({
                        id: receiptId,
                        organizationId: exp.organizationId || state.currentOrganization?.id || '',
                        parentId: exp.id,
                        parentType: 'project',
                        fileName: `Receipt_${exp.vendor || 'Vendor'}_$${exp.amount || 0}_${(exp.date || '').slice(0, 10)}.jpg`,
                        fileType: rUrl.startsWith('data:image/') || rUrl.includes('.jpg') || rUrl.includes('.png') ? 'image/jpeg' : 'application/pdf',
                        url: rUrl,
                        dataUrl: rUrl,
                        label: `${exp.vendor || 'Vendor'} Receipt - $${(exp.amount || 0).toLocaleString()}`,
                        createdAt: exp.date || exp.createdAt || new Date().toISOString(),
                        uploadedBy: exp.paidBy || 'Admin',
                        sourceType: 'expense',
                        sourceLabel: `Expense: ${exp.vendor || 'Vendor'} ($${(exp.amount || 0).toLocaleString()})`,
                        sourceRefId: exp.id,
                        financialAmount: exp.amount,
                        isRemoved: excludedIds.has(receiptId),
                        metadata: {
                            category: 'Receipts & Expense Invoices',
                            amount: exp.amount,
                            description: exp.description || (exp as any).notes || ''
                        }
                    });
                }
            });
        });

        // Proposal documents & attachments
        const projectProposals = (state.proposals || []).filter(p => p.projectId === project.id);
        projectProposals.forEach(prop => {
            const propFiles = (prop as any).files;
            if (propFiles && Array.isArray(propFiles)) {
                propFiles.forEach((pf: any) => {
                    if (!list.some(existing => existing.id === pf.id)) {
                        const propAmount = prop.recommendedRoundedTotal || prop.calculatedTotal || prop.total;
                        list.push({
                            ...pf,
                            sourceType: 'proposal',
                            sourceLabel: `Proposal #${prop.proposalNumber || prop.id.slice(-6).toUpperCase()}`,
                            sourceRefId: prop.id,
                            financialAmount: propAmount,
                            isRemoved: excludedIds.has(pf.id),
                            metadata: {
                                ...(pf.metadata || {}),
                                amount: propAmount,
                                category: String(pf.metadata?.category || 'Contracts & Change Orders')
                            }
                        });
                    }
                });
            }
        });

        return list;
    }, [project.files, project.removedFiles, project.excludedFileIds, projectJobs, project.id, state.expenses, state.proposals, state.currentOrganization?.id, t]);

    const activeFiles = useMemo(() => allUnifiedFiles.filter(f => !f.isRemoved), [allUnifiedFiles]);
    const removedFilesList = useMemo(() => allUnifiedFiles.filter(f => f.isRemoved), [allUnifiedFiles]);

    // Available categories list (presets + any custom category in use)
    const availableCategories = useMemo(() => {
        const categoriesSet = new Set<string>(PROJECT_DOCUMENT_CATEGORIES);
        allUnifiedFiles.forEach(f => {
            const cat = f.metadata?.category;
            if (cat && typeof cat === 'string' && cat.trim()) {
                categoriesSet.add(cat.trim());
            }
        });
        return Array.from(categoriesSet);
    }, [allUnifiedFiles]);

    // Filter & Sort
    const filteredFiles = useMemo(() => {
        const targetList = documentTabMode === 'active' ? activeFiles : removedFilesList;
        return targetList.filter(file => {
            const category = file.metadata?.category || 'General Project Documents';
            if (selectedCategory !== 'ALL' && category !== selectedCategory) {
                return false;
            }

            if (selectedSource !== 'ALL' && file.sourceType !== selectedSource) {
                return false;
            }

            if (searchTerm.trim()) {
                const term = searchTerm.toLowerCase();
                const title = (file.label || file.fileName || '').toLowerCase();
                const desc = String(file.metadata?.description || '').toLowerCase();
                const tags = Array.isArray(file.metadata?.tags) 
                    ? file.metadata.tags.join(' ').toLowerCase() 
                    : String(file.metadata?.tags || '').toLowerCase();
                const source = (file.sourceLabel || '').toLowerCase();
                
                if (!title.includes(term) && !desc.includes(term) && !tags.includes(term) && !source.includes(term)) {
                    return false;
                }
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
                return (a.label || a.fileName || '').localeCompare(b.label || b.fileName || '');
            }
            if (sortBy === 'name_desc') {
                return (b.label || b.fileName || '').localeCompare(a.label || a.fileName || '');
            }
            if (sortBy === 'amount_desc') {
                return (b.financialAmount || 0) - (a.financialAmount || 0);
            }
            return 0;
        });
    }, [activeFiles, removedFilesList, documentTabMode, selectedCategory, selectedSource, searchTerm, sortBy]);

    // Statistics
    const metrics = useMemo(() => {
        const total = activeFiles.length;
        const subQuotesCount = activeFiles.filter(f => f.metadata?.category === 'Subcontractor Quotes').length;
        const partsQuotesCount = activeFiles.filter(f => f.metadata?.category === 'Parts & Vendor Quotes').length;
        const receiptsCount = activeFiles.filter(f => f.metadata?.category === 'Receipts & Expense Invoices').length;
        const permitsCount = activeFiles.filter(f => f.metadata?.category === 'Permits & Municipal Forms').length;
        const totalAmountTracked = activeFiles.reduce((sum, f) => sum + (f.financialAmount || 0), 0);
        const removedCount = removedFilesList.length;
        return { total, subQuotesCount, partsQuotesCount, receiptsCount, permitsCount, totalAmountTracked, removedCount };
    }, [activeFiles, removedFilesList]);

    // Format bytes helper
    const formatBytes = (bytes?: number) => {
        if (!bytes || bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    };

    // --- UPLOAD HANDLERS ---
    const handleFilesSelected = (files: FileList | null) => {
        if (!files || files.length === 0) return;

        const newEntries = Array.from(files).map(file => {
            let initialCategory = 'General Project Documents';
            const lowerName = file.name.toLowerCase();
            if (lowerName.includes('quote') || lowerName.includes('estimate') || lowerName.includes('sub')) {
                initialCategory = 'Subcontractor Quotes';
            } else if (lowerName.includes('part') || lowerName.includes('carrier') || lowerName.includes('trane') || lowerName.includes('supply')) {
                initialCategory = 'Parts & Vendor Quotes';
            } else if (lowerName.includes('permit') || lowerName.includes('city') || lowerName.includes('inspection')) {
                initialCategory = 'Permits & Municipal Forms';
            } else if (lowerName.includes('receipt') || lowerName.includes('invoice') || lowerName.includes('bill')) {
                initialCategory = 'Receipts & Expense Invoices';
            } else if (lowerName.includes('contract') || lowerName.includes('agreement') || lowerName.includes('proposal')) {
                initialCategory = 'Contracts & Change Orders';
            } else if (lowerName.includes('plan') || lowerName.includes('blueprint') || lowerName.includes('schematic') || lowerName.includes('dwg')) {
                initialCategory = 'Blueprints & Schematics';
            } else if (file.type.startsWith('image/')) {
                initialCategory = 'Site Photos & Media';
            }

            const cleanTitle = file.name
                .replace(/\.[^/.]+$/, '')
                .replace(/[_-]+/g, ' ')
                .trim();

            return {
                file,
                title: cleanTitle || file.name,
                category: initialCategory,
                tags: '',
                description: '',
                amount: '',
                associatedJobId: '',
                associatedSubcontractorId: '',
                associatedPermitId: ''
            };
        });

        setPendingUploadFiles(prev => [...prev, ...newEntries]);
        setIsUploadModalOpen(true);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            handleFilesSelected(e.dataTransfer.files);
        }
    };

    const handleExecuteUpload = async () => {
        if (pendingUploadFiles.length === 0 || !state.currentOrganization) return;
        setIsUploading(true);

        const uploadedStoredFiles: StoredFile[] = [];

        try {
            for (let i = 0; i < pendingUploadFiles.length; i++) {
                const item = pendingUploadFiles[i];
                setUploadProgressText(t(`Uploading (${i + 1}/${pendingUploadFiles.length}): ${item.file.name}...`));

                const cleanFileName = item.file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
                const storagePath = `organizations/${state.currentOrganization.id}/projects/${project.id}/documents/${Date.now()}_${cleanFileName}`;

                const downloadUrl = await uploadFileToStorage(storagePath, item.file);

                const finalCategory = item.category === 'CUSTOM'
                    ? (item.customCategory?.trim() || 'General Project Documents')
                    : item.category;

                const tagsArray = item.tags
                    ? item.tags.split(',').map(t => t.trim()).filter(Boolean)
                    : [];

                const newStoredFile: StoredFile = {
                    id: `pdoc-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
                    organizationId: state.currentOrganization.id,
                    parentId: project.id,
                    parentType: 'project',
                    fileName: item.file.name,
                    fileType: item.file.type || 'application/octet-stream',
                    dataUrl: downloadUrl,
                    url: downloadUrl,
                    label: item.title || item.file.name,
                    createdAt: new Date().toISOString(),
                    uploadedBy: state.currentUser ? `${state.currentUser.firstName} ${state.currentUser.lastName}`.trim() : 'Admin',
                    metadata: {
                        category: finalCategory,
                        tags: tagsArray,
                        description: item.description || '',
                        amount: item.amount ? parseFloat(item.amount) : undefined,
                        associatedJobId: item.associatedJobId || undefined,
                        associatedSubcontractorId: item.associatedSubcontractorId || undefined,
                        associatedPermitId: item.associatedPermitId || undefined,
                        sizeBytes: item.file.size
                    }
                };

                uploadedStoredFiles.push(newStoredFile);
            }

            if (uploadedStoredFiles.length > 0) {
                const updatedFiles = [...(project.files || []), ...uploadedStoredFiles];
                await db.collection('projects').doc(project.id).update(cleanUndefinedFields({
                    files: updatedFiles,
                    updatedAt: new Date().toISOString()
                }));

                const updatedProject = { ...project, files: updatedFiles };
                dispatch({ type: 'UPDATE_PROJECT', payload: updatedProject });
                if (onUpdateProject) onUpdateProject(updatedProject);

                showToast.success(t(`Successfully uploaded ${uploadedStoredFiles.length} document(s) to project drive.`));
            }

            setPendingUploadFiles([]);
            setIsUploadModalOpen(false);
        } catch (err: any) {
            console.error("Project Document Upload Error:", err);
            showToast.error(t("Upload failed: ") + (err.message || 'Unknown error'));
        } finally {
            setIsUploading(false);
            setUploadProgressText('');
        }
    };

    // --- EDIT FILE HANDLERS ---
    const handleOpenEditFile = (file: UnifiedFile) => {
        setEditingFile(file);
        setEditFormTitle(file.label || file.fileName || '');
        const currentCategory = String(file.metadata?.category || 'General Project Documents');
        if (PROJECT_DOCUMENT_CATEGORIES.includes(currentCategory)) {
            setEditFormCategory(currentCategory);
            setEditFormCustomCategory('');
        } else {
            setEditFormCategory('CUSTOM');
            setEditFormCustomCategory(currentCategory);
        }
        setEditFormTags(Array.isArray(file.metadata?.tags) ? file.metadata.tags.join(', ') : String(file.metadata?.tags || ''));
        setEditFormDescription(String(file.metadata?.description || ''));
        setEditFormAmount(file.metadata?.amount !== undefined ? String(file.metadata.amount) : '');
        setEditFormJobId(String(file.metadata?.associatedJobId || ''));
        setEditFormSubId(String(file.metadata?.associatedSubcontractorId || ''));
        setEditFormPermitId(String(file.metadata?.associatedPermitId || ''));
    };

    const handleSaveEditFile = async () => {
        if (!editingFile) return;
        setIsSavingEdit(true);

        const finalCategory = editFormCategory === 'CUSTOM'
            ? (editFormCustomCategory.trim() || 'General Project Documents')
            : editFormCategory;

        const tagsArray = editFormTags
            ? editFormTags.split(',').map(t => t.trim()).filter(Boolean)
            : [];

        try {
            const updatedFiles = (project.files || []).map(f => {
                if (f.id === editingFile.id) {
                    return {
                        ...f,
                        label: editFormTitle.trim() || f.fileName,
                        metadata: {
                            ...(f.metadata || {}),
                            category: finalCategory,
                            tags: tagsArray,
                            description: editFormDescription.trim(),
                            amount: editFormAmount ? parseFloat(editFormAmount) : undefined,
                            associatedJobId: editFormJobId || undefined,
                            associatedSubcontractorId: editFormSubId || undefined,
                            associatedPermitId: editFormPermitId || undefined
                        }
                    };
                }
                return f;
            });

            await db.collection('projects').doc(project.id).update(cleanUndefinedFields({
                files: updatedFiles,
                updatedAt: new Date().toISOString()
            }));

            const updatedProject = { ...project, files: updatedFiles };
            dispatch({ type: 'UPDATE_PROJECT', payload: updatedProject });
            if (onUpdateProject) onUpdateProject(updatedProject);

            showToast.success(t("Document details updated."));
            setEditingFile(null);
        } catch (err: any) {
            console.error("Edit Document Error:", err);
            showToast.error(t("Failed to update: ") + (err.message || 'Unknown error'));
        } finally {
            setIsSavingEdit(false);
        }
    };

    // --- REMOVE FILE FROM PROJECT HANDLER (PRESERVES ORIGINAL FILE) ---
    const handleRemoveFromProject = async (file: UnifiedFile) => {
        const fileNameToDisplay = file.label || file.fileName || t('this document');
        const sourceDescription = file.sourceType === 'project'
            ? t('Cloud Storage and your records')
            : file.sourceLabel;

        const confirmed = await globalConfirm(
            t(`Are you sure you want to remove "${fileNameToDisplay}" from this project?\n\nThe original file will NOT be deleted. It will remain preserved and accessible in ${sourceDescription}. You can restore it to this project at any time.`),
            t('Remove Document from Project'),
            t('Remove from Project'),
            t('Keep in Project')
        );
        if (!confirmed) return;

        try {
            let updatedFiles = project.files || [];
            let updatedRemovedFiles = project.removedFiles || [];
            let updatedExcludedIds = project.excludedFileIds || [];

            if (file.sourceType === 'project') {
                const targetOriginal = updatedFiles.find(f => f.id === file.id);
                updatedFiles = updatedFiles.filter(f => f.id !== file.id);
                if (targetOriginal && !updatedRemovedFiles.some(f => f.id === targetOriginal.id)) {
                    updatedRemovedFiles = [...updatedRemovedFiles, targetOriginal];
                }
            } else {
                if (!updatedExcludedIds.includes(file.id)) {
                    updatedExcludedIds = [...updatedExcludedIds, file.id];
                }
            }

            const updatedProject: Project = {
                ...project,
                files: updatedFiles,
                removedFiles: updatedRemovedFiles,
                excludedFileIds: updatedExcludedIds,
                updatedAt: new Date().toISOString()
            };

            await db.collection('projects').doc(project.id).update(cleanUndefinedFields({
                files: updatedFiles,
                removedFiles: updatedRemovedFiles,
                excludedFileIds: updatedExcludedIds,
                updatedAt: updatedProject.updatedAt
            }));

            dispatch({ type: 'UPDATE_PROJECT', payload: updatedProject });
            if (onUpdateProject) onUpdateProject(updatedProject);

            showToast.success(t(`"${fileNameToDisplay}" removed from project. File remains safe in storage.`));
            if (previewingFile?.id === file.id) setPreviewingFile(null);
        } catch (err: any) {
            console.error("Remove Document Error:", err);
            showToast.error(t("Failed to remove document: ") + (err.message || 'Error'));
        }
    };

    // --- RESTORE FILE TO PROJECT HANDLER ---
    const handleRestoreToProject = async (file: UnifiedFile) => {
        const fileNameToDisplay = file.label || file.fileName || t('this document');
        try {
            let updatedFiles = project.files || [];
            let updatedRemovedFiles = project.removedFiles || [];
            let updatedExcludedIds = project.excludedFileIds || [];

            if (file.sourceType === 'project') {
                const targetOriginal = updatedRemovedFiles.find(f => f.id === file.id) || {
                    id: file.id,
                    organizationId: file.organizationId,
                    parentId: project.id,
                    parentType: 'project',
                    fileName: file.fileName,
                    fileType: file.fileType,
                    dataUrl: file.dataUrl,
                    url: file.url,
                    label: file.label,
                    createdAt: file.createdAt,
                    uploadedBy: file.uploadedBy,
                    metadata: file.metadata
                } as StoredFile;

                updatedRemovedFiles = updatedRemovedFiles.filter(f => f.id !== file.id);
                if (!updatedFiles.some(f => f.id === targetOriginal.id)) {
                    updatedFiles = [...updatedFiles, targetOriginal];
                }
            } else {
                updatedExcludedIds = updatedExcludedIds.filter(id => id !== file.id);
            }

            const updatedProject: Project = {
                ...project,
                files: updatedFiles,
                removedFiles: updatedRemovedFiles,
                excludedFileIds: updatedExcludedIds,
                updatedAt: new Date().toISOString()
            };

            await db.collection('projects').doc(project.id).update(cleanUndefinedFields({
                files: updatedFiles,
                removedFiles: updatedRemovedFiles,
                excludedFileIds: updatedExcludedIds,
                updatedAt: updatedProject.updatedAt
            }));

            dispatch({ type: 'UPDATE_PROJECT', payload: updatedProject });
            if (onUpdateProject) onUpdateProject(updatedProject);

            showToast.success(t(`"${fileNameToDisplay}" restored to project.`));
            if (previewingFile?.id === file.id) setPreviewingFile(null);
        } catch (err: any) {
            console.error("Restore Document Error:", err);
            showToast.error(t("Failed to restore document: ") + (err.message || 'Error'));
        }
    };

    // --- PERMANENT DELETE (ONLY FOR DIRECT PROJECT FILES IN REMOVED ARCHIVE) ---
    const handlePermanentDelete = async (file: UnifiedFile) => {
        const fileNameToDisplay = file.label || file.fileName || t('this document');
        const confirmed = await globalConfirm(
            t(`Permanently delete "${fileNameToDisplay}" from the database? This cannot be undone.`),
            t('Permanent Deletion'),
            t('Permanently Delete'),
            t('Cancel')
        );
        if (!confirmed) return;

        try {
            const updatedFiles = (project.files || []).filter(f => f.id !== file.id);
            const updatedRemovedFiles = (project.removedFiles || []).filter(f => f.id !== file.id);

            const updatedProject: Project = {
                ...project,
                files: updatedFiles,
                removedFiles: updatedRemovedFiles,
                updatedAt: new Date().toISOString()
            };

            await db.collection('projects').doc(project.id).update(cleanUndefinedFields({
                files: updatedFiles,
                removedFiles: updatedRemovedFiles,
                updatedAt: updatedProject.updatedAt
            }));

            dispatch({ type: 'UPDATE_PROJECT', payload: updatedProject });
            if (onUpdateProject) onUpdateProject(updatedProject);

            showToast.success(t(`Permanently deleted "${fileNameToDisplay}".`));
            if (previewingFile?.id === file.id) setPreviewingFile(null);
        } catch (err: any) {
            console.error("Permanent Delete Error:", err);
            showToast.error(t("Failed to delete document: ") + (err.message || 'Error'));
        }
    };

    // --- DOWNLOAD HANDLER ---
    const handleDownloadFile = async (file: StoredFile, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        const fileUrl = file.dataUrl || file.url || '';
        if (!fileUrl) {
            showToast.error(t("Download URL not found."));
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
                showToast.success(t(`Downloading ${downloadName}`));
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
            showToast.success(t(`Downloading ${downloadName}`));
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

    // Export Document Manifest CSV
    const handleExportManifestCsv = () => {
        const headers = ['File Name', 'Title / Label', 'Category', 'Source', 'Amount ($)', 'Uploaded By', 'Date Added', 'File Size', 'Download URL'];
        const rows = filteredFiles.map(f => [
            `"${(f.fileName || '').replace(/"/g, '""')}"`,
            `"${(f.label || '').replace(/"/g, '""')}"`,
            `"${String(f.metadata?.category || 'General').replace(/"/g, '""')}"`,
            `"${(f.sourceLabel || '').replace(/"/g, '""')}"`,
            f.financialAmount ? f.financialAmount.toFixed(2) : '',
            `"${(f.uploadedBy || '').replace(/"/g, '""')}"`,
            f.createdAt ? new Date(f.createdAt).toLocaleDateString() : '',
            formatBytes(Number(f.metadata?.sizeBytes || f.metadata?.size || 0)),
            `"${f.url || f.dataUrl || ''}"`
        ]);

        const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement('a');
        link.setAttribute('href', encodedUri);
        link.setAttribute('download', `${project.name.replace(/[^a-zA-Z0-9]/g, '_')}_Document_Manifest.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showToast.success(t("Document manifest exported."));
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
        <div className="space-y-6">
            {/* Top KPI Metrics Banner */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <Card className="p-3 bg-slate-50 dark:bg-slate-800 border-l-4 border-blue-500 shadow-sm">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t("Total Documents")}</p>
                    <p className="text-xl font-black text-slate-900 dark:text-white mt-1">{metrics.total}</p>
                </Card>
                <Card className="p-3 bg-slate-50 dark:bg-slate-800 border-l-4 border-amber-500 shadow-sm cursor-pointer hover:bg-amber-50/50 transition" onClick={() => setSelectedCategory('Subcontractor Quotes')}>
                    <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">{t("Sub Quotes")}</p>
                    <p className="text-xl font-black text-slate-900 dark:text-white mt-1">{metrics.subQuotesCount}</p>
                </Card>
                <Card className="p-3 bg-slate-50 dark:bg-slate-800 border-l-4 border-indigo-500 shadow-sm cursor-pointer hover:bg-indigo-50/50 transition" onClick={() => setSelectedCategory('Parts & Vendor Quotes')}>
                    <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider">{t("Parts Quotes")}</p>
                    <p className="text-xl font-black text-slate-900 dark:text-white mt-1">{metrics.partsQuotesCount}</p>
                </Card>
                <Card className="p-3 bg-slate-50 dark:bg-slate-800 border-l-4 border-emerald-500 shadow-sm cursor-pointer hover:bg-emerald-50/50 transition" onClick={() => setSelectedCategory('Receipts & Expense Invoices')}>
                    <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">{t("Receipts & Bills")}</p>
                    <p className="text-xl font-black text-slate-900 dark:text-white mt-1">{metrics.receiptsCount}</p>
                </Card>
                <Card className="p-3 bg-slate-50 dark:bg-slate-800 border-l-4 border-purple-500 shadow-sm cursor-pointer hover:bg-purple-50/50 transition" onClick={() => setSelectedCategory('Permits & Municipal Forms')}>
                    <p className="text-[10px] font-bold text-purple-600 uppercase tracking-wider">{t("Permit Files")}</p>
                    <p className="text-xl font-black text-slate-900 dark:text-white mt-1">{metrics.permitsCount}</p>
                </Card>
                <Card className="p-3 bg-slate-50 dark:bg-slate-800 border-l-4 border-teal-500 shadow-sm">
                    <p className="text-[10px] font-bold text-teal-600 uppercase tracking-wider">{t("Tracked Value")}</p>
                    <p className="text-xl font-black text-slate-900 dark:text-white mt-1">${metrics.totalAmountTracked.toLocaleString()}</p>
                </Card>
            </div>

            {/* Drag and Drop Zone */}
            <div
                onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={handleDrop}
                className={`p-6 border-2 border-dashed rounded-2xl text-center transition-all ${
                    isDragOver
                        ? 'border-blue-500 bg-blue-50/70 dark:bg-blue-950/40 scale-[1.005]'
                        : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-blue-400'
                }`}
            >
                <div className="flex flex-col items-center justify-center gap-2">
                    <div className="p-3 bg-blue-50 dark:bg-blue-900/30 text-blue-600 rounded-2xl">
                        <UploadCloud size={32} />
                    </div>
                    <div>
                        <h4 className="font-bold text-slate-900 dark:text-white text-base">
                            {t("Drop subcontractor quotes, permits, vendor quotes, receipts, or contracts here")}
                        </h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                            {t("Supports PDFs, Word docs, Excel spreadsheets, images, and scans up to 50MB")}
                        </p>
                    </div>
                    <div className="flex items-center gap-3 mt-2">
                        <Button
                            onClick={() => fileInputRef.current?.click()}
                            className="text-xs h-9 bg-blue-600 hover:bg-blue-700 font-bold shadow-md"
                        >
                            + {t("Upload Documents")}
                        </Button>
                        <Button
                            onClick={handleExportManifestCsv}
                            variant="secondary"
                            className="text-xs h-9"
                        >
                            <Download size={14} className="mr-1.5" /> {t("Export Manifest (CSV)")}
                        </Button>
                        <input
                            ref={fileInputRef}
                            type="file"
                            multiple
                            className="hidden"
                            onChange={(e) => handleFilesSelected(e.target.files)}
                        />
                    </div>
                </div>
            </div>

            {/* View Mode Toggle: Active Documents vs Removed / Excluded Archive */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 dark:bg-slate-805 p-2.5 rounded-2xl border border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => setDocumentTabMode('active')}
                        className={`px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-2 ${
                            documentTabMode === 'active'
                                ? 'bg-blue-600 text-white shadow-sm'
                                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
                        }`}
                    >
                        <FileText size={15} />
                        <span>{t("Active Project Documents")}</span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                            documentTabMode === 'active'
                                ? 'bg-white/20 text-white'
                                : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                        }`}>
                            {activeFiles.length}
                        </span>
                    </button>

                    <button
                        type="button"
                        onClick={() => setDocumentTabMode('removed')}
                        className={`px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-2 ${
                            documentTabMode === 'removed'
                                ? 'bg-amber-600 text-white shadow-sm'
                                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
                        }`}
                    >
                        <Archive size={15} />
                        <span>{t("Removed / Excluded")}</span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                            documentTabMode === 'removed'
                                ? 'bg-white/20 text-white'
                                : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                        }`}>
                            {removedFilesList.length}
                        </span>
                    </button>
                </div>

                {documentTabMode === 'removed' ? (
                    <div className="flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-400 bg-amber-50/80 dark:bg-amber-950/40 px-3 py-1.5 rounded-xl border border-amber-200/60 dark:border-amber-900/40">
                        <AlertCircle size={14} className="shrink-0 text-amber-600 dark:text-amber-400" />
                        <span>{t("Removed documents are detached from this project view, but remain intact in cloud storage and source records.")}</span>
                    </div>
                ) : (
                    <p className="text-[11px] text-slate-400 px-2 hidden sm:block">
                        {t("All direct project files, quotes, blueprints, and linked job receipts")}
                    </p>
                )}
            </div>

            {/* Filter & Search Bar */}
            <div className="flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-4 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <div className="flex flex-wrap items-center gap-3 flex-1">
                    <div className="relative flex-1 min-w-[200px]">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input
                            type="text"
                            placeholder={t("Search documents by name, tags, or notes...")}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-9 pr-3 py-2 w-full text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        {searchTerm && (
                            <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                                <X size={14} />
                            </button>
                        )}
                    </div>

                    <Select
                        value={selectedCategory}
                        onChange={(e) => setSelectedCategory(e.target.value)}
                        className="text-xs py-2 w-auto mb-0 min-w-[170px]"
                    >
                        <option value="ALL">{t("All Categories")} ({allUnifiedFiles.length})</option>
                        {availableCategories.map(cat => (
                            <option key={cat} value={cat}>{t(cat)}</option>
                        ))}
                    </Select>

                    <Select
                        value={selectedSource}
                        onChange={(e) => setSelectedSource(e.target.value as any)}
                        className="text-xs py-2 w-auto mb-0 min-w-[140px]"
                    >
                        <option value="ALL">{t("All Sources")}</option>
                        <option value="project">{t("Direct Project Files")}</option>
                        <option value="job">{t("Job Records Attachments")}</option>
                        <option value="expense">{t("Expense Receipts")}</option>
                        <option value="proposal">{t("Proposal Docs")}</option>
                    </Select>

                    <Select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value as any)}
                        className="text-xs py-2 w-auto mb-0 min-w-[150px]"
                    >
                        <option value="date_desc">{t("Newest First")}</option>
                        <option value="date_asc">{t("Oldest First")}</option>
                        <option value="name_asc">{t("Name (A-Z)")}</option>
                        <option value="name_desc">{t("Name (Z-A)")}</option>
                        <option value="amount_desc">{t("Highest Value")}</option>
                    </Select>
                </div>

                <div className="flex items-center gap-2 self-end lg:self-center">
                    <span className="text-xs font-bold text-slate-400 mr-1">
                        {filteredFiles.length} {t("files")}
                    </span>
                    <div className="flex items-center border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden p-0.5 bg-slate-50 dark:bg-slate-800">
                        <button
                            onClick={() => setViewMode('grid')}
                            className={`p-1.5 rounded-lg text-xs transition ${viewMode === 'grid' ? 'bg-white dark:bg-slate-700 text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                            title={t("Grid View")}
                        >
                            <LayoutGrid size={16} />
                        </button>
                        <button
                            onClick={() => setViewMode('list')}
                            className={`p-1.5 rounded-lg text-xs transition ${viewMode === 'list' ? 'bg-white dark:bg-slate-700 text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                            title={t("List View")}
                        >
                            <List size={16} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Document Browser Area */}
            {filteredFiles.length === 0 ? (
                <div className="p-12 text-center text-slate-400 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-3xl">
                    <FolderOpen size={48} className="mx-auto mb-3 text-slate-300 dark:text-slate-600" />
                    <p className="font-bold text-base text-slate-700 dark:text-slate-300">
                        {documentTabMode === 'removed' ? t("No removed or excluded documents") : t("No documents found")}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                        {documentTabMode === 'removed'
                            ? t("When you remove a document from this project, it appears here and can be restored at any time.")
                            : (searchTerm || selectedCategory !== 'ALL' || selectedSource !== 'ALL'
                                ? t("Try adjusting your search or filters.")
                                : t("Upload subcontractor quotes, permits, or parts quotes above to get started."))}
                    </p>
                </div>
            ) : viewMode === 'grid' ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {filteredFiles.map(file => {
                        const fileCategory = String(file.metadata?.category || 'General Project Documents');
                        const isDirect = file.sourceType === 'project';
                        return (
                            <div
                                key={file.id}
                                onClick={() => setPreviewingFile(file)}
                                className="group relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-blue-400 dark:hover:border-blue-600 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all flex flex-col justify-between cursor-pointer"
                            >
                                <div>
                                    <div className="flex items-start justify-between gap-2 mb-2">
                                        <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 group-hover:scale-105 transition-transform">
                                            {renderFileTypeIcon(file, "w-6 h-6")}
                                        </div>
                                        <div className="flex flex-col items-end gap-1">
                                            {file.isRemoved && (
                                                <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-900/50 flex items-center gap-1">
                                                    <Archive size={10} />
                                                    {t("Removed")}
                                                </span>
                                            )}
                                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                                                fileCategory.includes('Subcontractor') ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300' :
                                                fileCategory.includes('Parts') ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300' :
                                                fileCategory.includes('Permit') ? 'bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300' :
                                                fileCategory.includes('Receipt') ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300' :
                                                fileCategory.includes('Contract') ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300' :
                                                'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                                            }`}>
                                                {fileCategory}
                                            </span>
                                            {file.financialAmount !== undefined && (
                                                <span className="text-[11px] font-black text-emerald-600 dark:text-emerald-400">
                                                    ${file.financialAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    <h4 className="font-bold text-sm text-slate-900 dark:text-white line-clamp-2 mt-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition">
                                        {file.label || file.fileName}
                                    </h4>

                                    <p className="text-[11px] text-slate-400 font-mono mt-1 truncate">
                                        {file.fileName}
                                    </p>

                                    {file.metadata?.description && (
                                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 line-clamp-2 bg-slate-50 dark:bg-slate-800/60 p-2 rounded-lg">
                                            {file.metadata.description}
                                        </p>
                                    )}

                                    {/* Source badge */}
                                    <div className="mt-3 flex items-center gap-1.5 text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                                        <span className={`w-1.5 h-1.5 rounded-full ${
                                            file.sourceType === 'project' ? 'bg-blue-500' :
                                            file.sourceType === 'job' ? 'bg-purple-500' :
                                            file.sourceType === 'expense' ? 'bg-emerald-500' : 'bg-amber-500'
                                        }`}></span>
                                        <span className="truncate">{file.sourceLabel}</span>
                                    </div>
                                </div>

                                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                                    <span className="text-[10px] text-slate-400">
                                        {file.createdAt ? new Date(file.createdAt).toLocaleDateString() : ''}
                                    </span>
                                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                        <button
                                            onClick={(e) => handleDownloadFile(file, e)}
                                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition"
                                            title={t("Download File")}
                                        >
                                            <Download size={14} />
                                        </button>
                                        {isDirect && !file.isRemoved && (
                                            <button
                                                onClick={() => handleOpenEditFile(file)}
                                                className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition"
                                                title={t("Edit Details")}
                                            >
                                                <Edit3 size={14} />
                                            </button>
                                        )}
                                        {!file.isRemoved ? (
                                            <button
                                                onClick={() => handleRemoveFromProject(file)}
                                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition"
                                                title={t("Remove from Project (Preserves original file)")}
                                            >
                                                <FileMinus size={14} />
                                            </button>
                                        ) : (
                                            <>
                                                <button
                                                    onClick={() => handleRestoreToProject(file)}
                                                    className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 rounded-lg transition"
                                                    title={t("Restore to Project")}
                                                >
                                                    <RotateCcw size={14} />
                                                </button>
                                                {isDirect && (
                                                    <button
                                                        onClick={() => handlePermanentDelete(file)}
                                                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition"
                                                        title={t("Permanently Delete from Database")}
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                )}
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                <Card className="p-0 overflow-hidden border-slate-200 dark:border-slate-800 shadow-sm rounded-2xl">
                    <Table headers={[t('Document'), t('Category'), t('Source'), t('Amount'), t('Date Added'), t('Size'), t('Actions')]}>
                        {filteredFiles.map(file => {
                            const fileCategory = String(file.metadata?.category || 'General Project Documents');
                            const isDirect = file.sourceType === 'project';
                            return (
                                <tr
                                    key={file.id}
                                    onClick={() => setPreviewingFile(file)}
                                    className="hover:bg-slate-50 dark:hover:bg-slate-800/60 transition cursor-pointer"
                                >
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            {renderFileTypeIcon(file, "w-5 h-5")}
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <p className="font-bold text-xs text-slate-900 dark:text-white">
                                                        {file.label || file.fileName}
                                                    </p>
                                                    {file.isRemoved && (
                                                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                                                            {t("Removed")}
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-[10px] text-slate-400 font-mono">
                                                    {file.fileName}
                                                </p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                                            {fileCategory}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-xs text-slate-500">
                                        <span className="flex items-center gap-1.5 truncate max-w-[180px]">
                                            <span className={`w-1.5 h-1.5 rounded-full ${
                                                file.sourceType === 'project' ? 'bg-blue-500' :
                                                file.sourceType === 'job' ? 'bg-purple-500' :
                                                file.sourceType === 'expense' ? 'bg-emerald-500' : 'bg-amber-500'
                                            }`}></span>
                                            {file.sourceLabel}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 font-bold text-xs">
                                        {file.financialAmount !== undefined ? (
                                            <span className="text-emerald-600 dark:text-emerald-400">
                                                ${file.financialAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </span>
                                        ) : (
                                            <span className="text-slate-300">--</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-xs text-slate-400">
                                        {file.createdAt ? new Date(file.createdAt).toLocaleDateString() : '--'}
                                    </td>
                                    <td className="px-6 py-4 text-xs text-slate-400 font-mono">
                                        {formatBytes(Number(file.metadata?.sizeBytes || file.metadata?.size || 0))}
                                    </td>
                                    <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                                        <div className="flex items-center gap-1">
                                            <button
                                                onClick={() => setPreviewingFile(file)}
                                                className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition"
                                                title={t("Preview")}
                                            >
                                                <Eye size={14} />
                                            </button>
                                            <button
                                                onClick={(e) => handleDownloadFile(file, e)}
                                                className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition"
                                                title={t("Download")}
                                            >
                                                <Download size={14} />
                                            </button>
                                            {isDirect && !file.isRemoved && (
                                                <button
                                                    onClick={() => handleOpenEditFile(file)}
                                                    className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition"
                                                    title={t("Edit")}
                                                >
                                                    <Edit3 size={14} />
                                                </button>
                                            )}
                                            {!file.isRemoved ? (
                                                <button
                                                    onClick={() => handleRemoveFromProject(file)}
                                                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition"
                                                    title={t("Remove from Project (Preserves file)")}
                                                >
                                                    <FileMinus size={14} />
                                                </button>
                                            ) : (
                                                <>
                                                    <button
                                                        onClick={() => handleRestoreToProject(file)}
                                                        className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 rounded-lg transition"
                                                        title={t("Restore to Project")}
                                                    >
                                                        <RotateCcw size={14} />
                                                    </button>
                                                    {isDirect && (
                                                        <button
                                                            onClick={() => handlePermanentDelete(file)}
                                                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition"
                                                            title={t("Permanently Delete")}
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </Table>
                </Card>
            )}

            {/* Upload Modal */}
            {isUploadModalOpen && (
                <Modal
                    isOpen={isUploadModalOpen}
                    onClose={() => !isUploading && setIsUploadModalOpen(false)}
                    title={t("Upload Project Documents")}
                    size="lg"
                >
                    <div className="space-y-4 max-h-[75vh] overflow-y-auto p-1">
                        <p className="text-xs text-slate-500">
                            {t("Configure details for each document before uploading to the project drive:")}
                        </p>

                        {pendingUploadFiles.map((item, index) => (
                            <div key={index} className="p-4 border border-slate-200 dark:border-slate-700 rounded-2xl bg-slate-50 dark:bg-slate-800/60 space-y-3">
                                <div className="flex items-start justify-between gap-2">
                                    <div className="flex items-center gap-2">
                                        <div className="p-2 rounded-lg bg-white dark:bg-slate-700 shadow-xs">
                                            <FileText size={18} className="text-blue-500" />
                                        </div>
                                        <div>
                                            <p className="font-bold text-xs text-slate-900 dark:text-white truncate max-w-[280px]">
                                                {item.file.name}
                                            </p>
                                            <p className="text-[10px] text-slate-400">
                                                {formatBytes(item.file.size)} &bull; {item.file.type || 'Unknown type'}
                                            </p>
                                        </div>
                                    </div>
                                    {pendingUploadFiles.length > 1 && !isUploading && (
                                        <button
                                            onClick={() => setPendingUploadFiles(prev => prev.filter((_, i) => i !== index))}
                                            className="text-slate-400 hover:text-red-500 p-1"
                                            title={t("Remove file")}
                                        >
                                            <X size={16} />
                                        </button>
                                    )}
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">{t("Document Title")}</label>
                                        <Input
                                            value={item.title}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                setPendingUploadFiles(prev => prev.map((f, i) => i === index ? { ...f, title: val } : f));
                                            }}
                                            placeholder={t("e.g. Crane Lift Quote - San Marcos")}
                                            className="text-xs"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">{t("Category")}</label>
                                        <Select
                                            value={item.category}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                setPendingUploadFiles(prev => prev.map((f, i) => i === index ? { ...f, category: val } : f));
                                            }}
                                            className="text-xs mb-0"
                                        >
                                            {PROJECT_DOCUMENT_CATEGORIES.map(cat => (
                                                <option key={cat} value={cat}>{t(cat)}</option>
                                            ))}
                                            <option value="CUSTOM">{t("+ Custom Category...")}</option>
                                        </Select>
                                    </div>
                                </div>

                                {item.category === 'CUSTOM' && (
                                    <div>
                                        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">{t("Custom Category Name")}</label>
                                        <Input
                                            value={item.customCategory || ''}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                setPendingUploadFiles(prev => prev.map((f, i) => i === index ? { ...f, customCategory: val } : f));
                                            }}
                                            placeholder={t("e.g. Structural Engineering Reports")}
                                            className="text-xs"
                                        />
                                    </div>
                                )}

                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    <div>
                                        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">{t("Associated Job")}</label>
                                        <Select
                                            value={item.associatedJobId || ''}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                setPendingUploadFiles(prev => prev.map((f, i) => i === index ? { ...f, associatedJobId: val } : f));
                                            }}
                                            className="text-xs mb-0"
                                        >
                                            <option value="">-- {t("General Project")} --</option>
                                            {projectJobs.map(j => (
                                                <option key={j.id} value={j.id}>
                                                    #{j.id.slice(-6).toUpperCase()} - {j.tasks?.[0] || 'Job'}
                                                </option>
                                            ))}
                                        </Select>
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">{t("Associated Subcontractor")}</label>
                                        <Select
                                            value={item.associatedSubcontractorId || ''}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                setPendingUploadFiles(prev => prev.map((f, i) => i === index ? { ...f, associatedSubcontractorId: val } : f));
                                            }}
                                            className="text-xs mb-0"
                                        >
                                            <option value="">-- {t("None")} --</option>
                                            {projectSubs.map(s => (
                                                <option key={s.id} value={s.id}>{s.companyName}</option>
                                            ))}
                                        </Select>
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">{t("Quote / Amount ($)")}</label>
                                        <Input
                                            type="number"
                                            value={item.amount || ''}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                setPendingUploadFiles(prev => prev.map((f, i) => i === index ? { ...f, amount: val } : f));
                                            }}
                                            placeholder="0.00"
                                            className="text-xs"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">{t("Tags (comma separated)")}</label>
                                        <Input
                                            value={item.tags}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                setPendingUploadFiles(prev => prev.map((f, i) => i === index ? { ...f, tags: val } : f));
                                            }}
                                            placeholder={t("e.g. crane, RTU-2, approved")}
                                            className="text-xs"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">{t("Notes / Description")}</label>
                                        <Input
                                            value={item.description}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                setPendingUploadFiles(prev => prev.map((f, i) => i === index ? { ...f, description: val } : f));
                                            }}
                                            placeholder={t("Optional notes...")}
                                            className="text-xs"
                                        />
                                    </div>
                                </div>
                            </div>
                        ))}

                        <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-slate-800">
                            <div>
                                {isUploading && (
                                    <p className="text-xs font-bold text-blue-600 animate-pulse flex items-center gap-2">
                                        <RefreshCw size={14} className="animate-spin" />
                                        {uploadProgressText}
                                    </p>
                                )}
                            </div>
                            <div className="flex gap-2">
                                <Button
                                    variant="secondary"
                                    onClick={() => setIsUploadModalOpen(false)}
                                    disabled={isUploading}
                                    className="text-xs"
                                >
                                    {t("Cancel")}
                                </Button>
                                <Button
                                    onClick={handleExecuteUpload}
                                    disabled={isUploading || pendingUploadFiles.length === 0}
                                    className="text-xs bg-blue-600 hover:bg-blue-700 font-bold"
                                >
                                    {isUploading ? t("Uploading...") : t(`Upload ${pendingUploadFiles.length} File(s)`)}
                                </Button>
                            </div>
                        </div>
                    </div>
                </Modal>
            )}

            {/* Edit File Modal */}
            {editingFile && (
                <Modal
                    isOpen={!!editingFile}
                    onClose={() => setEditingFile(null)}
                    title={t("Edit Document Details")}
                    size="md"
                >
                    <div className="space-y-4 p-1">
                        <div>
                            <label className="block text-xs font-bold uppercase text-slate-400 mb-1">{t("Document Title")}</label>
                            <Input
                                value={editFormTitle}
                                onChange={(e) => setEditFormTitle(e.target.value)}
                                className="text-xs"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold uppercase text-slate-400 mb-1">{t("Category")}</label>
                            <Select
                                value={editFormCategory}
                                onChange={(e) => setEditFormCategory(e.target.value)}
                                className="text-xs mb-0"
                            >
                                {PROJECT_DOCUMENT_CATEGORIES.map(cat => (
                                    <option key={cat} value={cat}>{t(cat)}</option>
                                ))}
                                <option value="CUSTOM">{t("+ Custom Category...")}</option>
                            </Select>
                        </div>

                        {editFormCategory === 'CUSTOM' && (
                            <div>
                                <label className="block text-xs font-bold uppercase text-slate-400 mb-1">{t("Custom Category")}</label>
                                <Input
                                    value={editFormCustomCategory}
                                    onChange={(e) => setEditFormCustomCategory(e.target.value)}
                                    className="text-xs"
                                />
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-bold uppercase text-slate-400 mb-1">{t("Amount ($)")}</label>
                                <Input
                                    type="number"
                                    value={editFormAmount}
                                    onChange={(e) => setEditFormAmount(e.target.value)}
                                    className="text-xs"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold uppercase text-slate-400 mb-1">{t("Associated Job")}</label>
                                <Select
                                    value={editFormJobId}
                                    onChange={(e) => setEditFormJobId(e.target.value)}
                                    className="text-xs mb-0"
                                >
                                    <option value="">-- {t("General Project")} --</option>
                                    {projectJobs.map(j => (
                                        <option key={j.id} value={j.id}>
                                            #{j.id.slice(-6).toUpperCase()} - {j.tasks?.[0] || 'Job'}
                                        </option>
                                    ))}
                                </Select>
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold uppercase text-slate-400 mb-1">{t("Tags (comma separated)")}</label>
                            <Input
                                value={editFormTags}
                                onChange={(e) => setEditFormTags(e.target.value)}
                                className="text-xs"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold uppercase text-slate-400 mb-1">{t("Notes / Description")}</label>
                            <Textarea
                                value={editFormDescription}
                                onChange={(e) => setEditFormDescription(e.target.value)}
                                rows={3}
                                className="text-xs"
                            />
                        </div>

                        <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                            <Button
                                variant="secondary"
                                onClick={() => setEditingFile(null)}
                                disabled={isSavingEdit}
                                className="text-xs"
                            >
                                {t("Cancel")}
                            </Button>
                            <Button
                                onClick={handleSaveEditFile}
                                disabled={isSavingEdit}
                                className="text-xs bg-blue-600 hover:bg-blue-700 font-bold"
                            >
                                {isSavingEdit ? t("Saving...") : t("Save Changes")}
                            </Button>
                        </div>
                    </div>
                </Modal>
            )}

            {/* Full Preview Modal */}
            {previewingFile && (() => {
                const fileSrc = previewingFile.dataUrl || previewingFile.url || '';
                const typeInfo = detectFileType(fileSrc, previewingFile.fileName, previewingFile.fileType);
                const displayTitle = previewingFile.label || previewingFile.fileName;

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
                                    <div className="flex items-center gap-2">
                                        <h4 className="text-base font-extrabold text-slate-900 dark:text-white truncate max-w-md">
                                            {displayTitle}
                                        </h4>
                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300">
                                            {String(previewingFile.metadata?.category || 'General')}
                                        </span>
                                        {previewingFile.isRemoved && (
                                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 flex items-center gap-1">
                                                <Archive size={11} /> {t("Removed from Project")}
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-xs text-slate-400 mt-0.5">
                                        {previewingFile.fileName} &bull; {previewingFile.sourceLabel} &bull; Added {new Date(previewingFile.createdAt || 0).toLocaleDateString()}
                                    </p>
                                </div>

                                <div className="flex items-center gap-2">
                                    {previewingFile.sourceType === 'project' && !previewingFile.isRemoved && (
                                        <Button
                                            onClick={() => {
                                                const target = previewingFile;
                                                setPreviewingFile(null);
                                                handleOpenEditFile(target);
                                            }}
                                            variant="secondary"
                                            className="text-xs flex items-center gap-1.5"
                                        >
                                            <Edit3 size={14} /> {t("Edit")}
                                        </Button>
                                    )}
                                    {!previewingFile.isRemoved ? (
                                        <Button
                                            onClick={() => handleRemoveFromProject(previewingFile)}
                                            variant="secondary"
                                            className="text-xs flex items-center gap-1.5 text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30 border-rose-200 dark:border-rose-900/50"
                                        >
                                            <FileMinus size={14} /> {t("Remove from Project")}
                                        </Button>
                                    ) : (
                                        <Button
                                            onClick={() => handleRestoreToProject(previewingFile)}
                                            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5"
                                        >
                                            <RotateCcw size={14} /> {t("Restore to Project")}
                                        </Button>
                                    )}
                                    <Button
                                        onClick={(e) => handleDownloadFile(previewingFile, e)}
                                        className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5"
                                    >
                                        <Download size={14} /> {t("Download")}
                                    </Button>
                                    {fileSrc && (
                                        <a
                                            href={fileSrc}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors"
                                            title={t("Open in new window")}
                                        >
                                            <ExternalLink size={14} />
                                        </a>
                                    )}
                                </div>
                            </div>

                            {/* Viewer */}
                            <div className="bg-slate-950 rounded-2xl overflow-hidden flex items-center justify-center min-h-[420px] max-h-[70vh] shadow-2xl p-2">
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
                                            <p className="text-xs text-slate-400 mt-1">{t("This format cannot be rendered inline.")}</p>
                                        </div>
                                        <Button
                                            onClick={(e) => handleDownloadFile(previewingFile, e)}
                                            className="bg-blue-600 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-blue-700 inline-flex items-center gap-2"
                                        >
                                            <Download size={16} /> {t("Download File")}
                                        </Button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </Modal>
                );
            })()}
        </div>
    );
};

export default ProjectDocumentsTab;
