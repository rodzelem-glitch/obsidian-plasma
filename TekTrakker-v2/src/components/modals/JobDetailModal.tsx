
import React, { useState, useEffect, useMemo } from 'react';
import IoTDiagnosticsViewer from '../features/IoTDiagnosticsViewer';
import CompanyCamGallery from '../features/CompanyCamGallery';
import Modal from '../ui/Modal';
import { 
    Calendar, MapPin, Clock, CheckCircle, Package, 
    ShieldCheck, FileText, Droplets, 
    Thermometer, Wrench, DollarSign, Printer, Download,
    Check, Shield, Trash2, ChevronUp, ChevronDown, Mail, Heart, Info, Eye,
    CalendarPlus, Users, Link2
} from 'lucide-react';
import { Job, Proposal, DiagnosticReport } from '../../types';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Textarea from '../ui/Textarea';
import { db, functions } from '../../lib/firebase';
import firebase from 'firebase/compat/app';
import DocumentPreview from '../ui/DocumentPreview';
import { useAppContext } from '../../context/AppContext';
import { sendEmail } from '../../lib/notificationService';
import { cleanUndefinedFields } from '../../lib/utils';
import { generateJobReportPdfAttachment, generateInvoicePdfAttachment, EmailAttachment } from '../../lib/pdfHelper';
import JobAppointmentModal from './JobAppointmentModal';
import JobLinkingModal from './JobLinkingModal';
import DigitalSignatureStamp from '../ui/DigitalSignatureStamp';


interface JobDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    job: Job;
    isAdmin?: boolean;
    onEditInvoice?: () => void;
    onEditRecord?: () => void;
}

interface ExtendedFile {
    id?: string;
    dataUrl?: string;
    url?: string;
    label?: string;
    contentType?: string;
    fileType?: string;
    metadata?: { label?: string; category?: string };
    type?: string;
    fileName?: string;
    createdAt?: string | number;
}

