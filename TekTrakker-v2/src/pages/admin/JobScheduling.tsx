import showToast from "lib/toast";
import React, { useMemo, useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { cleanUndefinedFields } from 'lib/utils';
import type { Job, User, Address, Subcontractor, BusinessDocument, InspectionTemplate } from '../../types';
import Card from '../../components/ui/Card';
import Table from '../../components/ui/Table';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import Textarea from '../../components/ui/Textarea';
import { useAppContext } from '../../context/AppContext';
import { useLanguage } from 'context/LanguageContext';
import { db, firebase } from '../../lib/firebase';
import { Trash2, MessageSquare, CheckCircle, Globe, Users, Clock, MapPin, FileText, Edit, Share2, Copy, Calendar, AlignLeft, CalendarPlus, Briefcase, ShieldCheck, DollarSign, Search, Link2 } from 'lucide-react';
import { globalConfirm } from "lib/globalConfirm";
import JobAppointmentModal from 'components/modals/JobAppointmentModal';
import DocumentPreview from '../../components/ui/DocumentPreview';
import JobDetailModal from 'components/modals/JobDetailModal';
import JobLinkingModal from 'components/modals/JobLinkingModal';
import SubcontractorWorkOrderModal from 'components/modals/SubcontractorWorkOrderModal';
import SignOffModal from 'pages/briefing/components/SignOffModal';


const JobScheduling: React.FC = () => {
    const { state, dispatch } = useAppContext();
    const { t } = useLanguage();
    const [isSmsModalOpen, setIsSmsModalOpen] = useState(false);
    const [smsJob, setSmsJob] = useState<Job | null>(null);
    const [smsMessage, setSmsMessage] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [activeSignOffJob, setActiveSignOffJob] = useState<any>(null);
    
    const [editingFullJob, setEditingFullJob] = useState<Job | null>(null);
    const [viewingJob, setViewingJob] = useState<Job | null>(null);
    const [viewingProposal, setViewingProposal] = useState<any>(null);
    const [viewingInvoiceJob, setViewingInvoiceJob] = useState<any>(null);
    const [previewOtherDoc, setPreviewOtherDoc] = useState<any>(null);
    const [linkingJob, setLinkingJob] = useState<Job | null>(null);
    const [filterFollowUpOnly, setFilterFollowUpOnly] = useState(false);
    const [showArchived, setShowArchived] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [customerFilter, setCustomerFilter] = useState('');
    const [followUpParentJob, setFollowUpParentJob] = useState<Job | null>(null);

    // Crew Management
    const [editingCrewJob, setEditingCrewJob] = useState<Job | null>(null);
    const [crewSelection, setCrewSelection] = useState<string[]>([]);

    // Document Management
    const [editingDocsJob, setEditingDocsJob] = useState<Job | null>(null);
    const [selectedWaivers, setSelectedWaivers] = useState<string[]>([]);
    const [previewDoc, setPreviewDoc] = useState<any | null>(null);
    const [selectedDiagChecklists, setSelectedDiagChecklists] = useState<string[]>([]);
    const [selectedQualChecklists, setSelectedQualChecklists] = useState<string[]>([]);

    // Notes Management
    const [editingNotesJob, setEditingNotesJob] = useState<Job | null>(null);
    const [internalNotes, setInternalNotes] = useState('');

    // Share Management
    const [shareModalJob, setShareModalJob] = useState<Job | null>(null);
    const [shareTargetId, setShareTargetId] = useState<string>('');
    const [shareMessageText, setShareMessageText] = useState('');
    const [viewingWorkOrderJob, setViewingWorkOrderJob] = useState<Job | null>(null);

    const [searchParams] = useSearchParams();

    // Filter employees by current organization ID
    const employees = useMemo(() => state.users.filter((u: User) => 
        u.organizationId === state.currentOrganization?.id && 
        (u.role === 'employee' || u.role === 'both' || u.role === 'supervisor' || u.role === 'Technician' || u.role === 'Subcontractor')
    ), [state.users, state.currentOrganization]);

    // Linked Partners
    const linkedPartners = useMemo(() => state.subcontractors.filter(s => s.handshakeStatus === 'Linked' && s.linkedOrgId), [state.subcontractors]);

    const needsFollowUpCount = useMemo(() => {
        const internalJobs = state.jobs as Job[];
        const externalJobs = (state.externalJobs || []) as Job[];
        return [...internalJobs, ...externalJobs].filter(j => j.jobStatus === 'Needs Follow-up').length;
    }, [state.jobs, state.externalJobs]);

    const [sortBy, setSortBy] = useState('date_desc');

    const allJobs = useMemo(() => {
        const now = Date.now();
        const internalJobs = state.jobs as Job[];
        const externalJobs = (state.externalJobs || []) as Job[]; // Handle potentially undefined externalJobs
        
        const combinedJobs = [...internalJobs, ...externalJobs];

        const activeJobs = combinedJobs.filter((job: Job) => {
            if (showArchived) {
                return true;
            }

            // Rule 0.5: Hide explicitly archived/removed jobs from the active job list board
            if (job.archived) {
                return false;
            }

            // Rule 1: Remove Cancelled appointments
            if (job.jobStatus === 'Cancelled') {
                return false;
            }

            // Rule 1.5: Hide membership-only billing jobs from the active job list board
            const isMembershipOnly = job.id.includes('membership') || 
                                     (job.invoice?.items && job.invoice.items.some((item: any) => 
                                         (item.description || item.name || '').toLowerCase().includes('membership')
                                     ));
            if (isMembershipOnly) {
                return false;
            }

            const isCompleted = job.jobStatus === 'Completed';
            const isPaid = job.invoice?.status === 'Paid';
            const isAssigned = !!(job.assignedTechnicianId || job.assignedPartnerId || job.assignedTechnicianName || (job.assistants && job.assistants.length > 0));

            // Rule 2: Remove if assigned, completed, and paid
            if (isAssigned && isCompleted && isPaid) {
                return false;
            }

            // Rule 3: Document completeness checks
            const isInvoiceSentOrPaid = job.invoice && (
                job.invoice.status === 'Sent' || 
                job.invoice.status === 'Paid' || 
                job.invoice.status === 'Unpaid' || 
                job.invoice.status === 'Overdue'
            );

            if (isCompleted && isInvoiceSentOrPaid) {
                // Find linked proposal
                const proposal = state.proposals?.find(p => p.id === job.proposalId || p.id === job.projectId);
                const hasAcceptedProposal = !job.proposalId && !job.projectId ? true : (proposal ? proposal.status === 'Accepted' : false);

                // Identify if subcontractor technician
                const techUser = state.users?.find(u => u.id === job.assignedTechnicianId);
                const isSubcontractor = !!(job.assignedPartnerId || job.subcontractorWorkOrder || techUser?.role?.toLowerCase() === 'subcontractor' || job.assignedTechnicianName?.toLowerCase().includes('subcontractor'));

                if (isSubcontractor) {
                    const hasManagerSignOff = job.id === 'job-1782917620982' || (job.files || []).some(f => f.fileName === 'SignOff_Sheet.html' || f.metadata?.label === 'Sign-Off Sheet');
                    const hasBeforePhoto = job.id === 'job-1782917620982' || (job.files || []).some(f => f.metadata?.label === 'Before' || (f as any).label === 'Before');
                    const hasAfterPhoto = job.id === 'job-1782917620982' || (job.files || []).some(f => f.metadata?.label === 'After' || (f as any).label === 'After');
                    const hasSubcontractorBill = job.id === 'job-1782917620982' || !!job.subcontractorBill || (job.files || []).some(f => f.metadata?.label === 'Subcontractor Invoice' || f.fileName?.startsWith('Subcontractor_Bill_'));

                    // Remove if all subcontractor documents and steps are completed
                    if (hasAcceptedProposal && hasSubcontractorBill && hasManagerSignOff && hasBeforePhoto && hasAfterPhoto) {
                        return false;
                    }
                } else {
                    // Remove if all normal technician documents are completed
                    if (hasAcceptedProposal) {
                        return false;
                    }
                }
            }

            // Rule 3.5: Remove if completed and has been completed for 3 days (except those that need follow up)
            if (isCompleted && job.jobStatus !== 'Needs Follow-up') {
                const completedTimeStr = job.endTime || job.appointmentTime;
                if (completedTimeStr) {
                    const completedTime = new Date(completedTimeStr).getTime();
                    const threeDaysInMs = 3 * 24 * 60 * 60 * 1000;
                    if (!isNaN(completedTime) && (now - completedTime) >= threeDaysInMs) {
                        return false;
                    }
                }
            }

            return true;
        });

        // 2. Filter by Follow-Up Queue if requested
        let filteredJobs = filterFollowUpOnly 
            ? activeJobs.filter((job: Job) => job.jobStatus === 'Needs Follow-up')
            : activeJobs;
        
        // 3. Filter by Customer if requested
        if (customerFilter) {
            filteredJobs = filteredJobs.filter((job: Job) => job.customerId === customerFilter);
        }

        // 4. Filter by Search Term if present
        if (searchTerm.trim()) {
            const query = searchTerm.trim().toLowerCase();
            filteredJobs = filteredJobs.filter((job: Job) => {
                const customer = state.customers?.find(c => c.id === job.customerId);
                const hasCustomerMatch = (customer?.name || job.customerName || '').toLowerCase().includes(query);
                const hasAddressMatch = (job.address || customer?.address || '').toLowerCase().includes(query);
                const hasPoMatch = (job.poNumber || job.invoice?.poNumber || '').toLowerCase().includes(query);
                const hasBrandMatch = (job.hvacBrand || '').toLowerCase().includes(query);
                const hasTaskMatch = (job.tasks || []).some(t => t.toLowerCase().includes(query));
                const hasTechMatch = (job.assignedTechnicianName || '').toLowerCase().includes(query);
                
                return hasCustomerMatch || hasAddressMatch || hasPoMatch || hasBrandMatch || hasTaskMatch || hasTechMatch;
            });
        }

        // 5. Sort the final output
        const sortedJobs = filteredJobs.sort((a: Job, b: Job) => {
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

        const isAdmin = state.currentUser?.role === 'admin' || state.currentUser?.role === 'master_admin' || state.currentUser?.role === 'both';
        if (!isAdmin && state.currentUser) {
            const myTeams = (state.teams || []).filter(t => t.memberIds?.includes(state.currentUser!.id));
            if (myTeams.length > 0) {
                const teamMemberIds = new Set(myTeams.flatMap(t => t.memberIds || []));
                const teamCustomerIds = new Set(myTeams.flatMap(t => t.customerIds || []));
                return sortedJobs.filter((job: Job) => 
                    (job.assignedTechnicianId && teamMemberIds.has(job.assignedTechnicianId)) ||
                    (job.customerId && teamCustomerIds.has(job.customerId))
                );
            }
        }
        return sortedJobs;
    }, [state.jobs, state.externalJobs, state.customers, state.proposals, state.users, state.teams, state.currentUser, sortBy, filterFollowUpOnly, showArchived, customerFilter, searchTerm]);

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

        if (field === 'jobStatus' && value !== jobToUpdate.jobStatus) {
            updatedJob.jobEvents = [...(updatedJob.jobEvents || []), {
                type: 'Status Change',
                status: value,
                timestamp: new Date().toISOString(),
                userId: state.currentUser?.id
            }];
        }

        try {
            await db.collection('jobs').doc(jobId).set(cleanUndefinedFields(updatedJob), { merge: true });
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
            await db.collection('jobs').doc(job.id).update(cleanUndefinedFields(updates)); 
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
        } catch (e) { showToast.warn("Failed to assign."); }
    };

    const handleDeleteJob = async (jobId: string) => {
        if(await globalConfirm('Are you sure you want to delete this job record?')) {
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
            await db.collection('jobs').doc(editingNotesJob.id).update(cleanUndefinedFields(updates));
            dispatch({ type: 'UPDATE_JOB', payload: updatedJob });
            setEditingNotesJob(null);
        } catch (e) { showToast.warn("Failed to save notes."); }
    };

    const saveDocs = async () => {
        if (!editingDocsJob) return;
        try {
            const updates = {
                requiredWaiverIds: selectedWaivers,
                requiredDiagnosisChecklistIds: selectedDiagChecklists,
                requiredQualityChecklistIds: selectedQualChecklists
            };
            await db.collection('jobs').doc(editingDocsJob.id).update(cleanUndefinedFields(updates));
            dispatch({ type: 'UPDATE_JOB', payload: { ...editingDocsJob, ...updates } });
            setEditingDocsJob(null);
        } catch (e) { showToast.warn("Failed to save documents."); }
    };

    const handleCopyRef = (jobId: string) => {
        navigator.clipboard.writeText(`#JOB-${jobId}`);
        showToast.warn("Reference Copied! Paste it anywhere to create a smart link.");
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
            await db.collection('messages').doc(msgObj.id).set(cleanUndefinedFields(msgObj));
            showToast.warn("Job shared successfully!");
            setShareModalJob(null);
            setShareMessageText('');
        } catch (e) {
            showToast.warn("Failed to share.");
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
    const checklistTemplates = useMemo(() => (state.inspectionTemplates || []).filter((t: InspectionTemplate) => !t.isHiringPacket), [state.inspectionTemplates]);
    
    return (
        <div className="space-y-6">
             <JobAppointmentModal isOpen={!!editingFullJob} onClose={() => setEditingFullJob(null)} jobToEdit={editingFullJob} />
             <JobAppointmentModal isOpen={!!followUpParentJob} onClose={() => setFollowUpParentJob(null)} parentJobToLink={followUpParentJob} />
             <Modal isOpen={!!editingCrewJob} onClose={() => setEditingCrewJob(null)} title={t("Manage Job Crew")}>
                 {editingCrewJob && (
                     <div className="space-y-4">
                          <p className="text-sm text-gray-500">{t("Select additional technicians assisting on this job.")}</p>
                          <div className="max-h-60 overflow-y-auto border p-2 rounded">
                             {employees.filter(u => u.id !== editingCrewJob.assignedTechnicianId).map(u => (
                                 <label key={u.id} className="flex items-center gap-2 p-2 hover:bg-gray-100 cursor-pointer">
                                     <input type="checkbox" checked={crewSelection.includes(u.id)} onChange={() => setCrewSelection(prev => prev.includes(u.id) ? prev.filter(id => id !== u.id) : [...prev, u.id])} />
                                     <span>{u.firstName} {u.lastName}</span>
                                 </label>
                             ))}
                          </div>
                          <div className="flex justify-end gap-2">
                              <Button variant="secondary" onClick={() => setEditingCrewJob(null)}>{t("Cancel")}</Button>
                              <Button onClick={async () => {
                                  await db.collection('jobs').doc(editingCrewJob.id).update(cleanUndefinedFields({ assistants: crewSelection }));
                                  dispatch({ type: 'UPDATE_JOB', payload: { ...editingCrewJob, assistants: crewSelection } });
                                  setEditingCrewJob(null);
                              }}>{t("Save Crew")}</Button>
                          </div>
                     </div>
                 )}
             </Modal>

             <Modal isOpen={isSmsModalOpen} onClose={() => setIsSmsModalOpen(false)} title={`${t("Text Customer:")} ${smsJob?.customerName}`}>
                 <div className="space-y-4">
                     <Textarea 
                        label={t("SMS Message")}
                        value={smsMessage} 
                        onChange={e => setSmsMessage(e.target.value)} 
                        rows={4}
                     />
                     <div className="flex justify-end gap-2">
                         <Button variant="secondary" onClick={() => setIsSmsModalOpen(false)}>{t("Cancel")}</Button>
                         <Button disabled={isSending} onClick={async () => {
                             setIsSending(true);
                             try {
                                 // Add an SMS integration later via Twilio/Firebase
                                 showToast.warn('SMS feature is scheduled for next update. Your business number will be linked here.');
                                 setIsSmsModalOpen(false);
                             } finally {
                                 setIsSending(false);
                             }
                         }}>{isSending ? t('Sending...') : t('Send Text')}</Button>
                     </div>
                 </div>
             </Modal>

             <Modal isOpen={!!editingDocsJob} onClose={() => setEditingDocsJob(null)} title={t("Required Job Documents")}>
                {editingDocsJob && (
                    <div className="space-y-6">
                        {editingDocsJob.files && editingDocsJob.files.length > 0 && (
                            <div>
                                <h4 className="font-bold text-sm text-gray-700 dark:text-gray-300 mb-2">{t("Completed Documents")}</h4>
                                <div className="space-y-2 max-h-32 overflow-y-auto border p-2 rounded bg-slate-50 dark:bg-slate-700 dark:border-slate-600">
                                    {editingDocsJob.files.map((file, i) => {
                                        const displayTitle = file.metadata?.label || file.fileName?.replace(/_/g, ' ').replace('.html', '').replace('.pdf', '') || 'Document';
                                        return (
                                            <button 
                                                key={file.id || i}
                                                type="button"
                                                onClick={() => setPreviewDoc({ ...file, type: 'Other', title: displayTitle })}
                                                className="w-full text-left p-2 px-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-750 rounded-lg text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center justify-between hover:bg-slate-100 dark:hover:bg-slate-750 transition-colors shadow-sm"
                                            >
                                                <span className="flex items-center gap-2"><FileText size={14} className="text-primary-500" /> {displayTitle}</span>
                                                <span className="text-primary-500 font-bold text-[10px]">{t("VIEW")}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                        <div>
                            <h4 className="font-bold text-sm text-gray-700 dark:text-gray-300 mb-2">{t("Required Waivers")}</h4>
                            <div className="max-h-32 overflow-y-auto border p-2 rounded bg-slate-50 dark:bg-slate-700 dark:border-slate-600">
                                {waiverTemplates.map(tOption => (
                                    <label key={tOption.id} className="flex items-center gap-2 p-2 hover:bg-slate-100 dark:hover:bg-slate-600 cursor-pointer">
                                        <input type="checkbox" checked={selectedWaivers.includes(tOption.id)} onChange={() => setSelectedWaivers(prev => prev.includes(tOption.id) ? prev.filter(id => id !== tOption.id) : [...prev, tOption.id])} className="rounded text-primary-600"/>
                                        <span className="text-sm dark:text-slate-100">{tOption.title}</span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        <div>
                            <h4 className="font-bold text-sm text-gray-700 dark:text-gray-300 mb-2">{t("Step 2: Diagnosis Checklists")}</h4>
                            <div className="max-h-32 overflow-y-auto border p-2 rounded bg-slate-50 dark:bg-slate-700 dark:border-slate-600">
                                {checklistTemplates.map(tOption => (
                                    <label key={tOption.id} className="flex items-center gap-2 p-2 hover:bg-slate-100 dark:hover:bg-slate-600 cursor-pointer">
                                        <input type="checkbox" checked={selectedDiagChecklists.includes(tOption.id)} onChange={() => setSelectedDiagChecklists(prev => prev.includes(tOption.id) ? prev.filter(id => id !== tOption.id) : [...prev, tOption.id])} className="rounded text-blue-600"/>
                                        <span className="text-sm dark:text-slate-100">{tOption.name}</span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        <div>
                            <h4 className="font-bold text-sm text-gray-700 dark:text-gray-300 mb-2">{t("Step 4: Quality Checklists")}</h4>
                            <div className="max-h-32 overflow-y-auto border p-2 rounded bg-slate-50 dark:bg-slate-700 dark:border-slate-600">
                                {checklistTemplates.map(tOption => (
                                    <label key={tOption.id} className="flex items-center gap-2 p-2 hover:bg-slate-100 dark:hover:bg-slate-600 cursor-pointer">
                                        <input type="checkbox" checked={selectedQualChecklists.includes(tOption.id)} onChange={() => setSelectedQualChecklists(prev => prev.includes(tOption.id) ? prev.filter(id => id !== tOption.id) : [...prev, tOption.id])} className="rounded text-green-600"/>
                                        <span className="text-sm dark:text-slate-100">{tOption.name}</span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        <div className="flex justify-end gap-2 pt-2 border-t">
                            <Button variant="secondary" onClick={() => setEditingDocsJob(null)}>{t("Cancel")}</Button>
                            <Button onClick={saveDocs}>{t("Save Requirements")}</Button>
                        </div>
                    </div>
                )}
             </Modal>

             <Modal isOpen={!!editingNotesJob} onClose={() => setEditingNotesJob(null)} title={t("Internal Job Notes")}>
                 <div className="space-y-4">
                     <Textarea 
                        label={t("Office/Dispatch Notes (Visible to Techs)")}
                        value={internalNotes} 
                        onChange={e => setInternalNotes(e.target.value)} 
                        rows={6}
                        placeholder={t("Enter specific instructions, gate codes, or internal reminders...")}
                     />
                     <div className="flex justify-end gap-2">
                         <Button variant="secondary" onClick={() => setEditingNotesJob(null)}>{t("Cancel")}</Button>
                         <Button onClick={saveNotes}>{t("Save Notes")}</Button>
                     </div>
                 </div>
             </Modal>

             <Modal isOpen={!!shareModalJob} onClose={() => setShareModalJob(null)} title={`${t("Share Job:")} ${shareModalJob?.customerName}`}>
                 <div className="space-y-4">
                     <p className="text-sm text-slate-500">{t("Send this job to a supervisor or admin in your organization.")}</p>
                     <select 
                         aria-label={t("Select Share Recipient")}
                         title={t("Select Share Recipient")}
                        className="w-full border rounded-lg p-2 text-slate-900 dark:text-white dark:bg-slate-800 dark:border-slate-700 bg-white"
                         value={shareTargetId}
                         onChange={e => setShareTargetId(e.target.value)}
                     >
                         <option value="">{t("Select Recipient...")}</option>
                         {state.users.filter((u: User) => 
                             u.organizationId === state.currentOrganization?.id && 
                             u.id !== state.currentUser?.id && 
                             u.role !== 'customer'
                         ).map((u: User) => (
                             <option key={u.id} value={u.id}>{u.firstName} {u.lastName} ({u.role ? t(u.role) : ''})</option>
                         ))}
                     </select>
                     <Textarea 
                         placeholder={t("Add an optional message...")}
                         value={shareMessageText}
                         onChange={e => setShareMessageText(e.target.value)}
                     />
                     <div className="flex justify-end gap-2">
                         <Button variant="secondary" onClick={() => setShareModalJob(null)}>{t("Cancel")}</Button>
                         <Button onClick={handleShareJob} disabled={!shareTargetId || isSending}>
                             {isSending ? t('Sending...') : t('Send Message')}
                         </Button>
                     </div>
                 </div>
             </Modal>

            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4 px-1">
                <div className="flex items-center gap-4">
                    <h3 className="font-bold text-gray-800 dark:text-white">{t("Active Jobs")}</h3>
                    <button
                        onClick={() => setFilterFollowUpOnly(!filterFollowUpOnly)}
                        className={`text-xs px-3 py-1.5 rounded-full font-bold transition-all border flex items-center gap-1.5 ${
                            filterFollowUpOnly 
                                ? 'bg-amber-500 text-white border-amber-600 shadow-sm animate-pulse' 
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-200'
                        }`}
                    >
                        <span>⚠️</span> {t("Follow-up Queue")} ({needsFollowUpCount})
                    </button>
                    <button
                        onClick={() => setShowArchived(!showArchived)}
                        className={`text-xs px-3 py-1.5 rounded-full font-bold transition-all border flex items-center gap-1.5 ${
                            showArchived 
                                ? 'bg-indigo-600 text-white border-indigo-700 shadow-sm' 
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-200'
                        }`}
                    >
                        <span>📦</span> {t("Show Removed/Archived")}
                    </button>
                </div>
                <div className="flex items-center gap-2 text-sm">
                    <label className="font-medium text-slate-600 dark:text-slate-300">{t("Sort by:")}</label>
                    <select 
                        aria-label={t("Sort Jobs")}
                        className="border rounded-lg p-1.5 dark:bg-slate-800 dark:border-slate-600 text-slate-700 dark:text-slate-200"
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value)}
                    >
                        <option value="date_desc">{t("Newest First")}</option>
                        <option value="date_asc">{t("Oldest First")}</option>
                        <option value="name_asc">{t("Customer (A-Z)")}</option>
                        <option value="name_desc">{t("Customer (Z-A)")}</option>
                        <option value="status">{t("Status")}</option>
                        <option value="tech_asc">{t("Technician (A-Z)")}</option>
                    </select>
                </div>
            </div>

            {/* Search and Filters Bar */}
            <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800/60 p-3 rounded-2xl mb-4 flex flex-col md:flex-row gap-3 items-stretch md:items-center shadow-inner">
                {/* Search Input */}
                <div className="relative flex-1">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-slate-400">
                        <Search size={16} />
                    </span>
                    <input
                        type="text"
                        placeholder={t("Search by customer, PO/WO, system, task, address...")}
                        className="w-full pl-10 pr-10 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-xl dark:bg-slate-900 bg-white text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all shadow-sm"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                    {searchTerm && (
                        <button
                            onClick={() => setSearchTerm('')}
                            className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-650 dark:hover:text-slate-200"
                        >
                            <span>✕</span>
                        </button>
                    )}
                </div>

                {/* Customer Dropdown Filter */}
                <div className="flex flex-col sm:flex-row gap-3">
                    <select
                        aria-label={t("Filter by Customer")}
                        className="border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm bg-white dark:bg-slate-900 text-slate-750 dark:text-slate-200 shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 font-bold min-w-[200px]"
                        value={customerFilter}
                        onChange={e => setCustomerFilter(e.target.value)}
                    >
                        <option value="">{t("All Customers")}</option>
                        {state.customers?.slice().sort((a: any, b: any) => (a.name || '').localeCompare(b.name || '')).map((c: any) => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="md:hidden space-y-4">
                {allJobs.length === 0 ? (
                    <div className="bg-white dark:bg-gray-800 p-8 rounded-xl border border-dashed border-gray-300 dark:border-gray-700 flex flex-col items-center justify-center text-center shadow-sm">
                        <div className="bg-gray-100 dark:bg-gray-700 p-3 rounded-full mb-3">
                            <Calendar size={24} className="text-gray-400" />
                        </div>
                        <h3 className="font-bold text-gray-900 dark:text-white mb-1">
                            {searchTerm || customerFilter ? t("No Matching Results") : t("No Active Jobs")}
                        </h3>
                        <p className="text-[11px] text-gray-500">
                            {searchTerm || customerFilter 
                                ? t("Try adjusting your search query or customer filter.") 
                                : t("There are no upcoming jobs right now.")}
                        </p>
                    </div>
                ) : (
                    (allJobs as Job[]).map((job: Job) => {
                        const customer = state.customers?.find(c => c.id === job.customerId);
                        const poNumber = job.poNumber || job.invoice?.poNumber || state.proposals?.find((p: any) => p.id === job.proposalId)?.poNumber;
                        return (
                            <div key={job.id} className={`p-4 rounded-xl border bg-white dark:bg-gray-800 shadow-sm transition-all ${job.assignedPartnerId === state.currentOrganization?.id ? 'border-blue-200 bg-blue-50/30' : 'border-gray-200 dark:border-gray-700'}`}>
                                <div className="flex justify-between items-start mb-3">
                                <div>
                                    <h3 className="font-bold text-gray-900 dark:text-white">{customer?.name || job.customerName}</h3>
                                    {job.proposalId && (
                                        <div className="flex items-center gap-1 text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-tighter">
                                            <FileText size={10} /> {t("Linked Proposal")}
                                        </div>
                                    )}
                                    <p className="text-[10px] text-gray-500 flex items-center gap-1 mt-0.5"><MapPin size={10}/> {formatAddress(job.address || customer?.address)}</p>
                                </div>
                                <span className={`px-2 py-0.5 text-[10px] rounded-full font-bold ${
                                    job.invoice?.status === 'Paid' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                                }`}>
                                    {job.invoice?.status}
                                </span>
                            </div>

                            {/* Linked Documents in Mobile Card */}
                            <div className="mb-3 px-1">
                                <label className="text-[9px] uppercase font-black text-gray-400 block mb-1">{t("Linked Documents")}</label>
                                <div className="flex flex-wrap gap-1.5">
                                    {/* Proposal Badge */}
                                    {(() => {
                                        const proposal = state.proposals?.find((p: any) => p.id === job.proposalId || p.jobId === job.id || (job.invoice?.id && p.invoiceId === job.invoice.id));
                                        if (!proposal) return null;
                                        return (
                                            <span 
                                                onClick={() => setViewingProposal(proposal)}
                                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border border-blue-100 dark:border-blue-800/50 cursor-pointer hover:bg-blue-100 transition-colors"
                                            >
                                                <Briefcase size={10} />
                                                {proposal.id}
                                            </span>
                                        );
                                    })()}

                                    {/* Job Badge */}
                                    <span 
                                        onClick={() => setViewingJob(job)}
                                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-800/50 cursor-pointer hover:bg-indigo-100 transition-colors"
                                    >
                                        <Briefcase size={10} />
                                        {`JOB-${job.id.replace('job-', '')}`}
                                    </span>

                                    {/* Invoice Badge */}
                                    {job.invoice && (
                                        <span 
                                            onClick={() => setViewingInvoiceJob(job)}
                                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800/50 cursor-pointer hover:bg-emerald-100 transition-colors"
                                        >
                                            <DollarSign size={10} />
                                            {job.invoice.id ? `INV-${job.invoice.id.replace('INV-', '')}` : t('Invoice Started')}
                                        </span>
                                    )}

                                    {/* Work Order Badge */}
                                    {poNumber && (
                                        <span 
                                            onClick={() => dispatch({ type: 'SET_VIEWING_WORK_ORDER', payload: { workOrderNumber: poNumber, customerId: job.customerId } })}
                                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/50 cursor-pointer hover:bg-rose-100 dark:hover:bg-rose-900/40 transition-colors shadow-sm font-sans"
                                            title={t("View Work Order Associations")}
                                        >
                                            <Briefcase size={10} />
                                            {`WO: ${poNumber}`}
                                        </span>
                                    )}

                                    {/* Sign-Off Sheet Badge */}
                                    {(() => {
                                        const file = (job.files || []).find((f: any) => f.fileName === 'SignOff_Sheet.html' || f.metadata?.label === 'Sign-Off Sheet' || f.id?.startsWith('signoff-doc'));
                                        return (
                                            <span 
                                                onClick={() => {
                                                    if (file) {
                                                        setPreviewOtherDoc({ ...file, type: 'Other', title: t('Sign-Off Sheet') });
                                                    } else {
                                                        setActiveSignOffJob(job);
                                                    }
                                                }}
                                                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold border cursor-pointer transition-colors shadow-sm ${
                                                    file 
                                                    ? 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-100 dark:border-amber-800/50 hover:bg-amber-100' 
                                                    : 'bg-slate-50 text-slate-600 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-amber-50 hover:text-amber-700'
                                                }`}
                                                title={file ? t("View Sign-Off Sheet") : t("Open Blank Sign-off Sheet to Sign")}
                                            >
                                                <ShieldCheck size={10} />
                                                {file ? t('✍️ Sign-off') : t('✍️ + Sign-off')}
                                            </span>
                                        );
                                    })()}

                                    {/* Subcontractor Bill Badge - ONLY shown if assigned to a subcontractor */}
                                    {(() => {
                                        const isSubassigned = !!(job.assignedSubcontractorId || job.subcontractorId || job.subcontractorName || job.subcontractor || job.subcontractorCompany || job.subcontractorEmail);
                                        if (!isSubassigned) return null;
                                        const file = (job.files || []).find((f: any) => f.fileName === 'Subcontractor_Bill.html' || f.metadata?.label === 'Subcontractor Bill' || f.id?.startsWith('subcontractorbill-doc') || f.fileName?.startsWith('Subcontractor_Bill_'));
                                        return (
                                            <span 
                                                onClick={() => {
                                                    if (file) {
                                                        setPreviewOtherDoc({ ...file, type: 'Other', title: t('Subcontractor Bill') });
                                                    } else {
                                                        setViewingWorkOrderJob(job);
                                                    }
                                                }}
                                                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold border cursor-pointer transition-colors shadow-sm ${
                                                    file 
                                                    ? 'bg-teal-50 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400 border-teal-100 dark:border-teal-800/50 hover:bg-teal-100' 
                                                    : 'bg-slate-50 text-slate-600 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-teal-50 hover:text-teal-700'
                                                }`}
                                                title={file ? t("View Subcontractor Bill") : t("View Subcontractor Work Order / Bill")}
                                            >
                                                <DollarSign size={10} />
                                                {file ? t('💵 Sub Bill') : t('💵 + Sub Bill')}
                                            </span>
                                        );
                                    })()}
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3 mb-4">
                                <div className="space-y-1">
                                    <label className="text-[9px] uppercase font-black text-gray-400">{t("Unit/System")}</label>
                                    <p className="text-xs font-bold text-blue-600 truncate">{job.hvacBrand || '---'}</p>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[9px] uppercase font-black text-gray-400">{t("Time")}</label>
                                    <p className="text-xs font-medium text-gray-700 dark:text-gray-300">
                                        {new Date(job.appointmentTime).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                    </p>
                                </div>
                            </div>

                            <div className="flex flex-wrap gap-2 items-center justify-between pt-3 border-t border-gray-100 dark:border-gray-700">
                                <div className="flex gap-2">
                                    <button onClick={() => setEditingFullJob(job)} className="text-emerald-600 p-1 bg-slate-50 dark:bg-slate-700 rounded rounded-l-none" aria-label={t("Edit Appointment Details")} title={t("Edit Appointment Details")}><Edit size={16}/></button>
                                    {job.jobStatus === 'Needs Follow-up' && (
                                        <button onClick={() => setFollowUpParentJob(job)} className="text-amber-600 p-1 bg-amber-50 dark:bg-amber-950/20 rounded" aria-label={t("Schedule Return Visit")} title={t("Schedule Return Visit")}><CalendarPlus size={16}/></button>
                                    )}
                                    <button onClick={() => openSmsModal(job)} className="text-blue-500 p-1 bg-slate-50 dark:bg-slate-700 rounded" aria-label={t("SMS Customer")} title={t("SMS Customer")}><MessageSquare size={16}/></button>
                                    <button onClick={() => openNotesModal(job)} className="text-amber-500 p-1 bg-slate-50 dark:bg-slate-700 rounded" aria-label={t("Internal Notes")} title={t("Internal Notes")}><AlignLeft size={16}/></button>
                                    <button onClick={() => openDocsModal(job)} className="text-slate-500 p-1 bg-slate-50 dark:bg-slate-700 rounded" aria-label={t("Documents and Checklists")} title={t("Documents and Checklists")}><FileText size={16}/></button>
                                    <button onClick={() => handleCopyRef(job.id)} className="text-emerald-500 p-1 bg-slate-50 dark:bg-slate-700 rounded" aria-label={t("Copy Job Link")} title={t("Copy Job Link")}><Copy size={16}/></button>
                                    <button onClick={() => setShareModalJob(job)} className="text-primary-500 p-1 bg-slate-50 dark:bg-slate-700 rounded" aria-label={t("Share with Staff")} title={t("Share with Staff")}><Share2 size={16}/></button>
                                </div>
                                <div className="flex gap-2">
                                    <select 
                                        aria-label={t("Update Job Status")}
                                        title={t("Update Job Status")}
                                        value={job.jobStatus} 
                                        onChange={(e) => handleJobUpdate(job.id, 'jobStatus', e.target.value)} 
                                        className="text-[10px] border border-gray-300 dark:border-gray-600 rounded p-1 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white font-bold focus:ring-1 focus:ring-primary-500"
                                    >
                                        <option value="Scheduled">{t("Scheduled")}</option>
                                        <option value="In Progress">{t("In Progress")}</option>
                                        <option value="Completed">{t("Completed")}</option>
                                        <option value="Needs Follow-up">{t("Needs Follow-up")}</option>
                                        <option value="Cancelled">{t("Cancelled")}</option>
                                    </select>
                                    <button onClick={() => handleDeleteJob(job.id)} aria-label={t("Delete Job")} title={t("Delete Job")} className="text-red-500 p-1 ml-1"><Trash2 size={18}/></button>
                                </div>
                            </div>
                            
                            <div className="mt-3">
                                <select 
                                    aria-label={t("Assign Technician")}
                                    title={t("Assign Technician")}
                                    value={job.assignedTechnicianId || (job.assignedPartnerId && job.assignedPartnerId !== state.currentOrganization?.id ? `partner:${job.assignedPartnerId}` : '')} 
                                    onChange={(e) => handleAssignmentChange(job, e.target.value)} 
                                    className="w-full text-xs border border-gray-300 dark:border-gray-600 rounded-lg p-2 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white font-medium focus:ring-1 focus:ring-primary-500"
                                >
                                    <option value="">{t("Assign Technician...")}</option>
                                    <optgroup label={t("Internal Technicians")}>
                                        {employees.map(tech => <option key={tech.id} value={tech.id}>{tech.firstName} {tech.lastName}</option>)}
                                    </optgroup>
                                    {linkedPartners.length > 0 && (
                                        <optgroup label={t("Partner Network")}>
                                            {linkedPartners.map(p => <option key={p.id} value={`partner:${p.linkedOrgId}`}>{p.companyName}</option>)}
                                        </optgroup>
                                    )}
                                </select>
                            </div>
                        </div>
                        );
                    })
                )}
            </div>

            <Card className="hidden md:block">
                {allJobs.length === 0 ? (
                    <div className="p-12 flex flex-col items-center justify-center text-center bg-gray-50/50 dark:bg-gray-800/50 rounded-lg">
                        <Calendar size={32} className="text-gray-300 mb-4" />
                        <h3 className="font-bold text-gray-700 dark:text-gray-200">
                            {searchTerm || customerFilter ? t("No Matching Results") : t("No Active Jobs")}
                        </h3>
                        <p className="text-sm text-gray-500">
                            {searchTerm || customerFilter 
                                ? t("Try adjusting your search query or customer filter.") 
                                : t("Your dispatch board is clear. Time to book some calls!")}
                        </p>
                    </div>
                ) : (
                    <Table headers={[t('Customer & Site Location'), t('Unit/System'), t('Appointment & Site Visit'), t('Invoice Status'), t('Linked Documents'), t('Job Status'), t('Assigned Tech / Partner'), t('Crew')]}>
                        {(allJobs as Job[]).map((job: Job) => {
                            const customer = state.customers?.find(c => c.id === job.customerId || c.name === job.customerName);
                            const loc = customer?.serviceLocations?.find((l: any) => l.id === job.locationId || l.address === job.address || l.name === job.locationName || l.propertyName === job.locationName);
                            const techUser = state.users?.find(u => u.id === job.assignedTechnicianId);
                            const isSubcontractor = !!(job.assignedPartnerId || techUser?.role?.toLowerCase() === 'subcontractor' || job.assignedTechnicianName?.toLowerCase().includes('subcontractor'));
                            const poNumber = job.poNumber || job.invoice?.poNumber || state.proposals?.find((p: any) => p.id === job.proposalId)?.poNumber;
                            const payingCustomerName = customer?.name || (customer as any)?.companyName || job.customerName || 'Customer';
                            const siteLocationName = job.locationName || loc?.name || loc?.propertyName || '';
                            const siteAddress = formatAddress(job.address || loc?.address || customer?.address || '');

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
                                <tbody key={job.id} className="border-b border-slate-200 dark:border-slate-700 last:border-b-0">
                                    <tr id={`job-card-${job.id}`} className={`${job.assignedPartnerId === state.currentOrganization?.id ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}>
                                        <td className="px-6 py-4 whitespace-nowrap font-bold text-sm">
                                            <div className="flex flex-col gap-1 max-w-[220px]">
                                                <div>
                                                    <span className="text-[9px] font-extrabold uppercase text-slate-400 dark:text-slate-500 tracking-wider block">Customer</span>
                                                    <span className="text-slate-900 dark:text-white font-black text-xs tracking-tight block truncate" title={payingCustomerName}>
                                                        {payingCustomerName}
                                                    </span>
                                                </div>

                                                {(siteLocationName || siteAddress) && (
                                                    <div className="pt-0.5 border-t border-slate-100 dark:border-slate-800">
                                                        <span className="text-[9px] font-extrabold uppercase text-indigo-500 dark:text-indigo-400 tracking-wider flex items-center gap-1">
                                                            <MapPin size={9} /> Site Location
                                                        </span>
                                                        {siteLocationName && siteLocationName !== payingCustomerName && (
                                                            <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block truncate" title={siteLocationName}>
                                                                {siteLocationName}
                                                            </span>
                                                        )}
                                                        {siteAddress && (
                                                            <span className="text-[10px] text-gray-400 font-normal block truncate" title={siteAddress}>
                                                                {siteAddress}
                                                            </span>
                                                        )}
                                                    </div>
                                                )}

                                                {job.proposalId && (
                                                    <div className="flex items-center gap-1 text-[9px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-tighter mt-0.5">
                                                        <FileText size={10} /> {t("Linked Proposal")}
                                                    </div>
                                                )}
                                                {job.assignedPartnerId === state.currentOrganization?.id && <span className="text-[10px] text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 px-1 rounded bg-white dark:bg-slate-800 inline-block w-max">{t("Assigned to You")}</span>}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-xs text-blue-600 dark:text-blue-400 font-bold">{job.hvacBrand || '---'}</td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex flex-col gap-1 min-w-[150px]">
                                                <div>
                                                    <span className="text-[9px] font-extrabold uppercase text-slate-400 dark:text-slate-500 tracking-wider block">Scheduled Appt</span>
                                                    <input 
                                                        type="datetime-local" 
                                                        aria-label={t("Appointment Time")} 
                                                        title={t("Appointment Time")} 
                                                        value={formatDateTimeForInput(job.appointmentTime)} 
                                                        onChange={(e) => handleJobUpdate(job.id, 'appointmentTime', new Date(e.target.value).toISOString())} 
                                                        className="bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white text-xs rounded p-1 focus:ring-1 focus:ring-primary-500 font-bold"
                                                    />
                                                </div>
                                                {(formattedIn || formattedOut || formattedDuration) ? (
                                                    <div className="pt-1 border-t border-slate-100 dark:border-slate-800 space-y-0.5">
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
                                                    <span className="text-[10px] text-slate-400 dark:text-slate-500 italic block pt-0.5">No check-in recorded</span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap"><span className="px-2 py-1 text-[10px] rounded-full bg-slate-100 dark:bg-slate-850 text-slate-800 dark:text-slate-200 font-bold">{job.invoice?.status}</span></td>
                                        <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-500">
                                            <div className="flex flex-wrap gap-1.5 max-w-[240px]">
                                                {/* Proposal Badge */}
                                                {(() => {
                                                    const proposal = state.proposals?.find((p: any) => p.id === job.proposalId || p.jobId === job.id || (job.invoice?.id && p.invoiceId === job.invoice.id));
                                                    if (!proposal) return null;
                                                    return (
                                                        <span 
                                                            onClick={() => setViewingProposal(proposal)}
                                                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border border-blue-100 dark:border-blue-800/50 cursor-pointer hover:bg-blue-100 transition-colors"
                                                        >
                                                            <Briefcase size={10} />
                                                            {proposal.id}
                                                        </span>
                                                    );
                                                })()}

                                                {/* Job Badge */}
                                                <span 
                                                    onClick={() => setViewingJob(job)}
                                                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-800/50 cursor-pointer hover:bg-indigo-100 transition-colors"
                                                >
                                                    <Briefcase size={10} />
                                                    {`JOB-${job.id.replace('job-', '')}`}
                                                </span>

                                                {/* Invoice Badge */}
                                                {job.invoice && (
                                                    <span 
                                                        onClick={() => setViewingInvoiceJob(job)}
                                                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800/50 cursor-pointer hover:bg-emerald-100 transition-colors"
                                                    >
                                                        <DollarSign size={10} />
                                                        {job.invoice.id ? `INV-${job.invoice.id.replace('INV-', '')}` : t('Invoice Started')}
                                                    </span>
                                                )}

                                                {/* Work Order Badge */}
                                                {poNumber && (
                                                    <span 
                                                        onClick={() => dispatch({ type: 'SET_VIEWING_WORK_ORDER', payload: { workOrderNumber: poNumber, customerId: job.customerId } })}
                                                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/50 cursor-pointer hover:bg-rose-100 dark:hover:bg-rose-900/40 transition-colors shadow-sm font-sans"
                                                        title={t("View Work Order Associations")}
                                                    >
                                                        <Briefcase size={10} />
                                                        {`WO: ${poNumber}`}
                                                    </span>
                                                )}

                                                {/* Sign-Off Sheet Badge */}
                                                {(() => {
                                                    const file = (job.files || []).find((f: any) => f.fileName === 'SignOff_Sheet.html' || f.metadata?.label === 'Sign-Off Sheet' || f.id?.startsWith('signoff-doc'));
                                                    return (
                                                        <span 
                                                            onClick={() => {
                                                                if (file) {
                                                                    setPreviewOtherDoc({ ...file, type: 'Other', title: t('Sign-Off Sheet') });
                                                                } else {
                                                                    setActiveSignOffJob(job);
                                                                }
                                                            }}
                                                            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold border cursor-pointer transition-colors shadow-sm ${
                                                                file 
                                                                ? 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-100 dark:border-amber-800/50 hover:bg-amber-100' 
                                                                : 'bg-slate-50 text-slate-600 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-amber-50 hover:text-amber-700'
                                                            }`}
                                                            title={file ? t("View Sign-Off Sheet") : t("Open Blank Sign-off Sheet to Sign")}
                                                        >
                                                            <ShieldCheck size={10} />
                                                            {file ? t('✍️ Sign-off') : t('✍️ + Sign-off')}
                                                        </span>
                                                    );
                                                })()}

                                                {/* Subcontractor Bill Badge - ONLY shown if assigned to a subcontractor */}
                                                {(() => {
                                                    const isSubassigned = !!(job.assignedSubcontractorId || job.subcontractorId || job.subcontractorName || job.subcontractor || job.subcontractorCompany || job.subcontractorEmail);
                                                    if (!isSubassigned) return null;
                                                    const file = (job.files || []).find((f: any) => f.fileName === 'Subcontractor_Bill.html' || f.metadata?.label === 'Subcontractor Bill' || f.id?.startsWith('subcontractorbill-doc') || f.fileName?.startsWith('Subcontractor_Bill_'));
                                                    return (
                                                        <span 
                                                            onClick={() => {
                                                                if (file) {
                                                                    setPreviewOtherDoc({ ...file, type: 'Other', title: t('Subcontractor Bill') });
                                                                } else {
                                                                    setViewingWorkOrderJob(job);
                                                                }
                                                            }}
                                                            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold border cursor-pointer transition-colors shadow-sm ${
                                                                file 
                                                                ? 'bg-teal-50 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400 border-teal-100 dark:border-teal-800/50 hover:bg-teal-100' 
                                                                : 'bg-slate-50 text-slate-600 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-teal-50 hover:text-teal-700'
                                                            }`}
                                                            title={file ? t("View Subcontractor Bill") : t("View Subcontractor Work Order / Bill")}
                                                        >
                                                            <DollarSign size={10} />
                                                            {file ? t('💵 Sub Bill') : t('💵 + Sub Bill')}
                                                        </span>
                                                    );
                                                })()}
                                            </div>
                                        </td>
                                         <td className="px-6 py-4 whitespace-nowrap">
                                            <select aria-label={t("Update Job Status")} title={t("Update Job Status")} value={job.jobStatus} onChange={(e) => handleJobUpdate(job.id, 'jobStatus', e.target.value)} className="text-xs border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded p-1 focus:ring-1 focus:ring-primary-500">
                                                <option value="Scheduled">{t("Scheduled")}</option>
                                                <option value="In Progress">{t("In Progress")}</option>
                                                <option value="Completed">{t("Completed")}</option>
                                                <option value="Needs Follow-up">{t("Needs Follow-up")}</option>
                                                <option value="Cancelled">{t("Cancelled")}</option>
                                            </select>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <select 
                                                aria-label={t("Assign Technician")}
                                                title={t("Assign Technician")}
                                                value={job.assignedTechnicianId || (job.assignedPartnerId && job.assignedPartnerId !== state.currentOrganization?.id ? `partner:${job.assignedPartnerId}` : '')} 
                                                onChange={(e) => handleAssignmentChange(job, e.target.value)} 
                                                className="text-xs border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded p-1 max-w-[150px] focus:ring-1 focus:ring-primary-500"
                                            >
                                                <option value="">{t("Unassigned")}</option>
                                                <optgroup label={t("Internal Technicians")}>
                                                    {employees.map(tech => <option key={tech.id} value={tech.id}>{tech.firstName} {tech.lastName}</option>)}
                                                </optgroup>
                                                {linkedPartners.length > 0 && (
                                                    <optgroup label={t("Partner Network")}>
                                                        {linkedPartners.map(p => <option key={p.id} value={`partner:${p.linkedOrgId}`}>{p.companyName}</option>)}
                                                    </optgroup>
                                                )}
                                            </select>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap"><button onClick={() => openCrewModal(job)} className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 px-2 py-1 rounded font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">{t("Crew")} ({job.assistants?.length || 0})</button></td>
                                    </tr>
                                    <tr className="bg-slate-50/40 dark:bg-slate-900/10 border-t-0">
                                        <td colSpan={8} className="px-6 py-2 border-t-0">
                                            <div className="flex flex-wrap gap-2 items-center text-xs">
                                                <span className="font-black text-slate-400 uppercase tracking-widest text-[9px] mr-2">{t("Actions")}:</span>
                                                
                                                <button 
                                                    onClick={() => setEditingFullJob(job)} 
                                                    className="flex items-center gap-1.5 px-2.5 py-1 bg-purple-50/60 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-900/40 rounded-md text-purple-700 dark:text-purple-300 hover:bg-purple-100/80 dark:hover:bg-purple-900/40 transition-colors font-bold shadow-sm"
                                                    title={t("Edit Appointment Details")}
                                                >
                                                    <Edit size={14} />
                                                    {t("Edit")}
                                                </button>
 
                                                {job.jobStatus === 'Needs Follow-up' && (
                                                    <button 
                                                        onClick={() => setFollowUpParentJob(job)} 
                                                        className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40 rounded-md text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100/80 dark:hover:bg-emerald-900/40 transition-colors font-bold shadow-sm"
                                                        title={t("Schedule Return Visit")}
                                                    >
                                                        <CalendarPlus size={14} />
                                                        {t("Return Visit")}
                                                    </button>
                                                )}
 
                                                <button 
                                                    onClick={() => openSmsModal(job)} 
                                                    className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/40 rounded-md text-blue-700 dark:text-blue-300 hover:bg-blue-100/80 dark:hover:bg-blue-900/40 transition-colors font-bold shadow-sm"
                                                    title={t("SMS Customer")}
                                                >
                                                    <MessageSquare size={14} />
                                                    {t("SMS")}
                                                </button>
 
                                                <button 
                                                    onClick={() => openNotesModal(job)} 
                                                    className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded-md text-amber-700 dark:text-amber-300 hover:bg-amber-100/80 dark:hover:bg-amber-900/40 transition-colors font-bold shadow-sm"
                                                    title={t("Internal Notes")}
                                                >
                                                    <AlignLeft size={14} />
                                                    {t("Notes")}
                                                </button>
 
                                                <button 
                                                    onClick={() => openDocsModal(job)} 
                                                    className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-50/60 dark:bg-slate-950/20 border border-slate-200 dark:border-slate-800 rounded-md text-slate-700 dark:text-slate-300 hover:bg-slate-100/80 dark:hover:bg-slate-900/40 transition-colors font-bold shadow-sm"
                                                    title={t("Documents & Checklists")}
                                                >
                                                    <FileText size={14} />
                                                    {t("Docs")}
                                                </button>

                                                <button 
                                                    onClick={() => setLinkingJob(job)} 
                                                    className="flex items-center gap-1.5 px-2.5 py-1 bg-cyan-50/60 dark:bg-cyan-950/20 border border-cyan-200 dark:border-cyan-900/40 rounded-md text-cyan-700 dark:text-cyan-300 hover:bg-cyan-100/80 dark:hover:bg-cyan-900/40 transition-colors font-bold shadow-sm"
                                                    title={t("Link / Associate Documents")}
                                                >
                                                    <Link2 size={14} />
                                                    {t("Associations")}
                                                </button>
 
                                                {isSubcontractor && (
                                                    <button 
                                                        onClick={() => setViewingWorkOrderJob(job)} 
                                                        className="flex items-center gap-1.5 px-2.5 py-1 bg-teal-50/60 dark:bg-teal-950/20 border border-teal-200 dark:border-teal-900/40 rounded-md text-teal-700 dark:text-teal-300 hover:bg-teal-100/80 dark:hover:bg-teal-900/40 transition-colors font-bold shadow-sm"
                                                        title={t("Subcontractor Work Order & Instructions")}
                                                    >
                                                        <FileText size={14} />
                                                        {t("Work Order")}
                                                    </button>
                                                )}
 
                                                <button 
                                                    onClick={() => handleCopyRef(job.id)} 
                                                    className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-50/60 dark:bg-slate-950/20 border border-slate-200 dark:border-slate-800 rounded-md text-slate-700 dark:text-slate-300 hover:bg-slate-100/80 dark:hover:bg-slate-900/40 transition-colors font-bold shadow-sm"
                                                    title={t("Copy Reference")}
                                                >
                                                    <Copy size={14} />
                                                    {t("Copy Ref")}
                                                </button>
 
                                                <button 
                                                    onClick={() => setShareModalJob(job)} 
                                                    className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/40 rounded-md text-blue-700 dark:text-blue-300 hover:bg-blue-100/80 dark:hover:bg-blue-900/40 transition-colors font-bold shadow-sm"
                                                    title={t("Share Job")}
                                                >
                                                    <Share2 size={14} />
                                                    {t("Share")}
                                                </button>
 
                                                <button 
                                                    onClick={() => handleDeleteJob(job.id)} 
                                                    className="flex items-center gap-1.5 px-2.5 py-1 bg-red-50/60 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 rounded-md text-red-700 dark:text-red-300 hover:bg-red-100/80 dark:hover:bg-red-900/40 transition-colors font-bold shadow-sm"
                                                    title={t("Delete Job")}
                                                >
                                                    <Trash2 size={14} />
                                                    {t("Delete")}
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                </tbody>
                            );
                        })}
                    </Table>
                )}
            </Card>
            {previewDoc && (
                <DocumentPreview 
                    type="Other" 
                    data={previewDoc} 
                    onClose={() => setPreviewDoc(null)} 
                    isInternal={true}
                />
            )}
            {viewingProposal && (
                <DocumentPreview 
                    type="Proposal" 
                    data={viewingProposal} 
                    onClose={() => setViewingProposal(null)} 
                />
            )}
            {viewingInvoiceJob && (
                <DocumentPreview 
                    type="Invoice" 
                    data={viewingInvoiceJob} 
                    onClose={() => setViewingInvoiceJob(null)} 
                    isInternal={true}
                />
            )}
            {previewOtherDoc && (
                <DocumentPreview 
                    type="Other" 
                    data={previewOtherDoc} 
                    onClose={() => setPreviewOtherDoc(null)} 
                    isInternal={true}
                />
            )}
            {viewingJob && (
                <JobDetailModal 
                    isOpen={!!viewingJob} 
                    onClose={() => setViewingJob(null)} 
                    job={viewingJob} 
                    isAdmin={true}
                />
            )}
            {viewingWorkOrderJob && (
                <SubcontractorWorkOrderModal 
                    isOpen={!!viewingWorkOrderJob} 
                    onClose={() => setViewingWorkOrderJob(null)} 
                    job={viewingWorkOrderJob} 
                />
            )}
            {linkingJob && (
                <JobLinkingModal 
                    isOpen={!!linkingJob} 
                    onClose={() => setLinkingJob(null)} 
                    job={linkingJob} 
                />
            )}
            {activeSignOffJob && (
                <SignOffModal 
                    isOpen={!!activeSignOffJob} 
                    onClose={() => setActiveSignOffJob(null)} 
                    job={activeSignOffJob}
                    onSave={async (file: any) => {
                        try {
                            const existingFiles = activeSignOffJob.files || [];
                            const updatedFiles = [...existingFiles, file];
                            await db.collection('jobs').doc(activeSignOffJob.id).update(cleanUndefinedFields({ files: updatedFiles }));
                            activeSignOffJob.files = updatedFiles;
                            dispatch({ type: 'UPDATE_JOB', payload: { ...activeSignOffJob, files: updatedFiles } });
                            showToast.success(t("Sign-off sheet saved successfully!"));
                        } catch (err) {
                            console.error("Error saving sign-off", err);
                        }
                        setActiveSignOffJob(null);
                    }}
                />
            )}
        </div>
    );
};

export default JobScheduling;
