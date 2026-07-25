import React, { useState, useEffect } from 'react';
import { X, Printer, Mail, CheckCircle, Plus, Trash2, FileText, ChevronRight, AlertTriangle, Calendar, Clock, Check, XCircle } from 'lucide-react';
import { useAppContext } from 'context/AppContext';
import Button from 'components/ui/Button';
import Input from 'components/ui/Input';
import Textarea from 'components/ui/Textarea';
import { db } from 'lib/firebase';
import showToast from 'lib/toast';
import { formatAddress , cleanUndefinedFields } from 'lib/utils';
import { useLanguage } from 'context/LanguageContext';
import { notifyAdmins } from 'lib/notificationService';
import { checkSubcontractorCompliance, checkUserCompliance } from 'lib/subcontractorCompliance';

interface SubcontractorWorkOrderModalProps {
    isOpen: boolean;
    onClose: () => void;
    job: any;
}

const DEFAULT_VISIT_INSTRUCTIONS = [
    "Technician must wear mask when working within the clinics",
    "Proper Dress Code Required, this is a patient facing client",
    "Check in and out with manager on duty",
    "NO VAPING/SMOKING ON CLINIC PROPERTY",
    "All requests for NTE increase must be made while tech is onsite (Labor MUST match IVR hours)",
    "Before/After Photos: Taking before and after photos is required",
    "PROPOSALS ARE REQUIRED TO BE SUBMITTED WITHIN 24 HOURS OF BEING ONSITE",
    "Record make/model # of HVAC unit(s) being serviced (where applicable)",
    "Failure to meet mandatory requirements may result in a delay in payment"
];

const DEFAULT_TERMS = [
    "Contractor is required to follow all instructions listed on this Work Order",
    "Contractor is not to perform any work above and beyond the scope of this work order without prior approval from the Purchaser",
    "Contractor is not to discuss any pricing or leave paperwork with store/site personnel",
    "Contractor must comply with all Government, Property Owner/Management, and Tenant requirements based on the location of work",
    "When services are ordered by Purchaser, only one chargeable technician shall be dispatched unless prior written approval is provided",
    "All trips to the location must comply with the IVR Check In/Out Procedures. Failure to comply can result in non-payment of invoices",
    "All charges should be billed on one invoice with appropriate backup no later than 5 days after the work order has been completed",
    "All Invoices must reference the WO#, include a description of services along with an itemized breakdown of labor hours billed in 15 minute increments, rates, material costs and material description",
    "Unless approved in writing in advance, the following are not chargeable: fuel, tolls, parking, administrative time, or finance charges",
    "The total cost for all trips including Sales Tax cannot exceed the NTE amount on the Work Order",
    "Each trip requires a Signoff form. The form must be signed and stamped by the store manager. In addition, any required documents must be submitted with the invoice",
    "Contractor must be fully compliant with a W-9 signed registration form and updated insurance on file with Purchaser"
];

