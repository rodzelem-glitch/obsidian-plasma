import React, { useMemo, useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { Job, User, Address, Subcontractor, BusinessDocument, InspectionTemplate } from '../../types';
import Card from '../../components/ui/Card';
import Table from '../../components/ui/Table';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import Textarea from '../../components/ui/Textarea';
import { useAppContext } from '../../context/AppContext';
import { db } from '../../lib/firebase';
import { Trash2, MessageSquare, CheckCircle, Globe, Users, Clock, MapPin, FileText, Edit, Share2, Copy } from 'lucide-react';
import { globalConfirm } from "lib/globalConfirm";

const JobScheduling: React.FC = () => {
    const { state, dispatch } = useAppContext();
    const [isSmsModalOpen, setIsSmsModalOpen] = useState(false);
    const [smsJob, setSmsJob] = useState<Job | null>(null);
    const [smsMessage, setSmsMessage] = useState('');
    const [isSending, setIsSending] = useState(false);
    
    // Crew Management
    const [editingCrewJob, setEditingCrewJob] = useState<Job | null>(null);
    const [crewSelection, setCrewSelection] = useState<string[]>([]);

    // Document Management
    const [editingDocsJob, setEditingDocsJob] = useState<Job | null>(null);
    const [selectedWaivers, setSelectedWaivers] = useState<string[]>([]);
    const [selectedDiagChecklists, setSelectedDiagChecklists] = useState<string[]>([]);
    const [selectedQualChecklists, setSelectedQualChecklists] = useState<string[]>([]);

    // Notes Management
    const [editingNotesJob, setEditingNotesJob] = useState<Job | null>(null);
    const [internalNotes, setInternalNotes] = useState('');

    // Share Management
    const [shareModalJob, setShareModalJob] = useState<Job | null>(null);
    const [shareTargetId, setShareTargetId] = useState<string>('');
    const [shareMessageText, setShareMessageText] = useState('');

    const [searchParams] = useSearchParams();

    // Filter employees by current organization ID
    const employees = useMemo(() => state.users.filter((u: User) => 
        u.organizationId === state.currentOrganization?.id && 
        (u.role === 'employee' || u.role === 'both' || u.role === 'supervisor' || u.role === 'Technician' || u.role === 'Subcontractor')
    ), [state.users, state.currentOrganization]);

    // Linked Partners
    const linkedPartners = useMemo(() => state.subcontractors.filter(s => s.handshakeStatus === 'Linked' && s.linkedOrgId), [state.subcontractors]);

    const [sortBy, setSortBy] = useState('date_desc');

    const allJobs = useMemo(() => {
        const now = Date.now();
        const internalJobs = state.jobs as Job[];
        const externalJobs = (state.externalJobs || []) as Job[]; // Handle potentially undefined externalJobs
        
        const combinedJobs = [...internalJobs, ...externalJobs];

        const activeJobs = combinedJobs.filter((job: Job) => {
            const isCompleted = job.jobStatus === 'Completed';
            const isPaid = job.invoice?.status === 'Paid';
            if (isCompleted && isPaid) {
                const jobTime = new Date(job.appointmentTime).getTime();
                const oneDayAgo = now - (24 * 60 * 60 * 1000);
                return jobTime > oneDayAgo;
            }
            return true;
        });
        
        return activeJobs.sort((a: Job, b: Job) => {
            const timeA = new Date(a.appointmentTime).getTime();
            const timeB = new Date(b.appointmentTime).getTime();
            
            switch (sortBy) {
                case 'date_asc':
                    return (!isNaN(timeA) ? timeA : 0) - (!isNaN(timeB) ? timeB : 0);
                case 'name_asc':
                    return (a.customerName || '').localeCompare(b.customerName || '');
                case 'name_desc':
                    return (b.customerName || '').localeCompare(a.customerName || '');
                case 'status':
                    return (a.jobStatus || '').localeCompare(b.jobStatus || '');
                case 'tech_asc':
                    return (a.assignedTechnicianName || '').localeCompare(b.assignedTechnicianName || '');
                case 'date_desc':
                default:
                    return (!isNaN(timeB) ? timeB : 0) - (!isNaN(timeA) ? timeA : 0);
            }
        });
    }, [state.jobs, state.externalJobs, sortBy]);

    useEffect(() => {
        const targetJobId = searchParams.get('jobId');
        if (targetJobId) {
            setTimeout(() => {
                const el = document.getElementById(`job-card-${targetJobId}`);
                if (el) {
                    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    el.classList.add('ring-4', 'ring-primary-500', 'ring-offset-2');
                    setTimeout(() => el.classList.remove('ring-4', 'ring-primary-500', 'ring-offset-2'), 3000);
                }
            }, 500);
        }
    }, [searchParams]);

    const handleJobUpdate = async (jobId: string, field: string, value: any) => {
        const jobToUpdate = (allJobs as Job[]).find((job: Job) => job.id === jobId);
        if (!jobToUpdate) return;
        
        let updatedJob = { ...jobToUpdate, [field]: value };

        if (field === 'assignedTechnicianId') {
            const tech = employees.find((t: User) => t.id === value);
            updatedJob.assignedTechnicianName = tech ? `${tech.firstName} ${tech.lastName}` : undefined;
            
            // Only clear partner assignment if WE are the owner organization
            if (value && state.currentOrganization?.id === jobToUpdate.organizationId) {
                updatedJob.assignedPartnerId = undefined;
                updatedJob.partnerAllowDirectPayment = false;
            }
        }

        try {
            await db.collection('jobs').doc(jobId).set(updatedJob, { merge: true });
            dispatch({ type: 'UPDATE_JOB', payload: updatedJob });
        } catch (error) {
            console.error("Failed to update job:", error);
        }
    };

    const handleAssignmentChange = async (job: Job, value: string) => {
        let updates: any = {};
        
        if (value.startsWith('partner:')) {
            const partnerOrgId = value.split(':')[1];
            const partner = linkedPartners.find(p => p.linkedOrgId === partnerOrgId);
            const waiversToEmbed = state.documents.filter(d => job.requiredWaiverIds?.includes(d.id));
            const checklistsToEmbed = state.inspectionTemplates.filter(t => 
                job.requiredDiagnosisChecklistIds?.includes(t.id) || job.requiredQualityChecklistIds?.includes(t.id)
            );

            updates = {
                assignedPartnerId: partnerOrgId,
                partnerAllowDirectPayment: !!partner?.allowDirectPayment,
                assignedTechnicianId: null,
                assignedTechnicianName: null,
                embeddedData: {
                    waivers: waiversToEmbed,
                    inspectionTemplates: checklistsToEmbed,
                },
            };
        } else if (value) {
            const tech = employees.find(t => t.id === value);
            updates = {
                assignedTechnicianId: value,
                assignedTechnicianName: tech ? `${tech.firstName} ${tech.lastName}` : undefined,
            };
            if (state.currentOrganization?.id === job.organizationId) {
                updates.assignedPartnerId = null;
                updates.partnerAllowDirectPayment = false;
                updates.embeddedData = null;
            }
        } else {
            updates = {
                assignedTechnicianId: null,
                assignedTechnicianName: null,
            };
            if (state.currentOrganization?.id === job.organizationId) {
                updates.assignedPartnerId = null;
                updates.partnerAllowDirectPayment = false;
                updates.embeddedData = null;
            }
        }

        const updatedJob = { ...job, ...updates };
        try {
            await db.collection('jobs').doc(job.id).update(updates); 
            dispatch({ type: 'UPDATE_JOB', payload: updatedJob });

            // Notify Technician
            if (updates.assignedTechnicianId) {
                const { sendNotification } = await import('lib/notificationService');
                await sendNotification(updates.assignedTechnicianId, {
                    title: "New Job Assigned",
                    body: `You have been assigned to ${job.customerName} for ${new Date(job.appointmentTime).toLocaleDateString()}.`,
                    type: 'job_assignment'
                });
            }
        } catch (e) { alert("Failed to assign."); }
    };

    const handleDeleteJob = async (jobId: string) => {
        if(await globalConfirm('Are you sure you want to delete this job record?')) {
            try {
                await db.collection('jobs').doc(jobId).delete();
                dispatch({ type: 'DELETE_JOB', payload: jobId });
            } catch (error) { console.error(error); }
        }
    };
    
    const openSmsModal = (job: Job) => {
        setSmsJob(job);
        setSmsMessage(`Hi ${job.customerName}, this is ${state.currentOrganization?.name} verifying your appointment for ${new Date(job.appointmentTime).toLocaleDateString()}. Reply C to confirm.`);
        setIsSmsModalOpen(true);
    };

    const openCrewModal = (job: Job) => {
        setEditingCrewJob(job);
        setCrewSelection(job.assistants || []);
    };

    const openDocsModal = (job: Job) => {
        setEditingDocsJob(job);
        setSelectedWaivers(job.requiredWaiverIds || []);
        setSelectedDiagChecklists(job.requiredDiagnosisChecklistIds || []);
        setSelectedQualChecklists(job.requiredQualityChecklistIds || []);
    };

    const openNotesModal = (job: Job) => {
        setEditingNotesJob(job);
        setInternalNotes(job.notes?.internalNotes || '');
    };

    const saveNotes = async () => {
        if (!editingNotesJob) return;
        try {
            const updates = { 'notes.internalNotes': internalNotes };
            const updatedJob = { ...editingNotesJob, notes: { ...editingNotesJob.notes, internalNotes: internalNotes } };
            await db.collection('jobs').doc(editingNotesJob.id).update(updates);
            dispatch({ type: 'UPDATE_JOB', payload: updatedJob });
            setEditingNotesJob(null);
        } catch (e) { alert("Failed to save notes."); }
    };

    const saveDocs = async () => {
        if (!editingDocsJob) return;
        try {
            const updates = {
                requiredWaiverIds: selectedWaivers,
                requiredDiagnosisChecklistIds: selectedDiagChecklists,
                requiredQualityChecklistIds: selectedQualChecklists
            };
            await db.collection('jobs').doc(editingDocsJob.id).update(updates);
            dispatch({ type: 'UPDATE_JOB', payload: { ...editingDocsJob, ...updates } });
            setEditingDocsJob(null);
        } catch (e) { alert("Failed to save documents."); }
    };

    const handleCopyRef = (jobId: string) => {
        navigator.clipboard.writeText(`#JOB-${jobId}`);
        alert("Reference Copied! Paste it anywhere to create a smart link.");
    };

    const handleShareJob = async () => {
        if (!shareModalJob || !shareTargetId) return;
        setIsSending(true);
        try {
            const msgObj: any = {
                id: `msg-${Date.now()}`,
                senderId: state.currentUser?.id,
                senderName: `${state.currentUser?.firstName} ${state.currentUser?.lastName}`,
                receiverId: shareTargetId,
                content: `${shareMessageText ? shareMessageText + '\n\n' : ''}Check out this job: #JOB-${shareModalJob.id}`,
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
            setIsSending(false);
        }
    };

    const formatDateTimeForInput = (isoString: string) => {
        const date = new Date(isoString);
        if (isNaN(date.getTime())) return '';
        const offset = date.getTimezoneOffset() * 60000;
        const localDate = new Date(date.getTime() - offset);
        return localDate.toISOString().slice(0, 16);
    };

    const formatAddress = (address: string | Address | undefined | null) => {
        if (!address) return '';
        if (typeof address === 'string') return address;
        return `${address.street || ''}, ${address.city || ''} ${address.state || ''} ${address.zip || ''}`.trim().replace(/,\s*$/, '').replace(/^,\s*/, '');
    };

    const waiverTemplates = useMemo(() => state.documents.filter(d => d.type === 'Waiver Template'), [state.documents]);
    const checklistTemplates = useMemo(() => state.inspectionTemplates || [], [state.inspectionTemplates]);
    
    return (
        <div className="space-y-6">
             <Modal isOpen={!!editingCrewJob} onClose={() => setEditingCrewJob(null)} title="Manage Job Crew">
                 {editingCrewJob && (
                     <div className="space-y-4">
                          <p className="text-sm text-gray-500">Select additional technicians assisting on this job.</p>
                          <div className="max-h-60 overflow-y-auto border p-2 rounded">
                             {employees.filter(u => u.id !== editingCrewJob.assignedTechnicianId).map(u => (
                                 <label key={u.id} className="flex items-center gap-2 p-2 hover:bg-gray-100 cursor-pointer">
                                     <input type="checkbox" checked={crewSelection.includes(u.id)} onChange={() => setCrewSelection(prev => prev.includes(u.id) ? prev.filter(id => id !== u.id) : [...prev, u.id])} />
                                     <span>{u.firstName} {u.lastName}</span>
                                 </label>
                             ))}
                          </div>
                          <div className="flex justify-end gap-2">
                              <Button variant="secondary" onClick={() => setEditingCrewJob(null)}>Cancel</Button>
                              <Button onClick={async () => {
                                  await db.collection('jobs').doc(editingCrewJob.id).update({ assistants: crewSelection });
                                  dispatch({ type: 'UPDATE_JOB', payload: { ...editingCrewJob, assistants: crewSelection } });
                                  setEditingCrewJob(null);
                              }}>Save Crew</Button>
                          </div>
                     </div>
                 )}
             </Modal>

             <Modal isOpen={!!editingDocsJob} onClose={() => setEditingDocsJob(null)} title="Required Job Documents">
                {editingDocsJob && (
                    <div className="space-y-6">
                        <div>
                            <h4 className="font-bold text-sm text-gray-700 mb-2">Required Waivers</h4>
                            <div className="max-h-32 overflow-y-auto border p-2 rounded bg-slate-50">
                                {waiverTemplates.map(t => (
                                    <label key={t.id} className="flex items-center gap-2 p-2 hover:bg-slate-100 cursor-pointer">
                                        <input type="checkbox" checked={selectedWaivers.includes(t.id)} onChange={() => setSelectedWaivers(prev => prev.includes(t.id) ? prev.filter(id => id !== t.id) : [...prev, t.id])} className="rounded text-primary-600"/>
                                        <span className="text-sm">{t.title}</span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        <div>
                            <h4 className="font-bold text-sm text-gray-700 mb-2">Step 2: Diagnosis Checklists</h4>
                            <div className="max-h-32 overflow-y-auto border p-2 rounded bg-slate-50">
                                {checklistTemplates.map(t => (
                                    <label key={t.id} className="flex items-center gap-2 p-2 hover:bg-slate-100 cursor-pointer">
                                        <input type="checkbox" checked={selectedDiagChecklists.includes(t.id)} onChange={() => setSelectedDiagChecklists(prev => prev.includes(t.id) ? prev.filter(id => id !== t.id) : [...prev, t.id])} className="rounded text-blue-600"/>
                                        <span className="text-sm">{t.name}</span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        <div>
                            <h4 className="font-bold text-sm text-gray-700 mb-2">Step 4: Quality Checklists</h4>
                            <div className="max-h-32 overflow-y-auto border p-2 rounded bg-slate-50">
                                {checklistTemplates.map(t => (
                                    <label key={t.id} className="flex items-center gap-2 p-2 hover:bg-slate-100 cursor-pointer">
                                        <input type="checkbox" checked={selectedQualChecklists.includes(t.id)} onChange={() => setSelectedQualChecklists(prev => prev.includes(t.id) ? prev.filter(id => id !== t.id) : [...prev, t.id])} className="rounded text-green-600"/>
                                        <span className="text-sm">{t.name}</span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        <div className="flex justify-end gap-2 pt-2 border-t">
                            <Button variant="secondary" onClick={() => setEditingDocsJob(null)}>Cancel</Button>
                            <Button onClick={saveDocs}>Save Requirements</Button>
                        </div>
                    </div>
                )}
             </Modal>

             <Modal isOpen={!!editingNotesJob} onClose={() => setEditingNotesJob(null)} title="Internal Job Notes">
                 <div className="space-y-4">
                     <Textarea 
                        label="Office/Dispatch Notes (Visible to Techs)"
                        value={internalNotes} 
                        onChange={e => setInternalNotes(e.target.value)} 
                        rows={6}
                        placeholder="Enter specific instructions, gate codes, or internal reminders..."
                     />
                     <div className="flex justify-end gap-2">
                         <Button variant="secondary" onClick={() => setEditingNotesJob(null)}>Cancel</Button>
                         <Button onClick={saveNotes}>Save Notes</Button>
                     </div>
                 </div>
             </Modal>

             <Modal isOpen={!!shareModalJob} onClose={() => setShareModalJob(null)} title={`Share Job: ${shareModalJob?.customerName}`}>
                 <div className="space-y-4">
                     <p className="text-sm text-slate-500">Send this job to a supervisor or admin in your organization.</p>
                     <select 
                         aria-label="Select Share Recipient"
                         title="Select Share Recipient"
                         className="w-full border rounded-lg p-2 dark:bg-slate-800 dark:border-slate-700"
                         value={shareTargetId}
                         onChange={e => setShareTargetId(e.target.value)}
                     >
                         <option value="">Select Recipient...</option>
                         {state.users.filter((u: User) => 
                             u.organizationId === state.currentOrganization?.id && 
                             u.id !== state.currentUser?.id && 
                             u.role !== 'customer'
                         ).map((u: User) => (
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
                         <Button onClick={handleShareJob} disabled={!shareTargetId || isSending}>
                             {isSending ? 'Sending...' : 'Send Message'}
                         </Button>
                     </div>
                 </div>
             </Modal>

            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4 px-1">
                <h3 className="font-bold text-gray-800 dark:text-white">Active Jobs</h3>
                <div className="flex items-center gap-2 text-sm">
                    <label className="font-medium text-slate-600 dark:text-slate-300">Sort by:</label>
                    <select 
                        aria-label="Sort Jobs"
                        className="border rounded-lg p-1.5 dark:bg-slate-800 dark:border-slate-600 text-slate-700 dark:text-slate-200"
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value)}
                    >
                        <option value="date_desc">Newest First</option>
                        <option value="date_asc">Oldest First</option>
                        <option value="name_asc">Customer (A-Z)</option>
                        <option value="name_desc">Customer (Z-A)</option>
                        <option value="status">Status</option>
                        <option value="tech_asc">Technician (A-Z)</option>
                    </select>
                </div>
            </div>

            <div className="md:hidden space-y-4">
                {(allJobs as Job[]).map((job: Job) => (
                    <div key={job.id} className={`p-4 rounded-xl border bg-white dark:bg-gray-800 shadow-sm transition-all ${job.assignedPartnerId === state.currentOrganization?.id ? 'border-blue-200 bg-blue-50/30' : 'border-gray-200 dark:border-gray-700'}`}>
                        <div className="flex justify-between items-start mb-3">
                            <div>
                                <h3 className="font-bold text-gray-900 dark:text-white">{job.customerName}</h3>
                                <p className="text-[10px] text-gray-500 flex items-center gap-1 mt-0.5"><MapPin size={10}/> {formatAddress(job.address)}</p>
                            </div>
                            <span className={`px-2 py-0.5 text-[10px] rounded-full font-bold ${
                                job.invoice?.status === 'Paid' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                            }`}>
                                {job.invoice?.status}
                            </span>
                        </div>

                        <div className="grid grid-cols-2 gap-3 mb-4">
                            <div className="space-y-1">
                                <label className="text-[9px] uppercase font-black text-gray-400">Unit/System</label>
                                <p className="text-xs font-bold text-blue-600 truncate">{job.hvacBrand || '---'}</p>
                            </div>
                            <div className="space-y-1">
                                <label className="text-[9px] uppercase font-black text-gray-400">Time</label>
                                <p className="text-xs font-medium text-gray-700 dark:text-gray-300">
                                    {new Date(job.appointmentTime).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                </p>
                            </div>
                        </div>

                        <div className="flex flex-wrap gap-2 items-center justify-between pt-3 border-t border-gray-100 dark:border-gray-700">
                            <div className="flex gap-2">
                                <button onClick={() => openSmsModal(job)} className="text-blue-500 p-1 bg-slate-50 dark:bg-slate-700 rounded" aria-label="SMS Customer" title="SMS Customer"><MessageSquare size={16}/></button>
                                <button onClick={() => openNotesModal(job)} className="text-amber-500 p-1 bg-slate-50 dark:bg-slate-700 rounded" aria-label="Internal Notes" title="Internal Notes"><Edit size={16}/></button>
                                <button onClick={() => openDocsModal(job)} className="text-slate-500 p-1 bg-slate-50 dark:bg-slate-700 rounded" aria-label="Documents and Checklists" title="Documents and Checklists"><FileText size={16}/></button>
                                <button onClick={() => handleCopyRef(job.id)} className="text-emerald-500 p-1 bg-slate-50 dark:bg-slate-700 rounded" aria-label="Copy Job Link" title="Copy Job Link"><Copy size={16}/></button>
                                <button onClick={() => setShareModalJob(job)} className="text-primary-500 p-1 bg-slate-50 dark:bg-slate-700 rounded" aria-label="Share with Staff" title="Share with Staff"><Share2 size={16}/></button>
                            </div>
                            <div className="flex gap-2">
                                <select 
                                    aria-label="Update Job Status"
                                    title="Update Job Status"
                                    value={job.jobStatus} 
                                    onChange={(e) => handleJobUpdate(job.id, 'jobStatus', e.target.value)} 
                                    className="text-[10px] border rounded p-1 bg-gray-50 font-bold"
                                >
                                    <option value="Scheduled">Scheduled</option>
                                    <option value="In Progress">In Progress</option>
                                    <option value="Completed">Completed</option>
                                </select>
                                <button onClick={() => handleDeleteJob(job.id)} aria-label="Delete Job" title="Delete Job" className="text-red-500 p-1 ml-1"><Trash2 size={18}/></button>
                            </div>
                        </div>
                        
                        <div className="mt-3">
                            <select 
                                aria-label="Assign Technician"
                                title="Assign Technician"
                                value={job.assignedTechnicianId || (job.assignedPartnerId && job.assignedPartnerId !== state.currentOrganization?.id ? `partner:${job.assignedPartnerId}` : '')} 
                                onChange={(e) => handleAssignmentChange(job, e.target.value)} 
                                className="w-full text-xs border rounded-lg p-2 bg-gray-50 dark:bg-gray-700 font-medium"
                            >
                                <option value="">Assign Technician...</option>
                                <optgroup label="Internal Technicians">
                                    {employees.map(tech => <option key={tech.id} value={tech.id}>{tech.firstName} {tech.lastName}</option>)}
                                </optgroup>
                                {linkedPartners.length > 0 && (
                                    <optgroup label="Partner Network">
                                        {linkedPartners.map(p => <option key={p.id} value={`partner:${p.linkedOrgId}`}>{p.companyName}</option>)}
                                    </optgroup>
                                )}
                            </select>
                        </div>
                    </div>
                ))}
            </div>

            <Card className="hidden md:block">
                <Table headers={['Customer', 'Unit/System', 'Appointment Time', 'Invoice Status', 'Job Status', 'Assigned Tech / Partner', 'Crew', 'Actions']}>
                    {(allJobs as Job[]).map((job: Job) => (
                        <tr id={`job-card-${job.id}`} key={job.id} className={`${job.assignedPartnerId === state.currentOrganization?.id ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}>
                            <td className="px-6 py-4 whitespace-nowrap font-bold text-sm">
                                {job.customerName}
                                {job.assignedPartnerId === state.currentOrganization?.id && <span className="ml-2 text-[10px] text-blue-600 border border-blue-200 px-1 rounded bg-white">Assigned to You</span>}
                                <div className="text-[10px] text-gray-400 font-normal">{formatAddress(job.address)}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-xs text-blue-600 font-bold">{job.hvacBrand || '---'}</td>
                            <td className="px-6 py-4 whitespace-nowrap">
                                <input type="datetime-local" aria-label="Appointment Time" title="Appointment Time" value={formatDateTimeForInput(job.appointmentTime)} onChange={(e) => handleJobUpdate(job.id, 'appointmentTime', new Date(e.target.value).toISOString())} className="bg-white dark:bg-gray-700 border text-xs rounded p-1"/>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap"><span className="px-2 py-1 text-[10px] rounded-full bg-slate-100 font-bold">{job.invoice?.status}</span></td>
                             <td className="px-6 py-4 whitespace-nowrap">
                                <select aria-label="Update Job Status" title="Update Job Status" value={job.jobStatus} onChange={(e) => handleJobUpdate(job.id, 'jobStatus', e.target.value)} className="text-xs border rounded p-1">
                                    <option value="Scheduled">Scheduled</option>
                                    <option value="In Progress">In Progress</option>
                                    <option value="Completed">Completed</option>
                                </select>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                                <select 
                                    aria-label="Assign Technician"
                                    title="Assign Technician"
                                    value={job.assignedTechnicianId || (job.assignedPartnerId && job.assignedPartnerId !== state.currentOrganization?.id ? `partner:${job.assignedPartnerId}` : '')} 
                                    onChange={(e) => handleAssignmentChange(job, e.target.value)} 
                                    className="text-xs border rounded p-1 max-w-[150px]"
                                >
                                    <option value="">Unassigned</option>
                                    <optgroup label="Internal Technicians">
                                        {employees.map(tech => <option key={tech.id} value={tech.id}>{tech.firstName} {tech.lastName}</option>)}
                                    </optgroup>
                                    {linkedPartners.length > 0 && (
                                        <optgroup label="Partner Network">
                                            {linkedPartners.map(p => <option key={p.id} value={`partner:${p.linkedOrgId}`}>{p.companyName}</option>)}
                                        </optgroup>
                                    )}
                                </select>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap"><button onClick={() => openCrewModal(job)} className="text-[10px] bg-slate-100 px-2 py-1 rounded">Crew ({job.assistants?.length || 0})</button></td>
                            <td className="px-6 py-4 whitespace-nowrap flex gap-1.5 flex-wrap">
                                <button onClick={() => openSmsModal(job)} className="text-blue-600 p-1 hover:bg-black/5 rounded" title="SMS Customer"><MessageSquare size={16}/></button>
                                <button onClick={() => openNotesModal(job)} className="text-amber-600 p-1 hover:bg-black/5 rounded" title="Internal Notes"><Edit size={16}/></button>
                                <button onClick={() => openDocsModal(job)} className="text-slate-600 p-1 hover:bg-black/5 rounded" title="Documents & Checklists"><FileText size={16}/></button>
                                <button onClick={() => handleCopyRef(job.id)} className="text-emerald-600 p-1 hover:bg-black/5 rounded" title="Copy Reference"><Copy size={16}/></button>
                                <button onClick={() => setShareModalJob(job)} className="text-primary-600 p-1 hover:bg-black/5 rounded" title="Share Job"><Share2 size={16}/></button>
                                <button onClick={() => handleDeleteJob(job.id)} className="text-red-600 p-1 hover:bg-black/5 rounded" title="Delete Job"><Trash2 size={16}/></button>
                            </td>
                        </tr>
                    ))}
                </Table>
            </Card>
        </div>
    );
};

export default JobScheduling;
