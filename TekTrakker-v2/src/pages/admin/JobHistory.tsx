
import React, { useState, useMemo, useEffect } from 'react';
import { useAppContext } from 'context/AppContext';
import { useConfirm } from 'context/ConfirmContext';
import Card from 'components/ui/Card';
import Table from 'components/ui/Table';
import Button from 'components/ui/Button';
import Select from 'components/ui/Select';
import Modal from 'components/ui/Modal';
import { db } from 'lib/firebase';
import type { Job } from 'types';
import InvoiceEditorModal from 'components/modals/InvoiceEditorModal';
import JobDetailModal from 'components/modals/JobDetailModal';
import { Printer, FileText, Edit, Trash2, CheckCircle, Clock, MapPin, Wrench, Share2, Copy } from 'lucide-react';
import Textarea from 'components/ui/Textarea';
import { formatAddress } from 'lib/utils';
import { useSearchParams } from 'react-router-dom';

const JobHistory: React.FC = () => {
    const { state, dispatch } = useAppContext();
    const { confirm } = useConfirm();
    const [searchParams] = useSearchParams();
    
    const [viewJob, setViewJob] = useState<Job | null>(null);
    const [techFilter, setTechFilter] = useState('');
    const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
    
    // Edit State for View Modal
    const [isEditing, setIsEditing] = useState(false);
    const [editNotes, setEditNotes] = useState('');
    const [editStatus, setEditStatus] = useState<string>('');

    // Share Management
    const [shareModalJob, setShareModalJob] = useState<Job | null>(null);
    const [shareTargetId, setShareTargetId] = useState<string>('');
    const [shareMessageText, setShareMessageText] = useState('');
    const [isSharing, setIsSharing] = useState(false);

    // Pagination
    const [page, setPage] = useState(1);
    const itemsPerPage = 20;

    const employees = useMemo(() => state.users.filter(u => 
        u.organizationId === state.currentOrganization?.id && 
        (u.role === 'employee' || u.role === 'both' || u.role === 'supervisor' || u.role === 'Technician' || u.role === 'Subcontractor')
    ), [state.users, state.currentOrganization]);

    const filteredJobs = useMemo(() => {
        let jobs = (state.jobs as Job[]) || [];
        if (techFilter) {
            jobs = jobs.filter(j => j.assignedTechnicianId === techFilter);
        }
        return [...jobs].sort((a,b) => new Date(b.appointmentTime).getTime() - new Date(a.appointmentTime).getTime());
    }, [state.jobs, techFilter]);

    const displayedJobs = useMemo(() => {
        return filteredJobs.slice(0, page * itemsPerPage);
    }, [filteredJobs, page]);

    const hasMore = displayedJobs.length < filteredJobs.length;

    const handleViewJob = (job: Job) => {
        setViewJob(job);
        setEditNotes(job.notes?.internalNotes || '');
        setEditStatus(job.jobStatus);
        setIsEditing(false);
    };

    useEffect(() => {
        const histId = searchParams.get('histId');
        if (histId && state.jobs.length > 0) {
            const targetJob = state.jobs.find(j => j.id === histId);
            if (targetJob) {
                handleViewJob(targetJob);
                setTimeout(() => {
                    const el = document.getElementById(`hist-row-${histId}`);
                    if (el) {
                        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        el.classList.add('bg-blue-500/20', 'transition-colors', 'duration-1000');
                        setTimeout(() => el.classList.remove('bg-blue-500/20'), 3000);
                    }
                }, 100);
            }
        }
    }, [searchParams, state.jobs]);

    const handleSaveChanges = async () => {
        if (!viewJob) return;
        const updatedJob = {
            ...viewJob,
            jobStatus: editStatus as any,
            notes: {
                ...viewJob.notes,
                internalNotes: editNotes
            }
        };

        try {
            await db.collection('jobs').doc(viewJob.id).update({
                jobStatus: editStatus,
                'notes.internalNotes': editNotes
            });
            dispatch({ type: 'UPDATE_JOB', payload: updatedJob });
            setViewJob(updatedJob);
            setIsEditing(false);
            alert("Job record updated.");
        } catch (e) {
            alert("Failed to save changes.");
        }
    };

    const handleDeleteJob = async (jobId: string) => {
        if (await confirm('PERMANENTLY DELETE this job record? This cannot be undone.')) {
            try {
                await Promise.all([
                    db.collection('jobs').doc(jobId).delete().catch(() => {}),
                    db.collection('appointments').doc(jobId).delete().catch(() => {})
                ]);
                dispatch({ type: 'DELETE_JOB', payload: jobId });
                if (viewJob?.id === jobId) setViewJob(null);
            } catch (error) {
                alert("Failed to delete job.");
            }
        }
    };

    const handleCopyRef = (jobId: string) => {
        navigator.clipboard.writeText(`#HIST-${jobId}`);
        alert("Reference Copied! Paste it anywhere to create a smart link.");
    };

    const handleShareJob = async () => {
        if (!shareModalJob || !shareTargetId) return;
        setIsSharing(true);
        try {
            const msgObj: any = {
                id: `msg-${Date.now()}`,
                senderId: state.currentUser?.id,
                senderName: `${state.currentUser?.firstName} ${state.currentUser?.lastName}`,
                receiverId: shareTargetId,
                content: `${shareMessageText ? shareMessageText + '\n\n' : ''}Check out this job history record: #HIST-${shareModalJob.id}`,
                timestamp: new Date().toISOString(),
                createdAt: new Date().toISOString(),
                organizationId: state.currentOrganization?.id,
                type: 'internal'
            };
            await db.collection('messages').doc(msgObj.id).set(msgObj);
            alert("Job shared successfully!");
            setShareModalJob(null);
            setShareMessageText('');
        } catch (e) {
            alert("Failed to share.");
        } finally {
            setIsSharing(false);
        }
    };
    
    const handleDeleteReading = async (readingId: string) => {
        if (!viewJob) return;
        if (!(await confirm("Delete this technical reading?"))) return;
        
        const updatedReadings = (viewJob.toolReadings || []).filter(r => r.id !== readingId);
        const updatedFiles = (viewJob.files || []).filter(f => f.metadata?.readingId !== readingId);
        
        try {
            const updatedJob = { ...viewJob, toolReadings: updatedReadings, files: updatedFiles };
            await db.collection('jobs').doc(viewJob.id).update({ 
                toolReadings: updatedReadings,
                files: updatedFiles
            });
            dispatch({ type: 'UPDATE_JOB', payload: updatedJob });
            setViewJob(updatedJob);
        } catch(e) {
            alert("Delete failed");
        }
    };

    const handlePrintReport = () => {
        if (!viewJob) return;
        const win = window.open('', '_blank');
        if (!win) return;
        
        const html = `
            <html>
            <head>
                <title>Service Report - ${viewJob.customerName}</title>
                <style>
                    body { font-family: sans-serif; padding: 40px; }
                    h1 { border-bottom: 2px solid #ccc; padding-bottom: 10px; }
                    .meta { margin: 20px 0; display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
                    .box { background: #f9f9f9; padding: 15px; border-radius: 8px; border: 1px solid #eee; }
                    .label { font-weight: bold; font-size: 0.8em; color: #666; text-transform: uppercase; }
                    .reading { margin-top: 10px; padding: 10px; border-left: 4px solid #0284c7; background: #f0f9ff; }
                </style>
            </head>
            <body>
                <h1>Service Record #${viewJob.id.slice(-6)}</h1>
                <div class="meta">
                    <div class="box">
                        <div class="label">Customer</div>
                        <div>${viewJob.customerName}</div>
                        <div>${formatAddress(viewJob.address)}</div>
                    </div>
                    <div class="box">
                        <div class="label">Job Details</div>
                        <div>Date: ${new Date(viewJob.appointmentTime).toLocaleDateString()}</div>
                        <div>Tech: ${viewJob.assignedTechnicianName || 'Unassigned'}</div>
                        <div>Status: ${viewJob.jobStatus}</div>
                    </div>
                </div>

                <h3>Work Overview</h3>
                <div class="box">
                    <div class="label">Tasks List</div>
                    <p>${viewJob.tasks.join(', ')}</p>
                    <div class="label">Technician Notes</div>
                    <p>${viewJob.notes?.employeeFeedback || 'No notes provided.'}</p>
                </div>

                ${viewJob.notes?.diagnosisChecklist ? `
                    <h3>Diagnosis Checklist</h3>
                    <ul>${JSON.parse(viewJob.notes.diagnosisChecklist).map((i: any) => `<li>[${i.completed ? 'X' : ' '}] ${i.label}</li>`).join('')}</ul>
                ` : ''}

                ${viewJob.partsUsed && viewJob.partsUsed.length > 0 ? `
                    <h3>Parts & Materials</h3>
                    <table style="width:100%; border-collapse: collapse;">
                        <tr style="background:#f4f4f4;"><th style="text-align:left; padding:5px;">Part</th><th style="padding:5px;">Qty</th><th style="padding:5px;">Price</th></tr>
                        ${viewJob.partsUsed.map((p: any) => `
                            <tr>
                                <td style="padding:5px; border-bottom:1px solid #eee;">${p.name} <br/><small>${p.sku}</small></td>
                                <td style="text-align:center; padding:5px; border-bottom:1px solid #eee;">${p.quantity}</td>
                                <td style="text-align:right; padding:5px; border-bottom:1px solid #eee;">$${(p.unitPrice || 0).toFixed(2)}</td>
                            </tr>
                        `).join('')}
                    </table>
                ` : ''}

                ${viewJob.refrigerantLog && viewJob.refrigerantLog.length > 0 ? `
                    <h3>Refrigerant Tracking</h3>
                    <table style="width:100%; border-collapse: collapse;">
                        <tr style="background:#f4f4f4;"><th style="text-align:left; padding:5px;">Type</th><th style="padding:5px;">Action</th><th style="padding:5px;">Amount</th><th style="padding:5px;">Cylinder</th></tr>
                        ${viewJob.refrigerantLog.map((r: any) => `
                            <tr>
                                <td style="padding:5px; border-bottom:1px solid #eee;">${r.type}</td>
                                <td style="padding:5px; border-bottom:1px solid #eee;">${r.action}</td>
                                <td style="text-align:center; padding:5px; border-bottom:1px solid #eee;">${r.amount} ${r.unit}</td>
                                <td style="padding:5px; border-bottom:1px solid #eee;">${r.cylinderNumber || 'N/A'}</td>
                            </tr>
                        `).join('')}
                    </table>
                ` : ''}
                
                ${viewJob.toolReadings && viewJob.toolReadings.length > 0 ? `
                    <h3>Technical Readings</h3>
                    ${viewJob.toolReadings.map(r => `
                        <div class="reading">
                            <strong>${r.toolType}:</strong> ${r.summary} <br/>
                            <small>${new Date(r.date).toLocaleString()}</small>
                        </div>
                    `).join('')}
                ` : ''}

                <h3>Financials</h3>
                <p>Total: $${(viewJob.invoice?.totalAmount || 0).toFixed(2)} (${viewJob.invoice?.status})</p>
                
                <div style="margin-top: 50px; font-size: 0.8em; text-align: center; color: #999;">Generated by TekTrakker</div>
            </body>
            </html>
        `;
        win.document.write(html);
        win.document.close();
        win.print();
    };

    return (
        <div className="space-y-6">
            {isInvoiceModalOpen && viewJob && (
                <InvoiceEditorModal 
                    isOpen={true} 
                    onClose={() => setIsInvoiceModalOpen(false)} 
                    jobId={viewJob.id} 
                />
            )}

            <JobDetailModal 
                isOpen={!!viewJob && !isInvoiceModalOpen && !isEditing} 
                onClose={() => setViewJob(null)} 
                job={viewJob as Job}
                isAdmin={true}
                onEditInvoice={() => setIsInvoiceModalOpen(true)}
                onEditRecord={() => setIsEditing(true)}
                onPrint={handlePrintReport}
            />

            <Modal isOpen={isEditing && !!viewJob} onClose={() => setIsEditing(false)} title="Edit Job Record" size="md">
                {viewJob && (
                    <div className="bg-primary-50 dark:bg-primary-900/10 p-4 rounded-lg border border-primary-100 dark:border-primary-800 space-y-4">
                        <Select label="Job Status" value={editStatus} onChange={e => setEditStatus(e.target.value)}>
                            <option value="Scheduled">Scheduled</option>
                            <option value="In Progress">In Progress</option>
                            <option value="Completed">Completed</option>
                        </Select>
                        <Textarea label="Internal Office Notes" value={editNotes} onChange={e => setEditNotes(e.target.value)} />
                        <div className="flex justify-end gap-2">
                            <Button variant="secondary" onClick={() => setIsEditing(false)}>Cancel</Button>
                            <Button onClick={handleSaveChanges}>Save Changes</Button>
                        </div>
                    </div>
                )}
            </Modal>

            <Modal isOpen={!!shareModalJob} onClose={() => setShareModalJob(null)} title={`Share Job Record: ${shareModalJob?.customerName}`}>
                 <div className="space-y-4">
                     <p className="text-sm text-slate-500">Send this job history to a staff member in your organization.</p>
                     <select 
                         aria-label="Select Share Recipient"
                         title="Select Share Recipient"
                         className="w-full border rounded-lg p-2 dark:bg-slate-800 dark:border-slate-700"
                         value={shareTargetId}
                         onChange={e => setShareTargetId(e.target.value)}
                     >
                         <option value="">Select Recipient...</option>
                         {state.users.filter((u: any) => 
                             u.organizationId === state.currentOrganization?.id && 
                             u.id !== state.currentUser?.id && 
                             u.role !== 'customer'
                         ).map((u: any) => (
                             <option key={u.id} value={u.id}>{u.firstName} {u.lastName} ({u.role})</option>
                         ))}
                     </select>
                     <Textarea 
                         placeholder="Add an optional message..."
                         value={shareMessageText}
                         onChange={e => setShareMessageText(e.target.value)}
                     />
                     <div className="flex justify-end gap-2">
                         <Button variant="secondary" onClick={() => setShareModalJob(null)}>Cancel</Button>
                         <Button onClick={handleShareJob} disabled={!shareTargetId || isSharing}>
                             {isSharing ? 'Sending...' : 'Send Message'}
                         </Button>
                     </div>
                 </div>
             </Modal>

            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight uppercase">Job History</h2>
                    <p className="text-slate-500 dark:text-slate-400 font-medium tracking-tight">Complete archive of service records and customer history.</p>
                </div>
            </header>

            <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                <Select label="Filter by Technician" value={techFilter} onChange={e => setTechFilter(e.target.value)}>
                    <option value="">All Technicians</option>
                    {employees.map(e => <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>)}
                </Select>
            </div>

            <Card className="p-0 overflow-hidden border-slate-200 dark:border-slate-700 shadow-xl rounded-2xl">
                <Table headers={['Date', 'Customer', 'Service', 'Tech', 'Status', 'Invoice', 'Actions']}>
                    {displayedJobs.map(job => (
                        <tr key={job.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-all cursor-pointer border-b border-slate-100 dark:border-slate-700/50" onClick={() => handleViewJob(job)}>
                            <td className="px-6 py-4 text-slate-600 dark:text-slate-400 text-xs font-bold uppercase tracking-tighter">{new Date(job.appointmentTime).toLocaleDateString()}</td>
                            <td className="px-6 py-4">
                                <div className="text-slate-900 dark:text-white font-black text-sm tracking-tight">{job.customerName}</div>
                                <div className="text-[10px] text-slate-400 font-medium uppercase tracking-tight truncate max-w-[150px]">{formatAddress(job.address)}</div>
                            </td>
                            <td className="px-6 py-4 text-slate-500 dark:text-slate-400 text-sm font-medium max-w-xs truncate italic">"{job.tasks.join(', ')}"</td>
                            <td className="px-6 py-4 text-slate-700 dark:text-slate-300 text-xs font-bold">{job.assignedTechnicianName || '-'}</td>
                            <td className="px-6 py-4">
                                <span className={`px-2.5 py-1 text-[10px] font-black uppercase tracking-widest rounded-full ${
                                    job.jobStatus === 'Completed' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300' : 
                                    job.jobStatus === 'In Progress' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300' : 
                                    'bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-400'
                                }`}>
                                    {job.jobStatus}
                                </span>
                            </td>
                            <td className="px-6 py-4">
                                <span className={`px-2.5 py-1 text-[10px] font-black uppercase tracking-widest rounded-full ${
                                    job.invoice?.status === 'Paid' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300' : 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
                                }`}>
                                    {job.invoice?.status || 'Unknown'}
                                </span>
                            </td>
                            <td className="px-6 py-4 flex gap-1.5 flex-wrap items-center">
                                <button aria-label="View Job Details" title="View Job Details" onClick={(e) => { e.stopPropagation(); handleViewJob(job); }} className="px-4 py-1.5 bg-primary-600 text-white text-[10px] font-black uppercase tracking-widest rounded-lg hover:bg-primary-700 transition-colors shadow-sm">View</button>
                                <button aria-label="Copy Reference" title="Copy Reference" onClick={(e) => { e.stopPropagation(); handleCopyRef(job.id); }} className="p-1 text-slate-400 hover:text-primary-600"><Copy size={16}/></button>
                                <button aria-label="Share Job" title="Share Job" onClick={(e) => { e.stopPropagation(); setShareModalJob(job); }} className="p-1 text-slate-400 hover:text-primary-600"><Share2 size={16}/></button>
                            </td>
                        </tr>
                    ))}
                    {displayedJobs.length === 0 && (
                        <tr><td colSpan={7} className="p-6 md:p-12 text-center text-slate-400 font-medium italic">No matching job history found.</td></tr>
                    )}
                </Table>
                
                {hasMore && (
                    <div className="p-6 text-center border-t border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50">
                        <button onClick={() => setPage(p => p + 1)} className="px-6 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-primary-600 dark:text-primary-400 font-black text-xs uppercase tracking-widest rounded-xl hover:shadow-md transition-all">
                            Load More Records
                        </button>
                    </div>
                )}
            </Card>
        </div>
    );
};

export default JobHistory;
