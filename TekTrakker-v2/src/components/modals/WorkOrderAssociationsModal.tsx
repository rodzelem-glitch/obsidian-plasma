import { cleanUndefinedFields, isFilePhoto } from '../../lib/utils';
import React, { useState, useMemo } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Input from '../ui/Input';
import { useAppContext } from 'context/AppContext';
import { 
    Calendar, Wrench, FileText, Image, MapPin, 
    Phone, Mail, User, DollarSign, Copy, Check, Info, ShieldCheck, Download, Upload, Link2, Paperclip, Eye, Trash2, ExternalLink, Unlink, Pencil, Tag, Plus
} from 'lucide-react';
import JobDetailModal from './JobDetailModal';
import DocumentPreview from '../ui/DocumentPreview';
import showToast from 'lib/toast';
import { db } from 'lib/firebase';
import firebase from 'firebase/compat/app';
import { uploadFileToStorage } from 'lib/storageService';
import { resolveJobProposalNumber, getNextProposalNumber } from '../../lib/numbering';
import { detectFileType } from 'lib/fileViewerHelper';
import { globalConfirm } from 'lib/globalConfirm';

interface WorkOrderAssociationsModalProps {
    isOpen: boolean;
    onClose: () => void;
    workOrderNumber: string | null;
    customerId: string | null;
}

