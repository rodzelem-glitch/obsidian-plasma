
import React from 'react';
import Modal from 'components/ui/Modal';
import Button from 'components/ui/Button';
import { 
    Printer, FileText, Clock, MapPin, Wrench, CheckCircle, 
    DollarSign, ShieldCheck, AlertTriangle, Thermometer, Droplets
} from 'lucide-react';
import { formatAddress } from 'lib/utils';
import type { Job } from 'types';

interface JobDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    job: Job;
    isAdmin?: boolean;
    onEditInvoice?: () => void;
    onEditRecord?: () => void;
    onPrint?: () => void;
}

const JobDetailModal: React.FC<JobDetailModalProps> = ({ 
    isOpen, onClose, job, isAdmin = false, onEditInvoice, onEditRecord, onPrint 
}) => {
    if (!job) return null;
    
    const photoFiles = (job.files || []).filter(f => f.fileType?.startsWith('image/') || f.dataUrl?.startsWith('data:image/'));
    const docFiles = (job.files || []).filter(f => !f.fileType?.startsWith('image/') && !f.dataUrl?.startsWith('data:image/'));

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Complete Job Record" size="lg">
            <div className="space-y-8 pb-8">
                {/* Header Information */}
                <div className="flex justify-between items-start border-b border-slate-100 dark:border-slate-800 pb-6">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                             <h3 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">{job.customerName}</h3>
                             <span className={`px-3 py-1 text-[10px] font-black uppercase tracking-widest rounded-full ${
                                 job.jobStatus === 'Completed' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300' : 
                                 job.jobStatus === 'In Progress' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300' : 
                                 'bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-400'
                             }`}>
                                 {job.jobStatus}
                             </span>
                        </div>
                        <p className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-1.5 font-medium">
                            <MapPin size={14} className="text-slate-400"/> {formatAddress(job.address)}
                        </p>
                        <p className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mt-1 font-medium">
                            <Clock size={14} className="text-slate-400"/> {new Date(job.appointmentTime).toLocaleString()}
                        </p>
                        <p className="text-xs text-primary-600 font-bold mt-2 uppercase tracking-wide">
                            Tech: {job.assignedTechnicianName || 'Unassigned'}
                        </p>
                    </div>
                    <div className="flex gap-2">
                        {onPrint && (
                            <Button onClick={onPrint} variant="secondary" className="flex items-center gap-2 text-[10px] uppercase font-black tracking-widest px-4">
                                <Printer size={16}/> Print Report
                            </Button>
                        )}
                        {isAdmin && onEditRecord && (
                            <Button onClick={onEditRecord} className="flex items-center gap-2 text-[10px] uppercase font-black tracking-widest px-4 shadow-lg shadow-primary-500/20">
                                Edit Record
                            </Button>
                        )}
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Left Column: Notes & Tasks */}
                    <div className="lg:col-span-2 space-y-8">
                        {/* Tasks Section */}
                        <section className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm">
                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                <CheckCircle size={14} className="text-emerald-500"/> Tasks Performed
                            </h4>
                            <div className="flex flex-wrap gap-2">
                                {job.tasks.map((t, i) => (
                                    <span key={i} className="px-4 py-2 bg-white dark:bg-slate-800 rounded-2xl text-xs font-bold text-slate-700 dark:text-slate-200 shadow-sm border border-slate-100 dark:border-slate-700">
                                        {t}
                                    </span>
                                ))}
                            </div>
                        </section>

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
                                        <div key={idx} className="p-5 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl shadow-sm">
                                            <p className="text-[10px] font-black text-primary-500 uppercase tracking-tighter mb-2">{note.label}</p>
                                            <p className="text-sm text-slate-600 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">{note.value}</p>
                                        </div>
                                    );
                                })}
                                {(!job.notes || Object.values(job.notes).every(v => !v)) && (
                                    <p className="text-xs text-slate-400 italic col-span-2 p-4 text-center">No field notes were recorded for this service.</p>
                                )}
                            </div>
                        </section>

                        {/* Refrigerant & Technical Data */}
                        {( (job.refrigerantLog && job.refrigerantLog.length > 0) || (job.toolReadings && job.toolReadings.length > 0) ) && (
                            <section className="space-y-4">
                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                    <Wrench size={14}/> Technical & Environmental Data
                                </h4>
                                <div className="space-y-3">
                                    {/* Refrigerant Log */}
                                    {job.refrigerantLog && job.refrigerantLog.length > 0 && (
                                        <div className="p-5 bg-indigo-50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-900/30 rounded-3xl">
                                            <p className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                                                 <Droplets size={14}/> Refrigerant Management Log
                                            </p>
                                            <div className="space-y-2">
                                                {job.refrigerantLog.map((entry, i) => (
                                                    <div key={i} className="flex justify-between items-center text-xs bg-white/50 dark:bg-slate-800/50 p-3 rounded-xl border border-indigo-100/50 dark:border-indigo-900/20">
                                                        <span className="font-bold text-slate-700 dark:text-slate-300">{entry.type} {entry.action}</span>
                                                        <span className="font-black text-indigo-700 dark:text-indigo-300">{entry.amount} {entry.unit}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Tool Readings */}
                                    {job.toolReadings && job.toolReadings.length > 0 && (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            {job.toolReadings.map((reading, i) => (
                                                <div key={i} className="p-4 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl flex items-center gap-4 shadow-sm">
                                                    <div className="w-10 h-10 rounded-2xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-primary-500">
                                                        <Thermometer size={18}/>
                                                    </div>
                                                    <div>
                                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">{reading.toolType}</p>
                                                        <p className="text-sm font-black text-slate-800 dark:text-white">{reading.summary}</p>
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
                        <section className="bg-emerald-50 dark:bg-emerald-900/10 p-6 rounded-[2.5rem] border border-emerald-100 dark:border-emerald-900/30 shadow-sm relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-8 opacity-10">
                                <DollarSign size={80} className="text-emerald-900 dark:text-emerald-100" />
                            </div>
                            
                            <div className="relative z-10">
                                <div className="flex justify-between items-center mb-4">
                                    <p className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">Job Invoice Total</p>
                                    {isAdmin && onEditInvoice && (
                                        <button onClick={onEditInvoice} className="text-[10px] text-primary-600 hover:underline font-black uppercase tracking-tighter">Adjust Invoice</button>
                                    )}
                                </div>
                                <p className="text-4xl font-black text-emerald-900 dark:text-emerald-100 tracking-tight mb-4">
                                    ${(job.invoice?.totalAmount || 0).toFixed(2)}
                                </p>
                                
                                <div className="flex items-center gap-2 mb-6">
                                    <span className={`px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest shadow-sm ${
                                        job.invoice?.status === 'Paid' ? 'bg-emerald-500 text-white' : 'bg-amber-500 text-white'
                                    }`}>
                                        {job.invoice?.status || 'Unpaid'}
                                    </span>
                                    {job.invoice?.paidDate && (
                                        <span className="text-[10px] text-emerald-700 dark:text-emerald-500 font-bold uppercase truncate">
                                            Paid {new Date(job.invoice.paidDate).toLocaleDateString()}
                                        </span>
                                    )}
                                </div>

                                {/* Line Items Preview */}
                                {job.invoice?.items && job.invoice.items.length > 0 && (
                                    <div className="space-y-2 border-t border-emerald-200/50 dark:border-emerald-900/30 pt-4 max-h-48 overflow-y-auto pr-2 scrollbar-thin">
                                        {job.invoice.items.map((item, i) => (
                                            <div key={i} className="flex justify-between items-start text-[11px]">
                                                <div className="flex-1 pr-2">
                                                    <p className="font-black text-emerald-900 dark:text-emerald-200 uppercase">{item.name || item.description}</p>
                                                    <p className="text-slate-500 italic">Qty: {item.quantity}</p>
                                                </div>
                                                <p className="font-bold text-emerald-800 dark:text-emerald-300">${item.total.toFixed(2)}</p>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </section>

                        {/* Photo Gallery */}
                        {photoFiles.length > 0 && (
                            <section>
                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Job Photos</h4>
                                <div className="grid grid-cols-2 gap-2">
                                    {photoFiles.map((f, i) => (
                                        <a key={i} href={f.dataUrl || (f as any).url} target="_blank" rel="noreferrer" className="aspect-square bg-white dark:bg-slate-800 rounded-2xl overflow-hidden hover:ring-2 hover:ring-primary-500 transition-all block relative shadow-sm border border-slate-100 dark:border-slate-800">
                                            <img src={f.dataUrl || (f as any).url} className="w-full h-full object-cover" alt="Job Documentation" />
                                        </a>
                                    ))}
                                </div>
                            </section>
                        )}

                        {/* Signed Documents & Waivers */}
                        {(docFiles.length > 0 || (job.embeddedData?.waivers && job.embeddedData.waivers.length > 0)) && (
                            <section className="space-y-3">
                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                    <ShieldCheck size={14} className="text-primary-500"/> Legal & Compliance
                                </h4>
                                <div className="space-y-2">
                                    {/* Waivers from Embedded Data */}
                                    {job.embeddedData?.waivers?.map((waiver, i) => (
                                        <button key={i} className="w-full text-left p-3 px-4 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl text-[10px] font-black uppercase text-slate-600 dark:text-slate-400 flex items-center justify-between hover:bg-primary-50 hover:text-primary-500 transition-all shadow-sm">
                                            <span className="flex items-center gap-2"><FileText size={12}/> {waiver.title}</span>
                                            <span className="text-emerald-500 font-bold">SIGNED</span>
                                        </button>
                                    ))}
                                    {/* Other Document Files */}
                                    {docFiles.map((file, i) => (
                                        <a key={i} href={file.dataUrl || (file as any).url} target="_blank" rel="noreferrer" className="w-full text-left p-3 px-4 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl text-[10px] font-black uppercase text-slate-600 dark:text-slate-400 flex items-center gap-2 hover:bg-primary-50 hover:text-primary-500 transition-all shadow-sm">
                                            <FileText size={12}/> {file.fileName || file.metadata?.label || 'Document'}
                                        </a>
                                    ))}
                                </div>
                            </section>
                        )}
                        
                        {/* Proposal Link */}
                        {job.projectId && (
                            <section className="p-4 bg-indigo-50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-900/30 rounded-3xl shadow-sm">
                                <h4 className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                                    <FileText size={14}/> Job Proposal / Estimate
                                </h4>
                                <a href={`/proposal?id=${job.projectId}`} target="_blank" rel="noreferrer" className="text-xs text-primary-600 hover:underline font-bold">
                                    View Original Proposal Context
                                </a>
                            </section>
                        )}

                        {/* Payment Details / Receipt */}
                        {job.invoice?.status === 'Paid' && (
                            <section className="p-4 bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/30 rounded-3xl shadow-sm">
                                <h4 className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                                    <DollarSign size={14}/> Payment Confirmation
                                </h4>
                                <div className="space-y-1">
                                    <p className="text-[10px] text-slate-500 font-bold uppercase">Method: {job.invoice.paymentMethod || 'Credit Card'}</p>
                                    <p className="text-[10px] text-slate-500 font-bold uppercase">Transaction: {job.id.slice(-8).toUpperCase()}</p>
                                    <button className="text-[10px] text-primary-600 hover:underline font-black uppercase mt-2">Download Official Receipt</button>
                                </div>
                            </section>
                        )}
                    </div>
                </div>
            </div>
        </Modal>
    );
};

export default JobDetailModal;
