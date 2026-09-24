import { cleanUndefinedFields, formatDisplayId } from '../../lib/utils';
import { extractJobSlug, resolveJobProposalNumber, resolveJobInvoiceNumber, getNextProposalNumber } from '../../lib/numbering';
import React, { useState, useMemo } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import SearchableSelect, { SearchableSelectOption } from '../ui/SearchableSelect';
import { useAppContext } from 'context/AppContext';
import { db } from 'lib/firebase';
import showToast from 'lib/toast';
import { 
    Wrench, FileText, DollarSign, Link2, Unlink, Plus, AlertCircle, Info, Calendar, Clock, Paperclip, ShieldCheck, Eye, Receipt, ClipboardList, ExternalLink, Upload, FileUp, Download, Trash2, CheckCircle2, Image, Copy, Check, MapPin, Phone, Mail, User, UserCheck, UserPlus, Send, Pencil
} from 'lucide-react';
import { Job, Proposal } from '../../types';
import WorkOrderAssociationsModal from './WorkOrderAssociationsModal';
import { SubcontractorWorkOrderModal } from './SubcontractorWorkOrderModal';
import { SendSubcontractorWorkOrderModal } from './SendSubcontractorWorkOrderModal';
import JobDetailModal from './JobDetailModal';
import DocumentPreview from '../ui/DocumentPreview';
import { uploadFileToStorage } from 'lib/storageService';
import firebase from 'firebase/compat/app';
import { detectFileType } from 'lib/fileViewerHelper';
import { globalConfirm } from 'lib/globalConfirm';

interface JobLinkingModalProps {
    isOpen: boolean;
    onClose: () => void;
    job: Job;
}