export const SubcontractorWorkOrderModal: React.FC<SubcontractorWorkOrderModalProps> = ({
    isOpen,
    onClose,
    job
}) => {
    const { t } = useLanguage();
    const { state, dispatch } = useAppContext();
    const [subcontractorId, setSubcontractorId] = useState('');
    const [nte, setNte] = useState(300);
    const [ivrNumber, setIvrNumber] = useState('');
    const [ivrPin, setIvrPin] = useState('');
    const [reportedIssue, setReportedIssue] = useState('');
    const [visitInstructions, setVisitInstructions] = useState<string[]>([]);
    const [specialInstructions, setSpecialInstructions] = useState('');
    const [terms, setTerms] = useState<string[]>([]);
    
    // UI state
    const [previewTab, setPreviewTab] = useState<'wo' | 'requirements' | 'terms'>('wo');
    const [activeTab, setActiveTab] = useState<'compose' | 'preview'>('compose');
    const [isSaving, setIsSaving] = useState(false);
    const isSubcontractor = state.currentUser?.role === 'Subcontractor';
    const hasIvr = !!(ivrNumber?.trim() || ivrPin?.trim());

    // New item inputs
    const [newInstruction, setNewInstruction] = useState('');
    const [newTerm, setNewTerm] = useState('');

    // Subcontractor Accept/Decline & Scheduling Availability state
    const [availabilityDate, setAvailabilityDate] = useState('');
    const [availabilityStart, setAvailabilityStart] = useState('');
    const [availabilityEnd, setAvailabilityEnd] = useState('');
    const [availabilityNotes, setAvailabilityNotes] = useState('');
    const [isResponding, setIsResponding] = useState(false);

    // Fetch active subcontractor users (seat-slot employees)
    const subcontractorUsers = state.users?.filter((u: any) => 
        u.role === 'Subcontractor' && 
        u.organizationId === state.currentOrganization?.id && 
        u.status !== 'archived' && 
        u.status !== 'Inactive'
    ) || [];

    // Fetch subcontractor partners (1099 company profiles)
    const subcontractorPartners = state.subcontractors?.filter((s: any) => 
        s.organizationId === state.currentOrganization?.id
    ) || [];

    useEffect(() => {
        if (isSubcontractor) {
            setActiveTab('preview');
        }
    }, [isSubcontractor]);

    useEffect(() => {
        if (job) {
            const wo = job.subcontractorWorkOrder;
            if (wo) {
                setSubcontractorId(wo.subcontractorId || job.assignedTechnicianId || job.assignedPartnerId || '');
                setNte(wo.nte || 300);
                setIvrNumber(wo.ivrNumber || '');
                setIvrPin(wo.ivrPin || '');
                setReportedIssue(wo.reportedIssue || job.notes?.internalNotes || job.tasks?.join(', ') || '');
                setVisitInstructions(wo.visitInstructions || DEFAULT_VISIT_INSTRUCTIONS);
                setSpecialInstructions(wo.specialInstructions || 'Please complete work on the first trip if possible. Contact the AM prior to leaving site.');
                setTerms(wo.terms || DEFAULT_TERMS);
                
                // Initialize availability state if already present
                if (wo.availabilityWindow) {
                    setAvailabilityDate(wo.availabilityWindow.date || '');
                    setAvailabilityStart(wo.availabilityWindow.startTime || '');
                    setAvailabilityEnd(wo.availabilityWindow.endTime || '');
                    setAvailabilityNotes(wo.availabilityWindow.notes || '');
                } else {
                    setAvailabilityDate('');
                    setAvailabilityStart('');
                    setAvailabilityEnd('');
                    setAvailabilityNotes('');
                }
            } else {
                setSubcontractorId(job.assignedTechnicianId || job.assignedPartnerId || '');
                setNte(300);
                setIvrNumber('');
                setIvrPin('');
                setReportedIssue(job.notes?.internalNotes || job.tasks?.join(', ') || '');
                setVisitInstructions(DEFAULT_VISIT_INSTRUCTIONS);
                setSpecialInstructions('Please complete work on the first trip if possible. Contact the AM prior to leaving site.');
                setTerms(DEFAULT_TERMS);
                
                setAvailabilityDate('');
                setAvailabilityStart('');
                setAvailabilityEnd('');
                setAvailabilityNotes('');
            }
        }
    }, [job]);

    useEffect(() => {
        if (!job || !isOpen) return;

        const updateIvrDetails = async () => {
            let activePin = '';
            let activeJobNumber = job.jobNumber || '';
            const defaultIvrPhone = state.currentOrganization?.twilioConfig?.phoneNumber || '(704) 823-6108';

            // 1. Auto-generate Job Number if missing
            if (!activeJobNumber) {
                activeJobNumber = Math.floor(100000 + Math.random() * 900000).toString();
                try {
                    await db.collection('jobs').doc(job.id).update(cleanUndefinedFields({
                        jobNumber: activeJobNumber
                    }));
                    job.jobNumber = activeJobNumber;
                } catch (e) {
                    console.error("Failed to auto-generate Job Number:", e);
                }
            }

            // 2. Auto-generate/fetch Subcontractor PIN if a subcontractor is selected
            if (subcontractorId) {
                const subUser = subcontractorUsers.find((s: any) => s.id === subcontractorId);
                if (subUser) {
                    activePin = (subUser as any).pin || (subUser as any).kioskPin || '';
                    if (!activePin) {
                        activePin = Math.floor(100000 + Math.random() * 900000).toString();
                        try {
                            await db.collection('users').doc(subUser.id).update(cleanUndefinedFields({
                                pin: activePin
                            }));
                            (subUser as any).pin = activePin;
                        } catch (e) {
                            console.error("Failed to auto-generate Subcontractor PIN:", e);
                        }
                    }
                }
            }

            // 3. Update state if not already set or if empty
            if (!ivrNumber) {
                setIvrNumber(defaultIvrPhone);
            }
            if (!ivrPin && activePin) {
                setIvrPin(activePin);
            }
        };

        updateIvrDetails();
    }, [subcontractorId, job, isOpen, state.currentOrganization, subcontractorUsers, ivrNumber, ivrPin]);

    if (!isOpen || !job) return null;

    const selectedSubUser = subcontractorUsers.find((s: any) => s.id === subcontractorId);
    const selectedSubPartner = subcontractorPartners.find((s: any) => s.id === subcontractorId);

    const customer = state.customers?.find((c: any) => c.id === job.customerId);
    const resolvedAddress = (() => {
        if (job.locationId && customer?.serviceLocations) {
            const loc = customer.serviceLocations.find((l: any) => l.id === job.locationId);
            if (loc?.address) return loc.address;
        }
        return job.address || customer?.address || '';
    })();
    const formattedAddress = formatAddress(resolvedAddress);

    const subName = selectedSubUser 
        ? `${selectedSubUser.firstName} ${selectedSubUser.lastName}` 
        : (selectedSubPartner ? selectedSubPartner.companyName || selectedSubPartner.contactName : 'Unassigned Subcontractor');
        
    const subPhone = selectedSubUser?.phone || selectedSubPartner?.phone || 'N/A';
    const subEmail = selectedSubUser?.email || selectedSubPartner?.email || 'N/A';

    const handleSave = async (sendEmail = false) => {
        setIsSaving(true);
        try {
            const orgInfo = {
                name: state.currentOrganization?.name || 'TekAir Inc.',
                phone: state.currentOrganization?.phone || '(210) 544-2720',
                address: state.currentOrganization?.address ? (typeof state.currentOrganization.address === 'string' ? state.currentOrganization.address : formatAddress(state.currentOrganization.address)) : '2618 Middleground, San Antonio, TX 78245',
                logoUrl: state.currentOrganization?.logoUrl || ''
            };

            const woData = {
                subcontractorId,
                nte: Number(nte),
                ivrNumber,
                ivrPin,
                reportedIssue,
                visitInstructions,
                specialInstructions,
                terms,
                organization: orgInfo,
                createdAt: job.subcontractorWorkOrder?.createdAt || new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                composedById: state.currentUser?.id || '',
                composedByName: state.currentUser ? `${state.currentUser.firstName} ${state.currentUser.lastName}` : 'Admin',
                status: job.subcontractorWorkOrder?.status || 'pending',
                availabilityWindow: job.subcontractorWorkOrder?.availabilityWindow || null,
                ...(sendEmail ? { sentAt: new Date().toISOString() } : {})
            };

            // 1. Update Job record
            await db.collection('jobs').doc(job.id).update(cleanUndefinedFields({
                subcontractorWorkOrder: woData,
                // Assign technician or partner to match subcontractor selection
                assignedTechnicianId: selectedSubUser ? subcontractorId : null,
                assignedTechnicianName: selectedSubUser ? subName : (selectedSubPartner ? `Partner: ${subName}` : 'Unassigned'),
                assignedPartnerId: selectedSubPartner ? subcontractorId : null
            }));

            // 2. Save in permanent documents repository
            const docId = `wo-${job.id}`;
            const docData = {
                id: docId,
                organizationId: state.currentOrganization?.id || 'unaffiliated',
                subcontractorId: subcontractorId || 'unassigned',
                subcontractorName: subName,
                title: `Subcontractor Work Order - Job #${job.poNumber || job.id.slice(-6).toUpperCase()}`,
                type: 'Work Order',
                createdAt: new Date().toISOString(),
                jobId: job.id,
                nte: Number(nte),
                reportedIssue,
                visitInstructions,
                specialInstructions,
                terms,
                ivrPin,
                ivrNumber,
                status: job.subcontractorWorkOrder?.status || 'pending',
                availabilityWindow: job.subcontractorWorkOrder?.availabilityWindow || null
            };
            await db.collection('documents').doc(docId).set(cleanUndefinedFields(docData), { merge: true });

            // 3. Queue Email if Send requested
            if (sendEmail && subEmail !== 'N/A') {
                const emailDocId = `mail-wo-${job.id}-${Date.now()}`;
                const emailContent = `
                    <h3>Subcontractor Work Order</h3>
                    <p>Dear ${subName},</p>
                    <p>A new work order has been issued to you by ${state.currentOrganization?.name || 'TekAir Inc.'}.</p>
                    <p><strong>Job Ref / PO:</strong> ${job.poNumber || job.id.slice(-6).toUpperCase()}</p>
                    <p><strong>NTE Limit:</strong> $${Number(nte).toFixed(2)}</p>
                    <p><strong>Reported Issue:</strong> ${reportedIssue}</p>
                    <br/>
                    <p>Please log into your TekTrakker dashboard to view the full requirements and check-in procedures to accept or decline.</p>
                `;
                await db.collection('mail').doc(emailDocId).set(cleanUndefinedFields({
                    to: [subEmail],
                    message: {
                        subject: `New Work Order Assigned: Job #${job.poNumber || job.id.slice(-6).toUpperCase()}`,
                        html: emailContent
                    }
                }));
                showToast.success('Work Order saved and emailed successfully!');
            } else {
                showToast.success('Work Order saved successfully!');
            }

            onClose();
        } catch (e: any) {
            console.error(e);
            showToast.error('Failed to save Work Order: ' + e.message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleAcceptWorkOrder = async () => {
        setIsResponding(true);
        try {
            const wo = job.subcontractorWorkOrder || {
                subcontractorId: state.currentUser?.id || subcontractorId || '',
                nte: Number(nte) || 300,
                ivrNumber,
                ivrPin,
                reportedIssue,
                visitInstructions,
                specialInstructions,
                terms,
                organization: {
                    name: state.currentOrganization?.name || 'TekAir Inc.',
                    phone: state.currentOrganization?.phone || '(210) 544-2720',
                    address: state.currentOrganization?.address ? (typeof state.currentOrganization.address === 'string' ? state.currentOrganization.address : formatAddress(state.currentOrganization.address)) : '2618 Middleground, San Antonio, TX 78245',
                    logoUrl: state.currentOrganization?.logoUrl || ''
                }
            };

            const availability = availabilityDate ? {
                date: availabilityDate,
                startTime: availabilityStart || '',
                endTime: availabilityEnd || '',
                notes: availabilityNotes || ''
            } : null;

            const updatedWo = {
                ...wo,
                status: 'accepted' as const,
                availabilityWindow: availability,
                updatedAt: new Date().toISOString(),
                respondedAt: new Date().toISOString()
            };

            const updatedJob = {
                ...job,
                subcontractorWorkOrder: updatedWo
            };

            // 1. Update Job in database
            await db.collection('jobs').doc(job.id).update(cleanUndefinedFields({
                subcontractorWorkOrder: updatedWo
            }));

            // 2. Update Document repository
            const docId = `wo-${job.id}`;
            await db.collection('documents').doc(docId).set(cleanUndefinedFields({
                status: 'accepted',
                availabilityWindow: availability,
                updatedAt: new Date().toISOString()
            }), { merge: true });

            // 3. Dispatch to AppContext
            const { dispatch: localDispatchAccepted } = useAppContext();
            localDispatchAccepted({ type: 'UPDATE_JOB', payload: updatedJob });

            // 4. Notify Admins
            const orgId = state.currentOrganization?.id || job.organizationId || 'unaffiliated';
            const currentSubName = state.currentUser ? `${state.currentUser.firstName || ''} ${state.currentUser.lastName || ''}`.trim() : subName;
            
            const adminPayload = {
                title: `Work Order Accepted: Job #${job.poNumber || job.id.slice(-6).toUpperCase()}`,
                body: `${currentSubName} has accepted the Work Order. Suggested availability window: ${
                    availability ? `${availability.date} (${availability.startTime} - ${availability.endTime})` : 'Not specified'
                }`,
                type: 'WorkOrderAccepted',
                data: {
                    jobId: job.id,
                    subcontractorId: state.currentUser?.id || subcontractorId,
                    availability
                }
            };
            await notifyAdmins(orgId, adminPayload);

            // Queue email to admins
            try {
                const adminsSnapshot = await db.collection('users')
                    .where('organizationId', '==', orgId)
                    .where('role', 'in', ['admin', 'master_admin', 'both'])
                    .get();
                
                const adminEmails = adminsSnapshot.docs
                    .map(doc => doc.data().email)
                    .filter(email => typeof email === 'string' && email.trim() !== '');

                if (adminEmails.length > 0) {
                    const emailContent = `
                        <h3>Subcontractor Work Order Accepted</h3>
                        <p><strong>Subcontractor:</strong> ${currentSubName}</p>
                        <p><strong>Job Ref / PO:</strong> ${job.poNumber || job.id.slice(-6).toUpperCase()}</p>
                        <p><strong>Status:</strong> Accepted</p>
                        <p><strong>Proposed Availability Window:</strong> ${
                            availability ? `${availability.date} ${availability.startTime} - ${availability.endTime}` : 'No specific window suggested'
                        }</p>
                        ${availability?.notes ? `<p><strong>Subcontractor Notes:</strong> ${availability.notes}</p>` : ''}
                        <br/>
                        <p>Please review the job and schedule the appointment accordingly.</p>
                    `;
                    await db.collection('mail_queue').add(cleanUndefinedFields({
                        to: adminEmails,
                        message: {
                            subject: `Accepted: Work Order for Job #${job.poNumber || job.id.slice(-6).toUpperCase()}`,
                            html: emailContent,
                            text: `Subcontractor ${currentSubName} accepted job #${job.poNumber || job.id.slice(-6).toUpperCase()}. Availability: ${
                                availability ? `${availability.date} ${availability.startTime} - ${availability.endTime}` : 'No window specified'
                            }`
                        },
                        organizationId: orgId,
                        status: 'pending',
                        createdAt: new Date().toISOString()
                    }));
                }
            } catch (mailErr) {
                console.error("Failed to queue email notification to admins:", mailErr);
            }

            showToast.success("Work Order successfully accepted!");
            onClose();
        } catch (e: any) {
            console.error(e);
            showToast.error("Failed to accept Work Order: " + e.message);
        } finally {
            setIsResponding(false);
        }
    };

    const handleDeclineWorkOrder = async () => {
        setIsResponding(true);
        try {
            const wo = job.subcontractorWorkOrder || {
                subcontractorId: state.currentUser?.id || subcontractorId || '',
                nte: Number(nte) || 300,
                ivrNumber,
                ivrPin,
                reportedIssue,
                visitInstructions,
                specialInstructions,
                terms,
                organization: {
                    name: state.currentOrganization?.name || 'TekAir Inc.',
                    phone: state.currentOrganization?.phone || '(210) 544-2720',
                    address: state.currentOrganization?.address ? (typeof state.currentOrganization.address === 'string' ? state.currentOrganization.address : formatAddress(state.currentOrganization.address)) : '2618 Middleground, San Antonio, TX 78245',
                    logoUrl: state.currentOrganization?.logoUrl || ''
                }
            };

            const updatedWo = {
                ...wo,
                status: 'declined' as const,
                updatedAt: new Date().toISOString(),
                respondedAt: new Date().toISOString()
            };

            const updatedJob = {
                ...job,
                subcontractorWorkOrder: updatedWo
            };

            // 1. Update Job in database
            await db.collection('jobs').doc(job.id).update(cleanUndefinedFields({
                subcontractorWorkOrder: updatedWo
            }));

            // 2. Update Document repository
            const docId = `wo-${job.id}`;
            await db.collection('documents').doc(docId).set(cleanUndefinedFields({
                status: 'declined',
                updatedAt: new Date().toISOString()
            }), { merge: true });

            // 3. Dispatch to AppContext
            const { dispatch: localDispatchDeclined } = useAppContext();
            localDispatchDeclined({ type: 'UPDATE_JOB', payload: updatedJob });

            // 4. Notify Admins
            const orgId = state.currentOrganization?.id || job.organizationId || 'unaffiliated';
            const currentSubName = state.currentUser ? `${state.currentUser.firstName || ''} ${state.currentUser.lastName || ''}`.trim() : subName;

            const adminPayload = {
                title: `Work Order Declined: Job #${job.poNumber || job.id.slice(-6).toUpperCase()}`,
                body: `${currentSubName} has declined the Work Order.`,
                type: 'WorkOrderDeclined',
                data: {
                    jobId: job.id,
                    subcontractorId: state.currentUser?.id || subcontractorId
                }
            };
            await notifyAdmins(orgId, adminPayload);

            // Queue email to admins
            try {
                const adminsSnapshot = await db.collection('users')
                    .where('organizationId', '==', orgId)
                    .where('role', 'in', ['admin', 'master_admin', 'both'])
                    .get();
                
                const adminEmails = adminsSnapshot.docs
                    .map(doc => doc.data().email)
                    .filter(email => typeof email === 'string' && email.trim() !== '');

                if (adminEmails.length > 0) {
                    const emailContent = `
                        <h3>Subcontractor Work Order Declined</h3>
                        <p><strong>Subcontractor:</strong> ${currentSubName}</p>
                        <p><strong>Job Ref / PO:</strong> ${job.poNumber || job.id.slice(-6).toUpperCase()}</p>
                        <p><strong>Status:</strong> Declined</p>
                        <br/>
                        <p>Please review and reassign the job or contact the subcontractor.</p>
                    `;
                    await db.collection('mail_queue').add(cleanUndefinedFields({
                        to: adminEmails,
                        message: {
                            subject: `Declined: Work Order for Job #${job.poNumber || job.id.slice(-6).toUpperCase()}`,
                            html: emailContent,
                            text: `Subcontractor ${currentSubName} declined job #${job.poNumber || job.id.slice(-6).toUpperCase()}.`
                        },
                        organizationId: orgId,
                        status: 'pending',
                        createdAt: new Date().toISOString()
                    }));
                }
            } catch (mailErr) {
                console.error("Failed to queue email notification to admins:", mailErr);
            }

            showToast.success("Work Order declined.");
            onClose();
        } catch (e: any) {
            console.error(e);
            showToast.error("Failed to decline Work Order: " + e.message);
        } finally {
            setIsResponding(false);
        }
    };

    const addInstruction = () => {
        if (newInstruction.trim()) {
            setVisitInstructions([...visitInstructions, newInstruction.trim()]);
            setNewInstruction('');
        }
    };

    const removeInstruction = (index: number) => {
        setVisitInstructions(visitInstructions.filter((_, i) => i !== index));
    };

    const addTerm = () => {
        if (newTerm.trim()) {
            setTerms([...terms, newTerm.trim()]);
            setNewTerm('');
        }
    };

    const removeTerm = (index: number) => {
        setTerms(terms.filter((_, i) => i !== index));
    };

    // Printable HTML generator
    const generatePrintHtml = () => {
        const org: any = state.currentOrganization || { name: 'TekAir Inc.', phone: '(210) 544-2720', address: '2618 Middleground, San Antonio, TX 78245', logoUrl: '' };
        const subName = selectedSubUser 
            ? `${selectedSubUser.firstName} ${selectedSubUser.lastName}` 
            : (selectedSubPartner ? selectedSubPartner.companyName || selectedSubPartner.contactName : 'Unassigned Subcontractor');
        const subPhone = selectedSubUser?.phone || selectedSubPartner?.phone || 'N/A';
        const subEmail = selectedSubUser?.email || selectedSubPartner?.email || 'N/A';

        return `
            <div style="font-family: Arial, sans-serif; color: #333; line-height: 1.4; max-width: 800px; margin: 0 auto; padding: 20px; background-color: #fff;">
                <!-- PAGE 1: WORK ORDER SHEET -->
                <div style="page-break-after: always; padding-bottom: 30px;">
                    <div style="display: flex; justify-content: space-between; border-bottom: 2px solid #333; padding-bottom: 15px; margin-bottom: 20px; align-items: flex-end;">
                        <div>
                            ${org.logoUrl ? `<img src="${org.logoUrl}" style="max-height: 48px; max-width: 180px; object-fit: contain; margin-bottom: 8px; display: block;" alt="${org.name}" />` : `<h1 style="margin: 0; font-size: 26px; font-weight: 900; color: #0284c7; letter-spacing: -0.5px;">${org.name}</h1>`}
                            <p style="margin: 3px 0 0 0; font-size: 11px; color: #666;">${typeof org.address === 'string' ? org.address : formatAddress(org.address)}</p>
                            <p style="margin: 2px 0 0 0; font-size: 11px; color: #666;">Phone: ${org.phone}</p>
                        </div>
                        <div style="text-align: right;">
                            <h2 style="margin: 0; font-size: 22px; font-weight: 800; color: #1e293b; text-transform: uppercase;">WORK ORDER</h2>
                            <p style="margin: 5px 0 0 0; font-size: 12px; font-weight: bold;">Work Order #: ${job.jobNumber || job.poNumber || job.id.slice(-6).toUpperCase()}</p>
                            <p style="margin: 2px 0 0 0; font-size: 11px; color: #555;">Issue Date: ${new Date().toLocaleDateString()}</p>
                            <p style="margin: 2px 0 0 0; font-size: 11px; color: #555;">Schedule Date: ${new Date(job.appointmentTime).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</p>
                        </div>
                    </div>

                    <div style="display: flex; gap: 20px; margin-bottom: 25px;">
                        <div style="flex: 1; border: 1px solid #ddd; padding: 12px; border-radius: 8px;">
                            <h3 style="margin: 0 0 8px 0; font-size: 12px; text-transform: uppercase; color: #0284c7; font-weight: bold; border-bottom: 1px solid #eee; padding-bottom: 4px;">Service Location</h3>
                            <p style="margin: 0; font-size: 13px; font-weight: bold;">${job.customerName}</p>
                            <p style="margin: 4px 0 0 0; font-size: 12px; color: #444; white-space: pre-line;">${formattedAddress}</p>
                        </div>
                        <div style="flex: 1; border: 1px solid #ddd; padding: 12px; border-radius: 8px;">
                            <h3 style="margin: 0 0 8px 0; font-size: 12px; text-transform: uppercase; color: #0284c7; font-weight: bold; border-bottom: 1px solid #eee; padding-bottom: 4px;">Technician / Contractor</h3>
                            <p style="margin: 0; font-size: 13px; font-weight: bold;">${subName}</p>
                            <p style="margin: 4px 0 0 0; font-size: 12px; color: #444;">Phone: ${subPhone}</p>
                            <p style="margin: 2px 0 0 0; font-size: 12px; color: #444;">Email: ${subEmail}</p>
                        </div>
                    </div>

                    <div style="display: flex; gap: 20px; margin-bottom: 25px; align-items: stretch;">
                        <div style="flex: ${hasIvr ? '1.2' : '1'}; border: 1px solid #ef4444; padding: 15px; border-radius: 8px; background-color: #fef2f2; text-align: center; display: flex; flex-direction: column; justify-content: center; align-items: center;">
                            <h4 style="margin: 0; font-size: 13px; text-transform: uppercase; color: #991b1b; font-weight: bold;">Not-To-Exceed (N.T.E.) Amount</h4>
                            <p style="margin: 8px 0; font-size: 28px; font-weight: 900; color: #b91c1c; line-height: 1;">$${nte.toFixed(2)}</p>
                            <p style="margin: 0; font-size: 10px; color: #7f1d1d; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px;">Must Call for Pre-Approval if Cost Exceeds limit</p>
                        </div>
                        ${hasIvr ? `
                        <div style="flex: 1.8; border: 1px solid #ddd; padding: 12px; border-radius: 8px; background-color: #fafafa;">
                            <h3 style="margin: 0 0 6px 0; font-size: 12px; text-transform: uppercase; color: #334155; font-weight: bold; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px;">IVR Check-In Instructions</h3>
                            <p style="margin: 4px 0; font-size: 11px; font-weight: bold; color: #d97706; text-transform: uppercase;">Mandatory Call-In Required Upon Arrival & Departure</p>
                            <p style="margin: 4px 0; font-size: 11px; color: #444;"><strong>1. Call System:</strong> ${ivrNumber}</p>
                            <p style="margin: 2px 0; font-size: 11px; color: #444;"><strong>2. Security PIN:</strong> ${ivrPin} / <strong>Job #:</strong> ${job.jobNumber || job.poNumber || job.id.slice(-6).toUpperCase()}</p>
                            <p style="margin: 2px 0; font-size: 11px; color: #444;"><strong>3. Actions:</strong> Follow voice prompts to log on-site presence. Labor hours must align with call logs.</p>
                        </div>
                        ` : ''}
                    </div>

                    <div style="border: 1px solid #ddd; padding: 15px; border-radius: 8px; margin-bottom: 25px;">
                        <h3 style="margin: 0 0 10px 0; font-size: 13px; text-transform: uppercase; color: #1e293b; font-weight: bold; border-bottom: 2px solid #f1f5f9; padding-bottom: 6px;">Reported Issue</h3>
                        <p style="margin: 0; font-size: 12px; color: #334155; white-space: pre-wrap; font-family: monospace; background-color: #f8fafc; padding: 10px; border-radius: 6px; border: 1px solid #e2e8f0;">${reportedIssue || 'No issue description provided.'}</p>
                    </div>

                    <div style="border: 1px solid #ddd; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                        <h3 style="margin: 0 0 10px 0; font-size: 13px; text-transform: uppercase; color: #1e293b; font-weight: bold; border-bottom: 2px solid #f1f5f9; padding-bottom: 6px;">Special Instructions</h3>
                        <p style="margin: 0; font-size: 12px; color: #334155; white-space: pre-wrap;">${specialInstructions || 'None provided.'}</p>
                    </div>

                    <p style="font-size: 10px; color: #888; text-align: center; margin-top: 40px; border-top: 1px solid #eee; padding-top: 10px;">Page 1 of 3 - Subcontractor Work Order</p>
                </div>

                <!-- PAGE 2: REQUIREMENTS & SIGN-OFF -->
                <div style="page-break-after: always; padding-top: 20px; padding-bottom: 30px;">
                    <div style="display: flex; justify-content: space-between; border-bottom: 2px solid #333; padding-bottom: 15px; margin-bottom: 20px; align-items: flex-end;">
                        <div>
                            ${org.logoUrl ? `<img src="${org.logoUrl}" style="max-height: 40px; max-width: 150px; object-fit: contain; margin-bottom: 6px; display: block;" alt="${org.name}" />` : `<h1 style="margin: 0; font-size: 26px; font-weight: 900; color: #0284c7;">${org.name}</h1>`}
                            <p style="margin: 3px 0 0 0; font-size: 11px; color: #666;">Work Order Compliance & Sign-Off Requirements</p>
                        </div>
                        <div style="text-align: right;">
                            <p style="margin: 0; font-size: 12px; font-weight: bold;">Work Order #: ${job.poNumber || job.id.slice(-6).toUpperCase()}</p>
                            <p style="margin: 2px 0 0 0; font-size: 11px; color: #555;">Date: ${new Date().toLocaleDateString()}</p>
                        </div>
                    </div>

                    <div style="border: 1px solid #ddd; padding: 15px; border-radius: 8px; margin-bottom: 25px;">
                        <h3 style="margin: 0 0 12px 0; font-size: 13px; text-transform: uppercase; color: #0284c7; font-weight: bold; border-bottom: 1px solid #eee; padding-bottom: 6px;">Mandatory Visit Instructions</h3>
                        <ul style="margin: 0; padding-left: 20px; font-size: 12px; color: #334155;">
                            ${visitInstructions.map((inst: string) => `<li style="margin-bottom: 8px;">${inst}</li>`).join('')}
                        </ul>
                    </div>

                    <div style="border: 1px solid #ddd; padding: 20px; border-radius: 8px; margin-top: 30px; background-color: #fafafa;">
                        <h3 style="margin: 0 0 15px 0; font-size: 13px; text-transform: uppercase; color: #1e293b; font-weight: bold; text-align: center; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px;">Location Manager Sign-Off</h3>
                        <p style="font-size: 11px; color: #555; text-align: center; margin-top: 0; margin-bottom: 20px;">Technician must obtain signature, printed name, and store/site stamp upon completion of work.</p>
                        
                        <div style="display: flex; gap: 20px; margin-bottom: 25px;">
                            <div style="flex: 1;">
                                <label style="font-size: 9px; font-weight: bold; text-transform: uppercase; color: #666; display: block; margin-bottom: 4px;">Date of Service</label>
                                <div style="border-bottom: 1px solid #333; height: 30px;"></div>
                            </div>
                            <div style="flex: 2;">
                                <label style="font-size: 9px; font-weight: bold; text-transform: uppercase; color: #666; display: block; margin-bottom: 4px;">Manager Name (Printed)</label>
                                <div style="border-bottom: 1px solid #333; height: 30px;"></div>
                            </div>
                        </div>

                        <div style="display: flex; gap: 20px;">
                            <div style="flex: 2;">
                                <label style="font-size: 9px; font-weight: bold; text-transform: uppercase; color: #666; display: block; margin-bottom: 4px;">Manager Signature</label>
                                <div style="border-bottom: 1px solid #333; height: 30px;"></div>
                            </div>
                            <div style="flex: 1; border: 2px dashed #94a3b8; height: 80px; border-radius: 8px; display: flex; align-items: center; justify-content: center; background-color: #fff;">
                                <span style="font-size: 10px; font-weight: bold; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px;">Store Stamp Here</span>
                            </div>
                        </div>
                    </div>

                    <p style="font-size: 10px; color: #888; text-align: center; margin-top: 40px; border-top: 1px solid #eee; padding-top: 10px;">Page 2 of 3 - Visit & Sign-off</p>
                </div>

                <!-- PAGE 3: TERMS & CONDITIONS -->
                <div style="padding-top: 20px;">
                    <div style="display: flex; justify-content: space-between; border-bottom: 2px solid #333; padding-bottom: 15px; margin-bottom: 20px; align-items: flex-end;">
                        <div>
                            ${org.logoUrl ? `<img src="${org.logoUrl}" style="max-height: 40px; max-width: 150px; object-fit: contain; margin-bottom: 6px; display: block;" alt="${org.name}" />` : `<h1 style="margin: 0; font-size: 26px; font-weight: 900; color: #0284c7;">${org.name}</h1>`}
                            <p style="margin: 3px 0 0 0; font-size: 11px; color: #666;">Work Order Legal & Payment Terms</p>
                        </div>
                        <div style="text-align: right;">
                            <p style="margin: 0; font-size: 12px; font-weight: bold;">Work Order #: ${job.poNumber || job.id.slice(-6).toUpperCase()}</p>
                        </div>
                    </div>

                    <div style="border: 1px solid #ddd; padding: 15px; border-radius: 8px; margin-bottom: 10px; background-color: #fff;">
                        <h3 style="margin: 0 0 12px 0; font-size: 13px; text-transform: uppercase; color: #1e293b; font-weight: bold; border-bottom: 1px solid #eee; padding-bottom: 6px;">Work Order Terms & Conditions</h3>
                        <ol style="margin: 0; padding-left: 20px; font-size: 11px; color: #475569; line-height: 1.5;">
                            ${terms.map((term: string) => `<li style="margin-bottom: 10px;">${term}</li>`).join('')}
                        </ol>
                    </div>

                    <p style="font-size: 10px; color: #888; text-align: center; margin-top: 30px; border-top: 1px solid #eee; padding-top: 10px;">Page 3 of 3 - Terms & Conditions</p>
                </div>
            </div>
        `;
    };

    const handlePrint = () => {
        const win = window.open('', '_blank');
        if (win) {
            win.document.write(`
                <!DOCTYPE html>
                <html>
                <head>
                    <title>Work Order - ${job.poNumber || job.id.slice(-6).toUpperCase()}</title>
                    <style>
                        body { margin: 0; padding: 20px; font-family: sans-serif; background-color: #f1f5f9; }
                        @media print {
                            body { background-color: #ffffff; padding: 0; }
                            .no-print { display: none; }
                        }
                    </style>
                </head>
                <body>
                    ${generatePrintHtml()}
                    <script>
                        window.onload = function() {
                            window.print();
                        }
                    </script>
                </body>
                </html>
            `);
            win.document.close();
        }
    };

    const previewOrg: any = job.subcontractorWorkOrder?.organization || {
        name: state.currentOrganization?.name || 'TekAir Inc.',
        phone: state.currentOrganization?.phone || '(210) 544-2720',
        address: state.currentOrganization?.address ? (typeof state.currentOrganization.address === 'string' ? state.currentOrganization.address : formatAddress(state.currentOrganization.address)) : '2618 Middleground, San Antonio, TX 78245',
        logoUrl: state.currentOrganization?.logoUrl || ''
    };

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[999] flex items-center justify-center p-4 overflow-y-auto animate-fade-in print:hidden">
            <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] w-full max-w-7xl h-[90vh] flex flex-col shadow-2xl border border-slate-200/50 dark:border-slate-800/50 overflow-hidden">
                
                {/* Header */}
                <div className="p-6 border-b border-slate-100 dark:border-slate-850 flex justify-between items-center bg-slate-50 dark:bg-slate-900/40">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-teal-100 dark:bg-teal-950/40 flex items-center justify-center text-teal-600 dark:text-teal-400">
                            <FileText size={20}/>
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">
                                {isSubcontractor ? 'Work Order & Requirements' : 'Subcontractor Work Order Composer'}
                            </h2>
                            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Job #{job.poNumber || job.id.slice(-6).toUpperCase()}</p>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                        {/* Tab toggle for smaller screens */}
                        {!isSubcontractor && (
                            <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl lg:hidden">
                                <button 
                                    onClick={() => setActiveTab('compose')} 
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${activeTab === 'compose' ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-800 dark:text-white' : 'text-slate-500'}`}
                                >
                                    Compose
                                </button>
                                <button 
                                    onClick={() => setActiveTab('preview')} 
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${activeTab === 'preview' ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-800 dark:text-white' : 'text-slate-500'}`}
                                >
                                    Preview
                                </button>
                            </div>
                        )}

                        <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition">
                            <X size={20}/>
                        </button>
                    </div>
                </div>

                {/* Content split screen */}
                <div className="flex-1 flex overflow-hidden">
                    
                    {/* Left Form: Compose */}
                    {!isSubcontractor && (
                        <div className={`flex-1 overflow-y-auto p-6 space-y-6 border-r border-slate-100 dark:border-slate-850 ${activeTab === 'compose' ? 'block' : 'hidden lg:block'}`}>
                        <div className="bg-slate-50 dark:bg-slate-850/30 p-4 rounded-3xl border border-slate-200/50 dark:border-slate-800 space-y-4">
                            <h4 className="font-bold text-xs uppercase text-slate-400 tracking-wider">Assignments & NTE</h4>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[11px] font-black text-slate-400 dark:text-slate-400 uppercase tracking-widest block mb-2">Select Subcontractor</label>
                                    <select 
                                        value={subcontractorId}
                                        onChange={(e) => setSubcontractorId(e.target.value)}
                                        className="w-full h-11 px-4 bg-white dark:bg-slate-900 border border-slate-250 dark:border-slate-800 rounded-2xl text-sm font-medium text-slate-700 dark:text-slate-200 outline-none focus:border-teal-500 transition"
                                    >
                                        <option value="">-- Select Subcontractor / Partner --</option>
                                        
                                        {subcontractorUsers.length > 0 && (
                                            <optgroup label="Individual Subcontractor Users (Seat Slots)">
                                                {subcontractorUsers.map((sub: any) => (
                                                    <option key={sub.id} value={sub.id}>
                                                        👤 {sub.firstName} {sub.lastName} {sub.email ? `(${sub.email})` : ''}
                                                    </option>
                                                ))}
                                            </optgroup>
                                        )}
                                        
                                        {subcontractorPartners.length > 0 && (
                                            <optgroup label="External Subcontractor Companies (1099)">
                                                {subcontractorPartners.map((sub: any) => (
                                                    <option key={sub.id} value={sub.id}>
                                                        🏢 {sub.companyName} {sub.contactName ? `(Contact: ${sub.contactName})` : ''}
                                                    </option>
                                                ))}
                                            </optgroup>
                                        )}
                                    </select>

                                    {/* Compliance Validation Box */}
                                    {(() => {
                                        if (!subcontractorId) return null;
                                        const subPartner = subcontractorPartners.find((s: any) => s.id === subcontractorId);
                                        const subUser = subcontractorUsers.find((u: any) => u.id === subcontractorId);

                                        let comp: any = null;
                                        if (subPartner) {
                                            comp = checkSubcontractorCompliance(subPartner, state.currentOrganization?.subcontractorComplianceSettings);
                                        } else if (subUser) {
                                            comp = checkUserCompliance(subUser, state.currentOrganization?.subcontractorComplianceSettings);
                                        }

                                        if (!comp) return null;

                                        return (
                                            <div className="mt-2">
                                                {comp.isCompliant ? (
                                                    <div className="p-2 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl text-[11px] font-extrabold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                                                        <Check className="w-3.5 h-3.5 text-emerald-500" />
                                                        Compliance Verified ({comp.fulfilledCount}/{comp.totalRequiredCount} Docs)
                                                    </div>
                                                ) : (
                                                    <div className="p-2.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl text-[11px] text-amber-900 dark:text-amber-200 space-y-1">
                                                        <div className="flex items-center gap-1.5 font-extrabold text-amber-800 dark:text-amber-300">
                                                            <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                                                            Missing Required Compliance Documents
                                                        </div>
                                                        <p className="text-[10px] opacity-90 leading-tight">
                                                            Missing: <strong>{comp.missingDocLabels.join(', ')}</strong>
                                                        </p>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })()}
                                </div>
                                <Input 
                                    label="NTE Limit ($)" 
                                    type="number" 
                                    value={nte} 
                                    onChange={(e) => setNte(Number(e.target.value))} 
                                />
                            </div>
                        </div>

                        <div className="bg-slate-50 dark:bg-slate-850/30 p-4 rounded-3xl border border-slate-200/50 dark:border-slate-800 space-y-4">
                            <h4 className="font-bold text-xs uppercase text-slate-400 tracking-wider">IVR & Reported Issue</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Input label="IVR Dial-In Phone" value={ivrNumber} onChange={(e) => setIvrNumber(e.target.value)} />
                                <Input label="IVR Pass Pin" value={ivrPin} onChange={(e) => setIvrPin(e.target.value)} />
                            </div>
                            <Textarea 
                                label="Reported Issue / Work Scope" 
                                rows={3} 
                                value={reportedIssue} 
                                onChange={(e) => setReportedIssue(e.target.value)} 
                            />
                        </div>

                        {/* Visit Requirements */}
                        <div className="bg-slate-50 dark:bg-slate-850/30 p-4 rounded-3xl border border-slate-200/50 dark:border-slate-800 space-y-4">
                            <div className="flex justify-between items-center">
                                <h4 className="font-bold text-xs uppercase text-slate-400 tracking-wider">Visit Requirements Checklist</h4>
                                <span className="text-[10px] bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded-full font-bold">{visitInstructions.length} Items</span>
                            </div>

                            <div className="space-y-2">
                                {visitInstructions.map((inst, index) => (
                                    <div key={index} className="flex gap-2 items-center bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-100 dark:border-slate-850">
                                        <ChevronRight size={14} className="text-slate-400 shrink-0" />
                                        <span className="text-xs text-slate-700 dark:text-slate-300 flex-1">{inst}</span>
                                        <button onClick={() => removeInstruction(index)} className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-md transition">
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                ))}
                            </div>

                            <div className="flex gap-2">
                                <input 
                                    placeholder="Add custom visit instruction..." 
                                    value={newInstruction} 
                                    onChange={(e) => setNewInstruction(e.target.value)}
                                    className="flex-1 h-10 px-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-200 outline-none focus:border-teal-500 transition"
                                    onKeyDown={(e) => e.key === 'Enter' && addInstruction()}
                                />
                                <Button onClick={addInstruction} className="h-10 px-4 w-auto flex items-center gap-1.5 bg-slate-800 dark:bg-slate-700 text-xs">
                                    <Plus size={14} /> Add
                                </Button>
                            </div>
                        </div>

                        {/* Special Instructions & Terms */}
                        <div className="bg-slate-50 dark:bg-slate-850/30 p-4 rounded-3xl border border-slate-200/50 dark:border-slate-800 space-y-4">
                            <h4 className="font-bold text-xs uppercase text-slate-400 tracking-wider">Custom Notes</h4>
                            <Textarea 
                                label="Special Instructions Notes" 
                                rows={2} 
                                value={specialInstructions} 
                                onChange={(e) => setSpecialInstructions(e.target.value)} 
                            />
                        </div>

                        <div className="bg-slate-50 dark:bg-slate-850/30 p-4 rounded-3xl border border-slate-200/50 dark:border-slate-800 space-y-4">
                            <div className="flex justify-between items-center">
                                <h4 className="font-bold text-xs uppercase text-slate-400 tracking-wider">Contract Terms & Conditions</h4>
                                <span className="text-[10px] bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded-full font-bold">{terms.length} Bullet Points</span>
                            </div>

                            <div className="space-y-2 max-h-60 overflow-y-auto">
                                {terms.map((term, index) => (
                                    <div key={index} className="flex gap-2 items-start bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-100 dark:border-slate-850">
                                        <span className="text-xs font-bold text-slate-400 shrink-0 mt-0.5">{index + 1}.</span>
                                        <span className="text-xs text-slate-600 dark:text-slate-400 flex-1 leading-relaxed">{term}</span>
                                        <button onClick={() => removeTerm(index)} className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-md transition shrink-0">
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                ))}
                            </div>

                            <div className="flex gap-2">
                                <input 
                                    placeholder="Add custom legal term..." 
                                    value={newTerm} 
                                    onChange={(e) => setNewTerm(e.target.value)}
                                    className="flex-1 h-10 px-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-200 outline-none focus:border-teal-500 transition"
                                    onKeyDown={(e) => e.key === 'Enter' && addTerm()}
                                />
                                <Button onClick={addTerm} className="h-10 px-4 w-auto flex items-center gap-1.5 bg-slate-800 dark:bg-slate-700 text-xs">
                                    <Plus size={14} /> Add
                                </Button>
                            </div>
                        </div>
                    </div>
                    )}

                    {/* Right Preview */}
                    <div className={`flex-1 overflow-y-auto p-6 bg-slate-100 dark:bg-slate-950 flex flex-col ${isSubcontractor ? 'w-full' : (activeTab === 'preview' ? 'block' : 'hidden lg:flex')}`}>
                        
                        {/* Subcontractor Response Section */}
                        {(() => {
                            const status = job.subcontractorWorkOrder?.status || 'pending';
                            const availability = job.subcontractorWorkOrder?.availabilityWindow;
                            
                            if (isSubcontractor) {
                                return (
                                    <div className="mb-6 w-full max-w-[800px] self-center bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-md text-left">
                                        <div className="flex items-center gap-3 mb-4">
                                            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${
                                                status === 'accepted' ? 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-455' :
                                                status === 'declined' ? 'bg-rose-100 dark:bg-rose-950/40 text-rose-600 dark:text-rose-455' :
                                                'bg-amber-100 dark:bg-amber-950/40 text-amber-600 dark:text-amber-455'
                                            }`}>
                                                {status === 'accepted' ? <Check size={20}/> : status === 'declined' ? <XCircle size={20}/> : <FileText size={20}/>}
                                            </div>
                                            <div>
                                                <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                                                    {status === 'accepted' ? t("Work Order Accepted") : status === 'declined' ? t("Work Order Declined") : t("Respond to Work Order")}
                                                </h3>
                                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                                    {status === 'accepted' ? t("You have accepted this assignment.") : status === 'declined' ? t("You have declined this assignment.") : t("Please review the details below and select your response.")}
                                                </p>
                                            </div>
                                        </div>

                                        {status === 'pending' && (
                                            <div className="space-y-4 pt-2 border-t border-slate-100 dark:border-slate-800">
                                                <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                                                    <Calendar size={14} className="text-primary-500" />
                                                    {t("Propose Availability Time Window (Optional)")}
                                                </h4>
                                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                                    <div>
                                                        <label className="text-[10px] font-black text-slate-450 uppercase tracking-wider block mb-1">Date</label>
                                                        <input 
                                                            type="date"
                                                            value={availabilityDate}
                                                            onChange={e => setAvailabilityDate(e.target.value)}
                                                            className="w-full h-10 px-3 bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold outline-none focus:border-teal-500 dark:text-white transition"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="text-[10px] font-black text-slate-450 uppercase tracking-wider block mb-1">Start Time</label>
                                                        <input 
                                                            type="time"
                                                            value={availabilityStart}
                                                            onChange={e => setAvailabilityStart(e.target.value)}
                                                            className="w-full h-10 px-3 bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold outline-none focus:border-teal-500 dark:text-white transition"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="text-[10px] font-black text-slate-450 uppercase tracking-wider block mb-1">End Time</label>
                                                        <input 
                                                            type="time"
                                                            value={availabilityEnd}
                                                            onChange={e => setAvailabilityEnd(e.target.value)}
                                                            className="w-full h-10 px-3 bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold outline-none focus:border-teal-500 dark:text-white transition"
                                                        />
                                                    </div>
                                                </div>
                                                <div>
                                                    <label className="text-[10px] font-black text-slate-450 uppercase tracking-wider block mb-1">Notes for Admins</label>
                                                    <textarea 
                                                        rows={2}
                                                        value={availabilityNotes}
                                                        onChange={e => setAvailabilityNotes(e.target.value)}
                                                        placeholder="e.g. Can do anytime after 10 AM, will bring extra ladder..."
                                                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold outline-none focus:border-teal-500 dark:text-white transition resize-none"
                                                    />
                                                </div>

                                                <div className="flex justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                                                    <Button 
                                                        onClick={handleDeclineWorkOrder}
                                                        disabled={isResponding}
                                                        className="h-10 px-4 w-auto bg-rose-650 hover:bg-rose-700 text-white font-bold text-xs uppercase tracking-wider flex items-center gap-1.5"
                                                    >
                                                        <XCircle size={14}/> {t("Decline")}
                                                    </Button>
                                                    <Button 
                                                        onClick={handleAcceptWorkOrder}
                                                        disabled={isResponding}
                                                        className="h-10 px-5 w-auto bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs uppercase tracking-wider flex items-center gap-1.5"
                                                    >
                                                        <CheckCircle size={14}/> {isResponding ? t("Processing...") : t("Accept & Confirm")}
                                                    </Button>
                                                </div>
                                            </div>
                                        )}

                                        {status === 'accepted' && (
                                            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-3">
                                                {availability ? (
                                                    <div className="bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/40 rounded-2xl p-4 flex gap-3 items-start">
                                                        <Clock size={16} className="text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                                                        <div className="text-xs text-emerald-800 dark:text-emerald-300">
                                                            <p className="font-bold">Proposed Scheduling Time Window:</p>
                                                            <p className="mt-1 font-semibold">{availability.date} &bull; {availability.startTime} - {availability.endTime}</p>
                                                            {availability.notes && <p className="mt-2 text-slate-500 dark:text-slate-400 italic">Notes: {availability.notes}</p>}
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <p className="text-xs text-slate-500 dark:text-slate-450 italic">{t("No specific time window was scheduled.")}</p>
                                                )}

                                                {/* Allow updates to scheduled availability */}
                                                <details className="group">
                                                    <summary className="text-[11px] font-black text-slate-555 dark:text-slate-450 hover:text-slate-800 dark:hover:text-white cursor-pointer uppercase tracking-wider list-none flex items-center gap-1">
                                                        <span className="group-open:rotate-90 transition-transform">&bull;</span> {t("Update Suggestion")}
                                                    </summary>
                                                    <div className="space-y-4 mt-3 bg-slate-50 dark:bg-slate-850 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
                                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                                            <div>
                                                                <label className="text-[10px] font-black text-slate-450 uppercase tracking-wider block mb-1">Date</label>
                                                                <input 
                                                                    type="date"
                                                                    value={availabilityDate}
                                                                    onChange={e => setAvailabilityDate(e.target.value)}
                                                                    className="w-full h-9 px-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold outline-none focus:border-teal-500 dark:text-white transition"
                                                                />
                                                            </div>
                                                            <div>
                                                                <label className="text-[10px] font-black text-slate-450 uppercase tracking-wider block mb-1">Start Time</label>
                                                                <input 
                                                                    type="time"
                                                                    value={availabilityStart}
                                                                    onChange={e => setAvailabilityStart(e.target.value)}
                                                                    className="w-full h-9 px-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold outline-none focus:border-teal-500 dark:text-white transition"
                                                                />
                                                            </div>
                                                            <div>
                                                                <label className="text-[10px] font-black text-slate-450 uppercase tracking-wider block mb-1">End Time</label>
                                                                <input 
                                                                    type="time"
                                                                    value={availabilityEnd}
                                                                    onChange={e => setAvailabilityEnd(e.target.value)}
                                                                    className="w-full h-9 px-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold outline-none focus:border-teal-500 dark:text-white transition"
                                                                />
                                                            </div>
                                                        </div>
                                                        <div>
                                                            <label className="text-[10px] font-black text-slate-450 uppercase tracking-wider block mb-1">Notes</label>
                                                            <textarea 
                                                                rows={2}
                                                                value={availabilityNotes}
                                                                onChange={e => setAvailabilityNotes(e.target.value)}
                                                                className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold outline-none focus:border-teal-500 dark:text-white transition resize-none"
                                                            />
                                                        </div>
                                                        <div className="flex justify-end">
                                                            <Button 
                                                                onClick={handleAcceptWorkOrder}
                                                                disabled={isResponding}
                                                                className="h-9 px-4 w-auto bg-slate-800 dark:bg-slate-700 text-white font-bold text-xs uppercase tracking-wider"
                                                            >
                                                                {isResponding ? t("Saving...") : t("Update Schedule")}
                                                            </Button>
                                                        </div>
                                                    </div>
                                                </details>
                                            </div>
                                        )}
                                    </div>
                                );
                            }

                            // Admin view: show subcontractor's response summary
                            if (status !== 'pending' || availability) {
                                return (
                                    <div className="mb-6 w-full max-w-[800px] self-center bg-slate-50 dark:bg-slate-850/50 rounded-3xl p-5 border border-slate-200/55 dark:border-slate-800 text-left">
                                        <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
                                            <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider">Subcontractor Response Status</h4>
                                            <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-full tracking-wider ${
                                                status === 'accepted' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400' :
                                                status === 'declined' ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-450' :
                                                'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-450'
                                            }`}>
                                                {status.toUpperCase()}
                                            </span>
                                        </div>
                                        {availability && (
                                            <div className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 rounded-2xl p-4 flex gap-3 items-start">
                                                <Clock size={16} className="text-slate-550 dark:text-slate-450 shrink-0 mt-0.5" />
                                                <div className="text-xs text-slate-700 dark:text-slate-300">
                                                    <p className="font-bold">Scheduled Availability Time Window:</p>
                                                    <p className="mt-1 font-semibold">{availability.date} &bull; {availability.startTime} - {availability.endTime}</p>
                                                    {availability.notes && <p className="mt-2 text-slate-550 dark:text-slate-450 italic">Notes: {availability.notes}</p>}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            }

                            return null;
                        })()}

                        {/* Page Toggles */}
                        <div className="flex bg-slate-200 dark:bg-slate-900 p-1.5 rounded-2xl mb-4 self-center w-full max-w-md shrink-0">
                            <button 
                                onClick={() => setPreviewTab('wo')} 
                                className={`flex-1 py-2 text-xs font-black uppercase tracking-widest rounded-xl transition ${previewTab === 'wo' ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500'}`}
                            >
                                WO Page 1
                            </button>
                            <button 
                                onClick={() => setPreviewTab('requirements')} 
                                className={`flex-1 py-2 text-xs font-black uppercase tracking-widest rounded-xl transition ${previewTab === 'requirements' ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500'}`}
                            >
                                Req Page 2
                            </button>
                            <button 
                                onClick={() => setPreviewTab('terms')} 
                                className={`flex-1 py-2 text-xs font-black uppercase tracking-widest rounded-xl transition ${previewTab === 'terms' ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500'}`}
                            >
                                Terms Page 3
                            </button>
                        </div>

                        {/* Interactive Page Container */}
                        <div className="flex-1 flex justify-center items-start overflow-y-auto">
                            <div className="bg-white text-slate-850 p-8 rounded-3xl shadow-xl w-full max-w-[800px] border border-slate-200 min-h-[900px] font-sans antialiased text-left selection:bg-teal-100">
                                
                                {previewTab === 'wo' && (
                                    <div className="animate-fade-in space-y-6">
                                        {/* Header */}
                                        <div className="flex justify-between border-b-2 border-slate-800 pb-4 items-end">
                                            <div>
                                                {previewOrg.logoUrl ? (
                                                    <img src={previewOrg.logoUrl} className="h-12 w-auto object-contain mb-2" alt="Logo"/>
                                                ) : (
                                                    <h1 className="text-2xl font-black text-teal-600 tracking-tight">{previewOrg.name}</h1>
                                                )}
                                                <p className="text-[10px] text-slate-500 mt-1">{typeof previewOrg.address === 'string' ? previewOrg.address : formatAddress(previewOrg.address)}</p>
                                                <p className="text-[10px] text-slate-500">Phone: {previewOrg.phone}</p>
                                            </div>
                                            <div className="text-right">
                                                <h2 className="text-xl font-extrabold text-slate-800 tracking-widest uppercase">WORK ORDER</h2>
                                                <p className="text-xs font-bold text-slate-800 mt-1">Work Order #: {job.jobNumber || job.poNumber || job.id.slice(-6).toUpperCase()}</p>
                                                <p className="text-[10px] text-slate-500 mt-0.5">Issue Date: {new Date().toLocaleDateString()}</p>
                                                <p className="text-[10px] text-slate-500">Schedule Date: {new Date(job.appointmentTime).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</p>
                                            </div>
                                        </div>

                                        {/* Assignment Side-by-side */}
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="border border-slate-200 rounded-xl p-3.5 bg-slate-50/50">
                                                <h3 className="text-[10px] font-bold text-teal-600 uppercase tracking-widest border-b border-slate-100 pb-1 mb-2">Service Location</h3>
                                                <p className="text-xs font-bold text-slate-900">{job.customerName}</p>
                                                <p className="text-xs text-slate-600 mt-1 whitespace-pre-line leading-relaxed">{formattedAddress}</p>
                                            </div>
                                            <div className="border border-slate-200 rounded-xl p-3.5 bg-slate-50/50">
                                                <h3 className="text-[10px] font-bold text-teal-600 uppercase tracking-widest border-b border-slate-100 pb-1 mb-2">Technician / Contractor</h3>
                                                <p className="text-xs font-bold text-slate-900">{subName}</p>
                                                {(selectedSubUser || selectedSubPartner) && (
                                                    <div className="mt-1.5 space-y-0.5 text-xs text-slate-600">
                                                        <p>Phone: {subPhone}</p>
                                                        <p>Email: {subEmail}</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* NTE & IVR */}
                                        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                                            <div className={`${hasIvr ? 'md:col-span-2' : 'md:col-span-5'} border border-red-200 rounded-xl p-4 bg-red-50/50 flex flex-col items-center justify-center text-center`}>
                                                <h4 className="text-[10px] font-black uppercase text-red-800 tracking-wider">Not-To-Exceed (N.T.E.) Amount</h4>
                                                <p className="text-3xl font-black text-red-650 my-1">${nte.toFixed(2)}</p>
                                                <p className="text-[8px] font-bold text-red-900 uppercase">Pre-Approval Required for Increases</p>
                                            </div>
                                            
                                            {hasIvr && (
                                                <div className="md:col-span-3 border border-slate-200 rounded-xl p-3.5 bg-slate-50/50">
                                                    <h3 className="text-[10px] font-bold text-slate-700 uppercase tracking-widest border-b border-slate-100 pb-1 mb-2">IVR Check-In Instructions</h3>
                                                    <p className="text-[9px] font-extrabold text-amber-700 uppercase mb-1 flex items-center gap-1">
                                                        <AlertTriangle size={10}/> CALL LOGS MUST MATCH ON-SITE LABOR HOURS
                                                    </p>
                                                    <div className="text-[11px] text-slate-600 space-y-0.5">
                                                        <p><strong>1. Call System:</strong> {ivrNumber}</p>
                                                        <p><strong>2. Security PIN:</strong> {ivrPin} / <strong>Job #:</strong> {job.jobNumber || job.poNumber || job.id.slice(-6).toUpperCase()}</p>
                                                        <p><strong>3. Action:</strong> Call upon arriving and prior to departure to log hours.</p>
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {/* Scope */}
                                        <div className="border border-slate-200 rounded-xl p-4">
                                            <h3 className="text-[10px] font-bold text-slate-800 uppercase tracking-widest border-b border-slate-150 pb-1 mb-2">Reported Issue</h3>
                                            <p className="text-xs text-slate-700 whitespace-pre-wrap font-mono bg-slate-50 p-3 rounded-lg border border-slate-100">{reportedIssue || 'No issue description provided.'}</p>
                                        </div>

                                        {/* Special Instructions */}
                                        <div className="border border-slate-200 rounded-xl p-4">
                                            <h3 className="text-[10px] font-bold text-slate-800 uppercase tracking-widest border-b border-slate-150 pb-1 mb-2">Special Instructions</h3>
                                            <p className="text-xs text-slate-600 leading-relaxed">{specialInstructions || 'None provided.'}</p>
                                        </div>

                                        <p className="text-[9px] text-slate-400 text-center border-t border-slate-100 pt-3 mt-12">Page 1 of 3 - Subcontractor Work Order</p>
                                    </div>
                                )}

                                {previewTab === 'requirements' && (
                                    <div className="animate-fade-in space-y-6">
                                        <div className="flex justify-between border-b-2 border-slate-800 pb-4 items-end">
                                            <div>
                                                {previewOrg.logoUrl ? (
                                                    <img src={previewOrg.logoUrl} className="h-10 w-auto object-contain mb-1.5" alt="Logo"/>
                                                ) : (
                                                    <h1 className="text-2xl font-black text-teal-600 tracking-tight">{previewOrg.name}</h1>
                                                )}
                                                <p className="text-[10px] text-slate-500 mt-1">Work Order Compliance & Sign-Off Requirements</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-xs font-bold text-slate-800">Work Order #: {job.poNumber || job.id.slice(-6).toUpperCase()}</p>
                                                <p className="text-[10px] text-slate-500 mt-0.5">Date: {new Date().toLocaleDateString()}</p>
                                            </div>
                                        </div>

                                        <div className="border border-slate-200 rounded-xl p-4">
                                            <h3 className="text-[10px] font-bold text-teal-600 uppercase tracking-widest border-b border-slate-100 pb-1 mb-3">Mandatory Visit Instructions</h3>
                                            <ul className="list-disc pl-5 text-xs text-slate-700 space-y-2 leading-relaxed">
                                                {visitInstructions.map((inst, index) => (
                                                    <li key={index}>{inst}</li>
                                                ))}
                                            </ul>
                                        </div>

                                        <div className="border border-slate-200 rounded-xl p-6 bg-slate-50/50 mt-8">
                                            <h3 className="text-xs font-bold text-slate-855 uppercase tracking-widest text-center border-b-2 border-slate-200 pb-2 mb-4">Location Manager Sign-Off</h3>
                                            <p className="text-[10px] text-slate-500 text-center mb-6">Technician must obtain signature, printed name, and store/site stamp upon completion of work.</p>
                                            
                                            <div className="grid grid-cols-3 gap-6 mb-6">
                                                <div className="col-span-1">
                                                    <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Date of Service</label>
                                                    <div className="border-b border-slate-800 h-8"></div>
                                                </div>
                                                <div className="col-span-2">
                                                    <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Manager Name (Printed)</label>
                                                    <div className="border-b border-slate-800 h-8"></div>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-3 gap-6 items-end">
                                                <div className="col-span-2">
                                                    <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Manager Signature</label>
                                                    <div className="border-b border-slate-800 h-8"></div>
                                                </div>
                                                <div className="col-span-1 border-2 border-dashed border-slate-300 h-20 rounded-xl flex items-center justify-center bg-white">
                                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider text-center">Store Stamp Here</span>
                                                </div>
                                            </div>
                                        </div>

                                        <p className="text-[9px] text-slate-400 text-center border-t border-slate-100 pt-3 mt-12">Page 2 of 3 - Visit & Sign-off</p>
                                    </div>
                                )}

                                {previewTab === 'terms' && (
                                    <div className="animate-fade-in space-y-6">
                                        <div className="flex justify-between border-b-2 border-slate-800 pb-4 items-end">
                                            <div>
                                                {previewOrg.logoUrl ? (
                                                    <img src={previewOrg.logoUrl} className="h-10 w-auto object-contain mb-1.5" alt="Logo"/>
                                                ) : (
                                                    <h1 className="text-2xl font-black text-teal-600 tracking-tight">{previewOrg.name}</h1>
                                                )}
                                                <p className="text-[10px] text-slate-550 mt-1">Work Order Legal & Payment Terms</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-xs font-bold text-slate-800">Work Order #: {job.poNumber || job.id.slice(-6).toUpperCase()}</p>
                                            </div>
                                        </div>

                                        <div className="border border-slate-200 rounded-xl p-4 bg-white">
                                            <h3 className="text-[10px] font-bold text-slate-700 uppercase tracking-widest border-b border-slate-100 pb-1 mb-3">Work Order Terms & Conditions</h3>
                                            <ol className="list-decimal pl-5 text-[10px] text-slate-500 space-y-2 leading-relaxed">
                                                {terms.map((term, index) => (
                                                    <li key={index} className="pl-1">{term}</li>
                                                ))}
                                            </ol>
                                        </div>

                                        <p className="text-[9px] text-slate-400 text-center border-t border-slate-100 pt-3 mt-12">Page 3 of 3 - Terms & Conditions</p>
                                    </div>
                                )}

                            </div>
                        </div>
                    </div>

                </div>

                {/* Footer Actions */}
                <div className="p-6 border-t border-slate-100 dark:border-slate-850 flex flex-col sm:flex-row justify-between items-center bg-slate-50 dark:bg-slate-900/40 gap-4 shrink-0">
                    <div className="flex items-center gap-2">
                        <Button 
                            variant="secondary"
                            onClick={handlePrint}
                            className="h-11 px-5 w-auto flex items-center gap-2"
                        >
                            <Printer size={16}/> Print PDF
                        </Button>
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto">
                        <Button 
                            variant="secondary"
                            onClick={onClose}
                            className="h-11 px-5"
                        >
                            {isSubcontractor ? 'Close' : 'Cancel'}
                        </Button>
                        {!isSubcontractor && (
                            <>
                                <Button 
                                    variant="secondary"
                                    onClick={() => handleSave(true)}
                                    disabled={isSaving}
                                    className="h-11 px-5 w-auto flex items-center gap-2 bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100"
                                >
                                    <Mail size={16}/> Save & Email
                                </Button>
                                <Button 
                                    onClick={() => handleSave(false)}
                                    disabled={isSaving}
                                    className="h-11 px-6 w-auto flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white"
                                >
                                    <CheckCircle size={16}/> {isSaving ? 'Saving...' : 'Save & Close'}
                                </Button>
                            </>
                        )}
                    </div>
                </div>

            </div>
        </div>
    );
};

export default SubcontractorWorkOrderModal;
