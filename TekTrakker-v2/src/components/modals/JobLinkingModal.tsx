import { cleanUndefinedFields } from '../../lib/utils';
import React, { useState, useMemo } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { useAppContext } from 'context/AppContext';
import { db } from 'lib/firebase';
import showToast from 'lib/toast';
import { 
    Wrench, FileText, DollarSign, Link2, Unlink, Plus, AlertCircle, Info, Calendar, Clock, Paperclip, ShieldCheck, Eye, Receipt, ClipboardList, ExternalLink, Upload, FileUp, Download, Trash2, CheckCircle2
} from 'lucide-react';
import { Job, Proposal } from '../../types';
import WorkOrderAssociationsModal from './WorkOrderAssociationsModal';
import { uploadFileToStorage } from 'lib/storageService';
import firebase from 'firebase/compat/app';

interface JobLinkingModalProps {
    isOpen: boolean;
    onClose: () => void;
    job: Job;
}

const JobLinkingModal: React.FC<JobLinkingModalProps> = ({ isOpen, onClose, job }) => {
    const { state, dispatch } = useAppContext();
    const [activeTab, setActiveTab] = useState<'jobs' | 'invoices' | 'proposals' | 'expenses' | 'workorders'>('jobs');
    const [selectedJobToLink, setSelectedJobToLink] = useState('');
    const [selectedInvoiceToLink, setSelectedInvoiceToLink] = useState('');
    const [selectedProposalToLink, setSelectedProposalToLink] = useState('');
    const [selectedExpenseToLink, setSelectedExpenseToLink] = useState('');
    const [inputWoNumber, setInputWoNumber] = useState('');
    const [viewingWoNumber, setViewingWoNumber] = useState<string | null>(null);
    const [viewingReceiptUrls, setViewingReceiptUrls] = useState<string[] | null>(null);
    const [isActionPending, setIsActionPending] = useState(false);

    // 1. Jobs Resolution
    const linkedJobs = useMemo(() => {
        return (state.jobs || []).filter((j: Job) => 
            j.id !== job.id && (
                job.linkedJobIds?.includes(j.id) || 
                j.linkedJobIds?.includes(job.id)
            )
        );
    }, [state.jobs, job]);

    const availableJobs = useMemo(() => {
        return (state.jobs || []).filter((j: Job) => 
            j.customerId === job.customerId && 
            j.id !== job.id && 
            !linkedJobs.some((lj: Job) => lj.id === j.id)
        );
    }, [state.jobs, job, linkedJobs]);

    // 2. Invoices Resolution
    const linkedInvoices = useMemo(() => {
        const invoiceIds = job.linkedInvoiceIds || [];
        return (state.jobs || [])
            .filter((j: Job) => j.invoice && invoiceIds.includes(j.invoice.id))
            .map((j: Job) => ({
                job: j,
                invoice: j.invoice!
            }));
    }, [state.jobs, job.linkedInvoiceIds]);

    const availableInvoices = useMemo(() => {
        const linkedInvoiceIds = job.linkedInvoiceIds || [];
        return (state.jobs || [])
            .filter((j: Job) => 
                j.customerId === job.customerId && 
                j.id !== job.id && 
                j.invoice && 
                !linkedInvoiceIds.includes(j.invoice.id)
            )
            .map((j: Job) => ({
                job: j,
                invoice: j.invoice!
            }));
    }, [state.jobs, job, job.linkedInvoiceIds]);

    // 3. Proposals Resolution
    const linkedProposals = useMemo(() => {
        return (state.proposals || []).filter((p: Proposal) => 
            p.id === job.proposalId || 
            p.id === job.projectId || 
            job.linkedProposalIds?.includes(p.id) || 
            p.linkedJobIds?.includes(job.id)
        );
    }, [state.proposals, job]);

    const availableProposals = useMemo(() => {
        return (state.proposals || []).filter((p: Proposal) => 
            p.customerId === job.customerId && 
            !linkedProposals.some((lp: Proposal) => lp.id === p.id)
        );
    }, [state.proposals, job, linkedProposals]);

    // 4. Expenses Resolution
    const linkedExpenses = useMemo(() => {
        const linkedIds = job.linkedExpenseIds || [];
        return (state.expenses || []).filter((exp: any) => 
            linkedIds.includes(exp.id) || exp.jobId === job.id
        );
    }, [state.expenses, job.linkedExpenseIds, job.id]);

    const availableExpenses = useMemo(() => {
        const linkedIds = job.linkedExpenseIds || [];
        return (state.expenses || []).filter((exp: any) => 
            !linkedIds.includes(exp.id) && exp.jobId !== job.id
        );
    }, [state.expenses, job.linkedExpenseIds, job.id]);

    // 5. Work Orders / PO Resolution
    const linkedWorkOrders = useMemo(() => {
        const wos = new Set<string>();
        if (job.poNumber?.trim()) wos.add(job.poNumber.trim());
        (job.linkedPoNumbers || []).forEach(wo => wo?.trim() && wos.add(wo.trim()));
        (job.linkedWorkOrderNumbers || []).forEach(wo => wo?.trim() && wos.add(wo.trim()));
        return Array.from(wos);
    }, [job.poNumber, job.linkedPoNumbers, job.linkedWorkOrderNumbers]);

    const availableWorkOrders = useMemo(() => {
        const existing = new Set(linkedWorkOrders.map(w => w.toLowerCase()));
        const found = new Set<string>();

        (state.jobs || []).forEach((j: Job) => {
            if (j.customerId === job.customerId && j.poNumber?.trim()) {
                const clean = j.poNumber.trim();
                if (!existing.has(clean.toLowerCase())) found.add(clean);
            }
        });

        (state.proposals || []).forEach((p: Proposal) => {
            if (p.customerId === job.customerId && p.poNumber?.trim()) {
                const clean = p.poNumber.trim();
                if (!existing.has(clean.toLowerCase())) found.add(clean);
            }
        });

        return Array.from(found);
    }, [state.jobs, state.proposals, job.customerId, linkedWorkOrders]);

    const [isUploadingWoFile, setIsUploadingWoFile] = useState(false);

    const externalWorkOrderFiles = useMemo(() => {
        return (job.files || []).filter((f: any) => 
            f.label?.toLowerCase() === 'external work order' || 
            f.metadata?.label?.toLowerCase() === 'external work order' ||
            f.fileName?.toLowerCase().includes('external_workorder') ||
            f.fileName?.toLowerCase().includes('external work order') ||
            f.isExternalWorkOrder === true
        );
    }, [job.files]);

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

            const updatedCurrentPropIds = Array.from(new Set([...(job.linkedProposalIds || []), selectedProposalToLink]));
            const updatedTargetJobIds = Array.from(new Set([...(targetProp.linkedJobIds || []), job.id]));

            // Update DB
            await db.collection('jobs').doc(job.id).update(cleanUndefinedFields({ linkedProposalIds: updatedCurrentPropIds }));
            await db.collection('proposals').doc(selectedProposalToLink).update(cleanUndefinedFields({ linkedJobIds: updatedTargetJobIds }));

            // Update Context
            dispatch({ type: 'UPDATE_JOB', payload: { id: job.id, linkedProposalIds: updatedCurrentPropIds } });
            dispatch({ type: 'UPDATE_PROPOSAL', payload: { id: selectedProposalToLink, linkedJobIds: updatedTargetJobIds } });

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
            const updatedCurrentPropIds = (job.linkedProposalIds || []).filter(id => id !== proposalId);
            
            // Check main project relation
            const jobUpdates: any = { linkedProposalIds: updatedCurrentPropIds };
            if (job.proposalId === proposalId) jobUpdates.proposalId = '';
            if (job.projectId === proposalId) jobUpdates.projectId = '';

            await db.collection('jobs').doc(job.id).update(cleanUndefinedFields(jobUpdates));
            dispatch({ type: 'UPDATE_JOB', payload: { id: job.id, ...jobUpdates } });

            if (targetProp) {
                const updatedTargetJobIds = (targetProp.linkedJobIds || []).filter(id => id !== job.id);
                const propUpdates: any = { linkedJobIds: updatedTargetJobIds };
                if (targetProp.jobId === job.id) propUpdates.jobId = '';

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
                                Job #{job.id.slice(0, 8)}
                            </h2>
                            <p className="text-xs text-slate-350">{job.tasks?.join(', ') || 'General Service'}</p>
                        </div>
                        <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-xs">
                            <span className="text-slate-400 font-medium block">Customer</span>
                            <span className="font-bold text-white text-sm">{job.customerName}</span>
                        </div>
                    </div>
                </div>

                {/* Tab List Navigation */}
                <div className="flex border-b border-slate-200 dark:border-slate-700 overflow-x-auto pb-px">
                    {[
                        { id: 'jobs', label: `Linked Jobs (${linkedJobs.length})`, icon: Wrench },
                        { id: 'workorders', label: `Linked Work Orders (${linkedWorkOrders.length})`, icon: ClipboardList },
                        { id: 'invoices', label: `Linked Invoices (${linkedInvoices.length})`, icon: DollarSign },
                        { id: 'proposals', label: `Linked Proposals (${linkedProposals.length})`, icon: FileText },
                        { id: 'expenses', label: `Linked Expenses (${linkedExpenses.length})`, icon: Paperclip }
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
                            {/* Link Form */}
                            <div className="bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 p-4 rounded-xl flex flex-col md:flex-row items-center gap-3">
                                <div className="flex-1 w-full">
                                    <label htmlFor="link-job-select" className="block text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1">
                                        Select job to link
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
                                    className="w-full md:w-auto h-10 px-5 flex items-center justify-center gap-2 bg-[#123A63] hover:bg-[#0f2d50] text-white font-bold rounded-lg border-0 shrink-0"
                                >
                                    <Plus size={16} /> Link Job
                                </Button>
                            </div>

                            {/* Linked List */}
                            <div className="space-y-3">
                                <h3 className="text-xs font-black uppercase text-slate-400 tracking-wider flex items-center gap-1.5">
                                    <Link2 size={14} className="text-primary-600" /> Current Linked Jobs
                                </h3>

                                {linkedJobs.length === 0 ? (
                                    <div className="p-8 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl text-center">
                                        <p className="text-xs text-slate-400 italic">No other jobs are currently linked to this job.</p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {linkedJobs.map(lj => {
                                            const jobDate = lj.appointmentTime ? new Date(lj.appointmentTime).toLocaleDateString() : '';
                                            return (
                                                <div key={lj.id} className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl flex items-center justify-between gap-4 shadow-sm hover:shadow-md transition-shadow">
                                                    <div className="space-y-1">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-xs font-black font-mono">Job #{lj.id.slice(0, 8)}</span>
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
                                                    <button
                                                        onClick={() => handleUnlinkJob(lj.id)}
                                                        disabled={isActionPending}
                                                        className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg transition-colors border-0 bg-transparent outline-none"
                                                        title="Unlink Job"
                                                    >
                                                        <Unlink size={16} />
                                                    </button>
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
                            {/* Link Form */}
                            <div className="bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 p-4 rounded-xl flex flex-col md:flex-row items-center gap-3">
                                <div className="flex-1 w-full">
                                    <label htmlFor="link-invoice-select" className="block text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1">
                                        Select invoice to link
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
                                    className="w-full md:w-auto h-10 px-5 flex items-center justify-center gap-2 bg-[#123A63] hover:bg-[#0f2d50] text-white font-bold rounded-lg border-0 shrink-0"
                                >
                                    <Plus size={16} /> Link Invoice
                                </Button>
                            </div>

                            {/* Linked List */}
                            <div className="space-y-3">
                                <h3 className="text-xs font-black uppercase text-slate-400 tracking-wider flex items-center gap-1.5">
                                    <Link2 size={14} className="text-primary-600" /> Current Linked Invoices
                                </h3>

                                {linkedInvoices.length === 0 ? (
                                    <div className="p-8 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl text-center">
                                        <p className="text-xs text-slate-400 italic">No external invoices are currently linked to this job.</p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {linkedInvoices.map(item => (
                                            <div key={item.invoice.id} className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl flex items-center justify-between gap-4 shadow-sm hover:shadow-md transition-shadow">
                                                <div className="space-y-1">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs font-black font-mono">Invoice #{item.invoice.id.slice(0, 8)}</span>
                                                        <span className={`px-2 py-0.5 text-[8px] font-black uppercase tracking-wider rounded-full ${
                                                            item.invoice.status === 'Paid' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400' :
                                                            'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400'
                                                        }`}>
                                                            {item.invoice.status}
                                                        </span>
                                                    </div>
                                                    <div className="text-[10px] text-slate-500 flex flex-col gap-0.5">
                                                        <span className="font-bold text-slate-700 dark:text-slate-350">${item.invoice.amount?.toFixed(2)}</span>
                                                        <span>Associated with Job #{item.job.id.slice(0, 8)}</span>
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => handleUnlinkInvoice(item.invoice.id)}
                                                    disabled={isActionPending}
                                                    className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg transition-colors border-0 bg-transparent outline-none"
                                                    title="Unlink Invoice"
                                                >
                                                    <Unlink size={16} />
                                                </button>
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
                            {/* Link Form */}
                            <div className="bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 p-4 rounded-xl flex flex-col md:flex-row items-center gap-3">
                                <div className="flex-1 w-full">
                                    <label htmlFor="link-proposal-select" className="block text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1">
                                        Select proposal to link
                                    </label>
                                    <select
                                        id="link-proposal-select"
                                        className="w-full text-sm border border-slate-300 dark:border-slate-700 rounded-lg p-2 dark:bg-slate-850 dark:text-white"
                                        value={selectedProposalToLink}
                                        onChange={e => setSelectedProposalToLink(e.target.value)}
                                        disabled={isActionPending}
                                    >
                                        <option value="">-- Choose a proposal belonging to this customer --</option>
                                        {availableProposals.map(p => (
                                            <option key={p.id} value={p.id}>
                                                Proposal #{p.id.slice(0, 8)} - {p.title || 'Untitled Proposal'} (${p.total?.toFixed(2)})
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <Button 
                                    onClick={handleLinkProposal} 
                                    disabled={!selectedProposalToLink || isActionPending}
                                    className="w-full md:w-auto h-10 px-5 flex items-center justify-center gap-2 bg-[#123A63] hover:bg-[#0f2d50] text-white font-bold rounded-lg border-0 shrink-0"
                                >
                                    <Plus size={16} /> Link Proposal
                                </Button>
                            </div>

                            {/* Linked List */}
                            <div className="space-y-3">
                                <h3 className="text-xs font-black uppercase text-slate-400 tracking-wider flex items-center gap-1.5">
                                    <Link2 size={14} className="text-primary-600" /> Current Linked Proposals
                                </h3>

                                {linkedProposals.length === 0 ? (
                                    <div className="p-8 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl text-center">
                                        <p className="text-xs text-slate-400 italic">No proposals are currently linked to this job.</p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {linkedProposals.map(lp => (
                                            <div key={lp.id} className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl flex items-center justify-between gap-4 shadow-sm hover:shadow-md transition-shadow">
                                                <div className="space-y-1">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs font-black font-mono">Proposal #{lp.id.slice(0, 8)}</span>
                                                        <span className={`px-2 py-0.5 text-[8px] font-black uppercase tracking-wider rounded-full ${
                                                            lp.status?.toLowerCase() === 'approved' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400' :
                                                            lp.status?.toLowerCase() === 'pending' ? 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400' :
                                                            'bg-slate-50 text-slate-700 dark:bg-slate-800 dark:text-slate-400'
                                                        }`}>
                                                            {lp.status}
                                                        </span>
                                                    </div>
                                                    <div className="text-[10px] text-slate-500 flex flex-col gap-0.5">
                                                        <span className="font-bold text-slate-700 dark:text-slate-350">{lp.title || 'Untitled Proposal'}</span>
                                                        <span>Value: ${lp.total?.toFixed(2)}</span>
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => handleUnlinkProposal(lp.id)}
                                                    disabled={isActionPending}
                                                    className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg transition-colors border-0 bg-transparent outline-none"
                                                    title="Unlink Proposal"
                                                >
                                                    <Unlink size={16} />
                                                </button>
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

                            {/* Control Header & Actions */}
                            <div className="bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 p-4 rounded-xl space-y-3">
                                <div className="flex flex-col md:flex-row items-center justify-between gap-3">
                                    <div className="flex-1 w-full space-y-1">
                                        <label htmlFor="link-wo-input" className="block text-[10px] font-black uppercase text-slate-400 tracking-wider">
                                            Link System Work Order / PO Number
                                        </label>
                                        <div className="flex gap-2">
                                            <input
                                                id="link-wo-input"
                                                type="text"
                                                placeholder="Enter WO or PO # (e.g. WO-98234)..."
                                                className="w-full text-sm border border-slate-300 dark:border-slate-700 rounded-lg p-2 dark:bg-slate-850 dark:text-white"
                                                value={inputWoNumber}
                                                onChange={e => setInputWoNumber(e.target.value)}
                                                onKeyDown={e => e.key === 'Enter' && handleLinkWorkOrder()}
                                                disabled={isActionPending}
                                            />
                                            {availableWorkOrders.length > 0 && (
                                                <select
                                                    aria-label="Select existing customer Work Order"
                                                    className="text-xs border border-slate-300 dark:border-slate-700 rounded-lg p-2 dark:bg-slate-850 dark:text-white max-w-[180px]"
                                                    onChange={e => {
                                                        if (e.target.value) handleLinkWorkOrder(e.target.value);
                                                    }}
                                                    defaultValue=""
                                                    disabled={isActionPending}
                                                >
                                                    <option value="" disabled>-- Customer History --</option>
                                                    {availableWorkOrders.map(wo => (
                                                        <option key={wo} value={wo}>#{wo}</option>
                                                    ))}
                                                </select>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 w-full md:w-auto shrink-0 pt-3 md:pt-0">
                                        <Button 
                                            onClick={() => handleLinkWorkOrder()} 
                                            disabled={!inputWoNumber.trim() || isActionPending}
                                            className="flex-1 md:flex-none h-10 px-4 flex items-center justify-center gap-2 bg-[#123A63] hover:bg-[#0f2d50] text-white font-bold rounded-lg border-0"
                                        >
                                            <Plus size={16} /> Link PO #
                                        </Button>

                                        <Button 
                                            onClick={() => document.getElementById('external-wo-upload-input')?.click()} 
                                            disabled={isUploadingWoFile}
                                            className="flex-1 md:flex-none h-10 px-4 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg border-0"
                                        >
                                            <Upload size={16} /> {isUploadingWoFile ? 'Uploading...' : 'Upload WO PDF'}
                                        </Button>
                                    </div>
                                </div>
                            </div>

                            {/* Section 1: Uploaded External Work Orders (PDFs/Images from Emails) */}
                            {externalWorkOrderFiles.length > 0 && (
                                <div className="space-y-3">
                                    <h3 className="text-xs font-black uppercase text-slate-400 tracking-wider flex items-center gap-1.5">
                                        <FileUp size={14} className="text-emerald-600 dark:text-emerald-400" /> Uploaded External Work Orders (PDF Documents)
                                    </h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {externalWorkOrderFiles.map((file: any) => (
                                            <div key={file.id} className="p-4 bg-emerald-50/40 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/50 rounded-xl flex items-center justify-between gap-4 shadow-sm">
                                                <div className="space-y-1 overflow-hidden">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs font-black text-slate-900 dark:text-white truncate">{file.fileName}</span>
                                                        <span className="px-2 py-0.5 text-[8px] font-black uppercase tracking-wider rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300 shrink-0">
                                                            External PDF
                                                        </span>
                                                    </div>
                                                    <p className="text-[10px] text-slate-500">
                                                        Uploaded by {file.uploadedBy || 'User'} &bull; {new Date(file.createdAt).toLocaleDateString()}
                                                    </p>
                                                </div>

                                                <div className="flex items-center gap-2 shrink-0">
                                                    <a
                                                        href={file.dataUrl}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="p-2 text-emerald-700 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 rounded-lg transition-colors flex items-center gap-1 text-xs font-bold"
                                                        title="View / Download PDF"
                                                    >
                                                        <ExternalLink size={15} /> View PDF
                                                    </a>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Section 2: Linked Work Orders & PO Numbers */}
                            <div className="space-y-3">
                                <h3 className="text-xs font-black uppercase text-slate-400 tracking-wider flex items-center gap-1.5">
                                    <ClipboardList size={14} className="text-primary-600" /> Linked Work Orders & PO Numbers
                                </h3>

                                {linkedWorkOrders.length === 0 ? (
                                    <div className="p-8 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl text-center">
                                        <p className="text-xs text-slate-400 italic">No Work Orders or PO numbers are currently linked to this job.</p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {linkedWorkOrders.map(wo => {
                                            const isPrimary = job.poNumber?.trim().toLowerCase() === wo.trim().toLowerCase();
                                            return (
                                                <div key={wo} className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl flex items-center justify-between gap-4 shadow-sm hover:shadow-md transition-shadow">
                                                    <div className="space-y-1">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-sm font-black font-mono text-slate-900 dark:text-white">#{wo}</span>
                                                            {isPrimary && (
                                                                <span className="px-2 py-0.5 text-[8px] font-black uppercase tracking-wider rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                                                                    Primary PO
                                                                </span>
                                                            )}
                                                            <span className="px-2 py-0.5 text-[8px] font-black uppercase tracking-wider rounded-full bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300">
                                                                TekTrakker WO
                                                            </span>
                                                        </div>
                                                        <p className="text-[10px] text-slate-500">Customer: {job.customerName}</p>
                                                    </div>

                                                    <div className="flex items-center gap-2 shrink-0">
                                                        <button
                                                            type="button"
                                                            onClick={() => setViewingWoNumber(wo)}
                                                            className="p-2 text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-950/30 rounded-lg transition-colors border-0 bg-transparent outline-none flex items-center gap-1 text-xs font-bold"
                                                            title="View Work Order Associations"
                                                        >
                                                            <ExternalLink size={15} /> Associations
                                                        </button>
                                                        {!isPrimary && (
                                                            <button
                                                                onClick={() => handleUnlinkWorkOrder(wo)}
                                                                disabled={isActionPending}
                                                                className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg transition-colors border-0 bg-transparent outline-none"
                                                                title="Unlink Work Order"
                                                            >
                                                                <Unlink size={16} />
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
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
                                <div className="space-y-0.5">
                                    <p className="font-extrabold uppercase tracking-wide">Internal Confidential Expense Records</p>
                                    <p className="leading-relaxed">
                                        These expense receipts and purchase records are strictly confidential internal records for job cost tracking. They are <strong>never</strong> displayed, shared, or accessible to customers on invoices, proposals, or customer portals.
                                    </p>
                                </div>
                            </div>

                            {/* Link Form */}
                            <div className="bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 p-4 rounded-xl flex flex-col md:flex-row items-center gap-3">
                                <div className="flex-1 w-full">
                                    <label htmlFor="link-expense-select" className="block text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1">
                                        Select expense receipt to link
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
                                    className="w-full md:w-auto h-10 px-5 flex items-center justify-center gap-2 bg-[#123A63] hover:bg-[#0f2d50] text-white font-bold rounded-lg border-0 shrink-0"
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
                                    <div className="p-8 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl text-center">
                                        <p className="text-xs text-slate-400 italic">No expense receipts are currently linked to this job.</p>
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
                </div>
            </div>

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

            {/* Nested WorkOrderAssociationsModal */}
            {viewingWoNumber && (
                <WorkOrderAssociationsModal
                    isOpen={!!viewingWoNumber}
                    onClose={() => setViewingWoNumber(null)}
                    workOrderNumber={viewingWoNumber}
                    customerId={job.customerId || null}
                />
            )}
        </Modal>
    );
};

export default JobLinkingModal;