const WorkOrderAssociationsModal: React.FC<WorkOrderAssociationsModalProps> = ({
    isOpen,
    onClose,
    workOrderNumber,
    customerId
}) => {
    const { state, dispatch } = useAppContext();
    const [activeTab, setActiveTab] = useState<'overview' | 'jobs' | 'proposals' | 'invoices' | 'files' | 'expenses'>('overview');
    const [copied, setCopied] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    
    // Nested modal states
    const [selectedJob, setSelectedJob] = useState<any | null>(null);
    const [previewDoc, setPreviewDoc] = useState<{ type: 'Proposal' | 'Invoice'; data: any } | null>(null);
    const [lightboxImage, setLightboxImage] = useState<string | null>(null);
    const [viewingDocument, setViewingDocument] = useState<{ url: string; fileName: string } | null>(null);

    // Photo label editing state
    const [editingPhoto, setEditingPhoto] = useState<any | null>(null);
    const [editTitle, setEditTitle] = useState('');
    const [editCategory, setEditCategory] = useState<'Before' | 'After' | 'Specifications' | 'Uncategorized'>('Before');
    const [editAssetId, setEditAssetId] = useState('');

    // Tab Linking State
    const [selectedJobToLink, setSelectedJobToLink] = useState('');
    const [selectedProposalToLink, setSelectedProposalToLink] = useState('');
    const [selectedInvoiceToLink, setSelectedInvoiceToLink] = useState('');
    const [selectedExpenseToLink, setSelectedExpenseToLink] = useState('');
    const [showAddExpenseModal, setShowAddExpenseModal] = useState(false);

    // New Expense Form State
    const [newExpVendor, setNewExpVendor] = useState('');
    const [newExpCategory, setNewExpCategory] = useState('Materials & Parts');
    const [newExpAmount, setNewExpAmount] = useState('');
    const [newExpTax, setNewExpTax] = useState('');
    const [newExpDescription, setNewExpDescription] = useState('');
    const [newExpReceiptFile, setNewExpReceiptFile] = useState<File | null>(null);

    const normalizeWo = (val: string | null | undefined): string => {
        if (!val) return '';
        return val.trim().toLowerCase().replace(/^(wo|po)\s*#?\s*/i, '').replace(/[^a-z0-9]/gi, '');
    };

    const isPhotoFile = (f: any): boolean => {
        return isFilePhoto(f);
    };

    // Retrieve associated Jobs with WO normalization
    const associatedJobs = useMemo(() => {
        if (!workOrderNumber && !customerId) return [];
        const woRaw = workOrderNumber?.trim().toLowerCase() || '';
        const woNorm = normalizeWo(workOrderNumber);

        return (state.jobs || []).filter(j => {
            const cMatch = !customerId || j.customerId === customerId;
            if (!cMatch) return false;

            const jPoRaw = j.poNumber?.trim().toLowerCase() || '';
            const jWoRaw = j.workOrderNumber?.trim().toLowerCase() || '';
            const jInvPoRaw = j.invoice?.poNumber?.trim().toLowerCase() || '';
            const jLinkedWoRaw = (j.linkedWorkOrderNumbers || j.linkedPoNumbers || []).map((w: string) => w.trim().toLowerCase());

            const jPoNorm = normalizeWo(j.poNumber);
            const jWoNorm = normalizeWo(j.workOrderNumber);
            const jInvPoNorm = normalizeWo(j.invoice?.poNumber);
            const jLinkedWoNorm = (j.linkedWorkOrderNumbers || j.linkedPoNumbers || []).map((w: string) => normalizeWo(w));

            const rawMatch = woRaw && (jPoRaw === woRaw || jWoRaw === woRaw || jInvPoRaw === woRaw || jLinkedWoRaw.includes(woRaw));
            const normMatch = woNorm && (jPoNorm === woNorm || jWoNorm === woNorm || jInvPoNorm === woNorm || jLinkedWoNorm.includes(woNorm));

            return rawMatch || normMatch;
        });
    }, [state.jobs, customerId, workOrderNumber]);

    // Retrieve Customer (with fallback to associatedJobs customerId)
    const customer = useMemo(() => {
        const effectiveId = customerId || (associatedJobs.length > 0 ? associatedJobs[0].customerId : null);
        if (!effectiveId) return null;
        return state.customers?.find(c => c.id === effectiveId) || null;
    }, [state.customers, customerId, associatedJobs]);

    const targetJobForUpload = useMemo(() => {
        if (associatedJobs.length === 0) return null;
        return [...associatedJobs].sort((a, b) => new Date(b.appointmentTime).getTime() - new Date(a.appointmentTime).getTime())[0];
    }, [associatedJobs]);

    // Retrieve associated Proposals
    const associatedProposals = useMemo(() => {
        if (!workOrderNumber && associatedJobs.length === 0) return [];
        const woRaw = workOrderNumber?.trim().toLowerCase() || '';
        const woNorm = normalizeWo(workOrderNumber);
        const assocJobIds = new Set(associatedJobs.map(j => j.id));

        return (state.proposals || []).filter(p => {
            const cMatch = !customer?.id || p.customerId === customer.id;
            if (!cMatch) return false;

            const pPoRaw = p.poNumber?.trim().toLowerCase() || '';
            const pPoNorm = normalizeWo(p.poNumber);

            const isPoMatch = !!((woRaw && pPoRaw === woRaw) || (woNorm && pPoNorm === woNorm));
            const isJobMatch = !!(p.jobId && assocJobIds.has(p.jobId)) || !!p.linkedJobIds?.some(id => assocJobIds.has(id));

            return isPoMatch || isJobMatch;
        });
    }, [state.proposals, customer, workOrderNumber, associatedJobs]);

    // Retrieve associated files (photos/docs) from jobs, unitStates, job photos, customer files, and equipment
    const associatedFiles = useMemo(() => {
        const files: any[] = [];
        const woRaw = workOrderNumber?.trim().toLowerCase() || '';
        const woNorm = normalizeWo(workOrderNumber);

        // 1. Files & Photos from associated jobs
        associatedJobs.forEach(job => {
            if (job.files && Array.isArray(job.files)) {
                job.files.forEach(f => {
                    files.push({ 
                        ...f, 
                        jobId: job.id,
                        jobTasks: job.tasks, 
                        jobDate: job.appointmentTime 
                    });
                });
            }

            if ((job as any).photos && Array.isArray((job as any).photos)) {
                (job as any).photos.forEach((p: any) => {
                    const url = typeof p === 'string' ? p : (p.dataUrl || p.url);
                    if (url && !files.some(f => (f.dataUrl || f.url) === url)) {
                        files.push({
                            id: `photo-${job.id}-${Math.random().toString(36).substring(2, 7)}`,
                            dataUrl: url,
                            url: url,
                            label: (typeof p === 'object' && p.label) || 'Job Photo',
                            type: 'Photo',
                            fileType: 'image/jpeg',
                            jobId: job.id,
                            jobTasks: job.tasks,
                            jobDate: job.appointmentTime,
                            createdAt: job.appointmentTime
                        });
                    }
                });
            }

            if (job.unitStates && Array.isArray(job.unitStates)) {
                job.unitStates.forEach((us: any) => {
                    const unitPhotos = [
                        { url: us.beforePhotoUrl, label: `Unit ${us.assetTag || us.assetId || ''} (Before Repair)` },
                        { url: us.afterPhotoUrl, label: `Unit ${us.assetTag || us.assetId || ''} (After Repair)` },
                        { url: us.photoUrl, label: `Unit ${us.assetTag || us.assetId || ''} Photo` },
                        ...(us.photos || []).map((p: any) => typeof p === 'string' ? { url: p, label: 'Unit Photo' } : p)
                    ];
                    unitPhotos.forEach((up: any) => {
                        if (up && up.url && !files.some(f => (f.dataUrl || f.url) === up.url)) {
                            files.push({
                                id: `us-${job.id}-${Math.random().toString(36).substring(2, 7)}`,
                                dataUrl: up.url,
                                url: up.url,
                                label: up.label || 'Unit Photo',
                                type: 'Photo',
                                fileType: 'image/jpeg',
                                jobId: job.id,
                                jobTasks: job.tasks,
                                jobDate: job.appointmentTime,
                                createdAt: job.appointmentTime
                            });
                        }
                    });
                });
            }
        });

        // 2. Files from Customer matching this PO/WO
        if (customer && customer.files && Array.isArray(customer.files)) {
            customer.files.forEach((f: any) => {
                const fWoRaw = (f.woNumber || f.poNumber || f.metadata?.woNumber || f.metadata?.poNumber || '').trim().toLowerCase();
                const fWoNorm = normalizeWo(fWoRaw);
                if ((woRaw && fWoRaw === woRaw) || (woNorm && fWoNorm === woNorm)) {
                    if (!files.some(existing => (existing.id && existing.id === f.id) || (existing.dataUrl || existing.url) === (f.dataUrl || f.url))) {
                        files.push({
                            ...f,
                            jobTasks: ['Customer File'],
                            jobDate: f.createdAt || new Date().toISOString()
                        });
                    }
                }
            });
        }

        // 3. Equipment photos matching this PO/WO or serviced on associated jobs
        if (customer && customer.equipment && Array.isArray(customer.equipment)) {
            customer.equipment.forEach((eq: any) => {
                const eqPoNorm = normalizeWo(eq.poNumber);
                const isEqMatch = (woNorm && eqPoNorm === woNorm) || 
                    associatedJobs.some((j: any) => j.equipmentIds?.includes(eq.id) || j.unitStates?.some((us: any) => us.assetId === eq.id));

                if (isEqMatch) {
                    const eqPhotos = [
                        { url: eq.serialPhotoUrl, label: `${eq.name || 'Unit'} - Serial Tag` },
                        { url: eq.unitTagPhotoUrl, label: `${eq.name || 'Unit'} - Unit Plate` },
                        { url: eq.conditionPhotoUrl, label: `${eq.name || 'Unit'} - Condition Photo` },
                        { url: eq.wideLocationPhotoUrl, label: `${eq.name || 'Unit'} - Location Photo` },
                        { url: eq.accessPointPhotoUrl, label: `${eq.name || 'Unit'} - Access Path Photo` },
                        { url: eq.qrCodePhotoUrl, label: `${eq.name || 'Unit'} - QR Code` }
                    ];
                    eqPhotos.forEach(p => {
                        if (p.url && !files.some(existing => (existing.dataUrl || existing.url) === p.url)) {
                            files.push({
                                id: `eq-${eq.id}-${Math.random().toString(36).substring(2, 7)}`,
                                dataUrl: p.url,
                                url: p.url,
                                label: p.label,
                                type: 'Photo',
                                fileType: 'image/jpeg',
                                jobTasks: [eq.name || 'Equipment Unit'],
                                jobDate: eq.updatedAt || new Date().toISOString()
                            });
                        }
                    });
                }
            });
        }

        return files;
    }, [associatedJobs, customer, workOrderNumber]);

    const externalWoFiles = useMemo(() => {
        return associatedFiles.filter(f => 
            f.label?.toLowerCase() === 'external work order' || 
            f.metadata?.label?.toLowerCase() === 'external work order' ||
            f.fileName?.toLowerCase().includes('external_workorder') ||
            f.fileName?.toLowerCase().includes('external work order') ||
            f.isExternalWorkOrder === true
        );
    }, [associatedFiles]);

    const hasExternalWorkOrder = useMemo(() => {
        return externalWoFiles.length > 0;
    }, [externalWoFiles]);

    const handleDeleteExternalWorkOrder = async (fileToDelete: any) => {
        if (!(await globalConfirm(`Are you sure you want to delete and unlink external work order document "${fileToDelete.fileName || 'Document'}"?`, "Delete Document", "Delete Document", "Cancel"))) {
            return;
        }

        const targetJobId = fileToDelete.jobId || targetJobForUpload?.id;
        if (!targetJobId) {
            showToast.error("Could not find associated job for this document.");
            return;
        }

        setIsUploading(true);
        try {
            const targetJob = state.jobs?.find(j => j.id === targetJobId);
            if (!targetJob) throw new Error("Associated job not found.");

            const updatedFiles = (targetJob.files || []).filter((f: any) => f.id !== fileToDelete.id && f.dataUrl !== fileToDelete.dataUrl && f.url !== fileToDelete.url);
            const updates: any = {
                files: updatedFiles,
                updatedAt: new Date().toISOString()
            };

            if (!state.isDemoMode) {
                await db.collection('jobs').doc(targetJob.id).update(cleanUndefinedFields(updates));
            }
            dispatch({
                type: 'UPDATE_JOB',
                payload: {
                    id: targetJob.id,
                    ...updates
                }
            });
            showToast.success(`External Work Order document "${fileToDelete.fileName || 'Document'}" deleted & unlinked.`);
        } catch (err: any) {
            console.error("Failed to delete external work order file:", err);
            showToast.error("Failed to delete work order document: " + err.message);
        } finally {
            setIsUploading(false);
        }
    };

    const handleStartEditPhoto = (file: any) => {
        setEditingPhoto(file);
        const label = file.metadata?.label || file.label || 'Job Photo';
        setEditTitle(label);
        
        const cat = (file.metadata?.category || file.category || file.phase || '').toLowerCase();
        const lbl = label.toLowerCase();
        if (cat.includes('after') || lbl.includes('after') || lbl.includes('repair') || lbl.includes('comp')) {
            setEditCategory('After');
        } else if (cat.includes('spec') || lbl.includes('spec') || lbl.includes('serial') || lbl.includes('tag')) {
            setEditCategory('Specifications');
        } else if (cat.includes('before') || lbl.includes('before') || lbl.includes('pre')) {
            setEditCategory('Before');
        } else {
            setEditCategory('Uncategorized');
        }

        setEditAssetId(file.metadata?.assetId || file.assetId || '');
    };

    const handleSavePhotoLabels = async () => {
        if (!editingPhoto) return;
        const targetJobId = editingPhoto.jobId || targetJobForUpload?.id;
        if (!targetJobId) {
            showToast.error("No associated job found for this photo.");
            return;
        }

        const targetJob = state.jobs?.find(j => j.id === targetJobId);
        if (!targetJob) {
            showToast.error("Target job record not found.");
            return;
        }

        setIsUploading(true);
        try {
            const titleToSave = editTitle.trim() || 'Job Photo';
            const phaseToSave = editCategory.toLowerCase();

            const updatedFiles = (targetJob.files || []).map((f: any) => {
                if (f.id === editingPhoto.id || f.dataUrl === editingPhoto.dataUrl || f.url === editingPhoto.url) {
                    const newMeta = {
                        ...(f.metadata || {}),
                        label: titleToSave,
                        category: editCategory,
                        phase: phaseToSave
                    };
                    if (editAssetId) newMeta.assetId = editAssetId;
                    else delete newMeta.assetId;

                    return {
                        ...f,
                        label: titleToSave,
                        assetId: editAssetId || undefined,
                        metadata: newMeta
                    };
                }
                return f;
            });

            const updates = {
                files: updatedFiles,
                updatedAt: new Date().toISOString()
            };

            if (!state.isDemoMode) {
                await db.collection('jobs').doc(targetJob.id).update(cleanUndefinedFields(updates));
            }

            dispatch({
                type: 'UPDATE_JOB',
                payload: {
                    id: targetJob.id,
                    ...updates
                }
            });

            showToast.success("Photo labels updated!");
            setEditingPhoto(null);
        } catch (err: any) {
            console.error("Failed to save photo labels:", err);
            showToast.error("Failed to update photo labels.");
        } finally {
            setIsUploading(false);
        }
    };

    // Retrieve associated Invoices from jobs
    const associatedInvoices = useMemo(() => {
        return associatedJobs.filter(j => j.invoice);
    }, [associatedJobs]);

    // Retrieve associated Expenses from jobs & PO
    const associatedExpenses = useMemo(() => {
        const jobIds = associatedJobs.map(j => j.id);
        return (state.expenses || []).filter((exp: any) => 
            (exp.jobId && jobIds.includes(exp.jobId)) || 
            (workOrderNumber && exp.poNumber?.trim().toLowerCase() === workOrderNumber.trim().toLowerCase()) ||
            (jobIds.length > 0 && exp.linkedJobIds?.some((id: string) => jobIds.includes(id)))
        );
    }, [state.expenses, associatedJobs, workOrderNumber]);

    // Unlinked items available for association in each tab
    const unlinkedJobs = useMemo(() => {
        const linkedIds = new Set(associatedJobs.map(j => j.id));
        return (state.jobs || []).filter(j => !linkedIds.has(j.id) && (!customer || j.customerId === customer.id));
    }, [state.jobs, associatedJobs, customer]);

    const unlinkedProposals = useMemo(() => {
        const linkedIds = new Set(associatedProposals.map(p => p.id));
        return (state.proposals || []).filter(p => !linkedIds.has(p.id) && (!customer || p.customerId === customer.id));
    }, [state.proposals, associatedProposals, customer]);

    const unlinkedInvoices = useMemo(() => {
        const linkedIds = new Set(associatedInvoices.map(i => i.id));
        return (state.jobs || []).filter(j => j.invoice && !linkedIds.has(j.id) && (!customer || j.customerId === customer.id));
    }, [state.jobs, associatedInvoices, customer]);

    const unlinkedExpenses = useMemo(() => {
        const linkedIds = new Set(associatedExpenses.map(e => e.id));
        return (state.expenses || []).filter(e => !linkedIds.has(e.id));
    }, [state.expenses, associatedExpenses]);

    // Linking Action Handlers for Every Tab
    const handleLinkJobToWo = async (jobIdToLink: string) => {
        if (!jobIdToLink || !workOrderNumber) return;
        setIsUploading(true);
        try {
            const targetJob = state.jobs.find(j => j.id === jobIdToLink);
            if (!targetJob) return;

            const existingWos = targetJob.linkedWorkOrderNumbers || targetJob.linkedPoNumbers || [];
            const updatedWoList = Array.from(new Set([...existingWos, workOrderNumber]));
            
            const updates: any = {
                linkedWorkOrderNumbers: updatedWoList,
                linkedPoNumbers: updatedWoList,
                updatedAt: new Date().toISOString()
            };
            if (!targetJob.poNumber) {
                updates.poNumber = workOrderNumber;
            }

            if (!state.isDemoMode) {
                await db.collection('jobs').doc(targetJob.id).update(cleanUndefinedFields(updates));
            }
            dispatch({
                type: 'UPDATE_JOB',
                payload: { id: targetJob.id, ...updates }
            });
            showToast.success(`Job #${(targetJob as any).jobNumber || targetJob.poNumber || targetJob.id.slice(-6)} linked to Work Order #${workOrderNumber}!`);
            setSelectedJobToLink('');
        } catch (err: any) {
            console.error("Failed to link job:", err);
            showToast.error("Failed to link job: " + err.message);
        } finally {
            setIsUploading(false);
        }
    };

    const handleCreateNewJobForWo = async () => {
        if (!workOrderNumber) return;
        setIsUploading(true);
        try {
            const newJob: any = {
                id: `job_${Date.now()}`,
                organizationId: state.currentOrganization?.id || 'org-demo',
                customerId: customer?.id || customerId || '',
                customerName: customer?.name || 'Customer',
                address: customer?.address || '',
                poNumber: workOrderNumber,
                workOrderNumber: workOrderNumber,
                linkedWorkOrderNumbers: [workOrderNumber],
                tasks: ['Service Visit'],
                jobStatus: 'Scheduled',
                appointmentTime: new Date().toISOString(),
                createdAt: new Date().toISOString(),
                visitType: 'Diagnostic & Repair'
            };

            if (!state.isDemoMode) {
                await db.collection('jobs').doc(newJob.id).set(cleanUndefinedFields(newJob));
            }
            dispatch({ type: 'ADD_JOB', payload: newJob });
            showToast.success(`New Job #${newJob.id.slice(-6)} created and linked to WO #${workOrderNumber}!`);
        } catch (err: any) {
            console.error("Failed to create new job:", err);
            showToast.error("Failed to create job: " + err.message);
        } finally {
            setIsUploading(false);
        }
    };

    const handleLinkProposalToWo = async (propIdToLink: string) => {
        if (!propIdToLink || !workOrderNumber) return;
        setIsUploading(true);
        try {
            const targetProp = state.proposals?.find(p => p.id === propIdToLink);
            if (!targetProp) return;

            const existingPropWos = (targetProp as any).linkedWorkOrderNumbers || [];
            const updates: any = {
                poNumber: workOrderNumber,
                linkedWorkOrderNumbers: Array.from(new Set([...existingPropWos, workOrderNumber])),
                updatedAt: new Date().toISOString()
            };

            if (!state.isDemoMode) {
                await db.collection('proposals').doc(targetProp.id).update(cleanUndefinedFields(updates));
            }
            dispatch({
                type: 'UPDATE_PROPOSAL',
                payload: { id: targetProp.id, ...updates }
            });
            showToast.success(`Proposal #${targetProp.id} linked to Work Order #${workOrderNumber}!`);
            setSelectedProposalToLink('');
        } catch (err: any) {
            console.error("Failed to link proposal:", err);
            showToast.error("Failed to link proposal: " + err.message);
        } finally {
            setIsUploading(false);
        }
    };

    const handleCreateNewProposalForWo = async () => {
        if (!workOrderNumber) return;
        setIsUploading(true);
        try {
            const targetJob = (associatedJobs && associatedJobs.length > 0) 
                ? associatedJobs[0] 
                : state.jobs.find(j => j.workOrderNumber === workOrderNumber || j.poNumber === workOrderNumber);

            let newProposalId: string;
            if (targetJob) {
                const existingCount = (state.proposals || []).filter(p => p.jobId === targetJob.id || targetJob.linkedProposalIds?.includes(p.id)).length;
                newProposalId = resolveJobProposalNumber(targetJob, existingCount, state.proposals);
            } else {
                newProposalId = await getNextProposalNumber(state.currentOrganization?.id || '');
            }

            const newProposal: any = {
                id: newProposalId,
                proposalNumber: newProposalId,
                organizationId: state.currentOrganization?.id || 'org-demo',
                customerId: customer?.id || customerId || (targetJob?.customerId || ''),
                customerName: customer?.name || targetJob?.customerName || 'Customer',
                address: customer?.address || targetJob?.address || '',
                jobId: targetJob?.id || null,
                linkedJobIds: targetJob?.id ? [targetJob.id] : [],
                poNumber: workOrderNumber,
                linkedWorkOrderNumbers: [workOrderNumber],
                title: `Service Proposal (WO #${workOrderNumber})`,
                status: 'Draft',
                items: [],
                subtotal: 0,
                total: 0,
                createdAt: new Date().toISOString()
            };

            if (!state.isDemoMode) {
                await db.collection('proposals').doc(newProposal.id).set(cleanUndefinedFields(newProposal));
            }
            dispatch({ type: 'ADD_PROPOSAL', payload: newProposal });

            if (associatedJobs && associatedJobs.length > 0) {
                for (const j of associatedJobs) {
                    const primaryPropId = j.proposalId || newProposal.id;
                    const updatedPropIds = Array.from(new Set([
                        ...(j.linkedProposalIds || []),
                        ...(j.proposalId ? [j.proposalId] : []),
                        newProposal.id
                    ]));
                    if (!state.isDemoMode) {
                        await db.collection('jobs').doc(j.id).update(cleanUndefinedFields({
                            proposalId: primaryPropId,
                            linkedProposalIds: updatedPropIds,
                            updatedAt: new Date().toISOString()
                        }));
                    }
                    dispatch({
                        type: 'UPDATE_JOB',
                        payload: { 
                            ...j, 
                            proposalId: primaryPropId, 
                            linkedProposalIds: updatedPropIds,
                            updatedAt: new Date().toISOString()
                        }
                    });
                }
            }

            showToast.success(`New Proposal #${newProposal.id} created and linked to WO #${workOrderNumber}!`);
        } catch (err: any) {
            console.error("Failed to create new proposal:", err);
            showToast.error("Failed to create proposal: " + err.message);
        } finally {
            setIsUploading(false);
        }
    };

    const handleLinkInvoiceToWo = async (jobIdForInv: string) => {
        if (!jobIdForInv || !workOrderNumber) return;
        setIsUploading(true);
        try {
            const targetJob = state.jobs.find(j => j.id === jobIdForInv);
            if (!targetJob || !targetJob.invoice) return;

            const updatedInvoice = {
                ...targetJob.invoice,
                poNumber: workOrderNumber
            };

            const existingWos = targetJob.linkedWorkOrderNumbers || targetJob.linkedPoNumbers || [];
            const updatedWoList = Array.from(new Set([...existingWos, workOrderNumber]));

            const updates: any = {
                invoice: updatedInvoice,
                linkedWorkOrderNumbers: updatedWoList,
                linkedPoNumbers: updatedWoList,
                updatedAt: new Date().toISOString()
            };

            if (!state.isDemoMode) {
                await db.collection('jobs').doc(targetJob.id).update(cleanUndefinedFields(updates));
            }
            dispatch({
                type: 'UPDATE_JOB',
                payload: { id: targetJob.id, ...updates }
            });
            showToast.success(`Invoice #${targetJob.invoice.id || 'INV'} linked to Work Order #${workOrderNumber}!`);
            setSelectedInvoiceToLink('');
        } catch (err: any) {
            console.error("Failed to link invoice:", err);
            showToast.error("Failed to link invoice: " + err.message);
        } finally {
            setIsUploading(false);
        }
    };

    const handleCreateNewInvoiceForWo = async () => {
        if (!workOrderNumber) return;
        setIsUploading(true);
        try {
            if (targetJobForUpload) {
                const currentInvoice = targetJobForUpload.invoice || {
                    id: `INV-${Date.now().toString().slice(-6)}`,
                    status: 'Unpaid',
                    items: [],
                    subtotal: 0,
                    taxRate: 0,
                    taxAmount: 0,
                    totalAmount: 0,
                    amount: 0,
                    date: new Date().toISOString()
                };
                const updatedInvoice = {
                    ...currentInvoice,
                    poNumber: workOrderNumber
                };
                const updates = {
                    invoice: updatedInvoice,
                    updatedAt: new Date().toISOString()
                };
                if (!state.isDemoMode) {
                    await db.collection('jobs').doc(targetJobForUpload.id).update(cleanUndefinedFields(updates));
                }
                dispatch({
                    type: 'UPDATE_JOB',
                    payload: { id: targetJobForUpload.id, ...updates }
                });
                showToast.success(`Invoice #${updatedInvoice.id} generated and linked to WO #${workOrderNumber}!`);
            } else {
                const newJob: any = {
                    id: `job_${Date.now()}`,
                    organizationId: state.currentOrganization?.id || 'org-demo',
                    customerId: customer?.id || customerId || '',
                    customerName: customer?.name || 'Customer',
                    address: customer?.address || '',
                    poNumber: workOrderNumber,
                    workOrderNumber: workOrderNumber,
                    linkedWorkOrderNumbers: [workOrderNumber],
                    tasks: ['Service Call'],
                    jobStatus: 'Scheduled',
                    appointmentTime: new Date().toISOString(),
                    createdAt: new Date().toISOString()
                };
                if (!state.isDemoMode) {
                    await db.collection('jobs').doc(newJob.id).set(cleanUndefinedFields(newJob));
                }
                dispatch({ type: 'ADD_JOB', payload: newJob });
                showToast.success(`Job created and linked to WO #${workOrderNumber}!`);
            }
        } catch (err: any) {
            console.error("Failed to create invoice:", err);
            showToast.error("Failed to create invoice: " + err.message);
        } finally {
            setIsUploading(false);
        }
    };

    const handleSaveNewExpense = async () => {
        if (!newExpVendor || !newExpAmount || !workOrderNumber) {
            showToast.warn("Please enter Vendor name and Amount.");
            return;
        }
        setIsUploading(true);
        try {
            let receiptUrl = '';
            if (newExpReceiptFile && targetJobForUpload) {
                receiptUrl = await uploadFileToStorage(
                    `expenses/${Date.now()}_${newExpReceiptFile.name}`,
                    newExpReceiptFile
                );
            }

            const amountNum = parseFloat(newExpAmount) || 0;
            const taxNum = parseFloat(newExpTax) || 0;
            const subNum = Math.max(0, amountNum - taxNum);

            const newExp: any = {
                id: `exp_${Date.now()}`,
                organizationId: state.currentOrganization.id,
                vendor: newExpVendor,
                category: newExpCategory,
                amount: amountNum,
                subtotal: subNum,
                taxAmount: taxNum,
                description: newExpDescription,
                date: new Date().toISOString().split('T')[0],
                poNumber: workOrderNumber,
                workOrderNumber: workOrderNumber,
                jobId: targetJobForUpload?.id || '',
                internalOnly: true,
                shownToCustomer: false,
                receiptUrl: receiptUrl || null,
                receiptUrls: receiptUrl ? [receiptUrl] : [],
                createdAt: new Date().toISOString()
            };

            if (!state.isDemoMode) {
                await db.collection('expenses').doc(newExp.id).set(cleanUndefinedFields(newExp));
            }
            dispatch({ type: 'ADD_EXPENSE', payload: newExp });
            showToast.success("Internal expense added and linked to Work Order!");
            setShowAddExpenseModal(false);
            setNewExpVendor('');
            setNewExpAmount('');
            setNewExpTax('');
            setNewExpDescription('');
            setNewExpReceiptFile(null);
        } catch (err: any) {
            console.error("Failed to add expense:", err);
            showToast.error("Failed to add expense: " + err.message);
        } finally {
            setIsUploading(false);
        }
    };

    const handleLinkExistingExpenseToWo = async (expIdToLink: string) => {
        if (!expIdToLink || !workOrderNumber) return;
        setIsUploading(true);
        try {
            const updates: any = {
                poNumber: workOrderNumber,
                workOrderNumber: workOrderNumber,
                internalOnly: true,
                shownToCustomer: false,
                updatedAt: new Date().toISOString()
            };
            if (!state.isDemoMode) {
                await db.collection('expenses').doc(expIdToLink).update(cleanUndefinedFields(updates));
            }
            dispatch({
                type: 'UPDATE_EXPENSE',
                payload: { id: expIdToLink, ...updates }
            });
            showToast.success(`Expense linked to Work Order #${workOrderNumber}!`);
            setSelectedExpenseToLink('');
        } catch (err: any) {
            console.error("Failed to link expense:", err);
            showToast.error("Failed to link expense: " + err.message);
        } finally {
            setIsUploading(false);
        }
    };

    // Retrieve associated service locations matching this PO, associated jobs, or proposals
    const associatedLocations = useMemo(() => {
        if (!customer) return [];
        const locs: any[] = [];
        const locIds = new Set<string>();

        const woRaw = workOrderNumber?.trim().toLowerCase() || '';
        const woNorm = normalizeWo(workOrderNumber);

        // 1. Exact location ID matches from associatedJobs
        associatedJobs.forEach(job => {
            const jobLocId = (job as any).serviceLocationId || (job as any).locationId || (job as any).propertyId;
            if (jobLocId && customer.serviceLocations) {
                const match = customer.serviceLocations.find((l: any) => l.id === jobLocId);
                if (match && !locIds.has(match.id)) {
                    locIds.add(match.id);
                    locs.push(match);
                }
            }
        });

        // 2. Exact location ID matches from associatedProposals
        associatedProposals.forEach(prop => {
            const propLocId = (prop as any).serviceLocationId || (prop as any).locationId;
            if (propLocId && customer.serviceLocations) {
                const match = customer.serviceLocations.find((l: any) => l.id === propLocId);
                if (match && !locIds.has(match.id)) {
                    locIds.add(match.id);
                    locs.push(match);
                }
            }
        });

        // 3. Locations matching PO explicitly on customer.serviceLocations
        (customer.serviceLocations || []).forEach((loc: any) => {
            const locPoRaw = loc.poNumber?.trim().toLowerCase() || '';
            const locPoNorm = normalizeWo(loc.poNumber);
            if ((woRaw && locPoRaw === woRaw) || (woNorm && locPoNorm === woNorm)) {
                if (!locIds.has(loc.id)) {
                    locIds.add(loc.id);
                    locs.push(loc);
                }
            }
        });

        // 4. Street address matching (only if no location ID or explicit PO match was found)
        if (locs.length === 0) {
            associatedJobs.forEach(job => {
                if (customer.serviceLocations && job.address) {
                    const cleanJAddr = job.address.toLowerCase().split(',')[0].trim();
                    const matchByAddr = customer.serviceLocations.find((l: any) => {
                        const cleanLAddr = (l.address || '').toLowerCase().split(',')[0].trim();
                        return cleanJAddr && cleanLAddr && (cleanJAddr.includes(cleanLAddr) || cleanLAddr.includes(cleanJAddr));
                    });
                    if (matchByAddr && !locIds.has(matchByAddr.id)) {
                        locIds.add(matchByAddr.id);
                        locs.push(matchByAddr);
                    }
                }
            });
        }

        // 5. Fallback: Create location object from job address if still no match
        if (locs.length === 0) {
            associatedJobs.forEach(job => {
                if (job.address && !locs.some(l => l.address === job.address)) {
                    const tempId = `job-loc-${job.id}`;
                    if (!locIds.has(tempId)) {
                        locIds.add(tempId);
                        locs.push({
                            id: tempId,
                            propertyName: (job as any).locationName || customer.name || 'Service Site',
                            address: job.address,
                            city: (job as any).city || '',
                            state: (job as any).state || '',
                            zip: (job as any).zip || ''
                        });
                    }
                }
            });
        }

        return locs;
    }, [customer, workOrderNumber, associatedJobs, associatedProposals]);

    const handleCopy = () => {
        if (workOrderNumber) {
            navigator.clipboard.writeText(workOrderNumber);
            setCopied(true);
            showToast.success("Work Order Number copied to clipboard!");
            setTimeout(() => setCopied(false), 2000);
        }
    };

    const handleUnlinkActiveWorkOrder = async () => {
        if (!workOrderNumber) return;
        if (!(await globalConfirm(`Are you sure you want to unlink Work Order / PO #${workOrderNumber} from all associated jobs?`, "Unlink Work Order", "Unlink", "Cancel"))) {
            return;
        }

        setIsUploading(true);
        try {
            const woLower = workOrderNumber.trim().toLowerCase();
            for (const job of associatedJobs) {
                const updatedWoList = (job.linkedWorkOrderNumbers || job.linkedPoNumbers || []).filter(
                    wo => wo.trim().toLowerCase() !== woLower
                );
                const updates: any = {
                    linkedWorkOrderNumbers: updatedWoList,
                    linkedPoNumbers: updatedWoList,
                    updatedAt: new Date().toISOString()
                };
                if (job.poNumber?.trim().toLowerCase() === woLower) {
                    updates.poNumber = updatedWoList[0] || null;
                }

                if (!state.isDemoMode) {
                    await db.collection('jobs').doc(job.id).update(cleanUndefinedFields(updates));
                }
                dispatch({
                    type: 'UPDATE_JOB',
                    payload: {
                        id: job.id,
                        ...updates
                    }
                });
            }
            showToast.success(`Work Order #${workOrderNumber} unlinked from all jobs.`);
            onClose();
        } catch (err: any) {
            console.error("Failed to unlink active work order:", err);
            showToast.error("Failed to unlink work order: " + err.message);
        } finally {
            setIsUploading(false);
        }
    };

    const handleDeleteFileFromJob = async (fileToDelete: any) => {
        if (!(await globalConfirm(`Are you sure you want to delete and unlink file "${fileToDelete.fileName || fileToDelete.label || 'Photo'}"?`, "Delete File", "Delete File", "Cancel"))) {
            return;
        }

        const targetJobId = fileToDelete.jobId || targetJobForUpload?.id;
        if (!targetJobId) {
            showToast.error("Could not find associated job for this file.");
            return;
        }

        setIsUploading(true);
        try {
            const targetJob = state.jobs?.find(j => j.id === targetJobId);
            if (!targetJob) throw new Error("Associated job not found.");

            const updatedFiles = (targetJob.files || []).filter((f: any) => f.id !== fileToDelete.id && f.dataUrl !== fileToDelete.dataUrl && f.url !== fileToDelete.url);
            const updates: any = {
                files: updatedFiles,
                updatedAt: new Date().toISOString()
            };

            if (!state.isDemoMode) {
                await db.collection('jobs').doc(targetJob.id).update(cleanUndefinedFields(updates));
            }
            dispatch({
                type: 'UPDATE_JOB',
                payload: {
                    id: targetJob.id,
                    ...updates
                }
            });
            showToast.success(`File "${fileToDelete.fileName || fileToDelete.label || 'Photo'}" deleted & unlinked.`);
        } catch (err: any) {
            console.error("Failed to delete file from job:", err);
            showToast.error("Failed to delete file: " + err.message);
        } finally {
            setIsUploading(false);
        }
    };

    const handleUploadExternalWorkOrder = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !targetJobForUpload || !state.currentOrganization) return;
        
        setIsUploading(true);
        try {
            const safeName = file.name ? file.name.replace(/[^a-zA-Z0-9.\-_]/g, '') : `wo-${Date.now()}.pdf`;
            const path = `organizations/${state.currentOrganization.id}/jobs/${targetJobForUpload.id}/documents/${Date.now()}_${safeName}`;
            const downloadUrl = await uploadFileToStorage(path, file);
            
            const timestamp = new Date().toISOString();
            const userName = `${state.currentUser?.firstName || ''} ${state.currentUser?.lastName || ''}`.trim() || 'Admin';
            
            const newFile = {
                id: `file-${Date.now()}`,
                organizationId: state.currentOrganization.id,
                parentId: targetJobForUpload.id,
                parentType: 'job',
                fileName: file.name || `External_Work_Order_${workOrderNumber}.pdf`,
                fileType: file.type || 'application/pdf',
                dataUrl: downloadUrl,
                createdAt: timestamp,
                uploadedBy: userName,
                label: 'External Work Order',
                metadata: {
                    label: 'External Work Order',
                    uploadedFrom: 'WorkOrderAssociationsModal'
                }
            };

            if (!state.isDemoMode) {
                await db.collection('jobs').doc(targetJobForUpload.id).update(cleanUndefinedFields({
                    files: firebase.firestore.FieldValue.arrayUnion(newFile),
                    updatedAt: timestamp
                }));
            }
            
            // Dispatch update to global context
            dispatch({
                type: 'UPDATE_JOB',
                payload: {
                    id: targetJobForUpload.id,
                    files: [...(targetJobForUpload.files || []), newFile]
                }
            });
            
            showToast.success("External Work Order uploaded and linked successfully!");
        } catch (err) {
            console.error("Failed to upload external work order:", err);
            showToast.error("Failed to upload external work order.");
        } finally {
            setIsUploading(false);
            if (e.target) e.target.value = ''; // Reset file input
        }
    };

    if (!isOpen || !workOrderNumber) return null;

    const isAdminUser = state.currentUser?.role !== 'customer';

    return (
        <>
            <Modal 
                isOpen={isOpen} 
                onClose={onClose} 
                title={`Work Order Associations`}
                size="xl"
            >
                <div className="flex flex-col gap-6">
                    {/* Premium Header Card */}
                    <div className="bg-gradient-to-r from-[#1E293B] to-[#0F172A] dark:from-slate-900 dark:to-slate-950 p-6 rounded-2xl text-white shadow-md relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-primary-600/10 rounded-full blur-2xl transform translate-x-10 -translate-y-10"></div>
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-primary-400">Active Work Order Reference</p>
                                <div className="flex items-center gap-3 mt-1">
                                    <h2 className="text-2xl font-black font-mono tracking-tight">{workOrderNumber}</h2>
                                    <button 
                                        onClick={handleCopy} 
                                        className="p-1.5 hover:bg-white/10 rounded-lg text-slate-300 hover:text-white transition-colors flex items-center gap-1 text-xs font-bold"
                                        title="Copy to Clipboard"
                                    >
                                        {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                                    </button>
                                    <button
                                        onClick={handleUnlinkActiveWorkOrder}
                                        disabled={isUploading}
                                        className="px-2.5 py-1 bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 hover:text-rose-100 rounded-lg transition-colors border border-rose-500/30 flex items-center gap-1.5 text-xs font-bold ml-2"
                                        title="Unlink Work Order Reference from all jobs"
                                    >
                                        <Unlink size={13} /> Unlink Reference
                                    </button>
                                </div>
                            </div>
                            
                            <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-xs">
                                <span className="text-slate-400 font-medium block">Customer</span>
                                <span className="font-bold text-white text-sm">{customer?.name || 'Loading Customer...'}</span>
                            </div>
                        </div>
                    </div>

                    {/* Navigation Tabs */}
                    <div className="flex border-b border-slate-200 dark:border-slate-700 overflow-x-auto pb-px">
                        {[
                            { id: 'overview', label: 'Overview', icon: Info },
                            { id: 'jobs', label: `Jobs (${associatedJobs.length})`, icon: Wrench },
                            { id: 'proposals', label: `Proposals (${associatedProposals.length})`, icon: FileText },
                            { id: 'invoices', label: `Invoices (${associatedInvoices.length})`, icon: DollarSign },
                            { id: 'files', label: `Photos/Files (${associatedFiles.length})`, icon: Image },
                            { id: 'expenses', label: `Expenses (${associatedExpenses.length})`, icon: Paperclip }
                        ].map(tab => {
                            const Icon = tab.icon;
                            const isActive = activeTab === tab.id;
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id as any)}
                                    className={`flex items-center gap-2 px-4 py-2.5 font-bold text-xs uppercase tracking-wider border-b-2 whitespace-nowrap transition-all outline-none ${
                                        isActive 
                                            ? 'border-primary-500 text-primary-600 dark:text-primary-400 font-black' 
                                            : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                                    }`}
                                >
                                    <Icon size={14} />
                                    {tab.label}
                                </button>
                            );
                        })}
                    </div>

                    {/* Tab Panels */}
                    <div className="min-h-[250px]">
                        {/* 1. Overview Tab */}
                        {activeTab === 'overview' && (
                            <div className="space-y-6 animate-fade-in">
                                {/* Quick Link Action Bar */}
                                <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl space-y-3">
                                    <div className="flex items-center justify-between">
                                        <h4 className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-widest flex items-center gap-1.5">
                                            <Link2 size={13} className="text-primary-600" /> Work Order Association Actions
                                        </h4>
                                        <span className="text-[10px] text-slate-400 font-bold">WO #{workOrderNumber}</span>
                                    </div>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5">
                                        <button
                                            type="button"
                                            onClick={() => setActiveTab('jobs')}
                                            className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/60 rounded-xl hover:border-primary-500 hover:shadow-sm transition-all flex flex-col items-center justify-center gap-1 text-center cursor-pointer"
                                        >
                                            <Wrench size={18} className="text-blue-600" />
                                            <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200">+ Link Job</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setActiveTab('proposals')}
                                            className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/60 rounded-xl hover:border-primary-500 hover:shadow-sm transition-all flex flex-col items-center justify-center gap-1 text-center cursor-pointer"
                                        >
                                            <FileText size={18} className="text-purple-600" />
                                            <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200">+ Link Proposal</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setActiveTab('invoices')}
                                            className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/60 rounded-xl hover:border-primary-500 hover:shadow-sm transition-all flex flex-col items-center justify-center gap-1 text-center cursor-pointer"
                                        >
                                            <DollarSign size={18} className="text-emerald-600" />
                                            <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200">+ Link Invoice</span>
                                        </button>
                                        <label className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/60 rounded-xl hover:border-primary-500 hover:shadow-sm transition-all flex flex-col items-center justify-center gap-1 text-center cursor-pointer">
                                            <Image size={18} className="text-amber-600" />
                                            <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200">+ Upload File</span>
                                            <input
                                                type="file"
                                                className="hidden"
                                                accept="image/*,application/pdf"
                                                onChange={handleUploadExternalWorkOrder}
                                                disabled={isUploading}
                                            />
                                        </label>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setActiveTab('expenses');
                                                setShowAddExpenseModal(true);
                                            }}
                                            className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/60 rounded-xl hover:border-primary-500 hover:shadow-sm transition-all flex flex-col items-center justify-center gap-1 text-center cursor-pointer"
                                        >
                                            <Paperclip size={18} className="text-rose-600" />
                                            <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200">+ Add Expense</span>
                                        </button>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {/* Customer Contact Block */}
                                    <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl">
                                        <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-4 flex items-center gap-1.5">
                                            <User size={12} className="text-primary-600" /> Customer Information
                                        </h4>
                                        {customer ? (
                                            <div className="space-y-3 text-xs">
                                                <p className="text-sm font-black text-slate-850 dark:text-white">{customer.name}</p>
                                                
                                                <div className="flex items-center gap-2 text-slate-600 dark:text-slate-350">
                                                    <Phone size={14} className="text-slate-400 shrink-0" />
                                                    <span>{customer.phone || 'N/A'}</span>
                                                </div>
                                                
                                                <div className="flex items-center gap-2 text-slate-600 dark:text-slate-350">
                                                    <Mail size={14} className="text-slate-400 shrink-0" />
                                                    <span className="truncate">{customer.email || 'N/A'}</span>
                                                </div>

                                                <div className="flex items-start gap-2 text-slate-600 dark:text-slate-350 pt-1">
                                                    <MapPin size={14} className="text-slate-400 shrink-0 mt-0.5" />
                                                    <span>{customer.address || 'N/A'}</span>
                                                </div>
                                            </div>
                                        ) : (
                                            <p className="text-xs text-slate-400 italic">No customer profile details available.</p>
                                        )}
                                    </div>

                                    {/* Service Location/Property Match Block */}
                                    <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl">
                                        <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-4 flex items-center gap-1.5">
                                            <MapPin size={12} className="text-emerald-600" /> Linked Properties / Service Sites
                                        </h4>
                                        {associatedLocations.length > 0 ? (
                                            <div className="space-y-3">
                                                {associatedLocations.map((loc: any) => (
                                                    <div key={loc.id} className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/60 rounded-xl">
                                                        <p className="font-bold text-xs text-slate-800 dark:text-slate-200">{loc.propertyName}</p>
                                                        <p className="text-[10px] text-slate-500 mt-1">{loc.address}</p>
                                                        {loc.gateCode && (
                                                            <span className="inline-block mt-2 text-[9px] font-bold bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded font-mono text-slate-600 dark:text-slate-400">
                                                                Code: {loc.gateCode}
                                                            </span>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <p className="text-xs text-slate-400 italic">No specific service locations list this PO explicitly. Address mapping defaults to the primary service site.</p>
                                        )}
                                    </div>
                                </div>

                                {/* External Work Order Upload Section */}
                                <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl">
                                    <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-4 flex items-center gap-1.5">
                                        <ShieldCheck size={12} className="text-primary-600" /> Customer External Work Order
                                    </h4>
                                    
                                    {hasExternalWorkOrder ? (
                                        <div className="space-y-4">
                                            <div className="flex items-center justify-between gap-3 p-3 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 rounded-xl text-emerald-800 dark:text-emerald-400 text-xs font-bold">
                                                <div className="flex items-center gap-2">
                                                    <ShieldCheck size={16} className="text-emerald-500 shrink-0" />
                                                    <span>External work order document(s) currently uploaded and linked to this PO:</span>
                                                </div>
                                                {targetJobForUpload && (
                                                    <label className="relative flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold cursor-pointer transition-colors shrink-0">
                                                        <Upload size={13} />
                                                        {isUploading ? 'Uploading...' : 'Upload Additional WO'}
                                                        <input 
                                                            type="file" 
                                                            className="hidden" 
                                                            accept="image/*,application/pdf" 
                                                            onChange={handleUploadExternalWorkOrder}
                                                            disabled={isUploading}
                                                        />
                                                    </label>
                                                )}
                                            </div>
                                            
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                {externalWoFiles.map((file: any) => (
                                                    <div key={file.id} className="p-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl flex items-center justify-between gap-3 shadow-sm">
                                                        <div className="space-y-0.5 overflow-hidden">
                                                            <p className="text-xs font-black text-slate-800 dark:text-slate-200 truncate">{file.fileName || 'Work Order PDF'}</p>
                                                            <p className="text-[10px] text-slate-400">
                                                                Uploaded {file.createdAt ? new Date(file.createdAt).toLocaleDateString() : ''} {file.uploadedBy ? `by ${file.uploadedBy}` : ''}
                                                            </p>
                                                        </div>
                                                        <div className="flex items-center gap-1 shrink-0">
                                                            <button
                                                                type="button"
                                                                onClick={() => setViewingDocument({ url: file.dataUrl || file.url, fileName: file.fileName || 'Work Order PDF' })}
                                                                className="px-2.5 py-1.5 bg-primary-50 dark:bg-primary-950/40 text-primary-600 dark:text-primary-400 hover:bg-primary-100 rounded-lg text-xs font-bold transition-colors flex items-center gap-1 border-0"
                                                                title="View Work Order Document"
                                                            >
                                                                <Eye size={14} /> View
                                                            </button>
                                                            <a
                                                                href={file.dataUrl || file.url}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg transition-colors"
                                                                title="Open in New Tab"
                                                            >
                                                                <ExternalLink size={14} />
                                                            </a>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleDeleteExternalWorkOrder(file)}
                                                                disabled={isUploading}
                                                                className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg transition-colors border-0 bg-transparent"
                                                                title="Delete & Unlink Work Order Document"
                                                            >
                                                                <Trash2 size={15} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-amber-50/50 dark:bg-amber-950/10 border border-amber-200/60 dark:border-amber-900/30 p-5 rounded-xl">
                                            <div>
                                                <p className="text-xs font-bold text-amber-800 dark:text-amber-400">Missing External Work Order</p>
                                                <p className="text-[10px] text-slate-500 mt-1">No customer external work order document has been uploaded for this reference yet.</p>
                                            </div>
                                            {targetJobForUpload ? (
                                                <label className="relative flex items-center justify-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider cursor-pointer shadow-md hover:shadow-lg transition-all">
                                                    <Upload size={14} />
                                                    {isUploading ? 'Uploading...' : 'Upload Work Order'}
                                                    <input 
                                                        type="file" 
                                                        className="hidden" 
                                                        accept="image/*,application/pdf" 
                                                        onChange={handleUploadExternalWorkOrder}
                                                        disabled={isUploading}
                                                    />
                                                </label>
                                            ) : (
                                                <p className="text-[10px] text-slate-400 italic">Please schedule/create a job under this PO number to enable document uploads.</p>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* 2. Jobs Panel */}
                        {activeTab === 'jobs' && (
                            <div className="space-y-4 animate-fade-in">
                                {/* Jobs Tab Link Action Bar */}
                                <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 p-4 rounded-xl space-y-3">
                                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                                        <h4 className="text-xs font-black uppercase text-slate-700 dark:text-slate-300 tracking-wider flex items-center gap-1.5">
                                            <Wrench size={14} className="text-primary-600" /> Service Jobs Linked to WO #{workOrderNumber}
                                        </h4>
                                        <button
                                            type="button"
                                            onClick={handleCreateNewJobForWo}
                                            disabled={isUploading}
                                            className="px-3.5 py-1.5 bg-primary-600 hover:bg-primary-700 text-white text-xs font-bold uppercase rounded-lg shadow-sm flex items-center gap-1 transition-all cursor-pointer"
                                        >
                                            <Plus size={13} /> Schedule New Job
                                        </button>
                                    </div>

                                    {unlinkedJobs.length > 0 && (
                                        <div className="flex items-center gap-2 pt-1 border-t border-slate-200 dark:border-slate-700">
                                            <select
                                                value={selectedJobToLink}
                                                onChange={(e) => setSelectedJobToLink(e.target.value)}
                                                className="flex-1 text-xs p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200"
                                            >
                                                 <option value="">Select Existing Job to Link...</option>
                                                {unlinkedJobs.map(j => (
                                                    <option key={j.id} value={j.id}>
                                                        Job #{(j as any).jobNumber || j.poNumber || j.id.slice(-6)} - {j.tasks?.join(', ') || 'Service Visit'} ({new Date(j.appointmentTime).toLocaleDateString()})
                                                    </option>
                                                ))}
                                            </select>
                                            <button
                                                type="button"
                                                onClick={() => handleLinkJobToWo(selectedJobToLink)}
                                                disabled={!selectedJobToLink || isUploading}
                                                className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1 cursor-pointer shrink-0"
                                            >
                                                <Link2 size={13} /> Link Selected Job
                                            </button>
                                        </div>
                                    )}
                                </div>
                                {associatedJobs.length > 0 ? associatedJobs.map(job => (
                                    <div key={job.id} className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 hover:shadow-md transition-shadow">
                                        <div className="flex gap-3 items-start">
                                            <div className="w-10 h-10 rounded-xl bg-primary-50 dark:bg-primary-950/40 text-primary-600 flex flex-col items-center justify-center shrink-0">
                                                <Calendar size={18} />
                                            </div>
                                            <div>
                                                <p className="font-black text-xs text-slate-900 dark:text-white uppercase tracking-tight">{job.tasks?.join(', ') || 'Service Call'}</p>
                                                <p className="text-[10px] text-slate-400 mt-0.5">{new Date(job.appointmentTime).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</p>
                                                <div className="flex items-center gap-2 mt-2">
                                                    <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest ${
                                                        job.jobStatus === 'Completed' ? 'bg-emerald-100 text-emerald-800' :
                                                        job.jobStatus === 'In Progress' ? 'bg-blue-100 text-blue-800' :
                                                        'bg-amber-100 text-amber-800'
                                                    }`}>{job.jobStatus}</span>
                                                    {job.assignedTechnicianName && (
                                                        <span className="text-[10px] text-slate-500 font-medium">Tech: {job.assignedTechnicianName}</span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        <Button 
                                            onClick={() => setSelectedJob(job)} 
                                            variant="secondary" 
                                            size="sm"
                                            className="self-start md:self-center"
                                        >
                                            View Report
                                        </Button>
                                    </div>
                                )) : (
                                    <div className="text-center py-10 text-xs text-slate-400">No jobs associated with this work order number.</div>
                                )}
                            </div>
                        )}

                        {/* 3. Proposals Panel */}
                        {activeTab === 'proposals' && (
                            <div className="space-y-4 animate-fade-in">
                                {/* Proposals Tab Link Action Bar */}
                                <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 p-4 rounded-xl space-y-3">
                                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                                        <h4 className="text-xs font-black uppercase text-slate-700 dark:text-slate-300 tracking-wider flex items-center gap-1.5">
                                            <FileText size={14} className="text-indigo-600" /> Proposals Linked to WO #{workOrderNumber}
                                        </h4>
                                        <button
                                            type="button"
                                            onClick={handleCreateNewProposalForWo}
                                            disabled={isUploading}
                                            className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold uppercase rounded-lg shadow-sm flex items-center gap-1 transition-all cursor-pointer"
                                        >
                                            <Plus size={13} /> Create New Proposal
                                        </button>
                                    </div>

                                    {unlinkedProposals.length > 0 && (
                                        <div className="flex items-center gap-2 pt-1 border-t border-slate-200 dark:border-slate-700">
                                            <select
                                                value={selectedProposalToLink}
                                                onChange={(e) => setSelectedProposalToLink(e.target.value)}
                                                className="flex-1 text-xs p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200"
                                            >
                                                <option value="">Select Existing Proposal to Link...</option>
                                                {unlinkedProposals.map(p => (
                                                    <option key={p.id} value={p.id}>
                                                        Proposal #{p.id.replace('prop-', '')} - {p.title || 'Proposal'} (${p.total?.toFixed(2)})
                                                    </option>
                                                ))}
                                            </select>
                                            <button
                                                type="button"
                                                onClick={() => handleLinkProposalToWo(selectedProposalToLink)}
                                                disabled={!selectedProposalToLink || isUploading}
                                                className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1 cursor-pointer shrink-0"
                                            >
                                                <Link2 size={13} /> Link Selected Proposal
                                            </button>
                                        </div>
                                    )}
                                </div>
                                {associatedProposals.length > 0 ? associatedProposals.map(prop => (
                                    <div key={prop.id} className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 hover:shadow-md transition-shadow">
                                        <div className="flex gap-3 items-start">
                                            <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 flex flex-col items-center justify-center shrink-0">
                                                <FileText size={18} />
                                            </div>
                                            <div>
                                                <p className="font-black text-xs text-slate-900 dark:text-white uppercase tracking-tight">{prop.title || 'Proposal'}</p>
                                                <p className="text-[10px] text-slate-400 mt-0.5">Created: {new Date(prop.createdAt).toLocaleDateString()}</p>
                                                <div className="flex items-center gap-2 mt-2">
                                                    <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest ${
                                                        prop.status === 'Accepted' ? 'bg-emerald-100 text-emerald-800' :
                                                        'bg-slate-100 text-slate-800'
                                                    }`}>{prop.status}</span>
                                                    <span className="text-[10px] font-black text-slate-700 dark:text-slate-350">${prop.total?.toFixed(2)}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <Button 
                                            onClick={() => setPreviewDoc({ type: 'Proposal', data: prop })} 
                                            variant="secondary" 
                                            size="sm"
                                            className="self-start md:self-center"
                                        >
                                            Preview Proposal
                                        </Button>
                                    </div>
                                )) : (
                                    <div className="text-center py-10 text-xs text-slate-400">No proposals associated with this work order number.</div>
                                )}
                            </div>
                        )}

                        {/* 4. Invoices Panel */}
                        {activeTab === 'invoices' && (
                            <div className="space-y-4 animate-fade-in">
                                {/* Invoices Tab Link Action Bar */}
                                <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 p-4 rounded-xl space-y-3">
                                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                                        <h4 className="text-xs font-black uppercase text-slate-700 dark:text-slate-300 tracking-wider flex items-center gap-1.5">
                                            <DollarSign size={14} className="text-emerald-600" /> Customer Invoices Linked to WO #{workOrderNumber}
                                        </h4>
                                        <button
                                            type="button"
                                            onClick={handleCreateNewInvoiceForWo}
                                            disabled={isUploading}
                                            className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold uppercase rounded-lg shadow-sm flex items-center gap-1 transition-all cursor-pointer"
                                        >
                                            <Plus size={13} /> Generate Customer Invoice
                                        </button>
                                    </div>

                                    {unlinkedInvoices.length > 0 && (
                                        <div className="flex items-center gap-2 pt-1 border-t border-slate-200 dark:border-slate-700">
                                            <select
                                                value={selectedInvoiceToLink}
                                                onChange={(e) => setSelectedInvoiceToLink(e.target.value)}
                                                className="flex-1 text-xs p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200"
                                            >
                                                <option value="">Select Existing Invoice to Link...</option>
                                                {unlinkedInvoices.map(j => (
                                                    <option key={j.id} value={j.id}>
                                                        Invoice #{j.invoice?.id || 'INV'} - Job #{(j as any).jobNumber || j.poNumber || j.id.slice(-6)} (${(j.invoice?.totalAmount || j.invoice?.amount || 0).toFixed(2)})
                                                    </option>
                                                ))}
                                            </select>
                                            <button
                                                type="button"
                                                onClick={() => handleLinkInvoiceToWo(selectedInvoiceToLink)}
                                                disabled={!selectedInvoiceToLink || isUploading}
                                                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1 cursor-pointer shrink-0"
                                            >
                                                <Link2 size={13} /> Link Selected Invoice
                                            </button>
                                        </div>
                                    )}
                                </div>
                                {associatedInvoices.length > 0 ? associatedInvoices.map(job => (
                                    <div key={job.id} className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 hover:shadow-md transition-shadow">
                                        <div className="flex gap-3 items-start">
                                            <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex flex-col items-center justify-center shrink-0">
                                                <DollarSign size={18} />
                                            </div>
                                            <div>
                                                <p className="font-black text-xs text-slate-900 dark:text-white uppercase tracking-tight">Invoice #{job.invoice?.id || 'Pending'}</p>
                                                <p className="text-[10px] text-slate-400 mt-0.5">Job: {job.tasks?.join(', ')}</p>
                                                <div className="flex items-center gap-2 mt-2">
                                                    <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest ${
                                                        job.invoice?.status === 'Paid' ? 'bg-emerald-100 text-emerald-800' :
                                                        'bg-rose-100 text-rose-800'
                                                    }`}>{job.invoice?.status || 'Unpaid'}</span>
                                                    <span className="text-[10px] font-black text-slate-700 dark:text-slate-350">
                                                        ${(job.invoice?.totalAmount || job.invoice?.amount || 0).toFixed(2)}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                        <Button 
                                            onClick={() => setPreviewDoc({ type: 'Invoice', data: job })} 
                                            variant="secondary" 
                                            size="sm"
                                            className="self-start md:self-center"
                                        >
                                            Preview Invoice
                                        </Button>
                                    </div>
                                )) : (
                                    <div className="text-center py-10 text-xs text-slate-400">No invoices associated with this work order number.</div>
                                )}
                            </div>
                        )}

                        {/* 5. Files/Photos Panel */}
                        {activeTab === 'files' && (
                            <div className="space-y-6 animate-fade-in">
                                {!hasExternalWorkOrder && (
                                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-amber-50/50 dark:bg-amber-950/10 border border-amber-200/60 dark:border-amber-900/30 p-5 rounded-xl">
                                        <div>
                                            <p className="text-xs font-bold text-amber-800 dark:text-amber-400">Missing External Work Order</p>
                                            <p className="text-[10px] text-slate-500 mt-1">No customer external work order document has been uploaded for this reference yet.</p>
                                        </div>
                                        {targetJobForUpload ? (
                                            <label className="relative flex items-center justify-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider cursor-pointer shadow-md hover:shadow-lg transition-all">
                                                <Upload size={14} />
                                                {isUploading ? 'Uploading...' : 'Upload Work Order'}
                                                <input 
                                                    type="file" 
                                                    className="hidden" 
                                                    accept="image/*,application/pdf" 
                                                    onChange={handleUploadExternalWorkOrder}
                                                    disabled={isUploading}
                                                />
                                            </label>
                                        ) : (
                                            <p className="text-[10px] text-slate-400 italic">Please schedule/create a job under this PO number to enable document uploads.</p>
                                        )}
                                    </div>
                                )}

                                {associatedFiles.length > 0 ? (
                                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                                        {associatedFiles.map((file, idx) => {
                                            const isImage = isPhotoFile(file);
                                            const url = file.dataUrl || file.url;
                                            
                                            return (
                                                <div key={file.id || idx} className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm flex flex-col justify-between hover:shadow transition-shadow">
                                                    {isImage ? (
                                                        <div 
                                                            onClick={() => setLightboxImage(url)}
                                                            className="w-full h-32 bg-slate-200 dark:bg-slate-800 relative cursor-pointer group"
                                                        >
                                                            <img 
                                                                src={url} 
                                                                alt={file.label || 'Job Photo'} 
                                                                className="w-full h-full object-cover group-hover:opacity-90 transition-opacity" 
                                                            />
                                                            <span className="absolute bottom-1 right-1 bg-black/60 text-white text-[8px] px-1 py-0.5 rounded font-black uppercase">
                                                                {file.metadata?.label || 'Photo'}
                                                            </span>
                                                        </div>
                                                    ) : (
                                                        <a 
                                                            href={url} 
                                                            target="_blank" 
                                                            rel="noopener noreferrer" 
                                                            className="w-full h-32 flex flex-col items-center justify-center bg-slate-100 dark:bg-slate-800/50 text-slate-400 hover:text-primary-600 transition-colors"
                                                        >
                                                            <FileText size={32} />
                                                            <span className="text-[9px] font-bold mt-2 uppercase tracking-wide px-2 text-center truncate w-full">
                                                                {file.fileName || 'Document'}
                                                            </span>
                                                        </a>
                                                    )}
                                                    
                                                    <div className="p-2 border-t border-slate-200/50 dark:border-slate-800 flex items-center justify-between gap-2">
                                                        <div className="overflow-hidden">
                                                            <p className="text-[8px] font-black text-slate-400 uppercase truncate">
                                                                {file.jobTasks?.join(', ')}
                                                            </p>
                                                            <p className="text-[7px] font-bold text-slate-400 mt-0.5">
                                                                {new Date(file.jobDate).toLocaleDateString()}
                                                            </p>
                                                        </div>
                                                        <div className="flex items-center gap-1 shrink-0">
                                                            {isImage && (
                                                                <button
                                                                    type="button"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleStartEditPhoto(file);
                                                                    }}
                                                                    disabled={isUploading}
                                                                    className="p-1 text-slate-400 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-950/20 rounded transition-colors border-0 bg-transparent shrink-0"
                                                                    title="Edit All 3 Photo Labels"
                                                                >
                                                                    <Pencil size={13} />
                                                                </button>
                                                            )}
                                                            <button
                                                                type="button"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleDeleteFileFromJob(file);
                                                                }}
                                                                disabled={isUploading}
                                                                className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded transition-colors border-0 bg-transparent shrink-0"
                                                                title="Delete & Unlink File"
                                                            >
                                                                <Trash2 size={13} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div className="text-center py-10 text-xs text-slate-400">No photos or documents uploaded under this work order number.</div>
                                )}
                            </div>
                        )}

                        {/* 6. Expenses Tab */}
                        {activeTab === 'expenses' && (
                            <div className="space-y-4 animate-fade-in">
                                {/* Expenses Tab Link Action Bar */}
                                <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 p-4 rounded-xl space-y-3">
                                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                                        <h4 className="text-xs font-black uppercase text-slate-700 dark:text-slate-300 tracking-wider flex items-center gap-1.5">
                                            <Paperclip size={14} className="text-rose-600" /> Internal Expenses & Material Receipts Linked to WO #{workOrderNumber}
                                        </h4>
                                        <button
                                            type="button"
                                            onClick={() => setShowAddExpenseModal(true)}
                                            className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold uppercase rounded-lg shadow-sm flex items-center gap-1 transition-all cursor-pointer"
                                        >
                                            <Plus size={13} /> Add Internal Expense
                                        </button>
                                    </div>

                                    {unlinkedExpenses.length > 0 && (
                                        <div className="flex items-center gap-2 pt-1 border-t border-slate-200 dark:border-slate-700">
                                            <select
                                                value={selectedExpenseToLink}
                                                onChange={(e) => setSelectedExpenseToLink(e.target.value)}
                                                className="flex-1 text-xs p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200"
                                            >
                                                <option value="">Select Existing Expense Record to Link...</option>
                                                {unlinkedExpenses.map(e => (
                                                    <option key={e.id} value={e.id}>
                                                        Expense: {e.vendor} - {e.category} (${Number(e.amount || 0).toFixed(2)}) - {e.date}
                                                    </option>
                                                ))}
                                            </select>
                                            <button
                                                type="button"
                                                onClick={() => handleLinkExistingExpenseToWo(selectedExpenseToLink)}
                                                disabled={!selectedExpenseToLink || isUploading}
                                                className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1 cursor-pointer shrink-0"
                                            >
                                                <Link2 size={13} /> Link Selected Expense
                                            </button>
                                        </div>
                                    )}
                                </div>

                                <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 p-3.5 rounded-xl flex items-start gap-3 text-xs text-amber-900 dark:text-amber-200">
                                    <ShieldCheck size={18} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                                    <div className="space-y-0.5">
                                        <p className="font-extrabold uppercase tracking-wide">Internal Work Order Expenses & Material Receipts</p>
                                        <p className="leading-relaxed">
                                            These expense receipts and purchase records are strictly confidential internal cost records tied to PO/Work Order #{workOrderNumber}. They are <strong>never</strong> shown, shared, or printed on customer proposals or invoices.
                                        </p>
                                    </div>
                                </div>

                                {associatedExpenses.length > 0 ? (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {associatedExpenses.map((exp: any) => {
                                            const expTotal = Number(exp.amount) || 0;
                                            const expTax = Number(exp.taxAmount) || 0;
                                            const expSubtotal = Number(exp.subtotal) || (expTotal ? Math.max(0, expTotal - expTax) : 0);
                                            const possibleReceipt = exp.receiptData || exp.receiptUrl || exp.receipt || exp.imageUrl || exp.photoUrl;
                                            const receiptUrls = exp.receiptUrls && exp.receiptUrls.length > 0 ? exp.receiptUrls : (possibleReceipt ? [possibleReceipt] : []);

                                            return (
                                                <div key={exp.id} className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl flex items-center justify-between gap-4 shadow-sm hover:shadow-md transition-shadow">
                                                    <div className="space-y-1 flex-1">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-xs font-black font-mono text-slate-900 dark:text-white">{exp.vendor}</span>
                                                            <span className="px-2 py-0.5 text-[8px] font-black uppercase tracking-wider rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                                                                {exp.category}
                                                            </span>
                                                            <span className="px-2 py-0.5 text-[8px] font-black uppercase tracking-wider rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 flex items-center gap-0.5">
                                                                <ShieldCheck size={10} /> Internal Only
                                                            </span>
                                                        </div>
                                                        <div className="text-[10px] text-slate-500 flex flex-col gap-0.5">
                                                            <span>{exp.date} &bull; {exp.description || 'No description'}</span>
                                                            <div className="flex gap-3 font-semibold text-slate-700 dark:text-slate-300 mt-0.5">
                                                                <span>Sub: ${expSubtotal.toFixed(2)}</span>
                                                                <span className="text-purple-600 dark:text-purple-400">Tax: ${expTax.toFixed(2)}</span>
                                                                <span className="font-bold text-red-600">Total: ${expTotal.toFixed(2)}</span>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {receiptUrls.length > 0 && (
                                                        <button
                                                            type="button"
                                                            onClick={() => setLightboxImage(receiptUrls[0])}
                                                            className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30 rounded-lg transition-colors border-0 bg-transparent outline-none flex items-center gap-1 text-xs font-bold shrink-0"
                                                            title="View Receipt Image"
                                                        >
                                                            <Eye size={16} /> View Receipt
                                                        </button>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div className="text-center py-10 text-xs text-slate-400">No internal expense receipts attached to this work order.</div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </Modal>

            {/* Nested JobDetailModal */}
            {selectedJob && (
                <JobDetailModal
                    isOpen={!!selectedJob}
                    onClose={() => setSelectedJob(null)}
                    job={selectedJob}
                    isAdmin={isAdminUser}
                />
            )}

            {/* Nested DocumentPreview */}
            {previewDoc && (
                <DocumentPreview
                    onClose={() => setPreviewDoc(null)}
                    type={previewDoc.type}
                    data={previewDoc.data}
                />
            )}

            {/* Document / Work Order Lightbox Modal */}
            {viewingDocument && (
                <Modal isOpen={true} onClose={() => setViewingDocument(null)} title={(viewingDocument as any)?.fileName || (viewingDocument as any)?.title || "Work Order Document"} size="xl">
                    <div className="space-y-4 p-2 text-center">
                        {(() => {
                            const rawUrl = (viewingDocument as any)?.url || (viewingDocument as any)?.fileUrl || (viewingDocument as any)?.dataUrl || '';
                            let docUrl = rawUrl;
                            
                            if (rawUrl.startsWith('data:application/pdf;base64,')) {
                                try {
                                    const base64Data = rawUrl.split(',')[1];
                                    const byteCharacters = atob(base64Data);
                                    const byteNumbers = new Array(byteCharacters.length);
                                    for (let i = 0; i < byteCharacters.length; i++) {
                                        byteNumbers[i] = byteCharacters.charCodeAt(i);
                                    }
                                    const byteArray = new Uint8Array(byteNumbers);
                                    const blob = new Blob([byteArray], { type: 'application/pdf' });
                                    docUrl = URL.createObjectURL(blob);
                                } catch (err) {
                                    console.error("Failed to convert PDF base64 to Blob URL:", err);
                                }
                            }

                            const fileInfo = detectFileType(docUrl || rawUrl, (viewingDocument as any)?.fileName, (viewingDocument as any)?.fileType || (viewingDocument as any)?.type);

                            return (
                                <>
                                    <div className="flex justify-end gap-2 mb-2">
                                        <a
                                            href={docUrl || rawUrl || '#'}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm"
                                        >
                                            <ExternalLink size={14} /> Open in New Tab / Download
                                        </a>
                                    </div>
                                    {fileInfo.isImage ? (
                                        <img src={docUrl} alt="Work Order Document" className="max-h-[70vh] w-auto mx-auto object-contain rounded-xl border border-slate-200 dark:border-slate-800" />
                                    ) : fileInfo.isPdf ? (
                                        <iframe
                                            src={docUrl}
                                            title="Work Order Preview"
                                            className="w-full h-[70vh] rounded-xl border border-slate-200 dark:border-slate-800 bg-white"
                                        />
                                    ) : fileInfo.isHtml ? (
                                        <iframe
                                            srcDoc={docUrl.startsWith('data:text/html;base64,') ? decodeURIComponent(escape(atob(docUrl.split('base64,')[1]))) : undefined}
                                            src={!docUrl.startsWith('data:text/html;base64,') ? docUrl : undefined}
                                            title="Work Order Preview"
                                            className="w-full h-[70vh] rounded-xl border border-slate-200 dark:border-slate-800 bg-white"
                                        />
                                    ) : fileInfo.googleDocsViewerUrl ? (
                                        <iframe
                                            src={fileInfo.googleDocsViewerUrl}
                                            title="Work Order Preview"
                                            className="w-full h-[70vh] rounded-xl border border-slate-200 dark:border-slate-800 bg-white"
                                        />
                                    ) : (
                                        <iframe
                                            src={docUrl}
                                            title="Work Order Preview"
                                            className="w-full h-[70vh] rounded-xl border border-slate-200 dark:border-slate-800 bg-white"
                                        />
                                    )}
                                </>
                            );
                        })()}
                    </div>
                </Modal>
            )}

            {/* Edit All 3 Photo Labels Modal */}
            {editingPhoto && (
                <Modal
                    isOpen={!!editingPhoto}
                    onClose={() => setEditingPhoto(null)}
                    title="Edit Photo Labels"
                    size="md"
                >
                    <div className="space-y-4 p-1 text-left">
                        <div className="flex gap-4 items-center bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                            <img
                                src={editingPhoto.dataUrl || editingPhoto.url}
                                alt="Preview"
                                className="w-16 h-16 object-cover rounded-lg border border-slate-200 dark:border-slate-700 shrink-0"
                            />
                            <div className="overflow-hidden">
                                <p className="text-xs font-black text-slate-800 dark:text-slate-200 truncate">{editingPhoto.fileName || 'Photo File'}</p>
                                <p className="text-[10px] text-slate-400">Job #{editingPhoto.jobId?.slice(-6).toUpperCase()}</p>
                            </div>
                        </div>

                        {/* Label 1: Title / Caption */}
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">1. Photo Title / Caption Label:</label>
                            <Input
                                value={editTitle}
                                onChange={(e) => setEditTitle(e.target.value)}
                                placeholder="e.g. Compressor Wiring, Unit Plate, Air Handler"
                                className="text-xs"
                            />
                        </div>

                        {/* Label 2: Phase / Category */}
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">2. Phase / Category (Report Section):</label>
                            <select
                                value={editCategory}
                                onChange={(e) => setEditCategory(e.target.value as any)}
                                className="w-full text-xs font-bold rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 p-2 text-slate-800 dark:text-slate-200"
                            >
                                <option value="Before">Before Repair (Initial Diagnosis)</option>
                                <option value="After">After Repair (Completed Work)</option>
                                <option value="Specifications">System Specifications (Data Plate / Serial)</option>
                                <option value="Uncategorized">Other / Uncategorized</option>
                            </select>
                        </div>

                        {/* Label 3: Serviced Equipment / Unit Link */}
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">3. Serviced Equipment Unit:</label>
                            <select
                                value={editAssetId}
                                onChange={(e) => setEditAssetId(e.target.value)}
                                className="w-full text-xs font-bold rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 p-2 text-slate-800 dark:text-slate-200"
                            >
                                <option value="">Unassigned / General Job Photo</option>
                                {(customer?.equipment || []).map((eq: any) => (
                                    <option key={eq.id} value={eq.id}>{eq.name || `Unit #${eq.id.slice(-4)}`} {eq.brand ? `(${eq.brand})` : ''}</option>
                                ))}
                            </select>
                        </div>

                        <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                            <Button variant="secondary" size="sm" onClick={() => setEditingPhoto(null)}>
                                Cancel
                            </Button>
                            <Button variant="primary" size="sm" onClick={handleSavePhotoLabels} disabled={isUploading}>
                                {isUploading ? 'Saving...' : 'Save Labels'}
                            </Button>
                        </div>
                    </div>
                </Modal>
            )}

            {/* Add Internal Expense Modal */}
            {showAddExpenseModal && (
                <Modal
                    isOpen={showAddExpenseModal}
                    onClose={() => setShowAddExpenseModal(false)}
                    title={`Add Internal Expense for WO #${workOrderNumber}`}
                    size="md"
                >
                    <div className="space-y-4 text-xs p-1">
                        <div>
                            <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">Vendor Name *</label>
                            <Input
                                placeholder="e.g., Grainger, Johnstone Supply, Home Depot"
                                value={newExpVendor}
                                onChange={(e) => setNewExpVendor(e.target.value)}
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">Category</label>
                                <select
                                    value={newExpCategory}
                                    onChange={(e) => setNewExpCategory(e.target.value)}
                                    className="w-full p-2 text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-bold"
                                >
                                    <option value="Materials & Parts">Materials & Parts</option>
                                    <option value="Subcontractor Pay">Subcontractor Pay</option>
                                    <option value="Tools & Equipment">Tools & Equipment</option>
                                    <option value="Fuel & Mileage">Fuel & Mileage</option>
                                    <option value="Permits & Fees">Permits & Fees</option>
                                    <option value="Other">Other</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">Total Amount ($) *</label>
                                <Input
                                    type="number"
                                    placeholder="0.00"
                                    value={newExpAmount}
                                    onChange={(e) => setNewExpAmount(e.target.value)}
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">Tax Amount ($)</label>
                                <Input
                                    type="number"
                                    placeholder="0.00"
                                    value={newExpTax}
                                    onChange={(e) => setNewExpTax(e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">Receipt Photo / PDF</label>
                                <input
                                    type="file"
                                    accept="image/*,application/pdf"
                                    onChange={(e) => setNewExpReceiptFile(e.target.files?.[0] || null)}
                                    className="text-xs p-1"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">Description / Line Items</label>
                            <textarea
                                placeholder="Enter receipt notes or line item details..."
                                value={newExpDescription}
                                onChange={(e) => setNewExpDescription(e.target.value)}
                                className="w-full p-2 text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 h-20"
                            />
                        </div>
                        <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                            <Button variant="secondary" size="sm" onClick={() => setShowAddExpenseModal(false)}>Cancel</Button>
                            <Button size="sm" onClick={handleSaveNewExpense} disabled={isUploading}>
                                {isUploading ? 'Saving...' : 'Save & Link Expense'}
                            </Button>
                        </div>
                    </div>
                </Modal>
            )}
        </>
    );
};

export default WorkOrderAssociationsModal;
