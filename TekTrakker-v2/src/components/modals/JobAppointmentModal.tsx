
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

interface JobAppointmentModalProps {
    isOpen: boolean;
    onClose: () => void;
    customerId?: string; // Optional customer ID for "create on the fly"
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

const JobAppointmentModal: React.FC<JobAppointmentModalProps> = ({ isOpen, onClose, customerId }) => {
    const { state, dispatch } = useAppContext();
    const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(
        customerId ? (state.customers.find(c => c.id === customerId) || null) : null
    );
    
    // Update selected customer if customerId changes
    React.useEffect(() => {
        if (customerId) {
            setSelectedCustomer(state.customers.find(c => c.id === customerId) || null);
        }
    }, [customerId, state.customers]);

    // Form State
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [timeSlot, setTimeSlot] = useState('09:00'); 
    const [jobType, setJobType] = useState('Repair');
    const [customJobType, setCustomJobType] = useState('');
    const [assignMode, setAssignMode] = useState<'internal' | 'partner'>('internal');
    const [technicianId, setTechnicianId] = useState('');
    const [partnerId, setPartnerId] = useState('');
    const [assistantIds, setAssistantIds] = useState<string[]>([]);
    const [notes, setNotes] = useState('');
    const [leadSource, setLeadSource] = useState('Call-In');
    const [selectedProjectId, setSelectedProjectId] = useState(''); 
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Requirements
    const [selectedWaivers, setSelectedWaivers] = useState<string[]>([]);
    const [selectedDiagChecklists, setSelectedDiagChecklists] = useState<string[]>([]);
    const [selectedQualChecklists, setSelectedQualChecklists] = useState<string[]>([]);
    
    const [showCrewSelect, setShowCrewSelect] = useState(false);
    const [isAddSubcontractorModalOpen, setIsAddSubcontractorModalOpen] = useState(false);

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
        setIsSubmitting(true);

        const tech = orgTechs.find(u => u.id === technicianId);
        const partner = partners.find(p => p.id === partnerId);
        
        const appointmentTime = new Date(`${date}T${timeSlot}:00`).toISOString();
        const finalJobType = jobType === 'Custom' ? customJobType : jobType;

        const newJobData: Job = {
            id: `job-${Date.now()}`,
            organizationId: state.currentOrganization.id,
            customerName: selectedCustomer.name,
            firstName: selectedCustomer.firstName || null,
            lastName: selectedCustomer.lastName || null,
            customerPhone: selectedCustomer.phone || '',
            customerEmail: selectedCustomer.email || '',
            address: selectedCustomer.address || 'Address Pending',
            tasks: [finalJobType],
            customerId: selectedCustomer.id,
            jobStatus: 'Scheduled',
            appointmentTime: appointmentTime,
            assignedTechnicianId: assignMode === 'internal' ? (technicianId || null) : null,
            assignedTechnicianName: assignMode === 'internal' ? (tech ? `${tech.firstName} ${tech.lastName}` : 'Unassigned') : (partner ? `Partner: ${partner.name}` : null),
            assignedPartnerId: assignMode === 'partner' ? (partnerId || null) : null,
            partnerAllowDirectPayment: assignMode === 'partner' ? !!state.subcontractors.find(s => s.linkedOrgId === partnerId)?.allowDirectPayment : false,
            assistants: assignMode === 'internal' ? assistantIds : [],
            specialInstructions: notes || '',
            source: leadSource || 'Call-In',
            projectId: selectedProjectId || null,
            invoice: { id: `INV-${Date.now()}`, status: 'Unpaid', items: [], subtotal: 0, taxRate: (state.currentOrganization.taxRate || 8.25) / 100, taxAmount: 0, totalAmount: 0, amount: 0 },
            jobEvents: [],
            createdAt: new Date().toISOString(),
            requiredWaiverIds: selectedWaivers,
            requiredDiagnosisChecklistIds: selectedDiagChecklists,
            requiredQualityChecklistIds: selectedQualChecklists
        };

        // If assigning to partner, embed the data
        if (assignMode === 'partner' && partnerId) {
            const waiversToEmbed = state.documents.filter(d => selectedWaivers.includes(d.id));
            const checklistsToEmbed = state.inspectionTemplates.filter(t => 
                selectedDiagChecklists.includes(t.id) || selectedQualChecklists.includes(t.id)
            );
            newJobData.embeddedData = {
                waivers: waiversToEmbed,
                inspectionTemplates: checklistsToEmbed
            };
        }

        try {
            await db.collection('jobs').doc(newJobData.id).set(newJobData);
            dispatch({ type: 'ADD_JOB', payload: newJobData });
            onClose();
        } catch (error: any) { 
            alert("Booking failed: " + (error.message || "Unknown error")); 
        } finally {
            setIsSubmitting(false); 
        }
    };

    return (
        <>
            <Modal isOpen={isOpen} onClose={onClose} title="Book Appointment" size="lg">
                <form onSubmit={handleSubmit} className="space-y-5">
                    {!customerId && <CustomerSearch customers={state.customers} onSelectCustomer={handleSelectCustomer} />}
                    
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
                        jobType={jobType}
                        setJobType={setJobType}
                        availableTypes={availableTypes}
                        leadSource={leadSource}
                        setLeadSource={setLeadSource}
                        notes={notes}
                        setNotes={setNotes}
                        waiverTemplates={state.documents.filter(d => d.type === 'Waiver Template')}
                        checklistTemplates={state.inspectionTemplates || []}
                        selectedWaivers={selectedWaivers}
                        setSelectedWaivers={setSelectedWaivers}
                        selectedDiagChecklists={selectedDiagChecklists}
                        setSelectedDiagChecklists={setSelectedDiagChecklists}
                        selectedQualChecklists={selectedQualChecklists}
                        setSelectedQualChecklists={setSelectedQualChecklists}
                    />

                    <div className="flex justify-end gap-3 pt-4">
                        <Button variant="secondary" onClick={onClose} type="button">Cancel</Button>
                        <Button type="submit" disabled={isSubmitting || !selectedCustomer}>
                            {isSubmitting ? 'Booking...' : 'Book Appointment'}
                        </Button>
                    </div>
                </form>
            </Modal>
            <AddSubcontractorModal isOpen={isAddSubcontractorModalOpen} onClose={() => setIsAddSubcontractorModalOpen(false)} onSave={handleSaveSubcontractor} subcontractor={null} />
        </>
    );
};

export default JobAppointmentModal;
