
import React, { useState, useEffect } from 'react';
import IoTDiagnosticsViewer from '../features/IoTDiagnosticsViewer';
import CompanyCamGallery from '../features/CompanyCamGallery';
import Modal from '../ui/Modal';
import { 
    Calendar, MapPin, Clock, CheckCircle, Package, 
    ShieldCheck, FileText, Droplets, 
    Thermometer, Wrench, DollarSign, Printer,
    Check, Shield, Trash2
} from 'lucide-react';
import { Job, Proposal, DiagnosticReport } from '../../types';
import Button from '../ui/Button';
import { db, functions } from '../../lib/firebase';
import firebase from 'firebase/compat/app';
import DocumentPreview from '../ui/DocumentPreview';
import { useAppContext } from '../../context/AppContext';

interface JobDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    job: Job;
    isAdmin?: boolean;
    onEditInvoice?: () => void;
    onEditRecord?: () => void;
    onPrint?: () => void;
}

interface ExtendedFile {
    id?: string;
    dataUrl?: string;
    url?: string;
    label?: string;
    contentType?: string;
    fileType?: string;
    metadata?: { label?: string; category?: string };
    type?: string;
    fileName?: string;
    createdAt?: string | number;
}

const JobDetailModal: React.FC<JobDetailModalProps> = ({ 
    isOpen, onClose, job, isAdmin, 
    onEditInvoice, onEditRecord, onPrint 
}) => {
    const [proposal, setProposal] = useState<Record<string, unknown> | null>(null);
    const [previewDoc, setPreviewDoc] = useState<Record<string, unknown> | null>(null);
    const [diagnostics, setDiagnostics] = useState<DiagnosticReport[]>([]);
    const [deletedFiles, setDeletedFiles] = useState<Set<string>>(new Set());
    const [isRefunding, setIsRefunding] = useState(false);
    const { state } = useAppContext();

    const handleRefund = async () => {
        if (!job.invoice?.paymentIntentId) return;
        
        const amountStr = window.prompt(
            "Enter the amount to refund (leave blank or enter full amount for a complete refund):",
            job.invoice.amount ? job.invoice.amount.toString() : ""
        );
        
        if (amountStr === null) return; // User cancelled
        
        const amount = parseFloat(amountStr);
        if (isNaN(amount) || amount <= 0) {
            alert("Invalid amount.");
            return;
        }
        
        setIsRefunding(true);
        try {
            const refundCallable = functions.httpsCallable('refundKortPayment');
            await refundCallable({
                paymentIntentId: job.invoice.paymentIntentId,
                organizationId: job.organizationId,
                amount: amount
            });
            alert("Refund initiated successfully.");
        } catch (error: any) {
            console.error("Refund error:", error);
            alert(`Refund failed: ${error.message}`);
        } finally {
            setIsRefunding(false);
        }
    };

    const handleDeletePhoto = async (file: ExtendedFile) => {
        if (!window.confirm("Delete this photo permanently?")) return;
        try {
            setDeletedFiles(prev => new Set(prev).add(file.id || file.dataUrl));
            await db.collection('jobs').doc(job.id).update({
                files: firebase.firestore.FieldValue.arrayRemove(file)
            });
        } catch (e) {
            console.error(e);
            alert("Failed to delete photo.");
        }
    };

    useEffect(() => {
        if (!state.currentUser || !job?.id) return;
        setProposal(null);

        const promises: Promise<Proposal | null>[] = [];

        // Query by jobId field (primary — this is how FieldProposal saves it)
        promises.push(
            db.collection('proposals').where('jobId', '==', job.id).limit(1).get()
                .then(snap => snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() } as Proposal)
                .catch(() => null)
        );

        // Direct lookup by projectId (fallback for older records)
        if (job.projectId) {
            promises.push(
                db.collection('proposals').doc(job.projectId).get()
                    .then(doc => doc.exists ? { id: doc.id, ...doc.data() } as Proposal : null)
                    .catch(() => null)
            );
        }

        Promise.all(promises).then(results => {
            const found = results.find(r => r !== null);
            if (found) setProposal(found);
        });

        // Fetch measureQuick diagnostics
        const unsubDiags = db.collection('jobs').doc(job.id).collection('diagnostics').onSnapshot(snap => {
            setDiagnostics(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as DiagnosticReport)));
        });

        return () => unsubDiags();
    }, [job?.id, job?.projectId, state.currentUser]);

    if (!job) return null;

    const formatAddress = (addr: unknown) => {
        if (typeof addr === 'string') return addr;
        if (!addr) return 'Address not recorded';
        const a = addr as Record<string, string>;
        return `${a.street || ''}, ${a.city || ''}, ${a.state || ''} ${a.zip || ''}`;
    };

    const photoFiles = job.files?.filter(f => 
        !deletedFiles.has(f.id || (f as ExtendedFile).dataUrl || '') && (
            f.type === 'Photo' || 
            (f as ExtendedFile).contentType?.startsWith('image/') || 
            (f as ExtendedFile).fileType?.startsWith('image/')
        )
    ) || [];

    const groupedPhotos = photoFiles.reduce((acc, f) => {
        const label = f.metadata?.label || (f as ExtendedFile).label || 'Uncategorized';
        if (!acc[label]) acc[label] = [];
        acc[label].push(f);
        return acc;
    }, {} as Record<string, typeof photoFiles>);
    const docFiles = job.files?.filter(f => 
        f.type === 'Document' || 
        (f as ExtendedFile).contentType === 'application/pdf' || 
        (f as ExtendedFile).fileType === 'application/pdf' ||
        (f as ExtendedFile).fileType === 'text/html' ||
        f.fileName?.toLowerCase().endsWith('.html') ||
        f.fileName?.toLowerCase().endsWith('.pdf')
    ) || [];

    return (
        <>
        <Modal isOpen={isOpen} onClose={onClose} title={`Job Record: ${job.id}`} size="xl">
            <div className="p-6">
                {/* Sticky Navigation/Print Header */}
                <div className="flex justify-between items-start mb-8 border-b border-slate-100 dark:border-slate-800 pb-6 sticky top-0 bg-white dark:bg-gray-800 z-10 -mx-6 px-6 py-4 shadow-sm print:relative print:shadow-none print:border-none print:m-0 print:p-0">
                    <div>
                        <div className="flex items-center gap-3 mb-1">
                             <div className="bg-primary-600 p-2 rounded-xl text-white shadow-lg shadow-primary-500/20 print:hidden">
                                <FileText size={20}/>
                            </div>
                            <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tighter truncate max-w-[200px] md:max-w-none">Job History Record</h2>
                        </div>
                        <p className="text-xs text-slate-400 font-bold uppercase tracking-widest flex items-center gap-2">
                             <Calendar size={12}/> {new Date(job.appointmentTime).toLocaleDateString()}
                        </p>
                    </div>
                    <div className="flex gap-2 print:hidden backdrop-blur-md bg-white/50 dark:bg-gray-800/50 p-1 rounded-2xl">
                         <Button variant="secondary" onClick={onClose} className="h-10 text-[10px] uppercase font-black tracking-widest px-4">Back</Button>
                         {isAdmin && onEditRecord && (
                             <Button variant="secondary" onClick={onEditRecord} className="h-10 text-[10px] uppercase font-black tracking-widest px-4">Edit Record</Button>
                         )}
                         <Button onClick={onPrint || (() => window.print())} className="h-10 text-[10px] uppercase font-black tracking-widest flex items-center gap-2 px-4 whitespace-nowrap">
                            <Printer size={14}/> Print Report
                         </Button>
                    </div>
                    <div className="hidden print:block text-right">
                         <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Job Record ID</p>
                         <p className="text-xs font-mono font-bold text-slate-900">{job.id.toUpperCase()}</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Left Column: Notes & Tasks */}
                    <div className="lg:col-span-2 space-y-8">
                        {/* Summary Header Section (Printable) */}
                        <div className="bg-slate-50 dark:bg-slate-900/40 p-6 rounded-[2.5rem] border border-slate-100 dark:border-slate-800/60 shadow-sm mb-4 print:bg-white print:border-slate-200">
                            <div className="flex items-center justify-between mb-4">
                                <div className="space-y-1">
                                    <h3 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight print:text-black">{job.customerName}</h3>
                                    <p className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-1.5 font-medium print:text-slate-700">
                                        <MapPin size={14} className="text-slate-400 print:hidden"/> {formatAddress(job.address)}
                                    </p>
                                </div>
                                <span className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-full shadow-sm print:border print:border-slate-300 ${
                                    job.jobStatus === 'Completed' ? 'bg-emerald-500 text-white print:text-emerald-700 print:bg-white' : 
                                    job.jobStatus === 'In Progress' ? 'bg-blue-500 text-white print:text-blue-700 print:bg-white' : 
                                    'bg-slate-500 text-white print:text-slate-700 print:bg-white'
                                }`}>
                                    {job.jobStatus}
                                </span>
                            </div>
                            <div className="flex flex-wrap gap-4 pt-4 border-t border-slate-200/60 dark:border-slate-800/60">
                                <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-lg bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-primary-600 print:hidden">
                                        <Clock size={14}/>
                                    </div>
                                    <div>
                                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-tighter">Appointment</p>
                                        <p className="text-[11px] font-bold text-slate-700 dark:text-slate-300 print:text-black">{new Date(job.appointmentTime).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-amber-600 print:hidden">
                                        <Wrench size={14}/>
                                    </div>
                                    <div>
                                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-tighter">Technician</p>
                                        <p className="text-[11px] font-bold text-slate-700 dark:text-slate-300 print:text-black">
                                            {(() => {
                                                if (job.assignedTechnicianId) {
                                                    const tech = state.users?.find((u: any) => u.id === job.assignedTechnicianId);
                                                    if (tech) return `${tech.firstName} ${tech.lastName}`;
                                                }
                                                return job.assignedTechnicianName || 'Unassigned';
                                            })()}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Tasks Section */}
                        <section className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm print:bg-white print:border-slate-200">
                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                <CheckCircle size={14} className="text-emerald-500"/> Tasks Performed
                            </h4>
                            <div className="flex flex-wrap gap-2">
                                {job.tasks.map((t, i) => (
                                    <span key={i} className="px-4 py-2 bg-white dark:bg-slate-800 rounded-2xl text-xs font-bold text-slate-700 dark:text-slate-200 shadow-sm border border-slate-100 dark:border-slate-700 print:border-slate-200 print:text-black">
                                        {t}
                                    </span>
                                ))}
                            </div>
                        </section>

                        {/* Parts Used Section */}
                        {job.partsUsed && job.partsUsed.length > 0 && (
                            <section className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm print:bg-white print:border-slate-200">
                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                    <Package size={14} className="text-amber-500"/> Parts & Materials Used
                                </h4>
                                <div className="space-y-2">
                                    {job.partsUsed.map((part, i) => (
                                        <div key={i} className="flex justify-between items-center p-3 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-sm print:border-slate-200">
                                            <div>
                                                <p className="text-xs font-bold text-slate-800 dark:text-white print:text-black">{part.name}</p>
                                                {part.sku && <p className="text-[10px] text-slate-400 font-mono">SKU: {part.sku}</p>}
                                                {part.location && <p className="text-[9px] text-primary-500 font-bold uppercase">{part.location}</p>}
                                            </div>
                                            <div className="text-right">
                                                <p className="text-xs font-black text-slate-900 dark:text-white print:text-black">Qty: {part.quantity}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </section>
                        )}

                        {/* Service Checklists */}
                        {((job.notes?.diagnosisChecklist && job.notes?.diagnosisChecklist !== '[]') || (job.notes?.qualityChecklist && job.notes?.qualityChecklist !== '[]')) && (
                            <section className="space-y-4">
                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                    <CheckCircle size={14} className="text-primary-500"/> Service Checklists & Compliance
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {/* Diagnosis Checklist */}
                                    {job.notes?.diagnosisChecklist && job.notes?.diagnosisChecklist !== '[]' && (
                                        <div className="p-5 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl shadow-sm print:border-slate-200">
                                            <p className="text-[10px] font-black text-primary-500 uppercase tracking-tighter mb-4">Diagnosis Checklist</p>
                                            <div className="space-y-2">
                                                {(() => {
                                                    try {
                                                        const items = JSON.parse(job.notes.diagnosisChecklist);
                                                        const visibleItems = isAdmin ? items : items.filter((i: Record<string, unknown>) => !i.hiddenFromCustomer);
                                                        if (visibleItems.length === 0) return <p className="text-xs text-slate-400 italic">No visible items.</p>;
                                                        return visibleItems.map((item: Record<string, unknown>, idx: number) => (
                                                            <div key={idx} className="flex items-start gap-3 text-xs">
                                                                <div className={`mt-0.5 w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 ${item.completed ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-400'}`}>
                                                                    <Check size={10} strokeWidth={4}/>
                                                                </div>
                                                                <span className={item.completed ? 'text-slate-700 dark:text-slate-200 font-medium' : 'text-slate-400 line-through'}>{item.label as string}</span>
                                                            </div>
                                                        ));
                                                    } catch { return <p className="text-xs text-red-500">Error loading checklist</p>; }
                                                })()}
                                            </div>
                                        </div>
                                    )}

                                    {/* Quality Checklist */}
                                    {job.notes?.qualityChecklist && job.notes?.qualityChecklist !== '[]' && (
                                        <div className="p-5 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl shadow-sm print:border-slate-200">
                                            <p className="text-[10px] font-black text-emerald-500 uppercase tracking-tighter mb-4">Quality & Safety Audit</p>
                                            <div className="space-y-2">
                                                {(() => {
                                                    try {
                                                        const items = JSON.parse(job.notes.qualityChecklist);
                                                        const visibleItems = isAdmin ? items : items.filter((i: Record<string, unknown>) => !i.hiddenFromCustomer);
                                                        if (visibleItems.length === 0) return <p className="text-xs text-slate-400 italic">No visible items.</p>;
                                                        return visibleItems.map((item: Record<string, unknown>, idx: number) => (
                                                            <div key={idx} className="flex items-start gap-3 text-xs">
                                                                <div className={`mt-0.5 w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 ${item.completed ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-400'}`}>
                                                                    <Check size={10} strokeWidth={4}/>
                                                                </div>
                                                                <span className={item.completed ? 'text-slate-700 dark:text-slate-200 font-medium' : 'text-slate-400 line-through'}>{item.label as string}</span>
                                                            </div>
                                                        ));
                                                    } catch { return <p className="text-xs text-red-500">Error loading checklist</p>; }
                                                })()}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </section>
                        )}

                        {/* Detailed Notes Matrix */}
                        <section className="space-y-4">
                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                <FileText size={14}/> Technician Field Notes
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {[
                                    { label: 'Arrival Note', value: job.notes?.arrival },
                                    { label: 'Diagnosis', value: job.notes?.diagnosis },
                                    { label: 'Work Performed', value: job.notes?.work || job.notes?.workNotes },
                                    { label: 'Completion Notes', value: job.notes?.completion },
                                    { label: 'Internal Office Notes', value: job.notes?.internalNotes, adminOnly: true },
                                    { label: 'Customer Feedback (Notes)', value: job.notes?.customerFeedback },
                                    { label: 'Employee/Tech Feedback', value: job.notes?.employeeFeedback || job.notes?.feedback }
                                ].map((note, idx) => {
                                    if (!note.value || (note.adminOnly && !isAdmin)) return null;
                                    return (
                                        <div key={idx} className="p-5 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl shadow-sm print:border-slate-200">
                                            <p className="text-[10px] font-black text-primary-500 uppercase tracking-tighter mb-2">{note.label}</p>
                                            <p className="text-sm text-slate-600 dark:text-slate-300 whitespace-pre-wrap leading-relaxed print:text-black">{note.value}</p>
                                        </div>
                                    );
                                })}
                                {(!job.notes || Object.values(job.notes).every(v => !v)) && (
                                    <p className="text-xs text-slate-400 italic col-span-2 p-4 text-center">No field notes were recorded for this service.</p>
                                )}
                            </div>
                        </section>

                        {/* CompanyCam Integration */}
                        <CompanyCamGallery 
                            jobId={job.id} 
                            orgId={job.organizationId} 
                            address={formatAddress(job.address)} 
                        />

                        {/* IoT Smart Diagnostics */}
                        <section className="space-y-4 print:hidden">
                            <IoTDiagnosticsViewer 
                                jobId={job.id} 
                                customerName={job.customerName} 
                                orgId={job.organizationId} 
                            />
                        </section>

                        {/* Refrigerant & Technical Data */}
                        {( (job.refrigerantLog && job.refrigerantLog.length > 0) || (job.toolReadings && job.toolReadings.length > 0) || (job.qcAudits && job.qcAudits.length > 0) || (diagnostics.length > 0) ) && (
                            <section className="space-y-4">
                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                    <Wrench size={14}/> Technical, Environmental & QC Data
                                </h4>
                                <div className="space-y-4">
                                    {/* MeasureQuick Diagnostics */}
                                    {diagnostics && diagnostics.length > 0 && (
                                        <div className="space-y-3">
                                            {diagnostics.map((diag, i) => (
                                                <div key={i} className="p-5 bg-purple-50 dark:bg-purple-900/10 border border-purple-100 dark:border-purple-900/30 rounded-3xl print:bg-white print:border-slate-200 shadow-sm relative overflow-hidden">
                                                    <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                                                        <Thermometer size={60} />
                                                    </div>
                                                    <div className="flex justify-between items-center mb-4 relative z-10">
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-8 h-8 rounded-xl bg-purple-200 dark:bg-purple-900/50 flex items-center justify-center text-purple-700 dark:text-purple-300">
                                                                <Thermometer size={14}/>
                                                            </div>
                                                            <div>
                                                                <h5 className="text-[10px] font-black text-purple-700 dark:text-purple-400 uppercase tracking-widest">
                                                                    {diag.source === 'measureQuick' ? 'measureQuick Diagnostics' : 'Field Diagnostics'}
                                                                </h5>
                                                                {diag.systemType && <p className="text-[9px] font-bold text-slate-500 uppercase">{diag.systemType}</p>}
                                                            </div>
                                                        </div>
                                                        {diag.healthScore !== undefined && diag.healthScore !== null && (
                                                            <span className={`text-[10px] font-black px-3 py-1.5 rounded-xl shadow-sm border ${diag.healthScore >= 80 ? 'bg-emerald-500 border-emerald-400 text-white' : diag.healthScore >= 50 ? 'bg-amber-500 border-amber-400 text-white' : 'bg-red-500 border-red-400 text-white'}`}>
                                                                System Health: {diag.healthScore}/100
                                                            </span>
                                                        )}
                                                    </div>
                                                    
                                                    {diag.measurements && Object.keys(diag.measurements).length > 0 && (
                                                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mb-4 relative z-10">
                                                            {Object.entries(diag.measurements).map(([key, val]) => (
                                                                <div key={key} className="bg-white/80 dark:bg-slate-900/80 p-3 rounded-2xl border border-purple-100/80 dark:border-purple-900/40 text-left shadow-sm">
                                                                    <p className="text-[9px] uppercase font-black text-slate-500 mb-0.5">{key.replace(/([A-Z])/g, ' $1').trim()}</p>
                                                                    <p className="text-lg font-black text-purple-900 dark:text-purple-100 tracking-tight">{val as string | number}</p>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}

                                                    {diag.diagnostics && diag.diagnostics.length > 0 && (
                                                        <div className="mb-4 space-y-1 relative z-10">
                                                            <p className="text-[9px] font-black text-purple-600 dark:text-purple-400 uppercase tracking-widest mb-2">Automated Analysis</p>
                                                            {diag.diagnostics.map((d, index) => (
                                                                <p key={index} className="text-xs text-slate-700 dark:text-slate-300 font-bold flex items-center gap-2">
                                                                    <span className="w-1.5 h-1.5 bg-purple-400 rounded-full"></span> {d}
                                                                </p>
                                                            ))}
                                                        </div>
                                                    )}
                                                    
                                                    {diag.pdfReportUrl && (
                                                        <a href={diag.pdfReportUrl} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-2 text-[10px] w-full lg:w-auto font-black uppercase text-white bg-purple-600 hover:bg-purple-500 shadow-md shadow-purple-500/20 px-5 py-2.5 rounded-xl transition-all relative z-10">
                                                            <FileText size={14}/> Download Official PDF Report 
                                                        </a>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    {/* AI Quality Audits */}
                                    {job.qcAudits && job.qcAudits.length > 0 && (
                                        <div className="space-y-3">
                                            {job.qcAudits.map((audit, i) => (
                                                <div key={i} className={`p-5 rounded-3xl border-2 print:border-slate-200 print:bg-white ${
                                                    audit.status === 'pass' ? 'bg-emerald-50 border-emerald-100 dark:bg-emerald-900/10 dark:border-emerald-900/30' : 
                                                    audit.status === 'fail' ? 'bg-red-50 border-red-100 dark:bg-red-900/10 dark:border-red-900/30' : 
                                                    'bg-amber-50 border-amber-100 dark:bg-amber-900/10 dark:border-amber-900/30'
                                                }`}>
                                                    <div className="flex items-start gap-4">
                                                        {audit.imageUrl && (
                                                            <div className="w-20 h-20 rounded-2xl overflow-hidden shadow-sm border border-white dark:border-slate-800 flex-shrink-0 print:border-slate-200">
                                                                <img src={audit.imageUrl} className="w-full h-full object-cover" alt="QC Visual" />
                                                            </div>
                                                        )}
                                                        <div className="flex-1">
                                                            <div className="flex justify-between items-center mb-1">
                                                                <h5 className="text-[10px] font-black text-primary-500 uppercase tracking-tighter">AI Visual QC Audit</h5>
                                                                <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full ${
                                                                    audit.status === 'pass' ? 'bg-emerald-500 text-white' : 
                                                                    audit.status === 'fail' ? 'bg-red-500 text-white' : 
                                                                    'bg-amber-500 text-white'
                                                                }`}>
                                                                    {audit.status}
                                                                </span>
                                                            </div>
                                                            <p className="text-xs text-slate-700 dark:text-slate-300 font-bold leading-relaxed print:text-black">{audit.comments}</p>
                                                            <p className="text-[8px] text-slate-400 mt-2 uppercase font-bold">{new Date(audit.timestamp).toLocaleString()}</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* Parts Used */}
                                    {job.partsUsed && job.partsUsed.length > 0 && (
                                        <div className="p-5 bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 rounded-3xl print:bg-white print:border-slate-200">
                                            <p className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                                                 <Package size={14}/> Parts & Materials Consumed
                                            </p>
                                            <div className="space-y-2">
                                                {job.partsUsed.map((part, i) => (
                                                    <div key={i} className="flex justify-between items-center text-xs bg-white/50 dark:bg-slate-800/50 p-3 rounded-xl border border-blue-100/50 dark:border-blue-900/20 print:border-slate-200">
                                                        <div>
                                                            <span className="font-bold text-slate-700 dark:text-slate-300 print:text-black">{part.name}</span>
                                                            <p className="text-[8px] text-blue-500 uppercase font-black">Location: {part.location || 'Truck Stock'}</p>
                                                        </div>
                                                        <span className="font-black text-blue-700 dark:text-blue-300 print:text-black">Qty: {part.quantity}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Refrigerant Log */}
                                    {job.refrigerantLog && job.refrigerantLog.length > 0 && (
                                        <div className="p-5 bg-indigo-50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-900/30 rounded-3xl print:bg-white print:border-slate-200">
                                            <p className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                                                 <Droplets size={14}/> Refrigerant Management Log
                                            </p>
                                            <div className="space-y-2">
                                                {job.refrigerantLog.map((entry, i) => (
                                                    <div key={i} className="flex justify-between items-center text-xs bg-white/50 dark:bg-slate-800/50 p-3 rounded-xl border border-indigo-100/50 dark:border-indigo-900/20 print:border-slate-200">
                                                        <div>
                                                            <span className="font-bold text-slate-700 dark:text-slate-300 print:text-black">{entry.type} {entry.action}</span>
                                                            {entry.cylinderNumber && <p className="text-[8px] text-indigo-500 uppercase font-black">Cylinder: {entry.cylinderNumber}</p>}
                                                        </div>
                                                        <span className="font-black text-indigo-700 dark:text-indigo-300 print:text-black">{entry.amount} {entry.unit || 'lbs'}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Tool Readings */}
                                    {job.toolReadings && job.toolReadings.length > 0 && (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            {job.toolReadings.map((reading, i) => (
                                                <div key={i} className="p-4 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl flex items-center gap-4 shadow-sm print:border-slate-200">
                                                    <div className="w-10 h-10 rounded-2xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-primary-500 print:hidden">
                                                        <Thermometer size={18}/>
                                                    </div>
                                                    <div>
                                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">{reading.toolType}</p>
                                                        <p className="text-sm font-black text-slate-800 dark:text-white print:text-black">{reading.summary}</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </section>
                        )}
                    </div>

                    {/* Right Column: Financials & Documentation */}
                    <div className="space-y-8">
                        {/* Financial Summary */}
                        <section className="bg-emerald-50 dark:bg-emerald-900/10 p-6 rounded-[2.5rem] border border-emerald-100 dark:border-emerald-900/30 shadow-sm relative overflow-hidden print:bg-white print:border-slate-200">
                            <div className="absolute top-0 right-0 p-8 opacity-10 print:hidden">
                                <DollarSign size={80} className="text-emerald-900 dark:text-emerald-100" />
                            </div>
                            
                            <div className="relative z-10">
                                <div className="flex justify-between items-center mb-4">
                                    <p className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest print:text-slate-600">Job Invoice Total</p>
                                    {isAdmin && onEditInvoice && (
                                        <button onClick={onEditInvoice} className="text-[10px] text-primary-600 hover:underline font-black uppercase tracking-tighter print:hidden">Adjust Invoice</button>
                                    )}
                                </div>
                                <p className="text-4xl font-black text-emerald-900 dark:text-emerald-100 tracking-tight mb-4 print:text-black">
                                    ${(job.invoice?.totalAmount || 0).toFixed(2)}
                                </p>
                                
                                <div className="flex items-center gap-2 mb-6">
                                    <span className={`px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest shadow-sm print:border print:border-slate-300 ${
                                        job.invoice?.status === 'Paid' ? 'bg-emerald-500 text-white' : 'bg-amber-500 text-white'
                                    }`}>
                                        {job.invoice?.status || 'Unpaid'}
                                    </span>
                                    {job.invoice?.paidDate && (
                                        <span className="text-[10px] text-emerald-700 dark:text-emerald-500 font-bold uppercase truncate print:text-black">
                                            Paid {new Date(job.invoice.paidDate).toLocaleDateString()}
                                        </span>
                                    )}
                                </div>

                                {/* Line Items Preview */}
                                {job.invoice?.items && job.invoice.items.length > 0 && (
                                    <div className="space-y-2 border-t border-emerald-200/50 dark:border-emerald-900/30 pt-4 max-h-48 overflow-y-auto pr-2 scrollbar-thin print:max-h-none print:overflow-visible">
                                        {job.invoice.items.map((item, i) => (
                                            <div key={i} className="flex justify-between items-start text-[11px]">
                                                <div className="flex-1 pr-2">
                                                    <p className="font-black text-emerald-900 dark:text-emerald-200 uppercase print:text-black">{item.name || item.description}</p>
                                                    <p className="text-slate-500 italic">Qty: {item.quantity}</p>
                                                </div>
                                                <p className="font-bold text-emerald-800 dark:text-emerald-300 print:text-black">${item.total.toFixed(2)}</p>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Customer Signature for Invoice */}
                                {job.invoiceSignature && (
                                    <div className="mt-6 pt-4 border-t border-emerald-200/50 dark:border-emerald-900/30">
                                         <p className="text-[8px] font-black text-emerald-600 uppercase mb-2 tracking-widest">Customer Approval Signature</p>
                                         <div className="bg-white/50 p-2 rounded-xl border border-emerald-100/50 dark:bg-slate-800/50 dark:border-emerald-900/20">
                                            <img src={job.invoiceSignature} className="h-16 object-contain mix-blend-multiply dark:invert" alt="Invoice Signature" />
                                            {job.invoiceSignedDate && <p className="text-[8px] text-slate-400 mt-1 uppercase font-bold text-right">{new Date(job.invoiceSignedDate).toLocaleString()}</p>}
                                         </div>
                                    </div>
                                )}
                            </div>
                        </section>

                        {/* Warranty Coverage */}
                        {((job.invoice as Record<string, unknown>)?.workmanshipWarrantyMonths as number > 0 || (job.invoice as Record<string, unknown>)?.partsWarrantyMonths as number > 0) && (() => {
                            const inv = job.invoice as Record<string, unknown>;
                            const wm: number = (inv?.workmanshipWarrantyMonths as number) || 0;
                            const pm: number = (inv?.partsWarrantyMonths as number) || 0;
                            const agreed: boolean = !!inv?.warrantyDisclaimerAgreed;
                            const issued = inv?.warrantyIssuedDate ? new Date(inv.warrantyIssuedDate as string) : new Date(job.appointmentTime);
                            const now = new Date();
                            const addMonths = (d: Date, m: number) => { const r = new Date(d); r.setMonth(r.getMonth() + m); return r; };
                            const wmExpiry = wm > 0 ? addMonths(issued, wm) : null;
                            const pmExpiry = pm > 0 ? addMonths(issued, pm) : null;
                            const monthsLeft = (d: Date | null) => d ? Math.max(0, Math.round((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 30.44))) : 0;
                            const wmActive = agreed && !!wmExpiry && wmExpiry > now;
                            const pmActive = agreed && !!pmExpiry && pmExpiry > now;

                            const getWidthClass = (percent: number) => {
                                if (percent <= 0) return 'w-0';
                                if (percent <= 10) return 'w-[10%]';
                                if (percent <= 20) return 'w-[20%]';
                                if (percent <= 30) return 'w-[30%]';
                                if (percent <= 40) return 'w-[40%]';
                                if (percent <= 50) return 'w-1/2';
                                if (percent <= 60) return 'w-[60%]';
                                if (percent <= 70) return 'w-[70%]';
                                if (percent <= 80) return 'w-[80%]';
                                if (percent <= 90) return 'w-[90%]';
                                return 'w-full';
                            };
                            return (
                                <section className="bg-blue-50 dark:bg-blue-900/10 p-6 rounded-[2.5rem] border border-blue-100 dark:border-blue-900/30 shadow-sm print:bg-white print:border-slate-200">
                                    <div className="flex items-center gap-2 mb-4">
                                        <Shield size={16} className="text-blue-600 dark:text-blue-400" />
                                        <p className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest">Warranty Coverage</p>
                                        {!agreed && (
                                            <span className="ml-auto px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[9px] font-black uppercase">Disclaimer Pending</span>
                                        )}
                                    </div>
                                    <div className="grid grid-cols-2 gap-3 mb-3">
                                        {wm > 0 && (
                                            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-blue-100 dark:border-blue-900/20">
                                                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Workmanship</p>
                                                <p className="text-2xl font-black text-slate-900 dark:text-white">
                                                    {wmActive ? monthsLeft(wmExpiry) : '—'}
                                                    {wmActive && <span className="text-xs font-bold text-slate-400 ml-1">mo left</span>}
                                                </p>
                                                {wmExpiry && <p className="text-[9px] text-slate-400 mt-1">{wmActive ? `Exp. ${wmExpiry.toLocaleDateString()}` : `Expired ${wmExpiry.toLocaleDateString()}`}</p>}
                                                <div className="mt-2 h-1 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                                                    <div className={`h-full rounded-full ${wmActive ? 'bg-blue-500' : 'bg-slate-300'} ${getWidthClass(wmActive ? Math.min(100, (monthsLeft(wmExpiry) / wm) * 100) : 0)}`} />
                                                </div>
                                            </div>
                                        )}
                                        {pm > 0 && (
                                            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-blue-100 dark:border-blue-900/20">
                                                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Parts</p>
                                                <p className="text-2xl font-black text-slate-900 dark:text-white">
                                                    {pmActive ? monthsLeft(pmExpiry) : '—'}
                                                    {pmActive && <span className="text-xs font-bold text-slate-400 ml-1">mo left</span>}
                                                </p>
                                                {pmExpiry && <p className="text-[9px] text-slate-400 mt-1">{pmActive ? `Exp. ${pmExpiry.toLocaleDateString()}` : `Expired ${pmExpiry.toLocaleDateString()}`}</p>}
                                                <div className="mt-2 h-1 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                                                    <div className={`h-full rounded-full ${pmActive ? 'bg-emerald-500' : 'bg-slate-300'} ${getWidthClass(pmActive ? Math.min(100, (monthsLeft(pmExpiry) / pm) * 100) : 0)}`} />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    {inv?.warrantyNotes && (
                                        <p className="text-[10px] text-slate-500 dark:text-slate-400 italic border-t border-blue-100 dark:border-blue-900/20 pt-3 mt-1">{inv.warrantyNotes as string}</p>
                                    )}
                                    {!agreed && (
                                        <p className="text-[10px] text-amber-600 font-bold mt-2">⚠️ Warranty not yet active — disclaimer agreement required.</p>
                                    )}
                                </section>
                            );
                        })()}

                        {photoFiles.length > 0 && (
                            <section className="print:hidden">
                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Job Photos</h4>
                                <div className="space-y-4">
                                    {Object.entries(groupedPhotos).map(([label, photos]) => (
                                        <div key={label}>
                                            <p className="text-[10px] font-bold text-slate-500 uppercase mb-2 border-b border-slate-100 dark:border-slate-800 pb-1 inline-block">{label}</p>
                                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                                {(photos as ExtendedFile[]).map((f: ExtendedFile, i: number) => (
                                                    <div key={i} className="relative group">
                                                        <a href={f.dataUrl || f.url} target="_blank" rel="noreferrer" className="aspect-square bg-white dark:bg-slate-800 rounded-2xl overflow-hidden hover:ring-2 hover:ring-primary-500 transition-all block shadow-sm border border-slate-100 dark:border-slate-800">
                                                            <img src={f.dataUrl || f.url} className="w-full h-full object-cover" alt={`Job Documentation - ${label}`} />
                                                        </a>
                                                        {isAdmin && (
                                                            <button 
                                                                onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDeletePhoto(f); }}
                                                                className="absolute top-2 right-2 p-1.5 bg-red-600/90 text-white rounded-full transition-all shadow-lg backdrop-blur-sm hover:bg-red-700 hover:scale-110 z-10"
                                                                title="Delete Photo"
                                                            >
                                                                <Trash2 size={12}/>
                                                            </button>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </section>
                        )}

                        {/* Signed Documents & Waivers */}
                        {(docFiles.length > 0 || (job.embeddedData?.waivers && job.embeddedData.waivers.length > 0) || proposal) && (
                            <section className="space-y-3">
                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                    <ShieldCheck size={14} className="text-primary-500"/> Legal & Compliance
                                </h4>
                                <div className="space-y-2">
                                    {/* Signed Proposal */}
                                    {proposal && (() => {
                                        const sig = (proposal as Record<string, unknown>).signatureDataUrl || (proposal as Record<string, unknown>).signatureImage || (proposal as Record<string, unknown>).signature;
                                        const isSigned = !!sig;
                                        return (
                                            <button onClick={() => setPreviewDoc({ ...proposal, type: 'Proposal', title: isSigned ? 'Signed Proposal' : 'Proposal' })} className="w-full text-left p-3 px-4 bg-indigo-50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-900/30 rounded-xl text-[10px] font-black uppercase text-indigo-600 dark:text-indigo-400 flex items-center justify-between hover:bg-primary-50 hover:text-primary-500 transition-all shadow-sm">
                                                <span className="flex items-center gap-2"><FileText size={12}/> {isSigned ? 'Signed Proposal' : 'Proposal'}</span>
                                                <span className={isSigned ? "text-emerald-500 font-bold" : "text-amber-500 font-bold"}>{isSigned ? 'SIGNED' : 'UNSIGNED'}</span>
                                            </button>
                                        );
                                    })()}

                                    {/* Waivers from Embedded Data */}
                                    {(job.embeddedData?.waivers as Record<string, unknown>[])?.map((waiver: Record<string, unknown>, i: number) => (
                                        <button key={i} onClick={() => setPreviewDoc({ ...waiver, type: 'Other' })} className="w-full text-left p-3 px-4 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl text-[10px] font-black uppercase text-slate-600 dark:text-slate-400 flex items-center justify-between hover:bg-primary-50 hover:text-primary-500 transition-all shadow-sm">
                                            <span className="flex items-center gap-2"><FileText size={12}/> {waiver.title as string}</span>
                                            <span className="text-emerald-500 font-bold">{waiver.signatureImage ? 'SIGNED' : 'REQUIRED'}</span>
                                        </button>
                                    ))}
                                    {/* Other Document Files */}
                                    {docFiles.map((file, i) => {
                                        const isHtml = file.fileName?.toLowerCase().endsWith('.html') || (file as ExtendedFile).dataUrl?.includes('text/html');
                                        if (isHtml) {
                                            return (
                                                <button key={i} onClick={() => setPreviewDoc({ ...file, type: 'Other', title: file.fileName || 'Signed Document' })} className="w-full text-left p-3 px-4 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl text-[10px] font-black uppercase text-slate-600 dark:text-slate-400 flex items-center justify-between hover:bg-primary-50 hover:text-primary-500 transition-all shadow-sm">
                                                    <span className="flex items-center gap-2"><FileText size={12}/> {file.fileName || 'Signed Document'}</span>
                                                    <span className="text-emerald-500 font-bold">VIEW</span>
                                                </button>
                                            );
                                        }
                                        return (
                                            <a key={i} href={(file as ExtendedFile).dataUrl || (file as ExtendedFile).url} target="_blank" rel="noreferrer" className="w-full text-left p-3 px-4 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl text-[10px] font-black uppercase text-slate-600 dark:text-slate-400 flex items-center gap-2 hover:bg-primary-50 hover:text-primary-500 transition-all shadow-sm">
                                                <FileText size={12}/> {file.fileName || file.metadata?.label || 'Document'}
                                            </a>
                                        );
                                    })}
                                </div>
                            </section>
                        )}
                        
                        {/* Proposal Link */}
                        {job.projectId && !proposal && (
                            <section className="p-4 bg-indigo-50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-900/30 rounded-3xl shadow-sm">
                                <h4 className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                                    <FileText size={14}/> Job Proposal / Estimate
                                </h4>
                                <a href={`/#/${isAdmin ? 'admin' : 'briefing'}/proposal?proposalId=${job.projectId}`} target="_blank" rel="noreferrer" className="text-xs text-primary-600 hover:underline font-bold">
                                    View Original Proposal Context
                                </a>
                            </section>
                        )}

                        {/* Payment Details / Receipt */}
                        {['Paid', 'Refunded', 'Disputed'].includes(job.invoice?.status || '') && (
                            <section className="p-4 bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/30 rounded-3xl shadow-sm print:hidden">
                                <h4 className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                                    <DollarSign size={14}/> Payment Confirmation {job.invoice?.status === 'Refunded' ? '(REFUNDED)' : job.invoice?.status === 'Disputed' ? '(DISPUTED)' : ''}
                                </h4>
                                <div className="space-y-1">
                                    <p className="text-[10px] text-slate-500 font-bold uppercase">Method: {job.invoice.paymentMethod || 'Credit Card'}</p>
                                    <p className="text-[10px] text-slate-500 font-bold uppercase">Transaction: {job.id.slice(-8).toUpperCase()}</p>
                                    <button className="text-[10px] text-primary-600 hover:underline font-black uppercase mt-2">Download Official Receipt</button>
                                    
                                    {isAdmin && job.invoice?.status === 'Paid' && job.invoice?.paymentIntentId && (
                                        <div className="mt-4 pt-4 border-t border-emerald-200/50 dark:border-emerald-900/30">
                                            <Button 
                                                variant="danger" 
                                                size="sm"
                                                onClick={handleRefund}
                                                disabled={isRefunding}
                                                className="w-full sm:w-auto text-[10px] uppercase tracking-widest font-black"
                                            >
                                                {isRefunding ? 'Processing...' : 'Issue Refund'}
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            </section>
                        )}
                    </div>
                </div>
            </div>
        </Modal>

        {/* Document Preview Modal */}
        {previewDoc && (
            <DocumentPreview 
                type={(previewDoc.type as 'Other' | 'Proposal' | 'Invoice') || 'Other'} 
                data={previewDoc} 
                onClose={() => setPreviewDoc(null)} 
            />
        )}
        </>
    );
};

export default JobDetailModal;
