
import React, { useMemo, useState } from 'react';
import type { Job, User, Address, Subcontractor, BusinessDocument, InspectionTemplate } from '../../types';
import Card from '../../components/ui/Card';
import Table from '../../components/ui/Table';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import Textarea from '../../components/ui/Textarea';
import { useAppContext } from '../../context/AppContext';
import { db } from '../../lib/firebase';
import { Trash2, MessageSquare, CheckCircle, Globe, Users, Clock, MapPin, FileText, Edit } from 'lucide-react';
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

    // Filter employees by current organization ID
    const employees = useMemo(() => state.users.filter((u: User) => 
        u.organizationId === state.currentOrganization?.id && 
        (u.role === 'employee' || u.role === 'both' || u.role === 'supervisor' || u.role === 'Technician' || u.role === 'Subcontractor')
    ), [state.users, state.currentOrganization]);

    // Linked Partners
    const linkedPartners = useMemo(() => state.subcontractors.filter(s => s.handshakeStatus === 'Linked' && s.linkedOrgId), [state.subcontractors]);

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
            return (!isNaN(timeA) ? timeA : 0) - (!isNaN(timeB) ? timeB : 0);
        });
    }, [state.jobs, state.externalJobs]);

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

            <Card className="hidden md:block">
                <Table headers={['Customer', 'Unit/System', 'Appointment Time', 'Invoice Status', 'Job Status', 'Assigned Tech / Partner', 'Crew', 'Actions']}>
                    {(allJobs as Job[]).map((job: Job) => (
                        <tr key={job.id} className={job.assignedPartnerId === state.currentOrganization?.id ? 'bg-blue-50 dark:bg-blue-900/20' : ''}>
                            <td className="px-6 py-4 whitespace-nowrap font-bold text-sm">
                                {job.customerName}
                                {job.assignedPartnerId === state.currentOrganization?.id && <span className="ml-2 text-[10px] text-blue-600 border border-blue-200 px-1 rounded bg-white">Assigned to You</span>}
                                <div className="text-[10px] text-gray-400 font-normal">{formatAddress(job.address)}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-xs text-blue-600 font-bold">{job.hvacBrand || '---'}</td>
                            <td className="px-6 py-4 whitespace-nowrap">
                                <input type="datetime-local" value={formatDateTimeForInput(job.appointmentTime)} onChange={(e) => handleJobUpdate(job.id, 'appointmentTime', new Date(e.target.value).toISOString())} className="bg-white dark:bg-gray-700 border text-xs rounded p-1"/>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap"><span className="px-2 py-1 text-[10px] rounded-full bg-slate-100 font-bold">{job.invoice?.status}</span></td>
                             <td className="px-6 py-4 whitespace-nowrap">
                                <select value={job.jobStatus} onChange={(e) => handleJobUpdate(job.id, 'jobStatus', e.target.value)} className="text-xs border rounded p-1">
                                    <option value="Scheduled">Scheduled</option>
                                    <option value="In Progress">In Progress</option>
                                    <option value="Completed">Completed</option>
                                </select>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                                <select 
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
                            <td className="px-6 py-4 whitespace-nowrap flex gap-2">
                                <button onClick={() => openSmsModal(job)} className="text-blue-600" title="SMS Customer"><MessageSquare size={16}/></button>
                                <button onClick={() => openNotesModal(job)} className="text-amber-600" title="Internal Notes"><Edit size={16}/></button>
                                <button onClick={() => openDocsModal(job)} className="text-slate-600" title="Documents & Checklists"><FileText size={16}/></button>
                                <button onClick={() => handleDeleteJob(job.id)} className="text-red-600" title="Delete Job"><Trash2 size={16}/></button>
                            </td>
                        </tr>
                    ))}
                </Table>
            </Card>
        </div>
    );
};

export default JobScheduling;
