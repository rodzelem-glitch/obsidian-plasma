import showToast from "lib/toast";

import React, { useState, useMemo } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { useAppContext } from 'context/AppContext';
import { db, functions } from 'lib/firebase';
import { httpsCallable } from 'firebase/functions';

import type { Customer, Job, Subcontractor } from '../../types';
import CustomerSearch from './job-appointment/CustomerSearch';
import AssignmentType from './job-appointment/AssignmentType';
import CrewSelect from './job-appointment/CrewSelect';
import JobDetails from './job-appointment/JobDetails';
import AddSubcontractorModal from './AddSubcontractorModal';
import { hasPermission, cleanUndefinedFields, sanitizeCustomer, sanitizeAddressFields } from 'lib/utils';
import { getNextJobNumber, extractJobSlug, resolveJobInvoiceNumber, resolveJobProposalNumber } from 'lib/numbering';
import { AlertCircle, Link2, FileText, UploadCloud, X, History, RotateCcw, Building2, Calendar, User, CheckCircle2, Plus, MapPin, UserPlus, Paperclip, Download } from 'lucide-react';
import DocumentPreview from '../ui/DocumentPreview';
import { extractTextFromPdf, parseWorkOrderText } from '../../utils/workOrderParser';
import { LocationSearchSelector } from '../common/LocationSearchSelector';

import LocationAuditModal from './LocationAuditModal';

interface JobAppointmentModalProps {
    isOpen: boolean;
    onClose: () => void;
    customerId?: string; // Optional customer ID for "create on the fly"
    jobToEdit?: Job | null;
    parentJobToLink?: Job | null;
    projectId?: string;
}

const JOB_TYPES: Record<string, string[]> = {
    'HVAC': ['Repair', 'Maintenance', 'Installation', 'Estimate', 'Inspection', 'Service Call', 'Tune-Up'],
    'Plumbing': ['Leak Repair', 'Drain Cleaning', 'Water Heater', 'Installation', 'Estimate', 'Inspection', 'Sewer Scope', 'Backflow Test'],
    'Electrical': ['Troubleshooting', 'Installation', 'Panel Upgrade', 'Lighting', 'EV Charger', 'Generator', 'Estimate', 'Inspection'],
    'Landscaping': ['Mowing', 'Pruning', 'Cleanup', 'Installation', 'Irrigation', 'Landscape Lighting', 'Softscaping', 'Hardscaping', 'Estimate'],
    'General': ['Repair', 'Assembly & Mounting', 'Doors & Windows', 'Carpentry', 'Drywall Patching', 'Minor Plumbing', 'Minor Electrical', 'Installation', 'Estimate', 'Service Call'],
    'Cleaning': ['Standard Clean', 'Deep Clean', 'Move-in/out', 'Commercial', 'Carpet Cleaning', 'Post-Construction', 'Sanitization', 'Estimate'],
    'Painting': ['Interior', 'Exterior', 'Cabinet Refinishing', 'Deck Staining', 'Pressure Washing', 'Prep', 'Touch-up', 'Estimate'],
    'Roofing': ['Inspection', 'Repair', 'Replacement', 'Gutter Repair', 'Flashing', 'Tarping', 'Estimate'],
    'Contracting': ['Renovation', 'Framing', 'Drywall & Trim', 'Flooring', 'Tile & Bath', 'Repair', 'New Build', 'Estimate', 'Consultation'],
    'Masonry': ['Tuckpointing', 'Brick & Block Repair', 'Concrete Flatwork', 'Stone Veneer', 'Chimney Repair', 'Restoration', 'Estimate'],
    'Telecommunications': ['Structured Cabling', 'Fiber Optic Splicing', 'Network Equipment', 'Wi-Fi Survey', 'Audio/Visual', 'Install', 'Repair', 'Troubleshoot', 'Estimate'],
    'Solar': ['PV Array Install', 'Inverter Replacement', 'Battery Backup', 'Panel Cleaning', 'Maintenance', 'Repair', 'Inspection', 'Estimate'],
    'Security': ['CCTV Installation', 'Access Control', 'Intrusion Alarm', 'Service', 'Monitoring Setup', 'Inspection', 'Estimate'],
    'Pet Grooming': ['Full Grooming', 'Bath & De-Shed', 'Nail Trim & File', 'Ear & Teeth Care', 'Puppy Package', 'Sanitary Trim', 'Check-up']
};

