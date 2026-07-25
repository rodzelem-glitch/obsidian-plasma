import { cleanUndefinedFields } from '../../lib/utils';
import React, { useState, useMemo } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { useAppContext } from 'context/AppContext';
import { 
    Calendar, Wrench, FileText, Image, MapPin, 
    Phone, Mail, User, DollarSign, Copy, Check, Info, ShieldCheck, Download, Upload, Link2, Paperclip, Eye
} from 'lucide-react';
import JobDetailModal from './JobDetailModal';
import DocumentPreview from '../ui/DocumentPreview';
import showToast from 'lib/toast';
import { db } from 'lib/firebase';
import firebase from 'firebase/compat/app';
import { uploadFileToStorage } from 'lib/storageService';

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

    // Retrieve Customer
    const customer = useMemo(() => {
        if (!customerId) return null;
        return state.customers?.find(c => c.id === customerId) || null;
    }, [state.customers, customerId]);

    // Retrieve associated Jobs
    const associatedJobs = useMemo(() => {
        if (!workOrderNumber && !customerId) return [];
        const woLower = workOrderNumber?.trim().toLowerCase();
        return (state.jobs || []).filter(j => {
            const cMatch = !customerId || j.customerId === customerId;
            if (!cMatch) return false;
            const jPo = j.poNumber?.trim().toLowerCase();
            const jWo = j.workOrderNumber?.trim().toLowerCase();
            const jInvPo = j.invoice?.poNumber?.trim().toLowerCase();
            return (woLower && (jPo === woLower || jWo === woLower || jInvPo === woLower));
        });
    }, [state.jobs, customerId, workOrderNumber]);

    const targetJobForUpload = useMemo(() => {
        if (associatedJobs.length === 0) return null;
        return [...associatedJobs].sort((a, b) => new Date(b.appointmentTime).getTime() - new Date(a.appointmentTime).getTime())[0];
    }, [associatedJobs]);

    // Retrieve associated Proposals
    const associatedProposals = useMemo(() => {
        if (!workOrderNumber || !customerId) return [];
        return state.proposals?.filter(p => 
            p.customerId === customerId && 
            p.poNumber?.trim().toLowerCase() === workOrderNumber.trim().toLowerCase()
        ) || [];
    }, [state.proposals, customerId, workOrderNumber]);

    // Retrieve associated files (photos/docs) from jobs
    const associatedFiles = useMemo(() => {
        const files: any[] = [];
        associatedJobs.forEach(job => {
            if (job.files) {
                job.files.forEach(f => {
                    files.push({ 
                        ...f, 
                        jobId: job.id,
                        jobTasks: job.tasks, 
                        jobDate: job.appointmentTime 
                    });
                });
            }
        });
        return files;
    }, [associatedJobs]);

    const hasExternalWorkOrder = useMemo(() => {
        return associatedFiles.some(f => 
            f.label?.toLowerCase() === 'external work order' || 
            f.metadata?.label?.toLowerCase() === 'external work order' ||
            f.fileName?.toLowerCase().includes('external_workorder') ||
            f.fileName?.toLowerCase().includes('external work order')
        );
    }, [associatedFiles]);

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

    // Retrieve associated service locations matching this PO
    const associatedLocations = useMemo(() => {
        if (!customer || !workOrderNumber) return [];
        return customer.serviceLocations?.filter((loc: any) => 
            loc.poNumber?.trim().toLowerCase() === workOrderNumber.trim().toLowerCase()
        ) || [];
    }, [customer, workOrderNumber]);

    const handleCopy = () => {
        if (workOrderNumber) {
            navigator.clipboard.writeText(workOrderNumber);
            setCopied(true);
            showToast.success("Work Order Number copied to clipboard!");
            setTimeout(() => setCopied(false), 2000);
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
                                <div className="flex items-center gap-2 mt-1">
                                    <h2 className="text-2xl font-black font-mono tracking-tight">{workOrderNumber}</h2>
                                    <button 
                                        onClick={handleCopy} 
                                        className="p-1 hover:bg-white/10 rounded text-slate-300 hover:text-white transition-colors"
                                        title="Copy to Clipboard"
                                    >
                                        {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
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
                                        <div className="flex items-center gap-3 p-3 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 rounded-xl text-emerald-800 dark:text-emerald-400 text-xs font-bold">
                                            <ShieldCheck size={16} className="text-emerald-500 shrink-0" />
                                            <span>An external work order document is currently uploaded and linked to this PO.</span>
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
                            <div className="space-y-3 animate-fade-in">
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
                            <div className="space-y-3 animate-fade-in">
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
                            <div className="space-y-3 animate-fade-in">
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
                                            const isImage = file.fileType?.startsWith('image/') || file.dataUrl?.startsWith('data:image/');
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
                                                    
                                                    <div className="p-2 border-t border-slate-200/50 dark:border-slate-800">
                                                        <p className="text-[8px] font-black text-slate-400 uppercase truncate">
                                                            {file.jobTasks?.join(', ')}
                                                        </p>
                                                        <p className="text-[7px] font-bold text-slate-400 mt-0.5">
                                                            {new Date(file.jobDate).toLocaleDateString()}
                                                        </p>
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

            {/* Lightbox Image Overlay */}
            {lightboxImage && (
                <div 
                    className="fixed inset-0 bg-black/90 z-[300] flex items-center justify-center p-4 cursor-zoom-out"
                    onClick={() => setLightboxImage(null)}
                >
                    <img 
                        src={lightboxImage} 
                        alt="Enlarged Job Gallery File" 
                        className="max-w-full max-h-full rounded-lg shadow-2xl object-contain" 
                    />
                </div>
            )}
        </>
    );
};

export default WorkOrderAssociationsModal;
