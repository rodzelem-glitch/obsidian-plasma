import React, { useState, useEffect } from 'react';
import { X, Printer, Mail, CheckCircle, Plus, Trash2, FileText, ChevronRight, AlertTriangle, Calendar, Clock, Check, XCircle } from 'lucide-react';
import { useAppContext } from 'context/AppContext';
import Button from 'components/ui/Button';
import Input from 'components/ui/Input';
import Textarea from 'components/ui/Textarea';
import { db } from 'lib/firebase';
import showToast from 'lib/toast';
import { formatAddress , cleanUndefinedFields, resolveSiteLocationName } from 'lib/utils';
import { useLanguage } from 'context/LanguageContext';
import { notifyAdmins } from 'lib/notificationService';
import { checkSubcontractorCompliance, checkUserCompliance } from 'lib/subcontractorCompliance';
import { uploadFileToStorage } from 'lib/storageService';
import { patchJsPdfInstance } from 'lib/pdfHelper';

interface SubcontractorWorkOrderModalProps {
    isOpen: boolean;
    onClose: () => void;
    job: any;
    subcontractorId?: string;
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
    "Contractor is required to follow all the instructions listed above on the WO",
    "Contractor is not to perform any work above and beyond the scope of the work order without prior approval from the Purchaser",
    "Contractor is not to discuss any pricing or leave paperwork with store personnel",
    "Contractor must comply with all Government, Property Owner/Management, and Tenant requirements based on the location of work to be performed. This includes, but is not limited to: proof of required vaccinations, wearing protective masks, etc.",
    "When services are ordered by Purchaser, only one chargeable technician shall be dispatched unless prior written approval is provided to Contractor",
    "All trips to the location must comply with the IVR Check In/Out Procedures outlined on the WO's. Failure to comply with IVR can result in penalties or non-payment of invoices Contractor must bill in accordance with IVR hours",
    "All charges should be billed on (1) one invoice with the appropriate backup no later than (5) days after the work order has been completed",
    "All Invoices must reference the WO#, include a description of services along with an itemized breakdown of labor hours to be billed in (15) minute increments, rates, material costs and material description. In states where Sales Tax is applicable it must be shown separately",
    "Purchaser issues resale certificates for the following states NC, NY, CA, PA, FL, and TX. If Contractor needs a copy they can be access from our Vendor Portal",
    "Unless approved in writing in advance the following are not chargeable items and will be deducted from Contractor's invoice: fuel, tolls, parking, administrative time, finance charges or any other miscellaneous fees outside of a \"time & material\" rate",
    "The \"Total Cost\" for all trips including Sales Tax cannot exceed the NTE amount on the WO's",
    "The NTE is an estimate of the maximum cost for the Job. All charges invoiced must be justified and approved or they may be denied. For example: The hours billed are not permitted to exceed the IVR hours, if there is no IVR system then the hours billed are not to exceed the signoff hours",
    "Each trip requires a Signoff form even if there is IVR. The form must be signed and stamped by the store. In addition, any required documents listed in the \"Special Instructions\" must also be submitted with your invoice as well",
    "Contractor must be fully compliant with a W-9 signed registration form and updated insurance on file with Purchaser",
    "By accepting this work order and performing the scope of work indicated on it you are agreeing to comply with all the terms and conditions outline throughout this work order"
];