const JobAppointmentModal: React.FC<JobAppointmentModalProps> = ({ isOpen, onClose, customerId, jobToEdit, parentJobToLink, projectId }) => {
    const { state, dispatch } = useAppContext();
    const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
    const [isChangingCustomer, setIsChangingCustomer] = useState(false);
    const [autoMatchedBadge, setAutoMatchedBadge] = useState<string | null>(null);
    const [auditLocationId, setAuditLocationId] = useState<string | null>(null);
    const [attachedInboundFiles, setAttachedInboundFiles] = useState<Array<{ id: string; name: string; url: string; dataUrl?: string; type?: string; uploadedAt?: string }>>([]);

    // Work Order Customer Creation & Location Creation State
    const [unmatchedCustomerPrompt, setUnmatchedCustomerPrompt] = useState<{ name: string; address?: string; phone?: string; email?: string } | null>(null);
    const [isCreatingCustomer, setIsCreatingCustomer] = useState(false);

    const [unmatchedLocationPrompt, setUnmatchedLocationPrompt] = useState<{ propertyName?: string; address: string } | null>(null);
    const [isSavingLocation, setIsSavingLocation] = useState(false);

    const [isManualLocationModalOpen, setIsManualLocationModalOpen] = useState(false);
    const [manualSiteName, setManualSiteName] = useState('');
    const [manualSiteAddress, setManualSiteAddress] = useState('');
    const [manualSiteCity, setManualSiteCity] = useState('');
    const [manualSiteState, setManualSiteState] = useState('');
    const [manualSiteZip, setManualSiteZip] = useState('');

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
    const [partnerNteAmount, setPartnerNteAmount] = useState<number | undefined>(undefined);
    const [subcontractorPhone, setSubcontractorPhone] = useState<string>('');
    const [notes, setNotes] = useState('');
    const [leadSource, setLeadSource] = useState('Call-In');
    const [selectedProjectId, setSelectedProjectId] = useState<string>(jobToEdit?.projectId || projectId || ''); 
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isHighPriority, setIsHighPriority] = useState(false);
    const [selectedPropertyId, setSelectedPropertyId] = useState('');
    const [proposalId, setProposalId] = useState('');
    const [poNumber, setPoNumber] = useState('');
    const [selectedParentJobId, setSelectedParentJobId] = useState('');
    const [previewDoc, setPreviewDoc] = useState<{ type: 'Proposal' | 'Invoice' | 'Other'; data: any } | null>(null);

    const customerJobs = useMemo(() => {
        const custId = selectedCustomer?.id || parentJobToLink?.customerId;
        const custName = selectedCustomer?.name || parentJobToLink?.customerName;

        let list = (state.jobs || [])
            .filter(j => 
                ((custId && j.customerId === custId) || 
                 (custName && j.customerName && j.customerName.toLowerCase().trim() === custName.toLowerCase().trim()) ||
                 (parentJobToLink && j.id === parentJobToLink.id)) &&
                j.id !== jobToEdit?.id && 
                !j.deleted
            )
            .sort((a, b) => new Date(b.appointmentTime || b.createdAt || 0).getTime() - new Date(a.appointmentTime || a.createdAt || 0).getTime());

        if (parentJobToLink && !list.some(j => j.id === parentJobToLink.id)) {
            list.unshift(parentJobToLink);
        }
        return list;
    }, [selectedCustomer, state.jobs, jobToEdit, parentJobToLink]);

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
        const parentPropId = parent.proposalId || (parent.linkedProposalIds && parent.linkedProposalIds[0]);
        if (parentPropId) {
            setProposalId(parentPropId);
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

            let parsed = parseWorkOrderText(text, state.customers);

            // Attempt AI enhancement via Gemini if available
            try {
                const callGeminiAI = httpsCallable(functions, 'callGeminiAI');
                const customerSummaries = state.customers.map(c => ({
                    id: c.id,
                    name: c.name,
                    address: c.address || '',
                    locations: (c.serviceLocations || []).map(l => ({ id: l.id, name: l.propertyName || l.name, address: l.address }))
                }));

                const aiPrompt = `You are a field service operations dispatcher AI. Analyze this uploaded work order text and extract structured appointment metadata.
Match against one of our existing database customers if applicable.

CRITICAL PARSING DIRECTIVES:
1. NEVER confuse "Technician", "Vendor", "Contractor", or "Subcontractor" (e.g. TekAir Inc) with the Customer or Service Location!
2. The "Customer" (extractedCustomerName) is the Purchaser/Client company issuing the work order (e.g. 23rd Group Facility Services).
3. The "Service Address" (extractedServiceAddress) is the site address where work is performed (e.g. 6170 I.H.-10 East, San Antonio TX 78219 / TA San Antonio). NEVER extract the Technician/Vendor address (e.g. 2618 Middleground) as the service address!
4. Extract NTE amount if present (e.g. 2820.00).

Database Customers:
${JSON.stringify(customerSummaries, null, 2)}

Work Order Document Text:
"""
${text.slice(0, 6000)}
"""

Return strictly valid JSON with no extra markdown formatting:
{
  "matchedCustomerId": "customer ID from list or null",
  "matchedPropertyId": "location ID from customer's locations or 'default' or null",
  "extractedCustomerName": "Extracted customer or company name if not matched, or null",
  "extractedServiceAddress": "Extracted service street address or null",
  "extractedPhone": "Extracted contact phone or null",
  "extractedEmail": "Extracted contact email or null",
  "poNumber": "extracted PO or WO # or null",
  "nteAmount": "extracted NTE amount if present or null",
  "date": "YYYY-MM-DD or null",
  "timeSlot": "HH:MM in 24hr format or null",
  "priority": "High" or "Normal",
  "jobType": "Repair", "Maintenance", "Installation", "Estimate", or "Service Call",
  "visitType": "Diagnostic Only", "Diagnostic & Repair", "Repair", or "Maintenance",
  "notes": "Clean summary of scope of work, problem description, or special instructions ONLY"
}`;

                const res: any = await callGeminiAI({
                    prompt: aiPrompt,
                    modelName: "gemini-3.7-flash"
                });

                const rawAiText = res.data?.text || res.data?.result || res.data;
                if (rawAiText && typeof rawAiText === 'string') {
                    const cleanJsonStr = rawAiText.replace(/```json/g, '').replace(/```/g, '').trim();
                    const aiResult = JSON.parse(cleanJsonStr);

                    if (aiResult.matchedCustomerId) {
                        const cust = state.customers.find(c => c.id === aiResult.matchedCustomerId);
                        if (cust) parsed.matchedCustomer = cust;
                    }
                    if (aiResult.matchedPropertyId) parsed.matchedPropertyId = aiResult.matchedPropertyId;
                    if (aiResult.extractedCustomerName) parsed.extractedCustomerName = aiResult.extractedCustomerName;
                    if (aiResult.extractedServiceAddress) parsed.extractedAddress = aiResult.extractedServiceAddress;
                    if (aiResult.extractedPhone) parsed.extractedPhone = aiResult.extractedPhone;
                    if (aiResult.extractedEmail) parsed.extractedEmail = aiResult.extractedEmail;
                    if (aiResult.poNumber) parsed.poNumber = aiResult.poNumber;
                    if (aiResult.date && /^\d{4}-\d{2}-\d{2}$/.test(aiResult.date)) parsed.date = aiResult.date;
                    if (aiResult.timeSlot) parsed.timeSlot = aiResult.timeSlot;
                    if (aiResult.priority === 'High') parsed.priority = 'High';
                    if (aiResult.jobType) parsed.jobType = aiResult.jobType;
                    if (aiResult.visitType) parsed.visitType = aiResult.visitType;
                    if (aiResult.notes) parsed.notes = aiResult.notes;
                }
            } catch (aiErr) {
                console.warn("AI enhancement unavailable or timed out, using rule-based parsing fallback:", aiErr);
            }
            
            // Prefill states
            if (parsed.matchedCustomer) {
                setSelectedCustomer(parsed.matchedCustomer);
                setIsChangingCustomer(false);
                setAutoMatchedBadge(parsed.matchedCustomer.name);
                setUnmatchedCustomerPrompt(null);
                showToast.success(`Matched customer: ${parsed.matchedCustomer.name}`);

                // Infer or match service location
                let targetLocId = parsed.matchedPropertyId || '';
                if (!targetLocId && parsed.extractedAddress && parsed.extractedAddress.length > 5) {
                    const locAddrPart = parsed.extractedAddress.split(',')[0].trim().toLowerCase();
                    const matchedLoc = (parsed.matchedCustomer.serviceLocations || []).find(l => l.address && l.address.toLowerCase().includes(locAddrPart));
                    if (matchedLoc) {
                        targetLocId = matchedLoc.id;
                    }
                }
                if (!targetLocId) {
                    if (parsed.matchedCustomer.customerType === 'Residential') {
                        targetLocId = parsed.matchedCustomer.serviceLocations?.[0]?.id || 'default';
                    } else if (parsed.matchedCustomer.serviceLocations && parsed.matchedCustomer.serviceLocations.length === 1) {
                        targetLocId = parsed.matchedCustomer.serviceLocations[0].id;
                    }
                }
                if (targetLocId) {
                    setSelectedPropertyId(targetLocId);
                }

                // Check if work order specified a new site address not listed under this customer
                if (parsed.extractedAddress && parsed.extractedAddress.length > 5) {
                    const locAddrPart = parsed.extractedAddress.split(',')[0].trim().toLowerCase();
                    const hasLoc = (parsed.matchedCustomer.serviceLocations || []).some(l => l.address && l.address.toLowerCase().includes(locAddrPart));
                    if (!hasLoc) {
                        setUnmatchedLocationPrompt({
                            address: parsed.extractedAddress,
                            propertyName: parsed.extractedPropertyName || 'New Site Location'
                        });
                    } else {
                        setUnmatchedLocationPrompt(null);
                    }
                } else {
                    setUnmatchedLocationPrompt(null);
                }
            } else {
                // Customer NOT matched -> Prompt creation with approval
                const extractedName = parsed.extractedCustomerName || parsed.customerName;
                if (extractedName && extractedName.trim().length > 2) {
                    setUnmatchedCustomerPrompt({
                        name: extractedName.trim(),
                        address: parsed.extractedAddress || '',
                        phone: parsed.extractedPhone || '',
                        email: parsed.extractedEmail || ''
                    });
                } else {
                    setUnmatchedCustomerPrompt(null);
                }
                setUnmatchedLocationPrompt(null);
                showToast.warn("Could not auto-match customer. Review creation prompt or select manually.");
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
            if (parsed.visitType) {
                setVisitType(parsed.visitType);
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

    // Handler to create new customer account from work order with user approval
    const handleCreateCustomerFromWO = async () => {
        if (!unmatchedCustomerPrompt) return;
        setIsCreatingCustomer(true);
        try {
            const newCustId = `cust_${Date.now()}`;
            const initLocId = `loc_${Date.now()}`;
            const cleanAddr = sanitizeAddressFields(unmatchedCustomerPrompt.address);
            
            const newLocs = cleanAddr.address ? [{
                id: initLocId,
                name: 'Main Site',
                propertyName: 'Main Site',
                address: cleanAddr.address,
                city: cleanAddr.city || undefined,
                state: cleanAddr.state || undefined,
                zip: cleanAddr.zip || undefined,
                createdAt: new Date().toISOString(),
                organizationId: state.currentOrganization?.id || ''
            }] : [];

            const newCustomer: Customer = sanitizeCustomer({
                id: newCustId,
                name: unmatchedCustomerPrompt.name,
                email: unmatchedCustomerPrompt.email || '',
                phone: unmatchedCustomerPrompt.phone || '',
                address: cleanAddr.address,
                city: cleanAddr.city || undefined,
                state: cleanAddr.state || undefined,
                zip: cleanAddr.zip || undefined,
                customerType: 'Residential',
                organizationId: state.currentOrganization?.id || '',
                createdAt: new Date().toISOString(),
                serviceLocations: newLocs
            });

            await db.collection('customers').doc(newCustId).set(cleanUndefinedFields(newCustomer));
            if (newLocs.length > 0) {
                await db.collection('serviceLocations').doc(initLocId).set(cleanUndefinedFields(newLocs[0]));
            }

            dispatch({ type: 'ADD_CUSTOMER', payload: newCustomer });
            setSelectedCustomer(newCustomer);
            if (newLocs.length > 0) {
                setSelectedPropertyId(initLocId);
            } else {
                setSelectedPropertyId('default');
            }
            setUnmatchedCustomerPrompt(null);
            showToast.success(`Created and selected customer "${newCustomer.name}"!`);
        } catch (err: any) {
            console.error("Error creating customer from work order:", err);
            showToast.error("Failed to create customer: " + (err.message || err));
        } finally {
            setIsCreatingCustomer(false);
        }
    };

    // Handler to add detected new site location to existing customer
    const handleAddLocationFromWO = async () => {
        if (!unmatchedLocationPrompt || !selectedCustomer) return;
        setIsSavingLocation(true);
        try {
            const newLocId = `loc_${Date.now()}`;
            const cleanLocAddr = sanitizeAddressFields(unmatchedLocationPrompt.address, selectedCustomer.city, selectedCustomer.state, selectedCustomer.zip);
            const newLoc = {
                id: newLocId,
                name: unmatchedLocationPrompt.propertyName || 'New Site Location',
                propertyName: unmatchedLocationPrompt.propertyName || 'New Site Location',
                address: cleanLocAddr.address,
                city: cleanLocAddr.city || undefined,
                state: cleanLocAddr.state || undefined,
                zip: cleanLocAddr.zip || undefined,
                createdAt: new Date().toISOString(),
                organizationId: state.currentOrganization?.id || ''
            };

            const updatedLocations = [...(selectedCustomer.serviceLocations || []), newLoc];
            await db.collection('customers').doc(selectedCustomer.id).update(cleanUndefinedFields({ serviceLocations: updatedLocations }));
            await db.collection('serviceLocations').doc(newLocId).set(cleanUndefinedFields(newLoc));

            const updatedCust = { ...selectedCustomer, serviceLocations: updatedLocations };
            dispatch({ type: 'UPDATE_CUSTOMER', payload: updatedCust });
            setSelectedCustomer(updatedCust);
            setSelectedPropertyId(newLocId);
            setUnmatchedLocationPrompt(null);
            showToast.success("Added new site location to customer!");
        } catch (err: any) {
            console.error("Error adding location:", err);
            showToast.error("Failed to add location: " + (err.message || err));
        } finally {
            setIsSavingLocation(false);
        }
    };

    // Handler to manually save a new site location created on the fly
    const handleSaveManualLocation = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!selectedCustomer) {
            showToast.error("Please select a customer first.");
            return;
        }
        if (!manualSiteAddress.trim()) {
            showToast.error("Please enter a street address for the site location.");
            return;
        }

        setIsSavingLocation(true);
        try {
            const newLocId = `loc_${Date.now()}`;
            const cleanLocAddr = sanitizeAddressFields(manualSiteAddress.trim(), manualSiteCity.trim() || selectedCustomer.city, manualSiteState.trim() || selectedCustomer.state, manualSiteZip.trim() || selectedCustomer.zip);

            const newLoc = {
                id: newLocId,
                name: manualSiteName.trim() || 'Site Location',
                propertyName: manualSiteName.trim() || 'Site Location',
                address: cleanLocAddr.address,
                city: cleanLocAddr.city || undefined,
                state: cleanLocAddr.state || undefined,
                zip: cleanLocAddr.zip || undefined,
                createdAt: new Date().toISOString(),
                organizationId: state.currentOrganization?.id || ''
            };

            const updatedLocations = [...(selectedCustomer.serviceLocations || []), newLoc];
            await db.collection('customers').doc(selectedCustomer.id).update(cleanUndefinedFields({ serviceLocations: updatedLocations }));
            await db.collection('serviceLocations').doc(newLocId).set(cleanUndefinedFields(newLoc));

            const updatedCustomer = { ...selectedCustomer, serviceLocations: updatedLocations };
            dispatch({ type: 'UPDATE_CUSTOMER', payload: updatedCustomer });
            setSelectedCustomer(updatedCustomer);
            setSelectedPropertyId(newLocId);
            
            // Reset form
            setManualSiteName('');
            setManualSiteAddress('');
            setManualSiteCity('');
            setManualSiteState('');
            setManualSiteZip('');
            setIsManualLocationModalOpen(false);
            showToast.success(`Added and selected site location "${newLoc.name}"!`);
        } catch (err: any) {
            console.error("Error saving manual location:", err);
            showToast.error("Failed to save location: " + (err.message || err));
        } finally {
            setIsSavingLocation(false);
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
                setPartnerNteAmount(jobToEdit.subcontractorNteAmount || jobToEdit.partnerNteAmount || (jobToEdit as any).subcontractorNTE || undefined);
                setSubcontractorPhone(jobToEdit.subcontractorPhone || (jobToEdit.subcontractorWorkOrder as any)?.customSubPhone || '');
                setNotes(jobToEdit.specialInstructions || '');
                setLeadSource(jobToEdit.source || 'Call-In');
                setIsHighPriority(jobToEdit.priority === 'High');
                setSelectedWaivers(jobToEdit.requiredWaiverIds || []);
                setSelectedDiagChecklists(jobToEdit.requiredDiagnosisChecklistIds || []);
                setSelectedQualChecklists(jobToEdit.requiredQualityChecklistIds || []);
                setSelectedCustomer(state.customers.find(c => c.id === jobToEdit.customerId) || null);
                setSelectedParentJobId(jobToEdit.parentJobId || '');
                setProposalId(jobToEdit.proposalId || '');
                setPoNumber(jobToEdit.poNumber || '');
                setDivisionId(jobToEdit.divisionId || '');
                setSelectedPropertyId(jobToEdit.locationId || 'default');
                setSelectedProjectId(jobToEdit.projectId || projectId || '');
            } else if (parentJobToLink) {
                setSelectedProjectId(parentJobToLink.projectId || projectId || '');
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
                setPartnerNteAmount(undefined);
                setSubcontractorPhone('');
                
                // Pre-fill link to parent job
                setSelectedParentJobId(parentJobToLink.id);

                const parentCode = parentJobToLink.id.slice(-6).toUpperCase();
                const postponedPart = parentJobToLink.repairPostponedReason ? `\nPostponed Reason: ${parentJobToLink.repairPostponedReason}` : '';
                setNotes(`[Follow-up for Job #${parentCode}]${postponedPart}\nOriginal Notes: ${parentJobToLink.specialInstructions || 'None'}\n\n`);
                
                setLeadSource(parentJobToLink.source || 'Call-In');
                setIsHighPriority(parentJobToLink.priority === 'High');
                setSelectedWaivers(parentJobToLink.requiredWaiverIds || []);
                setSelectedDiagChecklists(parentJobToLink.requiredDiagnosisChecklistIds || []);
                setSelectedQualChecklists(parentJobToLink.requiredQualityChecklistIds || []);
                
                // Robustly match customer by ID or Name
                let matchedCust = state.customers.find(c => 
                    c.id === parentJobToLink.customerId || 
                    (c.name && parentJobToLink.customerName && c.name.toLowerCase().trim() === parentJobToLink.customerName.toLowerCase().trim())
                ) || null;

                if (!matchedCust && parentJobToLink.customerId) {
                    matchedCust = {
                        id: parentJobToLink.customerId,
                        name: parentJobToLink.customerName || 'Customer',
                        phone: parentJobToLink.customerPhone || '',
                        email: parentJobToLink.customerEmail || '',
                        address: parentJobToLink.address || '',
                        customerType: 'Residential',
                        createdAt: new Date().toISOString()
                    } as Customer;
                }
                setSelectedCustomer(matchedCust);

                const effectivePropId = parentJobToLink.proposalId || (parentJobToLink.linkedProposalIds && parentJobToLink.linkedProposalIds[0]) || '';
                setProposalId(effectivePropId);
                setPoNumber(parentJobToLink.poNumber || '');
                setDivisionId(parentJobToLink.divisionId || '');

                // Robustly match service location / property ID
                let targetPropId = parentJobToLink.locationId || '';
                if (matchedCust && matchedCust.serviceLocations && matchedCust.serviceLocations.length > 0) {
                    const matchedLoc = matchedCust.serviceLocations.find((loc: any) => 
                        loc.id === parentJobToLink.locationId ||
                        (parentJobToLink.address && loc.address && loc.address.toLowerCase().trim() === parentJobToLink.address.toLowerCase().trim()) ||
                        (parentJobToLink.locationName && loc.name && loc.name.toLowerCase().trim() === parentJobToLink.locationName.toLowerCase().trim()) ||
                        (parentJobToLink.locationName && loc.propertyName && loc.propertyName.toLowerCase().trim() === parentJobToLink.locationName.toLowerCase().trim())
                    );
                    if (matchedLoc) {
                        targetPropId = matchedLoc.id;
                    } else if (!targetPropId) {
                        targetPropId = matchedCust.serviceLocations[0]?.id || (matchedCust.customerType !== 'Property Management' ? 'default' : '');
                    }
                } else if (!targetPropId) {
                    targetPropId = 'default';
                }
                setSelectedPropertyId(targetPropId);
            } else {
                const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
                const emailParam = params.get('email') ? decodeURIComponent(params.get('email')!) : null;
                const notesParam = params.get('notes') ? decodeURIComponent(params.get('notes')!) : null;
                const attsParam = params.get('attachments') ? decodeURIComponent(params.get('attachments')!) : null;

                if (attsParam) {
                    try {
                        const list = JSON.parse(attsParam);
                        if (Array.isArray(list) && list.length > 0) {
                            const formatted = list.map((a: any, idx: number) => ({
                                id: `inbound_${Date.now()}_${idx}`,
                                name: a.filename || a.name || `Attachment_${idx + 1}`,
                                url: a.url,
                                dataUrl: a.url,
                                type: a.contentType || a.type || 'application/octet-stream',
                                uploadedAt: new Date().toISOString()
                            }));
                            setAttachedInboundFiles(formatted);
                        } else {
                            setAttachedInboundFiles([]);
                        }
                    } catch (err) {
                        console.warn('Failed to parse email attachments param:', err);
                        setAttachedInboundFiles([]);
                    }
                } else {
                    setAttachedInboundFiles([]);
                }

                let matchedCust = customerId ? (state.customers.find(c => c.id === customerId) || null) : null;
                if (!matchedCust && emailParam) {
                    const emailClean = (emailParam.match(/<([^>]+)>/)?.[1] || emailParam).trim().toLowerCase();
                    matchedCust = state.customers.find(c => {
                        if (c.email && c.email.toLowerCase().trim() === emailClean) return true;
                        if (c.contacts && c.contacts.some((cnt: any) => typeof cnt?.email === 'string' && cnt.email.toLowerCase().trim() === emailClean)) return true;
                        return false;
                    }) || null;
                }

                setSelectedCustomer(matchedCust);
                setSelectedParentJobId('');
                setSelectedPropertyId(matchedCust?.serviceLocations?.[0]?.id || (matchedCust && matchedCust.customerType !== 'Property Management' ? 'default' : ''));
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
                setNotes(notesParam || '');
                setLeadSource(emailParam ? 'Email / Web Inbound' : 'Call-In');
                setIsHighPriority(false);
                setSelectedWaivers([]);
                setSelectedDiagChecklists([]);
                setSelectedQualChecklists([]);
                setProposalId('');
                setPoNumber('');
                setDivisionId('');
                setBlacklistBypass(false);
            }
        }
    }, [isOpen, customerId, jobToEdit, parentJobToLink]);

    const industry = state.currentOrganization?.industry || 'General';
    const availableTypes = JOB_TYPES[industry] || JOB_TYPES['General'];

    const orgTechs = state.users.filter(u => 
        u.organizationId === state.currentOrganization?.id && 
        (u.role === 'employee' || u.role === 'both' || u.role === 'supervisor' || u.role === 'admin' || u.role === 'Subcontractor' || u.role === 'Technician') && 
        (u.status?.toLowerCase() === 'active' || !u.status)
    );

    const partners = useMemo(() => {
        if (!state.subcontractors || state.subcontractors.length === 0) return [];
        const currentOrgId = state.currentOrganization?.id;
        return state.subcontractors
            .filter((sub: Subcontractor) => 
                (sub.organizationId === currentOrgId || sub.linkedOrgId === currentOrgId) && 
                sub.status !== 'Inactive'
            )
            .map((sub: Subcontractor) => ({
                id: (sub.linkedOrgId || sub.id) as string,
                name: sub.companyName,
                isInternal: !sub.linkedOrgId
            }));
    }, [state.subcontractors, state.currentOrganization]);

    const handleSelectCustomer = (customer: Customer, keepPropertyId?: string) => {
        setSelectedCustomer(customer);
        setIsChangingCustomer(false);
        setAutoMatchedBadge(null);
        setProposalId('');
        setBlacklistBypass(false);

        if (keepPropertyId) {
            setSelectedPropertyId(keepPropertyId);
        } else if (customer.customerType === 'Residential') {
            // Residential customers automatically default to 'default' or primary address location
            setSelectedPropertyId(customer.serviceLocations?.[0]?.id || 'default');
        } else {
            // Commercial / Property Management: default to single service location if available, otherwise '' for multi-location picker
            if (customer.serviceLocations && customer.serviceLocations.length === 1) {
                setSelectedPropertyId(customer.serviceLocations[0].id);
            } else {
                setSelectedPropertyId('');
            }
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
            let locCity: string | null = null;
            let locState: string | null = null;
            let locZip: string | null = null;
            if (selectedPropertyId && selectedPropertyId !== 'default') {
                const loc = selectedCustomer.serviceLocations?.find(l => l.id === selectedPropertyId);
                if (loc) {
                    dispatchAddress = loc.address;
                    locationName = loc.propertyName || loc.name || null;
                    locCity = loc.city || null;
                    locState = loc.state || null;
                    locZip = loc.zip || null;
                } else if (selectedCustomer.customerType !== 'Commercial' && selectedCustomer.customerType !== 'Property Management') {
                    locCity = selectedCustomer.city || null;
                    locState = selectedCustomer.state || null;
                    locZip = selectedCustomer.zip || null;
                }
            } else if (selectedCustomer.customerType !== 'Commercial' && selectedCustomer.customerType !== 'Property Management') {
                locCity = selectedCustomer.city || null;
                locState = selectedCustomer.state || null;
                locZip = selectedCustomer.zip || null;
            }

                if (jobToEdit) {
                    let combinedInstructions = notes;
                    const parentJobForEdit = (jobToEdit.parentJobId && originalDiagnosticJob && originalDiagnosticJob.id === jobToEdit.parentJobId) ? originalDiagnosticJob : null;
                    if (parentJobForEdit && !notes.includes(`[Diagnostic Notes`)) {
                        combinedInstructions = `${notes}\n\n[Diagnostic Notes from Job #${parentJobForEdit.id.slice(-6).toUpperCase()}]:\n${parentJobForEdit.notes?.diagnosis || 'No diagnosis recorded'}`;
                    }

                    const updatePayload: Partial<Job> = {
                        duration,
                        appointmentTime: appointmentTimeIso,
                        address: dispatchAddress,
                        city: locCity !== null ? locCity : (jobToEdit.city || null),
                        state: locState !== null ? locState : (jobToEdit.state || null),
                        zip: locZip !== null ? locZip : (jobToEdit.zip || null),
                        serviceLocationCity: locCity !== null ? locCity : ((jobToEdit as any)?.serviceLocationCity || null),
                        serviceLocationState: locState !== null ? locState : ((jobToEdit as any)?.serviceLocationState || null),
                        serviceLocationZip: locZip !== null ? locZip : ((jobToEdit as any)?.serviceLocationZip || null),
                        serviceLocationAddress: dispatchAddress || null,
                        tasks: [finalJobType],
                        priority: isHighPriority ? 'High' : 'Normal',
                        assignedTechnicianId: assignMode === 'internal' ? (technicianId || null) : null,
                        assignedTechnicianName: assignMode === 'internal' ? (tech ? `${tech.firstName} ${tech.lastName}` : 'Unassigned') : (partner ? `Partner: ${partner.name}` : null),
                        assignedPartnerId: assignMode === 'partner' ? (partnerId || null) : null,
                        partnerAllowDirectPayment: assignMode === 'partner' ? !!state.subcontractors.find(s => s.linkedOrgId === partnerId || s.id === partnerId)?.allowDirectPayment : false,
                        partnerPayoutAmount: (partnerPayoutAmount && (assignMode === 'partner' || (tech && tech.role === 'Subcontractor'))) ? partnerPayoutAmount : null,
                        subcontractorNteAmount: (partnerNteAmount && (assignMode === 'partner' || (tech && tech.role === 'Subcontractor'))) ? partnerNteAmount : null,
                        partnerNteAmount: (partnerNteAmount && (assignMode === 'partner' || (tech && tech.role === 'Subcontractor'))) ? partnerNteAmount : null,
                        subcontractorPhone: subcontractorPhone ? subcontractorPhone.trim() : null,
                        assistants: assignMode === 'internal' ? assistantIds : [],
                        specialInstructions: combinedInstructions,
                        source: leadSource,
                        requiredWaiverIds: selectedWaivers,
                        requiredDiagnosisChecklistIds: selectedDiagChecklists,
                        requiredQualityChecklistIds: selectedQualChecklists,
                        locationId: selectedPropertyId && selectedPropertyId !== 'default' ? selectedPropertyId : null,
                        locationName: locationName === undefined ? null : (locationName || null),
                        poNumber: poNumber ? poNumber.replace(/#/g, '').trim() : null,
                        proposalId: proposalId || null,
                        divisionId: divisionId || null,
                        industry: ((state.currentOrganization?.divisions || []).find((d: any) => d.id === divisionId) as any)?.trade || ((state.currentOrganization?.divisions || []).find((d: any) => d.id === divisionId) as any)?.industryTrade || state.currentOrganization?.industry || 'HVAC',
                        trade: ((state.currentOrganization?.divisions || []).find((d: any) => d.id === divisionId) as any)?.trade || ((state.currentOrganization?.divisions || []).find((d: any) => d.id === divisionId) as any)?.industryTrade || state.currentOrganization?.industry || 'HVAC',
                        visitType: visitType,
                        projectId: selectedProjectId !== undefined ? (selectedProjectId || null) : (jobToEdit.projectId || null)
                    };

                    if (parentJobForEdit) {
                        const mergedFiles = [
                            ...(jobToEdit.files || []),
                            ...(parentJobForEdit.files || []).map(f => ({
                                ...f,
                                id: f.id.startsWith('copied-') ? f.id : `copied-${f.id}-${Date.now()}`
                            }))
                        ];
                        updatePayload.files = mergedFiles.filter((v, i, a) => a.findIndex(t => t.dataUrl === v.dataUrl) === i);

                        const safeJobToEditUnits = Array.isArray(jobToEdit.unitStates) ? jobToEdit.unitStates : [];
                        const safeParentUnits = Array.isArray(parentJobForEdit.unitStates) ? parentJobForEdit.unitStates : [];
                        const mergedUnitStates = [
                            ...safeJobToEditUnits,
                            ...safeParentUnits
                        ];
                        updatePayload.unitStates = mergedUnitStates.filter((v, i, a) => a.findIndex(t => t.assetId === v.assetId) === i);

                        if (parentJobForEdit.techRecommendations) {
                            updatePayload.techRecommendations = parentJobForEdit.techRecommendations;
                        }
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
                        const oldProp = state.proposals.find(p => p.id === jobToEdit.proposalId);
                        // Only clear jobId if the old proposal actually pointed to this job!
                        if (!oldProp?.jobId || oldProp.jobId === jobToEdit.id) {
                            await db.collection('proposals').doc(jobToEdit.proposalId).update(cleanUndefinedFields({
                                jobId: null,
                                poNumber: null,
                                updatedAt: new Date().toISOString()
                            }));
                            if (oldProp) {
                                dispatch({
                                    type: 'UPDATE_PROPOSAL',
                                    payload: { ...oldProp, jobId: null, poNumber: null }
                                });
                            }
                        }
                    }

                    // Handle linking of new proposal
                    if (proposalId) {
                        const targetPoNumber = poNumber ? poNumber.trim() : null;
                        const targetProp = state.proposals.find(p => p.id === proposalId);
                        const isPrimaryJob = !targetProp?.jobId || targetProp.jobId === jobToEdit.id;
                        const updatedJobIds = Array.from(new Set([...(targetProp?.linkedJobIds || []), jobToEdit.id]));

                        const propUpdates: any = {
                            linkedJobIds: updatedJobIds,
                            updatedAt: new Date().toISOString()
                        };
                        if (isPrimaryJob) {
                            propUpdates.jobId = jobToEdit.id;
                            propUpdates.poNumber = targetPoNumber;
                        }

                        await db.collection('proposals').doc(proposalId).update(cleanUndefinedFields(propUpdates));
                        if (targetProp) {
                            dispatch({
                                type: 'UPDATE_PROPOSAL',
                                payload: { ...targetProp, ...propUpdates }
                            });
                        }
                    }
                    
                    // Check if assigned tech changed
                    if (assignMode === 'internal' && technicianId && technicianId !== jobToEdit.assignedTechnicianId) {
                        const { sendNotification } = await import('../../lib/notificationService');
                        await sendNotification(technicianId, {
                            title: "New Job Assigned",
                            body: `You have been assigned to ${selectedCustomer.name} (Rescheduled).`,
                            type: 'job_assignment',
                            link: `/briefing?jobId=${jobToEdit.id}`,
                            data: {
                                jobId: jobToEdit.id,
                                customerId: selectedCustomer?.id,
                                type: 'job_assignment'
                            }
                        }, activeOrgId);
                    }

                    onClose();
                } else {
                    let combinedInstructions = notes || '';
                    const parentJob = parentJobToLink || (selectedParentJobId ? customerJobs.find(j => j.id === selectedParentJobId) : null);
                    if (parentJob && !notes.includes('[Follow-up')) {
                        const parentCode = parentJob.id.slice(-6).toUpperCase();
                        combinedInstructions = `${notes || ''}\n\n[Diagnostic Notes from Job #${parentCode}]:\n${parentJob.notes?.diagnosis || 'No diagnosis recorded'}`;
                    }

                    const nextJobId = await getNextJobNumber(activeOrgId);
                    const newJobData: Job = {
                        duration,
                        id: nextJobId,
                        jobNumber: nextJobId,
                        organizationId: activeOrgId,
                        customerName: selectedCustomer.name,
                        firstName: selectedCustomer.firstName || null,
                        lastName: selectedCustomer.lastName || null,
                        customerPhone: selectedCustomer.phone || '',
                        customerEmail: selectedCustomer.email || '',
                        address: dispatchAddress,
                        city: locCity || null,
                        state: locState || null,
                        zip: locZip || null,
                        serviceLocationCity: locCity || null,
                        serviceLocationState: locState || null,
                        serviceLocationZip: locZip || null,
                        serviceLocationAddress: dispatchAddress || null,
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
                        partnerAllowDirectPayment: assignMode === 'partner' ? !!state.subcontractors.find(s => s.linkedOrgId === partnerId || s.id === partnerId)?.allowDirectPayment : false,
                        partnerPayoutAmount: (partnerPayoutAmount && (assignMode === 'partner' || (tech && tech.role === 'Subcontractor'))) ? partnerPayoutAmount : null,
                        subcontractorNteAmount: (partnerNteAmount && (assignMode === 'partner' || (tech && tech.role === 'Subcontractor'))) ? partnerNteAmount : null,
                        partnerNteAmount: (partnerNteAmount && (assignMode === 'partner' || (tech && tech.role === 'Subcontractor'))) ? partnerNteAmount : null,
                        subcontractorPhone: subcontractorPhone ? subcontractorPhone.trim() : null,
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
                        visitType: visitType,
                        files: attachedInboundFiles || []
                    };

                    if (parentJob) {
                        newJobData.files = (parentJob.files || []).map(f => ({
                            ...f,
                            id: f.id.startsWith('copied-') ? f.id : `copied-${f.id}-${Date.now()}`
                        }));
                        newJobData.unitStates = Array.isArray(parentJob.unitStates) ? parentJob.unitStates : [];
                        newJobData.techRecommendations = parentJob.techRecommendations || '';
                        newJobData.parentJobId = parentJob.id;
                        newJobData.isFollowUp = true;
                        newJobData.linkedJobIds = Array.from(new Set([parentJob.id, ...(parentJob.linkedJobIds || [])]));

                        // Auto-link parent job proposals to the new follow-up job
                        const parentPropId = parentJob.proposalId || proposalId || (parentJob.linkedProposalIds && parentJob.linkedProposalIds[0]);
                        if (parentPropId) {
                            newJobData.proposalId = parentPropId;
                        }
                        const combinedPropIds = Array.from(new Set([
                            ...(proposalId ? [proposalId] : []),
                            ...(parentJob.proposalId ? [parentJob.proposalId] : []),
                            ...(parentJob.linkedProposalIds || [])
                        ]));
                        if (combinedPropIds.length > 0) {
                            newJobData.linkedProposalIds = combinedPropIds;
                        }
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

                // Handle linking of proposal and linkedProposalIds
                const allLinkedProps = Array.from(new Set([
                    ...(proposalId ? [proposalId] : []),
                    ...(newJobData.proposalId ? [newJobData.proposalId] : []),
                    ...(newJobData.linkedProposalIds || [])
                ]));

                for (const propId of allLinkedProps) {
                    const targetProp = state.proposals?.find(p => p.id === propId);
                    if (targetProp) {
                        const existingLinkedJobs = Array.from(new Set([
                            newJobData.id,
                            ...(targetProp.linkedJobIds || []),
                            ...(targetProp.jobId ? [targetProp.jobId] : [])
                        ]));
                        const targetPoNumber = newJobData.poNumber || targetProp.poNumber || null;
                        const propRefNum = targetProp.referenceNumber || (targetProp.id.startsWith('PROP-') && !targetProp.id.includes(extractJobSlug(newJobData.id)) ? targetProp.id : null);
                        await db.collection('proposals').doc(propId).update(cleanUndefinedFields({
                            jobId: targetProp.jobId || newJobData.id,
                            linkedJobIds: existingLinkedJobs,
                            poNumber: targetPoNumber,
                            referenceNumber: propRefNum,
                            updatedAt: new Date().toISOString()
                        })).catch(() => {});

                        dispatch({
                            type: 'UPDATE_PROPOSAL',
                            payload: {
                                ...targetProp,
                                jobId: targetProp.jobId || newJobData.id,
                                linkedJobIds: existingLinkedJobs,
                                poNumber: targetPoNumber,
                                referenceNumber: propRefNum
                            }
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
                                type: 'urgent_job',
                                link: `/briefing?jobId=${newJobData.id}`,
                                data: {
                                    jobId: newJobData.id,
                                    customerId: selectedCustomer?.id,
                                    type: 'urgent_job'
                                }
                            }, activeOrgId);
                        } else {
                            await sendNotification(technicianId, {
                                title: "New Job Dispatched",
                                body: `You have been dispatched to ${selectedCustomer.name}.`,
                                type: 'job_assignment',
                                link: `/briefing?jobId=${newJobData.id}`,
                                data: {
                                    jobId: newJobData.id,
                                    customerId: selectedCustomer?.id,
                                    type: 'job_assignment'
                                }
                            }, activeOrgId);
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

                    {/* Unmatched Customer Creation Prompt */}
                    {unmatchedCustomerPrompt && !selectedCustomer && (
                        <div className="bg-amber-50 dark:bg-amber-950/40 p-4 border border-amber-300 dark:border-amber-700/80 rounded-xl space-y-3 shadow-sm">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 font-bold text-xs">
                                    <UserPlus size={16} className="text-amber-600 shrink-0" />
                                    <span>Work Order Customer Not Found in Database</span>
                                </div>
                                <button type="button" onClick={() => setUnmatchedCustomerPrompt(null)} className="text-amber-500 hover:text-amber-700">
                                    <X size={14} />
                                </button>
                            </div>
                            <div className="text-xs text-amber-900/90 dark:text-amber-200/90 space-y-1 bg-white/70 dark:bg-amber-900/20 p-3 rounded-lg border border-amber-200/60 dark:border-amber-800/40">
                                <p><strong>Parsed Customer:</strong> {unmatchedCustomerPrompt.name}</p>
                                {unmatchedCustomerPrompt.address && <p><strong>Address:</strong> {unmatchedCustomerPrompt.address}</p>}
                                {unmatchedCustomerPrompt.phone && <p><strong>Phone:</strong> {unmatchedCustomerPrompt.phone}</p>}
                                {unmatchedCustomerPrompt.email && <p><strong>Email:</strong> {unmatchedCustomerPrompt.email}</p>}
                            </div>
                            <div className="flex items-center gap-3">
                                <Button 
                                    type="button" 
                                    size="sm" 
                                    onClick={handleCreateCustomerFromWO} 
                                    disabled={isCreatingCustomer} 
                                    className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs py-1.5 px-3 rounded-lg flex items-center gap-1.5 shadow-sm"
                                >
                                    <UserPlus size={14} />
                                    {isCreatingCustomer ? "Creating Customer..." : "Approve & Create Customer"}
                                </Button>
                                <button type="button" onClick={() => setUnmatchedCustomerPrompt(null)} className="text-xs font-semibold text-slate-500 hover:text-slate-700 dark:text-slate-400">
                                    Dismiss / Select Manually
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Customer Selection / Selected Customer Card */}
                    {selectedCustomer && !isChangingCustomer ? (
                        <div className="bg-slate-50 dark:bg-slate-800/60 p-4 border border-slate-200 dark:border-slate-700/80 rounded-2xl shadow-sm space-y-2">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                <div className="flex items-start gap-3 min-w-0">
                                    <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center font-black text-lg shrink-0">
                                        {(selectedCustomer.name || 'C').charAt(0).toUpperCase()}
                                    </div>
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="font-extrabold text-slate-900 dark:text-white text-base">
                                                {selectedCustomer.name}
                                            </span>
                                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border ${
                                                selectedCustomer.customerType === 'Residential'
                                                    ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800'
                                                    : selectedCustomer.customerType === 'Property Management'
                                                        ? 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800'
                                                        : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800'
                                            }`}>
                                                {selectedCustomer.customerType || 'Residential'}
                                            </span>
                                            {autoMatchedBadge && (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                                                    ✨ Auto-Matched
                                                </span>
                                            )}
                                        </div>
                                        <div className="text-xs text-slate-500 dark:text-slate-400 font-medium flex items-center gap-2 mt-1 flex-wrap">
                                            {selectedCustomer.address && <span>📍 {selectedCustomer.address}</span>}
                                            {selectedCustomer.phone && <span>📞 {selectedCustomer.phone}</span>}
                                            {selectedCustomer.email && <span>✉️ {selectedCustomer.email}</span>}
                                        </div>
                                    </div>
                                </div>
                                {!jobToEdit && !customerId && (
                                    <Button
                                        type="button"
                                        variant="secondary"
                                        size="sm"
                                        onClick={() => setIsChangingCustomer(true)}
                                        className="text-xs py-1.5 px-3 self-start sm:self-center shrink-0 border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200"
                                    >
                                        Change Customer
                                    </Button>
                                )}
                            </div>
                        </div>
                    ) : (
                        !jobToEdit && !customerId && (
                            <div className="space-y-2 bg-slate-50/50 dark:bg-slate-900/40 p-4 border border-slate-200 dark:border-slate-800 rounded-2xl">
                                <div className="flex justify-between items-center">
                                    <span className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">Select Customer</span>
                                    {selectedCustomer && (
                                        <button
                                            type="button"
                                            onClick={() => setIsChangingCustomer(false)}
                                            className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-semibold"
                                        >
                                            Keep current ({selectedCustomer.name})
                                        </button>
                                    )}
                                </div>
                                <CustomerSearch customers={state.customers} onSelectCustomer={(c) => handleSelectCustomer(c)} />
                            </div>
                        )
                    )}

                    {/* Detected New Site Location Prompt */}
                    {unmatchedLocationPrompt && selectedCustomer && (
                        <div className="bg-indigo-50 dark:bg-indigo-950/40 p-3 border border-indigo-200 dark:border-indigo-800 rounded-xl flex items-center justify-between gap-3 text-xs shadow-sm">
                            <div className="space-y-0.5">
                                <span className="font-bold text-indigo-900 dark:text-indigo-200 flex items-center gap-1.5">
                                    <MapPin size={14} className="text-indigo-600 shrink-0" />
                                    New Site Location Specified in Work Order
                                </span>
                                <p className="text-indigo-700 dark:text-indigo-300 font-medium pl-5">{unmatchedLocationPrompt.address}</p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                                <Button type="button" size="sm" onClick={handleAddLocationFromWO} disabled={isSavingLocation} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs py-1 px-3 rounded-lg flex items-center gap-1">
                                    <Plus size={13} />
                                    {isSavingLocation ? "Saving..." : "Add & Select Site"}
                                </Button>
                                <button type="button" onClick={() => setUnmatchedLocationPrompt(null)} className="text-slate-400 hover:text-slate-600">
                                    <X size={14} />
                                </button>
                            </div>
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

                    {/* Location Section */}
                    {selectedCustomer && (
                        selectedCustomer.customerType === 'Residential' ? (
                            <div className="bg-slate-50/80 dark:bg-slate-800/50 p-4 border border-slate-200 dark:border-slate-700/80 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 border border-blue-200 dark:border-blue-900/50">
                                        <MapPin size={20} />
                                    </div>
                                    <div className="min-w-0">
                                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Residential Dispatch Address</span>
                                        <button
                                            type="button"
                                            onClick={() => setAuditLocationId(selectedPropertyId || 'default')}
                                            className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1.5 text-left flex-wrap"
                                            title="Click to view all work history, jobs & documents for this location"
                                        >
                                            <span className="truncate">{selectedCustomer.address || 'Main Customer Address'}</span>
                                            <span className="text-[10px] font-black uppercase tracking-wider bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300 px-2 py-0.5 rounded-full shrink-0 border border-indigo-200 dark:border-indigo-800">
                                                View Docs & History ↗
                                            </span>
                                        </button>
                                    </div>
                                </div>
                                {selectedCustomer.serviceLocations && selectedCustomer.serviceLocations.length > 1 && (
                                    <Button
                                        type="button"
                                        variant="secondary"
                                        size="sm"
                                        onClick={() => setIsManualLocationModalOpen(true)}
                                        className="text-xs py-1.5 px-3 self-start sm:self-center"
                                    >
                                        + Add Alt Site Location
                                    </Button>
                                )}
                            </div>
                        ) : (
                            <div className="bg-amber-50/70 dark:bg-amber-950/30 p-4 border border-amber-200 dark:border-amber-800/80 rounded-2xl space-y-3 shadow-sm">
                                <div className="flex items-center justify-between flex-wrap gap-2">
                                    <span className="text-xs font-bold uppercase tracking-wider text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                                        <Building2 size={16} className="text-amber-600" />
                                        Target Property / Service Location
                                    </span>
                                    <div className="flex items-center gap-2">
                                        {selectedPropertyId && (
                                            <button
                                                type="button"
                                                onClick={() => setAuditLocationId(selectedPropertyId)}
                                                className="text-[10px] font-black uppercase tracking-wider bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300 px-2.5 py-1 rounded-lg border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-200 transition-all flex items-center gap-1"
                                                title="View all jobs, work orders, proposals, and documents for this site"
                                            >
                                                <FileText size={12} /> View Location History & Docs ↗
                                            </button>
                                        )}
                                        <Button
                                            type="button"
                                            variant="secondary"
                                            size="sm"
                                            onClick={() => setIsManualLocationModalOpen(true)}
                                            className="text-[10px] py-1 px-2.5 bg-amber-100 dark:bg-amber-900/40 text-amber-900 dark:text-amber-200 border-amber-300 dark:border-amber-700 hover:bg-amber-200"
                                        >
                                            + Add New Location
                                        </Button>
                                    </div>
                                </div>
                                <LocationSearchSelector 
                                    locations={selectedCustomer.serviceLocations || []}
                                    selectedLocationId={selectedPropertyId}
                                    onSelectLocation={(loc) => setSelectedPropertyId(loc.id)}
                                    label=""
                                    placeholder="Search location name, store #1042, address, city, zip, building..."
                                    allowAddNew={true}
                                    onAddNew={() => setIsManualLocationModalOpen(true)}
                                    customerDefaultAddress={{
                                        name: `${selectedCustomer.name} (Main HQ Site)`,
                                        address: selectedCustomer.address,
                                        city: selectedCustomer.city || '',
                                        state: selectedCustomer.state || '',
                                        zip: selectedCustomer.zip || ''
                                    }}
                                />
                            </div>
                        )
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
                        partnerNteAmount={partnerNteAmount}
                        setPartnerNteAmount={setPartnerNteAmount}
                        subcontractorPhone={subcontractorPhone}
                        setSubcontractorPhone={setSubcontractorPhone}
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
                                            Proposal #{p.proposalNumber || p.id} - {title} (${(Number(p.total) || 0).toFixed(2)}) | {locInfo} ({dateStr}){locSuffix}
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
                                {((jobToEdit?.files && jobToEdit.files.length > 0) || (attachedInboundFiles && attachedInboundFiles.length > 0)) && (
                                    <div className="space-y-1.5 bg-white dark:bg-slate-900/60 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                                        <span className="block text-[9px] font-black uppercase text-slate-400 tracking-wider mb-2">Attached Job Files / Receipts / Work Orders</span>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                            {attachedInboundFiles.map((file: any, i: number) => (
                                                <a
                                                    key={`inbound-${i}`}
                                                    href={file.url}
                                                    download={file.name}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="p-2 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/40 dark:hover:bg-blue-900/60 rounded-lg text-[10px] font-bold text-blue-700 dark:text-blue-300 flex items-center justify-between border border-blue-200 dark:border-blue-800 truncate"
                                                >
                                                    <span className="truncate flex items-center gap-1.5">
                                                        <Paperclip size={12} className="shrink-0 text-blue-500" />
                                                        {file.name}
                                                    </span>
                                                    <Download size={12} className="shrink-0 text-blue-500 ml-1" />
                                                </a>
                                            ))}
                                            {jobToEdit?.files && jobToEdit.files.map((file: any, i: number) => {
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

                    <div className="flex items-center justify-end gap-3 pt-3 pb-1 sticky bottom-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 z-20 -mx-4 sm:-mx-6 px-4 sm:px-6 mt-4">
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
            {isManualLocationModalOpen && selectedCustomer && (
                <Modal isOpen={isManualLocationModalOpen} onClose={() => setIsManualLocationModalOpen(false)} title={`Add Site Location for ${selectedCustomer.name}`} size="md">
                    <form onSubmit={handleSaveManualLocation} className="space-y-4 p-1">
                        <div>
                            <label className="block text-xs font-bold uppercase text-slate-600 dark:text-slate-400 mb-1">Property / Site Name</label>
                            <input 
                                type="text" 
                                placeholder="e.g. Building B, Suite 200, West Site" 
                                value={manualSiteName} 
                                onChange={e => setManualSiteName(e.target.value)} 
                                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-medium"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold uppercase text-slate-600 dark:text-slate-400 mb-1">Street Address</label>
                            <input 
                                type="text" 
                                placeholder="e.g. 100 Main St" 
                                value={manualSiteAddress} 
                                onChange={e => setManualSiteAddress(e.target.value)} 
                                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-medium"
                                required
                            />
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                            <div>
                                <label className="block text-[10px] font-bold uppercase text-slate-600 dark:text-slate-400 mb-1">City</label>
                                <input 
                                    type="text" 
                                    placeholder="City" 
                                    value={manualSiteCity} 
                                    onChange={e => setManualSiteCity(e.target.value)} 
                                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-medium"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold uppercase text-slate-600 dark:text-slate-400 mb-1">State</label>
                                <input 
                                    type="text" 
                                    placeholder="State" 
                                    value={manualSiteState} 
                                    onChange={e => setManualSiteState(e.target.value)} 
                                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-medium"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold uppercase text-slate-600 dark:text-slate-400 mb-1">ZIP</label>
                                <input 
                                    type="text" 
                                    placeholder="ZIP" 
                                    value={manualSiteZip} 
                                    onChange={e => setManualSiteZip(e.target.value)} 
                                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-medium"
                                />
                            </div>
                        </div>
                        <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-700">
                            <Button type="button" variant="secondary" size="sm" onClick={() => setIsManualLocationModalOpen(false)}>Cancel</Button>
                            <Button type="submit" size="sm" disabled={isSavingLocation} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold">
                                {isSavingLocation ? "Saving Location..." : "Save & Select Location"}
                            </Button>
                        </div>
                    </form>
                </Modal>
            )}
            <AddSubcontractorModal isOpen={isAddSubcontractorModalOpen} onClose={() => setIsAddSubcontractorModalOpen(false)} onSave={handleSaveSubcontractor} subcontractor={null} />
            <LocationAuditModal 
                isOpen={!!auditLocationId} 
                onClose={() => setAuditLocationId(null)} 
                customerId={selectedCustomer?.id}
                locationId={auditLocationId || undefined}
            />
        </>
    );
};

export default JobAppointmentModal;
