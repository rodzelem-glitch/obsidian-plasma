import showToast from "lib/toast";

import React, { useState, useMemo } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { useAppContext } from 'context/AppContext';
import { db } from 'lib/firebase';
import { getNextInvoiceNumber } from 'lib/numbering';
import type { Customer, Job, Subcontractor } from '../../types';
import CustomerSearch from './job-appointment/CustomerSearch';
import AssignmentType from './job-appointment/AssignmentType';
import CrewSelect from './job-appointment/CrewSelect';
import JobDetails from './job-appointment/JobDetails';
import AddSubcontractorModal from './AddSubcontractorModal';

interface JobAppointmentModalProps {
    isOpen: boolean;
    onClose: () => void;
    customerId?: string; // Optional customer ID for "create on the fly"
    jobToEdit?: Job | null;
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

const JobAppointmentModal: React.FC<JobAppointmentModalProps> = ({ isOpen, onClose, customerId, jobToEdit }) => {
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

    // Requirements
    const [selectedWaivers, setSelectedWaivers] = useState<string[]>([]);
    const [selectedDiagChecklists, setSelectedDiagChecklists] = useState<string[]>([]);
    const [selectedQualChecklists, setSelectedQualChecklists] = useState<string[]>([]);
    
    const [showCrewSelect, setShowCrewSelect] = useState(false);
    const [isAddSubcontractorModalOpen, setIsAddSubcontractorModalOpen] = useState(false);

    React.useEffect(() => {
        if (isOpen) {
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
            } else {
                setDate(new Date().toISOString().split('T')[0]);
                setTimeSlot('09:00');
                setDuration(120);
                setJobType('Repair');
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
            }
        }
    }, [isOpen, jobToEdit, state.customers]);

    const industry = state.currentOrganization?.industry || 'General';
    const availableTypes = JOB_TYPES[industry] || JOB_TYPES['General'];

    const orgTechs = state.users.filter(u => 
        u.organizationId === state.currentOrganization?.id && 
        (u.role === 'employee' || u.role === 'both' || u.role === 'supervisor' || u.role === 'admin') && 
        u.status === 'active'
    );

    const partners = useMemo(() => {
        if (!state.subcontractors || state.subcontractors.length === 0 || !state.allOrganizations) return [];
        const linkedSubs = state.subcontractors.filter((sub: Subcontractor) => sub.handshakeStatus === 'Linked' && sub.linkedOrgId);
        const partnerOrgIds = linkedSubs.map((sub: Subcontractor) => sub.linkedOrgId);
        return state.allOrganizations.filter(org => partnerOrgIds.includes(org.id));
    }, [state.subcontractors, state.allOrganizations]);

    const handleSelectCustomer = (customer: Customer) => {
        setSelectedCustomer(customer);
        setSelectedPropertyId('');
        setProposalId('');
    };

    const toggleAssistant = (id: string) => {
        setAssistantIds(prev => prev.includes(id) ? prev.filter(pid => pid !== id) : [...prev, id]);
    };

    const handleSaveSubcontractor = async (subData: Partial<Subcontractor>) => {
        if (!state.currentOrganization || !subData.companyName) return;
        const subId = subData.id || `sub-${Date.now()}`;
        const sub: Subcontractor = { ...subData, organizationId: state.currentOrganization.id, id: subId, status: subData.status || 'Active', handshakeStatus: subData.handshakeStatus || 'None', paymentType: subData.paymentType || 'perJob' } as Subcontractor;
        try {
            await db.collection('subcontractors').doc(sub.id).set(sub, { merge: true });
            dispatch({ type: subData.id ? 'UPDATE_SUBCONTRACTOR' : 'ADD_SUBCONTRACTOR', payload: sub });
            setIsAddSubcontractorModalOpen(false);
        } catch (error) { console.error("Failed to save sub:", error); }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedCustomer || !state.currentOrganization) return;
        
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

        try {
            let dispatchAddress = selectedCustomer.address || 'Address Pending';
            let locationName: string | null = null;
            let poNumber: string | null = null;
            if (selectedPropertyId && selectedPropertyId !== 'default') {
                const loc = selectedCustomer.serviceLocations?.find(l => l.id === selectedPropertyId);
                if (loc) {
                    dispatchAddress = loc.address;
                    locationName = loc.propertyName || loc.name || null;
                    poNumber = loc.poNumber || null;
                }
            }

                if (jobToEdit) {
                    const updatePayload: Partial<Job> = {
                        duration,
                        appointmentTime: appointmentTimeIso,
                        tasks: [finalJobType],
                        priority: isHighPriority ? 'High' : 'Normal',
                        assignedTechnicianId: assignMode === 'internal' ? (technicianId || null) : null,
                        assignedTechnicianName: assignMode === 'internal' ? (tech ? `${tech.firstName} ${tech.lastName}` : 'Unassigned') : (partner ? `Partner: ${partner.name}` : null),
                        assignedPartnerId: assignMode === 'partner' ? (partnerId || null) : null,
                        partnerAllowDirectPayment: assignMode === 'partner' ? !!state.subcontractors.find(s => s.linkedOrgId === partnerId)?.allowDirectPayment : false,
                        partnerPayoutAmount: (assignMode === 'partner' && partnerPayoutAmount) ? partnerPayoutAmount : null,
                        assistants: assignMode === 'internal' ? assistantIds : [],
                        specialInstructions: notes,
                        source: leadSource,
                        requiredWaiverIds: selectedWaivers,
                        requiredDiagnosisChecklistIds: selectedDiagChecklists,
                        requiredQualityChecklistIds: selectedQualChecklists,
                        locationId: selectedPropertyId && selectedPropertyId !== 'default' ? selectedPropertyId : null,
                        locationName: locationName === undefined ? null : (locationName || null),
                        poNumber: poNumber === undefined ? null : (poNumber || null),
                        proposalId: proposalId || null
                    };

                    if (assignMode === 'partner' && partnerId) {
                        (updatePayload as Record<string, unknown>).embeddedData = {
                            waivers: state.documents.filter(d => selectedWaivers.includes(d.id)),
                            inspectionTemplates: state.inspectionTemplates.filter(t => selectedDiagChecklists.includes(t.id) || selectedQualChecklists.includes(t.id))
                        };
                    }

                    await db.collection('jobs').doc(jobToEdit.id).update(updatePayload);
                    dispatch({ type: 'UPDATE_JOB', payload: { ...jobToEdit, ...updatePayload } });

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
                    const nextInvId = await getNextInvoiceNumber(state.currentOrganization.id);
                    const newJobData: Job = {
                        duration,
                        id: `job-${Date.now()}`,
                        organizationId: state.currentOrganization.id,
                        customerName: selectedCustomer.name,
                        firstName: selectedCustomer.firstName || null,
                        lastName: selectedCustomer.lastName || null,
                        customerPhone: selectedCustomer.phone || '',
                        customerEmail: selectedCustomer.email || '',
                        address: dispatchAddress,
                        locationId: selectedPropertyId && selectedPropertyId !== 'default' ? selectedPropertyId : null,
                        locationName: locationName || null,
                        poNumber: poNumber,
                        tasks: [finalJobType],
                        customerId: selectedCustomer.id,
                        jobStatus: 'Scheduled',
                        priority: isHighPriority ? 'High' : 'Normal',
                        appointmentTime: appointmentTimeIso,
                        assignedTechnicianId: assignMode === 'internal' ? (technicianId || null) : null,
                        assignedTechnicianName: assignMode === 'internal' ? (tech ? `${tech.firstName} ${tech.lastName}` : 'Unassigned') : (partner ? `Partner: ${partner.name}` : null),
                        assignedPartnerId: assignMode === 'partner' ? (partnerId || null) : null,
                        partnerAllowDirectPayment: assignMode === 'partner' ? !!state.subcontractors.find(s => s.linkedOrgId === partnerId)?.allowDirectPayment : false,
                        partnerPayoutAmount: (assignMode === 'partner' && partnerPayoutAmount) ? partnerPayoutAmount : null,
                        assistants: assignMode === 'internal' ? assistantIds : [],
                        specialInstructions: notes || '',
                        source: leadSource || 'Call-In',
                        projectId: selectedProjectId || null,
                        invoice: { id: nextInvId, status: 'Unpaid', items: [], subtotal: 0, taxRate: (state.currentOrganization.taxRate || 8.25) / 100, taxAmount: 0, totalAmount: 0, amount: 0 },
                        jobEvents: [],
                        createdAt: new Date().toISOString(),
                        requiredWaiverIds: selectedWaivers,
                        requiredDiagnosisChecklistIds: selectedDiagChecklists,
                        requiredQualityChecklistIds: selectedQualChecklists,
                        proposalId: proposalId || null
                    };

                if (assignMode === 'partner' && partnerId) {
                    newJobData.embeddedData = {
                        waivers: state.documents.filter(d => selectedWaivers.includes(d.id)),
                        inspectionTemplates: state.inspectionTemplates.filter(t => selectedDiagChecklists.includes(t.id) || selectedQualChecklists.includes(t.id))
                    };
                }

                await db.collection('jobs').doc(newJobData.id).set(newJobData);
                dispatch({ type: 'ADD_JOB', payload: newJobData });

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
                    {/* Only show customer search for new jobs, editing jobs binds customer tightly */}
                    {!jobToEdit && !customerId && <CustomerSearch customers={state.customers} onSelectCustomer={handleSelectCustomer} />}
                    {jobToEdit && selectedCustomer && (
                        <div className="bg-gray-100 dark:bg-gray-800 p-3 rounded-lg flex justify-between items-center">
                            <span className="font-bold text-gray-800 dark:text-gray-200">Customer:</span>
                            <span className="text-gray-600 dark:text-gray-400 font-medium">{selectedCustomer.name}</span>
                        </div>
                    )}
                    
                    {selectedCustomer && (selectedCustomer.customerType === 'Property Management' || (selectedCustomer.serviceLocations && selectedCustomer.serviceLocations.length > 0)) && (
                        <div className="bg-amber-50 dark:bg-amber-900/30 p-4 border border-amber-200 dark:border-amber-800 rounded-lg">
                            <label htmlFor="propertySelect" className="block text-sm font-bold text-amber-800 dark:text-amber-300 mb-2">Service Location / Property Target</label>
                            <select 
                                id="propertySelect"
                                title="Select Destination Target"
                                aria-label="Select Destination Target"
                                className="w-full rounded-md border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white shadow-sm focus:border-amber-500 focus:ring-amber-500"
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
                        waiverTemplates={state.documents.filter(d => d.type === 'Waiver Template')}
                        checklistTemplates={(state.inspectionTemplates || []).filter(t => !t.isHiringPacket)}
                        selectedWaivers={selectedWaivers}
                        setSelectedWaivers={setSelectedWaivers}
                        selectedDiagChecklists={selectedDiagChecklists}
                        setSelectedDiagChecklists={setSelectedDiagChecklists}
                        selectedQualChecklists={selectedQualChecklists}
                        setSelectedQualChecklists={setSelectedQualChecklists}
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
                                {state.proposals.filter(p => p.customerId === selectedCustomer.id).map(p => (
                                    <option key={p.id} value={p.id}>Proposal #{p.id.slice(-6).toUpperCase()} - {p.title || (p.items?.[0]?.name) || (p.items?.[0]?.description?.slice(0, 30)) || 'No Title'} (${p.total.toFixed(2)})</option>
                                ))}
                            </select>
                        </div>
                    )}

                    <div className="flex justify-end gap-3 pt-4">
                        <Button variant="secondary" onClick={onClose} type="button">Cancel</Button>
                        <Button type="submit" disabled={isSubmitting || !selectedCustomer}>
                            {isSubmitting ? 'Saving...' : jobToEdit ? 'Save Changes' : 'Dispatch!'}
                        </Button>
                    </div>
                </form>
            </Modal>
            <AddSubcontractorModal isOpen={isAddSubcontractorModalOpen} onClose={() => setIsAddSubcontractorModalOpen(false)} onSave={handleSaveSubcontractor} subcontractor={null} />
        </>
    );
};

export default JobAppointmentModal;