const JobLinkingModal: React.FC<JobLinkingModalProps> = ({ isOpen, onClose, job }) => {
    const { state, dispatch } = useAppContext();
    const [activeTab, setActiveTab] = useState<'jobs' | 'workorders' | 'invoices' | 'proposals' | 'expenses' | 'files'>('jobs');
    const [selectedJobToLink, setSelectedJobToLink] = useState('');
    const [selectedInvoiceToLink, setSelectedInvoiceToLink] = useState('');
    const [selectedProposalToLink, setSelectedProposalToLink] = useState('');
    const [selectedExpenseToLink, setSelectedExpenseToLink] = useState('');
    const [inputWoNumber, setInputWoNumber] = useState('');
    const [viewingWoNumber, setViewingWoNumber] = useState<string | null>(null);
    const [viewingReceiptUrls, setViewingReceiptUrls] = useState<string[] | null>(null);
    const [viewingDocument, setViewingDocument] = useState<{ url: string; fileName: string } | null>(null);
    const [previewDoc, setPreviewDoc] = useState<{ type: 'Proposal' | 'Invoice'; data: any } | null>(null);
    const [isActionPending, setIsActionPending] = useState(false);
    const [isSubcontractorWoOpen, setIsSubcontractorWoOpen] = useState(false);
    const [isSendSubcontractorWoOpen, setIsSendSubcontractorWoOpen] = useState(false);
    const [selectedWoJob, setSelectedWoJob] = useState<Job | null>(null);
    const [selectedJobForModal, setSelectedJobForModal] = useState<Job | null>(null);
    const [copiedPo, setCopiedPo] = useState(false);

    // New Expense Form State
    const [showAddExpenseModal, setShowAddExpenseModal] = useState(false);
    const [newExpVendor, setNewExpVendor] = useState('');
    const [newExpCategory, setNewExpCategory] = useState('Materials & Parts');
    const [newExpAmount, setNewExpAmount] = useState('');
    const [newExpTax, setNewExpTax] = useState('');
    const [newExpDescription, setNewExpDescription] = useState('');
    const [newExpReceiptFile, setNewExpReceiptFile] = useState<File | null>(null);

    // Photo Category Filter State
    const [photoFilterCategory, setPhotoFilterCategory] = useState<'All' | 'Before' | 'After' | 'Specifications' | 'Uncategorized'>('All');

    const currentJob = useMemo(() => {
        return (state.jobs || []).find((j: Job) => j.id === job.id) || job;
    }, [state.jobs, job]);

    const hasSubcontractor = useMemo(() => {
        return !!(
            currentJob.subcontractorId || 
            (currentJob as any).assignedPartnerId || 
            (currentJob as any).subcontractorName || 
            currentJob.subcontractorWorkOrder ||
            currentJob.subcontractorPhone ||
            (currentJob as any).partnerPayoutAmount ||
            (currentJob as any).subcontractorPayRate ||
            (currentJob as any).subcontractorNte
        );
    }, [currentJob]);

    const subWoData = useMemo(() => {
        if (!hasSubcontractor) return null;
        const wo = currentJob.subcontractorWorkOrder;
        const subName = currentJob.subcontractorName || 
                        (currentJob as any).assignedPartnerName || 
                        wo?.customSubName || 
                        wo?.contactName || 
                        'Assigned Subcontractor';
        const subPhone = currentJob.subcontractorPhone || wo?.customSubPhone || wo?.contactPhone || '';
        const subEmail = (currentJob as any).subcontractorEmail || wo?.customSubEmail || wo?.contactEmail || '';
        const woNumber = wo?.workOrderNumber || currentJob.workOrderNumber || currentJob.jobNumber || currentJob.id.slice(-6).toUpperCase();
        const nte = wo?.nte || (currentJob as any)?.partnerPayoutAmount || (currentJob as any)?.subcontractorPayRate || (currentJob as any)?.subcontractorNte || '0.00';
        const status = wo?.status || 'Draft';
        const ivrNumber = wo?.ivrNumber || '';
        const ivrPin = wo?.ivrPin || '';
        const sentAt = wo?.sentAt || (currentJob as any)?.workOrderSentAt || null;

        return {
            subName,
            subPhone,
            subEmail,
            woNumber,
            nte,
            status,
            ivrNumber,
            ivrPin,
            sentAt,
            instructions: wo?.specialInstructions || ''
        };
    }, [hasSubcontractor, currentJob]);

    const openCustomerPoViewer = (po: string) => {
        // 1. Check if an external PDF/Document matching this PO # is uploaded
        const matchedFile = (currentJob.files || []).find((f: any) => 
            (f.woNumber && f.woNumber.trim().toLowerCase() === po.trim().toLowerCase()) ||
            (f.fileName && f.fileName.toLowerCase().includes(po.trim().toLowerCase()))
        );

        if (matchedFile && (matchedFile.dataUrl || matchedFile.url || matchedFile.fileUrl)) {
            setViewingDocument({ url: matchedFile.dataUrl || matchedFile.url || matchedFile.fileUrl, fileName: matchedFile.fileName || `Customer PO #${po}` });
            return;
        }

        // 2. Open Work Order Associations modal to see customer history for this PO
        setViewingWoNumber(po);
    };

    const openSubcontractorWoViewer = () => {
        setSelectedWoJob(currentJob);
        setIsSubcontractorWoOpen(true);
    };

    // 1. Jobs Resolution
    const linkedJobs = useMemo(() => {
        return (state.jobs || []).filter((j: Job) => 
            j.id !== currentJob.id && (
                currentJob.linkedJobIds?.includes(j.id) || 
                j.linkedJobIds?.includes(currentJob.id)
            )
        );
    }, [state.jobs, currentJob]);

    const availableJobs = useMemo(() => {
        return (state.jobs || []).filter((j: Job) => 
            j.customerId === currentJob.customerId && 
            j.id !== currentJob.id && 
            !linkedJobs.some((lj: Job) => lj.id === j.id)
        );
    }, [state.jobs, currentJob, linkedJobs]);

    // 2. Invoices Resolution (Includes current job's primary invoice + any linked invoices)
    const linkedInvoices = useMemo(() => {
        const invoiceIds = currentJob.linkedInvoiceIds || [];
        const list: Array<{ job: Job; invoice: any; isPrimary?: boolean }> = [];

        // 1. Current job's own primary invoice
        if (currentJob.invoice) {
            list.push({
                job: currentJob,
                invoice: currentJob.invoice,
                isPrimary: true
            });
        }

        // 2. Linked invoices from other customer jobs
        (state.jobs || []).forEach((j: Job) => {
            if (j.id !== currentJob.id && j.invoice && invoiceIds.includes(j.invoice.id)) {
                if (!list.some(item => item.invoice.id === j.invoice!.id)) {
                    list.push({
                        job: j,
                        invoice: j.invoice!,
                        isPrimary: false
                    });
                }
            }
        });

        return list;
    }, [state.jobs, currentJob]);

    const availableInvoices = useMemo(() => {
        const linkedInvoiceIds = new Set([
            ...(currentJob.linkedInvoiceIds || []),
            ...(currentJob.invoice ? [currentJob.invoice.id] : [])
        ]);

        return (state.jobs || [])
            .filter((j: Job) => 
                j.customerId === currentJob.customerId && 
                j.id !== currentJob.id && 
                j.invoice && 
                !linkedInvoiceIds.has(j.invoice.id)
            )
            .map((j: Job) => ({
                job: j,
                invoice: j.invoice!
            }));
    }, [state.jobs, currentJob]);

    // 3. Proposals Resolution
    const linkedProposals = useMemo(() => {
        const linkedIds = new Set(currentJob.linkedProposalIds || []);
        if (currentJob.proposalId) linkedIds.add(currentJob.proposalId);
        if (currentJob.projectId) linkedIds.add(currentJob.projectId);

        return (state.proposals || []).filter((p: Proposal) => 
            linkedIds.has(p.id) || 
            p.jobId === currentJob.id || 
            p.linkedJobIds?.includes(currentJob.id)
        );
    }, [state.proposals, currentJob]);

    const availableProposals = useMemo(() => {
        const linkedIds = new Set(linkedProposals.map(p => p.id));
        return (state.proposals || []).filter((p: Proposal) => 
            p.customerId === currentJob.customerId && 
            !linkedIds.has(p.id)
        );
    }, [state.proposals, currentJob, linkedProposals]);

    const proposalOptions: SearchableSelectOption[] = useMemo(() => {
        return availableProposals.map((p: Proposal) => {
            const displayTitle = p.title || p.items?.[0]?.name || 'Service Proposal';
            const dateStr = p.createdAt ? new Date(p.createdAt).toLocaleDateString() : '';
            const statusStr = p.status ? `[${p.status}]` : '';
            const totalStr = p.total != null ? `$${p.total.toFixed(2)}` : '';
            const custInfo = p.customerName ? ` • Customer: ${p.customerName}` : '';
            const subLabel = `ID: #${formatDisplayId(p.id)}${dateStr ? ` • Date: ${dateStr}` : ''} • Total: ${totalStr} ${statusStr}${custInfo}`;

            return {
                value: p.id,
                label: displayTitle,
                subLabel: subLabel
            };
        });
    }, [availableProposals]);

    // 4. Expenses Resolution
    const linkedExpenses = useMemo(() => {
        const linkedIds = currentJob.linkedExpenseIds || [];
        return (state.expenses || []).filter((exp: any) => 
            linkedIds.includes(exp.id) || exp.jobId === currentJob.id
        );
    }, [state.expenses, currentJob.linkedExpenseIds, currentJob.id]);

    const availableExpenses = useMemo(() => {
        const linkedIds = currentJob.linkedExpenseIds || [];
        return (state.expenses || []).filter((exp: any) => 
            !linkedIds.includes(exp.id) && exp.jobId !== currentJob.id
        );
    }, [state.expenses, currentJob.linkedExpenseIds, currentJob.id]);

    // 5. Work Orders / PO Resolution
    const linkedWorkOrders = useMemo(() => {
        const wos = new Set<string>();
        if (currentJob.poNumber?.trim()) wos.add(currentJob.poNumber.trim());
        (currentJob.linkedPoNumbers || []).forEach(wo => wo?.trim() && wos.add(wo.trim()));
        (currentJob.linkedWorkOrderNumbers || []).forEach(wo => wo?.trim() && wos.add(wo.trim()));
        return Array.from(wos);
    }, [currentJob.poNumber, currentJob.linkedPoNumbers, currentJob.linkedWorkOrderNumbers]);

    const availableWorkOrders = useMemo(() => {
        const existing = new Set(linkedWorkOrders.map(w => w.toLowerCase()));
        const found = new Set<string>();

        (state.jobs || []).forEach((j: Job) => {
            if (j.customerId === currentJob.customerId && j.poNumber?.trim()) {
                const clean = j.poNumber.trim();
                if (!existing.has(clean.toLowerCase())) found.add(clean);
            }
        });

        (state.proposals || []).forEach((p: Proposal) => {
            if (p.customerId === currentJob.customerId && p.poNumber?.trim()) {
                const clean = p.poNumber.trim();
                if (!existing.has(clean.toLowerCase())) found.add(clean);
            }
        });

        return Array.from(found);
    }, [state.jobs, state.proposals, currentJob.customerId, linkedWorkOrders]);

    const [isUploadingWoFile, setIsUploadingWoFile] = useState(false);

    const externalWorkOrderFiles = useMemo(() => {
        return (currentJob.files || []).filter((f: any) => 
            f.label?.toLowerCase() === 'external work order' || 
            f.metadata?.label?.toLowerCase() === 'external work order' ||
            f.fileName?.toLowerCase().includes('external_workorder') ||
            f.fileName?.toLowerCase().includes('external work order') ||
            f.isExternalWorkOrder === true
        );
    }, [currentJob.files]);

    const customer = useMemo(() => {
        if (!currentJob.customerId) return null;
        return state.customers?.find(c => c.id === currentJob.customerId) || null;
    }, [state.customers, currentJob.customerId]);

    const allJobFilesAndPhotos = useMemo(() => {
        const list: any[] = [...(currentJob.files || [])];

        if (currentJob.unitStates && Array.isArray(currentJob.unitStates)) {
            currentJob.unitStates.forEach((us: any) => {
                const unitPhotos = [
                    { url: us.beforePhotoUrl, label: `Unit ${us.assetTag || us.assetId || ''} (Before Repair)`, category: 'Before' },
                    { url: us.afterPhotoUrl, label: `Unit ${us.assetTag || us.assetId || ''} (After Repair)`, category: 'After' },
                    { url: us.photoUrl, label: `Unit ${us.assetTag || us.assetId || ''} Photo`, category: 'Specifications' },
                    ...(us.photos || []).map((p: any) => typeof p === 'string' ? { url: p, label: 'Unit Photo', category: 'Specifications' } : p)
                ];
                unitPhotos.forEach((up: any) => {
                    if (up && up.url && !list.some(f => (f.dataUrl || f.url) === up.url)) {
                        list.push({
                            id: `us-${currentJob.id}-${Math.random().toString(36).substring(2, 7)}`,
                            dataUrl: up.url,
                            url: up.url,
                            label: up.label || 'Unit Photo',
                            category: up.category || 'Specifications',
                            type: 'Photo',
                            fileType: 'image/jpeg',
                            createdAt: currentJob.appointmentTime
                        });
                    }
                });
            });
        }

        // Include files & photos from explicitly linked jobs at the same location
        const jobLocId = currentJob.locationId || currentJob.propertyId || currentJob.location?.id;
        linkedJobs.forEach((lj: any) => {
            const ljLocId = lj.locationId || lj.propertyId || lj.location?.id;
            if (!jobLocId || !ljLocId || jobLocId === ljLocId) {
                if (lj.files && Array.isArray(lj.files)) {
                    lj.files.forEach((f: any) => {
                        if (!list.some(existing => (existing.id && existing.id === f.id) || (existing.dataUrl || existing.url) === (f.dataUrl || f.url))) {
                            list.push({ ...f, jobId: lj.id });
                        }
                    });
                }
                if (lj.unitStates && Array.isArray(lj.unitStates)) {
                    lj.unitStates.forEach((us: any) => {
                        const unitPhotos = [
                            { url: us.beforePhotoUrl, label: `Unit ${us.assetTag || us.assetId || ''} (Before Repair)`, category: 'Before' },
                            { url: us.afterPhotoUrl, label: `Unit ${us.assetTag || us.assetId || ''} (After Repair)`, category: 'After' },
                            { url: us.photoUrl, label: `Unit ${us.assetTag || us.assetId || ''} Photo`, category: 'Specifications' },
                            ...(us.photos || []).map((p: any) => typeof p === 'string' ? { url: p, label: 'Unit Photo', category: 'Specifications' } : p)
                        ];
                        unitPhotos.forEach((up: any) => {
                            if (up && up.url && !list.some(f => (f.dataUrl || f.url) === up.url)) {
                                list.push({
                                    id: `us-${lj.id}-${Math.random().toString(36).substring(2, 7)}`,
                                    dataUrl: up.url,
                                    url: up.url,
                                    label: up.label || 'Unit Photo',
                                    category: up.category || 'Specifications',
                                    type: 'Photo',
                                    fileType: 'image/jpeg',
                                    jobId: lj.id,
                                    createdAt: lj.appointmentTime
                                });
                            }
                        });
                    });
                }
            }
        });

        // Equipment photos matching serviced equipment on this visit or linked visits
        if (customer && customer.equipment && Array.isArray(customer.equipment)) {
            customer.equipment.forEach((eq: any) => {
                const isEqMatch = (currentJob.equipmentIds && (currentJob.equipmentIds as any).includes(eq.id)) ||
                    currentJob.unitStates?.some((us: any) => us.assetId === eq.id) ||
                    linkedJobs.some((lj: any) => lj.equipmentIds?.includes(eq.id) || lj.unitStates?.some((us: any) => us.assetId === eq.id));

                if (isEqMatch) {
                    const eqPhotos = [
                        { url: eq.serialPhotoUrl, label: `${eq.name || 'Unit'} - Serial Tag`, category: 'Specifications' },
                        { url: eq.unitTagPhotoUrl, label: `${eq.name || 'Unit'} - Unit Plate`, category: 'Specifications' },
                        { url: eq.conditionPhotoUrl, label: `${eq.name || 'Unit'} - Condition Photo`, category: 'Before' },
                        { url: eq.wideLocationPhotoUrl, label: `${eq.name || 'Unit'} - Location Photo`, category: 'Specifications' },
                        { url: eq.accessPointPhotoUrl, label: `${eq.name || 'Unit'} - Access Path Photo`, category: 'Specifications' },
                        { url: eq.qrCodePhotoUrl, label: `${eq.name || 'Unit'} - QR Code`, category: 'Specifications' }
                    ];
                    eqPhotos.forEach(p => {
                        if (p.url && !list.some(existing => (existing.dataUrl || existing.url) === p.url)) {
                            list.push({
                                id: `eq-${eq.id}-${Math.random().toString(36).substring(2, 7)}`,
                                dataUrl: p.url,
                                url: p.url,
                                label: p.label,
                                category: p.category,
                                type: 'Photo',
                                fileType: 'image/jpeg',
                                createdAt: eq.updatedAt || new Date().toISOString()
                            });
                        }
                    });
                }
            });
        }

        return list;
    }, [currentJob, customer, linkedJobs]);

    const filteredFilesAndPhotos = useMemo(() => {
        if (photoFilterCategory === 'All') return allJobFilesAndPhotos;
        return allJobFilesAndPhotos.filter(f => {
            const label = (f.label || f.fileName || '').toLowerCase();
            const category = (f.category || '').toLowerCase();
            if (photoFilterCategory === 'Before') {
                return category === 'before' || label.includes('before');
            }
            if (photoFilterCategory === 'After') {
                return category === 'after' || label.includes('after');
            }
            if (photoFilterCategory === 'Specifications') {
                return category === 'specifications' || label.includes('serial') || label.includes('plate') || label.includes('tag') || label.includes('qr') || label.includes('location') || label.includes('spec');
            }
            if (photoFilterCategory === 'Uncategorized') {
                return !category && !label.includes('before') && !label.includes('after') && !label.includes('serial') && !label.includes('plate') && !label.includes('tag');
            }
            return true;
        });
    }, [allJobFilesAndPhotos, photoFilterCategory]);

    const handleFileUploadWorkOrder = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploadingWoFile(true);
        try {
            const safeName = file.name ? file.name.replace(/[^a-zA-Z0-9.\-_]/g, '') : `wo-${Date.now()}.pdf`;
            const orgId = state.currentOrganization?.id || 'org';
            const path = `organizations/${orgId}/jobs/${job.id}/documents/${Date.now()}_${safeName}`;
            const downloadUrl = await uploadFileToStorage(path, file);

            const timestamp = new Date().toISOString();
            const userName = `${state.currentUser?.firstName || ''} ${state.currentUser?.lastName || ''}`.trim() || 'Admin';

            const filenameMatch = file.name.match(/(WO|PO)[-_\s]?\d+/i);
            const extractedWo = inputWoNumber.trim() || (filenameMatch ? filenameMatch[0].toUpperCase() : `EXT-WO-${Date.now().toString().slice(-6)}`);

            const newFile = {
                id: `file-${Date.now()}`,
                organizationId: orgId,
                parentId: job.id,
                parentType: 'job',
                fileName: file.name,
                fileType: file.type || 'application/pdf',
                dataUrl: downloadUrl,
                createdAt: timestamp,
                uploadedBy: userName,
                label: 'External Work Order',
                woNumber: extractedWo,
                isExternalWorkOrder: true,
                metadata: {
                    label: 'External Work Order',
                    woNumber: extractedWo,
                    uploadedFrom: 'JobLinkingModal'
                }
            };

            const updatedWoList = Array.from(new Set([...(job.linkedWorkOrderNumbers || []), ...(job.linkedPoNumbers || []), extractedWo]));
            const updates: any = {
                files: firebase.firestore.FieldValue.arrayUnion(newFile),
                linkedWorkOrderNumbers: updatedWoList,
                linkedPoNumbers: updatedWoList,
                updatedAt: timestamp
            };
            if (!job.poNumber) {
                updates.poNumber = extractedWo;
            }

            await db.collection('jobs').doc(job.id).update(cleanUndefinedFields(updates));
            dispatch({
                type: 'UPDATE_JOB',
                payload: {
                    id: job.id,
                    files: [...(job.files || []), newFile],
                    linkedWorkOrderNumbers: updatedWoList,
                    linkedPoNumbers: updatedWoList,
                    poNumber: job.poNumber || extractedWo
                }
            });

            showToast.success(`External Work Order PDF (${file.name}) uploaded & linked to #${extractedWo}!`);
            setInputWoNumber('');
        } catch (err: any) {
            console.error("Failed to upload external work order:", err);
            showToast.error("Failed to upload work order PDF: " + err.message);
        } finally {
            setIsUploadingWoFile(false);
            if (e.target) e.target.value = '';
        }
    };

    const handleLinkWorkOrder = async (woToLink?: string) => {
        const targetWo = (woToLink || inputWoNumber)?.trim();
        if (!targetWo) return;

        setIsActionPending(true);
        try {
            const updatedWoList = Array.from(new Set([...(job.linkedWorkOrderNumbers || []), ...(job.linkedPoNumbers || []), targetWo]));
            const updates: any = { 
                linkedWorkOrderNumbers: updatedWoList,
                linkedPoNumbers: updatedWoList
            };
            if (!job.poNumber) {
                updates.poNumber = targetWo;
            }

            await db.collection('jobs').doc(job.id).update(cleanUndefinedFields(updates));
            dispatch({ type: 'UPDATE_JOB', payload: { id: job.id, ...updates } });
            showToast.success(`Work Order / PO #${targetWo} linked successfully!`);
            setInputWoNumber('');
        } catch (error: any) {
            console.error(error);
            showToast.error("Failed to link Work Order: " + error.message);
        } finally {
            setIsActionPending(false);
        }
    };

    const handleUnlinkWorkOrder = async (woToUnlink: string) => {
        setIsActionPending(true);
        try {
            const updatedWoList = (job.linkedWorkOrderNumbers || job.linkedPoNumbers || []).filter(
                wo => wo.trim().toLowerCase() !== woToUnlink.trim().toLowerCase()
            );
            const updates: any = { 
                linkedWorkOrderNumbers: updatedWoList,
                linkedPoNumbers: updatedWoList
            };
            if (job.poNumber?.trim().toLowerCase() === woToUnlink.trim().toLowerCase()) {
                updates.poNumber = updatedWoList[0] || null;
            }

            await db.collection('jobs').doc(job.id).update(cleanUndefinedFields(updates));
            dispatch({ type: 'UPDATE_JOB', payload: { id: job.id, ...updates } });
            showToast.success(`Work Order #${woToUnlink} unlinked successfully.`);
        } catch (error: any) {
            console.error(error);
            showToast.error("Failed to unlink Work Order: " + error.message);
        } finally {
            setIsActionPending(false);
        }
    };

    const handleDeleteUploadedWorkOrder = async (fileToDelete: any) => {
        if (!(await globalConfirm(`Are you sure you want to delete and unlink external work order document "${fileToDelete.fileName || 'Document'}"?`, "Delete Work Order Document", "Delete Document", "Cancel"))) {
            return;
        }

        setIsActionPending(true);
        try {
            const updatedFiles = (job.files || []).filter((f: any) => f.id !== fileToDelete.id && f.dataUrl !== fileToDelete.dataUrl);
            const updates: any = {
                files: updatedFiles,
                updatedAt: new Date().toISOString()
            };

            await db.collection('jobs').doc(job.id).update(cleanUndefinedFields(updates));
            dispatch({
                type: 'UPDATE_JOB',
                payload: {
                    id: job.id,
                    ...updates
                }
            });

            showToast.success(`Uploaded Work Order document "${fileToDelete.fileName || 'Document'}" deleted & unlinked successfully.`);
        } catch (err: any) {
            console.error("Failed to delete external work order file:", err);
            showToast.error("Failed to delete work order document: " + err.message);
        } finally {
            setIsActionPending(false);
        }
    };

    const handleDeleteFileFromJob = async (fileToDelete: any) => {
        if (!(await globalConfirm(`Are you sure you want to delete and unlink file "${fileToDelete.fileName || fileToDelete.label || 'Photo'}"?`, "Delete File", "Delete File", "Cancel"))) {
            return;
        }

        setIsActionPending(true);
        try {
            const updatedFiles = (job.files || []).filter((f: any) => f.id !== fileToDelete.id && f.dataUrl !== fileToDelete.dataUrl && f.url !== fileToDelete.url);
            const updates: any = {
                files: updatedFiles,
                updatedAt: new Date().toISOString()
            };

            await db.collection('jobs').doc(job.id).update(cleanUndefinedFields(updates));
            dispatch({
                type: 'UPDATE_JOB',
                payload: {
                    id: job.id,
                    ...updates
                }
            });
            showToast.success(`File "${fileToDelete.fileName || fileToDelete.label || 'Photo'}" deleted & unlinked.`);
        } catch (err: any) {
            console.error("Failed to delete file from job:", err);
            showToast.error("Failed to delete file: " + err.message);
        } finally {
            setIsActionPending(false);
        }
    };

    // DB / Dispatch Helpers
    const handleLinkExpense = async () => {
        if (!selectedExpenseToLink) return;
        setIsActionPending(true);
        try {
            const updatedExpenseIds = Array.from(new Set([...(job.linkedExpenseIds || []), selectedExpenseToLink]));
            // Update Job record
            await db.collection('jobs').doc(job.id).update(cleanUndefinedFields({ linkedExpenseIds: updatedExpenseIds }));
            // Update Expense record with internalOnly flag so customer never sees it
            await db.collection('expenses').doc(selectedExpenseToLink).update(cleanUndefinedFields({ 
                jobId: job.id, 
                internalOnly: true, 
                shownToCustomer: false 
            }));

            dispatch({ type: 'UPDATE_JOB', payload: { id: job.id, linkedExpenseIds: updatedExpenseIds } });
            showToast.success("Expense receipt linked to job (Internal only).");
            setSelectedExpenseToLink('');
        } catch (error: any) {
            console.error(error);
            showToast.error("Failed to link expense: " + error.message);
        } finally {
            setIsActionPending(false);
        }
    };

    const handleUnlinkExpense = async (expenseId: string) => {
        setIsActionPending(true);
        try {
            const updatedExpenseIds = (job.linkedExpenseIds || []).filter(id => id !== expenseId);
            await db.collection('jobs').doc(job.id).update(cleanUndefinedFields({ linkedExpenseIds: updatedExpenseIds }));
            await db.collection('expenses').doc(expenseId).update(cleanUndefinedFields({ jobId: '' }));

            dispatch({ type: 'UPDATE_JOB', payload: { id: job.id, linkedExpenseIds: updatedExpenseIds } });
            showToast.success("Expense receipt unlinked from job.");
        } catch (error: any) {
            console.error(error);
            showToast.error("Failed to unlink expense: " + error.message);
        } finally {
            setIsActionPending(false);
        }
    };

    // DB / Dispatch Helpers
    const handleLinkJob = async () => {
        if (!selectedJobToLink) return;
        setIsActionPending(true);
        try {
            // Target job updates
            const targetJob = state.jobs.find(j => j.id === selectedJobToLink);
            if (!targetJob) throw new Error("Target job not found.");

            const updatedCurrentJobIds = Array.from(new Set([...(job.linkedJobIds || []), selectedJobToLink]));
            const updatedTargetJobIds = Array.from(new Set([...(targetJob.linkedJobIds || []), job.id]));

            // Update DB
            await db.collection('jobs').doc(job.id).update(cleanUndefinedFields({ linkedJobIds: updatedCurrentJobIds }));
            await db.collection('jobs').doc(selectedJobToLink).update(cleanUndefinedFields({ linkedJobIds: updatedTargetJobIds }));

            // Update Context
            dispatch({ type: 'UPDATE_JOB', payload: { id: job.id, linkedJobIds: updatedCurrentJobIds } });
            dispatch({ type: 'UPDATE_JOB', payload: { id: selectedJobToLink, linkedJobIds: updatedTargetJobIds } });

            showToast.success("Jobs linked successfully!");
            setSelectedJobToLink('');
        } catch (error: any) {
            console.error(error);
            showToast.error("Failed to link jobs: " + error.message);
        } finally {
            setIsActionPending(false);
        }
    };

    const handleUnlinkJob = async (targetJobId: string) => {
        setIsActionPending(true);
        try {
            const targetJob = state.jobs.find(j => j.id === targetJobId);
            const updatedCurrentJobIds = (job.linkedJobIds || []).filter(id => id !== targetJobId);
            
            // Update current job in DB
            await db.collection('jobs').doc(job.id).update(cleanUndefinedFields({ linkedJobIds: updatedCurrentJobIds }));
            dispatch({ type: 'UPDATE_JOB', payload: { id: job.id, linkedJobIds: updatedCurrentJobIds } });

            // Update target job in DB (if exists)
            if (targetJob) {
                const updatedTargetJobIds = (targetJob.linkedJobIds || []).filter(id => id !== job.id);
                await db.collection('jobs').doc(targetJobId).update(cleanUndefinedFields({ linkedJobIds: updatedTargetJobIds }));
                dispatch({ type: 'UPDATE_JOB', payload: { id: targetJobId, linkedJobIds: updatedTargetJobIds } });
            }

            showToast.success("Jobs unlinked successfully.");
        } catch (error: any) {
            console.error(error);
            showToast.error("Failed to unlink jobs: " + error.message);
        } finally {
            setIsActionPending(false);
        }
    };

    const handleLinkInvoice = async () => {
        if (!selectedInvoiceToLink) return;
        setIsActionPending(true);
        try {
            const updatedInvoiceIds = Array.from(new Set([...(job.linkedInvoiceIds || []), selectedInvoiceToLink]));

            // Update current job
            await db.collection('jobs').doc(job.id).update(cleanUndefinedFields({ linkedInvoiceIds: updatedInvoiceIds }));
            dispatch({ type: 'UPDATE_JOB', payload: { id: job.id, linkedInvoiceIds: updatedInvoiceIds } });

            showToast.success("Invoice linked successfully!");
            setSelectedInvoiceToLink('');
        } catch (error: any) {
            console.error(error);
            showToast.error("Failed to link invoice: " + error.message);
        } finally {
            setIsActionPending(false);
        }
    };

    const handleUnlinkInvoice = async (invoiceId: string) => {
        setIsActionPending(true);
        try {
            const updatedInvoiceIds = (job.linkedInvoiceIds || []).filter(id => id !== invoiceId);

            // Update current job
            await db.collection('jobs').doc(job.id).update(cleanUndefinedFields({ linkedInvoiceIds: updatedInvoiceIds }));
            dispatch({ type: 'UPDATE_JOB', payload: { id: job.id, linkedInvoiceIds: updatedInvoiceIds } });

            showToast.success("Invoice unlinked successfully.");
        } catch (error: any) {
            console.error(error);
            showToast.error("Failed to unlink invoice: " + error.message);
        } finally {
            setIsActionPending(false);
        }
    };

    const handleLinkProposal = async () => {
        if (!selectedProposalToLink) return;
        setIsActionPending(true);
        try {
            const targetProp = state.proposals.find(p => p.id === selectedProposalToLink);
            if (!targetProp) throw new Error("Proposal not found.");

            const updatedCurrentPropIds = Array.from(new Set([...(currentJob.linkedProposalIds || []), selectedProposalToLink]));
            const updatedTargetJobIds = Array.from(new Set([...(targetProp.linkedJobIds || []), currentJob.id]));

            const propRefNum = targetProp.referenceNumber || (targetProp.id.startsWith('PROP-') && !targetProp.id.includes(extractJobSlug(currentJob.id)) ? targetProp.id : null);
            const propUpdates: any = {
                linkedJobIds: updatedTargetJobIds,
                customerId: targetProp.customerId || currentJob.customerId,
                customerName: targetProp.customerName || currentJob.customerName,
                locationName: targetProp.locationName || currentJob.locationName,
                locationAddress: targetProp.locationAddress || (targetProp as any).address || currentJob.address || currentJob.locationAddress,
                address: (targetProp as any).address || currentJob.address,
                referenceNumber: propRefNum,
            };
            if (!targetProp.jobId) propUpdates.jobId = currentJob.id;
            if (!targetProp.poNumber && currentJob.poNumber) propUpdates.poNumber = currentJob.poNumber;

            const jobUpdates: any = {
                linkedProposalIds: updatedCurrentPropIds,
            };
            if (!currentJob.proposalId) jobUpdates.proposalId = selectedProposalToLink;

            // Update DB
            await db.collection('jobs').doc(currentJob.id).update(cleanUndefinedFields(jobUpdates));
            await db.collection('proposals').doc(selectedProposalToLink).update(cleanUndefinedFields(propUpdates));

            // Update Context
            dispatch({ type: 'UPDATE_JOB', payload: { id: currentJob.id, ...jobUpdates } });
            dispatch({ type: 'UPDATE_PROPOSAL', payload: { id: selectedProposalToLink, ...propUpdates } });

            showToast.success("Proposal linked successfully!");
            setSelectedProposalToLink('');
        } catch (error: any) {
            console.error(error);
            showToast.error("Failed to link proposal: " + error.message);
        } finally {
            setIsActionPending(false);
        }
    };

    const handleUnlinkProposal = async (proposalId: string) => {
        setIsActionPending(true);
        try {
            const targetProp = state.proposals.find(p => p.id === proposalId);
            const updatedCurrentPropIds = (currentJob.linkedProposalIds || []).filter(id => id !== proposalId);
            
            // Check main project relation
            const jobUpdates: any = { linkedProposalIds: updatedCurrentPropIds };
            if (currentJob.proposalId === proposalId) jobUpdates.proposalId = '';
            if (currentJob.projectId === proposalId) jobUpdates.projectId = '';

            await db.collection('jobs').doc(currentJob.id).update(cleanUndefinedFields(jobUpdates));
            dispatch({ type: 'UPDATE_JOB', payload: { id: currentJob.id, ...jobUpdates } });

            if (targetProp) {
                const updatedTargetJobIds = (targetProp.linkedJobIds || []).filter(id => id !== currentJob.id);
                const propUpdates: any = { linkedJobIds: updatedTargetJobIds };
                if (targetProp.jobId === currentJob.id) propUpdates.jobId = '';

                await db.collection('proposals').doc(proposalId).update(cleanUndefinedFields(propUpdates));
                dispatch({ type: 'UPDATE_PROPOSAL', payload: { id: proposalId, ...propUpdates } });
            }

            showToast.success("Proposal unlinked successfully.");
        } catch (error: any) {
            console.error(error);
            showToast.error("Failed to unlink proposal: " + error.message);
        } finally {
            setIsActionPending(false);
        }
    };

    const handleCreateNewProposalForJob = async () => {
        if (!currentJob) return;
        setIsActionPending(true);
        try {
            const existingCount = (state.proposals || []).filter(p => p.jobId === currentJob.id || currentJob.linkedProposalIds?.includes(p.id)).length;
            let newProposalId = resolveJobProposalNumber(currentJob, existingCount, state.proposals);
            if (!newProposalId || newProposalId.includes('undefined')) {
                newProposalId = await getNextProposalNumber(state.currentOrganization?.id || '');
            }

            const newProposal: any = {
                id: newProposalId,
                proposalNumber: newProposalId,
                organizationId: state.currentOrganization?.id || 'org-demo',
                customerId: currentJob.customerId || customer?.id || '',
                customerName: currentJob.customerName || customer?.name || 'Customer',
                address: currentJob.address || customer?.address || '',
                locationId: currentJob.locationId || currentJob.propertyId || null,
                locationName: currentJob.locationName || null,
                locationAddress: currentJob.locationAddress || currentJob.address || '',
                jobId: currentJob.id,
                linkedJobIds: [currentJob.id],
                poNumber: currentJob.poNumber || '',
                linkedWorkOrderNumbers: currentJob.linkedWorkOrderNumbers || (currentJob.poNumber ? [currentJob.poNumber] : []),
                title: `Service Proposal (Job #${formatDisplayId(currentJob.id)})`,
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

            const updatedPropIds = Array.from(new Set([
                ...(currentJob.linkedProposalIds || []),
                ...(currentJob.proposalId ? [currentJob.proposalId] : []),
                newProposal.id
            ]));
            const jobUpdates: any = {
                proposalId: currentJob.proposalId || newProposal.id,
                linkedProposalIds: updatedPropIds,
                updatedAt: new Date().toISOString()
            };

            if (!state.isDemoMode) {
                await db.collection('jobs').doc(currentJob.id).update(cleanUndefinedFields(jobUpdates));
            }
            dispatch({
                type: 'UPDATE_JOB',
                payload: { ...currentJob, ...jobUpdates }
            });

            showToast.success(`New Proposal #${formatDisplayId(newProposal.id)} created & linked to Job #${formatDisplayId(currentJob.id)}!`);
            setActiveTab('proposals');
            setPreviewDoc({ type: 'Proposal', data: newProposal });
        } catch (err: any) {
            console.error("Failed to create new proposal:", err);
            showToast.error("Failed to create proposal: " + err.message);
        } finally {
            setIsActionPending(false);
        }
    };

    const handleCreateNewInvoiceForJob = async () => {
        if (!currentJob) return;
        setIsActionPending(true);
        try {
            let newInvoiceId = resolveJobInvoiceNumber(currentJob, 0, state.jobs);
            if (!newInvoiceId || newInvoiceId.includes('undefined')) {
                newInvoiceId = `INV-${Date.now().toString().slice(-6)}`;
            }

            const newInvoice: any = {
                id: newInvoiceId,
                status: 'Unpaid',
                items: (currentJob.tasks && currentJob.tasks.length > 0 ? currentJob.tasks : ['HVAC Service & Diagnostics']).map(t => ({
                    id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
                    description: t,
                    quantity: 1,
                    unitPrice: 0,
                    amount: 0
                })),
                subtotal: 0,
                taxRate: 0,
                taxAmount: 0,
                totalAmount: 0,
                amount: 0,
                date: new Date().toISOString().split('T')[0],
                poNumber: currentJob.poNumber || ''
            };

            const jobUpdates: any = {
                invoice: newInvoice,
                updatedAt: new Date().toISOString()
            };

            if (!state.isDemoMode) {
                await db.collection('jobs').doc(currentJob.id).update(cleanUndefinedFields(jobUpdates));
            }
            dispatch({
                type: 'UPDATE_JOB',
                payload: { ...currentJob, ...jobUpdates }
            });

            showToast.success(`Invoice #${newInvoice.id} generated for Job #${formatDisplayId(currentJob.id)}!`);
            setActiveTab('invoices');
            setPreviewDoc({ type: 'Invoice', data: { ...currentJob, invoice: newInvoice } });
        } catch (err: any) {
            console.error("Failed to generate invoice:", err);
            showToast.error("Failed to generate invoice: " + err.message);
        } finally {
            setIsActionPending(false);
        }
    };

    const handleCreateLinkedJob = async () => {
        if (!currentJob) return;
        setIsActionPending(true);
        try {
            const newJobId = `job_${Date.now()}`;
            const newJob: any = {
                id: newJobId,
                organizationId: state.currentOrganization?.id || 'org-demo',
                customerId: currentJob.customerId || customer?.id || '',
                customerName: currentJob.customerName || customer?.name || 'Customer',
                address: currentJob.address || customer?.address || '',
                locationId: currentJob.locationId || currentJob.propertyId || null,
                locationName: currentJob.locationName || null,
                locationAddress: currentJob.locationAddress || currentJob.address || '',
                poNumber: currentJob.poNumber || '',
                workOrderNumber: currentJob.workOrderNumber || currentJob.poNumber || '',
                linkedWorkOrderNumbers: currentJob.linkedWorkOrderNumbers || (currentJob.poNumber ? [currentJob.poNumber] : []),
                linkedJobIds: [currentJob.id],
                tasks: ['Follow-up Service Visit'],
                jobStatus: 'Scheduled',
                appointmentTime: new Date(Date.now() + 86400000).toISOString(),
                createdAt: new Date().toISOString(),
                visitType: currentJob.visitType || 'Diagnostic & Repair'
            };

            if (!state.isDemoMode) {
                await db.collection('jobs').doc(newJob.id).set(cleanUndefinedFields(newJob));
            }
            dispatch({ type: 'ADD_JOB', payload: newJob });

            const updatedLinkedJobIds = Array.from(new Set([...(currentJob.linkedJobIds || []), newJob.id]));
            const jobUpdates: any = {
                linkedJobIds: updatedLinkedJobIds,
                updatedAt: new Date().toISOString()
            };

            if (!state.isDemoMode) {
                await db.collection('jobs').doc(currentJob.id).update(cleanUndefinedFields(jobUpdates));
            }
            dispatch({
                type: 'UPDATE_JOB',
                payload: { ...currentJob, ...jobUpdates }
            });

            showToast.success(`New follow-up Job #${newJob.id.slice(-6)} created and linked!`);
            setActiveTab('jobs');
        } catch (err: any) {
            console.error("Failed to create linked job:", err);
            showToast.error("Failed to create job: " + err.message);
        } finally {
            setIsActionPending(false);
        }
    };

    const handleSaveNewExpense = async () => {
        if (!newExpVendor || !newExpAmount || !currentJob) {
            showToast.warn("Please enter Vendor name and Amount.");
            return;
        }
        setIsActionPending(true);
        try {
            let receiptUrl = '';
            if (newExpReceiptFile) {
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
                organizationId: state.currentOrganization?.id || 'org-demo',
                vendor: newExpVendor,
                category: newExpCategory,
                amount: amountNum,
                subtotal: subNum,
                taxAmount: taxNum,
                description: newExpDescription,
                date: new Date().toISOString().split('T')[0],
                poNumber: currentJob.poNumber || '',
                workOrderNumber: currentJob.workOrderNumber || currentJob.poNumber || '',
                jobId: currentJob.id,
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

            const updatedExpenseIds = Array.from(new Set([...(currentJob.linkedExpenseIds || []), newExp.id]));
            const jobUpdates: any = {
                linkedExpenseIds: updatedExpenseIds,
                updatedAt: new Date().toISOString()
            };

            if (!state.isDemoMode) {
                await db.collection('jobs').doc(currentJob.id).update(cleanUndefinedFields(jobUpdates));
            }
            dispatch({
                type: 'UPDATE_JOB',
                payload: { ...currentJob, ...jobUpdates }
            });

            showToast.success(`Internal expense added and linked to Job #${formatDisplayId(currentJob.id)}!`);
            setShowAddExpenseModal(false);
            setNewExpVendor('');
            setNewExpAmount('');
            setNewExpTax('');
            setNewExpDescription('');
            setNewExpReceiptFile(null);
            setActiveTab('expenses');
        } catch (err: any) {
            console.error("Failed to add expense:", err);
            showToast.error("Failed to add expense: " + err.message);
        } finally {
            setIsActionPending(false);
        }
    };

    const copyPoToClipboard = (text: string) => {
        if (!text) return;
        navigator.clipboard.writeText(text);
        setCopiedPo(true);
        showToast.success(`Copied #${text} to clipboard!`);
        setTimeout(() => setCopiedPo(false), 2000);
    };

    if (!isOpen) return null;

    return (
        <Modal 
            isOpen={isOpen} 
            onClose={onClose} 
            title={`Manage Job Associations`}
            size="xl"
        >
            <div className="flex flex-col gap-6 select-none">
                {/* Source Job Header Card */}
                <div className="bg-gradient-to-r from-slate-800 to-slate-900 p-5 rounded-2xl text-white shadow-md relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-primary-600/10 rounded-full blur-2xl transform translate-x-10 -translate-y-10"></div>
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative z-10">
                        <div className="space-y-1">
                            <p className="text-[10px] font-black uppercase tracking-widest text-primary-400">Current active job</p>
                            <h2 className="text-xl font-black font-mono tracking-tight flex items-center gap-2">
                                <Wrench size={18} className="text-primary-400" />
                                Job #{formatDisplayId(currentJob.id)}
                            </h2>
                            <p className="text-xs text-slate-350">{currentJob.tasks?.join(', ') || 'General Service'}</p>
                            {currentJob.poNumber && (
                                <div className="flex items-center gap-2 pt-1">
                                    <span className="text-[10px] uppercase font-bold text-slate-400">Primary PO/WO:</span>
                                    <button
                                        type="button"
                                        onClick={() => copyPoToClipboard(currentJob.poNumber!)}
                                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-white/10 hover:bg-white/20 text-xs font-mono font-bold text-primary-300 transition-colors"
                                        title="Click to copy PO number"
                                    >
                                        #{currentJob.poNumber}
                                        {copiedPo ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                                    </button>
                                </div>
                            )}
                        </div>
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                            <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-xs">
                                <span className="text-slate-400 font-medium block">Customer</span>
                                <span className="font-bold text-white text-sm">{currentJob.customerName || 'Customer Profile'}</span>
                            </div>
                            <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-xs">
                                <span className="text-slate-400 font-medium block">Status</span>
                                <span className="font-bold text-emerald-400 text-sm">{currentJob.jobStatus || 'Scheduled'}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Quick Link & Creation Action Bar */}
                <div className="bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl space-y-3">
                    <div className="flex items-center justify-between">
                        <h4 className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-widest flex items-center gap-1.5">
                            <Link2 size={13} className="text-primary-600" /> Quick Creation & Association Actions
                        </h4>
                        <span className="text-[10px] text-slate-400 font-bold font-mono">Job #{formatDisplayId(currentJob.id)}</span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5">
                        <button
                            type="button"
                            onClick={handleCreateLinkedJob}
                            disabled={isActionPending}
                            className="p-3 bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-700/60 rounded-xl hover:border-blue-500 hover:shadow-sm transition-all flex flex-col items-center justify-center gap-1 text-center cursor-pointer group"
                        >
                            <Wrench size={18} className="text-blue-600 group-hover:scale-110 transition-transform" />
                            <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200">+ New Job / Visit</span>
                        </button>
                        <button
                            type="button"
                            onClick={handleCreateNewProposalForJob}
                            disabled={isActionPending}
                            className="p-3 bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-700/60 rounded-xl hover:border-indigo-500 hover:shadow-sm transition-all flex flex-col items-center justify-center gap-1 text-center cursor-pointer group"
                        >
                            <FileText size={18} className="text-indigo-600 group-hover:scale-110 transition-transform" />
                            <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200">+ New Proposal</span>
                        </button>
                        <button
                            type="button"
                            onClick={handleCreateNewInvoiceForJob}
                            disabled={isActionPending}
                            className="p-3 bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-700/60 rounded-xl hover:border-emerald-500 hover:shadow-sm transition-all flex flex-col items-center justify-center gap-1 text-center cursor-pointer group"
                        >
                            <DollarSign size={18} className="text-emerald-600 group-hover:scale-110 transition-transform" />
                            <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200">+ New Invoice</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setActiveTab('workorders');
                                setTimeout(() => document.getElementById('external-wo-upload-input')?.click(), 50);
                            }}
                            disabled={isUploadingWoFile}
                            className="p-3 bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-700/60 rounded-xl hover:border-amber-500 hover:shadow-sm transition-all flex flex-col items-center justify-center gap-1 text-center cursor-pointer group"
                        >
                            <Upload size={18} className="text-amber-600 group-hover:scale-110 transition-transform" />
                            <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200">+ Upload WO PDF</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setActiveTab('expenses');
                                setShowAddExpenseModal(true);
                            }}
                            disabled={isActionPending}
                            className="p-3 bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-700/60 rounded-xl hover:border-rose-500 hover:shadow-sm transition-all flex flex-col items-center justify-center gap-1 text-center cursor-pointer group"
                        >
                            <Paperclip size={18} className="text-rose-600 group-hover:scale-110 transition-transform" />
                            <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200">+ Add Expense</span>
                        </button>
                    </div>
                </div>

                {/* Tab List Navigation */}
                <div className="flex border-b border-slate-200 dark:border-slate-700 overflow-x-auto pb-px">
                    {[
                        { id: 'jobs', label: `Linked Jobs (${linkedJobs.length})`, icon: Wrench },
                        { id: 'workorders', label: `Work Orders / POs (${linkedWorkOrders.length})`, icon: ClipboardList },
                        { id: 'invoices', label: `Invoices (${linkedInvoices.length})`, icon: DollarSign },
                        { id: 'proposals', label: `Proposals (${linkedProposals.length})`, icon: FileText },
                        { id: 'expenses', label: `Expenses (${linkedExpenses.length})`, icon: Paperclip },
                        { id: 'files', label: `Photos & Files (${allJobFilesAndPhotos.length})`, icon: Image }
                    ].map(tab => {
                        const Icon = tab.icon;
                        const isActive = activeTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as any)}
                                className={`flex items-center gap-2 px-5 py-3 font-bold text-xs uppercase tracking-wider border-b-2 whitespace-nowrap transition-all outline-none ${
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
                <div className="min-h-[300px]">
                    {/* Jobs Tab */}
                    {activeTab === 'jobs' && (
                        <div className="space-y-6 animate-fade-in">
                            {/* Link & Create Form */}
                            <div className="bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 p-4 rounded-xl space-y-3">
                                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                                    <h4 className="text-xs font-black uppercase text-slate-700 dark:text-slate-300 tracking-wider flex items-center gap-1.5">
                                        <Wrench size={14} className="text-blue-600" /> Service Jobs Linked to #{formatDisplayId(currentJob.id)}
                                    </h4>
                                    <Button
                                        onClick={handleCreateLinkedJob}
                                        disabled={isActionPending}
                                        className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold uppercase rounded-lg shadow-sm flex items-center gap-1 transition-all border-0 cursor-pointer"
                                    >
                                        <Plus size={14} /> Schedule Follow-up Job
                                    </Button>
                                </div>

                                <div className="flex flex-col md:flex-row items-center gap-3 pt-2 border-t border-slate-200 dark:border-slate-750">
                                    <div className="flex-1 w-full">
                                        <label htmlFor="link-job-select" className="block text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1">
                                            Select existing customer job to link
                                        </label>
                                        <select
                                            id="link-job-select"
                                            className="w-full text-sm border border-slate-300 dark:border-slate-700 rounded-lg p-2 dark:bg-slate-850 dark:text-white"
                                            value={selectedJobToLink}
                                            onChange={e => setSelectedJobToLink(e.target.value)}
                                            disabled={isActionPending}
                                        >
                                            <option value="">-- Choose another job belonging to this customer --</option>
                                            {availableJobs.map(j => {
                                                const date = j.appointmentTime ? new Date(j.appointmentTime).toLocaleDateString() : 'No date';
                                                return (
                                                    <option key={j.id} value={j.id}>
                                                        #{j.id.slice(0, 8)} - {date} ({j.jobStatus}) - {j.tasks?.slice(0, 2).join(', ') || 'No tasks'}
                                                    </option>
                                                );
                                            })}
                                        </select>
                                    </div>
                                    <Button 
                                        onClick={handleLinkJob} 
                                        disabled={!selectedJobToLink || isActionPending}
                                        className="w-full md:w-auto h-10 px-5 flex items-center justify-center gap-2 bg-[#123A63] hover:bg-[#0f2d50] text-white font-bold rounded-lg border-0 shrink-0 mt-4 md:mt-0"
                                    >
                                        <Link2 size={16} /> Link Job
                                    </Button>
                                </div>
                            </div>

                            {/* Linked List */}
                            <div className="space-y-3">
                                <h3 className="text-xs font-black uppercase text-slate-400 tracking-wider flex items-center gap-1.5">
                                    <Link2 size={14} className="text-primary-600" /> Current Linked Jobs
                                </h3>

                                {linkedJobs.length === 0 ? (
                                    <div className="p-8 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl text-center space-y-3">
                                        <p className="text-xs text-slate-400 italic">No other jobs are currently linked to this job.</p>
                                        <Button
                                            onClick={handleCreateLinkedJob}
                                            disabled={isActionPending}
                                            variant="secondary"
                                            size="sm"
                                            className="inline-flex items-center gap-1.5 text-xs font-bold"
                                        >
                                            <Plus size={14} /> Schedule Linked Job
                                        </Button>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {linkedJobs.map(lj => {
                                            const jobDate = lj.appointmentTime ? new Date(lj.appointmentTime).toLocaleDateString() : '';
                                            return (
                                                <div key={lj.id} className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl flex items-center justify-between gap-4 shadow-sm hover:shadow-md transition-shadow">
                                                    <div className="space-y-1">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-xs font-black font-mono">Job #{formatDisplayId(lj.id)}</span>
                                                            <span className={`px-2 py-0.5 text-[8px] font-black uppercase tracking-wider rounded-full ${
                                                                lj.jobStatus === 'Completed' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400' :
                                                                lj.jobStatus === 'In Progress' ? 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-400' :
                                                                'bg-slate-50 text-slate-700 dark:bg-slate-800 dark:text-slate-400'
                                                            }`}>
                                                                {lj.jobStatus}
                                                            </span>
                                                        </div>
                                                        <div className="text-[10px] text-slate-500 flex items-center gap-2">
                                                            {jobDate && <span className="flex items-center gap-1"><Calendar size={10} />{jobDate}</span>}
                                                            <span>{lj.tasks?.slice(0, 2).join(', ') || 'General Service'}</span>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-1.5 shrink-0">
                                                        <button
                                                            type="button"
                                                            onClick={() => setSelectedJobForModal(lj)}
                                                            className="p-2 text-primary-600 hover:text-primary-700 hover:bg-primary-50 dark:hover:bg-primary-950/30 rounded-lg transition-colors border-0 bg-transparent outline-none flex items-center gap-1 text-xs font-bold"
                                                            title="View Job Details"
                                                        >
                                                            <Eye size={15} /> View
                                                        </button>
                                                        <button
                                                            onClick={() => handleUnlinkJob(lj.id)}
                                                            disabled={isActionPending}
                                                            className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg transition-colors border-0 bg-transparent outline-none"
                                                            title="Unlink Job"
                                                        >
                                                            <Unlink size={16} />
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Invoices Tab */}
                    {activeTab === 'invoices' && (
                        <div className="space-y-6 animate-fade-in">
                            {/* Link / Generate Action Bar */}
                            <div className="bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 p-4 rounded-xl space-y-3">
                                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                                    <h4 className="text-xs font-black uppercase text-slate-700 dark:text-slate-300 tracking-wider flex items-center gap-1.5">
                                        <DollarSign size={14} className="text-emerald-600" /> Customer Invoices Linked to Job #{formatDisplayId(currentJob.id)}
                                    </h4>
                                    <Button
                                        onClick={handleCreateNewInvoiceForJob}
                                        disabled={isActionPending}
                                        className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold uppercase rounded-lg shadow-sm flex items-center gap-1 transition-all border-0 cursor-pointer"
                                    >
                                        <Plus size={14} /> Generate Customer Invoice
                                    </Button>
                                </div>

                                <div className="flex flex-col md:flex-row items-center gap-3 pt-2 border-t border-slate-200 dark:border-slate-750">
                                    <div className="flex-1 w-full">
                                        <label htmlFor="link-invoice-select" className="block text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1">
                                            Select existing invoice from customer history to link
                                        </label>
                                        <select
                                            id="link-invoice-select"
                                            className="w-full text-sm border border-slate-300 dark:border-slate-700 rounded-lg p-2 dark:bg-slate-850 dark:text-white"
                                            value={selectedInvoiceToLink}
                                            onChange={e => setSelectedInvoiceToLink(e.target.value)}
                                            disabled={isActionPending}
                                        >
                                            <option value="">-- Choose an invoice from this customer's other jobs --</option>
                                            {availableInvoices.map(item => (
                                                <option key={item.invoice.id} value={item.invoice.id}>
                                                    Invoice #{item.invoice.id.slice(0, 8)} - ${item.invoice.amount?.toFixed(2)} (Job #{item.job.id.slice(0, 8)} - {item.invoice.status})
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <Button 
                                        onClick={handleLinkInvoice} 
                                        disabled={!selectedInvoiceToLink || isActionPending}
                                        className="w-full md:w-auto h-10 px-5 flex items-center justify-center gap-2 bg-[#123A63] hover:bg-[#0f2d50] text-white font-bold rounded-lg border-0 shrink-0 mt-4 md:mt-0"
                                    >
                                        <Link2 size={16} /> Link Invoice
                                    </Button>
                                </div>
                            </div>

                            {/* Linked List */}
                            <div className="space-y-3">
                                <h3 className="text-xs font-black uppercase text-slate-400 tracking-wider flex items-center gap-1.5">
                                    <Link2 size={14} className="text-primary-600" /> Current Linked Invoices
                                </h3>

                                {linkedInvoices.length === 0 ? (
                                    <div className="p-8 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl text-center space-y-3">
                                        <p className="text-xs text-slate-400 italic">No invoices are currently linked to this job.</p>
                                        <Button
                                            onClick={handleCreateNewInvoiceForJob}
                                            disabled={isActionPending}
                                            variant="secondary"
                                            size="sm"
                                            className="inline-flex items-center gap-1.5 text-xs font-bold"
                                        >
                                            <Plus size={14} /> Generate Job Invoice
                                        </Button>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {linkedInvoices.map(item => (
                                            <div key={item.invoice.id} className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl flex items-center justify-between gap-4 shadow-sm hover:shadow-md transition-shadow">
                                                <div className="space-y-1 cursor-pointer flex-1" onClick={() => setPreviewDoc({ type: 'Invoice', data: item.job })}>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs font-black font-mono hover:text-emerald-600 transition-colors">Invoice #{item.invoice.id.slice(0, 8)}</span>
                                                        {item.isPrimary && (
                                                            <span className="px-2 py-0.5 text-[8px] font-black uppercase tracking-wider rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                                                                Primary Job Invoice
                                                            </span>
                                                        )}
                                                        <span className={`px-2 py-0.5 text-[8px] font-black uppercase tracking-wider rounded-full ${
                                                            item.invoice.status === 'Paid' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400' :
                                                            'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400'
                                                        }`}>
                                                            {item.invoice.status || 'Unpaid'}
                                                        </span>
                                                    </div>
                                                    <div className="text-[10px] text-slate-500 flex flex-col gap-0.5">
                                                        <span className="font-bold text-slate-700 dark:text-slate-350">${(item.invoice.totalAmount || item.invoice.amount || 0).toFixed(2)}</span>
                                                        <span>Associated with Job #{item.job.id.slice(0, 8)}</span>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-1.5 shrink-0">
                                                    <button
                                                        type="button"
                                                        onClick={() => setPreviewDoc({ type: 'Invoice', data: item.job })}
                                                        className="p-2 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 rounded-lg transition-colors border-0 bg-transparent outline-none flex items-center gap-1 text-xs font-bold"
                                                        title="View Invoice"
                                                    >
                                                        <Eye size={15} /> View
                                                    </button>
                                                    {!item.isPrimary && (
                                                        <button
                                                            onClick={() => handleUnlinkInvoice(item.invoice.id)}
                                                            disabled={isActionPending}
                                                            className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg transition-colors border-0 bg-transparent outline-none"
                                                            title="Unlink Invoice"
                                                        >
                                                            <Unlink size={16} />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Proposals Tab */}
                    {activeTab === 'proposals' && (
                        <div className="space-y-6 animate-fade-in">
                            {/* Link / Create Action Bar */}
                            <div className="bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 p-4 rounded-xl space-y-3">
                                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                                    <h4 className="text-xs font-black uppercase text-slate-700 dark:text-slate-300 tracking-wider flex items-center gap-1.5">
                                        <FileText size={14} className="text-indigo-600" /> Proposals Linked to Job #{formatDisplayId(currentJob.id)}
                                    </h4>
                                    <Button
                                        onClick={handleCreateNewProposalForJob}
                                        disabled={isActionPending}
                                        className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold uppercase rounded-lg shadow-sm flex items-center gap-1 transition-all border-0 cursor-pointer"
                                    >
                                        <Plus size={14} /> Create New Proposal
                                    </Button>
                                </div>

                                <div className="flex flex-col md:flex-row items-center gap-3 pt-2 border-t border-slate-200 dark:border-slate-750">
                                    <div className="flex-1 w-full">
                                        <SearchableSelect
                                            id="link-proposal-select"
                                            label="Select existing proposal to link"
                                            options={proposalOptions}
                                            value={selectedProposalToLink}
                                            onChange={val => setSelectedProposalToLink(val)}
                                            placeholder="-- Search or choose a proposal belonging to this customer --"
                                        />
                                    </div>
                                    <Button 
                                        onClick={handleLinkProposal} 
                                        disabled={!selectedProposalToLink || isActionPending}
                                        className="w-full md:w-auto h-10 px-5 flex items-center justify-center gap-2 bg-[#123A63] hover:bg-[#0f2d50] text-white font-bold rounded-lg border-0 shrink-0 mt-4 md:mt-0"
                                    >
                                        <Link2 size={16} /> Link Proposal
                                    </Button>
                                </div>
                            </div>

                            {/* Linked List */}
                            <div className="space-y-3">
                                <h3 className="text-xs font-black uppercase text-slate-400 tracking-wider flex items-center gap-1.5">
                                    <Link2 size={14} className="text-primary-600" /> Current Linked Proposals
                                </h3>

                                {linkedProposals.length === 0 ? (
                                    <div className="p-8 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl text-center space-y-3">
                                        <p className="text-xs text-slate-400 italic">No proposals are currently linked to this job.</p>
                                        <Button
                                            onClick={handleCreateNewProposalForJob}
                                            disabled={isActionPending}
                                            variant="secondary"
                                            size="sm"
                                            className="inline-flex items-center gap-1.5 text-xs font-bold"
                                        >
                                            <Plus size={14} /> Create First Proposal
                                        </Button>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {linkedProposals.map(lp => (
                                            <div key={lp.id} className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl flex items-center justify-between gap-4 shadow-sm hover:shadow-md transition-shadow">
                                                <div className="space-y-1 cursor-pointer flex-1" onClick={() => setPreviewDoc({ type: 'Proposal', data: lp })}>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs font-black font-mono hover:text-indigo-600 transition-colors">Proposal #{formatDisplayId(lp.id)}</span>
                                                        <span className={`px-2 py-0.5 text-[8px] font-black uppercase tracking-wider rounded-full ${
                                                            lp.status?.toLowerCase() === 'approved' || lp.status?.toLowerCase() === 'accepted' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400' :
                                                            lp.status?.toLowerCase() === 'pending' ? 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400' :
                                                            'bg-slate-50 text-slate-700 dark:bg-slate-800 dark:text-slate-400'
                                                        }`}>
                                                            {lp.status}
                                                        </span>
                                                    </div>
                                                    <div className="text-[10px] text-slate-500 flex flex-col gap-0.5">
                                                        <span className="font-bold text-slate-700 dark:text-slate-350">{lp.title || 'Untitled Proposal'}</span>
                                                        <span>Total Value: ${lp.total?.toFixed(2)} {lp.createdAt ? `• Created ${new Date(lp.createdAt).toLocaleDateString()}` : ''}</span>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-1.5 shrink-0">
                                                    <button
                                                        type="button"
                                                        onClick={() => setPreviewDoc({ type: 'Proposal', data: lp })}
                                                        className="p-2 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 rounded-lg transition-colors border-0 bg-transparent outline-none flex items-center gap-1 text-xs font-bold"
                                                        title="View Proposal"
                                                    >
                                                        <Eye size={15} /> View
                                                    </button>
                                                    <button
                                                        onClick={() => handleUnlinkProposal(lp.id)}
                                                        disabled={isActionPending}
                                                        className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg transition-colors border-0 bg-transparent outline-none"
                                                        title="Unlink Proposal"
                                                    >
                                                        <Unlink size={16} />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Work Orders Tab */}
                    {activeTab === 'workorders' && (
                        <div className="space-y-6 animate-fade-in">
                            {/* Hidden File Input for External Work Orders */}
                            <input
                                id="external-wo-upload-input"
                                type="file"
                                accept="application/pdf,image/*"
                                className="hidden"
                                onChange={handleFileUploadWorkOrder}
                            />

                            {/* SECTION 1: CUSTOMER WORK ORDERS & INCOMING POs */}
                            <div className="bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl space-y-4">
                                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
                                    <div>
                                        <h3 className="text-xs font-black uppercase text-slate-800 dark:text-slate-200 tracking-wider flex items-center gap-1.5">
                                            <FileText size={15} className="text-blue-600 dark:text-blue-400" />
                                            1. Customer Incoming POs & External Work Orders
                                        </h3>
                                        <p className="text-[11px] text-slate-500 mt-0.5">
                                            Client purchase orders and original PDF work orders received from {currentJob.customerName || 'the customer'}.
                                        </p>
                                    </div>

                                    <div className="flex items-center gap-2 w-full md:w-auto shrink-0">
                                        <Button 
                                            onClick={() => document.getElementById('external-wo-upload-input')?.click()} 
                                            disabled={isUploadingWoFile}
                                            className="flex-1 md:flex-none h-9 px-3.5 flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg border-0 shadow-sm"
                                        >
                                            <Upload size={14} /> {isUploadingWoFile ? 'Uploading...' : 'Upload Customer PDF'}
                                        </Button>
                                    </div>
                                </div>

                                {/* Link Customer PO Action Bar */}
                                <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-slate-200/70 dark:border-slate-800">
                                    <input
                                        id="link-wo-input"
                                        type="text"
                                        placeholder="Enter Customer PO # (e.g. PO-98234, 563360)..."
                                        className="flex-1 text-xs border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 dark:bg-slate-850 dark:text-white"
                                        value={inputWoNumber}
                                        onChange={e => setInputWoNumber(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && handleLinkWorkOrder()}
                                        disabled={isActionPending}
                                    />
                                    {availableWorkOrders.length > 0 && (
                                        <select
                                            aria-label="Select existing customer Work Order"
                                            className="text-xs border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 dark:bg-slate-850 dark:text-white max-w-[200px]"
                                            onChange={e => {
                                                if (e.target.value) handleLinkWorkOrder(e.target.value);
                                            }}
                                            defaultValue=""
                                            disabled={isActionPending}
                                        >
                                            <option value="" disabled>-- Customer PO History --</option>
                                            {availableWorkOrders.map(wo => (
                                                <option key={wo} value={wo}>#{wo}</option>
                                            ))}
                                        </select>
                                    )}
                                    <Button 
                                        onClick={() => handleLinkWorkOrder()} 
                                        disabled={!inputWoNumber.trim() || isActionPending}
                                        className="h-9 px-4 flex items-center justify-center gap-1.5 bg-[#123A63] hover:bg-[#0f2d50] text-white text-xs font-bold rounded-lg border-0 shrink-0"
                                    >
                                        <Plus size={14} /> Link PO #
                                    </Button>
                                </div>

                                {/* Uploaded Customer Work Order Files (PDFs/Images) */}
                                {externalWorkOrderFiles.length > 0 && (
                                    <div className="space-y-2 pt-2">
                                        <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block">
                                            Uploaded Customer Order Documents
                                        </span>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            {externalWorkOrderFiles.map((file: any) => (
                                                <div key={file.id} className="p-3.5 bg-white dark:bg-slate-850 border border-emerald-200 dark:border-emerald-900/60 rounded-xl flex items-center justify-between gap-3 shadow-sm">
                                                    <div className="space-y-0.5 overflow-hidden">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-xs font-black text-slate-900 dark:text-white truncate">{file.fileName}</span>
                                                            <span className="px-2 py-0.5 text-[8px] font-black uppercase tracking-wider rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300 shrink-0">
                                                                Customer PDF
                                                            </span>
                                                        </div>
                                                        <p className="text-[10px] text-slate-500">
                                                            {file.uploadedBy ? `Uploaded by ${file.uploadedBy}` : 'Customer File'} &bull; {new Date(file.createdAt || Date.now()).toLocaleDateString()}
                                                        </p>
                                                    </div>

                                                    <div className="flex items-center gap-1.5 shrink-0">
                                                        <button
                                                            type="button"
                                                            onClick={() => setViewingDocument({ url: file.fileUrl || file.url || file.dataUrl, fileName: file.fileName || file.label || 'Customer Work Order' })}
                                                            className="p-1.5 text-emerald-700 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 rounded-lg transition-colors flex items-center gap-1 text-xs font-bold border-0 bg-transparent cursor-pointer"
                                                            title="View Customer Document"
                                                        >
                                                            <Eye size={14} /> View
                                                        </button>
                                                        <a
                                                            href={file.fileUrl || file.url || file.dataUrl || '#'}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="p-1.5 text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors flex items-center gap-1 text-xs font-bold"
                                                            title="Open PDF in New Tab"
                                                        >
                                                            <ExternalLink size={14} />
                                                        </a>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleDeleteUploadedWorkOrder(file)}
                                                            disabled={isActionPending}
                                                            className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg transition-colors border-0 bg-transparent outline-none flex items-center gap-1 text-xs font-bold cursor-pointer"
                                                            title="Unlink Customer Document"
                                                        >
                                                            <Trash2 size={15} />
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Linked Customer PO Numbers */}
                                <div className="space-y-2 pt-2">
                                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block">
                                        Customer PO & Reference Numbers ({linkedWorkOrders.length})
                                    </span>

                                    {linkedWorkOrders.length === 0 ? (
                                        <div className="p-4 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl text-center bg-white/50 dark:bg-slate-850/50">
                                            <p className="text-xs text-slate-400 italic">No Customer PO numbers currently linked to this job.</p>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            {linkedWorkOrders.map(wo => {
                                                const isPrimary = currentJob.poNumber?.trim().toLowerCase() === wo.trim().toLowerCase();
                                                return (
                                                    <div key={wo} className="p-3.5 bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-800 rounded-xl flex items-center justify-between gap-3 shadow-sm hover:border-blue-400 transition-all">
                                                        <div className="space-y-0.5 cursor-pointer flex-1" onClick={() => openCustomerPoViewer(wo)}>
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-sm font-black font-mono text-slate-900 dark:text-white hover:text-blue-600 transition-colors">#{wo}</span>
                                                                {isPrimary ? (
                                                                    <span className="px-2 py-0.5 text-[8px] font-black uppercase tracking-wider rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                                                                        Primary Customer PO
                                                                    </span>
                                                                ) : (
                                                                    <span className="px-2 py-0.5 text-[8px] font-black uppercase tracking-wider rounded-full bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300">
                                                                        Customer PO
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <p className="text-[10px] text-slate-500">Customer: {currentJob.customerName}</p>
                                                        </div>

                                                        <div className="flex items-center gap-1.5 shrink-0">
                                                            <button
                                                                type="button"
                                                                onClick={() => openCustomerPoViewer(wo)}
                                                                className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30 rounded-lg transition-colors border-0 bg-transparent outline-none flex items-center gap-1 text-xs font-bold cursor-pointer"
                                                                title="View Customer Order Details / History"
                                                            >
                                                                <Eye size={14} /> View Details
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => setViewingWoNumber(wo)}
                                                                className="p-1.5 text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors border-0 bg-transparent outline-none flex items-center gap-1 text-xs font-bold cursor-pointer"
                                                                title="View PO Associations"
                                                            >
                                                                <ExternalLink size={14} />
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleUnlinkWorkOrder(wo)}
                                                                disabled={isActionPending}
                                                                className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg transition-colors border-0 bg-transparent outline-none flex items-center gap-1 text-xs font-bold cursor-pointer"
                                                                title="Unlink PO Number"
                                                            >
                                                                <Unlink size={15} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* SECTION 2: INTERNAL SUBCONTRACTOR WORK ORDER (1099 OUTBOUND DISPATCH) */}
                            <div className="bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl space-y-4">
                                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
                                    <div>
                                        <h3 className="text-xs font-black uppercase text-slate-800 dark:text-slate-200 tracking-wider flex items-center gap-1.5">
                                            <Wrench size={15} className="text-purple-600 dark:text-purple-400" />
                                            2. Internal Subcontractor Work Order (1099 Partner Dispatch)
                                        </h3>
                                        <p className="text-[11px] text-slate-500 mt-0.5">
                                            Sanitized dispatch orders created strictly when outsourcing to a subcontractor, protecting your customer rates.
                                        </p>
                                    </div>
                                </div>

                                {hasSubcontractor && subWoData ? (
                                    <div className="p-4 bg-purple-50/50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-900/50 rounded-xl space-y-3 shadow-sm">
                                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                                            <div className="space-y-1">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-sm font-black text-slate-900 dark:text-white">
                                                        {subWoData.subName}
                                                    </span>
                                                    <span className="px-2 py-0.5 text-[8px] font-black uppercase tracking-wider rounded-full bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300">
                                                        Sub WO #{subWoData.woNumber}
                                                    </span>
                                                    <span className="px-2 py-0.5 text-[8px] font-black uppercase tracking-wider rounded-full bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                                                        Status: {subWoData.status}
                                                    </span>
                                                </div>
                                                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-600 dark:text-slate-400">
                                                    {subWoData.subPhone && <span>Phone: <strong className="text-slate-800 dark:text-slate-200">{subWoData.subPhone}</strong></span>}
                                                    {subWoData.subEmail && <span>Email: <strong className="text-slate-800 dark:text-slate-200">{subWoData.subEmail}</strong></span>}
                                                    <span>Sub NTE / Payout: <strong className="text-emerald-600 dark:text-emerald-400">${Number(subWoData.nte || 0).toFixed(2)}</strong></span>
                                                    {subWoData.ivrPin && <span>IVR PIN: <strong className="text-slate-800 dark:text-slate-200">{subWoData.ivrPin}</strong></span>}
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-2 shrink-0">
                                                <Button
                                                    onClick={openSubcontractorWoViewer}
                                                    className="h-9 px-3.5 flex items-center justify-center gap-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-lg border-0 shadow-sm cursor-pointer"
                                                >
                                                    <Eye size={14} /> View Sub WO
                                                </Button>
                                                <Button
                                                    onClick={() => {
                                                        setSelectedWoJob(currentJob);
                                                        setIsSubcontractorWoOpen(true);
                                                    }}
                                                    className="h-9 px-3 flex items-center justify-center gap-1 bg-white hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-lg border border-slate-300 dark:border-slate-700 cursor-pointer"
                                                >
                                                    <Pencil size={13} /> Edit
                                                </Button>
                                                <Button
                                                    onClick={() => {
                                                        setSelectedWoJob(currentJob);
                                                        setIsSendSubcontractorWoOpen(true);
                                                    }}
                                                    className="h-9 px-3 flex items-center justify-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg border-0 cursor-pointer"
                                                >
                                                    <Send size={13} /> Dispatch
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="p-6 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white/50 dark:bg-slate-850/50">
                                        <div className="space-y-1">
                                            <p className="text-xs font-bold text-slate-700 dark:text-slate-300">No Subcontractor Assigned to this Job</p>
                                            <p className="text-[11px] text-slate-500 max-w-xl">
                                                Internal Subcontractor Work Orders are only generated when work is assigned to a 1099 partner. This keeps your customer orders and billing rates private.
                                            </p>
                                        </div>
                                        <Button
                                            onClick={() => {
                                                setSelectedWoJob(currentJob);
                                                setIsSubcontractorWoOpen(true);
                                            }}
                                            className="h-9 px-4 flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-lg border-0 shadow-sm shrink-0 cursor-pointer"
                                        >
                                            <UserPlus size={14} /> Assign Subcontractor & Create WO
                                        </Button>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Expenses Tab */}
                    {activeTab === 'expenses' && (
                        <div className="space-y-6 animate-fade-in">
                            {/* Confidentiality Notice */}
                            <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 p-3.5 rounded-xl flex items-start gap-3 text-xs text-amber-900 dark:text-amber-200">
                                <ShieldCheck size={18} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                                <div className="space-y-0.5 flex-1">
                                    <p className="font-extrabold uppercase tracking-wide">Internal Confidential Expense Records</p>
                                    <p className="leading-relaxed">
                                        These expense receipts and purchase records are strictly confidential internal records for job cost tracking. They are <strong>never</strong> displayed, shared, or accessible to customers on invoices, proposals, or customer portals.
                                    </p>
                                </div>
                                <Button
                                    onClick={() => setShowAddExpenseModal(true)}
                                    className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold uppercase rounded-lg shadow-sm flex items-center gap-1 transition-all border-0 shrink-0 cursor-pointer"
                                >
                                    <Plus size={14} /> Add New Expense
                                </Button>
                            </div>

                            {/* Link Form */}
                            <div className="bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 p-4 rounded-xl flex flex-col md:flex-row items-center gap-3">
                                <div className="flex-1 w-full">
                                    <label htmlFor="link-expense-select" className="block text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1">
                                        Select existing expense receipt to link
                                    </label>
                                    <select
                                        id="link-expense-select"
                                        className="w-full text-sm border border-slate-300 dark:border-slate-700 rounded-lg p-2 dark:bg-slate-850 dark:text-white"
                                        value={selectedExpenseToLink}
                                        onChange={e => setSelectedExpenseToLink(e.target.value)}
                                        disabled={isActionPending}
                                    >
                                        <option value="">-- Choose an expense record / supply receipt --</option>
                                        {availableExpenses.map(exp => {
                                            const expTotal = Number(exp.amount) || 0;
                                            const expSubtotal = Number(exp.subtotal) || expTotal;
                                            const expTax = Number(exp.taxAmount) || 0;
                                            return (
                                                <option key={exp.id} value={exp.id}>
                                                    {exp.date} - {exp.vendor} (${expTotal.toFixed(2)} | Sub: ${expSubtotal.toFixed(2)}, Tax: ${expTax.toFixed(2)}) - {exp.description || exp.category}
                                                </option>
                                            );
                                        })}
                                    </select>
                                </div>
                                <Button 
                                    onClick={handleLinkExpense} 
                                    disabled={!selectedExpenseToLink || isActionPending}
                                    className="w-full md:w-auto h-10 px-5 flex items-center justify-center gap-2 bg-[#123A63] hover:bg-[#0f2d50] text-white font-bold rounded-lg border-0 shrink-0 mt-4 md:mt-0"
                                >
                                    <Plus size={16} /> Link Expense
                                </Button>
                            </div>

                            {/* Linked List */}
                            <div className="space-y-3">
                                <h3 className="text-xs font-black uppercase text-slate-400 tracking-wider flex items-center gap-1.5">
                                    <Paperclip size={14} className="text-primary-600" /> Linked Job Expenses & Receipts
                                </h3>

                                {linkedExpenses.length === 0 ? (
                                    <div className="p-8 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl text-center space-y-3">
                                        <p className="text-xs text-slate-400 italic">No expense receipts are currently linked to this job.</p>
                                        <Button
                                            onClick={() => setShowAddExpenseModal(true)}
                                            variant="secondary"
                                            size="sm"
                                            className="inline-flex items-center gap-1.5 text-xs font-bold"
                                        >
                                            <Plus size={14} /> Add First Expense
                                        </Button>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {linkedExpenses.map(exp => {
                                            const expTotal = Number(exp.amount) || 0;
                                            const expTax = Number(exp.taxAmount) || 0;
                                            const expSubtotal = Number(exp.subtotal) || (expTotal ? Math.max(0, expTotal - expTax) : 0);
                                            const expObj: any = exp;
                                            const possibleReceipt = expObj.receiptData || expObj.receiptUrl || expObj.receipt || expObj.imageUrl || expObj.photoUrl;
                                            const receiptUrls = expObj.receiptUrls && expObj.receiptUrls.length > 0 ? expObj.receiptUrls : (possibleReceipt ? [possibleReceipt] : []);

                                            return (
                                                <div key={exp.id} className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl flex items-center justify-between gap-4 shadow-sm hover:shadow-md transition-shadow">
                                                    <div className="space-y-1 flex-1">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-xs font-black font-mono text-slate-900 dark:text-white">{exp.vendor}</span>
                                                            <span className="px-2 py-0.5 text-[8px] font-black uppercase tracking-wider rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                                                                {exp.category}
                                                            </span>
                                                            <span className="px-2 py-0.5 text-[8px] font-black uppercase tracking-wider rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 flex items-center gap-0.5">
                                                                <ShieldCheck size={10} /> Internal
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

                                                    <div className="flex items-center gap-2 shrink-0">
                                                        {receiptUrls.length > 0 && (
                                                            <button
                                                                type="button"
                                                                onClick={() => setViewingReceiptUrls(receiptUrls)}
                                                                className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30 rounded-lg transition-colors border-0 bg-transparent outline-none flex items-center gap-1 text-xs font-bold"
                                                                title="View Receipt Image"
                                                            >
                                                                <Eye size={16} /> Receipt
                                                            </button>
                                                        )}
                                                        <button
                                                            onClick={() => handleUnlinkExpense(exp.id)}
                                                            disabled={isActionPending}
                                                            className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg transition-colors border-0 bg-transparent outline-none"
                                                            title="Unlink Expense"
                                                        >
                                                            <Unlink size={16} />
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Photos & Files Tab */}
                    {activeTab === 'files' && (
                        <div className="space-y-6 animate-fade-in">
                            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                                <div className="flex items-center gap-1 overflow-x-auto pb-1">
                                    {(['All', 'Before', 'After', 'Specifications', 'Uncategorized'] as const).map(cat => (
                                        <button
                                            key={cat}
                                            onClick={() => setPhotoFilterCategory(cat)}
                                            className={`px-3 py-1 text-[11px] font-bold rounded-lg transition-colors ${
                                                photoFilterCategory === cat 
                                                    ? 'bg-primary-600 text-white shadow-sm' 
                                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                                            }`}
                                        >
                                            {cat}
                                        </button>
                                    ))}
                                </div>
                                <label className="relative flex items-center gap-1.5 px-3 py-1.5 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-xs font-bold cursor-pointer transition-colors shrink-0">
                                    <Upload size={14} /> Upload Job File
                                    <input 
                                        type="file" 
                                        className="hidden" 
                                        accept="image/*,application/pdf" 
                                        onChange={handleFileUploadWorkOrder}
                                        disabled={isUploadingWoFile}
                                    />
                                </label>
                            </div>

                            <div className="space-y-3">
                                <h3 className="text-xs font-black uppercase text-slate-400 tracking-wider flex items-center gap-1.5">
                                    <Image size={14} className="text-primary-600" /> Job Photos & Documents ({filteredFilesAndPhotos.length})
                                </h3>

                                {(!filteredFilesAndPhotos || filteredFilesAndPhotos.length === 0) ? (
                                    <div className="p-8 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl text-center">
                                        <p className="text-xs text-slate-400 italic">No photos or document files matching category "{photoFilterCategory}".</p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                                        {filteredFilesAndPhotos.map((file: any, idx: number) => {
                                            const isImage = file.fileType?.startsWith('image/') || file.dataUrl?.startsWith('data:image/') || file.type === 'Photo' || (file.fileUrl && /\.(jpeg|jpg|gif|png|webp|heic|heif)($|\?)/i.test(file.fileUrl)) || (file.url && /\.(jpeg|jpg|gif|png|webp|heic|heif)($|\?)/i.test(file.url));
                                            const url = file.fileUrl || file.url || file.dataUrl || '';

                                            return (
                                                <div key={file.id || idx} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm flex flex-col justify-between hover:shadow transition-shadow">
                                                    {isImage ? (
                                                        <div 
                                                            onClick={() => setViewingDocument({ url, fileName: file.fileName || file.label || 'Job Photo' })}
                                                            className="w-full h-32 bg-slate-200 dark:bg-slate-800 relative cursor-pointer group"
                                                        >
                                                            <img 
                                                                src={url} 
                                                                alt={file.label || 'Job Photo'} 
                                                                className="w-full h-full object-cover group-hover:opacity-90 transition-opacity" 
                                                            />
                                                            <span className="absolute bottom-1 right-1 bg-black/60 text-white text-[8px] px-1 py-0.5 rounded font-black uppercase">
                                                                {file.category || file.metadata?.label || file.label || 'Photo'}
                                                            </span>
                                                        </div>
                                                    ) : (
                                                        <div 
                                                            onClick={() => setViewingDocument({ url, fileName: file.fileName || file.label || 'Document' })}
                                                            className="w-full h-32 flex flex-col items-center justify-center bg-slate-100 dark:bg-slate-800/50 text-slate-400 hover:text-primary-600 transition-colors cursor-pointer"
                                                        >
                                                            <FileText size={32} />
                                                            <span className="text-[9px] font-bold mt-2 uppercase tracking-wide px-2 text-center truncate w-full">
                                                                {file.fileName || file.label || 'Document'}
                                                            </span>
                                                        </div>
                                                    )}

                                                    <div className="p-2 border-t border-slate-200/50 dark:border-slate-800 flex items-center justify-between gap-2">
                                                        <div className="overflow-hidden">
                                                            <p className="text-[8px] font-black text-slate-400 uppercase truncate">
                                                                {file.fileName || file.label || 'Attachment'}
                                                            </p>
                                                            <p className="text-[7px] font-bold text-slate-400 mt-0.5">
                                                                {file.createdAt ? new Date(file.createdAt).toLocaleDateString() : ''}
                                                            </p>
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleDeleteFileFromJob(file);
                                                            }}
                                                            disabled={isActionPending}
                                                            className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded transition-colors border-0 bg-transparent shrink-0"
                                                            title="Delete & Unlink File"
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Add Expense Modal */}
            {showAddExpenseModal && (
                <Modal 
                    isOpen={showAddExpenseModal} 
                    onClose={() => setShowAddExpenseModal(false)}
                    title="Add Internal Job Expense / Supply Receipt"
                    size="md"
                >
                    <div className="space-y-4 p-2">
                        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 p-3 rounded-xl flex items-start gap-2.5 text-xs text-amber-900 dark:text-amber-200">
                            <ShieldCheck size={16} className="text-amber-600 shrink-0 mt-0.5" />
                            <span>This expense record is strictly confidential and internal for Job #{formatDisplayId(currentJob.id)}.</span>
                        </div>

                        <div>
                            <label className="block text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1">Vendor / Store Name *</label>
                            <input
                                type="text"
                                placeholder="e.g. Johnstone Supply, Home Depot, Ferguson"
                                value={newExpVendor}
                                onChange={e => setNewExpVendor(e.target.value)}
                                className="w-full text-sm border border-slate-300 dark:border-slate-700 rounded-lg p-2 dark:bg-slate-850 dark:text-white"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1">Total Amount ($) *</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    placeholder="0.00"
                                    value={newExpAmount}
                                    onChange={e => setNewExpAmount(e.target.value)}
                                    className="w-full text-sm border border-slate-300 dark:border-slate-700 rounded-lg p-2 dark:bg-slate-850 dark:text-white"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1">Tax Amount ($)</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    placeholder="0.00"
                                    value={newExpTax}
                                    onChange={e => setNewExpTax(e.target.value)}
                                    className="w-full text-sm border border-slate-300 dark:border-slate-700 rounded-lg p-2 dark:bg-slate-850 dark:text-white"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1">Expense Category</label>
                            <select
                                value={newExpCategory}
                                onChange={e => setNewExpCategory(e.target.value)}
                                className="w-full text-sm border border-slate-300 dark:border-slate-700 rounded-lg p-2 dark:bg-slate-850 dark:text-white"
                            >
                                <option value="Materials & Parts">Materials & Parts</option>
                                <option value="Equipment & Rentals">Equipment & Rentals</option>
                                <option value="Subcontractor / Labor">Subcontractor / Labor</option>
                                <option value="Fuel & Travel">Fuel & Travel</option>
                                <option value="Tools & Supplies">Tools & Supplies</option>
                                <option value="Permits & Fees">Permits & Fees</option>
                                <option value="Other">Other</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1">Description / Notes</label>
                            <textarea
                                rows={2}
                                placeholder="Details about the purchased parts or receipt..."
                                value={newExpDescription}
                                onChange={e => setNewExpDescription(e.target.value)}
                                className="w-full text-sm border border-slate-300 dark:border-slate-700 rounded-lg p-2 dark:bg-slate-850 dark:text-white"
                            />
                        </div>

                        <div>
                            <label className="block text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1">Upload Receipt (Image / PDF)</label>
                            <input
                                type="file"
                                accept="image/*,application/pdf"
                                onChange={e => setNewExpReceiptFile(e.target.files?.[0] || null)}
                                className="w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-primary-50 file:text-primary-700 dark:file:bg-slate-800 dark:file:text-slate-300"
                            />
                        </div>

                        <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                            <Button variant="secondary" onClick={() => setShowAddExpenseModal(false)} disabled={isActionPending}>
                                Cancel
                            </Button>
                            <Button onClick={handleSaveNewExpense} disabled={isActionPending || !newExpVendor || !newExpAmount} className="bg-rose-600 hover:bg-rose-700 text-white font-bold">
                                {isActionPending ? 'Saving...' : 'Save & Link Expense'}
                            </Button>
                        </div>
                    </div>
                </Modal>
            )}

            {/* Receipt Image Lightbox Modal */}
            {viewingReceiptUrls && viewingReceiptUrls.length > 0 && (
                <Modal isOpen={true} onClose={() => setViewingReceiptUrls(null)} title="Internal Expense Receipt Preview" size="lg">
                    <div className="space-y-4 p-2 text-center">
                        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 p-2.5 rounded-xl text-xs text-amber-900 dark:text-amber-200 flex items-center gap-2">
                            <ShieldCheck size={16} className="text-amber-600 shrink-0" />
                            <span>Confidential Internal Document &ndash; Not visible to customer.</span>
                        </div>
                        {viewingReceiptUrls.map((url, idx) => (
                            <div key={idx} className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
                                <img src={url} alt={`Receipt ${idx + 1}`} className="max-h-[600px] w-auto mx-auto object-contain" />
                            </div>
                        ))}
                    </div>
                </Modal>
            )}

            {/* Document / Work Order Lightbox Modal */}
            {viewingDocument && (
                <Modal isOpen={true} onClose={() => setViewingDocument(null)} title={(viewingDocument as any).fileName || (viewingDocument as any).title || "Work Order Document"} size="xl">
                    <div className="space-y-4 p-2 text-center">
                        {(() => {
                            const rawUrl = (viewingDocument as any).url || (viewingDocument as any).fileUrl || (viewingDocument as any).dataUrl || '';
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

                            const fileInfo = detectFileType(docUrl || rawUrl, (viewingDocument as any).fileName, (viewingDocument as any).fileType || (viewingDocument as any).type);

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

            {/* Nested WorkOrderAssociationsModal */}
            {viewingWoNumber && (
                <WorkOrderAssociationsModal
                    isOpen={!!viewingWoNumber}
                    onClose={() => setViewingWoNumber(null)}
                    workOrderNumber={viewingWoNumber}
                    customerId={currentJob.customerId || null}
                />
            )}

            {/* Subcontractor Work Order Modal Viewer */}
            {isSubcontractorWoOpen && selectedWoJob && (
                <SubcontractorWorkOrderModal
                    isOpen={isSubcontractorWoOpen}
                    onClose={() => {
                        setIsSubcontractorWoOpen(false);
                        setSelectedWoJob(null);
                    }}
                    job={selectedWoJob}
                />
            )}

            {/* Send Subcontractor Work Order Dispatch Modal */}
            {isSendSubcontractorWoOpen && selectedWoJob && (
                <SendSubcontractorWorkOrderModal
                    isOpen={isSendSubcontractorWoOpen}
                    onClose={() => {
                        setIsSendSubcontractorWoOpen(false);
                        setSelectedWoJob(null);
                    }}
                    job={selectedWoJob}
                    organization={state.currentOrganization}
                />
            )}

            {/* Nested JobDetailModal for viewing linked job details/reports */}
            {selectedJobForModal && (
                <JobDetailModal
                    isOpen={!!selectedJobForModal}
                    onClose={() => setSelectedJobForModal(null)}
                    job={selectedJobForModal}
                />
            )}

            {/* Document Preview Lightbox Modal for Linked Proposals and Invoices */}
            {previewDoc && (
                <DocumentPreview
                    type={previewDoc.type}
                    data={previewDoc.data}
                    onClose={() => setPreviewDoc(null)}
                    isInternal={true}
                    organization={state.currentOrganization}
                />
            )}
        </Modal>
    );
};

export default JobLinkingModal;
