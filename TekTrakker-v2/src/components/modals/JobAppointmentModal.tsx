import showToast from "lib/toast";

import React, { useState, useMemo } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { useAppContext } from 'context/AppContext';
import { db } from 'lib/firebase';

import type { Customer, Job, Subcontractor } from '../../types';
import CustomerSearch from './job-appointment/CustomerSearch';
import AssignmentType from './job-appointment/AssignmentType';
import CrewSelect from './job-appointment/CrewSelect';
import JobDetails from './job-appointment/JobDetails';
import AddSubcontractorModal from './AddSubcontractorModal';
import { hasPermission , cleanUndefinedFields } from 'lib/utils';
import { AlertCircle, Link2, FileText, UploadCloud, X, History, RotateCcw, Building2, Calendar, User, CheckCircle2 } from 'lucide-react';
import DocumentPreview from '../ui/DocumentPreview';
import { extractTextFromPdf, parseWorkOrderText } from '../../utils/workOrderParser';

interface JobAppointmentModalProps {
    isOpen: boolean;
    onClose: () => void;
    customerId?: string; // Optional customer ID for "create on the fly"
    jobToEdit?: Job | null;
    parentJobToLink?: Job | null;
}

const JOB_TYPES: Record<string, string[]> = {
    'HVAC': ['Repair', 'Maintenance', 'Installation', 'Estimate', 'Inspection', 'Service Call', 'Tune-Up'],
    'Plumbing': ['Leak Repair', 'Drain Cleaning', 'Water Heater', 'Installation', 'Estimate', 'Inspection'],
    'Electrical': ['Troubleshooting', 'Installation', 'Panel Upgrade', 'Lighting', 'Estimate', 'Inspection'],
    'Landscaping': ['Mowing', 'Pruning', 'Cleanup', 'Installation', 'Irrigation', 'Estimate'],
    'General': ['Repair', 'Installation', 'Estimate', 'Consultation', 'Service Call'],
    'Cleaning': ['Standard Clean', 'Deep Clean', 'Move-in/out', 'Commercial', 'Estimate'],
    'Painting': ['Interior', 'Exterior', 'Prep', 'Touch-up', 'Estimate'],
    'Roofing': ['Inspection', 'Repair', 'Replacement', 'Tarping', 'Estimate'],
    'Contracting': ['Renovation', 'Repair', 'New Build', 'Estimate', 'Consultation'],
    'Masonry': ['Repair', 'Installation', 'Restoration', 'Estimate'],
    'Telecommunications': ['Install', 'Repair', 'Troubleshoot', 'Estimate'],
    'Solar': ['Install', 'Maintenance', 'Repair', 'Cleaning', 'Estimate'],
    'Security': ['Install', 'Service', 'Monitoring Setup', 'Estimate'],
    'Pet Grooming': ['Grooming', 'Bath', 'Nail Trim', 'Check-up']
};

