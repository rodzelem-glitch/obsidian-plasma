import showToast from "lib/toast";

import React, { useState, useMemo, useEffect } from 'react';
import { useAppContext } from 'context/AppContext';
import { useConfirm } from 'context/ConfirmContext';
import Card from 'components/ui/Card';
import Table from 'components/ui/Table';
import Button from 'components/ui/Button';
import Select from 'components/ui/Select';
import Modal from 'components/ui/Modal';
import Input from 'components/ui/Input';
import { db, firebase } from 'lib/firebase';
import type { Job } from 'types';
import InvoiceEditorModal from 'components/modals/InvoiceEditorModal';
import JobDetailModal from 'components/modals/JobDetailModal';
import JobLinkingModal from 'components/modals/JobLinkingModal';
import SendEmailModal from 'components/modals/SendEmailModal';
import { Printer, FileText, Edit, Trash2, CheckCircle, Clock, MapPin, Wrench, Share2, Copy, Search, X, Users, Link2, Send } from 'lucide-react';
import Textarea from 'components/ui/Textarea';
import { formatAddress , cleanUndefinedFields } from 'lib/utils';
import { useSearchParams } from 'react-router-dom';

const isPhoto = (file: any) => {
    return file.type === 'Photo' || 
           file.contentType?.startsWith('image/') || 
           file.fileType?.startsWith('image/');
};