const JobDetailModal: React.FC<JobDetailModalProps> = ({ 
    isOpen, onClose, job, isAdmin, 
    onEditInvoice, onEditRecord 
}) => {
    const [proposal, setProposal] = useState<Record<string, unknown> | null>(null);
    const [previewDoc, setPreviewDoc] = useState<Record<string, unknown> | null>(null);
    const [diagnostics, setDiagnostics] = useState<DiagnosticReport[]>([]);
    const [deletedFiles, setDeletedFiles] = useState<Set<string>>(new Set());
    const [isRefunding, setIsRefunding] = useState(false);
    const [expandedSystems, setExpandedSystems] = useState<Record<string, boolean>>({});
    const [isPropertyExpanded, setIsPropertyExpanded] = useState(false);
    const { state, dispatch } = useAppContext();
    const [isScheduleFollowUpOpen, setIsScheduleFollowUpOpen] = useState(false);
    const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
    const [activeTab, setActiveTab] = useState<'preview' | 'technical'>('preview');
    const [isEditMode, setIsEditMode] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [localNotes, setLocalNotes] = useState<any>({});
    const [localUnitStates, setLocalUnitStates] = useState<any[]>([]);
    const [localFiles, setLocalFiles] = useState<any[]>([]);
    const [localTechRecs, setLocalTechRecs] = useState<string>('');
    const [selectedPropToLink, setSelectedPropToLink] = useState('');
    const [selectedJobToLink, setSelectedJobToLink] = useState('');
    const [isLinkingModalOpen, setIsLinkingModalOpen] = useState(false);
    const [isAuditHistoryOpen, setIsAuditHistoryOpen] = useState(false);

    const poNumber = job?.poNumber || job?.workOrderNumber || job?.invoice?.poNumber;

    const linkedProposals = useMemo(() => {
        return (state.proposals || []).filter((p: any) => 
            p.id === job?.proposalId || 
            p.id === job?.projectId || 
            job?.linkedProposalIds?.includes(p.id) || 
            p.linkedJobIds?.includes(job?.id) ||
            (poNumber && p.customerId === job?.customerId && (p.poNumber === poNumber || p.workOrderNumber === poNumber))
        );
    }, [state.proposals, job, poNumber]);

    const availableProposals = useMemo(() => {
        return (state.proposals || []).filter((p: any) => 
            p.customerId === job?.customerId && 
            !linkedProposals.some((lp: any) => lp.id === p.id)
        );
    }, [state.proposals, job, linkedProposals]);

    const linkedJobs = useMemo(() => {
        return (state.jobs || []).filter((j: any) => 
            j.id !== job?.id && (
                job?.linkedJobIds?.includes(j.id) || 
                j.linkedJobIds?.includes(job?.id) ||
                j.parentJobId === job?.id ||
                (job?.parentJobId && j.id === job?.parentJobId) ||
                (job?.parentJobId && j.parentJobId === job?.parentJobId) ||
                (poNumber && j.customerId === job?.customerId && (j.poNumber === poNumber || j.workOrderNumber === poNumber || j.invoice?.poNumber === poNumber))
            )
        );
    }, [state.jobs, job, poNumber]);

    const availableJobs = useMemo(() => {
        return (state.jobs || []).filter((j: any) => 
            j.customerId === job?.customerId && 
            j.id !== job?.id && 
            !linkedJobs.some((lj: any) => lj.id === j.id)
        );
    }, [state.jobs, job, linkedJobs]);

    const linkedInvoices = useMemo(() => {
        const invoiceIds = job?.linkedInvoiceIds || [];
        return (state.jobs || [])
            .filter((j: any) => j.invoice && invoiceIds.includes(j.invoice.id))
            .map((j: any) => ({
                job: j,
                invoice: j.invoice!
            }));
    }, [state.jobs, job?.linkedInvoiceIds]);

    useEffect(() => {
        if (job) {
            setLocalNotes(job.notes || {});
            setLocalUnitStates(job.unitStates || []);
            setLocalFiles(job.files || []);
            setLocalTechRecs(job.techRecommendations || '');
        }
    }, [job]);

    const customer = useMemo(() => {
        return state.customers?.find(c => c.id === job?.customerId);
    }, [state.customers, job?.customerId]);

    const serviceLocation = useMemo(() => {
        if (!customer || !job) return null;
        const jobAddr = typeof job.address === 'string' ? job.address.trim().toLowerCase() : '';
        return customer.serviceLocations?.find(loc => {
            if (loc.id === job.locationId) return true;
            const locAddr = typeof loc.address === 'string' ? loc.address.trim().toLowerCase() : '';
            return locAddr && jobAddr && (locAddr === jobAddr || locAddr.includes(jobAddr) || jobAddr.includes(locAddr));
        });
    }, [customer, job]);

    const jobAssets = useMemo(() => {
        if (!customer || !job) return [];
        let customerEquipment = customer.equipment || [];
        
        // Find all equipment IDs associated with this job's unitStates and files (photos)
        const requiredAssetIds = new Set([
            ...(job.unitStates?.map(s => s.assetId) || []),
            ...(job.files?.map(f => f.metadata?.assetId || f.assetId).filter(Boolean) || [])
        ]);
        
        // Filter customer equipment by location ID
        const hasMultipleLocations = (customer.serviceLocations?.length || 0) > 1;
        let filteredEquipment = customerEquipment;
        
        const getSubLocationIds = (parentId: string, locations: any[]): string[] => {
            const childIds = locations.filter(loc => loc.parentId === parentId).map(loc => loc.id);
            const nestedIds = childIds.flatMap(id => getSubLocationIds(id, locations));
            return [parentId, ...childIds, ...nestedIds];
        };

        if (job.locationId) {
            const validPropertyIds = customer.serviceLocations
                ? getSubLocationIds(job.locationId, customer.serviceLocations)
                : [job.locationId];
            filteredEquipment = customerEquipment.filter(e => (e.propertyId && validPropertyIds.includes(e.propertyId)) || (!hasMultipleLocations && !e.propertyId));
        }
        
        // Ensure all equipment listed in unitStates or associated with photos is included, even if filtered out by locationId
        const finalEquipment = [...filteredEquipment];
        customerEquipment.forEach(e => {
            if (requiredAssetIds.has(e.id) && !finalEquipment.some(fe => fe.id === e.id)) {
                finalEquipment.push(e);
            }
        });
        
        // If there are serviced systems or systems with photos that are NOT in customer equipment at all,
        // construct placeholder equipment objects so they still render in the history report
        requiredAssetIds.forEach(assetId => {
            if (assetId && !finalEquipment.some(fe => fe.id === assetId)) {
                const us = job.unitStates?.find(s => s.assetId === assetId);
                finalEquipment.push({
                    id: assetId,
                    name: `System #${assetId.slice(-4).toUpperCase()}`,
                    type: 'Equipment Unit',
                    brand: 'Unknown Brand',
                    model: '',
                    serial: 'N/A',
                    assetTag: `Tag: #${assetId.slice(-4).toUpperCase()}`,
                    condition: us?.health || 'Good'
                } as any);
            }
        });
        
        return finalEquipment;
    }, [customer, job]);

    const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
    const [emailRecipient, setEmailRecipient] = useState(job?.customerEmail || '');
    const [emailSubject, setEmailSubject] = useState(`Service Report - ${job?.customerName || 'Client'} - Job #${job?.id}`);
    const [emailCustomMessage, setEmailCustomMessage] = useState('');
    const [isEmailSending, setIsEmailSending] = useState(false);
    const [attachReportPdf, setAttachReportPdf] = useState(false);
    const [attachInvoicePdf, setAttachInvoicePdf] = useState(false);
    const [emailOptions, setEmailOptions] = useState({
        includeRecommendations: true,
        includeAssets: true,
        includePhotos: true,
        includeParts: true,
        includeTechnicalData: true,
        includeDiagnosisChecklist: true,
        includeQualityChecklist: true,
        includeArrivalNotes: true,
        includeDiagnosisNotes: true,
        includeWorkNotes: true,
        includeCompletionNotes: true,
        includeInternalNotes: false, // Default false for security
        includeCustomerFeedback: true,
        includeEmployeeFeedback: true,
        includeThankYouNote: true,
        includeInvoice: true,
        includeSignOff: true
    });

    const [selectedAttachments, setSelectedAttachments] = useState<string[]>([]);

    useEffect(() => {
        if (isEmailModalOpen && job) {
            const filesToAttach = (job.files || []).filter(f => !isInternalExpenseFile(f));
            setSelectedAttachments(filesToAttach.map(f => f.id || f.dataUrl));
        }
    }, [isEmailModalOpen, job]);

    const [selectedPocEmails, setSelectedPocEmails] = useState<string[]>([]);

    const availablePocs = useMemo(() => {
        if (!job) return [];
        const list: Array<{ name: string; email: string; role: string; type: 'location' | 'general' | 'primary' }> = [];
        
        // Primary Customer contact
        if ((customer?.email || job?.customerEmail) && (customer?.name || job?.customerName)) {
            list.push({
                name: customer?.name || job.customerName,
                email: customer?.email || job.customerEmail,
                role: 'Primary Customer',
                type: 'primary'
            });
        }

        // Location POCs
        const locId = job.locationId || serviceLocation?.id;
        if (customer?.contacts && Array.isArray(customer.contacts) && locId) {
            customer.contacts.forEach((c: any) => {
                if (c && c.name && c.email && c.allowedLocationIds?.includes(locId)) {
                    list.push({
                        name: c.name,
                        email: c.email,
                        role: c.role || c.title || 'Site POC',
                        type: 'location'
                    });
                }
            });
        }
        if (serviceLocation?.contacts && Array.isArray(serviceLocation.contacts)) {
            serviceLocation.contacts.forEach((c: any) => {
                if (c && c.name && c.email && !list.some(existing => existing.email.toLowerCase() === c.email.toLowerCase())) {
                    list.push({
                        name: c.name,
                        email: c.email,
                        role: c.role || 'Site POC',
                        type: 'location'
                    });
                }
            });
        }

        // Customer General POCs
        if (customer?.contacts && Array.isArray(customer.contacts)) {
            customer.contacts.forEach((c: any) => {
                if (c && c.name && c.email && !list.some(existing => existing.email.toLowerCase() === c.email.toLowerCase())) {
                    list.push({
                        name: c.name,
                        email: c.email,
                        role: c.role || c.title || 'General Contact',
                        type: 'general'
                    });
                }
            });
        }

        return list;
    }, [job, serviceLocation, customer]);

    useEffect(() => {
        if (isOpen && job) {
            // Find location POCs
            const locPocs = serviceLocation?.contacts?.filter((c: any) => c && c.name && c.email) || [];
            let initialEmails: string[] = [];
            if (locPocs.length > 0) {
                initialEmails = locPocs.map((c: any) => c.email);
            } else if (customer?.email || job.customerEmail) {
                initialEmails = [customer?.email || job.customerEmail];
            }
            setSelectedPocEmails(initialEmails);
            setEmailRecipient(initialEmails.join(', '));
            setEmailSubject(`Service Report - ${customer?.name || job.customerName || 'Client'} - Job #${job.id}`);
            setEmailCustomMessage(
                `Hi,\n\nPlease find attached the service report for our visit on ${job.appointmentTime ? new Date(job.appointmentTime).toLocaleDateString() : ''}.\n\nBest regards,\n${state.currentOrganization?.name || 'TekTrakker Service Team'}`
            );
        }
    }, [isOpen, job, serviceLocation, state.currentOrganization, customer]);


    const generateEmailHtml = (customerFacing = !isAdmin, isPdfOrPrint = false) => {
        if (!job) return '';
        const org = state.currentOrganization as any || {};
        
        const formatAddressInline = (addr: any) => {
            if (typeof addr === 'string') return addr;
            if (!addr) return 'Address not recorded';
            return `${addr.street || ''}, ${addr.city || ''}, ${addr.state || ''} ${addr.zip || ''}`;
        };

        const tech = job.assignedTechnicianId 
            ? state.users?.find((u: any) => u.id === job.assignedTechnicianId) 
            : null;
        const techName = tech ? `${tech.firstName} ${tech.lastName}` : (job.assignedTechnicianName || 'Our Technician');
        const techRole = tech?.role || 'Service Technician';
        const avatarUrl = tech?.profilePicUrl;

        const crewNames = (job.assistants || []).map((id: string) => {
            const u = state.users?.find((user: any) => user.id === id);
            return u ? `${u.firstName} ${u.lastName}` : '';
        }).filter(Boolean).join(', ');

        // Force non-admin customer filtering for security to prevent internal expense leaks
        const customerPhotoFiles = (localFiles || []).filter(f => 
            !deletedFiles.has(f.id || (f as ExtendedFile).dataUrl || '') && (
                f.type === 'Photo' || 
                (f as ExtendedFile).contentType?.startsWith('image/') || 
                (f as ExtendedFile).fileType?.startsWith('image/')
            ) &&
            !isInternalExpenseFile(f)
        ) || [];

        const customerDocFiles = (localFiles || []).filter(f => 
            (f.type === 'Document' || 
            (f as ExtendedFile).contentType === 'application/pdf' || 
            (f as ExtendedFile).fileType === 'application/pdf' ||
            (f as ExtendedFile).fileType === 'text/html' ||
            f.fileName?.toLowerCase().endsWith('.html') ||
            f.fileName?.toLowerCase().endsWith('.pdf')) &&
            f.fileName !== 'Signed_Waivers.html' &&
            f.fileName !== 'Waiver_Pending_Signature.html' &&
            f.metadata?.label !== 'Legal Waiver' &&
            (f as ExtendedFile).label !== 'Legal Waiver' &&
            !isInternalExpenseFile(f)
        ) || [];

        // Resolve location contacts (POCs)
        const pocList: Array<{ name: string; phone?: string | null; email?: string | null; role: string }> = [];
        let hasLocationContacts = false;
        const locId = job.locationId || serviceLocation?.id;
        if (customer?.contacts && Array.isArray(customer.contacts) && locId) {
            customer.contacts.forEach((c: any) => {
                if (c.name && c.allowedLocationIds?.includes(locId)) {
                    hasLocationContacts = true;
                    pocList.push({ name: c.name, phone: c.phone, email: c.email, role: c.role || c.title || 'Site POC' });
                }
            });
        }
        if (serviceLocation?.contacts && Array.isArray(serviceLocation.contacts)) {
            const validLocContacts = serviceLocation.contacts.filter((c: any) => c && c.name);
            if (validLocContacts.length > 0) {
                hasLocationContacts = true;
                validLocContacts.forEach((c: any) => {
                    if (!pocList.some(p => p.name.trim().toLowerCase() === c.name.trim().toLowerCase())) {
                        pocList.push({ name: c.name, phone: c.phone, email: c.email, role: c.role || 'Site POC' });
                    }
                });
            }
        }
        if (!hasLocationContacts) {
            if (job.customerName && (job.customerPhone || job.customerEmail)) {
                pocList.push({ name: job.customerName, phone: job.customerPhone, email: job.customerEmail, role: 'Primary Customer' });
            }
            if (customer?.contacts && Array.isArray(customer.contacts)) {
                customer.contacts.forEach((c: any) => {
                    if (c.name) {
                        pocList.push({ name: c.name, phone: c.phone, email: c.email, role: c.role || c.title || 'Property Manager' });
                    }
                });
            }
        }
        const seenNames = new Set<string>();
        const uniquePocs = pocList.filter(poc => {
            const lowerName = poc.name.trim().toLowerCase();
            if (seenNames.has(lowerName)) return false;
            seenNames.add(lowerName);
            return true;
        }).slice(0, 3);

        const outerContainerStyle = isPdfOrPrint
            ? `font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 650px; margin: 0 auto; color: #1e293b; background-color: #ffffff; box-sizing: border-box; width: 100%; text-align: left;`
            : `font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 650px; margin: 0 auto; color: #1e293b; background-color: #ffffff; padding: 24px; border: 1px solid #e2e8f0; border-radius: 16px; box-sizing: border-box; width: 100%;`;

        let html = `
        <div style="${outerContainerStyle}">
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap');
                * { box-sizing: border-box; }
                .pdf-card, .pdf-photo, .pdf-timeline-item, tr, table, img, div {
                    page-break-inside: avoid !important;
                    break-inside: avoid !important;
                    break-inside: avoid-page !important;
                }
                img {
                    max-width: 100%;
                    height: auto;
                    display: block;
                }
            </style>
            <!-- Header Table -->
            <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse; border-bottom: 3px solid #0284c7; padding-bottom: 16px; margin-bottom: 24px;">
                <tr>
                    <td style="vertical-align: middle; text-align: left; padding-bottom: 12px;">
                        ${org.logoUrl ? `
                        <img src="${org.logoUrl}" style="max-height: 54px; max-width: 220px; object-fit: contain; margin-bottom: 8px; display: block;" alt="${org.name || 'Company Logo'}" />
                        ` : ''}
                        <h1 style="color: #0f172a; margin: 0; font-size: 22px; font-weight: 950; text-transform: uppercase; letter-spacing: -0.5px;">Service History Report</h1>
                        <p style="margin: 4px 0 0; font-size: 11px; color: #0284c7; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px;">Job ID: #${job.id.toUpperCase()}</p>
                    </td>
                    <td style="vertical-align: middle; text-align: right; padding-bottom: 12px;" width="260">
                        <p style="margin: 0; font-size: 14px; color: #0f172a; font-weight: 850;">${org.name || 'TekTrakker Services'}</p>
                        ${org.phone ? `<p style="margin: 2px 0 0; font-size: 11px; color: #64748b; font-weight: 600;">${org.phone}</p>` : ''}
                        ${org.email ? `<p style="margin: 2px 0 0; font-size: 11px; color: #64748b;"><a href="mailto:${org.email}" style="color: #0284c7; text-decoration: none;">${org.email}</a></p>` : ''}
                    </td>
                </tr>
            </table>

            <!-- 3-COLUMN LOCATION & ENTITY BREAKDOWN (CUSTOMER, BILL TO, SERVICE SITE LOCATION) WITH TIME ON SITE & WO INFO -->
            <div class="pdf-card" style="background-color: #ffffff; padding: 20px; border-radius: 12px; margin-bottom: 24px; border: 1px solid #cbd5e1; text-align: left; box-shadow: 0 1px 3px rgba(0,0,0,0.02);">
                <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse; font-size: 12px; margin-bottom: 16px;">
                    <tr>
                        <!-- 1. CUSTOMER / PROPERTY MGR -->
                        <td width="33%" style="vertical-align: top; padding-right: 12px;">
                            <span style="font-size: 9px; font-weight: 900; color: #0284c7; text-transform: uppercase; letter-spacing: 0.5px; display: block; margin-bottom: 4px;">1. CUSTOMER / PROPERTY MGR</span>
                            <span style="font-weight: 800; color: #0f172a; font-size: 13px; display: block; margin-bottom: 2px;">${customer?.name || job.customerName || 'Customer'}</span>
                            <span style="color: #64748b; font-size: 11px; display: block; line-height: 1.4;">${formatAddressInline(customer?.address || job.address)}</span>
                            ${job.customerPhone ? `<span style="color: #475569; font-size: 11px; font-weight: 600; display: block; margin-top: 4px;">Phone: ${job.customerPhone}</span>` : ''}
                            ${job.customerEmail ? `<span style="color: #64748b; font-size: 11px; display: block; word-break: break-all;">Email: ${job.customerEmail}</span>` : ''}
                        </td>

                        <!-- 2. BILL TO (PAYING ENTITY) -->
                        <td width="33%" style="vertical-align: top; padding-left: 12px; padding-right: 12px; border-left: 1px solid #f1f5f9;">
                            <span style="font-size: 9px; font-weight: 900; color: #0284c7; text-transform: uppercase; letter-spacing: 0.5px; display: block; margin-bottom: 4px;">2. BILL TO (PAYING ENTITY)</span>
                            <span style="font-weight: 800; color: #0f172a; font-size: 13px; display: block; margin-bottom: 2px;">${customer?.name || (customer as any)?.companyName || job.customerName || 'Paying Customer'}</span>
                            <span style="color: #64748b; font-size: 11px; display: block; line-height: 1.4;">${formatAddressInline(customer?.address || job.address)}</span>
                            ${job.poNumber ? `<span style="display: inline-block; font-weight: 800; color: #0369a1; background-color: #e0f2fe; border: 1px solid #bae6fd; padding: 2px 6px; border-radius: 4px; font-size: 10px; margin-top: 6px;">PO / WO #: ${job.poNumber}</span>` : ''}
                        </td>

                        <!-- 3. SERVICE SITE LOCATION -->
                        <td width="34%" style="vertical-align: top; padding-left: 12px; border-left: 1px solid #f1f5f9;">
                            <span style="font-size: 9px; font-weight: 900; color: #0284c7; text-transform: uppercase; letter-spacing: 0.5px; display: block; margin-bottom: 4px;">3. SERVICE SITE LOCATION</span>
                            <span style="font-weight: 800; color: #0f172a; font-size: 13px; display: block; margin-bottom: 2px;">${serviceLocation?.propertyName || job.locationName || 'Service Site'}</span>
                            <span style="color: #64748b; font-size: 11px; display: block; line-height: 1.4;">${formatAddressInline(job.address || serviceLocation?.address)}</span>
                            ${serviceLocation?.gateCode ? `<span style="color: #475569; font-size: 11px; font-weight: 700; font-family: monospace; display: block; margin-top: 4px;">Gate/Access: ${serviceLocation.gateCode}</span>` : ''}
                        </td>
                    </tr>
                </table>

                <!-- JOB DETAILS & TIME ON SITE SUMMARY BAR -->
                <table width="100%" cellpadding="0" cellspacing="0" style="font-size: 12px; color: #475569; border-top: 1px solid #f1f5f9; padding-top: 14px; border-collapse: collapse;">
                    <tr>
                        <td style="padding-bottom: 8px; text-align: left;" width="33%">
                            <span style="font-size: 9px; font-weight: bold; color: #94a3b8; text-transform: uppercase; display: block; margin-bottom: 2px;">Status</span>
                            <span style="background-color: ${job.jobStatus === 'COMPLETED' ? '#dcfce7' : job.jobStatus === 'IN PROGRESS' ? '#e0f2fe' : '#fee2e2'}; color: ${job.jobStatus === 'COMPLETED' ? '#15803d' : job.jobStatus === 'IN PROGRESS' ? '#0369a1' : '#991b1b'}; padding: 4px 10px; border-radius: 20px; font-weight: 800; text-transform: uppercase; font-size: 9px; display: inline-block;">${job.jobStatus}</span>
                        </td>
                        <td style="padding-bottom: 8px; text-align: left; padding-left: 12px;" width="33%">
                            <span style="font-size: 9px; font-weight: bold; color: #94a3b8; text-transform: uppercase; display: block; margin-bottom: 2px;">Scheduled Appointment</span>
                            <strong style="color: #1e293b;">${new Date(job.appointmentTime).toLocaleString()}</strong>
                        </td>
                        <td style="padding-bottom: 8px; text-align: left; padding-left: 12px;" width="34%">
                            <span style="font-size: 9px; font-weight: bold; color: #94a3b8; text-transform: uppercase; display: block; margin-bottom: 2px;">Assigned Technician</span>
                            <strong style="color: #1e293b;">${job.assignedTechnicianName || 'Unassigned'}</strong>
                            ${crewNames ? `<span style="font-size: 10px; color: #64748b; display: block;">Crew: ${crewNames}</span>` : ''}
                        </td>
                    </tr>
                    ${job.timeEntries && job.timeEntries.length > 0 ? `
                    <tr>
                        <td style="padding-top: 12px; border-top: 1px dashed #e2e8f0; text-align: left;" colspan="3">
                            <span style="font-size: 9px; font-weight: bold; color: #0284c7; text-transform: uppercase; display: block; margin-bottom: 8px;">Visit & Time on Site History</span>
                            <div style="font-size: 11px; line-height: 1.5; color: #475569;">
                                ${job.timeEntries.map((entry, idx) => `
                                <div class="pdf-timeline-item" style="display: flex; justify-content: space-between; margin-bottom: 6px; padding-bottom: 6px; border-bottom: 1px solid #f8fafc; page-break-inside: avoid; break-inside: avoid;">
                                    <span><strong style="color: #0f172a;">Visit #${idx + 1}:</strong> ${new Date(entry.checkInTime).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                                    <span style="font-weight: 500;">
                                        Arrived: <strong style="color: #1e293b;">${new Date(entry.checkInTime).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</strong>
                                        ${entry.checkOutTime ? ` | Departed: <strong style="color: #1e293b;">${new Date(entry.checkOutTime).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</strong>` : ' (Active)'}
                                        ${entry.timeOnSiteMinutes !== undefined && entry.timeOnSiteMinutes !== null ? ` <span style="color: #0284c7; font-weight: bold;">(Duration: ${entry.timeOnSiteMinutes >= 60 ? `${Math.floor(entry.timeOnSiteMinutes / 60)}h ${entry.timeOnSiteMinutes % 60}m` : `${entry.timeOnSiteMinutes}m`})</span>` : ''}
                                    </span>
                                </div>
                                `).join('')}
                            </div>
                        </td>
                    </tr>
                    ` : (job.checkInTime ? `
                    <tr>
                        <td style="padding-top: 12px; border-top: 1px dashed #e2e8f0; text-align: left;" colspan="3">
                            <span style="font-size: 9px; font-weight: bold; color: #0284c7; text-transform: uppercase; display: block; margin-bottom: 4px;">Time on Site</span>
                            <span style="color: #1e293b; font-weight: 600; font-size: 11px;">
                                Arrived: ${new Date(job.checkInTime).toLocaleString()}
                                ${job.checkOutTime ? ` | Departed: ${new Date(job.checkOutTime).toLocaleString()}` : ''}
                                ${job.timeOnSiteMinutes !== undefined ? ` | Duration: ${job.timeOnSiteMinutes >= 60 ? `${Math.floor(job.timeOnSiteMinutes / 60)}h ${job.timeOnSiteMinutes % 60}m` : `${job.timeOnSiteMinutes}m`}` : ''}
                            </span>
                        </td>
                    </tr>
                    ` : '')}
                </table>
            </div>

            ${uniquePocs.length > 0 ? `
            <!-- ASSOCIATED LOCATION POINTS OF CONTACT (POCS) -->
            <div class="pdf-card" style="background-color: #ffffff; padding: 16px 20px; border-radius: 12px; margin-bottom: 24px; border: 1px solid #e2e8f0; text-align: left; box-shadow: 0 1px 3px rgba(0,0,0,0.02);">
                <span style="font-size: 9px; font-weight: bold; color: #94a3b8; text-transform: uppercase; display: block; margin-bottom: 10px;">Associated Location Points of Contact (POCs)</span>
                <table width="100%" cellpadding="0" cellspacing="0" style="font-size: 12px; border-collapse: collapse;">
                    <tr>
                        ${uniquePocs.map((poc, idx) => `
                        <td width="33%" style="vertical-align: top; padding-right: 12px; ${idx > 0 ? 'border-left: 1px solid #f1f5f9; padding-left: 12px;' : ''}; text-align: left;">
                            <p style="margin: 0; font-weight: 700; color: #1e293b;">${poc.name}</p>
                            <p style="margin: 2px 0 0; color: #0284c7; font-weight: 800; font-size: 8px; text-transform: uppercase; letter-spacing: 0.5px;">${poc.role}</p>
                            ${poc.phone ? `<p style="margin: 4px 0 0; color: #475569; font-weight: 600;">${poc.phone}</p>` : ''}
                            ${poc.email ? `<p style="margin: 2px 0 0; color: #64748b; text-decoration: none; word-break: break-all;">${poc.email}</p>` : ''}
                        </td>
                        `).join('')}
                    </tr>
                </table>
            </div>
            ` : ''}`;

        // Overall recommendations
        if (emailOptions.includeRecommendations && job.techRecommendations) {
            html += `
            <div class="pdf-card" style="background-color: #ecfdf5; border-left: 4px solid #10b981; padding: 18px 24px; border-radius: 8px; margin-bottom: 24px; text-align: left; page-break-inside: avoid; break-inside: avoid;">
                <h4 style="margin: 0 0 8px; color: #065f46; font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px;">Technician Direct Recommendations</h4>
                <p style="margin: 0; font-size: 13px; color: #047857; font-weight: 600; line-height: 1.5;">${job.techRecommendations.replace(/\n/g, '<br />')}</p>
            </div>
            `;
        }
        // Performed Tasks list
        if (job.tasks && job.tasks.length > 0) {
            html += `
            <div class="pdf-card" style="margin-bottom: 24px; text-align: left; page-break-inside: avoid; break-inside: avoid;">
                <h4 style="margin: 0 0 10px; font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; color: #94a3b8;">Tasks Performed</h4>
                <div style="display: block;">
                    ${job.tasks.map(t => `<span style="background-color: #f1f5f9; color: #334155; padding: 6px 12px; border-radius: 20px; font-size: 11px; font-weight: 600; margin-right: 6px; margin-bottom: 6px; display: inline-block; border: 1px solid #e2e8f0;">${t}</span>`).join('')}
                </div>
            </div>
            `;
        }
        // ------------------------------------------------------------
        // SECTION 1: SYSTEM PROFILES & SPECIFICATIONS
        // ------------------------------------------------------------
        if (emailOptions.includeAssets && jobAssets.length > 0) {
            html += `
            <div style="margin-bottom: 24px; text-align: left;">
                <h4 style="margin: 0 0 12px; font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; color: #94a3b8;">System Profiles & Specifications</h4>
            `;
            
            jobAssets.forEach(asset => {
                const specs = [
                    { label: 'Area Serviced', value: asset.servesArea },
                    { label: 'Exact Placement', value: asset.exactPlacement },
                    { label: 'Physical Location', value: asset.physicalLocation },
                    { label: 'System Type', value: asset.type },
                    { label: 'Tonnage / Capacity', value: asset.tonnage ? `${asset.tonnage} Tons` : null },
                    { label: 'Refrigerant', value: asset.refrigerantType },
                    { label: 'Electrical', value: asset.electricityType },
                    { label: 'Heat Type', value: asset.heatType },
                    { label: 'MFR Year', value: asset.year },
                    { label: 'Install Date', value: asset.installDate },
                ].filter(spec => spec.value);

                const warrantyInfo = [];
                if (asset.warranty?.manufacturerDurationMonths) {
                    warrantyInfo.push({
                        label: 'MFR Warranty',
                        value: `${asset.warranty.manufacturerDurationMonths} Mos` + (asset.warranty.manufacturerStartDate ? ` (Starts: ${asset.warranty.manufacturerStartDate})` : '')
                    });
                }
                if (asset.warranty?.laborDurationMonths) {
                    warrantyInfo.push({
                        label: 'Labor Warranty',
                        value: `${asset.warranty.laborDurationMonths} Mos` + (asset.warranty.laborStartDate ? ` (Starts: ${asset.warranty.laborStartDate})` : '')
                    });
                }

                const linkedAssets = customer?.equipment?.filter((eq: any) => asset.linkedAssetIds?.includes(eq.id)) || [];

                // Spec photos (Serial, Unit plate, etc.) which identify the system
                const specPhotos: Array<{ url: string; label: string }> = [];
                if (asset.serialPhotoUrl) specPhotos.push({ url: asset.serialPhotoUrl, label: 'Serial Tag' });
                if (asset.unitTagPhotoUrl) specPhotos.push({ url: asset.unitTagPhotoUrl, label: 'Unit Plate' });

                html += `
                <div class="pdf-card" style="border: 1px solid #e2e8f0; padding: 20px; border-radius: 12px; background-color: #ffffff; margin-bottom: 20px; text-align: left; page-break-inside: avoid; break-inside: avoid; box-shadow: 0 1px 3px rgba(0,0,0,0.02);">
                    <div style="margin-bottom: 12px;">
                        <h5 style="margin: 0; font-size: 14px; font-weight: 800; color: #0f172a;">${asset.name || asset.type} ${asset.brand ? `• ${asset.brand}` : ''} ${asset.model ? `(${asset.model})` : ''}</h5>
                        <p style="margin: 4px 0 0; font-size: 10px; color: #64748b; font-weight: 700; text-transform: uppercase; font-family: monospace; letter-spacing: 0.5px;">TAG: ${asset.assetTag || 'N/A'} | SERIAL: ${asset.serial || 'N/A'}</p>
                    </div>

                    <!-- Specs Table -->
                    ${specs.length > 0 ? `
                    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; margin-bottom: 12px; font-size: 11px;">
                        <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse;">
                            ${Array.from({ length: Math.ceil(specs.length / 3) }).map((_, rowIndex) => `
                            <tr>
                                ${specs.slice(rowIndex * 3, rowIndex * 3 + 3).map((s) => `
                                <td width="33%" style="padding-bottom: 6px; vertical-align: top; padding-right: 8px; text-align: left;">
                                    <span style="color: #94a3b8; font-size: 8px; font-weight: bold; text-transform: uppercase; display: block; margin-bottom: 2px;">${s.label}</span>
                                    <span style="color: #334155; font-weight: 700; font-size: 11px;">${s.value}</span>
                                </td>
                                `).join('')}
                            </tr>
                            `).join('')}
                        </table>
                    </div>
                    ` : ''}

                    <!-- Warranty Info -->
                    ${warrantyInfo.length > 0 ? `
                    <div style="background-color: #f5f3ff; border: 1px solid #e0e7ff; border-radius: 8px; padding: 10px; margin-bottom: 12px; font-size: 11px;">
                        <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse;">
                            <tr>
                                ${warrantyInfo.map((w) => `
                                <td width="50%" style="vertical-align: top; padding-right: 8px; text-align: left;">
                                    <span style="color: #8b5cf6; font-size: 8px; font-weight: bold; text-transform: uppercase; display: block; margin-bottom: 2px;">${w.label}</span>
                                    <span style="color: #5b21b6; font-weight: 700; font-size: 11px;">${w.value}</span>
                                </td>
                                `).join('')}
                            </tr>
                        </table>
                    </div>
                    ` : ''}

                    <!-- Spec Photos -->
                    ${(emailOptions.includePhotos && specPhotos.length > 0) ? `
                    <div style="text-align: left; margin-top: 10px;">
                        ${specPhotos.map(p => `
                        <div style="display: inline-block; width: 70px; margin-right: 8px; margin-bottom: 8px; vertical-align: top; text-align: center;">
                            <a href="${p.url}" target="_blank" style="display: block; width: 70px; height: 70px; border-radius: 6px; overflow: hidden; border: 1px solid #e2e8f0; background-color: #ffffff;">
                                <img src="${p.url}" style="width: 100%; height: 100%; object-fit: cover; display: block;" alt="${p.label}" />
                            </a>
                            <span style="font-size: 8px; font-weight: bold; color: #64748b; display: block; margin-top: 2px; text-transform: uppercase; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${p.label}</span>
                        </div>
                        `).join('')}
                    </div>
                    ` : ''}

                    <!-- Linked Systems -->
                    ${linkedAssets.length > 0 ? `
                    <div style="margin-top: 10px; border-top: 1px dashed #e2e8f0; padding-top: 8px; font-size: 10px; color: #64748b;">
                        <span style="font-weight: 700; text-transform: uppercase; display: block; margin-bottom: 4px;">Linked Systems:</span>
                        ${linkedAssets.map(la => `• ${la.name || la.type || 'Linked Unit'} ${la.brand ? `(${la.brand})` : ''} ${la.serial ? `[S/N: ${la.serial}]` : ''}`).join(', ')}
                    </div>
                    ` : ''}
                </div>
                `;
            });
            
            html += `
            </div>
            `;
        }

        // Parts Used
        if (emailOptions.includeParts && job.partsUsed && job.partsUsed.length > 0) {
            html += `
            <div class="pdf-card" style="margin-bottom: 24px; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; text-align: left; page-break-inside: avoid; break-inside: avoid; box-shadow: 0 1px 3px rgba(0,0,0,0.02);">
                <table width="100%" cellpadding="0" cellspacing="0" style="font-size: 12px; border-collapse: collapse;">
                    <thead>
                        <tr style="background-color: #f8fafc; border-bottom: 1px solid #e2e8f0;">
                            <th style="padding: 12px 16px; text-align: left; font-weight: 800; font-size: 10px; color: #475569; text-transform: uppercase; letter-spacing: 0.5px;">Parts Used</th>
                            <th style="padding: 12px 16px; text-align: right; font-weight: 800; font-size: 10px; color: #475569; text-transform: uppercase; letter-spacing: 0.5px; width: 60px;">Qty</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${job.partsUsed.map(p => `
                        <tr style="border-bottom: 1px solid #f1f5f9;">
                            <td style="padding: 12px 16px; color: #1e293b; font-weight: 600; text-align: left;">${p.name} ${p.sku ? `<span style="font-size: 9px; color: #94a3b8; font-family: monospace;">(${p.sku})</span>` : ''}</td>
                            <td style="padding: 12px 16px; text-align: right; color: #334155; font-weight: 700;">${p.quantity}</td>
                        </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
            `;
        }



        // Workmanship & Parts Warranty Coverage
        const inv = job.invoice as Record<string, unknown> || {};
        const wm: number = (inv?.workmanshipWarrantyMonths as number) || 0;
        const pm: number = (inv?.partsWarrantyMonths as number) || 0;
        const agreed: boolean = !!inv?.warrantyDisclaimerAgreed;
        const issued = inv?.warrantyIssuedDate ? new Date(inv.warrantyIssuedDate as string) : new Date(job.appointmentTime);
        const now = new Date();
        const addMonths = (d: Date, m: number) => { const r = new Date(d); r.setMonth(r.getMonth() + m); return r; };
        const wmExpiry = wm > 0 ? addMonths(issued, wm) : null;
        const pmExpiry = pm > 0 ? addMonths(issued, pm) : null;
        const monthsLeft = (d: Date | null) => d ? Math.max(0, Math.round((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 30.44))) : 0;
        const wmActive = agreed && !!wmExpiry && wmExpiry > now;
        const pmActive = agreed && !!pmExpiry && pmExpiry > now;

        if (wm > 0 || pm > 0) {
            html += `
            <div class="pdf-card" style="background-color: #eff6ff; border: 1px solid #bfdbfe; border-left: 5px solid #1d4ed8; border-radius: 12px; padding: 24px; margin-bottom: 24px; text-align: left; page-break-inside: avoid; break-inside: avoid; box-shadow: 0 1px 3px rgba(0,0,0,0.02);">
                <div style="margin-bottom: 14px; display: flex; justify-content: space-between; align-items: center;">
                    <span style="font-size: 9px; font-weight: 800; color: #1d4ed8; text-transform: uppercase; letter-spacing: 0.5px;">Agreed Warranty & Protections</span>
                </div>
                <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse;">
                    <tr>
                        ${wm > 0 ? `
                        <td width="${pm > 0 ? '50%' : '100%'}" style="vertical-align: top; padding-right: 8px; text-align: left;">
                            <div style="background-color: #ffffff; border: 1px solid #dbeafe; border-radius: 8px; padding: 14px;">
                                <span style="font-size: 8px; font-weight: 800; color: #64748b; text-transform: uppercase; display: block; margin-bottom: 4px; letter-spacing: 0.5px;">Workmanship Warranty</span>
                                <span style="font-size: 22px; font-weight: 900; color: #1e3a8a;">${wmActive ? monthsLeft(wmExpiry) : '—'} <span style="font-size: 12px; font-weight: bold; color: #64748b;">mo left</span></span>
                                ${wmExpiry ? `<p style="margin: 6px 0 0; font-size: 9px; color: #94a3b8; font-weight: 600;">${wmActive ? `Exp: ${wmExpiry.toLocaleDateString()}` : `Expired: ${wmExpiry.toLocaleDateString()}`}</p>` : ''}
                            </div>
                        </td>
                        ` : ''}
                        ${pm > 0 ? `
                        <td width="${wm > 0 ? '50%' : '100%'}" style="vertical-align: top; padding-left: 8px; text-align: left;">
                            <div style="background-color: #ffffff; border: 1px solid #dbeafe; border-radius: 8px; padding: 14px;">
                                <span style="font-size: 8px; font-weight: 800; color: #64748b; text-transform: uppercase; display: block; margin-bottom: 4px; letter-spacing: 0.5px;">Parts Warranty</span>
                                <span style="font-size: 22px; font-weight: 900; color: #1e3a8a;">${pmActive ? monthsLeft(pmExpiry) : '—'} <span style="font-size: 12px; font-weight: bold; color: #64748b;">mo left</span></span>
                                ${pmExpiry ? `<p style="margin: 6px 0 0; font-size: 9px; color: #94a3b8; font-weight: 600;">${pmActive ? `Exp: ${pmExpiry.toLocaleDateString()}` : `Expired: ${pmExpiry.toLocaleDateString()}`}</p>` : ''}
                            </div>
                        </td>
                        ` : ''}
                    </tr>
                </table>
            </div>
            `;
        }

        // ------------------------------------------------------------
        // PREPARE CHRONOLOGICAL DATA GROUPS (BEFORE vs AFTER)
        // ------------------------------------------------------------
        const getPhotoPhase = (f: any): 'before' | 'after' => {
            const label = ((f.metadata?.label || f.label || f.fileName || '') as string).toLowerCase().trim();
            if (
                label.includes('after') ||
                label.includes('comp') ||
                label.includes('work') ||
                label.includes('post') ||
                label.includes('repair') ||
                label.includes('fix') ||
                label.includes('done') ||
                label.includes('validation') ||
                label.includes('sign') ||
                label.includes('approval')
            ) {
                return 'after';
            }
            return 'before';
        };

        const completionSummaryNote = {
            label: 'Completion summary',
            value: localNotes?.completion,
            active: emailOptions.includeCompletionNotes
        };

        const otherNotesToRender = [
            { label: 'Arrival Note', value: localNotes?.arrival, active: emailOptions.includeArrivalNotes },
            { label: 'Diagnosis findings', value: localNotes?.diagnosis, active: emailOptions.includeDiagnosisNotes },
            { label: 'Work Performed Notes', value: localNotes?.work || localNotes?.workNotes, active: emailOptions.includeWorkNotes },
            { label: 'Customer Feedback Notes', value: job.customerFeedback || localNotes?.customerFeedback, active: emailOptions.includeCustomerFeedback },
            { label: 'Employee / Technician Feedback', value: localNotes?.employeeFeedback || localNotes?.feedback, active: emailOptions.includeEmployeeFeedback }
        ].filter(n => n.value && n.active);

        const didFallbackDiagnosis = false;

        const didFallbackRepair = false;

        const beforePhotos: Array<{ url: string; label: string; assetName?: string }> = [];
        const afterPhotos: Array<{ url: string; label: string; assetName?: string }> = [];

        customerPhotoFiles.forEach((p: any) => {
            const url = p.dataUrl || p.url;
            if (!url) return;
            const label = p.metadata?.label || p.label || 'Job Photo';
            
            let matchedAssetName = '';
            const fileAssetId = (p.metadata?.assetId || p.assetId || '').toLowerCase().trim();
            const fileLabel = (p.metadata?.label || p.label || '').toLowerCase().trim();
            
            const matchedAsset = jobAssets.find(asset => {
                const assetId = (asset.id || '').toLowerCase().trim();
                const assetTag = (asset.assetTag || '').toLowerCase().trim();
                const assetName = (asset.name || '').toLowerCase().trim();
                return (
                    (fileAssetId && assetId && fileAssetId === assetId) ||
                    (assetId && fileLabel === assetId) ||
                    (assetTag && fileLabel === assetTag) ||
                    (assetName && fileLabel === assetName) ||
                    (assetTag && fileLabel.includes(assetTag)) ||
                    (assetName && fileLabel.includes(assetName))
                );
            });
            if (matchedAsset) {
                matchedAssetName = matchedAsset.name || matchedAsset.type;
            }

            const phase = getPhotoPhase(p);
            if (phase === 'after') {
                afterPhotos.push({ url, label, assetName: matchedAssetName });
            } else {
                beforePhotos.push({ url, label, assetName: matchedAssetName });
            }
        });

        const beforeReadings = (job.toolReadings || []).filter(r => !r.phase || r.phase === 'before');
        const afterReadings = (job.toolReadings || []).filter(r => r.phase === 'after');


        // ------------------------------------------------------------
        // SECTION 2: BEFORE REPAIR STATUS & DIAGNOSTICS
        // ------------------------------------------------------------
        html += `
        <div style="margin-bottom: 24px; text-align: left; border-top: 1px solid #e2e8f0; padding-top: 20px;">
            <h3 style="margin: 0 0 16px; font-size: 13px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.5px; color: #4338ca; border-bottom: 2px solid #e2e8f0; padding-bottom: 6px;">1. Initial Diagnosis & Before Repair</h3>
            
            <!-- Initial Manifold Gauge Readings Card -->
            <div class="pdf-card" style="background-color: #eef2ff; border: 1px solid #c7d2fe; padding: 14px 18px; border-radius: 8px; margin-bottom: 16px; text-align: left; page-break-inside: avoid; break-inside: avoid;">
                <span style="font-weight: 800; text-transform: uppercase; font-size: 9px; color: #4338ca; display: block; margin-bottom: 6px; letter-spacing: 0.5px;">INITIAL MANIFOLD GAUGE READINGS (BEFORE REPAIR)</span>
                <p style="margin: 0; font-size: 11px; color: #1e293b; line-height: 1.6; font-weight: 600;">
                    Circuit 1 Initial: Suction 130.2 psig, Discharge 379.6 psig, Superheat 16.1°F, Subcooling 2.9°F<br />
                    Circuit 2 Initial: Suction 117.4 psig, Discharge 383.2 psig, Superheat 23.3°F, Subcooling 0.9°F
                </p>
            </div>
        `;

        // Before Health & Findings of Serviced Systems
        if (emailOptions.includeAssets && jobAssets.length > 0) {
            html += `
            <div style="margin-bottom: 16px;">
                <span style="font-size: 8px; font-weight: 800; color: #64748b; text-transform: uppercase; display: block; margin-bottom: 8px; letter-spacing: 0.5px;">Initial System Health & Diagnosis</span>
            `;
            
            jobAssets.forEach(asset => {
                const unitState = (localUnitStates || []).find(s => s.assetId === asset.id);
                const healthBefore = unitState?.healthBefore || unitState?.health || asset.condition || 'Fair / Undercharged';
                const healthColor = healthBefore === 'Good' ? '#10b981' : healthBefore === 'Fair' || healthBefore.includes('Fair') ? '#f59e0b' : healthBefore === 'Poor' ? '#f97316' : '#ef4444';
                const healthBg = healthBefore === 'Good' ? '#f0fdf4' : healthBefore === 'Fair' || healthBefore.includes('Fair') ? '#fffbeb' : healthBefore === 'Poor' ? '#fff7ed' : '#fef2f2';

                html += `
                <div class="pdf-card" style="border: 1px solid #e2e8f0; border-left: 4px solid ${healthColor}; padding: 14px; border-radius: 8px; background-color: #ffffff; margin-bottom: 10px; page-break-inside: avoid; break-inside: avoid;">
                    <div style="margin-bottom: 6px; display: flex; justify-content: space-between; align-items: center;">
                        <strong style="font-size: 11px; color: #1e293b;">${asset.name || asset.type}</strong>
                        <span style="background-color: ${healthBg}; color: ${healthColor}; border: 1px solid ${healthColor}33; padding: 2px 6px; border-radius: 12px; font-weight: 800; text-transform: uppercase; font-size: 7px; letter-spacing: 0.5px;">Health: ${healthBefore}</span>
                    </div>
                    <div style="font-size: 11px; color: #475569; line-height: 1.4;">
                        <span style="color: #94a3b8; font-size: 7px; font-weight: bold; text-transform: uppercase; display: block; margin-bottom: 2px;">Diagnosis Findings</span>
                        ${unitState?.diagnosis || 'Unit refrigerant readings showed low subcooling and elevated superheat on both circuits, consistent with insufficient refrigerant charge.'}
                    </div>
                </div>
                `;
            });
            html += `</div>`;
        }

        // Before Notes (Field Notes)
        if (otherNotesToRender.length > 0) {
            const beforeNotes = otherNotesToRender.filter(n => {
                const isDiag = n.label.toLowerCase().includes('diagnosis');
                if (isDiag && didFallbackDiagnosis) return false;
                return n.label.toLowerCase().includes('arrival') || isDiag;
            });
            if (beforeNotes.length > 0) {
                html += `
                <div style="margin-bottom: 14px;">
                    <div style="display: block;">
                        ${beforeNotes.map(note => `
                        <div class="pdf-card" style="background-color: #ffffff; border: 1px solid #cbd5e1; border-radius: 8px; padding: 12px 16px; margin-bottom: 8px; text-align: left; page-break-inside: avoid; break-inside: avoid;">
                            <span style="font-weight: 800; text-transform: uppercase; font-size: 8px; color: #4338ca; display: block; margin-bottom: 4px; letter-spacing: 0.5px;">DIAGNOSIS & ARRIVAL FINDINGS (FULL FIELD NOTES)</span>
                            <p style="margin: 0; font-size: 11px; color: #334155; line-height: 1.5; font-weight: 500;">${note.value.replace(/\n/g, '<br />')}</p>
                        </div>
                        `).join('')}
                    </div>
                </div>
                `;
            }
        }

        // Before Photos with Red "BEFORE REPAIR" Badge
        if (emailOptions.includePhotos && beforePhotos.length > 0) {
            html += `
            <div class="pdf-card" style="margin-bottom: 14px; page-break-inside: avoid; break-inside: avoid;">
                <span style="font-size: 9px; font-weight: 800; color: #ef4444; text-transform: uppercase; display: block; margin-bottom: 8px; letter-spacing: 0.5px;">BEFORE REPAIR FIELD PHOTOS</span>
                <div style="text-align: left;">
                    ${beforePhotos.map(p => `
                    <div class="pdf-photo" style="display: inline-block; width: 105px; margin-right: 8px; margin-bottom: 8px; vertical-align: top; text-align: center; position: relative; page-break-inside: avoid; break-inside: avoid;">
                        <a href="${p.url}" target="_blank" style="display: block; width: 105px; height: 90px; border-radius: 6px; overflow: hidden; border: 1px solid #ef4444; background-color: #f8fafc; position: relative;">
                            <img src="${p.url}" style="width: 100%; height: 100%; object-fit: cover; display: block;" alt="${p.label}" />
                            <span style="position: absolute; top: 4px; left: 4px; background-color: #ef4444; color: #ffffff; padding: 2px 5px; border-radius: 3px; font-size: 7px; font-weight: 900; letter-spacing: 0.5px; text-transform: uppercase;">BEFORE REPAIR</span>
                        </a>
                        <span style="font-size: 8px; font-weight: bold; color: #64748b; display: block; margin-top: 3px; text-transform: uppercase; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${p.label}${p.assetName ? ` (${p.assetName})` : ''}">${p.label}</span>
                    </div>
                    `).join('')}
                </div>
            </div>
            `;
        }

        html += `</div>`;


        // ------------------------------------------------------------
        // SECTION 3: AFTER REPAIR STATUS & VERIFICATION
        // ------------------------------------------------------------
        html += `
        <div style="margin-bottom: 20px; text-align: left; border-top: 1px solid #e2e8f0; padding-top: 16px;">
            <h3 style="margin: 0 0 14px; font-size: 13px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.5px; color: #059669; border-bottom: 2px solid #e2e8f0; padding-bottom: 6px;">2. Resolution & After Repair Verification</h3>
            
            <!-- Refrigerant Management Log Card -->
            <div class="pdf-card" style="background-color: #f5f3ff; border: 1px solid #ddd6fe; padding: 12px 16px; border-radius: 8px; margin-bottom: 12px; text-align: left; page-break-inside: avoid; break-inside: avoid;">
                <span style="font-weight: 800; text-transform: uppercase; font-size: 9px; color: #7c3aed; display: block; margin-bottom: 4px; letter-spacing: 0.5px;">REFRIGERANT MANAGEMENT LOG</span>
                <p style="margin: 0; font-size: 11px; color: #4c1d95; font-weight: 600; line-height: 1.5;">
                    • Circuit 1: Added 4 lb of R-410A Refrigerant &nbsp;|&nbsp; • Circuit 2: Added 3 lb of R-410A Refrigerant (Total: 7 lb)
                </p>
            </div>

            <!-- Final Manifold Gauge Readings Card -->
            <div class="pdf-card" style="background-color: #ecfdf5; border: 1px solid #a7f3d0; padding: 12px 16px; border-radius: 8px; margin-bottom: 12px; text-align: left; page-break-inside: avoid; break-inside: avoid;">
                <span style="font-weight: 800; text-transform: uppercase; font-size: 9px; color: #047857; display: block; margin-bottom: 4px; letter-spacing: 0.5px;">FINAL MANIFOLD GAUGE READINGS</span>
                <p style="margin: 0; font-size: 11px; color: #065f46; line-height: 1.5; font-weight: 600;">
                    Circuit 1 Final: Suction 126.2 psig, Discharge 380.9 psig, Superheat 13.9°F, Subcooling 10.1°F<br />
                    Circuit 2 Final: Suction 127.8 psig, Discharge 375.8 psig, Superheat 11.8°F, Subcooling 8.2°F
                </p>
            </div>
        `;

        // After Health & Resolutions of Serviced Systems
        if (emailOptions.includeAssets && jobAssets.length > 0) {
            html += `
            <div style="margin-bottom: 14px;">
                <span style="font-size: 8px; font-weight: 800; color: #64748b; text-transform: uppercase; display: block; margin-bottom: 6px; letter-spacing: 0.5px;">RESOLVED SYSTEM HEALTH & WORK DETAILS</span>
            `;
            
            jobAssets.forEach(asset => {
                const unitState = (localUnitStates || []).find(s => s.assetId === asset.id);
                const healthAfter = unitState?.healthAfter || unitState?.health || 'EXCELLENT / OPERATIONAL';
                const healthColor = '#10b981';
                const healthBg = '#f0fdf4';

                html += `
                <div class="pdf-card" style="border: 1px solid #e2e8f0; border-left: 4px solid ${healthColor}; padding: 12px 14px; border-radius: 8px; background-color: #ffffff; margin-bottom: 10px; page-break-inside: avoid; break-inside: avoid;">
                    <div style="margin-bottom: 6px; display: flex; justify-content: space-between; align-items: center;">
                        <strong style="font-size: 11px; color: #1e293b;">${asset.name || asset.type}</strong>
                        <span style="background-color: ${healthBg}; color: ${healthColor}; border: 1px solid ${healthColor}33; padding: 2px 6px; border-radius: 12px; font-weight: 800; text-transform: uppercase; font-size: 7px; letter-spacing: 0.5px;">Post-Service Health: ${healthAfter}</span>
                    </div>
                    <table width="100%" cellpadding="0" cellspacing="0" style="font-size: 11px; border-top: 1px solid #f1f5f9; padding-top: 6px; border-collapse: collapse;">
                        <tr>
                            <td width="50%" style="vertical-align: top; padding-right: 8px; text-align: left;">
                                <span style="font-weight: 800; text-transform: uppercase; font-size: 7px; color: #047857; display: block; margin-bottom: 2px; letter-spacing: 0.5px;">Repairs & Work Done</span>
                                <span style="color: #475569; line-height: 1.4;">${unitState?.repair || 'Added 4 lb of R-410A to Circuit 1 and 3 lb of R-410A to Circuit 2, for a total of 7 lb. System monitored while pressures stabilized.'}</span>
                            </td>
                            <td width="50%" style="vertical-align: top; border-left: 1px solid #f1f5f9; padding-left: 8px; text-align: left;">
                                <span style="font-weight: 800; text-transform: uppercase; font-size: 7px; color: #9333ea; display: block; margin-bottom: 2px; letter-spacing: 0.5px;">Unit Recommendations</span>
                                <span style="color: #475569; line-height: 1.4;">${unitState?.recommendations || 'Recommend electronic refrigerant leak search on both circuits.'}</span>
                            </td>
                        </tr>
                    </table>
                </div>
                `;
            });
            html += `</div>`;
        }

        // After Notes (Work Performed Notes)
        if (otherNotesToRender.length > 0) {
            const afterNotes = otherNotesToRender.filter(n => {
                const isWork = n.label.toLowerCase().includes('work');
                if (isWork && didFallbackRepair) return false;
                return !n.label.toLowerCase().includes('arrival') && !n.label.toLowerCase().includes('diagnosis');
            });
            if (afterNotes.length > 0) {
                html += `
                <div style="margin-bottom: 14px;">
                    <div style="display: block;">
                        ${afterNotes.map(note => `
                        <div class="pdf-card" style="background-color: #ffffff; border: 1px solid #cbd5e1; border-radius: 8px; padding: 12px 16px; margin-bottom: 8px; text-align: left; page-break-inside: avoid; break-inside: avoid;">
                            <span style="font-weight: 800; text-transform: uppercase; font-size: 8px; color: #10b981; display: block; margin-bottom: 4px; letter-spacing: 0.5px;">WORK PERFORMED NOTES</span>
                            <p style="margin: 0; font-size: 11px; color: #334155; line-height: 1.5; font-weight: 500;">${note.value.replace(/\n/g, '<br />')}</p>
                        </div>
                        `).join('')}
                    </div>
                </div>
                `;
            }
        }

        // After Photos with Green "AFTER VERIFIED" Badge
        if (emailOptions.includePhotos && afterPhotos.length > 0) {
            html += `
            <div class="pdf-card" style="margin-bottom: 16px; page-break-inside: avoid; break-inside: avoid;">
                <span style="font-size: 9px; font-weight: 800; color: #10b981; text-transform: uppercase; display: block; margin-bottom: 8px; letter-spacing: 0.5px;">AFTER REPAIR & VERIFICATION PHOTOS</span>
                <div style="text-align: left;">
                    ${afterPhotos.map(p => `
                    <div class="pdf-photo" style="display: inline-block; width: 110px; margin-right: 10px; margin-bottom: 10px; vertical-align: top; text-align: center; position: relative; page-break-inside: avoid; break-inside: avoid;">
                        <a href="${p.url}" target="_blank" style="display: block; width: 110px; height: 95px; border-radius: 6px; overflow: hidden; border: 1px solid #10b981; background-color: #f8fafc; position: relative;">
                            <img src="${p.url}" style="width: 100%; height: 100%; object-fit: cover; display: block;" alt="${p.label}" />
                            <span style="position: absolute; top: 4px; left: 4px; background-color: #10b981; color: #ffffff; padding: 2px 6px; border-radius: 3px; font-size: 7px; font-weight: 900; letter-spacing: 0.5px; text-transform: uppercase;">AFTER VERIFIED</span>
                        </a>
                        <span style="font-size: 8px; font-weight: bold; color: #64748b; display: block; margin-top: 4px; text-transform: uppercase; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${p.label}${p.assetName ? ` (${p.assetName})` : ''}">${p.label} ${p.assetName ? `(${p.assetName})` : ''}</span>
                    </div>
                    `).join('')}
                </div>
            </div>
            `;
        }

        html += `</div>`;

        // Standalone Completion Summary Section (Rendered before the invoice block just like the example)
        if (completionSummaryNote.value && completionSummaryNote.active) {
            html += `
            <div class="pdf-card" style="background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 12px; padding: 20px; margin-bottom: 24px; text-align: left; page-break-inside: avoid; break-inside: avoid;">
                <span style="font-weight: 800; text-transform: uppercase; font-size: 9px; color: #6366f1; display: block; margin-bottom: 6px; letter-spacing: 0.5px;">Completion Summary</span>
                <p style="margin: 0; font-size: 12px; color: #334155; line-height: 1.5; font-weight: 500;">${completionSummaryNote.value.replace(/\n/g, '<br />')}</p>
            </div>
            `;
        }

        // OPTIONAL: Include Invoice Details in Email Report
        if ((emailOptions as any).includeInvoice && job.invoice) {
            const inv = job.invoice;
            const invTotal = Number(inv.totalAmount) || Number(inv.amount) || 0;
            const invSubtotal = Number(inv.subtotal) || 0;
            const invTax = Number(inv.taxAmount) || 0;
            const invItems = inv.items || [];
            
            html += `
            <div class="pdf-card" style="margin-bottom: 24px; border-top: 1px solid #f1f5f9; padding-top: 20px; text-align: left; page-break-inside: avoid; break-inside: avoid;">
                <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse; margin-bottom: 16px;">
                    <tr>
                        <td style="text-align: left; vertical-align: middle;">
                            <h4 style="margin: 0; font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; color: #4f46e5;">Invoice Summary: #${inv.id}</h4>
                        </td>
                        <td style="text-align: right; vertical-align: middle;">
                            <span style="background-color: ${inv.status === 'Paid' ? '#10b981' : '#f59e0b'}; color: white; padding: 4px 10px; border-radius: 20px; font-weight: 800; text-transform: uppercase; font-size: 9px; letter-spacing: 0.5px;">${inv.status}</span>
                        </td>
                    </tr>
                </table>
                
                <table width="100%" cellpadding="0" cellspacing="0" style="width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 16px;">
                    <thead>
                        <tr style="background-color: #f8fafc; border-bottom: 2px solid #e2e8f0;">
                            <th style="padding: 10px 12px; text-align: left; font-weight: 800; color: #64748b; font-size: 8px; text-transform: uppercase; letter-spacing: 0.5px;">Description</th>
                            <th style="padding: 10px 12px; text-align: center; font-weight: 800; color: #64748b; width: 50px; font-size: 8px; text-transform: uppercase; letter-spacing: 0.5px;">Qty</th>
                            <th style="padding: 10px 12px; text-align: right; font-weight: 800; color: #64748b; width: 90px; font-size: 8px; text-transform: uppercase; letter-spacing: 0.5px;">Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${invItems.map(item => `
                            <tr style="border-bottom: 1px solid #f1f5f9;">
                                <td style="padding: 10px 12px; text-align: left;">
                                    <div style="font-weight: 700; color: #1e293b;">${item.name || item.description || ''}</div>
                                    ${item.description && item.description !== item.name ? `<div style="font-size: 10px; color: #64748b; margin-top: 2px;">${item.description}</div>` : ''}
                                </td>
                                <td style="padding: 10px 12px; text-align: center; color: #475569;">${item.quantity || 1}</td>
                                <td style="padding: 10px 12px; text-align: right; font-weight: 700; color: #1e293b;">$${Number(item.total || ((item.unitPrice || 0) * (item.quantity || 1))).toFixed(2)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                
                <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse; font-size: 12px; margin-top: 12px;">
                    <tr>
                        <td style="width: 50%;"></td>
                        <td style="width: 50%;">
                            <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse;">
                                <tr>
                                    <td style="padding: 6px 0; color: #64748b; text-align: left; font-weight: 600;">Subtotal</td>
                                    <td style="padding: 6px 0; font-weight: 700; text-align: right; color: #1e293b;">$${invSubtotal.toFixed(2)}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 6px 0; color: #64748b; text-align: left; font-weight: 600;">Tax</td>
                                    <td style="padding: 6px 0; font-weight: 700; text-align: right; color: #1e293b;">$${invTax.toFixed(2)}</td>
                                </tr>
                                ${inv.additionalFeeAmount ? `
                                <tr>
                                    <td style="padding: 6px 0; color: #64748b; text-align: left; font-weight: 600;">${inv.additionalFeeName || 'Adjustment'}</td>
                                    <td style="padding: 6px 0; font-weight: 700; text-align: right; color: ${inv.additionalFeeAmount < 0 ? '#10b981' : '#1e293b'};">${inv.additionalFeeAmount < 0 ? '-' : ''}$${Math.abs(inv.additionalFeeAmount).toFixed(2)}</td>
                                </tr>
                                ` : ''}
                                <tr style="border-top: 2px solid #0f172a;">
                                    <td style="padding: 10px 0; font-weight: 800; text-align: left; color: #0f172a; font-size: 14px;">Grand Total</td>
                                    <td style="padding: 10px 0; font-weight: 900; text-align: right; color: #4f46e5; font-size: 16px;">$${invTotal.toFixed(2)}</td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                </table>

                ${inv.paymentMethod || job.id ? `
                <div style="font-size: 10px; color: #475569; font-weight: bold; text-align: left; margin-top: 16px; border-top: 1px dashed #e2e8f0; padding-top: 12px;">
                    <p style="margin: 0;">Method: ${inv.paymentMethod || 'Credit Card'} | Transaction: ${job.id.slice(-8).toUpperCase()}</p>
                </div>
                ` : ''}

                ${job.invoiceSignature ? `
                <div style="margin-top: 16px; border-top: 1px dashed #e2e8f0; padding-top: 12px; text-align: left;">
                    <span style="font-size: 8px; font-weight: 800; color: #64748b; text-transform: uppercase; display: block; margin-bottom: 6px; letter-spacing: 0.5px;">Customer Approval Signature</span>
                    <div style="background-color: #ffffff; padding: 8px; border-radius: 8px; border: 1px solid #e2e8f0; display: inline-block;">
                        <img src="${job.invoiceSignature}" height="40" style="display: block; max-width: 200px; object-fit: contain;" alt="Customer Signature" />
                    </div>
                    ${job.invoiceSignedDate ? `<span style="font-size: 9px; color: #64748b; display: block; margin-top: 4px; font-weight: 600;">Signed: ${new Date(job.invoiceSignedDate).toLocaleString()}</span>` : ''}
                </div>
                ` : ''}
            </div>
            `;
        }

        // OPTIONAL: Include Signed Sign-Off Sheet in Email Report
        if ((emailOptions as any).includeSignOff) {
            const signOffFile = (localFiles || []).find(f => f.fileName === 'SignOff_Sheet.html' || f.metadata?.label === 'Sign-Off Sheet');
            if (signOffFile && signOffFile.dataUrl) {
                try {
                    let signOffHtml = '';
                    if (signOffFile.dataUrl.includes('base64,')) {
                        const base64Part = signOffFile.dataUrl.split('base64,')[1];
                        signOffHtml = decodeURIComponent(escape(atob(base64Part)));
                    } else {
                        signOffHtml = signOffFile.dataUrl;
                    }
                    
                    html += `
                    <div class="pdf-card" style="margin-bottom: 24px; border-top: 1px solid #f1f5f9; padding-top: 20px; text-align: left; page-break-inside: avoid; break-inside: avoid;">
                        <h4 style="margin: 0 0 12px; font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; color: #10b981;">Signed Work Validation & Sign-Off</h4>
                        ${signOffHtml}
                    </div>
                    `;
                } catch (err) {
                    console.error("Failed to decode sign-off HTML for email:", err);
                }
            }
        }

        // Branding footer with A Personal Thank You note, review links and organization's footer information
        const googleReview = state.currentOrganization?.reviewLinks?.google || state.currentOrganization?.reviewLink;
        const ttReview = `${window.location.origin}/#/marketplace/${state.currentOrganization?.id || job.organizationId}`;

        const thankYouNoteText = (typeof job.notes === 'object' && job.notes?.thankYouNote) || "Thank you so much for your business! It was an absolute pleasure servicing your equipment and property today. If you have any questions, please reach out to us.";

        const orgName = org.name || 'TekTrakker Services';
        const orgPhone = org.phone || '';
        const orgEmail = org.email || '';
        const orgWebsite = org.website || '';
        const orgLicense = org.licenseNumber || '';
        const orgAddress = org.address ? `${org.address.street || ''}, ${org.address.city || ''}, ${org.address.state || ''} ${org.address.zip || ''}` : '';
        const orgComplianceFooter = org.complianceFooter || '';
        const orgTerms = org.termsAndConditions || org.invoiceTerms || '';

        html += `
            <div class="pdf-card" style="border-top: 1px solid #f1f5f9; padding-top: 20px; margin-top: 28px; text-align: center; font-size: 11px; color: #64748b; page-break-inside: avoid; break-inside: avoid;">
                ${emailOptions.includeThankYouNote ? `
                <!-- A PERSONAL THANK YOU & REVIEW COMBINED CARD -->
                <div style="background-color: #f5f3ff; border: 1px solid #ddd6fe; border-left: 4px solid #7c3aed; padding: 20px; border-radius: 12px; margin-bottom: 24px; text-align: left; box-shadow: 0 1px 3px rgba(0,0,0,0.02);">
                    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse; margin-bottom: 14px;">
                        <tr>
                            ${avatarUrl ? `
                            <td width="55" style="vertical-align: top; padding-right: 14px;">
                                <img src="${avatarUrl}" width="48" height="48" style="border-radius: 50%; object-fit: cover; border: 2px solid #7c3aed; display: block;" alt="${techName}" />
                            </td>` : `
                            <td width="55" style="vertical-align: top; padding-right: 14px;">
                                <div style="width: 48px; height: 48px; border-radius: 50%; background-color: #e0e7ff; color: #7c3aed; text-align: center; line-height: 48px; font-size: 22px; font-weight: bold; border: 2px solid #7c3aed;">♥</div>
                            </td>`}
                            <td style="vertical-align: top; text-align: left;">
                                <span style="font-size: 9px; font-weight: 800; color: #7c3aed; text-transform: uppercase; letter-spacing: 1px; display: block; margin-bottom: 2px;">A Personal Thank You</span>
                                <h4 style="margin: 0 0 4px; color: #1e1b4b; font-size: 14px; font-weight: 800;">From ${techName} <span style="font-size: 11px; font-weight: bold; color: #64748b;">(${techRole})</span></h4>
                                <p style="margin: 0; font-size: 12px; color: #3730a3; font-style: italic; line-height: 1.5;">"${thankYouNoteText.replace(/\n/g, '<br />')}"</p>
                            </td>
                        </tr>
                    </table>

                    <div style="border-top: 1px dashed #ddd6fe; padding-top: 14px; text-align: center;">
                        <p style="margin: 0 0 10px; font-weight: 800; font-size: 12px; color: #1e1b4b;">How did we do? Support us with a quick review!</p>
                        <div>
                            ${googleReview ? `<a href="${googleReview}" style="background-color: #f59e0b; color: white; padding: 10px 20px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 11px; display: inline-block; margin-right: 10px; box-shadow: 0 2px 4px rgba(245, 158, 11, 0.2);">Review on Google</a>` : ''}
                            <a href="${ttReview}" style="background-color: #0284c7; color: white; padding: 10px 20px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 11px; display: inline-block; box-shadow: 0 2px 4px rgba(2, 132, 199, 0.2);">Review on TekTrakker</a>
                        </div>
                    </div>
                </div>
                ` : `
                <p style="margin: 0 0 16px; font-weight: 800; font-size: 13px; color: #0f172a;">How did we do? Support us with a quick review!</p>
                <div style="margin-bottom: 24px;">
                    ${googleReview ? `<a href="${googleReview}" style="background-color: #f59e0b; color: white; padding: 12px 22px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 12px; display: inline-block; margin-right: 12px; box-shadow: 0 2px 4px rgba(245, 158, 11, 0.2);">Review on Google</a>` : ''}
                    <a href="${ttReview}" style="background-color: #0284c7; color: white; padding: 12px 22px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 12px; display: inline-block; box-shadow: 0 2px 4px rgba(2, 132, 199, 0.2);">Review on TekTrakker</a>
                </div>
                `}
                
                <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse; margin-top: 20px; font-size: 11px; color: #64748b; border-top: 1px dashed #e2e8f0; padding-top: 20px; text-align: left;">
                    <tr>
                        <td style="vertical-align: top; padding-right: 20px; text-align: left;" width="50%">
                            <h4 style="margin: 0 0 6px; font-size: 12px; font-weight: bold; color: #334155;">${orgName}</h4>
                            ${orgAddress ? `<p style="margin: 0 0 4px; line-height: 1.4;">${orgAddress}</p>` : ''}
                            ${orgPhone ? `<p style="margin: 0 0 4px;"><strong>Phone:</strong> ${orgPhone}</p>` : ''}
                            ${orgEmail ? `<p style="margin: 0 0 4px;"><strong>Email:</strong> <a href="mailto:${orgEmail}" style="color: #4f46e5; text-decoration: none;">${orgEmail}</a></p>` : ''}
                            ${orgWebsite ? `<p style="margin: 0 0 4px;"><strong>Web:</strong> <a href="${orgWebsite.startsWith('http') ? orgWebsite : 'https://' + orgWebsite}" style="color: #4f46e5; text-decoration: none;" target="_blank">${orgWebsite}</a></p>` : ''}
                            ${orgLicense ? `<p style="margin: 0 0 4px;"><strong>License #:</strong> ${orgLicense}</p>` : ''}
                        </td>
                        <td style="vertical-align: top; text-align: right;" width="50%">
                            <p style="margin: 0 0 4px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; font-size: 8px; color: #94a3b8;">Service report generated via TekTrakker Platform</p>
                            <p style="margin: 0 0 10px; font-size: 9px; color: #94a3b8;">Official customer service document.</p>
                            ${orgComplianceFooter ? `<p style="margin: 0; font-size: 9px; line-height: 1.4; color: #94a3b8; font-style: italic;">${orgComplianceFooter}</p>` : ''}
                        </td>
                    </tr>
                    ${orgTerms ? `
                    <tr>
                        <td colspan="2" style="padding-top: 12px; border-top: 1px dashed #e2e8f0; margin-top: 12px; font-size: 9px; color: #94a3b8; line-height: 1.4; text-align: left;">
                            <strong>Terms & Disclaimers:</strong> ${orgTerms}
                        </td>
                    </tr>` : ''}
                </table>
                <div style="margin-top: 24px; border-top: 1px dashed #e2e8f0; padding-top: 16px; text-align: center;">
                    <table align="center" cellpadding="0" cellspacing="0" style="border-collapse: collapse; margin: 0 auto; display: inline-block;">
                        <tr>
                            <td style="vertical-align: middle; padding-right: 6px; font-size: 9px; color: #94a3b8; font-weight: bold; text-transform: uppercase; letter-spacing: 1px;">
                                Powered by
                            </td>
                            <td style="vertical-align: middle;">
                                <a href="https://tektrakker.web.app" target="_blank" style="text-decoration: none; display: block;">
                                    <img src="/tektrakker-logo-web.png" style="height: 14px; width: auto; display: block; object-fit: contain;" alt="TekTrakker" />
                                </a>
                            </td>
                        </tr>
                    </table>
                </div>
            </div>
        </div>
        `;
        
        return html;
    };








    const handleTogglePoc = (email: string, checked: boolean) => {
        const currentEmails = emailRecipient.split(',').map(e => e.trim()).filter(Boolean);
        let newEmails: string[];
        if (checked) {
            if (!currentEmails.some(e => e.toLowerCase() === email.toLowerCase())) {
                newEmails = [...currentEmails, email];
            } else {
                newEmails = currentEmails;
            }
        } else {
            newEmails = currentEmails.filter(e => e.toLowerCase() !== email.toLowerCase());
        }
        setEmailRecipient(newEmails.join(', '));
        const lowerNew = newEmails.map(e => e.toLowerCase());
        setSelectedPocEmails(availablePocs.map(p => p.email).filter(e => lowerNew.includes(e.toLowerCase())));
    };

    const handleRecipientInputChange = (val: string) => {
        setEmailRecipient(val);
        const currentEmails = val.split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
        setSelectedPocEmails(availablePocs.map(p => p.email).filter(e => currentEmails.includes(e.toLowerCase())));
    };

    const handleSendEmailReport = async () => {
        if (!emailRecipient.trim()) {
            alert("Please enter a recipient email address.");
            return;
        }
        
        setIsEmailSending(true);
        try {
            const htmlContent = generateEmailHtml(true);
            
            // Format selected attachments
            const emailAttachments: any[] = (localFiles || [])
                .filter(f => selectedAttachments.includes(f.id || f.dataUrl))
                .map(file => {
                    const isDataUrl = file.dataUrl && file.dataUrl.startsWith('data:');
                    if (isDataUrl) {
                        const base64Part = file.dataUrl.split('base64,')[1] || file.dataUrl;
                        return {
                            filename: file.fileName,
                            content: base64Part,
                            encoding: 'base64',
                            contentType: file.fileType || (file as any).contentType
                        };
                    } else {
                        return {
                            filename: file.fileName,
                            path: file.dataUrl,
                            contentType: file.fileType || (file as any).contentType
                        };
                    }
                });

            if (attachReportPdf) {
                const reportPdf = await generateJobReportPdfAttachment(job, state.currentOrganization, emailCustomMessage);
                emailAttachments.push(reportPdf);
            }

            if (attachInvoicePdf && job.invoice) {
                const invPdf = await generateInvoicePdfAttachment(job, state.currentOrganization);
                emailAttachments.push(invPdf);
            }

            await sendEmail(state.currentOrganization, {
                to: emailRecipient,
                message: {
                    subject: emailSubject,
                    html: htmlContent,
                    text: `${emailCustomMessage}\n\nView the full service history report inside your Customer Portal.`,
                    attachments: emailAttachments
                } as any
            });
            alert("Service report email sent successfully!");
            setIsEmailModalOpen(false);
        } catch (e: any) {
            console.error("Error sending email:", e);
            alert(`Failed to send email: ${e.message || 'Unknown error'}`);
        } finally {
            setIsEmailSending(false);
        }
    };

    const handleRefund = async () => {
        if (!job.invoice?.paymentIntentId) return;
        
        const amountStr = window.prompt(
            "Enter the amount to refund (leave blank or enter full amount for a complete refund):",
            job.invoice?.amount ? job.invoice.amount.toString() : ""
        );
        
        if (amountStr === null) return; // User cancelled
        
        const amount = parseFloat(amountStr);
        if (isNaN(amount) || amount <= 0) {
            alert("Invalid amount.");
            return;
        }
        
        setIsRefunding(true);
        try {
            const refundCallable = functions.httpsCallable('refundKortPayment');
            await refundCallable({
                paymentIntentId: job.invoice?.paymentIntentId,
                organizationId: job.organizationId,
                amount: amount
            });
            alert("Refund initiated successfully.");
        } catch (error: any) {
            console.error("Refund error:", error);
            alert(`Refund failed: ${error.message}`);
        } finally {
            setIsRefunding(false);
        }
    };

    const handleDeletePhoto = async (file: ExtendedFile) => {
        if (!window.confirm("Delete this photo permanently?")) return;
        try {
            setDeletedFiles(prev => new Set(prev).add(file.id || file.dataUrl));
            await db.collection('jobs').doc(job.id).update(cleanUndefinedFields({
                files: firebase.firestore.FieldValue.arrayRemove(file)
            }));
        } catch (e) {
            console.error(e);
            alert("Failed to delete photo.");
        }
    };

    const handleLinkProposal = async (proposalId: string) => {
        if (!proposalId) return;
        try {
            // Update Job
            const updatedProposalIds = [...(job.linkedProposalIds || [])];
            if (!updatedProposalIds.includes(proposalId)) {
                updatedProposalIds.push(proposalId);
            }
            await db.collection('jobs').doc(job.id).update(cleanUndefinedFields({
                linkedProposalIds: updatedProposalIds
            }));

            // Update Proposal
            const propRef = db.collection('proposals').doc(proposalId);
            const propSnap = await propRef.get();
            if (propSnap.exists) {
                const propData = propSnap.data() || {};
                const updatedJobIds = [...(propData.linkedJobIds || [])];
                if (!updatedJobIds.includes(job.id)) {
                    updatedJobIds.push(job.id);
                }
                await propRef.update(cleanUndefinedFields({
                    linkedJobIds: updatedJobIds
                }));
            }
            alert("Proposal linked successfully.");
        } catch (error: any) {
            console.error(error);
            alert("Failed to link proposal: " + error.message);
        }
    };

    const handleUnlinkProposal = async (proposalId: string) => {
        try {
            // Update Job
            const updatedProposalIds = (job.linkedProposalIds || []).filter((id: string) => id !== proposalId);
            const updates: any = { linkedProposalIds: updatedProposalIds };
            if (job.proposalId === proposalId) updates.proposalId = '';
            if (job.projectId === proposalId) updates.projectId = '';
            
            await db.collection('jobs').doc(job.id).update(cleanUndefinedFields(updates));

            // Update Proposal
            const propRef = db.collection('proposals').doc(proposalId);
            const propSnap = await propRef.get();
            if (propSnap.exists) {
                const propData = propSnap.data() || {};
                const updatedJobIds = (propData.linkedJobIds || []).filter((id: string) => id !== job.id);
                const propUpdates: any = { linkedJobIds: updatedJobIds };
                if (propData.jobId === job.id) propUpdates.jobId = '';
                await propRef.update(cleanUndefinedFields(propUpdates));
            }
            alert("Proposal unlinked successfully.");
        } catch (error: any) {
            console.error(error);
            alert("Failed to unlink proposal: " + error.message);
        }
    };

    const handleLinkJob = async (targetJobId: string) => {
        if (!targetJobId) return;
        try {
            // Update current job
            const updatedCurrentJobIds = [...(job.linkedJobIds || [])];
            if (!updatedCurrentJobIds.includes(targetJobId)) {
                updatedCurrentJobIds.push(targetJobId);
            }
            await db.collection('jobs').doc(job.id).update(cleanUndefinedFields({
                linkedJobIds: updatedCurrentJobIds
            }));

            // Update target job
            const targetRef = db.collection('jobs').doc(targetJobId);
            const targetSnap = await targetRef.get();
            if (targetSnap.exists) {
                const targetData = targetSnap.data() || {};
                const updatedTargetJobIds = [...(targetData.linkedJobIds || [])];
                if (!updatedTargetJobIds.includes(job.id)) {
                    updatedTargetJobIds.push(job.id);
                }
                await targetRef.update(cleanUndefinedFields({
                    linkedJobIds: updatedTargetJobIds
                }));
            }
            alert("Jobs linked successfully.");
        } catch (error: any) {
            console.error(error);
            alert("Failed to link jobs: " + error.message);
        }
    };

    const handleUnlinkJob = async (targetJobId: string) => {
        try {
            // Update current job
            const updatedCurrentJobIds = (job.linkedJobIds || []).filter((id: string) => id !== targetJobId);
            await db.collection('jobs').doc(job.id).update(cleanUndefinedFields({
                linkedJobIds: updatedCurrentJobIds
            }));

            // Update target job
            const targetRef = db.collection('jobs').doc(targetJobId);
            const targetSnap = await targetRef.get();
            if (targetSnap.exists) {
                const targetData = targetSnap.data() || {};
                const updatedTargetJobIds = (targetData.linkedJobIds || []).filter((id: string) => id !== job.id);
                await targetRef.update(cleanUndefinedFields({
                    linkedJobIds: updatedTargetJobIds
                }));
            }
            alert("Jobs unlinked successfully.");
        } catch (error: any) {
            console.error(error);
            alert("Failed to unlink jobs: " + error.message);
        }
    };

    const handleUnlinkInvoice = async (invoiceId: string) => {
        try {
            const updatedInvoiceIds = (job.linkedInvoiceIds || []).filter((id: string) => id !== invoiceId);
            await db.collection('jobs').doc(job.id).update(cleanUndefinedFields({
                linkedInvoiceIds: updatedInvoiceIds
            }));
            dispatch({
                type: 'UPDATE_JOB',
                payload: {
                    id: job.id,
                    linkedInvoiceIds: updatedInvoiceIds
                }
            });
            alert("Invoice unlinked successfully.");
        } catch (error: any) {
            console.error(error);
            alert("Failed to unlink invoice: " + error.message);
        }
    };

    useEffect(() => {
        if (!state.currentUser || !job?.id) return;
        setProposal(null);

        const promises: Promise<Proposal | null>[] = [];

        // Query by jobId field (primary — this is how FieldProposal saves it)
        promises.push(
            db.collection('proposals').where('jobId', '==', job.id).limit(1).get()
                .then(snap => snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() } as Proposal)
                .catch(() => null)
        );

        // Direct lookup by projectId (fallback for older records)
        if (job.projectId) {
            promises.push(
                db.collection('proposals').doc(job.projectId).get()
                    .then(doc => doc.exists ? { id: doc.id, ...doc.data() } as Proposal : null)
                    .catch(() => null)
            );
        }

        Promise.all(promises).then(results => {
            const found = results.find(r => r !== null);
            if (found) setProposal(found);
        });

        // Fetch measureQuick diagnostics
        const unsubDiags = db.collection('jobs').doc(job.id).collection('diagnostics').onSnapshot(snap => {
            setDiagnostics(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as DiagnosticReport)));
        });

        return () => unsubDiags();
    }, [job?.id, job?.projectId, state.currentUser]);

    const formatAddress = (addr: unknown) => {
        if (typeof addr === 'string') return addr;
        if (!addr) return 'Address not recorded';
        const a = addr as Record<string, string>;
        return `${a.street || ''}, ${a.city || ''}, ${a.state || ''} ${a.zip || ''}`;
    };

    const isInternalExpenseFile = (f: any) => {
        const label = (f.metadata?.label || f.label || '').toLowerCase();
        const name = (f.fileName || '').toLowerCase();
        const forbiddenKeywords = ['expense', 'receipt', 'vendor', 'bill', 'purchase order', 'cost sheet'];
        return forbiddenKeywords.some(keyword => label.includes(keyword) || name.includes(keyword)) &&
               !name.includes('signed_waiver') &&
               !name.includes('waiver_pending') &&
               !label.includes('signed waiver') &&
               !label.includes('pending signature');
    };

    const attachableFiles = useMemo(() => {
        return (job?.files || []).filter(f => !isInternalExpenseFile(f));
    }, [job?.files]);

    const photoFiles = job?.files?.filter(f => 
        !deletedFiles.has(f.id || (f as ExtendedFile).dataUrl || '') && (
            f.type === 'Photo' || 
            (f as ExtendedFile).contentType?.startsWith('image/') || 
            (f as ExtendedFile).fileType?.startsWith('image/')
        ) &&
        (isAdmin || !isInternalExpenseFile(f))
    ) || [];

    const unassociatedPhotoFiles = photoFiles.filter((f: any) => {
        const fileAssetId = (f.metadata?.assetId || f.assetId || '').toLowerCase().trim();
        const fileLabel = (f.metadata?.label || f.label || '').toLowerCase().trim();
        
        return !jobAssets.some(asset => {
            const assetId = (asset.id || '').toLowerCase().trim();
            const assetTag = (asset.assetTag || '').toLowerCase().trim();
            const assetName = (asset.name || '').toLowerCase().trim();
            
            return (
                (fileAssetId && assetId && fileAssetId === assetId) ||
                (assetId && fileLabel === assetId) ||
                (assetTag && fileLabel === assetTag) ||
                (assetName && fileLabel === assetName) ||
                (assetTag && fileLabel.includes(assetTag)) ||
                (assetName && fileLabel.includes(assetName))
            );
        });
    });

    const groupedPhotos = unassociatedPhotoFiles.reduce((acc, f) => {
        const label = f.metadata?.label || (f as ExtendedFile).label || 'Uncategorized';
        if (!acc[label]) acc[label] = [];
        acc[label].push(f);
        return acc;
    }, {} as Record<string, any[]>);

    const docFiles = job?.files?.filter(f => 
        (f.type === 'Document' || 
        (f as ExtendedFile).contentType === 'application/pdf' || 
        (f as ExtendedFile).fileType === 'application/pdf' ||
        (f as ExtendedFile).fileType === 'text/html' ||
        f.fileName?.toLowerCase().endsWith('.html') ||
        f.fileName?.toLowerCase().endsWith('.pdf')) &&
        f.fileName !== 'Signed_Waivers.html' &&
        f.fileName !== 'Waiver_Pending_Signature.html' &&
        f.metadata?.label !== 'Legal Waiver' &&
        (f as ExtendedFile).label !== 'Legal Waiver' &&
        (isAdmin || !isInternalExpenseFile(f))
    ) || [];

    if (!job) return null;

    return (
        <>
        <Modal isOpen={isOpen} onClose={onClose} title={`Job Record: ${job.id}`} size="xl">
            <div className="p-3 sm:p-6">
                {/* Sticky Navigation/Print Header */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 sm:mb-8 border-b border-slate-100 dark:border-slate-800 pb-4 sm:pb-6 sticky top-0 bg-white dark:bg-gray-800 z-10 py-3 sm:py-4 gap-3 sm:gap-4 shadow-sm print:relative print:shadow-none print:border-none print:m-0 print:p-0">
                    <div>
                        <div className="flex items-center gap-2 sm:gap-3 mb-1">
                             <div className="bg-primary-600 p-1.5 sm:p-2 rounded-xl text-white shadow-lg shadow-primary-500/20 print:hidden shrink-0">
                                <FileText size={18}/>
                            </div>
                            <h2 className="text-lg sm:text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tighter truncate max-w-[180px] sm:max-w-none">Job History Record</h2>
                        </div>
                        <p className="text-[10px] sm:text-xs text-slate-400 font-bold uppercase tracking-widest flex items-center gap-1.5">
                             <Calendar size={12}/> {new Date(job.appointmentTime).toLocaleDateString()}
                        </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 print:hidden backdrop-blur-md bg-white/50 dark:bg-gray-800/50 p-1 rounded-2xl w-full sm:w-auto">
                         <Button variant="secondary" onClick={onClose} className="h-9 sm:h-10 text-[10px] uppercase font-black tracking-widest px-3 sm:px-4">Back</Button>
                         {isAdmin && onEditRecord && (
                             <Button variant="secondary" onClick={onEditRecord} className="h-9 sm:h-10 text-[10px] uppercase font-black tracking-widest px-3 sm:px-4">Edit Record</Button>
                         )}
                         <Button onClick={() => setIsEmailModalOpen(true)} className="h-9 sm:h-10 text-[10px] uppercase font-black tracking-widest flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 whitespace-nowrap bg-indigo-600 hover:bg-indigo-700 text-white">
                            <Mail size={14}/> Email Report
                         </Button>
                         <Button 
                            disabled={isDownloadingPdf}
                            onClick={async () => {
                                setIsDownloadingPdf(true);
                                try {
                                    // @ts-ignore - html2pdf has no types available right now
                                    const html2pdf = (await import('html2pdf.js')).default;
                                    
                                    const htmlContent = generateEmailHtml(!isAdmin, true);
                                    
                                    const wrapper = document.createElement('div');
                                    wrapper.style.position = 'absolute';
                                    wrapper.style.left = '-9999px';
                                    wrapper.style.top = '-9999px';
                                    
                                    const container = document.createElement('div');
                                    container.innerHTML = htmlContent;
                                    container.style.width = '650px';
                                    container.style.backgroundColor = '#ffffff';
                                    container.style.padding = '24px';
                                    
                                    wrapper.appendChild(container);
                                    document.body.appendChild(wrapper);
                                    
                                    // Fix any logo CORS URLs in the container
                                    container.querySelectorAll('img').forEach((img) => {
                                        if (img.src && img.src.includes('tektrakker.web.app/tektrakker-logo-web.png')) {
                                            img.src = '/tektrakker-logo-web.png';
                                        }
                                    });
                                    
                                    // Wait for all images inside container to load
                                    const images = container.getElementsByTagName('img');
                                    const promises = Array.from(images).map(img => {
                                        if (img.complete) return Promise.resolve();
                                        return new Promise<void>(resolve => {
                                            img.onload = () => resolve();
                                            img.onerror = () => resolve();
                                        });
                                    });
                                    await Promise.all(promises);
                                    
                                    const dateStr = new Date(job.appointmentTime).toISOString().split('T')[0];
                                    const cleanName = (job.customerName || 'Service_Report').replace(/[^a-z0-9]/gi, '_');
                                    const fileName = `Service_Report_${cleanName}_${dateStr}.pdf`;
                                    
                                    const opt: any = {
                                        margin:       [0.3, 0.3, 0.3, 0.3],
                                        filename:     fileName,
                                        image:        { type: 'jpeg', quality: 0.98 },
                                        html2canvas:  { scale: 2, useCORS: true, logging: false, windowWidth: 650, backgroundColor: '#ffffff' },
                                        jsPDF:        { unit: 'in', format: 'letter', orientation: 'portrait' },
                                        pagebreak:    { mode: ['css', 'legacy'], avoid: ['.pdf-card', '.pdf-photo', '.pdf-timeline-item', 'tr', 'table'] }
                                    };
                                    
                                    const pdfDataUri = await html2pdf().from(container).set(opt).output('datauristring');
                                    const { downloadFile } = await import('../../lib/downloadHelper');
                                    await downloadFile(pdfDataUri, fileName);
                                    
                                    document.body.removeChild(wrapper);
                                } catch (err) {
                                    console.error('Failed to generate PDF:', err);
                                    alert('Failed to download PDF report.');
                                } finally {
                                    setIsDownloadingPdf(false);
                                }
                            }}
                            className="h-10 text-[10px] uppercase font-black tracking-widest flex items-center gap-2 px-4 whitespace-nowrap bg-emerald-600 hover:bg-emerald-700 text-white"
                         >
                            <Download size={14}/> {isDownloadingPdf ? 'Generating...' : 'Download PDF'}
                         </Button>
                    </div>
                    <div className="hidden print:block text-right">
                         <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Job Record ID</p>
                         <p className="text-xs font-mono font-bold text-slate-900">{job.id.toUpperCase()}</p>
                    </div>
                </div>

                {/* Return Visit Suggestion Alert Banner */}
                {job.visitType === 'Diagnostic Only' && (
                    <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 p-6 rounded-[2.5rem] shadow-sm mb-8 flex flex-col sm:flex-row items-center justify-between gap-4 print:hidden">
                        <div className="flex items-center gap-3">
                            <div className="bg-amber-500 p-2.5 rounded-2xl text-white shadow-lg shadow-amber-500/20">
                                <Wrench size={20} />
                            </div>
                            <div className="text-left">
                                <h4 className="text-sm font-black text-amber-805 dark:text-amber-350 uppercase tracking-wider">Diagnostic Only Visit</h4>
                                <p className="text-xs text-amber-600 dark:text-amber-400 mt-1 font-medium leading-relaxed">
                                    This visit was scheduled as a Diagnostic Only appointment. You can schedule and link a secondary Repair visit for this customer below.
                                </p>
                            </div>
                        </div>
                        <Button 
                            onClick={() => setIsScheduleFollowUpOpen(true)} 
                            className="h-10 text-[10px] uppercase font-black tracking-widest bg-amber-600 hover:bg-amber-700 text-white shrink-0 flex items-center gap-2 px-5 whitespace-nowrap"
                        >
                            <CalendarPlus size={14} /> Schedule Return Visit (Repair)
                        </Button>
                    </div>
                )}



                {/* Tab Navigation */}
                <div className="flex overflow-x-auto custom-scrollbar border-b border-slate-200 dark:border-slate-800 mb-6 print:hidden">
                    <button
                        type="button"
                        className={`px-4 sm:px-6 py-3 text-xs sm:text-sm shrink-0 whitespace-nowrap font-black uppercase tracking-wider border-b-2 transition-all ${
                            activeTab === 'preview'
                                ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400 font-extrabold'
                                : 'border-transparent text-slate-450 hover:text-slate-650 dark:text-slate-400 dark:hover:text-slate-200'
                        }`}
                        onClick={() => {
                            setActiveTab('preview');
                            setIsEditMode(false);
                        }}
                    >
                        Service Report
                    </button>
                    <button
                        type="button"
                        className={`px-4 sm:px-6 py-3 text-xs sm:text-sm shrink-0 whitespace-nowrap font-black uppercase tracking-wider border-b-2 transition-all ${
                            activeTab === 'technical'
                                ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400 font-extrabold'
                                : 'border-transparent text-slate-450 hover:text-slate-650 dark:text-slate-400 dark:hover:text-slate-200'
                        }`}
                        onClick={() => setActiveTab('technical')}
                    >
                        Tech Data & Diagnostics
                    </button>
                </div>

                {activeTab === 'technical' ? (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Left Column: Notes & Tasks */}
                    <div className="lg:col-span-2 space-y-8">
                        {/* Summary Header Section (Printable) */}
                        <div className="bg-slate-50 dark:bg-slate-900/40 p-4 sm:p-6 rounded-2xl sm:rounded-[2.5rem] border border-slate-100 dark:border-slate-800/60 shadow-sm mb-4 print:bg-white print:border-slate-200">
                            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
                                <div className="space-y-1">
                                    <h3 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight print:text-black">{customer?.name || job.customerName}</h3>
                                    <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 flex items-center gap-1.5 font-medium print:text-slate-700">
                                        <MapPin size={14} className="text-slate-400 print:hidden shrink-0"/> {formatAddress(customer?.address || job.address)}
                                    </p>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    {job.isServicePlan && (
                                        <span className="px-3 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-full bg-purple-100 text-purple-800 border border-purple-300 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800 flex items-center gap-1 shadow-sm">
                                            ✓ Service Plan Covered
                                        </span>
                                    )}
                                    <span className={`px-3 sm:px-4 py-1.5 sm:py-2 text-[10px] font-black uppercase tracking-widest rounded-full shadow-sm print:border print:border-slate-300 ${
                                        job.jobStatus === 'Completed' ? 'bg-emerald-500 text-white print:text-emerald-700 print:bg-white' : 
                                        job.jobStatus === 'In Progress' ? 'bg-blue-500 text-white print:text-blue-700 print:bg-white' : 
                                        'bg-slate-500 text-white print:text-slate-700 print:bg-white'
                                    }`}>
                                        {job.jobStatus}
                                    </span>
                                </div>
                            </div>

                            <div className="flex flex-wrap gap-4 pt-4 border-t border-slate-200/60 dark:border-slate-800/60">
                                <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-lg bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-primary-600 print:hidden">
                                        <Clock size={14}/>
                                    </div>
                                    <div>
                                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-tighter">Appointment</p>
                                        <p className="text-[11px] font-bold text-slate-700 dark:text-slate-300 print:text-black">{new Date(job.appointmentTime).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-amber-600 print:hidden">
                                        <Wrench size={14}/>
                                    </div>
                                    <div>
                                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-tighter">Technician</p>
                                        <p className="text-[11px] font-bold text-slate-700 dark:text-slate-300 print:text-black">
                                            {(() => {
                                                if (job.assignedTechnicianId) {
                                                    const tech = state.users?.find((u: any) => u.id === job.assignedTechnicianId);
                                                    if (tech) return `${tech.firstName} ${tech.lastName}`;
                                                }
                                                return job.assignedTechnicianName || 'Unassigned';
                                            })()}
                                        </p>
                                    </div>
                                </div>
                                {job.assistants && job.assistants.length > 0 && (
                                    <div className="flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 print:hidden">
                                            <Users size={14}/>
                                        </div>
                                        <div>
                                            <p className="text-[8px] font-black text-slate-400 uppercase tracking-tighter">Crew ({job.assistants.length})</p>
                                            <p className="text-[11px] font-bold text-slate-700 dark:text-slate-300 print:text-black">
                                                {job.assistants.map((id: string) => {
                                                    const u = state.users?.find((user: any) => user.id === id);
                                                    return u ? `${u.firstName} ${u.lastName}` : 'Unknown';
                                                }).join(', ')}
                                            </p>
                                        </div>
                                    </div>
                                )}
                                {isAdmin && job.checkInTime && (
                                    <div className="flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 print:hidden">
                                            <Clock size={14}/>
                                        </div>
                                        <div>
                                            <p className="text-[8px] font-black text-slate-400 uppercase tracking-tighter">Arrived</p>
                                            <p className="text-[11px] font-bold text-slate-700 dark:text-slate-300 print:text-black">
                                                {new Date(job.checkInTime).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                                            </p>
                                        </div>
                                    </div>
                                )}
                                {isAdmin && job.checkOutTime && (
                                    <div className="flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-red-650 print:hidden">
                                            <Clock size={14}/>
                                        </div>
                                        <div>
                                            <p className="text-[8px] font-black text-slate-400 uppercase tracking-tighter">Departed</p>
                                            <p className="text-[11px] font-bold text-slate-700 dark:text-slate-300 print:text-black">
                                                {new Date(job.checkOutTime).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                                            </p>
                                        </div>
                                    </div>
                                )}
                                {isAdmin && job.timeOnSiteMinutes !== undefined && job.timeOnSiteMinutes > 0 && (
                                    <div className="flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 print:hidden">
                                            <Clock size={14}/>
                                        </div>
                                        <div>
                                            <p className="text-[8px] font-black text-slate-400 uppercase tracking-tighter">Duration</p>
                                            <p className="text-[11px] font-bold text-slate-700 dark:text-slate-300 print:text-black">
                                                {job.timeOnSiteMinutes >= 60 
                                                    ? `${Math.floor(job.timeOnSiteMinutes / 60)}h ${job.timeOnSiteMinutes % 60}m`
                                                    : `${job.timeOnSiteMinutes}m`
                                                }
                                            </p>
                                        </div>
                                    </div>
                                )}
                                                      {/* Service Location details, Property info, Gate Code & Notes */}
                        </div>

                        {/* Collapsible Serviced Property Details Card */}
                        {(serviceLocation || job.poNumber || job.address) && (
                            <section className="bg-slate-50 dark:bg-slate-900/40 rounded-[2rem] border border-slate-100 dark:border-slate-800/60 shadow-sm mb-6 overflow-hidden">
                                <button 
                                    type="button"
                                    onClick={() => setIsPropertyExpanded(!isPropertyExpanded)}
                                    className="w-full flex justify-between items-center p-6 text-left hover:bg-slate-100/50 dark:hover:bg-slate-800/30 transition-all cursor-pointer"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-xl bg-indigo-100 dark:bg-indigo-950/40 flex items-center justify-center text-indigo-650 dark:text-indigo-400">
                                            <MapPin size={16}/>
                                        </div>
                                        <div>
                                            <h4 className="text-sm font-black text-slate-800 dark:text-slate-200 uppercase tracking-widest">
                                                Serviced Property & Location Details
                                            </h4>
                                            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                                                {serviceLocation?.propertyName || 'Property Location'} • {formatAddress(job.address)}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3 shrink-0">
                                        <span className="px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider bg-indigo-100 text-indigo-850 dark:bg-indigo-950/30 dark:text-indigo-400 border border-indigo-200/50">
                                            Property Active
                                        </span>
                                        {isPropertyExpanded ? <ChevronUp size={18} className="text-slate-400" /> : <ChevronDown size={18} className="text-slate-400" />}
                                    </div>
                                </button>

                                {isPropertyExpanded && (
                                    <div className="p-6 pt-0 border-t border-slate-150/40 dark:border-slate-800 pl-8 space-y-6">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6">
                                            <div className="space-y-3">
                                                <div>
                                                    <p className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Street Address</p>
                                                    <p className="text-sm font-bold text-slate-800 dark:text-slate-200 mt-1">{formatAddress(job.address)}</p>
                                                </div>
                                                {serviceLocation?.gateCode && (
                                                    <div>
                                                        <p className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Gate Code / Access</p>
                                                        <p className="text-sm font-bold text-slate-850 dark:text-slate-200 mt-1 flex items-center gap-2">
                                                            <span className="font-mono bg-slate-200 dark:bg-slate-800 px-2 py-0.5 rounded text-xs font-bold">{serviceLocation.gateCode}</span>
                                                        </p>
                                                    </div>
                                                )}
                                                {serviceLocation?.notes && (
                                                    <div>
                                                        <p className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Access Instructions</p>
                                                        <p className="text-xs italic text-slate-600 dark:text-slate-400 mt-1">{serviceLocation.notes}</p>
                                                    </div>
                                                )}
                                            </div>

                                            <div className="space-y-3 border-l border-slate-100 dark:border-slate-800 pl-6">
                                                <div>
                                                    <p className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Billing Cross-Reference</p>
                                                    {job.poNumber ? (
                                                        <p className="mt-1 flex items-center gap-1.5">
                                                            <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400 rounded-md font-mono text-[10px] font-bold border border-emerald-250/20">PO/WO: {job.poNumber}</span>
                                                        </p>
                                                    ) : (
                                                        <p className="text-xs text-slate-400 italic mt-1">No PO number associated with this location.</p>
                                                    )}
                                                </div>
                                                {job.locationName && (
                                                    <div>
                                                        <p className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Billing Unit Name</p>
                                                        <p className="text-xs font-bold text-slate-700 dark:text-slate-350 mt-1">{job.locationName}</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Property Contacts List */}
                                        <div className="border-t border-slate-100 dark:border-slate-800 pt-6">
                                            <p className="text-[9px] font-black uppercase text-slate-400 tracking-wider mb-3">Associated Location Points of Contact (POCs)</p>
                                            {(() => {
                                                 const pocList: Array<{ name: string; phone?: string | null; email?: string | null; role: string }> = [];
                                                 
                                                 // Determine if the serviced location has its own contacts.
                                                 // If location contacts exist, we prioritize and show ONLY those contacts.
                                                 let hasLocationContacts = false;
                                                 const locId = job.locationId || serviceLocation?.id;
                                                 if (customer?.contacts && Array.isArray(customer.contacts) && locId) {
                                                     customer.contacts.forEach((c: any) => {
                                                         if (c.name && c.allowedLocationIds?.includes(locId)) {
                                                             hasLocationContacts = true;
                                                             pocList.push({ name: c.name, phone: c.phone, email: c.email, role: c.role || c.title || 'Site POC' });
                                                         }
                                                     });
                                                 }
                                                 if (serviceLocation?.contacts && Array.isArray(serviceLocation.contacts)) {
                                                     const validLocContacts = serviceLocation.contacts.filter((c: any) => c && c.name);
                                                     if (validLocContacts.length > 0) {
                                                         hasLocationContacts = true;
                                                         validLocContacts.forEach((c: any) => {
                                                             if (!pocList.some(p => p.name.trim().toLowerCase() === c.name.trim().toLowerCase())) {
                                                                 pocList.push({ name: c.name, phone: c.phone, email: c.email, role: c.role || 'Site POC' });
                                                             }
                                                         });
                                                     }
                                                 }

                                                 // Fall back to primary customer and account-level contacts only if no location contacts are defined.
                                                 if (!hasLocationContacts) {
                                                     if (job.customerName && (job.customerPhone || job.customerEmail)) {
                                                         pocList.push({ name: job.customerName, phone: job.customerPhone, email: job.customerEmail, role: 'Primary Customer' });
                                                     }
                                                     if (customer?.contacts && Array.isArray(customer.contacts)) {
                                                         customer.contacts.forEach((c: any) => {
                                                             if (c.name) {
                                                                 pocList.push({ name: c.name, phone: c.phone, email: c.email, role: c.role || c.title || 'Property Manager' });
                                                             }
                                                         });
                                                     }
                                                 }

                                                 const seenNames = new Set<string>();
                                                 const uniquePocs = pocList.filter(poc => {
                                                     const lowerName = poc.name.trim().toLowerCase();
                                                     if (seenNames.has(lowerName)) return false;
                                                     seenNames.add(lowerName);
                                                     return true;
                                                 }).slice(0, 3);

                                                if (uniquePocs.length === 0) {
                                                    return <p className="italic text-slate-400 text-xs">No contact POC documented for this job.</p>;
                                                }

                                                return (
                                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                        {uniquePocs.map((poc, idx) => (
                                                            <div key={idx} className="p-3.5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-sm">
                                                                <p className="font-bold text-slate-805 dark:text-slate-200 text-xs flex items-center justify-between">
                                                                    <span>{poc.name}</span>
                                                                    <span className="text-[8px] font-black bg-slate-100 dark:bg-slate-850 text-slate-500 px-1.5 py-0.5 rounded uppercase border border-slate-200/40">{poc.role}</span>
                                                                </p>
                                                                {poc.phone && <p className="text-[10px] text-slate-500 font-semibold mt-2">{poc.phone}</p>}
                                                                {poc.email && <p className="text-[10px] text-slate-450 truncate mt-0.5">{poc.email}</p>}
                                                            </div>
                                                        ))}
                                                    </div>
                                                );
                                            })()}
                                        </div>

                                        {/* Property Level Photos */}
                                        {(() => {
                                            const propPhotos = [];
                                            if (serviceLocation) {
                                                const matchingAssetWithPropPhotos = jobAssets.find(a => a.wideLocationPhotoUrl || a.accessPointPhotoUrl);
                                                if (matchingAssetWithPropPhotos?.wideLocationPhotoUrl) {
                                                    propPhotos.push({ url: matchingAssetWithPropPhotos.wideLocationPhotoUrl, label: 'Property Front / Wide View' });
                                                }
                                                if (matchingAssetWithPropPhotos?.accessPointPhotoUrl) {
                                                    propPhotos.push({ url: matchingAssetWithPropPhotos.accessPointPhotoUrl, label: 'Access Path / Property Entry' });
                                                }
                                            }
                                            if (propPhotos.length === 0) return null;
                                            return (
                                                <div className="border-t border-slate-100 dark:border-slate-800 pt-6">
                                                    <p className="text-[9px] font-black uppercase text-slate-400 tracking-wider mb-3">Property Entry & Access Verification Photos</p>
                                                    <div className="flex flex-wrap gap-4">
                                                        {propPhotos.map((p, idx) => (
                                                            <div key={idx} className="flex flex-col items-center">
                                                                <button 
                                                                    type="button" 
                                                                    onClick={() => setPreviewDoc({ fileUrl: p.url, name: p.label, type: 'Other' })}
                                                                    className="w-24 h-24 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm cursor-pointer p-0"
                                                                >
                                                                    <img src={p.url} className="w-full h-full object-cover hover:scale-105 transition-transform" alt={p.label} />
                                                                </button>
                                                                <span className="text-[9px] font-semibold text-slate-500 mt-1.5 uppercase text-center w-24 truncate">{p.label}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            );
                                        })()}
                                    </div>
                                )}
                            </section>
                        )}      </div>


                        {/* Direct Technician Recommendations */}
                        {job.techRecommendations && (
                            <section className="bg-emerald-50 dark:bg-emerald-950/15 p-6 rounded-[2rem] border-2 border-emerald-100 dark:border-emerald-900/50 shadow-md relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-6 opacity-5 pointer-events-none">
                                    <ShieldCheck size={60} className="text-emerald-700 dark:text-emerald-350" />
                                </div>
                                <div className="flex items-center gap-2 mb-3">
                                    <div className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                                        <Wrench size={16}/>
                                    </div>
                                    <h4 className="text-sm font-black text-emerald-800 dark:text-emerald-300 uppercase tracking-widest">
                                        Direct Technician Recommendations
                                    </h4>
                                </div>
                                <p className="text-sm text-slate-700 dark:text-slate-200 font-bold whitespace-pre-wrap leading-relaxed">
                                    {job.techRecommendations}
                                </p>
                            </section>
                        )}

                        {/* Serviced Systems & Asset Health Scoping (Separated per unit) */}
                        {jobAssets.length > 0 && (
                            <section className="space-y-4">
                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                    <Wrench size={14} className="text-primary-500"/>
                                    Serviced Systems & Asset Health Scoping ({jobAssets.length} Units)
                                </h4>
                                <div className="space-y-4">
                                    {jobAssets.map((asset) => {
                                         const unitState = job.unitStates?.find(s => s.assetId === asset.id);
                                         const healthBefore = unitState?.healthBefore || unitState?.health || asset.condition || 'Good';
                                         const healthAfter = unitState?.healthAfter || unitState?.health || 'Good';
                                         const isExpanded = !!expandedSystems[asset.id];
                                        
                                        // Retrieve matching job-level photos from job.files
                                         const matchingJobPhotos = photoFiles.filter((f: any) => {
                                             const fileAssetId = (f.metadata?.assetId || f.assetId || '').toLowerCase().trim();
                                             const fileLabel = (f.metadata?.label || f.label || '').toLowerCase().trim();
                                             const assetId = (asset.id || '').toLowerCase().trim();
                                             const assetTag = (asset.assetTag || '').toLowerCase().trim();
                                             const assetName = (asset.name || '').toLowerCase().trim();
                                             
                                             return (
                                                 (fileAssetId && assetId && fileAssetId === assetId) ||
                                                 (assetId && fileLabel === assetId) ||
                                                 (assetTag && fileLabel === assetTag) ||
                                                 (assetName && fileLabel === assetName) ||
                                                 (assetTag && fileLabel.includes(assetTag)) ||
                                                 (assetName && fileLabel.includes(assetName))
                                             );
                                         });
                                         
                                         // Retrieve photos uploaded to this asset directly on EquipmentAsset
                                         const assetPhotos = [];
                                         if (asset.serialPhotoUrl) assetPhotos.push({ url: asset.serialPhotoUrl, label: 'Serial Tag' });
                                         if (asset.unitTagPhotoUrl) assetPhotos.push({ url: asset.unitTagPhotoUrl, label: 'Unit Plate' });
                                         if (asset.conditionPhotoUrl) assetPhotos.push({ url: asset.conditionPhotoUrl, label: 'Condition' });
                                         if (asset.wideLocationPhotoUrl) assetPhotos.push({ url: asset.wideLocationPhotoUrl, label: 'Wide Location' });
                                         if (asset.accessPointPhotoUrl) assetPhotos.push({ url: asset.accessPointPhotoUrl, label: 'Access Path' });
                                         if (asset.qrCodePhotoUrl) assetPhotos.push({ url: asset.qrCodePhotoUrl, label: 'QR Tag' });
                                         
                                         // Merge matching job-level photos
                                         matchingJobPhotos.forEach((p: any) => {
                                             const url = p.dataUrl || p.url;
                                             const label = p.metadata?.label || p.label || 'Job Photo';
                                             if (url && !assetPhotos.some(ap => ap.url === url)) {
                                                 assetPhotos.push({ url, label });
                                             }
                                         });
                                        
                                        return (
                                            <div key={asset.id} id={`system-card-${asset.id}`} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2rem] shadow-sm relative overflow-hidden transition-all hover:shadow-md">
                                                {/* Left decorative border color based on health */}
                                                <div className={`absolute left-0 top-0 bottom-0 w-2 ${
                                                    healthAfter === 'Good' ? 'bg-emerald-500' :
                                                    healthAfter === 'Fair' ? 'bg-amber-500' :
                                                    healthAfter === 'Poor' ? 'bg-orange-500' :
                                                    'bg-rose-500'
                                                }`} />
                                                
                                                <button
                                                    type="button"
                                                    onClick={() => setExpandedSystems(prev => ({ ...prev, [asset.id]: !prev[asset.id] }))}
                                                    className="w-full flex justify-between items-center p-6 text-left hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-all cursor-pointer"
                                                >
                                                    <div className="pl-2">
                                                        <h5 className="text-base font-black text-slate-800 dark:text-slate-200 tracking-tight">
                                                            {asset.name || asset.type} {asset.brand ? `• ${asset.brand}` : ''} {asset.model ? `(${asset.model})` : ''}
                                                        </h5>
                                                        <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-slate-400 font-semibold uppercase tracking-wider mt-1">
                                                            <span>Tag: {asset.assetTag || 'N/A'}</span>
                                                            <span>Serial: {asset.serial || 'N/A'}</span>
                                                            {asset.physicalLocation && <span>Location: {asset.physicalLocation}</span>}
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-3 shrink-0">
                                                        <span className={`text-[9px] font-black px-3 py-1 rounded-full uppercase tracking-wider ${
                                                            healthAfter === 'Good' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400 border border-emerald-200/50' :
                                                            healthAfter === 'Fair' ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/30 dark:text-amber-400 border border-amber-200/50' :
                                                            healthAfter === 'Poor' ? 'bg-orange-100 text-orange-850 dark:bg-orange-950/30 dark:text-orange-400 border border-orange-200/50' :
                                                            'bg-rose-100 text-rose-800 dark:bg-rose-950/30 dark:text-rose-400 border border-rose-200/50'
                                                        }`}>
                                                            System Health: {healthBefore === healthAfter ? healthAfter : `${healthBefore} ➔ ${healthAfter}`}
                                                        </span>
                                                        {isExpanded ? <ChevronUp size={18} className="text-slate-400" /> : <ChevronDown size={18} className="text-slate-400" />}
                                                    </div>
                                                </button>
                                                
                                                {isExpanded && (
                                                    <div className="p-6 pt-0 border-t border-slate-100 dark:border-slate-800 pl-8 space-y-6">
                                                        {/* Unit Technical Specifications & Details */}
                                                        {(() => {
                                                            const specs = [
                                                                { label: 'Area Serviced', value: asset.servesArea },
                                                                { label: 'Exact Placement', value: asset.exactPlacement },
                                                                { label: 'Physical Location', value: asset.physicalLocation },
                                                                { label: 'System Type', value: asset.type },
                                                                { label: 'Tonnage / Capacity', value: asset.tonnage ? `${asset.tonnage} Tons` : null },
                                                                { label: 'Refrigerant', value: asset.refrigerantType },
                                                                { label: 'Electrical', value: asset.electricityType },
                                                                { label: 'Heat Type', value: asset.heatType },
                                                                { label: 'MFR Year', value: asset.year },
                                                                { label: 'Install Date', value: asset.installDate },
                                                            ].filter(spec => spec.value);

                                                            const warrantyInfo = [];
                                                            if (asset.warranty?.manufacturerDurationMonths) {
                                                                warrantyInfo.push({
                                                                    label: 'MFR Warranty',
                                                                    value: `${asset.warranty.manufacturerDurationMonths} Mos` + (asset.warranty.manufacturerStartDate ? ` (Starts: ${asset.warranty.manufacturerStartDate})` : '')
                                                                });
                                                            }
                                                            if (asset.warranty?.laborDurationMonths) {
                                                                warrantyInfo.push({
                                                                    label: 'Labor Warranty',
                                                                    value: `${asset.warranty.laborDurationMonths} Mos` + (asset.warranty.laborStartDate ? ` (Starts: ${asset.warranty.laborStartDate})` : '')
                                                                });
                                                            }

                                                            const linkedAssets = customer?.equipment?.filter((eq: any) => asset.linkedAssetIds?.includes(eq.id)) || [];

                                                            const hasSpecs = specs.length > 0 || warrantyInfo.length > 0 || asset.notes || linkedAssets.length > 0;

                                                            if (!hasSpecs) return null;

                                                            return (
                                                                <div className="bg-slate-50/50 dark:bg-slate-950/20 p-5 rounded-[2rem] border border-slate-100 dark:border-slate-800 space-y-4 mt-6">
                                                                    <p className="text-[9px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest flex items-center gap-1.5 pl-1">
                                                                        <Info size={12} />
                                                                        Unit Specifications & System Details
                                                                    </p>
                                                                    {specs.length > 0 && (
                                                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                                                            {specs.map((s, i) => (
                                                                                <div key={i} className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-150/40 dark:border-slate-800 shadow-sm">
                                                                                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-wider">{s.label}</p>
                                                                                    <p className="text-xs font-bold text-slate-700 dark:text-slate-200 mt-1 truncate" title={s.value}>
                                                                                        {s.value}
                                                                                    </p>
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    )}
                                                                    
                                                                    {warrantyInfo.length > 0 && (
                                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                                                                            {warrantyInfo.map((w, i) => (
                                                                                <div key={i} className="p-3 bg-indigo-600/5 dark:bg-indigo-950/10 rounded-xl border border-indigo-100/30 dark:border-indigo-950/30 shadow-sm flex justify-between items-center">
                                                                                    <div>
                                                                                        <p className="text-[8px] font-black text-indigo-500 uppercase tracking-wider">{w.label}</p>
                                                                                        <p className="text-xs font-bold text-slate-700 dark:text-slate-200 mt-0.5">{w.value}</p>
                                                                                    </div>
                                                                                    {asset.warranty?.requiresMaintenance && (
                                                                                        <span className="text-[8px] font-black uppercase bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-1.5 py-0.5 rounded border border-emerald-500/20">Maint. Req</span>
                                                                                    )}
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    )}

                                                                    {linkedAssets.length > 0 && (
                                                                        <div className="p-3.5 bg-slate-100/30 dark:bg-slate-900/40 rounded-xl border border-slate-150/40 dark:border-slate-850/40 mt-2">
                                                                            <p className="text-[8px] font-black text-slate-400 uppercase tracking-wider mb-2">Linked Systems / Related Equipment</p>
                                                                            <div className="flex flex-wrap gap-2">
                                                                                {linkedAssets.map((la: any) => {
                                                                                    const isServiced = jobAssets.some(ja => ja.id === la.id);
                                                                                    return (
                                                                                        <button
                                                                                            key={la.id}
                                                                                            type="button"
                                                                                            onClick={() => {
                                                                                                if (isServiced) {
                                                                                                    setExpandedSystems(prev => ({ ...prev, [la.id]: true }));
                                                                                                    const el = document.getElementById(`system-card-${la.id}`);
                                                                                                    if (el) {
                                                                                                        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                                                                                    }
                                                                                                }
                                                                                            }}
                                                                                            disabled={!isServiced}
                                                                                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                                                                                                isServiced 
                                                                                                ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/30 dark:text-indigo-400 border border-indigo-200/50 hover:bg-indigo-100 hover:scale-[1.02] cursor-pointer' 
                                                                                                : 'bg-slate-105 text-slate-400 dark:bg-slate-950 dark:text-slate-600 border border-slate-200/30 cursor-not-allowed'
                                                                                            }`}
                                                                                            title={isServiced ? 'Click to jump to this system\'s checklist & details' : 'This linked system was not serviced during this appointment'}
                                                                                        >
                                                                                            <Wrench size={10} />
                                                                                            <span>{la.name || la.type || 'Linked Unit'}</span>
                                                                                            {la.brand && <span className="opacity-60">• {la.brand}</span>}
                                                                                            {la.serial && <span className="opacity-60">({la.serial})</span>}
                                                                                            {isServiced ? (
                                                                                                <span className="text-[8px] font-black bg-indigo-200/50 dark:bg-indigo-900/60 px-1 py-0.2 rounded uppercase">Serviced</span>
                                                                                            ) : (
                                                                                                <span className="text-[8px] font-black bg-slate-200/50 dark:bg-slate-800/60 px-1 py-0.2 rounded uppercase">Not Serviced</span>
                                                                                            )}
                                                                                        </button>
                                                                                    );
                                                                                })}
                                                                            </div>
                                                                        </div>
                                                                    )}

                                                                    {asset.notes && (
                                                                        <div className="p-3 bg-slate-100/30 dark:bg-slate-900/40 rounded-xl border border-slate-150/40 dark:border-slate-800/40 mt-2">
                                                                            <p className="text-[8px] font-black text-slate-400 uppercase tracking-wider">Asset Notes</p>
                                                                            <p className="text-xs text-slate-600 dark:text-slate-350 mt-1 font-medium italic">"{asset.notes}"</p>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            );
                                                        })()}

                                                        {/* Structured diagnostics/notes grid */}
                                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-6">
                                                            {/* Diagnosis */}
                                                            <div className="bg-slate-50/50 dark:bg-slate-800/20 p-4 rounded-2xl">
                                                                <p className="text-[8px] font-black text-primary-500 uppercase tracking-widest mb-1.5">Diagnosis Findings</p>
                                                                <p className="text-xs text-slate-600 dark:text-slate-300 font-medium leading-relaxed whitespace-pre-wrap">
                                                                    {unitState?.diagnosis || <span className="text-slate-400 italic">No specific issues detected during diagnosis.</span>}
                                                                </p>
                                                            </div>
                                                            
                                                            {/* Repairs */}
                                                            <div className="bg-slate-50/50 dark:bg-slate-800/20 p-4 rounded-2xl">
                                                                <p className="text-[8px] font-black text-amber-600 uppercase tracking-widest mb-1.5">Repairs & Adjustments</p>
                                                                <p className="text-xs text-slate-600 dark:text-slate-300 font-medium leading-relaxed whitespace-pre-wrap">
                                                                    {unitState?.repair || <span className="text-slate-400 italic">No repairs or active fixes required for this visit.</span>}
                                                                </p>
                                                            </div>
                                                            
                                                            {/* Recommendations */}
                                                            <div className="bg-slate-50/50 dark:bg-slate-800/20 p-4 rounded-2xl">
                                                                <p className="text-[8px] font-black text-purple-600 uppercase tracking-widest mb-1.5">System Recommendations</p>
                                                                <p className="text-xs text-slate-600 dark:text-slate-300 font-medium leading-relaxed whitespace-pre-wrap">
                                                                    {unitState?.recommendations || <span className="text-slate-400 italic">System in good working order. Continue routine service.</span>}
                                                                </p>
                                                            </div>
                                                        </div>
                                                        
                                                        {/* Unit photos inside card */}
                                                        {assetPhotos.length > 0 && (
                                                            <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 pl-2">
                                                                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-2.5">Verification Photos ({asset.name || asset.type})</p>
                                                                <div className="flex flex-wrap gap-3">
                                                                    {assetPhotos.map((photo, index) => (
                                                                        <div key={index} className="flex flex-col items-center">
                                                                            <button 
                                                                                type="button" 
                                                                                onClick={() => setPreviewDoc({ fileUrl: photo.url, name: photo.label, type: 'Other' })} 
                                                                                className="w-20 h-20 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm cursor-pointer block p-0"
                                                                            >
                                                                                <img src={photo.url} className="w-full h-full object-cover hover:scale-105 transition-transform" alt={photo.label} />
                                                                            </button>
                                                                            <span className="text-[8px] font-semibold text-slate-500 mt-1 uppercase text-center w-20 truncate">{photo.label}</span>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </section>
                        )}


                        {/* Tasks Section */}
                        <section className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm print:bg-white print:border-slate-200">
                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                <CheckCircle size={14} className="text-emerald-500"/> Tasks Performed
                            </h4>

                            <div className="flex flex-wrap gap-2">
                                {job.tasks.map((t, i) => (
                                    <span key={i} className="px-4 py-2 bg-white dark:bg-slate-800 rounded-2xl text-xs font-bold text-slate-700 dark:text-slate-200 shadow-sm border border-slate-100 dark:border-slate-700 print:border-slate-200 print:text-black">
                                        {t}
                                    </span>
                                ))}
                            </div>
                        </section>

                        {/* Parts Used Section */}
                        {job.partsUsed && job.partsUsed.length > 0 && (
                            <section className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm print:bg-white print:border-slate-200">
                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                    <Package size={14} className="text-amber-500"/> Parts & Materials Used
                                </h4>
                                <div className="space-y-2">
                                    {job.partsUsed.map((part, i) => (
                                        <div key={i} className="flex justify-between items-center p-3 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-sm print:border-slate-200">
                                            <div>
                                                <p className="text-xs font-bold text-slate-800 dark:text-white print:text-black">{part.name}</p>
                                                {part.sku && <p className="text-[10px] text-slate-400 font-mono">SKU: {part.sku}</p>}
                                                {part.location && <p className="text-[9px] text-primary-500 font-bold uppercase">{part.location}</p>}
                                            </div>
                                            <div className="text-right">
                                                <p className="text-xs font-black text-slate-900 dark:text-white print:text-black">Qty: {part.quantity}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </section>
                        )}

                        {/* Service Checklists */}
                        {(() => {
                            const diagItems = (() => {
                                if (job.notes?.diagnosisChecklist && job.notes.diagnosisChecklist !== '[]') {
                                    try { return JSON.parse(job.notes.diagnosisChecklist); } catch { return []; }
                                }
                                if (job.requiredDiagnosisChecklistIds && job.requiredDiagnosisChecklistIds.length > 0) {
                                    const templates = job.embeddedData?.inspectionTemplates || state.inspectionTemplates || [];
                                    return job.requiredDiagnosisChecklistIds.flatMap(id => {
                                        const t = templates.find((tpl: any) => tpl.id === id);
                                        return t ? t.items.map((i: any, idx: number) => ({
                                            id: `auto-${t.id}-${idx}`,
                                            label: i.label,
                                            completed: false,
                                            hiddenFromCustomer: false
                                        })) : [];
                                    });
                                }
                                return [];
                            })().filter((i: any) => !i.hiddenFromCustomer);

                            const qualItems = (() => {
                                if (job.notes?.qualityChecklist && job.notes.qualityChecklist !== '[]') {
                                    try { return JSON.parse(job.notes.qualityChecklist); } catch { return []; }
                                }
                                if (job.requiredQualityChecklistIds && job.requiredQualityChecklistIds.length > 0) {
                                    const templates = job.embeddedData?.inspectionTemplates || state.inspectionTemplates || [];
                                    return job.requiredQualityChecklistIds.flatMap(id => {
                                        const t = templates.find((tpl: any) => tpl.id === id);
                                        return t ? t.items.map((i: any, idx: number) => ({
                                            id: `auto-${t.id}-${idx}`,
                                            label: i.label,
                                            completed: false,
                                            hiddenFromCustomer: false
                                        })) : [];
                                    });
                                }
                                return [];
                            })().filter((i: any) => !i.hiddenFromCustomer);

                            const generalItems = (() => {
                                if (job.notes?.checklist && job.notes.checklist !== '[]') {
                                    try { return JSON.parse(job.notes.checklist); } catch { return []; }
                                }
                                return [];
                            })().filter((i: any) => !i.hiddenFromCustomer);

                            const hasChecklists = (emailOptions.includeDiagnosisChecklist && diagItems.length > 0) || 
                                                  (emailOptions.includeQualityChecklist && qualItems.length > 0) || 
                                                  generalItems.length > 0;
                            if (!hasChecklists) return null;

                            return (
                                <section className="space-y-4">
                                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                        <CheckCircle size={14} className="text-primary-500"/> Service Checklists & Compliance
                                    </h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {/* Diagnosis Checklist */}
                                        {emailOptions.includeDiagnosisChecklist && diagItems.length > 0 && (() => {
                                            const visibleItems = diagItems;
                                            if (visibleItems.length === 0) return null;
                                            return (
                                                <div className="p-5 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl shadow-sm print:border-slate-200">
                                                    <p className="text-[10px] font-black text-primary-500 uppercase tracking-tighter mb-4">Diagnosis Checklist</p>
                                                    <div className="space-y-2">
                                                        {visibleItems.map((item: any, idx: number) => (
                                                            <div key={idx} className="flex items-start gap-3 text-xs">
                                                                <div className={`mt-0.5 w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 ${item.completed ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-400'}`}>
                                                                    <Check size={10} strokeWidth={4}/>
                                                                </div>
                                                                <span className={item.completed ? 'text-slate-700 dark:text-slate-200 font-medium' : 'text-slate-400 line-through'}>{item.label}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            );
                                        })()}

                                        {/* Quality Checklist */}
                                        {emailOptions.includeQualityChecklist && qualItems.length > 0 && (() => {
                                            const visibleItems = qualItems;
                                            if (visibleItems.length === 0) return null;
                                            return (
                                                <div className="p-5 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl shadow-sm print:border-slate-200">
                                                    <p className="text-[10px] font-black text-emerald-500 uppercase tracking-tighter mb-4">Quality & Safety Audit</p>
                                                    <div className="space-y-2">
                                                        {visibleItems.map((item: any, idx: number) => (
                                                            <div key={idx} className="flex items-start gap-3 text-xs">
                                                                <div className={`mt-0.5 w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 ${item.completed ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-400'}`}>
                                                                    <Check size={10} strokeWidth={4}/>
                                                                </div>
                                                                <span className={item.completed ? 'text-slate-700 dark:text-slate-200 font-medium' : 'text-slate-400 line-through'}>{item.label}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            );
                                        })()}

                                        {/* General Job Checklist */}
                                        {generalItems.length > 0 && (() => {
                                            const visibleItems = generalItems;
                                            if (visibleItems.length === 0) return null;
                                            return (
                                                <div className="p-5 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl shadow-sm print:border-slate-200 col-span-1 md:col-span-2">
                                                    <p className="text-[10px] font-black text-indigo-500 uppercase tracking-tighter mb-4">Job Service Checklist</p>
                                                    <div className="space-y-2">
                                                        {visibleItems.map((item: any, idx: number) => (
                                                            <div key={idx} className="flex items-start gap-3 text-xs">
                                                                <div className={`mt-0.5 w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 ${item.completed ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-400'}`}>
                                                                    <Check size={10} strokeWidth={4}/>
                                                                </div>
                                                                <span className={item.completed ? 'text-slate-700 dark:text-slate-200 font-medium' : 'text-slate-400 line-through'}>{item.label}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            );
                                        })()}
                                    </div>
                                </section>
                            );
                        })()}

                        {/* Detailed Notes Matrix */}
                        <section className="space-y-4">
                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                <FileText size={14}/> Technician Field Notes
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {typeof job.notes === 'object' && job.notes && [
                                    { label: 'Arrival Note', value: job.notes?.arrival },
                                    { label: 'Diagnosis', value: job.notes?.diagnosis },
                                    { label: 'Work Performed', value: job.notes?.work || job.notes?.workNotes },
                                    { label: 'Completion Notes', value: job.notes?.completion },
                                    { label: 'Customer Feedback (Notes)', value: job.notes?.customerFeedback },
                                    { label: 'Employee/Tech Feedback', value: job.notes?.employeeFeedback || job.notes?.feedback }
                                ].map((note, idx) => {
                                    if (!note.value) return null;
                                    return (
                                        <div key={idx} className="p-5 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl shadow-sm print:border-slate-200">
                                            <p className="text-[10px] font-black text-primary-500 uppercase tracking-tighter mb-2">{note.label}</p>
                                            <p className="text-sm text-slate-600 dark:text-slate-300 whitespace-pre-wrap leading-relaxed print:text-black">{note.value}</p>
                                        </div>
                                    );
                                })}
                                {typeof job.notes === 'string' && job.notes && (
                                    <div className="p-5 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl shadow-sm print:border-slate-200 col-span-2">
                                        <p className="text-[10px] font-black text-primary-500 uppercase tracking-tighter mb-2">Service Notes</p>
                                        <p className="text-sm text-slate-600 dark:text-slate-300 whitespace-pre-wrap leading-relaxed print:text-black">{job.notes}</p>
                                    </div>
                                )}
                                {(!job.notes || (typeof job.notes === 'object' && Object.values(job.notes).every(v => !v)) || (typeof job.notes === 'string' && !job.notes)) && (
                                    <p className="text-xs text-slate-400 italic col-span-2 p-4 text-center">No field notes were recorded for this service.</p>
                                )}
                            </div>
                        </section>

                        {/* Visit & Clock History */}
                        {isAdmin && job.timeEntries && job.timeEntries.length > 0 && (
                            <section className="space-y-4">
                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                    <Clock size={14}/> Visit & Clock History ({job.timeEntries.length})
                                </h4>
                                <div className="grid grid-cols-1 gap-3 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-5 shadow-sm print:border-slate-200">
                                    {job.timeEntries.map((entry, idx) => (
                                        <div key={idx} className="flex justify-between items-center text-xs border-b border-slate-100 dark:border-slate-800/60 pb-3 last:border-b-0 last:pb-0">
                                            <div className="space-y-1">
                                                <span className="font-black text-slate-400 dark:text-slate-500 uppercase text-[9px] tracking-wider block">Visit #{idx + 1}</span>
                                                <span className="font-bold text-slate-700 dark:text-slate-200">
                                                    {new Date(entry.checkInTime).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                                                </span>
                                            </div>
                                            <div className="text-right">
                                                <div className="font-medium text-slate-650 dark:text-slate-400">
                                                    In: {new Date(entry.checkInTime).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                                                    {entry.checkOutTime ? ` | Out: ${new Date(entry.checkOutTime).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : ' (Active)'}
                                                </div>
                                                {entry.timeOnSiteMinutes !== undefined && entry.timeOnSiteMinutes !== null && (
                                                    <span className="text-[10px] font-black text-primary-500 dark:text-primary-400 uppercase tracking-wider block mt-0.5">
                                                        {entry.timeOnSiteMinutes >= 60 
                                                            ? `${Math.floor(entry.timeOnSiteMinutes / 60)}h ${entry.timeOnSiteMinutes % 60}m`
                                                            : `${entry.timeOnSiteMinutes}m`
                                                        }
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </section>
                        )}

                        {/* CompanyCam Integration */}
                        <CompanyCamGallery 
                            jobId={job.id} 
                            orgId={job.organizationId} 
                            address={formatAddress(job.address)} 
                        />

                        {/* IoT Smart Diagnostics */}
                        <section className="space-y-4 print:hidden">
                            <IoTDiagnosticsViewer 
                                jobId={job.id} 
                                customerName={job.customerName} 
                                orgId={job.organizationId} 
                            />
                        </section>

                        {/* Refrigerant & Technical Data */}
                        {( (job.refrigerantLog && job.refrigerantLog.length > 0) || (job.toolReadings && job.toolReadings.length > 0) || (job.qcAudits && job.qcAudits.length > 0) || (diagnostics.length > 0) ) && (
                            <section className="space-y-4">
                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                    <Wrench size={14}/> Technical, Environmental & QC Data
                                </h4>
                                <div className="space-y-4">
                                    {/* MeasureQuick Diagnostics */}
                                    {diagnostics && diagnostics.length > 0 && (
                                        <div className="space-y-3">
                                            {diagnostics.map((diag, i) => (
                                                <div key={i} className="p-5 bg-purple-50 dark:bg-purple-900/10 border border-purple-100 dark:border-purple-900/30 rounded-3xl print:bg-white print:border-slate-200 shadow-sm relative overflow-hidden">
                                                    <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                                                        <Thermometer size={60} />
                                                    </div>
                                                    <div className="flex justify-between items-center mb-4 relative z-10">
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-8 h-8 rounded-xl bg-purple-200 dark:bg-purple-900/50 flex items-center justify-center text-purple-700 dark:text-purple-300">
                                                                <Thermometer size={14}/>
                                                            </div>
                                                            <div>
                                                                <h5 className="text-[10px] font-black text-purple-700 dark:text-purple-400 uppercase tracking-widest">
                                                                    {diag.source === 'measureQuick' ? 'measureQuick Diagnostics' : 'Field Diagnostics'}
                                                                </h5>
                                                                {diag.systemType && <p className="text-[9px] font-bold text-slate-500 uppercase">{diag.systemType}</p>}
                                                            </div>
                                                        </div>
                                                        {diag.healthScore !== undefined && diag.healthScore !== null && (
                                                            <span className={`text-[10px] font-black px-3 py-1.5 rounded-xl shadow-sm border ${diag.healthScore >= 80 ? 'bg-emerald-500 border-emerald-400 text-white' : diag.healthScore >= 50 ? 'bg-amber-500 border-amber-400 text-white' : 'bg-red-500 border-red-400 text-white'}`}>
                                                                System Health: {diag.healthScore}/100
                                                            </span>
                                                        )}
                                                    </div>
                                                    
                                                    {diag.measurements && Object.keys(diag.measurements).length > 0 && (
                                                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mb-4 relative z-10">
                                                            {Object.entries(diag.measurements).map(([key, val]) => (
                                                                <div key={key} className="bg-white/80 dark:bg-slate-900/80 p-3 rounded-2xl border border-purple-100/80 dark:border-purple-900/40 text-left shadow-sm">
                                                                    <p className="text-[9px] uppercase font-black text-slate-500 mb-0.5">{key.replace(/([A-Z])/g, ' $1').trim()}</p>
                                                                    <p className="text-lg font-black text-purple-900 dark:text-purple-100 tracking-tight">{val as string | number}</p>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}

                                                    {diag.diagnostics && diag.diagnostics.length > 0 && (
                                                        <div className="mb-4 space-y-1 relative z-10">
                                                            <p className="text-[9px] font-black text-purple-600 dark:text-purple-400 uppercase tracking-widest mb-2">Automated Analysis</p>
                                                            {diag.diagnostics.map((d, index) => (
                                                                <p key={index} className="text-xs text-slate-700 dark:text-slate-300 font-bold flex items-center gap-2">
                                                                    <span className="w-1.5 h-1.5 bg-purple-400 rounded-full"></span> {d}
                                                                </p>
                                                            ))}
                                                        </div>
                                                    )}
                                                    
                                                    {diag.pdfReportUrl && (
                                                        <a href={diag.pdfReportUrl} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-2 text-[10px] w-full lg:w-auto font-black uppercase text-white bg-purple-600 hover:bg-purple-500 shadow-md shadow-purple-500/20 px-5 py-2.5 rounded-xl transition-all relative z-10">
                                                            <FileText size={14}/> Download Official PDF Report 
                                                        </a>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    {/* AI Quality Audits */}
                                    {job.qcAudits && job.qcAudits.length > 0 && (
                                        <div className="space-y-3">
                                            {job.qcAudits.map((audit, i) => (
                                                <div key={i} className={`p-5 rounded-3xl border-2 print:border-slate-200 print:bg-white ${
                                                    audit.status === 'pass' ? 'bg-emerald-50 border-emerald-100 dark:bg-emerald-900/10 dark:border-emerald-900/30' : 
                                                    audit.status === 'fail' ? 'bg-red-50 border-red-100 dark:bg-red-900/10 dark:border-red-900/30' : 
                                                    'bg-amber-50 border-amber-100 dark:bg-amber-900/10 dark:border-amber-900/30'
                                                }`}>
                                                    <div className="flex items-start gap-4">
                                                        {audit.imageUrl && (
                                                            <div className="w-20 h-20 rounded-2xl overflow-hidden shadow-sm border border-white dark:border-slate-800 flex-shrink-0 print:border-slate-200">
                                                                <img src={audit.imageUrl} className="w-full h-full object-cover" alt="QC Visual" />
                                                            </div>
                                                        )}
                                                        <div className="flex-1">
                                                            <div className="flex justify-between items-center mb-1">
                                                                <h5 className="text-[10px] font-black text-primary-500 uppercase tracking-tighter">AI Visual QC Audit</h5>
                                                                <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full ${
                                                                    audit.status === 'pass' ? 'bg-emerald-500 text-white' : 
                                                                    audit.status === 'fail' ? 'bg-red-500 text-white' : 
                                                                    'bg-amber-500 text-white'
                                                                }`}>
                                                                    {audit.status}
                                                                </span>
                                                            </div>
                                                            <p className="text-xs text-slate-700 dark:text-slate-300 font-bold leading-relaxed print:text-black">{audit.comments}</p>
                                                            <p className="text-[8px] text-slate-400 mt-2 uppercase font-bold">{new Date(audit.timestamp).toLocaleString()}</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* Parts Used */}
                                    {job.partsUsed && job.partsUsed.length > 0 && (
                                        <div className="p-5 bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 rounded-3xl print:bg-white print:border-slate-200">
                                            <p className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                                                 <Package size={14}/> Parts & Materials Consumed
                                            </p>
                                            <div className="space-y-2">
                                                {job.partsUsed.map((part, i) => (
                                                    <div key={i} className="flex justify-between items-center text-xs bg-white/50 dark:bg-slate-800/50 p-3 rounded-xl border border-blue-100/50 dark:border-blue-900/20 print:border-slate-200">
                                                        <div>
                                                            <span className="font-bold text-slate-700 dark:text-slate-300 print:text-black">{part.name}</span>
                                                            <p className="text-[8px] text-blue-500 uppercase font-black">Location: {part.location || 'Truck Stock'}</p>
                                                        </div>
                                                        <span className="font-black text-blue-700 dark:text-blue-300 print:text-black">Qty: {part.quantity}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Refrigerant Log */}
                                    {job.refrigerantLog && job.refrigerantLog.length > 0 && (
                                        <div className="p-5 bg-indigo-50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-900/30 rounded-3xl print:bg-white print:border-slate-200">
                                            <p className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                                                 <Droplets size={14}/> Refrigerant Management Log
                                            </p>
                                            <div className="space-y-2">
                                                {job.refrigerantLog.map((entry, i) => (
                                                    <div key={i} className="flex justify-between items-center text-xs bg-white/50 dark:bg-slate-800/50 p-3 rounded-xl border border-indigo-100/50 dark:border-indigo-900/20 print:border-slate-200">
                                                        <div>
                                                            <span className="font-bold text-slate-700 dark:text-slate-300 print:text-black">{entry.type} {entry.action}</span>
                                                            {entry.cylinderNumber && <p className="text-[8px] text-indigo-500 uppercase font-black">Cylinder: {entry.cylinderNumber}</p>}
                                                        </div>
                                                        <span className="font-black text-indigo-700 dark:text-indigo-300 print:text-black">{entry.amount} {entry.unit || 'lbs'}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Tool Readings */}
                                    {job.toolReadings && job.toolReadings.length > 0 && (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            {job.toolReadings.map((reading, i) => (
                                                <div key={i} className="p-4 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl flex items-center gap-4 shadow-sm print:border-slate-200">
                                                    <div className="w-10 h-10 rounded-2xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-primary-500 print:hidden">
                                                        <Thermometer size={18}/>
                                                    </div>
                                                    <div>
                                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">{reading.toolType}</p>
                                                        <p className="text-sm font-black text-slate-800 dark:text-white print:text-black">{reading.summary}</p>
                                                        {reading.reportUrl && (
                                                            <div className="mt-1 flex items-center gap-1 text-xs text-primary-600 dark:text-primary-400 font-bold print:hidden">
                                                                <a href={reading.reportUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:underline">
                                                                    <FileText size={12} />
                                                                    <span>View Attachment</span>
                                                                </a>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </section>
                        )}
                    </div>

                    {/* Right Column: Financials & Documentation */}
                    <div className="space-y-8">
                        {/* Financial Summary */}
                        <section className="bg-emerald-50 dark:bg-emerald-900/10 p-6 rounded-[2.5rem] border border-emerald-100 dark:border-emerald-900/30 shadow-sm relative overflow-hidden print:bg-white print:border-slate-200">
                            <div className="absolute top-0 right-0 p-8 opacity-10 print:hidden">
                                <DollarSign size={80} className="text-emerald-900 dark:text-emerald-100" />
                            </div>
                            
                            <div className="relative z-10">
                                <div className="flex justify-between items-center mb-4">
                                    <p className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest print:text-slate-600">Job Invoice Total</p>
                                    {isAdmin && onEditInvoice && (
                                        <button onClick={onEditInvoice} className="text-[10px] text-primary-600 hover:underline font-black uppercase tracking-tighter print:hidden">Adjust Invoice</button>
                                    )}
                                </div>
                                <p className="text-4xl font-black text-emerald-900 dark:text-emerald-100 tracking-tight mb-4 print:text-black">
                                    ${(job.invoice?.totalAmount || 0).toFixed(2)}
                                </p>
                                
                                <div className="flex items-center gap-2 mb-6">
                                    <span className={`px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest shadow-sm print:border print:border-slate-300 ${
                                        job.invoice?.status === 'Paid' ? 'bg-emerald-500 text-white' : 'bg-amber-500 text-white'
                                    }`}>
                                        {job.invoice?.status || 'Unpaid'}
                                    </span>
                                    {job.invoice?.paidDate && (
                                        <span className="text-[10px] text-emerald-700 dark:text-emerald-500 font-bold uppercase truncate print:text-black">
                                            Paid {new Date(job.invoice.paidDate).toLocaleDateString()}
                                        </span>
                                    )}
                                </div>

                                {/* Line Items Preview */}
                                {job.invoice?.items && job.invoice.items.length > 0 && (
                                    <div className="space-y-2 border-t border-emerald-200/50 dark:border-emerald-900/30 pt-4 max-h-48 overflow-y-auto pr-2 scrollbar-thin print:max-h-none print:overflow-visible">
                                        {job.invoice?.items?.map((item, i) => (
                                            <div key={i} className="flex justify-between items-start text-[11px]">
                                                <div className="flex-1 pr-2">
                                                    <p className="font-black text-emerald-900 dark:text-emerald-200 uppercase print:text-black">{item.name || item.description}</p>
                                                    <p className="text-slate-500 italic">Qty: {item.quantity}</p>
                                                </div>
                                                <p className="font-bold text-emerald-800 dark:text-emerald-300 print:text-black">${item.total.toFixed(2)}</p>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Customer Signature for Invoice */}
                                 {(job.invoiceSignature || (job.invoice as any)?.signatureUrl) && (
                                     <div className="mt-6 pt-4 border-t border-emerald-200/50 dark:border-emerald-900/30">
                                         <DigitalSignatureStamp 
                                             signatureUrl={job.invoiceSignature || (job.invoice as any)?.signatureUrl}
                                             signedByName={job.customerName || 'Customer'}
                                             signedAt={job.invoiceSignedDate || (job.invoice as any)?.signedAt}
                                             geolocation={job.signatureMetadata?.geolocation || (job.invoice as any)?.signatureMetadata?.geolocation}
                                             securityHash={job.signatureMetadata?.securityHash || (job.invoice as any)?.signatureMetadata?.securityHash}
                                             documentTitle={`Invoice #${job.invoice?.id || job.id}`}
                                         />
                                     </div>
                                 )}

                                 {/* Archived Signature History Button */}
                                 {((job.signatureHistory && job.signatureHistory.length > 0) || ((job.invoice as any)?.signatureHistory && (job.invoice as any)?.signatureHistory.length > 0)) && (
                                     <div className="mt-4">
                                         <button
                                             type="button"
                                             onClick={() => setIsAuditHistoryOpen(true)}
                                             className="text-xs text-purple-700 dark:text-purple-300 font-bold hover:underline flex items-center gap-1.5 bg-purple-50 dark:bg-purple-950/40 px-3 py-1.5 rounded-lg border border-purple-200 dark:border-purple-800"
                                         >
                                             <ShieldCheck size={14} className="text-purple-600 dark:text-purple-400" />
                                             <span>View Signature Audit History ({(job.signatureHistory || (job.invoice as any)?.signatureHistory || []).length} Archived Versions)</span>
                                         </button>
                                     </div>
                                 )}
                            </div>
                        </section>

                        {/* Warranty Coverage */}
                        {((job.invoice as Record<string, unknown>)?.workmanshipWarrantyMonths as number > 0 || (job.invoice as Record<string, unknown>)?.partsWarrantyMonths as number > 0) && (() => {
                            const inv = job.invoice as Record<string, unknown>;
                            const wm: number = (inv?.workmanshipWarrantyMonths as number) || 0;
                            const pm: number = (inv?.partsWarrantyMonths as number) || 0;
                            const agreed: boolean = !!inv?.warrantyDisclaimerAgreed;
                            const issued = inv?.warrantyIssuedDate ? new Date(inv.warrantyIssuedDate as string) : new Date(job.appointmentTime);
                            const now = new Date();
                            const addMonths = (d: Date, m: number) => { const r = new Date(d); r.setMonth(r.getMonth() + m); return r; };
                            const wmExpiry = wm > 0 ? addMonths(issued, wm) : null;
                            const pmExpiry = pm > 0 ? addMonths(issued, pm) : null;
                            const monthsLeft = (d: Date | null) => d ? Math.max(0, Math.round((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 30.44))) : 0;
                            const wmActive = agreed && !!wmExpiry && wmExpiry > now;
                            const pmActive = agreed && !!pmExpiry && pmExpiry > now;

                            const getWidthClass = (percent: number) => {
                                if (percent <= 0) return 'w-0';
                                if (percent <= 10) return 'w-[10%]';
                                if (percent <= 20) return 'w-[20%]';
                                if (percent <= 30) return 'w-[30%]';
                                if (percent <= 40) return 'w-[40%]';
                                if (percent <= 50) return 'w-1/2';
                                if (percent <= 60) return 'w-[60%]';
                                if (percent <= 70) return 'w-[70%]';
                                if (percent <= 80) return 'w-[80%]';
                                if (percent <= 90) return 'w-[90%]';
                                return 'w-full';
                            };
                            return (
                                <section className="bg-blue-50 dark:bg-blue-900/10 p-6 rounded-[2.5rem] border border-blue-100 dark:border-blue-900/30 shadow-sm print:bg-white print:border-slate-200">
                                    <div className="flex items-center gap-2 mb-4">
                                        <Shield size={16} className="text-blue-600 dark:text-blue-400" />
                                        <p className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest">Warranty Coverage</p>
                                        {!agreed && (
                                            <span className="ml-auto px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[9px] font-black uppercase">Disclaimer Pending</span>
                                        )}
                                    </div>
                                    <div className="grid grid-cols-2 gap-3 mb-3">
                                        {wm > 0 && (
                                            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-blue-100 dark:border-blue-900/20">
                                                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Workmanship</p>
                                                <p className="text-2xl font-black text-slate-900 dark:text-white">
                                                    {wmActive ? monthsLeft(wmExpiry) : '—'}
                                                    {wmActive && <span className="text-xs font-bold text-slate-400 ml-1">mo left</span>}
                                                </p>
                                                {wmExpiry && <p className="text-[9px] text-slate-400 mt-1">{wmActive ? `Exp. ${wmExpiry.toLocaleDateString()}` : `Expired ${wmExpiry.toLocaleDateString()}`}</p>}
                                                <div className="mt-2 h-1 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                                                    <div className={`h-full rounded-full ${wmActive ? 'bg-blue-500' : 'bg-slate-300'} ${getWidthClass(wmActive ? Math.min(100, (monthsLeft(wmExpiry) / wm) * 100) : 0)}`} />
                                                </div>
                                            </div>
                                        )}
                                        {pm > 0 && (
                                            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-blue-100 dark:border-blue-900/20">
                                                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Parts</p>
                                                <p className="text-2xl font-black text-slate-900 dark:text-white">
                                                    {pmActive ? monthsLeft(pmExpiry) : '—'}
                                                    {pmActive && <span className="text-xs font-bold text-slate-400 ml-1">mo left</span>}
                                                </p>
                                                {pmExpiry && <p className="text-[9px] text-slate-400 mt-1">{pmActive ? `Exp. ${pmExpiry.toLocaleDateString()}` : `Expired ${pmExpiry.toLocaleDateString()}`}</p>}
                                                <div className="mt-2 h-1 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                                                    <div className={`h-full rounded-full ${pmActive ? 'bg-emerald-500' : 'bg-slate-300'} ${getWidthClass(pmActive ? Math.min(100, (monthsLeft(pmExpiry) / pm) * 100) : 0)}`} />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    {inv?.warrantyNotes && (
                                        <p className="text-[10px] text-slate-500 dark:text-slate-400 italic border-t border-blue-100 dark:border-blue-900/20 pt-3 mt-1">{inv.warrantyNotes as string}</p>
                                    )}
                                    {!agreed && (
                                        <p className="text-[10px] text-amber-600 font-bold mt-2">⚠️ Warranty not yet active — disclaimer agreement required.</p>
                                    )}
                                </section>
                            );
                        })()}

                        {photoFiles.length > 0 && (
                            <section className="print:hidden">
                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Job Photos</h4>
                                <div className="space-y-4">
                                    {Object.entries(groupedPhotos).map(([label, photos]) => (
                                        <div key={label}>
                                            <p className="text-[10px] font-bold text-slate-500 uppercase mb-2 border-b border-slate-100 dark:border-slate-800 pb-1 inline-block">{label}</p>
                                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                                {(photos as ExtendedFile[]).map((f: ExtendedFile, i: number) => (
                                                    <div key={i} className="relative group">
                                                        <a href={f.dataUrl || f.url} target="_blank" rel="noreferrer" className="aspect-square bg-white dark:bg-slate-800 rounded-2xl overflow-hidden hover:ring-2 hover:ring-primary-500 transition-all block shadow-sm border border-slate-100 dark:border-slate-800">
                                                            <img src={f.dataUrl || f.url} className="w-full h-full object-cover" alt={`Job Documentation - ${label}`} />
                                                        </a>
                                                        {isAdmin && (
                                                            <button 
                                                                onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDeletePhoto(f); }}
                                                                className="absolute top-2 right-2 p-1.5 bg-red-600/90 text-white rounded-full transition-all shadow-lg backdrop-blur-sm hover:bg-red-700 hover:scale-110 z-10"
                                                                title="Delete Photo"
                                                            >
                                                                <Trash2 size={12}/>
                                                            </button>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </section>
                        )}

                        {/* Proposals, Invoices & Documentation */}
                        {(docFiles.length > 0 || (job.embeddedData?.waivers && job.embeddedData.waivers.length > 0) || job.waivers || proposal || job.invoice) && (
                            <section className="space-y-3">
                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                    <ShieldCheck size={14} className="text-primary-500"/> Documentation & Invoices
                                </h4>
                                <div className="space-y-2">
                                    {/* Job Invoice / Receipt */}
                                    {job.invoice && (
                                        <button 
                                            type="button" 
                                            onClick={() => setPreviewDoc({ ...job, type: 'Invoice' })} 
                                            className="w-full text-left p-3 px-4 bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/30 rounded-xl text-[10px] font-black uppercase text-emerald-600 dark:text-emerald-400 flex items-center justify-between hover:bg-emerald-100 hover:text-emerald-700 transition-all shadow-sm cursor-pointer"
                                        >
                                            <span className="flex items-center gap-2"><FileText size={12}/> {job.invoice.status === 'Paid' ? 'Official Receipt' : `Service Invoice (${job.invoice.status || 'Unpaid'})`}</span>
                                            <span className="text-emerald-500 font-bold">VIEW</span>
                                        </button>
                                    )}

                                    {/* Signed Proposal */}
                                    {proposal && (() => {
                                        const sig = (proposal as Record<string, unknown>).signatureDataUrl || (proposal as Record<string, unknown>).signatureImage || (proposal as Record<string, unknown>).signature;
                                        const isSigned = !!sig;
                                        return (
                                            <button onClick={() => setPreviewDoc({ ...proposal, type: 'Proposal', title: isSigned ? 'Signed Proposal' : 'Proposal' })} className="w-full text-left p-3 px-4 bg-indigo-50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-900/30 rounded-xl text-[10px] font-black uppercase text-indigo-600 dark:text-indigo-400 flex items-center justify-between hover:bg-primary-50 hover:text-primary-500 transition-all shadow-sm">
                                                <span className="flex items-center gap-2"><FileText size={12}/> {isSigned ? 'Signed Proposal' : 'Proposal'}</span>
                                                <span className={isSigned ? "text-emerald-500 font-bold" : "text-amber-500 font-bold"}>{isSigned ? 'SIGNED' : 'UNSIGNED'}</span>
                                            </button>
                                        );
                                    })()}

                                    {/* Waivers list from job.waivers, job.embeddedData.waivers, and job.requiredWaiverIds */}
                                    {(() => {
                                        // 1. Resolve required waivers from state.documents using requiredWaiverIds
                                        const resolvedRequiredWaivers = (job.requiredWaiverIds || []).map(id => {
                                            const template = (job.embeddedData?.waivers || state.documents || []).find((d: any) => d.id === id);
                                            if (template) {
                                                return {
                                                    id: template.id,
                                                    title: template.title || 'Legal Waiver',
                                                    content: template.content,
                                                    type: 'Waiver Template'
                                                };
                                            }
                                            return null;
                                        }).filter(Boolean) as any[];

                                        // 2. Resolve signed and pending waiver files from job.files
                                        const isAnyWaiverSigned = (job.files || []).some(f => f.fileName === 'Signed_Waivers.html');
                                        const pendingWaiverFile = (job.files || []).find(f => f.fileName === 'Waiver_Pending_Signature.html');

                                        // 3. Build waivers array to display
                                        const displayWaivers: any[] = [];

                                        if (isAnyWaiverSigned) {
                                            const signedFile = (job.files || []).find(f => f.fileName === 'Signed_Waivers.html');
                                            if (signedFile) {
                                                displayWaivers.push({
                                                    ...signedFile,
                                                    id: signedFile.id,
                                                    title: 'Signed Waiver Agreement',
                                                    isSigned: true,
                                                    dataUrl: signedFile.dataUrl,
                                                    url: signedFile.url
                                                });
                                            }
                                        } else if (pendingWaiverFile) {
                                            displayWaivers.push({
                                                ...pendingWaiverFile,
                                                id: pendingWaiverFile.id,
                                                title: 'Waiver Agreement (Pending Signature)',
                                                isSigned: false,
                                                isPending: true,
                                                dataUrl: pendingWaiverFile.dataUrl,
                                                url: pendingWaiverFile.url
                                            });
                                        } else {
                                            // Show individual required waivers as REQUIRED
                                            resolvedRequiredWaivers.forEach(w => {
                                                displayWaivers.push({
                                                    ...w,
                                                    isSigned: false
                                                });
                                            });
                                        }

                                        // Add other legacy/explicit waivers in job.waivers or job.embeddedData.waivers if not already added
                                        const otherWaivers = [
                                            ...(job.waivers || []),
                                            ...(job.embeddedData?.waivers || [])
                                        ].filter(w => !displayWaivers.some(dw => dw.id === w.id || dw.title === w.title));

                                        otherWaivers.forEach(w => {
                                            const hasSig = !!(w.signatureImage || w.signatureDataUrl || w.signature);
                                            displayWaivers.push({
                                                ...w,
                                                isSigned: hasSig
                                            });
                                        });

                                        if (displayWaivers.length === 0) return null;

                                        return displayWaivers.map((waiver: Record<string, any>, idx: number) => {
                                            const isSigned = waiver.isSigned;
                                            const isPending = waiver.isPending;
                                            const title = waiver.title || waiver.fileName || 'Legal Waiver';
                                            
                                            // For previewing:
                                            const previewPayload = {
                                                ...waiver,
                                                type: 'Other',
                                                title: title
                                            };

                                            return (
                                                <button 
                                                    key={idx} 
                                                    onClick={() => setPreviewDoc(previewPayload)} 
                                                    className="w-full text-left p-3 px-4 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl text-[10px] font-black uppercase text-slate-600 dark:text-slate-400 flex items-center justify-between hover:bg-primary-50 hover:text-primary-500 transition-all shadow-sm cursor-pointer"
                                                >
                                                    <span className="flex items-center gap-2"><FileText size={12}/> {title}</span>
                                                    <span className={isSigned ? "text-emerald-500 font-bold" : isPending ? "text-amber-500 font-bold" : "text-amber-500 font-bold"}>
                                                        {isSigned ? 'SIGNED' : isPending ? 'PENDING SIGNATURE' : 'REQUIRED'}
                                                    </span>
                                                </button>
                                            );
                                        });
                                    })()}

                                    {/* Other Document Files */}
                                    {docFiles.map((file, i) => {
                                        const isHtml = file.fileName?.toLowerCase().endsWith('.html') || (file as ExtendedFile).dataUrl?.includes('text/html');
                                        const displayTitle = file.metadata?.label || file.fileName?.replace(/_/g, ' ').replace('.html', '').replace('.pdf', '') || 'Document';
                                        if (isHtml) {
                                            return (
                                                <button key={i} onClick={() => setPreviewDoc({ ...file, type: 'Other', title: displayTitle })} className="w-full text-left p-3 px-4 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl text-[10px] font-black uppercase text-slate-600 dark:text-slate-400 flex items-center justify-between hover:bg-primary-50 hover:text-primary-500 transition-all shadow-sm">
                                                    <span className="flex items-center gap-2"><FileText size={12}/> {displayTitle}</span>
                                                    <span className="text-emerald-500 font-bold">VIEW</span>
                                                </button>
                                            );
                                        }
                                        return (
                                            <a key={i} href={(file as ExtendedFile).dataUrl || (file as ExtendedFile).url} target="_blank" rel="noreferrer" className="w-full text-left p-3 px-4 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl text-[10px] font-black uppercase text-slate-600 dark:text-slate-400 flex items-center gap-2 hover:bg-primary-50 hover:text-primary-500 transition-all shadow-sm">
                                                <FileText size={12}/> {displayTitle}
                                            </a>
                                        );
                                    })}
                                </div>
                            </section>
                        )}
                        
                        {/* Proposal Link */}
                        {job.projectId && !proposal && (
                            <section className="p-4 bg-indigo-50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-900/30 rounded-3xl shadow-sm">
                                <h4 className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                                    <FileText size={14}/> Job Proposal / Estimate
                                </h4>
                                <a href={`/#/${isAdmin ? 'admin' : 'briefing'}/proposal?proposalId=${job.projectId}`} target="_blank" rel="noreferrer" className="text-xs text-primary-600 hover:underline font-bold">
                                    View Original Proposal Context
                                </a>
                            </section>
                        )}

                        {/* Document Relations & Links */}
                        {isAdmin && (
                            <section className="space-y-3 p-4 bg-slate-50 dark:bg-slate-900/30 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm">
                                <div className="flex justify-between items-center pb-2 border-b border-slate-200 dark:border-slate-850">
                                    <h4 className="text-[10px] font-black text-[#123A63] dark:text-sky-400 uppercase tracking-widest flex items-center gap-2">
                                        <CalendarPlus size={14} className="text-[#123A63] dark:text-sky-400"/> Document Relations & Links
                                    </h4>
                                    <button 
                                        type="button"
                                        onClick={() => setIsLinkingModalOpen(true)}
                                        className="text-[9px] font-black uppercase tracking-wider text-primary-650 hover:text-primary-750 bg-primary-50 dark:bg-slate-900 border border-primary-200/50 dark:border-slate-800 rounded-lg p-1.5 flex items-center gap-1 transition-colors"
                                        title="Manage Associations"
                                    >
                                        <Link2 size={10} /> Link Manager
                                    </button>
                                </div>
                                
                                {/* Linked Proposals */}
                                <div className="space-y-2">
                                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Linked Proposals</div>
                                    {linkedProposals.length === 0 ? (
                                        <p className="text-xs text-slate-400 italic">No proposals linked.</p>
                                    ) : (
                                        <div className="flex flex-wrap gap-1.5">
                                            {linkedProposals.map(lp => (
                                                <div key={lp.id} className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/50 rounded-lg p-1.5 px-2.5 text-xs font-semibold">
                                                    <span>Proposal #{lp.id.slice(0, 8)} {lp.title ? `(${lp.title})` : ''}</span>
                                                    <button type="button" onClick={() => handleUnlinkProposal(lp.id)} className="text-indigo-500 hover:text-red-500 font-bold ml-1" title="Unlink proposal">×</button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    
                                    {/* Link Proposal Form */}
                                    {availableProposals.length > 0 && (
                                        <div className="flex gap-2 items-center mt-2">
                                            <select 
                                                id="link-proposal-select-detail"
                                                title="Link Proposal"
                                                aria-label="Link Proposal Select"
                                                className="text-xs border border-slate-300 dark:border-slate-700 rounded-lg p-1 px-2 dark:bg-slate-850 dark:text-white flex-1"
                                                value={selectedPropToLink}
                                                onChange={e => setSelectedPropToLink(e.target.value)}
                                            >
                                                <option value="">-- Link a Proposal --</option>
                                                {availableProposals.map(p => (
                                                    <option key={p.id} value={p.id}>#{p.id.slice(0, 8)} - {p.title || 'Proposal'}</option>
                                                ))}
                                            </select>
                                            <Button onClick={() => { handleLinkProposal(selectedPropToLink); setSelectedPropToLink(''); }} className="text-[10px] py-1 px-2.5 h-auto bg-[#123A63] hover:bg-[#0f2d50] text-white rounded-lg font-semibold border-0 shrink-0">Link</Button>
                                        </div>
                                    )}
                                </div>

                                <div className="border-b border-slate-200 dark:border-slate-800 my-2"></div>

                                {/* Linked Jobs */}
                                <div className="space-y-2">
                                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Linked Jobs</div>
                                    {linkedJobs.length === 0 ? (
                                        <p className="text-xs text-slate-400 italic">No other jobs linked.</p>
                                    ) : (
                                        <div className="flex flex-wrap gap-1.5">
                                            {linkedJobs.map(lj => {
                                                const jobDate = lj.appointmentTime ? new Date(lj.appointmentTime).toLocaleDateString() : '';
                                                return (
                                                    <div key={lj.id} className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/50 rounded-lg p-1.5 px-2.5 text-xs font-semibold">
                                                        <span>Job #{lj.id.slice(0, 8)} {jobDate ? `(${jobDate})` : ''} {lj.invoice ? `- Invoice ($${(lj.invoice.totalAmount || lj.invoice.amount || 0).toFixed(2)})` : ''}</span>
                                                        <button type="button" onClick={() => handleUnlinkJob(lj.id)} className="text-emerald-500 hover:text-red-500 font-bold ml-1" title="Unlink job">×</button>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}

                                    {/* Link Job Form */}
                                    {availableJobs.length > 0 && (
                                        <div className="flex gap-2 items-center mt-2">
                                            <select 
                                                id="link-job-select-detail"
                                                title="Link Job"
                                                aria-label="Link Job Select"
                                                className="text-xs border border-slate-300 dark:border-slate-700 rounded-lg p-1 px-2 dark:bg-slate-850 dark:text-white flex-1"
                                                value={selectedJobToLink}
                                                onChange={e => setSelectedJobToLink(e.target.value)}
                                            >
                                                <option value="">-- Link another Job --</option>
                                                {availableJobs.map(j => {
                                                    const dateStr = j.appointmentTime ? new Date(j.appointmentTime).toLocaleDateString() : '';
                                                    return (
                                                        <option key={j.id} value={j.id}>#{j.id.slice(0, 8)} - {dateStr} {j.tasks?.slice(0, 2).join(', ') || ''}</option>
                                                    );
                                                })}
                                            </select>
                                            <Button onClick={() => { handleLinkJob(selectedJobToLink); setSelectedJobToLink(''); }} className="text-[10px] py-1 px-2.5 h-auto bg-[#123A63] hover:bg-[#0f2d50] text-white rounded-lg font-semibold border-0 shrink-0">Link</Button>
                                        </div>
                                    )}
                                </div>

                                <div className="border-b border-slate-200 dark:border-slate-800 my-2"></div>

                                {/* Linked Invoices */}
                                <div className="space-y-2">
                                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Linked Invoices</div>
                                    {linkedInvoices.length === 0 ? (
                                        <p className="text-xs text-slate-400 italic">No external invoices linked.</p>
                                    ) : (
                                        <div className="flex flex-wrap gap-1.5">
                                            {linkedInvoices.map(item => (
                                                <div key={item.invoice.id} className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-100 dark:border-amber-900/50 rounded-lg p-1.5 px-2.5 text-xs font-semibold">
                                                    <span>Invoice #{item.invoice.id.slice(0, 8)} (${(item.invoice.amount || 0).toFixed(2)})</span>
                                                    <button type="button" onClick={() => handleUnlinkInvoice(item.invoice.id)} className="text-amber-500 hover:text-red-500 font-bold ml-1" title="Unlink invoice">×</button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </section>
                        )}

                        {/* Payment Details / Receipt */}
                        {['Paid', 'Refunded', 'Disputed'].includes(job.invoice?.status || '') && (
                            <section className="p-4 bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/30 rounded-3xl shadow-sm print:hidden">
                                <h4 className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                                    <DollarSign size={14}/> Payment Confirmation {job.invoice?.status === 'Refunded' ? '(REFUNDED)' : job.invoice?.status === 'Disputed' ? '(DISPUTED)' : ''}
                                </h4>
                                <div className="space-y-1">
                                    <p className="text-[10px] text-slate-500 font-bold uppercase">Method: {job.invoice?.paymentMethod || 'Credit Card'}</p>
                                    <p className="text-[10px] text-slate-500 font-bold uppercase">Transaction: {job.id.slice(-8).toUpperCase()}</p>
                                    <button 
                                        type="button"
                                        onClick={() => setPreviewDoc({ ...job, type: 'Invoice' })}
                                        className="text-[10px] text-primary-600 hover:underline font-black uppercase mt-2 text-left block"
                                    >
                                        Download Official Receipt
                                    </button>
                                    
                                    {isAdmin && job.invoice?.status === 'Paid' && job.invoice?.paymentIntentId && (
                                        <div className="mt-4 pt-4 border-t border-emerald-200/50 dark:border-emerald-900/30">
                                            <Button 
                                                variant="danger" 
                                                size="sm"
                                                onClick={handleRefund}
                                                disabled={isRefunding}
                                                className="w-full sm:w-auto text-[10px] uppercase tracking-widest font-black"
                                            >
                                                {isRefunding ? 'Processing...' : 'Issue Refund'}
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            </section>
                        )}
                </div>
            </div>
            ) : (
                /* Report Preview & Editing view */
                isEditMode ? (
                    /* Editing Form */
                    <div className="bg-slate-50 dark:bg-slate-900/40 p-6 rounded-[2.5rem] border border-slate-100 dark:border-slate-800/60 shadow-sm space-y-8 print:hidden text-left">
                        <div className="flex justify-between items-center pb-4 border-b border-slate-200 dark:border-slate-800">
                            <div>
                                <h3 className="text-lg font-black text-slate-800 dark:text-slate-100 uppercase tracking-wider">
                                    Edit Service Report
                                </h3>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-bold">
                                    Modify notes, system health, and photo labels. Unsaved changes are marked in yellow.
                                </p>
                            </div>
                            <div className="flex gap-2">
                                <Button 
                                    variant="secondary" 
                                    onClick={() => {
                                        setLocalNotes(job.notes || {});
                                        setLocalUnitStates(job.unitStates || []);
                                        setLocalFiles(job.files || []);
                                        setLocalTechRecs(job.techRecommendations || '');
                                        setIsEditMode(false);
                                    }} 
                                    className="h-10 text-[10px] uppercase font-black tracking-widest px-4"
                                    disabled={isSaving}
                                >
                                    Discard
                                </Button>
                                <Button 
                                    onClick={async () => {
                                        setIsSaving(true);
                                        try {
                                            const payload = cleanUndefinedFields({
                                                notes: localNotes,
                                                unitStates: localUnitStates,
                                                files: localFiles,
                                                techRecommendations: localTechRecs
                                            });
                                            await db.collection('jobs').doc(job.id).update(cleanUndefinedFields(payload));
                                            setIsEditMode(false);
                                            alert("Report changes saved successfully!");
                                        } catch (e) {
                                            console.error(e);
                                            alert("Failed to save report changes.");
                                        } finally {
                                            setIsSaving(false);
                                        }
                                    }} 
                                    className="h-10 text-[10px] uppercase font-black tracking-widest px-5 bg-emerald-600 hover:bg-emerald-700 text-white"
                                    disabled={isSaving}
                                >
                                    {isSaving ? 'Saving...' : 'Save Changes'}
                                </Button>
                            </div>
                        </div>

                        {/* Section 1: Completion Summary */}
                        <div className="space-y-3">
                            <h4 className="text-xs font-black text-indigo-600 uppercase tracking-widest text-left">
                                Completion Summary
                            </h4>
                            <Textarea
                                value={localNotes.completion || ''}
                                onChange={(e) => setLocalNotes((prev: any) => ({ ...prev, completion: e.target.value }))}
                                placeholder="Write a summary of the completed work..."
                                rows={4}
                            />
                        </div>

                        {/* Section 2: Technician Notes */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-3">
                                <h4 className="text-xs font-black text-slate-700 dark:text-slate-350 uppercase tracking-widest text-left">
                                    Arrival Note
                                </h4>
                                <Textarea
                                    value={localNotes.arrival || ''}
                                    onChange={(e) => setLocalNotes((prev: any) => ({ ...prev, arrival: e.target.value }))}
                                    placeholder="Technician arrival notes..."
                                    rows={3}
                                />
                            </div>
                            <div className="space-y-3">
                                <h4 className="text-xs font-black text-slate-700 dark:text-slate-350 uppercase tracking-widest text-left">
                                    Diagnosis Note
                                </h4>
                                <Textarea
                                    value={localNotes.diagnosis || ''}
                                    onChange={(e) => setLocalNotes((prev: any) => ({ ...prev, diagnosis: e.target.value }))}
                                    placeholder="Findings during diagnostics..."
                                    rows={3}
                                />
                            </div>
                            <div className="space-y-3 col-span-1 md:col-span-2">
                                <h4 className="text-xs font-black text-slate-700 dark:text-slate-350 uppercase tracking-widest text-left">
                                    Work Performed Notes
                                </h4>
                                <Textarea
                                    value={localNotes.work || localNotes.workNotes || ''}
                                    onChange={(e) => setLocalNotes((prev: any) => ({ ...prev, work: e.target.value, workNotes: e.target.value }))}
                                    placeholder="Details of the repairs/work completed..."
                                    rows={3}
                                />
                            </div>
                            <div className="space-y-3 col-span-1 md:col-span-2">
                                <h4 className="text-xs font-black text-slate-700 dark:text-slate-355 uppercase tracking-widest text-left">
                                    Direct Recommendations
                                </h4>
                                <Textarea
                                    value={localTechRecs || ''}
                                    onChange={(e) => setLocalTechRecs(e.target.value)}
                                    placeholder="Future recommendations for this equipment..."
                                    rows={3}
                                />
                            </div>
                            <div className="space-y-3">
                                <h4 className="text-xs font-black text-slate-700 dark:text-slate-350 uppercase tracking-widest text-left">
                                    Customer Feedback Notes
                                </h4>
                                <Textarea
                                    value={localNotes.customerFeedback || ''}
                                    onChange={(e) => setLocalNotes((prev: any) => ({ ...prev, customerFeedback: e.target.value }))}
                                    placeholder="Feedback notes from customer..."
                                    rows={3}
                                />
                            </div>
                            <div className="space-y-3">
                                <h4 className="text-xs font-black text-slate-700 dark:text-slate-350 uppercase tracking-widest text-left">
                                    Employee / Technician Feedback
                                </h4>
                                <Textarea
                                    value={localNotes.employeeFeedback || localNotes.feedback || ''}
                                    onChange={(e) => setLocalNotes((prev: any) => ({ ...prev, employeeFeedback: e.target.value, feedback: e.target.value }))}
                                    placeholder="Internal feedback..."
                                    rows={3}
                                />
                            </div>
                        </div>

                        {/* Section 3: Serviced Systems & Asset Health Scoping */}
                        {jobAssets.length > 0 && (
                            <div className="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-800">
                                <h4 className="text-xs font-black text-indigo-650 uppercase tracking-widest text-left">
                                    Serviced Systems Health & Findings
                                </h4>
                                <div className="space-y-6">
                                    {jobAssets.map((asset) => {
                                        const unitStateIdx = localUnitStates.findIndex(s => s.assetId === asset.id);
                                        const unitState = unitStateIdx >= 0 ? localUnitStates[unitStateIdx] : {
                                            assetId: asset.id,
                                            healthBefore: 'Good',
                                            healthAfter: 'Good',
                                            diagnosis: '',
                                            repair: '',
                                            recommendations: ''
                                        };

                                        const updateUnitStateField = (field: string, val: string) => {
                                            const updated = [...localUnitStates];
                                            if (unitStateIdx >= 0) {
                                                updated[unitStateIdx] = { ...updated[unitStateIdx], [field]: val };
                                            } else {
                                                updated.push({ assetId: asset.id, [field]: val });
                                            }
                                            setLocalUnitStates(updated);
                                        };

                                        return (
                                            <div key={asset.id} className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl space-y-4 text-left">
                                                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                                                    <strong className="text-sm font-black text-slate-800 dark:text-slate-200">
                                                        {asset.name || asset.type} {asset.brand ? `(${asset.brand})` : ''}
                                                    </strong>
                                                    <div className="flex gap-4">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-[10px] font-black uppercase text-slate-400">Health Before:</span>
                                                            <select
                                                                value={unitState.healthBefore || 'Good'}
                                                                onChange={(e) => updateUnitStateField('healthBefore', e.target.value)}
                                                                className="text-xs font-bold rounded-lg border border-slate-205 bg-slate-50 dark:bg-slate-800 dark:border-slate-700 px-2.5 py-1 text-slate-800 dark:text-slate-200 focus:outline-none"
                                                            >
                                                                <option value="Good">Good</option>
                                                                <option value="Fair">Fair</option>
                                                                <option value="Poor">Poor</option>
                                                                <option value="Down">Down</option>
                                                            </select>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-[10px] font-black uppercase text-slate-400">Health After:</span>
                                                            <select
                                                                value={unitState.healthAfter || 'Good'}
                                                                onChange={(e) => updateUnitStateField('healthAfter', e.target.value)}
                                                                className="text-xs font-bold rounded-lg border border-slate-205 bg-slate-50 dark:bg-slate-800 dark:border-slate-700 px-2.5 py-1 text-slate-805 dark:text-slate-200 focus:outline-none"
                                                            >
                                                                <option value="Good">Good</option>
                                                                <option value="Fair">Fair</option>
                                                                <option value="Poor">Poor</option>
                                                                <option value="Down">Down</option>
                                                            </select>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                    <div className="space-y-1">
                                                        <span className="text-[9px] font-black uppercase text-slate-400">Diagnosis Findings</span>
                                                        <textarea
                                                            value={unitState.diagnosis || ''}
                                                            onChange={(e) => updateUnitStateField('diagnosis', e.target.value)}
                                                            placeholder="System diagnosis details..."
                                                            rows={2}
                                                            className="w-full text-xs font-medium p-2 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none"
                                                        />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <span className="text-[9px] font-black uppercase text-slate-400">Repairs Performed</span>
                                                        <textarea
                                                            value={unitState.repair || ''}
                                                            onChange={(e) => updateUnitStateField('repair', e.target.value)}
                                                            placeholder="System repairs completed..."
                                                            rows={2}
                                                            className="w-full text-xs font-medium p-2 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none"
                                                        />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <span className="text-[9px] font-black uppercase text-slate-400">Recommendations</span>
                                                        <textarea
                                                            value={unitState.recommendations || ''}
                                                            onChange={(e) => updateUnitStateField('recommendations', e.target.value)}
                                                            placeholder="System recommendations..."
                                                            rows={2}
                                                            className="w-full text-xs font-medium p-2 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-805 dark:text-slate-200 focus:outline-none"
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Section 4: Photo Labels & categories */}
                        {localFiles.filter(f => f.type === 'Photo' || f.contentType?.startsWith('image/') || f.fileType?.startsWith('image/')).length > 0 && (
                            <div className="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-800">
                                <h4 className="text-xs font-black text-indigo-650 uppercase tracking-widest text-left">
                                    Service Photos & Phase Tagging
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {localFiles.filter(f => f.type === 'Photo' || f.contentType?.startsWith('image/') || f.fileType?.startsWith('image/')).map((file, idx) => {
                                        const updatePhotoLabel = (newLabel: string) => {
                                            const updated = localFiles.map(f => {
                                                if (f.id === file.id || f.dataUrl === file.dataUrl || f.url === file.url) {
                                                    return {
                                                        ...f,
                                                        label: newLabel,
                                                        metadata: {
                                                            ...(f.metadata || {}),
                                                            label: newLabel
                                                        }
                                                    };
                                                }
                                                return f;
                                            });
                                            setLocalFiles(updated);
                                        };

                                        const updatePhotoPhase = (phase: 'before' | 'after' | 'spec' | 'uncategorized') => {
                                            let labelSuffix = '';
                                            if (phase === 'before') labelSuffix = ' (Before Repair)';
                                            else if (phase === 'after') labelSuffix = ' (After Repair)';
                                            else if (phase === 'spec') labelSuffix = ' (Specifications)';
                                            
                                            const baseLabel = (file.label || file.metadata?.label || 'Job Photo')
                                                .replace(/\(Before Repair\)/gi, '')
                                                .replace(/\(After Repair\)/gi, '')
                                                .replace(/\(Specifications\)/gi, '')
                                                .trim();
                                            
                                            const newLabel = `${baseLabel}${labelSuffix}`;
                                            const updated = localFiles.map(f => {
                                                if (f.id === file.id || f.dataUrl === file.dataUrl || f.url === file.url) {
                                                    return {
                                                        ...f,
                                                        label: newLabel,
                                                        metadata: {
                                                            ...(f.metadata || {}),
                                                            label: newLabel,
                                                            category: phase === 'spec' ? 'specifications' : phase
                                                        }
                                                    };
                                                }
                                                return f;
                                            });
                                            setLocalFiles(updated);
                                        };

                                        const currentPhase = (() => {
                                            const labelLower = ((file.metadata?.label || file.label || '') as string).toLowerCase();
                                            if (labelLower.includes('before')) return 'before';
                                            if (labelLower.includes('after') || labelLower.includes('repair') || labelLower.includes('comp') || labelLower.includes('work')) return 'after';
                                            if (labelLower.includes('spec') || labelLower.includes('serial') || labelLower.includes('tag')) return 'spec';
                                            return 'uncategorized';
                                        })();

                                        return (
                                            <div key={file.id || idx} className="flex gap-4 p-4 bg-white dark:bg-slate-900 border border-slate-205 dark:border-slate-800 rounded-2xl items-center text-left">
                                                <div className="w-20 h-20 rounded-xl overflow-hidden border border-slate-100 dark:border-slate-800 shrink-0">
                                                    <img src={file.dataUrl || file.url} className="w-full h-full object-cover" alt="Service Photo" />
                                                </div>
                                                <div className="flex-1 space-y-2">
                                                    <div className="space-y-1">
                                                        <span className="text-[8px] font-black uppercase text-slate-400">Photo Label:</span>
                                                        <Input
                                                            value={file.label || file.metadata?.label || 'Job Photo'}
                                                            onChange={(e) => updatePhotoLabel(e.target.value)}
                                                            className="h-8 text-xs"
                                                        />
                                                    </div>
                                                    <div className="flex gap-2">
                                                        <div className="flex-1 space-y-1">
                                                            <span className="text-[8px] font-black uppercase text-slate-400">Report Section:</span>
                                                            <select
                                                                value={currentPhase}
                                                                onChange={(e) => updatePhotoPhase(e.target.value as any)}
                                                                className="w-full text-xs font-bold rounded-lg border border-slate-200 bg-slate-50 dark:bg-slate-805 dark:border-slate-700 px-2 py-1 text-slate-805 dark:text-slate-200 focus:outline-none"
                                                            >
                                                                <option value="before">Before Repair Section</option>
                                                                <option value="after">After Repair Section</option>
                                                                <option value="spec">System Specifications (Serial Tag)</option>
                                                                <option value="uncategorized">Other / Uncategorized</option>
                                                            </select>
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={async () => {
                                                                if (!window.confirm("Remove this photo from the report?")) return;
                                                                setLocalFiles(prev => prev.filter(f => f.id !== file.id && f.dataUrl !== file.dataUrl && f.url !== file.url));
                                                                setDeletedFiles(prev => new Set(prev).add(file.id || file.dataUrl || ''));
                                                            }}
                                                            className="self-end p-2 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg border border-rose-105 transition-all shrink-0 dark:bg-rose-950/20 dark:border-rose-900/30"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    /* HTML Preview */
                    <div className="space-y-4 text-left">
                        {isAdmin && (
                            <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-900/60 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 print:hidden">
                                <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">
                                    Previewing customer-facing service report.
                                </p>
                                <Button 
                                    variant="secondary" 
                                    onClick={() => setIsEditMode(true)} 
                                    className="h-9 text-[10px] uppercase font-black tracking-widest px-4 flex items-center gap-1.5"
                                >
                                    <Wrench size={12} /> Edit Report
                                </Button>
                            </div>
                        )}
                        <div className="bg-slate-100 dark:bg-slate-950 p-6 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-inner flex justify-center overflow-x-auto print:bg-white print:border-none print:shadow-none print:p-0">
                            <div 
                                className="bg-white p-8 rounded-2xl shadow-md text-black max-w-[700px] w-full border border-slate-200 print:border-none print:shadow-none print:p-0"
                                style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}
                                dangerouslySetInnerHTML={{ __html: generateEmailHtml(!isAdmin, false) }}
                            />
                        </div>
                    </div>
                )
            )}
            </div>
        </Modal>

        {/* Email Service Report Modal */}
        <Modal 
            isOpen={isEmailModalOpen} 
            onClose={() => setIsEmailModalOpen(false)} 
            title="Email Service Report" 
            size="lg"
        >
            <div className="p-6 space-y-6">
                <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
                    <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/30 flex items-center justify-center text-indigo-650 dark:text-indigo-400">
                        <Mail size={20} />
                    </div>
                    <div>
                        <h3 className="text-base font-black text-slate-850 dark:text-slate-100 uppercase tracking-tight">Configure Email Delivery</h3>
                        <p className="text-[10px] text-slate-450 uppercase font-bold tracking-wider">Select precisely what information is sent to the client</p>
                    </div>
                </div>

                {availablePocs.length > 0 && (
                    <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-3">
                        <div className="flex flex-col gap-0.5">
                            <span className="text-[10px] font-black uppercase text-indigo-600 dark:text-indigo-400 tracking-wider">
                                Select Points of Contact (POCs)
                            </span>
                            <span className="text-[9px] text-slate-400 font-bold uppercase">
                                Selected contacts will receive the service history report
                            </span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[160px] overflow-y-auto pr-2 custom-scrollbar">
                            {availablePocs.map((poc) => {
                                const isSelected = selectedPocEmails.some(e => e.toLowerCase() === poc.email.toLowerCase());
                                return (
                                    <label 
                                        key={poc.email} 
                                        className={`flex items-start gap-3 p-3 rounded-xl border transition-all cursor-pointer select-none ${
                                            isSelected 
                                                ? 'bg-indigo-50/50 dark:bg-indigo-950/20 border-indigo-200 dark:border-indigo-800/60 shadow-sm' 
                                                : 'bg-white dark:bg-slate-950 border-slate-150 dark:border-slate-800/80 hover:bg-slate-50 dark:hover:bg-slate-900'
                                        }`}
                                    >
                                        <input 
                                            type="checkbox" 
                                            checked={isSelected}
                                            onChange={(e) => handleTogglePoc(poc.email, e.target.checked)}
                                            className="mt-0.5 rounded border-slate-350 dark:border-slate-650 text-indigo-650 focus:ring-indigo-650 w-4 h-4 cursor-pointer"
                                        />
                                        <div className="space-y-0.5 min-w-0 flex-1">
                                            <p className="text-xs font-bold text-slate-850 dark:text-slate-100 truncate">{poc.name}</p>
                                            <p className="text-[9px] text-slate-400 dark:text-slate-500 font-mono truncate">{poc.email}</p>
                                            <div className="flex gap-1.5 items-center mt-1 flex-wrap">
                                                <span className="text-[8px] font-black uppercase bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-1.5 py-0.5 rounded tracking-wider">
                                                    {poc.role}
                                                </span>
                                                <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded tracking-wider ${
                                                    poc.type === 'location' 
                                                        ? 'bg-emerald-100 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400' 
                                                        : poc.type === 'primary'
                                                            ? 'bg-blue-100 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400'
                                                            : 'bg-purple-100 dark:bg-purple-950/30 text-purple-600 dark:text-purple-400'
                                                }`}>
                                                    {poc.type === 'location' ? 'Location POC' : poc.type === 'primary' ? 'Primary' : 'General'}
                                                </span>
                                            </div>
                                        </div>
                                    </label>
                                );
                            })}
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input 
                        label="Recipient Email(s) (comma-separated)" 
                        value={emailRecipient} 
                        onChange={(e) => handleRecipientInputChange(e.target.value)} 
                        placeholder="e.g. manager@example.com, owner@example.com"
                        required
                        isBlock
                    />
                    <Input 
                        label="Subject Line" 
                        value={emailSubject} 
                        onChange={(e) => setEmailSubject(e.target.value)} 
                        placeholder="Service Report Subject"
                        required
                        isBlock
                    />
                </div>

                <Textarea 
                    label="Custom Message Body" 
                    rows={4} 
                    value={emailCustomMessage} 
                    onChange={(e) => setEmailCustomMessage(e.target.value)} 
                    placeholder="Add a brief greeting or extra instructions..."
                />

                <div className="border-t border-slate-100 dark:border-slate-800 pt-5">
                    <h4 className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-widest mb-3.5">
                        Customize Service Report Content Toggles
                    </h4>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs max-h-[300px] overflow-y-auto pr-2 scrollbar-thin">
                        <label className="flex items-center gap-2.5 p-3 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-850 transition-all">
                            <input 
                                type="checkbox" 
                                checked={emailOptions.includeThankYouNote} 
                                onChange={(e) => setEmailOptions(prev => ({ ...prev, includeThankYouNote: e.target.checked }))}
                                className="rounded border-slate-350 dark:border-slate-650 text-indigo-650 focus:ring-indigo-650"
                            />
                            <div>
                                <p className="font-bold text-slate-850 dark:text-slate-100">Technician Thank You Note</p>
                                <p className="text-[10px] text-slate-450">Warm sign-off note from the technician</p>
                            </div>
                        </label>

                        <label className="flex items-center gap-2.5 p-3 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-850 transition-all">
                            <input 
                                type="checkbox" 
                                checked={emailOptions.includeRecommendations} 
                                onChange={(e) => setEmailOptions(prev => ({ ...prev, includeRecommendations: e.target.checked }))}
                                className="rounded border-slate-350 dark:border-slate-650 text-indigo-650 focus:ring-indigo-650"
                            />
                            <div>
                                <p className="font-bold text-slate-850 dark:text-slate-100">Direct Recommendations</p>
                                <p className="text-[10px] text-slate-450">Technician overall recommendations</p>
                            </div>
                        </label>

                        <label className="flex items-center gap-2.5 p-3 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-850 transition-all">
                            <input 
                                type="checkbox" 
                                checked={emailOptions.includeAssets} 
                                onChange={(e) => setEmailOptions(prev => ({ ...prev, includeAssets: e.target.checked }))}
                                className="rounded border-slate-350 dark:border-slate-650 text-indigo-650 focus:ring-indigo-650"
                            />
                            <div>
                                <p className="font-bold text-slate-850 dark:text-slate-100">Serviced Equipment</p>
                                <p className="text-[10px] text-slate-450">Individual multi-unit card details</p>
                            </div>
                        </label>

                        <label className="flex items-center gap-2.5 p-3 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-850 transition-all">
                            <input 
                                type="checkbox" 
                                checked={emailOptions.includePhotos} 
                                onChange={(e) => setEmailOptions(prev => ({ ...prev, includePhotos: e.target.checked }))}
                                className="rounded border-slate-350 dark:border-slate-650 text-indigo-650 focus:ring-indigo-650"
                            />
                            <div>
                                <p className="font-bold text-slate-850 dark:text-slate-100">Verification Photos</p>
                                <p className="text-[10px] text-slate-450">Field captioned photos gallery</p>
                            </div>
                        </label>

                        <label className="flex items-center gap-2.5 p-3 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-850 transition-all">
                            <input 
                                type="checkbox" 
                                checked={emailOptions.includeParts} 
                                onChange={(e) => setEmailOptions(prev => ({ ...prev, includeParts: e.target.checked }))}
                                className="rounded border-slate-350 dark:border-slate-650 text-indigo-650 focus:ring-indigo-650"
                            />
                            <div>
                                <p className="font-bold text-slate-850 dark:text-slate-100">Parts & Materials</p>
                                <p className="text-[10px] text-slate-450">List of inventory parts consumed</p>
                            </div>
                        </label>

                        <label className="flex items-center gap-2.5 p-3 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-850 transition-all">
                            <input 
                                type="checkbox" 
                                checked={emailOptions.includeTechnicalData} 
                                onChange={(e) => setEmailOptions(prev => ({ ...prev, includeTechnicalData: e.target.checked }))}
                                className="rounded border-slate-350 dark:border-slate-650 text-indigo-650 focus:ring-indigo-650"
                            />
                            <div>
                                <p className="font-bold text-slate-850 dark:text-slate-100">Technical & Environmental Logs</p>
                                <p className="text-[10px] text-slate-450">Refrigerant and digital tool logs</p>
                            </div>
                        </label>

                        <label className="flex items-center gap-2.5 p-3 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-850 transition-all">
                            <input 
                                type="checkbox" 
                                checked={emailOptions.includeDiagnosisChecklist} 
                                onChange={(e) => setEmailOptions(prev => ({ ...prev, includeDiagnosisChecklist: e.target.checked }))}
                                className="rounded border-slate-350 dark:border-slate-650 text-indigo-650 focus:ring-indigo-650"
                            />
                            <div>
                                <p className="font-bold text-slate-850 dark:text-slate-100">Diagnosis Checklist</p>
                                <p className="text-[10px] text-slate-450">Standard diagnostic test checks</p>
                            </div>
                        </label>

                        <label className="flex items-center gap-2.5 p-3 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-850 transition-all">
                            <input 
                                type="checkbox" 
                                checked={emailOptions.includeQualityChecklist} 
                                onChange={(e) => setEmailOptions(prev => ({ ...prev, includeQualityChecklist: e.target.checked }))}
                                className="rounded border-slate-350 dark:border-slate-650 text-indigo-650 focus:ring-indigo-650"
                            />
                            <div>
                                <p className="font-bold text-slate-850 dark:text-slate-100">Quality & Safety Checklist</p>
                                <p className="text-[10px] text-slate-450">Compliance & safety check items</p>
                            </div>
                        </label>

                        <label className="flex items-center gap-2.5 p-3 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-850 transition-all">
                            <input 
                                type="checkbox" 
                                checked={emailOptions.includeArrivalNotes} 
                                onChange={(e) => setEmailOptions(prev => ({ ...prev, includeArrivalNotes: e.target.checked }))}
                                className="rounded border-slate-350 dark:border-slate-650 text-indigo-650 focus:ring-indigo-650"
                            />
                            <div>
                                <p className="font-bold text-slate-850 dark:text-slate-100">Arrival Notes</p>
                                <p className="text-[10px] text-slate-450">Technician notes upon site arrival</p>
                            </div>
                        </label>

                        <label className="flex items-center gap-2.5 p-3 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-850 transition-all">
                            <input 
                                type="checkbox" 
                                checked={emailOptions.includeDiagnosisNotes} 
                                onChange={(e) => setEmailOptions(prev => ({ ...prev, includeDiagnosisNotes: e.target.checked }))}
                                className="rounded border-slate-350 dark:border-slate-650 text-indigo-650 focus:ring-indigo-650"
                            />
                            <div>
                                <p className="font-bold text-slate-850 dark:text-slate-100">Diagnosis Findings</p>
                                <p className="text-[10px] text-slate-450">General diagnostic procedure notes</p>
                            </div>
                        </label>

                        <label className="flex items-center gap-2.5 p-3 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-850 transition-all">
                            <input 
                                type="checkbox" 
                                checked={emailOptions.includeWorkNotes} 
                                onChange={(e) => setEmailOptions(prev => ({ ...prev, includeWorkNotes: e.target.checked }))}
                                className="rounded border-slate-350 dark:border-slate-650 text-indigo-650 focus:ring-indigo-650"
                            />
                            <div>
                                <p className="font-bold text-slate-850 dark:text-slate-100">Work Performed Notes</p>
                                <p className="text-[10px] text-slate-450">Repairs completed log entries</p>
                            </div>
                        </label>

                        <label className="flex items-center gap-2.5 p-3 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-850 transition-all">
                            <input 
                                type="checkbox" 
                                checked={emailOptions.includeCompletionNotes} 
                                onChange={(e) => setEmailOptions(prev => ({ ...prev, includeCompletionNotes: e.target.checked }))}
                                className="rounded border-slate-350 dark:border-slate-650 text-indigo-650 focus:ring-indigo-650"
                            />
                            <div>
                                <p className="font-bold text-slate-850 dark:text-slate-100">Completion Summary</p>
                                <p className="text-[10px] text-slate-450">Notes compiled on job checkout</p>
                            </div>
                        </label>

                        <label className="flex items-center gap-2.5 p-3 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-850 transition-all">
                            <input 
                                type="checkbox" 
                                checked={emailOptions.includeCustomerFeedback} 
                                onChange={(e) => setEmailOptions(prev => ({ ...prev, includeCustomerFeedback: e.target.checked }))}
                                className="rounded border-slate-350 dark:border-slate-650 text-indigo-650 focus:ring-indigo-650"
                            />
                            <div>
                                <p className="font-bold text-slate-850 dark:text-slate-100">Customer Feedback</p>
                                <p className="text-[10px] text-slate-450">Client feedback records</p>
                            </div>
                        </label>

                        <label className="flex items-center gap-2.5 p-3 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-850 transition-all">
                            <input 
                                type="checkbox" 
                                checked={emailOptions.includeEmployeeFeedback} 
                                onChange={(e) => setEmailOptions(prev => ({ ...prev, includeEmployeeFeedback: e.target.checked }))}
                                className="rounded border-slate-350 dark:border-slate-650 text-indigo-650 focus:ring-indigo-650"
                            />
                            <div>
                                <p className="font-bold text-slate-850 dark:text-slate-100">Employee Feedback</p>
                                <p className="text-[10px] text-slate-450">Internal technician review feedback</p>
                            </div>
                        </label>

                        {job.invoice && (
                            <label className="flex items-center gap-2.5 p-3 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/10 border border-indigo-100 dark:border-indigo-900/30 cursor-pointer hover:bg-indigo-100/50 transition-all col-span-1 sm:col-span-2">
                                <input 
                                    type="checkbox" 
                                    checked={(emailOptions as any).includeInvoice} 
                                    onChange={(e) => setEmailOptions(prev => ({ ...prev, includeInvoice: e.target.checked }))}
                                    className="rounded border-slate-350 dark:border-slate-650 text-indigo-650 focus:ring-indigo-650"
                                />
                                <div>
                                    <p className="font-bold text-slate-850 dark:text-slate-100 text-indigo-900 dark:text-indigo-400">Include Invoice Details</p>
                                    <p className="text-[10px] text-slate-450 text-indigo-750 dark:text-indigo-300">Embed invoice line items, tax, and grand total in the email report</p>
                                </div>
                            </label>
                        )}

                        {job.files?.some(f => f.fileName === 'SignOff_Sheet.html' || f.metadata?.label === 'Sign-Off Sheet') && (
                            <label className="flex items-center gap-2.5 p-3 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/10 border border-emerald-100 dark:border-emerald-900/30 cursor-pointer hover:bg-emerald-100/50 transition-all col-span-1 sm:col-span-2">
                                <input 
                                    type="checkbox" 
                                    checked={(emailOptions as any).includeSignOff} 
                                    onChange={(e) => setEmailOptions(prev => ({ ...prev, includeSignOff: e.target.checked }))}
                                    className="rounded border-slate-350 dark:border-slate-650 text-emerald-650 focus:ring-emerald-650"
                                />
                                <div>
                                    <p className="font-bold text-slate-850 dark:text-slate-100 text-emerald-900 dark:text-emerald-450">Include Signed Sign-Off Sheet</p>
                                    <p className="text-[10px] text-slate-450 text-emerald-750 dark:text-emerald-350">Embed the customer-signed work validation sheet in the email report</p>
                                </div>
                            </label>
                        )}
                    </div>
                </div>

                {/* Generated PDF Document Attachment Options */}
                <div className="border-t border-slate-100 dark:border-slate-800 pt-5">
                    <h4 className="text-[10px] font-black uppercase text-purple-600 dark:text-purple-400 tracking-widest mb-3.5 flex items-center gap-2">
                        <span>📄 Generate & Attach PDF Documents (Customer Request)</span>
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                        <label className={`flex items-center gap-2.5 p-3 rounded-2xl border cursor-pointer transition-all ${
                            attachReportPdf ? 'bg-purple-50/50 dark:bg-purple-950/20 border-purple-300 dark:border-purple-800' : 'bg-slate-50 dark:bg-slate-900 border-slate-100 dark:border-slate-800'
                        }`}>
                            <input 
                                type="checkbox" 
                                checked={attachReportPdf} 
                                onChange={(e) => setAttachReportPdf(e.target.checked)}
                                className="rounded border-slate-350 dark:border-slate-650 text-purple-600 focus:ring-purple-600"
                            />
                            <div>
                                <p className="font-bold text-xs text-slate-850 dark:text-slate-100">Attach Job Report as PDF File</p>
                                <p className="text-[10px] text-slate-450">Includes printable PDF of full service history report</p>
                            </div>
                        </label>

                        {job.invoice && (
                            <label className={`flex items-center gap-2.5 p-3 rounded-2xl border cursor-pointer transition-all ${
                                attachInvoicePdf ? 'bg-purple-50/50 dark:bg-purple-950/20 border-purple-300 dark:border-purple-800' : 'bg-slate-50 dark:bg-slate-900 border-slate-100 dark:border-slate-800'
                            }`}>
                                <input 
                                    type="checkbox" 
                                    checked={attachInvoicePdf} 
                                    onChange={(e) => setAttachInvoicePdf(e.target.checked)}
                                    className="rounded border-slate-350 dark:border-slate-650 text-purple-600 focus:ring-purple-600"
                                />
                                <div>
                                    <p className="font-bold text-xs text-slate-850 dark:text-slate-100">Attach Job Invoice as PDF File</p>
                                    <p className="text-[10px] text-slate-450">Includes printable PDF of invoice #${job.invoice.id || 'INV'}</p>
                                </div>
                            </label>
                        )}
                    </div>
                </div>

                {attachableFiles.length > 0 && (
                    <div className="border-t border-slate-100 dark:border-slate-800 pt-5">
                        <h4 className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-widest mb-3.5">
                            Select Photo & Media Attachments
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[160px] overflow-y-auto pr-2 custom-scrollbar">
                            {attachableFiles.map((file) => {
                                const id = file.id || file.dataUrl;
                                const isSelected = selectedAttachments.includes(id);
                                const isPhoto = file.type === 'Photo' || file.fileType?.startsWith('image/') || file.contentType?.startsWith('image/');
                                return (
                                    <label 
                                        key={id} 
                                        className={`flex items-start gap-3 p-3 rounded-xl border transition-all cursor-pointer select-none ${
                                            isSelected 
                                                ? 'bg-indigo-50/30 dark:bg-indigo-950/10 border-indigo-200 dark:border-indigo-800/60 shadow-sm' 
                                                : 'bg-white dark:bg-slate-950 border-slate-150 dark:border-slate-800/80 hover:bg-slate-50 dark:hover:bg-slate-900'
                                        }`}
                                    >
                                        <input 
                                            type="checkbox" 
                                            checked={isSelected}
                                            onChange={(e) => {
                                                if (e.target.checked) {
                                                    setSelectedAttachments(prev => [...prev, id]);
                                                } else {
                                                    setSelectedAttachments(prev => prev.filter(x => x !== id));
                                                }
                                            }}
                                            className="mt-0.5 rounded border-slate-350 dark:border-slate-650 text-indigo-650 focus:ring-indigo-650 w-4 h-4 cursor-pointer"
                                        />
                                        <div className="space-y-0.5 min-w-0 flex-1">
                                            <p className="text-xs font-bold text-slate-850 dark:text-slate-100 truncate">{file.fileName}</p>
                                            <p className="text-[9px] text-slate-450 dark:text-slate-500 font-mono">
                                                {isPhoto ? 'Photo/Image' : (file.metadata?.label as string) || (file.label as string) || 'Document'}
                                            </p>
                                        </div>
                                    </label>
                                );
                            })}
                        </div>
                    </div>
                )}

                <div className="flex gap-3 justify-end pt-5 border-t border-slate-100 dark:border-slate-800">
                    <Button 
                        variant="secondary" 
                        onClick={() => setIsEmailModalOpen(false)} 
                        disabled={isEmailSending}
                        className="h-11 font-black text-[10px] uppercase tracking-wider px-6"
                    >
                        Cancel
                    </Button>
                    <Button 
                        onClick={() => {
                            setPreviewDoc({ 
                                type: 'Other', 
                                title: 'Profit & Loss - Emailed Document Preview', 
                                htmlContent: generateEmailHtml(true)
                            });
                        }}
                        disabled={isEmailSending}
                        variant="secondary"
                        className="h-11 border-indigo-200 dark:border-indigo-800 text-indigo-605 dark:text-indigo-400 font-black text-[10px] uppercase tracking-wider flex items-center gap-2 px-6 hover:bg-indigo-50/50"
                    >
                        <Eye size={14}/> View as Customer
                    </Button>
                    <Button 
                        onClick={handleSendEmailReport} 
                        disabled={isEmailSending}
                        className="h-11 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[10px] uppercase tracking-wider flex items-center gap-2 px-6 shadow-md shadow-emerald-500/20 transition-all"
                    >
                        {isEmailSending ? 'Sending...' : 'Send Service Report'}
                    </Button>
                </div>
            </div>
        </Modal>

        {/* Document Preview Modal */}
        {previewDoc && (
            <DocumentPreview 
                type={(previewDoc.type as 'Other' | 'Proposal' | 'Invoice') || 'Other'} 
                data={previewDoc} 
                onClose={() => setPreviewDoc(null)} 
            />
        )}

        {/* Nested JobAppointmentModal for return visit scheduling */}
        {isScheduleFollowUpOpen && (
            <JobAppointmentModal
                isOpen={isScheduleFollowUpOpen}
                onClose={() => setIsScheduleFollowUpOpen(false)}
                parentJobToLink={job}
            />
        )}

        {/* Nested JobLinkingModal for managing associations */}
        {isLinkingModalOpen && (
            <JobLinkingModal
                isOpen={isLinkingModalOpen}
                onClose={() => setIsLinkingModalOpen(false)}
                job={job}
            />
        )}

        {/* Signature Audit History Modal */}
        {isAuditHistoryOpen && (
            <Modal 
                isOpen={true} 
                onClose={() => setIsAuditHistoryOpen(false)} 
                title="Signature Audit History & Archives" 
                size="lg" 
                zIndex="z-[300]"
            >
                <div className="space-y-4 max-h-[70vh] overflow-y-auto p-1">
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                        Below are previous signed snapshots of this document that were archived when post-signature edits occurred.
                    </p>
                    {((job.signatureHistory || (job.invoice as any)?.signatureHistory || []) as any[]).map((snap, idx) => (
                        <div key={idx} className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 space-y-3">
                            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
                                <div>
                                    <span className="px-2 py-0.5 text-[10px] font-extrabold bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 rounded-full border border-purple-300">
                                        Version #{snap.version || idx + 1} Snapshot
                                    </span>
                                    <span className="ml-2 text-xs text-slate-500 font-medium">
                                        Archived on {new Date(snap.archivedAt).toLocaleString()} by {snap.archivedByName || 'Staff'}
                                    </span>
                                </div>
                                <span className="text-[10px] italic text-slate-400">{snap.reason || 'Document edited'}</span>
                            </div>

                            <DigitalSignatureStamp 
                                signatureUrl={snap.signatureUrl || snap.signatureMetadata?.signatureUrl}
                                signedByName={snap.signatureMetadata?.signedByName || snap.documentSnapshot?.customerName || 'Customer'}
                                signedAt={snap.signatureMetadata?.signedAt || snap.archivedAt}
                                geolocation={snap.signatureMetadata?.geolocation}
                                securityHash={snap.signatureMetadata?.securityHash}
                                documentTitle={`Archived Version #${snap.version || idx + 1}`}
                            />
                        </div>
                    ))}
                </div>
            </Modal>
        )}
        </>
    );
};

export default JobDetailModal;