const JobAppointmentModal: React.FC<JobAppointmentModalProps> = ({ isOpen, onClose, customerId, jobToEdit, parentJobToLink }) => {
    const { state, dispatch } = useAppContext();
    const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
    
    // Update selected customer if customerId changes
    React.useEffect(() => {
        if (customerId) {
            setSelectedCustomer(state.customers.find(c => c.id === customerId) || null);
        } else if (!jobToEdit) {
            setSelectedCustomer(null);
        }
    }, [customerId, state.customers, jobToEdit]);

    // Form State
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [timeSlot, setTimeSlot] = useState('09:00');
    const [duration, setDuration] = useState(120); 
    const [jobType, setJobType] = useState('Repair');
    const [visitType, setVisitType] = useState('Diagnostic & Repair');
    const [assignMode, setAssignMode] = useState<'internal' | 'partner'>('internal');
    const [technicianId, setTechnicianId] = useState('');
    const [partnerId, setPartnerId] = useState('');
    const [assistantIds, setAssistantIds] = useState<string[]>([]);
    const [partnerPayoutAmount, setPartnerPayoutAmount] = useState<number | undefined>(undefined);
    const [notes, setNotes] = useState('');
    const [leadSource, setLeadSource] = useState('Call-In');
    const selectedProjectId = ''; 
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isHighPriority, setIsHighPriority] = useState(false);
    const [selectedPropertyId, setSelectedPropertyId] = useState('');
    const [proposalId, setProposalId] = useState('');
    const [poNumber, setPoNumber] = useState('');
    const [selectedParentJobId, setSelectedParentJobId] = useState('');
    const [previewDoc, setPreviewDoc] = useState<{ type: 'Proposal' | 'Invoice' | 'Other'; data: any } | null>(null);

    const customerJobs = useMemo(() => {
        if (!selectedCustomer) return [];
        return (state.jobs || [])
            .filter(j => j.customerId === selectedCustomer.id && j.id !== jobToEdit?.id && !j.deleted && !j.archived)
            .sort((a, b) => new Date(b.appointmentTime || b.createdAt || 0).getTime() - new Date(a.appointmentTime || a.createdAt || 0).getTime());
    }, [selectedCustomer, state.jobs, jobToEdit]);

    const handleSelectParentJob = (jobId: string) => {
        setSelectedParentJobId(jobId);
        if (!jobId) return;
        const parent = customerJobs.find(j => j.id === jobId);
        if (!parent) return;

        setDuration(parent.duration || 120);
        setJobType(parent.tasks && parent.tasks[0] ? parent.tasks[0] : 'Repair');
        setVisitType(parent.visitType || 'Repair');
        if (parent.locationId) {
            setSelectedPropertyId(parent.locationId);
        }
        if (parent.proposalId) {
            setProposalId(parent.proposalId);
        }
        if (parent.poNumber) {
            setPoNumber(parent.poNumber);
        }
        if (parent.divisionId) {
            setDivisionId(parent.divisionId);
        }

        const parentCode = parent.id.slice(-6).toUpperCase();
        const postponedPart = parent.repairPostponedReason ? `\nPostponed Reason: ${parent.repairPostponedReason}` : '';
        setNotes(`[Follow-up for Job #${parentCode}]${postponedPart}\nOriginal Notes: ${parent.specialInstructions || 'None'}\n\n`);
    };

    // Requirements
    const [selectedWaivers, setSelectedWaivers] = useState<string[]>([]);
    const [selectedDiagChecklists, setSelectedDiagChecklists] = useState<string[]>([]);
    const [selectedQualChecklists, setSelectedQualChecklists] = useState<string[]>([]);
    const [divisionId, setDivisionId] = useState('');
    
    const [showCrewSelect, setShowCrewSelect] = useState(false);
    const [isAddSubcontractorModalOpen, setIsAddSubcontractorModalOpen] = useState(false);
    const [blacklistBypass, setBlacklistBypass] = useState(false);
    
    // Work Order Upload & Parsing State
    const [isParsing, setIsParsing] = useState(false);
    const [uploadedFileName, setUploadedFileName] = useState('');

    const handleWorkOrderUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsParsing(true);
        setUploadedFileName(file.name);
        try {
            let text = '';
            if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
                text = await extractTextFromPdf(file);
            } else {
                text = await new Promise<string>((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(reader.result as string);
                    reader.onerror = reject;
                    reader.readAsText(file);
                });
            }

            if (!text.trim()) {
                throw new Error("The uploaded file contains no readable text.");
            }

            const parsed = parseWorkOrderText(text, state.customers);
            
            // Prefill states
            if (parsed.matchedCustomer) {
                setSelectedCustomer(parsed.matchedCustomer);
                showToast.success(`Matched customer: ${parsed.matchedCustomer.name}`);
            } else {
                showToast.warn("Could not auto-match customer. Please select manually.");
            }

            if (parsed.matchedPropertyId) {
                setSelectedPropertyId(parsed.matchedPropertyId);
            }
            if (parsed.poNumber) {
                setPoNumber(parsed.poNumber);
            }
            if (parsed.date) {
                setDate(parsed.date);
            }
            if (parsed.timeSlot) {
                setTimeSlot(parsed.timeSlot);
            }
            if (parsed.jobType) {
                setJobType(parsed.jobType);
            }
            if (parsed.priority === 'High') {
                setIsHighPriority(true);
            }
            if (parsed.notes) {
                setNotes(parsed.notes);
            }

            showToast.success("Work order parsed and details prefilled successfully!");
        } catch (err) {
            console.error("Error parsing work order:", err);
            const msg = err instanceof Error ? err.message : "Failed to parse document.";
            showToast.error(`Parsing error: ${msg}`);
            setUploadedFileName('');
        } finally {
            setIsParsing(false);
            // Reset the input value so the same file can be uploaded again if needed
            e.target.value = '';
        }
    };

    const handleClearParsedWorkOrder = () => {
        setUploadedFileName('');
    };

    const isAdminOrSupervisor = state.currentUser?.role === 'admin' || state.currentUser?.role === 'master_admin' || state.currentUser?.role === 'both' || state.currentUser?.role === 'supervisor';

    React.useEffect(() => {
        if (isOpen) {
            if (!hasPermission(state.currentUser, 'manage_dispatch')) {
                showToast.warn("You do not have permission to manage dispatch or schedule jobs.");
                onClose();
                return;
            }
            if (jobToEdit) {
                const d = new Date(jobToEdit.appointmentTime);
                if (!isNaN(d.getTime())) {
                    const offset = d.getTimezoneOffset() * 60000;
                    const localTime = new Date(d.getTime() - offset);
                    setDate(localTime.toISOString().split('T')[0]);
                    setTimeSlot(localTime.toISOString().split('T')[1].slice(0, 5));
                }
                setDuration(jobToEdit.duration || 120);
                setJobType(jobToEdit.tasks && jobToEdit.tasks[0] ? jobToEdit.tasks[0] : 'Repair');
                setVisitType(jobToEdit.visitType || 'Diagnostic & Repair');
                setAssignMode(jobToEdit.assignedPartnerId ? 'partner' : 'internal');
                setTechnicianId(jobToEdit.assignedTechnicianId || '');
                setPartnerId(jobToEdit.assignedPartnerId || '');
                setAssistantIds(jobToEdit.assistants || []);
                setPartnerPayoutAmount(jobToEdit.partnerPayoutAmount || undefined);
                setNotes(jobToEdit.specialInstructions || '');
                setLeadSource(jobToEdit.source || 'Call-In');
                setIsHighPriority(jobToEdit.priority === 'High');
                setSelectedWaivers(jobToEdit.requiredWaiverIds || []);
                setSelectedDiagChecklists(jobToEdit.requiredDiagnosisChecklistIds || []);
                setSelectedQualChecklists(jobToEdit.requiredQualityChecklistIds || []);
                setSelectedCustomer(state.customers.find(c => c.id === jobToEdit.customerId) || null);
                setProposalId(jobToEdit.proposalId || '');
                setPoNumber(jobToEdit.poNumber || '');
                setDivisionId(jobToEdit.divisionId || '');
                setSelectedPropertyId(jobToEdit.locationId || 'default');
            } else if (parentJobToLink) {
                setDate(new Date().toISOString().split('T')[0]);
                setTimeSlot('09:00');
                setDuration(parentJobToLink.duration || 120);
                setJobType(parentJobToLink.tasks && parentJobToLink.tasks[0] ? parentJobToLink.tasks[0] : 'Repair');
                setVisitType('Repair');
                setAssignMode('internal');
                setTechnicianId('');
                setPartnerId('');
                setAssistantIds([]);
                setPartnerPayoutAmount(undefined);
                
                const parentCode = parentJobToLink.id.slice(-6).toUpperCase();
                const postponedPart = parentJobToLink.repairPostponedReason ? `\nPostponed Reason: ${parentJobToLink.repairPostponedReason}` : '';
                setNotes(`[Follow-up for Job #${parentCode}]${postponedPart}\nOriginal Notes: ${parentJobToLink.specialInstructions || 'None'}\n\n`);
                
                setLeadSource(parentJobToLink.source || 'Call-In');
                setIsHighPriority(parentJobToLink.priority === 'High');
                setSelectedWaivers(parentJobToLink.requiredWaiverIds || []);
                setSelectedDiagChecklists(parentJobToLink.requiredDiagnosisChecklistIds || []);
                setSelectedQualChecklists(parentJobToLink.requiredQualityChecklistIds || []);
                setSelectedCustomer(state.customers.find(c => c.id === parentJobToLink.customerId) || null);
                setProposalId(parentJobToLink.proposalId || '');
                setPoNumber(parentJobToLink.poNumber || '');
                setDivisionId(parentJobToLink.divisionId || '');
                setSelectedPropertyId(parentJobToLink.locationId || 'default');
            } else {
                setDate(new Date().toISOString().split('T')[0]);
                setTimeSlot('09:00');
                setDuration(120);
                setJobType('Repair');
                setVisitType('Diagnostic & Repair');
                setAssignMode('internal');
                setTechnicianId('');
                setPartnerId('');
                setAssistantIds([]);
                setPartnerPayoutAmount(undefined);
                setNotes('');
                setLeadSource('Call-In');
                setIsHighPriority(false);
                setSelectedWaivers([]);
                setSelectedDiagChecklists([]);
                setSelectedQualChecklists([]);
                setProposalId('');
                setPoNumber('');
                setDivisionId('');
                setBlacklistBypass(false);
                setSelectedPropertyId('');
            }
        }
    }, [isOpen, jobToEdit, parentJobToLink, state.customers]);

    React.useEffect(() => {
        if (!jobToEdit && selectedCustomer && selectedPropertyId) {
            const loc = selectedCustomer.serviceLocations?.find(l => l.id === selectedPropertyId);
            if (loc && loc.poNumber) {
                setPoNumber(loc.poNumber);
            }
        }
    }, [selectedPropertyId, selectedCustomer, jobToEdit]);

    const industry = state.currentOrganization?.industry || 'General';
    const availableTypes = JOB_TYPES[industry] || JOB_TYPES['General'];

    const orgTechs = state.users.filter(u => 
        u.organizationId === state.currentOrganization?.id && 
        (u.role === 'employee' || u.role === 'both' || u.role === 'supervisor' || u.role === 'admin' || u.role === 'Subcontractor' || u.role === 'Technician') && 
        (u.status?.toLowerCase() === 'active' || !u.status)
    );

    const partners = useMemo(() => {
        if (!state.subcontractors || state.subcontractors.length === 0) return [];
        const linkedSubs = state.subcontractors.filter((sub: Subcontractor) => sub.handshakeStatus === 'Linked' && sub.linkedOrgId);
        return linkedSubs.map((sub: Subcontractor) => ({
            id: sub.linkedOrgId as string,
            name: sub.companyName
        }));
    }, [state.subcontractors]);

    const handleSelectCustomer = (customer: Customer) => {
        setSelectedCustomer(customer);
        setSelectedPropertyId('');
        setProposalId('');
        setBlacklistBypass(false);
        if (!jobToEdit) {
            setPoNumber(customer.poNumber || '');
        }
    };

    const toggleAssistant = (id: string) => {
        setAssistantIds(prev => prev.includes(id) ? prev.filter(pid => pid !== id) : [...prev, id]);
    };

    const handleSaveSubcontractor = async (subData: Partial<Subcontractor>) => {
        if (!state.currentOrganization || !subData.companyName) return;
        const subId = subData.id || `sub-${Date.now()}`;
        const sub: Subcontractor = { ...subData, organizationId: state.currentOrganization.id, id: subId, status: subData.status || 'Active', handshakeStatus: subData.handshakeStatus || 'None', paymentType: subData.paymentType || 'perJob' } as Subcontractor;
        try {
            await db.collection('subcontractors').doc(sub.id).set(cleanUndefinedFields(sub), { merge: true });
            dispatch({ type: subData.id ? 'UPDATE_SUBCONTRACTOR' : 'ADD_SUBCONTRACTOR', payload: sub });
            setIsAddSubcontractorModalOpen(false);
        } catch (error) { console.error("Failed to save sub:", error); }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const activeOrgId = state.currentOrganization?.id || jobToEdit?.organizationId || selectedCustomer?.organizationId;
        if (!selectedCustomer || !activeOrgId) return;

        // Blacklist Validation Safeguard
        if (selectedCustomer.isBlacklisted && !blacklistBypass) {
            showToast.warn("This customer is blacklisted and cannot be scheduled.");
            return;
        }
        
        // Property Validation Safeguard
        if (selectedCustomer.customerType === 'Property Management' && (!selectedPropertyId || selectedPropertyId === 'default')) {
            showToast.warn("Property Management dispatch requires an explicit service location. Please select one.");
            return;
        }
        if (selectedCustomer.serviceLocations && selectedCustomer.serviceLocations.length > 0 && !selectedPropertyId) {
            showToast.warn("This customer has multiple properties. Please explicitly select the dispatch destination before proceeding.");
            return;
        }

        setIsSubmitting(true);

        const tech = orgTechs.find(u => u.id === technicianId);
        const partner = partners.find(p => p.id === partnerId);
        
        const appointmentTimeNative = new Date(`${date}T${timeSlot}:00`);
        const appointmentTimeIso = appointmentTimeNative.toISOString();
        const finalJobType = jobType;

        const originalDiagnosticJob = proposalId 
            ? state.jobs.find(j => j.proposalId === proposalId || j.id === state.proposals.find(p => p.id === proposalId)?.jobId) 
            : null;

        try {
            let dispatchAddress = selectedCustomer.address || 'Address Pending';
            let locationName: string | null = null;
            if (selectedPropertyId && selectedPropertyId !== 'default') {
                const loc = selectedCustomer.serviceLocations?.find(l => l.id === selectedPropertyId);
                if (loc) {
                    dispatchAddress = loc.address;
                    locationName = loc.propertyName || loc.name || null;
                }
            }

                if (jobToEdit) {
                    let combinedInstructions = notes;
                    if (originalDiagnosticJob && !notes.includes(`[Diagnostic Notes`)) {
                        combinedInstructions = `${notes}\n\n[Diagnostic Notes from Job #${originalDiagnosticJob.id.slice(-6).toUpperCase()}]:\n${originalDiagnosticJob.notes?.diagnosis || 'No diagnosis recorded'}`;
                    }

                    const updatePayload: Partial<Job> = {
                        duration,
                        appointmentTime: appointmentTimeIso,
                        address: dispatchAddress,
                        tasks: [finalJobType],
                        priority: isHighPriority ? 'High' : 'Normal',
                        assignedTechnicianId: assignMode === 'internal' ? (technicianId || null) : null,
                        assignedTechnicianName: assignMode === 'internal' ? (tech ? `${tech.firstName} ${tech.lastName}` : 'Unassigned') : (partner ? `Partner: ${partner.name}` : null),
                        assignedPartnerId: assignMode === 'partner' ? (partnerId || null) : null,
                        partnerAllowDirectPayment: assignMode === 'partner' ? !!state.subcontractors.find(s => s.linkedOrgId === partnerId)?.allowDirectPayment : false,
                        partnerPayoutAmount: (partnerPayoutAmount && (assignMode === 'partner' || (tech && tech.role === 'Subcontractor'))) ? partnerPayoutAmount : null,
                        assistants: assignMode === 'internal' ? assistantIds : [],
                        specialInstructions: combinedInstructions,
                        source: leadSource,
                        requiredWaiverIds: selectedWaivers,
                        requiredDiagnosisChecklistIds: selectedDiagChecklists,
                        requiredQualityChecklistIds: selectedQualChecklists,
                        locationId: selectedPropertyId && selectedPropertyId !== 'default' ? selectedPropertyId : null,
                        locationName: locationName === undefined ? null : (locationName || null),
                        poNumber: poNumber ? poNumber.trim() : null,
                        proposalId: proposalId || null,
                        divisionId: divisionId || null,
                        visitType: visitType
                    };

                    if (originalDiagnosticJob) {
                        const mergedFiles = [
                            ...(jobToEdit.files || []),
                            ...(originalDiagnosticJob.files || []).map(f => ({
                                ...f,
                                id: f.id.startsWith('copied-') ? f.id : `copied-${f.id}-${Date.now()}`
                            }))
                        ];
                        updatePayload.files = mergedFiles.filter((v, i, a) => a.findIndex(t => t.dataUrl === v.dataUrl) === i);

                        const mergedUnitStates = [
                            ...(jobToEdit.unitStates || []),
                            ...(originalDiagnosticJob.unitStates || [])
                        ];
                        updatePayload.unitStates = mergedUnitStates.filter((v, i, a) => a.findIndex(t => t.assetId === v.assetId) === i);

                        if (originalDiagnosticJob.techRecommendations) {
                            updatePayload.techRecommendations = originalDiagnosticJob.techRecommendations;
                        }
                        
                        (updatePayload as any).parentJobId = originalDiagnosticJob.id;
                    }

                    if (assignMode === 'partner' && partnerId) {
                        (updatePayload as Record<string, unknown>).embeddedData = {
                            waivers: state.documents.filter(d => selectedWaivers.includes(d.id)),
                            inspectionTemplates: state.inspectionTemplates.filter(t => selectedDiagChecklists.includes(t.id) || selectedQualChecklists.includes(t.id))
                        };
                    }

                    await db.collection('jobs').doc(jobToEdit.id).update(cleanUndefinedFields(updatePayload));
                    dispatch({ type: 'UPDATE_JOB', payload: { ...jobToEdit, ...updatePayload } });

                    // Handle unlinking of old proposal
                    if (jobToEdit.proposalId && jobToEdit.proposalId !== proposalId) {
                        await db.collection('proposals').doc(jobToEdit.proposalId).update(cleanUndefinedFields({
                            jobId: null,
                            poNumber: null,
                            updatedAt: new Date().toISOString()
                        }));
                        const oldProp = state.proposals.find(p => p.id === jobToEdit.proposalId);
                        if (oldProp) {
                            dispatch({
                                type: 'UPDATE_PROPOSAL',
                                payload: { ...oldProp, jobId: null, poNumber: null }
                            });
                        }
                    }

                    // Handle linking of new proposal
                    if (proposalId) {
                        const targetPoNumber = poNumber ? poNumber.trim() : null;
                        await db.collection('proposals').doc(proposalId).update(cleanUndefinedFields({
                            jobId: jobToEdit.id,
                            poNumber: targetPoNumber,
                            updatedAt: new Date().toISOString()
                        }));
                        const targetProp = state.proposals.find(p => p.id === proposalId);
                        if (targetProp) {
                            dispatch({
                                type: 'UPDATE_PROPOSAL',
                                payload: { ...targetProp, jobId: jobToEdit.id, poNumber: targetPoNumber }
                            });
                        }
                    }
                    
                    // Check if assigned tech changed
                    if (assignMode === 'internal' && technicianId && technicianId !== jobToEdit.assignedTechnicianId) {
                        const { sendNotification } = await import('../../lib/notificationService');
                        await sendNotification(technicianId, {
                            title: "New Job Assigned",
                            body: `You have been assigned to ${selectedCustomer.name} (Rescheduled).`,
                            type: 'job_assignment'
                        });
                    }

                    onClose();
                } else {
                    let combinedInstructions = notes || '';
                    const parentJob = parentJobToLink || customerJobs.find(j => j.id === selectedParentJobId) || originalDiagnosticJob;
                    if (parentJob && !notes.includes('[Follow-up')) {
                        const parentCode = parentJob.id.slice(-6).toUpperCase();
                        combinedInstructions = `${notes || ''}\n\n[Diagnostic Notes from Job #${parentCode}]:\n${parentJob.notes?.diagnosis || 'No diagnosis recorded'}`;
                    }

                    const newJobData: Job = {
                        duration,
                        id: `job-${Date.now()}`,
                        organizationId: activeOrgId,
                        customerName: selectedCustomer.name,
                        firstName: selectedCustomer.firstName || null,
                        lastName: selectedCustomer.lastName || null,
                        customerPhone: selectedCustomer.phone || '',
                        customerEmail: selectedCustomer.email || '',
                        address: dispatchAddress,
                        locationId: selectedPropertyId && selectedPropertyId !== 'default' ? selectedPropertyId : null,
                        locationName: locationName || null,
                        poNumber: poNumber ? poNumber.trim() : null,
                        tasks: [finalJobType],
                        customerId: selectedCustomer.id,
                        jobStatus: 'Scheduled',
                        priority: isHighPriority ? 'High' : 'Normal',
                        appointmentTime: appointmentTimeIso,
                        assignedTechnicianId: assignMode === 'internal' ? (technicianId || null) : null,
                        assignedTechnicianName: assignMode === 'internal' ? (tech ? `${tech.firstName} ${tech.lastName}` : 'Unassigned') : (partner ? `Partner: ${partner.name}` : null),
                        assignedPartnerId: assignMode === 'partner' ? (partnerId || null) : null,
                        partnerAllowDirectPayment: assignMode === 'partner' ? !!state.subcontractors.find(s => s.linkedOrgId === partnerId)?.allowDirectPayment : false,
                        partnerPayoutAmount: (partnerPayoutAmount && (assignMode === 'partner' || (tech && tech.role === 'Subcontractor'))) ? partnerPayoutAmount : null,
                        assistants: assignMode === 'internal' ? assistantIds : [],
                        specialInstructions: combinedInstructions,
                        source: leadSource || 'Call-In',
                        projectId: selectedProjectId || null,
                        jobEvents: [],
                        createdAt: new Date().toISOString(),
                        requiredWaiverIds: selectedWaivers,
                        requiredDiagnosisChecklistIds: selectedDiagChecklists,
                        requiredQualityChecklistIds: selectedQualChecklists,
                        proposalId: proposalId || null,
                        divisionId: divisionId || null,
                        visitType: visitType
                    };

                    if (parentJob) {
                        newJobData.files = (parentJob.files || []).map(f => ({
                            ...f,
                            id: f.id.startsWith('copied-') ? f.id : `copied-${f.id}-${Date.now()}`
                        }));
                        newJobData.unitStates = parentJob.unitStates || [];
                        newJobData.techRecommendations = parentJob.techRecommendations || '';
                        newJobData.parentJobId = parentJob.id;
                        newJobData.isFollowUp = true;
                        newJobData.linkedJobIds = Array.from(new Set([parentJob.id, ...(parentJob.linkedJobIds || [])]));
                    }

                    if (assignMode === 'partner' && partnerId) {
                        newJobData.embeddedData = {
                            waivers: state.documents.filter(d => selectedWaivers.includes(d.id)),
                            inspectionTemplates: state.inspectionTemplates.filter(t => selectedDiagChecklists.includes(t.id) || selectedQualChecklists.includes(t.id))
                        };
                    }

                    const batch = db.batch();
                    batch.set(db.collection('jobs').doc(newJobData.id), cleanUndefinedFields(newJobData));

                    if (parentJob) {
                        const updatedParentLinked = Array.from(new Set([newJobData.id, ...(parentJob.linkedJobIds || [])]));
                        batch.update(db.collection('jobs').doc(parentJob.id), cleanUndefinedFields({
                            linkedJobIds: updatedParentLinked,
                            updatedAt: new Date().toISOString()
                        }));
                        dispatch({
                            type: 'UPDATE_JOB',
                            payload: {
                                ...parentJob,
                                linkedJobIds: updatedParentLinked
                            }
                        });

                        for (const siblingId of (parentJob.linkedJobIds || [])) {
                            const siblingJob = state.jobs.find(j => j.id === siblingId);
                            if (siblingJob) {
                                const updatedSiblingLinked = Array.from(new Set([newJobData.id, ...(siblingJob.linkedJobIds || [])]));
                                batch.update(db.collection('jobs').doc(siblingId), cleanUndefinedFields({
                                    linkedJobIds: updatedSiblingLinked,
                                    updatedAt: new Date().toISOString()
                                }));
                                dispatch({
                                    type: 'UPDATE_JOB',
                                    payload: {
                                        ...siblingJob,
                                        linkedJobIds: updatedSiblingLinked
                                    }
                                });
                            }
                        }
                    }

                    await batch.commit();
                    dispatch({ type: 'ADD_JOB', payload: newJobData });

                // Handle linking of proposal
                if (proposalId) {
                    const targetPoNumber = newJobData.poNumber || null;
                    await db.collection('proposals').doc(proposalId).update(cleanUndefinedFields({
                        jobId: newJobData.id,
                        poNumber: targetPoNumber,
                        updatedAt: new Date().toISOString()
                    }));
                    const targetProp = state.proposals.find(p => p.id === proposalId);
                    if (targetProp) {
                        dispatch({
                            type: 'UPDATE_PROPOSAL',
                            payload: { ...targetProp, jobId: newJobData.id, poNumber: targetPoNumber }
                        });
                    }
                }

                if (assignMode === 'internal' && technicianId) {
                    try {
                        const { sendNotification } = await import('../../lib/notificationService');
                        if (isHighPriority) {
                            await sendNotification(technicianId, {
                                title: "🚨 EMERGENCY: High Priority Job",
                                body: `You have an urgent dispatch for ${selectedCustomer.name}. Please check your route immediately.`,
                                type: 'urgent_job'
                            });
                        } else {
                            await sendNotification(technicianId, {
                                title: "New Job Dispatched",
                                body: `You have been dispatched to ${selectedCustomer.name}.`,
                                type: 'job_assignment'
                            });
                        }
                    } catch (notifError) {
                        console.error("Failed to send notification:", notifError);
                    }
                }

                onClose();
            }
        } catch (error) { 
            const errorMessage = error instanceof Error ? error.message : "Unknown error";
            showToast.warn("Dispatch failed: " + errorMessage); 
        } finally {
            setIsSubmitting(false); 
        }
    };

    return (
        <>
            <Modal isOpen={isOpen} onClose={onClose} title={jobToEdit ? "Edit Appointment" : "Book Appointment"} size="lg">
                <form onSubmit={handleSubmit} className="space-y-5">
                    {/* Work Order Auto-Parsing Section */}
                    {!jobToEdit && (
                        <div className="p-5 bg-indigo-50/50 dark:bg-indigo-950/10 border border-dashed border-indigo-200 dark:border-indigo-900/40 rounded-[2rem] shadow-sm relative overflow-hidden transition-all hover:bg-indigo-50 dark:hover:bg-indigo-950/20">
                            <div className="flex flex-col items-center justify-center text-center space-y-2">
                                <div className="w-12 h-12 rounded-2xl bg-indigo-100 dark:bg-indigo-955 flex items-center justify-center text-indigo-650 dark:text-indigo-400">
                                    {isParsing ? (
                                        <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                                    ) : (
                                        <UploadCloud size={24} />
                                    )}
                                </div>
                                <div className="space-y-1">
                                    <h4 className="text-xs font-black uppercase tracking-wider text-indigo-900 dark:text-indigo-100">
                                        {isParsing ? "Scanning & Parsing Work Order..." : "Auto-Fill from Work Order"}
                                    </h4>
                                    <p className="text-[10px] text-indigo-600/80 dark:text-indigo-400/80 font-medium max-w-xs">
                                        Upload a PDF, Text, or HTML Work Order to auto-match the customer, service location, PO#, date, and tasks.
                                    </p>
                                </div>
                                
                                {!isParsing && !uploadedFileName && (
                                    <label className="inline-flex items-center justify-center px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-black uppercase tracking-widest rounded-xl shadow-sm transition-all cursor-pointer">
                                        Choose File
                                        <input 
                                            type="file" 
                                            accept=".pdf,.txt,.html,.htm,.xml,.json" 
                                            onChange={handleWorkOrderUpload} 
                                            className="hidden" 
                                        />
                                    </label>
                                )}

                                {uploadedFileName && (
                                    <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 rounded-xl text-emerald-800 dark:text-emerald-400 text-[10px] font-bold">
                                        <FileText size={12} />
                                        <span className="truncate max-w-[180px]">{uploadedFileName}</span>
                                        <button 
                                            type="button" 
                                            onClick={handleClearParsedWorkOrder} 
                                            className="text-red-500 hover:text-red-750 transition-colors cursor-pointer"
                                            title="Clear"
                                        >
                                            <X size={12} />
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Only show customer search for new jobs, editing jobs binds customer tightly */}
                    {!jobToEdit && !customerId && <CustomerSearch customers={state.customers} onSelectCustomer={handleSelectCustomer} />}
                    {jobToEdit && selectedCustomer && (
                        <div className="bg-gray-100 dark:bg-gray-800 p-3 rounded-lg flex justify-between items-center">
                            <span className="font-bold text-gray-800 dark:text-gray-200">Customer:</span>
                            <span className="text-gray-600 dark:text-gray-400 font-medium">{selectedCustomer.name}</span>
                        </div>
                    )}

                    {selectedCustomer?.isBlacklisted && (
                        <div className="bg-red-50 dark:bg-red-950/20 p-4 border border-red-200 dark:border-red-800 rounded-lg flex flex-col gap-2">
                            <div className="flex items-center gap-2 text-red-800 dark:text-red-400">
                                <AlertCircle size={20} className="shrink-0 text-red-500" />
                                <span className="font-bold">⚠️ Customer Account Restricted (Blacklisted)</span>
                            </div>
                            <p className="text-sm text-red-700 dark:text-red-300">
                                This customer is blacklisted due to non-payment: <strong>{selectedCustomer.blacklistReason || 'Non-payment'}</strong>. Scheduling new work orders is restricted.
                            </p>
                            {isAdminOrSupervisor ? (
                                <label className="flex items-center gap-2 mt-2 cursor-pointer font-bold text-slate-700 dark:text-slate-300 text-xs">
                                    <input 
                                        type="checkbox" 
                                        checked={blacklistBypass} 
                                        onChange={e => setBlacklistBypass(e.target.checked)} 
                                        className="rounded border-slate-300 dark:border-slate-600 text-red-600 focus:ring-red-500"
                                    />
                                    <span>Override Restriction (Admin/Supervisor Bypass)</span>
                                </label>
                            ) : (
                                <p className="text-xs text-red-600 dark:text-red-500 italic mt-1">
                                    Only Admins or Supervisors can override this restriction.
                                </p>
                            )}
                        </div>
                    )}
                    
                    {selectedCustomer && (selectedCustomer.customerType === 'Property Management' || (selectedCustomer.serviceLocations && selectedCustomer.serviceLocations.length > 0)) && (
                        <div className="bg-amber-50 dark:bg-amber-900/30 p-4 border border-amber-200 dark:border-amber-800 rounded-xl">
                            <label htmlFor="propertySelect" className="block text-xs font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300 mb-2 flex items-center gap-1.5">
                                <Building2 size={15} /> Service Location / Property Target
                            </label>
                            <select 
                                id="propertySelect"
                                title="Select Destination Target"
                                aria-label="Select Destination Target"
                                className="w-full rounded-lg border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white text-xs py-2.5 px-3 font-medium shadow-sm focus:border-amber-500 focus:ring-amber-500"
                                value={selectedPropertyId}
                                onChange={(e) => setSelectedPropertyId(e.target.value)}
                                required
                            >
                                <option value="">-- Please Explicitly Select A Property --</option>
                                {selectedCustomer.customerType !== 'Property Management' && <option value="default">Primary: {selectedCustomer.address}</option>}
                                {(selectedCustomer.serviceLocations || []).map((loc: NonNullable<Customer['serviceLocations']>[0]) => (
                                    <option key={loc.id} value={loc.id}>{loc.propertyName || loc.name} - {loc.address} {loc.city ? `(${loc.city})` : ''}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    {/* Follow-Up / Previous Job Link Dropdown */}
                    {selectedCustomer && !jobToEdit && (
                        <div className="bg-indigo-50/70 dark:bg-indigo-950/30 p-4 border border-indigo-200 dark:border-indigo-800/80 rounded-xl space-y-2">
                            <label htmlFor="parentJobSelect" className="block text-xs font-bold uppercase tracking-wider text-indigo-900 dark:text-indigo-300 flex items-center gap-1.5">
                                <History size={15} className="text-indigo-600 dark:text-indigo-400" />
                                Link to Previous Job / Follow-Up Visit (Optional)
                            </label>
                            <select
                                id="parentJobSelect"
                                className="w-full rounded-lg border-indigo-300 dark:border-indigo-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white text-xs py-2.5 px-3 font-medium shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                                value={selectedParentJobId}
                                onChange={(e) => handleSelectParentJob(e.target.value)}
                            >
                                <option value="">-- New Independent Job (No Previous Follow-Up Link) --</option>
                                {customerJobs.map(job => {
                                    const code = job.id.slice(-6).toUpperCase();
                                    const apptDate = job.appointmentTime ? new Date(job.appointmentTime).toLocaleDateString() : (job.createdAt ? new Date(job.createdAt).toLocaleDateString() : 'No Date');
                                    const taskName = job.tasks?.[0] || 'Job';
                                    const status = job.jobStatus || 'Completed';
                                    const addr = typeof job.address === 'string' ? job.address : ((job.address as any)?.street || '');
                                    return (
                                        <option key={job.id} value={job.id}>
                                            Job #{code} ({apptDate}) - {taskName} [{status}] {addr ? `• ${addr}` : ''}
                                        </option>
                                    );
                                })}
                            </select>
                            {selectedParentJobId && (
                                <p className="text-[11px] text-indigo-700 dark:text-indigo-300 font-medium flex items-center gap-1 mt-1">
                                    <CheckCircle2 size={13} className="text-emerald-500" />
                                    Linked to Job #{selectedParentJobId.slice(-6).toUpperCase()} as a follow-up visit. Details & notes pre-filled.
                                </p>
                            )}
                        </div>
                    )}
                    
                    <AssignmentType 
                        assignMode={assignMode}
                        setAssignMode={setAssignMode}
                        technicianId={technicianId}
                        setTechnicianId={setTechnicianId}
                        partnerId={partnerId}
                        setPartnerId={setPartnerId}
                        orgTechs={orgTechs}
                        partners={partners}
                        showCrewSelect={showCrewSelect}
                        setShowCrewSelect={setShowCrewSelect}
                        assistantIds={assistantIds}
                        openAddSubcontractorModal={() => setIsAddSubcontractorModalOpen(true)}
                        partnerPayoutAmount={partnerPayoutAmount}
                        setPartnerPayoutAmount={setPartnerPayoutAmount}
                    />

                    {showCrewSelect && assignMode === 'internal' && (
                        <CrewSelect 
                            orgTechs={orgTechs}
                            technicianId={technicianId}
                            assistantIds={assistantIds}
                            toggleAssistant={toggleAssistant}
                        />
                    )}
                    
                    <JobDetails 
                        date={date}
                        setDate={setDate}
                        divisions={state.currentOrganization?.divisions || []}
                        divisionId={divisionId}
                        setDivisionId={setDivisionId}
                        timeSlot={timeSlot}
                        setTimeSlot={setTimeSlot}
                        duration={duration}
                        setDuration={setDuration}
                        jobType={jobType}
                        setJobType={setJobType}
                        availableTypes={availableTypes}
                        leadSource={leadSource}
                        setLeadSource={setLeadSource}
                        notes={notes}
                        setNotes={setNotes}
                        isHighPriority={isHighPriority}
                        setIsHighPriority={setIsHighPriority}
                        poNumber={poNumber}
                        setPoNumber={setPoNumber}
                        waiverTemplates={state.documents.filter(d => d.type === 'Waiver Template')}
                        checklistTemplates={(state.inspectionTemplates || []).filter(t => !t.isHiringPacket)}
                        selectedWaivers={selectedWaivers}
                        setSelectedWaivers={setSelectedWaivers}
                        selectedDiagChecklists={selectedDiagChecklists}
                        setSelectedDiagChecklists={setSelectedDiagChecklists}
                        selectedQualChecklists={selectedQualChecklists}
                        setSelectedQualChecklists={setSelectedQualChecklists}
                        visitType={visitType}
                        setVisitType={setVisitType}
                    />

                    {selectedCustomer && state.proposals && state.proposals.filter(p => p.customerId === selectedCustomer.id).length > 0 && (
                        <div className="bg-blue-50 dark:bg-blue-900/30 p-4 border border-blue-200 dark:border-blue-800 rounded-lg">
                            <label htmlFor="proposalSelect" className="block text-sm font-bold text-blue-800 dark:text-blue-300 mb-2">Link to Proposal (Optional)</label>
                            <select 
                                id="proposalSelect"
                                className="w-full rounded-md border-blue-300 dark:border-blue-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white shadow-sm focus:border-blue-500 focus:ring-blue-500"
                                value={proposalId}
                                onChange={(e) => setProposalId(e.target.value)}
                            >
                                <option value="">-- No Linked Proposal --</option>
                                {state.proposals.filter(p => p.customerId === selectedCustomer.id)
                                .sort((a, b) => {
                                    const aMatches = selectedPropertyId && selectedPropertyId !== 'default' && a.locationId === selectedPropertyId;
                                    const bMatches = selectedPropertyId && selectedPropertyId !== 'default' && b.locationId === selectedPropertyId;
                                    if (aMatches && !bMatches) return -1;
                                    if (!aMatches && bMatches) return 1;
                                    return 0;
                                })
                                .map(p => {
                                    const title = p.title || p.items?.[0]?.name || p.items?.[0]?.description?.slice(0, 30) || 'No Title';
                                    const dateStr = p.createdAt ? new Date(p.createdAt).toLocaleDateString() : 'No Date';
                                    const locInfo = p.locationName || p.locationAddress || 'Billing Address';
                                    const matchesLoc = selectedPropertyId && selectedPropertyId !== 'default' && p.locationId === selectedPropertyId;
                                    const locSuffix = matchesLoc ? ' (Matches Location)' : '';
                                    return (
                                        <option key={p.id} value={p.id}>
                                            Proposal #{p.id.slice(-6).toUpperCase()} - {title} (${p.total.toFixed(2)}) | {locInfo} ({dateStr}){locSuffix}
                                        </option>
                                    );
                                })}
                            </select>
                        </div>
                    )}

                    {selectedCustomer && (proposalId || jobToEdit?.invoice || (jobToEdit?.files && jobToEdit.files.length > 0) || poNumber.trim()) && (
                        <div className="space-y-4 p-5 bg-slate-50 dark:bg-slate-800/40 rounded-[2rem] border border-slate-100 dark:border-slate-800/60 shadow-sm">
                            <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                                <Link2 size={14} className="text-primary-500" /> Associated Documents & Associations
                            </h4>
                            
                            <div className="space-y-3">
                                {/* Linked Proposal Preview Button */}
                                {proposalId && (() => {
                                    const prop = state.proposals?.find(p => p.id === proposalId);
                                    return prop ? (
                                        <button
                                            key="prop-prev"
                                            type="button"
                                            onClick={() => setPreviewDoc({ type: 'Proposal', data: prop })}
                                            className="w-full text-left p-3 px-4 bg-indigo-50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-900/30 rounded-xl text-[10px] font-black uppercase text-indigo-600 dark:text-indigo-400 flex items-center justify-between hover:bg-indigo-100 hover:text-indigo-700 transition-all shadow-sm cursor-pointer"
                                        >
                                            <span className="flex items-center gap-2"><FileText size={12}/> Linked Proposal</span>
                                            <span className="text-indigo-500 font-bold">PREVIEW</span>
                                        </button>
                                    ) : null;
                                })()}

                                {/* Linked Invoice Preview Button */}
                                {jobToEdit?.invoice && (
                                    <button
                                        type="button"
                                        onClick={() => setPreviewDoc({ type: 'Invoice', data: jobToEdit })}
                                        className="w-full text-left p-3 px-4 bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/30 rounded-xl text-[10px] font-black uppercase text-emerald-650 dark:text-emerald-400 flex items-center justify-between hover:bg-emerald-100 hover:text-emerald-700 transition-all shadow-sm cursor-pointer"
                                    >
                                        <span className="flex items-center gap-2"><FileText size={12}/> Linked Invoice</span>
                                        <span className="text-emerald-500 font-bold">PREVIEW</span>
                                    </button>
                                )}

                                {/* Job Files List */}
                                {jobToEdit?.files && jobToEdit.files.length > 0 && (
                                    <div className="space-y-1.5 bg-white dark:bg-slate-900/60 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                                        <span className="block text-[9px] font-black uppercase text-slate-400 tracking-wider mb-2">Attached Job Files / Receipts / Work Orders</span>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                            {jobToEdit.files.map((file: any, i: number) => {
                                                const displayTitle = file.metadata?.label || file.fileName || 'Attached File';
                                                const isHtml = file.fileName?.toLowerCase().endsWith('.html') || file.dataUrl?.includes('text/html');
                                                
                                                if (isHtml) {
                                                    return (
                                                        <button
                                                            key={i}
                                                            type="button"
                                                            onClick={() => setPreviewDoc({ type: 'Other', data: { ...file, title: displayTitle } })}
                                                            className="p-2 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700/65 rounded-lg text-[10px] font-bold text-slate-650 dark:text-slate-350 flex items-center gap-1.5 border border-slate-200/50 dark:border-slate-800/80 cursor-pointer text-left truncate"
                                                        >
                                                            <FileText size={12} className="shrink-0 text-slate-400" />
                                                            <span className="truncate">{displayTitle}</span>
                                                        </button>
                                                    );
                                                }
                                                return (
                                                    <a
                                                        key={i}
                                                        href={file.dataUrl || file.url}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="p-2 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700/65 rounded-lg text-[10px] font-bold text-slate-650 dark:text-slate-350 flex items-center gap-1.5 border border-slate-200/50 dark:border-slate-800/80 truncate"
                                                    >
                                                        <FileText size={12} className="shrink-0 text-slate-400" />
                                                        <span className="truncate">{displayTitle}</span>
                                                    </a>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                {/* PO Associations Panel Button */}
                                {poNumber.trim() && (
                                    <div className="bg-sky-50 dark:bg-sky-950/20 p-4 border border-sky-100 dark:border-sky-900/30 rounded-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                                        <div>
                                            <h5 className="text-[10px] font-black uppercase text-sky-800 dark:text-sky-300 tracking-widest flex items-center gap-1.5">
                                                <Link2 size={12} /> Work Order Associations
                                            </h5>
                                            <p className="text-[9px] text-sky-600 dark:text-sky-400 mt-0.5">Linked under PO Reference: <span className="font-mono font-bold text-sky-800 dark:text-sky-300">{poNumber}</span></p>
                                        </div>
                                        <Button
                                            type="button"
                                            variant="secondary"
                                            size="sm"
                                            onClick={() => dispatch({ type: 'SET_VIEWING_WORK_ORDER', payload: { workOrderNumber: poNumber, customerId: selectedCustomer.id } })}
                                            className="text-[9px] font-black uppercase tracking-widest px-3 border-sky-200 dark:border-sky-850 hover:bg-sky-100 dark:hover:bg-sky-900/40 text-sky-705 dark:text-sky-400"
                                        >
                                            View Linked Documents
                                        </Button>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    <div className="flex justify-end gap-3 pt-4">
                        <Button variant="secondary" onClick={onClose} type="button">Cancel</Button>
                        <Button 
                            type="submit" 
                            data-tour="dispatch-submit-btn"
                            disabled={isSubmitting || !selectedCustomer || (selectedCustomer.isBlacklisted && !blacklistBypass)}
                        >
                            {isSubmitting ? 'Saving...' : jobToEdit ? 'Save Changes' : 'Dispatch!'}
                        </Button>
                    </div>
                </form>
            </Modal>
            {previewDoc && (
                <DocumentPreview
                    onClose={() => setPreviewDoc(null)}
                    type={previewDoc.type}
                    data={previewDoc.data}
                />
            )}
            <AddSubcontractorModal isOpen={isAddSubcontractorModalOpen} onClose={() => setIsAddSubcontractorModalOpen(false)} onSave={handleSaveSubcontractor} subcontractor={null} />
        </>
    );
};

export default JobAppointmentModal;