const JobHistory: React.FC = () => {
    const { state, dispatch } = useAppContext();
    const { confirm } = useConfirm();
    const [searchParams] = useSearchParams();
    
    const [viewJob, setViewJob] = useState<Job | null>(null);
    const [techFilter, setTechFilter] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
    const [linkingJob, setLinkingJob] = useState<Job | null>(null);
    const [sendInvoiceModalConfig, setSendInvoiceModalConfig] = useState<{ isOpen: boolean; job: any | null }>({ isOpen: false, job: null });
    
    // Edit State for View Modal
    const [isEditing, setIsEditing] = useState(false);
    const [editNotes, setEditNotes] = useState('');
    const [editStatus, setEditStatus] = useState<string>('');
    const [editCheckIn, setEditCheckIn] = useState('');
    const [editCheckOut, setEditCheckOut] = useState('');
    const [editTimeOnSite, setEditTimeOnSite] = useState<number | ''>('');
    const [expandedJobs, setExpandedJobs] = useState<Set<string>>(new Set());

    const toggleJobDetails = (jobId: string) => {
        const next = new Set(expandedJobs);
        if (next.has(jobId)) {
            next.delete(jobId);
        } else {
            next.add(jobId);
        }
        setExpandedJobs(next);
    };

    // Format helper to local ISO-ish string without timezone suffix for <input type="datetime-local">
    const formatDateTimeForInput = (isoString?: string) => {
        if (!isoString) return '';
        const d = new Date(isoString);
        const offset = d.getTimezoneOffset();
        const localDate = new Date(d.getTime() - (offset * 60 * 1000));
        return localDate.toISOString().slice(0, 16);
    };

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

        const isAdmin = state.currentUser?.role === 'admin' || state.currentUser?.role === 'master_admin' || state.currentUser?.role === 'both';
        if (!isAdmin && state.currentUser) {
            const myTeams = (state.teams || []).filter(t => t.memberIds?.includes(state.currentUser!.id));
            if (myTeams.length > 0) {
                const teamMemberIds = new Set(myTeams.flatMap(t => t.memberIds || []));
                const teamCustomerIds = new Set(myTeams.flatMap(t => t.customerIds || []));
                jobs = jobs.filter((j: Job) => 
                    (j.assignedTechnicianId && teamMemberIds.has(j.assignedTechnicianId)) ||
                    (j.customerId && teamCustomerIds.has(j.customerId))
                );
            }
        }

        if (techFilter) {
            jobs = jobs.filter(j => j.assignedTechnicianId === techFilter);
        }
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase().trim();
            jobs = jobs.filter(j => {
                const idMatch = j.id?.toLowerCase().includes(query);
                const nameMatch = j.customerName?.toLowerCase().includes(query);
                const phoneMatch = j.customerPhone?.replace(/\D/g, '').includes(query.replace(/\D/g, ''));
                const emailMatch = j.customerEmail?.toLowerCase().includes(query);
                
                let addressMatch = false;
                if (j.address) {
                    if (typeof j.address === 'string') {
                        addressMatch = j.address.toLowerCase().includes(query);
                    } else {
                        const addr = j.address as any;
                        const addrStr = `${addr.street || ''} ${addr.city || ''} ${addr.state || ''} ${addr.zip || ''}`.toLowerCase();
                        addressMatch = addrStr.includes(query);
                    }
                }
                
                const invoiceIdMatch = j.invoice?.id?.toLowerCase().includes(query);
                const poNumberMatch = (j.invoice as any)?.poNumber?.toLowerCase().includes(query) || j.poNumber?.toLowerCase().includes(query);
                const proposalIdMatch = j.proposalId?.toLowerCase().includes(query);
                const tasksMatch = j.tasks?.some(t => t.toLowerCase().includes(query));
                const techNameMatch = j.assignedTechnicianName?.toLowerCase().includes(query);
                const amountMatch = (j.invoice as any)?.total?.toString().includes(query) || 
                                    j.invoice?.totalAmount?.toString().includes(query) || 
                                    j.invoice?.amount?.toString().includes(query);

                return idMatch || nameMatch || phoneMatch || emailMatch || addressMatch || invoiceIdMatch || poNumberMatch || proposalIdMatch || tasksMatch || techNameMatch || amountMatch;
            });
        }
        return [...jobs].sort((a,b) => new Date(b.appointmentTime).getTime() - new Date(a.appointmentTime).getTime());
    }, [state.jobs, state.teams, state.currentUser, techFilter, searchQuery]);

    const displayedJobs = useMemo(() => {
        return filteredJobs.slice(0, page * itemsPerPage);
    }, [filteredJobs, page]);

    const hasMore = displayedJobs.length < filteredJobs.length;

    const handleViewJob = (job: Job) => {
        setViewJob(job);
        setEditNotes(job.notes?.internalNotes || '');
        setEditStatus(job.jobStatus);
        setEditCheckIn(formatDateTimeForInput(job.checkInTime));
        setEditCheckOut(formatDateTimeForInput(job.checkOutTime));
        setEditTimeOnSite(job.timeOnSiteMinutes ?? '');
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

        const checkInIso = editCheckIn ? new Date(editCheckIn).toISOString() : null;
        const checkOutIso = editCheckOut ? new Date(editCheckOut).toISOString() : null;
        const timeOnSite = editTimeOnSite !== '' ? Number(editTimeOnSite) : null;

        const updatedEntries = [...(viewJob.timeEntries || [])];
        if (updatedEntries.length > 0) {
            const lastIdx = updatedEntries.length - 1;
            updatedEntries[lastIdx] = {
                ...updatedEntries[lastIdx],
                checkInTime: checkInIso || '',
                checkOutTime: checkOutIso || null,
                timeOnSiteMinutes: timeOnSite !== null ? timeOnSite : null
            };
        } else if (checkInIso) {
            updatedEntries.push({
                checkInTime: checkInIso,
                checkOutTime: checkOutIso || null,
                timeOnSiteMinutes: timeOnSite !== null ? timeOnSite : null
            });
        }

        const totalMins = updatedEntries.reduce((acc, entry) => acc + (entry.timeOnSiteMinutes || 0), 0);

        const updatedJob = {
            ...viewJob,
            jobStatus: editStatus as any,
            checkInTime: checkInIso || undefined,
            checkOutTime: checkOutIso || undefined,
            timeOnSiteMinutes: totalMins || undefined,
            timeEntries: updatedEntries,
            notes: {
                ...viewJob.notes,
                internalNotes: editNotes
            }
        };

        let newEvents = updatedJob.jobEvents || [];
        if (editStatus === 'Cancelled' && viewJob.jobStatus !== 'Cancelled') {
            newEvents = [...newEvents, {
                type: 'Status Change',
                status: 'Cancelled',
                timestamp: new Date().toISOString(),
                userId: state.currentUser?.id
            }];
            updatedJob.jobEvents = newEvents;
        }

        try {
            const updates: any = {
                jobStatus: editStatus,
                'notes.internalNotes': editNotes,
                jobEvents: newEvents,
                timeEntries: updatedEntries
            };

            if (checkInIso) {
                updates.checkInTime = checkInIso;
            } else {
                updates.checkInTime = firebase.firestore.FieldValue.delete();
            }

            if (checkOutIso) {
                updates.checkOutTime = checkOutIso;
            } else {
                updates.checkOutTime = firebase.firestore.FieldValue.delete();
            }

            if (totalMins > 0) {
                updates.timeOnSiteMinutes = totalMins;
            } else {
                updates.timeOnSiteMinutes = firebase.firestore.FieldValue.delete();
            }

            await db.collection('jobs').doc(viewJob.id).update(cleanUndefinedFields(updates));
            dispatch({ type: 'UPDATE_JOB', payload: updatedJob });
            setViewJob(updatedJob);
            setIsEditing(false);
            showToast.warn("Job record updated.");
        } catch (e) {
            showToast.warn("Failed to save changes.");
        }
    };

    const handleDeleteJob = async (jobId: string) => {
        if (await confirm('PERMANENTLY DELETE this job record? This cannot be undone.')) {
            try {
                await Promise.all([
                    db.collection('jobs').doc(jobId).update(cleanUndefinedFields({
                        deleted: true,
                        deletedAt: new Date().toISOString(),
                        expireAt: firebase.firestore.Timestamp.fromDate(new Date(Date.now() + 3 * 365 * 24 * 60 * 60 * 1000))
                    })).catch(() => {}),
                    db.collection('appointments').doc(jobId).delete().catch(() => {})
                ]);
                dispatch({ type: 'DELETE_JOB', payload: jobId });
                if (viewJob?.id === jobId) setViewJob(null);
            } catch (error) {
                showToast.warn("Failed to delete job.");
            }
        }
    };

    const handleCopyRef = (jobId: string) => {
        navigator.clipboard.writeText(`#HIST-${jobId}`);
        showToast.warn("Reference Copied! Paste it anywhere to create a smart link.");
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
            await db.collection('messages').doc(msgObj.id).set(cleanUndefinedFields(msgObj));
            showToast.warn("Job shared successfully!");
            setShareModalJob(null);
            setShareMessageText('');
        } catch (e) {
            showToast.warn("Failed to share.");
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
            await db.collection('jobs').doc(viewJob.id).update(cleanUndefinedFields({ 
                toolReadings: updatedReadings,
                files: updatedFiles
            }));
            dispatch({ type: 'UPDATE_JOB', payload: updatedJob });
            setViewJob(updatedJob);
        } catch(e) {
            showToast.warn("Delete failed");
        }
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
            />

            <Modal isOpen={isEditing && !!viewJob} onClose={() => setIsEditing(false)} title="Edit Job Record" size="md">
                {viewJob && (
                    <div className="bg-primary-50 dark:bg-primary-900/10 p-4 rounded-lg border border-primary-100 dark:border-primary-800 space-y-4">
                        <Select label="Job Status" value={editStatus} onChange={e => setEditStatus(e.target.value)}>
                            <option value="Scheduled">Scheduled</option>
                            <option value="In Progress">In Progress</option>
                            <option value="Completed">Completed</option>
                            <option value="Cancelled">Cancelled</option>
                        </Select>
                        
                        <div className="border-t border-slate-200 dark:border-slate-800 my-2 pt-2 space-y-3">
                            <h5 className="text-[11px] font-black uppercase text-slate-400 tracking-wider">Manual Time Correction</h5>
                            <div className="grid grid-cols-2 gap-3">
                                <Input 
                                    label="Check-In (Arrival)" 
                                    type="datetime-local" 
                                    value={editCheckIn} 
                                    onChange={e => {
                                        setEditCheckIn(e.target.value);
                                        if (e.target.value && editCheckOut) {
                                            const diffMs = new Date(editCheckOut).getTime() - new Date(e.target.value).getTime();
                                            setEditTimeOnSite(Math.max(0, Math.round(diffMs / 60000)));
                                        }
                                    }} 
                                />
                                <Input 
                                    label="Check-Out (Departure)" 
                                    type="datetime-local" 
                                    value={editCheckOut} 
                                    onChange={e => {
                                        setEditCheckOut(e.target.value);
                                        if (editCheckIn && e.target.value) {
                                            const diffMs = new Date(e.target.value).getTime() - new Date(editCheckIn).getTime();
                                            setEditTimeOnSite(Math.max(0, Math.round(diffMs / 60000)));
                                        }
                                    }} 
                                />
                            </div>
                            <Input 
                                label="Time On Site (Minutes)" 
                                type="number" 
                                min="0"
                                value={editTimeOnSite} 
                                onChange={e => setEditTimeOnSite(e.target.value === '' ? '' : parseInt(e.target.value))} 
                                placeholder="e.g. 60"
                            />
                        </div>

                        <Textarea label="Internal Office Notes" value={editNotes} onChange={e => setEditNotes(e.target.value)} />
                        <div className="flex justify-end gap-2 pt-2">
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
                         className="w-full border rounded-lg p-2 text-slate-900 dark:text-white dark:bg-slate-800 dark:border-slate-700 bg-white"
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

            

            <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2 mb-2">
                    <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-1">
                        Search Records
                    </label>
                    <div className="relative w-full">
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                            <Search size={18} />
                        </div>
                        <input
                            type="text"
                            placeholder="Search by Job ID, WO # (Int/Ext), Invoice #, PO #, Customer details, ZIP, total..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="w-full rounded-md border-2 border-slate-300 dark:border-slate-500 pl-10 pr-10 py-2 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-50 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                                title="Clear search"
                            >
                                <X size={18} />
                            </button>
                        )}
                    </div>
                </div>
                <div>
                    <Select label="Filter by Technician" value={techFilter} onChange={e => setTechFilter(e.target.value)}>
                        <option value="">All Technicians</option>
                        {employees.map(e => <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>)}
                    </Select>
                </div>
            </div>

            <Card className="p-0 overflow-hidden border-slate-200 dark:border-slate-700 shadow-xl rounded-2xl">
                <Table 
                    headers={['Appointment & Site Visit', 'Customer & Site Location', 'Service & Equipment', 'Tech', 'Status', 'Invoice & Total', 'Linked Documents', 'Actions']}
                    limit={page * itemsPerPage}
                >
                    {filteredJobs.map(job => {
                        const cust = (state.customers || []).find((c: any) => c.id === job.customerId || c.name === job.customerName);
                        const loc = cust?.serviceLocations?.find((l: any) => l.id === job.locationId || l.address === job.address || l.name === job.locationName || l.propertyName === job.locationName);

                        const payingCustomer = cust?.name || (cust as any)?.companyName || job.customerName || 'Customer';
                        const siteLocationName = job.locationName || loc?.name || loc?.propertyName || '';
                        const siteAddress = formatAddress(job.address || loc?.address || '');

                        const apptDate = job.appointmentTime ? new Date(job.appointmentTime) : null;
                        const formattedApptDate = apptDate && !isNaN(apptDate.getTime()) 
                            ? apptDate.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' })
                            : '---';
                        const formattedApptTime = apptDate && !isNaN(apptDate.getTime()) 
                            ? apptDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
                            : '';

                        const checkIn = job.checkInTime || (job.timeEntries && job.timeEntries[0]?.checkInTime);
                        const checkOut = job.checkOutTime || (job.timeEntries && job.timeEntries[0]?.checkOutTime);

                        const formattedIn = checkIn ? new Date(checkIn).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }) : null;
                        const formattedOut = checkOut ? new Date(checkOut).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }) : null;

                        const totalMinutes = job.timeOnSiteMinutes !== undefined && job.timeOnSiteMinutes > 0 
                            ? job.timeOnSiteMinutes 
                            : (checkIn && checkOut ? Math.round((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 60000) : 0);

                        const formattedDuration = totalMinutes > 0 
                            ? (totalMinutes >= 60 ? `${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}m` : `${totalMinutes}m`)
                            : null;

                        return (
                            <tr key={job.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-all cursor-pointer border-b border-slate-100 dark:border-slate-700/50" onClick={() => handleViewJob(job)}>
                                <td className="px-6 py-4" data-sort-value={new Date(job.appointmentTime).getTime()}>
                                    <div className="flex flex-col gap-1 min-w-[140px]">
                                        <div>
                                            <span className="text-[9px] font-extrabold uppercase text-slate-400 dark:text-slate-500 tracking-wider block">Scheduled Appt</span>
                                            <span className="text-xs font-black text-slate-900 dark:text-white tracking-tight block">
                                                {formattedApptDate} {formattedApptTime && <span className="text-indigo-600 dark:text-indigo-400 font-bold ml-1">{formattedApptTime}</span>}
                                            </span>
                                        </div>

                                        {(formattedIn || formattedOut || formattedDuration) ? (
                                            <div className="pt-1 border-t border-slate-100 dark:border-slate-700/60 space-y-0.5">
                                                <span className="text-[9px] font-extrabold uppercase text-emerald-600 dark:text-emerald-400 tracking-wider flex items-center gap-1">
                                                    <Clock size={9} /> Site Visit
                                                </span>
                                                <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-bold text-slate-700 dark:text-slate-300">
                                                    {formattedIn && <span className="text-emerald-700 dark:text-emerald-400">In: {formattedIn}</span>}
                                                    {formattedOut && <span className="text-slate-600 dark:text-slate-400">Out: {formattedOut}</span>}
                                                    {formattedIn && !formattedOut && <span className="text-amber-600 dark:text-amber-400 font-black text-[9px] uppercase animate-pulse">In Progress</span>}
                                                </div>
                                                {formattedDuration && (
                                                    <span className="text-[9px] font-extrabold text-slate-400 dark:text-slate-500 block">
                                                        Duration: {formattedDuration}
                                                    </span>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="pt-0.5 text-[10px] text-slate-400 dark:text-slate-500 italic">
                                                No check-in recorded
                                            </div>
                                        )}
                                    </div>
                                </td>
                                <td className="px-6 py-4" data-sort-value={payingCustomer}>
                                    <div className="space-y-1.5 max-w-[220px]">
                                        <div>
                                            <span className="text-[9px] font-extrabold uppercase text-slate-400 dark:text-slate-500 tracking-wider block">Customer</span>
                                            <div className="flex items-center gap-1.5">
                                                <span className="text-slate-900 dark:text-white font-black text-sm tracking-tight truncate block max-w-[160px]" title={payingCustomer}>
                                                    {payingCustomer}
                                                </span>
                                                <button 
                                                    type="button"
                                                    onClick={(e) => { e.stopPropagation(); toggleJobDetails(job.id); }} 
                                                    className="text-[9px] bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 px-1.5 py-0.5 rounded text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 font-bold uppercase tracking-wider transition-colors shrink-0"
                                                >
                                                    {expandedJobs.has(job.id) ? 'Hide' : 'Details'}
                                                </button>
                                            </div>
                                        </div>

                                        <div className="pt-1 border-t border-slate-100 dark:border-slate-700/60">
                                            <span className="text-[9px] font-extrabold uppercase text-indigo-600 dark:text-indigo-400 tracking-wider flex items-center gap-1">
                                                <MapPin size={9} /> Site Location
                                            </span>
                                            {siteLocationName && siteLocationName !== payingCustomer && (
                                                <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200 block truncate" title={siteLocationName}>
                                                    {siteLocationName}
                                                </span>
                                            )}
                                            {siteAddress && (
                                                <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 block truncate" title={siteAddress}>
                                                    {siteAddress}
                                                </span>
                                            )}
                                        </div>

                                        {job.poNumber && (
                                            <div className="mt-1">
                                                <span className="inline-block font-mono text-[9px] font-bold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 border border-amber-200/35 px-1.5 py-0.5 rounded">
                                                    WO: {job.poNumber}
                                                </span>
                                            </div>
                                        )}

                                        {expandedJobs.has(job.id) && (
                                            <div className="mt-3 p-3.5 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2.5 max-w-sm text-xs text-slate-600 dark:text-slate-300 shadow-inner" onClick={(e) => e.stopPropagation()}>
                                                <div className="grid grid-cols-2 gap-2 text-[11px]">
                                            {(job.poNumber || (job.invoice as any)?.poNumber) && (
                                                <div>
                                                    <span className="text-slate-400 font-medium uppercase block text-[9px] tracking-wider">PO Number</span>
                                                    <span className="font-mono font-bold">{job.poNumber || (job.invoice as any)?.poNumber}</span>
                                                </div>
                                            )}
                                            {job.proposalId && (
                                                <div>
                                                    <span className="text-slate-400 font-medium uppercase block text-[9px] tracking-wider">Proposal</span>
                                                    <a href={`/#/proposal-view/${job.proposalId}`} target="_blank" rel="noreferrer" className="text-primary-600 dark:text-primary-400 hover:underline font-bold flex items-center gap-1">
                                                        <FileText size={10} /> #{job.proposalId.substring(0, 8)}
                                                    </a>
                                                </div>
                                            )}
                                            {job.customerPhone && (
                                                <div>
                                                    <span className="text-slate-400 font-medium uppercase block text-[9px] tracking-wider">Phone</span>
                                                    <span className="font-bold">{job.customerPhone}</span>
                                                </div>
                                            )}
                                            {job.customerEmail && (
                                                <div>
                                                    <span className="text-slate-400 font-medium uppercase block text-[9px] tracking-wider">Email</span>
                                                    <span className="font-bold truncate block max-w-[120px]" title={job.customerEmail}>{job.customerEmail}</span>
                                                </div>
                                            )}
                                        </div>

                                        {(() => {
                                            const nonPhotoFiles = (job.files || []).filter((f: any) => !isPhoto(f));
                                            if (nonPhotoFiles.length === 0) return null;
                                            return (
                                                <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
                                                    <span className="text-slate-400 font-medium uppercase block text-[9px] tracking-wider mb-1">Linked Documents ({nonPhotoFiles.length})</span>
                                                    <div className="flex flex-wrap gap-1.5">
                                                        {nonPhotoFiles.map((file: any, index: number) => (
                                                            <a 
                                                                key={file.id || index} 
                                                                href={file.url || file.dataUrl} 
                                                                target="_blank" 
                                                                rel="noreferrer" 
                                                                className="inline-flex items-center gap-1.5 px-2 py-1 bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-700 rounded text-[10px] hover:text-primary-600 hover:border-primary-500 dark:hover:text-primary-400 dark:hover:border-primary-400 transition-colors shadow-sm"
                                                            >
                                                                <FileText size={10} className="text-slate-400" />
                                                                <span className="truncate max-w-[100px]">{file.label || file.fileName || `Doc ${index+1}`}</span>
                                                            </a>
                                                        ))}
                                                    </div>
                                                </div>
                                            );
                                        })()}

                                        {job.notes?.internalNotes && (
                                            <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
                                                <span className="text-slate-400 font-medium uppercase block text-[9px] tracking-wider">Office Notes</span>
                                                <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400 italic font-medium">"{job.notes.internalNotes}"</p>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </td>
                            <td className="px-6 py-4">
                                <div className="text-slate-900 dark:text-slate-100 text-sm font-semibold tracking-tight">
                                    {job.tasks.join(', ')}
                                </div>
                                {job.unitStates && job.unitStates.length > 0 && (
                                    <div className="flex flex-wrap gap-1 mt-1.5">
                                        {job.unitStates.map(us => {
                                            const cust = state.customers?.find(c => c.id === job.customerId);
                                            const equip = cust?.equipment?.find(e => e.id === us.assetId);
                                            const name = equip?.name || equip?.type || 'Serviced Unit';
                                            return (
                                                <span key={us.assetId} className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-105 dark:bg-slate-700/60 rounded text-[9px] font-black uppercase text-slate-500 dark:text-slate-400 border border-slate-200/50 dark:border-slate-650/40" title={name}>
                                                    <Wrench size={8} /> {name}
                                                </span>
                                            );
                                        })}
                                    </div>
                                )}
                            </td>
                            <td className="px-6 py-4 text-slate-700 dark:text-slate-300 text-xs font-bold">
                                <div>{job.assignedTechnicianName || '-'}</div>
                                {job.assistants && job.assistants.length > 0 && (
                                    <div 
                                        className="text-[10px] text-slate-400 dark:text-slate-500 font-medium mt-0.5 flex items-center gap-1 cursor-help"
                                        title={job.assistants.map((id: string) => {
                                            const u = state.users?.find((user: any) => user.id === id);
                                            return u ? `${u.firstName} ${u.lastName}` : '';
                                        }).filter(Boolean).join(', ')}
                                    >
                                        <Users size={10} className="text-slate-400 shrink-0" />
                                        <span>Crew ({job.assistants.length})</span>
                                    </div>
                                )}
                            </td>
                            <td className="px-6 py-4">
                                <span className={`px-2.5 py-1 text-[10px] font-black uppercase tracking-widest rounded-full ${
                                    job.jobStatus === 'Completed' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300' : 
                                    job.jobStatus === 'In Progress' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300' : 
                                    job.jobStatus === 'Needs Follow-up' ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300' : 
                                    'bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-400'
                                }`}>
                                    {job.jobStatus}
                                </span>
                            </td>
                            <td className="px-6 py-4" data-sort-value={job.invoice ? (job.invoice.totalAmount || job.invoice.amount || 0) : 0}>
                                {job.invoice ? (
                                    <div className="flex flex-col gap-1 items-start">
                                        <span className="font-extrabold text-slate-800 dark:text-slate-200 text-sm tracking-tight">
                                            ${(job.invoice.totalAmount || job.invoice.amount || 0).toFixed(2)}
                                        </span>
                                        <span className={`px-2 py-0.5 text-[8px] font-black uppercase tracking-widest rounded-full border ${
                                            job.invoice?.status === 'Paid' 
                                                ? 'bg-emerald-50 text-emerald-700 border-emerald-250/20 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/30' 
                                                : 'bg-amber-50 text-amber-700 border-amber-250/20 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/30'
                                        }`}>
                                            {job.invoice?.status || 'Draft'}
                                        </span>
                                    </div>
                                ) : (
                                    <span className="text-slate-400 text-xs italic">No Invoice</span>
                                )}
                            </td>
                            <td className="px-6 py-4">
                                {(() => {
                                    const nonPhotoFiles = (job.files || []).filter((f: any) => !isPhoto(f));
                                    const hasDocs = job.proposalId || job.invoice || job.poNumber || job.subcontractorWorkOrder || nonPhotoFiles.length > 0;
                                    if (!hasDocs) return <span className="text-slate-400 text-xs italic">-</span>;
                                    
                                    return (
                                        <div className="flex flex-col gap-1.5 max-w-[185px]">
                                            {/* Proposal Link */}
                                            {job.proposalId && (
                                                <a 
                                                    href={`/#/proposal-view/${job.proposalId}`} 
                                                    target="_blank" 
                                                    rel="noreferrer" 
                                                    className="inline-flex items-center gap-1.5 text-[10px] text-indigo-600 dark:text-indigo-400 hover:underline font-bold"
                                                    onClick={(e) => e.stopPropagation()}
                                                >
                                                    <FileText size={10} className="text-indigo-500 shrink-0" />
                                                    <span className="truncate">Proposal #{job.proposalId.substring(0, 8)}</span>
                                                </a>
                                            )}
                                            
                                            {/* Invoice Link */}
                                            {job.invoice && (
                                                <a 
                                                    href={`/#/invoice/${job.id}`} 
                                                    target="_blank" 
                                                    rel="noreferrer" 
                                                    className="inline-flex items-center gap-1.5 text-[10px] text-emerald-600 dark:text-emerald-400 hover:underline font-bold"
                                                    onClick={(e) => e.stopPropagation()}
                                                >
                                                    <FileText size={10} className="text-emerald-500 shrink-0" />
                                                    <span className="truncate">Invoice ({job.invoice.status || 'Draft'})</span>
                                                </a>
                                            )}
                                            
                                            {/* Work Order / PO Link */}
                                            {job.poNumber && (
                                                <button 
                                                    type="button"
                                                    className="inline-flex items-center gap-1.5 text-[10px] text-amber-600 dark:text-amber-400 hover:underline font-bold text-left bg-transparent border-0 p-0 cursor-pointer"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        dispatch({ 
                                                            type: 'SET_VIEWING_WORK_ORDER', 
                                                            payload: { 
                                                                workOrderNumber: job.poNumber, 
                                                                customerId: job.customerId 
                                                            } 
                                                        });
                                                    }}
                                                >
                                                    <FileText size={10} className="text-amber-500 shrink-0" />
                                                    <span className="truncate">Work Order #{job.poNumber}</span>
                                                </button>
                                            )}
                                            
                                            {/* Subcontractor Work Order Badge */}
                                            {job.subcontractorWorkOrder && (
                                                <span className="inline-flex items-center gap-1.5 text-[10px] text-slate-600 dark:text-slate-400 font-bold">
                                                    <FileText size={10} className="text-slate-400 shrink-0" />
                                                    <span className="truncate">Subcontractor WO ({job.subcontractorWorkOrder.status})</span>
                                                </span>
                                            )}
                                            
                                            {/* Regular Attachments */}
                                            {nonPhotoFiles.map((file: any, index: number) => (
                                                <a 
                                                    key={file.id || index} 
                                                    href={file.url || file.dataUrl} 
                                                    target="_blank" 
                                                    rel="noreferrer" 
                                                    className="inline-flex items-center gap-1 text-[10px] text-primary-600 dark:text-primary-400 hover:underline font-bold truncate"
                                                    title={file.label || file.fileName || `Doc ${index+1}`}
                                                    onClick={(e) => e.stopPropagation()}
                                                >
                                                    <FileText size={10} className="text-primary-500 shrink-0" />
                                                    <span className="truncate">{file.label || file.fileName || `Doc ${index+1}`}</span>
                                                </a>
                                            ))}
                                        </div>
                                    );
                                })()}
                            </td>
                            <td className="px-6 py-4 flex gap-1.5 flex-wrap items-center">
                                <button aria-label="View Job Details" title="View Job Details" onClick={(e) => { e.stopPropagation(); handleViewJob(job); }} className="px-4 py-1.5 bg-primary-600 text-white text-[10px] font-black uppercase tracking-widest rounded-lg hover:bg-primary-700 transition-colors shadow-sm">View</button>
                                {job.invoice && (
                                    <button 
                                        aria-label="Send Invoice" 
                                        title="Send Invoice" 
                                        onClick={(e) => { e.stopPropagation(); setSendInvoiceModalConfig({ isOpen: true, job }); }} 
                                        className="px-3 py-1.5 bg-emerald-600 text-white text-[10px] font-black uppercase tracking-widest rounded-lg hover:bg-emerald-700 transition-colors shadow-sm flex items-center gap-1"
                                    >
                                        <Send size={12} />
                                        Send Invoice
                                    </button>
                                )}
                                <button aria-label="Manage Links" title="Manage Links" onClick={(e) => { e.stopPropagation(); setLinkingJob(job); }} className="p-1 text-slate-400 hover:text-primary-600"><Link2 size={16}/></button>
                                <button aria-label="Copy Reference" title="Copy Reference" onClick={(e) => { e.stopPropagation(); handleCopyRef(job.id); }} className="p-1 text-slate-400 hover:text-primary-600"><Copy size={16}/></button>
                                <button aria-label="Share Job" title="Share Job" onClick={(e) => { e.stopPropagation(); setShareModalJob(job); }} className="p-1 text-slate-400 hover:text-primary-600"><Share2 size={16}/></button>
                                <button aria-label="Delete Job" title="Delete Job" onClick={(e) => { e.stopPropagation(); handleDeleteJob(job.id); }} className="p-1 text-slate-400 hover:text-red-600"><Trash2 size={16}/></button>
                            </td>
                        </tr>
                    );
                    })}
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
                {sendInvoiceModalConfig.isOpen && sendInvoiceModalConfig.job && (
                <SendEmailModal
                    isOpen={sendInvoiceModalConfig.isOpen}
                    onClose={() => setSendInvoiceModalConfig({ isOpen: false, job: null })}
                    job={sendInvoiceModalConfig.job}
                    invoice={sendInvoiceModalConfig.job.invoice}
                    mode="invoice"
                />
            )}
        </Card>

            {linkingJob && (
                <JobLinkingModal 
                    isOpen={!!linkingJob} 
                    onClose={() => setLinkingJob(null)} 
                    job={linkingJob} 
                />
            )}
        </div>
    );
};

export default JobHistory;