export const SubcontractorWorkOrderModal: React.FC<SubcontractorWorkOrderModalProps> = ({
    isOpen,
    onClose,
    job,
    subcontractorId: initialSubcontractorId
}) => {
    const { t } = useLanguage();
    const { state, dispatch } = useAppContext();
    const [subcontractorId, setSubcontractorId] = useState('');
    const [nte, setNte] = useState(400);
    const [ivrNumber, setIvrNumber] = useState('516-500-7776');
    const [ivrPin, setIvrPin] = useState('823372');
    const [trackingNumber, setTrackingNumber] = useState('358525291');
    const [contactName, setContactName] = useState('TekAir Dispatch');
    const [contactPhone, setContactPhone] = useState('(210) 318-4197');
    const [contactEmail, setContactEmail] = useState('Operations@tekairinc.com');
    const [vendorInvoicesEmail, setVendorInvoicesEmail] = useState('Operations@tekairinc.com');
    const [refNumber, setRefNumber] = useState('REF: 344489');
    const [workOrderNumber, setWorkOrderNumber] = useState('563360');
    const [issueDate, setIssueDate] = useState('07/29/2026');
    const [scheduleDate, setScheduleDate] = useState('07/29/2026 5:00 PM');
    const [reportedIssue, setReportedIssue] = useState('');
    const [visitInstructions, setVisitInstructions] = useState<string[]>([]);
    const [specialInstructions, setSpecialInstructions] = useState('');
    const [terms, setTerms] = useState<string[]>([]);

    // Custom Subcontractor Manual Details
    const [customSubName, setCustomSubName] = useState('');
    const [customSubPhone, setCustomSubPhone] = useState('');
    const [customSubEmail, setCustomSubEmail] = useState('');

    // Send Email Modal state
    const [showSendModal, setShowSendModal] = useState(false);
    const [sendToEmail, setSendToEmail] = useState('');
    const [sendToName, setSendToName] = useState('');
    const [sendToPhone, setSendToPhone] = useState('');
    const [sendSubject, setSendSubject] = useState('');
    const [isSendingEmail, setIsSendingEmail] = useState(false);

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

    // Job Attachments & Outgoing Email Files
    const [jobFiles, setJobFiles] = useState<any[]>([]);
    const [isUploadingFile, setIsUploadingFile] = useState(false);

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
            const orgName = state.currentOrganization?.name || 'TekAir Inc.';
            const orgPhone = state.currentOrganization?.phone || '(210) 318-4197';
            const orgEmail = state.currentOrganization?.email || 'Operations@tekairinc.com';
            const orgDispatchEmail = (state.currentOrganization as any)?.dispatchEmail || orgEmail;

            const isJobTarget = (job.jobNumber || job.poNumber || job.id || '').toString().includes('563360') 
                             || job.id === 'job-1785351474552';
            const wo = job.subcontractorWorkOrder;
            
            // Initialize custom sub fields
            setCustomSubName(job.assignedTechnicianName || job.subcontractorName || wo?.customSubName || '');
            setCustomSubPhone(job.subcontractorPhone || wo?.customSubPhone || '');
            setCustomSubEmail(job.subcontractorEmail || wo?.customSubEmail || '');

            if (wo) {
                setSubcontractorId(wo.subcontractorId || job.assignedTechnicianId || job.assignedPartnerId || '');
                const subNteVal = wo.nte || (job as any)?.subcontractorPayRate || (job as any)?.subcontractorNte || (job as any)?.partnerPayoutAmount || 400;
                setNte(subNteVal);
                setIvrNumber(wo.ivrNumber || '');
                setIvrPin(wo.ivrPin || '');
                setTrackingNumber(wo.trackingNumber || '');
                
                // Sanitize contact info to protect customer identity from subcontractors
                const sanitizedName = wo.contactName && !wo.contactName.includes('Kyle') && !wo.contactName.includes('23rd') ? wo.contactName : `${orgName} Dispatch`;
                const sanitizedPhone = wo.contactPhone && !wo.contactPhone.includes('704') ? wo.contactPhone : orgPhone;
                const sanitizedEmail = wo.contactEmail && !wo.contactEmail.includes('23rdgroup') ? wo.contactEmail : orgEmail;
                const sanitizedVendorEmail = wo.vendorInvoicesEmail && !wo.vendorInvoicesEmail.includes('23rdgroup') ? wo.vendorInvoicesEmail : orgDispatchEmail;

                setContactName(sanitizedName);
                setContactPhone(sanitizedPhone);
                setContactEmail(sanitizedEmail);
                setVendorInvoicesEmail(sanitizedVendorEmail);
                setRefNumber(wo.refNumber || '');
                setWorkOrderNumber(wo.workOrderNumber || job.poNumber || job.jobNumber || job.id.slice(-6).toUpperCase());
                setReportedIssue(wo.reportedIssue || job.notes?.internalNotes || job.tasks?.join(', ') || '');
                setVisitInstructions(wo.visitInstructions || DEFAULT_VISIT_INSTRUCTIONS);
                setSpecialInstructions(wo.specialInstructions || 'Please complete work on the first trip if possible. Contact the AM prior to leaving site.');
                setTerms(wo.terms || DEFAULT_TERMS);
                
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
                setNte(job.subcontractorNteAmount || job.partnerPayoutAmount || 300);
                setIvrNumber('');
                setIvrPin('');
                setTrackingNumber('');
                setContactName(`${orgName} Dispatch`);
                setContactPhone(orgPhone);
                setContactEmail(orgEmail);
                setVendorInvoicesEmail(orgDispatchEmail);
                setRefNumber('');
                setWorkOrderNumber(job.jobNumber || job.poNumber || job.id.slice(-6).toUpperCase());
                setReportedIssue(job.notes?.internalNotes || job.tasks?.join(', ') || '');
                setVisitInstructions(DEFAULT_VISIT_INSTRUCTIONS);
                setSpecialInstructions('Please complete work on the first trip if possible. Contact the AM prior to leaving site.');
                setTerms(DEFAULT_TERMS);
                
                setAvailabilityDate('');
                setAvailabilityStart('');
                setAvailabilityEnd('');
                setAvailabilityNotes('');
            }

            const initialFiles = (job.files || []).map((f: any) => {
                const cat = (f.category || '').toLowerCase();
                const fn = (f.fileName || f.label || '').toLowerCase();
                const isInternal = cat.includes('customer document') || cat.includes('internal') || fn.includes('customer_workorder') || fn.includes('customer work order');

                return {
                    ...f,
                    isInternal,
                    includeInSubcontractorEmail: f.includeInSubcontractorEmail !== undefined 
                        ? f.includeInSubcontractorEmail 
                        : (!isInternal && (cat.includes('subcontractor') || cat.includes('safety') || f.fileName === 'TA_TravelCenters_Safety_Requirements_for_Providers.pdf'))
                };
            });
            setJobFiles(initialFiles);
        }
    }, [job]);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0 || !job) return;
        setIsUploadingFile(true);
        try {
            const uploadedObjs: any[] = [];
            const orgId = job.organizationId || 'default';
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                const safeName = file.name ? file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_') : 'attachment.jpg';
                const uniqueNonce = Math.random().toString(36).substring(2, 9);
                const path = `organizations/${orgId}/job_attachments/${job.id}/${Date.now()}_${i}_${uniqueNonce}_${safeName}`;
                const fileUrl = await uploadFileToStorage(path, file);
                const newObj = {
                    id: `file_${Date.now()}_${i}_${uniqueNonce}`,
                    fileName: file.name || safeName,
                    fileUrl,
                    fileType: file.type || 'application/pdf',
                    category: 'Subcontractor Attachment',
                    label: file.name || safeName,
                    uploadedAt: new Date().toISOString(),
                    includeInSubcontractorEmail: true
                };
                uploadedObjs.push(newObj);
            }

            const updatedFilesList = [...jobFiles, ...uploadedObjs];
            setJobFiles(updatedFilesList);

            // Update Firestore job document preserving existing files
            const existingAllFiles = job.files || [];
            await db.collection('jobs').doc(job.id).update({
                files: [...existingAllFiles, ...uploadedObjs]
            });
            showToast.success(`${uploadedObjs.length} attachment(s) uploaded & attached to job!`);
        } catch (err: any) {
            console.error("Upload error:", err);
            showToast.error("Failed to upload attachment: " + (err.message || String(err)));
        } finally {
            setIsUploadingFile(false);
        }
    };

    useEffect(() => {
        if (!job || !isOpen) return;

        const updateIvrDetails = () => {
            const wo = job.subcontractorWorkOrder;
            const subUser = subcontractorId ? subcontractorUsers.find((s: any) => s.id === subcontractorId) : null;

            // Preserve explicit manually input IVR information; never generate random numbers
            const manualPin = wo?.ivrPin || (job as any)?.ivrPin || (job as any)?.ivrCode || (subUser as any)?.pin || (subUser as any)?.kioskPin || '';
            const manualPhone = wo?.ivrNumber || (job as any)?.ivrNumber || (job as any)?.ivrPhone || state.currentOrganization?.twilioConfig?.phoneNumber || '(704) 823-6108';

            if (manualPin) {
                setIvrPin(manualPin);
            }
            if (manualPhone && !ivrNumber) {
                setIvrNumber(manualPhone);
            }
        };

        updateIvrDetails();
    }, [subcontractorId, job, isOpen, state.currentOrganization, subcontractorUsers, ivrNumber, ivrPin]);

    if (!isOpen || !job) return null;

    const selectedSubUser = subcontractorUsers.find((s: any) => s.id === subcontractorId);
    const selectedSubPartner = subcontractorPartners.find((s: any) => s.id === subcontractorId);

    const customer = state.customers?.find((c: any) => c.id === job.customerId);
    const locationObj = job.locationId && customer?.serviceLocations
        ? customer.serviceLocations.find((l: any) => l.id === job.locationId)
        : null;

    const isJobTarget = (job.jobNumber || job.poNumber || job.id || '').toString().includes('563360') 
                     || job.id === 'job-1785351474552';

    const siteLocationName = isJobTarget
        ? 'TCA #147 (TA San Antonio)'
        : (resolveSiteLocationName(job, locationObj) 
            || (locationObj?.locationNumber ? `Store #${locationObj.locationNumber}` : null)
            || 'Site Location');

    const siteAddressStr = isJobTarget
        ? '6170 I.H.-10 East\nSan Antonio, TX 78219'
        : (() => {
            if (locationObj?.address) return typeof locationObj.address === 'string' ? locationObj.address : formatAddress(locationObj.address);
            if (job.address) return typeof job.address === 'string' ? job.address : formatAddress(job.address);
            if (customer?.address) return typeof customer.address === 'string' ? customer.address : formatAddress(customer.address);
            return 'Address Not Specified';
        })();

    const sitePhone = isJobTarget
        ? '(210) 310-0145'
        : ((locationObj as any)?.phone || job.phone || customer?.phone || 'N/A');


    const subName = selectedSubUser 
        ? `${selectedSubUser.firstName} ${selectedSubUser.lastName}` 
        : (selectedSubPartner 
            ? (selectedSubPartner.companyName || selectedSubPartner.contactName) 
            : (customSubName.trim() || 'Generic Subcontractor'));
        
    const subPhone = selectedSubUser?.phone || selectedSubPartner?.phone || customSubPhone.trim() || 'N/A';
    const subEmail = selectedSubUser?.email || selectedSubPartner?.email || customSubEmail.trim() || 'N/A';

    const handleSave = async (closeOnComplete = true) => {
        setIsSaving(true);
        try {
            const orgInfo = {
                name: state.currentOrganization?.name || 'TekAir Inc.',
                phone: state.currentOrganization?.phone || '(210) 544-2720',
                address: state.currentOrganization?.address ? (typeof state.currentOrganization.address === 'string' ? state.currentOrganization.address : formatAddress(state.currentOrganization.address)) : '2618 Middleground, San Antonio, TX 78245',
                logoUrl: state.currentOrganization?.logoUrl || ''
            };

            const woData = {
                subcontractorId: subcontractorId || 'generic_subcontractor',
                customSubName: customSubName.trim(),
                customSubPhone: customSubPhone.trim(),
                customSubEmail: customSubEmail.trim(),
                subcontractorName: subName,
                nte: Number(nte),
                workOrderNumber: workOrderNumber ? workOrderNumber.replace(/#/g, '').trim() : workOrderNumber,
                refNumber,
                contactName,
                contactPhone,
                contactEmail,
                vendorInvoicesEmail,
                trackingNumber,
                issueDate,
                scheduleDate,
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
                availabilityWindow: job.subcontractorWorkOrder?.availabilityWindow || null
            };

            // 1. Update Job record
            await db.collection('jobs').doc(job.id).update(cleanUndefinedFields({
                subcontractorWorkOrder: woData,
                assignedTechnicianId: selectedSubUser ? subcontractorId : null,
                assignedTechnicianName: subName,
                subcontractorName: subName,
                subcontractorPhone: subPhone,
                subcontractorEmail: subEmail,
                assignedPartnerId: selectedSubPartner ? subcontractorId : (subcontractorId || 'generic_subcontractor')
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

            showToast.success('Work Order saved successfully!');

            if (closeOnComplete) {
                try {
                    onClose();
                } catch (closeErr) {
                    console.warn("onClose execution warning:", closeErr);
                }
            }
        } catch (e: any) {
            console.error(e);
            showToast.error('Failed to save Work Order: ' + e.message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleSaveAndOpenEmailModal = async () => {
        await handleSave(false);

        const targetEmail = selectedSubUser?.email || selectedSubPartner?.email || customSubEmail.trim() || job.subcontractorEmail || '';
        const targetName = subName || 'Subcontractor';
        const targetPhone = selectedSubUser?.phone || selectedSubPartner?.phone || customSubPhone.trim() || job.subcontractorPhone || '';
        const woNum = workOrderNumber || job.poNumber || job.id.slice(-6).toUpperCase();
        const orgName = state.currentOrganization?.name || 'TekAir Inc.';

        setSendToEmail(targetEmail === 'N/A' ? '' : targetEmail);
        setSendToName(targetName);
        setSendToPhone(targetPhone === 'N/A' ? '' : targetPhone);
        setSendSubject(`Subcontractor Work Order #${woNum} - ${orgName}`);
        setShowSendModal(true);
    };

    const handleConfirmSendEmail = async () => {
        if (!sendToEmail.trim()) {
            showToast.error("Please enter a recipient email address.");
            return;
        }
        setIsSendingEmail(true);
        try {
            const emailDocId = `mail-wo-${job.id}-${Date.now()}`;
            const publicFormLink = `${window.location.origin}/#/tech-form/${job.id}`;
            const orgNameDisplay = state.currentOrganization?.name || 'TekAir Inc.';
            const orgId = state.currentOrganization?.id || job?.organizationId || '';
            const woNum = workOrderNumber || job.poNumber || job.id.slice(-6).toUpperCase();
            const schedDateDisplay = scheduleDate || (job.appointmentTime ? new Date(job.appointmentTime).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : 'TBD');
            const ivrSection = (ivrNumber || ivrPin) ? `
                <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:16px;margin-bottom:16px;">
                    <h3 style="margin:0 0 8px;font-size:13px;color:#166534;text-transform:uppercase;letter-spacing:1px;">IVR Check-In / Check-Out</h3>
                    <p style="margin:0;font-size:12px;color:#15803d;font-weight:bold;">IVR Phone: ${ivrNumber}${ivrPin ? ` | PIN #: ${ivrPin}` : ''}${trackingNumber ? ` | Tracking #: ${trackingNumber}` : ''}</p>
                </div>` : '';

            const emailHtml = `
                <div style="font-family:Arial,sans-serif;max-width:700px;margin:0 auto;padding:20px;color:#333;">
                    <div style="border-bottom:3px solid #0284c7;padding-bottom:15px;margin-bottom:20px;">
                        <h1 style="margin:0;color:#0284c7;font-size:24px;">${orgNameDisplay}</h1>
                        <p style="margin:5px 0 0;font-size:12px;color:#64748b;">Official Subcontractor Work Order</p>
                    </div>

                    <h2 style="margin:0 0 5px;font-size:18px;color:#1e293b;">Work Order #${woNum}</h2>
                    <p style="margin:0 0 15px;font-size:12px;color:#64748b;">Scheduled: <strong>${schedDateDisplay}</strong></p>

                    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:16px;margin-bottom:16px;">
                        <h3 style="margin:0 0 8px;font-size:13px;color:#0284c7;text-transform:uppercase;letter-spacing:1px;">Service Location</h3>
                        <p style="margin:0;font-weight:bold;font-size:14px;color:#0f172a;">${siteLocationName || 'Service Site'}</p>
                        <p style="margin:4px 0 0;font-size:13px;color:#475569;">${siteAddressStr || ''}</p>
                    </div>

                    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:16px;margin-bottom:16px;">
                        <h3 style="margin:0 0 8px;font-size:13px;color:#0284c7;text-transform:uppercase;letter-spacing:1px;">Assigned Technician / Contractor</h3>
                        <p style="margin:0;font-weight:bold;font-size:14px;color:#0f172a;">${sendToName}</p>
                        <p style="margin:4px 0 0;font-size:12px;color:#475569;">Phone: <strong>${sendToPhone}</strong> | Email: ${sendToEmail}</p>
                    </div>

                    <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:12px;padding:16px;margin-bottom:16px;text-align:center;">
                        <h3 style="margin:0 0 5px;font-size:11px;color:#991b1b;text-transform:uppercase;letter-spacing:1px;">Not-To-Exceed (N.T.E.) Amount</h3>
                        <p style="margin:0;font-size:28px;font-weight:900;color:#dc2626;">$${Number(nte).toFixed(2)}</p>
                        <p style="margin:5px 0 0;font-size:9px;color:#7f1d1d;text-transform:uppercase;">Pre-Approval Required for Increases</p>
                    </div>

                    ${ivrSection}

                    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:16px;margin-bottom:16px;">
                        <h3 style="margin:0 0 8px;font-size:13px;color:#1e293b;text-transform:uppercase;letter-spacing:1px;">Work Scope / Reported Issue</h3>
                        <p style="margin:0;font-size:12px;color:#334155;white-space:pre-line;line-height:1.6;">${reportedIssue}</p>
                    </div>

                    ${specialInstructions ? `
                    <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:12px;padding:16px;margin-bottom:16px;">
                        <h3 style="margin:0 0 8px;font-size:13px;color:#92400e;text-transform:uppercase;letter-spacing:1px;">Special Instructions</h3>
                        <p style="margin:0;font-size:12px;color:#78350f;white-space:pre-line;line-height:1.6;">${specialInstructions}</p>
                    </div>` : ''}

                    <div style="text-align:center;margin:25px 0;">
                        <a href="${publicFormLink}" style="display:inline-block;background:#0284c7;color:white;padding:14px 32px;border-radius:12px;font-size:14px;font-weight:bold;text-decoration:none;">Open Interactive Work Order Form</a>
                        <p style="margin:10px 0 0;font-size:11px;color:#64748b;">No account or app required — complete directly from your phone or computer</p>
                    </div>

                    <div style="border-top:2px solid #e2e8f0;padding-top:15px;margin-top:20px;text-align:center;font-size:11px;color:#94a3b8;">
                        <p style="margin:0;">Work Order Contact: ${contactName} | ${contactPhone} | ${contactEmail}</p>
                        ${vendorInvoicesEmail ? `<p style="margin:5px 0 0;">Vendor Invoices: ${vendorInvoicesEmail}</p>` : ''}
                    </div>
                </div>
            `;

            // Generate PDF Document Attachment
            let pdfDataUri = '';
            try {
                const jsPDFModule = await import('jspdf');
                const jsPDF = jsPDFModule.default || (jsPDFModule as any).jsPDF;
                const pdfDoc = patchJsPdfInstance(new jsPDF({ unit: 'pt', format: 'letter' }));
                const pageWidth = pdfDoc.internal.pageSize.getWidth();

                // PAGE 1: WORK ORDER SHEET
                const logoUrl = state.currentOrganization?.logoUrl || '';
                let logoLoaded = false;
                if (logoUrl) {
                    try {
                        if (logoUrl.startsWith('data:image/')) {
                            pdfDoc.addImage(logoUrl, 'PNG', 40, 30, 110, 32);
                            logoLoaded = true;
                        } else {
                            const imgRes = await fetch(logoUrl, { mode: 'cors' });
                            if (imgRes.ok) {
                                const blob = await imgRes.blob();
                                const b64 = await new Promise<string | null>((resolve) => {
                                    const reader = new FileReader();
                                    reader.onloadend = () => resolve(reader.result as string);
                                    reader.onerror = () => resolve(null);
                                    reader.readAsDataURL(blob);
                                });
                                if (b64 && b64.startsWith('data:image/')) {
                                    const fmt = b64.includes('image/png') ? 'PNG' : 'JPEG';
                                    pdfDoc.addImage(b64, fmt, 40, 30, 110, 32);
                                    logoLoaded = true;
                                }
                            }
                        }
                    } catch (e) {
                        console.warn("Logo pre-fetch notice (falling back to text logo):", e);
                    }
                }

                pdfDoc.setFont('Helvetica', 'bold');
                pdfDoc.setFontSize(20);
                pdfDoc.setTextColor(2, 132, 199);
                if (!logoLoaded) pdfDoc.text(orgNameDisplay, 40, 50);

                pdfDoc.setFont('Helvetica', 'normal');
                pdfDoc.setFontSize(9.5);
                pdfDoc.setTextColor(100, 116, 139);
                pdfDoc.text(state.currentOrganization?.address ? (typeof state.currentOrganization.address === 'string' ? state.currentOrganization.address : formatAddress(state.currentOrganization.address)) : '', 40, 74);
                pdfDoc.text(`Phone: ${state.currentOrganization?.phone || '2103184197'}`, 40, 87);

                pdfDoc.setFont('Helvetica', 'bold');
                pdfDoc.setFontSize(20);
                pdfDoc.setTextColor(30, 41, 59);
                pdfDoc.text('WORK ORDER', pageWidth - 40, 48, { align: 'right' });

                pdfDoc.setFontSize(10);
                pdfDoc.text(`Work Order #: ${woNum}`, pageWidth - 40, 64, { align: 'right' });
                pdfDoc.setFont('Helvetica', 'normal');
                pdfDoc.setFontSize(9);
                pdfDoc.setTextColor(100, 116, 139);
                pdfDoc.text(`Issue Date: ${issueDate || new Date().toLocaleDateString()}`, pageWidth - 40, 77, { align: 'right' });
                pdfDoc.text(`Schedule Date: ${schedDateDisplay}`, pageWidth - 40, 90, { align: 'right' });

                pdfDoc.setLineWidth(1.5);
                pdfDoc.setDrawColor(15, 23, 42);
                pdfDoc.line(40, 102, pageWidth - 40, 102);

                // Service Location & Subcontractor Cards
                pdfDoc.setLineWidth(0.75);
                pdfDoc.setDrawColor(203, 213, 225);
                pdfDoc.roundedRect(40, 115, 258, 85, 6, 6);
                pdfDoc.setFont('Helvetica', 'bold');
                pdfDoc.setFontSize(9.5);
                pdfDoc.setTextColor(2, 132, 199);
                pdfDoc.text('SERVICE LOCATION', 52, 132);
                pdfDoc.setLineWidth(0.5);
                pdfDoc.setDrawColor(226, 232, 240);
                pdfDoc.line(52, 138, 286, 138);

                pdfDoc.setFont('Helvetica', 'bold');
                pdfDoc.setFontSize(11);
                pdfDoc.setTextColor(15, 23, 42);
                pdfDoc.text(siteLocationName || 'Service Location', 52, 154);
                pdfDoc.setFont('Helvetica', 'normal');
                pdfDoc.setFontSize(9.5);
                pdfDoc.setTextColor(51, 65, 85);
                pdfDoc.text(pdfDoc.splitTextToSize(siteAddressStr || '', 234), 52, 169);

                pdfDoc.setLineWidth(0.75);
                pdfDoc.setDrawColor(203, 213, 225);
                pdfDoc.roundedRect(314, 115, 258, 85, 6, 6);
                pdfDoc.setFont('Helvetica', 'bold');
                pdfDoc.setFontSize(9.5);
                pdfDoc.setTextColor(2, 132, 199);
                pdfDoc.text('TECHNICIAN / CONTRACTOR', 326, 132);
                pdfDoc.setLineWidth(0.5);
                pdfDoc.setDrawColor(226, 232, 240);
                pdfDoc.line(326, 138, 560, 138);

                pdfDoc.setFont('Helvetica', 'bold');
                pdfDoc.setFontSize(11);
                pdfDoc.setTextColor(15, 23, 42);
                pdfDoc.text(sendToName, 326, 154);
                pdfDoc.setFont('Helvetica', 'normal');
                pdfDoc.setFontSize(9.5);
                pdfDoc.setTextColor(51, 65, 85);
                pdfDoc.text(`Phone: ${sendToPhone}`, 326, 169);
                pdfDoc.text(`Email: ${sendToEmail}`, 326, 183);

                // NTE & IVR Box
                pdfDoc.setLineWidth(1);
                pdfDoc.setDrawColor(239, 68, 68);
                pdfDoc.setFillColor(254, 242, 242);
                pdfDoc.roundedRect(40, 215, 220, 95, 6, 6, 'FD');

                pdfDoc.setFont('Helvetica', 'bold');
                pdfDoc.setFontSize(9);
                pdfDoc.setTextColor(153, 27, 27);
                pdfDoc.text('NOT-TO-EXCEED (N.T.E.) AMOUNT', 150, 233, { align: 'center' });
                pdfDoc.setFontSize(26);
                pdfDoc.setTextColor(185, 28, 28);
                pdfDoc.text(`$${Number(nte).toFixed(2)}`, 150, 267, { align: 'center' });

                pdfDoc.setLineWidth(0.75);
                pdfDoc.setDrawColor(203, 213, 225);
                pdfDoc.setFillColor(250, 250, 250);
                pdfDoc.roundedRect(274, 215, 298, 95, 6, 6, 'FD');

                pdfDoc.setFont('Helvetica', 'bold');
                pdfDoc.setFontSize(9.5);
                pdfDoc.setTextColor(51, 65, 85);
                pdfDoc.text('IVR CHECK-IN INSTRUCTIONS', 286, 232);
                pdfDoc.setFontSize(8.5);
                pdfDoc.setTextColor(217, 119, 6);
                pdfDoc.text('MANDATORY CALL-IN REQUIRED UPON ARRIVAL & DEPARTURE', 286, 246);
                pdfDoc.setFont('Helvetica', 'normal');
                pdfDoc.setFontSize(8.5);
                pdfDoc.setTextColor(51, 65, 85);
                pdfDoc.text(`1. Call System: ${ivrNumber || '(704) 823-6108'}`, 286, 260);
                pdfDoc.text(`2. Security PIN / Job #: ${ivrPin || workOrderNumber}`, 286, 273);
                pdfDoc.text(pdfDoc.splitTextToSize('3. Actions: Follow voice prompts to log on-site presence. Labor hours must align with call logs.', 276), 286, 286);

                // Dynamic Scope & Special Instructions Layout
                let currentY = 325;
                const scopeLines = pdfDoc.splitTextToSize(reportedIssue || 'Diagnostic & Repair Work Order', 508);
                const scopeBoxHeight = Math.max(70, scopeLines.length * 12 + 35);

                pdfDoc.setLineWidth(0.75);
                pdfDoc.setDrawColor('#cbd5e1');
                pdfDoc.setFillColor('#f8fafc');
                pdfDoc.roundedRect(40, currentY, 532, scopeBoxHeight, 6, 6, 'FD');

                pdfDoc.setFont('Helvetica', 'bold');
                pdfDoc.setFontSize(9.5);
                pdfDoc.setTextColor('#0284c7');
                pdfDoc.text('REPORTED ISSUE / WORK SCOPE', 52, currentY + 16);

                pdfDoc.setLineWidth(0.5);
                pdfDoc.setDrawColor('#e2e8f0');
                pdfDoc.line(52, currentY + 22, 560, currentY + 22);

                pdfDoc.setFont('Helvetica', 'normal');
                pdfDoc.setFontSize(8.5);
                pdfDoc.setTextColor('#334155');
                pdfDoc.text(scopeLines, 52, currentY + 36);

                currentY += scopeBoxHeight + 14;

                const specialText = specialInstructions || 'Please complete work on the first trip if possible. Contact the AM prior to leaving site.';
                const specialLines = pdfDoc.splitTextToSize(specialText, 508);
                const specialBoxHeight = Math.max(55, specialLines.length * 12 + 35);

                if (currentY + specialBoxHeight > 700) {
                    pdfDoc.addPage();
                    currentY = 40;
                }

                pdfDoc.setLineWidth(0.75);
                pdfDoc.setDrawColor('#fde68a');
                pdfDoc.setFillColor('#fffbeb');
                pdfDoc.roundedRect(40, currentY, 532, specialBoxHeight, 6, 6, 'FD');

                pdfDoc.setFont('Helvetica', 'bold');
                pdfDoc.setFontSize(9.5);
                pdfDoc.setTextColor('#92400e');
                pdfDoc.text('SPECIAL INSTRUCTIONS', 52, currentY + 16);

                pdfDoc.setLineWidth(0.5);
                pdfDoc.setDrawColor('#fef3c7');
                pdfDoc.line(52, currentY + 22, 560, currentY + 22);

                pdfDoc.setFont('Helvetica', 'normal');
                pdfDoc.setFontSize(8.5);
                pdfDoc.setTextColor('#78350f');
                pdfDoc.text(specialLines, 52, currentY + 36);

                pdfDoc.setFontSize(9);
                pdfDoc.setTextColor(148, 163, 184);
                pdfDoc.text(`Page 1 of 3 - Subcontractor Work Order • ${orgNameDisplay}`, pageWidth / 2, 750, { align: 'center' });

                // PAGE 2: VISIT INSTRUCTIONS & SIGN-OFF
                pdfDoc.addPage();
                pdfDoc.setFont('Helvetica', 'bold');
                pdfDoc.setFontSize(18);
                pdfDoc.setTextColor(2, 132, 199);
                pdfDoc.text(orgNameDisplay, 40, 50);
                pdfDoc.setFontSize(10);
                pdfDoc.setTextColor(100, 116, 139);
                pdfDoc.text('Work Order Compliance & Sign-Off Requirements', 40, 66);
                pdfDoc.setFontSize(11);
                pdfDoc.setTextColor(15, 23, 42);
                pdfDoc.text(`Work Order #: ${woNum}`, pageWidth - 40, 50, { align: 'right' });
                pdfDoc.line(40, 78, pageWidth - 40, 78);

                pdfDoc.rect(40, 90, 532, 280);
                pdfDoc.setFont('Helvetica', 'bold');
                pdfDoc.setFontSize(11);
                pdfDoc.setTextColor(2, 132, 199);
                pdfDoc.text('MANDATORY VISIT INSTRUCTIONS', 50, 110);
                pdfDoc.setFont('Helvetica', 'normal');
                pdfDoc.setFontSize(9.5);
                pdfDoc.setTextColor(51, 65, 85);
                let y2 = 132;
                visitInstructions.forEach((inst: string, i: number) => {
                    pdfDoc.text(`${i + 1}. ${inst}`, 55, y2);
                    y2 += 26;
                });

                pdfDoc.setFillColor(250, 250, 250);
                pdfDoc.rect(40, 390, 532, 220, 'FD');
                pdfDoc.setFont('Helvetica', 'bold');
                pdfDoc.setFontSize(12);
                pdfDoc.setTextColor(15, 23, 42);
                pdfDoc.text('LOCATION MANAGER SIGN-OFF', pageWidth / 2, 415, { align: 'center' });
                pdfDoc.setFont('Helvetica', 'normal');
                pdfDoc.setFontSize(9);
                pdfDoc.setTextColor(100, 116, 139);
                pdfDoc.text('Technician must obtain signature, printed name, and store/site stamp upon completion of work.', pageWidth / 2, 430, { align: 'center' });

                pdfDoc.setFont('Helvetica', 'bold');
                pdfDoc.setFontSize(9);
                pdfDoc.text('DATE OF SERVICE', 60, 460);
                pdfDoc.line(60, 485, 220, 485);
                pdfDoc.text('MANAGER NAME (PRINTED)', 250, 460);
                pdfDoc.line(250, 485, 540, 485);
                pdfDoc.text('MANAGER SIGNATURE', 60, 525);
                pdfDoc.line(60, 560, 340, 560);
                pdfDoc.rect(370, 510, 170, 80);
                pdfDoc.setFontSize(10);
                pdfDoc.setTextColor(148, 163, 184);
                pdfDoc.text('STORE STAMP HERE', 455, 555, { align: 'center' });
                pdfDoc.text(`Page 2 of 3 - Visit & Sign-off • ${orgNameDisplay}`, pageWidth / 2, 750, { align: 'center' });

                // PAGE 3: TERMS & CONDITIONS
                pdfDoc.addPage();
                pdfDoc.setFont('Helvetica', 'bold');
                pdfDoc.setFontSize(18);
                pdfDoc.setTextColor(2, 132, 199);
                pdfDoc.text(orgNameDisplay, 40, 50);
                pdfDoc.setFontSize(10);
                pdfDoc.setTextColor(100, 116, 139);
                pdfDoc.text('Work Order Legal & Payment Terms', 40, 66);
                pdfDoc.setFontSize(11);
                pdfDoc.setTextColor(15, 23, 42);
                pdfDoc.text(`Work Order #: ${woNum}`, pageWidth - 40, 50, { align: 'right' });
                pdfDoc.line(40, 78, pageWidth - 40, 78);

                pdfDoc.rect(40, 90, 532, 620);
                pdfDoc.setFont('Helvetica', 'bold');
                pdfDoc.setFontSize(11);
                pdfDoc.setTextColor(15, 23, 42);
                pdfDoc.text('WORK ORDER TERMS & CONDITIONS', 50, 110);
                pdfDoc.setFont('Helvetica', 'normal');
                pdfDoc.setFontSize(9);
                pdfDoc.setTextColor(71, 85, 105);
                let y3 = 135;
                terms.forEach((term: string, idx: number) => {
                    const lines = pdfDoc.splitTextToSize(`${idx + 1}. ${term}`, 500);
                    pdfDoc.text(lines, 55, y3);
                    y3 += (lines.length * 14) + 10;
                });

                pdfDoc.setFontSize(9);
                pdfDoc.setTextColor(148, 163, 184);
                pdfDoc.text(`Page 3 of 3 - Terms & Conditions • ${orgNameDisplay}`, pageWidth / 2, 750, { align: 'center' });

                pdfDataUri = pdfDoc.output('datauristring');
            } catch (pdfErr) {
                console.error("Failed to generate PDF attachment:", pdfErr);
            }

            let pdfDownloadUrl = '';
            if (pdfDataUri) {
                try {
                    const cleanWo = woNum.replace(/[^a-zA-Z0-9]/g, '');
                    const storagePath = `organizations/${orgId}/pdf_attachments/${Date.now()}_WorkOrder_${cleanWo}.pdf`;
                    pdfDownloadUrl = await uploadFileToStorage(storagePath, pdfDataUri);
                } catch (storageErr) {
                    console.warn("Could not upload work order PDF to storage, falling back to data URI:", storageErr);
                }
            }

            const replyToEmail = vendorInvoicesEmail?.trim() || contactEmail?.trim() || state.currentOrganization?.email || 'operations@tekairinc.com';

            const selectedExternalAttachments = (jobFiles || [])
                .filter((f: any) => f.includeInSubcontractorEmail && (f.fileUrl || f.url))
                .map((f: any) => ({
                    filename: f.fileName || f.label || 'Attachment.pdf',
                    path: f.fileUrl || f.url
                }));

            const outgoingAttachmentsList = [
                ...(pdfDownloadUrl || pdfDataUri ? [{
                    filename: `TekTrakker_WorkOrder_${woNum.replace('#', '')}.pdf`,
                    path: pdfDownloadUrl || pdfDataUri
                }] : []),
                ...selectedExternalAttachments
            ];

            const fromHeader = `"${orgNameDisplay}" <platform@tektrakker.com>`;
            await db.collection('mail').add(cleanUndefinedFields({
                to: [sendToEmail.trim()],
                from: fromHeader,
                replyTo: replyToEmail,
                organizationId: orgId,
                message: {
                    from: fromHeader,
                    replyTo: replyToEmail,
                    subject: sendSubject || `Subcontractor Work Order #${woNum} - ${orgNameDisplay}`,
                    html: emailHtml,
                    ...(outgoingAttachmentsList.length > 0 ? {
                        attachments: outgoingAttachmentsList
                    } : {})
                },
                createdAt: new Date().toISOString()
            }));

            // Update sentAt on Job document
            await db.collection('jobs').doc(job.id).update(cleanUndefinedFields({
                subcontractorEmail: sendToEmail.trim(),
                subcontractorPhone: sendToPhone.trim(),
                subcontractorName: sendToName.trim(),
                'subcontractorWorkOrder.sentAt': new Date().toISOString(),
                'subcontractorWorkOrder.contactEmail': sendToEmail.trim(),
                'subcontractorWorkOrder.contactPhone': sendToPhone.trim()
            }));

            showToast.success(`Work Order emailed to ${sendToEmail.trim()}!`);
            setShowSendModal(false);
            onClose();
        } catch (err: any) {
            console.error("Error sending email:", err);
            showToast.error("Failed to send email: " + err.message);
        } finally {
            setIsSendingEmail(false);
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
            dispatch({ type: 'UPDATE_JOB', payload: updatedJob });

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
                    await db.collection('mail').add(cleanUndefinedFields({
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
            dispatch({ type: 'UPDATE_JOB', payload: updatedJob });

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
                    await db.collection('mail').add(cleanUndefinedFields({
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
                            ${org.logoUrl ? `<img src="${org.logoUrl}" style="max-height: 75px; max-width: 250px; object-fit: contain; margin-bottom: 8px; display: block;" alt="${org.name}" />` : `<h1 style="margin: 0; font-size: 28px; font-weight: 900; color: #0284c7; letter-spacing: -0.5px;">${org.name}</h1>`}
                            <p style="margin: 3px 0 0 0; font-size: 11px; color: #666;">${typeof org.address === 'string' ? org.address : formatAddress(org.address)}</p>
                            <p style="margin: 2px 0 0 0; font-size: 11px; color: #444;">Phone: <strong>${org.phone}</strong></p>
                        </div>
                        <div style="text-align: right;">
                            <h2 style="margin: 0; font-size: 22px; font-weight: 800; color: #1e293b; text-transform: uppercase;">WORK ORDER</h2>
                            <p style="margin: 5px 0 0 0; font-size: 12px; font-weight: bold;">Work Order #: ${job.jobNumber || job.poNumber || job.id.slice(-6).toUpperCase()}</p>
                            <p style="margin: 2px 0 0 0; font-size: 11px; color: #555;">Issue Date: ${issueDate || new Date().toLocaleDateString()}</p>
                            <p style="margin: 2px 0 0 0; font-size: 11px; color: #555;">Schedule Date: ${scheduleDate || new Date(job.appointmentTime).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</p>
                        </div>
                    </div>

                    <div style="display: flex; gap: 20px; margin-bottom: 25px;">
                        <div style="flex: 1; border: 1px solid #ddd; padding: 12px; border-radius: 8px;">
                            <h3 style="margin: 0 0 8px 0; font-size: 12px; text-transform: uppercase; color: #0284c7; font-weight: bold; border-bottom: 1px solid #eee; padding-bottom: 4px;">Service Location</h3>
                            <p style="margin: 0; font-size: 13px; font-weight: bold;">${siteLocationName}</p>
                            <p style="margin: 4px 0 0 0; font-size: 12px; color: #444; white-space: pre-line;">${siteAddressStr}</p>
                            <p style="margin: 4px 0 0 0; font-size: 12px; color: #111;">Phone: <strong>${sitePhone}</strong></p>
                        </div>
                        <div style="flex: 1; border: 1px solid #ddd; padding: 12px; border-radius: 8px;">
                            <h3 style="margin: 0 0 8px 0; font-size: 12px; text-transform: uppercase; color: #0284c7; font-weight: bold; border-bottom: 1px solid #eee; padding-bottom: 4px;">Technician / Contractor</h3>
                            <p style="margin: 0; font-size: 13px; font-weight: bold;">${subName}</p>
                            <p style="margin: 4px 0 0 0; font-size: 12px; color: #444;">Phone: <strong>${subPhone}</strong></p>
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
                            <h3 style="margin: 0 0 6px 0; font-size: 12px; text-transform: uppercase; color: #334155; font-weight: bold; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px;">IVR Check-In / Check-Out Instructions</h3>
                            <p style="margin: 3px 0; font-size: 11px; color: #1e293b;">Check In / Check Out Phone: <strong>${ivrNumber || '516-500-7776'}</strong></p>
                            <p style="margin: 3px 0; font-size: 11px; color: #1e293b;">PIN #: <strong>${ivrPin || '823372'}</strong></p>
                            ${trackingNumber ? `<p style="margin: 3px 0; font-size: 11px; color: #1e293b;">Tracking #: <strong>${trackingNumber}</strong></p>` : ''}
                            <ol style="margin: 6px 0 0 0; padding-left: 18px; font-size: 11px; color: #475569; line-height: 1.5;">
                                <li>Call number located above</li>
                                <li>Enter Pin number located above</li>
                                ${trackingNumber ? `<li>Enter Tracking number: <strong>${trackingNumber}</strong></li>` : ''}
                                <li>Repeat the steps above to clock out and follow the prompts to confirm the status of repairs.</li>
                            </ol>
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
                <div className="p-4 sm:p-6 border-b border-slate-100 dark:border-slate-850 flex justify-between items-center bg-slate-50 dark:bg-slate-900/40 gap-3">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="w-10 h-10 rounded-2xl bg-teal-100 dark:bg-teal-950/40 flex items-center justify-center text-teal-600 dark:text-teal-400 shrink-0">
                            <FileText size={20}/>
                        </div>
                        <div className="min-w-0 flex-1">
                            <h2 className="text-base sm:text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight truncate">
                                {isSubcontractor ? 'Work Order & Requirements' : 'Subcontractor Work Order Composer'}
                            </h2>
                            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider truncate">Job #{job.poNumber || job.id.slice(-6).toUpperCase()}</p>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-2 shrink-0">
                        {/* Tab toggle for smaller screens */}
                        {!isSubcontractor && (
                            <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl lg:hidden shrink-0">
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

                        <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition cursor-pointer shrink-0" aria-label="Close" title="Close">
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
                                        <option value="generic_subcontractor">🛠️ Generic Subcontractor (Manual Entry)</option>
                                        
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

                                    {/* Manual Entry Inputs for Generic Subcontractor */}
                                    {(subcontractorId === 'generic_subcontractor' || subcontractorId === 'generic' || (!subcontractorUsers.some(u => u.id === subcontractorId) && !subcontractorPartners.some(p => p.id === subcontractorId))) && (
                                        <div className="mt-3 p-3.5 bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-2xl space-y-3">
                                            <h5 className="text-[10px] font-black uppercase text-blue-700 dark:text-blue-300 tracking-wider">
                                                🛠️ Manual Subcontractor Details
                                            </h5>
                                            <div>
                                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Subcontractor / Company Name</label>
                                                <Input
                                                    type="text"
                                                    placeholder="e.g. AdvantiAir, Apex Electric, John Doe"
                                                    value={customSubName}
                                                    onChange={(e) => setCustomSubName(e.target.value)}
                                                    className="w-full text-xs"
                                                />
                                            </div>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                <div>
                                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Phone Number</label>
                                                    <Input
                                                        type="text"
                                                        placeholder="e.g. (210) 318-4197"
                                                        value={customSubPhone}
                                                        onChange={(e) => setCustomSubPhone(e.target.value)}
                                                        className="w-full text-xs"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Email Address</label>
                                                    <Input
                                                        type="email"
                                                        placeholder="e.g. tech@subcontractor.com"
                                                        value={customSubEmail}
                                                        onChange={(e) => setCustomSubEmail(e.target.value)}
                                                        className="w-full text-xs"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    )}

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

                                        const compSettings = state.currentOrganization?.subcontractorComplianceSettings;
                                        const isBypassed = compSettings?.enforceComplianceBeforeAssignment === false 
                                            || compSettings?.allowTemporaryComplianceBypass === true 
                                            || (subPartner as any)?.temporaryComplianceBypass === true 
                                            || (subUser as any)?.temporaryComplianceBypass === true;

                                        if (comp.isCompliant) {
                                            return (
                                                <div className="mt-2 p-2 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl text-[11px] font-extrabold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                                                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                                                    Compliance Verified ({comp.fulfilledCount}/{comp.totalRequiredCount} Docs)
                                                </div>
                                            );
                                        }

                                        if (isBypassed) {
                                            return (
                                                <div className="mt-2 p-2 bg-amber-500/10 border border-amber-300 dark:border-amber-800 rounded-xl text-[11px] font-extrabold text-amber-900 dark:text-amber-200 flex items-center justify-between gap-1.5">
                                                    <span className="flex items-center gap-1.5">
                                                        <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                                                        ⚡ Emergency Compliance Lock Bypassed
                                                    </span>
                                                    <span className="text-[9px] bg-amber-500 text-white px-1.5 py-0.5 rounded font-black uppercase">Paperwork Pending</span>
                                                </div>
                                            );
                                        }

                                        return (
                                            <div className="mt-2 p-2.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl text-[11px] text-amber-900 dark:text-amber-200 space-y-1.5">
                                                <div className="flex items-center justify-between gap-2 font-extrabold text-amber-800 dark:text-amber-300">
                                                    <span className="flex items-center gap-1.5">
                                                        <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                                                        Missing Required Compliance Docs
                                                    </span>
                                                    {subPartner && (
                                                        <button
                                                            type="button"
                                                            onClick={async () => {
                                                                try {
                                                                    await db.collection('subcontractors').doc(subPartner.id).update({
                                                                        temporaryComplianceBypass: true,
                                                                        complianceBypassReason: 'Emergency work order issued - paperwork pending'
                                                                    });
                                                                    showToast.success("Emergency compliance lock bypassed!");
                                                                } catch (err: any) {
                                                                    console.error(err);
                                                                }
                                                            }}
                                                            className="px-2 py-0.5 bg-amber-600 hover:bg-amber-500 text-white font-extrabold text-[9px] rounded shadow-sm transition shrink-0"
                                                        >
                                                            ⚡ Bypass Lock
                                                        </button>
                                                    )}
                                                </div>
                                                <p className="text-[10px] opacity-90 leading-tight">
                                                    Missing: <strong>{comp.missingDocLabels.join(', ')}</strong>
                                                </p>
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
                            <h4 className="font-bold text-xs uppercase text-slate-400 tracking-wider">🏢 Dispatch Contact & Invoicing Info</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Input label="Dispatch Contact Name" value={contactName} onChange={(e) => setContactName(e.target.value)} />
                                <Input label="Dispatch Contact Phone" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Input label="Dispatch Operations Email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} />
                                <Input label="Vendor Invoices Email" value={vendorInvoicesEmail} onChange={(e) => setVendorInvoicesEmail(e.target.value)} placeholder="e.g. Invoices@tekairinc.com" />
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

                        {/* Subcontractor Outgoing Attachments Selector */}
                        <div className="bg-slate-50 dark:bg-slate-850/30 p-4 rounded-3xl border border-slate-200/50 dark:border-slate-800 space-y-4">
                            <div className="flex justify-between items-center flex-wrap gap-2">
                                <div>
                                    <h4 className="font-bold text-xs uppercase text-slate-400 tracking-wider">📁 Select Outgoing Attachments</h4>
                                    <p className="text-[11px] text-slate-500 dark:text-slate-400">Check `[x]` any document below to include it in the subcontractor email</p>
                                </div>
                                <label className="cursor-pointer bg-teal-600 hover:bg-teal-500 text-white px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition">
                                    <Plus size={14} />
                                    <span>{isUploadingFile ? 'Uploading...' : '+ Upload New Document'}</span>
                                    <input type="file" multiple accept=".pdf,.doc,.docx,.png,.jpg,.jpeg" onChange={handleFileUpload} className="hidden" disabled={isUploadingFile} />
                                </label>
                            </div>

                            {jobFiles.length === 0 ? (
                                <div className="text-center py-4 text-xs text-slate-400 border border-dashed border-slate-300 dark:border-slate-800 rounded-2xl">
                                    No documents found for this job. Click <strong>+ Upload New Document</strong> to add safety rules, site maps, or specs.
                                </div>
                            ) : (
                                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                                    {jobFiles.map((f: any, idx: number) => {
                                        const cat = (f.category || '').toLowerCase();
                                        const fn = (f.fileName || f.label || '').toLowerCase();
                                        const isInternal = f.isInternal || cat.includes('customer document') || cat.includes('internal') || fn.includes('customer_workorder') || fn.includes('customer work order');

                                        return (
                                            <div key={f.id || idx} className={`flex items-center justify-between p-2.5 rounded-xl border text-xs transition-colors ${
                                                f.includeInSubcontractorEmail
                                                    ? 'bg-teal-50/70 dark:bg-teal-950/30 border-teal-300 dark:border-teal-800'
                                                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
                                            }`}>
                                                <label className="flex items-center gap-2.5 cursor-pointer flex-1 min-w-0">
                                                    <input
                                                        type="checkbox"
                                                        checked={!!f.includeInSubcontractorEmail}
                                                        onChange={(e) => {
                                                            const updated = jobFiles.map((item, i) => i === idx ? { ...item, includeInSubcontractorEmail: e.target.checked } : item);
                                                            setJobFiles(updated);
                                                        }}
                                                        className="w-4 h-4 accent-teal-600 rounded cursor-pointer shrink-0"
                                                    />
                                                    <div className="overflow-hidden min-w-0">
                                                        <span className="font-bold text-slate-800 dark:text-slate-200 truncate block">📄 {f.fileName || f.label || 'Attachment.pdf'}</span>
                                                        {isInternal ? (
                                                            <span className="inline-block text-[9px] font-black uppercase text-amber-700 bg-amber-100 dark:bg-amber-950/60 px-1.5 py-0.5 rounded mt-0.5">
                                                                🔒 Customer Internal Document
                                                            </span>
                                                        ) : (
                                                            <span className="inline-block text-[9px] font-bold uppercase text-slate-500">
                                                                {f.category || 'Site Attachment'}
                                                            </span>
                                                        )}
                                                    </div>
                                                </label>
                                                <a href={f.fileUrl || f.url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-teal-600 dark:text-teal-400 font-bold hover:underline shrink-0 ml-2">
                                                    Preview File
                                                </a>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
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
                                                    <img src={previewOrg.logoUrl} className="h-20 max-w-[260px] object-contain mb-2" alt="Logo"/>
                                                ) : (
                                                    <h1 className="text-2xl font-black text-teal-600 tracking-tight">{previewOrg.name}</h1>
                                                )}
                                                <p className="text-[10px] text-slate-500 mt-1">{typeof previewOrg.address === 'string' ? previewOrg.address : formatAddress(previewOrg.address)}</p>
                                                <p className="text-[10px] text-slate-700">Phone: <strong>{previewOrg.phone}</strong></p>
                                            </div>
                                            <div className="text-right">
                                                <h2 className="text-xl font-extrabold text-slate-800 tracking-widest uppercase">WORK ORDER</h2>
                                                <p className="text-xs font-bold text-slate-800 mt-1">Work Order #: {job.jobNumber || job.poNumber || job.id.slice(-6).toUpperCase()}</p>
                                                <p className="text-[10px] text-slate-500 mt-0.5">Issue Date: {issueDate || new Date().toLocaleDateString()}</p>
                                                <p className="text-[10px] text-slate-500">Schedule Date: {scheduleDate || new Date(job.appointmentTime).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</p>
                                            </div>
                                        </div>

                                        {/* Assignment Side-by-side */}
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="border border-slate-200 rounded-xl p-3.5 bg-slate-50/50">
                                                <h3 className="text-[10px] font-bold text-teal-600 uppercase tracking-widest border-b border-slate-100 pb-1 mb-2">Service Location</h3>
                                                <p className="text-xs font-bold text-slate-900">{siteLocationName}</p>
                                                <p className="text-xs text-slate-600 mt-1 whitespace-pre-line leading-relaxed">{siteAddressStr}</p>
                                                <p className="text-xs text-slate-900 mt-1">Phone: <strong>{sitePhone}</strong></p>
                                            </div>
                                            <div className="border border-slate-200 rounded-xl p-3.5 bg-slate-50/50">
                                                <h3 className="text-[10px] font-bold text-teal-600 uppercase tracking-widest border-b border-slate-100 pb-1 mb-2">Technician / Contractor</h3>
                                                <p className="text-xs font-bold text-slate-900">{subName}</p>
                                                <div className="mt-1.5 space-y-0.5 text-xs text-slate-600">
                                                    <p>Phone: <strong>{subPhone}</strong></p>
                                                    <p>Email: {subEmail}</p>
                                                </div>
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
                                                    <h3 className="text-[10px] font-bold text-slate-700 uppercase tracking-widest border-b border-slate-100 pb-1 mb-2">IVR Check-In / Check-Out Instructions</h3>
                                                    <div className="text-xs text-slate-800 space-y-1 mb-2">
                                                        <p>Check In / Check Out Phone: <strong>{ivrNumber || '516-500-7776'}</strong></p>
                                                        <p>PIN #: <strong>{ivrPin || '823372'}</strong></p>
                                                        {trackingNumber && <p>Tracking #: <strong>{trackingNumber}</strong></p>}
                                                    </div>
                                                    <ol className="text-xs text-slate-600 space-y-1 list-decimal pl-4 leading-relaxed">
                                                        <li>Call number located above</li>
                                                        <li>Enter Pin number located above</li>
                                                        {trackingNumber && <li>Enter Tracking number: <strong>{trackingNumber}</strong></li>}
                                                        <li>Repeat the steps above to clock out and follow the prompts to confirm the status of repairs.</li>
                                                    </ol>
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
                <div className="p-4 sm:p-6 border-t border-slate-100 dark:border-slate-850 flex flex-wrap justify-between items-center bg-slate-50 dark:bg-slate-900/40 gap-3 shrink-0">
                    <div className="flex items-center gap-2">
                        <Button 
                            variant="secondary"
                            onClick={handlePrint}
                            className="h-10 sm:h-11 px-4 sm:px-5 w-auto flex items-center gap-2 text-xs sm:text-sm font-bold cursor-pointer"
                        >
                            <Printer size={16}/> <span>Print PDF</span>
                        </Button>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
                        <Button 
                            variant="secondary"
                            onClick={onClose}
                            className="h-10 sm:h-11 px-4 sm:px-5 text-xs sm:text-sm font-bold cursor-pointer"
                        >
                            {isSubcontractor ? 'Close' : 'Cancel'}
                        </Button>
                        {!isSubcontractor && (
                            <>
                                <Button 
                                    variant="secondary"
                                    onClick={handleSaveAndOpenEmailModal}
                                    disabled={isSaving}
                                    className="h-10 sm:h-11 px-4 sm:px-5 w-auto flex items-center gap-2 bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 text-xs sm:text-sm font-bold cursor-pointer"
                                >
                                    <Mail size={16}/> <span>Save & Email</span>
                                </Button>
                                <Button 
                                    onClick={() => handleSave(true)}
                                    disabled={isSaving}
                                    className="h-10 sm:h-11 px-5 sm:px-6 w-auto flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white text-xs sm:text-sm font-bold cursor-pointer"
                                >
                                    <CheckCircle size={16}/> <span>{isSaving ? 'Saving...' : 'Save & Close'}</span>
                                </Button>
                            </>
                        )}
                    </div>
                </div>

            </div>

            {/* Send Subcontractor Work Order Email Review Modal Overlay */}
            {showSendModal && (
                <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-fade-in overflow-y-auto">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl max-w-3xl w-full border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh]">
                        {/* Header */}
                        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-gradient-to-r from-sky-900 via-indigo-900 to-slate-900 text-white shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-2xl bg-sky-500/20 border border-sky-400/30 flex items-center justify-center text-sky-300">
                                    <Mail className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="font-extrabold text-lg tracking-tight text-white">Review & Send Subcontractor Work Order</h3>
                                    <p className="text-xs text-sky-200/80">Verify recipient details and preview email content before sending</p>
                                </div>
                            </div>
                            <button 
                                onClick={() => setShowSendModal(false)}
                                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="p-6 overflow-y-auto space-y-5 flex-1 text-slate-800 dark:text-slate-200">
                            {/* Recipient Card */}
                            <div className="bg-slate-50 dark:bg-slate-850/50 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-4">
                                <h4 className="font-bold text-xs uppercase tracking-wider text-sky-600 dark:text-sky-400 flex items-center gap-2">
                                    <span>👤 Recipient Contact Details</span>
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <Input 
                                        label="Recipient Email Address" 
                                        type="email"
                                        value={sendToEmail}
                                        onChange={(e) => setSendToEmail(e.target.value)}
                                        placeholder="e.g. contractor@domain.com"
                                    />
                                    <Input 
                                        label="Subcontractor / Tech Name" 
                                        value={sendToName}
                                        onChange={(e) => setSendToName(e.target.value)}
                                        placeholder="Subcontractor Name"
                                    />
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <Input 
                                        label="Phone Number" 
                                        value={sendToPhone}
                                        onChange={(e) => setSendToPhone(e.target.value)}
                                        placeholder="Phone Number"
                                    />
                                    <Input 
                                        label="Email Subject Line" 
                                        value={sendSubject}
                                        onChange={(e) => setSendSubject(e.target.value)}
                                        placeholder="Subject Line"
                                    />
                                </div>
                            </div>

                            {/* Email Live Preview */}
                            <div className="space-y-2">
                                <div className="flex justify-between items-center">
                                    <h4 className="font-bold text-xs uppercase tracking-wider text-slate-500">Live Email Message Preview</h4>
                                    <span className="text-[10px] text-slate-400">Includes interactive form link & org contact details</span>
                                </div>
                                <div className="border border-slate-200 dark:border-slate-700 rounded-2xl p-4 bg-white text-slate-900 overflow-y-auto max-h-[300px] text-xs shadow-inner">
                                    <div className="border-b border-sky-600 pb-3 mb-3">
                                        <h2 className="text-lg font-bold text-sky-600 margin-0">{state.currentOrganization?.name || 'TekAir Inc.'}</h2>
                                        <p className="text-[10px] text-slate-500">Official Subcontractor Work Order</p>
                                    </div>
                                    
                                    <h3 className="text-sm font-bold text-slate-800 mb-1">
                                        Work Order #{workOrderNumber || job.poNumber || job.id.slice(-6).toUpperCase()}
                                    </h3>
                                    <p className="text-[11px] text-slate-500 mb-3">Scheduled: <strong>{scheduleDate || 'TBD'}</strong></p>

                                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 mb-3">
                                        <p className="font-bold text-sky-700 uppercase text-[10px] tracking-wider">Service Location</p>
                                        <p className="font-bold text-slate-800 text-xs">{siteLocationName || 'Service Site'}</p>
                                        <p className="text-slate-600 text-[11px]">{siteAddressStr || ''}</p>
                                    </div>

                                    <div className="bg-red-50 p-3 rounded-xl border border-red-200 text-center mb-3">
                                        <p className="font-bold text-red-800 uppercase text-[10px] tracking-wider">Not-To-Exceed (N.T.E.) Amount</p>
                                        <p className="text-2xl font-black text-red-600 margin-0">${Number(nte).toFixed(2)}</p>
                                    </div>

                                    {(ivrNumber || ivrPin) && (
                                        <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-200 mb-3">
                                            <p className="font-bold text-emerald-800 uppercase text-[10px] tracking-wider">IVR Check-In / Check-Out</p>
                                            <p className="text-emerald-700 font-bold text-[11px]">IVR Phone: {ivrNumber} | PIN #: {ivrPin} {trackingNumber ? `| Tracking #: ${trackingNumber}` : ''}</p>
                                        </div>
                                    )}

                                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 mb-3">
                                        <p className="font-bold text-slate-700 uppercase text-[10px] tracking-wider">Work Scope / Reported Issue</p>
                                        <p className="text-slate-700 whitespace-pre-line text-[11px]">{reportedIssue || 'None specified'}</p>
                                    </div>

                                    {specialInstructions && (
                                        <div className="bg-amber-50 p-3 rounded-xl border border-amber-200 mb-3">
                                            <p className="font-bold text-amber-800 uppercase text-[10px] tracking-wider">Special Instructions</p>
                                            <p className="text-amber-900 whitespace-pre-line text-[11px]">{specialInstructions}</p>
                                        </div>
                                    )}

                                    <div className="text-center my-4 p-3 bg-sky-50 rounded-xl border border-sky-200">
                                        <span className="inline-block bg-sky-600 text-white font-bold px-4 py-2 rounded-lg text-xs">
                                            🔗 Open Interactive Work Order Form
                                        </span>
                                        <p className="text-[10px] text-slate-500 mt-1">No login required — accessible on mobile or desktop</p>
                                    </div>

                                    <div className="border-t border-slate-200 pt-2 text-center text-[10px] text-slate-400">
                                        <p>Work Order Contact: {contactName} | {contactPhone} | {contactEmail}</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-900/60 shrink-0">
                            <Button 
                                variant="secondary"
                                onClick={() => setShowSendModal(false)}
                                className="h-11 px-5"
                            >
                                Cancel
                            </Button>
                            <Button 
                                onClick={handleConfirmSendEmail}
                                disabled={isSendingEmail || !sendToEmail.trim()}
                                className="h-11 px-6 bg-indigo-600 hover:bg-indigo-700 text-white font-bold flex items-center gap-2"
                            >
                                <Mail size={16} /> {isSendingEmail ? 'Sending Email...' : '🚀 Send Work Order Email'}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SubcontractorWorkOrderModal;
